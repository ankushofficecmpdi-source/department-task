"""Criterion: Manager assigns work; Progress tracking and updates (status/progress/notes persist)."""


def test_manager_creates_task_and_member_updates_progress_status_note(manager_client, member_client):
    users = manager_client.get("/users").json()
    maya = next(u for u in users if u["email"] == "maya@taskpulse.io")

    create = manager_client.post(
        "/tasks",
        json={
            "title": "tscheck-assign-progress",
            "assignee_id": maya["id"],
            "priority": "high",
            "status": "todo",
            "progress": 0,
            "due_date": "2026-12-05",
        },
    )
    assert create.status_code == 201, create.text
    task = create.json()
    task_id = task["id"]
    assert task["assignee_id"] == maya["id"]
    assert task["title"] == "tscheck-assign-progress"

    # member updates progress
    upd = member_client.patch(f"/tasks/{task_id}", json={"progress": 40})
    assert upd.status_code == 200, upd.text
    assert upd.json()["progress"] == 40

    # member updates status
    upd2 = member_client.patch(f"/tasks/{task_id}", json={"status": "review"})
    assert upd2.status_code == 200, upd2.text
    assert upd2.json()["status"] == "review"

    # member posts a note with a tag
    note = member_client.post(f"/tasks/{task_id}/notes", json={"note": "tscheck note body", "tag": "milestone"})
    assert note.status_code == 201, note.text
    notes = note.json()["notes"]
    assert any(n["note"] == "tscheck note body" and n["tag"] == "milestone" for n in notes)

    # reload via GET persists
    reloaded = manager_client.get(f"/tasks/{task_id}")
    assert reloaded.status_code == 200
    rj = reloaded.json()
    assert rj["progress"] == 40
    assert rj["status"] == "review"
    assert any(n["note"] == "tscheck note body" for n in rj["notes"])

    manager_client.delete(f"/tasks/{task_id}")
