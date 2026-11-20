from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, hash_password, require_manager
from lib.db import db
from lib.workflow import log_activity, new_id, now_iso
from models.schemas import Department, UserCreate, UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def list_users(department: Optional[Department] = None, _: dict = Depends(get_current_user)):
    q = {"department": department} if department else {}
    docs = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    return [UserPublic(**d) for d in docs]


@router.post("", response_model=UserPublic, status_code=201)
async def create_member(body: UserCreate, manager: dict = Depends(require_manager)):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "email": email,
        "title": body.title.strip(),
        "department": body.department,
        "role": "member",  # role is never taken from the request body
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await log_activity(manager, None, "member_added", f"added {doc['name']} to {doc['department']}")
    return UserPublic(**doc)


@router.patch("/{user_id}", response_model=UserPublic)
async def update_member(user_id: str, body: UserUpdate, manager: dict = Depends(require_manager)):
    user = await db.users.find_one({"id": user_id, "role": "member"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Team member not found")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in changes:
        changes["email"] = changes["email"].strip().lower()
        if await db.users.find_one({"email": changes["email"], "id": {"$ne": user_id}}):
            raise HTTPException(status_code=409, detail="A user with this email already exists")
    if changes:
        await db.users.update_one({"id": user_id}, {"$set": changes})
        await log_activity(manager, None, "member_updated", f"updated {user['name']}'s profile")
    return UserPublic(**{**user, **changes})
