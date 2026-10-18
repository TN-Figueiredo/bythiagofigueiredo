// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  guarda: vi.fn(),
  from: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  calls: [] as string[][],
  resultado: { data: [] as unknown[], error: null as null | { code?: string; message: string } },
}))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: m.guarda }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: m.captureMessage, captureException: m.captureException }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: m.from }) }))

import { testeAbertoDe, porVideo, TETO_ABERTOS } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/testes-abertos'
import { lerTestesAbertos } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/ler-testes-abertos'

const U1 = '0b4c1e6a-1111-4222-8333-444455556666'
const U2 = '0b4c1e6a-1111-4222-8333-444455557777'
const dm = (iso: string) => {
  const d = new Date(Date.parse(iso) - 3 * 36e5)
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0')
}
const row = (o: Record<string, unknown> = {}) => ({
  id: 't1', youtube_video_id: U1, test_type: 'thumbnail', status: 'active',
  started_at: '2026-10-18T12:00:00Z', paused_at: null, created_at: '2026-10-10T12:00:00Z', config: {}, ...o,
})

describe('testeAbertoDe', () => {
  it('active com data', () => {
    expect(testeAbertoDe(row(), dm)).toEqual({ id: 't1', estado: 'andamento', href: '/cms/youtube/ab-lab/t1', rotulo: 'Ver teste', curto: 'em andamento', frase: 'Teste de thumbnail em andamento desde 18/10.', aviso: 'Este vídeo já tem um teste em andamento desde 18/10.' })
  })
  it('active sem started_at ou inválido: sem data (Foco 3)', () => {
    expect(testeAbertoDe(row({ started_at: null }), dm)?.frase).toBe('Teste de thumbnail em andamento.')
    const f = testeAbertoDe(row({ started_at: 'lixo' }), dm)?.frase
    expect(f).toBe('Teste de thumbnail em andamento.')
    expect(f).not.toContain('NaN')
  })
  it('fuso de SP: 04:00Z é 01:00 do dia 18 (Foco 6)', () => {
    expect(testeAbertoDe(row({ started_at: '2026-10-18T04:00:00Z' }), dm)?.frase).toContain('desde 18/10')
  })
  it('paused com e sem paused_at', () => {
    expect(testeAbertoDe(row({ status: 'paused', test_type: 'title', paused_at: '2026-10-12T15:00:00Z' }), dm)).toMatchObject({ estado: 'pausado', curto: 'pausado', rotulo: 'Ver teste', frase: 'Teste de título pausado desde 12/10.' })
    expect(testeAbertoDe(row({ status: 'paused', test_type: 'combo' }), dm)?.frase).toBe('Teste A/B pausado.')
  })
  it('queued', () => {
    expect(testeAbertoDe(row({ status: 'queued', test_type: 'description' }), dm)).toMatchObject({ estado: 'fila', curto: 'na fila', rotulo: 'Ver teste', href: '/cms/youtube/ab-lab/t1', frase: 'Teste A/B na fila do A/B Lab.' })
  })
  it('draft aponta para a lista e tem rótulo próprio', () => {
    expect(testeAbertoDe(row({ status: 'draft' }), dm)).toEqual({ id: 't1', estado: 'rascunho', href: '/cms/youtube/ab-lab', rotulo: 'Rascunho no A/B Lab', curto: 'rascunho', frase: 'Rascunho de teste aberto no A/B Lab desde 10/10.', aviso: 'Este vídeo já tem um rascunho de teste desde 10/10.' })
    expect(testeAbertoDe(row({ status: 'draft', created_at: null }), dm)?.frase).toBe('Rascunho de teste aberto no A/B Lab.')
  })
  it('config como {} e como null; linha completed ou ruim: null', () => {
    expect(testeAbertoDe(row({ config: null }), dm)).not.toBeNull()
    expect(testeAbertoDe(row({ config: {} }), dm)).not.toBeNull()
    expect(testeAbertoDe(row({ status: 'completed' }), dm)).toBeNull()
    expect(testeAbertoDe(null, dm)).toBeNull()
    expect(testeAbertoDe({ id: 'x' }, dm)).toBeNull()
  })
})

describe('porVideo', () => {
  it('prioridade active > paused > queued > draft', () => {
    const rows = [row({ id: 'd', status: 'draft' }), row({ id: 'q', status: 'queued' }), row({ id: 'p', status: 'paused' }), row({ id: 'a' })]
    expect(porVideo(rows, dm)[U1]?.id).toBe('a')
    expect(porVideo([rows[0], rows[1]], dm)[U1]?.id).toBe('q')
    expect(porVideo([rows[0], rows[2], rows[1]], dm)[U1]?.id).toBe('p')
  })
  it('a chave é o uuid da FK, nunca o id do YouTube (Q1)', () => {
    const r = porVideo([row()], dm)
    expect(r[U1]).toBeDefined()
    expect(r['dQw4w9WgXcQ']).toBeUndefined()
  })
  it('vídeos diferentes ficam separados', () => {
    const r = porVideo([row(), row({ id: 't2', youtube_video_id: U2 })], dm)
    expect(Object.keys(r).sort()).toEqual([U1, U2])
  })
})

