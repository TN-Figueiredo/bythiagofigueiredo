'use client'
/**
 * "Este vídeo no canal" (spec 17.3; mockup M/regua.js e MC/video.js): uma frase-resumo e uma tabela de verdade com UMA régua por número (um traço por
 * vídeo do canal, posto pelo valor; este vídeo destacado; triângulo sob a linha = mediana; cor por terço sempre com forma ▲ ● ▼ e a posição escrita).
 * Recebe o modelo JÁ montado (`buildReguas`): nada de banco, nada de número que não esteja no texto. A régua visual é `aria-hidden`; a célula da posição
 * traz o texto só para leitor de tela. Uma parada de Tab por régua; setas, Home e End andam de vídeo em vídeo pelo valor; Enter abre o vídeo; Esc fecha
 * a dica; cada passo é falado numa região `aria-live`. Toque: o primeiro toque mostra a dica, o segundo no mesmo traço abre. A dica mora na camada
 * única (HoverTip, #flut). Sem animação.
 *
 * A frase só é verdadeira com a base ao lado (H17): `base`, `pouco` e o "N sem medida" de cada linha aparecem SEMPRE junto dela.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { HoverTip } from '../_chrome/flut/flut'
import { InfoDica } from './info-dica'
import type { LinhaRegua, ReguasView, Terco, TracoRegua } from './reguas-model'
import './reguas.css'

const FORMA: Record<Terco, string> = { cima: '▲', meio: '●', baixo: '▼' }
const NOME_TERCO: Record<Terco, string> = { cima: 'terço de cima', meio: 'terço do meio', baixo: 'terço de baixo' }
const GRUPOS: ReadonlyArray<LinhaRegua['grupo']> = ['Alcance', 'Resposta', 'Formato']
/** Até que distância (px) do centro de um traço o clique do mouse abre o vídeo dele. */
const ALCANCE_CLIQUE_PX = 12
const vars = (o: Record<string, string>) => o as CSSProperties

interface Ativo { i: number; toque: boolean; cx: number | undefined }

const centro = (el: Element | null | undefined): number | undefined => {
  const r = el?.getBoundingClientRect()
  return r && (r.width > 0 || r.left > 0) ? r.left + r.width / 2 : undefined
}

