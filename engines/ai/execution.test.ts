import assert from "node:assert/strict"
import test from "node:test"
import {
  AIExecutionError,
  buildMotorIAHistoryRequest,
  buildMotorIARequest,
  executeAI,
  NEUTRAL_TASK_SYSTEM_PROMPT,
  resolveProviderForRequest,
} from "./index"
import { normalizeChatUsage } from "./chat-adapter"
import { getMode } from "./modes"

process.env.OPENAI_API_KEY = "test-openai-key"
process.env.DEEPSEEK_API_KEY = "test-deepseek-key"

interface CapturedCall {
  url: string
  body: Record<string, unknown>
  headers: Record<string, string>
}

function mockFetch(
  handler: (call: CapturedCall) => Response | Promise<Response>,
  captured: CapturedCall[] = [],
): { fetchImpl: typeof fetch; captured: CapturedCall[] } {
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const call: CapturedCall = {
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
      headers: (init?.headers ?? {}) as Record<string, string>,
    }
    captured.push(call)
    return handler(call)
  }) as typeof fetch
  return { fetchImpl, captured }
}

function okResponse(payload: Record<string, unknown>, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

const BASIC_CHOICE = { message: { content: "  respuesta  " }, finish_reason: "stop" }

// ─── Usage normalization (AI-03, the core of FOUND-02b) ──────────────────────

test("usage is normalized with every reported field", async () => {
  const { fetchImpl } = mockFetch(() =>
    okResponse({
      model: "deepseek-reasoner",
      choices: [BASIC_CHOICE],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 100 },
        completion_tokens_details: { reasoning_tokens: 12 },
      },
    }),
  )
  const result = await executeAI(
    { mode: "operativo", messages: [{ role: "user", content: "hola" }] },
    { fetchImpl },
  )
  assert.deepEqual(result.usage, {
    status: "reported",
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    cachedInputTokens: 100,
    reasoningTokens: 12,
    requestCount: 1,
  })
  assert.equal(result.output, "respuesta")
  assert.equal(result.finishReason, "stop")
  assert.ok(result.latencyMs >= 0)
})

test("missing usage is preserved as explicit unavailable, never zeros", async () => {
  const { fetchImpl } = mockFetch(() => okResponse({ choices: [BASIC_CHOICE] }))
  const result = await executeAI(
    { provider: "openai", messages: [{ role: "user", content: "x" }] },
    { fetchImpl },
  )
  assert.deepEqual(result.usage, { status: "unavailable", requestCount: 1 })
})

test("partially reported usage keeps missing numbers undefined, not 0", () => {
  const usage = normalizeChatUsage({ prompt_tokens: 10 })
  assert.equal(usage.status, "reported")
  if (usage.status === "reported") {
    assert.equal(usage.inputTokens, 10)
    assert.equal(usage.outputTokens, undefined)
    assert.equal(usage.totalTokens, undefined)
  }
})

// ─── Provider / model mapping ────────────────────────────────────────────────

test("mode routing preserved: operativo→deepseek, others→openai; explicit provider wins", () => {
  assert.equal(resolveProviderForRequest({ mode: "operativo", messages: [] }), "deepseek")
  assert.equal(resolveProviderForRequest({ mode: "editorial", messages: [] }), "openai")
  assert.equal(resolveProviderForRequest({ messages: [] }), "openai")
  assert.equal(
    resolveProviderForRequest({ mode: "editorial", provider: "deepseek", messages: [] }),
    "deepseek",
  )
})

test("result reports the model the provider actually served", async () => {
  const { fetchImpl } = mockFetch(() =>
    okResponse({ model: "gpt-4.1-2025-actual", choices: [BASIC_CHOICE] }),
  )
  const result = await executeAI(
    { provider: "openai", messages: [{ role: "user", content: "x" }] },
    { fetchImpl },
  )
  assert.equal(result.provider, "openai")
  assert.equal(result.model, "gpt-4.1-2025-actual")
})

test("providerRequestId is captured from the response header when present", async () => {
  const { fetchImpl } = mockFetch(() =>
    okResponse({ choices: [BASIC_CHOICE] }, { "x-request-id": "req_123" }),
  )
  const result = await executeAI(
    { provider: "openai", messages: [{ role: "user", content: "x" }] },
    { fetchImpl },
  )
  assert.equal(result.providerRequestId, "req_123")
})

// ─── Attribution propagation (AI-01) ─────────────────────────────────────────

test("activity and attribution propagate to the result untouched", async () => {
  const { fetchImpl } = mockFetch(() => okResponse({ choices: [BASIC_CHOICE] }))
  const result = await executeAI(
    {
      mode: "operativo",
      messages: [{ role: "user", content: "x" }],
      activity: "ai.message_classification",
      attribution: { workspaceId: "ws_1", product: "smart_inbox" },
    },
    { fetchImpl },
  )
  assert.equal(result.activity, "ai.message_classification")
  assert.deepEqual(result.attribution, { workspaceId: "ws_1", product: "smart_inbox" })
})

// ─── Legacy request parity (askMotorIA wrappers) ─────────────────────────────

