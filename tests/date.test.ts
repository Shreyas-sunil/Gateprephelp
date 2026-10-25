import { describe, expect, it } from "vitest";
import { addDays, diffDays, startOfWeek, toISTDate, isYmd, weekday, fmtMinutes, daysInMonth } from "@/lib/date";

describe("IST date handling", () => {
  it("uses India time, not UTC, for the calendar date", () => {
    // 2026-10-24 20:00 UTC is 2026-10-25 01:30 IST
    expect(toISTDate(Date.UTC(2026, 9, 24, 20, 0))).toBe("2026-10-25");
    // 2026-10-24 18:00 UTC is 23:30 IST, still the 24th
    expect(toISTDate(Date.UTC(2026, 9, 24, 18, 0))).toBe("2026-10-24");
  });
  it("does arithmetic across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(diffDays("2026-10-24", "2027-02-06")).toBe(105);
  });
  it("finds Monday-based weeks", () => {
    expect(weekday("2026-10-12")).toBe(1); // the PDF's Monday
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(weekday("2026-11-30")).toBe(1); // PDF calls it Sunday — it is a Monday
  });
  it("validates dates strictly", () => {
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-2-3")).toBe(false);
    expect(isYmd("2028-02-29")).toBe(true);
    expect(daysInMonth("2028-02-10")).toBe(29);
  });
  it("formats minutes", () => {
    expect(fmtMinutes(0)).toBe("0m");
    expect(fmtMinutes(95)).toBe("1h 35m");
    expect(fmtMinutes(120)).toBe("2h");
  });
});
