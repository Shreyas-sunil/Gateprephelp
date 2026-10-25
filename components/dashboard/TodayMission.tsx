"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { setMission } from "@/lib/actions";
import { recommendations } from "@/lib/analytics";
import { uid } from "@/lib/defaults";
import { Button, IconButton, Input, cx } from "@/components/ui";
import { TOPIC_MAP } from "@/data/syllabus";
import type { MissionItem } from "@/types";

export function TodayMission({ compact = false }: { compact?: boolean }) {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const toast = useToast();
  const [draft, setDraft] = useState("");
  if (!data || !a) return null;
  const log = data.dayLogs.find((d) => d.date === today);
  const items = log?.mission ?? [];
  const done = items.filter((i) => i.done).length;

  const save = (next: MissionItem[]) => setMission(today, next);

  const suggest = () => {
    const out: MissionItem[] = [];
    const todays = data.tasks.filter((t) => t.date === today && t.status === "todo").sort((x, y) => (x.block ?? 9) - (y.block ?? 9) || x.order - y.order);
    for (const t of todays.slice(0, 2)) out.push({ id: uid("m"), text: t.title, done: false, href: "/planner" });
    const due = a.reviews.overdue.length + a.reviews.today.length;
    if (due) out.push({ id: uid("m"), text: `Clear ${due} revision item${due > 1 ? "s" : ""} due`, done: false, href: "/revision" });
    for (const r of recommendations(data, a)) {
      if (out.length >= 5) break;
      if (r.id === "overdue") continue;
      out.push({ id: uid("m"), text: r.title, done: false, href: r.actions[0]?.href ?? (r.actions[0]?.topicId ? `/topics/${r.actions[0].topicId}` : undefined) });
    }
    if (out.length < 3 && data.settings.lastActive?.topicId) {
      const name = TOPIC_MAP[data.settings.lastActive.topicId]?.name;
      if (name) out.push({ id: uid("m"), text: `Continue ${name}`, done: false, href: `/topics/${data.settings.lastActive.topicId}` });
    }
    if (out.length < 3) out.push({ id: uid("m"), text: "Log at least 10 PYQ attempts", done: false, href: "/pyq" });
    if (out.length < 3) out.push({ id: uid("m"), text: "Write one error-notebook entry with a rule to remember", done: false, href: "/errors" });
    void save([...items, ...out].slice(0, 5));
    toast({ tone: "info", title: "Mission drafted from your plan", body: "Edit, check off or remove items." });
  };

  const add = () => {
    const text = draft.trim();
    if (!text || items.length >= 5) return;
    void save([...items, { id: uid("m"), text, done: false }]);
    setDraft("");
  };

  return (
    <div className={cx("rounded-lg border border-line bg-surface/80", compact ? "p-3.5" : "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Today&apos;s mission</h2>
        <span className="num text-xs text-ink-3">{items.length ? `${done}/${items.length} done` : "3–5 priorities"}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-line p-3 text-center">
          <p className="text-[13px] text-ink-2">Pick three to five things that would make today count.</p>
          <Button size="sm" variant="primary" className="mt-2.5" icon={<Sparkles size={14} />} onClick={suggest}>
            Draft from my plan
          </Button>
        </div>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {items.map((m) => (
              <motion.li key={m.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="group flex items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  aria-label={`Mark “${m.text}” ${m.done ? "not done" : "done"}`}
                  checked={m.done}
                  onChange={(e) => save(items.map((x) => (x.id === m.id ? { ...x, done: e.target.checked } : x)))}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                />
                <span className={cx("min-w-0 flex-1 text-[13.5px] leading-snug transition-colors", m.done ? "text-ink-3 line-through" : "text-ink")}>
                  {m.href ? (
                    <Link href={m.href} className="hover:underline">
                      {m.text}
                    </Link>
                  ) : (
                    m.text
                  )}
                </span>
                <IconButton size="sm" label="Remove item" className="opacity-60 group-hover:opacity-100" onClick={() => save(items.filter((x) => x.id !== m.id))}>
                  <Trash2 size={13} />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {items.length > 0 && items.length < 5 && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input aria-label="New mission item" placeholder="Add a priority" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 text-[13px]" />
          <IconButton label="Add priority" type="submit" size="md" className="h-8 w-8 border border-line">
            <Plus size={15} />
          </IconButton>
        </form>
      )}
      {items.length > 0 && done === items.length && <p className="mt-2 text-[12.5px] text-mint">Mission complete. Anything extra is a bonus.</p>}
    </div>
  );
}
