/**
 * CORE-VOICE-0A — Canonical action confirmation (contract + pure control-flow).
 *
 * A single, reusable confirmation contract — NOT coupled to Forte's approval
 * store or the Inbox action flow. Those surfaces can adopt this contract later.
 *
 * Pattern:  proposal → spoken & written summary → confirmation → execution → result
 *
 * `resolveConfirmation` is PURE control-flow only: it decides whether the
 * server-side controlled pipeline may proceed, or the action is cancelled. It
 * NEVER executes anything and never builds localized result copy — real
 * execution + re-authorization happen server-side, never here and never with
 * the client's ephemeral credential.
 */

import type { VoiceRoute } from "./contracts"

export interface ActionSummary {
  /** Summary read aloud. */
  spoken: string
  /** Summary shown as text (coexists with the spoken one). */
  written: string
}

export type ActionRisk = "low" | "medium" | "high"

export interface ActionProposal {
  id: string
  workspaceId: string
  toolName: string
  args: unknown
  summary: ActionSummary
  /** Proposals are only ever raised for write-effect actions. */
  effect: "write"
  risk?: ActionRisk
}

export type ConfirmationChannel = "voice" | "text" | "tap"

export interface ActionConfirmation {
  proposalId: string
  decision: "confirm" | "cancel"
  via: ConfirmationChannel
}

export type ActionExecutionStatus = "executed" | "failed" | "cancelled"

/**
 * Terminal result of an action. Produced by the SERVER-SIDE controlled pipeline
 * after execution — not by `resolveConfirmation`. Included here so every surface
 * shares one shape.
 */
export interface ActionExecutionResult {
  proposalId: string
  status: ActionExecutionStatus
  detail?: string
  spoken: string
  written: string
}

/**
 * Outcome of resolving a confirmation against its proposal. `execute` signals
 * the controlled pipeline may proceed (server re-authorizes + runs); `cancelled`
 * is terminal. A confirmation whose `proposalId` does not match is treated as a
 * cancel (`mismatch`), never as an execute — defence in depth.
 */
export type ConfirmationOutcome =
  | { kind: "execute"; proposal: ActionProposal; route: VoiceRoute }
  | { kind: "cancelled"; proposalId: string; reason: "declined" | "mismatch" }

export function resolveConfirmation(
  proposal: ActionProposal,
  confirmation: ActionConfirmation,
): ConfirmationOutcome {
  if (confirmation.proposalId !== proposal.id) {
    return { kind: "cancelled", proposalId: proposal.id, reason: "mismatch" }
  }
  if (confirmation.decision === "confirm") {
    // Write actions always run through the controlled pipeline, server-side.
    return { kind: "execute", proposal, route: "controlled" }
  }
  return { kind: "cancelled", proposalId: proposal.id, reason: "declined" }
}
