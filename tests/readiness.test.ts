import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/calc/readiness";
import { computeOverall, computeTopicStats } from "@/lib/calc/progress";
import { defaultSettings } from "@/lib/defaults";
import { emptyData, session } from "./helpers";
import type { MockTest } from "@/types";

const mock = (date: string, score: number): MockTest => ({ id: date, name: "M", kind: "full", date, totalMarks: 100, score, correct: 0, incorrect: 0, unattempted: 0, subjectMarks: [], weakTopicIds: [], lostMarks: { A: 0, B: 0, C: 0, unattempted: 0 }, rounds: [], actions: [], createdAt: 0 });

describe("readiness scorecard", () => {
  it("reports insufficient data instead of a misleading composite", () => {
    const d = emptyData();
    const r = computeReadiness({ overall: computeOverall(computeTopicStats(d)), pyqAttempted: 0, pyqCorrect: 0, mocks: [], reviews: [], sessions: [], settings: d.settings, today: "2026-10-24" });
    expect(r.composite).toBeNull();
    expect(r.reason).toMatch(/Insufficient data/);
    expect(r.components.find((c) => c.key === "pyq")!.value).toBeNull();
  });
  it("computes a weighted composite over sufficient components only", () => {
    const d = emptyData();
    const sessions = [];
    for (let i = 0; i < 14; i++) sessions.push(session(`2026-10-${String(11 + i).padStart(2, "0")}`, i % 2 ? 60 : 10));
    const overall = computeOverall(computeTopicStats(d));
    const settings = defaultSettings();
    const r = computeReadiness({ overall, pyqAttempted: 40, pyqCorrect: 30, mocks: [mock("2026-10-01", 40), mock("2026-10-10", 60)], reviews: [], sessions, settings, today: "2026-10-24" });
    const byKey = Object.fromEntries(r.components.map((c) => [c.key, c]));
    expect(byKey.pyq!.value).toBe(75);
    expect(byKey.mock!.value).toBe(50);
    expect(byKey.consistency!.value).toBe(50);
    expect(byKey.revision!.sufficient).toBe(false);
    // coverage 0 (w15), mastery 0 (w20), pyq 75 (w20), mock 50 (w25), consistency 50 (w10)
    const expected = (0 * 15 + 0 * 20 + 75 * 20 + 50 * 25 + 50 * 10) / (15 + 20 + 20 + 25 + 10);
    expect(r.composite).toBeCloseTo(expected);
  });
});
