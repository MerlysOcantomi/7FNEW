import assert from "node:assert/strict"
import test from "node:test"
import { mintEphemeralClientSecret, MintError, type MintParams } from "./mint"

/** Build a fake fetch that captures the request and returns a canned response. */
function fakeFetch(
  response: { ok: boolean; status?: number; json?: unknown },
  capture?: (url: string, init: RequestInit) => void,
): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    capture?.(String(url), init ?? {})
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.json,
    } as Response
  }) as unknown as typeof fetch
}

const BASE: Omit<MintParams, "fetchImpl"> = {
  apiKey: "sk-secret-should-never-leak",
  model: "gpt-realtime-2.1",
  voice: "marin",
  instructions: "Solo negocio de belleza.",
  ttlSeconds: 45,
  safetyIdentifier: "anon_hash_abc",
}

test("normalizes { value, expires_at } → { clientSecret, expiresAt }", async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    json: { value: "ek_test_123", expires_at: 1893456000, session: { type: "realtime" } },
  })
  const cred = await mintEphemeralClientSecret({ ...BASE, fetchImpl })
  assert.deepEqual(cred, { clientSecret: "ek_test_123", expiresAt: 1893456000 })
  // We never surface a raw `client_secret` field.
  assert.ok(!("client_secret" in cred))
})

test("sends the API key as a Bearer header and an anonymized safety identifier", async () => {
  let seenUrl = ""
  let seenInit: RequestInit = {}
  const fetchImpl = fakeFetch(
    { ok: true, json: { value: "ek_x", expires_at: 1 } },
    (url, init) => {
      seenUrl = url
      seenInit = init
    },
  )
  await mintEphemeralClientSecret({ ...BASE, fetchImpl })

  assert.equal(seenUrl, "https://api.openai.com/v1/realtime/client_secrets")
  assert.equal(seenInit.method, "POST")
  const headers = seenInit.headers as Record<string, string>
  assert.equal(headers.Authorization, "Bearer sk-secret-should-never-leak")
  assert.equal(headers["OpenAI-Safety-Identifier"], "anon_hash_abc")

  const body = JSON.parse(String(seenInit.body))
  assert.equal(body.session.type, "realtime")
  assert.equal(body.session.model, "gpt-realtime-2.1")
  assert.equal(body.session.audio.output.voice, "marin")
  assert.equal(body.session.audio.input.transcription.model, "gpt-4o-mini-transcribe")
  assert.equal(body.expires_after.seconds, 45)
})

test("throws MintError (no body echoed) on a non-OK response", async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 401, json: { error: "leaky" } })
  await assert.rejects(
    () => mintEphemeralClientSecret({ ...BASE, fetchImpl }),
    (err: unknown) => err instanceof MintError && !/leaky/.test((err as Error).message),
  )
})

test("throws on an unexpected response shape", async () => {
  const fetchImpl = fakeFetch({ ok: true, json: { nope: true } })
  await assert.rejects(() => mintEphemeralClientSecret({ ...BASE, fetchImpl }), MintError)
})
