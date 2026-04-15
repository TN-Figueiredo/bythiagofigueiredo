import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'

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
  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  if (!role) redirect('/cms')

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
      <h1 className="text-2xl font-bold mb-6">Contatos recebidos</h1>

      {noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700"
        >
          {noticeMessage}
        </div>
      )}

      {errorParam && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700"
        >
          Erro ao processar ação.
        </div>
      )}

      {!submissions || submissions.length === 0 ? (
        <p className="text-gray-500">Nenhum contato recebido ainda.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4 font-medium">Nome</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Data</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id as string} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{sub.name as string}</td>
                <td className="py-2 pr-4">{sub.email as string}</td>
                <td className="py-2 pr-4">
                  {String(sub.submitted_at).slice(0, 10)}
                </td>
                <td className="py-2 pr-4">
                  {sub.replied_at ? (
                    <span className="text-green-600">Respondido</span>
                  ) : (
                    <span className="text-yellow-600">Pendente</span>
                  )}
                </td>
                <td className="py-2">
                  <Link
                    href={`/cms/contacts/${sub.id as string}`}
                    className="text-blue-600 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
