"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Play, RefreshCw, Rocket, Shuffle } from "lucide-react";
import { Line, LineChart, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useData, useTimer } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Rings } from "@/components/charts/Ring";
import { WeekHeatmap } from "@/components/charts/Heatmap";
import { ChartBox, axisProps, tooltipProps } from "@/components/charts/chart-kit";
import { Cat } from "@/components/cat/Cat";
import { TodayMission } from "@/components/dashboard/TodayMission";
import { WhatNext } from "@/components/dashboard/WhatNext";
import { FocusTimer } from "@/components/planner/FocusTimer";
import { Badge, Bar, Button, PageSkeleton, Panel, PanelHeader, Pct, Stat, cx } from "@/components/ui";
import { addDays, fmtDate, fmtHours, fmtMinutes } from "@/lib/date";
import { heatmapDays, rollingAverage } from "@/lib/calc/stats";
import { mockPct } from "@/lib/calc/readiness";
import { dailyChallenge, dailyMessage, milestoneStatuses } from "@/lib/motivation";
import { updateTask } from "@/lib/actions";
import { SUBJECT_MAP, TOPIC_MAP, subjectName } from "@/data/syllabus";
import { PROGRAMME_MAP } from "@/data/colleges";
import { benchmarkFor } from "@/lib/calc/college";

