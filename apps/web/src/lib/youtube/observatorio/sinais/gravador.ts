// Gravador dos sinais do nicho (F2 T7): por site, em sequência: loadRows (com prazo), lugares, projeção, núcleo, `niche_signals_gravar`.
// Um site que falha conta em `falhas` e não impede o próximo. Nenhum texto de fora vai para o resultado: só código de motivo e número.
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { loadRows, readAll, rowsToDataset } from '../load'
import { createObservatory } from '../index'
import { calcularLugares, ErroSementeIncompleta, gravarLugares, lerEntradasDeLugar, lerIndiceDeLugar, lerProprios } from './lugares-do-site'
import { projetarOutliers, recomporVistos, type AncoraRow, type VistoRow } from './projecao'
import { calcularOportunidades, type OutlierProjetado, type ProprioProjetado } from './oportunidades'
import { REGRA_SINAIS, ruleVersionDe } from './regra'
import { tokensDe } from './tokens'

const DIA_MS = 86_400_000

export type MotivoDoGravador = 'motor_estourou' | 'gravar_falhou' | 'site_falhou' | 'schema_ausente' | 'semente_incompleta' | 'inesperado'

export interface ResultadoDoGravador {
  sites: number
  novos: number
  atualizados: number
  expirados: number
  falhas: number
  ms: number
  motivo?: MotivoDoGravador
  inicioMs: number
  outliers: number
  outliersSemLugar: number
  outliersDescartados: number
  lugaresRegravados: number
}

/** O que um passo posterior (F2b) recebe. */
export interface ContextoDoPasso { sb: SupabaseClient; agora: Date; restanteMs: () => number }
/** Ponto de extensão da F2b: passos depois de todos os sites, cada um em `try/catch` próprio. Vazia hoje. */
export const PASSOS_DEPOIS: Array<(c: ContextoDoPasso) => Promise<void>> = []

class FalhaDeSite extends Error {
  constructor(readonly motivo: MotivoDoGravador, readonly codigo?: string) { super(motivo) }
}

/** Sinais mais específicos primeiro: quando vários sites falham por motivos diferentes, o motivo da tarefa é o mais específico. */
const PRIORIDADE: readonly MotivoDoGravador[] = ['schema_ausente', 'semente_incompleta', 'motor_estourou', 'gravar_falhou', 'site_falhou', 'inesperado']

const SCHEMA_AUSENTE = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])
const codigoDe = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code.slice(0, 5) : undefined

function paraSentry(onde: string, err: unknown): void {
  const codigo = codigoDe(err)
  Sentry.captureMessage(`sinais_do_nicho: ${onde}: ${err instanceof Error ? err.name : typeof err === 'object' && err !== null && 'name' in err && typeof err.name === 'string' ? err.name : typeof err}${codigo ? ' ' + codigo : ''}`, 'error')
}

/** Corrida contra o prazo (sem o teto de 15 s do `comPrazo` da coleta: o `loadRows` do site inteiro passa disso). `null` = o prazo venceu. */
async function comPrazo<T>(p: Promise<T>, ms: number): Promise<T | null> {
  p.catch(() => undefined) // o perdedor não pode virar rejeição não tratada
  if (ms <= 0) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms) })
  try { return await Promise.race([p, limite]) } finally { clearTimeout(timer) }
}

interface DoSite { novos: number; atualizados: number; expirados: number; outliers: number; semLugar: number; descartados: number; regravados: number }

