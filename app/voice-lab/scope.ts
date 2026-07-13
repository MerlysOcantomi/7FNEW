/**
 * Voice Lab scope control (CORE-VOICE-0B.1).
 *
 * Scope is governed PRIMARILY by strict domain instructions + limited tools. The
 * output guardrail below is only a LAST line of defense — it is NOT full input
 * control, and real semantic off-topic evaluation (governed `ScopeEvaluator`) is
 * out of 0B.1. The guardrail is wired and never trips on domain content.
 */

import type { RealtimeOutputGuardrail } from "@openai/agents/realtime"

export const DOMAIN_INSTRUCTIONS = [
  "Eres el asistente de voz de un negocio de belleza y bienestar (Finesse by Sevenef).",
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

export const offTopicGuardrail: RealtimeOutputGuardrail = {
  name: "beauty-scope-last-defense",
  async execute() {
    // Placeholder last-defense: never trips on domain content in 0B.1. Real
    // off-topic detection is a later phase, and input scope is governed by the
    // instructions + limited tools above, not by this output guardrail.
    return { tripwireTriggered: false, outputInfo: {} }
  },
}
