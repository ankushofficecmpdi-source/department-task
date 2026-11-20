"""Criterion: Manager oversight - Team page lists members with stats/tasks; a member's update
notifies the manager."""


def test_team_endpoint_lists_members_with_stats(manager_client):
    r = manager_client.get("/team")
    assert r.status_code == 200, r.text
    team = r.json()
    emails_expected = {"alex@taskpulse.io", "maya@taskpulse.io", "carlos@taskpulse.io", "elena@taskpulse.io"}
    got_emails = {m["user"]["email"] for m in team}
    assert emails_expected.issubset(got_emails)
    for m in team:
        assert "stats" in m and {"active", "completed", "overdue", "critical"}.issubset(m["stats"].keys())
        assert "tasks" in m


def test_team_endpoint_forbidden_for_member(member_client):
    r = member_client.get("/team")
    assert r.status_code == 403, r.text


def test_member_note_notifies_manager(manager_client, member_client):
    users = manager_client.get("/users").json()
    maya = next(u for u in users if u["email"] == "maya@taskpulse.io")
    create = manager_client.post(
        "/tasks",
        json={
            "title": "tscheck-oversight-note",
            "assignee_id": maya["id"],
            "priority": "medium",
            "status": "todo",
            "progress": 0,
            "due_date": "2026-12-08",
        },
    )
    assert create.status_code == 201, create.text
    task_id = create.json()["id"]

    note = member_client.post(f"/tasks/{task_id}/notes", json={"note": "tscheck manager notify note", "tag": "progress"})
    assert note.status_code == 201, note.text

    notifs = manager_client.get("/notifications").json()
    assert any(n["task_id"] == task_id for n in notifs["items"])

    manager_client.delete(f"/tasks/{task_id}")
