import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

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
      <nav className="mb-6 text-sm text-gray-500">
        <a href="/cms/contacts" className="hover:underline">
          ← Contatos
        </a>
      </nav>

      <h1 className="text-2xl font-bold mb-6">Contato de {sub.name as string}</h1>

      <dl className="space-y-4 text-sm mb-8">
        <div>
          <dt className="font-medium text-gray-600">Nome</dt>
          <dd>{sub.name as string}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Email</dt>
          <dd>
            <a
              href={`mailto:${sub.email as string}?subject=Re: seu contato`}
              className="text-blue-600 hover:underline"
            >
              {sub.email as string}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Mensagem</dt>
          <dd className="whitespace-pre-wrap bg-gray-50 rounded p-3 mt-1">
            {sub.message as string}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Recebido em</dt>
          <dd>{String(sub.submitted_at).replace('T', ' ').slice(0, 19)} UTC</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Status</dt>
          <dd>
            {sub.replied_at ? (
              <span className="text-green-600">
                Respondido em {String(sub.replied_at).replace('T', ' ').slice(0, 19)} UTC
              </span>
            ) : (
              <span className="text-yellow-600">Pendente</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Consentimento de processamento</dt>
          <dd>{sub.consent_processing ? 'Sim' : 'Não'}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">Consentimento marketing</dt>
          <dd>{sub.consent_marketing ? 'Sim' : 'Não'}</dd>
        </div>
        {sub.ip && (
          <div>
            <dt className="font-medium text-gray-600">IP</dt>
            <dd className="font-mono text-xs">{sub.ip as string}</dd>
          </div>
        )}
      </dl>

      <div className="flex gap-3">
        <a
          href={`mailto:${sub.email as string}?subject=Re: seu contato`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Marcar como respondido
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
