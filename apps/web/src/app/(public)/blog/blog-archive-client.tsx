'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { BlogFilterBar } from './blog-filter-bar'
import { WritingCard } from './writing-card'
import type { PatternName } from './post-pattern'

// ---------------------------------------------------------------------------
// ArchivePost interface (source of truth — re-exported for consumers)
// ---------------------------------------------------------------------------
export interface ArchivePost {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  categoryColor: string
  categoryColorDark?: string
  categoryLabel: string
  date: string
  isoDate: string
  readingTime: number
  tags: string[]
  coverUrl: string | null
  patternName: PatternName
  previousPostId?: string | null
  continuesInNext?: boolean
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface BlogArchiveClientProps {
  posts: ArchivePost[]
  categories: Array<{ key: string; label: string; color: string; count: number }>
  tags: Array<{ tag: string; count: number }>
  locale: 'pt-BR' | 'en'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BATCH = 6
const DEBOUNCE_MS = 150
const SESSION_KEY = 'btf_blog_filters'

const theme = {
  bg: '#1E1A12',
  ink: '#EFE6D2',
  muted: '#958A75',
  faint: '#6B634F',
  accent: '#FF8240',
  line: '#2E2718',
}

type Filters = { cat: string; tag: string; q: string; sort: string }

const DEFAULT_FILTERS: Filters = { cat: '', tag: '', q: '', sort: 'recent' }

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
function readSessionFilters(): Filters | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Filters
  } catch {
    return null
  }
}

