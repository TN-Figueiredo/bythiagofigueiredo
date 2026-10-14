// A5 · E6/E8: critério do passo desligado por YT_OWN_STEPS_OFF. Só LÊ `yt_own_collection_runs` e decide quanto tempo um passo
// desligado pode ficar assim sem virar vermelho do cron. Um passo desligado é sempre VISÍVEL: nunca some do resumo nem das notas.
//
// REGRA DESTE ARQUIVO (a mesma de criteria.ts e criteria-l2.ts): leitura que falha, tempo que acaba ou dado de forma estranha
// NUNCA vira "há 1 execução" nem silêncio: vira `critérios: não foi possível avaliar …` em `falhas`. Verde só aparece quando
// a leitura veio inteira. Nenhuma nota leva texto do Postgres.
import type { SupabaseClient } from '@supabase/supabase-js'
import { comPrazo, prazoDoCriterio, restante, type Relogio } from './clock'
import { conferirBanco, pushUnico } from './schema'

/** Execuções seguidas (contando a de hoje) em que o passo pode ficar desligado sem o cron ficar vermelho. */
export const EXECUCOES_ATE_O_VERMELHO = 7
/** Execuções anteriores lidas: uma a mais que `EXECUCOES_ATE_O_VERMELHO`, para ver a 8ª. */
const EXECUCOES_LIDAS = 8
const PRAZO_DO_CRITERIO_MS = 1_000
const TABELA = 'yt_own_collection_runs'

export type CriterioDesligadosCtx = {
  supabase: SupabaseClient
  falhas: string[]
  relogio: Relogio
}

const naoAvaliou = (falhas: string[], passo: string, motivo: string): void =>
  pushUnico(falhas, `critérios: não foi possível avaliar há quanto tempo o passo ${passo} está desligado (${motivo})`)

/** `resumo.<passo>.desligado === true`; qualquer outra forma (chave ausente, resumo nulo, texto) é "não desligado". */
function desligadoNoResumo(resumo: unknown, passo: string): boolean {
  if (typeof resumo !== 'object' || resumo === null || Array.isArray(resumo)) return false
  if (!Object.prototype.hasOwnProperty.call(resumo, passo)) return false
  const parte = (resumo as Record<string, unknown>)[passo]
  if (typeof parte !== 'object' || parte === null) return false
  return (parte as { desligado?: unknown }).desligado === true
}

/**
 * `desligados` = os passos que ESTA execução deixou de rodar por `YT_OWN_STEPS_OFF`; aceita os nomes de
 * `PassoComInterruptor` e também o `desligados: string[]` que `criteriosE11` devolve (sem adaptação).
 * Devolve as notas de passo desligado que NÃO são vermelho (a integração as põe em `acao_do_dono`); o vermelho vai direto
 * para `ctx.falhas`. Lista vazia: não lê nada.
 */
export async function criterioDesligados(ctx: CriterioDesligadosCtx, desligados: readonly string[]): Promise<string[]> {
  const passos = [...new Set(desligados)]
  if (passos.length === 0) return []
  const { supabase, falhas, relogio } = ctx

  const semTempo = (): string[] => {
    for (const p of passos) naoAvaliou(falhas, p, 'sem tempo')
    return []
  }
  const semLeitura = (): string[] => {
    for (const p of passos) naoAvaliou(falhas, p, TABELA)
    return []
  }

  const prazo = prazoDoCriterio(relogio, PRAZO_DO_CRITERIO_MS)
  if (restante(prazo) <= 0) return semTempo()

  let res: { data?: unknown; error?: { code?: string | null; message?: string | null } | null } | null
  try {
    res = await comPrazo(
      Promise.resolve(supabase.from(TABELA).select('ran_at, resumo').order('ran_at', { ascending: false }).limit(EXECUCOES_LIDAS)),
      prazo,
    )
  } catch {
    // Nada do que a exceção diz vai para a nota (pode levar texto do banco).
    pushUnico(falhas, `erro de banco ao ler ${TABELA}`)
    return semLeitura()
  }
  if (res === null) return semTempo()
  if (conferirBanco(res, TABELA, falhas, 'ler') !== 'ok') return semLeitura()
  if (!Array.isArray(res.data)) return semLeitura()

  // `order by ran_at desc` já vem do banco; reordena aqui para a conta não depender de quem devolveu.
  const execucoes = (res.data as Array<{ ran_at?: unknown; resumo?: unknown }>)
    .map(l => ({ t: typeof l.ran_at === 'string' ? Date.parse(l.ran_at) : Number.NaN, resumo: l.resumo }))
    .sort((a, b) => (Number.isNaN(a.t) ? 1 : 0) - (Number.isNaN(b.t) ? 1 : 0) || b.t - a.t)

  const notas: string[] = []
  for (const passo of passos) {
    let seguidas = 0
    while (seguidas < execucoes.length && desligadoNoResumo(execucoes[seguidas]!.resumo, passo)) seguidas++
    const n = seguidas + 1 // com a de hoje
    if (n <= EXECUCOES_ATE_O_VERMELHO) {
      notas.push(`${passo}: passo desligado por YT_OWN_STEPS_OFF (há ${n} execuções)`)
    } else {
      pushUnico(
        falhas,
        `${passo}: passo desligado há ${n} execuções ou mais por YT_OWN_STEPS_OFF; religue (tire o nome da variável na Vercel e faça um deploy) ou tire o passo por commit`,
      )
    }
  }
  return notas
}
