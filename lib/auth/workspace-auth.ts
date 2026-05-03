// Re-export from new location — will be removed after full migration
export {
  RbacError,
  requireWorkspaceRole,
  requireReadAccess,
  requireWriteAccess,
  requireAdminAccess,
  requireOwnerAccess,
  requireRoleInWorkspace,
  requireViewerInWorkspace,
  requireMemberInWorkspace,
  requireAdminInWorkspace,
  requireOwnerInWorkspace,
} from "@core/auth/workspace-auth"
export type { WorkspaceRole, WorkspaceAuth } from "@core/auth/workspace-auth"
