// Shared domain types for GATE CAT. All persisted records live in IndexedDB (see lib/db.ts).

export type SubjectId =
  | "em"
  | "dl"
  | "coa"
  | "pds"
  | "algo"
  | "toc"
  | "cd"
  | "os"
  | "db"
  | "cn"
  | "ga";

export type Priority = "high" | "medium" | "low";
export type Tier = 1 | 2 | 3;

export interface Subject {
  id: SubjectId;
  name: string;
  short: string;
  /** Official GATE CS syllabus section number. General Aptitude has none. */
  section: number | null;
  tier: Tier;
  /** Marks estimate as written in the user's PDF. Not official. */
  sourceMarks: string;
  /** Focus areas named next to the estimate in the PDF. */
  sourceFocus: string;
  /** Chart/accent colour (hex). */
  color: string;
  /** For Engineering Mathematics: sub-groups. */
  groups?: string[];
}

export interface SyllabusTopic {
  id: string;
  subjectId: SubjectId;
  group?: string;
  name: string;
  /** "official" = listed in the GATE CS 2027 syllabus (as in the PDF and gate2027.iitm.ac.in).
   *  "pdf" = only appears in the PDF's study plan detail (sub-skill of an official topic). */
  origin: "official" | "pdf" | "ga";
  estHours: number;
  /** Tips copied from the PDF's weekly plan where they apply to this topic. */
  sourceTips?: string[];
  /** Verification note when the PDF recommendation looks inconsistent with the official syllabus. */
  flag?: string;
}

export type TopicStatus = "not_started" | "learning" | "practicing" | "revision" | "mastered";

export interface Bookmark {
  id: string;
  label: string;
  url?: string;
}

export interface TopicProgress {
  topicId: string;
  status: TopicStatus;
  priority?: Priority;
  /** 0 = not rated yet, otherwise 1–5. */
  confidence: number;
  estHours?: number;
  /** PYQs practised outside the per-question log (e.g. a 30-question sprint). */
  manualAttempted: number;
  manualCorrect: number;
  lastStudied?: string;
  nextRevision?: string;
  notes: string;
  bookmarks: Bookmark[];
  evidence?: string;
  statusHistory: { date: string; status: TopicStatus }[];
  updatedAt: number;
}

export type TaskStatus = "todo" | "done" | "skipped";
export type TaskSource = "manual" | "plan" | "error" | "mock" | "resource" | "recommendation" | "revision" | "college";

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD (IST)
  title: string;
  subjectId?: SubjectId;
  topicId?: string;
  block?: 1 | 2 | 3;
  plannedMin: number;
  status: TaskStatus;
  order: number;
  notes?: string;
  link?: string;
  source: TaskSource;
  createdAt: number;
  completedAt?: number;
  postponedCount: number;
  planBatch?: string;
}

export interface StudySession {
  id: string;
  start: number;
  end: number;
  minutes: number;
  date: string; // IST date of start
  subjectId?: SubjectId;
  topicId?: string;
  taskId?: string;
  mode: "focus" | "pomodoro" | "manual";
  notes?: string;
}

export type QuestionType = "MCQ" | "MSQ" | "NAT";
export type ErrorType = "A" | "B" | "C";
export type AttemptResult = "correct" | "incorrect" | "unattempted";

export interface PyqAttempt {
  id: string;
  year?: number;
  subjectId: SubjectId;
  topicId?: string;
  questionNo?: string;
  marks: number;
  qtype: QuestionType;
  myAnswer?: string;
  correctAnswer?: string;
  result: AttemptResult;
  timeSec?: number;
  difficulty?: "easy" | "medium" | "hard";
  errorType?: ErrorType;
  guessed: boolean;
  revisited: boolean;
  notes?: string;
  solutionUrl?: string;
  date: string;
  createdAt: number;
}

export interface ErrorEntry {
  id: string;
  questionRef: string;
  source: "pyq" | "mock" | "practice" | "other";
  pyqId?: string;
  mockId?: string;
  subjectId: SubjectId;
  topicId?: string;
  type: ErrorType;
  marksLost: number;
  originalThought: string;
  whyWrong: string;
  correctReasoning: string;
  rule: string;
  correctiveAction: string;
  reviewDate?: string;
  repeatCount: number;
  status: "open" | "resolved";
  date: string;
  createdAt: number;
  resolvedAt?: number;
}

export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewLog {
  date: string;
  grade: Grade;
  intervalBefore: number;
  intervalAfter: number;
  dueBefore: string;
  onTime: boolean;
}

export interface ReviewItem {
  id: string;
  kind: "topic" | "error";
  refId: string;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  due: string;
  createdAt: number;
  history: ReviewLog[];
  suspended?: boolean;
}

export type MockKind = "subject" | "multi" | "full" | "custom";

export interface MockTest {
  id: string;
  name: string;
  provider?: string;
  kind: MockKind;
  date: string;
  totalMarks: number;
  score: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeUsedMin?: number;
  durationMin?: number;
  subjectMarks: { subjectId: SubjectId; scored: number; max: number; timeMin?: number }[];
  weakTopicIds: string[];
  markedForReview?: number;
  lostMarks: { A: number; B: number; C: number; unattempted: number };
  rounds: { round: 1 | 2 | 3; minutes?: number; attempted?: number; notes?: string }[];
  providerRank?: number;
  providerCandidates?: number;
  analysis?: string;
  actions: string[];
  createdAt: number;
}

