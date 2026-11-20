"""Demo mining team + tasks. Dates are relative to today so overdue / due-soon alerts always show."""

from datetime import date, datetime, timedelta, timezone

from lib.auth import hash_password
from lib.dates import today_iso
from lib.db import db
from lib.workflow import new_id

MANAGER_PASSWORD = "manager123"
MEMBER_PASSWORD = "member123"

OC, UG, ENV, MC = "Opencast Mining", "Underground Mining", "Environment", "Mine Closure"

# id, name, email, role, title, department
USERS = [
    ("u-sarah", "Sarah Chen", "sarah@taskpulse.io", "manager", "General Manager – Mining Operations", None),
    ("u-alex", "Alex Rivera", "alex@taskpulse.io", "member", "Pit Supervisor", OC),
    ("u-priya", "Priya Nair", "priya@taskpulse.io", "member", "Drill & Blast Engineer", OC),
    ("u-carlos", "Carlos Gomez", "carlos@taskpulse.io", "member", "Underground Shift Boss", UG),
    ("u-vikram", "Vikram Singh", "vikram@taskpulse.io", "member", "Ventilation Engineer", UG),
    ("u-maya", "Maya Patel", "maya@taskpulse.io", "member", "Environmental Officer", ENV),
    ("u-elena", "Elena Rostova", "elena@taskpulse.io", "member", "Rehabilitation & Closure Specialist", MC),
]

# title, description, assignee, department, priority, status, progress, due offset (days),
# notes [(author, hours ago, tag, text)] — the most recent note decides "blocked"
TASKS = [
    ("Bench blasting plan – Pit 3 north wall", "Finalise hole pattern, charge weights and exclusion zones for the next blast.",
     "u-priya", OC, "critical", "in_progress", 60, 1,
     [("u-sarah", 72, "milestone", "Blast window confirmed for this week — top priority."),
      ("u-priya", 20, "progress", "Pattern designed; awaiting geotech sign-off on wall stability.")]),
    ("Haul road maintenance & dust suppression", "Grade ramp 2 and restore water-cart schedule on the main haul road.",
     "u-alex", OC, "high", "in_progress", 40, -2,
     [("u-alex", 30, "blocker", "Water bowser down for repair — dust suppression paused on ramp 2.")]),
    ("Overburden dump stability inspection", "Visual inspection and prism survey review on dump 4 lifts.",
     "u-alex", OC, "medium", "todo", 0, 5, []),
    ("Monthly survey reconciliation", "Reconcile mined volumes against plan for the month-end report.",
     "u-priya", OC, "low", "done", 100, -3,
     [("u-priya", 80, "milestone", "Reconciliation submitted — variance within 2%.")]),
    ("Ventilation survey – Level 4 drives", "Airflow and gas readings across Level 4 headings after the fan upgrade.",
     "u-vikram", UG, "critical", "review", 90, -1,
     [("u-vikram", 18, "review", "Survey complete; report uploaded for review.")]),
    ("Ground support audit – decline ramp", "Check rock bolts, mesh and shotcrete condition along the decline.",
     "u-carlos", UG, "high", "in_progress", 55, 0,
     [("u-carlos", 10, "progress", "First 400 m audited; two bolts flagged for replacement.")]),
    ("Refuge chamber inspection & restock", "Inspect seals, oxygen supply and rations in all refuge chambers.",
     "u-carlos", UG, "critical", "todo", 10, 0, []),
    ("Gas monitoring sensor calibration", "Calibrate CH4/CO sensors on Levels 3–5.",
     "u-vikram", UG, "medium", "in_progress", 30, 1,
     [("u-vikram", 6, "blocker", "Calibration gas cylinders not delivered yet — chasing supplier.")]),
    ("Quarterly groundwater sampling", "Collect and dispatch samples from the 12 monitoring bores.",
     "u-maya", ENV, "high", "in_progress", 70, 0,
     [("u-maya", 14, "progress", "8 of 12 bores sampled; remaining bores scheduled for today.")]),
    ("Dust & noise monitoring report to regulator", "Compile monthly monitoring data and submit the compliance report.",
     "u-maya", ENV, "critical", "todo", 15, 3, []),
    ("Tailings dam freeboard check", "Weekly freeboard measurement and seepage inspection.",
     "u-maya", ENV, "medium", "done", 100, -5,
     [("u-maya", 120, "milestone", "Freeboard within limits; no seepage observed.")]),
    ("Progressive rehabilitation – Waste dump 2", "Topsoil spreading and contour ripping on the completed dump face.",
     "u-elena", MC, "high", "in_progress", 45, 6,
     [("u-elena", 26, "progress", "Topsoil spread on 3.5 ha of 8 ha.")]),
    ("Update mine closure cost estimate", "Revise closure liability estimate for the annual submission.",
     "u-elena", MC, "medium", "review", 85, 4, []),
    ("Native seed procurement for revegetation", "Source local native seed mix for the next planting season.",
     "u-elena", MC, "low", "todo", 0, 12, []),
]


