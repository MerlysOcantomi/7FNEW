/**
 * CORE-03C-D6 PRODUCTION ADOPTION — safety tests for the production applier.
 *
 * Proves, with no network access at all:
 *   - the target guard accepts ONLY the pinned production hostname; the D6B
 *     rehearsal branch, local targets, embedded credentials, plaintext http
 *     and foreign schemes are all refused;
 *   - every phase demands the explicit --target-production flag, 'apply'
 *     additionally demands --owner-authorized, and no override flag exists
 *     (--force / --skip-gates / --ignore-drift abort as unknown arguments);
 *   - the three deployable migration files are byte-identical to what the
 *     D6B cloud rehearsal validated (pinned sha256), and any tampering is
 *     detected before a connection could ever be opened.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import {
  PRODUCTION_HOST,
  REHEARSAL_HOST,
  REHEARSED_SHA256,
  EXPECT,
  assertProductionUrl,
  assertRehearsedChecksums,
  parseFlags,
  assertFlags,
} from "./apply-core-03c-production-adoption"
import { PINNED_HOST as D6B_PINNED_HOST } from "./rehearse-core-03c-d6b"

const MIGRATIONS = join(process.cwd(), "prisma", "migrations")

test("target guard accepts only the pinned production hostname", () => {
  assertProductionUrl(`libsql://${PRODUCTION_HOST}`)
  assertProductionUrl(`https://${PRODUCTION_HOST}`)
  assertProductionUrl(`wss://${PRODUCTION_HOST}`)
  // The rehearsal branch is refused by name — the two tools can never swap targets.
  assert.equal(REHEARSAL_HOST, D6B_PINNED_HOST)
  assert.throws(() => assertProductionUrl(`libsql://${REHEARSAL_HOST}`), /rehearsal/)
  // Everything else is refused too.
  assert.throws(() => assertProductionUrl(`libsql://prod-${PRODUCTION_HOST}`))
  assert.throws(() => assertProductionUrl(`libsql://${PRODUCTION_HOST}.evil.example`))
  assert.throws(() => assertProductionUrl("libsql://127.0.0.1"))
  assert.throws(() => assertProductionUrl("libsql://localhost"))
  assert.throws(() => assertProductionUrl("file:/tmp/whatever.db"))
  assert.throws(() => assertProductionUrl(`http://${PRODUCTION_HOST}`)) // plaintext refused
  assert.throws(() => assertProductionUrl(`libsql://user:pass@${PRODUCTION_HOST}`)) // embedded credentials refused
  assert.throws(() => assertProductionUrl(""))
  assert.throws(() => assertProductionUrl("not a url"))
})

test("the production and rehearsal pins are different databases", () => {
  assert.notEqual(PRODUCTION_HOST, REHEARSAL_HOST)
})

test("every phase requires --target-production; apply also requires --owner-authorized", () => {
  assert.throws(() => assertFlags("identify", parseFlags([])), /--target-production/)
  assert.throws(() => assertFlags("apply", parseFlags([])), /--target-production/)
  assertFlags("identify", parseFlags(["--target-production"]))
  assertFlags("gates", parseFlags(["--target-production"]))
  assertFlags("backup", parseFlags(["--target-production"]))
  assert.throws(() => assertFlags("apply", parseFlags(["--target-production"])), /--owner-authorized/)
  assertFlags("apply", parseFlags(["--target-production", "--owner-authorized"]))
})

test("no override flag exists — the forbidden switches abort as unknown", () => {
  assert.throws(() => parseFlags(["--force"]), /unknown argument/)
  assert.throws(() => parseFlags(["--skip-gates"]), /unknown argument/)
  assert.throws(() => parseFlags(["--ignore-drift"]), /unknown argument/)
  assert.throws(() => parseFlags(["--target-production", "--force"]), /unknown argument/)
})

test("the committed migration files are byte-identical to the D6B rehearsal", () => {
  // The pinned checksums must match the real files in this working tree.
  for (const [name, expected] of Object.entries(REHEARSED_SHA256)) {
    const actual = createHash("sha256").update(readFileSync(join(MIGRATIONS, name, "migration.sql"))).digest("hex")
    assert.equal(actual, expected, `${name} drifted from the rehearsed bytes`)
  }
  assertRehearsedChecksums() // and the guard itself passes on the real tree
})

test("checksum guard detects a tampered migration", () => {
  const dir = mkdtempSync(join(tmpdir(), "core03c-checksum-test-"))
  try {
    for (const name of Object.keys(REHEARSED_SHA256)) {
      mkdirSync(join(dir, name))
      writeFileSync(join(dir, name, "migration.sql"), readFileSync(join(MIGRATIONS, name, "migration.sql")))
    }
    assertRehearsedChecksums(dir) // faithful copy passes
    writeFileSync(join(dir, "2_add_link_columns", "migration.sql"), `ALTER TABLE "InboxTodo" ADD COLUMN "workspaceTaskId" TEXT;\n-- tampered\n`)
    assert.throws(() => assertRehearsedChecksums(dir), /differs from the D6B-rehearsed bytes/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("structural expectations match the D6/D6B-verified numbers", () => {
  assert.deepEqual(EXPECT.baseline, { tables: 48, indexes: 61 })
  assert.deepEqual(EXPECT.afterByName["1_add_missing_indexes"], { tables: 48, indexes: 82 })
  assert.deepEqual(EXPECT.afterByName["2_add_link_columns"], { tables: 48, indexes: 84 })
  assert.deepEqual(EXPECT.afterByName["3_create_portal_tables"], { tables: 52, indexes: 93 })
})
