import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { modoTrocasConcorrente } from './flag'
import { inferirObservadoDetalhe, VALIDAS_MIN_MEDIDO, type LeituraObs, type ThumbObs } from './inferir'
import { chaveAlvo, MAX_OBSERVADOS_POR_DISPARO, MIN_SOBRA_MS, selecionarAlvos, type AlvoObs, type CursorObs } from './selecao'

const PAGINA = 1000
const MAX_PAGINAS = 60
const LOTE_VIDEOS = 100
const LOTE_THUMBS = 200
const PODA_LOTE = 500
const VARREDURA_LOTE = 500

export interface ResultadoPasso {
  /** false = flag off: nada foi lido nem escrito. */
  ativo: boolean
  detalhe: Record<string, number>
  /** `observados_falhou` | `observados_schema_ausente` (passo inteiro, nunca um alvo só): o registrador vira `parcial`, nunca `erro`. */
  motivo: 'observados_falhou' | 'observados_schema_ausente' | null
}

export interface OpcoesPasso { env?: NodeJS.ProcessEnv; fimDuroMs: number; maxAlvos?: number; varreduraLote?: number }

class SemTempo extends Error {}

interface Contadores {
  obs_avaliados: number; obs_trocas: number; obs_falhou: number; obs_sem_tempo: number; obs_indeterminadas: number; obs_sem_publicacao: number
  obs_devidos: number; obs_fechados: number; obs_ignorados: number; obs_podadas: number; obs_sem_sobra: number; obs_sem_leitura_valida: number
}
const novoDetalhe = (): Contadores => ({
  obs_avaliados: 0, obs_trocas: 0, obs_falhou: 0, obs_sem_tempo: 0, obs_indeterminadas: 0, obs_sem_publicacao: 0,
  obs_devidos: 0, obs_fechados: 0, obs_ignorados: 0, obs_podadas: 0, obs_sem_sobra: 0, obs_sem_leitura_valida: 0,
})

/**
 * Passo do observador no registrador (T13, §5.8): depois dos próprios, atrás de `OBS_TROCAS_CONCORRENTE` (padrão off), nunca tirando tempo deles
 * e com `try/catch` isolado: a falha vira `motivo` e nunca reprova a tarefa dos próprios nem os `avisos_pendentes`.
 * Escreve só em `ab_native_observados` e `ab_native_obs_cursor` (e na poda delas).
 */
export async function rodarObservados(c: ContextoTarefa, o: OpcoesPasso): Promise<ResultadoPasso> {
  if (modoTrocasConcorrente(o.env ?? process.env) !== 'on') return { ativo: false, detalhe: {}, motivo: null }
  const d = novoDetalhe()
  try {
    if (o.fimDuroMs - c.agora() < MIN_SOBRA_MS) { d.obs_sem_tempo = 1; d.obs_sem_sobra = 1; return { ativo: true, detalhe: { ...d }, motivo: null } }
    const falha = await schemaTablesReady(c.sb, [['MG-T13', [['ab_native_observados', 'id'], ['ab_native_obs_cursor', 'site_id']]]], { signal: AbortSignal.timeout(BANCO_MS) })
    if (falha !== null) return { ativo: true, detalhe: { ...d }, motivo: falha.tipo === 'ausente' ? 'observados_schema_ausente' : 'observados_falhou' }
    await passo(c, o, d)
    // falha de UM alvo (ou da varredura) fica no detalhe (`obs_falhou`) e no Sentry: reservar `parcial` ao passo inteiro (lista, schema, exceção)
    return { ativo: true, detalhe: { ...d }, motivo: null }
  } catch (e) {
    if (e instanceof SemTempo) { d.obs_sem_tempo++; return { ativo: true, detalhe: { ...d }, motivo: null } }
    Sentry.captureMessage('observados: passo falhou: ' + (e instanceof Error ? e.name : typeof e), { level: 'warning', tags: { area: 'ab-observados' } })
    d.obs_falhou++
    return { ativo: true, detalhe: { ...d }, motivo: 'observados_falhou' }
  }
}

function ida(c: ContextoTarefa, fimDuroMs: number): void {
  if (c.agora() >= fimDuroMs) throw new SemTempo()
}

