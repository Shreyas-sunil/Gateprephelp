import type { Analytics } from "@/lib/analytics";
import type { AppData, SubjectId } from "@/types";
import type { Programme } from "@/data/colleges";
import { benchmarkFor, scoreContext } from "./college";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import { mockPct } from "./readiness";

export interface TakePlan {
  headline: string;
  lines: string[];
  tasks: { title: string; subjectId?: SubjectId; topicId?: string; minutes: number }[];
  dataGaps: string[];
}

/** Builds a plan only from recorded data; states what's missing instead of filling gaps. */
export function whatWouldItTake(p: Programme, data: AppData, a: Analytics, includeCommunity: boolean): TakePlan {
  const s = data.settings;
  const ctx = scoreContext(data.mocks, s);
  const bench = benchmarkFor(p, s.category, includeCommunity);
  const lines: string[] = [];
  const gaps: string[] = [];
  const tasks: TakePlan["tasks"] = [];

  let headline = `${p.short}: ${p.programme}`;
  const score = ctx.official ?? ctx.estimatedGateScore;
  if (bench && score !== null) {
    const gap = bench.value - score;
    headline =
      gap > 0
        ? `${gap} GATE-score points below the ${bench.record.year} ${s.category} benchmark (${bench.value}) — an ambitious target.`
        : `At or above the ${bench.record.year} ${s.category} benchmark (${bench.value}). Benchmarks move year to year; keep building margin.`;
    lines.push(`Score used: ${ctx.official !== null ? `your official GATE score ${ctx.official}` : `estimated ${ctx.estimatedGateScore} — ${ctx.estimateBasis}`}`);
  } else if (bench) {
    headline = `Benchmark: ${bench.value}/1000 (${bench.record.year}, ${s.category}${bench.record.sourceType === "community" ? ", community-reported" : ""}).`;
    gaps.push("No GATE score to compare: record a full-length mock and enter Mq/Mt in Settings to estimate one, or wait for official results.");
  } else {
    gaps.push("No verified cut-off for this programme — check the official admissions page.");
  }

  if (a.daysToExam > 0) lines.push(`${a.daysToExam} days until your configured exam date.`);
  lines.push(`Syllabus coverage ${Math.round(a.overall.completionPct)}% (${a.overall.covered}/${a.overall.total}); ${a.overall.mastered} topics meet your mastery criteria.`);

  const weak = a.subjectStats.filter((x) => x.attempted >= 10 && x.accuracy !== null).sort((x, y) => (x.accuracy ?? 0) - (y.accuracy ?? 0)).slice(0, 2);
  if (weak.length) {
    for (const w of weak) {
      const topic = [...a.topicStats.values()].filter((t) => t.topic.subjectId === w.subjectId && t.attempted >= 3).sort((x, y) => (x.accuracy ?? 0) - (y.accuracy ?? 0))[0];
      lines.push(
        `${SUBJECT_MAP[w.subjectId].short} PYQ accuracy is ${Math.round(w.accuracy!)}% over ${w.attempted} attempts${topic ? `; weakest topic ${topic.topic.name} at ${Math.round(topic.accuracy ?? 0)}% (n=${topic.attempted})` : ""}.`,
      );
      tasks.push({ title: `Targeted PYQ set: ${topic ? topic.topic.name : SUBJECT_MAP[w.subjectId].short}`, subjectId: w.subjectId, topicId: topic?.topic.id, minutes: 90 });
    }
  } else gaps.push("Not enough PYQ attempts (10+ per subject) to rank weak subjects.");

  const lastMock = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date)).at(-1);
  if (lastMock) {
    const weakSec = lastMock.subjectMarks.filter((x) => x.max >= 4).sort((x, y) => x.scored / x.max - y.scored / y.max)[0];
    lines.push(`Latest mock “${lastMock.name}”: ${lastMock.score}/${lastMock.totalMarks} (${Math.round(mockPct(lastMock))}%)${weakSec ? `; weakest section ${SUBJECT_MAP[weakSec.subjectId].short} ${weakSec.scored}/${weakSec.max}` : ""}.`);
    if (weakSec) tasks.push({ title: `Rebuild ${SUBJECT_MAP[weakSec.subjectId].short} (from ${lastMock.name})`, subjectId: weakSec.subjectId, minutes: 90 });
    for (const t of lastMock.weakTopicIds.slice(0, 2)) tasks.push({ title: `Post-mock fix: ${TOPIC_MAP[t]?.name}`, topicId: t, subjectId: TOPIC_MAP[t]?.subjectId, minutes: 60 });
  } else gaps.push("No mock tests recorded yet.");

  if (a.openErrors) {
    lines.push(`${a.openErrors} unresolved errors in your notebook${a.warnings[0]?.topicId ? `; recurring in ${TOPIC_MAP[a.warnings[0].topicId]?.name}` : ""}.`);
    tasks.push({ title: "Daily error-notebook review", minutes: 30 });
  }
  if (p.admissionRoute) lines.push(`Admission route: ${p.admissionRoute}`);
  if (p.eligibility) lines.push(`Eligibility: ${p.eligibility}`);
  if (p.id === "iisc-csa-mtech") tasks.push({ title: "Programming practice for the IISc CSA test (C, data structures)", subjectId: "pds", minutes: 60 });
  lines.push(tasks.length ? "Reassess after two timed practice sessions on these areas." : "Log PYQs and a mock to get specific steps.");
  return { headline, lines, tasks, dataGaps: gaps };
}
