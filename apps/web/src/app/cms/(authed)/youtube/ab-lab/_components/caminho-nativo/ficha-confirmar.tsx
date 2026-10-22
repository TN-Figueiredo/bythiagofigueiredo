'use client'
// Bloco "Confirmar" do caminho do teste do YouTube. Variante `'linha'` (T7, D-8): a pergunta "Você iniciou o teste do YouTube
// neste vídeo?" aberta NA PRÓPRIA LINHA da lista, sem modal. A variante `'ficha'` (bloco 3 da ficha) chega na T9a, neste arquivo.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { motivoDoErro, type MotivoErro } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import type { AcoesCaminho } from './lista-caminho'
import '../caminho-nativo.css'
import '../lista-caminho.css'

const DIA_MS = 86_400_000
/** Início hoje + 14 d + 2 d de margem (guarda.ts): o prazo que a consequência promete. */
const PRAZO_DIAS = 16

export interface FichaConfirmarLinhaProps {
  variante: 'linha'
  fichaId: string
  enviadaEm: Date
  /** A ficha tem a versão B. Sem ela só se oferece "Ainda não, seguir com o nosso teste". */
  completa: boolean
  jaIniciei: AcoesCaminho['jaIniciei']
  agora: () => Date
  aoSeguirComNosso: () => void
  aoFechar: () => void
  /** O registro foi gravado: a lista relê. */
  aoRegistrar: () => void
}
export type FichaConfirmarProps = FichaConfirmarLinhaProps

type Fase = { tipo: 'pergunta' } | { tipo: 'ask' } | { tipo: 'enviando' } | { tipo: 'erro'; motivo: MotivoErro } | { tipo: 'registrada' }

export function FichaConfirmar(p: FichaConfirmarProps): ReactElement {
  const [fase, setFase] = useState<Fase>({ tipo: 'pergunta' })
  const titulo = useRef<HTMLHeadingElement>(null)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => { titulo.current?.focus() }, [])

  function teclas(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    p.aoFechar()
  }

  async function confirmar(): Promise<void> {
    setFase({ tipo: 'enviando' })
    try {
      const r = await p.jaIniciei(p.fichaId)
      if (r.ok) { setFase({ tipo: 'registrada' }); p.aoRegistrar(); return }
      const motivo = motivoDoErro(r.erro)
      Sentry.captureMessage('ficha: já iniciei recusado', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { fichaId: p.fichaId, motivo } })
      setFase({ tipo: 'erro', motivo })
    } catch {
      setFase({ tipo: 'erro', motivo: motivoDoErro('rede') })
    }
  }

  const prazo = new Date(p.agora().getTime() + PRAZO_DIAS * DIA_MS)

  return (
    <div className="cn-pergunta" ref={raiz} onKeyDown={teclas} data-fase={fase.tipo}>
      {fase.tipo === 'registrada' ? (
        <p role="status" className="cn-meta">{FRASES.ficha.registrada(prazo).frase}</p>
      ) : (
        <>
          <h3 tabIndex={-1} ref={titulo}>{FRASES.guarda.pergunta}</h3>
          {fase.tipo === 'ask' || fase.tipo === 'enviando' ? (
            <>
              <p>{FRASES.ficha.confirmarConsequencia(prazo)}</p>
              <div className="cn-acts">
                <button type="button" className="cn-btn" disabled={fase.tipo === 'enviando'} onClick={() => { void confirmar() }}>{FRASES.ficha.bloco3.confirmar}</button>
                <button type="button" className="cn-btn ghost" disabled={fase.tipo === 'enviando'} onClick={() => setFase({ tipo: 'pergunta' })}>{FRASES.ficha.bloco3.voltar}</button>
              </div>
            </>
          ) : (
            <>
              {p.completa ? <p>{FRASES.guarda.perguntaApoio(p.enviadaEm)}</p> : (
                <>
                  <p>{FRASES.guarda.perguntaApoio(p.enviadaEm)}</p>
                  <p><strong>{FRASES.guarda.perguntaIncompleta}</strong></p>
                </>
              )}
              {fase.tipo === 'erro' ? <MensagemDeErro motivo={fase.motivo} aoTentar={() => setFase({ tipo: 'ask' })} aoAtualizar={p.aoRegistrar} /> : null}
              <div className="cn-acts">
                {p.completa ? <button type="button" className="cn-btn" onClick={() => setFase({ tipo: 'ask' })}>{FRASES.guarda.jaIniciei}</button> : null}
                <button type="button" className="cn-btn" onClick={p.aoSeguirComNosso}>{FRASES.guarda.aindaNaoSeguir}</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function MensagemDeErro({ motivo, aoTentar, aoAtualizar }: { motivo: MotivoErro; aoTentar: () => void; aoAtualizar: () => void }): ReactElement {
  const m = FRASES.motivo
  const texto = motivo === 'incompleta' ? m.incompleta.forte + m.incompleta.resto
    : motivo === 'ja_ha_teste' ? m.ja_ha_teste.forte(new Date()) + m.ja_ha_teste.resto
    : motivo === 'estado_mudou' ? m.estado_mudou.forte + m.estado_mudou.resto(null)
    : m.sem_conexao.forte
  const acao = motivo === 'sem_conexao' ? { rotulo: m.sem_conexao.acao, ao: aoTentar }
    : motivo === 'ja_ha_teste' ? { rotulo: m.ja_ha_teste.acao, ao: aoAtualizar }
    : motivo === 'estado_mudou' ? { rotulo: m.estado_mudou.acao, ao: aoAtualizar }
    : null
  return (
    <div role="alert" className="cn-erro">
      <p>{texto}</p>
      {acao ? <button type="button" className="cn-lnk" onClick={acao.ao}>{acao.rotulo}</button> : null}
    </div>
  )
}

