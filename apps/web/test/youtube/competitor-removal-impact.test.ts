// @vitest-environment node
// apps/web/test/youtube/competitor-removal-impact.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseRemovalImpact, semGuardarDe } from '@/lib/youtube/competitor-removal-impact'
import { RULES } from '@/lib/youtube/observatorio/rules'

const OK = { status: 'ok', name: 'Canal Um', videos: 50, pinned: 2, versions: 180, daily_days: 12, bookmarks: 3, videos_leitura_mensal: 4, videos_no_arquivo: 1 }
const ARQ = { status: 'ok', meses: 2, de: '2026-09', ate: '2026-10', registros: 40, fora_do_banco: { meses: 0, de: null, ate: null }, videos_retirados: { n: 0, de: null, ate: null }, imagens_blob: 47 }
const ARQUIVO = { meses: 2, de: '2026-09', ate: '2026-10', foraDoBanco: { meses: 0, de: null, ate: null }, videosRetirados: { n: 0, de: null, ate: null }, imagensBlob: 47 }
const CH = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('parseRemovalImpact', () => {
  it('lê os cinco números e o nome; trocas salvas diferentes de zero', () => {
    expect(parseRemovalImpact(OK)).toEqual({ name: 'Canal Um', videos: 50, pinned: 2, versions: 180, dailyDays: 12, bookmarks: 3, videosLeituraMensal: 4, videosNoArquivo: 1 })
  })
  it('canal sem troca salva: bookmarks é zero de verdade', () => {
    expect(parseRemovalImpact({ ...OK, bookmarks: 0 })!.bookmarks).toBe(0)
  })
  it('canal recém-adicionado, sem nada gravado: zeros de verdade', () => {
    expect(parseRemovalImpact({ status: 'ok', name: null, videos: 0, pinned: 0, versions: 0, daily_days: 0, bookmarks: 0, videos_leitura_mensal: 0, videos_no_arquivo: 0 })).toEqual({ name: null, videos: 0, pinned: 0, versions: 0, dailyDays: 0, bookmarks: 0, videosLeituraMensal: 0, videosNoArquivo: 0 })
  })
  it('canal de outro site (not_found) é nulo, nunca zeros', () => {
    expect(parseRemovalImpact({ status: 'not_found' })).toBeNull()
  })
  it.each([
    ['resposta nula', null],
    ['lista', [OK]],
    ['status desconhecido', { ...OK, status: 'x' }],
    ['número ausente', { status: 'ok', name: 'C', videos: 1, pinned: 0, versions: 3 }],
    ['bookmarks ausente (função antiga no banco)', { status: 'ok', name: 'C', videos: 1, pinned: 0, versions: 3, daily_days: 2 }],
    ['videos_leitura_mensal ausente (função de antes da M10a)', (({ videos_leitura_mensal: _a, ...r }) => (void _a, r))(OK)],
    ['videos_no_arquivo ausente (função de antes da M10a)', (({ videos_no_arquivo: _a, ...r }) => (void _a, r))(OK)],
    ['videos_no_arquivo negativo', { ...OK, videos_no_arquivo: -1 }],
    ['número como texto', { ...OK, versions: '180' }],
    ['número negativo', { ...OK, pinned: -1 }],
  ])('%s lança, nunca vira zero', (_n, data) => {
    expect(() => parseRemovalImpact(data)).toThrow('competitor_channel_removal_impact')
  })
})

const EXTRA_OK = { readings: 20, thumbs: 4, alvos: 2 }
const IMPACTO = { name: 'Canal Um', videos: 50, pinned: 2, versions: 180, dailyDays: 12, bookmarks: 3, videosLeituraMensal: 4, videosNoArquivo: 1, readings: 48, watch: EXTRA_OK }
const AGO = Date.parse('2026-10-19T12:00:00Z')
const DIA = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

interface Cenario {
  allowed?: boolean
  rpc?: Record<string, { data: unknown; error: { message: string } | null }>
  readings?: { count: number | null; error: { message: string } | null }
  canal?: { data: { added_at: string | null } | null; error: { message: string } | null }
}
async function load(o: Cenario = {}) {
  vi.resetModules()
  const order: string[] = [], rpcCalls: Array<[string, unknown]> = [], eqs: Array<[string, unknown]> = [], selects: string[] = []
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => { order.push('guard'); return o.allowed === false ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } } } }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  const rpcs = { competitor_channel_removal_impact: { data: OK, error: null }, competitor_channel_removal_extra: { data: EXTRA_OK, error: null }, obs_archive_channel_archive_impact: { data: ARQ, error: null }, ...(o.rpc ?? {}) }
  const from = (tabela: string) => {
    const q = {
      select: (cols: string) => { selects.push(tabela + ':' + cols); return q },
      eq: (k: string, v: unknown) => { eqs.push([tabela + '.' + k, v]); return q },
      maybeSingle: async () => o.canal ?? { data: { added_at: iso(AGO - 10 * DIA) }, error: null },
      then: (res: (v: unknown) => unknown) => res(o.readings ?? { count: 48, error: null }),
    }
    return q
  }
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => {
    order.push('db')
    return { from, rpc: async (name: string, args: unknown) => { rpcCalls.push([name, args]); return (rpcs as Record<string, { data: unknown; error: { message: string } | null }>)[name] } }
  } }))
  const { getCompetitorRemovalImpactAction } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  const lib = await import('@/lib/youtube/competitor-removal-impact')
  return { act: getCompetitorRemovalImpactAction, lib, order, rpcCalls, eqs, selects }
}

