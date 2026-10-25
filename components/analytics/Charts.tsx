"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend as RLegend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useToast } from "@/components/providers";
import type { Analytics } from "@/lib/analytics";
import type { AppData, QuestionType, SubjectId } from "@/types";
import { ChartBox, Legend, axisProps, tooltipProps } from "@/components/charts/chart-kit";
import { Rings } from "@/components/charts/Ring";
import { MonthHeatmap, WeekHeatmap } from "@/components/charts/Heatmap";
import { Badge, Button, Input, Panel, PanelHeader, Segmented, Select, cx } from "@/components/ui";
import { SubjectSelect, TopicSelect } from "@/components/pickers";
import { accuracyTimeline, aggregateHours, heatmapDays, recentVsEarlier, rollingAverage, type Granularity } from "@/lib/calc/stats";
import { errorDistribution, pareto } from "@/lib/calc/errors";
import { FUNNEL_CRITERIA, FUNNEL_LABEL, type FunnelStage } from "@/lib/calc/progress";
import { READINESS_LABEL, mockPct } from "@/lib/calc/readiness";
import { addDays, addMonths, daysInMonth, fmtDate, fmtHours, fmtMonth, startOfMonth } from "@/lib/date";
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP, topicsForSubject } from "@/data/syllabus";
import { ERROR_TYPES } from "@/data/plan";
import { addTask, ensureReview, updateSettings } from "@/lib/actions";
import type { ReadinessKey } from "@/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

