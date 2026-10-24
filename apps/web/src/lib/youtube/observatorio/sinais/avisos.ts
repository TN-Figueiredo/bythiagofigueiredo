import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { spDate } from '@/lib/youtube/competitor-sync'
import { BLOCO_DO_IN, LIMITE_PENDENTES, naoAdiado } from './leitura'
import { REGRA_SINAIS } from './regra'

/** Outbox do nicho (F2 T9): leva os sinais `aberto` ao sino, um a um até o teto do dia e o resto num resumo. Só sino: `defaultChannels: []`. */
/** Link do sino: a página lê `aviso` para dizer "algumas saíram" (só na abertura vinda do sino). */
export const hrefDoAviso = (dedupKey: string): string => `/cms/youtube/competitors/sugestoes?de=sino&aviso=${encodeURIComponent(dedupKey)}`
const PAGINA = 1000
const MAX_PAGINAS = 20
const SP_OFFSET_MS = 3 * 3_600_000

export interface PendenteAviso { id: string; forca: number; notificar_como: 'individual' | 'resumo'; notificacao_tentativas: number }
/** `sem_tempo`: quantos sites ficaram sem visita porque o prazo da tarefa acabou (0 = todos visitados). `envios_adiados`: sinais cujo aviso falhou nesta execução mas ainda têm tentativas (a tarefa fica vermelha para reabrir no disparo seguinte). */
export interface ResultadoNicho { enviados: number; resumidos: number; falhas: number; sem_tempo: number; envios_adiados: number }