export default function MissionControl() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const timer = useTimer();
  const [salt, setSalt] = useState(0);

  const heat = useMemo(() => (data ? heatmapDays(data.sessions, data.tasks, data.dayLogs, addDays(today, -7 * 26 + 1), today, data.settings.dailyHourGoal * 60) : []), [data, today]);

  if (!data || !a) return <PageSkeleton />;
  const s = data.settings;
  const msg = dailyMessage(data, a, salt);
  const todays = data.tasks.filter((t) => t.date === today).sort((x, y) => (x.block ?? 9) - (y.block ?? 9) || x.order - y.order);
  const missed = data.tasks.filter((t) => t.date < today && t.status === "todo").length;
  const last = s.lastActive?.topicId ? TOPIC_MAP[s.lastActive.topicId] : undefined;
  const milestones = milestoneStatuses(data, a, data.achievements);
  const next = milestones.filter((m) => !m.achieved).sort((x, y) => y.progress / Math.max(1, y.target) - x.progress / Math.max(1, x.target))[0];
  const mocks = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date));
  const mockSeries = mocks.map((m) => mockPct(m));
  const mockAvg = rollingAverage(mockSeries, 3, 2);
  const mockData = mocks.map((m, i) => ({ name: m.name, date: fmtDate(m.date), pct: Math.round(mockSeries[i]! * 10) / 10, avg: mockAvg[i] === null ? null : Math.round(mockAvg[i]! * 10) / 10 }));
  const dream = PROGRAMME_MAP[s.dreamProgrammeId];
  const dreamBench = dream ? benchmarkFor(dream, s.category, false) ?? benchmarkFor(dream, s.category, true) : null;
  const daysLeft = a.daysToExam;

  return (
    <div className="space-y-5">
      {!s.onboarded && (
        <div className="flex flex-col gap-3 rounded-lg border border-violet/40 bg-violet-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Cat mood="curious" fur={s.cat.fur} accessory={s.cat.accessory} size={52} />
            <div>
              <p className="text-sm font-semibold">Set up your plan in two minutes</p>
              <p className="text-[13px] text-ink-2">Tell GATE CAT your daily hours and starting point. It rebases the PDF&apos;s seven-week plan to today.</p>
            </div>
          </div>
          <Link href="/setup">
            <Button variant="primary" icon={<Rocket size={15} />}>
              Start quick setup
            </Button>
          </Link>
        </div>
      )}

      {/* Hero: destination + readiness orbit */}
      <section className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <Panel className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0" style={{ background: "var(--glow)" }} aria-hidden />
          <div className="relative">
            <p className="text-[13px] text-ink-2">
              Goal: <span className="text-ink">IISc Bengaluru</span> <span className="text-ink-3">via</span> <span className="text-ink">GATE CS 2027</span>
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span className="display num text-[64px] leading-[0.9] font-medium text-ink sm:text-[76px]">{Math.max(0, daysLeft)}</span>
              <span className="pb-1.5 text-sm text-ink-2">
                {daysLeft === 1 ? "day" : "days"} to the exam
                <br />
                <span className="text-ink-3">{fmtDate(s.examDate, { weekday: true, year: true })}</span>
              </span>
            </div>
            {daysLeft < 0 && <p className="mt-2 text-[13px] text-amber">Your configured exam date has passed. Update it in Settings.</p>}
            <p className="mt-2 text-xs text-ink-3">
              CS paper date not yet announced; update in{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-ink-2">
                Settings
              </Link>{" "}
              once it is.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Stat label="PYQs solved" value={a.pyq.attempted} sub={a.pyq.accuracy === null ? "No attempts yet" : `${Math.round(a.pyq.accuracy)}% accurate`} />
              <Stat label="Study today" value={fmtMinutes(a.todayMinutes)} sub={a.todayPlannedMinutes ? `of ${fmtMinutes(a.todayPlannedMinutes)} planned` : "Nothing planned"} tone="cyan" />
              <Stat label="This week" value={`${fmtHours(a.weekMinutes)}h`} sub={`${fmtHours(a.weekPlannedMinutes)}h planned · goal ${s.weeklyHourGoal}h`} />
              <Stat label="Streak" value={`${a.streak.current} ${a.streak.current === 1 ? "day" : "days"}`} sub={`Best ${a.streak.best} · ≥${s.streakMinMinutes} min/day`} tone="amber" />
              <Stat label="Revision queue" value={a.reviews.overdue.length + a.reviews.today.length} sub={a.reviews.overdue.length ? `${a.reviews.overdue.length} overdue` : `${a.reviews.upcoming.length} upcoming`} tone={a.reviews.overdue.length ? "rose" : undefined} />
              <Stat label="Open errors" value={a.openErrors} sub={a.warnings.length ? `${a.warnings.length} recurring pattern${a.warnings.length > 1 ? "s" : ""}` : "No recurring patterns"} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {last ? (
                <Link href={`/topics/${last.id}`}>
                  <Button variant="primary" size="lg" icon={<Play size={16} />}>
                    Continue: {last.name.length > 34 ? last.name.slice(0, 32) + "…" : last.name}
                  </Button>
                </Link>
              ) : (
                <Link href={todays[0]?.topicId ? `/topics/${todays[0].topicId}` : "/syllabus"}>
                  <Button variant="primary" size="lg" icon={<Play size={16} />}>
                    {todays[0]?.topicId ? `Start: ${TOPIC_MAP[todays[0].topicId]?.name}` : "Continue studying"}
                  </Button>
                </Link>
              )}
              {timer.state.status === "idle" && (
                <Button size="lg" onClick={() => timer.start({ subjectId: last?.subjectId, topicId: last?.id })}>
                  Start focus timer
                </Button>
              )}
            </div>
            {last && s.lastActive && <p className="mt-2 text-xs text-ink-3">Last active: {SUBJECT_MAP[last.subjectId].short}, {fmtDate(new Date(s.lastActive.at).toISOString().slice(0, 10))}</p>}
          </div>
        </Panel>

        <Panel className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Readiness orbit</h2>
              <p className="text-[13px] text-ink-3">Every ring is computed from your topic records and PYQ log.</p>
            </div>
            <Link href="/analytics" className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
              Analytics <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:justify-center">
            <Rings
              size={208}
              stroke={13}
              gap={7}
              rings={[
                { value: a.overall.completionPct, color: "var(--violet)", label: "Syllabus coverage" },
                { value: a.overall.masteryPct, color: "var(--amber)", label: "Topic mastery" },
                { value: a.pyq.attempted >= 1 ? a.pyq.accuracy : null, color: "var(--cyan)", label: "PYQ accuracy" },
              ]}
            >
              <Cat mood={timer.state.status === "running" ? (timer.state.phase === "focus" ? "studying" : "resting") : msg.mood} fur={s.cat.fur} accessory={s.cat.accessory} size={84} />
            </Rings>
            <ul className="flex w-full max-w-[220px] flex-col gap-3 text-sm">
              <li>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet" />
                  <span className="text-ink-2">Syllabus coverage</span>
                </div>
                <div className="num mt-0.5 pl-[18px] text-lg font-semibold">
                  <Pct value={a.overall.completionPct} />
                  <span className="ml-1.5 text-xs font-normal text-ink-3">
                    {a.overall.covered}/{a.overall.total} topics
                  </span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                  <span className="text-ink-2">Mastered</span>
                </div>
                <div className="num mt-0.5 pl-[18px] text-lg font-semibold">
                  <Pct value={a.overall.masteryPct} />
                  <span className="ml-1.5 text-xs font-normal text-ink-3">{a.overall.mastered} meet criteria</span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan" />
                  <span className="text-ink-2">PYQ accuracy</span>
                </div>
                <div className="num mt-0.5 pl-[18px] text-lg font-semibold">
                  <Pct value={a.pyq.accuracy} />
                  <span className="ml-1.5 text-xs font-normal text-ink-3">{a.pyq.attempted ? `n = ${a.pyq.attempted}` : "no attempts"}</span>
                </div>
              </li>
              <li className="border-t border-line pt-2 text-xs text-ink-3">
                {a.overall.inProgress} in progress · {a.overall.needsRevision} need revision · {a.overall.statusCounts.not_started} not started
              </li>
            </ul>
          </div>
        </Panel>
      </section>

      {/* Motivation strip */}
      {!s.quietMode && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-ink">
            <span className="mr-2 text-ink-3">{s.cat.name} says</span>
            {msg.text}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-3">Challenge: {dailyChallenge(today)}</span>
            <button type="button" aria-label="Show another message" title="Another message" onClick={() => setSalt((x) => x + 1)} className="rounded p-1 text-ink-3 hover:text-ink">
              <Shuffle size={14} />
            </button>
          </div>
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel>
            <PanelHeader
              title="Today's schedule"
              hint={todays.length ? `${todays.filter((t) => t.status === "done").length} of ${todays.length} tasks done` : "No tasks planned for today"}
              action={
                <Link href="/planner">
                  <Button size="sm" variant="ghost">
                    Open planner
                  </Button>
                </Link>
              }
            />
            <div className="px-4 pb-4">
              {missed > 0 && (
                <Link href="/planner?missed=1" className="mb-2 flex items-center gap-2 rounded-md bg-amber-soft px-3 py-2 text-[13px] text-amber hover:underline">
                  <RefreshCw size={14} /> {missed} unfinished task{missed > 1 ? "s" : ""} from earlier days — reschedule or let go
                </Link>
              )}
              {todays.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-center text-[13px] text-ink-3">
                  {s.onboarded ? "Add tasks in the planner or regenerate your plan." : "Run quick setup to generate a plan, or add tasks yourself in the planner."}
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {todays.slice(0, 7).map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <input type="checkbox" aria-label={`Mark ${t.title} done`} checked={t.status === "done"} onChange={(e) => updateTask(t.id, { status: e.target.checked ? "done" : "todo" })} className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className={cx("truncate text-[13.5px]", t.status === "done" ? "text-ink-3 line-through" : "text-ink")}>{t.title}</p>
                        <p className="text-xs text-ink-3">
                          {t.block ? `Block ${t.block} · ` : ""}
                          {fmtMinutes(t.plannedMin)}
                          {t.subjectId ? ` · ${subjectName(t.subjectId)}` : ""}
                        </p>
                      </div>
                      {t.link && (
                        <a href={t.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-cyan hover:underline">
                          {t.link.includes("youtube.com") ? "Watch" : t.link.includes("practicepaper.in") ? "Practise" : "Open"}
                        </a>
                      )}
                      {t.status !== "done" && (
                        <Button size="sm" variant="ghost" onClick={() => timer.start({ subjectId: t.subjectId, topicId: t.topicId, taskId: t.id })} disabled={timer.state.status !== "idle"}>
                          Focus
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
          <WhatNext />
        </div>
        <div className="space-y-5">
          <TodayMission />
          <div className="2xl:hidden">
            <FocusTimer compact />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <PanelHeader title="Weakest subjects" hint="Lowest PYQ accuracy, min. 10 attempts" />
          <div className="px-4 pb-4">
            {a.weakestSubjects.length === 0 ? (
              <p className="text-[13px] text-ink-3">Log at least 10 PYQs in a subject to rank it.</p>
            ) : (
              <ul className="space-y-2.5">
                {a.weakestSubjects.map((w) => (
                  <li key={w.subjectId}>
                    <Link href={`/analytics/subject/${w.subjectId}`} className="block hover:opacity-90">
                      <div className="flex justify-between text-[13px]">
                        <span>{SUBJECT_MAP[w.subjectId].short}</span>
                        <span className="num text-ink-2">
                          {Math.round(w.accuracy ?? 0)}% <span className="text-ink-3">n={w.attempted}</span>
                        </span>
                      </div>
                      <Bar value={w.accuracy ?? 0} color="var(--rose)" className="mt-1" label={`${SUBJECT_MAP[w.subjectId].short} accuracy`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Mock trend" hint="Score as % of total, 3-mock average" />
          <div className="px-2 pb-3">
            <ChartBox height={130} empty={mocks.length === 0} emptyTitle="No mocks recorded" emptyBody="Record a mock in Mock Tests to see the trend.">
              <LineChart data={mockData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" {...axisProps} hide={mockData.length > 6} />
                <YAxis domain={[0, 100]} {...axisProps} width={40} />
                <Tooltip {...tooltipProps} formatter={(v, n) => [v === null ? "—" : `${v}%`, n === "pct" ? "Score" : "3-mock avg"]} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} />
                <Line dataKey="pct" stroke="var(--violet)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="avg" stroke="var(--cyan)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ChartBox>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Next milestone" action={<Link href="/goals" className="text-xs text-ink-3 hover:text-ink">All</Link>} />
          <div className="px-4 pb-4">
            {next ? (
              <>
                <p className="text-sm font-medium">{next.title}</p>
                <p className="text-[13px] text-ink-3">{next.description}</p>
                <Bar value={next.progress} max={next.target} color="var(--amber)" className="mt-3" label={next.title} />
                <p className="num mt-1 text-xs text-ink-3">
                  {next.progress} / {next.target}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-ink-3">Every enabled milestone is complete. Add new ones in Goals.</p>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Destination" action={<Link href="/colleges" className="text-xs text-ink-3 hover:text-ink">Predictor</Link>} />
          <div className="px-4 pb-4">
            {dream ? (
              <>
                <p className="text-sm font-medium">{dream.short}: {dream.programme}</p>
                <p className="text-[13px] text-ink-3">{dream.location}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dreamBench ? (
                    <Badge tone={dreamBench.record.sourceType === "official" ? "cyan" : "amber"} title={dreamBench.record.sourceTitle}>
                      {dreamBench.record.year} {s.category}: {dreamBench.value}/1000 {dreamBench.record.sourceType === "official" ? "official" : "community, unverified"}
                    </Badge>
                  ) : (
                    <Badge>Cut-off data unavailable</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-ink-3">GATE score benchmark (out of 1000). Not directly comparable with mock marks.</p>
              </>
            ) : (
              <p className="text-[13px] text-ink-3">Choose a dream programme in the College Predictor.</p>
            )}
          </div>
        </Panel>
      </section>

      <Panel>
        <PanelHeader
          title="Study consistency"
          hint="Last 26 weeks of recorded study time. Missed days are just gaps — pick up from today."
          action={
            <Link href="/analytics">
              <Button size="sm" variant="ghost">
                Full analytics
              </Button>
            </Link>
          }
        />
        <div className="px-4 pb-4">
          <WeekHeatmap days={heat} cell={15} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Subject progress" hint="Coverage = topics at Practicing or beyond. Bar colour is the subject colour." action={<Link href="/syllabus" className="text-xs text-ink-3 hover:text-ink">Syllabus</Link>} />
        <div className="grid gap-x-8 gap-y-3 px-4 pb-4 sm:grid-cols-2">
          {a.subjectStats.map((ss) => (
            <Link key={ss.subjectId} href={`/syllabus?subject=${ss.subjectId}`} className="block rounded-md px-1 py-0.5 hover:bg-surface-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="truncate">{SUBJECT_MAP[ss.subjectId].name}</span>
                <span className="num shrink-0 text-ink-3">
                  {ss.covered}/{ss.total} · {Math.round(ss.completionPct)}%
                </span>
              </div>
              <Bar value={ss.completionPct} color={SUBJECT_MAP[ss.subjectId].color} className="mt-1" label={`${SUBJECT_MAP[ss.subjectId].name} coverage`} />
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
