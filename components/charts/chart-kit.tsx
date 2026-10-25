"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

export const CHART = {
  grid: "var(--chart-grid)",
  axis: "var(--ink-3)",
  actual: "var(--violet)",
  planned: "var(--ink-3)",
  avg: "var(--cyan)",
  target: "var(--amber)",
  good: "var(--mint)",
  bad: "var(--rose)",
};

export const axisProps = {
  stroke: "var(--line-strong)",
  tick: { fill: "var(--ink-3)", fontSize: 11.5 },
  tickLine: false,
  axisLine: false,
} as const;

export const tooltipProps = {
  contentStyle: {
    background: "var(--surface-2)",
    border: "1px solid var(--line-strong)",
    borderRadius: 8,
    fontSize: 12.5,
    color: "var(--ink)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  },
  labelStyle: { color: "var(--ink)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--ink-2)", padding: 0 },
  cursor: { fill: "var(--violet-soft)", stroke: "var(--line-strong)" },
} as const;

export function ChartBox({ height = 240, empty, emptyTitle = "No data yet", emptyBody, children }: { height?: number; empty?: boolean; emptyTitle?: string; emptyBody?: ReactNode; children: ReactNode }) {
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-4 text-center" style={{ height }}>
        <BarChart3 size={18} className="text-ink-3" />
        <p className="text-[13px] font-medium text-ink-2">{emptyTitle}</p>
        {emptyBody && <p className="max-w-xs text-xs text-ink-3">{emptyBody}</p>}
      </div>
    );
  }
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-4 rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
