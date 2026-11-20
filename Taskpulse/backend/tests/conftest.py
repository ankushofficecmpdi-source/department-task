"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Example:
        def test_status(client):
            assert client.get("/status").status_code == 200
    """
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c


# --- app-specific fixtures below this line ---

MANAGER_CREDS = {"email": "sarah@taskpulse.io", "password": "manager123"}
MEMBER_CREDS = {"email": "maya@taskpulse.io", "password": "member123"}
MEMBER2_CREDS = {"email": "alex@taskpulse.io", "password": "member123"}


def _login_client(creds: dict) -> httpx.Client:
    c = httpx.Client(base_url=API_URL, timeout=30.0)
    r = c.post("/auth/login", json=creds)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return c


@pytest.fixture
def manager_client():
    c = _login_client(MANAGER_CREDS)
    yield c
    c.close()


@pytest.fixture
def member_client():
    c = _login_client(MEMBER_CREDS)
    yield c
    c.close()


@pytest.fixture
def member2_client():
    c = _login_client(MEMBER2_CREDS)
    yield c
    c.close()
