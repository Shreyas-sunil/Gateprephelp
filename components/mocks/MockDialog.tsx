"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, Input, Select, Textarea } from "@/components/ui";
import { SubjectSelect, TopicSelect } from "@/components/pickers";
import { saveMock, deleteMock } from "@/lib/actions";
import { useToast } from "@/components/providers";
import { isYmd } from "@/lib/date";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import type { MockKind, MockTest, SubjectId } from "@/types";

export type MockDraft = Partial<MockTest> & { date: string };

export const KIND_LABEL: Record<MockKind, string> = { subject: "Subject test", multi: "Multi-subject test", full: "Full-length mock", custom: "Custom practice" };

export function emptyMock(date: string): MockDraft {
  return {
    date,
    name: "",
    kind: "full",
    totalMarks: 100,
    score: 0,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    durationMin: 180,
    subjectMarks: [],
    weakTopicIds: [],
    lostMarks: { A: 0, B: 0, C: 0, unattempted: 0 },
    rounds: [{ round: 1 }, { round: 2 }, { round: 3 }],
    actions: [],
  };
}

type Props = { open: boolean; onClose: () => void; initial: MockDraft | null };

export function MockDialog(props: Props) {
  return <MockDialogInner key={props.open ? (props.initial?.id ?? "new") : "closed"} {...props} />;
}

