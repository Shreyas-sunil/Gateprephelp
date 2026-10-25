/**
 * Date helpers. All calendar dates are YYYY-MM-DD strings in India Standard Time (Asia/Kolkata, UTC+05:30).
 * Arithmetic is done on UTC midnights so it is independent of the browser's own time zone.
 */
export const TZ = "Asia/Kolkata";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function toISTDate(ms: number = Date.now()): string {
  return ymdFormatter.format(new Date(ms));
}

export function todayIST(now: number = Date.now()): string {
  return toISTDate(now);
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseYmd(s).getTime()) && formatYmd(parseYmd(s)) === s;
}

export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return formatYmd(d);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(ymd: string): number {
  return parseYmd(ymd).getUTCDay();
}

/** Monday of the week containing ymd. */
export function startOfWeek(ymd: string): string {
  const wd = weekday(ymd);
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(ymd: string): string {
  return ymd.slice(0, 8) + "01";
}

export function daysInMonth(ymd: string): number {
  const d = parseYmd(startOfMonth(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.getUTCDate();
}

export function addMonths(ymd: string, n: number): string {
  const d = parseYmd(startOfMonth(ymd));
  d.setUTCMonth(d.getUTCMonth() + n);
  return formatYmd(d);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDate(ymd: string | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!ymd || !isYmd(ymd)) return "—";
  const d = parseYmd(ymd);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const withYear = opts.year ? `${base} ${d.getUTCFullYear()}` : base;
  return opts.weekday ? `${DAYS[d.getUTCDay()]}, ${withYear}` : withYear;
}

export function fmtMonth(ymd: string): string {
  const d = parseYmd(ymd);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dayName(ymd: string, long = false): string {
  const name = DAYS[weekday(ymd)] ?? "";
  if (!long) return name;
  return ({ Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" } as Record<string, string>)[name] ?? name;
}

export function relativeDay(ymd: string, today: string): string {
  const d = diffDays(today, ymd);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d} days ago`;
  return `In ${d} days`;
}

export function fmtMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtHours(min: number, digits = 1): string {
  return (min / 60).toFixed(digits).replace(/\.0$/, "");
}
