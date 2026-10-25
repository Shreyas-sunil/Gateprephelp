"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useData } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { milestoneStatuses } from "@/lib/motivation";
import { recordAchievement } from "@/lib/actions";
import { Cat } from "@/components/cat/Cat";

/** Records milestones the first time real data meets them, and shows one restrained celebration. */
export function MilestoneWatcher() {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const [celebrate, setCelebrate] = useState<{ title: string; description: string } | null>(null);
  const busy = useRef(false);

  const statuses = useMemo(() => (data && a ? milestoneStatuses(data, a, data.achievements) : []), [data, a]);

  useEffect(() => {
    if (!data || busy.current) return;
    const fresh = statuses.filter((s) => s.achieved && !s.achievedAt);
    if (!fresh.length) return;
    busy.current = true;
    void (async () => {
      let shown = false;
      for (const s of fresh) {
        const isNew = await recordAchievement(s.id);
        if (isNew && !shown && data.settings.celebrations && !data.settings.quietMode) {
          setCelebrate({ title: s.title, description: s.description });
          shown = true;
        }
      }
      busy.current = false;
    })();
  }, [statuses, data]);

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(null), 7000);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  const cat = data?.settings.cat;
  return (
    <AnimatePresence>
      {celebrate && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="fixed top-16 left-1/2 z-[70] flex w-[calc(100%-24px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-amber/40 bg-surface-2 p-3 pr-2 shadow-2xl lg:top-5"
        >
          <Cat mood="celebrating" fur={cat?.fur} accessory={cat?.accessory} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-amber">Milestone reached</p>
            <p className="text-sm font-semibold text-ink">{celebrate.title}</p>
            <p className="text-[13px] text-ink-2">{celebrate.description}.</p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setCelebrate(null)} className="self-start rounded p-1 text-ink-3 hover:text-ink">
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
