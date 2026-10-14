/**
 * Quem chama já fez `requireEditAccess` (e `denyUnlessSiteAdmin` onde a ação exige): estas leituras NÃO conferem direito.
 *
 * A5 · E10: o que o arquivo ainda deve ao dono neste site, para a tela de canais e para o cron: o sinal do banco, as exportações
 * (na tela, "exportações a confirmar") esperando conferência ou confirmação, as que ficaram sem canal, os canais com a coleta pausada
 * e as miniaturas que ainda estão no Blob. Cada parte falha sozinha: uma leitura que falha é `{ porque }` (código fechado), que a tela
 * escreve "não medido", e NUNCA uma lista vazia ("0 exportações" diria que está tudo em dia). Nenhuma mensagem do banco sai daqui.
 * A tela escreve "exportação"; o tipo `LoteAberto` mantém o nome do plano.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CausaDaFalha } from '@/lib/youtube/agenda/tipos'
import { RULES } from '../rules'
import { causaDoErro, lerSinalDoBanco, TETO_LEITURA_MS, type SinalLido } from './ler-sinal'

/** A sentinela que a MG6 grava em `period_start` e `period_end` da tabela sem coluna de mês ("arquivo único"). */
export const PERIODO_DE_ARQUIVO_UNICO = '1970-01-01'
const DIA_MS = 86_400_000
const PAGINA = 1_000
/** Páginas lidas no máximo (30.000 linhas de registro): mais que isto é anormal, e vira "não lido" em vez de lista cortada. */
const PAGINAS_MAX = 30

export interface LoteAberto {
  lote: string
  canalRef: string
  canalNome: string | null
  exportadoEm: string
  conferido: boolean
  dias: number
  arquivos: number
  registros: number
  /** AAAA-MM-DD ou null ("sem período"): linha de arquivo único (1970-01-01) não entra no período. */
  periodoDe: string | null
  periodoAte: string | null
  /** O maior `verified_at`, e só se TODAS as linhas do lote estão conferidas; senão null. */
  conferidoEm: string | null
}

type Parte<T> = { valor: T } | { porque: CausaDaFalha }

export interface CanalPausado { canalId: string; nome: string | null; desde: string; dias: number; esquecido: boolean }

export interface AvisoDoArquivo {
  banco: SinalLido
  lotesNaoConfirmados: Parte<LoteAberto[]>
  lotesDeCanalInexistente: Parte<number>
  pausados: Parte<CanalPausado[]>
  miniaturasPendentes: Parte<number>
}

type Linha = Record<string, unknown>
const ehObjeto = (v: unknown): v is Linha => typeof v === 'object' && v !== null && !Array.isArray(v)
const textoOuNulo = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const instante = (v: unknown): number | null => { const t = typeof v === 'string' ? Date.parse(v) : Number.NaN; return Number.isFinite(t) ? t : null }

/** Lê a consulta inteira em páginas de 1.000 (o teto do PostgREST): linha cortada em silêncio seria "tudo em dia" de mentira. */
async function lerTudo(pagina: (de: number, ate: number) => PromiseLike<{ data?: unknown; error?: unknown } | null | undefined>): Promise<Parte<Linha[]>> {
  const todas: Linha[] = []
  for (let p = 0; p < PAGINAS_MAX; p++) {
    const res = await pagina(p * PAGINA, p * PAGINA + PAGINA - 1)
    if (typeof res !== 'object' || res === null) return { porque: 'forma_invalida' }
    if (res.error) return { porque: causaDoErro(res.error) }
    if (!Array.isArray(res.data)) return { porque: 'forma_invalida' }
    for (const l of res.data) if (ehObjeto(l)) todas.push(l); else return { porque: 'forma_invalida' }
    if (res.data.length < PAGINA) return { valor: todas }
  }
  return { porque: 'forma_invalida' }
}

async function comCausa<T>(f: () => Promise<Parte<T>>): Promise<Parte<T>> {
  try { return await f() } catch (err) { return { porque: causaDoErro(err) } }
}

