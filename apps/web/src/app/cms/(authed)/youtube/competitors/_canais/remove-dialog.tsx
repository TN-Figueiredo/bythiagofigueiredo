'use client'
/**
 * "Remover <canal>?" (A5, F2). Primeiro pergunta o MOTIVO: guardar no NAS (o canal para de ser coletado, a vaga sai na hora e o agente termina o
 * serviço) ou apagar sem guardar (canal com até 30 dias, nome digitado). A contagem é pedida ao abrir; as quatro linhas já existem e a caixa
 * reserva a altura do estado mais alto, então a contagem chegando não a faz pular. Falha de contagem nunca mostra zeros.
 *
 * A regra mora em `remover-model.ts` (testada em node); aqui só se desenha e se cuida do tempo: prazos de 10 s (contagem) e 30 s (ação), reenvio
 * guardado por `useRef` (não há <form>: Enter não reenvia) e o aviso de "envio em curso" para o Esc das telas-mãe não fechar a janela.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { CompetitorRemovalImpact, SemGuardar } from '@/lib/youtube/competitor-removal-impact'
import type { RespostaRemocao, RespostaDoImpacto, MesForaDaRecusa } from '../actions'
import { fraseDoMesFora } from '@/lib/youtube/observatorio/arquivo-mensal/frases-remocao'
import { link } from '@/lib/youtube/observatorio/links'
import { PinIcon } from '../_chrome/pin-kit'
import { RiInfo } from './ri-info'
import {
  BLOB_INFO, PRAZO_ACAO_MS, PRAZO_CONTAGEM_MS, SIZER_PORQUE, SIZER_SUB_ARQUIVO, TXT, botaoPrincipal, codigoPassageiro, fraseBlobDialogo, fraseDoErro, linhaArquivo, milhar, nomeConfere, opcaoApagar,
  type ArquivoImpact, type Capacidade, type Caminho, type CodigoTela, type Fase, type ImagensDoAviso,
} from './remover-model'

/** Igual à resposta da ação: `arquivo`, `capacidade` e `dataDoComando` são OBRIGATÓRIOS (vêm juntos com a contagem ou é `ok: false`). Sem `arquivo` a tela não liga o apagar (fail closed). */
export type ImpactAnswer = RespostaDoImpacto
export type Desfecho =
  | { caminho: 'guardar'; jaPedido: boolean }
  | ({ caminho: 'apagar'; videos: number; leituras?: number; registrosDiarios?: number } & ImagensDoAviso)

type Erro = { codigo: CodigoTela | 'sem-resposta'; frase?: string; caminho: Caminho; mesFora?: MesForaDaRecusa }
/** O Esc que fechou o ⓘ ainda chega ao diálogo dentro deste prazo; passado ele, o Esc volta a fechar o diálogo. */
const JANELA_ESC_INFO_MS = 250
/** A explicação mais longa da 1ª linha (cinco dígitos de versões): o que o sizer reserva. */
const SIZER_SUB = TXT.subVideos(99_999)

const LINHAS = [
  { k: 'videos', um: 'vídeo', varios: 'vídeos', nenhum: 'nenhum' },
  { k: 'dias', um: 'dia de registros', varios: 'dias de registros', nenhum: 'nenhum' },
  { k: 'leituras', um: 'leitura da forja e da página de vídeo', varios: 'leituras da forja e da página de vídeo', nenhum: 'nenhuma' },
  { k: 'itens', um: 'item fixado ou salvo', varios: 'itens fixados ou salvos', nenhum: 'nenhum' },
] as const
type ChaveLinha = (typeof LINHAS)[number]['k']

