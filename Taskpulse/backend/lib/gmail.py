"""Email the morning digest from the manager's connected Gmail to their own inbox (env GMAIL_CONNECTION_ID)."""

import base64
import html
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx

from lib.connectors import ConnectorError, call_provider
from lib.db import db
from lib.workflow import now_iso
from models.schemas import Digest, DigestItem

log = logging.getLogger("gmail")
LABEL = "Gmail"
API = "https://gmail.googleapis.com/gmail/v1/users/me"


def connection_id() -> str:
    return os.environ.get("GMAIL_CONNECTION_ID", "").strip()


async def get_settings() -> dict:
    doc = await db.settings.find_one({"key": "digest_email"}, {"_id": 0}) or {}
    return {
        "enabled": doc.get("enabled", True),
        "recipient": doc.get("recipient"),
        "last_sent_at": doc.get("last_sent_at"),
        "last_error": doc.get("last_error"),
    }


async def save_settings(**fields) -> None:
    await db.settings.update_one({"key": "digest_email"}, {"$set": fields}, upsert=True)


async def recipient() -> str:
    """The connected Gmail account's own address (the digest goes to 'my inbox')."""
    r = await call_provider(connection_id(), LABEL, "GET", f"{API}/profile")
    if r.status_code != 200:
        raise ConnectorError("provider_error", f"Gmail profile lookup failed ({r.status_code})")
    email = r.json()["emailAddress"]
    await save_settings(recipient=email)
    return email


def _rows(items: list[DigestItem], show_note: bool = False) -> str:
    if not items:
        return '<p style="color:#64748b;margin:4px 0 0">Nothing here.</p>'
    out = []
    for it in items:
        note = f'<div style="color:#be123c;font-style:italic;margin-top:2px">“{html.escape(it.note)}”</div>' if show_note and it.note else ""
        out.append(
            '<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">'
            f'<b>{html.escape(it.title)}</b> <span style="color:#64748b">· {it.priority.upper()}</span><br>'
            f'<span style="color:#475569">{html.escape(it.assignee_name)} · {html.escape(it.department or "—")} · due {it.due_date} · {it.progress}%</span>'
            f"{note}</td></tr>"
        )
    return f'<table style="width:100%;border-collapse:collapse">{"".join(out)}</table>'


def build_message(d: Digest, to: str, app_url: str) -> str:
    subject = f"Morning digest {d.date}: {len(d.overdue)} overdue · {len(d.due_today)} due today · {len(d.blocked)} blocked"
    dept_rows = "".join(
        f'<tr><td style="padding:4px 12px 4px 0">{html.escape(b.department)}</td>'
        f'<td style="padding:4px 12px">{b.overdue} overdue</td><td style="padding:4px 12px">{b.due_today} due today</td>'
        f'<td style="padding:4px 12px">{b.blocked} blocked</td></tr>'
        for b in d.by_department
    )
    link = f'<p><a href="{html.escape(app_url)}/digest" style="color:#4f46e5">Open the digest in TaskPulse</a></p>' if app_url else ""
    body = f"""<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:640px">
<h2 style="margin:0 0 4px">TaskPulse morning digest</h2><p style="color:#64748b;margin:0 0 16px">{d.date}</p>
<table style="border-collapse:collapse;margin-bottom:16px">{dept_rows}</table>
<h3 style="color:#e11d48;margin:16px 0 0">Overdue ({len(d.overdue)})</h3>{_rows(d.overdue)}
<h3 style="color:#d97706;margin:16px 0 0">Due today ({len(d.due_today)})</h3>{_rows(d.due_today)}
<h3 style="color:#e11d48;margin:16px 0 0">Blocked ({len(d.blocked)})</h3>{_rows(d.blocked, show_note=True)}
{link}</div>"""
    text = "\n".join(
        [f"TaskPulse morning digest — {d.date}", ""]
        + [f"{label} ({len(items)}):" + "".join(f"\n- {i.title} — {i.assignee_name}, due {i.due_date}" for i in items) + "\n"
           for label, items in (("Overdue", d.overdue), ("Due today", d.due_today), ("Blocked", d.blocked))]
    )
    msg = MIMEMultipart("alternative")
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(body, "html", "utf-8"))
    return base64.urlsafe_b64encode(msg.as_bytes()).decode().rstrip("=")


async def send_digest(d: Digest) -> tuple[bool, Optional[str], Optional[str]]:
    """Returns (sent, recipient, error). Never raises."""
    if not connection_id():
        return False, None, "Gmail is not connected"
    try:
        to = await recipient()
        raw = build_message(d, to, os.environ.get("PUBLIC_APP_URL", "").rstrip("/"))
        r = await call_provider(connection_id(), LABEL, "POST", f"{API}/messages/send", json={"raw": raw})
        if r.status_code >= 400:
            raise ConnectorError("provider_error", f"Gmail refused to send the digest ({r.status_code})")
        await save_settings(last_sent_at=now_iso(), last_error=None)
        return True, to, None
    except (ConnectorError, httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("digest email failed: %s", e)
        await save_settings(last_error=str(e)[:300])
        return False, None, str(e)[:300]
