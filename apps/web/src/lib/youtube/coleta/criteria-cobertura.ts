// A5 · E6: critério de cobertura do diário (o alarme da dieta). Depois da dieta o diário guarda só os dias com atividade; quem
// diz "este vídeo foi coletado até tal dia" é `yt_own_video_coverage`. Se a cobertura de um vídeo para, o diário parou de olhar
// para ele, e isso não aparece em nenhuma linha. Este critério LÊ e faz o cron ficar vermelho.
//
// REGRA DESTE ARQUIVO (a mesma de criteria.ts e criteria-l2.ts): leitura que falha, tempo que acaba ou dado de forma estranha
// NUNCA vira "nada de errado": vira `critérios: não foi possível avaliar cobertura de <canal> (…)` em `falhas`. Verde só aparece
// quando a leitura veio inteira. Cobertura VAZIA (nenhum vídeo coberto) não é erro e não é "primeiro dia": todo vídeo elegível
// fica atrasado, e o cron fica vermelho até o diário cobrir. Nenhuma nota leva texto do Postgres.
import type { SupabaseClient } from '@supabase/supabase-js'
import { comPrazo, prazoDoCriterio, restante, type Relogio } from './clock'
import { addDays, dayPt, diffDias, utcDay, type DiaPt } from './day-pt'
import { lerCoberturaBase } from './cobertura'
import { ATRASO, separarPermanentes, youtubeNaoDevolveu, type Atrasado } from './atraso-permanente'
import { lerPaginado } from './paginar'
import { ehSchemaAusente, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel } from './types'

/** Prazo total do critério (todos os canais, todas as leituras). */
export const PRAZO_DO_CRITERIO_MS = 3_000
/** Vídeo publicado há 5 dias ou mais já deveria ter cobertura. */
export const DIAS_ATE_SER_ELEGIVEL = 5
/** Teto de vídeos lidos por canal; passou disso, o critério não avalia. */
const TETO_VIDEOS = 1000
/** Linhas de tentativa lidas por pedido: 200 vídeos × 4 dias = 800, abaixo do corte de 1.000 do PostgREST. */
const IDS_POR_LEITURA = 200
const TETO_TENTATIVAS = 1000
/** Quantos ids aparecem em cada nota. */
const IDS_NA_NOTA = 5

const T_VIDEOS = 'youtube_videos'
const T_COBERTURA = 'yt_own_video_coverage'
const T_TENTATIVAS = 'yt_own_collection_attempts'
const T_META = 'yt_own_video_meta_daily'

export type CriterioCoberturaCtx = {
  supabase: SupabaseClient
  channels: ColetaChannel[]
  falhas: string[]
  relogio: Relogio
}

export interface VideoDaCobertura {
  ytId: string
  publicadoEm: string
}

export interface AtrasadoDaCobertura {
  ytId: string
  /** Último dia coberto; null = nunca coberto. */
  ate: DiaPt | null
  diasAtrasado: number
}

const ddmm = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

/**
 * Pura. Elegível = publicado há 5 dias ou mais (no dia do Pacífico). Atrasado = elegível e (sem cobertura ou com `ate < hoje − 5`).
 * `diasAtrasado` = `(hoje − 6) − ate` com cobertura (0 no primeiro dia de atraso), ou `idade − 5` sem cobertura.
 * `publicadoEm` ilegível lança (quem chama valida antes: vídeo de data ilegível não pode virar "não elegível" em silêncio).
 */
export function atrasadosDaCobertura(
  videos: readonly VideoDaCobertura[],
  cobertura: ReadonlyMap<string, DiaPt>,
  hoje: DiaPt,
): { elegiveis: number; atrasados: AtrasadoDaCobertura[] } {
  const limite = addDays(hoje, -DIAS_ATE_SER_ELEGIVEL)
  let elegiveis = 0
  const atrasados: AtrasadoDaCobertura[] = []
  for (const v of videos) {
    const t = Date.parse(v.publicadoEm)
    if (Number.isNaN(t)) throw new RangeError(`publicadoEm ilegível: ${v.ytId}`)
    const idade = diffDias(dayPt(new Date(t)), hoje)
    if (idade < DIAS_ATE_SER_ELEGIVEL) continue
    elegiveis++
    const ate = cobertura.get(v.ytId) ?? null
    if (ate === null) {
      atrasados.push({ ytId: v.ytId, ate: null, diasAtrasado: idade - DIAS_ATE_SER_ELEGIVEL })
    } else if (ate < limite) {
      atrasados.push({ ytId: v.ytId, ate, diasAtrasado: diffDias(ate, addDays(hoje, -(DIAS_ATE_SER_ELEGIVEL + 1))) })
    }
  }
  return { elegiveis, atrasados }
}

