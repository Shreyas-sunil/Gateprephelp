"use client";

import { useState } from "react";
import { Pause, Play, Square, SkipForward, Timer } from "lucide-react";
import { useTimer, useToast, useData } from "@/components/providers";
import { Button, Segmented, Textarea, cx } from "@/components/ui";
import { SubjectSelect, TopicSelect } from "@/components/pickers";
import { subjectName, topicName } from "@/data/syllabus";

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function FocusTimer({ compact = false }: { compact?: boolean }) {
  const t = useTimer();
  const toast = useToast();
  const data = useData();
  const [showNotes, setShowNotes] = useState(false);
  const { state } = t;
  const isBreak = state.phase !== "focus";
  const display = t.targetMs !== null ? Math.max(0, t.targetMs - t.elapsedMs) : t.elapsedMs;
  const progress = t.targetMs ? Math.min(1, t.elapsedMs / t.targetMs) : 0;
  const pom = data?.settings.pomodoro;

  const stop = async () => {
    const m = await t.stop(true);
    if (m > 0) toast({ tone: "success", title: `Session saved: ${m} min`, body: state.topicId ? topicName(state.topicId) : state.subjectId ? subjectName(state.subjectId) : "Unassigned study time" });
    else toast({ tone: "info", title: "Session under a minute — not saved" });
    setShowNotes(false);
  };

  return (
    <div className={cx("rounded-lg border border-line bg-surface/80", compact ? "p-3.5" : "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <Timer size={15} className={state.status === "running" && !isBreak ? "text-cyan" : "text-ink-3"} />
          {state.status === "idle" ? "Focus timer" : isBreak ? (state.phase === "long" ? "Long break" : "Short break") : "Focusing"}
          {state.kind === "pomodoro" && state.status !== "idle" && <span className="text-ink-3">· block {state.cycle + (isBreak ? 0 : 1)}</span>}
        </div>
        {state.status === "idle" && (
          <Segmented
            size="sm"
            label="Timer mode"
            value={state.kind}
            onChange={(k) => t.setContext({ kind: k })}
            options={[
              { value: "pomodoro", label: "Pomodoro" },
              { value: "stopwatch", label: "Stopwatch" },
            ]}
          />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div aria-live="off" className={cx("num font-semibold tracking-tight", compact ? "text-[34px] leading-none" : "text-5xl", isBreak ? "text-amber" : state.status === "running" ? "text-cyan" : "text-ink")}>
          {state.status === "idle" && state.kind === "pomodoro" && pom ? fmt(pom.focus * 60_000) : fmt(display)}
        </div>
        <div className="flex gap-1.5">
          {state.status === "idle" && (
            <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={() => t.start({})}>
              Start
            </Button>
          )}
          {state.status === "running" && (
            <Button size="sm" icon={<Pause size={14} />} onClick={t.pause}>
              Pause
            </Button>
          )}
          {state.status === "paused" && (
            <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={state.phase === "focus" && state.accumulatedMs === 0 ? () => t.start({}) : t.resume}>
              {state.accumulatedMs === 0 ? "Start" : "Resume"}
            </Button>
          )}
          {isBreak && state.status === "running" && (
            <Button size="sm" variant="ghost" icon={<SkipForward size={14} />} onClick={t.skipBreak}>
              Skip
            </Button>
          )}
          {state.status !== "idle" && (
            <Button size="sm" variant="ghost" icon={<Square size={13} />} onClick={stop} title="Stop and save the focus time">
              Stop
            </Button>
          )}
        </div>
      </div>
      {t.targetMs !== null && state.status !== "idle" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: isBreak ? "var(--amber)" : "var(--cyan)" }} />
        </div>
      )}

      <div className={cx("mt-3 grid gap-2", compact ? "" : "sm:grid-cols-2")}>
        <SubjectSelect ariaLabel="Timer subject" value={state.subjectId} emptyLabel="No subject" onChange={(s) => t.setContext({ subjectId: s, topicId: undefined })} />
        <TopicSelect ariaLabel="Timer topic" subjectId={state.subjectId} value={state.topicId} onChange={(id) => t.setContext({ topicId: id })} />
      </div>
      {state.status !== "idle" && (
        <div className="mt-2">
          {showNotes ? (
            <Textarea aria-label="Session notes" placeholder="What did you work on? Anything to revisit?" value={state.notes ?? ""} onChange={(e) => t.setContext({ notes: e.target.value })} className="min-h-[60px] text-[13px]" />
          ) : (
            <button type="button" className="text-xs text-ink-3 hover:text-ink-2" onClick={() => setShowNotes(true)}>
              + Add session notes
            </button>
          )}
        </div>
      )}
      {!compact && pom && (
        <p className="mt-3 text-xs text-ink-3">
          Pomodoro: {pom.focus} min focus · {pom.short} min short break · {pom.long} min long break every {pom.cyclesBeforeLong} blocks. Change in Settings. Only focus time is saved as study time.
        </p>
      )}
    </div>
  );
}
