import { notFound } from "next/navigation"
import { resolveLabGate } from "./gate"
import { VoiceLabClient } from "./voice-lab-client"

/**
 * `/voice-lab` — isolated Realtime spike (CORE-VOICE-0B.1).
 *
 * Server-gated: VOICE_LAB_ENABLED + platform admin/dev + valid workspace. Any
 * failure → `notFound()` (404), so the lab's existence is never revealed. It is
 * intentionally NOT wrapped in AppShell/sidebar/top bar — a standalone page.
 */

// Reads cookies via the gate → must be dynamic (never statically prerendered).
export const dynamic = "force-dynamic"

export default async function VoiceLabPage() {
  const gate = await resolveLabGate()
  if (!gate.allowed) notFound()
  return <VoiceLabClient />
}
