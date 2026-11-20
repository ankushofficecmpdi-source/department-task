import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, DepartmentFilter, DeptChip, Overline } from "@/components/TaskBits";
import { apiPatch } from "@/lib/api";
import { PRIORITY_META, errorMessage } from "@/lib/format";
import { invalidateWork, useDeptParam, useMe, usePlanner, useTaskDialogs } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Task, TaskUpdate } from "@/lib/types";

function Chip({ t, draggable, onOpen }: { t: Task; draggable: boolean; onOpen: () => void }) {
  const checks = t.checklist.length ? `${t.checklist.filter((i) => i.done).length}/${t.checklist.length}` : null;
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
      onClick={onOpen}
      data-testid={`planner-task-${t.id}`}
      className={cn(
        "w-full rounded border-l-2 bg-[#0B0F17] px-2 py-1.5 text-left transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-[#1E293B]",
        t.status === "done" && "opacity-50",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      style={{ borderLeftColor: PRIORITY_META[t.priority].hex }}
    >
      <p className={cn("line-clamp-2 text-[11px] font-medium leading-snug text-slate-200", t.status === "done" && "line-through")}>{t.title}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
        {t.progress}%{checks && <span className="inline-flex items-center gap-0.5"><ClipboardCheck className="size-2.5" />{checks}</span>}
        {t.is_overdue && <span className="text-[#FB7185]">overdue</span>}
      </p>
    </button>
  );
}

export default function Planner() {
  const me = useMe();
  const isManager = me.data?.role === "manager";
  const [dept, setDept] = useDeptParam();
  const [start, setStart] = useState<string | null>(null);
  const week = usePlanner(start, dept);
  const { openTask } = useTaskDialogs();
  const [over, setOver] = useState<string | null>(null);
  const w = week.isError ? undefined : week.data;

  const reschedule = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskUpdate }) => apiPatch<Task>(`/tasks/${id}`, body),
    onSuccess: (t) => toast.success(`Moved to ${format(parseISO(t.due_date), "EEE d MMM")}`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => invalidateWork(),
  });
  const shift = (days: number) => w && setStart(format(addDays(parseISO(w.start), days), "yyyy-MM-dd"));
  const totalClashes = w?.rows.reduce((n, r) => n + r.clashes, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Overline>Week view</Overline>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Shift planner</h2>
          <p className="mt-1 text-sm text-slate-400">
            Each person's work by due date. {isManager ? "Drag a task to another day to reschedule it." : "Your week at a glance."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && <DepartmentFilter value={dept} onChange={setDept} testId="planner-department-filter" />}
          <div className="flex items-center rounded-md border border-[#1E293B] bg-[#111827]">
            <button type="button" aria-label="Previous week" onClick={() => shift(-7)} data-testid="planner-prev-week" className="p-2 text-slate-400 transition-colors hover:text-white">
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[150px] text-center font-mono text-xs text-slate-200" data-testid="planner-week-label">
              {w ? `${format(parseISO(w.start), "d MMM")} – ${format(parseISO(w.end), "d MMM yyyy")}` : "…"}
            </span>
            <button type="button" aria-label="Next week" onClick={() => shift(7)} data-testid="planner-next-week" className="p-2 text-slate-400 transition-colors hover:text-white">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStart(null)} data-testid="planner-this-week">This week</Button>
        </div>
      </div>

      {totalClashes > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[#D97706]/50 bg-[#261A05] px-3 py-2 text-sm text-[#FDE68A]" data-testid="planner-clash-banner">
          <AlertTriangle className="size-4" /> {totalClashes} clash{totalClashes === 1 ? "" : "es"} this week — someone has two or more open tasks due on the same day.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#1E293B] bg-[#0F1520]">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[190px_110px_repeat(7,minmax(0,1fr))] border-b border-[#1E293B] bg-[#111827]">
            <div className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Member</div>
            <div className="px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#FB7185]">Carried over</div>
            {(w?.days ?? []).map((d) => (
              <div
                key={d}
                className={cn("px-2 py-2.5 text-center", d === w?.today && "bg-[#4F46E5]/15")}
                data-testid={`planner-day-${d}`}
              >
                <p className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", d === w?.today ? "text-[#A5B4FC]" : "text-slate-500")}>{format(parseISO(d), "EEE")}</p>
                <p className={cn("font-heading text-sm font-bold", d === w?.today ? "text-white" : "text-slate-300")}>{format(parseISO(d), "d MMM")}</p>
              </div>
            ))}
          </div>
          {week.isLoading && <p className="p-6 text-sm text-slate-500">Loading week…</p>}
          {w?.rows.length === 0 && <p className="p-6 text-sm text-slate-500">No members in this department.</p>}
          {w?.rows.map((r, idx) => (
            <motion.div
              key={r.user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.03 }}
              className="grid grid-cols-[190px_110px_repeat(7,minmax(0,1fr))] border-b border-[#1E293B] last:border-0"
              data-testid={`planner-row-${r.user.id}`}
            >
              <div className="flex items-start gap-2 border-r border-[#1E293B] px-3 py-3">
                <Avatar id={r.user.id} name={r.user.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{r.user.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <DeptChip department={r.user.department} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-slate-500" data-testid={`planner-row-summary-${r.user.id}`}>
                    {r.week_open} open{r.clashes ? <span className="text-[#FDE68A]"> · {r.clashes} clash</span> : null}
                  </p>
                </div>
              </div>
              <div className="space-y-1 border-r border-[#1E293B] bg-[#2A1215]/30 p-1.5">
                {r.carried_over.map((t) => <Chip key={t.id} t={t} draggable={isManager} onOpen={() => openTask(t.id)} />)}
              </div>
              {r.cells.map((c) => {
                const key = `${r.user.id}:${c.date}`;
                return (
                  <div
                    key={c.date}
                    data-testid={`planner-cell-${r.user.id}-${c.date}`}
                    onDragOver={(e) => {
                      if (!isManager) return;
                      e.preventDefault();
                      setOver(key);
                    }}
                    onDragLeave={() => setOver((o) => (o === key ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      const id = e.dataTransfer.getData("text/plain");
                      const all = [...r.carried_over, ...r.cells.flatMap((x) => x.tasks)];
                      const t = all.find((x) => x.id === id);
                      if (t && t.due_date !== c.date) reschedule.mutate({ id, body: { due_date: c.date } });
                    }}
                    className={cn(
                      "min-h-[86px] space-y-1 border-r border-[#1E293B]/60 p-1.5 transition-colors duration-150 last:border-0",
                      c.date === w.today && "bg-[#4F46E5]/[0.05]",
                      c.clash && "bg-[#261A05]/60 ring-1 ring-inset ring-[#D97706]/50",
                      over === key && "bg-[#4F46E5]/15 ring-1 ring-inset ring-[#6366F1]",
                    )}
                  >
                    {c.clash && (
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#FBBF24]" data-testid={`planner-clash-${r.user.id}-${c.date}`}>
                        Clash · {c.open}
                      </p>
                    )}
                    {c.tasks.map((t) => <Chip key={t.id} t={t} draggable={isManager} onOpen={() => openTask(t.id)} />)}
                  </div>
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
