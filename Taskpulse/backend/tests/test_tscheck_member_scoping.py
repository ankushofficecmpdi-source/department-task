"""Criterion: Member scoping - API returns 403 when a member edits a title or creates a task,
and 404 when a member opens another member's task."""


def test_member_create_task_forbidden(member_client, member2_client):
    body = {
        "title": "tscheck-scope-create",
        "assignee_id": "whatever",
        "priority": "medium",
        "status": "todo",
        "progress": 0,
        "due_date": "2026-12-01",
    }
    r = member_client.post("/tasks", json=body)
    assert r.status_code == 403, r.text


def test_member_cannot_edit_title(manager_client, member_client):
    # manager creates a task assigned to maya (member_client logs in as maya)
    users = manager_client.get("/users").json()
    maya = next(u for u in users if u["email"] == "maya@taskpulse.io")
    create = manager_client.post(
        "/tasks",
        json={
            "title": "tscheck-scope-title",
            "assignee_id": maya["id"],
            "priority": "medium",
            "status": "todo",
            "progress": 0,
            "due_date": "2026-12-01",
        },
    )
    assert create.status_code == 201, create.text
    task_id = create.json()["id"]

    r = member_client.patch(f"/tasks/{task_id}", json={"title": "tscheck-hacked-title"})
    assert r.status_code == 403, r.text

    # cleanup
    manager_client.delete(f"/tasks/{task_id}")


def test_member_cannot_open_other_members_task(manager_client, member_client):
    # manager creates a task assigned to alex; maya (member_client) tries to open it
    users = manager_client.get("/users").json()
    alex = next(u for u in users if u["email"] == "alex@taskpulse.io")
    create = manager_client.post(
        "/tasks",
        json={
            "title": "tscheck-scope-other",
            "assignee_id": alex["id"],
            "priority": "medium",
            "status": "todo",
            "progress": 0,
            "due_date": "2026-12-01",
        },
    )
    assert create.status_code == 201, create.text
    task_id = create.json()["id"]

    r = member_client.get(f"/tasks/{task_id}")
    assert r.status_code == 404, r.text

    manager_client.delete(f"/tasks/{task_id}")


def test_member_sees_only_own_tasks(manager_client, member_client):
    users = manager_client.get("/users").json()
    maya = next(u for u in users if u["email"] == "maya@taskpulse.io")

    r = member_client.get("/tasks")
    assert r.status_code == 200, r.text
    tasks = r.json()
    assert len(tasks) > 0
    assert all(t["assignee_id"] == maya["id"] for t in tasks)