type Linha = Record<string, unknown>
async function paginado(c: ContextoTarefa, fim: number, montar: (sb: SupabaseClient) => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }> }): Promise<Linha[]> {
  const out: Linha[] = []
  let total: number | null = null
  for (let p = 0; p < MAX_PAGINAS; p++) {
    ida(c, fim)
    const r = await montar(c.sb).range(p * PAGINA, p * PAGINA + PAGINA - 1)
    if (r.error || !Array.isArray(r.data)) throw new Error('leitura_falhou')
    out.push(...(r.data as Linha[]))
    total = r.count
    if (r.data.length < PAGINA) break
  }
  if (total !== null && out.length !== total) throw new Error('paginacao')
  return out
}

const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

async function passo(c: ContextoTarefa, o: OpcoesPasso, d: Contadores): Promise<void> {
  const fim = o.fimDuroMs
  // 1) alvos de concorrente (inclui os que saíram: a varredura fecha as linhas deles) e cursores
  const alvosBrutos = await paginado(c, fim, sb => sb.from('yt_watch_alvos')
    .select('site_id,youtube_video_id,rodadas,ultima_rodada_em,saiu_em,saiu_por', { count: 'exact' }).eq('tipo', 'concorrente').order('id', { ascending: true }))
  const alvos: AlvoObs[] = alvosBrutos.flatMap(a => {
    const siteId = texto(a.site_id), ytId = texto(a.youtube_video_id), rodadas = inteiro(a.rodadas)
    return siteId && ytId && rodadas !== null ? [{ siteId, ytId, rodadas, ultimaRodadaEm: texto(a.ultima_rodada_em), saiuEm: texto(a.saiu_em), saiuPor: texto(a.saiu_por) }] : []
  })
  // só os cursores dos alvos (lotes de 100 ids): O(alvos), não O(cursores de 365 d)
  const cursoresBrutos: Linha[] = []
  const idsAlvo = [...new Set(alvos.map(a => a.ytId))].sort()
  for (let i = 0; i < idsAlvo.length; i += LOTE_VIDEOS) {
    const lote = idsAlvo.slice(i, i + LOTE_VIDEOS)
    cursoresBrutos.push(...await paginado(c, fim, sb => sb.from('ab_native_obs_cursor')
      .select('site_id,youtube_video_id,avaliado_ate_rodada,avaliado_em,avaliado_motivo', { count: 'exact' }).in('youtube_video_id', lote)
      .order('site_id', { ascending: true }).order('youtube_video_id', { ascending: true })))
  }
  const cursores: CursorObs[] = cursoresBrutos.flatMap(k => {
    const siteId = texto(k.site_id), ytId = texto(k.youtube_video_id), ate = inteiro(k.avaliado_ate_rodada), em = texto(k.avaliado_em)
    return siteId && ytId && ate !== null && em ? [{ siteId, ytId, avaliadoAteRodada: ate, avaliadoEm: em }] : []
  })

  // 2) publicação: junção por canal do site (competitor_videos.video_id; canal com remoção pedida é ignorado). Nulo = sem_publicacao.
  const publicado = await publicacoes(c, fim, alvos)
  const elegiveis = alvos.filter(a => publicado.has(chaveAlvo(a.siteId, a.ytId)))
  d.obs_ignorados = alvos.length - elegiveis.length

  // 3) varredura: linha em_andamento cujo alvo saiu ou já foi podado fecha como sem_desfecho
  try {
    await varrer(c, fim, alvos, d, o.varreduraLote ?? VARREDURA_LOTE)
  } catch (e) {
    if (e instanceof SemTempo) throw e
    d.obs_falhou++ // a varredura falhar não impede a avaliação
  }

  // 4) seleção incremental e avaliação
  const { escolhidos, devidos } = selecionarAlvos(elegiveis, cursores, o.maxAlvos ?? MAX_OBSERVADOS_POR_DISPARO)
  d.obs_devidos = devidos
  const falhas: string[] = []
  for (let i = 0; i < escolhidos.length; i++) {
    const a = escolhidos[i]!
    if (c.agora() >= fim) { d.obs_sem_tempo += escolhidos.length - i; break }
    try {
      await avaliar(c, fim, a, publicado.get(chaveAlvo(a.siteId, a.ytId)) ?? null, d)
    } catch (e) {
      if (e instanceof SemTempo) { d.obs_sem_tempo += escolhidos.length - i; break }
      d.obs_falhou++ // sem cursor: o alvo volta à fila (dívida declarada: gatilho obs_falhou > 0 por 3 dias seguidos)
      falhas.push(a.ytId)
    }
  }
  if (falhas.length > 0) Sentry.captureMessage('observados: alvo(s) falharam', { level: 'warning', tags: { area: 'ab-observados' }, extra: { youtube_video_ids: falhas.slice(0, 10) } })

  // 5) poda (365 d), com o tempo que sobrar
  if (c.agora() + MIN_SOBRA_MS <= fim) {
    try {
      const r = await c.sb.rpc('obs_native_poda', { p_agora: new Date(c.agora()).toISOString(), p_lote: PODA_LOTE }).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (!r.error && typeof r.data === 'number') d.obs_podadas = r.data
    } catch { /* a poda é manutenção: falhar não reprova o passo */ }
  }
}

