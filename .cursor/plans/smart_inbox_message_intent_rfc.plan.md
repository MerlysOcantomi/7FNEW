---
name: Smart Inbox message-level intent (RFC)
overview: RFC de producto y arquitectura — de conversación a intención por mensaje, con focusedMessageId, MessageIntent, fases 1–5 y capa de automatización. Listo para prompts de implementación (Fase 1+2).
todos:
  - id: phase-1-focus-reply
    content: "Fase 1: focusedMessageId, thread scroll/highlight, sendReply con sourceMessageId + fallback"
    status: pending
  - id: phase-2-message-intent
    content: "Fase 2: modelo MessageIntent, GET/PATCH, backfill opcional, badges de estado en thread"
    status: pending
  - id: phase-3-hub-split
    content: "Fase 3: Intelligence Hub conversación vs mensaje, acciones filtradas por sourceMessageId"
    status: pending
  - id: phase-4-left-panel
    content: "Fase 4: API {messageId, shortIntent, status}, UI clicable, ruta /inbox?id=&messageId="
    status: pending
  - id: phase-5-smart-movement
    content: "Fase 5: nextSmartMovement + dual-write con nextBestAction, flags inboxAutomation"
    status: pending
isProject: false
---

# Smart Inbox — Message-level intent system (RFC)

## 1. Product objective

The Smart Inbox must evolve from a **conversation-level** system to a **message-level operational** system.

Each relevant message inside a conversation must expose:

- A **short intent** (AI-generated)
- An **operational state**: `open` | `in_progress` | `done`

The operator (or AI) can select a message as **focused**. From that point:

- The thread scrolls to that message and highlights it
- The composer, replies, and actions are anchored to that message
- The Intelligence Hub switches to **message context**
- AI outputs align with that specific message

---

## 2. Core concept

Introduce **first-class state**:

```ts
focusedMessageId: string | null
```

---

## 3. Target UX behavior

When a message intent is selected:

1. Set `focusedMessageId`
2. Thread scrolls to that message
3. Message is visually highlighted
4. Composer reflects **replying to selected message** (copy/UX)
5. Intelligence Hub switches to **message mode**
6. Actions and suggestions reference this message

---

## 4. Current system audit (summary)

### Already implemented

- Short intent per message: `Message.metadata.shortIntent`, generated async
- `sourceMessageId` supported in messages API (and drafts/actions in schema)
- Left panel: max 3 intent lines via `pickExpandedIntents`
- Intelligence: summary, `nextBestAction`, suggested actions at conversation level

### Gaps

- No `focusedMessageId` in UI
- No intent state (`open` | `in_progress` | `done`)
- Composer does not send `sourceMessageId` today
- Thread cannot scroll/highlight per message
- Intelligence Hub is conversation-only
- No structured `MessageIntent` model
- No automation configuration layer for inbox orchestration
- `nextBestAction` not aligned with orchestration vision (address in Phase 5)

---

## 5. Data model strategy

### New Prisma model

```prisma
model MessageIntent {
  id             String   @id @default(cuid())
  workspaceId    String
  conversationId String
  messageId      String   @unique

  shortIntent    String
  status         String   // open | in_progress | done

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Relations to `Workspace`, `Conversation`, `Message` should be added per project conventions (indexes on `workspaceId`, `conversationId`).

### Decision: avoid drift

- **`MessageIntent` is the source of truth** for `shortIntent` + `status`
- **`Message.metadata.shortIntent`** kept for backward compatibility / ingestion only; sync or read-path merge policy must be explicit in implementation tasks

---

## 6. System flow

```
User selects intent/message
        → focusedMessageId is set
        → Thread scroll + highlight
        → Composer + APIs use sourceMessageId (= focusedMessageId or fallback)
        → Intelligence Hub switches to message mode (Phase 3+)
