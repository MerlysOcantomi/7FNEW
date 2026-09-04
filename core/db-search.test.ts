import assert from "node:assert/strict"
import test from "node:test"
import type { Prisma } from "@/generated/prisma/client"
import { searchContains, searchStartsWith, structuredContains } from "./db-search"

/**
 * NEON-01 / R1 — on the SQLite provider every helper must return EXACTLY the
 * filter the call sites used to write (Turso behaviour unchanged), the result
 * must be accepted by the generated Prisma filter types without casts, and
 * the two semantic families must stay distinct functions so NEON-02 can
 * change free-text search without touching structured filters.
 */

test("searchContains returns the plain contains filter, value untouched", () => {
  assert.deepEqual(searchContains("Acme"), { contains: "Acme" })
  assert.deepEqual(searchContains("  spaced  "), { contains: "  spaced  " })
  assert.deepEqual(Object.keys(searchContains("x")), ["contains"])
})

test("searchStartsWith returns the plain startsWith filter", () => {
  assert.deepEqual(searchStartsWith("CLI-"), { startsWith: "CLI-" })
  assert.deepEqual(Object.keys(searchStartsWith("x")), ["startsWith"])
})

test("structuredContains returns the plain contains filter (today identical to the literal call sites)", () => {
  assert.deepEqual(structuredContains("PRJ-007"), { contains: "PRJ-007" })
  assert.deepEqual(Object.keys(structuredContains("x")), ["contains"])
})

test("free-text search and structured filters are separate functions (the NEON-02 boundary)", () => {
  // Same shape today, deliberately NOT the same function: NEON-02 adds
  // `mode: "insensitive"` to the search family only.
  assert.notStrictEqual(searchContains, structuredContains)
  assert.equal(searchContains.name, "searchContains")
  assert.equal(structuredContains.name, "structuredContains")
})

test("helpers type-check as Prisma string filters (required and nullable) on the current provider", () => {
  // Compile-time assertions: these assignments fail `tsc` if a helper shape
  // ever stops being a valid Prisma filter for the active provider.
  const required: Prisma.StringFilter = searchContains("a")
  const nullable: Prisma.StringNullableFilter = searchContains("b")
  const prefix: Prisma.StringFilter = searchStartsWith("c")
  const structured: Prisma.StringNullableFilter = structuredContains("d")
  const where: Prisma.ProyectoWhereInput = {
    AND: [
      { OR: [{ nombre: searchContains("a") }, { descripcion: searchContains("a") }] },
      { customId: structuredContains("PRJ-") },
      { tags: structuredContains("urgent") },
    ],
  }
  assert.equal(required.contains, "a")
  assert.equal(nullable.contains, "b")
  assert.equal(prefix.startsWith, "c")
  assert.equal(structured.contains, "d")
  assert.equal(where.AND && Array.isArray(where.AND) ? where.AND.length : 0, 3)
})
