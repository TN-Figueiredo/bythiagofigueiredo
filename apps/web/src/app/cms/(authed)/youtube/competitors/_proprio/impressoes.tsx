'use client'
/**
 * O gráfico "Impressões por dia" (spec 16.6 e 17.4; mockup M/impressoes.js e impressoes.css): um componente só, usado na página do canal
 * próprio e na do vídeo próprio. Recebe o modelo JÁ montado (`buildImpressoes`): não lê banco, não importa os leitores, não pergunta que dia
 * é hoje. Três estados que nunca se confundem, cada um com forma E cor: barra (dia com impressões), traço na base (zero medido), coluna
 * hachurada de cima a baixo, também na faixa dos cliques (não medido). O desenho é SVG na largura em que aparece (o texto fica em 12 px,
 * sem encolher) e é `aria-hidden`: tudo o que ele diz existe como texto (o nome do grupo traz o resumo; cada passo do teclado é falado
 * numa região aria-live; "Ver como tabela" traz todos os dias).
 *
 * Teclado: UMA parada de Tab no grupo; setas, Home e End percorrem os dias; Esc fecha a dica. A dica mora na camada flutuante (HoverTip).
 * Ponteiro: o mouse aponta o dia sob ele; o toque abre a dica e ela fica até um toque fora. Next 16 não remonta o componente quando só
 * a query muda: o dia em foco é guardado COM a assinatura dos dias que o gerou e vale só enquanto a assinatura é a mesma.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { HoverTip, Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { int, type ColunaView, type ImpressoesView } from './impressoes-model'
import './impressoes.css'

/** Largura de partida: a do servidor e do primeiro render do cliente (hidratação idêntica). Depois da montagem vale a medida. */
const LARGURA_PADRAO = 760
const ESTREITO = 560
const MIN_W = 300
const MAX_W = 860
const T = 30      // espaço dos números em cima da barra mais alta
const DR = 22     // faixa das datas
const CR = 24     // faixa dos cliques
const B = 6
const R = 6
const COLUNA_MAX = 56
const PX_POR_CARACTERE = 7.4   // 12 px em fonte mono: a largura de um dígito, para os rótulos não se atropelarem

interface Estado { sig: string; i: number; ponteiro: boolean; falar: boolean }

/** Quais colunas levam o texto (número em cima da barra, número dos cliques): da esquerda para a direita, só as que não esbarram na anterior. */
function quaisCabem(xs: readonly number[], textos: ReadonlyArray<string | null>): boolean[] {
  let fim = -Infinity
  return xs.map((x, i) => {
    const t = textos[i]
    if (t == null) return false
    const w = t.length * PX_POR_CARACTERE
    if (x - w / 2 < fim + 3) return false
    fim = x + w / 2
    return true
  })
}

