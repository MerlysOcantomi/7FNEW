# Manual Intake

Manual Intake is a **first-class manual capture surface** for 7F. It turns things
that happened *outside* 7F (a phone call, an in-person chat, a WhatsApp message,
an owner reminder, a recurring request) into real work inside the Smart Inbox.

7F is **Inbox-first, not Inbox-only**, and the Smart Inbox is the intake surface
for *everything that needs attention* — not only connected channel messages.
Manual Intake is the operator-typed door into that surface.

## What it is — and is not

- It **is** an official entry into the Smart Inbox as a `channel="manual"`
  conversation (reusing the existing manual channel badge — `PenSquare`).
- It is **not** a fake email (it never pretends to be an email).
- It is **not** a separate notes app.
- It is **not** another version of Today (it can *create* Today work, but it is
  not Today).

## Entry points

| Surface | Trigger | Status |
|---|---|---|
| Smart Inbox toolbar | **Capture** button (`components/inbox/inbox-toolbar.tsx`) | ✅ |
| Global New | **Manual intake** action opens the sheet instead of navigating (`lib/global-new-config.ts` + desktop/mobile panels) | ✅ |
| `/entrada` | Full deep page — kept as fallback / future "All captures" view | ✅ (unchanged) |
| Today empty state | "Capture something" CTA | ⏳ deferred (follow-up) |

All triggers open one globally-mounted sheet, controlled by
`ManualIntakeProvider` (mounted in `components/app-shell.tsx`, alongside the
Today / Agents / Ask Fanny providers). The trigger helpers are no-op-safe via an
`available` flag, so mounts outside the provider fall back to the `/entrada` href.

## Flow

1. **Capture** — source chip (Phone call / In-person / Note / Reminder / Imported),
   a "What happened?" textarea, and optional Who / When details.
2. **Fanny organized** — a local, deterministic read
   (`lib/manual-intake/interpret-capture.ts`): summary, intent, priority, suggested
   relations, suggested next steps. **No external AI call** — this is an honest
   pre-write read, not a model run.
3. **Confirm** — writes real work (see below).

## Write path status — REAL (not faked)

Confirm uses existing, safe Inbox write paths:

- **Add to Inbox as Manual** (always): `POST /api/inbox` with
  `{ nombre?, mensaje, fuente: "manual" }` → creates a `channel="manual"`
  Conversation (auto-resolves/creates the Contact and the first Message). The item
  appears in the Smart Inbox with the manual badge.
- **Create follow-up / Add to Today** (optional): `POST /api/inbox/todos` with
  `{ title, conversationId, priority, dueAt?, createdSource: "manual" }` → creates a
  `WorkspaceTask` linked to the manual conversation. "Add to Today" sets `dueAt` to
  today so it lands on the Today board. Traceability: Inbox manual item → Today task.

On success the operator is taken to the new manual item (`/inbox?id=…`).

### Deferred (shown disabled as "Soon", never faked)

- **Schedule** — needs a calendar-event write path (today `create_event` only
  exists via Fanny's suggested-action pipeline, no direct create route).
- **Connect client** — needs a conversation→client link write path.
- **Save as note** — needs an internal-note write path from this surface.
- **Persisting source kind + Fanny summary** — the `/api/inbox` body has no field
  for `sourceKind`/`summary`; they are capture-time hints only for now. Next PR:
  extend the manual create path (metadata) to persist them.

## Difference from neighbours

- **Internal note**: a note lives on an existing conversation; Manual Intake
  *creates* a new manual conversation.
- **Task / Today**: Manual Intake can spawn a `WorkspaceTask`, but it is a capture
  surface, not a task manager.
- **Quick Capture**: may later route into Manual Intake; not implemented here.
- **Agents**: Fanny captures/summarizes. Fiona (connect client), Felix (payment),
  Mr. Forte (vertical patterns) can extend later — they must not duplicate Manual
  Intake.

## Non-goals (this PR)

No new Prisma tables, no new backend, no fake persistence, no fake emails, no
second Today, `/entrada` not removed, Global New not broken, no off-brand colors.
