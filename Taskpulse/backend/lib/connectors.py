"""Shared helper for the user's Emergent connectors: short-lived provider tokens kept in memory only."""

import os
import time
from datetime import datetime
from typing import Optional

import httpx

CONNECTORS_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
_tokens: dict[str, tuple[str, float]] = {}


class ConnectorError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _expiry(expires_at: Optional[str]) -> float:
    try:
        return datetime.fromisoformat(expires_at.replace("Z", "+00:00")).timestamp()  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        return time.time() + 300


async def provider_token(cid: str, provider_label: str, fresh: bool = False) -> str:
    token, expires = _tokens.get(cid, ("", 0.0))
    if token and not fresh and time.time() < expires - 60:
        return token
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise ConnectorError("unavailable", f"{provider_label} connection key is not configured")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            CONNECTORS_BASE.rstrip("/") + "/connectors/v2/access-token",
            headers={"Authorization": f"Bearer {key}"},
            json={"connection_id": cid},
        )
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code != 200:
        code = body.get("code", "provider_error")
        msg = {
            "connection_expired": f"Reconnect {provider_label} in the chat",
            "connection_not_found": f"Connect {provider_label} in the chat",
        }.get(code, body.get("message", f"{provider_label} is unavailable right now"))
        raise ConnectorError(code, msg)
    _tokens[cid] = (body["access_token"], _expiry(body.get("expires_at")))
    return body["access_token"]


async def call_provider(cid: str, provider_label: str, method: str, url: str, **kwargs) -> httpx.Response:
    """Calls the provider; on 401 gets a fresh token once and retries."""
    r: Optional[httpx.Response] = None
    for fresh in (False, True):
        token = await provider_token(cid, provider_label, fresh=fresh)
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.request(method, url, headers={"Authorization": f"Bearer {token}"}, **kwargs)
        if r.status_code != 401:
            return r
    assert r is not None
    return r
