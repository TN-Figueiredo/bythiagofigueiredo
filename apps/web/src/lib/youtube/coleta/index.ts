// Coleta dos canais próprios — entrada única dos passos novos do cron sync-analytics-metrics.
// Ordem do spec: metadados → 1A → o que o cron já faz → 1C → alcance → diário. A parte antiga mora na rota, então a
// rota chama rodarColeta duas vezes: fase 'antes' (metadados, 1A) e fase 'depois' (1C, alcance, diário, critérios).
// Nada aqui chama recordCronSuccess/recordCronFailure: os passos só acumulam falhas[], e rodarColeta
// nunca lança — a parte antiga da rota roda de qualquer jeito.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeCronCause } from '@/lib/cron/failure-note'
import { registrarTentativa } from './attempts'
import { voltarAOk } from './autorizacao'
import { passoAlcance } from './alcance-step'
import { TETOS_MS, restante, type Relogio } from './clock'
import { criterioJobsEmErro, criterioMetadados, criterioOrcamento, criteriosRelatorios } from './criteria'
import { criteriosL2 } from './criteria-l2'
import { ontemPt } from './day-pt'
import { passoDiario } from './diario-step'
import { passoJobs, type JobsResumo } from './jobs-step'
import { passoMetadados } from './meta-step'
import { passoRelatorios } from './reports-step'
import { conferirBanco, ehSchemaAusente, pushUnico, type ErroBanco } from './schema'
import type { AttemptKind, ColetaChannel, ColetaResult, StepCtx, Tentativa } from './types'

/** Desligar um passo é um commit de uma linha (runbook, "Desligar um passo ou um tipo"). Não há variável de ambiente. */
export const PASSOS_LIGADOS = { metadados: true, jobs: true, relatorios: true, alcance: true, diario: true } as const

/** O que o passo de metadados devolve e o critério de metadados precisa (`resumo.metadados` da fase 'antes'). */
export interface MetadadosAntes {
  day_pt: string
  /** Chave ausente = desconhecido (a leitura do passo falhou), nunca zero. */
  dias_sem_meta: Record<string, number>
}

export interface ColetaCtx {
  supabase: SupabaseClient
  relogio: Relogio
  fase: 'antes' | 'depois'
  /**
   * Só na fase 'depois': o `resumo.metadados` que a fase 'antes' devolveu. Sem ele (ou se o passo
   * falhou/foi pulado), todo canal conta como "desconhecido" no critério de metadados.
   */
  metadadosAntes?: MetadadosAntes
  /**
   * `youtube_channels.id` com chamada autenticada que passou / que foi negada ANTES desta chamada, na mesma execução
   * do cron (fase 'antes' + parte antiga da rota). A fase 'depois' soma aos seus e decide quem volta a `ok`.
   */
  autorizadosAntes?: string[]
  negadosAntes?: string[]
}

export function ehMetadadosAntes(x: unknown): x is MetadadosAntes {
  if (typeof x !== 'object' || x === null) return false
  const m = x as Record<string, unknown>
  return typeof m.day_pt === 'string' && typeof m.dias_sem_meta === 'object' && m.dias_sem_meta !== null
}

/** O que o L1a lia de `youtube_channels`: existe em qualquer banco. As colunas do L1b vão por cima. */
const COLUNAS_L1A = 'id, channel_id, site_id, name, sync_enabled'
type Lidos = { data: unknown; error: ErroBanco | null }

export async function rodarColeta(ctx: ColetaCtx): Promise<ColetaResult> {
  const falhas: string[] = []
  const resumo: Record<string, unknown> = {}
  try {
    const r = await executar(ctx, falhas, resumo)
    // Os passos empurram direto em ctx.falhas: garante a regra "sem duplicatas" também para eles.
    r.falhas = [...new Set(r.falhas)]
    return r
  } catch (e) {
    // Rede de segurança: nada daqui pode derrubar a parte antiga da rota.
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'coleta' } })
    pushUnico(falhas, `coleta: ${describeCronCause(e)}`)
    return { falhas: [...new Set(falhas)], resumo }
  }
}

