// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, boundsAnalytics, dayPt, ontemPt } from '@/lib/youtube/coleta/day-pt'
import type { AbTest } from '@/lib/youtube/coleta/ab-seconds'
import {
  ATRASO_ALCANCE, blocoDoDia, cicloDoDia, estadoV2DoTeste, folgaPorVariante, relogioV2, tetoMinimo, tetoPadrao,
  type CicloComNumero,
} from '@/lib/youtube/ab-gravacao/decisao-v2'

const TESTE: AbTest = { id: 't1', status: 'active', paused_at: null, completed_at: null, original_title: null }
const ciclo = (n: number, ini: number, fim: number | null, variant = 'vA'): CicloComNumero => ({
  id: 'c' + n, test_id: 't1', variant_id: variant, started_at: new Date(ini).toISOString(),
  ended_at: fim === null ? null : new Date(fim).toISOString(), applied_metadata: null, cycle_number: n,
})
const H = 3_600_000
// Janela de janeiro (sem mudança de horário): dias de 24 h, datas passadas com `agora` explícito.
const D0 = '2026-01-10'
const t0 = boundsAnalytics(D0).start
const agora = new Date(boundsAnalytics('2026-02-20').start + 12 * H)

describe('relogioV2', () => {
  it('pausa de 20 dias no meio dá só os dias com ciclo no ar e nunca inclui hoje', () => {
    const cs = [ciclo(0, t0, t0 + 5 * 24 * H), ciclo(1, t0 + 25 * 24 * H, null)]
    const dias = relogioV2(cs, TESTE, agora)
    expect(dias).toHaveLength(5 + (diasEntre(addDays(D0, 25), ontemPt(agora)) + 1))
    expect(dias).not.toContain(dayPt(agora))
    expect(dias).not.toContain(addDays(D0, 10))
  })
  it('C-18: pausa 00:00 a 00:00 PT por 48 h tira 2 dias; 12:00 a 12:00 tira 1', () => {
    const cheio = relogioV2([ciclo(0, t0, null)], TESTE, agora).length
    const p0 = relogioV2([ciclo(0, t0, t0 + 24 * H), ciclo(1, t0 + 72 * H, null)], TESTE, agora).length
    expect(cheio - p0).toBe(2)
    const p12 = relogioV2([ciclo(0, t0, t0 + 12 * H), ciclo(1, t0 + 60 * H, null)], TESTE, agora).length
    expect(cheio - p12).toBe(1)
  })
  it('sem ciclos devolve vazio', () => expect(relogioV2([], TESTE, agora)).toEqual([]))
  it('C-16: dia de 90.000 s conta 1 e não se repete', () => {
    let d = dayPt(new Date()); let achou: string | null = null
    for (let n = 0; n < 400; n++, d = addDays(d, 1)) { const b = boundsAnalytics(d); if ((b.end - b.start) / 1000 === 90_000) { achou = d; break } }
    if (!achou) throw new Error('sem dia de 90000 s em 400 dias')
    const ini = boundsAnalytics(addDays(achou, -2)).start
    const fimAgora = new Date(boundsAnalytics(addDays(achou, 3)).start + 12 * H)
    const dias = relogioV2([ciclo(0, ini, null)], TESTE, fimAgora)
    expect(dias.filter(x => x === achou)).toHaveLength(1)
    expect(dias).toHaveLength(5) // d-2, d-1, d, d+1, d+2
  })
})

function diasEntre(a: string, b: string): number { return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) }

describe('blocoDoDia', () => {
  it('floor(cycle_number / 2V)', () => {
    expect(blocoDoDia(0, 2)).toBe(0); expect(blocoDoDia(3, 2)).toBe(0); expect(blocoDoDia(4, 2)).toBe(1)
    expect(blocoDoDia(5, 3)).toBe(0); expect(blocoDoDia(6, 3)).toBe(1)
  })
  it('pausa e forceRotate: segue o número do banco', () => {
    expect(blocoDoDia(7, 2)).toBe(1); expect(blocoDoDia(8, 2)).toBe(2)
  })
})

