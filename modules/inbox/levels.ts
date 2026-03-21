import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "inbox",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Bandeja de entrada con clasificacion inicial y orden minimo de conversaciones.",
      businessValue: "Reduce caos en mensajes entrantes y crea una base util para seguimiento temprano.",
      includedCapabilities: [
        "bandeja unificada",
        "clasificacion simple",
        "prioridad inicial",
        "conversion manual basica",
      ],
      suitableFor: [
        "captacion inicial",
        "equipos pequenos",
        "volumen moderado de mensajes",
      ],
      unlocksNext: [
        "seguimiento y asignacion",
        "priorizacion mas rica",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Seguimiento operativo con asignacion, prioridad, estado y conversion mas estructurada.",
      businessValue: "Permite que la bandeja deje de ser solo recepcion y pase a coordinar respuesta y seguimiento.",
      includedCapabilities: [
        "seguimiento",
        "asignacion",
        "prioridad operativa",
        "estados conversacionales",
        "conversion hacia cliente/proyecto/tarea",
      ],
      suitableFor: [
        "operacion comercial o soporte con seguimiento",
        "equipos con responsables",
        "flujo entre inbox y delivery",
      ],
      unlocksNext: [
        "inteligencia conversacional",
        "automatizacion y handoff",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Inbox inteligente con clasificacion enriquecida, handoff, drafts y automatizacion mas rica.",
      businessValue: "Convierte la conversacion en una capa orquestable de operacion, priorizacion y accion asistida.",
      includedCapabilities: [
        "inteligencia conversacional",
        "lead scoring",
        "handoff",
        "drafts",
        "automatizacion de acciones",
      ],
      suitableFor: [
        "negocios con alta carga conversacional",
        "captacion y seguimiento complejos",
        "operacion asistida por IA",
      ],
    },
  ],
}
