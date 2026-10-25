"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { useData, useToast } from "@/components/providers";
import { useToday } from "@/lib/hooks";
import { Badge, Button, Dialog, EmptyState, Field, IconButton, Input, PageHeader, PageSkeleton, Panel, Select, Stars, Textarea, cx } from "@/components/ui";
import { SubjectSelect, SubjectTopicFields } from "@/components/pickers";
import { BUILTIN_RESOURCES, RESOURCE_TYPE_LABEL } from "@/data/resources";
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from "@/data/syllabus";
import { addTask, updateResourceState } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/defaults";
import type { CostStatus, Resource, ResourceState, ResourceType, SubjectId } from "@/types";

const COST: Record<CostStatus, { label: string; tone: "mint" | "amber" | "neutral" | "violet" }> = {
  free: { label: "Free", tone: "mint" },
  paid: { label: "Paid", tone: "amber" },
  mixed: { label: "Free + paid", tone: "violet" },
  unverified: { label: "Cost not verified", tone: "neutral" },
};

export default function ResourcesPage() {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState<ResourceType | "">("");
  const [subject, setSubject] = useState<SubjectId | undefined>();
  const [origin, setOrigin] = useState<Resource["origin"] | "">("");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [study, setStudy] = useState<Resource | null>(null);
  const [adding, setAdding] = useState(false);

  const all = useMemo(() => (data ? [...BUILTIN_RESOURCES, ...data.userResources] : []), [data]);
  if (!data) return <PageSkeleton />;
  const state = (id: string): ResourceState => data.resourceStates.get(id) ?? { id, rating: 0, bookmarked: false, status: "not_started", linkedTopicIds: [] };
  const needle = q.trim().toLowerCase();
  const list = all.filter((r) => {
    if (type && r.type !== type) return false;
    if (subject && !r.subjectIds.includes(subject)) return false;
    if (origin && r.origin !== origin) return false;
    if (onlyBookmarked && !state(r.id).bookmarked) return false;
    if (needle && !`${r.name} ${r.description} ${r.pdfMention ?? ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const groups: { key: Resource["origin"]; title: string; hint: string }[] = [
    { key: "pdf", title: "Named in your PDF", hint: "Every resource or approach GATE2027.pdf mentions, with a verified link where one exists." },
    { key: "requested", title: "YouTube playlists & test series", hint: "Free lecture playlists per subject and your chosen test series, practicepaper.in." },
    { key: "researched", title: "Researched additions", hint: "Official exam and admissions pages checked by GATE CAT on 24 Oct 2026." },
    { key: "user", title: "Your resources", hint: "Anything you add yourself." },
  ];

  return (
    <div>
      <PageHeader
        title="Resources"
        description="Links are only marked verified when GATE CAT opened them. Pricing is only stated when it was checked."
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add resource
          </Button>
        }
      />
      <Panel className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <Input aria-label="Search resources" placeholder="Search resources" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ResourceType | "")}>
            <option value="">All types</option>
            {Object.entries(RESOURCE_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <SubjectSelect ariaLabel="Subject" value={subject} onChange={setSubject} emptyLabel="All subjects" />
          <div className="flex gap-2">
            <Select aria-label="Origin" value={origin} onChange={(e) => setOrigin(e.target.value as Resource["origin"] | "")}>
              <option value="">Any origin</option>
              <option value="pdf">From PDF</option>
              <option value="requested">Playlists & tests</option>
              <option value="researched">Researched</option>
              <option value="user">Mine</option>
            </Select>
            <IconButton label={onlyBookmarked ? "Show all" : "Bookmarked only"} onClick={() => setOnlyBookmarked((v) => !v)} className={cx("border border-line", onlyBookmarked && "bg-violet-soft text-violet-2")}>
              <BookmarkCheck size={16} />
            </IconButton>
          </div>
        </div>
      </Panel>

      {list.length === 0 && (
        <Panel>
          <EmptyState title="No resources match" body="Clear a filter, or add your own resource." />
        </Panel>
      )}

      <div className="space-y-6">
        {groups.map((g) => {
          const items = list.filter((r) => r.origin === g.key);
          if (!items.length) return null;
          return (
            <section key={g.key}>
              <h2 className="text-[15px] font-semibold">{g.title}</h2>
              <p className="mb-2.5 text-[13px] text-ink-3">{g.hint}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((r) => {
                  const st = state(r.id);
                  return (
                    <Panel key={r.id} as="article" className="flex flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[14.5px] font-semibold">{r.name}</h3>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Badge>{RESOURCE_TYPE_LABEL[r.type]}</Badge>
                            <Badge tone={r.classification === "official" ? "cyan" : r.classification === "in-app" ? "violet" : "neutral"}>
                              {r.classification === "official" ? "Official" : r.classification === "in-app" ? "Built into GATE CAT" : r.classification === "personal" ? "Your choice" : "Third-party"}
                            </Badge>
                            <Badge tone={COST[r.cost].tone}>{COST[r.cost].label}</Badge>
                            {r.verification === "verified" ? <Badge tone="mint">Link verified</Badge> : r.verification === "partial" ? <Badge tone="amber">Partly verified</Badge> : <Badge tone="rose">Needs verification</Badge>}
                          </div>
                        </div>
                        <IconButton label={st.bookmarked ? "Remove bookmark" : "Bookmark"} onClick={() => updateResourceState(r.id, { bookmarked: !st.bookmarked })} className={st.bookmarked ? "text-amber" : ""}>
                          {st.bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                        </IconButton>
                      </div>
                      <p className="mt-2 text-[13px] text-ink-2">{r.description}</p>
                      {r.pdfMention && <p className="mt-1.5 text-xs text-ink-3">In your PDF: {r.pdfMention}</p>}
                      {r.verificationNote && <p className="mt-1 text-xs text-ink-3">{r.verificationNote}</p>}
                      {r.access && <p className="mt-1 text-xs text-ink-3">Access: {r.access}</p>}
                      {r.subjectIds.length > 0 && r.subjectIds.length < 10 && <p className="mt-1 text-xs text-ink-3">Subjects: {r.subjectIds.map((s) => SUBJECT_MAP[s].short).join(", ")}</p>}
                      {st.linkedTopicIds.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {st.linkedTopicIds.map((t) => (
                            <Link key={t} href={`/topics/${t}`}>
                              <Badge tone="violet">{TOPIC_MAP[t]?.name}</Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        {r.url ? (
                          r.url.startsWith("/") ? (
                            <Link href={r.url}>
                              <Button size="sm">Open in GATE CAT</Button>
                            </Link>
                          ) : (
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" icon={<ExternalLink size={13} />}>
                                Open
                              </Button>
                            </a>
                          )
                        ) : (
                          <span className="text-xs text-ink-3">No link</span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setStudy(r)}>
                          Study this resource
                        </Button>
                        <Select aria-label={`${r.name} status`} value={st.status} onChange={(e) => updateResourceState(r.id, { status: e.target.value as ResourceState["status"] })} className="h-8 w-[128px] text-xs">
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Completed</option>
                        </Select>
                        <Stars label={`Rate ${r.name}`} value={st.rating} onChange={(n) => updateResourceState(r.id, { rating: n })} />
                        {r.origin === "user" && (
                          <IconButton
                            size="sm"
                            label="Delete resource"
                            onClick={async () => {
                              await getDb().userResources.delete(r.id);
                              toast({ tone: "info", title: "Resource deleted" });
                            }}
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        )}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <StudyDialog resource={study} onClose={() => setStudy(null)} today={today} linked={study ? state(study.id).linkedTopicIds : []} />
      <AddResourceDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function StudyDialog({ resource, onClose, today, linked }: { resource: Resource | null; onClose: () => void; today: string; linked: string[] }) {
  const toast = useToast();
  const [f, setF] = useState<{ subjectId?: SubjectId; topicId?: string; date: string; minutes: number }>({ date: today, minutes: 60 });
  if (!resource) return null;
  return (
    <Dialog
      open={!!resource}
      onClose={onClose}
      title={`Study: ${resource.name}`}
      description="Links the resource to a topic and adds a task with the link."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (f.topicId && !linked.includes(f.topicId)) await updateResourceState(resource.id, { linkedTopicIds: [...linked, f.topicId] });
              await addTask({
                date: f.date,
                title: `${resource.name}${f.topicId ? `: ${TOPIC_MAP[f.topicId]?.name}` : ""}`,
                subjectId: f.subjectId,
                topicId: f.topicId,
                plannedMin: f.minutes,
                link: resource.url && !resource.url.startsWith("/") ? resource.url : undefined,
                source: "resource",
                block: resource.type === "pyq" || resource.type === "official-paper" || resource.type === "test-series" ? 2 : 1,
              });
              await updateResourceState(resource.id, { status: "in_progress" });
              toast({ tone: "success", title: "Task added", body: f.topicId ? `Linked to ${TOPIC_MAP[f.topicId]?.name}` : undefined });
              onClose();
            }}
          >
            Add study task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SubjectTopicFields subjectId={f.subjectId} topicId={f.topicId} onChange={(v) => setF({ ...f, ...v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="st-date">
            <Input id="st-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Minutes" htmlFor="st-min">
            <Input id="st-min" type="number" min={5} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function AddResourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<{ name: string; url: string; type: ResourceType; description: string; subjects: SubjectId[]; cost: CostStatus }>({ name: "", url: "", type: "notes", description: "", subjects: [], cost: "unverified" });
  const [err, setErr] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add your own resource"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!f.name.trim()) return setErr("Name it.");
              if (f.url && !/^https?:\/\//.test(f.url)) return setErr("URL must start with http:// or https://");
              await getDb().userResources.put({
                id: uid("res"),
                name: f.name.trim(),
                url: f.url || undefined,
                type: f.type,
                description: f.description,
                subjectIds: f.subjects,
                topicIds: [],
                cost: f.cost,
                classification: "personal",
                origin: "user",
                verification: "needs-verification",
                verificationNote: "Added by you.",
              });
              toast({ tone: "success", title: "Resource added" });
              setF({ name: "", url: "", type: "notes", description: "", subjects: [], cost: "unverified" });
              setErr("");
              onClose();
            }}
          >
            Add resource
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" htmlFor="ar-n">
          <Input id="ar-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="URL" htmlFor="ar-u">
          <Input id="ar-u" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="ar-t">
            <Select id="ar-t" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ResourceType })}>
              {Object.entries(RESOURCE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cost" htmlFor="ar-c">
            <Select id="ar-c" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value as CostStatus })}>
              <option value="unverified">Not sure</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="mixed">Free + paid</option>
            </Select>
          </Field>
        </div>
        <div>
          <p className="text-[13px] font-medium text-ink-2">Subjects</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => {
              const on = f.subjects.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, subjects: on ? f.subjects.filter((x) => x !== s.id) : [...f.subjects, s.id] })} className={cx("rounded-md border px-2 py-1 text-xs", on ? "border-violet bg-violet-soft" : "border-line text-ink-3")}>
                  {s.short}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Description" htmlFor="ar-d">
          <Textarea id="ar-d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        {err && <p className="text-[13px] text-rose">{err}</p>}
      </div>
    </Dialog>
  );
}
