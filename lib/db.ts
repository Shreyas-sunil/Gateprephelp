import Dexie, { type EntityTable } from "dexie";
import type {
  AchievementRecord,
  ChatThread,
  CustomProgramme,
  DayLog,
  ErrorEntry,
  MockTest,
  PyqAttempt,
  Resource,
  ResourceState,
  ReviewItem,
  Settings,
  ShortlistEntry,
  StudySession,
  Task,
  TopicProgress,
} from "@/types";

/** Local-first IndexedDB database. Nothing here leaves the browser unless you export it. */
export class GateCatDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  progress!: EntityTable<TopicProgress, "topicId">;
  tasks!: EntityTable<Task, "id">;
  sessions!: EntityTable<StudySession, "id">;
  pyqs!: EntityTable<PyqAttempt, "id">;
  errors!: EntityTable<ErrorEntry, "id">;
  reviews!: EntityTable<ReviewItem, "id">;
  mocks!: EntityTable<MockTest, "id">;
  dayLogs!: EntityTable<DayLog, "date">;
  userResources!: EntityTable<Resource, "id">;
  resourceStates!: EntityTable<ResourceState, "id">;
  shortlist!: EntityTable<ShortlistEntry, "id">;
  customProgrammes!: EntityTable<CustomProgramme, "id">;
  achievements!: EntityTable<AchievementRecord, "id">;
  chats!: EntityTable<ChatThread, "id">;

  constructor(name = "gate-cat") {
    super(name);
    this.version(1).stores({
      settings: "id",
      progress: "topicId, status",
      tasks: "id, date, status, topicId, subjectId",
      sessions: "id, date, start, topicId, subjectId",
      pyqs: "id, date, subjectId, topicId, result",
      errors: "id, date, status, subjectId, topicId, type",
      reviews: "id, due, kind, refId",
      mocks: "id, date, kind",
      dayLogs: "date",
      userResources: "id",
      resourceStates: "id",
      shortlist: "id",
      customProgrammes: "id",
      achievements: "id",
      chats: "id",
    });
  }
}

export const TABLE_NAMES = [
  "settings",
  "progress",
  "tasks",
  "sessions",
  "pyqs",
  "errors",
  "reviews",
  "mocks",
  "dayLogs",
  "userResources",
  "resourceStates",
  "shortlist",
  "customProgrammes",
  "achievements",
  "chats",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

let instance: GateCatDB | null = null;

export function getDb(): GateCatDB {
  if (!instance) instance = new GateCatDB();
  return instance;
}

/** For tests. */
export function setDb(db: GateCatDB | null) {
  instance = db;
}
