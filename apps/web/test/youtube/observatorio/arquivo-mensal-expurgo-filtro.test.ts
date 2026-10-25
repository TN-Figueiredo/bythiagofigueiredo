import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { serializarLinhas } from '@/lib/youtube/observatorio/arquivo/exportar'
import {
  COLUNA_DA_CHAVE, filtrarUnidade, hashConteudo, idsDeComentarioComRespostas, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade,
} from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro'

const V1 = '11111111-1111-1111-1111-111111111111'
const V2 = '22222222-2222-2222-2222-222222222222'
const diaria = { colunas: ['video_id', 'snap_date', 'views'], linhas: [[V1, '2026-09-01', '10'], [V2, '2026-09-01', '5'], [V1, '2026-09-02', '12']] }

describe('expurgo: filtro do item', () => {
  it('tira só as linhas do vídeo e mantém a ordem dos outros', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set([V1]), unidade: diaria })
    expect(r.removidas).toBe(2)
    expect(r.unidade.linhas).toEqual([[V2, '2026-09-01', '5']])
  })
  it('filtro_sem_linhas_conclui_sem_versao: vídeo ausente dá zero removidas', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set(['33333333-3333-3333-3333-333333333333']), unidade: diaria })
    expect(r.removidas).toBe(0)
  })
  it('comentário leva as respostas (parent_id) e as marcas pelo comment_id', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['8', '7', V1, 'x'], ['9', null, V2, 'x']] }
    const r = filtrarUnidade({ tabela: 'competitor_video_comments', kind: 'comentario', chaves: new Set(['7']), unidade: com })
    expect(r.unidade.linhas.map(l => l[0])).toEqual(['9'])
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['8', '2'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'comentario', chaves: new Set(['7', '8']), unidade: marcas })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('vídeo nas marcas: pelos comentários do vídeo na unidade de comentários do mesmo mês', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['9', null, V2, 'x']] }
    const ids = idsDeComentariosDoVideo(com, new Set([V1]))
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'video', chaves: new Set([V1]), unidade: marcas, comentariosDoVideo: ids })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('tabela sem chave conhecida lança, nunca devolve zero', () => {
    expect(() => filtrarUnidade({ tabela: 'outra', kind: 'video', chaves: new Set([V1]), unidade: diaria })).toThrow('tabela_sem_chave')
  })
  it('toda tabela da política fora de ensaio tem chave', () => {
    for (const t of ['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early', 'competitor_video_comments',
      'competitor_video_comment_marks', 'competitor_raw']) expect(COLUNA_DA_CHAVE[t]).toBeDefined()
  })
  it('unidade que esvazia não tem arquivo', () => {
    const s = serializarUnidade({ colunas: diaria.colunas, linhas: [] }, 'views')
    expect(s).toMatchObject({ gz: null, row_count: 0, sha256_bytes: null, csv_sha256: null, control_sum: '0' })
  })
  it('ida e volta: o gz lido de volta tem as mesmas linhas; hash no formato do jsonb', () => {
    const s = serializarUnidade(diaria, 'views')
    expect(lerUnidadeGz(s.gz!)).toEqual(diaria)
    expect(s.control_sum).toBe('27')
    expect(hashConteudo([['a', null]])).toBe(hashConteudo([['a', null]]))
    expect(lerUnidadeGz(gzipSync(serializarLinhas(diaria.colunas, diaria.linhas)))).toEqual(diaria)
  })
  it('marcas do comentário levam as respostas via idsDeComentarioComRespostas', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['8', '7', V1, 'x'], ['9', null, V2, 'x']] }
    const ids = idsDeComentarioComRespostas(com, new Set(['7']))
    expect([...ids].sort()).toEqual(['7', '8'])
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['8', '2'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'comentario', chaves: ids, unidade: marcas })
    expect(m.unidade.linhas).toEqual([['9', '3']])
    expect(m.removidas).toBe(2)
  })
  it('competitor_raw com video_id nulo: nunca é tirado', () => {
    const raw = { colunas: ['video_id', 'last_seen_at', 'payload'], linhas: [[null, '2026-09-01 03:00:00+00', 'a'], [V1, '2026-09-01 03:00:00+00', 'b']] }
    const r = filtrarUnidade({ tabela: 'competitor_raw', kind: 'video', chaves: new Set([V1]), unidade: raw })
    expect(r.removidas).toBe(1)
    expect(r.unidade.linhas.map(l => l[2])).toEqual(['a'])
  })
  it('kind video em comentários: tira também a resposta pelo video_id', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['8', '7', V1, 'x'], ['9', null, V2, 'x']] }
    const r = filtrarUnidade({ tabela: 'competitor_video_comments', kind: 'video', chaves: new Set([V1]), unidade: com })
    expect(r.unidade.linhas.map(l => l[0])).toEqual(['9'])
  })
  it('marcas por vídeo sem comentariosDoVideo lança', () => {
    expect(() => filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'video', chaves: new Set([V1]), unidade: { colunas: ['comment_id'], linhas: [] } }))
      .toThrow('marcas_sem_comentarios_do_video')
  })
  it('coluna da chave ausente lança', () => {
    expect(() => filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set([V1]), unidade: { colunas: ['x'], linhas: [] } }))
      .toThrow('coluna_da_chave_ausente')
  })
  it('soma de coluna de controle: valor não inteiro lança', () => {
    for (const ruim of ['', ' 7 ', '0x10', '1.5'])
      expect(() => serializarUnidade({ colunas: ['views'], linhas: [[ruim]] }, 'views')).toThrow('valor_nao_inteiro')
    expect(serializarUnidade({ colunas: ['views'], linhas: [['-3'], ['5']] }, 'views').control_sum).toBe('2')
  })
  it('hash: formato do jsonb com aspas, acento e vazio', () => {
    // texto esperado de to_jsonb(array['a',null,'x"y','é','']::text[])::text
    const esperado = createHash('sha256').update('["a", null, "x\\"y", "é", ""]').digest('hex')
    expect(hashConteudo([['a', null, 'x"y', 'é', '']])).toBe(esperado)
    expect(hashConteudo([])).toBe(createHash('sha256').update('').digest('hex'))
  })
})
