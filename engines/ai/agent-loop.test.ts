import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveWorkspaceCapabilitySnapshot,
  type WorkspaceCapabilitySources,
} from "@core/platform/workspace-capabilities"
import type { ToolResolutionContext } from "@core/platform/tool-authorization"
import { TOOL_CATALOG, type ToolKey } from "@core/platform/tool-catalog"
import type { ToolExecutionContext } from "@core/platform/tool-definition"
import {
  AGENT_LOOP_DEFAULT_LIMITS,
  buildProviderToolsForContext,
  runAgentToolLoop,
  summarizeAgentUsage,
  type AgentBindingRegistry,
  type AgentLoopInput,
  type AgentToolBinding,
} from "./agent-loop"
import { AIExecutionError } from "./execution-contract"

process.env.OPENAI_API_KEY = "test-openai-key"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOOL_CONTEXT: ToolExecutionContext = {
  workspaceId: "ws_1",
  userId: "user_1",
  requestId: "req_1",
}

function sources(
  overrides: Partial<NonNullable<WorkspaceCapabilitySources["workspace"]>> = {},
): WorkspaceCapabilitySources {
  return {
    workspace: {
      id: "ws_1",
      status: "active",
      // enterprise → all products → every agent capability present unless a
      // test narrows it deliberately.
      plan: "enterprise",
      configModules: null,
      ...overrides,
    },
  }
}

function resolutionFor(
  role: string | null,
  overrides: Partial<NonNullable<WorkspaceCapabilitySources["workspace"]>> = {},
): ToolResolutionContext {
  return {
    snapshot: resolveWorkspaceCapabilitySnapshot(sources(overrides)),
    membership: role === null ? null : { role },
  }
}

interface StubBinding extends AgentToolBinding {
  calls: Array<{ input: unknown; context: ToolExecutionContext }>
}

function stubBinding(result: unknown | (() => unknown)): StubBinding {
  const calls: StubBinding["calls"] = []
  return {
    calls,
    async run(input, context) {
      calls.push({ input, context })
      return typeof result === "function" ? (result as () => unknown)() : result
    },
  }
}

function registry(entries: Partial<Record<ToolKey, AgentToolBinding>>): AgentBindingRegistry {
  return new Map(Object.entries(entries) as Array<[ToolKey, AgentToolBinding]>)
}

interface WireToolCall {
  id: string
  name: string
  args: string
}

function providerTurn(options: {
  content?: string | null
  toolCalls?: WireToolCall[]
  finish?: string
  usage?: Record<string, unknown> | undefined
  model?: string
}): Response {
  const toolCalls = options.toolCalls ?? []
  return new Response(
    JSON.stringify({
      model: options.model ?? "gpt-4.1-served",
      choices: [
        {
          message: {
            content: options.content ?? (toolCalls.length > 0 ? null : "listo"),
            ...(toolCalls.length > 0
              ? {
                  tool_calls: toolCalls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: { name: call.name, arguments: call.args },
                  })),
                }
              : {}),
          },
          finish_reason: options.finish ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
        },
      ],
      ...(options.usage !== undefined ? { usage: options.usage } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json", "x-request-id": "prov-req" } },
  )
}

interface CapturedRequest {
  url: string
  body: Record<string, unknown>
}

function scriptedFetch(
  script: Array<(call: CapturedRequest, index: number) => Response>,
): { fetchImpl: typeof fetch; captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = []
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const call: CapturedRequest = {
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    }
    const index = captured.length
    captured.push(call)
    const responder = script[Math.min(index, script.length - 1)]
    return responder(call, index)
  }) as typeof fetch
  return { fetchImpl, captured }
}

function loopInput(overrides: Partial<AgentLoopInput> = {}): AgentLoopInput {
  return {
    system: "SYSTEM",
    history: [],
    message: "hola",
    resolution: resolutionFor("MEMBER"),
    bindings: registry({}),
    toolContext: TOOL_CONTEXT,
    attribution: { workspaceId: "ws_1" },
    activity: "ai.agent_turn",
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.6,
    maxTokens: 8192,
    ...overrides,
  }
}

