'use client'

import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'
import { LANG_LABEL } from '../helpers'

function charStatus(
  count: number,
  ideal: [number, number],
): { label: string; cls: string } {
  if (count === 0) return { label: 'vazio', cls: '' }
  if (count < ideal[0]) return { label: 'curto', cls: '' }
  if (count <= ideal[1]) return { label: 'ideal', cls: 'ok' }
  return { label: 'pode truncar', cls: 'warn' }
}

export function StageSeo() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const titleStatus = charStatus(version.metaTitle.length, [40, 60])
  const descStatus = charStatus(version.metaDesc.length, [120, 160])

  const serpTitle = version.metaTitle || version.title || 'Sem título'
  const serpDesc = version.metaDesc || version.excerpt || 'Sem descrição'
  const serpUrl = `bythiagofigueiredo.com/blog/${lang}/${version.slug || '...'}`

  return (
    <div>
      {/* ---- Compact header ---- */}
      <div className="doc-kicker">SEO · {LANG_LABEL[lang] ?? lang.toUpperCase()}</div>
      {version.title && <h2 className="doc-title-sm">{version.title}</h2>}

      {/* ---- Meta title ---- */}
      <div className="fgroup" style={{ marginTop: 28 }}>
        <div className="seo-field-head">
          <label htmlFor="seo-meta-title" className="flabel">Meta título</label>
          <span data-testid="meta-title-counter" className={`charcount ${titleStatus.cls}`}>
            {version.metaTitle.length} chars · {titleStatus.label}
          </span>
        </div>
        <input
          id="seo-meta-title"
          type="text"
          value={version.metaTitle}
          onChange={(e) =>
            dispatch({ type: 'SET_FIELD', field: 'metaTitle', value: e.target.value })
          }
          placeholder="Título para buscadores"
          className="finput"
        />
      </div>

      {/* ---- Meta description ---- */}
      <div className="fgroup" style={{ marginTop: 28 }}>
        <div className="seo-field-head">
          <label htmlFor="seo-meta-desc" className="flabel">Meta descrição</label>
          <span data-testid="meta-desc-counter" className={`charcount ${descStatus.cls}`}>
            {version.metaDesc.length} chars · {descStatus.label}
          </span>
        </div>
        <textarea
          id="seo-meta-desc"
          rows={3}
          value={version.metaDesc}
          onChange={(e) =>
            dispatch({ type: 'SET_FIELD', field: 'metaDesc', value: e.target.value })
          }
          placeholder="Descrição para buscadores"
          className="finput"
        />
      </div>

      {/* ---- Google SERP preview ---- */}
      <div style={{ marginTop: 28 }}>
        <div className="doc-kicker">Prévia Google</div>
        <div className="serp" style={{ marginTop: 12 }}>
          <div data-testid="serp-url" className="serp-url">{serpUrl}</div>
          <div data-testid="serp-title" className="serp-title">{serpTitle}</div>
          <div className="serp-desc">{serpDesc}</div>
        </div>
      </div>
    </div>
  )
}
