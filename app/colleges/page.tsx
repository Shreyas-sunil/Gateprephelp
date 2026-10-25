"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin, Pin, PinOff, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Badge, Button, Checkbox, Dialog, EmptyState, Field, IconButton, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Select, cx } from "@/components/ui";
import { ChartBox, Legend, axisProps, tooltipProps } from "@/components/charts/chart-kit";
import { Cat } from "@/components/cat/Cat";
import { CATEGORY_LABEL, PROGRAMMES, type Programme } from "@/data/colleges";
import { benchmarkFor, benchmarkStatus, matchGroup, scoreContext, STATUS_TEXT, type BenchmarkStatus, type MatchGroup } from "@/lib/calc/college";
import { whatWouldItTake, type TakePlan } from "@/lib/calc/college-plan";
import { addTask, setPinned, toggleShortlist, updateSettings } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/defaults";
import { addDays, fmtDate } from "@/lib/date";
import { mockPct } from "@/lib/calc/readiness";
import type { CustomProgramme, GateCategory } from "@/types";

const STATUS_TONE: Record<BenchmarkStatus, "rose" | "amber" | "mint" | "neutral"> = { below: "rose", approaching: "amber", within: "mint", unavailable: "neutral", "no-score": "neutral" };
const GROUP_META: Record<MatchGroup, { title: string; hint: string }> = {
  dream: { title: "Dream — ambitious targets", hint: "Your scenario score is below or near the historical benchmark." },
  target: { title: "Target — competitive possibilities", hint: "Your scenario score meets the historical benchmark. Meeting a cut-off is not admission." },
  additional: { title: "Additional options — broader shortlist", hint: "No verified benchmark here; worth investigating on official pages." },
};

function customToProgramme(c: CustomProgramme): Programme {
  return {
    id: c.id,
    institution: c.institution,
    short: c.institution,
    programme: c.programme,
    location: c.location ?? "—",
    gatePapers: ["CS"],
    officialUrl: c.url ?? "",
    officialUrlVerified: false,
    infoStatus: c.cutoffScore ? "historical" : "unavailable",
    cutoffs: c.cutoffScore
      ? [{ year: c.cutoffYear ?? "?", stage: c.cutoffNote ?? "Entered by you", metric: "gate-score", scale: 1000, values: { UR: c.cutoffScore, OBC: c.cutoffScore, EWS: c.cutoffScore, SC: c.cutoffScore, ST: c.cutoffScore, PH: c.cutoffScore, KM: c.cutoffScore, WQ: c.cutoffScore }, sourceType: "user", sourceUrl: c.url ?? "", sourceTitle: "Entered by you", retrieved: new Date(c.createdAt).toISOString().slice(0, 10) }]
      : [],
    notes: ["Added by you. The cut-off applies to every category as entered."],
  };
}

