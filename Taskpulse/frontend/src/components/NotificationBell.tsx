import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlarmClock, Bell, BellRing, Flame, MessageSquare, OctagonAlert, Sunrise, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiPost } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { invalidateWork, useNotifications } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { NotificationKind, OkResponse } from "@/lib/types";

const KIND_META: Record<NotificationKind, { icon: typeof Bell; tone: string }> = {
  overdue: { icon: OctagonAlert, tone: "text-[#FB7185] bg-[#2A1215]" },
  critical: { icon: Flame, tone: "text-[#FB7185] bg-[#2A1215]" },
  blocker: { icon: OctagonAlert, tone: "text-[#FB7185] bg-[#2A1215]" },
  due_soon: { icon: AlarmClock, tone: "text-[#FBBF24] bg-[#261A05]" },
  nudge: { icon: BellRing, tone: "text-[#FBBF24] bg-[#261A05]" },
  assigned: { icon: UserPlus, tone: "text-[#93C5FD] bg-[#0F1E36]" },
  update: { icon: MessageSquare, tone: "text-[#6EE7B7] bg-[#062319]" },
  digest: { icon: Sunrise, tone: "text-[#FBBF24] bg-[#261A05]" },
};

export default function NotificationBell({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { data } = useNotifications();
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  const lastSeen = useRef<string | null>(null);

  // Toast newly-arrived unread alerts (after the first load) so priority work surfaces in real time.
  useEffect(() => {
    if (!data) return;
    const newest = data.items[0];
    if (lastSeen.current !== null && newest && newest.id !== lastSeen.current && !newest.read) {
      const fresh = data.items.slice(0, data.items.findIndex((n) => n.id === lastSeen.current));
      for (const n of (fresh.length ? fresh : [newest]).slice(0, 3)) {
        const urgent = ["overdue", "critical", "blocker", "due_soon", "nudge", "digest"].includes(n.kind);
        (urgent ? toast.warning : toast.info)(n.title, { description: n.message });
      }
    }
    lastSeen.current = newest?.id ?? "";
  }, [data]);

  const readAll = useMutation({
    mutationFn: () => apiPost<OkResponse>("/notifications/read-all"),
    onSuccess: () => invalidateWork(),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => apiPost<OkResponse>(`/notifications/${id}/read`),
    onSuccess: () => invalidateWork(),
  });

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Notifications"
        data-testid="notification-bell-button"
        className="relative inline-flex size-9 items-center justify-center rounded-md border border-[#1E293B] bg-[#111827] text-slate-300 transition-colors duration-150 hover:border-[#334155] hover:text-white"
      >
        <Bell className={cn("size-4", unread > 0 && "animate-bell-ring")} />
        {unread > 0 && (
          <span
            data-testid="notification-unread-count"
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E11D48] px-1 font-mono text-[10px] font-bold text-white ring-2 ring-[#0B0F17]"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,380px)] border-[#1E293B] bg-[#0F1520] p-0"
        data-testid="notification-panel"
      >
        <div className="flex items-center justify-between border-b border-[#1E293B] px-4 py-3">
          <div>
            <p className="font-heading text-sm font-bold text-white">Notifications</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{unread} unread</p>
          </div>
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={unread === 0}
            data-testid="notification-mark-all-read-button"
            className="text-xs font-medium text-[#818CF8] transition-colors hover:text-white disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
        <ul className="max-h-[420px] overflow-y-auto" data-testid="notification-list">
          {(data?.items ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</li>
          )}
          {(data?.items ?? []).map((n) => {
            const meta = KIND_META[n.kind];
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => {
                    if (!n.read) readOne.mutate(n.id);
                    if (n.kind === "digest") navigate("/digest");
                    else if (n.task_id) onOpenTask(n.task_id);
                  }}
                  className={cn(
                    "flex w-full gap-3 border-b border-[#1E293B]/60 px-4 py-3 text-left transition-colors duration-150 hover:bg-[#111827]",
                    !n.read && "bg-[#4F46E5]/[0.06]",
                  )}
                >
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", meta.tone)}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-100">{n.title}</span>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-[#6366F1]" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{n.message}</span>
                    <span className="mt-1 block font-mono text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