async function executar(ctx: ColetaCtx, falhas: string[], resumo: Record<string, unknown>): Promise<ColetaResult> {
  // Leitura própria, sem filtro: o passo de metadados cobre todos os canais; jobs e relatórios filtram
  // sync_enabled em código.
  const ler = async (colunas: string): Promise<Lidos> => {
    try {
      return await ctx.supabase.from('youtube_channels').select(colunas)
    } catch (e) {
      return { data: null, error: { code: null, message: describeCronCause(e) } }
    }
  }
  let lidos = await ler(`${COLUNAS_L1A}, collection_status, video_count`)
  // Código no ar sem a migration do L1b: as colunas novas não existem. A coleta segue com o que o L1a lia (a linha
  // de metadados do dia não volta) e a falha fica no veredito. Sem as colunas, todo canal conta como `ok`.
  let semColunasNovas = false
  if (ehSchemaAusente(lidos.error)) {
    pushUnico(falhas, 'schema_ausente: youtube_channels')
    lidos = await ler(COLUNAS_L1A)
    semColunasNovas = true
  }
  if (conferirBanco(lidos, 'youtube_channels', falhas, 'ler') !== 'ok') {
    Sentry.captureMessage('sync-analytics-metrics: a coleta não leu os canais', { level: 'error', tags: { cron: 'sync-analytics-metrics' } })
    return { falhas, resumo }
  }
  const channels = ((lidos.data ?? []) as ColetaChannel[]).map(c =>
    semColunasNovas ? { ...c, collection_status: 'ok' as const, video_count: null } : c)
  const tentativas: Tentativa[] = []
  // Um par de conjuntos por chamada, o mesmo objeto para todos os passos (o spread do passo é raso).
  const autorizados = new Set<string>(ctx.autorizadosAntes ?? [])
  const negados = new Set<string>(ctx.negadosAntes ?? [])
  const base = { supabase: ctx.supabase, channels, falhas, tentativas, autorizados, negados }
  const ms: Record<string, number> = {}

  const falhou = (nome: string, e: unknown): void => {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: nome } })
    pushUnico(falhas, `${nome}: ${describeCronCause(e)}`)
  }

  /** Roda um passo com o seu teto. Sem tempo: não roda, registra `nao_alcancado_orcamento` por canal e devolve o resumo disso. */
  const passo = async <R>(
    nome: string,
    tetoMs: number,
    kind: AttemptKind,
    servidos: ColetaChannel[],
    fn: (c: StepCtx) => Promise<R>,
  ): Promise<R | Record<string, unknown> | undefined> => {
    const t0 = Date.now()
    try {
      const deadline = ctx.relogio.prazo(tetoMs)
      if (restante(deadline) <= 0) {
        for (const c of servidos) {
          await registrarTentativa(base, { site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind, outcome: 'nao_alcancado_orcamento', channel_id: c.id })
        }
        return { gravados: 0, tentativas: { nao_alcancado_orcamento: servidos.length }, pendentes: servidos.length, sem_tempo: true }
      }
      return await fn({ ...base, deadline })
    } catch (e) {
      falhou(nome, e)
      return undefined
    } finally {
      ms[nome] = Date.now() - t0
    }
  }

  /** Os passos mudam `collection_status` em memória: lido no fim de cada fase. */
  const emReautorizar = (): ColetaChannel[] => channels.filter(c => c.collection_status === 'reautorizar')

  /** O YouTube diz que o canal tem vídeos e nenhum está cadastrado: a lista de vídeos nunca sincronizou. Canal vazio de verdade (0) e desconhecido (nulo) ficam de fora. */
  const semVideosCadastrados = async (): Promise<string[]> => {
    const notas: string[] = []
    for (const c of channels) {
      if (!c.video_count || c.video_count <= 0) continue
      const cont = await ctx.supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('channel_id', c.id)
      if (conferirBanco(cont, 'youtube_videos', falhas, 'ler') !== 'ok') continue
      // Contagem ausente não é zero: sem número não há o que afirmar, e isso é falha visível (formato dos critérios).
      if (cont.count === null) {
        pushUnico(falhas, 'critérios: não foi possível avaliar canais sem vídeos cadastrados (youtube_videos): contagem ausente')
        continue
      }
      if (cont.count === 0) notas.push(`${c.name}: o YouTube informa ${c.video_count} vídeo(s) e nenhum está cadastrado`)
    }
    return notas
  }

  const ativos = channels.filter(c => c.sync_enabled)

  if (ctx.fase === 'antes') {
    if (PASSOS_LIGADOS.metadados) {
      const r = await passo('metadados', TETOS_MS.metadados, 'meta', channels, passoMetadados)
      if (r) resumo.metadados = r
    }
    if (PASSOS_LIGADOS.jobs) {
      const r = await passo('jobs', TETOS_MS.jobs, 'sondagem', ativos, passoJobs)
      if (r) resumo.jobs = r
      // O critério lê só o banco (limitado): roda mesmo que o passo tenha falhado ou ficado sem tempo.
      try {
        await criterioJobsEmErro({ supabase: ctx.supabase, falhas, channels })
      } catch (e) {
        falhou('jobs', e)
      }
    }
    let semVideos: string[] = []
    try {
      semVideos = await semVideosCadastrados()
    } catch (e) {
      falhou('canais', e)
    }
    resumo.acao_do_dono = [...new Set([
      ...((resumo.jobs as Partial<JobsResumo> | undefined)?.acao_do_dono ?? []),
      ...emReautorizar().map(c => `${c.name}: reautorizar`),
      ...semVideos,
    ])]
    resumo.reautorizar = emReautorizar().map(c => c.id)
    resumo.autorizados = [...autorizados]
    resumo.negados = [...negados]
    resumo.ms = ms
    return { falhas, resumo }
  }

  // `rel` e `resumo.relatorios` são montados depois do critério; o critério roda DEPOIS do alcance, para que um
  // cabeçalho inesperado achado hoje (relatório marcado `erro` pelo alcance) já fique vermelho hoje.
  let relPasso: Record<string, unknown> | undefined
  if (PASSOS_LIGADOS.relatorios) {
    const r = await passo('relatorios', TETOS_MS.relatorios, 'relatorio', ativos, passoRelatorios)
    relPasso = r ? { ...r } : undefined
  }

  // Alcance: normaliza o bruto que o passo de relatórios acabou de baixar. `servidos` vazio de propósito: sem tempo,
  // este passo NÃO registra tentativa — uma `nao_alcancado_orcamento` de kind `relatorio` no canal sobrescreveria a
  // tentativa `ok` que o passo de relatórios gravou hoje. O que ficou por fazer aparece em `pendentes` e, se durar,
  // no critério "baixado há mais de 2 dias sem normalizar".
  if (PASSOS_LIGADOS.alcance) {
    const r = await passo('alcance', TETOS_MS.alcance, 'relatorio', [], passoAlcance)
    if (r) resumo.alcance = r
  }

  if (PASSOS_LIGADOS.relatorios) {
    let rel = relPasso
    try {
      const c = await criteriosRelatorios({ supabase: ctx.supabase, falhas, channels })
      rel = { ...(rel ?? {}), perdidos: c.perdidos, atrasados: c.atrasados }
      resumo.perdidos = c.perdidos
      resumo.atrasados = c.atrasados
      // Sempre presente: lista vazia = o critério rodou e nenhum canal está nessa situação.
      resumo.vazios_sem_publicacao = c.vazios_sem_publicacao ?? []
      if (c.acao_do_dono) resumo.acao_do_dono = c.acao_do_dono
    } catch (e) {
      falhou('relatorios', e)
    }
    if (rel) resumo.relatorios = rel
  }

  if (PASSOS_LIGADOS.diario) {
    const r = await passo('diario', TETOS_MS.diario, 'diario', ativos, passoDiario)
    if (r) resumo.diario = r
  }
  if (PASSOS_LIGADOS.alcance || PASSOS_LIGADOS.diario) {
    try {
      await criteriosL2({ supabase: ctx.supabase, falhas, channels })
    } catch (e) {
      falhou('critérios do L2', e)
    }
  }

  if (PASSOS_LIGADOS.metadados) {
    // Sem o resultado do 'antes', o dia é o de ontem no Pacífico e dias_sem_meta vai vazio: todo canal "desconhecido".
    const meta: MetadadosAntes = ehMetadadosAntes(ctx.metadadosAntes)
      ? ctx.metadadosAntes
      : { day_pt: ontemPt(new Date()), dias_sem_meta: {} }
    try {
      const m = await criterioMetadados({ supabase: ctx.supabase, falhas, channels }, meta)
      resumo.desconhecido = m.desconhecido
    } catch (e) {
      falhou('metadados', e)
    }
  }

  try {
    await criterioOrcamento({ supabase: ctx.supabase, falhas }, ['meta', 'thumbnail', 'sondagem', 'relatorio', 'diario'])
  } catch (e) {
    falhou('orçamento', e)
  }
  // A volta a `ok` acontece UMA vez, aqui, no fim da execução: o canal precisa de uma chamada autenticada que passou
  // (fase 'antes', parte antiga ou esta fase) e de NENHUMA negada. Decidir a cada chamada fazia o canal ser marcado e
  // desmarcado no mesmo dia. Esta fase releu os canais: enxerga o que a parte antiga da rota marcou.
  for (const c of channels) {
    if (c.collection_status !== 'reautorizar' || !autorizados.has(c.id) || negados.has(c.id)) continue
    try {
      await voltarAOk(base, c)
    } catch (e) {
      falhou('canais', e)
    }
  }
  resumo.autorizados = [...autorizados]
  resumo.negados = [...negados]
  resumo.acao_do_dono = [...new Set([
    ...((resumo.acao_do_dono as string[] | undefined) ?? []),
    ...emReautorizar().map(c => `${c.name}: reautorizar`),
  ])]
  resumo.reautorizar = emReautorizar().map(c => c.id)
  resumo.ms = ms
  return { falhas, resumo }
}
