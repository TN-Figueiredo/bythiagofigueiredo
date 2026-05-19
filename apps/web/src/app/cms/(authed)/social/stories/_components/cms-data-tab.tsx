'use client'
import type { SocialPostData } from '@/lib/social/story-types'

// ---------------------------------------------------------------------------
// CmsDataTab — shows CMS tokens (title, description, cover_image, logo,
// short_url) with insert-as-text, insert-as-image, and set-as-background
// action buttons.
// ---------------------------------------------------------------------------

interface CmsDataTabProps {
  postData: SocialPostData
  onInsertText: (text: string) => void
  onInsertImage: (url: string) => void
  onSetBackground: (url: string) => void
}

export function CmsDataTab({ postData, onInsertText, onInsertImage, onSetBackground }: CmsDataTabProps) {
  const tokens: Array<{
    label: string
    value: string | undefined
    kind: 'text' | 'image'
  }> = [
    { label: 'Título', value: postData.title, kind: 'text' },
    { label: 'Descrição', value: postData.description, kind: 'text' },
    { label: 'URL curta', value: postData.shortUrl, kind: 'text' },
    { label: 'Capa', value: postData.coverImageUrl, kind: 'image' },
    { label: 'Logo', value: postData.logoUrl, kind: 'image' },
  ]

  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">CMS Data</h3>

      <div className="flex flex-col gap-2">
        {tokens.map(({ label, value, kind }) => (
          <TokenRow
            key={label}
            label={label}
            value={value}
            kind={kind}
            onInsertText={onInsertText}
            onInsertImage={onInsertImage}
            onSetBackground={onSetBackground}
          />
        ))}
      </div>

      <p className="text-[10px] text-neutral-600 leading-relaxed">
        Insira dados do CMS no canvas. Textos viram elementos editáveis; imagens viram elementos ou fundos.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single token row
// ---------------------------------------------------------------------------

interface TokenRowProps {
  label: string
  value: string | undefined
  kind: 'text' | 'image'
  onInsertText: (text: string) => void
  onInsertImage: (url: string) => void
  onSetBackground: (url: string) => void
}

function TokenRow({ label, value, kind, onInsertText, onInsertImage, onSetBackground }: TokenRowProps) {
  const isEmpty = !value

  return (
    <div className={`rounded border p-2 ${isEmpty ? 'border-neutral-800 opacity-50' : 'border-neutral-700'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-neutral-300">{label}</span>
        {isEmpty && <span className="text-[9px] text-neutral-600 uppercase tracking-wide">vazio</span>}
      </div>

      {!isEmpty && (
        <ValuePreview label={label} value={value!} kind={kind} />
      )}

      {!isEmpty && (
        <div className="flex gap-1 mt-2">
          {kind === 'text' && (
            <ActionButton
              label="Inserir texto"
              icon="T"
              onClick={() => onInsertText(value!)}
            />
          )}
          {kind === 'image' && (
            <>
              <ActionButton
                label="Inserir imagem"
                icon={<ImageIcon />}
                onClick={() => onInsertImage(value!)}
              />
              <ActionButton
                label="Definir fundo"
                icon={<BgIcon />}
                onClick={() => onSetBackground(value!)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Value preview
// ---------------------------------------------------------------------------

function ValuePreview({ label, value, kind }: { label: string; value: string; kind: 'text' | 'image' }) {
  if (kind === 'image') {
    return (
      <div className="w-full h-16 rounded overflow-hidden bg-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={label}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2 break-all">
      {value}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
}

function ActionButton({ label, icon, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors text-[10px] font-medium"
    >
      {typeof icon === 'string' ? <span className="font-bold">{icon}</span> : icon}
      <span>{label.split(' ')[0]}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ImageIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
      <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
      <path d="M1 7l2.5-2.5L5 6l2-2 2 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BgIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
