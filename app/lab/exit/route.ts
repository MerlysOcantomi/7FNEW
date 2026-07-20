import { NextResponse } from "next/server"
import { getLabGateDecision } from "@core/lab/gate"
import { clearLabAccessSession } from "@core/lab/access-session"

/**
 * `POST /lab/exit` — intentional lab logout (DEV-PREVIEW-01B).
 *
 * POST only: a stray cross-site GET must never destroy the session (the
 * SameSite=Strict cookie already blocks cross-site sends, and there is no GET
 * handler). Re-checks the infrastructure gate (defense in depth behind the
 * middleware) and answers 404 on any denial, clears the namespace cookie, then
 * redirects to `/lab/enter`.
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const gate = await getLabGateDecision()
  if (!gate.allowed) {
    return new NextResponse(null, { status: 404 })
  }
  await clearLabAccessSession()
  return NextResponse.redirect(new URL("/lab/enter", request.url), { status: 303 })
}
