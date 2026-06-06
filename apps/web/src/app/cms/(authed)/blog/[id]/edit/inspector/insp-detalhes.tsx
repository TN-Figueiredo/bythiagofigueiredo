'use client'

import { toast } from 'sonner'
import { PenLine, Plus } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { deriveSlug, resolveCategory } from '../helpers'

export function InspDetalhes() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const { shared } = state
  const cat = resolveCategory(shared.category, lang, state.categories)

  return (
    <section className="insp-card" data-testid="insp-detalhes">
      <div className="insp-head">
        <PenLine size={15} className="lucide" />
        <span className="ih">Detalhes</span>
        <span className="grow" />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Blog · {lang === 'pt' ? 'PT' : 'EN'}{shared.plevel !== null ? ` · P${shared.plevel}` : ''}
        </span>
      </div>
      <div className="insp-body">
        {/* ---- Slug ---- */}
        <div className="det-row" data-testid="insp-slug">
          <span className="flabel">Endereço (slug)</span>
          <div className="slug-wrap">
            <span className="slug-pre">/blog/{lang}/</span>
            <input
              type="text"
              value={version.slug}
              onChange={(e) =>
                dispatch({
                  type: 'SET_SLUG',
                  slug: deriveSlug(e.target.value),
                  touched: true,
                })
              }
              aria-label="Slug"
            />
          </div>
          <span className="fhint">
            {version.slugTouched ? (
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  dispatch({
                    type: 'SET_SLUG',
                    slug: deriveSlug(version.title),
                    touched: false,
                  })
                  toast.info('Slug regenerado do título')
                }}
              >
                ↻ regenerar do título
              </button>
            ) : (
              <>derivado do título · <span className="mono">auto</span></>
            )}
          </span>
        </div>

        {/* ---- Excerpt ---- */}
        <div className="det-row" data-testid="insp-excerpt">
          <span className="flabel">Descrição</span>
          <textarea
            value={version.excerpt}
            onChange={(e) =>
              dispatch({ type: 'SET_EXCERPT', excerpt: e.target.value })
            }
            rows={3}
            className="finput"
            style={{ minHeight: 72, resize: 'vertical', overflowY: 'auto' }}
            placeholder="Resumo curto para listagem e card social"
            aria-label="Descrição"
          />
        </div>

        {/* ---- Category ---- */}
        <div className="det-row" data-testid="insp-category">
          <span className="flabel">Categoria</span>
          {cat ? (
            <div className="tag-chips">
              <span className="tag-chip" style={{
                color: cat.color,
                background: `${cat.color}18`,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span className="cdot" style={{ width: 9, height: 9, borderRadius: 3, background: cat.color }} />
                {cat.label}
              </span>
            </div>
          ) : (
            <span className="fhint">Sem categoria</span>
          )}
        </div>

        {/* ---- Tags ---- */}
        <div className="det-row" data-testid="insp-tags">
          <span className="flabel">Tags · {shared.tags.length}</span>
          <div className="tag-chips">
            {shared.tags.map((tag) => (
              <span key={tag} className="tag-chip">{tag}</span>
            ))}
            <button type="button" className="tag-add">
              <Plus size={12} className="lucide" /> Adicionar
            </button>
          </div>
        </div>

        {/* ---- Priority ---- */}
        {shared.plevel !== null && (
          <div className="det-row" data-testid="insp-plevel">
            <span className="flabel">Prioridade</span>
            <span
              className="badge"
              style={{
                color: shared.plevel === 1 ? 'var(--danger)' : shared.plevel === 2 ? 'var(--warn)' : 'var(--text-dim)',
                background: shared.plevel === 1 ? 'var(--danger-s)' : shared.plevel === 2 ? 'var(--warn-s)' : 'var(--surface-2)',
                borderColor: 'transparent',
              }}
            >
              P{shared.plevel}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
