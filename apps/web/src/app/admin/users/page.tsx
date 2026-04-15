import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { createInvitation, revokeInvitation, resendInvitation } from './actions'
import { SubmitButton } from './_components/SubmitButton'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
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

  // I10: authz check BEFORE constructing service-role client / fetching data
  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  if (role !== 'owner' && role !== 'admin') redirect('/cms')

  // Only reached if caller is owner or admin
  const supabase = getSupabaseServiceClient()

  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('org_id', ctx.orgId)
  const { data: invites } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at, last_sent_at, resend_count')
    .eq('org_id', ctx.orgId)
    .is('accepted_at', null)
    .is('revoked_at', null)

  // N15: enrich members with email via service-role admin getUserById
  type MemberWithEmail = { user_id: string; role: string; email: string }
  const membersWithEmail: MemberWithEmail[] = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id as string)
      return {
        user_id: m.user_id as string,
        role: m.role as string,
        email: data.user?.email ?? m.user_id as string,
      }
    }),
  )

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Usuários e convites</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Membros ativos ({membersWithEmail.length})
        </h2>
        <ul className="space-y-2">
          {membersWithEmail.map((m) => (
            <li key={m.user_id} className="text-sm text-gray-700">
              {m.email} · {m.role}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Convites pendentes ({invites?.length ?? 0})
        </h2>
        <ul className="space-y-3">
          {invites?.map((inv) => (
            <li key={inv.id as string} className="flex items-center gap-4 text-sm">
              <span>
                {inv.email as string} · {inv.role as string} · expira em{' '}
                {String(inv.expires_at).slice(0, 10)}
              </span>
              <form
                action={async () => {
                  'use server'
                  await resendInvitation(inv.id as string)
                }}
              >
                <SubmitButton className="text-blue-600 hover:underline">
                  Reenviar
                </SubmitButton>
              </form>
              <form
                action={async () => {
                  'use server'
                  await revokeInvitation(inv.id as string)
                }}
              >
                <SubmitButton className="text-red-600 hover:underline">
                  Revogar
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Novo convite</h2>
        <form
          action={async (formData) => {
            'use server'
            await createInvitation({
              email: formData.get('email') as string,
              role: formData.get('role') as 'admin' | 'editor' | 'author',
            })
          }}
          className="flex gap-3 items-end"
        >
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              name="email"
              required
              placeholder="email@example.com"
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium mb-1">
              Papel
            </label>
            <select id="invite-role" name="role" className="border rounded px-3 py-2 text-sm">
              <option value="author">author</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <SubmitButton className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700">
            Convidar
          </SubmitButton>
        </form>
      </section>
    </main>
  )
}
