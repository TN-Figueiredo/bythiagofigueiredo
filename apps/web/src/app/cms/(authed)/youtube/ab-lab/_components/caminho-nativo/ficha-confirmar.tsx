'use client'
// Bloco "Confirmar" do caminho do teste do YouTube. Variante `'linha'` (T7, D-8): a pergunta "Você iniciou o teste do YouTube
// neste vídeo?" aberta NA PRÓPRIA LINHA da lista, sem modal. A variante `'ficha'` (T9a) é o bloco "Confirmar" da ficha (no topo depois
// da volta do Studio, ou como bloco 3). As duas usam o MESMO 2º toque e o MESMO `motivoDoErro`.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import { motivoDoErro, type MotivoErro } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import type { ResultadoAcaoConfirmar } from '../../actions-nativo'
import type { AcoesCaminho } from './lista-caminho'
import { FaixaCaminho } from './faixa-caminho'
import { Icone } from './icones'
import { fmtHora } from './ficha-teste'
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
  /** "Abrir esse teste" / "Recarregar": só relê a lista, sem fechar nada por conta própria. */
  aoAtualizar: () => void
}

/** Fases do bloco da ficha. Vivem em quem hospeda (a ficha), porque o bloco troca de lugar (topo/bloco 3) sem perder o 2º toque. */
export type FaseFicha =
  | { tipo: 'pergunta' } | { tipo: 'ask' } | { tipo: 'enviando' } | { tipo: 'ainda_nao' }
  | { tipo: 'erro'; motivo: MotivoErro }
  | { tipo: 'registrada'; em: Date; aviso: string | null }

export interface FichaConfirmarFichaProps {
  variante: 'ficha'
  fichaId: string
  /** Subiu ao topo (sem o número 3 e sem a pergunta repetida). */
  noTopo: boolean
  /** Studio aberto (ISO): "Você abriu o Studio às HH:MM". */
  studioAbertoEm: string | null
  /** "Já iniciei" é o primário do estado (um só laranja). */
  primario: boolean
  habilitado: boolean
  motivoDesabilitado: string | null
  fase: FaseFicha
  setFase: (f: FaseFicha) => void
  /** Já passa pela fila da ficha (`executar`). */
  jaIniciei: (fichaId: string) => Promise<ResultadoAcaoConfirmar>
  agora: () => Date
  aoRegistrar: () => void
  aoAtualizar: () => void
  aoVoltarALista: () => void
}
export type FichaConfirmarProps = FichaConfirmarLinhaProps | FichaConfirmarFichaProps

type Fase = { tipo: 'pergunta' } | { tipo: 'ask' } | { tipo: 'enviando' } | { tipo: 'erro'; motivo: MotivoErro } | { tipo: 'registrada' }

type Desfecho = { ok: true; aviso: string | null } | { ok: false; motivo: MotivoErro }
/** O mesmo 2º toque das duas variantes: chama a action, manda o erro ao Sentry (só `fichaId` e `motivo`) e devolve o desfecho. */
async function registrarJaIniciei(acao: (fichaId: string) => Promise<ResultadoAcaoConfirmar>, fichaId: string): Promise<Desfecho> {
  try {
    const r = await acao(fichaId)
    if (r.ok) return { ok: true, aviso: r.aviso ?? null }
    const motivo = motivoDoErro(r.erro)
    Sentry.captureMessage('ficha: já iniciei recusado', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { fichaId, motivo } })
    return { ok: false, motivo }
  } catch {
    return { ok: false, motivo: motivoDoErro('rede') }
  }
}

export function FichaConfirmar(p: FichaConfirmarProps): ReactElement {
  return p.variante === 'ficha' ? <ConfirmarFicha {...p} /> : <ConfirmarLinha {...p} />
}

