// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/youtube/observatorio/proprio/taxa', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/observatorio/proprio/taxa')>()
  return { ...real, wilson: vi.fn(real.wilson) }
})

import { wilson } from '@/lib/youtube/observatorio/proprio/taxa'
import { anteDepoisDaTroca } from '@/lib/youtube/observatorio/proprio-versoes/antes-depois'
import { PROPRIO_RULES } from '@/lib/youtube/observatorio/proprio-versoes/regras'
import type { VersaoPropria } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import { addDays } from '@/lib/youtube/coleta/day-pt'

/** Dia da troca (o dia da linha capturada): as janelas abaixo usam meio-dia UTC, que cai no mesmo dia do Pacífico. */
const D = '2026-03-20'
const meio = (dia: string): string => `${dia}T20:00:00.000Z`

function versao(extra: Partial<VersaoPropria> = {}): VersaoPropria {
  return {
    id: 'v-troca', ytId: 'abcdefghijk', campo: 'title', texto: 'Novo', hash: 'h', thumb: null, primeiroDia: D, ultimoDia: D,
    vistaDesde: meio(D), vistaAte: meio(D), janela: { de: meio(addDays(D, -1)), ate: meio(D) }, precisao: '1d',
    origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, preRegistro: false, corrente: true, ...extra,
  }
}
/** Troca de 1d: exclui D-1 e D. Antes = D-8..D-2; depois = D+1..D+7. */
const dia = (d: string, imp: number | null, cliques: number | null, situacao: DiaAlcance['situacao'] = 'com-impressoes'): DiaAlcance =>
  ({ dia: d, situacao, motivo: null, imp, cliques })
function dias(de: number, ate: number, imp: number, taxa = 0.05): DiaAlcance[] {
  const out: DiaAlcance[] = []
  for (let i = de; i <= ate; i++) out.push(dia(addDays(D, i), imp, imp * taxa))
  return out
}
const sc = (v: VersaoPropria, d: DiaAlcance[], extra: { publicadoEm?: string | null } = {}) =>
  anteDepoisDaTroca({ troca: v, versoesDoVideo: [v], dias: d, publicadoEm: extra.publicadoEm ?? null })

const salvo = { ...PROPRIO_RULES }
afterEach(() => { Object.assign(PROPRIO_RULES, salvo); vi.mocked(wilson).mockClear() })

