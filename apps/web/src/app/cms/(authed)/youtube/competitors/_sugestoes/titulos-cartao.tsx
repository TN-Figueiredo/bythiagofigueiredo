'use client'
// F4 T9: a seção "Ideias de título pela forja" do cartão aberto (mockup 2026-10-29-f4-trafego-e-titulos). As ações chegam por prop (nunca importadas):
// sem `pedirTitulos` (quem não administra o site) não há botão, só o que já foi pedido. Título de terceiro nunca entra aqui (só texto React).
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ic } from './icones'
import type { AcoesDaLista } from './tipos'
import {
  fraseDoDescarte, hmSP, TEXTO_AVISO_IDEIAS, TEXTO_FALHOU, TEXTO_LEITURA_FALHOU, TEXTO_NADA_MOSTRADO, TEXTO_PEDIR_DE_NOVO, TEXTO_SEM_CAPACIDADE, TEXTO_SEM_REDE,
  type TitulosDaVista, type VideoDosTitulos,
} from './titulos'
import type { ParDeTitulos } from '@/lib/youtube/observatorio/sinais/titulos-complementares/ler'

const REFRESCA_MS = 20_000
const ETAPAS = ['Na fila', 'Escrevendo', 'Pronta'] as const
const ATIVOS: ReadonlySet<string> = new Set(['fila', 'gerando', 'parada'])

type Erro = { tipo: 'rede' } | { tipo: 'texto'; texto: string }
/** Resposta local depois de pedir/cancelar: vale só enquanto o servidor ainda mostra o mesmo que mostrava (`base`). */
interface Local { base: string; par: ParDeTitulos | null }

const chaveDoPar = (p: ParDeTitulos | null): string => (p === null ? '-' : JSON.stringify(p))

function Etapas(p: { atual: 0 | 1; atrasada: boolean }) {
  return (
    <ol className="sg-steps" aria-label="Etapas do pedido">
      {ETAPAS.map((nome, i) => {
        const cls = i < p.atual ? 'done' : i === p.atual ? (p.atrasada ? 'late' : 'now') : ''
        const ss = i === p.atual ? (p.atrasada ? 'esperando a forja' : 'em andamento') : ''
        return (
          <li key={nome} className={cls} aria-current={i === p.atual ? 'step' : undefined}>
            <span className="dot">{i < p.atual ? Ic.ok(16) : null}</span><span>{nome}</span>{ss && <span className="ss">{ss}</span>}
          </li>
        )
      })}
    </ol>
  )
}

function Faixa(p: { tom: 'err' | 'warn'; titulo: string; texto?: string }) {
  return (
    <div className={`sg-band sg-${p.tom}`} role={p.tom === 'err' ? 'alert' : 'status'}>
      <span className="sg-ic">{Ic.warn()}</span>
      <div><h3>{p.titulo}</h3>{p.texto && <p>{p.texto}</p>}</div>
    </div>
  )
}

function Ideia(p: { texto: string; n: number }) {
  const ref = useRef<HTMLParagraphElement | null>(null)
  const [estado, setEstado] = useState<'' | 'copiado' | 'selecionado'>('')
  async function copiar() {
    try {
      await navigator.clipboard.writeText(p.texto)
      setEstado('copiado')
    } catch {
      // sem permissão de área de transferência: seleciona o texto para a pessoa copiar (Ctrl+C)
      const el = ref.current
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r) }
      setEstado('selecionado')
    }
  }
  return (
    <li className="sg-ti">
      <p ref={ref}>{p.texto}</p>
      <span className="sg-n">{`${[...p.texto].length}/100`}</span>
      <button type="button" className="sg-btn" aria-label={`Copiar título ${p.n}`} onClick={() => void copiar()}>{estado === 'copiado' ? 'Copiado' : estado === 'selecionado' ? 'Selecionado' : 'Copiar'}</button>
      {estado === 'selecionado' && <span className="sg-fb" role="status">Selecionado: use Ctrl+C.</span>}
    </li>
  )
}

