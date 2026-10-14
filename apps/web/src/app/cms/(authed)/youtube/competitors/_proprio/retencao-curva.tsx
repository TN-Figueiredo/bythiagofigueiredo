'use client'
/**
 * O gráfico da curva de retenção do vídeo próprio (A5 E8, Tarefa 13; mockup 6, `a4-comum.js` `A.curva`): a parte do público que ainda assiste em cada
 * ponto do vídeo. Recebe o desenho JÁ montado (`CurvaDesenho`, de `retencao-curva-model.ts`): não lê banco, não decide estado e não inventa ponto
 * (não interpola, não preenche, não liga o que falta). Cada ponto vai onde o seu `t` manda: numa curva incompleta o desenho acaba onde os pontos acabam.
 *
 * Grade em 0, 50 e 100%; o desenho é cortado em 120% (`TETO_DO_DESENHO`); eixo do tempo em 0, 25, 50, 75 e 100% da duração; linha vertical tracejada onde
 * metade já saiu; triângulo no início de cada maior saída; faixa em cada trecho revisto. O SVG é desenhado na largura em que aparece (o texto fica em
 * 12 px, sem encolher) e é `role="img"`: o `aria-label` é a frase principal, e a lista de saídas e trechos vem como texto ao lado. A cor vem dos tokens
 * (`--lado-o` para a curva, `--terco-baixo` nas saídas): nenhum `color-mix`.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TETO_DO_DESENHO, type CurvaDesenho } from './retencao-curva-model'
import './retencao-curva.css'

/** Largura de partida: a do servidor e do primeiro render do cliente (hidratação idêntica). Depois da montagem vale a medida. */
const LARGURA_PADRAO = 720
const MIN_W = 300
const MAX_W = 860
const ESTREITO = 520
const L = 40, R = 10, T = 14, B = 40
/** Largura que o rótulo "metade já saiu aqui" ocupa a 12 px (com folga): perto da borda direita ele passa para o lado esquerdo da linha. */
const ROTULO_PX = 140

const entre = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
const f1 = (n: number): string => n.toFixed(1)

export function RetencaoCurva({ curva }: { curva: CurvaDesenho }) {
  const raiz = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(0)
  const medir = useCallback(() => { setCw(Math.round(raiz.current?.clientWidth ?? 0)) }, [])
  useLayoutEffect(() => { medir() }, [medir])
  useEffect(() => {
    const el = raiz.current
    const ro = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(medir)
    if (ro && el) ro.observe(el)
    return () => ro?.disconnect()
  }, [medir])

  const W = entre(cw > 0 ? cw : LARGURA_PADRAO, MIN_W, MAX_W)
  const H = W < ESTREITO ? 200 : 240
  const PW = W - L - R, PH = H - T - B
  const X = (t: number): number => L + PW * t
  const Y = (v: number): number => T + PH * (1 - Math.min(v, TETO_DO_DESENHO) / TETO_DO_DESENHO)

  const pontos = curva.pontos
  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${f1(X(p.t))} ${f1(Y(p.ratio))}`).join('')
  const primeiro = pontos[0]!, ultimo = pontos[pontos.length - 1]!
  const area = `${d}L${f1(X(ultimo.t))} ${f1(Y(0))}L${f1(X(primeiro.t))} ${f1(Y(0))}Z`
  const meioX = curva.meioT != null ? X(curva.meioT) : null
  const rotuloNaEsquerda = meioX != null && meioX + 6 + ROTULO_PX > W - R

  return (
    <div className="rc" ref={raiz}>
      <svg className="rc-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={curva.alt}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line className="rc-grade" x1={L} x2={W - R} y1={Y(f)} y2={Y(f)} />
            <text className="rc-gy" x={L - 6} y={Y(f) + 4} textAnchor="end">{Math.round(f * 100)}%</text>
          </g>
        ))}
        <path className="rc-area" d={area} />
        {curva.revistos.map((r, i) => (
          <rect key={i} className="rc-revisto" x={X(r.de)} y={T} width={Math.max(2, X(r.ate) - X(r.de))} height={PH} />
        ))}
        <path className="rc-linha" d={d} />
        {meioX != null ? (
          <g>
            <line className="rc-meio" x1={meioX} x2={meioX} y1={T} y2={T + PH} />
            <text className="rc-rotulo" x={rotuloNaEsquerda ? meioX - 6 : meioX + 6} y={T + 14} textAnchor={rotuloNaEsquerda ? 'end' : 'start'}>metade já saiu aqui</text>
          </g>
        ) : null}
        {curva.saidas.map((s, i) => (
          <polygon key={i} className="rc-saida" points={`${f1(X(s.t) - 6)},${T + PH + 12} ${f1(X(s.t) + 6)},${T + PH + 12} ${f1(X(s.t))},${T + PH + 3}`} />
        ))}
        {curva.eixo.map((rotulo, k) => (
          <text key={k} className="rc-gx" x={L + PW * (k / 4)} y={H - 4} textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{rotulo}</text>
        ))}
      </svg>
      <div className="rc-leg">
        <span><i className="rc-lg-l" aria-hidden="true" />parte do público que ainda assiste</span>
        {curva.legenda.revistos ? <span><i className="rc-lg-re" aria-hidden="true" />trecho revisto (muita gente voltou)</span> : null}
        {curva.legenda.saidas ? <span><i className="rc-lg-sa" aria-hidden="true" />maior saída</span> : null}
        {curva.legenda.pico ? <span>{curva.legenda.pico}</span> : null}
      </div>
    </div>
  )
}
