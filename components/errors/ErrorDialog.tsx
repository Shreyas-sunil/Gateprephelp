"use client";

import { useState } from "react";
import { Button, Dialog, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { SubjectTopicFields } from "@/components/pickers";
import { addError, deleteError, updateError } from "@/lib/actions";
import { useToast } from "@/components/providers";
import { ERROR_TYPES } from "@/data/plan";
import { addDays, isYmd } from "@/lib/date";
import type { ErrorEntry, ErrorType, SubjectId } from "@/types";

export type ErrorDraft = Partial<ErrorEntry> & { date: string };

type Props = { open: boolean; onClose: () => void; initial: ErrorDraft | null };

export function ErrorDialog(props: Props) {
  return <ErrorDialogInner key={props.open ? (props.initial?.id ?? "new") : "closed"} {...props} />;
}

function ErrorDialogInner({ open, onClose, initial }: Props) {
  const toast = useToast();
  const [e, setE] = useState<ErrorDraft | null>(initial);
  const [err, setErr] = useState("");
  if (!e) return null;
  const editing = !!e.id;
  const set = (p: Partial<ErrorDraft>) => setE({ ...e, ...p });

  const save = async () => {
    if (!e.subjectId) return setErr("Choose a subject.");
    if (!e.type) return setErr("Choose an error type.");
    if (!e.questionRef?.trim()) return setErr("Add a question reference (e.g. GATE 2022 Q41 or Mock 3 Q12).");
    if (e.reviewDate && !isYmd(e.reviewDate)) return setErr("Review date is invalid.");
    const row = {
      questionRef: e.questionRef.trim(),
      source: e.source ?? "practice",
      pyqId: e.pyqId,
      mockId: e.mockId,
      subjectId: e.subjectId as SubjectId,
      topicId: e.topicId,
      type: e.type as ErrorType,
      marksLost: Math.max(0, Number(e.marksLost ?? 0)),
      originalThought: e.originalThought ?? "",
      whyWrong: e.whyWrong ?? "",
      correctReasoning: e.correctReasoning ?? "",
      rule: e.rule ?? "",
      correctiveAction: e.correctiveAction ?? ERROR_TYPES[e.type as ErrorType].fix,
      reviewDate: e.reviewDate,
      repeatCount: Math.max(0, Math.floor(Number(e.repeatCount ?? 0))),
      status: e.status ?? "open",
      date: e.date,
    } satisfies Omit<ErrorEntry, "id" | "createdAt">;
    if (editing) await updateError(e.id!, row);
    else await addError(row);
    toast({ tone: "success", title: editing ? "Error updated" : "Error logged", body: row.status === "open" ? "Scheduled for review." : undefined });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Edit error" : "Log an error"}
      description="Write down the exact reason. The rule you write is what stops it recurring."
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                await deleteError(e.id!);
                toast({ tone: "info", title: "Error deleted" });
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
            {editing ? "Save changes" : "Log error"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(ERROR_TYPES) as ErrorType[]).map((t) => (
            <button key={t} type="button" aria-pressed={e.type === t} onClick={() => set({ type: t, correctiveAction: e.correctiveAction || ERROR_TYPES[t].fix })} className={cx("rounded-md border p-2.5 text-left", e.type === t ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong")}>
              <span className="text-[13px] font-semibold">
                Type {t}: {ERROR_TYPES[t].name}
              </span>
              <span className="block text-xs text-ink-3">{ERROR_TYPES[t].meaning}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Question reference" htmlFor="er-q" className="sm:col-span-2">
            <Input id="er-q" placeholder="GATE 2022 Q41" value={e.questionRef ?? ""} onChange={(x) => set({ questionRef: x.target.value })} />
          </Field>
          <Field label="Source" htmlFor="er-src">
            <Select id="er-src" value={e.source ?? "practice"} onChange={(x) => set({ source: x.target.value as ErrorEntry["source"] })}>
              <option value="pyq">PYQ</option>
              <option value="mock">Mock test</option>
              <option value="practice">Practice</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Marks lost" htmlFor="er-m">
            <Input id="er-m" type="number" min={0} step={0.33} value={e.marksLost ?? 0} onChange={(x) => set({ marksLost: Number(x.target.value) })} />
          </Field>
        </div>
        <SubjectTopicFields requiredSubject subjectId={e.subjectId} topicId={e.topicId} onChange={(v) => set(v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What I originally thought" htmlFor="er-o">
            <Textarea id="er-o" value={e.originalThought ?? ""} onChange={(x) => set({ originalThought: x.target.value })} />
          </Field>
          <Field label="Why my answer was wrong" htmlFor="er-w">
            <Textarea id="er-w" value={e.whyWrong ?? ""} onChange={(x) => set({ whyWrong: x.target.value })} />
          </Field>
          <Field label="Correct reasoning" htmlFor="er-c">
            <Textarea id="er-c" value={e.correctReasoning ?? ""} onChange={(x) => set({ correctReasoning: x.target.value })} />
          </Field>
          <Field label="Rule or insight to remember" htmlFor="er-r">
            <Textarea id="er-r" placeholder="e.g. Bounded waiting needs a turn variable, not just flags." value={e.rule ?? ""} onChange={(x) => set({ rule: x.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Corrective action" htmlFor="er-a" className="sm:col-span-2">
            <Input id="er-a" value={e.correctiveAction ?? ""} onChange={(x) => set({ correctiveAction: x.target.value })} />
          </Field>
          <Field label="Review on" htmlFor="er-rd">
            <Input id="er-rd" type="date" value={e.reviewDate ?? addDays(e.date, 1)} onChange={(x) => set({ reviewDate: x.target.value })} />
          </Field>
          <Field label="Times repeated" htmlFor="er-rc">
            <Input id="er-rc" type="number" min={0} value={e.repeatCount ?? 0} onChange={(x) => set({ repeatCount: Number(x.target.value) })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date" htmlFor="er-d">
            <Input id="er-d" type="date" value={e.date} onChange={(x) => set({ date: x.target.value })} />
          </Field>
          <Field label="Status" htmlFor="er-s">
            <Select id="er-s" value={e.status ?? "open"} onChange={(x) => set({ status: x.target.value as ErrorEntry["status"] })}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </Select>
          </Field>
        </div>
        {err && <p className="text-[13px] text-rose">{err}</p>}
      </div>
    </Dialog>
  );
}
