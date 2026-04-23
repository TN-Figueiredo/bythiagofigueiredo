import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { captureServerActionError } from '@/lib/sentry-wrap'
import { StatusBadge } from '@tn-figueiredo/cms-ui/client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

async function markReplied(submissionId: string, siteId: string) {
  'use server'
  // Re-check authz inside the action — do not rely on the page's earlier check.
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
    p_site_id: siteId,
  })
  if (canAdmin !== true) {
    redirect('/cms')
  }

  const supabase = getSupabaseServiceClient()
  const { error: updateErr } = await supabase
    .from('contact_submissions')
    .update({ replied_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('site_id', siteId)
  if (updateErr) {
    captureServerActionError(updateErr, {
      action: 'contact_mark_replied',
      site_id: siteId,
      submission_id: submissionId,
      pg_code: updateErr.code,
    })
  }
  redirect(`/cms/contacts?notice=marked_replied`)
}

export default async function CmsContactDetailPage({ params }: Props) {
  const { id } = await params
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
  const { data: sub } = await supabase
    .from('contact_submissions')
    .select(
      'id, name, email, message, submitted_at, replied_at, consent_processing, consent_marketing, ip, user_agent',
    )
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .maybeSingle()

  if (!sub) notFound()

  const siteId = ctx.siteId
  const submissionId = sub.id as string

  return (
    <main className="p-8 max-w-2xl">
      <nav className="mb-6 text-sm text-cms-text-muted">
        <a href="/cms/contacts" className="hover:underline hover:text-cms-text">
          ← Contatos
        </a>
      </nav>

      <h1 className="text-2xl font-bold mb-6 text-cms-text">Contato de {sub.name as string}</h1>

      <dl className="space-y-4 text-sm mb-8">
        <div>
          <dt className="font-medium text-cms-text-muted">Nome</dt>
          <dd>{sub.name as string}</dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Email</dt>
          <dd>
            <a
              href={`mailto:${sub.email as string}?subject=Re: seu contato`}
              className="text-cms-accent hover:underline"
            >
              {sub.email as string}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Mensagem</dt>
          <dd className="whitespace-pre-wrap bg-cms-surface-hover rounded-[var(--cms-radius)] border border-cms-border p-3 mt-1 text-cms-text">
            {sub.message as string}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Recebido em</dt>
          <dd>{String(sub.submitted_at).replace('T', ' ').slice(0, 19)} UTC</dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Status</dt>
          <dd className="flex items-center gap-2">
            {sub.replied_at ? (
              <>
                <StatusBadge variant="confirmed" label="Respondido" pill />
                <span className="text-xs text-cms-text-muted">
                  {String(sub.replied_at).replace('T', ' ').slice(0, 19)} UTC
                </span>
              </>
            ) : (
              <StatusBadge variant="pending" label="Pendente" pill />
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Consentimento de processamento</dt>
          <dd>{sub.consent_processing ? 'Sim' : 'Não'}</dd>
        </div>
        <div>
          <dt className="font-medium text-cms-text-muted">Consentimento marketing</dt>
          <dd>{sub.consent_marketing ? 'Sim' : 'Não'}</dd>
        </div>
        {sub.ip && (
          <div>
            <dt className="font-medium text-cms-text-muted">IP</dt>
            <dd className="font-mono text-xs">{sub.ip as string}</dd>
          </div>
        )}
      </dl>

      <div className="flex gap-3">
        <a
          href={`mailto:${sub.email as string}?subject=Re: seu contato`}
          className="inline-flex items-center justify-center px-4 py-2 bg-cms-accent text-white rounded-[var(--cms-radius)] text-sm font-medium hover:bg-cms-accent-hover transition-all duration-150"
        >
          Responder por email
        </a>

        {!sub.replied_at && (
          <form
            action={async () => {
              'use server'
              await markReplied(submissionId, siteId)
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 bg-cms-green-subtle text-cms-green border border-[rgba(34,197,94,.3)] rounded-[var(--cms-radius)] text-sm font-medium hover:bg-[rgba(34,197,94,.15)] transition-all duration-150 cursor-pointer"
            >
              Marcar como respondido
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
