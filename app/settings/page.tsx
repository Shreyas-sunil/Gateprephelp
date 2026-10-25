"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileJson, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, PageHeader, PageSkeleton, Panel, PanelHeader, Segmented, Select } from "@/components/ui";
import { ACCESSORY_LABEL, Cat, FUR_LABEL, MOOD_LABEL } from "@/components/cat/Cat";
import { resetSettings, updateSettings } from "@/lib/actions";
import { getDb, TABLE_NAMES, type TableName } from "@/lib/db";
import { clearAll, exportAll, importAll, toCsv, validateExport, type ValidationResult } from "@/lib/io";
import { downloadText, readFileText } from "@/lib/download";
import { CATEGORY_LABEL, GATE_SCORE_FORMULA } from "@/data/colleges";
import { EXAM_DEFAULTS } from "@/data/plan";
import type { CatAccessory, CatFur, GateCategory, Settings } from "@/types";
import type { CatMood } from "@/lib/motivation";

function useDraft(settings: Settings | undefined) {
  const [d, setD] = useState<Partial<Settings>>({});
  const merged = settings ? ({ ...settings, ...d } as Settings) : undefined;
  return { s: merged, dirty: Object.keys(d).length > 0, set: (p: Partial<Settings>) => setD((x) => ({ ...x, ...p })), reset: () => setD({}), draft: d };
}

