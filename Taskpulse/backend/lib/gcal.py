"""Google Calendar sync through the user's Emergent connector (googlecalendar).

Each open task becomes an all-day event on the manager's connected primary calendar on its due date,
with the assignee invited by email (sendUpdates=all). The provider token stays in memory only.
"""

import logging
import os
from datetime import date, timedelta
from typing import Optional

import httpx

from lib import connectors
from lib.connectors import ConnectorError
from lib.db import db
from lib.workflow import now_iso

log = logging.getLogger("gcal")

EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
CALENDAR_FIELDS = {"title", "description", "due_date", "assignee_id", "priority", "department"}


def connection_id() -> str:
    return os.environ.get("GOOGLE_CALENDAR_CONNECTION_ID", "").strip()


async def call_provider(cid: str, method: str, url: str, **kwargs) -> httpx.Response:
    return await connectors.call_provider(cid, "Google Calendar", method, url, **kwargs)


async def get_settings() -> dict:
    doc = await db.settings.find_one({"key": "calendar"}, {"_id": 0}) or {}
    return {
        "enabled": doc.get("enabled", False),  # off until the manager switches it on in the app
        "last_error": doc.get("last_error"),
        "last_synced_at": doc.get("last_synced_at"),
    }


async def save_settings(**fields) -> None:
    await db.settings.update_one({"key": "calendar"}, {"$set": fields}, upsert=True)


async def ready() -> bool:
    return bool(connection_id()) and (await get_settings())["enabled"]


def _event_body(task: dict, assignee: Optional[dict]) -> dict:
    due = date.fromisoformat(task["due_date"])
    done = task["status"] == "done"
    prefix = "[DONE] " if done else f"[{task['priority'].upper()}] "
    lines = [
        f"Assignee: {assignee['name'] if assignee else 'Unassigned'}",
        f"Department: {task.get('department') or '—'}",
        f"Priority: {task['priority'].title()} · Status: {task['status'].replace('_', ' ').title()} · Progress: {task['progress']}%",
    ]
    if task.get("description"):
        lines += ["", task["description"]]
    lines += ["", "Synced from TaskPulse"]
    return {
        "summary": f"{prefix}{task['title']} (due)",
        "description": "\n".join(lines),
        "start": {"date": due.isoformat()},
        "end": {"date": (due + timedelta(days=1)).isoformat()},
        "transparency": "transparent",
        "attendees": [{"email": assignee["email"]}] if assignee and assignee.get("email") else [],
    }


async def sync_task(task_id: str) -> bool:
    """Create or update the calendar event for one task. Never raises; records the last error."""
    if not await ready():
        return False
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        return False
    assignee = await db.users.find_one({"id": task["assignee_id"]}, {"_id": 0, "name": 1, "email": 1})
    body = _event_body(task, assignee)
    cid = connection_id()
    try:
        event_id = task.get("calendar_event_id")
        r: Optional[httpx.Response] = None
        if event_id:
            r = await call_provider(cid, "PATCH", f"{EVENTS_URL}/{event_id}", params={"sendUpdates": "all"}, json=body)
            if r.status_code in (404, 410):
                event_id = None
        if not event_id:
            r = await call_provider(cid, "POST", EVENTS_URL, params={"sendUpdates": "all"}, json=body)
        assert r is not None
        if r.status_code >= 400:
            raise ConnectorError("provider_error", f"Google Calendar returned {r.status_code}")
        await db.tasks.update_one({"id": task_id}, {"$set": {"calendar_event_id": r.json()["id"]}})
        await save_settings(last_error=None, last_synced_at=now_iso())
        return True
    except (ConnectorError, httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("calendar sync failed for task %s: %s", task_id, e)
        await save_settings(last_error=str(e)[:300])
        return False


async def delete_event(event_id: Optional[str]) -> None:
    if not event_id or not await ready():
        return
    try:
        await call_provider(connection_id(), "DELETE", f"{EVENTS_URL}/{event_id}", params={"sendUpdates": "all"})
    except (ConnectorError, httpx.HTTPError) as e:
        log.warning("calendar delete failed for event %s: %s", event_id, e)
