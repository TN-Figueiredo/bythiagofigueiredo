// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  leituraWatchSchema,
  validarLeituras,
  resolverOpcoes,
  PADROES_DETECCAO,
  RENDERERS_TITULO,
} from '@/lib/youtube/teste-youtube/tipos'
import { leitura, VIDEO } from './sintetico'

const base = () => leitura({ em: '2026-10-18T16:42:56.000Z', rodada: 'r0', titulo: 'Titulo A' })

function comMiniatura(m: Record<string, unknown>) {
  return {
    ...base(),
    miniaturas: [
      {
        url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
        host: 'i.ytimg.com',
        variante: 'hqdefault',
        largura: 480,
        altura: 360,
        http: 200,
        etag: null,
        sha16: null,
        dhash: '106068cba7a3c3c8',
        ...m,
      },
    ],
  }
}

describe('leituraWatchSchema', () => {
  it('aceita a leitura sintética', () => {
    expect(leituraWatchSchema.safeParse(base()).success).toBe(true)
    expect(base().youtubeVideoId).toBe(VIDEO)
    expect(base().titulosExibidos.map(t => t.renderer)).toEqual([...RENDERERS_TITULO])
  })

  it('C19: texto vazio é recusado', () => {
    const l = { ...base(), titulosExibidos: [{ renderer: 'x', texto: '' }] }
    expect(leituraWatchSchema.safeParse(l).success).toBe(false)
  })

  it('texto só de espaço, NBSP ou U+200B é recusado (título e oficial)', () => {
    for (const t of [' ', '\u00A0', '\u200B', ' \u200B\u00A0 ']) {
      expect(leituraWatchSchema.safeParse({ ...base(), titulosExibidos: [{ renderer: 'x', texto: t }] }).success).toBe(false)
      expect(leituraWatchSchema.safeParse({ ...base(), tituloOficial: t }).success).toBe(false)
    }
  })

  it('rendicoesSqp: nulo é aceito, inteiro 0-200 também, fora disso não', () => {
    expect(base().rendicoesSqp).toBeNull()
    expect(leituraWatchSchema.safeParse(base()).success).toBe(true)
    expect(leituraWatchSchema.safeParse({ ...base(), rendicoesSqp: 8 }).success).toBe(true)
    expect(leituraWatchSchema.safeParse({ ...base(), rendicoesSqp: 0 }).success).toBe(true)
    expect(leituraWatchSchema.safeParse({ ...base(), rendicoesSqp: 201 }).success).toBe(false)
    expect(leituraWatchSchema.safeParse({ ...base(), rendicoesSqp: -1 }).success).toBe(false)
    expect(leituraWatchSchema.safeParse({ ...base(), rendicoesSqp: 1.5 }).success).toBe(false)
  })

  it('titulo_oficial_fonte nulo se e só se tituloOficial é nulo', () => {
    expect(leituraWatchSchema.safeParse({ ...base(), tituloOficial: 'X', titulo_oficial_fonte: null }).success).toBe(false)
    expect(leituraWatchSchema.safeParse({ ...base(), tituloOficial: null, titulo_oficial_fonte: 'og_title' }).success).toBe(false)
    expect(leituraWatchSchema.safeParse({ ...base(), tituloOficial: 'X', titulo_oficial_fonte: 'og_title' }).success).toBe(true)
  })

  it('C19: dhash exige http 200 e dimensões coerentes', () => {
    expect(leituraWatchSchema.safeParse(comMiniatura({ http: 404 })).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({ largura: null, altura: null })).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({ altura: null })).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({})).success).toBe(true)
  })

  it('lidaEm exige fuso e sai em UTC com milissegundos', () => {
    const com = (lidaEm: string) => leituraWatchSchema.safeParse({ ...base(), lidaEm })
    expect(com('2026-10-18T16:42:56').success).toBe(false)
    const a = com('2026-10-18T16:42:56+00:00')
    expect(a.success && a.data.lidaEm).toBe('2026-10-18T16:42:56.000Z')
    const b = com('2026-10-18T13:42:56-03:00')
    expect(b.success && b.data.lidaEm).toBe('2026-10-18T16:42:56.000Z')
  })

  it('idioma é obrigatório quando algum título foi lido', () => {
    expect(leituraWatchSchema.safeParse({ ...base(), idioma: null }).success).toBe(false)
    const nulo = {
      ...base(),
      idioma: null,
      titulosExibidos: base().titulosExibidos.map(t => ({ ...t, texto: null })),
    }
    expect(leituraWatchSchema.safeParse(nulo).success).toBe(true)
  })

  it('erro: código curto e sem dado', () => {
    expect(leituraWatchSchema.safeParse({ ...base(), erro: 'http_429' }).success).toBe(false)
    const semDado = { ...base(), erro: 'http_429', titulosExibidos: [] }
    expect(leituraWatchSchema.safeParse(semDado).success).toBe(true)
    expect(leituraWatchSchema.safeParse({ ...semDado, erro: 'HTTP 429' }).success).toBe(false)
  })

  it('erro com dhash lido é recusado', () => {
    const l = { ...comMiniatura({}), erro: 'timeout', titulosExibidos: [] }
    expect(leituraWatchSchema.safeParse(l).success).toBe(false)
  })

  it('youtubeVideoId e dhash malformados são recusados', () => {
    expect(leituraWatchSchema.safeParse({ ...base(), youtubeVideoId: 'curto' }).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({ dhash: 'ZZZZZZZZZZZZZZZZ' })).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({ dhash: '106068cba7a3c3c' })).success).toBe(false)
    expect(leituraWatchSchema.safeParse(comMiniatura({ dhash: '106068CBA7A3C3C8' })).success).toBe(false)
  })
})

describe('validarLeituras', () => {
  it('C27: conta inválidas e mantém a ordem de entrada', () => {
    const r = validarLeituras([
      { ...base(), lidaEm: '2026-10-18T16:42:58+00:00', rodadaId: 'c' },
      { ...base(), lidaEm: '2026-10-18T16:42:56.5+00:00', rodadaId: 'a' },
      { ...base(), titulosExibidos: [{ renderer: 'x', texto: '' }] },
      { ...base(), lidaEm: '2026-10-18T16:42:50Z', rodadaId: 'b' },
    ])
    expect(r.validas.length).toBe(3)
    expect(r.invalidas).toBe(1)
    expect(r.validas.map(l => l.rodadaId)).toEqual(['c', 'a', 'b'])
  })
})

describe('resolverOpcoes', () => {
  it('devolve os padrões', () => {
    const o = resolverOpcoes()
    expect(o).toMatchObject(PADROES_DETECCAO)
    expect(o.minLeituras).toBe(9)
    expect(o.minJanelaMistaMs).toBe(30 * 60_000)
    expect(o.dhashMaxSame).toBe(6)
    expect(o.escritasConhecidas).toEqual([])
  })
  it('respeita o que foi passado', () => {
    expect(resolverOpcoes({ minLeituras: 61 }).minLeituras).toBe(61)
  })
  it('padrão ausente (variável apagada) cai no padrão', () => {
    expect(resolverOpcoes({ minLeituras: undefined }).minLeituras).toBe(9)
  })
})
