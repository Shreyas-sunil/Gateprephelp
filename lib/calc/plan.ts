import type { MockPhase, SubjectId, Task, TemplateBlock } from "@/types";
import { SEVEN_WEEK_PLAN, DEFAULT_MOCK_PHASES, type PlanSegment } from "@/data/plan";
import { TOPIC_MAP } from "@/data/syllabus";
import { addDays, diffDays } from "@/lib/date";
import { uid } from "@/lib/defaults";
import { SUBJECT_LINKS, videoForTopic } from "@/data/resources";

const MOCK_URL = "https://practicepaper.in/gate-cse/gate-cse-mock-test-series";

export interface PlanInput {
  startDate: string;
  syllabusEndDate: string;
  examDate: string;
  hoursPerDay: number;
  prepLevel: "starting" | "partial" | "advanced";
  preferredTimes: string[];
  skipSubjects: SubjectId[];
  includeGA: boolean;
  includeMockPhases: boolean;
  blocks: TemplateBlock[];
  mockPhases?: MockPhase[];
}

export interface TemplateDay {
  week: number;
  segment: PlanSegment;
  topicIds: string[];
}

export function templateDays(skip: SubjectId[]): TemplateDay[] {
  const skipSet = new Set(skip);
  const out: TemplateDay[] = [];
  for (const w of SEVEN_WEEK_PLAN) {
    for (const seg of w.segments) {
      if (seg.subjectIds.length && seg.subjectIds.every((s) => skipSet.has(s))) continue;
      const m = seg.topicIds.length;
      for (let j = 0; j < seg.days; j++) {
        const topicIds = m ? seg.topicIds.slice(Math.floor((j * m) / seg.days), Math.floor(((j + 1) * m) / seg.days)) : [];
        out.push({ week: w.week, segment: seg, topicIds });
      }
    }
  }
  return out;
}

/** Splits the daily hours across the three blocks, keeping the PDF's 3.5 : 3.5 : 2 ratio by default. */
export function blockMinutes(blocks: TemplateBlock[], hoursPerDay: number, prepLevel: PlanInput["prepLevel"]): [number, number, number] {
  const h = [blocks[0]?.hours ?? 3.5, blocks[1]?.hours ?? 3.5, blocks[2]?.hours ?? 2] as [number, number, number];
  if (prepLevel === "advanced") {
    const shift = h[0] * 0.3;
    h[0] -= shift;
    h[1] += shift;
  } else if (prepLevel === "starting") {
    const shift = h[1] * 0.15;
    h[0] += shift;
    h[1] -= shift;
  }
  const total = h[0] + h[1] + h[2];
  const totalMin = Math.max(30, hoursPerDay * 60);
  const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
  const b1 = round5((h[0] / total) * totalMin);
  const b2 = round5((h[1] / total) * totalMin);
  const b3 = Math.max(5, Math.round(totalMin) - b1 - b2);
  return [b1, b2, b3];
}

/** Proportionally rebases the PDF's three mock phases onto the window between syllabus end and the exam. */
export function rebaseMockPhases(syllabusEnd: string, examDate: string, base: MockPhase[] = DEFAULT_MOCK_PHASES): MockPhase[] {
  const origLens = base.map((p) => diffDays(p.start, p.end) + 1);
  const origTotal = origLens.reduce((a, b) => a + b, 0);
  const start = addDays(syllabusEnd, 1);
  const window = diffDays(start, examDate) + 1;
  if (window < 3) return base.map((p) => ({ ...p, start: examDate, end: examDate }));
  const l1 = Math.max(1, Math.round((window * (origLens[0] ?? 15)) / origTotal));
  const l2 = Math.max(1, Math.round((window * (origLens[1] ?? 36)) / origTotal));
  const l3 = Math.max(1, window - l1 - l2);
  const s1 = start;
  const e1 = addDays(s1, l1 - 1);
  const s2 = addDays(e1, 1);
  const e2 = addDays(s2, l2 - 1);
  const s3 = addDays(e2, 1);
  const e3 = addDays(s3, l3 - 1);
  const ranges: [string, string][] = [
    [s1, e1],
    [s2, e2],
    [s3, e3],
  ];
  return base.map((p, i) => ({ ...p, actions: [...p.actions], start: ranges[i]![0], end: ranges[i]![1] }));
}

function topicList(ids: string[], max = 4): string {
  const names = ids.map((id) => TOPIC_MAP[id]?.name ?? id);
  if (names.length <= max) return names.join(", ");
  return names.slice(0, max).join(", ") + ` +${names.length - max} more`;
}

export interface GeneratedPlan {
  tasks: Task[];
  realDays: number;
  templateDayCount: number;
  ratio: number;
  phases: MockPhase[];
  batch: string;
  minutes: [number, number, number];
}

