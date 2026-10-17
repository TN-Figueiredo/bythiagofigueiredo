// Cenários únicos da T8 (P4a): rotação do cron com falha de API e duração máxima do ab-evaluate.
// Usa o banco falso único (banco-ab.ts) e o YouTubeFalso (youtube-falso.ts): o `applyVariantToYouTube` e o
// `settleOnAir` (evaluate) rodam de verdade e falam com o YouTube só por `fetch`. O arquivo de teste precisa declarar:
//   vi.mock('@/lib/supabase/service', async () => ({ getSupabaseServiceClient: () => (await import('../helpers/banco-ab')).servicoAtual.cliente }))
//   (ver os dois testes que usam este helper) e mockar Sentry, token-refresh, preflight, channel-account e fan-out.
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { YouTubeFalso } from './youtube-falso'
import type { ChamadaFalsa } from './youtube-falso'
import { AGORA, BLOB, IMG, SITE, criarBanco, servicoAtual } from './banco-ab'
import type { OpcoesBanco } from './banco-ab'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'

/** `settleOnAir` falso da rotação (a rotação só PEDE a saída; o contrato de `settleOnAir` é testado em ab-settle.test.ts). */
export const settleOnAirFalso = vi.fn()

const DIA = 86_400_000

export interface OpcoesRotacao {
  consecutiveFailures?: number
  testType?: 'thumbnail' | 'title' | 'combo'
  /** YouTubeApiError → o YouTubeFalso recusa a chamada com esse status/reason; outro Error → o banco lança na leitura de ciclos. */
  erroApi?: YouTubeApiError | Error
}

export function montarRotacao(o: OpcoesRotacao = {}) {
  const banco = criarBanco({
    testType: o.testType ?? 'thumbnail',
    config: { rotation_pattern: 'abba', ...(o.consecutiveFailures !== undefined ? { consecutive_failures: o.consecutiveFailures } : {}) },
  })
  const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
  vi.stubGlobal('fetch', yt.fetch)
  if (o.erroApi instanceof YouTubeApiError) yt.recusar(o.erroApi.chamada as ChamadaFalsa, o.erroApi.status, o.erroApi.reason)
  let supabase = banco.supabase
  if (o.erroApi && !(o.erroApi instanceof YouTubeApiError)) {
    const queda = o.erroApi
    const original = banco.supabase
    supabase = { ...original, rpc: original.rpc.bind(original), from: (t: string) => { if (t === 'ab_test_cycles') throw queda; return original.from(t) } } as unknown as SupabaseClient
  }
  servicoAtual.cliente = supabase
  settleOnAirFalso.mockReset()
  settleOnAirFalso.mockResolvedValue({ resultado: 'feito', campos: {} })
  return {
    banco: Object.assign(banco, { supabase, testId: 'teste-1', siteId: SITE }),
    yt,
    settle: settleOnAirFalso,
    avancarDia: () => vi.setSystemTime(new Date(Date.now() + DIA)),
  }
}

export interface OpcoesEvaluate {
  testType?: 'thumbnail' | 'title' | 'combo'
  /** true = 15 dias no ar (a duração máxima padrão é 14). */
  expirou?: boolean
}

export function montarEvaluate(o: OpcoesEvaluate = {}) {
  const banco = criarBanco({ testType: o.testType ?? 'thumbnail', diasNoAr: o.expirou === false ? 3 : 15, config: { max_duration_days: 14 } })
  // No ar: a variante B (thumbnail e título), que é o que a rotação deixou.
  const yt = new YouTubeFalso({ titulo: 'Título B', thumb: IMG.B, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
  vi.stubGlobal('fetch', yt.fetch)
  servicoAtual.cliente = banco.supabase
  return { banco: Object.assign(banco, { siteId: SITE, testId: 'teste-1' }), yt, agora: AGORA }
}
