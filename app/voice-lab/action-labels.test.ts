import assert from "node:assert/strict"
import test from "node:test"
import { humanizeActionName, FALLBACK_ACTION_LABEL } from "./action-labels"

test("known tool name is humanized (no raw identifier)", () => {
  assert.equal(humanizeActionName("create_appointment"), "Crear cita")
  assert.equal(humanizeActionName("create_charge"), "Registrar cobro")
})

test("tool name is matched case-insensitively and trimmed", () => {
  assert.equal(humanizeActionName("  Create_Appointment "), "Crear cita")
})

test("unknown / empty / non-string tool name falls back safely", () => {
  assert.equal(humanizeActionName("do_something_unknown"), FALLBACK_ACTION_LABEL)
  assert.equal(humanizeActionName(""), FALLBACK_ACTION_LABEL)
  assert.equal(humanizeActionName(undefined), FALLBACK_ACTION_LABEL)
  assert.equal(humanizeActionName(null), FALLBACK_ACTION_LABEL)
})

test("the raw technical name is never returned verbatim", () => {
  assert.notEqual(humanizeActionName("create_appointment"), "create_appointment")
})
