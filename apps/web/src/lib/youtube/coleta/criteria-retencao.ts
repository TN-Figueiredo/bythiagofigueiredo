// A5 · E8: critério da retenção (o alarme da curva). O passo "retenção" serve quem vence aos 7 dias e roda todo dia; quem ainda está
// vencido aos 8 DEPOIS de o passo rodar é o que o passo deixou de fazer. Este critério LÊ os fatos (`yt_own_retention_facts`, a mesma
// função do passo) e deixa o cron vermelho.
//
// REGRA DESTE ARQUIVO (a mesma de criteria.ts, criteria-cobertura.ts e criteria-desligados.ts): leitura que falha, função ausente,
// tempo que acaba ou fato de forma estranha NUNCA vira "nada de errado": vira `critérios: não foi possível avaliar retenção de <canal>`
// em `falhas`. Verde só aparece quando a lista de fatos veio inteira (e, vazia, é a tabela vazia: nenhum vídeo para atrasar).
// Nenhuma nota leva texto do Postgres nem conteúdo dos fatos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { comPrazo, prazoDoCriterio, restante, type Relogio } from './clock'
import { addDays, dayPt, diffDias, utcDay, type DiaPt } from './day-pt'
import { lerFatos, RETENCAO, type FatoRetencao } from './retencao-regra'
import { conferirBanco, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel } from './types'

/** Prazo total do critério (todos os canais). */
export const PRAZO_DO_CRITERIO_MS = 3_000
/** Quantos ids aparecem em cada nota. */
const IDS_NA_NOTA = 5
const FUNCAO = 'yt_own_retention_facts'

/** O alarme sobe aos 8 dias: um a mais que o vencimento da regra do passo (7), que é o dia em que o passo ainda tem a vez de ler. */
export const ALARME_RETENCAO = { dias: RETENCAO.vencimentoDias + 1 } as const

export type CriteriosRetencaoCtx = {
  supabase: SupabaseClient
  channels: ColetaChannel[]
  falhas: string[]
  relogio: Relogio
}

/**
 * Pura. Os ids dos vídeos com leitura da curva de vida vencida há `ALARME_RETENCAO.dias` dias ou mais, do mais atrasado ao menos
 * (empate pelo id). Só avalia vídeo com diário em dia (`fonte_ate >= hoje − 7`): o que está em `novos`, `semDiarioEmDia` ou
 * `semRespostaDoYoutube` do passo tem a nota própria e não entra aqui. "Resposta" = tentativa `ok` ou `sem_dado_na_janela`.
 *
 *  (A) tem linha de vida, última tentativa respondida (ou nenhuma): a regra (b) do passo com 8 dias.
 *  (B) sem linha, com resposta vazia: a regra (c) do passo com 8 dias.
 *  (C) a última tentativa não teve resposta, mas já houve resposta antes: só conta se a resposta tem mais de 8 dias e (A) ou (B)
 *      contaria sem olhar a última tentativa (erro de hoje com resposta recente já tem a nota do passo).
 *  (D) nunca teve resposta: conta quando o passo roda neste canal há mais de 8 dias (`leva_ancora_dia < hojeUtc − 8`) e o vídeo não
 *      começou a ser tentado há pouco (`primeira_tent_dia` nulo ou `< hojeUtc − 8`). Âncora nula: o passo nunca rodou, ninguém conta.
 */
