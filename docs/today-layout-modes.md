# 7F — Today Layout Modes (architecture)

Status: **Accepted** · 2026-06-15 · Scope: `/today` only

This document is the canonical reference for how `/today` adapts to different
business operating models. Read it before adding a Today mode, wiring a real
data source, or touching the layout resolver. It exists so the architecture
stays small and additive instead of fragmenting into one screen per vertical.

Related code:

- Resolver + mode registry: [`modules/today/today-layout-mode.ts`](../modules/today/today-layout-mode.ts)
- Page entry / switch: [`components/today/today-page-client.tsx`](../components/today/today-page-client.tsx)
- work_first body: `TodayWorkboardLayout` (same file) + [`app/api/today/route.ts`](../app/api/today/route.ts) · [`modules/today/aggregator.ts`](../modules/today/aggregator.ts) · [`modules/today/lanes.ts`](../modules/today/lanes.ts)
- appointment_first: [`components/today/today-appointment-layout.tsx`](../components/today/today-appointment-layout.tsx) · contract [`modules/today/appointments.ts`](../modules/today/appointments.ts) · mock [`components/today/appointments/appointment-mock.ts`](../components/today/appointments/appointment-mock.ts)
- job_route: [`components/today/today-job-route-layout.tsx`](../components/today/today-job-route-layout.tsx) · contract [`modules/today/jobs.ts`](../modules/today/jobs.ts) · mock [`components/today/jobs/job-mock.ts`](../components/today/jobs/job-mock.ts)
- session_first: [`components/today/today-session-layout.tsx`](../components/today/today-session-layout.tsx) · contract [`modules/today/sessions.ts`](../modules/today/sessions.ts) · mock [`components/today/sessions/session-mock.ts`](../components/today/sessions/session-mock.ts)
- Tests: [`modules/today/today-layout-mode.test.ts`](../modules/today/today-layout-mode.test.ts) · [`modules/today/jobs.test.ts`](../modules/today/jobs.test.ts) · [`modules/today/sessions.test.ts`](../modules/today/sessions.test.ts)

---

## 1. Product principle

**Today adapts to the workspace's operating model — there is no single Today
for every business.**

- **Same route.** Everything lives at `/today`. No `/today-clinic`,
  `/today-field`, no per-vertical routes.
- **Same shell, same tokens.** Every mode renders inside the AppShell
  (`docs/app-shell-contract.md`) and uses the shared token system
  (`app/globals.css`). A mode is a different *body*, never a different chrome.
- **Different layout mode internally.** A pure resolver picks one
  `TodayLayoutMode`; `TodayPageClient` renders the matching layout.
- **The user never sees a technical mode name.** During onboarding Mr. Forte
  learns how the business runs and configures Today to match. The operator only
  ever feels *"7F understood my business and organised my day the right way."*

### Language rule (hard)

Never surface these strings in the UI, ever:

> `work_first` · `appointment_first` · `job_route` · `layout mode` ·
> `operating model` · `enableVerticalAutoSwitch`

Use natural, human language instead:

| Mode | User-facing language |
|---|---|
| work_first | **Today** · "Your daily workboard" |
| appointment_first | **Today's book** · "Today's schedule" |
| job_route | **Today's route** · "Jobs today" · "Field work today" |
| session_first · class | **Today's classes** |
| session_first · tutor | **Today's sessions** |
| session_first · care | **Community today** · "Care follow-ups" · "People to follow up" |

### Today vs Vertical Overview

Keep these distinct — do not duplicate them:

- **Today** (this doc) = *daily execution*: what to do / who to see right now.
- **Vertical Overview** (future, akin to Home in `docs/ways-of-working.md` §4) =
  *business/vertical health*: trends, totals, how the operation is doing.

A Today mode must not drift into a dashboard, and no full Vertical Overview is
built here.

---

## 2. Current modes

| Internal name | User language | Business types | Main canvas | Right rail | Data today |
|---|---|---|---|---|---|
| `work_first` | Today / daily workboard | Agencies, consulting, design, marketing, software, deliverable/task work | My work / AI work / Schedule columns + Waiting | AI work column (no separate Fanny rail) | **Real** |
| `appointment_first` | Today's book | Clinics, salons, barbers, nails, spa, by-appointment services | Day book (multi-staff) / Agenda (single-provider) | Fanny flow: Unconfirmed / Open gaps / Follow-ups | Mock (gated) |
| `job_route` | Today's route | Cleaning, repair, plumbing, electrical, HVAC, gardening, maintenance, installations, inspections, pest control, small moves, light remodeling | Adaptive: route (abstract map) / timeline / project-sites | Fanny flow: Route risks / Delayed / Payment / Evidence / Follow-ups | Mock (gated) |
| `session_first` | Today's classes / Today's sessions / Community today | Schools, academies, group classes (music/dance/language/art); 1:1 tutors/coaches/mentors; lightweight people follow-up (pastoral care, small NGOs, gentle wellness) | Protagonist (Up next / Needs you most) + timeline, per variant (class/tutor/care) | Fanny flow per variant (homework / payment / attendance / people / visits / follow-ups) | Mock (gated) |

