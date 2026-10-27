import * as Sentry from '@sentry/nextjs'
import { ORIGINAL, settleOnAir } from '@/lib/youtube/ab-settle'
import type { AbTestConfig } from '@/lib/youtube/ab-types'
import { encerradoEmDia, relogioV2, tetoDoTesteV2, type CicloComNumero } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { lerPaginado } from '@/lib/youtube/coleta/paginar'
import type { ErroBanco } from '@/lib/youtube/coleta/schema'
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

export type SaidaDoEncerramento = {
  testId: string
  resultado: 'feito' | 'adiado_por_tempo' | 'outro_escritor' | 'pausado_teste_youtube' | 'nao_voltou' | 'ja_encerrado' | 'erro'
  erro?: string
}

/**
 * Encerra cada teste pedindo a saída ao original. Tabela fechada `ResultadoSaida -> SaidaDoEncerramento` (switch com `never`).
 * Só as constantes de prazo são compartilhadas com o laço v1, que fica intacto.
 */
export async function encerrarComPrazo(
  testes: ReadonlyArray<{ id: string; site_id: string }>,
  motivo: 'duracao_maxima' | 'regra_v2',
  inicioDaFuncao: number,
  agora: () => number = Date.now,
): Promise<SaidaDoEncerramento[]> {
  const saidas: SaidaDoEncerramento[] = []
  const fimDaAvaliacao = inicioDaFuncao + FIM_DA_AVALIACAO_MS
  for (const t of testes) {
    try {
      const restante = fimDaAvaliacao - agora()
      if (restante < SETTLE_MINIMO_MS) {
        Sentry.captureMessage('ab-evaluate: encerramento adiado por tempo', { extra: { testId: t.id, motivo, restanteMs: restante } })
        saidas.push({ testId: t.id, resultado: 'adiado_por_tempo' })
        continue
      }
      const r = await settleOnAir(t.id, { siteId: t.site_id, destino: ORIGINAL, motivo, prazo: fimDaAvaliacao })
      switch (r.resultado) {
        case 'feito': {
          if (r.pausadoPorTesteYoutube) { saidas.push({ testId: t.id, resultado: 'pausado_teste_youtube' }); break }
          const naoVoltou = Object.values(r.campos ?? {}).some((c) => c?.estado === 'falhou' || c?.estado === 'desistiu')
          saidas.push({ testId: t.id, resultado: naoVoltou ? 'nao_voltou' : 'feito' })
          break
        }
        case 'em_andamento':
        case 'perdido':
        case 'mudou':
          saidas.push({ testId: t.id, resultado: 'outro_escritor' })
          break
        case 'ja_encerrado':
          saidas.push({ testId: t.id, resultado: 'ja_encerrado' })
          break
        case 'precisa_confirmar':
        case 'destino_invalido':
        case 'outro_teste':
        case 'sem_permissao':
        case 'teste_youtube':
          saidas.push({ testId: t.id, resultado: 'erro', erro: r.resultado })
          break
        default: {
          const _nunca: never = r
          void _nunca
        }
      }
    } catch (err) {
      saidas.push({ testId: t.id, resultado: 'erro', erro: err instanceof Error ? err.message : String(err) })
    }
  }
  return saidas
}

type TesteV2Rede = { id: string; site_id: string; config: unknown; status: string; paused_at: string | null; completed_at: string | null; original_title: string | null }
type CicloLido = CicloComNumero

