'use client'

export interface PaginationProps {
  /** Current 1-based page number */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  onPageChange: (page: number) => void
  /** Total item count — used to render the "X–Y of Z" summary */
  totalItems?: number
  /** Items per page — used to render the "X–Y of Z" summary */
  pageSize?: number
}

/**
 * Shared CMS pagination bar.
 *
 * Renders nothing when `totalPages <= 1`.
 * Shows prev/next buttons plus a windowed page list (first, last, ±1 around
 * current, with ellipsis gaps).
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const showSummary =
    totalItems !== undefined && pageSize !== undefined

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(
      (p) =>
        p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
    )
    .reduce<(number | '…')[]>((acc, p, i, arr) => {
      if (
        i > 0 &&
        typeof arr[i - 1] === 'number' &&
        (p as number) - (arr[i - 1] as number) > 1
      ) {
        acc.push('…')
      }
      acc.push(p)
      return acc
    }, [])

  return (
    <nav
      className="flex items-center justify-between border-t border-cms-border px-4 py-3 text-sm text-cms-text-muted"
      aria-label="Pagination"
    >
      {showSummary ? (
        <span>
          {Math.min((currentPage - 1) * pageSize! + 1, totalItems!)}–
          {Math.min(currentPage * pageSize!, totalItems!)} of {totalItems}
        </span>
      ) : (
        <span>
          Page {currentPage} of {totalPages}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Previous page"
        >
          &#8249; Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`min-w-[28px] rounded px-2 py-1 text-xs ${
                p === currentPage
                  ? 'bg-cms-accent text-white'
                  : 'hover:bg-cms-surface-hover'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Next page"
        >
          Next &#8250;
        </button>
      </div>
    </nav>
  )
}
