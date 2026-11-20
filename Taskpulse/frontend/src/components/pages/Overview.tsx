import { useState } from "react";
import { motion } from "motion/react";
import { AlarmClock, AlertTriangle, Flame, Layers, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, DepartmentFilter, DeptChip, DueBadge, Overline, PriorityBadge, ProgressBar, StatusBadge } from "@/components/TaskBits";
import { STATUSES, STATUS_META, localToday, timeAgo } from "@/lib/format";
import { useActivity, useDashboard, useDeptParam, useMe, useTaskDialogs } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type AlertTab = "overdue" | "due_soon" | "critical";

const STAT_TONES = {
  neutral: "border-[#1E293B] bg-[#111827]",
  critical: "border-[#E11D48]/40 bg-[#2A1215]",
  warning: "border-[#D97706]/40 bg-[#261A05]",
  success: "border-[#059669]/40 bg-[#062319]",
};

function Stat({ id, label, value, hint, icon: Icon, tone, i }: {
  id: string; label: string; value: string; hint: string; icon: typeof Layers; tone: keyof typeof STAT_TONES; i: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className={cn("rounded-lg border p-4 transition-transform duration-200 hover:-translate-y-0.5", STAT_TONES[tone])}
      data-testid={`stat-${id}`}
    >
      <div className="flex items-center justify-between">
        <Overline className="text-[10px]">{label}</Overline>
        <Icon className="size-4 text-slate-400" />
      </div>
      <p className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-white" data-testid={`stat-${id}-value`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </motion.div>
  );
}

function AlertRow({ task, today, onOpen }: { task: Task; today: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`priority-alert-item-${task.id}`}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[#1E293B]/70 px-4 py-3 text-left transition-colors duration-150 last:border-0 hover:bg-[#1E293B]/40 sm:grid-cols-[minmax(0,1fr)_150px_110px]"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <DeptChip department={task.department} />
          <span className="truncate text-sm font-medium text-slate-100">{task.title}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
          <Avatar id={task.assignee_id} name={task.assignee_name} size="xs" />
          {task.assignee_name}
          <span className="text-slate-600">·</span>
          <StatusBadge status={task.status} />
        </span>
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        <ProgressBar value={task.progress} />
        <span className="w-9 text-right font-mono text-[11px] text-slate-400">{task.progress}%</span>
      </span>
      <span className="justify-self-end">
        <DueBadge task={task} today={today} />
      </span>
    </button>
  );
}

