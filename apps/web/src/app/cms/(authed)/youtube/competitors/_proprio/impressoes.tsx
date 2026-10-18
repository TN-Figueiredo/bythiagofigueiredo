'use client'
/**
 * O gráfico "Impressões por dia" (spec 16.6 e 17.4; mockup M/impressoes.js e impressoes.css): um componente só, usado na página do canal
 * próprio e na do vídeo próprio. Recebe o modelo JÁ montado (`buildImpressoes`): não lê banco, não importa os leitores, não pergunta que dia
 * é hoje. Três estados que nunca se confundem, cada um com forma E cor: barra cheia (dia com impressões), caixa vazada (zero medido), coluna
 * hachurada (o bloco do mockup aprovado, até 24 px na base), também na faixa dos cliques (não medido). Os cliques NÃO ficam dentro da barra (o dono leu a altura como escala): moram
 * numa faixa própria sob as datas, todos os pontos na mesma linha e o número embaixo. O mesmo componente desenha "Views por dia" (sem a faixa).
 * Camadas do SVG (nada cobre texto): grade e faixa, as colunas (linha da publicação, hachuras, barras, caixas, datas), UMA camada final com
 * rótulos de valor, pontos e números dos cliques, e por último as áreas de toque (transparentes).
 * O desenho é SVG na largura em que aparece (o texto fica em 12 px,
 * sem encolher) e é `aria-hidden`: tudo o que ele diz existe como texto (o nome do grupo traz o resumo; cada passo do teclado é falado
 * na região do dia, `role="status"`, entre os botões "Dia anterior" e "Dia seguinte"; "Ver como tabela" traz todos os dias).
 *
 * Teclado: UMA parada de Tab no grupo; setas, Home e End percorrem os dias; Esc fecha a dica. A dica mora na camada flutuante (HoverTip).
 * Ponteiro: o mouse aponta o dia sob ele; o toque abre a dica e ela fica até um toque fora. Next 16 não remonta o componente quando só
 * a query muda: o dia em foco é guardado COM a assinatura dos dias que o gerou e vale só enquanto a assinatura é a mesma.
 */
