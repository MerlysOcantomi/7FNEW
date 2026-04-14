import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "automatizaciones",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Reglas simples de automatizacion sobre tareas y estados.",
      businessValue: "Reduce acciones manuales repetitivas en la operacion diaria.",
      includedCapabilities: [
        "reglas basicas de trigger-accion",
        "automatizacion de estados",
        "notificaciones automaticas",
      ],
      suitableFor: [
        "equipos pequenos",
        "operacion con pocos flujos repetitivos",
        "automatizacion inicial sin complejidad",
      ],
      unlocksNext: [
        "condiciones multiples",
        "automatizacion entre modulos",
        "flujos con IA",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Automatizaciones con condiciones multiples y coordinacion entre modulos.",
      businessValue: "Permite que la automatizacion conecte distintas areas del negocio.",
      includedCapabilities: [
        "condiciones multiples",
        "automatizacion entre modulos",
        "programacion temporal",
        "logs de ejecucion",
      ],
      suitableFor: [
        "operacion con flujos entre areas",
        "equipos con procesos definidos",
        "negocios con volumen operativo medio",
      ],
      unlocksNext: [
        "flujos con IA",
        "automatizacion de inbox",
        "cadenas de automatizacion",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Flujos avanzados con IA, cadenas de automatizacion y orquestacion completa.",
      businessValue: "Convierte la automatizacion en una capa de orquestacion operativa inteligente.",
      includedCapabilities: [
        "flujos asistidos por IA",
        "cadenas de automatizacion",
        "orquestacion entre modulos y engine",
        "metricas de automatizacion",
      ],
      suitableFor: [
        "operacion a escala",
        "negocios con alta carga operativa",
        "equipos que buscan automatizacion inteligente",
      ],
    },
  ],
}