export default function Overview() {
  const me = useMe();
  const [dept, setDept] = useDeptParam();
  const dash = useDashboard(dept);
  const activity = useActivity();
  const { openTask } = useTaskDialogs();
  const [tab, setTab] = useState<AlertTab>("overdue");
  const isManager = me.data?.role === "manager";
  const d = dash.isError ? undefined : dash.data;
  const today = d?.today ?? localToday();

  const alerts: Record<AlertTab, Task[]> = {
    overdue: d?.alerts_overdue ?? [],
    due_soon: d?.alerts_due_soon ?? [],
    critical: d?.alerts_critical ?? [],
  };
  const tabs: { id: AlertTab; label: string; icon: typeof Flame; tone: string }[] = [
    { id: "overdue", label: "Overdue", icon: AlertTriangle, tone: "bg-[#E11D48]" },
    { id: "due_soon", label: "Due soon", icon: AlarmClock, tone: "bg-[#D97706]" },
    { id: "critical", label: "Critical", icon: Flame, tone: "bg-[#E11D48]" },
  ];
  const statusData = STATUSES.map((s) => ({ name: STATUS_META[s].label, value: d?.[s] ?? 0, color: STATUS_META[s].hex }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Overline>{isManager ? "Team command center" : "My work"}</Overline>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white md:text-3xl" data-testid="overview-greeting">
            {me.data ? `Hi ${me.data.name.split(" ")[0]}, here's where things stand` : "Overview"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[11px] text-slate-500" data-testid="overview-today">
            TODAY · {today} · auto-refresh 30s
          </p>
          <DepartmentFilter value={dept} onChange={setDept} testId="overview-department-filter" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={0} id="total-tasks" label={isManager ? "Assigned tasks" : "My tasks"} value={String(d?.total ?? "—")}
          hint={`${d?.done ?? 0} done · ${(d?.total ?? 0) - (d?.done ?? 0)} open`} icon={Layers} tone="neutral" />
        <Stat i={1} id="critical-high" label="Critical & high" value={String(d?.critical_high ?? "—")}
          hint={`${alerts.critical.length} critical open · ${d?.blocked ?? 0} blocked`} icon={Flame} tone="critical" />
        <Stat i={2} id="due-alerts" label="Overdue & due soon" value={String((d?.overdue ?? 0) + (d?.due_soon ?? 0))}
          hint={`${d?.overdue ?? 0} overdue · ${d?.due_soon ?? 0} due ≤ tomorrow`} icon={AlertTriangle} tone="warning" />
        <Stat i={3} id="avg-progress" label="Avg progress" value={d ? `${d.avg_progress}%` : "—"}
          hint={`${d?.completion_rate ?? 0}% completion rate`} icon={TrendingUp} tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#111827]" data-testid="priority-alerts-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] px-4 py-3">
            <div>
              <h3 className="font-heading text-base font-bold text-white">Priority action center</h3>
              <p className="text-xs text-slate-400">Work that needs attention right now</p>
            </div>
            <div className="flex gap-1 rounded-md border border-[#1E293B] bg-[#0B0F17] p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  data-testid={`priority-tab-${t.id}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                    tab === t.id ? "bg-[#1E293B] text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                  <span className={cn("rounded-sm px-1 font-mono text-[10px] text-white", alerts[t.id].length ? t.tone : "bg-[#334155]")}>
                    {alerts[t.id].length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto" data-testid={`priority-list-${tab}`}>
            {alerts[tab].length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {dash.isLoading ? "Loading…" : "Nothing here — nice work."}
              </p>
            ) : (
              alerts[tab].map((t) => <AlertRow key={t.id} task={t} today={today} onOpen={() => openTask(t.id)} />)
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#1E293B] bg-[#111827] p-4" data-testid="status-distribution-chart">
          <h3 className="font-heading text-base font-bold text-white">Status distribution</h3>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                    {statusData.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0B0F17", border: "1px solid #1E293B", borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2.5">
              {statusData.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-slate-300">{s.name}</span>
                  <span className="font-mono text-slate-100">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-[#1E293B] bg-[#111827] p-4" data-testid="workload-chart">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-white">{isManager ? "Team workload" : "My workload"}</h3>
            <Overline className="text-[10px]">Active · Completed · Overdue</Overline>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(d?.workload ?? []).map((w) => ({ ...w, name: w.name.split(" ")[0] }))} barGap={2}>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#64748B" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: "#1E293B55" }} contentStyle={{ background: "#0B0F17", border: "1px solid #1E293B", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="active" name="Active" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overdue" name="Overdue" fill="#E11D48" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-[#1E293B] bg-[#111827] p-4" data-testid="recent-activity-panel">
          <h3 className="font-heading text-base font-bold text-white">Latest updates</h3>
          <ul className="mt-3 space-y-3">
            {(activity.isError ? [] : (activity.data ?? [])).slice(0, 6).map((a) => (
              <li key={a.id} className="flex gap-3">
                <Avatar id={a.actor_id} name={a.actor_name} size="xs" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!a.task_id}
                    onClick={() => a.task_id && openTask(a.task_id)}
                    className="line-clamp-2 text-left text-sm text-slate-300 transition-colors hover:text-white"
                    data-testid={`recent-activity-${a.id}`}
                  >
                    <span className="font-semibold text-slate-100">{a.actor_name}</span> {a.message}
                  </button>
                  <p className="font-mono text-[10px] text-slate-500">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
            {!activity.data?.length && <li className="text-sm text-slate-500">No activity yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
