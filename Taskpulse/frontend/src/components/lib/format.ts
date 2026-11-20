import { differenceInCalendarDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import type { CapacityLevel, Department, NoteTag, Priority, Status } from "@/lib/types";

export const DEPARTMENTS: Department[] = ["Opencast Mining", "Underground Mining", "Environment", "Mine Closure"];

export const DEPT_META: Record<Department, { short: string; hex: string; chip: string }> = {
  "Opencast Mining": { short: "Opencast", hex: "#F59E0B", chip: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]" },
  "Underground Mining": { short: "Underground", hex: "#38BDF8", chip: "border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#7DD3FC]" },
  Environment: { short: "Environment", hex: "#34D399", chip: "border-[#34D399]/40 bg-[#34D399]/10 text-[#6EE7B7]" },
  "Mine Closure": { short: "Closure", hex: "#C084FC", chip: "border-[#C084FC]/40 bg-[#C084FC]/10 text-[#D8B4FE]" },
};

export const CAPACITY_META: Record<CapacityLevel, { label: string; bar: string; chip: string }> = {
  available: { label: "Has capacity", bar: "bg-[#10B981]", chip: "border-[#059669]/50 bg-[#062319] text-[#6EE7B7]" },
  balanced: { label: "Balanced", bar: "bg-[#F59E0B]", chip: "border-[#D97706]/50 bg-[#261A05] text-[#FDE68A]" },
  stretched: { label: "Stretched", bar: "bg-[#E11D48]", chip: "border-[#E11D48]/50 bg-[#2A1215] text-[#FDA4AF]" },
};

export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
export const STATUSES: Status[] = ["todo", "in_progress", "review", "done"];

export const PRIORITY_META: Record<Priority, { label: string; dot: string; chip: string; hex: string }> = {
  critical: { label: "Critical", dot: "bg-[#E11D48]", chip: "bg-[#2A1215] text-[#FECDD3] border-[#E11D48]/60", hex: "#E11D48" },
  high: { label: "High", dot: "bg-[#EA580C]", chip: "bg-[#2B160B] text-[#FED7AA] border-[#EA580C]/60", hex: "#EA580C" },
  medium: { label: "Medium", dot: "bg-[#D97706]", chip: "bg-[#261A05] text-[#FEF3C7] border-[#D97706]/60", hex: "#D97706" },
  low: { label: "Low", dot: "bg-[#0D9488]", chip: "bg-[#082622] text-[#99F6E4] border-[#0D9488]/60", hex: "#0D9488" },
};

export const STATUS_META: Record<Status, { label: string; chip: string; hex: string }> = {
  todo: { label: "To do", chip: "bg-[#334155] text-[#F8FAFC]", hex: "#64748B" },
  in_progress: { label: "In progress", chip: "bg-[#2563EB] text-white", hex: "#3B82F6" },
  review: { label: "In review", chip: "bg-[#7C3AED] text-white", hex: "#8B5CF6" },
  done: { label: "Done", chip: "bg-[#059669] text-white", hex: "#10B981" },
};

export const NOTE_TAG_META: Record<NoteTag, { label: string; chip: string }> = {
  progress: { label: "Progress", chip: "bg-[#0F1E36] text-[#93C5FD] border-[#2563EB]/50" },
  blocker: { label: "Blocker", chip: "bg-[#2A1215] text-[#FDA4AF] border-[#E11D48]/50" },
  milestone: { label: "Milestone", chip: "bg-[#062319] text-[#6EE7B7] border-[#059669]/50" },
  review: { label: "Review request", chip: "bg-[#1F1335] text-[#C4B5FD] border-[#7C3AED]/50" },
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Relative due label anchored on the server's "today" (DashboardSummary.today). */
export function dueLabel(due: string, today: string, done: boolean): string {
  const diff = differenceInCalendarDays(parseISO(due), parseISO(today));
  if (done) return `Due ${parseISO(due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (diff < 0) return `Overdue ${-diff}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export function timeAgo(iso: string): string {
  try {
    return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
  } catch {
    return "";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_TONES = ["#4F46E5", "#0D9488", "#D97706", "#DB2777", "#2563EB", "#7C3AED", "#059669"];
export function avatarTone(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const body = (err as { body?: { detail?: unknown } })?.body;
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) return "Please check the highlighted fields";
  return fallback;
}
