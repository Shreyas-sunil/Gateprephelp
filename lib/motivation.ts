import type { AppData, AchievementRecord } from "@/types";
import type { Analytics } from "@/lib/analytics";
import { BAD_MOCK_MESSAGES, GENERAL_MESSAGES, IMPROVED_MOCK_MESSAGES, RECOVERY_MESSAGES, START_MESSAGES, STREAK_MESSAGES, STUDY_CHALLENGES } from "@/data/motivation";
import { MILESTONE_DEFS } from "@/lib/defaults";
import { addDays, diffDays } from "@/lib/date";
import { mockPct } from "@/lib/calc/readiness";
import { SUBJECTS, defaultPriority } from "@/data/syllabus";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hash(seed) % arr.length]!;
}

export type CatMood = "sleeping" | "studying" | "curious" | "celebrating" | "encouraging" | "resting";

export interface DailyMessage {
  text: string;
  mood: CatMood;
  kind: "start" | "recovery" | "bad-mock" | "improved-mock" | "streak" | "general";
}

/** Chooses a message using recorded data only. Rotates daily (and with `salt`) so it doesn't repeat. */
export function dailyMessage(data: AppData, a: Analytics, salt = 0): DailyMessage {
  const seed = `${a.today}:${salt}`;
  const hasAny = data.sessions.length + data.pyqs.length + data.mocks.length + [...data.progress.values()].filter((p) => p.status !== "not_started").length > 0;
  if (!hasAny) return { text: pick(START_MESSAGES, seed), mood: "curious", kind: "start" };

  const mocks = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date));
  const last = mocks.at(-1);
  const prev = mocks.at(-2);
  if (last && diffDays(last.date, a.today) <= 2) {
    if (prev && last.totalMarks === prev.totalMarks && last.score > prev.score && salt % 2 === 0) {
      const n = Math.round((last.score - prev.score) * 100) / 100;
      return { text: pick(IMPROVED_MOCK_MESSAGES, seed).replace("{n}", String(n)), mood: "celebrating", kind: "improved-mock" };
    }
    if (mockPct(last) < 50) return { text: pick(BAD_MOCK_MESSAGES, seed), mood: "encouraging", kind: "bad-mock" };
  }

  const lastSession = [...data.sessions].sort((x, y) => y.start - x.start)[0];
  if (lastSession && diffDays(lastSession.date, a.today) >= 2) return { text: pick(RECOVERY_MESSAGES, seed), mood: "encouraging", kind: "recovery" };

  if (a.streak.current >= 3 && salt % 3 === 0) {
    return { text: pick(STREAK_MESSAGES, seed).replace("{n}", String(a.streak.current)), mood: "celebrating", kind: "streak" };
  }
  return { text: pick(GENERAL_MESSAGES, seed), mood: a.todayMinutes > 0 ? "studying" : "curious", kind: "general" };
}

export function dailyChallenge(today: string): string {
  return pick(STUDY_CHALLENGES, "challenge:" + today);
}

export interface MilestoneStatus {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  achieved: boolean;
  achievedAt?: number;
}

export function milestoneStatuses(data: AppData, a: Analytics, achievements: AchievementRecord[]): MilestoneStatus[] {
  const ach = new Map(achievements.map((x) => [x.id, x.achievedAt]));
  const out: MilestoneStatus[] = [];
  for (const cfg of data.settings.milestones) {
    if (!cfg.enabled) continue;
    const def = MILESTONE_DEFS.find((d) => d.id === cfg.id);
    if (!def) continue;
    let progress = 0;
    let target = cfg.threshold;
    switch (cfg.id) {
      case "first-mastered":
        progress = a.overall.mastered;
        break;
      case "pyq-count":
        progress = data.pyqs.length;
        break;
      case "first-full-mock":
        progress = data.mocks.filter((m) => m.kind === "full").length;
        break;
      case "streak":
        progress = a.streak.best;
        break;
      case "all-subjects-reviewed": {
        target = SUBJECTS.length;
        const reviewed = new Set<string>();
        for (const r of data.reviews) {
          if (!r.history.length) continue;
          const subj = r.kind === "topic" ? a.topicStats.get(r.refId)?.topic.subjectId : data.errors.find((e) => e.id === r.refId)?.subjectId;
          if (subj) reviewed.add(subj);
        }
        progress = reviewed.size;
        break;
      }
      case "high-priority-revised": {
        const high = [...a.topicStats.values()].filter((t) => (t.progress.priority ?? defaultPriority(t.topic.subjectId)) === "high");
        target = high.length;
        progress = high.filter((t) => t.reviewCount > 0).length;
        break;
      }
      case "hours":
        progress = Math.floor(a.totalMinutes / 60);
        break;
      case "errors-resolved":
        progress = data.errors.filter((e) => e.status === "resolved").length;
        break;
    }
    const achieved = target > 0 && progress >= target;
    out.push({ id: cfg.id, title: def.title, description: def.description(target), progress: Math.min(progress, target), target, achieved, achievedAt: ach.get(cfg.id) });
  }
  return out;
}

