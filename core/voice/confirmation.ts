/**
 * CORE-VOICE-0A — Canonical action confirmation (contract + pure control-flow).
 *
 * A single, reusable confirmation contract — NOT coupled to Forte's approval
 * store or the Inbox action flow. Those surfaces can adopt this contract later.
 *
 * Pattern:  proposal → spoken & written summary → confirmation → execution → result
 *
 * `resolveConfirmation` is PURE control-flow only: it decides whether the
 * server-side controlled pipeline may proceed, or why it must NOT. It NEVER
 * executes anything, never builds localized result copy, and never reads the
 * clock — the current time and the already-resolved state are injected so the
 * function is deterministic and testable. Real execution + re-authorization
 * happen server-side, never here and never with the client's ephemeral credential.
 */

import type { JsonObject, VoiceRoute } from "./contracts"

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
  /** Tool arguments — JSON-serializable only (no functions/classes/Dates). */
  args: JsonObject
  summary: ActionSummary
  /** Proposals are only ever raised for write-effect actions. */
  effect: "write"
  /** ISO 8601 timestamp after which the proposal must not execute. */
  expiresAt: string
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
 * Why a confirmation did NOT lead to execution.
 *   - declined         → the user cancelled.
 *   - invalid          → the confirmation's proposalId did not match.
 *   - expired          → the proposal was past `expiresAt`.
 *   - already_resolved → the proposal had already been confirmed/cancelled.
 */
export type ConfirmationReasonCode = "declined" | "invalid" | "expired" | "already_resolved"

/**
 * Outcome of resolving a confirmation against its proposal. `execute` signals
 * the controlled pipeline may proceed (server re-authorizes + runs); `rejected`
 * carries a precise `ConfirmationReasonCode`. There is NO path from a bad/late/
 * duplicate confirmation to `execute` — defence in depth.
 */
export type ConfirmationOutcome =
  | { kind: "execute"; proposal: ActionProposal; route: VoiceRoute }
  | { kind: "rejected"; proposalId: string; reason: ConfirmationReasonCode }

/**
 * Injected context so the resolver stays pure/deterministic.
 *   - `now`             → current time as an ISO 8601 string (injected, never
 *                         read from the system clock).
 *   - `alreadyResolved` → whether this proposal was already confirmed/cancelled
 *                         (idempotency signal held server-side).
 */
export interface ConfirmationContext {
  now: string
  alreadyResolved: boolean
}

/**
 * Parse an ISO 8601 timestamp to epoch milliseconds, or `null` when it does not
 * represent a valid instant. Comparison is NUMERIC (not lexicographic) so two
 * equal instants written with different offsets/formats (e.g. `...12:05:00Z` and
 * `...13:05:00+01:00`) compare equal. Time is passed in — this never reads the
 * system clock.
 */
function toEpochMs(iso: string): number | null {
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Resolve a confirmation. Precedence (each check blocks execution before the
 * next is considered):
 *   1. proposalId mismatch        → rejected(invalid)
 *   2. already resolved           → rejected(already_resolved)
 *   3. invalid now / expiresAt    → rejected(invalid)
 *   4. nowMs >= expiresAtMs       → rejected(expired)   (expired AT the instant)
 *   5. decision === "cancel"      → rejected(declined)
 *   6. decision === "confirm"     → execute (controlled, server-side)
 *
 * `now` is injected (never read from the system clock) so the function is
 * deterministic. No invalid-timestamp or expired case can ever reach `execute`.
 */
export function resolveConfirmation(
  proposal: ActionProposal,
  confirmation: ActionConfirmation,
  ctx: ConfirmationContext,
): ConfirmationOutcome {
  if (confirmation.proposalId !== proposal.id) {
    return { kind: "rejected", proposalId: proposal.id, reason: "invalid" }
  }
  if (ctx.alreadyResolved) {
    return { kind: "rejected", proposalId: proposal.id, reason: "already_resolved" }
  }
  const nowMs = toEpochMs(ctx.now)
  const expiresAtMs = toEpochMs(proposal.expiresAt)
  if (nowMs === null || expiresAtMs === null) {
    return { kind: "rejected", proposalId: proposal.id, reason: "invalid" }
  }
  if (nowMs >= expiresAtMs) {
    return { kind: "rejected", proposalId: proposal.id, reason: "expired" }
  }
  if (confirmation.decision === "cancel") {
    return { kind: "rejected", proposalId: proposal.id, reason: "declined" }
  }
  // Write actions always run through the controlled pipeline, server-side.
  return { kind: "execute", proposal, route: "controlled" }
}
