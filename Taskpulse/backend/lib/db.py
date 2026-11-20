"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("role", ASCENDING)], name="role"),
    ],
    "tasks": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("assignee_id", ASCENDING), ("due_date", ASCENDING)], name="assignee_due"),
        IndexModel([("status", ASCENDING), ("due_date", ASCENDING)], name="status_due"),
        IndexModel([("due_date", ASCENDING)], name="due"),
        IndexModel([("department", ASCENDING), ("due_date", ASCENDING)], name="dept_due"),
    ],
    "notifications": [
        IndexModel([("user_id", ASCENDING), ("dedupe_key", ASCENDING)], name="user_dedupe", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("task_id", ASCENDING)], name="task"),
    ],
    "activity": [
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
        IndexModel([("assignee_id", ASCENDING), ("created_at", DESCENDING)], name="assignee_created"),
    ],
    "digests": [IndexModel([("date", DESCENDING)], name="date", unique=True)],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
    "checklist_templates": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "settings": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