function MockDialogInner({ open, onClose, initial }: Props) {
  const toast = useToast();
  const [m, setM] = useState<MockDraft | null>(initial);
  const [err, setErr] = useState("");
  const [addSubj, setAddSubj] = useState<SubjectId | undefined>();
  const [addTopicSubj, setAddTopicSubj] = useState<SubjectId | undefined>();
  const [action, setAction] = useState("");
  if (!m) return null;
  const set = (p: Partial<MockDraft>) => setM({ ...m, ...p });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const lost = m.lostMarks ?? { A: 0, B: 0, C: 0, unattempted: 0 };
  const lostSum = lost.A + lost.B + lost.C + lost.unattempted;
  const gap = (m.totalMarks ?? 0) - (m.score ?? 0);

  const save = async () => {
    if (!m.name?.trim()) return setErr("Name the test.");
    if (!isYmd(m.date)) return setErr("Pick a valid date.");
    if (!(Number(m.totalMarks) > 0)) return setErr("Total marks must be more than 0.");
    if (Number(m.score) > Number(m.totalMarks)) return setErr("Score can't exceed total marks.");
    for (const s of m.subjectMarks ?? []) if (s.scored > s.max) return setErr(`${SUBJECT_MAP[s.subjectId].short}: scored exceeds max.`);
    await saveMock({
      ...(m as MockTest),
      name: m.name.trim(),
      totalMarks: Number(m.totalMarks),
      score: Number(m.score),
      kind: m.kind ?? "full",
      subjectMarks: m.subjectMarks ?? [],
      weakTopicIds: m.weakTopicIds ?? [],
      lostMarks: lost,
      rounds: m.rounds ?? [],
      actions: m.actions ?? [],
      correct: Number(m.correct ?? 0),
      incorrect: Number(m.incorrect ?? 0),
      unattempted: Number(m.unattempted ?? 0),
    });
    toast({ tone: "success", title: m.id ? "Mock updated" : "Mock recorded", body: `${m.score}/${m.totalMarks}` });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={m.id ? "Edit mock test" : "Record a mock test"}
      description="Only real results — leave fields blank rather than guessing."
      footer={
        <>
          {m.id && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                await deleteMock(m.id!);
                toast({ tone: "info", title: "Mock deleted" });
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
            {m.id ? "Save mock" : "Record mock"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-4">
          <Field label="Test name" htmlFor="mk-n" className="sm:col-span-2">
            <Input id="mk-n" value={m.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="FLT 3" />
          </Field>
          <Field label="Provider" htmlFor="mk-p">
            <Input id="mk-p" list="mk-providers" value={m.provider ?? ""} onChange={(e) => set({ provider: e.target.value || undefined })} placeholder="practicepaper.in" />
            <datalist id="mk-providers">
              <option value="practicepaper.in" />
              <option value="NPTEL GATE portal" />
              <option value="Official GATE paper" />
            </datalist>
          </Field>
          <Field label="Type" htmlFor="mk-k">
            <Select id="mk-k" value={m.kind} onChange={(e) => set({ kind: e.target.value as MockKind })}>
              {(Object.keys(KIND_LABEL) as MockKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="mk-d">
            <Input id="mk-d" type="date" value={m.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Score" htmlFor="mk-s">
            <Input id="mk-s" type="number" step={0.01} value={m.score ?? 0} onChange={(e) => set({ score: num(e.target.value) })} />
          </Field>
          <Field label="Total marks" htmlFor="mk-t">
            <Input id="mk-t" type="number" min={1} value={m.totalMarks ?? 100} onChange={(e) => set({ totalMarks: num(e.target.value) })} />
          </Field>
          <Field label="Marked for review" htmlFor="mk-r">
            <Input id="mk-r" type="number" min={0} value={m.markedForReview ?? ""} onChange={(e) => set({ markedForReview: e.target.value ? num(e.target.value) : undefined })} />
          </Field>
          <Field label="Correct" htmlFor="mk-c">
            <Input id="mk-c" type="number" min={0} value={m.correct ?? 0} onChange={(e) => set({ correct: num(e.target.value) })} />
          </Field>
          <Field label="Incorrect" htmlFor="mk-i">
            <Input id="mk-i" type="number" min={0} value={m.incorrect ?? 0} onChange={(e) => set({ incorrect: num(e.target.value) })} />
          </Field>
          <Field label="Unattempted" htmlFor="mk-u">
            <Input id="mk-u" type="number" min={0} value={m.unattempted ?? 0} onChange={(e) => set({ unattempted: num(e.target.value) })} />
          </Field>
          <Field label="Time used / duration (min)" htmlFor="mk-tu">
            <div className="flex gap-1.5">
              <Input id="mk-tu" type="number" min={0} value={m.timeUsedMin ?? ""} onChange={(e) => set({ timeUsedMin: e.target.value ? num(e.target.value) : undefined })} aria-label="Time used" />
              <Input type="number" min={0} value={m.durationMin ?? ""} onChange={(e) => set({ durationMin: e.target.value ? num(e.target.value) : undefined })} aria-label="Duration" />
            </div>
          </Field>
          <Field label="Provider rank (optional)" htmlFor="mk-pr" hint="Rank among the provider's test-takers — not an AIR." className="sm:col-span-2">
            <div className="flex gap-1.5">
              <Input id="mk-pr" type="number" min={1} placeholder="Rank" value={m.providerRank ?? ""} onChange={(e) => set({ providerRank: e.target.value ? num(e.target.value) : undefined })} />
              <Input type="number" min={1} placeholder="of N" aria-label="Number of candidates" value={m.providerCandidates ?? ""} onChange={(e) => set({ providerCandidates: e.target.value ? num(e.target.value) : undefined })} />
            </div>
          </Field>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold">Subject-wise marks</h3>
          <div className="mt-2 space-y-1.5">
            {(m.subjectMarks ?? []).map((s, i) => (
              <div key={s.subjectId} className="grid grid-cols-[1fr_80px_80px_80px_32px] items-center gap-1.5">
                <span className="truncate text-[13px]">{SUBJECT_MAP[s.subjectId].short}</span>
                <Input aria-label="Scored" type="number" step={0.01} value={s.scored} onChange={(e) => set({ subjectMarks: m.subjectMarks!.map((x, j) => (j === i ? { ...x, scored: num(e.target.value) } : x)) })} />
                <Input aria-label="Max" type="number" min={0} value={s.max} onChange={(e) => set({ subjectMarks: m.subjectMarks!.map((x, j) => (j === i ? { ...x, max: num(e.target.value) } : x)) })} />
                <Input aria-label="Minutes spent" type="number" min={0} placeholder="min" value={s.timeMin ?? ""} onChange={(e) => set({ subjectMarks: m.subjectMarks!.map((x, j) => (j === i ? { ...x, timeMin: e.target.value ? num(e.target.value) : undefined } : x)) })} />
                <IconButton size="sm" label="Remove subject" onClick={() => set({ subjectMarks: m.subjectMarks!.filter((_, j) => j !== i) })}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))}
            {(m.subjectMarks ?? []).length > 0 && <p className="text-[11px] text-ink-3">Columns: scored · max · minutes spent (optional)</p>}
            <div className="flex gap-1.5">
              <SubjectSelect ariaLabel="Add subject" value={addSubj} onChange={setAddSubj} emptyLabel="Add a subject…" className="max-w-xs" />
              <Button
                size="md"
                disabled={!addSubj || (m.subjectMarks ?? []).some((s) => s.subjectId === addSubj)}
                onClick={() => {
                  set({ subjectMarks: [...(m.subjectMarks ?? []), { subjectId: addSubj!, scored: 0, max: 0 }] });
                  setAddSubj(undefined);
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold">Post-mock audit: where the marks went</h3>
          <p className="text-xs text-ink-3">
            Categorize every lost mark. {gap > 0 ? `${Math.round(gap * 100) / 100} marks lost in total; ${Math.round(lostSum * 100) / 100} categorized.` : ""}
            {lostSum > gap + 0.01 && <span className="text-rose"> Categorized marks exceed marks lost.</span>}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["A", "B", "C", "unattempted"] as const).map((k) => (
              <Field key={k} label={k === "unattempted" ? "Unattempted / skipped" : `Type ${k}`} htmlFor={`mk-l-${k}`}>
                <Input id={`mk-l-${k}`} type="number" min={0} step={0.33} value={lost[k]} onChange={(e) => set({ lostMarks: { ...lost, [k]: num(e.target.value) } })} />
              </Field>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold">Three-round method: what actually happened</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[1, 2, 3].map((r) => {
              const cur = m.rounds?.find((x) => x.round === r) ?? { round: r as 1 | 2 | 3 };
              const upd = (p: Partial<typeof cur>) => set({ rounds: [...(m.rounds ?? []).filter((x) => x.round !== r), { ...cur, ...p }].sort((a, b) => a.round - b.round) });
              return (
                <div key={r} className="rounded-md border border-line p-2.5">
                  <p className="text-xs font-medium text-ink-2">Round {r}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Input aria-label={`Round ${r} minutes`} type="number" min={0} placeholder="min" value={cur.minutes ?? ""} onChange={(e) => upd({ minutes: e.target.value ? num(e.target.value) : undefined })} />
                    <Input aria-label={`Round ${r} questions attempted`} type="number" min={0} placeholder="Qs" value={cur.attempted ?? ""} onChange={(e) => upd({ attempted: e.target.value ? num(e.target.value) : undefined })} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold">Weak topics</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(m.weakTopicIds ?? []).map((t) => (
              <button key={t} type="button" onClick={() => set({ weakTopicIds: m.weakTopicIds!.filter((x) => x !== t) })} className="rounded bg-rose-soft px-2 py-0.5 text-xs text-rose hover:line-through" title="Remove">
                {TOPIC_MAP[t]?.name}
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <SubjectSelect ariaLabel="Weak topic subject" value={addTopicSubj} onChange={setAddTopicSubj} emptyLabel="Subject…" />
            <TopicSelect
              ariaLabel="Add weak topic"
              subjectId={addTopicSubj}
              emptyLabel="Add topic…"
              value=""
              onChange={(t) => t && !(m.weakTopicIds ?? []).includes(t) && set({ weakTopicIds: [...(m.weakTopicIds ?? []), t] })}
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Post-test analysis" htmlFor="mk-a">
            <Textarea id="mk-a" className="min-h-[110px]" value={m.analysis ?? ""} onChange={(e) => set({ analysis: e.target.value })} placeholder="What went well, what cost marks, time sinks…" />
          </Field>
          <div>
            <p className="text-[13px] font-medium text-ink-2">Next corrective actions</p>
            <ul className="mt-1.5 space-y-1">
              {(m.actions ?? []).map((a, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[13px]">
                  <span className="min-w-0 flex-1">{a}</span>
                  <IconButton size="sm" label="Remove action" onClick={() => set({ actions: m.actions!.filter((_, j) => j !== i) })}>
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
            <form
              className="mt-1.5 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!action.trim()) return;
                set({ actions: [...(m.actions ?? []), action.trim()] });
                setAction("");
              }}
            >
              <Input aria-label="New corrective action" placeholder="e.g. 40 questions on pipeline hazards" value={action} onChange={(e) => setAction(e.target.value)} />
              <IconButton label="Add action" type="submit" className="border border-line">
                <Plus size={15} />
              </IconButton>
            </form>
          </div>
        </section>
        {err && <p className="text-[13px] text-rose">{err}</p>}
      </div>
    </Dialog>
  );
}
