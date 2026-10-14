// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { atribuirOrigem, type CicloAb, type LeituraAb, type TesteAb } from '@/lib/youtube/coleta/versoes-origem'
import type { AberturaSemOrigem } from '@/lib/youtube/coleta/versoes-derivar'

const T = (min: number): string => new Date(Date.UTC(2026, 2, 10, 12, 0, 0) + min * 60_000).toISOString()
const JANELA = { de: T(0), ate: T(1440) }

function abertura(extra: Partial<AberturaSemOrigem> = {}): AberturaSemOrigem {
  return {
    ytId: 'abcdefghijk', videoId: 'v-1', campo: 'title', tituloOuNulo: 'Novo', hash: 'h', thumb: null,
    capturadoEm: T(1440), janela: JANELA, precisao: '1d', ...extra,
  }
}
const thumb = (retoque = false): AberturaSemOrigem => abertura({
  campo: 'thumb', tituloOuNulo: null, thumb: { dhash: 'a', ancoraDhash: 'a', sha256: null, blobUrl: null, retoque },
})
function teste(extra: Partial<TesteAb> = {}): TesteAb {
  return { id: 't-1', videoId: 'v-1', tipo: 'title', pausadoEm: null, concluidoEm: null, vencedorAplicadoEm: null, tituloOriginal: 'Original', motivoConclusao: null, varianteVencedora: null, ...extra }
}
function ciclo(extra: Partial<CicloAb> = {}): CicloAb {
  return { testId: 't-1', variantId: 'var-1', iniciadoEm: T(600), tituloAplicado: 'Novo', thumbAplicada: false, ...extra }
}
const ab = (testes: TesteAb[], ciclos: CicloAb[] = []): LeituraAb => ({ ok: true, testes, ciclos })
const fora = { origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, instante: null }

