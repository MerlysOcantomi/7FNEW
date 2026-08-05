import assert from "node:assert/strict"
import test from "node:test"
import { ZodError, z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { errorResponse, handleError, successResponse, getPaginationParams } from "@core/api"

/**
 * CORE-02 — information-containment tests for the central API error handler.
 *
 * Pure and deterministic: no database, no network, no writes. `handleError`
 * only ever builds a `NextResponse`, so every assertion here reads the
 * SERIALISED body — the exact bytes a client would receive — rather than an
 * intermediate object. Several tests scan that serialised body for sentinel
 * values, which is the only way to catch a leak that arrives through a nested
 * property, a `cause` chain or a stack frame.
 *
 * All sentinels below are fictitious. No real secret, host or token is used.
 *
 * WHY THE ERROR CLASSES ARE LOADED DYNAMICALLY
 * --------------------------------------------
 * The allow-list in `handleError` is keyed on `Error.name`, so these tests
 * deliberately exercise the REAL `WorkspaceError`, `RbacError` and
 * `PlatformError` classes rather than local look-alikes — otherwise renaming
 * one of them would silently remove it from the allow-list without failing a
 * test. All three transitively import `@core/db`, which throws at module scope
 * when no database URL is set (the pre-existing F-DB-02 recorded in
 * `docs/evolution/CORE-00-AUDIT.md`, owned by CORE-03 and deliberately not
 * touched here). Setting a throwaway `file:` URL before a dynamic import is
 * the same workaround CORE-01 used. No connection is ever opened and no query
 * is ever run: this file performs no database work at all.
 */

type WorkspaceErrorCtor = (typeof import("@core/workspace-context"))["WorkspaceError"]
type RbacErrorCtor = (typeof import("@core/auth/workspace-auth"))["RbacError"]
type PlatformErrorCtor = (typeof import("@core/auth/platform-auth"))["PlatformError"]

let WorkspaceError: WorkspaceErrorCtor
let RbacError: RbacErrorCtor
let PlatformError: PlatformErrorCtor

test.before(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "file:core-02-unused.db"
  WorkspaceError = (await import("@core/workspace-context")).WorkspaceError
  RbacError = (await import("@core/auth/workspace-auth")).RbacError
  PlatformError = (await import("@core/auth/platform-auth")).PlatformError
})

const SENTINELS = {
  sql: `SELECT * FROM "Conversation" WHERE "workspaceId" = 'ws_other_tenant'`,
  table: "ConversationAction",
  dbUrl: "libsql://sentinel-not-a-real-db.turso.io",
  token: "sk-SENTINEL-FAKE-TOKEN-000000000000",
  path: "/var/task/.next/server/app/api/inbox/route.js",
  foreignId: "usuario_of_another_tenant_42",
  provider: "upstream-provider-internal-detail",
}

async function readBody(response: Response): Promise<string> {
  return response.text()
}

interface ErrorBody {
  success: boolean
  error?: { code?: string; message?: string; reference?: string }
}

async function readJson(response: Response): Promise<ErrorBody> {
  return response.json()
}

/**
 * A `Response` body can only be consumed once, so tests that need both the raw
 * bytes (for sentinel scanning) and the parsed shape read it a single time and
 * derive both from that.
 */
async function readBoth(response: Response): Promise<{ text: string; json: ErrorBody }> {
  const text = await response.text()
  return { text, json: JSON.parse(text) as ErrorBody }
}

/** Assert that not one sentinel value survives into the wire format. */
function assertNoSentinels(serialized: string, label: string) {
  for (const [key, value] of Object.entries(SENTINELS)) {
    assert.ok(
      !serialized.includes(value),
      `${label}: sentinel "${key}" leaked into the response body`,
    )
  }
}

// ── 1-3. Unknown errors become a generic, opaque response ────────────────────

