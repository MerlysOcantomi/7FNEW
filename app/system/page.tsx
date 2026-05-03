import Link from "next/link"
import { getSessionFromCookies } from "@/lib/auth/session"
import { Building2, Users, ShieldCheck, ScrollText, CreditCard, ArrowRight, Mail } from "lucide-react"

/**
 * Welcome / landing page of the SevenF System Admin area.
 *
 * Phase 1 deliberately ships an empty control plane: the rails (model,
 * helper, session claim, dual layout, dropdown entry, middleware gate) are
 * in place but no actual admin features exist yet. This page makes that
 * explicit and previews what's coming next.
 *
 * Authorisation lives in the layout (and middleware); we just render here.
 */
export default async function SystemHomePage() {
  const session = await getSessionFromCookies()
  const email = session?.email ?? ""
  const role = session?.platformRole ?? "—"

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-amber-300/60 bg-white/70 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300">
            <ShieldCheck size={18} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Bienvenido al control plane de 7F
            </h1>
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
              Estás autenticado como <span className="font-medium">{email}</span> con rol de
              plataforma <span className="font-medium">{role}</span>.
            </p>
            <p className="mt-1 text-xs text-amber-800/70 dark:text-amber-100/60">
              Esta área NO está dentro de ningún workspace cliente. Los datos privados de Skina,
              MT-A, MT-B y demás tenants no son visibles desde aquí. Las acciones de operación se
              irán habilitando en próximas fases.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/60">
          Secciones
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ActiveCard
            href="/system/workspaces"
            icon={<Building2 size={14} />}
            title="Workspaces"
            description="Listado read-only de tenants con plan, miembros, conversaciones y canales."
          />
          <ActiveCard
            href="/system/users"
            icon={<Users size={14} />}
            title="Users"
            description="Listado global de usuarios, rol de plataforma y workspaces a los que pertenece."
          />
          <ActiveCard
            href="/system/allowed-emails"
            icon={<Mail size={14} />}
            title="Allowed emails"
            description="Allowlist global para invite-only Google login. Crear, editar rol y revocar."
          />
          <PlannedCard
            icon={<ShieldCheck size={14} />}
            title="Admins"
            description="Promover y revocar PlatformAdmins. Solo accesible para SUPER_ADMIN."
          />
          <ActiveCard
            href="/system/audit"
            icon={<ScrollText size={14} />}
            title="Audit log"
            description="Registro append-only de toda mutación del control plane (últimos 100 eventos)."
          />
          <PlannedCard
            icon={<CreditCard size={14} />}
            title="Billing"
            description="Planes, facturación y uso por tenant."
          />
        </div>
      </section>
    </div>
  )
}

function PlannedCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-amber-200/60 bg-white/50 p-3 dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <span className="text-amber-700 dark:text-amber-300">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-auto rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Soon
        </span>
      </div>
      <p className="text-xs leading-snug text-amber-900/70 dark:text-amber-100/60">
        {description}
      </p>
    </div>
  )
}

/**
 * Active section card. Visually distinguishable from `PlannedCard` (no "Soon"
 * badge, different hover treatment) and uses `next/link` because it stays
 * within the `/system` layout — no need to abandon the platform shell.
 */
function ActiveCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-md border border-amber-300/70 bg-white/80 p-3 transition-colors hover:border-amber-400 hover:bg-white dark:border-amber-700/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
    >
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
        <span className="text-amber-700 dark:text-amber-300">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
        <ArrowRight
          size={12}
          className="ml-auto text-amber-700/60 transition-transform group-hover:translate-x-0.5 dark:text-amber-300/60"
        />
      </div>
      <p className="text-xs leading-snug text-amber-900/70 dark:text-amber-100/70">
        {description}
      </p>
    </Link>
  )
}
