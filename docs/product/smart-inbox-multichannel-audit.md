# Smart Inbox — Multi-channel & Verticalization Audit (INBOX-CHANNELS-01)

> Status: audit + technical plan. No implementation in this mission beyond this document.
> Scope: prepare the Smart Inbox for progressive channel integration (WhatsApp, Instagram
> Direct, Facebook Messenger, TikTok, SMS, Gmail) and per-vertical configuration, keeping
> the Inbox a **common 7F capability** — no duplicated Inbox per vertical.

---

## 1. Relevant file map

### UI (routes and components)

| Path | Role |
|---|---|
| `app/inbox/page.tsx` (~4,120 lines) | The real Smart Inbox. Client component; toolbar + taxonomy chips + 3-column grid (list / thread / context). Owns filter state, quick actions, layout modes, mobile view swap. |
| `app/inbox/overview/page.tsx` + `components/inbox/overview/*` | Daily Overview briefing — **demo data only** (`overview-data.ts`). |
| `app/entrada/page.tsx` | Manual intake — **mock** (hardcoded entries, fake submit). |
| `app/comunicacion/page.tsx` | Channels/DM split view — **mock**, no API. Legacy surface. |
| `components/inbox/inbox-toolbar.tsx` | Toolbar: search, compose, work chips, channel picker, more-filters. Stateless; filter builders hardcoded here. |
| `components/inbox/inbox-taxonomy-chips.tsx` | Workspace category chips (reads `/api/workspace/taxonomies`). |
| `components/inbox/conversation-list.tsx` / `conversation-list-item.tsx` | List surface + "radar row" (channel badge, sender, short intent, urgency signal). |
| `components/inbox/conversation-channel-badge.tsx` | Hardcoded channel→icon map. |
| `components/inbox/conversation-thread.tsx` + `message-bubble.tsx` + `email-reading-view.tsx` | Center column; email gets a dedicated reading view. |
| `components/inbox/reply-composer.tsx` (~2,119 lines) | Composer. Channel-aware: email-only features gated on `channel === "email"`; `getComposerConfig` switch per channel; hardcoded `brandMap` for instagram/messenger/sms/telegram labels. |
| `components/inbox/context-panel.tsx` (~2,242 lines) | Right "Smart Hub": handoff, Fanny actions, proposed tasks, assignment, convert, category, events. Purely presentational — fed by the conversation detail payload. |
| `components/sidebar-nav.tsx` | Smart Inbox subitems as `/inbox?filter=<x>`; Inbox-focused nav derived from same list; unread badge via `/api/inbox/attention-count`. |
| `lib/inbox-labels.ts`, `lib/inbox-operator-i18n.ts`, `core/i18n/ui/*/inbox.ts` | i18n for statuses/urgency/channels/actions and inbox UI catalog. |

### Backend (transport, ingestion, intelligence)

| Path | Role |
|---|---|
| `modules/inbox/service.ts` | Data access + conversions + `mapSourceToChannel()` + status transitions. |
| `modules/inbox/state.ts` | Conversation status state machine. |
| `modules/inbox/intelligence.ts` | Fanny triage pipeline: one structured LLM call → classification, handoff, ghost draft, suggested actions; persists AIClassification + mirrors onto Conversation. |
| `modules/inbox/auto-task-policy.ts` / `auto-task-write-planner.ts` | Pure gate/planner for the only autonomous write (auto `create_task`). |
| `modules/inbox/email-inbound.ts` | Unified inbound ingestion (`ingestInboundEmail`) — email-shaped end to end. |
| `modules/inbox/email-outbound.ts` / `email-smtp.ts` / `core/email.ts` | Outbound: Resend or SMTP; subject prefixing; HTML shell; tracking pixel. |
| `modules/inbox/imap-sync.ts` + `app/api/cron/imap-sync/route.ts` | IMAP polling (cron every 5 min) with UID cursor in `ChannelConnection.syncState`. |
| `modules/inbox/connection-validator.ts` | Email provider autodiscovery (gmail/outlook/yahoo/MX) + live validation. |
| `core/inbox-tracking.ts` | HMAC tokens for open pixel / receipt confirmation (email-only read state). |
| `app/api/inbox/**` | Full route surface (list/detail/messages/read/category/actions/drafts/handoff/convert/todos/compose/fetch/attachments/canned/attention-count + public widget + Resend webhook + tracking). |
| `agents/fanny/*` | Fanny manifest (suggest-only, `canWrite: false`), system prompt, adapter. |
| `engines/ai/*` | `askMotorIA` — inbox uses mode `"operativo"` → DeepSeek; composer assist uses OpenAI modes. |

