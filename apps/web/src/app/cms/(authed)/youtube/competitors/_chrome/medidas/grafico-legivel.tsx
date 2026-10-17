'use client'
/**
 * E5a Tarefa 14c: a casca de gráfico legível que a página do canal (Linha do tempo, 72 horas, Lançamentos) e a do vídeo dividem.
 * O desenho é SVG e entra como `children` (`aria-hidden`); tudo o que ele diz existe como TEXTO nos `pontos` (`rotulo` e `fala`, já prontos).
 * Nenhum componente passa como prop (Next 16): o SVG é elemento pronto, a legenda também. Não lê banco nem relógio.
 * Teclado: UMA parada de Tab no grupo; setas, Início e Fim percorrem os pontos; Esc limpa. Os botões "Ponto anterior" e "Ponto seguinte"
 * (44 px) e a linha de leitura (`aria-live="polite"`) ficam logo abaixo do gráfico, a legenda depois, e "Ver como tabela" traz todos os pontos.
 * O mouse aponta o ponto sob ele (elemento com `data-i` dentro do SVG); a frase "Toque…" ou "Passe o mouse…" é escolhida no CSS por `pointer: coarse`.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Icon } from '../icons'
import './graficos.css'

export interface PontoLegivel { rotulo: string; fala: string }
export interface TabelaLegivel { cabecalho: string[]; linhas: string[][] }

const entre = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

export function GraficoLegivel({ titulo, pontos, tabela, legenda, children }: {
  titulo: string
  pontos: PontoLegivel[]
  /** Padrão: duas colunas (ponto e leitura), uma linha por ponto. */
  tabela?: TabelaLegivel
  legenda?: ReactNode
  children: ReactNode
}) {
  const n = pontos.length
  const id = useId()
  const [ativo, setAtivo] = useState(-1)
  const caixa = useRef<HTMLDivElement>(null)
  // a lista de pontos mudou (outro vídeo, outra janela): o ponto escolhido não vale mais
  const assinatura = pontos.map((p) => p.rotulo).join('|')
  const [assinada, setAssinada] = useState(assinatura)
  if (assinada !== assinatura) { setAssinada(assinatura); setAtivo(-1) }
  const i = ativo >= 0 && ativo < n ? ativo : -1

  // o ponto lido ganha a marca no SVG (que é só desenho): o elemento com `data-i` igual ao índice
  useEffect(() => {
    const raiz = caixa.current
    if (!raiz) return
    raiz.querySelectorAll('.gl-on').forEach((e) => e.classList.remove('gl-on'))
    if (i >= 0) raiz.querySelectorAll(`[data-i="${i}"]`).forEach((e) => e.classList.add('gl-on'))
  }, [i, children])

  if (n === 0) {
    // sem pontos: nada de botões nem de tabela vazia
    return (
      <div className="gl">
        <div className="gl-sc" aria-hidden="true">{children}</div>
        {legenda ? <div className="gl-leg">{legenda}</div> : null}
      </div>
    )
  }

  const indiceDe = (alvo: EventTarget): number => {
    if (!(alvo instanceof Element)) return -1
    const h = alvo.closest('[data-i]')
    const k = h ? Number(h.getAttribute('data-i')) : -1
    return Number.isInteger(k) && k >= 0 && k < n ? k : -1
  }
  const ir = (k: number): void => setAtivo(entre(k, 0, n - 1))
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    switch (e.key) {
      case 'ArrowLeft': ir(i < 0 ? n - 1 : i - 1); break
      case 'ArrowRight': ir(i < 0 ? 0 : i + 1); break
      case 'Home': ir(0); break
      case 'End': ir(n - 1); break
      case 'Escape': if (i < 0) return; setAtivo(-1); break
      default: return
    }
    e.preventDefault()
  }
  const onPointer = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.type === 'pointermove' && e.pointerType === 'touch') return // o dedo que rola a página não escolhe ponto
    const k = indiceDe(e.target)
    if (k >= 0) setAtivo(k)
  }
  const noPrimeiro = i === 0, noUltimo = i === n - 1
  const tab: TabelaLegivel = tabela ?? { cabecalho: ['Ponto', 'Leitura'], linhas: pontos.map((p) => [p.rotulo, p.fala]) }

  return (
    <div className="gl">
      <div className="gl-sc">
        <div
          ref={caixa} className="gl-grupo" role="group" tabIndex={0}
          aria-label={`${titulo}: ${n} ${n === 1 ? 'ponto' : 'pontos'}. As setas andam de ponto em ponto.`}
          onKeyDown={onKeyDown} onPointerMove={onPointer} onPointerDown={onPointer}
        >
          <div aria-hidden="true">{children}</div>
        </div>
      </div>
      <div className="gl-step">
        <button type="button" aria-label="Ponto anterior" aria-disabled={noPrimeiro} onClick={() => { if (!noPrimeiro) ir(i < 0 ? n - 1 : i - 1) }}>{Icon.prev()}</button>
        <p className={'gl-out' + (i < 0 ? ' vazio' : '')} role="status" aria-live="polite" aria-atomic="true">
          {i >= 0 ? <span>{pontos[i]!.fala}</span> : (
            <>
              <span className="gl-dica-m">Passe o mouse sobre o gráfico ou use as setas para ler um ponto.</span>
              <span className="gl-dica-t">Toque no gráfico ou use os botões para ler um ponto de cada vez.</span>
            </>
          )}
        </p>
        <button type="button" aria-label="Ponto seguinte" aria-disabled={noUltimo} onClick={() => { if (!noUltimo) ir(i < 0 ? 0 : i + 1) }}>{Icon.next()}</button>
      </div>
      {legenda ? <div className="gl-leg">{legenda}</div> : null}
      <details className="gl-tab">
        <summary>Ver como tabela</summary>
        <div className="gl-tw" role="region" tabIndex={0} aria-label={`${titulo}, tabela`}>
          <table>
            <thead><tr>{tab.cabecalho.map((c, k) => <th key={`${id}c${k}`} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {tab.linhas.map((l, r) => (
                <tr key={`${id}r${r}`}>{l.map((c, k) => (k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
