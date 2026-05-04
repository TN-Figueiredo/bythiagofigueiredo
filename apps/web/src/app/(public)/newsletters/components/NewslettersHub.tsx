'use client'

import { useState, useTransition, useCallback, useMemo, useEffect, memo } from 'react'
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
    pt: { name: 'Diário do bythiago', tagline: 'o resumo da semana — blog + canal + o que andei pensando.', cadence: '1x por semana, sextas', badge: 'principal', sample: 'semana 17 · CMS + um bug que me custou três horas', subs: '1.240 inscritos', issues: '34 edições' },
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

const SLUG_MAP: Record<string, Record<'en' | 'pt', string>> = {
  main: { en: 'the-bythiago-diary', pt: 'diario-do-bythiago' },
  trips: { en: 'curves-and-roads', pt: 'curvas-e-estradas' },
  growth: { en: 'grow-inward', pt: 'crescer-de-dentro' },
  code: { en: 'code-in-portuguese', pt: 'codigo-em-portugues' },
}

type NL = typeof CATALOG[number]

interface ThemeTokens {
  dark: boolean
  paper: string; paper2: string; ink: string; muted: string
  faint: string; line: string; tape: string; tape2: string; shadow: string
}

// ── Pinboard personality per card ────────────────────────────────────────────
const PINBOARD = [
  { rot: -0.8, lift: -2 },
  { rot: 0.6, lift: 1 },
  { rot: -0.5, lift: 3 },
  { rot: 0.4, lift: -1 },
]

const nlColor = (nl: NL, dark: boolean) => dark ? nl.colorDark : nl.colorLight

// ── i18n strings ─────────────────────────────────────────────────────────────
const STRINGS = {
  en: {
    breadcrumb: '/ newsletters',
    notebooks: 'notebooks',
    headline: 'Pick what you want to get',
    subhead: "I write across several fronts and don't want to spam you with stuff you didn't ask for. They're separate newsletters, each with its own rhythm. Check as many as you like.",
    selectAll: 'select all',
    allSelected: 'all selected',
    clear: 'clear',
    fourOptions: 'four options, no drama',
    latestIssue: 'latest issue',
    learnMore: 'learn more',
    added: 'ADDED',
    add: 'add',
    pickedN: (n: number) => `you picked **${n}** newsletter${n === 1 ? '' : 's'}`,
    pickedAll: (n: number) => `you picked **all ${n}** newsletters`,
    pickAtLeastOne: 'pick at least one',
    yourEmail: 'your email',
    subscribe: 'subscribe',
    ps: <>No ads, no hidden sponsorships, no &ldquo;URGENT&rdquo; triggers. One email when it&apos;s ready, about what&apos;s happening. <a style={{ textDecoration: 'underline' }}>unsubscribe is always in the footer</a>.</>,
    backHome: 'back to home',
    blog: 'blog',
    thanks: 'thanks!',
    subscribedTo: (n: number) => <>Subscribed to <span>{n}</span> newsletter{n > 1 ? 's' : ''}.</>,
    confirmSent: (email: string) => `We sent a confirmation email to ${email} — click the link and you're set.`,
    subscribed: 'subscribed!',
    suggestHeadline: "You're on the diary. Want a few more things?",
    suggestSubhead: (email: string) => `We'll use the same ${email}. Check what interests you, or skip — no drama.`,
    subscribeSelected: 'subscribe to selected',
    skipMainOnly: 'skip, main only',
    announcementAdded: (name: string, count: number, total: number) => `${name} added. ${count} of ${total} selected.`,
    announcementRemoved: (name: string, count: number, total: number) => `${name} removed. ${count} of ${total} selected.`,
    counterOf: (n: number, total: number) => `${n} of ${total} selected`,
    counterAll: (total: number) => `all ${total} selected`,
  },
  pt: {
    breadcrumb: '/ newsletters',
    notebooks: 'cadernos',
    headline: 'Escolhe o que você quer receber',
    subhead: 'Eu escrevo em várias frentes e não quero te encher de coisa que você não pediu. São newsletters separadas, cada uma com sua frequência. Marca quantas quiser.',
    selectAll: 'marcar todas',
    allSelected: 'todas selecionadas',
    clear: 'desmarcar',
    fourOptions: 'quatro opções, sem drama',
    latestIssue: 'última edição',
    learnMore: 'saiba mais',
    added: 'ADICIONADA',
    add: 'adicionar',
    pickedN: (n: number) => `você escolheu **${n}** newsletter${n === 1 ? '' : 's'}`,
    pickedAll: (n: number) => `você escolheu **todas ${n}** newsletters`,
    pickAtLeastOne: 'marca pelo menos uma',
    yourEmail: 'seu email',
    subscribe: 'inscrever',
    ps: <>Sem anúncios, sem parceria escondida, sem gatilho de &ldquo;URGENTE&rdquo;. É um email por quando der, sobre o que tá rolando. <a style={{ textDecoration: 'underline' }}>descadastro sempre no rodapé</a>.</>,
    backHome: 'voltar pra home',
    blog: 'blog',
    thanks: 'valeu!',
    subscribedTo: (n: number) => <>Inscreveu em <span>{n}</span> newsletter{n > 1 ? 's' : ''}.</>,
    confirmSent: (email: string) => `Mandamos um email de confirmação pra ${email} — clica no link e tá pronto.`,
    subscribed: 'inscrito!',
    suggestHeadline: 'Já está no diário. Quer receber mais alguma coisa?',
    suggestSubhead: (email: string) => `Usamos o mesmo ${email}. Marca o que te interessa, ou pula — sem drama.`,
    subscribeSelected: 'inscrever nas selecionadas',
    skipMainOnly: 'pular, só a principal',
    announcementAdded: (name: string, count: number, total: number) => `${name} adicionada. ${count} de ${total} selecionadas.`,
    announcementRemoved: (name: string, count: number, total: number) => `${name} removida. ${count} de ${total} selecionadas.`,
    counterOf: (n: number, total: number) => `${n} de ${total} selecionadas`,
    counterAll: (total: number) => `todas ${total} selecionadas`,
  },
} as const

