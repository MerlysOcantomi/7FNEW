import assert from "node:assert/strict"
import test from "node:test"
import { DatabaseSync } from "node:sqlite"
import { normalizeMessageId, parseReferencesHeader } from "./email-inbound"

/**
 * NEON-01 R1 — regression contract for the four `metadata: { contains: … }`
 * lookups in `modules/inbox/email-inbound.ts`.
 *
 * WHAT IS BEING PINNED
 * --------------------
 * Ingestion persists `Message.metadata` as a JSON string carrying the RFC
 * headers with their ORIGINAL casing (`emailMessageId`, `inReplyTo`,
 * `references` — see the `buildMessageMetadata` hook). The threading and
 * duplicate lookups, however, search with `normalizeMessageId()`, which strips
 * the angle brackets and LOWER-CASES the id. They match today only because
 * SQLite's `LIKE` (what Prisma's `contains` compiles to on SQLite) is
 * case-insensitive for ASCII. Real-world Message-IDs are mixed-case
 * (Gmail: `<CAB+…@mail.gmail.com>`, Outlook: `<AM0PR…@…outlook.com>`), so a
 * case-SENSITIVE `contains` (PostgreSQL default) would silently break:
 *   1. In-Reply-To threading           (matchConversationByThread, lookup 1)
 *   2. References threading            (matchConversationByThread, lookup 2)
 *   4. duplicate detection by Message-ID (findWorkspaceScopedDuplicate, lookup 4)
 * Lookup 3 (historical `sourceId` fallback) searches the persisted `sourceId`
 * VERBATIM — no normalisation on either side — and is pinned separately.
 *
 * The SQL below is the literal SQLite shape Prisma emits for `contains`
 * (`LIKE '%…%'`); the case-sensitive control uses `instr()` to show what a
 * case-sensitive engine would return for the same data. No Prisma client,
 * no network, no env.
 */

const RAW_MESSAGE_ID = "<CAB+7Fx9KqZ_Mixed.Case@mail.Example.COM>"
const RAW_REFERENCES = "<First.Ref@Example.com> <CAB+7Fx9KqZ_Mixed.Case@mail.Example.COM>"
const SOURCE_ID = "imap:ckx7conn01:4711" // `imap:<connectionId>:<uid>` — built lower-case by imap-sync.ts

/** Mirrors the pipeline's persisted metadata: `source`/`sourceId` + the email hook's fields, verbatim. */
function persistedMetadata(): string {
  return JSON.stringify({
    source: "email",
    sourceId: SOURCE_ID,
    emailMessageId: RAW_MESSAGE_ID,
    emailFrom: "Sender <sender@example.com>",
    emailTo: ["inbox@example.com"],
    emailCc: [],
    emailSubject: "Re: Mixed case",
    inReplyTo: null,
    references: RAW_REFERENCES,
  })
}

function openFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`CREATE TABLE "Message" ("id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "direction" TEXT NOT NULL, "metadata" TEXT)`)
  db.prepare(`INSERT INTO "Message" VALUES (?, ?, ?, ?)`).run("m1", "ws", "inbound", persistedMetadata())
  return db
}

/** Prisma `contains` on SQLite → `LIKE '%value%'` (ASCII case-insensitive). */
function likeContains(db: DatabaseSync, needle: string): number {
  return (db.prepare(`SELECT COUNT(*) c FROM "Message" WHERE "workspaceId" = ? AND "metadata" LIKE '%' || ? || '%'`).get("ws", needle) as { c: number }).c
}

/** Case-sensitive control (what a case-sensitive `contains` would do). */
function caseSensitiveContains(db: DatabaseSync, needle: string): number {
  return (db.prepare(`SELECT COUNT(*) c FROM "Message" WHERE "workspaceId" = ? AND instr("metadata", ?) > 0`).get("ws", needle) as { c: number }).c
}

test("normalizeMessageId strips angle brackets, trims and LOWER-CASES; the persisted header keeps its casing", () => {
  const normalized = normalizeMessageId(RAW_MESSAGE_ID)
  assert.equal(normalized, "cab+7fx9kqz_mixed.case@mail.example.com")
  assert.notEqual(normalized, RAW_MESSAGE_ID.slice(1, -1))
  assert.ok(persistedMetadata().includes(RAW_MESSAGE_ID), "metadata persists the original casing")
  assert.ok(!persistedMetadata().includes(normalized), "metadata does NOT contain the lower-cased form")
})

test("parseReferencesHeader normalises every id (lower-case) and returns them newest-first", () => {
  assert.deepEqual(parseReferencesHeader(RAW_REFERENCES), [
    "cab+7fx9kqz_mixed.case@mail.example.com",
    "first.ref@example.com",
  ])
  assert.deepEqual(parseReferencesHeader("  <Single.Ref@Example.com>  "), ["single.ref@example.com"])
  assert.deepEqual(parseReferencesHeader(null), [])
})

test("lookups 1, 2 and 4 (In-Reply-To / References / duplicate Message-ID) match ONLY because contains is case-insensitive today", () => {
  const db = openFixture()
  try {
    const inReplyTo = normalizeMessageId(RAW_MESSAGE_ID) // lookup 1
    const [newestRef] = parseReferencesHeader(RAW_REFERENCES) // lookup 2
    const duplicate = normalizeMessageId(RAW_MESSAGE_ID) // lookup 4
    for (const needle of [inReplyTo, newestRef, duplicate]) {
      assert.equal(likeContains(db, needle), 1, `current (SQLite LIKE) semantics must match: ${needle}`)
      assert.equal(caseSensitiveContains(db, needle), 0, `a case-sensitive contains would MISS: ${needle}`)
    }
    // Contract to preserve on PostgreSQL (NEON-02): the same needles must still match.
  } finally {
    db.close()
  }
})

test("lookup 3 (historical sourceId fallback) matches the persisted sourceId verbatim, with no normalisation on either side", () => {
  const db = openFixture()
  try {
    assert.equal(likeContains(db, SOURCE_ID), 1)
    assert.equal(caseSensitiveContains(db, SOURCE_ID), 1, "verbatim match holds even case-sensitively")
    // The historical behaviour ALSO tolerates a differently-cased needle on SQLite;
    // whether PostgreSQL must keep that tolerance is a separate NEON-02 decision.
    assert.equal(likeContains(db, SOURCE_ID.toUpperCase()), 1)
    assert.equal(caseSensitiveContains(db, SOURCE_ID.toUpperCase()), 0)
  } finally {
    db.close()
  }
})
