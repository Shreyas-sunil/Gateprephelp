"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MoonStar, Play, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { useData, useTimer, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Bar, Button, Dialog, Field, IconButton, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Textarea, cx } from "@/components/ui";
import { SubjectTopicFields } from "@/components/pickers";
import { FocusTimer } from "@/components/planner/FocusTimer";
import { TaskDialog, type TaskDraft } from "@/components/planner/TaskDialog";
import { MonthHeatmap } from "@/components/charts/Heatmap";
import { addDays, addMonths, dateRange, dayName, daysInMonth, diffDays, fmtDate, fmtMinutes, fmtMonth, startOfMonth, startOfWeek } from "@/lib/date";
import { heatmapDays } from "@/lib/calc/stats";
import { deleteSession, logSession, moveTask, rescheduleMissed, updateDayLog, updateTask } from "@/lib/actions";
import { SUBJECT_MAP, subjectName, topicName } from "@/data/syllabus";
import { RECOVERY_MESSAGES } from "@/data/motivation";
import type { SubjectId, Task } from "@/types";

type View = "day" | "week" | "month";

function PlannerInner() {
  const data = useData();
  const today = useToday();
  const params = useSearchParams();
  const toast = useToast();
  const timer = useTimer();
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TaskDraft | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const showMissedFirst = params.get("missed") === "1";
  const date = cursor ?? today;

  const missed = useMemo(() => (data ? data.tasks.filter((t) => t.date < today && t.status === "todo").sort((a, b) => a.date.localeCompare(b.date)) : []), [data, today]);
  if (!data) return <PageSkeleton />;
  const s = data.settings;

  const tasksOn = (d: string) => data.tasks.filter((t) => t.date === d).sort((a, b) => (a.block ?? 9) - (b.block ?? 9) || a.order - b.order);
  const minutesOn = (d: string) => data.sessions.filter((x) => x.date === d).reduce((m, x) => m + x.minutes, 0);
  const shift = (n: number) => setCursor(view === "day" ? addDays(date, n) : view === "week" ? addDays(date, 7 * n) : addMonths(date, n));

  const weekStart = startOfWeek(date);
  const weekDays = dateRange(weekStart, addDays(weekStart, 6));
  const weekPlanned = weekDays.reduce((m, d) => m + tasksOn(d).filter((t) => t.status !== "skipped").reduce((x, t) => x + t.plannedMin, 0), 0);
  const weekActual = weekDays.reduce((m, d) => m + minutesOn(d), 0);
  const heavy = weekPlanned > s.weeklyHourGoal * 60 * 1.15;

  const rangeLabel = view === "day" ? `${dayName(date, true)}, ${fmtDate(date, { year: true })}` : view === "week" ? `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 6), { year: true })}` : fmtMonth(date);
  const dayLog = data.dayLogs.find((l) => l.date === date);

  return (
    <div>
      <PageHeader
        title="Planner"
        description="Plan the three daily blocks, track actual time, and reschedule without guilt."
        actions={
          <>
            <Link href="/setup">
              <Button size="sm" variant="ghost" icon={<Wand2 size={14} />}>
                Regenerate plan
              </Button>
            </Link>
            <Button size="sm" icon={<Clock size={14} />} onClick={() => setLogOpen(true)}>
              Log study time
            </Button>
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setDialog({ date, plannedMin: 60 })}>
              New task
            </Button>
          </>
        }
      />

      {missed.length > 0 && (
        <Panel className={cx("mb-4 border-amber/30", showMissedFirst && "ring-1 ring-amber/40")}>
          <PanelHeader
            title={`${missed.length} unfinished task${missed.length > 1 ? "s" : ""} from earlier days`}
            hint={RECOVERY_MESSAGES[missed.length % RECOVERY_MESSAGES.length]}
            action={
              <>
                <Button
                  size="sm"
                  variant="amber"
                  icon={<RotateCcw size={14} />}
                  onClick={async () => {
                    await rescheduleMissed(
                      missed.map((t) => t.id),
                      today,
                    );
                    toast({ tone: "success", title: `Moved ${missed.length} tasks to today` });
                  }}
                >
                  Move all to today
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    for (const t of missed) await updateTask(t.id, { status: "skipped" });
                    toast({ tone: "info", title: "Marked as skipped", body: "They no longer count as planned time." });
                  }}
                >
                  Let them go
                </Button>
              </>
            }
          />
          <ul className="max-h-48 divide-y divide-line overflow-y-auto px-4 pb-3">
            {missed.slice(0, 30).map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="w-16 shrink-0 text-xs text-ink-3">{fmtDate(t.date)}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <Button size="sm" variant="ghost" onClick={() => moveTask(t.id, today)}>
                  Today
                </Button>
                <Button size="sm" variant="ghost" onClick={() => moveTask(t.id, addDays(today, 1))}>
                  Tomorrow
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Next" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </IconButton>
          <span className="ml-1 text-[15px] font-semibold">{rangeLabel}</span>
          {date !== today && (
            <Button size="sm" variant="ghost" onClick={() => setCursor(null)}>
              Today
            </Button>
          )}
        </div>
        <Segmented label="Planner view" value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      </div>

      {view === "day" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <DayScore tasks={tasksOn(date)} actual={minutesOn(date)} isFuture={date > today} />
            {dayLog?.restDay && (
              <div className="flex items-center gap-2 rounded-md border border-amber/40 bg-amber-soft px-3 py-2 text-[13px] text-amber">
                <MoonStar size={15} /> Marked as a rest day. Rest is part of the plan.
              </div>
            )}
            {[1, 2, 3, 0].map((block) => {
              const list = tasksOn(date).filter((t) => (t.block ?? 0) === block);
              const meta = s.blocks.find((b) => b.id === block);
              if (block === 0 && !list.length) return null;
              const planned = list.filter((t) => t.status !== "skipped").reduce((m, t) => m + t.plannedMin, 0);
              return (
                <Panel key={block}>
                  <PanelHeader
                    title={meta ? `Block ${block}: ${meta.name}` : "Other tasks"}
                    hint={meta ? `${meta.time} · template ${meta.hours}h · planned ${fmtMinutes(planned)}` : `Planned ${fmtMinutes(planned)}`}
                    action={
                      <IconButton label={`Add task to ${meta ? "block " + block : "other"}`} onClick={() => setDialog({ date, block: (block || undefined) as Task["block"], plannedMin: 60 })}>
                        <Plus size={16} />
                      </IconButton>
                    }
                  />
                  <ul className="divide-y divide-line px-4 pb-2">
                    {list.length === 0 && <li className="py-3 text-[13px] text-ink-3">{meta?.description ?? "Nothing here."}</li>}
                    {list.map((t) => (
                      <TaskRow key={t.id} t={t} onEdit={() => setDialog(t)} onFocus={() => timer.start({ subjectId: t.subjectId, topicId: t.topicId, taskId: t.id })} timerBusy={timer.state.status !== "idle"} today={today} />
                    ))}
                  </ul>
                </Panel>
              );
            })}
            <SessionsList date={date} />
          </div>
          <div className="space-y-4" id="timer">
            <FocusTimer />
            <Panel className="p-4">
              <p className="text-[13px] font-medium text-ink-2">Focus intention</p>
              <Input
                aria-label="Daily focus intention"
                className="mt-1.5"
                placeholder="Today I want to…"
                defaultValue={dayLog?.intention ?? ""}
                key={date + (dayLog?.intention ?? "")}
                onBlur={(e) => updateDayLog(date, { intention: e.target.value })}
              />
              <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
                <input type="checkbox" checked={!!dayLog?.restDay} onChange={(e) => updateDayLog(date, { restDay: e.target.checked })} />
                Mark {date === today ? "today" : "this day"} as a rest day
              </label>
            </Panel>
          </div>
        </div>
      )}

      {view === "week" && (
        <>
          <Panel className="mb-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <span>
                Planned <span className="num font-semibold">{fmtMinutes(weekPlanned)}</span> · recorded <span className="num font-semibold text-cyan">{fmtMinutes(weekActual)}</span> · weekly goal {s.weeklyHourGoal}h
              </span>
              {heavy && <Badge tone="amber">Heavier than your weekly goal — consider trimming</Badge>}
            </div>
            <Bar value={weekPlanned} max={Math.max(weekPlanned, s.weeklyHourGoal * 60)} color="var(--ink-3)" className="mt-2" label="Planned vs goal" />
            <Bar value={weekActual} max={Math.max(weekPlanned, s.weeklyHourGoal * 60)} color="var(--cyan)" className="mt-1" label="Recorded vs goal" />
            <p className="mt-2 text-xs text-ink-3">Drag a task onto another day to move it. On touch screens, open the task and change its date.</p>
          </Panel>
          <div className="grid gap-2 md:grid-cols-7">
            {weekDays.map((d) => {
              const list = tasksOn(d);
              return (
                <div
                  key={d}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (dragId) await moveTask(dragId, d);
                    setDragId(null);
                  }}
                  className={cx("min-h-[180px] rounded-lg border bg-surface/70 p-2", d === today ? "border-violet/50" : "border-line")}
                >
                  <button type="button" onClick={() => { setCursor(d); setView("day"); }} className="mb-1.5 flex w-full items-baseline justify-between text-left">
                    <span className="text-[13px] font-semibold">
                      {dayName(d)} {Number(d.slice(8))}
                    </span>
                    <span className="num text-[11px] text-ink-3">{fmtMinutes(minutesOn(d))}</span>
                  </button>
                  <ul className="space-y-1">
                    {list.map((t) => (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        className={cx("cursor-grab rounded-md border border-line bg-bg-2 px-2 py-1.5 text-[12px] leading-snug active:cursor-grabbing", t.status === "done" && "opacity-55", t.status === "skipped" && "opacity-40 line-through")}
                        style={{ borderLeft: `3px solid ${t.subjectId ? SUBJECT_MAP[t.subjectId].color : "var(--line-strong)"}` }}
                      >
                        <button type="button" className="w-full text-left" onClick={() => setDialog(t)}>
                          <span className={cx(t.status === "done" && "line-through")}>{t.title}</span>
                          <span className="num mt-0.5 block text-[10.5px] text-ink-3">{fmtMinutes(t.plannedMin)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setDialog({ date: d, plannedMin: 60 })} className="mt-1 w-full rounded py-1 text-[12px] text-ink-3 hover:bg-surface-2 hover:text-ink">
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "month" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Panel className="p-4">
            <MonthHeatmap
              days={heatmapDays(data.sessions, data.tasks, data.dayLogs, startOfMonth(date), addDays(startOfMonth(date), daysInMonth(date) - 1), s.dailyHourGoal * 60)}
              onSelect={(d) => {
                setCursor(d.date);
                setView("day");
              }}
            />
            <p className="mt-3 text-xs text-ink-3">Colour shows recorded study time. Click a day to open it.</p>
          </Panel>
          <Panel>
            <PanelHeader title="This month" />
            <MonthSummary month={date} />
          </Panel>
        </div>
      )}

      <TaskDialog open={!!dialog} initial={dialog} onClose={() => setDialog(null)} />
      <LogSessionDialog open={logOpen} onClose={() => setLogOpen(false)} date={date} onSaved={(m) => toast({ tone: "success", title: `Logged ${fmtMinutes(m)}` })} />
    </div>
  );
}

function DayScore({ tasks, actual, isFuture }: { tasks: Task[]; actual: number; isFuture: boolean }) {
  const counted = tasks.filter((t) => t.status !== "skipped");
  const planned = counted.reduce((m, t) => m + t.plannedMin, 0);
  const doneMin = counted.filter((t) => t.status === "done").reduce((m, t) => m + t.plannedMin, 0);
  const pct = planned ? (doneMin / planned) * 100 : 0;
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">Daily completion</p>
          <p className="num text-2xl font-semibold">{planned ? `${Math.round(pct)}%` : "—"}</p>
          <p className="text-xs text-ink-3">
            {counted.filter((t) => t.status === "done").length} of {counted.length} tasks · {fmtMinutes(doneMin)} of {fmtMinutes(planned)} planned
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-3">Recorded study time</p>
          <p className="num text-2xl font-semibold text-cyan">{fmtMinutes(actual)}</p>
          <p className="text-xs text-ink-3">{isFuture ? "Upcoming day" : planned ? `${Math.round((actual / planned) * 100)}% of planned` : "No plan"}</p>
        </div>
      </div>
      <Bar value={pct} className="mt-3" color="var(--violet)" label="Daily completion" />
    </Panel>
  );
}

function TaskRow({ t, onEdit, onFocus, timerBusy, today }: { t: Task; onEdit: () => void; onFocus: () => void; timerBusy: boolean; today: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <input type="checkbox" aria-label={`Mark ${t.title} done`} checked={t.status === "done"} onChange={(e) => updateTask(t.id, { status: e.target.checked ? "done" : "todo" })} className="mt-1 h-4 w-4 shrink-0" />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className={cx("text-[13.5px] leading-snug", t.status === "done" ? "text-ink-3 line-through" : t.status === "skipped" ? "text-ink-3 line-through" : "text-ink")}>{t.title}</p>
        <p className="mt-0.5 text-xs text-ink-3">
          {fmtMinutes(t.plannedMin)}
          {t.subjectId ? ` · ${subjectName(t.subjectId)}` : ""}
          {t.topicId ? ` · ${topicName(t.topicId)}` : ""}
          {t.postponedCount > 0 ? ` · moved ${t.postponedCount}×` : ""}
          {t.source === "plan" ? " · from plan" : ""}
        </p>
        {t.notes && <p className="mt-1 line-clamp-2 text-xs text-ink-3">{t.notes}</p>}
      </button>
      {t.link && (
        <a href={t.link} target="_blank" rel="noopener noreferrer" className="shrink-0 self-center rounded px-1.5 py-1 text-xs text-cyan hover:bg-cyan-soft" title={t.link}>
          {t.link.includes("youtube.com") ? "Watch" : t.link.includes("practicepaper.in") ? "Practise" : "Open"}
        </a>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {t.status === "todo" && (
          <>
            <IconButton size="sm" label="Start focus on this task" onClick={onFocus} disabled={timerBusy}>
              <Play size={14} />
            </IconButton>
            <IconButton size="sm" label="Postpone to tomorrow" onClick={() => moveTask(t.id, addDays(t.date < today ? today : t.date, 1))}>
              <CalendarClock size={14} />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}

function SessionsList({ date }: { date: string }) {
  const data = useData();
  if (!data) return null;
  const list = data.sessions.filter((s) => s.date === date).sort((a, b) => a.start - b.start);
  return (
    <Panel>
      <PanelHeader title="Study sessions" hint="Recorded time — the source for every hours chart." />
      <ul className="divide-y divide-line px-4 pb-2">
        {list.length === 0 && <li className="py-3 text-[13px] text-ink-3">No sessions recorded this day.</li>}
        {list.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-2 text-[13px]">
            <span className="num w-24 shrink-0 text-xs text-ink-3">
              {new Date(s.start).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} · {s.mode}
            </span>
            <div className="min-w-0 flex-1">
              <p>
                <span className="num font-medium">{fmtMinutes(s.minutes)}</span> {s.topicId ? topicName(s.topicId) : s.subjectId ? subjectName(s.subjectId) : "Unassigned"}
              </p>
              {s.notes && <p className="text-xs text-ink-3">{s.notes}</p>}
            </div>
            <IconButton size="sm" label="Delete session" onClick={() => deleteSession(s.id)}>
              <Trash2 size={13} />
            </IconButton>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function MonthSummary({ month }: { month: string }) {
  const data = useData();
  if (!data) return null;
  const from = startOfMonth(month);
  const to = addDays(from, daysInMonth(month) - 1);
  const sessions = data.sessions.filter((s) => s.date >= from && s.date <= to);
  const tasks = data.tasks.filter((t) => t.date >= from && t.date <= to && t.status !== "skipped");
  const bySubject = new Map<SubjectId, number>();
  for (const s of sessions) if (s.subjectId) bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + s.minutes);
  const total = sessions.reduce((m, s) => m + s.minutes, 0);
  return (
    <div className="space-y-3 px-4 pb-4 text-[13px]">
      <p>
        Recorded <span className="num font-semibold text-cyan">{fmtMinutes(total)}</span> · planned <span className="num font-semibold">{fmtMinutes(tasks.reduce((m, t) => m + t.plannedMin, 0))}</span>
      </p>
      <p className="text-ink-3">
        {tasks.filter((t) => t.status === "done").length} of {tasks.length} tasks done · {new Set(sessions.map((s) => s.date)).size} study days
      </p>
      <ul className="space-y-1.5">
        {[...bySubject.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([sid, m]) => (
            <li key={sid}>
              <div className="flex justify-between text-xs">
                <span>{SUBJECT_MAP[sid].short}</span>
                <span className="num text-ink-3">{fmtMinutes(m)}</span>
              </div>
              <Bar value={m} max={total} color={SUBJECT_MAP[sid].color} height={4} label={SUBJECT_MAP[sid].short} />
            </li>
          ))}
      </ul>
    </div>
  );
}

function LogSessionDialog({ open, onClose, date, onSaved }: { open: boolean; onClose: () => void; date: string; onSaved: (m: number) => void }) {
  const [f, setF] = useState<{ date: string; start: string; minutes: number; subjectId?: SubjectId; topicId?: string; notes: string }>({ date, start: "09:00", minutes: 60, notes: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    if (!(f.minutes > 0 && f.minutes <= 16 * 60)) return setErr("Minutes must be between 1 and 960.");
    const start = Date.parse(`${f.date}T${f.start}:00+05:30`);
    if (Number.isNaN(start)) return setErr("Check the date and start time.");
    if (diffDays(f.date, date) < -366) return setErr("Date looks wrong.");
    await logSession({ start, end: start + f.minutes * 60_000, minutes: Math.round(f.minutes), date: f.date, subjectId: f.subjectId, topicId: f.topicId, mode: "manual", notes: f.notes || undefined });
    onSaved(f.minutes);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log study time"
      description="For study you didn't time in the app. Recorded as a manual session."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Log time
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" htmlFor="ls-date">
            <Input id="ls-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Start (IST)" htmlFor="ls-start">
            <Input id="ls-start" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          </Field>
          <Field label="Minutes" htmlFor="ls-min">
            <Input id="ls-min" type="number" min={1} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} />
          </Field>
        </div>
        <SubjectTopicFields subjectId={f.subjectId} topicId={f.topicId} onChange={(v) => setF({ ...f, ...v })} />
        <Field label="Notes" htmlFor="ls-notes">
          <Textarea id="ls-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {err && <p className="text-[13px] text-rose">{err}</p>}
      </div>
    </Dialog>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlannerInner />
    </Suspense>
  );
}