export function atrasadosDaRetencao(
  fatos: readonly FatoRetencao[],
  { hojePt, hojeUtc }: { hojePt: DiaPt; hojeUtc: string },
): string[] {
  const alarme = ALARME_RETENCAO.dias
  const limiteDoDiario = addDays(hojePt, -RETENCAO.diarioAtrasadoDias)
  const limiteDaAncora = addDays(hojeUtc, -alarme)
  const atrasos = new Map<string, number>()

  for (const f of fatos) {
    // Sem diário em dia: a curva espera o diário, e o passo já tem a nota disso.
    if (f.fonte_ate === null || f.fonte_ate < limiteDoDiario) continue

    const temLinha = f.vida_window_end !== null
    const tentou = f.vida_tent_dia !== null
    const resposta = f.vida_resposta_dia
    const ultimaSemResposta = tentou && (resposta === null || (f.vida_tent_dia as string) > resposta)
    const windowEnd = f.fonte_ate < hojePt ? f.fonte_ate : hojePt
    const coletado = f.vida_collected_at === null ? null : utcDay(new Date(f.vida_collected_at))

    // Há resposta anterior a considerar? Com linha, a linha é uma resposta (a base é o mais recente entre a coleta e a última resposta).
    let base: string | null
    if (temLinha) base = [coletado, resposta].filter((x): x is string => x !== null).sort().pop() ?? null
    else base = resposta

    if (!temLinha && base === null) {
      // (D) nunca teve resposta.
      const rodaHaMuito = f.leva_ancora_dia !== null && f.leva_ancora_dia < limiteDaAncora
      const comecouHaMuito = f.primeira_tent_dia === null || f.primeira_tent_dia < limiteDaAncora
      if (rodaHaMuito && comecouHaMuito) atrasos.set(f.youtube_video_id, diffDias(f.leva_ancora_dia as string, hojeUtc))
      continue
    }

    // (C): a resposta tem de ter MAIS de `alarme` dias; (A) e (B): `alarme` ou mais. Data da coleta ilegível não é verde.
    const dias = base === null ? 1_000_000 : diffDias(base, hojeUtc)
    if (ultimaSemResposta ? !(dias > alarme) : !(dias >= alarme)) continue

    if (temLinha) {
      const viewsNovas = f.views_total !== null && (f.vida_views_at_read === null || f.views_total > f.vida_views_at_read)
      const fonteAndou = windowEnd > (f.vida_window_end as string)
      if (viewsNovas && fonteAndou) atrasos.set(f.youtube_video_id, dias)
    } else {
      // (B) sem linha, com resposta vazia: o vídeo teve view depois da resposta (com a margem da fonte).
      const viuDepois = f.ultimo_dia_com_view !== null && f.ultimo_dia_com_view >= addDays(base as string, -RETENCAO.margemDaFonteDias)
      if (viuDepois) atrasos.set(f.youtube_video_id, dias)
    }
  }

  return [...atrasos.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([id]) => id)
}

const naoAvaliou = (falhas: string[], canal: string, motivo?: string): void =>
  pushUnico(falhas, `critérios: não foi possível avaliar retenção de ${canal}${motivo ? ` (${motivo})` : ''}`)

/**
 * Para cada canal ligado e em `ok`, DEPOIS do passo: lê os fatos (`yt_own_retention_facts` com `p_hoje_utc`) e anota em `falhas`
 * os vídeos com a leitura da curva vencida há mais de 8 dias. Prazo total de 3 s (`prazoDoCriterio`); vencido, antes de ler ou no
 * meio, a nota é `… (sem tempo)` e a função não é chamada quando o prazo já entrou vencido. Nunca lança.
 */
export async function criteriosRetencao(ctx: CriteriosRetencaoCtx): Promise<void> {
  const canais = ctx.channels.filter(c => c.sync_enabled && c.collection_status === 'ok')
  if (canais.length === 0) return

  const agora = new Date()
  const hojePt = dayPt(agora)
  const hojeUtc = utcDay(agora)
  const prazo = prazoDoCriterio(ctx.relogio, PRAZO_DO_CRITERIO_MS)

  for (const c of canais) {
    if (restante(prazo) <= 0) { naoAvaliou(ctx.falhas, c.name, 'sem tempo'); continue }

    let res: { data: unknown; error: ErroBanco | null } | null
    try {
      res = await comPrazo(
        Promise.resolve(ctx.supabase.rpc(FUNCAO, { p_channel_id: c.id, p_hoje_utc: hojeUtc })),
        prazo,
      ) as { data: unknown; error: ErroBanco | null } | null
    } catch {
      // Nada do que a exceção diz vai para a nota (pode levar texto do banco).
      pushUnico(ctx.falhas, `erro de banco ao ler ${FUNCAO}`)
      naoAvaliou(ctx.falhas, c.name)
      continue
    }
    if (res === null) { naoAvaliou(ctx.falhas, c.name, 'sem tempo'); continue }

    const lido = conferirBanco(res, FUNCAO, ctx.falhas, 'ler')
    if (lido !== 'ok') {
      naoAvaliou(ctx.falhas, c.name, lido === 'schema_ausente' ? `migration MG5 não aplicada: falta a função ${FUNCAO}` : undefined)
      continue
    }

    let fatos: FatoRetencao[]
    try {
      fatos = lerFatos(res.data)
    } catch {
      naoAvaliou(ctx.falhas, c.name)
      continue
    }

    const ids = atrasadosDaRetencao(fatos, { hojePt, hojeUtc })
    if (ids.length === 0) continue
    const lista = ids.slice(0, IDS_NA_NOTA).join(', ')
    const resto = ids.length - IDS_NA_NOTA
    pushUnico(
      ctx.falhas,
      `retenção: ${c.name}: ${ids.length} vídeo(s) com leitura da curva vencida há mais de ${ALARME_RETENCAO.dias} dias (${resto > 0 ? `${lista}, e mais ${resto}` : lista})`,
    )
  }
}
