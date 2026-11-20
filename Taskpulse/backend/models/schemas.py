"""Pydantic v2 models. Each one is mirrored by a hand-written TS interface in frontend/src/lib/types.ts."""

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Role = Literal["manager", "member"]
Priority = Literal["low", "medium", "high", "critical"]
Status = Literal["todo", "in_progress", "review", "done"]
NoteTag = Literal["progress", "blocker", "milestone", "review"]
Department = Literal["Opencast Mining", "Underground Mining", "Environment", "Mine Closure"]
CapacityLevel = Literal["available", "balanced", "stretched"]
NotificationKind = Literal["assigned", "update", "nudge", "overdue", "due_soon", "critical", "blocker", "digest"]

DEPARTMENTS: list[str] = ["Opencast Mining", "Underground Mining", "Environment", "Mine Closure"]
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class OkResponse(BaseModel):
    ok: bool = True


# ---------- users / auth ----------
class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    title: str = ""
    department: Optional[Department] = None  # managers oversee all departments


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    title: str = Field(default="", max_length=80)
    department: Department


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    email: Optional[EmailStr] = None
    title: Optional[str] = Field(default=None, max_length=80)
    department: Optional[Department] = None


# ---------- tasks ----------
class TaskNote(BaseModel):
    id: str
    author_id: str
    author_name: str
    note: str
    tag: NoteTag = "progress"
    progress: Optional[int] = None
    status: Optional[Status] = None
    created_at: str


class ChecklistItem(BaseModel):
    id: str
    text: str
    done: bool = False
    done_by_name: Optional[str] = None
    done_at: Optional[str] = None


class Task(BaseModel):
    id: str
    title: str
    description: str = ""
    assignee_id: str
    assignee_name: str
    department: Optional[Department] = None
    priority: Priority
    status: Status
    progress: int
    due_date: str
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str
    notes: list[TaskNote] = []
    checklist: list[ChecklistItem] = []
    is_overdue: bool = False
    is_due_soon: bool = False
    is_blocked: bool = False
    on_calendar: bool = False


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    assignee_id: str
    department: Optional[Department] = None  # defaults to the assignee's department
    priority: Priority = "medium"
    status: Status = "todo"
    progress: int = Field(default=0, ge=0, le=100)
    due_date: str = Field(pattern=DATE_PATTERN)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    assignee_id: Optional[str] = None
    department: Optional[Department] = None
    priority: Optional[Priority] = None
    status: Optional[Status] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    due_date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)


class NoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=2000)
    tag: NoteTag = "progress"


# ---------- notifications / activity ----------
class Notification(BaseModel):
    id: str
    kind: NotificationKind
    title: str
    message: str
    task_id: Optional[str] = None
    read: bool = False
    created_at: str


class NotificationList(BaseModel):
    items: list[Notification]
    unread: int


class Activity(BaseModel):
    id: str
    actor_id: str
    actor_name: str
    task_id: Optional[str] = None
    task_title: str = ""
    kind: str
    message: str
    created_at: str


# ---------- dashboard / team / capacity ----------
class MemberWorkload(BaseModel):
    user_id: str
    name: str
    title: str = ""
    department: Optional[Department] = None
    assigned: int
    active: int
    completed: int
    overdue: int
    critical: int
    avg_progress: float


class DepartmentStats(BaseModel):
    department: Department
    members: list[str]
    total: int
    open: int
    done: int
    overdue: int
    due_soon: int
    blocked: int
    critical_open: int
    avg_progress: float


class DashboardSummary(BaseModel):
    today: str
    total: int
    todo: int
    in_progress: int
    review: int
    done: int
    critical_high: int
    overdue: int
    due_soon: int
    blocked: int
    avg_progress: float
    completion_rate: float
    workload: list[MemberWorkload]
    departments: list[DepartmentStats]
    alerts_overdue: list[Task]
    alerts_due_soon: list[Task]
    alerts_critical: list[Task]


class TeamMember(BaseModel):
    user: UserPublic
    stats: MemberWorkload
    capacity: "MemberCapacity"
    tasks: list[Task]


class MemberCapacity(BaseModel):
    user_id: str
    name: str
    title: str = ""
    department: Optional[Department] = None
    open_tasks: int
    critical_high: int
    overdue: int
    due_this_week: int
    load_score: float
    load_pct: int
    level: CapacityLevel


# ---------- daily digest ----------
class DigestItem(BaseModel):
    task_id: str
    title: str
    assignee_name: str
    department: Optional[Department] = None
    priority: Priority
    due_date: str
    progress: int
    note: str = ""


class DigestDepartment(BaseModel):
    department: Department
    overdue: int
    due_today: int
    blocked: int


class Digest(BaseModel):
    id: str
    date: str
    generated_at: str
    trigger: str
    overdue: list[DigestItem]
    due_today: list[DigestItem]
    blocked: list[DigestItem]
    by_department: list[DigestDepartment]


class CronAck(BaseModel):
    status: str


# ---------- calendar sync ----------
class CalendarStatus(BaseModel):
    connected: bool
    enabled: bool
    synced_tasks: int
    last_synced_at: Optional[str] = None
    last_error: Optional[str] = None


class CalendarSettings(BaseModel):
    enabled: bool


class CalendarSyncResult(BaseModel):
    synced: int
    failed: int
    error: Optional[str] = None


# ---------- checklists ----------
class ChecklistTemplate(BaseModel):
    id: str
    name: str
    department: Optional[Department] = None
    items: list[str]


class ChecklistTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    department: Optional[Department] = None
    items: list[str] = Field(min_length=1, max_length=60)


class ChecklistApply(BaseModel):
    template_id: str


class ChecklistItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class ChecklistToggle(BaseModel):
    done: bool


# ---------- weekly planner ----------
class PlannerCell(BaseModel):
    date: str
    tasks: list[Task]
    open: int
    clash: bool


class PlannerRow(BaseModel):
    user: UserPublic
    cells: list[PlannerCell]
    carried_over: list[Task]
    week_open: int
    clashes: int


class PlannerWeek(BaseModel):
    start: str
    end: str
    today: str
    days: list[str]
    rows: list[PlannerRow]


# ---------- digest email ----------
class DigestEmailStatus(BaseModel):
    connected: bool
    enabled: bool
    recipient: Optional[str] = None
    last_sent_at: Optional[str] = None
    last_error: Optional[str] = None


class DigestEmailSettings(BaseModel):
    enabled: bool


class DigestEmailResult(BaseModel):
    sent: bool
    recipient: Optional[str] = None
    error: Optional[str] = None


TeamMember.model_rebuild()