const naoAvaliou = (falhas: string[], canal: string, motivo: string): void =>
  pushUnico(falhas, `critérios: não foi possível avaliar cobertura de ${canal} (${motivo})`)

/** Registra a falha de leitura de uma tabela (schema ausente ou erro de banco) sem o texto do Postgres. */
function notaDeLeitura(falhas: string[], tabela: string, erro: ErroBanco | null): void {
  pushUnico(falhas, ehSchemaAusente(erro) ? `schema_ausente: ${tabela}` : `erro de banco ao ler ${tabela}`)
}

type Atrasada = AtrasadoDaCobertura & Atrasado

const SITUACAO: Record<string, string> = { public: 'público', unlisted: 'não listado', private: 'privado' }

/** Lê `privacy_status` do dia mais recente do vídeo. Qualquer falha ou prazo vencido vira "desconhecida". */
async function situacaoDoVideo(supabase: SupabaseClient, canalId: string, ytId: string, prazo: number): Promise<string> {
  if (restante(prazo) <= 0) return 'desconhecida'
  try {
    const res = await comPrazo(
      Promise.resolve(
        supabase.from(T_META).select('privacy_status')
          .eq('channel_id', canalId).eq('youtube_video_id', ytId)
          .order('day_pt', { ascending: false }).limit(1),
      ),
      prazo,
    )
    if (res === null || res.error || !Array.isArray(res.data) || res.data.length === 0) return 'desconhecida'
    const p = (res.data[0] as { privacy_status?: unknown }).privacy_status
    return (typeof p === 'string' && SITUACAO[p]) || 'desconhecida'
  } catch {
    return 'desconhecida'
  }
}

type LeituraDeTentativas =
  | { ok: true; falhas: Map<string, number> }
  | { ok: false; motivo: 'tempo' | 'erro' }

/** Para cada vídeo, em quantos dos 4 últimos dias UTC o diário terminou com o YouTube NÃO devolvendo o vídeo. */
async function lerFalhasDoDiario(
  ctx: CriterioCoberturaCtx,
  canal: ColetaChannel,
  ids: readonly string[],
  hojeUtc: string,
  prazo: number,
): Promise<LeituraDeTentativas> {
  const dias = new Map<string, Set<string>>()
  for (let i = 0; i < ids.length; i += IDS_POR_LEITURA) {
    if (restante(prazo) <= 0) return { ok: false, motivo: 'tempo' }
    let res: { data: unknown; error: ErroBanco | null } | null
    try {
      res = await comPrazo(
        Promise.resolve(
          ctx.supabase.from(T_TENTATIVAS)
            .select('scope_id, attempt_day, outcome, http_status, error')
            .eq('site_id', canal.site_id)
            .eq('scope_type', 'video')
            .eq('kind', 'diario')
            .in('scope_id', ids.slice(i, i + IDS_POR_LEITURA))
            // Janela de 4 dias UTC COM teto: o dia da tentativa é o relógio do banco; sem o teto, uma execução que cruza a
            // meia-noite UTC traria 5 dias (a mesma janela de `yt_own_retention_facts`).
            .gte('attempt_day', addDays(hojeUtc, -(ATRASO.diasDeTentativa - 1)))
            .lte('attempt_day', hojeUtc),
        ),
        prazo,
      )
    } catch {
      notaDeLeitura(ctx.falhas, T_TENTATIVAS, null)
      return { ok: false, motivo: 'erro' }
    }
    if (res === null) return { ok: false, motivo: 'tempo' }
    if (res.error) {
      notaDeLeitura(ctx.falhas, T_TENTATIVAS, res.error)
      return { ok: false, motivo: 'erro' }
    }
    if (!Array.isArray(res.data) || res.data.length >= TETO_TENTATIVAS) {
      notaDeLeitura(ctx.falhas, T_TENTATIVAS, null)
      return { ok: false, motivo: 'erro' }
    }
    for (const l of res.data as Array<Record<string, unknown>>) {
      const { scope_id: id, attempt_day: dia, outcome, http_status: st, error } = l
      if (typeof id !== 'string' || typeof dia !== 'string' || typeof outcome !== 'string') {
        notaDeLeitura(ctx.falhas, T_TENTATIVAS, null)
        return { ok: false, motivo: 'erro' }
      }
      const nao = youtubeNaoDevolveu({
        outcome,
        http_status: typeof st === 'number' ? st : null,
        error: typeof error === 'string' ? error : null,
      })
      if (!nao) continue
      const set = dias.get(id) ?? new Set<string>()
      set.add(dia)
      dias.set(id, set)
    }
  }
  return { ok: true, falhas: new Map(ids.map(id => [id, dias.get(id)?.size ?? 0])) }
}

