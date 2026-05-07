'use client'

import Link from 'next/link'
import { coverGradient } from '@/lib/home/cover-image'
import { localePath } from '@/lib/i18n/locale-path'
import { ReadableCard } from '@/components/blog/readable-card'
import { PostPattern } from './post-pattern'
import { highlightText } from './search-highlight'
import { ptBR } from '@/components/blog/_i18n/pt-BR'
import { en } from '@/components/blog/_i18n/en'
import type { ArchivePost } from './blog-archive-client'

interface WritingCardProps {
  post: ArchivePost
  index: number
  dark?: boolean
  locale?: 'en' | 'pt-BR'
  searchQuery?: string
  isActive?: boolean
}

const theme = {
  paper: '#262117',
  paper2: '#2B261C',
  ink: '#EFE6D2',
  muted: '#958A75',
  faint: '#6B634F',
  line: '#2E2718',
  accent: '#FF8240',
  tape: '#E8C44A',
  tape2: '#5B8FB8',
  tapeR: '#C44B3D',
}

function getTapeColor(index: number, categoryColor?: string): string {
  if (categoryColor) {
    return categoryColor
  }
  const mod = index % 3
  if (mod === 0) return theme.tape
  if (mod === 1) return theme.tape2
  return theme.tapeR
}

export function WritingCard({ post, index, dark = true, locale = 'en', searchQuery, isActive }: WritingCardProps) {
  const t = locale === 'pt-BR' ? ptBR : en
  const rotation = ((index * 37) % 7 - 3) * 0.5
  const lift = ((index * 53) % 5 - 2) * 2
  const tapeRotation = (index * 11) % 12 - 6
  const tint = index % 3 === 1 ? theme.paper2 : theme.paper
  const tapeColor = getTapeColor(index, post.categoryColor)
  const tapeSide = index % 2 === 0 ? 'left' : 'right'

  const paperShadow = dark
    ? '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)'
    : '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)'

  const hoverShadow = dark
    ? '0 4px 0 rgba(0,0,0,0.5), 0 18px 36px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)'
    : '0 2px 0 rgba(0,0,0,0.05), 0 14px 32px rgba(70,50,20,0.22), inset 0 0 0 1px rgba(0,0,0,0.04)'

  const coverBg = post.coverUrl
    ? undefined
    : coverGradient(post.category, dark, post.categoryColorDark)

  return (
    <div style={{ position: 'relative', paddingTop: 16 }}>
      <ReadableCard postId={post.id}>
        <div
          className="writing-card-paper paper-card-lift"
          style={{
            background: tint,
            padding: 0,
            position: 'relative',
            transform: `rotate(${rotation}deg) translateY(${lift}px)`,
            boxShadow: isActive
              ? `0 0 0 2px #FF8240, ${paperShadow}`
              : paperShadow,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = `rotate(0deg) translateY(${lift - 3}px)`
            e.currentTarget.style.boxShadow = hoverShadow
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = `rotate(${rotation}deg) translateY(${lift}px)`
            e.currentTarget.style.boxShadow = isActive
              ? `0 0 0 2px #FF8240, ${paperShadow}`
              : paperShadow
          }}
        >
          {/* Tape decoration */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -9,
              [tapeSide]: '28%',
              width: 42,
              height: 18,
              background: tapeColor,
              opacity: 0.7,
              transform: `rotate(${tapeRotation}deg)`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
              zIndex: 2,
            }}
          />

          <Link
            href={localePath(`/blog/${post.slug}`, locale)}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            {/* Cover image area */}
            <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
              {post.coverUrl ? (
                <img
                  src={post.coverUrl}
                  alt=""
                  loading={index > 5 ? 'lazy' : 'eager'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: coverBg,
                  }}
                >
                  <PostPattern pattern={post.patternName} dark={dark} />
                </div>
              )}

              {/* Type badge */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  background: theme.ink,
                  color: '#FFF',
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                &#9636; {post.tagBadge ?? t.textBadge}
              </div>

              {/* Series badge */}
              {post.previousPostId && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 7px',
                    background: '#FFE37A',
                    color: '#1A140C',
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {t.series}
                </div>
              )}
            </div>

            {/* Content area */}
            <div style={{ padding: '16px 18px 18px' }}>
              {/* Category + date row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: post.categoryColorDark,
                    fontWeight: 500,
                  }}
                >
                  {post.categoryLabel}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 10,
                    color: theme.faint,
                    letterSpacing: '0.08em',
                  }}
                >
                  {post.date}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: 19,
                  lineHeight: 1.3,
                  margin: '6px 0 8px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: theme.ink,
                }}
              >
                {searchQuery ? highlightText(post.title, searchQuery) : post.title}
              </h3>

              {/* Reading time */}
              <div
                style={{
                  fontSize: 12,
                  color: theme.faint,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  letterSpacing: '0.04em',
                }}
              >
                {post.readingTime} {t.minuteReadLabel}
              </div>

              {/* Tags */}
              {post.tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 5,
                    marginTop: 10,
                  }}
                >
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: 10,
                        color: theme.faint,
                        letterSpacing: '0.04em',
                        padding: '2px 6px',
                        border: `1px solid ${theme.line}`,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        </div>
      </ReadableCard>

    </div>
  )
}