async function lerLotes(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<Parte<{ abertos: LoteAberto[]; semCanal: number }>> {
  const linhas = await lerTudo((de, ate) => sb
    .from('obs_archive_batches')
    .select('batch, channel_ref, channel_label, table_name, period_start, period_end, row_count, exported_at, verified_at, nas_confirmed_at')
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .is('closed_at', null)
    .order('id', { ascending: true })
    .range(de, ate)
    .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)))
  if ('porque' in linhas) return linhas
  const refs = [...new Set(linhas.valor.map(l => textoOuNulo(l.channel_ref)).filter((r): r is string => r !== null))]
  const existentes = new Set<string>()
  if (refs.length > 0) {
    const canais = await lerTudo((de, ate) => sb
      .from('competitor_channels').select('id').eq('site_id', siteId).in('id', refs).order('id', { ascending: true }).range(de, ate)
      .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)))
    if ('porque' in canais) return canais
    for (const c of canais.valor) if (typeof c.id === 'string') existentes.add(c.id)
  }
  const porLote = new Map<string, Linha[]>()
  for (const l of linhas.valor) {
    const lote = textoOuNulo(l.batch)
    const ref = textoOuNulo(l.channel_ref)
    if (lote === null || ref === null) return { porque: 'forma_invalida' }
    const chave = `${ref}\u0000${lote}`
    porLote.set(chave, [...(porLote.get(chave) ?? []), l])
  }
  const abertos: LoteAberto[] = []
  let semCanal = 0
  for (const ls of porLote.values()) {
    const ref = textoOuNulo(ls[0]!.channel_ref)!
    if (!existentes.has(ref)) { semCanal++; continue }
    if (ls.every(l => l.nas_confirmed_at !== null && l.nas_confirmed_at !== undefined)) continue // confirmada: não é mais "a confirmar"
    const exportados = ls.map(l => instante(l.exported_at))
    if (exportados.some(t => t === null)) return { porque: 'forma_invalida' }
    const mais = Math.min(...(exportados as number[]))
    const conferido = ls.every(l => l.verified_at !== null && l.verified_at !== undefined)
    const verificados = ls.map(l => instante(l.verified_at)).filter((t): t is number => t !== null)
    const comPeriodo = ls.filter(l => textoOuNulo(l.period_start) !== null && l.period_start !== PERIODO_DE_ARQUIVO_UNICO)
    const registros = ls.reduce((s, l) => s + (typeof l.row_count === 'number' ? l.row_count : Number(l.row_count ?? 0)), 0)
    if (!Number.isFinite(registros)) return { porque: 'forma_invalida' }
    const inicios = comPeriodo.map(l => textoOuNulo(l.period_start)!).sort()
    const fins = comPeriodo.map(l => textoOuNulo(l.period_end) ?? textoOuNulo(l.period_start)!).sort()
    abertos.push({
      lote: textoOuNulo(ls[0]!.batch)!, canalRef: ref, canalNome: textoOuNulo(ls[0]!.channel_label), exportadoEm: new Date(mais).toISOString(),
      conferido, dias: Math.max(0, Math.floor((agoraMs - mais) / DIA_MS)), arquivos: ls.length, registros,
      periodoDe: inicios[0] ?? null, periodoAte: fins.length > 0 ? fins[fins.length - 1]! : null,
      conferidoEm: conferido && verificados.length > 0 ? new Date(Math.max(...verificados)).toISOString() : null,
    })
  }
  abertos.sort((a, b) => a.exportadoEm.localeCompare(b.exportadoEm) || a.lote.localeCompare(b.lote))
  return { valor: { abertos, semCanal } }
}

async function lerPausados(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<Parte<CanalPausado[]>> {
  const linhas = await lerTudo((de, ate) => sb
    .from('competitor_channels').select('id, channel_name, collection_paused_at').eq('site_id', siteId).not('collection_paused_at', 'is', null)
    .order('collection_paused_at', { ascending: true }).range(de, ate).abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)))
  if ('porque' in linhas) return linhas
  const out: CanalPausado[] = []
  for (const l of linhas.valor) {
    const t = instante(l.collection_paused_at)
    if (typeof l.id !== 'string' || t === null) return { porque: 'forma_invalida' }
    const dias = Math.max(0, Math.floor((agoraMs - t) / DIA_MS))
    out.push({ canalId: l.id, nome: textoOuNulo(l.channel_name), desde: new Date(t).toISOString(), dias, esquecido: dias >= RULES.pause.forgottenDays })
  }
  return { valor: out }
}

async function lerMiniaturas(sb: SupabaseClient, siteId: string): Promise<Parte<number>> {
  const linhas = await lerTudo((de, ate) => sb
    .from('obs_archive_batches').select('blob_urls_pending').eq('site_id', siteId).eq('table_name', 'competitor_channels')
    .not('deleted_at', 'is', null).not('blob_urls_pending', 'is', null).order('id', { ascending: true }).range(de, ate)
    .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)))
  if ('porque' in linhas) return linhas
  let total = 0
  for (const l of linhas.valor) {
    if (!Array.isArray(l.blob_urls_pending)) return { porque: 'forma_invalida' }
    total += l.blob_urls_pending.length
  }
  return { valor: total }
}

export async function lerAvisoDoArquivo(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<AvisoDoArquivo> {
  const [banco, lotes, pausados, miniaturasPendentes] = await Promise.all([
    lerSinalDoBanco(sb, agoraMs),
    comCausa(() => lerLotes(sb, siteId, agoraMs)),
    comCausa(() => lerPausados(sb, siteId, agoraMs)),
    comCausa(() => lerMiniaturas(sb, siteId)),
  ])
  return {
    banco,
    lotesNaoConfirmados: 'valor' in lotes ? { valor: lotes.valor.abertos } : lotes,
    lotesDeCanalInexistente: 'valor' in lotes ? { valor: lotes.valor.semCanal } : lotes,
    pausados,
    miniaturasPendentes,
  }
}