// ── Card component ───────────────────────────────────────────────────────────
interface CardProps {
  nl: NL
  index: number
  L: 'en' | 'pt'
  isChecked: boolean
  onToggle: (id: string) => void
  theme: ThemeTokens
  strings: typeof STRINGS['en'] | typeof STRINGS['pt']
  entranceDelay: number
}

const NewsletterCard = memo(function NewsletterCard({
  nl, index, L, isChecked, onToggle, theme, strings, entranceDelay,
}: CardProps) {
  const { dark, paper, paper2, ink, muted, faint, tape, tape2, shadow } = theme
  const color = nlColor(nl, dark)
  const data = nl[L]
  const pin = PINBOARD[index] ?? { rot: 0, lift: 0 }
  const [pulsing, setPulsing] = useState(false)
  const [entered, setEntered] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), entranceDelay)
    return () => clearTimeout(timer)
  }, [entranceDelay])

  const handleToggle = useCallback(() => {
    setPulsing(true)
    setTimeout(() => setPulsing(false), 400)
    onToggle(nl.baseId)
  }, [nl.baseId, onToggle])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }, [handleToggle])

  // Opacity levels — deselected cards warm on hover per spec 3.2
  const titleOpacity = isChecked ? 1 : hovered ? 0.72 : 0.55
  const taglineOpacity = isChecked ? 1 : hovered ? 0.55 : 0.45
  const sampleOpacity = isChecked ? 1 : hovered ? 0.40 : 0.30
  const statsOpacity = isChecked ? 1 : hovered ? 0.35 : 0.25
  const barOpacityHover = isChecked ? 1 : hovered ? 0.5 : 0.3

  const glowShadow = isChecked
    ? `0 0 30px ${color}33, ${shadow}`
    : shadow

  const borderColor = isChecked
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(255,255,255,0.03)'

  const barWidth = isChecked ? 6 : 3

  return (
    <div
      style={{
        position: 'relative',
        paddingTop: 20,
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {/* Tape decoration */}
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

      {/* Card body */}
      <div
        role="checkbox"
        aria-checked={isChecked}
        aria-label={`${data.name} — ${data.cadence}`}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative', zIndex: 1,
          background: index % 2 === 1 ? paper2 : paper,
          transform: `rotate(${pin.rot}deg) translateY(${pin.lift}px)`,
          boxShadow: pulsing ? `0 0 0 4px ${color}66, ${glowShadow}` : glowShadow,
          border: `1.5px solid ${borderColor}`,
          transition: 'transform 0.28s cubic-bezier(.4,0,.2,1), box-shadow 0.28s cubic-bezier(.4,0,.2,1), border-color 0.25s ease',
          cursor: 'pointer',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          setHovered(true)
          const el = e.currentTarget
          el.style.transform = `rotate(${pin.rot}deg) translateY(${pin.lift - 3}px)`
          el.style.boxShadow = isChecked
            ? `0 0 40px ${color}44, 0 4px 0 rgba(0,0,0,0.5), 0 16px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)`
            : `0 0 20px ${color}22, 0 3px 0 rgba(0,0,0,0.5), 0 14px 28px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.03)`
        }}
        onMouseLeave={(e) => {
          setHovered(false)
          const el = e.currentTarget
          el.style.transform = `rotate(${pin.rot}deg) translateY(${pin.lift}px)`
          el.style.boxShadow = glowShadow
        }}
        className="nl-card"
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: barWidth,
          background: color,
          opacity: barOpacityHover,
          transition: 'width 0.25s ease, opacity 0.25s ease',
        }} />

        {/* Badge */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -1,
            right: 16,
            zIndex: 2,
            transition: 'transform 0.25s ease, opacity 0.25s ease',
          }}
        >
          {isChecked ? (
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              background: color,
              color: '#FFF',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              {'✓'} {strings.added}
            </span>
          ) : (
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              border: `1.5px dashed ${hovered ? color : '#7A7060'}`,
              color: hovered ? color : '#7A7060',
              background: hovered ? `${color}14` : 'transparent',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: '0.10em',
              fontWeight: 600,
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'all 0.25s ease',
            }}>
              + {strings.add}
            </span>
          )}
        </div>

        <div style={{ padding: '22px 24px 22px 32px' }}>
          {/* Cadence line + type badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color,
              fontWeight: 700,
              opacity: isChecked ? 1 : 0.6,
              transition: 'opacity 0.25s ease',
            }}>
              {String(index + 1).padStart(2, '0')} · {data.cadence}
            </span>
            {data.badge && (
              <span style={{
                padding: '2px 8px',
                background: color,
                color: '#FFF',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                transform: 'rotate(-1deg)',
                display: 'inline-block',
              }}>
                {data.badge}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 26,
            lineHeight: 1.1,
            margin: '0 0 10px',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: ink,
            opacity: titleOpacity,
            transition: 'opacity 0.25s ease',
          }}>
            {data.name}
          </h3>

          {/* Tagline */}
          <p style={{
            fontSize: 14,
            color: muted,
            lineHeight: 1.55,
            margin: '0 0 14px',
            opacity: taglineOpacity,
            transition: 'opacity 0.25s ease',
          }}>
            {data.tagline}
          </p>

          {/* Sample box */}
          <div style={{
            padding: '10px 12px',
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderLeft: `2px solid ${color}`,
            marginBottom: 14,
            opacity: sampleOpacity,
            transition: 'opacity 0.25s ease',
          }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: faint,
              marginBottom: 4,
            }}>
              {strings.latestIssue}
            </div>
            <div style={{ fontSize: 13, color: ink, lineHeight: 1.4, fontStyle: 'italic' }}>
              &ldquo;{data.sample}&rdquo;
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: 16,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color: faint,
            letterSpacing: '0.04em',
            opacity: statsOpacity,
            transition: 'opacity 0.25s ease',
          }}>
            <span>{'◉'} {data.subs}</span>
            <span>{'▦'} {data.issues}</span>
          </div>

          {/* Learn more link */}
          {(() => {
            const slug = SLUG_MAP[nl.baseId]?.[L]
            return slug ? (
              <Link
                href={`/newsletters/${slug}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                  fontSize: 11,
                  color,
                  textDecoration: 'underline',
                  display: 'block',
                  marginTop: 8,
                  opacity: isChecked ? 1 : 0.4,
                  transition: 'opacity 0.25s ease',
                }}
              >
                {strings.learnMore} {'→'}
              </Link>
            ) : null
          })()}
        </div>
      </div>
    </div>
  )
})

// ── Main hub ────────────────────────────────────────────────────────────────
interface Props {
  locale: 'en' | 'pt-BR'
  currentTheme: 'dark' | 'light'
}

export function NewslettersHub({ locale, currentTheme }: Props) {
  const dark = currentTheme === 'dark'
  const L = locale === 'pt-BR' ? 'pt' : 'en'
  const strings = STRINGS[L]

  const bg     = dark ? '#14110B' : '#E9E1CE'
  const accent = dark ? '#FF8240' : '#C14513'

  const theme = useMemo<ThemeTokens>(() => ({
    dark,
    paper:  dark ? '#2A241A' : '#FBF6E8',
    paper2: dark ? '#312A1E' : '#F5EDD6',
    ink:    dark ? '#EFE6D2' : '#161208',
    muted:  dark ? '#958A75' : '#6A5F48',
    faint:  dark ? '#6B634F' : '#9C9178',
    line:   dark ? '#2E2718' : '#CEBFA0',
    tape:   dark ? 'rgba(255,226,140,0.42)' : 'rgba(255,226,140,0.75)',
    tape2:  dark ? 'rgba(209,224,255,0.36)' : 'rgba(200,220,255,0.7)',
    shadow: dark
      ? '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)'
      : '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)',
  }), [dark])

  const { ink, muted, faint, line } = theme

  // State
  const [checked, setChecked] = useState<Set<string>>(() => new Set(CATALOG.map(n => n.baseId)))
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'pick' | 'sent' | 'suggest'>('pick')
  const [sentTo, setSentTo] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, startTransition] = useTransition()
  const [announcement, setAnnouncement] = useState('')

  const isValidEmail = email.includes('@') && email.includes('.')

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      const wasChecked = next.has(id)
      wasChecked ? next.delete(id) : next.add(id)

      // Build announcement
      const nl = CATALOG.find(n => n.baseId === id)
      if (nl) {
        const name = nl[L].name
        const count = next.size
        if (wasChecked) {
          setAnnouncement(strings.announcementRemoved(name, count, CATALOG.length))
        } else {
          setAnnouncement(strings.announcementAdded(name, count, CATALOG.length))
        }
      }

      return next
    })
  }, [L, strings])

  const selectAll = useCallback(() => {
    setChecked(new Set(CATALOG.map(n => n.baseId)))
    setAnnouncement(strings.counterAll(CATALOG.length))
  }, [strings])

  const clearAll = useCallback(() => {
    setChecked(new Set())
    setAnnouncement(strings.pickAtLeastOne)
  }, [strings])

  const doSubscribe = useCallback((ids: string[]) => {
    if (!isValidEmail || ids.length === 0) return
    setServerError(null)
    const dbIds = ids.map(baseId => `${baseId}-${L === 'pt' ? 'pt' : 'en'}`)
    startTransition(async () => {
      const result = await subscribeToNewsletters(email, dbIds, locale)
      if (result.error) { setServerError(result.error); return }
      setSentTo(prev => [...new Set([...prev, ...ids])])
      const onlyMain = ids.length === 1 && ids[0] === 'main'
      setPhase(onlyMain ? 'suggest' : 'sent')
    })
  }, [email, isValidEmail, L, locale])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    doSubscribe(Array.from(checked))
  }, [checked, doSubscribe])

  const selectedList = useMemo(
    () => Array.from(checked).map(id => CATALOG.find(n => n.baseId === id)).filter((nl): nl is NL => nl !== undefined),
    [checked],
  )
  const canSubmit = checked.size > 0 && isValidEmail

  const allSelected = checked.size === CATALOG.length
  const noneSelected = checked.size === 0

  // ── Success screen ────────────────────────────────────────────────────────
  if (phase === 'sent') {
    return (
      <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '96px 28px' }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 60, color: accent, lineHeight: 1, marginBottom: 16, transform: 'rotate(-2deg)', display: 'inline-block' }}>
            {strings.thanks}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 42, margin: '0 0 20px', fontWeight: 500, letterSpacing: '-0.02em', color: ink }}>
            {strings.subscribedTo(sentTo.length)}
          </h1>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.6, marginBottom: 32 }}>
            {strings.confirmSent(email)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            {sentTo.map(baseId => {
              const nl = CATALOG.find(n => n.baseId === baseId)
              if (!nl) return null
              const color = nlColor(nl, dark)
              return (
                <div key={baseId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderLeft: `3px solid ${color}`, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color, fontWeight: 700 }}>{'✓'}</span>
                  <span style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500, color: ink }}>{nl[L].name}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: '0.06em', marginLeft: 'auto' }}>{nl[L].cadence}</span>
                </div>
              )
            })}
          </div>
          <Link
            href={locale === 'pt-BR' ? '/pt' : '/'}
            style={{ display: 'inline-block', padding: '12px 26px', background: 'transparent', color: ink, border: `1.5px solid ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' }}
          >
            {'←'} {strings.backHome}
          </Link>
        </section>
      </div>
    )
  }

  // ── Suggest screen (subscribed only main -> show others) ───────────────────
  if (phase === 'suggest') {
    const others = CATALOG.filter(n => !sentTo.includes(n.baseId))
    return (
      <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '72px 28px 48px' }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 48, color: accent, lineHeight: 1, marginBottom: 12, transform: 'rotate(-2deg)', display: 'inline-block' }}>
            {strings.subscribed}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 36, margin: '0 0 12px', fontWeight: 500, letterSpacing: '-0.02em', color: ink }}>
            {strings.suggestHeadline}
          </h1>
          <p style={{ fontSize: 15, color: muted, lineHeight: 1.6, marginBottom: 36 }}>
            {strings.suggestSubhead(email)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, rowGap: 48, marginBottom: 36 }}>
            {others.map((nl, i) => (
              <NewsletterCard
                key={nl.baseId}
                nl={nl}
                index={i + 2}
                L={L}
                isChecked={checked.has(nl.baseId)}
                onToggle={toggle}
                theme={theme}
                strings={strings}
                entranceDelay={i * 80}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(() => {
              const extra = Array.from(checked).filter(id => !sentTo.includes(id))
              const off = submitting || extra.length === 0
              return (
                <button
                  disabled={off}
                  onClick={() => { if (extra.length > 0) doSubscribe(extra) }}
                  style={{ padding: '12px 22px', background: off ? (dark ? '#3A2E1F' : '#D8C9A7') : accent, color: off ? faint : '#FFF', border: 'none', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, cursor: off ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? '…' : `✉ ${strings.subscribeSelected}`}
                </button>
              )
            })()}
            <button
              onClick={() => setPhase('sent')}
              style={{ padding: '12px 22px', background: 'transparent', color: muted, border: `1.5px solid ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
            >
              {strings.skipMainOnly}
            </button>
          </div>
          {serverError && (
            <p style={{ marginTop: 12, color: '#E53E3E', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
              {serverError}
            </p>
          )}
        </section>
      </div>
    )
  }

  // ── Pick phase (default) ──────────────────────────────────────────────────
  return (
    <div style={{ background: bg, color: ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>

      {/* aria-live region for announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {announcement}
      </div>

      {/* Hero */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '52px 28px 32px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: accent, marginBottom: 10 }}>
          {strings.breadcrumb} · {CATALOG.length} {strings.notebooks}
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", serif', fontSize: 'clamp(40px, 6vw, 68px)',
          margin: 0, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.0,
          position: 'relative', display: 'inline-block', color: ink,
        }}>
          {strings.headline}
          <span style={{ position: 'absolute', bottom: 4, left: -6, right: -6, height: 18, background: '#FFE37A', zIndex: -1, opacity: 0.7, transform: 'skew(-2deg)' }} />
        </h1>
        <p style={{ fontSize: 16, color: muted, marginTop: 18, maxWidth: 680, lineHeight: 1.65 }}>
          {strings.subhead}
        </p>

        {/* Quick controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          {allSelected ? (
            <span
              role="status"
              style={{
                padding: '7px 14px',
                background: 'rgba(255,130,64,0.08)',
                color: '#FF824080',
                border: '1px solid rgba(255,130,64,0.15)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {'✓'} {strings.allSelected}
            </span>
          ) : (
            <button
              onClick={selectAll}
              aria-label={strings.selectAll}
              style={{
                padding: '7px 14px',
                background: 'rgba(255,130,64,0.14)',
                color: '#FF8240',
                border: '1px solid rgba(255,130,64,0.28)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {'✓'} {strings.selectAll}
            </button>
          )}
          <button
            onClick={noneSelected ? undefined : clearAll}
            aria-label={strings.clear}
            aria-disabled={noneSelected}
            style={{
              padding: '7px 14px',
              background: noneSelected ? 'transparent' : 'rgba(255,255,255,0.04)',
              color: noneSelected ? `${faint}80` : '#958A75',
              border: `1px solid ${noneSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: noneSelected ? 'default' : 'pointer',
            }}
          >
            {'✕'} {strings.clear}
          </button>

          {/* Hero counter */}
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color: faint,
            letterSpacing: '0.06em',
            marginLeft: 8,
          }}>
            {allSelected
              ? strings.counterAll(CATALOG.length)
              : strings.counterOf(checked.size, CATALOG.length)}
          </span>

          <span style={{ fontFamily: '"Caveat", cursive', fontSize: 18, color: accent, transform: 'rotate(-1deg)', marginLeft: 'auto' }}>
            {'↓'} {strings.fourOptions}
          </span>
        </div>
      </section>

      {/* Newsletter grid -- 2x2 */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '24px 28px 24px' }}>
        <div className="nl-hub-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '28px',
          rowGap: '44px',
        }}>
          {CATALOG.map((nl, i) => (
            <NewsletterCard
              key={nl.baseId}
              nl={nl}
              index={i}
              L={L}
              isChecked={checked.has(nl.baseId)}
              onToggle={toggle}
              theme={theme}
              strings={strings}
              entranceDelay={i * 80}
            />
          ))}
        </div>
        {/* Responsive: @media query via style tag for 1-col below 720px */}
        <style>{`
          @media (max-width: 720px) {
            .nl-hub-grid {
              grid-template-columns: 1fr !important;
              gap: 20px !important;
              row-gap: 20px !important;
            }
          }
          .nl-card:focus-visible {
            outline: 2px solid #FF8240;
            outline-offset: 4px;
          }
          .nl-card:focus:not(:focus-visible) {
            outline: none;
          }
        `}</style>
      </section>

      {/* p.s. note */}
      <section style={{ maxWidth: 900, margin: '32px auto 0', padding: '0 28px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '20px 24px', background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderLeft: `3px solid ${muted}` }}>
          <div style={{ fontFamily: '"Caveat", cursive', fontSize: 28, color: muted, lineHeight: 1, transform: 'rotate(-2deg)' }}>p.s.</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 14, color: muted, lineHeight: 1.65, margin: 0 }}>
              {strings.ps}
            </p>
          </div>
        </div>
      </section>

      {/* Sticky subscribe bar */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: dark ? 'rgba(20,17,11,0.97)' : 'rgba(233,225,206,0.97)',
        borderTop: `2px solid ${accent}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '18px 28px',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: noneSelected ? '#C14513' : faint,
              marginBottom: 6,
              fontWeight: noneSelected ? 700 : 400,
            }}>
              {noneSelected
                ? strings.pickAtLeastOne
                : (() => {
                    const raw = allSelected ? strings.pickedAll(checked.size) : strings.pickedN(checked.size)
                    // Render markdown **bold** as a styled span
                    const parts = raw.split(/\*\*(.+?)\*\*/)
                    return parts.map((part, i) =>
                      i % 2 === 1
                        ? <span key={i} style={{ color: accent, fontWeight: 700 }}>{part}</span>
                        : part
                    )
                  })()
              }
            </div>
            {selectedList.length > 0 && (
              <div role="list" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedList.map(nl => {
                  const color = nlColor(nl, dark)
                  return (
                    <span
                      key={nl.baseId}
                      role="listitem"
                      aria-label={`Remove ${nl[L].name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        border: `1.5px solid ${color}`,
                        color,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        maxWidth: 180,
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nl[L].name}
                      </span>
                      <button
                        onClick={() => toggle(nl.baseId)}
                        aria-label={`Remove ${nl[L].name}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 13,
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        {'×'}
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flex: '1 1 360px', maxWidth: 540 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={strings.yourEmail}
              required
              autoComplete="email"
              style={{
                flex: 1, padding: '12px 14px',
                border: `1.5px solid ${serverError ? '#E53E3E' : isValidEmail ? '#5FA87D' : line}`,
                boxShadow: isValidEmail ? '0 0 8px rgba(95,168,125,0.2)' : 'none',
                background: dark ? 'rgba(0,0,0,0.3)' : '#FFF',
                color: ink, fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
                transition: 'background 0.15s, box-shadow 0.3s',
                boxShadow: canSubmit && !submitting ? `0 0 16px ${accent}44` : 'none',
                animation: canSubmit && !submitting ? 'glowPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {submitting ? '…' : `✉ ${strings.subscribe}`}
            </button>
          </form>

          {serverError && (
            <p style={{ width: '100%', margin: 0, color: '#E53E3E', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
              {serverError}
            </p>
          )}
        </div>
      </div>

      {/* Glow pulse animation */}
      <style>{`
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 16px ${accent}44; }
          50% { box-shadow: 0 0 28px ${accent}66; }
        }
      `}</style>

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: '28px', textAlign: 'center', color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em' }}>
        <Link href={locale === 'pt-BR' ? '/pt' : '/'} style={{ color: accent, textDecoration: 'none' }}>
          {'←'} {strings.backHome}
        </Link>
        <span style={{ margin: '0 14px', opacity: 0.5 }}>{'·'}</span>
        <Link href={locale === 'pt-BR' ? '/pt/blog' : '/blog'} style={{ color: muted, textDecoration: 'none' }}>
          {strings.blog}
        </Link>
      </footer>
    </div>
  )
}
