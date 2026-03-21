import type { EngineManifest } from "@core/registry"

export const manifest: EngineManifest = {
  id: "ai",
  name: "AI Engine",
  description: "Motor reutilizable de generacion, chat y routing de prompts.",
  version: "1.0.0",
  kind: "engine",
  namespace: "engine.ai",
  dependencies: [],
  provides: ["ai.ask", "ai.chat", "ai.prompts"],
  optional: false,
}
