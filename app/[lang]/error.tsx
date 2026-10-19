'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Něco se pokazilo</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Přehled se nepodařilo spočítat. Zkuste to prosím znovu.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
      >
        Načíst znovu
      </button>
    </div>
  )
}
