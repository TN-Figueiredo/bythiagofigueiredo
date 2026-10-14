// Coleta dos canais próprios — entrada única dos passos novos do cron sync-analytics-metrics.
// Ordem do spec: metadados → 1A → o que o cron já faz → 1C → alcance → diário. A parte antiga mora na rota, então a
// rota chama rodarColeta duas vezes: fase 'antes' (metadados, 1A) e fase 'depois' (1C, alcance, diário, critérios).
// Nada aqui chama recordCronSuccess/recordCronFailure: os passos só acumulam falhas[], e rodarColeta
// nunca lança — a parte antiga da rota roda de qualquer jeito.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeCronCause } from '@/lib/cron/failure-note'
import { CONFERENCIAS, DIAS_ATE_O_VERMELHO, conferenciasEmFalha, conferenciasVencidas, hojeSP } from '@/lib/conferencias'
import { registrarTentativa } from './attempts'
import { voltarAOk } from './autorizacao'
import { passoAlcance } from './alcance-step'
import { TETOS_DE_FIM_MS, TETOS_MS, restante, type Relogio } from './clock'
import { criterioJobsEmErro, criterioMetadados, criterioOrcamento, criteriosRelatorios } from './criteria'
import { criterioDesligados } from './criteria-desligados'
import { criteriosE11 } from './criteria-e11'
import { criteriosL2 } from './criteria-l2'
import { criteriosRetencao } from './criteria-retencao'
import { dayPt, ontemPt } from './day-pt'
import { passoDiario } from './diario-step'
import { passoDimensoes } from './dimensoes-step'
import { DIMENSOES_DESDE, DIMENSOES_LIGADO_EM, type ConfigE11 } from './e11-config'
import { conferirGuarda, contarBrutosAoAbrir } from './guarda'
import { passoJobs, type JobsResumo } from './jobs-step'
import { passoMetadados } from './meta-step'
import { passoNormalizadores } from './normalizadores-step'
import { notaNomesDesconhecidos, passoDesligado, type PassoComInterruptor } from './passos-desligados'
import { passoRelatorios } from './reports-step'
import { passoRetencao } from './retencao-step'
import { conferirBanco, ehSchemaAusente, pushUnico, type ErroBanco } from './schema'
import type { AttemptKind, ColetaChannel, ColetaResult, StepCtx, Tentativa } from './types'

