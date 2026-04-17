import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSiteContext } from '../../../../../lib/cms/site-context'

export const dynamic = 'force-dynamic'

/**
 * Track G2 — audit log viewer.
 *
 * Lists rows from `public.audit_log` most-recent-first. RLS on the table is
 * authoritative: `audit_log_read` policy allows `is_super_admin()` and
 * `is_org_admin(org_id)` — authors/editors/reporters get an empty view.
 *
 * As a defensive first pass we also redirect non-org-admins to /cms before
 * building the query so we don't even send the SELECT (mirrors the existing
 * admin/users pattern).
 *
 * Pagination: simple offset/limit via `?page=N` (100 rows/page). RLS-gated
 * count() would be slow on wide tables; we just ask for `page+1`'s first
 * row to know if there's a "next" link without a full count.
 */

const PAGE_SIZE = 100

interface Props {
  searchParams: Promise<{ org?: string; page?: string; action?: string; resource?: string }>
}

type AuditRow = {
  id: string
  created_at: string
  actor_user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  org_id: string | null
  site_id: string | null
  ip: string | null
  user_agent: string | null
}

export default async function AuditPage({ searchParams }: Props) {
  const { org, page: pageStr, action: actionFilter, resource: resourceFilter } =
    await searchParams
  const page = Math.max(0, Number.parseInt(pageStr ?? '0', 10) || 0)

  const ctx = await getSiteContext()
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )

  // Defense-in-depth: RLS would hide the rows anyway, but redirect
  // non-admins so the page itself isn't reachable via role escalation.
  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  if (role !== 'owner' && role !== 'admin' && role !== 'org_admin') {
    redirect('/cms')
  }

  // Use the user-scoped client so RLS (`audit_log_read`) applies. We still
  // fetch PAGE_SIZE + 1 rows to detect "has next page" without a count query.
  let query = userClient
    .from('audit_log')
    .select(
      'id, created_at, actor_user_id, action, resource_type, resource_id, org_id, site_id, ip, user_agent',
    )
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) // PAGE_SIZE + 1 rows inclusive

  if (org) query = query.eq('org_id', org)
  if (actionFilter) query = query.eq('action', actionFilter)
  if (resourceFilter) query = query.eq('resource_type', resourceFilter)

  const { data: rows, error } = await query

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-6">Audit log</h1>
        <p className="text-sm text-red-600">
          Não foi possível carregar o audit log: {error.message}
        </p>
      </main>
    )
  }

  const results = (rows ?? []) as AuditRow[]
  const hasNextPage = results.length > PAGE_SIZE
  const pageRows = hasNextPage ? results.slice(0, PAGE_SIZE) : results

  function linkForPage(n: number): string {
    const params = new URLSearchParams()
    if (org) params.set('org', org)
    if (actionFilter) params.set('action', actionFilter)
    if (resourceFilter) params.set('resource', resourceFilter)
    if (n > 0) params.set('page', String(n))
    const qs = params.toString()
    return qs ? `/admin/audit?${qs}` : '/admin/audit'
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Audit log</h1>

      <form
        method="GET"
        action="/admin/audit"
        className="mb-4 flex flex-wrap gap-3 items-end text-sm"
      >
        <div>
          <label htmlFor="f-action" className="block font-medium mb-1">
            Ação
          </label>
          <select
            id="f-action"
            name="action"
            defaultValue={actionFilter ?? ''}
            className="border rounded px-2 py-1"
          >
            <option value="">todas</option>
            <option value="insert">insert</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-resource" className="block font-medium mb-1">
            Recurso
          </label>
          <select
            id="f-resource"
            name="resource"
            defaultValue={resourceFilter ?? ''}
            className="border rounded px-2 py-1"
          >
            <option value="">todos</option>
            <option value="invitations">invitations</option>
            <option value="site_memberships">site_memberships</option>
            <option value="organization_members">organization_members</option>
          </select>
        </div>
        {org && <input type="hidden" name="org" value={org} />}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
        >
          Filtrar
        </button>
      </form>

      <p className="text-xs text-gray-500 mb-2">
        Mostrando {pageRows.length} linha{pageRows.length === 1 ? '' : 's'} · página {page + 1}
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 border-b">Data</th>
              <th className="px-3 py-2 border-b">Ator</th>
              <th className="px-3 py-2 border-b">Ação</th>
              <th className="px-3 py-2 border-b">Recurso</th>
              <th className="px-3 py-2 border-b">Site</th>
              <th className="px-3 py-2 border-b">IP</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                <td className="px-3 py-2 border-b whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 border-b font-mono text-xs">
                  {row.actor_user_id ?? '—'}
                </td>
                <td className="px-3 py-2 border-b">{row.action}</td>
                <td className="px-3 py-2 border-b">
                  {row.resource_type}
                  {row.resource_id ? `#${String(row.resource_id).slice(0, 8)}` : ''}
                </td>
                <td className="px-3 py-2 border-b font-mono text-xs">
                  {row.site_id ? String(row.site_id).slice(0, 8) : '—'}
                </td>
                <td className="px-3 py-2 border-b font-mono text-xs">{row.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex gap-3 text-sm">
        {page > 0 && (
          <a href={linkForPage(page - 1)} className="text-blue-600 hover:underline">
            ← Anterior
          </a>
        )}
        {hasNextPage && (
          <a href={linkForPage(page + 1)} className="text-blue-600 hover:underline">
            Próxima →
          </a>
        )}
      </nav>
    </main>
  )
}
