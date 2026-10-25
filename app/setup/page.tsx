"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck2 } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, Checkbox, Field, Input, PageHeader, PageSkeleton, Panel, cx } from "@/components/ui";
import { Cat } from "@/components/cat/Cat";
import { generatePlan, templateDays } from "@/lib/calc/plan";
import { replacePlanTasks, updateProgress, updateSettings } from "@/lib/actions";
import { SEVEN_WEEK_PLAN, SOURCE_PLAN_DATES } from "@/data/plan";
import { SUBJECTS, topicsForSubject } from "@/data/syllabus";
import { addDays, diffDays, fmtDate, fmtMinutes, isYmd } from "@/lib/date";
import type { SubjectId } from "@/types";

const TIMES = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];
const LEVELS = [
  { id: "starting", label: "Starting out", body: "Most subjects are new. More theory time in Block 1." },
  { id: "partial", label: "Partly prepared", body: "Some subjects done. Keeps the PDF's 3.5 : 3.5 : 2 split." },
  { id: "advanced", label: "Revising", body: "Strong base (e.g. maths). Shifts time from theory to PYQs, as the PDF suggests for strengths." },
] as const;

export default function SetupPage() {
  const data = useData();
  const today = useToday();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<{
    examDate: string;
    startDate: string;
    syllabusEnd: string;
    hours: number;
    times: string[];
    level: "starting" | "partial" | "advanced";
    skip: SubjectId[];
    markSkipped: boolean;
    includeGA: boolean;
    includeMocks: boolean;
  } | null>(null);

  const f = form ?? (data
    ? {
        examDate: data.settings.examDate,
        startDate: today,
        syllabusEnd: data.settings.syllabusEndDate > today ? data.settings.syllabusEndDate : addDays(today, 35),
        hours: data.settings.dailyHourGoal,
        times: data.settings.preferredTimes,
        level: data.settings.prepLevel,
        skip: [] as SubjectId[],
        markSkipped: false,
        includeGA: true,
        includeMocks: true,
      }
    : null);

  const valid = !!f && isYmd(f.startDate) && isYmd(f.syllabusEnd) && isYmd(f.examDate) && f.syllabusEnd >= f.startDate && f.examDate > f.syllabusEnd;
  const preview = (() => {
    if (!f || !valid || !data) return null;
    const blocks = data.settings.blocks.map((b, i) => ({ ...b, time: f.times[i] ? TIMES.find((t) => t.id === f.times[i])?.label ?? b.time : b.time }));
    return generatePlan({
      startDate: f.startDate,
      syllabusEndDate: f.syllabusEnd,
      examDate: f.examDate,
      hoursPerDay: f.hours,
      prepLevel: f.level,
      preferredTimes: f.times,
      skipSubjects: f.skip,
      includeGA: f.includeGA,
      includeMockPhases: f.includeMocks,
      blocks,
    });
  })();

  if (!data || !f) return <PageSkeleton />;
  const set = (p: Partial<typeof f>) => setForm({ ...f, ...p });

  const weekMap = (() => {
    if (!preview) return [];
    const days = templateDays(f.skip);
    const N = days.length;
    const D = preview.realDays;
    return SEVEN_WEEK_PLAN.map((w) => {
      const idx = days.map((d, i) => (d.week === w.week ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return { w, skipped: true as const };
      const first = Math.floor((idx[0]! * D) / N);
      const last = Math.max(first, Math.ceil(((idx[idx.length - 1]! + 1) * D) / N) - 1);
      return { w, skipped: false as const, from: addDays(f.startDate, first), to: addDays(f.startDate, Math.min(D - 1, last)) };
    });
  })();

  const finish = async () => {
    if (!preview) return;
    await replacePlanTasks(preview.tasks, f.startDate);
    await updateSettings({
      onboarded: true,
      examDate: f.examDate,
      syllabusEndDate: f.syllabusEnd,
      planStartDate: f.startDate,
      dailyHourGoal: f.hours,
      weeklyHourGoal: Math.round(f.hours * 6.5),
      prepLevel: f.level,
      preferredTimes: f.times,
      mockPhases: preview.phases,
    });
    if (f.markSkipped) {
      for (const s of f.skip) for (const t of topicsForSubject(s)) {
        const cur = data.progress.get(t.id);
        if (!cur || cur.status === "not_started" || cur.status === "learning") await updateProgress(t.id, { status: "practicing" });
      }
    }
    toast({ tone: "success", title: `Plan created: ${preview.tasks.length} tasks`, body: `${fmtDate(f.startDate)} → ${fmtDate(f.examDate, { year: true })}` });
    router.push("/planner");
  };

  const steps = ["Dates", "Availability", "Starting point", "Review"];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Quick setup" description="Answer four short questions. GATE CAT rebases your PDF's seven-week plan and mock phases onto your real calendar." />
      <ol className="mb-5 flex gap-2" aria-label="Setup steps">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cx("h-1 rounded-full", i <= step ? "bg-violet" : "bg-surface-3")} />
            <p className={cx("mt-1.5 text-xs", i === step ? "text-ink" : "text-ink-3")} aria-current={i === step ? "step" : undefined}>
              {i + 1}. {s}
            </p>
          </li>
        ))}
      </ol>

      <Panel className="p-5">
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber/40 bg-amber-soft p-3 text-[13px] text-amber">
              Your PDF&apos;s plan runs {fmtDate(SOURCE_PLAN_DATES.start, { year: true })} – {fmtDate(SOURCE_PLAN_DATES.end, { year: true })}.{" "}
              {today > SOURCE_PLAN_DATES.start ? `It started ${diffDays(SOURCE_PLAN_DATES.start, today)} days ago, so its dates won't be shown as upcoming. ` : ""}
              The same sequence will be fitted between your start date and syllabus end date.
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date" htmlFor="sd">
                <Input id="sd" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              <Field label="Finish syllabus by" htmlFor="se" hint="PDF default: 30 Nov">
                <Input id="se" type="date" value={f.syllabusEnd} onChange={(e) => set({ syllabusEnd: e.target.value })} />
              </Field>
              <Field label="Exam date" htmlFor="ed" hint="CS date TBA; 6 Feb is the earliest exam day">
                <Input id="ed" type="date" value={f.examDate} onChange={(e) => set({ examDate: e.target.value })} />
              </Field>
            </div>
            {!valid && <p className="text-[13px] text-rose">Dates must be in order: start ≤ syllabus end &lt; exam.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field label={`Study hours per day: ${f.hours}h`} hint="The PDF assumes 9 hours. Choose what you can sustain — the plan scales.">
              <input type="range" min={1} max={12} step={0.5} value={f.hours} onChange={(e) => set({ hours: Number(e.target.value) })} aria-label="Study hours per day" />
            </Field>
            <div>
              <p className="text-[13px] font-medium text-ink-2">Preferred study times</p>
              <p className="text-xs text-ink-3">Blocks are labelled in this order: theory, PYQs, revision.</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {TIMES.map((t) => (
                  <Checkbox key={t.id} label={t.label} checked={f.times.includes(t.id)} onChange={(on) => set({ times: on ? TIMES.map((x) => x.id).filter((x) => f.times.includes(x) || x === t.id) : f.times.filter((x) => x !== t.id) })} />
                ))}
              </div>
            </div>
            {preview && (
              <div className="grid gap-2 sm:grid-cols-3">
                {data.settings.blocks.map((b, i) => (
                  <div key={b.id} className="rounded-md border border-line p-3">
                    <p className="text-xs text-ink-3">Block {b.id} · {TIMES.find((t) => t.id === f.times[i])?.label ?? b.time}</p>
                    <p className="text-[13.5px] font-medium">{b.name}</p>
                    <p className="num mt-1 text-lg font-semibold text-cyan">{fmtMinutes(preview.minutes[i]!)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button key={l.id} type="button" aria-pressed={f.level === l.id} onClick={() => set({ level: l.id })} className={cx("rounded-md border p-3 text-left", f.level === l.id ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong")}>
                  <p className="text-[13.5px] font-medium">{l.label}</p>
                  <p className="mt-0.5 text-xs text-ink-3">{l.body}</p>
                </button>
              ))}
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink-2">Subjects to leave out of the plan (already done)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SUBJECTS.filter((s) => s.id !== "ga").map((s) => (
                  <Checkbox key={s.id} label={s.name} checked={f.skip.includes(s.id)} onChange={(on) => set({ skip: on ? [...f.skip, s.id] : f.skip.filter((x) => x !== s.id) })} />
                ))}
              </div>
              {f.skip.length > 0 && <Checkbox className="mt-3" label="Also mark their topics as Practicing" checked={f.markSkipped} onChange={(v) => set({ markSkipped: v })} />}
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <Checkbox label="Add a short daily General Aptitude block (not in the PDF's plan)" checked={f.includeGA} onChange={(v) => set({ includeGA: v })} />
              <Checkbox label="Schedule the PDF's three mock-test phases after the syllabus" checked={f.includeMocks} onChange={(v) => set({ includeMocks: v })} />
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Cat mood="curious" fur={data.settings.cat.fur} accessory={data.settings.cat.accessory} size={56} />
              <p className="text-sm text-ink-2">
                {preview.templateDayCount} plan days fitted into <span className="text-ink">{preview.realDays} calendar days</span>
                {preview.ratio > 1.05 ? ` — compressed ×${preview.ratio.toFixed(1)}, so some days combine two plan days.` : preview.ratio < 0.95 ? " — stretched, so some plan days repeat." : "."}
              </p>
            </div>
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-2 text-left text-xs text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium">Week</th>
                    <th className="px-3 py-2 font-medium">PDF dates</th>
                    <th className="px-3 py-2 font-medium">Your dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {weekMap.map((m) => (
                    <tr key={m.w.week}>
                      <td className="px-3 py-2">
                        {m.w.week}. {m.w.title}
                      </td>
                      <td className="px-3 py-2 text-ink-3">{m.w.sourceDates}</td>
                      <td className="px-3 py-2">{m.skipped ? <Badge>Left out</Badge> : `${fmtDate(m.from)} – ${fmtDate(m.to)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {f.includeMocks && (
              <div className="grid gap-2 sm:grid-cols-3">
                {preview.phases.map((p) => (
                  <div key={p.id} className="rounded-md border border-line p-3">
                    <p className="text-xs text-ink-3">Phase {p.id}</p>
                    <p className="text-[13.5px] font-medium">{p.name}</p>
                    <p className="text-xs text-ink-2">
                      {fmtDate(p.start)} – {fmtDate(p.end)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-3">
              Creates {preview.tasks.length} tasks. Unfinished plan tasks from {fmtDate(f.startDate)} onward are replaced; your own tasks and completed tasks are kept. You can edit, move or delete anything afterwards.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-line pt-4">
          <Button variant="ghost" icon={<ArrowLeft size={15} />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < 3 ? (
            <Button variant="primary" disabled={!valid} onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight size={15} />
            </Button>
          ) : (
            <Button variant="primary" icon={<CalendarCheck2 size={15} />} disabled={!preview} onClick={finish}>
              Create my plan
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
