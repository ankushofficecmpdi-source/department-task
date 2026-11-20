from typing import Optional

from fastapi import APIRouter, Depends

from lib.auth import activity_scope, get_current_user, require_manager, task_scope
from lib.dates import today_iso
from lib.db import db
from lib.workflow import capacity_for, is_blocked, is_due_soon, is_overdue, to_task, users_map
from models.schemas import (
    DEPARTMENTS,
    Activity,
    DashboardSummary,
    Department,
    DepartmentStats,
    MemberCapacity,
    MemberWorkload,
    TeamMember,
    UserPublic,
)

router = APIRouter(tags=["dashboard"])

PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _workload(user: dict, docs: list[dict], today: str) -> MemberWorkload:
    mine = [d for d in docs if d["assignee_id"] == user["id"]]
    return MemberWorkload(
        user_id=user["id"],
        name=user["name"],
        title=user.get("title", ""),
        department=user.get("department"),
        assigned=len(mine),
        active=sum(1 for d in mine if d["status"] != "done"),
        completed=sum(1 for d in mine if d["status"] == "done"),
        overdue=sum(1 for d in mine if is_overdue(d, today)),
        critical=sum(1 for d in mine if d["priority"] == "critical" and d["status"] != "done"),
        avg_progress=round(sum(d["progress"] for d in mine) / len(mine), 1) if mine else 0.0,
    )


def _department_stats(dep: str, docs: list[dict], users: dict, today: str) -> DepartmentStats:
    mine = [d for d in docs if d.get("department") == dep]
    names = sorted({u["name"] for u in users.values() if u.get("department") == dep})
    return DepartmentStats(
        department=dep,  # type: ignore[arg-type]
        members=names,
        total=len(mine),
        open=sum(1 for d in mine if d["status"] != "done"),
        done=sum(1 for d in mine if d["status"] == "done"),
        overdue=sum(1 for d in mine if is_overdue(d, today)),
        due_soon=sum(1 for d in mine if is_due_soon(d, today)),
        blocked=sum(1 for d in mine if is_blocked(d)),
        critical_open=sum(1 for d in mine if d["priority"] == "critical" and d["status"] != "done"),
        avg_progress=round(sum(d["progress"] for d in mine) / len(mine), 1) if mine else 0.0,
    )


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(department: Optional[Department] = None, user: dict = Depends(get_current_user)):
    today = today_iso()
    q: dict = {"department": department} if department else {}
    q.update(task_scope(user))
    docs = await db.tasks.find(q, {"_id": 0}).to_list(5000)
    users = await users_map()
    tasks = [to_task(d, users, today) for d in docs]
    open_tasks = [t for t in tasks if t.status != "done"]
    by_urgency = lambda t: (PRIORITY_RANK[t.priority], t.due_date)  # noqa: E731
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == "done")
    if user["role"] == "manager":
        people = [u for u in users.values() if u["role"] == "member" and (not department or u.get("department") == department)]
    else:
        people = [user]
    visible_users = users if user["role"] == "manager" else {user["id"]: user}
    return DashboardSummary(
        today=today,
        total=total,
        todo=sum(1 for t in tasks if t.status == "todo"),
        in_progress=sum(1 for t in tasks if t.status == "in_progress"),
        review=sum(1 for t in tasks if t.status == "review"),
        done=done,
        critical_high=sum(1 for t in open_tasks if t.priority in ("critical", "high")),
        overdue=sum(1 for t in tasks if t.is_overdue),
        due_soon=sum(1 for t in tasks if t.is_due_soon),
        blocked=sum(1 for t in tasks if t.is_blocked),
        avg_progress=round(sum(t.progress for t in tasks) / total, 1) if total else 0.0,
        completion_rate=round(done * 100 / total, 1) if total else 0.0,
        workload=sorted((_workload(u, docs, today) for u in people), key=lambda w: w.name),
        departments=[_department_stats(dep, docs, visible_users, today) for dep in DEPARTMENTS
                     if not department or dep == department],
        alerts_overdue=sorted((t for t in tasks if t.is_overdue), key=lambda t: t.due_date),
        alerts_due_soon=sorted((t for t in tasks if t.is_due_soon), key=by_urgency),
        alerts_critical=sorted((t for t in open_tasks if t.priority == "critical"), key=lambda t: t.due_date),
    )


@router.get("/team", response_model=list[TeamMember])
async def team(department: Optional[Department] = None, _: dict = Depends(require_manager)):
    today = today_iso()
    docs = await db.tasks.find({}, {"_id": 0}).sort("due_date", 1).to_list(5000)
    users = await users_map()
    members = [u for u in users.values() if u["role"] == "member" and (not department or u.get("department") == department)]
    out = []
    for u in sorted(members, key=lambda u: (u.get("department") or "", u["name"])):
        mine = [to_task(d, users, today) for d in docs if d["assignee_id"] == u["id"]]
        out.append(TeamMember(user=UserPublic(**u), stats=_workload(u, docs, today),
                              capacity=capacity_for(u, docs, today), tasks=mine))
    return out


@router.get("/capacity", response_model=list[MemberCapacity])
async def capacity(department: Optional[Department] = None, _: dict = Depends(require_manager)):
    """Workload balancer: members sorted from most to least spare capacity."""
    today = today_iso()
    docs = await db.tasks.find({"status": {"$ne": "done"}}, {"_id": 0}).to_list(5000)
    q: dict = {"role": "member"}
    if department:
        q["department"] = department
    members = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    rows = [capacity_for(u, docs, today) for u in members]
    return sorted(rows, key=lambda c: (c.load_score, c.name))


@router.get("/activity", response_model=list[Activity])
async def activity(limit: int = 60, user: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 200))
    docs = await db.activity.find(activity_scope(user), {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Activity(**d) for d in docs]
