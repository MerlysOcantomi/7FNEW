/**
 * CORE-02B — regression guard against HTTP-reachable DDL and global backfills
 * (F-WS-05). The two /api/setup/* routes that executed CREATE TABLE / CREATE
 * INDEX and a 23-table cross-tenant updateMany from an HTTP request were
 * removed; this test keeps them (and anything shaped like them) from coming
 * back anywhere under app/api/**.
 *
 * Static source scan only: no database, no network, no route execution.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"

const API_ROOT = join(process.cwd(), "app", "api")

function collectSourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...collectSourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(full)
  }
  return found
}

const files = collectSourceFiles(API_ROOT).map((f) => ({
  path: relative(process.cwd(), f).split(sep).join("/"),
  content: readFileSync(f, "utf8"),
}))

test("the /api/setup DDL and backfill routes are gone", () => {
  assert.ok(!existsSync(join(API_ROOT, "setup")), "app/api/setup must not exist")
})

test("no DDL statements inside any HTTP handler", () => {
  // \s after PRAGMA keeps the HTTP "Pragma:" header (tracking routes) out.
  const ddl = [
    /\bCREATE\s+TABLE\b/i,
    /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bPRAGMA\s+\w+/i,
  ]
  for (const file of files) {
    for (const pattern of ddl) {
      assert.ok(!pattern.test(file.content), `${file.path} contains DDL matching ${pattern}`)
    }
  }
})

test("no direct libSQL client inside any HTTP handler", () => {
  for (const file of files) {
    assert.ok(
      !file.content.includes("@libsql/client"),
      `${file.path} must not open raw libSQL connections from an HTTP route`,
    )
  }
})

test("no cross-tenant null-workspace backfill reachable from HTTP", () => {
  const backfillShape = /where:\s*\{\s*workspaceId:\s*null\s*\}/
  for (const file of files) {
    assert.ok(
      !backfillShape.test(file.content),
      `${file.path} sweeps null-tenant rows — that belongs to a controlled migration, not an HTTP route`,
    )
  }
})
