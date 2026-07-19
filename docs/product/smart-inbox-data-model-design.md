# Smart Inbox — Multi-channel Data Model Design (INBOX-DATA-04A)

> Status: **design proposal — awaiting approval**. No schema change, no migration,
> no backfill and no product code is part of this mission. INBOX-DATA-04B
> implements whatever is approved here.
>
> Base: INBOX-CHANNELS-02 (`c03631e`), INBOX-FILTERS-03 (`f44828c`),
> `docs/product/smart-inbox-multichannel-audit.md` (phase 4).

---

## 1. Branch state (verified before analysis)

- Branch `claude/smart-inbox-audit-vertical-g0u7u1`, HEAD `f44828c` (INBOX-FILTERS-03),
  parent `c03631e` (INBOX-CHANNELS-02) — both present and pushed.
- `git status --short`: empty. Working tree clean, no staged or untracked files,
  branch up to date with origin.

## 2. Current schema (relevant excerpts)

- **`Contact`** (schema.prisma:435): `email?`, `telefono?`, `canal`, `source?`,
  `clienteId?`, required `workspaceId` (Cascade). Non-unique indexes
  `[workspaceId, email]`, `[workspaceId, telefono]`. Identity today = whichever
  of the two scalar columns happens to match at ingestion time.
- **`Message`** (schema.prisma:536): `role`, `direction`, `content`,
  `contentType`, `metadata String?` (free JSON text), `isInternal`,
  `sourceMessageId?`, `connectionId?`, required `workspaceId`. **No delivery or
  read columns.** Send status lives in metadata keys written by the outbound
  routes: `emailStatus` (`pending|sent|failed`), `resendId`, `emailError`,
  `fromAddress`, `emailAttemptedAt`, `emailRetryAt`; read/open signals are
  written by the tracking-pixel route: `openedAt`, `lastOpenedAt`, `openCount`,
  `openProxy`, `openSuspect`, plus manual receipt confirmation keys.
- **`Attachment`** (schema.prisma:1015): generic polymorphic record
  (`module` + `recordId`, OCR/scan pipeline, `workspaceId` **nullable**,
  SetNull). Not FK-linked to Message/Conversation. Message attachments today
  are references inside `Message.metadata` (Resend inbound path); the IMAP
  sync parses but **never stores** attachments.
- **`ChannelConnection`** (schema.prisma:1036): `channelType`, `provider`,
  `config String?`, `credentials String?` (AES-256-GCM), `externalAccountId?`
  (unique per workspace), `isDefault`, `syncState String?`, `lastSyncAt`,
  `lastError`. No token expiry, no provider account id column, no
  usage-classification hint.
- **Conventions that bind this design** (stated in existing schema comments):
  no Prisma enums (free `String` + service-layer validation); metadata is a
  JSON **string** (`TEXT` under sqlite/libsql — Prisma's `Json` type is NOT
  supported on SQLite, so every `Json?` in the mission brief becomes
  `String?` here); required `workspaceId` with `onDelete: Cascade` on
  current-generation models; FK-less scalar link ids only where audit rows
  must outlive their source.

## 3. Problems the new models solve

1. Cross-channel identity is best-effort string matching over two Contact
   columns; there is no room for handles, PSIDs, visitor ids, or multiple
   addresses, and no idempotent place for ingestion to record "who this is".
2. Delivery/read state is email-mechanism-only and lives in schemaless
   metadata: not queryable, not per-channel, impossible for WhatsApp-style
   receipts.
3. Message attachments have no relational home; IMAP silently loses them.
4. `ChannelConnection` cannot route provider webhooks (no provider account id
   column) nor express token lifecycle or number-usage policy.
5. `ConversationScope` (business/personal) has a documented contract
   (`core/inbox/conversation-scope.ts`) but no landing plan.

---

## 4. Proposed models (exact)

### 4.1 `ContactIdentity`