export function TitulosDoCartao(p: { titulos: TitulosDaVista; acoes: Pick<AcoesDaLista, 'pedirTitulos' | 'cancelarTitulos'> | null }) {
  const { titulos: t } = p
  const pedir = p.acoes?.pedirTitulos
  const cancelar = p.acoes?.cancelarTitulos
  const router = useRouter()
  const uid = useId()
  const inicial = t.videos.find((v) => v.par !== null && ATIVOS.has(v.par.estado)) ?? t.videos[0]!
  const [selId, setSelId] = useState(inicial.id)
  const sel: VideoDosTitulos = t.videos.find((v) => v.id === selId) ?? inicial
  const [locais, setLocais] = useState<ReadonlyMap<string, Local>>(new Map())
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<Erro | null>(null)
  const [escolhendo, setEscolhendo] = useState(false)

  const local = locais.get(sel.id)
  const par: ParDeTitulos | null = local && local.base === chaveDoPar(sel.par) ? local.par : sel.par
  const estado = par?.estado ?? null
  const ativo = estado !== null && ATIVOS.has(estado)
  const marcar = (id: string, base: ParDeTitulos | null, novo: ParDeTitulos | null) => setLocais((m) => new Map(m).set(id, { base: chaveDoPar(base), par: novo }))

  // Enquanto algo espera ou escreve, a tela se atualiza sozinha (a forja passa a cada 10 min); sem isso o "Na fila" nunca mudaria.
  useEffect(() => {
    if (!ativo) return
    const id = setInterval(() => router.refresh(), REFRESCA_MS)
    return () => clearInterval(id)
  }, [ativo, router])

  async function pedirAgora() {
    if (enviando || !pedir || !t.sabePedir) return
    setEnviando(true); setErro(null)
    try {
      const r = await pedir(sel.id, t.sinalId)
      if (r.ok) {
        marcar(sel.id, sel.par, { own_video_id: sel.id, estado: 'fila', pedido_em: new Date().toISOString() })
        setEscolhendo(false)
        router.refresh()
      } else if (r.motivo === 'recusado') setErro({ tipo: 'texto', texto: r.texto })
      else if (r.motivo === 'sem_permissao') setErro({ tipo: 'texto', texto: 'Só quem administra o site pode pedir títulos.' })
      else setErro({ tipo: 'texto', texto: 'Não deu para enviar o pedido agora. Nada foi guardado.' })
    } catch { setErro({ tipo: 'rede' }) } finally { setEnviando(false) }
  }
  async function cancelarAgora() {
    if (enviando || !cancelar) return
    setEnviando(true); setErro(null)
    try {
      const r = await cancelar(sel.id, t.sinalId)
      if (r.ok) { marcar(sel.id, sel.par, null); router.refresh() }
      else if (r.motivo === 'recusado') setErro({ tipo: 'texto', texto: r.texto })
      else setErro({ tipo: 'rede' })
    } catch { setErro({ tipo: 'rede' }) } finally { setEnviando(false) }
  }

  const titId = `${uid}-tit`
  const h5 = (txt: string) => <h5 id={titId} tabIndex={-1}>{txt}</h5>
  const envolver = (filhos: React.ReactNode) => <section className="sg-tit" aria-labelledby={titId} data-tit={t.sinalId}>{filhos}</section>

  if (t.leitura === 'erro') {
    return envolver(<>{h5('Ideias de título pela forja')}<p className="sg-errl" role="alert">{Ic.warn()}<span>{TEXTO_LEITURA_FALHOU}</span></p></>)
  }

  // pronto: a lista de até 5 com "copiar" e o aviso "ideias, não cópia"
  if (par && par.estado === 'pronto' && !escolhendo) {
    const n = par.titulos.length
    return envolver(
      <>
        {h5(`${n} ${n === 1 ? 'ideia' : 'ideias'} de título para “${sel.titulo}”`)}
        <p className="sg-hint">{TEXTO_AVISO_IDEIAS}</p>
        <ol className="sg-ol-list">{par.titulos.map((x, i) => <Ideia key={`${i}-${x}`} texto={x} n={i + 1} />)}</ol>
        {(pedir || t.videos.length > 1) && (
          <div className="sg-acts">
            {pedir && <button type="button" className="sg-lnk" disabled={enviando || !t.sabePedir} onClick={() => void pedirAgora()}>Pedir de novo</button>}
            {t.videos.length > 1 && <button type="button" className="sg-lnk" onClick={() => setEscolhendo(true)}>Pedir para outro vídeo</button>}
          </div>
        )}
        {erro && <p className="sg-errl" role="alert">{Ic.warn()}<span>{erro.tipo === 'rede' ? TEXTO_SEM_REDE : erro.texto}</span></p>}
      </>,
    )
  }

  // na fila, escrevendo, forja parada
  if (par && (par.estado === 'fila' || par.estado === 'gerando' || par.estado === 'parada')) {
    const hm = hmSP(par.pedido_em) ?? ''
    return envolver(
      <>
        {h5('Ideias de título pela forja')}
        <Etapas atual={par.estado === 'gerando' ? 1 : 0} atrasada={par.estado === 'parada'} />
        <p className="sg-who">{`para “${sel.titulo}”`}</p>
        {par.estado === 'fila' && <p className="sg-hint" role="status" aria-live="polite">{`Pedido às ${hm}. A forja passa a cada 10 minutos; pode sair da página.`}</p>}
        {par.estado === 'gerando' && <p className="sg-hint" role="status" aria-live="polite">A forja está escrevendo os títulos. Pode sair da página: o pedido continua.</p>}
        {par.estado === 'parada' && (
          <Faixa tom="warn" titulo={`Pedido guardado às ${hm}. A forja está parada${hmSP(par.parada_desde) ? ` desde ${hmSP(par.parada_desde)}` : ''}; o pedido sai quando ela voltar.`} />
        )}
        {erro && <p className="sg-errl" role="alert">{Ic.warn()}<span>{erro.tipo === 'rede' ? TEXTO_SEM_REDE : erro.texto}</span></p>}
        {cancelar && par.estado !== 'gerando' && <div className="sg-acts"><button type="button" className="sg-lnk" disabled={enviando} onClick={() => void cancelarAgora()}>Cancelar pedido</button></div>}
      </>,
    )
  }

  // ocioso, recusado, falhou, sem a capacidade: o botão (se a pessoa administra) e o motivo de qualquer coisa que deu errado
  if (!pedir && !(par && (par.estado === 'recusado' || par.estado === 'falhou'))) return null
  const multi = t.videos.length > 1
  const semCap = !t.sabePedir
  const rotulo = par && (par.estado === 'recusado') ? 'Pedir de novo' : erro ? 'Tentar de novo' : 'Pedir 5 títulos à forja'
  const descarte = par && par.estado === 'recusado' ? fraseDoDescarte(par.motivo) : null
  return envolver(
    <>
      {h5('Ideias de título pela forja')}
      {multi && (
        <>
          <p className="sg-hint">{`Pedir títulos para um vídeo seu. Seus vídeos ${t.lugar ? `sobre ${t.lugar}` : 'parecidos'}${t.total > t.videos.length ? ` (${t.videos.length} de ${t.total})` : ''}:`}</p>
          <ul className="sg-vids" role="radiogroup" aria-label="Vídeo seu">
            {t.videos.map((v) => (
              <li key={v.id}><label><input type="radio" name={`${uid}-v`} checked={v.id === sel.id} onChange={() => { setSelId(v.id); setErro(null); setEscolhendo(false) }} /><span>{v.titulo}</span></label></li>
            ))}
          </ul>
        </>
      )}
      {descarte && <Faixa tom="err" titulo={descarte.titulo} texto={descarte.resto} />}
      {par && par.estado === 'falhou' && <Faixa tom="err" titulo={TEXTO_FALHOU} texto={`${TEXTO_NADA_MOSTRADO} ${TEXTO_PEDIR_DE_NOVO}`} />}
      {erro && <p className="sg-errl" role="alert">{Ic.warn()}<span>{erro.tipo === 'rede' ? <><b>Não deu para enviar o pedido:</b> a conexão caiu. Nada foi guardado.</> : erro.texto}</span></p>}
      {pedir && (
        <div className="sg-acts">
          <button
            type="button" className="sg-btn sg-ol sg-big" data-pedir={t.sinalId}
            aria-disabled={semCap || enviando ? true : undefined} aria-describedby={semCap ? `${uid}-sc` : undefined}
            onClick={() => void pedirAgora()}
          >{enviando ? 'Enviando…' : rotulo}</button>
        </div>
      )}
      {!multi && <p className="sg-who">{`para “${sel.titulo}”`}</p>}
      {pedir && semCap && <p className="sg-hint" id={`${uid}-sc`}>{TEXTO_SEM_CAPACIDADE}</p>}
    </>,
  )
}