export interface WeeklyReview {
  from: string;
  to: string;
  minutes: number;
  prevMinutes: number;
  tasksDone: number;
  tasksPlanned: number;
  topicsAdvanced: string[];
  topicsMasteredNow: number;
  accuracy: number | null;
  prevAccuracy: number | null;
  attempted: number;
  prevAttempted: number;
  mostImproved?: { subjectId: string; delta: number; n: number };
  persistentWeakness?: { topicId: string; count: number };
  unresolvedErrors: number;
  reviewsDone: number;
  mocks: number;
}

export function weeklyReview(data: AppData, a: Analytics, weekStart: string): WeeklyReview {
  const to = addDays(weekStart, 6);
  const prevFrom = addDays(weekStart, -7);
  const prevTo = addDays(weekStart, -1);
  const inRange = (d: string, f: string, t: string) => d >= f && d <= t;
  const minutes = data.sessions.filter((s) => inRange(s.date, weekStart, to)).reduce((x, s) => x + s.minutes, 0);
  const prevMinutes = data.sessions.filter((s) => inRange(s.date, prevFrom, prevTo)).reduce((x, s) => x + s.minutes, 0);
  const tasks = data.tasks.filter((t) => inRange(t.date, weekStart, to));
  const fromMs = Date.parse(weekStart + "T00:00:00+05:30");
  const toMs = Date.parse(to + "T23:59:59+05:30");
  const topicsAdvanced = [...data.progress.values()]
    .filter((p) => p.statusHistory.some((h) => inRange(h.date, weekStart, to)) || (p.updatedAt >= fromMs && p.updatedAt <= toMs && p.status !== "not_started"))
    .map((p) => p.topicId);
  const answered = (f: string, t: string) => data.pyqs.filter((p) => p.result !== "unattempted" && inRange(p.date, f, t));
  const cur = answered(weekStart, to);
  const prev = answered(prevFrom, prevTo);
  const acc = (arr: typeof cur) => (arr.length ? (arr.filter((p) => p.result === "correct").length / arr.length) * 100 : null);

  let mostImproved: WeeklyReview["mostImproved"];
  for (const s of SUBJECTS) {
    const c = cur.filter((p) => p.subjectId === s.id);
    const pv = prev.filter((p) => p.subjectId === s.id);
    if (c.length < 5 || pv.length < 5) continue;
    const delta = (acc(c) ?? 0) - (acc(pv) ?? 0);
    if (delta > 0 && (!mostImproved || delta > mostImproved.delta)) mostImproved = { subjectId: s.id, delta, n: c.length };
  }
  const errsWeek = data.errors.filter((e) => inRange(e.date, addDays(weekStart, -21), to) && e.topicId);
  const counts = new Map<string, number>();
  for (const e of errsWeek) counts.set(e.topicId!, (counts.get(e.topicId!) ?? 0) + 1 + e.repeatCount);
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];

  return {
    from: weekStart,
    to,
    minutes,
    prevMinutes,
    tasksDone: tasks.filter((t) => t.status === "done").length,
    tasksPlanned: tasks.length,
    topicsAdvanced,
    topicsMasteredNow: a.overall.mastered,
    accuracy: acc(cur),
    prevAccuracy: acc(prev),
    attempted: cur.length,
    prevAttempted: prev.length,
    mostImproved,
    persistentWeakness: top && top[1] >= 2 ? { topicId: top[0], count: top[1] } : undefined,
    unresolvedErrors: data.errors.filter((e) => e.status === "open").length,
    reviewsDone: data.reviews.flatMap((r) => r.history).filter((h) => inRange(h.date, weekStart, to)).length,
    mocks: data.mocks.filter((m) => inRange(m.date, weekStart, to)).length,
  };
}
