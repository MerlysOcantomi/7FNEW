#!/usr/bin/env node
/**
 * Aggregate test runner (CORE-03A).
 *
 * WHY THIS EXISTS
 * ---------------
 * The repository had no `npm test`: the suite was 39 separate `test:*` scripts,
 * and six test files were referenced by none of them — they existed, passed,
 * and would never have run in an automated pipeline. A single entry point that
 * DISCOVERS tests instead of listing them is the only version of this that
 * cannot silently go stale as files are added.
 *
 * Node's own `--test` cannot be used directly for this. Its glob support has
 * no exclusion flag, and a naive `**./*.test.ts` matches the 158 test files
 * shipped inside `node_modules`. So discovery happens here, explicitly.
 *
 * Written in plain ESM JavaScript and run by `node` directly: no shell syntax,
 * no bashisms, and no TypeScript loader needed just to start the suite.
 *
 * Usage:
 *   node scripts/run-tests.mjs            run every discovered test file once
 *   node scripts/run-tests.mjs --list     print the inventory and exit
 *
 * Any extra arguments are forwarded to the underlying runner, so
 * `npm test -- --test-name-pattern=foo` keeps working.
 */

import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

/**
 * Directories never worth descending into. `generated` and `.next` hold build
 * output, `node_modules` holds dependencies' own tests, and anything starting
 * with a dot is tooling state. Temporary scratch directories used by tests
 * live under the OS temp dir, outside the repository, so they are excluded by
 * construction.
 */
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  "generated",
  "coverage",
  "public",
  "dist",
  "build",
])

const TEST_FILE_PATTERN = /\.test\.tsx?$/

function discoverTestFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue
      found.push(...discoverTestFiles(join(directory, entry.name)))
    } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      found.push(join(directory, entry.name))
    }
  }
  return found
}

const discovered = discoverTestFiles(ROOT)
  .map((absolute) => relative(ROOT, absolute).split(sep).join("/"))
  .sort()

/**
 * Guard against the failure this runner exists to prevent: a file counted
 * twice would inflate the totals and hide a missing test behind a duplicate.
 */
const seen = new Set()
const duplicates = discovered.filter((file) => (seen.has(file) ? true : (seen.add(file), false)))
if (duplicates.length > 0) {
  console.error(`Duplicate test files discovered:\n  ${duplicates.join("\n  ")}`)
  process.exit(1)
}

if (discovered.length === 0) {
  console.error("No test files discovered — refusing to report a vacuous success.")
  process.exit(1)
}

const forwarded = process.argv.slice(2)

if (forwarded.includes("--list")) {
  console.log(discovered.join("\n"))
  console.log(`# discovered ${discovered.length} test files`)
  process.exit(0)
}

console.log(`# running ${discovered.length} test files`)

const result = spawnSync(
  process.execPath,
  [join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "--test", ...forwarded, ...discovered],
  { cwd: ROOT, stdio: "inherit" },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
