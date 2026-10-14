'use client'
/**
 * O gráfico da curva de retenção do vídeo próprio (A5 E8, Tarefa 13; mockup 6, `a4-comum.js` `A.curva`): a parte do público que ainda assiste em cada
 * ponto do vídeo. Recebe o desenho JÁ montado (`CurvaDesenho`, de `retencao-curva-model.ts`): não lê banco, não decide estado e não inventa ponto
 * (não interpola, não preenche, não liga o que falta). Cada ponto vai onde o seu `t` manda: numa curva incompleta o desenho acaba onde os pontos acabam.
 *
 * Grade em 0, 50 e 100%; o desenho é cortado em 120% (`TETO_DO_DESENHO`); eixo do tempo em 0, 25, 50, 75 e 100% da duração (em tela estreita ou vídeo longo,
 * só 0, 50 e 100%: os rótulos nunca se sobrepõem); linha vertical tracejada onde metade já saiu; triângulo no início de cada maior saída; faixa em cada trecho
 * revisto; curva incompleta: o que vem depois do último ponto é hachura de "não medido" (ausência desenhada), com marca no último ponto. O SVG é desenhado na
 * largura real em que aparece (viewBox = largura: o texto fica em 12 px, nunca encolhe) e é `role="img"`: o `aria-label` é a frase principal, e a lista de
 * saídas e trechos vem como texto ao lado. A altura é reservada pelo CSS (200 px, 240 px a partir de 520 px), então a seção nasce com a altura final e o
 * desenho só aparece depois de medido (`rc-prep`). A cor vem dos tokens (`--lado-o` para a curva, `--dir-dn` nas saídas, `--dim` no que precisa de 3:1,
 * `--nm`/`--nm-bg` na ausência): nenhum `color-mix`.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { TETO_DO_DESENHO, type CurvaDesenho } from './retencao-curva-model'
import './retencao-curva.css'

/** Largura de partida: a do servidor e do primeiro render do cliente (hidratação idêntica). Depois da montagem vale a medida. */
const LARGURA_PADRAO = 720
/** Abaixo disto o cartão nem cabe (dobrável fechado, 280 px): o SVG nunca é maior que o cartão, então o texto nunca encolhe. */
const MIN_W = 200
const MAX_W = 860
const ESTREITO = 520
const L = 40, R = 10, T = 14, B = 40
/** Larguras a 12 px: JetBrains Mono (eixo) = 7,2 px por caractere; o texto sem monoespaço dos rótulos, medido, ~5,8 px por caractere (aqui 6, com folga). */
const MONO_PX = 7.2
const SANS_PX = 6
/** "metade já saiu aqui" medido a 12 px: 110,6 px; em duas linhas ("metade já" / "saiu aqui"), a maior tem 56 px. */
const METADE_UMA = 112
const METADE_DUAS = 56
const SEM_DADO = 'sem dado depois daqui'
const SEM_DADO_UMA = SEM_DADO.length * SANS_PX
const SEM_DADO_DUAS = 'depois daqui'.length * SANS_PX
const ENTRELINHA = 14

const entre = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
const f1 = (n: number): string => n.toFixed(1)

/** Que índices do eixo (0..4) cabem sem se tocar: os cinco, só 0/50/100% ou só as pontas. Pior caso: todos os rótulos com a largura do maior, mais 8 px de folga. */
function marcasDoEixo(eixo: readonly string[], pw: number): number[] {
  const w = Math.max(...eixo.map(r => r.length)) * MONO_PX
  const folga = 1.5 * w + 8
  if (pw / 4 >= folga) return [0, 1, 2, 3, 4]
  if (pw / 2 >= folga) return [0, 2, 4]
  return [0, 4]
}

/** De que lado da linha em `x` o rótulo cabe: à direita; senão à esquerda; senão em duas linhas (do lado que couber, ou do que tiver mais espaço). */
function ladoDoRotulo(x: number, W: number, uma: number, duas: number): { esq: boolean; duasLinhas: boolean } {
  const cabeDir = (w: number): boolean => x + 6 + w <= W - R
  const cabeEsq = (w: number): boolean => x - 6 - w >= L
  if (cabeDir(uma)) return { esq: false, duasLinhas: false }
  if (cabeEsq(uma)) return { esq: true, duasLinhas: false }
  if (cabeDir(duas)) return { esq: false, duasLinhas: true }
  if (cabeEsq(duas)) return { esq: true, duasLinhas: true }
  return { esq: x - L > W - R - x, duasLinhas: true }
}

