// @vitest-environment node
// P4b T4: a fase nova do vigia (nova tentativa), com `tentar` injetado e o banco falso da P4a.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AGORA, ONTEM, criarBanco } from '../helpers/banco-ab'
import type { Fila } from '../helpers/banco-ab'

const { fanOut } = vi.hoisted(() => ({ fanOut: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))

import { faseNovaTentativa, zeroNovaTentativa } from '@/lib/youtube/ab-watchdog-nova-tentativa'
import type { novaTentativa } from '@/lib/youtube/ab-settle'
import type { CampoRestauracao, RestoreStatus } from '@/lib/youtube/ab-restore'
import { avisarNovaTentativa, fraseDeDesistencia } from '@/lib/youtube/ab-restore-avisos'
import type { SupabaseClient } from '@supabase/supabase-js'

const INICIO = AGORA.getTime()
const campo = (p: Partial<CampoRestauracao> = {}): CampoRestauracao => ({
  estado: 'falhou', destino: 'original', em: ONTEM, forcado: false, escreveu: true,
  erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }, attempts: 1, ...p,
})
const falhou = (p: Partial<CampoRestauracao> = {}): RestoreStatus => ({ thumbnail: campo(p) })
type Tentar = typeof novaTentativa
const feito = (campos: RestoreStatus) => vi.fn<Tentar>(async () => ({ resultado: 'feito', campos }))

function montar(restoreStatus: unknown = falhou(), o: { status?: string; extras?: Fila[] } = {}) {
  const banco = criarBanco({ testType: 'thumbnail', status: o.status ?? 'completed', restoreStatus, extras: o.extras })
  let deslocamento = 0
  const relogio = { agora: () => INICIO + deslocamento, inicio: INICIO }
  const claims: Array<{ key: string; intervalo: string }> = []
  const rpc = banco.supabase.rpc.bind(banco.supabase)
  ;(banco.supabase as { rpc: unknown }).rpc = (nome: string, a: Record<string, unknown>) => {
    if (nome === 'ops_alert_claim') claims.push({ key: String(a.p_key), intervalo: String(a.p_min_interval) })
    return rpc(nome, a)
  }
  return { banco, relogio, claims, avancar: (ms: number) => { deslocamento += ms }, sb: banco.supabase as unknown as SupabaseClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
})

