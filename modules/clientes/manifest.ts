import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "clientes",
  name: "Clientes",
  description: "Modulo base para registrar clientes, consultar su estado y mantener contexto comercial operativo.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.clientes",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: false,
    portal: false,
  },
  models: ["Cliente"],
  provides: ["clients"],
  optional: false,
  progression: moduleProgression,
}
