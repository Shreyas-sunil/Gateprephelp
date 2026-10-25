"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Info, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useData } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Bar, Button, Input, PageHeader, PageSkeleton, Panel, Select, cx } from "@/components/ui";
import { SUBJECTS, SUBJECT_MAP, defaultPriority } from "@/data/syllabus";
import { STATUS_LABEL, STATUS_ORDER, isCovered, type TopicStats } from "@/lib/calc/progress";
import { setTopicStatus } from "@/lib/actions";
import { fmtDate, relativeDay } from "@/lib/date";
import type { Priority, SubjectId, TopicStatus } from "@/types";
import { SOURCE_FLAGS } from "@/data/plan";

const STATUS_TONE: Record<TopicStatus, string> = {
  not_started: "text-ink-3",
  learning: "text-cyan",
  practicing: "text-violet-2",
  revision: "text-amber",
  mastered: "text-mint",
};

type RevFilter = "" | "due" | "scheduled" | "none";
type CompFilter = "" | "covered" | "uncovered" | "mastered" | "gaps";

function SyllabusInner() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<SubjectId | "">((params.get("subject") as SubjectId) ?? "");
  const [priority, setPriority] = useState<Priority | "">("");
  const [status, setStatus] = useState<TopicStatus | "">("");
  const [rev, setRev] = useState<RevFilter>("");
  const [comp, setComp] = useState<CompFilter>("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(params.get("subject") ? [params.get("subject")!] : []));
  const [showEstimates, setShowEstimates] = useState(false);

  const filtered = useMemo(() => {
    if (!a) return new Map<SubjectId, TopicStats[]>();
    const needle = q.trim().toLowerCase();
    const out = new Map<SubjectId, TopicStats[]>();
    for (const t of a.topicStats.values()) {
      const p = t.progress;
      const pr = p.priority ?? defaultPriority(t.topic.subjectId);
      if (subject && t.topic.subjectId !== subject) continue;
      if (priority && pr !== priority) continue;
      if (status && p.status !== status) continue;
      if (rev === "due" && !(p.nextRevision && p.nextRevision <= today)) continue;
      if (rev === "scheduled" && !p.nextRevision) continue;
      if (rev === "none" && p.nextRevision) continue;
      if (comp === "covered" && !isCovered(p.status)) continue;
      if (comp === "uncovered" && isCovered(p.status)) continue;
      if (comp === "mastered" && !t.meetsMastery) continue;
      if (comp === "gaps" && !(p.status === "mastered" && !t.meetsMastery)) continue;
      if (needle && !`${t.topic.name} ${t.topic.group ?? ""} ${SUBJECT_MAP[t.topic.subjectId].name}`.toLowerCase().includes(needle)) continue;
      const arr = out.get(t.topic.subjectId) ?? [];
      arr.push(t);
      out.set(t.topic.subjectId, arr);
    }
    return out;
  }, [a, q, subject, priority, status, rev, comp, today]);

  if (!data || !a) return <PageSkeleton />;
  const anyFilter = !!(q || subject || priority || status || rev || comp);
  const shownCount = [...filtered.values()].reduce((s, l) => s + l.length, 0);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <PageHeader
        title="Syllabus explorer"
        description={`Every topic in the GATE CS 2027 syllabus, plus General Aptitude. ${a.overall.covered} of ${a.overall.total} topics covered, ${a.overall.mastered} meet your mastery criteria.`}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(SUBJECTS.map((s) => s.id)))}>
              Expand all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>
              Collapse all
            </Button>
          </>
        }
      />

      <Panel className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <Input aria-label="Search topics" placeholder="Search topics" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select aria-label="Filter by subject" value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | "")}>
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as TopicStatus | "")}>
            <option value="">Any status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
            <option value="">Any priority</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Filter by revision" value={rev} onChange={(e) => setRev(e.target.value as RevFilter)}>
              <option value="">Any revision</option>
              <option value="due">Due now</option>
              <option value="scheduled">Scheduled</option>
              <option value="none">Not scheduled</option>
            </Select>
            <Select aria-label="Filter by completion" value={comp} onChange={(e) => setComp(e.target.value as CompFilter)}>
              <option value="">Any stage</option>
              <option value="covered">Covered</option>
              <option value="uncovered">Not covered</option>
              <option value="mastered">Meets mastery</option>
              <option value="gaps">Marked mastered, gaps</option>
            </Select>
          </div>
        </div>
        {anyFilter && (
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>
              Showing {shownCount} of {a.overall.total} topics
            </span>
            <button
              type="button"
              className="text-violet-2 hover:underline"
              onClick={() => {
                setQ("");
                setSubject("");
                setPriority("");
                setStatus("");
                setRev("");
                setComp("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </Panel>

      <div className="space-y-2.5">
        {SUBJECTS.map((s) => {
          const list = filtered.get(s.id);
          if (anyFilter && !list?.length) return null;
          const ss = a.subjectStats.find((x) => x.subjectId === s.id)!;
          const isOpen = open.has(s.id) || (anyFilter && !!list?.length && !!q);
          const groups = s.groups ?? [""];
          return (
            <Panel key={s.id} className="overflow-hidden">
              <button type="button" onClick={() => toggle(s.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{s.name}</span>
                    {s.section ? <span className="text-xs text-ink-3">Section {s.section}</span> : <Badge tone="amber">Not in CS syllabus file</Badge>}
                    <Badge tone={s.tier === 1 ? "violet" : s.tier === 2 ? "cyan" : "neutral"} title="Tier and marks are estimates from your PDF, not official">
                      Tier {s.tier} · ~{s.sourceMarks}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <Bar value={ss.completionPct} color={s.color} className="max-w-xs" label={`${s.name} coverage`} />
                    <span className="num shrink-0 text-xs text-ink-3">
                      {ss.covered}/{ss.total} covered · {ss.mastered} mastered{ss.accuracy !== null ? ` · ${Math.round(ss.accuracy)}% on ${ss.attempted}` : ""}
                    </span>
                  </div>
                </div>
                <ChevronDown size={18} className={cx("shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-line">
                    {groups.map((g) => {
                      const items = (list ?? []).filter((t) => (t.topic.group ?? "") === g);
                      if (!items.length) return null;
                      return (
                        <div key={g || "all"}>
                          {g && <p className="bg-bg-2/60 px-4 py-1.5 text-xs font-medium text-ink-3">{g}</p>}
                          <ul className="divide-y divide-line">
                            {items.map((t) => (
                              <TopicRow key={t.topic.id} t={t} today={today} />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-6">
        <button type="button" onClick={() => setShowEstimates((v) => !v)} aria-expanded={showEstimates} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <Info size={16} className="text-amber" /> Source document estimates
          </span>
          <ChevronDown size={18} className={cx("text-ink-3 transition-transform", showEstimates && "rotate-180")} />
        </button>
        {showEstimates && (
          <div className="border-t border-line px-4 py-4 text-sm">
            <p className="text-ink-2">These tiers and mark ranges are copied from your GATE2027.pdf. They are the author&apos;s estimates — not official GATE weightages or predictions.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((tier) => (
                <div key={tier} className="rounded-md border border-line p-3">
                  <p className="text-[13px] font-semibold">Tier {tier}</p>
                  <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
                    {SUBJECTS.filter((s) => s.tier === tier && s.id !== "algo").map((s) => (
                      <li key={s.id}>
                        {s.id === "pds" ? "Data Structures & Algorithms" : s.name}: ~{s.sourceMarks.replace(" (combined DSA)", "")}
                        {s.sourceFocus && <span className="block text-xs text-ink-3">{s.sourceFocus}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-3">{SOURCE_FLAGS.find((f) => f.title.startsWith("Topics named"))?.body}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TopicRow({ t, today }: { t: TopicStats; today: string }) {
  const p = t.progress;
  const pr = p.priority ?? defaultPriority(t.topic.subjectId);
  const due = p.nextRevision && p.nextRevision <= today;
  return (
    <motion.li layout="position" className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
      <Link href={`/topics/${t.topic.id}`} className="min-w-0 flex-1 group">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13.5px] text-ink group-hover:underline">{t.topic.name}</span>
          {t.topic.origin === "pdf" && <Badge title="Named in the PDF's plan detail, not the official syllabus text">PDF plan</Badge>}
          {t.topic.flag && <Badge tone="amber" title={t.topic.flag}>Check</Badge>}
          {pr === "high" && <Badge tone="violet">High</Badge>}
          {p.status === "mastered" && !t.meetsMastery && <Badge tone="amber" title={t.masteryGaps.join("; ")}>Criteria not met</Badge>}
          {t.meetsMastery && <Badge tone="mint">Mastered ✓</Badge>}
        </div>
        <p className="num mt-0.5 text-xs text-ink-3">
          {t.accuracy !== null ? `${Math.round(t.accuracy)}% on ${t.attempted} PYQs` : "No PYQs yet"}
          {p.confidence ? ` · confidence ${p.confidence}/5` : ""}
          {t.lastStudied ? ` · studied ${relativeDay(t.lastStudied, today).toLowerCase()}` : ""}
          {p.nextRevision ? ` · revise ${fmtDate(p.nextRevision)}` : ""}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        {due && <Badge tone="amber">Revision due</Badge>}
        <Select
          aria-label={`Status for ${t.topic.name}`}
          value={p.status}
          onChange={(e) => setTopicStatus(t.topic.id, e.target.value as TopicStatus)}
          className={cx("h-8 w-[150px] text-[13px] font-medium", STATUS_TONE[p.status])}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
    </motion.li>
  );
}

export default function SyllabusPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SyllabusInner />
    </Suspense>
  );
}
