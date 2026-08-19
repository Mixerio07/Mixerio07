import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { audit } from "./guards";

export const usersRouter = createRouter({
  // Список сотрудников (для назначения задач) — всем авторизованным
  list: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,
        avatar: users.avatar,
        lastSignInAt: users.lastSignInAt,
      })
      .from(users)
      .orderBy(users.name);
  }),

  // Смена роли (группа доступа) — только админ
  setRole: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "manager", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      if (target.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя менять свою собственную роль" });
      }
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await audit(ctx.user, "user.setRole", "user", input.userId, `${target.name}: ${target.role} → ${input.role}`);
      return { ok: true };
    }),

  // Должность — админ или сам пользователь
  setPosition: authedQuery
    .input(z.object({ userId: z.number().int().positive(), position: z.string().max(255) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет прав" });
      }
      const db = getDb();
      await db.update(users).set({ position: input.position }).where(eq(users.id, input.userId));
      await audit(ctx.user, "user.setPosition", "user", input.userId, input.position);
      return { ok: true };
    }),

  // Полный список с датами — только админ
  listFull: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(users).orderBy(desc(users.createdAt));
  }),

  // Создание сотрудника с логином/паролем — только админ
  createUser: adminQuery
    .input(
      z.object({
        login: z.string().min(3).max(255).regex(/^[a-zA-Z0-9_.-]+$/, "Только латиница, цифры, _ . -"),
        password: z.string().min(8).max(255),
        name: z.string().min(1).max(255),
        position: z.string().max(255).optional(),
        role: z.enum(["user", "manager", "admin"]).default("user"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.login, input.login)).limit(1);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Такой логин уже занят" });
      const { hashPassword } = await import("./local-auth");
      const [res] = await db.insert(users).values({
        unionId: `local:${input.login}`,
        login: input.login,
        passwordHash: hashPassword(input.password),
        name: input.name,
        position: input.position ?? null,
        role: input.role,
        lastSignInAt: new Date(),
      });
      const id = Number(res.insertId);
      await audit(ctx.user, "user.create", "user", id, `${input.name} (${input.login}), роль ${input.role}`);
      return { id };
    }),

  // Сброс пароля сотруднику — только админ
  resetPassword: adminQuery
    .input(z.object({ userId: z.number().int().positive(), newPassword: z.string().min(8).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      const { hashPassword } = await import("./local-auth");
      await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, input.userId));
      await audit(ctx.user, "user.resetPassword", "user", input.userId, target.name ?? undefined);
      return { ok: true };
    }),
});
