# TaskPulse — Team Work Oversight (SPEC)

## What it does
Manager dashboard to assign work to team members, track status/progress, and get notified about priority work
(overdue, due today/tomorrow, critical). Team members log in to see and update only their own tasks.

## Roles & auth
- Session = httpOnly JWT cookie `tp_session` (POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me).
- manager: sees all tasks; creates/edits/deletes/reassigns tasks; nudges assignees; adds team members; Team page.
- member: sees ONLY tasks assigned to them (others → 404); can change status + progress (other fields → 403) and post notes.
  Create/delete/nudge/team/add-member → 403. Team page hidden & redirects to /.
- Credentials: memory/test_credentials.md

## Data model (Mongo, string uuid ids)
- users {id, name, email, role, title, password_hash}
- tasks {id, title, description, assignee_id, priority low|medium|high|critical, status todo|in_progress|review|done,
  progress 0-100, due_date YYYY-MM-DD, created_by, created_at, updated_at, notes[{id, author_id, author_name, note,
  tag progress|blocker|milestone|review, progress, status, created_at}]}. API adds assignee_name, created_by_name, is_overdue, is_due_soon.
- notifications {id, user_id, kind assigned|update|nudge|overdue|due_soon|critical|blocker, title, message, task_id, read, dedupe_key}
- activity {id, actor_id, actor_name, task_id, task_title, assignee_id, kind, message, created_at}

## Rules
- Overdue = due_date < today (server, UTC) and status != done. Due soon = due today or tomorrow, not done.
- status=done forces progress=100; progress>0 on a todo task → in_progress; progress=100 on todo/in_progress → review.
- GET /api/notifications lazily creates (deduped) overdue/due_soon/critical alerts for visible open tasks.
- Member update/note → managers notified. Manager create/assign/update/note/nudge → assignee notified.
- Frontend polls dashboard/tasks/activity every 30s, notifications every 20s; new alerts toast.

## Endpoints (/api)
auth/login, auth/logout, auth/me · GET/POST users · GET/POST tasks · GET/PATCH/DELETE tasks/{id} ·
POST tasks/{id}/notes · POST tasks/{id}/nudge · GET notifications · POST notifications/read-all ·
POST notifications/{id}/read · GET dashboard · GET team (manager) · GET activity

## Pages
/login · / Overview (stats, priority action center tabs, status donut, workload bars, latest updates) ·
/board Kanban (drag & drop, filters, search) · /team (manager) · /activity. Task detail dialog via `?task=<id>`,
new task dialog via `?new=1` or `?new=<assignee_id>`.

## Seed (backend/lib/seed_data.py; auto-seeds empty DB on startup; reset with `python seed.py`)
1 manager + 4 members, 12 tasks with due dates relative to today: 2 overdue (Redis cache bug – Carlos, critical, review;
Quarterly API usage report – Alex, medium), 3 due soon (Stripe migration – Alex critical due tomorrow; Design token audit – Maya due today;
Load test – Elena due tomorrow), 3 critical open, 2 done.

## v2 additions
- Departments: Opencast Mining, Underground Mining, Environment, Mine Closure. users.department (members) and
  tasks.department (defaults to the assignee's). `?department=` filter on GET /tasks, /dashboard, /team, /capacity, /users.
  DashboardSummary.departments = per-department stats. Page /departments. Manager can edit members (PATCH /users/{id}).
- Blocked = open task whose latest note has tag "blocker" (Task.is_blocked).
- Workload balancer: GET /capacity (manager) → members sorted by load score (critical 3, high 2, medium 1, low 0.5;
  review counts half; +1 per overdue). <=3 available, <=6 balanced, else stretched. Shown in the task form ("Best fit") and Team cards.
- Daily digest: .emergent/crons.yml fires POST /api/cron/daily-digest at 08:00 Asia/Kolkata (Bearer WEBHOOK_CRON_SECRET,
  idempotent on X-Webhook-Id in cron_runs). Builds the digests doc for today (overdue / due today / blocked + per department) and an
  in-app "digest" notification for managers. Manager can POST /digests/run; GET /digests. Page /digest. APP_TZ=Asia/Kolkata.
- Google Calendar sync (Emergent connector, env GOOGLE_CALENDAR_CONNECTION_ID): each open task = all-day event on the
  manager's primary calendar on its due date, assignee invited (sendUpdates=all). Auto-sync in the background on create and on
  changes to title/description/due/assignee/priority/department or a done flip; delete removes the event. tasks.calendar_event_id.
  GET /calendar/status, PUT /calendar/settings {enabled}, POST /calendar/sync (manager). Sidebar card shows status.
- Seed is mining-themed: 1 manager + 6 members, 14 tasks (2 overdue, 2 blocked).

## v3 additions
- Safety checklists: tasks.checklist [{id, text, done, done_by_name, done_at}]. checklist_templates collection (6 built-in mining
  templates seeded via seed_templates() on startup if empty). GET/POST/DELETE /checklist-templates (POST/DELETE manager);
  POST /tasks/{id}/checklist/apply {template_id} (manager, skips duplicates), POST /tasks/{id}/checklist {text} (manager),
  PATCH /tasks/{id}/checklist/{item_id} {done} (assignee or manager), DELETE item (manager). UI: TaskChecklist in the task dialog,
  "Save this checklist as a template".
- Shift planner: GET /planner?start=YYYY-MM-DD&department= → Mon–Sun week, rows per member (members see only themselves),
  cells by due date, clash = 2+ open tasks same day, carried_over = open tasks due before the week. Page /planner; manager drags
  a task to a day → PATCH due_date. Seed: Carlos has a clash today.
- Digest email (Gmail connector, env GMAIL_CONNECTION_ID): scheduled digest is emailed from the connected Gmail to its own
  address when enabled (settings key digest_email, default on). GET /digests/email/status, PUT /digests/email/settings,
  POST /digests/{date}/email. lib/connectors.py holds the shared token helper used by gcal + gmail.
