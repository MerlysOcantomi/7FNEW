import type { ForteApprovalStore } from "./approval-store"
import { InMemoryForteApprovalStore } from "./approval-store"

let currentStore: ForteApprovalStore = new InMemoryForteApprovalStore()

export function getForteApprovalStore(): ForteApprovalStore {
  return currentStore
}

export function setForteApprovalStore(store: ForteApprovalStore): void {
  currentStore = store
}
