// @vitest-environment node
/**
 * A/B Lab S8-F1 (Task 6, C-5): `rodarSonda` contra o `bythiago_int`, com `fetch` injetado. Banco: SÓ o 54422:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f1-sonda.test.ts --no-file-parallelism
 * O banco tem testes de outras suítes: toda asserção filtra pelo test_id semeado aqui.
 */
import { describe, it, expect, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'
import { H, imagemComDhash } from '../helpers/youtube-falso'
import { rodarSonda } from '@/lib/youtube/ab-gravacao/sonda-step'

vi.setConfig({ testTimeout: 120_000 })

describe.skipIf(skipIfNoLocalDb())('S8-F1 Task 6: rodarSonda contra o banco', () => {
  it('C-5: duas rodadas na mesma hora gravam 1 linha; a hora seguinte, a 2ª', async () => {
    const t = await semearTesteAb()
    await q('update ab_test_variants set thumbnail_dhash = $2 where id = $1', [t.varA, H.A])
    await q('update ab_test_variants set thumbnail_dhash = $2 where id = $1', [t.varB, H.B])
    const bytes = new Uint8Array(await imagemComDhash(H.B))
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'HEAD' ? new Response(null, { status: 200, headers: { etag: '"1760774400"' } }) : new Response(bytes, { status: 200 })) as unknown as typeof fetch
    const hora = new Date('2026-10-18T10:15:42.000Z')
    const r1 = await rodarSonda(clienteServico(), hora, f)
    expect(r1.status === 'error' ? r1.error : 'ok').toBe('ok')
    await rodarSonda(clienteServico(), new Date(hora.getTime() + 60_000), f) // mesma hora UTC
    const linhas = () => q<Record<string, unknown>>('select * from ab_test_sondas where test_id = $1 order by hora', [t.testId])
    let ls = await linhas()
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ leitura_estado: 'bate', variante_vista: t.varB, variante_esperada: t.varA, variantes_sem_referencia: 0 })
    await rodarSonda(clienteServico(), new Date(hora.getTime() + 3_600_000), f)
    ls = await linhas()
    expect(ls).toHaveLength(2)
  })
})
