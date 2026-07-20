/**
 * Mr Forte Lab — non-persistent access token (DEV-PREVIEW-01B).
 *
 * A signed token that represents ONLY a temporary, synthetic lab visitor. It
 * is deliberately independent from the normal `7f-session`:
 *   - different signing secret (SEVENEF_LAB_ACCESS_TOKEN_SECRET, never AUTH_SECRET);
 *   - fixed issuer / audience / subject / scope that the normal stack ignores;
 *   - no email, role, platformRole, userId or workspaceId.
 *
 * The identity is NOT persisted (no User / WorkspaceMember row) and grants no
 * access to `/api/*` or business data. Verification requires EXACTLY the
 * issuer, audience, subject, scope, expiry, signature and current project id;
 * a merely valid signature is never enough.
 */

import { randomUUID } from "crypto"
import { SignJWT, jwtVerify, errors as joseErrors } from "jose"

export const LAB_TOKEN = {
  issuer: "mr-forte-lab",
  audience: "sevenef-lab-preview",
  subject: "lab-preview-visitor",
  scope: "lab:preview",
  alg: "HS256",
} as const

export type LabAccessClaims = {
  sub: typeof LAB_TOKEN.subject
  scope: typeof LAB_TOKEN.scope
  iss: typeof LAB_TOKEN.issuer
  aud: typeof LAB_TOKEN.audience
  projectId: string
  iat: number
  exp: number
  jti: string
}

export type LabAccessVerifyError =
  | "missing"
  | "malformed"
  | "invalid-signature"
  | "expired"
  | "issuer"
  | "audience"
  | "subject"
  | "scope"
  | "project-mismatch"
  | "missing-claim"

export type LabAccessVerifyResult =
  | { ok: true; claims: LabAccessClaims }
  | { ok: false; reason: LabAccessVerifyError }

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export type CreateLabAccessTokenInput = {
  secret: string
  projectId: string
  ttlMinutes: number
  /** Injection point for deterministic tests; defaults to now. */
  issuedAt?: Date
}

export async function createLabAccessToken(input: CreateLabAccessTokenInput): Promise<string> {
  const iat = Math.floor((input.issuedAt?.getTime() ?? Date.now()) / 1000)
  const exp = iat + input.ttlMinutes * 60
  return new SignJWT({ scope: LAB_TOKEN.scope, projectId: input.projectId })
    .setProtectedHeader({ alg: LAB_TOKEN.alg })
    .setSubject(LAB_TOKEN.subject)
    .setIssuer(LAB_TOKEN.issuer)
    .setAudience(LAB_TOKEN.audience)
    .setJti(randomUUID())
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secretBytes(input.secret))
}

export type VerifyLabAccessTokenInput = {
  secret: string
  expectedProjectId: string
  /** Injection point for deterministic expiry tests; defaults to now. */
  now?: Date
}

export async function verifyLabAccessToken(
  token: string | undefined | null,
  input: VerifyLabAccessTokenInput,
): Promise<LabAccessVerifyResult> {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "missing" }

  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(token, secretBytes(input.secret), {
      issuer: LAB_TOKEN.issuer,
      audience: LAB_TOKEN.audience,
      subject: LAB_TOKEN.subject,
      currentDate: input.now,
    })
    payload = verified.payload as Record<string, unknown>
  } catch (err) {
    return { ok: false, reason: mapJoseError(err) }
  }

  // Custom claims jose does not natively assert.
  if (payload.scope !== LAB_TOKEN.scope) return { ok: false, reason: "scope" }
  if (typeof payload.projectId !== "string" || payload.projectId.length === 0) {
    return { ok: false, reason: "missing-claim" }
  }
  if (payload.projectId !== input.expectedProjectId) return { ok: false, reason: "project-mismatch" }
  if (typeof payload.jti !== "string" || payload.jti.length === 0) {
    return { ok: false, reason: "missing-claim" }
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    return { ok: false, reason: "missing-claim" }
  }

  return {
    ok: true,
    claims: {
      sub: LAB_TOKEN.subject,
      scope: LAB_TOKEN.scope,
      iss: LAB_TOKEN.issuer,
      aud: LAB_TOKEN.audience,
      projectId: payload.projectId,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
    },
  }
}

function mapJoseError(err: unknown): LabAccessVerifyError {
  if (err instanceof joseErrors.JWTExpired) return "expired"
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return "invalid-signature"
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    switch (err.claim) {
      case "iss":
        return "issuer"
      case "aud":
        return "audience"
      case "sub":
        return "subject"
      default:
        return "malformed"
    }
  }
  // JWSInvalid, JWTInvalid, JWSSignatureVerificationFailed variants, etc.
  return "malformed"
}