function ConfirmarLinha(p: FichaConfirmarLinhaProps): ReactElement {
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
    const d = await registrarJaIniciei(p.jaIniciei, p.fichaId)
    if (d.ok) { setFase({ tipo: 'registrada' }); p.aoRegistrar(); return }
    setFase({ tipo: 'erro', motivo: d.motivo })
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
              {fase.tipo === 'erro' ? <MensagemDeErro motivo={fase.motivo} aoTentar={() => setFase({ tipo: 'ask' })} aoAtualizar={p.aoAtualizar} /> : null}
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

function MensagemDeErro({ motivo, aoTentar, aoAtualizar, daFicha = false }: { motivo: MotivoErro; aoTentar: () => void; aoAtualizar: () => void; daFicha?: boolean }): ReactElement {
  const m = FRASES.motivo
  const texto = motivo === 'incompleta' ? m.incompleta.forte + m.incompleta.resto
    : motivo === 'ja_ha_teste' ? m.ja_ha_teste.forteSemData + m.ja_ha_teste.resto
    : motivo === 'estado_mudou' ? m.estado_mudou.forte + m.estado_mudou.resto(null)
    : m.sem_conexao.forte
  const acao = motivo === 'sem_conexao' ? { rotulo: m.sem_conexao.acao, ao: aoTentar }
    : motivo === 'ja_ha_teste' ? { rotulo: m.ja_ha_teste.acao, ao: aoAtualizar }
    : motivo === 'estado_mudou' ? { rotulo: m.estado_mudou.acao, ao: aoAtualizar }
    : null
  return (
    <div role="alert" className={daFicha ? 'cn-errl' : 'cn-erro'}>
      {daFicha ? <Icone nome="warn" /> : null}
      {daFicha ? <span>{texto}</span> : <p>{texto}</p>}
      {acao ? <button type="button" className="cn-lnk" onClick={acao.ao}>{acao.rotulo}</button> : null}
    </div>
  )
}

const DIA_MS_FICHA = DIA_MS
const horaDe = (iso: string): string => fmtHora(new Date(iso))

function ConfirmarFicha(p: FichaConfirmarFichaProps): ReactElement {
  const { fase } = p
  const agora = p.agora()
  const prazo = new Date(agora.getTime() + PRAZO_DIAS * DIA_MS_FICHA)
  const abriu = ((): string | null => {
    if (!p.studioAbertoEm) return null
    const d = new Date(p.studioAbertoEm)
    return dataCurta(d) === dataCurta(agora) ? FRASES.ficha.voceAbriuOStudio(horaDe(p.studioAbertoEm)) : FRASES.ficha.voceAbriuOStudioOutroDia(dataCurta(d), horaDe(p.studioAbertoEm))
  })()

  async function confirmar(): Promise<void> {
    p.setFase({ tipo: 'enviando' })
    const d = await registrarJaIniciei(p.jaIniciei, p.fichaId)
    if (d.ok) { p.setFase({ tipo: 'registrada', em: p.agora(), aviso: d.aviso }); p.aoRegistrar(); return }
    p.setFase({ tipo: 'erro', motivo: d.motivo })
  }

  if (fase.tipo === 'registrada') {
    const quando = `${dataCurta(fase.em)}, ${fmtHora(fase.em)}`
    const b = FRASES.ficha.registradaBloco(quando, dataCurta(new Date(fase.em.getTime() + 14 * DIA_MS_FICHA)))
    return (
      <section className="cn-blk" aria-labelledby="cn-b3">
        <h3 id="cn-b3"><span className="n" aria-hidden="true">3</span>{FRASES.ficha.bloco3.titulo}</h3>
        <FaixaCaminho tom="ok" role="status" titulo={b.titulo} acoes={<button type="button" className="cn-btn pri" onClick={p.aoVoltarALista}>{FRASES.ficha.voltarALista}</button>}>
          {b.apoio}
        </FaixaCaminho>
        {fase.aviso ? <p className="cn-aviso"><Icone nome="warn" /><span>{fase.aviso}</span></p> : null}
      </section>
    )
  }

  const aberto = fase.tipo === 'ask' || fase.tipo === 'enviando'
  const enviando = fase.tipo === 'enviando'
  const destaque = p.studioAbertoEm !== null
  return (
    <section className={`cn-blk${destaque ? ' cn-hl' : ''}`} aria-labelledby="cn-b3" data-no-topo={p.noTopo}>
      <h3 id="cn-b3">{p.noTopo ? null : <span className="n" aria-hidden="true">3</span>}{FRASES.ficha.bloco3.titulo}</h3>
      {abriu ? <p className="cn-meta">{abriu}</p> : null}
      {p.noTopo ? null : <p className="cn-q3">{FRASES.ficha.bloco3.pergunta}</p>}
      {fase.tipo === 'ainda_nao' ? (
        <>
          <p className="cn-meta">{FRASES.ficha.ainda_nota}</p>
          <div className="cn-bacts"><button type="button" className="cn-btn" onClick={() => p.setFase({ tipo: 'ask' })}>{FRASES.ficha.bloco3.jaIniciei}</button></div>
        </>
      ) : (
        <>
          <div className="cn-bacts">
            <button type="button" className={`cn-btn${p.primario && !aberto ? ' pri' : ''}`} disabled={!p.habilitado || enviando} aria-expanded={aberto}
              onClick={() => p.setFase(aberto ? { tipo: 'pergunta' } : { tipo: 'ask' })}>{FRASES.ficha.bloco3.jaIniciei}</button>
            <button type="button" className="cn-btn ghost" disabled={!p.habilitado || enviando} onClick={() => p.setFase({ tipo: 'ainda_nao' })}>{FRASES.ficha.bloco3.ainda}</button>
          </div>
          {!p.habilitado && p.motivoDesabilitado ? <p className="cn-why">{p.motivoDesabilitado}</p> : null}
          {aberto ? (
            <div className="cn-ask" role="group" aria-label={FRASES.ficha.bloco3.confirmarGrupo}>
              <p>{FRASES.ficha.confirmarConsequencia(prazo)}</p>
              <div className="cn-acts">
                <button type="button" className="cn-btn pri" disabled={enviando} onClick={() => { void confirmar() }}>{FRASES.ficha.bloco3.confirmar}</button>
                <button type="button" className="cn-btn" disabled={enviando} onClick={() => p.setFase({ tipo: 'pergunta' })}>{FRASES.ficha.bloco3.voltar}</button>
              </div>
            </div>
          ) : null}
          {fase.tipo === 'erro' ? <MensagemDeErro daFicha motivo={fase.motivo} aoTentar={() => p.setFase({ tipo: 'ask' })} aoAtualizar={p.aoAtualizar} /> : null}
        </>
      )}
    </section>
  )
}