```prisma
model ContactIdentity {
  id              String   @id @default(cuid())
  workspaceId     String
  contactId       String
  /// Registry channel id (`core/inbox/channel-registry.ts`): "email",
  /// "whatsapp", "instagram", "messenger", "tiktok", "sms", "web_chat", …
  channel         String
  /// Transport provider when known: "resend" | "imap_smtp" | "meta" |
  /// "twilio" | … NON-NULL with default "unknown" so it can participate in
  /// the dedupe key (SQLite treats NULLs as distinct in unique indexes).
  provider        String   @default("unknown")
  /// What the value IS: "email" | "phone" | "handle" | "psid" | "external_id"
  /// | "visitor". Kept separate from `channel` because e.g. WhatsApp and SMS
  /// both key on a phone.
  kind            String
  /// Provider-scoped opaque id (Messenger PSID, Instagram-scoped user id,
  /// WhatsApp wa_id, web-chat visitorId). Null for plain address identities.
  externalId      String?
  /// Canonical comparable value: lowercased/trimmed email, E.164 phone when
  /// confidently normalizable (digits-only otherwise, flagged in metadata),
  /// lowercased handle without "@". Never null — for pure external-id
  /// identities it mirrors `externalId`.
  normalizedValue String
  /// Human-facing form ("@lola.nails", "+34 612 34 56 78", display name).
  displayValue    String?
  isPrimary       Boolean  @default(false)
  isVerified      Boolean  @default(false)
  verifiedAt      DateTime?
  /// Where the row came from: "backfill" | "ingestion" | "manual" | "merge".
  source          String   @default("ingestion")
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  /// Provider-specific JSON string (normalization flags, page id, profile
  /// URL). NEVER tokens/secrets — those live only in
  /// ChannelConnection.credentials (encrypted).
  metadata        String?
  /// Deterministic idempotency key computed in the service layer:
  ///   `${channel}|${provider}|${externalId ?? normalizedValue}`
  /// Unique PER CONTACT (see @@unique) so re-running ingestion/backfill can
  /// upsert instead of duplicating.
  dedupeKey       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contact   Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, contactId, dedupeKey])
  @@index([workspaceId, channel, normalizedValue])
  @@index([workspaceId, provider, externalId])
  @@index([contactId])
}
```

(Plus back-relations: `Workspace.contactIdentities ContactIdentity[]`,
`Contact.identities ContactIdentity[]`.)

**Uniqueness — what and why.** The ONLY unique constraint is
`[workspaceId, contactId, dedupeKey]`: "one row per identity *per contact*".
This makes ingestion and backfill idempotent (upsert on the natural key)
while deliberately **allowing**:

- two different contacts sharing one value (family/shared phone, generic
  info@ address) — resolution logic treats >1 match as *ambiguous* and never
  auto-merges;
- the same phone appearing under `whatsapp` and `sms` (different `channel`
  in the key);
- the same external id under two providers, and the same person having
  distinct page-scoped PSIDs (different `provider`/`externalId`);
- historical identities (old handle kept with `lastSeenAt` frozen; a new row
  carries the current one; `isPrimary` marks the preferred identity per
  channel, enforced in the service layer, not by the DB).

A global `@@unique([workspaceId, channel, normalizedValue])` was rejected
exactly because it forbids the legitimate cases above and would make the
first backfill collide on shared values. Contact resolution reads through
`[workspaceId, channel, normalizedValue]` (non-unique) and applies policy:
exactly one match → link; several → ambiguous (keep separate, log conflict);
none → create. Manual linking and conservative merges are service flows that
move identity rows between contacts with `source: "manual" | "merge"`.

### 4.2 `Message` delivery/read columns (projection, no event table yet)

```prisma
// Added to model Message:
  /// Outbound delivery projection: "none" (inbound/internal/N-A) | "queued"
  /// | "sending" | "sent" | "delivered" | "read" | "failed" |
  /// "undeliverable" | "cancelled". Monotonic — see delivery-projection.ts.
  deliveryStatus    String    @default("none")
  sentAt            DateTime?
  deliveredAt       DateTime?
  readAt            DateTime?
  failedAt          DateTime?
  /// Stable machine code ("provider_rejected", "invalid_recipient", …).
  /// Human/free-text reason stays in metadata (may contain PII).
  failureCode       String?
  /// Last projection update — lets out-of-order callbacks be applied safely.
  deliveryUpdatedAt DateTime?

  @@index([workspaceId, deliveryStatus])
```

Decisions:

- **Columns vs metadata**: the seven fields above become columns (queryable,
  channel-neutral). Everything provider-shaped stays in metadata: `resendId`,
  raw callback payloads, `emailError` free text, open-pixel heuristics
  (`openCount`, `openProxy`, `openSuspect`), retry bookkeeping.