### Data model & config

| Path | Role |
|---|---|
| `prisma/schema.prisma` | `Contact`, `Conversation`, `Message`, `ConversationRead`, `ConversationAction`, `AIClassification`, `ConversationHandoff`, `ConversationDraft`, `ChannelConnection`, `WorkspaceTask`; legacy `InboxEntry`, `InboxTodo` (deprecated). No Prisma enums anywhere — kind fields are free strings validated in services. |
| `prisma/backfill-connections.ts` | Creates one default email/Resend `ChannelConnection` per workspace. The one email-hardcoded provisioning script. |
| `prisma/seed.ts` / `scripts/seed-finesse-demo.ts` | Main seed has zero inbox data; demo seed creates conversations with `channel: "manual"` only. Channel-agnostic. |
| `core/vertical-packs/*` (`beauty.ts`, `experience.ts`, `nav-profile.ts`, `specialists.ts`) | Pure declarative packs + resolvers. `BEAUTY_PACK.channels: ["whatsapp","instagram","email"]` already exists as data → `WorkspaceExperience.recommendedChannels`. |
| `core/verticals.ts` + `core/workspace.ts` | `VerticalConfig` contract, `mergeConfigs` deep merge, `getWorkspaceWithResolvedConfig`. Per-workspace config = `Workspace.config` JSON string. |
| `core/workspace-taxonomies.ts` | Typed defensive reader over `Workspace.config.taxonomies` (already has an `inbox` key). The precedent to copy for inbox config. |
| `migration.sql` (repo root) | **Not a migration** — accidentally committed PowerShell error output. Safe to delete. |

---

## 2. Current architecture (description)

- **Source of truth**: `Conversation` + `Message` tables, both with required `workspaceId`
  (Cascade). Satellite AI records: `AIClassification` (1:1), `ConversationHandoff` (1:1),
  `ConversationDraft` (ghost replies, already has `targetChannel`), `ConversationAction`
  (suggested actions). `InboxEntry` and `InboxTodo` are legacy; `WorkspaceTask` is the
  canonical work item.
- **Channel identity is two-layered**: `Conversation.channel` free string
  (`manual | web_chat | email | portal | whatsapp` via `mapSourceToChannel`) for the *type*,
  and `ChannelConnection` (`channelType` + `provider` + unique `(workspaceId,
  externalAccountId)`) for the concrete *account*. The schema is channel-generic; the code
  is not.
- **Transport is email-only**: outbound via Resend or SMTP behind three routes that all gate
  on `channel === "email"`; inbound via Resend webhook + IMAP cron, funneled through
  `ingestInboundEmail` (RFC threading, Message-ID dedup, recipient-email tenant routing).
  `web_chat` can ingest via the public widget endpoint but has no outbound transport.
  No WhatsApp/Meta/Twilio/TikTok code or SDKs exist anywhere.
- **Read/delivery state**: operator-side read is relational (`ConversationRead`, per user,
  per conversation); customer-side delivery/read lives only in `Message.metadata` JSON
  (`emailStatus`, Resend id, open-pixel fields) — email-mechanism-only.
- **Filters are real queries**: sidebar `?filter=` → `mapSidebarFilter()` →
  `{status, urgency}` params → `/api/inbox/conversations` → Prisma `where`. Channel,
  urgency, category (workspace taxonomy) and full-text `q` also filter server-side.
  Persistence is URL + two localStorage keys; **no per-user saved filters exist**.