function notaDeVermelho(
  canal: string,
  vermelho: readonly Atrasada[],
  elegiveis: number,
  hoje: DiaPt,
  pane: boolean,
): string {
  const itens = vermelho.slice(0, IDS_NA_NOTA).map(a => `${a.ytId} (${a.ate === null ? 'nunca coberto' : `coberto até ${ddmm(a.ate)}`})`)
  const resto = vermelho.length - itens.length
  const lista = resto > 0 ? `${itens.join(', ')}, e mais ${resto}` : itens.join(', ')
  const fim = pane ? '; metade ou mais do canal: é pane da coleta, não dos vídeos' : ''
  return `diário: ${canal}: ${vermelho.length} de ${elegiveis} vídeos sem cobertura até ${ddmm(addDays(hoje, -DIAS_ATE_SER_ELEGIVEL))} (${lista})${fim}`
}

/**
 * Para cada canal ligado e em `ok`: vídeo elegível sem cobertura em dia deixa o cron vermelho (nota em `falhas`, com os ids). O vídeo
 * que o YouTube comprovadamente não devolve (3+ dias de atraso e 4 de 4 dias de tentativa sem resposta do YouTube) sai do vermelho
 * e volta na lista devolvida (a integração a põe em `resumo.acao_do_dono`); metade ou mais do canal nessa situação é pane e fica vermelho.
 * Prazo total de 3 s (`prazoDoCriterio`); vencido, `… (sem tempo)` por canal e nenhuma nota de atraso.
 */