function writeSessionFilters(f: Filters): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(f))
  } catch {
    // storage unavailable
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BlogArchiveClient({ posts, categories, tags, locale }: BlogArchiveClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isPt = locale === 'pt-BR'

  // --- Initialize filters from URL or sessionStorage ---
  const [filters, setFilters] = useState<Filters>(() => {
    const urlCat = searchParams.get('cat') || ''
    const urlTag = searchParams.get('tag') || ''
    const urlQ = searchParams.get('q') || ''
    const urlSort = searchParams.get('sort') || 'recent'

    const hasUrlParams = !!(urlCat || urlTag || urlQ || urlSort !== 'recent')
    if (hasUrlParams) {
      return { cat: urlCat, tag: urlTag, q: urlQ, sort: urlSort }
    }

    const session = readSessionFilters()
    if (session) return session

    return DEFAULT_FILTERS
  })

  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstNewCardRef = useRef<HTMLDivElement | null>(null)
  const prevPageRef = useRef(1)

  // --- URL sync (debounced) ---
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (filters.cat) params.set('cat', filters.cat)
      if (filters.tag) params.set('tag', filters.tag)
      if (filters.q) params.set('q', filters.q)
      if (filters.sort !== 'recent') params.set('sort', filters.sort)
      const qs = params.toString()
      const url = qs ? `?${qs}` : window.location.pathname
      router.replace(url, { scroll: false })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filters, router])

  // --- Session storage persistence ---
  useEffect(() => {
    writeSessionFilters(filters)
  }, [filters])

  // --- Focus after load more ---
  useEffect(() => {
    if (page > prevPageRef.current && firstNewCardRef.current) {
      firstNewCardRef.current.focus({ preventScroll: false })
    }
    prevPageRef.current = page
  }, [page])

  // --- Filter/Sort logic ---
  const readStore = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new ReadProgressStore()
  }, [])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    let arr = posts.filter((p) => {
      if (filters.cat && p.category !== filters.cat) return false
      if (filters.tag && !p.tags.includes(filters.tag)) return false
      if (q) {
        const haystack = `${p.title} ${p.tags.join(' ')} ${p.slug} ${p.excerpt}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    switch (filters.sort) {
      case 'recent':
        arr = arr.slice().sort((a, b) => (b.isoDate > a.isoDate ? 1 : -1))
        break
      case 'longest':
        arr = arr.slice().sort((a, b) => b.readingTime - a.readingTime)
        break
      case 'shortest':
        arr = arr.slice().sort((a, b) => a.readingTime - b.readingTime)
        break
      case 'unread': {
        arr = arr.slice().sort((a, b) => {
          const aRead = readStore?.isRead(a.id) ?? false
          const bRead = readStore?.isRead(b.id) ?? false
          if (aRead !== bRead) return aRead ? 1 : -1
          return b.isoDate > a.isoDate ? 1 : -1
        })
        break
      }
    }

    return arr
  }, [posts, filters, readStore])

  // Reset page when filters change
  const handleFilterChange = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }, [])

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }, [])

  const hasFilters = !!(filters.cat || filters.tag || filters.q || filters.sort !== 'recent')

  // --- Pagination ---
  const visiblePosts = filtered.slice(0, page * BATCH)
  const remaining = filtered.length - visiblePosts.length
  const allShown = remaining <= 0
  const previousBatchEnd = (page - 1) * BATCH

  const handleLoadMore = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px 80px' }}>
      <style>{`
        @keyframes fadeSlideIn {
          to { opacity: 1; transform: none; }
        }
        .blog-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          row-gap: 56px;
        }
        .blog-grid > div {
          content-visibility: auto;
          contain-intrinsic-size: auto 420px;
        }
        @media (max-width: 1023px) {
          .blog-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 28px;
            row-gap: 40px;
          }
        }
        @media (max-width: 767px) {
          .blog-grid {
            grid-template-columns: 1fr;
            gap: 0;
            row-gap: 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .writing-card-paper {
            transform: none !important;
            transition: none !important;
          }
          .blog-grid > div {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Page Header */}
      <header style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 42,
            fontWeight: 500,
            color: theme.ink,
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Blog
        </h1>
        <p
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 16,
            color: theme.muted,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {isPt
            ? 'Textos sobre código, produto, carreira e o que mais der vontade.'
            : 'Writing about code, product, career, and whatever else comes to mind.'}
        </p>
      </header>

      {/* Filter Bar */}
      <BlogFilterBar
        categories={categories}
        tags={tags}
        totalCount={posts.length}
        filteredCount={filtered.length}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        hasFilters={hasFilters}
        locale={locale}
      />

      {/* Grid or Empty State */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: '"Caveat", cursive',
              fontSize: 32,
              color: theme.muted,
            }}
          >
            {isPt ? 'nada por aqui.' : 'nothing here.'}
          </span>
          <span
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 14,
              color: theme.faint,
            }}
          >
            {isPt
              ? 'Nenhum post encontrado com esses filtros.'
              : 'No posts found with these filters.'}
          </span>
          <button
            onClick={handleReset}
            style={{
              marginTop: 16,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              padding: '8px 16px',
              border: `1.5px dashed ${theme.accent}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.accent,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isPt ? 'limpar filtros' : 'clear filters'}
          </button>
        </div>
      ) : (
        <>
          {/* Post Grid */}
          <div id="blog-grid" className="blog-grid">
            {visiblePosts.map((post, idx) => {
              const isNewBatch = idx >= previousBatchEnd && page > 1
              const isFirstNew = idx === previousBatchEnd && page > 1
              const animDelay = isNewBatch ? (idx - previousBatchEnd) * 50 : 0

              return (
                <div
                  key={post.id}
                  ref={isFirstNew ? firstNewCardRef : undefined}
                  tabIndex={isFirstNew ? -1 : undefined}
                  style={{
                    opacity: isNewBatch ? 0 : 1,
                    transform: isNewBatch ? 'translateY(12px)' : 'none',
                    animation: isNewBatch
                      ? `fadeSlideIn 300ms ${animDelay}ms forwards`
                      : 'none',
                  }}
                >
                  <WritingCard post={post} index={idx} locale={locale} />
                </div>
              )
            })}
          </div>

          {/* Load More / End Message */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 48,
            }}
          >
            {!allShown ? (
              <button
                onClick={handleLoadMore}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 12,
                  padding: '12px 24px',
                  border: `1.5px solid ${theme.line}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: theme.ink,
                  cursor: 'pointer',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  transition: 'border-color 0.15s',
                }}
              >
                {isPt
                  ? `Ver mais ${Math.min(BATCH, remaining)} de ${remaining} restantes`
                  : `Load ${Math.min(BATCH, remaining)} more of ${remaining} remaining`}
              </button>
            ) : (
              <span
                style={{
                  fontFamily: '"Caveat", cursive',
                  fontSize: 22,
                  color: theme.accent,
                }}
              >
                {isPt ? 'Isso é tudo! ↑' : "That's all! ↑"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
