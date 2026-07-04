import assert from "node:assert/strict"
import test from "node:test"
import { sanitizeTenantConfig, TENANT_FORBIDDEN_CONFIG_KEYS } from "./workspace-governance"

test("strips `modules` from a tenant config patch", () => {
  const { config, stripped } = sanitizeTenantConfig({
    modules: { finance: true },
    ui: { labels: { client: "Clienta" } },
    businessProfile: { tone: "cercano" },
  })
  assert.equal("modules" in config, false)
  assert.deepEqual(stripped, ["modules"])
  // Non-privileged keys survive untouched.
  assert.deepEqual(config.ui, { labels: { client: "Clienta" } })
  assert.deepEqual(config.businessProfile, { tone: "cercano" })
})

test("passes through when there is nothing privileged", () => {
  const { config, stripped } = sanitizeTenantConfig({ locale: "es", ui: { labels: {} } })
  assert.deepEqual(stripped, [])
  assert.deepEqual(config, { locale: "es", ui: { labels: {} } })
})

test("handles null/undefined/non-object", () => {
  assert.deepEqual(sanitizeTenantConfig(null), { config: {}, stripped: [] })
  assert.deepEqual(sanitizeTenantConfig(undefined), { config: {}, stripped: [] })
})

test("`modules` is a forbidden tenant key", () => {
  assert.ok((TENANT_FORBIDDEN_CONFIG_KEYS as readonly string[]).includes("modules"))
})