export async function criterioCobertura(ctx: CriterioCoberturaCtx): Promise<{ acaoDoDono: string[] }> {
  const acaoDoDono: string[] = []
  const canais = ctx.channels.filter(c => c.sync_enabled && c.collection_status === 'ok')
  if (canais.length === 0) return { acaoDoDono }

  const agora = new Date()
  const hoje = dayPt(agora)
  const hojeUtc = utcDay(agora)
  const prazo = prazoDoCriterio(ctx.relogio, PRAZO_DO_CRITERIO_MS)

  for (const c of canais) {
    const semTempo = (): void => naoAvaliou(ctx.falhas, c.name, 'sem tempo')
    if (restante(prazo) <= 0) { semTempo(); continue }

    // ── Vídeos ───────────────────────────────────────────────────────────
    let ultimoErro: ErroBanco | null = null
    let lidos: Awaited<ReturnType<typeof lerPaginado<{ youtube_video_id: unknown; published_at: unknown }>>> | null
    try {
      lidos = await comPrazo(
        lerPaginado<{ youtube_video_id: unknown; published_at: unknown }>(async (de, ate) => {
          const res = await ctx.supabase.from(T_VIDEOS)
            .select('youtube_video_id, published_at')
            .eq('channel_id', c.id)
            .not('published_at', 'is', null)
            .order('youtube_video_id', { ascending: true })
            .range(de, ate)
          ultimoErro = res.error ?? ultimoErro
          return { data: res.data as Array<{ youtube_video_id: unknown; published_at: unknown }> | null, error: res.error }
        }, TETO_VIDEOS),
        prazo,
      )
    } catch {
      lidos = { ok: false, motivo: 'erro_de_banco', lidas: 0 }
    }
    if (lidos === null) { semTempo(); continue }
    if (!lidos.ok) {
      if (lidos.motivo === 'passou_do_teto') {
        naoAvaliou(ctx.falhas, c.name, `mais de ${TETO_VIDEOS} vídeos`)
      } else {
        notaDeLeitura(ctx.falhas, T_VIDEOS, ultimoErro)
        naoAvaliou(ctx.falhas, c.name, T_VIDEOS)
      }
      continue
    }
    const videos: VideoDaCobertura[] = []
    let ilegivel = false
    for (const l of lidos.linhas) {
      if (typeof l.youtube_video_id !== 'string' || l.youtube_video_id === '' ||
        typeof l.published_at !== 'string' || Number.isNaN(Date.parse(l.published_at))) { ilegivel = true; break }
      videos.push({ ytId: l.youtube_video_id, publicadoEm: l.published_at })
    }
    if (ilegivel) { naoAvaliou(ctx.falhas, c.name, `${T_VIDEOS}: dado ilegível`); continue }
    if (videos.length === 0) continue

    // ── Cobertura ────────────────────────────────────────────────────────
    if (restante(prazo) <= 0) { semTempo(); continue }
    let cobertura: Awaited<ReturnType<typeof lerCoberturaBase>> | null
    try {
      cobertura = await comPrazo(lerCoberturaBase({ supabase: ctx.supabase, falhas: ctx.falhas }, c), prazo)
    } catch {
      cobertura = 'erro'
    }
    if (cobertura === null) { semTempo(); continue }
    if (cobertura === 'schema_ausente' || cobertura === 'erro') {
      // `lerCoberturaBase` não anota nesses dois casos: a nota é de quem avalia, e é vermelho.
      pushUnico(ctx.falhas, cobertura === 'schema_ausente' ? `schema_ausente: ${T_COBERTURA}` : `erro de banco ao ler ${T_COBERTURA}`)
      naoAvaliou(ctx.falhas, c.name, T_COBERTURA)
      continue
    }

    const ate = new Map<string, DiaPt>()
    for (const [id, cob] of cobertura) ate.set(id, cob.ate)
    const { elegiveis, atrasados } = atrasadosDaCobertura(videos, ate, hoje)
    if (atrasados.length === 0) continue

    // ── Fim do alarme: só quem tem 3+ dias de atraso é candidato, e só ele gasta leitura ──
    const candidatos = atrasados.filter(a => a.diasAtrasado >= ATRASO.diasDeVermelho).map(a => a.ytId)
    let falhasDoDiario: Map<string, number> | null = null
    if (candidatos.length > 0) {
      const leitura = await lerFalhasDoDiario(ctx, c, candidatos, hojeUtc, prazo)
      if (!leitura.ok && leitura.motivo === 'tempo') { semTempo(); continue }
      if (leitura.ok) falhasDoDiario = leitura.falhas
      else naoAvaliou(ctx.falhas, c.name, T_TENTATIVAS)
    }

    // Os mais atrasados primeiro: é o que o dono procura no e-mail.
    const todos: Atrasada[] = atrasados
      .map(a => ({ ...a, falhasDoDiario4d: falhasDoDiario?.get(a.ytId) ?? null }))
      .sort((a, b) => b.diasAtrasado - a.diasAtrasado || (a.ytId < b.ytId ? -1 : 1))
    const { vermelho, acaoDoDono: permanentes, pane } = separarPermanentes(todos, elegiveis)

    if (vermelho.length > 0) pushUnico(ctx.falhas, notaDeVermelho(c.name, vermelho, elegiveis, hoje, pane))
    for (let i = 0; i < permanentes.length; i++) {
      const a = permanentes[i]!
      const situacao = i < IDS_NA_NOTA ? await situacaoDoVideo(ctx.supabase, c.id, a.ytId, prazo) : 'desconhecida'
      const cobertoAte = a.ate === null ? 'nunca coberto' : `coberto até ${ddmm(a.ate)}`
      acaoDoDono.push(
        `diário: ${c.name}: o YouTube não devolve mais o vídeo ${a.ytId} (última situação conhecida: ${situacao}; ${cobertoAte}). ` +
        'Se foi apagado, tire-o da lista (runbook, seção 6)',
      )
    }
  }
  return { acaoDoDono }
}
