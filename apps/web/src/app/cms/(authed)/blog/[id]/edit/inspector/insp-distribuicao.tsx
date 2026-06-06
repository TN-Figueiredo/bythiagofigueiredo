'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import { Globe, RefreshCw } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { publishPost } from '../actions'
import { imageStats } from '../helpers'

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] }

export function InspDistribuicao() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()
  const [pending, setPending] = useState(false)

  if (!version) return null

  const lang = state.activeLang
  const { published, dirty, publishedAt, updatedAt, slug, body } = version
  const stats = imageStats(body ?? EMPTY_DOC)
  // Count the cover alongside inline images so this mirrors the Imagens stage
  // (a cover-only post reads "1/1", not the misleading inline-only "0/0").
  const imgDone = stats.done + (version.coverReady ? 1 : 0)
  const imgTotal = stats.total + 1

  const statusClass = !published ? 'draft' : dirty ? 'pending' : 'live'
  const statusLabel = !published
    ? 'Rascunho · não publicado'
    : dirty
      ? 'Publicado · alterações pendentes'
      : 'Publicado · no ar'

  return (
    <section className="insp-card" data-testid="insp-distribuicao">
      <div className="insp-head">
        <Globe size={15} className="lucide" />
        <span className="ih">No site</span>
      </div>
      <div className="insp-body">
        {/* ---- Site status ---- */}
        <div className="pubsite">
          <span className={`ps-status ${statusClass}`} data-testid="dist-status">
            <span className="ps-dot" />
            {statusLabel}
          </span>
          {published && (
            <a className="ps-url" data-testid="dist-url" href={`/blog/${lang}/${slug}`} target="_blank" rel="noopener">
              /blog/{lang}/{slug}
            </a>
          )}
          {published && (publishedAt || updatedAt) && (
            <div className="ps-dates" data-testid="dist-dates">
              {publishedAt && <span>Publicado {publishedAt}</span>}
              {updatedAt && <span className="pd-upd">· atualizado {updatedAt}</span>}
            </div>
          )}
          {published && dirty && (
            <button
              type="button"
              data-testid="dist-update"
              disabled={pending}
              className="btn sm primary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={async () => {
                const postId = state.postId
                if (!postId) return
                setPending(true)
                try {
                  await publishPost(postId)
                  dispatch({
                    type: 'UPDATE_PUBLISHED',
                    publishedAt: new Date().toISOString(),
                  })
                  toast.success('Publicação atualizada')
                } catch {
                  toast.error('Erro ao atualizar publicação')
                } finally {
                  setPending(false)
                }
              }}
            >
              <RefreshCw size={13} className="lucide" />
              {pending ? 'Atualizando...' : 'Atualizar no site'}
            </button>
          )}
        </div>

        {/* ---- Images count (cover + inline, matching the Imagens stage) ---- */}
        <div data-testid="dist-images" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Imagens: <span style={{
            fontWeight: 600,
            color: imgDone < imgTotal ? 'var(--warn)' : 'var(--c-links)',
          }}>
            {imgDone}/{imgTotal}
          </span>
        </div>
      </div>
    </section>
  )
}
