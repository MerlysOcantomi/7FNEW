-- 2_add_link_columns — CORE-03C-2B (C5).
--
-- Two Prisma-declared, never-deployed nullable workspace-link columns and
-- their two dependent indexes (CORE-03B §11 HIGH; decisions doc §6.D / §6.E).
-- Additive only: nullable, no default, no foreign key, no NOT NULL, no table
-- rebuild, no DML, no backfill, no invented workspace. Validating and
-- backfilling the links is a separate, later phase (M1/M2) — never here.
--
-- Rollback (non-executable reference — do not run as part of this migration):
--   the two indexes reverse with
--     DROP INDEX "InboxTodo_workspaceId_workspaceTaskId_idx";
--     DROP INDEX "QRCode_workspaceId_module_recordId_idx";
--   Dropping the COLUMNS on SQLite is NOT a casual rollback: it requires a
--   separately rehearsed procedure (ALTER TABLE DROP COLUMN constraints /
--   table rebuild considerations). Do not attempt it as part of undoing
--   this migration.

ALTER TABLE "InboxTodo" ADD COLUMN "workspaceTaskId" TEXT;

CREATE INDEX "InboxTodo_workspaceId_workspaceTaskId_idx" ON "InboxTodo"("workspaceId", "workspaceTaskId");

ALTER TABLE "QRCode" ADD COLUMN "workspaceId" TEXT;

CREATE INDEX "QRCode_workspaceId_module_recordId_idx" ON "QRCode"("workspaceId", "module", "recordId");
