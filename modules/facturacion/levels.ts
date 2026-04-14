import type { ModuleProgressionProfile } from "@core/registry"

export const moduleProgression: ModuleProgressionProfile = {
  moduleId: "facturacion",
  defaultLevel: "basic",
  recommendedStart: "basic",
  levels: [
    {
      level: "basic",
      label: "Basic",
      summary: "Registro de facturas con estado de cobro y relacion con clientes.",
      businessValue: "Da control minimo sobre lo facturado y pendiente de cobro.",
      includedCapabilities: [
        "registro de facturas",
        "estado de cobro",
        "relacion con cliente",
        "vista de lista",
      ],
      suitableFor: [
        "freelancers",
        "operacion con pocas facturas mensuales",
        "control basico de cobros",
      ],
      unlocksNext: [
        "relacion con proyectos",
        "exportacion",
        "portal del cliente",
      ],
    },
    {
      level: "intermediate",
      label: "Intermediate",
      summary: "Facturacion conectada a proyectos con exportacion y visibilidad en portal.",
      businessValue: "Permite que la facturacion refleje el trabajo real y sea accesible para el cliente.",
      includedCapabilities: [
        "relacion con proyectos",
        "exportacion CSV/PDF",
        "portal del cliente",
        "filtros por estado y periodo",
      ],
      suitableFor: [
        "agencias y consultoras",
        "operacion con facturacion recurrente",
        "negocios que comparten facturas con clientes",
      ],
      unlocksNext: [
        "facturacion recurrente",
        "alertas de cobro",
        "integracion financiera",
      ],
    },
    {
      level: "advanced",
      label: "Advanced",
      summary: "Facturacion automatizada con recurrencia, alertas y vision financiera integrada.",
      businessValue: "Reduce friccion administrativa y conecta facturacion con la salud financiera del negocio.",
      includedCapabilities: [
        "facturacion recurrente",
        "alertas de cobro",
        "relacion con finanzas",
        "metricas de facturacion",
      ],
      suitableFor: [
        "negocios con alto volumen de facturas",
        "operacion con contratos recurrentes",
        "seguimiento financiero integrado",
      ],
    },
  ],
}
