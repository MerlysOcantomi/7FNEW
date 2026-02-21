export type Role = "admin" | "editor" | "viewer"

export const ROLES: Role[] = ["admin", "editor", "viewer"]

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Solo lectura",
}

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
}

export function hasMinRole(userRole: string, requiredRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole]
  return userLevel >= requiredLevel
}

export function isAdmin(role: string): boolean {
  return role === "admin"
}

export function canEdit(role: string): boolean {
  return hasMinRole(role, "editor")
}

export function canView(role: string): boolean {
  return hasMinRole(role, "viewer")
}

const ADMIN_ONLY_PATHS = ["/admin"]
const EDITOR_PATHS = ["/finanzas", "/motor", "/calendario", "/facturacion"]

export function getRequiredRoleForPath(pathname: string): Role {
  if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) return "admin"
  if (EDITOR_PATHS.some((p) => pathname.startsWith(p))) return "editor"
  return "viewer"
}

const PUBLIC_PATHS = ["/login", "/api/auth"]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}