/** chave -> publicação mínima (ISO) ou null (sem publicação). Alvo sem vídeo em canal ativo do site não entra no mapa. */
async function publicacoes(c: ContextoTarefa, fim: number, alvos: readonly AlvoObs[]): Promise<Map<string, string | null>> {
  ida(c, fim)
  const canais = await c.sb.from('competitor_channels').select('id,site_id,removal_requested_at').abortSignal(AbortSignal.timeout(BANCO_MS))
  if (canais.error || !Array.isArray(canais.data)) throw new Error('canais')
  const siteDoCanal = new Map<string, string>()
  for (const k of canais.data as Linha[]) if (k.removal_requested_at == null && texto(k.id) && texto(k.site_id)) siteDoCanal.set(k.id as string, k.site_id as string)
  const ids = [...new Set(alvos.map(a => a.ytId))]
  const sitesPorAlvo = new Set(alvos.map(a => chaveAlvo(a.siteId, a.ytId)))
  const out = new Map<string, string | null>()
  for (let i = 0; i < ids.length; i += LOTE_VIDEOS) {
    ida(c, fim)
    const r = await c.sb.from('competitor_videos').select('video_id,published_at,competitor_channel_id').in('video_id', ids.slice(i, i + LOTE_VIDEOS)).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error || !Array.isArray(r.data)) throw new Error('videos')
    for (const v of r.data as Linha[]) {
      const site = siteDoCanal.get(String(v.competitor_channel_id))
      const yt = texto(v.video_id)
      if (!site || !yt) continue
      const chave = chaveAlvo(site, yt)
      if (!sitesPorAlvo.has(chave)) continue
      const pub = texto(v.published_at)
      const atual = out.get(chave)
      if (!out.has(chave)) out.set(chave, pub)
      else if (pub !== null && (atual === null || atual === undefined || Date.parse(pub) < Date.parse(atual))) out.set(chave, pub)
    }
  }
  return out
}

async function varrer(c: ContextoTarefa, fim: number, alvos: readonly AlvoObs[], d: Contadores, lote: number): Promise<void> {
  ida(c, fim)
  // a linha de alvo vivo é regravada a cada avaliação e vai para o fim; a de alvo que saiu fica parada e vem primeiro.
  const r = await c.sb.from('ab_native_observados').select('id,site_id,youtube_video_id').eq('ficou_estado', 'em_andamento')
    .order('ultima_atualizacao_em', { ascending: true }).order('id', { ascending: true }).limit(lote).abortSignal(AbortSignal.timeout(BANCO_MS))
  if (r.error || !Array.isArray(r.data)) throw new Error('varredura')
  const porChave = new Map(alvos.map(a => [chaveAlvo(a.siteId, a.ytId), a]))
  for (const l of r.data as Linha[]) {
    const a = porChave.get(chaveAlvo(String(l.site_id), String(l.youtube_video_id)))
    const motivo = a === undefined ? 'alvo_podado' : a.saiuEm !== null ? (a.saiuPor ?? 'saiu') : null
    if (motivo === null) continue
    ida(c, fim)
    const u = await c.sb.from('ab_native_observados').update({ ficou_estado: 'sem_desfecho', motivo, ultima_atualizacao_em: new Date(c.agora()).toISOString() })
      .eq('id', l.id as number).eq('ficou_estado', 'em_andamento').abortSignal(AbortSignal.timeout(BANCO_MS))
    if (u.error) { d.obs_falhou++; continue }
    d.obs_fechados++
  }
}

