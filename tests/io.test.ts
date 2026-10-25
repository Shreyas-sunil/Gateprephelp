import { describe, expect, it, beforeEach } from "vitest";
import { GateCatDB, setDb } from "@/lib/db";
import { exportAll, importAll, validateExport, parsePyqCsv, PYQ_CSV_TEMPLATE, clearAll } from "@/lib/io";
import { defaultSettings } from "@/lib/defaults";

let db: GateCatDB;
beforeEach(async () => {
  db = new GateCatDB("test-" + Math.random());
  setDb(db);
  await db.open();
});

describe("export / import", () => {
  it("round-trips all data", async () => {
    await db.settings.put({ ...defaultSettings(), onboarded: true });
    await db.progress.put({ topicId: "os-sync", status: "practicing", confidence: 3, manualAttempted: 0, manualCorrect: 0, notes: "semaphores", bookmarks: [], statusHistory: [], updatedAt: 1 });
    await db.tasks.put({ id: "t1", date: "2026-10-24", title: "Paging", plannedMin: 60, status: "done", order: 0, source: "manual", createdAt: 1, postponedCount: 0 });
    const file = await exportAll(db);
    const json = JSON.parse(JSON.stringify(file));
    const v = validateExport(json);
    expect(v.ok).toBe(true);
    expect(v.counts.tasks).toBe(1);

    await clearAll(db);
    expect(await db.tasks.count()).toBe(0);
    await importAll(db, v.file!, "replace");
    expect((await db.progress.get("os-sync"))!.notes).toBe("semaphores");
    expect((await db.settings.get("app"))!.onboarded).toBe(true);
  });

  it("merges without deleting existing rows", async () => {
    await db.tasks.put({ id: "keep", date: "2026-10-24", title: "A", plannedMin: 10, status: "todo", order: 0, source: "manual", createdAt: 1, postponedCount: 0 });
    const file = { app: "gate-cat" as const, version: 1, exportedAt: "x", timezone: "Asia/Kolkata", tables: { tasks: [{ id: "new", date: "2026-10-25", title: "B", plannedMin: 10, status: "todo", order: 0, source: "manual", createdAt: 1, postponedCount: 0 }] } };
    await importAll(db, file, "merge");
    expect(await db.tasks.count()).toBe(2);
  });

  it("rejects invalid files with readable errors", () => {
    expect(validateExport({ hello: 1 }).ok).toBe(false);
    const bad = validateExport({ app: "gate-cat", version: 1, exportedAt: "x", tables: { tasks: [{ id: "t", date: "24/10/2026", title: "x", plannedMin: 5, status: "todo" }] } });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toMatch(/tasks\[0\]: date/);
  });
});

describe("PYQ CSV import", () => {
  it("parses the template, resolving subjects/topics by id or name", () => {
    const r = parsePyqCsv(PYQ_CSV_TEMPLATE);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ subjectId: "os", topicId: "os-sync", result: "incorrect", errorType: "A", marks: 2, year: 2023 });
    expect(r.rows[1]).toMatchObject({ subjectId: "algo", topicId: "algo-dp", result: "correct", qtype: "NAT" });
  });
  it("reports unknown subjects and skips the row", () => {
    const r = parsePyqCsv("subject,result\nAstrology,correct\nOS,correct");
    expect(r.rows).toHaveLength(1);
    expect(r.issues[0]!.message).toMatch(/Unknown subject/);
  });
});
