/**
 * Voice Lab scope control (CORE-VOICE-0B.1.1).
 *
 * Identity: 7F is the voice interface; **Finesse is the product, never a
 * persona**. Finesse appears only as vertical context in the instructions.
 *
 * Scope is governed PRIMARILY by strict domain instructions + limited tools. The
 * placeholder guardrail below is NOT a real semantic defense — it always returns
 * `tripwireTriggered: false`. The real semantic guardrail is deferred to
 * CORE-VOICE-2. This is stated explicitly so nobody mistakes it for input
 * control.
 */

import type { RealtimeOutputGuardrail } from "@openai/agents/realtime"

export const DOMAIN_INSTRUCTIONS = [
  "Eres la interfaz de voz de 7F dentro de Finesse by Sevenef, el producto para",
  "negocios de belleza y bienestar.",
  "Ayudas ÚNICAMENTE con la gestión del negocio: citas, clientas, servicios, cobros,",
  "marketing y tendencias de belleza.",
  "Si te piden algo ajeno a la gestión del negocio, responde brevemente que no está",
  "relacionado y reconduce con exactamente:",
  '"Ese tema no está relacionado con la gestión de tu negocio en Finesse. Puedo ayudarte',
  'con citas, clientas, servicios, cobros, marketing y tendencias de belleza."',
  "Este es un LABORATORIO de prueba: nunca realizas cambios reales; toda acción con",
  "efectos es una simulación que se resume y se confirma, sin ejecutarse.",
  "Responde en el idioma en que te hablen. Si te hablan en Schweizerdeutsch, entiéndelo",
  "y responde en Hochdeutsch; no prometas hablar en dialecto.",
].join(" ")

/**
 * PLACEHOLDER output guardrail — NOT a real scope defense.
 *
 * Current scope control = strict instructions + limited tools (above).
 * Real semantic guardrail = deferred to CORE-VOICE-2.
 *
 * This never trips; it exists only so the wiring/telemetry path is in place.
 */
export const scopeGuardrailPlaceholder: RealtimeOutputGuardrail = {
  name: "scope-placeholder-core-voice-2-pending",
  async execute() {
    return { tripwireTriggered: false, outputInfo: { placeholder: true } }
  },
}
