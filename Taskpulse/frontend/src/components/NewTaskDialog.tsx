import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { invalidateWork } from "@/lib/hooks";
import type { Task, TaskCreate } from "@/lib/types";

interface Props {
  open: boolean;
  defaultAssignee?: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export default function NewTaskDialog({ open, defaultAssignee, onClose, onCreated }: Props) {
  const create = useMutation({
    mutationFn: (body: TaskCreate) => apiPost<Task>("/tasks", body),
    onSuccess: (t) => {
      invalidateWork();
      toast.success(`Assigned to ${t.assignee_name}`);
      onCreated(t);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="new-task-dialog" className="border-[#1E293B] bg-[#0F1520] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold">Assign new task</DialogTitle>
          <DialogDescription>The assignee is notified instantly in their bell.</DialogDescription>
        </DialogHeader>
        {open && (
          <TaskForm
            defaultAssignee={defaultAssignee}
            submitting={create.isPending}
            submitLabel="Assign task"
            onCancel={onClose}
            onSubmit={(v) => create.mutate(v)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
