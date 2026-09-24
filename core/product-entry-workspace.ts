import { db } from "@core/db"
import {
  buildInitialEntryWorkspaceConfig,
  getEntryProductByKey,
  requiresEntryOnboarding,
  type EntryProductKey,
} from "@core/product-entry"

export interface ProductWorkspaceResolution {
  workspaceId: string
  created: boolean
  onboardingRequired: boolean
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace"
}

async function nextAvailableSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    attempt += 1
    slug = `${base}-${attempt}`
  }
  return slug
}

/**
 * Resolve one stable workspace for a product vertical. Repeated logins never
 * create duplicates. Existing non-product workspaces stay untouched.
 */
export async function ensureUserHasProductWorkspace(
  userId: string,
  productKey: EntryProductKey,
): Promise<ProductWorkspaceResolution> {
  const product = getEntryProductByKey(productKey)
  if (!product) throw new Error(`Unknown entry product: ${productKey}`)

  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: {
        select: { id: true, verticalKey: true, config: true },
      },
    },
  })

  const existing = memberships.find((membership) => {
    if (membership.workspace.verticalKey !== product.verticalKey) return false
    let experienceKey: string | null = null
    try {
      const parsed = membership.workspace.config
        ? (JSON.parse(membership.workspace.config) as { experience?: { key?: unknown } })
        : null
      experienceKey =
        typeof parsed?.experience?.key === "string" ? parsed.experience.key : null
    } catch {
      experienceKey = null
    }

    if (experienceKey === product.experienceKey) return true
    return product.legacyVerticalOnlyMatch === true && experienceKey === null
  })
  if (existing) {
    return {
      workspaceId: existing.workspaceId,
      created: false,
      onboardingRequired: requiresEntryOnboarding(existing.workspace.config, product.key),
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, nombre: true },
  })
  if (!user) throw new Error("Cannot create product workspace for missing user")

  const identityBase = slugify(user.email?.split("@")[0] || user.nombre || userId)
  const slug = await nextAvailableSlug(`${identityBase}-${product.key}`)
  const config = buildInitialEntryWorkspaceConfig(product)

  const workspace = await db.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        nombre: user.nombre ? `${product.visibleName} · ${user.nombre}` : product.visibleName,
        slug,
        vertical: product.verticalKey,
        verticalKey: product.verticalKey,
        config,
      },
    })

    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: created.id,
        role: "OWNER",
      },
    })

    return created
  })

  return {
    workspaceId: workspace.id,
    created: true,
    onboardingRequired: true,
  }
}
