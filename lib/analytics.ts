import type { AppData, ReviewItem, SubjectId } from "@/types";
import { computeOverall, computeSubjectStats, computeTopicStats, accuracyOf, tallyPyqs, type OverallProgress, type SubjectStats, type TopicStats } from "@/lib/calc/progress";
import { computeStreaks, minutesByDate, type StreakInfo } from "@/lib/calc/stats";
import { computeReadiness, type Readiness, mockPct } from "@/lib/calc/readiness";
import { recurringWarnings, type RecurringWarning } from "@/lib/calc/errors";
import { dueBucket } from "@/lib/calc/srs";
import { addDays, diffDays, startOfWeek } from "@/lib/date";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";

export interface Analytics {
  today: string;
  topicStats: Map<string, TopicStats>;
  subjectStats: SubjectStats[];
  overall: OverallProgress;
  streak: StreakInfo;
  totalMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  weekPlannedMinutes: number;
  todayPlannedMinutes: number;
  pyq: { attempted: number; correct: number; unattempted: number; accuracy: number | null; logged: number };
  reviews: { overdue: ReviewItem[]; today: ReviewItem[]; upcoming: ReviewItem[] };
  openErrors: number;
  warnings: RecurringWarning[];
  readiness: Readiness;
  daysToExam: number;
  weakestSubjects: SubjectStats[];
}

export function computeAnalytics(data: AppData, today: string): Analytics {
  const topicStats = computeTopicStats(data);
  const subjectStats = computeSubjectStats(topicStats);
  const overall = computeOverall(topicStats);
  const streak = computeStreaks(data.sessions, today, data.settings.streakMinMinutes);
  const byDate = minutesByDate(data.sessions);
  const weekStart = startOfWeek(today);
  let weekMinutes = 0;
  for (let i = 0; i < 7; i++) weekMinutes += byDate.get(addDays(weekStart, i)) ?? 0;
  const weekEnd = addDays(weekStart, 6);
  const weekPlannedMinutes = data.tasks.filter((t) => t.date >= weekStart && t.date <= weekEnd && t.status !== "skipped").reduce((s, t) => s + t.plannedMin, 0);
  const todayPlannedMinutes = data.tasks.filter((t) => t.date === today && t.status !== "skipped").reduce((s, t) => s + t.plannedMin, 0);
  const totalMinutes = data.sessions.reduce((s, x) => s + x.minutes, 0);

  const logged = tallyPyqs(data.pyqs);
  let manualA = 0;
  let manualC = 0;
  for (const p of data.progress.values()) {
    manualA += Math.max(0, p.manualAttempted);
    manualC += Math.min(Math.max(0, p.manualCorrect), Math.max(0, p.manualAttempted));
  }
  const attempted = logged.attempted + manualA;
  const correct = logged.correct + manualC;

  const active = data.reviews.filter((r) => !r.suspended);
  const reviews = {
    overdue: active.filter((r) => dueBucket(r, today) === "overdue").sort((a, b) => a.due.localeCompare(b.due)),
    today: active.filter((r) => dueBucket(r, today) === "today"),
    upcoming: active.filter((r) => dueBucket(r, today) === "upcoming").sort((a, b) => a.due.localeCompare(b.due)),
  };

  const readiness = computeReadiness({
    overall,
    pyqAttempted: attempted,
    pyqCorrect: correct,
    mocks: data.mocks,
    reviews: data.reviews,
    sessions: data.sessions,
    settings: data.settings,
    today,
  });

  const weakestSubjects = subjectStats
    .filter((s) => s.attempted >= 10 && s.accuracy !== null)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, 3);

  return {
    today,
    topicStats,
    subjectStats,
    overall,
    streak,
    totalMinutes,
    todayMinutes: byDate.get(today) ?? 0,
    weekMinutes,
    weekPlannedMinutes,
    todayPlannedMinutes,
    pyq: { attempted, correct, unattempted: logged.unattempted, accuracy: accuracyOf({ attempted, correct }), logged: data.pyqs.length },
    reviews,
    openErrors: data.errors.filter((e) => e.status === "open").length,
    warnings: recurringWarnings(data.errors, today),
    readiness,
    daysToExam: diffDays(today, data.settings.examDate),
    weakestSubjects,
  };
}

// ---------------------------------------------------------------------------------------------
// Recommendations ("What should I do next?") — every rule states the data that triggered it.

