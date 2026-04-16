import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import {
  createInvitationAction,
  revokeInvitation,
  resendInvitation,
} from './actions'
import { SubmitButton } from './_components/SubmitButton'
import { InviteForm, type SiteOption } from './invite-form'

export const dynamic = 'force-dynamic'

const noticeMessages: Record<string, string> = {
  resend_too_soon: 'Aguarde 30 segundos antes de reenviar.',
  resend_sent: 'Convite reenviado.',
  invitation_revoked: 'Convite revogado.',
  invite_created: 'Convite criado e enviado.',
  invite_failed: 'Falha ao criar convite. Tente novamente.',
  invite_rate_limited: 'Limite de 20 convites/hora excedido.',
  invite_duplicate: 'Já existe um convite pendente para esse email.',
}

interface Props {
  searchParams: Promise<{ notice?: string }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { notice } = await searchParams
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
  if (role !== 'owner' && role !== 'admin' && role !== 'org_admin') redirect('/cms')

  // Only reached if caller is org admin
  const supabase = getSupabaseServiceClient()

  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('org_id', ctx.orgId)

  const { data: siteMembers } = await supabase
    .from('site_memberships')
    .select('user_id, site_id, role, site:sites(name, primary_domain)')

  const { data: invites } = await supabase
    .from('invitations')
    .select('id, email, role, role_scope, site_id, expires_at, last_sent_at, resend_count')
    .eq('org_id', ctx.orgId)
    .is('accepted_at', null)
    .is('revoked_at', null)

  // Fetch sites belonging to the current org for the scope picker.
  const { data: sitesRaw } = await supabase
    .from('sites')
    .select('id, name, primary_domain')
    .eq('org_id', ctx.orgId)
    .order('name')
  const sites: SiteOption[] = (sitesRaw ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    primary_domain: (s.primary_domain as string | null) ?? '',
  }))

  // N15: enrich members with email via service-role admin getUserById
  type OrgMemberWithEmail = { user_id: string; role: string; email: string }
  const orgMembers: OrgMemberWithEmail[] = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id as string)
      return {
        user_id: m.user_id as string,
        role: m.role as string,
        email: data.user?.email ?? (m.user_id as string),
      }
    }),
  )

  type SiteMemberWithEmail = {
    user_id: string
    site_id: string
    role: string
    site_name: string
    email: string
  }
  const siteMembersWithEmail: SiteMemberWithEmail[] = await Promise.all(
    (siteMembers ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id as string)
      const site = (m.site as { name?: string } | null) ?? {}
      return {
        user_id: m.user_id as string,
        site_id: m.site_id as string,
        role: m.role as string,
        site_name: site.name ?? '',
        email: data.user?.email ?? (m.user_id as string),
      }
    }),
  )

  const noticeMessage =
    notice != null ? (noticeMessages[notice] ?? null) : null
  const isError =
    notice != null &&
    (notice.startsWith('invite_failed') ||
      notice === 'invite_rate_limited' ||
      notice === 'invite_duplicate')

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Usuários e convites</h1>

      {noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {noticeMessage}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Org admins ({orgMembers.length})
        </h2>
        <ul className="space-y-2">
          {orgMembers.map((m) => (
            <li key={m.user_id} className="text-sm text-gray-700 flex items-center gap-3">
              <span>
                {m.email} · {m.role}
              </span>
              <Link
                href={`/admin/users/${m.user_id}/edit`}
                className="text-blue-600 hover:underline text-xs"
              >
                editar
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Membros de sites ({siteMembersWithEmail.length})
        </h2>
        <ul className="space-y-2">
          {siteMembersWithEmail.map((m) => (
            <li
              key={`${m.user_id}:${m.site_id}`}
              className="text-sm text-gray-700 flex items-center gap-3"
            >
              <span>
                {m.email} · {m.site_name} · {m.role}
              </span>
              <Link
                href={`/admin/users/${m.user_id}/edit`}
                className="text-blue-600 hover:underline text-xs"
              >
                editar
              </Link>
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
                {inv.email as string} · {inv.role as string} (
                {inv.role_scope as string}) · expira em{' '}
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
        <InviteForm sites={sites} action={createInvitationAction} />
      </section>
    </main>
  )
}
