'use client'
// "Vídeos do canal" (M7 T10): lista recolhida com busca no servidor, filtro Testáveis/Todos e páginas de 20.
// A leitura chega por props (`ler` = lerVideosDoCanal); nenhum client importa ../actions-nativo.
// Respostas fora de ordem são descartadas por NÚMERO de pedido (server action não aceita AbortController).
import { useCallback, useContext, useEffect, useRef, useState, type ReactElement } from 'react'
import type { z } from 'zod'
import type { PaginaDoCanal, PedidoVideosDoCanalSchema } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { pisoPorDia } from '@/lib/youtube/teste-youtube/nativo/volume'
import type { ResultadoVideosDoCanal } from '../../actions-nativo'
import type { AcoesCaminho } from '../caminho-nativo/lista-caminho'
import { ContextoAssistente } from '../caminho-nativo/assistente-contexto'
import { ListaCaminhoComPaineis } from '../caminho-nativo/lista-caminho-paineis'
import './pagina-lab.css'

type Pedido = z.infer<typeof PedidoVideosDoCanalSchema>

export interface VideosDoCanalProps {
  inicial: PaginaDoCanal
  videoInicial: string | null
  acoes: AcoesCaminho
  ler: (p: Pedido) => Promise<ResultadoVideosDoCanal>
}

const ESPERA_MS = 350
const MIN_LETRAS = 2
const POR_ANEXO = 20

type Filtro = 'testaveis' | 'todos'
type Carga = 'ok' | 'carregando' | 'mais' | 'erro'

const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios)

function VazioDoFiltro({ motivo, aoTentar }: { motivo: PaginaDoCanal['contagem']['motivoNaoLido']; aoTentar: () => void }): ReactElement {
  if (motivo === 'sem_leitura') return <p className="m-0 text-sm text-cms-text-muted">O volume dos vídeos não pôde ser lido (sem acesso ao Analytics do canal). Escolha “Todos” para ver os vídeos.</p>
  if (motivo === 'falha') {
    return (
      <p className="m-0 text-sm text-cms-text-muted">
        Não deu para ler o volume agora.{' '}
        <button type="button" className="lab-btn txt lab-alvo" onClick={aoTentar}>Tentar de novo</button>
      </p>
    )
  }
  if (motivo === 'poucos_dias') return <p className="m-0 text-sm text-cms-text-muted">O volume ainda está sendo lido (menos de 3 dias de relatório). Escolha “Todos”.</p>
  return <p className="m-0 text-sm text-cms-text-muted">Nenhum vídeo com volume para testar agora. Escolha “Todos” para ver os vídeos.</p>
}

