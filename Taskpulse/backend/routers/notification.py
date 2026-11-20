from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, task_scope
from lib.dates import today_iso
from lib.db import db
from lib.workflow import is_due_soon, is_overdue, notify, users_map
from models.schemas import Notification, NotificationList, OkResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def sync_priority_alerts(user: dict) -> None:
    """Create (once each) overdue / due-soon / critical alerts for every open task the user can see."""
    today = today_iso()
    docs = await db.tasks.find({"status": {"$ne": "done"}, **task_scope(user)}, {"_id": 0}).to_list(2000)
    users = await users_map()
    mine = user["role"] != "manager"
    for d in docs:
        who = "Your task" if mine else f"{users.get(d['assignee_id'], {}).get('name', 'Team')}'s task"
        if is_overdue(d, today):
            await notify(user["id"], "overdue", "Task overdue",
                         f"{who} \"{d['title']}\" was due {d['due_date']} ({d['progress']}% done)",
                         d["id"], f"overdue:{d['id']}:{d['due_date']}")
        elif is_due_soon(d, today):
            when = "today" if d["due_date"] == today else "tomorrow"
            await notify(user["id"], "due_soon", f"Due {when}",
                         f"{who} \"{d['title']}\" is due {when} ({d['progress']}% done)",
                         d["id"], f"due_soon:{d['id']}:{d['due_date']}")
        if d["priority"] == "critical":
            await notify(user["id"], "critical", "Critical priority work",
                         f"{who} \"{d['title']}\" is marked critical", d["id"], f"critical:{d['id']}")


@router.get("", response_model=NotificationList)
async def list_notifications(user: dict = Depends(get_current_user)):
    await sync_priority_alerts(user)
    docs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(60)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return NotificationList(items=[Notification(**d) for d in docs], unread=unread)


@router.post("/read-all", response_model=OkResponse)
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return OkResponse()


@router.post("/{notification_id}/read", response_model=OkResponse)
async def read_one(notification_id: str, user: dict = Depends(get_current_user)):
    res = await db.notifications.update_one({"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return OkResponse()
