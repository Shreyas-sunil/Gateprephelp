import type { ErrorEntry, ErrorType } from "@/types";
import { addDays } from "@/lib/date";

export interface ErrorDistribution {
  total: number;
  types: { type: ErrorType; count: number; pct: number; marks: number }[];
}

export function errorDistribution(errors: ErrorEntry[]): ErrorDistribution {
  const total = errors.length;
  const types = (["A", "B", "C"] as ErrorType[]).map((type) => {
    const list = errors.filter((e) => e.type === type);
    return {
      type,
      count: list.length,
      pct: total ? (list.length / total) * 100 : 0,
      marks: list.reduce((s, e) => s + (e.marksLost || 0), 0),
    };
  });
  return { total, types };
}

export interface ParetoRow {
  key: string;
  value: number;
  count: number;
  cumulativePct: number;
}

/**
 * Ranks keys (topics) by marks lost. When no marks are recorded at all, ranks by occurrence count
 * (each error weighted by 1 + repeatCount). `basis` tells the UI which was used.
 */
export function pareto(errors: ErrorEntry[], keyOf: (e: ErrorEntry) => string | undefined): { basis: "marks" | "count"; rows: ParetoRow[] } {
  const hasMarks = errors.some((e) => (e.marksLost || 0) > 0);
  const basis = hasMarks ? "marks" : "count";
  const agg = new Map<string, { value: number; count: number }>();
  for (const e of errors) {
    const k = keyOf(e);
    if (!k) continue;
    const a = agg.get(k) ?? { value: 0, count: 0 };
    a.value += hasMarks ? e.marksLost || 0 : 1 + Math.max(0, e.repeatCount);
    a.count++;
    agg.set(k, a);
  }
  const sorted = [...agg.entries()].sort((a, b) => b[1].value - a[1].value);
  const total = sorted.reduce((s, [, v]) => s + v.value, 0);
  let cum = 0;
  return {
    basis,
    rows: sorted.map(([key, v]) => {
      cum += v.value;
      return { key, value: v.value, count: v.count, cumulativePct: total ? (cum / total) * 100 : 0 };
    }),
  };
}

export interface RecurringWarning {
  topicId?: string;
  type?: ErrorType;
  count: number;
  label: string;
}

/** Same topic (any type) ≥ 3 times, or same type within a topic ≥ 2, or any error repeated ≥ 2 — within the window. */
export function recurringWarnings(errors: ErrorEntry[], today: string, windowDays = 30): RecurringWarning[] {
  const since = addDays(today, -windowDays);
  const recent = errors.filter((e) => e.date >= since);
  const out: RecurringWarning[] = [];
  const byTopic = new Map<string, ErrorEntry[]>();
  for (const e of recent) {
    if (!e.topicId) continue;
    const arr = byTopic.get(e.topicId) ?? [];
    arr.push(e);
    byTopic.set(e.topicId, arr);
  }
  for (const [topicId, list] of byTopic) {
    const weighted = list.reduce((s, e) => s + 1 + e.repeatCount, 0);
    const typeCounts = new Map<ErrorType, number>();
    for (const e of list) typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1 + e.repeatCount);
    const [topType, topCount] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
    if (weighted >= 3 || topCount >= 2) {
      out.push({ topicId, type: topCount >= 2 ? topType : undefined, count: weighted, label: "topic" });
    }
  }
  const typeTotals = new Map<ErrorType, number>();
  for (const e of recent) typeTotals.set(e.type, (typeTotals.get(e.type) ?? 0) + 1 + e.repeatCount);
  for (const [type, count] of typeTotals) if (count >= 5) out.push({ type, count, label: "type" });
  return out.sort((a, b) => b.count - a.count);
}