import { PastilhaAntes } from '../_chrome/ausencia/pastilhas'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { HoverTip, Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { FAIXA_ALTURA_PX, indiceDoMaior, int, linhasDasMarcas, PX_POR_CARACTERE, quaisCabem, type CedoView, type ColunaView, type ImpressoesView } from './impressoes-model'
import './impressoes.css'

/** Largura de partida: a do servidor e do primeiro render do cliente (hidratação idêntica). Depois da montagem vale a medida. */
const LARGURA_PADRAO = 760
const ESTREITO = 560
const MIN_W = 300
const MAX_W = 860
const T0 = 30     // espaço dos números em cima da barra mais alta
const DR = 22     // faixa das datas
const CR = 48     // a faixa própria dos cliques (retângulo rebaixado sob as datas)
const B = 6
const R = 6
const COLUNA_MAX = 56
const PX_DATA = 7.2            // a largura de um caractere da data (12 px, mono), para a última etiqueta não sair do desenho
const PONTO_MIN = 7.5          // abaixo disto por dia não há ponto nem número na faixa

const entre = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

/** `semDica`: o dia veio dos botões, que já têm a frase logo abaixo; a dica flutuante só cobriria o gráfico (a coluna segue marcada). */
interface Estado { sig: string; i: number; ponteiro: boolean; semDica: boolean }

/** A altura do bloco hachurado do "não medido": a do mockup aprovado (A.serieDia: round(min(24, altura da área * 0,25))). */
const blocoNaoMedido = (alturaArea: number): number => Math.round(Math.min(24, alturaArea * 0.25))

function Desenho({ view, W, pid, ativo }: { view: ImpressoesView; W: number; pid: string; ativo: number }) {
  const { colunas, teto, ticks, alturaArea: PH, faixaCliques, faixas, marcas } = view
  const n = colunas.length
  const estreito = W < ESTREITO
  const L = Math.max(estreito ? 52 : 58, Math.max(...ticks.map(t => int(t).length)) * PX_POR_CARACTERE + 14)
  const bw = Math.min((W - L - R) / n, COLUNA_MAX)
  const largBarra = Math.min(40, Math.max(4, bw * 0.7))
  const xsMarca = marcas.map(m => L + m.i * bw + bw / 2)
  const linhasMarca = linhasDasMarcas(xsMarca)
  const nLinhasMarca = marcas.length ? Math.max(...linhasMarca) + 1 : 0
  const altMarcas = nLinhasMarca * 16 + (nLinhasMarca ? 4 : 0)
  const T = T0 + view.alturaFaixas + altMarcas   // faixas e marcas moram numa área própria acima das barras: nunca sobre elas
  const yDatas = T + PH + 15
  const yFaixa = T + PH + DR                  // topo da faixa dos cliques (retângulo rebaixado de 48 px)
  const H = T + PH + DR + (faixaCliques ? CR : 0) + B
  const y = (v: number) => T + PH - v * PH / teto
  const cx = (i: number) => L + i * bw + bw / 2
  const xs = colunas.map((_, i) => cx(i))
  // o MAIOR valor da série tem prioridade para ficar com rótulo (a escolha comum é da esquerda para a direita e o deixava sem número a 390 px)
  const textosImp = colunas.map(c => (c.situacao === 'com-impressoes' ? c.imp : null))
  const mostraImp = quaisCabem(xs, textosImp, W, indiceDoMaior(textosImp))
  const comPonto = faixaCliques && bw >= PONTO_MIN
  const textosCl = colunas.map(c => (comPonto ? c.cliquesFaixa : null))
  const mostraCl = quaisCabem(xs, textosCl, W, indiceDoMaior(textosCl))
  const hach = `url(#${pid})`
  const hFaixaNm = CR - 22                    // a hachura da faixa começa abaixo do rótulo
  const hNm = blocoNaoMedido(PH)

  return (
    <svg className="ic-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="ic-hb" />
          <line x1="0" y1="0" x2="0" y2="6" className="ic-hl" />
        </pattern>
      </defs>
      <text className="ic-an" x="0" y="11">{view.rotuloEixo}</text>
      {faixas.map((f, k) => {
        const linha = faixas.findIndex(g => g.k === f.k)   // uma linha por tipo de faixa
        const yF = 4 + (f.k === 'cheia' ? 0 : faixas.some(g => g.k === 'cheia') ? 1 : 0) * FAIXA_ALTURA_PX
        const x0 = L + f.i0 * bw, x1 = L + (f.i1 + 1) * bw
        // M-3: o rótulo fica no maior trecho entre as divisórias de ciclo em que cabe inteiro; nunca atravessa uma divisória
        const larg = f.rotCurto.length * 6.4 + 12
        const bordas = [x0, ...f.dentes.map(i => L + i * bw).filter(x => x > x0 && x < x1), x1]
        let rotX = x0, melhor = larg, rotCabe = false
        for (let b = 0; b + 1 < bordas.length; b++) { const w = bordas[b + 1]! - bordas[b]!; if (w > melhor) { melhor = w; rotX = bordas[b]!; rotCabe = true } }
        return (
          <g key={k + f.k + f.i0} className={'ic-faixa ic-faixa-' + f.k} data-linha={linha}>
            <rect className="ic-faixa-fundo" x={x0} y={yF} width={x1 - x0} height={FAIXA_ALTURA_PX - 6} rx="3" />
            {f.k === 'pontilhada' ? <line className="ic-faixa-corte" x1={x1} x2={x1} y1={yF} y2={T + PH} /> : null}
            {f.dentes.map(i => <line key={i} className="ic-faixa-dente" x1={L + i * bw} x2={L + i * bw} y1={yF} y2={yF + FAIXA_ALTURA_PX - 6} />)}
            <text className="ic-faixa-rot" x={rotX + 6} y={yF + 12}>{rotCabe ? f.rotCurto : ''}</text>
            {f.aberta && f.k === 'cheia' ? <text className="ic-faixa-seta" x={x1 - 12} y={yF + 12}>→</text> : null}
          </g>
        )
      })}
      {marcas.map((m, k) => {
        const x = xsMarca[k]!, yM = view.alturaFaixas + 4 + (linhasMarca[k] ?? 0) * 16 + 7
        return (
          <g key={'m' + k} className="ic-marca" data-forma={m.forma}>
            <line className="ic-marca-haste" x1={x} x2={x} y1={yM + 6} y2={T - 14} />
            {m.forma === 'losango'
              ? <path className="ic-marca-f" d={`M${x} ${yM - 6}L${x + 6} ${yM}L${x} ${yM + 6}L${x - 6} ${yM}Z`} />
              : <path className="ic-marca-f" d={`M${x} ${yM - 6}L${x + 6} ${yM + 5}L${x - 6} ${yM + 5}Z`} />}
            <text className="ic-marca-n" x={x + 9} y={yM + 4}>{m.n}</text>
          </g>
        )
      })}
      {ticks.map(v => (
        <g key={v}>
          <line className="ic-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="ic-ax-y" x={L - 6} y={y(v) + 4} textAnchor="end">{int(v)}</text>
        </g>
      ))}
      {faixaCliques ? (
        <>
          <rect className="ic-strip" x={L} y={yFaixa} width={W - L - R} height={CR} rx="4" />
          <text className="ic-stl" x={L + 8} y={yFaixa + 14}>cliques estimados por dia</text>
        </>
      ) : null}
      {colunas.map((c, i) => {
        const x0 = L + i * bw, x = cx(i)
        const topo = T + PH - c.alturaPx
        // a última etiqueta é puxada para dentro do desenho (no máximo ~7 px): nunca sai cortada, no canal e no vídeo
        const meia = c.rotulo.length * PX_DATA / 2
        const xData = entre(x, meia + 1, W - meia - 1)
        const wNm = Math.max(2, Math.min(Math.max(largBarra, 6), bw - 1))
        return (
          <g key={c.dia} data-situacao={c.situacao} className={'ic-col ic-col-' + c.situacao}>
            {/* a linha da publicação nasce ANTES da barra e do rótulo: passa por trás deles, nunca por cima dos dígitos */}
            {c.publicacao ? <line className="ic-pub" x1={x} x2={x} y1={T - 4} y2={T + PH} /> : null}
            {c.situacao === 'nao-medido' ? (
              <>
                <rect className="ic-nm" x={x - wNm / 2} y={T + PH - hNm} width={wNm} height={hNm} fill={hach} />
                {ativo === i ? <line className="ic-nmlin" x1={x} x2={x} y1={T} y2={T + PH - hNm} /> : null}
                {faixaCliques ? <rect className="ic-nm" x={x0 + 1} y={yFaixa + 20} width={Math.max(2, bw - 2)} height={hFaixaNm} fill={hach} /> : null}
              </>
            ) : c.situacao === 'zero-medido' ? (
              <rect className="ic-zero" x={x - largBarra / 2} y={T + PH - c.alturaPx} width={largBarra} height={c.alturaPx} rx="1" fill="none" strokeWidth="1.5" />
            ) : (
              <>
                <rect className="ic-bar" x={x - largBarra / 2} y={topo} width={largBarra} height={c.alturaPx} rx="1.5" />
                {/* impressão sem CTR: os cliques deste dia não foram medidos (a faixa diz com a hachura, não com um zero) */}
                {faixaCliques && c.cliques == null ? <rect className="ic-nm-cl" x={x0 + 1} y={yFaixa + 20} width={Math.max(2, bw - 2)} height={hFaixaNm} fill={hach} /> : null}
              </>
            )}
            {c.marca ? <text className="ic-ax-x" x={xData} y={yDatas} textAnchor="middle">{c.rotulo}</text> : null}
          </g>
        )
      })}
      {/* a camada final: rótulos de valor, pontos e números dos cliques. Vem depois de TODAS as colunas (inclusive as hachuradas), então nada os cobre. */}
      <g className="ic-topo">
        {colunas.map((c, i) => {
          if (c.situacao !== 'com-impressoes') return null
          const x = cx(i), topo = T + PH - c.alturaPx
          return (
            <g key={c.dia} data-dia={c.dia}>
              {mostraImp[i] ? <text className="ic-val" x={x} y={topo - 5} textAnchor="middle">{c.imp}</text> : null}
              {faixaCliques && c.cliques != null && c.cliquesFaixa != null && comPonto ? (
                <>
                  <circle className="ic-dot" cx={x} cy={yFaixa + 25} r="3.4" />
                  {mostraCl[i] ? <text className="ic-cln" x={x} y={yFaixa + 43} textAnchor="middle">{c.cliquesFaixa}</text> : null}
                </>
              ) : null}
            </g>
          )
        })}
      </g>
      {colunas.map((c, i) => (
        <rect key={'h' + c.dia} className={'ic-hit' + (ativo === i ? ' on' : '')} data-i={i} x={L + i * bw} y={T} width={bw} height={PH + DR + (faixaCliques ? CR : 0)} />
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
            <tr>
              <th scope="col">Dia</th><th scope="col" className="r">{view.rotuloValor}</th>
              {view.faixaCliques ? <th scope="col" className="r">Cliques estimados</th> : null}
              <th scope="col">{view.rotuloSituacao}</th>
            </tr>
          </thead>
          <tbody>
            {view.colunas.map(c => (
              <tr key={c.dia} data-situacao={c.situacao} className={'ic-tr-' + c.situacao}>
                <th scope="row">{c.rotulo}</th>
                <td className="r num">{c.imp ?? <span className="obs-ch-nm">não medido</span>}</td>
                {view.faixaCliques ? <td className="r num">{c.cliques ?? <span className="obs-ch-nm">não medido</span>}</td> : null}
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
            : l.situacao === 'marca-triangulo' || l.situacao === 'marca-losango'
            ? <i className="ic-sw-marca" aria-hidden="true">{l.situacao === 'marca-triangulo' ? '▲' : '◆'}</i>
            : l.situacao === 'faixa-cheia' || l.situacao === 'faixa-pontilhada'
            ? <i className={'ic-sw ' + l.situacao} aria-hidden="true" />
            : <i className={'ic-sw ' + (l.situacao === 'com-impressoes' ? 'imp' : l.situacao === 'cliques' ? 'cl' : l.situacao === 'publicacao' ? 'pub' : 'zero')} aria-hidden="true" />}
          {l.texto}
        </span>
      ))}
    </figcaption>
  )
}

/** A faixa dos 7 primeiros dias (tela A do lote 1): no lugar do gráfico enquanto o vídeo é novo ou os relatórios só trouxeram zeros. */
function FaixaCedo({ cedo }: { cedo: CedoView }) {
  return (
    <div className="ic-cedo">
      <p className="ic-cedo-fr">{cedo.frase}</p>
      <ol className="ic-cedo-faixa" aria-label="Os 7 primeiros dias do vídeo, um por casa">
        {cedo.casas.map(c => (
          <li key={c.dia} className="ic-cedo-d">
            <span className={'ic-cedo-c ' + (c.estado === 'zero-medido' ? 'zero' : c.estado === 'com-impressoes' ? 'com' : c.estado === 'dia-nao-chegou' ? 'nm obs-ch-nm' : 'fut')} data-estado={c.estado} role="img" aria-label={c.aria}>{c.texto}</span>
            <span className="ic-cedo-n">dia {c.numero}</span>
            <span className="ic-cedo-dt">{c.rotulo}</span>
          </li>
        ))}
      </ol>
      <ul className="ic-cedo-leg" aria-label="Legenda da faixa">
        {cedo.legenda.map(l => (
          <li key={l.tipo}>
            <i className={'ic-cedo-sw ' + (l.tipo === 'nm' ? 'nm obs-ch-nm' : l.tipo)} aria-hidden="true" />
            {l.texto}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Impressoes({ view, titulo }: { view: ImpressoesView; titulo: string }) {
  const baseId = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const pid = 'ich' + baseId
  const raiz = useRef<HTMLElement>(null)
  const grupoRef = useRef<HTMLDivElement>(null)
  const passoRef = useRef<HTMLDivElement>(null)
  const svgBox = useRef<HTMLDivElement>(null)
  const infoBtn = useRef<HTMLButtonElement>(null)
  const [info, setInfo] = useState(false)
  const [cw, setCw] = useState(0)
  const [est, setEst] = useState<Estado | null>(null)
  const ultimo = useRef<{ sig: string; i: number } | null>(null)
  const focoDoPonteiro = useRef(false)
  const noPasso = useRef(false)   // o ponteiro está nos botões de passo: o grupo perder o foco por causa deles não fecha o dia

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
  const mostrar = useCallback((i: number, ponteiro: boolean, semDica = false) => { setEst({ sig, i, ponteiro, semDica }) }, [sig])
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
    // os botões "Dia anterior / Dia seguinte" fazem parte do gráfico: tocar neles não fecha o dia tocado, anda a partir dele
    const dentro = (n: Node) => grupoRef.current?.contains(n) || passoRef.current?.contains(n)
    const fora = (e: PointerEvent) => { if (!(e.target instanceof Node) || !dentro(e.target)) setEst(a => (a && a.ponteiro ? null : a)) }
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
    mostrar(i, false)
  }
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    focoDoPonteiro.current = false
    if (noPasso.current) { noPasso.current = false; return }
    // Tab até "Dia anterior" / "Dia seguinte": os botões fazem parte do gráfico, o dia continua e o botão parte dele
    if (e.relatedTarget instanceof Node && passoRef.current?.contains(e.relatedTarget)) return
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
    mostrar(i, false)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return // o dedo que rola a página não abre dica
    const i = indiceDe(e.target)
    if (i >= 0) mostrar(i, true)
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
    if (i >= 0) mostrar(i, true)
  }
  const onPointerCancel = () => { focoDoPonteiro.current = false }
  // botões: sem dia escolhido, o seguinte vai ao primeiro e o anterior ao último; nas pontas não andam (aria-disabled, o foco não some)
  const noPrimeiro = ativo != null && ativo.i === 0
  const noUltimo = ativo != null && ativo.i === n - 1
  const passo = (dir: -1 | 1) => {
    noPasso.current = false
    if (n === 0 || (dir < 0 && noPrimeiro) || (dir > 0 && noUltimo)) return
    const i = ativo ? entre(ativo.i + dir, 0, n - 1) : dir > 0 ? 0 : n - 1
    lembrar(i)
    mostrar(i, false, true)
  }
  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return // levantar o dedo não esconde a dica; um toque fora esconde
    const u = ultimoValido()
    if (document.activeElement === grupoRef.current && u >= 0) mostrar(u, false)
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
      {view.vazio ? <p className="ic-vazio"><PastilhaAntes estado={view.vazioEstado} />{view.vazio}</p> : view.cedo ? <><FaixaCedo cedo={view.cedo} />{view.notaFaixas ? <p className="ic-nota-trocas">{view.notaFaixas}</p> : null}</> : (
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
          <HoverTip show={coluna != null && !ativo?.semDica} anchor={() => svgBox.current?.querySelector(`[data-i="${ativo?.i ?? -1}"]`) ?? null} pref="cima" align="meio" gap={4} maxW={300} className="ic-tip" ariaHidden>
            {coluna?.dica}
          </HoverTip>
          <Legenda view={view} />
          {view.notaFaixas ? <p className="ic-nota-trocas">{view.notaFaixas}</p> : null}
          <div className="ic-step" ref={passoRef} onPointerDown={() => { noPasso.current = true }} onPointerCancel={() => { noPasso.current = false }}>
            <button type="button" aria-label="Dia anterior" aria-disabled={noPrimeiro} onClick={() => passo(-1)}>{Icon.prev()}</button>
            {/* a frase do dia é a mesma da dica, da seta e da tabela; o mouse não fala (aria-live desligado) para quem usa leitor de tela com mouse */}
            <p className={'ic-out' + (coluna ? '' : ' vazio')} role="status" aria-live={ativo?.ponteiro ? 'off' : 'polite'} aria-atomic="true">
              {coluna ? <span>{coluna.dica}</span> : (
                <>
                  <span className="ic-out-m">Passe o mouse sobre o gráfico ou use as setas para ler um dia.</span>
                  <span className="ic-out-t">Use os botões para ler um dia de cada vez.</span>
                </>
              )}
            </p>
            <button type="button" aria-label="Dia seguinte" aria-disabled={noUltimo} onClick={() => passo(1)}>{Icon.next()}</button>
          </div>
          <Tabela view={view} titulo={titulo} />
        </>
      )}
    </figure>
  )
}