export function generatePlan(input: PlanInput, now = Date.now()): GeneratedPlan {
  const batch = uid("plan");
  const days = templateDays(input.skipSubjects);
  const D = diffDays(input.startDate, input.syllabusEndDate) + 1;
  const N = days.length;
  const tasks: Task[] = [];
  const [b1, b2raw, b3] = blockMinutes(input.blocks, input.hoursPerDay, input.prepLevel);
  const gaMin = input.includeGA ? Math.min(30, Math.round(b2raw / 6 / 5) * 5 || 15) : 0;
  const b2 = b2raw - gaMin;
  const timeOf = (i: number) => input.blocks[i]?.time ?? "";
  let order = 0;
  const mk = (date: string, t: Partial<Task> & Pick<Task, "title" | "plannedMin">): Task => ({
    id: uid("task"),
    date,
    status: "todo",
    order: order++,
    source: "plan",
    createdAt: now,
    postponedCount: 0,
    planBatch: batch,
    ...t,
  });

  if (D > 0 && N > 0) {
    for (let i = 0; i < D; i++) {
      const date = addDays(input.startDate, i);
      let lo = Math.floor((i * N) / D);
      let hi = Math.floor(((i + 1) * N) / D) - 1;
      if (hi < lo) hi = lo;
      lo = Math.min(lo, N - 1);
      hi = Math.min(hi, N - 1);
      const slice = days.slice(lo, hi + 1);
      const segs = [...new Set(slice.map((d) => d.segment))];
      const study = segs.filter((s) => !s.isTest);
      const tests = segs.filter((s) => s.isTest);
      const topicIds = [...new Set(slice.flatMap((d) => d.topicIds))];
      const subjectId = (study[0] ?? tests[0])?.subjectIds[0];

      if (study.length) {
        const title = study.map((s) => s.title).join(" + ");
        tasks.push(
          mk(date, {
            title: `Theory: ${topicIds.length ? topicList(topicIds) : title}`,
            block: 1,
            plannedMin: tests.length ? Math.round(b1 / 2 / 5) * 5 : b1,
            subjectId,
            topicId: topicIds[0],
            link: videoForTopic(topicIds[0], subjectId),
            notes: `${timeOf(0)} · Week ${slice[0]?.week} — ${title}. ${study.map((s) => s.detail).join(" ")}`,
          }),
        );
        const q = Math.max(5, Math.round((27.5 * b2) / 210));
        tasks.push(
          mk(date, {
            title: `PYQ sprint: ~${q} questions on ${topicIds.length ? topicList(topicIds, 2) : title}`,
            block: 2,
            plannedMin: tests.length ? Math.round(b2 / 2 / 5) * 5 : b2,
            subjectId,
            topicId: topicIds[0],
            link: subjectId ? SUBJECT_LINKS[subjectId]?.pyq : undefined,
            notes: `${timeOf(1)} · Attempt each question for at least 7 minutes before checking the solution.`,
          }),
        );
      }
      for (const t of tests) {
        tasks.push(
          mk(date, {
            title: t.title,
            block: 2,
            plannedMin: study.length ? Math.round(b2 / 2 / 5) * 5 : Math.min(180, b1 + b2),
            subjectId: t.subjectIds[0],
            link: t.subjectIds[0] ? SUBJECT_LINKS[t.subjectIds[0]]?.pyq : undefined,
            notes: t.detail,
          }),
        );
      }
      tasks.push(
        mk(date, {
          title: tests.length ? "Analyse test & log every error (A/B/C)" : "Revision & error log",
          block: 3,
          plannedMin: b3,
          subjectId,
          notes: `${timeOf(2)} · Write the exact mathematical or conceptual reason for each failure.`,
        }),
      );
      if (gaMin > 0) {
        tasks.push(mk(date, { title: "General Aptitude practice", block: 2, plannedMin: gaMin, subjectId: "ga", notes: "Added by GATE CAT — not part of the PDF's seven-week plan." }));
      }
    }
  }

  const phases = rebaseMockPhases(input.syllabusEndDate, input.examDate, input.mockPhases ?? DEFAULT_MOCK_PHASES);
  if (input.includeMockPhases) {
    const total = Math.max(60, input.hoursPerDay * 60);
    const [p1, p2, p3] = phases;
    if (p1)
      for (let d = p1.start; d <= p1.end && d < input.examDate; d = addDays(d, 1)) {
        tasks.push(mk(d, { title: "Multi-subject test (e.g. OS + COA)", block: 2, link: MOCK_URL, plannedMin: Math.min(180, Math.round(total / 3)), notes: "Phase 1 — context switching." }));
        tasks.push(mk(d, { title: "Track mistakes from today's test", block: 3, plannedMin: Math.min(120, Math.round(total / 4.5)), notes: "Log every lost mark in the error notebook." }));
        tasks.push(mk(d, { title: "Revise the exact sub-topics you got wrong", block: 1, plannedMin: Math.round(total / 2.25), notes: "Phase 1 — deep revision." }));
      }
    if (p2) {
      let k = 0;
      for (let d = p2.start; d <= p2.end && d < input.examDate; d = addDays(d, 1), k++) {
        if (k % 3 === 0) {
          tasks.push(mk(d, { title: "Full-length mock (9:30 AM – 12:30 PM slot)", block: 1, link: MOCK_URL, plannedMin: 180, notes: "Desk, on-screen virtual calculator, unruled scratch pad. Use the three-round method." }));
          tasks.push(mk(d, { title: "4-hour post-mock audit", block: 2, plannedMin: 240, notes: "Categorize every lost mark: Type A/B/C or unattempted." }));
        } else {
          tasks.push(mk(d, { title: "Targeted revision of weak topics from the last mock", block: 1, plannedMin: Math.round(total / 2), notes: "Phase 2 — peak simulation." }));
          tasks.push(mk(d, { title: "Error notebook review", block: 3, plannedMin: Math.min(90, Math.round(total / 4)), notes: "Phase 2." }));
        }
      }
    }
    if (p3) {
      const papers = ["GATE 2024", "GATE 2025", "GATE 2026"];
      let k = 0;
      for (let d = p3.start; d < input.examDate && d <= p3.end; d = addDays(d, 1), k++) {
        tasks.push(mk(d, { title: "Read the error notebook cover to cover", block: 1, plannedMin: 60, notes: "Phase 3 — every morning." }));
        tasks.push(mk(d, { title: `Re-solve official ${papers[k % 3]} CS paper`, block: 2, plannedMin: 180, notes: "Phase 3 — PYQ lockdown. No new mocks." }));
      }
    }
  }

  return { tasks, realDays: Math.max(0, D), templateDayCount: N, ratio: D > 0 ? N / D : 0, phases, batch, minutes: [b1, b2, b3] };
}