- **`sentAt` semantics already exist**: `metadata.emailAttemptedAt` with
  `emailStatus:"sent"` is today's sent timestamp; the backfill projects it.
- **No-read-receipt channels**: their projection simply never reaches
  `read`; the channel registry (`readReceipts: false`) tells the UI not to
  expect it. No DB special-casing.
- **Monotonicity / out-of-order callbacks**: a pure
  `projectDeliveryEvent(current, event)` helper (new
  `modules/inbox/delivery-projection.ts`, fully unit-tested) owns the state
  machine: rank `none < queued < sending < sent < delivered < read`; a
  status never downgrades in rank; `failed`/`undeliverable`/`cancelled` are
  only reachable from pre-`delivered` states; timestamps are set
  independently (a late `delivered` callback fills `deliveredAt` without
  touching `readAt` or the already-higher status). All writers go through
  this helper — no inline transitions.
- **`MessageDeliveryEvent` table: NOT now.** A projection is sufficient
  while email (one provider, pixel heuristic) is the only live transport.
  The event table earns its place when real per-provider webhook streams
  (WhatsApp/Meta receipts) need audit/replay — that is the transport
  mission's call, and adding it later is purely additive. Raw callbacks are
  meanwhile preserved in `Message.metadata`.

### 4.3 `MessageAttachment`

```prisma
model MessageAttachment {
  id              String   @id @default(cuid())
  workspaceId     String
  messageId       String
  /// Logical type: "image" | "video" | "audio" | "file" | "sticker" | …
  kind            String   @default("file")
  fileName        String?
  mimeType        String?
  sizeBytes       Int?
  /// Our storage (Vercel Blob URL/path) once persisted.
  storageKey      String?
  /// Provider-hosted URL when we have not (or cannot) persist a copy.
  externalUrl     String?
  provider        String?
  externalMediaId String?
  width           Int?
  height          Int?
  durationMs      Int?
  checksum        String?
  caption         String?
  /// "stored" | "pending_download" | "external_only" | "failed" |
  /// "unrecoverable" (historical rows whose bytes were never persisted).
  status          String   @default("stored")
  position        Int      @default(0)
  metadata        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  message   Message   @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, position])
  @@index([workspaceId, createdAt])
  @@index([workspaceId, externalMediaId])
}
```

(Plus back-relations on `Workspace` and `Message`.)

**Relationship to the generic `Attachment`: keep BOTH, distinct
responsibilities.** `Attachment` remains the operator-document record
(polymorphic `module`+`recordId`, OCR/scan pipeline, uploads from any
module). `MessageAttachment` is channel media bound to one message's
lifecycle (provider media ids, download state, per-message ordering,
captions, dimensions). No FK between them; if message media ever needs the
OCR pipeline, a follow-up can create an `Attachment` from a
`MessageAttachment` — extension, not duplication. Replacing `Attachment` was
rejected (it serves non-inbox modules); extending it was rejected (nullable
`workspaceId`, SetNull semantics and polymorphic keys contradict the strict
message-media contract).

`@@unique([messageId, position])` gives backfill/ingestion a deterministic
idempotency anchor: writers materialize an attachment LIST per message in
one pass with stable positions (ingestion builds all rows atomically with
the message; the backfill derives positions from the metadata array order).

### 4.4 `ConversationScope` — decision: NOT in this migration

Recommendation: **defer to the WhatsApp connection mission.** Rationale:

- Every channel live today (email business inbox, web chat, portal, manual)
  is business-scoped by definition — a `scope` column now would be a dead
  constant with misleading precision.
- The correct DEFAULT for new conversations depends on a connection-level
  signal (`numberUsage`, §4.5) that only exists once a personal-capable
  channel is onboarded. Landing both together keeps the semantics honest.
- Planned shape (documented for that mission, matching
  `core/inbox/conversation-scope.ts`): `Conversation.scope String
  @default("business")`, `scopeSource String?` ("default" | "connection_hint"
  | "operator" | "ai_suggested_operator_confirmed"), `scopeUpdatedAt`,
  `scopeUpdatedBy`; scope changes logged through the existing `Activity`
  model (no new audit table); automation gates check scope in
  `auto-task-policy.ts` / `intelligence.ts` BEFORE processing; `personal`
  can only be set by an operator (policy: never AI-only), and
  `unclassified` is treated as automation-off.

