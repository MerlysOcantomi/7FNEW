# Smart Inbox — Phase 1 + Phase 2 implementation prompt (Cursor)

Reference RFC: [`smart_inbox_message_intent_rfc.plan.md`](./smart_inbox_message_intent_rfc.plan.md)

---

## Short message to paste first (Spanish)

Paste this before the long prompt if you want a tight scope line:

> Quiero que implementes Fase 1 y Fase 2 del sistema de “message-level intent” del Smart Inbox. Prioridad absoluta: `focusedMessageId`, scroll + highlight en thread, reply anclado con `sourceMessageId`, y modelo `MessageIntent` con estado `open / in_progress / done`. Hazlo incremental, sin romper el flujo actual del inbox, y al final dame resumen, checklist manual y commit message.

---

## Full prompt (English)

You are implementing **Phase 1 and Phase 2** of a new Smart Inbox architecture in an existing Next.js + Prisma codebase.

### Goal

Evolve the inbox from a conversation-only interaction model into a **message-focused operational model**.

We are **not** redesigning the whole inbox yet.

We are implementing the foundation required for message-level intent workflows.

---

### Product behavior to enable

A message inside a conversation can become the **focused message**.

When a message is focused:

- the thread scrolls to it
- the message is visually highlighted
- replies are anchored to that message via `sourceMessageId`
- this lays the groundwork for future message-level AI context

We also need a dedicated operational model for short intents per message:

- each relevant message can have a short intent
- each intent has a status:
  - `open`
  - `in_progress`
  - `done`

This should be introduced incrementally and safely.

---

### Scope for this task

#### Implement ONLY:

**Phase 1**

- introduce `focusedMessageId` in the inbox UI state
- reset / sync it correctly when conversation changes
- add thread scroll + highlight support
- send replies using `sourceMessageId`

**Phase 2**

- introduce Prisma model `MessageIntent`
- add API support to read and update message intent status
- expose message intent status in the thread UI
- keep backward compatibility with existing `Message.metadata.shortIntent`

---

### Important constraints

- Do **not** attempt the full right-panel refactor yet
- Do **not** replace `nextBestAction` yet
- Do **not** introduce full orchestration yet
- Do **not** redesign the entire list UI yet
- Keep the system backward compatible with current data and current conversation-level flows
- Avoid broad refactors unless required for correctness

---

### Existing assumptions from current repo audit

Use these as the working baseline:

- `Message.metadata.shortIntent` already exists and is used today
- short intents are generated asynchronously
- `sourceMessageId` already exists in the backend model and is accepted by message creation routes
- the current composer / `sendReply` flow does **not** yet send `sourceMessageId`
- the thread currently does not support message focus, scroll-to-message, or visual highlighting
- there is no `focusedMessageId` state yet
- there is no dedicated `MessageIntent` model yet
- left column already has logic around max 3 intents, but that is **not the main focus of this task**
- there is already conversation-level intelligence, which we should leave intact for now

---

## Phase 1 — Focused message foundation

### 1. Add focused message state

Introduce a client-side state for:

```ts
focusedMessageId: string | null
```

Use the existing inbox page / UI state architecture in the least disruptive way possible.

**Requirements**

- when the active conversation changes, reset `focusedMessageId`
- optionally restore it from URL/query if that pattern already fits existing routing
- expose a setter so thread items and future side panels can update it

---

### 2. Thread support: message focus + scroll + highlight

Update the thread component so messages can be focused.

**Requirements**

- each rendered message bubble should have a stable DOM hook:
  - `data-message-id`
  - and/or ref map keyed by message id
- when `focusedMessageId` changes:
  - scroll that message into view
  - visually highlight it
- highlight should be subtle and product-like, not noisy
- this should work even if the thread rerenders after fetch / optimistic updates

**Expected behavior**

- if user clicks “focus this message” on a message, that message becomes highlighted
- if future UI calls `setFocusedMessageId(id)`, the thread reacts correctly

---

### 3. Add minimal per-message action in thread

For now, add the minimum UI affordance needed to test the behavior.

**Requirements**

Each inbound message with a short intent should expose at least one action like:

- “Focus”  
  or  
- clicking the short intent badge itself sets focus

Keep it minimal and consistent with the current UI.

---

### 4. Anchor reply to focused message

Update reply sending flow so message creation uses `sourceMessageId`.

**Rules**

When sending a reply:

- if `focusedMessageId` exists, send:

  ```ts
  sourceMessageId: focusedMessageId
  ```

- otherwise use a safe fallback:
  - the most recent relevant inbound message
  - or whatever existing reply target rule is already used conceptually

**Requirements**

- thread reply flow must remain backward compatible
- API payload should include `sourceMessageId`
- server route should continue handling it cleanly
- make sure no existing send modes break:
  - normal send
  - internal note mode if applicable
  - attachments if applicable

**Success criteria**

After sending a reply, the stored outbound message should preserve linkage to the focused source message.

---

### 5. Keep this implementation clean

As part of Phase 1, lightly improve separation of responsibilities if needed.

