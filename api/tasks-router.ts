import { z } from "zod";
import { and, desc, eq, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tasks, taskComments, users, projects } from "@db/schema";
import { audit, isManagerOrAdmin } from "./guards";

const statusEnum = z.enum(["todo", "in_progress", "review", "done"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const taskInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  projectId: z.number().int().positive().nullish(),
  parentId: z.number().int().positive().nullish(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.number().int().positive().nullish(),
  dueDate: z.coerce.date().nullish(),
  tags: z.string().max(500).optional(),
  isContract: z.boolean().optional(),
  reward: z.string().max(255).nullish(),
});

export const tasksRouter = createRouter({
  // Список задач: сотрудник — только свои (назначенные или созданные им),
  // руководитель и админ — все
  list: authedQuery
    .input(
      z
        .object({
          status: statusEnum.optional(),
          projectId: z.number().int().positive().optional(),
          assigneeId: z.number().int().positive().optional(),
          onlyRoot: z.boolean().optional(), // без подзадач
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conds = [];
      if (!isManagerOrAdmin(ctx.user)) {
        conds.push(
          or(eq(tasks.assigneeId, ctx.user.id), eq(tasks.creatorId, ctx.user.id)),
        );
      }
      if (input?.status) conds.push(eq(tasks.status, input.status));
      if (input?.projectId) conds.push(eq(tasks.projectId, input.projectId));
      if (input?.assigneeId) conds.push(eq(tasks.assigneeId, input.assigneeId));
      if (input?.onlyRoot) conds.push(isNull(tasks.parentId));

      const rows = await db
        .select({
          task: tasks,
          assigneeName: users.name,
          projectName: projects.name,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(tasks.updatedAt));

      return rows.map((r) => ({
        ...r.task,
        assigneeName: r.assigneeName,
        projectName: r.projectName,
      }));
    }),

  subtasks: authedQuery
    .input(z.object({ parentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      // Проверка доступа к родительской задаче
      const [parent] = await db.select().from(tasks).where(eq(tasks.id, input.parentId)).limit(1);
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const mine = parent.assigneeId === ctx.user.id || parent.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к задаче" });
      }
      return db
        .select()
        .from(tasks)
        .where(eq(tasks.parentId, input.parentId))
        .orderBy(tasks.createdAt);
    }),

  get: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const mine =
        row.assigneeId === ctx.user.id || row.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к задаче" });
      }
      const comments = await db
        .select({
          comment: taskComments,
          userName: users.name,
        })
        .from(taskComments)
        .leftJoin(users, eq(taskComments.userId, users.id))
        .where(eq(taskComments.taskId, input.id))
        .orderBy(taskComments.createdAt);
      const subs = await db
        .select()
        .from(tasks)
        .where(eq(tasks.parentId, input.id))
        .orderBy(tasks.createdAt);
      return { task: row, comments: comments.map((c) => ({ ...c.comment, userName: c.userName })), subtasks: subs };
    }),

  create: authedQuery.input(taskInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    // Сотрудник может назначать задачи только на себя
    const assigneeId = isManagerOrAdmin(ctx.user)
      ? (input.assigneeId ?? ctx.user.id)
      : ctx.user.id;
    const [res] = await db.insert(tasks).values({
      title: input.title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigneeId,
      creatorId: ctx.user.id,
      dueDate: input.dueDate ?? null,
      tags: input.tags ?? null,
      isContract: input.isContract ?? false,
      contractState: input.isContract ? "draft" : null,
      reward: input.isContract ? (input.reward ?? null) : null,
    });
    const id = Number(res.insertId);
    if (input.isContract) {
      const { appendEvent } = await import("./contracts-router");
      await appendEvent(id, ctx.user, "create", {
        title: input.title,
        assigneeId,
        reward: input.reward ?? null,
      });
    }
    await audit(ctx.user, input.isContract ? "contract.create" : "task.create", "task", id, input.title);
    return { id };
  }),

  update: authedQuery
    .input(taskInput.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const mine = row.assigneeId === ctx.user.id || row.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет прав на изменение задачи" });
      }
      const { id, ...data } = input;
      // Сотрудник не может переназначать задачи на других
      if (!isManagerOrAdmin(ctx.user)) {
        delete data.assigneeId;
        delete data.projectId;
      }
      // Нельзя снять флаг контракта у уже идущего контракта — только отменой
      if (row.isContract && data.isContract === false) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Контракт нельзя «выключить» — используйте отмену контракта",
        });
      }
      // Включение контракта на существующей задаче — фиксируем событие
      if (!row.isContract && data.isContract === true) {
        (data as any).contractState = "draft";
        const { appendEvent } = await import("./contracts-router");
        await appendEvent(id, ctx.user, "create", {
          title: data.title ?? row.title,
          assigneeId: row.assigneeId,
          reward: data.reward ?? null,
        });
      }
      await db
        .update(tasks)
        .set({
          ...data,
          dueDate: data.dueDate === undefined ? undefined : data.dueDate,
        })
        .where(eq(tasks.id, id));
      await audit(ctx.user, "task.update", "task", id, input.title ?? row.title);
      return { ok: true };
    }),

  setStatus: authedQuery
    .input(z.object({ id: z.number().int().positive(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const mine = row.assigneeId === ctx.user.id || row.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет прав на изменение задачи" });
      }
      await db.update(tasks).set({ status: input.status }).where(eq(tasks.id, input.id));
      await audit(ctx.user, "task.status", "task", input.id, `${row.title} → ${input.status}`);
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      if (row.creatorId !== ctx.user.id && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Удалить может автор, руководитель или админ" });
      }
      await db.delete(taskComments).where(eq(taskComments.taskId, input.id));
      await db.update(tasks).set({ parentId: null }).where(eq(tasks.parentId, input.id));
      await db.delete(tasks).where(eq(tasks.id, input.id));
      await audit(ctx.user, "task.delete", "task", input.id, row.title);
      return { ok: true };
    }),

  addComment: authedQuery
    .input(z.object({ taskId: z.number().int().positive(), text: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const mine = row.assigneeId === ctx.user.id || row.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к задаче" });
      }
      await db.insert(taskComments).values({
        taskId: input.taskId,
        userId: ctx.user.id,
        text: input.text,
      });
      await audit(ctx.user, "task.comment", "task", input.taskId, row.title);
      return { ok: true };
    }),
});
