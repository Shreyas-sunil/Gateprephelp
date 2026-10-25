"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, CalendarPlus, CheckCircle2, CircleDashed, ExternalLink, Play, Plus, Trash2, ClipboardList } from "lucide-react";
import { useData, useTimer, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Button, Field, IconButton, Input, PageSkeleton, Panel, PanelHeader, Select, Stars, Textarea, cx } from "@/components/ui";
import { SUBJECT_MAP, TOPIC_MAP, defaultPriority } from "@/data/syllabus";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/calc/progress";
import { addTask, ensureReview, rescheduleReview, touchLastActive, updateProgress, updateTask } from "@/lib/actions";
import { fmtDate, fmtMinutes, relativeDay } from "@/lib/date";
import { uid } from "@/lib/defaults";
import { BUILTIN_RESOURCES } from "@/data/resources";
import { ERROR_TYPES } from "@/data/plan";
import type { Priority, TopicStatus } from "@/types";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const topic = TOPIC_MAP[id];
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const timer = useTimer();
  const toast = useToast();
  const [notes, setNotes] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [bm, setBm] = useState({ label: "", url: "" });
  const [taskTitle, setTaskTitle] = useState("");

  useEffect(() => {
    if (topic) void touchLastActive(topic.id);
  }, [topic]);

  if (!topic) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-2">That topic doesn&apos;t exist.</p>
        <Link href="/syllabus" className="mt-2 inline-block text-sm text-violet-2 hover:underline">
          Back to syllabus
        </Link>
      </div>
    );
  }
  if (!data || !a) return <PageSkeleton />;
  const st = a.topicStats.get(topic.id)!;
  const p = st.progress;
  const subject = SUBJECT_MAP[topic.subjectId];
  const pr = p.priority ?? defaultPriority(topic.subjectId);
  const review = data.reviews.find((r) => r.kind === "topic" && r.refId === topic.id);
  const tasks = data.tasks.filter((t) => t.topicId === topic.id).sort((x, y) => y.date.localeCompare(x.date));
  const errors = data.errors.filter((e) => e.topicId === topic.id).sort((x, y) => y.date.localeCompare(x.date));
  const pyqs = data.pyqs.filter((q) => q.topicId === topic.id).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt);
  const resources = [...BUILTIN_RESOURCES, ...data.userResources].filter((r) => r.topicIds.includes(topic.id) || data.resourceStates.get(r.id)?.linkedTopicIds.includes(topic.id));
  const subjectResources = [...BUILTIN_RESOURCES, ...data.userResources]
    .filter((r) => !resources.includes(r) && r.subjectIds.includes(topic.subjectId) && r.classification !== "in-app" && !(r.id.startsWith("yt-go-") && r.topicIds.length))
    .sort((x, y) => Number(y.origin === "requested") - Number(x.origin === "requested"))
    .slice(0, 5);
  const est = p.estHours ?? topic.estHours;

  const setStatus = async (s: TopicStatus) => {
    await updateProgress(topic.id, { status: s });
    toast({ tone: "success", title: `${topic.name}: ${STATUS_LABEL[s]}`, body: s === "mastered" && !st.meetsMastery ? "Marked. It counts as mastered once your criteria are met." : undefined });
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/syllabus?subject=${subject.id}`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> {subject.name}
          {topic.group ? ` / ${topic.group}` : ""}
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="display text-[28px] leading-tight font-medium sm:text-[32px]">{topic.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={topic.origin === "official" ? "cyan" : topic.origin === "ga" ? "amber" : "neutral"}>
                {topic.origin === "official" ? "Official syllabus" : topic.origin === "ga" ? "General Aptitude" : "From PDF study plan"}
              </Badge>
              <Badge tone={pr === "high" ? "violet" : "neutral"}>{pr[0]!.toUpperCase() + pr.slice(1)} priority</Badge>
              {st.meetsMastery ? <Badge tone="mint">Meets mastery criteria</Badge> : <Badge>Stage: {st.stage.replace("_", " ")}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Play size={15} />} disabled={timer.state.status !== "idle"} onClick={() => timer.start({ subjectId: topic.subjectId, topicId: topic.id })}>
              {timer.state.status !== "idle" ? "Timer running" : "Start focus"}
            </Button>
            <Link href={`/pyq?topic=${topic.id}`}>
              <Button icon={<ClipboardList size={15} />}>Log PYQ</Button>
            </Link>
            <Link href={`/tutor?topic=${topic.id}`}>
              <Button icon={<Bot size={15} />}>Ask tutor</Button>
            </Link>
          </div>
        </div>
      </div>

      {topic.flag && <div className="rounded-md border border-amber/40 bg-amber-soft px-4 py-2.5 text-[13px] text-amber">{topic.flag}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel>
            <PanelHeader title="Status" hint="Mastered only counts once your evidence thresholds are met." />
            <div className="flex flex-wrap gap-1.5 px-4 pb-4">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={p.status === s}
                  onClick={() => setStatus(s)}
                  className={cx(
                    "h-9 rounded-md border px-3 text-[13px] font-medium transition-colors",
                    p.status === s ? "border-violet bg-violet-soft text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-3">
              <Field label="Priority">
                <Select value={pr} onChange={(e) => updateProgress(topic.id, { priority: e.target.value as Priority })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </Field>
              <Field label="Confidence" group>
                <Stars label="Confidence" value={p.confidence} onChange={(n) => updateProgress(topic.id, { confidence: n })} />
              </Field>
              <Field label="Estimated study time (h)">
                <Input type="number" min={0} step={0.5} value={est} onChange={(e) => updateProgress(topic.id, { estHours: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Mastery criteria" hint="Edit the thresholds in Settings." />
            <ul className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
              {[
                { ok: p.status === "mastered", label: "Status set to Mastered" },
                { ok: p.confidence >= data.settings.mastery.minConfidence, label: `Confidence ≥ ${data.settings.mastery.minConfidence} (now ${p.confidence || "unrated"})` },
                { ok: st.attempted >= data.settings.mastery.minAttempts, label: `${data.settings.mastery.minAttempts}+ PYQs attempted (now ${st.attempted})` },
                { ok: st.accuracy !== null && st.accuracy >= data.settings.mastery.minAccuracy, label: `Accuracy ≥ ${data.settings.mastery.minAccuracy}% (now ${st.accuracy === null ? "—" : Math.round(st.accuracy) + "%"})` },
                ...(data.settings.mastery.requireReview ? [{ ok: st.reviewCount > 0, label: `At least one completed revision (now ${st.reviewCount})` }] : []),
              ].map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-[13px]">
                  {c.ok ? <CheckCircle2 size={15} className="text-mint" /> : <CircleDashed size={15} className="text-ink-3" />}
                  <span className={c.ok ? "text-ink" : "text-ink-2"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Practice statistics" />
            <div className="grid grid-cols-2 gap-4 px-4 pb-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-3">Attempted</p>
                <p className="num text-xl font-semibold">{st.attempted}</p>
                <p className="text-xs text-ink-3">{st.logged} logged + {p.manualAttempted} bulk</p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Correct</p>
                <p className="num text-xl font-semibold">{st.correct}</p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Accuracy</p>
                <p className="num text-xl font-semibold">{st.accuracy === null ? "—" : `${Math.round(st.accuracy)}%`}</p>
                <p className="text-xs text-ink-3">{st.attempted && st.attempted < 10 ? "Small sample" : ""}</p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Time studied</p>
                <p className="num text-xl font-semibold">{fmtMinutes(st.minutes)}</p>
                <p className="text-xs text-ink-3">of ~{est}h estimated</p>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="text-[13px] text-ink-2">Bulk practice (e.g. a 30-question sprint you didn&apos;t log one by one)</p>
              <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
                <Field label="Attempted">
                  <Input type="number" min={0} value={p.manualAttempted} onChange={(e) => updateProgress(topic.id, { manualAttempted: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </Field>
                <Field label="Correct">
                  <Input type="number" min={0} max={p.manualAttempted} value={p.manualCorrect} onChange={(e) => updateProgress(topic.id, { manualCorrect: Math.min(p.manualAttempted, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} />
                </Field>
              </div>
            </div>
            {pyqs.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {pyqs.slice(0, 6).map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px]">
                    <span className="truncate">
                      {q.year ? `GATE ${q.year}` : "PYQ"} {q.questionNo ?? ""} · {q.qtype} · {q.marks}m
                    </span>
                    <Badge tone={q.result === "correct" ? "mint" : q.result === "incorrect" ? "rose" : "neutral"}>{q.result}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Notes" hint="Saved when you leave the field." />
            <div className="space-y-3 px-4 pb-4">
              <Textarea
                aria-label="Personal notes"
                className="min-h-[140px]"
                placeholder="Formulas, traps, your own explanation…"
                value={notes ?? p.notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== null && notes !== p.notes) {
                    void updateProgress(topic.id, { notes });
                    toast({ tone: "success", title: "Notes saved" });
                  }
                  setNotes(null);
                }}
              />
              <Field label="Completion evidence (optional)" hint="e.g. “Solved GATE 2019–2024 PYQs, 18/20”">
                <Input
                  value={evidence ?? p.evidence ?? ""}
                  onChange={(e) => setEvidence(e.target.value)}
                  onBlur={() => {
                    if (evidence !== null) void updateProgress(topic.id, { evidence });
                    setEvidence(null);
                  }}
                />
              </Field>
            </div>
          </Panel>

          {topic.sourceTips?.length ? (
            <Panel>
              <PanelHeader title="From your PDF" />
              <ul className="list-disc space-y-1 px-8 pb-4 text-[13.5px] text-ink-2">
                {topic.sourceTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Revision" />
            <div className="space-y-2 px-4 pb-4 text-[13px]">
              <p className="text-ink-2">
                Last studied: <span className="text-ink">{st.lastStudied ? `${fmtDate(st.lastStudied)} (${relativeDay(st.lastStudied, today).toLowerCase()})` : "never"}</span>
              </p>
              <p className="text-ink-2">
                Next revision: <span className="text-ink">{p.nextRevision ? fmtDate(p.nextRevision, { weekday: true }) : "not scheduled"}</span>
              </p>
              {review && <p className="text-xs text-ink-3">{review.history.length} reviews done · current interval {review.intervalDays} days · ease {review.ease}</p>}
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <Field label="Revise on">
                  <Input
                    type="date"
                    value={p.nextRevision ?? ""}
                    onChange={async (e) => {
                      const d = e.target.value;
                      if (!d) return;
                      if (review) await rescheduleReview(review.id, d);
                      else await ensureReview("topic", topic.id, d);
                    }}
                  />
                </Field>
                {!review && (
                  <Button
                    size="md"
                    icon={<CalendarPlus size={15} />}
                    onClick={async () => {
                      await ensureReview("topic", topic.id, today);
                      toast({ tone: "success", title: "Added to today's revision queue" });
                    }}
                  >
                    Revise today
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Tasks" />
            <div className="px-4 pb-4">
              <form
                className="flex gap-1.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!taskTitle.trim()) return;
                  await addTask({ date: today, title: taskTitle.trim(), subjectId: topic.subjectId, topicId: topic.id });
                  setTaskTitle("");
                  toast({ tone: "success", title: "Task added to today" });
                }}
              >
                <Input aria-label="New task for this topic" placeholder="Add a task for today" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                <IconButton label="Add task" type="submit" className="border border-line">
                  <Plus size={15} />
                </IconButton>
              </form>
              {tasks.length === 0 ? (
                <p className="mt-2 text-xs text-ink-3">No tasks linked to this topic.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {tasks.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[13px]">
                      <input type="checkbox" aria-label={`Mark ${t.title} done`} checked={t.status === "done"} onChange={(e) => updateTask(t.id, { status: e.target.checked ? "done" : "todo" })} />
                      <span className={cx("min-w-0 flex-1 truncate", t.status === "done" && "text-ink-3 line-through")}>{t.title}</span>
                      <span className="shrink-0 text-xs text-ink-3">{fmtDate(t.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Bookmarks" hint="Questions or links worth revisiting" />
            <div className="px-4 pb-4">
              {p.bookmarks.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {p.bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-[13px]">
                      {b.url ? (
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-cyan hover:underline">
                          {b.label}
                        </a>
                      ) : (
                        <span className="min-w-0 flex-1 truncate">{b.label}</span>
                      )}
                      <IconButton size="sm" label="Remove bookmark" onClick={() => updateProgress(topic.id, { bookmarks: p.bookmarks.filter((x) => x.id !== b.id) })}>
                        <Trash2 size={13} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="space-y-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!bm.label.trim()) return;
                  const url = bm.url.trim();
                  if (url && !/^https?:\/\//.test(url)) {
                    toast({ tone: "error", title: "Links must start with http:// or https://" });
                    return;
                  }
                  void updateProgress(topic.id, { bookmarks: [...p.bookmarks, { id: uid("bm"), label: bm.label.trim(), url: url || undefined }] });
                  setBm({ label: "", url: "" });
                }}
              >
                <Input aria-label="Bookmark label" placeholder="e.g. GATE 2021 Q34 (semaphore)" value={bm.label} onChange={(e) => setBm({ ...bm, label: e.target.value })} />
                <div className="flex gap-1.5">
                  <Input aria-label="Bookmark URL" placeholder="https://… (optional)" value={bm.url} onChange={(e) => setBm({ ...bm, url: e.target.value })} />
                  <Button type="submit" size="md">
                    Add
                  </Button>
                </div>
              </form>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Errors in this topic" action={<Link href={`/errors?topic=${topic.id}`} className="text-xs text-ink-3 hover:text-ink">Open</Link>} />
            <div className="px-4 pb-4">
              {errors.length === 0 ? (
                <p className="text-xs text-ink-3">No errors logged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {errors.slice(0, 5).map((e) => (
                    <li key={e.id} className="text-[13px]">
                      <Badge tone={e.type === "A" ? "violet" : e.type === "B" ? "amber" : "cyan"}>Type {e.type}</Badge> <span className="text-ink-2">{e.rule || e.whyWrong || e.questionRef}</span>
                      <span className="sr-only">{ERROR_TYPES[e.type].name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Resources" action={<Link href="/resources" className="text-xs text-ink-3 hover:text-ink">Library</Link>} />
            <ul className="space-y-1.5 px-4 pb-4 text-[13px]">
              {[...resources, ...subjectResources].map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  {r.url ? (
                    <a href={r.url} target={r.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-cyan hover:underline">
                      {r.name}
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-ink-2">{r.name}</span>
                  )}
                  {r.url && !r.url.startsWith("/") && <ExternalLink size={12} className="shrink-0 text-ink-3" />}
                  {resources.includes(r) && <Badge tone="violet">Linked</Badge>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
