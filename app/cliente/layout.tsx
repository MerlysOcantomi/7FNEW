import { ClientUserProvider } from "@/hooks/use-client-user"

export const metadata = {
  title: "Portal de Clientes — 7F",
  description: "Accede a tus proyectos, facturas y documentos",
}

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClientUserProvider>{children}</ClientUserProvider>
}
