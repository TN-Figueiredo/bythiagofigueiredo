'use client'

import { useState } from 'react'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

interface DestCompositorProps {
  focusedDest: DestId
  destsOn: Record<DestId, boolean>
}

function PlatformIconSmall({ provider }: { provider: string }) {
  if (provider === 'instagram') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
    </svg>
  )
  if (provider === 'youtube') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill="#fff" stroke="none" />
    </svg>
  )
  if (provider === 'facebook') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
    </svg>
  )
  return null
}

export function DestCompositor({ focusedDest, destsOn }: DestCompositorProps) {
  const dest = DESTINATIONS[focusedDest]
  const isActive = destsOn[focusedDest]
  const [caption, setCaption] = useState('')
  const [lang, setLang] = useState<'PT' | 'EN'>('PT')

  if (!isActive) return null

  const isStory = focusedDest === 'ig_story'
  const isYtCommunity = focusedDest === 'yt_community'

  return (
    <div className="mt-[10px] grid grid-cols-1 gap-[30px] lg:grid-cols-[1fr_380px]">
      {/* Left column */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        {/* Destination header */}
        <div className="flex items-center gap-[11px] pb-1">
          <div
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: dest.tint }}
          >
            <PlatformIconSmall provider={dest.provider} />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-cms-text">
              {dest.label} &middot; {dest.sublabel}
            </div>
            <div className="text-[11.5px] text-cms-text-dim">
              {dest.ratio} &middot; {dest.width}&times;{dest.height}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[9px] border border-transparent bg-transparent px-[11px] py-1.5 text-[12.5px] font-semibold text-cms-text-dim transition-colors hover:text-cms-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3c3 3 3 15 0 18" />
                <path d="M12 3c-3 3-3 15 0 18" />
              </svg>
              Traduzir
            </button>
            <div
              className="inline-flex gap-[1px] rounded-[8px] p-[2px]"
              style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}
            >
              <button
                type="button"
                onClick={() => setLang('PT')}
                className={`rounded-[6px] border-none px-[10px] py-1 font-mono text-[11px] font-bold tracking-[0.05em] transition-colors ${
                  lang === 'PT'
                    ? 'bg-cms-accent text-[#1a120c]'
                    : 'bg-transparent text-cms-text-dim'
                }`}
              >
                PT
              </button>
              <button
                type="button"
                onClick={() => setLang('EN')}
                className={`rounded-[6px] border-none px-[10px] py-1 font-mono text-[11px] font-bold tracking-[0.05em] transition-colors ${
                  lang === 'EN'
                    ? 'bg-cms-accent text-[#1a120c]'
                    : 'bg-transparent text-cms-text-dim'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Canvas card (visual destinations) */}
        {(isStory || focusedDest === 'ig_feed' || focusedDest === 'fb_page') && (
          <div
            className="rounded-[var(--radius,12px)] border border-cms-border p-4"
            style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cms-text-dim">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-cms-accent"
                >
                  <path d="M3 5h18v14H3z" />
                  <path d="M3 16l5-5 4 4 4-4 5 5" />
                  <path d="M9 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0" />
                </svg>
                Arte &middot; canvas
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-[7px] rounded-[9px] border border-cms-border px-[11px] py-1.5 text-[12.5px] font-semibold text-cms-text-dim transition-colors hover:text-cms-text"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 4h6v6" />
                  <path d="M20 4l-9 9" />
                  <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
                </svg>
                Abrir editor
              </button>
            </div>
            <div
              className="flex cursor-pointer justify-center rounded-[10px] py-2"
              style={{
                background:
                  'repeating-conic-gradient(rgb(18,16,9) 0%, rgb(18,16,9) 25%, rgb(14,12,8) 0%, rgb(14,12,8) 50%) 50% center / 16px 16px',
              }}
            >
              <div
                className="overflow-hidden rounded-[6px]"
                style={{
                  width: isStory ? 129 : 200,
                  height: isStory ? 230 : 160,
                  background:
                    'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))',
                  boxShadow: 'rgba(0,0,0,0.7) 0 30px 70px -24px',
                }}
              >
                {/* Mini canvas with placeholder elements */}
                <div className="relative h-full w-full" style={{ background: 'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))' }}>
                  <div className="absolute" style={{ inset: '5%', border: '1px solid rgba(31,27,23,0.25)', borderRadius: 4, pointerEvents: 'none' }} />
                  <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '13%', width: '84%', textAlign: 'center' }}>
                    <span className="font-mono" style={{ fontSize: isStory ? 3.1 : 5, letterSpacing: '0.22em', color: 'rgb(154,107,63)', border: '1px solid rgba(154,107,63,0.5)', padding: '3px 6px', borderRadius: 3, display: 'inline-block' }}>NO BLOG</span>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '28%', width: '84%', textAlign: 'center' }}>
                    <div className="font-fraunces" style={{ fontSize: isStory ? 9.3 : 14, fontWeight: 700, color: 'rgb(31,27,23)', lineHeight: 1.02, letterSpacing: '-0.01em', whiteSpace: 'pre-line' }}>{'Aprendi inglês\nbrigando online'}</div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center overflow-hidden" style={{ top: '56%', transform: 'translate(-50%,-50%)', width: '70%', height: '26%', background: 'linear-gradient(135deg, rgb(58,36,86), rgb(22,12,36))', borderRadius: 8 }}>
                    <svg width={isStory ? 9 : 14} height={isStory ? 9 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <path d="M3 5h18v14H3z" /><path d="M3 16l5-5 4 4 4-4 5 5" /><path d="M9 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0" />
                    </svg>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '80%', transform: 'translate(-50%,-50%)' }}>
                    <span className="inline-flex items-center gap-1" style={{ background: '#fff', color: '#111', fontSize: isStory ? 4.1 : 6, fontWeight: 700, padding: '4px 8px', borderRadius: 6, boxShadow: 'rgba(0,0,0,0.25) 0 4px 14px' }}>
                      <svg width={isStory ? 3.8 : 6} height={isStory ? 3.8 : 6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 15l6-6" /><path d="M10 6l1-1a4 4 0 016 6l-1 1" /><path d="M14 18l-1 1a4 4 0 01-6-6l1-1" /></svg>
                      LER O POST
                    </span>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '92%', transform: 'translate(-50%,-50%)' }}>
                    <div className="flex items-center justify-center font-fraunces" style={{ width: isStory ? 12.9 : 20, height: isStory ? 12.9 : 20, borderRadius: '50%', border: '1.5px solid rgb(224,101,30)', color: 'rgb(31,27,23)', fontWeight: 700, fontSize: isStory ? 5.2 : 8 }}>TF</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Template footer */}
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-cms-text-dim/60">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
              </svg>
              Template <b className="text-cms-text-dim">Blog → Story</b> aplicado · clique pra editar
            </div>
          </div>
        )}

        {/* Info banner (Story-specific) */}
        {isStory && (
          <div
            className="flex gap-[9px] rounded-[10px] border border-cms-border p-[12px_14px]"
            style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-px shrink-0 text-cms-accent"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>
            <p className="text-[12.5px] leading-[1.5] text-cms-text-dim">
              No Story o texto e o link moram{' '}
              <b className="text-cms-text">dentro da arte</b> (canvas) + sticker
              de link. Aqui você só dá um toque opcional.
            </p>
          </div>
        )}

        {/* Caption input */}
        <div>
          <div className="mb-[7px] flex items-center justify-between">
            <span className="text-xs text-cms-text-dim">
              {isStory ? (
                <>
                  Texto curto sobre a arte{' '}
                  <span className="text-cms-text-dim/60">&middot; opcional</span>
                </>
              ) : isYtCommunity ? (
                'Texto do post'
              ) : (
                'Legenda'
              )}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[9px] border border-cms-border px-[11px] py-1.5 text-[12.5px] font-semibold text-cms-text transition-colors"
              style={{
                background: 'var(--surface-2, var(--color-cms-surface))',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
                <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
              </svg>
              Gerar com IA
            </button>
          </div>
          {isStory ? (
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="ex: Saiu no blog 📬"
              className="w-full rounded-[10px] border border-cms-border bg-cms-surface px-[13px] py-[11px] text-[13.5px] text-cms-text placeholder:text-cms-text-dim/40 focus:border-cms-accent focus:outline-none"
              style={{
                borderColor: 'var(--line-strong, var(--color-cms-border))',
              }}
            />
          ) : (
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                isYtCommunity
                  ? 'Escreva o texto do post...'
                  : 'O que você quer compartilhar?'
              }
              rows={5}
              className="w-full resize-none rounded-[10px] border border-cms-border bg-cms-surface px-[13px] py-[11px] text-[13.5px] text-cms-text placeholder:text-cms-text-dim/40 focus:border-cms-accent focus:outline-none"
              style={{
                borderColor: 'var(--line-strong, var(--color-cms-border))',
              }}
            />
          )}
          {dest.captionLimit > 0 && (
            <div className="mt-1 text-right">
              <span
                className={`text-xs ${
                  caption.length >= dest.captionLimit * 0.9
                    ? caption.length > dest.captionLimit
                      ? 'text-red-400'
                      : 'text-amber-400'
                    : 'text-cms-text-dim/40'
                }`}
              >
                {caption.length}/{dest.captionLimit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right column - preview */}
      <div className="hidden lg:block">
        <div className="sticky top-4">
          <div className="mb-3 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cms-text-dim">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-cms-accent"
            >
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
            </svg>
            Como vai aparecer
          </div>

          {/* Phone mockup */}
          {isStory ? (
            <div
              className="mx-auto"
              style={{
                width: 309,
                border: '8px solid rgb(5,5,5)',
                borderRadius: 30,
                background: '#000',
                overflow: 'hidden',
                boxShadow: 'rgba(0,0,0,0.8) 0 24px 60px -20px',
              }}
            >
              <div
                className="relative"
                style={{
                  width: 293,
                  height: 520,
                  background: '#000',
                  overflow: 'hidden',
                }}
              >
                {/* Story content placeholder */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))',
                  }}
                >
                  <div className="flex h-full items-center justify-center text-sm text-[#1f1b17]/30">
                    Canvas preview
                  </div>
                </div>
                {/* Progress bars */}
                <div className="absolute left-0 right-0 top-0 p-[10px_12px_0]">
                  <div className="mb-2.5 flex gap-1">
                    <div className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/40">
                      <div className="h-full w-[60%] bg-white" />
                    </div>
                    <div className="h-[2.5px] flex-1 rounded-full bg-white/40" />
                    <div className="h-[2.5px] flex-1 rounded-full bg-white/40" />
                  </div>
                  <div className="flex items-center gap-[9px]">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full font-fraunces text-[11px] font-bold"
                      style={{
                        background:
                          'var(--color-cms-accent, #E8823C)',
                        color: '#1a120c',
                      }}
                    >
                      TF
                    </div>
                    <span
                      className="text-[13px] font-semibold text-white"
                      style={{
                        textShadow: 'rgba(0,0,0,0.5) 0 1px 3px',
                      }}
                    >
                      thiago.figueiredo
                    </span>
                    <span
                      className="text-xs text-white/80"
                      style={{
                        textShadow: 'rgba(0,0,0,0.5) 0 1px 3px',
                      }}
                    >
                      agora
                    </span>
                  </div>
                </div>
                {/* Reply bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2.5 p-[0_12px_12px]">
                  <div className="flex-1 rounded-full border border-white/60 px-[14px] py-2 text-[12.5px] text-white/85">
                    Enviar mensagem
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20s-7-4.6-9.5-9C1 8 2.8 4.5 6 4.5c2 0 3.2 1.3 4 2.4.8-1.1 2-2.4 4-2.4 3.2 0 5 3.5 3.5 6.5C19 15.4 12 20 12 20z" />
                  </svg>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 3L3 10l7 3 3 7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-cms-border bg-cms-surface p-4">
              <p className="text-sm text-cms-text-dim/40">
                Preview {dest.label} {dest.sublabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
