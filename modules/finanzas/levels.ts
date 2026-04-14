import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "finanzas",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Registro de ingresos y gastos con categorias y vista de flujo basico.",
      businessValue: "Da visibilidad minima sobre la salud economica del negocio.",
      includedCapabilities: [
        "registro de transacciones",
        "categorias",
        "vista de ingresos vs gastos",
        "filtros por periodo",
      ],
      suitableFor: [
        "freelancers",
        "negocios pequenos",
        "control basico de caja",
      ],
      unlocksNext: [
        "relacion con facturas",
        "flujo de caja proyectado",
        "reportes",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Vision financiera conectada con facturacion y proyeccion de flujo de caja.",
      businessValue: "Permite anticipar problemas de liquidez y tomar decisiones con mas contexto financiero.",
      includedCapabilities: [
        "relacion con facturacion",
        "flujo de caja",
        "transacciones recurrentes",
        "etiquetas y subcategorias",
      ],
      suitableFor: [
        "negocios con ingresos variables",
        "operacion que necesita anticipar liquidez",
        "equipos con gestion financiera delegada",
      ],
      unlocksNext: [
        "rentabilidad por proyecto",
        "reportes avanzados",
        "alertas financieras",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Control financiero completo con rentabilidad, reportes y alertas automaticas.",
      businessValue: "Convierte las finanzas en una capa de decision estrategica para el negocio.",
      includedCapabilities: [
        "rentabilidad por proyecto y cliente",
        "reportes configurables",
        "alertas de salud financiera",
        "metricas clave",
      ],
      suitableFor: [
        "negocios en crecimiento",
        "operacion con margenes ajustados",
        "equipos con decision financiera activa",
      ],
    },
  ],
}
