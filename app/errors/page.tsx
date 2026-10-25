"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarPlus, CheckCheck, Download, Play, Plus } from "lucide-react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Button, EmptyState, PageHeader, PageSkeleton, Panel, PanelHeader, Select, cx } from "@/components/ui";
import { SubjectSelect } from "@/components/pickers";
import { ChartBox, tooltipProps } from "@/components/charts/chart-kit";
import { ErrorDialog, type ErrorDraft } from "@/components/errors/ErrorDialog";
import { addTask, gradeReview, updateError } from "@/lib/actions";
import { errorDistribution, pareto } from "@/lib/calc/errors";
import { toCsv } from "@/lib/io";
import { downloadText } from "@/lib/download";
import { ERROR_TYPES } from "@/data/plan";
import { TOPIC_MAP, subjectName, topicName } from "@/data/syllabus";
import { addDays, fmtDate } from "@/lib/date";
import type { ErrorEntry, ErrorType, SubjectId } from "@/types";

const TONE: Record<ErrorType, "violet" | "amber" | "cyan"> = { A: "violet", B: "amber", C: "cyan" };

function ErrorsInner() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<ErrorDraft | null>(null);
  const [fSubject, setFSubject] = useState<SubjectId | undefined>(params.get("topic") ? TOPIC_MAP[params.get("topic")!]?.subjectId : undefined);
  const [fTopic, setFTopic] = useState<string | undefined>(params.get("topic") ?? undefined);
  const [fType, setFType] = useState<ErrorType | "">("");
  const [fStatus, setFStatus] = useState<"" | "open" | "resolved">("open");
  const [reviewIdx, setReviewIdx] = useState<number | null>(params.get("review") === "1" ? 0 : null);

  const list = useMemo(() => {
    if (!data) return [];
    return data.errors
      .filter((e) => (!fSubject || e.subjectId === fSubject) && (!fTopic || e.topicId === fTopic) && (!fType || e.type === fType) && (!fStatus || e.status === fStatus))
      .sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt);
  }, [data, fSubject, fTopic, fType, fStatus]);

  if (!data || !a) return <PageSkeleton />;
  const dist = errorDistribution(data.errors.filter((e) => !fSubject || e.subjectId === fSubject));
  const par = pareto(data.errors, (e) => e.topicId);
  const due = data.errors.filter((e) => e.status === "open" && (!e.reviewDate || e.reviewDate <= today));
  const current = reviewIdx !== null ? due[reviewIdx] : undefined;
  const reviewItem = current ? data.reviews.find((r) => r.kind === "error" && r.refId === current.id) : undefined;

  const advance = () => {
    if (reviewIdx === null) return;
    if (reviewIdx + 1 >= due.length) {
      setReviewIdx(null);
      toast({ tone: "success", title: "Error review complete" });
    }
  };

  const toTask = async (e: ErrorEntry) => {
    await addTask({ date: today, title: `Fix: ${e.questionRef}${e.topicId ? ` (${topicName(e.topicId)})` : ""}`, subjectId: e.subjectId, topicId: e.topicId, plannedMin: e.type === "A" ? 30 : 20, source: "error", block: 3, notes: e.correctiveAction || ERROR_TYPES[e.type].fix });
    toast({ tone: "success", title: "Revision task added to today", action: { label: "Open planner", onClick: () => router.push("/planner") } });
  };

  return (
    <div>
      <PageHeader
        title="Error notebook"
        description="Every mistake classified with your PDF's matrix — A conceptual, B silly/calculation, C misread — so it stops recurring."
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Download size={14} />} disabled={!data.errors.length} onClick={() => downloadText(`gate-cat-errors-${today}.csv`, toCsv(data.errors as unknown as Record<string, unknown>[]), "text/csv")}>
              Export CSV
            </Button>
            {due.length > 0 && reviewIdx === null && (
              <Button size="sm" icon={<Play size={14} />} onClick={() => setReviewIdx(0)}>
                Daily review ({due.length})
              </Button>
            )}
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setDialog({ date: today, source: "practice", subjectId: fSubject, topicId: fTopic })}>
              Log error
            </Button>
          </>
        }
      />

      {a.warnings.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {a.warnings.slice(0, 3).map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-rose/40 bg-rose-soft px-3 py-2 text-[13px] text-rose">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                Recurring:{" "}
                {w.topicId ? (
                  <>
                    <b>{topicName(w.topicId)}</b> has {w.count} logged occurrences in 30 days{w.type ? `, mostly Type ${w.type} (${ERROR_TYPES[w.type].name.toLowerCase()}) — ${ERROR_TYPES[w.type].fix.toLowerCase()}` : ""}.
                  </>
                ) : (
                  <>
                    Type {w.type} errors ({ERROR_TYPES[w.type!].name.toLowerCase()}) appeared {w.count} times in 30 days. {ERROR_TYPES[w.type!].fix}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {current && (
        <Panel className="mb-5 border-violet/40 p-5">
          <div className="flex justify-between text-xs text-ink-3">
            <span>
              Review {reviewIdx! + 1} of {due.length}
            </span>
            <button type="button" className="hover:text-ink" onClick={() => setReviewIdx(null)}>
              Stop
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={TONE[current.type]}>
              Type {current.type}: {ERROR_TYPES[current.type].name}
            </Badge>
            <span className="text-xs text-ink-3">
              {subjectName(current.subjectId)}
              {current.topicId ? ` · ${topicName(current.topicId)}` : ""}
            </span>
          </div>
          <h2 className="display mt-2 text-2xl">{current.questionRef}</h2>
          <dl className="mt-3 grid gap-3 text-[13.5px] sm:grid-cols-2">
            {[
              ["What you thought", current.originalThought],
              ["Why it was wrong", current.whyWrong],
              ["Correct reasoning", current.correctReasoning],
              ["Rule to remember", current.rule],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-bg-2 p-3">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className={cx("mt-0.5 whitespace-pre-wrap", k === "Rule to remember" && "text-amber")}>{v || <span className="text-ink-3">—</span>}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                if (reviewItem) await gradeReview(reviewItem.id, "again");
                else await updateError(current.id, { repeatCount: current.repeatCount + 1, reviewDate: addDays(today, 1) });
                advance();
              }}
            >
              Still shaky
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (reviewItem) await gradeReview(reviewItem.id, "good");
                else await updateError(current.id, { reviewDate: addDays(today, 3) });
                advance();
              }}
            >
              Got it — review later
            </Button>
            <Button
              icon={<CheckCheck size={15} />}
              onClick={async () => {
                await updateError(current.id, { status: "resolved" });
                advance();
              }}
            >
              Resolved for good
            </Button>
            <Button variant="ghost" icon={<CalendarPlus size={15} />} onClick={() => toTask(current)}>
              Make it a task
            </Button>
          </div>
        </Panel>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Error distribution" hint={`${dist.total} logged${fSubject ? ` in ${subjectName(fSubject)}` : ""}`} />
          <div className="flex items-center gap-4 px-4 pb-4">
            <div className="w-[130px] shrink-0">
              <ChartBox height={130} empty={dist.total === 0} emptyTitle="No errors">
                <PieChart>
                  <Pie data={dist.types.filter((t) => t.count)} dataKey="count" nameKey="type" innerRadius={38} outerRadius={60} paddingAngle={2} isAnimationActive={false}>
                    {dist.types
                      .filter((t) => t.count)
                      .map((t) => (
                        <Cell key={t.type} fill={ERROR_TYPES[t.type].color} stroke="var(--surface)" />
                      ))}
                  </Pie>
                  <Tooltip {...tooltipProps} formatter={(v, n) => [v, `Type ${n}`]} />
                </PieChart>
              </ChartBox>
            </div>
            <ul className="flex-1 space-y-2 text-[13px]">
              {dist.types.map((t) => (
                <li key={t.type}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ERROR_TYPES[t.type].color }} />
                    <span>
                      {t.type}: {ERROR_TYPES[t.type].name}
                    </span>
                  </div>
                  <p className="num pl-[18px] text-xs text-ink-3">
                    {t.count} · {Math.round(t.pct)}% · {Math.round(t.marks * 100) / 100} marks lost
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Which errors cost the most" hint={par.basis === "marks" ? "Topics ranked by recorded marks lost" : "No marks recorded — ranked by occurrences (incl. repeats)"} action={<Link href="/analytics?tab=weakness" className="text-xs text-ink-3 hover:text-ink">Pareto chart</Link>} />
          <ul className="space-y-2 px-4 pb-4 text-[13px]">
            {par.rows.length === 0 && <li className="text-ink-3">Log errors with a topic to rank them.</li>}
            {par.rows.slice(0, 6).map((r) => (
              <li key={r.key} className="flex items-center gap-3">
                <Link href={`/topics/${r.key}`} className="min-w-0 flex-1 truncate hover:underline">
                  {topicName(r.key)}
                </Link>
                <span className="num shrink-0 text-ink-2">
                  {Math.round(r.value * 100) / 100} {par.basis === "marks" ? "marks" : "×"}
                </span>
                <span className="num w-24 shrink-0 text-right text-xs text-ink-3">{Math.round(r.cumulativePct)}% cumulative</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title={`Entries (${list.length})`}
          action={
            <div className="flex flex-wrap gap-1.5">
              <SubjectSelect ariaLabel="Filter subject" value={fSubject} onChange={(s) => { setFSubject(s); setFTopic(undefined); }} emptyLabel="All subjects" className="h-8 w-40 text-[13px]" />
              <Select aria-label="Filter type" value={fType} onChange={(e) => setFType(e.target.value as ErrorType | "")} className="h-8 w-28 text-[13px]">
                <option value="">All types</option>
                <option value="A">Type A</option>
                <option value="B">Type B</option>
                <option value="C">Type C</option>
              </Select>
              <Select aria-label="Filter status" value={fStatus} onChange={(e) => setFStatus(e.target.value as "" | "open" | "resolved")} className="h-8 w-28 text-[13px]">
                <option value="">Any status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </Select>
            </div>
          }
        />
        {fTopic && (
          <p className="px-4 pb-2 text-xs text-ink-3">
            Showing {topicName(fTopic)} only.{" "}
            <button type="button" className="text-violet-2 hover:underline" onClick={() => setFTopic(undefined)}>
              Show all topics
            </button>
          </p>
        )}
        {list.length === 0 ? (
          <EmptyState title={data.errors.length ? "No entries match these filters" : "No errors logged yet"} body="Mistakes logged from the PYQ tracker or mock audits appear here too." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDialog(e)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={TONE[e.type]}>Type {e.type}</Badge>
                    <span className="text-[13.5px] font-medium">{e.questionRef}</span>
                    {e.repeatCount > 0 && <Badge tone="rose">repeated {e.repeatCount}×</Badge>}
                    {e.status === "resolved" && <Badge tone="mint">resolved</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {fmtDate(e.date)} · {subjectName(e.subjectId)}
                    {e.topicId ? ` · ${topicName(e.topicId)}` : ""}
                    {e.marksLost ? ` · −${e.marksLost} marks` : ""}
                    {e.reviewDate && e.status === "open" ? ` · review ${fmtDate(e.reviewDate)}` : ""}
                  </p>
                  {e.rule && <p className="mt-1 text-[13px] text-amber">Rule: {e.rule}</p>}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Link href={`/tutor?error=${e.id}`}>
                    <Button size="sm" variant="ghost">
                      Ask tutor
                    </Button>
                  </Link>
                  {e.status === "open" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toTask(e)}>
                        To task
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateError(e.id, { status: "resolved" })}>
                        Resolve
                      </Button>
                    </>
                  )}
                  {e.status === "resolved" && (
                    <Button size="sm" variant="ghost" onClick={() => updateError(e.id, { status: "open", reviewDate: today })}>
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ErrorDialog open={!!dialog} initial={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

export default function ErrorsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ErrorsInner />
    </Suspense>
  );
}