- **Intelligence**: triage is one structured DeepSeek call (Fanny prompt) that writes
  intent/urgency/leadScore/sentiment/summary and mirrors them onto `Conversation`;
  `status` derivation and the `create_task` auto-lane gate are the only deterministic
  pieces. `category` is operator-set, validated against the workspace taxonomy. Fanny is
  suggest-only by manifest policy.
- **Verticalization machinery already exists**: pure data packs (`BEAUTY_PACK`), pure
  resolvers (`resolveWorkspaceExperience`), per-workspace overrides in `Workspace.config`
  merged by `mergeConfigs`, and a doctrine (`docs/product/7f-professional-direction-audit.md §3`)
  that sanctions exactly this split. No consumer branches on `verticalKey` directly.
- **Multi-tenant isolation** is enforced in depth: edge middleware JWT → per-route
  `requireRead/Write/AdminAccess` → `workspaceId` on every query, FK cross-tenant
  validation, header-spoofing protection.

## 3. Problems found

1. **Three disconnected notions of "channel"**: pack `recommendedChannels` (data, unused by
   the Inbox), `ChannelConnection` rows (real accounts, only surfaced in System admin), and
   the hardcoded `CHANNEL_OPTIONS` list in `app/inbox/page.tsx:272`. Nothing reconciles them.
2. **No channel capability model.** The composer decides features with `channel === "email"`
   conditionals and a hardcoded `brandMap`; there is no way to express "WhatsApp has no
   subject/CC, SMS has length limits, Instagram cannot be initiated outbound".
3. **No per-message delivery/read state** (relational). Non-email channels cannot express
   sent/delivered/read; email hides it in metadata JSON.
4. **No cross-channel contact identity.** `Contact` unification is best-effort service logic
   over `email`/`telefono`; there is no identity table for phone numbers, IG handles, PSIDs.
5. **No attachment model linked to messages.** Inbound email attachments go to blob storage
   with references in `Message.metadata`; the generic `Attachment` model has no FK to
   Message/Conversation. **IMAP sync parses but never stores attachments** (silent loss).
6. **Outbound email sets no threading headers** (`In-Reply-To`/`References`); inbound
   threading relies on substring-matching stored metadata.
7. **Filter definitions are scattered and hardcoded**: sidebar subitems
   (`components/sidebar-nav.tsx`), `mapSidebarFilter()` in `page.tsx`, toolbar builders in
   `inbox-toolbar.tsx`, `CHANNEL_OPTIONS`/`STATUS_OPTIONS` constants. Not configurable per
   vertical; no user-defined filters; no DB persistence of filter preferences.
8. **`app/inbox/page.tsx` is a ~4,120-line monolith** holding filter mapping, grid layout,
   quick actions, polling and deep-link logic — the main refactor hazard for any change.
9. **Mock surfaces linger** (`/comunicacion`, `/entrada`, `/inbox/overview` demo data) and
   can be confused with real channel work.
10. **`migration.sql` at repo root is accidental noise** (PowerShell error output, no SQL).
11. Minor hardcoded channel rules in the agent layer (`schedule_followup` suppressed for
    `manual`; portal→client role inference) — acceptable, but should move into channel/
    vertical config as it grows.

## 4. Dependencies and couplings (inventory)

Email/Gmail coupling (backend):
- `app/api/inbox/conversations/[id]/messages/route.ts:41` — outbound gate `channel !== "email"` → skip.
- `.../messages/[messageId]/retry/route.ts:42` — 400 unless email.
- `app/api/inbox/compose/route.ts:52-57` — hardcodes `channel: "email"`.
- `modules/inbox/email-inbound.ts:285,298,596-598` — contact matching and new conversations hardcode email.
- `app/api/workspaces/[id]/connections/route.ts:198-199` — connection CRUD hardcodes `channelType: "email"`, `provider: "imap_smtp"`; every connection query filters `channelType: "email"`.
- `prisma/backfill-connections.ts` — default connection hardcodes email/Resend.
- Read state: `core/inbox-tracking.ts` + `track/open|confirm` routes (pixel = email-only).
- Threading/dedup/tenant-routing in `email-inbound.ts` keyed on RFC headers and recipient email.

