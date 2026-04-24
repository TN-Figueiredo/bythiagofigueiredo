'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  categories: string[]
  currentCategory: string | null
  allLabel: string
}

export function CategoryFilter({ categories, currentCategory, allLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function selectCategory(cat: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) {
      params.set('category', cat)
    } else {
      params.delete('category')
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">
      <button
        onClick={() => selectCategory(null)}
        className={`font-mono text-xs px-3 py-1.5 rounded transition-colors ${
          !currentCategory
            ? 'bg-pb-accent text-white'
            : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
        }`}
        aria-pressed={!currentCategory}
      >
        {allLabel}
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => selectCategory(cat)}
          className={`font-mono text-xs px-3 py-1.5 rounded capitalize transition-colors ${
            currentCategory === cat
              ? 'bg-pb-accent text-white'
              : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
          }`}
          aria-pressed={currentCategory === cat}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
