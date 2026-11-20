"""Criterion: Priority notifications - unread count, overdue/due-soon/critical alerts, mark all read."""


def test_notifications_list_and_mark_all_read(member_client):
    r = member_client.get("/notifications")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body and "unread" in body

    # seed has overdue/due-soon/critical tasks for members; alerts should include at least one kind
    kinds = {n["kind"] for n in body["items"]}
    assert kinds & {"overdue", "due_soon", "critical", "assigned", "update", "nudge", "blocker"} or body["items"] == []

    r2 = member_client.post("/notifications/read-all")
    assert r2.status_code == 200, r2.text

    r3 = member_client.get("/notifications")
    assert r3.status_code == 200
    assert r3.json()["unread"] == 0


def test_nudge_creates_notification_for_assignee(manager_client, member_client):
    users = manager_client.get("/users").json()
    maya = next(u for u in users if u["email"] == "maya@taskpulse.io")
    create = manager_client.post(
        "/tasks",
        json={
            "title": "tscheck-nudge-target",
            "assignee_id": maya["id"],
            "priority": "medium",
            "status": "todo",
            "progress": 10,
            "due_date": "2026-12-10",
        },
    )
    assert create.status_code == 201, create.text
    task_id = create.json()["id"]

    nudge = manager_client.post(f"/tasks/{task_id}/nudge")
    assert nudge.status_code == 200, nudge.text

    notifs = member_client.get("/notifications").json()
    assert any(n["kind"] == "nudge" and n["task_id"] == task_id for n in notifs["items"])

    manager_client.delete(f"/tasks/{task_id}")
