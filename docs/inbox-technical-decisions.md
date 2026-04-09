# Smart Inbox — Technical Decisions Log

Last updated: 2026-04-09

This document records pragmatic technical decisions in the Smart Inbox module, why they're acceptable today, their known limits, and when/how to evolve them.

---

## 1. Attachments stored in message `metadata` (JSON)

**Current approach**: Attachments are stored as an `attachments` array inside the `metadata` JSON string field of `Message`. No dedicated Prisma model or DB relation.

**Why it's fine now**: Volume is low, queries never filter by attachment fields, and the schema stays migration-free. The existing `Attachment` model is generic (module/recordId) and not wired to messages — using it would require either a migration or a parallel bookkeeping layer.

**Known limits**: No index on attachment filenames. Metadata parsing at read time is JSON.parse. Large attachment counts per message would bloat the field.

**Migration trigger**: If we need to query/search/filter by attachment properties, or attachment volume exceeds ~20 per message regularly.

**Next step**: Create a `MessageAttachment` relation in Prisma (`messageId`, `url`, `filename`, `contentType`, `size`, `source`). Backfill from existing metadata.

---

## 2. Email threading via `metadata CONTAINS` substring search

**Current approach**: Inbound emails are matched to conversations by searching for `In-Reply-To` / `References` Message-IDs as substrings inside the `metadata` JSON field of existing messages, using Prisma `contains`.

**Why it's fine now**: Message volume per workspace is moderate. The query is scoped by `workspaceId` and ordered by `createdAt desc`, so it hits a reasonable dataset. Threading accuracy is high because Message-IDs are globally unique.

**Known limits**: `LIKE '%id%'` is a full-scan on the `metadata` text column. No index helps. Performance will degrade with tens of thousands of messages per workspace.

**Migration trigger**: Noticeable latency on inbound email processing, or message volume exceeding ~50K per workspace.

**Next step**: Extract `emailMessageId` / `resendId` into an indexed column on `Message` (e.g. `externalMessageId`). Or maintain a lightweight `EmailThread` lookup table.

---

## 3. Outbound email sent synchronously in request handler

**Current approach**: When an operator sends a reply, the API route (`POST /conversations/[id]/messages`) awaits `sendOutboundEmail()` synchronously before returning the response.

**Why it's fine now**: Resend's API is fast (typically < 2s). The operator gets immediate feedback on success/failure. Error handling is straightforward.

**Known limits**: If Resend is slow or down, the operator's POST hangs. Concurrent sends from multiple operators are each blocking a serverless function instance.

**Migration trigger**: Consistent email send times > 5s, or need for retry/queue semantics (e.g. scheduled sends, rate limiting).

**Next step**: Move email sending to a background job (e.g. Inngest, QStash, or Vercel Cron). Return `202 Accepted` with a pending status, update message metadata when delivery completes.

---

## 4. Pagination via "Load more" without virtualization

**Current approach**: The conversation list uses client-side `page` state with a "Load more" button. Each page is appended to a growing `extraConversations` array.

**Why it's fine now**: Most workspaces have < 500 conversations. DOM cost of rendering hundreds of conversation cards is manageable. The pattern is simple to maintain.

**Known limits**: No virtualization means rendering 1000+ items impacts scroll performance. The growing array is re-rendered on every state change.

**Migration trigger**: Workspaces regularly exceeding 500+ active conversations, or noticeable scroll jank.

**Next step**: Add `react-window` or `@tanstack/virtual` for virtualized scrolling. Keep the "Load more" trigger but render only visible items.

---

## 5. Vercel Blob storage without orphan cleanup

**Current approach**: Files are uploaded to Vercel Blob (`@vercel/blob`) with public access. If an operator removes an attachment from the composer before sending, the blob remains — only the client-side state is cleared.

**Why it's fine now**: Blob storage is cheap. Orphan volume is low (operators rarely attach and then remove). No sensitive data is leaked since blobs are not indexed.

**Known limits**: Storage grows unboundedly over time. No automated cleanup of unused blobs.