### 2.1 work_first — the default

- **Internal name:** `work_first` (the `DEFAULT_TODAY_LAYOUT_MODE`).
- **User-facing language:** "Today", "Your daily workboard".
- **Business types:** agencies, consulting, design, marketing, software, and
  any deliverable/task-driven business.
- **Main canvas:** three lanes — *My work* / *AI work* / *Schedule* — each split
  into Overdue / Due today / Waiting-Blocked / No date.
- **Right rail / Fanny Flow:** none separate; the *AI work* lane is the AI
  channel (Send to AI / Take over).
- **Data dependencies:** `WorkspaceTask` (canonical), with legacy `Tarea` and
  `Evento` folded in by the aggregator, served by `GET /api/today`.
- **Current activation status:** **active in production**, default for everyone.
- **Mock/gated:** nothing — this is real data.
- **Real today:** yes, fully.

### 2.2 appointment_first — booking/agenda

- **Internal name:** `appointment_first`.
- **User-facing language:** "Today's book", "Today's schedule".
- **Business types:** clinics, salons, barbers, nails, spa, by-appointment
  services.
- **Main canvas:** multi-staff **day book** (hours rail + time-positioned
  blocks + now line) or single-provider **agenda** (`&staff=solo`).
- **Right rail / Fanny Flow:** Unconfirmed / Open gaps / Follow-ups, with
  **disabled** placeholder actions (no fake writes).
- **Data dependencies:** the `Appointment` / `AppointmentDay` contract
  (`modules/today/appointments.ts`). No real backend yet — `Evento` lacks
  client/service/staff/status/price.
- **Current activation status:** internal review only via
  `?todayLayout=appointment_first` (+ `&staff=solo`).
- **Mock/gated:** the **only** producer is the isolated demo adapter
  `appointment-mock.ts`; vertical auto-switch is gated **off**.
- **Real today:** nothing real yet — layout + contract are prepared; data is
  demo.

### 2.3 job_route — field-service

- **Internal name:** `job_route` (operating model: `field_service`).
- **User-facing language:** "Today's route", "Jobs today", "Field work today".
- **Business types:** cleaning, repair, plumbing, electrical, HVAC, gardening,
  maintenance, installations, inspections, pest control, small moves, light
  remodeling.
- **Main canvas (hybrid, 3 zones):** *Jobs today* list (route order) · adaptive
  center · Fanny flow. The center is **adaptive per vertical**:
  - `route` (default) — an **abstract** premium route map (NOT tiles, NOT live
    tracking) + Next-stop strip;
  - `timeline` — arrival windows on a time rail (installations);
  - `project_sites` — site cards with phase/progress (construction / light
    remodeling; long planning lives in **Projects**, not here).
- **Right rail / Fanny Flow:** Route risks / Delayed / Payment pending /
  Evidence needed / Follow-ups, each card + **one disabled** action.
- **Data dependencies:** the `Job` / `JobDay` contract (`modules/today/jobs.ts`).
  Job-route **orchestrates** jobs, it does not own them — a real source will
  draw from Inbox (creates jobs), Calendar (windows), Clients (addresses),
  Finance (payment), and an external Maps service (route/ETA).
- **Current activation status:** internal review only via
  `?todayLayout=job_route` (+ `&trade=` and `&canvas=` to preview verticals /
  canvases).
- **Mock/gated:** the **only** producer is the isolated demo adapter
  `job-mock.ts`; vertical auto-switch is gated **off**.
- **Real today:** nothing real yet — layout + contract are prepared; data is
  demo.

> **Not a maps/dispatch app.** job_route deliberately excludes GPS turn-by-turn,
> fleet/dispatch, live driver tracking, and heavy construction Gantt charts. It
> is the *operative* Today of field work, not logistics.

### 2.4 session_first — continuity (classes / 1:1 / care)

- **Internal name:** `session_first` (operating model: session/continuity).
- **User-facing language:** "Today's classes" (class) · "Today's sessions"
  (tutor) · "Community today" / "Care follow-ups" (care).
