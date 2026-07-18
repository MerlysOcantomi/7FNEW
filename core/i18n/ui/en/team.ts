import type { TeamMessages } from "../types"

/**
 * English source for the `team` UI namespace — the /usuarios journey (list,
 * cards, delete dialog, user form). `roles` are display labels for the
 * persisted role VALUES; status VALUE labels resolve through `statuses`.
 */
export const team: TeamMessages = {
  title: "Team",
  description: "Manage team members, roles, permissions, and system access.",
  newUser: "New user",
  roles: { admin: "Admin", gerente: "Manager", miembro: "Member" },
  stats: { total: "Total users", active: "Active", uniqueRoles: "Unique roles" },
  empty: { title: "No users", body: "No users found in the system." },
  card: { projectsPlaceholder: "— projects" },
  deleteDialog: {
    title: "Delete user",
    description: (name) =>
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    confirm: "Delete",
  },
  toasts: { deleted: "User deleted", deleteError: "Failed to delete" },
  form: {
    titleNew: "New user",
    titleEdit: "Edit user",
    fields: {
      name: "Name *",
      email: "Email *",
      role: "Role",
      status: "Status",
      department: "Department",
    },
    namePlaceholder: "Full name",
    emailPlaceholder: "user@company.com",
    departmentPlaceholder: "e.g. Design, Development, Strategy",
    errors: { nameRequired: "Name is required", emailRequired: "Email is required" },
    saving: "Saving...",
    create: "Create user",
    update: "Update user",
    toasts: {
      created: "User created",
      updated: "User updated",
      saveError: "Could not save user",
    },
  },
}
