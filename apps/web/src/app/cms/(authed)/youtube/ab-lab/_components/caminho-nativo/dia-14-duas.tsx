'use client'
// Pergunta do dia 14 com duas versões (F1a-tela-1, T10b / D-1): "Qual versão venceu no Studio?". Mockup M2 `index.html:539-565`
// (função `d14`, ramo sem resposta). Sem botão primário: as duas versões têm o mesmo peso. Sem "Mudar minha resposta" (tela-2).
// A action chega por props (nenhum client importa `actions-nativo`); o desfecho é tratado por `switch` exaustivo.
import { useEffect, useRef, useState, type ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import type { PedidoRespostaDia14, ResultadoAcaoResponder } from '../../actions-nativo'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import { prazoDoDia14, type LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { ChipVersao } from './chip-versao'
import { FaixaCaminho } from './faixa-caminho'
import { SeloCaminho } from './selo-caminho'
import '../caminho-nativo.css'
import '../dia-14-duas.css'

export interface VersaoDia14 { letra: 'A' | 'B'; titulo: string | null; imagem: { url: string } | null }
export interface AcoesDia14 {
  responder: (pedido: PedidoRespostaDia14) => Promise<ResultadoAcaoResponder>
  /** Relê a lista (a linha mudou por dentro ou por fora). */
  atualizar: () => void
}
export interface Dia14DuasProps {
  linha: LinhaDoCaminho
  versoes: [VersaoDia14, VersaoDia14]
  acoes: AcoesDia14
}

type RespostaSemVencedor = 'ficou_igual' | 'inconclusivo' | 'nao_vi'
type Tela =
  | { t: 'pergunta' }
  | { t: 'no_ar'; original: boolean }
  | { t: 'sem_vencedor'; resposta: RespostaSemVencedor }
  | { t: 'diferentes' }
  | { t: 'mudou' }
  | { t: 'erro' }
  | { t: 'sem_conexao'; pedido: PedidoRespostaDia14 }

type Falha = Extract<ResultadoAcaoResponder, { ok: false }>

/** Desfecho que NÃO é sucesso: relê a linha (o teste mudou) ou mostra a frase de erro. Exaustivo sobre o tipo real. */
function falhaDaAction(r: Falha): 'mudou' | 'erro' {
  switch (r.erro) {
    case 'ja_respondido': case 'estado_mudou': case 'nao_respondivel': case 'nao_encontrado':
      return 'mudou'
    case 'falha_escrita': case 'falha': case 'sem_permissao': case 'pedido_invalido': case 'variante_invalida':
      return 'erro'
    default: {
      const _exaustivo: never = r
      return _exaustivo
    }
  }
}

/** Resultado de sucesso sem conflito: `venceu_*` vira "ficou no ar"; as outras três, "sem vencedor" (nunca "Ficou no ar"). */
export function telaDoSucesso(resposta: PedidoRespostaDia14['resposta']): Tela {
  switch (resposta) {
    case 'venceu_original': return { t: 'no_ar', original: true }
    case 'venceu_nova': return { t: 'no_ar', original: false }
    case 'ficou_igual': case 'inconclusivo': case 'nao_vi': return { t: 'sem_vencedor', resposta }
    default: {
      const _exaustivo: never = resposta
      return _exaustivo
    }
  }
}

export function Dia14Duas({ linha, versoes, acoes }: Dia14DuasProps): ReactElement {
  const reg = linha.registro
  const [tela, setTela] = useState<Tela>({ t: 'pergunta' })
  const [ocupado, setOcupado] = useState(false)
  const emCurso = useRef(false)
  const resultadoRef = useRef<HTMLParagraphElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { if (tela.t !== 'pergunta') (resultadoRef.current ?? tituloRef.current)?.focus() }, [tela])

  const comMiniatura = reg?.campos === null || reg?.campos === undefined || reg.campos.includes('miniatura')
  const confirmadoEm = reg?.confirmadoEm ?? reg?.primeiraVista ?? null
  const tardia = linha.estado === 'sem_resposta' && reg
    ? FRASES.resposta.tardia(prazoDoDia14({ primeiraVista: reg.primeiraVista, confirmadoEm: reg.confirmadoEm, createdAt: reg.updatedAt }))
    : null

  async function enviar(pedido: PedidoRespostaDia14): Promise<void> {
    if (emCurso.current) return
    emCurso.current = true; setOcupado(true)
    try {
      const r = await acoes.responder(pedido)
      if (r.ok) {
        if (r.conflito !== null) { setTela({ t: 'diferentes' }); acoes.atualizar(); return }
        setTela(telaDoSucesso(pedido.resposta))
        acoes.atualizar()
        return
      }
      const f = falhaDaAction(r)
      if (f === 'mudou') { setTela({ t: 'mudou' }); return }
      Sentry.captureMessage('dia 14: resposta recusada', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { motivo: r.erro } })
      setTela({ t: 'erro' })
    } catch {
      // Rede caiu: nada foi registrado; o 2º toque reenvia o mesmo pedido (a action é idempotente por CAS).
      setTela({ t: 'sem_conexao', pedido })
    } finally {
      emCurso.current = false; setOcupado(false)
    }
  }

  const pedidoDe = (resposta: PedidoRespostaDia14['resposta'], n: number | null): PedidoRespostaDia14 | null =>
    reg ? { registroId: reg.id, lido: reg.updatedAt, resposta, n } : null
  const toque = (resposta: PedidoRespostaDia14['resposta'], n: number | null) => (): void => {
    const p = pedidoDe(resposta, n)
    if (p) void enviar(p)
  }

  if (tela.t === 'no_ar') {
    return (
      <section className="cn-d14" aria-labelledby="cn-d14-q">
        <div className="cn-d14-res"><SeloCaminho tipo="ok">{tela.original ? FRASES.dia14.seloOriginal : FRASES.dia14.seloNova}</SeloCaminho></div>
        <p className="cn-d14-q3" id="cn-d14-q" ref={resultadoRef} tabIndex={-1}>{tela.original ? FRASES.dia14.fraseOriginal : FRASES.dia14.fraseNova}</p>
        <p className="cn-meta">{FRASES.dia14.oficial}</p>
      </section>
    )
  }
  if (tela.t === 'sem_vencedor') {
    const frase = tela.resposta === 'ficou_igual' ? FRASES.resposta.ficouIgual : tela.resposta === 'inconclusivo' ? FRASES.resposta.inconclusivo : FRASES.resposta.naoVi
    return (
      <section className="cn-d14" aria-labelledby="cn-d14-q">
        <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.dia14.seloSemVencedor[tela.resposta]}</SeloCaminho></div>
        <p className="cn-d14-q3" id="cn-d14-q" ref={resultadoRef} tabIndex={-1}>{frase}</p>
        <p className="cn-meta">{FRASES.resposta.apoioSemVencedor}</p>
      </section>
    )
  }
  if (tela.t === 'diferentes') {
    return (
      <section className="cn-d14" aria-labelledby="cn-d14-q">
        <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.dia14.respostasDiferentes}</SeloCaminho></div>
        <p className="cn-d14-q3" id="cn-d14-q" ref={resultadoRef} tabIndex={-1}>{FRASES.dia14.respostasDiferentesFrase}</p>
      </section>
    )
  }

  return (
    <section className="cn-d14" aria-labelledby="cn-d14-q">
      <h3 id="cn-d14-q" ref={tituloRef} tabIndex={-1}>{FRASES.dia14.pergunta}</h3>
      <p className="cn-meta">{FRASES.dia14.apoio(confirmadoEm ? new Date(confirmadoEm) : null)}</p>
      {tardia ? <p className="cn-meta">{tardia}</p> : null}
      <div className="cn-d14-grid" role="group" aria-label={FRASES.dia14.versoes}>
        {versoes.map((v) => (
          <button
            key={v.letra} type="button" className="cn-d14-vopt" disabled={ocupado} data-resposta={v.letra === 'A' ? 'venceu_original' : 'venceu_nova'}
            onClick={toque(v.letra === 'A' ? 'venceu_original' : 'venceu_nova', v.letra === 'A' ? 1 : 2)}
          >
            {comMiniatura
              ? (v.imagem
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="cn-d14-th" src={v.imagem.url} alt="" referrerPolicy="no-referrer" />
                : <span className="cn-d14-th cn-d14-ph" data-testid="miniatura-nao-medida"><span className="cn-nm">{FRASES.dia14.naoMedido}</span></span>)
              : null}
            <span className="cn-d14-tx">
              <span className="cn-d14-top"><ChipVersao letra={v.letra} />{v.titulo ? <q>{v.titulo}</q> : null}</span>
              <span className="cn-d14-lbl">{v.letra === 'A' ? FRASES.dia14.originalFicou : FRASES.dia14.novaVenceu}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="cn-d14-other" role="group" aria-label={FRASES.dia14.outraGrupo}>
        <span>{FRASES.dia14.outra}</span>
        <button type="button" className="cn-btn" disabled={ocupado} data-resposta="ficou_igual" onClick={toque('ficou_igual', null)}>{FRASES.dia14.ficouIgual}</button>
        <button type="button" className="cn-btn" disabled={ocupado} data-resposta="inconclusivo" onClick={toque('inconclusivo', null)}>{FRASES.dia14.inconclusivo}</button>
        <button type="button" className="cn-btn" disabled={ocupado} data-resposta="nao_vi" onClick={toque('nao_vi', null)}>{FRASES.dia14.naoVi}</button>
      </div>
      <p className="cn-meta cn-d14-aviso">{FRASES.dia14.avisoMudar}</p>
      {tela.t === 'mudou' ? (
        <FaixaCaminho
          tom="warn" role="alert" titulo={FRASES.guarda.estadoMudou}
          acoes={<button type="button" className="cn-btn" onClick={() => acoes.atualizar()}>{FRASES.guarda.atualizar}</button>}
        />
      ) : null}
      {tela.t === 'erro' ? <p className="cn-errl" role="alert">{FRASES.dia14.falhou}</p> : null}
      {tela.t === 'sem_conexao' ? (
        <div className="cn-errl" role="alert">
          <b>{FRASES.dia14.semConexao}</b>{' '}
          <button type="button" className="cn-lnk" disabled={ocupado} onClick={() => { void enviar(tela.pedido) }}>{FRASES.dia14.tentarDeNovo}</button>
        </div>
      ) : null}
    </section>
  )
}
