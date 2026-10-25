import type { MockPhase, RoundStep, SubjectId, TemplateBlock, ErrorType } from "@/types";

/** Everything in this file is transcribed from GATE2027.pdf unless marked otherwise. */

export const SOURCE_PLAN_DATES = {
  start: "2026-10-12",
  end: "2026-11-30",
  note: "The PDF's seven-week plan runs from Monday 12 Oct 2026 to 30 Nov 2026.",
};

export const DEFAULT_BLOCKS: TemplateBlock[] = [
  {
    id: 1,
    name: "Theory & concept mapping",
    hours: 3.5,
    time: "Morning",
    description:
      "Deep focus. Learn core architectures, algorithms or systems properties using concise resources like GATE Overflow notes or rapid video lectures.",
  },
  {
    id: 2,
    name: "PYQ sprint",
    hours: 3.5,
    time: "Afternoon",
    description:
      "Active problem solving. Solve 25–30 targeted GATE questions from the last 25 years. Attempt each for at least 7 minutes before checking the solution.",
  },
  {
    id: 3,
    name: "Revision & error log",
    hours: 2,
    time: "Night",
    description:
      "Test & fix. Review what you got wrong and write the exact mathematical or conceptual reason for each failure in your error notebook.",
  },
];

export interface PlanSegment {
  days: number;
  label: string;
  title: string;
  detail: string;
  subjectIds: SubjectId[];
  topicIds: string[];
  isTest?: boolean;
}

export interface PlanWeek {
  week: number;
  sourceDates: string;
  title: string;
  subjectIds: SubjectId[];
  syllabusFocus: string;
  segments: PlanSegment[];
}

