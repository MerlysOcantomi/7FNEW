/**
 * Mr Forte Lab — application session orchestrator (DEV-PREVIEW-01C).
 *
 * Level 3: after the access key is verified, confirm the deployment is wired to
 * the expected, safe, provisioned demo database and only THEN issue a real
 * Sevenef session bound to the synthetic demo identity + workspace.
 *
 * Cookies are set ONLY when every step passes, so a failure never leaves a
 * partial session. The normal session is minted with the repo's official
 * `createSession` (identical claims contract — no `isLab`/`demoMode` claim);
 * isolation comes from the dedicated project, secret and database, not a claim.
 * The app session never outlives the lab access window (same TTL).
 */

import "server-only"
import { cookies } from "next/headers"
import { createSession, buildSessionCookie, buildLogoutCookie } from "@core/auth/session"
import { db } from "@core/db"
import { WORKSPACE_COOKIE } from "@core/workspace-context"
import {
  validateLabAccessRequest,
  setLabAccessCookie,
  clearLabAccessSession,
} from "./access-session"
import { assessLabDemoEnvironment } from "./demo-environment"
import { isLabSecureContext } from "./secure-context"

/**
 * Public-facing outcome kind for the enter action. Both failure kinds map to a
 * generic message; `key` and `not-ready` differ only so the UI can show the
 * right one (per the approved error spec).
 */
export type LabSessionOutcome =
  | { ok: true }
  | { ok: false; kind: "invalid-key" | "not-ready" }

function buildLabWorkspaceCookie(workspaceId: string, maxAgeSeconds: number) {
  return {
    name: WORKSPACE_COOKIE,
    value: workspaceId,
    httpOnly: true,
    secure: isLabSecureContext(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  }
}

/**
 * Full enter flow: gate → origin → access config → key → data config →
 * fingerprint → provisioned identity/workspace → issue the three cookies.
 */
export async function createLabApplicationSession(
  submittedKey: unknown,
): Promise<LabSessionOutcome> {
  // Levels 1-2 (no cookies yet).
  const access = await validateLabAccessRequest(submittedKey)
  if (!access.ok) {
    return { ok: false, kind: access.reason === "invalid-key" ? "invalid-key" : "not-ready" }
  }

  // Level 3: data config + fingerprint + provisioned demo environment (read-only).
  const env = await assessLabDemoEnvironment(db)
  if (!env.allowed) {
    return { ok: false, kind: "not-ready" }
  }

  // All levels passed — mint the app session bounded by the lab access TTL, and
  // set all three cookies together.
  const ttlSeconds = access.ttlMinutes * 60
  const token = await createSession(
    {
      userId: env.userId,
      email: env.email,
      role: env.role, // "editor" — User.role / JWT claim, no lab-specific claim
      nombre: "Finesse Preview",
      avatar: null,
      platformRole: null,
    },
    ttlSeconds,
  )

  const cookieStore = await cookies()
  await setLabAccessCookie()
  const sessionCookie = buildSessionCookie(token, ttlSeconds)
  cookieStore.set(sessionCookie.name, sessionCookie.value, {
    httpOnly: sessionCookie.httpOnly,
    secure: sessionCookie.secure,
    sameSite: sessionCookie.sameSite,
    path: sessionCookie.path,
    maxAge: sessionCookie.maxAge,
  })
  cookieStore.set(buildLabWorkspaceCookie(env.workspaceId, ttlSeconds))

  return { ok: true }
}

/**
 * Destroy ALL three lab cookies (access + normal session + workspace). Used by
 * `POST /lab/exit`. After this, `/lab` requires the key again and normal routes
 * require login.
 */
export async function clearLabApplicationSession(): Promise<void> {
  await clearLabAccessSession()
  const cookieStore = await cookies()
  const logout = buildLogoutCookie()
  cookieStore.set(logout.name, logout.value, {
    httpOnly: logout.httpOnly,
    path: logout.path,
    maxAge: logout.maxAge,
  })
  cookieStore.set(WORKSPACE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
}