describe('faseNovaTentativa', () => {
  it('zero testes: todos os contadores em 0 (P4b-I9)', async () => {
    const { sb, relogio } = montar(null, { status: 'active' })
    const tentar = feito({})
    expect(await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })).toEqual(zeroNovaTentativa())
    expect(tentar).not.toHaveBeenCalled()
  })

  it('relógio falso: 6 testes, limite 4, cada tentativa anda 8 s: tentadas 4 (0 s), adiados 2 (depois de 16 s)', async () => {
    const extras = Array.from({ length: 5 }, (_, i) => ({ id: `t${i + 2}`, status: 'completed', youtube_video_id: `v${i + 2}`, restore_status: falhou() }))
    const { sb, relogio, avancar } = montar(falhou(), { extras })
    const tentar = vi.fn<Tentar>(async () => { await Promise.resolve(); avancar(8_000); return { resultado: 'feito', campos: falhou() } })
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(r).toMatchObject({ tentadas: 4, adiados: 2 })
    expect(tentar).toHaveBeenCalledTimes(4)
  })

  it('uma tentativa por execução: o teste aparece uma vez e tentar é chamado 1 vez, com o prazo e o seq lidos', async () => {
    const { sb, relogio } = montar(falhou())
    const tentar = feito(falhou({ attempts: 2 }))
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(tentar).toHaveBeenCalledTimes(1)
    expect(tentar.mock.calls[0]![1]).toMatchObject({ origem: 'vigia', prazo: INICIO + 55_000, seqEsperado: 0, siteId: 'site-1' })
    expect(r).toMatchObject({ tentadas: 1, falharam: 1, ok: 0 })
  })

  it('M7b: campo falhou da escolha do dono: ignorados.escolha_do_dono, nenhuma tentativa, nenhuma leitura de claim', async () => {
    const { sb, relogio } = montar(falhou({ iniciativa: 'dono' }))
    const tentar = feito(falhou())
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(tentar).not.toHaveBeenCalled()
    expect(r.ignorados.escolha_do_dono).toBe(1)
    expect(r.tentadas).toBe(0)
  })

  it('teste_youtube: conta em ignorados, não em tentadas, e não avisa (Phil C2 / Yannis M5)', async () => {
    const { sb, relogio } = montar(falhou())
    const tentar = vi.fn<Tentar>(async () => ({ resultado: 'teste_youtube', motivo: 'x', campos: null }))
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(r.ignorados.teste_youtube).toBe(1)
    expect(r).toMatchObject({ tentadas: 0, falhas: 0, falharam: 0 })
    expect(fanOut).not.toHaveBeenCalled()
  })

  it('Y-A8: em_andamento, mudou e ja_encerrado (outro escritor) não contam como tentada', async () => {
    for (const resultado of ['em_andamento', 'mudou', 'ja_encerrado'] as const) {
      const { sb, relogio } = montar(falhou())
      const tentar = vi.fn<Tentar>(async () => ({ resultado, campos: null }))
      const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
      expect(tentar).toHaveBeenCalledTimes(1)
      expect(r.tentadas).toBe(0)
      expect(r.ok + r.falharam + r.desistiram + r.pulados + r.falhas).toBe(0)
    }
  })

  it('outro teste active no mesmo vídeo: ignorados 1, tentar não é chamado (P4b-I10)', async () => {
    const { sb, relogio } = montar(falhou(), { extras: [{ id: 't2', status: 'active' }] })
    const tentar = feito({})
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(r.ignorados).toEqual({ outro_teste: 1, pausado_variante: 0, teste_youtube: 0, escolha_do_dono: 0 })
    expect(r.tentadas).toBe(0)
    expect(tentar).not.toHaveBeenCalled()
  })

  it('paused com destino variante: ignorados 1; paused com destino original e sem outro teste: tentado (S2)', async () => {
    const t1 = vi.fn<Tentar>()
    const a = montar(falhou({ destino: 'B' }), { status: 'paused' })
    expect((await faseNovaTentativa(a.sb, a.relogio, undefined, 4, { tentar: t1 })).ignorados.pausado_variante).toBe(1)
    expect(t1).not.toHaveBeenCalled()
    const b = montar(falhou(), { status: 'paused' })
    const t2 = feito(falhou())
    expect((await faseNovaTentativa(b.sb, b.relogio, undefined, 4, { tentar: t2 })).tentadas).toBe(1)
    expect(t2).toHaveBeenCalledTimes(1)
  })

  it('restore_status ilegível: falhas 1, tentar não é chamado', async () => {
    const { sb, relogio } = montar({ thumbnail: { estado: 'falhou' } })
    // o fake de .or() casa pelo jsonb cru, como o PostgREST
    const tentar = feito({})
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(r).toMatchObject({ falhas: 1, tentadas: 0 })
    expect(tentar).not.toHaveBeenCalled()
  })

  it('tentar lança: falhas 1, os outros seguem', async () => {
    const { sb, relogio } = montar(falhou(), { extras: [{ id: 't2', status: 'completed', youtube_video_id: 'v2', restore_status: falhou() }] })
    const tentar = vi.fn<Tentar>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ resultado: 'feito', campos: { thumbnail: campo({ estado: 'ok', erro: null }) } })
    const r = await faseNovaTentativa(sb, relogio, undefined, 1, { tentar })
    expect(r).toMatchObject({ tentadas: 2, falhas: 1, ok: 1 })
  })

  it('resultados: pulado_drift conta em pulados e não em ok (Y-10); cota conta em cota e em falharam', async () => {
    const a = montar(falhou())
    expect(await faseNovaTentativa(a.sb, a.relogio, undefined, 4, { tentar: feito({ thumbnail: campo({ estado: 'pulado_drift', erro: null }) }) }))
      .toMatchObject({ pulados: 1, ok: 0 })
    const b = montar(falhou())
    expect(await faseNovaTentativa(b.sb, b.relogio, undefined, 4, { tentar: feito({ thumbnail: campo({ erro: { status: 403, reason: 'quotaExceeded', chamada: 'thumbnails.set' } }) }) }))
      .toMatchObject({ cota: 1, falharam: 1 })
  })
})