const USAGE_FULL = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }

// ─── Canonical discovery → provider tools ────────────────────────────────────

test("discovery offers only authorized, bound, non-confirmation, convertible tools", () => {
  const bindings = registry({
    search_client: stubBinding({}),
    create_content: stubBinding({}), // rogue registry entry — must still be withheld
    create_task: stubBinding({}), // bound in registry but confirmation_required
  })
  const { tools, offeredKeys, diagnostics } = buildProviderToolsForContext(
    resolutionFor("MEMBER"),
    bindings,
  )
  const names = tools.map((tool) => tool.name)
  assert.deepEqual(names, [...offeredKeys])
  assert.ok(names.includes("search_client"))
  // Write tools are NEVER offered on this surface (confirmation_required,
  // unbound in the catalog) — even a rogue registry entry cannot expose one.
  assert.ok(!names.includes("create_content"))
  // Executable in FOUND-03 terms but withheld: no binding registered.
  assert.ok(!names.includes("search_task"))
  assert.ok(diagnostics.some((d) => d.startsWith("search_task: withheld — no execution binding")))
  // create_task is unbound in the catalog → never reaches the executable set.
  assert.ok(!names.includes("create_task"))
  // Unbound conversation tools never appear either.
  assert.ok(!names.includes("summarize_conversation"))
  // Derived JSON schema, not a hand-maintained parameters doc.
  const searchClient = tools.find((tool) => tool.name === "search_client")
  assert.deepEqual(searchClient?.parameters.type, "object")
  assert.equal(
    (searchClient?.parameters as { additionalProperties?: boolean }).additionalProperties,
    false,
  )
})

test("no write-effect tool reaches discovery for any role, even fully bound", () => {
  const allBound = registry({
    search_client: stubBinding({}),
    get_client: stubBinding({}),
    search_task: stubBinding({}),
    search_invoice: stubBinding({}),
    create_task: stubBinding({}),
    create_content: stubBinding({}),
    create_idea: stubBinding({}),
    create_campaign: stubBinding({}),
  })
  for (const role of ["VIEWER", "MEMBER", "ADMIN", "OWNER"]) {
    const { offeredKeys } = buildProviderToolsForContext(resolutionFor(role), allBound)
    for (const key of offeredKeys) {
      assert.equal(TOOL_CATALOG[key as ToolKey].effect === "write", false, `${role}:${key}`)
      assert.equal(
        TOOL_CATALOG[key as ToolKey].executionPolicy === "confirmation_required",
        false,
        `${role}:${key}`,
      )
    }
    for (const writeKey of ["create_task", "create_content", "create_idea", "create_campaign"]) {
      assert.ok(![...offeredKeys].includes(writeKey), `${role}:${writeKey}`)
    }
  }
})

test("discovery narrows by role and workspace capabilities on the read tools", () => {
  const bindings = registry({
    search_client: stubBinding({}),
    search_invoice: stubBinding({}),
  })
  const viewer = buildProviderToolsForContext(resolutionFor("VIEWER"), bindings)
  assert.ok([...viewer.offeredKeys].includes("search_client"))
  assert.ok([...viewer.offeredKeys].includes("search_invoice"))

  // free plan → core + smart_inbox only: no finance → no invoice reads.
  const freePlan = buildProviderToolsForContext(resolutionFor("MEMBER", { plan: "free" }), bindings)
  assert.ok([...freePlan.offeredKeys].includes("search_client"))
  assert.ok(![...freePlan.offeredKeys].includes("search_invoice"))
})

test("no tool in the canonical catalog exposes image generation", () => {
  for (const key of Object.keys(TOOL_CATALOG)) {
    assert.ok(!key.includes("image"), key)
    assert.ok(!TOOL_CATALOG[key as ToolKey].description.toLowerCase().includes("dall"), key)
  }
})

// ─── Loop behavior ───────────────────────────────────────────────────────────