async function rodarSite(sb: SupabaseClient, siteId: string, agora: Date, restanteMs: () => number, indice: Awaited<ReturnType<typeof lerIndiceDeLugar>>): Promise<DoSite> {
  const rows = await comPrazo(loadRows({ siteId, now: agora.getTime(), supabase: sb }), restanteMs())
  if (rows === null) throw new FalhaDeSite('motor_estourou')

  const proprios = await lerProprios(sb, siteId, agora)
  const { raws, existentes } = await lerEntradasDeLugar(sb, siteId)
  const calculo = calcularLugares({ siteId, rows, proprios, indice, raws, existentes, agora })
  if (restanteMs() <= 0) throw new FalhaDeSite('motor_estourou')
  await gravarLugares(sb, siteId, calculo)

  const obs = createObservatory(rowsToDataset(rows, agora.getTime()))
  const proj = projetarOutliers(obs, calculo.lugarDe, calculo.textoDe)

  const corte = new Date(agora.getTime() - REGRA_SINAIS.janelaDias * DIA_MS).toISOString()
  const [vistos, ancoras, abertas, alguma] = await Promise.all([
    readAll<VistoRow>('niche_outliers_vistos', () =>
      sb.from('niche_outliers_vistos').select('video_id, canal_id, formato, published_at, n_canal, ultimo_visto_em, mult_max, vpd7_max, chaves')
        .eq('site_id', siteId).gte('ultimo_visto_em', corte).order('video_id')),
    sb.rpc('niche_signals_ancoras', { p_site: siteId }).then(r => {
      if (r.error) throw r.error
      return (Array.isArray(r.data) ? r.data : []) as AncoraRow[]
    }),
    readAll<{ subject_key: string }>('niche_signals', () =>
      sb.from('niche_signals').select('subject_key').eq('site_id', siteId).eq('status', 'aberto').order('id')),
    sb.from('niche_signals').select('id').eq('site_id', siteId).limit(1).then(r => {
      if (r.error) throw r.error
      return (r.data ?? []).length > 0
    }),
  ])
  const chavesAbertas = new Set(abertas.map(a => a.subject_key))

  const idsDeHoje = new Set(proj.outliers.map(o => o.videoId))
  const recompostos = recomporVistos({
    vistos, ancoras, lugarDe: calculo.lugarDe, conhecido: calculo.conhecido, idsDeHoje, agora, janelaDias: REGRA_SINAIS.janelaDias,
  })
  const outliers: OutlierProjetado[] = [...proj.outliers, ...recompostos.outliers]
  const projProprios: ProprioProjetado[] = proprios.map(p => ({
    videoId: p.id, formato: p.is_short === null ? null : p.is_short ? 'short' : 'long',
    chaves: calculo.lugarDe(p.id), tokens: tokensDe(calculo.textoDe(p.id)),
  }))

  const nucleo = calcularOportunidades({
    outliers, ancorasPorChave: recompostos.ancorasPorChave, chavesAbertas, proprios: projProprios,
    canaisSemRitmo: proj.canaisSemRitmo, canaisTotal: proj.canaisTotal, agora, semente: indice.versao,
  })
  const regra = ruleVersionDe(indice.versao)
  const lote = nucleo.itens.map(o => ({
    kind: o.kind, subject_key: o.subjectKey, rule_version: regra, evidence: o.evidence, forca: o.forca, acao: o.acao, motivo: o.motivo,
    notificar_como: o.notificarComo,
    // contrato: 'atualizar' explícito para toda chave aberta, 'novo' para o resto (nunca depender do padrão da função)
    modo: chavesAbertas.has(o.subjectKey) ? 'atualizar' : 'novo',
  }))
  const vistosDeHoje = proj.outliers.map(o => ({
    video_id: o.videoId, canal_id: o.canalId, formato: o.formato, published_at: o.publishedAt, n_canal: o.nCanal,
    mult_max: o.mult, vpd7_max: o.vpd7, chaves: o.chaves,
  }))

  if (restanteMs() <= 0) throw new FalhaDeSite('motor_estourou')
  const { data, error } = await sb.rpc('niche_signals_gravar', {
    p_site: siteId, p_lote: lote,
    p_estado: { rule_version: regra, motivo_vazio: nucleo.motivoVazio, contagens: nucleo.contagens },
    p_linha_de_base: !alguma, p_vistos: vistosDeHoje,
  })
  if (error) throw new FalhaDeSite(SCHEMA_AUSENTE.has(error.code) ? 'schema_ausente' : 'gravar_falhou', error.code)
  const r = (data ?? {}) as { novos?: number; atualizados?: number; expirados?: number }
  return {
    novos: Number(r.novos ?? 0), atualizados: Number(r.atualizados ?? 0), expirados: Number(r.expirados ?? 0),
    outliers: proj.outliers.length, semLugar: proj.outliersSemLugar, descartados: proj.outliersDescartados, regravados: calculo.regravar.length,
  }
}

export async function rodarSinaisDoNicho(p: { sb: SupabaseClient; agora: Date; prazoMs: number; inicioMs: number }): Promise<ResultadoDoGravador> {
  const ini = Date.now()
  const restanteMs = (): number => p.prazoMs - (Date.now() - ini)
  const r: ResultadoDoGravador = {
    sites: 0, novos: 0, atualizados: 0, expirados: 0, falhas: 0, ms: 0, inicioMs: p.inicioMs,
    outliers: 0, outliersSemLugar: 0, outliersDescartados: 0, lugaresRegravados: 0,
  }
  const motivos = new Set<MotivoDoGravador>()
  const fim = (): ResultadoDoGravador => {
    r.ms = Date.now() - ini
    if (r.falhas > 0 || motivos.size > 0) r.motivo = PRIORIDADE.find(m => motivos.has(m)) ?? 'site_falhou'
    return r
  }

  let siteIds: string[]
  let indice: Awaited<ReturnType<typeof lerIndiceDeLugar>>
  try {
    const canais = await readAll<{ site_id: string }>('competitor_channels', () => p.sb.from('competitor_channels').select('id, site_id').order('id'))
    siteIds = [...new Set(canais.map(c => c.site_id))]
    r.sites = siteIds.length
    indice = await lerIndiceDeLugar(p.sb)
  } catch (err) {
    paraSentry('leitura inicial', err)
    r.falhas++
    const codigo = codigoDe(err)
    motivos.add(err instanceof ErroSementeIncompleta ? 'semente_incompleta' : codigo !== undefined && SCHEMA_AUSENTE.has(codigo) ? 'schema_ausente' : 'inesperado')
    return fim()
  }

  for (const siteId of siteIds) {
    // depois de um `motor_estourou` o `comPrazo` não cancela o `loadRows` perdedor: sem prazo, o site seguinte nem começa
    if (restanteMs() <= 0) { r.falhas++; motivos.add('motor_estourou'); continue }
    try {
      const s = await rodarSite(p.sb, siteId, p.agora, restanteMs, indice)
      r.novos += s.novos; r.atualizados += s.atualizados; r.expirados += s.expirados
      r.outliers += s.outliers; r.outliersSemLugar += s.semLugar; r.outliersDescartados += s.descartados; r.lugaresRegravados += s.regravados
    } catch (err) {
      r.falhas++
      if (err instanceof FalhaDeSite) {
        motivos.add(err.motivo)
        if (err.motivo !== 'motor_estourou') paraSentry('site', { name: err.motivo, code: err.codigo })
      } else {
        paraSentry('site', err)
        const codigo = codigoDe(err)
        motivos.add(err instanceof ErroSementeIncompleta ? 'semente_incompleta' : codigo !== undefined && SCHEMA_AUSENTE.has(codigo) ? 'schema_ausente' : 'site_falhou')
      }
    }
  }

  for (const passo of PASSOS_DEPOIS) {
    try { await passo({ sb: p.sb, agora: p.agora, restanteMs }) } catch (err) { paraSentry('passo', err) }
  }
  return fim()
}
