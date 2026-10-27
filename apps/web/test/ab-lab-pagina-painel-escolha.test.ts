// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  fraseDoPainel, montarPainelEscolha, selosValidos, textoDoSelo, visaoDaSelecao,
  type EntradaPainelEscolha, type FaseFrase, type OpcaoEscolha,
} from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { NoArLido } from '@/lib/youtube/ab-no-ar'

const ID = { A: 'va', B: 'vb', C: 'vc' } as const
const CTR = {
  norm: { A: 0.039, B: 0.052, C: 0.044 },
  inc: { A: 0.041, B: 0.043, C: null },
} as const

interface Cenario {
  ar: 'A' | 'B' | 'C'; sug: 'A' | 'B' | 'C' | null; since?: string | null; ctr: 'norm' | 'inc'; escolha?: 'A' | 'B' | 'C'
}
const dia = (d: string | undefined): string | null => (d ? `2026-10-${d}T15:00:00.000Z` : null)

function entrada(c: Cenario, extra: Partial<EntradaPainelEscolha> = {}): EntradaPainelEscolha {
  const noAr: NoArLido = { tipo: 'confirmado', varianteId: ID[c.ar], letra: c.ar, desde: dia(c.since === undefined ? '26' : c.since ?? undefined) }
  return {
    testId: 't1', nomeVideo: 'Bangkok', tipo: 'title', restoreSeq: 3, podeAdministrar: true,
    variantes: (['A', 'B', 'C'] as const).map(l => ({ id: ID[l], letra: l, original: l === 'A', titulo: `Título ${l}`, miniatura: null, ctr: CTR[c.ctr][l] })),
    sugeridaId: c.sug ? ID[c.sug] : null, noAr,
    escolha: c.escolha ? { varianteId: ID[c.escolha], em: dia('27') } : null,
    originalGuardada: { titulo: true, miniatura: true }, ...extra,
  }
}
const selosDe = (o: OpcaoEscolha[]): Record<string, string[]> => Object.fromEntries(o.map(x => [x.letra, x.selos]))

