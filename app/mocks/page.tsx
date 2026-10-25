"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPlus, Pencil, Plus, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, EmptyState, Field, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Textarea, cx } from "@/components/ui";
import { SubjectSelect } from "@/components/pickers";
import { ChartBox, Legend, axisProps, tooltipProps } from "@/components/charts/chart-kit";
import { MockDialog, emptyMock, KIND_LABEL, type MockDraft } from "@/components/mocks/MockDialog";
import { ErrorDialog, type ErrorDraft } from "@/components/errors/ErrorDialog";
import { Cat } from "@/components/cat/Cat";
import { addTask, updateSettings } from "@/lib/actions";
import { rollingAverage } from "@/lib/calc/stats";
import { mockPct } from "@/lib/calc/readiness";
import { rebaseMockPhases } from "@/lib/calc/plan";
import { addDays, fmtDate } from "@/lib/date";
import { ERROR_TYPES } from "@/data/plan";
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import type { MockPhase, MockTest, RoundStep, SubjectId } from "@/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

function MocksInner() {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [dialog, setDialog] = useState<MockDraft | null>(null);
  const [errDialog, setErrDialog] = useState<ErrorDraft | null>(null);
  const [subj, setSubj] = useState<SubjectId | undefined>();
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const [tab, setTab] = useState<"results" | "plan">("results");

  const mocks = useMemo(() => (data ? [...data.mocks].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt) : []), [data]);
  if (!data) return <PageSkeleton />;

  const series = mocks
    .map((m) => {
      const s = subj ? m.subjectMarks.find((x) => x.subjectId === subj) : undefined;
      const pct = subj ? (s && s.max > 0 ? (s.scored / s.max) * 100 : null) : mockPct(m);
      const answered = m.correct + m.incorrect;
      return { id: m.id, name: m.name, date: fmtDate(m.date), score: m.score, total: m.totalMarks, pct: pct === null ? null : r1(pct), acc: answered ? r1((m.correct / answered) * 100) : null };
    })
    .filter((x) => !subj || x.pct !== null);
  const avg = rollingAverage(
    series.map((x) => x.pct),
    3,
    2,
  );
  const chart = series.map((x, i) => ({ ...x, avg: avg[i] === null ? null : r1(avg[i]!), target: subj ? null : data.settings.targetMarks }));
  const subjAgg = SUBJECTS.map((s) => {
    const rows = mocks.flatMap((m) => m.subjectMarks.filter((x) => x.subjectId === s.id && x.max > 0));
    const scored = rows.reduce((a, x) => a + x.scored, 0);
    const max = rows.reduce((a, x) => a + x.max, 0);
    const time = rows.reduce((a, x) => a + (x.timeMin ?? 0), 0);
    return { id: s.id, name: s.short, pct: max ? r1((scored / max) * 100) : null, n: rows.length, time, color: s.color };
  }).filter((x) => x.n > 0);
  const lostChart = mocks.map((m) => ({ name: m.name, A: m.lostMarks.A, B: m.lostMarks.B, C: m.lostMarks.C, Unattempted: m.lostMarks.unattempted }));
  const sel = mocks.find((m) => m.id === selected) ?? mocks.at(-1);
  const prev = sel ? mocks[mocks.indexOf(sel) - 1] : undefined;
  const phase = data.settings.mockPhases.find((p) => today >= p.start && today <= p.end);

  const auditToTasks = async (m: MockTest) => {
    let n = 0;
    for (const t of m.weakTopicIds) {
      await addTask({ date: addDays(today, Math.floor(n / 2)), title: `Post-mock fix: ${TOPIC_MAP[t]?.name}`, topicId: t, subjectId: TOPIC_MAP[t]?.subjectId, plannedMin: 60, source: "mock", block: 1, notes: `From ${m.name}` });
      n++;
    }
    for (const a of m.actions) {
      await addTask({ date: addDays(today, Math.floor(n / 2)), title: a, plannedMin: 45, source: "mock", block: 2, notes: `From ${m.name}` });
      n++;
    }
    toast({ tone: "success", title: n ? `${n} tasks created from the audit` : "Add weak topics or actions first", action: n ? { label: "Open planner", onClick: () => router.push("/planner?view=week") } : undefined });
  };

  return (
    <div>
      <PageHeader
        title="Mock test command centre"
        description="Record every test, audit every lost mark, and turn weaknesses into tasks."
        actions={
          <>
            <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: "results", label: "Results" }, { value: "plan", label: "Phases & strategy" }]} />
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setDialog(emptyMock(today))}>
              Record mock
            </Button>
          </>
        }
      />

      {phase && (
        <div className="mb-4 rounded-md border border-cyan/30 bg-cyan-soft px-4 py-2.5 text-[13px] text-cyan">
          You&apos;re in Phase {phase.id}: {phase.name} ({fmtDate(phase.start)} – {fmtDate(phase.end)}). {phase.objective}
        </div>
      )}

      {tab === "plan" ? (
        <PlanTab />
      ) : mocks.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Cat mood="curious" fur={data.settings.cat.fur} accessory={data.settings.cat.accessory} size={72} />}
            title="No mocks recorded yet"
            body="Your PDF schedules multi-subject tests from Phase 1 and full-length mocks every three days in Phase 2. Record the first one here."
            action={<Button variant="primary" onClick={() => setDialog(emptyMock(today))}>Record mock</Button>}
          />
        </Panel>
      ) : (
        <>
          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Score progression" hint={subj ? `${SUBJECT_MAP[subj].short} section, % of its max` : "Score as % of total (mocks with different totals stay comparable)"} action={<SubjectSelect ariaLabel="Filter by subject" value={subj} onChange={setSubj} emptyLabel="Overall" className="h-8 w-36 text-[13px]" />} />
              <div className="px-2 pb-3">
                <ChartBox height={230} empty={chart.length === 0} emptyTitle="No section marks for this subject" emptyBody="Add subject-wise marks to your mocks.">
                  <LineChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis domain={[0, 100]} {...axisProps} width={44} unit="%" />
                    <Tooltip
                      {...tooltipProps}
                      labelFormatter={(_, p) => {
                        const x = p?.[0]?.payload;
                        return x ? `${x.name} · ${x.date} · ${x.score}/${x.total}${x.acc !== null ? ` · ${x.acc}% accuracy` : ""}` : "";
                      }}
                      formatter={(v, n) => [v === null ? "—" : `${v}%`, n === "pct" ? "Score" : n === "avg" ? "3-mock average" : "Target"]}
                    />
                    <Line dataKey="target" stroke="var(--amber)" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line dataKey="pct" stroke="var(--violet)" strokeWidth={2.2} dot={{ r: 3.5 }} isAnimationActive={false} />
                    <Line dataKey="avg" stroke="var(--cyan)" strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ChartBox>
                <div className="mt-2 px-2">
                  <Legend items={[{ label: "Your score (recorded)", color: "var(--violet)" }, { label: "3-mock moving average", color: "var(--cyan)", dashed: true }, ...(subj ? [] : [{ label: `Target ${data.settings.targetMarks}% (your goal)`, color: "var(--amber)", dashed: true }])]} />
                </div>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Accuracy progression" hint="Correct ÷ (correct + incorrect)" />
              <div className="px-2 pb-3">
                <ChartBox height={230} empty={!series.some((x) => x.acc !== null)} emptyTitle="Add correct/incorrect counts to see accuracy">
                  <LineChart data={series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis domain={[0, 100]} {...axisProps} width={44} unit="%" />
                    <Tooltip {...tooltipProps} formatter={(v) => [`${v}%`, "Accuracy"]} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} />
                    <Line dataKey="acc" stroke="var(--mint)" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ChartBox>
              </div>
            </Panel>
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Panel>
              <PanelHeader title="Subject-wise performance" hint="All mocks combined, % of section max" />
              <div className="px-2 pb-3">
                <ChartBox height={240} empty={subjAgg.length === 0} emptyTitle="No subject-wise marks yet">
                  <BarChart data={subjAgg} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} {...axisProps} unit="%" />
                    <YAxis type="category" dataKey="name" {...axisProps} width={80} />
                    <Tooltip {...tooltipProps} formatter={(v, _n, p) => [`${v}% across ${p.payload.n} mock section(s)`, "Score"]} />
                    <Bar maxBarSize={36} dataKey="pct" fill="var(--violet)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartBox>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Time allocation" hint="Minutes per subject (where recorded)" />
              <div className="px-2 pb-3">
                <ChartBox height={240} empty={!subjAgg.some((s) => s.time > 0)} emptyTitle="No time data" emptyBody="Add minutes per subject when recording a mock.">
                  <BarChart data={subjAgg.filter((s) => s.time > 0)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} interval={0} angle={-25} textAnchor="end" height={46} />
                    <YAxis {...axisProps} width={40} />
                    <Tooltip {...tooltipProps} formatter={(v) => [`${v} min`, "Time"]} />
                    <Bar maxBarSize={36} dataKey="time" fill="var(--cyan)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartBox>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Where marks were lost" hint="From each mock's audit" />
              <div className="px-2 pb-3">
                <ChartBox height={240} empty={!lostChart.some((x) => x.A + x.B + x.C + x.Unattempted > 0)} emptyTitle="No audits recorded" emptyBody="Fill in the lost-marks audit when recording a mock.">
                  <BarChart data={lostChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} width={40} />
                    <Tooltip {...tooltipProps} />
                    <RLegend wrapperStyle={{ fontSize: 11 }} />
                    <Bar maxBarSize={36} dataKey="A" stackId="l" fill={ERROR_TYPES.A.color} name="Type A" isAnimationActive={false} />
                    <Bar maxBarSize={36} dataKey="B" stackId="l" fill={ERROR_TYPES.B.color} name="Type B" isAnimationActive={false} />
                    <Bar maxBarSize={36} dataKey="C" stackId="l" fill={ERROR_TYPES.C.color} name="Type C" isAnimationActive={false} />
                    <Bar maxBarSize={36} dataKey="Unattempted" stackId="l" fill="var(--ink-3)" isAnimationActive={false} />
                  </BarChart>
                </ChartBox>
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Panel>
              <PanelHeader title={`All tests (${mocks.length})`} />
              <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
                {[...mocks].reverse().map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelected(m.id)} className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2", sel?.id === m.id && "bg-surface-2")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{m.name}</p>
                        <p className="text-xs text-ink-3">
                          {fmtDate(m.date)} · {KIND_LABEL[m.kind]}
                        </p>
                      </div>
                      <span className="num text-[13px] font-semibold">
                        {m.score}/{m.totalMarks}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
            {sel && (
              <Panel>
                <PanelHeader
                  title={sel.name}
                  hint={`${fmtDate(sel.date, { weekday: true, year: true })} · ${KIND_LABEL[sel.kind]}${sel.provider ? ` · ${sel.provider}` : ""}`}
                  action={
                    <>
                      <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setDialog(sel)}>
                        Edit / audit
                      </Button>
                      <Button size="sm" icon={<ListPlus size={14} />} onClick={() => auditToTasks(sel)}>
                        Weaknesses → tasks
                      </Button>
                    </>
                  }
                />
                <div className="grid grid-cols-2 gap-4 px-4 pb-3 sm:grid-cols-5">
                  {[
                    ["Score", `${sel.score}/${sel.totalMarks}`, `${r1(mockPct(sel))}%`],
                    ["vs previous", prev ? `${sel.score - prev.score >= 0 ? "+" : ""}${r1(sel.score - prev.score)}` : "—", prev ? (prev.totalMarks !== sel.totalMarks ? "different totals" : prev.name) : "first test"],
                    ["Accuracy", sel.correct + sel.incorrect ? `${r1((sel.correct / (sel.correct + sel.incorrect)) * 100)}%` : "—", `${sel.correct} ✓ · ${sel.incorrect} ✗ · ${sel.unattempted} skipped`],
                    ["Time", sel.timeUsedMin ? `${sel.timeUsedMin} min` : "—", sel.durationMin ? `of ${sel.durationMin}` : ""],
                    ["Provider rank", sel.providerRank ? `#${sel.providerRank}` : "—", sel.providerCandidates ? `of ${sel.providerCandidates} (not AIR)` : "not an AIR"],
                  ].map(([l, v, s]) => (
                    <div key={l}>
                      <p className="text-xs text-ink-3">{l}</p>
                      <p className="num text-lg font-semibold">{v}</p>
                      <p className="truncate text-xs text-ink-3">{s}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 border-t border-line px-4 py-4 md:grid-cols-2">
                  <div>
                    <p className="text-[13px] font-semibold">Lost marks audit</p>
                    {sel.lostMarks.A + sel.lostMarks.B + sel.lostMarks.C + sel.lostMarks.unattempted === 0 ? (
                      <p className="mt-1 text-xs text-ink-3">Not filled in. The PDF&apos;s rule: never close a mock without categorizing every lost mark.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-[13px]">
                        {(["A", "B", "C"] as const).map((k) => (
                          <li key={k} className="flex justify-between">
                            <span>
                              Type {k}: {ERROR_TYPES[k].name}
                            </span>
                            <span className="num">{sel.lostMarks[k]}</span>
                          </li>
                        ))}
                        <li className="flex justify-between">
                          <span>Unattempted / skipped</span>
                          <span className="num">{sel.lostMarks.unattempted}</span>
                        </li>
                      </ul>
                    )}
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => setErrDialog({ date: sel.date, source: "mock", mockId: sel.id, questionRef: `${sel.name} Q` })}>
                      Log an error from this mock
                    </Button>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">Subject marks</p>
                    {sel.subjectMarks.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-3">No section marks recorded.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-[13px]">
                        {sel.subjectMarks.map((s) => {
                          const p = prev?.subjectMarks.find((x) => x.subjectId === s.subjectId);
                          return (
                            <li key={s.subjectId} className="flex justify-between gap-2">
                              <span>{SUBJECT_MAP[s.subjectId].short}</span>
                              <span className="num">
                                {s.scored}/{s.max}
                                {p && p.max === s.max && <span className={cx("ml-1.5 text-xs", s.scored >= p.scored ? "text-mint" : "text-rose")}>{s.scored - p.scored >= 0 ? "+" : ""}{r1(s.scored - p.scored)}</span>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {sel.weakTopicIds.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold">Weak topics</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {sel.weakTopicIds.map((t) => (
                          <Badge key={t} tone="rose">
                            {TOPIC_MAP[t]?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {sel.actions.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold">Corrective actions</p>
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                        {sel.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sel.analysis && <p className="text-[13px] whitespace-pre-wrap text-ink-2 md:col-span-2">{sel.analysis}</p>}
                  {sel.rounds.some((r) => r.minutes) && <RoundCompare m={sel} rounds={data.settings.rounds} />}
                </div>
              </Panel>
            )}
          </div>
        </>
      )}

      <MockDialog open={!!dialog} initial={dialog} onClose={() => setDialog(null)} />
      <ErrorDialog open={!!errDialog} initial={errDialog} onClose={() => setErrDialog(null)} />
    </div>
  );
}

function RoundCompare({ m, rounds }: { m: MockTest; rounds: RoundStep[] }) {
  return (
    <div className="md:col-span-2">
      <p className="text-[13px] font-semibold">Round method: plan vs actual</p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
        {rounds.map((r) => {
          const actual = m.rounds.find((x) => x.round === r.round);
          const planned = r.endMin - r.startMin;
          const diff = actual?.minutes !== undefined ? actual.minutes - planned : null;
          return (
            <div key={r.round} className="rounded-md border border-line p-2.5 text-[13px]">
              <p className="text-xs text-ink-3">
                Round {r.round}: {r.title}
              </p>
              <p className="num">
                {actual?.minutes ?? "—"} min <span className="text-ink-3">/ {planned} planned</span>
              </p>
              {diff !== null && <p className={cx("text-xs", Math.abs(diff) <= 10 ? "text-mint" : "text-amber")}>{diff === 0 ? "On plan" : `${diff > 0 ? "+" : ""}${diff} min`}</p>}
              {actual?.attempted !== undefined && <p className="text-xs text-ink-3">{actual.attempted} questions</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanTab() {
  const data = useData();
  const toast = useToast();
  const [phases, setPhases] = useState<MockPhase[] | null>(null);
  const [rounds, setRounds] = useState<RoundStep[] | null>(null);
  if (!data) return null;
  const ph = phases ?? data.settings.mockPhases;
  const rd = rounds ?? data.settings.rounds;
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Mock-test season (from your PDF)"
          hint="Suggested phases from the uploaded plan — not official deadlines. Edit freely."
          action={
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setPhases(rebaseMockPhases(data.settings.syllabusEndDate, data.settings.examDate));
                toast({ tone: "info", title: "Phases recalculated", body: "From your syllabus end date to the exam date. Save to keep." });
              }}
            >
              Recalculate from exam date
            </Button>
          }
        />
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-3">
          {ph.map((p, i) => (
            <div key={p.id} className="rounded-md border border-line p-3">
              <p className="text-xs text-ink-3">Phase {p.id}</p>
              <Input aria-label={`Phase ${p.id} name`} value={p.name} onChange={(e) => setPhases(ph.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="mt-1 font-medium" />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Field label="Start">
                  <Input type="date" value={p.start} onChange={(e) => setPhases(ph.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                </Field>
                <Field label="End">
                  <Input type="date" value={p.end} onChange={(e) => setPhases(ph.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                </Field>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">{p.objective}</p>
              <Textarea aria-label={`Phase ${p.id} actions`} className="mt-2 text-[13px]" value={p.actions.join("\n")} onChange={(e) => setPhases(ph.map((x, j) => (j === i ? { ...x, actions: e.target.value.split("\n") } : x)))} />
            </div>
          ))}
        </div>
        {phases && (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" onClick={() => setPhases(null)}>
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await updateSettings({ mockPhases: phases.map((p) => ({ ...p, actions: p.actions.filter((a) => a.trim()) })) });
                setPhases(null);
                toast({ tone: "success", title: "Phases saved" });
              }}
            >
              Save phases
            </Button>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="The three-round exam method" hint="Your PDF's strategy for a 180-minute paper. Adjust the minutes, then compare with each mock's actual rounds." />
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-3">
          {rd.map((r, i) => (
            <div key={r.round} className="rounded-md border border-line p-3">
              <p className="text-[13.5px] font-semibold">
                Round {r.round}: {r.title}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Field label="From (min)">
                  <Input type="number" min={0} max={180} value={r.startMin} onChange={(e) => setRounds(rd.map((x, j) => (j === i ? { ...x, startMin: Number(e.target.value) } : x)))} />
                </Field>
                <Field label="To (min)">
                  <Input type="number" min={0} max={240} value={r.endMin} onChange={(e) => setRounds(rd.map((x, j) => (j === i ? { ...x, endMin: Number(e.target.value) } : x)))} />
                </Field>
              </div>
              <Textarea aria-label={`Round ${r.round} steps`} className="mt-2 text-[13px]" value={r.items.join("\n")} onChange={(e) => setRounds(rd.map((x, j) => (j === i ? { ...x, items: e.target.value.split("\n") } : x)))} />
            </div>
          ))}
        </div>
        {rounds && (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" onClick={() => setRounds(null)}>
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await updateSettings({ rounds: rounds.map((r) => ({ ...r, items: r.items.filter((x) => x.trim()) })) });
                setRounds(null);
                toast({ tone: "success", title: "Strategy saved" });
              }}
            >
              Save strategy
            </Button>
          </div>
        )}
        <RoundAverages />
      </Panel>
    </div>
  );
}

function RoundAverages() {
  const data = useData();
  if (!data) return null;
  const full = data.mocks.filter((m) => m.rounds.some((r) => r.minutes));
  if (!full.length) return <p className="border-t border-line px-4 py-3 text-xs text-ink-3">Record round minutes in a mock to compare your actual pacing with this plan.</p>;
  return (
    <div className="border-t border-line px-4 py-3">
      <p className="text-[13px] font-medium">Your average across {full.length} mock{full.length > 1 ? "s" : ""}</p>
      <div className="mt-1.5 flex flex-wrap gap-4 text-[13px]">
        {data.settings.rounds.map((r) => {
          const vals = full.map((m) => m.rounds.find((x) => x.round === r.round)?.minutes).filter((v): v is number => v !== undefined);
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return (
            <span key={r.round}>
              Round {r.round}: <span className="num font-semibold">{avg === null ? "—" : `${Math.round(avg)} min`}</span> <span className="text-ink-3">vs {r.endMin - r.startMin} planned</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function MocksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MocksInner />
    </Suspense>
  );
}