test("an unknown Error yields a generic public response", async () => {
  const response = handleError(new Error("boom: something internal broke"), "Conversation")

  assert.equal(response.status, 500)
  const body = await readJson(response)
  assert.equal(body.success, false)
  assert.equal(body.error?.code, "INTERNAL_ERROR")
  assert.equal(body.error?.message, "Internal server error")
})

test("the internal message never reaches the serialised body", async () => {
  const response = handleError(new Error("boom: something internal broke"), "Conversation")
  const serialized = await readBody(response)

  assert.ok(!serialized.includes("boom"), "the raw message must not be echoed")
  assert.ok(!serialized.includes("something internal broke"))
})

test("stack, cause and custom properties never reach the body", async () => {
  const cause = new Error(`cause leak ${SENTINELS.dbUrl}`)
  const error = new Error(`outer failure at ${SENTINELS.path}`, { cause })
  Object.assign(error, {
    query: SENTINELS.sql,
    table: SENTINELS.table,
    authToken: SENTINELS.token,
    tenantId: SENTINELS.foreignId,
  })

  const response = handleError(error, "Inbox")
  const serialized = await readBody(response)

  assertNoSentinels(serialized, "unknown Error with attached internals")
  assert.ok(!serialized.includes("outer failure"))
  assert.ok(!serialized.includes("cause leak"))
  assert.ok(!serialized.includes("stack"), "no stack key may appear")
  assert.ok(!serialized.includes(".ts:"), "no source location may appear")
  assert.ok(!serialized.includes("at Object."), "no stack frame may appear")
})

test("non-Error throws are contained too", async () => {
  const cases: unknown[] = [
    `raw string throw containing ${SENTINELS.token}`,
    { code: "LEAK", message: SENTINELS.sql, status: 400 },
    { status: 401, code: "invalid_api_key", message: `Incorrect API key: ${SENTINELS.token}` },
    null,
    undefined,
    42,
  ]

  for (const thrown of cases) {
    const response = handleError(thrown, "Entity")
    const serialized = await readBody(response)
    assert.equal(response.status, 500, `expected a generic 500 for ${String(thrown)}`)
    assertNoSentinels(serialized, `non-Error throw ${String(thrown)}`)
  }
})

test("an object that merely looks like a public error is not trusted", async () => {
  /**
   * The regression this locks down: the previous implementation matched on the
   * PRESENCE of `code` + `status`, which is the shape most third-party SDK
   * errors use. An upstream 401 was therefore echoed verbatim — status and
   * message included — leaking provider credentials.
   */
  class UpstreamApiError extends Error {
    status = 401
    code = "invalid_api_key"
    constructor() {
      super(`Incorrect API key provided: ${SENTINELS.token}`)
      this.name = "UpstreamApiError"
    }
  }

  const response = handleError(new UpstreamApiError(), "ComposerAssist")
  const serialized = await readBody(response)

  assert.equal(response.status, 500, "an upstream status must not be forwarded")
  assertNoSentinels(serialized, "third-party SDK error")
  assert.ok(!serialized.includes("invalid_api_key"), "the upstream code must not be forwarded")
})

// ── 4. Database-shaped detail is contained ───────────────────────────────────

test("SQL, connection URLs and tokens never survive in any error path", async () => {
  const errors: Error[] = [
    new Error(`SQLITE_ERROR: no such column: ${SENTINELS.table}.workspaceId`),
    new Error(`Invalid \`prisma.conversation.findMany()\` invocation: ${SENTINELS.sql}`),
    new Error(`Can't reach database server at ${SENTINELS.dbUrl}`),
    new Error(`Unauthorized: authToken=${SENTINELS.token}`),
    new Error(`ENOENT: no such file or directory, open '${SENTINELS.path}'`),
    new Error(`Provider rejected the request: ${SENTINELS.provider}`),
  ]

  for (const error of errors) {
    const response = handleError(error, "Conversation")
    assert.equal(response.status, 500)
    assertNoSentinels(await readBody(response), error.message.slice(0, 24))
  }
})

