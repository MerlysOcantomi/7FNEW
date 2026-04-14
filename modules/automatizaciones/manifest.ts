import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "automatizaciones",
  name: "Automatizaciones",
  description: "Reglas y acciones automaticas sobre tareas, proyectos y facturacion del workspace.",
  version: "1.0.0",
  kind: "tool",
  namespace: "tool.automatizaciones",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: false,
    export: false,
    ai: true,
    portal: false,
  },
  models: ["Automatizacion"],
  provides: ["automations"],
  optional: true,
  progression: moduleProgression,
}
