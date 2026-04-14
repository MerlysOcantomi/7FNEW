import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "campanas",
  name: "Campanas",
  description: "Gestion de campanas de marketing, seguimiento de iniciativas y coordinacion editorial.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.campanas",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Campaign"],
  provides: ["campaigns"],
  optional: true,
  progression: moduleProgression,
}
