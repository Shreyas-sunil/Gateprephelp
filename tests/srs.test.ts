import { describe, expect, it } from "vitest";
import { applyReview, nextInterval, newReviewItem, dueBucket } from "@/lib/calc/srs";
import { defaultSettings } from "@/lib/defaults";

const c = defaultSettings().srs;

describe("revision scheduling", () => {
  it("follows the documented intervals for Good", () => {
    let item = newReviewItem("r", "topic", "os-sync", "2026-10-24", c);
    item = applyReview(item, "good", "2026-10-24", c);
    expect(item.intervalDays).toBe(1);
    expect(item.due).toBe("2026-10-25");
    item = applyReview(item, "good", "2026-10-25", c);
    expect(item.intervalDays).toBe(3);
    item = applyReview(item, "good", "2026-10-28", c);
    expect(item.intervalDays).toBe(Math.round(3 * 2.5));
    expect(item.history).toHaveLength(3);
    expect(item.history.every((h) => h.onTime)).toBe(true);
  });
  it("resets on Again, lowers ease, counts lapses", () => {
    const base = { intervalDays: 20, ease: 2.5, reps: 4 };
    expect(nextInterval(base, "again", c)).toEqual({ interval: 1, ease: 2.3 });
    let item = { ...newReviewItem("r", "error", "e1", "2026-10-20", c), ...base };
    item = applyReview(item, "again", "2026-10-24", c);
    expect(item.reps).toBe(0);
    expect(item.lapses).toBe(1);
    expect(item.history[0]!.onTime).toBe(false); // reviewed after due date
  });
  it("orders Hard < Good < Easy and respects the cap and ease floor", () => {
    const base = { intervalDays: 10, ease: 2.5, reps: 3 };
    const h = nextInterval(base, "hard", c).interval;
    const g = nextInterval(base, "good", c).interval;
    const e = nextInterval(base, "easy", c).interval;
    expect(h).toBeLessThan(g);
    expect(g).toBeLessThan(e);
    expect(nextInterval({ intervalDays: 50, ease: 2.5, reps: 5 }, "easy", c).interval).toBe(c.maxInterval);
    expect(nextInterval({ intervalDays: 1, ease: 1.3, reps: 2 }, "again", c).ease).toBe(1.3);
  });
  it("buckets by due date", () => {
    const item = newReviewItem("r", "topic", "x", "2026-10-24", c);
    expect(dueBucket(item, "2026-10-24")).toBe("today");
    expect(dueBucket(item, "2026-10-25")).toBe("overdue");
    expect(dueBucket(item, "2026-10-23")).toBe("upcoming");
  });
});
