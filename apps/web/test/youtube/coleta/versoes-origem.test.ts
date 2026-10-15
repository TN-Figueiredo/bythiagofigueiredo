// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { atribuirOrigem, P3_PROMOVIDA_EM, type CicloAb, type LeituraAb, type RestauroAb, type TesteAb } from '@/lib/youtube/coleta/versoes-origem'
import type { CompletedReason } from '@/lib/youtube/ab-types'
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
    const t = (concl: string, motivo: CompletedReason | null) => ab([teste({ tipo: 'thumbnail', concluidoEm: concl, motivoConclusao: motivo })])
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
    for (const motivo of ['manual_no_apply', 'inconclusive'] as const) {
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

  it('25. (portão 14/10, Phil I-2) inconclusive de teste de título ou descrição não explica a thumbnail; de thumbnail e combo, sim', () => {
    for (const tipo of ['title', 'description'] as const) {
      expect(atribuirOrigem(thumb(), ab([teste({ tipo, concluidoEm: T(1000), motivoConclusao: 'inconclusive' })]))).toEqual(fora)
    }
    for (const tipo of ['thumbnail', 'combo'] as const) {
      expect(atribuirOrigem(thumb(), ab([teste({ tipo, concluidoEm: T(1000), motivoConclusao: 'inconclusive' })])).eventoAb).toBe('restauro')
    }
  })

  it('26. (portão 14/10, Phil m-5) 4b com dois testes na janela: o mais recente, em qualquer ordem de leitura', () => {
    const a = teste({ id: 't-a', tipo: 'title', concluidoEm: T(500), motivoConclusao: 'manual_winner' })
    const b = teste({ id: 't-b', tipo: 'description', concluidoEm: T(900), motivoConclusao: 'manual_winner' })
    expect(atribuirOrigem(thumb(), ab([a, b])).abTestId).toBe('t-b')
    expect(atribuirOrigem(thumb(), ab([b, a])).abTestId).toBe('t-b')
  })

  it('27. (portão 14/10, Yannis M8) espaços nas pontas do título não escondem o restauro', () => {
    expect(atribuirOrigem(abertura({ tituloOuNulo: 'Original ' }), ab([teste({ pausadoEm: T(5) })])).eventoAb).toBe('restauro')
  })

  // ── Emenda 15/10 (trava do A/B Lab): histórico ab_test_restores e restore_status (casos 33 a 45d) ──────────────────────
  describe('mundo novo (ab_test_restores)', () => {
    const novo = (extra: Partial<TesteAb> = {}): TesteAb => teste({ mundoNovo: true, tipo: 'combo', ...extra })
    function rest(extra: Partial<RestauroAb> = {}): RestauroAb {
      return { testId: 't-1', seq: 1, campo: 'thumb', destino: 'original', estado: 'ok', escreveu: true, em: T(1000), ...extra }
    }
    const abn = (testes: TesteAb[], restauros: RestauroAb[] = [], ciclos: CicloAb[] = []): LeituraAb => ({ ok: true, testes, ciclos, restauros })
    const incerta = { origem: 'nao_se_sabe', eventoAb: null, abTestId: 't-1', abVariantId: null, instante: null, incerta: true }
    const mais = (inst: string, ms: number): string => new Date(Date.parse(inst) + ms).toISOString()

    it('33. mundo antigo intacto: restauros vazios e mundoNovo falso dão o mesmo resultado (inclusive o caso 14: parada e ciclo, restauro)', () => {
      const t = teste({ tipo: 'thumbnail', pausadoEm: T(1000) })
      const c = [ciclo({ thumbAplicada: true })]
      expect(atribuirOrigem(thumb(), { ok: true, testes: [t], ciclos: c }).eventoAb).toBe('restauro')
      expect(atribuirOrigem(thumb(), { ok: true, testes: [t], ciclos: c, restauros: [] }).eventoAb).toBe('restauro')
      expect(atribuirOrigem(thumb(), { ok: true, testes: [{ ...t, mundoNovo: false }], ciclos: c, restauros: [] }).eventoAb).toBe('restauro')
    })

    it('34. thumb: linha ok/true/original na janela, paused_at uma hora antes: restauro com o instante da linha', () => {
      const r = atribuirOrigem(thumb(), abn([novo({ pausadoEm: T(940) })], [rest()]))
      expect(r).toEqual({ origem: 'ab_lab', eventoAb: 'restauro', abTestId: 't-1', abVariantId: null, instante: T(1000) })
    })

    it('35. título: linha ok/true/original e título novo igual a original_title: restauro; diferente: fora_do_sistema', () => {
      const l = rest({ campo: 'title' })
      expect(atribuirOrigem(abertura({ tituloOuNulo: 'Original ' }), abn([novo()], [l])).eventoAb).toBe('restauro')
      expect(atribuirOrigem(abertura({ tituloOuNulo: 'Novo' }), abn([novo()], [l]))).toEqual(fora)
    })

    it('36. linha ok/true/uuid: vencedor com a variante do destino e o instante da linha', () => {
      const r = atribuirOrigem(thumb(), abn([novo()], [rest({ destino: 'var-5' })]))
      expect(r).toEqual({ origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't-1', abVariantId: 'var-5', instante: T(1000) })
    })

    it('37. escreveu = false (ok, pulado_*, desistiu, falhou) com paused_at na janela: sem ciclo fora_do_sistema; com ciclo de thumb na janela rotacao', () => {
      for (const estado of ['ok', 'pulado_drift', 'pulado_sem_original', 'desistiu', 'falhou'] as const) {
        const t = novo({ pausadoEm: T(1000) })
        const l = rest({ estado, escreveu: false })
        expect(atribuirOrigem(thumb(), abn([t], [l])), estado).toEqual(fora)
        expect(atribuirOrigem(thumb(), abn([t], [l], [ciclo({ thumbAplicada: true })])).eventoAb, estado).toBe('rotacao')
      }
    })

    it('38. escreveu nulo (falhou, interrompido e ok) dá nao_se_sabe incerta com o teste', () => {
      for (const estado of ['falhou', 'ok'] as const) {
        expect(atribuirOrigem(thumb(), abn([novo()], [rest({ estado, escreveu: null })])), estado).toEqual(incerta)
      }
      expect(atribuirOrigem(thumb(), abn([novo()], [rest({ estado: 'falhou', escreveu: null, destino: 'var-1' })]))).toEqual(incerta)
    })

    it('39. escreveu = true com estado falhou: nao_se_sabe incerta', () => {
      expect(atribuirOrigem(thumb(), abn([novo()], [rest({ estado: 'falhou', escreveu: true })]))).toEqual(incerta)
    })

    it('40. em_andamento na janela: incerta com 4 min (relógio real, sem relógio falso) e com 3 h; depois de ate, ignorado; e vence ciclo mais antigo', () => {
      const ate = new Date().toISOString()
      const janela = { de: mais(ate, -86_400_000), ate }
      const a = (em: string, ciclos: CicloAb[] = []) => atribuirOrigem(abertura({ campo: 'thumb', tituloOuNulo: null, thumb: { dhash: 'a', ancoraDhash: 'a', sha256: null, blobUrl: null, retoque: false }, janela, capturadoEm: ate }),
        abn([novo({ emAndamento: { thumb: em } })], [], ciclos))
      expect(a(mais(ate, -4 * 60_000))).toEqual(incerta)
      expect(a(mais(ate, -3 * 3_600_000))).toEqual(incerta)
      expect(a(mais(ate, 1))).toEqual(fora)
      expect(a(mais(ate, -4 * 60_000), [ciclo({ thumbAplicada: true, iniciadoEm: mais(ate, -2 * 3_600_000) })])).toEqual(incerta)
    })

    it('41. mais recente vence; empates: seq maior, linha sobre em_andamento (formatos Z e +00:00), linha sobre ciclo, id lexicográfico em qualquer ordem', () => {
      const ok = rest()
      expect(atribuirOrigem(thumb(), abn([novo()], [ok, rest({ seq: 2, estado: 'desistiu', escreveu: false, em: T(1100) })])).eventoAb).toBe('restauro')
      expect(atribuirOrigem(thumb(), abn([novo()], [ok], [ciclo({ thumbAplicada: true, iniciadoEm: T(1200) })])).eventoAb).toBe('rotacao')
      const dois = [rest({ seq: 1, destino: 'var-a' }), rest({ seq: 2, destino: 'var-b' })]
      expect(atribuirOrigem(thumb(), abn([novo()], dois))).toMatchObject({ eventoAb: 'vencedor', abVariantId: 'var-b' })
      expect(atribuirOrigem(thumb(), abn([novo()], [...dois].reverse()))).toMatchObject({ abVariantId: 'var-b' })
      // em_andamento (...Z) x linha (+00:00) no mesmo instante: vale a linha
      const emZ = T(1000)
      const emOffset = emZ.replace('Z', '+00:00')
      expect(atribuirOrigem(thumb(), abn([novo({ emAndamento: { thumb: emZ } })], [rest({ em: emOffset })])).eventoAb).toBe('restauro')
      // linha x ciclo no mesmo instante: a linha
      expect(atribuirOrigem(thumb(), abn([novo()], [rest({ em: emOffset })], [ciclo({ thumbAplicada: true, iniciadoEm: emZ })])).eventoAb).toBe('restauro')
      // dois testes, mesmo instante, leitura invertida
      const t1 = novo({ id: 't-a' }), t2 = novo({ id: 't-b' })
      const l1 = rest({ testId: 't-a' }), l2 = rest({ testId: 't-b' })
      expect(atribuirOrigem(thumb(), abn([t1, t2], [l1, l2])).abTestId).toBe('t-a')
      expect(atribuirOrigem(thumb(), abn([t2, t1], [l2, l1])).abTestId).toBe('t-a')
    })

    it('42. R6: combo do mundo novo, parada na janela sem linha: semRegistro (paused_at, completed_at, winner_applied_at); teste title com troca de thumb não é R6', () => {
      for (const col of ['pausadoEm', 'concluidoEm', 'vencedorAplicadoEm'] as const) {
        const r = atribuirOrigem(thumb(), abn([novo({ mundoNovo: true, [col]: T(1000) })]))
        expect(r, col).toMatchObject({ origem: 'nao_se_sabe', abTestId: 't-1', semRegistro: true })
      }
      expect(atribuirOrigem(thumb(), abn([novo({ tipo: 'title', pausadoEm: T(1000) })]))).toEqual(fora)
    })

    it('42b. linha 15 s antes da janela e paused_at 10 s dentro: registro existe (janela alargada em 120 s), fora_do_sistema sem semRegistro', () => {
      const de = Date.parse(JANELA.de)
      const l = rest({ em: new Date(de - 15_000).toISOString() })
      const r = atribuirOrigem(thumb(), abn([novo({ pausadoEm: new Date(de + 10_000).toISOString() })], [l]))
      expect(r).toEqual(fora)
      // 130 s antes: fora da alargada, é parada sem registro
      const longe = rest({ em: new Date(de - 130_000).toISOString() })
      expect(atribuirOrigem(thumb(), abn([novo({ pausadoEm: new Date(de + 10_000).toISOString() })], [longe])).semRegistro).toBe(true)
    })

    it('43. linha pulado_drift/false na janela conta como registro: sem R6', () => {
      const r = atribuirOrigem(thumb(), abn([novo({ pausadoEm: T(1000) })], [rest({ estado: 'pulado_drift', escreveu: false })]))
      expect(r).toEqual(fora)
    })

    it('44. descrição: linha e em_andamento não mudam nada; ordem 3 só antes de P3_PROMOVIDA_EM, nos dois mundos', () => {
      const d = (de: number, ate: number) => abertura({ campo: 'desc', tituloOuNulo: null, janela: { de: new Date(de).toISOString(), ate: new Date(ate).toISOString() } })
      const p3 = Date.parse(P3_PROMOVIDA_EM)
      expect(Number.isNaN(p3)).toBe(false)
      const dia1 = 86_400_000
      const antes = new Date(p3 - 3_600_000).toISOString()
      const depois = new Date(p3 + 3_600_000).toISOString()
      const janela = d(p3 - 10 * dia1, p3 + 10 * dia1)
      for (const [nome, extra] of [['antigo', {}], ['novo', { mundoNovo: true, tipo: 'combo' as const }]] as const) {
        const w = (inst: string) => abn([teste({ tipo: 'combo', ...extra, vencedorAplicadoEm: inst })])
        expect(atribuirOrigem(janela, w(antes)), nome).toMatchObject({ eventoAb: 'vencedor', abTestId: 't-1' })
        expect(atribuirOrigem(janela, w(depois)), nome).toEqual(fora)
      }
      // linha e em_andamento não explicam descrição
      const j = abertura({ campo: 'desc', tituloOuNulo: null })
      expect(atribuirOrigem(j, abn([novo({ emAndamento: { thumb: T(1000) } })], [rest(), rest({ campo: 'title', seq: 2 })]))).toEqual(fora)
    })

    it('45. borda: em = de e em = ate entram; um milissegundo fora não', () => {
      const r = (em: string) => atribuirOrigem(thumb(), abn([novo()], [rest({ em })])).eventoAb
      expect(r(JANELA.de)).toBe('restauro')
      expect(r(JANELA.ate)).toBe('restauro')
      expect(r(mais(JANELA.ate, 1))).toBeNull() // fora; sem parada em colunas: fora_do_sistema
    })

    it('45c. teste parado pelo código velho e encerrado pelo novo na mesma janela: fora_do_sistema (risco aceito do deploy)', () => {
      const t = teste({ tipo: 'thumbnail', pausadoEm: T(540), concluidoEm: T(960) })
      expect(atribuirOrigem(thumb(), abn([t], [rest({ estado: 'ok', escreveu: false, em: T(960) })]))).toEqual(fora)
    })

    it('45d. R2 do título com reescolha: linha mais nova que não bate + ciclo mais antigo com title_set igual: rotacao; R3 não confere o título', () => {
      const l = rest({ campo: 'title', em: T(1200) })
      const c = ciclo({ iniciadoEm: T(600), tituloAplicado: 'Novo' })
      expect(atribuirOrigem(abertura({ tituloOuNulo: 'Novo' }), abn([novo()], [l], [c]))).toMatchObject({ eventoAb: 'rotacao', instante: T(600) })
      const v = rest({ campo: 'title', destino: 'var-5' })
      expect(atribuirOrigem(abertura({ tituloOuNulo: 'Qualquer' }), abn([novo()], [v]))).toMatchObject({ eventoAb: 'vencedor', abVariantId: 'var-5' })
    })
  })
})
