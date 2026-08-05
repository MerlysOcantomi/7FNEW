import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createClient, type Client } from "@libsql/client"

/**
 * CORE-01 — multi-tenant isolation tests for the legacy `Usuario` model.
 *
 * These run against a THROWAWAY LOCAL SQLite file created in the OS temp
 * directory and deleted afterwards. Nothing here touches Turso, Neon or any
 * remote database: `DATABASE_URL` is overwritten with a `file:` URL before
 * `@core/db` is imported, which is why every module under test is loaded with
 * a dynamic `import()` inside `test.before` rather than a static import at the
 * top of the file.
 *
 * The schema is the exact DDL Prisma generates for these seven models
 * (`prisma migrate diff --from-empty --to-schema prisma/schema.prisma`), so
 * the service code runs against real column types, real defaults and real
 * foreign keys — including `Tarea.usuarioId ON DELETE SET NULL`, which is the
 * mechanism a cross-tenant delete would abuse.
 *
 * Every blocked operation is verified by RE-READING the row with the raw
 * libSQL client — deliberately not through the service under test — so a test
 * proves the absence of a write rather than merely the shape of a return
 * value.
 */

const SCHEMA_SQL = [
  `CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'creative-agency',
    "verticalKey" TEXT NOT NULL DEFAULT 'creative-agency',
    "config" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "avatar" TEXT,
    "locale" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "visibleProjects" TEXT,
    "workspaceId" TEXT,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'miembro',
    "departamento" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "empresa" TEXT,
    "preferredPaymentMethod" TEXT,
    "currency" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'empresa',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "workspaceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cliente_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'planificacion',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "presupuesto" REAL,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "estimatedDelivery" DATETIME,
    "actualDelivery" DATETIME,
    "tags" TEXT,
    "internalNotes" TEXT,
    "assignedTo" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedUsers" TEXT,
    "createdBy" TEXT,
    "clienteId" TEXT,
    "workspaceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proyecto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Proyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "fechaLimite" DATETIME,
    "completedAt" DATETIME,
    "proyectoId" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT,
    "workspaceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tarea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug")`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email")`,
  `CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId")`,
]

const WS_A = "ws-alpha"
const WS_B = "ws-beta"

/** Workspace membership of every seeded `Usuario`, for quick reference:
 *
 *   u-alpha       a@x.com   → member of A only, one task in A     → exclusive in A
 *   u-beta        b@x.com   → member of B only                    → foreign from A
 *   u-shared      s@x.com   → member of A AND B                   → shared in both
 *   u-ghost       g@x.com   → no `User` row at all                → orphan
 *   u-nomember    n@x.com   → `User` exists, zero memberships     → orphan
 *   u-crosstask   c@x.com   → member of A only, but a task in B   → shared in A
 *   u-nulltask    z@x.com   → member of A only, but a NULL-ws task→ shared in A
 *   u-deletable   d@x.com   → member of A only, no tasks          → exclusive in A
 */

let dir: string
let raw: Client

type Db = (typeof import("@core/db"))["db"]
type UsuariosService = typeof import("./service")
type TareasService = typeof import("../tareas/service")
type ScopeModule = typeof import("./scope")

let db: Db
let usuarios: UsuariosService
let tareas: TareasService
let scope: ScopeModule

const now = "2026-01-01 00:00:00"

