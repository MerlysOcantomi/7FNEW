/**
 * Voice Lab proposal queue (CORE-VOICE-0B.1.2) — pure, deterministic.
 *
 * A single active proposal at a time. If a NEW proposal arrives while one is
 * still active, the lab must NOT silently replace it: the first one is kept and
 * a "pending proposal" flag is raised so the UI can warn. Nothing is ever
 * executed here — this is display/queue state only.
 */

import type { ActionProposal } from "@core/voice/confirmation"

/**
 * Honest copy for the drop: the SECOND proposal is discarded (there is NO real
 * queue), so it must not be described as "pending". The active one stays pending.
 */
export const DISCARDED_INCOMING_MESSAGE =
  "7F intentó preparar otra propuesta mientras esta seguía pendiente. La segunda se descartó en el laboratorio. Resuelve esta y vuelve a pedirla."

export interface ProposalQueueState {
  /** The proposal currently shown on the card, or null. */
  active: ActionProposal | null
  /** True when a new proposal arrived and was DISCARDED (not queued) — the first is kept. */
  discardedIncoming: boolean
}

export const EMPTY_PROPOSAL_QUEUE: ProposalQueueState = {
  active: null,
  discardedIncoming: false,
}

/**
 * Receive a proposal. When one is already active the incoming proposal is
 * DROPPED (never replaces the active one, never queued) and `discardedIncoming`
 * is set so the UI can say so honestly.
 */
export function receiveProposal(
  state: ProposalQueueState,
  incoming: ActionProposal,
): ProposalQueueState {
  if (state.active) {
    return { active: state.active, discardedIncoming: true }
  }
  return { active: incoming, discardedIncoming: false }
}

/** Resolve/clear the active proposal (after confirm, cancel or expiry). */
export function clearActiveProposal(): ProposalQueueState {
  return EMPTY_PROPOSAL_QUEUE
}
