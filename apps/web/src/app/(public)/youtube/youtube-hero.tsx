'use client'

import type { CSSProperties } from 'react'
import type { YouTubeVideoView } from './youtube-types'
import { Paper, Tape } from '@/components/pinboard'

interface Theme {
  bg: string
  ink: string
  muted: string
  faint: string
  line: string
  accent: string
  marker: string
  yt: string
  paper: string
  paper2: string
  tape: string
  tape2: string
  tapeR: string
  hand: { fontFamily: string; fontWeight: number }
}

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  latestPT: YouTubeVideoView | null
  latestEN: YouTubeVideoView | null
  enOlder: YouTubeVideoView[]
  fmtNum: (n: number) => string
}

function FlagBadge({ locale, size = 'md', ink }: { locale: 'pt' | 'en'; size?: 'sm' | 'md'; ink: string }) {
  const colors = locale === 'pt'
    ? { bg: 'rgba(0,156,59,0.18)', border: 'rgba(0,156,59,0.5)', flag: '\u{1F1E7}\u{1F1F7}' }
    : { bg: 'rgba(0,82,165,0.18)', border: 'rgba(0,82,165,0.55)', flag: '\u{1F1FA}\u{1F1F8}' }
  const fontSize = size === 'sm' ? 9 : 10
  const flagSize = size === 'sm' ? 11 : 12
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '1px 6px' : '2px 7px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      fontFamily: '"JetBrains Mono", monospace', fontSize,
      letterSpacing: '0.1em', color: ink, fontWeight: 600,
    }}>
      <span style={{ fontSize: flagSize, lineHeight: 1 }}>{colors.flag}</span>
      {locale.toUpperCase()}
    </span>
  )
}

function Stat({ icon, value, muted, yt }: { icon: string; value: string; muted: string; yt: string }) {
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      color: muted, letterSpacing: '0.04em',
      display: 'inline-flex', gap: 5, alignItems: 'center',
    }}>
      <span style={{ color: yt, fontSize: 10 }}>{icon}</span>
      {value}
    </span>
  )
}

