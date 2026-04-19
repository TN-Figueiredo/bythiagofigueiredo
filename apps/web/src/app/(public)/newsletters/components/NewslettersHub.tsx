'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { subscribeToNewsletters } from '../../actions/subscribe-newsletters'

// ── Static catalog (matches DB seeds in 20260501000009) ──────────────────────
const CATALOG = [
  {
    baseId: 'main',
    primary: true,
    colorDark: '#FF8240',
    colorLight: '#C14513',
    en: { name: 'The bythiago diary', tagline: 'the week in review — blog + channel + what I\'ve been thinking.', cadence: 'weekly, Fridays', badge: 'main', sample: 'week 17 · CMS + a bug that cost me three hours', subs: '1,240 subscribers', issues: '34 issues' },
    pt: { name: 'Diário do bythiago', tagline: 'o resumo da semana — blog + canal + o que andei pensando.', cadence: '1× por semana, sextas', badge: 'principal', sample: 'semana 17 · CMS + um bug que me custou três horas', subs: '1.240 inscritos', issues: '34 edições' },
  },
  {
    baseId: 'trips',
    colorDark: '#5FA87D',
    colorLight: '#2C6E49',
    en: { name: 'Curves & roads', tagline: 'motorcycle trips, maps, roadside food.', cadence: 'whenever I hit the road', badge: 'new', sample: 'serra da canastra · 3 days, two tanks, one storm', subs: '182 subscribers', issues: '4 issues' },
    pt: { name: 'Curvas & estradas', tagline: 'relatos de moto, mapas, comida de beira de estrada.', cadence: 'quando eu pegar estrada', badge: 'novo', sample: 'serra da canastra · 3 dias, dois tanques, uma chuva', subs: '182 inscritos', issues: '4 edições' },
  },
  {
    baseId: 'growth',
    colorDark: '#A983D6',
    colorLight: '#6B4A91',
    en: { name: 'Grow inward', tagline: 'habits, books, what\'s kept me from losing it.', cadence: 'every 2 weeks, Sundays', badge: undefined, sample: 'what changed when I stopped measuring productivity', subs: '408 subscribers', issues: '11 issues' },
    pt: { name: 'Crescer de dentro', tagline: 'hábitos, leituras, o que me ajudou a não surtar.', cadence: 'a cada 2 semanas, domingos', badge: undefined, sample: 'o que mudou quando parei de medir produtividade', subs: '408 inscritos', issues: '11 edições' },
  },
  {
    baseId: 'code',
    colorDark: '#5FA8E0',
    colorLight: '#1F5F8B',
    en: { name: 'Code in Portuguese', tagline: 'stack decisions, real bugs, no hype.', cadence: 'monthly, last Thursday', badge: undefined, sample: 'why I went back to Postgres (and stopped trying to be clever)', subs: '620 subscribers', issues: '8 issues' },
    pt: { name: 'Código em português', tagline: 'decisões de stack, bugs reais, sem hype.', cadence: 'mensal, última quinta', badge: undefined, sample: 'por que voltei pro Postgres (e parei de tentar ser inteligente)', subs: '620 inscritos', issues: '8 edições' },
  },
] as const

type NL = typeof CATALOG[number]

interface Props {
  locale: 'en' | 'pt-BR'
  currentTheme: 'dark' | 'light'
}

