import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "contenido",
  name: "Contenido",
  description: "Gestion de piezas de contenido, ideas editoriales y planificacion de publicacion.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.contenido",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: true,
    portal: false,
  },
  models: ["ContentPiece", "ContentIdea"],
  provides: ["content", "content-ideas"],
  optional: true,
  progression: moduleProgression,
}