async function seed() {
  const ws = (id: string, slug: string) =>
    `INSERT INTO "Workspace" ("id","nombre","slug","updatedAt") VALUES ('${id}','${slug}','${slug}','${now}')`
  const user = (id: string, email: string) =>
    `INSERT INTO "User" ("id","email","updatedAt") VALUES ('${id}','${email}','${now}')`
  const member = (id: string, userId: string, workspaceId: string) =>
    `INSERT INTO "WorkspaceMember" ("id","userId","workspaceId") VALUES ('${id}','${userId}','${workspaceId}')`
  const usuario = (id: string, email: string, nombre: string) =>
    `INSERT INTO "Usuario" ("id","nombre","email","updatedAt") VALUES ('${id}','${nombre}','${email}','${now}')`
  const tarea = (id: string, titulo: string, usuarioId: string | null, workspaceId: string | null) =>
    `INSERT INTO "Tarea" ("id","titulo","usuarioId","workspaceId","updatedAt") VALUES ('${id}','${titulo}',${
      usuarioId ? `'${usuarioId}'` : "NULL"
    },${workspaceId ? `'${workspaceId}'` : "NULL"},'${now}')`

  const statements = [
    ws(WS_A, "alpha"),
    ws(WS_B, "beta"),

    user("user-alpha", "a@x.com"),
    user("user-beta", "b@x.com"),
    user("user-shared", "s@x.com"),
    user("user-nomember", "n@x.com"),
    user("user-crosstask", "c@x.com"),
    user("user-nulltask", "z@x.com"),
    user("user-deletable", "d@x.com"),
    // Member of A with no `Usuario` row yet — the only address `create` may accept.
    user("user-newcomer", "newcomer@x.com"),

    member("m1", "user-alpha", WS_A),
    member("m2", "user-beta", WS_B),
    member("m3", "user-shared", WS_A),
    member("m4", "user-shared", WS_B),
    member("m5", "user-crosstask", WS_A),
    member("m6", "user-nulltask", WS_A),
    member("m7", "user-deletable", WS_A),
    member("m8", "user-newcomer", WS_A),

    usuario("u-alpha", "a@x.com", "Alpha Person"),
    usuario("u-beta", "b@x.com", "Beta Person"),
    usuario("u-shared", "s@x.com", "Shared Person"),
    usuario("u-ghost", "g@x.com", "Ghost Person"),
    usuario("u-nomember", "n@x.com", "No Member Person"),
    usuario("u-crosstask", "c@x.com", "Cross Task Person"),
    usuario("u-nulltask", "z@x.com", "Null Task Person"),
    usuario("u-deletable", "d@x.com", "Deletable Person"),

    // Legitimate, same-workspace assignments.
    tarea("t-a1", "Alpha task", "u-alpha", WS_A),
    tarea("t-b1", "Beta task", "u-beta", WS_B),
    // Pre-existing BAD link: a task in A pointing at a Usuario owned by B.
    tarea("t-a2", "Alpha task with foreign assignee", "u-beta", WS_A),
    // u-crosstask is a member of A but is also referenced from B.
    tarea("t-a3", "Alpha task for cross-task person", "u-crosstask", WS_A),
    tarea("t-b2", "Beta task for cross-task person", "u-crosstask", WS_B),
    // u-nulltask is referenced by an unowned (NULL workspace) task.
    tarea("t-null", "Unowned task", "u-nulltask", null),
  ]

  for (const statement of statements) {
    await raw.execute(statement)
  }
}

test.before(async () => {
  dir = mkdtempSync(join(tmpdir(), "core01-usuario-scope-"))
  const url = `file:${join(dir, "scope.db")}`

  raw = createClient({ url })
  for (const statement of SCHEMA_SQL) {
    await raw.execute(statement)
  }
  await raw.execute("PRAGMA foreign_keys = ON")
  await seed()

  // Point the app's Prisma client at the throwaway file BEFORE it is loaded.
  process.env.DATABASE_URL = url
  delete process.env.DATABASE_AUTH_TOKEN
  delete process.env.TURSO_AUTH_TOKEN

  db = (await import("@core/db")).db
  usuarios = await import("./service")
  tareas = await import("../tareas/service")
  scope = await import("./scope")
})

test.after(async () => {
  await db.$disconnect()
  raw.close()
  rmSync(dir, { recursive: true, force: true })
})

// ── Helpers that read the database WITHOUT going through the code under test ──

async function rawUsuario(id: string) {
  const result = await raw.execute({
    sql: `SELECT "id","nombre","email","rol","departamento","estado" FROM "Usuario" WHERE "id" = ?`,
    args: [id],
  })
  return result.rows[0] ?? null
}

async function rawUsuarioCount() {
  const result = await raw.execute(`SELECT COUNT(*) AS cnt FROM "Usuario"`)
  return Number(result.rows[0]?.cnt ?? 0)
}

async function rawTareaAssignee(id: string) {
  const result = await raw.execute({
    sql: `SELECT "usuarioId","workspaceId" FROM "Tarea" WHERE "id" = ?`,
    args: [id],
  })
  return result.rows[0] ?? null
}

