import { describe, expect, it } from "vitest";
import { computeTopicStats, computeSubjectStats, computeOverall, accuracyOf } from "@/lib/calc/progress";
import { TOPICS, topicsForSubject } from "@/data/syllabus";
import { emptyData, prog, pyq } from "./helpers";
import type { ReviewItem } from "@/types";

describe("syllabus dataset", () => {
  it("has all eleven groups with granular topics", () => {
    const subjects = new Set(TOPICS.map((t) => t.subjectId));
    expect(subjects.size).toBe(11);
    expect(topicsForSubject("em").length).toBeGreaterThan(30);
    const names = TOPICS.map((t) => t.name.toLowerCase()).join("|");
    for (const kw of ["lattices", "monoids", "eigenvalues", "karnaugh", "cache", "heaps", "dynamic programming", "pumping lemma", "liveness", "virtual memory", "normal forms", "cidr", "dns", "http", "socket"]) {
      expect(names).toContain(kw);
    }
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
  });
});

describe("progress calculations", () => {
  it("weights accuracy by attempts, not by averaging percentages", () => {
    expect(accuracyOf({ attempted: 0, correct: 0 })).toBeNull();
    const d = emptyData();
    d.pyqs = [pyq({ topicId: "os-sync", result: "correct" }), pyq({ topicId: "os-sync", result: "incorrect" }), pyq({ topicId: "os-deadlock", result: "correct" }), pyq({ topicId: "os-deadlock", result: "unattempted" })];
    for (let i = 0; i < 6; i++) d.pyqs.push(pyq({ topicId: "os-memory", result: "correct" }));
    const stats = computeTopicStats(d);
    expect(stats.get("os-sync")!.accuracy).toBe(50);
    expect(stats.get("os-deadlock")!.attempted).toBe(1); // unattempted excluded
    const os = computeSubjectStats(stats).find((s) => s.subjectId === "os")!;
    // 8 correct of 9 attempted, not mean(50,100,100)
    expect(os.attempted).toBe(9);
    expect(os.accuracy).toBeCloseTo((8 / 9) * 100);
  });

  it("derives completion from topic records and requires evidence for mastery", () => {
    const d = emptyData();
    d.progress.set("os-sync", prog("os-sync", { status: "mastered", confidence: 5 }));
    d.progress.set("os-deadlock", prog("os-deadlock", { status: "practicing" }));
    d.progress.set("os-threads", prog("os-threads", { status: "learning" }));
    let overall = computeOverall(computeTopicStats(d));
    expect(overall.covered).toBe(2);
    expect(overall.mastered).toBe(0); // marked mastered but no PYQ evidence or review
    expect(overall.completionPct).toBeCloseTo((2 / TOPICS.length) * 100);

    d.progress.set("os-sync", prog("os-sync", { status: "mastered", confidence: 5, manualAttempted: 20, manualCorrect: 16 }));
    const review: ReviewItem = { id: "r", kind: "topic", refId: "os-sync", intervalDays: 3, ease: 2.5, reps: 1, lapses: 0, due: "2026-10-30", createdAt: 0, history: [{ date: "2026-10-20", grade: "good", intervalBefore: 1, intervalAfter: 3, dueBefore: "2026-10-20", onTime: true }] };
    d.reviews = [review];
    const stats = computeTopicStats(d);
    expect(stats.get("os-sync")!.meetsMastery).toBe(true);
    expect(stats.get("os-sync")!.stage).toBe("mastered");
    overall = computeOverall(stats);
    expect(overall.mastered).toBe(1);
    expect(overall.stageCounts.learning).toBe(1);
    expect(overall.stageCounts.practicing).toBe(1);
  });

  it("caps manual correct at manual attempted", () => {
    const d = emptyData();
    d.progress.set("cn-cidr", prog("cn-cidr", { manualAttempted: 5, manualCorrect: 9 }));
    expect(computeTopicStats(d).get("cn-cidr")!.accuracy).toBe(100);
  });
});
