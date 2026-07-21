-- PRESENCE-02 — additive multi-tenant persistence for Sevenef Presence.
-- Design: docs/presence-architecture.md (PRESENCE-02 section).
--
-- HAND-AUTHORED additive script (Turso/SQLite deployment path), mirrored into
-- the `tables` / `uniqueIndexes` arrays of `prisma/push-turso.ts` (which is what
-- actually runs on deploy). Statements are idempotent (CREATE TABLE/INDEX IF NOT
-- EXISTS).
--
-- Fully additive: no DROP, no RENAME, no column removal, no row rewrites.
-- No business content is stored — Presence reads it from the Business Profile.

-- ── New tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PresenceSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownershipModel" TEXT NOT NULL DEFAULT 'included_in_saas',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateId" TEXT NOT NULL DEFAULT 'business-site-standard',
    "templateVersion" TEXT NOT NULL DEFAULT '0.1.0',
    "themeKey" TEXT NOT NULL DEFAULT 'midnight',
    "selectedProposalId" TEXT,
    "visualConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceSite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PresencePublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "offlineAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresencePublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresencePublication_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PresenceDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "verification" TEXT NOT NULL DEFAULT 'pending',
    "ownership" TEXT NOT NULL DEFAULT 'client_owned',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresenceDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PresenceMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "siteId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "purpose" TEXT NOT NULL DEFAULT 'gallery',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "isRealWorkSample" BOOLEAN NOT NULL DEFAULT false,
    "preserveIntegrity" BOOLEAN NOT NULL DEFAULT false,
    "freyaAssessedBy" TEXT,
    "checksum" TEXT,
    "sourceMediaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresenceMedia_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PresenceSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PresenceMedia_sourceMediaId_fkey" FOREIGN KEY ("sourceMediaId") REFERENCES "PresenceMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PresenceSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'none',
    "source" TEXT NOT NULL DEFAULT 'standalone',
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresenceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "PresenceSite_workspaceId_key" ON "PresenceSite"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "PresenceSite_slug_key" ON "PresenceSite"("slug");
CREATE INDEX IF NOT EXISTS "PresenceSite_status_idx" ON "PresenceSite"("status");

CREATE INDEX IF NOT EXISTS "PresencePublication_workspaceId_siteId_createdAt_idx" ON "PresencePublication"("workspaceId", "siteId", "createdAt");
CREATE INDEX IF NOT EXISTS "PresencePublication_siteId_state_idx" ON "PresencePublication"("siteId", "state");

CREATE UNIQUE INDEX IF NOT EXISTS "PresenceDomain_hostname_key" ON "PresenceDomain"("hostname");
CREATE INDEX IF NOT EXISTS "PresenceDomain_workspaceId_siteId_idx" ON "PresenceDomain"("workspaceId", "siteId");
CREATE INDEX IF NOT EXISTS "PresenceDomain_siteId_isPrimary_idx" ON "PresenceDomain"("siteId", "isPrimary");

CREATE INDEX IF NOT EXISTS "PresenceMedia_workspaceId_siteId_idx" ON "PresenceMedia"("workspaceId", "siteId");
CREATE INDEX IF NOT EXISTS "PresenceMedia_workspaceId_kind_idx" ON "PresenceMedia"("workspaceId", "kind");
CREATE INDEX IF NOT EXISTS "PresenceMedia_sourceMediaId_idx" ON "PresenceMedia"("sourceMediaId");

CREATE UNIQUE INDEX IF NOT EXISTS "PresenceSubscription_workspaceId_key" ON "PresenceSubscription"("workspaceId");