**Migration trigger**: Blob storage costs becoming non-trivial, or compliance requirements for data retention.

**Next step**: Track blob URLs in a lightweight `Upload` table with `usedAt` timestamp. Run a periodic job to delete blobs older than N days without a `usedAt` reference. Alternatively, use Vercel Blob's built-in TTL if/when available.

---

## 6. InboxEntry model frozen (legacy coexistence)

**Current approach**: The `InboxEntry` model still exists and is populated by some flows (widget, AI classification). It coexists with the newer `Conversation` model. No new features use it directly.

**Why it's fine now**: Existing data references it. The widget pipeline still writes to it. Removing it would require migrating widget flows and any external integrations.

**Known limits**: Two parallel "entry" abstractions create confusion. Some queries join both. The model has fields that duplicate `Conversation` semantics.

**Migration trigger**: When the widget pipeline is rewritten or when `InboxEntry` becomes a source of bugs due to stale/inconsistent data.

**Next step**: Audit remaining write paths. Migrate widget pipeline to create `Conversation` directly. Soft-deprecate `InboxEntry` (stop writing), then archive/remove after a validation period.

---

## 7. Inbound attachment re-upload from Resend

**Current approach**: When an inbound email has attachments, we call Resend's attachment API to get a temporary `download_url`, download the binary, and re-upload it to our own Vercel Blob storage.

**Why it's fine now**: Resend's `download_url` expires, so we need our own copy. The flow is sequential per attachment but runs only once per inbound email.

**Known limits**: Large attachments or many attachments per email can slow down inbound processing. The download → re-upload chain has two potential failure points.

**Migration trigger**: Inbound emails regularly carrying > 5 attachments or attachments > 10 MB, or Resend changing their attachment API.

**Next step**: Move attachment processing to a background job. Store a reference immediately, process the download/re-upload async, and update the message metadata when complete.

---

## 8. Search via Prisma `contains` (no full-text index)

**Current approach**: Inbox search queries use Prisma `contains` across `contact.nombre`, `contact.email`, `contact.telefono`, `subject`, `summary`, and `messages.content`.

**Why it's fine now**: Volume is manageable. The query is scoped by workspace. Users get useful results for keyword searches.

**Known limits**: `LIKE '%term%'` on `messages.content` is expensive at scale. No relevance ranking. No fuzzy matching.

**Migration trigger**: Noticeable search latency (> 2s), or users requesting fuzzy/ranked search.

**Next step**: Add SQLite FTS5 virtual table (or Turso equivalent) for message content. Index on write, query on search. Keep `contains` as fallback for structured fields.

---

## 9. Stats (leads/urgent) counted per request

**Current approach**: Every conversation list request runs 4 parallel Prisma queries: data, total count, leads count, urgent count.

**Why it's fine now**: Counts are simple `WHERE` clauses on indexed fields. Response times are acceptable.

**Known limits**: Four queries per page load. At very high conversation volumes, count queries can become slow, especially `leads` and `urgent` which scan the full workspace.

**Migration trigger**: List endpoint latency consistently > 500ms due to count queries.

**Next step**: Cache counts in Redis or a workspace-level `stats` row, updated on conversation status changes. Or use database materialized views.

---

## Summary table

| Decision | Acceptable until | Risk | Effort to migrate |
|----------|-----------------|------|-------------------|
| Attachments in metadata | ~20 attachments/msg | Low | Small (new model + backfill) |
| Threading by CONTAINS | ~50K msgs/workspace | Medium | Medium (indexed column) |
| Sync email send | Resend < 5s p99 | Low | Medium (job queue) |
| Load more without virtualization | ~500 conversations | Low | Small (virtual list library) |
| Blob orphan cleanup | Cost stays low | Low | Small (cleanup job) |
| InboxEntry frozen | No widget rewrite | Low | Medium (migration) |
| Inbound attachment re-upload | < 5 attachments/email | Low | Small (background job) |
| Search via CONTAINS | < 10K msgs/workspace | Medium | Medium (FTS5) |
| Per-request stat counts | < 5K conversations | Low | Small (cache layer) |
