import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { Roles } from "@contracts/constants";
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  FileText,
  Users,
  ScrollText,
  LogOut,
  Globe,
} from "lucide-react";

const menu = [
  { path: "/portal", label: "Дашборд", icon: LayoutDashboard },
  { path: "/portal/tasks", label: "Задачи", icon: ListTodo },
  { path: "/portal/projects", label: "Проекты", icon: FolderKanban },
  { path: "/portal/documents", label: "Документы", icon: FileText },
];

const adminMenu = [
  { path: "/portal/site", label: "Управление сайтом", icon: Globe },
  { path: "/portal/users", label: "Сотрудники", icon: Users },
  { path: "/portal/logs", label: "Журнал действий", icon: ScrollText },
];

export default function PortalLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }
  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-[#1e293b] border-r border-slate-700/50 flex flex-col min-h-screen">
        <div className="p-5 border-b border-slate-700/50">
          <div className="font-serif text-xl tracking-widest text-white font-semibold">КОНТЭК</div>
          <div className="text-[10px] tracking-[3px] uppercase text-[#c5a059] mt-1">Корпоративный портал</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menu.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-[#991b1b] text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-widest text-slate-500">
                Администрирование
              </div>
              {adminMenu.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-[#991b1b] text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-700/50"
          >
            <Globe size={16} />
            Публичный сайт
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-700/50"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-[#1e293b]/60 border-b border-slate-700/50 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-white">{user.name || "Без имени"}</div>
              <div className="text-xs text-[#c5a059]">
                {Roles[user.role as keyof typeof Roles] ?? user.role}
                {user.position ? ` · ${user.position}` : ""}
              </div>
            </div>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#991b1b] flex items-center justify-center text-white text-sm font-semibold">
                {(user.name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