```

---

## 7. Implementation plan

### Phase 1 — Focus + reply anchoring

**Goals:** message focus; replies anchored to message.

**Tasks:**

- UI state: `focusedMessageId`; reset when conversation selection changes
- Pass focus props into `ConversationThread`
- Thread: `data-message-id`, refs or scroll target per message, `scrollIntoView`, highlight CSS class
- `sendReply`: `sourceMessageId = focusedMessageId ?? fallbackMessageId` (define fallback: e.g. last inbound or last thread message — document in PR)

**Success criteria:**

- Outbound messages persist correct `sourceMessageId` when focus is set
- Visual focus (scroll + highlight) works

---

### Phase 2 — MessageIntent + status

**Goals:** operational state on intents.

**Tasks:**

- Add Prisma model + migrate/push per repo practice
- API: GET intents per conversation; PATCH status (authorize by workspace)
- Optional backfill from `metadata.shortIntent` into `MessageIntent`
- UI: badges on messages — Open / In Progress / Done

---

### Phase 3 — Intelligence Hub split

**Conversation mode** (no focus or explicit “conversation overview”):

- Current summary / `nextBestAction` / history patterns

**Message mode** (`focusedMessageId` set):

- Message summary, intent, message-specific suggestions
- Filter actions: `action.sourceMessageId === focusedMessageId` when applicable

---

### Phase 4 — Left panel (top 3 intents)

**Goals:** actionable intents.

**Tasks:**

- Extend API to return `{ messageId, shortIntent, status }[]` (aligned with top-3 rule)
- UI: each line clickable → open conversation + set `focusedMessageId`
- Routing: `/inbox?id=<conversationId>&messageId=<messageId>` — restore focus on load

---

### Phase 5 — Next Smart Movement

**Do not break the existing system.**

- Introduce `nextSmartMovement` (dual-write or layered mapping)
- Keep `nextBestAction` during transition; map legacy → new types in code
- Update prompts gradually

**Types (union):**

`request_missing_requirements` | `create_client` | `create_project` | `generate_invoice` | `generate_report` | `generate_price_guidance` | `orchestrate_freya` | `orchestrate_mr_forte` | `assign_operator` | `schedule_followup`

---

## 8. Automation layer

**Storage:** `Workspace.config.inboxAutomation` (JSON), e.g.:

```json
{
  "autoCreateClient": true,
  "autoCreateProject": false,
  "autoSendEmail": true,
  "requireApproval": true
}
```

**Behavior:**

- OFF → suggest only  
- ON → auto-execute where implemented  
- `requireApproval` → queue / confirmation flow  

---

## 9. Intelligence Hub — target structure

**Always visible (where data exists):**

- Past work with client, previous actions, historical context

**Message mode:**

- Intent, summary, Next Smart Movement, suggested reply (if relevant), actions

**Conversation mode:**

- Global summary, case state, overview

---

## 10. Key risks

1. **AI over-triggering** — generate per message only when focused, marked in progress, or explicitly requested  
2. **Data drift** — single source of truth for intents (`MessageIntent`)  
3. **Performance** — avoid recomputing full intelligence on every click  
4. **UX overload** — keep max 3 intents in list; progressive disclosure elsewhere  

---

## 11. Core principle

> The inbox no longer operates on conversations alone. It operates on **intentions within messages**.

---

## 12. Final summary

This implementation:

- Leverages existing metadata + `sourceMessageId` plumbing  
- Adds `focusedMessageId` and `MessageIntent`  
- Evolves AI from suggestion toward orchestration without big-bang removal of `nextBestAction`  
- Enables future multi-agent workflows  

---

## Next step (recommended)

**Implementation prompt (Phase 1 + 2) is in the repo:** [`smart_inbox_phase_1_2_implementation_prompt.md`](./smart_inbox_phase_1_2_implementation_prompt.md) — includes the short Spanish paste line, full English spec, constraints, edge cases, deliverables, and non-goals.

When executing: inspect current code paths first; define **`fallbackMessageId`** explicitly (e.g. latest inbound vs last message). Optional URL restore (`messageId` query) stays out of scope unless trivial — per non-goals in that prompt.
