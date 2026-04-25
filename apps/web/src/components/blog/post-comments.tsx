'use client'

import { useState } from 'react'
import type { MockComment } from './types'

type Props = { comments: MockComment[] }

export function PostComments({ comments }: Props) {
  const topLevel = comments.filter((c) => !c.parentId)
  const replies = comments.filter((c) => c.parentId)

  return (
    <section id="comments" className="my-8">
      <div className="flex items-baseline flex-wrap" style={{ gap: 14, marginBottom: 24 }}>
        <h2 className="font-fraunces text-[28px] font-medium m-0 text-pb-ink">
          Conversa
        </h2>
        <span className="font-jetbrains text-xs text-pb-muted tracking-[0.06em]">
          {comments.length} comentarios
        </span>
      </div>

      <div
        style={{
          marginBottom: 36,
          padding: '18px 20px',
          border: '1px dashed var(--pb-line)',
          background: 'rgba(0,0,0,0.15)',
        }}
      >
        <textarea
          className="w-full resize-y border-none outline-none p-0 font-source-serif"
          placeholder="Deixe um comentario honesto (sem self-promo)"
          rows={3}
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            minHeight: 60,
            background: 'transparent',
            color: 'var(--pb-ink)',
          }}
          readOnly
        />
        <div
          className="flex items-center justify-between flex-wrap"
          style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--pb-line)', gap: 10 }}
        >
          <span className="text-[11px] font-jetbrains text-pb-faint">
            Voce precisa entrar com email pra comentar — protege do spam.
          </span>
          <button
            className="bg-pb-accent border-none font-jetbrains text-[11px] font-semibold tracking-[0.14em] uppercase cursor-pointer"
            style={{ padding: '8px 18px', color: '#FFF' }}
          >
            Publicar
          </button>
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 28 }}>
        {topLevel.map((comment) => (
          <CommentThread key={comment.id} comment={comment} replies={replies.filter((r) => r.parentId === comment.id)} />
        ))}
      </div>
    </section>
  )
}

function CommentThread({ comment, replies }: { comment: MockComment; replies: MockComment[] }) {
  return (
    <div className="flex items-start" style={{ gap: 14 }}>
      <CommentAvatar initials={comment.authorInitials} size={40} />
      <div className="flex-1 min-w-0">
        <CommentContent comment={comment} depth={0} />
        {replies.length > 0 && (
          <div className="flex flex-col" style={{ marginTop: 20, paddingLeft: 16, borderLeft: '1px dashed var(--pb-line)', gap: 22 }}>
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start" style={{ gap: 14 }}>
                <CommentAvatar initials={reply.authorInitials} size={32} />
                <div className="flex-1 min-w-0">
                  <CommentContent comment={reply} depth={1} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentContent({ comment, depth }: { comment: MockComment; depth: number }) {
  const [liked, setLiked] = useState(false)
  const likes = comment.likes + (liked ? 1 : 0)

  return (
    <>
      <div className="flex items-baseline flex-wrap" style={{ gap: 10, marginBottom: 6 }}>
        <span className="font-semibold text-pb-ink whitespace-nowrap" style={{ fontSize: depth === 0 ? 14 : 13 }}>
          {comment.authorName}
        </span>
        {comment.isAuthorReply && (
          <span
            className="font-jetbrains text-[9px] tracking-[0.12em] uppercase font-semibold rounded-[3px]"
            style={{ padding: '2px 6px', background: 'var(--pb-accent)', color: '#FFF' }}
          >
            resposta do autor
          </span>
        )}
        <span className="text-[11px] text-pb-faint font-jetbrains tracking-[0.04em] whitespace-nowrap">
          {comment.timeAgo}
        </span>
      </div>
      <p
        className="text-pb-ink font-source-serif"
        style={{
          fontSize: depth === 0 ? 15 : 14,
          lineHeight: 1.55,
          marginBottom: 10,
          textWrap: 'pretty',
        }}
      >
        {comment.text}
      </p>
      <div
        className="font-jetbrains text-pb-muted"
        style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 12, letterSpacing: '0.04em' }}
      >
        <button
          onClick={() => setLiked(!liked)}
          className="bg-transparent border-none p-0 cursor-pointer transition-colors"
          style={{
            color: liked ? 'var(--pb-accent)' : 'var(--pb-muted)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'inherit',
          }}
          aria-label={`Curtir comentario, ${likes} curtidas`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {likes}
        </button>
        <button
          className="bg-transparent border-none p-0 text-pb-muted cursor-pointer"
          style={{ fontSize: 12, fontFamily: 'inherit' }}
          aria-label="Responder comentario"
        >
          ↩ responder
        </button>
      </div>
    </>
  )
}

function CommentAvatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-fraunces font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--pb-accent), var(--pb-marker))',
        color: '#1A140C',
        fontSize: size * 0.4,
        border: '2px solid var(--pb-paper)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }}
    >
      {initials}
    </div>
  )
}