**Acceptable small refactors**

- extract helper to compute reply target message id
- extract message focus helpers
- isolate thread scroll/highlight logic

**Avoid**

- large page-level architecture rewrites
- state library migrations
- unrelated style changes

---

## Phase 2 — MessageIntent model and status

### 6. Add Prisma model

Introduce a dedicated Prisma model for message-level operational intent state.

Use something close to:

```prisma
model MessageIntent {
  id             String   @id @default(cuid())
  workspaceId    String
  conversationId String
  messageId      String   @unique

  shortIntent    String
  status         String

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

**Requirements**

- add proper relations if consistent with current schema
- add useful indexes for conversation/workspace access
- if enums already exist in the schema style, prefer a Prisma enum for status
- if the project currently prefers string status fields, stay consistent

**Recommended status values**

- `open`
- `in_progress`
- `done`

---

### 7. Migration strategy

Implement this safely.

**Requirements**

- preserve compatibility with `Message.metadata.shortIntent`
- do **not** require immediate full backfill to make the app work
- but add a sane optional backfill path if easy:
  - when loading messages with `metadata.shortIntent` and no `MessageIntent` row yet, allow creation lazily or via script/helper if appropriate

**Source of truth decision**

For now:

- use `Message.metadata.shortIntent` as backward-compatible input
- introduce `MessageIntent` as the new operational record for:
  - `status`
  - normalized `shortIntent` going forward

Do not break old messages that only have metadata.

---

### 8. Add API layer for message intents

Implement API support for reading and updating message intent state.

**Minimum endpoints**

You can either:

- extend an existing message-intents endpoint
- or create a dedicated route structure

But the API should support at least:

#### Read intents for a conversation

Return items like:

```ts
{
  messageId: string
  shortIntent: string
  status: "open" | "in_progress" | "done"
}
```

#### Update status for one message intent

Allow changing only the operational status.

**Requirements**

- if a message has `metadata.shortIntent` but no `MessageIntent` row yet:
  - the read layer should still be able to return a usable item
- updating status may create the row if missing
- validate status values strictly
- preserve workspace / conversation boundaries

---

### 9. Thread UI: show operational intent state

In the thread UI, for messages that have a short intent:

**Show**

- short intent label
- status badge

**Allow status changes**

At minimum:

- mark as in progress
- mark as done
- optionally reset to open

**UX requirements**

- keep controls lightweight
- do not clutter every message excessively
- only show where meaningful
- after update, reflect the new status without requiring a full page reload if possible

---

### 10. Keep left column out of full scope, but don’t block it

You do **not** need to fully implement the left-column redesign in this task.

However:

- structure the API so left-column top-3 intents can consume it later
- return `messageId`, `shortIntent`, and `status` in a reusable shape

---

### Implementation notes — files likely involved

Work from the existing structure and update only what is needed, likely around:

- `app/inbox/page.tsx`
- `components/inbox/conversation-thread.tsx`
- `components/inbox/...` message bubble / thread item components if split
- `app/api/inbox/conversations/[id]/messages/route.ts`
- `app/api/inbox/conversations/[id]/message-intents/...`
- `modules/inbox/service.ts`
- `lib/inbox/parse-message-metadata.ts`
- `prisma/schema.prisma`

Adjust exact file placement to current conventions.

---

### Edge cases to handle

**Focus lifecycle**

- if focused message disappears from current thread dataset, clear focus safely
- if conversation changes, clear focus
- if same conversation reloads, do not crash if focus id is stale

**Reply fallback**

- if no focused message exists, preserve current behavior as much as possible
- if focused message is invalid, fallback safely

**Status creation**

- if status update is called for a message that has no `MessageIntent` row yet but has `metadata.shortIntent`, create the row
- if neither exists, reject or ignore gracefully depending on UX path

**Visual behavior**

- focus highlight should not permanently stick on the wrong message after thread refresh
- scroll should avoid jarring repeated jumps if possible

---

### Code quality requirements

- keep TypeScript types strict
- reuse existing service boundaries where sensible
- avoid duplicating business logic between route handlers and UI
- prefer small helpers over large inline blocks
- maintain current design system / component style
- do not introduce overengineering

---

### Deliverables

At the end of the task, provide:

1. **Change summary** — what changed, files touched, behavior supported
2. **Notes on schema / migration caveats** — especially if Prisma migration strategy needed care
3. **Manual test checklist** — focusing, scroll/highlight, reply + `sourceMessageId`, MessageIntent CRUD, status in thread
4. **Suggested commit message** — one line, conventional commits

---

### Non-goals for this task

Do not implement yet:

- full ContextPanel message mode
- nextSmartMovement engine
- automation flags UI
- Freya / Mr. Forte orchestration
- full left-column operational intent redesign
- full URL deep-link restoration unless trivial and safe

---

### Final instruction

Implement this incrementally and safely.

Preserve existing inbox behavior while adding the minimum robust foundation required for message-level focus and message intent state.

Before editing, inspect the current code paths carefully and prefer the smallest correct set of changes.
