/**
 * CORE-03C-D3 — safety tests for the deterministic-repairs applier.
 *
 * Proves, with zero network (local node:sqlite fixture):
 *   - every phase demands --target-production, 'apply' additionally demands
 *     --owner-authorized, and no override switch exists (--force,
 *     --skip-gates, --repair-all abort as unknown arguments);
 *   - the unanimity rule: one candidate → DETERMINISTIC, several →
 *     AMBIGUOUS, none → ORPHANED;
 *   - classification against a realistic fixture lands every row in the
 *     M2-approved bucket, honors parents-first projection (a child derives
 *     from a parent that will itself be repaired first), and plans SetNull
 *     convergence for Activity/Conversation/Message orphans;
 *   - executeRepairs performs UPDATE-only repairs that zero the orphan
 *     counts, leave AMBIGUOUS/ORPHANED/LEGITIMATE_NULL untouched, preserve
 *     every row total, and keep cross-tenant at 0;
 *   - a row that changed between classification and apply produces an
 *     affected-count mismatch and rolls the whole group back;
 *   - a stale plan (any aggregate count difference) is a hard stop.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { DatabaseSync } from "node:sqlite"
import {
  parseFlags,
  assertFlags,
  classifyCandidates,
  classifyD3,
  executeRepairs,
  countCrossTenant,
  assertPlansEqual,
  type Target,
  type QueryFn,
} from "./apply-core-03c-d3-deterministic-repairs"

// ─── Local fixture target (no network) ───────────────────────────────────────

function localTarget(db: DatabaseSync): Target {
  const query: QueryFn = async (sql, args = []) => db.prepare(sql).all(...(args as any[])) as any[]
  return {
    query,
    async withTransaction(fn) {
      db.exec("BEGIN")
      try {
        const result = await fn({
          query,
          run: async (sql, args = []) => Number(db.prepare(sql).run(...(args as any[])).changes),
        })
        db.exec("COMMIT")
        return result
      } catch (err) {
        db.exec("ROLLBACK")
        throw err
      }
    },
    close: () => db.close(),
  }
}

/** Minimal schema with the real table/column names the classifier queries. */
function buildFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
    CREATE TABLE "Cliente" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
    CREATE TABLE "Proyecto" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT);
    CREATE TABLE "Tarea" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Factura" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Transaccion" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Documento" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Contact" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT);
    CREATE TABLE "Conversation" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "clienteId" TEXT, "connectionId" TEXT);
    CREATE TABLE "Evento" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Nota" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "proyectoId" TEXT);
    CREATE TABLE "Notification" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "userId" TEXT);
    CREATE TABLE "User" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
    CREATE TABLE "Activity" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "module" TEXT, "recordId" TEXT);
    CREATE TABLE "Message" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "connectionId" TEXT);
    CREATE TABLE "ChannelConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT);

    INSERT INTO "Workspace" VALUES ('w1'), ('w2');

    -- Cliente: c1 deterministic (all children w1); c2 ambiguous (w1+w2); c3 orphaned (no children).
    INSERT INTO "Cliente" VALUES ('c1', NULL), ('c2', NULL), ('c3', NULL), ('c9', 'w2');
    INSERT INTO "Proyecto" VALUES ('pc1', 'w1', 'c1');
    INSERT INTO "Factura"  VALUES ('fc1', 'w1', 'c1', NULL);
    INSERT INTO "Documento" VALUES ('dc2a', 'w1', 'c2', NULL);
    INSERT INTO "Contact"   VALUES ('kc2b', 'w2', 'c2');

    -- Proyecto: p1 deterministic via parent c1 (projected, parents-first); p2 orphaned (no parent, no children).
    INSERT INTO "Proyecto" VALUES ('p1', NULL, 'c1'), ('p2', NULL, NULL);

    -- Tarea: t1 deterministic via projected p1; t2 ambiguous parent (c2) -> no candidates -> orphaned.
    INSERT INTO "Tarea" VALUES ('t1', NULL, NULL, 'p1'), ('t2', NULL, 'c2', NULL);

    -- Factura: fN deterministic via existing cliente c9 (live workspace w2).
    INSERT INTO "Factura" VALUES ('fN', NULL, 'c9', NULL);

    -- Transaccion: xN no parents at all -> orphaned.
    INSERT INTO "Transaccion" VALUES ('xN', NULL, NULL, NULL);

    -- Notification / User: LEGITIMATE_NULL, must never be written.
    INSERT INTO "Notification" VALUES ('n1', NULL, 'u1');
    INSERT INTO "User" VALUES ('u1', NULL), ('u2', NULL);

    -- Activity: a1 orphan workspace ref (SetNull, then derives via c1);
    --           a2 NULL + unmapped module -> ambiguous;
    --           a3 NULL + parent record missing -> orphaned;
    --           a4 NULL + module email -> Conversation cv1 (w2) -> deterministic.
    INSERT INTO "Activity" VALUES
      ('a1', 'w-deleted', 'clientes', 'c1'),
      ('a2', NULL, 'unknown_module', 'zz'),
      ('a3', NULL, 'proyectos', 'missing'),
      ('a4', NULL, 'email', 'cv1');
    INSERT INTO "Conversation" VALUES ('cv1', 'w2', NULL, 'conn-gone'), ('cv2', 'w1', NULL, 'conn1');

    -- Message: one orphaned connection ref, one valid, one NULL.
    INSERT INTO "ChannelConnection" VALUES ('conn1', 'w1');
    INSERT INTO "Message" VALUES ('m1', 'w1', 'conn-gone'), ('m2', 'w1', 'conn1'), ('m3', 'w1', NULL);
  `)
  return db
}

test("flags: --target-production always, --owner-authorized for apply, no overrides", () => {
  assert.throws(() => assertFlags("classify", parseFlags([])), /--target-production/)
  assertFlags("classify", parseFlags(["--target-production"]))
  assert.throws(() => assertFlags("apply", parseFlags(["--target-production"])), /--owner-authorized/)
  assertFlags("apply", parseFlags(["--target-production", "--owner-authorized"]))
  assert.throws(() => parseFlags(["--force"]), /unknown argument/)
  assert.throws(() => parseFlags(["--skip-gates"]), /unknown argument/)
  assert.throws(() => parseFlags(["--repair-all"]), /unknown argument/)
})

test("unanimity rule", () => {
  assert.equal(classifyCandidates(new Set(["w1"])), "DETERMINISTIC")
  assert.equal(classifyCandidates(new Set(["w1", "w2"])), "AMBIGUOUS")
  assert.equal(classifyCandidates(new Set()), "ORPHANED")
})

test("classification: every fixture row lands in its M2 bucket, parents-first", async () => {
  const t = localTarget(buildFixture())
  const { plan, assignments } = await classifyD3(t.query)

  assert.deepEqual(plan.cliente, { nullCount: 3, deterministic: 1, ambiguous: 1, orphaned: 1 })
  assert.deepEqual(plan.proyecto, { nullCount: 2, deterministic: 1, ambiguous: 0, orphaned: 1 })
  assert.deepEqual(plan.tarea, { nullCount: 2, deterministic: 1, ambiguous: 0, orphaned: 1 })
  assert.deepEqual(plan.factura, { nullCount: 1, deterministic: 1, ambiguous: 0, orphaned: 0 })
  assert.deepEqual(plan.transaccion, { nullCount: 1, deterministic: 0, ambiguous: 0, orphaned: 1 })
  assert.deepEqual(plan.notification, { nullCount: 1, legitimateNull: 1 })
  assert.deepEqual(plan.user, { nullCount: 2, legitimateNull: 2 })
  assert.deepEqual(plan.activity, { nullCount: 4, deterministic: 2, ambiguous: 1, orphaned: 1, orphanRefsSetNull: 1 })
  assert.equal(plan.conversation.orphanConnections, 1)
  assert.equal(plan.message.orphanConnections, 1)
  assert.equal(plan.crossTenantMismatches, 0)
  assert.equal(plan.totalPlannedWrites, 1 + 1 + 1 + 1 + 0 + 1 + 2 + 1 + 1)

  // Parents-first projection: p1 derives w1 from c1's PLANNED repair; t1 from p1's.
  assert.deepEqual(assignments.cliente, [{ id: "c1", ws: "w1" }])
  assert.deepEqual(assignments.proyecto, [{ id: "p1", ws: "w1" }])
  assert.deepEqual(assignments.tarea, [{ id: "t1", ws: "w1" }])
  assert.deepEqual(assignments.factura, [{ id: "fN", ws: "w2" }])
  // Activity a1 (post-SetNull) derives via c1→w1; a4 via Conversation cv1→w2.
  assert.deepEqual(
    [...assignments.activity].sort((x, y) => (x.id < y.id ? -1 : 1)),
    [
      { id: "a1", ws: "w1" },
      { id: "a4", ws: "w2" },
    ],
  )
  t.close()
})

test("executeRepairs: UPDATE-only, orphans zeroed, untouchables untouched, totals preserved", async () => {
  const db = buildFixture()
  const t = localTarget(db)
  const before: Record<string, number> = {}
  for (const table of ["Cliente", "Proyecto", "Tarea", "Factura", "Transaccion", "Activity", "Conversation", "Message", "Notification", "User"]) {
    before[table] = Number((db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
  }

  const { plan, assignments } = await classifyD3(t.query)
  await executeRepairs(t, plan, assignments)

  // Deterministic rows repaired.
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Cliente" WHERE id='c1'`).get() as any).w, "w1")
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Proyecto" WHERE id='p1'`).get() as any).w, "w1")
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Tarea" WHERE id='t1'`).get() as any).w, "w1")
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Factura" WHERE id='fN'`).get() as any).w, "w2")
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Activity" WHERE id='a1'`).get() as any).w, "w1")
  assert.equal((db.prepare(`SELECT "workspaceId" w FROM "Activity" WHERE id='a4'`).get() as any).w, "w2")

  // AMBIGUOUS / ORPHANED / LEGITIMATE_NULL untouched.
  for (const [table, id] of [
    ["Cliente", "c2"], ["Cliente", "c3"], ["Proyecto", "p2"], ["Tarea", "t2"],
    ["Transaccion", "xN"], ["Activity", "a2"], ["Activity", "a3"],
    ["Notification", "n1"], ["User", "u1"], ["User", "u2"],
  ] as const) {
    assert.equal((db.prepare(`SELECT "workspaceId" w FROM "${table}" WHERE id=?`).get(id) as any).w, null, `${table}/${id} must stay NULL`)
  }

  // SetNull convergence: connection orphans zeroed, valid links kept.
  assert.equal((db.prepare(`SELECT "connectionId" c FROM "Conversation" WHERE id='cv1'`).get() as any).c, null)
  assert.equal((db.prepare(`SELECT "connectionId" c FROM "Conversation" WHERE id='cv2'`).get() as any).c, "conn1")
  assert.equal((db.prepare(`SELECT "connectionId" c FROM "Message" WHERE id='m1'`).get() as any).c, null)
  assert.equal((db.prepare(`SELECT "connectionId" c FROM "Message" WHERE id='m2'`).get() as any).c, "conn1")

  // Totals preserved (UPDATE-only), cross-tenant stays 0, orphan counts now 0.
  for (const [table, count] of Object.entries(before)) {
    assert.equal(Number((db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c), count, `${table} row total changed`)
  }
  assert.equal(await countCrossTenant(t.query), 0)
  const post = await classifyD3(t.query)
  assert.equal(post.plan.activity.orphanRefsSetNull, 0)
  assert.equal(post.plan.conversation.orphanConnections, 0)
  assert.equal(post.plan.message.orphanConnections, 0)
  assert.equal(post.plan.totalPlannedWrites, 0)
  t.close()
})

test("a row changed since classification rolls the whole group back", async () => {
  const db = buildFixture()
  const t = localTarget(db)
  const { plan, assignments } = await classifyD3(t.query)
  // Sabotage: c1 gets repaired out-of-band → the guarded UPDATE affects 0 rows.
  db.prepare(`UPDATE "Cliente" SET "workspaceId"='w2' WHERE id='c1'`).run()
  await assert.rejects(() => executeRepairs(t, plan, assignments), /expected exactly 1 affected row/)
  // Rollback left the other planned Cliente rows untouched (nothing half-applied).
  assert.equal((db.prepare(`SELECT COUNT(*) c FROM "Proyecto" WHERE "workspaceId" IS NOT NULL AND id='p1'`).get() as any).c, 0)
  t.close()
})

test("a stale plan is a hard stop", async () => {
  const t = localTarget(buildFixture())
  const { plan } = await classifyD3(t.query)
  const stale = JSON.parse(JSON.stringify(plan))
  stale.cliente.deterministic = 99
  assert.throws(() => assertPlansEqual(stale, plan), /differs from the recorded pre-write plan/)
  assertPlansEqual(plan, JSON.parse(JSON.stringify(plan)))
  t.close()
})
