/**
 * Mr Forte Lab — access session server wiring (DEV-PREVIEW-01B).
 *
 * Ties together the infrastructure gate (level 1), the access config, the
 * constant-time key check, the independent token and the namespace cookie
 * (level 2). This is the ONLY lab module that touches Next request APIs, so
 * the pure pieces stay unit-testable.
 *
 * It NEVER creates a `7f-session` or `wf_workspace` cookie, never touches
 * Prisma, and never grants access to `/api/*` or business data. The session it
 * mints is a non-persistent synthetic visitor scoped to `/lab` only.
 */

import "server-only"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { getLabGateDecision } from "./gate"
import { readLabGateEnv } from "./config"
import { readLabAccessConfig } from "./access-config"
import { verifyLabAccessKey } from "./access-key"
import { createLabAccessToken, verifyLabAccessToken, type LabAccessClaims } from "./access-token"
import {
  buildLabAccessClearCookie,
  buildLabAccessCookie,
  LAB_ACCESS_COOKIE_NAME,
} from "./access-cookie"
import { isTrustedLabOrigin } from "./access-origin"

/**
 * Whether cookies must be Secure. Deployed environments (VERCEL_ENV set) always
 * require https; the explicit local-dev opt-in from 01A is the only http case.
 */
function isSecureContext(): boolean {
  const vercelEnv = process.env.VERCEL_ENV
  const localDev =
    process.env.SEVENEF_LAB_LOCAL_DEV_ENABLED === "true" &&
    (vercelEnv === undefined || vercelEnv === "development")
  return !localDev
}

async function resolveRequestHost(): Promise<string | undefined> {
  const h = await headers()
  return h.get("host") ?? h.get("x-forwarded-host") ?? undefined
}

/**
 * The current deployment's project id. The infrastructure gate only passes
 * when SEVENEF_LAB_EXPECTED_PROJECT_ID === VERCEL_PROJECT_ID, so after a
 * successful gate this is defined and equals the expected id. The token is
 * both minted and verified against it, binding a session to this project.
 */
function currentProjectId(): string {
  return readLabGateEnv(process.env).actualProjectId?.trim() ?? ""
}

/** Structured internal outcome for the enter action. Never shown to the user. */
export type LabEnterResult =
  | { ok: true }
  | { ok: false; reason: "gate" | "origin" | "config" | "invalid-key" }

/**
 * Read and validate the current lab access session, if any. Returns the
 * synthetic claims or null. Fails closed if the infrastructure gate no longer
 * passes or the access config is invalid.
 */
export async function getLabAccessSession(): Promise<LabAccessClaims | null> {
  const gate = await getLabGateDecision()
  if (!gate.allowed) return null

  const configResult = readLabAccessConfig(process.env)
  if (!configResult.ok) return null

  const cookieStore = await cookies()
  const token = cookieStore.get(LAB_ACCESS_COOKIE_NAME)?.value
  if (!token) return null

  const result = await verifyLabAccessToken(token, {
    secret: configResult.config.tokenSecret,
    expectedProjectId: currentProjectId(),
  })
  return result.ok ? result.claims : null
}

/**
 * Establish a lab access session from a submitted key. Order:
 *   gate → origin → config → key → token → cookie.
 * Returns a structured result; the caller maps every failure to one generic
 * message and never sets a cookie on failure.
 */
export async function createLabAccessSession(submittedKey: unknown): Promise<LabEnterResult> {
  const gate = await getLabGateDecision()
  if (!gate.allowed) return { ok: false, reason: "gate" }

  const requestHost = await resolveRequestHost()
  const secure = isSecureContext()
  if (!requestHost) return { ok: false, reason: "origin" }
  const h = await headers()
  const trusted = isTrustedLabOrigin({
    origin: h.get("origin"),
    requestHost,
    requireHttps: secure,
  })
  if (!trusted) return { ok: false, reason: "origin" }

  const configResult = readLabAccessConfig(process.env)
  if (!configResult.ok) return { ok: false, reason: "config" }

  if (!verifyLabAccessKey(submittedKey, configResult.config.keyHashHex)) {
    return { ok: false, reason: "invalid-key" }
  }

  const token = await createLabAccessToken({
    secret: configResult.config.tokenSecret,
    projectId: currentProjectId(),
    ttlMinutes: configResult.config.ttlMinutes,
  })

  const cookieStore = await cookies()
  const cookie = buildLabAccessCookie(token, {
    ttlMinutes: configResult.config.ttlMinutes,
    secure,
  })
  cookieStore.set(cookie)
  return { ok: true }
}

/**
 * Guard for the protected `/lab` zone: redirect to `/lab/enter` unless a valid
 * lab access session exists. Never reveals why (no token details), never mints
 * a normal session, never touches Prisma.
 */
export async function requireLabAccessSession(): Promise<LabAccessClaims> {
  const session = await getLabAccessSession()
  if (!session) redirect("/lab/enter")
  return session
}

/** Destroy the lab access session cookie. */
export async function clearLabAccessSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(buildLabAccessClearCookie({ secure: isSecureContext() }))
}