test("operativo request parity: neutral prompt, deepseek-reasoner, legacy sampling", async () => {
  const { fetchImpl, captured } = mockFetch(() =>
    okResponse({ model: "deepseek-reasoner", choices: [BASIC_CHOICE] }),
  )
  const request = buildMotorIARequest("clasifica esto", "operativo")
  await executeAI(request, { fetchImpl })
  assert.equal(captured[0].url, "https://api.deepseek.com/v1/chat/completions")
  assert.deepEqual(captured[0].body, {
    model: "deepseek-reasoner",
    messages: [
      { role: "system", content: NEUTRAL_TASK_SYSTEM_PROMPT },
      { role: "user", content: "clasifica esto" },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  })
})

test("mode request parity: mode system prompt, gpt-4.1, mode sampling", async () => {
  const { fetchImpl, captured } = mockFetch(() => okResponse({ choices: [BASIC_CHOICE] }))
  const editorial = getMode("editorial")
  await executeAI(buildMotorIARequest("texto", "editorial"), { fetchImpl })
  assert.equal(captured[0].url, "https://api.openai.com/v1/chat/completions")
  assert.deepEqual(captured[0].body, {
    model: "gpt-4.1",
    messages: [
      { role: "system", content: editorial.systemPrompt },
      { role: "user", content: "texto" },
    ],
    temperature: editorial.temperature,
    max_tokens: editorial.maxTokens,
  })
})

test("history parity: operativo keeps only the last user message (legacy quirk)", () => {
  const request = buildMotorIAHistoryRequest(
    [
      { role: "user", content: "primera" },
      { role: "assistant", content: "resp" },
      { role: "user", content: "última" },
    ],
    "operativo",
  )
  assert.deepEqual(request.messages, [
    { role: "system", content: NEUTRAL_TASK_SYSTEM_PROMPT },
    { role: "user", content: "última" },
  ])
})

test("history parity: non-operativo prepends mode prompt and drops caller system messages", () => {
  const request = buildMotorIAHistoryRequest(
    [
      { role: "system", content: "inyectado" },
      { role: "user", content: "hola" },
    ],
    "general",
  )
  assert.equal(request.messages[0].content, getMode("general").systemPrompt)
  assert.equal(request.messages.length, 2)
  assert.equal(request.messages[1].content, "hola")
})

// ─── Error normalization (no secrets, legacy message parity) ─────────────────

test("http 429 normalizes to provider_rate_limited", async () => {
  const { fetchImpl } = mockFetch(() => new Response("busy", { status: 429 }))
  await assert.rejects(
    executeAI({ provider: "openai", messages: [{ role: "user", content: "x" }] }, { fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof AIExecutionError)
      assert.equal(err.code, "provider_rate_limited")
      assert.equal(err.status, 429)
      return true
    },
  )
})

test("http errors keep the legacy message shapes (openai hides body, deepseek includes it)", async () => {
  const { fetchImpl } = mockFetch(() => new Response("provider detail", { status: 500 }))
  await assert.rejects(
    executeAI({ provider: "openai", messages: [{ role: "user", content: "x" }] }, { fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof AIExecutionError)
      assert.equal(err.message, "OpenAI API error (500)")
      return true
    },
  )
  const { fetchImpl: dsFetch } = mockFetch(() => new Response("provider detail", { status: 500 }))
  await assert.rejects(
    executeAI({ provider: "deepseek", messages: [{ role: "user", content: "x" }] }, { fetchImpl: dsFetch }),
    (err: unknown) => {
      assert.ok(err instanceof AIExecutionError)
      assert.equal(err.message, "DeepSeek API error (500): provider detail")
      return true
    },
  )
})

test("network failure normalizes to provider_unavailable", async () => {
  const fetchImpl = (async () => {
    throw new Error("socket hang up")
  }) as typeof fetch
  await assert.rejects(
    executeAI({ provider: "openai", messages: [{ role: "user", content: "x" }] }, { fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof AIExecutionError)
      assert.equal(err.code, "provider_unavailable")
      return true
    },
  )
})

test("empty content normalizes to invalid_output with the legacy message", async () => {
  const { fetchImpl } = mockFetch(() => okResponse({ choices: [{ message: { content: "" } }] }))
  await assert.rejects(
    executeAI({ provider: "openai", messages: [{ role: "user", content: "x" }] }, { fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof AIExecutionError)
      assert.equal(err.code, "invalid_output")
      assert.equal(err.message, "OpenAI devolvio respuesta vacia")
      return true
    },
  )
})

test("no error message ever contains the API key", async () => {
  const cases: Array<() => Response> = [
    () => new Response("body", { status: 500 }),
    () => okResponse({ choices: [{ message: { content: "" } }] }),
  ]
  for (const make of cases) {
    const { fetchImpl } = mockFetch(make)
    try {
      await executeAI(
        { provider: "openai", messages: [{ role: "user", content: "x" }] },
        { fetchImpl },
      )
      assert.fail("expected rejection")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      assert.ok(!message.includes("test-openai-key"))
      assert.ok(!message.includes("test-deepseek-key"))
    }
  }
})

test("the API key is sent in the Authorization header, and only there", async () => {
  const { fetchImpl, captured } = mockFetch(() => okResponse({ choices: [BASIC_CHOICE] }))
  await executeAI({ provider: "openai", messages: [{ role: "user", content: "x" }] }, { fetchImpl })
  assert.equal(captured[0].headers.Authorization, "Bearer test-openai-key")
  assert.ok(!JSON.stringify(captured[0].body).includes("test-openai-key"))
})
