import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type {
  Activity,
  CalendarStatus,
  DashboardSummary,
  Department,
  ChecklistTemplate,
  Digest,
  DigestEmailStatus,
  MemberCapacity,
  PlannerWeek,
  NotificationList,
  Task,
  TeamMember,
  UserPublic,
} from "@/lib/types";

const LIVE = 30_000; // "timely updation": work data refreshes every 30s

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => apiGet<UserPublic>("/auth/me"), retry: false });

export const useTasks = () =>
  useQuery({ queryKey: ["tasks"], queryFn: () => apiGet<Task[]>("/tasks"), refetchInterval: LIVE });

export const useTask = (id: string | null) =>
  useQuery({
    queryKey: ["tasks", id],
    queryFn: () => apiGet<Task>(`/tasks/${id}`),
    enabled: !!id,
    retry: false,
  });

const deptQuery = (dept: Department | null) => (dept ? `?department=${encodeURIComponent(dept)}` : "");

export const useDashboard = (dept: Department | null = null) =>
  useQuery({
    queryKey: ["dashboard", dept],
    queryFn: () => apiGet<DashboardSummary>(`/dashboard${deptQuery(dept)}`),
    refetchInterval: LIVE,
  });

export const useTeam = (enabled: boolean, dept: Department | null = null) =>
  useQuery({
    queryKey: ["team", dept],
    queryFn: () => apiGet<TeamMember[]>(`/team${deptQuery(dept)}`),
    enabled,
    refetchInterval: LIVE,
  });

export const useCapacity = (enabled: boolean, dept: Department | null = null) =>
  useQuery({
    queryKey: ["capacity", dept],
    queryFn: () => apiGet<MemberCapacity[]>(`/capacity${deptQuery(dept)}`),
    enabled,
  });

export const useDigests = (enabled: boolean) =>
  useQuery({ queryKey: ["digests"], queryFn: () => apiGet<Digest[]>("/digests"), enabled, refetchInterval: 60_000 });

export const useCalendarStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ["calendar"],
    queryFn: () => apiGet<CalendarStatus>("/calendar/status"),
    enabled,
    refetchInterval: LIVE,
  });

export const usePlanner = (start: string | null, dept: Department | null) =>
  useQuery({
    queryKey: ["planner", start, dept],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (start) qs.set("start", start);
      if (dept) qs.set("department", dept);
      const s = qs.toString();
      return apiGet<PlannerWeek>(`/planner${s ? `?${s}` : ""}`);
    },
    refetchInterval: LIVE,
  });

export const useTemplates = () =>
  useQuery({ queryKey: ["templates"], queryFn: () => apiGet<ChecklistTemplate[]>("/checklist-templates") });

export const useDigestEmailStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ["digest-email"],
    queryFn: () => apiGet<DigestEmailStatus>("/digests/email/status"),
    enabled,
  });

/** Department filter kept in the URL (?dept=) so links like "View board" can pre-filter a page. */
export function useDeptParam(): [Department | null, (d: Department | null) => void] {
  const [params, setParams] = useSearchParams();
  const dept = (params.get("dept") as Department | null) ?? null;
  const setDept = useCallback(
    (d: Department | null) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        if (d) next.set("dept", d);
        else next.delete("dept");
        return next;
      }),
    [setParams],
  );
  return [dept, setDept];
}

export const useUsers = () =>
  useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserPublic[]>("/users") });

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    refetchInterval: 20_000,
  });

export const useActivity = () =>
  useQuery({
    queryKey: ["activity"],
    queryFn: () => apiGet<Activity[]>("/activity?limit=100"),
    refetchInterval: LIVE,
  });

/** Every write touches the same cross-cutting views; refresh them together. */
export function invalidateWork(): void {
  for (const key of ["tasks", "dashboard", "team", "activity", "notifications", "users", "capacity", "digests", "calendar", "planner", "templates", "digest-email"]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Task detail + create dialogs are driven by URL params so any page (or a notification) can open them. */
export function useTaskDialogs() {
  const [params, setParams] = useSearchParams();
  const openTask = useCallback(
    (id: string) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set("task", id);
        next.delete("new");
        return next;
      }),
    [setParams],
  );
  const openNew = useCallback(
    (assigneeId?: string) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set("new", assigneeId ?? "1");
        next.delete("task");
        return next;
      }),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.delete("task");
        next.delete("new");
        return next;
      }),
    [setParams],
  );
  return { taskId: params.get("task"), newParam: params.get("new"), openTask, openNew, close };
}
