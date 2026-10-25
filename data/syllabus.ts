import type { Subject, SubjectId, SyllabusTopic, Priority } from "@/types";

/**
 * Single source of truth for the syllabus.
 * Sections 1–10 follow the GATE CS 2027 syllabus exactly as printed in GATE2027.pdf
 * (cross-checked on 24 Oct 2026 against the official CS_GATE2027_Syllabus.pdf on gate2027.iitm.ac.in).
 * Tier labels and mark ranges are the PDF author's estimates, not official weightages.
 */
export const SUBJECTS: Subject[] = [
  {
    id: "em",
    name: "Engineering Mathematics",
    short: "Eng. Maths",
    section: 1,
    tier: 1,
    sourceMarks: "13M",
    sourceFocus: "Linear Algebra, Probability and Statistics",
    color: "#8B7CFF",
    groups: ["Discrete Mathematics", "Linear Algebra", "Calculus", "Probability and Statistics"],
  },
  { id: "dl", name: "Digital Logic", short: "Digital Logic", section: 2, tier: 3, sourceMarks: "4M–5M", sourceFocus: "", color: "#5FD4E6" },
  {
    id: "coa",
    name: "Computer Organization and Architecture",
    short: "COA",
    section: 3,
    tier: 2,
    sourceMarks: "7M–8M",
    sourceFocus: "Cache, Pipeline, Memory Hierarchy",
    color: "#F2B45A",
  },
  {
    id: "pds",
    name: "Programming and Data Structures",
    short: "Prog. & DS",
    section: 4,
    tier: 1,
    sourceMarks: "13M–15M (combined DSA)",
    sourceFocus: "Trees, Graphs, DP, Sorting",
    color: "#6EDCA6",
  },
  {
    id: "algo",
    name: "Algorithms",
    short: "Algorithms",
    section: 5,
    tier: 1,
    sourceMarks: "13M–15M (combined DSA)",
    sourceFocus: "Trees, Graphs, DP, Sorting",
    color: "#FF8FA3",
  },
  { id: "toc", name: "Theory of Computation", short: "TOC", section: 6, tier: 3, sourceMarks: "5M–7M", sourceFocus: "", color: "#C3A6FF" },
  { id: "cd", name: "Compiler Design", short: "Compilers", section: 7, tier: 3, sourceMarks: "4M–6M", sourceFocus: "", color: "#7FB8FF" },
  {
    id: "os",
    name: "Operating Systems",
    short: "OS",
    section: 8,
    tier: 1,
    sourceMarks: "8M–10M",
    sourceFocus: "Process Scheduling, Memory Management, Deadlocks",
    color: "#F59E6B",
  },
  {
    id: "db",
    name: "Databases",
    short: "DBMS",
    section: 9,
    tier: 2,
    sourceMarks: "7M–8M",
    sourceFocus: "ER Diagrams, SQL, Normalization, Transactions",
    color: "#D4E07A",
  },
  {
    id: "cn",
    name: "Computer Networks",
    short: "Networks",
    section: 10,
    tier: 2,
    sourceMarks: "7M–8M",
    sourceFocus: "TCP/IP Stack, Routing, Congestion Control",
    color: "#4FC3B0",
  },
  { id: "ga", name: "General Aptitude", short: "Aptitude", section: null, tier: 1, sourceMarks: "15M", sourceFocus: "", color: "#E9DDBE" },
];

export const SUBJECT_MAP: Record<SubjectId, Subject> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s])) as Record<
  SubjectId,
  Subject
>;

type T = Omit<SyllabusTopic, "subjectId" | "origin" | "estHours"> & {
  origin?: SyllabusTopic["origin"];
  estHours?: number;
};

function build(subjectId: SubjectId, defaultHours: number, topics: T[]): SyllabusTopic[] {
  return topics.map((t) => ({ origin: "official", estHours: defaultHours, ...t, subjectId }));
}

const DM = "Discrete Mathematics";
const LA = "Linear Algebra";
const CA = "Calculus";
const PS = "Probability and Statistics";