Channel conditionals (UI):
- `app/inbox/page.tsx:272` `CHANNEL_OPTIONS`; `conversation-channel-badge.tsx:26-34` icon map;
  `reply-composer.tsx:374,659,1013,1216-1230,1933-1999` email gates + `brandMap` + per-channel composer config.

Channel conditionals (service/agent):
- `modules/inbox/service.ts:144-158` (`mapSourceToChannel`), `:185` (role), `:242` (tipo), `:319,:360` (`isPublic`);
  `modules/inbox/intelligence.ts:456-458` (`schedule_followup` not for `manual`).

Vertical config consumers (patterns to reuse): `sidebar-nav.tsx` → `resolveNavProfile`;
`today-page-client.tsx` + `core/theme.ts` + `hooks/use-workspace-experience.tsx` →
`resolveWorkspaceExperience`; `core/workspace.ts:getWorkspaceWithResolvedConfig`;
`core/workspace-taxonomies.ts` (typed config-slice reader).

## 5. Target architecture proposal

Keep one Inbox. Introduce three pure, data-first layers plus one transport abstraction:

1. **Channel registry (core, static)** — `core/inbox/channels.ts`: one
   `ChannelDefinition` per supported channel key (`whatsapp`, `instagram`, `messenger`,
   `tiktok`, `sms`, `email`, `web_chat`, `portal`, `manual`) with **capabilities** (see §6).
   Pure data + pure lookups, mirroring the vertical-pack constraints (no db, no React,
   no icon imports — icon *tokens* resolved by the UI). This replaces `CHANNEL_OPTIONS`,
   the badge icon map, the composer `brandMap`, and the `getComposerConfig` switch.

2. **Vertical inbox config (pack + workspace)** — extend the pack with a declarative
   `inbox` block (channels order/enablement, filter set, quick actions, context-panel
   sections) surfaced through `WorkspaceExperience`; per-workspace overrides live under
   `Workspace.config.inbox` and merge via the existing `mergeConfigs`. A typed reader
   (`core/inbox/inbox-config.ts`, modeled on `core/workspace-taxonomies.ts`) computes the
   **effective config**: pack defaults ← workspace overrides, intersected with reality
   (which `ChannelConnection`s exist / which channels have conversations). Gmail is never
   removed — for Beauty it simply sorts last and stays enabled.

3. **Filter registry (core + pack + user)** — filters become data
   (`InboxFilterDefinition`, §6) compiled to the existing query params. Core ships the
   current set (needs_action/waiting/done/storage/channel/urgency/category). Vertical packs
   contribute additional definitions (Beauty: new inquiries, booking requests, pending
   confirmations, reschedules, cancellations, rebooking, no-show, unanswered). Users get
   saved filters later via a small additive model. Sidebar and toolbar render from the same
   resolved list — no `if (vertical === "beauty")` anywhere.

4. **Channel transport + ingestion contracts (behavior, core)** —
   `ChannelTransport { send(message, connection): Promise<SendResult> }` keyed by
   `(channelType, provider)`, with the current email path refactored behind
   `EmailTransport` (Resend/SMTP stays internal to it). Ingestion generalizes
   `ingestInboundEmail`'s contract into `ingestInboundMessage` (channel-tagged envelope:
   external ids for dedup, thread hints, identity hints, attachments), with the email
   adapter as first implementer. Webhook route skeletons per channel come later, with
   real APIs — not in scope now.

Data-model additions (all additive, §9): `ContactIdentity` for cross-channel identity,
`Message.deliveryStatus/deliveredAt/readAt`, `MessageAttachment` (or an FK-backed
convention on `Attachment`).

## 6. Preliminary type & entity model

