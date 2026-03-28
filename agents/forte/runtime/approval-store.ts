import type { ApprovalRequest } from "./approval"

export interface ForteApprovalStore {
  create(request: ApprovalRequest): Promise<ApprovalRequest>
  getById(planId: string): Promise<ApprovalRequest | null>
  update(request: ApprovalRequest): Promise<ApprovalRequest>
  delete?(planId: string): Promise<void>
}

function cloneRequest(request: ApprovalRequest): ApprovalRequest {
  return structuredClone(request)
}

export class InMemoryForteApprovalStore implements ForteApprovalStore {
  private requests = new Map<string, ApprovalRequest>()

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    if (this.requests.has(request.planId)) {
      throw new Error(`ApprovalRequest duplicado: ${request.planId}`)
    }

    const stored = cloneRequest(request)
    this.requests.set(request.planId, stored)
    return cloneRequest(stored)
  }

  async getById(planId: string): Promise<ApprovalRequest | null> {
    const request = this.requests.get(planId)
    return request ? cloneRequest(request) : null
  }

  async update(request: ApprovalRequest): Promise<ApprovalRequest> {
    if (!this.requests.has(request.planId)) {
      throw new Error(`ApprovalRequest no encontrado: ${request.planId}`)
    }

    const stored = cloneRequest(request)
    this.requests.set(request.planId, stored)
    return cloneRequest(stored)
  }

  async delete(planId: string): Promise<void> {
    this.requests.delete(planId)
  }
}

export function createInMemoryForteApprovalStore() {
  return new InMemoryForteApprovalStore()
}
