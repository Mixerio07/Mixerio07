import { z } from "zod";
import { desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documents, users } from "@db/schema";
import { audit, isManagerOrAdmin } from "./guards";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 МБ

export const documentsRouter = createRouter({
  // scope=shared — общая база; scope=mine — личные документы текущего пользователя;
  // scope=user&userId=N — личные документы сотрудника (руководитель/админ)
  list: authedQuery
    .input(
      z.object({
        scope: z.enum(["shared", "mine", "user"]).default("shared"),
        userId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      let cond;
      if (input.scope === "shared") {
        cond = isNull(documents.ownerId);
      } else if (input.scope === "mine") {
        cond = eq(documents.ownerId, ctx.user.id);
      } else {
        if (!isManagerOrAdmin(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к чужим документам" });
        }
        if (!input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Укажите userId" });
        cond = eq(documents.ownerId, input.userId);
      }
      const rows = await db
        .select({
          id: documents.id,
          ownerId: documents.ownerId,
          title: documents.title,
          description: documents.description,
          fileName: documents.fileName,
          mimeType: documents.mimeType,
          size: documents.size,
          createdById: documents.createdById,
          createdAt: documents.createdAt,
          creatorName: users.name,
        })
        .from(documents)
        .leftJoin(users, eq(documents.createdById, users.id))
        .where(cond)
        .orderBy(desc(documents.createdAt));
      return rows;
    }),

  upload: authedQuery
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        fileName: z.string().min(1).max(500),
        mimeType: z.string().max(255).default("application/octet-stream"),
        dataBase64: z.string().min(1),
        // куда кладём: в общую базу (ownerId=null) или в личную папку пользователя
        ownerId: z.number().int().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const size = Math.floor((input.dataBase64.length * 3) / 4);
      if (size > MAX_FILE_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Файл больше 5 МБ" });
      }
      // В общую базу могут грузить руководитель и админ; сотрудник — только в личную папку
      let ownerId = input.ownerId ?? null;
      if (ownerId === null && !isManagerOrAdmin(ctx.user)) {
        ownerId = ctx.user.id;
      }
      if (ownerId !== null && ownerId !== ctx.user.id && !isManagerOrAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нельзя загружать файлы другому сотруднику" });
      }
      const db = getDb();
      const [res] = await db.insert(documents).values({
        ownerId,
        title: input.title,
        description: input.description ?? null,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size,
        data: input.dataBase64,
        createdById: ctx.user.id,
      });
      const id = Number(res.insertId);
      await audit(
        ctx.user,
        "document.upload",
        "document",
        id,
        `${input.title} (${input.fileName})${ownerId === null ? " [общая]" : ""}`,
      );
      return { id };
    }),

  download: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Документ не найден" });
      const allowed =
        row.ownerId === null || row.ownerId === ctx.user.id || isManagerOrAdmin(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к документу" });
      await audit(ctx.user, "document.download", "document", input.id, row.title);
      return {
        fileName: row.fileName,
        mimeType: row.mimeType,
        dataBase64: row.data,
      };
    }),

  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Документ не найден" });
      const allowed =
        row.createdById === ctx.user.id || row.ownerId === ctx.user.id || isManagerOrAdmin(ctx.user);
      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Удалить может владелец, загрузивший или админ" });
      }
      await db.delete(documents).where(eq(documents.id, input.id));
      await audit(ctx.user, "document.delete", "document", input.id, row.title);
      return { ok: true };
    }),
});
