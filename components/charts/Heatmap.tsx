"use client";

import { useState } from "react";
import type { HeatDay } from "@/lib/calc/stats";
import { addDays, fmtDate, fmtMinutes, startOfWeek, weekday, dayName } from "@/lib/date";
import { subjectName } from "@/data/syllabus";
import { cx } from "@/components/ui";

const LEVEL_BG = ["", "rgba(124,108,255,0.28)", "rgba(124,108,255,0.5)", "rgba(124,108,255,0.75)", "var(--violet)"];

function cellStyle(d: HeatDay): { className: string; style?: React.CSSProperties } {
  if (d.state === "studied") return { className: "", style: { background: LEVEL_BG[d.level] } };
  if (d.state === "rest") return { className: "border border-amber/50 bg-amber-soft" };
  if (d.state === "zero") return { className: "bg-surface-3" };
  return { className: "border border-dashed border-line" };
}

export function describeDay(d: HeatDay): string {
  const base = `${dayName(d.date)} ${fmtDate(d.date, { year: true })}`;
  if (d.state === "no-data") return `${base}: no data recorded`;
  if (d.state === "rest") return `${base}: rest day`;
  const parts = [`${fmtMinutes(d.minutes)} studied`];
  if (d.tasksPlanned) parts.push(`${d.tasksDone}/${d.tasksPlanned} tasks done`);
  if (d.subjects.length) parts.push(d.subjects.map((s) => subjectName(s)).join(", "));
  return `${base}: ${parts.join(" · ")}`;
}

/** GitHub-style weekly heatmap (columns = weeks, rows = Mon–Sun). */
export function WeekHeatmap({ days, cell = 13, onSelect }: { days: HeatDay[]; cell?: number; onSelect?: (d: HeatDay) => void }) {
  const [hover, setHover] = useState<HeatDay | null>(null);
  if (!days.length) return null;
  const first = startOfWeek(days[0]!.date);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks: (HeatDay | null)[][] = [];
  let cursor = first;
  const last = days[days.length - 1]!.date;
  while (cursor <= last) {
    const col: (HeatDay | null)[] = [];
    for (let i = 0; i < 7; i++) col.push(byDate.get(addDays(cursor, i)) ?? null);
    weeks.push(col);
    cursor = addDays(cursor, 7);
  }
  const gap = 3;
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col text-[10px] text-ink-3" style={{ gap }} aria-hidden>
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((l, i) => (
            <span key={i} style={{ height: cell, lineHeight: `${cell}px` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="flex" style={{ gap }} role="grid" aria-label="Study activity by day">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col" style={{ gap }} role="row">
              {col.map((d, j) =>
                d ? (
                  <button
                    key={d.date}
                    type="button"
                    role="gridcell"
                    aria-label={describeDay(d)}
                    title={describeDay(d)}
                    onMouseEnter={() => setHover(d)}
                    onFocus={() => setHover(d)}
                    onClick={() => onSelect?.(d)}
                    className={cx("rounded-[3px] transition-transform hover:scale-110", cellStyle(d).className)}
                    style={{ width: cell, height: cell, ...cellStyle(d).style }}
                  />
                ) : (
                  <span key={j} style={{ width: cell, height: cell }} aria-hidden />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-h-[18px] text-xs text-ink-2">{hover ? describeDay(hover) : "Hover or focus a day for details."}</p>
        <HeatLegend />
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-dashed border-line" /> No data
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-surface-3" /> 0 min recorded
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-amber/50 bg-amber-soft" /> Rest day
      </span>
      <span className="flex items-center gap-1">
        Less
        {LEVEL_BG.slice(1).map((c) => (
          <span key={c} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        More
      </span>
    </div>
  );
}

/** Calendar month grid (Mon-first). */
export function MonthHeatmap({ days, onSelect }: { days: HeatDay[]; onSelect?: (d: HeatDay) => void }) {
  if (!days.length) return null;
  const lead = (weekday(days[0]!.date) + 6) % 7;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3" aria-hidden>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={"l" + i} />
        ))}
        {days.map((d) => {
          const s = cellStyle(d);
          return (
            <button key={d.date} type="button" title={describeDay(d)} aria-label={describeDay(d)} onClick={() => onSelect?.(d)} className={cx("flex aspect-square flex-col items-center justify-center rounded-md text-[11px]", s.className)} style={s.style}>
              <span className={cx("num", d.level >= 3 ? "text-white" : "text-ink-2")}>{Number(d.date.slice(8))}</span>
              {d.minutes > 0 && <span className={cx("num text-[9.5px]", d.level >= 3 ? "text-white/80" : "text-ink-3")}>{fmtMinutes(d.minutes)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
