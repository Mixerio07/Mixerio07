import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { auditLogs } from "@db/schema";
import type { User } from "@db/schema";

export type Role = "user" | "manager" | "admin";

/** Проверка, что у пользователя одна из разрешённых ролей */
export function requireRoles(user: User, roles: Role[]) {
  if (!roles.includes(user.role as Role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Недостаточно прав для этого действия",
    });
  }
}

export function isManagerOrAdmin(user: User) {
  return user.role === "manager" || user.role === "admin";
}

/** Запись действия в журнал аудита (не роняем основной запрос при ошибке) */
export async function audit(
  user: User | undefined,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: string,
) {
  try {
    await getDb()
      .insert(auditLogs)
      .values({
        userId: user?.id ?? null,
        userName: user?.name ?? user?.email ?? "system",
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        details: details ?? null,
      });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
