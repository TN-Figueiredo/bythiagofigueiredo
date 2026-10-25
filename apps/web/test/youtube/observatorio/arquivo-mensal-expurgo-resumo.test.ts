// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { refazerResumo } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo'

const V1 = '11111111-1111-1111-1111-111111111111'
const V2 = '22222222-2222-2222-2222-222222222222'
const colunas = ['video_id', 'snap_date', 'views', 'likes', 'comments']
const base = { classe: 'serie', canal: 'c1', mes: '2026-09', diasDoMes: 30, versao: 2 }

describe('expurgo: resumo refeito', () => {
  it('(a) um vídeo removido: conta só o que ficou', () => {
    const unidade = { colunas, linhas: [[V2, '2026-09-01', '5', '1', '0'], [V2, '2026-09-03', '9', '2', '1']] }
    const r = refazerResumo({ ...base, unidades: [{ tabela: 'competitor_video_daily', unidade, hashConteudo: 'h' }], vazias: [] })
    expect(r.vazio).toBe(false)
    expect(r.canal).toHaveLength(1)
    const c = r.canal[0]!
    expect(c.slice(0, 7)).toEqual(['c1', 'competitor_video_daily', '2026-09', '1', '2', '2', '30'])
    expect(c.slice(9, 12)).toEqual(['4', '1', '1'])
    expect(c.slice(12)).toEqual(['h', '2'])
    expect(r.video).toHaveLength(1)
    expect(r.video[0]![0]).toBe(V2)
  })
  it('(b) valor nulo numa leitura medida: var_views nulo, nunca zero', () => {
    const unidade = { colunas, linhas: [[V1, '2026-09-01', null, '1', '0'], [V1, '2026-09-02', '9', '2', '1']] }
    const r = refazerResumo({ ...base, unidades: [{ tabela: 'competitor_video_daily', unidade, hashConteudo: 'h' }], vazias: [] })
    expect(r.canal[0]![9]).toBeNull()
    expect(r.canal[0]![10]).toBe('1')
  })
  it('(c) tabela vazia: contagens 0 e datas nulas', () => {
    const unidade = { colunas, linhas: [[V1, '2026-09-01', '1', '1', '1']] }
    const r = refazerResumo({
      ...base, unidades: [{ tabela: 'competitor_video_daily', unidade, hashConteudo: 'h' }],
      vazias: [{ tabela: 'competitor_video_early', hashConteudo: 'e' }],
    })
    const v = r.canal.find(l => l[1] === 'competitor_video_early')!
    expect(v.slice(3, 6)).toEqual(['0', '0', '0'])
    expect(v[7]).toBeNull()
    expect(v[8]).toBeNull()
    expect(v[9]).toBeNull()
  })
  it('tudo vazio: resumo vazio sem linhas', () => {
    const r = refazerResumo({ ...base, unidades: [], vazias: [{ tabela: 'competitor_video_daily', hashConteudo: 'e' }] })
    expect(r).toMatchObject({ vazio: true, canal: [], video: [] })
  })
  it('(d) versao_resumo e hash_conteudo_unidade em toda linha', () => {
    const unidade = { colunas, linhas: [[V1, '2026-09-01', '1', '1', '1']] }
    const r = refazerResumo({ ...base, versao: 3, unidades: [{ tabela: 'competitor_video_daily', unidade, hashConteudo: 'hh' }], vazias: [] })
    for (const l of r.canal) expect(l.slice(-2)).toEqual(['hh', '3'])
    for (const l of r.video) expect(l.slice(-2)).toEqual(['hh', '3'])
  })
  it('dias medidos usam o dia de São Paulo', () => {
    const colH = ['video_id', 'hour_slot', 'views', 'likes', 'comments']
    const unidade = { colunas: colH, linhas: [[V1, '2026-09-01 02:00:00+00', '1', '1', '1'], [V1, '2026-09-01 04:00:00+00', '2', '1', '1']] }
    const r = refazerResumo({ ...base, classe: 'horaria', unidades: [{ tabela: 'competitor_video_hourly', unidade, hashConteudo: 'h' }], vazias: [] })
    expect(r.canal[0]![5]).toBe('2')
  })
})
