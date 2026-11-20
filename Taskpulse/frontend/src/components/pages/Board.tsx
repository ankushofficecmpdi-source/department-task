import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, BlockedBadge, DepartmentFilter, DeptChip, DueBadge, PriorityBadge, ProgressBar } from "@/components/TaskBits";
import { apiPatch } from "@/lib/api";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, errorMessage, localToday } from "@/lib/format";
import { invalidateWork, useDashboard, useDeptParam, useMe, useTaskDialogs, useTasks, useUsers } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Priority, Status, Task } from "@/lib/types";

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function Board() {
  const me = useMe();
  const tasks = useTasks();
  const users = useUsers();
  const today = useDashboard().data?.today ?? localToday();
  const { openTask } = useTaskDialogs();
  const [q, setQ] = useState("");
  const [dept, setDept] = useDeptParam();
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const isManager = me.data?.role === "manager";

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => apiPatch<Task>(`/tasks/${id}`, { status }),
    onMutate: ({ id, status }) => {
      queryClient.setQueryData<Task[]>(["tasks"], (old) => old?.map((t) => (t.id === id ? { ...t, status } : t)));
    },
    onSuccess: (t) => toast.success(`Moved to ${STATUS_META[t.status].label}`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => invalidateWork(),
  });

  const visible = useMemo(() => {
    const list = tasks.isError ? [] : (tasks.data ?? []);
    return list
      .filter((t) => !dept || t.department === dept)
      .filter((t) => assignee === "all" || t.assignee_id === assignee)
      .filter((t) => priority === "all" || t.priority === priority)
      .filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.due_date.localeCompare(b.due_date));
  }, [tasks.data, tasks.isError, dept, assignee, priority, q]);

  const members = (users.data ?? []).filter((u) => u.role === "member" && (!dept || u.department === dept));
  const nameOf = (id: string) => (id === "all" ? "All members" : (members.find((m) => m.id === id)?.name ?? id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 bg-[#111827] pl-9"
            data-testid="board-search-input"
          />
        </div>
        <DepartmentFilter value={dept} onChange={setDept} testId="board-department-filter" />
        {isManager && (
          <Select value={assignee} onValueChange={(v: string) => setAssignee(v)}>
            <SelectTrigger className="h-9 w-44 bg-[#111827]" data-testid="board-assignee-filter">
              <SelectValue>{(v) => nameOf(v as string)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} data-testid={`board-assignee-option-${m.id}`}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={priority} onValueChange={(v: string) => setPriority(v)}>
          <SelectTrigger className="h-9 w-40 bg-[#111827]" data-testid="board-priority-filter">
            <SelectValue>{(v) => (v === "all" ? "All priorities" : PRIORITY_META[v as Priority].label)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} data-testid={`board-priority-option-${p}`}>
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto hidden font-mono text-[11px] text-slate-500 md:block">Drag cards between columns to update status</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const col = visible.filter((t) => t.status === s);
          return (
            <section
              key={s}
              data-testid={`kanban-column-${s}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s);
              }}
              onDragLeave={() => setDragOver((c) => (c === s ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const t = visible.find((x) => x.id === id);
                if (t && t.status !== s) move.mutate({ id, status: s });
              }}
              className={cn(
                "flex min-h-[300px] flex-col rounded-lg border bg-[#0F1520] transition-colors duration-150",
                dragOver === s ? "border-[#6366F1] bg-[#4F46E5]/[0.06]" : "border-[#1E293B]",
              )}
            >
              <header className="flex items-center gap-2 border-b border-[#1E293B] px-3 py-3" style={{ boxShadow: `inset 0 2px 0 ${STATUS_META[s].hex}` }}>
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[s].hex }} />
                <h3 className="text-sm font-semibold tracking-normal text-white">{STATUS_META[s].label}</h3>
                <span className="ml-auto rounded-sm bg-[#1E293B] px-1.5 font-mono text-[11px] text-slate-300" data-testid={`kanban-column-count-${s}`}>
                  {col.length}
                </span>
              </header>
              <div className="flex-1 space-y-2.5 p-2.5">
                {col.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => openTask(t.id)}
                    data-testid={`task-card-${t.id}`}
                    className={cn(
                      "cursor-pointer rounded-md border bg-[#111827] p-3 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#334155] hover:shadow-lg hover:shadow-black/40",
                      t.is_overdue ? "border-[#E11D48]/50" : "border-[#1E293B]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <PriorityBadge priority={t.priority} />
                      <DueBadge task={t} today={today} />
                    </div>
                    <p className="mt-2.5 text-sm font-medium leading-snug text-slate-100">{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <DeptChip department={t.department} />
                      {t.is_blocked && <BlockedBadge testId={`task-card-blocked-${t.id}`} />}
                      {t.checklist.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400" data-testid={`task-card-checklist-${t.id}`}>
                          <ClipboardCheck className="size-3 text-[#34D399]" />
                          {t.checklist.filter((i) => i.done).length}/{t.checklist.length}
                        </span>
                      )}
                    </div>
                    {t.notes[0] && (
                      <p className="mt-1.5 line-clamp-1 flex items-center gap-1 text-xs text-slate-500">
                        <MessageSquare className="size-3 shrink-0" /> {t.notes[0].note}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <ProgressBar value={t.progress} />
                      <span className="font-mono text-[10px] text-slate-400">{t.progress}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Avatar id={t.assignee_id} name={t.assignee_name} size="xs" />
                        {t.assignee_name}
                      </span>
                      {t.notes.length > 0 && <span className="font-mono text-[10px] text-slate-500">{t.notes.length} upd</span>}
                    </div>
                  </article>
                ))}
                {col.length === 0 && (
                  <p className="rounded-md border border-dashed border-[#1E293B] py-8 text-center text-xs text-slate-600">
                    {tasks.isLoading ? "Loading…" : "No tasks"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
