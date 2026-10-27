'use client'
// Painel de escolha de um teste concluído (M7b T11): "O que fica no vídeo?" sem prazo e sem diálogo de Sai/Entra.
// As actions chegam por props (nenhum client importa ../actions). Cada clique é do dono; nada se repete sozinho.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { YtPortal } from '../../../_components/yt-portal'
import { useModalFocusTrap } from '../../../../_shared/editor/use-modal-focus-trap'
import type { ResultadoConferir, ResultadoEscolha } from '@/lib/youtube/ab-acao-saida'
import {
  fraseDoPainel, visaoDaSelecao, type PainelEscolha,
} from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import {
  faseDaFrase, faseInicial, painelVivo, reduzir, seqParaEnviar, travada, type EventoPainel, type FasePainel,
} from '@/lib/youtube/ab-lab-pagina/painel-fases'
import { avisoDoPainel, podeTentarDeNovo } from '@/lib/youtube/ab-lab-pagina/painel-aviso'
import { AVISO_SEM_PERMISSAO, FRASE_FIXA, TEXTO_DEMORANDO, TITULO_DRIFT, corpoDrift } from '@/lib/youtube/ab-lab-pagina/painel-textos'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import { AbConfirmarTrocaDialog } from '../ab-confirmar-troca-dialog'
import { AvisoPainel } from './aviso-painel'
import { Ic } from './icones-painel'
import { OpcaoVersao } from './opcao-versao'
import { SaiEntra } from './sai-entra'
import './pagina-lab.css'