async function rawTareaCount() {
  const result = await raw.execute(`SELECT COUNT(*) AS cnt FROM "Tarea"`)
  return Number(result.rows[0]?.cnt ?? 0)
}

function ids(rows: ReadonlyArray<{ id: string }>): string[] {
  return rows.map((row) => row.id).sort()
}

// ── The pure rule ────────────────────────────────────────────────────────────

test("classifyUsuarioScope: exhaustive rule table", () => {
  const base = {
    email: "a@x.com",
    userExists: true,
    isMemberOfActiveWorkspace: true,
    membershipCount: 1,
    hasForeignOrUnscopedTasks: false,
  }

  assert.equal(scope.classifyUsuarioScope(base).scope, "exclusive")
  assert.equal(scope.classifyUsuarioScope(base).mutable, true)
  assert.equal(scope.classifyUsuarioScope(base).visible, true)

  assert.equal(scope.classifyUsuarioScope({ ...base, email: null }).scope, "orphan")
  assert.equal(scope.classifyUsuarioScope({ ...base, email: "   " }).scope, "orphan")
  assert.equal(scope.classifyUsuarioScope({ ...base, userExists: false }).scope, "orphan")

  const foreign = scope.classifyUsuarioScope({
    ...base,
    isMemberOfActiveWorkspace: false,
    membershipCount: 1,
  })
  assert.equal(foreign.scope, "foreign")
  assert.equal(foreign.visible, false)
  assert.equal(foreign.mutable, false)

  const noMembership = scope.classifyUsuarioScope({
    ...base,
    isMemberOfActiveWorkspace: false,
    membershipCount: 0,
  })
  assert.equal(noMembership.scope, "orphan")

  const multi = scope.classifyUsuarioScope({ ...base, membershipCount: 2 })
  assert.equal(multi.scope, "shared")
  assert.equal(multi.visible, true)
  assert.equal(multi.mutable, false)
  assert.deepEqual(multi.reasons, ["multi_workspace_member"])

  const crossTask = scope.classifyUsuarioScope({ ...base, hasForeignOrUnscopedTasks: true })
  assert.equal(crossTask.scope, "shared")
  assert.equal(crossTask.mutable, false)
  assert.deepEqual(crossTask.reasons, ["foreign_or_unscoped_tasks"])
})

test("normalizeEmail: canonical form used for cross-model correlation", () => {
  assert.equal(scope.normalizeEmail("  Ana@X.COM "), "ana@x.com")
  assert.equal(scope.normalizeEmail(""), null)
  assert.equal(scope.normalizeEmail("   "), null)
  assert.equal(scope.normalizeEmail(null), null)
  assert.equal(scope.normalizeEmail(undefined), null)
})

// ── 15. The tenant argument itself is non-negotiable ─────────────────────────

test("a missing workspaceId fails before any query or write runs", async () => {
  const usuariosBefore = await rawUsuarioCount()
  const tareasBefore = await rawTareaCount()

  for (const bad of ["", "   "]) {
    await assert.rejects(() => usuarios.list({ workspaceId: bad }), /workspaceId/)
    await assert.rejects(() => usuarios.getById("u-alpha", bad), /workspaceId/)
    await assert.rejects(() => usuarios.remove("u-alpha", bad), /workspaceId/)
    await assert.rejects(() => tareas.list({ workspaceId: bad }), /workspaceId/)
  }

  // Same guard for the values TypeScript cannot rule out at a JS boundary.
  const undefinedWorkspace = undefined as unknown as string
  await assert.rejects(() => usuarios.list({ workspaceId: undefinedWorkspace }), /workspaceId/)
  await assert.rejects(
    () => usuarios.update("u-alpha", { nombre: "x" }, undefinedWorkspace),
    /workspaceId/,
  )
  await assert.rejects(
    () => tareas.create({ titulo: "x" }, undefinedWorkspace),
    /workspaceId/,
  )

  assert.equal(await rawUsuarioCount(), usuariosBefore)
  assert.equal(await rawTareaCount(), tareasBefore)
  assert.deepEqual((await rawUsuario("u-alpha"))?.nombre, "Alpha Person")
})

// ── 1-4. Listing is scoped, and ambiguity is surfaced, not hidden ────────────

