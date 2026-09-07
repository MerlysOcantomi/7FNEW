/**
 * Prisma config for the PostgreSQL target (NEON-02). Used ONLY with
 * `prisma … --config prisma.config.postgres.ts` by `scripts/postgres-baseline.ts`
 * (and, after the cutover, by `migrate deploy` against Neon's DIRECT url).
 *
 * - Schema: the DERIVED variant (generated/schema.postgres.prisma), never the
 *   canonical SQLite schema — so a cross-provider `migrate diff` cannot happen
 *   through this config.
 * - Migrations: prisma/migrations-postgres — a separate history from the
 *   SQLite one; the two never share a directory.
 * - Datasource: POSTGRES_DIRECT_URL, read from the process environment only.
 *   No dotenv import: an accidental .env with Turso variables can never be
 *   picked up here, and the runtime (`core/db.ts`) is untouched by this file.
 */
import { defineConfig } from "prisma/config"

const url = process.env.POSTGRES_DIRECT_URL
if (!url) {
  throw new Error("[7F] prisma.config.postgres.ts: POSTGRES_DIRECT_URL is not set (an ephemeral local PostgreSQL for verification, or Neon's DIRECT url after the cutover)")
}

export default defineConfig({
  schema: "generated/schema.postgres.prisma",
  migrations: {
    path: "prisma/migrations-postgres",
  },
  datasource: {
    url,
  },
})