describe('avisos da fase nova', () => {
  it('falhou: claimAlert("ab-restore:<id>", "20 hours"); resultado sem falhou: libera a mesma chave', async () => {
    const { sb, relogio, claims, banco } = montar(falhou())
    await faseNovaTentativa(sb, relogio, undefined, 4, { tentar: feito(falhou({ attempts: 2 })) })
    expect(claims).toContainEqual({ key: 'ab-restore:teste-1', intervalo: '20 hours' })
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0]).toMatchObject({ priority: 1 })
    // chave gasta no banco falso; um resultado sem falhou a libera
    ;(banco.supabase as unknown as { from: (t: string) => unknown }).from('ops_alert_state')
    await avisarNovaTentativa(sb, { id: 'teste-1', site_id: 'site-1', name: 'T' }, { thumbnail: campo({ estado: 'ok', erro: null }) }, null)
    const ainda = await sb.rpc('ops_alert_claim', { p_key: 'ab-restore:teste-1', p_min_interval: '20 hours' })
    expect(ainda.data).toBe(true) // liberada: reivindicável de novo
  })

  it('a segunda execução na janela não reenvia (chave gasta): repetido', async () => {
    const { sb, relogio } = montar(falhou())
    await faseNovaTentativa(sb, relogio, undefined, 4, { tentar: feito(falhou({ attempts: 2 })) })
    await faseNovaTentativa(sb, relogio, undefined, 4, { tentar: feito(falhou({ attempts: 2 })) })
    expect(fanOut).toHaveBeenCalledTimes(1)
  })

  it('desistiu/tres_falhas: chave ab-restore-desistiu:<id>:<campo> e a frase "falhou 3 vezes e parou"', async () => {
    const { sb, relogio } = montar(falhou({ attempts: 2 }))
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar: feito(falhou({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas' })) })
    expect(r.desistiram).toBe(1)
    const arg = fanOut.mock.calls.map((c) => c[0] as { dedupKey: string; message: string }).find((a) => a.dedupKey.startsWith('ab-restore-desistiu:teste-1:thumbnail:'))
    expect(arg?.message).toContain('falhou 3 vezes e parou')
  })

  it('fanOut com total 0: semDestinatario 1', async () => {
    fanOut.mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const { sb, relogio } = montar(falhou())
    expect(await faseNovaTentativa(sb, relogio, undefined, 4, { tentar: feito(falhou({ attempts: 2 })) })).toMatchObject({ semDestinatario: 1 })
  })

  it('destino_invalido: falhas 1, tentar chamado uma vez, aviso com a chave de desistiu e a frase nova (N1)', async () => {
    const { sb, relogio } = montar(falhou())
    const tentar = vi.fn<Tentar>(async () => ({ resultado: 'destino_invalido', campos: null }))
    const r = await faseNovaTentativa(sb, relogio, undefined, 4, { tentar })
    expect(r.falhas).toBe(1)
    expect(tentar).toHaveBeenCalledTimes(1)
    const arg = fanOut.mock.calls[0]![0] as { dedupKey: string; message: string }
    expect(arg.dedupKey.startsWith('ab-restore-desistiu:teste-1:thumbnail:')).toBe(true) // leva o `em` da corrente
    expect(arg.message).toContain('O Lab não soube para qual versão devolver')
  })

  it('noAr: variante no ar e escreveu false cita a variante; original ou escreveu não-false: frase neutra (S3)', async () => {
    const a = montar(falhou({ attempts: 2, destino: 'original' }))
    a.banco.ciclos()[0]!.variant_id = 'B'
    await faseNovaTentativa(a.sb, a.relogio, undefined, 4, { tentar: feito(falhou({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas', escreveu: false })) })
    expect((fanOut.mock.calls[0]![0] as { message: string }).message).toContain('No ar continua a variante B.')
    fanOut.mockClear()
    const b = montar(falhou({ attempts: 2 }))
    b.banco.ciclos()[0]!.variant_id = 'B'
    await faseNovaTentativa(b.sb, b.relogio, undefined, 4, { tentar: feito(falhou({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas', escreveu: true })) })
    expect((fanOut.mock.calls[0]![0] as { message: string }).message).toContain('No ar continua o que estava no vídeo antes da restauração.')
    fanOut.mockClear()
    const c = montar(falhou({ attempts: 2 }))
    await faseNovaTentativa(c.sb, c.relogio, undefined, 4, { tentar: feito(falhou({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas', escreveu: false })) })
    expect((fanOut.mock.calls[0]![0] as { message: string }).message).toContain('No ar continua o que estava no vídeo antes da restauração.') // ciclo na original
  })

  it('fraseDeDesistencia: ramo explícito de video_inexistente e frase neutra para o resto', () => {
    expect(fraseDeDesistencia('T', 'video_inexistente', ['title'])).toContain('não foi encontrado no YouTube')
    expect(fraseDeDesistencia('T', 'antes_da_nova_tentativa', ['title'])).not.toContain('não foi encontrado')
  })
})
