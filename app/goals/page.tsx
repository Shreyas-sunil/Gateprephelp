"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Bar, Button, Checkbox, Field, IconButton, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Textarea, cx } from "@/components/ui";
import { Cat } from "@/components/cat/Cat";
import { updateDayLog, updateSettings } from "@/lib/actions";
import { milestoneStatuses, weeklyReview } from "@/lib/motivation";
import { recommendations } from "@/lib/analytics";
import { MILESTONE_DEFS } from "@/lib/defaults";
import { addDays, fmtDate, fmtHours, fmtMinutes, startOfWeek } from "@/lib/date";
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import type { Settings, SubjectId } from "@/types";

export default function GoalsPage() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const toast = useToast();
  const [draft, setDraft] = useState<Partial<Settings> | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  if (!data || !a) return <PageSkeleton />;
  const s = { ...data.settings, ...(draft ?? {}) } as Settings;
  const set = (p: Partial<Settings>) => setDraft({ ...(draft ?? {}), ...p });
  const ws = week ?? startOfWeek(today);
  const wr = weeklyReview(data, a, ws);
  const reflection = data.dayLogs.find((l) => l.date === ws)?.reflection ?? "";
  const ms = milestoneStatuses(data, a, data.achievements);
  const fullMocks = data.mocks.filter((m) => m.kind === "full").length;
  const nextWeekPlan = data.tasks.filter((t) => t.date > wr.to && t.date <= addDays(wr.to, 7) && t.status === "todo");
  const nextWeekSubjects = [...new Set(nextWeekPlan.map((t) => t.subjectId).filter(Boolean))] as SubjectId[];
  const recs = recommendations(data, a);

  const goalRows = [
    { label: "Weekly study hours", value: a.weekMinutes / 60, target: s.weeklyHourGoal, fmt: (v: number) => `${fmtHours(v * 60)}h` },
    { label: "Today's study hours", value: a.todayMinutes / 60, target: s.dailyHourGoal, fmt: (v: number) => `${fmtHours(v * 60)}h` },
    { label: "PYQs attempted", value: a.pyq.attempted, target: s.pyqTarget, fmt: (v: number) => String(Math.round(v)) },
    { label: "Full-length mocks", value: fullMocks, target: s.mockTarget, fmt: (v: number) => String(v) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Goals & weekly review" description="Targets you set, milestones from real records, and an honest look back at each week." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Your targets" hint="Targets are aspirations, not predictions." />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            <Field label="Exam date" htmlFor="g-ex">
              <Input id="g-ex" type="date" value={s.examDate} onChange={(e) => set({ examDate: e.target.value })} />
            </Field>
            <Field label="Target marks (out of 100)" htmlFor="g-tm">
              <Input id="g-tm" type="number" min={0} max={100} value={s.targetMarks} onChange={(e) => set({ targetMarks: Number(e.target.value) })} />
            </Field>
            <Field label="Target GATE score (out of 1000)" htmlFor="g-ts">
              <Input id="g-ts" type="number" min={0} max={1000} value={s.targetGateScore} onChange={(e) => set({ targetGateScore: Number(e.target.value) })} />
            </Field>
            <Field label="Target AIR" htmlFor="g-tr">
              <Input id="g-tr" type="number" min={1} value={s.targetRank} onChange={(e) => set({ targetRank: Number(e.target.value) })} />
            </Field>
            <Field label="Daily study goal (h)" htmlFor="g-dh">
              <Input id="g-dh" type="number" min={0.5} max={16} step={0.5} value={s.dailyHourGoal} onChange={(e) => set({ dailyHourGoal: Number(e.target.value) })} />
            </Field>
            <Field label="Weekly study goal (h)" htmlFor="g-wh">
              <Input id="g-wh" type="number" min={1} max={100} value={s.weeklyHourGoal} onChange={(e) => set({ weeklyHourGoal: Number(e.target.value) })} />
            </Field>
            <Field label="PYQ target" htmlFor="g-pq">
              <Input id="g-pq" type="number" min={0} value={s.pyqTarget} onChange={(e) => set({ pyqTarget: Number(e.target.value) })} />
            </Field>
            <Field label="Full-length mock target" htmlFor="g-mk">
              <Input id="g-mk" type="number" min={0} value={s.mockTarget} onChange={(e) => set({ mockTarget: Number(e.target.value) })} />
            </Field>
          </div>
          {draft && (
            <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await updateSettings(draft);
                  setDraft(null);
                  toast({ tone: "success", title: "Targets saved" });
                }}
              >
                Save targets
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Progress against targets" />
          <ul className="space-y-3 px-4 pb-4">
            {goalRows.map((g) => (
              <li key={g.label}>
                <div className="flex justify-between text-[13px]">
                  <span>{g.label}</span>
                  <span className="num text-ink-2">
                    {g.fmt(g.value)} / {g.fmt(g.target)}
                  </span>
                </div>
                <Bar value={g.value} max={g.target} color="var(--violet)" className="mt-1" label={g.label} />
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3">
            <p className="text-[13px] font-medium">Subject coverage targets (%)</p>
            <div className="mt-2 space-y-2">
              {SUBJECTS.map((sub) => {
                const ss = a.subjectStats.find((x) => x.subjectId === sub.id)!;
                const target = s.subjectTargets[sub.id];
                return (
                  <div key={sub.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-24 shrink-0 truncate">{sub.short}</span>
                    <div className="flex-1">
                      <Bar value={ss.completionPct} color={sub.color} height={5} label={`${sub.short} coverage`} />
                    </div>
                    <span className="num w-10 text-right text-ink-3">{Math.round(ss.completionPct)}%</span>
                    <Input aria-label={`${sub.short} target`} type="number" min={0} max={100} placeholder="—" value={target ?? ""} onChange={(e) => set({ subjectTargets: { ...s.subjectTargets, [sub.id]: e.target.value === "" ? undefined : Number(e.target.value) } })} className="h-7 w-16 text-xs" />
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Milestones" hint="Detected from your records. Toggle or change thresholds; celebrations follow your Settings." />
        <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONE_DEFS.map((def) => {
            const cfg = data.settings.milestones.find((m) => m.id === def.id)!;
            const st = ms.find((m) => m.id === def.id);
            const achievedAt = data.achievements.find((x) => x.id === def.id)?.achievedAt;
            return (
              <li key={def.id} className={cx("rounded-md border p-3", st?.achieved ? "border-amber/50 bg-amber-soft" : "border-line", !cfg.enabled && "opacity-55")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award size={16} className={st?.achieved ? "text-amber" : "text-ink-3"} />
                    <p className="text-[13.5px] font-semibold">{def.title}</p>
                  </div>
                  <Checkbox label={<span className="sr-only">Enable {def.title}</span>} checked={cfg.enabled} onChange={(v) => updateSettings({ milestones: data.settings.milestones.map((m) => (m.id === def.id ? { ...m, enabled: v } : m)) })} />
                </div>
                <p className="mt-1 text-xs text-ink-2">{def.description(st?.target ?? cfg.threshold)}</p>
                {st && <Bar value={st.progress} max={Math.max(1, st.target)} color="var(--amber)" className="mt-2" height={5} label={def.title} />}
                <div className="mt-1.5 flex items-center justify-between text-xs text-ink-3">
                  <span className="num">{st ? `${st.progress}/${st.target}` : "disabled"}</span>
                  {achievedAt ? <span>Reached {fmtDate(new Date(achievedAt).toISOString().slice(0, 10))}</span> : null}
                </div>
                {def.thresholdLabel && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
                    {def.thresholdLabel}
                    <Input type="number" min={1} value={cfg.threshold} onChange={(e) => updateSettings({ milestones: data.settings.milestones.map((m) => (m.id === def.id ? { ...m, threshold: Math.max(1, Number(e.target.value) || 1) } : m)) })} className="h-7 w-20 text-xs" />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title="Weekly review"
          hint={`${fmtDate(wr.from)} – ${fmtDate(wr.to, { year: true })}`}
          action={
            <div className="flex items-center gap-1">
              <IconButton label="Previous week" onClick={() => setWeek(addDays(ws, -7))}>
                <ChevronLeft size={17} />
              </IconButton>
              <IconButton label="Next week" onClick={() => setWeek(addDays(ws, 7))} disabled={ws >= startOfWeek(today)}>
                <ChevronRight size={17} />
              </IconButton>
            </div>
          }
        />
        <div className="grid gap-5 px-4 pb-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Hours studied" value={fmtMinutes(wr.minutes)} sub={wr.prevMinutes ? `${wr.minutes >= wr.prevMinutes ? "+" : "−"}${fmtMinutes(Math.abs(wr.minutes - wr.prevMinutes))} vs last week` : "no data last week"} />
              <Mini label="Tasks completed" value={`${wr.tasksDone}/${wr.tasksPlanned}`} sub={wr.tasksPlanned ? `${Math.round((wr.tasksDone / wr.tasksPlanned) * 100)}%` : "none planned"} />
              <Mini label="PYQ accuracy" value={wr.accuracy === null ? "—" : `${Math.round(wr.accuracy)}%`} sub={`n=${wr.attempted}${wr.prevAccuracy !== null ? ` · last week ${Math.round(wr.prevAccuracy)}% (n=${wr.prevAttempted})` : ""}`} />
              <Mini label="Reviews · mocks" value={`${wr.reviewsDone} · ${wr.mocks}`} sub={`${wr.unresolvedErrors} unresolved errors`} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold">What you worked on</p>
                {wr.topicsAdvanced.length === 0 ? (
                  <p className="mt-1 text-[13px] text-ink-3">No topic status changes recorded this week.</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {wr.topicsAdvanced.slice(0, 16).map((t) => (
                      <Badge key={t}>{TOPIC_MAP[t]?.name}</Badge>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-ink-3">{wr.topicsMasteredNow} topics currently meet mastery criteria.</p>
              </div>
              <div className="space-y-2 text-[13px]">
                <p>
                  <span className="font-semibold">Most improved: </span>
                  {wr.mostImproved ? `${SUBJECT_MAP[wr.mostImproved.subjectId as SubjectId].short} (+${Math.round(wr.mostImproved.delta)} pts, n=${wr.mostImproved.n})` : <span className="text-ink-3">needs 5+ attempts in a subject in both weeks</span>}
                </p>
                <p>
                  <span className="font-semibold">Most persistent weakness: </span>
                  {wr.persistentWeakness ? (
                    <Link href={`/topics/${wr.persistentWeakness.topicId}`} className="hover:underline">
                      {TOPIC_MAP[wr.persistentWeakness.topicId]?.name} ({wr.persistentWeakness.count} errors in 4 weeks)
                    </Link>
                  ) : (
                    <span className="text-ink-3">no topic with repeated errors</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold">Next week&apos;s priorities</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                {nextWeekSubjects.length > 0 && <li>Planned subjects: {nextWeekSubjects.map((x) => SUBJECT_MAP[x].short).join(", ")} ({nextWeekPlan.length} tasks)</li>}
                {recs.map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
                {wr.unresolvedErrors > 0 && <li>Work through {wr.unresolvedErrors} unresolved errors</li>}
                {nextWeekSubjects.length === 0 && recs.length === 0 && wr.unresolvedErrors === 0 && <li className="text-ink-3">Nothing planned yet — set up next week in the planner.</li>}
              </ul>
            </div>
            <Field label="Your reflection" htmlFor="g-ref" hint="Saved when you leave the field.">
              <Textarea id="g-ref" key={ws} defaultValue={reflection} placeholder="What worked? What will you change?" onBlur={(e) => updateDayLog(ws, { reflection: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-line bg-bg-2 p-4 text-center">
            <Cat mood={wr.minutes > wr.prevMinutes && wr.minutes > 0 ? "celebrating" : wr.minutes === 0 ? "encouraging" : "curious"} fur={data.settings.cat.fur} accessory={data.settings.cat.accessory} size={96} />
            <p className="text-[13px] text-ink-2">
              {wr.minutes === 0
                ? "No study time recorded this week. That's fine — next week is a clean page."
                : wr.minutes > wr.prevMinutes
                  ? `${fmtMinutes(wr.minutes)} this week, up from ${fmtMinutes(wr.prevMinutes)}. Keep the pace sustainable.`
                  : `${fmtMinutes(wr.minutes)} recorded. Consistency beats intensity.`}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="num text-lg font-semibold">{value}</p>
      {sub && <p className="text-[11.5px] text-ink-3">{sub}</p>}
    </div>
  );
}