export const SEVEN_WEEK_PLAN: PlanWeek[] = [
  {
    week: 1,
    sourceDates: "Oct 12 – Oct 18",
    title: "Discrete Math, Linear Algebra & Digital Logic",
    subjectIds: ["em", "dl"],
    syllabusFocus:
      "Mathematical logic, set theory, combinatorics, graph theory; matrices, eigenvalues, systems of linear equations; K-maps, tabular minimization, combinational circuits (mux, decoders), sequential circuits (flip-flops, counters).",
    segments: [
      {
        days: 3,
        label: "Mon–Wed",
        title: "Discrete Maths & Linear Algebra straight from PYQs",
        detail:
          "Exploit your math background: skip video lectures for Discrete Math and Linear Algebra and go straight to GATE PYQs. Focus heavily on graph theory properties (planar graphs, chromatic numbers) — GATE loves tricky theoretical MSQs here.",
        subjectIds: ["em"],
        topicIds: [
          "em-prop-logic",
          "em-fol",
          "em-sets",
          "em-relations",
          "em-functions",
          "em-posets",
          "em-lattices",
          "em-monoids",
          "em-groups",
          "em-graph-connectivity",
          "em-graph-matching",
          "em-graph-colouring",
          "em-counting",
          "em-recurrence",
          "em-genfn",
          "em-matrices",
          "em-determinants",
          "em-linear-systems",
          "em-eigen",
          "em-lu",
        ],
      },
      {
        days: 3,
        label: "Thu–Sat",
        title: "Digital Logic: sequential analysis & tabular minimization",
        detail:
          "Master sequential circuit analysis (finding the counting sequence of arbitrary flip-flops). Practise the Quine–McCluskey (tabular) minimization method.",
        subjectIds: ["dl"],
        topicIds: ["dl-boolean", "dl-min-algebraic", "dl-kmap", "dl-tabular", "dl-combinational", "dl-sequential", "dl-number-rep", "dl-fixed-point", "dl-floating-point"],
      },
      {
        days: 1,
        label: "Sun",
        title: "Subject tests: Discrete Math + Digital Logic",
        detail: "Take 1 Discrete Math subject test and 1 Digital Logic subject test.",
        subjectIds: ["em", "dl"],
        topicIds: [],
        isTest: true,
      },
    ],
  },
  {
    week: 2,
    sourceDates: "Oct 19 – Oct 25",
    title: "C Programming, Data Structures & Probability",
    subjectIds: ["pds", "em"],
    syllabusFocus:
      "Pointers, parameter passing, recursion; arrays, stacks, queues, linked lists, trees (BST, AVL, binary heaps); conditional probability, Bayes theorem, random variables, distributions (binomial, Poisson, normal).",
    segments: [
      {
        days: 2,
        label: "Mon–Tue",
        title: "C pointers, double pointers & dynamic memory",
        detail:
          "Focus strictly on C pointers, double pointers and dynamic memory allocation. GATE frequently tests code snippets with complicated pointer arithmetic designed to make you miscount steps.",
        subjectIds: ["pds"],
        topicIds: ["pds-c", "pds-pointers", "pds-parameter-passing", "pds-recursion", "pds-arrays"],
      },
      {
        days: 3,
        label: "Wed–Fri",
        title: "Trees and heaps",
        detail:
          "Master tree properties (e.g. maximum nodes in an AVL tree of height h). Practise drawing intermediate states of a max/min heap during insertion and deletion.",
        subjectIds: ["pds"],
        topicIds: ["pds-stacks", "pds-queues", "pds-linked-lists", "pds-trees", "pds-bst", "pds-avl", "pds-heaps", "pds-graphs"],
      },
      {
        days: 1,
        label: "Sat",
        title: "Probability PYQs",
        detail: "Knock out probability PYQs. Pay extreme attention to exponential and uniform distribution integrations.",
        subjectIds: ["em"],
        topicIds: ["em-random-variables", "em-uniform", "em-normal", "em-exponential", "em-poisson", "em-binomial", "em-descriptive", "em-conditional", "em-bayes"],
      },
      {
        days: 1,
        label: "Sun",
        title: "Combined Programming & Data Structures test",
        detail: "Take a combined Programming & Data Structures subject test. Log code-tracing errors in your error notebook.",
        subjectIds: ["pds"],
        topicIds: [],
        isTest: true,
      },
    ],
  },
  {
    week: 3,
    sourceDates: "Oct 26 – Nov 01",
    title: "Algorithms & Calculus",
    subjectIds: ["algo", "em"],
    syllabusFocus:
      "Asymptotic analysis, recurrence relations; divide & conquer, greedy, dynamic programming; graph traversals (BFS, DFS), MSTs (Prim, Kruskal), shortest paths (Dijkstra, Bellman-Ford); limits, continuity, maxima/minima.",
    segments: [
      {
        days: 2,
        label: "Mon–Tue",
        title: "Recurrences and dynamic programming",
        detail:
          "Master solving recurrences using Master's Theorem and substitution. Identify optimal substructure and overlapping subproblems for core DP problems (Matrix Chain Multiplication, LCS).",
        subjectIds: ["algo"],
        topicIds: ["algo-asymptotic", "algo-recurrences", "algo-dnc", "algo-greedy", "algo-dp", "algo-searching", "algo-sorting", "algo-hashing"],
      },
      {
        days: 3,
        label: "Wed–Fri",
        title: "Graph algorithms",
        detail:
          "Learn to trace Dijkstra and Bellman-Ford step by step. Understand when these algorithms fail (e.g. Dijkstra with negative edge weights).",
        subjectIds: ["algo"],
        topicIds: ["algo-traversals", "algo-mst", "algo-shortest-paths"],
      },
      {
        days: 1,
        label: "Sat",
        title: "Calculus review",
        detail: "GATE CS calculus is straightforward — focus heavily on finding maxima and minima using derivatives.",
        subjectIds: ["em"],
        topicIds: ["em-limits", "em-continuity", "em-maxmin", "em-mvt", "em-integration"],
      },
      { days: 1, label: "Sun", title: "Algorithms subject test", detail: "Take an Algorithms subject test.", subjectIds: ["algo"], topicIds: [], isTest: true },
    ],
  },
  {
    week: 4,
    sourceDates: "Nov 02 – Nov 08",
    title: "Theory of Computation & Compiler Design",
    subjectIds: ["toc", "cd"],
    syllabusFocus:
      "Regular expressions, DFA/NFA minimization, closure properties, context-free grammars, Turing machines, undecidability; parsing (LL(1), LR(1), LALR), syntax-directed translation (SDT).",
    segments: [
      {
        days: 3,
        label: "Mon–Wed",
        title: "TOC as formal set theory",
        detail: "Treat TOC as formal set theory. Memorize the closure property table completely. Practise proving undecidability using reductions.",
        subjectIds: ["toc"],
        topicIds: ["toc-regex", "toc-fa", "toc-regular-languages", "toc-pumping", "toc-cfg", "toc-pda", "toc-cfl", "toc-tm", "toc-undecidability"],
      },
      {
        days: 3,
        label: "Thu–Sat",
        title: "Compilers: parsing tables & SDT",
        detail:
          "Construct LL(1) parsing tables (FIRST & FOLLOW) and LR(1) item sets. Do not skip syntax-directed translation — GATE frequently asks for the final value printed by a bottom-up parser using semantic rules.",
        subjectIds: ["cd"],
        topicIds: ["cd-lexical", "cd-parsing-top-down", "cd-parsing-bottom-up", "cd-sdt", "cd-runtime", "cd-icg", "cd-local-opt", "cd-constant-propagation", "cd-liveness", "cd-cse"],
      },
      { days: 1, label: "Sun", title: "TOC + Compiler Design combined test", detail: "Take a full TOC + Compiler Design combined subject test.", subjectIds: ["toc", "cd"], topicIds: [], isTest: true },
    ],
  },
  {
    week: 5,
    sourceDates: "Nov 09 – Nov 15",
    title: "Operating Systems",
    subjectIds: ["os"],
    syllabusFocus:
      "Process states, CPU scheduling; semaphores, classical synchronization problems, deadlocks; paging, multi-level paging, inverted paging, virtual memory, page replacement algorithms.",
    segments: [
      {
        days: 2,
        label: "Mon–Tue",
        title: "Scheduling and process synchronization",
        detail:
          "CPU scheduling (Gantt charts) is an easy scoring area. Spend extra hours on process synchronization: decode whether a pseudocode block satisfies mutual exclusion and bounded waiting.",
        subjectIds: ["os"],
        topicIds: ["os-syscalls", "os-processes", "os-threads", "os-ipc", "os-cpu-scheduling", "os-sync", "os-deadlock"],
      },
      {
        days: 3,
        label: "Wed–Fri",
        title: "Paging mathematics",
        detail:
          "Paging is purely mathematical. Master the formulas mapping virtual address space to physical address space. Practise multi-level paging and TLB hit/miss ratio calculations.",
        subjectIds: ["os"],
        topicIds: ["os-memory", "os-virtual-memory"],
      },
      {
        days: 1,
        label: "Sat",
        title: "Disk scheduling & page replacement",
        detail: "Solve problems on disk scheduling (SCAN, C-SCAN) and page replacement (LRU, Optimal).",
        subjectIds: ["os"],
        topicIds: ["os-io-scheduling", "os-virtual-memory", "os-file-systems"],
      },
      { days: 1, label: "Sun", title: "Two OS subject tests", detail: "Take 2 OS subject tests.", subjectIds: ["os"], topicIds: [], isTest: true },
    ],
  },
  {
    week: 6,
    sourceDates: "Nov 16 – Nov 22",
    title: "Computer Organization & Architecture",
    subjectIds: ["coa"],
    syllabusFocus:
      "Machine instructions, addressing modes; instruction pipelining, hazards, speedup; cache memory mapping (direct, associative, set-associative), cache write policies.",
    segments: [
      {
        days: 2,
        label: "Mon–Tue",
        title: "Addressing modes & effective addresses",
        detail: "Master addressing modes (indirect, indexed, auto-increment). Learn to calculate the exact effective memory address from assembly code snippets.",
        subjectIds: ["coa"],
        topicIds: ["coa-isa", "coa-addressing", "coa-alu"],
      },
      {
        days: 3,
        label: "Wed–Fri",
        title: "Pipelining and cache",
        detail:
          "Pipelining and cache are the two highest-weightage areas in COA. Calculate structural, data and control hazards. Master cache size math (tag, index and offset bits). Secondary storage/disk math is deprecated in the latest curriculum — skip it.",
        subjectIds: ["coa"],
        topicIds: ["coa-pipelining", "coa-hazards", "coa-mem-hierarchy", "coa-cache", "coa-cache-write", "coa-mem-interfacing"],
      },
      {
        days: 1,
        label: "Sat",
        title: "Control unit",
        detail: "Focus on control-unit micro-operations and hardwired vs. microprogrammed design differences.",
        subjectIds: ["coa"],
        topicIds: ["coa-cu-hardwired", "coa-cu-micro", "coa-io-interrupt", "coa-dma"],
      },
      {
        days: 1,
        label: "Sun",
        title: "COA subject test",
        detail: "Take a COA subject test. Expect your score to be low initially; analyse the exact mathematical formulation you missed.",
        subjectIds: ["coa"],
        topicIds: [],
        isTest: true,
      },
    ],
  },
  {
    week: 7,
    sourceDates: "Nov 23 – Nov 29",
    title: "Databases & Computer Networks",
    subjectIds: ["db", "cn"],
    syllabusFocus:
      "ER model, relational algebra, SQL; functional dependencies, normalization (1NF to BCNF); IPv4 routing, CIDR subnetting, TCP congestion control, sliding window protocols.",
    segments: [
      {
        days: 2,
        label: "Mon–Tue",
        title: "Normalization and SQL",
        detail:
          "Treat normalization as discrete optimization — find candidate keys using attribute closures. Master complex SQL queries with GROUP BY, HAVING and nested subqueries.",
        subjectIds: ["db"],
        topicIds: ["db-er", "db-relational", "db-relational-algebra", "db-tuple-calculus", "db-sql", "db-integrity", "db-fd", "db-normal-forms", "db-file-org", "db-indexing"],
      },
      {
        days: 3,
        label: "Wed–Fri",
        title: "Networks: numericals first",
        detail:
          "Ignore dry theoretical layers. Focus heavily on CIDR subnet splitting, TCP window size transitions during congestion, and sliding window protocol efficiency math (Go-Back-N, Selective Repeat). Old protocols like SMTP, DHCP and ARP are out of the 2027 cycle.",
        subjectIds: ["cn"],
        topicIds: [
          "cn-layering",
          "cn-switching",
          "cn-performance",
          "cn-error-detection",
          "cn-mac",
          "cn-ethernet",
          "cn-sliding-window",
          "cn-distance-vector",
          "cn-link-state",
          "cn-fragmentation",
          "cn-cidr",
          "cn-nat",
          "cn-tcp-flow",
          "cn-tcp-congestion",
          "cn-sockets",
          "cn-dns",
          "cn-http",
        ],
      },
      {
        days: 1,
        label: "Sat",
        title: "Transactions and concurrency control",
        detail: "Wrap up transactions and concurrency control (conflict serializability, 2PL).",
        subjectIds: ["db"],
        topicIds: ["db-transactions", "db-concurrency"],
      },
      {
        days: 1,
        label: "Sun",
        title: "Combined DBMS/CN test",
        detail: "Take a combined DBMS/CN subject test to wrap up the entire syllabus.",
        subjectIds: ["db", "cn"],
        topicIds: [],
        isTest: true,
      },
    ],
  },
];

