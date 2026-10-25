"use client";

import { useState } from "react";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { SubjectTopicFields } from "@/components/pickers";
import { addTask, deleteTask, updateTask } from "@/lib/actions";
import { useToast } from "@/components/providers";
import { isYmd } from "@/lib/date";
import type { Task } from "@/types";

export type TaskDraft = Partial<Task> & { date: string };

type Props = { open: boolean; onClose: () => void; initial: TaskDraft | null };

/** Remounts per opening so the form starts from `initial`. */
export function TaskDialog(props: Props) {
  return <TaskDialogInner key={props.open ? (props.initial?.id ?? `new-${props.initial?.date}`) : "closed"} {...props} />;
}

function TaskDialogInner({ open, onClose, initial }: Props) {
  const toast = useToast();
  const [t, setT] = useState<TaskDraft | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  if (!t) return null;
  const editing = !!t.id;

  const save = async () => {
    if (!t.title?.trim()) return setErr("Give the task a title.");
    if (!isYmd(t.date)) return setErr("Pick a valid date.");
    const plannedMin = Math.max(0, Math.round(Number(t.plannedMin ?? 60)));
    if (editing) await updateTask(t.id!, { ...t, title: t.title.trim(), plannedMin });
    else await addTask({ ...t, title: t.title.trim(), plannedMin, source: t.source ?? "manual" });
    toast({ tone: "success", title: editing ? "Task updated" : "Task added" });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit task" : "New task"}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                await deleteTask(t.id!);
                toast({ tone: "info", title: "Task deleted" });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {editing ? "Save task" : "Add task"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Title" htmlFor="task-title">
          <Input id="task-title" autoFocus value={t.title ?? ""} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="e.g. 25 PYQs on paging" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" htmlFor="task-date">
            <Input id="task-date" type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} />
          </Field>
          <Field label="Planned minutes" htmlFor="task-min">
            <Input id="task-min" type="number" min={0} step={5} value={t.plannedMin ?? 60} onChange={(e) => setT({ ...t, plannedMin: Number(e.target.value) })} />
          </Field>
          <Field label="Block" htmlFor="task-block">
            <Select id="task-block" value={t.block ?? ""} onChange={(e) => setT({ ...t, block: e.target.value ? (Number(e.target.value) as 1 | 2 | 3) : undefined })}>
              <option value="">None</option>
              <option value="1">1 · Theory</option>
              <option value="2">2 · PYQs</option>
              <option value="3">3 · Revision & errors</option>
            </Select>
          </Field>
        </div>
        <SubjectTopicFields subjectId={t.subjectId} topicId={t.topicId} onChange={(v) => setT({ ...t, ...v })} />
        {editing && (
          <Field label="Status" htmlFor="task-status">
            <Select id="task-status" value={t.status ?? "todo"} onChange={(e) => setT({ ...t, status: e.target.value as Task["status"] })}>
              <option value="todo">To do</option>
              <option value="done">Done</option>
              <option value="skipped">Skipped (won&apos;t count as planned)</option>
            </Select>
          </Field>
        )}
        <Field label="Notes" htmlFor="task-notes">
          <Textarea id="task-notes" value={t.notes ?? ""} onChange={(e) => setT({ ...t, notes: e.target.value })} />
        </Field>
        {t.link && (
          <p className="text-xs text-ink-3">
            Linked resource:{" "}
            <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
              {t.link}
            </a>
          </p>
        )}
        {err && <p className="text-[13px] text-rose">{err}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
