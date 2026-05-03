import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Building2, Gauge, Users, Plug } from "lucide-react"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import {
  getWorkspaceSystemDetail,
  type SystemWorkspaceMemberSummary,
  type SystemWorkspaceChannelSummary,
  type SystemWorkspacePlanSummary,
} from "@core/system/workspaces"
import { WorkspacePlanEditor } from "@/components/system/workspace-plan-editor"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Workspace · SevenF System Admin",
}

/**
 * Read-only detail of a single workspace for PlatformAdmins.
 *
 * Renders three sections:
 *   1. Overview card with metadata.
 *   2. Members table (userId, name, email, role, joined-at).
 *   3. Connected channels table (type, provider, account, status, last sync).
 *
 * Same authorisation contract as the listing: platform-role gated. We do
 * NOT enter a workspace context here — `wf_workspace` is never touched and
 * `requireRoleInWorkspace` is intentionally NOT called.
 */
export default async function SystemWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { platformRole } = await requireAnyPlatformRole()
  const { id } = await params
  const detail = await getWorkspaceSystemDetail(id)
  if (!detail) notFound()

  const { workspace, plan, members, channels } = detail

  /**
   * Mutation gate. Mirrors the API gate (`requirePlatformAdmin()` ≥ ADMIN)
   * so SUPPORT/BILLING admins see the read-only PlanCard and a disabled
   * editor with an explanatory note, instead of an action that would
   * silently 403 on submit.
   */
  const canMutate = platformRole === "SUPER_ADMIN" || platformRole === "ADMIN"

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href="/system/workspaces"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-amber-800 transition-colors hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
        >
          <ArrowLeft size={12} />
          <span>Workspaces</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-amber-900 dark:text-amber-100">
          <Building2 size={16} />
          <h1 className="text-lg font-semibold">{workspace.nombre}</h1>
          <code className="rounded bg-amber-100/70 px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {workspace.slug}
          </code>
          <span className="inline-flex items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
            {workspace.plan}
          </span>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
          Read-only · No se muestran mensajes, contenido de inbox, ni credenciales.
        </p>
      </header>

      <section className="rounded-lg border border-amber-200/60 bg-white/60 p-4 dark:border-amber-900/30 dark:bg-amber-950/10">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/60">
          Overview
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="ID">
            <code className="font-mono text-[11px] text-amber-900/80 dark:text-amber-100/80">
              {workspace.id}
            </code>
          </DetailItem>
          <DetailItem label="Slug">{workspace.slug}</DetailItem>
          <DetailItem label="Plan">{plan.planLabel}</DetailItem>
          <DetailItem label="Vertical">{workspace.vertical ?? "—"}</DetailItem>
          <DetailItem label="Created">{formatDate(workspace.createdAt)}</DetailItem>
          <DetailItem label="Updated">{formatDate(workspace.updatedAt)}</DetailItem>
        </dl>
      </section>

      <PlanCard
        workspaceId={workspace.id}
        plan={plan}
        vertical={workspace.vertical}
        canMutate={canMutate}
      />

      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="flex items-center gap-2 border-b border-amber-200/60 px-3 py-2 text-amber-900 dark:border-amber-900/30 dark:text-amber-100">
          <Users size={14} />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Members</h2>
          <span className="ml-auto text-[11px] text-amber-900/60 dark:text-amber-100/50">
            {members.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/40 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/20 dark:text-amber-100/70">
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {members.length === 0 ? (
                <EmptyRow colSpan={4} message="Este workspace no tiene miembros." />
              ) : (
                members.map((m) => <MemberRow key={m.userId} m={m} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="flex items-center gap-2 border-b border-amber-200/60 px-3 py-2 text-amber-900 dark:border-amber-900/30 dark:text-amber-100">
          <Plug size={14} />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">
            Connected channels
          </h2>
          <span className="ml-auto text-[11px] text-amber-900/60 dark:text-amber-100/50">
            {channels.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/40 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/20 dark:text-amber-100/70">
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Provider</Th>
                <Th>Account</Th>
                <Th>Status</Th>
                <Th>Last sync</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {channels.length === 0 ? (
                <EmptyRow colSpan={7} message="Sin canales conectados." />
              ) : (
                channels.map((c) => <ChannelRow key={c.id} c={c} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MemberRow({ m }: { m: SystemWorkspaceMemberSummary }) {
  return (
    <tr className="text-amber-950 dark:text-amber-50">
      <Td>
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{m.userName ?? "—"}</span>
          <span className="text-[10px] font-mono text-amber-800/60 dark:text-amber-200/60">
            {m.userId.slice(0, 12)}…
          </span>
        </div>
      </Td>
      <Td>{m.userEmail}</Td>
      <Td>
        <span className="inline-flex items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
          {m.role}
        </span>
      </Td>
      <Td>
        <span className="text-xs text-amber-900/70 dark:text-amber-100/60">
          {formatDate(m.createdAt)}
        </span>
      </Td>
    </tr>
  )
}

function ChannelRow({ c }: { c: SystemWorkspaceChannelSummary }) {
  return (
    <tr className="text-amber-950 dark:text-amber-50">
      <Td>
        <span className="font-medium">{c.name}</span>
      </Td>
      <Td>
        <code className="rounded bg-amber-100/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {c.channelType}
        </code>
      </Td>
      <Td>{c.provider}</Td>
      <Td>
        <span className="text-xs">{c.externalAccountId ?? "—"}</span>
      </Td>
      <Td>
        <StatusPill status={c.status} isActive={c.isActive} />
      </Td>
      <Td>
        <span
          className="text-xs text-amber-900/70 dark:text-amber-100/60"
          title={c.lastSyncAt ?? undefined}
        >
          {c.lastSyncAt ? formatDate(c.lastSyncAt) : "—"}
        </span>
      </Td>
      <Td>
        <span className="text-xs text-amber-900/70 dark:text-amber-100/60">
          {formatDate(c.createdAt)}
        </span>
      </Td>
    </tr>
  )
}

function StatusPill({ status, isActive }: { status: string; isActive: boolean }) {
  const cls = isActive
    ? "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300"
    : "border-zinc-300/60 text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300"
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  )
}

function DetailItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
        {label}
      </dt>
      <dd className="text-amber-950 dark:text-amber-50">{children}</dd>
    </div>
  )
}

/**
 * Read-only "Plan & limits" card. Surfaces the resolved plan, current usage
 * vs. limits, AI credit allowance, enabled modules and vertical.
 *
 * IMPORTANT: nothing here is enforced today. The card is a snapshot; member
 * creation, channel connection and AI usage are NOT blocked by these
 * numbers. The `seatLimitReached` / `channelLimitReached` flags only flip
 * the cell colour so operators can spot tenants over their tier.
 */
function PlanCard({
  workspaceId,
  plan,
  vertical,
  canMutate,
}: {
  workspaceId: string
  plan: SystemWorkspacePlanSummary
  vertical: string | null
  canMutate: boolean
}) {
  return (
    <section className="rounded-lg border border-amber-200/60 bg-white/60 p-4 dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="mb-3 flex items-center gap-2 text-amber-900 dark:text-amber-100">
        <Gauge size={14} />
        <h2 className="text-[11px] font-semibold uppercase tracking-wide">
          Plan &amp; limits
        </h2>
        {plan.isUnknownPlan ? (
          <span
            title={`Valor en BD: "${plan.rawPlan}". Fallback aplicado: free.`}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300"
          >
            <AlertTriangle size={10} />
            Plan desconocido
          </span>
        ) : null}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Plan">
          <span className="inline-flex items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
            {plan.planLabel}
          </span>
        </DetailItem>
        <DetailItem label="Vertical">{vertical ?? "—"}</DetailItem>
        <DetailItem label="AI credits / month">
          {plan.aiCreditsMonthly === null
            ? "Unlimited"
            : plan.aiCreditsMonthly.toLocaleString("en-US")}
        </DetailItem>
        <DetailItem label="Seats">
          <UsageInline
            usage={plan.seatUsage}
            limit={plan.includedSeats}
            reached={plan.seatLimitReached}
          />
        </DetailItem>
        <DetailItem label="Channels">
          <UsageInline
            usage={plan.channelUsage}
            limit={plan.maxChannels}
            reached={plan.channelLimitReached}
          />
        </DetailItem>
        <DetailItem label="Plan key (raw)">
          <code className="font-mono text-[11px] text-amber-900/80 dark:text-amber-100/80">
            {plan.rawPlan || "—"}
          </code>
        </DetailItem>
      </dl>

      <div className="mt-4 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
          Enabled modules
        </span>
        <ModuleChips modules={plan.enabledModules} />
      </div>

      {/**
        * Plan editor lives at the bottom of the card. Always rendered so
        * SUPPORT/BILLING discover the gate; only operable by ADMIN+.
        */}
      <div className="mt-4 border-t border-amber-200/50 pt-3 dark:border-amber-900/30">
        <WorkspacePlanEditor
          workspaceId={workspaceId}
          currentPlan={plan.planKey}
          canMutate={canMutate}
        />
      </div>

      <p className="mt-3 text-[10px] italic text-amber-900/50 dark:text-amber-100/40">
        Limits are observational — no enforcement is wired yet. Cambiar el
        plan no factura ni reasigna módulos automáticamente fuera de su
        nueva definición.
      </p>
    </section>
  )
}

function UsageInline({
  usage,
  limit,
  reached,
}: {
  usage: number
  limit: number | null
  reached: boolean
}) {
  const limitText = limit === null ? "Unlimited" : limit
  const cls = reached
    ? "text-amber-700 dark:text-amber-300"
    : "text-amber-950 dark:text-amber-50"
  return (
    <span
      className={`tabular-nums ${cls}`}
      title={reached ? "Límite alcanzado (no bloqueante)" : undefined}
    >
      {usage} / {limitText}
    </span>
  )
}

function ModuleChips({ modules }: { modules: readonly string[] }) {
  if (!modules.length) {
    return (
      <span className="text-[11px] italic text-amber-900/50 dark:text-amber-100/40">
        —
      </span>
    )
  }
  if (modules.length === 1 && modules[0] === "all") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
        All modules
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {modules.map((m) => (
        <span
          key={m}
          className="inline-flex items-center rounded-full bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {m}
        </span>
      ))}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-6 text-center text-xs text-amber-900/60 dark:text-amber-100/50"
      >
        {message}
      </td>
    </tr>
  )
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}
