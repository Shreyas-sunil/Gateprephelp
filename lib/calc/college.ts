import type { GateCategory, MockTest, Settings } from "@/types";
import type { CutoffRecord, Programme } from "@/data/colleges";
import { GATE_SCORE_FORMULA } from "@/data/colleges";

export type BenchmarkStatus = "below" | "approaching" | "within" | "unavailable" | "no-score";
export type MatchGroup = "dream" | "target" | "additional";

export const STATUS_TEXT: Record<BenchmarkStatus, string> = {
  below: "Below historical benchmark",
  approaching: "Approaching historical benchmark",
  within: "Within historical benchmark range",
  unavailable: "Data unavailable",
  "no-score": "No score to compare",
};

/** Points below a cut-off that still count as “approaching”. */
export const APPROACH_MARGIN = 50;

export interface Benchmark {
  value: number;
  record: CutoffRecord;
}

/** Latest benchmark for the category. Community data is used only when allowed. */
export function benchmarkFor(p: Programme, category: GateCategory, includeCommunity: boolean): Benchmark | null {
  const records = p.cutoffs
    .filter((c) => includeCommunity || c.sourceType !== "community")
    .sort((a, b) => b.year.localeCompare(a.year) || (a.sourceType === "official" ? -1 : 1));
  for (const r of records) {
    const v = r.values[category];
    if (typeof v === "number") return { value: v, record: r };
  }
  return null;
}

export function benchmarkStatus(score: number | null | undefined, cutoff: number | null | undefined): BenchmarkStatus {
  if (cutoff === null || cutoff === undefined) return "unavailable";
  if (score === null || score === undefined || !Number.isFinite(score)) return "no-score";
  if (score >= cutoff) return "within";
  if (score >= cutoff - APPROACH_MARGIN) return "approaching";
  return "below";
}

export function matchGroup(status: BenchmarkStatus): MatchGroup {
  if (status === "within") return "target";
  if (status === "below" || status === "approaching") return "dream";
  return "additional";
}

/**
 * Converts raw marks (out of 100) to a GATE score using the published formula — only with qualifying
 * mark (Mq) and top-0.1% mean (Mt) the user entered from an official result report. Returns null otherwise.
 */
export function marksToGateScore(marks: number, mq?: number, mt?: number): number | null {
  if (mq === undefined || mt === undefined || !Number.isFinite(mq) || !Number.isFinite(mt) || mt <= mq) return null;
  const { sq, st } = GATE_SCORE_FORMULA;
  const s = sq + ((st - sq) * (marks - mq)) / (mt - mq);
  return Math.max(0, Math.min(1000, Math.round(s)));
}

export interface ScoreContext {
  latestMock?: MockTest;
  latestFullMock?: MockTest;
  latestMockMarks100: number | null;
  estimatedGateScore: number | null;
  estimateBasis?: string;
  official: number | null;
}

/** Mock marks are normalised to /100 only when the mock's total isn't 100; this is noted in the basis text. */
export function scoreContext(mocks: MockTest[], settings: Settings): ScoreContext {
  const sorted = [...mocks].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const latestMock = sorted.at(-1);
  const latestFullMock = sorted.filter((m) => m.kind === "full").at(-1);
  const ref = latestFullMock;
  const marks100 = ref && ref.totalMarks > 0 ? (ref.score / ref.totalMarks) * 100 : null;
  const est = marks100 !== null ? marksToGateScore(marks100, settings.gateConversion.mq, settings.gateConversion.mt) : null;
  return {
    latestMock,
    latestFullMock,
    latestMockMarks100: marks100,
    estimatedGateScore: est,
    estimateBasis:
      est !== null && ref
        ? `Latest full-length mock (${ref.name}, ${ref.score}/${ref.totalMarks}) converted with your Mq = ${settings.gateConversion.mq}, Mt = ${settings.gateConversion.mt}${settings.gateConversion.reference ? ` (${settings.gateConversion.reference})` : ""}.`
        : undefined,
    official: settings.actualGateScore ?? null,
  };
}
