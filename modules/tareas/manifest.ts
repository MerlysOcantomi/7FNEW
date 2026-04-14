import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "tareas",
  name: "Tareas",
  description: "Gestion de tareas operativas, asignacion, seguimiento y relacion con proyectos.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.tareas",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: true,
    ai: false,
    portal: false,
  },
  models: ["Tarea"],
  provides: ["tasks"],
  optional: false,
  progression: moduleProgression,
}
