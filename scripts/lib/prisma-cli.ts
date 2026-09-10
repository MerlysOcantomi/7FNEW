/**
 * Shared, side-effect-free helpers for running the repository-local Prisma
 * CLI against DISPOSABLE databases (NEON-03).
 *
 * Used by the legacy SQLite history verifier (`scripts/build-db-from-history.ts`),
 * the PostgreSQL baseline tooling (`scripts/postgres-baseline.ts`) and the
 * PostgreSQL test infrastructure (`test/support/postgres.ts`). Every caller
 * gets the same guarantees:
 *
 *   - the child environment never carries the runtime/production connection
 *     variables (DATABASE_URL, DIRECT_URL, TURSO_*), and dotenv is disabled
 *     (`DOTENV_CONFIG_PATH=/dev/null`), so a stray `.env` can never be read;
 *   - the Prisma config handed to the CLI is a TEMPORARY file that imports no
 *     dotenv and names exactly one schema, one migrations directory and one
 *     connection URL — the repository's own `prisma.config.ts` is never used
 *     for throwaway databases;
 *   - connection URLs are redacted from every error message.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Every variable through which a real database could reach a child process. */
export const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
] as const

/** Copy of the current environment with every connection variable removed and dotenv disabled. */
export function sanitizedPrismaEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of CONNECTION_ENV_KEYS) delete env[key]
  env.DOTENV_CONFIG_PATH = "/dev/null"
  env.CHECKPOINT_DISABLE = "1"
  env.PRISMA_HIDE_UPDATE_MESSAGE = "1"
  return { ...env, ...extra }
}

/** Defensive: never echo a connection string in an error message. */
export function redactConnectionUrls(text: string): string {
  return text
    .replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "postgresql://<redacted>")
    .replace(/libsql:\/\/[^\s'"]+/gi, "libsql://<redacted>")
}

export interface RunPrismaOptions {
  env?: Record<string, string>
  /** Piped to stdin (used with `db execute --stdin`). */
  input?: string
}

/** Run the repository-local Prisma binary; returns stdout, throws a redacted error on failure. */
export function runPrisma(args: string[], options: RunPrismaOptions = {}): string {
  try {
    return execFileSync(join(REPO_ROOT, "node_modules", ".bin", "prisma"), args, {
      cwd: REPO_ROOT,
      env: sanitizedPrismaEnv(options.env),
      input: options.input,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      encoding: "utf8",
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const detail = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || e.message || String(err)
    throw new Error(`prisma ${args.slice(0, 2).join(" ")} failed:\n${redactConnectionUrls(detail)}`)
  }
}

export interface TempPrismaConfig {
  /** Temporary directory holding the config (and a node_modules link so `prisma/config` resolves). */
  dir: string
  configPath: string
  cleanup(): void
}

export interface TempPrismaConfigInput {
  schemaPath: string
  migrationsDir: string
  url: string
  /** mkdtemp prefix, e.g. "db-history-verify-". */
  prefix: string
}

/**
 * Write a dotenv-free Prisma config into a fresh temporary directory. The
 * config names its schema, migrations directory and URL explicitly, so the
 * CLI can never pick up the repository config or an environment variable.
 */
export function writeTempPrismaConfig(input: TempPrismaConfigInput): TempPrismaConfig {
  const dir = mkdtempSync(join(tmpdir(), input.prefix))
  const link = join(dir, "node_modules")
  if (!existsSync(link)) symlinkSync(join(REPO_ROOT, "node_modules"), link)
  const configPath = join(dir, "prisma.config.ts")
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "prisma/config"',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(input.schemaPath)},`,
      `  migrations: { path: ${JSON.stringify(input.migrationsDir)} },`,
      `  datasource: { url: ${JSON.stringify(input.url)} },`,
      "})",
      "",
    ].join("\n"),
  )
  return {
    dir,
    configPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

/**
 * Rewrite the single datasource `provider` line of a Prisma schema. Fails
 * closed on any unexpected shape: not exactly one datasource provider line,
 * or a provider other than `from`. Nothing else in the schema is touched.
 */
export function rewriteDatasourceProvider(schema: string, from: string, to: string): { schema: string; line: number } {
  const lines = schema.split("\n")
  const providerLines: number[] = []
  let inDatasource = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^datasource\s+\w+\s*\{/.test(line)) inDatasource = true
    else if (/^\}/.test(line)) inDatasource = false
    if (inDatasource && /^\s*provider\s*=\s*"[^"]+"\s*$/.test(line)) providerLines.push(i)
  }
  if (providerLines.length !== 1) {
    throw new Error(`prisma-cli: expected exactly one datasource provider line, found ${providerLines.length}`)
  }
  const index = providerLines[0]
  if (!lines[index].includes(`"${from}"`)) {
    throw new Error(`prisma-cli: datasource provider is not "${from}" (refusing to rewrite an unexpected schema)`)
  }
  const out = [...lines]
  out[index] = lines[index].replace(`"${from}"`, `"${to}"`)
  return { schema: out.join("\n"), line: index + 1 }
}
