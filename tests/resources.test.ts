import { describe, expect, it } from "vitest";
import { BUILTIN_RESOURCES, SUBJECT_LINKS, videoForTopic } from "@/data/resources";
import { TOPIC_MAP } from "@/data/syllabus";
import { generatePlan } from "@/lib/calc/plan";
import { DEFAULT_BLOCKS } from "@/data/plan";

describe("resource library", () => {
  it("has unique ids, valid links and known topics", () => {
    const ids = BUILTIN_RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of BUILTIN_RESOURCES) {
      if (r.url) expect(r.url.startsWith("/") || r.url.startsWith("https://")).toBe(true);
      for (const t of r.topicIds) expect(TOPIC_MAP[t]).toBeDefined();
    }
  });
  it("has a YouTube playlist for every technical subject and practicepaper.in for tests", () => {
    for (const sid of ["em", "dl", "coa", "pds", "algo", "toc", "cd", "os", "db", "cn"]) expect(SUBJECT_LINKS[sid]?.video).toMatch(/^https:\/\/www\.youtube\.com\/playlist\?list=/);
    expect(BUILTIN_RESOURCES.find((r) => r.id === "full-length-mocks")?.url).toContain("practicepaper.in");
    expect(videoForTopic("em-eigen", "em")).toContain("PLIPZ2_p3RNHhGLQ1ZT37KLpBMAD90CM4_");
    expect(videoForTopic("em-sets", "em")).toContain("PLIPZ2_p3RNHgjPQN2GtCVOCgrkH2zCkSU");
  });
  it("attaches lecture and practice links to generated plan tasks", () => {
    const g = generatePlan({ startDate: "2026-10-26", syllabusEndDate: "2026-11-30", examDate: "2027-02-06", hoursPerDay: 6, prepLevel: "partial", preferredTimes: [], skipSubjects: [], includeGA: false, includeMockPhases: true, blocks: DEFAULT_BLOCKS });
    const theory = g.tasks.filter((t) => t.block === 1 && t.title.startsWith("Theory"));
    expect(theory.every((t) => t.link?.includes("youtube.com"))).toBe(true);
    expect(g.tasks.filter((t) => t.title.startsWith("PYQ sprint")).every((t) => t.link?.includes("practicepaper.in"))).toBe(true);
    expect(g.tasks.filter((t) => t.title.startsWith("Full-length mock")).every((t) => t.link?.includes("practicepaper.in"))).toBe(true);
  });
});
