import type { AgentsMessages } from "../types"

/**
 * Spanish source for the `agents` UI namespace. "Fanny" is an agent proper
 * name — never translated (see AGENTS.md).
 */
export const agents: AgentsMessages = {
  subtitle: "Qué están haciendo tus agentes de IA · todo el workspace",
  openFull: "Abrir Agentes completo",
  closePanel: "Cerrar el panel de Agentes",
  closeDrawer: "Cerrar Agentes",
  loadingAria: "Cargando la actividad de los agentes",
  loadErrorNote: "No se pudo cargar la actividad de los agentes.",
  empty: {
    title: "Aún no hay actividad de agentes",
    body: "Cuando Fanny automatice trabajo, proponga una tarea o ejecute una acción, aparecerá aquí — agrupado por lo que requiere revisión, lo que se automatizó y lo que necesita tu atención.",
  },
  lanes: {
    needsReview: { title: "Requiere tu revisión", empty: "No hay propuestas en espera." },
    automated: { title: "Gestionado recientemente", empty: "Aún no se ha gestionado nada." },
    attention: { title: "Atención", empty: "Nada necesita atención." },
  },
  moreOnFullPage: (count) => `+${count} más en la página completa de Agentes`,
  fromInbox: "De mensajes",
}