describe('atribuirOrigem', () => {
  it('1. item 181: ciclo na janela com título aplicado igual: rotacao, com teste, variante e instante do ciclo', () => {
    expect(atribuirOrigem(abertura(), ab([teste()], [ciclo()]))).toEqual({ origem: 'ab_lab', eventoAb: 'rotacao', abTestId: 't-1', abVariantId: 'var-1', instante: T(600) })
  })

  it('2. item 182: vencedor aplicado na janela; restauro com título igual ao original', () => {
    const v = atribuirOrigem(abertura(), ab([teste({ vencedorAplicadoEm: T(700), varianteVencedora: 'var-9' })]))
    expect(v).toEqual({ origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't-1', abVariantId: 'var-9', instante: T(700) })
    const r = atribuirOrigem(abertura({ tituloOuNulo: 'Original' }), ab([teste({ pausadoEm: T(800) })]))
    expect(r).toEqual({ origem: 'ab_lab', eventoAb: 'restauro', abTestId: 't-1', abVariantId: null, instante: T(800) })
  })

  it('3. item 183: nenhum evento, e evento com título diferente: fora_do_sistema', () => {
    expect(atribuirOrigem(abertura(), ab([]))).toEqual(fora)
    expect(atribuirOrigem(abertura(), ab([teste()], [ciclo({ tituloAplicado: 'Outro' })]))).toEqual(fora)
  })

  it('4. item 184: leitura falha dá nao_se_sabe', () => {
    expect(atribuirOrigem(abertura(), { ok: false })).toMatchObject({ origem: 'nao_se_sabe', eventoAb: null, abTestId: null })
  })

  it('5. videoId nulo dá nao_se_sabe', () => {
    expect(atribuirOrigem(abertura({ videoId: null }), ab([teste()], [ciclo()]))).toMatchObject({ origem: 'nao_se_sabe' })
  })

  it('6. evento na ponta da janela conta; um milissegundo fora não conta', () => {
    const em = (inst: string) => atribuirOrigem(abertura(), ab([teste()], [ciclo({ iniciadoEm: inst })])).origem
    expect(em(JANELA.de)).toBe('ab_lab')
    expect(em(JANELA.ate)).toBe('ab_lab')
    expect(em(new Date(Date.parse(JANELA.de) - 1).toISOString())).toBe('fora_do_sistema')
    expect(em(new Date(Date.parse(JANELA.ate) + 1).toISOString())).toBe('fora_do_sistema')
  })

  it('7. dois ciclos na janela com o título novo: vale o mais recente', () => {
    const r = atribuirOrigem(abertura(), ab([teste()], [ciclo({ iniciadoEm: T(100), variantId: 'a' }), ciclo({ iniciadoEm: T(900), variantId: 'b' })]))
    expect(r).toMatchObject({ abVariantId: 'b', instante: T(900) })
  })

  it('8. thumbnail: ciclo com thumbAplicada falso não explica', () => {
    expect(atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail' })], [ciclo({ thumbAplicada: false })]))).toEqual(fora)
    expect(atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail' })], [ciclo({ thumbAplicada: true })]))).toMatchObject({ eventoAb: 'rotacao' })
  })

  it('9. mutação de vídeo: teste de outro vídeo com evento na janela não explica', () => {
    expect(atribuirOrigem(abertura(), ab([teste({ videoId: 'v-2', vencedorAplicadoEm: T(700) })], [ciclo()]))).toEqual(fora)
  })

  it('10. linha de base passada por engano: lança', () => {
    expect(() => atribuirOrigem(abertura({ janela: null, precisao: 'first' }), ab([]))).toThrow()
  })

  it('11. prioridade: vencedor e ciclo na mesma janela: vencedor', () => {
    expect(atribuirOrigem(abertura(), ab([teste({ vencedorAplicadoEm: T(700) })], [ciclo()])).eventoAb).toBe('vencedor')
  })

  it("12. nenhum retorno com origem 'cms'", () => {
    const casos = [
      atribuirOrigem(abertura(), ab([])), atribuirOrigem(abertura(), { ok: false }),
      atribuirOrigem(abertura(), ab([teste({ vencedorAplicadoEm: T(700) })])), atribuirOrigem(thumb(), ab([teste({ pausadoEm: T(5) })])),
    ]
    for (const c of casos) expect(c.origem).not.toBe('cms')
  })

  it('13. (D-I3, S-I2) pausa de combo com as duas trocas na janela: título igual ao original e thumbnail saem restauro com o instante da parada', () => {
    const t = teste({ tipo: 'combo', pausadoEm: T(1000) })
    expect(atribuirOrigem(abertura({ tituloOuNulo: 'Original' }), ab([t]))).toMatchObject({ eventoAb: 'restauro', instante: T(1000) })
    expect(atribuirOrigem(thumb(), ab([t]))).toMatchObject({ eventoAb: 'restauro', instante: T(1000) })
  })

  it('14. pausa e rotação com thumbAplicada na mesma janela, campo thumbnail: restauro ganha', () => {
    const r = atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail', pausadoEm: T(1000) })], [ciclo({ thumbAplicada: true })]))
    expect(r.eventoAb).toBe('restauro')
  })

  it('15. thumbnail, encerrado sem vencedor (manual_archive): restauro; 1 ms fora: fora_do_sistema; motivo nulo ou fora da lista: fora', () => {
    const t = (concl: string, motivo: string | null) => ab([teste({ tipo: 'thumbnail', concluidoEm: concl, motivoConclusao: motivo })])
    expect(atribuirOrigem(thumb(), t(T(1000), 'manual_archive'))).toMatchObject({ eventoAb: 'restauro', instante: T(1000), abTestId: 't-1', abVariantId: null })
    expect(atribuirOrigem(thumb(), t(new Date(Date.parse(JANELA.ate) + 1).toISOString(), 'manual_archive'))).toEqual(fora)
    expect(atribuirOrigem(thumb(), t(T(1000), null))).toEqual(fora)
    expect(atribuirOrigem(thumb(), t(T(1000), 'max_duration'))).toEqual(fora)
  })

  it('16. vencedor por campo: teste title explica o título e não a thumbnail; combo explica as duas; description explica a descrição', () => {
    const v = (tipo: TesteAb['tipo']) => ab([teste({ tipo, vencedorAplicadoEm: T(700) })])
    expect(atribuirOrigem(abertura(), v('title')).eventoAb).toBe('vencedor')
    expect(atribuirOrigem(thumb(), v('title'))).toEqual(fora)
    expect(atribuirOrigem(abertura(), v('combo')).eventoAb).toBe('vencedor')
    expect(atribuirOrigem(thumb(), v('combo')).eventoAb).toBe('vencedor')
    const d = abertura({ campo: 'desc', tituloOuNulo: null })
    expect(atribuirOrigem(d, v('description')).eventoAb).toBe('vencedor')
    expect(atribuirOrigem(d, v('title'))).toEqual(fora)
  })

  it('17. retoque de thumbnail com pausa de teste de tipo title na janela: restauro (desvio 15)', () => {
    expect(atribuirOrigem(thumb(true), ab([teste({ tipo: 'title', pausadoEm: T(300) })])).eventoAb).toBe('restauro')
  })

  it('18. manual_winner em teste combo, thumbnail, winner_applied_at nulo: vencedor com instante = concluidoEm e variante vencedora; nunca restauro', () => {
    const r = atribuirOrigem(thumb(), ab([teste({ tipo: 'combo', concluidoEm: T(900), motivoConclusao: 'manual_winner', varianteVencedora: 'var-7' })]))
    expect(r).toEqual({ origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't-1', abVariantId: 'var-7', instante: T(900) })
  })

  it('19. auto_resolve sem aplicação e ciclo com thumbAplicada na janela: rotacao', () => {
    const r = atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail', concluidoEm: T(900), motivoConclusao: 'auto_resolve' })], [ciclo({ thumbAplicada: true })]))
    expect(r).toMatchObject({ eventoAb: 'rotacao', abTestId: 't-1', abVariantId: 'var-1' })
  })

  it('20. auto_resolve sem aplicação e sem ciclo na janela: fora_do_sistema', () => {
    expect(atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail', concluidoEm: T(900), motivoConclusao: 'auto_resolve' })]))).toEqual(fora)
  })

  it('21. manual_no_apply e inconclusive: sem ciclo, restauro; com ciclo thumbAplicada na janela, nao_se_sabe incerta; ciclo 1 ms fora volta a restauro', () => {
    for (const motivo of ['manual_no_apply', 'inconclusive']) {
      const t = teste({ tipo: 'thumbnail', concluidoEm: T(1000), motivoConclusao: motivo })
      expect(atribuirOrigem(thumb(), ab([t])).eventoAb).toBe('restauro')
      expect(atribuirOrigem(thumb(), ab([t], [ciclo({ thumbAplicada: true })]))).toEqual({
        origem: 'nao_se_sabe', eventoAb: null, abTestId: 't-1', abVariantId: null, instante: null, incerta: true,
      })
      const fora1ms = new Date(Date.parse(JANELA.de) - 1).toISOString()
      expect(atribuirOrigem(thumb(), ab([t], [ciclo({ thumbAplicada: true, iniciadoEm: fora1ms })])).eventoAb).toBe('restauro')
    }
  })

  it('22. manual_winner em teste title, thumbnail trocada (inclusive retoque): nao_se_sabe incerta; o título segue a regra do título', () => {
    const t = teste({ tipo: 'title', concluidoEm: T(1000), motivoConclusao: 'manual_winner' })
    expect(atribuirOrigem(thumb(), ab([t]))).toMatchObject({ origem: 'nao_se_sabe', abTestId: 't-1', incerta: true })
    expect(atribuirOrigem(thumb(true), ab([t]))).toMatchObject({ origem: 'nao_se_sabe', incerta: true })
    expect(atribuirOrigem(abertura({ tituloOuNulo: 'Original' }), ab([t])).eventoAb).toBe('restauro')
    expect(atribuirOrigem(abertura(), ab([t]))).toEqual(fora)
  })

  it('23. manual_winner de combo e ciclo de thumbnail na mesma janela: vencedor ganha', () => {
    const t = teste({ tipo: 'combo', concluidoEm: T(1000), motivoConclusao: 'manual_winner', varianteVencedora: 'v9' })
    expect(atribuirOrigem(thumb(), ab([t], [ciclo({ thumbAplicada: true })])).eventoAb).toBe('vencedor')
  })

  it('24. (S-n5) todo vencedor e todo restauro trazem abTestId não nulo; restauro com variante nula', () => {
    const casos: Array<ReturnType<typeof atribuirOrigem>> = [
      atribuirOrigem(abertura(), ab([teste({ vencedorAplicadoEm: T(700) })])),
      atribuirOrigem(abertura({ tituloOuNulo: 'Original' }), ab([teste({ pausadoEm: T(5) })])),
      atribuirOrigem(thumb(), ab([teste({ tipo: 'thumbnail', concluidoEm: T(5), motivoConclusao: 'manual_archive' })])),
      atribuirOrigem(thumb(), ab([teste({ tipo: 'combo', concluidoEm: T(5), motivoConclusao: 'manual_winner' })])),
    ]
    for (const c of casos) expect(c.abTestId).toBe('t-1')
    expect(casos[1]!.abVariantId).toBeNull()
    expect(casos[2]!.abVariantId).toBeNull()
  })
})
