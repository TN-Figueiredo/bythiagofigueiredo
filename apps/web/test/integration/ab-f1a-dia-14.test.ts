// @vitest-environment node
/**
 * F1a-tela-1 T10b: pergunta do dia 14 com duas versões contra o banco. A linha é lida por `lerLinhasDoCaminho` (a ficha já está
 * vinculada ao registro) e o pedido é o do componente. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-dia-14 --no-file-parallelism
 * O banco é compartilhado e sujo: tudo é semeado num site próprio e filtrado por ele.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '' }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => ({ siteId: ctx.siteId, userId: ctx.userId }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

// a prova de edição (`leituraDoEditor`) que a lista repete na borda: a guarda simulada aceita
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u-teste' } })) }))
import { responderTesteDoYouTube, type PedidoRespostaDia14 } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { lerLinhasDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import { leituraDoEditor, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { versoesDoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-estado'
import { prazoDoDia14, type LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 90_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = 3_600_000
const DIA = 24 * H
const V2 = [{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }]

describe.skipIf(skipIfNoLocalDb())('F1a-tela-1 T10b: dia 14 com duas versões (banco)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let canal: string
  const usuarios: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId; ctx.siteId = siteId
    ctx.userId = randomUUID(); usuarios.push(ctx.userId)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [ctx.userId, ctx.userId + '@t10b.test'])
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@d14' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'd14-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      for (const t of ['ab_native_tests', 'yt_own_video_meta_daily', 'youtube_videos', 'youtube_channels', 'audit_log', 'notifications']) {
        await pg.query(`delete from public.${t} where site_id = $1`, [siteId]).catch(() => undefined)
      }
      await apagarSites(pg, 'id = $1', [siteId])
      await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
    } finally { await pg.end() }
  })

  /** Vídeo público + registro confirmado há `diasAtras` dias (mais `extraH` horas), com a ficha já vinculada (2 versões). */
  const novo = async (diasAtras: number, extraH = 0, o: Record<string, unknown> = {}): Promise<{ videoId: string; yt: string; regId: string }> => {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const videoId = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'Título ' || $3, now() - interval '60 days', 600) returning id`, [siteId, canal, yt])).rows[0].id)
    await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, privacy_status, captured_at)
      values ($1, (now() at time zone 'America/Sao_Paulo')::date, $2, $3, false, 'public', now())`, [yt, siteId, canal])
    const ini = new Date(Date.now() - diasAtras * DIA - extraH * H).toISOString()
    const c: Record<string, unknown> = {
      site_id: siteId, video_id: videoId, youtube_video_id: yt, origem: 'confirmado', campos: '{titulo}', confirmado_em: ini, confirmado_por: ctx.userId,
      primeira_vista: ini, versao_regra: 1, estado: 'em_andamento', variantes: JSON.stringify(V2), ...o,
    }
    const cols = Object.keys(c)
    const vals = Object.values(c)
    const ph = cols.map((n, i) => (n === 'variantes' || n === 'variantes_titulo' ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')
    const r = await pg.query(`insert into public.ab_native_tests (${cols.join(', ')}) values (${ph}) returning id`, vals)
    return { videoId, yt, regId: String(r.rows[0].id) }
  }
  const ler = async (videoId: string): Promise<LinhaDoCaminho> => {
    const l = (await lerLinhasDoCaminho(sb, siteId, new Date(), await leituraDoEditor(siteId))).find((x) => x.videoId === videoId)
    expect(l).toBeDefined()
    return l!
  }
  /** O mesmo pedido que `Dia14Pergunta` monta ao toque (registro.id e registro.updatedAt da linha lida). */
  const pedido = (l: LinhaDoCaminho, resposta: PedidoRespostaDia14['resposta'], n: number | null): PedidoRespostaDia14 =>
    ({ registroId: l.registro!.id, lido: l.registro!.updatedAt, resposta, n })
  const coluna = async (id: string) => (await pg.query('select * from public.ab_native_tests where id = $1', [id])).rows[0]

  it('os cinco botões gravam o que a tabela de §5.3 manda e a linha relida mostra o estado certo', async () => {
    const casos: [PedidoRespostaDia14['resposta'], number | null, Record<string, unknown>, string][] = [
      ['venceu_original', 1, { resposta_dono: 'venceu_original', variante_vencedora: 1 }, 'ficou_no_ar'],
      ['venceu_nova', 2, { resposta_dono: 'venceu_nova', variante_vencedora: 2 }, 'ficou_no_ar'],
      ['ficou_igual', null, { resposta_dono: 'ficou_igual', variante_vencedora: null }, 'respondido_sem_vencedor'],
      ['inconclusivo', null, { resposta_dono: 'inconclusivo', variante_vencedora: null }, 'respondido_sem_vencedor'],
      ['nao_vi', null, { resposta_dono: 'nao_vi', variante_vencedora: null }, 'respondido_sem_vencedor'],
    ]
    for (const [resposta, n, esperado, estadoDaLinha] of casos) {
      const v = await novo(15)
      const antes = await ler(v.videoId)
      expect(antes.estado).toBe('resultado_pronto')
      expect(versoesDoDia14(antes.registro!)).toMatchObject({ tipo: 'versoes', origem: 'ficha' })
      expect(await responderTesteDoYouTube(pedido(antes, resposta, n))).toEqual({ ok: true, conflito: null })
      expect(await coluna(v.regId)).toMatchObject(esperado)
      const depois = await ler(v.videoId)
      expect(depois.estado).toBe(estadoDaLinha)
      expect(depois.registro?.respostaDono).toBe(resposta)
    }
  })

  it('mutante n: 2 -> null derruba: venceu_nova sem n é variante_invalida e não grava', async () => {
    const v = await novo(15)
    const l = await ler(v.videoId)
    expect(await responderTesteDoYouTube({ ...pedido(l, 'venceu_nova', 2), n: null })).toEqual({ ok: false, erro: 'variante_invalida' })
    expect((await coluna(v.regId)).resposta_dono).toBeNull()
  })

  it('o registrador troca o updated_at entre a leitura e o toque: o CAS relê a linha e a resposta ainda entra (sem erro cru)', async () => {
    const v = await novo(15)
    const l = await ler(v.videoId)
    await pg.query(`update public.ab_native_tests set ultima_vista = now() where id = $1`, [v.regId])
    const trocado = new Date((await coluna(v.regId)).updated_at).getTime()
    expect(trocado).toBeGreaterThan(Date.parse(l.registro!.updatedAt))
    const r = await responderTesteDoYouTube(pedido(l, 'venceu_original', 1))
    expect(r).toEqual({ ok: true, conflito: null })
    expect((await coluna(v.regId)).resposta_dono).toBe('venceu_original')
  })

  it('segunda resposta: ja_respondido (por isso não há "Mudar minha resposta" nesta fase) e a primeira fica', async () => {
    const v = await novo(15)
    const l = await ler(v.videoId)
    expect(await responderTesteDoYouTube(pedido(l, 'ficou_igual', null))).toEqual({ ok: true, conflito: null })
    expect(await responderTesteDoYouTube(pedido(l, 'venceu_nova', 2))).toEqual({ ok: false, erro: 'ja_respondido' })
    expect((await coluna(v.regId)).resposta_dono).toBe('ficou_igual')
  })

  it('linha aberta aos 14 d + 1 h aceita a resposta; aos 13 d 23 h ainda é "em teste", sem pergunta', async () => {
    const cedo = await novo(13, 23)
    expect((await ler(cedo.videoId)).estado).toBe('em_teste_studio')
    const v = await novo(14, 1)
    const l = await ler(v.videoId)
    expect(l.estado).toBe('resultado_pronto')
    expect(await responderTesteDoYouTube(pedido(l, 'venceu_nova', 2))).toEqual({ ok: true, conflito: null })
    expect((await ler(v.videoId)).estado).toBe('ficou_no_ar')
  })

  it('aviso do dia 14 aberto por ?video=: o ytId do aviso acha a linha de resultado pronto (a lista abre a pergunta; jsdom prova a abertura)', async () => {
    const v = await novo(14, 2)
    const linhas = await lerLinhasDoCaminho(sb, siteId, new Date(), await leituraDoEditor(siteId))
    const achada = linhas.find((x) => x.ytId === v.yt)
    expect(achada?.videoId).toBe(v.videoId)
    expect(achada?.estado).toBe('resultado_pronto')
    expect(achada?.registro?.variantes).toHaveLength(2)
  })

  it('ficha sem_desfecho/sem_resposta aos 16 d + 1 h aceita a resposta tardia e a linha passa a ficou_no_ar; a frase tardia usa início + 14 d', async () => {
    const v = await novo(16, 1, { estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'sem_resposta', resposta_dono: 'sem_resposta', encerrado_em: new Date(Date.now() - H).toISOString() })
    const l = await ler(v.videoId)
    expect(l.estado).toBe('sem_resposta')
    const ini = Date.parse(l.registro!.primeiraVista!)
    const prazo = prazoDoDia14({ primeiraVista: l.registro!.primeiraVista, confirmadoEm: l.registro!.confirmadoEm, createdAt: l.registro!.updatedAt })
    expect(prazo.getTime()).toBe(ini + 14 * DIA)
    expect(FRASES.resposta.tardia(prazo)).toMatch(/^O prazo acabou em \d{2}\/\d{2}\. Ainda dá para responder\.$/)
    expect(await responderTesteDoYouTube(pedido(l, 'venceu_nova', 2))).toEqual({ ok: true, conflito: null })
    const depois = await ler(v.videoId)
    expect(depois.estado).toBe('ficou_no_ar')
    expect(depois.registro?.respostaDono).toBe('venceu_nova')
  })

  it('3 versões e origem derivada: a pergunta tem versões (3 de ficha; 2 derivadas sem original conhecido)', async () => {
    const tres = await novo(15, 0, { variantes: JSON.stringify([...V2, { n: 3, tipo: 'titulo', titulo: 'Terceira' }]) })
    const p3 = versoesDoDia14((await ler(tres.videoId)).registro!)
    expect(p3).toMatchObject({ tipo: 'versoes', origem: 'ficha' })
    expect(p3.tipo === 'versoes' && p3.versoes).toHaveLength(3)
    const der = await novo(15, 0, { variantes: null, variantes_titulo: JSON.stringify(['Original', 'Nova']), origem: 'detectado' })
    const l = await ler(der.videoId)
    expect(l.registro?.variantes).toBeNull()
    expect(versoesDoDia14(l.registro!)).toMatchObject({ tipo: 'versoes', origem: 'derivada' })
  })
})
