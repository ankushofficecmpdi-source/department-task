"""Morning digest of overdue, due-today and blocked work. Fired daily by .emergent/crons.yml."""

import hmac
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from lib import gmail
from lib.auth import require_manager
from lib.dates import today_iso
from lib.db import db
from lib.workflow import is_blocked, is_overdue, latest_note, manager_ids, new_id, notify, now_iso, users_map
from models.schemas import (
    DEPARTMENTS, CronAck, Digest, DigestDepartment, DigestEmailResult, DigestEmailSettings, DigestEmailStatus, DigestItem,
)

router = APIRouter(tags=["digest"])

PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _item(d: dict, users: dict, note: str = "") -> DigestItem:
    return DigestItem(
        task_id=d["id"], title=d["title"], assignee_name=users.get(d["assignee_id"], {}).get("name", "Unassigned"),
        department=d.get("department"), priority=d["priority"], due_date=d["due_date"], progress=d["progress"], note=note,
    )


async def build_digest(trigger: str) -> Digest:
    today = today_iso()
    docs = await db.tasks.find({"status": {"$ne": "done"}}, {"_id": 0}).to_list(5000)
    users = await users_map()
    rank = lambda d: (PRIORITY_RANK[d["priority"]], d["due_date"])  # noqa: E731
    overdue = sorted((d for d in docs if is_overdue(d, today)), key=rank)
    due_today = sorted((d for d in docs if d["due_date"] == today), key=rank)
    blocked = sorted((d for d in docs if is_blocked(d)), key=rank)
    digest = Digest(
        id=new_id(), date=today, generated_at=now_iso(), trigger=trigger,
        overdue=[_item(d, users) for d in overdue],
        due_today=[_item(d, users) for d in due_today],
        blocked=[_item(d, users, (latest_note(d) or {}).get("note", "")) for d in blocked],
        by_department=[
            DigestDepartment(
                department=dep,
                overdue=sum(1 for d in overdue if d.get("department") == dep),
                due_today=sum(1 for d in due_today if d.get("department") == dep),
                blocked=sum(1 for d in blocked if d.get("department") == dep),
            )
            for dep in DEPARTMENTS
        ],
    )
    existing = await db.digests.find_one({"date": today}, {"_id": 0, "id": 1})
    if existing:
        digest.id = existing["id"]
    await db.digests.replace_one({"date": today}, digest.model_dump(), upsert=True)
    summary = f"{len(overdue)} overdue · {len(due_today)} due today · {len(blocked)} blocked"
    for mid in await manager_ids():
        await notify(mid, "digest", f"Morning digest · {today}", summary, None, f"digest:{today}")
    return digest


async def scheduled_digest() -> None:
    """Cron work: build today's digest, then email it if the manager opted in and Gmail is connected."""
    digest = await build_digest("schedule")
    if gmail.connection_id() and (await gmail.get_settings())["enabled"]:
        await gmail.send_digest(digest)


@router.post("/cron/daily-digest", response_model=CronAck, status_code=202)
async def cron_daily_digest(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token.encode(), secret.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        envelope = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid body")
    if not isinstance(envelope, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("x-webhook-id") or envelope.get("run_id") or new_id()
    try:
        await db.cron_runs.insert_one({"run_id": str(run_id), "schedule": "daily-digest", "received_at": now_iso()})
    except DuplicateKeyError:
        return CronAck(status="duplicate")
    background.add_task(scheduled_digest)
    return CronAck(status="accepted")


@router.post("/digests/run", response_model=Digest)
async def run_digest_now(_: dict = Depends(require_manager)):
    return await build_digest("manual")


async def _email_status() -> DigestEmailStatus:
    s = await gmail.get_settings()
    return DigestEmailStatus(connected=bool(gmail.connection_id()), enabled=s["enabled"], recipient=s["recipient"],
                             last_sent_at=s["last_sent_at"], last_error=s["last_error"])


@router.get("/digests/email/status", response_model=DigestEmailStatus)
async def digest_email_status(_: dict = Depends(require_manager)):
    return await _email_status()


@router.put("/digests/email/settings", response_model=DigestEmailStatus)
async def digest_email_settings(body: DigestEmailSettings, _: dict = Depends(require_manager)):
    await gmail.save_settings(enabled=body.enabled)
    return await _email_status()


@router.post("/digests/{digest_date}/email", response_model=DigestEmailResult)
async def email_digest_now(digest_date: str, _: dict = Depends(require_manager)):
    doc = await db.digests.find_one({"date": digest_date}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Digest not found")
    sent, to, error = await gmail.send_digest(Digest(**doc))
    return DigestEmailResult(sent=sent, recipient=to, error=error)


@router.get("/digests", response_model=list[Digest])
async def list_digests(_: dict = Depends(require_manager)):
    docs = await db.digests.find({}, {"_id": 0}).sort("date", -1).to_list(14)
    return [Digest(**d) for d in docs]
