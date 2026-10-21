// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { rodarAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { roteiro, ok, type Res } from '../../helpers/banco-roteirizado'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const AGORA = Date.parse('2026-12-20T12:00:00.000Z')
const dias = (n: number): string => new Date(AGORA - n * 86_400_000).toISOString()
const ctx = (sb: ContextoTarefa['sb']): ContextoTarefa => ({ t0: AGORA, agora: () => AGORA, apiKey: '', sb, linhas: null })
const linha = (o: Record<string, unknown> = {}) => ({
  id: 'r1', site_id: 's1', youtube_video_id: 'abcdefghijk', estado: 'em_andamento', primeira_vista: dias(14), confirmado_em: dias(14), created_at: dias(30),
  resposta_dono: null, lembrete_notificado_em: null, notificacao_falhou_em: null, notificacao_tentativas: 0, updated_at: dias(1), ...o,
})
const fanOk = { total: 1, sent: 1, suppressed: 0, errors: [] as string[] }
const fanZero = { total: 0, sent: 0, suppressed: 0, errors: [] as string[] }
const erroBanco = (code: string): Res => ({ data: null, error: { message: 'x', code } })

describe('rodarAvisos', () => {
  it('coluna ausente: parcial com schema_ausente, sem exceção e sem notificar', async () => {
    const fan = vi.fn()
    const r = roteiro({ ab_native_tests: [erroBanco('42703')] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
    expect(fan).not.toHaveBeenCalled()
  })

  it('zero linha devida: ok com lembrados 0 e fechados 0', async () => {
    const fan = vi.fn()
    const r = roteiro({ ab_native_tests: [ok([]), ok([])] })
    expect(await rodarAvisos(ctx(r.sb), { fanOut: fan })).toMatchObject({ estado: 'ok', detalhe: { lembrados: 0, fechados: 0 } })
    expect(fan).not.toHaveBeenCalled()
  })

  it('dia 14 confirmada: um fan-out por e-mail (defaultChannels, nunca channels), dedup por registro, grava lembrete_notificado_em', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([{ id: 'r1' }])] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'ok', detalhe: { lembrados: 1, fechados: 0 } })
    const arg = fan.mock.calls[0]![0]
    expect(arg).toMatchObject({ siteId: 's1', domain: 'youtube', dedupKey: 'lembrete-nativo:r1', defaultChannels: ['email'] })
    expect(arg).not.toHaveProperty('channels')
    expect(arg.actionHref).toBe('/cms/youtube/ab-lab?video=abcdefghijk')
    const upd = r.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')
    expect(upd).toContain('lembrete_notificado_em')
  })

  it('detectado não confirmado e descartado: nenhuma notificação', async () => {
    const fan = vi.fn()
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ confirmado_em: null }), linha({ id: 'r2', estado: 'descartado' })])] })
    await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(fan).not.toHaveBeenCalled()
  })

  it('total === 0 conta tentativa; na 1ª não grava falhou_em; tarefa parcial com motivo', async () => {
    const fan = vi.fn().mockResolvedValue(fanZero)
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 0 })]), ok([{ id: 'r1' }])] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'lembrete_falhou', detalhe: { lembrados: 0, lembrete_falhou: 1 } })
    const upd = r.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')
    expect(upd).toContain('"notificacao_tentativas":1')
    expect(upd).not.toContain('notificacao_falhou_em')
  })

  it('3ª falha: grava notificacao_falhou_em e a tarefa fica em erro', async () => {
    const fan = vi.fn().mockResolvedValue({ ...fanOk, errors: ['x'] })
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 2 })]), ok([{ id: 'r1' }])] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'erro', motivo: 'lembrete_desistiu' })
    const upd = r.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')
    expect(upd).toContain('notificacao_falhou_em')
  })

  it('fan-out que lança conta como falha, sem exceção', async () => {
    const fan = vi.fn().mockRejectedValue(new Error('boom'))
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([{ id: 'r1' }])] })
    expect(await rodarAvisos(ctx(r.sb), { fanOut: fan })).toMatchObject({ estado: 'parcial', motivo: 'lembrete_falhou' })
  })

  it('fechamento: sem_desfecho/sem_dado/sem_resposta, respondido_em nulo, CAS por updated_at, expira o lembrete', async () => {
    const fan = vi.fn()
    const l = linha({ primeira_vista: dias(20), confirmado_em: dias(20), lembrete_notificado_em: dias(4) })
    const r = roteiro({ ab_native_tests: [ok([]), ok([l]), ok([{ id: 'r1' }])], notifications: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'ok', detalhe: { lembrados: 0, fechados: 1 } })
    expect(fan).not.toHaveBeenCalled()
    const m = r.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')
    expect(m).toContain('"estado":"sem_desfecho"')
    expect(m).toContain('"desfecho_estado":"sem_dado"')
    expect(m).toContain('"desfecho_motivo":"sem_resposta"')
    expect(m).toContain('"resposta_dono":"sem_resposta"')
    expect(m).not.toContain('respondido_em')
    expect(m).toContain(`eq("updated_at","${l.updated_at}")`)
    expect(r.chamadas.some((c) => c.alvo === 'notifications' && c.metodos.join(' ').includes('lembrete-nativo:r1'))).toBe(true)
  })

  it('fechamento que perdeu o CAS: pula e conta, não expira o lembrete', async () => {
    const l = linha({ primeira_vista: dias(20), confirmado_em: dias(20), lembrete_notificado_em: dias(4) })
    const r = roteiro({ ab_native_tests: [ok([]), ok([l]), ok([])], notifications: [] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: vi.fn() })
    expect(out).toMatchObject({ estado: 'ok', detalhe: { fechados: 0, cas_perdido: 1 } })
  })

  it('lembrete que saiu agora não fecha no mesmo disparo (fechamento calculado sobre o que foi lido)', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const l = linha({ primeira_vista: dias(20), confirmado_em: dias(20) })
    const r = roteiro({ ab_native_tests: [ok([]), ok([l]), ok([{ id: 'r1' }])] })
    expect(await rodarAvisos(ctx(r.sb), { fanOut: fan })).toMatchObject({ detalhe: { lembrados: 1, fechados: 0 } })
  })

  it('falha de leitura: parcial com leitura_falhou', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), erroBanco('57014')] })
    expect(await rodarAvisos(ctx(r.sb), { fanOut: vi.fn() })).toMatchObject({ estado: 'parcial', motivo: 'leitura_falhou' })
  })
})
