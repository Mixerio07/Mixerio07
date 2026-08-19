import { createHash } from "crypto";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tasks, taskEvents, users } from "@db/schema";
import { audit, isManagerOrAdmin } from "./guards";
import type { User } from "@db/schema";

// ── Смарт-контракт задачи ─────────────────────────────────────
// Машина состояний: какие переходы допустимы и кто их может делать.

type ContractState =
  | "draft" | "funded" | "in_work" | "submitted" | "completed" | "disputed" | "cancelled";

type Action = "fund" | "start" | "submit" | "approve" | "dispute" | "resolve" | "cancel";

// action → [from, to, кто может: creator | assignee | manager]
const TRANSITIONS: Record<Action, { from: ContractState[]; to: ContractState; actor: "creator" | "assignee" | "manager" }> = {
  fund:    { from: ["draft"],                  to: "funded",    actor: "creator" },
  start:   { from: ["funded"],                 to: "in_work",   actor: "assignee" },
  submit:  { from: ["in_work"],                to: "submitted", actor: "assignee" },
  approve: { from: ["submitted", "disputed"],  to: "completed", actor: "creator" },
  dispute: { from: ["submitted"],              to: "disputed",  actor: "creator" },
  resolve: { from: ["disputed"],               to: "completed", actor: "manager" },
  cancel:  { from: ["draft", "funded"],        to: "cancelled", actor: "creator" },
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function appendEvent(
  taskId: number,
  actor: User,
  action: string,
  payload?: Record<string, unknown>,
) {
  const db = getDb();
  const [last] = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.seq))
    .limit(1);
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? "0".repeat(64);
  const payloadStr = payload ? JSON.stringify(payload) : "";
  const hash = sha256(`${taskId}:${seq}:${actor.id}:${action}:${payloadStr}:${prevHash}`);
  await db.insert(taskEvents).values({
    taskId,
    seq,
    actorId: actor.id,
    action,
    payload: payloadStr || null,
    prevHash,
    hash,
  });
  return { seq, hash };
}

async function getTaskOrFail(id: number) {
  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
  return task;
}

function assertTransition(task: any, action: Action, user: User) {
  const t = TRANSITIONS[action];
  if (!t) throw new TRPCError({ code: "BAD_REQUEST", message: "Неизвестное действие" });
  const state = (task.contractState ?? "draft") as ContractState;
  if (!t.from.includes(state)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Действие недопустимо в состоянии «${state}»`,
    });
  }
  const allowed =
    t.actor === "creator"
      ? task.creatorId === user.id || isManagerOrAdmin(user)
      : t.actor === "assignee"
        ? task.assigneeId === user.id
        : isManagerOrAdmin(user);
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Это действие вам недоступно по контракту" });
  }
  return t.to;
}

export const contractsRouter = createRouter({
  // Создать задачу-контракт
  create: authedQuery
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(10000).optional(),
        assigneeId: z.number().int().positive(),
        reward: z.string().max(255).optional(),
        dueDate: z.coerce.date().nullish(),
        projectId: z.number().int().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [res] = await db.insert(tasks).values({
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId,
        creatorId: ctx.user.id,
        projectId: input.projectId ?? null,
        dueDate: input.dueDate ?? null,
        status: "todo",
        isContract: true,
        contractState: "draft",
        reward: input.reward ?? null,
      });
      const id = Number(res.insertId);
      await appendEvent(id, ctx.user, "create", {
        title: input.title,
        assigneeId: input.assigneeId,
        reward: input.reward ?? null,
      });
      await audit(ctx.user, "contract.create", "task", id, input.title);
      return { id };
    }),

  // Действие по контракту (fund/start/submit/approve/dispute/resolve/cancel)
  act: authedQuery
    .input(z.object({ taskId: z.number().int().positive(), action: z.enum(["fund", "start", "submit", "approve", "dispute", "resolve", "cancel"]), comment: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await getTaskOrFail(input.taskId);
      if (!task.isContract) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Это не задача-контракт" });
      }
      const newState = assertTransition(task, input.action, ctx.user);
      const db = getDb();
      // синхронизируем обычный статус задачи
      const statusMap: Record<string, "todo" | "in_progress" | "review" | "done"> = {
        draft: "todo", funded: "todo", in_work: "in_progress",
        submitted: "review", disputed: "review", completed: "done", cancelled: "done",
      };
      await db
        .update(tasks)
        .set({ contractState: newState as any, status: statusMap[newState] })
        .where(eq(tasks.id, task.id));
      await appendEvent(task.id, ctx.user, input.action, {
        to: newState,
        comment: input.comment ?? null,
      });
      await audit(ctx.user, `contract.${input.action}`, "task", task.id, task.title);
      return { ok: true, state: newState };
    }),

  // История событий контракта с проверкой целостности цепочки
  events: authedQuery
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const task = await getTaskOrFail(input.taskId);
      const mine = task.assigneeId === ctx.user.id || task.creatorId === ctx.user.id;
      if (!mine && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к контракту" });
      }
      const db = getDb();
      const rows = await db
        .select({ event: taskEvents, actorName: users.name })
        .from(taskEvents)
        .leftJoin(users, eq(taskEvents.actorId, users.id))
        .where(eq(taskEvents.taskId, input.taskId))
        .orderBy(taskEvents.seq);

      // Верификация хэш-цепочки
      let prevHash = "0".repeat(64);
      let intact = true;
      for (const r of rows) {
        const e = r.event;
        const expected = sha256(`${e.taskId}:${e.seq}:${e.actorId}:${e.action}:${e.payload ?? ""}:${prevHash}`);
        if (e.prevHash !== prevHash || e.hash !== expected) { intact = false; break; }
        prevHash = e.hash;
      }

      return {
        events: rows.map((r) => ({ ...r.event, actorName: r.actorName })),
        intact,
        headHash: prevHash,
      };
    }),
});
