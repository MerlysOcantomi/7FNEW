import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "notas",
  name: "Notas",
  description: "Notas internas asociadas a clientes, proyectos u otras entidades del workspace.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.notas",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Nota"],
  provides: ["notes"],
  optional: false,
  progression: moduleProgression,
}
