import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, Flame, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { beginSession } from "@/lib/session";
import type { LoginRequest, UserPublic } from "@/lib/types";

const DEMO = [
  { label: "Manager · Sarah", email: "sarah@taskpulse.io", password: "manager123", icon: ShieldCheck, id: "manager" },
  { label: "Member · Alex", email: "alex@taskpulse.io", password: "member123", icon: Users, id: "alex" },
  { label: "Member · Maya", email: "maya@taskpulse.io", password: "member123", icon: Users, id: "maya" },
];

const PREVIEW_ROWS = [
  { t: "Migrate payment gateway", who: "AR", p: 75, c: "#E11D48", tag: "CRITICAL" },
  { t: "Design token audit", who: "MP", p: 60, c: "#EA580C", tag: "HIGH" },
  { t: "Load test notifications", who: "ER", p: 35, c: "#EA580C", tag: "HIGH" },
  { t: "Mobile nav redesign", who: "MP", p: 85, c: "#D97706", tag: "MEDIUM" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: (body: LoginRequest) => apiPost<UserPublic>("/auth/login", body),
    onSuccess: () => {
      beginSession();
      navigate("/", { replace: true });
    },
  });

  return (
    <div className="grid min-h-screen bg-[#0B0F17] text-slate-100 lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-[#1E293B] bg-[#070A10] p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(#1E293B33_1px,transparent_1px),linear-gradient(90deg,#1E293B33_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="relative flex items-center gap-2.5">
          <span className="relative flex size-9 items-center justify-center rounded-md bg-[#4F46E5]">
            <span className="absolute size-3.5 rounded-full border-2 border-white" />
            <span className="absolute size-1 rounded-full bg-white" />
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">TaskPulse</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#818CF8]">Team work oversight</p>
          <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-5xl">
            Know who's on what,
            <br />
            and what's slipping.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
            Assign work, watch progress move in real time, and get alerted the moment priority tasks go overdue.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative mt-10 max-w-lg rounded-xl border border-[#1E293B] bg-[#0B0F17]/90 p-4 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Live priority queue</span>
            <span className="flex items-center gap-1.5 rounded-sm bg-[#2A1215] px-1.5 py-0.5 font-mono text-[10px] text-[#FECDD3]">
              <Flame className="size-3" /> 2 overdue
            </span>
          </div>
          <ul className="space-y-2.5">
            {PREVIEW_ROWS.map((r, i) => (
              <motion.li
                key={r.t}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 rounded-md border border-[#1E293B] bg-[#111827] px-3 py-2"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: r.c }} />
                <span className="flex-1 truncate text-sm text-slate-200">{r.t}</span>
                <span className="font-mono text-[9px] text-slate-500">{r.tag}</span>
                <span className="h-1 w-16 overflow-hidden rounded-full bg-[#1E293B]">
                  <span className="block h-full bg-[#6366F1]" style={{ width: `${r.p}%` }} />
                </span>
                <span className="flex size-6 items-center justify-center rounded-full bg-[#1E293B] font-heading text-[9px] font-bold">{r.who}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sign in</p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-400">Managers oversee the whole team; members see and update their own work.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ email, password });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="h-10 bg-[#111827]"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="h-10 bg-[#111827]"
              />
            </div>
            {login.isError && (
              <p className="text-sm text-[#F87171]" data-testid="login-error">
                {errorMessage(login.error, "Unable to sign in")}
              </p>
            )}
            <Button
              type="submit"
              disabled={login.isPending || !email || !password}
              data-testid="login-submit-button"
              className="h-10 w-full bg-[#4F46E5] text-white transition-[background-color,transform] duration-150 hover:bg-[#4338CA] active:scale-[0.98]"
            >
              {login.isPending ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Demo accounts</p>
            <div className="mt-3 grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  data-testid={`demo-login-${d.id}`}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="flex items-center gap-3 rounded-md border border-[#1E293B] bg-[#111827] px-3 py-2.5 text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#334155]"
                >
                  <d.icon className="size-4 text-[#818CF8]" />
                  <span className="flex-1 text-sm text-slate-200">{d.label}</span>
                  <span className="font-mono text-[10px] text-slate-500">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
