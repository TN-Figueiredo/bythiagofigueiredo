'use client'

import { useState } from 'react'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { VChip } from './ab-primitives'
import { Eye } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClickMomentUnifiedProps {
  videoTitle: string
  variants: Array<{ label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }>
  leaderLabel: DisplayLabel
}

type FeedContext = 'home' | 'search' | 'suggested' | 'mobile'

/* ------------------------------------------------------------------ */
/*  Decoy competitor data                                              */
/* ------------------------------------------------------------------ */

const COMPETITORS = [
  { title: 'How I Built a $1M Business in 90 Days', channel: 'Growth Lab', views: '1.2M views', age: '2 weeks ago', duration: '18:42' },
  { title: '10 Mistakes Every Creator Makes', channel: 'Creator Academy', views: '845K views', age: '5 days ago', duration: '12:15' },
  { title: 'The Science of Going Viral', channel: 'Algorithm Insider', views: '2.1M views', age: '1 month ago', duration: '24:08' },
  { title: 'Morning Routine for Productivity', channel: 'Daily Habits', views: '520K views', age: '3 days ago', duration: '8:33' },
  { title: 'Best Camera Settings for YouTube', channel: 'Tech Review Pro', views: '390K views', age: '1 week ago', duration: '15:47' },
] as const

const DECOY_GRADIENTS = [
  'linear-gradient(135deg, #2a2a3e, #1a1a2e)',
  'linear-gradient(135deg, #3e2a2a, #2e1a1a)',
  'linear-gradient(135deg, #2a3e2a, #1a2e1a)',
  'linear-gradient(135deg, #3e3a2a, #2e2a1a)',
  'linear-gradient(135deg, #2a3e3e, #1a2e2e)',
]

const CTX_LABELS: Record<FeedContext, string> = {
  home: 'Home',
  search: 'Busca',
  suggested: 'Sugeridos',
  mobile: 'Mobile',
}

/* ------------------------------------------------------------------ */
/*  Placeholder thumbnail                                              */
/* ------------------------------------------------------------------ */

function PlaceholderThumb({
  title,
  duration,
  gradient,
  radius = 8,
}: {
  title: string
  duration: string
  gradient: string
  radius?: number
}) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: '16/9',
        borderRadius: radius,
        background: gradient,
        boxShadow: 'rgba(0,0,0,0.4) 0 0 60px inset',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-[8px]">
        <span
          className="text-white/60 text-center leading-tight line-clamp-2"
          style={{ fontSize: 'clamp(9px, 2vw, 12px)', fontWeight: 600 }}
        >
          {title}
        </span>
      </div>
      <span className="absolute right-[4px] bottom-[4px] bg-black/80 text-white font-mono text-[10px] font-semibold px-[4px] py-px rounded">
        {duration}
      </span>
    </div>
  )
}

function UserThumb({
  thumbUrl,
  variantLabel,
  variantColor,
  radius = 8,
}: {
  thumbUrl?: string | null
  variantLabel: DisplayLabel
  variantColor: string
  radius?: number
}) {
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', borderRadius: radius }}>
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={`Thumbnail variante ${variantLabel}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(135deg, ${variantColor}33, ${variantColor}11)`,
          }}
        />
      )}
      <div className="absolute top-[4px] left-[4px]">
        <VChip label={variantLabel} size={18} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Channel avatar                                                     */
/* ------------------------------------------------------------------ */

function ChannelAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className="rounded-full bg-[#333] flex items-center justify-center text-white/70 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 700 }}
    >
      {initials}
    </div>
  )
}

function UserAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-cms-accent flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        fontWeight: 700,
        color: 'rgb(20, 15, 8)',
        fontFamily: 'Fraunces, serif',
      }}
    >
      TF
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Home feed cards                                                    */
/* ------------------------------------------------------------------ */

function HomeDecoyCard({ idx }: { idx: number }) {
  const c = COMPETITORS[idx]!
  return (
    <div className="space-y-[8px]" style={{ opacity: 0.55 }}>
      <PlaceholderThumb title={c.title} duration={c.duration} gradient={DECOY_GRADIENTS[idx]!} />
      <div className="flex gap-[8px]">
        <ChannelAvatar name={c.channel} size={28} />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white/90 leading-[1.3] line-clamp-2">{c.title}</div>
          <div className="text-[11px] text-white/40 mt-[2px]">{c.channel}</div>
          <div className="text-[11px] text-white/40">
            {c.views} &middot; {c.age}
          </div>
        </div>
      </div>
    </div>
  )
}