function VideoThumbnail({ video, aspect = '16/9' }: { video: YouTubeVideoView; aspect?: string }) {
  const src = video.thumbnailHqUrl ?? video.thumbnailUrl
  return (
    <div style={{ position: 'relative', aspectRatio: aspect, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
      {src ? (
        <img
          src={src}
          alt={video.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, rgba(255,45,32,0.2), rgba(199,112,46,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 28, background: 'rgba(255,45,32,0.8)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        background: 'rgba(0,0,0,0.85)', color: '#FFF',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
        padding: '1px 5px', lineHeight: 1.4,
      }}>
        {video.duration}
      </div>
    </div>
  )
}

function formatDate(iso: string, locale: 'pt' | 'en'): string {
  const d = new Date(iso)
  if (locale === 'pt') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function HeroPT({ locale, theme, latestPT, latestEN, enOlder, fmtNum }: Props) {
  const { ink, muted, faint, line, marker, yt, paper, paper2, tape, tapeR, hand } = theme
  const L = locale

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 56, alignItems: 'start' }}>
        {/* Left: editorial title + featured PT */}
        <div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: yt, marginBottom: 12,
          }}>
            § 01 · {L === 'pt' ? 'esta semana, em dois canais' : 'this week, on two channels'}
          </div>

          <h1 style={{
            fontFamily: '"Fraunces", serif', fontSize: 'clamp(44px, 5.6vw, 78px)',
            margin: 0, fontWeight: 500,
            letterSpacing: '-0.035em', lineHeight: 0.96, position: 'relative', display: 'inline',
            textWrap: 'balance' as CSSProperties['textWrap'], color: ink,
            isolation: 'isolate',
          }}>
            Dois canais,
            <br/>
            <span style={{ position: 'relative', display: 'inline-block', isolation: 'isolate' }}>
              uma cabe{'c'}a
              <span aria-hidden="true" style={{
                position: 'absolute', bottom: 4, left: -6, right: -6, height: 18,
                background: marker, zIndex: -1, opacity: 0.7, transform: 'skew(-2deg)',
              }}/>
            </span>
            <span style={{ ...hand, fontSize: 38, marginLeft: 12, color: yt, transform: 'rotate(-4deg)', display: 'inline-block', verticalAlign: 'middle' }}>
              {'▶'}
            </span>
          </h1>

          <p style={{ fontSize: 17, color: muted, marginTop: 22, maxWidth: 540, lineHeight: 1.55, fontFamily: '"Source Serif 4", Georgia, serif' }}>
            {L === 'pt'
              ? 'Um canal em português, um em inglês — saídos da mesma mesa. PT é onde eu falo de carreira, setup, retrospectivas. EN é onde eu codifico em público.'
              : 'One channel in Portuguese, one in English — from the same desk. PT is where I talk about career, setup, retrospectives. EN is where I code in public.'}
          </p>

          {/* Latest PT -- wide card with title + meta */}
          {latestPT && (
            <a
              href={`https://www.youtube.com/watch?v=${latestPT.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit',
                marginTop: 36, position: 'relative', paddingTop: 14,
              }}
            >
              <Paper tint={paper} padding="0" rotation={-0.3}>
                <Tape color={tape} style={{ top: -10, left: '10%', transform: 'rotate(-3deg)', width: 90 }}/>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}>
                  <VideoThumbnail video={latestPT} aspect="16/10"/>
                  <div style={{ padding: '16px 20px 18px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <FlagBadge locale="pt" size="sm" ink={ink}/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: '0.06em' }}>
                        {formatDate(latestPT.publishedAt, L)}
                      </span>
                    </div>
                    <h2 style={{
                      fontFamily: '"Fraunces", serif', fontSize: 22, margin: '2px 0 8px', fontWeight: 500,
                      lineHeight: 1.18, letterSpacing: '-0.012em', color: ink,
                      textWrap: 'balance' as CSSProperties['textWrap'],
                    }}>
                      {latestPT.title}
                    </h2>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: '0 0 10px' }}>
                      {latestPT.description ?? ''}
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <Stat icon="▶" value={fmtNum(latestPT.viewCount)} muted={muted} yt={yt}/>
                      <Stat icon="♥" value={fmtNum(latestPT.likeCount)} muted={muted} yt={yt}/>
                    </div>
                  </div>
                </div>
              </Paper>
            </a>
          )}
        </div>

        {/* Right: latest EN as compact "outro canal" preview */}
        <div style={{ paddingTop: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: faint,
          }}>
            <FlagBadge locale="en" size="sm" ink={ink}/>
            <span>{L === 'pt' ? 'também rolou no @thiagofigueiredo' : 'also on @thiagofigueiredo'}</span>
          </div>

          {latestEN && (
            <a
              href={`https://www.youtube.com/watch?v=${latestEN.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', position: 'relative', paddingTop: 14 }}
            >
              <Paper tint={paper2} padding="0" rotation={0.4}>
                <Tape color={tapeR} style={{ top: -10, left: '60%', transform: 'rotate(4deg)', width: 80 }}/>
                <VideoThumbnail video={latestEN} aspect="16/9"/>
                <div style={{ padding: '14px 18px 16px' }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, marginBottom: 6, letterSpacing: '0.06em' }}>
                    {formatDate(latestEN.publishedAt, L)} {'·'} {fmtNum(latestEN.viewCount)} views
                  </div>
                  <h3 style={{
                    fontFamily: '"Fraunces", serif', fontSize: 17, margin: '2px 0 6px', fontWeight: 500,
                    lineHeight: 1.22, letterSpacing: '-0.005em', color: ink,
                    textWrap: 'balance' as CSSProperties['textWrap'],
                  }}>
                    {latestEN.title}
                  </h3>
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: 0 }}>
                    {latestEN.description ?? ''}
                  </p>
                </div>
              </Paper>
            </a>
          )}

          {/* Mini list -- 2 prev EN videos as plain links */}
          {enOlder.length > 0 && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${line}` }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                letterSpacing: '0.2em', textTransform: 'uppercase', color: faint, marginBottom: 12,
              }}>
                {L === 'pt' ? 'anteriores em inglês' : 'previously in English'}
              </div>
              {enOlder.map((v, i) => (
                <a
                  key={v.id}
                  href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12,
                    padding: '10px 0', borderBottom: i < enOlder.length - 1 ? `1px dashed ${line}` : 'none',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 500, color: ink,
                      lineHeight: 1.25, letterSpacing: '-0.005em',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {v.title}
                    </div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, marginTop: 4, letterSpacing: '0.06em' }}>
                      {formatDate(v.publishedAt, L)} {'·'} {v.duration}
                    </div>
                  </div>
                  <span style={{ color: yt, fontSize: 14, alignSelf: 'center' }}>{'↗'}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function HeroEN({ locale, theme, latestPT, latestEN, enOlder, fmtNum }: Props) {
  const { ink, muted, faint, line, marker, yt, paper2, tapeR, hand } = theme
  const L = locale

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 28px' }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: yt, marginBottom: 12,
      }}>
        § 01 · {L === 'pt' ? 'último vídeo' : 'latest video'}
      </div>

      <h1 style={{
        fontFamily: '"Fraunces", serif', fontSize: 'clamp(44px, 5.4vw, 72px)',
        margin: '0 0 16px', fontWeight: 500,
        letterSpacing: '-0.035em', lineHeight: 0.98, display: 'inline-block',
        textWrap: 'balance' as CSSProperties['textWrap'], position: 'relative',
        isolation: 'isolate',
      }}>
        Live-coding,
        <br/>
        <span style={{ position: 'relative', display: 'inline-block', isolation: 'isolate' }}>
          {L === 'pt' ? 'em inglês.' : 'in English.'}
          <span aria-hidden="true" style={{
            position: 'absolute', bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: 'skew(-2deg)',
          }}/>
        </span>
      </h1>

      <p style={{ fontSize: 17, color: muted, marginTop: 12, maxWidth: 720, lineHeight: 1.55, fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {L === 'pt'
          ? '@thiagofigueiredo — onde eu codifico em público, em inglês. Tem um canal-irmão em português, lá em cima.'
          : '@thiagofigueiredo — where I code in public, in English. There\'s a sister channel in Portuguese, linked above.'}
      </p>

      {latestEN && (
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28 }}>
          <a
            href={`https://www.youtube.com/watch?v=${latestEN.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block', position: 'relative', paddingTop: 16 }}
          >
            <Paper tint={paper2} padding="0" rotation={-0.3}>
              <Tape color={tapeR} style={{ top: -10, left: '44%', transform: 'rotate(-4deg)', width: 100 }}/>
              <VideoThumbnail video={latestEN} aspect="16/9"/>
              <div style={{ padding: '20px 24px 22px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <FlagBadge locale="en" size="sm" ink={ink}/>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint }}>
                    {formatDate(latestEN.publishedAt, L)}
                  </span>
                </div>
                <h2 style={{
                  fontFamily: '"Fraunces", serif', fontSize: 30, margin: '4px 0 10px', fontWeight: 500,
                  lineHeight: 1.14, letterSpacing: '-0.014em', color: ink,
                  textWrap: 'balance' as CSSProperties['textWrap'],
                }}>
                  {latestEN.title}
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.55, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: 0 }}>
                  {latestEN.description ?? ''}
                </p>
                <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
                  <Stat icon="▶" value={fmtNum(latestEN.viewCount)} muted={muted} yt={yt}/>
                  <Stat icon="♥" value={fmtNum(latestEN.likeCount)} muted={muted} yt={yt}/>
                  <Stat icon="✎" value={String(latestEN.commentCount)} muted={muted} yt={yt}/>
                </div>
              </div>
            </Paper>
          </a>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: faint,
              paddingBottom: 8, borderBottom: `1px dashed ${line}`,
            }}>
              {L === 'pt' ? 'anteriores' : 'previously'}
            </div>
            {enOlder.map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12,
                  textDecoration: 'none', color: 'inherit',
                  padding: 8, border: `1px dashed ${line}`,
                }}
              >
                <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
                  {(v.thumbnailUrl || v.thumbnailHqUrl) ? (
                    <img
                      src={v.thumbnailHqUrl ?? v.thumbnailUrl ?? ''}
                      alt={v.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(255,45,32,0.15), rgba(199,112,46,0.1))' }}/>
                  )}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 28, height: 20, background: yt, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 3, right: 3,
                    background: 'rgba(0,0,0,0.85)', color: '#FFF',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9, padding: '1px 4px',
                  }}>
                    {v.duration}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, letterSpacing: '0.08em', marginBottom: 4 }}>
                    {formatDate(v.publishedAt, L)} {'·'} {fmtNum(v.viewCount)} views
                  </div>
                  <div style={{
                    fontFamily: '"Fraunces", serif', fontSize: 14.5, lineHeight: 1.2, color: ink, fontWeight: 500, letterSpacing: '-0.005em',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {v.title}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function YouTubeHero(props: Props) {
  if (props.locale === 'pt') return <HeroPT {...props} />
  return <HeroEN {...props} />
}