/**
 * Desligar um dos cinco passos antigos é um commit de uma linha (runbook, "Desligar um passo ou um tipo"). Os passos novos
 * (retenção, dimensões, normalizadores) não estão aqui: o interruptor deles é a variável YT_OWN_STEPS_OFF (passos-desligados.ts).
 */
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
  /** A5 E11: datas de partida de dimensões e normalizadores. Padrão: as constantes de `e11-config.ts`. */
  e11?: ConfigE11
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
  // E20 (I2 da revisão final): os brutos são contados ANTES do passo de relatórios, para a queda ser comparada com a base
  // sem os downloads do dia no meio. Prazo próprio curto (guarda.ts); falha vira nota e a comparação usa o total do fim.
  const tAbertura = Date.now()
  let brutosAoAbrir: number | null = null
  try {
    brutosAoAbrir = await contarBrutosAoAbrir({ supabase: ctx.supabase, falhas })
  } catch (e) {
    falhou('guarda do bruto (abertura)', e)
    pushUnico(falhas, 'relatórios: brutos não contados antes do passo de relatórios; a queda de hoje foi comparada só depois dos downloads')
  }
  ms.guarda = Date.now() - tAbertura
  let relPasso: Record<string, unknown> | undefined
  if (PASSOS_LIGADOS.relatorios) {
    const r = await passo('relatorios', TETOS_MS.relatorios, 'relatorio', ativos, passoRelatorios)
    relPasso = r ? { ...r } : undefined
  }

  // E20 (MG13): a guarda do bruto é conferida em TODA execução desta fase, mesmo se o passo de relatórios não rodou (sem
  // tempo) ou lançou: por isso está aqui, fora do passo. Tem prazo próprio (guarda.ts). Falha da conferência nunca vira
  // "0 órfãos": vira nota, e o campo `guarda` fica ausente. Duas saídas de `executar` não chegam aqui, ambas já vermelhas:
  // a leitura de `youtube_channels` falha (return acima) e a rede de segurança de `rodarColeta` (executar lançou).
  const tGuarda = Date.now()
  try {
    resumo.guarda = await conferirGuarda({ supabase: ctx.supabase, falhas, brutosAoAbrir })
  } catch (e) {
    falhou('guarda do bruto', e)
    pushUnico(falhas, 'relatórios: guarda do bruto não conferida (a conferência lançou)')
  } finally {
    ms.guarda = (ms.guarda ?? 0) + (Date.now() - tGuarda)   // abertura + fim: a latência real, lida depois do envio (M-8)
  }

  // Alcance: normaliza o bruto que o passo de relatórios acabou de baixar. `servidos` vazio de propósito: sem tempo,
  // este passo NÃO registra tentativa — uma `nao_alcancado_orcamento` de kind `relatorio` no canal sobrescreveria a
  // tentativa `ok` que o passo de relatórios gravou hoje. Sem tempo, o resumo sai `pendentes: 0` (são os `servidos`,
  // vazios) com `sem_tempo: true`: o `pendentes` não é o sinal. O que ficou por fazer só deixa o cron vermelho pelo
  // critério "baixado há mais de 2 dias sem normalizar", se durar.
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

  // A5 E11, depois do diário: dimensões (Analytics API; o teto da cobertura é a `base` que o diário acabou de estender) e
  // normalizadores (só banco). Os dois só gastam o que SOBRAR dos 270 s (TETOS_DE_FIM_MS, fora de TETOS_MS): sem tempo não rodam
  // e os passos de antes ficam como estavam. Dia do PACÍFICO (`dayPt`), nunca o de São Paulo de `hojeSP()`.
  const e11: ConfigE11 = ctx.e11 ?? { desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM }
  const hojePt = dayPt(new Date())
  // Passos desligados por YT_OWN_STEPS_OFF nesta execução: é a lista que `criterioDesligados` recebe.
  const desligados: PassoComInterruptor[] = []
  if (passoDesligado('dimensoes')) {
    resumo.dimensoes = { desligado: true }
    desligados.push('dimensoes')
  } else {
    const r = await passo('dimensoes', TETOS_DE_FIM_MS.dimensoes, 'dimensoes', ativos, c => passoDimensoes({ ...c, e11, hoje: hojePt }))
    if (r) resumo.dimensoes = r
  }
  // `servidos` vazio, como o alcance: o passo grava as próprias tentativas por tipo (uma `nao_alcancado_orcamento` aqui
  // sobrescreveria a `ok` que ele gravou).
  if (passoDesligado('normalizadores')) {
    resumo.normalizadores = { desligado: true }
    desligados.push('normalizadores')
  } else {
    const r = await passo('normalizadores', TETOS_DE_FIM_MS.normalizadores, 'normalizador_trafego', [], passoNormalizadores)
    if (r) resumo.normalizadores = r
  }

  if (PASSOS_LIGADOS.alcance || PASSOS_LIGADOS.diario) {
    try {
      await criteriosL2({ supabase: ctx.supabase, falhas, channels })
    } catch (e) {
      falhou('critérios do L2', e)
    }
  }

  // Critérios da E11 DEPOIS dos dois passos: a prova mede o que eles acabaram de gravar. Sem canal ligado não há site para
  // provar (o critério daria "nenhum site" vermelho para sempre). Se lançar, a nota é vermelha: nunca engolida.
  const sitesE11 = [...new Set(ativos.map(c => c.site_id))]
  if (sitesE11.length > 0) {
    try {
      const c = await criteriosE11({
        supabase: ctx.supabase, falhas, hoje: hojePt, e11, sites: sitesE11,
        desligados: { dimensoes: desligados.includes('dimensoes'), normalizadores: desligados.includes('normalizadores') },
      })
      resumo.e11 = { provas: c.provas, avaliados: c.avaliados, desligados: c.desligados }
    } catch (e) {
      falhou('critérios da E11', e)
    }
  }

  // A5 E8, depois dos critérios da E11 (ordem da seção 5 do plano): a retenção só gasta o que SOBRAR dos 270 s (TETOS_DE_FIM_MS) e o
  // critério dela roda DEPOIS, mesmo que o passo tenha lançado ou ficado sem tempo (é ele que dá a nota de "sem tempo"). Desligada
  // por YT_OWN_STEPS_OFF: nada é chamado, o critério não é avaliado, e o nome entra em `desligados`. As notas de vídeo que o YouTube
  // não devolve são `acao_do_dono` (nunca `falhas`: o vermelho delas é o do passo, depois de dias).
  if (passoDesligado('retencao')) {
    resumo.retencao = { desligado: true }
    desligados.push('retencao')
  } else {
    const r = await passo('retencao', TETOS_DE_FIM_MS.retencao, 'retencao_vida', ativos, passoRetencao)
    if (r) resumo.retencao = r
    try {
      await criteriosRetencao({ supabase: ctx.supabase, channels, falhas, relogio: ctx.relogio })
    } catch (e) {
      falhou('critérios da retenção', e)
    }
    const semResposta = (r as { sem_resposta_do_youtube?: unknown } | undefined)?.sem_resposta_do_youtube
    const notasRetencao = Array.isArray(semResposta) ? semResposta.filter((n): n is string => typeof n === 'string') : []
    if (notasRetencao.length > 0) resumo.acao_do_dono = [...new Set([...((resumo.acao_do_dono as string[] | undefined) ?? []), ...notasRetencao])]
  }

  // Passo desligado nunca some: até a 7ª execução seguida é nota em `acao_do_dono`; da 8ª em diante o critério põe o vermelho.
  const nomesRuins = notaNomesDesconhecidos()
  if (nomesRuins) pushUnico(falhas, nomesRuins)
  try {
    const notas = await criterioDesligados({ supabase: ctx.supabase, falhas, relogio: ctx.relogio }, desligados)
    if (notas.length > 0) resumo.acao_do_dono = [...new Set([...((resumo.acao_do_dono as string[] | undefined) ?? []), ...notas])]
  } catch (e) {
    falhou('critérios de passos desligados', e)
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
    await criterioOrcamento({ supabase: ctx.supabase, falhas }, ['meta', 'thumbnail', 'sondagem', 'relatorio', 'diario', 'dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim', 'retencao_vida', 'retencao_7d', 'retencao_30d'])
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
  // Item 246: conferência com data vencida e sem `feitaEm` aparece em toda execução, com o nome. Até 7 dias de atraso fica só
  // no resumo; com 8 dias ou mais entra em `falhas` e o cron fica vermelho, até alguém preencher `feitaEm` (decisão do
  // controlador, 12/10/2026). Lista vazia = nenhuma vencida; campo ausente = não avaliado (a fase 'antes', ou uma das saídas antecipadas
  // de `rodarColeta`, ou o bloco abaixo lançou: nesse caso há a nota 'conferências: ...'). A nota abaixo é SEMPRE a última de `falhas`
  // (um teste trava a ordem): ela mascara o aviso do vigia e as falhas reais têm de vir na frente dela.
  try {
    const hoje = hojeSP()
    resumo.conferencias_vencidas = conferenciasVencidas(hoje, CONFERENCIAS).map(c => `${c.id} (${c.etapa}, ${c.data}, ${c.responsavel})`)
    const emFalha = conferenciasEmFalha(hoje, CONFERENCIAS)
    if (emFalha.length > 0) {
      pushUnico(falhas, `conferências vencidas há mais de ${DIAS_ATE_O_VERMELHO} dias: ${emFalha.length} (${emFalha.map(c => `${c.id}, devida em ${c.data}`).join('; ')}): faça a conferência, anote no ledger e preencha feitaEm em apps/web/src/lib/conferencias.ts (runbook da coleta, seção 6, "Conferências com data")`)
    }
  } catch (e) {
    falhou('conferências', e)
  }
  // Milissegundos que a cauda gastou depois dos 270 s do relógio (a conferência `e8-tempo-real` lê isto); a rota junta toda chave
  // numérica de `resumo.ms` em `ms_passos`. Lido por último: é o fim da fase 'depois'.
  ms.cauda = Math.max(0, Date.now() - ctx.relogio.fim)
  resumo.ms = ms
  return { falhas, resumo }
}
