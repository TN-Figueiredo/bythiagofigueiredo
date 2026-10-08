// Critérios de falha crítica da seção 9 do spec que valem no lote L1a e não cabem dentro de um passo.
// Tudo que entra em falhas[] deixa o /api/health degradado; o que não tem conserto vira `perdidos`;
// o que só o dono resolve vira `acao_do_dono` (nunca falha).
//
// REGRA DESTE ARQUIVO: este sistema falha em verde. Um critério cuja leitura falhou NÃO avalia como
// "nada de errado": toda leitura passa por `conferirBanco` e, se falhar, entra em falhas[] uma nota
// própria "critérios: não foi possível avaliar <critério>". Verde só aparece quando a leitura deu certo e
// o dado realmente não tem o problema (ou quando a ausência do dado é o estado saudável, dito no lugar).
import { REACH_TYPES } from '@/lib/youtube/reporting/types'
import { scopeJob } from './attempts'
import { addDays, boundsAnalytics, utcDay } from './day-pt'
import { conferirBanco, pushUnico } from './schema'
import type { AttemptKind, StepCtx } from './types'

const DIA_MS = 86_400_000
const ALCANCE: readonly string[] = REACH_TYPES
/** O PostgREST corta em 1000 linhas: bater nesse número é leitura truncada, nunca "tudo lido". */
const LIMITE_LEITURA = 1000
const ORCAMENTO = 'nao_alcancado_orcamento'
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

export interface CriteriosRelatorios {
  /** `erro` (alcance) ou `expirado_sem_baixar` com create_time anterior a 14 dias: sem conserto, fora de falhas[]. */
  perdidos: number
  /** `listado` com create_time anterior a 14 dias. */
  atrasados: number
  /** Jobs em `sem_acesso`, `api_nao_ativada`, `tipo_indisponivel`: só o dono resolve, nunca vão para falhas[]. */
  acao_do_dono?: string[]
}

interface Recente {
  report_id: string
  channel_id: string
  report_type_id: string
  status: string
  create_time: string
}

interface JobLinha {
  channel_id: string
  report_type_id: string
  status: string
  job_create_time: string | null
  /** not null no banco: a idade de reserva quando a API não informou job_create_time. */
  created_at: string | null
}

const ESTADOS_DO_DONO: readonly string[] = ['sem_acesso', 'api_nao_ativada', 'tipo_indisponivel']