export default function SettingsPage() {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const { s, dirty, set, reset, draft } = useDraft(data?.settings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ValidationResult | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearText, setClearText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [tutor, setTutor] = useState<{ configured: boolean; model?: string } | null>(null);

  useEffect(() => {
    fetch("/api/tutor/status")
      .then((r) => r.json())
      .then(setTutor)
      .catch(() => setTutor({ configured: false }));
  }, []);

  if (!data || !s) return <PageSkeleton />;

  const save = async () => {
    await updateSettings(draft);
    reset();
    toast({ tone: "success", title: "Settings saved" });
  };
  const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);

  const exportJson = async () => {
    const file = await exportAll(getDb());
    downloadText(`gate-cat-backup-${today}.json`, JSON.stringify(file, null, 2), "application/json");
    toast({ tone: "success", title: "Backup downloaded" });
  };
  const exportCsv = async (t: TableName) => {
    const rows = (await getDb().table(t).toArray()) as Record<string, unknown>[];
    if (!rows.length) return toast({ tone: "info", title: `No ${t} to export` });
    downloadText(`gate-cat-${t}-${today}.csv`, toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="Settings & data" description="Everything is stored in this browser (IndexedDB). No account, no cloud sync. Export a backup regularly." />

      <Panel>
        <PanelHeader title="Exam & study rules" />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Exam date" htmlFor="s-ex" hint={EXAM_DEFAULTS.examNote}>
            <Input id="s-ex" type="date" value={s.examDate} onChange={(e) => set({ examDate: e.target.value })} />
          </Field>
          <Field label="Finish syllabus by" htmlFor="s-se">
            <Input id="s-se" type="date" value={s.syllabusEndDate} onChange={(e) => set({ syllabusEndDate: e.target.value })} />
          </Field>
          <Field label="Streak day minimum (min)" htmlFor="s-st" hint="Recorded minutes needed for a day to count">
            <Input id="s-st" type="number" min={1} value={s.streakMinMinutes} onChange={(e) => set({ streakMinMinutes: num(e.target.value, 1) })} />
          </Field>
          <Field label="Time zone">
            <Input value="Asia/Kolkata (IST, UTC+05:30)" disabled />
          </Field>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Mastery criteria" hint="A topic counts as mastered only when all are met." />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
            <Field label="Min confidence (1–5)" htmlFor="m-c">
              <Input id="m-c" type="number" min={1} max={5} value={s.mastery.minConfidence} onChange={(e) => set({ mastery: { ...s.mastery, minConfidence: Math.min(5, num(e.target.value, 1)) } })} />
            </Field>
            <Field label="Min PYQs attempted" htmlFor="m-a">
              <Input id="m-a" type="number" min={0} value={s.mastery.minAttempts} onChange={(e) => set({ mastery: { ...s.mastery, minAttempts: num(e.target.value) } })} />
            </Field>
            <Field label="Min accuracy (%)" htmlFor="m-acc">
              <Input id="m-acc" type="number" min={0} max={100} value={s.mastery.minAccuracy} onChange={(e) => set({ mastery: { ...s.mastery, minAccuracy: Math.min(100, num(e.target.value)) } })} />
            </Field>
            <Checkbox className="sm:col-span-3" label="Require at least one completed revision" checked={s.mastery.requireReview} onChange={(v) => set({ mastery: { ...s.mastery, requireReview: v } })} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Revision intervals" hint="Used by the spaced-repetition scheduler." />
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
            {(
              [
                ["againDays", "Again (days)", 1],
                ["firstGoodDays", "1st Good (days)", 1],
                ["secondGoodDays", "2nd Good (days)", 1],
                ["maxInterval", "Max interval", 1],
                ["hardMultiplier", "Hard ×", 1],
                ["easyBonus", "Easy bonus ×", 1],
                ["startEase", "Starting ease", 1.3],
                ["minEase", "Minimum ease", 1.1],
              ] as const
            ).map(([k, l, min]) => (
              <Field key={k} label={l} htmlFor={`srs-${k}`}>
                <Input id={`srs-${k}`} type="number" step={k.includes("Days") || k === "maxInterval" ? 1 : 0.05} min={min} value={s.srs[k]} onChange={(e) => set({ srs: { ...s.srs, [k]: Math.max(min, Number(e.target.value) || min) } })} />
              </Field>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Daily block template" hint="From the PDF (3.5 + 3.5 + 2 h). The planner scales it to your daily hours." />
          <div className="space-y-2 px-4 pb-4">
            {s.blocks.map((b, i) => (
              <div key={b.id} className="grid grid-cols-[1fr_80px_120px] gap-2">
                <Input aria-label={`Block ${b.id} name`} value={b.name} onChange={(e) => set({ blocks: s.blocks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Input aria-label={`Block ${b.id} hours`} type="number" min={0} step={0.5} value={b.hours} onChange={(e) => set({ blocks: s.blocks.map((x, j) => (j === i ? { ...x, hours: num(e.target.value) } : x)) })} />
                <Input aria-label={`Block ${b.id} time`} value={b.time} onChange={(e) => set({ blocks: s.blocks.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Pomodoro" />
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
            {(
              [
                ["focus", "Focus (min)"],
                ["short", "Short break"],
                ["long", "Long break"],
                ["cyclesBeforeLong", "Blocks per long"],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l} htmlFor={`pom-${k}`}>
                <Input id={`pom-${k}`} type="number" min={1} max={k === "cyclesBeforeLong" ? 10 : 180} value={s.pomodoro[k]} onChange={(e) => set({ pomodoro: { ...s.pomodoro, [k]: num(e.target.value, 1) } })} />
              </Field>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Cat companion" />
        <div className="flex flex-col gap-5 px-4 pb-4 lg:flex-row">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="cat-n">
              <Input id="cat-n" maxLength={24} value={s.cat.name} onChange={(e) => set({ cat: { ...s.cat, name: e.target.value || "Mochi" } })} />
            </Field>
            <Field label="Fur" htmlFor="cat-f">
              <Select id="cat-f" value={s.cat.fur} onChange={(e) => set({ cat: { ...s.cat, fur: e.target.value as CatFur } })}>
                {Object.entries(FUR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Accessory" htmlFor="cat-a">
              <Select id="cat-a" value={s.cat.accessory} onChange={(e) => set({ cat: { ...s.cat, accessory: e.target.value as CatAccessory } })}>
                {Object.entries(ACCESSORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2 sm:col-span-3">
              <Checkbox label="Quiet mode — hide motivational messages and toasts (errors still show)" checked={s.quietMode} onChange={(v) => set({ quietMode: v })} />
              <Checkbox label="Show toast notifications" checked={s.toasts} onChange={(v) => set({ toasts: v })} />
              <Checkbox label="Celebrate milestones (one banner per new milestone)" checked={s.celebrations} onChange={(v) => set({ celebrations: v })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(Object.keys(MOOD_LABEL) as CatMood[]).map((m) => (
              <div key={m} className="flex flex-col items-center rounded-md border border-line p-2">
                <Cat mood={m} fur={s.cat.fur} accessory={s.cat.accessory} size={64} />
                <span className="mt-1 text-center text-[11px] text-ink-3">{MOOD_LABEL[m]}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Appearance" />
          <div className="space-y-4 px-4 pb-4">
            <Field label="Theme" group>
              <Segmented label="Theme" value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: "midnight", label: "Midnight" }, { value: "ivory", label: "Ivory" }]} />
            </Field>
            <Field group label="Motion" hint="“System” follows your device's reduced-motion setting.">
              <Segmented label="Motion" value={s.motion} onChange={(v) => set({ motion: v })} options={[{ value: "system", label: "System" }, { value: "reduced", label: "Reduced" }, { value: "full", label: "Full" }]} />
            </Field>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="College predictor inputs" hint="Kept separate from mock marks. Nothing here is fetched or guessed." />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            <Field label="Category for cut-off comparisons" htmlFor="c-cat">
              <Select id="c-cat" value={s.category} onChange={(e) => set({ category: e.target.value as GateCategory })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Official GATE 2027 score (after results)" htmlFor="c-gs">
              <Input id="c-gs" type="number" min={0} max={1000} value={s.actualGateScore ?? ""} onChange={(e) => set({ actualGateScore: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Qualifying mark Mq" htmlFor="c-mq" hint="From an official GATE CS result report">
              <Input id="c-mq" type="number" step={0.01} value={s.gateConversion.mq ?? ""} onChange={(e) => set({ gateConversion: { ...s.gateConversion, mq: e.target.value ? Number(e.target.value) : undefined } })} />
            </Field>
            <Field label="Top-0.1% mean Mt" htmlFor="c-mt">
              <Input id="c-mt" type="number" step={0.01} value={s.gateConversion.mt ?? ""} onChange={(e) => set({ gateConversion: { ...s.gateConversion, mt: e.target.value ? Number(e.target.value) : undefined } })} />
            </Field>
            <Field label="Where these values came from" htmlFor="c-ref" className="sm:col-span-2">
              <Input id="c-ref" placeholder="e.g. GATE 2026 CS result report" value={s.gateConversion.reference ?? ""} onChange={(e) => set({ gateConversion: { ...s.gateConversion, reference: e.target.value || undefined } })} />
            </Field>
            <p className="text-xs text-ink-3 sm:col-span-2">{GATE_SCORE_FORMULA.text} Verify against the GATE 2027 information brochure. Without Mq and Mt, GATE CAT won&apos;t estimate a score from mock marks.</p>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="AI tutor" />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4 text-[13px]">
          {tutor === null ? (
            <span className="text-ink-3">Checking…</span>
          ) : tutor.configured ? (
            <>
              <Badge tone="mint">Gemini key configured on the server</Badge>
              <span className="text-ink-3">Model: {tutor.model}</span>
            </>
          ) : (
            <>
              <Badge tone="amber">Not configured</Badge>
              <span className="text-ink-2">Set GEMINI_API_KEY as a server environment variable (see README). Everything else works without it.</span>
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Your data" hint="Stored only in this browser. Clearing site data or switching browsers loses it unless you export." />
        <div className="space-y-4 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download size={15} />} onClick={exportJson}>
              Export all (JSON backup)
            </Button>
            <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
              Import / restore JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Backup file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setImportState(validateExport(JSON.parse(await readFileText(f))));
                } catch {
                  setImportState({ ok: false, errors: ["The file isn't valid JSON."], counts: {} });
                }
              }}
            />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-2">Export a table as CSV</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(["progress", "tasks", "sessions", "pyqs", "errors", "reviews", "mocks"] as TableName[]).map((t) => (
                <Button key={t} size="sm" variant="ghost" icon={<FileJson size={13} />} onClick={() => exportCsv(t)}>
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              Reset settings to defaults
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmClear(true)}>
              Delete all data
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <ShieldCheck size={13} /> GATE CAT has no login and no server database. The AI tutor sends only your question and the context shown on that page to the server route, which forwards it to Gemini.
          </p>
        </div>
      </Panel>

      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-3 lg:bottom-5">
          <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-4 py-2.5 shadow-2xl">
            <span className="text-[13px] text-ink-2">Unsaved changes</span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Save settings
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!importState}
        onClose={() => setImportState(null)}
        title="Import backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportState(null)}>
              Cancel
            </Button>
            <Button
              variant={importMode === "replace" ? "danger" : "primary"}
              disabled={!importState?.ok}
              onClick={async () => {
                if (!importState?.file) return;
                if (importMode === "replace") {
                  const backup = await exportAll(getDb());
                  downloadText(`gate-cat-before-restore-${today}.json`, JSON.stringify(backup), "application/json");
                }
                await importAll(getDb(), importState.file, importMode);
                setImportState(null);
                toast({ tone: "success", title: importMode === "replace" ? "Data restored from backup" : "Backup merged" });
              }}
            >
              {importMode === "replace" ? "Replace all data" : "Merge into my data"}
            </Button>
          </>
        }
      >
        {importState && (
          <div className="space-y-3 text-[13px]">
            {importState.ok ? (
              <>
                <p className="text-mint">Valid GATE CAT backup.</p>
                <ul className="grid grid-cols-2 gap-x-4 text-ink-2">
                  {TABLE_NAMES.filter((t) => importState.counts[t]).map((t) => (
                    <li key={t} className="flex justify-between">
                      <span>{t}</span>
                      <span className="num">{importState.counts[t]}</span>
                    </li>
                  ))}
                </ul>
                <Segmented label="Import mode" value={importMode} onChange={setImportMode} options={[{ value: "merge", label: "Merge (keep existing)" }, { value: "replace", label: "Replace everything" }]} />
                {importMode === "replace" && <p className="text-amber">Replace deletes all current data first. A safety backup of your current data will download automatically.</p>}
              </>
            ) : (
              <>
                <p className="text-rose">This file can&apos;t be imported:</p>
                <ul className="list-disc pl-5 text-ink-2">
                  {importState.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmClear}
        onClose={() => {
          setConfirmClear(false);
          setClearText("");
        }}
        title="Delete all data?"
        description="This permanently removes every topic record, task, session, PYQ, error, review, mock and setting from this browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={clearText !== "DELETE"}
              onClick={async () => {
                await clearAll(getDb());
                setConfirmClear(false);
                setClearText("");
                toast({ tone: "info", title: "All data deleted" });
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[13px]">
          <Button size="sm" icon={<Download size={14} />} onClick={exportJson}>
            Download a backup first
          </Button>
          <Field label="Type DELETE to confirm" htmlFor="del-c">
            <Input id="del-c" value={clearText} onChange={(e) => setClearText(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset settings?"
        body="Goals, thresholds, cat and appearance return to defaults. Your study records are not touched."
        confirmLabel="Reset settings"
        onConfirm={async () => {
          await resetSettings();
          reset();
          toast({ tone: "info", title: "Settings reset" });
        }}
      />
    </div>
  );
}
