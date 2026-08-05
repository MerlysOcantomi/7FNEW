import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { Prisma } from "@/generated/prisma/client"

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

/**
 * Error classes DEFINED IN THIS REPOSITORY whose `code`, `message` and
 * `status` are authored by us and are therefore safe to return verbatim.
 *
 * This allow-list replaces the structural ("duck typed") check this function
 * used to perform. Matching on the mere PRESENCE of `code` + `status` trusted
 * any object that happened to have those two properties — which is the exact
 * shape most third-party SDK errors use (HTTP clients, the OpenAI SDK, Resend,
 * nodemailer, …). Such an error was previously echoed to the client with its
 * own message AND its own HTTP status, so an upstream "Incorrect API key
 * provided: sk-…" surfaced verbatim in a 401 to the caller. Identity, not
 * shape, is the only safe discriminator here.
 *
 * Adding a name to this set is a deliberate decision: it declares that every
 * message that class can carry is safe for an unauthenticated reader to see.
 *
 *   - `WorkspaceError` — core/workspace-context.ts (401/403/404/400 tenancy)
 *   - `RbacError`      — core/auth/workspace-auth.ts (403 role checks)
 *   - `PlatformError`  — core/auth/platform-auth.ts (401/403 control plane)
 *
 * `PlatformError` is the reason the previous branch could not simply be
 * deleted: it was the ONLY consumer of the structural check, so dropping it
 * would have silently degraded every `/api/system/**` 401/403 into a 500.
 */
const PUBLIC_ERROR_NAMES = new Set(["WorkspaceError", "RbacError", "PlatformError"])

interface PublicAppError {
  code: string
  message: string
  status: number
}

/**
 * Clamp a status to a real HTTP error code.
 *
 * Defensive on two fronts: a non-integer or out-of-range value would make
 * `NextResponse.json` throw a `RangeError` (turning a handled error into an
 * unhandled one), and a stray 2xx would report a failure as a success.
 */
function normalizeErrorStatus(status: unknown, fallback: number): number {
  if (typeof status !== "number" || !Number.isInteger(status)) return fallback
  if (status < 400 || status > 599) return fallback
  return status
}

/**
 * Recognise one of our own public errors. Returns `null` for everything else,
 * including any object that merely looks like one.
 */
function asPublicAppError(error: unknown): PublicAppError | null {
  if (!(error instanceof Error)) return null
  if (!PUBLIC_ERROR_NAMES.has(error.name)) return null

  const candidate = error as Error & { code?: unknown; status?: unknown }
  if (typeof candidate.code !== "string" || candidate.code.length === 0) return null
  if (typeof error.message !== "string" || error.message.length === 0) return null

  return {
    code: candidate.code,
    message: error.message,
    status: normalizeErrorStatus(candidate.status, 403),
  }
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
 *   1. Our own public errors (`PUBLIC_ERROR_NAMES`) — returned verbatim,
 *      preserving their code and status.
 *   2. `ZodError` — validation messages are authored in this repository and
 *      are the point of the response, so the first issue message is public.
 *   3. Prisma `P2025` / `P2002` — mapped to a 404 / 409 built from the
 *      caller-supplied `entity` label. The Prisma error itself is never read
 *      for text, so constraint, column and table names cannot escape.
 *   4. Everything else — a fixed generic 500 plus a random reference. The
 *      full error (message, stack, cause and all) goes to the server log
 *      only.
 *
 * Statuses are never downgraded: a recognised 401/403/404/409 keeps its
 * status, and only genuinely unknown failures become a 500.
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
