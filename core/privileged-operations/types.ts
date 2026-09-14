/**
 * Privileged Operations Core v1 — contracts (SevenF / NEON-05, FOUNDATION_CANDIDATE).
 *
 * Four things are kept apart on purpose:
 *
 *   OPERATION      what a caller wants to do, named by a stable id
 *                  (`database.write`), described once in the registry;
 *   POLICY SOURCE  where the current operating mode comes from
 *                  (v1: runtime configuration; later: Mission Control);
 *   DECISION       a pure function of (operation, resolved mode);
 *   ENFORCEMENT    the place that asks and refuses (the Prisma boundary,
 *                  the background-task registry, the HTTP middleware).
 *
 * Callers only ever name the OPERATION. Swapping the policy source, adding
 * a mode or adding an operation family never touches a call site.
 *
 * Stable, not frozen: ids are append-only, modes are append-only, and the
 * decision shape may grow fields but never loses one.
 */

/** Operating modes a policy source can resolve to. Append-only. */
export const OPERATION_MODES = ["normal", "freeze-writes"] as const
export type OperationMode = (typeof OPERATION_MODES)[number]

/**
 * Registered operation ids. Append-only. Families are reserved so that
 * future ids (`database.destructive`, `deploy.production`, `secrets.modify`,
 * `dns.modify`, `payments.execute`, `billing.modify`,
 * `integration.disconnect`, `infrastructure.destroy`) can be added without
 * changing this contract — none of them is implemented in v1.
 */
export type PrivilegedOperationId = "database.write" | "background.start"

export type OperationFamily = "database" | "background"

export interface OperationDefinition {
  readonly id: PrivilegedOperationId
  readonly family: OperationFamily
  /** Human description used in errors and reports; never includes runtime values. */
  readonly description: string
  /** Modes in which this operation is refused. Everything else allows it. */
  readonly deniedInModes: readonly OperationMode[]
}

/**
 * What a policy source answers. `invalid` is a first-class outcome: a
 * misconfigured source must be visible, and the decision layer treats it as
 * fail-closed for every registered operation.
 */
export type PolicyResolution =
  | { readonly kind: "mode"; readonly mode: OperationMode; readonly origin: string }
  | { readonly kind: "invalid"; readonly origin: string; readonly detail: string }

export interface PolicySource {
  /** Stable name for logs and decisions (e.g. `env:SEVENF_OPERATION_MODE`). */
  readonly name: string
  resolve(): PolicyResolution
}

export interface OperationDecision {
  readonly operation: PrivilegedOperationId
  readonly allowed: boolean
  /** The resolved mode, or `invalid` when the source could not be trusted. */
  readonly mode: OperationMode | "invalid"
  readonly source: string
  /** Short, value-free explanation. */
  readonly reason: string
}
