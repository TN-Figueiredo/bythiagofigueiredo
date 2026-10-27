// A5, X3: a visita de UM canal (seções, lista de playlists, itens das playlists devidas), com teto de unidades, relógio e estado honesto.
// Nada aqui lança: o que falha vira motivo do catálogo. Texto de fora (API, banco) nunca entra no resultado.
import { BANCO_MS, comPrazo } from '@/lib/youtube/agenda/relogio'
import { ehForma, erroDaApi, lerPaginaDeItens, lerPaginaDePlaylists, lerSecoes, type ItemLido, type PlaylistLida } from './ler-api'
import { ErroX3, type EstadoDoCanal, type OpsX3, type PlaylistConhecida } from './gravar'
import { calcularCiclo, playlistCoberta, playlistsDevidas } from './planejar'
import { X3_RULES } from './regras'

const API = 'https://www.googleapis.com/youtube/v3'

/** Do mais grave ao menos grave: o motivo da visita (e da tarefa) é o primeiro desta lista que apareceu. */
export const PRIORIDADE_DE_MOTIVOS: readonly string[] = [
  'cota_esgotada', 'canal_pausado', 'gravacao_falhou', 'lista_cortada', 'api_falhou', 'resposta_invalida', 'contagem_difere', 'teto_por_canal',
  'itens_cortados', 'playlist_sumiu_no_meio', 'itens_incoerentes', 'teto_itens', 'saida_em_massa_a_confirmar', 'lista_vazia_a_confirmar',
  'secoes_vazias_a_confirmar', 'lista_com_ocultas', 'teto_do_dia', 'sobrou',
]
export const maisGrave = (motivos: readonly string[]): string | null => PRIORIDADE_DE_MOTIVOS.find(m => motivos.includes(m)) ?? null

export interface EntradaDaVisita {
  siteId: string
  channelId: string
  /** O id do canal no YouTube (UC…). */
  youtubeChannelId: string
  apiKey: string
  ops: OpsX3
  fetchImpl: typeof fetch
  agora: () => number
  t0: number
  /** Estado do canal lido no começo do disparo. */
  estado: EstadoDoCanal
  unidadesPorVisita?: number
}

export interface ResultadoDaVisita {
  /** Falso quando o relógio barrou a 1ª chamada: a visita não começou, nada foi gravado nem fechado. */
  iniciada: boolean
  estado: 'ok' | 'parcial' | 'erro'
  motivo: string | null
  unidades: number
  playlistsLeft: number | null
  cotaEsgotada: boolean
  tetoPorCanal: boolean
  /** Unidades cuja cota não pôde ser registrada (estouro ou erro). */
  cotaNaoRegistrada: number
  numeros: Record<string, number>
}

type Resposta = { tipo: 'ok'; json: unknown } | { tipo: 'cota' | 'playlist_sumiu' | 'api' | 'forma' }