test("workspace A does not list a Usuario exclusive to workspace B", async () => {
  const { data } = await usuarios.list({ workspaceId: WS_A, take: 100 })
  const listed = ids(data)
  assert.ok(!listed.includes("u-beta"), "u-beta must not be visible from workspace A")
  assert.ok(listed.includes("u-alpha"))
})

test("workspace B does not list a Usuario exclusive to workspace A", async () => {
  const { data } = await usuarios.list({ workspaceId: WS_B, take: 100 })
  const listed = ids(data)
  assert.ok(!listed.includes("u-alpha"), "u-alpha must not be visible from workspace B")
  assert.ok(listed.includes("u-beta"))
})

test("a Usuario with no User account or no membership is never listed", async () => {
  for (const workspaceId of [WS_A, WS_B]) {
    const { data } = await usuarios.list({ workspaceId, take: 100 })
    const listed = ids(data)
    assert.ok(!listed.includes("u-ghost"), "orphan without a User row must stay hidden")
    assert.ok(!listed.includes("u-nomember"), "User without any membership must stay hidden")
  }
})

test("a Usuario shared between A and B is never presented as exclusively owned", async () => {
  const { data } = await usuarios.list({ workspaceId: WS_A, take: 100 })

  const shared = data.find((row) => row.id === "u-shared")
  assert.ok(shared, "a genuine member of A must stay visible in A's directory")
  assert.equal(shared.workspaceScope, "shared")

  const exclusive = data.find((row) => row.id === "u-alpha")
  assert.equal(exclusive?.workspaceScope, "exclusive")

  // Ambiguity from a foreign / unowned task reference is reported the same way.
  assert.equal(data.find((row) => row.id === "u-crosstask")?.workspaceScope, "shared")
  assert.equal(data.find((row) => row.id === "u-nulltask")?.workspaceScope, "shared")

  const decision = await scope.resolveUsuarioScope(WS_A, {
    id: "u-shared",
    email: "s@x.com",
  })
  assert.equal(decision.mutable, false)
})

test("list: total is computed with exactly the same filter as data", async () => {
  const { data, total } = await usuarios.list({ workspaceId: WS_A, take: 100 })
  assert.equal(total, data.length)

  // Paginating must not change the total, and must not leak an extra row.
  const firstPage = await usuarios.list({ workspaceId: WS_A, take: 2, skip: 0 })
  assert.equal(firstPage.total, total)
  assert.ok(firstPage.data.length <= 2)
  for (const row of firstPage.data) {
    assert.ok(["exclusive", "shared"].includes(row.workspaceScope))
  }
})

test("list: caller filters still apply on top of the workspace scope", async () => {
  const filtered = await usuarios.list({ workspaceId: WS_A, search: "Alpha", take: 100 })
  assert.deepEqual(ids(filtered.data), ["u-alpha"])
  assert.equal(filtered.total, 1)
})

// ── 5-6. getById ─────────────────────────────────────────────────────────────

test("getById of a Usuario owned by another workspace behaves as not found", async () => {
  assert.equal(await usuarios.getById("u-beta", WS_A), null)
  assert.equal(await usuarios.getById("u-alpha", WS_B), null)
  // Orphans are indistinguishable from foreign rows, on purpose.
  assert.equal(await usuarios.getById("u-ghost", WS_A), null)
  assert.equal(await usuarios.getById("u-nomember", WS_A), null)
  assert.equal(await usuarios.getById("does-not-exist", WS_A), null)
})

test("getById only ever includes tasks belonging to the active workspace", async () => {
  const fromA = await usuarios.getById("u-crosstask", WS_A)
  assert.ok(fromA, "u-crosstask is a member of A and must remain readable there")
  assert.deepEqual(ids(fromA.tareas), ["t-a3"])
  for (const tarea of fromA.tareas) {
    assert.equal(tarea.workspaceId, WS_A)
  }

  const fromB = await usuarios.getById("u-crosstask", WS_B)
  assert.equal(fromB, null, "u-crosstask is not a member of B")

  // The shared person is readable from both sides, each seeing only its own side.
  const sharedFromA = await usuarios.getById("u-shared", WS_A)
  assert.equal(sharedFromA?.workspaceScope, "shared")
  assert.deepEqual(sharedFromA?.tareas, [])
})

// ── 7-10. Writes ─────────────────────────────────────────────────────────────

