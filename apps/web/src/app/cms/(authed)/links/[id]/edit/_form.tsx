'use client'

import { useRouter } from 'next/navigation'
import { Link2, ChevronRight } from 'lucide-react'
import { LinkForm } from '@tn-figueiredo/links-admin/client'
import type { LinkFormData } from '@tn-figueiredo/links-admin/client'
import { handleUpdate } from './actions'

const SOURCE_BADGE: Record<string, { bg: string; color: string }> = {
  newsletter: { bg: 'rgba(167, 124, 232, 0.133)', color: '#A77CE8' },
  social: { bg: 'rgba(63, 169, 192, 0.13)', color: '#3FA9C0' },
  blog: { bg: 'rgba(70, 177, 126, 0.13)', color: '#46B17E' },
  campaign: { bg: 'rgba(91, 127, 214, 0.133)', color: '#5B7FD6' },
  qr: { bg: 'rgba(224, 162, 60, 0.13)', color: '#E0A23C' },
  manual: { bg: 'rgba(138, 143, 152, 0.13)', color: '#8A8F98' },
  print: { bg: 'rgba(224, 162, 60, 0.13)', color: '#E0A23C' },
}

interface EditLinkFormProps {
  linkId: string
  siteId: string
  initial: {
    destination_url: string
    title: string
    slug: string
    source_type: string
    redirect_type: number
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_term: string
    utm_content: string
    utm_id?: string
    expires_at: string
    activates_at?: string
    pass_click_ids?: boolean
    tags: string[]
    code?: string
    domain?: string
  }
}

export function EditLinkForm({ linkId, siteId, initial }: EditLinkFormProps) {
  const router = useRouter()

  const linkData: LinkFormData & { id: string } = {
    id: linkId,
    destination_url: initial.destination_url,
    title: initial.title,
    slug: initial.slug,
    source_type: initial.source_type as LinkFormData['source_type'],
    redirect_type: initial.redirect_type as 301 | 302 | 307 | 308,
    active: true,
    tags: initial.tags,
    utm_source: initial.utm_source,
    utm_medium: initial.utm_medium,
    utm_campaign: initial.utm_campaign,
    utm_term: initial.utm_term,
    utm_content: initial.utm_content,
    utm_id: initial.utm_id ?? '',
    expires_at: initial.expires_at,
    activates_at: initial.activates_at ?? '',
    pass_click_ids: initial.pass_click_ids ?? true,
    click_limit: null,
    password: '',
  }

  async function handleSubmit(data: LinkFormData): Promise<{ ok: boolean; error?: string }> {
    const result = await handleUpdate(linkId, {
      destination_url: data.destination_url,
      title: data.title || undefined,
      slug: data.slug || null,
      source_type: data.source_type,
      utm_source: data.utm_source || undefined,
      utm_medium: data.utm_medium || undefined,
      utm_campaign: data.utm_campaign || undefined,
      utm_term: data.utm_term || undefined,
      utm_content: data.utm_content || undefined,
      utm_id: data.utm_id || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
      expires_at: data.expires_at || null,
      activates_at: data.activates_at || null,
      pass_click_ids: data.pass_click_ids,
      redirect_type: String(data.redirect_type) as '301' | '302' | '307' | '308',
    })
    if (!result.ok) return { ok: false, error: result.error }
    router.push(`/cms/links/${linkId}`)
    return { ok: true }
  }

  const sourceBadge = SOURCE_BADGE[initial.source_type] ?? SOURCE_BADGE.manual

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: 56, flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-side, var(--surface))',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 14,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <a href="/cms/links" style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <Link2 size={13} strokeWidth={1.7} />
            Links
          </a>
          <ChevronRight size={13} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }} />
          <a href={`/cms/links/${linkId}`} style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {initial.title || `/${initial.code || linkId.slice(0, 8)}`}
          </a>
          <ChevronRight size={13} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
            Editar
          </span>
        </div>

        {/* Source badge */}
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 999,
          fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: sourceBadge.bg, color: sourceBadge.color,
          marginLeft: 4,
        }}>
          {initial.source_type}
        </span>

        {/* Slug */}
        {initial.code && (
          <span className="mono" style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginLeft: 4 }}>
            /{initial.code}
          </span>
        )}
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 60px', maxWidth: 720 }}>
        <style>{`
          .links-edit-form input[type="text"],
          .links-edit-form input[type="url"],
          .links-edit-form input[type="number"],
          .links-edit-form input[type="password"],
          .links-edit-form input[type="datetime-local"],
          .links-edit-form textarea,
          .links-edit-form select {
            background: var(--surface) !important;
            border: 1px solid var(--line-strong) !important;
            border-radius: 9px !important;
            padding: 11px 13px !important;
            color: var(--ink) !important;
            font-size: 13.5px !important;
            outline: none !important;
          }
          .links-edit-form input:focus,
          .links-edit-form textarea:focus,
          .links-edit-form select:focus {
            border-color: var(--accent) !important;
          }
          .links-edit-form label {
            color: var(--ink-dim) !important;
            font-size: 12px !important;
          }
          .links-edit-form h2, .links-edit-form h3 {
            color: var(--ink) !important;
          }
          .links-edit-form p, .links-edit-form span {
            color: var(--ink-dim) !important;
          }
          .links-edit-form button[type="submit"] {
            background: var(--accent) !important;
            color: var(--pb-ink-on-accent, #1A140C) !important;
            border: 1px solid var(--accent) !important;
            border-radius: 9px !important;
          }
        `}</style>
        <div className="links-edit-form">
          <LinkForm
            link={linkData}
            siteId={siteId}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/cms/links/${linkId}`)}
          />
        </div>
      </div>
    </div>
  )
}