// ------------------------------------------------------------- 1. Progress ring
export function ProgressRingPanel({ a }: { a: Analytics }) {
  const o = a.overall;
  const parts: { label: string; n: number; color: string }[] = [
    { label: "Mastered (meets criteria)", n: o.stageCounts.mastered, color: "var(--amber)" },
    { label: "Revised", n: o.stageCounts.revised, color: "var(--mint)" },
    { label: "Practicing", n: o.stageCounts.practicing, color: "var(--violet)" },
    { label: "Learning", n: o.stageCounts.learning, color: "var(--cyan)" },
    { label: "Not started", n: o.stageCounts.not_started, color: "var(--surface-3)" },
  ];
  return (
    <Panel>
      <PanelHeader title="Overall preparation" hint="Rings: outer = covered, middle = mastered. Counts are topics." />
      <div className="flex flex-col items-center gap-5 px-4 pb-4 sm:flex-row">
        <Rings
          size={170}
          stroke={14}
          gap={6}
          rings={[
            { value: o.completionPct, color: "var(--violet)", label: "Covered" },
            { value: o.masteryPct, color: "var(--amber)", label: "Mastered" },
          ]}
        >
          <div className="text-center">
            <p className="display num text-3xl">{Math.round(o.masteryPct)}%</p>
            <p className="text-[11px] text-ink-3">mastered</p>
          </div>
        </Rings>
        <div className="w-full flex-1">
          <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.n}`).join(", ")}>
            {parts.map((p) => (p.n ? <div key={p.label} style={{ width: `${(p.n / o.total) * 100}%`, background: p.color }} /> : null))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span className="flex-1 text-ink-2">{p.label}</span>
                <span className="num">{p.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            {o.covered} of {o.total} topics covered · {o.needsRevision} flagged “Revision needed” · {o.total - o.covered} remaining
          </p>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 2. Heatmap
export function ConsistencyPanel({ data, today }: { data: AppData; today: string }) {
  const [mode, setMode] = useState<"weeks" | "month">("weeks");
  const [month, setMonth] = useState(startOfMonth(today));
  const days = useMemo(
    () =>
      mode === "weeks"
        ? heatmapDays(data.sessions, data.tasks, data.dayLogs, addDays(today, -7 * 26 + 1), today, data.settings.dailyHourGoal * 60)
        : heatmapDays(data.sessions, data.tasks, data.dayLogs, month, addDays(month, daysInMonth(month) - 1), data.settings.dailyHourGoal * 60),
    [data, today, mode, month],
  );
  return (
    <Panel>
      <PanelHeader
        title="Study consistency"
        hint="Intensity = recorded study time vs your daily goal. A gap is a fresh start, not a failure."
        action={<Segmented size="sm" label="Heatmap view" value={mode} onChange={setMode} options={[{ value: "weeks", label: "26 weeks" }, { value: "month", label: "Month" }]} />}
      />
      <div className="px-4 pb-4">
        {mode === "weeks" ? (
          <WeekHeatmap days={days} />
        ) : (
          <div className="max-w-md">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))}>
                Previous
              </Button>
              <span className="font-medium">{fmtMonth(month)}</span>
              <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
                Next
              </Button>
            </div>
            <MonthHeatmap days={days} />
          </div>
        )}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 3. Study hours
export function HoursPanel({ data, today, subjectId }: { data: AppData; today: string; subjectId?: SubjectId }) {
  const [g, setG] = useState<Granularity>("day");
  const [range, setRange] = useState<"30" | "90" | "all">("30");
  const [subj, setSubj] = useState<SubjectId | undefined>(subjectId);
  const first = [...data.sessions.map((s) => s.date), ...data.tasks.map((t) => t.date)].filter((d) => d <= today).sort()[0];
  const from = range === "all" ? (first ?? addDays(today, -29)) : addDays(today, -Number(range) + 1);
  const buckets = aggregateHours(data.sessions, data.tasks, from, today, g, subj);
  const avg = rollingAverage(
    buckets.map((b) => b.actualMin / 60),
    g === "day" ? 7 : 4,
    g === "day" ? 3 : 2,
  );
  const chart = buckets.map((b, i) => ({ label: b.label, actual: r1(b.actualMin / 60), planned: r1(b.plannedMin / 60), avg: avg[i] === null ? null : r1(avg[i]!) }));
  const total = buckets.reduce((s, b) => s + b.actualMin, 0);
  const planned = buckets.reduce((s, b) => s + b.plannedMin, 0);
  return (
    <Panel>
      <PanelHeader
        title="Study hours"
        hint={`Recorded ${fmtHours(total)}h vs planned ${fmtHours(planned)}h in this range. Moving average shows the trend.`}
        action={
          <div className="flex flex-wrap gap-1.5">
            {!subjectId && <SubjectSelect ariaLabel="Hours subject filter" value={subj} onChange={setSubj} emptyLabel="All subjects" className="h-8 w-36 text-[13px]" />}
            <Segmented size="sm" label="Range" value={range} onChange={setRange} options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "all", label: "All" }]} />
            <Segmented size="sm" label="Granularity" value={g} onChange={setG} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          </div>
        }
      />
      <div className="px-2 pb-3">
        <ChartBox height={240} empty={total === 0 && planned === 0} emptyTitle="No study time recorded in this range" emptyBody="Use the focus timer or “Log study time” in the planner.">
          <ComposedChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={18} />
            <YAxis {...axisProps} width={40} unit="h" />
            <Tooltip {...tooltipProps} formatter={(v, n) => [v === null ? "—" : `${v} h`, n === "actual" ? "Recorded" : n === "planned" ? "Planned" : "Moving average"]} />
            <Bar maxBarSize={36} dataKey="actual" fill="var(--violet)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line dataKey="planned" stroke="var(--ink-3)" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            <Line dataKey="avg" stroke="var(--cyan)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ChartBox>
        <div className="mt-2 px-2">
          <Legend items={[{ label: "Recorded", color: "var(--violet)" }, { label: "Planned", color: "var(--ink-3)", dashed: true }, { label: "Moving average", color: "var(--cyan)" }]} />
          {g === "day" && chart.some((c) => c.actual > 11) && <p className="mt-1 text-xs text-amber">Some days exceed 11 hours. Sustainable pace beats peaks — protect sleep.</p>}
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 4. Mock scores
export function MockScorePanel({ data }: { data: AppData }) {
  const [subj, setSubj] = useState<SubjectId | undefined>();
  const mocks = [...data.mocks].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const rows = mocks
    .map((m) => {
      const s = subj ? m.subjectMarks.find((x) => x.subjectId === subj) : undefined;
      const pct = subj ? (s && s.max ? (s.scored / s.max) * 100 : null) : mockPct(m);
      return { m, pct };
    })
    .filter((r) => r.pct !== null);
  const avg = rollingAverage(
    rows.map((r) => r.pct),
    3,
    2,
  );
  const chart = rows.map((r, i) => ({
    date: fmtDate(r.m.date),
    pct: r1(r.pct!),
    avg: avg[i] === null ? null : r1(avg[i]!),
    change: i ? r1(r.pct! - rows[i - 1]!.pct!) : null,
    name: r.m.name,
    score: subj ? r.m.subjectMarks.find((x) => x.subjectId === subj)?.scored : r.m.score,
    max: subj ? r.m.subjectMarks.find((x) => x.subjectId === subj)?.max : r.m.totalMarks,
    acc: r.m.correct + r.m.incorrect ? r1((r.m.correct / (r.m.correct + r.m.incorrect)) * 100) : null,
  }));
  return (
    <Panel>
      <PanelHeader title="Mock test performance" hint="% of max marks, chronological. No projections." action={<SubjectSelect ariaLabel="Mock subject filter" value={subj} onChange={setSubj} emptyLabel="Overall" className="h-8 w-36 text-[13px]" />} />
      <div className="px-2 pb-3">
        <ChartBox height={240} empty={chart.length === 0} emptyTitle={data.mocks.length ? "No section marks for this subject" : "No mocks recorded"}>
          <LineChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} width={44} unit="%" />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(_, p) => {
                const x = p?.[0]?.payload;
                return x ? `${x.name} · ${x.date} · ${x.score}/${x.max}${x.acc !== null ? ` · ${x.acc}% accuracy` : ""}${x.change !== null ? ` · ${x.change >= 0 ? "+" : ""}${x.change} pts vs previous` : ""}` : "";
              }}
              formatter={(v, n) => [v === null ? "—" : `${v}%`, n === "pct" ? "Score" : "3-mock average"]}
            />
            <Line dataKey="pct" stroke="var(--violet)" strokeWidth={2.2} dot={{ r: 3.5 }} isAnimationActive={false} />
            <Line dataKey="avg" stroke="var(--cyan)" strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 5. Subject mastery bars
type SubjMetric = "completion" | "accuracy" | "confidence";
type SubjSort = "weakest" | "strongest" | "priority" | "recent";
export function SubjectBarsPanel({ a }: { a: Analytics }) {
  const router = useRouter();
  const [metric, setMetric] = useState<SubjMetric>("completion");
  const [sort, setSort] = useState<SubjSort>("weakest");
  const rows = a.subjectStats.map((s) => {
    const v = metric === "completion" ? s.completionPct : metric === "accuracy" ? s.accuracy : s.avgConfidence === null ? null : (s.avgConfidence / 5) * 100;
    const n = metric === "accuracy" ? s.attempted : metric === "confidence" ? s.ratedCount : s.total;
    return { id: s.subjectId, name: SUBJECT_MAP[s.subjectId].short, value: v === null ? 0 : r1(v), has: v !== null, n, tier: SUBJECT_MAP[s.subjectId].tier, last: s.lastStudied ?? "", color: SUBJECT_MAP[s.subjectId].color, raw: s };
  });
  rows.sort((x, y) => {
    if (sort === "priority") return x.tier - y.tier || y.value - x.value;
    if (sort === "recent") return y.last.localeCompare(x.last);
    if (!x.has && y.has) return 1;
    if (x.has && !y.has) return -1;
    return sort === "weakest" ? x.value - y.value : y.value - x.value;
  });
  return (
    <Panel>
      <PanelHeader
        title="Subject mastery"
        hint="Click a bar to open the subject's analytics."
        action={
          <div className="flex flex-wrap gap-1.5">
            <Segmented size="sm" label="Metric" value={metric} onChange={setMetric} options={[{ value: "completion", label: "Coverage" }, { value: "accuracy", label: "Accuracy" }, { value: "confidence", label: "Confidence" }]} />
            <Select aria-label="Sort subjects" value={sort} onChange={(e) => setSort(e.target.value as SubjSort)} className="h-8 w-32 text-[13px]">
              <option value="weakest">Weakest first</option>
              <option value="strongest">Strongest first</option>
              <option value="priority">PDF tier</option>
              <option value="recent">Recently studied</option>
            </Select>
          </div>
        }
      />
      <div className="px-2 pb-3">
        <ChartBox height={340}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 6, bottom: 0 }} onClick={(e) => { const id = (e as unknown as { activePayload?: { payload: { id: string } }[] })?.activePayload?.[0]?.payload.id; if (id) router.push(`/analytics/subject/${id}`); }}>
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} {...axisProps} unit="%" />
            <YAxis type="category" dataKey="name" {...axisProps} width={84} />
            <Tooltip
              {...tooltipProps}
              formatter={(v, _n, p) => {
                const x = p.payload as (typeof rows)[number];
                if (!x.has) return ["No data", metric];
                return [metric === "confidence" ? `${r1((x.value / 100) * 5)}/5 avg over ${x.n} rated topics` : metric === "accuracy" ? `${v}% on ${x.n} attempts` : `${v}% (${x.raw.covered}/${x.raw.total} topics)`, metric === "completion" ? "Coverage" : metric === "accuracy" ? "Accuracy" : "Confidence"];
              }}
            />
            <Bar maxBarSize={36} dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer" isAnimationActive={false} label={{ position: "right", fill: "var(--ink-3)", fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
              {rows.map((r) => (
                <Cell key={r.id} fill={r.has ? r.color : "var(--surface-3)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartBox>
        {metric !== "completion" && <p className="px-2 text-xs text-ink-3">Grey bars have no data yet for this metric.</p>}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 6. Accuracy trend
export function AccuracyPanel({ data, subjectId }: { data: AppData; subjectId?: SubjectId }) {
  const [subj, setSubj] = useState<SubjectId | undefined>(subjectId);
  const [topic, setTopic] = useState<string | undefined>();
  const [qt, setQt] = useState<QuestionType | "">("");
  const [g, setG] = useState<Granularity>("week");
  const pyqs = data.pyqs.filter((p) => (!subj || p.subjectId === subj) && (!topic || p.topicId === topic) && (!qt || p.qtype === qt));
  const tl = accuracyTimeline(pyqs, g).map((p) => ({ ...p, accuracy: p.accuracy === null ? null : r1(p.accuracy), cumulativeAccuracy: p.cumulativeAccuracy === null ? null : r1(p.cumulativeAccuracy) }));
  const n = Math.min(20, Math.floor(pyqs.filter((p) => p.result !== "unattempted").length / 2));
  const cmp = n >= 10 ? recentVsEarlier(pyqs, n) : null;
  return (
    <Panel>
      <PanelHeader
        title="PYQ accuracy trend"
        hint="Bars show how many attempts each point is based on."
        action={
          <div className="flex flex-wrap gap-1.5">
            {!subjectId && <SubjectSelect ariaLabel="Accuracy subject filter" value={subj} onChange={(s) => { setSubj(s); setTopic(undefined); }} emptyLabel="All subjects" className="h-8 w-36 text-[13px]" />}
            <TopicSelect ariaLabel="Accuracy topic filter" subjectId={subj} value={topic} onChange={setTopic} emptyLabel="All topics" className="h-8 w-40 text-[13px]" />
            <Select aria-label="Question type filter" value={qt} onChange={(e) => setQt(e.target.value as QuestionType | "")} className="h-8 w-24 text-[13px]">
              <option value="">All types</option>
              <option>MCQ</option>
              <option>MSQ</option>
              <option>NAT</option>
            </Select>
            <Segmented size="sm" label="Period" value={g} onChange={setG} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          </div>
        }
      />
      <div className="px-2 pb-3">
        <ChartBox height={240} empty={tl.length === 0} emptyTitle="No PYQ attempts match">
          <ComposedChart data={tl} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis yAxisId="acc" domain={[0, 100]} {...axisProps} width={44} unit="%" />
            <YAxis yAxisId="n" orientation="right" allowDecimals={false} {...axisProps} width={30} />
            <Tooltip {...tooltipProps} formatter={(v, nm) => (nm === "attempted" ? [v, "Attempts"] : [`${v}%`, nm === "accuracy" ? "Accuracy" : "Cumulative"])} />
            <Bar maxBarSize={36} yAxisId="n" dataKey="attempted" fill="var(--surface-3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="acc" dataKey="accuracy" stroke="var(--violet)" strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
            <Line yAxisId="acc" dataKey="cumulativeAccuracy" stroke="var(--cyan)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartBox>
        <div className="mt-2 px-2 text-[13px]">
          {cmp ? (
            <p>
              Last {cmp.n} attempts: <b className="num">{Math.round(cmp.recent)}%</b> vs previous {cmp.n}: <b className="num">{Math.round(cmp.earlier)}%</b>{" "}
              <span className={cx("num", cmp.delta >= 0 ? "text-mint" : "text-rose")}>
                ({cmp.delta >= 0 ? "+" : ""}
                {Math.round(cmp.delta)} pts)
              </span>
            </p>
          ) : (
            <p className="text-xs text-ink-3">Need at least 20 answered attempts in this filter to compare recent vs earlier performance.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 7. Topic matrix
const STAGE_STYLE: Record<FunnelStage, { bg: string; letter: string; fg: string }> = {
  not_started: { bg: "var(--surface-3)", letter: "·", fg: "var(--ink-3)" },
  learning: { bg: "var(--cyan-soft)", letter: "L", fg: "var(--cyan)" },
  practicing: { bg: "var(--violet-soft)", letter: "P", fg: "var(--violet-2)" },
  revised: { bg: "var(--mint-soft)", letter: "R", fg: "var(--mint)" },
  mastered: { bg: "var(--amber)", letter: "M", fg: "#1a1530" },
};

export function TopicMatrixPanel({ a }: { a: Analytics }) {
  const today = a.today;
  return (
    <Panel>
      <PanelHeader title="Topic mastery matrix" hint="Each cell is one topic. Letter = stage; red ring = revision overdue; rose dot = accuracy under 50% (5+ attempts). Click to open." />
      <div className="space-y-2 px-4 pb-3">
        {SUBJECTS.map((s) => (
          <div key={s.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <span className="w-28 shrink-0 truncate text-[12.5px] text-ink-2">{s.short}</span>
            <div className="flex flex-wrap gap-1">
              {topicsForSubject(s.id).map((t) => {
                const st = a.topicStats.get(t.id)!;
                const style = STAGE_STYLE[st.stage];
                const overdue = !!st.progress.nextRevision && st.progress.nextRevision < today;
                const weak = st.attempted >= 5 && (st.accuracy ?? 100) < 50;
                const label = `${t.name}: ${FUNNEL_LABEL[st.stage]}${st.accuracy !== null ? `, ${Math.round(st.accuracy)}% on ${st.attempted}` : ""}${overdue ? ", revision overdue" : ""}`;
                return (
                  <Link
                    key={t.id}
                    href={`/topics/${t.id}`}
                    title={label}
                    aria-label={label}
                    className={cx("relative flex h-6 w-6 items-center justify-center rounded text-[10.5px] font-semibold transition-transform hover:scale-110", overdue && "ring-2 ring-rose")}
                    style={{ background: style.bg, color: style.fg }}
                  >
                    {style.letter}
                    {weak && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose" aria-hidden />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3 border-t border-line pt-2 text-[11.5px] text-ink-3">
          {(Object.keys(STAGE_STYLE) as FunnelStage[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold" style={{ background: STAGE_STYLE[k].bg, color: STAGE_STYLE[k].fg }}>
                {STAGE_STYLE[k].letter}
              </span>
              {FUNNEL_LABEL[k]}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-4 w-4 rounded ring-2 ring-rose" /> Revision overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose" /> Weak accuracy
          </span>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 8. Error distribution by subject
export function ErrorDistributionPanel({ data, today }: { data: AppData; today: string }) {
  const [range, setRange] = useState<"30" | "90" | "all">("all");
  const [subj, setSubj] = useState<SubjectId | undefined>();
  const errs = data.errors.filter((e) => (range === "all" || e.date >= addDays(today, -Number(range) + 1)) && (!subj || e.subjectId === subj));
  const dist = errorDistribution(errs);
  const bySubject = SUBJECTS.map((s) => {
    const l = errs.filter((e) => e.subjectId === s.id);
    return { name: s.short, A: l.filter((e) => e.type === "A").length, B: l.filter((e) => e.type === "B").length, C: l.filter((e) => e.type === "C").length, total: l.length };
  }).filter((x) => x.total);
  return (
    <Panel>
      <PanelHeader
        title="Error distribution"
        hint="Your PDF's matrix: A conceptual, B silly/calculation, C misread."
        action={
          <div className="flex gap-1.5">
            <SubjectSelect ariaLabel="Error subject filter" value={subj} onChange={setSubj} emptyLabel="All subjects" className="h-8 w-36 text-[13px]" />
            <Segmented size="sm" label="Period" value={range} onChange={setRange} options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "all", label: "All" }]} />
          </div>
        }
      />
      <div className="grid gap-4 px-4 pb-4 md:grid-cols-[200px_1fr]">
        <ul className="space-y-2 text-[13px]">
          {dist.types.map((t) => (
            <li key={t.type}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ERROR_TYPES[t.type].color }} />
                  Type {t.type}: {ERROR_TYPES[t.type].name}
                </span>
              </div>
              <p className="num pl-[18px] text-xs text-ink-3">
                {t.count} ({Math.round(t.pct)}%) · {r1(t.marks)} marks
              </p>
            </li>
          ))}
          <li className="pt-1 text-xs text-ink-3">{dist.total} errors in this view</li>
        </ul>
        <ChartBox height={220} empty={bySubject.length === 0} emptyTitle="No errors in this period">
          <BarChart data={bySubject} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval={0} angle={-25} textAnchor="end" height={48} />
            <YAxis {...axisProps} allowDecimals={false} width={36} />
            <Tooltip {...tooltipProps} />
            <RLegend wrapperStyle={{ fontSize: 11 }} />
            <Bar maxBarSize={36} dataKey="A" stackId="e" fill={ERROR_TYPES.A.color} name="Type A" isAnimationActive={false} />
            <Bar maxBarSize={36} dataKey="B" stackId="e" fill={ERROR_TYPES.B.color} name="Type B" isAnimationActive={false} />
            <Bar maxBarSize={36} dataKey="C" stackId="e" fill={ERROR_TYPES.C.color} name="Type C" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 9. Pareto
export function ParetoPanel({ data, today }: { data: AppData; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const p = pareto(data.errors, (e) => e.topicId);
  const rows = p.rows.slice(0, 12).map((r) => ({ ...r, name: TOPIC_MAP[r.key]?.name ?? r.key, short: (TOPIC_MAP[r.key]?.name ?? r.key).slice(0, 18), cumulativePct: r1(r.cumulativePct), value: r1(r.value) }));
  const top80 = p.rows.findIndex((r) => r.cumulativePct >= 80) + 1;
  return (
    <Panel>
      <PanelHeader title="Repeated mistakes — Pareto" hint={p.basis === "marks" ? "Topics by recorded marks lost; line = cumulative share" : "No marks recorded, so ranked by occurrences (incl. repeats)"} />
      <div className="px-2 pb-3">
        <ChartBox height={260} empty={rows.length === 0} emptyTitle="No errors with topics yet">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={(e) => { const k = (e as unknown as { activePayload?: { payload: { key: string } }[] })?.activePayload?.[0]?.payload.key; if (k) setPicked(k); }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="short" {...axisProps} interval={0} angle={-30} textAnchor="end" height={64} />
            <YAxis yAxisId="v" {...axisProps} width={40} />
            <YAxis yAxisId="c" orientation="right" domain={[0, 100]} {...axisProps} width={40} unit="%" />
            <Tooltip {...tooltipProps} labelFormatter={(_, pl) => pl?.[0]?.payload?.name ?? ""} formatter={(v, n, pl) => (n === "cumulativePct" ? [`${v}%`, "Cumulative share"] : [`${v} (${pl.payload.count} entries)`, p.basis === "marks" ? "Marks lost" : "Occurrences"])} />
            <Bar maxBarSize={36} yAxisId="v" dataKey="value" fill="var(--rose)" radius={[3, 3, 0, 0]} cursor="pointer" isAnimationActive={false} />
            <Line yAxisId="c" dataKey="cumulativePct" stroke="var(--amber)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartBox>
        {top80 > 0 && rows.length > 2 && (
          <p className="mt-1 px-2 text-[13px] text-ink-2">
            {top80} topic{top80 > 1 ? "s" : ""} account{top80 === 1 ? "s" : ""} for 80% of recorded {p.basis === "marks" ? "lost marks" : "mistakes"}.
          </p>
        )}
        {picked && (
          <div className="mx-2 mt-2 flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg-2 p-2.5 text-[13px]">
            <span className="mr-auto font-medium">{TOPIC_MAP[picked]?.name}</span>
            <Button size="sm" onClick={() => router.push(`/errors?topic=${picked}&status=`)}>
              Open error log
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                await ensureReview("topic", picked, today);
                await addTask({ date: today, title: `Targeted revision: ${TOPIC_MAP[picked]?.name}`, topicId: picked, subjectId: TOPIC_MAP[picked]?.subjectId, plannedMin: 60, source: "recommendation", block: 3 });
                toast({ tone: "success", title: "Revision task created for today" });
                setPicked(null);
              }}
            >
              Create revision task
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Close
            </Button>
          </div>
        )}
        {!picked && rows.length > 0 && <p className="mt-1 px-2 text-xs text-ink-3">Click a bar for actions.</p>}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 10. Revision health
export function RevisionHealthPanel({ data, a }: { data: AppData; a: Analytics }) {
  const today = a.today;
  const next7 = a.reviews.upcoming.filter((r) => r.due <= addDays(today, 7)).length;
  const later = a.reviews.upcoming.length - next7;
  const logs = data.reviews.flatMap((r) => r.history);
  const onTime = logs.filter((h) => h.onTime).length;
  const chart = [
    { name: "Overdue", n: a.reviews.overdue.length, color: "var(--rose)" },
    { name: "Due today", n: a.reviews.today.length, color: "var(--amber)" },
    { name: "Next 7 days", n: next7, color: "var(--violet)" },
    { name: "Later", n: later, color: "var(--surface-3)" },
  ];
  // Accuracy before vs after first completed review, for topics with ≥3 attempts on each side
  const ba: { name: string; before: number; after: number; nb: number; na: number }[] = [];
  for (const r of data.reviews) {
    if (r.kind !== "topic" || !r.history.length) continue;
    const first = r.history[0]!.date;
    const att = data.pyqs.filter((p) => p.topicId === r.refId && p.result !== "unattempted");
    const b = att.filter((p) => p.date < first);
    const af = att.filter((p) => p.date >= first);
    if (b.length >= 3 && af.length >= 3) {
      const acc = (l: typeof att) => (l.filter((p) => p.result === "correct").length / l.length) * 100;
      ba.push({ name: TOPIC_MAP[r.refId]?.name ?? r.refId, before: r1(acc(b)), after: r1(acc(af)), nb: b.length, na: af.length });
    }
  }
  return (
    <Panel>
      <PanelHeader title="Revision health" hint={logs.length ? `${onTime} of ${logs.length} reviews done on time (${Math.round((onTime / logs.length) * 100)}%)` : "No reviews completed yet"} action={<Link href="/revision"><Button size="sm" variant={a.reviews.overdue.length + a.reviews.today.length ? "primary" : "secondary"}>{a.reviews.overdue.length + a.reviews.today.length ? `Revise ${a.reviews.overdue.length + a.reviews.today.length} now` : "Open revision"}</Button></Link>} />
      <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
        <ChartBox height={200} empty={chart.every((c) => c.n === 0)} emptyTitle="Nothing scheduled yet">
          <BarChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} width={36} />
            <Tooltip {...tooltipProps} formatter={(v) => [v, "Items"]} />
            <Bar maxBarSize={36} dataKey="n" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {chart.map((c) => (
                <Cell key={c.name} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartBox>
        <div>
          <p className="text-[13px] font-medium">Accuracy before vs after first revision</p>
          {ba.length === 0 ? (
            <p className="mt-1 text-xs text-ink-3">Needs topics with at least 3 logged attempts both before and after their first completed revision.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {ba.slice(0, 6).map((x) => (
                <li key={x.name} className="flex justify-between gap-2">
                  <span className="truncate">{x.name}</span>
                  <span className="num shrink-0">
                    {x.before}% → <span className={x.after >= x.before ? "text-mint" : "text-rose"}>{x.after}%</span>{" "}
                    <span className="text-xs text-ink-3">
                      (n={x.nb}/{x.na})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 11. Funnel
export function FunnelPanel({ a }: { a: Analytics }) {
  const order: FunnelStage[] = ["not_started", "learning", "practicing", "revised", "mastered"];
  const total = a.overall.total;
  // Cumulative: how many topics reached at least this stage
  const rank = (s: FunnelStage) => order.indexOf(s);
  const reached = order.map((s) => [...a.topicStats.values()].filter((t) => rank(t.stage) >= rank(s)).length);
  return (
    <Panel>
      <PanelHeader title="Preparation funnel" hint="Topics that have reached at least each stage." />
      <ul className="space-y-2.5 px-4 pb-4">
        {order.map((s, i) => (
          <li key={s}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{i === 0 ? "All topics" : FUNNEL_LABEL[s]}</span>
              <span className="num text-ink-2">
                {reached[i]} <span className="text-xs text-ink-3">({Math.round((reached[i]! / total) * 100)}%) · {a.overall.stageCounts[s]} currently here</span>
              </span>
            </div>
            <div className="mt-1 h-5 rounded bg-surface-3/60">
              <div className="h-full rounded transition-[width] duration-700" style={{ width: `${(reached[i]! / total) * 100}%`, background: ["var(--ink-3)", "var(--cyan)", "var(--violet)", "var(--mint)", "var(--amber)"][i] }} />
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-3">{FUNNEL_CRITERIA[s]}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ------------------------------------------------------------- 12. Readiness scorecard
export function ReadinessPanel({ data, a }: { data: AppData; a: Analytics }) {
  const toast = useToast();
  const [w, setW] = useState<Record<ReadinessKey, number> | null>(null);
  const weights = w ?? data.settings.readinessWeights;
  const r = a.readiness;
  return (
    <Panel>
      <PanelHeader title="Readiness scorecard" hint="Transparent components. This is not an official GATE prediction or a probability of IISc admission." />
      <div className="grid gap-3 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.components.map((c) => (
          <div key={c.key} className={cx("rounded-md border p-3", c.sufficient ? "border-line" : "border-dashed border-line")}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium">{c.label}</p>
              {!c.sufficient && <Badge tone="amber">Insufficient data</Badge>}
            </div>
            <p className="num mt-1 text-2xl font-semibold">{c.value === null ? "—" : `${Math.round(c.value)}%`}</p>
            <p className="text-xs text-ink-2">{c.data}</p>
            <p className="mt-1.5 text-[11.5px] text-ink-3">Formula: {c.formula}</p>
            <p className="text-[11.5px] text-ink-3">Needs: {c.minData}</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-3">
              Weight
              <Input type="number" min={0} max={100} value={weights[c.key]} onChange={(e) => setW({ ...weights, [c.key]: Math.max(0, Number(e.target.value) || 0) })} className="h-7 w-16 text-xs" aria-label={`${READINESS_LABEL[c.key]} weight`} />
            </label>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 rounded-md border border-line bg-bg-2 p-3.5">
        {r.composite === null ? (
          <p className="text-[13px] text-ink-2">
            <b>Composite: insufficient data.</b> {r.reason}
          </p>
        ) : (
          <p className="text-[13px] text-ink-2">
            <b className="num text-ink">Composite {Math.round(r.composite)} / 100</b> — weighted average of components with enough data (weights shown above, renormalised to {r.usedWeight}).
          </p>
        )}
        <p className="mt-1.5 text-xs text-ink-3">
          Limitations: self-rated statuses and confidence are subjective; mock difficulty varies by provider; PYQ accuracy depends on which questions you chose; none of this maps reliably to an AIR or an admission outcome.
        </p>
        {w && (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                await updateSettings({ readinessWeights: weights });
                setW(null);
                toast({ tone: "success", title: "Weights saved" });
              }}
            >
              Save weights
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setW(null)}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- 13. Radar
export function RadarPanel({ a }: { a: Analytics }) {
  const [mode, setMode] = useState<"radar" | "bars">("bars");
  const [subs, setSubs] = useState<SubjectId[]>(() => a.subjectStats.slice().sort((x, y) => SUBJECT_MAP[x.subjectId].tier - SUBJECT_MAP[y.subjectId].tier).slice(0, 3).map((s) => s.subjectId));
  const metrics = [
    { key: "completion", label: "Coverage" },
    { key: "confidence", label: "Confidence" },
    { key: "accuracy", label: "PYQ accuracy" },
    { key: "revision", label: "Revision coverage" },
  ] as const;
  const val = (sid: SubjectId, k: (typeof metrics)[number]["key"]) => {
    const s = a.subjectStats.find((x) => x.subjectId === sid)!;
    if (k === "completion") return r1(s.completionPct);
    if (k === "confidence") return s.avgConfidence === null ? 0 : r1((s.avgConfidence / 5) * 100);
    if (k === "accuracy") return s.accuracy === null ? 0 : r1(s.accuracy);
    return r1(s.revisionCoveragePct);
  };
  const radarData = metrics.map((m) => ({ metric: m.label, ...Object.fromEntries(subs.map((s) => [s, val(s, m.key)])) }));
  const barData = subs.map((s) => ({ name: SUBJECT_MAP[s].short, ...Object.fromEntries(metrics.map((m) => [m.label, val(s, m.key)])) }));
  const colors = ["var(--violet)", "var(--cyan)", "var(--amber)", "var(--mint)"];
  return (
    <Panel>
      <PanelHeader
        title="Subject comparison"
        hint="All metrics on a 0–100 scale. Confidence 5/5 = 100. Missing data plots as 0 — check the subject page."
        action={<Segmented size="sm" label="Chart type" value={mode} onChange={setMode} options={[{ value: "bars", label: "Bars" }, { value: "radar", label: "Radar" }]} />}
      />
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => {
            const on = subs.includes(s.id);
            return (
              <button key={s.id} type="button" aria-pressed={on} disabled={!on && subs.length >= 4} onClick={() => setSubs(on ? subs.filter((x) => x !== s.id) : [...subs, s.id])} className={cx("rounded-md border px-2 py-1 text-xs disabled:opacity-40", on ? "border-violet bg-violet-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>
                {s.short}
              </button>
            );
          })}
          <span className="self-center text-xs text-ink-3">up to 4</span>
        </div>
      </div>
      <div className="px-2 pb-3">
        <ChartBox height={280} empty={subs.length === 0} emptyTitle="Pick subjects to compare">
          {mode === "radar" ? (
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--ink-2)", fontSize: 11.5 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--ink-3)", fontSize: 10 }} angle={90} />
              {subs.map((s, i) => (
                <Radar key={s} name={SUBJECT_MAP[s].short} dataKey={s} stroke={colors[i]} fill={colors[i]} fillOpacity={0.12} isAnimationActive={false} />
              ))}
              <RLegend wrapperStyle={{ fontSize: 11.5 }} />
              <Tooltip {...tooltipProps} />
            </RadarChart>
          ) : (
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} width={40} />
              <Tooltip {...tooltipProps} />
              <RLegend wrapperStyle={{ fontSize: 11.5 }} />
              {metrics.map((m, i) => (
                <Bar key={m.key} dataKey={m.label} fill={colors[i]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          )}
        </ChartBox>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- Five-second summary
export function FiveSecondSummary({ data, a }: { data: AppData; a: Analytics }) {
  const answered = data.pyqs.filter((p) => p.result !== "unattempted").length;
  const n = Math.min(20, Math.floor(answered / 2));
  const cmp = n >= 10 ? recentVsEarlier(data.pyqs, n) : null;
  const mocks = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date));
  const lastTwo = mocks.slice(-2);
  const mockDelta = lastTwo.length === 2 ? mockPct(lastTwo[1]!) - mockPct(lastTwo[0]!) : null;

  let improving = "Not enough data yet — log 20+ PYQs or two mocks.";
  let tone: "mint" | "rose" | "neutral" = "neutral";
  if (cmp) {
    improving = `PYQ accuracy ${cmp.delta >= 0 ? "up" : "down"} ${Math.abs(Math.round(cmp.delta))} pts (last ${cmp.n} vs previous ${cmp.n}).`;
    tone = cmp.delta >= 0 ? "mint" : "rose";
  } else if (mockDelta !== null) {
    improving = `Latest mock ${mockDelta >= 0 ? "+" : ""}${r1(mockDelta)} pts vs the one before.`;
    tone = mockDelta >= 0 ? "mint" : "rose";
  }

  const best = (() => {
    const since = addDays(a.today, -14);
    const mid = addDays(a.today, -7);
    let top: { s: SubjectId; d: number } | null = null;
    for (const s of SUBJECTS) {
      const recent = data.pyqs.filter((p) => p.subjectId === s.id && p.result !== "unattempted" && p.date > mid);
      const prev = data.pyqs.filter((p) => p.subjectId === s.id && p.result !== "unattempted" && p.date > since && p.date <= mid);
      if (recent.length < 5 || prev.length < 5) continue;
      const acc = (l: typeof recent) => (l.filter((p) => p.result === "correct").length / l.length) * 100;
      const d = acc(recent) - acc(prev);
      if (d > 0 && (!top || d > top.d)) top = { s: s.id, d };
    }
    if (top) return `${SUBJECT_MAP[top.s].short}: +${Math.round(top.d)} pts accuracy this week vs last.`;
    const mastered = [...a.topicStats.values()].filter((t) => t.meetsMastery).length;
    return mastered ? `${mastered} topic${mastered > 1 ? "s" : ""} meet your mastery criteria.` : "Needs 5+ attempts per subject in each of the last two weeks.";
  })();

  const holding = (() => {
    const p = pareto(data.errors, (e) => e.topicId);
    if (p.rows[0]) return `${TOPIC_MAP[p.rows[0].key]?.name}: ${r1(p.rows[0].value)} ${p.basis === "marks" ? "marks lost" : "recorded mistakes"}.`;
    if (a.weakestSubjects[0]) return `${SUBJECT_MAP[a.weakestSubjects[0].subjectId].short}: ${Math.round(a.weakestSubjects[0].accuracy ?? 0)}% on ${a.weakestSubjects[0].attempted} PYQs.`;
    if (a.reviews.overdue.length) return `${a.reviews.overdue.length} overdue revisions.`;
    return "Log errors and PYQs to find out.";
  })();

  const cards = [
    { q: "Am I improving?", a: improving, tone },
    { q: "What's getting better?", a: best, tone: "neutral" as const },
    { q: "What's holding me back?", a: holding, tone: "neutral" as const },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <Panel key={c.q} className="p-4">
          <p className="text-xs text-ink-3">{c.q}</p>
          <p className={cx("mt-1 text-[14px] leading-snug", c.tone === "mint" ? "text-mint" : c.tone === "rose" ? "text-rose" : "text-ink")}>{c.a}</p>
        </Panel>
      ))}
    </div>
  );
}