async function avaliar(c: ContextoTarefa, fim: number, a: AlvoObs, publicadoEm: string | null, d: Contadores): Promise<void> {
  const agora = (): string => new Date(c.agora()).toISOString()
  const gravarCursor = async (motivo: 'ok' | 'sem_publicacao', validas: { titulo: number; miniatura: number } = { titulo: 0, miniatura: 0 }): Promise<void> => {
    ida(c, fim)
    const r = await c.sb.from('ab_native_obs_cursor').upsert(
      { site_id: a.siteId, youtube_video_id: a.ytId, avaliado_ate_rodada: a.rodadas, avaliado_em: agora(), avaliado_motivo: motivo, validas_titulo: validas.titulo, validas_miniatura: validas.miniatura },
      { onConflict: 'site_id,youtube_video_id' },
    ).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error) throw new Error('cursor')
  }
  if (publicadoEm === null) { await gravarCursor('sem_publicacao'); d.obs_sem_publicacao++; return }

  // `a.rodadas` foi lida ANTES das leituras (Phil N8): uma rodada inserida no meio fica para o próximo disparo
  const lidas = await paginado(c, fim, sb => sb.from('yt_watch_readings')
    .select('id,rodada_id,lida_em,http,erro,jogador_bloqueado,idioma,titulo_exibido,titulo_oficial,titulo_oficial_fonte,miniatura_id', { count: 'exact' })
    .eq('site_id', a.siteId).eq('youtube_video_id', a.ytId).order('lida_em', { ascending: true }).order('id', { ascending: true }))
  const leituras: LeituraObs[] = lidas.flatMap(l => {
    const id = inteiro(l.id), lidaEm = texto(l.lida_em), rodadaId = texto(l.rodada_id)
    return id !== null && lidaEm && rodadaId ? [{
      id, rodadaId, lidaEm, http: inteiro(l.http), erro: texto(l.erro), jogadorBloqueado: l.jogador_bloqueado === true, idioma: texto(l.idioma), tituloExibido: texto(l.titulo_exibido),
      tituloOficial: texto(l.titulo_oficial), tituloFonte: texto(l.titulo_oficial_fonte), miniaturaId: inteiro(l.miniatura_id),
    }] : []
  })
  const idsThumb = [...new Set(leituras.flatMap(l => (l.miniaturaId === null ? [] : [l.miniaturaId])))]
  const thumbsPorId = new Map<number, ThumbObs>()
  for (let i = 0; i < idsThumb.length; i += LOTE_THUMBS) {
    ida(c, fim)
    const r = await c.sb.from('yt_watch_thumbs').select('id,variante,http,dhash,largura,altura').in('id', idsThumb.slice(i, i + LOTE_THUMBS)).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error || !Array.isArray(r.data)) throw new Error('thumbs')
    for (const t of r.data as Linha[]) {
      const id = inteiro(t.id), variante = texto(t.variante)
      if (id !== null && variante) thumbsPorId.set(id, { id, variante, http: inteiro(t.http), dhash: texto(t.dhash), largura: inteiro(t.largura), altura: inteiro(t.altura) })
    }
  }
  const r = inferirObservadoDetalhe({
    leituras, thumbsPorId, publicadoEm: new Date(publicadoEm), agoraMs: c.agora(), alvoSaiu: a.saiuEm !== null, ...(a.saiuPor !== null ? { saiuPor: a.saiuPor } : {}),
  })
  d.obs_indeterminadas += r.indeterminadas
  if (r.observados.length > 0) {
    ida(c, fim)
    const w = await c.sb.from('ab_native_observados').upsert(r.observados.map(x => ({
      site_id: a.siteId, youtube_video_id: a.ytId, campo: x.campo, tipo_troca: x.tipoTroca, veredito: x.veredito, versao_regra: x.versaoRegra,
      trocas: x.trocas, n_versoes: x.nVersoes, ficou: x.ficou, ficou_estado: x.ficouEstado, motivo: x.motivo,
      primeira_troca_em: x.primeiraTrocaEm, ultima_atualizacao_em: x.ultimaAtualizacaoEm,
    })), { onConflict: 'site_id,youtube_video_id,campo' }).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (w.error) throw new Error('observados')
    d.obs_trocas += r.observados.length
  }
  await gravarCursor('ok', { titulo: r.validasTitulo, miniatura: r.validasMiniatura })
  if (r.validasTitulo < VALIDAS_MIN_MEDIDO || r.validasMiniatura < VALIDAS_MIN_MEDIDO) d.obs_sem_leitura_valida++ // "não medido" em algum campo: a F2 não mostra "sem troca vista"
  d.obs_avaliados++
}
