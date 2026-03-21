import type { ModuleManifest } from "@core/registry"

export const manifest: ModuleManifest = {
  id: "usuarios",
  name: "Usuarios",
  description: "Gestion de usuarios internos del sistema.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.usuarios",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Usuario"],
  provides: ["users"],
  optional: false,
}
