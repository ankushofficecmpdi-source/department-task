import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Overline } from "@/components/TaskBits";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { errorMessage, timeAgo } from "@/lib/format";
import { invalidateWork, useTemplates } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  ChecklistApply,
  ChecklistItemCreate,
  ChecklistTemplate,
  ChecklistTemplateCreate,
  ChecklistToggle,
  Task,
} from "@/lib/types";

/** Safety checklist inside the task dialog. Assignee + manager tick items; manager adds items / applies templates. */
export default function TaskChecklist({ task, isManager }: { task: Task; isManager: boolean }) {
  const templates = useTemplates();
  const [newItem, setNewItem] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const done = task.checklist.filter((i) => i.done).length;
  const total = task.checklist.length;

  const onSaved = (t: Task) => {
    queryClient.setQueryData(["tasks", t.id], t);
    invalidateWork();
  };
  const toggle = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ChecklistToggle }) => apiPatch<Task>(`/tasks/${task.id}/checklist/${id}`, body),
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const add = useMutation({
    mutationFn: (body: ChecklistItemCreate) => apiPost<Task>(`/tasks/${task.id}/checklist`, body),
    onSuccess: (t) => {
      setNewItem("");
      onSaved(t);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<Task>(`/tasks/${task.id}/checklist/${id}`),
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const apply = useMutation({
    mutationFn: (body: ChecklistApply) => apiPost<Task>(`/tasks/${task.id}/checklist/apply`, body),
    onSuccess: (t) => {
      onSaved(t);
      toast.success("Checklist added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveTemplate = useMutation({
    mutationFn: (body: ChecklistTemplateCreate) => apiPost<ChecklistTemplate>("/checklist-templates", body),
    onSuccess: (tpl) => {
      invalidateWork();
      setSaving(false);
      setTemplateName("");
      toast.success(`Saved "${tpl.name}" as a reusable template`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const tpls = templates.isError ? [] : (templates.data ?? []);
  const sorted = [...tpls].sort((a, b) => Number(b.department === task.department) - Number(a.department === task.department));
  if (!isManager && total === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-[#1E293B] bg-[#111827] p-4" data-testid="task-checklist">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="size-4 text-[#34D399]" />
        <Overline>Safety checklist</Overline>
        {total > 0 && (
          <span className="font-mono text-xs text-slate-300" data-testid="task-checklist-count">
            {done}/{total}
          </span>
        )}
        {isManager && (
          <Select value="" onValueChange={(v: string) => v && apply.mutate({ template_id: v })}>
            <SelectTrigger className="ml-auto h-8 w-52 text-xs" data-testid="checklist-template-select">
              <SelectValue>{() => (apply.isPending ? "Adding…" : "Add from template…")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sorted.map((t) => (
                <SelectItem key={t.id} value={t.id} data-testid={`checklist-template-option-${t.id}`}>
                  {t.name} · {t.items.length}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[#1E293B]">
          <div className="h-full rounded-full bg-[#10B981] transition-[width] duration-500" style={{ width: `${(done * 100) / total}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {task.checklist.map((i) => (
          <li key={i.id} className="group flex items-start gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-[#1E293B]/50">
            <Checkbox
              checked={i.done}
              onCheckedChange={(v) => toggle.mutate({ id: i.id, body: { done: v === true } })}
              data-testid={`checklist-item-checkbox-${i.id}`}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm transition-colors", i.done ? "text-slate-500 line-through" : "text-slate-200")}>{i.text}</p>
              {i.done && i.done_by_name && (
                <p className="font-mono text-[10px] text-slate-500">
                  ✓ {i.done_by_name}
                  {i.done_at ? ` · ${timeAgo(i.done_at)}` : ""}
                </p>
              )}
            </div>
            {isManager && (
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => remove.mutate(i.id)}
                data-testid={`checklist-item-remove-${i.id}`}
                className="rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-[#FB7185] group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {total === 0 && <li className="text-sm text-slate-500">No checklist yet — add one from a template or item by item.</li>}
      </ul>
      {isManager && (
        <div className="space-y-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newItem.trim()) add.mutate({ text: newItem.trim() });
            }}
          >
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a check item…"
              className="h-8 bg-[#0B0F17] text-sm"
              data-testid="checklist-new-item-input"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!newItem.trim() || add.isPending} data-testid="checklist-add-item-button">
              <Plus className="size-3.5" /> Add
            </Button>
          </form>
          {total > 0 &&
            (saving ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (templateName.trim())
                    saveTemplate.mutate({ name: templateName.trim(), department: task.department, items: task.checklist.map((i) => i.text) });
                }}
              >
                <Input
                  autoFocus
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="h-8 bg-[#0B0F17] text-sm"
                  data-testid="checklist-template-name-input"
                />
                <Button type="submit" size="sm" disabled={!templateName.trim()} className="bg-[#4F46E5] text-white hover:bg-[#4338CA]" data-testid="checklist-template-save-button">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSaving(false)}>Cancel</Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSaving(true)}
                data-testid="checklist-save-as-template-button"
                className="inline-flex items-center gap-1.5 text-xs text-[#818CF8] transition-colors hover:text-white"
              >
                <Save className="size-3" /> Save this checklist as a template
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
