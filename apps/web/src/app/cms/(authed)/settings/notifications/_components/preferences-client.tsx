'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import {
  Rss,
  Gauge,
  SlidersHorizontal,
  Moon,
  Bell,
  Mail,
  Smartphone,
  Send,
  Info,
  ChevronDown,
  ChevronLeft,
  Save,
  Check,
  Clock,
} from 'lucide-react'
import { CmsSwitch } from '@/app/cms/(authed)/_shared/cms-switch'
import { DOMAIN_META, DOMAIN_ORDER } from '@/lib/notifications/domain-colors'
import type {
  NotificationDomain,
  ChannelKey,
  FrequencyPreset,
} from '@/lib/notifications/types'
import { savePreferences } from '@/lib/notifications/actions'
import { TelegramConnect } from './telegram-connect'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CHANNELS: Array<{
  key: ChannelKey
  label: string
  icon: typeof Bell
  lockedLabel?: string
}> = [
  {
    key: 'in_app',
    label: 'In-app',
    icon: Bell,
    lockedLabel: 'Obrigatorio',
  },
  {
    key: 'email',
    label: 'E-mail',
    icon: Mail,
  },
  {
    key: 'push',
    label: 'Push',
    icon: Smartphone,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: Send,
  },
]

const PRESETS: Record<
  FrequencyPreset,
  { label: string; subtitle: string; description: string }
> = {
  calm: {
    label: 'Calmo',
    subtitle: 'Essencial',
    description:
      'So alertas criticos: falhas de publicacao, tokens expirados. Resto num resumo diario.',
  },
  regular: {
    label: 'Regular',
    subtitle: 'Equilibrado',
    description:
      'A/B tests, metas atingidas, avisos de pipeline em tempo real. Metricas menores no resumo.',
  },
  power: {
    label: 'Power',
    subtitle: 'Tudo',
    description:
      'Tudo em tempo real, incluindo cada clique e digest completo.',
  },
}

const PRESET_ORDER: FrequencyPreset[] = ['calm', 'regular', 'power']

type CategoryChannels = Record<ChannelKey, boolean>
type CategoryState = Record<NotificationDomain, CategoryChannels>

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PreferencesClientProps {
  userId: string
  isConnected: boolean
  chatId: string | null
  userEmail: string | null
  savedChannels: Record<ChannelKey, boolean> | null
  savedPreset: FrequencyPreset | null
  savedCategories: Record<NotificationDomain, Record<ChannelKey, boolean>> | null
  savedQuiet: { enabled: boolean; start: string; end: string } | null
}

/* ------------------------------------------------------------------ */
/*  Helper: channel description                                        */
/* ------------------------------------------------------------------ */

