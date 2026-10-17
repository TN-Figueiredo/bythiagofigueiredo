import { criarOpsX3, type EstadoDoCanal, type OpsX3 } from '@/lib/youtube/observatorio/playlists/gravar'
import { planejarCanais, type CanalParaPlanejar } from '@/lib/youtube/observatorio/playlists/planejar'
import { X3_RULES } from '@/lib/youtube/observatorio/playlists/regras'
import { maisGrave, visitarCanal } from '@/lib/youtube/observatorio/playlists/visitar'
import { DEFINICAO_PLAYLISTS_SEMANAIS } from '../definicoes'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

export interface DepsPlaylistsSemanais {
  criarOps?: (sb: ContextoTarefa['sb']) => OpsX3
  visitar?: typeof visitarCanal
  fetchImpl?: typeof fetch
}

const erro = (motivo: string): ResultadoTarefa => ({ estado: 'erro', feitas: 0, deixadas: null, motivo })

/**
 * `playlists_semanais` (A5 X3): planeja os canais devidos (puro), lê o estado SÓ deles (`lerCanais`, paginado) e visita um a um com o teto de unidades
 * por canal e por dia. Só devolve CÓDIGO de catálogo e número. Leitura de banco que falha = `erro` (nunca "nenhum visto" nem cota 0).
 */
export async function rodarPlaylistsSemanais(c: ContextoTarefa, deps: DepsPlaylistsSemanais = {}): Promise<ResultadoTarefa> {
  const ops = (deps.criarOps ?? criarOpsX3)(c.sb)
  const visitar = deps.visitar ?? visitarCanal
  const fetchImpl = deps.fetchImpl ?? fetch

  try {
    if (!(await ops.schemaPresente())) return erro('schema_ausente')
  } catch { return erro('gravacao_falhou') }
  if (c.linhas === null) return erro('canais_nao_lidos')

  const ativos = c.linhas.filter(l => l.missing_since === null && l.collection_paused_at === null)
  const siteIds = [...new Set(ativos.map(l => l.site_id))].sort()
  let leituras: Awaited<ReturnType<OpsX3['lerLeituras']>>
  let cota: Map<string, number>
  try {
    leituras = await ops.lerLeituras(ativos.map(l => l.id))
    cota = await ops.cotaDoDia(siteIds, c.agora())
  } catch { return erro('gravacao_falhou') }

  // O plano, por site (a cota do dia é por site)
  const devidos: { id: string; site: string; yt: string }[] = []
  let cortadosPeloTeto = 0
  let semVolta = 0
  for (const site of siteIds) {
    const doSite = ativos.filter(l => l.site_id === site)
    const canais: CanalParaPlanejar[] = doSite.map(l => ({ id: l.id, missing_since: l.missing_since, leitura: leituras.get(l.id) ?? null }))
    const p = planejarCanais({ canais, agoraMs: c.agora(), unidadesJaGastasHoje: cota.get(site) ?? 0 })
    cortadosPeloTeto += p.cortadosPeloTeto
    semVolta += p.canaisSemVolta14d
    const porId = new Map(doSite.map(l => [l.id, l]))
    for (const id of p.devidos) { const l = porId.get(id); if (l) devidos.push({ id, site, yt: l.channel_id }) }
  }

  const detalhe: Record<string, number> = {
    canais_parciais: [...leituras.values()].filter(l => l.last_status === 'parcial').length,
    canais_sem_volta_14d: semVolta,
  }
  try { detalhe.canais_com_secoes = await ops.canaisComSecoes(ativos.map(l => l.id)) } catch { detalhe.canais_com_secoes_nao_lido = 1 }

  // O estado dos devidos, uma vez por disparo, por site
  const estados = new Map<string, EstadoDoCanal>()
  try {
    for (const site of siteIds) {
      const ids = devidos.filter(d => d.site === site).map(d => d.id)
      if (ids.length === 0) continue
      for (const [id, e] of await ops.lerCanais(site, ids)) estados.set(id, e)
    }
  } catch { return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'gravacao_falhou', detalhe } }

  const gasto = new Map(cota)
  const motivos: string[] = []
  let feitas = 0
  let erros = 0
  let unidades = 0
  let semCota = 0
  let parou = false
  let restantes = devidos.length
  for (const d of devidos) {
    if (c.agora() - c.t0 >= X3_RULES.canalComecaAteMs) { motivos.push('sobrou'); break }
    if ((gasto.get(d.site) ?? 0) >= X3_RULES.unidadesPorDia) { motivos.push('teto_do_dia'); continue }
    const estado = estados.get(d.id)
    if (estado === undefined) { erros++; motivos.push('gravacao_falhou'); restantes--; continue }
    const r = await visitar({ siteId: d.site, channelId: d.id, youtubeChannelId: d.yt, apiKey: c.apiKey, ops, fetchImpl, agora: c.agora, t0: c.t0, estado })
    if (!r.iniciada) { motivos.push('sobrou'); break }
    restantes--
    feitas++
    unidades += r.unidades
    semCota += r.cotaNaoRegistrada
    gasto.set(d.site, (gasto.get(d.site) ?? 0) + r.unidades)
    if (r.estado === 'erro') erros++
    if (r.motivo !== null) motivos.push(r.motivo)
    if (r.cotaEsgotada) { parou = true; break }
  }
  detalhe.canais_visitados = feitas
  detalhe.unidades = unidades
  if (semCota > 0) detalhe.cota_nao_registrada = semCota
  if (cortadosPeloTeto > 0) { motivos.push('teto_do_dia'); detalhe.cortados_pelo_teto = cortadosPeloTeto }
  const deixadas = parou ? Math.max(restantes, 0) : motivos.includes('sobrou') ? Math.max(restantes, 0) : 0

  if (feitas === 0 && devidos.length > 0 && motivos.includes('sobrou')) return { estado: 'parcial', feitas: 0, deixadas: restantes, motivo: 'sem_tempo', detalhe }
  if (feitas > 0 && erros === feitas) return { estado: 'erro', feitas, deixadas, motivo: maisGrave(motivos) ?? 'api_falhou', detalhe }
  if (motivos.length > 0) return { estado: 'parcial', feitas, deixadas, motivo: maisGrave(motivos) ?? 'sobrou', detalhe }
  return { estado: 'ok', feitas, deixadas: 0, detalhe }
}

export const playlistsSemanais: Tarefa = { ...DEFINICAO_PLAYLISTS_SEMANAIS, rodar: c => rodarPlaylistsSemanais(c) }
