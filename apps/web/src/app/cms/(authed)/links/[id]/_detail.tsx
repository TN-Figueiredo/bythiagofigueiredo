'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback, useTransition } from 'react'
import {
  MousePointerClick,
  Users,
  Globe,
  TrendingUp,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Tag,
  Clock,
  ArrowUpRight,
  Trash2,
  Pause,
  Play,
  BarChart3,
  Link2,
  ChevronRight,
  Type,
  Zap,
} from 'lucide-react'
import { deleteLink, toggleLinkActive } from '../actions'
import { QrCardsStrip } from './_components/qr-cards-strip'
import type { QrCardSummary } from './qr/card-actions'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LinkData {
  id: string
  code: string
  slug: string | null
  title: string | null
  destination_url: string
  source_type: string
  tags: string[]
  active: boolean
  redirect_type: number
  expires_at: string | null
  total_clicks: number
  unique_visitors: number
  last_clicked_at: string | null
  created_at: string
  utm_id: string | null
  activates_at: string | null
  pass_click_ids: boolean
  health_status: string | null
  health_checked_at: string | null
  launched_at: string | null
}

interface DailyClick {
  date: string
  clicks: number
  unique: number
}

interface Props {
  link: LinkData
  dailyClicks: DailyClick[]
  topCountry: string | null
  linkId: string
  shortUrl: string
  qrCards: QrCardSummary[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  newsletter: { bg: 'rgba(167, 124, 232, 0.133)', color: 'rgb(167, 124, 232)' },
  social:     { bg: 'rgba(63, 169, 192, 0.133)',  color: 'var(--cyan)' },
  blog:       { bg: 'var(--green-soft)',           color: 'var(--green)' },
  campaign:   { bg: 'rgba(91, 127, 214, 0.133)',  color: 'rgb(91, 127, 214)' },
  qr:         { bg: 'var(--amber-soft)',           color: 'var(--amber)' },
  manual:     { bg: 'var(--surface-2)',            color: 'var(--ink-dim)' },
}

const HEALTH_MAP: Record<string, { bg: string; color: string; label: string; icon: boolean }> = {
  healthy:   { bg: 'var(--green-soft)',  color: 'var(--green)', label: 'saudável', icon: true },
  ok:        { bg: 'var(--green-soft)',  color: 'var(--green)', label: 'saudável', icon: true },
  warn:      { bg: 'var(--amber-soft)',  color: 'var(--amber)', label: 'a expirar', icon: false },
  broken:    { bg: 'rgba(217, 97, 74, 0.13)', color: 'var(--red)', label: 'quebrado', icon: false },
  unhealthy: { bg: 'rgba(217, 97, 74, 0.13)', color: 'var(--red)', label: 'quebrado', icon: false },
  unchecked: { bg: 'var(--surface-2)',   color: 'var(--ink-dim)', label: 'não verificado', icon: false },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/*  Shared inline-style fragments                                      */
/* ------------------------------------------------------------------ */

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  whiteSpace: 'nowrap',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'transparent',
  padding: '6px 11px',
  fontSize: '12.5px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--ink-dim)',
  cursor: 'pointer',
  transition: '0.15s',
}

const accentBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  whiteSpace: 'nowrap',
  borderRadius: 9,
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  padding: '6px 15px',
  fontSize: '12.5px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--pb-ink-on-accent, #1A140C)',
  cursor: 'pointer',
  transition: '0.15s',
}

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  borderColor: 'rgba(217, 97, 74, 0.3)',
  color: 'var(--red)',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  padding: 18,
}

const eyebrow: React.CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--ink-dim)',
  margin: 0,
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  borderRadius: 99,
  padding: '3px 10px',
  fontSize: '11px',
  fontWeight: 600,
  background: bg,
  color,
})

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [url])

  return (
    <button type="button" onClick={handleCopy} style={ghostBtn}>
      {copied ? (
        <Check size={14} strokeWidth={1.7} style={{ color: 'var(--green)' }} />
      ) : (
        <Copy size={14} strokeWidth={1.7} />
      )}
      {copied ? 'Copiado!' : 'Copiar URL'}
    </button>
  )
}

