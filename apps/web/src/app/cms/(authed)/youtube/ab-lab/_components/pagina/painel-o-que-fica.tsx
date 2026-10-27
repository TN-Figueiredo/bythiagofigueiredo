'use client'
// Painel "O que fica no vídeo?" (M7 T8). As actions chegam por props (nenhum client importa ../actions).
// Um só envio por vez; com a escrita em voo nada fecha o painel (Esc, X, Cancelar, fundo).
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { YtPortal } from '../../../_components/yt-portal'
import { useModalFocusTrap } from '../../../../_shared/editor/use-modal-focus-trap'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { diaMesSp } from '@/lib/youtube/ab-data-curta'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import {
  avisoDaEscolha, escolhaDe, mensagemDeFalha, mensagemDeFeito, rotuloDoBotao,
} from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import type { OpcaoPainel, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { AbConfirmarTrocaDialog } from '../ab-confirmar-troca-dialog'
import { PainelConcluido, type AcoesEscolha } from './painel-concluido'
import { ESPERA_SEM_RESPOSTA_MS, hrefDoLogin, sessaoExpirou } from '../ab-end-test-dialog'
import './pagina-lab.css'

export interface AcoesDecisao extends AcoesEscolha {
  /** `endAbTest` com o id do teste */
  encerrar: (testId: string, o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
}

export interface PainelOQueFicaProps {
  /** `PainelEscolha` = teste concluído (M7b); `PainelDecisao` = teste rodando. */
  painel: PainelDecisao | PainelEscolha
  acoes: AcoesDecisao
  onFechar: () => void
  /** Aviso de página quando a resposta chega depois de o painel fechar. */
  onAviso?: (texto: string) => void
}

type Fase = 'escolha' | 'enviando' | 'sem_resposta' | 'sessao_expirada' | 'recarregar' | 'feito'
type Pendencia = Array<{ campo: CampoNome; valor_atual: string }>

const ctrTexto = (c: number | null): string => c === null ? 'CTR não medido' : `CTR ${(c * 100).toFixed(1).replace('.', ',')}%`

/** Aviso do teste ativo sem versão sugerida (desvio 5): o modelo só avisa quando há sugerida. */
function avisoSemSugerida(p: PainelDecisao, o: OpcaoPainel | null): string {
  if (!o) return p.diaDeTeto ? `Escolher encerra o teste agora (${p.diaDeTeto}).` : 'Escolher encerra o teste agora.'
  return o.original
    ? `Manter ${o.letra} encerra o teste agora, sem aplicar outra versão.`
    : `Escolher ${o.letra} encerra o teste agora e coloca ${o.letra} no ar.`
}

export function PainelOQueFica({ painel, acoes, onFechar, onAviso }: PainelOQueFicaProps): ReactElement {
  if (painel.modo === 'escolha') return <PainelConcluido painel={painel} acoes={acoes} onFechar={onFechar} onAviso={onAviso} />
  return <PainelDecisaoLegado painel={painel} acoes={acoes} onFechar={onFechar} onAviso={onAviso} />
}

function PainelDecisaoLegado({ painel, acoes, onFechar, onAviso }: Omit<PainelOQueFicaProps, 'painel'> & { painel: PainelDecisao }): ReactElement {
  const router = useRouter()
  const [escolhaId, setEscolhaId] = useState<string | null>(painel.padrao)
  const [fase, setFase] = useState<Fase>('escolha')
  const [erro, setErro] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)
  const [pendencia, setPendencia] = useState<Pendencia | null>(null)
  const voo = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expirou = useRef(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const travado = fase === 'enviando' || fase === 'sem_resposta' || fase === 'sessao_expirada' || fase === 'recarregar'
  const fechar = useCallback(() => {
    if (travado) return
    onFechar()
  }, [travado, onFechar])
  // "Recarregar" sai SEM a guarda
  const recarregarPagina = useCallback(() => {
    router.refresh()
    onFechar()
  }, [router, onFechar])

  const opcao = painel.opcoes.find(o => o.varianteId === escolhaId) ?? null

  const enviar = useCallback(async (forcar: boolean) => {
    if (voo.current || !escolhaId) return
    const e = escolhaDe(painel, escolhaId)
    if (!e) return
    voo.current = true
    expirou.current = false
    setErro(null)
    setPendencia(null)
    setFase('enviando')
    timer.current = setTimeout(() => {
      expirou.current = true
      setErro(mensagemDeFalha(painel, escolhaId, { tipo: 'rede' }))
      setFase('sem_resposta')
    }, ESPERA_SEM_RESPOSTA_MS)
    const seq = painel.restoreSeq
    let r: ResultadoAcaoSaida
    try {
      const o: OpcaoEncerrar = e.original
        ? { destino: 'original', seqVisto: seq }
        : forcar ? { destino: 'variante', varianteId: e.varianteId, forcar: true, seqVisto: seq } : { destino: 'variante', varianteId: e.varianteId, seqVisto: seq }
      r = await acoes.encerrar(painel.testId, o)
    } catch {
      if (timer.current) clearTimeout(timer.current)
      const expirada = await sessaoExpirou()
      voo.current = false
      if (expirou.current) return
      const rede = mensagemDeFalha(painel, escolhaId, { tipo: 'rede' })
      if (!montado.current) { onAviso?.(rede); return }
      if (expirada) { setFase('sessao_expirada'); return }
      setErro(rede)
      setFase('escolha')
      return
    }
    if (timer.current) clearTimeout(timer.current)
    voo.current = false
    if (expirou.current) return // a tela já disse "sem resposta": nunca troca por "Feito" nem por falha
    const variante = !e.original
    if (r.ok && r.resultado === 'feito') {
      if (!montado.current) { router.refresh(); return }
      setFeito(mensagemDeFeito(painel, escolhaId, diaMesSp(new Date().toISOString())))
      setFase('feito')
      router.refresh()
      return
    }
    if (r.ok && r.resultado === 'precisa_confirmar' && variante) {
      if (!montado.current) return
      setPendencia(r.campos)
      setFase('escolha')
      return
    }
    if (!r.ok && r.resultado === 'sem_permissao' && r.error === 'unauthenticated') {
      router.push(hrefDoLogin())
      return
    }
    // Falha: texto do modelo; ja_encerrado/mudou trazem a frase do servidor e mandam recarregar.
    const texto = !r.ok && (r.resultado === 'ja_encerrado' || r.resultado === 'mudou')
      ? r.error
      : mensagemDeFalha(painel, escolhaId, { tipo: 'servidor', error: r.ok ? 'precisa_confirmar' : r.error })
    if (!montado.current) { onAviso?.(texto); router.refresh(); return }
    if (!r.ok && (r.resultado === 'ja_encerrado' || r.resultado === 'mudou')) {
      setRecarregar(texto)
      setFase('recarregar')
      return
    }
    setErro(texto)
    setFase('escolha')
  }, [acoes, escolhaId, onAviso, painel, router])

  if (pendencia && opcao) {
    return (
      <AbConfirmarTrocaDialog
        campos={pendencia}
        opcao={{ id: opcao.varianteId, rotulo: opcao.letra, isOriginal: opcao.original, titulo: opcao.titulo, miniatura: opcao.miniatura }}
        rotuloConfirmar="Aplicar mesmo assim"
        onVoltar={() => setPendencia(null)}
        onConfirmar={() => { void enviar(true) }}
      />
    )
  }

  return (
    <Folha
      painel={painel} escolhaId={escolhaId} onEscolher={id => { setEscolhaId(id); setErro(null) }}
      fase={fase} erro={erro} recarregar={recarregar} feito={feito} travado={travado}
      fechar={fechar} onEnviar={() => { if (!escolhaId || travado) return; void enviar(false) }} onRecarregar={recarregarPagina}
    />
  )
}

interface FolhaProps {
  painel: PainelDecisao
  escolhaId: string | null
  onEscolher: (id: string) => void
  fase: Fase
  erro: string | null
  recarregar: string | null
  feito: string | null
  travado: boolean
  fechar: () => void
  onEnviar: () => void
  onRecarregar: () => void
}

function Folha({ painel, escolhaId, onEscolher, fase, erro, recarregar, feito, travado, fechar, onEnviar, onRecarregar }: FolhaProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const inicialRef = useRef<HTMLElement | null>(null)
  const erroRef = useRef<HTMLParagraphElement>(null)
  const feitoRef = useRef<HTMLButtonElement>(null)
  useModalFocusTrap(ref, true, fechar, inicialRef)
  useEffect(() => { if (erro && fase === 'escolha') erroRef.current?.focus() }, [erro, fase])
  useEffect(() => { if (fase === 'feito') feitoRef.current?.focus() }, [fase])

  const enviando = fase === 'enviando'
  const opcao = painel.opcoes.find(o => o.varianteId === escolhaId) ?? null
  const ativo = painel.modo === 'ativo'
  const semSugerida = ativo && !painel.sugeridaLetra
  const nada = !opcao || opcao.estado !== 'escolhivel'
  const idInicial = (escolhaId && opcao?.estado === 'escolhivel' ? escolhaId : painel.opcoes.find(o => o.estado === 'escolhivel')?.varianteId) ?? null
  const aviso = semSugerida ? avisoSemSugerida(painel, opcao) : avisoDaEscolha(painel, escolhaId)
  const semPermissao = !painel.podeDeixarVariante
  const rodape = 'Mudar o que está no ar muda o YouTube agora. Dá para voltar à original por 7 dias.'
  const mostraEscolha = fase === 'escolha' || enviando

  const rotuloPrimario = erro && fase === 'escolha' ? 'Tentar de novo' : enviando ? 'Aplicando…' : rotuloDoBotao(painel, escolhaId)
  const dentroAviso = aviso ? (
    <p className={semSugerida ? 'lab-aviso avp' : 'lab-aviso'} role="status" data-aviso>{aviso}</p>
  ) : null

  return (
    <YtPortal>
      <div className="lab-pg lab-scrim">
        <div className="absolute inset-0" data-testid="painel-fundo" onClick={fechar} aria-hidden="true" />
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="lab-painel-t" aria-busy={enviando || undefined} className="lab-dlg">
          {fase === 'feito' ? (
            <>
              <div className="flex items-start justify-between gap-3"><h2 id="lab-painel-t" className="m-0 text-xl font-semibold" style={{ fontFamily: 'Georgia, serif' }}>Feito</h2></div>
              <p className="mt-3.5 text-sm" role="status">{feito}</p>
              <div className="lab-acoes"><button ref={feitoRef} type="button" className="lab-btn pri lab-alvo" onClick={fechar}>Fechar</button></div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="lab-painel-t" className="m-0 text-xl font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>O que fica no vídeo?</h2>
                  <p className="m-0 mt-0.5 text-xs text-cms-text-muted">{painel.nomeVideo}</p>
                </div>
                <button type="button" className="lab-btn txt lab-alvo -mr-2 -mt-1.5 min-w-11 !px-0" aria-label="Fechar" aria-disabled={travado || undefined} onClick={fechar}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </div>
              <div role="radiogroup" aria-labelledby="lab-painel-t" className="mt-3.5 flex flex-col gap-2" {...(enviando ? { inert: true } : {})}>
                {painel.opcoes.map(o => {
                  const esc = o.estado === 'escolhivel'
                  const agora = o.estado === 'no_ar_fixo'
                  const vis = painel.tipo === 'title'
                  return (
                    <label key={o.varianteId} className={`lab-opt${esc ? '' : agora ? ' now' : ' off'}`}>
                      <input
                        ref={o.varianteId === idInicial ? (el => { inicialRef.current = el }) : undefined}
                        type="radio" name="lab-ver" value={o.varianteId} checked={escolhaId === o.varianteId} disabled={!esc}
                        onChange={() => { if (esc && !enviando) onEscolher(o.varianteId) }} aria-label={`Versão ${o.letra}`}
                      />
                      {vis
                        ? <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md border border-[#40382D] bg-[#272219] text-[13px] font-bold text-cms-text-muted">{o.letra}</span>
                        : o.miniatura
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={o.miniatura} alt="" aria-hidden="true" className="aspect-video w-[72px] rounded-md object-cover" />
                          : <span aria-hidden="true" className="grid aspect-video w-[72px] place-items-center rounded-md bg-[#272219] text-xs text-cms-text-muted">sem miniatura</span>}
                      <span className="flex min-w-0 flex-col gap-1">
                        <b className="line-clamp-2 text-sm font-semibold leading-[1.35]">{vis ? (o.titulo ?? 'sem título gravado') : `Versão ${o.letra}`}</b>
                        <span className="text-xs text-cms-text-muted tabular-nums">{vis ? '' : `Versão ${o.letra} · `}{ctrTexto(o.ctr)}</span>
                        <span className="flex w-full flex-wrap items-start gap-1.5">
                          {o.original ? <Selo>Original</Selo> : null}
                          {o.noAr ? <Selo classe="border-[#3E8F63] text-[#6FCF97]">No ar agora</Selo> : null}
                          {o.sugerida ? <Selo classe="border-cms-accent text-cms-accent">Sugerida pelo teste</Selo> : null}
                          {o.estado === 'em_breve' ? <Selo classe="border-dashed text-[#958A75]">Em breve</Selo> : null}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {!semSugerida ? dentroAviso : null}
              {ativo && painel.regraV2 && !semSugerida ? <p className="mt-2 text-xs text-cms-text-muted">Encerrar à mão tira o teste da decisão: o resultado não será calculado.</p> : null}
              {semPermissao ? <p className="mt-2 text-xs text-cms-text-muted">Só quem administra o site pode deixar uma versão no ar.</p> : null}
              {erro && (fase === 'escolha' || fase === 'sem_resposta') ? <p ref={erroRef} className="lab-aviso err" role="alert" tabIndex={-1}>{erro}</p> : null}
              {fase === 'recarregar' && recarregar ? <p className="lab-aviso err" role="alert">{recarregar}</p> : null}
              {fase === 'sessao_expirada' ? <p className="lab-aviso err" role="alert">Sua sessão expirou. Entre de novo para continuar.</p> : null}
              <p className="mt-3 text-xs text-cms-text-muted" {...(enviando ? { role: 'status' } : {})}>
                {enviando ? 'Mudando no YouTube. Aguarde, não feche esta janela.' : rodape}
              </p>
              <div className="lab-acoes">
                {semSugerida ? dentroAviso : null}
                {mostraEscolha ? (
                  <>
                    <button type="button" className="lab-btn ghost lab-alvo" aria-disabled={enviando || undefined} onClick={fechar}>Cancelar</button>
                    <button
                      type="button" aria-disabled={nada || enviando || undefined}
                      className={`lab-btn pri lab-alvo${enviando ? ' wait' : ''}${nada && !enviando ? ' dis' : ''}`}
                      onClick={onEnviar}
                    >
                      {rotuloPrimario}
                    </button>
                  </>
                ) : fase === 'sessao_expirada' ? (
                  <>
                    <a className="lab-btn pri lab-alvo" href={hrefDoLogin()}>Entrar de novo</a>
                    <button type="button" className="lab-btn ghost lab-alvo" onClick={onRecarregar}>Fechar</button>
                  </>
                ) : (
                  <button type="button" className="lab-btn pri lab-alvo" onClick={onRecarregar}>Recarregar</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </YtPortal>
  )
}

function Selo({ children, classe = '' }: { children: string; classe?: string }): ReactElement {
  return <span className={`lab-selo inline-flex items-center whitespace-nowrap rounded-full border border-[#40382D] px-[9px] text-xs font-semibold leading-[18px] text-cms-text-muted ${classe}`}>{children}</span>
}
