import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "facturacion",
  name: "Facturacion",
  description: "Gestion de facturas, estados de cobro y relacion con clientes y proyectos.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.facturacion",
  dependencies: ["core/db"],
  capabilities: {
    crud: true,
    search: true,
    export: true,
    ai: false,
    portal: true,
  },
  models: ["Factura"],
  provides: ["invoices"],
  optional: false,
  progression: moduleProgression,
}
