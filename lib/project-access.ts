export function canAccessProject(
  project: {
    visibility: string
    createdBy?: string | null
    allowedUsers?: string | null
  },
  userId?: string | null,
  userRole?: string | null,
): boolean {
  if (userRole === "admin") return true

  if (project.visibility === "public") return true

  if (!userId) return false

  if (project.visibility === "private") {
    return project.createdBy === userId
  }

  if (project.visibility === "custom") {
    if (project.createdBy === userId) return true
    const allowed = parseAllowedUsers(project.allowedUsers)
    return allowed.includes(userId)
  }

  return true
}

export function parseAllowedUsers(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === "string")
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

export function serializeAllowedUsers(ids: string[]): string {
  return JSON.stringify(ids)
}
