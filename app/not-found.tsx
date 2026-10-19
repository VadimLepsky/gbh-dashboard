import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <div className="text-sm text-muted-foreground">404</div>
      <h1 className="text-xl font-semibold tracking-tight">Stránka neexistuje</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Odkaz je možná zastaralý. Všechny přehledy najdete v menu vlevo.</p>
      <Link href="/" className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
        Zpět na přehled
      </Link>
    </div>
  )
}
