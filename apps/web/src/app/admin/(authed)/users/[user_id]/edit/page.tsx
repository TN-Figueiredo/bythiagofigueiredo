import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../../../lib/cms/site-context'
import {
  reassignContentAction,
  updateSiteMembershipRoleAction,
  revokeSiteMembershipAction,
} from '../../actions'
import { EditForm, type EditableMembership, type TargetCandidate } from './edit-form'

export const dynamic = 'force-dynamic'

const noticeMessages: Record<string, string> = {
  reassigned: 'Conteúdo reatribuído.',
  reassign_failed: 'Falha ao reatribuir conteúdo.',
  role_updated: 'Papel atualizado.',
  update_failed: 'Falha ao atualizar papel.',
  revoked: 'Acesso ao site removido.',
  revoke_failed: 'Falha ao remover acesso.',
}

interface Props {
  params: Promise<{ user_id: string }>
  searchParams: Promise<{ notice?: string }>
}

export default async function AdminUserEditPage({ params, searchParams }: Props) {
  const { user_id: userId } = await params
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

  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  if (role !== 'owner' && role !== 'admin' && role !== 'org_admin') {
    redirect('/cms')
  }

  const service = getSupabaseServiceClient()

  // Resolve target user email
  const { data: userData } = await service.auth.admin.getUserById(userId)
  if (!userData.user) {
    notFound()
  }
  const targetEmail = userData.user.email ?? userId

  // Org-level membership (org_admin) if any
  const { data: orgMember } = await service
    .from('organization_members')
    .select('role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', userId)
    .maybeSingle()

  // All site memberships for this user, restricted to sites in the current org
  const { data: siteRows } = await service
    .from('site_memberships')
    .select('site_id, role, site:sites!inner(name, primary_domain, org_id)')
    .eq('user_id', userId)
    .eq('site.org_id', ctx.orgId)

  const memberships: EditableMembership[] = (siteRows ?? []).map((m) => {
    const site = (m.site as { name?: string; primary_domain?: string } | null) ?? {}
    return {
      site_id: m.site_id as string,
      site_name: site.name ?? '',
      primary_domain: site.primary_domain ?? '',
      role: m.role as 'editor' | 'reporter',
    }
  })

  // Candidate reassignment targets: org admins + editors on any site in the org
  const { data: candidatesRaw } = await service
    .from('site_memberships')
    .select('user_id, role, site_id, site:sites!inner(org_id)')
    .eq('site.org_id', ctx.orgId)
    .eq('role', 'editor')
  const candidates: TargetCandidate[] = await Promise.all(
    ((candidatesRaw ?? []) as Array<{ user_id: string; site_id: string; role: string }>)
      .filter((c) => c.user_id !== userId)
      .map(async (c) => {
        const { data } = await service.auth.admin.getUserById(c.user_id)
        return {
          user_id: c.user_id,
          email: data.user?.email ?? c.user_id,
          site_id: c.site_id,
          role: c.role as 'editor',
        }
      }),
  )

  const noticeMessage = notice ? (noticeMessages[notice] ?? null) : null
  const isError = notice?.endsWith('_failed') ?? false

  return (
    <main className="p-8">
      <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-2">Editar usuário</h1>
      <p className="text-sm text-gray-700 mb-6">
        <strong>{targetEmail}</strong>
      </p>

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

      {orgMember && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Papel na organização</h2>
          <p className="text-sm">
            <code>{String(orgMember.role)}</code>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Para remover o papel de org_admin use a UI da própria organização (ação sensível).
          </p>
        </section>
      )}

      <EditForm
        userId={userId}
        memberships={memberships}
        candidates={candidates}
        onUpdateRole={updateSiteMembershipRoleAction}
        onRevoke={revokeSiteMembershipAction}
        onReassign={reassignContentAction}
      />
    </main>
  )
}
