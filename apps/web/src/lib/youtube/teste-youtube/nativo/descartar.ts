// "Não é teste / Liberar o Lab" (§5.2): o dono diz que o teste detectado não é teste. Só linha `em_andamento` NÃO confirmada.
// Com a linha descartada, o guarda deixa de bloquear o nosso teste; o registrador não a reabre com a mesma evidência.
import type { SupabaseClient } from '@supabase/supabase-js'

export type ResultadoDescartar =
  | { ok: true }
  | { ok: false; erro: 'nao_encontrado' | 'confirmado' | 'ja_encerrado'; estado?: string }

interface Params {
  sb: SupabaseClient
  siteId: string
  userId: string
  orgId: string | null
  registroId: string
  /** `updated_at` que a tela viu (CAS). */
  lido: string
}

export async function descartarDetectado(p: Params): Promise<ResultadoDescartar> {
  let cas = p.lido
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data, error } = await p.sb.from('ab_native_tests')
      .update({ estado: 'descartado', descartado_em: new Date().toISOString(), descartado_por: p.userId })
      .eq('id', p.registroId).eq('site_id', p.siteId).eq('estado', 'em_andamento').is('confirmado_em', null).eq('updated_at', cas)
      .select('id')
    if (error) throw new Error(`ab_native_tests: ${error.message}`)
    if ((data as unknown[] | null)?.length) {
      // Rastro só com ids e o estado anterior; falha vai ao log e não desfaz o descarte.
      try {
        const aud = await p.sb.from('audit_log').insert({
          actor_user_id: p.userId, org_id: p.orgId, site_id: p.siteId,
          action: 'ab_native_descartado', resource_type: 'ab_native_test', resource_id: p.registroId,
          after_data: { registro_id: p.registroId, estado_anterior: 'em_andamento' },
        })
        if (aud?.error) console.error('[ab-nativo] audit_log do descarte', aud.error.message)
      } catch (e) {
        console.error('[ab-nativo] audit_log do descarte', e instanceof Error ? e.message : e)
      }
      return { ok: true }
    }
    // Perdeu: relê uma vez. Evidência nova do registrador (updated_at) não obriga o dono a tocar de novo.
    const { data: atual, error: e2 } = await p.sb.from('ab_native_tests')
      .select('id, estado, confirmado_em, updated_at').eq('id', p.registroId).eq('site_id', p.siteId).maybeSingle()
    if (e2) throw new Error(`ab_native_tests: ${e2.message}`)
    const l = atual as { estado: string; confirmado_em: string | null; updated_at: string } | null
    if (!l) return { ok: false, erro: 'nao_encontrado' }
    if (l.estado !== 'em_andamento') return { ok: false, erro: 'ja_encerrado', estado: l.estado }
    if (l.confirmado_em !== null) return { ok: false, erro: 'confirmado', estado: l.estado }
    cas = l.updated_at
  }
  return { ok: false, erro: 'ja_encerrado' }
}
