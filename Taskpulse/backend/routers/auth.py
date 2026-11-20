from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import (
    clear_session_cookie,
    create_token,
    get_current_user,
    set_session_cookie,
    verify_password,
)
from lib.db import db
from models.schemas import LoginRequest, OkResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserPublic)
async def login(body: LoginRequest, response: Response):
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session_cookie(response, create_token(user["id"]))
    return UserPublic(**user)


@router.post("/logout", response_model=OkResponse)
async def logout(response: Response):
    clear_session_cookie(response)
    return OkResponse()


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)
