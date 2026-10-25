"use client";

import { SUBJECTS, topicsForSubject, TOPIC_MAP } from "@/data/syllabus";
import type { SubjectId } from "@/types";
import { Field, Select } from "./ui";
import { useId } from "react";

export function SubjectSelect({ value, onChange, allowEmpty = true, emptyLabel = "Any subject", className, id, ariaLabel }: { value?: SubjectId | ""; onChange: (v: SubjectId | undefined) => void; allowEmpty?: boolean; emptyLabel?: string; className?: string; id?: string; ariaLabel?: string }) {
  return (
    <Select id={id} aria-label={ariaLabel} className={className} value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as SubjectId | undefined)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {SUBJECTS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

export function TopicSelect({ subjectId, value, onChange, className, id, ariaLabel, emptyLabel = "No specific topic" }: { subjectId?: SubjectId; value?: string; onChange: (v: string | undefined) => void; className?: string; id?: string; ariaLabel?: string; emptyLabel?: string }) {
  const topics = subjectId ? topicsForSubject(subjectId) : [];
  const groups = [...new Set(topics.map((t) => t.group ?? ""))];
  return (
    <Select id={id} aria-label={ariaLabel} className={className} value={value ?? ""} disabled={!subjectId} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{subjectId ? emptyLabel : "Pick a subject first"}</option>
      {groups.map((g) =>
        g ? (
          <optgroup key={g} label={g}>
            {topics
              .filter((t) => t.group === g)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ) : (
          topics
            .filter((t) => !t.group)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))
        ),
      )}
    </Select>
  );
}

/** Subject + topic pair with labels. Changing subject clears a topic that no longer belongs to it. */
export function SubjectTopicFields({ subjectId, topicId, onChange, requiredSubject, className }: { subjectId?: SubjectId; topicId?: string; onChange: (v: { subjectId?: SubjectId; topicId?: string }) => void; requiredSubject?: boolean; className?: string }) {
  const sid = useId();
  const tid = useId();
  return (
    <div className={className ?? "grid gap-3 sm:grid-cols-2"}>
      <Field label={requiredSubject ? "Subject (required)" : "Subject"} htmlFor={sid}>
        <SubjectSelect
          id={sid}
          value={subjectId}
          allowEmpty={!requiredSubject || !subjectId}
          emptyLabel={requiredSubject ? "Choose a subject" : "No subject"}
          onChange={(s) => onChange({ subjectId: s, topicId: topicId && s && TOPIC_MAP[topicId]?.subjectId === s ? topicId : undefined })}
        />
      </Field>
      <Field label="Topic" htmlFor={tid}>
        <TopicSelect id={tid} subjectId={subjectId} value={topicId} onChange={(t) => onChange({ subjectId, topicId: t })} />
      </Field>
    </div>
  );
}
