-- INBOX-DATA-04B — additive multi-channel data-model migration.
-- Design: docs/product/smart-inbox-data-model-design.md (rev. 04A.1).
--
-- HAND-AUTHORED additive script (Turso/SQLite deployment path). The
-- `prisma migrate diff` output for the same schema change uses the SQLite
-- table-REBUILD pattern (new_Message + copy + DROP + RENAME) for the two
-- ALTERed tables; that rewrite of the biggest table was rejected for the
-- no-downtime deploy — plain `ALTER TABLE … ADD COLUMN` with constant
-- defaults is fully supported by SQLite and is what `push-turso.ts` also
-- applies. Statements are idempotent (IF NOT EXISTS where SQLite supports
-- it; duplicate-column ALTER errors are tolerated by the runner, matching
-- the existing push-turso convention).
--
-- Fully additive: no DROP, no RENAME, no column removal, no row rewrites.

-- ── New tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ExternalIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'unknown',
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "displayValue" TEXT,
    "primaryContactId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'unresolved',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalIdentity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalIdentity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContactIdentityLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "externalIdentityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'ingestion',
    "createdBy" TEXT,
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactIdentityLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactIdentityLink_externalIdentityId_fkey" FOREIGN KEY ("externalIdentityId") REFERENCES "ExternalIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactIdentityLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MessageAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "provider" TEXT,
    "externalMediaId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "checksum" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'stored',
    "position" INTEGER NOT NULL DEFAULT 0,
    "attachmentKey" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessageAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── New columns on existing tables (constant defaults → no rewrite) ─────────

ALTER TABLE "Message" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Message" ADD COLUMN "sentAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "readAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "readSource" TEXT;
ALTER TABLE "Message" ADD COLUMN "failedAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "failureCode" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryUpdatedAt" DATETIME;

ALTER TABLE "ChannelConnection" ADD COLUMN "providerAccountId" TEXT;
ALTER TABLE "ChannelConnection" ADD COLUMN "tokenExpiresAt" DATETIME;
ALTER TABLE "ChannelConnection" ADD COLUMN "numberUsage" TEXT NOT NULL DEFAULT 'unknown';

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalIdentity_workspaceId_channel_provider_scopeKey_externalKey_key" ON "ExternalIdentity"("workspaceId", "channel", "provider", "scopeKey", "externalKey");
CREATE INDEX IF NOT EXISTS "ExternalIdentity_workspaceId_primaryContactId_idx" ON "ExternalIdentity"("workspaceId", "primaryContactId");
CREATE INDEX IF NOT EXISTS "ExternalIdentity_workspaceId_kind_externalKey_idx" ON "ExternalIdentity"("workspaceId", "kind", "externalKey");

CREATE UNIQUE INDEX IF NOT EXISTS "ContactIdentityLink_externalIdentityId_contactId_key" ON "ContactIdentityLink"("externalIdentityId", "contactId");
CREATE INDEX IF NOT EXISTS "ContactIdentityLink_workspaceId_contactId_idx" ON "ContactIdentityLink"("workspaceId", "contactId");
CREATE INDEX IF NOT EXISTS "ContactIdentityLink_workspaceId_status_idx" ON "ContactIdentityLink"("workspaceId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageAttachment_messageId_attachmentKey_key" ON "MessageAttachment"("messageId", "attachmentKey");
CREATE INDEX IF NOT EXISTS "MessageAttachment_messageId_position_idx" ON "MessageAttachment"("messageId", "position");
CREATE INDEX IF NOT EXISTS "MessageAttachment_workspaceId_createdAt_idx" ON "MessageAttachment"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageAttachment_workspaceId_externalMediaId_idx" ON "MessageAttachment"("workspaceId", "externalMediaId");

CREATE INDEX IF NOT EXISTS "Message_workspaceId_deliveryStatus_idx" ON "Message"("workspaceId", "deliveryStatus");
CREATE INDEX IF NOT EXISTS "Message_workspaceId_connectionId_sourceMessageId_idx" ON "Message"("workspaceId", "connectionId", "sourceMessageId");

CREATE INDEX IF NOT EXISTS "ChannelConnection_provider_providerAccountId_idx" ON "ChannelConnection"("provider", "providerAccountId");