interface Linha {
  nome: string; c: Cenario; sel?: 'A' | 'B' | 'C' | null; fase?: FaseFrase
  frase: string; selos: Record<string, string[]>; meio: string; acao: string
}
// Os 17 estados do objeto E do mockup (as 7 fases de tela entram com `fase`).
const TABELA: Linha[] = [
  { nome: 'a', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'B', frase: 'A versão B está no ar desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'ok', acao: 'fechar' },
  { nome: 'b', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', frase: 'A versão B está no ar desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'c', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', fase: 'escrevendo', frase: 'Conferindo o que está no ar. Última leitura: B desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'd', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', frase: 'A versão B está no ar desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'e', c: { ar: 'C', sug: 'B', since: '27', ctr: 'norm', escolha: 'C' }, sel: 'C', frase: 'Você deixou a versão C no ar desde 27/10. O teste sugeria a B.',
    selos: { A: [], B: ['sugerida'], C: ['no_ar', 'escolhida'] }, meio: 'ok', acao: 'fechar' },
  { nome: 'f', c: { ar: 'A', sug: null, since: null, ctr: 'inc' }, sel: null, frase: 'O teste não mostrou diferença clara. O vídeo está com a original (A). Escolha qual fica.',
    selos: { A: ['no_ar'], B: [], C: [] }, meio: 'nada', acao: 'Deixar no ar' },
  { nome: 'f2', c: { ar: 'A', sug: null, since: null, ctr: 'inc', escolha: 'A' }, sel: 'A', fase: 'guardado', frase: 'Você manteve a original (A). O teste não mostrou diferença clara.',
    selos: { A: ['no_ar', 'mantida'], B: [], C: [] }, meio: 'info', acao: 'fechar' },
  { nome: 'g2', c: { ar: 'A', sug: 'B', since: null, ctr: 'norm', escolha: 'A' }, sel: 'A', fase: 'guardado', frase: 'Você manteve a original (A). O teste sugeria a B.',
    selos: { A: ['no_ar', 'mantida'], B: ['sugerida'], C: [] }, meio: 'info', acao: 'fechar' },
  { nome: 'i', c: { ar: 'A', sug: 'B', since: null, ctr: 'norm' }, sel: 'B', frase: 'O teste sugeriu a versão B. O vídeo está com a original (A).',
    selos: { A: ['no_ar'], B: ['sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar B no ar' },
  { nome: 'i (marca A)', c: { ar: 'A', sug: 'B', since: null, ctr: 'norm' }, sel: 'A', frase: 'O teste sugeriu a versão B. O vídeo está com a original (A).',
    selos: { A: ['no_ar'], B: ['sugerida'], C: [] }, meio: 'info', acao: 'Manter a original (A)' },
  { nome: 'd2', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', fase: 'conferindo', frase: 'Conferindo o que está no ar. Última leitura: B desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'd3a', c: { ar: 'C', sug: 'B', since: '27', ctr: 'norm', escolha: 'C' }, sel: 'C', frase: 'Você deixou a versão C no ar desde 27/10. O teste sugeria a B.',
    selos: { A: [], B: ['sugerida'], C: ['no_ar', 'escolhida'] }, meio: 'ok', acao: 'fechar' },
  { nome: 'd3b', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', frase: 'A versão B está no ar desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'd3c', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', fase: 'sem_rede', frase: 'Não deu para conferir o que está no ar. Última leitura: B desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
  { nome: 'k', c: { ar: 'A', sug: 'B', since: null, ctr: 'norm', escolha: 'A' }, sel: 'A', frase: 'Você manteve a original (A). O teste sugeria a B.',
    selos: { A: ['no_ar', 'mantida'], B: ['sugerida'], C: [] }, meio: 'info', acao: 'fechar' },
  { nome: 'k2', c: { ar: 'A', sug: null, since: null, ctr: 'inc', escolha: 'A' }, sel: 'A', frase: 'Você manteve a original (A). O teste não mostrou diferença clara.',
    selos: { A: ['no_ar', 'mantida'], B: [], C: [] }, meio: 'info', acao: 'fechar' },
  { nome: 'j', c: { ar: 'B', sug: 'B', ctr: 'norm' }, sel: 'C', frase: 'A versão B está no ar desde 26/10.',
    selos: { A: [], B: ['no_ar', 'sugerida'], C: [] }, meio: 'sai_entra', acao: 'Deixar C no ar' },
]

describe('M7b T8: modelo do painel de escolha', () => {
  it.each(TABELA)('estado $nome', (l) => {
    const p = montarPainelEscolha(entrada(l.c))
    const sel = l.sel ? ID[l.sel] : p.padrao
    const v = visaoDaSelecao(p, sel)
    expect(fraseDoPainel(p, l.fase ?? 'normal')).toBe(l.frase)
    expect(selosDe(p.opcoes)).toEqual(l.selos)
    expect(v.meio.tipo).toBe(l.meio)
    expect(v.acao.tipo === 'fechar' ? 'fechar' : v.acao.rotulo).toBe(l.acao)
    for (const o of p.opcoes) expect(selosValidos(o)).toBe(true)
  })

  it('"Sugerida" nunca aparece junto de "Escolhida" nem de "Mantida"', () => {
    for (const ar of ['A', 'B', 'C'] as const) for (const sug of ['A', 'B', 'C', null] as const) for (const escolha of ['A', 'B', 'C'] as const) {
      const p = montarPainelEscolha(entrada({ ar, sug, ctr: 'norm', escolha }))
      for (const o of p.opcoes) {
        expect(o.selos.length).toBeLessThanOrEqual(2)
        expect(o.selos.includes('sugerida') && (o.selos.includes('escolhida') || o.selos.includes('mantida'))).toBe(false)
      }
    }
  })

  it('um mutante com 3 selos é recusado', () => {
    expect(selosValidos({ selos: ['no_ar', 'sugerida', 'escolhida'] })).toBe(false)
    expect(selosValidos({ selos: ['sugerida', 'escolhida'] })).toBe(false)
    expect(selosValidos({ selos: ['no_ar', 'escolhida'] })).toBe(true)
  })

  it('linha neutra: sugeria + CTR menor, e CTR não medido', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }))
    const v = visaoDaSelecao(p, ID.C)
    expect(v.meio.tipo === 'sai_entra' && v.meio.linhaNeutra).toBe('O teste sugeria a B. Esta versão teve CTR menor (4,4% contra 5,2%).')
    const q = montarPainelEscolha(entrada({ ar: 'A', sug: null, since: null, ctr: 'inc' }))
    const w = visaoDaSelecao(q, ID.C)
    expect(w.meio.tipo === 'sai_entra' && w.meio.linhaNeutra).toBe('CTR não medido para esta versão.')
  })

  it('A4: sugerida = original', () => {
    const noOriginal = montarPainelEscolha(entrada({ ar: 'A', sug: 'A', since: null, ctr: 'norm' }))
    expect(fraseDoPainel(noOriginal)).toBe('O teste sugeriu manter a original (A). O vídeo já está com ela.')
    expect(selosDe(noOriginal.opcoes).A).toEqual(['no_ar', 'sugerida'])
    const v = visaoDaSelecao(noOriginal, ID.A)
    expect(v.acao).toEqual({ tipo: 'manter_original', rotulo: 'Manter a original (A)' })
    const outra = montarPainelEscolha(entrada({ ar: 'C', sug: 'A', ctr: 'norm' }))
    expect(fraseDoPainel(outra)).toBe('O teste sugeriu manter a original (A). O vídeo está com a versão C.')
    const w = visaoDaSelecao(outra, ID.A)
    expect(w.acao).toMatchObject({ rotulo: 'Deixar A no ar' })
    expect(w.meio.tipo === 'sai_entra' && w.meio.linhaNeutra).toBe('Esta versão teve CTR menor (3,9% contra 4,4%).') // a 1ª frase some (é a própria marcada)
  })

  it('A3: inconclusivo com C no ar', () => {
    const p = montarPainelEscolha(entrada({ ar: 'C', sug: null, ctr: 'inc', escolha: 'C' }))
    expect(fraseDoPainel(p)).toBe('O teste não mostrou diferença clara. O vídeo está com a versão C.')
    expect(selosDe(p.opcoes).C).toEqual(['no_ar', 'escolhida'])
    expect(visaoDaSelecao(p, ID.C).acao.tipo).toBe('fechar')
  })

  it('A1: misto (título numa versão, miniatura em outra)', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { tipo: 'combo', noAr: { tipo: 'misto', porCampo: { title: 'B', thumbnail: 'C' } } }))
    expect(fraseDoPainel(p)).toBe('O título está na B e a miniatura na C. O vídeo está misturado.')
    expect(selosDe(p.opcoes)).toEqual({ A: [], B: ['titulo_no_ar', 'sugerida'], C: ['miniatura_no_ar'] })
    const v = visaoDaSelecao(p, ID.C)
    expect(v.meio.tipo === 'sai_entra' && v.meio.sai).toEqual({ tipo: 'texto', texto: 'No ar agora: título B, miniatura C.' })
    expect(textoDoSelo(p, p.opcoes[1]!, 'titulo_no_ar')).toBe('Título no ar')
  })

  it('A2: nada confirmado ao abrir', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { noAr: { tipo: 'desconhecido', ultima: { letra: 'B', desde: dia('26') } } }))
    expect(fraseDoPainel(p)).toBe('Não sabemos qual versão está no ar. Confira antes de trocar.')
    expect(p.opcoes.some(o => o.selos.includes('no_ar'))).toBe(false)
    const b = p.opcoes.find(o => o.letra === 'B')!
    expect(textoDoSelo(p, b, 'no_ar_ultima')).toBe('Última leitura: B em 26/10')
    expect(p.padrao).toBe(ID.B)
    const v = visaoDaSelecao(p, ID.C)
    expect(v.meio.tipo === 'sai_entra' && v.meio.sai).toEqual({ tipo: 'texto', texto: 'Não confirmado' })
    expect(v.meio.tipo === 'sai_entra' && v.meio.linhaNeutra).toContain('A troca vai sobrescrever o título e a miniatura atuais.')
    const sem = montarPainelEscolha(entrada({ ar: 'B', sug: null, ctr: 'inc' }, { noAr: { tipo: 'desconhecido', ultima: null } }))
    expect(sem.opcoes.every(o => o.selos.length === 0)).toBe(true)
  })

  it('D1: escolha cuja versão foi apagada', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { escolha: { varianteId: null, em: dia('27') } }))
    expect(fraseDoPainel(p)).toBe('Sua escolha foi registrada em 27/10, mas essa versão não existe mais.')
    expect(p.opcoes.some(o => o.selos.includes('escolhida'))).toBe(false)
    expect(p.decidido).toBe(false)
  })

  it('bloqueio sem_original por tipo: A sem original_title, sem cópia no Blob, e quando não há exatamente uma original', () => {
    const titulo = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { originalGuardada: { titulo: false, miniatura: true } }))
    expect(titulo.opcoes[0]).toMatchObject({ letra: 'A', bloqueio: 'sem_original', textoBloqueio: 'O título original não foi guardado; não dá para voltar a ele daqui.' })
    expect(titulo.opcoes[1]!.bloqueio).toBeNull()
    const miniatura = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { tipo: 'thumbnail', originalGuardada: { titulo: false, miniatura: false } }))
    expect(miniatura.opcoes[0]!.textoBloqueio).toBe('A miniatura original não foi guardada; não dá para voltar a ela daqui.')
    const tituloOkMiniaturaNao = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { tipo: 'title', originalGuardada: { titulo: true, miniatura: false } }))
    expect(tituloOkMiniaturaNao.opcoes[0]!.bloqueio).toBeNull() // teste de título não precisa da miniatura
    const combo = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { tipo: 'combo', originalGuardada: { titulo: false, miniatura: false } }))
    expect(combo.opcoes[0]!.textoBloqueio).toContain('O título e a miniatura originais não foram guardados')
    const base = entrada({ ar: 'B', sug: 'B', ctr: 'norm' })
    const duas = montarPainelEscolha({ ...base, variantes: base.variantes.map(v => ({ ...v, original: v.letra !== 'C' })) })
    expect(duas.opcoes.every(o => o.bloqueio === 'sem_original')).toBe(true)
  })

  it('sugerida que não é variante: sem selo "Sugerida" e sem a 1ª frase da linha neutra', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: null, ctr: 'norm' }, { sugeridaId: 'fantasma' }))
    expect(p.sugeridaId).toBeNull()
    expect(p.opcoes.some(o => o.selos.includes('sugerida'))).toBe(false)
    const v = visaoDaSelecao(p, ID.C)
    expect(v.meio.tipo === 'sai_entra' && v.meio.linhaNeutra).not.toContain('O teste sugeria')
  })

  it('sem permissão: todas as opções travadas e só Fechar', () => {
    const p = montarPainelEscolha(entrada({ ar: 'B', sug: 'B', ctr: 'norm' }, { podeAdministrar: false }))
    expect(p.opcoes.every(o => o.bloqueio === 'sem_permissao')).toBe(true)
    expect(visaoDaSelecao(p, ID.C).acao.tipo).toBe('fechar')
  })

  it('sem mutação da entrada e padrão nulo quando a pré-marcada está bloqueada', () => {
    const e = entrada({ ar: 'A', sug: 'A', since: null, ctr: 'norm' }, { originalGuardada: { titulo: false, miniatura: true } })
    const copia = JSON.stringify(e)
    const p = montarPainelEscolha(e)
    expect(JSON.stringify(e)).toBe(copia)
    expect(p.padrao).toBeNull()
  })
})
