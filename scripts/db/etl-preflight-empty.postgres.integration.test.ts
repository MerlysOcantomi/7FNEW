import assert from "node:assert/strict"
import test from "node:test"
import { Client as PgClient } from "pg"
import { resolveTestDatabaseTarget, connectionStringFor } from "@/test/support/postgres"
import { assertEmptyProductionTarget } from "./etl-turso-to-postgres"

/**
 * NEON-05 R2 — `preflight-empty` against a genuinely EMPTY database (no
 * history applied), the state the production target must be in before the
 * `migrate` tag applies 0_init. Creates and drops its own bare database on
 * the loopback test server; never touches anything else.
 */
const PROD = { project: "old-wave-11795585", branch: "br-broad-river-b2ue75l8" }

test("preflight-empty passes on an empty database, then refuses it as soon as a foreign table, a ledger or a sequence appears", async () => {
  const admin = resolveTestDatabaseTarget()
  const name = `t7f_preflight_${Date.now().toString(36)}`
  const adminClient = new PgClient({ host: admin.host, port: admin.port, user: admin.user, password: admin.password, database: admin.database })
  await adminClient.connect()
  await adminClient.query(`CREATE DATABASE "${name}"`)
  try {
    const target = { ...admin, database: name }
    const url = connectionStringFor(target)
    const expectation = { role: "production" as const, host: admin.host, database: name, production: PROD }
    const log: string[] = []
    const report = await assertEmptyProductionTarget({ targetUrl: url, expectation, log: (l) => log.push(l) })
    assert.deepEqual({ baseTables: report.baseTables, hasLedger: report.hasLedger, sequences: report.sequences, database: report.database }, { baseTables: 0, hasLedger: false, sequences: 0, database: name })
    assert.match(report.serverVersion, /^PostgreSQL /)
    assert.ok(!log.join("\n").includes(url))

    const pg = new PgClient({ host: target.host, port: target.port, user: target.user, password: target.password, database: name })
    await pg.connect()
    try {
      await pg.query(`CREATE TABLE "Foreign" (id integer PRIMARY KEY)`)
      await assert.rejects(assertEmptyProductionTarget({ targetUrl: url, expectation }), /not empty \(baseTables=1/)
      await pg.query(`DROP TABLE "Foreign"`)
      await pg.query(`CREATE SEQUENCE seq_x`)
      await assert.rejects(assertEmptyProductionTarget({ targetUrl: url, expectation }), /sequences=1/)
      await pg.query(`DROP SEQUENCE seq_x`)
      await pg.query(`CREATE TABLE "_prisma_migrations" (id text PRIMARY KEY)`)
      await assert.rejects(assertEmptyProductionTarget({ targetUrl: url, expectation }), /ledger=true/)
      await pg.query(`DROP TABLE "_prisma_migrations"`)
      assert.equal((await assertEmptyProductionTarget({ targetUrl: url, expectation })).baseTables, 0, "empty again → passes again")
    } finally {
      await pg.end()
    }
  } finally {
    await adminClient.query(`DROP DATABASE "${name}"`)
    await adminClient.end()
  }
})