describe('cicloDoDia', () => {
  it('maior sobreposição vence', () => {
    const a = ciclo(0, t0, t0 + 6 * H); const b = ciclo(1, t0 + 6 * H, null)
    expect(cicloDoDia(D0, [a, b])?.cycle_number).toBe(1)
  })
  it('empate: variante do dia, depois maior cycle_number; nenhum = null', () => {
    const a = ciclo(0, t0, t0 + 12 * H, 'vA'); const b = ciclo(1, t0 + 12 * H, null, 'vB')
    expect(cicloDoDia(D0, [a, b], 'vA')?.cycle_number).toBe(0)
    expect(cicloDoDia(D0, [a, b], 'vB')?.cycle_number).toBe(1)
    expect(cicloDoDia(D0, [a, b])?.cycle_number).toBe(1)
    expect(cicloDoDia(addDays(D0, -5), [a, b])).toBeNull()
  })
  it('dois ciclos da mesma variante no dia: escolhe o da variante do dia (m-12)', () => {
    const a = ciclo(0, t0, t0 + 12 * H, 'vA'); const b = ciclo(1, t0 + 12 * H, null, 'vB')
    const c = ciclo(2, t0 + 12 * H, null, 'vA')
    expect(cicloDoDia(D0, [a, b, c], 'vB')?.cycle_number).toBe(1)
    expect(cicloDoDia(D0, [a, b, c], 'vA')?.cycle_number).toBe(2)
  })
})

describe('tetos e folga', () => {
  it('piso, mínimo e padrão (◆folga 15/17)', () => {
    expect(ATRASO_ALCANCE).toBe(3)
    expect(tetoMinimo(2)).toBe(12); expect(tetoMinimo(3)).toBe(16)
    expect(tetoPadrao(2)).toBe(15); expect(tetoPadrao(3)).toBe(17)
  })
  it('folgaPorVariante (sonda do Yannis)', () => {
    expect(folgaPorVariante(2, 12)).toEqual([0, 0]); expect(folgaPorVariante(2, 14)).toEqual([0, 2])
    expect(folgaPorVariante(3, 16)).toEqual([0, 0, 0]); expect(folgaPorVariante(3, 18)).toEqual([0, 1, 1])
  })
  it('padrão novo: V=2 T=15 dá folga 1 na original; V=3 T=17 dá 0 na original', () => {
    expect(folgaPorVariante(2, tetoPadrao(2))).toEqual([1, 2])
    expect(folgaPorVariante(3, tetoPadrao(3))).toEqual([0, 1, 0])
  })
})

describe('estadoV2DoTeste', () => {
  const cs = [ciclo(0, t0, null)]
  const em03 = new Date(boundsAnalytics('2026-02-20').start + 3 * H)
  const v2 = (dias: number, em: Date) => ({ ultima_avaliacao: { em: em.toISOString(), acao: 'seguir' as const, dias_relogio: dias, dias_validos: {}, blocos_completos: 0, volume: {} } })
  it('às 03:00 PT, dia igual ao dias_relogio da avaliação do dia anterior; idade > 26 h sinaliza velho', () => {
    const dia = relogioV2(cs, TESTE, em03).length
    const ontem = new Date(em03.getTime() - 27 * H)
    const e = estadoV2DoTeste(TESTE, cs, v2(dia, ontem), em03, 15)
    expect(e.dia).toBe(dia); expect(e.teto).toBe(15); expect(e.estado).toBe('ativo')
    expect(e.idade_horas).toBeGreaterThan(26)
  })
  it('teste pausado: estado pausado e sem idade (sem aviso de > 26 h)', () => {
    const p: AbTest = { ...TESTE, status: 'paused', paused_at: new Date(t0 + 5 * 24 * H).toISOString() }
    const e = estadoV2DoTeste(p, cs, v2(5, new Date(t0)), em03, 15)
    expect(e.estado).toBe('pausado'); expect(e.idade_horas).toBeNull()
  })
  it('sem avaliação: idade nula', () => {
    expect(estadoV2DoTeste(TESTE, cs, null, em03, 15).idade_horas).toBeNull()
  })
})
