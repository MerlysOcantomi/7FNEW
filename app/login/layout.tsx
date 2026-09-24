import type { Metadata } from "next"
import { headers } from "next/headers"
import { resolveEntryProductFromHost } from "@core/product-entry"

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const product = resolveEntryProductFromHost(h.get("host"))

  if (product?.key === "finesse") {
    return {
      title: "Finesse — Entrar",
      description: "Accede a Finesse para organizar tu negocio de belleza.",
      robots: { index: false, follow: false },
    }
  }

  if (product?.key === "bonabasto") {
    return {
      title: "Bonabasto — Entrar",
      description: "Accede a Bonabasto para organizar tu negocio de comida y hostelería.",
      robots: { index: false, follow: false },
    }
  }

  return {
    title: "7F Workspace",
    description: "Business management platform.",
    robots: { index: false, follow: false },
  }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
