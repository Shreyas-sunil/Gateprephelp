import type { GateCategory } from "@/types";

export type CutoffSourceType = "official" | "community" | "user";

export interface CutoffRecord {
  year: string;
  stage: string;
  metric: "gate-score";
  scale: 1000;
  values: Partial<Record<GateCategory, number>>;
  rank?: string;
  seats?: number;
  sourceType: CutoffSourceType;
  sourceUrl: string;
  sourceTitle: string;
  retrieved: string;
  note?: string;
}

export interface Programme {
  id: string;
  institution: string;
  short: string;
  programme: string;
  department?: string;
  location: string;
  gatePapers: string[];
  admissionRoute?: string;
  eligibility?: string;
  officialUrl: string;
  officialUrlVerified: boolean;
  deadline?: string;
  cutoffs: CutoffRecord[];
  infoStatus: "current" | "historical" | "unavailable";
  notes?: string[];
  featured?: boolean;
}

const IISC_REPORT = {
  sourceType: "official" as const,
  sourceUrl: "https://www.iisc.ac.in/wp-content/uploads/2026/04/MTech_MDes_cutoff_2026.pdf",
  sourceTitle: "IISc M.Tech/M.Des 2026–27 Cut Off Report (dated 03-04-2026)",
  retrieved: "2026-10-24",
  year: "2026",
  stage: "Cut-off for GATE CS applicants (appears to govern test/interview call letters; the report doesn't state this explicitly)",
  metric: "gate-score" as const,
  scale: 1000 as const,
};

function iiscRow(
  id: string,
  department: string,
  v: [number, number, number, number, number, number, number, number | undefined],
  extra: Partial<Programme> = {},
): Programme {
  const [UR, OBC, EWS, SC, ST, KM, PH, WQ] = v;
  return {
    id,
    institution: "Indian Institute of Science",
    short: "IISc",
    programme: department.startsWith("Product Design") ? "M.Des — " + department : department,
    department,
    location: "Bengaluru, Karnataka",
    gatePapers: ["CS (among others)"],
    officialUrl: "https://www.iisc.ac.in/admissions/m-tech-m-des/",
    officialUrlVerified: true,
    infoStatus: "historical",
    cutoffs: [{ ...IISC_REPORT, values: { UR, OBC, EWS, SC, ST, KM, PH, ...(WQ !== undefined ? { WQ } : {}) } }],
    ...extra,
  };
}

