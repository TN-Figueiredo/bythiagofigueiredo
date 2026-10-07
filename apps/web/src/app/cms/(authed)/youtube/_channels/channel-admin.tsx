'use client'
/**
 * Cadastro de canais próprios e de nichos, dentro do Painel de /cms/youtube (mockup aprovado:
 * docs/superpowers/mockups/2026-10-04-multi-canal/cms-youtube-canais.html). Nada aqui importa server action: elas
 * chegam por props, a partir da página. Tudo abre no lugar (sem diálogo), como "Configurar" e "Unpin".
 *
 * Retorno imediato: cada peça mostra o resultado do clique antes de o servidor responder (aria-busy + barra fina /
 * girador) e desfaz com o aviso quando a action falha. O estado otimista só mostra o que já está na tela ou o que
 * o lookup trouxe.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { CHANNEL_LOCALES, channelLocaleDef, isChannelLocale, type ChannelLocale } from '@/lib/youtube/channel-locales'
import { NICHE_PALETTE } from '@/lib/youtube/observatorio/niche'
import {
  CHANNEL_TEXT, LANGUAGE_CHANGE_LEAD, blockedLead, blockedTitle, blockerDetail, isChannelSlug, languageChangeTitle, nicheSlugOrNull, nicheUsage,
  normalizeNicheLabel, removalConnectionLine, removalKeepLine, removalLines, removalTitle,
  type AddChannelInput, type ChannelLookup, type LookupChannelResult, type NicheView, type RemovalBlocker, type RemovalImpact,
  type RemovalImpactResult, type RemoveChannelResult,
} from '@/lib/youtube/channel-registry'
import './channels.css'

export type { NicheView }

const NO_NICHE = 'No niche yet'
const inputCls = 'min-h-[32px] w-full min-w-0 rounded border border-cms-border bg-cms-surface px-2 py-1 text-xs text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50'
const labelCls = 'text-xs font-medium text-cms-text-muted'
const helpCls = 'text-[11px] leading-snug text-cms-text-dim'
const errCls = 'text-xs leading-snug text-red-400'
const nicheVars = (n: { dark: string; light: string }): CSSProperties => ({ ['--yc-dark' as string]: n.dark, ['--yc-light' as string]: n.light })
const atHandle = (h: string) => (h.startsWith('@') ? h : `@${h}`)
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?'
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/* ------------------------------------------------------------------ peças pequenas */

export function LangChip({ locale }: { locale: string }) {
  const def = channelLocaleDef(locale)
  return (
    <abbr data-lang-chip title={def.name} className="inline-flex h-5 flex-none items-center rounded border border-cms-border px-1.5 text-[11px] font-semibold tracking-wide text-cms-text-muted no-underline">
      {def.chip}
    </abbr>
  )
}

export function NicheChip({ niche }: { niche: NicheView | null }) {
  if (!niche) return <span className="font-medium text-amber-400">{NO_NICHE}</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-cms-text" style={nicheVars(niche)}>
      <i aria-hidden="true" className="yc-dot" />{niche.label}
    </span>
  )
}

export function Avatar({ name, src, size }: { name: string; src: string | null; size: 40 | 48 }) {
  const cls = size === 48 ? 'h-12 w-12 text-[15px]' : 'h-10 w-10 text-[13px]'
  return src
    ? <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" className={`${cls} flex-none rounded-full object-cover`} />
    : <span aria-hidden="true" className={`${cls} grid flex-none place-items-center rounded-full bg-slate-600 font-bold text-white`}>{initials(name)}</span>
}

