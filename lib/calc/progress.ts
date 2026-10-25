import type { AppData, PyqAttempt, ReviewItem, Settings, StudySession, SubjectId, SyllabusTopic, TopicProgress, TopicStatus } from "@/types";
import { SUBJECTS, TOPICS } from "@/data/syllabus";
import { emptyProgress } from "@/lib/defaults";

export type FunnelStage = "not_started" | "learning" | "practicing" | "revised" | "mastered";

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  not_started: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  revised: "Revised",
  mastered: "Mastered",
};

export const FUNNEL_CRITERIA: Record<FunnelStage, string> = {
  not_started: "Status is “Not started”.",
  learning: "Status is “Learning”.",
  practicing: "Status is Practicing, Revision needed or Mastered, but no completed revision yet.",
  revised: "At least one completed revision, but mastery criteria not yet met.",
  mastered: "Marked Mastered AND confidence, PYQ volume, PYQ accuracy and (optionally) a completed revision all meet your thresholds in Settings.",
};

export const STATUS_LABEL: Record<TopicStatus, string> = {
  not_started: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  revision: "Revision needed",
  mastered: "Mastered",
};

export const STATUS_ORDER: TopicStatus[] = ["not_started", "learning", "practicing", "revision", "mastered"];

export interface TopicStats {
  topic: SyllabusTopic;
  progress: TopicProgress;
  logged: number;
  attempted: number;
  correct: number;
  unattempted: number;
  accuracy: number | null;
  minutes: number;
  reviewCount: number;
  lastStudied?: string;
  stage: FunnelStage;
  meetsMastery: boolean;
  masteryGaps: string[];
}

export interface AccuracyTally {
  attempted: number;
  correct: number;
  unattempted: number;
}

/** Weighted accuracy: total correct / total attempted. Unattempted questions are excluded. */
export function accuracyOf(t: { attempted: number; correct: number }): number | null {
  return t.attempted > 0 ? (t.correct / t.attempted) * 100 : null;
}

export function tallyPyqs(pyqs: PyqAttempt[]): AccuracyTally {
  let attempted = 0;
  let correct = 0;
  let unattempted = 0;
  for (const p of pyqs) {
    if (p.result === "unattempted") unattempted++;
    else {
      attempted++;
      if (p.result === "correct") correct++;
    }
  }
  return { attempted, correct, unattempted };
}

/** Covered = studied past the Learning stage. */
export function isCovered(status: TopicStatus): boolean {
  return status === "practicing" || status === "revision" || status === "mastered";
}

export function evaluateMastery(
  p: TopicProgress,
  attempted: number,
  accuracy: number | null,
  reviewCount: number,
  m: Settings["mastery"],
): { meets: boolean; gaps: string[] } {
  const gaps: string[] = [];
  if (p.status !== "mastered") gaps.push("Status is not Mastered");
  if (p.confidence < m.minConfidence) gaps.push(`Confidence ${p.confidence || "unrated"} < ${m.minConfidence}`);
  if (attempted < m.minAttempts) gaps.push(`${attempted}/${m.minAttempts} PYQs attempted`);
  if (accuracy === null || accuracy < m.minAccuracy) gaps.push(`Accuracy ${accuracy === null ? "—" : Math.round(accuracy) + "%"} < ${m.minAccuracy}%`);
  if (m.requireReview && reviewCount < 1) gaps.push("No completed revision");
  return { meets: gaps.length === 0, gaps };
}

