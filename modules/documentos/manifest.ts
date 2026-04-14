import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "documentos",
  name: "Documentos",
  description: "Repositorio de documentos del workspace con categorizacion y relacion con entidades.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.documentos",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Documento"],
  provides: ["documents"],
  optional: false,
  progression: moduleProgression,
}
