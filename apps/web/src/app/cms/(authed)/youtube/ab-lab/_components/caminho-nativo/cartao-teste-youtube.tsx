'use client'
// Cartão S7 do teste do YouTube (F1a-tela-1, T10): estado 1 (visto de fora: Confirmar / Não é teste) e estado 2 (confirmado).
// Mockup M2 `index.html:263-282,572-587`. As actions chegam por props (nenhum client importa `actions-nativo`).
// Sem "Desfazer confirmação" (F1b) e sem "Também testa miniatura" (sem coluna; D-3). A data mostrada é sempre a do dado;
// só o "Você confirmou em" do instante do próprio toque usa o relógio injetado (a action grava `confirmado_em = agora`).
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ResultadoAcaoConfirmar, ResultadoAcaoDescartar } from '../../actions-nativo'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import { rotuloRetomar } from '@/lib/youtube/teste-youtube/nativo/lista'
import { ChipVersao } from './chip-versao'
import { FaixaCaminho } from './faixa-caminho'
import { Icone } from './icones'
import { SeloCaminho } from './selo-caminho'
import { fmtHora } from './ficha-teste'
import '../caminho-nativo.css'
import '../cartao-teste-youtube.css'

export interface RegistroDoCartao {
  id: string
  /** `updated_at` que a tela viu: o CAS das duas ações. */
  updatedAt: string
  confirmadoEm: string | null
  primeiraVista: string | null
  ultimaVista: string | null
  variantesTitulo: string[]
  votosTitulo: Record<string, number> | null
}
export interface AcoesCartao {
  confirmarDetectado: (registroId: string, lido: string) => Promise<ResultadoAcaoConfirmar>
  naoETeste: (registroId: string, lido: string) => Promise<ResultadoAcaoDescartar>
}
export interface CartaoTesteYoutubeProps {
  registro: RegistroDoCartao
  /** Quando o nosso teste está pausado por causa deste registro: o instante de `retomarAPartirDe`. Nulo = sem nosso teste pausado. */
  labPausadoAte: string | null
  acoes: AcoesCartao
  agora?: () => Date
  /** Relê a lista (o registro mudou por fora, ou foi confirmado). */
  aoAtualizar?: () => void
  /** "Não é teste" gravado: a linha volta ao caminho sugerido; o painel fecha. */
  aoLiberado?: () => void
}

type Falha = { t: 'mudou' } | { t: 'erro'; texto: string }

const dataHora = (d: Date): string => `${dataCurta(d)}, ${fmtHora(d)}`

// As frases próprias valem sempre: o `error` cru do servidor não chega à tela.
function erroDeConfirmar(r: Extract<ResultadoAcaoConfirmar, { ok: false }>): Falha {
  switch (r.erro) {
    case 'estado_mudou': case 'ja_confirmado': case 'nao_encontrada': case 'ficha_incompleta': case 'ja_ha_teste_em_andamento':
      return { t: 'mudou' }
    case 'sem_permissao':
      return { t: 'erro', texto: FRASES.semPermissao }
    case 'pedido_invalido':
      return { t: 'erro', texto: FRASES.pedidoRecusado }
    case 'falha':
      return { t: 'erro', texto: FRASES.s7.confirmarFalhou }
    default: {
      const _exaustivo: never = r
      return _exaustivo
    }
  }
}
function erroDeDescartar(r: Extract<ResultadoAcaoDescartar, { ok: false }>): Falha {
  switch (r.erro) {
    case 'ja_encerrado': case 'confirmado': case 'nao_encontrado':
      return { t: 'mudou' }
    case 'sem_permissao':
      return { t: 'erro', texto: FRASES.semPermissao }
    case 'pedido_invalido':
      return { t: 'erro', texto: FRASES.pedidoRecusado }
    case 'falha':
      return { t: 'erro', texto: FRASES.s7.liberarFalhou }
    default: {
      const _exaustivo: never = r
      return _exaustivo
    }
  }
}

function Leituras({ titulo, votos }: { titulo: string; votos: Record<string, number> | null }): ReactElement {
  const total = votos ? Object.values(votos).reduce((a, b) => a + b, 0) : 0
  return (
    <div className="cn-big">
      <span>{FRASES.s7.leituras}</span>
      {votos && total > 0 ? <b className="cn-num">{FRASES.s7.leiturasDe(votos[titulo] ?? 0, total)}</b> : <span className="cn-nm">não medido</span>}
    </div>
  )
}