- **Business types:** schools, academies and group classes
  (music/dance/language/art, workshops); private tutors, coaches and mentors
  (1:1); lightweight people follow-up — pastoral care, small NGOs, mentoring,
  gentle wellness check-ins.
- **Main canvas (hybrid, 3 zones):** ordered left list · a **living
  protagonist** ("Up next" for class/tutor, "Needs you most" for care) + a
  timeline · a Fanny flow rail. **Three variants** share this shell:
  - `class` — canvas centres on a GROUP: subject/topic, expected attendance, a
    "Ready to teach" checklist, Join class / Take attendance.
  - `tutor` — canvas centres on ONE STUDENT: level, practice progress, today's
    focus, last session, homework; Start session / Open student / Review
    homework.
  - `care` — canvas centres on a PERSON who needs attention: warm situation
    line, last contact, a short Fanny suggestion; Call / Send a message /
    Schedule visit. Below: today's visits & calls.
- **Why it is NOT appointment_first:** session_first reuses time / up-next /
  no-show / reminder / reschedule ideas, but it is about **continuity** (what
  happened last time, what to continue, materials, homework, notes, progress,
  attendance, the ongoing relationship), not **bookings & capacity** (who comes,
  when, with which resource, what gaps remain).
- **Right rail / Fanny Flow:** derived per variant — class (Starting soon /
  Attendance / Materials / Payment / Parent messages / Sessions to summarize),
  tutor (Homework to review / Payment / Parent messages / Follow-ups), care
  (People needing attention / Calls / Visits / Waiting reply / Reminders). Each
  card + **one disabled** action (no fake writes).
- **Data dependencies:** the `TodaySession` / `TodaySessionDay` contract
  (`modules/today/sessions.ts`). A real source will draw from sessions,
  students/participants, attendance, payments, materials, homework, follow-ups
  and notes (Calendar for times, Clients for people, Finance for payments).
- **Current activation status:** internal review only via
  `?todayLayout=session_first` (+ `&variant=class|tutor|care`; invalid/absent
  variant falls back to `class`).
- **Mock/gated:** the **only** producer is the isolated demo adapter
  `session-mock.ts`; vertical auto-switch is gated **off**.
- **Real today:** nothing real yet — layout + contract are prepared; data is
  demo.

> **`care` scope boundary (read this).** In this mode `care` is a *lightweight
> people-follow-up* shape: people to follow up, visits, calls, gentle reminders,
> waiting replies, notes to capture. It is intentionally NOT:
> - the **full church/NGO/community operating model** (services, volunteers,
>   groups, members, donations, event planning, prayer requests, programs,
>   ministry comms) — that is a future **`community_first` / `ministry_first`**
>   Today mode / vertical, where `care` may live as a *secondary* shape but never
>   the primary church/community Today;
> - a **clinical / therapy product** — no diagnosis, no treatment workflow, no
>   medical claims. "Urgent" here means "a human should reach out soon", never
>   medical triage. (A quieter 1:1 *therapy tone* — private notes, no streaks/
>   scores — is a future preset/tone, not `variant=care`.)

### Today Peek

The topbar Today Peek currently reflects work_first (My work / AI work /
Schedule). Per-mode Peek variants are a **documented follow-up**, not yet built;
they will branch on the same resolved `TodayLayoutMode` (+ session variant):

- job_route → next stop / on site / en route / remaining.
- session_first · class → "Today's classes · N sessions · students · unpaid ·
  follow-ups" + "Needs attention" (send material / parent waiting / payment).
- session_first · care → "Community today · N follow-ups · visits · urgent" +
  "Needs attention" (call X before 3 PM / visit Y / waiting reply).

---

## 3. Future modes (not implemented)

The resolver switch is intentionally open so these slot in without touching
callers. They are **not implemented** — names are reserved for clarity only.

- **`order_first`** — order/fulfilment businesses (takeaway kitchens, print
  shops, e-commerce ops, repair intake). Canvas: an order queue/board by
  fulfilment stage. Data: orders.
- **`case_first`** — case/matter work (legal, accounting, support desks,
  retainer agencies, social services). Canvas: caseload by status with
  deadlines/documents. Data: cases / documents / deadlines.
- **`community_first` / `ministry_first`** — the full church / NGO / community
  operating model: services, volunteers, groups, members, donations, event
  planning, prayer requests, programs, ministry comms. session_first's `care`
  variant is only a *lightweight follow-up* shape that may live inside this
  vertical — it is never the whole community Today.
