"use client";

import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { recommendations, type RecAction } from "@/lib/analytics";
import { addTask, ensureReview } from "@/lib/actions";
import { Button, Panel, PanelHeader } from "@/components/ui";
import { TOPIC_MAP } from "@/data/syllabus";

export function useRecActions() {
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  return async (act: RecAction) => {
    switch (act.kind) {
      case "open-topic":
        if (act.topicId) router.push(`/topics/${act.topicId}`);
        break;
      case "link":
        if (act.href) router.push(act.href);
        break;
      case "add-task": {
        await addTask({ date: today, title: act.taskTitle ?? "Study task", subjectId: act.subjectId, topicId: act.topicId, plannedMin: 60, source: "recommendation", block: 2 });
        toast({ tone: "success", title: "Task added to today", body: act.taskTitle, action: { label: "Open planner", onClick: () => router.push("/planner") } });
        break;
      }
      case "schedule-revision":
        if (act.topicId) {
          await ensureReview("topic", act.topicId, today);
          toast({ tone: "success", title: "Revision scheduled for today", body: TOPIC_MAP[act.topicId]?.name, action: { label: "Open revision", onClick: () => router.push("/revision") } });
        }
        break;
    }
  };
}

export function WhatNext({ title = "What should I do next?" }: { title?: string }) {
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const run = useRecActions();
  if (!data || !a) return null;
  const recs = recommendations(data, a);
  return (
    <Panel>
      <PanelHeader title={title} hint="Ranked from your recorded data. Each card shows the numbers behind it." />
      <div className="px-4 pb-4">
        {recs.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-4">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <Lightbulb size={15} className="text-ink-3" /> Not enough data for recommendations yet
            </p>
            <p className="mt-1 text-[13px] text-ink-3">Recommendations appear once you log PYQ attempts (30+ overall, 10+ per subject), mock results, errors or revisions. Until then, follow today&apos;s plan.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {recs.map((r, i) => (
              <li key={r.id} className="rounded-md border border-line bg-bg-2/60 p-3">
                <div className="flex gap-3">
                  <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-soft text-[11px] font-semibold text-violet-2">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{r.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-3">{r.evidence}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.actions.map((act, j) => (
                        <Button key={j} size="sm" variant={j === 0 ? "secondary" : "ghost"} onClick={() => run(act)}>
                          {act.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
