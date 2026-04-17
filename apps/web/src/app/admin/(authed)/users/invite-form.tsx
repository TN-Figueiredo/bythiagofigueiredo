'use client'

import { useState, useTransition } from 'react'

export interface SiteOption {
  id: string
  name: string
  primary_domain: string
}

type Scope = 'org' | 'site'
type SiteRole = 'editor' | 'reporter'

interface Props {
  sites: SiteOption[]
  /**
   * Server action bound in the parent Server Component. Receives the
   * already-normalized payload so the client never builds FormData ad-hoc.
   */
  action: (payload: {
    email: string
    scope: Scope
    role: 'org_admin' | SiteRole
    site_ids: string[]
  }) => Promise<void>
}

/**
 * Track G3 — new invite form with scope picker.
 *
 * UX:
 * - Radio `scope`: org | site. Default = org.
 * - When scope=site, a multi-select of sites is shown + a role picker
 *   (editor | reporter). Role for scope=org is derived as 'org_admin'.
 * - Submitting with 0 sites while scope=site shows a local error.
 *
 * The parent Server Component passes the list of sites the caller can
 * administer (org_admin sees all sites in their org; super_admin sees all).
 */
export function InviteForm({ sites, action }: Props) {
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<Scope>('org')
  const [siteRole, setSiteRole] = useState<SiteRole>('editor')
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set())
  const [localError, setLocalError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleSite(id: string) {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)

    if (!email.match(/.+@.+\..+/)) {
      setLocalError('Email inválido.')
      return
    }

    if (scope === 'site' && selectedSiteIds.size === 0) {
      setLocalError('Selecione pelo menos um site.')
      return
    }

    const payload = {
      email,
      scope,
      role: scope === 'org' ? ('org_admin' as const) : siteRole,
      site_ids: scope === 'site' ? Array.from(selectedSiteIds) : [],
    }

    startTransition(() => {
      void action(payload)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="border rounded px-3 py-2 text-sm w-full max-w-md"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium mb-1">Escopo</legend>
        <label className="inline-flex items-center gap-2 mr-4 text-sm">
          <input
            type="radio"
            name="scope"
            value="org"
            checked={scope === 'org'}
            onChange={() => setScope('org')}
          />
          <span>
            Organização inteira <code className="text-xs">(org_admin)</code>
          </span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="site"
            checked={scope === 'site'}
            onChange={() => setScope('site')}
          />
          <span>Site específico</span>
        </label>
      </fieldset>

      {scope === 'site' && (
        <>
          <div>
            <label htmlFor="invite-site-role" className="block text-sm font-medium mb-1">
              Papel
            </label>
            <select
              id="invite-site-role"
              value={siteRole}
              onChange={(e) => setSiteRole(e.target.value as SiteRole)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="editor">editor (pode publicar)</option>
              <option value="reporter">reporter (precisa de aprovação)</option>
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium mb-1">Sites</span>
            {sites.length === 0 ? (
              <p className="text-xs text-gray-500">
                Nenhum site disponível na sua organização.
              </p>
            ) : (
              <ul className="space-y-1 max-h-60 overflow-y-auto border rounded p-2">
                {sites.map((s) => (
                  <li key={s.id}>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.has(s.id)}
                        onChange={() => toggleSite(s.id)}
                      />
                      <span>
                        {s.name}{' '}
                        <span className="text-xs text-gray-500">({s.primary_domain})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {localError && (
        <div role="alert" className="text-sm text-red-600">
          {localError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : 'Enviar convite'}
      </button>
    </form>
  )
}
