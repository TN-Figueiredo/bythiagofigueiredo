'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { AbConfirmarTrocaDialog } from './ab-confirmar-troca-dialog'
import type { OpcaoDoDialogo } from './encerrar-props'
import './ab-end-test-dialog.css'

/** Depois deste tempo sem resposta o diálogo para de esperar (a escrita segue no servidor). */
export const ESPERA_SEM_RESPOSTA_MS = 45_000

export interface AbEndTestDialogProps {
  aberto: boolean
  onFechar: () => void
  testeNome: string
  noArAgora: { rotulo: string; desde: string }
  opcoes: OpcaoDoDialogo[]
  originalBaixaResolucao: boolean
  podeDeixarVariante: boolean
  /** Server action `endAbTest` já com o id do teste, montada no server component chamador. */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  /** `restore_seq` que a tela leu ao abrir; a action recusa se o teste mudou desde então (D3). */
  seqVisto: number
  /** Aviso de página (role="status", 6 s) quando o teste encerrou mas o YouTube recusou algum campo. */
  onAviso?: (texto: string) => void
}

type Fase = 'escolha' | 'enviando' | 'sem_resposta' | 'sessao_expirada' | 'mudou'
type Pendencia = Array<{ campo: CampoNome; valor_atual: string }>

const ROTULO_CAMPO: Record<string, string> = { title: 'do título', thumbnail: 'da thumbnail' }

export function fraseDoAviso(campos: Array<'title' | 'thumbnail'>): string {
  const partes = (['title', 'thumbnail'] as const).filter(c => campos.includes(c)).map(c => ROTULO_CAMPO[c]!)
  return `Teste encerrado. O YouTube recusou a troca ${partes.join(' e ')}: veja o aviso no topo.`
}

/**
 * Com o cookie de sessão apagado a server action recebe 307 para o login e o Next rejeita a chamada. Só a resposta
 * "redirecionou" vale como sessão expirada; rede caída ou erro de verdade continuam "sem resposta".
 */
export async function sessaoExpirou(): Promise<boolean> {
  try {
    const r = await fetch(window.location.href, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(5000) })
    return r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)
  } catch {
    return false
  }
}

