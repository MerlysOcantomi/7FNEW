import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "notas",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Notas simples asociadas a clientes, proyectos y entidades del workspace.",
      businessValue: "Captura contexto operativo que de otro modo se pierde en conversaciones o memoria personal.",
      includedCapabilities: [
        "notas de texto libre",
        "relacion con clientes y proyectos",
        "fecha de creacion",
        "autor",
      ],
      suitableFor: [
        "equipos pequenos",
        "operacion con poca necesidad de estructura en notas",
        "captura rapida de contexto",
      ],
      unlocksNext: [
        "notas con formato enriquecido",
        "busqueda avanzada",
        "notas internas vs compartidas",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Notas con formato, busqueda y distincion entre internas y compartidas.",
      businessValue: "Permite que las notas sean una herramienta de trabajo real y no solo apuntes sueltos.",
      includedCapabilities: [
        "formato enriquecido",
        "busqueda en contenido",
        "notas internas vs compartidas",
        "etiquetas",
      ],
      suitableFor: [
        "equipos con documentacion de reuniones",
        "operacion con notas frecuentes por cliente",
        "seguimiento comercial con contexto escrito",
      ],
      unlocksNext: [
        "resumen automatico",
        "notas conectadas al inbox",
        "base de conocimiento ligera",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Notas con resumen IA, conexion con inbox y contribucion a conocimiento del workspace.",
      businessValue: "Convierte las notas en una capa de memoria organizacional activa.",
      includedCapabilities: [
        "resumen automatico con IA",
        "relacion con conversaciones del inbox",
        "contribucion a workspace knowledge",
        "historial de versiones",
      ],
      suitableFor: [
        "equipos que construyen conocimiento interno",
        "operacion con documentacion intensiva por cliente",
        "negocios donde el contexto escrito es critico",
      ],
    },
  ],
}