/** O rótulo em uma ou duas linhas (`textContent` de uma linha é a frase inteira). */
function Rotulo({ classe, x, y, esq, linhas }: { classe: string; x: number; y: number; esq: boolean; linhas: [string] | [string, string] }) {
  const xx = esq ? x - 6 : x + 6
  return (
    <text className={classe} x={xx} y={y} textAnchor={esq ? 'end' : 'start'}>
      {linhas.length === 1 ? linhas[0] : linhas.map((l, i) => <tspan key={i} x={xx} dy={i === 0 ? 0 : ENTRELINHA}>{l}</tspan>)}
    </text>
  )
}

export function RetencaoCurva({ curva }: { curva: CurvaDesenho }) {
  const raiz = useRef<HTMLDivElement>(null)
  const pid = `rc-nm-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
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
  // um ponto só não faz linha nem área (largura zero): desenha-se a marca do ponto
  const area = `${d}L${f1(X(ultimo.t))} ${f1(Y(0))}L${f1(X(primeiro.t))} ${f1(Y(0))}Z`
  const meioX = curva.meioT != null ? X(curva.meioT) : null
  const metade = meioX != null ? ladoDoRotulo(meioX, W, METADE_UMA, METADE_DUAS) : null
  const semX = curva.ateT != null ? X(curva.ateT) : null
  const semLargura = semX != null ? W - R - semX : 0
  const semDado = semX != null && semLargura >= 2 ? ladoDoRotulo(semX, W, SEM_DADO_UMA, SEM_DADO_DUAS) : null
  const marcas = marcasDoEixo(curva.eixo, PW)

  return (
    <div className="rc" ref={raiz}>
      <svg className={cw > 0 ? 'rc-svg' : 'rc-svg rc-prep'} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={curva.alt}>
        {semDado ? (
          <defs>
            <pattern id={pid} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect className="rc-nm-fundo" width="5" height="5" />
              <line className="rc-nm-traco" x1="0" y1="0" x2="0" y2="5" />
            </pattern>
          </defs>
        ) : null}
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line className={f === 0.5 ? 'rc-grade rc-grade-meia' : 'rc-grade'} x1={L} x2={W - R} y1={Y(f)} y2={Y(f)} />
            <text className="rc-gy" x={L - 6} y={Y(f) + 4} textAnchor="end">{Math.round(f * 100)}%</text>
          </g>
        ))}
        {semDado ? <rect className="rc-semdado" x={semX!} y={T} width={semLargura} height={PH} fill={`url(#${pid})`} /> : null}
        {pontos.length > 1 ? <path className="rc-area" d={area} /> : null}
        {curva.revistos.map((r, i) => (
          <rect key={i} className="rc-revisto" x={X(r.de)} y={T} width={Math.max(2, X(r.ate) - X(r.de))} height={PH} />
        ))}
        {pontos.length > 1 ? <path className="rc-linha" d={d} /> : null}
        {meioX != null && metade ? (
          <g>
            <line className="rc-meio" x1={meioX} x2={meioX} y1={T} y2={T + PH} />
            <Rotulo classe="rc-rotulo" x={meioX} y={T + 14} esq={metade.esq} linhas={metade.duasLinhas ? ['metade já', 'saiu aqui'] : ['metade já saiu aqui']} />
          </g>
        ) : null}
        {semDado ? (
          <g>
            <line className="rc-semdado-linha" x1={semX!} x2={semX!} y1={T} y2={T + PH} />
            <Rotulo classe="rc-semdado-rotulo" x={semX!} y={T + 14} esq={semDado.esq} linhas={semDado.duasLinhas ? ['sem dado', 'depois daqui'] : [SEM_DADO]} />
          </g>
        ) : null}
        {curva.ateT != null ? <circle className="rc-ultimo" cx={X(ultimo.t)} cy={Y(ultimo.ratio)} r="3.5" /> : null}
        {curva.saidas.map((s, i) => (
          <polygon key={i} className="rc-saida" points={`${f1(X(s.t) - 6)},${T + PH + 12} ${f1(X(s.t) + 6)},${T + PH + 12} ${f1(X(s.t))},${T + PH + 3}`} />
        ))}
        {marcas.map(k => (
          <text key={k} className="rc-gx" x={L + PW * (k / 4)} y={H - 4} textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{curva.eixo[k]}</text>
        ))}
      </svg>
      <div className="rc-leg">
        <span><i className="rc-lg-l" aria-hidden="true" />parte do público que ainda assiste</span>
        {curva.legenda.revistos ? <span><i className="rc-lg-re" aria-hidden="true" />trecho revisto (muita gente voltou)</span> : null}
        {curva.legenda.saidas ? <span><svg className="rc-lg-sv" width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><polygon className="rc-saida" points="1,9 11,9 6,1" /></svg>maior saída</span> : null}
        {curva.legenda.semDado ? <span><i className="obs-ch-nm nm-q rc-lg-nm" aria-hidden="true" />sem dado coletado</span> : null}
        {curva.legenda.pico ? <span>{curva.legenda.pico}</span> : null}
      </div>
    </div>
  )
}
