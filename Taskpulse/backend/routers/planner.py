from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import get_current_user
from lib.dates import today_iso
from lib.db import db
from lib.workflow import to_task, users_map
from models.schemas import DATE_PATTERN, Department, PlannerCell, PlannerRow, PlannerWeek, UserPublic

router = APIRouter(tags=["planner"])


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/planner", response_model=PlannerWeek)
async def planner(
    start: Optional[str] = Query(default=None, pattern=DATE_PATTERN),
    department: Optional[Department] = None,
    user: dict = Depends(get_current_user),
):
    """Week view (Mon–Sun) of each member's tasks by due date. Clash = 2+ open tasks due the same day."""
    today = today_iso()
    try:
        week_start = _monday(date.fromisoformat(start or today))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid start date")
    days = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
    users = await users_map()
    if user["role"] == "manager":
        people = [u for u in users.values() if u["role"] == "member" and (not department or u.get("department") == department)]
    else:
        people = [user]
    ids = [u["id"] for u in people]
    q: dict = {"assignee_id": {"$in": ids}, "$or": [{"due_date": {"$gte": days[0], "$lte": days[-1]}},
                                                   {"status": {"$ne": "done"}, "due_date": {"$lt": days[0]}}]}
    if department:
        q["department"] = department
    docs = await db.tasks.find(q, {"_id": 0}).to_list(5000)
    rows = []
    for u in sorted(people, key=lambda u: (u.get("department") or "", u["name"])):
        mine = [to_task(d, users, today) for d in docs if d["assignee_id"] == u["id"]]
        cells = []
        for day in days:
            tasks = [t for t in mine if t.due_date == day]
            open_count = sum(1 for t in tasks if t.status != "done")
            cells.append(PlannerCell(date=day, tasks=tasks, open=open_count, clash=open_count >= 2))
        carried = [t for t in mine if t.due_date < days[0] and t.status != "done"]
        rows.append(PlannerRow(
            user=UserPublic(**u), cells=cells, carried_over=carried,
            week_open=sum(c.open for c in cells), clashes=sum(1 for c in cells if c.clash),
        ))
    return PlannerWeek(start=days[0], end=days[-1], today=today, days=days, rows=rows)
