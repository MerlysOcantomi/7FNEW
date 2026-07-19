# Smart Inbox — Multi-channel Data Model Design (INBOX-DATA-04A, rev. 04A.1)

> Status: **design proposal — awaiting approval**. No schema change, no migration,
> no backfill and no product code is part of this mission. INBOX-DATA-04B
> implements whatever is approved here.
>
> Base: INBOX-CHANNELS-02 (`c03631e`), INBOX-FILTERS-03 (`f44828c`),
> `docs/product/smart-inbox-multichannel-audit.md` (phase 4).
>
> Revision 04A.1 reworks four areas of the original proposal: (1) declared vs
> routable identity (the single `ContactIdentity` table is replaced by a
> two-level design), (2) an explicit ambiguity model, (3) attachment
> idempotency via `attachmentKey` instead of `position`, (4) normalized
> external message identification for callbacks, plus `readSource`
> provenance.

---

## 1. Branch state (verified before analysis)

- Branch `claude/smart-inbox-audit-vertical-g0u7u1`, HEAD `a9e7259`
  (INBOX-DATA-04A doc), ancestors `f44828c` (INBOX-FILTERS-03) and `c03631e`
  (INBOX-CHANNELS-02) — all present and pushed to origin.
- `git status --short` / `git status -sb`: clean, in sync with origin,
  nothing staged or untracked.

## 2. Current schema (relevant excerpts)

- **`Contact`** (schema.prisma:435): `email?`, `telefono?`, `canal`,
  `clienteId?`, required `workspaceId` (Cascade). Non-unique indexes
  `[workspaceId, email]`, `[workspaceId, telefono]`.
- **`Message`** (schema.prisma:536): `role`, `direction`, `content`,
  `contentType`, `metadata String?`, `isInternal`, **`sourceMessageId
  String?`** ("external provider message id (dedup)" — set on inbound email:
  RFC Message-ID or `imap:<connId>:<uid>`; **NOT indexed**, today's dedup
  substring-scans metadata), **`connectionId String?`** (FK → ChannelConnection,
  SetNull, indexed via the relation), required `workspaceId`. No delivery/read
  columns; outbound provider id (`resendId`) lives only in metadata.
- **`Attachment`** (schema.prisma:1015): generic polymorphic
  operator-document record; not linked to messages.
- **`ChannelConnection`** (schema.prisma:1036): `channelType`, `provider`,
  `externalAccountId?` (unique per workspace), `config/credentials/syncState`
  JSON strings. No provider account id column, no token expiry, no usage hint.
- **Binding conventions**: no Prisma enums; metadata is JSON **string**
  (`TEXT` — Prisma `Json` is unsupported on SQLite/libsql); required
  `workspaceId` + Cascade on current-generation models; SQLite treats NULLs
  as distinct inside unique indexes (every uniqueness below uses non-null
  columns for that reason).

## 3. Problems the new models solve

1. No relational home for cross-channel identities (handles, PSIDs, visitor
   ids); contact resolution is string matching over two Contact columns.
2. **Routing vs declaration were conflated in rev. 04A**: a contact-owned
   identity table can say "these contacts claim this phone" but cannot
   answer "which contact does this inbound wa_id belong to" once a value is
   shared — the revision separates the two concerns.
3. Delivery/read state is email-only metadata; not queryable, no provenance.
4. Message attachments have no relational home; IMAP loses them; `position`
   alone is a fragile idempotency anchor.
5. Inbound/outbound external message ids are unindexed (dedup substring-scans
   metadata; callbacks cannot correlate efficiently).
6. `ChannelConnection` cannot route provider webhooks or express token
   lifecycle / number usage.

---

## 4. Identity: declared vs routable (revised design)

### 4.1 The two concepts

- **Declared contact identity** — data a contact card claims: an email, a
  phone, a handle, a shared reception number, a family phone. May
  legitimately appear on SEVERAL contacts. Serves search, display, export,
  and as *evidence* for resolution. Never a routing key by itself.
