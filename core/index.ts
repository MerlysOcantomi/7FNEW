/**
 * @core — 7F system infrastructure.
 *
 * Canonical core implementations live under this directory.
 * The barrel stays intentionally small and currently exposes registry types.
 */
export { registry } from "./registry";
export type {
  ModuleManifest,
  ModuleComplexityLevelName,
  ModuleProgressionProfile,
  EngineManifest,
  ToolManifest,
  AgentToolDefinition,
  RegistryEntryKind,
} from "./registry";
export type {
  WorkspaceBusinessProfile,
  WorkspaceServiceCatalogItem,
} from "./verticals";
export type { WorkspaceAgentContext } from "./workspace";
export {
  resolveWorkspaceContext,
  buildWorkspaceContextBlock,
} from "./workspace";
