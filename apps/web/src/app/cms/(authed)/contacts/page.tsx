import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { StatusBadge } from '@/components/cms/ui'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ notice?: string; error?: string }>
}

const noticeMessages: Record<string, string> = {
  marked_replied: 'Contato marcado como respondido.',
}

export default async function CmsContactsPage({ searchParams }: Props) {
  const { notice, error: errorParam } = await searchParams
  const ctx = await getSiteContext()

  // Authz: require at least editor role
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
  const { data: canAdmin } = await userClient.rpc('can_admin_site', {
    p_site_id: ctx.siteId,
  })
  if (canAdmin !== true) redirect('/cms')

  const supabase = getSupabaseServiceClient()
  const { data: submissions } = await supabase
    .from('contact_submissions')
    .select('id, name, email, message, submitted_at, replied_at')
    .eq('site_id', ctx.siteId)
    .order('submitted_at', { ascending: false })
    .limit(100)

  const noticeMessage = notice != null ? (noticeMessages[notice] ?? null) : null

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-cms-text">Contatos recebidos</h1>

      {noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-[var(--cms-radius)] border border-[rgba(34,197,94,.3)] px-4 py-3 text-sm bg-cms-green-subtle text-cms-green"
        >
          {noticeMessage}
        </div>
      )}

      {errorParam && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-[var(--cms-radius)] border border-[rgba(239,68,68,.3)] px-4 py-3 text-sm bg-cms-red-subtle text-cms-red"
        >
          Erro ao processar ação.
        </div>
      )}

      {!submissions || submissions.length === 0 ? (
        <p className="text-cms-text-dim">Nenhum contato recebido ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-cms-border">
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">Nome</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">Email</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">Data</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">Status</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">Ação</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id as string} className="border-b border-cms-border transition-colors hover:bg-cms-surface-hover">
                  <td className="px-4 py-3 text-sm text-cms-text">{sub.name as string}</td>
                  <td className="px-4 py-3 text-sm text-cms-text">{sub.email as string}</td>
                  <td className="px-4 py-3 text-xs text-cms-text-muted">
                    {String(sub.submitted_at).slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    {sub.replied_at ? (
                      <StatusBadge variant="confirmed" label="Respondido" pill />
                    ) : (
                      <StatusBadge variant="pending" label="Pendente" pill />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cms/contacts/${sub.id as string}`}
                      className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
