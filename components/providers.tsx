"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useAppData } from "@/lib/hooks";
import { logSession } from "@/lib/actions";
import { toISTDate } from "@/lib/date";
import type { AppData, Settings, SubjectId } from "@/types";
import { cx } from "./ui";

// ------------------------------------------------------------------ Data context (one live query for the whole app)

const DataCtx = createContext<AppData | undefined>(undefined);
export function useData() {
  return useContext(DataCtx);
}

// ------------------------------------------------------------------ Toasts

type ToastTone = "success" | "info" | "error";
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export function useToast() {
  return useContext(ToastCtx);
}

// ------------------------------------------------------------------ Timer

export type TimerKind = "stopwatch" | "pomodoro";
export type TimerPhase = "focus" | "short" | "long";

export interface TimerState {
  status: "idle" | "running" | "paused";
  kind: TimerKind;
  phase: TimerPhase;
  runningSince: number;
  accumulatedMs: number;
  segmentStart: number;
  cycle: number;
  subjectId?: SubjectId;
  topicId?: string;
  taskId?: string;
  notes?: string;
}

const TIMER_KEY = "gatecat.timer.v1";
const idleTimer: TimerState = { status: "idle", kind: "pomodoro", phase: "focus", runningSince: 0, accumulatedMs: 0, segmentStart: 0, cycle: 0 };

interface TimerApi {
  state: TimerState;
  elapsedMs: number;
  targetMs: number | null;
  start: (opts?: Partial<Pick<TimerState, "kind" | "subjectId" | "topicId" | "taskId">>) => void;
  pause: () => void;
  resume: () => void;
  stop: (save: boolean) => Promise<number>;
  skipBreak: () => void;
  setContext: (p: Partial<Pick<TimerState, "subjectId" | "topicId" | "taskId" | "notes" | "kind">>) => void;
}

const TimerCtx = createContext<TimerApi | null>(null);
export function useTimer(): TimerApi {
  const t = useContext(TimerCtx);
  if (!t) throw new Error("useTimer outside provider");
  return t;
}

function readTimer(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return idleTimer;
    const parsed = JSON.parse(raw) as TimerState;
    return { ...idleTimer, ...parsed };
  } catch {
    return idleTimer;
  }
}

