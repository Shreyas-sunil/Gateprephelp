import { describe, expect, it } from "vitest";
import { errorDistribution, pareto, recurringWarnings } from "@/lib/calc/errors";
import type { ErrorEntry } from "@/types";

let i = 0;
const err = (p: Partial<ErrorEntry>): ErrorEntry => ({
  id: "e" + ++i, questionRef: "q", source: "pyq", subjectId: "os", type: "A", marksLost: 0, originalThought: "", whyWrong: "", correctReasoning: "", rule: "", correctiveAction: "", repeatCount: 0, status: "open", date: "2026-10-20", createdAt: i, ...p,
});

describe("error analytics", () => {
  it("computes type distribution with percentages and marks", () => {
    const d = errorDistribution([err({ type: "A", marksLost: 2 }), err({ type: "A", marksLost: 1 }), err({ type: "B", marksLost: 2 }), err({ type: "C" })]);
    expect(d.total).toBe(4);
    expect(d.types.find((t) => t.type === "A")).toMatchObject({ count: 2, pct: 50, marks: 3 });
    expect(d.types.find((t) => t.type === "C")!.pct).toBe(25);
    expect(errorDistribution([]).types.every((t) => t.pct === 0)).toBe(true);
  });
  it("builds a Pareto ranking by marks lost with cumulative share", () => {
    const p = pareto([err({ topicId: "a", marksLost: 6 }), err({ topicId: "b", marksLost: 3 }), err({ topicId: "a", marksLost: 0 }), err({ topicId: "c", marksLost: 1 })], (e) => e.topicId);
    expect(p.basis).toBe("marks");
    expect(p.rows.map((r) => r.key)).toEqual(["a", "b", "c"]);
    expect(p.rows[0]).toMatchObject({ value: 6, count: 2, cumulativePct: 60 });
    expect(p.rows[2]!.cumulativePct).toBe(100);
  });
  it("falls back to counts when no marks are recorded", () => {
    const p = pareto([err({ topicId: "a", repeatCount: 2 }), err({ topicId: "b" })], (e) => e.topicId);
    expect(p.basis).toBe("count");
    expect(p.rows[0]).toMatchObject({ key: "a", value: 3 });
  });
  it("warns about recurring topics in the window only", () => {
    const list = [err({ topicId: "os-sync", type: "A" }), err({ topicId: "os-sync", type: "A" }), err({ topicId: "cn-cidr", date: "2026-08-01" }), err({ topicId: "cn-cidr", date: "2026-08-02" }), err({ topicId: "cn-cidr", date: "2026-08-03" })];
    const w = recurringWarnings(list, "2026-10-24");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ topicId: "os-sync", type: "A" });
  });
});
