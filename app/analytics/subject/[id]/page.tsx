"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useData } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Bar, PageSkeleton, Panel, PanelHeader, Stat, cx } from "@/components/ui";
import { AccuracyPanel, HoursPanel } from "@/components/analytics/Charts";
import { SUBJECT_MAP, defaultPriority } from "@/data/syllabus";
import { FUNNEL_LABEL, STATUS_LABEL } from "@/lib/calc/progress";
import { errorDistribution } from "@/lib/calc/errors";
import { ERROR_TYPES } from "@/data/plan";
import { fmtDate, fmtMinutes } from "@/lib/date";
import type { SubjectId } from "@/types";

export default function SubjectAnalytics() {
  const { id } = useParams<{ id: string }>();
  const subject = SUBJECT_MAP[id as SubjectId];
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  if (!subject) return <p className="py-16 text-center text-sm text-ink-2">Unknown subject.</p>;
  if (!data || !a) return <PageSkeleton />;
  const ss = a.subjectStats.find((s) => s.subjectId === subject.id)!;
  const topics = [...a.topicStats.values()].filter((t) => t.topic.subjectId === subject.id);
  const dist = errorDistribution(data.errors.filter((e) => e.subjectId === subject.id));
  const mocks = data.mocks.filter((m) => m.subjectMarks.some((s) => s.subjectId === subject.id));
  return (
    <div className="space-y-5">
      <div>
        <Link href="/analytics" className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Analytics
        </Link>
        <h1 className="display mt-2 text-[30px] leading-tight">{subject.name}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone="violet">Tier {subject.tier} · ~{subject.sourceMarks} (PDF estimate)</Badge>
          {subject.sourceFocus && <Badge>{subject.sourceFocus}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Coverage", `${Math.round(ss.completionPct)}%`, `${ss.covered}/${ss.total} topics`],
          ["Mastered", ss.mastered, "meet criteria"],
          ["PYQ accuracy", ss.accuracy === null ? "—" : `${Math.round(ss.accuracy)}%`, `n = ${ss.attempted}`],
          ["Confidence", ss.avgConfidence === null ? "—" : `${ss.avgConfidence.toFixed(1)}/5`, `${ss.ratedCount} rated`],
          ["Time studied", fmtMinutes(ss.minutes), ss.lastStudied ? `last ${fmtDate(ss.lastStudied)}` : "not yet"],
        ].map(([l, v, s]) => (
          <Panel key={String(l)} className="p-3.5">
            <Stat label={l} value={v} sub={s} />
          </Panel>
        ))}
      </div>
      <Panel>
        <PanelHeader title="Topics" hint="Sorted by weakest accuracy, then not-started" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-y border-line bg-bg-2/60 text-left text-xs text-ink-3">
              <tr>
                {["Topic", "Status", "Stage", "Priority", "Conf.", "PYQs", "Accuracy", "Time", "Next revision"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topics
                .sort((x, y) => (x.accuracy ?? 101) - (y.accuracy ?? 101) || x.progress.status.localeCompare(y.progress.status))
                .map((t) => (
                  <tr key={t.topic.id} className="hover:bg-surface-2/50">
                    <td className="max-w-[280px] px-3 py-2">
                      <Link href={`/topics/${t.topic.id}`} className="hover:underline">{t.topic.name}</Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{STATUS_LABEL[t.progress.status]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{FUNNEL_LABEL[t.stage]}</td>
                    <td className="px-3 py-2">{t.progress.priority ?? defaultPriority(subject.id)}</td>
                    <td className="num px-3 py-2">{t.progress.confidence || "—"}</td>
                    <td className="num px-3 py-2">{t.attempted}</td>
                    <td className={cx("num px-3 py-2", t.accuracy !== null && t.accuracy < 50 && t.attempted >= 5 && "text-rose")}>{t.accuracy === null ? "—" : `${Math.round(t.accuracy)}%`}</td>
                    <td className="num px-3 py-2">{fmtMinutes(t.minutes)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{t.progress.nextRevision ? fmtDate(t.progress.nextRevision) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <AccuracyPanel data={data} subjectId={subject.id} />
        <HoursPanel data={data} today={today} subjectId={subject.id} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Errors" hint={`${dist.total} logged`} action={<Link href={`/errors`} className="text-xs text-ink-3 hover:text-ink">Notebook</Link>} />
          <ul className="space-y-2 px-4 pb-4 text-[13px]">
            {dist.types.map((t) => (
              <li key={t.type}>
                <div className="flex justify-between"><span>Type {t.type}: {ERROR_TYPES[t.type].name}</span><span className="num">{t.count}</span></div>
                <Bar value={t.pct} color={ERROR_TYPES[t.type].color} height={4} label={`Type ${t.type}`} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Mock sections" hint={`${mocks.length} mocks include this subject`} />
          <ul className="space-y-1.5 px-4 pb-4 text-[13px]">
            {mocks.length === 0 && <li className="text-ink-3">No subject-wise mock marks yet.</li>}
            {mocks.sort((x, y) => x.date.localeCompare(y.date)).map((m) => {
              const s = m.subjectMarks.find((x) => x.subjectId === subject.id)!;
              return (
                <li key={m.id} className="flex justify-between"><span>{m.name} · {fmtDate(m.date)}</span><span className="num">{s.scored}/{s.max}</span></li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
