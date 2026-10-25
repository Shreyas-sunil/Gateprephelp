import type { Settings, TopicProgress, MilestoneConfig } from "@/types";
import { DEFAULT_BLOCKS, DEFAULT_MOCK_PHASES, DEFAULT_ROUNDS, EXAM_DEFAULTS, SOURCE_PLAN_DATES } from "@/data/plan";

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand}` : rand;
}

export interface MilestoneDef {
  id: string;
  title: string;
  description: (threshold: number) => string;
  defaultThreshold: number;
  thresholdLabel?: string;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  { id: "first-mastered", title: "First topic mastered", description: (n) => `${n} topic${n === 1 ? "" : "s"} meet your mastery criteria`, defaultThreshold: 1, thresholdLabel: "Topics" },
  { id: "pyq-count", title: "PYQ century", description: (n) => `Log ${n} PYQ attempts`, defaultThreshold: 100, thresholdLabel: "PYQs" },
  { id: "first-full-mock", title: "First full-length mock", description: (n) => `Record ${n} full-length mock${n === 1 ? "" : "s"}`, defaultThreshold: 1, thresholdLabel: "Mocks" },
  { id: "streak", title: "A week of consistency", description: (n) => `Study ${n} days in a row`, defaultThreshold: 7, thresholdLabel: "Days" },
  { id: "all-subjects-reviewed", title: "Every subject reviewed", description: () => "Complete at least one revision in every subject", defaultThreshold: 11 },
  { id: "high-priority-revised", title: "High-priority sweep", description: () => "Every high-priority topic has at least one completed revision", defaultThreshold: 1 },
  { id: "hours", title: "Deep hours", description: (n) => `Record ${n} hours of study`, defaultThreshold: 100, thresholdLabel: "Hours" },
  { id: "errors-resolved", title: "Error hunter", description: (n) => `Resolve ${n} logged errors`, defaultThreshold: 25, thresholdLabel: "Errors" },
];

export function defaultMilestones(): MilestoneConfig[] {
  return MILESTONE_DEFS.map((m) => ({ id: m.id, enabled: true, threshold: m.defaultThreshold }));
}

export function defaultSettings(): Settings {
  return {
    id: "app",
    onboarded: false,
    examDate: EXAM_DEFAULTS.examDate,
    syllabusEndDate: SOURCE_PLAN_DATES.end,
    dailyHourGoal: 6,
    weeklyHourGoal: 40,
    targetMarks: 75,
    targetGateScore: 900,
    targetRank: 100,
    pyqTarget: 1500,
    mockTarget: 12,
    subjectTargets: {},
    category: "UR",
    prepLevel: "partial",
    preferredTimes: ["morning", "afternoon", "night"],
    streakMinMinutes: 30,
    mastery: { minConfidence: 4, minAttempts: 10, minAccuracy: 70, requireReview: true },
    srs: { againDays: 1, firstGoodDays: 1, secondGoodDays: 3, hardMultiplier: 1.2, easyBonus: 1.3, startEase: 2.5, minEase: 1.3, maxInterval: 60 },
    pomodoro: { focus: 50, short: 10, long: 25, cyclesBeforeLong: 3 },
    blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
    mockPhases: DEFAULT_MOCK_PHASES.map((p) => ({ ...p, actions: [...p.actions] })),
    rounds: DEFAULT_ROUNDS.map((r) => ({ ...r, items: [...r.items] })),
    readinessWeights: { coverage: 15, mastery: 20, pyq: 20, mock: 25, revision: 10, consistency: 10 },
    cat: { name: "Mochi", fur: "smoke", accessory: "glasses" },
    quietMode: false,
    celebrations: true,
    toasts: true,
    motion: "system",
    theme: "midnight",
    dreamProgrammeId: "iisc-csa-mtech",
    gateConversion: {},
    milestones: defaultMilestones(),
    updatedAt: Date.now(),
  };
}

/** Fill in fields that older exports may lack. */
export function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    id: "app",
    mastery: { ...d.mastery, ...(s.mastery ?? {}) },
    srs: { ...d.srs, ...(s.srs ?? {}) },
    pomodoro: { ...d.pomodoro, ...(s.pomodoro ?? {}) },
    readinessWeights: { ...d.readinessWeights, ...(s.readinessWeights ?? {}) },
    cat: { ...d.cat, ...(s.cat ?? {}) },
    gateConversion: { ...(s.gateConversion ?? {}) },
    blocks: s.blocks?.length ? s.blocks : d.blocks,
    mockPhases: s.mockPhases?.length ? s.mockPhases : d.mockPhases,
    rounds: s.rounds?.length ? s.rounds : d.rounds,
    milestones: d.milestones.map((m) => s.milestones?.find((x) => x.id === m.id) ?? m),
  };
}

export function emptyProgress(topicId: string): TopicProgress {
  return {
    topicId,
    status: "not_started",
    confidence: 0,
    manualAttempted: 0,
    manualCorrect: 0,
    notes: "",
    bookmarks: [],
    statusHistory: [],
    updatedAt: 0,
  };
}
