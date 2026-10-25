// apps/web/test/youtube/agenda/particoes.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { avaliarParticoes, avaliarComAgenda, lerMesesAFrente, MOTIVO_NAO_LIDO, MOTIVO_TAREFA_PARADA, MOTIVO_POUCOS, type LinhaParticao } from '@/lib/youtube/agenda/particoes'
import { MOTIVO_SCHEMA_AUSENTE } from '@/lib/youtube/agenda/saude'
import { buildCronHealthReport } from '@/lib/ops/cron-health-report'

const H = 3_600_000
const AGORA = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
const linhas = (m: [number | null, number | null, number | null], conv: string | null = iso(AGORA - 10 * 24 * H)): { valor: LinhaParticao[] } => ({
  valor: [
    { tabela: 'competitor_video_daily', mesesAFrente: m[0], convertidaEm: conv },
    { tabela: 'competitor_video_early', mesesAFrente: m[1], convertidaEm: conv },
    { tabela: 'competitor_video_hourly', mesesAFrente: m[2], convertidaEm: conv },
  ],
})
const okRecente = iso(AGORA - 2 * H)

describe('avaliarParticoes: amarelo abaixo de 6, vermelho abaixo de 3', () => {
  it('12, 12, 12 com a tarefa em dia: ok', () => {
    expect(avaliarParticoes(linhas([12, 12, 12]), okRecente, AGORA)).toMatchObject({ nome: 'particoes_meses_a_frente', status: 'ok' })
  })
  it('6 é ok, 5 é amarelo, 3 é amarelo, 2 é vermelho; vale o pior das três', () => {
    expect(avaliarParticoes(linhas([12, 6, 12]), okRecente, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 5, 12]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo' })
    expect(avaliarParticoes(linhas([3, 12, 12]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo' })
    expect(avaliarParticoes(linhas([12, 12, 2]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
  })
  it('sem dado é vermelho: leitura que falha, schema ausente, lista vazia, tabela fora da lista, não particionada (null), corrente ausente (-1)', () => {
    const v = (x: ReturnType<typeof avaliarParticoes>): void => { expect(x).toMatchObject({ status: 'late', gravidade: 'vermelho' }) }
    v(avaliarParticoes({ porque: 'banco', causa: 'erro_do_banco' }, okRecente, AGORA))
    v(avaliarParticoes({ porque: 'forma', causa: 'forma_invalida' }, okRecente, AGORA))
    v(avaliarParticoes({ porque: 'x', causa: 'schema_ausente', codigo: 'PGRST202' }, okRecente, AGORA))
    v(avaliarParticoes({ valor: [] }, okRecente, AGORA))
    v(avaliarParticoes({ valor: linhas([12, 12, 12]).valor.slice(0, 2) }, okRecente, AGORA))
    v(avaliarParticoes(linhas([12, null, 12]), okRecente, AGORA))
    v(avaliarParticoes(linhas([12, 12, -1]), okRecente, AGORA))
  })
  it('falha passageira de leitura (prazo, exceção): amarelo com MOTIVO_NAO_LIDO, não vermelho', () => {
    expect(avaliarParticoes({ porque: 'o banco não respondeu', causa: 'prazo' }, okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo', motivo: MOTIVO_NAO_LIDO })
    expect(avaliarParticoes({ porque: 'o banco não respondeu', causa: 'excecao' }, okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo', motivo: MOTIVO_NAO_LIDO })
  })
  it('tarefa parada há mais de 72 h: vermelho mesmo com 12 meses; sem nenhum ok conta desde a conversão', () => {
    expect(avaliarParticoes(linhas([12, 12, 12]), iso(AGORA - 73 * H), AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
    expect(avaliarParticoes(linhas([12, 12, 12]), iso(AGORA - 71 * H), AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 20 * H)), null, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 80 * H)), null, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
    expect(avaliarParticoes(linhas([12, 12, 12], null), null, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
  })
  it('agenda não lida (undefined): a regra das 72 h não se aplica; avalia só os meses', () => {
    const velha = linhas([12, 12, 12], iso(AGORA - 80 * H))
    expect(avaliarParticoes(velha, undefined, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 20 * H)), undefined, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([2, 12, 12], iso(AGORA - 80 * H)), undefined, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho', motivo: MOTIVO_POUCOS })
    expect(avaliarParticoes(linhas([5, 12, 12], iso(AGORA - 80 * H)), undefined, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo' })
  })
  it('o motivo é frase fixa, sem número de mês nem texto do banco', () => {
    const x = avaliarParticoes({ porque: 'erro do banco (código XX000) SEGREDO', causa: 'erro_do_banco' }, okRecente, AGORA)
    expect(x.motivo ?? '').not.toMatch(/SEGREDO|XX000/)
  })
})

describe('no relatório: vermelho derruba (down), amarelo degrada', () => {
  it('vermelho → severity critical → down; amarelo → degraded', () => {
    const verm = avaliarParticoes(linhas([12, 12, 2]), okRecente, AGORA)
    const amar = avaliarParticoes(linhas([12, 5, 12]), okRecente, AGORA)
    expect(buildCronHealthReport([], new Date(AGORA), [verm]).status).toBe('down')
    expect(buildCronHealthReport([], new Date(AGORA), [amar]).status).toBe('degraded')
    const passageira = avaliarParticoes({ porque: 'x', causa: 'prazo' }, okRecente, AGORA)
    expect(buildCronHealthReport([], new Date(AGORA), [passageira]).status).toBe('degraded')
    expect(buildCronHealthReport([], new Date(AGORA), [verm]).lateNames).toContain('agenda:particoes_meses_a_frente')
  })
})

describe('lerMesesAFrente', () => {
  const sb = (resp: { data: unknown; error: { code: string } | null } | 'lanca'): SupabaseClient => ({
    rpc: () => ({ abortSignal: () => (resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)) }),
  }) as unknown as SupabaseClient
  it('lê as três linhas', async () => {
    const r = await lerMesesAFrente(sb({ data: [{ table_name: 'competitor_video_daily', months_ahead: 12, last_month: '2027-10-01', converted_at: null }], error: null }))
    expect(r).toEqual({ valor: [{ tabela: 'competitor_video_daily', mesesAFrente: 12, convertidaEm: null }] })
  })
  it('função ausente: schema_ausente; exceção: excecao; forma estranha: forma_invalida', async () => {
    expect(await lerMesesAFrente(sb({ data: null, error: { code: 'PGRST202' } }))).toMatchObject({ causa: 'schema_ausente' })
    expect(await lerMesesAFrente(sb('lanca'))).toMatchObject({ causa: 'excecao' })
    expect(await lerMesesAFrente(sb({ data: [{ table_name: 1 }], error: null }))).toMatchObject({ causa: 'forma_invalida' })
  })
})

describe('avaliarComAgenda: a cola undefined (agenda não lida) × null (nunca rodou)', () => {
  const item = (nome: string, ultimoOk: string | null) => ({ nome, status: 'late' as const, ultimoOk, toleranciaH: 36 })
  const conv = iso(AGORA - 80 * H)
  it('sem o item da tarefa entre os da agenda (só `leitura`): undefined → só os meses (ok com 12)', () => {
    expect(avaliarComAgenda(linhas([12, 12, 12], conv), [item('leitura', null)], AGORA).status).toBe('ok')
  })
  it('item unknown por schema ausente (guarda_mg10) conta como não lido: ok com 12 meses', () => {
    const unk = { nome: 'particoes_a_frente', status: 'unknown' as const, ultimoOk: null, toleranciaH: 36, motivo: MOTIVO_SCHEMA_AUSENTE }
    expect(avaliarComAgenda(linhas([12, 12, 12], conv), [unk], AGORA).status).toBe('ok')
  })
  it('com o item e ultimoOk null (nunca rodou): MOTIVO_TAREFA_PARADA', () => {
    expect(avaliarComAgenda(linhas([12, 12, 12], conv), [item('particoes_a_frente', null)], AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho', motivo: MOTIVO_TAREFA_PARADA })
  })
  it('com o item e ok recente: ok', () => {
    expect(avaliarComAgenda(linhas([12, 12, 12], conv), [item('particoes_a_frente', okRecente)], AGORA).status).toBe('ok')
  })
})