```ts
// core/inbox/channels.ts — pure data
export type ChannelKey =
  | "whatsapp" | "instagram" | "messenger" | "tiktok" | "sms"
  | "email" | "web_chat" | "portal" | "manual"

export interface ChannelCapabilities {
  canSendOutbound: boolean          // manual/tiktok(initial) may be false
  canInitiateConversation: boolean  // e.g. email yes, instagram no
  supportsSubject: boolean
  supportsCcBcc: boolean
  supportsForward: boolean
  supportsAttachments: boolean
  supportsRichText: boolean         // html email vs plain/limited
  supportsDeliveryReceipts: boolean
  supportsReadReceipts: boolean
  supportsReactions: boolean
  maxMessageLength: number | null   // sms ~1600, others null
  outboundWindowHours: number | null // whatsapp/messenger 24h session rules
}

export interface ChannelDefinition {
  key: ChannelKey
  labelKey: string                  // i18n key, not literal
  iconToken: string                 // resolved to an icon by the UI layer
  capabilities: ChannelCapabilities
  providers: string[]               // e.g. email: ["resend","imap_smtp"], whatsapp: ["meta","twilio"]
}
```

```ts
// Vertical pack extension (declarative data only)
export interface VerticalInboxChannelSetting {
  key: ChannelKey
  priority: number                  // sort order in filters/toolbar
  enabled?: boolean                 // default true; never used to delete data
}

export interface VerticalInboxConfig {
  channels?: VerticalInboxChannelSetting[]
  filters?: VerticalInboxFilterSetting[]   // adds/orders/hides filter ids
  quickActions?: string[]                  // ordered action ids
  contextPanelSections?: string[]          // ordered section ids
}
// BeautyPack gains: inbox?: VerticalInboxConfig
// Workspace overrides: Workspace.config.inbox (same shape, deep-merged)
```

```ts
// core/inbox/filters.ts — filter registry
export type InboxFilterScope = "core" | "vertical" | "user"

export type InboxFilterRule =
  | { kind: "status"; statuses: string[] }
  | { kind: "urgency"; levels: string[] }
  | { kind: "channel"; channel: ChannelKey }
  | { kind: "category"; category: string }          // workspace taxonomy value
  | { kind: "intent"; intents: string[] }            // AI intent tags (vertical triage)
  | { kind: "unanswered"; olderThanHours?: number }  // last message inbound, no reply
  | { kind: "composite"; all: InboxFilterRule[] }

export interface InboxFilterDefinition {
  id: string                        // stable, e.g. "core.needs_action", "beauty.booking_requests"
  scope: InboxFilterScope
  labelKey: string                  // i18n key (user filters carry literal label instead)
  iconToken?: string
  group: "work" | "smart" | "channels" | "storage" | "custom"
  rule: InboxFilterRule
  countStrategy: "none" | "total" | "unseen"
  isDefault?: boolean               // the filter selected on first load
  hidden?: boolean
}
```

```prisma
// Additive Prisma models/fields (no destructive migration)
model ContactIdentity {
  id          String  @id @default(cuid())
  contactId   String
  channel     String            // ChannelKey
  kind        String            // "email" | "phone" | "handle" | "psid" | "external_id"
  value       String            // normalized address/number/handle
  workspaceId String
  createdAt   DateTime @default(now())
  contact   Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, channel, value])
  @@index([contactId])
}

// Message additions:
//   deliveryStatus String @default("none")  // none|queued|sent|delivered|read|failed
//   deliveredAt    DateTime?
//   readAt         DateTime?
// (email keeps writing metadata too; new fields become the canonical projection)

// MessageAttachment: { id, messageId FK, url, filename, contentType, size, workspaceId }
```

```ts
// core/inbox/transport.ts — behavior contract (later phase)
export interface OutboundMessage { conversationId: string; content: string; attachments: ...; replyToExternalId?: string }
export interface SendResult { ok: boolean; externalMessageId?: string; error?: string }
export interface ChannelTransport {
  channel: ChannelKey
  provider: string
  send(msg: OutboundMessage, connection: ChannelConnectionRecord): Promise<SendResult>
}

export interface InboundEnvelope {                 // generalization of ingestInboundEmail input
  channel: ChannelKey
  connectionId: string
  externalMessageId: string                        // dedup key
  threadHint?: { externalThreadId?: string; inReplyTo?: string[] }
  identity: { kind: string; value: string; displayName?: string }
  content: { text?: string; html?: string }
  attachments?: InboundAttachment[]
  occurredAt?: string
}
```

## 7. Vertical configuration strategy

Three merged layers, resolved by pure functions (same pattern as nav/theme/today):

