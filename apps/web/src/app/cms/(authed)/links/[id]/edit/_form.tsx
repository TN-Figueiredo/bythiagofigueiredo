'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

  const sourceBadge = (SOURCE_BADGE[initial.source_type] ?? SOURCE_BADGE.manual)!

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
          <Link href="/cms/links" style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <Link2 size={13} strokeWidth={1.7} />
            Links
          </Link>
          <ChevronRight size={13} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }} />
          <Link href={`/cms/links/${linkId}`} style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {initial.title || `/${initial.code || linkId.slice(0, 8)}`}
          </Link>
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
          .links-edit-form input[type="date"],
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
          .links-edit-form input::placeholder,
          .links-edit-form textarea::placeholder {
            color: var(--ink-faint) !important;
          }
          .links-edit-form label {
            color: var(--ink-dim) !important;
            font-size: 12px !important;
          }
          .links-edit-form h2, .links-edit-form h3 {
            color: var(--ink) !important;
          }
          .links-edit-form p, .links-edit-form span,
          .links-edit-form small, .links-edit-form div {
            color: var(--ink-dim) !important;
          }
          .links-edit-form h1, .links-edit-form h2, .links-edit-form h3,
          .links-edit-form strong, .links-edit-form b {
            color: var(--ink) !important;
          }
          /* Redirect type cards + toggle cards + any white cards */
          .links-edit-form [class*="bg-card"],
          .links-edit-form [class*="bg-background"],
          .links-edit-form [class*="bg-white"],
          .links-edit-form [class*="bg-muted"] {
            background: var(--surface) !important;
          }
          .links-edit-form [class*="border-border"],
          .links-edit-form [class*="border-input"] {
            border-color: var(--line-strong) !important;
          }
          /* Radio/checkbox cards (redirect type grid) */
          .links-edit-form [role="radio"],
          .links-edit-form [role="radiogroup"] > *,
          .links-edit-form [data-state] {
            background: var(--surface) !important;
            border-color: var(--line-strong) !important;
          }
          .links-edit-form [data-state="checked"],
          .links-edit-form [aria-checked="true"],
          .links-edit-form [role="radio"][aria-checked="true"] {
            border-color: var(--accent) !important;
            background: var(--surface-2) !important;
          }
          /* Toggle switches — force override inline styles */
          .links-edit-form [role="switch"] {
            background-color: var(--surface-2) !important;
            background: var(--surface-2) !important;
          }
          .links-edit-form [role="switch"][data-state="checked"],
          .links-edit-form [role="switch"][aria-checked="true"] {
            background-color: var(--accent) !important;
            background: var(--accent) !important;
          }
          .links-edit-form .bg-green-500,
          .links-edit-form .bg-emerald-500 {
            background-color: var(--accent) !important;
          }
          .links-edit-form .bg-gray-200,
          .links-edit-form .bg-zinc-700,
          .links-edit-form .bg-neutral-700 {
            background-color: var(--surface-2) !important;
          }
          /* Buttons */
          .links-edit-form button[type="submit"],
          .links-edit-form button[class*="bg-primary"],
          .links-edit-form button[class*="bg-indigo"] {
            background: var(--accent) !important;
            color: var(--pb-ink-on-accent, #1A140C) !important;
            border: 1px solid var(--accent) !important;
            border-radius: 9px !important;
          }
          .links-edit-form button[type="button"][class*="border"],
          .links-edit-form button[class*="bg-transparent"],
          .links-edit-form a[class*="border"] {
            border-color: var(--line-strong) !important;
            color: var(--ink-dim) !important;
            background: transparent !important;
          }
          /* Section separators */
          .links-edit-form [class*="border-b"],
          .links-edit-form hr {
            border-color: var(--line) !important;
          }
          /* Source type pills */
          .links-edit-form [role="radio"] span,
          .links-edit-form [role="radiogroup"] span {
            color: inherit !important;
          }
          /* Text colors */
          .links-edit-form [class*="text-foreground"] {
            color: var(--ink) !important;
          }
          .links-edit-form [class*="text-muted"] {
            color: var(--ink-dim) !important;
          }
          /* Accordion/collapsible sections */
          .links-edit-form details, .links-edit-form summary,
          .links-edit-form [class*="accordion"],
          .links-edit-form [class*="collapsible"] {
            background: var(--surface) !important;
            border-color: var(--line) !important;
          }
          /* All remaining white backgrounds */
          .links-edit-form > div > div {
            background-color: transparent !important;
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
