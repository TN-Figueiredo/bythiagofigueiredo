// @vitest-environment node
/**
 * F1a-dado T11: resposta do dia 14 contra o banco (CHECKs reais). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-resposta --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '' }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => ({ siteId: ctx.siteId, userId: ctx.userId }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { responderTesteDoYouTube } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const IMG = { url: 'https://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/a.jpg', sha256: 'a'.repeat(64), largura: 1280, altura: 720 }
const V2 = [{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }]
const V3 = [...V2, { n: 3, tipo: 'combo', titulo: 'Terceira', imagem: IMG }]
const VMINI = [{ n: 1, tipo: 'miniatura', imagem: IMG }, { n: 2, tipo: 'miniatura', imagem: IMG }]

describe.skipIf(skipIfNoLocalDb())('F1a-dado T11: resposta do dia 14 (banco)', () => {
  let pg: Client
  let siteId: string
  let videoId: string
  let ytId: string
  const usuarios: string[] = []

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    ctx.userId = randomUUID(); usuarios.push(ctx.userId)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [ctx.userId, ctx.userId + '@f1a.test'])
  })
  afterAll(async () => {
    try { await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios]) } finally { await pg.end() }
  })
  beforeEach(async () => {
    const t = await semearTesteAb({ status: 'active', testType: 'title', cicloAberto: 0 })
    siteId = t.siteId; ctx.siteId = siteId
    videoId = (await clienteServico().from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()).data!.youtube_video_id as string
    ytId = String((await pg.query('select youtube_video_id from public.youtube_videos where id = $1', [videoId])).rows[0].youtube_video_id)
  })

  const base = () => ({ site_id: siteId, video_id: videoId, youtube_video_id: ytId.slice(0, 11).padEnd(11, 'x'), campos: ['titulo'] })
  const confirmada = async (o: Record<string, unknown> = {}): Promise<{ id: string; updated_at: string }> => {
    const r = await clienteServico().from('ab_native_tests').insert({
      ...base(), origem: 'confirmado', estado: 'em_andamento', confirmado_em: new Date().toISOString(), confirmado_por: ctx.userId, variantes: V2, ...o,
    }).select('id, updated_at').single()
    expect(r.error).toBeNull()
    return r.data as { id: string; updated_at: string }
  }
  const linha = async (id: string) => (await clienteServico().from('ab_native_tests').select('*').eq('id', id).single()).data!
  const resp = (l: { id: string; updated_at: string }, resposta: 'venceu_nova' | 'venceu_original' | 'ficou_igual' | 'inconclusivo' | 'nao_vi', n: number | null = null, tituloVisto?: string | null) =>
    responderTesteDoYouTube({ registroId: l.id, lido: l.updated_at, resposta, n, ...(tituloVisto !== undefined ? { tituloVisto } : {}) })
  const PV_MS = () => Date.now() - 3_600_000
  /** Versão de título em `yt_own_video_versions` (a que a Data API viu), `diasAntes` dias antes da primeira_vista. */
  let seqVersao = 0
  const versao = async (titulo: string, diasAntes: number, origin = 'linha_de_base', evento = 'rotacao', quandoIso?: string): Promise<void> => {
    const canal = String((await pg.query('select channel_id from public.youtube_videos where id = $1', [videoId])).rows[0].channel_id)
    const quando = quandoIso ?? new Date(PV_MS() - diasAntes * 86_400_000 - (seqVersao++) * 1000).toISOString()
    const extra = origin === 'ab_lab' ? { precision: 'min', evento } : { precision: origin === 'linha_de_base' ? 'first' : '1d', evento: null }
    await pg.query(`insert into public.yt_own_video_versions (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt,
        first_seen_at, last_seen_at, window_precision, origin, ab_event, is_current, window_start, window_end)
      values ($1, $2, $3, 'title', $4, $5, ($6::timestamptz at time zone 'America/Sao_Paulo')::date, ($6::timestamptz at time zone 'America/Sao_Paulo')::date, $6, $6, $7, $8, $9, false,
        case when $7 = 'first' then null else $6::timestamptz end, case when $7 = 'first' then null else $6::timestamptz end)`,
    [base().youtube_video_id, siteId, canal, titulo, randomUUID().replace(/-/g, '').slice(0, 32), quando, extra.precision, origin, extra.evento])
  }
  const derivadaLinha = (titulos: string[], o: Record<string, unknown> = {}) =>
    confirmada({ origem: 'detectado', variantes: null, variantes_titulo: titulos, primeira_vista: new Date(PV_MS()).toISOString(), versao_regra: 1, ...o })

  it('um caso por botão grava a linha da tabela de §5.3', async () => {
    const a = await confirmada()
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'resposta_do_dono', resposta_dono: 'venceu_nova', variante_vencedora: 2, vencedor_titulo: 'Nova', vencedor_fonte: 'dono' })
    await pg.query('delete from public.ab_native_tests where id = $1', [a.id])

    const b = await confirmada()
    expect(await resp(b, 'venceu_original')).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', resposta_dono: 'venceu_original', variante_vencedora: 1, vencedor_titulo: 'Original', vencedor_fonte: 'dono' })
    await pg.query('delete from public.ab_native_tests where id = $1', [b.id])

    for (const [r, estado] of [['ficou_igual', 'encerrado'], ['inconclusivo', 'encerrado'], ['nao_vi', 'sem_desfecho']] as const) {
      const c = await confirmada()
      expect(await resp(c, r)).toEqual({ ok: true, conflito: null })
      const l = await linha(c.id)
      expect(l).toMatchObject({ estado, desfecho_estado: 'sem_dado', resposta_dono: r, variante_vencedora: null, vencedor_titulo: null, vencedor_fonte: null })
      expect(l.respondido_em).not.toBeNull()
      expect(l.encerrado_em).not.toBeNull()
      await pg.query('delete from public.ab_native_tests where id = $1', [c.id])
    }
  })

  it('"Venceu a nova" só de miniatura passa no CHECK novo (sem título, com variante)', async () => {
    const a = await confirmada({ variantes: VMINI })
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ variante_vencedora: 2, vencedor_titulo: null, vencedor_fonte: 'dono', estado: 'encerrado' })
  })

  it('3 variantes: n=3 grava e n=4 recusa; n=1 em venceu_nova com ficha recusa', async () => {
    const a = await confirmada({ variantes: V3 })
    expect(await resp(a, 'venceu_nova', 4)).toMatchObject({ ok: false })
    expect(await resp(a, 'venceu_nova', 1)).toEqual({ ok: false, erro: 'variante_invalida' })
    expect((await linha(a.id)).resposta_dono).toBeNull()
    expect(await resp(a, 'venceu_nova', 3)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ variante_vencedora: 3, vencedor_titulo: 'Terceira' })
  })

  it('detectado confirmado sem ficha, variantes_titulo [A,B]: n=2 grava o 2º título; n=1 grava o 1º', async () => {
    const mk = () => confirmada({ origem: 'detectado', variantes: null, variantes_titulo: ['A', 'B'], primeira_vista: new Date(Date.now() - 3_600_000).toISOString(), versao_regra: 1 })
    const a = await mk()
    expect(await resp(a, 'venceu_nova', 2, 'B')).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ vencedor_titulo: 'B', vencedor_fonte: 'dono', variante_vencedora: 2 })
    await pg.query('delete from public.ab_native_tests where id = $1', [a.id])
    const b = await mk()
    expect(await resp(b, 'venceu_nova', 1, 'A')).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ vencedor_titulo: 'A', vencedor_fonte: 'dono', variante_vencedora: 1 })
    await pg.query('delete from public.ab_native_tests where id = $1', [b.id])
    const c = await mk()
    expect(await resp(c, 'venceu_original', null, 'A')).toEqual({ ok: false, erro: 'variante_invalida' })
  })

  it('sem_desfecho sem fonte (e sem_resposta no dia 17): a resposta vira desfecho; encerrado_em fica; o CHECK não estoura', async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString()
    const a = await confirmada({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'oficial_nao_lido', encerrado_em: ontem })
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    const l = await linha(a.id)
    expect(l).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'resposta_do_dono', vencedor_fonte: 'dono', vencedor_titulo: 'Nova' })
    expect(new Date(l.encerrado_em).getTime()).toBe(new Date(ontem).getTime())

    const b = await confirmada({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'sem_resposta', resposta_dono: 'sem_resposta', encerrado_em: ontem })
    expect(await resp(b, 'venceu_original')).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ estado: 'encerrado', resposta_dono: 'venceu_original', vencedor_fonte: 'dono', variante_vencedora: 1 })
    expect((await linha(b.id)).respondido_em).not.toBeNull()
  })

  it('vencedor da data_api no outro lado: guarda as duas e devolve conflito, sem mexer no veredito', async () => {
    const agora = new Date().toISOString()
    const a = await confirmada({ estado: 'encerrado', encerrado_em: agora, desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'data_api', vencedor_titulo: 'Original', vencedor_fonte: 'data_api', vencedor_visto_em: agora })
    const r = await resp(a, 'venceu_nova', 2)
    expect(r).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    expect(await linha(a.id)).toMatchObject({ resposta_dono: 'venceu_nova', variante_vencedora: 2, vencedor_titulo: 'Original', vencedor_fonte: 'data_api', estado: 'encerrado' })
  })

  it('sem_desfecho COM vencedor_fonte (data_api) e título: conflito, estado e veredito intactos (Phil m2, Yannis C1)', async () => {
    const agora = new Date().toISOString()
    const a = await confirmada({ estado: 'sem_desfecho', encerrado_em: agora, desfecho_estado: 'sem_dado', desfecho_motivo: 'oficial_nao_lido', vencedor_titulo: 'Original', vencedor_fonte: 'data_api', vencedor_visto_em: agora })
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    expect(await linha(a.id)).toMatchObject({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'oficial_nao_lido', resposta_dono: 'venceu_nova', variante_vencedora: 2, vencedor_titulo: 'Original', vencedor_fonte: 'data_api' })
  })

  it('resposta tardia em sem_desfecho/teste_novo: o desfecho_motivo fica (o registrador corta a janela por ele) (Phil C1)', async () => {
    const T = new Date(Date.now() - 5 * 86_400_000)
    const a = await confirmada({ origem: 'detectado', variantes: null, variantes_titulo: ['Original', 'Nova'], primeira_vista: new Date(T.getTime() - 3_600_000).toISOString(), ultima_vista: T.toISOString(), versao_regra: 1,
      estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'teste_novo', encerrado_em: new Date(T.getTime() + 2 * 3_600_000).toISOString() })
    expect(await resp(a, 'venceu_nova', 2, 'Nova')).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ estado: 'encerrado', desfecho_motivo: 'teste_novo', resposta_dono: 'venceu_nova', vencedor_fonte: 'dono', vencedor_titulo: 'Nova' })
  })

  it('a resposta deixa rastro em audit_log (quem, resposta, estado anterior) (Phil m3)', async () => {
    const a = await confirmada()
    expect(await resp(a, 'ficou_igual')).toEqual({ ok: true, conflito: null })
    const r = await pg.query(`select actor_user_id, site_id, after_data from public.audit_log where action = 'ab_native_respondido' and resource_id = $1`, [a.id])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ actor_user_id: ctx.userId, site_id: siteId, after_data: { registro_id: a.id, resposta_dono: 'ficou_igual', estado_anterior: 'em_andamento' } })
  })

  it('duas respostas seguidas: a 2ª devolve ja_respondido e a linha fica igual à da 1ª', async () => {
    const a = await confirmada()
    expect(await resp(a, 'ficou_igual')).toEqual({ ok: true, conflito: null })
    const antes = await linha(a.id)
    expect(await resp({ id: a.id, updated_at: antes.updated_at }, 'venceu_nova', 2)).toEqual({ ok: false, erro: 'ja_respondido' })
    expect(await linha(a.id)).toEqual(antes)
  })

  it('CAS velho (o registrador mexeu depois da leitura da tela): relê e grava uma vez', async () => {
    const a = await confirmada()
    await pg.query(`update public.ab_native_tests set ultima_vista = now() where id = $1`, [a.id])
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect((await linha(a.id)).resposta_dono).toBe('venceu_nova')
  })

  it('responder derruba o número que o sino lê (mesmo filtro de /api/notifications/count)', async () => {
    const a = await confirmada()
    const ins = await clienteServico().from('notifications').insert({
      site_id: siteId, user_id: ctx.userId, type: 'youtube.native_lembrete', domain: 'youtube', priority: 3, title: 'Como foi o teste?', dedup_key: `lembrete-nativo:${a.id}`,
    })
    expect(ins.error).toBeNull()
    const contador = async () => (await clienteServico().from('notifications').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('user_id', ctx.userId).is('dismissed_at', null).is('expired_at', null).is('read_at', null)).count
    expect(await contador()).toBe(1)
    expect(await resp(a, 'nao_vi')).toEqual({ ok: true, conflito: null })
    expect(await contador()).toBe(0)
  })

  it('sem permissão e pedido inválido não escrevem', async () => {
    const a = await confirmada()
    expect(await responderTesteDoYouTube({ registroId: 'nao-uuid', lido: a.updated_at, resposta: 'nao_vi', n: null })).toMatchObject({ ok: false, erro: 'pedido_invalido' })
    expect((await linha(a.id)).resposta_dono).toBeNull()
  })

  it('detectada não confirmada e linha de outro site não são respondíveis', async () => {
    const d = await clienteServico().from('ab_native_tests').insert({
      ...base(), origem: 'detectado', estado: 'em_andamento', variantes_titulo: ['A', 'B'], primeira_vista: new Date(Date.now() - 3_600_000).toISOString(), versao_regra: 1,
    }).select('id, updated_at').single()
    expect(await resp(d.data as { id: string; updated_at: string }, 'nao_vi')).toEqual({ ok: false, erro: 'nao_respondivel' })
    await pg.query('delete from public.ab_native_tests where video_id = $1', [videoId])
    const a = await confirmada()
    ctx.siteId = randomUUID()
    expect(await resp(a, 'nao_vi')).toEqual({ ok: false, erro: 'nao_encontrado' })
    ctx.siteId = siteId
  })

  describe('T2: original da derivada pelo título vigente na Data API', () => {
    it('"A (original) ficou": venceu_original grava variante 1 e o título de antes (CHECK real)', async () => {
      await versao('A', 3)
      const a = await derivadaLinha(['B', 'A'])
      expect(await resp(a, 'venceu_original', null, 'A')).toEqual({ ok: true, conflito: null })
      expect(await linha(a.id)).toMatchObject({ resposta_dono: 'venceu_original', variante_vencedora: 1, vencedor_titulo: 'A', vencedor_fonte: 'dono', variantes: null, desfecho_versao_regra: null })
      const r = await pg.query(`select after_data from public.audit_log where action = 'ab_native_respondido' and resource_id = $1`, [a.id])
      expect(r.rows[0].after_data.variante_vencedora).toBe(1)
    })
    it('sem versão anterior: originalConhecido false e venceu_original dá variante_invalida; versão do Lab é ignorada', async () => {
      const a = await derivadaLinha(['B', 'A'])
      expect(await resp(a, 'venceu_original', null, 'B')).toEqual({ ok: false, erro: 'variante_invalida' })
      await versao('A', 3, 'ab_lab')
      expect(await resp(a, 'venceu_original', null, 'B')).toEqual({ ok: false, erro: 'variante_invalida' })
      expect((await linha(a.id)).resposta_dono).toBeNull()
    })
    it('I-1: título de vencedor (ou restauro) aplicado pelo Lab antes da primeira_vista conta como título de antes; rotação do Lab não conta', async () => {
      await versao('O', 9); await versao('W', 3, 'ab_lab', 'vencedor')
      const a = await derivadaLinha(['X', 'W'])
      expect(await resp(a, 'venceu_original', null, 'W')).toEqual({ ok: true, conflito: null })
      expect(await linha(a.id)).toMatchObject({ variante_vencedora: 1, vencedor_titulo: 'W', vencedor_fonte: 'dono' })
      await pg.query('delete from public.ab_native_tests where id = $1', [a.id])
      await versao('R', 1, 'ab_lab', 'restauro')
      const r = await derivadaLinha(['X', 'R'])
      expect(await resp(r, 'venceu_original', null, 'R')).toEqual({ ok: true, conflito: null })
    })
    it('I-1: a rotação do Lab, mesmo a mais recente antes da primeira_vista, não vira título de antes', async () => {
      await versao('O', 9); await versao('Rot', 1, 'ab_lab', 'rotacao')
      const a = await derivadaLinha(['X', 'Rot'])
      // o original é O (a rotação não conta): 'Rot' não é a versão 1, a tela relê
      expect(await resp(a, 'venceu_original', null, 'Rot')).toEqual({ ok: false, erro: 'estado_mudou' })
      await pg.query('delete from public.ab_native_tests where id = $1', [a.id])
      const b = await derivadaLinha(['X', 'O'])
      expect(await resp(b, 'venceu_original', null, 'O')).toEqual({ ok: true, conflito: null })
    })
    it('fronteira: versão com first_seen_at IGUAL a primeira_vista conta; dois dias depois não', async () => {
      const pv = new Date(PV_MS()).toISOString()
      await versao('Igual', 0, 'linha_de_base', 'rotacao', pv)
      await versao('Depois', 0, 'linha_de_base', 'rotacao', new Date(Date.parse(pv) + 2 * 86_400_000).toISOString())
      const a = await derivadaLinha(['X', 'Igual'], { primeira_vista: pv })
      expect(await resp(a, 'venceu_original', null, 'Igual')).toEqual({ ok: true, conflito: null })
    })
    it('resposta que não é venceu_*: não consulta o título de antes', async () => {
      await versao('A', 3)
      const cli = clienteServico()
      const alvos: string[] = []
      const orig = cli.from.bind(cli)
      vi.spyOn(cli, 'from').mockImplementation(((t: string) => { alvos.push(t); return orig(t) }) as typeof cli.from)
      const mod = await import('@/lib/youtube/teste-youtube/nativo/resposta')
      const d = await derivadaLinha(['B', 'A'])
      const r = await mod.responderDia14({ sb: cli, siteId, userId: ctx.userId, registroId: d.id, lido: d.updated_at, resposta: 'nao_vi', n: null, agora: new Date() })
      vi.restoreAllMocks()
      expect(r).toEqual({ ok: true, conflito: null })
      expect(alvos.filter((t) => t === 'yt_own_video_versions')).toHaveLength(0)
    })
    it('I-2: duas abas com renumeração: a mesma (resposta, n) com OUTRO título -> estado_mudou, linha intacta; o mesmo título -> ok', async () => {
      await versao('A', 3)
      const a = await derivadaLinha(['B', 'C'])
      expect(await resp(a, 'venceu_nova', 2, 'C')).toEqual({ ok: true, conflito: null }) // aba 1: C era o n=2
      await pg.query(`update public.ab_native_tests set variantes_titulo = '["B","C","A"]'::jsonb where id = $1`, [a.id])
      const gravada = await linha(a.id)
      // aba 2 relida: A, B, C; toca "B ficou" = n=2 e tituloVisto B
      expect(await resp({ id: a.id, updated_at: gravada.updated_at }, 'venceu_nova', 2, 'B')).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(a.id)).toEqual(gravada)
      expect(await resp({ id: a.id, updated_at: gravada.updated_at }, 'venceu_nova', 2, 'C')).toEqual({ ok: true, conflito: null })
    })
    it('usa a versão mais recente até primeira_vista, não a de hoje', async () => {
      await versao('Velho', 9); await versao('A', 3); await versao('Depois', -2)
      const a = await derivadaLinha(['B', 'A'])
      expect(await resp(a, 'venceu_original', null, 'A')).toEqual({ ok: true, conflito: null })
    })
    it('CORRIDA: derivada desconhecida [B,C]; o registrador acrescenta A (numeração vira A,B,C): "C ficou" n=2 -> estado_mudou, nada gravado', async () => {
      const a = await derivadaLinha(['B', 'C'])
      await versao('A', 3)
      await pg.query(`update public.ab_native_tests set variantes_titulo = '["B","C","A"]'::jsonb where id = $1`, [a.id])
      expect(await resp(a, 'venceu_nova', 2, 'C')).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(a.id)).toMatchObject({ resposta_dono: null, vencedor_titulo: null, vencedor_fonte: null })
      // caso extra: n=1 com 'B' na mesma corrida cai em estado_mudou pela conferência (sem ela daria variante_invalida por acidente)
      expect(await resp(a, 'venceu_nova', 1, 'B')).toEqual({ ok: false, erro: 'estado_mudou' })
      // a tela relê: com a numeração certa (C é o n=3), grava o título certo
      const nova = await linha(a.id)
      expect(await resp({ id: a.id, updated_at: nova.updated_at }, 'venceu_nova', 3, 'C')).toEqual({ ok: true, conflito: null })
      expect(await linha(a.id)).toMatchObject({ variante_vencedora: 3, vencedor_titulo: 'C', vencedor_fonte: 'dono' })
    })
    it('tituloVisto ausente numa derivada -> estado_mudou; ausente numa ficha -> grava', async () => {
      await versao('A', 3)
      const d = await derivadaLinha(['A', 'B'])
      expect(await resp(d, 'venceu_nova', 2)).toEqual({ ok: false, erro: 'estado_mudou' })
      expect((await linha(d.id)).resposta_dono).toBeNull()
      await pg.query('delete from public.ab_native_tests where id = $1', [d.id])
      const f = await confirmada({ origem: 'confirmado' })
      expect(await resp(f, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    })
    it('ja_respondido: a mesma resposta e n -> ok sem escrever; diferente -> ja_respondido', async () => {
      const a = await confirmada()
      expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
      const antes = await linha(a.id)
      expect(await resp({ id: a.id, updated_at: antes.updated_at }, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
      expect(await linha(a.id)).toEqual(antes)
      expect(await resp({ id: a.id, updated_at: antes.updated_at }, 'ficou_igual')).toEqual({ ok: false, erro: 'ja_respondido' })
    })
    it('a 1ª resposta sobre sem_desfecho/coleta_encerrada deixa desfecho_versao_regra nulo', async () => {
      const a = await confirmada({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'coleta_encerrada', desfecho_versao_regra: 1, encerrado_em: new Date(Date.now() - 86_400_000).toISOString() })
      expect(await resp(a, 'venceu_nova', 2, 'Nova')).toEqual({ ok: true, conflito: null })
      expect(await linha(a.id)).toMatchObject({ estado: 'encerrado', desfecho_versao_regra: null, vencedor_fonte: 'dono' })
    })
    it('lerLinha + título de antes: no máximo 2 leituras na derivada e 1 na ficha', async () => {
      await versao('A', 3)
      const cli = clienteServico()
      const alvos: string[] = []
      const orig = cli.from.bind(cli)
      vi.spyOn(cli, 'from').mockImplementation(((t: string) => { alvos.push(t); return orig(t) }) as typeof cli.from)
      const mod = await import('@/lib/youtube/teste-youtube/nativo/resposta')
      const d = await derivadaLinha(['B', 'A'])
      const r = await mod.responderDia14({ sb: cli, siteId, userId: ctx.userId, registroId: d.id, lido: d.updated_at, resposta: 'venceu_original', n: null, tituloVisto: 'A', agora: new Date() })
      expect(r).toEqual({ ok: true, conflito: null })
      expect(alvos.filter((t) => t === 'ab_native_tests' || t === 'yt_own_video_versions').slice(0, 2)).toEqual(['ab_native_tests', 'yt_own_video_versions'])
      expect(alvos.filter((t) => t === 'yt_own_video_versions')).toHaveLength(1)
      vi.restoreAllMocks()
    })
  })
})
