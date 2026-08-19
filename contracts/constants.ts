export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

// ── Портал: роли и словари ──────────────────────────────────

export const Roles = {
  user: "Сотрудник",
  manager: "Руководитель",
  admin: "Администратор",
} as const;

export const TaskStatuses = {
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
} as const;

export const TaskPriorities = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
} as const;

export const ProjectStatuses = {
  active: "Активный",
  paused: "На паузе",
  completed: "Завершён",
} as const;

export const AuditActions = {
  "auth.login": "Вход в систему",
  "task.create": "Создание задачи",
  "task.update": "Изменение задачи",
  "task.status": "Смена статуса задачи",
  "task.delete": "Удаление задачи",
  "task.comment": "Комментарий к задаче",
  "project.create": "Создание проекта",
  "project.update": "Изменение проекта",
  "project.delete": "Удаление проекта",
  "document.upload": "Загрузка документа",
  "document.download": "Скачивание документа",
  "document.delete": "Удаление документа",
  "user.setRole": "Смена роли",
  "user.setPosition": "Смена должности",
  "site.update": "Обновление контента сайта",
  "contract.create": "Создание смарт-контракта",
  "contract.fund": "Блокировка средств по контракту",
  "contract.start": "Контракт взят в работу",
  "contract.submit": "Результат сдан по контракту",
  "contract.approve": "Контракт принят",
  "contract.dispute": "Спор по контракту",
  "contract.resolve": "Спор разрешён",
  "contract.cancel": "Контракт отменён",
} as const;

// Смарт-контракты: состояния и действия
export const ContractStates = {
  draft: "Черновик",
  funded: "Средства заблокированы",
  in_work: "В работе",
  submitted: "На проверке",
  completed: "Исполнен",
  disputed: "Спор",
  cancelled: "Отменён",
} as const;

export const ContractActions = {
  create: "Создание контракта",
  fund: "Блокировка средств",
  start: "Взят в работу",
  submit: "Результат сдан",
  approve: "Принятие результата",
  dispute: "Открытие спора",
  resolve: "Разрешение спора",
  cancel: "Отмена контракта",
} as const;
