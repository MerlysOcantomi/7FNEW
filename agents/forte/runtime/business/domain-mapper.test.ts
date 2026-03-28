import assert from "node:assert/strict"
import test from "node:test"

test("'quiero mas clientes' => relationship + marketing o content", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("quiero mas clientes")

  assert.ok(domains.includes("relationship"))
})

test("'organizar proyectos y tareas' => delivery", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("necesito organizar proyectos y tareas del equipo")

  assert.ok(domains.includes("delivery"))
})

test("'no se si gano dinero' => finance", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("no se si gano dinero, necesito ver rentabilidad")

  assert.ok(domains.includes("finance"))
})

test("'recibo muchos mensajes' => communication", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("recibo muchos mensajes por whatsapp y correo")

  assert.ok(domains.includes("communication"))
})

test("'quiero automatizar procesos' => intelligence", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("quiero automatizar procesos repetitivos")

  assert.ok(domains.includes("intelligence"))
})

test("'publicar contenido en redes' => content", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("necesito publicar contenido en redes sociales")

  assert.ok(domains.includes("content"))
})

test("texto sin keywords => array vacio", async () => {
  const { mapIntentToDomains } = await import("./domain-mapper")

  const domains = mapIntentToDomains("hola mundo")

  assert.equal(domains.length, 0)
})