/** Rede de segurança v2: se o retrato parou, o relógio por ciclos passa de `max_duration_days + 3` e o teste não pode ficar no ar. */
async function redeDeSegurancaV2(supabase: SupabaseClient, testes: TesteV2Rede[], inicioDaFuncao: number): Promise<{ resolved: number; errors: number }> {
  let resolved = 0
  let errors = 0
  if (testes.length === 0) return { resolved, errors }
  const ids = testes.map((t) => t.id)
  const leitura = await lerPaginado<CicloLido>(
    (de, ate) => supabase.from('ab_test_cycles').select('id, test_id, variant_id, cycle_number, started_at, ended_at')
      .in('test_id', ids).order('id').range(de, ate) as PromiseLike<{ data: CicloLido[] | null; error: ErroBanco | null }>,
    50_000,
  )
  if (!leitura.ok) {
    Sentry.captureException(new Error(`rede v2: ler ciclos: ${leitura.motivo}`), { tags: { cron: 'ab-evaluate' }, extra: { context: 'rede v2' } })
    return { resolved, errors: 1 }
  }
  const ciclosPorTeste = new Map<string, CicloLido[]>()
  for (const c of leitura.linhas) { const l = ciclosPorTeste.get(c.test_id) ?? []; l.push(c); ciclosPorTeste.set(c.test_id, l) }
  for (const t of testes) {
    try {
      const ciclos = ciclosPorTeste.get(t.id) ?? []
      if (!ciclos.some((c) => c.ended_at === null)) {
        Sentry.captureMessage('ab-evaluate: teste v2 ativo sem ciclo aberto', { extra: { testId: t.id } })
      }
      const agoraData = new Date()
      const relogio = relogioV2(ciclos, { id: t.id, status: t.status, paused_at: t.paused_at, completed_at: t.completed_at, original_title: t.original_title }, agoraData).length
      // V vem dos ciclos (os mesmos que dão o relógio); o teto é o mesmo da decisão (Phil D1 / Yannis D3).
      const V = new Set(ciclos.map((c) => c.variant_id)).size
      if (relogio < tetoDoTesteV2(t.config, V) + 3) continue

      // A9: grava a tentativa ANTES do settle (chave não congelada).
      const tentou = await supabase.rpc('ab_test_v2_gravar', { p_test_id: t.id, p_v2: { rede_tentou_em: agoraData.toISOString() } })
      if (tentou.error || tentou.data === -1) {
        errors++
        Sentry.captureException(new Error(`rede v2: gravar rede_tentou_em: ${tentou.error?.message ?? 'RPC -1'}`), { tags: { cron: 'ab-evaluate' }, extra: { testId: t.id } })
        continue
      }
      const [saida] = await encerrarComPrazo([t], 'regra_v2', inicioDaFuncao)
      if (!saida) continue
      if (saida.resultado === 'feito' || saida.resultado === 'nao_voltou') {
        resolved++
        const em = new Date().toISOString()
        const g = await supabase.rpc('ab_test_v2_gravar', {
          p_test_id: t.id,
          p_v2: {
            desfecho: 'inconclusivo_por_falha', desfecho_no_encerramento: 'inconclusivo_por_falha', encerrado_em_dia: encerradoEmDia(em),
            provisorio: false, desfecho_final: 'inconclusivo_por_falha',
            ...(saida.resultado === 'nao_voltou' ? { volta_falhou: { em } } : {}),
          },
          p_hist: [{ em, desfecho: 'inconclusivo_por_falha' }],
        })
        if (g.error || g.data === -1) {
          errors++
          Sentry.captureException(new Error(`rede v2: gravar desfecho: ${g.error?.message ?? 'RPC -1'}`), { tags: { cron: 'ab-evaluate' }, extra: { testId: t.id } })
        }
        if (saida.resultado === 'nao_voltou') {
          errors++
          Sentry.captureMessage('ab-evaluate: rede v2 encerrou mas campo não voltou ao original', { extra: { testId: t.id } })
        }
      } else if (saida.resultado === 'erro') {
        errors++
        Sentry.captureException(new Error(`rede v2: ${saida.erro ?? 'erro'}`), { tags: { cron: 'ab-evaluate' }, extra: { testId: t.id } })
      }
    } catch (err) {
      errors++
      Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { testId: t.id } })
    }
  }
  return { resolved, errors }
}

export async function phaseEvaluateActiveTests(supabase: SupabaseClient, inicioDaFuncao: number = Date.now()): Promise<EvaluateResult> {
  let evaluated = 0
  let resolved = 0
  let errors = 0

  const { data: tests, error: erroLeitura } = await supabase
    .from('ab_tests')
    .select('id, site_id, config, started_at, created_at, regra_duracao, status, paused_at, completed_at, original_title')
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

  const v2: TesteV2Rede[] = []
  for (const test of tests) {
    try {
      // S8-F4: teste v2 tem a duração decidida pelo retrato diário; a rede de segurança roda depois do laço.
      if ((test as { regra_duracao?: string }).regra_duracao === 'v2') {
        evaluated++
        v2.push({
          id: test.id as string, site_id: test.site_id as string, config: test.config,
          status: (test.status as string | undefined) ?? 'active', paused_at: (test.paused_at as string | null | undefined) ?? null,
          completed_at: (test.completed_at as string | null | undefined) ?? null, original_title: (test.original_title as string | null | undefined) ?? null,
        })
        continue
      }
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

  try {
    const rede = await redeDeSegurancaV2(supabase, v2, inicioDaFuncao)
    resolved += rede.resolved
    errors += rede.errors
  } catch (err) {
    errors++
    Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { context: 'rede v2' } })
  }

  return { evaluated, resolved, errors }
}
