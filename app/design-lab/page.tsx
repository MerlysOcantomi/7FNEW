import type { Metadata } from "next"
import DesignLabClient from "./design-lab-client"

export const metadata: Metadata = {
  title: "Forte Design Foundation | sevenef Lab",
  robots: { index: false, follow: false },
}

export default function DesignLabPage() {
  return <DesignLabClient />
}
