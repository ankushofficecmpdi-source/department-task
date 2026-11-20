import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Avatar,
  BlockedBadge,
  CapacityMeter,
  DepartmentFilter,
  DeptChip,
  DueBadge,
  Overline,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from "@/components/TaskBits";
import { apiPatch, apiPost } from "@/lib/api";
import { DEPARTMENTS, errorMessage, localToday } from "@/lib/format";
import { invalidateWork, useDashboard, useDeptParam, useMe, useTaskDialogs, useTeam } from "@/lib/hooks";
import type { Department, UserCreate, UserPublic, UserUpdate } from "@/lib/types";

function Ring({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
      <circle cx="28" cy="28" r={r} stroke="#1E293B" strokeWidth="5" fill="none" />
      <circle
        cx="28" cy="28" r={r} stroke="#10B981" strokeWidth="5" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
        style={{ transition: "stroke-dashoffset 600ms ease-out" }}
      />
    </svg>
  );
}

type FormState = { name: string; email: string; password: string; title: string; department: Department | "" };

/** Add a new member (editing = undefined) or edit an existing member's profile. */
function MemberDialog({ open, editing, onClose }: { open: boolean; editing?: UserPublic; onClose: () => void }) {
  const blank: FormState = { name: "", email: "", password: "", title: "", department: "" };
  const [form, setForm] = useState<FormState>(
    editing ? { name: editing.name, email: editing.email, password: "", title: editing.title, department: editing.department ?? "" } : blank,
  );
  const save = useMutation({
    mutationFn: (f: FormState) => {
      if (editing) {
        const body: UserUpdate = { name: f.name, email: f.email, title: f.title, ...(f.department ? { department: f.department } : {}) };
        return apiPatch<UserPublic>(`/users/${editing.id}`, body);
      }
      const body: UserCreate = { name: f.name, email: f.email, password: f.password, title: f.title, department: f.department as Department };
      return apiPost<UserPublic>("/users", body);
    },
    onSuccess: (u) => {
      invalidateWork();
      toast.success(editing ? `${u.name} updated` : `${u.name} added to ${u.department}`);
      setForm(blank);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const field = (k: "name" | "title" | "email" | "password", label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`member-${k}`}>{label}</Label>
      <Input
        id={`member-${k}`}
        type={type}
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        data-testid={`member-form-${k}-input`}
      />
    </div>
  );
  const valid = form.name && form.email && form.department && (editing || form.password.length >= 6);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#1E293B] bg-[#0F1520] sm:max-w-md" data-testid="member-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">{editing ? `Edit ${editing.name}` : "Add team member"}</DialogTitle>
          <DialogDescription>
            {editing ? "Calendar invites go to this email." : "They can sign in with this email and password to update their work."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          {field("name", "Full name")}
          {field("title", "Role / title")}
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v: string) => setForm((f) => ({ ...f, department: v as Department }))}>
              <SelectTrigger className="w-full" data-testid="member-form-department-select">
                <SelectValue>{(v) => (v as string) || "Select department"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d} data-testid={`member-form-department-option-${d.toLowerCase().replace(/\s+/g, "-")}`}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("email", "Email", "email")}
          {!editing && field("password", "Temporary password (min 6)", "password")}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={save.isPending || !valid}
              className="bg-[#4F46E5] text-white hover:bg-[#4338CA]"
              data-testid="member-form-submit-button"
            >
              {editing ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const me = useMe();
  const isManager = me.data?.role === "manager";
  const [dept, setDept] = useDeptParam();
  const team = useTeam(isManager, dept);
  const today = useDashboard().data?.today ?? localToday();
  const { openTask, openNew } = useTaskDialogs();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserPublic | undefined>();

  if (me.data && !isManager) return <Navigate to="/" replace />;
  const members = team.isError ? [] : (team.data ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Overline>People</Overline>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Team breakdown</h2>
          <p className="mt-1 text-sm text-slate-400">Per-member workload, spare capacity and everything on their plate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DepartmentFilter value={dept} onChange={setDept} testId="team-department-filter" />
          <Button variant="outline" onClick={() => setAdding(true)} data-testid="add-member-button">
            <UserPlus className="size-4" /> Add member
          </Button>
        </div>
      </div>

      {team.isLoading && <p className="text-sm text-slate-500">Loading team…</p>}
      {!team.isLoading && members.length === 0 && <p className="text-sm text-slate-500">No members in this department yet.</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {members.map((m, i) => {
          const rate = m.stats.assigned ? Math.round((m.stats.completed * 100) / m.stats.assigned) : 0;
          const open = m.tasks.filter((t) => t.status !== "done");
          return (
            <motion.section
              key={m.user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-[#1E293B] bg-[#111827]"
              data-testid={`team-member-card-${m.user.id}`}
            >
              <div className="flex items-start gap-4 border-b border-[#1E293B] p-4">
                <Avatar id={m.user.id} name={m.user.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-base font-bold text-white" data-testid={`team-member-name-${m.user.id}`}>{m.user.name}</p>
                    <DeptChip department={m.user.department} testId={`team-member-department-${m.user.id}`} />
                  </div>
                  <p className="text-sm text-slate-400">{m.user.title}</p>
                  <p className="font-mono text-[11px] text-slate-500">{m.user.email}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${m.user.name}`}
                  onClick={() => setEditing(m.user)}
                  data-testid={`team-member-edit-${m.user.id}`}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-[#1E293B] hover:text-white"
                >
                  <Pencil className="size-3.5" />
                </button>
                <div className="relative flex items-center justify-center">
                  <Ring value={rate} />
                  <span className="absolute font-heading text-xs font-bold text-white" data-testid={`team-member-completion-${m.user.id}`}>{rate}%</span>
                </div>
              </div>
              <div className="border-b border-[#1E293B] px-4 py-3">
                <CapacityMeter capacity={m.capacity} testId={`team-member-capacity-${m.user.id}`} />
              </div>
              <div className="grid grid-cols-4 divide-x divide-[#1E293B] border-b border-[#1E293B] text-center">
                {[
                  ["Active", m.stats.active, "text-white"],
                  ["Done", m.stats.completed, "text-[#34D399]"],
                  ["Overdue", m.stats.overdue, m.stats.overdue ? "text-[#FB7185]" : "text-white"],
                  ["Critical", m.stats.critical, m.stats.critical ? "text-[#FB7185]" : "text-white"],
                ].map(([label, v, tone]) => (
                  <div key={label as string} className="py-3">
                    <p className={`font-heading text-xl font-extrabold ${tone}`} data-testid={`team-member-${String(label).toLowerCase()}-${m.user.id}`}>{v}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <ul className="max-h-64 divide-y divide-[#1E293B]/70 overflow-y-auto">
                {open.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No open work assigned.</li>}
                {open.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openTask(t.id)}
                      className="w-full px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[#1E293B]/40"
                      data-testid={`team-task-${t.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <span className="flex-1 truncate text-sm text-slate-200">{t.title}</span>
                        {t.is_blocked && <BlockedBadge />}
                        <DueBadge task={t} today={today} />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusBadge status={t.status} />
                        <ProgressBar value={t.progress} />
                        <span className="w-9 text-right font-mono text-[10px] text-slate-400">{t.progress}%</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between p-3">
                <span className="font-mono text-[11px] text-slate-500">Avg progress {m.stats.avg_progress}%</span>
                <Button size="sm" variant="ghost" onClick={() => openNew(m.user.id)} data-testid={`team-assign-task-${m.user.id}`}>
                  <Plus className="size-3.5" /> Assign task
                </Button>
              </div>
            </motion.section>
          );
        })}
      </div>
      {adding && <MemberDialog open onClose={() => setAdding(false)} />}
      {editing && <MemberDialog key={editing.id} open editing={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
