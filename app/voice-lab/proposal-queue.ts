/**
 * Voice Lab proposal queue (CORE-VOICE-0B.1.2) — pure, deterministic.
 *
 * A single active proposal at a time. If a NEW proposal arrives while one is
 * still active, the lab must NOT silently replace it: the first one is kept and
 * a "pending proposal" flag is raised so the UI can warn. Nothing is ever
 * executed here — this is display/queue state only.
 */

import type { ActionProposal } from "@core/voice/confirmation"

export interface ProposalQueueState {
  /** The proposal currently shown on the card, or null. */
  active: ActionProposal | null
  /** True when a new proposal arrived while `active` was set (kept, not replaced). */
  hasBlockedIncoming: boolean
}

export const EMPTY_PROPOSAL_QUEUE: ProposalQueueState = {
  active: null,
  hasBlockedIncoming: false,
}

/**
 * Receive a proposal. When one is already active the incoming proposal is
 * DROPPED (never replaces the active one) and `hasBlockedIncoming` is set.
 */
export function receiveProposal(
  state: ProposalQueueState,
  incoming: ActionProposal,
): ProposalQueueState {
  if (state.active) {
    return { active: state.active, hasBlockedIncoming: true }
  }
  return { active: incoming, hasBlockedIncoming: false }
}

/** Resolve/clear the active proposal (after confirm, cancel or expiry). */
export function clearActiveProposal(): ProposalQueueState {
  return EMPTY_PROPOSAL_QUEUE
}
