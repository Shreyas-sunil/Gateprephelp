import { z } from "zod";
import Papa from "papaparse";
import type { GateCatDB, TableName } from "@/lib/db";
import { TABLE_NAMES } from "@/lib/db";
import type { PyqAttempt, QuestionType, SubjectId } from "@/types";
import { SUBJECTS, TOPICS } from "@/data/syllabus";
import { isYmd, todayIST } from "@/lib/date";
import { uid } from "@/lib/defaults";

export const EXPORT_APP = "gate-cat";
export const EXPORT_VERSION = 1;

const ymd = z.string().refine(isYmd, "Expected YYYY-MM-DD date");
const subjectId = z.enum(["em", "dl", "coa", "pds", "algo", "toc", "cd", "os", "db", "cn", "ga"]);

const rowSchemas: Record<TableName, z.ZodType> = {
  settings: z.looseObject({ id: z.literal("app"), examDate: ymd }),
  progress: z.looseObject({ topicId: z.string(), status: z.enum(["not_started", "learning", "practicing", "revision", "mastered"]) }),
  tasks: z.looseObject({ id: z.string(), date: ymd, title: z.string(), plannedMin: z.number().nonnegative(), status: z.enum(["todo", "done", "skipped"]) }),
  sessions: z.looseObject({ id: z.string(), date: ymd, start: z.number(), end: z.number(), minutes: z.number().nonnegative() }),
  pyqs: z.looseObject({ id: z.string(), subjectId, date: ymd, result: z.enum(["correct", "incorrect", "unattempted"]), qtype: z.enum(["MCQ", "MSQ", "NAT"]) }),
  errors: z.looseObject({ id: z.string(), subjectId, type: z.enum(["A", "B", "C"]), date: ymd, status: z.enum(["open", "resolved"]) }),
  reviews: z.looseObject({ id: z.string(), kind: z.enum(["topic", "error"]), refId: z.string(), due: ymd, history: z.array(z.any()) }),
  mocks: z.looseObject({ id: z.string(), name: z.string(), date: ymd, totalMarks: z.number().positive(), score: z.number() }),
  dayLogs: z.looseObject({ date: ymd, mission: z.array(z.any()) }),
  userResources: z.looseObject({ id: z.string(), name: z.string() }),
  resourceStates: z.looseObject({ id: z.string() }),
  shortlist: z.looseObject({ id: z.string(), pinned: z.boolean() }),
  customProgrammes: z.looseObject({ id: z.string(), institution: z.string(), programme: z.string() }),
  achievements: z.looseObject({ id: z.string(), achievedAt: z.number() }),
  chats: z.looseObject({ id: z.string(), messages: z.array(z.any()) }),
};

export interface ExportFile {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
  timezone: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

export async function exportAll(db: GateCatDB): Promise<ExportFile> {
  const tables: Partial<Record<TableName, unknown[]>> = {};
  for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray();
  return { app: EXPORT_APP, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), timezone: "Asia/Kolkata", tables };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  counts: Partial<Record<TableName, number>>;
  file?: ExportFile;
}

export function validateExport(json: unknown): ValidationResult {
  const errors: string[] = [];
  const top = z.object({ app: z.literal(EXPORT_APP), version: z.number().int().positive(), exportedAt: z.string(), tables: z.record(z.string(), z.array(z.unknown())) }).safeParse(json);
  if (!top.success) return { ok: false, errors: ["This doesn't look like a GATE CAT export (missing app/version/tables)."], counts: {} };
  if (top.data.version > EXPORT_VERSION) errors.push(`Export version ${top.data.version} is newer than this app (${EXPORT_VERSION}).`);
  const counts: Partial<Record<TableName, number>> = {};
  for (const [name, rows] of Object.entries(top.data.tables)) {
    if (!(TABLE_NAMES as readonly string[]).includes(name)) {
      errors.push(`Unknown table “${name}”.`);
      continue;
    }
    const schema = rowSchemas[name as TableName];
    rows.forEach((row, i) => {
      const r = schema.safeParse(row);
      if (!r.success && errors.length < 20) errors.push(`${name}[${i}]: ${r.error.issues[0]?.path.join(".") || "row"} — ${r.error.issues[0]?.message}`);
    });
    counts[name as TableName] = rows.length;
  }
  return { ok: errors.length === 0, errors, counts, file: errors.length === 0 ? (top.data as unknown as ExportFile) : undefined };
}

export async function importAll(db: GateCatDB, file: ExportFile, mode: "replace" | "merge"): Promise<Partial<Record<TableName, number>>> {
  const counts: Partial<Record<TableName, number>> = {};
  await db.transaction("rw", TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = file.tables[name];
      if (mode === "replace") await db.table(name).clear();
      if (rows?.length) {
        await db.table(name).bulkPut(rows);
        counts[name] = rows.length;
      }
    }
  });
  return counts;
}

