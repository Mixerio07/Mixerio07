import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { TaskStatuses, TaskPriorities, ContractStates, ContractActions } from "@contracts/constants";
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
import { Plus, LayoutList, Columns3, Trash2, CalendarDays, FileSignature as FileContract, ShieldCheck, ShieldAlert } from "lucide-react";

type Status = keyof typeof TaskStatuses;
type Priority = keyof typeof TaskPriorities;

const statusOrder: Status[] = ["todo", "in_progress", "review", "done"];

function PriorityBadge({ p }: { p: Priority }) {
  const cls =
    p === "urgent"
      ? "bg-red-500/20 text-red-300"
      : p === "high"
        ? "bg-amber-500/20 text-amber-300"
        : p === "medium"
          ? "bg-blue-500/20 text-blue-300"
          : "bg-slate-600/40 text-slate-300";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>{TaskPriorities[p]}</span>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("open");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
    status: filterStatus === "all" ? undefined : (filterStatus as Status),
    projectId: filterProject === "all" ? undefined : Number(filterProject),
    assigneeId: filterAssignee === "all" ? undefined : Number(filterAssignee),
    onlyRoot: true,
  });
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: employees } = trpc.users.list.useQuery();

  const openTaskQuery = trpc.tasks.get.useQuery(
    { id: Number(openId) },
    { enabled: !!openId },
  );

  const contractEventsQuery = trpc.contracts.events.useQuery(
    { taskId: Number(openId) },
    { enabled: !!openId && !!openTaskQuery.data?.task?.isContract },
  );
  const contractAct = trpc.contracts.act.useMutation({
    onSuccess: () => {
      invalidateContract();
    },
    onError: (e) => alert(e.message),
  });
  const invalidateContract = () => {
    utils.tasks.list.invalidate();
    if (openId) {
      utils.tasks.get.invalidate({ id: Number(openId) });
      utils.contracts.events.invalidate({ taskId: Number(openId) });
    }
  };

  const invalidate = () => {
    utils.tasks.list.invalidate();
    if (openId) utils.tasks.get.invalidate({ id: Number(openId) });
  };

  const setStatus = trpc.tasks.setStatus.useMutation({ onSuccess: invalidate });
  const remove = trpc.tasks.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setSearchParams({});
    },
  });
  const save = trpc.tasks.create.useMutation({
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
      setEditing(null);
    },
  });
  const update = trpc.tasks.update.useMutation({
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
      setEditing(null);
    },
  });
  const addComment = trpc.tasks.addComment.useMutation({ onSuccess: invalidate });

  const grouped = useMemo(() => {
    const g: Record<Status, any[]> = { todo: [], in_progress: [], review: [], done: [] };
    (tasks ?? []).forEach((t) => g[t.status as Status]?.push(t));
    return g;
  }, [tasks]);

  const [commentText, setCommentText] = useState("");
  const [subTitle, setSubTitle] = useState("");

  return (
    <PortalLayout title="Задачи">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Button
          onClick={() => {
            setEditing(null);
            setEditOpen(true);
          }}
          className="bg-[#991b1b] hover:bg-[#b91c1c] text-white"
        >
          <Plus size={16} className="mr-1" /> Новая задача
        </Button>
        <div className="flex bg-slate-800 rounded-md overflow-hidden">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-2 text-xs flex items-center gap-1 ${view === "kanban" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            <Columns3 size={14} /> Канбан
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 text-xs flex items-center gap-1 ${view === "list" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            <LayoutList size={14} /> Список
          </button>
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-sm">
            <SelectValue placeholder="Проект" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все проекты</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isManager && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-sm">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все исполнители</SelectItem>
              {(employees ?? []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name ?? e.email ?? `#${e.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-sm">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {statusOrder.map((s) => (
              <SelectItem key={s} value={s}>
                {TaskStatuses[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="text-slate-500">Загрузка…</div>}

      {/* Kanban */}
      {!isLoading && view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statusOrder.map((s) => (
            <div key={s} className="bg-slate-800/40 rounded-lg p-3 min-h-40">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {TaskStatuses[s]}
                </span>
                <span className="text-xs text-slate-500">{grouped[s].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[s].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSearchParams({ open: String(t.id) })}
                    className="w-full text-left bg-[#1e293b] hover:bg-slate-700/60 border border-slate-700/50 rounded-md p-3 transition-colors"
                  >
                    <div className="text-sm text-white leading-snug flex items-center gap-1.5">
                      {t.isContract && <FileContract size={13} className="text-[#c5a059] shrink-0" />}
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <PriorityBadge p={t.priority as Priority} />
                      {t.isContract && t.contractState && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c5a059]/20 text-[#c5a059]">
                          {ContractStates[t.contractState as keyof typeof ContractStates]}
                        </span>
                      )}
                      {t.projectName && (
                        <span className="text-[10px] text-[#c5a059]">{t.projectName}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>{t.assigneeName ?? "—"}</span>
                      {t.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={11} />
                          {new Date(t.dueDate).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!isLoading && view === "list" && (
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
                <th className="p-3">Задача</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Приоритет</th>
                <th className="p-3">Проект</th>
                <th className="p-3">Исполнитель</th>
                <th className="p-3">Срок</th>
              </tr>
            </thead>
            <tbody>
              {(tasks ?? []).map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSearchParams({ open: String(t.id) })}
                  className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="p-3 text-white">{t.title}</td>
                  <td className="p-3 text-slate-400">{TaskStatuses[t.status as Status]}</td>
                  <td className="p-3"><PriorityBadge p={t.priority as Priority} /></td>
                  <td className="p-3 text-slate-400">{t.projectName ?? "—"}</td>
                  <td className="p-3 text-slate-400">{t.assigneeName ?? "—"}</td>
                  <td className="p-3 text-slate-400">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(tasks ?? []).length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">Задач нет</div>
          )}
        </div>
      )}

      {/* Task detail dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setSearchParams({})}>
        <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
          {openTaskQuery.data && (
            <TaskDetail
              data={openTaskQuery.data}
              isManager={isManager}
              employees={employees ?? []}
              contract={contractEventsQuery.data}
              onContractAct={(action: string) => contractAct.mutate({ taskId: Number(openId), action: action as any })}
              meId={user?.id}
              onStatus={(s: Status) =>
                setStatus.mutate({ id: Number(openId), status: s })
              }
              onEdit={() => {
                setEditing(openTaskQuery.data.task);
                setEditOpen(true);
              }}
              onDelete={() => {
                if (confirm("Удалить задачу?")) remove.mutate({ id: Number(openId) });
              }}
              onAddComment={() => {
                if (!commentText.trim()) return;
                addComment.mutate({ taskId: Number(openId), text: commentText });
                setCommentText("");
              }}
              commentText={commentText}
              setCommentText={setCommentText}
              subTitle={subTitle}
              setSubTitle={setSubTitle}
              onAddSubtask={() => {
                if (!subTitle.trim()) return;
                save.mutate({
                  title: subTitle,
                  parentId: Number(openId),
                  projectId: openTaskQuery.data.task.projectId ?? undefined,
                });
                setSubTitle("");
              }}
              onOpenSubtask={(id: number) => setSearchParams({ open: String(id) })}
            />
          )}
          {openTaskQuery.isLoading && <div className="text-slate-500 p-4">Загрузка…</div>}
        </DialogContent>
      </Dialog>

      {/* Create/edit dialog */}
      <TaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={editing}
        projects={projects ?? []}
        employees={employees ?? []}
        isManager={isManager}
        saving={save.isPending || update.isPending}
        onSubmit={(data: any) => {
          if (editing) update.mutate({ id: editing.id, ...data });
          else save.mutate(data);
        }}
      />
    </PortalLayout>
  );
}

function TaskDetail(props: any) {
  const { data, isManager, contract } = props;
  const t = data.task;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white text-lg leading-snug flex items-center gap-2">
          {t.isContract && <FileContract size={18} className="text-[#c5a059] shrink-0" />}
          {t.title}
        </DialogTitle>
      </DialogHeader>
      {t.isContract && (
        <ContractPanel task={t} contract={contract} onAct={props.onContractAct} meId={props.meId} isManager={isManager} />
      )}
      <div className="flex flex-wrap gap-2 my-3">
        {(Object.keys(TaskStatuses) as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => props.onStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              t.status === s
                ? "bg-[#991b1b] border-[#991b1b] text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-400"
            }`}
          >
            {TaskStatuses[s]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <span className="text-slate-500">Приоритет: </span>
          <PriorityBadge p={t.priority} />
        </div>
        <div>
          <span className="text-slate-500">Срок: </span>
          {t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : "—"}
        </div>
        <div>
          <span className="text-slate-500">Создана: </span>
          {new Date(t.createdAt).toLocaleString("ru-RU")}
        </div>
        <div>
          <span className="text-slate-500">Теги: </span>
          {t.tags || "—"}
        </div>
      </div>
      {t.description && (
        <div className="bg-slate-800/60 rounded-md p-3 text-sm whitespace-pre-wrap mb-4">
          {t.description}
        </div>
      )}

      {/* Subtasks */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Подзадачи ({data.subtasks.length})
        </div>
        <div className="space-y-1.5 mb-2">
          {data.subtasks.map((s: any) => (
            <button
              key={s.id}
              onClick={() => props.onOpenSubtask(s.id)}
              className="w-full flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 rounded px-3 py-2 text-sm text-left"
            >
              <span className={s.status === "done" ? "line-through text-slate-500" : "text-white"}>
                {s.title}
              </span>
              <span className="text-[11px] text-slate-500">{TaskStatuses[s.status as Status]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={props.subTitle}
            onChange={(e: any) => props.setSubTitle(e.target.value)}
            placeholder="Новая подзадача…"
            className="bg-slate-800 border-slate-700 text-sm"
          />
          <Button size="sm" onClick={props.onAddSubtask} className="bg-slate-700 hover:bg-slate-600">
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* Comments */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Комментарии ({data.comments.length})
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
          {data.comments.map((c: any) => (
            <div key={c.id} className="bg-slate-800/60 rounded px-3 py-2">
              <div className="text-[11px] text-[#c5a059]">
                {c.userName ?? "—"} · {new Date(c.createdAt).toLocaleString("ru-RU")}
              </div>
              <div className="text-sm mt-0.5 whitespace-pre-wrap">{c.text}</div>
            </div>
          ))}
          {data.comments.length === 0 && (
            <div className="text-slate-500 text-sm">Комментариев нет</div>
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={props.commentText}
            onChange={(e: any) => props.setCommentText(e.target.value)}
            placeholder="Комментарий…"
            className="bg-slate-800 border-slate-700 text-sm min-h-16"
          />
          <Button size="sm" onClick={props.onAddComment} className="bg-slate-700 hover:bg-slate-600 self-end">
            Отправить
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={props.onEdit} className="bg-[#991b1b] hover:bg-[#b91c1c] text-white">
          Редактировать
        </Button>
        {(isManager || true) && (
          <Button variant="outline" onClick={props.onDelete} className="border-red-900 text-red-400 hover:bg-red-950/40">
            <Trash2 size={14} className="mr-1" /> Удалить
          </Button>
        )}
      </div>
    </>
  );
}

// ── Панель смарт-контракта в карточке задачи ────────────────

function ContractPanel({ task, contract, onAct, meId, isManager }: any) {
  const state = (task.contractState ?? "draft") as keyof typeof ContractStates;
  const isCreator = task.creatorId === meId || isManager;
  const isAssignee = task.assigneeId === meId;

  // доступные действия по машине состояний
  const actions: { key: string; label: string; show: boolean; danger?: boolean }[] = [
    { key: "fund", label: "Заблокировать средства", show: state === "draft" && isCreator },
    { key: "start", label: "Взять в работу", show: state === "funded" && isAssignee },
    { key: "submit", label: "Сдать результат", show: state === "in_work" && isAssignee },
    { key: "approve", label: "Принять и рассчитать", show: (state === "submitted" || state === "disputed") && isCreator },
    { key: "dispute", label: "Открыть спор", show: state === "submitted" && isCreator, danger: true },
    { key: "resolve", label: "Разрешить спор (руководство)", show: state === "disputed" && isManager },
    { key: "cancel", label: "Отменить контракт", show: (state === "draft" || state === "funded") && isCreator, danger: true },
  ];

  const stateColor =
    state === "completed" ? "text-emerald-400" :
    state === "disputed" ? "text-red-400" :
    state === "cancelled" ? "text-slate-500" : "text-[#c5a059]";

  return (
    <div className="border border-[#c5a059]/30 bg-[#c5a059]/5 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <FileContract size={15} className="text-[#c5a059]" />
          <span className="text-slate-300">Смарт-контракт:</span>
          <span className={`font-semibold ${stateColor}`}>{ContractStates[state]}</span>
        </div>
        {task.reward && (
          <span className="text-sm text-[#c5a059] font-semibold">{task.reward}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {actions.filter((a) => a.show).map((a) => (
          <button
            key={a.key}
            onClick={() => onAct(a.key)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              a.danger
                ? "bg-red-900/40 border border-red-800 text-red-300 hover:bg-red-900/60"
                : "bg-[#c5a059] text-[#0f172a] font-medium hover:bg-[#d4af37]"
            }`}
          >
            {a.label}
          </button>
        ))}
        {actions.every((a) => !a.show) && (
          <span className="text-xs text-slate-500">Нет доступных вам действий в текущем состоянии</span>
        )}
      </div>

      {contract && (
        <div>
          <div className="flex items-center gap-2 text-xs mb-2">
            {contract.intact ? (
              <>
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-emerald-400">Цепочка событий цела</span>
              </>
            ) : (
              <>
                <ShieldAlert size={14} className="text-red-400" />
                <span className="text-red-400">Цепочка событий повреждена!</span>
              </>
            )}
            <span className="text-slate-600 font-mono truncate max-w-40" title={contract.headHash}>
              {contract.headHash.slice(0, 12)}…
            </span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {contract.events.map((e: any) => (
              <div key={e.id} className="flex items-start gap-2 text-xs">
                <span className="text-slate-600 font-mono shrink-0">#{e.seq}</span>
                <div className="min-w-0">
                  <span className="text-slate-300">
                    {ContractActions[e.action as keyof typeof ContractActions] ?? e.action}
                  </span>
                  <span className="text-slate-500"> · {e.actorName ?? "—"} · {new Date(e.createdAt).toLocaleString("ru-RU")}</span>
                  <div className="text-slate-600 font-mono truncate" title={e.hash}>{e.hash.slice(0, 16)}…</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskForm({ open, onOpenChange, initial, projects, employees, isManager, saving, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [isContract, setIsContract] = useState(false);
  const [reward, setReward] = useState("");

  // sync on open
  const [synced, setSynced] = useState(false);
  if (open && !synced) {
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setProjectId(initial?.projectId ? String(initial.projectId) : "none");
    setPriority(initial?.priority ?? "medium");
    setAssigneeId(initial?.assigneeId ? String(initial.assigneeId) : "none");
    setDueDate(initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 10) : "");
    setTags(initial?.tags ?? "");
    setIsContract(!!initial?.isContract);
    setReward(initial?.reward ?? "");
    setSynced(true);
  }
  if (!open && synced) setSynced(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initial ? "Редактировать задачу" : "Новая задача"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
            placeholder="Название задачи *"
            className="bg-slate-800 border-slate-700"
          />
          <Textarea
            value={description}
            onChange={(e: any) => setDescription(e.target.value)}
            placeholder="Описание"
            className="bg-slate-800 border-slate-700 min-h-24"
          />
          {isManager && (
            <>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без проекта</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Исполнитель" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">На себя</SelectItem>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name ?? e.email ?? `#${e.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Приоритет" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TaskPriorities) as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {TaskPriorities[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e: any) => setDueDate(e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <Input
            value={tags}
            onChange={(e: any) => setTags(e.target.value)}
            placeholder="Теги (через запятую)"
            className="bg-slate-800 border-slate-700"
          />
          {/* Смарт-контракт */}
          <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
            isContract ? "border-[#c5a059]/50 bg-[#c5a059]/5" : "border-slate-700 hover:border-slate-500"
          }`}>
            <input
              type="checkbox"
              checked={isContract}
              disabled={!!initial?.isContract}
              onChange={(e) => setIsContract(e.target.checked)}
              className="mt-1 accent-[#c5a059]"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm text-white">
                <FileContract size={14} className="text-[#c5a059]" />
                Смарт-контракт
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Условия фиксируются, средства блокируются, каждое действие — в неизменяемой
                хэш-цепочке. Расчёт — только после приёмки результата.
                {!!initial?.isContract && " Отключить нельзя — только отменой контракта."}
              </span>
            </span>
          </label>
          {isContract && (
            <Input
              value={reward}
              onChange={(e: any) => setReward(e.target.value)}
              placeholder="Вознаграждение, напр. 150 000 ₽"
              className="bg-slate-800 border-slate-700 border-[#c5a059]/40"
            />
          )}
          <Button
            disabled={!title.trim() || saving}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description || undefined,
                projectId: projectId === "none" ? null : Number(projectId),
                priority,
                assigneeId: assigneeId === "none" ? null : Number(assigneeId),
                dueDate: dueDate ? new Date(dueDate) : null,
                tags: tags || undefined,
                isContract,
                reward: isContract ? (reward || null) : null,
              })
            }
            className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
