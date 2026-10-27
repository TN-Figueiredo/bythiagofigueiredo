'use client'
// Faixas da "Ficha do teste" que falam do nosso teste e do Studio (F1a-tela-1, T9b): `0b` (nosso rodando, "Pausar e voltar a original" em 2 toques),
// `restaurando`, `falhou`, `restaurada` e `0c` (registro detectado). `pauseAbTest` e `retryRestore` chegam por props (nunca importados aqui).
// O estado do nosso teste vive no hook `useNossoDaFicha`, para a `FichaComStudio` passar `entrada.nosso` real à `vistaDaFicha`.
import { useEffect, useRef, useState, type ReactElement } from 'react'
import CmsLink from '@/app/cms/(authed)/_shared/cms-link'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { camposPendentes, daEscolhaDoDono, type RestoreStatus } from '@/lib/youtube/ab-restore'
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
  pauseAbTest: (testId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoAcaoSaida>
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

/** Vale tentar de novo quando o retry humano aceita algum campo (`falhou`, ou `desistiu` fora de novo_teste/destino_invalido — mesma regra de `camposPendentes`). Pulado não volta sozinho. */
export type MotivoNaoVolta = 'tentar' | 'conferir' | 'sem_registro'
export function motivoDe(campos: RestoreStatus): MotivoNaoVolta {
  return camposPendentes(campos, 'humano').filter(k => !daEscolhaDoDono(campos[k]!)).length > 0 ? 'tentar' : 'conferir' // M7b: a escolha do dono se refaz pelo painel
}

const temRetrato = (rs: RestoreStatus | null | undefined): rs is RestoreStatus => rs !== null && rs !== undefined && Object.keys(rs).length > 0

/** O que a linha (recarregada) já sabe do restauro. Pausado SEM retrato (nulo/vazio) não é "restaurando": nada está rodando; vira `falhou`/`sem_registro` (o dono confere e segue). */
function inicialDe(l: NonNullable<LinhaDoCaminho['nosso']>): NonNullable<EntradaFicha['nosso']> {
  const rs = l.restoreStatus
  if (l.status !== 'paused') return { status: l.status, dia: l.dia, originalDeVolta: 'nao' }
  return { status: l.status, dia: l.dia, originalDeVolta: temRetrato(rs) ? originalDeVoltaDe(rs) : 'falhou' }
}
function motivoInicial(l: NonNullable<LinhaDoCaminho['nosso']>): MotivoNaoVolta {
  if (l.status !== 'paused') return 'tentar'
  return temRetrato(l.restoreStatus) ? motivoDe(l.restoreStatus) : 'sem_registro'
}
/** Releitura da linha enquanto "Restaurando": a cada 5 s, no máximo 12 vezes (1 min). */
const RELEITURA_MS = 5000
const RELEITURAS_MAX = 12

export interface NossoDaFicha {
  nosso: EntradaFicha['nosso']
  restauradaEm: Date | null
  pausaAberta: boolean
  ocupado: boolean
  erro: string | null
  motivo: MotivoNaoVolta
  paraConfirmar: CamposParaConfirmar | null
  abrirPausa: () => void
  cancelarPausa: () => void
  pausar: (forcar?: boolean) => void
  tentarDeNovo: () => void
  fecharConfirmar: () => void
  /** O dono conferiu no YouTube: o teste nosso deixa de bloquear o Studio (só nesta tela; nada é gravado). */
  conferirESeguir: () => void
}

export function useNossoDaFicha(linhaNosso: LinhaDoCaminho['nosso'], acoes: AcoesDoNosso, agora: () => Date, recarregar?: () => void): NossoDaFicha {
  const [nosso, setNosso] = useState<EntradaFicha['nosso']>(linhaNosso ? inicialDe(linhaNosso) : null)
  const [motivo, setMotivo] = useState<MotivoNaoVolta>(linhaNosso ? motivoInicial(linhaNosso) : 'tentar')
  const chaveConferido = linhaNosso ? `ab-conferido:${linhaNosso.testId}:${linhaNosso.restoreSeq}` : null
  const [conferido, setConferido] = useState<boolean>(() => {
    if (!chaveConferido) return false
    try { return window.sessionStorage.getItem(chaveConferido) === '1' } catch { return false }
  })
  // O retry avança `restore_seq` e a linha só chega com o seq novo depois do refresh: se o dono já tocou em "seguir",
  // a marca acompanha a chave nova (senão, ao recarregar a aba, a faixa voltaria). Com a aba recarregada, lê a marca da chave atual.
  useEffect(() => {
    if (!chaveConferido) return
    if (conferido) { try { window.sessionStorage.setItem(chaveConferido, '1') } catch { /* sem storage: vale só nesta tela */ } }
    else { try { if (window.sessionStorage.getItem(chaveConferido) === '1') setConferido(true) } catch { /* idem */ } }
  }, [chaveConferido, conferido])
  const [restauradaEm, setRestauradaEm] = useState<Date | null>(null)
  const [pausaAberta, setPausaAberta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [paraConfirmar, setParaConfirmar] = useState<CamposParaConfirmar | null>(null)
  const emCurso = useRef(false)
  const recarregarRef = useRef(recarregar); recarregarRef.current = recarregar
  const agoraRef = useRef(agora); agoraRef.current = agora

  // Ressincroniza com a linha quando ela muda (refresh): o estado semeado no 1º render não pode ficar congelado.
  const chaveLinha = linhaNosso ? `${linhaNosso.status}|${linhaNosso.restoreSeq}|${linhaNosso.dia}|${JSON.stringify(linhaNosso.restoreStatus ?? null)}` : ''
  const chaveAnterior = useRef(chaveLinha)
  useEffect(() => {
    if (chaveAnterior.current === chaveLinha) return
    chaveAnterior.current = chaveLinha
    if (!linhaNosso) { setNosso(null); return }
    const novo = inicialDe(linhaNosso)
    setNosso((antes) => {
      if (antes?.originalDeVolta === 'restaurando' && novo.originalDeVolta === 'sim') setRestauradaEm(agoraRef.current())
      return novo
    })
    setMotivo(motivoInicial(linhaNosso))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveLinha])

  // "Restaurando": relê a linha de 5 em 5 s por até 1 min; sem desfecho, manda conferir no YouTube.
  const restaurando = nosso?.originalDeVolta === 'restaurando'
  useEffect(() => {
    if (!restaurando) return
    let n = 0
    const id = setInterval(() => {
      n += 1
      recarregarRef.current?.()
      if (n >= RELEITURAS_MAX) {
        clearInterval(id)
        setMotivo('conferir')
        setNosso((x) => (x && x.originalDeVolta === 'restaurando' ? { ...x, originalDeVolta: 'falhou' } : x))
      }
    }, RELEITURA_MS)
    return () => clearInterval(id)
  }, [restaurando])

  async function rodar(chamar: () => Promise<ResultadoAcaoSaida>, ehRetry: boolean): Promise<void> {
    if (emCurso.current || !linhaNosso) return
    emCurso.current = true; setOcupado(true); setErro(null)
    try {
      const r = await chamar()
      if (r.ok && r.resultado === 'feito') {
        const o = originalDeVoltaDe(r.campos)
        setMotivo(motivoDe(r.campos))
        setNosso((n) => (n ? { ...n, originalDeVolta: o, status: o === 'falhou' ? n.status : 'paused' } : n))
        if (o === 'sim') setRestauradaEm(agora())
        recarregar?.() // a pausa já reivindicou o teste e avançou `restore_seq`: a linha recarregada traz o valor atual
      } else if (r.ok) {
        // Só a pausa tem "Trocar mesmo assim" (`forcar`); o retry não tem caminho de forçar: leva à saída "A original já está no YouTube, seguir" (I-1).
        if (ehRetry) { setMotivo('conferir'); recarregar?.() } // o retry avançou `restore_seq` no banco: a chave de "conferido" tem de usar o seq novo
        else setParaConfirmar(r.campos)
      } else if (r.resultado === 'em_andamento') {
        setNosso((n) => (n ? { ...n, originalDeVolta: 'restaurando', status: 'paused' } : n))
        recarregar?.()
      } else {
        setErro(r.error)
        if (r.resultado === 'mudou' || r.resultado === 'ja_encerrado') recarregar?.()
      }
    } catch {
      setErro(FRASES.ficha.pausarFalhou)
    } finally {
      setPausaAberta(false); setOcupado(false); emCurso.current = false
    }
  }

  return {
    nosso: conferido ? null : nosso, restauradaEm, pausaAberta, ocupado, erro, motivo, paraConfirmar,
    abrirPausa: () => setPausaAberta(true),
    cancelarPausa: () => setPausaAberta(false),
    pausar: (forcar) => { void rodar(() => (forcar === true ? acoes.pauseAbTest(linhaNosso?.testId ?? '', linhaNosso?.restoreSeq ?? 0, true) : acoes.pauseAbTest(linhaNosso?.testId ?? '', linhaNosso?.restoreSeq ?? 0)), false) },
    tentarDeNovo: () => { void rodar(() => acoes.retryRestore(linhaNosso?.testId ?? '', linhaNosso?.restoreSeq ?? 0), true) },
    fecharConfirmar: () => setParaConfirmar(null),
    conferirESeguir: () => {
      setConferido(true)
      if (chaveConferido) { try { window.sessionStorage.setItem(chaveConferido, '1') } catch { /* sem storage: vale só nesta tela */ } }
    },
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
                <button type="button" className="cn-btn pri" disabled={n.ocupado} aria-busy={n.ocupado} onClick={() => n.pausar()}>{FRASES.ficha.pausarEVoltar}</button>
                <button type="button" className="cn-btn" disabled={n.ocupado} onClick={n.cancelarPausa}>{FRASES.ficha.cancelar}</button>
              </div>
            </div>
          )}
        >
          {FRASES.ficha.faixaNossoRodando(dia).apoio}
        </FaixaCaminho>
      ) : null}
      {faixa === 'restaurando' ? <FaixaCaminho tom="lab" ocupada titulo={FRASES.ficha.faixaRestaurando} /> : null}
      {faixa === 'falhou' && (n.motivo === 'conferir' || n.motivo === 'sem_registro') ? (
        <FaixaCaminho
          tom="err" role="alert" titulo={(n.motivo === 'conferir' ? FRASES.ficha.faixaRestaurarNaoVolta : FRASES.ficha.faixaSemRegistro).titulo}
          acoes={<button type="button" className="cn-btn" onClick={n.conferirESeguir}>{FRASES.ficha.conferiESeguir}</button>}
        >
          {(n.motivo === 'conferir' ? FRASES.ficha.faixaRestaurarNaoVolta : FRASES.ficha.faixaSemRegistro).apoio}
        </FaixaCaminho>
      ) : null}
      {faixa === 'falhou' && n.motivo === 'tentar' ? (
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
          onVoltar={n.fecharConfirmar} onConfirmar={() => { n.fecharConfirmar(); n.pausar(true) }}
        />
      ) : null}
    </>
  )
}
