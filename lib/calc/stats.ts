import type { DayLog, PyqAttempt, StudySession, SubjectId, Task } from "@/types";
import { addDays, dateRange, diffDays, fmtDate, fmtMonth, startOfMonth, startOfWeek } from "@/lib/date";

/** Trailing moving average. Returns null until `minPeriods` values are available. */
export function rollingAverage(values: (number | null)[], window: number, minPeriods = window): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null && Number.isFinite(v));
    out.push(slice.length >= minPeriods ? slice.reduce((a, b) => a + b, 0) / slice.length : null);
  }
  return out;
}

export function minutesByDate(sessions: StudySession[], subjectId?: SubjectId): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    if (subjectId && s.subjectId !== subjectId) continue;
    m.set(s.date, (m.get(s.date) ?? 0) + s.minutes);
  }
  return m;
}

export type Granularity = "day" | "week" | "month";

export interface HourBucket {
  key: string;
  label: string;
  actualMin: number;
  plannedMin: number;
}

function bucketKey(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "week") return startOfWeek(date);
  return startOfMonth(date);
}

/** Aggregates recorded (sessions) and planned (tasks) minutes into day/week/month buckets over [from, to]. */
export function aggregateHours(
  sessions: StudySession[],
  tasks: Task[],
  from: string,
  to: string,
  g: Granularity,
  subjectId?: SubjectId,
): HourBucket[] {
  const buckets = new Map<string, HourBucket>();
  for (const d of dateRange(from, to)) {
    const k = bucketKey(d, g);
    if (!buckets.has(k)) {
      const label = g === "day" ? fmtDate(d) : g === "week" ? `Wk of ${fmtDate(k)}` : fmtMonth(k);
      buckets.set(k, { key: k, label, actualMin: 0, plannedMin: 0 });
    }
  }
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    if (subjectId && s.subjectId !== subjectId) continue;
    const b = buckets.get(bucketKey(s.date, g));
    if (b) b.actualMin += s.minutes;
  }
  for (const t of tasks) {
    if (t.date < from || t.date > to || t.status === "skipped") continue;
    if (subjectId && t.subjectId !== subjectId) continue;
    const b = buckets.get(bucketKey(t.date, g));
    if (b) b.plannedMin += t.plannedMin;
  }
  return [...buckets.values()];
}

export interface StreakInfo {
  current: number;
  best: number;
  studiedToday: boolean;
  qualifyingDays: number;
}

/** A day counts when recorded study minutes ≥ minMinutes. Today not yet qualifying doesn't break the streak. */
export function computeStreaks(sessions: StudySession[], today: string, minMinutes: number): StreakInfo {
  const byDate = minutesByDate(sessions);
  const days = [...byDate.entries()].filter(([, m]) => m >= minMinutes).map(([d]) => d).sort();
  const set = new Set(days);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const studiedToday = set.has(today);
  let cursor = studiedToday ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best, studiedToday, qualifyingDays: days.length };
}

export type HeatState = "no-data" | "zero" | "rest" | "studied";

export interface HeatDay {
  date: string;
  minutes: number;
  tasksDone: number;
  tasksPlanned: number;
  subjects: SubjectId[];
  state: HeatState;
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * "no-data" = nothing recorded or planned that day.
 * "zero" = tasks were planned or a day log exists, but no study time was recorded.
 * "rest" = you marked it a rest day.
 */
export function heatmapDays(sessions: StudySession[], tasks: Task[], dayLogs: DayLog[], from: string, to: string, dailyGoalMin: number): HeatDay[] {
  const mins = new Map<string, number>();
  const subj = new Map<string, Set<SubjectId>>();
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    mins.set(s.date, (mins.get(s.date) ?? 0) + s.minutes);
    if (s.subjectId) {
      const set = subj.get(s.date) ?? new Set();
      set.add(s.subjectId);
      subj.set(s.date, set);
    }
  }
  const planned = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of tasks) {
    if (t.date < from || t.date > to) continue;
    planned.set(t.date, (planned.get(t.date) ?? 0) + 1);
    if (t.status === "done") done.set(t.date, (done.get(t.date) ?? 0) + 1);
  }
  const logs = new Map(dayLogs.map((l) => [l.date, l]));
  const goal = Math.max(30, dailyGoalMin);
  return dateRange(from, to).map((date) => {
    const minutes = mins.get(date) ?? 0;
    const log = logs.get(date);
    let state: HeatState;
    if (minutes > 0) state = "studied";
    else if (log?.restDay) state = "rest";
    else if ((planned.get(date) ?? 0) > 0 || log) state = "zero";
    else state = "no-data";
    const ratio = minutes / goal;
    const level = (minutes <= 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.6 ? 2 : ratio < 1 ? 3 : 4) as HeatDay["level"];
    return {
      date,
      minutes,
      tasksDone: done.get(date) ?? 0,
      tasksPlanned: planned.get(date) ?? 0,
      subjects: [...(subj.get(date) ?? [])],
      state,
      level,
    };
  });
}

export interface AccuracyPoint {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  accuracy: number | null;
  cumulativeAccuracy: number | null;
}

/** PYQ accuracy per day/week/month bucket, with attempted counts so small samples are visible. */
export function accuracyTimeline(pyqs: PyqAttempt[], g: Granularity): AccuracyPoint[] {
  const sorted = [...pyqs].filter((p) => p.result !== "unattempted").sort((a, b) => a.date.localeCompare(b.date));
  const buckets = new Map<string, { attempted: number; correct: number }>();
  for (const p of sorted) {
    const k = bucketKey(p.date, g);
    const b = buckets.get(k) ?? { attempted: 0, correct: 0 };
    b.attempted++;
    if (p.result === "correct") b.correct++;
    buckets.set(k, b);
  }
  let cumA = 0;
  let cumC = 0;
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      cumA += b.attempted;
      cumC += b.correct;
      return {
        key,
        label: g === "day" ? fmtDate(key) : g === "week" ? `Wk of ${fmtDate(key)}` : fmtMonth(key),
        attempted: b.attempted,
        correct: b.correct,
        accuracy: b.attempted ? (b.correct / b.attempted) * 100 : null,
        cumulativeAccuracy: cumA ? (cumC / cumA) * 100 : null,
      };
    });
}

/** Compare the most recent `n` attempts against the `n` before them. Null if fewer than 2n attempts. */
export function recentVsEarlier(pyqs: PyqAttempt[], n: number): { recent: number; earlier: number; delta: number; n: number } | null {
  const answered = [...pyqs].filter((p) => p.result !== "unattempted").sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  if (answered.length < 2 * n) return null;
  const recent = answered.slice(-n);
  const earlier = answered.slice(-2 * n, -n);
  const acc = (arr: PyqAttempt[]) => (arr.filter((p) => p.result === "correct").length / arr.length) * 100;
  const r = acc(recent);
  const e = acc(earlier);
  return { recent: r, earlier: e, delta: r - e, n };
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function mean(arr: number[]): number | null {
  return arr.length ? sum(arr) / arr.length : null;
}
