import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import * as cookie from "cookie";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { audit } from "./guards";

// ── Хэширование паролей (scrypt, без внешних зависимостей) ──

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ── Первичный администратор ──
// Создаётся один раз при старте, если ни одного пользователя с логином нет.
// Пароль: из переменной окружения ADMIN_PASSWORD, иначе "admin12345" (смените после входа!)

let seeded = false;
export async function ensureAdminSeed() {
  if (seeded) return;
  seeded = true;
  try {
    const db = getDb();
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return;
    const password = process.env.ADMIN_PASSWORD || "admin12345";
    await db.insert(users).values({
      unionId: "local:admin",
      login: "admin",
      passwordHash: hashPassword(password),
      name: "Администратор",
      role: "admin",
      lastSignInAt: new Date(),
    });
    console.log("[auth] Создан первичный администратор: логин 'admin'");
  } catch (e) {
    console.error("[auth] seed admin failed", e);
  }
}

// ── Антибрутфорс: не более 5 попыток входа за 5 минут на логин ──
const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.resetAt > now && rec.count >= 5) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много попыток. Повторите через 5 минут",
    });
  }
  if (!rec || rec.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
  } else {
    rec.count++;
  }
}

export const localAuthRouter = createRouter({
  login: publicQuery
    .input(z.object({ login: z.string().min(1).max(255), password: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(input.login.toLowerCase());
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.login, input.login)).limit(1);
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный логин или пароль" });
      }
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));

      const token = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );
      await audit(user, "auth.login", "auth", user.id, user.login ?? undefined);
      return { ok: true };
    }),

  changePassword: authedQuery
    .input(z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(8).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.passwordHash || !verifyPassword(input.oldPassword, user.passwordHash)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Текущий пароль неверен" });
      }
      await db
        .update(users)
        .set({ passwordHash: hashPassword(input.newPassword) })
        .where(eq(users.id, ctx.user.id));
      await audit(ctx.user, "user.changePassword", "user", ctx.user.id);
      return { ok: true };
    }),
});
