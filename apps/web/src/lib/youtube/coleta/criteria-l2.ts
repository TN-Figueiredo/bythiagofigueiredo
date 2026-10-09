// Critérios de falha do lote L2 (diário por vídeo e alcance normalizado): só LEEM o banco e decidem se o cron
// fica vermelho. Existem porque este sistema falha em verde: um passo sem dado termina sem erro.
//
// REGRA DESTE ARQUIVO (a mesma de criteria.ts): um critério cuja leitura falhou NÃO avalia como "nada de errado":
// registra `critérios: não foi possível avaliar <critério> (<tabela>)` e segue para o próximo. Verde só aparece
// quando a leitura deu certo e o dado realmente não tem o problema.
import { addDays, utcDay } from './day-pt'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx } from './types'

const DIA_MS = 86_400_000
const TIPO_ALCANCE = 'channel_reach_basic_a1'
type Ctx = Pick<StepCtx, 'supabase' | 'falhas' | 'channels'>

const iso = (ms: number): string => new Date(ms).toISOString()

/** Registra a falha própria de um critério que não pôde ser avaliado. */
function naoAvaliou(falhas: string[], criterio: string): void {
  pushUnico(falhas, `critérios: não foi possível avaliar ${criterio}`)
}

/** `true` só quando a leitura deu certo; senão registra o erro de banco E a falha do critério. */
function leituraOk(
  res: { error?: { code?: string | null; message?: string | null } | null },
  tabela: string,
  criterio: string,
  falhas: string[],
): boolean {
  if (conferirBanco(res, tabela, falhas, 'ler') === 'ok') return true
  naoAvaliou(falhas, `${criterio} (${tabela})`)
  return false
}

/** Contagem lida: `null` quando a leitura falhou ou a contagem veio ausente (a nota própria já foi registrada). */
function contagemOk(
  res: { count?: number | null; error?: { code?: string | null; message?: string | null } | null },
  tabela: string,
  criterio: string,
  falhas: string[],
): number | null {
  if (!leituraOk(res, tabela, criterio, falhas)) return null
  if (res.count == null) {
    naoAvaliou(falhas, `${criterio} (${tabela}): contagem ausente`)
    return null
  }
  return res.count
}

/**
 * Canal com 5 vídeos publicados ou mais, 3 dias de execução do passo `diario` com o canal em `ok` e nenhum
 * vídeo com diário `ok` nesses 3 dias. Dia com tentativa de canal que não seja `ok` (sem_conexao,
 * sem_autorizacao, nao_alcancado_orcamento, erro_http) não conta como execução. Menos de 3 dias: ainda cedo.
 */
async function criterioDiario(ctx: Ctx, c: ColetaChannel): Promise<void> {
  const criterio = `diário de ${c.name}`
  const vids = await ctx.supabase
    .from('youtube_videos')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', c.id)
    .not('published_at', 'is', null)
  const n = contagemOk(vids, 'youtube_videos', criterio, ctx.falhas)
  if (n === null || n < 5) return

  const dias = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('attempt_day')
    .eq('scope_type', 'canal')
    .eq('scope_id', c.id)
    .eq('kind', 'diario')
    .eq('outcome', 'ok')
    .gte('attempt_day', addDays(utcDay(new Date()), -14))
    .order('attempt_day', { ascending: false })
    .limit(3)
  if (!leituraOk(dias, 'yt_own_collection_attempts', criterio, ctx.falhas)) return
  const tres = ((dias.data ?? []) as Array<{ attempt_day: string }>).map(l => l.attempt_day)
  if (tres.length < 3) return // ainda cedo

  const comDiario = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_id', { count: 'exact', head: true })
    .eq('scope_type', 'video')
    .eq('kind', 'diario')
    .eq('outcome', 'ok')
    .eq('channel_id', c.id)
    .in('attempt_day', tres)
  const ok = contagemOk(comDiario, 'yt_own_collection_attempts', criterio, ctx.falhas)
  if (ok === 0) pushUnico(ctx.falhas, `diário: ${c.name} não tem nenhum vídeo com diário ok nas 3 últimas execuções`)
}

/**
 * Job básico de alcance ativo há 6 dias ou mais, canal que publicou nos últimos 90 dias e nenhuma linha de
 * alcance coletada nos últimos 4 dias. Canal sem publicação recente recebe relatório só com cabeçalho: não é falha.
 */
async function criterioAlcance(ctx: Ctx, c: ColetaChannel): Promise<void> {
  const criterio = `alcance de ${c.name}`
  const agora = Date.now()
  const j = await ctx.supabase
    .from('yt_reporting_jobs')
    .select('status, job_create_time, created_at')
    .eq('channel_id', c.id)
    .eq('report_type_id', TIPO_ALCANCE)
    .maybeSingle()
  if (!leituraOk(j, 'yt_reporting_jobs', criterio, ctx.falhas)) return
  const job = j.data as { status: string; job_create_time: string | null; created_at: string | null } | null
  if (!job || job.status !== 'ativo') return
  // Idade = job_create_time, ou created_at quando a API não informou (dado ausente não pode calar o alarme).
  const idade = job.job_create_time ?? job.created_at
  if (!idade || Date.parse(idade) >= agora - 6 * DIA_MS) return

  const pub = await ctx.supabase
    .from('youtube_videos')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', c.id)
    .gte('published_at', iso(agora - 90 * DIA_MS))
  const publicou = contagemOk(pub, 'youtube_videos', criterio, ctx.falhas)
  if (publicou === null || publicou === 0) return

  const linhas = await ctx.supabase
    .from('yt_own_video_reach_daily')
    .select('youtube_video_id', { count: 'exact', head: true })
    .eq('channel_id', c.id)
    .gte('collected_at', iso(agora - 4 * DIA_MS))
  const novas = contagemOk(linhas, 'yt_own_video_reach_daily', criterio, ctx.falhas)
  if (novas === 0) pushUnico(ctx.falhas, `alcance: ${c.name} está sem linha nova de alcance há mais de 4 dias`)
}

/** Relatório de alcance baixado (ou vazio) há mais de 2 dias e ainda sem normalizar: o dado está parado na fila. */
async function criterioNormalizar(ctx: Ctx): Promise<void> {
  const r = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('report_type_id', TIPO_ALCANCE)
    .in('status', ['baixado', 'vazio'])
    .is('normalized_at', null)
    .lt('downloaded_at', iso(Date.now() - 2 * DIA_MS))
  const n = contagemOk(r, 'yt_reporting_reports', 'relatórios sem normalizar', ctx.falhas)
  if (n !== null && n > 0) pushUnico(ctx.falhas, `alcance: ${n} relatório(s) baixado(s) há mais de 2 dias sem normalizar`)
}

export async function criteriosL2(ctx: Ctx): Promise<void> {
  for (const c of ctx.channels) {
    if (!c.sync_enabled) continue
    await criterioDiario(ctx, c)
    await criterioAlcance(ctx, c)
  }
  await criterioNormalizar(ctx)
}
