import { useState } from "react";
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
import { Plus, KeyRound } from "lucide-react";

export default function Users() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.listFull.useQuery();
  const setRoleMutation = trpc.users.setRole.useMutation({
    onSuccess: () => utils.users.listFull.invalidate(),
    onError: (e) => alert(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRoleValue] = useState<"user" | "manager" | "admin">("user");

  const [resetFor, setResetFor] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const createUser = trpc.users.createUser.useMutation({
    onSuccess: () => {
      utils.users.listFull.invalidate();
      setCreateOpen(false);
      setLogin(""); setPassword(""); setName(""); setPosition(""); setRoleValue("user");
    },
    onError: (e) => alert(e.message),
  });

  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      setResetFor(null);
      setNewPassword("");
      alert("Пароль обновлён");
    },
    onError: (e) => alert(e.message),
  });

  if (me?.role !== "admin") {
    return (
      <PortalLayout title="Сотрудники">
        <div className="text-slate-400">Раздел доступен только администратору.</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Сотрудники и группы доступа">
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#991b1b] hover:bg-[#b91c1c] text-white"
        >
          <Plus size={16} className="mr-1" /> Добавить сотрудника
        </Button>
      </div>
      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
              <th className="p-3">ID</th>
              <th className="p-3">Сотрудник</th>
              <th className="p-3">Логин</th>
              <th className="p-3">Должность</th>
              <th className="p-3">Группа доступа</th>
              <th className="p-3">Последний вход</th>
              <th className="p-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-slate-800 last:border-0">
                <td className="p-3 text-slate-500">{u.id}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#991b1b] flex items-center justify-center text-white text-xs">
                        {(u.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-white">{u.name ?? "Без имени"}</span>
                    {u.id === me?.id && (
                      <span className="text-[10px] text-[#c5a059]">(вы)</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-slate-400">{u.login ?? "—"}</td>
                <td className="p-3 text-slate-400">{u.position ?? "—"}</td>
                <td className="p-3">
                  <Select
                    value={u.role}
                    disabled={u.id === me?.id || setRoleMutation.isPending}
                    onValueChange={(v: any) => setRoleMutation.mutate({ userId: u.id, role: v })}
                  >
                    <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Сотрудник</SelectItem>
                      <SelectItem value="manager">Руководитель</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-slate-500">
                  {new Date(u.lastSignInAt).toLocaleString("ru-RU")}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => setResetFor(u)}
                    className="p-1.5 text-slate-400 hover:text-[#c5a059]"
                    title="Сбросить пароль"
                  >
                    <KeyRound size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (users ?? []).length === 0 && (
          <div className="p-10 text-center text-slate-500 text-sm">
            Пользователей нет. Сотрудники появятся здесь после первого входа на портал.
          </div>
        )}
      </div>
      <div className="mt-4 text-xs text-slate-500 leading-relaxed">
        <b className="text-slate-400">Сотрудник</b> — свои задачи, личные документы, общая база документов.
        <br />
        <b className="text-slate-400">Руководитель</b> — все задачи, назначение исполнителей, проекты,
        документы сотрудников.
        <br />
        <b className="text-slate-400">Администратор</b> — всё вышеперечисленное + управление ролями и журнал
        действий.
      </div>

      {/* Создание сотрудника */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white">Новый сотрудник</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="ФИО *" className="bg-slate-800 border-slate-700" />
            <Input value={position} onChange={(e: any) => setPosition(e.target.value)} placeholder="Должность" className="bg-slate-800 border-slate-700" />
            <Input value={login} onChange={(e: any) => setLogin(e.target.value)} placeholder="Логин (латиница) *" className="bg-slate-800 border-slate-700" />
            <Input type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Пароль (мин. 8 символов) *" className="bg-slate-800 border-slate-700" />
            <Select value={role} onValueChange={(v: any) => setRoleValue(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Сотрудник</SelectItem>
                <SelectItem value="manager">Руководитель</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={!name.trim() || login.trim().length < 3 || password.length < 8 || createUser.isPending}
              onClick={() => createUser.mutate({ login: login.trim(), password, name: name.trim(), position: position || undefined, role })}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
            >
              {createUser.isPending ? "Создание…" : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Сброс пароля */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent className="bg-[#1e293b] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white">
              Новый пароль: {resetFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="password" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} placeholder="Новый пароль (мин. 8 символов)" className="bg-slate-800 border-slate-700" />
            <Button
              disabled={newPassword.length < 8 || resetPassword.isPending}
              onClick={() => resetPassword.mutate({ userId: resetFor.id, newPassword })}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
            >
              Установить пароль
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