export interface RecAction {
  label: string;
  kind: "open-topic" | "add-task" | "schedule-revision" | "link";
  href?: string;
  topicId?: string;
  subjectId?: SubjectId;
  taskTitle?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  evidence: string;
  score: number;
  actions: RecAction[];
}

export function recommendations(data: AppData, a: Analytics): Recommendation[] {
  const recs: Recommendation[] = [];
  const today = a.today;

  // 1. Overdue revisions
  if (a.reviews.overdue.length) {
    const oldest = a.reviews.overdue[0]!;
    const name = oldest.kind === "topic" ? TOPIC_MAP[oldest.refId]?.name : data.errors.find((e) => e.id === oldest.refId)?.questionRef;
    recs.push({
      id: "overdue",
      title: `Clear ${a.reviews.overdue.length} overdue revision${a.reviews.overdue.length > 1 ? "s" : ""}`,
      evidence: `Oldest is “${name ?? "item"}”, due ${diffDays(oldest.due, today)} day(s) ago.`,
      score: 60 + a.reviews.overdue.length * 2,
      actions: [{ label: "Start revision", kind: "link", href: "/revision" }],
    });
  }

  // 2. Subject accuracy well below overall
  if (a.pyq.accuracy !== null && a.pyq.attempted >= 30) {
    for (const s of a.subjectStats) {
      if (s.attempted < 10 || s.accuracy === null) continue;
      const gap = a.pyq.accuracy - s.accuracy;
      if (gap < 10) continue;
      const weakestTopic = [...a.topicStats.values()]
        .filter((t) => t.topic.subjectId === s.subjectId && t.attempted >= 3 && t.accuracy !== null)
        .sort((x, y) => (x.accuracy ?? 0) - (y.accuracy ?? 0))[0];
      recs.push({
        id: `subj-${s.subjectId}`,
        title: `${SUBJECT_MAP[s.subjectId].short} accuracy is below your average`,
        evidence: `${Math.round(s.accuracy)}% on ${s.attempted} PYQs vs ${Math.round(a.pyq.accuracy)}% overall (${a.pyq.attempted}).${weakestTopic ? ` Weakest topic: ${weakestTopic.topic.name} (${Math.round(weakestTopic.accuracy ?? 0)}% on ${weakestTopic.attempted}).` : ""}`,
        score: 40 + gap,
        actions: weakestTopic
          ? [
              { label: "Open topic", kind: "open-topic", topicId: weakestTopic.topic.id },
              { label: "Add practice task", kind: "add-task", topicId: weakestTopic.topic.id, subjectId: s.subjectId, taskTitle: `Targeted PYQ set: ${weakestTopic.topic.name}` },
              { label: "Schedule revision", kind: "schedule-revision", topicId: weakestTopic.topic.id },
            ]
          : [{ label: "Open analytics", kind: "link", href: `/analytics/subject/${s.subjectId}` }],
      });
    }
  }

  // 3. Declining topic accuracy (last 5 vs previous 5 logged attempts)
  const byTopic = new Map<string, typeof data.pyqs>();
  for (const p of data.pyqs) {
    if (!p.topicId || p.result === "unattempted") continue;
    const arr = byTopic.get(p.topicId) ?? [];
    arr.push(p);
    byTopic.set(p.topicId, arr);
  }
  for (const [topicId, list] of byTopic) {
    if (list.length < 10) continue;
    const sorted = [...list].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
    const acc = (arr: typeof list) => (arr.filter((p) => p.result === "correct").length / arr.length) * 100;
    const recent = acc(sorted.slice(-5));
    const prev = acc(sorted.slice(-10, -5));
    if (prev - recent >= 20) {
      recs.push({
        id: `decline-${topicId}`,
        title: `${TOPIC_MAP[topicId]?.name} accuracy has dropped`,
        evidence: `Last 5 attempts: ${Math.round(recent)}%; previous 5: ${Math.round(prev)}%.`,
        score: 45 + (prev - recent) / 2,
        actions: [
          { label: "Schedule revision", kind: "schedule-revision", topicId },
          { label: "Open topic", kind: "open-topic", topicId },
        ],
      });
    }
  }

  // 4. Recurring error patterns
  for (const w of a.warnings.slice(0, 2)) {
    if (!w.topicId) continue;
    recs.push({
      id: `recurring-${w.topicId}`,
      title: `Recurring mistakes in ${TOPIC_MAP[w.topicId]?.name}`,
      evidence: `${w.count} logged occurrences in the last 30 days${w.type ? `, mostly Type ${w.type}` : ""}.`,
      score: 50 + w.count * 3,
      actions: [
        { label: "Review error log", kind: "link", href: `/errors?topic=${w.topicId}` },
        { label: "Add 40-question drill", kind: "add-task", topicId: w.topicId, subjectId: TOPIC_MAP[w.topicId]?.subjectId, taskTitle: `40 consecutive questions: ${TOPIC_MAP[w.topicId]?.name}` },
      ],
    });
  }

  // 5. More hours but no accuracy gain
  const last7 = data.sessions.filter((s) => s.date > addDays(today, -7)).reduce((x, s) => x + s.minutes, 0);
  const prev7 = data.sessions.filter((s) => s.date <= addDays(today, -7) && s.date > addDays(today, -14)).reduce((x, s) => x + s.minutes, 0);
  const pyqWindow = (from: string, to: string) => data.pyqs.filter((p) => p.result !== "unattempted" && p.date > from && p.date <= to);
  const pr = pyqWindow(addDays(today, -7), today);
  const pp = pyqWindow(addDays(today, -14), addDays(today, -7));
  if (prev7 > 0 && last7 >= prev7 * 1.2 && pr.length >= 15 && pp.length >= 15) {
    const ar = (pr.filter((p) => p.result === "correct").length / pr.length) * 100;
    const ap = (pp.filter((p) => p.result === "correct").length / pp.length) * 100;
    if (ar <= ap) {
      recs.push({
        id: "hours-vs-accuracy",
        title: "Hours went up, accuracy didn't",
        evidence: `Study time ${Math.round(prev7 / 60)}h → ${Math.round(last7 / 60)}h week over week; PYQ accuracy ${Math.round(ap)}% → ${Math.round(ar)}% (${pp.length} → ${pr.length} attempts).`,
        score: 48,
        actions: [{ label: "Open error notebook", kind: "link", href: "/errors" }],
      });
    }
  }

  // 6. Latest mock's weakest subject
  const lastMock = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date)).at(-1);
  if (lastMock) {
    const weakest = lastMock.subjectMarks.filter((s) => s.max >= 4).sort((x, y) => x.scored / x.max - y.scored / y.max)[0];
    if (weakest && weakest.scored / weakest.max < 0.6) {
      recs.push({
        id: "mock-weak",
        title: `Rebuild ${SUBJECT_MAP[weakest.subjectId].short} after “${lastMock.name}”`,
        evidence: `Scored ${weakest.scored}/${weakest.max} there (${Math.round((weakest.scored / weakest.max) * 100)}%); overall ${Math.round(mockPct(lastMock))}%.`,
        score: 44,
        actions: [
          { label: "Add revision task", kind: "add-task", subjectId: weakest.subjectId, taskTitle: `Post-mock fix: ${SUBJECT_MAP[weakest.subjectId].short} weak areas` },
          { label: "Open mock", kind: "link", href: `/mocks?id=${lastMock.id}` },
        ],
      });
    }
  }

  // 7. Open errors due for review
  const dueErrors = data.errors.filter((e) => e.status === "open" && e.reviewDate && e.reviewDate <= today);
  if (dueErrors.length) {
    recs.push({
      id: "errors-due",
      title: `Review ${dueErrors.length} logged error${dueErrors.length > 1 ? "s" : ""} due today`,
      evidence: `Unresolved errors with a review date on or before today.`,
      score: 42 + dueErrors.length,
      actions: [{ label: "Start error review", kind: "link", href: "/errors?review=1" }],
    });
  }

  // 8. Today's planned topic not started yet
  const todayTopic = data.tasks.find((t) => t.date === today && t.status === "todo" && t.topicId && (a.topicStats.get(t.topicId)?.progress.status ?? "not_started") === "not_started");
  if (todayTopic?.topicId) {
    recs.push({
      id: "plan-topic",
      title: `Start today's planned topic: ${TOPIC_MAP[todayTopic.topicId]?.name}`,
      evidence: `It's on today's plan (“${todayTopic.title}”) and still marked Not started.`,
      score: 30,
      actions: [{ label: "Open topic", kind: "open-topic", topicId: todayTopic.topicId }],
    });
  }

  return recs.sort((x, y) => y.score - x.score).slice(0, 3);
}