/** Faixa de identidade do cartão: nicho e slug, sempre visíveis. */
export function IdentityStrip({ niche, slug }: { niche: NicheView | null; slug: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-b border-cms-border px-4 py-2 text-xs text-cms-text-muted">
      <span data-ident-niche><span className="mr-1.5 text-cms-text-dim">Niche</span><NicheChip niche={niche} /></span>
      {slug ? <span><span className="mr-1.5 text-cms-text-dim">Slug</span><span className="mono text-[11.5px] text-cms-text">{slug}</span></span> : null}
      {niche ? null : (
        <span className="basis-full">It shows in every Observatório niche tab until you pick one in <b className="font-medium text-cms-text">Configurar</b>.</span>
      )}
    </div>
  )
}

function LanguageOptions() {
  return <>{CHANNEL_LOCALES.map(l => <option key={l.id} value={l.id}>{l.chip} · {l.name}</option>)}</>
}
function NicheOptions({ niches }: { niches: readonly NicheView[] }) {
  return <>{niches.map(n => <option key={n.slug} value={n.slug}>{n.label}</option>)}<option value="">{NO_NICHE}</option></>
}

/* ------------------------------------------------------------------ Add channel */

/** O que o dono preencheu: fica guardado para o formulário voltar igual se o cadastro falhar. */
export interface AddDraft {
  input: string
  channel: ChannelLookup
  /** o banco sugeriu um slug: a coluna existe e o campo é editável */
  slugSupported: boolean
  slug: string
  locale: ChannelLocale
  niche: string | null
}
export interface AddFailure { draft: AddDraft; error: string; field?: 'slug' | 'niche' | 'handle' }
export const draftToInput = (d: AddDraft): AddChannelInput => ({
  ...d.channel, locale: d.locale, niche: d.niche, slug: d.slugSupported && d.slug !== '' ? d.slug : null,
})