test("update of a Usuario owned by another workspace writes nothing", async () => {
  const before = await rawUsuario("u-beta")

  const result = await usuarios.update("u-beta", { nombre: "Hijacked" }, WS_A)
  assert.equal(result, null, "a foreign id must behave as not found")

  assert.deepEqual(await rawUsuario("u-beta"), before)
})

test("delete of a Usuario owned by another workspace writes nothing", async () => {
  const before = await rawUsuario("u-beta")
  const countBefore = await rawUsuarioCount()

  const result = await usuarios.remove("u-beta", WS_A)
  assert.equal(result, null)

  assert.deepEqual(await rawUsuario("u-beta"), before)
  assert.equal(await rawUsuarioCount(), countBefore)
  // The foreign workspace's assignment survives untouched.
  assert.equal((await rawTareaAssignee("t-b1"))?.usuarioId, "u-beta")
})

test("update and delete of a shared Usuario write nothing", async () => {
  const before = await rawUsuario("u-shared")
  const countBefore = await rawUsuarioCount()

  assert.equal(await usuarios.update("u-shared", { rol: "admin" }, WS_A), null)
  assert.equal(await usuarios.update("u-shared", { rol: "admin" }, WS_B), null)
  assert.equal(await usuarios.remove("u-shared", WS_A), null)
  assert.equal(await usuarios.remove("u-shared", WS_B), null)

  assert.deepEqual(await rawUsuario("u-shared"), before)
  assert.equal(await rawUsuarioCount(), countBefore)
})

test("delete is blocked when the Usuario is referenced by a foreign or unowned task", async () => {
  const countBefore = await rawUsuarioCount()

  // Referenced by a task in workspace B.
  assert.equal(await usuarios.remove("u-crosstask", WS_A), null)
  assert.ok(await rawUsuario("u-crosstask"))
  assert.equal((await rawTareaAssignee("t-b2"))?.usuarioId, "u-crosstask")
  assert.equal((await rawTareaAssignee("t-a3"))?.usuarioId, "u-crosstask")

  // Referenced by a task with a NULL workspaceId.
  assert.equal(await usuarios.remove("u-nulltask", WS_A), null)
  assert.ok(await rawUsuario("u-nulltask"))
  const unowned = await rawTareaAssignee("t-null")
  assert.equal(unowned?.usuarioId, "u-nulltask")
  assert.equal(unowned?.workspaceId, null)

  assert.equal(await rawUsuarioCount(), countBefore, "no row may be deleted")
})

// ── 11. create ───────────────────────────────────────────────────────────────

test("create rejects an email that is foreign, orphan or shared", async () => {
  const countBefore = await rawUsuarioCount()

  const attempts: Array<[string, string]> = [
    ["b@x.com", "member of another workspace"],
    ["g@x.com", "no User account"],
    ["n@x.com", "User without any membership"],
    ["s@x.com", "member of two workspaces"],
    ["nobody@x.com", "unknown address"],
  ]

  for (const [email, why] of attempts) {
    await assert.rejects(
      () => usuarios.create({ nombre: "Intruder", email }, WS_A),
      (error: Error) => error.name === "WorkspaceError",
      `create must refuse ${email} (${why})`,
    )
  }

  assert.equal(await rawUsuarioCount(), countBefore, "no row may be created")
})

// ── 12-13. Tarea.usuarioId integrity ─────────────────────────────────────────

test("Tarea create refuses an assignee outside the workspace scope", async () => {
  const countBefore = await rawTareaCount()

  for (const usuarioId of ["u-beta", "u-shared", "u-ghost", "u-nomember", "u-crosstask", "missing"]) {
    await assert.rejects(
      () => tareas.create({ titulo: "Cross tenant", usuarioId }, WS_A),
      (error: Error) => error.name === "WorkspaceError",
      `assigning ${usuarioId} from workspace A must be refused`,
    )
  }

  assert.equal(await rawTareaCount(), countBefore, "no task may be created")
})

test("Tarea update refuses a new assignee outside the workspace scope", async () => {
  const before = await rawTareaAssignee("t-a1")

  for (const usuarioId of ["u-beta", "u-shared", "u-nulltask"]) {
    await assert.rejects(
      () => tareas.update("t-a1", { usuarioId }, WS_A),
      (error: Error) => error.name === "WorkspaceError",
    )
  }

  assert.deepEqual(await rawTareaAssignee("t-a1"), before, "the assignment must be unchanged")
})

