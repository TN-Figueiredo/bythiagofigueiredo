// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Banco de dedup_key que imita o índice único de notifications (site, usuário, dedup_key): suprime para sempre.
const gastas = new Set<string>()
const fanOut = vi.fn(async (o: { dedupKey: string }) => {
  if (gastas.has(o.dedupKey)) return { total: 1, sent: 0, suppressed: 1, errors: [] }
  gastas.add(o.dedupKey)
  return { total: 1, sent: 1, suppressed: 0, errors: [] }
})
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: (o: { dedupKey: string }) => fanOut(o) }))
const chaves = new Set<string>()
vi.mock('@/lib/ops/alert-state', () => ({
  claimAlert: vi.fn(async (_s: unknown, k: string) => { if (chaves.has(k)) return false; chaves.add(k); return true }),
  releaseAlert: vi.fn(async (_s: unknown, k: string) => { chaves.delete(k) }),
}))

import { avisarNovaTentativa } from '@/lib/youtube/ab-restore-avisos'
import { releaseAlert } from '@/lib/ops/alert-state'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'

const sb = {} as SupabaseClient
const teste = { id: 't1', site_id: 's1', name: 'Teste' }
const parou = (em: string): RestoreStatus => ({ thumbnail: { estado: 'desistiu', destino: 'original', em, forcado: false, escreveu: false, erro: null, attempts: 3, motivo: 'tres_falhas' } })
const chave = 'ab-restore-desistiu:t1:thumbnail'

beforeEach(() => { gastas.clear(); chaves.clear(); fanOut.mockClear() })

describe('aviso de desistiu em correntes seguidas (herança da T4)', () => {
  it('dentro da mesma corrente não duplica', async () => {
    expect(await avisarNovaTentativa(sb, teste, parou('2026-10-19T10:00:00.000Z'), null)).toBe('enviado')
    expect(await avisarNovaTentativa(sb, teste, parou('2026-10-19T10:00:00.000Z'), null)).toBe('repetido')
    expect(fanOut).toHaveBeenCalledTimes(1)
  })
  it('dois "parou" em correntes seguidas (retry libera a chave): o segundo avisa de novo', async () => {
    expect(await avisarNovaTentativa(sb, teste, parou('2026-10-19T10:00:00.000Z'), null)).toBe('enviado')
    await releaseAlert(sb, chave) // o que retryRestore faz ao reivindicar o campo
    expect(await avisarNovaTentativa(sb, teste, parou('2026-10-20T10:00:00.000Z'), null)).toBe('enviado')
    expect(fanOut.mock.calls.filter((c) => c[0].dedupKey.startsWith(chave))).toHaveLength(2)
  })
  it('sem a liberação, o replay da mesma corrente segue mudo mesmo com a chave do fan-out nova', async () => {
    await avisarNovaTentativa(sb, teste, parou('2026-10-19T10:00:00.000Z'), null)
    expect(await avisarNovaTentativa(sb, teste, parou('2026-10-19T10:00:00.000Z'), null)).toBe('repetido')
  })
})
