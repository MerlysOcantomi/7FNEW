import "dotenv/config"
import { defineConfig } from "prisma/config"

/**
 * Prisma CLI configuration — PostgreSQL (NEON-03).
 *
 * - schema: the canonical `prisma/schema.prisma` (provider `postgresql`).
 * - migrations: `prisma/migrations-postgres` — the PostgreSQL history, whose
 *   `0_init` baseline is immutable (see docs/architecture/7F-DATABASE.md).
 *   The SQLite history in `prisma/migrations` is the legacy Turso history; it
 *   is verified separately by `scripts/build-db-from-history.ts` with its own
 *   temporary config and is never deployed through this file.
 * - datasource: `DIRECT_URL`, the DIRECT (non-pooled) PostgreSQL endpoint.
 *   Only the Prisma CLI reads it (`migrate deploy`, `migrate status`,
 *   `migrate diff`, `db execute`). The runtime (`core/db.ts`) reads
 *   `DATABASE_URL`, the pooled endpoint, and never this variable.
 *
 * When `DIRECT_URL` is unset the datasource is OMITTED rather than defaulted:
 * `prisma generate` (CI, Vercel build) needs no connection and keeps working,
 * while every command that needs one fails closed with Prisma's own
 * "datasource.url property is required" error. There is no fallback URL and
 * no SQLite path. A value with a non-PostgreSQL scheme is refused here, before
 * any command runs.
 */

const POSTGRES_SCHEMES = new Set(["postgresql:", "postgres:"])

function directUrl(): string | undefined {
  const value = process.env.DIRECT_URL
  if (!value) return undefined
  let scheme: string | null = null
  try {
    scheme = new URL(value).protocol
  } catch {
    throw new Error("[7F] prisma.config.ts: DIRECT_URL is not a valid URL (expected a postgresql:// direct endpoint)")
  }
  if (!POSTGRES_SCHEMES.has(scheme)) {
    throw new Error(`[7F] prisma.config.ts: DIRECT_URL has scheme "${scheme}" — the migration target is PostgreSQL only`)
  }
  return value
}

const url = directUrl()

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-postgres",
  },
  ...(url ? { datasource: { url } } : {}),
})