describe('semGuardarDe (I2.1)', () => {
  const L = RULES.removal.semGuardarAteDias
  it('a fronteira é a do banco: 30 dias menos 1 min pode, mais 1 min não', () => {
    expect(semGuardarDe(iso(AGO - L * DIA + 60_000), AGO, L)).toEqual({ pode: true })
    expect(semGuardarDe(iso(AGO - L * DIA - 60_000), AGO, L)).toMatchObject({ pode: false, porque: 'antigo' })
  })
  it('213 dias = 7 meses; menos de 60 dias nunca diz 0 mês', () => {
    expect(semGuardarDe(iso(AGO - 213 * DIA), AGO, L)).toEqual({ pode: false, porque: 'antigo', meses: 7 })
    expect(semGuardarDe(iso(AGO - 31 * DIA), AGO, L)).toEqual({ pode: false, porque: 'antigo', meses: 1 })
  })
  it('data ausente ou ilegível = sem_data', () => {
    expect(semGuardarDe(null, AGO, L)).toEqual({ pode: false, porque: 'sem_data' })
    expect(semGuardarDe('xx', AGO, L)).toEqual({ pode: false, porque: 'sem_data' })
  })
})

describe('getCompetitorRemovalImpact (I2.2, I2.3)', () => {
  it('I2.2 conta as leituras da forja só do canal (a chave do filtro do join) e a watch pela função', async () => {
    const a = await load()
    const r = await a.lib.getCompetitorRemovalImpact('s1', CH)
    expect(r).toEqual({ impact: IMPACTO, addedAt: iso(AGO - 10 * DIA) })
    expect(a.eqs).toContainEqual(['competitor_readings.site_id', 's1'])
    expect(a.eqs).toContainEqual(['competitor_readings.competitor_videos.competitor_channel_id', CH])
    expect(a.selects).toContain('competitor_readings:id, competitor_videos!inner(competitor_channel_id)')
    expect(a.rpcCalls).toContainEqual(['competitor_channel_removal_extra', { p_site: 's1', p_channel: CH }])
    expect(a.eqs).toContainEqual(['competitor_channels.site_id', 's1'])
  })
  it.each([
    ['contagem de leituras nula', { readings: { count: null, error: null } }],
    ['erro na contagem de leituras', { readings: { count: null, error: { message: 'x' } } }],
    ['erro na função da watch', { rpc: { competitor_channel_removal_extra: { data: null, error: { message: 'x' } } } }],
    ['watch sem campo', { rpc: { competitor_channel_removal_extra: { data: { readings: 1, thumbs: 2 }, error: null } } }],
    ['erro ao ler added_at', { canal: { data: null, error: { message: 'x' } } }],
  ] as Array<[string, Cenario]>)('%s lança, nunca vira 0', async (_n, c) => {
    const a = await load(c)
    await expect(a.lib.getCompetitorRemovalImpact('s1', CH)).rejects.toThrow()
  })
  it('I2.3 linha ausente em competitor_channels = nulo', async () => {
    const a = await load({ canal: { data: null, error: null } })
    expect(await a.lib.getCompetitorRemovalImpact('s1', CH)).toBeNull()
  })
  it('I2.3 added_at nulo = devolve o impacto com addedAt nulo (a action diz sem_data)', async () => {
    const a = await load({ canal: { data: { added_at: null }, error: null } })
    expect(await a.lib.getCompetitorRemovalImpact('s1', CH)).toEqual({ impact: IMPACTO, addedAt: null })
  })
  it('I2.3 not_found da função devolve nulo antes de olhar o resto, mesmo com a contagem quebrada', async () => {
    const a = await load({ rpc: { competitor_channel_removal_impact: { data: { status: 'not_found' }, error: null }, competitor_channel_removal_extra: { data: null, error: { message: 'E10:canal_nao_encontrado: neste site' } } }, readings: { count: null, error: { message: 'x' } } })
    expect(await a.lib.getCompetitorRemovalImpact('s1', CH)).toBeNull()
  })
  it('canal sumido entre as leituras (a função da watch diz canal_nao_encontrado) = nulo', async () => {
    const a = await load({ rpc: { competitor_channel_removal_extra: { data: null, error: { message: 'E10:canal_nao_encontrado: neste site' } } } })
    expect(await a.lib.getCompetitorRemovalImpact('s1', CH)).toBeNull()
  })
})

