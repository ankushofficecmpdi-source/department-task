import { useMemo, useState } from "react";
import { BellRing, CirclePlus, MessageSquare, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Avatar, Overline } from "@/components/TaskBits";
import { timeAgo } from "@/lib/format";
import { useActivity, useTaskDialogs } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types";

const KIND: Record<string, { icon: typeof MessageSquare; tone: string; label: string }> = {
  created: { icon: CirclePlus, tone: "text-[#93C5FD]", label: "Assigned" },
  updated: { icon: RefreshCw, tone: "text-[#C4B5FD]", label: "Updated" },
  note: { icon: MessageSquare, tone: "text-[#6EE7B7]", label: "Notes" },
  nudge: { icon: BellRing, tone: "text-[#FBBF24]", label: "Nudges" },
  deleted: { icon: Trash2, tone: "text-[#FB7185]", label: "Deleted" },
  member_added: { icon: UserPlus, tone: "text-[#93C5FD]", label: "Team" },
};
const FILTERS = ["all", "created", "updated", "note", "nudge"] as const;

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function ActivityFeed() {
  const activity = useActivity();
  const { openTask } = useTaskDialogs();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const groups = useMemo(() => {
    const items = (activity.isError ? [] : (activity.data ?? [])).filter((a) => filter === "all" || a.kind === filter);
    const out: [string, Activity[]][] = [];
    for (const a of items) {
      const k = dayKey(a.created_at);
      const last = out[out.length - 1];
      if (last && last[0] === k) last[1].push(a);
      else out.push([k, [a]]);
    }
    return out;
  }, [activity.data, activity.isError, filter]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Overline>Audit trail</Overline>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Activity stream</h2>
        <p className="mt-1 text-sm text-slate-400">Every assignment, status change and progress note — refreshed automatically.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            data-testid={`activity-filter-${f}`}
            className={cn(
              "rounded-md border px-3 py-1 text-xs font-medium transition-colors duration-150",
              filter === f ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-[#1E293B] text-slate-400 hover:text-white",
            )}
          >
            {f === "all" ? "All" : KIND[f].label}
          </button>
        ))}
      </div>
      {activity.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {groups.length === 0 && !activity.isLoading && <p className="text-sm text-slate-500">No activity to show.</p>}
      <div className="space-y-8" data-testid="activity-list">
        {groups.map(([day, items]) => (
          <section key={day}>
            <Overline className="mb-3 text-[10px]">{day}</Overline>
            <ol className="relative space-y-1 border-l border-[#1E293B]">
              {items.map((a) => {
                const k = KIND[a.kind] ?? KIND.updated;
                return (
                  <li key={a.id} className="relative pl-6" data-testid={`activity-item-${a.id}`}>
                    <span className="absolute -left-[9px] top-3 flex size-[18px] items-center justify-center rounded-full border border-[#1E293B] bg-[#0B0F17]">
                      <k.icon className={cn("size-2.5", k.tone)} />
                    </span>
                    <button
                      type="button"
                      disabled={!a.task_id}
                      onClick={() => a.task_id && openTask(a.task_id)}
                      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#111827] disabled:cursor-default"
                    >
                      <Avatar id={a.actor_id} name={a.actor_name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-300">
                          <span className="font-semibold text-white">{a.actor_name}</span> {a.message}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{timeAgo(a.created_at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