describe('anteDepoisDaTroca', () => {
  it('1. item 193: 99 de um lado e 5.000 do outro: ainda_nao_da sem taxa nem faixa; 100 e 100: com_leitura (fronteira 99 e 100)', () => {
    const pouco = [...dias(-8, -8, 99), ...dias(1, 1, 5000)]
    const r = sc(versao(), pouco)
    expect(r.estado).toBe('ainda_nao_da')
    if (r.estado !== 'ainda_nao_da') return
    // lado com menos de 100 impressões: sem taxa nem faixa; lado com 100 ou mais: taxa e faixa, sem veredito (decisão 10, opção B)
    expect(r.antes.taxa).toBeNull(); expect(r.antes.lo).toBeNull(); expect(r.antes.hi).toBeNull()
    expect(r.depois.taxa).not.toBeNull(); expect(r.depois.lo).not.toBeNull(); expect(r.depois.hi).not.toBeNull()
    expect(r.antes.imp).toBe(99); expect(r.depois.imp).toBe(5000)
    expect(sc(versao(), [...dias(-8, -8, 100), ...dias(1, 1, 100)]).estado).toBe('com_leitura')
  })

  it('2. item 193: com trocaMinImpressoesPorLado = 50, 60 e 60 passa a com_leitura', () => {
    const d = [...dias(-8, -8, 60), ...dias(1, 1, 60)]
    expect(sc(versao(), d).estado).toBe('ainda_nao_da')
    PROPRIO_RULES.trocaMinImpressoesPorLado = 50
    expect(sc(versao(), d).estado).toBe('com_leitura')
  })

  it('3. item 194: 1d tira dois dias; min um; lacuna de 3 dias tira o buraco; o dia vem do instante, não de primeiroDia', () => {
    // dia D-1 e D com 1000 imp cada: se entrassem, mudariam a soma
    const ruido = [dia(addDays(D, -1), 1000, 50), dia(D, 1000, 50), dia(addDays(D, -2), 1000, 50), dia(addDays(D, 1), 1000, 50)]
    const um = sc(versao(), ruido)
    if (um.estado === 'nao_se_aplica' || um.estado === 'em_teste_ab' || um.estado === 'antes_fora_da_janela_lida') throw new Error('estado')
    expect(um.antes.imp).toBe(1000)      // só D-2
    expect(um.depois.imp).toBe(1000)     // só D+1
    // min: janela de um instante só; D-1 volta a valer como antes
    const min = versao({ precisao: 'min', janela: { de: meio(D), ate: meio(D) } })
    const rMin = sc(min, ruido)
    if (rMin.estado === 'nao_se_aplica' || rMin.estado === 'em_teste_ab' || rMin.estado === 'antes_fora_da_janela_lida') throw new Error('estado')
    expect(rMin.antes.imp).toBe(2000)    // D-2 e D-1
    // lacuna: buraco de 3 dias D-3..D-1
    const lac = versao({ precisao: 'lacuna', janela: { de: meio(addDays(D, -3)), ate: meio(addDays(D, -1)) } })
    const d3 = [dia(addDays(D, -4), 1000, 50), dia(addDays(D, -2), 1000, 50), dia(D, 1000, 50)]
    const rLac = sc(lac, d3)
    if (rLac.estado === 'nao_se_aplica' || rLac.estado === 'em_teste_ab' || rLac.estado === 'antes_fora_da_janela_lida') throw new Error('estado')
    expect(rLac.antes.imp).toBe(1000)    // só D-4
    expect(rLac.depois.imp).toBe(1000)   // D (o dia depois do buraco)
    // instante às 04:00Z: ainda é o dia anterior no Pacífico; o dia tirado é D (do instante), não primeiroDia (D+1)
    const cedo = versao({ precisao: 'min', primeiroDia: addDays(D, 1), janela: { de: `${addDays(D, 1)}T04:00:00.000Z`, ate: `${addDays(D, 1)}T04:00:00.000Z` } })
    const rCedo = sc(cedo, [dia(addDays(D, -1), 1000, 50), dia(D, 1000, 50), dia(addDays(D, 1), 1000, 50)])
    if (rCedo.estado === 'nao_se_aplica' || rCedo.estado === 'em_teste_ab' || rCedo.estado === 'antes_fora_da_janela_lida') throw new Error('estado')
    expect(rCedo.antes.imp).toBe(1000)   // D-1
    expect(rCedo.depois.imp).toBe(1000)  // D+1 (com primeiroDia ele seria tirado)
  })

  it('4. o dia da publicação fica fora dos dois lados', () => {
    const r = sc(versao(), [...dias(-8, -2, 100), ...dias(1, 7, 100)], { publicadoEm: addDays(D, -4) })
    if (r.estado !== 'com_leitura') throw new Error(r.estado)
    expect(r.antes.diasMedidos).toBe(6)
    const r2 = sc(versao(), [...dias(-8, -2, 100), ...dias(1, 7, 100)], { publicadoEm: addDays(D, 3) })
    if (r2.estado !== 'com_leitura') throw new Error(r2.estado)
    expect(r2.depois.diasMedidos).toBe(6)
  })

  it('5. vizinhas: de outro campo corta e marca cortada; descrição não corta; retoque não corta (false) e corta (true); rotação do Lab corta', () => {
    const t = versao()
    const d = dias(-8, 7, 100)
    const viz = (extra: Partial<VersaoPropria>): VersaoPropria => versao({
      id: 'v-viz', campo: 'thumb', janela: { de: meio(addDays(D, 3)), ate: meio(addDays(D, 4)) }, ...extra,
    })
    const comViz = (v: VersaoPropria) => anteDepoisDaTroca({ troca: t, versoesDoVideo: [t, v], dias: d, publicadoEm: null })
    const r = comViz(viz({}))
    if (r.estado !== 'com_leitura') throw new Error(r.estado)
    expect(r.cortada).toBe(true)
    expect(r.depois.diasMedidos).toBe(2) // D+1 e D+2: para no dia anterior à vizinha
    const semCorte = (v: VersaoPropria) => { const x = comViz(v); return x.estado !== 'nao_se_aplica' && x.estado !== 'em_teste_ab' && x.estado !== 'antes_fora_da_janela_lida' ? x.cortada : null }
    expect(semCorte(viz({ campo: 'desc' }))).toBe(false)
    const retoque = viz({ thumb: { dhash: 'a', sha256: null, blobUrl: null, imagemExata: true, retoque: true } })
    expect(semCorte(retoque)).toBe(false)
    PROPRIO_RULES.retoqueContaComoTroca = true
    expect(semCorte(retoque)).toBe(true)
    PROPRIO_RULES.retoqueContaComoTroca = false
    expect(semCorte(viz({ origem: 'ab_lab', eventoAb: 'rotacao' }))).toBe(true)
    // linha de base e pré-registro não cortam
    expect(semCorte(viz({ origem: 'linha_de_base', janela: null, precisao: 'first' }))).toBe(false)
    expect(semCorte(viz({ preRegistro: true }))).toBe(false)
  })

  it('6. dia nao-medido não soma; zero-medido conta como medido com zero; dia ausente da lista idem a não medido', () => {
    const d = [dia(addDays(D, -2), 20, 1), dia(addDays(D, -3), null, null, 'nao-medido'), dia(addDays(D, 1), 0, 0, 'zero-medido'), dia(addDays(D, 2), 30, 1)]
    const r = sc(versao(), d)
    if (r.estado !== 'ainda_nao_da') throw new Error(r.estado)
    expect(r.antes.diasMedidos).toBe(1)   // D-3 não medido, D-4..D-8 ausentes
    expect(r.depois.diasMedidos).toBe(2)  // zero-medido + com impressões; D+3..D+7 ausentes
    expect(r.depois.imp).toBe(30)
  })

  it('7. nenhum dia medido depois: depois_nao_medido, nunca imp 0 como leitura', () => {
    const r = sc(versao(), dias(-8, -2, 100))
    expect(r.estado).toBe('depois_nao_medido')
  })

  it('8. nenhum dia medido antes: sem_antes; candidatos do antes todos anteriores ao primeiro dia lido: antes_fora_da_janela_lida', () => {
    expect(sc(versao(), [dia(addDays(D, -8), null, null, 'nao-medido'), ...dias(1, 7, 100)]).estado).toBe('sem_antes')
    expect(sc(versao(), dias(1, 7, 100)).estado).toBe('antes_fora_da_janela_lida')
  })

  it('9. faixas que se tocam: sem_diferenca_firme; separadas: subiu e caiu; hi igual a lo é tocar', () => {
    const base = [...dias(-8, -2, 5000, 0.05)]
    const sobe = sc(versao(), [...base, ...dias(1, 7, 5000, 0.2)])
    if (sobe.estado !== 'com_leitura') throw new Error(sobe.estado)
    expect(sobe.leitura).toBe('subiu')
    const cai = sc(versao(), [...dias(-8, -2, 5000, 0.2), ...dias(1, 7, 5000, 0.05)])
    if (cai.estado !== 'com_leitura') throw new Error(cai.estado)
    expect(cai.leitura).toBe('caiu')
    const igual = sc(versao(), [...base, ...dias(1, 7, 5000, 0.05)])
    if (igual.estado !== 'com_leitura') throw new Error(igual.estado)
    expect(igual.leitura).toBe('sem_diferenca_firme')
    // fronteira: hi do antes == lo do depois
    vi.mocked(wilson).mockReturnValueOnce({ lo: 0.1, hi: 0.2 }).mockReturnValueOnce({ lo: 0.2, hi: 0.3 })
    const toque = sc(versao(), [...base, ...dias(1, 7, 5000, 0.05)])
    if (toque.estado !== 'com_leitura') throw new Error(toque.estado)
    expect(toque.leitura).toBe('sem_diferenca_firme')
  })

  it('10. linha de base, pré-registro e descrição: nao_se_aplica; rotação: em_teste_ab', () => {
    const d = dias(-8, 7, 100)
    expect(sc(versao({ origem: 'linha_de_base', janela: null, precisao: 'first' }), d).estado).toBe('nao_se_aplica')
    expect(sc(versao({ preRegistro: true }), d).estado).toBe('nao_se_aplica')
    expect(sc(versao({ campo: 'desc' }), d).estado).toBe('nao_se_aplica')
    expect(sc(versao({ origem: 'ab_lab', eventoAb: 'rotacao' }), d).estado).toBe('em_teste_ab')
    expect(sc(versao({ thumb: { dhash: 'a', sha256: null, blobUrl: null, imagemExata: true, retoque: true }, campo: 'thumb' }), d).estado).toBe('nao_se_aplica')
  })

  it('11. janela de 7 dias: o oitavo dia não entra (fronteira 7 e 8)', () => {
    const r = sc(versao(), [...dias(-9, -2, 100), ...dias(1, 8, 100)])
    if (r.estado !== 'com_leitura') throw new Error(r.estado)
    expect(r.antes.diasMedidos).toBe(7)
    expect(r.depois.diasMedidos).toBe(7)
    expect(r.depois.diasCandidatos).toBe(7)
  })

  it('12. dia com impressões e cliques nulos: fora das duas somas, contado em diasSemClique', () => {
    const r = sc(versao(), [...dias(-8, -3, 100), dia(addDays(D, -2), 100, null), ...dias(1, 7, 100)])
    if (r.estado !== 'com_leitura') throw new Error(r.estado)
    expect(r.antes.diasSemClique).toBe(1)
    expect(r.antes.imp).toBe(600)
  })

  it('14. (portão 14/10, Phil I-1) depois com impressões e sem nenhum clique: depois_nao_medido, nunca "0 impressões"', () => {
    const semClique = Array.from({ length: 7 }, (_, i) => dia(addDays(D, i + 1), 500, null))
    const r = sc(versao(), [...dias(-8, -2, 500), ...semClique])
    expect(r.estado).toBe('depois_nao_medido')
    if (r.estado !== 'depois_nao_medido') return
    expect(r.depois.diasSemClique).toBe(7)
    expect(r.depois.diasMedidos).toBe(0)
    expect(r.depois.imp).toBe(0)
  })

  it('15. (portão 14/10, Yannis M4a) vizinha com a mesma janela final não corta nem marca', () => {
    const t = versao()
    const viz = versao({ id: 'v-viz', campo: 'thumb', thumb: { dhash: 'a', sha256: 's', blobUrl: null, imagemExata: true, retoque: false } })
    const r = anteDepoisDaTroca({ troca: t, versoesDoVideo: [t, viz], dias: [...dias(-8, -2, 100), ...dias(1, 7, 100)], publicadoEm: null })
    if (r.estado !== 'com_leitura') throw new Error(r.estado)
    expect(r.cortada).toBe(false)
    expect(r.depois.diasCandidatos).toBe(7)
  })

  it('16. (portão 14/10, Yannis M4b) nenhum dia lido: antes_fora_da_janela_lida', () => {
    expect(sc(versao(), []).estado).toBe('antes_fora_da_janela_lida')
  })

  it('17. (portão L5, decisão 10 opção B) um lado com >=100 impressões leva taxa e faixa em sem_antes e depois_nao_medido; o veredito continua exigindo os dois lados', () => {
    const semAntes = sc(versao(), [dia(addDays(D, -8), null, null, 'nao-medido'), ...dias(1, 7, 100)])
    if (semAntes.estado !== 'sem_antes') throw new Error(semAntes.estado)
    expect(semAntes.antes.taxa).toBeNull()
    expect(semAntes.depois.taxa).not.toBeNull(); expect(semAntes.depois.lo).not.toBeNull(); expect(semAntes.depois.hi).not.toBeNull()
    expect('leitura' in semAntes).toBe(false)
    const semDepois = sc(versao(), dias(-8, -2, 100))
    if (semDepois.estado !== 'depois_nao_medido') throw new Error(semDepois.estado)
    expect(semDepois.antes.taxa).not.toBeNull(); expect(semDepois.depois.taxa).toBeNull()
    expect('leitura' in semDepois).toBe(false)
  })

  it('18. (portão L5, Phil I-1) antes_fora_da_janela_lida devolve o depois medido, cortado pela troca vizinha, sem contar os dias da outra troca', () => {
    // troca 1 em D, troca 2 em D+3 (1d cada): o depois da troca 1 é só D+1 (o dia D+2 e D+3 são da vizinha)
    const t1 = versao()
    const t2 = versao({ id: 'v-2', janela: { de: meio(addDays(D, 2)), ate: meio(addDays(D, 3)) }, primeiroDia: addDays(D, 3), ultimoDia: addDays(D, 3), vistaDesde: meio(addDays(D, 3)), vistaAte: meio(addDays(D, 3)) })
    const r = anteDepoisDaTroca({ troca: t1, versoesDoVideo: [t1, t2], dias: dias(1, 12, 1000), publicadoEm: null })
    if (r.estado !== 'antes_fora_da_janela_lida') throw new Error(r.estado)
    expect(r.cortada).toBe(true)
    expect(r.depois.diasCandidatos).toBe(1)
    expect(r.depois.diasMedidos).toBe(1)
    expect(r.depois.imp).toBe(1000)
    expect(r.depois.taxa).not.toBeNull()
    // sem vizinha: os 7 dias nominais
    const so = sc(versao(), dias(1, 12, 1000))
    if (so.estado !== 'antes_fora_da_janela_lida') throw new Error(so.estado)
    expect(so.depois.diasCandidatos).toBe(7); expect(so.depois.imp).toBe(7000); expect(so.cortada).toBe(false)
    // depois com menos de 100 impressões: lado sem taxa
    const pouco = sc(versao(), dias(1, 1, 40))
    if (pouco.estado !== 'antes_fora_da_janela_lida') throw new Error(pouco.estado)
    expect(pouco.depois.taxa).toBeNull()
  })

  it('13. varredura do arquivo-fonte: nenhuma ocorrência de efeito, causou ou por causa', () => {
    const src = readFileSync(new URL('../../../src/lib/youtube/observatorio/proprio-versoes/antes-depois.ts', import.meta.url), 'utf8').toLowerCase()
    expect(src).not.toMatch(/efeito|causou|por causa/)
  })
})
