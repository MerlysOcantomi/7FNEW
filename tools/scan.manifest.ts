import type { ToolManifest } from "@core/registry"

export const manifest: ToolManifest = {
  id: "scan",
  name: "Document Scan",
  description: "Analisis documental estructurado sobre texto extraido.",
  version: "1.0.0",
  kind: "tool",
  namespace: "tool.scan",
  dependencies: ["engines/ai"],
  provides: ["document-analysis"],
  optional: false,
  category: "processing",
}
