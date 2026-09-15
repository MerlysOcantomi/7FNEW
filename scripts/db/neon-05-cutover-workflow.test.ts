import assert from "node:assert/strict"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { REPO_ROOT } from "../lib/prisma-cli"

/**
 * NEON-05 — the cutover workflow's bash gates, executed exactly as written.
 *
 * The workflow file is the artefact under review, so its `run:` blocks are
 * extracted from the YAML by name (no YAML dependency) and run with `bash -e`
 * under controlled environments. Nothing here connects anywhere.
 */

const WORKFLOW = readFileSync(join(REPO_ROOT, ".github", "workflows", "neon-05-production-cutover.yml"), "utf8")

/** Return the `run: |` body of the step whose `name:` contains `needle`. */
function stepRun(needle: string): string {
  const lines = WORKFLOW.split("\n")
  const start = lines.findIndex((l) => /^\s*- name: /.test(l) && l.includes(needle))
  assert.ok(start >= 0, `step ${JSON.stringify(needle)} exists`)
  const runIdx = lines.findIndex((l, i) => i > start && /^\s*run: \|\s*$/.test(l))
  assert.ok(runIdx > start, `step ${JSON.stringify(needle)} has a run block`)
  const indent = /^(\s*)run:/.exec(lines[runIdx])![1].length + 2
  const body: string[] = []
  for (let i = runIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === "") {
      body.push("")
      continue
    }
    if (l.length - l.trimStart().length < indent) break
    body.push(l.slice(indent))
  }
  return body.join("\n")
}