export async function criteriosRelatorios(ctx: Ctx): Promise<CriteriosRelatorios> {
  const out: CriteriosRelatorios = { perdidos: 0, atrasados: 0, acao_do_dono: [] }
  const agora = Date.now()
  const corte14 = iso(agora - 14 * DIA_MS)
  const corte6 = agora - 6 * DIA_MS
  const nome = (id: string): string => ctx.channels.find(c => c.id === id)?.name ?? id

  // Relatórios de ALCANCE dos últimos 14 dias, do mais novo para o mais velho (2 tipos por canal: cabe em 1000
  // com dezenas de canais; ler os 4 tipos estouraria o corte nas primeiras semanas). Não depende de haver job ativo.
  const rec = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, channel_id, report_type_id, status, create_time')
    .in('report_type_id', [...ALCANCE])
    .gte('create_time', corte14)
    .order('create_time', { ascending: false })
    .limit(LIMITE_LEITURA)
  let recentes: Recente[] | null = null
  if (leituraOk(rec, 'yt_reporting_reports', 'relatórios com problema', ctx.falhas)) {
    recentes = (rec.data ?? []) as Recente[]
    // Truncada: os mais velhos podem ter ficado de fora (ordem decrescente), então não se pode afirmar "verde".
    if (recentes.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `relatórios com problema (yt_reporting_reports): leitura cortada em ${LIMITE_LEITURA}`)
    }
    const porJob = new Map<string, Recente[]>()
    for (const r of recentes) {
      if (r.status === 'erro') {
        pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório de alcance ${r.report_type_id} em erro`)
      }
      const chave = `${r.channel_id}|${r.report_type_id}`
      porJob.set(chave, [...(porJob.get(chave) ?? []), r])
    }
    for (const lista of porJob.values()) {
      const ultimos = lista.slice(0, 4)
      if (ultimos.length === 4 && ultimos.every(r => r.status === 'vazio')) {
        const r = ultimos[0]!
        pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} recebeu 4 relatórios ${r.report_type_id} vazios seguidos`)
      }
    }
  }

  // Expirado sem baixar, de qualquer tipo, nos últimos 14 dias: leitura própria, por status (poucas linhas).
  const exp = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, channel_id, report_type_id, status, create_time')
    .eq('status', 'expirado_sem_baixar')
    .gte('create_time', corte14)
    .limit(LIMITE_LEITURA)
  if (leituraOk(exp, 'yt_reporting_reports', 'relatórios expirados sem baixar', ctx.falhas)) {
    const lidos = (exp.data ?? []) as Recente[]
    if (lidos.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `relatórios expirados sem baixar (yt_reporting_reports): leitura cortada em ${LIMITE_LEITURA}`)
    }
    for (const r of lidos) {
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório ${r.report_type_id} expirado sem baixar`)
    }
  }

  // Listado há mais de 14 dias: tem conserto (baixar), então é falha enquanto durar.
  const atras = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'listado')
    .lt('create_time', corte14)
  if (leituraOk(atras, 'yt_reporting_reports', 'relatórios listados há mais de 14 dias', ctx.falhas)) {
    if (atras.count === null || atras.count === undefined) {
      naoAvaliou(ctx.falhas, 'relatórios listados há mais de 14 dias (yt_reporting_reports): contagem ausente')
    } else {
      out.atrasados = atras.count
      if (out.atrasados > 0) pushUnico(ctx.falhas, `relatórios: ${out.atrasados} relatório(s) listado(s) há mais de 14 dias sem baixar`)
    }
  }

  // Perdidos: sem conserto. Manter o vermelho para sempre esconderia as falhas novas.
  // Erro só conta em tipo de alcance (os outros não entram nos critérios); expirado conta em qualquer tipo.
  const perdErro = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'erro')
    .in('report_type_id', [...ALCANCE])
    .lt('create_time', corte14)
  const perdExp = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'expirado_sem_baixar')
    .lt('create_time', corte14)
  const okErro = leituraOk(perdErro, 'yt_reporting_reports', 'relatórios perdidos', ctx.falhas)
  const okExp = leituraOk(perdExp, 'yt_reporting_reports', 'relatórios perdidos', ctx.falhas)
  if (okErro && okExp) {
    if (perdErro.count == null || perdExp.count == null) {
      naoAvaliou(ctx.falhas, 'relatórios perdidos (yt_reporting_reports): contagem ausente')
    } else {
      out.perdidos = perdErro.count + perdExp.count
    }
  }

  // Jobs: uma leitura só (no máximo canais x tipos linhas) serve ao critério de 6 dias e à lista do dono.
  const jobs = await ctx.supabase
    .from('yt_reporting_jobs')
    .select('channel_id, report_type_id, status, job_create_time, created_at')
    .neq('status', 'desativado')
    .limit(LIMITE_LEITURA)
  if (!leituraOk(jobs, 'yt_reporting_jobs', 'jobs de alcance sem relatório novo', ctx.falhas)) return out
  const linhasJob = (jobs.data ?? []) as JobLinha[]
  if (linhasJob.length >= LIMITE_LEITURA) {
    naoAvaliou(ctx.falhas, `jobs de alcance sem relatório novo (yt_reporting_jobs): leitura cortada em ${LIMITE_LEITURA}`)
    return out
  }

  for (const j of linhasJob) {
    if (ESTADOS_DO_DONO.includes(j.status)) out.acao_do_dono!.push(`${nome(j.channel_id)}: ${j.report_type_id} em ${j.status}`)
  }

  // Job de alcance ativo há mais de 6 dias sem relatório novo, em canal que publicou nos últimos 90 dias.
  // Idade = job_create_time, ou created_at quando a API não informou (dado ausente não pode calar o alarme).
  const candidatos = linhasJob.filter(j => {
    if (j.status !== 'ativo' || !ALCANCE.includes(j.report_type_id)) return false
    const canal = ctx.channels.find(c => c.id === j.channel_id)
    if (!canal || !canal.sync_enabled) return false
    const idade = j.job_create_time ?? j.created_at
    return !!idade && Date.parse(idade) < corte6
  })
  if (candidatos.length > 0 && recentes === null) {
    // A leitura dos relatórios falhou lá em cima: sem ela não dá para dizer que há relatório novo.
    naoAvaliou(ctx.falhas, 'jobs de alcance sem relatório novo (yt_reporting_reports)')
    return out
  }
  const semNovo = candidatos.filter(j => !(recentes ?? []).some(r =>
    r.channel_id === j.channel_id && r.report_type_id === j.report_type_id && Date.parse(r.create_time) >= corte6))
  if (semNovo.length === 0) return out

  // Canal sem conexão hoje (token revogado): o passo de relatórios não lista, então "sem relatório novo" é
  // consequência, não parada. Vai para acao_do_dono, não para falhas. Uma leitura limitada.
  const canaisSemNovo = [...new Set(semNovo.map(j => j.channel_id))]
  const sc = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_id')
    .eq('scope_type', 'canal')
    .eq('kind', 'relatorio')
    .eq('attempt_day', utcDay(new Date()))
    .eq('outcome', 'sem_conexao')
    .in('scope_id', canaisSemNovo)
    .limit(LIMITE_LEITURA)
  if (!leituraOk(sc, 'yt_own_collection_attempts', 'jobs de alcance sem relatório novo', ctx.falhas)) return out
  const semConexao = new Set(((sc.data ?? []) as Array<{ scope_id: string }>).map(l => l.scope_id))
  for (const id of canaisSemNovo) {
    if (semConexao.has(id)) out.acao_do_dono!.push(`${nome(id)}: sem conexão com o YouTube`)
  }

  const publicou = new Map<string, boolean>() // por canal: uma leitura por canal candidato (<= nº de canais)
  for (const j of semNovo) {
    if (semConexao.has(j.channel_id)) continue
    if (!publicou.has(j.channel_id)) {
      const v = await ctx.supabase
        .from('youtube_videos')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', j.channel_id)
        .gte('published_at', iso(agora - 90 * DIA_MS))
      if (!leituraOk(v, 'youtube_videos', `vídeos recentes do canal ${nome(j.channel_id)}`, ctx.falhas)) continue
      if (v.count == null) {
        naoAvaliou(ctx.falhas, `vídeos recentes do canal ${nome(j.channel_id)} (youtube_videos): contagem ausente`)
        continue
      }
      publicou.set(j.channel_id, v.count > 0)
    }
    if (publicou.get(j.channel_id)) {
      pushUnico(ctx.falhas, `relatórios: ${nome(j.channel_id)} está sem relatório novo de ${j.report_type_id} há mais de 6 dias`)
    }
  }

  return out
}

/**
 * Dois casos, ambos pelas 3 datas MAIS RECENTES com tentativa de escopo `job` (não 3 dias de calendário):
 *  - job em `erro`: kinds sondagem e relatorio, todos os 3 dias com `erro_http` e nenhum `ok`;
 *  - job `ativo` cujo DOWNLOAD falha todo dia (kind `relatorio` com `erro_http` nos 3 dias, nenhum `ok`): o relatório
 *    fica `listado`, conta como "relatório novo" no critério dos 6 dias e esta é a única coisa que denuncia.
 * Menos de 3 dias de tentativa = ainda cedo (job novo), não é falha. Tentativa de outro resultado (sem_conexao,
 * sem_autorizacao) depende do dono e não pinta este critério. Duas leituras no total, qualquer que seja o número de jobs.
 */
export async function criterioJobsEmErro(ctx: Ctx): Promise<void> {
  const r = await ctx.supabase.from('yt_reporting_jobs').select('channel_id, report_type_id, status').in('status', ['erro', 'ativo']).limit(LIMITE_LEITURA)
  if (!leituraOk(r, 'yt_reporting_jobs', 'jobs em erro', ctx.falhas)) return
  const jobs = (r.data ?? []) as Array<{ channel_id: string; report_type_id: string; status: string }>
  if (jobs.length >= LIMITE_LEITURA) {
    naoAvaliou(ctx.falhas, `jobs em erro (yt_reporting_jobs): leitura cortada em ${LIMITE_LEITURA}`)
    return
  }
  if (jobs.length === 0) return // nenhum job ativo nem em erro: nada a olhar

  // Janela de 10 dias: cobre 3 dias de tentativa com folga e mantém a leitura abaixo do corte de 1000 linhas
  // (por job: no máximo 2 kinds x 10 dias).
  const desde = addDays(utcDay(new Date()), -10)
  const t = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_id, kind, attempt_day, outcome, error')
    .eq('scope_type', 'job')
    .in('scope_id', jobs.map(j => scopeJob(j.channel_id, j.report_type_id)))
    .in('kind', ['sondagem', 'relatorio'])
    .gte('attempt_day', desde)
    .order('attempt_day', { ascending: false })
    .limit(LIMITE_LEITURA)
  if (!leituraOk(t, 'yt_own_collection_attempts', 'jobs em erro', ctx.falhas)) return
  const linhas = (t.data ?? []) as Array<{ scope_id: string; kind: string; attempt_day: string; outcome: string; error: string | null }>
  if (linhas.length >= LIMITE_LEITURA) {
    naoAvaliou(ctx.falhas, `jobs em erro (yt_own_collection_attempts): leitura cortada em ${LIMITE_LEITURA}`)
    return
  }

  for (const j of jobs) {
    const escopo = scopeJob(j.channel_id, j.report_type_id)
    const kinds = j.status === 'erro' ? ['sondagem', 'relatorio'] : ['relatorio']
    // dia -> { http, ok, erro }; a ordem de inserção é a do dia decrescente.
    const dias = new Map<string, { http: boolean; ok: boolean; erro: string | null }>()
    for (const l of linhas) {
      if (l.scope_id !== escopo || !kinds.includes(l.kind)) continue
      const d = dias.get(l.attempt_day) ?? { http: false, ok: false, erro: null }
      if (l.outcome === 'erro_http') { d.http = true; d.erro ??= l.error }
      if (l.outcome === 'ok') d.ok = true
      dias.set(l.attempt_day, d)
    }
    const tres = [...dias.values()].slice(0, 3)
    if (tres.length === 3 && tres.every(d => d.http && !d.ok)) {
      const nome = ctx.channels.find(c => c.id === j.channel_id)?.name ?? j.channel_id
      if (j.status === 'erro') {
        pushUnico(ctx.falhas, `jobs: ${nome} está com o job ${j.report_type_id} em erro há 3 dias`)
      } else {
        pushUnico(ctx.falhas, `jobs: ${nome} não consegue baixar o relatório ${j.report_type_id} há 3 dias (último erro: ${tres[0]!.erro ?? 'sem texto'})`)
      }
    }
  }
}

/**
 * O mesmo escopo e kind com `nao_alcancado_orcamento` nas 3 últimas tentativas REGISTRADAS (não 3 dias de calendário).
 * LIMITE DE LEITURAS: por kind, 1 leitura das faltas dos últimos 14 dias + 1 leitura de verificação por bloco de
 * 100 escopos candidatos (só roda se houver candidato). Candidatos nunca passam de 1000 (corte da primeira leitura),
 * então o teto é kinds x (1 + 10); no caso normal é kinds x 2. Nunca uma leitura por escopo.
 * Fora de L1a: a exceção da retenção com relatório `listado` por baixar (kind `retencao_vida`, L3).
 */
export async function criterioOrcamento(ctx: Pick<StepCtx, 'supabase' | 'falhas'>, kinds: readonly AttemptKind[]): Promise<void> {
  const hoje = utcDay(new Date())
  const desde = addDays(hoje, -14)
  const BLOCO = 100
  for (const kind of kinds) {
    const criterio = `orçamento de ${kind}`
    const faltas = await ctx.supabase
      .from('yt_own_collection_attempts')
      .select('scope_type, scope_id, attempt_day')
      .eq('kind', kind)
      .eq('outcome', ORCAMENTO)
      .gte('attempt_day', desde)
      .order('attempt_day', { ascending: false })
      .limit(LIMITE_LEITURA)
    if (!leituraOk(faltas, 'yt_own_collection_attempts', criterio, ctx.falhas)) continue
    const linhas = (faltas.data ?? []) as Array<{ scope_type: string; scope_id: string; attempt_day: string }>
    if (linhas.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `${criterio} (yt_own_collection_attempts): leitura cortada em ${LIMITE_LEITURA}`)
      continue
    }

    // Exigir falta HOJE é deliberado: um escopo que deixou de ser tentado (vídeo apagado, canal desligado) não
    // alarma para sempre; se o passo nem rodou hoje, quem avisa é o próprio cron.
    // Por escopo: dias de falta (decrescente). Candidato = faltou hoje e tem 3 ou mais faltas.
    const porEscopo = new Map<string, { id: string; dias: string[] }>()
    for (const l of linhas) {
      const chave = `${l.scope_type}|${l.scope_id}`
      const e = porEscopo.get(chave) ?? { id: l.scope_id, dias: [] }
      e.dias.push(l.attempt_day)
      porEscopo.set(chave, e)
    }
    const candidatos = [...porEscopo.entries()]
      .filter(([, e]) => e.dias.length >= 3 && e.dias[0] === hoje)
      .map(([chave, e]) => ({ chave, id: e.id, terceiro: e.dias[2]! }))
    if (candidatos.length === 0) continue // ninguém com 3 faltas e falta hoje: o estado saudável

    // As 3 últimas tentativas são todas faltas <=> não existe tentativa de outro resultado depois do 3º dia de falta.
    const menor = candidatos.reduce((m, c) => (c.terceiro < m ? c.terceiro : m), candidatos[0]!.terceiro)
    const comOutro = new Set<string>()
    let leituraBoa = true
    for (let i = 0; i < candidatos.length && leituraBoa; i += BLOCO) {
      const bloco = candidatos.slice(i, i + BLOCO)
      const outros = await ctx.supabase
        .from('yt_own_collection_attempts')
        .select('scope_type, scope_id, attempt_day')
        .eq('kind', kind)
        .gt('attempt_day', menor)
        .neq('outcome', ORCAMENTO)
        .in('scope_id', bloco.map(c => c.id))
        .limit(LIMITE_LEITURA)
      if (!leituraOk(outros, 'yt_own_collection_attempts', criterio, ctx.falhas)) { leituraBoa = false; break }
      const achados = (outros.data ?? []) as Array<{ scope_type: string; scope_id: string; attempt_day: string }>
      if (achados.length >= LIMITE_LEITURA) {
        naoAvaliou(ctx.falhas, `${criterio} (yt_own_collection_attempts): leitura cortada em ${LIMITE_LEITURA}`)
        leituraBoa = false
        break
      }
      for (const a of achados) {
        const c = bloco.find(x => x.chave === `${a.scope_type}|${a.scope_id}`)
        if (c && a.attempt_day > c.terceiro) comOutro.add(c.chave)
      }
    }
    if (!leituraBoa) continue
    const n = candidatos.filter(c => !comOutro.has(c.chave)).length
    if (n > 0) pushUnico(ctx.falhas, `orçamento: ${n} escopo(s) de ${kind} sem alcançar nas 3 últimas tentativas`)
  }
}

export interface CriteriosMetadados {
  /** Nomes dos canais cujo `dias_sem_meta` é desconhecido (a leitura do passo falhou): nunca contado como 0. */
  desconhecido: string[]
}

/**
 * Critérios de metadados da seção 9 a partir do resultado do passo (`day_pt`, `dias_sem_meta`).
 * Os textos são idênticos aos do próprio passo: se os dois rodarem, `pushUnico` não duplica a nota.
 * Leituras: 3 fixas + 1 contagem por canal (<= nº de canais).
 */
export async function criterioMetadados(
  ctx: Ctx,
  meta: { day_pt: string; dias_sem_meta: Record<string, number> },
): Promise<CriteriosMetadados> {
  const out: CriteriosMetadados = { desconhecido: [] }
  const dia = meta.day_pt

  for (const c of ctx.channels) {
    const dias = meta.dias_sem_meta[c.id]
    if (dias === undefined) { out.desconhecido.push(c.name); continue } // chave ausente = leitura falhou, não é 0
    if (dias > 0) pushUnico(ctx.falhas, `metadados: ${c.name} ficou ${dias} dia(s) sem linha antes de ${dia}`)
  }
  if (ctx.channels.length === 0) return out

  const CRITERIO = 'vídeos com linha de metadados'
  const ids = ctx.channels.map(c => c.id)
  const vids = await ctx.supabase
    .from('youtube_videos')
    .select('youtube_video_id, channel_id')
    .in('channel_id', ids)
    .lt('published_at', iso(boundsAnalytics(dia).end))
    .limit(LIMITE_LEITURA)
  if (!leituraOk(vids, 'youtube_videos', CRITERIO, ctx.falhas)) return out
  const videos = (vids.data ?? []) as Array<{ youtube_video_id: string; channel_id: string }>
  if (videos.length >= LIMITE_LEITURA) {
    naoAvaliou(ctx.falhas, `${CRITERIO} (youtube_videos): leitura cortada em ${LIMITE_LEITURA}`)
    return out
  }
  if (videos.length === 0) return out // canais sem vídeo ficam fora dos critérios por vídeo

  // Não alcançados no orçamento HOJE (attempt_day UTC): saem da conta e caem na regra das 3 tentativas.
  const faltas = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_type, scope_id')
    .eq('kind', 'meta')
    .eq('outcome', ORCAMENTO)
    .eq('attempt_day', utcDay(new Date()))
    .limit(LIMITE_LEITURA)
  if (!leituraOk(faltas, 'yt_own_collection_attempts', CRITERIO, ctx.falhas)) return out
  const linhasFalta = (faltas.data ?? []) as Array<{ scope_type: string; scope_id: string }>
  if (linhasFalta.length >= LIMITE_LEITURA) {
    naoAvaliou(ctx.falhas, `${CRITERIO} (yt_own_collection_attempts): leitura cortada em ${LIMITE_LEITURA}`)
    return out
  }
  const videoFaltou = new Set(linhasFalta.filter(l => l.scope_type === 'video').map(l => l.scope_id))
  const canalFaltou = new Set(linhasFalta.filter(l => l.scope_type === 'canal').map(l => l.scope_id))

  for (const c of ctx.channels) {
    if (canalFaltou.has(c.id)) continue // o passo ficou sem tempo para o canal inteiro
    const esperados = videos.filter(v => v.channel_id === c.id && !videoFaltou.has(v.youtube_video_id)).length
    if (esperados === 0) continue
    const cont = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('youtube_video_id', { count: 'exact', head: true })
      .eq('channel_id', c.id)
      .eq('day_pt', dia)
    if (!leituraOk(cont, 'yt_own_video_meta_daily', CRITERIO, ctx.falhas)) continue
    const comLinha = cont.count ?? 0
    if (comLinha < esperados) pushUnico(ctx.falhas, `metadados: ${c.name} tem ${comLinha} de ${esperados} vídeos com linha em ${dia}`)
  }
  return out
}
