from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from lib import gcal

from lib.auth import MEMBER_EDITABLE_FIELDS, get_current_user, require_manager, task_scope
from lib.dates import today_iso
from lib.db import db
from lib.workflow import (
    log_activity,
    new_id,
    notify,
    notify_managers,
    now_iso,
    to_task,
    users_map,
)
from models.schemas import Department, NoteCreate, OkResponse, Priority, Status, Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

STATUS_LABEL = {"todo": "To do", "in_progress": "In progress", "review": "In review", "done": "Done"}


async def _get_scoped(task_id: str, user: dict) -> dict:
    doc = await db.tasks.find_one({"id": task_id, **task_scope(user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return doc


async def _respond(task_id: str) -> Task:
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return to_task(doc, await users_map(), today_iso())


async def _require_user(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=422, detail="Assignee does not exist")
    return u


@router.get("", response_model=list[Task])
async def list_tasks(
    assignee_id: Optional[str] = None,
    status: Optional[Status] = None,
    priority: Optional[Priority] = None,
    department: Optional[Department] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if department:
        q["department"] = department
    if assignee_id:
        q["assignee_id"] = assignee_id
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority
    q.update(task_scope(user))  # scope applied last so a filter can never widen visibility
    docs = await db.tasks.find(q, {"_id": 0}).sort("due_date", 1).to_list(2000)
    users, today = await users_map(), today_iso()
    return [to_task(d, users, today) for d in docs]


@router.post("", response_model=Task, status_code=201)
async def create_task(body: TaskCreate, background: BackgroundTasks, manager: dict = Depends(require_manager)):
    assignee = await _require_user(body.assignee_id)
    data = body.model_dump()
    data["department"] = data["department"] or assignee.get("department")
    if data["status"] == "done":
        data["progress"] = 100
    ts = now_iso()
    doc = {"id": new_id(), **data, "created_by": manager["id"], "created_at": ts, "updated_at": ts, "notes": []}
    await db.tasks.insert_one(doc)
    await log_activity(manager, doc, "created", f"assigned \"{doc['title']}\" to {assignee['name']}")
    if assignee["id"] != manager["id"]:
        crit = doc["priority"] == "critical"
        await notify(
            assignee["id"],
            "critical" if crit else "assigned",
            "Critical task assigned" if crit else "New task assigned",
            f"{manager['name']} assigned you \"{doc['title']}\" — due {doc['due_date']}",
            doc["id"],
        )
    background.add_task(gcal.sync_task, doc["id"])
    return await _respond(doc["id"])


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    doc = await _get_scoped(task_id, user)
    return to_task(doc, await users_map(), today_iso())


@router.patch("/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    doc = await _get_scoped(task_id, user)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if user["role"] != "manager" and set(changes) - MEMBER_EDITABLE_FIELDS:
        raise HTTPException(status_code=403, detail="Members can only update status and progress")
    if "assignee_id" in changes:
        await _require_user(changes["assignee_id"])
    # keep status and progress coherent
    if changes.get("status") == "done":
        changes["progress"] = 100
    elif "progress" in changes and "status" not in changes:
        if changes["progress"] == 100 and doc["status"] in ("todo", "in_progress"):
            changes["status"] = "review"
        elif changes["progress"] > 0 and doc["status"] == "todo":
            changes["status"] = "in_progress"
    changes = {k: v for k, v in changes.items() if doc.get(k) != v}
    if not changes:
        return to_task(doc, await users_map(), today_iso())

    changes["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": changes})
    updated = {**doc, **changes}
    status_flip = "status" in changes and "done" in (changes["status"], doc["status"])
    if gcal.CALENDAR_FIELDS & set(changes) or status_flip:
        background.add_task(gcal.sync_task, task_id)

    parts = []
    if "status" in changes:
        parts.append(f"moved to {STATUS_LABEL[changes['status']]}")
    if "progress" in changes:
        parts.append(f"progress {doc['progress']}% → {changes['progress']}%")
    for f in ("priority", "due_date", "title", "description", "department"):
        if f in changes:
            parts.append(f"{f.replace('_', ' ')} updated")
    if "assignee_id" in changes:
        parts.append("reassigned")
    summary = ", ".join(parts)
    await log_activity(user, updated, "updated", f"updated \"{updated['title']}\": {summary}")

    if user["role"] != "manager":
        await notify_managers(user, "update", f"{user['name']} updated a task", f"\"{updated['title']}\": {summary}", task_id)
    elif "assignee_id" in changes and changes["assignee_id"] != user["id"]:
        await notify(changes["assignee_id"], "assigned", "Task assigned to you",
                     f"{user['name']} assigned you \"{updated['title']}\" — due {updated['due_date']}", task_id)
    elif updated["assignee_id"] != user["id"]:
        await notify(updated["assignee_id"], "update", "Your task was updated",
                     f"{user['name']} updated \"{updated['title']}\": {summary}", task_id)
    return await _respond(task_id)


@router.delete("/{task_id}", response_model=OkResponse)
async def delete_task(task_id: str, background: BackgroundTasks, manager: dict = Depends(require_manager)):
    doc = await _get_scoped(task_id, manager)
    background.add_task(gcal.delete_event, doc.get("calendar_event_id"))
    await db.tasks.delete_one({"id": task_id})
    await db.notifications.delete_many({"task_id": task_id})
    await log_activity(manager, doc, "deleted", f"deleted \"{doc['title']}\"")
    return OkResponse()


@router.post("/{task_id}/notes", response_model=Task, status_code=201)
async def add_note(task_id: str, body: NoteCreate, user: dict = Depends(get_current_user)):
    doc = await _get_scoped(task_id, user)
    note = {
        "id": new_id(),
        "author_id": user["id"],
        "author_name": user["name"],
        "note": body.note.strip(),
        "tag": body.tag,
        "progress": doc["progress"],
        "status": doc["status"],
        "created_at": now_iso(),
    }
    await db.tasks.update_one({"id": task_id}, {"$push": {"notes": note}, "$set": {"updated_at": note["created_at"]}})
    label = "flagged a blocker on" if body.tag == "blocker" else "posted an update on"
    await log_activity(user, doc, "note", f"{label} \"{doc['title']}\": {note['note'][:140]}")
    kind = "blocker" if body.tag == "blocker" else "update"
    title = f"Blocker flagged by {user['name']}" if body.tag == "blocker" else f"New update from {user['name']}"
    if user["role"] != "manager":
        await notify_managers(user, kind, title, f"\"{doc['title']}\": {note['note'][:140]}", task_id)
    elif doc["assignee_id"] != user["id"]:
        await notify(doc["assignee_id"], kind, f"Note from {user['name']}", f"\"{doc['title']}\": {note['note'][:140]}", task_id)
    return await _respond(task_id)


@router.post("/{task_id}/nudge", response_model=OkResponse)
async def nudge(task_id: str, manager: dict = Depends(require_manager)):
    doc = await _get_scoped(task_id, manager)
    await notify(
        doc["assignee_id"], "nudge", f"Nudge from {manager['name']}",
        f"Please prioritise \"{doc['title']}\" — due {doc['due_date']}, currently {doc['progress']}%", task_id,
    )
    await log_activity(manager, doc, "nudge", f"nudged the assignee on \"{doc['title']}\"")
    return OkResponse()
