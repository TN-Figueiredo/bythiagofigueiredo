import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { requireOrgAdmin } from '../_lib/require-org-admin'
import { updateSiteBranding, updateSiteCmsEnabled, updateSiteIdentity } from './actions'

export const dynamic = 'force-dynamic'

interface SiteSettingsRow {
  id: string
  name: string | null
  primary_domain: string | null
  logo_url: string | null
  primary_color: string | null
  cms_enabled: boolean | null
  twitter_handle: string | null
  identity_type: string | null
}

interface Props {
  searchParams: Promise<{ notice?: string }>
}

const noticeMessages: Record<string, string> = {
  saved: 'Configurações salvas com sucesso.',
  save_failed: 'Erro ao salvar. Tente novamente.',
}

export default async function AdminSitesPage({ searchParams }: Props) {
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
  requireOrgAdmin(role)

  const supabase = getSupabaseServiceClient()
  const { data: site } = await supabase
    .from('sites')
    .select('id, name, primary_domain, logo_url, primary_color, cms_enabled, twitter_handle, identity_type')
    .eq('id', ctx.siteId)
    .single<SiteSettingsRow>()

  if (!site) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-6">Configurações do site</h1>
        <p className="text-sm text-red-600">Site não encontrado.</p>
      </main>
    )
  }

  const noticeMessage = notice != null ? (noticeMessages[notice] ?? null) : null
  const isError = notice === 'save_failed'

  const handleSave = async (formData: FormData) => {
    'use server'
    const primaryColor = String(formData.get('primary_color') ?? '') || null
    const logoUrl = String(formData.get('logo_url') ?? '') || null
    const cmsEnabled = formData.get('cms_enabled') === 'on'
    const twitterHandle = String(formData.get('twitter_handle') ?? '') || null
    const identityRaw = String(formData.get('identity_type') ?? 'person')
    const identityType: 'person' | 'organization' = identityRaw === 'organization' ? 'organization' : 'person'

    const brandingResult = await updateSiteBranding({
      siteId: ctx.siteId,
      ...(primaryColor ? { primaryColor } : {}),
      ...(logoUrl ? { logoUrl } : {}),
    })

    if (!brandingResult.ok) {
      redirect('/admin/sites?notice=save_failed')
    }

    const identityResult = await updateSiteIdentity({
      siteId: ctx.siteId,
      identityType,
      twitterHandle,
    })

    if (!identityResult.ok) {
      redirect('/admin/sites?notice=save_failed')
    }

    const cmsResult = await updateSiteCmsEnabled({ siteId: ctx.siteId, cmsEnabled })
    if (!cmsResult.ok) {
      redirect('/admin/sites?notice=save_failed')
    }

    redirect('/admin/sites?notice=saved')
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Configurações do site</h1>

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

      <form action={handleSave} className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do site
          </label>
          <p className="text-sm text-gray-900 border rounded px-3 py-2 bg-gray-50">
            {site.name ?? '—'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Domínio principal
          </label>
          <p className="text-sm text-gray-900 border rounded px-3 py-2 bg-gray-50">
            {site.primary_domain ?? '—'}
          </p>
        </div>

        <div>
          <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 mb-1">
            Logo URL
          </label>
          <input
            id="logo_url"
            name="logo_url"
            type="url"
            defaultValue={site.logo_url ?? ''}
            placeholder="https://..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700 mb-1">
            Cor primária (hex, ex: #1a2b3c)
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="text"
            defaultValue={site.primary_color ?? ''}
            placeholder="#000000"
            pattern="^#[0-9A-Fa-f]{6}$"
            className="w-full border rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label htmlFor="twitter_handle" className="block text-sm font-medium text-gray-700 mb-1">
            Twitter Handle
          </label>
          <input
            id="twitter_handle"
            name="twitter_handle"
            type="text"
            defaultValue={site.twitter_handle ?? ''}
            placeholder="@tnFigueiredo"
            pattern="^[A-Za-z0-9_]{1,15}$"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <input
          type="hidden"
          name="identity_type"
          value={site.identity_type ?? 'person'}
        />

        <div className="flex items-center gap-3">
          <input
            id="cms_enabled"
            name="cms_enabled"
            type="checkbox"
            defaultChecked={(site.cms_enabled as boolean) ?? true}
            className="h-4 w-4 rounded border-gray-300"
            data-testid="admin-sites-cms-enabled-toggle"
          />
          <label htmlFor="cms_enabled" className="text-sm font-medium text-gray-700">
            CMS habilitado
          </label>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700"
          data-testid="admin-sites-save-button"
        >
          Salvar
        </button>
      </form>
    </main>
  )
}
