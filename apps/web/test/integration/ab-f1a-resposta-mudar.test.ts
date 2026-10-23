// @vitest-environment node
/**
 * F1a-tela-2 T3: mudar a resposta do dia 14 contra o banco (CHECKs reais). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-resposta-mudar --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '', negar: false }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => { if (ctx.negar) throw new Error('forbidden'); return { siteId: ctx.siteId, userId: ctx.userId } } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const IMG = { url: 'https://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/a.jpg', sha256: 'a'.repeat(64), largura: 1280, altura: 720 }
const V2 = [{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }]
const V3 = [...V2, { n: 3, tipo: 'combo', titulo: 'Terceira', imagem: IMG }]
const VMINI = [{ n: 1, tipo: 'miniatura', imagem: IMG }, { n: 2, tipo: 'miniatura', imagem: IMG }]

describe.skipIf(skipIfNoLocalDb())('F1a-tela-2 T3: mudar a resposta do dia 14 (banco)', () => {
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


  type R = 'venceu_nova' | 'venceu_original' | 'ficou_igual' | 'inconclusivo' | 'nao_vi'
  type Linha = { id: string; updated_at: string }
  type Resp = { r: R; n: number | null }
  const RESPOSTAS: Resp[] = [{ r: 'venceu_nova', n: 2 }, { r: 'venceu_original', n: null }, { r: 'ficou_igual', n: null }, { r: 'inconclusivo', n: null }, { r: 'nao_vi', n: null }]
  type Partida = { nome: string; titulos: Record<number, string>; criar: () => Promise<Linha> }
  const mudar = (l: Linha, vista: { r: R; v: number | null }, para: Resp, tituloVisto?: string | null) =>
    mudarRespostaDoTesteDoYouTube({ registroId: l.id, lido: l.updated_at, resposta: para.r, n: para.n, respostaVista: vista.r, varianteVista: vista.v, ...(tituloVisto !== undefined ? { tituloVisto } : {}) })
  const tituloDe = (p: Partida, x: Resp): string | null => (x.r === 'venceu_nova' ? p.titulos[x.n!]! : x.r === 'venceu_original' ? p.titulos[1]! : null)
  const aguarda = () => new Promise((ok) => setTimeout(ok, 15))

  const partidas: Partida[] = [
    { nome: '(i) ficha, veredito do dono', titulos: { 1: 'Original', 2: 'Nova', 3: 'Terceira' }, criar: () => confirmada({ variantes: V3 }) },
    { nome: '(ii) derivada com original conhecido', titulos: { 1: 'A', 2: 'B', 3: 'C' }, criar: async () => { await versao('A', 3); return derivadaLinha(['B', 'A', 'C']) } },
    { nome: '(iii) sem_desfecho/teste_novo', titulos: { 1: 'Original', 2: 'Nova', 3: 'Terceira' }, criar: () => confirmada({ variantes: V3, estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'teste_novo', encerrado_em: new Date().toISOString() }) },
  ]

  for (const partida of partidas) {
    describe(partida.nome + ': tabela 5 x 5 (de, para) + n=2 -> n=3', () => {
      const pares: Array<[Resp, Resp]> = []
      for (const de of RESPOSTAS) for (const para of RESPOSTAS) pares.push([de, para])
      pares.push([{ r: 'venceu_nova', n: 2 }, { r: 'venceu_nova', n: 3 }])
      it.each(pares)('%j -> %j', async (de, para) => {
        const a = await partida.criar()
        expect(await resp(a, de.r, de.n, tituloDe(partida, de) ?? undefined)).toMatchObject({ ok: true })
        const antes = await linha(a.id)
        await aguarda()
        const res = await mudar(antes, { r: de.r, v: antes.variante_vencedora }, para, tituloDe(partida, para))
        expect(res).toMatchObject({ ok: true })
        const depois = await linha(a.id)
        const igual = de.r === para.r && de.n === para.n
        // respondido_em e encerrado_em nunca se movem; desfecho_motivo idem; nunca em_andamento
        expect(depois.respondido_em).toBe(antes.respondido_em)
        expect(depois.encerrado_em).toBe(antes.encerrado_em)
        expect(depois.desfecho_motivo).toBe(antes.desfecho_motivo)
        expect(depois.estado).not.toBe('em_andamento')
        if (igual) { expect(depois).toEqual(antes); return }
        expect(depois.resposta_dono).toBe(para.r)
        expect(depois.variante_vencedora).toBe(para.r === 'venceu_original' ? 1 : para.r === 'venceu_nova' ? para.n : null)
        expect(depois.resposta_mudada_em).not.toBeNull()
        expect(depois.desfecho_versao_regra).toBeNull()
        const venceu = para.r.startsWith('venceu')
        expect(depois).toMatchObject({
          estado: para.r === 'nao_vi' ? 'sem_desfecho' : 'encerrado', desfecho_estado: venceu ? 'vencedor_provavel' : 'sem_dado',
          vencedor_titulo: venceu ? tituloDe(partida, para) : null, vencedor_fonte: venceu ? 'dono' : null,
        })
        // invariante: resposta de versão <=> veredito do dono
        expect(['venceu_nova', 'venceu_original'].includes(depois.resposta_dono)).toBe(depois.vencedor_fonte === 'dono')
        const mudouPar = antes.estado !== depois.estado || antes.desfecho_estado !== depois.desfecho_estado || antes.vencedor_titulo !== depois.vencedor_titulo
        expect(depois.desfecho_em !== antes.desfecho_em).toBe(mudouPar)
        const aud = await pg.query(`select after_data from public.audit_log where action = 'ab_native_resposta_mudada' and resource_id = $1`, [a.id])
        expect(aud.rows).toHaveLength(1)
        expect(aud.rows[0].after_data).toMatchObject({ registro_id: a.id, resposta_dono: para.r, resposta_anterior: de.r, variante_anterior: antes.variante_vencedora, estado_anterior: antes.estado })
      })
    })
  }

  it('(iii) bruto: sem_desfecho/teste_novo já respondida "Ficou igual" vira "Venceu a nova" sem perder o motivo', async () => {
    const t = new Date(Date.now() - 86_400_000).toISOString()
    const a = await confirmada({ variantes: V3, estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'teste_novo', encerrado_em: t, resposta_dono: 'ficou_igual', respondido_em: t, variante_vencedora: null })
    const antes = await linha(a.id)
    expect(await mudar(antes, { r: 'ficou_igual', v: null }, { r: 'venceu_nova', n: 2 }, 'Nova')).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ estado: 'encerrado', desfecho_motivo: 'teste_novo', encerrado_em: antes.encerrado_em, respondido_em: antes.respondido_em, vencedor_fonte: 'dono', vencedor_titulo: 'Nova', variante_vencedora: 2 })
  })

  it('ficha só de miniatura (vencedor_titulo nulo, fonte dono) passa fonte_com_vencedor pela variante_vencedora e volta', async () => {
    const a = await confirmada({ variantes: VMINI, campos: ['miniatura'] })
    expect(await resp(a, 'ficou_igual')).toMatchObject({ ok: true })
    const l0 = await linha(a.id)
    expect(await mudar(l0, { r: 'ficou_igual', v: null }, { r: 'venceu_nova', n: 2 }, null)).toMatchObject({ ok: true })
    const l1 = await linha(a.id)
    expect(l1).toMatchObject({ vencedor_fonte: 'dono', vencedor_titulo: null, variante_vencedora: 2 })
    expect(await mudar(l1, { r: 'venceu_nova', v: 2 }, { r: 'nao_vi', n: null })).toMatchObject({ ok: true })
    expect(await linha(a.id)).toMatchObject({ vencedor_fonte: null, vencedor_titulo: null, variante_vencedora: null, estado: 'sem_desfecho' })
  })

  describe.each(['regra', 'data_api'] as const)('veredito de %s: a troca mexe só na resposta', (fonte) => {
    it('muda só resposta_dono, variante_vencedora e resposta_mudada_em; devolve o conflito de D-5', async () => {
      const agora = new Date().toISOString()
      const a = await confirmada({ variantes: V3, estado: 'encerrado', encerrado_em: agora, desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'coleta_encerrada', desfecho_em: agora,
        vencedor_titulo: 'Original', vencedor_fonte: fonte, ...(fonte === 'data_api' ? { vencedor_visto_em: agora } : { desfecho_versao_regra: 1 }) })
      expect(await resp(a, 'ficou_igual')).toEqual({ ok: true, conflito: null })
      const antes = await linha(a.id)
      await aguarda()
      expect(await mudar(antes, { r: 'ficou_igual', v: null }, { r: 'venceu_nova', n: 2 }, 'Nova')).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
      const depois = await linha(a.id)
      const mexeu = Object.keys(depois).filter((k) => JSON.stringify(depois[k]) !== JSON.stringify(antes[k])).sort()
      expect(mexeu).toEqual(['resposta_dono', 'resposta_mudada_em', 'updated_at', 'variante_vencedora'].sort())
      // dono toca o mesmo título do YouTube: sai do conflito
      expect(await mudar(depois, { r: 'venceu_nova', v: 2 }, { r: 'venceu_original', n: null }, 'Original')).toEqual({ ok: true, conflito: null })
      // sem vencedor sobre veredito de regra/data_api nunca é conflito (D-5)
      const meio = await linha(a.id)
      expect(await mudar(meio, { r: 'venceu_original', v: 1 }, { r: 'nao_vi', n: null })).toEqual({ ok: true, conflito: null })
    })
  })

  describe('título visto (renumeração)', () => {
    it('C-B: derivada desconhecida respondida "B ficou"; o registrador acrescenta o original; "C ficou" com título antigo -> estado_mudou, nada gravado', async () => {
      const a = await derivadaLinha(['B', 'C'])
      expect(await resp(a, 'venceu_nova', 1, 'B')).toMatchObject({ ok: true })
      await pg.query(`update public.ab_native_tests set variantes_titulo = '["A","B","C"]'::jsonb where id = $1`, [a.id])
      await versao('A', 3)
      const l0 = await linha(a.id)
      expect(await mudar(l0, { r: 'venceu_nova', v: 1 }, { r: 'venceu_nova', n: 2 }, 'C')).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await mudar(l0, { r: 'venceu_nova', v: 1 }, { r: 'venceu_nova', n: 2 })).toEqual({ ok: false, erro: 'estado_mudou' }) // ausente em derivada
      expect(await linha(a.id)).toEqual(l0)
    })

    it('C-N1: derivada [B,C] respondida n=2 (C); acrescenta "A"; n=2 com título B grava, vencedor_titulo = B', async () => {
      const a = await derivadaLinha(['B', 'C'])
      expect(await resp(a, 'venceu_nova', 2, 'C')).toMatchObject({ ok: true })
      await pg.query(`update public.ab_native_tests set variantes_titulo = '["A","B","C"]'::jsonb where id = $1`, [a.id])
      const l0 = await linha(a.id)
      expect(l0.vencedor_titulo).toBe('C')
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 2 }, 'B')).toMatchObject({ ok: true })
      expect(await linha(a.id)).toMatchObject({ vencedor_titulo: 'B', variante_vencedora: 2 })
      // mesma (resposta, n, título) de novo: sem escrita
      const l1 = await linha(a.id)
      expect(await mudar(l1, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 2 }, 'B')).toMatchObject({ ok: true })
      expect(await linha(a.id)).toEqual(l1)
    })

    it('M4: ja_respondido repetido sobre veredito de regra confere o título que o dono escolheu', async () => {
      const agora = new Date().toISOString()
      const a = await confirmada({ variantes: V3, estado: 'encerrado', encerrado_em: agora, desfecho_estado: 'vencedor_provavel', desfecho_em: agora, vencedor_titulo: 'Original', vencedor_fonte: 'regra', desfecho_versao_regra: 1 })
      expect(await resp(a, 'venceu_nova', 2, 'Nova')).toMatchObject({ ok: true })
      const l0 = await linha(a.id)
      expect(await resp(l0, 'venceu_nova', 2, 'Nova')).toMatchObject({ ok: true })
      expect(await resp(l0, 'venceu_nova', 2, 'Outro')).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(a.id)).toEqual(l0)
    })
  })

  describe('duas abas', () => {
    const pronta = async () => { const a = await confirmada({ variantes: V3 }); await resp(a, 'venceu_nova', 2); return linha(a.id) }
    it('(a) B->C e B->A com o mesmo respostaVista: uma grava, a outra estado_mudou', async () => {
      const l0 = await pronta()
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, 'Terceira')).toMatchObject({ ok: true })
      const l1 = await linha(l0.id)
      // aba 2 relida quanto ao lido, mas ainda com a resposta que viu (B): o CAS por resposta/variante barra
      expect(await mudar({ id: l0.id, updated_at: l1.updated_at }, { r: 'venceu_nova', v: 2 }, { r: 'ficou_igual', n: null })).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(l0.id)).toEqual(l1)
    })
    it('(a2) só a resposta difere (variante nula nas duas): ficou_igual -> inconclusivo numa aba, a outra viu ficou_igual e quer nao_vi', async () => {
      const a = await confirmada({ variantes: V3 }); await resp(a, 'ficou_igual')
      const l0 = await linha(a.id)
      expect(await mudar(l0, { r: 'ficou_igual', v: null }, { r: 'inconclusivo', n: null })).toMatchObject({ ok: true })
      const l1 = await linha(a.id)
      expect(await mudar({ id: a.id, updated_at: l1.updated_at }, { r: 'ficou_igual', v: null }, { r: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(a.id)).toEqual(l1)
    })
    it('(b2) ficha só de miniatura (sem título para distinguir): venceu_nova n=2 e n=3 são respostas diferentes, a troca grava', async () => {
      const a = await confirmada({ variantes: [...VMINI, { n: 3, tipo: 'miniatura', imagem: IMG }], campos: ['miniatura'] }); await resp(a, 'venceu_nova', 2)
      const l0 = await linha(a.id)
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, null)).toMatchObject({ ok: true })
      expect(await linha(a.id)).toMatchObject({ variante_vencedora: 3, vencedor_titulo: null, vencedor_fonte: 'dono' })
    })
    it('(b) B->C e B->C com o mesmo n: a 2a é ok sem escrita', async () => {
      const l0 = await pronta()
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, 'Terceira')).toMatchObject({ ok: true })
      const l1 = await linha(l0.id)
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, 'Terceira')).toMatchObject({ ok: true })
      expect(await linha(l0.id)).toEqual(l1)
      // mesmo toque com outro n: não é a mesma resposta
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_original', n: null }, 'Original')).toEqual({ ok: false, erro: 'estado_mudou' })
    })
    it('(c) aba 1 faz B->C->B; aba 2 (viu B, lido antigo) quer C: estado_mudou', async () => {
      const l0 = await pronta()
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, 'Terceira')).toMatchObject({ ok: true })
      const l1 = await linha(l0.id)
      expect(await mudar(l1, { r: 'venceu_nova', v: 3 }, { r: 'venceu_nova', n: 2 }, 'Nova')).toMatchObject({ ok: true })
      const l2 = await linha(l0.id)
      expect(await mudar(l0, { r: 'venceu_nova', v: 2 }, { r: 'venceu_nova', n: 3 }, 'Terceira')).toEqual({ ok: false, erro: 'estado_mudou' })
      expect(await linha(l0.id)).toEqual(l2)
    })
  })

  it('resposta ainda não dada: nao_respondida; sem permissão recusa; id de outro site: nao_encontrado; respondido_em não vira tardio (preservado)', async () => {
    const a = await confirmada({ variantes: V3 })
    expect(await mudar(a, { r: 'ficou_igual', v: null }, { r: 'venceu_nova', n: 2 }, 'Nova')).toEqual({ ok: false, erro: 'nao_respondida' })
    expect(await resp(a, 'ficou_igual')).toMatchObject({ ok: true })
    const l0 = await linha(a.id)
    ctx.negar = true
    try { expect(await mudar(l0, { r: 'ficou_igual', v: null }, { r: 'nao_vi', n: null })).toMatchObject({ ok: false, erro: 'sem_permissao' }) } finally { ctx.negar = false }
    expect(await linha(a.id)).toEqual(l0)
    ctx.siteId = randomUUID()
    try { expect(await mudar(l0, { r: 'ficou_igual', v: null }, { r: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'nao_encontrado' }) } finally { ctx.siteId = siteId }
    expect(await mudarRespostaDoTesteDoYouTube({ registroId: a.id, lido: l0.updated_at, resposta: 'nao_vi', n: null, respostaVista: 'ficou_igual', varianteVista: null, extra: 1 } as never)).toMatchObject({ ok: false, erro: 'pedido_invalido' })
  })
})