describe('getCompetitorRemovalImpactAction', () => {
  it('o guard vem primeiro; sem acesso a função não é chamada', async () => {
    const a = await load({ allowed: false })
    expect(await a.act(CH)).toEqual({ ok: false })
    expect(a.order).toEqual(['guard'])
  })
  it('chama a função com o site do contexto e o canal pedido', async () => {
    const a = await load()
    expect(await a.act(CH)).toEqual({ ok: true, impact: IMPACTO, semGuardar: { pode: true }, arquivo: ARQUIVO, capacidade: 'nao-nao', dataDoComando: null })
    expect(a.rpcCalls).toContainEqual(['competitor_channel_removal_impact', { p_site_id: 's1', p_channel_id: CH }])
    expect(a.order[0]).toBe('guard')
    expect(a.order.slice(1).every(x => x === 'db')).toBe(true)
  })
  it('T12: lê o arquivo e as imagens do Blob na mesma ação, com o site do contexto', async () => {
    const a = await load()
    await a.act(CH)
    expect(a.rpcCalls).toContainEqual(['obs_archive_channel_archive_impact', { p_site: 's1', p_channel: CH }])
  })
  it('T12: a leitura do arquivo falha, vem fora da forma ou o canal some: ok false (falha_contagem), nunca zero', async () => {
    for (const rpc of [
      { obs_archive_channel_archive_impact: { data: null, error: { message: 'timeout' } } },
      { obs_archive_channel_archive_impact: { data: { status: 'ok' }, error: null } },
      { obs_archive_channel_archive_impact: { data: { status: 'nao_encontrado' }, error: null } },
    ]) expect(await (await load({ rpc })).act(CH)).toEqual({ ok: false })
  })
  it('T12: a capacidade vem do servidor; sem a variável ou com valor que não seja "on", "ainda não tem data" (o item 163)', async () => {
    const antes = { ...process.env }
    try {
      delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL; delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL_DATA
      expect(await (await load()).act(CH)).toMatchObject({ capacidade: 'nao-nao', dataDoComando: null })
      process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'on'; process.env.OBS_ARQUIVO_LIMPEZA_CANAL_DATA = '2026-12-05'
      // o bloco "Canais removidos" ainda não está em produção (BLOCO_CANAIS_REMOVIDOS = false): comando sim, bloco não vira "não, não"
      expect(await (await load()).act(CH)).toMatchObject({ capacidade: 'nao-nao', dataDoComando: '2026-12-05' })
      process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'ON'
      expect(await (await load()).act(CH)).toMatchObject({ capacidade: 'nao-nao' })
    } finally { process.env = antes }
  })
  it('id que não é uuid é recusado sem tocar no banco', async () => {
    const a = await load()
    expect(await a.act('x')).toEqual({ ok: false })
    expect(a.rpcCalls).toEqual([])
  })
  it('canal de outro site, erro do banco e resposta inesperada: ok false, nunca zeros', async () => {
    for (const rpc of [{ competitor_channel_removal_impact: { data: { status: 'not_found' }, error: null } }, { competitor_channel_removal_impact: { data: null, error: { message: 'timeout' } } }, { competitor_channel_removal_impact: { data: { status: 'ok' }, error: null } }]) {
      expect(await (await load({ rpc })).act(CH)).toEqual({ ok: false })
    }
  })
  it('A4.7 semGuardar vem do relógio e do limite das regras (fronteira 30 dias)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(AGO)
    try {
      const L = RULES.removal.semGuardarAteDias
      const dentro = await load({ canal: { data: { added_at: iso(AGO - L * DIA + 60_000) }, error: null } })
      expect(await dentro.act(CH)).toMatchObject({ ok: true, semGuardar: { pode: true } })
      const fora = await load({ canal: { data: { added_at: iso(AGO - L * DIA - 60_000) }, error: null } })
      expect(await fora.act(CH)).toMatchObject({ ok: true, semGuardar: { pode: false, porque: 'antigo', meses: 1 } })
      const sem = await load({ canal: { data: { added_at: null }, error: null } })
      expect(await sem.act(CH)).toMatchObject({ ok: true, semGuardar: { pode: false, porque: 'sem_data' } })
    } finally { vi.useRealTimers() }
  })
})
