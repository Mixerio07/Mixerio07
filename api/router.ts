import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { tasksRouter } from "./tasks-router";
import { projectsRouter } from "./projects-router";
import { documentsRouter } from "./documents-router";
import { usersRouter } from "./users-router";
import { logsRouter } from "./logs-router";
import { localAuthRouter } from "./local-auth";
import { siteRouter } from "./site-router";
import { contractsRouter } from "./contracts-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  tasks: tasksRouter,
  projects: projectsRouter,
  documents: documentsRouter,
  users: usersRouter,
  logs: logsRouter,
  localAuth: localAuthRouter,
  site: siteRouter,
  contracts: contractsRouter,
});

export type AppRouter = typeof appRouter;
