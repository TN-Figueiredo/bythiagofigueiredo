// Semente e auxiliares da prova local da faixa de restauração com botões (A/B Lab P4b, T11).
// Reaproveita a semente da P4a (mesmo prefixo, mesmo Supabase local PADRÃO 54321/54322, mesmo YouTube falso 3098);
// aqui entram só o relógio do vigia (cron_health), a leitura do rastro de auditoria e a conta da "próxima verificação".
import { cliente, siteId } from './semente'

const VIGIA = 'ab-watchdog'

/** Vigia que rodou agora há pouco: a faixa promete "por volta das HH:MM". */
export async function vigiaFresco(db = cliente()): Promise<void> {
  const agora = new Date().toISOString()
  const r = await db.from('cron_health').upsert(
    { cron_name: VIGIA, last_success_at: agora, consecutive_failures: 0, severity: 'info', updated_at: agora },
    { onConflict: 'cron_name' },
  )
  if (r.error) throw new Error(`cron_health: ${r.error.message}`)
}

/** Vigia que nunca rodou: a faixa cai em "na próxima verificação". */
export async function vigiaAusente(db = cliente()): Promise<void> {
  const r = await db.from('cron_health').delete().eq('cron_name', VIGIA)
  if (r.error) throw new Error(`cron_health: ${r.error.message}`)
}

/** Guarda a linha do vigia que existia antes da suíte (a suíte a sobrescreve) e devolve a função que a repõe. */
export async function guardarVigia(db = cliente()): Promise<() => Promise<void>> {
  const { data } = await db.from('cron_health').select('*').eq('cron_name', VIGIA).maybeSingle()
  return async () => {
    if (data) await db.from('cron_health').upsert(data, { onConflict: 'cron_name' })
    else await db.from('cron_health').delete().eq('cron_name', VIGIA)
  }
}

/** "HH:MM" de São Paulo do primeiro 10:00 ou 20:00 UTC estritamente depois de `agora` (conta à mão, sem importar o código do produto). */
export function proximaVigiaSp(agora = new Date()): string {
  const dia = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  for (const dd of [0, 1]) {
    for (const h of [10, 20]) {
      const c = dia + dd * 86_400_000 + h * 3_600_000
      if (c > agora.getTime()) return `${String((h - 3 + 24) % 24).padStart(2, '0')}:00`
    }
  }
  return '07:00'
}

/** Milissegundos até a virada do vigia (10:00 ou 20:00 UTC) mais próxima; usado para não semear colado nela. */
export function msAteAViradaDoVigia(agora = new Date()): number {
  const dia = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  let menor = Infinity
  for (const dd of [0, 1]) for (const h of [10, 20]) {
    const d = dia + dd * 86_400_000 + h * 3_600_000 - agora.getTime()
    if (d > 0 && d < menor) menor = d
  }
  return menor
}

export async function auditoriaDaDispensa(testId: string, db = cliente()): Promise<Array<{ action: string; actor_user_id: string | null; after_data: { campos: string[]; restore_seq: number; restore_seq_novo: number; estados_dispensados: Record<string, string> } }>> {
  const sid = await siteId(db)
  const { data, error } = await db.from('audit_log').select('action, actor_user_id, after_data').eq('resource_id', testId).eq('site_id', sid).eq('action', 'ab_restore_dismissed')
  if (error) throw new Error(`audit_log: ${error.message}`)
  return (data ?? []) as never
}
