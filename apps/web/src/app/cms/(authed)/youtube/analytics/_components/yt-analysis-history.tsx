'use client'

import { useEffect, useState } from 'react'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'
import { brDec, fmtRelative } from '@/lib/youtube/format'
import {
  seriesTimelines,
  type HistoryEntry,
  type HistorySeries,
} from '@/lib/youtube/analysis-history'

const DMHM = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})
const DMY = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
})
const DM = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/** "23/09 07:30" — Intl puts a comma between date and time in pt-BR; the column has no room. */
function dateTime(iso: string): string {
  return DMHM.format(new Date(iso)).replace(',', '')
}

/** The forja rounds half-up to 2 places for its verdict; the float nudge keeps 0,505 → 0,51. */
export function formatRazao(r: number): string {
  return `${brDec(Math.round((r + Number.EPSILON) * 100) / 100, 2)}×`
}

function formatMediana(m: number): string {
  return Number.isInteger(m) ? String(m) : brDec(m, 1)
}

function years(s: HistorySeries): string {
  if (!s.anos) return ''
  return s.anos.de === s.anos.ate ? ` · ${s.anos.de}` : ` · ${s.anos.de}–${s.anos.ate}`
}

/** What the series reading means, in words. The forja's symbols are the source of truth. */
export function readingText(s: HistorySeries): string {
  if (s.leitura === 'abaixo') return 'abaixo da coorte'
  if (s.leitura === 'acima') return 'acima da coorte'
  if (s.leitura === 'neutra') return 'perto da coorte, sem efeito'
  switch (s.motivo) {
    case 'coorte_fina':
      return s.nCoorte === 0 && s.ano !== null
        ? `sem coorte: nenhum outro vídeo maduro de ${s.ano} fora da série`
        : `coorte pequena demais para comparar${s.nCoorte !== null ? ` (${s.nCoorte})` : ''}`
    case 'coorte_sem_views': return 'a coorte não tem views importadas'
    case 'serie_sem_views': return 'a série não tem views importadas'
    case 'mediana_zero': return 'mediana zero: a razão não diz nada'
    default: return 'sem veredito'
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function forjaMeta(e: HistoryEntry): string {
  if (e.legacyForja) return 'sem séries: o mapa de séries ainda não existia'
  const com = e.series.filter(s => s.comVeredito).length
  const exam = e.series.length - com
  const parts: string[] = []
  parts.push(com === 0 ? 'nenhuma série com efeito' : plural(com, 'série com efeito', 'séries com efeito'))
  if (exam > 0) parts.push(plural(exam, 'examinada sem veredito', 'examinadas sem veredito'))
  if (e.summarySource === 'template') parts.push('texto do template')
  return parts.join(' · ')
}

interface Props {
  entries: HistoryEntry[]
}

export function YtAnalysisHistory({ entries }: Props) {
  // Relative labels ("há 40 min") depend on the viewer's clock: rendered after mount only,
  // so the server HTML and the first client render agree.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (entries.length === 0) return null
  const oldest = entries[entries.length - 1]!
  // The cards above come from the newest analysis with priorities (fetchChannelCoaching).
  const cardsId = entries.find(e => e.priorities.length > 0)?.id ?? null
  const timelines = seriesTimelines(entries)

  return (
    <>
      <section className="hist" aria-labelledby="h-hist">
        <div className="hist-cab">
          <h3 id="h-hist">Histórico de diagnósticos</h3>
          <span>{entries.length} · desde {DMY.format(new Date(oldest.generatedAt))}</span>
        </div>
        <ol>
          {entries.map((e, i) => (
            <li key={e.id}>
              <details className="hist-it" data-src={e.source} open={i === 0}>
                <summary>
                  <span className="hist-mk" aria-hidden="true" />
                  <span className="hist-qd">
                    {dateTime(e.generatedAt)}
                    <small>{mounted ? fmtRelative(e.generatedAt) : ' '}</small>
                  </span>
                  <span className="hist-col">
                    <span className="hist-res">
                      <span className="hist-src">{e.source === 'forja' ? 'forja' : 'Cowork'}</span>
                      {e.summary || 'Sem resumo.'}
                    </span>
                    <span className="hist-meta">
                      {e.source === 'forja'
                        ? forjaMeta(e)
                        : [
                            plural(e.priorities.length, 'recomendação', 'recomendações'),
                            plural(e.findingCount, 'padrão', 'padrões'),
                            e.id === cardsId && i > 0 ? 'os cards acima vêm daqui' : null,
                          ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span>
                    {i === 0 && <span className="hist-agora">EM EXIBIÇÃO</span>}{' '}
                    <span className="hist-seta" aria-hidden="true">›</span>
                  </span>
                </summary>
                <div className="hist-corpo">
                  {e.series.length > 0 && (
                    <table className="hist-tb">
                      <thead>
                        <tr>
                          <th scope="col">Série</th>
                          <th scope="col" className="n">Ep.</th>
                          <th scope="col" className="n">Mediana</th>
                          <th scope="col" className="n">Coorte</th>
                          <th scope="col" className="n">Razão</th>
                          <th scope="col">Leitura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.series.map(s => (
                          <tr key={s.serie}>
                            <td>&ldquo;{s.nome}&rdquo;{years(s)}</td>
                            <td className="n">{s.n ?? '—'}</td>
                            <td className="n">{s.mediana !== null ? formatMediana(s.mediana) : '—'}</td>
                            <td className="n">{s.medianaCoorte !== null ? formatMediana(s.medianaCoorte) : '—'}</td>
                            <td className="n">{s.razao !== null ? formatRazao(s.razao) : '—'}</td>
                            <td className={`ld-${s.leitura ?? 'sem_coorte'}`}>{readingText(s)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {e.source === 'cowork' && e.priorities.length > 0 && (
                    <ul className="hist-rec">
                      {e.priorities.map(p => (
                        <li key={p.axis}><b>{AXIS_LABELS[p.axis]}</b><span>{p.action}</span></li>
                      ))}
                    </ul>
                  )}
                  {e.summarySource === 'template' && (
                    <p className="hist-aviso">
                      Texto do template: o Gemma reprovou nas duas tentativas e entrou o texto fixo.
                    </p>
                  )}
                  {e.legacyForja && (
                    <p className="hist-aviso">
                      Esta análise rodou antes do mapa de séries e contava os vídeos ocultos. Os números
                      não são comparáveis com os das análises seguintes.
                    </p>
                  )}
                  {e.source === 'forja' && !e.legacyForja && e.series.length === 0 && e.summarySource !== 'template' && (
                    <p className="hist-aviso">Nenhuma série examinada nesta análise.</p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>

      {timelines.map(t => (
        <section key={t.serie} className="hist" style={{ padding: '14px 18px' }} aria-label={`${t.nome} ao longo do tempo`}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>&ldquo;{t.nome}&rdquo; ao longo do tempo</div>
          <div className="hist-trilha">
            {t.points.map(p => (
              <span key={p.generatedAt} className="pt">
                {formatRazao(p.razao)}
                <small>{DM.format(new Date(p.generatedAt))} · {p.leitura === 'neutra' ? 'sem efeito' : p.leitura ?? '—'}</small>
              </span>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
