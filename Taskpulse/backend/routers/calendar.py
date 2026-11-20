from fastapi import APIRouter, Depends

from lib import gcal
from lib.auth import require_manager
from lib.db import db
from models.schemas import CalendarSettings, CalendarStatus, CalendarSyncResult

router = APIRouter(prefix="/calendar", tags=["calendar"])


async def _status() -> CalendarStatus:
    s = await gcal.get_settings()
    synced = await db.tasks.count_documents({"calendar_event_id": {"$exists": True, "$ne": None}})
    return CalendarStatus(
        connected=bool(gcal.connection_id()),
        enabled=s["enabled"],
        synced_tasks=synced,
        last_synced_at=s["last_synced_at"],
        last_error=s["last_error"],
    )


@router.get("/status", response_model=CalendarStatus)
async def calendar_status(_: dict = Depends(require_manager)):
    return await _status()


@router.put("/settings", response_model=CalendarStatus)
async def calendar_settings(body: CalendarSettings, _: dict = Depends(require_manager)):
    await gcal.save_settings(enabled=body.enabled)
    return await _status()


@router.post("/sync", response_model=CalendarSyncResult)
async def sync_all(_: dict = Depends(require_manager)):
    """Manager-triggered: push every open task (and done tasks already on the calendar) to Google Calendar."""
    if not await gcal.ready():
        return CalendarSyncResult(synced=0, failed=0, error="Calendar sync is off or Google Calendar is not connected")
    docs = await db.tasks.find(
        {"$or": [{"status": {"$ne": "done"}}, {"calendar_event_id": {"$exists": True, "$ne": None}}]},
        {"_id": 0, "id": 1},
    ).to_list(2000)
    ok = 0
    for d in docs:
        ok += 1 if await gcal.sync_task(d["id"]) else 0
    s = await gcal.get_settings()
    return CalendarSyncResult(synced=ok, failed=len(docs) - ok, error=s["last_error"] if ok < len(docs) else None)
