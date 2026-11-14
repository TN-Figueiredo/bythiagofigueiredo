'use client'
// A tela inteira (pedido e estados). As actions chegam por props (regra Next 16: nada de `next/link` nem de import de action aqui).
// Botões `disabled` até a hidratação: sem JS o POST + 303 externo esbarraria em `form-action 'self'` (Yannis I7).
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { FRASES_DA_TELA as F } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { ESTILO } from './estilo'
import { caminhoDoLogin, type AcaoDaTela, type DadosDoPedido, type EstadoDaTela } from './tipos'

interface Props {
  authorizationId: string
  inicial: EstadoDaTela | null
  pedido: DadosDoPedido | null
  aprovar: AcaoDaTela
  negar: AcaoDaTela
}

type Ocupado = 'aprovando' | 'negando' | null
type Saindo = 'aprovado' | 'negado' | null

const GLIFO: Record<EstadoDaTela['estado'], string> = {
  sem_login: '→', sem_direito: '⊘', cortado: '✋', desligado: '⏻', invalido: '◷', outro_navegador: '◷', erro: '!',
}
const TOM: Record<EstadoDaTela['estado'], string> = {
  sem_login: 'tone', sem_direito: 'tone', cortado: 'tone tone-amber', desligado: 'tone', invalido: 'tone tone-amber', outro_navegador: 'tone tone-amber', erro: 'tone tone-red',
}

export function Consentimento({ authorizationId, inicial, pedido, aprovar, negar }: Props): ReactElement {
  const [pronto, setPronto] = useState(false)
  const [estado, setEstado] = useState<EstadoDaTela | null>(inicial)
  const [ocupado, setOcupado] = useState<Ocupado>(null)
  const [saindo, setSaindo] = useState<Saindo>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const h1 = useRef<HTMLHeadingElement>(null)
  const primeira = useRef(true)

  useEffect(() => setPronto(true), [])
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    h1.current?.focus()
  }, [estado, saindo])

  async function executar(acao: AcaoDaTela, quem: Exclude<Ocupado, null>): Promise<void> {
    if (!pronto || ocupado !== null || !formRef.current) return
    const fd = new FormData(formRef.current)
    setOcupado(quem)
    try {
      setEstado(await acao(fd))
      setOcupado(null)
    } catch (e) {
      // O Next entrega o redirect externo da action como exceção: a conexão já foi criada (ou negada); a tela fica ocupada até o navegador sair.
      if (isRedirectError(e)) {
        setSaindo(quem === 'aprovando' ? 'aprovado' : 'negado')
        return
      }
      setEstado({ estado: 'erro', codigo: 'c1-sem-resposta' })
      setOcupado(null)
    }
  }

  const corpo = saindo && pedido ? <Saida saindo={saindo} ia={pedido.ia} h1={h1} /> : estado ? <Estado estado={estado} pedido={pedido} authorizationId={authorizationId} h1={h1} ocupado={ocupado} voltar={() => void executar(negar, 'negando')} /> : pedido ? (
    <Pedido pedido={pedido} authorizationId={authorizationId} h1={h1} ocupado={ocupado} pronto={pronto} formRef={formRef} aprovar={() => void executar(aprovar, 'aprovando')} negar={() => void executar(negar, 'negando')} />
  ) : null

  return (
    <div className="c1c">
      <style>{ESTILO}</style>
      {/* o form existe também nos estados, para o "Voltar" (negar) poder ler o id */}
      {estado ? (
        <form ref={formRef} onSubmit={(e) => e.preventDefault()} hidden>
          <input type="hidden" name="authorization_id" value={authorizationId} />
        </form>
      ) : null}
      {corpo}
    </div>
  )
}

function Marca(): ReactElement {
  return (
    <div className="brand">
      <b aria-hidden="true">T</b>bythiagofigueiredo.com
    </div>
  )
}

function Cabeca({ glifo, titulo, h1 }: { glifo: string; titulo: string; h1: React.RefObject<HTMLHeadingElement | null> }): ReactElement {
  return (
    <>
      <Marca />
      <div className="hd">
        <div className="badge" aria-hidden="true">{glifo}</div>
        <h1 tabIndex={-1} ref={h1}>{titulo}</h1>
      </div>
    </>
  )
}

function Saida({ saindo, ia, h1 }: { saindo: 'aprovado' | 'negado'; ia: string; h1: React.RefObject<HTMLHeadingElement | null> }): ReactElement {
  return saindo === 'aprovado' ? (
    <article className="card tone tone-accent" aria-busy="true">
      <Cabeca glifo="✓" titulo={F.aprovado_titulo(ia)} h1={h1} />
      <p className="msg" role="status">{F.aprovado_voltando(ia)}</p>
      <p className="fine">{F.aprovado_manual(ia)}</p>
    </article>
  ) : (
    <article className="card tone" aria-busy="true">
      <Cabeca glifo="⊘" titulo={F.negado_titulo} h1={h1} />
      <p className="msg" role="status">{F.negado(ia)}</p>
    </article>
  )
}

