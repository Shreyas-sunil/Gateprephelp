"use client";

import Link from "next/link";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { useData } from "@/components/providers";
import { Badge, Button, PageHeader, PageSkeleton, Panel, PanelHeader } from "@/components/ui";
import { DEFAULT_BLOCKS, ERROR_TYPES, RULES_80, SEVEN_WEEK_PLAN, SOURCE_FLAGS, TACTICS, VERIFIED_FACTS } from "@/data/plan";
import { SUBJECT_MAP } from "@/data/syllabus";
import { fmtDate } from "@/lib/date";
import type { ErrorType } from "@/types";

export default function StrategyPage() {
  const data = useData();
  if (!data) return <PageSkeleton />;
  const s = data.settings;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Strategy"
        description="Your GATE2027.pdf, preserved as written, with GATE CAT's verification notes kept separate."
        actions={
          <Link href="/setup">
            <Button size="sm" variant="primary">
              Rebase the plan
            </Button>
          </Link>
        }
      />

      <Panel className="border-amber/30">
        <PanelHeader title="Verification notes" hint="Where the PDF is outdated, inconsistent or unverifiable. The PDF's text is not altered elsewhere." />
        <ul className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          {SOURCE_FLAGS.map((f) => (
            <li key={f.title} className="flex gap-2.5 rounded-md border border-line p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
              <div>
                <p className="text-[13.5px] font-medium">{f.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Verified exam facts" hint={`Checked against official sources on ${fmtDate(VERIFIED_FACTS.retrieved, { year: true })}. The AI tutor may cite only these as verified.`} />
        <ul className="space-y-2 px-4 pb-4 text-[13.5px]">
          {VERIFIED_FACTS.items.map((f) => (
            <li key={f.fact} className="flex gap-2.5">
              <BadgeCheck size={15} className="mt-0.5 shrink-0 text-mint" />
              <span>
                {f.fact}{" "}
                <a href={f.source} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan hover:underline">
                  source
                </a>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="The daily 9-hour micro-schedule" hint={`Template from the PDF. Your settings: ${s.blocks.map((b) => `${b.hours}h`).join(" + ")} (edit in Settings; the planner scales to your daily hours).`} />
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
          {DEFAULT_BLOCKS.map((b) => (
            <div key={b.id} className="rounded-md border border-line p-3">
              <p className="text-xs text-ink-3">
                Block {b.id} · {b.hours} hours · {b.time}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold">{b.name}</p>
              <p className="mt-1 text-[13px] text-ink-2">{b.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="The seven-week plan (original dates)" hint="These dates are from the PDF and are shown for reference only. The planner uses your rebased dates." />
        <ol className="divide-y divide-line">
          {SEVEN_WEEK_PLAN.map((w) => (
            <li key={w.week} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold">
                  Week {w.week}: {w.title}
                </span>
                <span className="text-xs text-ink-3">PDF: {w.sourceDates}</span>
                {w.subjectIds.map((sid) => (
                  <Badge key={sid}>{SUBJECT_MAP[sid].short}</Badge>
                ))}
              </div>
              <p className="mt-1 text-[13px] text-ink-3">Syllabus focus: {w.syllabusFocus}</p>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {w.segments.map((seg) => (
                  <li key={seg.label} className="rounded-md bg-bg-2 p-2.5 text-[13px]">
                    <span className="font-medium">
                      {seg.label}: {seg.title}
                    </span>
                    <span className="mt-0.5 block text-ink-2">{seg.detail}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Three non-negotiable tactics" />
          <ul className="space-y-3 px-4 pb-4">
            {TACTICS.map((t) => (
              <li key={t.title}>
                <p className="text-[13.5px] font-semibold">{t.title}</p>
                <p className="text-[13px] text-ink-2">{t.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Error classification matrix" action={<Link href="/errors" className="text-xs text-ink-3 hover:text-ink">Notebook</Link>} />
          <ul className="space-y-3 px-4 pb-4">
            {(Object.keys(ERROR_TYPES) as ErrorType[]).map((k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[12px] font-bold text-bg" style={{ background: ERROR_TYPES[k].color }}>
                  {k}
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold">{ERROR_TYPES[k].name}</p>
                  <p className="text-[13px] text-ink-2">
                    {ERROR_TYPES[k].meaning} {ERROR_TYPES[k].fix}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Mock-test season" hint="Your current dates (editable in Mock Tests)" action={<Link href="/mocks" className="text-xs text-ink-3 hover:text-ink">Edit</Link>} />
          <ol className="space-y-3 px-4 pb-4">
            {s.mockPhases.map((p) => (
              <li key={p.id}>
                <p className="text-[13.5px] font-semibold">
                  Phase {p.id}: {p.name} <span className="font-normal text-ink-3">({fmtDate(p.start)} – {fmtDate(p.end)})</span>
                </p>
                <p className="text-[13px] text-ink-2">{p.objective}</p>
                <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-3">
                  {p.actions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <PanelHeader title="The round method" hint="Your current strategy (editable in Mock Tests)" />
          <ol className="space-y-3 px-4 pb-4">
            {s.rounds.map((r) => (
              <li key={r.round}>
                <p className="text-[13.5px] font-semibold">
                  Round {r.round} (minutes {r.startMin}–{r.endMin}): {r.title}
                </p>
                <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-2">
                  {r.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Three rules to break the 80-mark barrier" hint="The 80-mark and AIR-under-70 framing is the PDF author's, not a GATE CAT prediction." />
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
          {RULES_80.map((r) => (
            <div key={r.title} className="rounded-md border border-line p-3">
              <p className="text-[13.5px] font-semibold">{r.title}</p>
              <p className="mt-1 text-[13px] text-ink-2">{r.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
