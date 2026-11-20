import { useState } from "react";
import { Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, CapacityMeter } from "@/components/TaskBits";
import { DEPARTMENTS, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, localToday } from "@/lib/format";
import { useCapacity, useUsers } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Department, Priority, Status, Task, TaskCreate } from "@/lib/types";

interface Props {
  initial?: Task;
  defaultAssignee?: string;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: TaskCreate) => void;
  onCancel: () => void;
}

export default function TaskForm({ initial, defaultAssignee, submitting, submitLabel, onSubmit, onCancel }: Props) {
  const users = useUsers();
  const allMembers = (users.data ?? []).filter((u) => u.role === "member");
  const startAssignee = initial?.assignee_id ?? defaultAssignee ?? "";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assignee, setAssignee] = useState(startAssignee);
  const [department, setDepartment] = useState<Department | null>(
    initial?.department ?? allMembers.find((m) => m.id === startAssignee)?.department ?? null,
  );
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<Status>(initial?.status ?? "todo");
  const [due, setDue] = useState(initial?.due_date ?? localToday());
  const [error, setError] = useState("");
  const capacity = useCapacity(true, department);

  const members = department ? allMembers.filter((m) => m.department === department) : allMembers;
  const nameOf = (id: string) => users.data?.find((u) => u.id === id)?.name ?? "Select member";
  const rows = capacity.isError ? [] : (capacity.data ?? []);

  const pickAssignee = (id: string) => {
    setAssignee(id);
    const dep = allMembers.find((m) => m.id === id)?.department;
    if (dep && !department) setDepartment(dep);
  };
  const pickDepartment = (d: Department) => {
    setDepartment(d);
    const current = allMembers.find((m) => m.id === assignee);
    if (current && current.department !== d) setAssignee("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required");
    if (!assignee) return setError("Choose a team member");
    if (!due) return setError("Pick a due date");
    setError("");
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      assignee_id: assignee,
      department,
      priority,
      status,
      progress: initial?.progress ?? 0,
      due_date: due,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="task-form">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          data-testid="task-form-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Refuge chamber inspection – Level 5"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          data-testid="task-form-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does done look like?"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={department ?? ""} onValueChange={(v: string) => pickDepartment(v as Department)}>
            <SelectTrigger className="w-full" data-testid="task-form-department-select">
              <SelectValue>{(v) => (v as string) || "Select department"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d} data-testid={`task-form-department-option-${d.toLowerCase().replace(/\s+/g, "-")}`}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Assignee</Label>
          <Select value={assignee} onValueChange={(v: string) => pickAssignee(v)}>
            <SelectTrigger className="w-full" data-testid="task-form-assignee-select">
              <SelectValue>{(v) => nameOf(v as string)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} data-testid={`task-form-assignee-option-${m.id}`}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3" data-testid="workload-balancer">
        <div className="mb-2 flex items-center gap-2">
          <Scale className="size-3.5 text-[#818CF8]" />
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Workload balancer {department ? `· ${department}` : "· all departments"}
          </p>
        </div>
        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {rows.length === 0 && (
            <li className="py-3 text-center text-xs text-slate-500">{capacity.isLoading ? "Checking capacity…" : "No members in this department."}</li>
          )}
          {rows.map((c, i) => (
            <li key={c.user_id}>
              <button
                type="button"
                onClick={() => pickAssignee(c.user_id)}
                data-testid={`capacity-option-${c.user_id}`}
                className={cn(
                  "grid w-full grid-cols-[auto_1fr_130px] items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors duration-150",
                  assignee === c.user_id ? "border-[#6366F1] bg-[#4F46E5]/10" : "border-[#1E293B] hover:border-[#334155]",
                )}
              >
                <Avatar id={c.user_id} name={c.name} size="sm" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-100">{c.name}</span>
                    {i === 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-sm bg-[#4F46E5] px-1 font-mono text-[9px] font-bold uppercase text-white" data-testid="capacity-best-fit">
                        <Sparkles className="size-2.5" /> Best fit
                      </span>
                    )}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-slate-500">
                    {c.open_tasks} open · {c.critical_high} crit/high · {c.overdue} overdue · {c.due_this_week} due ≤7d
                  </span>
                </span>
                <CapacityMeter capacity={c} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            data-testid="task-form-due-input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="[color-scheme:dark]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v: string) => setPriority(v as Priority)}>
            <SelectTrigger className="w-full" data-testid="task-form-priority-select">
              <SelectValue>{(v) => PRIORITY_META[v as Priority]?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} data-testid={`task-form-priority-option-${p}`}>
                  {PRIORITY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v: string) => setStatus(v as Status)}>
            <SelectTrigger className="w-full" data-testid="task-form-status-select">
              <SelectValue>{(v) => STATUS_META[v as Status]?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} data-testid={`task-form-status-option-${s}`}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && (
        <p className="text-sm text-[#F87171]" data-testid="task-form-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} data-testid="task-form-cancel-button">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          data-testid="task-form-submit-button"
          className="bg-[#4F46E5] text-white transition-[background-color,transform] duration-150 hover:bg-[#4338CA] active:scale-[0.98]"
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
