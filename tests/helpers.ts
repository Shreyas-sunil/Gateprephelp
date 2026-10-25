import { defaultSettings, emptyProgress } from "@/lib/defaults";
import type { AppData, PyqAttempt, StudySession, TopicProgress } from "@/types";

export function emptyData(): AppData {
  return {
    settings: defaultSettings(),
    progress: new Map(),
    tasks: [],
    sessions: [],
    pyqs: [],
    errors: [],
    reviews: [],
    mocks: [],
    dayLogs: [],
    userResources: [],
    resourceStates: new Map(),
    shortlist: [],
    customProgrammes: [],
    achievements: [],
  };
}

export function prog(topicId: string, patch: Partial<TopicProgress>): TopicProgress {
  return { ...emptyProgress(topicId), ...patch };
}

let n = 0;
export function pyq(patch: Partial<PyqAttempt>): PyqAttempt {
  n++;
  return { id: "p" + n, subjectId: "os", marks: 1, qtype: "MCQ", result: "correct", guessed: false, revisited: false, date: "2026-10-20", createdAt: n, ...patch };
}

export function session(date: string, minutes: number, patch: Partial<StudySession> = {}): StudySession {
  n++;
  return { id: "s" + n, start: Date.parse(date + "T09:00:00+05:30"), end: Date.parse(date + "T09:00:00+05:30") + minutes * 60000, minutes, date, mode: "focus", ...patch };
}
