'use client'
/**
 * A5 · E9, Tarefa 10b: o painel de confirmação do apagar e os botões de resposta da fila. As ações chegam por PROP (um componente cliente nunca
 * importa uma ação de servidor). O botão "Apagar para sempre" é `<button disabled>` até o campo valer APAGAR (minúsculas e espaços nas pontas
 * valem); foco no campo ao abrir; Esc fecha e devolve o foco ao botão que abriu; o envio é um só (duplo clique não manda duas).
 */
import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { palavraConfere } from '@/lib/youtube/observatorio/saiu/modelo'
import type { PainelView } from './view-model'

/** O que a tela precisa de volta de uma ação: o desfecho e a frase pronta. */
export interface ResultadoUi { desfecho: string; frase: string }
const MUDOU = new Set(['apagado', 'apagando', 'mantido', 'respondido'])

export interface AcoesDoPainel {
  apagar: (e: { tipo: 'video' | 'canal' | 'comentarios'; id: string; ids?: number[]; palavra: string }) => Promise<ResultadoUi>
}

export function PainelApagar({ rotulo, painel, podeResponder, semPermissao, acoes }: {
  rotulo: string; painel: PainelView; podeResponder: boolean; semPermissao: string | null; acoes: AcoesDoPainel
}) {
  const router = useRouter()
  const uid = useId()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoUi | null>(null)
  const [, iniciar] = useTransition()
  const abre = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const trava = useRef(false)
  const recusada = painel.recusa !== null
  const pode = palavraConfere(texto) && podeResponder && !enviando && !recusada

  function alternar(): void {
    if (aberto) { fechar(); return }
    setAberto(true)
    queueMicrotask(() => campo.current?.focus())
  }
  function fechar(): void {
    setAberto(false)
    setTexto('')
    abre.current?.focus()
  }
  async function enviar(): Promise<void> {
    if (trava.current || !palavraConfere(texto)) return
    trava.current = true
    setEnviando(true)
    try {
      const r = await acoes.apagar({ tipo: painel.alvo.tipo, id: painel.alvo.id, ...(painel.alvo.ids ? { ids: painel.alvo.ids } : {}), palavra: texto })
      setResultado(r)
      if (MUDOU.has(r.desfecho)) iniciar(() => router.refresh())
    } finally {
      trava.current = false
      setEnviando(false)
    }
  }

  const idPainel = `${uid}-cf`
  return (
    <>
      <button type="button" ref={abre} className="sq-btn perigo" aria-expanded={aberto} aria-controls={idPainel} onClick={alternar}>{rotulo}</button>
      <div id={idPainel} className="sq-cf" hidden={!aberto} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); fechar() } }}>
        <p className="sq-cft"><span aria-hidden="true">!</span><span><b>{painel.titulo}</b> {painel.aviso}</span></p>
        {recusada ? <p className="sq-recusa" role="alert">{painel.recusa}</p> : null}
        <div className="sq-2c">
          <section className="sq-col">
            <h4>O que some</h4>
            <ul className="sq-ul">
              {painel.some.map(l => <li key={l.texto}><b className="sq-num">{l.n}</b><span>{l.texto}</span></li>)}
              <li className="ef"><b className="sq-num" aria-hidden="true">→</b><span>{painel.efeito}</span></li>
            </ul>
          </section>
          <section className="sq-col">
            <h4>O que fica</h4>
            <ul className="sq-ul">{painel.fica.map(t => <li key={t}><span>{t}</span></li>)}</ul>
            <h5>O que não sai com o apagar</h5>
            <ul className="sq-ul">{painel.naoSai.map(t => <li key={t}><span>{t}</span></li>)}</ul>
          </section>
        </div>
        <div className="sq-dig">
          <label htmlFor={`${uid}-in`}>Para confirmar, digite <b className="sq-num">{painel.palavra}</b></label>
          <input id={`${uid}-in`} ref={campo} className="sq-in" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false}
            value={texto} disabled={recusada || !podeResponder} onChange={e => setTexto(e.target.value)} />
        </div>
        {semPermissao && !podeResponder ? <p className="sq-hint">{semPermissao}</p> : null}
        <p className="sq-ba">
          <button type="button" className="sq-btn" onClick={fechar}>Cancelar</button>
          <button type="button" className={`sq-btn perigo${pode ? ' pronto' : ''}`} disabled={!pode} onClick={() => { void enviar() }}>Apagar para sempre</button>
        </p>
        {resultado ? <p className="sq-res-acao" role={MUDOU.has(resultado.desfecho) ? 'status' : 'alert'}>{resultado.frase}</p> : null}
      </div>
    </>
  )
}

export interface AcoesDeResposta {
  manter: (e: { tipo: 'video' | 'canal' | 'comentario'; ids: Array<string | number> }) => Promise<ResultadoUi>
  volta: (e: { itemId: number; decisao: 'voltar' | 'ignorar' }) => Promise<ResultadoUi>
  tentar: (e: { itemId: number }) => Promise<ResultadoUi>
  ignorarGrupo: (e: { itemIds: number[] }) => Promise<ResultadoUi>
}

/** Um botão que dispara UMA resposta, desabilita enquanto envia e mostra a frase do desfecho. */
export function BotaoDeResposta({ rotulo, destaque, desabilitado, titulo, executar }: {
  rotulo: string; destaque?: boolean; desabilitado?: boolean; titulo?: string; executar: () => Promise<ResultadoUi[]>
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [frase, setFrase] = useState<ResultadoUi | null>(null)
  const [, iniciar] = useTransition()
  const trava = useRef(false)
  async function clicar(): Promise<void> {
    if (trava.current) return
    trava.current = true
    setEnviando(true)
    try {
      const rs = await executar()
      const ultimo = rs[rs.length - 1] ?? null
      setFrase(ultimo)
      if (rs.some(r => MUDOU.has(r.desfecho))) iniciar(() => router.refresh())
    } finally {
      trava.current = false
      setEnviando(false)
    }
  }
  return (
    <>
      <button type="button" className={`sq-btn${destaque ? ' pri' : ''}`} disabled={desabilitado || enviando} title={titulo} onClick={() => { void clicar() }}>{rotulo}</button>
      {frase ? <span className="sq-res-acao" role={MUDOU.has(frase.desfecho) ? 'status' : 'alert'}>{frase.frase}</span> : null}
    </>
  )
}