export const ERROR_TYPES: Record<ErrorType, { name: string; meaning: string; fix: string; color: string }> = {
  A: {
    name: "Conceptual",
    meaning: "I didn't know the theory.",
    fix: "Requires 30 minutes of review.",
    color: "#8B7CFF",
  },
  B: {
    name: "Silly / calculation",
    meaning: "Arithmetic slip or a missed minus sign (e.g. 2 + 3 = 6).",
    fix: "Requires slower scratchpad work.",
    color: "#F2B45A",
  },
  C: {
    name: "Misread",
    meaning: "Missed a word like NOT or INCORRECT in the question statement.",
    fix: "Read the question twice before touching the calculator.",
    color: "#5FD4E6",
  },
};

export const DEFAULT_MOCK_PHASES: MockPhase[] = [
  {
    id: 1,
    name: "Context switching",
    start: "2026-12-01",
    end: "2026-12-15",
    objective:
      "Build the stamina to jump from a Data Structures pointer question to a Computer Networks subnetting calculation instantly.",
    actions: [
      "Don't jump straight into full-length mocks yet — write multi-subject tests (e.g. OS + COA, Algorithms + Discrete Math).",
      "One multi-subject test every day.",
      "3 hours taking the test, 2 hours tracking mistakes, 4 hours revising the specific sub-topics you got wrong.",
    ],
  },
  {
    id: 2,
    name: "Peak simulation",
    start: "2026-12-16",
    end: "2027-01-20",
    objective: "Build a bulletproof exam-taking strategy and eliminate psychological fatigue.",
    actions: [
      "One full-length mock every 3 days (roughly 10–12 high-quality mocks).",
      "Write mocks in the official GATE slots: 9:30 AM – 12:30 PM or 2:30 PM – 5:30 PM. Desk, on-screen virtual calculator, unruled scratch pads.",
      "Never close a mock without the post-mock audit: categorize every lost mark.",
    ],
  },
  {
    id: 3,
    name: "Tapering & calibration",
    start: "2027-01-21",
    end: "2027-02-06",
    objective: "Solidify strengths, prevent burnout, and tune your mind for precision.",
    actions: [
      "Stop taking new mocks after the end of phase 2 (the PDF's reasoning: a low score right before the exam can hurt confidence).",
      "PYQ lockdown: re-solve the official GATE 2024, 2025 and 2026 papers completely.",
      "Read your cumulative error notebook cover to cover every morning.",
    ],
  },
];