- **Routable external identity** — the identity a provider uses to represent
  an external sender: WhatsApp `wa_id`, Instagram-scoped user id (IGSID),
  Messenger PSID, TikTok scoped id, web visitor id, email sender address,
  SMS phone. Must resolve deterministically within its scope:
  `workspace → channel → provider → provider account/connection → external
  identity`. Exactly ONE row may exist per scoped identity.

### 4.2 Option A vs Option B

**Option A — one table** (`ContactIdentity` with `dedupeKey`, `routingKey`,
`connectionId`, resolution state, nullable/controlled contact link):

- To stay routable it needs `routingKey` UNIQUE per workspace; to allow
  declared shared values it needs that same key NON-unique. SQLite/Prisma
  cannot express "unique only when kind = routable" (no partial unique
  indexes in Prisma), so one of the two requirements must be faked in
  service code — exactly the class of invariant that should live in the DB.
- A shared declared email (two contacts claim `info@…`) either collides with
  the routable row for that address or forces `contactId` nullable plus a
  side pile of "extra claims", reinventing Option B inside one table, worse.
- Merge/relink mutates identity rows themselves, losing history.

**Option B — two levels** (recommended):

- `ExternalIdentity`: ONE row per provider-scoped identity, unique in its
  routing scope, `contact`-free. Webhook routing = one indexed lookup.
- `ContactIdentityLink`: N rows associating an identity with contacts, each
  with a status/source. Declared shared values = several links on one
  identity. Resolution state derives from confirmed links; a cached
  `primaryContactId` keeps the hot path one query.
- Conservative merge = move links (audit preserved); identity rows are
  immutable anchors for conversations/messages history.
- Cost: one extra table and one extra write per new association — trivial
  next to the correctness it buys. Both tables are purely additive.

**Recommendation: Option B.** It is the minimal design that does not block
future integrations; Option A structurally cannot hold both invariants.

### 4.3 Proposed models (exact)

```prisma
model ExternalIdentity {
  id              String   @id @default(cuid())
  workspaceId     String
  /// Registry channel id: "email" | "whatsapp" | "instagram" | "messenger"
  /// | "tiktok" | "sms" | "web_chat" | …
  channel         String
  /// Transport provider. NON-NULL (default "unknown") — participates in the
  /// unique routing key and SQLite treats NULLs as distinct.
  provider        String   @default("unknown")
  /// Routing scope segment (see §4.5): providerAccountId for page/account-
  /// scoped ids (PSID, IGSID, TikTok), else "" for globally-addressed
  /// identities (email address, E.164 phone, wa_id). NON-NULL by design.
  scopeKey        String   @default("")
  /// What the value IS: "email" | "phone" | "handle" | "psid" | "external_id"
  /// | "visitor".
  kind            String
  /// The canonical routable value: provider external id when one exists
  /// (PSID/IGSID/wa_id/visitorId), otherwise the normalized address
  /// (lowercased email, E.164/digits phone, lowercased handle). NON-NULL.
  externalKey     String
  /// Human-facing form ("@lola.nails", "+34 612 34 56 78").
  displayValue    String?
  /// Cached resolution target: the confirmed contact when exactly one
  /// confirmed link exists; NULL while unresolved or ambiguous. FK with
  /// SetNull so deleting a contact reopens resolution instead of dangling.
  primaryContactId String?
  /// "resolved" | "ambiguous" | "unresolved" — projection of the links,
  /// recomputed by the service layer on every link change.
  resolutionStatus String  @default("unresolved")
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  /// Provider-specific JSON string. NEVER tokens/secrets.
  metadata        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  primaryContact Contact?  @relation("PrimaryIdentityContact", fields: [primaryContactId], references: [id], onDelete: SetNull)
  links          ContactIdentityLink[]

  @@unique([workspaceId, channel, provider, scopeKey, externalKey])
  @@index([workspaceId, primaryContactId])
  @@index([workspaceId, kind, externalKey])
}

model ContactIdentityLink {
  id                 String   @id @default(cuid())
  workspaceId        String
  externalIdentityId String
  contactId          String
  /// "confirmed" | "suggested" | "rejected". Rejected rows are KEPT (audit:
  /// "the operator said this identity is NOT this contact").
  status             String   @default("suggested")
  /// "declared" (contact card claims the value) | "ingestion" (created from
  /// an inbound resolution) | "manual" (operator action) | "merge" |
  /// "backfill".
  source             String   @default("ingestion")
  /// Operator user id for manual/merge actions; null for automatic sources.
  createdBy          String?
  confirmedAt        DateTime?
  rejectedAt         DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  workspace        Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  externalIdentity ExternalIdentity @relation(fields: [externalIdentityId], references: [id], onDelete: Cascade)
  contact          Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([externalIdentityId, contactId])
  @@index([workspaceId, contactId])
  @@index([workspaceId, status])
}
```