- **Therapy / clinical 1:1 tone** — a quieter session_first preset (private
  notes, no streaks/scores, discreet Fanny) for therapists / counselors /
  spiritual directors. A separate tone, not `variant=care`; no medical claims.

When one is built it MUST follow §4–§8 (gated, isolated mock, additive, tested).

---

## 4. Activation model

Order of precedence in `resolveTodayLayoutMode()`:

1. **Default = `work_first`.** Unknown/empty input always falls back here.
2. **Query param = internal review only.** `?todayLayout=<mode>` wins when valid
   (`work_first` | `appointment_first` | `job_route` | `session_first`, snake or
   kebab case); session_first also reads `&variant=class|tutor|care` (invalid →
   `class`). This is a reviewer/preview affordance, never advertised to users.
3. **workspace config / Mr. Forte = future activation.** The intended real path:
   onboarding detects the operating model and persists it on the workspace; the
   resolver reads it. **Not wired yet.**
4. **`enableVerticalAutoSwitch` stays `false`** until a real data source exists
   for the target mode. While false, `verticalKey` never auto-activates a
   non-default mode — production is `work_first` regardless of vertical.

**Invariant:** never auto-show mock data to a real workspace. Because (4) is
off everywhere in production, the only way to reach a non-default mode today is
the internal query param. This is locked by `today-layout-mode.test.ts`.

---

## 5. Data rule

- A layout mode **can** be built and reviewed against an **isolated mock**
  before any backend exists.
- Mocks **must never** be mixed with production data. Each mock is a single,
  clearly-named adapter (`appointment-mock.ts`, `job-mock.ts`, `session-mock.ts`)
  that does no I/O, registers no provider, and is imported only by its gated
  layout.
- **Real activation requires real domain data** for that mode:

  | Mode | Real data required |
  |---|---|
  | `appointment_first` | appointments (client / service / staff / status / time) |
  | `job_route` | jobs / crews / locations / windows / status / payment |
  | `session_first` | sessions / students-participants / attendance / payments / materials / homework / follow-ups / notes |
  | `order_first` | orders / line items / fulfilment stage |
  | `case_first` | cases / documents / deadlines |

- Flipping `enableVerticalAutoSwitch` to `true` for a mode is allowed **only
  after** its real source is wired and the mock is removed (see §8 deletion
  path).

---

## 6. Pricing / product tiers principle

Verticalization is layered so the core stays sellable and add-ons compound.

**Core verticalization** (the base every workspace can get):

- basic layout language (the right Today mode for the business);
- Today mode selection;
- Inbox intent vocabulary;
- simple actions;
- basic workspace operating model.

**Advanced verticalization** (higher tiers / add-ons):

- automation;
- optimization;
- integrations;
- multi-staff / multi-crew workflows;
- maps / ETA;
- reporting;
- predictive Fanny suggestions;
- vertical-specific rules.

Mode *selection* is core; the heavy machinery behind a mode (route
optimization, multi-crew dispatch assist, predictive flow) is advanced.

---

## 7. Non-goals

- **No route explosion** — one `/today`, not a route per vertical.
- **No separate product per vertical** — verticals are core + configuration, not
  copy/pasted apps.
- **No user-facing technical labels** — see the language rule (§1).
- **No hidden mock activation** — a real workspace must never silently land on
  demo data.
- **No generic dashboard** — Today answers "what do I execute today?", not "here
  are some charts".
- **No duplicated Inbox Overview** — Fanny Flow rails summarise the day's
  operational flow; they do not re-implement the Inbox briefing.

---

## 8. Implementation rules

When adding or evolving a mode:

1. **Keep `/today`.** No new routes; branch inside `TodayPageClient`.
2. **Keep `work_first` the safe default.** Never change the fallback.
3. **Additive only.** A new mode must not alter existing modes' behavior.
4. **Tokens only.** No new hardcoded hex; reuse `app/globals.css` tokens so
   themes swap by token block.
5. **Test the pure layers.** Add coverage for the resolver and any
   derivation (`*.test.ts`, `node:test` via `tsx`; e.g. `npm run test:today`).
6. **Isolate demo data.** One clearly-marked mock adapter per mode, no I/O, not
   mixed with production.
7. **Leave a clear deletion path.** Document, in the mock and the contract, that
   when the real source lands you swap the layout's data hook and delete the
   mock — nothing else should depend on it.

---

## Checks for this document

Docs-only change: no build required. If a future edit touches code/comments,
run the relevant `lint` / `tsc` / `npm run test:today`.
