import { useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AuditActions } from "@contracts/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const entityLabels: Record<string, string> = {
  task: "Задачи",
  project: "Проекты",
  document: "Документы",
  user: "Пользователи",
  auth: "Авторизация",
};

export default function Logs() {
  const { user: me } = useAuth();
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = trpc.logs.list.useQuery(
    {
      entity: entity === "all" ? undefined : entity,
      search: search || undefined,
    },
    { enabled: me?.role === "admin" },
  );

  if (me?.role !== "admin") {
    return (
      <PortalLayout title="Журнал действий">
        <div className="text-slate-400">Раздел доступен только администратору.</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Журнал действий">
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-sm">
            <SelectValue placeholder="Раздел" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все разделы</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          placeholder="Поиск по деталям…"
          className="w-64 bg-slate-800 border-slate-700 text-sm"
        />
      </div>

      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
              <th className="p-3">Время</th>
              <th className="p-3">Пользователь</th>
              <th className="p-3">Действие</th>
              <th className="p-3">Раздел</th>
              <th className="p-3">Объект</th>
              <th className="p-3">Детали</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                <td className="p-3 text-slate-500 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="p-3 text-white">{l.userName ?? "—"}</td>
                <td className="p-3 text-slate-300">
                  {AuditActions[l.action as keyof typeof AuditActions] ?? l.action}
                </td>
                <td className="p-3 text-slate-400">{entityLabels[l.entity] ?? l.entity}</td>
                <td className="p-3 text-slate-500">{l.entityId ?? "—"}</td>
                <td className="p-3 text-slate-400 max-w-md truncate">{l.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (logs ?? []).length === 0 && (
          <div className="p-10 text-center text-slate-500 text-sm">Записей пока нет</div>
        )}
        {isLoading && <div className="p-6 text-slate-500 text-sm">Загрузка…</div>}
      </div>
    </PortalLayout>
  );
}
