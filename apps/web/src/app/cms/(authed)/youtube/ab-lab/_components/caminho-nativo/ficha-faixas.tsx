'use client'
// Faixas da "Ficha do teste" que falam do nosso teste e do Studio (F1a-tela-1, T9b): `0b` (nosso rodando, "Pausar e voltar a original" em 2 toques),
// `restaurando`, `falhou`, `restaurada` e `0c` (registro detectado). `pauseAbTest` e `retryRestore` chegam por props (nunca importados aqui).
// O estado do nosso teste vive no hook `useNossoDaFicha`, para a `FichaComStudio` passar `entrada.nosso` real à `vistaDaFicha`.
import { useRef, useState, type ReactElement } from 'react'
import CmsLink from '@/app/cms/(authed)/_shared/cms-link'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { EntradaFicha } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { AbConfirmarTrocaDialog } from '../ab-confirmar-troca-dialog'
import { FaixaCaminho } from './faixa-caminho'
import { fmtHora, type ContextoFicha } from './ficha-teste'
import { Icone } from './icones'
import '../caminho-nativo.css'

export type EstadoNosso = NonNullable<EntradaFicha['nosso']>
export interface AcoesDoNosso {
  pauseAbTest: (testId: string, seqVisto: number) => Promise<ResultadoAcaoSaida>
  retryRestore: (testId: string, seqVisto: number) => Promise<ResultadoAcaoSaida>
}
type CamposParaConfirmar = Extract<ResultadoAcaoSaida, { resultado: 'precisa_confirmar' }>['campos']

/** "dd/mm, HH:MM" em São Paulo. */
export const dataHora = (d: Date): string => `${dataCurta(d)}, ${fmtHora(d)}`

/** Só `ok` em TODOS os campos libera o Studio; um campo em andamento é "restaurando"; qualquer outro estado não é "de volta". */
export function originalDeVoltaDe(campos: RestoreStatus): 'sim' | 'restaurando' | 'falhou' {
  const v = Object.values(campos)
  if (v.some((c) => c?.estado === 'em_andamento')) return 'restaurando'
  return v.every((c) => c?.estado === 'ok') ? 'sim' : 'falhou'
}

export interface NossoDaFicha {
  nosso: EntradaFicha['nosso']
  restauradaEm: Date | null
  pausaAberta: boolean
  ocupado: boolean
  erro: string | null
  paraConfirmar: CamposParaConfirmar | null
  abrirPausa: () => void
  cancelarPausa: () => void
  pausar: () => void
  tentarDeNovo: () => void
  fecharConfirmar: () => void
}

