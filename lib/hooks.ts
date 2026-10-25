"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { normalizeSettings } from "@/lib/defaults";
import { computeAnalytics, type Analytics } from "@/lib/analytics";
import { todayIST } from "@/lib/date";
import type { AppData } from "@/types";

/** Live view over every table. Re-renders when any record changes (including after import). */
export function useAppData(): AppData | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [settings, progress, tasks, sessions, pyqs, errors, reviews, mocks, dayLogs, userResources, resourceStates, shortlist, customProgrammes, achievements] =
      await Promise.all([
        db.settings.get("app"),
        db.progress.toArray(),
        db.tasks.toArray(),
        db.sessions.toArray(),
        db.pyqs.toArray(),
        db.errors.toArray(),
        db.reviews.toArray(),
        db.mocks.toArray(),
        db.dayLogs.toArray(),
        db.userResources.toArray(),
        db.resourceStates.toArray(),
        db.shortlist.toArray(),
        db.customProgrammes.toArray(),
        db.achievements.toArray(),
      ]);
    return {
      settings: normalizeSettings(settings),
      progress: new Map(progress.map((p) => [p.topicId, p])),
      tasks,
      sessions,
      pyqs,
      errors,
      reviews,
      mocks,
      dayLogs,
      userResources,
      resourceStates: new Map(resourceStates.map((r) => [r.id, r])),
      shortlist,
      customProgrammes,
      achievements,
    } satisfies AppData;
  }, []);
}

/** Today's IST date; updates at midnight IST. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayIST());
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = todayIST();
      setToday((prev) => (prev === t ? prev : t));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

export function useAnalytics(data: AppData | undefined, today: string): Analytics | undefined {
  return useMemo(() => (data ? computeAnalytics(data, today) : undefined), [data, today]);
}
