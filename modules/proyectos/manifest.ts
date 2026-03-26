import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "proyectos",
  name: "Proyectos",
  description: "Modulo base para gestionar proyectos, seguimiento operativo y relacion estructurada con clientes.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.proyectos",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Proyecto"],
  provides: ["projects"],
  optional: false,
  progression: moduleProgression,
}
