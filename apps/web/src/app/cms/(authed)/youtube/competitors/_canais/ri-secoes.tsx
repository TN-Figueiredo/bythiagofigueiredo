'use client'
/**
 * Seções Referências e Inscritos da tela Canais (R3). Desenham uma `RiView` pronta; ordenar e "Ver todos" mexem só no
 * estado local e na URL (history.replaceState, sem router.replace e sem nova ida ao servidor). A aba (390 px) é lembrada
 * em localStorage. Nenhuma frase de dado nasce aqui: só rótulos de controle.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { RiInfo } from './ri-info'
import { RiBarra, RiEscala, RiRegua } from './ri-regua'
import type { RiFrase, RiLinhaIns, RiLinhaRef, RiPilula, RiSecao, RiView } from './ri-tipos'
import './ri.css'

const LIMITE = 10
const CHAVE_ABA = 'ri-aba'

function Pilula({ p }: { p: RiPilula }) {
  return <span className={p.tipo === 'nm' ? 'pill nm2' : 'pill pont'}>{p.texto}</span>
}

function Frase({ frase }: { frase: RiFrase }) {
  return (
    <p className="ri-lead">
      {frase.map((x, i) => (x.b ? <b key={i}>{x.t}</b> : <span key={i}>{x.t}</span>))}
    </p>
  )
}

function Nome({ nome, proprio, rank }: { nome: string; proprio: boolean; rank: number | null }) {
  return (
    <div className="ri-nome">
      <span className="ri-rk">{rank ?? '–'}</span>
      <span className="n" title={nome}>
        {nome}
      </span>
      {proprio ? <span className="ri-chip">seu canal</span> : null}
    </div>
  )
}

/** `navigator.onLine` só existe no cliente: o servidor e a 1ª pintura saem sem o prefixo (sem divergência de hidratação). */
function useOffline(): boolean {
  const [off, setOff] = useState(false)
  useEffect(() => {
    const atualiza = () => setOff(navigator.onLine === false)
    atualiza()
    window.addEventListener('online', atualiza)
    window.addEventListener('offline', atualiza)
    return () => { window.removeEventListener('online', atualiza); window.removeEventListener('offline', atualiza) }
  }, [])
  return off
}

function Aviso({ texto }: { texto: string }) {
  const off = useOffline()
  return (
    <p className="ri-aviso" role="status">
      {off ? 'Sem conexão. ' : ''}{texto}
    </p>
  )
}

function Erro({ texto, ultimaBoa }: { texto: string; ultimaBoa: string | null }) {
  const router = useRouter()
  return (
    <p className="ri-aviso err" role="alert">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M8 2l6.5 11.5h-13z" />
        <path d="M8 6.5v3.2M8 11.6v.1" />
      </svg>
      <span>{texto}</span>
      <button type="button" className="btn" onClick={() => router.refresh()}>
        Tentar de novo
      </button>
      {ultimaBoa ? <span>Última leitura boa: {ultimaBoa}</span> : null}
    </p>
  )
}

/** Ids na ordem escolhida (com a posição como rank); depois as linhas fora da ordem, na ordem em que vieram. */
function sequencia<L extends { id: string }>(linhas: L[], ids: string[]): Array<{ l: L; rank: number | null }> {
  const porId = new Map(linhas.map((l) => [l.id, l]))
  const dentro: Array<{ l: L; rank: number | null }> = []
  const usados = new Set<string>()
  ids.forEach((id) => {
    const l = porId.get(id)
    if (l && !usados.has(id)) {
      usados.add(id)
      dentro.push({ l, rank: dentro.length + 1 })
    }
  })
  const fora = linhas.filter((l) => !usados.has(l.id)).map((l) => ({ l, rank: null }))
  return [...dentro, ...fora]
}

function classeLi(i: number, proprio: boolean): string {
  if (i < LIMITE) return ''
  return proprio ? 'extra pin' : 'extra'
}

const SW_REF = ['sw-mk', 'sw-band', 'sw-pv', 'nm-h']

function Legenda({ itens, tipo }: { itens: string[]; tipo: 'ref' | 'ins' }) {
  const glifos = [
    <span key="u" className="dir up">▲</span>,
    <span key="d" className="dir dn">▼</span>,
    <span key="e" className="dir eq">＝</span>,
  ]
  const marca = (i: number): ReactNode => {
    if (tipo === 'ref') return i < SW_REF.length ? <i className={SW_REF[i]} aria-hidden="true" /> : null
    if (i < 3) return glifos[i]
    return i === 3 ? <i className="nm-h" aria-hidden="true" /> : null
  }
  const nMarcados = 4
  const marcados = itens.slice(0, nMarcados)
  const resto = itens.slice(nMarcados)
  return (
    <>
      <p className="ri-leg">
        {marcados.map((t, i) => (
          <span key={i}>
            {marca(i)} {t}
          </span>
        ))}
      </p>
      {resto.map((t, i) => (
        <p key={i} className="ri-leg">
          {t}
        </p>
      ))}
    </>
  )
}

