import { NextRequest } from "next/server"
import { renderSql, resolveSqlDialect } from "@core/db-dialect"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import {
  buildAssignedUnseenQuery,
  buildLeadUnseenQuery,
  countFromRows,
  type CountRow,
} from "@modules/inbox/attention-queries"

export async function GET(request: NextRequest) {
  try {
    const { session, workspaceId } = await requireReadAccess(request)
    const userId = session.userId

    const newCount = await db.conversation.count({
      where: {
        workspaceId,
        status: "new",
      },
    })

    /**
     * The two "unseen" counts are raw SQL (see `modules/inbox/attention-queries.ts`),
     * rendered in the dialect of the configured client so placeholders and
     * identifiers are right on SQLite/Turso today and on PostgreSQL later.
     */
    const dialect = resolveSqlDialect()
    const assigned = renderSql(buildAssignedUnseenQuery({ workspaceId, userId }), dialect)
    const assignedUnseen = await db.$queryRawUnsafe<CountRow[]>(assigned.sql, ...assigned.params)

    const lead = renderSql(buildLeadUnseenQuery({ workspaceId, userId }), dialect)
    const leadUnseen = await db.$queryRawUnsafe<CountRow[]>(lead.sql, ...lead.params)

    const assignedCount = countFromRows(assignedUnseen)
    const leadCount = countFromRows(leadUnseen)
    const total = newCount + assignedCount + leadCount

    return successResponse({ total, breakdown: { new: newCount, assignedUnseen: assignedCount, leadUnseen: leadCount } })
  } catch (error) {
    return handleError(error, "AttentionCount")
  }
}
