import type { MockComment } from './types'

type Props = { comments: MockComment[] }

export function PostComments({ comments }: Props) {
  const topLevel = comments.filter((c) => !c.parentId)
  const replies = comments.filter((c) => c.parentId)

  return (
    <div className="my-8">
      <div className="h-px bg-[--pb-line] mb-5" />
      <h3 className="font-fraunces text-2xl font-bold">
        Conversa <span className="font-sans text-[15px] font-normal text-pb-muted">· {comments.length} comentarios</span>
      </h3>
      <div className="bg-[--pb-paper] rounded-xl p-5 my-4">
        <textarea
          className="w-full bg-transparent border-none text-pb-ink font-source-serif text-[15px] resize-y min-h-[60px] outline-none leading-relaxed"
          placeholder="Deixe um comentario honesto (sem self-promo)"
          style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
          readOnly
        />
        <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-[--pb-line]">
          <span className="text-[13px] text-pb-muted">Voce precisa entrar com email pra comentar — protege do spam.</span>
          <button
            className="bg-pb-accent font-jetbrains text-[11px] font-semibold tracking-[1.5px] uppercase px-4 py-1.5 rounded-md cursor-pointer border-none"
            style={{ color: 'var(--pb-bg)' }}
          >
            PUBLICAR
          </button>
        </div>
      </div>
      {topLevel.map((comment) => (
        <div key={comment.id}>
          <CommentRow comment={comment} />
          {replies
            .filter((r) => r.parentId === comment.id)
            .map((reply) => (
              <CommentRow key={reply.id} comment={reply} nested />
            ))}
        </div>
      ))}
    </div>
  )
}

function CommentRow({ comment, nested }: { comment: MockComment; nested?: boolean }) {
  return (
    <div className={`flex gap-3 py-3.5 border-b border-[--pb-line] ${nested ? 'ml-[52px]' : ''}`}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
        style={{ backgroundColor: comment.avatarColor, color: 'var(--pb-bg)' }}
      >
        {comment.authorInitials}
      </div>
      <div>
        <div>
          <span className="text-sm font-semibold">{comment.authorName}</span>
          {comment.isAuthorReply && (
            <span
              className="font-jetbrains text-[9px] tracking-[1px] uppercase ml-1.5 px-2 py-0.5 rounded align-middle"
              style={{ backgroundColor: 'var(--pb-accent)', color: 'var(--pb-bg)' }}
            >
              RESPOSTA DO AUTOR
            </span>
          )}
          <span className="text-xs text-pb-faint ml-2">{comment.timeAgo}</span>
        </div>
        <p className="text-sm my-1 leading-relaxed text-pb-ink">{comment.text}</p>
        <div className="flex gap-4 text-xs text-pb-muted">
          <button aria-label={`Curtir comentario, ${comment.likes} curtidas`} className="bg-transparent border-none p-0 text-xs text-pb-muted cursor-pointer">♡ {comment.likes}</button>
          <button aria-label="Responder comentario" className="bg-transparent border-none p-0 text-xs text-pb-muted cursor-pointer">↩ responder</button>
        </div>
      </div>
    </div>
  )
}
