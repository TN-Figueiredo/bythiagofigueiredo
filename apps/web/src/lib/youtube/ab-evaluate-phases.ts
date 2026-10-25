import * as Sentry from '@sentry/nextjs'
import { ORIGINAL, settleOnAir } from '@/lib/youtube/ab-settle'
import type { AbTestConfig } from '@/lib/youtube/ab-types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

export interface EvaluateResult {
  evaluated: number
  resolved: number
  errors: number
}

// ─── Fase 2: duração máxima ──────────────────────────────────────────────────
// Enquanto não houver métrica de entrega real, o cron não declara vencedor, não abre
// carência, não cria playoff e não aplica nada: `ab_test_cycles.impressions` são views e
// os cliques são sempre zero. Só sobra o ramo da duração máxima. Escolher o que fica no
// ar é decisão humana (spec 2026-10-07-ab-lab-honesto, 4.1).
//
// P4a T8: a volta ao original e o encerramento são UMA chamada, `settleOnAir(original, 'duracao_maxima')`
// (reivindica por restore_seq, escreve só o que o YouTube ainda mostra de nosso, fecha o ciclo e grava o retrato por campo).

/** Sobram menos de 40 s (25 s de escrita + 5 s do passo 4 e do aviso + folga) e o teste fica para amanhã. */
export const SETTLE_MINIMO_MS = 40_000
/** Rota de 120 s: 15 s ficam para longevidade, recordCron e escalada. O prazo do settle e o corte de "não inicia" medem contra este fim. */
export const FIM_DA_AVALIACAO_MS = 105_000

export async function phaseEvaluateActiveTests(supabase: SupabaseClient, inicioDaFuncao: number = Date.now()): Promise<EvaluateResult> {
  let evaluated = 0
  let resolved = 0
  let errors = 0

  const { data: tests, error: erroLeitura } = await supabase
    .from('ab_tests')
    .select('id, site_id, config, started_at, created_at, regra_duracao')
    .eq('status', 'active')

  if (erroLeitura) {
    Sentry.captureException(new Error(`ler testes ativos: ${erroLeitura.message}`, { cause: erroLeitura }), {
      tags: { cron: 'ab-evaluate' },
      extra: { context: 'ler testes ativos' },
    })
    return { evaluated: 0, resolved: 0, errors: 1 }
  }
  if (!tests || tests.length === 0) {
    return { evaluated: 0, resolved: 0, errors: 0 }
  }

  for (const test of tests) {
    try {
      // S8-F4: teste v2 tem a duração decidida pelo retrato diário (rede de segurança na T8).
      if ((test as { regra_duracao?: string }).regra_duracao === 'v2') { evaluated++; continue }
      const config = test.config as AbTestConfig
      const startedAt = new Date(test.started_at ?? test.created_at)
      const daysSinceStart = Math.floor((Date.now() - startedAt.getTime()) / 86400000)
      const maxDurationDays = config.max_duration_days ?? 14

      if (daysSinceStart < maxDurationDays) {
        evaluated++
        continue
      }

      // F-D3: settle novo só começa com pelo menos SETTLE_MINIMO_MS de rota pela frente; o resto fica para a próxima rodada.
      const fimDaAvaliacao = inicioDaFuncao + FIM_DA_AVALIACAO_MS
      const restante = fimDaAvaliacao - Date.now()
      if (restante < SETTLE_MINIMO_MS) {
        Sentry.captureMessage('ab-evaluate: duração máxima adiada por tempo', { extra: { testId: test.id, restanteMs: restante } })
        evaluated++
        continue
      }

      const saida = await settleOnAir(test.id as string, { siteId: test.site_id as string, destino: ORIGINAL, motivo: 'duracao_maxima', prazo: fimDaAvaliacao })
      evaluated++
      // ja_encerrado / em_andamento: outro escritor é dono do teste; nada a fazer aqui.
      if (saida.resultado !== 'feito') continue
      if (saida.pausadoPorTesteYoutube) continue // pausado pela guarda do teste do YouTube: o teste não foi resolvido
      resolved++
      // Campo que não voltou ao original deixa a variante no ar: o cron fica vermelho nesse dia (S-C7).
      const naoVoltou = Object.values(saida.campos).some((c) => c?.estado === 'falhou' || c?.estado === 'desistiu')
      if (naoVoltou) errors++
    } catch (err) {
      errors++
      Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { testId: test.id } })
    }
  }

  return { evaluated, resolved, errors }
}
