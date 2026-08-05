import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { isPublicApiError, isValidPublicErrorStatus } from "@core/errors"

export function successResponse(data: unknown, meta?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  })
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  )
}

interface PublicAppError {
  code: string
  message: string
  status: number
}

/**
 * Recognise one of our own publishable errors. Returns `null` for everything
 * else — including any object that merely *looks* like one.
 *
 * Identity comes from `isPublicApiError`, which tests membership in a
 * module-private `WeakSet` that only the `PublicApiError` constructor writes
 * to (see `core/errors.ts`). Nothing about the object's `name`, its
 * `constructor.name`, or the presence of `code`/`status`/`message` is
 * consulted, because every one of those is forgeable:
 *
 *     const spoofed = new Error("sk-REAL-SECRET")
 *     spoofed.name = "WorkspaceError"
 *     Object.assign(spoofed, { code: "UNAUTHORIZED", status: 401 })
 *
 * An earlier revision of this function did trust exactly that description, so
 * such an error — or any third-party SDK error carrying `code` + `status`,
 * which is the common shape — had its message published under its own forged
 * status.
 *
 * The contract is then validated rather than repaired. A public error whose
 * `code`, `message` or `status` is malformed is NOT coerced into something
 * usable: a broken contract is not evidence that the message is safe to
 * publish, so it falls through to the same generic 500 as an unknown failure.
 * Validating the status here also keeps an out-of-range value away from
 * `NextResponse.json`, where it would throw a `RangeError` and convert a
 * handled error into an unhandled one.
 */
function asPublicAppError(error: unknown): PublicAppError | null {
  if (!isPublicApiError(error)) return null
  if (typeof error.code !== "string" || error.code.length === 0) return null
  if (typeof error.message !== "string" || error.message.length === 0) return null
  if (!isValidPublicErrorStatus(error.status)) return null

  return { code: error.code, message: error.message, status: error.status }
}

/**
 * Short, opaque id correlating the generic client response with the full
 * detail written to the server log. Carries no information about the error
 * itself — it is random, so it cannot be used to infer anything.
 *
 * Uses Web Crypto (available in both the Node and Edge runtimes) rather than
 * `node:crypto`, so this module stays importable from either.
 */
function newErrorReference(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replace(/-/g, "").slice(0, 12)
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** The single public message for anything we do not explicitly recognise. */
const GENERIC_ERROR_MESSAGE = "Internal server error"

/**
 * Central error translator for API routes.
 *
 * Contract: a response body NEVER carries anything the server did not
 * deliberately choose to publish. Concretely, an unrecognised error must not
 * leak its `message`, `stack`, `cause`, custom properties, or its stringified
 * form — those routinely contain SQL text, table and column names, Prisma and
 * libSQL internals, connection URLs, provider credentials and server file
 * paths.
 *
 * Four categories are recognised, in order:
 *
 *   1. Genuine `PublicApiError` instances — proven by construction, not by
 *      name or shape (see `core/errors.ts`) — returned verbatim, preserving
 *      their code and status.
 *   2. `ZodError` — validation messages are authored in this repository and
 *      are the point of the response, so the first issue message is public.
 *   3. Prisma `P2025` / `P2002` — mapped to a 404 / 409 built from the
 *      caller-supplied `entity` label. The Prisma error itself is never read
 *      for text, so constraint, column and table names cannot escape.
 *   4. Everything else — a fixed generic 500 plus a random reference. The
 *      full error (message, stack, cause and all) goes to the server log
 *      only.
 *
 * A recognised 401/403/404/409 keeps its status; only genuinely unknown
 * failures — and public errors whose own contract is malformed — become a 500.
 */
export function handleError(error: unknown, entity: string) {
  const publicError = asPublicAppError(error)
  if (publicError) {
    return errorResponse(publicError.code, publicError.message, publicError.status)
  }

  if (error instanceof ZodError) {
    // `errors[0]` can be absent for a synthetically constructed ZodError.
    const message = error.errors[0]?.message
    return errorResponse(
      "VALIDATION_ERROR",
      typeof message === "string" && message.length > 0 ? message : "Invalid request payload",
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return errorResponse("NOT_FOUND", `${entity} not found`, 404)
    }
    if (error.code === "P2002") {
      return errorResponse("CONFLICT", `${entity} already exists with those values`, 409)
    }
    // Every other Prisma code falls through to the generic branch on purpose:
    // their messages embed the failing query, table and column names.
  }

  const reference = newErrorReference()
  console.error(`[7F] Unhandled error in ${entity} (ref=${reference}):`, error)

  /**
   * Mirrors the `errorResponse` body shape, with the correlation reference
   * added. Built inline rather than by widening `errorResponse`, so the
   * ~150 existing call sites of that helper keep an unchanged signature.
   */
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE, reference },
    },
    { status: 500 },
  )
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}
