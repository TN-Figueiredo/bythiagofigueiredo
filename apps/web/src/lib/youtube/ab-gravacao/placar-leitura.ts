// Leitura de `ab_test_dias` para o placar (S8-F3): em lote (100 ids por consulta), paginada, com falha alta.
// Linha inválida isola o teste (lista) ou falha o detalhe; nunca vira dado.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerPaginado } from '../coleta/paginar'
import { COLUNAS_DO_PLACAR, LinhaDiaPlacarSchema, type LinhaDiaPlacar } from './placar'

export const LOTE_DE_IDS = 100
export const TETO_LINHAS_POR_TESTE = 60

export type LeituraDias =
  | { ok: true; porTeste: Map<string, LinhaDiaPlacar[]>; invalidos: Map<string, { day_pt: string; detalhe: string }> }
  | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto'; detalhe?: string }

function avisaLinhaInvalida(testId: string, dayPt: string, detalhe: string): void {
  Sentry.captureMessage('ab-placar: linha inválida em ab_test_dias', {
    level: 'error',
    fingerprint: ['ab-placar-linha-invalida', testId, dayPt],
    extra: { test_id: testId, day_pt: dayPt, detalhe },
  })
}

export async function lerDiasDosTestes(sb: SupabaseClient, siteId: string, testIds: readonly string[]): Promise<LeituraDias> {
  const porTeste = new Map<string, LinhaDiaPlacar[]>()
  const invalidos = new Map<string, { day_pt: string; detalhe: string }>()
  for (const id of testIds) porTeste.set(id, [])
  let medidoSemImpressoes = false

  for (let i = 0; i < testIds.length; i += LOTE_DE_IDS) {
    const lote = testIds.slice(i, i + LOTE_DE_IDS)
    const lido = await lerPaginado<unknown>(
      (de, ate) =>
        sb
          .from('ab_test_dias')
          .select(COLUNAS_DO_PLACAR)
          .in('test_id', lote)
          .eq('site_id', siteId)
          .order('test_id')
          .order('day_pt')
          .range(de, ate) as unknown as PromiseLike<{ data: unknown[] | null; error: { code?: string | null; message?: string | null } | null }>,
      TETO_LINHAS_POR_TESTE * lote.length,
    )
    if (!lido.ok) return { ok: false, motivo: lido.motivo, detalhe: lido.detalhe }

    for (const bruta of lido.linhas) {
      const p = LinhaDiaPlacarSchema.safeParse(bruta)
      if (p.success) {
        if (p.data.alcance_estado === 'medido' && p.data.impressoes === null) medidoSemImpressoes = true
        porTeste.get(p.data.test_id)?.push(p.data)
        continue
      }
      const b = (bruta ?? {}) as { test_id?: unknown; day_pt?: unknown }
      const testId = typeof b.test_id === 'string' ? b.test_id : ''
      const dayPt = typeof b.day_pt === 'string' ? b.day_pt : ''
      if (testId && !invalidos.has(testId)) {
        const detalhe = p.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ')
        invalidos.set(testId, { day_pt: dayPt, detalhe })
        avisaLinhaInvalida(testId, dayPt, detalhe)
      }
    }
  }
  // Escritor com bug: 'medido' sem impressões. Uma vez por leitura, sem dado do canal.
  if (medidoSemImpressoes) {
    Sentry.captureMessage('ab-placar: dia medido sem impressões', { level: 'warning', fingerprint: ['ab-placar-medido-sem-impressoes'] })
  }
  // Teste com linha inválida fica só em `invalidos`.
  for (const id of invalidos.keys()) porTeste.delete(id)
  return { ok: true, porTeste, invalidos }
}

export async function lerDiasDoTeste(
  sb: SupabaseClient,
  siteId: string,
  testId: string,
): Promise<{ ok: true; dias: LinhaDiaPlacar[] } | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto' | 'linha_invalida'; detalhe?: string }> {
  const r = await lerDiasDosTestes(sb, siteId, [testId])
  if (!r.ok) return r
  const inv = r.invalidos.get(testId)
  if (inv) return { ok: false, motivo: 'linha_invalida', detalhe: `${inv.day_pt}: ${inv.detalhe}` }
  return { ok: true, dias: r.porTeste.get(testId) ?? [] }
}
