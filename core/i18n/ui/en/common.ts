import type { CommonMessages } from "../types"

/** English source for the `common` UI namespace. */
export const common: CommonMessages = {
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  confirm: "Confirm",
  search: "Search",
  loading: "Loading…",
  saveChanges: "Save changes",
  notifications: {
    label: "Notifications",
    newCount: (count) => `${count} new`,
    markAllRead: "Mark all as read",
    empty: "No notifications",
    viewAll: "View all notifications",
  },
}
