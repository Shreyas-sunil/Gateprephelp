import type { MockTest, ReadinessKey, ReviewItem, Settings, StudySession } from "@/types";
import type { OverallProgress } from "./progress";
import { addDays, diffDays } from "@/lib/date";
import { minutesByDate } from "./stats";

export interface ReadinessComponent {
  key: ReadinessKey;
  label: string;
  value: number | null;
  sufficient: boolean;
  formula: string;
  data: string;
  minData: string;
}

export interface Readiness {
  components: ReadinessComponent[];
  composite: number | null;
  usedWeight: number;
  reason?: string;
}

export const READINESS_LABEL: Record<ReadinessKey, string> = {
  coverage: "Syllabus coverage",
  mastery: "Topic mastery",
  pyq: "PYQ accuracy",
  mock: "Mock performance",
  revision: "Revision on time",
  consistency: "Study consistency",
};

export const MIN_PYQ_FOR_READINESS = 30;
export const MIN_MOCKS_FOR_READINESS = 2;
export const MIN_REVIEWS_FOR_READINESS = 10;
export const MIN_COMPONENTS = 4;

export function mockPct(m: Pick<MockTest, "score" | "totalMarks">): number {
  return m.totalMarks > 0 ? (m.score / m.totalMarks) * 100 : 0;
}

export function computeReadiness(input: {
  overall: OverallProgress;
  pyqAttempted: number;
  pyqCorrect: number;
  mocks: MockTest[];
  reviews: ReviewItem[];
  sessions: StudySession[];
  settings: Settings;
  today: string;
}): Readiness {
  const { overall, pyqAttempted, pyqCorrect, mocks, reviews, sessions, settings, today } = input;
  const comps: ReadinessComponent[] = [];

  comps.push({
    key: "coverage",
    label: READINESS_LABEL.coverage,
    value: overall.completionPct,
    sufficient: true,
    formula: "Topics at Practicing or beyond ÷ all topics",
    data: `${overall.covered} of ${overall.total} topics`,
    minData: "Always available",
  });
  comps.push({
    key: "mastery",
    label: READINESS_LABEL.mastery,
    value: overall.masteryPct,
    sufficient: true,
    formula: "Topics meeting your mastery criteria ÷ all topics",
    data: `${overall.mastered} of ${overall.total} topics`,
    minData: "Always available",
  });
  comps.push({
    key: "pyq",
    label: READINESS_LABEL.pyq,
    value: pyqAttempted ? (pyqCorrect / pyqAttempted) * 100 : null,
    sufficient: pyqAttempted >= MIN_PYQ_FOR_READINESS,
    formula: "Correct ÷ attempted (all logged and bulk-counted PYQs)",
    data: `${pyqCorrect} correct of ${pyqAttempted} attempted`,
    minData: `${MIN_PYQ_FOR_READINESS}+ attempts`,
  });
  const sortedMocks = [...mocks].sort((a, b) => a.date.localeCompare(b.date));
  const last3 = sortedMocks.slice(-3);
  comps.push({
    key: "mock",
    label: READINESS_LABEL.mock,
    value: last3.length ? last3.reduce((s, m) => s + mockPct(m), 0) / last3.length : null,
    sufficient: mocks.length >= MIN_MOCKS_FOR_READINESS,
    formula: "Mean of score ÷ total marks over your last 3 mocks",
    data: `${mocks.length} mock${mocks.length === 1 ? "" : "s"} recorded`,
    minData: `${MIN_MOCKS_FOR_READINESS}+ mocks`,
  });
  const since = addDays(today, -30);
  const logs = reviews.flatMap((r) => r.history).filter((h) => h.date >= since);
  const onTime = logs.filter((h) => h.onTime).length;
  comps.push({
    key: "revision",
    label: READINESS_LABEL.revision,
    value: logs.length ? (onTime / logs.length) * 100 : null,
    sufficient: logs.length >= MIN_REVIEWS_FOR_READINESS,
    formula: "Reviews done on or before their due date ÷ all reviews, last 30 days",
    data: `${onTime} of ${logs.length} on time`,
    minData: `${MIN_REVIEWS_FOR_READINESS}+ reviews in 30 days`,
  });
  const byDate = minutesByDate(sessions);
  const firstDate = [...byDate.keys()].sort()[0];
  const windowDays = 14;
  let qualifying = 0;
  for (let i = 0; i < windowDays; i++) if ((byDate.get(addDays(today, -i)) ?? 0) >= settings.streakMinMinutes) qualifying++;
  comps.push({
    key: "consistency",
    label: READINESS_LABEL.consistency,
    value: firstDate ? (qualifying / windowDays) * 100 : null,
    sufficient: !!firstDate && diffDays(firstDate, today) >= 6,
    formula: `Days with ≥ ${settings.streakMinMinutes} min recorded ÷ 14, last 14 days`,
    data: `${qualifying} of ${windowDays} days`,
    minData: "7+ days since your first session",
  });

  const usable = comps.filter((c) => c.sufficient && c.value !== null);
  const weightSum = usable.reduce((s, c) => s + Math.max(0, settings.readinessWeights[c.key] ?? 0), 0);
  if (usable.length < MIN_COMPONENTS || weightSum <= 0) {
    return {
      components: comps,
      composite: null,
      usedWeight: weightSum,
      reason: `Insufficient data: ${usable.length} of 6 components have enough data (need ${MIN_COMPONENTS}).`,
    };
  }
  const composite = usable.reduce((s, c) => s + (c.value ?? 0) * Math.max(0, settings.readinessWeights[c.key] ?? 0), 0) / weightSum;
  return { components: comps, composite, usedWeight: weightSum };
}
