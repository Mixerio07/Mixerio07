import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { siteContent } from "@db/schema";
import { audit } from "./guards";

// Контент публичного сайта-визитки.
// Хранится одной записью key="landing" с JSON-структурой полей.

export type LandingContent = {
  hero: {
    label: string;
    title: string;
    desc: string;
    stats: { num: string; label: string }[];
  };
  about: {
    title: string;
    text1: string;
    text2: string;
    features: string[];
  };
  servicesHeader: { label: string; title: string; desc: string };
  services: { icon: string; title: string; desc: string; items: string[] }[];
  it: { badge?: string; icon: string; title: string; desc: string; items: string[] }[];
  projectsHeader: { label: string; title: string; desc: string };
  projects: { icon: string; title: string; desc: string }[];
  cta: { title: string; desc: string; btn: string };
  footerAddress: string;
};

const KEY = "landing";

async function readContent(): Promise<LandingContent | null> {
  const db = getDb();
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, KEY)).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.data) as LandingContent;
  } catch {
    return null;
  }
}

export const siteRouter = createRouter({
  // Публичное чтение — используется лендингом
  get: publicQuery.query(async () => {
    return await readContent();
  }),

  // Сохранение — только админ
  save: adminQuery
    .input(z.object({ json: z.string().min(2).max(500000) }))
    .mutation(async ({ ctx, input }) => {
      // валидация JSON
      JSON.parse(input.json);
      const db = getDb();
      const existing = await readContent();
      if (existing) {
        await db
          .update(siteContent)
          .set({ data: input.json, updatedById: ctx.user.id })
          .where(eq(siteContent.key, KEY));
      } else {
        await db.insert(siteContent).values({
          key: KEY,
          data: input.json,
          updatedById: ctx.user.id,
        });
      }
      await audit(ctx.user, "site.update", "site", KEY, "Обновление контента сайта");
      return { ok: true };
    }),
});
