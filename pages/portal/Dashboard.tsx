import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { TaskStatuses, TaskPriorities } from "@contracts/constants";
import { Link } from "react-router";
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({});
  const { data: projects } = trpc.projects.list.useQuery();

  const all = tasks ?? [];
  const byStatus = (s: string) => all.filter((t) => t.status === s).length;
  const overdue = all.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done",
  );
  const myOpen = all.filter(
    (t) => t.assigneeId === user?.id && t.status !== "done",
  );
  const recent = all.slice(0, 8);

  const stats = [
    { label: "К выполнению", value: byStatus("todo"), icon: ListTodo, color: "text-slate-300" },
    { label: "В работе", value: byStatus("in_progress"), icon: Clock, color: "text-blue-400" },
    { label: "На проверке", value: byStatus("review"), icon: AlertTriangle, color: "text-amber-400" },
    { label: "Готово", value: byStatus("done"), icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <PortalLayout title="Дашборд">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1e293b] rounded-lg p-5 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className={`text-3xl font-semibold ${s.color}`}>{s.value}</span>
              <s.icon size={22} className={s.color} />
            </div>
            <div className="text-xs text-slate-400 mt-2">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Мои открытые задачи</h2>
            <Link to="/portal/tasks" className="text-xs text-[#c5a059] hover:underline">
              Все задачи →
            </Link>
          </div>
          {isLoading && <div className="text-slate-500 text-sm">Загрузка…</div>}
          {!isLoading && myOpen.length === 0 && (
            <div className="text-slate-500 text-sm">Открытых задач нет</div>
          )}
          <div className="space-y-2">
            {myOpen.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                to={`/portal/tasks?open=${t.id}`}
                className="block bg-slate-800/50 hover:bg-slate-800 rounded-md px-4 py-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white truncate">{t.title}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      t.priority === "urgent"
                        ? "bg-red-500/20 text-red-300"
                        : t.priority === "high"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-slate-600/40 text-slate-300"
                    }`}
                  >
                    {TaskPriorities[t.priority]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {TaskStatuses[t.status]}
                  {t.projectName ? ` · ${t.projectName}` : ""}
                  {t.dueDate ? ` · до ${new Date(t.dueDate).toLocaleDateString("ru-RU")}` : ""}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
            <h2 className="font-semibold text-white mb-3">
              Просроченные задачи{" "}
              {overdue.length > 0 && (
                <span className="text-red-400 text-sm">({overdue.length})</span>
              )}
            </h2>
            {overdue.length === 0 && <div className="text-slate-500 text-sm">Нет просроченных</div>}
            <div className="space-y-2">
              {overdue.slice(0, 4).map((t) => (
                <Link
                  key={t.id}
                  to={`/portal/tasks?open=${t.id}`}
                  className="block bg-red-950/30 border border-red-900/40 rounded-md px-4 py-2.5"
                >
                  <div className="text-sm text-white truncate">{t.title}</div>
                  <div className="text-xs text-red-300/70 mt-0.5">
                    Срок: {t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : "—"}
                    {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">Активные проекты</h2>
              <Link to="/portal/projects" className="text-xs text-[#c5a059] hover:underline">
                Все проекты →
              </Link>
            </div>
            {(projects ?? [])
              .filter((p) => p.status === "active")
              .slice(0, 5)
              .map((p) => (
                <div key={p.id} className="py-2 border-b border-slate-700/40 last:border-0">
                  <div className="text-sm text-white">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-slate-500 truncate">{p.description}</div>
                  )}
                </div>
              ))}
            {(projects ?? []).filter((p) => p.status === "active").length === 0 && (
              <div className="text-slate-500 text-sm">Проектов пока нет</div>
            )}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-6 bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
          <h2 className="font-semibold text-white mb-3">Недавно обновлённые</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
                  <th className="pb-2 pr-4">Задача</th>
                  <th className="pb-2 pr-4">Статус</th>
                  <th className="pb-2 pr-4">Исполнитель</th>
                  <th className="pb-2">Обновлена</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link to={`/portal/tasks?open=${t.id}`} className="text-white hover:text-[#c5a059]">
                        {t.title}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400">{TaskStatuses[t.status]}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{t.assigneeName ?? "—"}</td>
                    <td className="py-2.5 text-slate-500">
                      {new Date(t.updatedAt).toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
