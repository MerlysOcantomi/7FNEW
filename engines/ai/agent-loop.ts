/**
 * AI-06 — Shared agent-turn / tool-loop use case.
 *
 * One reusable orchestration for "conversation + canonical tools" turns,
 * built strictly on the existing foundations:
 *
 *   FOUND-02b  every provider round goes through `executeAIToolTurn` and its
 *              normalized `AIExecutionResult` is preserved PER CALL — usage,
 *              actual model, latency, provider request id, finish reason.
 *              Missing usage stays explicit `unavailable`, never zero.
 *   FOUND-03   `resolveAvailableTools` decides what the provider may see
 *              (discovery), and `authorizeToolInvocation` re-authorizes
 *              EVERY model-requested invocation immediately before
 *              execution. A discovery result is never a durable token.
 *
 * The loop owns no provider format (adapter concern), no tool metadata
 * (canonical catalog concern) and no authorization policy (FOUND-03
 * concern). Bindings are injected: a minimal ToolKey→handler registry with
 * execution code only. Workspace/user identity comes exclusively from the
 * server-derived `ToolExecutionContext` — nothing model-generated can
 * override it, and privileged fields inside tool arguments are rejected.
 *
 * Fail-closed rules: unknown/aliased tool names, invalid input, missing
 * bindings, denied authorization, confirmation-required tools without a
 * trusted confirmation, duplicate provider tool-call ids and exceeded
 * limits all produce CONTROLLED tool results (the model is told, nothing
 * executes) — never a silent retry, never a side effect.
 */

import {
  authorizeToolInvocation,
  resolveAvailableTools,
  type ToolResolutionContext,
} from "@core/platform/tool-authorization"
import type { ToolKey } from "@core/platform/tool-catalog"
import {
  parseToolInput,
  type PlatformToolDefinition,
  type ToolExecutionContext,
} from "@core/platform/tool-definition"
import type { ActivityKey } from "@core/platform/activities"
import { executeAIToolTurn } from "./execution"
import {
  type AIAgentMessage,
  type AIAssistantTurn,
  type AIChatMessage,
  type AIExecutionAttribution,
  type AIExecutionResult,
  type AIProviderKey,
  type AIProviderToolDefinition,
  type AIToolCall,
} from "./execution-contract"
import { toolInputJsonSchema, ToolSchemaConversionError } from "./tool-schema"

/** Execution-only binding for one canonical tool. No metadata duplication:
 * capabilities, permissions, effects, confirmation policy and input schema
 * remain authoritative in the canonical catalog (FOUND-01/03). */
export interface AgentToolBinding {
  run(input: unknown, context: ToolExecutionContext): Promise<unknown>
}

/** Minimal binding registry, keyed exclusively by canonical ToolKey. */
export type AgentBindingRegistry = ReadonlyMap<ToolKey, AgentToolBinding>

export interface AgentLoopLimits {
  /** Maximum provider rounds per turn. */
  maxRounds: number
  /** Maximum tool executions attempted across the whole turn. */
  maxToolCalls: number
  /** Maximum times the exact same (tool, arguments) pair may run per turn. */
  maxIdenticalToolCalls: number
  /** Tool-result payload cap (chars) before truncation, per result. */
  maxToolResultChars: number
}

/** Defaults; `maxRounds` preserves the legacy MAX_TOOL_ROUNDS value. */
export const AGENT_LOOP_DEFAULT_LIMITS: Readonly<AgentLoopLimits> = {
  maxRounds: 5,
  maxToolCalls: 16,
  maxIdenticalToolCalls: 3,
  maxToolResultChars: 20_000,
}

/**
 * Model-generated tool arguments must never carry identity/authorization
 * context: workspace scoping, user identity, role and permissions come only
 * from the authenticated server context. Any of these keys in parsed
 * arguments rejects the call outright (defense in depth over the strict
 * canonical schemas).
 */
const PRIVILEGED_ARGUMENT_KEYS = [
  "workspaceId",
  "workspace_id",
  "userId",
  "user_id",
  "tenantId",
  "tenant_id",
  "role",
  "wsRole",
  "permissions",
  "membership",
] as const

export type AgentToolCallStatus =
  | "executed"
  | "denied"
  | "unknown_tool"
  | "invalid_input"
  | "missing_binding"
  | "confirmation_required"
  | "duplicate_call"
  | "limit_exceeded"
  | "handler_error"

export interface AgentToolExecutionRecord {
  toolCallId: string
  /** The tool name exactly as the model requested it. */
  requestedTool: string
  status: AgentToolCallStatus
  /** Canonically validated input (present only when validation passed). */
  input?: unknown
  /** Handler result (present only when the handler executed). */
  result?: unknown
  /** Safe, non-sensitive error/denial description. */
  error?: string
}