function numerosDe(m: CompetitorRemovalImpact): Record<ChaveLinha, number> {
  return { videos: m.videos, dias: m.dailyDays, leituras: m.readings + m.watch.readings, itens: m.pinned + m.bookmarks }
}
function subDe(k: ChaveLinha, m: CompetitorRemovalImpact | null): string {
  if (k === 'videos') return m ? TXT.subVideos(m.versions) : SIZER_SUB
  if (k === 'dias') return TXT.subDias
  if (k === 'leituras') return TXT.subLeituras + (m && m.watch.thumbs + m.watch.alvos > 0 ? TXT.subLeiturasExtra : '')
  return m ? TXT.subFixados(m.pinned, m.bookmarks) : TXT.subFixados(99, 99)
}

export function RemoveDialog({ id, name, onImpact, onPedir, onApagar, onCancel, onDone, onConferir, onBloqueio, onCopiarPedido, hojeSP, podeAdministrar, trap }: {
  id: string; name: string
  /** M6a T13c: o dia de hoje em São Paulo (AAAA-MM-DD) e se quem usa administra o site; entram na frase do mês fora. Ausentes = forma curta. */
  hojeSP?: string
  podeAdministrar?: boolean
  /** Server action getCompetitorRemovalImpactAction, por props. Ausente = a contagem não pode ser pedida. */
  onImpact?: (id: string) => Promise<ImpactAnswer>
  onPedir: (id: string) => Promise<RespostaRemocao<{ jaPedido: boolean }>>
  onApagar: (id: string, nome: string) => Promise<RespostaRemocao<{ videos: number; leituras?: number; registrosDiarios?: number; imagensRestantes?: number }>>
  onCancel: () => void
  /** Sucesso: quem chamou fecha a janela e mostra o toast. */
  onDone: (d: Desfecho) => void
  /** "Fechar e conferir" do estado incerto: fecha e atualiza a lista. */
  onConferir: () => void
  /** Avisa a tela-mãe que há envio em curso (o Esc dela não pode fechar a janela). */
  onBloqueio: (bloqueado: boolean) => void
  /** "Copiar pedido ao agente": o próximo passo quando a F1 também recusaria guardar (I6). */
  onCopiarPedido?: () => void
  trap: (e: KeyboardEvent<HTMLDivElement>) => void
}) {
  const uid = useId()
  const ids = { t: `${uid}-t`, lead: `${uid}-lead`, st: `${uid}-st`, why: `${uid}-why`, hint: `${uid}-hint`, nm: `${uid}-nm` }
  const [caminho, setCaminho] = useState<Caminho>('guardar')
  const [fase, setFase] = useState<Fase>('contando')
  const [impacto, setImpacto] = useState<CompetitorRemovalImpact | null>(null)
  const [semGuardar, setSemGuardar] = useState<SemGuardar | null>(null)
  const [arquivo, setArquivo] = useState<ArquivoImpact | null>(null)
  const [capacidade, setCapacidade] = useState<Capacidade>('nao-nao')
  const [dataDoComando, setDataDoComando] = useState<string | null>(null)
  const [corrida, setCorrida] = useState(false)
  /** M6a T13c: meses fora das telas lidos ao abrir. Só avisa no pedir; nunca bloqueia. */
  const [mesForaAoAbrir, setMesForaAoAbrir] = useState<MesForaDaRecusa | null>(null)
  const infoAberto = useRef(false)
  /** O popover nativo fecha no Esc e dispara `toggle` ANTES do keydown chegar aqui: sem este carimbo o Esc do ⓘ fecharia o diálogo também. */
  const infoFechouEm = useRef(0)
  /** O Esc deste diálogo já fechou o ⓘ à mão: o `toggle` que vem depois não pode armar a janela (um 2º Esc logo em seguida fecha o diálogo). */
  const fechouPorEsc = useRef(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<Erro | null>(null)
  const emVoo = useRef(false)
  const tokContagem = useRef(0)
  const tokAcao = useRef(0)
  const timerAcao = useRef<ReturnType<typeof setTimeout> | null>(null)
  const radioGuardar = useRef<HTMLInputElement>(null)
  const onBloqueioRef = useRef(onBloqueio)
  onBloqueioRef.current = onBloqueio
  const vivo = useRef(true)
  // a identidade de onImpact muda a cada revalidação da página: ela não pode reiniciar a contagem (C1)
  const onImpactRef = useRef(onImpact)
  onImpactRef.current = onImpact

  const contar = useCallback(() => {
    const tok = ++tokContagem.current
    setFase('contando')
    const timer = setTimeout(() => { if (tok === tokContagem.current) { tokContagem.current++; setFase('falha_contagem') } }, PRAZO_CONTAGEM_MS)
    const falhar = () => { if (tok === tokContagem.current) { tokContagem.current++; clearTimeout(timer); setFase('falha_contagem') } }
    const pedir = onImpactRef.current
    if (!pedir) { falhar(); return () => clearTimeout(timer) }
    pedir(id).then(r => {
      if (tok !== tokContagem.current) return // resposta tardia: ignorada
      clearTimeout(timer)
      if (!r.ok || !r.arquivo) { falhar(); return } // resposta sem o arquivo: nunca liga o apagar
      tokContagem.current++
      setImpacto(r.impact); setSemGuardar(r.semGuardar); setArquivo(r.arquivo); setCapacidade(r.capacidade ?? 'nao-nao'); setDataDoComando(r.dataDoComando ?? null); setMesForaAoAbrir(r.mesFora ?? null); setCorrida(false); setFase('pronto')
    }).catch(falhar)
    return () => clearTimeout(timer)
  }, [id])

  /** Recontagem silenciosa (depois da corrida): só atualiza os números, sem mexer na fase nem na faixa do erro. */
  const recontarEmSegundoPlano = () => {
    const pedir = onImpactRef.current
    if (!pedir) return
    const tok = ++tokContagem.current
    pedir(id).then(r => {
      if (tok !== tokContagem.current || !vivo.current || !r.ok || !r.arquivo) return
      setImpacto(r.impact); setSemGuardar(r.semGuardar); setArquivo(r.arquivo); setCapacidade(r.capacidade ?? 'nao-nao'); setDataDoComando(r.dataDoComando ?? null); setMesForaAoAbrir(r.mesFora ?? null)
    }).catch(() => { /* a lista segue como estava */ })
  }

  useEffect(() => contar(), [contar])
  useEffect(() => { radioGuardar.current?.focus() }, [])
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; if (timerAcao.current) clearTimeout(timerAcao.current); onBloqueioRef.current(false) } }, [])

  const faixaErro = useRef<HTMLDivElement>(null)
  const apagarLiberado = opcaoApagar({ fase, semGuardar, arquivo, corrida })
  const nomeOk = nomeConfere(nome, name)
  const btn = botaoPrincipal({ caminho, fase, nomeOk })
  const enviando = fase === 'enviando'
  const incerto = fase === 'incerto'
  const comErro = fase === 'erro'

  /** Depois de um erro/incerto: sem contagem em mãos, volta a `falha_contagem` (com "Contar de novo"), nunca a um `pronto` sem números. */
  const faseDepoisDoErro: Fase = impacto ? 'pronto' : 'falha_contagem'
  const sair = (f: Fase) => { setFase(f); onBloqueioRef.current(false) }
  const campoNome = useRef<HTMLInputElement>(null)
  const enviar = async () => {
    if (btn.desabilitado && caminho === 'apagar' && !nomeOk && fase === 'pronto' && !emVoo.current) { campoNome.current?.focus({ preventScroll: true }); campoNome.current?.scrollIntoView?.({ block: 'center' }); return }
    if (emVoo.current || btn.desabilitado) return
    emVoo.current = true
    const tok = ++tokAcao.current
    const c = caminho
    setErro(null); setFase('enviando'); onBloqueioRef.current(true)
    timerAcao.current = setTimeout(() => {
      if (tok !== tokAcao.current) return
      tokAcao.current++; emVoo.current = false
      setErro({ codigo: 'sem-resposta', caminho: c }); sair('incerto')
    }, PRAZO_ACAO_MS)
    try {
      const r = c === 'guardar' ? await onPedir(id) : await onApagar(id, nome)
      if (tok !== tokAcao.current || !vivo.current) return // depois dos 30 s: a janela já está no "incerto"
      tokAcao.current++
      if (timerAcao.current) clearTimeout(timerAcao.current)
      emVoo.current = false
      if (!r.ok) {
        // corrida: o arquivo nasceu entre a contagem e o clique. A opção de apagar se desliga com a frase do Q2 e Guardar é a saída
        if (c === 'apagar' && r.codigo === 'apagar_com_arquivo') { setCorrida(true); setCaminho('guardar'); recontarEmSegundoPlano() }
        setErro({ codigo: r.codigo, frase: r.frase, caminho: c, ...(r.mesFora ? { mesFora: r.mesFora } : {}) }); sair('erro'); return
      }
      onBloqueioRef.current(false)
      if (c === 'guardar') onDone({ caminho: 'guardar', jaPedido: (r as { jaPedido: boolean }).jaPedido })
      else {
        const a = r as { videos: number; leituras?: number; registrosDiarios?: number; imagensRestantes?: number }
        onDone({
          caminho: 'apagar', videos: a.videos, ...(a.leituras !== undefined ? { leituras: a.leituras } : {}), ...(a.registrosDiarios !== undefined ? { registrosDiarios: a.registrosDiarios } : {}),
          ...(a.imagensRestantes !== undefined ? { imagensRestantes: a.imagensRestantes } : {}),
          ...(arquivo ? { imagensAoAbrir: arquivo.imagensBlob, capacidade, dataDoComando } : {}),
        })
      }
    } catch {
      if (tok !== tokAcao.current || !vivo.current) return
      tokAcao.current++
      if (timerAcao.current) clearTimeout(timerAcao.current)
      emVoo.current = false
      setErro({ codigo: 'sem-resposta', caminho: c }); sair('incerto')
    }
  }

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // o ⓘ aberto fecha sozinho (Esc do popover); o diálogo fica. preventDefault: o ouvinte de Esc do document (canais-screen) roda
      // depois do React mesmo com stopPropagation (o Next hidrata no document), e é o defaultPrevented que o faz desistir
      if (infoAberto.current || Date.now() - infoFechouEm.current < JANELA_ESC_INFO_MS) {
        infoFechouEm.current = 0
        // preventDefault cancela o fechamento nativo do popover no Chrome: fecha-se explicitamente o que estiver aberto
        try {
          const aberto = e.currentTarget.querySelector(':popover-open') as HTMLElement | null
          if (aberto?.hidePopover) { fechouPorEsc.current = true; aberto.hidePopover() }
        } catch { /* jsdom sem :popover-open */ }
        e.preventDefault(); e.stopPropagation(); return
      }
      // em envio, nada fecha (o resultado ainda vai chegar); no incerto, fechar também atualiza a lista
      if (enviando) { e.preventDefault(); e.stopPropagation(); return }
      e.preventDefault(); e.stopPropagation()
      if (incerto) onConferir(); else onCancel()
      return
    }
    trap(e)
  }

  const escolherGuardar = () => { setCaminho('guardar'); setErro(null); setFase(faseDepoisDoErro) }

  const contando = fase === 'contando'
  // sem contagem em mãos, um erro/incerto não esconde a falha: o "Contar de novo" continua à vista (Yannis M-2)
  const mostrarFalha = fase === 'falha_contagem' || ((fase === 'erro' || fase === 'incerto') && impacto === null)
  const status = contando ? TXT.contando
    : enviando ? (caminho === 'apagar' ? `Apagando ${name}. Aguarde.` : `Parando a coleta de ${name}. Aguarde.`)
      : mostrarFalha ? TXT.falhaTitulo : ''
  const nums = impacto ? numerosDe(impacto) : null
  // M3b-G5: depois de ver a lista contada no apagar, voltar a guardar não reserva de novo (a reserva só protege a chegada da contagem)
  const [semReserva, setSemReserva] = useState(false)
  useEffect(() => { if (caminho === 'apagar' && nums) setSemReserva(true) }, [caminho, nums])
  const arquivoLinha = linhaArquivo(arquivo)
  const blob = caminho === 'apagar' && arquivo ? fraseBlobDialogo(arquivo.imagensBlob) : null
  const lead = caminho === 'guardar' ? TXT.leadGuardar : TXT.leadApagar
  useEffect(() => { if (erro && (fase === 'erro' || fase === 'incerto')) faixaErro.current?.scrollIntoView?.({ block: 'center' }) }, [erro, fase]) // center: com nearest a barra sticky (.acts) cobre o alvo
  const frase = erro ? fraseDoErro(erro.codigo, erro.frase, erro.caminho) : null
  const aoMudarInfo = (a: boolean) => { infoAberto.current = a; if (!a) { if (fechouPorEsc.current) fechouPorEsc.current = false; else infoFechouEm.current = Date.now() } }
  const forMesFora = erro?.caminho === 'apagar' && erro.codigo === 'mes_destacado_em_transito'
  const semSaidaGuardar = erro?.caminho === 'apagar' && (erro.codigo === 'video_compartilhado' || forMesFora) // decisão C (T13c): na recusa do mês fora só Fechar; o aviso do guardar aparece no diálogo ao reabrir (a F1 aceita guardar nesse caso)
  const dadosMesFora = (m: MesForaDaRecusa, recusadoNoClique: boolean) => ({ ...m, recusadoNoClique, ...(hojeSP ? { hojeSP } : {}), ...(podeAdministrar !== undefined ? { podeAdministrar } : {}) })
  const fraseMes = forMesFora && erro?.mesFora ? fraseDoMesFora(dadosMesFora(erro.mesFora, true)) : null
  const avisoMes = mesForaAoAbrir && !comErro && !incerto ? fraseDoMesFora(dadosMesFora(mesForaAoAbrir, false), caminho) : null
  const rotuloOutro = caminho === 'guardar' ? 'Por que não dá para apagar agora' : 'Por que o pedido fica parado'
  const avisoMesOutro = mesForaAoAbrir && !comErro && !incerto ? fraseDoMesFora(dadosMesFora(mesForaAoAbrir, false), caminho === 'guardar' ? 'apagar' : 'guardar') : null
  const passageiroGuardar = erro?.caminho === 'guardar' && codigoPassageiro(erro.codigo)

  return (
    // sem onClick no fundo: janela destrutiva só fecha por Cancelar ou Esc
    <div className="modal on" role="dialog" aria-modal="true" aria-labelledby={ids.t} aria-describedby={ids.lead} onKeyDown={teclas}>
      <div className="box fx-remove">
        <h2 id={ids.t}>Remover {name}?</h2>
        <fieldset className="rm-why">
          <legend>{TXT.pergunta}</legend>
          <label className="opt">
            <input ref={radioGuardar} type="radio" name={`${uid}-motivo`} value="guardar" checked={caminho === 'guardar'} disabled={enviando}
              onChange={() => { setCaminho('guardar'); setErro(null); if (fase === 'erro' || fase === 'incerto') setFase(faseDepoisDoErro) }} />
            <b>{TXT.guardarTitulo}</b>
            <small>{TXT.guardarSub}</small>
          </label>
          <label className={'opt' + (apagarLiberado.ativa ? '' : ' off')}>
            <input type="radio" name={`${uid}-motivo`} value="apagar" checked={caminho === 'apagar'} disabled={!apagarLiberado.ativa || enviando}
              aria-describedby={apagarLiberado.ativa || !apagarLiberado.porque ? undefined : ids.why}
              onChange={() => { setCaminho('apagar'); setErro(null); if (fase === 'erro' || fase === 'incerto') setFase(faseDepoisDoErro) }} />
            <b>{TXT.apagarTitulo}</b>
            <small>{TXT.apagarSub}</small>
            {/* D6: a frase mais longa do rádio desligado fica reservada, invisível, na mesma célula da frase real: o botão não pula quando a contagem chega */}
            <span className="why-box">
              {caminho === 'guardar' ? <span className="why why-sizer" aria-hidden="true"><PinIcon name="info" /><span>{SIZER_PORQUE}</span></span> : null}
              {apagarLiberado.ativa || !apagarLiberado.porque ? null : <span className="why" id={ids.why}><PinIcon name="info" /><span>{apagarLiberado.porque}</span></span>}
            </span>
          </label>
        </fieldset>

        {mostrarFalha ? (
          <div className="fx-msg fx-err" role="alert">
            <PinIcon name="err" />
            <span><b>{TXT.falhaTitulo}</b> {TXT.falhaCorpo}<br /><button type="button" className="btn small" onClick={() => { contar() }}>Contar de novo</button></span>
          </div>
        ) : null}

        <p className={'fx-never rm-lead' + (caminho === 'apagar' ? ' after' : '')} id={ids.lead} hidden={mostrarFalha}>{lead}</p>
        {/* o sizer é o estado mais alto (todas as linhas com a explicação mais longa), invisível e na mesma célula do que aparece */}
        {/* o aviso do mês fora fica no topo, logo abaixo da frase de impacto, para não ficar abaixo da dobra (Gio 29/10) */}
        {avisoMes ? (
          <div className="fx-msg fx-mes-fora" role="note">
            <PinIcon name="warn" />
            <span style={{ display: 'grid' }}>
              <span style={{ gridArea: '1 / 1' }}>
                <b>{avisoMes.negrito}</b> {avisoMes.resto}{' '}
                <RiInfo titulo={caminho === 'guardar' ? 'Por que o pedido fica parado' : 'Por que não dá para apagar agora'} itens={[avisoMes.info]}
                  rotuloBotao={caminho === 'guardar' ? 'Por que o pedido fica parado' : 'Por que não dá para apagar agora'} aoMudar={aoMudarInfo} />
                {avisoMes.linkArquivo ? <>{' '}<a href={link.arquivo()}>Ir para o Arquivo</a></> : null}
              </span>
              {avisoMesOutro ? (
                <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
                  <b>{avisoMesOutro.negrito}</b> {avisoMesOutro.resto}{' '}
                  <RiInfo titulo={rotuloOutro} itens={[avisoMesOutro.info]} rotuloBotao={rotuloOutro} />
                  {avisoMesOutro.linkArquivo ? <>{' '}<a href={link.arquivo()} tabIndex={-1}>Ir para o Arquivo</a></> : null}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <div className="fx-loss-box">
          {/* no caminho apagar, já contado, a reserva só deixaria vazio (Gio r4) */}
          {mostrarFalha || (caminho === 'apagar' && nums) || (semReserva && nums) ? null : <div className="fx-sizer" aria-hidden="true">
            <ul className="fx-lossz">
              {LINHAS.map(l => <li key={l.k}><b className="fx-wait">contando…</b><span>{l.varios}<span>{subDe(l.k, null) + TXT.subLeiturasExtra}</span></span></li>)}
              {caminho === 'guardar' ? <li><b className="fx-wait">contando…</b><span>meses já no arquivo<span>{SIZER_SUB_ARQUIVO}</span></span></li> : null}
            </ul>
          </div>}
          {mostrarFalha ? null : <div className="fx-shown">
            <ul className="fx-loss" aria-busy={nums ? undefined : true}>
              {LINHAS.map(l => {
                const n = nums ? nums[l.k] : null
                return (
                  <li key={l.k}>
                    <b className={n == null || n === 0 ? 'fx-wait' : undefined}>{n == null ? 'contando…' : n === 0 ? l.nenhum : milhar(n)}</b>
                    <span>{n === 1 || n === 0 ? l.um : l.varios}{n === 0 ? null : <span>{n == null ? '' : subDe(l.k, impacto)}</span>}</span>
                  </li>
                )
              })}
              {caminho === 'guardar' && arquivoLinha ? (
                <li data-novo>
                  <b>{milhar(arquivoLinha.n)}</b>
                  <span>{arquivoLinha.rotulo}<span>{arquivoLinha.sub}</span></span>
                </li>
              ) : null}
            </ul>
          </div>}
        </div>

        {caminho === 'guardar' ? <p className="fx-never">{TXT.falta}</p> : (<>
          {blob ? (
            <div className="fx-msg fx-info fx-blob" role="note">
              <PinIcon name="info" />
              <div>
                <div className="fx-blob-p">{blob.linha1Antes}<RiInfo titulo={BLOB_INFO.titulo} itens={BLOB_INFO.itens} rotuloBotao={BLOB_INFO.rotulo} aoMudar={aoMudarInfo} />{blob.linha1Depois}</div>
                <p>{blob.linha2}</p>
              </div>
            </div>
          ) : null}
          <div className="fld">
            <label htmlFor={ids.nm}>{TXT.nomeRotulo} <b>{name}</b></label>
            <input id={ids.nm} ref={campoNome} value={nome} onChange={e => setNome(e.target.value)} autoComplete="off" spellCheck={false} disabled={enviando}
              aria-describedby={ids.hint} />
            <span className={'hint' + (nomeOk ? ' good' : '')} id={ids.hint}>{nomeOk ? TXT.nomeOk : TXT.nomeDica}</span>
          </div>
        </>)}

        {frase && (comErro || incerto) ? (
          <div className="fx-msg fx-err" role="alert" ref={faixaErro}>
            <PinIcon name="err" />
            <span>
              {fraseMes ? (<>
                <b>{fraseMes.negrito}</b> {fraseMes.resto}{' '}
                <RiInfo titulo="Por que não dá" itens={[fraseMes.info]} rotuloBotao="Por que não dá para remover agora" aoMudar={aoMudarInfo} />
                {fraseMes.linkArquivo ? <>{' '}<a href={link.arquivo()}>Ir para o Arquivo</a></> : null}
              </>) : (<><b>{frase.titulo}</b> {frase.corpo}</>)}
              <span className="code">código: {erro!.codigo}</span>
            </span>
          </div>
        ) : null}

        <div className="sr" role="status" id={ids.st}>{status}</div>

        <div className="acts">
          {incerto ? (
            <>
              {erro?.caminho === 'guardar' ? <button type="button" className="btn" onClick={() => { void enviar() }}>Tentar de novo</button> : null}
              <button type="button" className="btn primary" onClick={onConferir}>Fechar e conferir</button>
            </>
          ) : comErro && erro?.caminho === 'apagar' ? (
            <>
              <button type="button" className="btn" onClick={onCancel}>Fechar</button>
              {semSaidaGuardar
                ? (onCopiarPedido ? <button type="button" className="btn primary" onClick={onCopiarPedido}>Copiar pedido ao agente</button> : null)
                : <button type="button" className="btn primary" onClick={escolherGuardar}>Escolher guardar no NAS</button>}
            </>
          ) : comErro && erro?.caminho === 'guardar' ? (
            <>
              <button type="button" className="btn" onClick={onCancel}>{passageiroGuardar ? 'Cancelar' : 'Fechar'}</button>
              {passageiroGuardar ? <button type="button" className="btn primary" onClick={() => { void enviar() }}>Tentar de novo</button> : null}
            </>
          ) : (
            <>
              <button type="button" className="btn" aria-disabled={enviando ? true : undefined} onClick={() => { if (!enviando) onCancel() }}>Cancelar</button>
              <button type="button" className={'btn ' + (caminho === 'apagar' ? 'danger' : 'primary') + (btn.ocupado ? ' busy' : '')}
                aria-disabled={btn.desabilitado ? true : undefined} aria-busy={btn.ocupado ? true : undefined}
                aria-describedby={btn.desabilitado ? (caminho === 'apagar' && !contando && !mostrarFalha ? ids.hint : ids.st) : undefined}
                onClick={() => { void enviar() }}>{btn.rotulo}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
