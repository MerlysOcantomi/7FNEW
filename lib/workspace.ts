// Re-export from new location — will be removed after full migration
export {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_SLUG,
  getOrCreateDefaultWorkspace,
  checkMembership,
  listWorkspacesForUser,
  ensureUserHasDefaultWorkspace,
  getActiveWorkspaceId,
  workspaceFilter,
  getWorkspaceWithResolvedConfig,
  updateWorkspaceConfig,
  setWorkspaceVertical,
} from "@core/workspace"
