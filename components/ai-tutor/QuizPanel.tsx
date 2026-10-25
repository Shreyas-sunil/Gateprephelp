"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, EmptyState, Input, Panel, Select, cx } from "@/components/ui";
import { Markdown } from "./Markdown";
import { ErrorDialog, type ErrorDraft } from "@/components/errors/ErrorDialog";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import type { QuizResponse } from "@/lib/ai/schema";
import type { SubjectId } from "@/types";

type Q = QuizResponse["questions"][number];

function isCorrect(q: Q, sel: number[], nat: string): boolean {
  if (q.type === "NAT") {
    const a = Number(String(q.natAnswer ?? "").replace(/[^\d.\-eE]/g, ""));
    const b = Number(nat);
    if (!Number.isFinite(a) || !Number.isFinite(b) || nat.trim() === "") return false;
    return Math.abs(a - b) <= Math.max(0.01, Math.abs(a) * 0.005);
  }
  const want = [...q.correct].sort().join(",");
  return [...sel].sort().join(",") === want;
}

export function QuizPanel({ subjectId, topicId }: { subjectId?: SubjectId; topicId?: string }) {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, { sel: number[]; nat: string }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDraft, setErrDraft] = useState<ErrorDraft | null>(null);

  const generate = async () => {
    if (!subjectId) {
      setErr("Pick a subject (and ideally a topic) first.");
      return;
    }
    setLoading(true);
    setErr(null);
    setSubmitted(false);
    setAnswers({});
    try {
      const notes = topicId ? data?.progress.get(topicId)?.notes?.slice(0, 2000) : undefined;
      const res = await fetch("/api/tutor/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectName: SUBJECT_MAP[subjectId].name, topicName: topicId ? TOPIC_MAP[topicId]?.name : undefined, count, difficulty, ...(notes ? { notes } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? `Request failed (${res.status})`);
      setQuiz(j.questions as Q[]);
    } catch (e) {
      setErr((e as Error).message);
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  };

  const score = quiz ? quiz.filter((q, i) => isCorrect(q, answers[i]?.sel ?? [], answers[i]?.nat ?? "")).length : 0;

  return (
    <div className="space-y-4 pb-6">
      <Panel className="flex flex-wrap items-end gap-3 p-3">
        <div className="text-[13px] text-ink-2">
          {subjectId ? (
            <>
              Quiz on <b className="text-ink">{topicId ? TOPIC_MAP[topicId]?.name : SUBJECT_MAP[subjectId].name}</b>
            </>
          ) : (
            "Pick a subject above"
          )}
        </div>
        <Select aria-label="Number of questions" value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-36">
          {[3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} questions
            </option>
          ))}
        </Select>
        <Select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="w-32">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
        <Button variant="primary" icon={<Sparkles size={14} />} onClick={generate} disabled={loading}>
          {loading ? "Generating…" : quiz ? "New quiz" : "Generate quiz"}
        </Button>
      </Panel>
      {err && <p className="rounded-md border border-rose/40 bg-rose-soft px-3 py-2 text-[13px] text-rose">{err}</p>}
      {!quiz && !loading && !err && <EmptyState title="Original practice questions, generated on demand" body="Questions are AI-generated (not real PYQs) and checked for internal consistency. Verify anything surprising." />}
      {quiz?.map((q, i) => {
        const a = answers[i] ?? { sel: [], nat: "" };
        const ok = submitted && isCorrect(q, a.sel, a.nat);
        return (
          <Panel key={i} className={cx("p-4", submitted && (ok ? "border-mint/40" : "border-rose/40"))}>
            <div className="mb-2 flex items-center gap-2">
              <span className="num text-xs text-ink-3">Q{i + 1}</span>
              <Badge>{q.type}</Badge>
              {submitted && <Badge tone={ok ? "mint" : "rose"}>{ok ? "Correct" : "Incorrect"}</Badge>}
            </div>
            <Markdown text={q.question} />
            {q.type === "NAT" ? (
              <Input aria-label={`Answer for question ${i + 1}`} className="mt-3 max-w-xs" disabled={submitted} value={a.nat} onChange={(e) => setAnswers({ ...answers, [i]: { ...a, nat: e.target.value } })} placeholder="Numeric answer" />
            ) : (
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o, j) => {
                  const chosen = a.sel.includes(j);
                  const right = q.correct.includes(j);
                  return (
                    <li key={j}>
                      <button
                        type="button"
                        disabled={submitted}
                        aria-pressed={chosen}
                        onClick={() => setAnswers({ ...answers, [i]: { ...a, sel: q.type === "MCQ" ? [j] : chosen ? a.sel.filter((x) => x !== j) : [...a.sel, j] } })}
                        className={cx(
                          "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-[13.5px]",
                          submitted ? (right ? "border-mint/50 bg-mint-soft" : chosen ? "border-rose/50 bg-rose-soft" : "border-line") : chosen ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong",
                        )}
                      >
                        <span className="num mt-0.5 text-xs text-ink-3">{String.fromCharCode(65 + j)}</span>
                        <span className="min-w-0 flex-1">
                          <Markdown text={o} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {submitted && (
              <div className="mt-3 rounded-md bg-bg-2 p-3">
                {q.type === "NAT" && <p className="mb-1 text-[13px]">Answer: {q.natAnswer}</p>}
                <Markdown text={q.explanation} />
                {!ok && subjectId && (
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => setErrDraft({ date: today, source: "practice", subjectId, topicId, questionRef: `AI quiz: ${q.question.slice(0, 60)}`, correctReasoning: q.explanation.slice(0, 1000) })}>
                    Log to error notebook
                  </Button>
                )}
              </div>
            )}
          </Panel>
        );
      })}
      {quiz && (
        <div className="flex items-center justify-between">
          {submitted ? (
            <p className="text-sm">
              Score: <b className="num">{score}/{quiz.length}</b> <span className="text-ink-3">(practice only — not logged as PYQs)</span>
            </p>
          ) : (
            <span />
          )}
          {!submitted ? (
            <Button
              variant="primary"
              onClick={() => {
                setSubmitted(true);
                toast({ tone: "info", title: "Quiz checked" });
              }}
            >
              Check answers
            </Button>
          ) : (
            <Button onClick={generate}>Another quiz</Button>
          )}
        </div>
      )}
      <ErrorDialog open={!!errDraft} initial={errDraft} onClose={() => setErrDraft(null)} />
    </div>
  );
}