function Estado({ estado, pedido, authorizationId, h1, ocupado, voltar }: { estado: EstadoDaTela; pedido: DadosDoPedido | null; authorizationId: string; h1: React.RefObject<HTMLHeadingElement | null>; ocupado: Ocupado; voltar: () => void }): ReactElement {
  const e = estado.estado
  const titulo = { sem_login: F.sem_login_titulo, sem_direito: F.sem_direito_titulo, cortado: F.cortado_titulo, desligado: F.desligado_titulo, invalido: F.invalido_titulo, outro_navegador: F.outro_navegador_titulo, erro: F.erro_titulo }[e]
  const texto = { sem_login: F.sem_login, sem_direito: F.sem_direito, cortado: F.cortado, desligado: F.desligado, invalido: F.invalido, outro_navegador: F.outro_navegador, erro: F.erro }[e]
  // "Voltar" nega o pedido: só onde há pedido resolvido (IA conhecida) e a negação é possível (não com as travas fechadas, não com o pedido já inválido).
  const podeVoltar = pedido !== null && (e === 'sem_direito' || e === 'cortado')
  return (
    <article className={`card ${TOM[e]}`} aria-busy={ocupado !== null ? true : undefined}>
      <Cabeca glifo={GLIFO[e]} titulo={titulo} h1={h1} />
      <p className="msg" role={e === 'erro' ? 'alert' : 'status'}>{texto}</p>
      {estado.estado === 'sem_login' ? (
        <div className="btns"><a className="btn go" href={caminhoDoLogin(authorizationId)}>{F.entrar}</a></div>
      ) : null}
      {podeVoltar ? (
        <div className={`btns${e === 'sem_direito' ? ' pair' : ''}`}>
          <button type="button" className="btn no" disabled={ocupado !== null} onClick={voltar}>{F.voltar(pedido.ia)}</button>
          {e === 'sem_direito' ? (
            <form className="sair" method="post" action="/cms/logout"><button type="submit" className="btn no" style={{ width: '100%' }}>{F.sair}</button></form>
          ) : null}
        </div>
      ) : null}
      {estado.estado === 'erro' ? (
        <>
          <div className="btns"><button type="button" className="btn no" onClick={() => window.location.reload()}>{F.tentar_de_novo}</button></div>
          <p className="fine">{F.erro_codigo} <code>{estado.codigo}</code></p>
        </>
      ) : null}
    </article>
  )
}

function Pedido({ pedido, authorizationId, h1, ocupado, pronto, formRef, aprovar, negar }: { pedido: DadosDoPedido; authorizationId: string; h1: React.RefObject<HTMLHeadingElement | null>; ocupado: Ocupado; pronto: boolean; formRef: React.RefObject<HTMLFormElement | null>; aprovar: () => void; negar: () => void }): ReactElement {
  const ia = pedido.ia
  const trava = !pronto || ocupado !== null
  return (
    <article className="card tone tone-accent">
      <Cabeca glifo="🔒" titulo={F.titulo(ia)} h1={h1} />
      <p className="lead">{pedido.privado ? F.resumo_privado(ia) : F.resumo_publico(ia)}</p>
      {pedido.email ? (
        <>
          <p className="who">{F.voce_entrou} <b>{pedido.email}</b></p>
          <form className="sair" method="post" action="/cms/logout"><button type="submit" className="btn no" style={{ height: 44, border: 0, width: 'auto', textDecoration: 'underline', background: 'transparent' }}>{F.nao_e_voce}</button></form>
        </>
      ) : null}
      <p className={`when${pedido.tarde ? ' late' : ''}`}><span>{F.pedido_as(ia, pedido.hora)}</span></p>
      <div className="lists">
        <div>
          <h2>{F.pode(ia)}</h2>
          <ul>
            <li>✓ <span>{F.pode_concorrentes}</span></li>
            {pedido.privado ? <li>✓ <span>{F.pode_privado}</span></li> : null}
          </ul>
        </div>
        <div>
          <h2>{F.nao_pode}</h2>
          <ul>
            <li>✕ <span>{F.nao_escrever}</span></li>
            <li>✕ <span>{F.nao_outras_partes}</span></li>
            {pedido.privado ? null : <li>✕ <span>{F.nao_privado}</span></li>}
          </ul>
        </div>
      </div>
      <ul className="risk">
        <li>{F.risco_sai(ia)}</li>
        {pedido.valeAte ? <li>{F.risco_vale_ate(pedido.valeAte)}</li> : null}
        <li>{F.risco_corta}</li>
      </ul>
      <div className="alert" role="note">
        <strong>{F.aviso(ia)}</strong>
        <span>{pedido.tarde ? F.aviso_tarde : F.aviso_detalhe}</span>
      </div>
      {pedido.jaConectado ? <p className="note">{F.ja_conectado(ia)}</p> : null}
      <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="authorization_id" value={authorizationId} />
        {ocupado === 'aprovando' ? <p className="sr-only" role="status">{F.aprovando}</p> : null}
        <div className="btns pair" aria-busy={ocupado !== null ? true : undefined}>
          <button type="button" className="btn go" disabled={trava} onClick={aprovar}>{ocupado === 'aprovando' ? F.aprovando : F.aprovar}</button>
          <button type="button" className="btn no" disabled={trava} onClick={negar}>{F.negar}</button>
        </div>
      </form>
    </article>
  )
}
