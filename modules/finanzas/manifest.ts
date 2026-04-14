import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "finanzas",
  name: "Finanzas",
  description: "Control financiero con registro de transacciones, vision de flujo de caja y salud economica.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.finanzas",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: true,
    ai: false,
    portal: false,
  },
  models: ["Transaccion"],
  provides: ["transactions", "finance"],
  optional: false,
  progression: moduleProgression,
}
