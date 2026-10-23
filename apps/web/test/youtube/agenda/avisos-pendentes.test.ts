// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { rodarAvisos as rodarAvisosReal, type DepsAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import * as Sentry from '@sentry/nextjs'
import { roteiro, ok, type Res } from '../../helpers/banco-roteirizado'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

// A parte do nicho tem testes próprios (avisos.test.ts); aqui ela é um dublê que não faz nada.
const rodarAvisos = (c: ContextoTarefa, d: DepsAvisos = {}) => rodarAvisosReal(c, { nicho: async () => ({ enviados: 0, resumidos: 0, falhas: 0 }), ...d })
const AGORA = Date.parse('2026-12-20T12:00:00.000Z')
const dias = (n: number): string => new Date(AGORA - n * 86_400_000).toISOString()
const ctx = (sb: ContextoTarefa['sb'], em: number = AGORA): ContextoTarefa => ({ t0: em, agora: () => em, apiKey: '', sb, linhas: null })
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

  it('título do lembrete: início há 14 d 23 h diz "Faz 14 dias" (piso, não teto)', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const ini = dias(14 + 23 / 24)
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ primeira_vista: ini, confirmado_em: ini })]), ok([{ id: 'r1' }])] })
    await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(fan).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Faz 14 dias') }))
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
    const out = await rodarAvisos(ctx(r.sb, AGORA + 2 * 86_400_000), { fanOut: fan })
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

  it('C1: tentativa já gasta hoje fica de fora (não tenta, não conta), com lembrete_espera', async () => {
    const fan = vi.fn()
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 1 })])] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'ok', detalhe: { lembrete_espera: 1, lembrete_falhou: 0 } })
    expect(fan).not.toHaveBeenCalled()
    expect(r.chamadas.filter((c) => c.alvo === 'ab_native_tests')).toHaveLength(2)
  })

  it('C1: falha nos dias 14 e 15 e sucesso no 16 grava lembrete_notificado_em no 16, sem fechar', async () => {
    const dia = 86_400_000
    const fanF = vi.fn().mockResolvedValue(fanZero)
    const r1 = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([{ id: 'r1' }])] })
    expect(await rodarAvisos(ctx(r1.sb), { fanOut: fanF })).toMatchObject({ motivo: 'lembrete_falhou' })
    const r2 = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 1 })]), ok([{ id: 'r1' }])] })
    expect(await rodarAvisos(ctx(r2.sb, AGORA + dia), { fanOut: fanF })).toMatchObject({ motivo: 'lembrete_falhou' })
    expect(r2.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')).toContain('"notificacao_tentativas":2')
    const fanOkF = vi.fn().mockResolvedValue(fanOk)
    const r3 = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 2 })]), ok([{ id: 'r1' }])] })
    expect(await rodarAvisos(ctx(r3.sb, AGORA + 2 * dia), { fanOut: fanOkF })).toMatchObject({ estado: 'ok', detalhe: { lembrados: 1, fechados: 0 } })
    expect(r3.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')).toContain('lembrete_notificado_em')
  })

  it('C1: três falhas em três dias gravam falhou_em só na 3ª e avisam o Sentry', async () => {
    vi.mocked(Sentry.captureMessage).mockClear()
    const fan = vi.fn().mockResolvedValue(fanZero)
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 2 })]), ok([{ id: 'r1' }])] })
    const out = await rodarAvisos(ctx(r.sb, AGORA + 2 * 86_400_000), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'erro', motivo: 'lembrete_desistiu' })
    expect(r.chamadas.filter((c) => c.alvo === 'ab_native_tests').at(-1)!.metodos.join(' ')).toContain('notificacao_falhou_em')
    expect(vi.mocked(Sentry.captureMessage).mock.calls.some((c) => String(c[0]).includes('abandonado'))).toBe(true)
  })

  it('M1: lembrete saiu mas a gravação falhou: motivo próprio, lembrados 0', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha()]), erroBanco('XX000')] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: vi.fn().mockResolvedValue(fanOk) })
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'lembrete_nao_gravado', detalhe: { lembrados: 0, lembrete_nao_gravado: 1, fechamento_falhou: 0 } })
  })

  it('M1: update que volta 0 linhas não conta como lembrado', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([])] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: vi.fn().mockResolvedValue(fanOk) })
    expect(out.detalhe).toMatchObject({ lembrados: 0 })
  })

  it('M2: a leitura filtra linhas pendentes e ordena', async () => {
    const r = roteiro({ ab_native_tests: [ok([]), ok([])] })
    await rodarAvisos(ctx(r.sb), { fanOut: vi.fn() })
    const m = r.chamadas.filter((c) => c.alvo === 'ab_native_tests')[1]!.metodos.join(' ')
    expect(m).toContain('or("estado.eq.em_andamento,and(lembrete_notificado_em.is.null,notificacao_falhou_em.is.null)")')
    expect(m).toContain('order("created_at"')
  })

  it('M2: leitura no teto de 500 linhas: parcial com sobrou e no_teto', async () => {
    const muitas = Array.from({ length: 500 }, (_, i) => linha({ id: `x${i}`, confirmado_em: dias(1), primeira_vista: dias(1) }))
    const r = roteiro({ ab_native_tests: [ok([]), ok(muitas)] })
    expect(await rodarAvisos(ctx(r.sb), { fanOut: vi.fn() })).toMatchObject({ estado: 'parcial', motivo: 'sobrou', detalhe: { no_teto: 1 } })
  })

  it('M3: o título leva os dias reais desde o início', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha({ primeira_vista: dias(20), confirmado_em: dias(0) })]), ok([{ id: 'r1' }])] })
    await rodarAvisos(ctx(r.sb), { fanOut: fan })
    expect(fan.mock.calls[0]![0].title).toContain('20 dias')
    expect(fan.mock.calls[0]![0].title).not.toContain('14')
  })

  it('envio repetido: segundo disparo recebe suppressed, mesmo dedup, e grava lembrado', async () => {
    const fan = vi.fn().mockResolvedValueOnce(fanZero.total ? fanZero : { ...fanOk, errors: ['x'] }).mockResolvedValueOnce({ total: 1, sent: 0, suppressed: 1, errors: [] })
    const r1 = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([{ id: 'r1' }])] })
    await rodarAvisos(ctx(r1.sb), { fanOut: fan })
    const r2 = roteiro({ ab_native_tests: [ok([]), ok([linha({ notificacao_tentativas: 1 })]), ok([{ id: 'r1' }])] })
    const out = await rodarAvisos(ctx(r2.sb, AGORA + 86_400_000), { fanOut: fan })
    expect(out).toMatchObject({ estado: 'ok', detalhe: { lembrados: 1 } })
    expect(fan.mock.calls[0]![0].dedupKey).toBe(fan.mock.calls[1]![0].dedupKey)
  })

  it('reenvio no mesmo minuto: dois disparos sobre as mesmas linhas, o segundo suppressed grava uma vez cada', async () => {
    const fan = vi.fn().mockResolvedValueOnce(fanOk).mockResolvedValueOnce({ total: 1, sent: 0, suppressed: 1, errors: [] })
    const r1 = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([{ id: 'r1' }])] })
    const r2 = roteiro({ ab_native_tests: [ok([]), ok([linha()]), ok([])] })
    expect(await rodarAvisos(ctx(r1.sb), { fanOut: fan })).toMatchObject({ detalhe: { lembrados: 1 } })
    expect(await rodarAvisos(ctx(r2.sb), { fanOut: fan })).toMatchObject({ estado: 'ok', detalhe: { lembrados: 0 } })
  })
})