function TimerProvider({ settings, children, toast }: { settings: Settings | undefined; children: ReactNode; toast: (t: Omit<Toast, "id">) => void }) {
  const [state, setState] = useState<TimerState>(idleTimer);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const hydrated = useRef(false);

  useEffect(() => {
    // localStorage is only readable after mount; reading it during render would break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readTimer());
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);
  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const pom = settings?.pomodoro ?? { focus: 50, short: 10, long: 25, cyclesBeforeLong: 3 };
  const elapsedMs = state.accumulatedMs + (state.status === "running" ? Math.max(0, now - state.runningSince) : 0);
  const targetMs = state.kind === "pomodoro" ? (state.phase === "focus" ? pom.focus : state.phase === "short" ? pom.short : pom.long) * 60_000 : null;

  const saveFocus = useCallback(async (s: TimerState, endMs: number): Promise<number> => {
    const ms = s.accumulatedMs + (s.status === "running" ? endMs - s.runningSince : 0);
    const minutes = Math.round(ms / 60_000);
    if (s.phase !== "focus" || minutes < 1) return 0;
    await logSession({
      start: s.segmentStart,
      end: endMs,
      minutes,
      date: toISTDate(s.segmentStart),
      subjectId: s.subjectId,
      topicId: s.topicId,
      taskId: s.taskId,
      mode: s.kind === "pomodoro" ? "pomodoro" : "focus",
      notes: s.notes,
    });
    return minutes;
  }, []);

  // Pomodoro phase transitions
  useEffect(() => {
    if (state.status !== "running" || targetMs === null || elapsedMs < targetMs) return;
    const s = stateRef.current;
    const t = Date.now();
    if (s.phase === "focus") {
      void saveFocus(s, t).then((m) => toast({ tone: "success", title: `Focus block saved: ${m} min`, body: "Break time. Stand up, drink water." }));
      const cycle = s.cycle + 1;
      const phase: TimerPhase = cycle % Math.max(1, pom.cyclesBeforeLong) === 0 ? "long" : "short";
      setState({ ...s, phase, cycle, runningSince: t, accumulatedMs: 0, segmentStart: t, notes: undefined });
    } else {
      toast({ tone: "info", title: "Break's over", body: "Start the next focus block when you're ready." });
      setState({ ...s, status: "paused", phase: "focus", runningSince: t, accumulatedMs: 0, segmentStart: t });
    }
  }, [elapsedMs, targetMs, state.status, pom.cyclesBeforeLong, saveFocus, toast]);

  const api: TimerApi = {
    state,
    elapsedMs,
    targetMs,
    start: (opts) => {
      const t = Date.now();
      setNow(t);
      setState((s) => ({ ...s, ...opts, status: "running", phase: "focus", runningSince: t, accumulatedMs: 0, segmentStart: t, cycle: s.status === "idle" ? 0 : s.cycle }));
    },
    pause: () =>
      setState((s) => (s.status !== "running" ? s : { ...s, status: "paused", accumulatedMs: s.accumulatedMs + (Date.now() - s.runningSince) })),
    resume: () => {
      const t = Date.now();
      setNow(t);
      setState((s) => (s.status !== "paused" ? s : { ...s, status: "running", runningSince: t, segmentStart: s.accumulatedMs === 0 ? t : s.segmentStart }));
    },
    stop: async (save) => {
      const s = stateRef.current;
      const minutes = save ? await saveFocus(s, Date.now()) : 0;
      setState({ ...idleTimer, kind: s.kind, subjectId: s.subjectId, topicId: s.topicId });
      return minutes;
    },
    skipBreak: () => {
      const t = Date.now();
      setState((s) => ({ ...s, status: "running", phase: "focus", runningSince: t, accumulatedMs: 0, segmentStart: t }));
    },
    setContext: (p) => setState((s) => ({ ...s, ...p })),
  };

  return <TimerCtx.Provider value={api}>{children}</TimerCtx.Provider>;
}

// ------------------------------------------------------------------ Root

export function Providers({ children }: { children: ReactNode }) {
  const data = useAppData();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const toastsEnabled = data?.settings.toasts ?? true;
  const quiet = data?.settings.quietMode ?? false;

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      if ((!toastsEnabled || quiet) && t.tone !== "error") return;
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.action ? 6000 : 3800);
    },
    [toastsEnabled, quiet],
  );

  const theme = data?.settings.theme ?? "midnight";
  const motionPref = data?.settings.motion ?? "system";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motionPref;
    try {
      localStorage.setItem("gatecat.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme, motionPref]);

  const reduced = motionPref === "reduced" ? "always" : motionPref === "full" ? "never" : "user";

  return (
    <MotionConfig reducedMotion={reduced}>
      <DataCtx.Provider value={data}>
        <ToastCtx.Provider value={push}>
          <TimerProvider settings={data?.settings} toast={push}>
            {children}
          </TimerProvider>
          <ToastViewport toasts={toasts} dismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
        </ToastCtx.Provider>
      </DataCtx.Provider>
    </MotionConfig>
  );
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-end gap-2 lg:bottom-5 lg:right-5 lg:left-auto">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.15 } }}
            className={cx(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-surface-2 px-3.5 py-3 shadow-xl",
              t.tone === "error" ? "border-rose/40" : "border-line-strong",
            )}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <span className="mt-0.5 shrink-0">
              {t.tone === "success" ? <CheckCircle2 size={16} className="text-mint" /> : t.tone === "error" ? <TriangleAlert size={16} className="text-rose" /> : <Info size={16} className="text-cyan" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-ink-2">{t.body}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-[13px] font-medium text-violet-2 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
