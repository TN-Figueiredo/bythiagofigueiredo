const navLinks = [
  { label: 'Início', href: '#top' },
  { label: 'Sobre', href: '#about' },
  { label: 'Experiência', href: '#experience' },
  { label: 'Projetos', href: '#projects' },
  { label: 'Contato', href: '#contact' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-6 text-center">
          <nav className="flex flex-wrap justify-center gap-6">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
            <p>Figueiredo Technology LTDA — CNPJ: 44.243.373/0001-69</p>
            <p>&copy; {year} Thiago Figueiredo. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