1. **Core defaults** — channel registry + core filter registry. Always available.
2. **Vertical pack** (`BEAUTY_PACK.inbox`) — declarative ordering/enablement and extra
   filter definitions. Beauty initial channel priority: whatsapp (1), instagram (2),
   messenger (3), tiktok (4), sms (5), email (6). **Email/Gmail stays enabled** — only
   sorted last; nothing is hardcoded-hidden.
3. **Workspace overrides** (`Workspace.config.inbox`) — per-tenant tweaks via existing
   `mergeConfigs`; edited later from admin UI. User-level saved filters are a separate,
   later, additive persistence (small model keyed by userId+workspaceId).

Effective resolution (server): `resolveInboxExperience(workspace)` = merge(core, pack,
workspace config) ∩ reality (existing `ChannelConnection`s / channels present in data) —
channels without connections still render as filter options only if data exists; the
channel *catalog* for "connect a channel" flows come from the registry. All label keys go
through the existing i18n catalogs (en/es).

Where each future Beauty filter belongs:
- **Core**: new inquiries (status=new), unanswered, per-channel filters, urgency, storage set.
- **Vertical pack**: booking requests, pending confirmations, reschedules, cancellations,
  rebooking, no-show — these compile to `intent`/`category`/composite rules and depend on
  Beauty triage vocabulary (taxonomy seeds + Fanny intent tags), so they ship with the pack.
- **User**: saved searches / personal combinations — later phase, additive model.

## 8. Implementation phases

1. **Phase 1 — Channel registry & capabilities (pure, no DB).** Create
   `core/inbox/channels.ts` + tests; replace `CHANNEL_OPTIONS`, badge icon map, composer
   `brandMap`/`getComposerConfig` gates with registry lookups. Composer behavior for email
   is unchanged; non-email channels get capability-driven (currently read-only) config.
2. **Phase 2 — Vertical inbox config.** Add `inbox` block to pack types + `BEAUTY_PACK`;
   surface via `WorkspaceExperience`; typed reader for `Workspace.config.inbox`; wire
   toolbar/channel filter ordering to the effective config. Gmail sorts last for Beauty.
3. **Phase 3 — Filter registry.** Extract sidebar/toolbar/`mapSidebarFilter` definitions
   into core filter data; compile rules to existing query params; add `unanswered` support
   to `listConversations`; render sidebar + toolbar from the resolved list; counters per
   `countStrategy`. URL persistence unchanged.
4. **Phase 4 — Data-model additions (additive migrations + idempotent backfills).**
   `ContactIdentity` (backfilled from `Contact.email`/`telefono`), `Message.deliveryStatus/
   deliveredAt/readAt` (projected from existing email metadata), `MessageAttachment`
   (backfilled from metadata references). Fix IMAP attachment loss while touching it.
5. **Phase 5 — Transport & ingestion abstraction.** `ChannelTransport` + `InboundEnvelope`;
   refactor email behind `EmailTransport` and `ingestInboundMessage`; remove
   `channel === "email"` gates from routes (replaced by capability + transport lookup);
   set outbound threading headers. No external APIs yet.
6. **Phase 6 — Beauty triage vocabulary & filters.** Seed Beauty inbox taxonomy; extend
   Fanny prompt/config per vertical (declarative additions, not code branches); enable the
   pack's booking/confirmation/no-show filters end to end.
7. **Phase 7+ — Real channel integrations**, one mission per channel, starting with
   WhatsApp (webhook route + transport + connection UI + credentials). Instagram/Messenger
   share the Meta platform; then TikTok, SMS. Gmail API (replacing IMAP polling with push)
   becomes its own later mission for the inventory/orders use case.

## 9. Risks

- **`page.tsx` monolith**: every wiring change passes through a 4,120-line client
  component; regressions are easy. Mitigate by extracting filter resolution into
  `lib/inbox/` pure helpers with tests before rewiring UI.
- **Free-string channel values**: nothing stops a typo channel entering the DB; the
  registry must be the single validation point in services.
- **Metadata JSON as de-facto schema**: email fields, send status, intents and trash state
  all live in `Message.metadata`; projections to new columns must be idempotent and
  backwards-compatible (old rows keep metadata-only state).