export async function visitarCanal(e: EntradaDaVisita): Promise<ResultadoDaVisita> {
  const teto = e.unidadesPorVisita ?? X3_RULES.unidadesPorVisita
  const relogio = (): number => e.agora() - e.t0
  let u = 0
  let cotaEsgotada = false
  let tetoPorCanal = false
  const motivos: string[] = []
  const motivo = (m: string): void => { if (!motivos.includes(m)) motivos.push(m) }
  const numeros = { playlists_lidas: 0, playlists_com_itens: 0, itens_gravados: 0, itens_saidos: 0, playlists_sumidas: 0, playlists_ocultas: 0 }

  const bloqueio = (): 'cota' | 'teto' | 'tempo' | null => {
    if (cotaEsgotada) return 'cota'
    if (u >= teto) return 'teto'
    if (relogio() >= X3_RULES.chamadaComecaAteMs) return 'tempo'
    return null
  }

  if (relogio() >= X3_RULES.chamadaComecaAteMs) {
    return { iniciada: false, estado: 'parcial', motivo: 'sobrou', unidades: 0, playlistsLeft: 0, cotaEsgotada: false, tetoPorCanal: false, cotaNaoRegistrada: 0, numeros }
  }

  async function chamar(recurso: string, params: Record<string, string>): Promise<Resposta> {
    u++
    const q = new URLSearchParams({ ...params, key: e.apiKey })
    let res: Response
    try {
      res = await e.fetchImpl(`${API}/${recurso}?${q.toString()}`, { signal: AbortSignal.timeout(X3_RULES.chamadaMs) })
    } catch {
      return { tipo: 'api' }
    }
    let json: unknown = null
    try { json = await res.json() } catch { json = null }
    if (!res.ok) return { tipo: erroDaApi(res.status, json) }
    return json === null ? { tipo: 'forma' } : { tipo: 'ok', json }
  }

  let leituraBoa = false
  let listaCompleta = false
  let listaComOcultas = false
  let listTotal: number | null = null
  let listRead: number | null = null
  let listaVazia: boolean | null = null
  let listaFechada = false
  let secoesVazias: boolean | null = null
  let canalPausado = false
  let gravacaoFalhou = false
  /** Nulo = não medido (a etapa de itens não rodou); 0 só quando medido (Phil M-5). */
  let left: number | null = null
  let devidasN = 0
  let visitadas = 0
  /** Estado final gravado de cada playlist lida NESTA visita (chave = id interno). */
  const lidasAgora = new Map<string, { status: 'ok' | 'parcial' | 'erro'; reason: string | null }>()

  /** Uma ida de gravação: `ErroX3` aborta a visita (canal pausado ou gravação falhou); outro erro vira `gravacao_falhou`. */
  async function gravar<T>(f: () => Promise<T>): Promise<T | undefined> {
    try { return await f() } catch (err) {
      if (err instanceof ErroX3 && err.codigo === 'canal_pausado') { canalPausado = true; motivo('canal_pausado') } else { gravacaoFalhou = true; motivo('gravacao_falhou') }
      return undefined
    }
  }
  const abortou = (): boolean => canalPausado || gravacaoFalhou

  // 1. Seções
  const sec = await chamar('channelSections', { part: 'snippet,contentDetails', channelId: e.youtubeChannelId })
  if (sec.tipo === 'ok') {
    const lida = lerSecoes(sec.json)
    if (ehForma(lida)) motivo('resposta_invalida')
    else {
      leituraBoa = true
      if (lida.itens.length === 0 && e.estado.ultima_secao_vazia === false && e.estado.sections_empty_streak < 1) {
        secoesVazias = true
        motivo('secoes_vazias_a_confirmar')
      } else {
        const r = await gravar(() => e.ops.sectionsRecord({ siteId: e.siteId, channelId: e.channelId, nowMs: e.agora(), sha: lida.sha, raw: lida.raw }))
        if (r !== undefined) secoesVazias = false
      }
    }
  } else if (sec.tipo === 'cota') { cotaEsgotada = true; motivo('cota_esgotada') } else motivo(sec.tipo === 'forma' ? 'resposta_invalida' : 'api_falhou')

  // 2. A lista de playlists
  let lidas: PlaylistLida[] = []
  let candidatas: PlaylistConhecida[] = []
  let listaLida = false
  if (!abortou() && !cotaEsgotada) {
    let proxima: string | null = null
    let excluidas = 0
    let total: number | null = null
    let acabou = false
    for (;;) {
      const b = bloqueio()
      if (b !== null) { if (b === 'teto') { tetoPorCanal = true; motivo('teto_por_canal') } else motivo('lista_cortada'); break }
      const r = await chamar('playlists', { part: 'snippet,contentDetails,status,localizations', channelId: e.youtubeChannelId, maxResults: '50', ...(proxima ? { pageToken: proxima } : {}) })
      if (r.tipo === 'cota') { cotaEsgotada = true; motivo('cota_esgotada'); motivo('lista_cortada'); break }
      if (r.tipo !== 'ok') { motivo(lidas.length === 0 ? (r.tipo === 'forma' ? 'resposta_invalida' : 'api_falhou') : 'lista_cortada'); break }
      const pg = lerPaginaDePlaylists(r.json)
      if (ehForma(pg)) { motivo(lidas.length === 0 ? 'resposta_invalida' : 'lista_cortada'); break }
      leituraBoa = true
      lidas = lidas.concat(pg.itens)
      excluidas += pg.excluidas
      total = pg.total
      proxima = pg.proxima
      if (proxima === null) { acabou = true; break }
    }
    listaLida = acabou
    if (acabou) {
      listTotal = total
      listRead = lidas.length + excluidas
      if (total !== null && total === lidas.length + excluidas) listaCompleta = true
      else if (total !== null && total > lidas.length + excluidas) {
        // o YouTube conta playlists que a chave não vê (privadas): a volta fecha, a saída espera duas leituras
        listaComOcultas = true
        motivo('lista_com_ocultas')
        numeros.playlists_ocultas = total - lidas.length - excluidas
      } else motivo('contagem_difere')
    }
    numeros.playlists_lidas = lidas.length
    listaFechada = listaCompleta || listaComOcultas

    const conhecidas = new Map(e.estado.playlists.map(p => [p.playlist_id, p]))
    const vistas = new Set(lidas.map(l => l.playlist_id))
    if (listaComOcultas && lidas.length === 0) {
      // só ocultas: nada visível a gravar, mas as conhecidas ganham a ausência (a função SQL trata `ocultas`)
      const r = await gravar(() => e.ops.playlistsRecord({ siteId: e.siteId, channelId: e.channelId, nowMs: e.agora(), rows: [], complete: false, ocultas: true }))
      if (r?.atrasada) { gravacaoFalhou = true; motivo('gravacao_falhou') }
    } else if (listaCompleta && lidas.length === 0) {
      if (e.estado.empty_streak < 1) { listaVazia = true; motivo('lista_vazia_a_confirmar') } else {
        const r = await gravar(() => e.ops.playlistsRecord({ siteId: e.siteId, channelId: e.channelId, nowMs: e.agora(), rows: [], complete: true, ocultas: false }))
        if (r !== undefined) { listaVazia = true; if (r.atrasada) { gravacaoFalhou = true; motivo('gravacao_falhou') } }
      }
    } else if (lidas.length > 0) {
      const r = await gravar(() => e.ops.playlistsRecord({ siteId: e.siteId, channelId: e.channelId, nowMs: e.agora(), rows: lidas, complete: listaCompleta, ocultas: listaComOcultas }))
      if (r !== undefined) {
        if (r.atrasada) { gravacaoFalhou = true; motivo('gravacao_falhou') } else {
          if (listaCompleta) listaVazia = false
          for (const l of lidas) {
            const id = r.ids.get(l.playlist_id)
            if (id === undefined) continue
            const prev = conhecidas.get(l.playlist_id)
            candidatas.push({ id, playlist_id: l.playlist_id, items_read_at: prev?.items_read_at ?? null, items_status: prev?.items_status ?? null, items_reason: prev?.items_reason ?? null, missing_since: null, item_count: l.item_count })
          }
        }
      }
      if (!listaFechada) for (const p of e.estado.playlists) if (p.missing_since === null && !vistas.has(p.playlist_id)) candidatas.push(p)
    } else if (!listaLida && lidas.length === 0 && leituraBoa) {
      // lista que nem a 1ª página trouxe: nada novo; as já conhecidas seguem candidatas aos itens
      candidatas = e.estado.playlists.filter(p => p.missing_since === null)
    }
  }

  // 3. Os itens das playlists devidas
  if (!abortou() && !cotaEsgotada && candidatas.length > 0) {
    const devidas = playlistsDevidas(candidatas, e.agora())
    devidasN = devidas.length
    for (const p of devidas) {
      const b = bloqueio()
      if (b !== null) { if (b === 'teto') { tetoPorCanal = true; motivo('teto_por_canal') } else if (b === 'tempo') motivo('sobrou'); break }
      await lerItens(p)
      visitadas++
      if (abortou()) break
    }
    left = devidasN - visitadas
  } else if (listaFechada && candidatas.length === 0) left = 0

  async function lerItens(p: PlaylistConhecida): Promise<void> {
    const rows: ItemLido[] = []
    let lidos = 0
    let total: number | null = null
    let proxima: string | null = null
    let paginas = 0
    let fim = false
    let corte: string | null = null
    let sumiu = false
    let formaInvalida = false
    for (;;) {
      if (proxima !== null && paginas >= X3_RULES.paginasDeItensPorPlaylist) { corte = 'teto_itens'; break }
      const b = bloqueio()
      if (b !== null) { if (b === 'teto') { corte = 'teto_por_canal'; tetoPorCanal = true } else corte = 'itens_cortados'; break }
      const r = await chamar('playlistItems', { part: 'snippet,contentDetails,status', playlistId: p.playlist_id, maxResults: '50', ...(proxima ? { pageToken: proxima } : {}) })
      if (r.tipo === 'cota') { cotaEsgotada = true; motivo('cota_esgotada'); corte = 'itens_cortados'; break }
      if (r.tipo === 'playlist_sumiu') { sumiu = true; break }
      if (r.tipo === 'api') { corte = 'itens_cortados'; break }
      const pg = r.tipo === 'ok' ? lerPaginaDeItens(r.json) : null
      if (pg === null || ehForma(pg)) { if (paginas === 0) formaInvalida = true; else corte = 'itens_cortados'; break }
      paginas++
      rows.push(...pg.itens)
      lidos += pg.lidos
      total = pg.total
      proxima = pg.proxima
      if (proxima === null) { fim = true; break }
    }
    const reg = async (linhas: ItemLido[], complete: boolean, status: 'ok' | 'parcial' | 'erro', reason: string | null) => {
      const r = await gravar(() => e.ops.itemsRecord({ siteId: e.siteId, channelId: e.channelId, playlistRef: p.id, nowMs: e.agora(), rows: linhas, complete, status, reason }))
      if (r === undefined) return undefined
      if (r.atrasada) { gravacaoFalhou = true; motivo('gravacao_falhou'); return undefined }
      numeros.playlists_com_itens++
      numeros.itens_gravados += r.gravados
      numeros.itens_saidos += r.saidos
      lidasAgora.set(p.id, r.massa ? { status: 'parcial', reason: 'saida_em_massa_a_confirmar' } : { status, reason })
      return r
    }
    if (sumiu) { numeros.playlists_sumidas++; motivo('playlist_sumiu_no_meio'); await reg([], false, 'erro', 'playlist_sumiu_no_meio'); return }
    if (formaInvalida) { motivo('resposta_invalida'); await reg([], false, 'erro', 'resposta_invalida'); return }
    if (fim) {
      leituraBoa = true
      if (lidos === 0) {
        const incoerente = (p.item_count !== null && p.item_count > 0)
          || (p.item_count === null && await gravar(() => e.ops.itensPresentes(p.id)).then(n => (n ?? 0) > 0))
        if (abortou()) return
        if (incoerente) { motivo('itens_incoerentes'); await reg([], false, 'parcial', 'itens_incoerentes'); return }
        if (total === 0) { await reg([], true, 'ok', null); return }
        motivo('contagem_difere'); await reg([], false, 'parcial', 'contagem_difere'); return
      }
      if (total !== null && total === lidos) {
        const r = await reg(rows, true, 'ok', null)
        if (r?.massa) motivo('saida_em_massa_a_confirmar')
        return
      }
      motivo('contagem_difere'); await reg(rows, false, 'parcial', 'contagem_difere'); return
    }
    const razao = corte ?? 'itens_cortados'
    motivo(razao)
    await reg(rows, false, 'parcial', razao)
  }

  // 4. Fecho e cota
  const final = maisGrave(motivos)
  const estadoFinal: 'ok' | 'parcial' | 'erro' = motivos.length === 0 ? 'ok' : leituraBoa && !canalPausado && !gravacaoFalhou ? 'parcial' : 'erro'
  const todasCobertas = candidatas.every(p => {
    const agora = lidasAgora.get(p.id)
    return playlistCoberta(agora !== undefined ? { items_read_at: 'agora', items_status: agora.status, items_reason: agora.reason } : p, agora !== undefined ? null : e.estado.last_cycle_at)
  })
  const ciclo = calcularCiclo({ listaCompleta: listaFechada, todasCobertas, motivos })
  let falhaDoFecho: string | null = null
  let cotaNaoRegistrada = 0
  try {
    if (!canalPausado) {
      try {
        await e.ops.visitClose({
          siteId: e.siteId, channelId: e.channelId, nowMs: e.agora(), status: estadoFinal, reason: final, units: u, left,
          listaVazia, secoesVazias, ciclo, listTotal, listRead,
        })
      } catch (err) {
        falhaDoFecho = err instanceof ErroX3 ? err.codigo : 'gravacao_falhou'
      }
    }
  } finally {
    try {
      const r = await comPrazo(e.ops.registrarCota({ siteId: e.siteId, nowMs: e.agora(), units: u, ...(tetoPorCanal ? { extra: { x3_teto_por_canal: 1 } } : {}) }), BANCO_MS)
      if ('estourou' in r) cotaNaoRegistrada = u
    } catch { cotaNaoRegistrada = u }
  }
  if (falhaDoFecho !== null) {
    const m = falhaDoFecho
    return { iniciada: true, estado: 'erro', motivo: m, unidades: u, playlistsLeft: left, cotaEsgotada, tetoPorCanal, cotaNaoRegistrada, numeros }
  }
  return { iniciada: true, estado: estadoFinal, motivo: final, unidades: u, playlistsLeft: left, cotaEsgotada, tetoPorCanal, cotaNaoRegistrada, numeros }
}