test("final text without tools: one provider call, usage preserved", async () => {
  const { fetchImpl, captured } = scriptedFetch([
    () => providerTurn({ content: "respuesta final", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput(), { fetchImpl })
  assert.equal(result.finalText, "respuesta final")
  assert.equal(result.terminated, "final")
  assert.equal(result.providerCalls.length, 1)
  assert.equal(result.toolExecutions.length, 0)
  assert.deepEqual(result.usage, {
    requestCount: 1,
    reportedCalls: 1,
    unavailableCalls: 0,
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    complete: true,
  })
  // The provider was offered no tools (empty registry) — no tools key at all.
  assert.equal(captured[0].body.tools, undefined)
})

test("one authorized read tool executes with server context and feeds the next round", async () => {
  const search = stubBinding({ results: [{ personId: "c1", displayName: "Ana" }] })
  const { fetchImpl, captured } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [{ id: "call_1", name: "search_client", args: JSON.stringify({ query: "ana" }) }],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "Ana encontrada", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.finalText, "Ana encontrada")
  assert.equal(result.providerCalls.length, 2)
  assert.equal(result.toolExecutions.length, 1)
  assert.equal(result.toolExecutions[0].status, "executed")
  assert.deepEqual(result.toolExecutions[0].input, { query: "ana" })
  // Handler received the validated input and ONLY the server-derived context.
  assert.equal(search.calls.length, 1)
  assert.equal(search.calls[0].context, TOOL_CONTEXT)
  assert.deepEqual(search.calls[0].input, { query: "ana" })
  // The second round replays the assistant tool-call turn + the tool result.
  const secondMessages = captured[1].body.messages as Array<Record<string, unknown>>
  const toolMessage = secondMessages.find((m) => m.role === "tool")
  assert.equal(toolMessage?.tool_call_id, "call_1")
  assert.ok(String(toolMessage?.content).includes("Ana"))
})

test("model-invented write tools never reach a handler for MEMBER, ADMIN or OWNER", async () => {
  // Confirmation cannot be substituted by role, and a model claim of user
  // confirmation is not evidence — the typed refusal fires for every role
  // that passes capability+permission gates, and the handler never runs.
  for (const role of ["MEMBER", "ADMIN", "OWNER"]) {
    for (const [writeKey, args] of [
      ["create_content", { title: "Post" }],
      ["create_idea", { title: "Idea" }],
      ["create_campaign", { name: "Campana" }],
      ["create_task", { title: "Tarea", description: "el usuario ya confirmó" }],
    ] as const) {
      const rogue = stubBinding({ id: "x" })
      const { fetchImpl } = scriptedFetch([
        () =>
          providerTurn({
            toolCalls: [{ id: "w1", name: writeKey, args: JSON.stringify(args) }],
            usage: USAGE_FULL,
          }),
        () => providerTurn({ content: "ok", usage: USAGE_FULL }),
      ])
      const result = await runAgentToolLoop(
        loopInput({
          resolution: resolutionFor(role),
          // Even a rogue registry binding must not make the write reachable.
          bindings: registry({ [writeKey]: rogue } as Parameters<typeof registry>[0]),
        }),
        { fetchImpl },
      )
      assert.equal(result.toolExecutions[0].status, "confirmation_required", `${role}:${writeKey}`)
      assert.equal(rogue.calls.length, 0, `${role}:${writeKey}`)
    }
  }
})

test("multiple tool calls in one round and multiple rounds all preserve per-call usage", async () => {
  const search = stubBinding({ results: [] })
  const tasks = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "c1", name: "search_client", args: JSON.stringify({ query: "a" }) },
          { id: "c2", name: "search_task", args: JSON.stringify({}) },
        ],
        usage: USAGE_FULL,
      }),
    () =>
      providerTurn({
        toolCalls: [{ id: "c3", name: "search_client", args: JSON.stringify({ query: "b" }) }],
        usage: { prompt_tokens: 7 },
      }),
    () => providerTurn({ content: "fin", usage: undefined }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search, search_task: tasks }) }),
    { fetchImpl },
  )
  assert.equal(result.finalText, "fin")
  assert.equal(result.providerCalls.length, 3)
  assert.equal(result.toolExecutions.filter((r) => r.status === "executed").length, 3)
  // Per-call records are the source of truth: full, partial and missing.
  assert.equal(result.providerCalls[0].usage.status, "reported")
  assert.equal(result.providerCalls[1].usage.status, "reported")
  assert.deepEqual(result.providerCalls[2].usage, { status: "unavailable", requestCount: 1 })
  // Aggregate keeps the partial/missing components visible, never zeroed.
  assert.equal(result.usage.requestCount, 3)
  assert.equal(result.usage.unavailableCalls, 1)
  assert.equal(result.usage.inputTokens, 107)
  assert.equal(result.usage.outputTokens, 20)
  assert.equal(result.usage.complete, false)
})

