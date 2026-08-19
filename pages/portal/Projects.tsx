import { useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { ProjectStatuses } from "@contracts/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Status = keyof typeof ProjectStatuses;

const statusCls: Record<Status, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  paused: "bg-amber-500/20 text-amber-300",
  completed: "bg-slate-600/40 text-slate-300",
};

export default function Projects() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const { data: tasks } = trpc.tasks.list.useQuery({});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("active");

  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setOpen(false);
    },
  });
  const update = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setOpen(false);
    },
  });
  const remove = trpc.projects.remove.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const taskCount = (pid: number) => (tasks ?? []).filter((t) => t.projectId === pid).length;
  const doneCount = (pid: number) =>
    (tasks ?? []).filter((t) => t.projectId === pid && t.status === "done").length;

  return (
    <PortalLayout title="Проекты">
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm text-slate-400">
          {(projects ?? []).length} проект(ов)
        </div>
        {isManager && (
          <Button
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setStatus("active");
              setOpen(true);
            }}
            className="bg-[#991b1b] hover:bg-[#b91c1c] text-white"
          >
            <Plus size={16} className="mr-1" /> Новый проект
          </Button>
        )}
      </div>

      {isLoading && <div className="text-slate-500">Загрузка…</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(projects ?? []).map((p) => (
          <div key={p.id} className="bg-[#1e293b] border border-slate-700/50 rounded-lg p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-white">{p.name}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${statusCls[p.status as Status]}`}>
                {ProjectStatuses[p.status as Status]}
              </span>
            </div>
            {p.description && (
              <p className="text-sm text-slate-400 mt-2 line-clamp-3">{p.description}</p>
            )}
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-slate-500">
                Задач: {taskCount(p.id)} · выполнено {doneCount(p.id)}
              </div>
              {isManager && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setName(p.name);
                      setDescription(p.description ?? "");
                      setStatus(p.status as Status);
                      setOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm(`Удалить проект «${p.name}»? Задачи останутся без проекта.`))
                          remove.mutate({ id: p.id });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {taskCount(p.id) > 0 && (
              <div className="h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-[#c5a059] rounded-full"
                  style={{ width: `${Math.round((doneCount(p.id) / taskCount(p.id)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {!isLoading && (projects ?? []).length === 0 && (
        <div className="text-center text-slate-500 py-16">
          Проектов пока нет. {isManager && "Создайте первый."}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? "Редактировать проект" : "Новый проект"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="Название проекта *"
              className="bg-slate-800 border-slate-700"
            />
            <Textarea
              value={description}
              onChange={(e: any) => setDescription(e.target.value)}
              placeholder="Описание"
              className="bg-slate-800 border-slate-700 min-h-24"
            />
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ProjectStatuses) as Status[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ProjectStatuses[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!name.trim() || create.isPending || update.isPending}
              onClick={() => {
                if (editing) update.mutate({ id: editing.id, name, description, status });
                else create.mutate({ name, description, status });
              }}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
            >
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