export async function clearAll(db: GateCatDB): Promise<void> {
  await db.transaction("rw", TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) await db.table(name).clear();
  });
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const flat = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v])));
  return Papa.unparse(flat);
}

// ---------------------------------------------------------------- PYQ CSV import

export const PYQ_CSV_COLUMNS = [
  "date",
  "year",
  "subject",
  "topic",
  "question_no",
  "marks",
  "type",
  "my_answer",
  "correct_answer",
  "result",
  "time_sec",
  "difficulty",
  "error_type",
  "guessed",
  "revisited",
  "notes",
  "solution_url",
] as const;

export const PYQ_CSV_TEMPLATE =
  PYQ_CSV_COLUMNS.join(",") +
  "\n2026-10-24,2023,os,os-sync,Q34,2,MCQ,B,C,incorrect,540,hard,A,false,false,Missed bounded waiting,https://gateoverflow.in/\n2026-10-24,2021,Algorithms,Dynamic programming,Q12,1,NAT,42,42,,300,medium,,false,false,,\n";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveSubject(v: string): SubjectId | undefined {
  const n = norm(v);
  if (!n) return undefined;
  return SUBJECTS.find((s) => norm(s.id) === n || norm(s.name) === n || norm(s.short) === n)?.id;
}

function resolveTopic(v: string, subject?: SubjectId): string | undefined {
  const n = norm(v);
  if (!n) return undefined;
  const pool = subject ? TOPICS.filter((t) => t.subjectId === subject) : TOPICS;
  return pool.find((t) => norm(t.id) === n || norm(t.name) === n)?.id ?? pool.find((t) => norm(t.name).startsWith(n))?.id;
}

const truthy = (v: string) => ["true", "yes", "y", "1"].includes(v.trim().toLowerCase());

export interface PyqCsvResult {
  rows: PyqAttempt[];
  issues: { line: number; message: string }[];
}

export function parsePyqCsv(text: string, now = Date.now()): PyqCsvResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_") });
  const rows: PyqAttempt[] = [];
  const issues: { line: number; message: string }[] = [];
  parsed.data.forEach((r, idx) => {
    const line = idx + 2;
    const get = (k: string) => (r[k] ?? "").trim();
    const subjectId = resolveSubject(get("subject"));
    if (!subjectId) {
      issues.push({ line, message: `Unknown subject “${get("subject")}”` });
      return;
    }
    const topicRaw = get("topic");
    const topicId = resolveTopic(topicRaw, subjectId);
    if (topicRaw && !topicId) issues.push({ line, message: `Topic “${topicRaw}” not matched — row kept without a topic` });
    const typeRaw = get("type").toUpperCase();
    const qtype: QuestionType = typeRaw === "MSQ" || typeRaw === "NAT" ? typeRaw : "MCQ";
    const my = get("my_answer");
    const correctAns = get("correct_answer");
    let result = get("result").toLowerCase() as PyqAttempt["result"] | "";
    if (!["correct", "incorrect", "unattempted"].includes(result)) {
      if (!my) result = "unattempted";
      else if (correctAns) result = norm(my) === norm(correctAns) ? "correct" : "incorrect";
      else {
        issues.push({ line, message: "Missing result and answers — row skipped" });
        return;
      }
    }
    const date = isYmd(get("date")) ? get("date") : todayIST(now);
    const yearN = Number(get("year"));
    const marks = Number(get("marks")) || 1;
    const t = Number(get("time_sec"));
    const diff = get("difficulty").toLowerCase();
    const et = get("error_type").toUpperCase();
    rows.push({
      id: uid("pyq"),
      date,
      year: Number.isInteger(yearN) && yearN > 1980 ? yearN : undefined,
      subjectId,
      topicId,
      questionNo: get("question_no") || undefined,
      marks,
      qtype,
      myAnswer: my || undefined,
      correctAnswer: correctAns || undefined,
      result: result as PyqAttempt["result"],
      timeSec: Number.isFinite(t) && t > 0 ? t : undefined,
      difficulty: diff === "easy" || diff === "medium" || diff === "hard" ? diff : undefined,
      errorType: et === "A" || et === "B" || et === "C" ? et : undefined,
      guessed: truthy(get("guessed")),
      revisited: truthy(get("revisited")),
      notes: get("notes") || undefined,
      solutionUrl: /^https?:\/\//.test(get("solution_url")) ? get("solution_url") : undefined,
      createdAt: now + idx,
    });
  });
  for (const e of parsed.errors.slice(0, 10)) issues.push({ line: (e.row ?? 0) + 2, message: e.message });
  return { rows, issues };
}