function KpiTile({
  icon,
  label,
  value,
  circleColor,
  circleBg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  circleColor: string
  circleBg: string
}) {
  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: circleBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: circleColor, display: 'flex' }}>{icon}</span>
        </span>
        <span className="eyebrow" style={{ flex: 1, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {label}
        </span>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--ink)',
        }}
      >
        {typeof value === 'number' ? formatCompact(value) : value}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {icon && <span style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: 13, color: 'var(--ink-dim)', flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LinkDetail({ link, dailyClicks, topCountry, linkId, shortUrl, qrCards }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const periodClicks = dailyClicks.reduce((s, m) => s + m.clicks, 0)
  const periodUnique = dailyClicks.reduce((s, m) => s + m.unique, 0)

  function handleDelete() {
    if (!confirm('Excluir este link? Essa acao nao pode ser desfeita.')) return
    startTransition(async () => {
      await deleteLink(link.id)
      router.push('/cms/links')
    })
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleLinkActive(link.id)
      router.refresh()
    })
  }

  const sourceStyle = (SOURCE_COLORS[link.source_type] ?? SOURCE_COLORS.manual)!
  const healthKey = link.health_status ?? 'unchecked'
  const health = (HEALTH_MAP[healthKey] ?? HEALTH_MAP.unchecked)!

  return (
    <div style={{ padding: '20px 30px 0' }}>
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'var(--ink-dim)',
          }}
        >
          <Link2 size={13} strokeWidth={1.7} />
          Social
        </span>
        <ChevronRight
          size={13}
          strokeWidth={1.7}
          style={{ flexShrink: 0, color: 'var(--ink-faint)', opacity: 0.7 }}
        />
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'var(--ink-dim)',
            cursor: 'pointer',
          }}
          onClick={() => router.push('/cms/links')}
        >
          Links
        </span>
        <ChevronRight
          size={13}
          strokeWidth={1.7}
          style={{ flexShrink: 0, color: 'var(--ink-faint)', opacity: 0.7 }}
        />
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {link.title || `/${link.code}`}
        </span>
      </div>

      {/* ── Title row ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 8,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'Fraunces, serif',
            fontSize: 29,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
          }}
        >
          {link.title || `/${link.code}`}
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <CopyUrlButton url={shortUrl} />
          <button
            type="button"
            onClick={() => router.push(`/cms/links/${linkId}/qr`)}
            style={ghostBtn}
          >
            <QrCode size={14} strokeWidth={1.7} />
            QR
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            style={{ ...ghostBtn, opacity: isPending ? 0.5 : 1 }}
          >
            {link.active ? (
              <Pause size={14} strokeWidth={1.7} />
            ) : (
              <Play size={14} strokeWidth={1.7} />
            )}
            {link.active ? 'Pausar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/cms/links/${linkId}/edit`)}
            style={accentBtn}
          >
            <Type size={14} strokeWidth={1.7} />
            Editar
          </button>
        </div>
      </div>

      {/* ── Status row ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Active indicator */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '12.5px',
            fontWeight: 600,
            color: link.active ? 'var(--green)' : 'var(--ink-dim)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: link.active ? 'var(--green)' : 'var(--ink-faint)',
            }}
          />
          {link.active ? 'Ativo' : 'Inativo'}
        </span>

        {/* Source badge */}
        <span style={badge(sourceStyle.bg, sourceStyle.color)}>
          {link.source_type}
        </span>

        {/* Slug */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: 'var(--ink-dim)',
          }}
        >
          /{link.code}
        </span>

        {/* Health badge */}
        <span style={badge(health.bg, health.color)}>
          {health.label}
        </span>
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div style={{ padding: '0 0 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Destination card */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Destino</div>
        <a
          href={link.destination_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 14,
            color: 'var(--accent)',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
        >
          {link.destination_url.replace('https://', '')}
          <ExternalLink size={14} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        </a>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <KpiTile
          icon={<MousePointerClick size={14} strokeWidth={1.7} />}
          label="Total Cliques"
          value={link.total_clicks}
          circleColor="var(--accent)"
          circleBg="var(--accent-soft)"
        />
        <KpiTile
          icon={<TrendingUp size={14} strokeWidth={1.7} />}
          label="Ultimos 30 Dias"
          value={periodClicks}
          circleColor="var(--green)"
          circleBg="var(--green-soft)"
        />
        <KpiTile
          icon={<Users size={14} strokeWidth={1.7} />}
          label="Visitantes Unicos"
          value={periodUnique}
          circleColor="var(--cyan)"
          circleBg="rgba(63, 169, 192, 0.133)"
        />
        <KpiTile
          icon={<QrCode size={15} strokeWidth={1.7} />}
          label="QR Scans"
          value={0}
          circleColor="var(--amber)"
          circleBg="var(--amber-soft)"
        />
      </div>

      {/* ── Details + QR Card side by side ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>

      {/* Details panel */}
      <div style={{ ...cardStyle, padding: 18 }}>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Detalhes
        </p>

        <DetailRow label="Redirect" icon={<ExternalLink size={15} strokeWidth={1.7} />}>
          {link.redirect_type}
        </DetailRow>

        <DetailRow label="Click IDs" icon={<MousePointerClick size={15} strokeWidth={1.7} />}>
          <span style={badge(
            link.pass_click_ids ? 'var(--green-soft)' : 'var(--surface-2)',
            link.pass_click_ids ? 'var(--green)' : 'var(--ink-dim)',
          )}>
            {link.pass_click_ids ? 'on' : 'off'}
          </span>
        </DetailRow>

        <DetailRow label="Origem" icon={<Tag size={15} strokeWidth={1.7} />}>
          <span style={badge(sourceStyle.bg, sourceStyle.color)}>
            {link.source_type}
          </span>
        </DetailRow>

        <DetailRow label="Criado" icon={<Clock size={15} strokeWidth={1.7} />}>
          <span style={{ fontSize: '12.5px', color: 'var(--ink-dim)' }}>{formatDate(link.created_at)}</span>
        </DetailRow>

        <DetailRow label="Saúde" icon={<Zap size={15} strokeWidth={1.7} />}>
          <span style={badge(health.bg, health.color)}>
            {health.icon && <Check size={11} strokeWidth={1.7} />}
            {health.label}
          </span>
        </DetailRow>

        {link.tags.length > 0 && (
          <div style={{ paddingTop: 10, borderTop: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '12.5px',
                color: 'var(--ink-dim)',
                marginBottom: 8,
              }}
            >
              <Tag size={15} strokeWidth={1.7} />
              Tags
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {link.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    ...badge('var(--accent-soft)', 'var(--accent)'),
                    fontSize: '11px',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Cards */}
      <QrCardsStrip linkId={linkId} cards={qrCards} />

      </div> {/* end grid */}

      {/* ── Analytics accordion ─────────────────────────────────── */}
      <div
        onClick={() => router.push(`/cms/links/${linkId}/analytics`)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <button
          type="button"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 18px', background: 'transparent', border: 'none',
            color: 'var(--ink)', cursor: 'pointer',
          }}
        >
          <TrendingUp size={16} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, flex: 1, textAlign: 'left' }}>Analytics completo</span>
          <ChevronRight size={16} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
        </button>
      </div>

      </div> {/* end content area */}
    </div>
  )
}
