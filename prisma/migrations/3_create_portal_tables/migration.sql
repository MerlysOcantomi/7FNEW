-- 3_create_portal_tables — CORE-03C-2B (C6).
--
-- The four approved CANONICAL_ADD tables (decisions doc §5, §6.B, §6.C):
-- the client-portal trio (ClientAsset, ClientRequest, ClientRequestAsset)
-- plus ForteSnapshot — despite this directory's historical name,
-- ForteSnapshot is included here as owner-approved in CORE-03C-2A.
-- ForteSnapshot is internal per-workspace memory of Sevenef's own Forte
-- runtime; it does not represent or connect to any external database.
--
-- DDL is extracted verbatim from the canonical SQLite script generated from
-- the current prisma/schema.prisma (never from a drift script). Creation
-- order is dependency-safe: ClientAsset (FK -> Cliente), ClientRequest
-- (FKs -> Cliente, Proyecto), ClientRequestAsset (FK -> ClientRequest),
-- ForteSnapshot (FK -> Workspace, unique workspaceId). Exactly 4 CREATE
-- TABLE + 9 CREATE [UNIQUE] INDEX statements; no ALTER/DROP/DML.
--
-- Rollback (non-executable reference — do not run as part of this migration):
--   reverse dependency order, SAFE ONLY WHILE THE TABLES ARE EMPTY:
--     DROP TABLE "ForteSnapshot";
--     DROP TABLE "ClientRequestAsset";
--     DROP TABLE "ClientRequest";
--     DROP TABLE "ClientAsset";
--   (dropping a table also drops its indexes).

CREATE TABLE "ClientAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "projectId" TEXT,
    "requestId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "createdByPortalUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientAsset_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "proyectoId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdByPortalUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientRequest_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "ClientRequestAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientRequestAsset_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ForteSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "maturity" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ForteSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClientAsset_workspaceId_idx" ON "ClientAsset"("workspaceId");

CREATE INDEX "ClientAsset_clienteId_idx" ON "ClientAsset"("clienteId");

CREATE INDEX "ClientAsset_workspaceId_clienteId_idx" ON "ClientAsset"("workspaceId", "clienteId");

CREATE INDEX "ClientRequest_workspaceId_idx" ON "ClientRequest"("workspaceId");

CREATE INDEX "ClientRequest_clienteId_idx" ON "ClientRequest"("clienteId");

CREATE INDEX "ClientRequest_workspaceId_clienteId_idx" ON "ClientRequest"("workspaceId", "clienteId");

CREATE INDEX "ClientRequestAsset_requestId_idx" ON "ClientRequestAsset"("requestId");

CREATE UNIQUE INDEX "ForteSnapshot_workspaceId_key" ON "ForteSnapshot"("workspaceId");

CREATE INDEX "ForteSnapshot_workspaceId_idx" ON "ForteSnapshot"("workspaceId");

