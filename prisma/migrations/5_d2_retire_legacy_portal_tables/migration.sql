-- 5_d2_retire_legacy_portal_tables — CORE-03C-D2.
--
-- Retires the three legacy client-portal tables the canonical portal
-- (ClientAsset / ClientRequest / ClientRequestAsset, migration 3) replaced:
--
--   ClientProject
--   ClientInvoice
--   ClientFile
--
-- Owner-approved in M2 on the production evidence that all three hold
-- 0 rows and no active runtime reference exists; the executing mission
-- re-verifies both conditions (COUNT(*) == 0 per table, zero inbound
-- dependencies) immediately before this DDL runs. One row anywhere → the
-- applier STOPS and this migration must not run.
--
-- All three tables are leaves: their only relation is an OUTBOUND FK to
-- Cliente (verified in the deployed DDL and the Prisma schema; nothing
-- references them, ClientInvoice does not reference ClientProject). None
-- carries an explicit index, so the explicit-index count is unchanged.
-- Deliberately no IF EXISTS: a missing table means the state is not the
-- rehearsed PENDING state and the failure must stay visible, not be
-- skipped. No CASCADE-equivalent is used anywhere.
--
-- The canonical portal tables (ClientAsset, ClientRequest,
-- ClientRequestAsset, ForteSnapshot) and ClientAuth are NOT touched.
--
-- Rollback (non-executable reference — do not run as part of this
-- migration): the tables were empty, so recovery is re-creating them with
-- their original DDL from `0_baseline` (preserved in history and in the
-- pre-retirement checkpoint taken in the execution window).

DROP TABLE "ClientFile";

DROP TABLE "ClientInvoice";

DROP TABLE "ClientProject";
