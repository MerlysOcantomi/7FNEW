import { NextResponse } from "next/server"
import { getLabGateDecision } from "@core/lab/gate"
import { clearLabApplicationSession } from "@core/lab/application-session"

/**
 * `POST /lab/exit` — intentional lab logout (DEV-PREVIEW-01B/C).
 *
 * POST only: a stray cross-site GET must never destroy the session (the
 * SameSite=Strict access cookie blocks cross-site sends, and there is no GET
 * handler). Re-checks the infrastructure gate (defense in depth behind the
 * middleware) and answers 404 on any denial, clears ALL three lab cookies
 * (access + normal session + workspace), then redirects to `/lab/enter`.
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const gate = await getLabGateDecision()
  if (!gate.allowed) {
    return new NextResponse(null, { status: 404 })
  }
  await clearLabApplicationSession()
  return NextResponse.redirect(new URL("/lab/enter", request.url), { status: 303 })
}