function Regua({ linha, falar }: { linha: LinhaRegua; falar: (s: string) => void }) {
  const router = useRouter()
  const grupo = useRef<HTMLDivElement>(null)
  const ticks = useRef<Array<HTMLElement | null>>([])
  const ultimo = useRef(-1)
  const [ativo, setAtivo] = useState<Ativo | null>(null)
  const { tracos } = linha
  const esteI = tracos.findIndex(t => t.este)

  const dizer = useCallback((t: TracoRegua) => `${t.titulo}${t.este ? ' (este vídeo)' : ''}: ${t.texto}`, [])
  const mostrar = useCallback((i: number, toque: boolean, voz: boolean) => {
    const t = tracos[i]; if (!t) return
    setAtivo({ i, toque, cx: centro(ticks.current[i]) })
    if (voz) falar(dizer(t))
  }, [tracos, dizer, falar])
  const fechar = useCallback(() => setAtivo(null), [])
  const abrir = useCallback((t: TracoRegua | undefined) => { if (t?.href && !t.este) router.push(t.href) }, [router])

  // o toque deixa a dica depois de levantar o dedo; um toque fora a fecha
  const toque = ativo?.toque ?? false
  useEffect(() => {
    if (!toque) return
    const fora = (e: PointerEvent) => { if (!(e.target instanceof Node) || !grupo.current?.contains(e.target)) setAtivo(a => (a && a.toque ? null : a)) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [toque])

  /** O traço mais perto de `cx` e a distância até ele, em px. */
  const maisPertoDe = (cx: number): { i: number; d: number } => {
    let melhor = -1, menor = Infinity
    ticks.current.forEach((el, i) => {
      if (!el) return
      const b = el.getBoundingClientRect()
      const d = Math.abs(b.left + b.width / 2 - cx)
      if (d < menor) { menor = d; melhor = i }
    })
    return { i: melhor, d: menor }
  }
  const maisPerto = (cx: number): number => maisPertoDe(cx).i

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const i = ultimo.current >= 0 ? ultimo.current : Math.max(0, esteI)
    ultimo.current = i
    mostrar(i, false, true)
  }
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) { ultimo.current = -1; fechar() } }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const n = tracos.length
    let i = ultimo.current >= 0 ? ultimo.current : Math.max(0, esteI)
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': i = Math.min(n - 1, i + 1); break
      case 'ArrowLeft': case 'ArrowDown': i = Math.max(0, i - 1); break
      case 'Home': i = 0; break
      case 'End': i = n - 1; break
      case 'Enter': e.preventDefault(); abrir(tracos[i]); return
      case 'Escape': e.preventDefault(); fechar(); return
      default: return
    }
    e.preventDefault()
    ultimo.current = i
    mostrar(i, false, true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const i = maisPerto(e.clientX)
    if (i >= 0) mostrar(i, false, false)
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const i = maisPerto(e.clientX)
    if (i < 0) return
    if (e.pointerType === 'touch') {
      // o segundo toque no mesmo traço abre; o primeiro só mostra a dica
      if (ativo?.toque && ativo.i === i) abrir(tracos[i])
      else mostrar(i, true, true)
      return
    }
    // o clique do mouse só abre o vídeo com o ponteiro em cima do traço (a faixa tem 44 px de altura e a régua é longa): um clique solto no vão não navega
    if (maisPertoDe(e.clientX).d > ALCANCE_CLIQUE_PX) return
    ultimo.current = i
    abrir(tracos[i])
  }
  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    if (document.activeElement === grupo.current && ultimo.current >= 0) mostrar(ultimo.current, false, false)
    else fechar()
  }

  const t = ativo ? tracos[ativo.i] : undefined
  const terco = linha.pos && !linha.neutro ? linha.pos.terco : null
  return (
    <div className="vb-rg-w">
      <div ref={grupo} className="vb-rg" role="group" tabIndex={0}
        aria-label={`Régua de ${linha.nome.toLowerCase()}: ${tracos.length} vídeos do canal, do menor ao maior valor. Setas percorrem os vídeos, Enter abre o vídeo, Esc fecha a dica.`}
        onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerLeave={onPointerLeave}>
        <div className="vb-rg-in" aria-hidden="true">
          <i className="vb-rg-base" />
          {linha.medianaPct != null && <i className="vb-rg-med" style={vars({ '--x': `${linha.medianaPct.toFixed(2)}%` })} />}
          {tracos.map((tr, i) => (
            <i key={tr.id} ref={el => { ticks.current[i] = el }} data-i={i} data-este={tr.este ? 'sim' : undefined} data-terco={tr.este && terco ? terco : undefined}
              className={'vb-rg-t' + (tr.este ? ' vb-rg-este' : '') + (ativo?.i === i ? ' vb-rg-on' : '')} style={vars({ '--x': `${tr.pct.toFixed(2)}%`, '--dx': `${tr.dx}px` })} />
          ))}
        </div>
      </div>
      <div className="vb-rg-pontas" aria-hidden="true"><span>menos</span><span>mais</span></div>
      <HoverTip show={ativo != null && t != null} anchor={() => grupo.current} cx={ativo?.cx} pref="cima" gap={4} maxW={300} className="vb-rg-tip">
        {t && <><span className="vb-rg-tip-t">{t.titulo}{t.este ? ' · este vídeo' : ''}</span><span className="vb-rg-tip-s">{t.texto}</span></>}
      </HoverTip>
    </div>
  )
}

