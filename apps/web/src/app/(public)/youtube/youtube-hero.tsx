'use client'

import type { CSSProperties } from 'react'
import type { YouTubeVideoView } from './youtube-types'
import type { YouTubeStrings } from '@/lib/content/types'
import { Paper, Tape } from '@/components/pinboard'
import { type Theme, FlagBadge, VideoThumbnail, formatDate } from './youtube-atoms'
import { VideoLightbox } from '../components/VideoLightbox'

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  latestPT: YouTubeVideoView | null
  latestEN: YouTubeVideoView | null
  enOlder: YouTubeVideoView[]
  fmtNum: (n: number) => string
  strings: YouTubeStrings
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

function HeroPT({ locale, theme, latestPT, latestEN, enOlder, fmtNum, strings }: Props) {
  const { ink, muted, faint, line, marker, yt, paper, paper2, tape, tapeR, hand } = theme

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
            § 01 · {strings.hero_pt_section_label}
          </div>

          <h1 style={{
            fontFamily: '"Fraunces", serif', fontSize: 'clamp(44px, 5.6vw, 78px)',
            margin: 0, fontWeight: 500,
            letterSpacing: '-0.035em', lineHeight: 0.96, position: 'relative', display: 'inline',
            textWrap: 'balance' as CSSProperties['textWrap'], color: ink,
            isolation: 'isolate',
          }}>
            <span style={{ position: 'relative', display: 'inline', isolation: 'isolate' }}>
              {strings.hero_pt_headline}
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
            {strings.hero_pt_description}
          </p>

          {/* Latest PT -- wide card with title + meta */}
          {latestPT && (
            <div style={{ marginTop: 36, position: 'relative', paddingTop: 14 }}>
              <VideoLightbox youtubeVideoId={latestPT.youtubeVideoId}>
                <Paper tint={paper} padding="0" rotation={-0.3}>
                  <Tape color={tape} style={{ top: -10, left: '10%', transform: 'rotate(-3deg)', width: 90 }}/>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}>
                    <VideoThumbnail video={latestPT} aspect="16/10"/>
                    <div style={{ padding: '16px 20px 18px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <FlagBadge locale="pt" size="sm" ink={ink}/>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: '0.06em' }}>
                          {formatDate(latestPT.publishedAt, locale)}
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
              </VideoLightbox>
            </div>
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
            <span>{strings.hero_pt_also_on}</span>
          </div>

          {latestEN && (
            <div style={{ position: 'relative', paddingTop: 14 }}>
              <VideoLightbox youtubeVideoId={latestEN.youtubeVideoId}>
                <Paper tint={paper2} padding="0" rotation={0.4}>
                  <Tape color={tapeR} style={{ top: -10, left: '60%', transform: 'rotate(4deg)', width: 80 }}/>
                  <VideoThumbnail video={latestEN} aspect="16/9"/>
                  <div style={{ padding: '14px 18px 16px' }}>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, marginBottom: 6, letterSpacing: '0.06em' }}>
                      {formatDate(latestEN.publishedAt, locale)} {'·'} {fmtNum(latestEN.viewCount)} {strings.card_views}
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
              </VideoLightbox>
            </div>
          )}

          {/* Mini list -- 2 prev EN videos as plain links */}
          {enOlder.length > 0 && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${line}` }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                letterSpacing: '0.2em', textTransform: 'uppercase', color: faint, marginBottom: 12,
              }}>
                {strings.hero_pt_previously}
              </div>
              {enOlder.map((v, i) => (
                <VideoLightbox key={v.id} youtubeVideoId={v.youtubeVideoId}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12,
                    padding: '10px 0', borderBottom: i < enOlder.length - 1 ? `1px dashed ${line}` : 'none',
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 500, color: ink,
                        lineHeight: 1.25, letterSpacing: '-0.005em',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {v.title}
                      </div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, marginTop: 4, letterSpacing: '0.06em' }}>
                        {formatDate(v.publishedAt, locale)} {'·'} {v.duration}
                      </div>
                    </div>
                    <span style={{ color: yt, fontSize: 14, alignSelf: 'center' }}>{'▶'}</span>
                  </div>
                </VideoLightbox>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function HeroEN({ locale, theme, latestPT, latestEN, enOlder, fmtNum, strings }: Props) {
  const { ink, muted, faint, line, marker, yt, paper2, tapeR, hand } = theme

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 28px' }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: yt, marginBottom: 12,
      }}>
        § 01 · {strings.hero_en_section_label}
      </div>

      <h1 style={{
        fontFamily: '"Fraunces", serif', fontSize: 'clamp(44px, 5.4vw, 72px)',
        margin: '0 0 16px', fontWeight: 500,
        letterSpacing: '-0.035em', lineHeight: 0.98, display: 'inline-block',
        textWrap: 'balance' as CSSProperties['textWrap'], position: 'relative',
        isolation: 'isolate',
      }}>
        {strings.hero_en_headline_line1}
        <br/>
        <span style={{ position: 'relative', display: 'inline-block', isolation: 'isolate' }}>
          {strings.hero_en_headline_line2}
          <span aria-hidden="true" style={{
            position: 'absolute', bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: 'skew(-2deg)',
          }}/>
        </span>
      </h1>

      <p style={{ fontSize: 17, color: muted, marginTop: 12, maxWidth: 720, lineHeight: 1.55, fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {strings.hero_en_description}
      </p>

      {latestEN && (
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28 }}>
          <div style={{ position: 'relative', paddingTop: 16 }}>
            <VideoLightbox youtubeVideoId={latestEN.youtubeVideoId}>
              <Paper tint={paper2} padding="0" rotation={-0.3}>
                <Tape color={tapeR} style={{ top: -10, left: '44%', transform: 'rotate(-4deg)', width: 100 }}/>
                <VideoThumbnail video={latestEN} aspect="16/9"/>
                <div style={{ padding: '20px 24px 22px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                    <FlagBadge locale="en" size="sm" ink={ink}/>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint }}>
                      {formatDate(latestEN.publishedAt, locale)}
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
            </VideoLightbox>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: faint,
              paddingBottom: 8, borderBottom: `1px dashed ${line}`,
            }}>
              {strings.hero_en_previously}
            </div>
            {enOlder.map((v) => (
              <VideoLightbox key={v.id} youtubeVideoId={v.youtubeVideoId}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12,
                  padding: 8, border: `1px dashed ${line}`,
                }}>
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
                      {formatDate(v.publishedAt, locale)} {'·'} {fmtNum(v.viewCount)} {strings.card_views}
                    </div>
                    <div style={{
                      fontFamily: '"Fraunces", serif', fontSize: 14.5, lineHeight: 1.2, color: ink, fontWeight: 500, letterSpacing: '-0.005em',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {v.title}
                    </div>
                  </div>
                </div>
              </VideoLightbox>
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