- **Capability honesty**: channels genuinely differ (WhatsApp 24h session window, Instagram
  cannot initiate, SMS length limits, TikTok API limitations). The capability model must
  encode reality, not assume parity — UI must degrade gracefully.
- **Contact identity merging**: auto-linking identities across channels risks joining two
  different people; keep linking conservative (exact identity match or operator action).
- **Pre-existing gaps that could be mistaken for regressions**: IMAP attachment loss,
  missing outbound threading headers, middleware pass-through when `AUTH_SECRET` unset.
- **Triage vocabulary drift**: Beauty filters depend on intent/category values produced by
  Fanny + taxonomy; without seeding and prompt alignment, vertical filters return empty.
- **Mock surfaces** (`/comunicacion`, `/entrada`) may mislead future channel work; mark or
  retire them explicitly (product decision, not in this mission).

## 10. Recommended next mission

**INBOX-CHANNELS-02 — Channel registry + vertical inbox config (Phases 1–2).**
Pure data + wiring, no external APIs, no migrations, no destructive change:
create `core/inbox/channels.ts` (definitions + capabilities + tests), replace the three
hardcoded channel surfaces (page options, badge map, composer config) with registry
lookups, add the `inbox` block to the pack system and `Workspace.config`, and wire the
channel filter ordering for Beauty (WhatsApp → Instagram → Messenger → TikTok → SMS →
Gmail, Gmail enabled). This immediately delivers the Beauty ordering requirement,
eliminates the largest hardcoded-channel debt, and creates the foundation every later
phase builds on. Phase 3 (filter registry) is the natural INBOX-CHANNELS-03.

---

## Appendix — Answers to the audit questions

1. **Source of truth for conversations/messages?** `Conversation` + `Message` in Prisma
   (workspace-scoped, Cascade), with AI satellites (`AIClassification`, `ConversationDraft`,
   `ConversationHandoff`, `ConversationAction`). `InboxEntry`/`InboxTodo` are legacy.
2. **Can one client have conversations on multiple channels?** Structurally yes
   (`Contact → Conversation[]`, per-conversation `channel`), but identity unification
   across channels is best-effort service logic — no identity model yet (§6 fixes this).
3. **How is a channel identified today?** Free string `Conversation.channel` (type) +
   `ChannelConnection` `(channelType, provider, externalAccountId)` (account).
4. **What is coupled to Gmail/email?** All outbound transport (3 routes gated on email),
   the whole ingestion funnel (RFC threading/dedup/tenant routing), read tracking (pixel),
   connection CRUD/backfill, composer email features, `EmailReadingView`. Full inventory in §4.
5. **What is genuinely reusable?** The data model (channel-generic), the whole conversation
   UI shell (list/thread/context), quick actions (status-based, channel-agnostic), the
   Fanny pipeline (channel-injected, nearly channel-agnostic), auth/tenancy, i18n layers,
   the vertical pack/config machinery, `ChannelConnection`, the filter query pipeline.
6. **Where should per-vertical channel config live?** Pack `inbox` block (defaults) +
   `Workspace.config.inbox` (overrides) via existing `mergeConfigs`, resolved by pure
   readers modeled on `core/workspace-taxonomies.ts` — no new storage, no flags system.
7. **Common model for the six channels?** Channel registry + capabilities (§6),
   `ContactIdentity`, `InboundEnvelope` ingestion contract, `ChannelTransport` send
   contract, per-message delivery status, `MessageAttachment`.
8. **How to represent different capabilities per channel?** Explicit
   `ChannelCapabilities` data consumed by the composer/UI/services — never inferred,
   never assumed equal (§6).
9. **Which DB changes are needed?** Additive only: `ContactIdentity`,
   `Message.deliveryStatus/deliveredAt/readAt`, `MessageAttachment`; idempotent backfills;
   no destructive migration; `ChannelConnection` already fits.
10. **What can be done now without external APIs/credentials?** Phases 1–5 in full:
    registry, vertical config, filter registry, additive schema, transport abstraction —
    everything except the actual provider adapters (Phase 7+).