/**
 * Documented aggregation over the per-call records (which remain the source
 * of truth): each token sum covers ONLY the calls that reported that field;
 * `requestCount` counts actual provider calls; `unavailableCalls` and
 * `complete` keep partial/missing usage visible instead of collapsing it to
 * zero. A future Usage Meter must consume `providerCalls`, not this summary.
 */
export interface AgentUsageSummary {
  requestCount: number
  reportedCalls: number
  unavailableCalls: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** True iff every call reported usage including every summed field. */
  complete: boolean
}

export interface AgentLoopInput {
  /** Full system prompt content (persona + injected business context). */
  system: string
  /** Sanitized prior conversation (user/assistant text turns only). */
  history: readonly AIChatMessage[]
  /** The new user message. */
  message: string
  /** FOUND-03 resolution context built from authenticated server state. */
  resolution: ToolResolutionContext
  /** Execution bindings, keyed by canonical ToolKey. */
  bindings: AgentBindingRegistry
  /** Server-derived execution context passed verbatim to handlers. */
  toolContext: ToolExecutionContext
  /** Attribution for every provider round (workspace always known). */
  attribution: AIExecutionAttribution
  activity?: ActivityKey
  provider?: AIProviderKey
  model?: string
  temperature?: number
  maxTokens?: number
  requestMetadata?: { requestId?: string; caller?: string }
  limits?: Partial<AgentLoopLimits>
}

export type AgentLoopTermination =
  | "final"
  | "round_limit"
  | "tool_call_limit"

export interface AgentLoopResult {
  /** Final assistant text ("" when the loop terminated without one — legacy). */
  finalText: string
  /** Every tool call the model requested, with its controlled outcome. */
  toolExecutions: readonly AgentToolExecutionRecord[]
  /** One normalized FOUND-02b result per provider call — source of truth. */
  providerCalls: readonly AIExecutionResult<AIAssistantTurn>[]
  usage: AgentUsageSummary
  terminated: AgentLoopTermination
  /** Tools actually offered to the provider this turn (canonical keys). */
  offeredTools: readonly string[]
}

export interface ProviderToolBuildResult {
  tools: readonly AIProviderToolDefinition[]
  /** Canonical keys offered (subset of the discovery's executable set). */
  offeredKeys: ReadonlySet<string>
  /** Why an executable-in-principle tool was withheld (fail-closed traces). */
  diagnostics: readonly string[]
}

/**
 * Canonical discovery → provider tool definitions. Only tools that are (a)
 * allowed by the full FOUND-03 decision, (b) executable (bound reference in
 * BOTH the definition and the registry), (c) not confirmation-gated (this
 * surface has no trusted confirmation contract), and (d) schema-convertible
 * are offered. Anything else is withheld — fail closed, with a diagnostic.
 */
export function buildProviderToolsForContext(
  resolution: ToolResolutionContext,
  bindings: AgentBindingRegistry,
): ProviderToolBuildResult {
  const resolved = resolveAvailableTools(resolution)
  const tools: AIProviderToolDefinition[] = []
  const offeredKeys = new Set<string>()
  const diagnostics: string[] = []

  for (const decision of resolved.executable) {
    const definition = decision.definition as PlatformToolDefinition
    // This surface has NO server-verifiable confirmation contract, so
    // confirmation-gated tools — and, structurally, ANY tool that persists
    // a write (canonical write→confirmation policy) — are never offered.
    if (definition.executionPolicy === "confirmation_required" || definition.effect === "write") {
      diagnostics.push(
        `${decision.toolKey}: withheld — requires explicit confirmation and this surface has no trusted confirmation contract`,
      )
      continue
    }
    if (!bindings.has(decision.toolKey as ToolKey)) {
      diagnostics.push(`${decision.toolKey}: withheld — no execution binding registered`)
      continue
    }
    let parameters: Record<string, unknown>
    try {
      parameters = toolInputJsonSchema(definition.inputSchema)
    } catch (error) {
      if (error instanceof ToolSchemaConversionError) {
        diagnostics.push(`${decision.toolKey}: withheld — ${error.message}`)
        continue
      }
      throw error
    }
    tools.push({ name: definition.key, description: definition.description, parameters })
    offeredKeys.add(definition.key)
  }

  return { tools, offeredKeys, diagnostics }
}

function truncateToolResult(serialized: string, maxChars: number): string {
  if (serialized.length <= maxChars) return serialized
  return `${serialized.slice(0, maxChars)}…[truncated]`
}

function safeErrorMessage(error: unknown): string {
  // Tool handlers may throw with user-facing messages ("Cliente no
  // encontrado…"); anything else is reported generically — no stack traces,
  // no db/provider details reach the model or the client.
  return error instanceof Error && error.message ? error.message : "Error al ejecutar la herramienta"
}