export const DEFAULT_ROUNDS: RoundStep[] = [
  {
    round: 1,
    title: "Low-hanging fruit",
    startMin: 0,
    endMin: 60,
    items: [
      "Start with General Aptitude (15 marks) for an immediate confidence boost.",
      "Move to technical 1- and 2-mark questions; solve only those whose path is instantly obvious.",
      "If a problem looks like more than 4 minutes, mark it for review and move on.",
    ],
  },
  {
    round: 2,
    title: "Heavy lifting",
    startMin: 60,
    endMin: 140,
    items: [
      "Attack complex multi-step numericals, DP problems and detailed systems/COA questions.",
      "Treat MSQs with extreme care: evaluate each option as an independent true/false statement.",
    ],
  },
  {
    round: 3,
    title: "Clean-up & verification",
    startMin: 140,
    endMin: 180,
    items: ["Review the questions you marked for review.", "Verify NAT values and re-read rounding instructions (e.g. “round off to 2 decimal places”)."],
  },
];

export const TACTICS = [
  {
    title: "The “never guess” rule for MSQs",
    body: "MSQs have no negative marking but need every correct option selected. Treat each MSQ as four independent true/false questions. If you cannot prove an option true, don't select it on intuition.",
  },
  {
    title: "Use the virtual calculator daily",
    body: "Stop using a physical calculator. Doing log, exponent and matrix computations on the virtual interface takes practice; the PDF estimates it saves 15 minutes on exam day.",
  },
  {
    title: "The error classification matrix",
    body: "When reviewing tests, flag every error as Type A (conceptual), Type B (silly/calculation) or Type C (misread) and apply the matching fix.",
  },
];

