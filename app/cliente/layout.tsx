import { ClientUserProvider } from "@/hooks/use-client-user"

export const metadata = {
  title: "Client Portal — 7F",
  description: "Access your projects, invoices, and documents",
}

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClientUserProvider>{children}</ClientUserProvider>
}
