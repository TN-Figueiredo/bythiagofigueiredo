'use client'
/**
 * "Remover <canal>?": says how much history the removal deletes (R118 / mockup 2026-10-06). The count is asked when the
 * dialog opens; the four rows exist from the start and the box reserves the height of its tallest state, so it never changes size and
 * "Remover canal" never moves. A failed count never shows zeros: it says it could not count, and removing stays available.
 */
import { useEffect, useState, type KeyboardEvent } from 'react'
import type { CompetitorRemovalImpact } from '@/lib/youtube/competitor-removal-impact'
import { PinIcon } from '../_chrome/pin-kit'

export type ImpactAnswer = { ok: true; impact: CompetitorRemovalImpact } | { ok: false }
/** No count after this long is "could not count". */
const COUNT_TIMEOUT_MS = 10_000
type Key = 'versions' | 'dailyDays' | 'pinned' | 'bookmarks'
const ROWS: Array<{ k: Key; one: string; many: string; none: string; sub: (m: CompetitorRemovalImpact | null) => string }> = [
  { k: 'versions', one: 'versão guardada', many: 'versões guardadas', none: 'nenhuma', sub: m => (m ? 'títulos, thumbnails e descrições de ' + m.videos + (m.videos === 1 ? ' vídeo' : ' vídeos') : 'títulos, thumbnails e descrições dos vídeos') },
  { k: 'dailyDays', one: 'dia de registros', many: 'dias de registros', none: 'nenhum', sub: () => 'views diárias dos vídeos' },
  { k: 'pinned', one: 'vídeo fixado', many: 'vídeos fixados', none: 'nenhum', sub: () => 'apagados com o canal; se ele voltar, é preciso fixar de novo' },
  { k: 'bookmarks', one: 'troca salva no swipe file', many: 'trocas salvas no swipe file', none: 'nenhuma', sub: () => 'saem do swipe file junto com o canal' },
]
const int = (n: number) => n.toLocaleString('pt-BR')
/** The longest the explanation of the first row gets (a five-digit video count): what the sizer reserves room for. */
const SIZER_SUB = 'títulos, thumbnails e descrições de 00.000 vídeos'

export function RemoveDialog({ id, name, onImpact, onCancel, onConfirm, trap }: {
  id: string; name: string
  /** Server action getCompetitorRemovalImpactAction, by props. Absent = the count cannot be asked. */
  onImpact?: (id: string) => Promise<ImpactAnswer>
  onCancel: () => void; onConfirm: () => void; trap: (e: KeyboardEvent<HTMLDivElement>) => void
}) {
  const [phase, setPhase] = useState<'counting' | 'counted' | 'failed'>('counting')
  const [impact, setImpact] = useState<CompetitorRemovalImpact | null>(null)
  useEffect(() => {
    let live = true
    const fail = () => { if (live) setPhase(p => (p === 'counting' ? 'failed' : p)) }
    const timer = setTimeout(fail, COUNT_TIMEOUT_MS)
    if (!onImpact) { fail(); return () => { live = false; clearTimeout(timer) } }
    onImpact(id).then(r => { if (!live) return; if (r.ok) { setImpact(r.impact); setPhase(p => (p === 'counting' ? 'counted' : p)) } else fail() }).catch(fail)
    return () => { live = false; clearTimeout(timer) }
  }, [id, onImpact])

  const counting = phase === 'counting'
  const said = counting ? 'Contando o que será apagado. Remover canal fica disponível quando a contagem chegar.'
    : phase === 'failed' ? 'Não foi possível contar o que será apagado. Remover canal continua disponível.'
      : 'Contagem pronta: ' + ROWS.map(r => { const n = impact![r.k]; return n === 0 ? r.none + ' ' + r.one : int(n) + ' ' + (n === 1 ? r.one : r.many) }).join(', ') + '.'
  return (
    // no onClick on the backdrop: a destructive dialog closes only by Cancelar or Esc
    <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="cn-cfT" aria-describedby="cn-cfLead" onKeyDown={trap}>
      <div className="box fx-remove">
        <h2 id="cn-cfT">Remover {name}?</h2>
        {/* V3: the sizer is the tallest state (counting: every row with its plural and its explanation), invisible and in the
            same grid cell as what is shown. The box is as tall as the taller of the two at ANY width, so neither the count
            arriving nor a failed one resizes it, and "Remover canal" keeps its rectangle. No pixel value to keep in sync. */}
        <div className="fx-loss-box">
          <div className="fx-sizer" aria-hidden="true">
            <p className="fx-never">Remover apaga todo o histórico deste canal:</p>
            <ul className="fx-lossz">
              {ROWS.map(r => <li key={r.k}><b className="fx-wait">contando…</b><span>{r.many}<span>{r.k === 'versions' ? SIZER_SUB : r.sub(null)}</span></span></li>)}
            </ul>
          </div>
          {phase === 'failed' ? (
            <div className="fx-shown">
              <p className="fx-never" id="cn-cfLead">Remover apaga todo o histórico deste canal: os vídeos, as versões de título, thumbnail e descrição, os registros diários de views, os vídeos fixados e as trocas salvas no swipe file.</p>
              <p className="fx-msg fx-err"><PinIcon name="err" /><span>Não foi possível contar o que será apagado. A remoção continua disponível e apaga tudo o que está descrito acima.</span></p>
            </div>
          ) : (
            <div className="fx-shown">
              <p className="fx-never" id="cn-cfLead">Remover apaga todo o histórico deste canal:</p>
              <ul className="fx-loss" aria-busy={counting ? true : undefined}>
                {ROWS.map(r => {
                  const n = impact ? impact[r.k] : null
                  return (
                    <li key={r.k}>
                      <b className={n == null || n === 0 ? 'fx-wait' : undefined}>{n == null ? 'contando…' : n === 0 ? r.none : int(n)}</b>
                      <span>{n === 1 || n === 0 ? r.one : r.many}{n === 0 ? null : <span>{r.sub(impact)}</span>}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        <p>Também saem as leituras da forja feitas para vídeos deste canal e o histórico de inscritos dele. O canal deixa o observatório e para de sincronizar.</p>
        <p className="fx-never">Não dá para desfazer: se você adicionar o canal de novo, a coleta recomeça do zero e este histórico não volta.</p>
        <div className="sr" role="status" id="cn-cfStatus">{said}</div>
        <div className="acts">
          <button type="button" className="btn" autoFocus onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn danger" aria-disabled={counting ? true : undefined} aria-describedby={counting ? 'cn-cfStatus' : undefined}
            onClick={() => { if (!counting) onConfirm() }}>Remover canal</button>
        </div>
      </div>
    </div>
  )
}