export interface MissionItem {
  id: string;
  text: string;
  done: boolean;
  href?: string;
}

export interface DayLog {
  date: string;
  restDay?: boolean;
  intention?: string;
  mission: MissionItem[];
  reflection?: string;
}

export type ResourceType =
  | "notes"
  | "video"
  | "pyq"
  | "official-paper"
  | "test-series"
  | "tool"
  | "syllabus"
  | "exam-info"
  | "in-app"
  | "practice-set"
  | "admissions"
  | "other";

export type CostStatus = "free" | "paid" | "mixed" | "unverified";
export type Verification = "verified" | "partial" | "needs-verification";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  subjectIds: SubjectId[];
  topicIds: string[];
  url?: string;
  description: string;
  cost: CostStatus;
  classification: "official" | "third-party" | "in-app" | "personal";
  access?: string;
  /** "pdf" = named in the user's PDF, "researched" = added by GATE CAT, "user" = added by you. */
  origin: "pdf" | "researched" | "requested" | "user";
  verification: Verification;
  verificationNote?: string;
  pdfMention?: string;
}

export interface ResourceState {
  id: string;
  rating: number;
  bookmarked: boolean;
  status: "not_started" | "in_progress" | "done";
  linkedTopicIds: string[];
  note?: string;
}

export interface ShortlistEntry {
  id: string; // programme id
  pinned: boolean;
  addedAt: number;
  note?: string;
}

export interface CustomProgramme {
  id: string;
  institution: string;
  programme: string;
  location?: string;
  url?: string;
  cutoffScore?: number;
  cutoffYear?: string;
  cutoffNote?: string;
  createdAt: number;
}

export interface AchievementRecord {
  id: string;
  achievedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  createdAt: number;
  sources?: { title: string; uri: string }[];
  error?: boolean;
}

export interface ChatThread {
  id: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type CatFur = "smoke" | "ginger" | "cream" | "ink" | "lilac";
export type CatAccessory = "none" | "glasses" | "scarf" | "bow";
export type GateCategory = "UR" | "OBC" | "EWS" | "SC" | "ST" | "PH" | "KM" | "WQ";

export interface TemplateBlock {
  id: 1 | 2 | 3;
  name: string;
  hours: number;
  time: string;
  description: string;
}

export interface MockPhase {
  id: 1 | 2 | 3;
  name: string;
  start: string;
  end: string;
  objective: string;
  actions: string[];
}

export interface RoundStep {
  round: 1 | 2 | 3;
  title: string;
  startMin: number;
  endMin: number;
  items: string[];
}

export interface MilestoneConfig {
  id: string;
  enabled: boolean;
  threshold: number;
}

export interface Settings {
  id: "app";
  onboarded: boolean;
  examDate: string;
  syllabusEndDate: string;
  planStartDate?: string;
  dailyHourGoal: number;
  weeklyHourGoal: number;
  targetMarks: number;
  targetGateScore: number;
  targetRank: number;
  pyqTarget: number;
  mockTarget: number;
  subjectTargets: Partial<Record<SubjectId, number>>;
  category: GateCategory;
  prepLevel: "starting" | "partial" | "advanced";
  preferredTimes: string[];
  streakMinMinutes: number;
  mastery: { minConfidence: number; minAttempts: number; minAccuracy: number; requireReview: boolean };
  srs: {
    againDays: number;
    firstGoodDays: number;
    secondGoodDays: number;
    hardMultiplier: number;
    easyBonus: number;
    startEase: number;
    minEase: number;
    maxInterval: number;
  };
  pomodoro: { focus: number; short: number; long: number; cyclesBeforeLong: number };
  blocks: TemplateBlock[];
  mockPhases: MockPhase[];
  rounds: RoundStep[];
  readinessWeights: Record<ReadinessKey, number>;
  cat: { name: string; fur: CatFur; accessory: CatAccessory };
  quietMode: boolean;
  celebrations: boolean;
  toasts: boolean;
  motion: "system" | "reduced" | "full";
  theme: "midnight" | "ivory";
  dreamProgrammeId: string;
  gateConversion: { mq?: number; mt?: number; reference?: string };
  actualGateScore?: number;
  actualGateRank?: number;
  milestones: MilestoneConfig[];
  lastActive?: { topicId?: string; subjectId?: SubjectId; at: number };
  updatedAt: number;
}

export type ReadinessKey = "coverage" | "mastery" | "pyq" | "mock" | "revision" | "consistency";

export interface AppData {
  settings: Settings;
  progress: Map<string, TopicProgress>;
  tasks: Task[];
  sessions: StudySession[];
  pyqs: PyqAttempt[];
  errors: ErrorEntry[];
  reviews: ReviewItem[];
  mocks: MockTest[];
  dayLogs: DayLog[];
  userResources: Resource[];
  resourceStates: Map<string, ResourceState>;
  shortlist: ShortlistEntry[];
  customProgrammes: CustomProgramme[];
  achievements: AchievementRecord[];
}