TEMPLATES = [
    ("Refuge chamber inspection", UG, ["Door seals intact and closing", "Compressed air supply pressure checked",
     "Oxygen cylinders within service date", "Water and rations stocked", "Communication line tested",
     "First-aid kit complete", "Signage and lighting working"]),
    ("Ventilation survey", UG, ["Main fan running at rated duty", "Airflow measured at each heading",
     "CH4 / CO readings recorded", "Regulators and ventilation doors checked", "Auxiliary fans and ducting inspected",
     "Results logged on the ventilation plan"]),
    ("Ground support audit", UG, ["Rock bolts pull-tested", "Mesh and straps condition checked",
     "Shotcrete cracking / spalling inspected", "Loose rock scaled", "Convergence monitoring reviewed",
     "Defects tagged and reported"]),
    ("Pre-blast safety checks", OC, ["Blast plan approved and signed", "Exclusion zone barricaded and guarded",
     "Sirens and radios tested", "Personnel and equipment cleared", "Misfire procedure briefed",
     "Post-blast inspection completed"]),
    ("Environmental sampling", ENV, ["Sampling equipment calibrated", "Chain-of-custody forms prepared",
     "Samples labelled and chilled", "Field parameters recorded (pH, EC, temp)", "Samples dispatched to the lab"]),
    ("Tailings dam inspection", ENV, ["Freeboard measured", "Seepage points checked", "Embankment erosion inspected",
     "Decant system operating", "Piezometer readings recorded"]),
]

# task title -> (template name, number of items already ticked)
TASK_CHECKLISTS = {
    "Refuge chamber inspection & restock": ("Refuge chamber inspection", 1),
    "Ventilation survey – Level 4 drives": ("Ventilation survey", 5),
    "Ground support audit – decline ramp": ("Ground support audit", 3),
    "Bench blasting plan – Pit 3 north wall": ("Pre-blast safety checks", 2),
    "Quarterly groundwater sampling": ("Environmental sampling", 3),
    "Tailings dam freeboard check": ("Tailings dam inspection", 5),
}


async def seed_templates() -> None:
    if await db.checklist_templates.count_documents({}) > 0:
        return
    for name, dept, items in TEMPLATES:
        await db.checklist_templates.insert_one({"id": new_id(), "name": name, "department": dept, "items": items})


def _checklist(title: str, assignee_name: str) -> list[dict]:
    if title not in TASK_CHECKLISTS:
        return []
    tpl_name, ticked = TASK_CHECKLISTS[title]
    items = next(i for n, _, i in TEMPLATES if n == tpl_name)
    return [{"id": new_id(), "text": t, "done": k < ticked, "done_by_name": assignee_name if k < ticked else None,
             "done_at": _ago(30 - k) if k < ticked else None} for k, t in enumerate(items)]


def _ago(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


async def seed(reset: bool = False) -> bool:
    """Seed demo data. Without reset it only runs on an empty users collection. Returns True if seeded."""
    if not reset and await db.users.count_documents({}) > 0:
        return False
    if reset:  # only the explicit `python seed.py` command wipes demo collections
        for coll in ("users", "tasks", "notifications", "activity", "digests", "checklist_templates"):
            await db[coll].delete_many({})

    names = {}
    for uid, name, email, role, title, dept in USERS:
        pw = MANAGER_PASSWORD if role == "manager" else MEMBER_PASSWORD
        names[uid] = name
        await db.users.insert_one({"id": uid, "name": name, "email": email, "role": role, "title": title,
                                   "department": dept, "password_hash": hash_password(pw), "created_at": _ago(720)})

    today = date.fromisoformat(today_iso())
    for i, (title, desc, assignee, dept, prio, status, progress, offset, notes) in enumerate(TASKS):
        tid = new_id()
        created = _ago(24 * (8 + i % 4))
        note_docs = [{"id": new_id(), "author_id": a, "author_name": names[a], "note": text, "tag": tag,
                      "progress": progress, "status": status, "created_at": _ago(h)} for a, h, tag, text in notes]
        await db.tasks.insert_one({
            "id": tid, "title": title, "description": desc, "assignee_id": assignee, "department": dept,
            "priority": prio, "status": status, "progress": progress,
            "due_date": (today + timedelta(days=offset)).isoformat(),
            "created_by": "u-sarah", "created_at": created,
            "updated_at": note_docs[-1]["created_at"] if note_docs else created, "notes": note_docs,
            "checklist": _checklist(title, names[assignee]),
        })
        await db.activity.insert_one({"id": new_id(), "actor_id": "u-sarah", "actor_name": names["u-sarah"],
                                      "task_id": tid, "task_title": title, "assignee_id": assignee, "kind": "created",
                                      "message": f"assigned \"{title}\" to {names[assignee]}", "created_at": created})
        for n in note_docs:
            verb = "flagged a blocker on" if n["tag"] == "blocker" else "posted an update on"
            await db.activity.insert_one({"id": new_id(), "actor_id": n["author_id"], "actor_name": n["author_name"],
                                          "task_id": tid, "task_title": title, "assignee_id": assignee, "kind": "note",
                                          "message": f"{verb} \"{title}\": {n['note']}", "created_at": n["created_at"]})
    await seed_templates()
    return True
