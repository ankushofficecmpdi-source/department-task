import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, AlertTriangle, Ban, Mail, RefreshCw, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeptChip, Overline, PriorityBadge } from "@/components/TaskBits";
import { apiPost, apiPut } from "@/lib/api";
import { DEPT_META, errorMessage, timeAgo } from "@/lib/format";
import { invalidateWork, useDigestEmailStatus, useDigests, useMe, useTaskDialogs } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Digest, DigestEmailResult, DigestEmailSettings, DigestEmailStatus, DigestItem } from "@/lib/types";

function Section({ title, icon: Icon, tone, items, testId, onOpen }: {
  title: string; icon: typeof Ban; tone: string; items: DigestItem[]; testId: string; onOpen: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#111827]" data-testid={testId}>
      <header className="flex items-center gap-2 border-b border-[#1E293B] px-4 py-3">
        <Icon className={cn("size-4", tone)} />
        <h3 className="font-heading text-sm font-bold text-white">{title}</h3>
        <span className="ml-auto rounded-sm bg-[#1E293B] px-1.5 font-mono text-[11px] text-slate-300" data-testid={`${testId}-count`}>{items.length}</span>
      </header>
      <ul className="divide-y divide-[#1E293B]/70">
        {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nothing here.</li>}
        {items.map((it) => (
          <li key={it.task_id}>
            <button
              type="button"
              onClick={() => onOpen(it.task_id)}
              data-testid={`${testId}-item-${it.task_id}`}
              className="w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-[#1E293B]/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={it.priority} />
                <DeptChip department={it.department} />
                <span className="font-mono text-[10px] text-slate-500">due {it.due_date} · {it.progress}%</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-100">{it.title}</p>
              <p className="text-xs text-slate-400">{it.assignee_name}</p>
              {it.note && <p className="mt-1 text-xs italic text-[#FDA4AF]">“{it.note}”</p>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmailCard({ date }: { date: string | undefined }) {
  const status = useDigestEmailStatus(true);
  const s = status.isError ? undefined : status.data;
  const toggle = useMutation({
    mutationFn: (body: DigestEmailSettings) => apiPut<DigestEmailStatus>("/digests/email/settings", body),
    onSuccess: (r) => {
      invalidateWork();
      toast.success(r.enabled ? "Morning email turned on" : "Morning email turned off");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const send = useMutation({
    mutationFn: () => apiPost<DigestEmailResult>(`/digests/${date}/email`),
    onSuccess: (r) => {
      invalidateWork();
      if (r.sent) toast.success(`Digest emailed to ${r.recipient}`);
      else toast.error(r.error ?? "Could not send the email");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-3" data-testid="digest-email-card">
      <Mail className={cn("size-4", s?.connected && s.enabled ? "text-[#34D399]" : "text-slate-500")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Email me the digest every morning</p>
        <p className="text-xs text-slate-400" data-testid="digest-email-status">
          {!s
            ? "Checking…"
            : !s.connected
              ? "Gmail is not connected yet"
              : !s.enabled
                ? "Off — the digest stays in the app only"
                : `On · sent from and to your Gmail${s.recipient ? ` (${s.recipient})` : ""}${s.last_sent_at ? ` · last sent ${timeAgo(s.last_sent_at)}` : ""}`}
        </p>
        {s?.last_error && s.connected && <p className="text-[11px] text-[#FDA4AF]">{s.last_error}</p>}
      </div>
      {s?.connected && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={s.enabled}
            aria-label="Toggle morning email"
            onClick={() => toggle.mutate({ enabled: !s.enabled })}
            data-testid="digest-email-toggle"
            className={cn("relative h-5 w-9 rounded-full transition-colors duration-150", s.enabled ? "bg-[#4F46E5]" : "bg-[#334155]")}
          >
            <span className={cn("absolute left-0 top-0.5 size-4 rounded-full bg-white transition-transform duration-150", s.enabled ? "translate-x-[18px]" : "translate-x-0.5")} />
          </button>
          <Button size="sm" variant="outline" disabled={!date || send.isPending} onClick={() => send.mutate()} data-testid="digest-email-send-button">
            <Mail className="size-3.5" /> {send.isPending ? "Sending…" : "Email this digest now"}
          </Button>
        </>
      )}
    </div>
  );
}

export default function DigestPage() {
  const me = useMe();
  const isManager = me.data?.role === "manager";
  const digests = useDigests(isManager);
  const { openTask } = useTaskDialogs();
  const [selected, setSelected] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => apiPost<Digest>("/digests/run"),
    onSuccess: (d) => {
      queryClient.setQueryData<Digest[]>(["digests"], (old) => [d, ...(old ?? []).filter((x) => x.date !== d.date)]);
      invalidateWork();
      setSelected(d.date);
      toast.success("Digest refreshed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (me.data && !isManager) return <Navigate to="/" replace />;
  const list = digests.isError ? [] : (digests.data ?? []);
  const d = list.find((x) => x.date === selected) ?? list[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Overline>Every morning · 8:00 AM India time</Overline>
          <h2 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-white">
            <Sunrise className="size-6 text-[#FBBF24]" /> Daily digest
          </h2>
          <p className="mt-1 text-sm text-slate-400">Overdue, due-today and blocked work across every department.</p>
        </div>
        <Button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          data-testid="digest-generate-button"
          className="bg-[#4F46E5] text-white transition-[background-color,transform] hover:bg-[#4338CA] active:scale-[0.98]"
        >
          <RefreshCw className={cn("size-4", run.isPending && "animate-spin")} /> {run.isPending ? "Building…" : "Refresh now"}
        </Button>
      </div>

      <EmailCard date={d?.date} />

      {list.length > 1 && (
        <div className="flex flex-wrap gap-1.5" data-testid="digest-history">
          {list.map((x) => (
            <button
              key={x.date}
              type="button"
              onClick={() => setSelected(x.date)}
              data-testid={`digest-date-${x.date}`}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                x.date === d?.date ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-[#1E293B] text-slate-400 hover:text-white",
              )}
            >
              {x.date}
            </button>
          ))}
        </div>
      )}

      {digests.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!digests.isLoading && !d && (
        <div className="rounded-lg border border-dashed border-[#1E293B] p-10 text-center" data-testid="digest-empty">
          <p className="text-sm text-slate-400">No digest yet. The first one arrives tomorrow at 8:00 AM, or build it now.</p>
        </div>
      )}

      {d && (
        <>
          <p className="font-mono text-[11px] text-slate-500" data-testid="digest-meta">
            {d.date} · {d.trigger === "schedule" ? "scheduled" : "refreshed manually"} at {new Date(d.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="digest-departments">
            {d.by_department.map((b) => (
              <div key={b.department} className="rounded-lg border border-[#1E293B] bg-[#111827] p-3" style={{ boxShadow: `inset 3px 0 0 ${DEPT_META[b.department].hex}` }}>
                <p className="text-sm font-semibold text-white">{b.department}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  <span className={b.overdue ? "text-[#FDA4AF]" : ""}>{b.overdue} overdue</span> · <span className={b.due_today ? "text-[#FDE68A]" : ""}>{b.due_today} today</span> · <span className={b.blocked ? "text-[#FDA4AF]" : ""}>{b.blocked} blocked</span>
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Section title="Overdue" icon={AlertTriangle} tone="text-[#FB7185]" items={d.overdue} testId="digest-overdue" onOpen={openTask} />
            <Section title="Due today" icon={AlarmClock} tone="text-[#FBBF24]" items={d.due_today} testId="digest-due-today" onOpen={openTask} />
            <Section title="Blocked" icon={Ban} tone="text-[#FB7185]" items={d.blocked} testId="digest-blocked" onOpen={openTask} />
          </div>
        </>
      )}
    </div>
  );
}