interface ControlledToolOutcome {
  record: AgentToolExecutionRecord
  /** What the model is told (serialized into the tool result message). */
  payload: { success: boolean; data?: unknown; error?: string }
}

async function processToolCall(
  call: AIToolCall,
  state: {
    input: AgentLoopInput
    limits: AgentLoopLimits
    seenCallIds: Set<string>
    identicalCallCounts: Map<string, number>
    executedCallCount: { value: number }
  },
): Promise<ControlledToolOutcome> {
  const { input, limits } = state
  const base = { toolCallId: call.id, requestedTool: call.name }

  // In-turn duplicate provider tool-call id: never execute twice.
  if (state.seenCallIds.has(call.id)) {
    return {
      record: { ...base, status: "duplicate_call", error: "duplicate tool_call id" },
      payload: { success: false, error: "Llamada duplicada: este tool_call id ya fue procesado" },
    }
  }
  state.seenCallIds.add(call.id)

  // Invocation-time authorization — the complete FOUND-03 decision, again.
  const decision = authorizeToolInvocation(input.resolution, call.name)
  if (!decision.allowed) {
    // Typed confirmation refusal: capability + permission gates passed and
    // ONLY the execution gate blocked a confirmation-required definition.
    // No role (OWNER included) substitutes for explicit user confirmation.
    if (
      decision.reasons.every((reason) => reason === "tool_not_executable") &&
      decision.definition?.executionPolicy === "confirmation_required"
    ) {
      return {
        record: { ...base, status: "confirmation_required", error: "confirmation required" },
        payload: {
          success: false,
          error:
            "Esta herramienta requiere confirmación explícita del usuario y este canal no dispone de un mecanismo de confirmación verificable",
        },
      }
    }
    const status: AgentToolCallStatus = decision.reasons.includes("unknown_tool")
      ? "unknown_tool"
      : "denied"
    return {
      record: { ...base, status, error: `authorization denied: ${decision.reasons.join(", ")}` },
      payload: {
        success: false,
        error:
          status === "unknown_tool"
            ? `Herramienta desconocida: ${call.name}`
            : "No autorizado: esta herramienta no está disponible para tu rol o workspace",
      },
    }
  }

  const definition = decision.definition as PlatformToolDefinition

  // Canonical execution policy: authorization is not execution. Without a
  // server-verifiable confirmation contract, confirmation-required tools —
  // and, structurally, any write-effect tool on this surface — return a
  // typed refusal — a model claim of "the user confirmed" is not evidence.
  if (definition.executionPolicy === "confirmation_required" || definition.effect === "write") {
    return {
      record: { ...base, status: "confirmation_required", error: "confirmation required" },
      payload: {
        success: false,
        error:
          "Esta herramienta requiere confirmación explícita del usuario y este canal no dispone de un mecanismo de confirmación verificable",
      },
    }
  }

  // Strict, canonical input validation. Malformed JSON never becomes `{}`.
  let rawParsed: unknown
  try {
    rawParsed = call.rawArguments === "" ? {} : JSON.parse(call.rawArguments)
  } catch {
    return {
      record: { ...base, status: "invalid_input", error: "arguments are not valid JSON" },
      payload: { success: false, error: "Argumentos inválidos: JSON malformado" },
    }
  }
  if (rawParsed !== null && typeof rawParsed === "object" && !Array.isArray(rawParsed)) {
    const privileged = PRIVILEGED_ARGUMENT_KEYS.filter((key) =>
      Object.prototype.hasOwnProperty.call(rawParsed as Record<string, unknown>, key),
    )
    if (privileged.length > 0) {
      return {
        record: {
          ...base,
          status: "invalid_input",
          error: `privileged argument keys rejected: ${privileged.join(", ")}`,
        },
        payload: {
          success: false,
          error: "Argumentos inválidos: campos privilegiados no permitidos",
        },
      }
    }
  }
  const parsed = parseToolInput(definition, rawParsed)
  if (!parsed.ok) {
    return {
      record: {
        ...base,
        status: "invalid_input",
        error: `input validation failed: ${parsed.issues.join("; ")}`,
      },
      payload: { success: false, error: `Argumentos inválidos: ${parsed.issues.join("; ")}` },
    }
  }

  // Execution binding must exist (definition reference + live registry).
  const binding = input.bindings.get(definition.key as ToolKey)
  if (!binding) {
    return {
      record: { ...base, status: "missing_binding", error: "no execution binding registered" },
      payload: { success: false, error: "Herramienta no ejecutable en este momento" },
    }
  }

  // Explicit loop-safety limits (never silently retried, never exceeded).
  if (state.executedCallCount.value >= limits.maxToolCalls) {
    return {
      record: { ...base, status: "limit_exceeded", error: "max tool calls per turn reached" },
      payload: { success: false, error: "Límite de herramientas por turno alcanzado" },
    }
  }
  const identityKey = `${definition.key}:${call.rawArguments}`
  const identicalCount = (state.identicalCallCounts.get(identityKey) ?? 0) + 1
  state.identicalCallCounts.set(identityKey, identicalCount)
  if (identicalCount > limits.maxIdenticalToolCalls) {
    return {
      record: {
        ...base,
        status: "limit_exceeded",
        error: "identical tool call repeated too many times",
      },
      payload: {
        success: false,
        error: "Llamada repetida demasiadas veces con los mismos argumentos",
      },
    }
  }

  state.executedCallCount.value += 1
  try {
    // The handler receives ONLY the validated canonical input and the
    // server-derived execution context — never model-supplied identity.
    const data = await binding.run(parsed.value, input.toolContext)
    return {
      record: { ...base, status: "executed", input: parsed.value, result: data },
      payload: { success: true, data },
    }
  } catch (error) {
    // Handler failure: controlled result, no automatic retry (a retry could
    // duplicate a side effect).
    const message = safeErrorMessage(error)
    return {
      record: { ...base, status: "handler_error", input: parsed.value, error: message },
      payload: { success: false, error: message },
    }
  }
}

