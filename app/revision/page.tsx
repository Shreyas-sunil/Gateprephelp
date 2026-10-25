"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, Flame, History, Plus, Trash2, Zap } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Button, EmptyState, IconButton, Input, PageHeader, PageSkeleton, Panel, PanelHeader, cx } from "@/components/ui";
import { SubjectTopicFields } from "@/components/pickers";
import { Cat } from "@/components/cat/Cat";
import { ensureReview, gradeReview, removeReview, rescheduleReview } from "@/lib/actions";
import { nextInterval, reviewPriority } from "@/lib/calc/srs";
import { diffDays, relativeDay } from "@/lib/date";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import { ERROR_TYPES } from "@/data/plan";
import type { Grade, ReviewItem, SubjectId } from "@/types";

const GRADES: { g: Grade; label: string; tone: string }[] = [
  { g: "again", label: "Again", tone: "border-rose/50 text-rose hover:bg-rose-soft" },
  { g: "hard", label: "Hard", tone: "border-amber/50 text-amber hover:bg-amber-soft" },
  { g: "good", label: "Good", tone: "border-violet/60 text-violet-2 hover:bg-violet-soft" },
  { g: "easy", label: "Easy", tone: "border-mint/50 text-mint hover:bg-mint-soft" },
];

export default function RevisionPage() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const toast = useToast();
  const [session, setSession] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [add, setAdd] = useState<{ subjectId?: SubjectId; topicId?: string }>({});

  const queue = useMemo(() => {
    if (!data || !a) return [];
    const due = [...a.reviews.overdue, ...a.reviews.today];
    return due
      .map((r) => {
        const conf = r.kind === "topic" ? a.topicStats.get(r.refId)?.progress.confidence : undefined;
        const err = r.kind === "error" ? data.errors.find((e) => e.id === r.refId) : undefined;
        const openErrors = r.kind === "topic" ? data.errors.filter((e) => e.topicId === r.refId && e.status === "open").length : 0;
        return { r, score: reviewPriority(r, today, { confidence: conf, openErrors, repeatCount: err?.repeatCount }) };
      })
      .sort((x, y) => y.score - x.score)
      .map((x) => x.r);
  }, [data, a, today]);

  if (!data || !a) return <PageSkeleton />;
  const c = data.settings.srs;

  const forgotten = [...a.topicStats.values()].filter((t) => ["practicing", "revision", "mastered"].includes(t.progress.status) && !t.progress.nextRevision && (!t.lastStudied || diffDays(t.lastStudied, today) > 21));
  const declining: { topicId: string; recent: number; prev: number }[] = [];
  const byTopic = new Map<string, typeof data.pyqs>();
  for (const p of data.pyqs) if (p.topicId && p.result !== "unattempted") byTopic.set(p.topicId, [...(byTopic.get(p.topicId) ?? []), p]);
  for (const [topicId, list] of byTopic) {
    if (list.length < 10) continue;
    const s = [...list].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
    const acc = (arr: typeof list) => (arr.filter((p) => p.result === "correct").length / arr.length) * 100;
    const recent = acc(s.slice(-5));
    const prev = acc(s.slice(-10, -5));
    if (prev - recent >= 20) declining.push({ topicId, recent, prev });
  }

  const label = (r: ReviewItem) => {
    if (r.kind === "topic") return TOPIC_MAP[r.refId]?.name ?? "Topic";
    const e = data.errors.find((x) => x.id === r.refId);
    return e ? `Error: ${e.questionRef}` : "Error (deleted)";
  };

  const sessionIds = session ?? [];
  const current = session ? data.reviews.find((r) => r.id === sessionIds[idx]) : undefined;

  const grade = async (r: ReviewItem, g: Grade) => {
    const next = await gradeReview(r.id, g);
    toast({ tone: "success", title: `${label(r)} → next in ${next?.intervalDays} day${next?.intervalDays === 1 ? "" : "s"}` });
    setRevealed(false);
    if (session) {
      if (idx + 1 >= sessionIds.length) {
        setSession(null);
        setIdx(0);
        toast({ tone: "success", title: "Revision session complete", body: `${sessionIds.length} item${sessionIds.length > 1 ? "s" : ""} reviewed.` });
      } else setIdx(idx + 1);
    }
  };

  return (
    <div>
      <PageHeader
        title="Revision engine"
        description="Spaced repetition for topics and logged mistakes. Revise anything at any time — no full study session needed."
        actions={
          queue.length > 0 && !session ? (
            <Button
              variant="primary"
              icon={<Zap size={15} />}
              onClick={() => {
                setSession(queue.slice(0, 15).map((r) => r.id));
                setIdx(0);
                setRevealed(false);
              }}
            >
              Rapid revision ({Math.min(15, queue.length)})
            </Button>
          ) : undefined
        }
      />

      {session && current && (
        <Panel className="mb-5 border-violet/40 p-5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>
              Item {idx + 1} of {sessionIds.length}
            </span>
            <button type="button" onClick={() => setSession(null)} className="hover:text-ink">
              End session
            </button>
          </div>
          <ReviewCard r={current} revealed={revealed} onReveal={() => setRevealed(true)} />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map(({ g, label: l, tone }) => (
              <button key={g} type="button" onClick={() => grade(current, g)} className={cx("rounded-md border px-3 py-2.5 text-left transition-colors", tone)}>
                <span className="block text-sm font-semibold">{l}</span>
                <span className="num text-xs opacity-80">next in {nextInterval(current, g, c).interval}d</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel>
            <PanelHeader title={`Due now (${queue.length})`} hint="Ordered by overdue days, low confidence and repeated errors." />
            {queue.length === 0 ? (
              <EmptyState
                icon={<Cat mood="resting" fur={data.settings.cat.fur} accessory={data.settings.cat.accessory} size={72} />}
                title="Nothing due"
                body="Mark a topic “Revision needed”, add one below, or log an error — they'll be scheduled automatically."
              />
            ) : (
              <ul className="divide-y divide-line px-4 pb-2">
                {queue.map((r) => (
                  <QueueRow key={r.id} r={r} label={label(r)} today={today} onGrade={(g) => grade(r, g)} c={c} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={`Upcoming (${a.reviews.upcoming.length})`} />
            {a.reviews.upcoming.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-ink-3">No upcoming revisions.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto px-4 pb-2">
                {a.reviews.upcoming.slice(0, 60).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="w-20 shrink-0 text-xs text-ink-3">{relativeDay(r.due, today)}</span>
                    <span className="min-w-0 flex-1 truncate">{label(r)}</span>
                    <Badge>{r.kind}</Badge>
                    <Input type="date" aria-label={`Reschedule ${label(r)}`} value={r.due} onChange={(e) => e.target.value && rescheduleReview(r.id, e.target.value)} className="h-8 w-[140px] text-xs" />
                    <IconButton size="sm" label="Remove from revision" onClick={() => removeReview(r.id)}>
                      <Trash2 size={13} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Add to revision" />
            <div className="space-y-2 px-4 pb-4">
              <SubjectTopicFields className="grid gap-2" subjectId={add.subjectId} topicId={add.topicId} onChange={setAdd} />
              <Button
                className="w-full"
                icon={<Plus size={15} />}
                disabled={!add.topicId}
                onClick={async () => {
                  await ensureReview("topic", add.topicId!, today);
                  toast({ tone: "success", title: "Added to today's queue", body: TOPIC_MAP[add.topicId!]?.name });
                  setAdd({});
                }}
              >
                Revise today
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Forgotten topics" hint="Covered, not scheduled, and untouched for 3+ weeks" />
            <ul className="space-y-1 px-4 pb-4 text-[13px]">
              {forgotten.length === 0 && <li className="text-ink-3">None right now.</li>}
              {forgotten.slice(0, 10).map((t) => (
                <li key={t.topic.id} className="flex items-center gap-2">
                  <History size={13} className="shrink-0 text-ink-3" />
                  <Link href={`/topics/${t.topic.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {t.topic.name}
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => ensureReview("topic", t.topic.id, today)}>
                    Schedule
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Declining accuracy" hint="Last 5 attempts vs previous 5 (needs 10+ logged)" />
            <ul className="space-y-1.5 px-4 pb-4 text-[13px]">
              {declining.length === 0 && <li className="text-ink-3">No declines detected.</li>}
              {declining.map((d) => (
                <li key={d.topicId} className="flex items-center gap-2">
                  <Flame size={13} className="shrink-0 text-rose" />
                  <span className="min-w-0 flex-1 truncate">{TOPIC_MAP[d.topicId]?.name}</span>
                  <span className="num text-xs text-ink-3">
                    {Math.round(d.prev)}% → {Math.round(d.recent)}%
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => ensureReview("topic", d.topicId, today)}>
                    Revise
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="How scheduling works" />
            <div className="space-y-1.5 px-4 pb-4 text-[12.5px] text-ink-2">
              <p>
                <b className="text-rose">Again</b>: back in {c.againDays} day, ease −0.2.
              </p>
              <p>
                <b className="text-amber">Hard</b>: interval × {c.hardMultiplier}, ease −0.15.
              </p>
              <p>
                <b className="text-violet-2">Good</b>: {c.firstGoodDays}d, then {c.secondGoodDays}d, then interval × ease (starts {c.startEase}).
              </p>
              <p>
                <b className="text-mint">Easy</b>: Good × {c.easyBonus}, ease +0.15.
              </p>
              <p className="text-ink-3">
                Ease never drops below {c.minEase}; intervals cap at {c.maxInterval} days. Change these in{" "}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function QueueRow({ r, label, today, onGrade, c }: { r: ReviewItem; label: string; today: string; onGrade: (g: Grade) => void; c: Parameters<typeof nextInterval>[2] }) {
  const [open, setOpen] = useState(false);
  const overdue = r.due < today;
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="text-[13.5px]">{label}</span>
          <span className={cx("ml-2 text-xs", overdue ? "text-rose" : "text-ink-3")}>{overdue ? `${diffDays(r.due, today)}d overdue` : "due today"}</span>
          {r.lapses > 1 && <Badge tone="rose" className="ml-2">Forgotten {r.lapses}×</Badge>}
        </button>
        <div className="flex gap-1">
          {GRADES.map(({ g, label: l, tone }) => (
            <button key={g} type="button" onClick={() => onGrade(g)} title={`${l}: next in ${nextInterval(r, g, c).interval} days`} className={cx("h-8 rounded-md border px-2.5 text-xs font-medium", tone)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {open && <ReviewCard r={r} revealed onReveal={() => {}} compact />}
    </li>
  );
}

function ReviewCard({ r, revealed, onReveal, compact }: { r: ReviewItem; revealed: boolean; onReveal: () => void; compact?: boolean }) {
  const data = useData();
  if (!data) return null;
  if (r.kind === "topic") {
    const t = TOPIC_MAP[r.refId];
    const p = data.progress.get(r.refId);
    return (
      <div className={cx(compact ? "mt-2 rounded-md bg-bg-2 p-3" : "mt-3")}>
        {!compact && (
          <>
            <p className="text-xs text-ink-3">{t ? SUBJECT_MAP[t.subjectId].name : ""}</p>
            <h2 className="display mt-1 text-2xl">{t?.name}</h2>
            <p className="mt-2 text-sm text-ink-2">Recall the key definitions, formulas and traps before revealing your notes.</p>
          </>
        )}
        {revealed ? (
          <div className="mt-3 rounded-md border border-line bg-bg-2 p-3 text-[13.5px] whitespace-pre-wrap text-ink">
            {p?.notes || <span className="text-ink-3">No notes yet for this topic. Add formulas and traps on the topic page.</span>}
            {t?.sourceTips?.length ? <p className="mt-2 text-xs text-ink-3">From your PDF: {t.sourceTips.join(" ")}</p> : null}
          </div>
        ) : (
          <Button className="mt-3" icon={<Eye size={15} />} onClick={onReveal}>
            Reveal notes
          </Button>
        )}
        {t && (
          <Link href={`/topics/${t.id}`} className="mt-2 inline-block text-xs text-ink-3 hover:text-ink">
            Open topic page
          </Link>
        )}
      </div>
    );
  }
  const e = data.errors.find((x) => x.id === r.refId);
  if (!e) return <p className="mt-2 text-[13px] text-ink-3">This error was deleted. Grade or remove the card.</p>;
  return (
    <div className={cx(compact ? "mt-2 rounded-md bg-bg-2 p-3" : "mt-3")}>
      {!compact && (
        <>
          <p className="text-xs text-ink-3">
            Type {e.type} · {ERROR_TYPES[e.type].name} · {SUBJECT_MAP[e.subjectId].short}
            {e.topicId ? ` · ${TOPIC_MAP[e.topicId]?.name}` : ""}
          </p>
          <h2 className="display mt-1 text-2xl">{e.questionRef}</h2>
          {e.originalThought && <p className="mt-2 text-sm text-ink-2">You originally thought: {e.originalThought}</p>}
          <p className="mt-1 text-sm text-ink-2">What&apos;s the correct reasoning, and the rule that prevents it next time?</p>
        </>
      )}
      {revealed ? (
        <div className="mt-3 space-y-2 rounded-md border border-line bg-bg-2 p-3 text-[13.5px]">
          {e.whyWrong && (
            <p>
              <span className="text-ink-3">Why it was wrong: </span>
              {e.whyWrong}
            </p>
          )}
          {e.correctReasoning && (
            <p>
              <span className="text-ink-3">Correct reasoning: </span>
              {e.correctReasoning}
            </p>
          )}
          {e.rule && (
            <p className="text-amber">
              <span className="text-ink-3">Rule: </span>
              {e.rule}
            </p>
          )}
        </div>
      ) : (
        <Button className="mt-3" icon={<Eye size={15} />} onClick={onReveal}>
          Reveal answer
        </Button>
      )}
      <p className="mt-2 text-xs text-ink-3">Fix: {ERROR_TYPES[e.type].fix}</p>
    </div>
  );
}
