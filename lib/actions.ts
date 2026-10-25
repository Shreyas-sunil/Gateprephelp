import { getDb } from "@/lib/db";
import { defaultSettings, emptyProgress, normalizeSettings, uid } from "@/lib/defaults";
import { addDays, todayIST } from "@/lib/date";
import { applyReview, newReviewItem } from "@/lib/calc/srs";
import type {
  DayLog,
  ErrorEntry,
  Grade,
  MissionItem,
  MockTest,
  PyqAttempt,
  ResourceState,
  ReviewItem,
  Settings,
  StudySession,
  SubjectId,
  Task,
  TopicProgress,
  TopicStatus,
} from "@/types";
import { TOPIC_MAP } from "@/data/syllabus";

const db = () => getDb();

export async function loadSettings(): Promise<Settings> {
  const s = await db().settings.get("app");
  return normalizeSettings(s);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await loadSettings();
  await db().settings.put({ ...cur, ...patch, id: "app", updatedAt: Date.now() });
}

export async function resetSettings(): Promise<void> {
  const cur = await loadSettings();
  await db().settings.put({ ...defaultSettings(), onboarded: cur.onboarded, planStartDate: cur.planStartDate, lastActive: cur.lastActive });
}

export async function touchLastActive(topicId?: string, subjectId?: SubjectId) {
  const cur = await loadSettings();
  await db().settings.put({ ...cur, lastActive: { topicId, subjectId: subjectId ?? (topicId ? TOPIC_MAP[topicId]?.subjectId : undefined), at: Date.now() } });
}

// ---------------- Topics

export async function updateProgress(topicId: string, patch: Partial<TopicProgress>): Promise<void> {
  const cur = (await db().progress.get(topicId)) ?? emptyProgress(topicId);
  const today = todayIST();
  const next: TopicProgress = { ...cur, ...patch, topicId, updatedAt: Date.now() };
  if (patch.status && patch.status !== cur.status) {
    next.statusHistory = [...cur.statusHistory, { date: today, status: patch.status }];
    if (patch.status !== "not_started" && !patch.lastStudied) next.lastStudied = today;
  }
  await db().progress.put(next);
  if (patch.status === "revision" || (patch.status === "mastered" && cur.status !== "mastered")) {
    await ensureReview("topic", topicId, patch.status === "revision" ? today : addDays(today, 3));
  }
}

export async function setTopicStatus(topicId: string, status: TopicStatus) {
  await updateProgress(topicId, { status });
  await touchLastActive(topicId);
}

// ---------------- Reviews

export async function ensureReview(kind: ReviewItem["kind"], refId: string, due: string): Promise<ReviewItem> {
  const existing = await db().reviews.where("refId").equals(refId).filter((r) => r.kind === kind).first();
  const s = await loadSettings();
  if (existing) {
    if (existing.suspended || existing.due > due) {
      const upd = { ...existing, suspended: false, due: existing.due > due ? due : existing.due };
      await db().reviews.put(upd);
      return upd;
    }
    return existing;
  }
  const item = newReviewItem(uid("rev"), kind, refId, due, s.srs);
  await db().reviews.put(item);
  if (kind === "topic") {
    const p = (await db().progress.get(refId)) ?? emptyProgress(refId);
    await db().progress.put({ ...p, nextRevision: due, updatedAt: Date.now() });
  }
  return item;
}

export async function gradeReview(id: string, grade: Grade): Promise<ReviewItem | undefined> {
  const item = await db().reviews.get(id);
  if (!item) return;
  const s = await loadSettings();
  const today = todayIST();
  const next = applyReview(item, grade, today, s.srs);
  await db().reviews.put(next);
  if (item.kind === "topic") {
    const p = (await db().progress.get(item.refId)) ?? emptyProgress(item.refId);
    await db().progress.put({ ...p, lastStudied: today, nextRevision: next.due, updatedAt: Date.now() });
  } else {
    const e = await db().errors.get(item.refId);
    if (e) await db().errors.put({ ...e, reviewDate: next.due, repeatCount: grade === "again" ? e.repeatCount + 1 : e.repeatCount });
  }
  return next;
}

export async function rescheduleReview(id: string, due: string) {
  const item = await db().reviews.get(id);
  if (!item) return;
  await db().reviews.put({ ...item, due });
  if (item.kind === "topic") {
    const p = (await db().progress.get(item.refId)) ?? emptyProgress(item.refId);
    await db().progress.put({ ...p, nextRevision: due, updatedAt: Date.now() });
  }
}

export async function removeReview(id: string) {
  await db().reviews.delete(id);
}

// ---------------- Tasks

