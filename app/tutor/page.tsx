"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Globe, KeyRound, RefreshCw, SendHorizontal, Square, Trash2, Wand2 } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Button, Checkbox, ConfirmDialog, IconButton, PageSkeleton, Panel, Segmented, Select, Textarea, cx } from "@/components/ui";
import { SubjectSelect, TopicSelect } from "@/components/pickers";
import { Markdown } from "@/components/ai-tutor/Markdown";
import { QuizPanel } from "@/components/ai-tutor/QuizPanel";
import { Cat } from "@/components/cat/Cat";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/defaults";
import { splitFollowups } from "@/lib/ai/prompt";
import type { TutorContext, TutorDepth, TutorMode } from "@/lib/ai/schema";
import { SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import { STATUS_LABEL } from "@/lib/calc/progress";
import type { ChatMessage, SubjectId } from "@/types";

const MODES: { value: TutorMode; label: string }[] = [
  { value: "explain", label: "Explain from first principles" },
  { value: "eli5", label: "Explain simply (ELI5)" },
  { value: "exam", label: "Formal, exam-level" },
  { value: "steps", label: "Step-by-step solution" },
  { value: "code", label: "Code / algorithm dry run" },
  { value: "pyq", label: "Discuss a PYQ" },
  { value: "mistake", label: "Explain my mistake" },
  { value: "quiz", label: "Quiz me (chat)" },
  { value: "flashcards", label: "Make flashcards" },
  { value: "summary", label: "Revision summary" },
  { value: "plan", label: "Adjust my study plan" },
];

const STARTERS = [
  { mode: "steps" as TutorMode, text: "A 4-way set-associative cache has 64 KB capacity, 32-byte blocks and 32-bit addresses. Find tag, index and offset bits." },
  { mode: "code" as TutorMode, text: "Dry-run this and give the output:\n```c\nint a[] = {1,2,3,4};\nint *p = a;\nprintf(\"%d\", *p++ + *++p);\n```" },
  { mode: "explain" as TutorMode, text: "Why does Peterson's solution satisfy bounded waiting? Explain it three different ways." },
  { mode: "steps" as TutorMode, text: "Find the candidate keys of R(A,B,C,D,E) with FDs A→B, BC→D, D→A, E→C, and its highest normal form." },
  { mode: "exam" as TutorMode, text: "Closure properties of regular vs context-free languages — give the full table with one counterexample per 'not closed'." },
  { mode: "steps" as TutorMode, text: "Split 192.168.10.0/24 into subnets for 100, 50 and 20 hosts using CIDR. Show each subnet's range." },
];

const THREAD_ID = "main";

function normalizeMath(s: string): string {
  return s.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

function parseReply(raw: string): { body: string; followups: string[]; sources: { title: string; uri: string }[]; error?: string } {
  let text = raw;
  let sources: { title: string; uri: string }[] = [];
  let error: string | undefined;
  const sm = text.match(/<sources>([\s\S]*?)<\/sources>/);
  if (sm) {
    try {
      sources = (JSON.parse(sm[1]!) as { title: string; uri: string }[]).filter((x) => /^https?:\/\//.test(x.uri));
    } catch {
      /* ignore */
    }
    text = text.replace(sm[0], "");
  }
  const em = text.match(/<error>([\s\S]*?)<\/error>/);
  if (em) {
    error = em[1];
    text = text.replace(em[0], "");
  }
  const { body, followups } = splitFollowups(text.trimEnd());
  return { body: normalizeMath(body), followups, sources, error };
}

function TutorInner() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const toast = useToast();
  const params = useSearchParams();
  const presetTopic = params.get("topic") ?? undefined;
  const presetError = params.get("error") ?? undefined;
  const thread = useLiveQuery(() => getDb().chats.get(THREAD_ID), []);
  const [status, setStatus] = useState<{ configured: boolean; model?: string } | null>(null);
  const [tab, setTab] = useState<"chat" | "quiz">("chat");
  const [subjectId, setSubjectId] = useState<SubjectId | undefined>(presetTopic ? TOPIC_MAP[presetTopic]?.subjectId : undefined);
  const [topicId, setTopicId] = useState<string | undefined>(presetTopic);
  const [mode, setMode] = useState<TutorMode>("explain");
  const [depth, setDepth] = useState<TutorDepth>("standard");
  const [shareContext, setShareContext] = useState(true);
  const [useSearch, setUseSearch] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => thread?.messages ?? [], [thread]);

  useEffect(() => {
    fetch("/api/tutor/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!presetError || !data) return;
    const e = data.errors.find((x) => x.id === presetError);
    if (!e) return;
    // One-time prefill once the notebook entry has loaded from IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("mistake");
    setSubjectId(e.subjectId);
    setTopicId(e.topicId);
    setInput(`Question: ${e.questionRef}\nWhat I thought: ${e.originalThought || "—"}\nWhy it was wrong (my guess): ${e.whyWrong || "—"}\nCorrect answer/reasoning I have: ${e.correctReasoning || "—"}`);
  }, [presetError, data]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming]);

  const context: TutorContext | undefined = useMemo(() => {
    if (!shareContext || !data || !a) return undefined;
    const c: TutorContext = {};
    if (subjectId) c.subjectName = SUBJECT_MAP[subjectId].name;
    if (topicId) {
      const st = a.topicStats.get(topicId);
      c.topicName = TOPIC_MAP[topicId]?.name;
      if (st) {
        c.status = STATUS_LABEL[st.progress.status];
        if (st.progress.confidence) c.confidence = st.progress.confidence;
        c.attempted = st.attempted;
        c.accuracy = st.accuracy;
        if (st.progress.notes) c.notes = st.progress.notes.slice(0, 4000);
      }
      const errs = data.errors.filter((e) => e.topicId === topicId).slice(-5);
      if (errs.length) c.recentErrors = errs.map((e) => ({ type: e.type, ref: e.questionRef.slice(0, 160), whyWrong: e.whyWrong.slice(0, 600) || undefined, rule: e.rule.slice(0, 400) || undefined }));
    }
    if (mode === "plan") {
      const lines = [
        `Days to exam: ${a.daysToExam}`,
        `Coverage ${Math.round(a.overall.completionPct)}% (${a.overall.covered}/${a.overall.total} topics), ${a.overall.mastered} mastered`,
        `PYQs: ${a.pyq.attempted} attempted, accuracy ${a.pyq.accuracy === null ? "n/a" : Math.round(a.pyq.accuracy) + "%"}`,
        `This week: ${Math.round(a.weekMinutes / 60)}h studied of ${Math.round(a.weekPlannedMinutes / 60)}h planned; goal ${data.settings.weeklyHourGoal}h`,
        `Revisions due: ${a.reviews.overdue.length} overdue, ${a.reviews.today.length} today; open errors: ${a.openErrors}`,
        ...a.subjectStats.map((s) => `${SUBJECT_MAP[s.subjectId].short}: coverage ${Math.round(s.completionPct)}%, accuracy ${s.accuracy === null ? "n/a" : Math.round(s.accuracy) + "%"} (n=${s.attempted})`),
      ];
      c.progressSummary = lines.join("\n").slice(0, 3000);
    }
    return Object.keys(c).length ? c : undefined;
  }, [shareContext, data, a, subjectId, topicId, mode]);

  const saveMessages = useCallback(async (msgs: ChatMessage[]) => {
    await getDb().chats.put({ id: THREAD_ID, messages: msgs.slice(-60), updatedAt: Date.now() });
  }, []);

  const send = async (text: string, history: ChatMessage[]) => {
    const content = text.trim();
    if (!content || streaming !== null) return;
    const userMsg: ChatMessage = { id: uid("m"), role: "user", content, createdAt: Date.now() };
    const convo = [...history, userMsg];
    await saveMessages(convo);
    setInput("");
    setStreaming("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ messages: convo.filter((m) => !m.error).slice(-20).map((m) => ({ role: m.role, content: m.role === "model" ? parseReply(m.content).body.slice(0, 12000) : m.content.slice(0, 12000) })), mode, depth, useSearch, context }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ message: `Request failed (${res.status}).` }));
        if (res.status === 503) setStatus({ configured: false });
        await saveMessages([...convo, { id: uid("m"), role: "model", content: j.message ?? "Request failed.", createdAt: Date.now(), error: true }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setStreaming(acc);
      }
      const parsed = parseReply(acc);
      await saveMessages([...convo, { id: uid("m"), role: "model", content: acc, createdAt: Date.now(), sources: parsed.sources, error: !!parsed.error && !parsed.body }]);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (acc) await saveMessages([...convo, { id: uid("m"), role: "model", content: acc + "\n\n*(stopped)*", createdAt: Date.now() }]);
      } else {
        await saveMessages([...convo, { id: uid("m"), role: "model", content: "Couldn't reach the tutor. Check your connection and try again.", createdAt: Date.now(), error: true }]);
      }
    } finally {
      setStreaming(null);
      abortRef.current = null;
    }
  };

  const regenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    await send(lastUser.content, messages.slice(0, idx));
  };

  if (!data || !a || status === null) return <PageSkeleton />;
  const cat = data.settings.cat;
  const lastModel = [...messages].reverse().find((m) => m.role === "model");
  const lastParsed = lastModel ? parseReply(lastModel.content) : null;

  if (!status.configured) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <Cat mood="sleeping" fur={cat.fur} accessory={cat.accessory} size={72} />
            <div>
              <h1 className="display text-2xl">The AI tutor needs a key</h1>
              <p className="text-[13.5px] text-ink-2">Everything else in GATE CAT works without it. The key stays on the server — never in the browser.</p>
            </div>
          </div>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-[13.5px] text-ink-2">
            <li>
              Create a Gemini API key in{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                Google AI Studio
              </a>
              .
            </li>
            <li>
              Local: create <code className="rounded bg-surface-3 px-1 font-mono text-xs">.env.local</code> in the project root with <code className="rounded bg-surface-3 px-1 font-mono text-xs">GEMINI_API_KEY=your-key</code>, then restart <code className="rounded bg-surface-3 px-1 font-mono text-xs">npm run dev</code>.
            </li>
            <li>Vercel: Project → Settings → Environment Variables → add GEMINI_API_KEY (no NEXT_PUBLIC_ prefix) → redeploy.</li>
          </ol>
          <div className="mt-5 flex gap-2">
            <Button
              variant="primary"
              icon={<RefreshCw size={14} />}
              onClick={() =>
                fetch("/api/tutor/status")
                  .then((r) => r.json())
                  .then(setStatus)
              }
            >
              Check again
            </Button>
            <Link href="/">
              <Button>Back to Mission Control</Button>
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-160px)] flex-col lg:min-h-[calc(100dvh-56px)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="display text-[26px] leading-tight">AI tutor</h1>
          <Badge tone="mint" title="Model configured on the server">
            <KeyRound size={11} /> {status.model}
          </Badge>
        </div>
        <Segmented label="Tutor mode" value={tab} onChange={setTab} options={[{ value: "chat", label: "Chat" }, { value: "quiz", label: "Quiz me" }]} />
      </div>

      <Panel className="mb-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SubjectSelect ariaLabel="Subject" value={subjectId} onChange={(s) => { setSubjectId(s); setTopicId(undefined); }} emptyLabel="Any subject" />
          <TopicSelect ariaLabel="Topic" subjectId={subjectId} value={topicId} onChange={setTopicId} emptyLabel="Any topic" />
          {tab === "chat" && (
            <>
              <Select aria-label="Explanation style" value={mode} onChange={(e) => setMode(e.target.value as TutorMode)}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Depth" value={depth} onChange={(e) => setDepth(e.target.value as TutorDepth)}>
                <option value="intro">Depth: brief</option>
                <option value="standard">Depth: standard</option>
                <option value="deep">Depth: deep</option>
              </Select>
            </>
          )}
        </div>
        {tab === "chat" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
            <Checkbox label="Share my tracker context for this topic" checked={shareContext} onChange={setShareContext} />
            <Checkbox label={<span className="inline-flex items-center gap-1"><Globe size={12} /> Ground with Google Search (cites sources)</span>} checked={useSearch} onChange={setUseSearch} />
            {context && (
              <details className="text-ink-3">
                <summary className="cursor-pointer">What gets sent</summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-bg-2 p-2 text-[11px] whitespace-pre-wrap">{JSON.stringify(context, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </Panel>

      {tab === "quiz" ? (
        <QuizPanel subjectId={subjectId} topicId={topicId} />
      ) : (
        <>
          <div className="flex-1 space-y-4 pb-4" aria-live="polite">
            {messages.length === 0 && streaming === null && (
              <div className="py-6 text-center">
                <Cat mood="curious" fur={cat.fur} accessory={cat.accessory} size={84} className="mx-auto" />
                <p className="mt-2 text-sm text-ink-2">Ask anything from the GATE CS syllabus. Try one of these:</p>
                <div className="mx-auto mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      onClick={() => {
                        setMode(s.mode);
                        setInput(s.text);
                      }}
                      className="rounded-md border border-line bg-surface/70 p-3 text-left text-[13px] text-ink-2 hover:border-line-strong hover:text-ink"
                    >
                      {s.text.split("\n")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} copied={copied === m.id} onCopy={async () => {
                await navigator.clipboard.writeText(m.role === "model" ? parseReply(m.content).body : m.content);
                setCopied(m.id);
                setTimeout(() => setCopied(null), 1500);
              }} />
            ))}
            {streaming !== null && (
              <div className="rounded-lg border border-line bg-surface/80 p-4">
                {streaming ? <Markdown text={parseReply(streaming).body} /> : <p className="text-[13px] text-ink-3">Thinking…</p>}
              </div>
            )}
            {streaming === null && lastParsed && lastParsed.followups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {lastParsed.followups.map((f) => (
                  <button key={f} type="button" onClick={() => send(f, messages)} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:border-violet hover:text-ink">
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-16 z-10 lg:bottom-3">
            <Panel className="bg-surface p-2.5 shadow-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input, messages);
                }}
              >
                <Textarea
                  aria-label="Message the tutor"
                  placeholder={mode === "mistake" ? "Paste the question, your answer and your reasoning…" : "Ask a question, paste a problem or code…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(input, messages);
                    }
                  }}
                  className="min-h-[64px] border-0 bg-transparent focus:ring-0"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <IconButton label="Regenerate last answer" onClick={regenerate} disabled={streaming !== null || !messages.some((m) => m.role === "user")}>
                      <RefreshCw size={15} />
                    </IconButton>
                    <IconButton label="Clear conversation" onClick={() => setConfirmClear(true)} disabled={streaming !== null || messages.length === 0}>
                      <Trash2 size={15} />
                    </IconButton>
                    <Link href="/errors" className="hidden text-xs text-ink-3 hover:text-ink sm:inline">
                      <Wand2 size={12} className="mr-1 inline" />
                      Explain an error from my notebook
                    </Link>
                  </div>
                  {streaming !== null ? (
                    <Button variant="secondary" icon={<Square size={13} />} onClick={() => abortRef.current?.abort()}>
                      Stop
                    </Button>
                  ) : (
                    <Button variant="primary" type="submit" icon={<SendHorizontal size={15} />} disabled={!input.trim()}>
                      Send
                    </Button>
                  )}
                </div>
              </form>
            </Panel>
            <p className="mt-1.5 text-center text-[11px] text-ink-3">AI can be wrong. Verify answers against official papers and standard texts before you rely on them.</p>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the conversation?"
        body="This deletes the chat history stored in this browser."
        confirmLabel="Clear conversation"
        onConfirm={async () => {
          await getDb().chats.delete(THREAD_ID);
          toast({ tone: "info", title: "Conversation cleared" });
        }}
      />
    </div>
  );
}

function MessageBubble({ m, onCopy, copied }: { m: ChatMessage; onCopy: () => void; copied: boolean }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-violet-soft px-4 py-2.5 text-[14px] whitespace-pre-wrap text-ink">{m.content}</div>
      </div>
    );
  }
  const p = parseReply(m.content);
  return (
    <div className={cx("group rounded-lg border bg-surface/80 p-4", m.error || p.error ? "border-rose/40" : "border-line")}>
      {m.error ? <p className="text-[13.5px] text-rose">{m.content}</p> : <Markdown text={p.body} />}
      {p.error && <p className="mt-2 text-[13px] text-rose">{p.error}</p>}
      {p.sources.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="text-xs text-ink-3">Search sources returned for this answer</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {p.sources.map((s) => (
              <li key={s.uri}>
                <a href={s.uri} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!m.error && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onCopy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-3 hover:text-ink" aria-label="Copy answer">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TutorInner />
    </Suspense>
  );
}
