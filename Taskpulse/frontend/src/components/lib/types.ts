// Hand-written mirrors of backend/models/schemas.py — keep in sync with the Pydantic models.
export type Role = "manager" | "member";
export type Priority = "low" | "medium" | "high" | "critical";
export type Status = "todo" | "in_progress" | "review" | "done";
export type NoteTag = "progress" | "blocker" | "milestone" | "review";
export type NotificationKind =
  | "assigned"
  | "update"
  | "nudge"
  | "overdue"
  | "due_soon"
  | "critical"
  | "blocker"
  | "digest";
export type Department = "Opencast Mining" | "Underground Mining" | "Environment" | "Mine Closure";
export type CapacityLevel = "available" | "balanced" | "stretched";

export interface OkResponse {
  ok: boolean;
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  department: Department | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  title: string;
  department: Department;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  title?: string;
  department?: Department;
}

export interface TaskNote {
  id: string;
  author_id: string;
  author_name: string;
  note: string;
  tag: NoteTag;
  progress: number | null;
  status: Status | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  done_by_name: string | null;
  done_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee_id: string;
  assignee_name: string;
  department: Department | null;
  priority: Priority;
  status: Status;
  progress: number;
  due_date: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  notes: TaskNote[];
  checklist: ChecklistItem[];
  is_overdue: boolean;
  is_due_soon: boolean;
  is_blocked: boolean;
  on_calendar: boolean;
}

export interface TaskCreate {
  title: string;
  description: string;
  assignee_id: string;
  department: Department | null;
  priority: Priority;
  status: Status;
  progress: number;
  due_date: string;
}

export type TaskUpdate = Partial<TaskCreate>;

export interface NoteCreate {
  note: string;
  tag: NoteTag;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  task_id: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}

export interface Activity {
  id: string;
  actor_id: string;
  actor_name: string;
  task_id: string | null;
  task_title: string;
  kind: string;
  message: string;
  created_at: string;
}

export interface MemberWorkload {
  user_id: string;
  name: string;
  title: string;
  department: Department | null;
  assigned: number;
  active: number;
  completed: number;
  overdue: number;
  critical: number;
  avg_progress: number;
}

export interface DashboardSummary {
  today: string;
  total: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  critical_high: number;
  overdue: number;
  due_soon: number;
  blocked: number;
  avg_progress: number;
  completion_rate: number;
  workload: MemberWorkload[];
  departments: DepartmentStats[];
  alerts_overdue: Task[];
  alerts_due_soon: Task[];
  alerts_critical: Task[];
}

export interface TeamMember {
  user: UserPublic;
  stats: MemberWorkload;
  capacity: MemberCapacity;
  tasks: Task[];
}

export interface DepartmentStats {
  department: Department;
  members: string[];
  total: number;
  open: number;
  done: number;
  overdue: number;
  due_soon: number;
  blocked: number;
  critical_open: number;
  avg_progress: number;
}

export interface MemberCapacity {
  user_id: string;
  name: string;
  title: string;
  department: Department | null;
  open_tasks: number;
  critical_high: number;
  overdue: number;
  due_this_week: number;
  load_score: number;
  load_pct: number;
  level: CapacityLevel;
}

export interface DigestItem {
  task_id: string;
  title: string;
  assignee_name: string;
  department: Department | null;
  priority: Priority;
  due_date: string;
  progress: number;
  note: string;
}

export interface DigestDepartment {
  department: Department;
  overdue: number;
  due_today: number;
  blocked: number;
}

export interface Digest {
  id: string;
  date: string;
  generated_at: string;
  trigger: string;
  overdue: DigestItem[];
  due_today: DigestItem[];
  blocked: DigestItem[];
  by_department: DigestDepartment[];
}

export interface CalendarStatus {
  connected: boolean;
  enabled: boolean;
  synced_tasks: number;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  department: Department | null;
  items: string[];
}

export interface ChecklistTemplateCreate {
  name: string;
  department: Department | null;
  items: string[];
}

export interface ChecklistApply {
  template_id: string;
}

export interface ChecklistItemCreate {
  text: string;
}

export interface ChecklistToggle {
  done: boolean;
}

export interface PlannerCell {
  date: string;
  tasks: Task[];
  open: number;
  clash: boolean;
}

export interface PlannerRow {
  user: UserPublic;
  cells: PlannerCell[];
  carried_over: Task[];
  week_open: number;
  clashes: number;
}

export interface PlannerWeek {
  start: string;
  end: string;
  today: string;
  days: string[];
  rows: PlannerRow[];
}

export interface DigestEmailStatus {
  connected: boolean;
  enabled: boolean;
  recipient: string | null;
  last_sent_at: string | null;
  last_error: string | null;
}

export interface DigestEmailSettings {
  enabled: boolean;
}

export interface DigestEmailResult {
  sent: boolean;
  recipient: string | null;
  error: string | null;
}

export interface CalendarSettings {
  enabled: boolean;
}

export interface CalendarSyncResult {
  synced: number;
  failed: number;
  error: string | null;
}