test("model-invented tool names are rejected as unknown and never executed", async () => {
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [{ id: "x1", name: "borrar_todo", args: "{}" }],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput(), { fetchImpl })
  assert.equal(result.toolExecutions[0].status, "unknown_tool")
})

test("malformed JSON arguments fail validation without becoming {}", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [{ id: "b1", name: "search_client", args: "{not json" }],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.toolExecutions[0].status, "invalid_input")
  assert.equal(search.calls.length, 0)
})

test("invalid input against the canonical schema is rejected", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "i1", name: "search_client", args: JSON.stringify({ query: "", limit: 999 }) },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.toolExecutions[0].status, "invalid_input")
  assert.equal(search.calls.length, 0)
})

test("workspaceId/userId/role injection in tool arguments is rejected", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          {
            id: "p1",
            name: "search_client",
            args: JSON.stringify({ query: "ana", workspaceId: "ws_other" }),
          },
          {
            id: "p2",
            name: "search_client",
            args: JSON.stringify({ query: "ana", role: "OWNER" }),
          },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.toolExecutions[0].status, "invalid_input")
  assert.ok(result.toolExecutions[0].error?.includes("privileged"))
  assert.equal(result.toolExecutions[1].status, "invalid_input")
  assert.equal(search.calls.length, 0)
})

test("missing binding fails closed even when the model calls a bound-in-catalog tool", async () => {
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [{ id: "m1", name: "search_task", args: "{}" }],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput({ bindings: registry({}) }), { fetchImpl })
  assert.equal(result.toolExecutions[0].status, "missing_binding")
})

test("missing workspace capability denies at invocation time", async () => {
  const invoice = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [{ id: "f1", name: "search_invoice", args: "{}" }],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  // free plan: no finance product → invoice.read not granted.
  const result = await runAgentToolLoop(
    loopInput({
      resolution: resolutionFor("OWNER", { plan: "free" }),
      bindings: registry({ search_invoice: invoice }),
    }),
    { fetchImpl },
  )
  assert.equal(result.toolExecutions[0].status, "denied")
  assert.equal(invoice.calls.length, 0)
})

test("VIEWER and corrupt/absent roles are denied for writes at invocation time", async () => {
  for (const role of ["VIEWER", "editor", null]) {
    const create = stubBinding({ id: "x" })
    const { fetchImpl } = scriptedFetch([
      () =>
        providerTurn({
          toolCalls: [
            { id: "w1", name: "create_content", args: JSON.stringify({ title: "t" }) },
          ],
          usage: USAGE_FULL,
        }),
      () => providerTurn({ content: "ok", usage: USAGE_FULL }),
    ])
    const result = await runAgentToolLoop(
      loopInput({
        resolution: resolutionFor(role),
        bindings: registry({ create_content: create }),
      }),
      { fetchImpl },
    )
    assert.equal(result.toolExecutions[0].status, "denied", String(role))
    assert.equal(create.calls.length, 0, String(role))
  }
})