export const PROGRAMMES: Programme[] = [
  {
    id: "iisc-csa-mtech",
    institution: "Indian Institute of Science",
    short: "IISc",
    programme: "M.Tech (Computer Science and Engineering)",
    department: "Department of Computer Science and Automation",
    location: "Bengaluru, Karnataka",
    gatePapers: ["CS"],
    admissionRoute:
      "Indian applicants: shortlisted on GATE CS score, then an IISc programming test. Final selection: 70% GATE score + 30% IISc test.",
    eligibility: "Four-year BE/BTech or equivalent degree.",
    officialUrl: "https://www.iisc.ac.in/admissions/m-tech-m-des/",
    officialUrlVerified: true,
    infoStatus: "historical",
    featured: true,
    notes: [
      "Selection process from the CSA M.Tech (CSE) brochure: https://eecs.iisc.ac.in/wp-content/uploads/2025/02/MTech-CSE.pdf",
      "CSA does not appear in IISc's 2026–27 official cut-off report, so no official benchmark is available here.",
      "Meeting a shortlisting score is not admission: the programming test, category criteria and seats also decide.",
    ],
    cutoffs: [
      {
        year: "2025",
        stage: "Community-reported admission cut-off (GATE Overflow college page, labelled “Actual”)",
        metric: "gate-score",
        scale: 1000,
        values: { UR: 903, OBC: 830, EWS: 843, SC: 678, ST: 523, PH: 431 },
        rank: "75–90 (General)",
        seats: 62,
        sourceType: "community",
        sourceUrl: "https://gateoverflow.in/colleges/iisc-bangalore",
        sourceTitle: "GATE Overflow — IISc Bangalore college page",
        retrieved: "2026-10-24",
        note: "Third-party and not traced to an IISc publication. Treat as unverified.",
      },
    ],
  },
  iiscRow("iisc-ai", "Artificial Intelligence", [880, 845, 845, 650, 590, 530, 720, 750]),
  iiscRow("iisc-cds", "Computational and Data Sciences", [790, 730, 750, 500, 425, 750, 750, 750]),
  iiscRow("iisc-ras", "Robotics and Autonomous Systems", [775, 700, 730, 575, 400, 400, 400, 750]),
  iiscRow("iisc-ese", "Electronic Systems Engineering", [950, 855, 855, 630, 630, 950, 950, 950]),
  iiscRow("iisc-mvd", "Microelectronics and VLSI Design", [950, 855, 855, 630, 630, 950, 950, 950]),
  iiscRow("iisc-is", "Instrumentation Systems", [900, 700, 700, 600, 600, 600, 600, 600]),
  iiscRow("iisc-qt", "Quantum Technology", [700, 600, 600, 400, 400, 400, 400, 600]),
  iiscRow("iisc-smart-mfg", "Smart Manufacturing", [800, 700, 700, 400, 400, 400, 400, 600]),
  iiscRow("iisc-pddm", "Product Design Development and Management", [800, 700, 700, 300, 300, 300, 300, undefined]),
  iiscRow("iisc-bio", "Bioengineering", [700, 650, 650, 300, 300, 500, 500, 700]),
  iiscRow("iisc-mobility", "Mobility Engineering", [575, 525, 525, 400, 245, 525, 525, 525]),
  iiscRow("iisc-smls", "Smart Mobility and Logistics Systems", [548, 500, 500, 485, 485, 540, 500, 540]),
  {
    id: "iisc-mtech-research",
    institution: "Indian Institute of Science",
    short: "IISc",
    programme: "M.Tech (Research) and Ph.D. programmes",
    location: "Bengaluru, Karnataka",
    gatePapers: ["CS (department-dependent)"],
    admissionRoute: "Department-specific; usually test and/or interview.",
    officialUrl: "https://www.iisc.ac.in/admissions/research-programmes/",
    officialUrlVerified: true,
    infoStatus: "unavailable",
    cutoffs: [],
  },
  ...(
    [
      ["iitb-cse", "Indian Institute of Technology Bombay", "IIT Bombay", "Mumbai, Maharashtra", "https://www.cse.iitb.ac.in/"],
      ["iitd-cse", "Indian Institute of Technology Delhi", "IIT Delhi", "New Delhi", "https://www.cse.iitd.ac.in/"],
      ["iitm-cse", "Indian Institute of Technology Madras", "IIT Madras", "Chennai, Tamil Nadu", "https://www.cse.iitm.ac.in/"],
      ["iitk-cse", "Indian Institute of Technology Kanpur", "IIT Kanpur", "Kanpur, Uttar Pradesh", "https://www.cse.iitk.ac.in/"],
      ["iitkgp-cse", "Indian Institute of Technology Kharagpur", "IIT Kharagpur", "Kharagpur, West Bengal", "https://cse.iitkgp.ac.in/"],
    ] as const
  ).map(
    ([id, institution, short, location, url]): Programme => ({
      id,
      institution,
      short,
      programme: "M.Tech in Computer Science and Engineering",
      location,
      gatePapers: ["CS"],
      admissionRoute: "Check the institute's admission notice. Many IIT M.Tech offers are made through COAP.",
      officialUrl: url,
      officialUrlVerified: false,
      infoStatus: "unavailable",
      cutoffs: [],
      notes: ["GATE CAT has no verified cut-off for this programme. Department homepage link not opened by GATE CAT — confirm it yourself."],
    }),
  ),
];

export const PROGRAMME_MAP: Record<string, Programme> = Object.fromEntries(PROGRAMMES.map((p) => [p.id, p]));

export const CATEGORY_LABEL: Record<GateCategory, string> = {
  UR: "UR (General)",
  OBC: "OBC",
  EWS: "EWS",
  SC: "SC",
  ST: "ST",
  PH: "PH",
  KM: "KM (as labelled in IISc report)",
  WQ: "WQ (as labelled in IISc report)",
};

/** GATE score formula as published in GATE information brochures. Verify against the GATE 2027 brochure. */
export const GATE_SCORE_FORMULA = {
  sq: 350,
  st: 900,
  text: "S = Sq + (St − Sq) × (M − Mq) / (Mt − Mq), with Sq = 350 and St = 900. Mq is the qualifying mark and Mt the mean of the top 0.1% (or top 10) candidates for the paper.",
};
