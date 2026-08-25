/**
 * FOUND-01 — Shared tool definition contract (`PlatformToolDefinition`).
 *
 * The canonical, provider-neutral shape for a platform tool per ARCH-03 §6.
 * It is a CONTRACT ONLY:
 *   - Declaring a tool grants nothing and executes nothing. Registering a
 *     tool is never authorizing it — discovery filtering (getAllowedTools)
 *     and per-call execution authorization are FOUND-02a / AI-05 work.
 *   - Nothing here is coupled to OpenAI function calling or any AI SDK;
 *     future provider adapters translate this contract per provider (AI-02+).
 *   - Tool arguments are UNTRUSTED INPUT: `parseToolInput` /
 *     `parseToolOutput` are strict (zod safeParse, typed failures) — no
 *     permissive `catch → {}` parsing.
 *
 * Naming: the legacy `ToolDefinition` in `agents/forte/tools.ts` is the
 * OpenAI function-calling shape used by the legacy agent route; it stays
 * untouched (compatibility) and gets re-expressed on this contract in AI-04.
 * The canonical platform contract is `PlatformToolDefinition` — there is
 * exactly one; do not create a second "canonical" tool type.
 */

import { z } from "zod"
import type { ActivityKey } from "./activities"
import type { CapabilityKey } from "./capabilities"
import type { ToolEffect, ToolExecutionPolicy, ToolRiskClass } from "./vocabulary"

/**
 * The tenant-scoped, server-authorized context a bound handler will receive.
 * DECLARED shape only: FOUND-01 ships no construction and no resolver — the
 * authorized context is built by the gateway in FOUND-02/AI-05, after
 * entitlement + permission + tenant checks. A handler must never receive
 * authority invented by a model: this object always originates server-side.
 */
export interface ToolExecutionContext {
  readonly workspaceId: string
  readonly userId: string
  readonly requestId: string
}

/**
 * Where a tool is offered. A pure NARROWING declaration for future discovery
 * (ARCH-03 §7): persona and experience may only reduce the allowed set, never
 * widen it, and this field is never an authorization source. `undefined`
 * means "no additional narrowing declared".
 */
export interface ToolAvailability {
  readonly personas?: readonly string[]
  readonly experiences?: readonly string[]
  readonly channels?: readonly string[]
  readonly verticals?: readonly string[]
}

/**
 * Handler binding. In FOUND-01 every catalog entry is `unbound`: the contract
 * is declared, the executable binding arrives with the shared tool registry
 * runtime (AI-04+). `reference` exists so a future binding can point at a
 * server-side handler without changing the contract shape.
 */
export type ToolHandlerBinding =
  | { readonly kind: "unbound" }
  | { readonly kind: "reference"; readonly ref: string }

export interface PlatformToolDefinition {
  /** Stable snake_case verb key, provider-independent (e.g. "draft_reply"). */
  readonly key: string
  readonly description: string
  /** Workspace-level capabilities the tool needs (ARCH-02). Never empty. */
  readonly requiresCapabilities: readonly CapabilityKey[]
  /**
   * User-level requirement, STRICTER-ONLY. Omitted = defaults to
   * `requiresCapabilities` (ARCH-02 §11: the role's permission set must
   * include the capability). No separate permission catalog exists yet;
   * introducing one is an owner decision for FOUND-02a+ — until then these
   * are capability keys.
   */
  readonly requiresPermissions?: readonly CapabilityKey[]
  readonly effect: ToolEffect
  readonly riskClass: ToolRiskClass
  /**
   * Usage-attribution key. Required when the tool's execution is meterable
   * (every AI-executing tool must declare one — ARCH-03 §9); pure
   * non-metered operations may omit it.
   */
  readonly activity?: ActivityKey
  /** Zod schema for the tool's (untrusted) input. */
  readonly inputSchema: z.ZodTypeAny
  /** Zod schema for the tool's output. */
  readonly outputSchema: z.ZodTypeAny
  readonly handler: ToolHandlerBinding
  readonly availability?: ToolAvailability
  readonly executionPolicy: ToolExecutionPolicy
}

/**
 * Identity helper that preserves the literal type of a definition (schemas
 * included), so `ToolHandlerFor<typeof MY_TOOL>` infers exact input/output
 * types. Purely compile-time; performs no registration and no side effects.
 */
export function defineTool<const TDef extends PlatformToolDefinition>(definition: TDef): TDef {
  return definition
}

export type ToolInputOf<TDef extends PlatformToolDefinition> = z.infer<TDef["inputSchema"]>
export type ToolOutputOf<TDef extends PlatformToolDefinition> = z.infer<TDef["outputSchema"]>

/**
 * The typed handler signature a future binding must satisfy for a given
 * definition: validated input in, execution context in, schema-conforming
 * output out. FOUND-01 declares the relationship; it does not execute it.
 */
export type ToolHandlerFor<TDef extends PlatformToolDefinition> = (
  input: ToolInputOf<TDef>,
  context: ToolExecutionContext,
) => Promise<ToolOutputOf<TDef>>

export type ToolParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] }

function toIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".")
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

/** Strict validation of untrusted tool input. Never throws, never `{}`. */
export function parseToolInput<TDef extends PlatformToolDefinition>(
  definition: TDef,
  raw: unknown,
): ToolParseResult<ToolInputOf<TDef>> {
  const parsed = definition.inputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) }
  return { ok: true, value: parsed.data as ToolInputOf<TDef> }
}

/** Strict validation of a tool's output against its declared schema. */
export function parseToolOutput<TDef extends PlatformToolDefinition>(
  definition: TDef,
  raw: unknown,
): ToolParseResult<ToolOutputOf<TDef>> {
  const parsed = definition.outputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) }
  return { ok: true, value: parsed.data as ToolOutputOf<TDef> }
}