test("unmapped Prisma codes fall through to the generic response", async () => {
  // P2003 (foreign key constraint) embeds the constraint and field names.
  const prismaError = new Prisma.PrismaClientKnownRequestError(
    `Foreign key constraint failed on the field: \`${SENTINELS.table}_workspaceId_fkey\``,
    { code: "P2003", clientVersion: "7.4.1" },
  )

  const response = handleError(prismaError, "Conversation")
  assert.equal(response.status, 500)
  const serialized = await readBody(response)
  assertNoSentinels(serialized, "Prisma P2003")
  assert.ok(!serialized.includes("Foreign key constraint"))
  assert.ok(!serialized.includes("P2003"))
})

// ── 5-6. Public, controlled errors keep their contract ───────────────────────

test("WorkspaceError keeps its code, message and status", async () => {
  const cases: Array<[string, string, number]> = [
    ["UNAUTHORIZED", "No autenticado", 401],
    ["FORBIDDEN", "Sin acceso a este workspace", 403],
    ["NO_WORKSPACE", "No workspace assigned to your account", 404],
    ["VALIDATION_ERROR", "workspaceId es requerido", 400],
    ["INVALID_ASSIGNEE", "El usuario indicado no pertenece a este workspace", 400],
  ]

  for (const [code, message, status] of cases) {
    const response = handleError(new WorkspaceError(code, message, status), "Usuario")
    assert.equal(response.status, status, `${code} must keep status ${status}`)
    const body = await readJson(response)
    assert.equal(body.error?.code, code)
    assert.equal(body.error?.message, message)
    assert.equal(body.error?.reference, undefined, "public errors carry no reference")
  }
})

test("RbacError and PlatformError keep their status instead of degrading to 500", async () => {
  const rbac = handleError(
    new RbacError("INSUFFICIENT_ROLE", "Requiere rol ADMIN o superior en este workspace"),
    "Workspace",
  )
  assert.equal(rbac.status, 403)
  assert.equal((await readJson(rbac)).error?.code, "INSUFFICIENT_ROLE")

  /**
   * PlatformError was the sole consumer of the removed structural branch.
   * Without an explicit entry in the allow-list every `/api/system/**` 401 and
   * 403 would silently become a 500, so this is the guard against that.
   */
  const unauthorized = handleError(new PlatformError("UNAUTHORIZED", "No autenticado"), "Platform")
  assert.equal(unauthorized.status, 401)
  assert.equal((await readJson(unauthorized)).error?.code, "UNAUTHORIZED")

  const forbidden = handleError(
    new PlatformError("NOT_PLATFORM_ADMIN", "Esta área requiere ser PlatformAdmin"),
    "Platform",
  )
  assert.equal(forbidden.status, 403)
  assert.equal((await readJson(forbidden)).error?.code, "NOT_PLATFORM_ADMIN")
})

test("an authentic public error with an invalid status falls back to the generic 500", async () => {
  /**
   * An impossible status means the error's contract is broken, and a broken
   * contract is not evidence that the message is publishable. Rather than
   * inventing a status for it, treat it exactly like an unknown failure: a
   * generic 500 with nothing from the original error in the body.
   */
  const cases: Array<[string, number]> = [
    ["2xx", 200],
    ["non-integer", 4.5],
    ["out of range", 999],
    ["below 400", 302],
    ["not a number", Number.NaN],
  ]

  for (const [label, status] of cases) {
    const error = new WorkspaceError("FORBIDDEN", `Sin acceso ${SENTINELS.token}`, status)
    const response = handleError(error, "Usuario")
    assert.equal(response.status, 500, `${label}: must fall back to a generic 500`)

    const { text, json } = await readBoth(response)
    assertNoSentinels(text, `invalid-status public error (${label})`)
    assert.ok(!text.includes("Sin acceso"), `${label}: the message must not be published`)
    assert.equal(json.error?.code, "INTERNAL_ERROR")
    assert.equal(json.error?.message, "Internal server error")
    assert.ok(json.error?.reference, "the generic path always carries a reference")
  }
})

