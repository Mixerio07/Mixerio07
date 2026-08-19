import { useRef, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, Download, Trash2, FileText, Lock, Globe2 } from "lucide-react";

function fmtSize(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

export default function Documents() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";
  const [scope, setScope] = useState<"shared" | "mine" | "user">("shared");
  const [userId, setUserId] = useState<string>("none");
  const utils = trpc.useUtils();

  const { data: docs, isLoading } = trpc.documents.list.useQuery({
    scope,
    userId: scope === "user" && userId !== "none" ? Number(userId) : undefined,
  });
  const { data: employees } = trpc.users.list.useQuery(undefined, {
    enabled: isManager,
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<"shared" | "mine">("mine");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = trpc.documents.upload.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      setOpen(false);
      setTitle("");
      setFile(null);
    },
    onError: (e) => alert(e.message),
  });

  const remove = trpc.documents.remove.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });

  const download = async (id: number) => {
    const d = await utils.documents.download.fetch({ id });
    const bin = atob(d.dataBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: d.mimeType });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = d.fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doUpload = () => {
    if (!file || !title.trim()) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      upload.mutate({
        title: title.trim(),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64: base64,
        ownerId: target === "shared" ? null : (user?.id ?? null),
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <PortalLayout title="Документы">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex bg-slate-800 rounded-md overflow-hidden">
          <button
            onClick={() => setScope("shared")}
            className={`px-4 py-2 text-xs flex items-center gap-1.5 ${scope === "shared" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            <Globe2 size={14} /> Общая база
          </button>
          <button
            onClick={() => setScope("mine")}
            className={`px-4 py-2 text-xs flex items-center gap-1.5 ${scope === "mine" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            <Lock size={14} /> Мои документы
          </button>
          {isManager && (
            <button
              onClick={() => setScope("user")}
              className={`px-4 py-2 text-xs ${scope === "user" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              По сотруднику
            </button>
          )}
        </div>
        {scope === "user" && (
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-56 bg-slate-800 border-slate-700 text-sm">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Выберите сотрудника…</SelectItem>
              {(employees ?? []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name ?? e.email ?? `#${e.id}`} (ID {e.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          onClick={() => setOpen(true)}
          className="bg-[#991b1b] hover:bg-[#b91c1c] text-white ml-auto"
        >
          <Upload size={16} className="mr-1" /> Загрузить документ
        </Button>
      </div>

      {isLoading && <div className="text-slate-500">Загрузка…</div>}

      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
              <th className="p-3">Документ</th>
              <th className="p-3">Файл</th>
              <th className="p-3">Размер</th>
              <th className="p-3">Загрузил</th>
              <th className="p-3">Дата</th>
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => (
              <tr key={d.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                <td className="p-3">
                  <div className="flex items-center gap-2 text-white">
                    <FileText size={15} className="text-[#c5a059] shrink-0" />
                    {d.title}
                  </div>
                  {d.description && (
                    <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>
                  )}
                </td>
                <td className="p-3 text-slate-400">{d.fileName}</td>
                <td className="p-3 text-slate-400">{fmtSize(d.size)}</td>
                <td className="p-3 text-slate-400">{d.creatorName ?? "—"}</td>
                <td className="p-3 text-slate-500">
                  {new Date(d.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => download(d.id)}
                      className="p-1.5 text-slate-400 hover:text-[#c5a059]"
                      title="Скачать"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Удалить «${d.title}»?`)) remove.mutate({ id: d.id });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (docs ?? []).length === 0 && (
          <div className="p-10 text-center text-slate-500 text-sm">
            {scope === "user" && userId === "none"
              ? "Выберите сотрудника, чтобы увидеть его документы"
              : "Документов нет"}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white">Загрузить документ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e: any) => setTitle(e.target.value)}
              placeholder="Название документа *"
              className="bg-slate-800 border-slate-700"
            />
            {isManager && (
              <Select value={target} onValueChange={(v: any) => setTarget(v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">В мою личную папку</SelectItem>
                  <SelectItem value="shared">В общую базу (видят все)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {!isManager && (
              <div className="text-xs text-slate-500">
                Документ попадёт в вашу личную папку (увидите вы и руководство).
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-slate-600 rounded-md p-6 text-sm text-slate-400 hover:border-[#c5a059] hover:text-slate-200 transition-colors"
            >
              {file ? file.name : "Нажмите, чтобы выбрать файл (до 5 МБ)"}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              disabled={!file || !title.trim() || upload.isPending}
              onClick={doUpload}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
            >
              {upload.isPending ? "Загрузка…" : "Загрузить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
