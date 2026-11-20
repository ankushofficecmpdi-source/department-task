from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_manager, task_scope
from lib.dates import today_iso
from lib.db import db
from lib.workflow import log_activity, new_id, now_iso, to_task, users_map
from models.schemas import (
    ChecklistApply,
    ChecklistItemCreate,
    ChecklistTemplate,
    ChecklistTemplateCreate,
    ChecklistToggle,
    OkResponse,
    Task,
)

router = APIRouter(tags=["checklists"])


async def _scoped_task(task_id: str, user: dict) -> dict:
    doc = await db.tasks.find_one({"id": task_id, **task_scope(user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return doc


async def _respond(task_id: str) -> Task:
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return to_task(doc, await users_map(), today_iso())


def _new_item(text: str) -> dict:
    return {"id": new_id(), "text": text.strip(), "done": False, "done_by_name": None, "done_at": None}


@router.get("/checklist-templates", response_model=list[ChecklistTemplate])
async def list_templates(_: dict = Depends(get_current_user)):
    docs = await db.checklist_templates.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return [ChecklistTemplate(**d) for d in docs]


@router.post("/checklist-templates", response_model=ChecklistTemplate, status_code=201)
async def create_template(body: ChecklistTemplateCreate, _: dict = Depends(require_manager)):
    items = [i.strip() for i in body.items if i.strip()]
    if not items:
        raise HTTPException(status_code=422, detail="Add at least one checklist item")
    doc = {"id": new_id(), "name": body.name.strip(), "department": body.department, "items": items}
    await db.checklist_templates.insert_one(doc)
    return ChecklistTemplate(**doc)


@router.delete("/checklist-templates/{template_id}", response_model=OkResponse)
async def delete_template(template_id: str, _: dict = Depends(require_manager)):
    res = await db.checklist_templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return OkResponse()


@router.post("/tasks/{task_id}/checklist/apply", response_model=Task)
async def apply_template(task_id: str, body: ChecklistApply, manager: dict = Depends(require_manager)):
    doc = await _scoped_task(task_id, manager)
    tpl = await db.checklist_templates.find_one({"id": body.template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    existing = {i["text"] for i in doc.get("checklist", [])}
    new_items = [_new_item(t) for t in tpl["items"] if t not in existing]
    await db.tasks.update_one({"id": task_id}, {"$push": {"checklist": {"$each": new_items}}, "$set": {"updated_at": now_iso()}})
    await log_activity(manager, doc, "updated", f"added the \"{tpl['name']}\" checklist to \"{doc['title']}\"")
    return await _respond(task_id)


@router.post("/tasks/{task_id}/checklist", response_model=Task, status_code=201)
async def add_item(task_id: str, body: ChecklistItemCreate, manager: dict = Depends(require_manager)):
    await _scoped_task(task_id, manager)
    await db.tasks.update_one({"id": task_id}, {"$push": {"checklist": _new_item(body.text)}, "$set": {"updated_at": now_iso()}})
    return await _respond(task_id)


@router.patch("/tasks/{task_id}/checklist/{item_id}", response_model=Task)
async def toggle_item(task_id: str, item_id: str, body: ChecklistToggle, user: dict = Depends(get_current_user)):
    doc = await _scoped_task(task_id, user)  # assignee or manager
    item = next((i for i in doc.get("checklist", []) if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    if item["done"] != body.done:
        ts = now_iso()
        await db.tasks.update_one(
            {"id": task_id, "checklist.id": item_id},
            {"$set": {
                "checklist.$.done": body.done,
                "checklist.$.done_by_name": user["name"] if body.done else None,
                "checklist.$.done_at": ts if body.done else None,
                "updated_at": ts,
            }},
        )
        verb = "checked" if body.done else "unchecked"
        await log_activity(user, doc, "checklist", f"{verb} \"{item['text']}\" on \"{doc['title']}\"")
    return await _respond(task_id)


@router.delete("/tasks/{task_id}/checklist/{item_id}", response_model=Task)
async def delete_item(task_id: str, item_id: str, manager: dict = Depends(require_manager)):
    await _scoped_task(task_id, manager)
    res = await db.tasks.update_one({"id": task_id}, {"$pull": {"checklist": {"id": item_id}}})
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return await _respond(task_id)
