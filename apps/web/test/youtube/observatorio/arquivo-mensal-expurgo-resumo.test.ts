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
  it('sem nenhuma unidade lança (ausência não é vazio)', () => {
    expect(() => refazerResumo({ ...base, unidades: [], vazias: [] })).toThrow('resumo_sem_unidades')
  })
  it('timestamp sem offset lança', () => {
    const unidade = { colunas: ['video_id', 'hour_slot', 'views', 'likes', 'comments'], linhas: [[V1, '2026-09-01 03:00:00', '1', '1', '1']] }
    expect(() => refazerResumo({ ...base, classe: 'horaria', unidades: [{ tabela: 'competitor_video_hourly', unidade, hashConteudo: 'h' }], vazias: [] }))
      .toThrow('instante_ilegivel')
  })
  it('medida não inteira lança', () => {
    const unidade = { colunas, linhas: [[V1, '2026-09-01', '', '1', '0'], [V1, '2026-09-02', '9', '2', '1']] }
    expect(() => refazerResumo({ ...base, unidades: [{ tabela: 'competitor_video_daily', unidade, hashConteudo: 'h' }], vazias: [] }))
      .toThrow('valor_nao_inteiro')
  })
  it('raw de canal com video_id nulo: grupo nulo contado', () => {
    const unidade = { colunas: ['video_id', 'last_seen_at'], linhas: [[null, '2026-09-01 12:00:00+00'], [V1, '2026-09-02 12:00:00+00']] }
    const r = refazerResumo({ ...base, unidades: [{ tabela: 'competitor_raw', unidade, hashConteudo: 'h' }], vazias: [] })
    expect(r.canal[0]!.slice(3, 6)).toEqual(['2', '2', '2'])   // o grupo nulo conta como um "vídeo", como o group by do SQL
    expect(r.video.map(l => l[0])).toEqual([null, V1])
  })
  it('comentários e marcas: resposta usa o ts do pai; marca usa o comentário', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, '2026-09-01 12:00:00+00'], ['8', '7', V1, '2026-09-20 12:00:00+00']] }
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['8', '1']] }
    const r = refazerResumo({
      ...base, comentarios: com,
      unidades: [{ tabela: 'competitor_video_comments', unidade: com, hashConteudo: 'h1' }, { tabela: 'competitor_video_comment_marks', unidade: marcas, hashConteudo: 'h2' }],
      vazias: [],
    })
    const c = r.canal.find(l => l[1] === 'competitor_video_comments')!
    expect(c.slice(4, 6)).toEqual(['2', '1'])
    const m = r.canal.find(l => l[1] === 'competitor_video_comment_marks')!
    expect(m.slice(3, 6)).toEqual(['1', '1', '1'])
    expect(m[7]).toBe('2026-09-01 12:00:00+00')
    expect(() => refazerResumo({ ...base, unidades: [{ tabela: 'competitor_video_comment_marks', unidade: marcas, hashConteudo: 'h2' }], vazias: [] }))
      .toThrow('resumo_de_marcas_sem_comentarios')
    expect(() => refazerResumo({ ...base, comentarios: { colunas: ['id'], linhas: [['8']] }, unidades: [{ tabela: 'competitor_video_comment_marks', unidade: marcas, hashConteudo: 'h2' }], vazias: [] }))
      .toThrow('coluna_ausente: comentarios.parent_id')
  })
})
