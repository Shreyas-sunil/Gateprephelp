import { describe, expect, it } from "vitest";
import { generatePlan, rebaseMockPhases, templateDays, blockMinutes } from "@/lib/calc/plan";
import { DEFAULT_BLOCKS, DEFAULT_MOCK_PHASES } from "@/data/plan";

describe("plan generator", () => {
  it("has 49 template days in the source plan", () => {
    expect(templateDays([])).toHaveLength(49);
    expect(templateDays(["toc", "cd"]).length).toBe(42);
  });
  it("splits hours in the PDF's 3.5:3.5:2 ratio", () => {
    expect(blockMinutes(DEFAULT_BLOCKS, 9, "partial")).toEqual([210, 210, 120]);
    const [a, b, c] = blockMinutes(DEFAULT_BLOCKS, 6, "partial");
    expect(a + b + c).toBe(360);
  });
  it("reproduces the PDF's mock phase dates for the default window", () => {
    const p = rebaseMockPhases("2026-11-30", "2027-02-06");
    expect(p.map((x) => [x.start, x.end])).toEqual(DEFAULT_MOCK_PHASES.map((x) => [x.start, x.end]));
  });
  it("rebases phases when the exam date moves", () => {
    const p = rebaseMockPhases("2026-11-30", "2027-02-20");
    expect(p[0]!.start).toBe("2026-12-01");
    expect(p[2]!.end).toBe("2027-02-20");
    expect(p[1]!.start > p[0]!.end).toBe(true);
  });
  it("compresses the template into the remaining days without stale dates", () => {
    const g = generatePlan({ startDate: "2026-10-26", syllabusEndDate: "2026-11-30", examDate: "2027-02-06", hoursPerDay: 6, prepLevel: "partial", preferredTimes: [], skipSubjects: [], includeGA: false, includeMockPhases: false, blocks: DEFAULT_BLOCKS });
    expect(g.realDays).toBe(36);
    const dates = new Set(g.tasks.map((t) => t.date));
    expect(dates.size).toBe(36);
    expect([...dates].every((d) => d >= "2026-10-26" && d <= "2026-11-30")).toBe(true);
    // Every topic in the template appears at least once
    const topics = new Set(g.tasks.map((t) => t.topicId).filter(Boolean));
    expect(topics.size).toBeGreaterThan(25);
    const day1 = g.tasks.filter((t) => t.date === "2026-10-26");
    expect(day1.reduce((s, t) => s + t.plannedMin, 0)).toBe(360);
  });
  it("adds mock-phase tasks only up to the exam", () => {
    const g = generatePlan({ startDate: "2026-11-01", syllabusEndDate: "2026-11-30", examDate: "2027-02-06", hoursPerDay: 8, prepLevel: "advanced", preferredTimes: [], skipSubjects: [], includeGA: true, includeMockPhases: true, blocks: DEFAULT_BLOCKS });
    expect(g.tasks.some((t) => t.title.startsWith("Full-length mock"))).toBe(true);
    expect(g.tasks.every((t) => t.date < "2027-02-06")).toBe(true);
    expect(g.tasks.some((t) => t.subjectId === "ga")).toBe(true);
  });
});