export function hrefDoLogin(): string {
  return `/cms/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

let cancelarFoco: (() => void) | null = null

/** Cancela os temporizadores pendentes de `focarFaixa` (unmount do dono do foco, fim de teste). */
export function cancelarFocoDaFaixa() {
  cancelarFoco?.()
  cancelarFoco = null
}

/** Leva o foco à faixa de restauração assim que ela existir (o refresh traz a faixa do servidor). */
export function focarFaixa(): () => void {
  cancelarFocoDaFaixa()
  const timers = [150, 600, 1500].map(ms => setTimeout(() => {
    const el = document.getElementById('faixa-restauracao')
    if (el && document.activeElement !== el) el.focus()
  }, ms))
  const cancelar = () => { for (const t of timers) clearTimeout(t) }
  cancelarFoco = cancelar
  return cancelar
}

/** `forbidden` cru do servidor vira frase. */
export function textoDoErro(r: { error: string }, verbo: 'encerrar' | 'pausar'): string {
  return r.error === 'forbidden' ? `Você não tem permissão para ${verbo} este teste.` : r.error
}

function Miniatura({ src }: { src: string | null }) {
  const [falhou, setFalhou] = useState(false)
  if (!src || falhou) {
    return (
      <span className="etd-th fail" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3 16l5-5 4 4 3-3 6 6M9 9h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Sem imagem
      </span>
    )
  }
  return (
    <span className="etd-th" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={84} height={47} onError={() => setFalhou(true)} />
    </span>
  )
}

const ICONE_ERRO = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)
const ICONE_AVISO = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L22 20H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4.5M12 17.3v.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)
const ICONE_BUSY = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity=".3" /><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
)
const ICONE_NONE = (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" /><path d="M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)
const ICONE_AR = (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12"><circle cx="12" cy="12" r="3.2" fill="currentColor" /><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)

export function AbEndTestDialog(props: AbEndTestDialogProps) {
  const { aberto, onFechar, noArAgora, opcoes, originalBaixaResolucao, podeDeixarVariante, encerrar, seqVisto, onAviso } = props
  const router = useRouter()
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>('escolha')
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null)
  const [pendencia, setPendencia] = useState<Pendencia | null>(null)
  const voo = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expirou = useRef(false)
  const opener = useRef<HTMLElement | null>(null)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  // Guarda quem abriu: o foco volta a ele ao fechar, mesmo depois de passar pelo diálogo de confirmação.
  useEffect(() => {
    if (!aberto) return
    opener.current = document.activeElement as HTMLElement | null
    return () => {
      if (timer.current) clearTimeout(timer.current)
      const el = opener.current
      if (el && document.body.contains(el)) el.focus()
    }
  }, [aberto])

  const escolhaEfetiva = podeDeixarVariante ? escolhida : (opcoes.find(o => o.isOriginal)?.id ?? null)
  const opcao = opcoes.find(o => o.id === escolhaEfetiva) ?? null

  const enviar = useCallback(async (forcar: boolean) => {
    if (voo.current || !opcao) return
    voo.current = true
    expirou.current = false
    setErro(null)
    setPendencia(null)
    setFase('enviando')
    timer.current = setTimeout(() => { expirou.current = true; setFase('sem_resposta') }, ESPERA_SEM_RESPOSTA_MS)
    const destino: OpcaoEncerrar = opcao.isOriginal
      ? { destino: 'original', seqVisto }
      : forcar ? { destino: 'variante', varianteId: opcao.id, forcar: true, seqVisto } : { destino: 'variante', varianteId: opcao.id, seqVisto }
    let r: ResultadoAcaoSaida
    try {
      r = await encerrar(destino)
    } catch {
      if (timer.current) clearTimeout(timer.current)
      const expirada = await sessaoExpirou()
      voo.current = false
      if (expirou.current) return
      setFase(expirada ? 'sessao_expirada' : 'sem_resposta')
      return
    }
    if (timer.current) clearTimeout(timer.current)
    voo.current = false
    if (expirou.current) return // a tela já disse "sem resposta"; recarregar mostra a verdade
    if (!montado.current && !(r.ok && r.resultado === 'feito') && !(!r.ok && r.resultado === 'ja_encerrado') && !(!r.ok && r.resultado === 'sem_permissao' && r.error === 'unauthenticated')) {
      // O diálogo já fechou: nada mudou no banco, mas o dono acha que encerrou. A página avisa.
      onAviso?.(!r.ok && r.resultado === 'mudou'
        ? 'O teste mudou em outra aba antes de encerrar. Nada foi alterado.'
        : r.ok
        ? 'O teste ainda não foi encerrado: o título ou a thumbnail foi alterado no YouTube por fora. Clique em Encerrar de novo para escolher o que fica no vídeo.'
        : `O teste ainda não foi encerrado: ${textoDoErro(r, 'encerrar')}`)
      router.refresh()
      return
    }
    if (r.ok && r.resultado === 'precisa_confirmar') {
      setFase('escolha')
      setPendencia(r.campos)
      return
    }
    if (r.ok) {
      const recusados = (['title', 'thumbnail'] as const).filter(c => {
        const campo = r.campos[c]
        return campo !== undefined && campo.estado !== 'ok'
      })
      router.refresh()
      onFechar()
      if (recusados.length > 0) {
        onAviso?.(fraseDoAviso(recusados))
        focarFaixa()
      }
      return
    }
    if (r.resultado === 'mudou') { setFase('mudou'); return }
    setFase('escolha')
    if (r.resultado === 'ja_encerrado') { router.refresh(); onFechar(); return }
    if (r.resultado === 'sem_permissao' && r.error === 'unauthenticated') { router.push(hrefDoLogin()); return }
    setErro({ titulo: 'Não foi possível encerrar', texto: textoDoErro(r, 'encerrar') })
  }, [opcao, encerrar, seqVisto, router, onFechar, onAviso])

  if (!aberto) return null

  if (pendencia && opcao) {
    return (
      <AbConfirmarTrocaDialog
        campos={pendencia}
        opcao={opcao}
        onVoltar={() => setPendencia(null)}
        onConfirmar={() => { void enviar(true) }}
      />
    )
  }

  return (
    <Escolha
      {...props}
      escolhida={escolhaEfetiva}
      setEscolhida={setEscolhida}
      fase={fase}
      erro={erro}
      opcao={opcao}
      onEnviar={() => { void enviar(false) }}
      noArAgora={noArAgora}
      opcoes={opcoes}
      originalBaixaResolucao={originalBaixaResolucao}
    />
  )
}

interface EscolhaProps extends AbEndTestDialogProps {
  escolhida: string | null
  setEscolhida: (id: string) => void
  fase: Fase
  erro: { titulo: string; texto: string } | null
  opcao: OpcaoDoDialogo | null
  onEnviar: () => void
}

function Escolha({ onFechar, noArAgora, opcoes, originalBaixaResolucao, podeDeixarVariante, escolhida, setEscolhida, fase, erro, opcao, onEnviar }: EscolhaProps) {
  const ref = useRef<HTMLDivElement>(null)
  useModalFocusTrap(ref, true, onFechar)
  const enviando = fase === 'enviando'
  const semResposta = fase === 'sem_resposta'
  const sessaoExpirada = fase === 'sessao_expirada'
  const mudou = fase === 'mudou'
  const travado = enviando || semResposta || sessaoExpirada || mudou
  const rotuloBotao = enviando ? 'Encerrando…' : opcao ? `Encerrar e ficar com ${opcao.rotulo}` : 'Encerrar'
  const botaoOff = enviando || !opcao
  const desc = noArAgora.desde
    ? <>A rotação para. No ar agora: <b>variante {noArAgora.rotulo}</b>, desde {noArAgora.desde}.</>
    : <>A rotação para. No ar agora: <b>variante {noArAgora.rotulo}</b>.</>

  return (
    <YtPortal>
      <div className="etd-scrim">
        <div className="absolute inset-0" onClick={onFechar} aria-hidden="true" />
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="etd-t" aria-describedby="etd-d" aria-busy={enviando || undefined} className="etd">
          <div className="etd-h">
            <span className="etd-ico" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            </span>
            <h2 id="etd-t">Encerrar teste</h2>
            <button type="button" className="etd-x" aria-label="Fechar" onClick={onFechar}>
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="etd-b">
            <p className="etd-state" id="etd-d">{desc}</p>
            <fieldset disabled={travado}>
              <legend>O que fica no vídeo?</legend>
              {opcoes.map(o => {
                const off = !o.isOriginal && !podeDeixarVariante
                const marcada = escolhida === o.id
                return (
                  <label key={o.id} className={`etd-opt${off || travado ? ' dis' : ''}${marcada ? ' sel' : ''}`}>
                    <input
                      type="radio"
                      name="etd-fica"
                      value={o.id}
                      checked={marcada}
                      disabled={off}
                      aria-label={o.isOriginal ? o.rotulo : `Variante ${o.rotulo}`}
                      onChange={() => setEscolhida(o.id)}
                    />
                    <Miniatura src={o.miniatura} />
                    <span className="etd-body">
                      <span className="etd-who">
                        {o.rotulo}
                        {o.isOriginal && originalBaixaResolucao ? <span className="etd-badge low">{ICONE_NONE}Baixa resolução</span> : null}
                        {o.rotulo === noArAgora.rotulo || o.rotulo === `${noArAgora.rotulo} (original)` ? <span className="etd-badge">{ICONE_AR}no ar agora</span> : null}
                      </span>
                      <span className="etd-ttl" style={{ display: '-webkit-box' }}>{o.titulo ?? ''}</span>
                      {o.isOriginal && originalBaixaResolucao ? <span className="etd-sub">O original foi guardado em baixa resolução.</span> : null}
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {!podeDeixarVariante ? (
              <div className="etd-msg warn">{ICONE_AVISO}<div>Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original.</div></div>
            ) : null}
            {enviando ? (
              <div className="etd-msg busy" role="status">{ICONE_BUSY}<div><strong>Trocando título e thumbnail no YouTube</strong>Pode levar até 1 minuto. Se fechar, o resultado aparece no topo da página.</div></div>
            ) : null}
            {semResposta ? (
              <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Sem resposta</strong>Não sabemos se o encerramento foi feito. Recarregue a página para ver o resultado.</div></div>
            ) : null}
            {sessaoExpirada ? (
              <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Sessão expirada</strong>Sua sessão expirou. Entre de novo para encerrar o teste.</div></div>
            ) : null}
            {mudou ? (
              <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>O teste mudou em outra aba.</strong>Reabra para decidir.</div></div>
            ) : null}
            {erro ? (
              <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>{erro.titulo}</strong>{erro.texto}</div></div>
            ) : null}
          </div>
          <div className="etd-f">
            {sessaoExpirada ? (
              <>
                <a className="etd-btn pri" href={hrefDoLogin()}>Entrar de novo</a>
                <button type="button" className="etd-btn" onClick={onFechar}>Fechar</button>
              </>
            ) : mudou ? (
              <>
                <button type="button" className="etd-btn pri" onClick={() => window.location.reload()}>Recarregar</button>
                <button type="button" className="etd-btn" onClick={onFechar}>Fechar</button>
              </>
            ) : semResposta ? (
              <>
                <button type="button" className="etd-btn pri" onClick={() => window.location.reload()}>Recarregar</button>
                <button type="button" className="etd-btn" onClick={onFechar}>Fechar</button>
              </>
            ) : (
              <>
                <button type="button" className="etd-btn pri" aria-disabled={botaoOff} aria-describedby="etd-hint" onClick={() => { if (!botaoOff) onEnviar() }}>{rotuloBotao}</button>
                <button type="button" className="etd-btn" disabled={enviando} onClick={onFechar}>Cancelar</button>
                {!opcao ? <p className="etd-hint" id="etd-hint">Escolha uma opção.</p> : <span id="etd-hint" hidden />}
              </>
            )}
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
