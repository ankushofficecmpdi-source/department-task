"""Shared task helpers: serialization, due-date flags, activity log, notifications."""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from lib.db import db
from models.schemas import Task


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def tomorrow_of(today: str) -> str:
    return (date.fromisoformat(today) + timedelta(days=1)).isoformat()


def is_overdue(doc: dict, today: str) -> bool:
    return doc["status"] != "done" and doc["due_date"] < today


def is_due_soon(doc: dict, today: str) -> bool:
    return doc["status"] != "done" and today <= doc["due_date"] <= tomorrow_of(today)


def latest_note(doc: dict) -> Optional[dict]:
    notes = doc.get("notes") or []
    return max(notes, key=lambda n: n["created_at"]) if notes else None


def is_blocked(doc: dict) -> bool:
    """Blocked = open task whose most recent update is a blocker note."""
    n = latest_note(doc)
    return doc["status"] != "done" and bool(n) and n["tag"] == "blocker"  # type: ignore[index]


WEIGHTS = {"critical": 3.0, "high": 2.0, "medium": 1.0, "low": 0.5}


def capacity_for(user: dict, docs: list[dict], today: str):
    """Load score: open tasks weighted by priority (review counts half), +1 per overdue task."""
    from models.schemas import MemberCapacity

    week_end = (date.fromisoformat(today) + timedelta(days=7)).isoformat()
    mine = [d for d in docs if d["assignee_id"] == user["id"] and d["status"] != "done"]
    score = sum(WEIGHTS[d["priority"]] * (0.5 if d["status"] == "review" else 1.0) for d in mine)
    overdue = sum(1 for d in mine if is_overdue(d, today))
    score += overdue
    level = "available" if score <= 3 else "balanced" if score <= 6 else "stretched"
    return MemberCapacity(
        user_id=user["id"], name=user["name"], title=user.get("title", ""), department=user.get("department"),
        open_tasks=len(mine), critical_high=sum(1 for d in mine if d["priority"] in ("critical", "high")),
        overdue=overdue, due_this_week=sum(1 for d in mine if d["due_date"] <= week_end),
        load_score=round(score, 1), load_pct=min(100, round(score * 100 / 9)), level=level,
    )


async def users_map() -> dict[str, dict]:
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return {u["id"]: u for u in users}


def to_task(doc: dict, users: dict[str, dict], today: str) -> Task:
    assignee = users.get(doc["assignee_id"], {})
    creator = users.get(doc.get("created_by", ""), {})
    notes = sorted(doc.get("notes", []), key=lambda n: n["created_at"], reverse=True)
    return Task(
        **{k: v for k, v in doc.items() if k not in ("_id", "notes", "calendar_event_id")},
        notes=notes,
        assignee_name=assignee.get("name", "Unassigned"),
        created_by_name=creator.get("name", "—"),
        is_overdue=is_overdue(doc, today),
        is_due_soon=is_due_soon(doc, today),
        is_blocked=is_blocked(doc),
        on_calendar=bool(doc.get("calendar_event_id")),
    )


async def log_activity(actor: dict, task: Optional[dict], kind: str, message: str) -> None:
    await db.activity.insert_one(
        {
            "id": new_id(),
            "actor_id": actor["id"],
            "actor_name": actor["name"],
            "task_id": task["id"] if task else None,
            "task_title": task["title"] if task else "",
            "assignee_id": task["assignee_id"] if task else None,  # scoping key for members
            "kind": kind,
            "message": message,
            "created_at": now_iso(),
        }
    )


async def notify(
    user_id: str, kind: str, title: str, message: str, task_id: Optional[str], dedupe_key: Optional[str] = None
) -> None:
    """Insert a notification. With a dedupe_key it is created at most once per (user, key)."""
    nid = new_id()
    doc = {
        "id": nid,
        "user_id": user_id,
        "kind": kind,
        "title": title,
        "message": message,
        "task_id": task_id,
        "read": False,
        "created_at": now_iso(),
        "dedupe_key": dedupe_key or nid,
    }
    await db.notifications.update_one(
        {"user_id": user_id, "dedupe_key": doc["dedupe_key"]}, {"$setOnInsert": doc}, upsert=True
    )


async def manager_ids() -> list[str]:
    docs = await db.users.find({"role": "manager"}, {"_id": 0, "id": 1}).to_list(100)
    return [d["id"] for d in docs]


async def notify_managers(actor: dict, kind: str, title: str, message: str, task_id: str) -> None:
    for mid in await manager_ids():
        if mid != actor["id"]:
            await notify(mid, kind, title, message, task_id)