function Desenho({ view, W, pid, ativo }: { view: ImpressoesView; W: number; pid: string; ativo: number }) {
  const { colunas, teto, ticks, alturaArea: PH } = view
  const n = colunas.length
  const estreito = W < ESTREITO
  const L = Math.max(estreito ? 52 : 58, Math.max(...ticks.map(t => int(t).length)) * PX_POR_CARACTERE + 14)
  const bw = Math.min((W - L - R) / n, COLUNA_MAX)
  const largBarra = Math.min(40, Math.max(4, bw * 0.7))
  const H = T + PH + DR + CR + B
  const yDatas = T + PH + 15, yCl = T + PH + DR
  const y = (v: number) => T + PH - v * PH / teto
  const cx = (i: number) => L + i * bw + bw / 2
  const xs = colunas.map((_, i) => cx(i))
  const mostraImp = quaisCabem(xs, colunas.map(c => (c.situacao === 'com-impressoes' ? c.imp : null)))
  const mostraCl = quaisCabem(xs, colunas.map(c => c.cliquesFaixa))
  const hach = `url(#${pid})`

  return (
    <svg className="ic-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="ic-hb" />
          <line x1="0" y1="0" x2="0" y2="6" className="ic-hl" />
        </pattern>
      </defs>
      <text className="ic-an" x="0" y="11">impressões</text>
      {ticks.map(v => (
        <g key={v}>
          <line className="ic-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="ic-ax-y" x={L - 6} y={y(v) + 4} textAnchor="end">{int(v)}</text>
        </g>
      ))}
      <line className="ic-grid" x1={L} x2={W - R} y1={yCl} y2={yCl} />
      <text className="ic-an r" x={L - 6} y={yCl + 16} textAnchor="end">cliques</text>
      {colunas.map((c, i) => {
        const x0 = L + i * bw, x = cx(i)
        const topo = T + PH - c.alturaPx
        return (
          <g key={c.dia} data-situacao={c.situacao} className={'ic-col ic-col-' + c.situacao}>
            {c.situacao === 'nao-medido' ? (
              <>
                <rect className="ic-nm" x={x0 + 1} y={T} width={Math.max(2, bw - 2)} height={PH} fill={hach} />
                <rect className="ic-nm" x={x0 + 1} y={yCl + 3} width={Math.max(2, bw - 2)} height={CR - 6} fill={hach} />
              </>
            ) : c.situacao === 'zero-medido' ? (
              <rect className="ic-zero" x={x - largBarra / 2} y={T + PH - c.alturaPx} width={largBarra} height={c.alturaPx} rx="1" fill="none" strokeWidth="1.5" />
            ) : (
              <>
                <rect className="ic-bar" x={x - largBarra / 2} y={topo} width={largBarra} height={c.alturaPx} rx="1.5" />
                {mostraImp[i] ? <text className="ic-val" x={x} y={topo - 5} textAnchor="middle">{c.imp}</text> : null}
                {c.cliques == null ? (
                  // impressão sem CTR: os cliques deste dia não foram medidos (a faixa diz com a hachura, não com um zero)
                  <rect className="ic-nm-cl" x={x0 + 1} y={yCl + 3} width={Math.max(2, bw - 2)} height={CR - 6} fill={hach} />
                ) : c.cliquesFaixa != null ? (
                  <>
                    <circle className="ic-dot" cx={x} cy={T + PH - 4.5} r="3.6" />
                    {mostraCl[i] ? <text className="ic-cln" x={x} y={yCl + 16} textAnchor="middle">{c.cliquesFaixa}</text> : null}
                  </>
                ) : null}
              </>
            )}
            {c.marca ? (
              <text className="ic-ax-x" x={x + 18 > W ? W - R : x} y={yDatas} textAnchor={x + 18 > W ? 'end' : 'middle'}>{c.rotulo}</text>
            ) : null}
          </g>
        )
      })}
      {colunas.map((c, i) => (
        <rect key={'h' + c.dia} className={'ic-hit' + (ativo === i ? ' on' : '')} data-i={i} x={L + i * bw} y={T} width={bw} height={PH + DR + CR} />
      ))}
    </svg>
  )
}

