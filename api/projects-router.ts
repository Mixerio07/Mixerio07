import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { projects, tasks } from "@db/schema";
import { audit, requireRoles } from "./guards";

const projectInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  status: z.enum(["active", "paused", "completed"]).optional(),
});

export const projectsRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }),

  create: authedQuery.input(projectInput).mutation(async ({ ctx, input }) => {
    requireRoles(ctx.user, ["manager", "admin"]);
    const db = getDb();
    const [res] = await db.insert(projects).values({
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "active",
      createdById: ctx.user.id,
    });
    const id = Number(res.insertId);
    await audit(ctx.user, "project.create", "project", id, input.name);
    return { id };
  }),

  update: authedQuery
    .input(projectInput.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["manager", "admin"]);
      const db = getDb();
      const { id, ...data } = input;
      await db.update(projects).set(data).where(eq(projects.id, id));
      await audit(ctx.user, "project.update", "project", id, input.name);
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["admin"]);
      const db = getDb();
      const [row] = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Проект не найден" });
      await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, input.id));
      await db.delete(projects).where(eq(projects.id, input.id));
      await audit(ctx.user, "project.delete", "project", input.id, row.name);
      return { ok: true };
    }),
});