function getChannelDescription(
  key: ChannelKey,
  userEmail: string | null,
  isConnected: boolean
): string {
  switch (key) {
    case 'in_app':
      return 'Centro de notificacoes'
    case 'email':
      return userEmail ?? 'Sem e-mail configurado'
    case 'push':
      return 'Pedir permissao'
    case 'telegram':
      return isConnected ? 'Conectado' : 'Nao conectado'
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PreferencesClient({
  userId,
  isConnected,
  chatId,
  userEmail,
  savedChannels,
  savedPreset,
  savedCategories,
  savedQuiet,
}: PreferencesClientProps) {
  // -- Global channel state
  const [channels, setChannels] = useState<Record<ChannelKey, boolean>>(
    savedChannels ?? {
      in_app: true,
      email: true,
      push: false,
      telegram: isConnected,
    }
  )

  // -- Frequency preset
  const [preset, setPreset] = useState<FrequencyPreset>(
    savedPreset ?? 'regular'
  )

  // -- Per-category channels
  const defaultCats = (): CategoryState => {
    const o: Partial<CategoryState> = {}
    for (const d of DOMAIN_ORDER) {
      o[d] = savedCategories?.[d] ?? {
        in_app: true,
        email: d === 'system' || d === 'pipeline',
        push: false,
        telegram: d === 'social',
      }
    }
    return o as CategoryState
  }
  const [cats, setCats] = useState<CategoryState>(defaultCats)

  // -- Accordion state
  const [openDomain, setOpenDomain] = useState<NotificationDomain | null>(
    'pipeline'
  )

  // -- Quiet hours
  const [quietEnabled, setQuietEnabled] = useState(
    savedQuiet?.enabled ?? true
  )
  const [quietStart, setQuietStart] = useState(savedQuiet?.start ?? '22:00')
  const [quietEnd, setQuietEnd] = useState(savedQuiet?.end ?? '08:00')

  // -- Save state
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  // -- Frequency radio group keyboard nav
  const presetGroupRef = useRef<HTMLDivElement>(null)

  const toggleChannel = useCallback((key: ChannelKey) => {
    if (key === 'in_app') return // In-app always on (LGPD contract)
    setChannels((c) => ({ ...c, [key]: !c[key] }))
    setSaveStatus('idle')
  }, [])

  const toggleCat = useCallback(
    (dom: NotificationDomain, ch: ChannelKey) => {
      if (dom === 'system' && ch === 'in_app') return
      if (!channels[ch]) return
      setCats((c) => ({
        ...c,
        [dom]: { ...c[dom], [ch]: !c[dom][ch] },
      }))
      setSaveStatus('idle')
    },
    [channels]
  )

  const handlePresetKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      let next = -1
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        next = (idx + 1) % PRESET_ORDER.length
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        next = (idx - 1 + PRESET_ORDER.length) % PRESET_ORDER.length
      }
      if (next >= 0) {
        const nextPreset = PRESET_ORDER[next]
        if (nextPreset) {
          setPreset(nextPreset)
          setSaveStatus('idle')
          const radios =
            presetGroupRef.current?.querySelectorAll<HTMLButtonElement>(
              '[role="radio"]'
            )
          radios?.[next]?.focus()
        }
      }
    },
    []
  )

  const handleSave = useCallback(() => {
    startTransition(async () => {
      await savePreferences({
        channels,
        preset,
        categories: cats,
        quietEnabled,
        quietStart,
        quietEnd,
        timezone,
      })
      setSaveStatus('saved')
    })
  }, [channels, preset, cats, quietEnabled, quietStart, quietEnd, timezone])

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="mx-auto w-full max-w-[860px] animate-fade-in">
      {/* ---- Header ---- */}
      <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-cms-text">
            Preferencias de notificacao
          </h1>
          <p className="mt-1 text-sm text-cms-text-muted">
            Controle o que chega ate voce e por onde.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent',
              saveStatus === 'saved'
                ? 'border-green-700/40 bg-green-950/30 text-green-400'
                : 'border-cms-accent/50 bg-cms-accent/10 text-cms-accent hover:bg-cms-accent/20',
              isPending ? 'cursor-wait opacity-70' : '',
            ].join(' ')}
          >
            {saveStatus === 'saved' ? (
              <>
                <Check size={15} />
                Salvo
              </>
            ) : (
              <>
                <Save size={15} />
                {isPending ? 'Salvando...' : 'Salvar'}
              </>
            )}
          </button>
          <a
            href="/cms/notifications"
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text-muted transition-colors hover:border-cms-accent hover:text-cms-text focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
          >
            <ChevronLeft size={15} />
            Voltar a caixa
          </a>
        </div>
      </div>

      {/* ================================================================
          SECTION 1: DELIVERY CHANNELS
          ================================================================ */}
      <section
        className="rounded-xl border border-cms-border bg-cms-surface shadow-card"
        aria-labelledby="channels-heading"
      >
        <div className="flex items-center gap-2.5 border-b border-cms-border px-5 py-3.5">
          <Rss size={16} className="text-cms-text-muted" />
          <h2
            id="channels-heading"
            className="text-sm font-semibold text-cms-text"
          >
            Canais de entrega
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {CHANNELS.map((ch) => {
            const isOn = channels[ch.key]
            const isLocked = ch.key === 'in_app'
            const isTelegram = ch.key === 'telegram'
            const IconComp = ch.icon
            const description = getChannelDescription(
              ch.key,
              userEmail,
              isConnected
            )
            return (
              <div key={ch.key} className="flex flex-col gap-0">
                <button
                  type="button"
                  onClick={() => toggleChannel(ch.key)}
                  aria-pressed={isOn}
                  aria-disabled={isLocked || undefined}
                  className={[
                    'flex items-center gap-3 rounded-xl border p-[13px_14px] transition-all duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent',
                    isOn
                      ? 'border-[color-mix(in_srgb,var(--color-cms-accent)_45%,transparent)] bg-cms-accent-subtle shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                      : 'border-cms-border bg-cms-surface-hover hover:border-cms-text-dim',
                    isLocked ? 'cursor-default' : 'cursor-pointer',
                    isTelegram && isOn ? 'rounded-b-none border-b-0' : '',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border',
                      isOn
                        ? 'border-transparent text-cms-accent'
                        : 'border-cms-border bg-cms-surface text-cms-text-muted',
                    ].join(' ')}
                    style={
                      isOn
                        ? {
                            backgroundColor:
                              'color-mix(in srgb, var(--color-cms-accent) 22%, transparent)',
                          }
                        : undefined
                    }
                  >
                    <IconComp size={17} />
                  </div>
                  <div className="min-w-0 grow text-left">
                    <div className="flex items-center gap-2 text-sm font-medium text-cms-text">
                      {ch.label}
                      {isLocked && ch.lockedLabel && (
                        <span className="rounded-md bg-cms-surface-hover px-1.5 py-0.5 text-3xs font-semibold text-cms-text-muted">
                          {ch.lockedLabel}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-2xs text-cms-text-dim">
                      {description}
                    </div>
                  </div>
                  <CmsSwitch
                    checked={isOn}
                    onChange={() => toggleChannel(ch.key)}
                    label={`${ch.label} ativo`}
                    locked={isLocked}
                  />
                </button>
                {/* Telegram inline connection */}
                {isTelegram && isOn && (
                  <div className="rounded-b-xl border border-t-0 border-[color-mix(in_srgb,var(--color-cms-accent)_45%,transparent)] bg-cms-accent-subtle px-4 pb-3 pt-2">
                    <TelegramConnect
                      userId={userId}
                      isConnected={isConnected}
                      chatId={chatId}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ================================================================
          SECTION 2: FREQUENCY
          ================================================================ */}
      <section
        className="mt-4 rounded-xl border border-cms-border bg-cms-surface shadow-card"
        aria-labelledby="frequency-heading"
      >
        <div className="flex items-center gap-2.5 border-b border-cms-border px-5 py-3.5">
          <Gauge size={16} className="text-cms-text-muted" />
          <h2
            id="frequency-heading"
            className="text-sm font-semibold text-cms-text"
          >
            Frequencia
          </h2>
        </div>
        <div
          ref={presetGroupRef}
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Frequencia de notificacoes"
        >
          {PRESET_ORDER.map((k, idx) => {
            const p = PRESETS[k]
            const isOn = preset === k
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={isOn}
                tabIndex={isOn ? 0 : -1}
                onClick={() => {
                  setPreset(k)
                  setSaveStatus('idle')
                }}
                onKeyDown={(e) => handlePresetKeyDown(e, idx)}
                className={[
                  'rounded-xl border p-[15px] text-left transition-all duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent',
                  isOn
                    ? 'border-[color-mix(in_srgb,var(--color-cms-accent)_50%,transparent)] bg-cms-accent-subtle'
                    : 'border-cms-border bg-cms-surface-hover hover:border-cms-text-dim',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-cms-text">
                    {p.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={[
                      'h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-all duration-150',
                      isOn
                        ? 'border-cms-accent'
                        : 'border-cms-border',
                    ].join(' ')}
                    style={
                      isOn
                        ? {
                            background:
                              'radial-gradient(circle, var(--color-cms-accent) 0 5px, transparent 6px)',
                          }
                        : undefined
                    }
                  />
                </div>
                <div
                  className="mt-0.5 text-xs font-medium"
                  style={{ color: 'var(--color-cms-accent)' }}
                >
                  {p.subtitle}
                </div>
                <div className="mt-2 text-xs leading-[1.4] text-cms-text-dim">
                  {p.description}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ================================================================
          SECTION 3: PER CATEGORY
          ================================================================ */}
      <section
        className="mt-4 rounded-xl border border-cms-border bg-cms-surface shadow-card"
        aria-labelledby="category-heading"
      >
        <div className="flex items-center gap-2.5 border-b border-cms-border px-5 py-3.5">
          <SlidersHorizontal size={16} className="text-cms-text-muted" />
          <h2
            id="category-heading"
            className="text-sm font-semibold text-cms-text"
          >
            Por categoria
          </h2>
          <span className="ml-auto hidden text-xs text-cms-text-dim sm:inline">
            in-app &middot; e-mail &middot; push &middot; telegram
          </span>
        </div>
        <div>
          {DOMAIN_ORDER.map((dom) => {
            const dm = DOMAIN_META[dom]
            const isOpen = openDomain === dom
            const DomainIcon = dm.icon
            const activeCount = CHANNELS.filter(
              (c) =>
                cats[dom][c.key] || (dom === 'system' && c.key === 'in_app')
            ).length
            return (
              <div
                key={dom}
                className="border-b border-cms-border/60 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-[11px] px-5 py-[14px] text-left transition-colors hover:bg-cms-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
                  onClick={() => setOpenDomain(isOpen ? null : dom)}
                  aria-expanded={isOpen}
                  aria-controls={`cat-body-${dom}`}
                >
                  <span
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: dm.subtle,
                      color: dm.color,
                    }}
                  >
                    <DomainIcon size={15} />
                  </span>
                  <span className="text-sm font-medium text-cms-text">
                    {dm.label}
                  </span>
                  {dom === 'system' && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-cms-surface-hover px-2 py-0.5 text-3xs font-semibold text-cms-text-muted">
                      <Info size={11} />
                      Obrigatorio
                    </span>
                  )}
                  <div className="grow" />
                  <span className="text-xs text-cms-text-dim">
                    {activeCount} canais
                  </span>
                  <ChevronDown
                    size={16}
                    className={[
                      'shrink-0 text-cms-text-dim transition-transform duration-200',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>
                {isOpen && (
                  <div
                    id={`cat-body-${dom}`}
                    className="animate-fade-in pb-[14px] pl-[61px] pr-5 pt-1"
                  >
                    {CHANNELS.map((ch) => {
                      const ChIcon = ch.icon
                      const isSystem = dom === 'system' && ch.key === 'in_app'
                      const globalOff = !channels[ch.key]
                      const isOn = cats[dom][ch.key] || isSystem
                      const isDisabled = isSystem || globalOff
                      return (
                        <div
                          key={ch.key}
                          className="flex items-center gap-2.5 py-[7px]"
                          style={globalOff ? { opacity: 0.4 } : undefined}
                          title={
                            globalOff
                              ? `Canal ${ch.label} desativado globalmente`
                              : undefined
                          }
                        >
                          <ChIcon
                            size={14}
                            className="text-cms-text-dim"
                          />
                          <span className="text-sm text-cms-text">
                            {ch.label}
                          </span>
                          <div className="grow" />
                          <CmsSwitch
                            checked={isOn}
                            onChange={() => toggleCat(dom, ch.key)}
                            label={`${ch.label} para ${dm.label}`}
                            disabled={isDisabled}
                            locked={isSystem}
                            size="compact"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ================================================================
          SECTION 4: QUIET HOURS
          ================================================================ */}
      <section
        className="mt-4 rounded-xl border border-cms-border bg-cms-surface shadow-card"
        aria-labelledby="quiet-heading"
      >
        <div className="flex items-center gap-2.5 border-b border-cms-border px-5 py-3.5">
          <Moon size={16} className="text-cms-text-muted" />
          <h2
            id="quiet-heading"
            className="text-sm font-semibold text-cms-text"
          >
            Horario de silencio
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-cms-text">
                Pausar nao-criticas
              </p>
              <p className="mt-1 text-xs text-cms-text-dim">
                So alertas criticos (falhas, tokens) passam nesse periodo.
              </p>
            </div>
            <CmsSwitch
              checked={quietEnabled}
              onChange={(v) => {
                setQuietEnabled(v)
                setSaveStatus('idle')
              }}
              label="Horario de silencio ativo"
            />
          </div>

          {quietEnabled && (
            <div className="mt-4 animate-fade-in">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-cms-text-dim" />
                  <label
                    htmlFor="quiet-start"
                    className="text-sm text-cms-text-muted"
                  >
                    Das
                  </label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={quietStart}
                    onChange={(e) => {
                      setQuietStart(e.target.value)
                      setSaveStatus('idle')
                    }}
                    className="rounded-lg border border-cms-border bg-cms-surface-hover px-2.5 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="quiet-end"
                    className="text-sm text-cms-text-muted"
                  >
                    as
                  </label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={quietEnd}
                    onChange={(e) => {
                      setQuietEnd(e.target.value)
                      setSaveStatus('idle')
                    }}
                    className="rounded-lg border border-cms-border bg-cms-surface-hover px-2.5 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
                  />
                </div>
              </div>
              <p className="mt-2.5 text-2xs text-cms-text-dim">
                Fuso: {timezone}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---- LGPD Footer ---- */}
      <p className="mt-4 flex items-center justify-center gap-[7px] text-center text-2xs text-cms-text-dim">
        <Info size={13} className="shrink-0" />
        Conforme a LGPD: alertas de seguranca nao podem ser desativados;
        e-mail/push exigem opt-in explicito.
      </p>
    </div>
  )
}