function Tabela({ view, titulo }: { view: ImpressoesView; titulo: string }) {
  return (
    <details className="ic-tab">
      <summary>Ver como tabela</summary>
      <div className="ic-tw" role="region" tabIndex={0} aria-label={`${titulo}, tabela dia a dia`}>
        <table>
          <caption className="ic-sr">{titulo}</caption>
          <thead>
            <tr><th scope="col">Dia</th><th scope="col" className="r">Impressões</th><th scope="col" className="r">Cliques estimados</th><th scope="col">Situação do relatório</th></tr>
          </thead>
          <tbody>
            {view.colunas.map(c => (
              <tr key={c.dia} data-situacao={c.situacao} className={'ic-tr-' + c.situacao}>
                <th scope="row">{c.rotulo}</th>
                <td className="r num">{c.imp ?? <span className="obs-ch-nm">não medido</span>}</td>
                <td className="r num">{c.cliques ?? <span className="obs-ch-nm">não medido</span>}</td>
                <td>{c.situacaoTexto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Legenda({ view }: { view: ImpressoesView }) {
  return (
    <figcaption className="ic-leg">
      {view.legenda.map(l => (
        <span key={l.situacao} className="ic-lg">
          {l.situacao === 'nao-medido'
            ? <i className="ic-sw nm obs-ch-nm" aria-hidden="true" />
            : <i className={'ic-sw ' + (l.situacao === 'com-impressoes' ? 'imp' : l.situacao === 'cliques' ? 'cl' : 'zero')} aria-hidden="true" />}
          {l.texto}
        </span>
      ))}
    </figcaption>
  )
}

export function Impressoes({ view, titulo }: { view: ImpressoesView; titulo: string }) {
  const baseId = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const pid = 'ich' + baseId
  const raiz = useRef<HTMLElement>(null)
  const grupoRef = useRef<HTMLDivElement>(null)
  const svgBox = useRef<HTMLDivElement>(null)
  const infoBtn = useRef<HTMLButtonElement>(null)
  const [info, setInfo] = useState(false)
  const [cw, setCw] = useState(0)
  const [est, setEst] = useState<Estado | null>(null)
  const ultimo = useRef<{ sig: string; i: number } | null>(null)
  const focoDoPonteiro = useRef(false)

  const n = view.colunas.length
  // a assinatura dos dias: o estado do foco e da dica só vale para o conjunto de dias que o gerou (o servidor manda outra view quando só a query muda)
  const sig = useMemo(() => titulo + '|' + view.colunas.map(c => c.dia).join(','), [titulo, view.colunas])
  const ativo = est && est.sig === sig && est.i >= 0 && est.i < n ? est : null
  const coluna: ColunaView | undefined = ativo ? view.colunas[ativo.i] : undefined
  const ultimoValido = (): number => (ultimo.current && ultimo.current.sig === sig && ultimo.current.i < n ? ultimo.current.i : -1)

  /* ------------------------------------------------------------------ largura: nasce na do contêiner e repinta quando ela muda */
  const medir = useCallback(() => {
    const w = Math.round(raiz.current?.clientWidth ?? 0)
    setCw(antes => (antes === w ? antes : w))
  }, [])
  useLayoutEffect(() => { medir() }, [medir, n])
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const agenda = (ms: number) => () => { clearTimeout(t); t = setTimeout(medir, ms) }
    const aoRedimensionar = agenda(120), aoGirar = agenda(250)
    window.addEventListener('resize', aoRedimensionar)
    window.addEventListener('orientationchange', aoGirar)
    // a seção "Como o canal está" nasce recolhida: ao abrir, a largura muda sem evento de janela
    const ro = typeof ResizeObserver === 'undefined' || !raiz.current ? null : new ResizeObserver(aoRedimensionar)
    if (ro && raiz.current) ro.observe(raiz.current)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', aoRedimensionar)
      window.removeEventListener('orientationchange', aoGirar)
      ro?.disconnect()
    }
  }, [medir])
  const largura = cw > 0 ? cw : LARGURA_PADRAO
  const W = largura < ESTREITO ? Math.max(MIN_W, largura) : Math.min(MAX_W, largura)

  /* ------------------------------------------------------------------ dica e teclado */
  const mostrar = useCallback((i: number, ponteiro: boolean, falar: boolean) => { setEst({ sig, i, ponteiro, falar }) }, [sig])
  const fechar = useCallback(() => { setEst(null) }, [])
  const lembrar = (i: number) => { ultimo.current = { sig, i } }

  // a marca do ponteiro é consumida no foco; uma tecla apertada antes do foco mostra que o foco que vem é do teclado
  useEffect(() => {
    const tecla = () => { focoDoPonteiro.current = false }
    document.addEventListener('keydown', tecla, true)
    return () => document.removeEventListener('keydown', tecla, true)
  }, [])
  // toque: a dica fica depois de levantar o dedo; um toque fora fecha
  const doPonteiro = ativo?.ponteiro ?? false
  useEffect(() => {
    if (!doPonteiro) return
    const fora = (e: PointerEvent) => { if (!(e.target instanceof Node) || !grupoRef.current?.contains(e.target)) setEst(a => (a && a.ponteiro ? null : a)) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [doPonteiro])

  const indiceDe = (alvo: EventTarget): number => {
    if (!(alvo instanceof Element)) return -1
    const h = alvo.closest('[data-i]')
    const i = h ? Number(h.getAttribute('data-i')) : -1
    return Number.isInteger(i) && i >= 0 && i < n ? i : -1
  }
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (focoDoPonteiro.current) {
      // o foco veio do clique ou do toque: o dia apontado fica, sem fala, e o teclado parte dele
      focoDoPonteiro.current = false
      if (ativo) lembrar(ativo.i)
      return
    }
    const i = Math.max(0, ultimoValido())
    lembrar(i)
    mostrar(i, false, true)
  }
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    focoDoPonteiro.current = false
    ultimo.current = null
    fechar()
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    focoDoPonteiro.current = false
    const base = ativo ? ativo.i : ultimoValido()
    let i: number
    switch (e.key) {
      case 'ArrowRight': i = base < 0 ? 0 : Math.min(n - 1, base + 1); break
      case 'ArrowLeft': i = base < 0 ? 0 : Math.max(0, base - 1); break
      case 'Home': i = 0; break
      case 'End': i = n - 1; break
      case 'Escape':
        if (!ativo) return
        e.preventDefault(); e.stopPropagation(); fechar(); return
      default: return
    }
    e.preventDefault()
    lembrar(i)
    mostrar(i, false, true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return // o dedo que rola a página não abre dica
    const i = indiceDe(e.target)
    if (i >= 0) mostrar(i, true, false)
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const i = indiceDe(e.target)
    if (document.activeElement === grupoRef.current) {
      focoDoPonteiro.current = false
      if (i >= 0) lembrar(i)
    } else {
      // clique e toque focam o grupo (tabindex=0), no toque só depois de levantar o dedo: a marca vale até o foco a consumir
      focoDoPonteiro.current = true
    }
    if (i >= 0) mostrar(i, true, false)
  }
  const onPointerCancel = () => { focoDoPonteiro.current = false }
  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return // levantar o dedo não esconde a dica; um toque fora esconde
    const u = ultimoValido()
    if (document.activeElement === grupoRef.current && u >= 0) mostrar(u, false, false)
    else fechar()
  }

  /* ------------------------------------------------------------------ o que aparece */
  const tid = 'ict' + baseId
  const popId = 'icp' + baseId
  const primeira = view.colunas[0], ultima = view.colunas[n - 1]
  const nome = n > 0 && primeira && ultima
    ? `${titulo}, de ${primeira.rotulo} a ${ultima.rotulo}. ${view.resumo ?? ''} Use as setas para percorrer os dias.`
    : titulo

  return (
    <figure className="ic" ref={raiz} aria-labelledby={tid}>
      <div className="ic-t" id={tid}>{titulo}</div>
      {view.vazio ? <p className="ic-vazio">{view.vazio}</p> : (
        <>
          {view.resumo ? <p className="ic-res">{view.resumo}</p> : null}
          <div className="ic-meta">
            <span className="ic-per">{view.periodoTexto}</span>
            <button ref={infoBtn} type="button" className="ic-info" aria-label="Como ler este gráfico" aria-expanded={info} aria-controls={popId} onClick={() => setInfo(o => !o)}>
              {Icon.info()}
            </button>
            <Popover open={info} anchor={() => infoBtn.current} onClose={() => setInfo(false)} id={popId} role="dialog" labelledBy={popId + 't'} className="ic-pop" pref="baixo" align="fim" maxW={380}>
              <h3 id={popId + 't'}>Como ler este gráfico</h3>
              {view.metodo.map(p => <p key={p}>{p}</p>)}
            </Popover>
          </div>
          {view.avisos.length ? <ul className="ic-avisos">{view.avisos.map(a => <li key={a}>{a}</li>)}</ul> : null}
          <div className="ic-sc" ref={svgBox}>
            <div ref={grupoRef} className="ic-grupo" role="group" tabIndex={0} aria-label={nome} style={{ width: W }}
              onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onPointerMove={onPointerMove} onPointerDown={onPointerDown}
              onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}>
              <Desenho view={view} W={W} pid={pid} ativo={ativo ? ativo.i : -1} />
            </div>
          </div>
          <span className="ic-sr" aria-live="polite" aria-atomic="true">{ativo?.falar && coluna ? coluna.dica : ''}</span>
          <HoverTip show={coluna != null} anchor={() => svgBox.current?.querySelector(`[data-i="${ativo?.i ?? -1}"]`) ?? null} pref="cima" align="meio" gap={4} maxW={300} className="ic-tip" ariaHidden>
            {coluna?.dica}
          </HoverTip>
          <Legenda view={view} />
          <Tabela view={view} titulo={titulo} />
        </>
      )}
    </figure>
  )
}
