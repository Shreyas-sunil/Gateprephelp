import type { Grade, ReviewItem, Settings } from "@/types";
import { addDays, diffDays } from "@/lib/date";

export type SrsConfig = Settings["srs"];

/**
 * Transparent SM-2-style scheduler.
 *  Again → interval = againDays, ease −0.20, reps reset, lapse +1
 *  Hard  → interval = max(1, round(prev × hardMultiplier)), ease −0.15
 *  Good  → 1st: firstGoodDays, 2nd: secondGoodDays, then round(prev × ease)
 *  Easy  → good interval × easyBonus (at least good + 1), ease +0.15
 * Ease never drops below minEase; intervals are capped at maxInterval.
 */
export function nextInterval(item: Pick<ReviewItem, "intervalDays" | "ease" | "reps">, grade: Grade, c: SrsConfig): { interval: number; ease: number } {
  const prev = Math.max(0, item.intervalDays);
  let ease = item.ease;
  const good = item.reps === 0 ? c.firstGoodDays : item.reps === 1 ? c.secondGoodDays : Math.round(Math.max(1, prev) * ease);
  let interval: number;
  switch (grade) {
    case "again":
      ease -= 0.2;
      interval = c.againDays;
      break;
    case "hard":
      ease -= 0.15;
      interval = Math.max(1, Math.round(Math.max(1, prev) * c.hardMultiplier));
      break;
    case "good":
      interval = good;
      break;
    case "easy":
      ease += 0.15;
      interval = Math.max(good + 1, Math.round(good * c.easyBonus));
      break;
  }
  ease = Math.max(c.minEase, Math.round(ease * 100) / 100);
  interval = Math.min(c.maxInterval, Math.max(1, interval));
  return { interval, ease };
}

export function applyReview(item: ReviewItem, grade: Grade, today: string, c: SrsConfig): ReviewItem {
  const { interval, ease } = nextInterval(item, grade, c);
  return {
    ...item,
    ease,
    intervalDays: interval,
    reps: grade === "again" ? 0 : item.reps + 1,
    lapses: grade === "again" ? item.lapses + 1 : item.lapses,
    due: addDays(today, interval),
    history: [
      ...item.history,
      { date: today, grade, intervalBefore: item.intervalDays, intervalAfter: interval, dueBefore: item.due, onTime: today <= item.due },
    ],
  };
}

export function newReviewItem(id: string, kind: ReviewItem["kind"], refId: string, due: string, c: SrsConfig, now = Date.now()): ReviewItem {
  return { id, kind, refId, intervalDays: 0, ease: c.startEase, reps: 0, lapses: 0, due, createdAt: now, history: [] };
}

export type DueBucket = "overdue" | "today" | "upcoming";

export function dueBucket(item: ReviewItem, today: string): DueBucket {
  if (item.due < today) return "overdue";
  if (item.due === today) return "today";
  return "upcoming";
}

/** Higher = review sooner. Overdue days, low confidence and repeated errors raise priority. */
export function reviewPriority(item: ReviewItem, today: string, extra: { confidence?: number; openErrors?: number; repeatCount?: number }): number {
  const overdue = Math.max(0, diffDays(item.due, today));
  const conf = extra.confidence && extra.confidence > 0 ? 5 - extra.confidence : 2;
  return overdue * 3 + conf * 2 + (extra.openErrors ?? 0) * 2 + (extra.repeatCount ?? 0) * 2 + item.lapses;
}