// ── Identity, not shape: spoofed public errors must not be trusted ───────────

const PUBLIC_ERROR_NAMES = ["WorkspaceError", "RbacError", "PlatformError"] as const

for (const spoofedName of PUBLIC_ERROR_NAMES) {
  test(`a plain Error renamed to "${spoofedName}" is not treated as public`, async () => {
    /**
     * `Error.name` is a writable data property, so any error — including one
     * built from attacker-influenced upstream data — can claim to be one of
     * ours. Identity has to be proven by construction, never asserted by a
     * string the object carries.
     */
    const spoofed = new Error(SENTINELS.token)
    spoofed.name = spoofedName
    Object.assign(spoofed, { code: "UNAUTHORIZED", status: 401 })

    const response = handleError(spoofed, "Usuario")
    const { text, json } = await readBoth(response)

    assert.equal(response.status, 500, "the forged 401 must not be honoured")
    assertNoSentinels(text, `spoofed ${spoofedName}`)
    assert.ok(!text.includes("UNAUTHORIZED"), "the forged code must not be echoed")
    assert.equal(json.error?.code, "INTERNAL_ERROR")
    assert.equal(json.error?.message, "Internal server error")
  })
}

test("an external Error subclass imitating name, code and status is not trusted", async () => {
  class ForgedWorkspaceError extends Error {
    code = "FORBIDDEN"
    status = 403
    constructor() {
      super(`forged ${SENTINELS.sql}`)
      this.name = "WorkspaceError"
    }
  }

  const response = handleError(new ForgedWorkspaceError(), "Conversation")
  assert.equal(response.status, 500)
  assertNoSentinels(await readBody(response), "external Error subclass")
})

test("a matching constructor.name without the real identity is not trusted", async () => {
  /**
   * Declared locally so its `constructor.name` is literally "WorkspaceError",
   * defeating any check based on the constructor's own name.
   */
  class WorkspaceError extends Error {
    code = "NO_WORKSPACE"
    status = 404
    constructor() {
      super(`constructor-name forgery ${SENTINELS.dbUrl}`)
    }
  }
  const forged = new WorkspaceError()
  assert.equal(forged.constructor.name, "WorkspaceError")

  const response = handleError(forged, "Workspace")
  assert.equal(response.status, 500, "constructor.name proves nothing")
  assertNoSentinels(await readBody(response), "constructor.name forgery")
})

test("prototype grafting alone does not grant public identity", async () => {
  /**
   * The strongest structural attack available to in-process code that does not
   * go through our constructors: take a foreign error and re-point it at the
   * real prototype. The brand is an own property written by the base
   * constructor, so grafting the prototype does not bring it along.
   */
  const authentic = new WorkspaceError("FORBIDDEN", "Sin acceso", 403)
  const grafted = new Error(`grafted ${SENTINELS.token}`)
  Object.setPrototypeOf(grafted, Object.getPrototypeOf(authentic))
  Object.assign(grafted, { code: "FORBIDDEN", status: 403 })

  const response = handleError(grafted, "Usuario")
  assert.equal(response.status, 500)
  assertNoSentinels(await readBody(response), "prototype-grafted error")
})

// ── 7. Validation errors stay useful ─────────────────────────────────────────

test("Zod validation errors keep their authored message and 400 status", async () => {
  const schema = z.object({ email: z.string().email("Email inválido") })
  let zodError: ZodError | null = null
  try {
    schema.parse({ email: "not-an-email" })
  } catch (error) {
    zodError = error as ZodError
  }
  assert.ok(zodError)

  const response = handleError(zodError, "Usuario")
  assert.equal(response.status, 400)
  const body = await readJson(response)
  assert.equal(body.error?.code, "VALIDATION_ERROR")
  assert.equal(body.error?.message, "Email inválido")
})

