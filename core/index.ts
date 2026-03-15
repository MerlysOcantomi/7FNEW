/**
 * @core — 7F system infrastructure.
 *
 * This barrel will grow as we migrate files from lib/ into core/.
 * For now it only exposes the registry (Phase 0).
 */
export { registry } from "./registry";
export type {
  ModuleManifest,
  EngineManifest,
  ToolManifest,
  AgentToolDefinition,
} from "./registry";
