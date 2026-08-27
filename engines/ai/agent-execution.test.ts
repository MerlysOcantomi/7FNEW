import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"
import { TOOL_CATALOG } from "@core/platform/tool-catalog"
import {
  normalizeWireToolCalls,
  toWireMessage,
  toWireTools,
} from "./chat-adapter"
import { executeAI, executeAIToolTurn } from "./execution"
import {
  AIExecutionError,
  type AIAgentMessage,
  type AIProviderToolDefinition,
} from "./execution-contract"
import { toolInputJsonSchema, ToolSchemaConversionError } from "./tool-schema"

process.env.OPENAI_API_KEY = "test-openai-key"

const TOOLS: AIProviderToolDefinition[] = [
  {
    name: "search_client",
    description: "Search clients",
    parameters: { type: "object", properties: { query: { type: "string" } } },
  },
]

interface CapturedCall {
  url: string
  body: Record<string, unknown>
}

function mockFetch(
  handler: (call: CapturedCall) => Response,
): { fetchImpl: typeof fetch; captured: CapturedCall[] } {
  const captured: CapturedCall[] = []
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const call: CapturedCall = { url: String(url), body: JSON.parse(String(init?.body ?? "{}")) }
    captured.push(call)
    return handler(call)
  }) as typeof fetch
  return { fetchImpl, captured }
}

function ok(payload: Record<string, unknown>, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

// ─── Wire serialization (adapter-internal, provider-shaped) ──────────────────

test("provider tool definitions and agent messages serialize to the OpenAI-compatible shape", () => {
  assert.deepEqual(toWireTools(TOOLS), [
    {
      type: "function",
      function: {
        name: "search_client",
        description: "Search clients",
        parameters: { type: "object", properties: { query: { type: "string" } } },
      },
    },
  ])

  const assistant: AIAgentMessage = {
    role: "assistant",
    content: "",
    toolCalls: [{ id: "c1", name: "search_client", rawArguments: '{"query":"ana"}' }],
  }
  assert.deepEqual(toWireMessage(assistant), {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "c1",
        type: "function",
        function: { name: "search_client", arguments: '{"query":"ana"}' },
      },
    ],
  })
  assert.deepEqual(toWireMessage({ role: "tool", toolCallId: "c1", content: "{}" }), {
    role: "tool",
    tool_call_id: "c1",
    content: "{}",
  })
  // Plain chat messages keep their exact legacy wire shape.
  assert.deepEqual(toWireMessage({ role: "user", content: "hola" }), {
    role: "user",
    content: "hola",
  })
})

test("normalizeWireToolCalls maps well-formed calls and fails closed on malformed ones", () => {
  assert.deepEqual(
    normalizeWireToolCalls(
      [
        { id: "a", type: "function", function: { name: "t", arguments: "{}" } },
        { id: "b", type: "function", function: { name: "u", arguments: 42 } },
      ],
      "openai",
    ),
    [
      { id: "a", name: "t", rawArguments: "{}" },
      // Non-string arguments degrade to "" (still untrusted, still validated
      // downstream) — id/name violations, by contrast, fail the response:
      { id: "b", name: "u", rawArguments: "" },
    ],
  )
  assert.deepEqual(normalizeWireToolCalls(undefined, "openai"), [])
  assert.throws(
    () => normalizeWireToolCalls([{ function: { name: "x" } }], "openai"),
    (error: unknown) => error instanceof AIExecutionError && error.code === "invalid_output",
  )
  assert.throws(
    () => normalizeWireToolCalls("nope", "openai"),
    (error: unknown) => error instanceof AIExecutionError && error.code === "invalid_output",
  )
})

// ─── executeAIToolTurn (one provider round, normalized) ──────────────────────

