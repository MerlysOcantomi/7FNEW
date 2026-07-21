import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

/**
 * Guardrail test: the Presence persistence models must NEVER carry columns that
 * duplicate Business Profile data. Business content stays in the Business
 * Profile and is read via `content-source.ts`. This asserts the schema itself,
 * so a future column that leaks business data fails CI.
 */

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(here, "..", "..", "prisma", "schema.prisma")
const schema = readFileSync(schemaPath, "utf8")

/** Extract the body of a `model X { ... }` block. */
function modelBody(name: string): string {
  const re = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, "m")
  const m = schema.match(re)
  assert.ok(m, `model ${name} not found in schema`)
  return m![1]
}

const PRESENCE_MODELS = [
  "PresenceSite",
  "PresencePublication",
  "PresenceDomain",
  "PresenceMedia",
  "PresenceSubscription",
]

// Business-content field names that must not appear as Presence columns.
const FORBIDDEN_FIELDS = [
  "businessName",
  "businessDescription",
  "services",
  "price",
  "prices",
  "workingHours",
  "schedule",
  "address",
  "phone",
  "whatsapp",
  "team",
  "staff",
  "promotions",
  "socialNetworks",
  "instagram",
  "reviews",
  "rating",
]

test("Presence models declare no Business Profile content columns", () => {
  for (const model of PRESENCE_MODELS) {
    const body = modelBody(model).toLowerCase()
    for (const field of FORBIDDEN_FIELDS) {
      // Match a field declaration at the start of a line: `<field>  Type`.
      const declared = new RegExp(`^\\s*${field.toLowerCase()}\\s+\\w`, "m").test(body)
      assert.ok(!declared, `${model} must not declare business field "${field}"`)
    }
  }
})

test("every Presence model is workspace-scoped", () => {
  for (const model of PRESENCE_MODELS) {
    const body = modelBody(model)
    assert.ok(/\bworkspaceId\s+String/.test(body), `${model} must have workspaceId`)
  }
})