export async function addTask(t: Partial<Task> & Pick<Task, "title" | "date">): Promise<Task> {
  const count = await db().tasks.where("date").equals(t.date).count();
  const task: Task = {
    id: uid("task"),
    plannedMin: 60,
    status: "todo",
    order: count,
    source: "manual",
    createdAt: Date.now(),
    postponedCount: 0,
    ...t,
  };
  await db().tasks.put(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const t = await db().tasks.get(id);
  if (!t) return;
  const next = { ...t, ...patch };
  if (patch.status === "done" && t.status !== "done") next.completedAt = Date.now();
  if (patch.status && patch.status !== "done") next.completedAt = undefined;
  await db().tasks.put(next);
  if (patch.status === "done" && t.topicId) {
    const p = (await db().progress.get(t.topicId)) ?? emptyProgress(t.topicId);
    await db().progress.put({ ...p, lastStudied: t.date > (p.lastStudied ?? "") ? t.date : p.lastStudied, updatedAt: Date.now() });
  }
}

export async function moveTask(id: string, date: string) {
  const t = await db().tasks.get(id);
  if (!t || t.date === date) return;
  await db().tasks.put({ ...t, date, postponedCount: date > t.date ? t.postponedCount + 1 : t.postponedCount });
}

export async function deleteTask(id: string) {
  await db().tasks.delete(id);
}

export async function rescheduleMissed(ids: string[], toDate: string) {
  await db().transaction("rw", db().tasks, async () => {
    for (const id of ids) {
      const t = await db().tasks.get(id);
      if (t) await db().tasks.put({ ...t, date: toDate, postponedCount: t.postponedCount + 1 });
    }
  });
}

export async function replacePlanTasks(newTasks: Task[], fromDate: string) {
  await db().transaction("rw", db().tasks, async () => {
    const old = await db().tasks.where("date").aboveOrEqual(fromDate).filter((t) => t.source === "plan" && t.status === "todo").primaryKeys();
    await db().tasks.bulkDelete(old);
    await db().tasks.bulkPut(newTasks);
  });
}

// ---------------- Sessions

export async function logSession(s: Omit<StudySession, "id">): Promise<StudySession> {
  const session: StudySession = { id: uid("ses"), ...s };
  await db().sessions.put(session);
  if (s.topicId) {
    const p = (await db().progress.get(s.topicId)) ?? emptyProgress(s.topicId);
    const next: TopicProgress = { ...p, lastStudied: s.date > (p.lastStudied ?? "") ? s.date : p.lastStudied, updatedAt: Date.now() };
    if (p.status === "not_started") {
      next.status = "learning";
      next.statusHistory = [...p.statusHistory, { date: s.date, status: "learning" }];
    }
    await db().progress.put(next);
    await touchLastActive(s.topicId);
  }
  return session;
}

export async function deleteSession(id: string) {
  await db().sessions.delete(id);
}

// ---------------- PYQs

export async function addPyq(p: Omit<PyqAttempt, "id" | "createdAt">): Promise<PyqAttempt> {
  const row: PyqAttempt = { ...p, id: uid("pyq"), createdAt: Date.now() };
  await db().pyqs.put(row);
  if (p.topicId) {
    const prog = (await db().progress.get(p.topicId)) ?? emptyProgress(p.topicId);
    await db().progress.put({ ...prog, lastStudied: p.date > (prog.lastStudied ?? "") ? p.date : prog.lastStudied, updatedAt: Date.now() });
  }
  return row;
}

export async function updatePyq(id: string, patch: Partial<PyqAttempt>) {
  const r = await db().pyqs.get(id);
  if (r) await db().pyqs.put({ ...r, ...patch });
}

export async function deletePyq(id: string) {
  await db().pyqs.delete(id);
}

export async function bulkAddPyqs(rows: PyqAttempt[]) {
  await db().pyqs.bulkPut(rows);
}

// ---------------- Errors

export async function addError(e: Omit<ErrorEntry, "id" | "createdAt">): Promise<ErrorEntry> {
  const row: ErrorEntry = { ...e, id: uid("err"), createdAt: Date.now() };
  await db().errors.put(row);
  if (row.status === "open") await ensureReview("error", row.id, row.reviewDate ?? addDays(row.date, 1));
  return row;
}

export async function updateError(id: string, patch: Partial<ErrorEntry>) {
  const e = await db().errors.get(id);
  if (!e) return;
  const next = { ...e, ...patch };
  if (patch.status === "resolved" && e.status !== "resolved") next.resolvedAt = Date.now();
  await db().errors.put(next);
  const rev = await db().reviews.where("refId").equals(id).first();
  if (rev) await db().reviews.put({ ...rev, suspended: next.status === "resolved", due: patch.reviewDate ?? rev.due });
  else if (next.status === "open") await ensureReview("error", id, next.reviewDate ?? todayIST());
}

export async function deleteError(id: string) {
  await db().errors.delete(id);
  const revs = await db().reviews.where("refId").equals(id).primaryKeys();
  await db().reviews.bulkDelete(revs);
}

// ---------------- Mocks

export async function saveMock(m: Omit<MockTest, "id" | "createdAt"> & { id?: string; createdAt?: number }): Promise<MockTest> {
  const row: MockTest = { ...m, id: m.id ?? uid("mock"), createdAt: m.createdAt ?? Date.now() } as MockTest;
  await db().mocks.put(row);
  return row;
}

export async function deleteMock(id: string) {
  await db().mocks.delete(id);
}

// ---------------- Day logs

export async function getDayLog(date: string): Promise<DayLog> {
  return (await db().dayLogs.get(date)) ?? { date, mission: [] };
}

export async function updateDayLog(date: string, patch: Partial<DayLog>) {
  const cur = await getDayLog(date);
  await db().dayLogs.put({ ...cur, ...patch, date });
}

export async function setMission(date: string, mission: MissionItem[]) {
  await updateDayLog(date, { mission });
}

// ---------------- Resources & colleges

export async function updateResourceState(id: string, patch: Partial<ResourceState>) {
  const cur = (await db().resourceStates.get(id)) ?? { id, rating: 0, bookmarked: false, status: "not_started" as const, linkedTopicIds: [] };
  await db().resourceStates.put({ ...cur, ...patch, id });
}

export async function toggleShortlist(id: string, on: boolean) {
  if (on) await db().shortlist.put({ id, pinned: false, addedAt: Date.now() });
  else await db().shortlist.delete(id);
}

export async function setPinned(id: string, pinned: boolean) {
  const cur = (await db().shortlist.get(id)) ?? { id, pinned: false, addedAt: Date.now() };
  await db().shortlist.put({ ...cur, pinned });
}

export async function recordAchievement(id: string) {
  const exists = await db().achievements.get(id);
  if (!exists) await db().achievements.put({ id, achievedAt: Date.now() });
  return !exists;
}
