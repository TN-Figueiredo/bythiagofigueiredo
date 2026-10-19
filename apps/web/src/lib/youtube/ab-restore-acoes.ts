import type { SupabaseClient } from '@supabase/supabase-js'
import { releaseAlert } from '@/lib/ops/alert-state'
import { camposPendentes, paraRestoreStatus, podeDispensar } from '@/lib/youtube/ab-restore'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'
import { novaTentativa } from '@/lib/youtube/ab-settle'
import type { PortasSaida, ResultadoSaida } from '@/lib/youtube/ab-settle'
import { avisarNovaTentativa } from '@/lib/youtube/ab-restore-avisos'
import { rotuloNoAr } from '@/lib/youtube/ab-watchdog-nova-tentativa'

interface TesteLido { id: string; site_id: string; name: string; restore_seq: number; restore_status: unknown }

async function lerTeste(supabase: SupabaseClient, testId: string, siteId: string): Promise<TesteLido | null> {
  const { data, error } = await supabase.from('ab_tests').select('id, site_id, name, restore_seq, restore_status').eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (error) throw new Error(`ab-restore-acoes: teste ${testId}: ${(error as { message: string }).message}`)
  return (data as TesteLido | null) ?? null
}

/** Destino dos campos pedidos: 'original' só se todos os presentes voltam ao original; nulo se o teste não é do site. */
export async function destinoDosCampos(supabase: SupabaseClient, testId: string, siteId: string, campos: CampoNome[]): Promise<'original' | 'variante' | null> {
  const t = await lerTeste(supabase, testId, siteId)
  if (!t) return null
  const rs = paraRestoreStatus(t.restore_status)
  const presentes = campos.filter((c) => rs?.[c])
  return presentes.some((c) => rs![c]!.destino !== 'original') ? 'variante' : 'original'
}

/** A chave do "parou" é por campo e vale para sempre: sair de `desistiu` a libera, senão o segundo "parou" sai mudo (F7/Y-5). */
export async function liberarAvisoDeDesistiu(supabase: SupabaseClient, testId: string, campos: CampoNome[]): Promise<void> {
  for (const c of campos) await releaseAlert(supabase, `ab-restore-desistiu:${testId}:${c}`)
}

/** "Já corrigi no YouTube": tira os campos do `restore_status` (vazio vira `{}`, nunca null: D4), guardado por restore_seq. */
export async function dispensarCampos(supabase: SupabaseClient, testId: string, siteId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoSaida> {
  const t = await lerTeste(supabase, testId, siteId)
  if (!t) return { resultado: 'ja_encerrado', campos: null }
  const rs = paraRestoreStatus(t.restore_status)
  if (t.restore_seq !== seqVisto) return { resultado: 'mudou', campos: rs }
  if (!rs || campos.length === 0 || campos.some((c) => !rs[c] || !podeDispensar(rs[c]!))) return { resultado: 'ja_encerrado', campos: rs }

  const restante: RestoreStatus = { ...rs }
  const estados: Record<string, string> = {}
  for (const c of campos) { estados[c] = rs[c]!.estado; delete restante[c] }
  const { data, error } = await supabase.from('ab_tests')
    .update({ restore_status: restante, restore_seq: t.restore_seq + 1 }).eq('id', testId).eq('restore_seq', seqVisto).select('id')
  if (error) throw new Error(`ab-restore-acoes: dispensar ${testId}: ${(error as { message: string }).message}`)
  if (((data ?? []) as unknown[]).length === 0) return { resultado: 'em_andamento', campos: null }

  // F8: rastro, sem texto livre. Falha do rastro não desfaz a dispensa (já gravada), vai ao log.
  const aud = await supabase.from('audit_log').insert({
    action: 'ab_restore_dismissed', resource_type: 'ab_test', resource_id: testId, site_id: siteId,
    after_data: { campos, restore_seq: seqVisto, estados_dispensados: estados },
  })
  if (aud.error) console.error('[ab-restore-acoes] audit_log', aud.error.message)

  if (!(['title', 'thumbnail'] as const).some((c) => restante[c]?.estado === 'falhou')) await releaseAlert(supabase, `ab-restore:${testId}`)
  await liberarAvisoDeDesistiu(supabase, testId, campos.filter((c) => rs[c]!.estado === 'desistiu'))
  return { resultado: 'feito', campos: restante }
}

/** "Tentar agora": reivindica por restore_seq (novaTentativa), libera o aviso dos campos que saíram de `desistiu` e avisa. */
export async function tentarAgora(supabase: SupabaseClient, testId: string, siteId: string, seqVisto: number, portas?: Partial<PortasSaida>): Promise<ResultadoSaida> {
  const antes = await lerTeste(supabase, testId, siteId)
  const rsAntes = antes ? paraRestoreStatus(antes.restore_status) : null
  const eramDesistiu = (['title', 'thumbnail'] as const).filter((c) => rsAntes?.[c]?.estado === 'desistiu')

  const op = { siteId, origem: 'humano', seqEsperado: seqVisto } as const
  const res = portas ? await novaTentativa(testId, op, portas) : await novaTentativa(testId, op)

  if (eramDesistiu.length > 0) { // a reivindicação pode ter andado mesmo quando o desfecho não é `feito`
    const depois = await lerTeste(supabase, testId, siteId)
    const rsDepois = depois ? paraRestoreStatus(depois.restore_status) : null
    await liberarAvisoDeDesistiu(supabase, testId, eramDesistiu.filter((c) => rsDepois?.[c]?.estado !== 'desistiu'))
  }
  if (res.resultado === 'feito' && antes) {
    const tentados = camposPendentes(rsAntes, 'humano')
    const noAr = await rotuloNoAr(supabase, { id: antes.id, site_id: antes.site_id }, res.campos, tentados).catch(() => null)
    await avisarNovaTentativa(supabase, { id: antes.id, site_id: antes.site_id, name: antes.name }, res.campos, noAr).catch(() => undefined)
  }
  return res
}