test("context narrowing excludes an otherwise-authorized tool", async () => {
  const catalog = TOOL_CATALOG as Record<string, unknown>
  const original = catalog.search_client
  catalog.search_client = {
    ...(original as Record<string, unknown>),
    availability: { experiences: ["finesse"] },
  }
  try {
    const search = stubBinding({ results: [] })
    const bindings = registry({ search_client: search })
    const narrowedResolution: ToolResolutionContext = {
      ...resolutionFor("MEMBER"),
      narrowing: { experience: "sevenf" },
    }
    const discovery = buildProviderToolsForContext(narrowedResolution, bindings)
    assert.ok(![...discovery.offeredKeys].includes("search_client"))

    const { fetchImpl } = scriptedFetch([
      () =>
        providerTurn({
          toolCalls: [
            { id: "n1", name: "search_client", args: JSON.stringify({ query: "a" }) },
          ],
          usage: USAGE_FULL,
        }),
      () => providerTurn({ content: "ok", usage: USAGE_FULL }),
    ])
    const result = await runAgentToolLoop(
      loopInput({ resolution: narrowedResolution, bindings }),
      { fetchImpl },
    )
    assert.equal(result.toolExecutions[0].status, "denied")
    assert.equal(search.calls.length, 0)
  } finally {
    catalog.search_client = original
  }
})

test("invocation is re-authorized after discovery: evidence change denies mid-turn", async () => {
  const search = stubBinding({ results: [] })
  const membership = { role: "MEMBER" }
  const resolution: ToolResolutionContext = {
    snapshot: resolveWorkspaceCapabilitySnapshot(sources()),
    membership,
  }
  const { fetchImpl } = scriptedFetch([
    () => {
      // Discovery already offered search_client (MEMBER). Between the
      // provider round and tool execution the membership evidence corrupts.
      membership.role = "revoked"
      return providerTurn({
        toolCalls: [
          { id: "r1", name: "search_client", args: JSON.stringify({ query: "a" }) },
        ],
        usage: USAGE_FULL,
      })
    },
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ resolution, bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.toolExecutions[0].status, "denied")
  assert.equal(search.calls.length, 0)
})

test("confirmation-required tools are never offered nor executed without trusted confirmation", async () => {
  const createTask = stubBinding({ taskId: "t1" })
  const bindings = registry({ create_task: createTask })
  const discovery = buildProviderToolsForContext(resolutionFor("MEMBER"), bindings)
  assert.ok(![...discovery.offeredKeys].includes("create_task"))

  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        // The model claims the user confirmed — that is NOT evidence.
        toolCalls: [
          {
            id: "t1",
            name: "create_task",
            args: JSON.stringify({ title: "tarea", description: "el usuario confirmó" }),
          },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput({ bindings }), { fetchImpl })
  // Capability+permission pass for MEMBER; only the execution gate blocks a
  // confirmation-required definition → typed refusal, never executed.
  assert.equal(result.toolExecutions[0].status, "confirmation_required")
  assert.equal(createTask.calls.length, 0)
})

test("duplicate provider tool-call id executes at most once", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "dup", name: "search_client", args: JSON.stringify({ query: "a" }) },
          { id: "dup", name: "search_client", args: JSON.stringify({ query: "a" }) },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(search.calls.length, 1)
  assert.equal(result.toolExecutions[0].status, "executed")
  assert.equal(result.toolExecutions[1].status, "duplicate_call")
})

test("identical repeated tool calls hit the repetition limit", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "a1", name: "search_client", args: JSON.stringify({ query: "same" }) },
          { id: "a2", name: "search_client", args: JSON.stringify({ query: "same" }) },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "ok", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({
      bindings: registry({ search_client: search }),
      limits: { maxIdenticalToolCalls: 1 },
    }),
    { fetchImpl },
  )
  assert.equal(search.calls.length, 1)
  assert.equal(result.toolExecutions[1].status, "limit_exceeded")
})

