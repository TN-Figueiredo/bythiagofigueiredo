// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { classificarTitulo } from '@/lib/youtube/teste-youtube/titulo'
import { prepararLeituras, montarRodadas } from '@/lib/youtube/teste-youtube/preparar'
import { REGRA_TESTE_YOUTUBE_VERSAO, resolverOpcoes, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import * as indice from '@/lib/youtube/teste-youtube'
import { carregarQIg9, TITULO_A, VIDEO_ID } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura } from './sintetico'

const { leituras: fix, sondas } = carregarQIg9()

function embaralhar<T>(xs: readonly T[], semente: number): T[] {
  const a = [...xs]
  let s = semente
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

const semTitulo = (l: LeituraWatch): LeituraWatch => ({ ...l, titulosExibidos: l.titulosExibidos.map(t => ({ ...t, texto: null })) })
const erro429 = (i: number): LeituraWatch =>
  leitura({ em: new Date(Date.parse('2026-10-18T18:00:00Z') + i * 60_000).toISOString(), rodada: `e${i}`, erro: 'http_429', video: VIDEO_ID, titulo: null })

describe('detectarTesteYoutube', () => {
  const c1 = detectarTesteYoutube(fix)

  it('C1 completo', () => {
    if (c1.estado !== 'provavel_teste') throw new Error(`estado ${c1.estado}`)
    expect(c1.campos).toEqual(['titulo'])
    expect(c1.variantes.titulo[0]).toBe(TITULO_A)
    expect(c1.porCampo.titulo).toEqual({ estado: 'provavel_teste' })
    expect(c1.porCampo.miniatura).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
    expect(c1.versaoRegra).toBe(1)
    expect(c1.tituloOficial).toBe(TITULO_A)
    expect(c1.contagem.recebidas).toBe(60)
    expect(c1.contagem.invalidas).toBe(0)
    expect(c1.contagem.comErro).toBe(0)
    expect(c1.contagem.validasTitulo).toBe(60)
    expect(c1.contagem.validasMiniatura).toBeGreaterThanOrEqual(9)
    expect(Object.values(c1.proporcao.titulo).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
  })

  it('o título do veredito bate com classificarTitulo (contagem soma o que a T4a calcula)', () => {
    const prep = prepararLeituras(fix)
    const r = classificarTitulo(prep.leituras, resolverOpcoes())
    expect(c1.contagem.rodadas).toBe(r.contagem.rodadas)
    expect(c1.contagem.rodadasLongas).toBe(r.contagem.rodadasLongas)
    expect(c1.contagem.rodadasMistasTitulo).toBe(13)
    expect(montarRodadas(prep.leituras, resolverOpcoes()).length).toBe(c1.contagem.rodadas)
  })

  it('C6: sondas só de miniatura = insuficiente, titulo_nao_lido', () => {
    const v = detectarTesteYoutube(sondas)
    expect(v.estado).toBe('insuficiente')
    if (v.estado !== 'insuficiente') throw new Error('x')
    expect(v.detalhe).toEqual({ motivo: 'titulo_nao_lido' })
    expect(v.porCampo.miniatura).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
    expect(v.porCampo.titulo).toEqual({ estado: 'nao_lido' })
  })

  it('C7 integrado: 5 sinais, estado igual ao de C6', () => {
    const v = detectarTesteYoutube(sondas)
    expect(v.sinaisFracos).toHaveLength(5)
    expect(v.sinaisFracos.every(s => s.em === '2026-10-18T16:42:25.000Z' && s.tipo === 'reenvio_mesma_imagem')).toBe(true)
    expect(v.sinaisFracos.map(s => s.variante)).toEqual(['hq720', 'hqdefault', 'maxresdefault', 'mqdefault', 'sddefault'])
    expect(v.estado).toBe('insuficiente')
  })

  it('C12: renderer principal nulo não muda o veredito', () => {
    const l = fix.map(x => ({
      ...x,
      titulosExibidos: x.titulosExibidos.map(t => (t.renderer === 'videoPrimaryInfoRenderer' ? { ...t, texto: null } : t)),
    }))
    expect(detectarTesteYoutube(l)).toEqual(c1)
  })

  it('C12: 3 renderers nulos = titulo_nao_lido; sem miniatura também = sem_leitura', () => {
    const v = detectarTesteYoutube(fix.map(semTitulo))
    expect(v).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'titulo_nao_lido' } })
    expect(v.contagem.validasTitulo).toBe(0)
    expect(v.porCampo.miniatura.estado).toBe('nada_visivel')
    const w = detectarTesteYoutube(fix.map(l => ({ ...semTitulo(l), miniaturas: [] })))
    expect(w.estado).toBe('sem_leitura')
  })

  it('C13: leituras com erro não alteram o veredito', () => {
    const v = detectarTesteYoutube([...fix, ...Array.from({ length: 20 }, (_, i) => erro429(i))])
    expect(v.contagem.comErro).toBe(20)
    expect(v.contagem.recebidas).toBe(80)
    expect({ ...v, contagem: { ...v.contagem, comErro: 0, recebidas: 60 } }).toEqual(c1)
    expect(detectarTesteYoutube(Array.from({ length: 20 }, (_, i) => erro429(i))).estado).toBe('sem_leitura')
  })

  it('C18: dois vídeos lançam', () => {
    expect(() => detectarTesteYoutube([leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'x' }), leitura({ em: '2026-10-18T10:00:01Z', rodada: 'a', titulo: 'x', video: 'zzzzzzzzzzz' })])).toThrow(Error)
  })

  it('C19: leitura com texto vazio é inválida', () => {
    const ruim = { ...leitura({ em: '2026-10-18T18:00:00Z', rodada: 'v', titulo: '', video: VIDEO_ID }) }
    const v = detectarTesteYoutube([...fix, ruim])
    expect(v.contagem.invalidas).toBe(1)
    expect(v.contagem.recebidas).toBe(61)
    expect({ ...v, contagem: { ...v.contagem, invalidas: 0, recebidas: 60 } }).toEqual(c1)
  })

  it('lista vazia = sem_leitura com contagem zerada', () => {
    const v = detectarTesteYoutube([])
    expect(v.estado).toBe('sem_leitura')
    expect(v.contagem).toMatchObject({ recebidas: 0, invalidas: 0, comErro: 0, validasTitulo: 0, validasMiniatura: 0, rodadas: 0, primeiraMistura: null })
    expect(v.versaoRegra).toBe(REGRA_TESTE_YOUTUBE_VERSAO)
  })

  it('C21: ordem de entrada não muda o veredito', () => {
    const base = detectarTesteYoutube([...fix, ...sondas])
    expect(detectarTesteYoutube(embaralhar([...fix, ...sondas], 3))).toEqual(base)
    expect(detectarTesteYoutube(embaralhar([...fix, ...sondas], 11))).toEqual(base)
  })

  it('índice público reexporta a API (inferirDesfecho chega na T7)', () => {
    for (const nome of ['detectarTesteYoutube', 'leituraWatchSchema', 'validarLeituras', 'RENDERERS_TITULO', 'REGRA_TESTE_YOUTUBE_VERSAO', 'normalizarTitulo', 'mesmaImagem', 'IMAGEM_PADRAO_YT']) {
      expect(nome in indice).toBe(true)
    }
  })
})