export function AddChannelPanel({ niches, failure, onLookup, onSubmit, onCancel }: {
  niches: readonly NicheView[]
  /** o cadastro anterior falhou: o formulário volta com o que foi digitado e o erro */
  failure: AddFailure | null
  onLookup: (input: { handleOrUrl: string }) => Promise<LookupChannelResult>
  onSubmit: (draft: AddDraft) => void
  onCancel: () => void
}) {
  const uid = useId()
  const [input, setInput] = useState(failure?.draft.input ?? '')
  const [looking, setLooking] = useState(false)
  const [found, setFound] = useState<{ channel: ChannelLookup; slugSupported: boolean } | null>(failure ? { channel: failure.draft.channel, slugSupported: failure.draft.slugSupported } : null)
  const [slug, setSlug] = useState(failure?.draft.slug ?? '')
  const [locale, setLocale] = useState<ChannelLocale>(failure?.draft.locale ?? CHANNEL_LOCALES[0].id)
  const [niche, setNiche] = useState<string | null>(failure ? failure.draft.niche : niches[0]?.slug ?? null)
  const [error, setError] = useState<{ text: string; field?: 'slug' | 'niche' | 'handle' } | null>(failure ? { text: failure.error, field: failure.field } : null)
  const seq = useRef(0)
  const errId = `${uid}-err`

  const lookup = async () => {
    const q = input.trim()
    if (!q || looking) return
    const mine = ++seq.current
    setError(null); setFound(null); setLooking(true)
    let res: LookupChannelResult
    try { res = await onLookup({ handleOrUrl: q }) } catch { res = { ok: false, error: 'Failed to look up channel. Please try again.' } }
    if (seq.current !== mine) return // o campo mudou enquanto a busca corria
    setLooking(false)
    if (!res.ok) { setError({ text: res.error, field: 'handle' }); return }
    setFound({ channel: res.channel, slugSupported: res.slug !== null })
    setSlug(res.slug ?? '')
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!found) return
    const s = slug.trim()
    if (found.slugSupported && s !== '' && !isChannelSlug(s)) { setError({ text: CHANNEL_TEXT.slugInvalid, field: 'slug' }); return }
    onSubmit({ input, channel: found.channel, slugSupported: found.slugSupported, slug: s, locale, niche })
  }
  const bad = (f: 'slug' | 'niche' | 'handle') => (error?.field === f ? { 'aria-invalid': true as const, 'aria-describedby': errId } : {})

  return (
    <form data-add-channel onSubmit={submit} className="flex flex-col gap-3.5 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
      <h2 className="text-sm font-semibold text-cms-text">Add channel</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <label htmlFor={`${uid}-h`} className={labelCls}>Handle or URL</label>
          <input
            id={`${uid}-h`} className={inputCls} value={input} placeholder="@handle or youtube.com/@handle" aria-busy={looking || undefined} {...bad('handle')}
            onChange={e => { seq.current += 1; setInput(e.target.value); setFound(null); setError(null); setLooking(false) }}
            onKeyDown={e => { if (e.key === 'Enter' && !found) { e.preventDefault(); void lookup() } }}
          />
        </div>
        <button type="button" className="btn sm" onClick={() => void lookup()} disabled={looking || !input.trim()} aria-busy={looking || undefined}>
          {looking ? <span aria-hidden="true" className="yc-spin" /> : null}Lookup
        </button>
      </div>
      {looking ? <div aria-hidden="true" className="yc-bar" /> : null}

      {found ? (
        <>
          <div data-lookup-preview className="flex min-w-0 items-center gap-3 rounded-md border border-cms-border px-3 py-2.5">
            <Avatar name={found.channel.name} src={found.channel.thumbnailUrl} size={40} />
            <div className="min-w-0">
              <b className="text-sm font-semibold text-cms-text">{found.channel.name}</b>
              <div className="text-xs text-cms-text-dim">{atHandle(found.channel.handle)} · {found.channel.subscriberCount.toLocaleString('en-US')} subscribers · {found.channel.videoCount.toLocaleString('en-US')} videos</div>
            </div>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${uid}-l`} className={labelCls}>Language</label>
              <select id={`${uid}-l`} className={inputCls} value={locale} onChange={e => { if (isChannelLocale(e.target.value)) setLocale(e.target.value) }}><LanguageOptions /></select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${uid}-n`} className={labelCls}>Niche</label>
              <select id={`${uid}-n`} className={inputCls} value={niche ?? ''} onChange={e => setNiche(e.target.value || null)} {...bad('niche')}><NicheOptions niches={niches} /></select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${uid}-s`} className={labelCls}>Slug</label>
              <input
                id={`${uid}-s`} className={`${inputCls} mono`} value={slug} disabled={!found.slugSupported} aria-describedby={error?.field === 'slug' ? errId : `${uid}-sh`}
                aria-invalid={error?.field === 'slug' || undefined} onChange={e => { setSlug(e.target.value); if (error?.field === 'slug') setError(null) }}
              />
            </div>
          </div>
          <p id={`${uid}-sh`} className={helpCls}>Slug: short id used by the forja and Cowork. It cannot be changed later.</p>
        </>
      ) : null}

      {error ? <p id={errId} role="alert" className={errCls}>{error.text}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary sm" disabled={!found}>Add channel</button>
      </div>
    </form>
  )
}

/** O canal que acabou de ser pedido: só o que o lookup trouxe e o que o dono escolheu. Nenhum número do servidor. */
export function PendingChannelCard({ draft, niches }: { draft: AddDraft; niches: readonly NicheView[] }) {
  const ch = draft.channel
  return (
    <div data-channel-pending aria-busy="true" className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      <div aria-hidden="true" className="yc-bar" />
      <div className="flex items-center gap-3 border-b border-cms-border px-4 py-3">
        <Avatar name={ch.name} src={ch.thumbnailUrl} size={48} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-cms-text">{ch.name}</span><LangChip locale={draft.locale} /></div>
          <span className="text-xs text-cms-text-dim">{atHandle(ch.handle)}</span>
        </div>
      </div>
      <IdentityStrip niche={niches.find(n => n.slug === draft.niche) ?? null} slug={draft.slugSupported && draft.slug !== '' ? draft.slug : null} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-xs text-cms-text-muted">
        <div><span className="font-semibold text-cms-text">{ch.videoCount.toLocaleString('en-US')}</span> videos</div>
        <div><span className="font-semibold text-cms-text">{ch.subscriberCount.toLocaleString('en-US')}</span> subscribers</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ identidade no Configurar */

/**
 * Idioma e nicho no Configurar. O nicho grava ao trocar. O idioma NÃO: trocar o idioma muda qual canal o site público
 * mostra, então a troca abre na hora uma confirmação no cartão com o efeito (calculado na tela) e só grava no sim.
 */
export function ChannelIdentityFields({ locale, niche, slug, niches, busy, error, onChange, describeLanguageChange, readOnly = false }: {
  /** Quem não administra o site vê idioma e nicho, mas não troca (o servidor recusa de qualquer jeito). */
  readOnly?: boolean
  locale: string
  /** slug do nicho mostrado (já resolvido contra a lista do site) */
  niche: string | null
  slug: string | null
  niches: readonly NicheView[]
  busy: boolean
  error: string | null
  onChange: (next: { locale: ChannelLocale; niche: string | null }) => void
  /** as frases do efeito no site público se o canal passar a este idioma */
  describeLanguageChange: (next: ChannelLocale) => string[]
}) {
  const uid = useId()
  const cur: ChannelLocale = isChannelLocale(locale) ? locale : CHANNEL_LOCALES[0].id
  const [asked, setAsked] = useState<ChannelLocale | null>(null)
  const askedNow = asked !== null && asked !== cur ? asked : null
  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">Channel identity</span>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${uid}-l`} className={labelCls}>Language</label>
          <select id={`${uid}-l`} className={inputCls} value={askedNow ?? cur} disabled={readOnly} aria-busy={busy || undefined} onChange={e => { if (isChannelLocale(e.target.value)) setAsked(e.target.value) }}>
            <LanguageOptions />
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${uid}-n`} className={labelCls}>Niche</label>
          <select id={`${uid}-n`} className={inputCls} value={niche ?? ''} disabled={readOnly} aria-busy={busy || undefined} onChange={e => onChange({ locale: cur, niche: e.target.value || null })}>
            <NicheOptions niches={niches} />
          </select>
        </div>
        {slug ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${uid}-s`} className={labelCls}>Slug</label>
            <input id={`${uid}-s`} className={`${inputCls} mono text-cms-text-muted`} value={slug} readOnly aria-describedby={`${uid}-sh`} />
          </div>
        ) : null}
      </div>
      {slug ? <p id={`${uid}-sh`} className={helpCls}>The slug is the id the forja and Cowork use. It cannot be changed.</p> : null}
      {askedNow ? (
        <div data-language-confirm role="group" aria-labelledby={`${uid}-lt`} className="rounded-md border border-amber-900/40 bg-amber-900/10 px-3 py-2.5">
          <h3 id={`${uid}-lt`} className="mb-1 text-sm font-medium text-cms-text">{languageChangeTitle(askedNow)}</h3>
          <p className="text-xs text-cms-text-muted">{LANGUAGE_CHANGE_LEAD}</p>
          {describeLanguageChange(askedNow).map(line => <p key={line} className="text-xs text-cms-text">{line}</p>)}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setAsked(null)} className="rounded border border-cms-border px-3 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover">Cancel</button>
            <button type="button" className="btn primary sm" onClick={() => { const next = askedNow; setAsked(null); onChange({ locale: next, niche }) }}>Change language</button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className={errCls}>{error}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ remoção */

export function RemoveChannelRow({ onAsk, disabled }: { onAsk: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cms-border pt-3.5">
      <p className="flex-[1_1_220px] text-xs text-cms-text-muted">Remove this channel and everything synced from it. You will see what is deleted before confirming.</p>
      <button type="button" className="btn danger sm" onClick={onAsk} disabled={disabled}>Remove channel…</button>
    </div>
  )
}

type RemovalState =
  | { phase: 'loading' }
  | { phase: 'confirm'; impact: RemovalImpact; error: string | null }
  | { phase: 'blocked'; blockers: RemovalBlocker[] }
  | { phase: 'error'; error: string }

/**
 * A confirmação, no cartão. Abre na hora com o título e fica ocupada até as contagens chegarem. Com teste A/B rodando
 * não há botão de confirmar. O botão de remover só habilita com o slug digitado — comparação local, sem servidor.
 */
export function RemovalPanel({ channelId, name, removing, onImpact, onRemove, onRemovingChange, onRemoved, onClose }: {
  channelId: string
  name: string
  removing: boolean
  onImpact: (input: { channelId: string }) => Promise<RemovalImpactResult>
  onRemove: (input: { channelId: string; confirmSlug: string }) => Promise<RemoveChannelResult>
  onRemovingChange: (removing: boolean) => void
  onRemoved: () => void
  onClose: () => void
}) {
  const uid = useId()
  const [state, setState] = useState<RemovalState>({ phase: 'loading' })
  const [typed, setTyped] = useState('')
  // as contagens são pedidas uma vez, quando a confirmação abre (só leitura)
  useEffect(() => {
    let alive = true
    onImpact({ channelId }).then(
      res => { if (alive) setState(!res.ok ? { phase: 'error', error: res.error } : res.impact.blockers.length > 0 ? { phase: 'blocked', blockers: res.impact.blockers } : { phase: 'confirm', impact: res.impact, error: null }) },
      () => { if (alive) setState({ phase: 'error', error: CHANNEL_TEXT.saveFailed }) },
    )
    return () => { alive = false }
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async (impact: RemovalImpact) => {
    if (typed !== impact.slug || removing) return
    onRemovingChange(true)
    let res: RemoveChannelResult
    try { res = await onRemove({ channelId, confirmSlug: typed }) } catch { res = { ok: false, error: CHANNEL_TEXT.saveFailed } }
    if (res.ok) { onRemoved(); return } // continua marcado até o servidor mandar a lista sem o canal
    onRemovingChange(false)
    if (res.blockers && res.blockers.length > 0) setState({ phase: 'blocked', blockers: res.blockers })
    else setState({ phase: 'confirm', impact, error: res.error })
  }

  if (state.phase === 'blocked') {
    return (
      <div data-removal role="alert" className="border-t border-cms-border bg-red-900/10 px-4 py-3">
        <h3 className="mb-1 text-sm font-medium text-red-400">{blockedTitle(name)}</h3>
        <p className="mb-2 text-xs text-cms-text">{blockedLead(state.blockers)}</p>
        <p className="mb-2 text-xs text-cms-text">
          {state.blockers.map((b, i) => (
            <span key={b.id}>{i > 0 ? <br /> : null}<b className="font-semibold">“{b.name}”</b> <span className="text-cms-text-muted">{blockerDetail(b, shortDate)}</span></span>
          ))}
        </p>
        <p className="mb-1 text-xs text-cms-text-muted">Finished tests do not block: they are deleted with the channel. Nothing was deleted.</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/cms/youtube/ab-lab" className="inline-flex min-h-[32px] items-center text-xs font-medium text-cms-accent hover:underline">Open A/B Lab →</Link>
          <button type="button" onClick={onClose} className="rounded border border-cms-border px-3 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover">Close</button>
        </div>
      </div>
    )
  }

  const impact = state.phase === 'confirm' ? state.impact : null
  const keep = impact ? removalKeepLine(impact) : null
  const connection = impact ? removalConnectionLine(impact) : null
  return (
    <div data-removal role="group" aria-labelledby={`${uid}-t`} aria-busy={state.phase === 'loading' || undefined} className="border-t border-cms-border px-4 py-3">
      <h3 id={`${uid}-t`} className="mb-1 text-sm font-medium text-cms-text">{removalTitle(name)}</h3>
      {state.phase === 'loading' ? <div aria-hidden="true" className="yc-bar my-2" /> : null}
      {state.phase === 'error' ? <p role="alert" className={errCls}>{state.error}</p> : null}
      {impact && keep ? (
        <>
          <p className="mb-2 text-xs text-cms-text-muted">This permanently deletes:</p>
          <ul className="mb-2.5 rounded-md border border-cms-border">
            {removalLines(impact).map((l, i) => (
              <li key={l.key} className={`flex items-baseline gap-2.5 px-2.5 py-1.5 text-xs text-cms-text-muted ${i > 0 ? 'border-t border-cms-border' : ''}`}>
                <b className="mono min-w-[44px] flex-none text-right font-medium text-cms-text">{l.count}</b><span>{l.text}</span>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-xs text-cms-text-muted"><b className="font-medium text-cms-text">{keep.strong}</b>{keep.rest}</p>
          {connection ? <p className="mb-2 text-xs text-cms-text-muted">{connection}</p> : null}
          <p className="text-xs text-cms-text-muted">All of it is removed at once, or nothing is. This cannot be undone.</p>
          <label htmlFor={`${uid}-c`} className="mt-3 block text-xs text-cms-text-muted">Type <strong className="mono text-cms-text">{impact.slug}</strong> to confirm</label>
          <input
            id={`${uid}-c`} className={`${inputCls} mono mt-1`} value={typed} placeholder={impact.slug} autoComplete="off" spellCheck={false} disabled={removing}
            onChange={e => setTyped(e.target.value)}
          />
          {state.phase === 'confirm' && state.error ? <p role="alert" className={`${errCls} mt-2`}>{state.error}</p> : null}
        </>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={removing} className="rounded border border-cms-border px-3 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-50">
          {state.phase === 'error' ? 'Close' : 'Cancel'}
        </button>
        {impact ? (
          <button
            type="button" disabled={removing || typed !== impact.slug} aria-busy={removing || undefined} onClick={() => void confirm(impact)}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {removing ? <span aria-hidden="true" className="yc-spin" /> : null}Remove channel
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ nichos */

const COLOR_NAMES: Record<string, string> = { ameixa: 'Plum', rosa: 'Pink', lima: 'Lime', ardosia: 'Slate' }
interface PendingNiche { key: number; slug: string; label: string; dark: string; light: string }

export function NichesBlock({ niches, available, onCreate, onCreated }: {
  niches: readonly NicheView[]
  /** false = a tabela de nichos ainda não existe neste banco */
  available: boolean
  onCreate: (input: { label: string; color: string }) => Promise<{ ok: true; slug: string } | { ok: false; error: string }>
  /** o nicho foi gravado: a página pede os dados novos */
  onCreated: () => void
}) {
  const uid = useId()
  const [name, setName] = useState('')
  const [color, setColor] = useState(NICHE_PALETTE[0]!.id)
  const [pending, setPending] = useState<PendingNiche[]>([])
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  // uma linha otimista sai quando o servidor manda o nicho de verdade
  const shownPending = pending.filter(p => !niches.some(n => n.slug === p.slug))
  const preview = nicheSlugOrNull(name)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const label = normalizeNicheLabel(name)
    const slug = label === null ? null : nicheSlugOrNull(label)
    if (label === null || slug === null) { setError(CHANNEL_TEXT.nicheNameInvalid); return }
    const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
    const clash = [...niches, ...shownPending].find(n => key(n.label) === key(label) || n.slug === slug)
    if (clash) { setError(CHANNEL_TEXT.nicheLabelTaken(clash.label)); return }
    const pal = NICHE_PALETTE.find(c => c.id === color) ?? NICHE_PALETTE[0]!
    const mine = ++seq.current
    const typedName = name
    setError(null); setName('')
    setPending(cur => [...cur, { key: mine, slug, label, dark: pal.dark, light: pal.light }])
    let res: { ok: true; slug: string } | { ok: false; error: string }
    try { res = await onCreate({ label, color: pal.id }) } catch { res = { ok: false, error: CHANNEL_TEXT.saveFailed } }
    if (res.ok) { onCreated(); return }
    const failure = res.error
    setPending(cur => cur.filter(p => p.key !== mine))
    setName(cur => (cur === '' ? typedName : cur))
    setError(failure)
  }

  const total = niches.length + shownPending.length
  return (
    <div data-niches className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-cms-text">Niches<span className="mono ml-1.5 font-normal text-cms-text-dim">{total}</span></h2>
        <p className="mt-0.5 text-xs text-cms-text-muted">A niche groups your channels with the competitors you track in the Observatório. A niche can have more than one channel.</p>
      </div>
      <ul className="border-t border-cms-border">
        {niches.map(n => (
          <li key={n.slug} data-niche-row={n.slug} className="grid items-center gap-3 border-b border-cms-border px-4 py-2 text-[13px] [grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <span className="inline-flex items-center gap-1.5 font-medium text-cms-text" style={nicheVars(n)}>
              <i aria-hidden="true" className="yc-dot" />{n.label}
              {n.builtin ? <span className="ml-2 rounded border border-cms-border px-1.5 text-[11px] font-normal text-cms-text-dim">built-in</span> : null}
            </span>
            <span className="mono text-[11.5px] text-cms-text">{n.slug}</span>
            <span className="whitespace-nowrap text-xs text-cms-text-muted">{nicheUsage(n.channels, n.competitors)}</span>
          </li>
        ))}
        {shownPending.map(p => (
          <li key={`p${p.key}`} data-niche-row={p.slug} aria-busy="true" className="grid items-center gap-3 border-b border-cms-border px-4 py-2 text-[13px] opacity-60 [grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <span className="inline-flex items-center gap-1.5 font-medium text-cms-text" style={nicheVars(p)}><i aria-hidden="true" className="yc-dot" />{p.label}</span>
            <span className="mono text-[11.5px] text-cms-text">{p.slug}</span>
            <span aria-hidden="true" className="yc-spin text-cms-text-dim" />
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">Add niche</span>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
            <label htmlFor={`${uid}-n`} className={labelCls}>Name</label>
            <input
              id={`${uid}-n`} className={inputCls} value={name} placeholder="e.g. Jogos" maxLength={40} disabled={!available}
              aria-invalid={error ? true : undefined} aria-describedby={error ? `${uid}-e` : `${uid}-h`}
              onChange={e => { setName(e.target.value); setError(null) }}
            />
          </div>
          <div className="flex flex-none flex-col gap-1">
            <span id={`${uid}-c`} className={labelCls}>Color</span>
            <div role="radiogroup" aria-labelledby={`${uid}-c`} className="flex gap-2">
              {NICHE_PALETTE.map(c => (
                <label key={c.id} title={COLOR_NAMES[c.id] ?? c.id} style={nicheVars(c)} className={`yc-swatch relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border ${color === c.id ? 'border-cms-text' : 'border-transparent'}`}>
                  <input type="radio" name={`${uid}-color`} aria-label={COLOR_NAMES[c.id] ?? c.id} checked={color === c.id} disabled={!available} onChange={() => setColor(c.id)} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
                  <i aria-hidden="true" />
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn sm" disabled={!available}>Add niche</button>
        </div>
        {error
          ? <p id={`${uid}-e`} role="alert" className={errCls}>{error}</p>
          : !available
            ? <p id={`${uid}-h`} className={helpCls}>{CHANNEL_TEXT.nichesUnavailable}</p>
            : (
              <p id={`${uid}-h`} className={helpCls}>
                {preview ? <>Slug: <span className="mono text-cms-text">{preview}</span>. </> : null}
                New niches start without a theme list in the Observatório. Niches can’t be renamed or deleted yet.
              </p>
            )}
      </form>
    </div>
  )
}
