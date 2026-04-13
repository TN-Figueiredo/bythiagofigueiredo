export function HubFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--border)] px-6 py-8 text-center">
      <div className="mx-auto max-w-2xl space-y-1 text-xs text-[var(--text-tertiary)]">
        <p>Figueiredo Technology LTDA — CNPJ: 44.243.373/0001-69</p>
        <p>&copy; {year} Thiago Figueiredo. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}
