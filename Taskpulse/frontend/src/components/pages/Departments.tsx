import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Ban, Flame } from "lucide-react";
import { Overline, ProgressBar } from "@/components/TaskBits";
import { DEPT_META } from "@/lib/format";
import { useDashboard, useMe } from "@/lib/hooks";

export default function Departments() {
  const me = useMe();
  const dash = useDashboard();
  const isManager = me.data?.role === "manager";
  const deps = dash.isError ? [] : (dash.data?.departments ?? []);

  return (
    <div className="space-y-6">
      <div>
        <Overline>Mine sections</Overline>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Departments</h2>
        <p className="mt-1 text-sm text-slate-400">
          {isManager ? "Workload, risk and progress for each department." : "Your work, by department."}
        </p>
      </div>
      {dash.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {deps.map((d, i) => {
          const meta = DEPT_META[d.department];
          const slug = d.department.toLowerCase().replace(/\s+/g, "-");
          const rate = d.total ? Math.round((d.done * 100) / d.total) : 0;
          return (
            <motion.section
              key={d.department}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative overflow-hidden rounded-lg border border-[#1E293B] bg-[#111827] p-5"
              data-testid={`department-card-${slug}`}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.hex }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg font-bold text-white">{d.department}</h3>
                  <p className="mt-0.5 text-xs text-slate-400" data-testid={`department-members-${slug}`}>
                    {d.members.length ? d.members.join(" · ") : "No members yet"}
                  </p>
                </div>
                <Link
                  to={`/board?dept=${encodeURIComponent(d.department)}`}
                  data-testid={`department-view-board-${slug}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#1E293B] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-[#334155] hover:text-white"
                >
                  View board <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="font-heading text-3xl font-extrabold text-white" data-testid={`department-open-${slug}`}>{d.open}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Open tasks</p>
                </div>
                <div>
                  <p className="font-heading text-3xl font-extrabold text-[#34D399]">{d.done}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Completed</p>
                </div>
                <div>
                  <p className="font-heading text-3xl font-extrabold text-white">{d.avg_progress}%</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Avg progress</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <ProgressBar value={rate} />
                <span className="font-mono text-[10px] text-slate-400">{rate}% done</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] ${d.overdue ? "border-[#E11D48]/50 bg-[#2A1215] text-[#FDA4AF]" : "border-[#1E293B] text-slate-500"}`} data-testid={`department-overdue-${slug}`}>
                  <AlertTriangle className="size-3" /> {d.overdue} overdue
                </span>
                <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] ${d.due_soon ? "border-[#D97706]/50 bg-[#261A05] text-[#FDE68A]" : "border-[#1E293B] text-slate-500"}`}>
                  {d.due_soon} due soon
                </span>
                <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] ${d.blocked ? "border-[#E11D48]/50 bg-[#2A1215] text-[#FDA4AF]" : "border-[#1E293B] text-slate-500"}`} data-testid={`department-blocked-${slug}`}>
                  <Ban className="size-3" /> {d.blocked} blocked
                </span>
                <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] ${d.critical_open ? "border-[#E11D48]/50 bg-[#2A1215] text-[#FDA4AF]" : "border-[#1E293B] text-slate-500"}`}>
                  <Flame className="size-3" /> {d.critical_open} critical
                </span>
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
