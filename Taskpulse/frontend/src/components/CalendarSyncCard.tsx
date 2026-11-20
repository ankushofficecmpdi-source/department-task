import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck2, CalendarX2, RefreshCw } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api";
import { errorMessage, timeAgo } from "@/lib/format";
import { invalidateWork, useCalendarStatus } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { CalendarSettings, CalendarStatus, CalendarSyncResult } from "@/lib/types";

/** Sidebar card (manager only): Google Calendar sync status, on/off toggle and "Sync now". */
export default function CalendarSyncCard() {
  const status = useCalendarStatus(true);
  const s = status.isError ? undefined : status.data;

  const toggle = useMutation({
    mutationFn: (body: CalendarSettings) => apiPut<CalendarStatus>("/calendar/settings", body),
    onSuccess: (r) => {
      invalidateWork();
      toast.success(r.enabled ? "Calendar sync turned on" : "Calendar sync paused");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sync = useMutation({
    mutationFn: () => apiPost<CalendarSyncResult>("/calendar/sync"),
    onSuccess: (r) => {
      invalidateWork();
      if (r.error && r.synced === 0) toast.error(r.error);
      else toast.success(`${r.synced} task${r.synced === 1 ? "" : "s"} synced to Google Calendar${r.failed ? ` · ${r.failed} failed` : ""}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const live = !!s?.connected && s.enabled;
  return (
    <div className="mb-3 rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3" data-testid="calendar-sync-card">
      <div className="flex items-center gap-2">
        {live ? <CalendarCheck2 className="size-4 text-[#34D399]" /> : <CalendarX2 className="size-4 text-slate-500" />}
        <p className="flex-1 text-xs font-semibold text-slate-200">Google Calendar</p>
        {s?.connected && (
          <button
            type="button"
            role="switch"
            aria-checked={s.enabled}
            aria-label="Toggle calendar sync"
            onClick={() => toggle.mutate({ enabled: !s.enabled })}
            data-testid="calendar-sync-toggle"
            className={cn("relative h-4 w-7 rounded-full transition-colors duration-150", s.enabled ? "bg-[#4F46E5]" : "bg-[#334155]")}
          >
            <span className={cn("absolute left-0 top-0.5 size-3 rounded-full bg-white transition-transform duration-150", s.enabled ? "translate-x-3.5" : "translate-x-0.5")} />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500" data-testid="calendar-sync-status">
        {!s
          ? "Checking…"
          : !s.connected
            ? "Not connected yet"
            : !s.enabled
              ? "Connected · sync is off — switch on to add due dates"
              : `${s.synced_tasks} tasks on calendar${s.last_synced_at ? ` · ${timeAgo(s.last_synced_at)}` : ""}`}
      </p>
      {s?.last_error && live && <p className="mt-1 line-clamp-2 text-[10px] text-[#FDA4AF]" data-testid="calendar-sync-error">{s.last_error}</p>}
      {live && (
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          data-testid="calendar-sync-now-button"
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#818CF8] transition-colors hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", sync.isPending && "animate-spin")} /> {sync.isPending ? "Syncing…" : "Sync all now"}
        </button>
      )}
    </div>
  );
}