(Back-relations: `Workspace.externalIdentities` / `.contactIdentityLinks`,
`Contact.identityLinks ContactIdentityLink[]` and
`Contact.primaryIdentities ExternalIdentity[]` via the named relation.)

The routing unique `[workspaceId, channel, provider, scopeKey, externalKey]`
uses only non-null columns, so SQLite's NULL semantics cannot create
duplicates, and upserts on that key make ingestion/backfill idempotent.

### 4.4 Ambiguity model (exact behaviour)

| Situation | Behaviour |
|---|---|
| Two contacts share a phone/email | ONE `ExternalIdentity`; two `declared` links. If neither is confirmed-unique → `resolutionStatus:"ambiguous"`, `primaryContactId: null`. Inbound messages on that identity keep threading by identity (existing conversation reused); a NEW conversation gets a provisional Contact (`tipo:"visitante"`, current behaviour) and the identity is flagged for operator identification. **Never silently pick one of the claimants.** |
| Provider external id already confirmed for another contact | Ingestion never relinks. The confirmed link stands; any conflicting evidence creates a `suggested` link and (if it contradicts) flips nothing — operator resolves. |
| Message arrives before any contact is known | Identity row is created `unresolved`; conversation attaches to a provisional Contact (keeps `Conversation.contactId` required — no schema loosening); resolving later re-points via links + an explicit operator or rule action. |
| Operator corrects an association | Old link → `status:"rejected"` (kept, `rejectedAt`, `createdBy`); new link `confirmed` with `source:"manual"`; `primaryContactId`/`resolutionStatus` recomputed; `Activity` row logged. |
| Two contacts merged | Operator-driven only. Links repoint to the survivor (`source:"merge"`); duplicates collapse naturally on `@@unique([externalIdentityId, contactId])`; nothing on `ExternalIdentity` mutates. |
| Contact deleted | Its links Cascade away; `primaryContactId` SetNulls; identity survives (conversation history intact) and becomes `unresolved`. |
| Conflict logging | Reports carry workspace id, identity id, contact ids and a **hash** of the value — never the raw email/phone/handle (no PII in logs, matching the `fanny_auto_decision` telemetry precedent). |

Policy invariants (enforced in the resolution service, unit-tested): never
auto-merge on ambiguous coincidence; never arbitrary silent selection;
conversations may exist while identity is unresolved; manual resolution
always available; every status change is auditable (kept rejected rows +
Activity log).

### 4.5 External-id scoping per provider (what `scopeKey` holds)

| Provider identity | Scoped by | `scopeKey` |
|---|---|---|
| Messenger PSID | Facebook **page** (same person, two pages → two PSIDs) | page id (`providerAccountId`) |
| Instagram IGSID | Instagram **professional account** | account id (`providerAccountId`) |
| TikTok user identity | app/business account | account id (`providerAccountId`) |
| WhatsApp `wa_id` | user's E.164 — stable across business numbers | `""` |
| SMS phone | global E.164 | `""` |
| Email address | global | `""` |
| Web-chat visitor id | workspace (already in the key) | `""` |

`scopeKey` = `providerAccountId` when the provider scopes ids per
account/page; falls back to `connectionId` ONLY if the account id is
unavailable (documented as a degraded mode — connections are recreatable,
account ids are stable); `""` for globally-addressed identities. This is why
`ChannelConnection.providerAccountId` (§7) is required for the Meta-family
integrations.

**Routing walk-through (Messenger):** webhook `{page_id, psid}` →
connection by `[provider:"meta", providerAccountId:page_id]` → gives
`workspaceId` → identity upsert on
`[workspaceId, "messenger", "meta", page_id, psid]` → `primaryContactId`
set → conversation for that contact/identity; null → provisional-contact
flow (§4.4). One indexed lookup per step, tenant-scoped after the first.

