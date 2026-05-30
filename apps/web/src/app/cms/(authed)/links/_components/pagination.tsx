'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginacao" className="flex items-center justify-center gap-1 pt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Pagina anterior"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        ←
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let p: number
        if (totalPages <= 7) {
          p = i + 1
        } else if (page <= 4) {
          p = i + 1
        } else if (page >= totalPages - 3) {
          p = totalPages - 6 + i
        } else {
          p = page - 3 + i
        }
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Pagina ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p}
          </button>
        )
      })}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Proxima pagina"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        →
      </button>
    </nav>
  )
}
