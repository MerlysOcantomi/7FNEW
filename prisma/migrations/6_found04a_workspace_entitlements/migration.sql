-- 6_found04a_workspace_entitlements — FOUND-04A.
--
-- Persistent, qualitative workspace entitlement store + explicit adoption
-- marker. Strictly ADDITIVE:
--
--   1. `Workspace.entitlementRevision` (nullable INTEGER) — the adoption
--      marker. Every existing workspace stays NULL = NOT ADOPTED, so the
--      legacy observational resolution (plan / config.modules /
--      PresenceSubscription) keeps governing Workspace CAN unchanged.
--      1 = adopted under the initial store revision (persisted entitlements
--      become authoritative); any other value fails closed in code.
--   2. `WorkspaceEntitlement` — one row per qualitative grant
--      (product | addon | offering) per workspace, with status
--      (active | trial | suspended | expired), source
--      (billing | manual | migration) and an optional validity window.
--      Uniqueness: (workspaceId, kind, key). The unique index leads with
--      workspaceId, so it also serves the only read path this mission adds
--      (load all rows for one workspace) — no additional index is needed.
--
-- Deliberately NOT here: no backfill, no INSERTs, no reinterpretation of
-- plans or config.modules, no changes to PresenceSubscription, no drops or
-- renames of legacy columns, no limits/usage/billing structures. The known
-- residual column-default drift (drift-manifest.json) is untouched — this
-- migration performs no table rebuilds. Plain SQLite DDL compatible with
-- the current Turso/SQLite database; this is NOT a Neon/Postgres migration
-- (provider neutrality lives in the application contracts, not in this
-- DDL). No runtime writer exists in FOUND-04A; adoption of any workspace
-- is a future, owner-reviewed operation.
--
-- DEPLOYMENT ORDER: the Vercel build (`prisma generate && next build`)
-- does not apply migrations, and the FOUND-04A runtime reads the columns
-- created here — this migration must be applied and verified on the
-- production database BEFORE the code that reads it is deployed, under a
-- separate owner authorization.

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "entitlementRevision" INTEGER;

-- CreateTable
CREATE TABLE "WorkspaceEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEntitlement_workspaceId_kind_key_key" ON "WorkspaceEntitlement"("workspaceId", "kind", "key");
