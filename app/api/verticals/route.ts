import { handleError } from "@/lib/api"
import { successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { listVerticals, parseJsonConfig } from "@/lib/verticals"

export async function GET() {
  try {
    await requireReadAccess()

    const verticals = await listVerticals({ activeOnly: true })
    const result = verticals.map((v) => ({
      key: v.key,
      name: v.name,
      description: v.description,
      defaultConfig: parseJsonConfig(v.defaultConfig),
    }))

    return successResponse(result)
  } catch (error) {
    return handleError(error, "Vertical")
  }
}