---

## 5. `Message`: external identification + delivery/read projection

### 5.1 External message identification (revised)

Audit result: `Message.sourceMessageId` already exists as the inbound
external id but is **unindexed** (dedup substring-scans metadata), and the
outbound provider id (`resendId`) lives only in metadata. Revision:

- **Reuse `sourceMessageId` for both directions** — it is "the provider's id
  for this message". Outbound sends write the provider-assigned id
  (Resend id today; WhatsApp `wamid` later) into `sourceMessageId` as well
  as metadata (dual-write), and the backfill projects historical `resendId`s.
- **No `provider` column on `Message`**: the provider is derivable through
  `connectionId → ChannelConnection.provider`, and every callback already
  arrives inside a provider/connection context. (Deleted-connection edge
  case: metadata retains the raw provider payload.)
- **New index, no DB unique**:
  `@@index([workspaceId, sourceMessageId])` serves callback correlation,
  webhook dedup and retry lookups. A DB-level unique was rejected on
  purpose: the same RFC Message-ID can legitimately produce two rows in one
  workspace (an email CC'd to two connected inboxes ingests into two
  conversations). Dedup stays in the service exactly as today's contract —
  but backed by this index instead of a metadata substring scan — scoped
  `(workspaceId, connectionId, sourceMessageId)`.

Correlation flows this supports: delivery/read callbacks (`wamid`/Resend id
→ message), webhook redelivery dedup, retry tracking, and cross-account
collision safety (two accounts of one provider = different `connectionId`).

### 5.2 Delivery/read projection columns (with provenance)

```prisma
// Added to model Message:
  /// Outbound delivery projection: "none" (inbound/internal/N-A) | "queued"
  /// | "sending" | "sent" | "delivered" | "read" | "failed" |
  /// "undeliverable" | "cancelled". Monotonic — see delivery-projection.ts.
  deliveryStatus    String    @default("none")
  sentAt            DateTime?
  deliveredAt       DateTime?
  readAt            DateTime?
  /// Provenance of the read signal: "provider_receipt" | "tracking_pixel"
  /// | "manual". COLUMN, not metadata: UI badges and automation gates must
  /// distinguish a real provider receipt from a pixel inference on every
  /// row without parsing JSON.
  readSource        String?
  failedAt          DateTime?
  failureCode       String?
  deliveryUpdatedAt DateTime?

  @@index([workspaceId, deliveryStatus])
  @@index([workspaceId, sourceMessageId])
```

`readSource` rules (in the same pure projection helper): evidence strength
`manual`/`provider_receipt` > `tracking_pixel`; a stronger source may
overwrite `readSource` (and move `readAt` to its own timestamp when
earlier); never downgrade to a weaker source; email backfill sets
`tracking_pixel` (from `openedAt`) or `manual` (receipt-confirmation keys).
Everything else from rev. 04A §delivery stands: monotonic rank, failure
states only from pre-`delivered`, provider-shaped keys stay in metadata, no
`MessageDeliveryEvent` table until the transport mission justifies it.

---

## 6. `MessageAttachment` (revised idempotency)

```prisma
model MessageAttachment {
  id              String   @id @default(cuid())
  workspaceId     String
  messageId       String
  kind            String   @default("file")   // "image"|"video"|"audio"|"file"|"sticker"|…
  fileName        String?
  mimeType        String?
  sizeBytes       Int?
  storageKey      String?                      // our blob URL/path once persisted
  externalUrl     String?                      // provider-hosted URL
  provider        String?
  externalMediaId String?
  width           Int?
  height          Int?
  durationMs      Int?
  checksum        String?
  caption         String?
  status          String   @default("stored")  // "stored"|"pending_download"|"external_only"|"failed"|"unrecoverable"
  /// Presentation order ONLY — mutable, not part of identity.
  position        Int      @default(0)
  /// Stable idempotency key, computed once at creation (see derivation) and
  /// NEVER recomputed afterwards.
  attachmentKey   String
  metadata        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  message   Message   @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, attachmentKey])
  @@index([messageId, position])
  @@index([workspaceId, createdAt])
  @@index([workspaceId, externalMediaId])
}
```