export interface AcoesEscolha {
  /** `escolherVersao` */
  escolher: (testId: string, varianteId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoEscolha>
  /** `conferirNoAr` (só lê) */
  conferir: (testId: string) => Promise<ResultadoConferir>
}

export interface PainelConcluidoProps {
  painel: PainelEscolha
  acoes: AcoesEscolha
  onFechar: () => void
  /** Reservado: aviso de página quando a resposta chega depois de o painel fechar. */
  onAviso?: (texto: string) => void
}

export const QUINZE_S = 15_000
export const QUARENTA_E_CINCO_S = 45_000
export const RELEITURA_MS = 3_000

export function PainelConcluido({ painel, acoes, onFechar }: PainelConcluidoProps): ReactElement {
  const router = useRouter()
  const [fase, setFase] = useState<FasePainel>(() => faseInicial(painel))
  const faseRef = useRef<FasePainel>(fase)
  const envio = useRef(0)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const montado = useRef(true)
  const avisoEl = useRef<HTMLDivElement>(null)
  const fraseEl = useRef<HTMLParagraphElement>(null)
  const inicialRef = useRef<HTMLElement | null>(null)
  const dlgRef = useRef<HTMLDivElement>(null)
  const agoraIso = useRef(new Date().toISOString()).current

  const vivo = painelVivo(painel, fase, agoraIso)

  const aplicar = useCallback((ev: EventoPainel): void => {
    const v = painelVivo(painel, faseRef.current, agoraIso)
    const prox = reduzir(faseRef.current, ev, { noArId: v.noArId, restoreSeq: v.restoreSeq })
    if (prox === faseRef.current) return
    faseRef.current = prox
    if (montado.current) setFase(prox)
  }, [agoraIso, painel])

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false; for (const t of timers.current) clearTimeout(t); timers.current = [] }
  }, [])

  const limparTimers = (): void => { for (const t of timers.current) clearTimeout(t); timers.current = [] }

  const enviar = useCallback(async (forcar: boolean): Promise<void> => {
    const f = faseRef.current
    if (f.tipo === 'escrevendo' || f.tipo === 'conferindo' || f.tipo === 'sem_rede' || f.tipo === 'guardado' || f.tipo === 'no_ar') return
    const selId = f.selId
    if (!selId) return
    const v = painelVivo(painel, f, agoraIso)
    const o = v.opcoes.find(x => x.id === selId)
    const acao = visaoDaSelecao(v, selId).acao
    if (!o || o.bloqueio || acao.tipo === 'fechar' || (acao.tipo === 'deixar' && acao.desabilitado)) return
    const seq = seqParaEnviar(f, painel)
    const id = ++envio.current
    aplicar({ tipo: 'enviar', envioId: id, forcar })
    limparTimers()
    timers.current.push(setTimeout(() => aplicar({ tipo: 'quinze_s' }), QUINZE_S))
    timers.current.push(setTimeout(() => aplicar({ tipo: 'sem_resposta_45s' }), QUARENTA_E_CINCO_S))
    let r: ResultadoEscolha
    try {
      r = forcar ? await acoes.escolher(painel.testId, selId, seq, true) : await acoes.escolher(painel.testId, selId, seq)
    } catch {
      aplicar({ tipo: 'falha_rede' }) // a escrita pode ter entrado: confere em vez de dizer "falhou"
      return
    }
    limparTimers()
    aplicar({ tipo: 'resposta', envioId: id, r })
  }, [acoes, agoraIso, aplicar, painel])

  // Conferência: só lê. Relê a cada 3 s enquanto o servidor diz "escrevendo" (teto de 5 leituras no redutor).
  const conferindo = fase.tipo === 'conferindo' ? fase : null
  const confEnvio = conferindo?.envioId ?? null
  const confLeituras = conferindo?.leituras ?? 0
  useEffect(() => {
    if (confEnvio === null) return
    let vivoEfeito = true
    let t15: ReturnType<typeof setTimeout> | undefined
    const espera = setTimeout(async () => {
      t15 = setTimeout(() => { if (vivoEfeito) aplicar({ tipo: 'conferir_15s' }) }, QUINZE_S)
      let r: ResultadoConferir
      try { r = await acoes.conferir(painel.testId) } catch { r = { ok: false, estado: 'sem_leitura', error: '' } }
      if (t15) clearTimeout(t15)
      if (vivoEfeito) aplicar({ tipo: 'conferido', r })
    }, confLeituras === 0 ? 0 : RELEITURA_MS)
    return () => { vivoEfeito = false; clearTimeout(espera); if (t15) clearTimeout(t15) }
  }, [acoes, aplicar, confEnvio, confLeituras, painel.testId])

  // A página relê quando o servidor pode ter mudado o que está no ar.
  const tipoFase = fase.tipo
  useEffect(() => {
    if (tipoFase === 'no_ar' || tipoFase === 'guardado' || tipoFase === 'recusou') router.refresh()
  }, [tipoFase, router])

  const bloqueioFechar = fase.tipo === 'escrevendo'
  const fechar = useCallback(() => { if (!bloqueioFechar) onFechar() }, [bloqueioFechar, onFechar])
  const recarregar = useCallback(() => { router.refresh(); onFechar() }, [router, onFechar])

  const selId = 'selId' in fase ? fase.selId : null
  const aviso = avisoDoPainel(fase, vivo)
  useEffect(() => { if (aviso) avisoEl.current?.focus() }, [aviso?.titulo, aviso?.detalhe]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fase.tipo === 'no_ar' || fase.tipo === 'guardado') fraseEl.current?.focus() }, [fase.tipo])
  useModalFocusTrap(dlgRef, fase.tipo !== 'confirmar', fechar, inicialRef)

  if (fase.tipo === 'confirmar') {
    const o = vivo.opcoes.find(x => x.id === fase.selId)
    if (o) {
      const campo = (c: CampoNome): boolean => fase.campos.some(x => x.campo === c)
      const so: 'título' | 'miniatura' = campo('title') ? 'título' : 'miniatura'
      return (
        <AbConfirmarTrocaDialog
          campos={fase.campos}
          opcao={{ id: o.id, rotulo: o.letra, isOriginal: o.original, titulo: o.titulo, miniatura: o.miniatura }}
          rotuloConfirmar={`Deixar ${o.letra} no ar mesmo assim`}
          textos={{ titulo: TITULO_DRIFT, lead: corpoDrift(so, o.letra), nota: 'Copie o título ou salve a imagem antes, se quiser guardar.', voltar: 'Voltar' }}
          onVoltar={() => aplicar({ tipo: 'voltar' })}
          onConfirmar={() => { void enviar(true) }}
        />
      )
    }
  }

  const fraseFase = faseDaFrase(fase)
  const trava = travada(fase) && fase.tipo !== 'confirmar'
  const visao = visaoDaSelecao(vivo, selId)
  const guardado = fase.tipo === 'guardado'
  const meio = guardado ? null : visao.meio
  const tentar = fase.tipo === 'recusou' ? podeTentarDeNovo(fase) : false
  const fecharBtn = (
    <button type="button" className="lab-btn ghost lab-alvo" aria-disabled={bloqueioFechar || undefined} onClick={fechar}>Fechar</button>
  )

  let acao: ReactElement
  let solo = false
  if (!vivo.podeAdministrar || guardado || fase.tipo === 'sem_rede') { acao = fecharBtn; solo = true }
  else if (fase.tipo === 'escrevendo') {
    acao = <><button type="button" className="lab-btn pri lab-alvo wait" aria-disabled="true"><Ic n="spin" girar />Escrevendo no YouTube…</button>{fecharBtn}</>
  } else if (fase.tipo === 'conferindo') {
    acao = <><button type="button" className="lab-btn pri lab-alvo" disabled><Ic n="spin" girar />Conferindo…</button>{fecharBtn}</>
  } else if (fase.tipo === 'recusou') {
    if (tentar && selId) acao = <><button type="button" className="lab-btn pri lab-alvo" onClick={() => { void enviar(false) }}>Tentar de novo</button>{fecharBtn}</>
    else { acao = fecharBtn; solo = true }
  } else if (fase.tipo === 'erro' && fase.recarregar) {
    acao = <><button type="button" className="lab-btn pri lab-alvo" onClick={recarregar}>Recarregar</button>{fecharBtn}</>
  } else if (visao.acao.tipo === 'fechar') { acao = fecharBtn; solo = true }
  else if (visao.acao.tipo === 'manter_original') {
    acao = <><button type="button" className="lab-btn reg lab-alvo" onClick={() => { void enviar(false) }}>{visao.acao.rotulo}</button>{fecharBtn}</>
  } else {
    acao = <><button type="button" className="lab-btn pri lab-alvo" disabled={visao.acao.desabilitado} onClick={() => { void enviar(false) }}>{visao.acao.rotulo}</button>{fecharBtn}</>
  }

  return (
    <YtPortal>
      <div className="lab-pg lab-scrim">
        <div className="absolute inset-0" data-testid="painel-fundo" onClick={fechar} aria-hidden="true" />
        <div
          ref={dlgRef} role="dialog" aria-modal="true" aria-labelledby="pe-t" aria-describedby="pe-frase"
          aria-busy={fase.tipo === 'escrevendo' || undefined} className="lab-dlg pe-dlg" data-fase={fase.tipo}
        >
          <div className="pe-h">
            <div>
              <h2 id="pe-t">O que fica no vídeo?</h2>
              <p className="pe-meta">{vivo.meta}</p>
            </div>
            <button type="button" className="lab-btn txt pe-x lab-alvo" aria-label="Fechar" aria-disabled={bloqueioFechar || undefined} onClick={fechar}>
              <Ic n="x" />
            </button>
          </div>
          <p id="pe-frase" ref={fraseEl} tabIndex={-1} className="pe-frase" aria-live="polite">{fraseDoPainel(vivo, fraseFase)}</p>
          <p className="pe-fixa">{FRASE_FIXA}</p>
          {guardado ? (
            <div className="pe-feito" role="status"><Ic n="ok" /><div><b>Guardado.</b> O vídeo continua com a original (A). O teste sai da lista do que espera você.</div></div>
          ) : null}
          {aviso ? <AvisoPainel avisoRef={avisoEl} tom={aviso.tom} icone={aviso.icone} titulo={aviso.titulo} detalhe={aviso.detalhe} /> : null}
          {(fase.tipo === 'escrevendo' && fase.demorando) || (fase.tipo === 'sem_rede' && fase.motivo === 'demorando')
            ? <p className="pe-espera" role="status">{TEXTO_DEMORANDO}</p> : null}
          <fieldset className="pe-opts">
            <legend className="sr-only">Versão que fica no ar</legend>
            {vivo.opcoes.map(o => (
              <OpcaoVersao
                key={o.id} painel={vivo} opcao={o} fase={fraseFase} marcada={selId === o.id} travada={trava}
                onMarcar={id => aplicar({ tipo: 'marcar', varianteId: id })}
                radioRef={el => { if (el && (selId === o.id || (selId === null && inicialRef.current === null))) inicialRef.current = el }}
              />
            ))}
          </fieldset>
          {!vivo.podeAdministrar ? <p className="pe-sem" role="status"><Ic n="lock" /><span>{AVISO_SEM_PERMISSAO}</span></p> : null}
          {meio?.tipo === 'sai_entra' ? <SaiEntra sai={meio.sai} entra={meio.entra} linhaNeutra={meio.linhaNeutra} /> : null}
          {meio?.tipo === 'ok' ? <p className="pe-sem"><Ic n="ok" /><span>{meio.texto}</span></p> : null}
          {meio?.tipo === 'info' ? <p className="pe-sem"><Ic n="info" /><span>{meio.texto}</span></p> : null}
          <div className={`pe-dact${solo ? ' solo' : ''}`}>{acao}</div>
        </div>
      </div>
    </YtPortal>
  )
}