export const RULES_80 = [
  {
    title: "Isolate your top score drags",
    body: "If you keep losing marks in one area (e.g. COA pipelining, OS semaphores), pause your mock cycle for 24 hours and solve 40 consecutive raw questions on that exact micro-topic on GATE Overflow.",
  },
  {
    title: "Scratchpad organization",
    body: "Divide your rough sheet into numbered quadrants matching question numbers so you can find a half-finished calculation instantly in Round 3.",
  },
  {
    title: "Master the skip instinct",
    body: "Knowing what to skip matters as much as what to solve. Skip lengthy, convoluted time-sinks gracefully and secure your high-yield marks first.",
  },
];

/** Points where GATE CAT disagrees with or could not verify the PDF. Shown on the Strategy page. */
export const SOURCE_FLAGS = [
  {
    title: "The seven-week plan has started",
    body: "The plan's Week 1 (12–18 Oct 2026) has passed and Week 2 ends 25 Oct. The planner rebases the template to the start date you choose instead of showing these dates as upcoming.",
  },
  {
    title: "Week 7 date mismatch",
    body: "The PDF labels Week 7 as Nov 23–29 but calls the final test day “Sunday (Nov 30)”. 30 Nov 2026 is a Monday; 29 Nov is the Sunday.",
  },
  {
    title: "Exam date for CS is not announced yet",
    body: "The official site lists exam days 6–7, 13–14 and 20–21 Feb 2027 and says dates are liable to change; the CS paper's day and session were not published when checked (24 Oct 2026). The default exam date here is 6 Feb 2027, the earliest possible day — change it once the schedule is out.",
  },
  {
    title: "Virtual calculator “app or extension”",
    body: "The PDF says to download the official virtual calculator app or extension. GATE CAT could not verify an official downloadable app; the official calculator is part of the exam interface. Practise with the official mock-test interface when the organising institute publishes it.",
  },
  {
    title: "General Aptitude isn't scheduled",
    body: "GA carries 15 marks in the PDF's priority list but has no slot in the seven-week plan. The planner can add an optional daily GA block, clearly labelled as not from the PDF.",
  },
  {
    title: "Topics named only in the plan detail",
    body: "AVL trees and Go-Back-N/Selective Repeat are not named in the official syllabus text. They are kept as sub-skills (marked “PDF plan”) with a note.",
  },
  {
    title: "Mark estimates and AIR targets",
    body: "Tier mark ranges, “AIR under 70” and “80-mark barrier” come from the PDF author. They are not official weightages or predictions.",
  },
];

