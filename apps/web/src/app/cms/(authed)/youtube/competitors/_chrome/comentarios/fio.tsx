'use client'
// Comentários em produção · T2: o fio único (vídeo e canal). Texto de terceiros é SEMPRE nó de texto React num bloco `dir="auto"`:
// nunca HTML, nunca link. Quem não pode ver o texto não o recebe (`raiz.texto` nulo no nível contagem).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChannelAvatar } from '../channel-avatar'
import { FRASES } from './frases'
import { RESPOSTAS_VISIVEIS, rotuloDoAutor, type AutorDaFala, type CriadorDoFio, type FalaView, type FioView } from './fio-model'
import './fio.css'

const inicialDe = (nome: string): string => Array.from(nome)[0]?.toUpperCase() ?? ''

/** A silhueta de quem comentou (cabeça e ombros): o espectador não tem rosto nem inicial. */
function Silhueta() {
  return (
    <span className="cf-av anon" aria-hidden="true">
      <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="12.5" r="5" className="d" /><path d="M5.5 29c0-6 4.7-9.5 10.5-9.5S26.5 23 26.5 29z" className="d" /></svg>
    </span>
  )
}

/** A foto de quem editou o site (nível identidade): sem Referer, preguiçosa; se o YouTube tirar a foto cai na inicial. */
function FotoDeIdentidade({ url, nome }: { url: string | null; nome: string }) {
  const [quebrou, setQuebrou] = useState(false)
  if (!url || quebrou) return <span className="cf-av" data-avatar="ini" aria-hidden="true"><span className="ini">{inicialDe(nome)}</span></span>
  return (
    <span className="cf-av" data-avatar="img" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" width={32} height={32} referrerPolicy="no-referrer" loading="lazy" onError={() => setQuebrou(true)} />
    </span>
  )
}

export function AvatarDoAutor({ a, criador, pequeno = false }: { a: AutorDaFala; criador: CriadorDoFio; pequeno?: boolean }) {
  if (a.tipo === 'criador') {
    return <ChannelAvatar src={criador.avatar} ini={criador.ini} color={criador.color} className={`cf-av cri${pequeno ? ' sm' : ''}`} />
  }
  if (a.tipo === 'identidade') return <FotoDeIdentidade url={a.fotoUrl} nome={a.nome} />
  return <Silhueta />
}

/** O texto do comentário com corte em 4 linhas; "Ver tudo" só aparece se o texto passa do corte. */
export function TextoDaFala({ texto }: { texto: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [passa, setPassa] = useState(false)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || aberto) return
    const medir = () => setPassa(el.scrollHeight > el.clientHeight + 1)
    medir()
    // fio que montou escondido (display:none) mede 0: mede de novo quando o elemento ganha tamanho
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [texto, aberto])
  return (
    <>
      <div ref={ref} dir="auto" className={`cf-txt${aberto ? ' open' : ''}`}>{texto}</div>
      {passa || aberto ? <button type="button" className="cf-link" aria-expanded={aberto} onClick={() => setAberto((o) => !o)}>{aberto ? FRASES.recolher : FRASES.verTudo}</button> : null}
    </>
  )
}

function Nome({ a, criador }: { a: AutorDaFala; criador: CriadorDoFio }) {
  switch (a.tipo) {
    case 'reservado': return null
    case 'grande': return <span className="cf-nome esp">{FRASES.canalGrandeSemNome(a.faixa)}</span>
    case 'proprio': return <><span className="cf-selo">{FRASES.seloSeuCanal}</span><span className="cf-nome">{FRASES.voceComentou}</span></>
    case 'criador': return <><span className="cf-nome" dir="auto">{rotuloDoAutor(a, criador)}</span><span className="cf-selo">{FRASES.seloCriador}</span></>
    case 'identidade': return <><span className="cf-nome" dir="auto">{rotuloDoAutor(a, criador)}</span><span className="cf-meta">{FRASES.identidadeAte(a.ate)}</span></>
    case 'espectador': return <span className="cf-nome esp">{rotuloDoAutor(a, criador)}</span>
  }
}

