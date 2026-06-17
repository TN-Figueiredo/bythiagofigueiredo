import Link from 'next/link'
import { WAITLIST_SOURCE_LABELS, type WaitlistDetailData, type SignupsPage } from '../queries'

function sourceLabel(src: string | null): string {
  return src && src in WAITLIST_SOURCE_LABELS
    ? WAITLIST_SOURCE_LABELS[src as keyof typeof WAITLIST_SOURCE_LABELS]
    : '—'
}

function fmtDate(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16)
}

export interface SignupsTabProps {
  detail: WaitlistDetailData
  page: SignupsPage
  filters: { status?: 'pending' | 'suppressed'; q?: string }
}

function hrefFor(id: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams({ tab: 'signups' })
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  return `/cms/waitlists/${id}?${sp.toString()}`
}

export function SignupsTab({ detail, page, filters }: SignupsTabProps) {
  const { status, q } = filters
  const filterCls = (active: boolean) =>
    `rounded-full px-3 py-1 ${active ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:bg-cms-surface'}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={hrefFor(detail.id, { q })} aria-current={!status ? 'true' : undefined} className={filterCls(!status)}>
          All
        </Link>
        <Link
          href={hrefFor(detail.id, { status: 'pending', q })}
          aria-current={status === 'pending' ? 'true' : undefined}
          className={filterCls(status === 'pending')}
        >
          Pending
        </Link>
        <Link
          href={hrefFor(detail.id, { status: 'suppressed', q })}
          aria-current={status === 'suppressed' ? 'true' : undefined}
          className={filterCls(status === 'suppressed')}
        >
          Suppressed
        </Link>
        <form method="get" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="tab" value="signups" />
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="email prefix…"
            aria-label="Filter signups by email prefix"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1 text-sm text-cms-text outline-none focus:border-cms-accent"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left text-xs uppercase tracking-wide text-cms-text-muted">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-cms-text-muted">
                  No signups match these filters.
                </td>
              </tr>
            ) : (
              page.rows.map((r) => (
                <tr key={r.id} className="border-b border-cms-border last:border-0">
                  <td className="px-4 py-3 font-mono text-cms-text">{r.email}</td>
                  <td className="px-4 py-3 text-cms-text">
                    {r.status}
                    {r.status === 'suppressed' && r.suppressionReason && (
                      <span className="ml-1 text-xs text-cms-text-muted">· {r.suppressionReason}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted">{sourceLabel(r.sourceSurface)}</td>
                  <td className="px-4 py-3 text-cms-text-muted">{fmtDate(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page.nextCursor && (
        <Link
          href={hrefFor(detail.id, { status, q, c: `${page.nextCursor.createdAt}|${page.nextCursor.id}` })}
          className="self-end rounded-[var(--cms-radius)] border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-surface"
        >
          Next →
        </Link>
      )}
    </div>
  )
}
