'use client'
// A5 · E5a · Tarefa C2: o cartão de um comentário. Texto de terceiros é SEMPRE nó de texto React num bloco `dir="auto"`:
// nunca HTML, nunca link. Quem não pode ver o texto não o recebe (o campo `texto` do modelo é nulo no nível contagem).
import { useEffect, useRef, useState } from 'react'
import { FRASES } from './frases'
import type { AutorView, CartaoView, CurtidaView, RespostaView } from './model'
import './comentarios.css'

function Autor({ a }: { a: AutorView }) {
  switch (a.tipo) {
    case 'identidade':
      return (
        <p className="cd-autor">
          {a.fotoUrl ? <img className="cd-foto" src={a.fotoUrl} alt="" width={24} height={24} /> : null}
          <strong dir="auto">{a.nome}</strong> <span className="cd-autor-n">{FRASES.identidadeAte(a.ate)}</span>
        </p>
      )
    case 'criador': return <p className="cd-autor"><strong dir="auto">{a.nome}</strong> <span className="cd-selo-c">{FRASES.seloCriador}</span></p>
    case 'proprio': return <p className="cd-autor"><span className="cd-selo-c">{FRASES.seloSeuCanal}</span> {FRASES.voceComentou}</p>
    case 'grande': return <p className="cd-faixa-grande">{FRASES.canalGrandeSemNome}</p>
    case 'reservado': return <p className="cd-autor cd-reservado">{FRASES.autorReservado}</p>
    case 'espectador': return <p className="cd-autor">{FRASES.espectador}</p>
  }
}

function Texto({ t }: { t: NonNullable<CartaoView['texto']> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [passa, setPassa] = useState(false)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (el && !aberto) setPassa(el.scrollHeight > el.clientHeight + 1)
  }, [t.texto, aberto])
  return (
    <>
      <div ref={ref} dir="auto" className={`cd-texto${aberto ? ' aberto' : ''}`}>{t.texto}</div>
      {passa || aberto ? <button type="button" className="cd-link" aria-expanded={aberto} onClick={() => setAberto(o => !o)}>{aberto ? FRASES.mostrarMenos : FRASES.verTudo}</button> : null}
      {t.cortado ? <p className="cd-nota">{FRASES.cortadoAos}</p> : null}
      {t.temEndereco ? <p className="cd-nota">{FRASES.temEndereco}</p> : null}
    </>
  )
}

function Resposta({ r }: { r: RespostaView }) {
  if (r.forma !== 'respondeu') return <p className={`cd-resp cd-resp-${r.forma}`}>{r.texto}</p>
  return (
    <div className="cd-resp cd-resp-respondeu">
      {r.reservado ? <p>{r.reservado}</p> : (
        <>
          <p><strong>{r.titulo}</strong> <span className="cd-selo-c">{FRASES.seloCriador}</span></p>
          {(r.textos ?? []).map((x, i) => <div key={i} dir="auto" className="cd-texto cd-texto-resp">{x.texto}</div>)}
        </>
      )}
    </div>
  )
}

function Curtidas({ cs }: { cs: CurtidaView[] }) {
  return (
    <ul className="cd-curtidas">
      {cs.map(c => (
        <li key={c.marco} className={`cd-cur cd-cur-${c.tipo}`}>
          <span className="cd-cur-r">{c.rotulo}</span>
          <span className="cd-cur-b" aria-hidden="true"><span style={{ width: `${c.pct}%` }} /></span>
          <span className="cd-cur-v">{c.tipo === 'n' ? <><span className="obs-md-sr">{c.rotulo}: </span>{c.texto}</> : c.texto}</span>
        </li>
      ))}
    </ul>
  )
}

export function Cartao({ v, escondido = false, hrefFilaSaiu }: { v: CartaoView; escondido?: boolean; hrefFilaSaiu?: string }) {
  return (
    <li id={v.id} tabIndex={-1} hidden={escondido} className={`cd-cartao cd-g-${v.chave}${v.saidoDosDoze ? ' cd-saiu-dos-doze' : ''}`}>
      <header className="cd-cartao-h">
        <span className="cd-pos">{v.rotuloDaPosicao}</span>
        <span className={`cd-etq cd-g-${v.chave}`}>{v.motivo}</span>
        {v.entrouNoDia ? <span className="cd-entrou">{v.entrouNoDia}</span> : null}
      </header>
      <Autor a={v.autor} />
      {v.texto ? <Texto t={v.texto} /> : (
        <p className="cd-reservado"><strong>{FRASES.textoReservado}</strong> {FRASES.textoReservadoSub}</p>
      )}
      {v.resposta ? <Resposta r={v.resposta} /> : null}
      <Curtidas cs={v.curtidas} />
      {v.base ? (
        <div className="cd-base">
          {v.base.tamanho ? <Degraus rotulo={v.base.tamanho.texto} n={v.base.tamanho.degrau} /> : null}
          {v.base.razao === 'nao_medida'
            ? <p><span className="obs-ch-nm cd-selo" title={FRASES.razaoNaoMedidaLonga}>{FRASES.razaoNaoMedida}</span> <span className="cd-nota">{FRASES.razaoNaoMedidaLonga}</span></p>
            : <Degraus rotulo={v.base.razao.texto} n={v.base.razao.degrau} />}
        </div>
      ) : null}
      {v.saiu ? (
        <p className="cd-saiu">
          <span className="cd-selo cd-selo-erro">{v.saiu}</span>
          {hrefFilaSaiu ? <> <a className="cd-link" href={hrefFilaSaiu}>{FRASES.verNaFila}</a></> : null}
        </p>
      ) : null}
      {v.rodape.publicado || v.rodape.respostas ? (
        <p className="cd-rodape">
          {v.rodape.publicado}{v.rodape.publicado && v.rodape.respostas ? ' · ' : ''}
          {v.rodape.respostas ? (v.rodape.respostas.n === 0 ? <><span className="obs-ch-zero">0</span> respostas</> : v.rodape.respostas.texto) : null}
        </p>
      ) : null}
    </li>
  )
}

function Degraus({ rotulo, n }: { rotulo: string; n: number }) {
  return (
    <p className="cd-degraus">
      <span className="cd-deg" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
      <span>{rotulo}</span>
    </p>
  )
}
