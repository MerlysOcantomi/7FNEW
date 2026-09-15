import assert from "node:assert/strict"
import test from "node:test"
import type { Prisma } from "@/generated/prisma/client"
import { searchContains, searchStartsWith, structuredContains } from "./db-search"

/**
 * NEON-01 / R1 / NEON-03 — the helpers are the ONE place that decides how a
 * text filter becomes a Prisma string filter on the PostgreSQL provider. Free-
 * text search is case-insensitive (`mode: "insensitive"`); structured filters
 * declare their semantics at the call site and never inherit search semantics
 * by accident. Behaviour against a real PostgreSQL is pinned by
 * `core/db-search.postgres.integration.test.ts`.
 */

test("searchContains is a case-insensitive contains filter, value untouched", () => {
  assert.deepEqual(searchContains("Acme"), { contains: "Acme", mode: "insensitive" })
  assert.deepEqual(searchContains("  spaced  "), { contains: "  spaced  ", mode: "insensitive" })
  assert.deepEqual(Object.keys(searchContains("x")).sort(), ["contains", "mode"])
})

test("searchStartsWith is a case-insensitive startsWith filter", () => {
  assert.deepEqual(searchStartsWith("CLI-"), { startsWith: "CLI-", mode: "insensitive" })
  assert.deepEqual(Object.keys(searchStartsWith("x")).sort(), ["mode", "startsWith"])
})

test("structuredContains requires the semantics: identifiers compare exactly, text is case-insensitive", () => {
  assert.deepEqual(structuredContains("PRJ-007", "identifier"), { contains: "PRJ-007" })
  assert.deepEqual(Object.keys(structuredContains("x", "identifier")), ["contains"])
  assert.deepEqual(structuredContains("Ana R.", "text"), { contains: "Ana R.", mode: "insensitive" })
  assert.equal(structuredContains.length, 2, "the semantics argument is mandatory")
})

test("free-text search and structured filters are separate functions (the classification boundary)", () => {
  assert.notStrictEqual(searchContains, structuredContains)
  assert.equal(searchContains.name, "searchContains")
  assert.equal(structuredContains.name, "structuredContains")
})

test("helpers type-check as Prisma string filters (required and nullable) on the PostgreSQL provider", () => {
  // Compile-time assertions: these assignments fail `tsc` if a helper shape
  // ever stops being a valid Prisma filter for the active provider — no casts.
  const required: Prisma.StringFilter = searchContains("a")
  const nullable: Prisma.StringNullableFilter = searchContains("b")
  const prefix: Prisma.StringFilter = searchStartsWith("c")
  const identifier: Prisma.StringNullableFilter = structuredContains("d", "identifier")
  const text: Prisma.StringNullableFilter = structuredContains("e", "text")
  const where: Prisma.ProyectoWhereInput = {
    AND: [
      { OR: [{ nombre: searchContains("a") }, { descripcion: searchContains("a") }] },
      { customId: structuredContains("PRJ-", "identifier") },
      { tags: structuredContains("urgent", "text") },
    ],
  }
  assert.equal(required.contains, "a")
  assert.equal(required.mode, "insensitive")
  assert.equal(nullable.contains, "b")
  assert.equal(prefix.startsWith, "c")
  assert.equal(identifier.contains, "d")
  assert.equal(identifier.mode, undefined)
  assert.equal(text.mode, "insensitive")
  assert.equal(where.AND && Array.isArray(where.AND) ? where.AND.length : 0, 3)
})