function HomeUserCard({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  return (
    <div
      className="space-y-[8px] rounded-[10px] p-[6px]"
      style={{
        border: `2px solid ${variantColor}`,
        boxShadow: `0 0 16px ${variantColor}33`,
      }}
    >
      <UserThumb thumbUrl={thumbUrl} variantLabel={variantLabel} variantColor={variantColor} />
      <div className="flex gap-[8px]">
        <UserAvatar size={28} />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white/90 leading-[1.3] line-clamp-2">{videoTitle}</div>
          <div className="text-[11px] text-white/40 mt-[2px]">tnFigueiredo</div>
          <div className="text-[11px] text-white/40">12 mil views &middot; ha 2 dias</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Search feed cards                                                  */
/* ------------------------------------------------------------------ */

function SearchDecoyRow({ idx }: { idx: number }) {
  const c = COMPETITORS[idx]!
  return (
    <div className="flex gap-[12px]" style={{ opacity: 0.55 }}>
      <div className="w-[200px] shrink-0">
        <PlaceholderThumb title={c.title} duration={c.duration} gradient={DECOY_GRADIENTS[idx]!} />
      </div>
      <div className="min-w-0 py-[2px]">
        <div className="text-[13px] font-semibold text-white/90 leading-[1.25] line-clamp-2">{c.title}</div>
        <div className="text-[11px] text-white/40 mt-[4px]">
          {c.views} &middot; {c.age}
        </div>
        <div className="flex items-center gap-[6px] mt-[6px]">
          <ChannelAvatar name={c.channel} size={20} />
          <span className="text-[11px] text-white/40">{c.channel}</span>
        </div>
      </div>
    </div>
  )
}

function SearchUserRow({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  return (
    <div
      className="flex gap-[12px] rounded-[10px] p-[6px]"
      style={{
        border: `2px solid ${variantColor}`,
        boxShadow: `0 0 16px ${variantColor}33`,
      }}
    >
      <div className="w-[200px] shrink-0">
        <UserThumb thumbUrl={thumbUrl} variantLabel={variantLabel} variantColor={variantColor} />
      </div>
      <div className="min-w-0 py-[2px]">
        <div className="text-[13px] font-semibold text-white/90 leading-[1.25] line-clamp-2">{videoTitle}</div>
        <div className="text-[11px] text-white/40 mt-[4px]">12 mil views &middot; ha 2 dias</div>
        <div className="flex items-center gap-[6px] mt-[6px]">
          <UserAvatar size={20} />
          <span className="text-[11px] text-white/40">tnFigueiredo</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggested sidebar cards                                            */
/* ------------------------------------------------------------------ */

function SuggestedDecoyRow({ idx }: { idx: number }) {
  const c = COMPETITORS[idx]!
  return (
    <div className="flex gap-[8px]" style={{ opacity: 0.55 }}>
      <div className="w-[140px] shrink-0">
        <PlaceholderThumb title={c.title} duration={c.duration} gradient={DECOY_GRADIENTS[idx]!} radius={6} />
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold text-white/90 leading-[1.25] line-clamp-2">{c.title}</div>
        <div className="text-[10.5px] text-white/40 mt-[3px]">{c.channel}</div>
        <div className="text-[10.5px] text-white/40">
          {c.views} &middot; {c.age}
        </div>
      </div>
    </div>
  )
}

function SuggestedUserRow({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  return (
    <div
      className="flex gap-[8px] rounded-[8px] p-[4px]"
      style={{
        border: `2px solid ${variantColor}`,
        boxShadow: `0 0 12px ${variantColor}33`,
      }}
    >
      <div className="w-[140px] shrink-0">
        <UserThumb thumbUrl={thumbUrl} variantLabel={variantLabel} variantColor={variantColor} radius={6} />
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold text-white/90 leading-[1.25] line-clamp-2">{videoTitle}</div>
        <div className="text-[10.5px] text-white/40 mt-[3px]">tnFigueiredo</div>
        <div className="text-[10.5px] text-white/40">12 mil views &middot; ha 2 dias</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feed renderers                                                     */
/* ------------------------------------------------------------------ */

/** Position 4 (0-indexed) in a 6-slot feed = center of second row in 3-col grid */
const USER_POSITION = 4

function HomeFeed({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  let competitorIdx = 0
  return (
    <div className="grid grid-cols-3 gap-[12px]">
      {Array.from({ length: 6 }, (_, i) => {
        if (i === USER_POSITION) {
          return (
            <HomeUserCard
              key="user"
              videoTitle={videoTitle}
              variantLabel={variantLabel}
              variantColor={variantColor}
              thumbUrl={thumbUrl}
            />
          )
        }
        const idx = competitorIdx
        competitorIdx++
        return <HomeDecoyCard key={`decoy-${idx}`} idx={idx} />
      })}
    </div>
  )
}

function SearchFeed({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  let competitorIdx = 0
  return (
    <div className="space-y-[10px]">
      {Array.from({ length: 6 }, (_, i) => {
        if (i === USER_POSITION) {
          return (
            <SearchUserRow
              key="user"
              videoTitle={videoTitle}
              variantLabel={variantLabel}
              variantColor={variantColor}
              thumbUrl={thumbUrl}
            />
          )
        }
        const idx = competitorIdx
        competitorIdx++
        return <SearchDecoyRow key={`decoy-${idx}`} idx={idx} />
      })}
    </div>
  )
}

function SuggestedFeed({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  let competitorIdx = 0
  return (
    <div className="space-y-[8px]">
      {Array.from({ length: 6 }, (_, i) => {
        if (i === USER_POSITION) {
          return (
            <SuggestedUserRow
              key="user"
              videoTitle={videoTitle}
              variantLabel={variantLabel}
              variantColor={variantColor}
              thumbUrl={thumbUrl}
            />
          )
        }
        const idx = competitorIdx
        competitorIdx++
        return <SuggestedDecoyRow key={`decoy-${idx}`} idx={idx} />
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile feed                                                        */
/* ------------------------------------------------------------------ */

function MobileFeed({
  videoTitle,
  variantLabel,
  variantColor,
  thumbUrl,
}: {
  videoTitle: string
  variantLabel: DisplayLabel
  variantColor: string
  thumbUrl?: string | null
}) {
  return (
    <div className="flex justify-center">
      <div style={{ width: 375, border: '8px solid #050505', borderRadius: 40, background: '#0a0a0a', boxShadow: 'rgba(0,0,0,0.7) 0 20px 50px -16px', overflow: 'hidden' }}>
        {/* Notch */}
        <div className="h-[26px] flex items-center justify-center">
          <div className="w-[70px] h-[16px] bg-[#050505] rounded-full" />
        </div>
        {/* User video */}
        <div style={{ borderBottom: `3px solid ${variantColor}` }}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={videoTitle} referrerPolicy="no-referrer" className="w-full aspect-video object-cover" />
          ) : (
            <PlaceholderThumb title={videoTitle} duration="—" gradient={DECOY_GRADIENTS[0]!} radius={0} />
          )}
          <div className="flex gap-[10px] px-[12px] py-[10px]">
            <div className="size-[32px] min-w-[32px] rounded-full bg-cms-accent flex items-center justify-center text-[12.8px] font-bold" style={{ color: 'rgb(20,15,8)' }}>TF</div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold leading-[1.3] line-clamp-2 text-white">{videoTitle}</div>
              <div className="text-[11.5px] text-[#9a958c] mt-[3px]">tnFigueiredo · Now testing</div>
            </div>
          </div>
        </div>
        {/* Up next */}
        <div className="px-[12px] py-[8px]">
          <div className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-[6px]">A seguir</div>
          {COMPETITORS.slice(0, 3).map((c, i) => (
            <div key={i} className="flex gap-[8px] py-[6px] opacity-[0.55]">
              <div className="w-[120px] shrink-0 aspect-video rounded-[4px]" style={{ background: DECOY_GRADIENTS[i % DECOY_GRADIENTS.length] }} />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-[#ccc] line-clamp-2">{c.title}</div>
                <div className="text-[10px] text-[#888] mt-[2px]">{c.channel}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Bottom bar */}
        <div className="h-[4px] bg-[#050505]" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ClickMomentUnified({ videoTitle, variants, leaderLabel }: ClickMomentUnifiedProps) {
  const [context, setContext] = useState<FeedContext>('home')
  const [selectedVariant, setSelectedVariant] = useState<DisplayLabel>(leaderLabel)

  const activeVariant = variants.find((v) => v.label === selectedVariant) ?? variants[0]!

  const FeedComponent = { home: HomeFeed, search: SearchFeed, suggested: SuggestedFeed, mobile: MobileFeed }[context]

  return (
    <div
      className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden"
      style={{ boxShadow: 'var(--shadow)' }}
    >
      {/* Card head */}
      <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
        <Eye size={15} className="text-cms-text-dim" />
        <span className="text-[13px] font-semibold text-cms-text">O momento de clique</span>
        <div className="inline-flex bg-cms-surface-hover rounded-[9px] p-[3px] gap-[2px] ml-auto">
          {(['home', 'search', 'suggested', 'mobile'] as const).map((ctx) => (
            <button
              key={ctx}
              type="button"
              onClick={() => setContext(ctx)}
              className="border-none cursor-pointer transition-[0.15s]"
              style={{
                padding: '6px 13px',
                borderRadius: 7,
                fontSize: '12.5px',
                fontWeight: 600,
                background: ctx === context ? 'var(--cms-accent)' : 'transparent',
                color: ctx === context ? 'rgb(20, 15, 8)' : 'var(--cms-text-dim)',
              }}
            >
              {CTX_LABELS[ctx]}
            </button>
          ))}
        </div>
      </div>

      {/* Card pad */}
      <div className="p-[16px]">
        {/* Variant selector */}
        <div className="flex items-center gap-[8px] mb-[14px]">
          <span className="text-[12px] text-cms-text-dim">Mostrar variante:</span>
          {variants.map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => setSelectedVariant(v.label)}
              className="border-none bg-transparent p-0 cursor-pointer transition-opacity"
              style={{ opacity: v.label === selectedVariant ? 1 : 0.5 }}
            >
              <VChip label={v.label} size={22} ring={v.label === selectedVariant} />
            </button>
          ))}
        </div>

        {/* Feed area — dark YouTube-like background */}
        <div className="bg-[#0f0f0f] rounded-[8px] p-[14px]">
          <FeedComponent
            videoTitle={videoTitle}
            variantLabel={activeVariant.label}
            variantColor={activeVariant.color}
            thumbUrl={activeVariant.thumbUrl}
          />
        </div>
      </div>
    </div>
  )
}