const classeDoMotivo = (v: FioView): string => {
  if (v.pastilha) return ` m-${v.pastilha.chave}`
  if (v.raiz.autor.tipo === 'proprio') return ' m-p'
  return v.respostas.length > 0 || v.respostaReservada !== null || v.raiz.autor.tipo === 'criador' ? ' m-k' : ''
}

function Resposta({ f, criador }: { f: FalaView; criador: CriadorDoFio }) {
  return (
    <div className="cf-resp">
      <AvatarDoAutor a={f.autor} criador={criador} pequeno />
      <div className="cf-resp-c">
        <div className="cf-head">
          <Nome a={f.autor} criador={criador} />
          {f.data ? <span className="cf-meta">{f.data}</span> : null}
        </div>
        {f.texto !== null ? <TextoDaFala texto={f.texto} /> : null}
      </div>
    </div>
  )
}

function Respostas({ v, criador }: { v: FioView; criador: CriadorDoFio }) {
  const [todas, setTodas] = useState(false)
  if (v.respostaReservada !== null) return <p className="cf-resp cf-resp-reservada">{v.respostaReservada}</p>
  const visiveis = v.respostas.slice(0, RESPOSTAS_VISIVEIS)
  const outras = v.respostas.slice(RESPOSTAS_VISIVEIS)
  return (
    <>
      {visiveis.map((f, i) => <Resposta key={i} f={f} criador={criador} />)}
      {todas ? outras.map((f, i) => <Resposta key={RESPOSTAS_VISIVEIS + i} f={f} criador={criador} />) : null}
      {outras.length > 0 ? (
        <div className="cf-mais">
          <button type="button" className="cf-link" aria-expanded={todas} onClick={() => setTodas((o) => !o)}>
            {todas ? FRASES.recolher : FRASES.verOutrasRespostas(outras.length)}
          </button>
        </div>
      ) : null}
    </>
  )
}

export function FioDeComentario({ v, criador, densidade, escondido = false, extra }: {
  v: FioView; criador: CriadorDoFio; densidade: 'cartao' | 'lista'; escondido?: boolean; extra?: ReactNode
}) {
  const { raiz, meta, marcas } = v
  return (
    <li id={v.id} tabIndex={-1} hidden={escondido} className={`cf cf-d-${densidade}${classeDoMotivo(v)}${marcas.saido ? ' cf-saiu' : ''}`}>
      <AvatarDoAutor a={raiz.autor} criador={criador} />
      <div className="cf-corpo">
        <div className="cf-head">
          <Nome a={raiz.autor} criador={criador} />
          {v.pastilha ? <span className="cf-motivo">{v.pastilha.texto}</span> : null}
          <span className="cf-meta">
            {raiz.data ? <span>{raiz.data}</span> : null}
            {meta.curtidas !== null ? (
              <span className="cf-likes">
                <svg className="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6S2 10 2 6a3 3 0 0 1 6-.8A3 3 0 0 1 14 6c0 4-6 7.6-6 7.6z" /></svg>
                <span>{meta.curtidas}</span>
                {meta.regua !== null ? <span className="cf-reg" aria-hidden="true"><b style={{ width: `${meta.regua}%` }} /></span> : null}
              </span>
            ) : null}
            {meta.respostas ? <span>{meta.respostas.n === 0 ? <><span className="obs-ch-zero">0</span> respostas</> : meta.respostas.texto}</span> : null}
            {marcas.entrou ? <span className="cf-entrou">{marcas.entrou}</span> : null}
          </span>
          {meta.posicao ? <span className="cf-meta push"><span className="pos num">{meta.posicao}</span></span> : null}
        </div>
        {raiz.texto !== null
          ? <TextoDaFala texto={raiz.texto} />
          : <p className="cf-reservado"><strong>{FRASES.textoReservado}</strong> {FRASES.textoReservadoSub}</p>}
      </div>
      <Respostas v={v} criador={criador} />
      {extra ? <div className="cf-extra">{extra}</div> : null}
    </li>
  )
}
