// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { descartarDetectado } from '@/lib/youtube/teste-youtube/nativo/descartar'
import { rodarRegistro } from '@/lib/youtube/teste-youtube/registro/tarefa'
import { roteiro, ok } from '../../../helpers/banco-roteirizado'
import { rodadas } from '../sintetico'
import { H, MIN, T0, avaliacaoSemente, contexto, ir, iso, mundo, yt } from '../registro/mundo'

const base = { siteId: 's1', userId: 'u1', orgId: 'o1', registroId: 'r1', lido: '2026-10-21T10:00:00.123456+00:00' }
const atual = (o: Record<string, unknown>) => ok({ id: 'r1', estado: 'em_andamento', confirmado_em: null, updated_at: '2026-10-21T10:05:00+00:00', ...o })

describe('descartarDetectado', () => {
  it('detectada: descartada, com audit_log só de ids e do estado anterior', async () => {
    const r = roteiro({ ab_native_tests: [ok([{ id: 'r1' }])], audit_log: [ok(null)] })
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: true })
    const upd = r.chamadas[0]!.metodos.join(' ')
    expect(upd).toContain('"descartado"')
    expect(upd).toContain('"u1"')
    expect(r.chamadas[0]!.metodos).toContain('is("confirmado_em",null)')
    expect(r.chamadas[0]!.metodos).toContain('eq("site_id","s1")')
    expect(r.chamadas[0]!.metodos).toContain('eq("updated_at","2026-10-21T10:00:00.123456+00:00")')
    const aud = r.chamadas[1]!
    expect(aud.alvo).toBe('audit_log')
    const corpo = JSON.parse(/insert\((.*)\)$/.exec(aud.metodos.find((m) => m.startsWith('insert('))!)![1]!)
    expect(corpo).toMatchObject({ actor_user_id: 'u1', org_id: 'o1', site_id: 's1', action: 'ab_native_descartado', resource_type: 'ab_native_test', resource_id: 'r1' })
    expect(corpo.after_data).toEqual({ registro_id: 'r1', estado_anterior: 'em_andamento' })
  })

  it('falha do rastro vai ao log e não desfaz o descarte', async () => {
    const r = roteiro({ ab_native_tests: [ok([{ id: 'r1' }])], audit_log: [{ data: null, error: { message: 'queda' } }] })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: true })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('CAS perdido por evidência nova: uma releitura e sucesso, nunca erro cru', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), atual({}), ok([{ id: 'r1' }])], audit_log: [ok(null)] })
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: true })
    expect(r.chamadas[2]!.metodos).toContain('eq("updated_at","2026-10-21T10:05:00+00:00")')
  })

  it('registrador encerrou antes: ja_encerrado com o estado novo, sem erro', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), atual({ estado: 'encerrado' })] })
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: false, erro: 'ja_encerrado', estado: 'encerrado' })
  })

  it('linha confirmada (inclusive detectado que o dono confirmou): confirmado, continua em_andamento', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), atual({ confirmado_em: '2026-10-21T09:00:00+00:00' })] })
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: false, erro: 'confirmado', estado: 'em_andamento' })
  })

  it('outro site ou inexistente: nao_encontrado, zero audit', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), ok(null)] })
    expect(await descartarDetectado({ ...base, sb: r.sb })).toEqual({ ok: false, erro: 'nao_encontrado' })
    expect(r.chamadas.some((c) => c.alvo === 'audit_log')).toBe(false)
  })

  it('erro de banco no update lança (a action traduz)', async () => {
    const r = roteiro({ ab_native_tests: [{ data: null, error: { message: 'queda' } }] })
    await expect(descartarDetectado({ ...base, sb: r.sb })).rejects.toThrow('queda')
  })
})

describe('registrador depois do descarte (mundo falso)', () => {
  const textos = { A: 'Titulo A', B: 'Titulo B', D: 'Titulo D' }
  let ids = 0
  const novoId = (): string => `00000000-0000-4000-8000-${String(900000 + ++ids).padStart(12, '0')}`
  beforeEach(() => { mocks.schema.mockReset().mockResolvedValue(null); ids = 0 })
  const mistura = () => {
    const inicio = T0 - 30 * MIN - 17 * 4 * H
    return rodadas({ inicio: iso(inicio), intervaloMs: 4 * H, padroes: Array.from({ length: 18 }, () => 'AAB'), textos }).map((l) => ({ ...l, youtubeVideoId: yt(1) }))
  }

  it('com a mesma evidência de antes do descarte, o registrador não reabre a linha', async () => {
    const b = mundo([{ n: 1, leituras: mistura(), avaliacoes: [avaliacaoSemente(1, 1001, { avaliada_em: iso(T0 - 600 * MIN), estado_14: 'sem_leitura' })] }])
    const { c, state } = contexto()
    expect(await rodarRegistro(c(b.sb), { novoId })).toMatchObject({ estado: 'ok', feitas: 1 })
    const linhas = b.tabelas.ab_native_tests!
    expect(linhas).toHaveLength(1)
    // o dono diz "Não é teste" um pouco depois
    ir(state, 10 * MIN)
    Object.assign(linhas[0]!, { estado: 'descartado', descartado_em: iso(T0 + 10 * MIN) })
    ir(state, 30 * MIN)
    await rodarRegistro(c(b.sb), { novoId })
    ir(state, 2 * H)
    await rodarRegistro(c(b.sb), { novoId })
    expect(b.tabelas.ab_native_tests!.filter((x) => x.estado === 'em_andamento')).toHaveLength(0)
    expect(b.tabelas.ab_native_tests!).toHaveLength(1)
  })
})