export function CartaoTesteYoutube({ registro, labPausadoAte, acoes, agora, aoAtualizar, aoLiberado }: CartaoTesteYoutubeProps): ReactElement {
  const relogio = agora ?? (() => new Date())
  const [confirmadoLocal, setConfirmadoLocal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pergunta, setPergunta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [falha, setFalha] = useState<Falha | null>(null)
  const emCurso = useRef(false)
  const naoRef = useRef<HTMLButtonElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const tituloRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => { if (pergunta) cancelarRef.current?.focus() }, [pergunta])
  // "Confirmar" some ao ir para o estado 2: o foco passa à frase de confirmação (alvo estável) em vez de cair no body.
  useEffect(() => { if (confirmadoLocal !== null) tituloRef.current?.focus() }, [confirmadoLocal])

  const confirmadoEm = registro.confirmadoEm ?? confirmadoLocal
  const confirmado = confirmadoEm !== null
  const hoje = relogio()

  async function rodar<R extends { ok: boolean }>(chamar: () => Promise<R>, aoOk: (r: R & { ok: true }) => void, falhar: (r: R & { ok: false }) => Falha, quandoLanca: string): Promise<void> {
    if (emCurso.current) return
    emCurso.current = true; setOcupado(true); setFalha(null)
    try {
      const r = await chamar()
      if (r.ok) aoOk(r as R & { ok: true })
      else setFalha(falhar(r as R & { ok: false }))
    } catch {
      setFalha({ t: 'erro', texto: quandoLanca })
    } finally {
      emCurso.current = false; setOcupado(false)
    }
  }

  const confirmar = (): Promise<void> => rodar(
    () => acoes.confirmarDetectado(registro.id, registro.updatedAt),
    (r) => {
      setConfirmadoLocal(relogio().toISOString())
      setPergunta(false)
      if ('aviso' in r && r.aviso) setAviso(r.aviso)
      aoAtualizar?.()
    },
    (r) => erroDeConfirmar(r as Extract<ResultadoAcaoConfirmar, { ok: false }>),
    FRASES.s7.confirmarFalhou,
  )
  const liberar = (): Promise<void> => rodar(
    () => acoes.naoETeste(registro.id, registro.updatedAt),
    () => { setPergunta(false); aoLiberado?.(); aoAtualizar?.() },
    (r) => erroDeDescartar(r as Extract<ResultadoAcaoDescartar, { ok: false }>),
    FRASES.s7.liberarFalhou,
  )

  function cancelar(): void {
    setPergunta(false)
    naoRef.current?.focus()
  }

  const desde = registro.primeiraVista ? FRASES.s7.as(dataCurta(new Date(registro.primeiraVista)), fmtHora(new Date(registro.primeiraVista))) : FRASES.s7.desdeNaoMedido
  const ultima = registro.ultimaVista
    ? (dataCurta(new Date(registro.ultimaVista)) === dataCurta(hoje) ? FRASES.s7.hoje(fmtHora(new Date(registro.ultimaVista))) : FRASES.s7.as(dataCurta(new Date(registro.ultimaVista)), fmtHora(new Date(registro.ultimaVista))))
    : FRASES.s7.ultimaNaoMedida

  // Linha âmbar do nosso teste pausado: só se há nosso teste pausado por este registro.
  const retomar = ((): string | null => {
    if (!labPausadoAte) return null
    const t = Date.parse(labPausadoAte)
    const futuro = Number.isFinite(t) && t > hoje.getTime()
    if (!futuro) return confirmado ? `${FRASES.s7.labPausadoConfirmadoSemData} ${FRASES.s7.retomarEspera}` : `${FRASES.s7.labPausadoSemData} ${FRASES.s7.retomarEspera}`
    const r = rotuloRetomar(new Date(t))
    return confirmado ? FRASES.s7.labPausadoConfirmado(r) : FRASES.s7.labPausado(r)
  })()

  const titulos = registro.variantesTitulo
  const letras = ['A', 'B', 'C'] as const

  return (
    <section className="cn-card" aria-label="Teste do YouTube">
      <div className="cn-top">
        <SeloCaminho tipo="yt">{confirmado ? FRASES.s7.selo2 : FRASES.s7.selo}</SeloCaminho>
      </div>
      <p className="cn-meta cn-cmeta" ref={tituloRef} tabIndex={-1}>
        {confirmado && confirmadoEm
          ? FRASES.s7.confirmouEm(dataHora(new Date(confirmadoEm)))
          : FRASES.s7.visto(desde, ultima)}
      </p>
      {aviso ? <p className="cn-meta" role="status">{aviso}</p> : null}
      <div className="cn-pair2">
        {titulos.slice(0, 3).map((t, i) => (
          <div className="cn-opt" key={`${letras[i]}-${t}`}>
            <div className="cn-orow"><ChipVersao letra={letras[i] ?? 'C'} /><span className="cn-meta">{i === 0 ? FRASES.s7.tituloDeAntes : FRASES.s7.tituloNovo}</span></div>
            <q>{t}</q>
            <Leituras titulo={t} votos={registro.votosTitulo} />
          </div>
        ))}
      </div>

      {!confirmado ? (
        <div className="cn-cacts">
          <button type="button" className="cn-btn pri" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => { void confirmar() }}>
            <Icone nome="ok" />{FRASES.s7.confirmar}
          </button>
          <button
            type="button" ref={naoRef} className="cn-btn ghost cn-far" aria-expanded={pergunta} disabled={ocupado}
            onClick={() => setPergunta((p) => !p)}
          >{FRASES.s7.naoETeste}</button>
        </div>
      ) : null}
      {!confirmado && pergunta ? (
        <div className="cn-ask" role="group" aria-label="Confirmar liberação" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancelar() } }}>
          <p><b>{FRASES.s7.liberarDecisao}</b> {FRASES.s7.liberarConsequencia}</p>
          <div className="cn-acts">
            <button type="button" className="cn-btn" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => { void liberar() }}>{FRASES.s7.liberar}</button>
            <button type="button" className="cn-btn" ref={cancelarRef} disabled={ocupado} onClick={cancelar}>{FRASES.s7.cancelar}</button>
          </div>
        </div>
      ) : null}

      {falha?.t === 'mudou' ? (
        <div className="cn-cfalha">
          <FaixaCaminho
            tom="warn" role="alert" titulo={FRASES.guarda.estadoMudou}
            acoes={<button type="button" className="cn-btn" onClick={() => aoAtualizar?.()}>{FRASES.guarda.atualizar}</button>}
          />
        </div>
      ) : null}
      {falha?.t === 'erro' ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{falha.texto}</span></p> : null}

      {!confirmado ? <p className="cn-hint">{FRASES.s7.dica}</p> : null}
      {retomar ? (
        <p className="cn-gline" role="status"><Icone nome="pause" /><span><b>Lab pausado</b>{retomar.replace(/^Lab pausado/, '')}</span></p>
      ) : null}
    </section>
  )
}