function run(script: string, env: Record<string, string>): { code: number; out: string } {
  // A deliberately minimal environment: only PATH plus what the case supplies, so an
  // absent variable is really absent (cast: the repo's ProcessEnv type demands NODE_ENV).
  const childEnv: Record<string, string> = { PATH: process.env.PATH ?? "", ...env }
  const r = spawnSync("bash", ["-e", "-c", script], { env: childEnv as unknown as NodeJS.ProcessEnv, encoding: "utf8" })
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` }
}

const SHA_A = "2ab52510a4195a589a4c4255d29b0d90321dcda6"
const SHA_B = "7ee3c208d9716824e53b36896adb411c354bf620"

test("workflow shape: tag-only trigger, production environment, read-only permissions, no reset flags, no dispatch", () => {
  assert.match(WORKFLOW, /^on:\n  push:\n    tags:\n      - "neon-05-cutover-\*"\n/m)
  assert.ok(!/workflow_dispatch|pull_request:|schedule:/.test(WORKFLOW.replace(/^#.*$/gm, "")), "no other trigger outside comments")
  assert.match(WORKFLOW, /environment: sevenf-neon-production/)
  assert.match(WORKFLOW, /permissions:\n  contents: read/)
  const code = WORKFLOW.replace(/^\s*#.*$/gm, "")
  assert.ok(!/reset-target|confirm-reset|TRUNCATE|db push|migrate reset/.test(code), "no reset path outside comments")
  assert.match(code, /db:etl:preflight-empty/, "migrate runs the shared production guard before deploy")
  assert.ok(code.indexOf("db:etl:preflight-empty") < code.indexOf("db:migrate:deploy"), "preflight precedes migrate deploy")
})

test("gate: only neon-05-cutover-{migrate,stamp,load}-* tags are accepted, never a branch", () => {
  const gate = stepRun("must run from a neon-05-cutover")
  for (const [env, code, action] of [
    [{ GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "neon-05-cutover-migrate-01" }, 0, "migrate"],
    [{ GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "neon-05-cutover-stamp-01" }, 0, "stamp"],
    [{ GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "neon-05-cutover-load-01" }, 0, "load"],
    [{ GITHUB_REF_TYPE: "branch", GITHUB_REF_NAME: "neon-05-cutover-load-01" }, 1, ""],
    [{ GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "neon-05-cutover-01" }, 1, ""],
    [{ GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "neon-04-etl-20260913-01" }, 1, ""],
  ] as const) {
    const r = run(gate, { ...env, GITHUB_OUTPUT: "/dev/null" })
    assert.equal(r.code, code, JSON.stringify(env))
    if (code === 0) assert.match(r.out, new RegExp(`action=${action}`))
  }
})

test("gate: the tag must point at APPROVED_CUTOVER_SHA — missing, malformed or different sha fail closed before anything else", () => {
  const gate = stepRun("APPROVED_CUTOVER_SHA")
  assert.equal(run(gate, { GITHUB_SHA: SHA_A, APPROVED_CUTOVER_SHA: SHA_A }).code, 0, "matching sha passes")
  const missing = run(gate, { GITHUB_SHA: SHA_A })
  assert.equal(missing.code, 1)
  assert.match(missing.out, /APPROVED_CUTOVER_SHA is not set/)
  const empty = run(gate, { GITHUB_SHA: SHA_A, APPROVED_CUTOVER_SHA: "" })
  assert.equal(empty.code, 1)
  const mismatch = run(gate, { GITHUB_SHA: SHA_B, APPROVED_CUTOVER_SHA: SHA_A })
  assert.equal(mismatch.code, 1)
  assert.match(mismatch.out, /not at the approved commit/)
  const short = run(gate, { GITHUB_SHA: SHA_A, APPROVED_CUTOVER_SHA: SHA_A.slice(0, 7) })
  assert.equal(short.code, 1, "an abbreviated sha is refused (no prefix matching)")
  const upper = run(gate, { GITHUB_SHA: SHA_A, APPROVED_CUTOVER_SHA: SHA_A.toUpperCase() })
  assert.equal(upper.code, 1, "exact string equality only")
  // The gate runs before checkout and before any var/secret is read.
  const names = [...WORKFLOW.matchAll(/^\s*- name: (.*)$/gm)].map((m) => m[1])
  const approvedIdx = names.findIndex((n) => n.includes("APPROVED_CUTOVER_SHA"))
  assert.ok(approvedIdx === 1, "approved-commit gate is the second step (right after the tag gate)")
  assert.ok(approvedIdx < names.findIndex((n) => n.startsWith("Checkout")))
  assert.ok(approvedIdx < names.findIndex((n) => n.includes("vars and secrets")))
})

test("gate: every var and secret is required (values never printed) and a pooled host is refused", () => {
  const gate = stepRun("required environment vars and secrets")
  const full = {
    ETL_SOURCE_URL: "libsql://src.invalid",
    ETL_TARGET_HOST: "ep-restless-scene-b2m6ucm7.c-6.eu-central-1.aws.neon.tech",
    ETL_TARGET_DATABASE: "neondb",
    ETL_PRODUCTION_PROJECT: "old-wave-11795585",
    ETL_PRODUCTION_BRANCH: "br-broad-river-b2ue75l8",
    ETL_SOURCE_AUTH_TOKEN: "TOKENVALUE",
    ETL_TARGET_URL: "postgresql://u:PASSVALUE@ep-restless-scene-b2m6ucm7.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full",
  }
  const ok = run(gate, full)
  assert.equal(ok.code, 0)
  assert.ok(!ok.out.includes("TOKENVALUE") && !ok.out.includes("PASSVALUE") && !ok.out.includes("postgresql://"), "no secret value in the log")
  for (const name of Object.keys(full)) {
    const r = run(gate, { ...full, [name]: "" })
    assert.equal(r.code, 1, `${name} missing`)
    assert.match(r.out, new RegExp(`${name} is not set`))
  }
  const pooled = run(gate, { ...full, ETL_TARGET_HOST: "ep-restless-scene-b2m6ucm7-pooler.c-6.eu-central-1.aws.neon.tech" })
  assert.equal(pooled.code, 1)
  assert.match(pooled.out, /pooled endpoint/)
})

test("checkout verification refuses a checked-out commit that is not the approved one", () => {
  const step = stepRun("Record the executed commit and baseline")
  // git rev-parse HEAD inside a temp repo would need a repo; emulate with a function.
  const emulated = `git() { echo "${SHA_B}"; }\nsha256sum() { echo "679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e  x"; }\n${step}`
  const r = run(emulated, { APPROVED_CUTOVER_SHA: SHA_A })
  assert.equal(r.code, 1)
  assert.match(r.out, /expected the approved commit/)
  const good = `git() { echo "${SHA_A}"; }\nsha256sum() { echo "679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e  x"; }\n${step}`
  assert.equal(run(good, { APPROVED_CUTOVER_SHA: SHA_A }).code, 0)
})
