// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  paraLinhas, leiturasDoBanco, linhaCabeNoBanco, thumbCabeNoBanco,
  type LinhaLeitura, type LinhaLeituraBanco, type LinhaThumb, type LinhaThumbBanco,
} from '@/lib/youtube/watch/expansor'
import type { ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import { VERSAO_LEITOR, extrairDaWatch } from '@/lib/youtube/watch/parser'
import { RENDERERS_TITULO, leituraWatchSchema, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube'
import { carregarQIg9 } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { CASOS_RECUSADOS, SITE_TESTE, RODADA_TESTE, leituraValida } from '../../fixtures/watch-html/casos-recusados'
import { PAGINA_A, jogadorBloqueadoDoVercel } from '../../fixtures/watch-html/derivar'

import { mulberry32, gerar } from '../../fixtures/watch-html/gerador'
const ID = 'qIg9a7vqcNo'
const HEX = '0123456789abcdef'

function comoBanco(l: LinhaLeitura, t: LinhaThumb | null): { linha: LinhaLeituraBanco; thumb: LinhaThumbBanco | null } {
  const { thumb_k, ...resto } = l
  const linha: LinhaLeituraBanco = { ...resto, miniatura_id: thumb_k }
  if (t === null) return { linha, thumb: null }
  const { k, vista_em, ...r } = t
  void vista_em
  return { linha, thumb: { ...r, id: k } }
}

describe('A7 expansor', () => {
  it('ida e volta: 500 resultados do domínio do leitor', () => {
    const rs = gerar(mulberry32(20261018), 500)
    rs.forEach((r, i) => {
      const { leitura, thumb, foraDoFormato } = paraLinhas(r, SITE_TESTE, i + 1)
      expect(foraDoFormato).toBe(false)
      expect(linhaCabeNoBanco(leitura)).toBe(true)
      expect(leitura.versao_leitor).toBe(VERSAO_LEITOR)
      expect(leitura.http).toBe(r.http)
      expect(leitura.jogador_bloqueado).toBe(r.leitura.erro === null && r.jogadorBloqueado)
      const b = comoBanco(leitura, thumb)
      const volta = leiturasDoBanco([b.linha], b.thumb === null ? [] : [b.thumb])
      expect(volta.invalidas).toBe(0)
      const esperado = { ...r.leitura, miniaturas: r.leitura.miniaturas.map(m => ({ ...m, url: `https://${m.host}/vi/${ID}/${m.variante}.jpg` })) }
      expect(volta.validas).toEqual([esperado])
    })
  })

  describe('FU-S4-1: marcas bidi na comparação de títulos', () => {
    const base = () => gerar(mulberry32(11), 1)[0]!
    const com = (textos: string[]): ResultadoLeitor => {
      const r = base()
      return { ...r, leitura: { ...r.leitura, erro: null, idioma: 'pt-BR', miniaturas: [], titulosExibidos: RENDERERS_TITULO.map((renderer, i) => ({ renderer, texto: textos[i] ?? textos[0]! })) } }
    }
    it('2U3QbV2VoI0: só as marcas 202A/202C diferem, exibido sai sem elas', () => {
      const p = paraLinhas(com(['Oi \u202A@Estevam\u202C', 'Oi @Estevam', 'Oi \u202A@Estevam\u202C']), SITE_TESTE, 1)
      expect(p.leitura.titulo_exibido).toBe('Oi @Estevam')
      expect(p.leitura.titulos_divergentes).toBeNull()
      expect(linhaCabeNoBanco(p.leitura)).toBe(true)
    })
    it.each([['200E/200F', '\u200E', '\u200F'], ['202A-202E', '\u202A', '\u202E'], ['2066-2069', '\u2066', '\u2069']])('faixa %s é ignorada', (_n, a, b) => {
      const p = paraLinhas(com([`x${a}y${b}z`, 'xyz', 'xyz']), SITE_TESTE, 1)
      expect(p.leitura.titulo_exibido).toBe('xyz')
      expect(p.leitura.titulos_divergentes).toBeNull()
    })
    it('divergência real continua nula, com os textos brutos', () => {
      const p = paraLinhas(com(['A\u202Cx', 'B', 'A']), SITE_TESTE, 1)
      expect(p.leitura.titulo_exibido).toBeNull()
      expect(p.leitura.titulos_divergentes?.map(d => d.texto)).toContain('A\u202Cx')
    })
  })

  it('miniatura só na leitura que a buscou', () => {
    const [a, b, c] = gerar(mulberry32(7), 3).map(r => ({ ...r, leitura: { ...r.leitura, erro: null, titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: 'T' })), idioma: 'pt-BR' } }))
    const com = { ...a!, leitura: { ...a!.leitura, miniaturas: [{ url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`, host: 'i.ytimg.com', variante: 'hqdefault', largura: 480, altura: 360, http: 200, etag: null, sha16: null, dhash: HEX }] } }
    const sem = (x: ResultadoLeitor): ResultadoLeitor => ({ ...x, leitura: { ...x.leitura, miniaturas: [] } })
    const p = [paraLinhas(com, SITE_TESTE, 1), paraLinhas(sem(b!), SITE_TESTE, 2), paraLinhas(sem(c!), SITE_TESTE, 3)]
    const bancos = p.map(x => comoBanco(x.leitura, x.thumb))
    const thumbs = bancos.flatMap(x => (x.thumb === null ? [] : [x.thumb]))
    const r = leiturasDoBanco(bancos.map(x => x.linha), thumbs)
    expect(r.invalidas).toBe(0)
    expect(r.validas.map(v => v.miniaturas.length)).toEqual([1, 0, 0])
  })

  it('fixture do A/B passa por paraLinhas e leiturasDoBanco', () => {
    const { leituras } = carregarQIg9()
    const direto = detectarTesteYoutube(leituras)
    const uuids = new Map<string, string>()
    const bancos = leituras.map((l, i) => {
      if (!uuids.has(l.rodadaId)) uuids.set(l.rodadaId, `00000000-0000-4000-8000-${String(uuids.size).padStart(12, '0')}`)
      const r: ResultadoLeitor = { leitura: { ...l, rodadaId: uuids.get(l.rodadaId)! }, http: 200, jogadorBloqueado: false }
      const p = paraLinhas(r, SITE_TESTE, i + 1)
      expect(p.foraDoFormato).toBe(false)
      return comoBanco(p.leitura, p.thumb)
    })
    const volta = leiturasDoBanco(bancos.map(b => b.linha), bancos.flatMap(b => (b.thumb === null ? [] : [b.thumb])))
    expect(volta.invalidas).toBe(0)
    const v = detectarTesteYoutube(volta.validas)
    expect(v.estado).toBe(direto.estado)
    expect(v.porCampo.titulo).toEqual(direto.porCampo.titulo)
    expect(v.tituloOficial).toBe(direto.tituloOficial)
    expect(v.contagem.rodadasMistasTitulo).toBe(13)
    const mini = v.porCampo.miniatura
    expect(mini.estado === 'nao_lido' || (mini.estado === 'nada_visivel' && mini.motivo === 'um_valor_so')).toBe(true)
  })

  it('leiturasDoBanco conta como inválida a linha que o contrato recusa, sem lançar', () => {
    const { linha } = comoBanco(leituraValida(), null)
    const ruim: LinhaLeituraBanco = { ...linha, idioma: null }   // título sem idioma: o Zod do contrato recusa
    const r = leiturasDoBanco([linha, ruim], [])
    expect(r.validas).toHaveLength(1)
    expect(r.invalidas).toBe(1)
  })
})

describe('A11 linha envenenada', () => {
  it('300 leituras válidas no Zod: toda saída cabe no banco; o que não cabe vira fora_do_formato', () => {
    const rng = mulberry32(11)
    const rs = gerar(rng, 300).map((r, i): ResultadoLeitor => {
      const l = r.leitura
      if (i % 5 === 0) return { ...r, leitura: { ...l, erro: 'timeout', tituloOficial: 'Oficial', titulo_oficial_fonte: 'og_title', idioma: 'es-419' } }
      if (i % 5 === 1) return { ...r, leitura: { ...l, idioma: 'es-419', miniaturas: [{ url: 'https://i.ytimg.com/vi/x/h.jpg', host: 'i.ytimg.com', variante: 'a'.repeat(30), largura: 10, altura: 10, http: 200, etag: 'e'.repeat(150), sha16: null, dhash: null }] } }
      if (i % 5 === 2) return { ...r, leitura: { ...l, miniaturas: [{ url: 'https://i.ytimg.com/vi/x/H.jpg', host: 'i.ytimg.com', variante: 'HQ', largura: null, altura: null, http: null, etag: null, sha16: null, dhash: null }] } }
      return r
    })
    let fora = 0
    rs.forEach((r, i) => {
      const p = paraLinhas(r, SITE_TESTE, i + 1)
      expect(linhaCabeNoBanco(p.leitura)).toBe(true)
      if (p.thumb !== null) expect(thumbCabeNoBanco(p.thumb)).toBe(true)
      if (p.foraDoFormato) {
        fora++
        expect(p.leitura.erro).toBe('fora_do_formato')
        expect(p.thumb).toBeNull()
        expect(p.leitura.http).toBe(r.http)
      }
    })
    expect(fora).toBeGreaterThan(0)
  })

  it('erro com título oficial grava oficial nulo', () => {
    const r = gerar(mulberry32(3), 1)[0]!
    const e: ResultadoLeitor = { ...r, leitura: { ...r.leitura, erro: 'timeout', tituloOficial: 'X', titulo_oficial_fonte: 'videoDetails', titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: null })), miniaturas: [] } }
    const p = paraLinhas(e, SITE_TESTE, 1)
    expect(p.foraDoFormato).toBe(false)
    expect(p.leitura.titulo_oficial).toBeNull()
    expect(p.leitura.renderers_presentes).toBe(0)
  })

  it('r3: jogador bloqueado do Vercel (oficial e fonte nulos, erro nulo) cabe no banco', () => {
    const ex = extrairDaWatch(jogadorBloqueadoDoVercel(PAGINA_A()), ID)
    expect(ex.jogadorBloqueado).toBe(true)
    expect(ex.tituloOficial).toBeNull()
    const leitura: LeituraWatch = {
      youtubeVideoId: ID, lidaEm: '2026-10-18T12:00:00.000Z', rodadaId: RODADA_TESTE, origemRede: 'vercel', idioma: ex.idioma, erro: ex.erro,
      tituloOficial: ex.tituloOficial, titulo_oficial_fonte: ex.titulo_oficial_fonte, rendicoesSqp: ex.rendicoesSqp, titulosExibidos: ex.titulosExibidos, miniaturas: [],
    }
    const p = paraLinhas({ leitura, http: 200, jogadorBloqueado: ex.jogadorBloqueado }, SITE_TESTE, 1)
    expect(p.foraDoFormato).toBe(false)
    expect(p.leitura.jogador_bloqueado).toBe(true)
    expect(p.leitura.titulo_oficial).toBeNull()
    expect(linhaCabeNoBanco(p.leitura)).toBe(true)
  })
})

describe('casos recusados', () => {
  it.each(CASOS_RECUSADOS.map(c => [c.nome, c] as const))('%s', (_n, c) => {
    expect(c.alvo === 'leitura' ? linhaCabeNoBanco(c.linha) : thumbCabeNoBanco(c.linha)).toBe(false)
  })
  it('a base válida cabe', () => {
    expect(linhaCabeNoBanco(leituraValida())).toBe(true)
  })
})