export function VideosDoCanal({ inicial, videoInicial, acoes, ler }: VideosDoCanalProps): ReactElement {
  const [visto, setVisto] = useState(inicial)
  const [pag, setPag] = useState(inicial)
  const [linhas, setLinhas] = useState<LinhaDoCaminho[]>(inicial.linhas)
  const [filtro, setFiltro] = useState<Filtro>(inicial.filtroEfetivo)
  const [busca, setBusca] = useState('')
  const [carga, setCarga] = useState<Carga>('ok')
  const [aberto, setAberto] = useState(videoInicial !== null)
  const [pagina, setPagina] = useState(0)
  const seq = useRef(0)
  const aplicada = useRef<string | null>(null)
  const filtroRef = useRef<Filtro>(inicial.filtroEfetivo)
  const ultimo = useRef<{ pedido: Pedido; anexar: boolean } | null>(null)
  const primeiraBusca = useRef(true)

  // Depois de router.refresh() o servidor manda `inicial` novo: o anexo e a busca velhos somem (a linha mostra o estado novo).
  if (visto !== inicial) {
    setVisto(inicial); setPag(inicial); setLinhas(inicial.linhas); setFiltro(inicial.filtroEfetivo); setBusca(''); setPagina(0); setCarga('ok')
    seq.current += 1; aplicada.current = null; filtroRef.current = inicial.filtroEfetivo; ultimo.current = null
  }

  const pedir = useCallback(async (pedido: Pedido, anexar: boolean): Promise<void> => {
    const n = ++seq.current
    ultimo.current = { pedido, anexar }
    setCarga(anexar ? 'mais' : 'carregando')
    let r: ResultadoVideosDoCanal
    try { r = await ler(pedido) } catch { r = { ok: false, erro: 'falha' } }
    if (n !== seq.current) return // chegou depois de um pedido mais novo
    if (!r.ok) { setCarga('erro'); return }
    setPag(r.pagina)
    setPagina(pedido.pagina)
    setLinhas(antes => {
      if (!anexar) return r.pagina.linhas
      const mapa = new Map<string, LinhaDoCaminho>(antes.map(l => [l.videoId, l]))
      for (const l of r.pagina.linhas) mapa.set(l.videoId, l)
      return [...mapa.values()]
    })
    setCarga('ok')
  }, [ler])

  const pedidoBase = (o: Partial<Pedido>): Pedido => ({
    busca: aplicada.current, filtro: filtroRef.current, pagina: 0,
    incluirYtId: aplicada.current === null ? videoInicial : null, ...o,
  })

  // Busca: 350 ms depois da última tecla; menos de 2 letras = sem busca (e, se havia termo, volta ao normal com `busca: null`).
  useEffect(() => {
    if (primeiraBusca.current) { primeiraBusca.current = false; return }
    const t = busca.trim()
    const termo = t.length >= MIN_LETRAS ? t : null
    if (termo === aplicada.current) return
    seq.current += 1 // o que estiver em voo já é velho
    const id = setTimeout(() => {
      aplicada.current = termo
      void pedir(pedidoBase({ busca: termo }), false)
    }, ESPERA_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  // `?videos=1` mantém a lista aberta ao recarregar (como o mockup).
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get('videos') === '1') setAberto(true) } catch { /* sem URL */ } }, [])
  function aoAbrir(abrir: boolean): void {
    setAberto(abrir)
    try {
      const u = new URL(window.location.href)
      if (abrir) u.searchParams.set('videos', '1'); else u.searchParams.delete('videos')
      window.history.replaceState(null, '', u.toString())
    } catch { /* sem URL */ }
  }

  function trocarFiltro(f: Filtro): void {
    if (f === filtro) return
    filtroRef.current = f
    setFiltro(f)
    void pedir(pedidoBase({ filtro: f }), false)
  }
  // Guarda D-8: a pergunta mora na linha do vídeo. Se a busca/filtro a tirou da tela, a linha da 1ª página volta (e a lista abre).
  const perguntaDe = useContext(ContextoAssistente).perguntaAberta
  const daPergunta = perguntaDe !== null && !linhas.some(l => l.videoId === perguntaDe) ? inicial.linhas.find(l => l.videoId === perguntaDe) : undefined
  useEffect(() => { if (perguntaDe !== null) setAberto(true) }, [perguntaDe])
  const mostradas = daPergunta ? [...linhas, daPergunta] : linhas
  const c = pag.contagem
  const resto = Math.max(0, pag.totalDoFiltro - linhas.length)
  const termoAtivo = aplicada.current
  const semLinhas = mostradas.length === 0 && carga === 'ok'
  const resumo = `${c.testaveis} com volume para testar, ${c.semVolume} sem${c.naoLido > 0 ? `, ${c.naoLido} sem volume lido` : ''}${pag.truncado ? ' (dos 2.000 mais recentes)' : ''}`
  const piso = pisoPorDia(2)

  const esqueleto = (
    <div aria-hidden="true" data-testid="videos-esqueleto">
      {[0, 1, 2].map(i => <div key={i} className="lab-esq-linha" style={{ height: 72, margin: '8px 0', borderRadius: 8, background: '#272219' }} />)}
    </div>
  )

  return (
    <details className="lab-pg mt-9" open={aberto} onToggle={e => { const a = (e.currentTarget as HTMLDetailsElement).open; if (a !== aberto) aoAbrir(a) }} data-testid="videos-do-canal">
      <summary className="lab-alvo cursor-pointer list-none">
        <span className="text-[18px] font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>Vídeos do canal</span>
        <span className="ml-3 text-sm text-cms-text-muted">{resumo}</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título" aria-label="Buscar vídeo"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-cms-border bg-cms-surface px-3 text-sm"
        />
        <div role="group" aria-label="Filtro" className="flex gap-2">
          {(['testaveis', 'todos'] as const).map(f => (
            <button key={f} type="button" className="lab-btn lab-alvo" aria-pressed={filtro === f} onClick={() => trocarFiltro(f)}>{f === 'testaveis' ? 'Testáveis' : 'Todos'}</button>
          ))}
        </div>
      </div>
      {pag.truncado ? <p className="mb-0 mt-2 text-xs text-cms-text-muted">A busca procura só nos 2.000 vídeos mais recentes.</p> : null}
      <div className="mt-3" aria-busy={carga === 'carregando' || carga === 'mais' ? 'true' : undefined}>
        {carga === 'erro' ? (
          <p className="m-0 text-sm" role="alert">
            Não deu para ler os vídeos.{' '}
            <button type="button" className="lab-btn txt lab-alvo" onClick={() => { const u = ultimo.current; if (u) void pedir(u.pedido, u.anexar) }}>Tentar de novo</button>
          </p>
        ) : carga === 'carregando' ? esqueleto : semLinhas ? (
          termoAtivo
            ? (
              <p className="m-0 text-sm text-cms-text-muted">
                Nenhum vídeo com “{termoAtivo}”.{' '}
                <button type="button" className="lab-btn txt lab-alvo" onClick={() => setBusca('')}>Limpar busca</button>
              </p>
            )
            : filtro === 'testaveis'
              ? <VazioDoFiltro motivo={c.motivoNaoLido} aoTentar={() => { void pedir(pedidoBase({ pagina: 0 }), false) }} />
              : <p className="m-0 text-sm text-cms-text-muted">Nenhum vídeo no canal.</p>
        ) : (
          <>
            <ListaCaminhoComPaineis linhas={mostradas} videoInicial={videoInicial} acoes={acoes} agrupar={false} />
            {carga === 'mais' ? esqueleto : null}
          </>
        )}
      </div>
      {filtro === 'testaveis' && !termoAtivo && c.semVolume > 0 && linhas.length > 0 ? (
        <p className="mb-0 mt-3 text-sm text-cms-text-muted">{c.semVolume} {plural(c.semVolume, 'vídeo', 'vídeos')} com poucas impressões por dia (menos de {piso}). Escolha “Todos” para ver.</p>
      ) : null}
      {linhas.length > 0 && carga !== 'erro' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-cms-text-muted tabular-nums">Mostrando {linhas.length} de {pag.totalDoFiltro}{filtro === 'testaveis' ? ' testáveis' : ' vídeos'}</span>
          {pag.temMais && resto > 0 ? (
            <button type="button" className="lab-btn lab-alvo" disabled={carga === 'mais'} onClick={() => { void pedir(pedidoBase({ pagina: pagina + 1 }), true) }}>
              {resto > POR_ANEXO ? `Mostrar mais ${POR_ANEXO}` : `Mostrar os ${resto} restantes`}
            </button>
          ) : null}
        </div>
      ) : null}
    </details>
  )
}