### 4.5 `ChannelConnection` — minimal additive columns

Only what the next phases demonstrably query:

```prisma
// Added to model ChannelConnection:
  /// Provider-side account/page/phone-number id (Meta page id, WhatsApp
  /// phone_number_id, Twilio SID…). Distinct from `externalAccountId` (the
  /// human-facing address). Webhook payloads route on THIS value.
  providerAccountId String?
  /// Auth lifecycle for OAuth-token providers; null for password/API-key.
  tokenExpiresAt    DateTime?
  /// Number/account usage policy hint set during onboarding:
  /// "business_only" | "mixed" | "unknown". Feeds ConversationScope
  /// defaults later; "unknown" for all existing rows.
  numberUsage       String    @default("unknown")

  @@index([provider, providerAccountId])
```

Deliberately NOT added now (stay in `config`/`syncState` JSON until a query
needs them): webhook subscription state, granted scopes, health status,
per-provider cursors (already `syncState`), capabilities (come from the
channel registry, never the DB). Multiple identities under one provider
connection need no schema: `ContactIdentity.provider + externalId` already
models it.

## 5. Conceptual Prisma diff

- `+ model ContactIdentity` (new table, 2 FKs, 1 unique, 3 indexes)
- `+ model MessageAttachment` (new table, 2 FKs, 1 unique, 2 indexes)
- `model Message`: `+ deliveryStatus @default("none")`, `+ sentAt`,
  `+ deliveredAt`, `+ readAt`, `+ failedAt`, `+ failureCode`,
  `+ deliveryUpdatedAt`, `+ @@index([workspaceId, deliveryStatus])`,
  `+ attachmentsRel MessageAttachment[]`
- `model ChannelConnection`: `+ providerAccountId`, `+ tokenExpiresAt`,
  `+ numberUsage @default("unknown")`, `+ @@index([provider, providerAccountId])`
- `model Contact`: `+ identities ContactIdentity[]`
- `model Workspace`: `+ contactIdentities ContactIdentity[]`,
  `+ messageAttachments MessageAttachment[]`
- **No column dropped, renamed or retyped. No row rewritten. Nothing
  destructive.**

## 6. Constraints & indexes (justification per lookup)

