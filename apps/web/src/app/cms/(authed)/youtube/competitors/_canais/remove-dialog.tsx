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
import type { RespostaRemocao } from '../actions'
import { PinIcon } from '../_chrome/pin-kit'
import {
  PRAZO_ACAO_MS, PRAZO_CONTAGEM_MS, TXT, botaoPrincipal, codigoPassageiro, fraseDoErro, milhar, nomeConfere, opcaoApagar, type Caminho, type CodigoTela, type Fase,
} from './remover-model'

export type ImpactAnswer = { ok: true; impact: CompetitorRemovalImpact; semGuardar: SemGuardar } | { ok: false }
export type Desfecho =
  | { caminho: 'guardar'; jaPedido: boolean }
  | { caminho: 'apagar'; videos: number; leituras?: number; registrosDiarios?: number }

type Erro = { codigo: CodigoTela | 'sem-resposta'; frase?: string; caminho: Caminho }
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

export function RemoveDialog({ id, name, onImpact, onPedir, onApagar, onCancel, onDone, onConferir, onBloqueio, trap }: {
  id: string; name: string
  /** Server action getCompetitorRemovalImpactAction, por props. Ausente = a contagem não pode ser pedida. */
  onImpact?: (id: string) => Promise<ImpactAnswer>
  onPedir: (id: string) => Promise<RespostaRemocao<{ jaPedido: boolean }>>
  onApagar: (id: string, nome: string) => Promise<RespostaRemocao<{ videos: number; leituras?: number; registrosDiarios?: number }>>
  onCancel: () => void
  /** Sucesso: quem chamou fecha a janela e mostra o toast. */
  onDone: (d: Desfecho) => void
  /** "Fechar e conferir" do estado incerto: fecha e atualiza a lista. */
  onConferir: () => void
  /** Avisa a tela-mãe que há envio em curso (o Esc dela não pode fechar a janela). */
  onBloqueio: (bloqueado: boolean) => void
  trap: (e: KeyboardEvent<HTMLDivElement>) => void
}) {
  const uid = useId()
  const ids = { t: `${uid}-t`, lead: `${uid}-lead`, st: `${uid}-st`, why: `${uid}-why`, hint: `${uid}-hint`, nm: `${uid}-nm` }
  const [caminho, setCaminho] = useState<Caminho>('guardar')
  const [fase, setFase] = useState<Fase>('contando')
  const [impacto, setImpacto] = useState<CompetitorRemovalImpact | null>(null)
  const [semGuardar, setSemGuardar] = useState<SemGuardar | null>(null)
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

  const contar = useCallback(() => {
    const tok = ++tokContagem.current
    setFase('contando')
    const timer = setTimeout(() => { if (tok === tokContagem.current) { tokContagem.current++; setFase('falha_contagem') } }, PRAZO_CONTAGEM_MS)
    const falhar = () => { if (tok === tokContagem.current) { tokContagem.current++; clearTimeout(timer); setFase('falha_contagem') } }
    if (!onImpact) { falhar(); return () => clearTimeout(timer) }
    onImpact(id).then(r => {
      if (tok !== tokContagem.current) return // resposta tardia: ignorada
      clearTimeout(timer)
      if (!r.ok) { falhar(); return }
      tokContagem.current++
      setImpacto(r.impact); setSemGuardar(r.semGuardar); setFase('pronto')
    }).catch(falhar)
    return () => clearTimeout(timer)
  }, [id, onImpact])

  useEffect(() => contar(), [contar])
  useEffect(() => { radioGuardar.current?.focus() }, [])
  useEffect(() => () => { vivo.current = false; if (timerAcao.current) clearTimeout(timerAcao.current); onBloqueioRef.current(false) }, [])

  const apagarLiberado = opcaoApagar({ fase, semGuardar })
  const nomeOk = nomeConfere(nome, name)
  const btn = botaoPrincipal({ caminho, fase, nomeOk })
  const enviando = fase === 'enviando'
  const incerto = fase === 'incerto'
  const comErro = fase === 'erro'

  /** Depois de um erro/incerto: sem contagem em mãos, volta a `falha_contagem` (com "Contar de novo"), nunca a um `pronto` sem números. */
  const faseDepoisDoErro: Fase = impacto ? 'pronto' : 'falha_contagem'
  const sair = (f: Fase) => { setFase(f); onBloqueioRef.current(false) }
  const enviar = async () => {
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
      if (!r.ok) { setErro({ codigo: r.codigo, frase: r.frase, caminho: c }); sair('erro'); return }
      onBloqueioRef.current(false)
      if (c === 'guardar') onDone({ caminho: 'guardar', jaPedido: (r as { jaPedido: boolean }).jaPedido })
      else {
        const a = r as { videos: number; leituras?: number; registrosDiarios?: number }
        onDone({ caminho: 'apagar', videos: a.videos, ...(a.leituras !== undefined ? { leituras: a.leituras } : {}), ...(a.registrosDiarios !== undefined ? { registrosDiarios: a.registrosDiarios } : {}) })
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
      // em envio, nada fecha (o resultado ainda vai chegar); no incerto, fechar também atualiza a lista
      if (enviando) { e.preventDefault(); e.stopPropagation(); return }
      e.stopPropagation()
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
  const lead = caminho === 'guardar' ? TXT.leadGuardar : TXT.leadApagar
  const frase = erro ? fraseDoErro(erro.codigo, erro.frase, erro.caminho) : null
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
              aria-describedby={apagarLiberado.ativa ? undefined : ids.why}
              onChange={() => { setCaminho('apagar'); setErro(null); if (fase === 'erro' || fase === 'incerto') setFase(faseDepoisDoErro) }} />
            <b>{TXT.apagarTitulo}</b>
            <small>{TXT.apagarSub}</small>
            {apagarLiberado.ativa ? null : <span className="why" id={ids.why}><PinIcon name="err" /><span>{apagarLiberado.porque}</span></span>}
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
        <div className="fx-loss-box">
          <div className="fx-sizer" aria-hidden="true">
            <ul className="fx-lossz">
              {LINHAS.map(l => <li key={l.k}><b className="fx-wait">contando…</b><span>{l.varios}<span>{subDe(l.k, null) + TXT.subLeiturasExtra}</span></span></li>)}
            </ul>
          </div>
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
            </ul>
          </div>}
        </div>

        {caminho === 'guardar' ? <p className="fx-never">{TXT.falta}</p> : (
          <div className="fld">
            <label htmlFor={ids.nm}>{TXT.nomeRotulo} <b>{name}</b></label>
            <input id={ids.nm} value={nome} onChange={e => setNome(e.target.value)} autoComplete="off" spellCheck={false} disabled={enviando}
              aria-describedby={ids.hint} />
            <span className={'hint' + (nomeOk ? ' good' : '')} id={ids.hint}>{nomeOk ? TXT.nomeOk : TXT.nomeDica}</span>
          </div>
        )}

        {frase && (comErro || incerto) ? (
          <div className="fx-msg fx-err" role="alert">
            <PinIcon name="err" />
            <span>
              <b>{frase.titulo}</b> {frase.corpo}
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
              <button type="button" className="btn primary" onClick={escolherGuardar}>Escolher guardar no NAS</button>
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
