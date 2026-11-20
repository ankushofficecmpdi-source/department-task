"""Criterion: Login with role-based access."""
import httpx

from .conftest import API_URL, MANAGER_CREDS, MEMBER_CREDS


def test_manager_and_member_login_succeed():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.post("/auth/login", json=MANAGER_CREDS)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "manager"

    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.post("/auth/login", json=MEMBER_CREDS)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "member"


def test_wrong_password_rejected():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": MANAGER_CREDS["email"], "password": "wrong-pass"})
        assert r.status_code in (400, 401), r.text


def test_logout_clears_session(manager_client):
    r = manager_client.get("/auth/me")
    assert r.status_code == 200
    r2 = manager_client.post("/auth/logout")
    assert r2.status_code == 200
    r3 = manager_client.get("/auth/me")
    assert r3.status_code == 401
