"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, Checkbox, Dialog, EmptyState, Field, IconButton, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Select, Stat, Textarea, cx } from "@/components/ui";
import { SubjectSelect, SubjectTopicFields } from "@/components/pickers";
import { ChartBox, axisProps, tooltipProps } from "@/components/charts/chart-kit";
import { addError, addPyq, bulkAddPyqs, deletePyq, updatePyq } from "@/lib/actions";
import { accuracyTimeline, type Granularity } from "@/lib/calc/stats";
import { parsePyqCsv, PYQ_CSV_COLUMNS, PYQ_CSV_TEMPLATE, toCsv } from "@/lib/io";
import { downloadText, readFileText } from "@/lib/download";
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP, subjectName, topicName } from "@/data/syllabus";
import { ERROR_TYPES } from "@/data/plan";
import { addDays, fmtDate } from "@/lib/date";
import type { ErrorType, PyqAttempt, QuestionType, SubjectId } from "@/types";

type Draft = Omit<PyqAttempt, "id" | "createdAt"> & { logError: boolean };

function blank(today: string, topicId?: string): Draft {
  const subjectId = (topicId ? TOPIC_MAP[topicId]?.subjectId : undefined) ?? ("" as unknown as SubjectId);
  return { date: today, subjectId, topicId, marks: 1, qtype: "MCQ", result: "correct", guessed: false, revisited: false, logError: true };
}

