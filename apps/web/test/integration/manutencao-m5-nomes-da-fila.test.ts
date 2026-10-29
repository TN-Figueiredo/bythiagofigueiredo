// @vitest-environment node
/**
 * Manutenção M5 r2 (Yannis R-1 = Gio D4): a peça 7 mostra o nome do canal que JÁ SAIU (name_at_removal) e nunca fica sem rótulo.
 * O caso real do banco: canal removido com decisão `pedido` (a linha de competitor_channels foi apagada) e item de vídeo cuja linha foi apagada pela decisão.
 * Banco: SÓ o bythiago_int (54422), tudo em begin … rollback. O cliente de serviço é trocado por um que fala com o mesmo `pg`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCanal } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'
import { aplicarM9 } from '../helpers/m9'

const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let cliente: Client
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const nomes = Object.keys(args)
      const r = await cliente.query(`select public.${fn}(${nomes.map((_, i) => `$${i + 1}`).join(', ')}) as r`, Object.values(args))
      return { data: r.rows[0].r, error: null }
    },
  }),
}))

describe.skipIf(skipIfNoLocalDb())('M5 r2: nomes dos itens da fila (canal removido, vídeo apagado)', () => {
  beforeEach(async () => { cliente = new Client({ connectionString: URL_INT }); await cliente.connect(); await cliente.query('begin'); await prepararM5(cliente, 3); await aplicarM9(cliente) })   // M9: a saída de owner_pending é a versão 2, a única que o leitor aceita
  afterEach(async () => { await cliente.query('rollback'); await cliente.end() })

  it('o item de canal removido mostra o nome do registro; o de vídeo apagado mostra o canal dono; nenhum fica sem rótulo', async () => {
    const c = cliente
    const site = randomUUID()
    const a = await semearCanal(c, { site, videos: 1 })
    const b = await semearCanal(c, { site, videos: 0 })       // o canal que vai sair
    const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
    const adm = randomUUID()
    await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [adm, `m5r2-${adm}@t.test`])
    await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, adm])
    await c.query(`update public.competitor_channels set channel_name = 'Rota Andina' where id = $1`, [b.canal]).catch(() => undefined)
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [site, b.canal])
    await c.query(`select public.competitor_channel_remove($1, $2, 'guardar', 'e10_export', $3)`, [site, b.canal, adm])
    await c.query(`update public.obs_archive_channel_removals set archive_decision = 'apagar' where site_id = $1 and channel_ref = $2`, [site, b.canal])   // estado `pedido`
    // M9 (versao 2): o item da fila só aparece com alvo na lista do item (obs_archive_item_targets), como na captura real: o alvo nasce ANTES do item e o gatilho obs_archive_link_item liga item_id ao inserir o item
    await c.query(`insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, class, table_name, channel_ref, month, keys, from_unit_id, from_version)
      values ($1, 'video', array['ytapagado01'], 'serie', 'competitor_video_daily', $2, '2026-10-01', array[gen_random_uuid()::text], gen_random_uuid(), 1)`, [site, a.canal])
    // o vídeo: a linha foi apagada pela decisão; só o item da fila sobrou
    await c.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
      values ($1, 'video', 'ytapagado01', $2, $3, '{}'::jsonb, true)`, [site, a.canal, adm])
    const nome = (await c.query(`select name_at_removal as n from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [site, b.canal])).rows[0].n as string | null
    expect(nome, 'a remoção grava o nome que o canal tinha').toBeTruthy()

    process.env.OBS_ARQUIVO = 'on'
    const { lerPendenciasDaFila } = await import('@/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila')
    // como a página: só os canais VIVOS (o canal `b` já saiu) e nenhum vídeo vivo com esse id
    const r = await lerPendenciasDaFila(site, { podeEditar: true, canUnlock: false } as never, new Date(), { canais: new Map([[a.canal, 'Nomade Raiz']]), videos: new Map() })
    expect(r?.estado).toBe('com_itens')
    const itens = (r as { itens: Array<{ kind: string; titulo: string | null }> }).itens
    expect(itens.find(i => i.kind === 'canal')?.titulo).toBe(nome)
    expect(itens.find(i => i.kind === 'video')?.titulo).toBe('Nomade Raiz')
    expect(itens.every(i => i.titulo && i.titulo.length > 0)).toBe(true)
  })
})