test("an empty ZodError degrades to a safe message rather than throwing", async () => {
  const response = handleError(new ZodError([]), "Usuario")
  assert.equal(response.status, 400)
  const body = await readJson(response)
  assert.equal(body.error?.code, "VALIDATION_ERROR")
  assert.equal(body.error?.message, "Invalid request payload")
})

// ── 8-9. Known statuses are preserved; the CORE-01 404 shape is unchanged ────

test("known Prisma statuses are not degraded to 500", async () => {
  const notFound = new Prisma.PrismaClientKnownRequestError(
    `An operation failed because it depends on one or more records that were required but not found. ${SENTINELS.sql}`,
    { code: "P2025", clientVersion: "7.4.1" },
  )
  const notFoundResponse = handleError(notFound, "Usuario")
  assert.equal(notFoundResponse.status, 404)
  const notFoundBody = await readJson(notFoundResponse)
  assert.equal(notFoundBody.error?.code, "NOT_FOUND")
  assert.equal(notFoundBody.error?.message, "Usuario not found")
  assertNoSentinels(await readBody(handleError(notFound, "Usuario")), "P2025")

  const conflict = new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (\`email\`) for table \`${SENTINELS.table}\``,
    { code: "P2002", clientVersion: "7.4.1" },
  )
  const conflictResponse = handleError(conflict, "Usuario")
  assert.equal(conflictResponse.status, 409)
  const conflictBody = await readJson(conflictResponse)
  assert.equal(conflictBody.error?.code, "CONFLICT")
  assert.equal(conflictBody.error?.message, "Usuario already exists with those values")
  assertNoSentinels(await readBody(handleError(conflict, "Usuario")), "P2002")
})

test("the CORE-01 uniform 404 is byte-for-byte unchanged", async () => {
  /**
   * CORE-01 answers a foreign id, an orphan row and a genuinely missing id
   * with exactly the same response, so a caller cannot probe another tenant.
   * That response is produced by `errorResponse`, which CORE-02 leaves
   * untouched — this asserts the shape has not drifted.
   */
  const response = errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
  assert.equal(response.status, 404)
  assert.equal(
    await readBody(response),
    JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Usuario no encontrado" } }),
  )
})

// ── The correlation reference ────────────────────────────────────────────────

test("the generic 500 carries an opaque, non-derived reference", async () => {
  const error = new Error(`boom ${SENTINELS.token}`)
  const first = (await readJson(handleError(error, "Entity"))).error?.reference
  const second = (await readJson(handleError(error, "Entity"))).error?.reference

  assert.ok(first && second)
  assert.match(first, /^[0-9a-z]{6,32}$/, "the reference is a short opaque id")
  assert.notEqual(first, second, "the reference is random, not derived from the error")
  assert.ok(!SENTINELS.token.includes(first), "the reference cannot echo error content")
})

// ── Untouched helpers keep their contract ────────────────────────────────────

test("successResponse and errorResponse shapes are unchanged", async () => {
  const ok = successResponse({ id: "1" }, { total: 1 })
  assert.equal(ok.status, 200)
  assert.equal(
    await readBody(ok),
    JSON.stringify({ success: true, data: { id: "1" }, meta: { total: 1 } }),
  )

  const withoutMeta = successResponse({ id: "1" })
  assert.equal(await readBody(withoutMeta), JSON.stringify({ success: true, data: { id: "1" } }))

  const failed = errorResponse("VALIDATION_ERROR", "El nombre es requerido")
  assert.equal(failed.status, 400, "errorResponse still defaults to 400")
})

test("getPaginationParams is unchanged", () => {
  assert.deepEqual(getPaginationParams(new URLSearchParams("")), {
    page: 1,
    pageSize: 20,
    skip: 0,
  })
  assert.deepEqual(getPaginationParams(new URLSearchParams("page=3&pageSize=10")), {
    page: 3,
    pageSize: 10,
    skip: 20,
  })
  assert.deepEqual(getPaginationParams(new URLSearchParams("page=-5&pageSize=9999")), {
    page: 1,
    pageSize: 100,
    skip: 0,
  })
})