test("assistant response without tool calls normalizes content and metadata", async () => {
  const { fetchImpl, captured } = mockFetch(() =>
    ok(
      {
        model: "gpt-4.1-actual",
        choices: [{ message: { content: "hola" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      },
      { "x-request-id": "req-77" },
    ),
  )
  const result = await executeAIToolTurn(
    { messages: [{ role: "user", content: "x" }], tools: TOOLS, provider: "openai" },
    { fetchImpl },
  )
  assert.equal(result.output.content, "hola")
  assert.deepEqual(result.output.toolCalls, [])
  assert.equal(result.provider, "openai")
  assert.equal(result.model, "gpt-4.1-actual")
  assert.equal(result.finishReason, "stop")
  assert.equal(result.providerRequestId, "req-77")
  assert.ok(result.latencyMs >= 0)
  assert.equal(result.usage.status, "reported")
  // The offered tools reached the wire with tool_choice auto.
  assert.equal((captured[0].body.tools as unknown[]).length, 1)
  assert.equal(captured[0].body.tool_choice, "auto")
})

test("tool-call rounds normalize one or many calls with empty content allowed", async () => {
  const { fetchImpl } = mockFetch(() =>
    ok({
      model: "gpt-4.1",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "search_client", arguments: "{}" } },
              { id: "c2", type: "function", function: { name: "search_task", arguments: "{}" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    }),
  )
  const result = await executeAIToolTurn(
    { messages: [{ role: "user", content: "x" }], tools: TOOLS, provider: "openai" },
    { fetchImpl },
  )
  assert.equal(result.output.content, "")
  assert.equal(result.output.toolCalls.length, 2)
  assert.equal(result.finishReason, "tool_calls")
  // Missing usage stays explicit — never zero.
  assert.deepEqual(result.usage, { status: "unavailable", requestCount: 1 })
})

test("partial usage keeps missing numbers undefined on tool turns", async () => {
  const { fetchImpl } = mockFetch(() =>
    ok({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 11 },
    }),
  )
  const result = await executeAIToolTurn(
    { messages: [{ role: "user", content: "x" }], tools: [], provider: "openai" },
    { fetchImpl },
  )
  assert.equal(result.usage.status, "reported")
  if (result.usage.status === "reported") {
    assert.equal(result.usage.inputTokens, 11)
    assert.equal(result.usage.outputTokens, undefined)
  }
})

test("a malformed tool_calls payload fails as invalid_output, never half-parsed", async () => {
  const { fetchImpl } = mockFetch(() =>
    ok({
      choices: [
        { message: { content: null, tool_calls: [{ bogus: true }] }, finish_reason: "tool_calls" },
      ],
    }),
  )
  await assert.rejects(
    () =>
      executeAIToolTurn(
        { messages: [{ role: "user", content: "x" }], tools: TOOLS, provider: "openai" },
        { fetchImpl },
      ),
    (error: unknown) => error instanceof AIExecutionError && error.code === "invalid_output",
  )
})

test("the public result exposes no raw provider completion object", async () => {
  const { fetchImpl } = mockFetch(() =>
    ok({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "t", arguments: "{}" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    }),
  )
  const result = await executeAIToolTurn(
    { messages: [{ role: "user", content: "x" }], tools: TOOLS, provider: "openai" },
    { fetchImpl },
  )
  const serialized = JSON.stringify(result)
  assert.ok(!serialized.includes("choices"))
  assert.ok(!serialized.includes("tool_call_id"))
  assert.ok(!serialized.includes('"function"'))
})

test("existing string callers keep their exact request body (no tool fields)", async () => {
  const { fetchImpl, captured } = mockFetch(() =>
    ok({ choices: [{ message: { content: "hola" }, finish_reason: "stop" }] }),
  )
  const result = await executeAI(
    { provider: "openai", messages: [{ role: "user", content: "x" }] },
    { fetchImpl },
  )
  assert.equal(result.output, "hola")
  assert.deepEqual(Object.keys(captured[0].body).sort(), [
    "max_tokens",
    "messages",
    "model",
    "temperature",
  ])
})

// ─── Canonical zod → JSON Schema (derived, fail-closed) ──────────────────────

test("canonical catalog input schemas convert to strict JSON Schema", () => {
  const schema = toolInputJsonSchema(TOOL_CATALOG.search_client.inputSchema)
  assert.equal(schema.type, "object")
  assert.deepEqual(schema.required, ["query"])
  assert.equal(schema.additionalProperties, false)
  const properties = schema.properties as Record<string, Record<string, unknown>>
  assert.equal(properties.query.type, "string")
  assert.equal(properties.limit.type, "integer")

  const content = toolInputJsonSchema(TOOL_CATALOG.create_content.inputSchema)
  const contentProps = content.properties as Record<string, Record<string, unknown>>
  assert.ok(Array.isArray(contentProps.platform.enum))
  assert.deepEqual((content.required as string[]), ["title"])

  const task = toolInputJsonSchema(TOOL_CATALOG.search_task.inputSchema)
  assert.equal(task.required, undefined)
  const taskProps = task.properties as Record<string, Record<string, unknown>>
  assert.equal(taskProps.overdue.type, "boolean")
})

test("every AI-06 offered tool schema is convertible (no silent omission drift)", () => {
  for (const key of [
    "search_client",
    "get_client",
    "search_task",
    "search_invoice",
    "create_content",
    "create_idea",
    "create_campaign",
  ] as const) {
    assert.doesNotThrow(() => toolInputJsonSchema(TOOL_CATALOG[key].inputSchema), key)
  }
})

test("unsupported schema constructs fail closed", () => {
  assert.throws(
    () => toolInputJsonSchema(z.string()),
    (error: unknown) => error instanceof ToolSchemaConversionError,
  )
  assert.throws(
    () => toolInputJsonSchema(z.object({ weird: z.map(z.string(), z.string()) })),
    (error: unknown) => error instanceof ToolSchemaConversionError,
  )
})