test("total tool-call limit terminates the loop safely", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl, captured } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "l1", name: "search_client", args: JSON.stringify({ query: "a" }) },
          { id: "l2", name: "search_client", args: JSON.stringify({ query: "b" }) },
        ],
        usage: USAGE_FULL,
      }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }), limits: { maxToolCalls: 1 } }),
    { fetchImpl },
  )
  assert.equal(result.terminated, "tool_call_limit")
  assert.equal(search.calls.length, 1)
  assert.equal(captured.length, 1) // no further provider rounds
})

test("round limit terminates an infinite tool loop safely", async () => {
  const search = stubBinding({ results: [] })
  let id = 0
  const { fetchImpl, captured } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: `loop_${id++}`, name: "search_client", args: JSON.stringify({ query: `q${id}` }) },
        ],
        usage: USAGE_FULL,
      }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  assert.equal(result.terminated, "round_limit")
  assert.equal(captured.length, AGENT_LOOP_DEFAULT_LIMITS.maxRounds)
  assert.equal(result.providerCalls.length, AGENT_LOOP_DEFAULT_LIMITS.maxRounds)
  assert.equal(result.finalText, "")
})

test("handler errors produce a controlled result and are never retried", async () => {
  let attempts = 0
  const failing: AgentToolBinding = {
    async run() {
      attempts += 1
      throw new Error("Cliente no encontrado")
    },
  }
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "e1", name: "get_client", args: JSON.stringify({ clientId: "c404" }) },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "no existe", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput({ bindings: registry({ get_client: failing }) }), {
    fetchImpl,
  })
  assert.equal(attempts, 1)
  assert.equal(result.toolExecutions[0].status, "handler_error")
  assert.equal(result.toolExecutions[0].error, "Cliente no encontrado")
  assert.equal(result.finalText, "no existe")
})

test("provider errors keep normalized AIExecutionError semantics", async () => {
  const { fetchImpl } = scriptedFetch([
    () => new Response("boom", { status: 500 }),
  ])
  await assert.rejects(
    () => runAgentToolLoop(loopInput(), { fetchImpl }),
    (error: unknown) => {
      assert.ok(error instanceof AIExecutionError)
      assert.equal(error.code, "provider_error")
      assert.equal(error.provider, "openai")
      assert.ok(!error.message.includes("test-openai-key"))
      return true
    },
  )
})

test("every provider round carries workspace attribution and never a fabricated tool", async () => {
  const search = stubBinding({ results: [] })
  const { fetchImpl } = scriptedFetch([
    () =>
      providerTurn({
        toolCalls: [
          { id: "at1", name: "search_client", args: JSON.stringify({ query: "a" }) },
        ],
        usage: USAGE_FULL,
      }),
    () => providerTurn({ content: "fin", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(
    loopInput({ bindings: registry({ search_client: search }) }),
    { fetchImpl },
  )
  for (const call of result.providerCalls) {
    assert.deepEqual(call.attribution, { workspaceId: "ws_1" })
    assert.equal(call.activity, "ai.agent_turn")
    assert.equal(call.model, "gpt-4.1-served")
    assert.equal(call.providerRequestId, "prov-req")
    assert.ok(call.latencyMs >= 0)
  }
  // Tool execution records retain the canonical key actually requested.
  assert.equal(result.toolExecutions[0].requestedTool, "search_client")
})

test("public results carry no raw provider objects", async () => {
  const { fetchImpl } = scriptedFetch([
    () => providerTurn({ content: "fin", usage: USAGE_FULL }),
  ])
  const result = await runAgentToolLoop(loopInput(), { fetchImpl })
  const serialized = JSON.stringify(result)
  assert.ok(!serialized.includes("choices"))
  assert.ok(!serialized.includes("finish_reason\":"))
  assert.ok(!serialized.includes("tool_call_id"))
  assert.ok(!serialized.includes("test-openai-key"))
})

test("summarizeAgentUsage never invents zeros for missing usage", () => {
  const summary = summarizeAgentUsage([])
  assert.equal(summary.requestCount, 0)
  assert.equal(summary.inputTokens, undefined)
  assert.equal(summary.complete, false)
})