/** Documented aggregation — see `AgentUsageSummary`. */
export function summarizeAgentUsage(
  providerCalls: readonly AIExecutionResult<AIAssistantTurn>[],
): AgentUsageSummary {
  let reportedCalls = 0
  let unavailableCalls = 0
  const sums: Record<"inputTokens" | "outputTokens" | "totalTokens", number | undefined> = {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
  }
  let missingField = false

  for (const call of providerCalls) {
    if (call.usage.status !== "reported") {
      unavailableCalls += 1
      continue
    }
    reportedCalls += 1
    for (const field of ["inputTokens", "outputTokens", "totalTokens"] as const) {
      const value = call.usage[field]
      if (value === undefined) {
        missingField = true
        continue
      }
      sums[field] = (sums[field] ?? 0) + value
    }
  }

  return {
    requestCount: providerCalls.length,
    reportedCalls,
    unavailableCalls,
    inputTokens: sums.inputTokens,
    outputTokens: sums.outputTokens,
    totalTokens: sums.totalTokens,
    complete: providerCalls.length > 0 && unavailableCalls === 0 && !missingField,
  }
}

/**
 * Run one complete agent turn. See the module header for the guarantees.
 * `deps.fetchImpl` exists for tests only — production callers omit it.
 */
export async function runAgentToolLoop(
  input: AgentLoopInput,
  deps?: { fetchImpl?: typeof fetch },
): Promise<AgentLoopResult> {
  const limits: AgentLoopLimits = { ...AGENT_LOOP_DEFAULT_LIMITS, ...input.limits }

  const { tools, offeredKeys } = buildProviderToolsForContext(input.resolution, input.bindings)

  const messages: AIAgentMessage[] = [
    { role: "system", content: input.system },
    ...input.history,
    { role: "user", content: input.message },
  ]

  const providerCalls: AIExecutionResult<AIAssistantTurn>[] = []
  const toolExecutions: AgentToolExecutionRecord[] = []
  const seenCallIds = new Set<string>()
  const identicalCallCounts = new Map<string, number>()
  const executedCallCount = { value: 0 }

  let finalText = ""
  let terminated: AgentLoopTermination = "round_limit"

  for (let round = 0; round < limits.maxRounds; round++) {
    const result = await executeAIToolTurn(
      {
        messages,
        tools,
        provider: input.provider,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        activity: input.activity,
        // Planning/chat rounds are attributed to the workspace and the agent
        // activity — never to a tool the model has not selected.
        attribution: input.attribution,
        requestMetadata: input.requestMetadata,
      },
      deps,
    )
    providerCalls.push(result)

    const turn = result.output
    if (turn.toolCalls.length > 0) {
      messages.push({ role: "assistant", content: turn.content, toolCalls: turn.toolCalls })

      let limitStop = false
      for (const call of turn.toolCalls) {
        const outcome = await processToolCall(call, {
          input,
          limits,
          seenCallIds,
          identicalCallCounts,
          executedCallCount,
        })
        toolExecutions.push(outcome.record)
        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: truncateToolResult(JSON.stringify(outcome.payload), limits.maxToolResultChars),
        })
        if (
          outcome.record.status === "limit_exceeded" &&
          outcome.record.error === "max tool calls per turn reached"
        ) {
          limitStop = true
        }
      }

      if (limitStop) {
        terminated = "tool_call_limit"
        finalText = turn.content
        break
      }
      if (result.finishReason === "tool_calls") continue
    }

    finalText = turn.content
    terminated = "final"
    break
  }

  return {
    finalText,
    toolExecutions,
    providerCalls,
    usage: summarizeAgentUsage(providerCalls),
    terminated,
    offeredTools: [...offeredKeys],
  }
}
