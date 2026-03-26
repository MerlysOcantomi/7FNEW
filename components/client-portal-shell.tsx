"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClientUser } from "@/hooks/use-client-user"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Files,
  UserCircle,
  LogOut,
  Menu,
  Loader2,
  MessageSquarePlus,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard", href: "/cliente/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/cliente/proyecto", icon: FolderKanban },
  { label: "Invoices", href: "/cliente/facturas", icon: FileText },
  { label: "Requests", href: "/cliente/solicitudes", icon: MessageSquarePlus },
  { label: "Files", href: "/cliente/archivos", icon: Files },
  { label: "My profile", href: "/cliente/perfil", icon: UserCircle },
]

function SidebarContent({
  pathname,
  userName,
  userEmail,
  onNavClick,
  onLogout,
}: {
  pathname: string
  userName: string
  userEmail: string
  onNavClick?: () => void
  onLogout: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
          7F
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Client portal</p>
          <p className="text-xs text-white/60">Private workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4 shrink-0">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-white truncate">{userName}</p>
          <p className="text-xs text-white/50 truncate">{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  )
}

export function ClientPortalShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, logout } = useClientUser()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/cliente/login"
    }
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      {/* Desktop sidebar — hidden below md */}
      <aside className="hidden md:flex md:w-64 flex-col bg-[#1a3a5c] text-white shrink-0">
        <SidebarContent
          pathname={pathname}
          userName={user.nombre}
          userEmail={user.email}
          onLogout={logout}
        />
      </aside>

      {/* Mobile sidebar — Sheet drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-[#1a3a5c] border-r-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Portal navigation</SheetTitle>
          <SidebarContent
            pathname={pathname}
            userName={user.nombre}
            userEmail={user.email}
            onNavClick={() => setSidebarOpen(false)}
            onLogout={logout}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              Welcome, {user.nombre}
            </h1>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a3a5c] text-xs font-bold text-white shrink-0">
            {user.nombre.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              Welcome, {user.nombre}
            </h1>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a3a5c] text-xs font-bold text-white shrink-0">
            {user.nombre.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
