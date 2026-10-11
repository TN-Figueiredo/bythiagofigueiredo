'use client'
/**
 * A régua do nicho (spec telas v9, 18.5; mockup M/regua.js `nicho`, `ligarNicho`, `ajustar`): um traço por canal do conjunto, do menor ao
 * maior, com os lados A e B destacados na cor do lado e a letra embaixo. O desenho é aria-hidden: tudo o que ele diz existe também como
 * texto (o rótulo do grupo traz a posição escrita dos dois lados e o conjunto; cada passo do teclado é falado numa região aria-live).
 * A dica mora na camada flutuante (HoverTip, #flut), nunca dentro da célula. Uma parada de Tab por régua. Sem animação.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { HoverTip } from '../flut/flut'
import { afastarLetras, alturaPilha, type ReguaView, type Traco } from './regua-model'
import './regua.css'

const vars = (o: Record<string, string>) => o as CSSProperties

/** Até quantos nomes a dica de empate lista; o resto vira "e mais N". */
const NOMES_NA_DICA = 6

interface Ativo { i: number; ponteiro: boolean; cx: number | undefined }

/** O centro horizontal de um traço na janela; sem layout (rect vazio) não há onde apontar. */
const centro = (el: Element | null | undefined): number | undefined => {
  const r = el?.getBoundingClientRect()
  return r && (r.width > 0 || r.left > 0) ? r.left + r.width / 2 : undefined
}