function cliente() {
  m.calls = []
  m.from.mockImplementation((t: string) => {
    const b: Record<string, unknown> = {}
    for (const f of ['select', 'eq', 'in', 'order']) b[f] = (...a: unknown[]) => { m.calls.push([t, f, ...a.map(String)]); return b }
    b.range = async (...a: unknown[]) => { m.calls.push([t, 'range', ...a.map(String)]); return m.resultado }
    return b
  })
}

beforeEach(() => {
  m.guarda.mockReset(); m.from.mockReset(); m.captureMessage.mockReset(); m.captureException.mockReset()
  m.guarda.mockResolvedValue({ ok: true })
  m.resultado = { data: [row()], error: null }
  cliente()
})

describe('lerTestesAbertos', () => {
  it('filtra por site e pelos 4 status (Foco 2)', async () => {
    const r = await lerTestesAbertos('s1')
    expect(r.acesso).toBe('ok')
    expect(m.calls).toContainEqual(['ab_tests', 'eq', 'site_id', 's1'])
    expect(m.calls).toContainEqual(['ab_tests', 'in', 'status', 'draft,active,paused,queued'])
    expect(m.calls).toContainEqual(['ab_tests', 'range', '0', String(TETO_ABERTOS)])
    expect(m.guarda).toHaveBeenCalledWith({ area: 'cms', siteId: 's1', mode: 'edit' })
  })
  it('no vídeo, acrescenta o filtro por uuid', async () => {
    await lerTestesAbertos('s1', { videoUuid: U1 })
    expect(m.calls).toContainEqual(['ab_tests', 'eq', 'youtube_video_id', U1])
  })
  it('sem permissão: negado e o cliente NÃO é chamado', async () => {
    m.guarda.mockResolvedValue({ ok: false })
    expect(await lerTestesAbertos('s1')).toEqual({ acesso: 'negado' })
    expect(m.from).not.toHaveBeenCalled()
  })
  it('guarda que lança: negado, sem tocar o banco', async () => {
    m.guarda.mockRejectedValue(new Error('x'))
    expect(await lerTestesAbertos('s1')).toEqual({ acesso: 'negado' })
    expect(m.from).not.toHaveBeenCalled()
    expect(m.captureException).toHaveBeenCalledTimes(1)
  })
  it('uuid inválido: ok vazio, sem consulta e sem Sentry', async () => {
    expect(await lerTestesAbertos('s1', { videoUuid: 'dQw4w9WgXcQ' })).toEqual({ acesso: 'ok', porVideo: {} })
    expect(m.from).not.toHaveBeenCalled()
    expect(m.captureMessage).not.toHaveBeenCalled()
  })
  it('um aviso exato por estado (decisão b)', () => {
    expect(testeAbertoDe(row({ status: 'active', started_at: null }), dm)?.aviso).toBe('Este vídeo já tem um teste em andamento.')
    expect(testeAbertoDe(row({ status: 'paused', paused_at: '2026-10-14T15:00:00Z' }), dm)?.aviso).toBe('Este vídeo já tem um teste pausado desde 14/10.')
    expect(testeAbertoDe(row({ status: 'queued' }), dm)?.aviso).toBe('Este vídeo já tem um teste na fila do A/B Lab.')
    expect(testeAbertoDe(row({ status: 'draft', created_at: null }), dm)?.aviso).toBe('Este vídeo já tem um rascunho de teste.')
  })
  it('501 linhas: erro e um aviso ao Sentry, sem título nem URL', async () => {
    m.resultado = { data: Array.from({ length: TETO_ABERTOS + 1 }, (_, i) => row({ id: `t${i}`, youtube_video_id: `v${i}` })), error: null }
    expect(await lerTestesAbertos('s1')).toEqual({ acesso: 'erro' })
    expect(m.captureMessage).toHaveBeenCalledTimes(1)
    const extra = JSON.stringify(m.captureMessage.mock.calls[0])
    expect(extra).not.toMatch(/http|title|thumbnail/i)
  })
  it('erro do banco: erro', async () => {
    m.resultado = { data: [], error: { code: '42P01', message: 'boom' } }
    expect(await lerTestesAbertos('s1')).toEqual({ acesso: 'erro' })
    expect(m.captureMessage).toHaveBeenCalledTimes(1)
  })
})
