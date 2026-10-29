// @vitest-environment node
/**
 * F3 T7: contra Postgres de verdade. (1) o N da aba (`contarSinaisAbertos`) é o N da página (`listar().n`) em todos os estados da linha;
 * (2) `saiuDoAviso` com resumo/individual reais na tabela `notifications`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f3-aba-paridade-e-aviso.test.ts --no-file-parallelism
 * Grava de verdade (site e usuários próprios, criados e apagados aqui).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apagarSites } from '../helpers/limpa-cena'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { contarSinaisAbertos, calculoLigadoNoAmbiente, listarSinaisDoNicho as listarF4 } from '@/lib/youtube/observatorio/sinais/leitura'
import { saiuDoAviso } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/aviso'

/** F4: `listarSinaisDoNicho` ganhou a prova de leitura como 6º parâmetro; estes testes não a usam (sem prova = `sem_direito`, zero consultas). */
const listar = (sb: Parameters<typeof listarF4>[0], site: string, agora: Date, limite = 50, calculo: boolean = calculoLigadoNoAmbiente(), leitura: Parameters<typeof listarF4>[5] = null) =>
  listarF4(sb, site, agora, limite, calculo, leitura)

const dia = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString()
const SIG = (n: number): string => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`
const EV = { outliers: [{ video_id: randomUUID(), canal_id: randomUUID(), published_at: dia(-3), mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: [] }

describe.skipIf(skipIfNoLocalDb())('F3 T7: N da aba = N da página; saiuDoAviso com resumo real', () => {
  let pg: Client
  let org = ''
  let site = ''
  let eu = ''
  let outro = ''
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient

  async function sinal(n: number, o: { status?: string; expira?: string } = {}): Promise<void> {
    await pg.query(
      `insert into public.niche_signals (id, site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, motivo)
       values ($1, $2, 'destino', $3, 'sinais-v1+semente-1', $4::jsonb, $5, 'video_novo', $6, now() - interval '2 days', now(), $7, 'dois canais estouraram')`,
      [SIG(n), site, `pais:Q${n}`, JSON.stringify(EV), 10 + n, o.status ?? 'aberto', o.expira ?? dia(20)])
  }
  async function notificar(user: string, dedup: string, payload: unknown): Promise<void> {
    await pg.query(
      `insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key, payload) values ($1, $2, 'nicho', 'youtube', 3, 't', $3, $4::jsonb)`,
      [site, user, dedup, JSON.stringify(payload)])
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const s = await criarSite(pg)
    site = s.site; org = s.org
    eu = await criarUsuario(pg); outro = await criarUsuario(pg)
    await sinal(1); await sinal(2); await sinal(3); await sinal(7)
    await sinal(4, { expira: dia(-1) })
    await sinal(5, { status: 'dispensado' })
    await sinal(6, { status: 'feito' })
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.notifications where site_id = $1', [site])
      await pg.query('delete from public.niche_signals where site_id = $1', [site])
      await pg.query('delete from public.niche_signals_estado where site_id = $1', [site])
      await apagarSites(pg, 'id = $1', [site])
      await pg.query('delete from public.organizations where id = $1', [org])
      await pg.query('delete from auth.users where id = any($1::uuid[])', [[eu, outro]])
    } finally { await pg.end() }
  })

  it('aberto vigente conta; vencido, dispensado e feito ficam fora, e a aba e a página dão o mesmo N', async () => {
    const agora = new Date()
    const aba = await contarSinaisAbertos(sb(), site, agora)
    const pagina = await listar(sb(), site, agora, 3)
    expect(aba).toBe(4)
    expect(pagina.n).toBe(aba)
    // o N continua exato mesmo com o limite do bloco menor que o total
    expect(pagina.itens.length).toBe(3)
    expect((await listar(sb(), site, agora, 50)).n).toBe(4)
    // sob o mesmo relógio congelado (OBS_NOW_OVERRIDE), depois do vencimento do nº 1: os dois caem juntos
    await pg.query('update public.niche_signals set expires_at = $2 where id = $1', [SIG(1), dia(1)])
    const depois = new Date(Date.now() + 2 * 86_400_000)
    expect(await contarSinaisAbertos(sb(), site, depois)).toBe(3)
    expect((await listar(sb(), site, depois, 3)).n).toBe(3)
  })

  it('resumo real: todos abertos = false; um dispensado depois do aviso = true; resumo de outro usuário = false', async () => {
    const chave = 'nicho-resumo:2026-10-23:abc123def456'
    await pg.query('update public.niche_signals set expires_at = $2 where id = $1', [SIG(1), dia(20)])
    await notificar(eu, chave, { ids: [SIG(1), SIG(2), SIG(3)] })
    const agora = new Date()
    expect(await saiuDoAviso(sb(), site, eu, chave, agora)).toBe(false)
    await pg.query(`update public.niche_signals set status = 'dispensado', dispensado_em = now() where id = $1`, [SIG(3)])
    expect(await saiuDoAviso(sb(), site, eu, chave, agora)).toBe(true)
    expect(await saiuDoAviso(sb(), site, outro, chave, agora)).toBe(false)
    expect(await saiuDoAviso(sb(), site, eu, 'nicho-resumo:2026-10-23:inexistente01', agora)).toBe(false)
  })

  it('aviso individual real: aberto = false; vencido = true', async () => {
    await notificar(eu, `nicho:${SIG(2)}`, {})
    await notificar(eu, `nicho:${SIG(4)}`, {})
    const agora = new Date()
    expect(await saiuDoAviso(sb(), site, eu, `nicho:${SIG(2)}`, agora)).toBe(false)
    expect(await saiuDoAviso(sb(), site, eu, `nicho:${SIG(4)}`, agora)).toBe(true)
  })

  it('F3b adiada: sai do N da aba e da página juntas, volta sozinha, conta em "adiados" só se volta antes de vencer; no aviso conta como saiu', async () => {
    const agora = new Date()
    const antes = await contarSinaisAbertos(sb(), site, agora)
    expect(antes).toBeGreaterThan(0)
    await pg.query(`update public.niche_signals set adiado_ate = $2, expires_at = $3 where id = $1`, [SIG(7), dia(5), dia(20)])
    expect(await contarSinaisAbertos(sb(), site, agora)).toBe((antes as number) - 1)
    const l = await listar(sb(), site, agora, 50)
    expect(l.n).toBe((antes as number) - 1)
    expect(l.itens.some((i) => i.id === SIG(7))).toBe(false)
    expect(l.contagens.adiados).toBe(1)
    expect(l.proximaVolta).not.toBeNull()
    // vence antes de voltar: continua fora do N, mas não conta como "volta"
    await pg.query(`update public.niche_signals set expires_at = $2 where id = $1`, [SIG(7), dia(3)])
    expect((await listar(sb(), site, agora, 50)).contagens.adiados).toBe(0)
    // no resumo do sino: adiada = saiu
    await notificar(eu, 'nicho-resumo:2026-10-24:adiada01', { ids: [SIG(2), SIG(7)] })
    expect(await saiuDoAviso(sb(), site, eu, 'nicho-resumo:2026-10-24:adiada01', agora)).toBe(true)
    // o adiamento passou: volta ao N, ao item (com adiada_em) e deixa de contar como adiada
    await pg.query(`update public.niche_signals set adiado_ate = now() - interval '1 hour', adiado_em = now() - interval '8 days', expires_at = $2 where id = $1`, [SIG(7), dia(20)])
    expect(await contarSinaisAbertos(sb(), site, agora)).toBe(antes)
    const volta = await listar(sb(), site, agora, 50)
    expect(volta.n).toBe(antes)
    expect(volta.itens.find((i) => i.id === SIG(7))!.adiada_em).not.toBeNull()
    expect(volta.contagens.adiados).toBe(0)
    // sem nada aberto e uma adiada que volta: o vazio é "adiado", com a razão do cálculo guardada
    await pg.query(`update public.niche_signals set adiado_ate = $2 where site_id = $1 and status = 'aberto'`, [site, dia(5)])
    await pg.query(`insert into public.niche_signals_estado (site_id, computed_at, rule_version, motivo_vazio, contagens) values ($1, now(), 'sinais-v1+semente-1', 'sem-grupo', '{}'::jsonb)
                    on conflict (site_id) do update set computed_at = excluded.computed_at, motivo_vazio = excluded.motivo_vazio`, [site])
    const vazio = await listar(sb(), site, agora, 50)
    expect(vazio).toMatchObject({ n: 0, motivoVazio: 'adiado', motivoDoCalculo: 'sem-grupo' })
    expect(vazio.contagens.adiados).toBeGreaterThan(0)
  })
})
