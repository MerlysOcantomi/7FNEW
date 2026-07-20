/**
 * Mr Forte Lab gate — server wiring (DEV-PREVIEW-01A).
 *
 * Reads the private env config plus the request host from trusted Next.js
 * APIs and resolves the pure policy. Callers must never surface the internal
 * deny reason, project ids, configured hosts or env values to the visitor:
 * the only public response for ANY denial is a plain 404 (`notFound()`).
 *
 * Any future route handler under `/api/lab/*` is NOT covered by the
 * middleware exemption for `/lab` pages and MUST call `getLabGateDecision()`
 * itself and add its own authentication (arrives in DEV-PREVIEW-01B).
 */

import "server-only"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { readLabGateEnv } from "./config"
import { decideLabGate, type LabGateDecision } from "./gate-policy"

export type { LabGateDecision } from "./gate-policy"

export async function getLabGateDecision(): Promise<LabGateDecision> {
  const requestHeaders = await headers()
  // On Vercel the request only reaches this deployment because the platform
  // routed its Host to this project, so `host` identifies the real domain.
  const requestHost =
    requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host") ?? undefined
  return decideLabGate({ ...readLabGateEnv(process.env), requestHost })
}

/** 404 (never a redirect, never a reason) unless every gate condition holds. */
export async function requireLabAvailability(): Promise<void> {
  const decision = await getLabGateDecision()
  if (!decision.allowed) notFound()
}
