'use client'

import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { LANG_LABEL } from '../helpers'
import { BlogCoworkButton } from '../blog-cowork-button'

function charStatus(count: number, ideal: [number, number]): { label: string; cls: string } {
  if (count === 0) return { label: 'vazio', cls: '' }
  if (count < ideal[0]) return { label: 'curto', cls: '' }
  if (count <= ideal[1]) return { label: 'ideal', cls: 'ok' }
  return { label: 'pode truncar', cls: 'warn' }
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'crítico', high: 'alto', medium: 'médio', low: 'baixo',
}

function scoreTone(score: number): string {
  if (score >= 90) return 'ok'
  if (score >= 70) return 'warn'
  return 'bad'
}

export function StageSeo() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const audit = version.seoAudit
  const canEdit = state.editMode !== 'view'
  const titleStatus = charStatus(version.metaTitle.length, [40, 60])
  const descStatus = charStatus(version.metaDesc.length, [120, 160])

  const serpTitle = version.metaTitle || version.title || 'Sem título'
  const serpDesc = version.metaDesc || version.excerpt || 'Sem descrição'
  const serpUrl = `bythiagofigueiredo.com/blog/${lang}/${version.slug || '...'}`

  const useTitle = (t: string) => {
    dispatch({ type: 'SET_TITLE', title: t })
    toast.success('Título aplicado')
  }
  const useAsMeta = (t: string) => {
    dispatch({ type: 'SET_FIELD', field: 'metaTitle', value: t })
    toast.success('Meta título aplicado')
  }
  const applyMetaSuggestion = () => {
    if (!audit?.metaSuggestion) return
    dispatch({ type: 'SET_FIELD', field: 'metaTitle', value: audit.metaSuggestion.title })
    dispatch({ type: 'SET_FIELD', field: 'metaDesc', value: audit.metaSuggestion.description })
    toast.success('Meta título + descrição aplicados')
  }

  return (
    <div>
      <div className="doc-kicker">SEO · {LANG_LABEL[lang] ?? lang.toUpperCase()}</div>
      {version.title && <h2 className="doc-title-sm">{version.title}</h2>}

      {/* ---- Auditoria ---- */}
      <section className="seo-audit" data-testid="seo-audit">
        {audit ? (
          <>
            <div className="sa-head">
              <div className={`sa-score ${scoreTone(audit.score)}`}>
                <b>{Math.round(audit.score)}</b>
                <span className="sa-grade">{audit.grade}</span>
              </div>
              <div className="sa-meta">
                <div className="sa-kick">Auditoria SEO · {audit.phase === 'pre_publish' ? 'pré-publicação' : 'pós-publicação'}</div>
                <div className="sa-sub">
                  {audit.keyword ? <>keyword: <b>{audit.keyword}</b> · </> : null}
                  {audit.ranAt ? new Date(audit.ranAt).toLocaleString('pt-BR') : ''}
                </div>
              </div>
              {state.pipelineItemId && <BlogCoworkButton stage="seo" label="Rodar de novo" compact />}
            </div>
            {audit.issues.length > 0 && (
              <ul className="sa-issues">
                {audit.issues.map((iss, i) => (
                  <li key={i} className={`sa-issue sev-${iss.severity}`}>
                    <span className="sa-sev">{SEVERITY_LABEL[iss.severity] ?? iss.severity}</span>
                    <span className="sa-check">{iss.check}</span>
                    <span className="sa-msg">{iss.msg}</span>
                    {iss.fix && <span className="sa-fix">→ {iss.fix}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="sa-empty">
            <div className="sa-kick">Auditoria SEO</div>
            <p>Sem auditoria ainda. O Cowork roda o <span className="mono">seo_auditor.py</span> (15 checks: headings, meta, schema, keywords, legibilidade…) e traz a pontuação pra cá.</p>
            {state.pipelineItemId
              ? <BlogCoworkButton stage="seo" label="Rodar auditoria SEO" />
              : <p className="sa-sub">Este post não tem item de pipeline linkado — link no Inspector pra habilitar.</p>}
          </div>
        )}
      </section>

      {/* ---- Sugestões de título ---- */}
      {audit && audit.titleSuggestions.length > 0 && (
        <section className="seo-suggestions" data-testid="seo-suggestions">
          <div className="doc-kicker">Títulos sugeridos</div>
          <ul className="ss-list">
            {audit.titleSuggestions.map((s, i) => (
              <li key={i} className="ss-item">
                <div className="ss-title">{s.title}</div>
                {s.rationale && <div className="ss-why">{s.rationale}</div>}
                <div className="ss-actions">
                  <button type="button" className="ss-use" disabled={!canEdit} onClick={() => useTitle(s.title)}>
                    <Check size={12} /> Usar como título
                  </button>
                  <button type="button" className="ss-use alt" disabled={!canEdit} onClick={() => useAsMeta(s.title)}>
                    Usar como meta título
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {audit?.metaSuggestion && (
        <button type="button" className="ss-use" style={{ marginTop: 10 }} disabled={!canEdit} onClick={applyMetaSuggestion}>
          <Check size={12} /> Aplicar meta título + descrição sugeridos
        </button>
      )}

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
          readOnly={!canEdit}
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
          readOnly={!canEdit}
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