test("Tarea update that does not touch the assignee still works on a legacy row", async () => {
  // t-a2 carries a pre-existing foreign assignee. Editing anything else must
  // not be blocked by a link this caller did not create.
  const updated = await tareas.update("t-a2", { estado: "en_progreso" }, WS_A)
  assert.equal(updated?.estado, "en_progreso")
  assert.equal((await rawTareaAssignee("t-a2"))?.usuarioId, "u-beta", "no silent repair")
})

test("Tarea reads never expose a Usuario relation from another workspace", async () => {
  const { data } = await tareas.list({ workspaceId: WS_A, take: 100 })

  const legacy = data.find((row) => row.id === "t-a2")
  assert.ok(legacy, "the task itself belongs to A and must stay visible")
  assert.equal(legacy.usuario, null, "the foreign assignee must not be projected")
  assert.equal(legacy.usuarioId, "u-beta", "the raw id is preserved — no silent repair")

  const own = data.find((row) => row.id === "t-a1")
  assert.equal(own?.usuario?.id, "u-alpha")

  const single = await tareas.getById("t-a2", WS_A)
  assert.equal(single?.usuario, null)
  assert.equal(single?.usuarioId, "u-beta")

  // A shared-but-genuine member stays visible on their own workspace's task.
  const fromB = await tareas.getById("t-b2", WS_B)
  assert.equal(fromB?.usuario, null, "u-crosstask is not a member of B")
  assert.equal(fromB?.usuarioId, "u-crosstask")
})

// ── 14. The happy path still works ───────────────────────────────────────────

test("legitimate same-workspace operations are unaffected", async () => {
  const read = await usuarios.getById("u-alpha", WS_A)
  assert.equal(read?.workspaceScope, "exclusive")
  assert.deepEqual(ids(read?.tareas ?? []), ["t-a1"])

  const updated = await usuarios.update(
    "u-alpha",
    { departamento: "Design" },
    WS_A,
  )
  assert.equal(updated?.departamento, "Design")
  assert.equal((await rawUsuario("u-alpha"))?.departamento, "Design")

  const task = await tareas.create({ titulo: "Legit", usuarioId: "u-alpha" }, WS_A)
  assert.equal(task.workspaceId, WS_A)
  assert.equal(task.usuarioId, "u-alpha")

  const reassigned = await tareas.update(task.id, { usuarioId: null }, WS_A)
  assert.equal(reassigned?.usuarioId, null, "clearing an assignee stays allowed")

  await tareas.remove(task.id, WS_A)
  assert.equal(await rawTareaAssignee(task.id), null)
})

test("create accepts an exclusive member and normalises the stored email", async () => {
  const created = await usuarios.create(
    { nombre: "Newcomer Person", email: "  NewComer@X.com " },
    WS_A,
  )
  assert.equal(created.email, "newcomer@x.com", "the stored email is normalised")
  assert.equal((await rawUsuario(created.id))?.email, "newcomer@x.com")

  const { data } = await usuarios.list({ workspaceId: WS_A, take: 100 })
  assert.equal(
    data.find((row) => row.id === created.id)?.workspaceScope,
    "exclusive",
  )

  const removed = await usuarios.remove(created.id, WS_A)
  assert.ok(removed, "an exclusive row with no foreign references is deletable")
  assert.equal(await rawUsuario(created.id), null)
})

test("a duplicate email still surfaces as a conflict, not as a scope failure", async () => {
  const countBefore = await rawUsuarioCount()

  await assert.rejects(
    () => usuarios.create({ nombre: "Deletable Twin", email: "D@X.com" }, WS_A),
    (error: Error) => "code" in error && error.code === "P2002",
    "the pre-existing unique-email conflict behaviour must survive the scope check",
  )

  assert.equal(await rawUsuarioCount(), countBefore)
})

test("an exclusive member with no task references can be deleted", async () => {
  assert.ok(await usuarios.getById("u-deletable", WS_A))
  const removed = await usuarios.remove("u-deletable", WS_A)
  assert.ok(removed)
  assert.equal(await rawUsuario("u-deletable"), null)
})
