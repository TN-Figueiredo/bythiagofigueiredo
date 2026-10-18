'use client'
/**
 * Os três cartões de "% assistido por período" (plano E5b, Tarefa 15; mockup B). Recebe o modelo JÁ montado (`buildAssistidoPeriodos`): só texto e números
 * prontos, nada de banco e nenhum leitor. Os cartões são um `radiogroup` (um só no Tab, setas movem e escolhem) e mostram um conteúdo por vez; a troca não
 * navega. O período nasce de `?assistido=` e, sem ele, do `localStorage` (`obs-proprio-assistido-periodo`, sempre em try/catch); o servidor e o primeiro render
 * do cliente concordam no padrão (canal inteiro) e a lembrança entra depois, em layout effect. O valor salvo que não existe é ignorado.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { PastilhaAusencia } from '../_chrome/ausencia/pastilhas'
import { BarraAssistido } from './barra-assistido'
import type { BlocoAssistido } from './video-blocos-model'
import { CHAVE_ASSISTIDO, PERIODOS_ASSISTIDO, type AssistidoPeriodosView, type CelulaFaixa, type ConteudoAssistido, type Seta } from './assistido-periodo-model'
import type { PeriodoAssistido } from '@/lib/youtube/observatorio/proprio/assistido-periodo'
import './assistido-periodo.css'

const valido = (x: string | null | undefined): x is PeriodoAssistido => x != null && (PERIODOS_ASSISTIDO as readonly string[]).includes(x)

const ROTULO_DA_MARCA: Record<PeriodoAssistido, string> = { inteiro: 'canal inteiro', '90': '90 dias', '28': '28 dias' }

function lembrado(): PeriodoAssistido | null {
  try {
    const x = window.localStorage.getItem(CHAVE_ASSISTIDO)
    return valido(x) ? x : null
  } catch { return null }
}

function guardar(p: PeriodoAssistido): void {
  try {
    if (p === 'inteiro') window.localStorage.removeItem(CHAVE_ASSISTIDO)
    else window.localStorage.setItem(CHAVE_ASSISTIDO, p)
  } catch { /* sem armazenamento a tela fica no padrão */ }
}

function SetaView({ s }: { s: Seta }) {
  // sinal e símbolo juntos; a palavra vai para o leitor de tela, a cor só reforça
  return <span className={'ap-cmp ' + (s.leitura === 'acima' ? 'up' : s.leitura === 'abaixo' ? 'dn' : 'eq')}><span className="pt">{s.texto}</span><span className="obs-ch-sr"> ({s.palavra})</span></span>
}

function Negrito({ texto, negrito }: { texto: string; negrito: readonly string[] }) {
  if (negrito.length === 0) return <>{texto}</>
  const partes: ReactNode[] = []
  let resto = texto
  let k = 0
  for (const n of negrito) {
    const i = resto.indexOf(n)
    if (i < 0) continue
    if (i > 0) partes.push(resto.slice(0, i))
    partes.push(<b key={k++} className="num">{n}</b>)
    resto = resto.slice(i + n.length)
  }
  partes.push(resto)
  return <>{partes}</>
}

/** Decisão 75: o cartão sem número escolhe a forma pelo `ausencia` (restrito / falhou), nunca pela palavra; o resto segue a hachura com a palavra do motivo. */
function Sem({ c }: { c: CelulaFaixa }) {
  return c.ausencia === 'falhou' || c.ausencia === 'restrito' ? <PastilhaAusencia estado={c.ausencia} /> : <span className="obs-ch-nm">{c.semNumero}</span>
}

function Celula({ c }: { c: CelulaFaixa }) {
  if (c.estado === 'sem-numero') return <><Sem c={c} /><span className="ap-vw mut">{c.legenda}</span></>
  return <><b className="num">{c.valor}</b>{c.seta ? <> <SetaView s={c.seta} /></> : null}<span className="ap-vw mut num">{c.legenda}</span></>
}

