# GATE CAT — The IISc Mission Control

*One syllabus. One mission. Every day counts.*

A local-first command centre for GATE CS 2027 preparation, built from your `GATE2027.pdf`: syllabus tracking, a rebased study planner, PYQ tracker, error notebook, spaced-repetition revision, mock-test analytics, a college predictor, an AI tutor (Gemini) and a cat companion.

Everything you record is stored **in your browser** (IndexedDB). There is no account, no login and no cloud database. Export a JSON backup from **Settings & Data** regularly.

---

## Quick start (local)

Requirements: **Node.js 20.9+** (22 LTS recommended) and npm.

```bash
npm install
cp .env.example .env.local      # then put your Gemini key in .env.local (optional)
npm run dev                     # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (Next.js 16, Turbopack) |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest) for progress, accuracy, streaks, rolling averages, hour aggregation, revision scheduling, error distribution/Pareto, readiness, plan rebasing, college logic, IST dates, JSON/CSV import & export |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |

First run: open the app and click **Start quick setup**. It asks for your start date, daily hours, preferred times and starting point, then fits the PDF's seven-week plan between your start date and syllabus end date (default 30 Nov 2026) and schedules the three mock phases up to your exam date.

---

## Configure the AI tutor (Gemini) securely

The tutor is optional — every other feature works without it.

1. Create a key at **Google AI Studio → API keys**: <https://aistudio.google.com/apikey>.
2. **Local:** put it in `.env.local` (already git-ignored):
   ```
   GEMINI_API_KEY=your-real-key
   # optional
   # GEMINI_MODEL=gemini-3.8-flash
   # TUTOR_RATE_LIMIT_PER_MINUTE=20
   ```
   Restart `npm run dev`.
3. **Vercel:** Project → Settings → Environment Variables → add `GEMINI_API_KEY` for Production (and Preview if you want) → redeploy.

How it's protected:

- The key is read only by server route handlers (`app/api/tutor/*`, via `lib/ai/server.ts`, which imports `server-only`). It is **never** prefixed with `NEXT_PUBLIC_`, so Next.js never ships it to the browser.
- The browser calls `/api/tutor` (streaming chat) and `/api/tutor/quiz` (structured JSON quiz). `/api/tutor/status` only reports whether a key exists.
- Requests are validated with Zod (size limits, roles, modes), rate-limited per IP (default 20/min, in-memory per server instance), and errors are mapped to safe messages. The key and request headers are never logged.
- If the key is missing, the tutor page shows setup steps instead of a broken chat.

Model choice: the default `gemini-3.8-flash` was listed as a stable model on Google's models page (<https://ai.google.dev/gemini-api/docs/models>) when this was built. Models change — set `GEMINI_MODEL` if Google retires it (the app reports a clear error if the model isn't available to your key). The SDK is the official `@google/genai`.

Tutor features: modes (first principles, ELI5, formal, step-by-step, code dry-run, PYQ discussion, explain-my-mistake, chat quiz, flashcards, revision summary, study-plan adjustment), depth selector, subject/topic selector, optional tracker context (you can see exactly what's sent), optional Google Search grounding with cited sources, streaming, Markdown + LaTeX (KaTeX) + syntax highlighting, copy, regenerate, stop, clear, suggested follow-ups, and a structured **Quiz me** mode that can log misses to the error notebook.

---

## Deploy: GitHub → Vercel

1. Unzip, then:
   ```bash
   cd gate-cat
   git init && git add . && git commit -m "GATE CAT"
   git branch -M main
   git remote add origin https://github.com/<you>/gate-cat.git
   git push -u origin main
   ```
   `.gitignore` already excludes `node_modules`, `.next`, `.env.local` and other env files.
2. On <https://vercel.com/new>, import the repo. Framework preset: **Next.js** (auto-detected). No build settings to change.
3. Add `GEMINI_API_KEY` under Environment Variables (optional), then **Deploy**.

Note: because data lives in each browser's IndexedDB, your phone and laptop won't share progress automatically. Move data with **Export all** → **Import / restore**.

---

## What's inside

| Page | Highlights |
| --- | --- |
| Mission Control | Countdown, readiness orbit (coverage / mastery / PYQ accuracy), PYQs, hours today/week vs planned, streak, revision queue, open errors, Continue Studying, Today's Mission (3–5 checkboxes), schedule, "What should I do next?", weakest subjects, mock trend, next milestone, dream-destination widget, 26-week heatmap, subject progress |
| Syllabus | All 10 official CS sections (Engineering Mathematics split into its 4 groups) + General Aptitude: 143 individually tracked topics. Status, priority, confidence, estimated vs actual time, PYQ attempts/accuracy, last studied, next revision, notes, bookmarks, evidence; filters by subject, status, priority, revision and stage |
| Planner | Day/week/month views, 3-block template, add/edit/complete/postpone/delete, drag-and-drop across the week, missed-task recovery (move all / let go), planned vs recorded time, Pomodoro + stopwatch, manual session logging, rest days, focus intention, heatmap calendar |
| Revision | SM-2-style scheduler with configurable intervals, Again/Hard/Good/Easy with next-interval preview, due/overdue/upcoming, rapid revision sessions, forgotten topics, declining accuracy |
| PYQ Tracker | Manual logging (year, Q no., marks, MCQ/MSQ/NAT, answers, result, time, difficulty, error type, guessed, revisited, notes, solution link), CSV import with template and row-level issues, CSV export, accuracy by subject/topic/type, average time, unattempted, repeated mistakes, improvement chart with sample sizes |
| Error Notebook | The PDF's Type A/B/C matrix, full fields, recurring-mistake warnings, distribution, cost-ranked topics, daily review workflow, convert to task, ask tutor |
| Mock Tests | Subject/multi/full/custom tests, subject-wise marks & time, lost-marks audit, three-round actuals vs plan, provider rank (never called AIR), score/accuracy progression, subject performance, time allocation, error distribution, "weaknesses → tasks"; editable mock phases (rebased to your exam date) and round strategy |
| Analytics | 5-second summary, progress ring, heatmap (weeks/month), study hours (day/week/month, planned vs actual, moving average, subject & range filters), mock progression, subject mastery bars (metric + sort, click-through), accuracy trend with sample-size bars, topic mastery matrix, error distribution, Pareto, revision health (incl. accuracy before/after revision), preparation funnel with stage criteria, readiness scorecard (configurable weights, "insufficient data"), subject radar with bar alternative; per-subject analytics pages |
| College Predictor | IISc featured destination, official IISc 2026–27 cut-off report rows for GATE CS, CSA M.Tech selection process, score simulator, path from current → next milestone → target → IISc, Dream/Target/Additional groups, cards with source/year/retrieval date, shortlist & top-3 pins, custom institutions, separate charts for mock marks vs GATE-score benchmarks, "What would it take?" plans from your data |
| Goals & Review | Targets, subject coverage targets, configurable milestones, weekly review with reflection |
| Resources | Every resource the PDF names, free GO Classes YouTube playlists for all 10 technical subjects (plus NPTEL's GATE portal and two alternative CN/TOC playlists), practicepaper.in as your test series, and researched official pages; verification status, cost only when checked, ratings, bookmarks, status, "Study this resource" → task + topic link |
| Strategy | The PDF preserved, verification notes kept separate, verified exam facts |
| Settings & Data | Exam date, mastery criteria, revision intervals, block template, Pomodoro, cat (name/fur/accessory, all moods), quiet mode, toasts, celebrations, theme (Midnight/Ivory), motion, college inputs, JSON export/import (merge or replace, with an automatic safety backup), per-table CSV export, delete-all with typed confirmation |

### Honesty rules built in

- Nothing is pre-filled: every number starts at zero or an empty state and is derived from your records.
- A topic counts as **mastered** only when its status is Mastered *and* confidence, PYQ volume, accuracy and (optionally) a completed revision meet your thresholds.
- Accuracy is always correct ÷ attempted with the sample size shown.
- The readiness composite says "Insufficient data" until at least 4 of 6 components have enough data, and is never described as a GATE prediction or admission probability.
- No AIR is estimated from mocks. A GATE score is estimated from mock marks **only** if you enter the official qualifying mark (Mq) and top-0.1% mean (Mt) yourself.
- Community-reported cut-offs are hidden unless you opt in, and always labelled.

---

## Research notes (checked 24 Oct 2026)

- GATE 2027 is organised by IIT Madras: exam days 6–7, 13–14, 20–21 Feb 2027; admit card 4 Jan 2027; results 19 Mar 2027. The CS paper's day/session wasn't published yet, so the default exam date is 6 Feb 2027 (earliest possible) — change it in Settings. <https://gate2027.iitm.ac.in/>
- The official CS 2027 syllabus matches the PDF section by section. <https://gate2027.iitm.ac.in/static/doc/GATE2027_Syllabus/CS_GATE2027_Syllabus.pdf>
- IISc 2026–27 M.Tech/M.Des cut-off report (official, GATE score out of 1000): <https://www.iisc.ac.in/wp-content/uploads/2026/04/MTech_MDes_cutoff_2026.pdf>. It does **not** list CSA (M.Tech CSE), so CSA shows "Data unavailable" unless you include the community-reported 2025 figure from GATE Overflow.
- IISc CSA M.Tech (CSE) selection: GATE CS shortlisting, programming test, final 70% GATE + 30% test. <https://eecs.iisc.ac.in/wp-content/uploads/2025/02/MTech-CSE.pdf>
- Official past papers: GATE 2024 (IISc) and GATE 2026 (IIT Guwahati) pages verified; GATE 2025 (IIT Roorkee) site blocked automated checks — marked "needs verification".
- No official downloadable virtual-calculator app could be verified; it's flagged.
- YouTube playlists come from GO Classes' own published list of free playlists (<https://www.goclasses.in/blog/list-of-free-cse-da-playlists-on-go-classes-youtube-channel>). The generated plan links each theory block to the matching playlist (Linear Algebra and Discrete Maths are matched per topic). There's no GO Classes playlist for Probability, Calculus or General Aptitude in that list.
- Test series: **practicepaper.in** (spelled with a *c*). Its GATE CSE mock-test and subject-wise PYQ pages were found by search, but the site blocks automated checks, so contents and pricing are marked unverified. Plan PYQ sprints and subject tests link to its subject-wise questions; Phase 1–2 mocks link to its mock-test series.
- Flags raised against the PDF (shown on the Strategy page): the plan started 12 Oct; Week 7 calls 30 Nov a Sunday (it's a Monday); GA isn't scheduled; AVL and GBN/SR aren't named in the official syllabus text; tier marks and AIR targets are the author's estimates.

---

## Project structure

```
app/                 pages (App Router) and /api/tutor routes
components/          ui primitives, shell, cat, charts, analytics, planner, errors, mocks, ai-tutor
data/                syllabus (single source of truth), PDF plan & strategy, resources, colleges, motivation
lib/                 db (Dexie/IndexedDB), actions, hooks, dates (IST), analytics, io (export/import/CSV)
lib/calc/            progress, stats, srs, errors, readiness, plan rebasing, college logic
lib/ai/              prompts, Zod schemas, rate limiter, server-only Gemini client
types/               shared TypeScript types
tests/               Vitest unit tests
```

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Dexie 4, Recharts 3, Motion, Lucide, react-markdown + KaTeX + highlight.js, Zod 4, `@google/genai`. Fonts are self-hosted from npm (Geist, Fraunces) so builds don't need network access to Google Fonts.

## Limitations

- Data is per browser; there is no sync. Clearing site data deletes it — keep backups.
- The tutor's rate limit is per server instance (serverless instances don't share it).
- Pomodoro runs while the tab is open; reopening restores the timer from its start time, but no system notification fires in the background.
- Drag-and-drop in the week view uses native HTML5 drag events (desktop). On touch screens, open a task and change its date.
- Cut-offs and admission rules change every year — re-check official pages before applying.