export function ReguaNicho({ regua, cores }: { regua: ReguaView; cores: { A: string; B: string } }) {
  const grupoRef = useRef<HTMLDivElement>(null)
  const dentroRef = useRef<HTMLDivElement>(null)
  const ticks = useRef<Array<HTMLElement | null>>([])
  const letraA = useRef<HTMLElement>(null), letraB = useRef<HTMLElement>(null)
  const ultimo = useRef(-1) // o traço do teclado
  const focoDoPonteiro = useRef(false) // a origem da interação: o clique ou o toque apontou um traço, e o foco que vem a seguir é dele, não do teclado
  const apontado = useRef(-1) // o traço do último clique ou toque
  const [ativo, setAtivo] = useState<Ativo | null>(null)
  const [fala, setFala] = useState('')
  const { tracos, un } = regua
  const desenha = !regua.vazio && tracos.length > 0

  const textoDa = useCallback((t: Traco) => `${t.texto}${un ? ' ' + un : ''}`, [un])
  const falaDe = useCallback((t: Traco) => {
    const quem = t.marca ? `${t.nome}, lado ${t.marca}` : t.nome
    return `${quem}: ${textoDa(t)}${t.grupo.length > 1 ? `, ${t.grupo.length} canais com ${t.texto}` : ''}`
  }, [textoDa])

  const mostrar = useCallback((i: number, ponteiro: boolean, falar: boolean) => {
    const t = tracos[i]; if (!t) return
    setAtivo({ i, ponteiro, cx: centro(ticks.current[i]) })
    if (falar) setFala(falaDe(t))
  }, [tracos, falaDe])
  const fechar = useCallback(() => { setAtivo(null) }, [])

  // outra régua (outro par, outro número): índices e fala do traço anterior não valem mais. Compara pelo conteúdo, não pela identidade do objeto.
  const assinatura = `${regua.aria}|${tracos.length}|${tracos.map(t => t.id).join(',')}`
  const vista = useRef(assinatura)
  useEffect(() => {
    if (vista.current === assinatura) return
    vista.current = assinatura
    ultimo.current = -1
    setAtivo(null); setFala('')
  }, [assinatura])
  // a marca do ponteiro é consumida no foco (sem relógio: no toque o foco sintetizado chega depois do levantar do dedo, 50 a 150 ms depois do pointerdown).
  // Uma tecla apertada antes do foco (um Tab vindo de outro lugar) mostra que o foco que vem é do teclado.
  useEffect(() => {
    const tecla = () => { focoDoPonteiro.current = false }
    document.addEventListener('keydown', tecla, true)
    return () => document.removeEventListener('keydown', tecla, true)
  }, [])

  // as letras dos dois lados se afastam quando os traços colidem (os traços não saem do valor); refeito se a largura muda.
  // Sem um dos lados não há o que afastar: o deslocamento que sobrou de antes volta a zero.
  useLayoutEffect(() => {
    const dentro = dentroRef.current, a = letraA.current, b = letraB.current
    const zerar = () => { a?.style.setProperty('--dx', '0px'); b?.style.setProperty('--dx', '0px') }
    const ta = tracos.find(t => t.marca === 'A'), tb = tracos.find(t => t.marca === 'B')
    if (!dentro || !a || !b || !ta || !tb) { zerar(); return }
    const medir = () => {
      const [da, db] = afastarLetras(ta.pct, tb.pct, dentro.getBoundingClientRect().width)
      a.style.setProperty('--dx', `${da}px`); b.style.setProperty('--dx', `${db}px`)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(dentro)
    return () => ro.disconnect()
  }, [tracos])

  // a dica aponta para o centro do traço: refaz a conta quando a janela muda
  const ai = ativo?.i
  useEffect(() => {
    if (ai == null) return
    const re = () => {
      const cx = centro(ticks.current[ai])
      setAtivo(a => (a && a.i === ai && a.cx !== cx ? { ...a, cx } : a))
    }
    window.addEventListener('resize', re)
    document.addEventListener('scroll', re, { capture: true, passive: true })
    return () => { window.removeEventListener('resize', re); document.removeEventListener('scroll', re, { capture: true }) }
  }, [ai])

  // toque: a dica fica depois de levantar o dedo; fecha com um toque fora
  const doPonteiro = ativo?.ponteiro ?? false
  useEffect(() => {
    if (!doPonteiro) return
    const fora = (e: PointerEvent) => { if (!(e.target instanceof Node) || !grupoRef.current?.contains(e.target)) setAtivo(a => (a && a.ponteiro ? null : a)) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [doPonteiro])

  if (!desenha) {
    return (
      <div className="obs-rg-wrap">
        {regua.vazio && <span className="obs-rg-vazio">{regua.vazio}</span>}
        <SemTraco regua={regua} />
      </div>
    )
  }

  const inicial = (): number => {
    const iA = tracos.findIndex(t => t.marca === 'A'), iB = tracos.findIndex(t => t.marca === 'B')
    return iA >= 0 ? iA : iB >= 0 ? iB : tracos.length >> 1
  }
  const maisPerto = (cx: number, cy: number): number => {
    let melhor = -1, menor = Infinity
    ticks.current.forEach((el, i) => {
      if (!el) return
      const b = el.getBoundingClientRect()
      const dx = Math.abs(b.left + b.width / 2 - cx), dy = Math.max(0, Math.abs(b.top + b.height / 2 - cy) - b.height / 2)
      const d = dx * 3 + dy
      if (d < menor) { menor = d; melhor = i }
    })
    return melhor
  }

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (focoDoPonteiro.current) {
      // o foco veio do clique ou do toque (o navegador foca o div tabindex=0): o traço apontado fica, sem fala, e o teclado parte dele
      focoDoPonteiro.current = false
      if (apontado.current >= 0) ultimo.current = apontado.current
      return
    }
    const i = ultimo.current >= 0 ? ultimo.current : inicial()
    ultimo.current = i
    mostrar(i, false, true)
  }
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    focoDoPonteiro.current = false
    ultimo.current = -1
    fechar(); setFala('')
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    focoDoPonteiro.current = false
    const n = tracos.length
    let i = ultimo.current >= 0 ? ultimo.current : inicial()
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': i = Math.min(n - 1, i + 1); break
      case 'ArrowLeft': case 'ArrowDown': i = Math.max(0, i - 1); break
      case 'Home': i = 0; break
      case 'End': i = n - 1; break
      case 'Escape': e.preventDefault(); fechar(); setFala(''); return
      default: return
    }
    e.preventDefault()
    ultimo.current = i
    mostrar(i, false, true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const i = maisPerto(e.clientX, e.clientY)
    if (i >= 0) mostrar(i, true, false)
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const i = maisPerto(e.clientX, e.clientY)
    apontado.current = i
    if (document.activeElement === grupoRef.current) {
      // o grupo já tem o foco: nenhum onFocus virá, não há o que marcar; o teclado passa a partir do traço clicado
      focoDoPonteiro.current = false
      if (i >= 0) ultimo.current = i
    } else {
      // clique e toque focam o grupo (tabindex=0), no mouse na hora e no toque depois do touchend: a marca vale até o foco a consumir
      // (ou até um pointercancel, uma tecla ou um blur a desfazer), nunca por tempo.
      focoDoPonteiro.current = true
    }
    if (i >= 0) mostrar(i, true, false)
  }
  const onPointerCancel = () => { focoDoPonteiro.current = false }
  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return // o dedo levantado não esconde a dica; um toque fora esconde
    if (document.activeElement === grupoRef.current && ultimo.current >= 0) mostrar(ultimo.current, false, false)
    else fechar()
  }

  const t = ativo ? tracos[ativo.i] : undefined
  return (
    <div className="obs-rg-wrap">
      <div ref={grupoRef} className="obs-rg" role="group" tabIndex={0} aria-label={regua.aria}
        onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}>
        <div ref={dentroRef} className="obs-rg-in" aria-hidden="true">
          <i className="obs-rg-base" />
          {tracos.map((tr, i) => {
            const style: Record<string, string> = { '--x': `${tr.pct.toFixed(2)}%`, '--dx': `${tr.dx}px` }
            if (tr.marca) style['--c'] = cores[tr.marca]
            if (tr.pilha) { style.bottom = `${19 + tr.pilha.i * tr.pilha.passo}px`; style.height = `${alturaPilha(tr.pilha.passo)}px` }
            return (
              <i key={tr.id} ref={el => { ticks.current[i] = el }} data-i={i} data-marca={tr.marca ?? undefined}
                className={'obs-rg-t' + (tr.marca ? ' obs-rg-me' : '') + (tr.pilha ? ' obs-rg-pl' : '') + (ativo?.i === i ? ' obs-rg-on' : '')} style={vars(style)} />
            )
          })}
          {tracos.map(tr => tr.marca && (
            <b key={'l' + tr.id} ref={tr.marca === 'A' ? letraA : letraB} data-letra={tr.marca} className="obs-rg-ch"
              style={vars({ '--c': cores[tr.marca], '--x': `${tr.pct.toFixed(2)}%`, '--dx': '0px' })}>{tr.marca}</b>
          ))}
        </div>
      </div>
      <span className="obs-rg-sr" aria-live="polite" aria-atomic="true">{fala}</span>
      <SemTraco regua={regua} />
      <HoverTip show={ativo != null && t != null} anchor={() => grupoRef.current} cx={ativo?.cx} pref="cima" gap={4} maxW={300} className="obs-rg-tip">
        {t && (ativo?.ponteiro && t.grupo.length > 1
          ? <>
            <span className="obs-rg-tip-t">{t.grupo.length} canais com {t.texto}</span>
            <span className="obs-rg-tip-s">{nomesDoGrupo(tracos, t)}</span>
          </>
          : <>
            <span className="obs-rg-tip-t">{t.nome}{t.marca ? ` · lado ${t.marca}` : ''}</span>
            <span className="obs-rg-tip-s">{textoDa(t)}{t.grupo.length > 1 ? ` · ${t.grupo.length} canais com ${t.texto}` : ''}</span>
          </>)}
      </HoverTip>
    </div>
  )
}

/** Os nomes de quem tem o mesmo valor escrito (o lado A ou B é dito ao lado do nome), no máximo seis e "e mais N". */
function nomesDoGrupo(tracos: readonly Traco[], t: Traco): string {
  const todos = tracos.filter(x => x.texto === t.texto).map(x => x.nome + (x.marca ? ` (lado ${x.marca})` : ''))
  return todos.slice(0, NOMES_NA_DICA).join(', ') + (todos.length > NOMES_NA_DICA ? ` e mais ${todos.length - NOMES_NA_DICA}` : '')
}

/** "Sem traço de X: não medido" + o motivo: o lado sem valor não ganha traço, e a tela diz de quem falta e por quê. */
function SemTraco({ regua }: { regua: ReguaView }) {
  if (!regua.semTraco.length) return null
  return (
    <small className="obs-rg-falta">
      {regua.semTraco.map(s => (
        <span key={s.letra} className="obs-rg-falta1"><span className="obs-ch-nm">não medido</span> {s.texto}</span>
      ))}
    </small>
  )
}
