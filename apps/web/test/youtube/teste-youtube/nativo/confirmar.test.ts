// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { confirmarTesteNoStudio } from '@/lib/youtube/teste-youtube/nativo/confirmar'
import { ORIGINAL } from '@/lib/youtube/ab-settle'
import { roteiro, ok } from '../../../helpers/banco-roteirizado'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const REG = { id: 'r1', video_id: 'v1' }
const base = { siteId: 's1', userId: 'u1' }

describe('confirmarTesteNoStudio: "Confirmar" do cartão S7 (marcador)', () => {
  const origem = { registroId: 'r1', lido: '2026-10-21T10:00:00.123456+00:00' }

  it('CAS ok: confirma e pausa cada teste nosso ativo/pausado do vídeo com teste_youtube, sem escrever no YouTube', async () => {
    const { sb } = roteiro({ ab_native_tests: [ok([REG])], ab_tests: [ok([{ id: 't1' }, { id: 't2' }])] })
    const settle = vi.fn().mockResolvedValue({ resultado: 'feito', campos: {}, pausadoPorTesteYoutube: true })
    const r = await confirmarTesteNoStudio({ ...base, sb, origem, settle })
    expect(r).toEqual({ ok: true, registroId: 'r1', pausados: ['t1', 't2'], naoPausados: [] })
    expect(settle).toHaveBeenCalledTimes(2)
    expect(settle).toHaveBeenCalledWith('t1', { siteId: 's1', destino: ORIGINAL, motivo: 'teste_youtube' })
  })

  it('settleOnAir devolve em_andamento: o marcador continua aceito e o nosso volta em naoPausados', async () => {
    const { sb } = roteiro({ ab_native_tests: [ok([REG])], ab_tests: [ok([{ id: 't1' }])] })
    const settle = vi.fn().mockResolvedValue({ resultado: 'em_andamento', campos: null })
    expect(await confirmarTesteNoStudio({ ...base, sb, origem, settle })).toMatchObject({ ok: true, registroId: 'r1', pausados: [], naoPausados: ['t1'], aviso: expect.any(String) })
  })

  it('settleOnAir lança: a confirmação não é desfeita e volta com aviso', async () => {
    const { sb } = roteiro({ ab_native_tests: [ok([REG])], ab_tests: [ok([{ id: 't1' }])] })
    const settle = vi.fn().mockRejectedValue(new Error('queda'))
    const r = await confirmarTesteNoStudio({ ...base, sb, origem, settle })
    expect(r).toMatchObject({ ok: true, registroId: 'r1', pausados: [], naoPausados: ['t1'] })
    expect(r.ok && r.aviso).toEqual(expect.stringContaining('pausar'))
  })

  it('erro ao listar os testes nossos: confirmação mantida, com aviso', async () => {
    const { sb } = roteiro({ ab_native_tests: [ok([REG])], ab_tests: [{ data: null, error: { message: 'queda' } }] })
    const r = await confirmarTesteNoStudio({ ...base, sb, origem, settle: vi.fn() })
    expect(r).toMatchObject({ ok: true, registroId: 'r1', pausados: [] })
    expect(r.ok && r.aviso).toBeTruthy()
  })

  it('CAS perdido por atualização de evidência: relê uma vez e confirma', async () => {
    const { sb, filas } = roteiro({
      ab_native_tests: [ok([]), ok({ id: 'r1', video_id: 'v1', estado: 'em_andamento', confirmado_em: null, updated_at: '2026-10-21T10:05:00+00:00' }), ok([REG])],
      ab_tests: [ok([])],
    })
    const r = await confirmarTesteNoStudio({ ...base, sb, origem, settle: vi.fn() })
    expect(r).toMatchObject({ ok: true, registroId: 'r1' })
    expect(filas.ab_native_tests).toHaveLength(0)
  })

  it('CAS perdido porque o registrador encerrou: estado_mudou', async () => {
    const { sb } = roteiro({ ab_native_tests: [ok([]), ok({ id: 'r1', video_id: 'v1', estado: 'encerrado', confirmado_em: null, updated_at: 'x' })] })
    expect(await confirmarTesteNoStudio({ ...base, sb, origem, settle: vi.fn() })).toEqual({ ok: false, erro: 'estado_mudou', registroId: 'r1' })
  })

  it('já confirmada: ja_confirmado; sumiu ou de outro site: nao_encontrada', async () => {
    const a = roteiro({ ab_native_tests: [ok([]), ok({ id: 'r1', video_id: 'v1', estado: 'em_andamento', confirmado_em: '2026-10-20T00:00:00Z', updated_at: 'x' })] })
    expect(await confirmarTesteNoStudio({ ...base, sb: a.sb, origem, settle: vi.fn() })).toEqual({ ok: false, erro: 'ja_confirmado', registroId: 'r1' })
    const b = roteiro({ ab_native_tests: [ok([]), ok(null)] })
    expect(await confirmarTesteNoStudio({ ...base, sb: b.sb, origem, settle: vi.fn() })).toEqual({ ok: false, erro: 'nao_encontrada' })
  })

  it('erro de banco na confirmação lança (a action traduz); nada de settle', async () => {
    const { sb } = roteiro({ ab_native_tests: [{ data: null, error: { message: 'queda' } }] })
    const settle = vi.fn()
    await expect(confirmarTesteNoStudio({ ...base, sb, origem, settle })).rejects.toThrow('queda')
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('confirmarTesteNoStudio: "Já iniciei" (ficha)', () => {
  const origem = { fichaId: 'f1' }
  it('iniciar ok: lê o vídeo do registro e pausa o nosso', async () => {
    const { sb } = roteiro({ 'rpc:ab_native_iniciar': [ok({ ok: true, registro_id: 'r1', confirmou_detectado: false })], ab_native_tests: [ok(REG)], ab_tests: [ok([{ id: 't1' }])] })
    const settle = vi.fn().mockResolvedValue({ resultado: 'feito', campos: {} })
    expect(await confirmarTesteNoStudio({ ...base, sb, origem, settle })).toEqual({ ok: true, registroId: 'r1', pausados: ['t1'], naoPausados: [] })
  })
  it('ja_iniciada: idempotente, tenta a pausa de novo', async () => {
    const { sb } = roteiro({ 'rpc:ab_native_iniciar': [ok({ ok: true, ja_iniciada: true, registro_id: 'r1' })], ab_native_tests: [ok(REG)], ab_tests: [ok([])] })
    expect(await confirmarTesteNoStudio({ ...base, sb, origem, settle: vi.fn() })).toEqual({ ok: true, registroId: 'r1', pausados: [], naoPausados: [] })
  })
  it.each([
    [{ erro: 'nao_encontrada' }, { ok: false, erro: 'nao_encontrada' }],
    [{ erro: 'ficha_incompleta', motivo: 'variantes' }, { ok: false, erro: 'ficha_incompleta' }],
    [{ erro: 'ja_ha_teste_em_andamento', registro_id: 'r9' }, { ok: false, erro: 'ja_ha_teste_em_andamento', registroId: 'r9' }],
    [{ erro: 'estado_mudou' }, { ok: false, erro: 'estado_mudou' }],
  ])('traduz %j', async (rpc, esperado) => {
    const settle = vi.fn()
    const { sb } = roteiro({ 'rpc:ab_native_iniciar': [ok(rpc)] })
    expect(await confirmarTesteNoStudio({ ...base, sb, origem, settle })).toEqual(esperado)
    expect(settle).not.toHaveBeenCalled()
  })
})
