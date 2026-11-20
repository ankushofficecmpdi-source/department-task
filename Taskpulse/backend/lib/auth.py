"""Session auth (httpOnly JWT cookie) + the role/visibility rules — the single place authz is decided.

Rules (RBAC + ownership):
  manager -> sees and manages every task; only role that may create/edit/delete/assign/nudge.
  member  -> sees ONLY tasks assigned to them (others are 404); may change status/progress and add notes.
The principal is always re-read from the users collection, never trusted from the token or body.
"""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db

COOKIE_NAME = "tp_session"
ALGORITHM = "HS256"
SESSION_DAYS = 7
MEMBER_EDITABLE_FIELDS = {"status", "progress"}

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, os.environ["JWT_SECRET"], algorithm=ALGORITHM)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="lax", max_age=SESSION_DAYS * 86400, path="/"
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_manager(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return user


def task_scope(user: dict) -> dict:
    """Mongo predicate for the tasks a principal may see. Always merged LAST into task queries."""
    return {} if user["role"] == "manager" else {"assignee_id": user["id"]}


def activity_scope(user: dict) -> dict:
    return {} if user["role"] == "manager" else {"assignee_id": user["id"]}
