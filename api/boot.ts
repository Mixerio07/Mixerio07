import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { ensureAdminSeed } from "./local-auth";
import { Paths } from "@contracts/constants";

ensureAdminSeed();

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Security headers (защита от clickjacking, MIME-sniffing, сокращение утечек)
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
});

app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// Публичный контент лендинга (из БД; пусто — лендинг использует встроенные тексты)
app.get("/api/content", async (c) => {
  try {
    const { getDb } = await import("./queries/connection");
    const { siteContent } = await import("@db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await getDb().select().from(siteContent).where(eq(siteContent.key, "landing")).limit(1);
    if (!row) return c.json({}, 200);
    return c.json(JSON.parse(row.data), 200);
  } catch (e) {
    console.error("[content] read failed", e);
    return c.json({}, 200);
  }
});
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
