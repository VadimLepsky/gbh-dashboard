export function Footer() {
  return (
    <footer className="border-t border-border/60 px-4 py-5 sm:px-6 lg:px-8">
      <p className="mx-auto max-w-[1440px] text-xs leading-relaxed text-muted-foreground">
        Ukázková verze dashboardu postaveného pro obchodní oddělení GBH Defence. Všechna data jsou generovaná,
        instituce jsou smyšlené. Autor: Vadim Lepsky ·{' '}
        <a href="https://interflow.cz" target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
          Interflow (interflow.cz)
        </a>
        .
      </p>
    </footer>
  )
}