**`attachmentKey` derivation** (priority order, first available wins;
computed in a pure helper, unit-tested):

1. `media:<provider>:<externalMediaId>` — per-instance unique at the source.
2. `store:<storageKey>` — per-instance unique in our storage.
3. `sha256:<checksum>#<position>` — checksum alone is NOT unique when the
   same file is attached twice intentionally, so the position at creation
   time disambiguates.
4. `pos:<position>` — conservative deterministic fallback (metadata-array
   backfills where nothing better exists; array order is stable there).

| Case | Behaviour |
|---|---|
| Provider gives no media id | Tier 2 (after download) or tier 3/4. |
| Same file twice on purpose | Distinct media ids/storage keys, or tier-3 keys with different `#position` — two rows, as intended. |
| Order changes later | `position` (presentation) updates freely; `attachmentKey` is frozen at creation, so no duplicate rows. Tier-3/4 keys only ever come from single-shot deterministic sources, where order is fixed at creation. |
| Same webhook delivered twice | Upsert on `[messageId, attachmentKey]` (tier 1) → no-op. |
| Reference first, file later | Row created with tier-1 key + `status:"external_only"/"pending_download"`; download fills `storageKey`/`checksum`/`status:"stored"` on the SAME row (key unchanged). |
| Checksum known only later | Fills the `checksum` column; the key is never recomputed. |

`Attachment` (generic) vs `MessageAttachment` boundary is unchanged from
rev. 04A: both kept, operator documents vs channel media; no FK between
them; replacement and extension both rejected (reasons in that section's
history — polymorphic keys, nullable `workspaceId`, OCR pipeline scope).

---

## 7. `ChannelConnection` — minimal additive columns (unchanged from 04A)

