'use client'

import { useState } from 'react'
import { PlatformIcon } from '../../_components/shared/platform-icon'

interface ContentItem {
  id: string
  type: 'blog' | 'newsletter' | 'video'
  lang: string
  title: string
  description: string
  thumbnail: string
  age: string
  platforms: string[]
}

const MOCK_CONTENT: ContentItem[] = [
  {
    id: '1', type: 'blog', lang: 'EN', age: 'há 2 dias',
    title: 'I Learned a Language by Arguing with Strangers Online',
    description: "In 2009 I was screaming at teammates in broken English. By 2017 I scored 91 on the TOEFL without a single class. Here's how competitive gaming taught me fluency.",
    thumbnail: 'linear-gradient(135deg, rgb(58,36,86), rgb(22,12,36))',
    platforms: ['instagram', 'youtube', 'facebook'],
  },
  {
    id: '2', type: 'blog', lang: 'PT', age: 'há 4 dias',
    title: 'Aprendi Inglês Porque Não Conseguia Passar de Fase',
    description: 'Em 2009 eu xingava em inglês quebrado no meio de uma partida. Em 2017 tirei 91 no TOEFL sem nenhuma aula formal. A história de como o competitivo virou método.',
    thumbnail: 'linear-gradient(135deg, rgb(42,51,64), rgb(15,24,32))',
    platforms: ['instagram', 'youtube', 'facebook'],
  },
  {
    id: '3', type: 'newsletter', lang: 'PT', age: 'há 6 dias',
    title: "Thiago's Journal · Edição #042",
    description: 'Uma carta por semana sobre construir, escrever e pensar em voz alta. Bastidores do que eu tô lançando, notas de leitura e o que acertei (e errei) essa semana.',
    thumbnail: 'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))',
    platforms: ['instagram', 'facebook'],
  },
  {
    id: '4', type: 'video', lang: 'PT', age: 'há 1 dia',
    title: 'Comprei Ouro por R$47 no MBK Center Bangkok',
    description: 'Fui até o maior mercado de Bangkok comparar o preço do ouro com o Brasil. R$800 aqui, R$47 lá. Será que vale? Vem comigo.',
    thumbnail: 'linear-gradient(135deg, rgb(58,36,86), rgb(22,12,36))',
    platforms: ['instagram', 'youtube', 'facebook'],
  },
]

const TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'blog', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'video', label: 'Vídeo' },
] as const

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  blog: { label: 'BLOG', bg: 'var(--green-soft, rgba(34,197,94,0.15))', color: 'var(--green, #22c55e)' },
  newsletter: { label: 'NEWSLETTER', bg: 'var(--amber-soft, rgba(245,158,11,0.15))', color: 'var(--amber, #f59e0b)' },
  video: { label: 'VÍDEO', bg: 'rgba(217,97,74,0.15)', color: 'var(--red, #ef4444)' },
}

function PlatformDot({ provider }: { provider: string }) {
  const colors: Record<string, string> = { instagram: '#E8823C', youtube: '#E0574E', facebook: '#5B7FD6' }
  const bg = colors[provider] ?? '#888'
  return (
    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px]" style={{ background: bg }}>
      <PlatformIcon provider={provider} size={12} variant="solid" />
    </div>
  )
}

export function CMSContentPicker() {
  const [tab, setTab] = useState<string>('all')

  const filtered = tab === 'all' ? MOCK_CONTENT : MOCK_CONTENT.filter(c => c.type === tab)
  const counts = {
    all: MOCK_CONTENT.length,
    blog: MOCK_CONTENT.filter(c => c.type === 'blog').length,
    newsletter: MOCK_CONTENT.filter(c => c.type === 'newsletter').length,
    video: MOCK_CONTENT.filter(c => c.type === 'video').length,
  }

  return (
    <div>
      {/* Cowork banner */}
      <div className="mb-[18px] flex gap-[9px] rounded-xl p-[12px_15px] opacity-95" style={{ background: 'var(--cowork, #6e63f2)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-white">
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
          <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
        <div className="text-white">
          <div className="text-[13.5px] font-semibold">Compartilhar do CMS · automático</div>
          <div className="mt-0.5 text-xs leading-[1.5] opacity-85">
            Escolha um conteúdo — eu detecto o idioma, monto a arte no template e escrevo as legendas por destino. Você só revisa.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-5 border-b border-cms-border">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative cursor-pointer border-none bg-transparent pb-[11px] px-px text-[13.5px] transition-colors ${
              tab === t.key ? 'font-semibold text-cms-text' : 'font-medium text-cms-text-dim'
            }`}
          >
            {t.label} <span className="font-mono text-[11px] text-cms-text-dim/60">{counts[t.key as keyof typeof counts]}</span>
            {tab === t.key && <div className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-cms-accent" />}
          </button>
        ))}
      </div>

      {/* Content items */}
      <div className="flex flex-col gap-[10px]">
        {filtered.map(item => {
          const badge = TYPE_BADGE[item.type]
          return (
            <div key={item.id} className="cursor-pointer rounded-[var(--radius,12px)] bg-cms-surface p-[14px] transition-[border-color,transform] duration-150 hover:-translate-y-px">
              <div className="flex items-center gap-[14px]">
                {/* Thumbnail */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[9px]" style={{ background: item.thumbnail }}>
                  {item.type === 'newsletter' && (
                    <div className="absolute inset-[18%] flex items-center justify-center rounded-sm border border-[rgba(31,27,23,0.3)]">
                      <span className="font-fraunces text-xs font-bold" style={{ color: 'rgb(31,27,23)' }}>TF</span>
                    </div>
                  )}
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ background: 'var(--surface-3, rgba(255,255,255,0.06))', color: 'var(--ink-dim)' }}>{item.lang}</span>
                    <span className="text-[11px] text-cms-text-dim/60">{item.age}</span>
                  </div>
                  <div className="truncate text-sm font-semibold leading-[1.3] text-cms-text">{item.title}</div>
                  <div className="mt-[3px] truncate text-xs text-cms-text-dim">{item.description}</div>
                </div>
                {/* Platform dots + chevron */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex gap-1">
                    {item.platforms.map(p => <PlatformDot key={p} provider={p} />)}
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/40">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