const emBlocos = <T>(xs: readonly T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** Pura: os `teto − jaEnviados` de maior `forca` entre os `individual` vão um a um; o resto e todos os `resumo` vão no resumo do dia. */
export function planejarAvisos(pendentes: ReadonlyArray<PendenteAviso>, jaEnviadosHojeIndividual: number, teto: number): { individuais: string[]; resumo: string[] } {
  const vagas = Math.max(0, teto - jaEnviadosHojeIndividual)
  const candidatos = pendentes.filter((p) => p.notificar_como === 'individual')
    .sort((a, b) => b.forca - a.forca || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const individuais = candidatos.slice(0, vagas).map((p) => p.id)
  const fora = new Set(individuais)
  const resumo = pendentes.filter((p) => !fora.has(p.id)).map((p) => p.id)
  return { individuais, resumo }
}

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

/** `dedup_key` do resumo: dia de São Paulo + 12 primeiros hex do sha256 dos ids ordenados (o mesmo conjunto no mesmo dia é uma notificação só). */
export function dedupDoResumo(agora: Date, ids: readonly string[]): string {
  const hash = createHash('sha256').update([...ids].sort().join(',')).digest('hex').slice(0, 12)
  return `nicho-resumo:${spDate(agora.getTime())}:${hash}`
}

async function sitesDe(sb: SupabaseClient, tabela: 'niche_signals' | 'competitor_channels'): Promise<Set<string>> {
  const out = new Set<string>()
  for (let p = 0; p < MAX_PAGINAS; p++) {
    // Só sinal `aberto` precisa de expiração (as mudanças de status já sincronizam o sino): evita varrer a tabela inteira.
    const base = sb.from(tabela).select('site_id')
    const r = await (tabela === 'niche_signals' ? base.eq('status', 'aberto') : base).order('site_id', { ascending: true }).range(p * PAGINA, (p + 1) * PAGINA - 1)
    if (r.error) throw new Error(`nicho: leitura de ${tabela} falhou`)
    const linhas = (r.data ?? []) as Array<{ site_id: string }>
    for (const l of linhas) out.add(l.site_id)
    if (linhas.length < PAGINA) break
  }
  return out
}

interface LinhaPendente { id: string; kind: string; forca: number | string; notificar_como: 'individual' | 'resumo'; notificacao_tentativas: number; adiado_ate: string | null }

async function enviar(
  fanOut: typeof fanOutToSiteAdminsDetailed,
  opts: { siteId: string; title: string; message: string; dedupKey: string; payload: Record<string, unknown> },
): Promise<boolean> {
  try {
    const fan = await fanOut({
      siteId: opts.siteId, domain: 'youtube', type: 'youtube.niche_signal', priority: 2,
      title: opts.title, message: opts.message, dedupKey: opts.dedupKey, payload: opts.payload, actionHref: hrefDoAviso(opts.dedupKey),
      defaultChannels: [],
    })
    return fan.total > 0 && fan.errors.length === 0
  } catch (e) {
    Sentry.captureMessage('avisos_pendentes: fan-out do nicho lançou: ' + (e instanceof Error ? e.name : typeof e), { level: 'warning', tags: { area: 'sinais-nicho' } })
    return false
  }
}

export interface DepsNicho {
  fanOut?: typeof fanOutToSiteAdminsDetailed
  /** Só estes sites (default: todos os de `niche_signals` e `competitor_channels`). */
  sites?: readonly string[]
  /** `true` = o prazo da tarefa acabou: para entre sites e devolve o que fez, com `sem_tempo`. */
  semTempo?: () => boolean
}

export async function enviarAvisosDoNicho(sb: SupabaseClient, agora: Date, deps: DepsNicho = {}): Promise<ResultadoNicho> {
  const fanOut = deps.fanOut ?? fanOutToSiteAdminsDetailed
  const iso = agora.toISOString()
  const sites = deps.sites !== undefined ? new Set<string>(deps.sites) : new Set<string>([...await sitesDe(sb, 'niche_signals'), ...await sitesDe(sb, 'competitor_channels')])
  const total: ResultadoNicho = { enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, envios_adiados: 0 }
  let erro: Error | null = null

  for (const siteId of sites) {
    if (deps.semTempo?.()) { total.sem_tempo++; continue }
    try {
      const r = await doSite(sb, siteId, agora, iso, fanOut)
      total.enviados += r.enviados; total.resumidos += r.resumidos; total.falhas += r.falhas; total.envios_adiados += r.envios_adiados
    } catch (e) {
      erro ??= e instanceof Error ? e : new Error('nicho: site falhou')
    }
  }
  if (erro) throw erro
  return total
}

async function doSite(sb: SupabaseClient, siteId: string, agora: Date, iso: string, fanOut: typeof fanOutToSiteAdminsDetailed): Promise<ResultadoNicho> {
  const out = await enviarDoSite(sb, siteId, agora, iso, fanOut)
  // Corrida com o `dispensar` (entre a leitura dos pendentes e o fan-out): ressincroniza o sino para derrubar o aviso de quem já não está `aberto`.
  if (out.enviados + out.resumidos > 0) {
    const sync = await sb.rpc('niche_signals_sincronizar_sino', { p_site: siteId })
    if (sync.error) throw new Error('nicho: niche_signals_sincronizar_sino falhou')
  }
  return out
}

async function enviarDoSite(sb: SupabaseClient, siteId: string, agora: Date, iso: string, fanOut: typeof fanOutToSiteAdminsDetailed): Promise<ResultadoNicho> {
  const out: ResultadoNicho = { enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, envios_adiados: 0 }
  // Primeiro a expiração (derruba do sino o vencido e o dispensado), só depois os pendentes.
  const exp = await sb.rpc('niche_signals_expirar', { p_site: siteId })
  if (exp.error) throw new Error('nicho: niche_signals_expirar falhou')

  const lido = await sb.from('niche_signals').select('id,kind,forca,notificar_como,notificacao_tentativas,adiado_ate')
    .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', iso).or(naoAdiado(iso)).is('notificado_em', null).is('notificacao_falhou_em', null)
    .order('first_seen_at', { ascending: true }).limit(LIMITE_PENDENTES)
  if (lido.error) throw new Error('nicho: leitura dos pendentes falhou')
  const pendentes: PendenteAviso[] = ((lido.data ?? []) as LinhaPendente[]).map((l) => ({
    id: l.id, forca: Number(l.forca), notificacao_tentativas: l.notificacao_tentativas ?? 0,
    // `parecido` só vai no resumo enquanto a regra não o libera. Adiada que voltou (adiado_ate já passou) também: não renasce como "Nova sugestão" (F3b).
    notificar_como: (l.kind === 'parecido' && !REGRA_SINAIS.parecidoNotificaIndividual) || (l.adiado_ate ?? null) !== null ? 'resumo' : l.notificar_como,
  }))
  if (pendentes.length === 0) return out
  const tentativasDe = new Map(pendentes.map((p) => [p.id, p.notificacao_tentativas]))

  const est = await sb.from('niche_signals_estado').select('baseline_em').eq('site_id', siteId).maybeSingle()
  if (est.error) throw new Error('nicho: leitura do estado falhou')
  const baseline = ((est.data as { baseline_em: string | null } | null)?.baseline_em ?? null) === null

  const marcarFeito = async (ids: string[], comoResumo: boolean): Promise<void> => {
    for (const bloco of emBlocos(ids, BLOCO_DO_IN)) {
      const r = await sb.from('niche_signals').update({ notificado_em: iso, ...(comoResumo ? { notificar_como: 'resumo' } : {}) })
        .eq('site_id', siteId).in('id', bloco).is('notificado_em', null)
      if (r.error) throw new Error('nicho: notificado_em não gravado')
    }
  }
  const marcarFalha = async (ids: string[]): Promise<void> => {
    // Agrupa pelo novo número de tentativas (no máximo `tetoTentativas` valores): um update por bloco de 200 em vez de um por id.
    const porTentativa = new Map<number, string[]>()
    for (const id of ids) {
      const t = (tentativasDe.get(id) ?? 0) + 1
      porTentativa.set(t, [...(porTentativa.get(t) ?? []), id])
    }
    for (const [t, grupo] of porTentativa) {
      const desistiu = t >= REGRA_SINAIS.tetoTentativas
      for (const bloco of emBlocos(grupo, BLOCO_DO_IN)) {
        const r = await sb.from('niche_signals').update({ notificacao_tentativas: t, ...(desistiu ? { notificacao_falhou_em: iso } : {}) })
          .eq('site_id', siteId).in('id', bloco).is('notificado_em', null)
        if (r.error) throw new Error('nicho: tentativa não gravada')
      }
      if (desistiu) {
        out.falhas += grupo.length
        for (const id of grupo) Sentry.captureMessage('avisos_pendentes: sugestão do nicho abandonada', { level: 'error', tags: { area: 'sinais-nicho' }, extra: { sinal_id: id } })
      } else out.envios_adiados += grupo.length
    }
  }
  const enviarResumo = async (ids: string[], rotuloBase: string, comoResumo: boolean): Promise<void> => {
    const ok = await enviar(fanOut, {
      siteId, title: `${plural(ids.length, 'sugestão', 'sugestões')} do nicho${rotuloBase}`,
      message: 'Destinos em alta nos canais do nicho que podem ajudar o seu canal. Abra a lista de sugestões.',
      dedupKey: dedupDoResumo(agora, ids), payload: { ids },
    })
    if (ok) { await marcarFeito(ids, comoResumo); out.resumidos += ids.length } else await marcarFalha(ids)
  }

  if (baseline) {
    // Primeira execução do site: tudo o que está aberto vai num único resumo; a marca só nasce quando o resumo conclui.
    const ids = pendentes.map((p) => p.id)
    const antes = out.resumidos
    await enviarResumo(ids, ' em aberto', true)
    if (out.resumidos > antes) {
      const b = await sb.from('niche_signals_estado').update({ baseline_em: iso }).eq('site_id', siteId).is('baseline_em', null)
      if (b.error) throw new Error('nicho: baseline_em não gravado')
    }
    return out
  }

  const inicioDoDia = new Date(Date.parse(spDate(agora.getTime()) + 'T00:00:00.000Z') + SP_OFFSET_MS).toISOString()
  const hoje = await sb.from('notifications').select('dedup_key').eq('site_id', siteId).like('dedup_key', 'nicho:%').gte('created_at', inicioDoDia)
  if (hoje.error) throw new Error('nicho: contagem do dia falhou')
  const jaEnviados = new Set(((hoje.data ?? []) as Array<{ dedup_key: string }>).map((n) => n.dedup_key)).size

  const plano = planejarAvisos(pendentes, jaEnviados, REGRA_SINAIS.tetoNotificacoesDia)
  for (const id of plano.individuais) {
    const ok = await enviar(fanOut, {
      siteId, title: 'Nova sugestão do nicho',
      message: 'Um destino está em alta nos canais do nicho e pode ajudar o seu canal. Abra a lista de sugestões.',
      dedupKey: `nicho:${id}`, payload: { ids: [id] },
    })
    if (ok) { await marcarFeito([id], false); out.enviados++ } else await marcarFalha([id])
  }
  if (plano.resumo.length > 0) await enviarResumo(plano.resumo, '', true)
  return out
}

/** Quantas sugestões desistiram nos últimos 7 dias (vira `acao_do_dono` até o 8º dia). */
export async function contarFalhasRecentes(sb: SupabaseClient, agora: Date): Promise<number> {
  const desde = new Date(agora.getTime() - 7 * 86_400_000).toISOString()
  const r = await sb.from('niche_signals').select('id', { count: 'exact', head: true }).gt('notificacao_falhou_em', desde)
  if (r.error) throw new Error('nicho: contagem de falhas falhou')
  return r.count ?? 0
}

export function fraseDeFalhas(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 sugestão do nicho não chegou ao sino' : `${n} sugestões do nicho não chegaram ao sino`
}
