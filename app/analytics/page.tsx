"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { PageHeader, PageSkeleton, Segmented } from "@/components/ui";
import { WhatNext } from "@/components/dashboard/WhatNext";
import {
  AccuracyPanel,
  ConsistencyPanel,
  ErrorDistributionPanel,
  FiveSecondSummary,
  FunnelPanel,
  HoursPanel,
  MockScorePanel,
  ParetoPanel,
  ProgressRingPanel,
  RadarPanel,
  ReadinessPanel,
  RevisionHealthPanel,
  SubjectBarsPanel,
  TopicMatrixPanel,
} from "@/components/analytics/Charts";

type Tab = "growth" | "weakness" | "readiness";

function AnalyticsInner() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "growth");
  if (!data || !a) return <PageSkeleton />;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Every chart reads your saved records. Planned, recorded and estimated values are labelled; nothing is simulated."
        actions={<Segmented label="Analytics section" value={tab} onChange={setTab} options={[{ value: "growth", label: "Growth" }, { value: "weakness", label: "Weaknesses" }, { value: "readiness", label: "Readiness" }]} />}
      />
      <FiveSecondSummary data={data} a={a} />
      {tab === "growth" && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ProgressRingPanel a={a} />
            <WhatNext />
          </div>
          <ConsistencyPanel data={data} today={today} />
          <HoursPanel data={data} today={today} />
          <div className="grid gap-5 lg:grid-cols-2">
            <MockScorePanel data={data} />
            <AccuracyPanel data={data} />
          </div>
          <SubjectBarsPanel a={a} />
          <TopicMatrixPanel a={a} />
        </>
      )}
      {tab === "weakness" && (
        <>
          <ErrorDistributionPanel data={data} today={today} />
          <ParetoPanel data={data} today={today} />
          <RevisionHealthPanel data={data} a={a} />
          <WhatNext />
        </>
      )}
      {tab === "readiness" && (
        <>
          <ReadinessPanel data={data} a={a} />
          <div className="grid gap-5 lg:grid-cols-2">
            <FunnelPanel a={a} />
            <RadarPanel a={a} />
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnalyticsInner />
    </Suspense>
  );
}