function Linha({ l, falar }: { l: LinhaRegua; falar: (s: string) => void }) {
  const nome = (
    <th scope="row" role="rowheader" className="vb-rg-nm">{l.nome}{l.sub ? <small>{l.sub}</small> : null}</th>
  )
  const valor = (
    <td role="cell" className="vb-rg-v num">
      {l.zeroMedido
        ? <span className="obs-ch-zero">{l.valor}<span className="obs-ch-sr"> (zero medido)</span></span>
        : l.valor != null ? l.valor : <span className="obs-ch-nm">não medido</span>}
    </td>
  )
  const rodape = l.semMedida ? <small className="vb-rg-sm">{l.semMedida}</small> : null
  if (l.semRegua != null || l.pos == null) {
    return (
      <tr role="row" className="vb-rg-r" data-numero={l.numero}>
        {nome}{valor}
        <td role="cell" className="vb-rg-sem" colSpan={2}>{l.semRegua}{rodape ? <> {rodape}</> : null}</td>
      </tr>
    )
  }
  const terco = l.neutro ? null : l.pos.terco
  const texto = l.href ? <a href={l.href}>{l.posTexto}</a> : <>{l.posTexto}</>
  return (
    <tr role="row" className="vb-rg-r" data-numero={l.numero}>
      {nome}{valor}
      <td role="cell" className="vb-rg-c"><Regua linha={l} falar={falar} /></td>
      <td role="cell" className="vb-rg-p">
        {terco ? <span className={'vb-rg-mk t-' + terco} aria-hidden="true">{FORMA[terco]}</span> : <span className="vb-rg-mk0" aria-hidden="true" />}
        <span className="vb-rg-pt" aria-hidden={l.href ? undefined : 'true'}>{texto}</span>
        {rodape}
        <span className="obs-ch-sr">{l.sr}</span>
      </td>
    </tr>
  )
}

export function Reguas({ view }: { view: ReguasView }) {
  const [fala, setFala] = useState('')
  const falar = useCallback((s: string) => setFala(s), [])
  const comprimidas = view.linhas.filter(l => l.comprimida).map(l => l.nome.toLowerCase())
  const metodo = [
    comprimidas.length
      ? `Escala comprimida (raiz quadrada) em ${comprimidas.join(', ')}, para caber o maior sem apagar os pequenos; as outras em escala linear.`
      : 'Escala linear em todas.',
    'Mesmo valor fica lado a lado. Duração não leva cor: vídeo longo não é melhor nem pior.',
    'Cada traço é um vídeo do canal; o traço grosso é este; o triângulo é a mediana do canal. A cor do traço grosso é o terço em que este vídeo cai, e a forma ▲ ● ▼ e a posição escrita dizem o mesmo sem cor.',
  ]
  return (
    <div className="vb-rg-tudo">
      <p className="vb-rg-fr">{view.frase}</p>
      {view.base ? <p className="vb-rg-base-t">{view.base}</p> : null}
      {view.pouco ? <p className="vb-rg-pouco">{view.pouco}</p> : null}
      <div className="vb-rg-tw">
        <table className="vb-rg-tb" role="table">
          <caption className="obs-ch-sr">Onde este vídeo fica entre os vídeos do canal, em cada número. Cada linha tem o valor deste vídeo, uma régua com um traço por vídeo do canal e a posição.</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader"><span className="obs-ch-sr">Número</span></th>
              <th scope="col" role="columnheader" className="vb-rg-hv">este vídeo</th>
              <th scope="col" role="columnheader" className="vb-rg-hr">os vídeos do canal, do menor ao maior</th>
              <th scope="col" role="columnheader" className="vb-rg-hp">posição</th>
            </tr>
          </thead>
          {GRUPOS.map(g => {
            const ls = view.linhas.filter(l => l.grupo === g)
            if (ls.length === 0) return null
            return (
              <tbody key={g} role="rowgroup">
                <tr role="row" className="vb-rg-g"><th scope="rowgroup" role="rowheader" colSpan={4}>{g}</th></tr>
                {ls.map(l => <Linha key={l.numero} l={l} falar={falar} />)}
              </tbody>
            )
          })}
        </table>
      </div>
      <p className="vb-rg-leg">
        <span className="vb-rg-lg"><i className="vb-rg-ex" />um vídeo do canal</span>
        <span className="vb-rg-lg"><i className="vb-rg-ex vb-rg-ex-este" />este vídeo</span>
        <span className="vb-rg-lg"><i className="vb-rg-ex-med" />mediana do canal</span>
        {(['cima', 'meio', 'baixo'] as const).map(t => <span key={t} className="vb-rg-lg"><span className={'vb-rg-mk t-' + t} aria-hidden="true">{FORMA[t]}</span>{NOME_TERCO[t]}</span>)}
        <InfoDica titulo="Como ler as réguas" paragrafos={metodo} rotulo="Sobre a escala das réguas" />
      </p>
      <p className="obs-ch-sr" role="status" aria-live="polite" aria-atomic="true">{fala}</p>
    </div>
  )
}