export function computeTopicStats(
  data: Pick<AppData, "progress" | "pyqs" | "sessions" | "reviews" | "settings">,
): Map<string, TopicStats> {
  const pyqByTopic = new Map<string, PyqAttempt[]>();
  for (const p of data.pyqs) {
    if (!p.topicId) continue;
    const arr = pyqByTopic.get(p.topicId) ?? [];
    arr.push(p);
    pyqByTopic.set(p.topicId, arr);
  }
  const minutesByTopic = new Map<string, number>();
  const lastSessionByTopic = new Map<string, string>();
  for (const s of data.sessions as StudySession[]) {
    if (!s.topicId) continue;
    minutesByTopic.set(s.topicId, (minutesByTopic.get(s.topicId) ?? 0) + s.minutes);
    const prev = lastSessionByTopic.get(s.topicId);
    if (!prev || s.date > prev) lastSessionByTopic.set(s.topicId, s.date);
  }
  const reviewsByTopic = new Map<string, number>();
  for (const r of data.reviews as ReviewItem[]) {
    if (r.kind !== "topic") continue;
    reviewsByTopic.set(r.refId, (reviewsByTopic.get(r.refId) ?? 0) + r.history.length);
  }

  const out = new Map<string, TopicStats>();
  for (const topic of TOPICS) {
    const progress = data.progress.get(topic.id) ?? emptyProgress(topic.id);
    const tally = tallyPyqs(pyqByTopic.get(topic.id) ?? []);
    const attempted = tally.attempted + Math.max(0, progress.manualAttempted);
    const correct = tally.correct + Math.min(Math.max(0, progress.manualCorrect), Math.max(0, progress.manualAttempted));
    const accuracy = accuracyOf({ attempted, correct });
    const reviewCount = reviewsByTopic.get(topic.id) ?? 0;
    const { meets, gaps } = evaluateMastery(progress, attempted, accuracy, reviewCount, data.settings.mastery);
    let stage: FunnelStage;
    if (meets) stage = "mastered";
    else if (progress.status === "not_started") stage = "not_started";
    else if (progress.status === "learning") stage = "learning";
    else if (reviewCount > 0) stage = "revised";
    else stage = "practicing";
    const sessionDate = lastSessionByTopic.get(topic.id);
    const lastStudied = [progress.lastStudied, sessionDate].filter(Boolean).sort().pop();
    out.set(topic.id, {
      topic,
      progress,
      logged: tally.attempted + tally.unattempted,
      attempted,
      correct,
      unattempted: tally.unattempted,
      accuracy,
      minutes: minutesByTopic.get(topic.id) ?? 0,
      reviewCount,
      lastStudied,
      stage,
      meetsMastery: meets,
      masteryGaps: gaps,
    });
  }
  return out;
}

export interface SubjectStats {
  subjectId: SubjectId;
  total: number;
  covered: number;
  mastered: number;
  completionPct: number;
  masteryPct: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
  avgConfidence: number | null;
  ratedCount: number;
  minutes: number;
  reviewedTopics: number;
  revisionCoveragePct: number;
  lastStudied?: string;
  statusCounts: Record<TopicStatus, number>;
}

export function computeSubjectStats(topicStats: Map<string, TopicStats>): SubjectStats[] {
  return SUBJECTS.map((s) => {
    const list = [...topicStats.values()].filter((t) => t.topic.subjectId === s.id);
    const statusCounts: Record<TopicStatus, number> = { not_started: 0, learning: 0, practicing: 0, revision: 0, mastered: 0 };
    let covered = 0;
    let mastered = 0;
    let attempted = 0;
    let correct = 0;
    let confSum = 0;
    let rated = 0;
    let minutes = 0;
    let reviewed = 0;
    let last: string | undefined;
    for (const t of list) {
      statusCounts[t.progress.status]++;
      if (isCovered(t.progress.status)) covered++;
      if (t.meetsMastery) mastered++;
      attempted += t.attempted;
      correct += t.correct;
      if (t.progress.confidence > 0) {
        confSum += t.progress.confidence;
        rated++;
      }
      minutes += t.minutes;
      if (t.reviewCount > 0) reviewed++;
      if (t.lastStudied && (!last || t.lastStudied > last)) last = t.lastStudied;
    }
    const total = list.length;
    return {
      subjectId: s.id,
      total,
      covered,
      mastered,
      completionPct: total ? (covered / total) * 100 : 0,
      masteryPct: total ? (mastered / total) * 100 : 0,
      attempted,
      correct,
      accuracy: accuracyOf({ attempted, correct }),
      avgConfidence: rated ? confSum / rated : null,
      ratedCount: rated,
      minutes,
      reviewedTopics: reviewed,
      revisionCoveragePct: total ? (reviewed / total) * 100 : 0,
      lastStudied: last,
      statusCounts,
    };
  });
}

export interface OverallProgress {
  total: number;
  covered: number;
  mastered: number;
  completionPct: number;
  masteryPct: number;
  stageCounts: Record<FunnelStage, number>;
  statusCounts: Record<TopicStatus, number>;
  needsRevision: number;
  inProgress: number;
}

export function computeOverall(topicStats: Map<string, TopicStats>): OverallProgress {
  const stageCounts: Record<FunnelStage, number> = { not_started: 0, learning: 0, practicing: 0, revised: 0, mastered: 0 };
  const statusCounts: Record<TopicStatus, number> = { not_started: 0, learning: 0, practicing: 0, revision: 0, mastered: 0 };
  let covered = 0;
  for (const t of topicStats.values()) {
    stageCounts[t.stage]++;
    statusCounts[t.progress.status]++;
    if (isCovered(t.progress.status)) covered++;
  }
  const total = topicStats.size;
  return {
    total,
    covered,
    mastered: stageCounts.mastered,
    completionPct: total ? (covered / total) * 100 : 0,
    masteryPct: total ? (stageCounts.mastered / total) * 100 : 0,
    stageCounts,
    statusCounts,
    needsRevision: statusCounts.revision,
    inProgress: statusCounts.learning + statusCounts.practicing,
  };
}
