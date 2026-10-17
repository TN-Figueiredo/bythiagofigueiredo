// @vitest-environment node
// resumeAbTest (P4a T10): a action (sessão + invalidação) e o corpo `retomarTeste` rodam contra o banco falso único
// (helpers/banco-ab) e o YouTubeFalso, com o código real de escrita (applyVariantToYouTube, lerSnippet, escreverTitulo).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { YouTubeFalso } from './helpers/youtube-falso'
import { AGORA, BLOB, IMG, ONTEM, SITE, criarBanco, servicoAtual } from './helpers/banco-ab'
import type { Fila, OpcoesBanco } from './helpers/banco-ab'

const { fanOut, ensureFreshToken, canal, requireSiteScope } = vi.hoisted(() => ({
  fanOut: vi.fn(), ensureFreshToken: vi.fn(), canal: vi.fn(), requireSiteScope: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servicoAtual.cliente }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope,
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: canal,
}))

import { resumeAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { retomarTeste } from '@/lib/youtube/ab-resume'
import type { PortasRetomar } from '@/lib/youtube/ab-resume'
import { MSG_EM_ANDAMENTO, MSG_JA_ENCERRADO } from '@/lib/youtube/ab-acao-saida'
import { revalidatePath, revalidateTag } from 'next/cache'

const MINUTO = 60_000
const antigo = (o: Fila = {}) => ({ estado: 'ok', destino: 'original', em: ONTEM, forcado: false, escreveu: true, erro: null, attempts: 0, ...o })

/** Teste pausado de 2 variantes (A original, B); o ciclo aberto padrão do banco é fechado como na pausa. */
async function montar(o: OpcoesBanco = {}) {
  const banco = criarBanco({ status: 'paused', restoreSeq: 3, restoreStatus: { thumbnail: antigo() }, ...o })
  banco.setTeste({ paused_at: ONTEM })
  Object.assign(banco.ciclos()[0]!, { ended_at: ONTEM, end_reason: 'pausa' })
  servicoAtual.cliente = banco.supabase
  const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
  vi.stubGlobal('fetch', yt.fetch)
  const portas: PortasRetomar = { supabase: banco.supabase, agora: () => AGORA, token: async () => 'tok' }
  return { banco, yt, portas, retomar: (p: Partial<PortasRetomar> = {}) => retomarTeste('teste-1', SITE, { ...portas, ...p }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  ensureFreshToken.mockResolvedValue({ accessToken: 'fresh-token-123' })
  canal.mockResolvedValue('UC1')
  requireSiteScope.mockResolvedValue({ ok: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('resumeAbTest (a action)', () => {
  it('P4a-I6 (i): retomar com escrita ok -> active, restore_status {} (não nulo), um ciclo aberto com cycle_number = max + 1; invalida as telas', async () => {
    const { banco, yt } = await montar()
    const maxAntes = Math.max(...banco.ciclos().map((c) => Number(c.cycle_number)))
    const r = await resumeAbTest('teste-1')
    expect(r).toMatchObject({ ok: true, resultado: 'feito' })
    expect(banco.teste()).toMatchObject({ status: 'active', paused_at: null })
    expect(banco.teste().restore_status).toEqual({})
    expect(banco.ciclosAbertos()).toHaveLength(1)
    expect(banco.cicloAberto()).toMatchObject({ cycle_number: maxAntes + 1, variant_id: 'B' })
    expect(banco.cicloAberto()?.applied_metadata).toEqual({ thumbnail_set: true, youtube_thumbnail_url: 'https://i.ytimg.com/x.jpg' })
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    expect(revalidateTag).toHaveBeenCalledWith('youtube', { expire: 0 })
  })
  it('sessão sem permissão: sem_permissao, nada lido nem escrito', async () => {
    const { banco, yt } = await montar()
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'forbidden' })
    const r = await resumeAbTest('teste-1')
    expect(r).toMatchObject({ ok: false, resultado: 'sem_permissao' })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste()).toMatchObject({ status: 'paused', restore_seq: 3 })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('a action ignora o que a rede mandar além do testId (sem portas injetáveis)', () => {
    expect(resumeAbTest.length).toBe(1)
  })
  it('falha tratada invalida as telas (o teste foi reivindicado e regravado)', async () => {
    const { yt } = await montar()
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await resumeAbTest('teste-1')
    expect(r).toMatchObject({ ok: false, resultado: 'erro' })
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })
  it('recusa antes da reivindicação (não está pausado) não invalida as telas', async () => {
    await montar({ status: 'active' })
    const r = await resumeAbTest('teste-1')
    expect(r).toMatchObject({ ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('retomarTeste: validações antes de reivindicar', () => {
  it('teste pausado de tipo antigo (descrição): recusa, sem escrever, sem reivindicar', async () => {
    const { banco, yt, retomar } = await montar({ testType: 'description' as never })
    const r = await retomar()
    expect(r).toMatchObject({ ok: false, error: 'A descrição não participa mais do teste A/B' })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste().restore_seq).toBe(3)
  })
  it('bloqueia a retomada quando o drift não foi reconhecido; libera quando foi', async () => {
    const a = await montar()
    a.banco.setTeste({ status_note: 'Thumbnail alterado externamente', drift_acknowledged_at: null })
    expect(await a.retomar()).toMatchObject({ ok: false, error: 'Drift não reconhecido. Reconheça a mudança antes de retomar o teste.' })
    expect(a.yt.escritas()).toEqual([])
    a.banco.setTeste({ drift_acknowledged_at: '2026-06-01T12:00:00.000Z' })
    expect((await a.retomar()).ok).toBe(true)
  })
  it('teste que não está pausado -> ja_encerrado, sem escrever', async () => {
    const { yt, retomar } = await montar({ status: 'active' })
    expect(await retomar()).toEqual({ ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO })
    expect(yt.chamadas).toEqual([])
  })
  it('usa o rotation_pattern configurado (round_robin com 1 ciclo: variante B) e o token do canal dono', async () => {
    const { banco, retomar } = await montar({ config: { rotation_pattern: 'round_robin' } })
    await retomar()
    expect(banco.cicloAberto()?.variant_id).toBe('B')
    expect(canal).toHaveBeenCalledWith(expect.anything(), SITE, 'video-interno')
  })
  it('guarda de conteúdo (T9 R1): variante da vez sem cópia no Blob -> não reivindica, não escreve', async () => {
    const { banco, yt, retomar } = await montar({ ajustar: (v) => { v[1]!.blob_url = 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg' } })
    const r = await retomar()
    expect(r).toMatchObject({ ok: false, resultado: 'erro', error: expect.stringContaining('sem arquivo da thumbnail no Blob') })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste()).toMatchObject({ status: 'paused', restore_seq: 3 })
  })
  it('guarda de conteúdo: teste de título com a variante sem texto -> não reivindica', async () => {
    const { banco, yt, retomar } = await montar({ testType: 'title', ajustar: (v) => { v[1]!.title_text = '  ' } })
    const r = await retomar()
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('sem texto de título') })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste().restore_seq).toBe(3)
  })
  it('F-D4: retomar com campo em_andamento há 30 s -> em_andamento, zero reivindicação, zero escritas', async () => {
    const em = new Date(AGORA.getTime() - 30_000).toISOString()
    const { banco, yt, retomar } = await montar({ restoreStatus: { thumbnail: antigo({ estado: 'em_andamento', em, escreveu: null }) } })
    const r = await retomar()
    expect(r).toEqual({ ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste().restore_seq).toBe(3)
  })
  it('F-D4: em_andamento há 3 min (já passou dos 2) não barra a retomada', async () => {
    const em = new Date(AGORA.getTime() - 3 * MINUTO).toISOString()
    const { retomar } = await montar({ restoreStatus: { thumbnail: antigo({ estado: 'em_andamento', em, escreveu: null }) } })
    expect((await retomar()).ok).toBe(true)
  })
  it('retomar com restore_seq trocado (retrato velho) -> não escreve; restore_status intocado', async () => {
    const { banco, yt, retomar } = await montar()
    const retrato = { ...banco.teste() }
    const r = await retomar({ lerRetrato: async () => ({ ...retrato, restore_seq: 2 } as never) })
    expect(r.ok).toBe(false)
    expect(yt.escritas()).toEqual([])
    expect(banco.teste().restore_status).toEqual({ thumbnail: antigo() })
    expect(banco.teste().restore_seq).toBe(3)
  })
})

describe('retomarTeste: reivindicação mantendo paused', () => {
  it('durante a escrita o teste segue paused, com restore_seq + 1 e o campo em_andamento (destino = variante, em = agora, attempts anterior)', async () => {
    const { banco, yt, retomar } = await montar({ restoreStatus: { thumbnail: antigo({ attempts: 2 }) } })
    let visto: Fila | null = null
    yt.antesDeEscrever(() => { visto = structuredClone(banco.teste()) })
    await retomar()
    expect(visto).toMatchObject({ status: 'paused', restore_seq: 4 })
    expect((visto as unknown as Fila).restore_status).toEqual({
      thumbnail: { estado: 'em_andamento', destino: 'B', em: AGORA.toISOString(), forcado: false, escreveu: null, erro: null, attempts: 2 },
    })
  })
  it('combo: os dois campos entram em em_andamento na reivindicação', async () => {
    const { banco, yt, retomar } = await montar({ testType: 'combo', restoreStatus: null })
    let visto: Fila | null = null
    yt.antesDeEscrever(() => { visto ??= structuredClone(banco.teste()) })
    await retomar()
    expect(Object.keys((visto as unknown as Fila).restore_status as object).sort()).toEqual(['thumbnail', 'title'])
  })
  it('retrato velho diz paused mas o banco já está active com o MESMO restore_seq: a guarda de status barra a reivindicação', async () => {
    const { banco, yt, retomar } = await montar()
    const retrato = { ...banco.teste() }
    banco.setTeste({ status: 'active' })
    const r = await retomar({ lerRetrato: async () => retrato as never })
    expect(r.ok).toBe(false)
    expect(yt.escritas()).toEqual([])
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 3 })
  })
  it('duas retomadas ao mesmo tempo: só uma reivindica e escreve; a outra devolve em_andamento (guarda de status e de restore_seq)', async () => {
    const { banco, yt, retomar } = await montar()
    const [a, b] = await Promise.all([retomar(), retomar()])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect([a, b].find((x) => !x.ok)).toMatchObject({ resultado: 'em_andamento' })
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(banco.ciclosAbertos()).toHaveLength(1)
  })
})

describe('retomarTeste: desfechos', () => {
  it('P4a-I6 (ii): sem NENHUMA escrita feita (thumbnails.set recusa) -> paused, restore_status igual ao anterior E count(ab_test_restores) igual (F-B2)', async () => {
    const { banco, yt, retomar } = await montar()
    // a linha que a reivindicação anterior deixou no histórico (a guarda do gatilho reconhece a regravação por ela)
    banco.restores().push({ test_id: 'teste-1', seq: 2, campo: 'thumbnail', estado: 'ok', destino: 'original', em: ONTEM, attempts: 0 })
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const anterior = structuredClone(banco.teste().restore_status)
    const linhas = banco.restores().length
    const r = await retomar()
    expect(r).toMatchObject({ ok: false, resultado: 'erro' })
    expect(banco.teste().status).toBe('paused')
    expect(banco.teste().restore_status).toEqual(anterior)
    expect(banco.restores()).toHaveLength(linhas)
    expect(banco.ciclosAbertos()).toHaveLength(0)
  })
  it('P4a-I6 (ii-b) (Y-B2): combo, thumbnail aceita e título 403 -> paused; thumbnail = ok, destino B, escreveu true; title = o anterior; sem "voltou ao original"', async () => {
    const tituloAntes = antigo({ estado: 'falhou', escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, attempts: 1 })
    const { banco, yt, retomar } = await montar({ testType: 'combo', restoreStatus: { thumbnail: antigo(), title: tituloAntes } })
    yt.recusar('videos.update', 403, 'forbidden')
    const r = await retomar()
    expect(r.ok).toBe(false)
    expect(banco.teste().status).toBe('paused')
    const rs = banco.teste().restore_status as Record<string, Fila>
    expect(rs.thumbnail).toMatchObject({ estado: 'ok', destino: 'B', escreveu: true, forcado: false, erro: null, em: AGORA.toISOString() })
    expect(rs.title).toEqual(tituloAntes)
    expect(yt.escritas()).toEqual(['thumbnails.set', 'videos.update'])
    expect(banco.ciclosAbertos()).toHaveLength(0)
  })
  it('Y-B2 (combo, anterior sem o campo do título): o título que não escreveu fica ausente, não vira em_andamento', async () => {
    const { banco, yt, retomar } = await montar({ testType: 'combo', restoreStatus: { thumbnail: antigo() } })
    yt.recusar('videos.update', 403, 'forbidden')
    await retomar()
    const rs = banco.teste().restore_status as Record<string, Fila>
    expect(rs.title).toBeUndefined()
    expect(rs.thumbnail).toMatchObject({ estado: 'ok', destino: 'B' })
  })
  it('F-P10: retomar que falha num teste ainda nulo (saiu do ar antes da P4a) regrava nulo', async () => {
    const { banco, yt, retomar } = await montar({ restoreStatus: null })
    yt.recusar('thumbnails.set', 403, 'forbidden')
    await retomar()
    expect(banco.teste().restore_status).toBeNull()
    expect(banco.teste().status).toBe('paused')
  })
  it('F-P10 com escrita parcial num teste nulo: só o campo escrito aparece', async () => {
    const { banco, yt, retomar } = await montar({ testType: 'combo', restoreStatus: null })
    yt.recusar('videos.update', 403, 'forbidden')
    await retomar()
    const rs = banco.teste().restore_status as Record<string, Fila>
    expect(Object.keys(rs)).toEqual(['thumbnail'])
  })
  it('a regravação da falha vale só para o restore_seq reivindicado (outro escritor no meio não é sobrescrito)', async () => {
    const { banco, yt, retomar } = await montar()
    yt.recusar('thumbnails.set', 403, 'forbidden')
    yt.antesDeEscrever(() => { banco.setTeste({ restore_seq: 9, restore_status: { thumbnail: antigo({ estado: 'desistiu' }) } }) })
    await retomar()
    expect((banco.teste().restore_status as Record<string, Fila>).thumbnail!.estado).toBe('desistiu')
  })
  it('P4a-I6 (iii): função morta depois do envio (ab_resume_commit lança TypeError) -> campo em_andamento com destino = id da variante, status paused', async () => {
    const { banco, retomar } = await montar()
    banco.rpcLanca('ab_resume_commit', new TypeError('morreu'))
    await expect(retomar()).rejects.toThrow('morreu')
    expect(banco.teste().status).toBe('paused')
    expect((banco.teste().restore_status as Record<string, Fila>).thumbnail).toMatchObject({ estado: 'em_andamento', destino: 'B' })
  })
  it('ab_resume_commit devolve erro -> lança (campo fica em_andamento para o vigia)', async () => {
    const { banco, retomar } = await montar()
    const original = banco.supabase.rpc.bind(banco.supabase)
    ;(banco.supabase as unknown as { rpc: unknown }).rpc = (n: string, a: Record<string, unknown>) =>
      n === 'ab_resume_commit' ? Promise.resolve({ data: null, error: { message: 'deadlock' } }) : original(n as never, a as never)
    await expect(retomar()).rejects.toThrow(/deadlock/)
    expect((banco.teste().restore_status as Record<string, Fila>).thumbnail!.estado).toBe('em_andamento')
  })
  it('Y-D4: retomar perde a vez entre a escrita e o fecho (outra aba encerra) -> ab_resume_commit nulo, nenhum ciclo aberto, status do outro escritor, aviso de cruzamento, sem Sentry de erro', async () => {
    const { banco, yt, retomar } = await montar()
    yt.depoisDeEscrever(() => { banco.setTeste({ status: 'completed', restore_seq: 5 }) })
    const r = await retomar()
    expect(r).toEqual({ ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO })
    expect(banco.ciclosAbertos()).toHaveLength(0)
    expect(banco.teste().status).toBe('completed')
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0].message).toContain('yt-1')
  })
  it('perde a vez ANTES da primeira escrita (a releitura de restore_seq já veio trocada): nada é escrito e nenhum aviso de cruzamento sai', async () => {
    const { banco, yt, retomar } = await montar()
    banco.antesDaReleitura(() => { banco.setTeste({ restore_seq: 8, status: 'completed' }) })
    const r = await retomar()
    expect(r).toMatchObject({ ok: false, resultado: 'ja_encerrado' })
    expect(yt.escritas()).toEqual([])
    expect(fanOut).not.toHaveBeenCalled()
    expect(banco.ciclosAbertos()).toHaveLength(0)
  })
  it('Y-D4: o fecho de retomar zera config.consecutive_failures', async () => {
    const { banco, retomar } = await montar({ config: { rotation_pattern: 'abba', consecutive_failures: 3 } })
    await retomar()
    expect((banco.teste().config as Fila).consecutive_failures).toBe(0)
  })
  it('o fecho limpa status_note e drift_acknowledged_at e fecha o ciclo antigo deixado aberto', async () => {
    const { banco, retomar } = await montar()
    banco.setTeste({ status_note: 'Thumbnail alterado externamente', drift_acknowledged_at: ONTEM })
    Object.assign(banco.ciclos()[0]!, { ended_at: null, end_reason: null })
    await retomar()
    expect(banco.teste()).toMatchObject({ status_note: null, drift_acknowledged_at: null })
    expect(banco.ciclosAbertos()).toHaveLength(1)
  })
  it('falha tratada devolve a mensagem do YouTube em error, sem corpo de resposta', async () => {
    const { yt, retomar } = await montar()
    yt.recusar('thumbnails.set', 403, 'forbidden', { corpo: 'SEGREDO-NO-CORPO' })
    const r = await retomar()
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('SEGREDO-NO-CORPO')
  })
})