export default function CollegesPage() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const toast = useToast();
  const [community, setCommunity] = useState(false);
  const [hypo, setHypo] = useState<number | null>(null);
  const [hypoRank, setHypoRank] = useState("");
  const [inst, setInst] = useState<"all" | "IISc" | "IIT" | "custom" | "shortlist">("all");
  const [plan, setPlan] = useState<{ p: Programme; plan: TakePlan } | null>(null);
  const [adding, setAdding] = useState(false);
  const [compare, setCompare] = useState<string[]>(["iisc-csa-mtech", "iisc-ai", "iisc-cds"]);

  const all = useMemo(() => (data ? [...PROGRAMMES, ...data.customProgrammes.map(customToProgramme)] : PROGRAMMES), [data]);
  if (!data || !a) return <PageSkeleton />;
  const s = data.settings;
  const ctx = scoreContext(data.mocks, s);
  const current = ctx.official ?? ctx.estimatedGateScore;
  const scenario = hypo ?? current ?? s.targetGateScore;
  const scenarioLabel = hypo !== null ? "Hypothetical scenario" : ctx.official !== null ? "Official GATE score" : ctx.estimatedGateScore !== null ? "Estimate from your latest full mock" : "Your target score (no real score yet)";
  const dream = all.find((p) => p.id === s.dreamProgrammeId) ?? PROGRAMMES[0]!;
  const dreamBench = benchmarkFor(dream, s.category, community);
  const pinned = data.shortlist.filter((x) => x.pinned).map((x) => x.id);
  const shortlisted = new Set(data.shortlist.map((x) => x.id));

  const filtered = all.filter((p) => {
    if (inst === "IISc") return p.short === "IISc";
    if (inst === "IIT") return p.short.startsWith("IIT");
    if (inst === "custom") return p.id.startsWith("cp_");
    if (inst === "shortlist") return shortlisted.has(p.id);
    return true;
  });
  const rows = filtered.map((p) => {
    const b = benchmarkFor(p, s.category, community);
    const status = benchmarkStatus(scenario, b?.value);
    return { p, b, status, group: matchGroup(status) };
  });

  // Milestone path on the GATE-score scale
  const benches = all.map((p) => benchmarkFor(p, s.category, community)?.value).filter((v): v is number => v !== undefined).sort((x, y) => x - y);
  const nextMilestone = current !== null ? benches.find((v) => v > current) : undefined;
  const path = [
    { label: "Current", value: current, note: current === null ? "No real score yet" : ctx.official !== null ? "Official" : "Estimate" },
    { label: "Next milestone", value: nextMilestone ?? null, note: nextMilestone ? "Next benchmark above you" : current === null ? "Needs a current score" : "Above all listed benchmarks" },
    { label: "Competitive target", value: s.targetGateScore, note: "Your goal (Goals page)" },
    { label: `${dream.short} aspiration`, value: dreamBench?.value ?? null, note: dreamBench ? `${dreamBench.record.year} ${s.category}${dreamBench.record.sourceType === "community" ? ", community" : ""}` : "No verified benchmark" },
  ];

  const mocks = [...data.mocks].sort((x, y) => x.date.localeCompare(y.date));
  const mockChart = mocks.map((m) => ({ date: fmtDate(m.date), name: m.name, pct: Math.round(mockPct(m) * 10) / 10, kind: m.kind }));
  const benchChart = compare
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is Programme => !!p)
    .map((p) => {
      const b = benchmarkFor(p, s.category, community);
      return { name: p.short === "IISc" ? (p.department ?? p.programme).replace(/ \(.*\)/, "").slice(0, 22) : p.short, value: b?.value ?? null, src: b?.record.sourceType, year: b?.record.year };
    })
    .filter((x) => x.value !== null);

  const latestFull = ctx.latestFullMock;
  const providerRank = [...data.mocks].reverse().find((m) => m.providerRank);

  return (
    <div className="space-y-5">
      <PageHeader title="College predictor & roadmap" description="Scenario planning against published benchmarks. Benchmarks are GATE scores out of 1000 — a different scale from mock marks — and meeting one is never the same as admission." />

      {/* Featured destination */}
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 90% at 85% 10%, rgba(242,180,90,0.12), transparent 60%), var(--glow)" }} aria-hidden />
        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] text-amber">
              <Star size={14} /> Dream destination
            </p>
            <h2 className="display mt-1 text-[30px] leading-tight sm:text-[36px]">{dream.institution}</h2>
            <p className="mt-1 text-[15px] text-ink">{dream.programme}</p>
            {dream.department && dream.department !== dream.programme && <p className="text-[13px] text-ink-2">{dream.department}</p>}
            <p className="mt-1 flex items-center gap-1 text-[13px] text-ink-3">
              <MapPin size={13} /> {dream.location}
            </p>
            {dream.admissionRoute && <p className="mt-3 max-w-xl text-[13px] text-ink-2">{dream.admissionRoute}</p>}
            {dream.eligibility && <p className="mt-1 text-[13px] text-ink-3">Eligibility: {dream.eligibility}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {dream.officialUrl && (
                <a href={dream.officialUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" icon={<ExternalLink size={13} />}>
                    Official admissions page
                  </Button>
                </a>
              )}
              <Button size="sm" variant="primary" icon={<Sparkles size={14} />} onClick={() => setPlan({ p: dream, plan: whatWouldItTake(dream, data, a, community) })}>
                What would it take?
              </Button>
              <Select aria-label="Choose dream programme" value={dream.id} onChange={(e) => updateSettings({ dreamProgrammeId: e.target.value })} className="h-8 w-56 text-[13px]">
                {all.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.short}: {p.programme.slice(0, 40)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-bg-2/70 p-4">
            <div className="flex items-center gap-3">
              <Cat mood={current !== null && dreamBench && current >= dreamBench.value ? "celebrating" : "studying"} fur={s.cat.fur} accessory={s.cat.accessory} size={56} />
              <div className="text-[13px]">
                <p className="text-ink-3">Benchmark ({s.category})</p>
                {dreamBench ? (
                  <p className="num text-xl font-semibold">
                    {dreamBench.value}
                    <span className="text-sm font-normal text-ink-3">/1000</span>
                  </p>
                ) : (
                  <p className="font-medium">Data unavailable</p>
                )}
                {dreamBench && (
                  <p className="text-xs text-ink-3">
                    {dreamBench.record.year} · {dreamBench.record.sourceType === "official" ? "official IISc report" : dreamBench.record.sourceType === "community" ? "community-reported, unverified" : "entered by you"}
                  </p>
                )}
              </div>
            </div>
            <ul className="space-y-1.5 border-t border-line pt-3 text-[13px]">
              <li className="flex justify-between gap-2">
                <span className="text-ink-3">Latest mock (actual marks)</span>
                <span className="num">{latestFull ? `${latestFull.score}/${latestFull.totalMarks}` : ctx.latestMock ? `${ctx.latestMock.score}/${ctx.latestMock.totalMarks} (not full-length)` : "—"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-3">Estimated GATE score</span>
                <span className="num">{ctx.estimatedGateScore ?? "—"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-3">Official GATE score</span>
                <span className="num">{ctx.official ?? "after 19 Mar 2027"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-3">Estimated AIR</span>
                <span className="text-right text-xs text-ink-2">Not estimated — mock data can&apos;t predict AIR reliably{providerRank ? `. Provider rank ${providerRank.providerRank}${providerRank.providerCandidates ? `/${providerRank.providerCandidates}` : ""} (${providerRank.name})` : ""}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-3">Preparation</span>
                <span className="num">
                  {Math.round(a.overall.completionPct)}% covered · {a.overall.mastered} mastered
                </span>
              </li>
              {current !== null && dreamBench && (
                <li className="flex justify-between gap-2 font-medium">
                  <span>Gap to benchmark</span>
                  <span className={cx("num", current >= dreamBench.value ? "text-mint" : "text-amber")}>{current >= dreamBench.value ? `+${current - dreamBench.value} above` : `${dreamBench.value - current} points`}</span>
                </li>
              )}
            </ul>
            {ctx.estimatedGateScore === null && ctx.official === null && (
              <p className="text-xs text-ink-3">
                To estimate a GATE score, record a full-length mock and enter the official Mq and Mt values in{" "}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </Panel>

      {/* Simulator */}
      <Panel>
        <PanelHeader
          title="Score-to-college simulator"
          hint={`${scenarioLabel}: ${scenario}/1000. Drag to explore — scenarios are hypothetical, never saved as scores.`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Category" value={s.category} onChange={(e) => updateSettings({ category: e.target.value as GateCategory })} className="h-8 w-40 text-[13px]">
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Checkbox label="Include community-reported data" checked={community} onChange={setCommunity} />
            </div>
          }
        />
        <div className="space-y-4 px-4 pb-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <Field label={`Hypothetical GATE score: ${scenario}`} htmlFor="sim-score">
              <input id="sim-score" type="range" min={300} max={1000} step={5} value={scenario} onChange={(e) => setHypo(Number(e.target.value))} aria-label="Hypothetical GATE score" />
            </Field>
            <Field label="Hypothetical rank (optional)" htmlFor="sim-rank">
              <Input id="sim-rank" type="number" min={1} value={hypoRank} onChange={(e) => setHypoRank(e.target.value)} className="w-40" placeholder="e.g. 80" />
            </Field>
            <div className="flex items-end gap-1.5">
              {hypo !== null && (
                <Button size="md" variant="ghost" onClick={() => setHypo(null)}>
                  Reset to {current !== null ? "my score" : "target"}
                </Button>
              )}
            </div>
          </div>
          {hypoRank && <p className="text-xs text-ink-3">Rank comparisons: only CSA M.Tech has a reported closing rank here (75–90 General, 2025, community-reported). IISc&apos;s official report publishes scores, not ranks.</p>}

          {/* Path */}
          <div className="rounded-lg border border-line bg-bg-2/60 p-4">
            <div className="relative h-10">
              <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
              {path.map((p, i) =>
                p.value !== null ? (
                  <div key={p.label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(0, Math.min(100, ((p.value - 300) / 700) * 100))}%` }} title={`${p.label}: ${p.value}`}>
                    <span className="block h-4 w-4 rounded-full border-2 border-bg" style={{ background: ["var(--cyan)", "var(--violet)", "var(--amber)", "var(--rose)"][i] }} />
                  </div>
                ) : null,
              )}
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${((scenario - 300) / 700) * 100}%` }} aria-hidden>
                <span className="block h-7 w-0.5 rounded bg-ink" />
              </div>
            </div>
            <ol className="mt-3 grid gap-2 sm:grid-cols-4">
              {path.map((p, i) => (
                <li key={p.label} className="text-[13px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["var(--cyan)", "var(--violet)", "var(--amber)", "var(--rose)"][i] }} />
                    {p.label}
                  </span>
                  <span className="num block pl-4 font-semibold">{p.value ?? "—"}</span>
                  <span className="block pl-4 text-xs text-ink-3">{p.note}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-3">Scale: GATE score 300–1000. The white line is the simulator position.</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["all", "IISc", "IIT", "shortlist", "custom"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={inst === k} onClick={() => setInst(k)} className={cx("h-8 rounded-md border px-3 text-[13px]", inst === k ? "border-violet bg-violet-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>
                {k === "all" ? "All programmes" : k === "shortlist" ? `My shortlist (${shortlisted.size})` : k === "custom" ? "Added by me" : k}
              </button>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add institution
            </Button>
          </div>
        </div>
      </Panel>

      {(["dream", "target", "additional"] as MatchGroup[]).map((g) => {
        const list = rows.filter((r) => r.group === g).sort((x, y) => (y.b?.value ?? 0) - (x.b?.value ?? 0));
        return (
          <section key={g}>
            <h2 className="text-[15px] font-semibold">
              {GROUP_META[g].title} <span className="font-normal text-ink-3">({list.length})</span>
            </h2>
            <p className="mb-2.5 text-[13px] text-ink-3">{GROUP_META[g].hint}</p>
            {list.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-center text-[13px] text-ink-3">No programmes in this group at {scenario}.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map(({ p, b, status }) => (
                  <Panel key={p.id} as="article" className={cx("flex flex-col p-4", p.id === dream.id && "border-amber/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-ink-3">{p.institution}</p>
                        <h3 className="text-[14.5px] leading-snug font-semibold">{p.programme}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                          <MapPin size={11} /> {p.location}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <IconButton
                          size="sm"
                          label={pinned.includes(p.id) ? "Unpin" : "Pin to top 3"}
                          onClick={async () => {
                            if (!pinned.includes(p.id) && pinned.length >= 3) return toast({ tone: "info", title: "You can pin up to three programmes" });
                            if (!shortlisted.has(p.id)) await toggleShortlist(p.id, true);
                            await setPinned(p.id, !pinned.includes(p.id));
                          }}
                          className={pinned.includes(p.id) ? "text-amber" : ""}
                        >
                          {pinned.includes(p.id) ? <PinOff size={14} /> : <Pin size={14} />}
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</Badge>
                      <Badge>{p.infoStatus === "current" ? "Current" : p.infoStatus === "historical" ? "Historical data" : "No cut-off data"}</Badge>
                      {pinned.includes(p.id) && <Badge tone="amber">Pinned</Badge>}
                    </div>
                    <dl className="mt-3 space-y-1 text-[12.5px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-3">GATE paper</dt>
                        <dd>{p.gatePapers.join(", ")}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-3">Benchmark ({s.category})</dt>
                        <dd className="num text-right">{b ? `${b.value}/1000` : "Data unavailable"}</dd>
                      </div>
                      {b && (
                        <div className="text-[11.5px] text-ink-3">
                          {b.record.year} · {b.record.stage}. Source:{" "}
                          <a href={b.record.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                            {b.record.sourceType === "official" ? "official" : b.record.sourceType === "community" ? "community (unverified)" : "yours"}
                          </a>
                          , retrieved {fmtDate(b.record.retrieved, { year: true })}
                          {b.record.rank ? `. Reported rank ${b.record.rank}` : ""}
                          {b.record.seats ? `, ${b.record.seats} seats` : ""}
                        </div>
                      )}
                      {p.admissionRoute && (
                        <div>
                          <dt className="text-ink-3">Admission route</dt>
                          <dd className="text-ink-2">{p.admissionRoute}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-3">Deadline</dt>
                        <dd className="text-right text-ink-2">{p.deadline ?? "Not yet published — check official page"}</dd>
                      </div>
                    </dl>
                    {p.notes?.map((n) => (
                      <p key={n} className="mt-1.5 text-[11.5px] text-ink-3">
                        {n}
                      </p>
                    ))}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      <Button size="sm" variant="primary" onClick={() => setPlan({ p, plan: whatWouldItTake(p, data, a, community) })}>
                        What would it take?
                      </Button>
                      {p.officialUrl && (
                        <a href={p.officialUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" icon={<ExternalLink size={12} />}>
                            {p.officialUrlVerified ? "Official page" : "Dept. page (unverified)"}
                          </Button>
                        </a>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggleShortlist(p.id, !shortlisted.has(p.id))}>
                        {shortlisted.has(p.id) ? "Remove from shortlist" : "Shortlist"}
                      </Button>
                      {p.id !== dream.id && (
                        <Button size="sm" variant="ghost" onClick={() => updateSettings({ dreamProgrammeId: p.id })}>
                          Set as dream
                        </Button>
                      )}
                      {p.id.startsWith("cp_") && (
                        <IconButton size="sm" label="Delete" onClick={() => getDb().customProgrammes.delete(p.id)}>
                          <Trash2 size={13} />
                        </IconButton>
                      )}
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Your mock scores (marks scale)" hint="% of mock total. The amber line is your target marks — not a cut-off." />
          <div className="px-2 pb-3">
            <ChartBox height={240} empty={mockChart.length === 0} emptyTitle="No mocks recorded">
              <LineChart data={mockChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} width={44} unit="%" />
                <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} formatter={(v) => [`${v}%`, "Actual score"]} />
                <ReferenceLine y={s.targetMarks} stroke="var(--amber)" strokeDasharray="6 4" label={{ value: `Target ${s.targetMarks}`, fill: "var(--amber)", fontSize: 11, position: "insideTopRight" }} />
                <Line dataKey="pct" stroke="var(--violet)" strokeWidth={2.2} dot={{ r: 3.5 }} isAnimationActive={false} />
              </LineChart>
            </ChartBox>
            <div className="mt-2 px-2">
              <Legend items={[{ label: "Actual mock score", color: "var(--violet)" }, { label: "Your target (hypothetical)", color: "var(--amber)", dashed: true }]} />
              {mockChart.length > 0 && <p className="mt-1 text-xs text-ink-3">Gap to target: {Math.round((s.targetMarks - mockChart.at(-1)!.pct) * 10) / 10} points on the latest mock.</p>}
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Benchmarks (GATE-score scale)" hint="Compare programmes. Bars are historical cut-offs; the line is your current or scenario score." />
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-1">
              {all
                .filter((p) => benchmarkFor(p, s.category, community))
                .map((p) => {
                  const on = compare.includes(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={on} onClick={() => setCompare(on ? compare.filter((x) => x !== p.id) : [...compare, p.id].slice(-6))} className={cx("rounded border px-1.5 py-0.5 text-[11px]", on ? "border-violet bg-violet-soft text-ink" : "border-line text-ink-3")}>
                      {(p.department ?? p.programme).replace(/ \(.*\)/, "").slice(0, 20)}
                    </button>
                  );
                })}
            </div>
          </div>
          <div className="px-2 pb-3">
            <ChartBox height={240} empty={benchChart.length === 0} emptyTitle="Select programmes with benchmarks">
              <BarChart data={benchChart} layout="vertical" margin={{ top: 4, right: 40, left: 6, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" domain={[300, 1000]} {...axisProps} />
                <YAxis type="category" dataKey="name" {...axisProps} width={120} />
                <Tooltip {...tooltipProps} formatter={(v, _n, p) => [`${v}/1000 (${p.payload.year}, ${p.payload.src})`, "Benchmark"]} />
                <ReferenceLine x={scenario} stroke="var(--cyan)" strokeWidth={2} label={{ value: hypo !== null ? "Scenario" : "You", fill: "var(--cyan)", fontSize: 11, position: "top" }} />
                <Bar maxBarSize={36} dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {benchChart.map((b) => (
                    <Cell key={b.name} fill={b.src === "official" ? "var(--violet)" : "var(--amber)"} fillOpacity={b.src === "official" ? 0.85 : 0.55} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="var(--ink-3)" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartBox>
            <div className="mt-2 px-2">
              <Legend items={[{ label: "Official benchmark", color: "var(--violet)" }, { label: "Community-reported", color: "var(--amber)" }, { label: scenarioLabel, color: "var(--cyan)" }]} />
              <p className="mt-1 text-xs text-ink-3">Mock marks and GATE scores aren&apos;t interchangeable, so they&apos;re on separate charts. Benchmarks come from different years where noted.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Sources" />
        <ul className="space-y-1 px-4 pb-4 text-[13px]">
          <li>
            <a className="text-cyan hover:underline" href="https://www.iisc.ac.in/wp-content/uploads/2026/04/MTech_MDes_cutoff_2026.pdf" target="_blank" rel="noopener noreferrer">
              IISc M.Tech/M.Des 2026–27 Cut Off Report
            </a>{" "}
            <span className="text-ink-3">— official, dated 3 Apr 2026, retrieved 24 Oct 2026</span>
          </li>
          <li>
            <a className="text-cyan hover:underline" href="https://eecs.iisc.ac.in/wp-content/uploads/2025/02/MTech-CSE.pdf" target="_blank" rel="noopener noreferrer">
              IISc CSA M.Tech (CSE) selection process
            </a>{" "}
            <span className="text-ink-3">— official brochure</span>
          </li>
          <li>
            <a className="text-cyan hover:underline" href="https://www.iisc.ac.in/admissions/m-tech-m-des/" target="_blank" rel="noopener noreferrer">
              IISc M.Tech & M.Des admissions
            </a>
          </li>
          <li>
            <a className="text-cyan hover:underline" href="https://gateoverflow.in/colleges/iisc-bangalore" target="_blank" rel="noopener noreferrer">
              GATE Overflow IISc page
            </a>{" "}
            <span className="text-ink-3">— community-reported CSA 2025 figures, shown only when you include community data</span>
          </li>
        </ul>
      </Panel>

      <Dialog open={!!plan} onClose={() => setPlan(null)} title={plan ? `What would it take: ${plan.p.short}` : ""} description={plan?.p.programme} wide>
        {plan && (
          <div className="space-y-3 text-[13.5px]">
            <p className="font-medium text-ink">{plan.plan.headline}</p>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">
              {plan.plan.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {plan.plan.dataGaps.length > 0 && (
              <div className="rounded-md border border-amber/40 bg-amber-soft p-3 text-[13px] text-amber">
                <p className="font-medium">Missing data</p>
                <ul className="mt-1 list-disc pl-5">
                  {plan.plan.dataGaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.plan.tasks.length > 0 && (
              <div>
                <p className="font-medium">Suggested tasks</p>
                <ul className="mt-1 space-y-1">
                  {plan.plan.tasks.map((t, i) => (
                    <li key={i} className="text-ink-2">
                      {t.title} · {t.minutes} min
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-2"
                  variant="primary"
                  onClick={async () => {
                    let i = 0;
                    for (const t of plan.plan.tasks) await addTask({ date: addDays(today, Math.floor(i++ / 2)), title: t.title, subjectId: t.subjectId, topicId: t.topicId, plannedMin: t.minutes, source: "college", block: 2 });
                    toast({ tone: "success", title: `${plan.plan.tasks.length} tasks added over the next few days` });
                    setPlan(null);
                  }}
                >
                  Add these tasks to my planner
                </Button>
              </div>
            )}
            <p className="text-xs text-ink-3">Built only from your recorded data. Selection also depends on eligibility, category rules, tests/interviews and seats.</p>
          </div>
        )}
      </Dialog>

      <AddProgrammeDialog open={adding} onClose={() => setAdding(false)} />
      {all.length === 0 && <EmptyState title="No programmes" />}
    </div>
  );
}

function AddProgrammeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ institution: "", programme: "", location: "", url: "", cutoffScore: "", cutoffYear: "", cutoffNote: "" });
  const [err, setErr] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add an institution or programme"
      description="Only enter a cut-off you've seen on an official source."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!f.institution.trim() || !f.programme.trim()) return setErr("Institution and programme are required.");
              if (f.url && !/^https?:\/\//.test(f.url)) return setErr("URL must start with http(s)://");
              const c = f.cutoffScore ? Number(f.cutoffScore) : undefined;
              if (c !== undefined && !(c > 0 && c <= 1000)) return setErr("Cut-off must be a GATE score between 1 and 1000.");
              const id = uid("cp");
              await getDb().customProgrammes.put({ id, institution: f.institution.trim(), programme: f.programme.trim(), location: f.location || undefined, url: f.url || undefined, cutoffScore: c, cutoffYear: f.cutoffYear || undefined, cutoffNote: f.cutoffNote || undefined, createdAt: Date.now() });
              await toggleShortlist(id, true);
              toast({ tone: "success", title: "Added to your shortlist" });
              setF({ institution: "", programme: "", location: "", url: "", cutoffScore: "", cutoffYear: "", cutoffNote: "" });
              setErr("");
              onClose();
            }}
          >
            Add programme
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" htmlFor="cp-i">
          <Input id="cp-i" value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />
        </Field>
        <Field label="Programme" htmlFor="cp-p">
          <Input id="cp-p" value={f.programme} onChange={(e) => setF({ ...f, programme: e.target.value })} />
        </Field>
        <Field label="Location" htmlFor="cp-l">
          <Input id="cp-l" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        </Field>
        <Field label="Official admissions URL" htmlFor="cp-u">
          <Input id="cp-u" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        </Field>
        <Field label="Cut-off GATE score (optional)" htmlFor="cp-c">
          <Input id="cp-c" type="number" min={1} max={1000} value={f.cutoffScore} onChange={(e) => setF({ ...f, cutoffScore: e.target.value })} />
        </Field>
        <Field label="Year / round" htmlFor="cp-y">
          <Input id="cp-y" value={f.cutoffYear} onChange={(e) => setF({ ...f, cutoffYear: e.target.value })} placeholder="2026, round 1" />
        </Field>
        <Field label="Note" htmlFor="cp-n" className="sm:col-span-2">
          <Input id="cp-n" value={f.cutoffNote} onChange={(e) => setF({ ...f, cutoffNote: e.target.value })} placeholder="Category, source…" />
        </Field>
        {err && <p className="text-[13px] text-rose sm:col-span-2">{err}</p>}
      </div>
    </Dialog>
  );
}
