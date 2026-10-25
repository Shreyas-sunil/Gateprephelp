import { describe, expect, it } from "vitest";
import { rollingAverage, aggregateHours, computeStreaks, heatmapDays, accuracyTimeline, recentVsEarlier } from "@/lib/calc/stats";
import { pyq, session } from "./helpers";
import type { Task } from "@/types";

describe("rolling average", () => {
  it("is trailing and respects min periods", () => {
    expect(rollingAverage([10, 20, 30, 40], 3)).toEqual([null, null, 20, 30]);
    expect(rollingAverage([10, 20, 30], 3, 1)).toEqual([10, 15, 20]);
    expect(rollingAverage([10, null, 30], 2, 1)).toEqual([10, 10, 30]);
  });
});

describe("study hour aggregation", () => {
  const sessions = [session("2026-10-19", 60), session("2026-10-19", 30, { subjectId: "os" }), session("2026-10-21", 90, { subjectId: "os" }), session("2026-10-27", 45)];
  const tasks: Task[] = [
    { id: "t1", date: "2026-10-19", title: "x", plannedMin: 120, status: "todo", order: 0, source: "manual", createdAt: 0, postponedCount: 0 },
    { id: "t2", date: "2026-10-20", title: "y", plannedMin: 60, status: "skipped", order: 0, source: "manual", createdAt: 0, postponedCount: 0 },
  ];
  it("aggregates by day with planned vs actual", () => {
    const b = aggregateHours(sessions, tasks, "2026-10-19", "2026-10-21", "day");
    expect(b.map((x) => x.actualMin)).toEqual([90, 0, 90]);
    expect(b.map((x) => x.plannedMin)).toEqual([120, 0, 0]); // skipped excluded
  });
  it("aggregates by week and filters by subject", () => {
    const b = aggregateHours(sessions, tasks, "2026-10-19", "2026-11-01", "week");
    expect(b.map((x) => x.actualMin)).toEqual([180, 45]);
    const os = aggregateHours(sessions, tasks, "2026-10-19", "2026-11-01", "week", "os");
    expect(os.map((x) => x.actualMin)).toEqual([120, 0]);
  });
});

describe("streaks", () => {
  it("counts consecutive qualifying days and doesn't break before today ends", () => {
    const s = [session("2026-10-20", 40), session("2026-10-21", 35), session("2026-10-22", 10), session("2026-10-22", 25), session("2026-10-23", 60)];
    const r = computeStreaks(s, "2026-10-24", 30);
    expect(r.current).toBe(4);
    expect(r.studiedToday).toBe(false);
    expect(r.best).toBe(4);
    const broken = computeStreaks(s, "2026-10-26", 30);
    expect(broken.current).toBe(0);
    expect(broken.best).toBe(4);
  });
  it("is zero with no data", () => {
    expect(computeStreaks([], "2026-10-24", 30)).toEqual({ current: 0, best: 0, studiedToday: false, qualifyingDays: 0 });
  });
});

describe("heatmap", () => {
  it("distinguishes no data, zero study and rest days", () => {
    const tasks: Task[] = [{ id: "t", date: "2026-10-21", title: "x", plannedMin: 60, status: "todo", order: 0, source: "manual", createdAt: 0, postponedCount: 0 }];
    const days = heatmapDays([session("2026-10-20", 200)], tasks, [{ date: "2026-10-22", restDay: true, mission: [] }], "2026-10-20", "2026-10-23", 360);
    expect(days.map((d) => d.state)).toEqual(["studied", "zero", "rest", "no-data"]);
    expect(days[0]!.level).toBe(2);
  });
});

describe("accuracy timeline", () => {
  it("keeps attempt counts per bucket", () => {
    const pts = accuracyTimeline([pyq({ date: "2026-10-01" }), pyq({ date: "2026-10-01", result: "incorrect" }), pyq({ date: "2026-10-02" }), pyq({ date: "2026-10-02", result: "unattempted" })], "day");
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ attempted: 2, accuracy: 50, cumulativeAccuracy: 50 });
    expect(pts[1]).toMatchObject({ attempted: 1, accuracy: 100 });
    expect(pts[1]!.cumulativeAccuracy).toBeCloseTo(66.67, 1);
  });
  it("needs 2n attempts to compare windows", () => {
    expect(recentVsEarlier([pyq({})], 5)).toBeNull();
    const list = [...Array(5)].map((_, i) => pyq({ date: "2026-10-0" + (i + 1), result: "incorrect" })).concat([...Array(5)].map((_, i) => pyq({ date: "2026-10-1" + i })));
    expect(recentVsEarlier(list, 5)).toMatchObject({ recent: 100, earlier: 0, delta: 100 });
  });
});
