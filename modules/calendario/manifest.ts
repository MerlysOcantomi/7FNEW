import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "calendario",
  name: "Calendario",
  description: "Gestion de eventos, fechas clave y vista temporal de actividades del workspace.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.calendario",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: false,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Evento"],
  provides: ["events", "calendar"],
  optional: true,
  progression: moduleProgression,
}