export function useNossoDaFicha(linhaNosso: LinhaDoCaminho['nosso'], acoes: AcoesDoNosso, agora: () => Date): NossoDaFicha {
  const [nosso, setNosso] = useState<EntradaFicha['nosso']>(linhaNosso ? { status: linhaNosso.status, dia: linhaNosso.dia, originalDeVolta: 'nao' } : null)
  const [restauradaEm, setRestauradaEm] = useState<Date | null>(null)
  const [pausaAberta, setPausaAberta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [paraConfirmar, setParaConfirmar] = useState<CamposParaConfirmar | null>(null)
  const emCurso = useRef(false)

  async function rodar(chamar: () => Promise<ResultadoAcaoSaida>): Promise<void> {
    if (emCurso.current || !linhaNosso) return
    emCurso.current = true; setOcupado(true); setErro(null)
    try {
      const r = await chamar()
      if (r.ok && r.resultado === 'feito') {
        const o = originalDeVoltaDe(r.campos)
        setNosso((n) => (n ? { ...n, originalDeVolta: o, status: o === 'falhou' ? n.status : 'paused' } : n))
        if (o === 'sim') setRestauradaEm(agora())
      } else if (r.ok) {
        setParaConfirmar(r.campos)
      } else if (r.resultado === 'em_andamento') {
        setNosso((n) => (n ? { ...n, originalDeVolta: 'restaurando', status: 'paused' } : n))
      } else {
        setErro(r.error)
      }
    } catch {
      setErro(FRASES.ficha.pausarFalhou)
    } finally {
      setPausaAberta(false); setOcupado(false); emCurso.current = false
    }
  }

  return {
    nosso, restauradaEm, pausaAberta, ocupado, erro, paraConfirmar,
    abrirPausa: () => setPausaAberta(true),
    cancelarPausa: () => setPausaAberta(false),
    pausar: () => { void rodar(() => acoes.pauseAbTest(linhaNosso?.testId ?? '', linhaNosso?.restoreSeq ?? 0)) },
    tentarDeNovo: () => { void rodar(() => acoes.retryRestore(linhaNosso?.testId ?? '', linhaNosso?.restoreSeq ?? 0)) },
    fecharConfirmar: () => setParaConfirmar(null),
  }
}

export function FaixasFicha({ ctx, n, registroDetectado }: {
  ctx: ContextoFicha
  n: NossoDaFicha
  registroDetectado: { primeiraVista: string } | null
}): ReactElement | null {
  const faixa = ctx.vista.faixa
  const dia = n.nosso?.dia ?? 0
  const desde = registroDetectado ? new Date(registroDetectado.primeiraVista) : null
  return (
    <>
      {faixa === '0b' || faixa === '0b-ask' ? (
        <FaixaCaminho
          tom="lab" titulo={FRASES.ficha.faixaNossoRodando(dia).titulo}
          acoes={faixa === '0b' ? (
            <button type="button" className="cn-btn pri" onClick={n.abrirPausa}><Icone nome="pause" />{FRASES.ficha.pausarEVoltar}</button>
          ) : (
            <div className="cn-ask" role="group" aria-label="Confirmar a pausa">
              <p><b>{FRASES.ficha.pausarPergunta}</b> {FRASES.ficha.pausarConsequencia}</p>
              <div className="cn-acts">
                <button type="button" className="cn-btn pri" disabled={n.ocupado} aria-busy={n.ocupado} onClick={n.pausar}>{FRASES.ficha.pausarEVoltar}</button>
                <button type="button" className="cn-btn" disabled={n.ocupado} onClick={n.cancelarPausa}>{FRASES.ficha.cancelar}</button>
              </div>
            </div>
          )}
        >
          {FRASES.ficha.faixaNossoRodando(dia).apoio}
        </FaixaCaminho>
      ) : null}
      {faixa === 'restaurando' ? <FaixaCaminho tom="lab" ocupada titulo={FRASES.ficha.faixaRestaurando} /> : null}
      {faixa === 'falhou' ? (
        <FaixaCaminho
          tom="err" role="alert" titulo={FRASES.ficha.faixaRestaurarFalhou.titulo}
          acoes={(
            <>
              <button type="button" className="cn-btn pri" disabled={n.ocupado} aria-busy={n.ocupado} onClick={n.tentarDeNovo}>{FRASES.ficha.tentarDeNovo}</button>
              <CmsLink href="/cms/youtube" className="cn-btn">{FRASES.ficha.reconectar}</CmsLink>
            </>
          )}
        >
          {FRASES.ficha.faixaRestaurarFalhou.apoio}
        </FaixaCaminho>
      ) : null}
      {faixa === 'restaurada' ? (
        <FaixaCaminho tom="warn" role="status" titulo={FRASES.ficha.faixaRestaurada(n.restauradaEm ? dataHora(n.restauradaEm) : '').titulo}>
          {FRASES.ficha.faixaRestaurada('').apoio}
        </FaixaCaminho>
      ) : null}
      {faixa === '0c' && desde ? (
        <FaixaCaminho tom="yt" role="status" titulo={FRASES.ficha.faixaDetectado(dataHora(desde)).titulo}>
          {FRASES.ficha.faixaDetectado(dataHora(desde)).apoio}
        </FaixaCaminho>
      ) : null}
      {n.erro ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{n.erro}</span></p> : null}
      {n.paraConfirmar ? (
        <AbConfirmarTrocaDialog
          campos={n.paraConfirmar} opcao={{ id: 'original', rotulo: 'A', isOriginal: true, titulo: null, miniatura: null }}
          onVoltar={n.fecharConfirmar} onConfirmar={() => { n.fecharConfirmar(); n.pausar() }}
        />
      ) : null}
    </>
  )
}
