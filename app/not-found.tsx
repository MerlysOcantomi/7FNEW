import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-2">Page not found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