export const TOPICS: SyllabusTopic[] = [
  ...build("em", 3, [
    { id: "em-prop-logic", group: DM, name: "Propositional logic" },
    { id: "em-fol", group: DM, name: "First-order logic" },
    { id: "em-sets", group: DM, name: "Sets" },
    { id: "em-relations", group: DM, name: "Relations" },
    { id: "em-functions", group: DM, name: "Functions" },
    { id: "em-posets", group: DM, name: "Partial orders" },
    { id: "em-lattices", group: DM, name: "Lattices" },
    { id: "em-monoids", group: DM, name: "Monoids" },
    { id: "em-groups", group: DM, name: "Groups" },
    {
      id: "em-graph-connectivity",
      group: DM,
      name: "Graphs: connectivity",
      sourceTips: ["Focus heavily on Graph Theory properties — GATE loves tricky theoretical MSQs here."],
    },
    { id: "em-graph-matching", group: DM, name: "Graphs: matching" },
    {
      id: "em-graph-colouring",
      group: DM,
      name: "Graphs: colouring",
      sourceTips: ["Planar graphs and chromatic numbers are called out in Week 1."],
    },
    { id: "em-counting", group: DM, name: "Combinatorics: counting" },
    { id: "em-recurrence", group: DM, name: "Recurrence relations" },
    { id: "em-genfn", group: DM, name: "Generating functions" },
    { id: "em-matrices", group: LA, name: "Matrices" },
    { id: "em-determinants", group: LA, name: "Determinants" },
    { id: "em-linear-systems", group: LA, name: "Systems of linear equations" },
    { id: "em-eigen", group: LA, name: "Eigenvalues and eigenvectors" },
    { id: "em-lu", group: LA, name: "LU decomposition" },
    { id: "em-limits", group: CA, name: "Limits", estHours: 2 },
    { id: "em-continuity", group: CA, name: "Continuity and differentiability", estHours: 2 },
    {
      id: "em-maxmin",
      group: CA,
      name: "Maxima and minima",
      estHours: 2,
      sourceTips: ["GATE CS calculus is straightforward — focus heavily on maxima and minima using derivatives."],
    },
    { id: "em-mvt", group: CA, name: "Mean value theorem", estHours: 2 },
    { id: "em-integration", group: CA, name: "Integration", estHours: 2 },
    { id: "em-random-variables", group: PS, name: "Random variables" },
    {
      id: "em-uniform",
      group: PS,
      name: "Uniform distribution",
      estHours: 2,
      sourceTips: ["Pay extreme attention to Exponential and Uniform distribution integrations."],
    },
    { id: "em-normal", group: PS, name: "Normal distribution", estHours: 2 },
    {
      id: "em-exponential",
      group: PS,
      name: "Exponential distribution",
      estHours: 2,
      sourceTips: ["Pay extreme attention to Exponential and Uniform distribution integrations."],
    },
    { id: "em-poisson", group: PS, name: "Poisson distribution", estHours: 2 },
    { id: "em-binomial", group: PS, name: "Binomial distribution", estHours: 2 },
    { id: "em-descriptive", group: PS, name: "Mean, median, mode and standard deviation", estHours: 2 },
    { id: "em-conditional", group: PS, name: "Conditional probability" },
    { id: "em-bayes", group: PS, name: "Bayes theorem" },
  ]),
  ...build("dl", 3, [
    { id: "dl-boolean", name: "Boolean algebra" },
    { id: "dl-min-algebraic", name: "Minimization: algebraic technique" },
    { id: "dl-kmap", name: "Minimization: Karnaugh map" },
    {
      id: "dl-tabular",
      name: "Minimization: tabular method (Quine–McCluskey)",
      sourceTips: ["Practise the Quine–McCluskey (tabular) minimization method."],
    },
    { id: "dl-combinational", name: "Design of combinational circuits (mux, decoders)" },
    {
      id: "dl-sequential",
      name: "Design of sequential circuits (flip-flops, counters)",
      estHours: 5,
      sourceTips: ["Master sequential circuit analysis — finding the counting sequence of arbitrary flip-flops."],
    },
    { id: "dl-number-rep", name: "Number representation" },
    { id: "dl-fixed-point", name: "Fixed-point arithmetic" },
    { id: "dl-floating-point", name: "Floating-point representation and arithmetic" },
  ]),
  ...build("coa", 4, [
    { id: "coa-isa", name: "Instruction set" },
    {
      id: "coa-addressing",
      name: "Addressing modes",
      sourceTips: ["Master Indirect, Indexed and Auto-increment modes; compute effective addresses from assembly snippets."],
    },
    { id: "coa-alu", name: "Design of arithmetic and logic unit (ALU)" },
    { id: "coa-cu-hardwired", name: "Control unit: hardwired", sourceTips: ["Control-unit micro-operations; hardwired vs microprogrammed differences."] },
    { id: "coa-cu-micro", name: "Control unit: microprogrammed", sourceTips: ["Control-unit micro-operations; hardwired vs microprogrammed differences."] },
    { id: "coa-mem-interfacing", name: "Memory interfacing" },
    { id: "coa-mem-hierarchy", name: "Memory hierarchy and performance" },
    {
      id: "coa-cache",
      name: "Cache memory mapping (direct, associative, set-associative)",
      estHours: 6,
      sourceTips: ["Master cache size math: tag, index and offset bits.", "Pipelining and cache are the highest-weightage COA areas (per the PDF)."],
    },
    { id: "coa-cache-write", name: "Cache write policies", origin: "pdf", estHours: 2 },
    { id: "coa-io-interrupt", name: "I/O interface: interrupts" },
    { id: "coa-dma", name: "I/O interface: DMA" },
    { id: "coa-pipelining", name: "Instruction pipelining and speedup", estHours: 6 },
    { id: "coa-hazards", name: "Pipeline hazards (structural, data, control)", estHours: 5 },
  ]),
  ...build("pds", 4, [
    { id: "pds-c", name: "Programming in C" },
    {
      id: "pds-pointers",
      name: "Pointers, double pointers and dynamic memory allocation",
      origin: "pdf",
      estHours: 5,
      sourceTips: ["GATE frequently tests snippets with complicated pointer arithmetic designed to make you miscount steps."],
    },
    { id: "pds-parameter-passing", name: "Parameter passing", origin: "pdf", estHours: 2 },
    { id: "pds-recursion", name: "Recursion" },
    { id: "pds-arrays", name: "Arrays", estHours: 3 },
    { id: "pds-stacks", name: "Stacks", estHours: 3 },
    { id: "pds-queues", name: "Queues", estHours: 3 },
    { id: "pds-linked-lists", name: "Linked lists", estHours: 3 },
    { id: "pds-trees", name: "Trees", sourceTips: ["Master tree properties."] },
    { id: "pds-bst", name: "Binary search trees" },
    {
      id: "pds-avl",
      name: "AVL trees",
      origin: "pdf",
      estHours: 3,
      sourceTips: ["e.g. maximum/minimum nodes in an AVL tree of height h."],
      flag: "AVL trees are not named in the official syllabus text (it lists trees and binary search trees). Treat as a sub-skill of BSTs rather than a separate syllabus item.",
    },
    { id: "pds-heaps", name: "Binary heaps", sourceTips: ["Practise drawing intermediate states of a max/min heap during insertion and deletion."] },
    { id: "pds-graphs", name: "Graphs (representation)" },
  ]),
  ...build("algo", 4, [
    { id: "algo-searching", name: "Searching", estHours: 2 },
    { id: "algo-sorting", name: "Sorting" },
    { id: "algo-hashing", name: "Hashing" },
    { id: "algo-asymptotic", name: "Asymptotic worst-case time and space complexity" },
    {
      id: "algo-recurrences",
      name: "Solving recurrences (Master theorem, substitution)",
      origin: "pdf",
      sourceTips: ["Master solving recurrences using Master's Theorem and substitution."],
    },
    { id: "algo-greedy", name: "Greedy algorithms" },
    {
      id: "algo-dp",
      name: "Dynamic programming",
      estHours: 6,
      sourceTips: ["Identify optimal substructure and overlapping subproblems (Matrix Chain Multiplication, LCS)."],
    },
    { id: "algo-dnc", name: "Divide and conquer" },
    { id: "algo-traversals", name: "Graph traversals (BFS, DFS)" },
    { id: "algo-mst", name: "Minimum spanning trees (Prim, Kruskal)" },
    {
      id: "algo-shortest-paths",
      name: "Shortest paths (Dijkstra, Bellman–Ford)",
      estHours: 5,
      sourceTips: ["Trace Dijkstra and Bellman–Ford step by step; know when they fail (e.g. Dijkstra with negative edges)."],
    },
  ]),
  ...build("toc", 4, [
    { id: "toc-regex", name: "Regular expressions" },
    { id: "toc-fa", name: "Finite automata (DFA/NFA, minimization)" },
    { id: "toc-cfg", name: "Context-free grammars" },
    { id: "toc-pda", name: "Push-down automata" },
    {
      id: "toc-regular-languages",
      name: "Regular languages and closure properties",
      sourceTips: ["Memorize the closure property table completely."],
    },
    { id: "toc-cfl", name: "Context-free languages and closure properties", sourceTips: ["Memorize the closure property table completely."] },
    { id: "toc-pumping", name: "Pumping lemma" },
    { id: "toc-tm", name: "Turing machines" },
    { id: "toc-undecidability", name: "Undecidability", sourceTips: ["Practise proving undecidability using reductions."] },
  ]),
  ...build("cd", 3, [
    { id: "cd-lexical", name: "Lexical analysis", estHours: 2 },
    { id: "cd-parsing-top-down", name: "Parsing: FIRST/FOLLOW and LL(1)", estHours: 4, sourceTips: ["Construct LL(1) parsing tables (FIRST and FOLLOW sets)."] },
    { id: "cd-parsing-bottom-up", name: "Parsing: LR(0), SLR, LR(1), LALR", estHours: 5, sourceTips: ["Construct LR(1) item sets."] },
    {
      id: "cd-sdt",
      name: "Syntax-directed translation",
      estHours: 4,
      sourceTips: ["Do not skip SDT — GATE asks for the final value printed by a bottom-up parser using semantic rules."],
    },
    { id: "cd-runtime", name: "Runtime environments" },
    { id: "cd-icg", name: "Intermediate code generation" },
    { id: "cd-local-opt", name: "Local optimisation" },
    { id: "cd-constant-propagation", name: "Data flow analysis: constant propagation" },
    { id: "cd-liveness", name: "Data flow analysis: liveness analysis" },
    { id: "cd-cse", name: "Common subexpression elimination" },
  ]),
  ...build("os", 4, [
    { id: "os-syscalls", name: "System calls", estHours: 2 },
    { id: "os-processes", name: "Processes and process states" },
    { id: "os-threads", name: "Threads" },
    { id: "os-ipc", name: "Inter-process communication" },
    {
      id: "os-sync",
      name: "Concurrency and synchronization (semaphores, classical problems)",
      estHours: 7,
      sourceTips: ["Decode whether a pseudocode block satisfies mutual exclusion and bounded waiting."],
    },
    { id: "os-deadlock", name: "Deadlock" },
    { id: "os-cpu-scheduling", name: "CPU scheduling", sourceTips: ["CPU scheduling (Gantt charts) is an easy scoring area."] },
    { id: "os-io-scheduling", name: "I/O and disk scheduling (SCAN, C-SCAN)", estHours: 3 },
    {
      id: "os-memory",
      name: "Memory management (paging, multi-level, inverted)",
      estHours: 6,
      sourceTips: ["Paging is purely mathematical — master virtual-to-physical address space formulas."],
    },
    {
      id: "os-virtual-memory",
      name: "Virtual memory, TLB and page replacement",
      estHours: 5,
      sourceTips: ["Practise multi-level paging and TLB hit/miss ratio calculations; LRU and Optimal replacement."],
    },
    { id: "os-file-systems", name: "File systems" },
  ]),
  ...build("db", 4, [
    { id: "db-er", name: "ER model" },
    { id: "db-relational", name: "Relational model" },
    { id: "db-relational-algebra", name: "Relational algebra" },
    { id: "db-tuple-calculus", name: "Tuple calculus" },
    { id: "db-sql", name: "SQL", estHours: 5, sourceTips: ["Master complex queries with GROUP BY, HAVING and nested subqueries."] },
    { id: "db-integrity", name: "Integrity constraints", estHours: 2 },
    {
      id: "db-fd",
      name: "Functional dependencies and attribute closure",
      origin: "pdf",
      sourceTips: ["Treat normalization as discrete optimization — find candidate keys using attribute closures."],
    },
    { id: "db-normal-forms", name: "Normal forms (1NF to BCNF)", estHours: 5 },
    { id: "db-file-org", name: "File organization", estHours: 2 },
    { id: "db-indexing", name: "Indexing (B and B+ trees)" },
    { id: "db-transactions", name: "Transactions" },
    { id: "db-concurrency", name: "Concurrency control (conflict serializability, 2PL)" },
  ]),
  ...build("cn", 3, [
    { id: "cn-layering", name: "Principles of layering", estHours: 1 },
    { id: "cn-switching", name: "Switching: circuit, packet and virtual circuit", estHours: 2 },
    { id: "cn-performance", name: "Performance metrics" },
    { id: "cn-error-detection", name: "Data link layer: error detection" },
    { id: "cn-mac", name: "Medium Access Control" },
    { id: "cn-ethernet", name: "Ethernet", estHours: 2 },
    {
      id: "cn-sliding-window",
      name: "Sliding window protocols (Go-Back-N, Selective Repeat)",
      origin: "pdf",
      sourceTips: ["Sliding window protocol efficiency math (Go-Back-N, Selective Repeat)."],
      flag: "Go-Back-N and Selective Repeat are not named in the official syllabus text; they relate to flow control. Check recent official papers before investing heavily.",
    },
    { id: "cn-distance-vector", name: "Distance vector routing" },
    { id: "cn-link-state", name: "Link state routing" },
    { id: "cn-fragmentation", name: "IPv4 fragmentation" },
    { id: "cn-cidr", name: "CIDR notation and subnetting", estHours: 4, sourceTips: ["Focus heavily on CIDR subnet splitting calculations."] },
    { id: "cn-nat", name: "Network Address Translation", estHours: 2 },
    { id: "cn-tcp-flow", name: "TCP flow control" },
    { id: "cn-tcp-congestion", name: "TCP congestion control", sourceTips: ["TCP window size transitions during congestion."] },
    { id: "cn-sockets", name: "Socket API", estHours: 2 },
    { id: "cn-dns", name: "DNS", estHours: 2 },
    { id: "cn-http", name: "HTTP", estHours: 2 },
  ]),
  ...build("ga", 4, [
    { id: "ga-verbal", name: "Verbal aptitude", origin: "ga" },
    { id: "ga-quantitative", name: "Quantitative aptitude", origin: "ga" },
    { id: "ga-analytical", name: "Analytical aptitude", origin: "ga" },
    { id: "ga-spatial", name: "Spatial aptitude", origin: "ga" },
  ]),
];

export const TOPIC_MAP: Record<string, SyllabusTopic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export function topicsForSubject(subjectId: SubjectId): SyllabusTopic[] {
  return TOPICS.filter((t) => t.subjectId === subjectId);
}

export function defaultPriority(subjectId: SubjectId): Priority {
  const tier = SUBJECT_MAP[subjectId].tier;
  return tier === 1 ? "high" : tier === 2 ? "medium" : "low";
}

export function subjectName(id?: string): string {
  if (!id) return "—";
  return SUBJECT_MAP[id as SubjectId]?.short ?? id;
}

export function topicName(id?: string): string {
  if (!id) return "—";
  return TOPIC_MAP[id]?.name ?? "Unknown topic";
}