/** Facts checked against official sites on 24 Oct 2026. The AI tutor may cite these as verified. */
export const VERIFIED_FACTS = {
  retrieved: "2026-10-24",
  items: [
    { fact: "GATE 2027 is organised by IIT Madras on behalf of NCB–GATE.", source: "https://gate2027.iitm.ac.in/" },
    { fact: "GATE 2027 exam days: 6–7, 13–14 and 20–21 February 2027 (dates liable to change).", source: "https://gate2027.iitm.ac.in/" },
    { fact: "Admit card: 4 January 2027. Results: 19 March 2027.", source: "https://gate2027.iitm.ac.in/" },
    {
      fact: "The official GATE CS 2027 syllabus has 10 sections matching those in GATE2027.pdf; Computer Networks lists only DNS and HTTP at the application layer.",
      source: "https://gate2027.iitm.ac.in/static/doc/GATE2027_Syllabus/CS_GATE2027_Syllabus.pdf",
    },
    {
      fact: "IISc M.Tech (CSE), Dept. of Computer Science and Automation: Indian applicants are shortlisted on GATE CS score, take a programming test, and final selection weights GATE 70% and the IISc test 30%.",
      source: "https://eecs.iisc.ac.in/wp-content/uploads/2025/02/MTech-CSE.pdf",
    },
  ],
};

export const EXAM_DEFAULTS = {
  examDate: "2027-02-06",
  examNote: "Earliest GATE 2027 exam day. CS paper date not announced as of 24 Oct 2026.",
};
