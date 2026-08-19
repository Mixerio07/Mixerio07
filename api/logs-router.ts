import { z } from "zod";
import { desc, eq, and, like } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { auditLogs } from "@db/schema";

export const logsRouter = createRouter({
  list: adminQuery
    .input(
      z
        .object({
          entity: z.string().max(100).optional(),
          userId: z.number().int().positive().optional(),
          search: z.string().max(200).optional(),
          limit: z.number().int().min(1).max(500).default(200),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input?.entity) conds.push(eq(auditLogs.entity, input.entity));
      if (input?.userId) conds.push(eq(auditLogs.userId, input.userId));
      if (input?.search) conds.push(like(auditLogs.details, `%${input.search}%`));
      return db
        .select()
        .from(auditLogs)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(input?.limit ?? 200);
    }),
});