function Conteudo({ c, selecionado, rotulos, aoVerInteiro }: { c: ConteudoAssistido; selecionado: PeriodoAssistido; rotulos: Record<PeriodoAssistido, string>; aoVerInteiro: () => void }) {
  return (
    <>
      {c.frase ? (
        <p className={'ap-fr ' + (c.frase.leitura === 'acima' ? 'up' : c.frase.leitura === 'abaixo' ? 'dn' : c.frase.leitura === 'na-media' ? 'eq' : '')}>
          <span className="ap-sim" aria-hidden="true">{c.frase.sinal}</span>
          <span><Negrito texto={c.frase.texto} negrito={c.frase.negrito} />{c.frase.verInteiro ? <> <button type="button" className="ap-lk" onClick={aoVerInteiro}>Ver contra o canal inteiro</button></> : null}</span>
        </p>
      ) : null}
      {c.tabela ? (
        <div className="ap-tbw" tabIndex={0} role="region" aria-label="Normal de % assistido por faixa de duração e por período">
          <table className="ap-tab">
            <caption className="obs-ch-sr">Normal de % assistido por faixa de duração e por período</caption>
            <thead><tr><th scope="col">Faixa de duração</th>{PERIODOS_ASSISTIDO.map(p => <th key={p} scope="col" className={p === selecionado ? 'ap-col' : undefined}>{rotulos[p]}</th>)}</tr></thead>
            <tbody>
              {c.tabela.map(l => (
                <tr key={l.rotulo}>
                  <th scope="row">{l.rotulo}</th>
                  {PERIODOS_ASSISTIDO.map(p => <td key={p} className={p === selecionado ? 'ap-col' : undefined}><Celula c={l.celulas[p]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}

/** `barra` = a barra do % assistido do vídeo (tela B): a marca do "normal" é a do período escolhido (`normalNaBarra`), por isso a barra mora aqui. */
export function AssistidoPeriodos({ view, barra }: { view: AssistidoPeriodosView; barra?: BlocoAssistido | null }) {
  const params = useSearchParams()
  const doUrl = params?.get('assistido') ?? null
  const idBase = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const popId = 'ap' + idBase
  const btn = useRef<HTMLButtonElement>(null)
  const refs = useRef<Array<HTMLDivElement | null>>([])
  const [info, setInfo] = useState(false)
  const [periodo, setPeriodo] = useState<PeriodoAssistido>(valido(doUrl) ? doUrl : view.padrao)
  const [salvo, setSalvo] = useState(false)

  // ?assistido= vence; sem ele, o que ficou neste navegador (só depois do primeiro render, para o servidor e o cliente concordarem)
  useLayoutEffect(() => {
    if (valido(doUrl)) { setPeriodo(doUrl); return }
    const l = lembrado()
    if (l != null) { setPeriodo(l); setSalvo(l !== view.padrao) }
  }, [doUrl, view.padrao])

  if (view.vazio != null) return <>{barra ? <BarraAssistido a={barra} normal={null} /> : null}<p className="ap-vazio" role={view.estado === 'erro' ? 'alert' : undefined}>{view.vazioEstado === 'falhou' || view.vazioEstado === 'restrito' ? <><PastilhaAusencia estado={view.vazioEstado} />{' '}</> : null}{view.vazio}</p></>

  const escolher = (p: PeriodoAssistido) => { setPeriodo(p); setSalvo(p !== view.padrao); guardar(p) }
  const tecla = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const n = PERIODOS_ASSISTIDO.length
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (passo === 0) return
    e.preventDefault()
    const j = (i + passo + n) % n
    escolher(PERIODOS_ASSISTIDO[j] as PeriodoAssistido)
    refs.current[j]?.focus()
  }
  const rotulos = Object.fromEntries(view.cartoes.map(c => [c.id, c.rotulo])) as Record<PeriodoAssistido, string>
  const labId = 'apl' + idBase

  return (
    <div className="ap">
      {barra ? <BarraAssistido a={barra} normal={view.conteudos[periodo].normalNaBarra} rotuloPeriodo={ROTULO_DA_MARCA[periodo]} /> : null}
      <p className="ap-lab" id={labId}>
        {view.rotuloGrupo}:
        <button ref={btn} type="button" className="ap-info" aria-label="Como o período é contado" aria-expanded={info} aria-controls={popId} onClick={() => setInfo(o => !o)}>{Icon.info()}</button>
      </p>
      <Popover open={info} anchor={() => btn.current} onClose={() => setInfo(false)} id={popId} role="dialog" labelledBy={popId + 't'} className="ic-pop" pref="baixo" align="fim" maxW={380}>
        <h3 id={popId + 't'}>Como o período é contado</h3>
        <ul>{view.metodo.map(p => <li key={p}>{p}</li>)}</ul>
      </Popover>
      <div className="ap-cs" role="radiogroup" aria-labelledby={labId}>
        {view.cartoes.map((c, i) => {
          const ativo = c.id === periodo
          return (
            <div
              key={c.id} ref={el => { refs.current[i] = el }} role="radio" aria-checked={ativo} aria-label={c.aria} tabIndex={ativo ? 0 : -1}
              className={'ap-c' + (ativo ? ' on' : '') + (c.estado === 'sem-numero' ? ' sem' : '')} data-periodo={c.id}
              onClick={() => escolher(c.id)} onKeyDown={e => tecla(e, i)}
            >
              <span className="ap-t"><span className="l">{c.rotulo}</span><span className="s">{c.curto}</span></span>
              {c.estado === 'medido'
                ? <span className="ap-v"><b className="num">{c.valor}</b>{c.seta ? <> <SetaView s={c.seta} /></> : null}</span>
                : <span className="ap-v"><Sem c={c} /></span>}
              <span className="ap-s">{c.legenda}</span>
            </div>
          )
        })}
      </div>
      <p className="ap-leg" aria-hidden="true"><span className="ap-cmp up"><span className="pt">▲</span></span><span className="ap-cmp dn"><span className="pt">▼</span></span><span className="ap-cmp eq"><span className="pt">＝</span></span>{view.legenda}</p>
      {salvo && periodo !== view.padrao ? (
        <p className="ap-lem">{view.lembranca} · <button type="button" className="ap-lk" onClick={() => escolher(view.padrao)}>{view.voltar}</button></p>
      ) : null}
      <div className="ap-conteudo" aria-live="polite">
        <Conteudo c={view.conteudos[periodo]} selecionado={periodo} rotulos={rotulos} aoVerInteiro={() => escolher('inteiro')} />
      </div>
    </div>
  )
}
