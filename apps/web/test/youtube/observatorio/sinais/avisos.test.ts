// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { dedupDoResumo, fraseDeFalhas, planejarAvisos, type PendenteAviso } from '@/lib/youtube/observatorio/sinais/avisos'
import { rodarAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import { REGRA_SINAIS } from '@/lib/youtube/observatorio/sinais/regra'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { roteiro, ok } from '../../../helpers/banco-roteirizado'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const p = (n: number, forca: number, como: PendenteAviso['notificar_como'] = 'individual'): PendenteAviso => ({ id: `id-${String(n).padStart(2, '0')}`, forca, notificar_como: como, notificacao_tentativas: 0 })

describe('planejarAvisos', () => {
  it('8 individuais e teto 5: os 5 de maior força vão um a um e os 3 restantes no resumo', () => {
    const lista = Array.from({ length: 8 }, (_, i) => p(i, 10 + i))
    const r = planejarAvisos(lista, 0, 5)
    expect(r.individuais).toEqual(['id-07', 'id-06', 'id-05', 'id-04', 'id-03'])
    expect(r.resumo.sort()).toEqual(['id-00', 'id-01', 'id-02'])
  })
  it('2 já enviados hoje: 3 individuais e 5 no resumo', () => {
    const r = planejarAvisos(Array.from({ length: 8 }, (_, i) => p(i, 10 + i)), 2, 5)
    expect(r.individuais).toHaveLength(3)
    expect(r.resumo).toHaveLength(5)
  })
  it('teto já estourado (ou passado): nenhum individual, tudo no resumo', () => {
    expect(planejarAvisos([p(1, 5), p(2, 6)], 7, 5)).toEqual({ individuais: [], resumo: ['id-01', 'id-02'] })
  })
  it('linha de base: 20 resumo → 0 individuais e 1 resumo com 20 ids', () => {
    const r = planejarAvisos(Array.from({ length: 20 }, (_, i) => p(i, 50, 'resumo')), 0, 5)
    expect(r.individuais).toEqual([])
    expect(r.resumo).toHaveLength(20)
  })
  it('quem é resumo (parecido) nunca entra em individuais, mesmo com a maior força', () => {
    const r = planejarAvisos([p(1, 99, 'resumo'), p(2, 1)], 0, 5)
    expect(r.individuais).toEqual(['id-02'])
    expect(r.resumo).toEqual(['id-01'])
  })
  it('empate de força desempata por id (estável)', () => {
    expect(planejarAvisos([p(2, 5), p(1, 5)], 0, 1).individuais).toEqual(['id-01'])
  })
})

describe('dedupDoResumo e frase de falhas', () => {
  const dia = new Date('2026-10-22T15:00:00.000Z')
  it('mesmo conjunto (em qualquer ordem) no mesmo dia SP dá a mesma chave; conjunto diferente, outra', () => {
    expect(dedupDoResumo(dia, ['b', 'a'])).toBe(dedupDoResumo(dia, ['a', 'b']))
    expect(dedupDoResumo(dia, ['a', 'b'])).not.toBe(dedupDoResumo(dia, ['a', 'c']))
    expect(dedupDoResumo(dia, ['a'])).toMatch(/^nicho-resumo:2026-10-22:[0-9a-f]{12}$/)
  })
  it('00:30 UTC ainda é o dia anterior em São Paulo', () => {
    expect(dedupDoResumo(new Date('2026-10-23T00:30:00.000Z'), ['a'])).toContain(':2026-10-22:')
  })
  it('frase: singular, plural e nada', () => {
    expect(fraseDeFalhas(0)).toBeNull()
    expect(fraseDeFalhas(1)).toBe('1 sugestão do nicho não chegou ao sino')
    expect(fraseDeFalhas(3)).toBe('3 sugestões do nicho não chegaram ao sino')
  })
  it('o teto vem da regra versionada', () => {
    expect(REGRA_SINAIS.tetoNotificacoesDia).toBe(5)
    expect(REGRA_SINAIS.tetoTentativas).toBe(3)
  })
})

describe('rodarAvisos + nicho', () => {
  const AGORA = Date.parse('2026-12-20T12:00:00.000Z')
  const ctx = (sb: ContextoTarefa['sb'], em: number = AGORA): ContextoTarefa => ({ t0: em, agora: () => em, apiKey: '', sb, linhas: null })
  const dia14 = new Date(AGORA - 14 * 86_400_000).toISOString()
  const linha = { id: 'r1', site_id: 's1', youtube_video_id: 'abcdefghijk', estado: 'em_andamento', primeira_vista: dia14, confirmado_em: dia14, created_at: dia14, resposta_dono: null, lembrete_notificado_em: null, notificacao_falhou_em: null, notificacao_tentativas: 0, updated_at: dia14 }
  const fanOk = { total: 1, sent: 1, suppressed: 0, errors: [] as string[] }

  it('erro forçado no nicho: o lembrete do dia 14 sai mesmo assim e a tarefa fica erro com nicho_falhou', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const nicho = vi.fn().mockRejectedValue(new Error('x'))
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha]), ok([{ id: 'r1' }])], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan, nicho })
    expect(fan).toHaveBeenCalledTimes(1)
    expect(nicho).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ estado: 'erro', motivo: 'nicho_falhou', detalhe: { lembrados: 1, nicho_enviados: 0, nicho_resumidos: 0, nicho_falhas: 0 } })
  })
  it('o nicho roda mesmo com o schema do nativo ausente (nenhuma saída antecipada o pula)', async () => {
    const nicho = vi.fn().mockResolvedValue({ enviados: 0, resumidos: 0, falhas: 0 })
    const r = roteiro({ ab_native_tests: [{ data: null, error: { message: 'x', code: '42703' } }], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { nicho })
    expect(nicho).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
  })
  it('nicho com falha de 3ª tentativa: erro nicho_falhou; contadores no detalhe', async () => {
    const nicho = vi.fn().mockResolvedValue({ enviados: 2, resumidos: 3, falhas: 1 })
    const r = roteiro({ ab_native_tests: [ok([]), ok([])], niche_signals: [{ data: null, error: null }] })
    const out = await rodarAvisos(ctx(r.sb), { nicho })
    expect(out).toMatchObject({ estado: 'erro', motivo: 'nicho_falhou', detalhe: { nicho_enviados: 2, nicho_resumidos: 3, nicho_falhas: 1 } })
  })
  it('lembrete_desistiu do nativo não é trocado pelo nicho', async () => {
    const nicho = vi.fn().mockRejectedValue(new Error('x'))
    const fan = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const r = roteiro({ ab_native_tests: [ok([]), ok([{ ...linha, notificacao_tentativas: 2 }]), ok([{ id: 'r1' }])], niche_signals: [ok(null)] })
    expect(await rodarAvisos(ctx(r.sb, AGORA + 2 * 86_400_000), { fanOut: fan, nicho })).toMatchObject({ estado: 'erro', motivo: 'lembrete_desistiu' })
  })
})