function BotaoVerTodos({ n, aberto, onClick }: { n: number; aberto: boolean; onClick: () => void }) {
  if (n <= LIMITE) return null
  return (
    <button type="button" className="btn ri-more" aria-expanded={aberto} onClick={onClick}>
      {aberto ? 'Ver só os 10 primeiros' : `Ver todos os ${n}`}
    </button>
  )
}

interface SecaoProps<O extends string> {
  idAncora: string
  idTitulo: string
  titulo: string
  ocupada: boolean
  rotuloInfo: string
  ordemAtual: O
  ordenar: (o: O) => void
  aberto: boolean
  alternaVerTodos: () => void
}

function RefSecao({ secao, ticks, p }: { secao: RiSecao<RiLinhaRef, 'mediana' | 'faixa'>; ticks: RiView['ticks']; p: SecaoProps<'mediana' | 'faixa'> }) {
  return (
    <section className="ri-sec ri-s-ref" id={p.idAncora} aria-labelledby={p.idTitulo} aria-busy={p.ocupada}>
      <h2 id={p.idTitulo}>{p.titulo}</h2>
      {secao.estado === 'erro' ? (
        <Erro texto={secao.texto} ultimaBoa={secao.ultimaBoa} />
      ) : secao.estado === 'vazio' ? (
        <div className="ri-vazio">
          <b>{secao.titulo}</b> {secao.texto}
        </div>
      ) : (
        <>
          <div className="ri-head">
            <Frase frase={secao.frase} />
            <RiInfo titulo={secao.info.titulo} itens={secao.info.itens} rotuloBotao={p.rotuloInfo} />
          </div>
          <div className="ri-ctl">
            <span>Ordenar por</span>
            {(['mediana', 'faixa'] as const).map((o) => (
              <button key={o} type="button" className="btn" aria-pressed={p.ordemAtual === o} onClick={() => p.ordenar(o)}>
                {secao.ordens[o].rotulo}
              </button>
            ))}
          </div>
          <Legenda itens={secao.legenda} tipo="ref" />
          <div>
            <RiEscala ticks={ticks} />
            <ol className={p.aberto ? 'ri-lst all' : 'ri-lst'}>
              {sequencia(secao.linhas, secao.ordens[p.ordemAtual].ids).map(({ l, rank }, i) => (
                <li key={l.id} className={classeLi(i, l.proprio)}>
                  <Nome nome={l.nome} proprio={l.proprio} rank={rank} />
                  {l.marca != null ? <RiRegua linha={l} ticks={ticks} /> : <div>{l.pilula ? <Pilula p={l.pilula} /> : null}</div>}
                  <div className="ri-val">
                    {l.valor}
                    {l.marca != null && (l.pilula || l.sub) ? <small>{l.pilula ? <Pilula p={l.pilula} /> : l.sub}</small> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <BotaoVerTodos n={secao.n} aberto={p.aberto} onClick={p.alternaVerTodos} />
        </>
      )}
    </section>
  )
}

const GLIFO: Record<'up' | 'dn' | 'eq', string> = { up: '▲', dn: '▼', eq: '＝' }

function LinhaIns({ l, rank, i, ordem }: { l: RiLinhaIns; rank: number | null; i: number; ordem: 'pct' | 'abs' }) {
  const medida = l.classe != null && l.barra != null
  return (
    <li className={classeLi(i, l.proprio)}>
      <Nome nome={l.nome} proprio={l.proprio} rank={rank} />
      {medida ? <RiBarra linha={l} ordem={ordem} /> : <div className="dv sm">{l.pilula ? <Pilula p={l.pilula} /> : null}</div>}
      <div className="ri-val">
        {medida && l.classe ? (
          <span className={`dir ${l.classe}`}>
            <span aria-hidden="true">{GLIFO[l.classe]}</span> {l.pct}
          </span>
        ) : null}
        {l.sub || l.nota ? <small>{medida ? l.sub : l.nota ?? l.sub}</small> : null}
      </div>
    </li>
  )
}

function InsSecao({ secao, p }: { secao: RiSecao<RiLinhaIns, 'pct' | 'abs'>; p: SecaoProps<'pct' | 'abs'> }) {
  return (
    <section className="ri-sec ri-s-ins" id={p.idAncora} aria-labelledby={p.idTitulo} aria-busy={p.ocupada}>
      <h2 id={p.idTitulo}>{p.titulo}</h2>
      {secao.estado === 'erro' ? (
        <Erro texto={secao.texto} ultimaBoa={secao.ultimaBoa} />
      ) : secao.estado === 'vazio' ? (
        <div className="ri-vazio">
          <b>{secao.titulo}</b> {secao.texto}
        </div>
      ) : (
        <>
          <div className="ri-head">
            <Frase frase={secao.frase} />
            <RiInfo titulo={secao.info.titulo} itens={secao.info.itens} rotuloBotao={p.rotuloInfo} />
          </div>
          <div className="ri-ctl">
            <span>Ordenar por</span>
            {(['pct', 'abs'] as const).map((o) => (
              <button key={o} type="button" className="btn" aria-pressed={p.ordemAtual === o} onClick={() => p.ordenar(o)}>
                {secao.ordens[o].rotulo}
              </button>
            ))}
          </div>
          <Legenda itens={secao.legenda} tipo="ins" />
          {secao.ordens[p.ordemAtual].legendaBarra ? <p className="ri-leg">{secao.ordens[p.ordemAtual].legendaBarra}</p> : null}
          <ol className={p.aberto ? 'ri-lst all' : 'ri-lst'}>
            {sequencia(secao.linhas, secao.ordens[p.ordemAtual].ids).map(({ l, rank }, i) => (
              <LinhaIns key={l.id} l={l} rank={rank} i={i} ordem={p.ordemAtual} />
            ))}
          </ol>
          <BotaoVerTodos n={secao.n} aberto={p.aberto} onClick={p.alternaVerTodos} />
        </>
      )}
    </section>
  )
}

/** Linha de atalhos do topo da tela (RI-D1): "Referências · Inscritos". */
export function RiAtalhos({ ri }: { ri: Pick<RiView, 'atalhos'> }) {
  return (
    <nav className="ri-atalhos" aria-label="Seções abaixo da lista">
      {ri.atalhos.map((a, i) => (
        <span key={a.href}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <a href={a.href}>{a.rotulo}</a>
        </span>
      ))}
    </nav>
  )
}

function gravaUrl(chave: string, valor: string) {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set(chave, valor)
    window.history.replaceState(window.history.state, '', u.toString())
  } catch {
    /* URL é conforto, nunca quebra a tela */
  }
}

export function RiSecoes({ ri, ocupada }: { ri: RiView; ocupada: boolean }) {
  const [ordR, setOrdR] = useState(ri.ordem.ref)
  const [ordI, setOrdI] = useState(ri.ordem.ins)
  const [aba, setAba] = useState(ri.aba)
  const [verR, setVerR] = useState(false)
  const [verI, setVerI] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const urlTemAba = useRef(false)

  useEffect(() => {
    try {
      urlTemAba.current = new URL(window.location.href).searchParams.has('aba')
      if (urlTemAba.current) return
      const guardada = window.localStorage.getItem(CHAVE_ABA)
      if (guardada === 'ref' || guardada === 'ins') setAba(guardada)
    } catch {
      /* localStorage pode lançar (modo privado): fica a aba do servidor */
    }
  }, [])

  function trocaAba(a: 'ref' | 'ins') {
    setAba(a)
    gravaUrl('aba', a)
    try {
      window.localStorage.setItem(CHAVE_ABA, a)
    } catch {
      /* idem */
    }
  }

  const refOk = ri.referencias.estado === 'ok' ? ri.referencias : null
  const insOk = ri.inscritos.estado === 'ok' ? ri.inscritos : null

  return (
    <div className="ri" data-aba={aba}>
      {ri.aviso ? <Aviso texto={ri.aviso} /> : null}
      <div className="ri-abas" role="group" aria-label="Seção">
        <button type="button" className="btn" aria-pressed={aba === 'ref'} onClick={() => trocaAba('ref')}>
          Referências
        </button>
        <button type="button" className="btn" aria-pressed={aba === 'ins'} onClick={() => trocaAba('ins')}>
          Inscritos
        </button>
      </div>
      <RefSecao
        secao={ri.referencias}
        ticks={ri.ticks}
        p={{
          idAncora: 'referencias',
          idTitulo: 'ri-h-ref',
          titulo: 'Referências',
          ocupada,
          rotuloInfo: 'Como é calculado: Referências',
          ordemAtual: ordR,
          ordenar: (o) => {
            setOrdR(o)
            gravaUrl('ordr', o)
            if (refOk) setAnuncio(`Referências ordenadas por ${refOk.ordens[o].rotulo}`)
          },
          aberto: verR,
          alternaVerTodos: () => setVerR((v) => !v),
        }}
      />
      <InsSecao
        secao={ri.inscritos}
        p={{
          idAncora: 'inscritos',
          idTitulo: 'ri-h-ins',
          titulo: 'Inscritos',
          ocupada,
          rotuloInfo: 'Como é calculado: Inscritos',
          ordemAtual: ordI,
          ordenar: (o) => {
            setOrdI(o)
            gravaUrl('ordi', o)
            if (insOk) setAnuncio(`Inscritos ordenados por ${insOk.ordens[o].rotulo}`)
          },
          aberto: verI,
          alternaVerTodos: () => setVerI((v) => !v),
        }}
      />
      <div className="ri-live" role="status" aria-live="polite">
        {anuncio}
      </div>
    </div>
  )
}
