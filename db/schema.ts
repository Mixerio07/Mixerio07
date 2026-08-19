import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  longtext,
  timestamp,
  bigint,
  int,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  login: varchar("login", { length: 255 }).unique(),
  passwordHash: varchar("passwordHash", { length: 500 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  // user = сотрудник, manager = руководитель, admin = администратор
  role: mysqlEnum("role", ["user", "manager", "admin"]).default("user").notNull(),
  position: varchar("position", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "paused", "completed"])
    .default("active")
    .notNull(),
  createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Project = typeof projects.$inferSelect;

export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: bigint("projectId", { mode: "number", unsigned: true }),
  parentId: bigint("parentId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["todo", "in_progress", "review", "done"])
    .default("todo")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
    .default("medium")
    .notNull(),
  assigneeId: bigint("assigneeId", { mode: "number", unsigned: true }),
  creatorId: bigint("creatorId", { mode: "number", unsigned: true }).notNull(),
  dueDate: timestamp("dueDate"),
  tags: varchar("tags", { length: 500 }),
  // Смарт-контракт: задача с фиксацией условий и хэш-цепочкой событий
  isContract: boolean("isContract").default(false).notNull(),
  contractState: mysqlEnum("contractState", [
    "draft",      // черновик условий
    "funded",     // условия подтверждены, «средства» заблокированы
    "in_work",    // исполнитель взял в работу
    "submitted",  // результат сдан на проверку
    "completed",  // принято, расчёт завершён
    "disputed",   // спор
    "cancelled",  // отменён
  ]),
  reward: varchar("reward", { length: 255 }), // сумма/условия расчёта, напр. "150 000 ₽"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;

// ── Смарт-контракты задач ────────────────────────────────────
// Хэш-цепочка событий (как в блокчейне): каждое событие содержит
// хэш предыдущего, поэтому историю нельзя незаметно изменить.
export const taskEvents = mysqlTable("task_events", {
  id: serial("id").primaryKey(),
  taskId: bigint("taskId", { mode: "number", unsigned: true }).notNull(),
  seq: int("seq").notNull(), // порядковый номер события в цепочке задачи
  actorId: bigint("actorId", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // create, fund, start, submit, approve, dispute, resolve, cancel
  payload: text("payload"), // JSON с деталями
  prevHash: varchar("prevHash", { length: 64 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskEvent = typeof taskEvents.$inferSelect;

export const taskComments = mysqlTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: bigint("taskId", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskComment = typeof taskComments.$inferSelect;

export const documents = mysqlTable("documents", {
  id: serial("id").primaryKey(),
  // ownerId = null → общий документ (видят все); иначе личный документ сотрудника
  ownerId: bigint("ownerId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 255 }).notNull(),
  size: int("size").notNull(),
  data: longtext("data").notNull(), // base64
  createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;

export const siteContent = mysqlTable("site_content", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  data: longtext("data").notNull(), // JSON
  updatedById: bigint("updatedById", { mode: "number", unsigned: true }),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type SiteContent = typeof siteContent.$inferSelect;

export const auditLogs = mysqlTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(), // task.create, document.delete …
  entity: varchar("entity", { length: 100 }).notNull(), // task | project | document | user | auth
  entityId: varchar("entityId", { length: 100 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
