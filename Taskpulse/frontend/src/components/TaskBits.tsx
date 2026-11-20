import { Ban, CalendarClock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CAPACITY_META, DEPARTMENTS, DEPT_META, PRIORITY_META, STATUS_META, avatarTone, dueLabel, initials } from "@/lib/format";
import type { Department, MemberCapacity, Priority, Status, Task } from "@/lib/types";

export function PriorityBadge({ priority, testId }: { priority: Priority; testId?: string }) {
  const m = PRIORITY_META[priority];
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        m.chip,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ status, testId }: { status: Status; testId?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider", m.chip)}
    >
      {m.label}
    </span>
  );
}

export function DueBadge({ task, today, testId }: { task: Task; today: string; testId?: string }) {
  const tone = task.is_overdue
    ? "text-[#FDA4AF] bg-[#2A1215] border-[#E11D48]/50"
    : task.is_due_soon
      ? "text-[#FDE68A] bg-[#261A05] border-[#D97706]/50"
      : "text-slate-300 bg-[#1E293B] border-[#334155]";
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide", tone)}
    >
      {task.is_overdue ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#E11D48] opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[#E11D48]" />
        </span>
      ) : (
        <CalendarClock className="size-3" />
      )}
      {dueLabel(task.due_date, today, task.status === "done")}
    </span>
  );
}

export function ProgressBar({ value, className, testId }: { value: number; className?: string; testId?: string }) {
  const color = value >= 100 ? "bg-[#10B981]" : value >= 60 ? "bg-[#6366F1]" : value >= 25 ? "bg-[#3B82F6]" : "bg-[#64748B]";
  return (
    <div data-testid={testId} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Avatar({ id, name, size = "sm" }: { id: string; name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const dims = { xs: "size-5 text-[9px]", sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm" }[size];
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-heading font-bold text-white ring-2 ring-[#0B0F17]", dims)}
      style={{ backgroundColor: avatarTone(id) }}
    >
      {initials(name)}
    </span>
  );
}

export function Overline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400", className)}>{children}</p>
  );
}

export function DeptChip({ department, testId }: { department: Department | null; testId?: string }) {
  if (!department) return null;
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide", DEPT_META[department].chip)}
    >
      {DEPT_META[department].short}
    </span>
  );
}

export function BlockedBadge({ testId }: { testId?: string }) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded-sm border border-[#E11D48]/50 bg-[#2A1215] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#FDA4AF]"
    >
      <Ban className="size-3" /> Blocked
    </span>
  );
}

export function CapacityMeter({ capacity, testId }: { capacity: MemberCapacity; testId?: string }) {
  const m = CAPACITY_META[capacity.level];
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className={cn("rounded-sm border px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider", m.chip)}>
          {m.label}
        </span>
        <span className="font-mono text-[10px] text-slate-500">load {capacity.load_score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
        <div className={cn("h-full rounded-full transition-[width] duration-500", m.bar)} style={{ width: `${Math.max(4, capacity.load_pct)}%` }} />
      </div>
    </div>
  );
}

export function DepartmentFilter({
  value,
  onChange,
  testId = "department-filter",
  className,
}: {
  value: Department | null;
  onChange: (d: Department | null) => void;
  testId?: string;
  className?: string;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(v: string) => onChange(v === "all" ? null : (v as Department))}>
      <SelectTrigger className={cn("h-9 w-48 bg-[#111827]", className)} data-testid={testId}>
        <SelectValue>{(v) => (v === "all" ? "All departments" : (v as string))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" data-testid={`${testId}-option-all`}>All departments</SelectItem>
        {DEPARTMENTS.map((d) => (
          <SelectItem key={d} value={d} data-testid={`${testId}-option-${d.toLowerCase().replace(/\s+/g, "-")}`}>
            {d}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
