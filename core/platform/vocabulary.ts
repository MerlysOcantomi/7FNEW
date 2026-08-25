/**
 * FOUND-01 — Shared platform vocabulary: tool effects, execution policies and
 * risk classes.
 *
 * Pure TypeScript constants + types. No runtime side effects, no I/O, no
 * React, no Next.js, no AI SDK, no `@core/db`. Safe on client and server.
 *
 * Canonical sources (do not fork these vocabularies):
 *   - Effects and execution policies originate in `core/voice/contracts.ts`
 *     (CORE-VOICE-0A) and are adopted platform-wide per ARCH-03 §6. The voice
 *     module re-exports THESE constants so exactly one canonical value set
 *     exists; behavior of Voice is unchanged.
 *   - Risk classes are defined by ARCH-03 §6 (READ / WRITE /
 *     EXTERNAL_SIDE_EFFECT / FINANCIAL / COMMUNICATION / ADMIN). Runtime
 *     values use lowercase snake_case to match the repo's vocabulary
 *     convention (see voice execution policies); the architectural meaning is
 *     preserved exactly.
 *
 * Declaring a value here grants nothing: authorization stays with
 * entitlements/capabilities (FOUND-02a) and server-side checks.
 */

/** What kind of change a tool makes. Adopted from voice, platform-wide. */
export const TOOL_EFFECTS = ["read", "navigate", "draft", "propose", "write"] as const
export type ToolEffect = (typeof TOOL_EFFECTS)[number]

/**
 * How a tool call may run: inline, via the controlled pipeline, or only after
 * an explicit confirmation. The default effect→policy mapping lives in
 * `core/voice/routing.ts`; a definition stores its policy explicitly so it can
 * be inspected without the resolver (same rule as `VoiceToolDef`).
 */
export const TOOL_EXECUTION_POLICIES = [
  "immediate",
  "controlled",
  "confirmation_required",
] as const
export type ToolExecutionPolicy = (typeof TOOL_EXECUTION_POLICIES)[number]

/**
 * Blast radius of a tool, orthogonal to `ToolEffect` (ARCH-03 §6): a `write`
 * that messages a customer is `communication`; one that moves money is
 * `financial`. Both dimensions feed the future human-in-the-loop policy
 * (ARCH-03 §21) — not implemented in FOUND-01.
 */
export const TOOL_RISK_CLASSES = [
  "read",
  "write",
  "external_side_effect",
  "financial",
  "communication",
  "admin",
] as const
export type ToolRiskClass = (typeof TOOL_RISK_CLASSES)[number]