| Index / constraint | Serves |
|---|---|
| `ContactIdentity @@unique([workspaceId, contactId, dedupeKey])` | Idempotent upsert for ingestion + backfill; duplicate prevention without forbidding shared values |
| `ContactIdentity [workspaceId, channel, normalizedValue]` | "Who is +34612…?" — contact resolution at ingestion, tenant-scoped |
| `ContactIdentity [workspaceId, provider, externalId]` | Webhook callbacks that carry only a PSID/wa_id |
| `ContactIdentity [contactId]` | List a contact's identities (context panel, export, merge) |
| `Message [workspaceId, deliveryStatus]` | "Failed sends" views, retry sweeps, delivery filters |
| `MessageAttachment @@unique([messageId, position])` | Idempotent per-message attachment list; ordered load per message (also serves the `messageId` lookup as its left prefix) |
| `MessageAttachment [workspaceId, createdAt]` | Backfill/observability batches per tenant |
| `MessageAttachment [workspaceId, externalMediaId]` | Media webhook/download callbacks |
| `ChannelConnection [provider, providerAccountId]` | Webhook → connection routing (necessarily cross-workspace: the payload has no tenant; the resolved connection's `workspaceId` scopes everything after) |

Nothing else — every existing lookup keeps its current index; no speculative
indexes.

## 7. Turso/SQLite & Prisma compatibility

- No `Json` columns (unsupported on SQLite): every metadata field is
  `String?` TEXT, matching the whole existing schema.
- No enums (repo convention + SQLite): free strings validated in services.
- New tables + `ALTER TABLE … ADD COLUMN` with constant defaults are the
  cheap, non-rewriting SQLite operations — safe on Turso.
- Nullable-column uniqueness pitfall handled: `provider` is NON-NULL
  (`"unknown"`) inside `dedupeKey`, and `dedupeKey` itself is a non-null
  computed column, so SQLite's NULLs-are-distinct semantics cannot create
  duplicates.
- New indexes on existing tables build online at deploy time; `Message` is
  the only large table and gets one single-column-pair index.
- Deploy mechanism unchanged: `prisma migrate diff`-generated SQL (or
  `db push` for dev) — additive statements only. `prisma/push-turso.ts`
  (raw CREATE TABLE IF NOT EXISTS bootstrap) gains the two new tables.

## 8. Backfill strategy (all idempotent, workspace-batched)

### 8.1 `scripts/backfill-contact-identities.ts`
- Source: `Contact.email` → identity `{channel:"email", kind:"email",
  normalizedValue: lowercased/trimmed}`; `Contact.telefono` →
  `{channel:"sms", kind:"phone"}` — E.164 only when the raw value already
  carries `+`/country context; otherwise digits-only with
  `metadata:{normalization:"partial"}`. **Never invent a country.**
- NOT sourced in v1: message bodies (unsafe), conversation participants
  beyond the contact row (redundant — every conversation already FKs its
  contact).
- Upsert on `[workspaceId, contactId, dedupeKey]`, `source:"backfill"`,
  `isPrimary:true` when it is the contact's only identity for that channel.
- **No auto-merge ever**: two contacts sharing a normalized value both keep
  their rows; the run reports `{workspaceId, value-hash, contactIds}`
  conflicts (hashed, not raw PII) to stdout for operator review.
- Re-runnable: pure upserts, stable dedupeKey, no deletes.

### 8.2 `scripts/backfill-message-delivery.ts`
Conservative projection from existing metadata, outbound non-internal
messages only:
- `emailStatus:"sent"` → `deliveryStatus:"sent"`, `sentAt:emailAttemptedAt`.
- …and `openedAt` present → `"read"`, `readAt:openedAt` (pixel open IS the
  email read signal; `openSuspect`/proxy flags stay metadata-only and do not
  block projection — same trust level the UI applies today).
- `emailStatus:"failed"` → `"failed"`, `failedAt:emailAttemptedAt`,
  `failureCode:"email_send_failed"` (free-text `emailError` stays metadata).
- `emailStatus:"pending"` → `"queued"` (no guessing about lost sends).
- Inbound, internal, and no-metadata rows → stay `"none"` (untouched).
- Idempotent: only writes when the projected rank is HIGHER than the stored
  one (same monotonic helper the runtime uses), so re-runs are no-ops.

### 8.3 `scripts/backfill-message-attachments.ts`
- Source: `Message.metadata.attachments` arrays written by the Resend
  inbound path (blob-stored: → `status:"stored"`, `storageKey`), outbound
  composer attachments (same shape), and web-chat metadata if present.
- Position = array order; upsert on `[messageId, position]`; metadata array
  is NOT deleted (fallback continues to read it during rollout).
- **Three distinct situations, kept distinct**: (a) backfill of
  already-stored references — this script; (b) the IMAP ingestion fix so NEW
  mail persists attachments — a 04B code change in `imap-sync.ts`
  (mailparser already exposes them), not a backfill; (c) historical
  IMAP-ingested mail whose bytes were never stored — genuinely
  unrecoverable from our DB; optionally recoverable later by an explicit
  re-fetch-by-UID job where the mailbox still holds the message (separate,
  opt-in mission; rows can meanwhile be marked `status:"unrecoverable"` only
  if we can detect them, which metadata does not currently allow — so (c)
  produces no rows in v1).

## 9. Deployment sequence (no downtime)

1. **Additive migration** (new tables + new nullable/defaulted columns).
   Old code keeps running unchanged against the new schema.
2. **Deploy code** that writes-through the new columns/tables via the pure
   helpers (dual-write: metadata keys keep being written exactly as today).
3. **Run backfills** (idempotent, per-workspace batches, resumable).
4. **Dual-write verified** — spot-check counts (`deliveryStatus != 'none'`
  vs metadata `emailStatus`, attachment rows vs metadata arrays).
5. **Read path flips**: UI/service read new columns first, metadata as
   fallback (one helper per read site so the fallback is grep-able).
6. **Observe** ≥ one release cycle.
7. **Fallback removal**: a later mission, never this one. Metadata keys are
   not deleted at any point in 04B.

## 10. Risks

- **Ambiguous identities**: shared phones/emails will surface as multi-match
  resolutions; mitigated by never auto-merging + conflict report. Manual
  merge tooling is future UI work.
- **Phone normalization**: without country context numbers stay digits-only;
  two representations of one number may not match until a later
  normalization pass with better context. Conservative by design.
- **Pixel-based `read`**: email `read` is heuristic (proxy prefetches can
  inflate it). We project it because the product already treats opens as the
  read signal; `openSuspect` stays available to refine later.
- **Message table churn**: 7 new columns + 1 index on the biggest table —
  additive and cheap in SQLite, but the migration should run off-peak on
  Turso as a precaution.
- **Dual-write drift**: bounded by routing every write through the shared
  projection/upsert helpers and by the verification step (§9.4).
- **`push-turso.ts` drift**: the raw bootstrap script must gain the new
  tables or fresh Turso environments will miss them.

## 11. Decisions requiring approval

1. **ContactIdentity uniqueness** = per-contact `dedupeKey` (allowing shared
   values across contacts), with `provider` defaulted to `"unknown"` — vs. a
   stricter global unique that would block legitimate cases.
2. **Delivery state as projection on `Message`** (7 columns, monotonic
   helper), **no `MessageDeliveryEvent` table yet** (revisit at transport
   mission).
3. **Email pixel open projects to `read`** (with suspect flags kept
   metadata-only).
4. **Keep `Attachment` and add `MessageAttachment`** with the documented
   responsibility boundary (no replacement, no extension).
5. **Defer `Conversation.scope`** to the WhatsApp connection mission
   (documented planned shape in §4.4).
6. **ChannelConnection additive set limited to 3 columns + 1 index**
   (`providerAccountId`, `tokenExpiresAt`, `numberUsage`).
7. **Phone normalization policy**: E.164 only with explicit country
   context; never inferred.

## 12. Files INBOX-DATA-04B would touch

- `prisma/schema.prisma` (the diff in §5) + generated migration SQL;
  `prisma/push-turso.ts` (bootstrap parity).
- New pure helpers + tests: `modules/inbox/delivery-projection.ts`,
  `modules/inbox/identity-normalization.ts` (email/phone/handle
  normalizers + dedupeKey builder).
- New scripts: `scripts/backfill-contact-identities.ts`,
  `scripts/backfill-message-delivery.ts`,
  `scripts/backfill-message-attachments.ts`.
- Dual-write touchpoints: `app/api/inbox/conversations/[id]/messages/route.ts`,
  `app/api/inbox/compose/route.ts`, `.../retry/route.ts` (delivery
  projection on send result), `app/api/inbox/track/open/[token]/route.ts` and
  `track/confirm` (read projection), `modules/inbox/email-inbound.ts`
  (identity upsert + attachment rows), `modules/inbox/imap-sync.ts`
  (attachment persistence fix), `app/api/inbox/public/send/route.ts`
  (web-chat visitor identity).
- Read-path fallback helpers where the UI currently parses metadata
  (`lib/inbox/parse-message-metadata.ts` and the attachment renderers).

## 13. Tests 04B would add

1. Normalization: email/phone/handle cases incl. no-country phones,
   idempotent dedupeKey stability.
2. Delivery projection: full rank matrix, out-of-order callbacks, failure
   transitions, no-downgrade guarantees, channels without receipts.
3. Backfill planners (pure): metadata → projected writes for the three
   scripts, including re-run no-op proofs and conflict reporting.
4. Ingestion planners: identity upsert decisions (one match / many / none),
   attachment row derivation from parsed mail.
5. Schema-level smoke (node:test + local SQLite): unique constraints behave
   as designed (duplicate upsert, shared value across contacts allowed).

## 14. Recommendation

Approve decisions §11 and run **INBOX-DATA-04B** as: migration (§5) →
helpers + dual-write → backfills (§8) → read-with-fallback (§9.5), in one
mission but committed in that order, with the IMAP attachment-persistence
fix included (it is two dozen lines inside `imap-sync.ts` and stops the
ongoing data loss the audit flagged). `ConversationScope` and
`MessageDeliveryEvent` stay explicitly out, parked with documented shapes.