function PyqInner() {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const params = useSearchParams();
  const presetTopic = params.get("topic") ?? undefined;
  const [draft, setDraft] = useState<Draft | null>(presetTopic ? blank(today, presetTopic) : null);
  const [importOpen, setImportOpen] = useState(false);
  const [fSubject, setFSubject] = useState<SubjectId | undefined>(presetTopic ? TOPIC_MAP[presetTopic]?.subjectId : undefined);
  const [fType, setFType] = useState<QuestionType | "">("");
  const [fResult, setFResult] = useState<PyqAttempt["result"] | "">("");
  const [gran, setGran] = useState<Granularity>("week");
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.pyqs
      .filter((p) => (!fSubject || p.subjectId === fSubject) && (!fType || p.qtype === fType) && (!fResult || p.result === fResult))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data, fSubject, fType, fResult]);

  if (!data) return <PageSkeleton />;
  const answered = rows.filter((p) => p.result !== "unattempted");
  const correct = answered.filter((p) => p.result === "correct").length;
  const timed = rows.filter((p) => p.timeSec);
  const avgTime = timed.length ? timed.reduce((s, p) => s + (p.timeSec ?? 0), 0) / timed.length : null;
  const byType = (["MCQ", "MSQ", "NAT"] as QuestionType[]).map((t) => {
    const l = answered.filter((p) => p.qtype === t);
    return { type: t, n: l.length, acc: l.length ? (l.filter((p) => p.result === "correct").length / l.length) * 100 : null };
  });
  const bySubject = SUBJECTS.map((s) => {
    const l = answered.filter((p) => p.subjectId === s.id);
    return { id: s.id, name: s.short, n: l.length, acc: l.length ? Math.round((l.filter((p) => p.result === "correct").length / l.length) * 1000) / 10 : 0, color: s.color };
  }).filter((x) => x.n > 0);
  // Repeated mistakes: same question (year + number) wrong more than once
  const keyOf = (p: PyqAttempt) => (p.year && p.questionNo ? `${p.year}-${p.questionNo}` : null);
  const wrongCounts = new Map<string, PyqAttempt[]>();
  for (const p of data.pyqs) {
    const k = keyOf(p);
    if (k && p.result === "incorrect") wrongCounts.set(k, [...(wrongCounts.get(k) ?? []), p]);
  }
  const repeated = [...wrongCounts.entries()].filter(([, l]) => l.length > 1);
  const timeline = accuracyTimeline(rows, gran).map((p) => ({ ...p, accuracy: p.accuracy === null ? null : Math.round(p.accuracy * 10) / 10 }));
  const topicAcc = (() => {
    const m = new Map<string, { n: number; c: number }>();
    for (const p of answered) {
      if (!p.topicId) continue;
      const x = m.get(p.topicId) ?? { n: 0, c: 0 };
      x.n++;
      if (p.result === "correct") x.c++;
      m.set(p.topicId, x);
    }
    return [...m.entries()].map(([id, x]) => ({ id, n: x.n, acc: (x.c / x.n) * 100 })).sort((a, b) => a.acc - b.acc || b.n - a.n);
  })();

  const save = async (d: Draft) => {
    if (!d.subjectId) {
      toast({ tone: "error", title: "Choose a subject" });
      return;
    }
    const { logError, ...row } = d;
    let result = row.result;
    if (row.myAnswer && row.correctAnswer) {
      const n = (s: string) => s.replace(/\s+/g, "").toLowerCase();
      result = n(row.myAnswer) === n(row.correctAnswer) ? "correct" : "incorrect";
    }
    const saved = await addPyq({ ...row, result, errorType: result === "incorrect" ? row.errorType : undefined });
    if (result === "incorrect" && logError && row.errorType) {
      await addError({
        questionRef: `${row.year ? "GATE " + row.year : "PYQ"} ${row.questionNo ?? ""}`.trim(),
        source: "pyq",
        pyqId: saved.id,
        subjectId: row.subjectId,
        topicId: row.topicId,
        type: row.errorType,
        marksLost: row.marks,
        originalThought: row.myAnswer ? `Answered ${row.myAnswer}` : "",
        whyWrong: row.notes ?? "",
        correctReasoning: row.correctAnswer ? `Correct answer: ${row.correctAnswer}` : "",
        rule: "",
        correctiveAction: ERROR_TYPES[row.errorType].fix,
        reviewDate: addDays(today, 1),
        repeatCount: 0,
        status: "open",
        date: row.date,
      });
    }
    toast({ tone: "success", title: `Logged: ${result}`, body: result === "incorrect" && logError && row.errorType ? "Added to your error notebook for review tomorrow." : undefined });
    setDraft({ ...blank(today, row.topicId), subjectId: row.subjectId, year: row.year, marks: row.marks, qtype: row.qtype });
  };

  return (
    <div>
      <PageHeader
        title="PYQ tracker"
        description="Log your own attempts at previous-year questions. GATE CAT doesn't store question text — link to the source instead."
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Download size={14} />} disabled={!data.pyqs.length} onClick={() => downloadText(`gate-cat-pyqs-${today}.csv`, toCsv(data.pyqs as unknown as Record<string, unknown>[]), "text/csv")}>
              Export CSV
            </Button>
            <Button size="sm" icon={<FileUp size={14} />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setDraft(blank(today, presetTopic))}>
              Log attempt
            </Button>
          </>
        }
      />

      {draft && <PyqForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} />}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Attempted", value: answered.length, sub: fSubject || fType || fResult ? "filtered" : "logged" },
          { label: "Correct", value: correct },
          { label: "Accuracy", value: answered.length ? `${Math.round((correct / answered.length) * 100)}%` : "—", sub: answered.length ? `n = ${answered.length}` : undefined },
          { label: "Unattempted", value: rows.filter((p) => p.result === "unattempted").length, sub: "left blank" },
          { label: "Avg time", value: avgTime === null ? "—" : `${Math.floor(avgTime / 60)}m ${Math.round(avgTime % 60)}s`, sub: timed.length ? `${timed.length} timed` : "no times logged" },
          { label: "Repeated mistakes", value: repeated.length, sub: "same question wrong 2+ times" },
        ].map((s) => (
          <Panel key={s.label} className="p-3.5">
            <Stat label={s.label} value={s.value} sub={s.sub} />
          </Panel>
        ))}
      </div>
      <p className="mb-5 -mt-2 text-xs text-ink-3">These metrics use logged questions only. Topic pages also count bulk practice you enter there.</p>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Improvement over time" hint="Bars = attempts per period, line = accuracy. Small bars mean noisy accuracy." action={<Segmented size="sm" label="Period" value={gran} onChange={setGran} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />} />
          <div className="px-2 pb-3">
            <ChartBox height={220} empty={timeline.length === 0} emptyTitle="No attempts logged">
              <ComposedChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis yAxisId="acc" domain={[0, 100]} {...axisProps} width={44} unit="%" />
                <YAxis yAxisId="n" orientation="right" {...axisProps} width={32} allowDecimals={false} />
                <Tooltip {...tooltipProps} formatter={(v, n) => (n === "accuracy" ? [`${v}%`, "Accuracy"] : n === "cumulativeAccuracy" ? [`${Math.round(Number(v))}%`, "Cumulative"] : [v, "Attempted"])} />
                <RBar maxBarSize={36} yAxisId="n" dataKey="attempted" fill="var(--surface-3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="acc" dataKey="accuracy" stroke="var(--violet)" strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                <Line yAxisId="acc" dataKey="cumulativeAccuracy" stroke="var(--cyan)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ChartBox>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Accuracy by subject" hint="Label shows attempts" />
          <div className="px-2 pb-3">
            <ChartBox height={220} empty={bySubject.length === 0} emptyTitle="No attempts logged">
              <BarChart data={bySubject} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} {...axisProps} unit="%" />
                <YAxis type="category" dataKey="name" {...axisProps} width={84} />
                <Tooltip {...tooltipProps} formatter={(v, _n, p) => [`${v}% (n=${p.payload.n})`, "Accuracy"]} />
                <RBar maxBarSize={36} dataKey="acc" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {bySubject.map((s) => (
                    <Cell key={s.id} fill={s.color} />
                  ))}
                </RBar>
              </BarChart>
            </ChartBox>
          </div>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Panel>
          <PanelHeader title="By question type" />
          <ul className="space-y-2 px-4 pb-4 text-[13px]">
            {byType.map((t) => (
              <li key={t.type} className="flex items-center justify-between">
                <span>
                  {t.type} {t.type === "MSQ" && <span className="text-xs text-ink-3">(the PDF&apos;s “never guess” rule applies)</span>}
                </span>
                <span className="num text-ink-2">{t.acc === null ? "—" : `${Math.round(t.acc)}%`} <span className="text-ink-3">n={t.n}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Weakest topics" hint="Lowest accuracy first; check the sample size" />
          <ul className="space-y-1.5 px-4 pb-4 text-[13px]">
            {topicAcc.length === 0 && <li className="text-ink-3">Log attempts with a topic to see this.</li>}
            {topicAcc.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <Link href={`/topics/${t.id}`} className="min-w-0 truncate hover:underline">
                  {TOPIC_MAP[t.id]?.name}
                </Link>
                <span className={cx("num shrink-0", t.n < 5 ? "text-ink-3" : "text-ink-2")}>
                  {Math.round(t.acc)}% n={t.n}
                  {t.n < 5 && " · small sample"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title={`Attempts (${rows.length})`}
          action={
            <div className="flex flex-wrap gap-1.5">
              <SubjectSelect ariaLabel="Filter subject" value={fSubject} onChange={setFSubject} emptyLabel="All subjects" className="h-8 w-40 text-[13px]" />
              <Select aria-label="Filter type" value={fType} onChange={(e) => setFType(e.target.value as QuestionType | "")} className="h-8 w-24 text-[13px]">
                <option value="">Any type</option>
                <option>MCQ</option>
                <option>MSQ</option>
                <option>NAT</option>
              </Select>
              <Select aria-label="Filter result" value={fResult} onChange={(e) => setFResult(e.target.value as PyqAttempt["result"] | "")} className="h-8 w-32 text-[13px]">
                <option value="">Any result</option>
                <option value="correct">Correct</option>
                <option value="incorrect">Incorrect</option>
                <option value="unattempted">Unattempted</option>
              </Select>
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="No attempts yet" body="Log questions as you solve them, or import a CSV. Even without question text, your attempts drive accuracy and recommendations." action={<Button variant="primary" onClick={() => setDraft(blank(today))}>Log first attempt</Button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13px]">
                <thead className="border-y border-line bg-bg-2/60 text-left text-xs text-ink-3">
                  <tr>
                    {["Date", "Paper", "Subject / topic", "Type", "Marks", "Answer", "Result", "Time", "Flags", ""].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.slice(0, limit).map((p) => (
                    <tr key={p.id} className="hover:bg-surface-2/50">
                      <td className="px-3 py-2 whitespace-nowrap text-ink-3">{fmtDate(p.date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.year ?? "—"} {p.questionNo ?? ""}
                      </td>
                      <td className="max-w-[260px] px-3 py-2">
                        <span className="block truncate">{subjectName(p.subjectId)}</span>
                        <span className="block truncate text-xs text-ink-3">{p.topicId ? topicName(p.topicId) : "No topic"}</span>
                      </td>
                      <td className="px-3 py-2">{p.qtype}</td>
                      <td className="num px-3 py-2">{p.marks}</td>
                      <td className="px-3 py-2 text-xs text-ink-2">
                        {p.myAnswer ?? "—"} / {p.correctAnswer ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={p.result === "correct" ? "mint" : p.result === "incorrect" ? "rose" : "neutral"}>{p.result}</Badge>
                        {p.errorType && <Badge className="ml-1">Type {p.errorType}</Badge>}
                      </td>
                      <td className="num px-3 py-2 text-ink-3">{p.timeSec ? `${Math.round(p.timeSec / 60)}m` : "—"}</td>
                      <td className="px-3 py-2">
                        <label className="mr-2 inline-flex items-center gap-1 text-xs text-ink-3">
                          <input type="checkbox" checked={p.revisited} onChange={(e) => updatePyq(p.id, { revisited: e.target.checked })} /> revisited
                        </label>
                        {p.guessed && <Badge tone="amber">guessed</Badge>}
                        {p.solutionUrl && (
                          <a href={p.solutionUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs text-cyan hover:underline">
                            solution
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <IconButton size="sm" label="Delete attempt" onClick={() => deletePyq(p.id)}>
                          <Trash2 size={13} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.slice(0, limit).map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]">
                      {p.year ? `GATE ${p.year}` : "PYQ"} {p.questionNo ?? ""} · {p.qtype} · {p.marks}m
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      {subjectName(p.subjectId)}
                      {p.topicId ? ` · ${topicName(p.topicId)}` : ""} · {fmtDate(p.date)}
                    </p>
                  </div>
                  <Badge tone={p.result === "correct" ? "mint" : p.result === "incorrect" ? "rose" : "neutral"}>{p.result}</Badge>
                  <IconButton size="sm" label="Delete attempt" onClick={() => deletePyq(p.id)}>
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
            {rows.length > limit && (
              <div className="p-3 text-center">
                <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 100)}>
                  Show more ({rows.length - limit} hidden)
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function PyqForm({ draft, setDraft, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSave: (d: Draft) => void; onCancel: () => void }) {
  const d = draft;
  const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });
  return (
    <Panel className="mb-5 border-violet/30">
      <PanelHeader title="Log a PYQ attempt" hint="If you enter both answers, the result is worked out for you." />
      <form
        className="space-y-3 px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <SubjectTopicFields requiredSubject subjectId={d.subjectId || undefined} topicId={d.topicId} onChange={(v) => set({ subjectId: (v.subjectId ?? "") as SubjectId, topicId: v.topicId })} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Field label="GATE year" htmlFor="py-year">
            <Input id="py-year" type="number" min={1987} max={2027} placeholder="2024" value={d.year ?? ""} onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Question no." htmlFor="py-q">
            <Input id="py-q" placeholder="Q34" value={d.questionNo ?? ""} onChange={(e) => set({ questionNo: e.target.value || undefined })} />
          </Field>
          <Field label="Marks" htmlFor="py-m">
            <Select id="py-m" value={d.marks} onChange={(e) => set({ marks: Number(e.target.value) })}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </Select>
          </Field>
          <Field label="Type" htmlFor="py-t">
            <Select id="py-t" value={d.qtype} onChange={(e) => set({ qtype: e.target.value as QuestionType })}>
              <option>MCQ</option>
              <option>MSQ</option>
              <option>NAT</option>
            </Select>
          </Field>
          <Field label="Time (min)" htmlFor="py-time">
            <Input id="py-time" type="number" min={0} step={0.5} value={d.timeSec ? d.timeSec / 60 : ""} onChange={(e) => set({ timeSec: e.target.value ? Math.round(Number(e.target.value) * 60) : undefined })} />
          </Field>
          <Field label="Difficulty" htmlFor="py-d">
            <Select id="py-d" value={d.difficulty ?? ""} onChange={(e) => set({ difficulty: (e.target.value || undefined) as Draft["difficulty"] })}>
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="My answer" htmlFor="py-my">
            <Input id="py-my" value={d.myAnswer ?? ""} onChange={(e) => set({ myAnswer: e.target.value || undefined })} />
          </Field>
          <Field label="Correct answer" htmlFor="py-ca">
            <Input id="py-ca" value={d.correctAnswer ?? ""} onChange={(e) => set({ correctAnswer: e.target.value || undefined })} />
          </Field>
          <Field label="Result" htmlFor="py-r">
            <Select id="py-r" value={d.result} onChange={(e) => set({ result: e.target.value as PyqAttempt["result"] })} disabled={!!(d.myAnswer && d.correctAnswer)}>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
              <option value="unattempted">Unattempted</option>
            </Select>
          </Field>
          <Field label="Attempt date" htmlFor="py-date">
            <Input id="py-date" type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        {(d.result === "incorrect" || (d.myAnswer && d.correctAnswer && d.myAnswer.trim().toLowerCase() !== d.correctAnswer.trim().toLowerCase())) && (
          <div className="rounded-md border border-line bg-bg-2 p-3">
            <p className="text-[13px] font-medium text-ink-2">Error type</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.keys(ERROR_TYPES) as ErrorType[]).map((t) => (
                <button key={t} type="button" aria-pressed={d.errorType === t} onClick={() => set({ errorType: t })} className={cx("rounded-md border p-2.5 text-left", d.errorType === t ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong")}>
                  <span className="text-[13px] font-semibold">
                    Type {t}: {ERROR_TYPES[t].name}
                  </span>
                  <span className="block text-xs text-ink-3">{ERROR_TYPES[t].meaning}</span>
                </button>
              ))}
            </div>
            <Checkbox className="mt-2" label="Also add to the error notebook (review tomorrow)" checked={d.logError} onChange={(v) => set({ logError: v })} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notes" htmlFor="py-n">
            <Textarea id="py-n" className="min-h-[60px]" value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} />
          </Field>
          <div className="space-y-3">
            <Field label="Solution link" htmlFor="py-url">
              <Input id="py-url" type="url" placeholder="https://gateoverflow.in/…" value={d.solutionUrl ?? ""} onChange={(e) => set({ solutionUrl: e.target.value || undefined })} />
            </Field>
            <div className="flex gap-4">
              <Checkbox label="I guessed" checked={d.guessed} onChange={(v) => set({ guessed: v })} />
              <Checkbox label="Revisited" checked={d.revisited} onChange={(v) => set({ revisited: v })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
          <Button variant="primary" type="submit">
            Save attempt
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ReturnType<typeof parsePyqCsv> | null>(null);
  return (
    <Dialog
      open={open}
      onClose={() => {
        setResult(null);
        onClose();
      }}
      title="Import PYQ attempts from CSV"
      description="One row per attempt. Subjects and topics can be IDs or names."
      wide
      footer={
        <>
          <Button variant="ghost" icon={<Download size={14} />} className="mr-auto" onClick={() => downloadText("gate-cat-pyq-template.csv", PYQ_CSV_TEMPLATE, "text/csv")}>
            Download template
          </Button>
          <Button
            variant="primary"
            disabled={!result?.rows.length}
            onClick={async () => {
              if (!result) return;
              await bulkAddPyqs(result.rows);
              toast({ tone: "success", title: `Imported ${result.rows.length} attempts` });
              setResult(null);
              onClose();
            }}
          >
            Import {result?.rows.length ? `${result.rows.length} rows` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px]">
        <p className="text-ink-2">
          Columns: <span className="font-mono text-xs text-ink-3">{PYQ_CSV_COLUMNS.join(", ")}</span>. Only <b>subject</b> and either <b>result</b> or both answers are required. Dates use YYYY-MM-DD.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setResult(parsePyqCsv(await readFileText(f)));
            } catch (err) {
              toast({ tone: "error", title: "Couldn't read that file", body: String(err) });
            }
          }}
        />
        {result && (
          <div className="rounded-md border border-line p-3">
            <p>
              <span className="font-semibold text-mint">{result.rows.length}</span> rows ready
              {result.issues.length > 0 && (
                <>
                  , <span className="font-semibold text-amber">{result.issues.length}</span> issues
                </>
              )}
            </p>
            {result.issues.length > 0 && (
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-3">
                {result.issues.slice(0, 30).map((i, k) => (
                  <li key={k}>
                    Line {i.line}: {i.message}
                  </li>
                ))}
              </ul>
            )}
            {result.rows.length > 0 && (
              <p className="mt-2 text-xs text-ink-3">
                First row: {SUBJECT_MAP[result.rows[0]!.subjectId].short}
                {result.rows[0]!.topicId ? ` / ${topicName(result.rows[0]!.topicId)}` : ""} — {result.rows[0]!.result}
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function PyqPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PyqInner />
    </Suspense>
  );
}