`providerAccountId String?` (+ `@@index([provider, providerAccountId])` —
the necessarily cross-workspace webhook routing entry; the resolved
connection's `workspaceId` scopes everything after), `tokenExpiresAt
DateTime?`, `numberUsage String @default("unknown")`
(`business_only|mixed|unknown`, feeds the deferred `ConversationScope`
defaults). Webhook subscription state, scopes, health and per-provider
cursors stay in `config`/`syncState` JSON until a query needs them;
capabilities come from the channel registry, never the DB.

`ConversationScope` remains **deferred to the WhatsApp connection mission**
with the planned shape documented in rev. 04A (scope/scopeSource/Activity
audit; `personal` operator-only; `unclassified` = automation-off).

---

## 8. Conceptual Prisma diff (revised, final for 04B)

- `+ model ExternalIdentity` (unique `[workspaceId, channel, provider,
  scopeKey, externalKey]`; indexes `[workspaceId, primaryContactId]`,
  `[workspaceId, kind, externalKey]`)
- `+ model ContactIdentityLink` (unique `[externalIdentityId, contactId]`;
  indexes `[workspaceId, contactId]`, `[workspaceId, status]`)
- `+ model MessageAttachment` (unique `[messageId, attachmentKey]`; indexes
  `[messageId, position]`, `[workspaceId, createdAt]`,
  `[workspaceId, externalMediaId]`)
- `model Message`: `+ deliveryStatus @default("none")`, `+ sentAt`,
  `+ deliveredAt`, `+ readAt`, `+ readSource`, `+ failedAt`, `+ failureCode`,
  `+ deliveryUpdatedAt`, `+ @@index([workspaceId, deliveryStatus])`,
  `+ @@index([workspaceId, sourceMessageId])`, `+ attachments
  MessageAttachment[]`
- `model ChannelConnection`: `+ providerAccountId`, `+ tokenExpiresAt`,
  `+ numberUsage @default("unknown")`, `+ @@index([provider, providerAccountId])`
- `model Contact`: `+ identityLinks ContactIdentityLink[]`,
  `+ primaryIdentities ExternalIdentity[]` (named relation)
- `model Workspace`: `+ externalIdentities`, `+ contactIdentityLinks`,
  `+ messageAttachments`
- **Nothing dropped, renamed, retyped or rewritten. Additive only.**

Superseded from rev. 04A: the single `ContactIdentity` model and its
`dedupeKey` uniqueness; `@@unique([messageId, position])` on attachments.

## 9. Backfill strategy (revised deltas only; the rest stands)

- **Identities**: `Contact.email` → `ExternalIdentity` upsert on the routing
  key (`email/unknown/""/lowercased`) + `declared` link to that contact;
  `Contact.telefono` → same for `sms` (E.164 only with explicit country
  context, digits-only otherwise, `metadata.normalization:"partial"`; never
  invent a country). When several contacts produce the SAME identity, the
  identity ends `ambiguous` with N `declared` links — reported (hashed), not
  merged. `primaryContactId` is set only when exactly one link exists.
  Re-runnable: upserts on both unique keys, no deletes.
- **Delivery**: as rev. 04A, plus `readSource` (`tracking_pixel` from
  `openedAt`, `manual` from receipt-confirmation keys) and projecting
  metadata `resendId` → `sourceMessageId` for outbound rows that lack it.
- **Attachments**: as rev. 04A, but upsert key = `attachmentKey` (tier 4
  positional keys for metadata-array rows) instead of bare position. The
  three IMAP situations (backfill of stored refs / ingestion fix in 04B /
  historically unrecoverable bytes) are unchanged.

## 10. Deployment, performance, security (unchanged from 04A)

Sequence: additive migration → dual-write deploy → idempotent backfills →
count verification → read-with-fallback → observe → fallback removal in a
later mission. `push-turso.ts` gains the three new tables. Index set is the
one justified in §8 — nothing speculative. Privacy: value hashes in logs,
no secrets outside `ChannelConnection.credentials`, Cascade on contact
delete for links (identities survive, unresolved), identities included in
contact export; anonymization = delete links + null `displayValue`.

## 11. Decisions requiring approval (revised list)

1. **Option B two-level identity**: `ExternalIdentity` (routing-unique on
   `[workspaceId, channel, provider, scopeKey, externalKey]`) +
   `ContactIdentityLink` (confirmed/suggested/rejected, unique per
   identity+contact) with cached `primaryContactId` — replacing rev. 04A's
   single `ContactIdentity`.
2. **Ambiguity policy** as §4.4 (provisional contacts, no silent selection,
   kept rejected links, hashed conflict logs).
3. **`scopeKey` doctrine** (§4.5): providerAccountId for page/account-scoped
   ids, `""` for global addresses, connectionId only as degraded fallback.
4. **`Message.sourceMessageId` reused for outbound provider ids** + new
   `[workspaceId, sourceMessageId]` index, **no DB unique** (service-scoped
   dedup), **no provider column** on Message.
5. **`attachmentKey` idempotency** (tiered derivation, frozen at creation)
   with `position` demoted to presentation-only.
6. **`readSource` as a column** with the strength/upgrade rules of §5.2.
7. Carried over from rev. 04A: delivery projection without event table;
   pixel-open projects to `read`; keep `Attachment` + add
   `MessageAttachment`; defer `Conversation.scope`; ChannelConnection
   3-column set; conservative E.164 policy.

## 12. Files / tests for INBOX-DATA-04B (delta over rev. 04A)

Files: as rev. 04A, renaming the identity helper to
`modules/inbox/identity-resolution.ts` (normalizers + routing-key builder +
link-projection `resolveIdentityLinks()` recomputing
`primaryContactId`/`resolutionStatus`) and adding `attachmentKey` builder to
the attachment helper.

Tests (delta): routing-key scoping per provider table (§4.5); ambiguity
matrix of §4.4 as pure link-projection tests; attachmentKey tier
derivation + duplicate-file and late-checksum cases; sourceMessageId dedup
scoping (same Message-ID, two connections → two rows; same connection →
upsert); readSource upgrade/no-downgrade matrix.

## 13. Recommendation

Approve §11 and implement INBOX-DATA-04B in this order: migration (§8) →
pure helpers (identity resolution, delivery projection incl. readSource,
attachment keys) → dual-write touchpoints → backfills (§9) →
read-with-fallback, including the IMAP attachment-persistence fix.