describe('conserto r1: campos do veredito público (D2, D3, D8, D9, D10)', () => {
  const rd = (id: string, horaMin: string[], titulo: string) =>
    horaMin.map(hm => leitura({ em: `2026-10-18T${hm}Z`, rodada: id, titulo, video: VIDEO_ID }))

  it('primeiraMistura do C1 é a 1ª leitura da 1ª rodada mista', () => {
    expect(detectarTesteYoutube(fix).contagem.primeiraMistura).toBe('2026-10-18T16:42:56.000Z')
  })

  it('rodadasLongas e rodadasEmQuarentena chegam à contagem; valorUnico e o motivo do título também', () => {
    const ls = [
      ...rd('longa', ['10:00:00', '10:20:00'], 'Titulo A'),
      ...rd('quar', ['12:00:00', '12:01:00', '12:02:00'], 'Titulo A'),
      ...rd('n1', ['14:00:00', '14:00:02', '14:00:04'], 'Titulo A'),
      ...rd('n2', ['15:00:00', '15:00:02', '15:00:04'], 'Titulo A'),
      ...rd('n3', ['16:00:00', '16:00:02', '16:00:04'], 'Titulo A'),
    ]
    const v = detectarTesteYoutube(ls, { escritasConhecidas: [{ em: '2026-10-18T12:00:00Z', campo: 'titulo' }] })
    expect(v.contagem).toMatchObject({ rodadasLongas: 1, rodadasEmQuarentena: 1, primeiraMistura: null })
    if (v.estado !== 'nada_visivel') throw new Error(`estado ${v.estado}`)
    expect(v.motivo).toBe('um_valor_so')
    expect(v.valorUnico).toEqual({ titulo: 'Titulo A' })
    expect(v.porCampo.titulo).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
  })

  it('o motivo por campo acompanha o do título em troca_sem_mistura e em poucas_leituras', () => {
    const troca = [
      ...rd('a1', ['10:00:00', '10:00:02', '10:00:04'], 'Titulo A'),
      ...rd('a2', ['11:00:00', '11:00:02', '11:00:04'], 'Titulo A'),
      ...rd('b1', ['12:00:00', '12:00:02', '12:00:04'], 'Titulo B'),
    ]
    expect(detectarTesteYoutube(troca).porCampo.titulo).toEqual({ estado: 'nada_visivel', motivo: 'troca_sem_mistura' })
    expect(detectarTesteYoutube(troca.slice(0, 3)).porCampo.titulo).toEqual({ estado: 'insuficiente', motivo: 'poucas_leituras' })
  })

  it('o motivo por campo de insuficiente também acompanha o título (span_ilegivel)', () => {
    const ab = ['AB', 'AB', 'BA', 'AB', 'AB', 'BA'].flatMap((p, i) =>
      [...p].map((l, j) => leitura({ em: new Date(Date.parse('2026-10-10T00:00:00Z') + i * 6 * 3_600_000 + j * 2000).toISOString(), rodada: `s${i}`, titulo: l === 'A' ? 'Titulo A' : 'Titulo B', video: VIDEO_ID })),
    )
    const v = detectarTesteYoutube(ab)
    expect(v.estado).toBe('insuficiente')
    expect(v.porCampo.titulo).toEqual({ estado: 'insuficiente', motivo: 'span_ilegivel' })
  })
})