export function NewslettersHub({ locale, currentTheme }: Props) {
  const dark = currentTheme === 'dark'
  const L = locale === 'pt-BR' ? 'pt' : 'en'

  // Theme tokens
  const bg      = dark ? '#14110B' : '#E9E1CE'
  const paper   = dark ? '#2A241A' : '#FBF6E8'
  const paper2  = dark ? '#312A1E' : '#F5EDD6'
  const ink     = dark ? '#EFE6D2' : '#161208'
  const muted   = dark ? '#958A75' : '#6A5F48'
  const faint   = dark ? '#6B634F' : '#9C9178'
  const line    = dark ? '#2E2718' : '#CEBFA0'
  const accent  = dark ? '#FF8240' : '#C14513'
  const tape    = dark ? 'rgba(255,226,140,0.42)' : 'rgba(255,226,140,0.75)'
  const tape2   = dark ? 'rgba(209,224,255,0.36)' : 'rgba(200,220,255,0.7)'
  const shadow  = dark
    ? '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)'
    : '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)'

  // State
  const [checked, setChecked] = useState<Set<string>>(() => new Set(['main']))
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'pick' | 'sent' | 'suggest'>('pick')
  const [sentTo, setSentTo] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, startTransition] = useTransition()

  const toggle = (id: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const nlColor = (nl: NL) => dark ? nl.colorDark : nl.colorLight

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@') || checked.size === 0) return
    setServerError(null)
    const ids = Array.from(checked).map(baseId => `${baseId}-${L === 'pt' ? 'pt' : 'en'}`)
    startTransition(async () => {
      const result = await subscribeToNewsletters(email, ids, locale)
      if (result.error) { setServerError(result.error); return }
      const pickedBaseIds = Array.from(checked)
      setSentTo(pickedBaseIds)
      const onlyMain = pickedBaseIds.length === 1 && pickedBaseIds[0] === 'main'
      setPhase(onlyMain ? 'suggest' : 'sent')
    })
  }

  const rot  = (i: number) => ((i * 37) % 7 - 3) * 0.5
  const lift = (i: number) => ((i * 53) % 5 - 2) * 2

  // ── Card ──────────────────────────────────────────────────────────────────
  const NewsletterCard = ({ nl, index }: { nl: NL; index: number }) => {
    const isChecked = checked.has(nl.baseId)
    const color = nlColor(nl)
    const data = nl[L]
    return (
      <div style={{ position: 'relative', paddingTop: 20 }}>
        {/* Tape */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            ...(index % 2 ? { left: '22%' } : { right: '22%' }),
            width: 80, height: 18,
            background: index % 2 ? tape2 : tape,
            transform: `rotate(${(index * 9) % 14 - 7}deg)`,
            zIndex: 0,
            borderRadius: 1,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
          }}
        />
        {/* Paper */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggle(nl.baseId)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle(nl.baseId)}
          style={{
            position: 'relative', zIndex: 1,
            background: index % 3 === 1 ? paper2 : paper,
            transform: `rotate(${rot(index)}deg) translateY(${lift(index)}px)`,
            boxShadow: shadow,
            outline: isChecked ? `2px solid ${color}` : 'none',
            outlineOffset: 4,
            transition: 'outline 0.18s, box-shadow 0.18s',
            cursor: 'pointer',
          }}
        >
          {/* Left color ribbon */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, background: color }} />

          <div style={{ padding: '22px 24px 22px 32px' }}>
            {/* Kicker row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color, fontWeight: 700 }}>
                {String(index + 1).padStart(2, '0')} · {data.cadence}
              </span>
              {'badge' in data && data.badge && (
                <span style={{ padding: '2px 8px', background: color, color: '#FFF', fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transform: 'rotate(-1deg)', display: 'inline-block' }}>
                  {data.badge}
                </span>
              )}
              {/* Checkbox */}
              <div
                aria-checked={isChecked}
                role="checkbox"
                style={{
                  marginLeft: 'auto', flexShrink: 0,
                  width: 26, height: 26,
                  border: `2px solid ${isChecked ? color : line}`,
                  background: isChecked ? color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {isChecked && <span style={{ color: '#FFF', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
            </div>

            {/* Title */}
            <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: 26, lineHeight: 1.1, margin: '0 0 10px', fontWeight: 500, letterSpacing: '-0.02em', color: ink }}>
              {data.name}
            </h3>

            {/* Tagline */}
            <p style={{ fontSize: 14, color: muted, lineHeight: 1.55, margin: '0 0 14px' }}>
              {data.tagline}
            </p>

            {/* Sample issue */}
            <div style={{ padding: '10px 12px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderLeft: `2px solid ${color}`, marginBottom: 14 }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: faint, marginBottom: 4 }}>
                {L === 'pt' ? 'última edição' : 'latest issue'}
              </div>
              <div style={{ fontSize: 13, color: ink, lineHeight: 1.4, fontStyle: 'italic' }}>
                "{data.sample}"
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: faint, letterSpacing: '0.04em' }}>
              <span>◉ {data.subs}</span>
              <span>▦ {data.issues}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Selected list for sticky bar ──────────────────────────────────────────
  const selectedList = Array.from(checked).map(id => CATALOG.find(n => n.baseId === id)).filter(Boolean) as NL[]
  const canSubmit = checked.size > 0 && email.includes('@')

  const StickyBar = () => (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 10,
      background: dark ? 'rgba(20,17,11,0.97)' : 'rgba(233,225,206,0.97)',
      borderTop: `2px solid ${accent}`,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      padding: '18px 28px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Count + badges */}
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: faint, marginBottom: 6 }}>
            {checked.size > 0 ? (
              <>{L === 'pt' ? 'você escolheu' : 'you picked'}{' '}
                <span style={{ color: accent, fontWeight: 700 }}>{checked.size}</span>{' '}
                {checked.size === 1 ? 'newsletter' : 'newsletters'}</>
            ) : (
              <>{L === 'pt' ? 'marca pelo menos uma 👆' : 'pick at least one 👆'}</>
            )}
          </div>
          {selectedList.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedList.map(nl => (
                <span key={nl.baseId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', border: `1.5px solid ${nlColor(nl)}`, color: nlColor(nl), fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.04em' }}>
                  {nl[L].name}
                  <button onClick={() => toggle(nl.baseId)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flex: '1 1 360px', maxWidth: 540 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={L === 'pt' ? 'seu email' : 'your email'}
            required
            style={{
              flex: 1, padding: '12px 14px',
              border: `1.5px solid ${serverError ? '#E53E3E' : line}`,
              background: dark ? 'rgba(0,0,0,0.3)' : '#FFF',
              color: ink, fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            style={{
              padding: '12px 22px',
              background: !canSubmit || submitting ? (dark ? '#3A2E1F' : '#D8C9A7') : accent,
              color: !canSubmit || submitting ? faint : '#FFF',
              border: 'none',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
              cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? '…' : `✉ ${L === 'pt' ? 'inscrever' : 'subscribe'}`}
          </button>
        </form>

        {serverError && (
          <p style={{ width: '100%', margin: 0, color: '#E53E3E', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
            {serverError}
          </p>
        )}
      </div>
    </div>
  )

  // ── Success screen ────────────────────────────────────────────────────────
  if (phase === 'sent') {
    return (
      <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '96px 28px' }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 60, color: accent, lineHeight: 1, marginBottom: 16, transform: 'rotate(-2deg)', display: 'inline-block' }}>
            {L === 'pt' ? 'valeu!' : 'thanks!'}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 42, margin: '0 0 20px', fontWeight: 500, letterSpacing: '-0.02em', color: ink }}>
            {L === 'pt'
              ? <>{`Inscreveu em `}<span style={{ color: accent }}>{sentTo.length}</span>{` newsletter${sentTo.length > 1 ? 's' : ''}.`}</>
              : <>{`Subscribed to `}<span style={{ color: accent }}>{sentTo.length}</span>{` newsletter${sentTo.length > 1 ? 's' : ''}.`}</>}
          </h1>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.6, marginBottom: 32 }}>
            {L === 'pt'
              ? `Mandamos um email de confirmação pra ${email} — clica no link e tá pronto.`
              : `We sent a confirmation email to ${email} — click the link and you're set.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            {sentTo.map(baseId => {
              const nl = CATALOG.find(n => n.baseId === baseId)
              if (!nl) return null
              return (
                <div key={baseId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderLeft: `3px solid ${nlColor(nl)}`, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color: nlColor(nl), fontWeight: 700 }}>✓</span>
                  <span style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500, color: ink }}>{nl[L].name}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: '0.06em', marginLeft: 'auto' }}>{nl[L].cadence}</span>
                </div>
              )
            })}
          </div>
          <Link
            href={locale === 'pt-BR' ? '/pt-BR' : '/'}
            style={{ display: 'inline-block', padding: '12px 26px', background: 'transparent', color: ink, border: `1.5px solid ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' }}
          >
            {L === 'pt' ? '← voltar pra home' : '← back to home'}
          </Link>
        </section>
      </div>
    )
  }

  // ── Suggest screen (subscribed only main → show others) ───────────────────
  if (phase === 'suggest') {
    const others = CATALOG.filter(n => !sentTo.includes(n.baseId))
    return (
      <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '72px 28px 48px' }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 48, color: accent, lineHeight: 1, marginBottom: 12, transform: 'rotate(-2deg)', display: 'inline-block' }}>
            {L === 'pt' ? 'inscrito!' : 'subscribed!'}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 36, margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.02em', color: ink }}>
            {L === 'pt'
              ? 'Já está no diário. Quer receber mais alguma coisa?'
              : "You're on the diary. Want a few more things?"}
          </h1>
          <p style={{ fontSize: 15, color: muted, lineHeight: 1.6, marginBottom: 36 }}>
            {L === 'pt'
              ? `Usamos o mesmo ${email}. Marca o que te interessa, ou pula — sem drama.`
              : `We'll use the same ${email}. Check what interests you, or skip — no drama.`}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, rowGap: 48, marginBottom: 36 }}>
            {others.map((nl, i) => <NewsletterCard key={nl.baseId} nl={nl} index={i + 2} />)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const extra = Array.from(checked).filter(id => !sentTo.includes(id))
                setSentTo([...sentTo, ...extra])
                setPhase('sent')
              }}
              style={{ padding: '12px 22px', background: accent, color: '#FFF', border: 'none', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}
            >
              ✉ {L === 'pt' ? 'inscrever nas selecionadas' : 'subscribe to selected'}
            </button>
            <button
              onClick={() => setPhase('sent')}
              style={{ padding: '12px 22px', background: 'transparent', color: muted, border: `1.5px solid ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
            >
              {L === 'pt' ? 'pular, só a principal' : 'skip, main only'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── Pick phase (default) ──────────────────────────────────────────────────
  return (
    <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 28px 32px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: accent, marginBottom: 10 }}>
          / {L === 'pt' ? 'newsletters' : 'newsletters'} · {CATALOG.length} {L === 'pt' ? 'cadernos' : 'notebooks'}
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", serif', fontSize: 'clamp(40px, 6vw, 68px)',
          margin: 0, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.0,
          position: 'relative', display: 'inline-block', color: ink,
        }}>
          {L === 'pt' ? 'Escolhe o que você quer receber' : 'Pick what you want to get'}
          <span style={{ position: 'absolute', bottom: 4, left: -6, right: -6, height: 18, background: '#FFE37A', zIndex: -1, opacity: 0.7, transform: 'skew(-2deg)' }} />
        </h1>
        <p style={{ fontSize: 16, color: muted, marginTop: 18, maxWidth: 680, lineHeight: 1.65 }}>
          {L === 'pt'
            ? 'Eu escrevo em várias frentes e não quero te encher de coisa que você não pediu. São newsletters separadas, cada uma com sua frequência. Marca quantas quiser.'
            : "I write across several fronts and don't want to spam you with stuff you didn't ask for. They're separate newsletters, each with its own rhythm. Check as many as you like."}
        </p>

        {/* Quick controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => setChecked(new Set(CATALOG.map(n => n.baseId)))}
            style={{ padding: '6px 14px', background: 'transparent', color: ink, border: `1px dashed ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
          >
            ✓ {L === 'pt' ? 'marcar todas' : 'check all'}
          </button>
          <button
            onClick={() => setChecked(new Set())}
            style={{ padding: '6px 14px', background: 'transparent', color: faint, border: `1px dashed ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
          >
            ✕ {L === 'pt' ? 'desmarcar' : 'clear'}
          </button>
          <span style={{ fontFamily: '"Caveat", cursive', fontSize: 18, color: accent, transform: 'rotate(-1deg)', marginLeft: 'auto' }}>
            ↓ {L === 'pt' ? 'quatro opções, sem drama' : 'four options, no drama'}
          </span>
        </div>
      </section>

      {/* Newsletter grid */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 28, rowGap: 52 }}>
          {CATALOG.map((nl, i) => <NewsletterCard key={nl.baseId} nl={nl} index={i} />)}
        </div>
      </section>

      {/* p.s. note */}
      <section style={{ maxWidth: 900, margin: '32px auto 0', padding: '0 28px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '20px 24px', background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderLeft: `3px solid ${muted}` }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 28, color: muted, lineHeight: 1, transform: 'rotate(-2deg)' }}>p.s.</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 14, color: muted, lineHeight: 1.65, margin: 0 }}>
              {L === 'pt'
                ? <>Sem anúncios, sem parceria escondida, sem gatilho de "URGENTE". É um email por quando der, sobre o que tá rolando.{' '}<a href="#" style={{ color: accent, textDecoration: 'underline' }}>descadastro sempre no rodapé</a>.</>
                : <>No ads, no hidden sponsorships, no "URGENT" triggers. One email when it&apos;s ready, about what&apos;s happening.{' '}<a href="#" style={{ color: accent, textDecoration: 'underline' }}>unsubscribe is always in the footer</a>.</>}
            </p>
          </div>
        </div>
      </section>

      {/* Sticky subscribe bar */}
      <StickyBar />

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: '28px', textAlign: 'center', color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em' }}>
        <Link href={locale === 'pt-BR' ? '/pt-BR' : '/'} style={{ color: accent, textDecoration: 'none' }}>
          ← {L === 'pt' ? 'voltar pra home' : 'back to home'}
        </Link>
        <span style={{ margin: '0 14px', opacity: 0.5 }}>·</span>
        <Link href={locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'} style={{ color: muted, textDecoration: 'none' }}>
          {L === 'pt' ? 'blog' : 'blog'}
        </Link>
      </footer>
    </div>
  )
}
