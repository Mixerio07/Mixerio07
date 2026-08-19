import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/portal");
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ login: login.trim(), password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <Card className="w-full max-w-sm bg-[#1e293b] border-slate-700">
        <CardHeader className="text-center">
          <div className="font-serif text-2xl tracking-widest text-white font-semibold mb-1">
            КОНТЭК
          </div>
          <div className="text-[10px] tracking-[3px] uppercase text-[#c5a059] mb-3">
            Корпоративный портал
          </div>
          <CardTitle className="text-slate-200 text-base font-normal">
            Вход для сотрудников
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Логин"
              autoComplete="username"
              className="bg-slate-800 border-slate-600 text-white"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              className="bg-slate-800 border-slate-600 text-white"
            />
            {error && <div className="text-sm text-red-400">{error}</div>}
            <Button
              type="submit"
              disabled={!login.trim() || !password || loginMutation.isPending}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white"
              size="lg"
            >
              {loginMutation.isPending ? "Вход…" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
