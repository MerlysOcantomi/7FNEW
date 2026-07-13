/**
 * Tiny pub/sub so the `propose_action` tool can surface its (simulated)
 * `ActionProposal` to the Voice Lab UI card. Module-level because tools are
 * defined once at load; the client registers a listener while mounted.
 */

import type { ActionProposal } from "@core/voice/confirmation"

type Listener = (proposal: ActionProposal) => void

let listener: Listener | null = null

export function onProposeAction(next: Listener | null): void {
  listener = next
}

export function emitProposeAction(proposal: ActionProposal): void {
  listener?.(proposal)
}
