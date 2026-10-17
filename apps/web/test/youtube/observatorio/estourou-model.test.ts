// @vitest-environment node
// apps/web/test/youtube/observatorio/estourou-model.test.ts
// A5 · E5a, Tarefa 10a: a leitura "Estourou e parou" (M10) como a tela a escreve. Puro; o relógio entra por parâmetro.
import { describe, expect, it } from 'vitest'
import { leituraDoVideo, type Leitura } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-model'
import { picoSemCauda, type EntradaPico } from '@/lib/youtube/observatorio/medidas/pico'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { estourouExisteEm, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'

const HOJE = somaDias(estourouExisteEm(), 30)
const JANELA = { de: null, ate: null, dias: null }
const v30 = (views: number): Medida<ValorM1> => medido({ views, gapHoras: 0, fonte: 'marca' as const }, 1, JANELA)
const VIDEO = { idadeDias: 120, canal: 'Leo' }

/** Cumpre as três condições no limite: V30 2×, cauda e reação em metade, ainda rende 2%. */
const entrada = (over: Partial<EntradaPico> = {}, canal: Partial<EntradaPico['canal']> = {}): EntradaPico => ({
  wasLive: false, idadeDias: 120, v30: 2000, cauda: 0.2, aindaRende: 0.02, reacao: { taxa: 0.01, componente: 'os_dois' },
  canal: { nElegiveis: 5, medianaV30: 1000, medianaCauda: 0.4, medianaReacao: 0.02, ...canal }, ...over,
})
const ler = (e: EntradaPico, m1: Medida<ValorM1> | null = v30(e.v30 ?? 0), video = VIDEO): Leitura => leituraDoVideo(picoSemCauda(e), m1, HOJE, video)
const nm = (l: Leitura) => { if (l.tipo !== 'nao_medido') throw new Error('esperava nao_medido, veio ' + l.tipo); return l }

describe('leitura Estourou e parou: dado ausente', () => {
  it('antes da data: "ainda não existe", três casas pontilhadas, sem cartões e sem o texto obrigatório', () => {
    const l = leituraDoVideo(null, null, somaDias(estourouExisteEm(), -1), VIDEO)
    expect(l).toMatchObject({ tipo: 'ainda_nao_existe', casas: 'ppp', existeEm: estourouExisteEm() })
    expect(JSON.stringify(l)).not.toMatch(/cartoes|Indício/)
  })
  it('D1: com a data de publicação, "este vídeo faz 90 dias em" é publicação + 90, a mesma do "fecha em" do ponto de 90 d', () => {
    const hoje = somaDias(estourouExisteEm(), -1)
    const publicado = somaDias(hoje, -40)
    const l = leituraDoVideo(null, null, hoje, { ...VIDEO, idadeDias: 39, publicadoSP: publicado })
    expect(l).toMatchObject({ tipo: 'ainda_nao_existe', esteVideoEm: somaDias(publicado, MEASURE_RULES.tail.minAgeDays) })
  })
  it('antes da data vale mesmo que a medida diga outra coisa: nunca promete nem nega', () => {
    expect(leituraDoVideo(picoSemCauda(entrada()), v30(2000), somaDias(estourouExisteEm(), -1), VIDEO).tipo).toBe('ainda_nao_existe')
  })
  it('no dia da data a leitura já existe', () => {
    expect(leituraDoVideo(picoSemCauda(entrada()), v30(2000), estourouExisteEm(), VIDEO).tipo).toBe('estourou_e_parou')
  })
  it('medida que não veio, depois da data: não carregou, nunca "não é o caso"', () => {
    expect(leituraDoVideo(null, null, HOJE, VIDEO)).toEqual({ tipo: 'nao_carregou' })
  })
  it('série não pedida, leitura que falhou e cálculo que falhou: não carregou', () => {
    for (const m of ['serie_nao_pedida', 'leitura_falhou', 'calculo_falhou'] as const) {
      expect(leituraDoVideo(naoMedido(m), null, HOJE, VIDEO).tipo, m).toBe('nao_carregou')
    }
  })
  it('cada motivo de não medido diz "Passa a existir" com data, condição ou "nunca para este vídeo"', () => {
    const casos: Array<[string, Leitura]> = [
      ['ao vivo', leituraDoVideo(naoMedido('ao_vivo_ou_estreia'), null, HOJE, VIDEO)],
      ['sem v30', ler(entrada({ v30: null }), naoMedido('leitura_comecou_depois'))],
      ['poucas views', ler(entrada({ v30: 640 }))],
      ['canal pequeno', ler(entrada({}, { nElegiveis: 3 }))],
      ['menos de 90', ler(entrada({ idadeDias: 61 }), v30(2000), { idadeDias: 61, canal: 'Leo' })],
      ['sem reação', ler(entrada({ reacao: null }))],
    ]
    for (const [nome, l] of casos) {
      const p = nm(l).passaAExistir
      expect(['data', 'condicao', 'nunca'], nome).toContain(p.tipo)
    }
  })
  it('motivo fora da lista não promete data (coleta pausada, sem publicação)', () => {
    for (const m of ['coleta_pausada', 'sem_publicacao'] as const) {
      const l = nm(leituraDoVideo(naoMedido(m), null, HOJE, VIDEO))
      expect(l.passaAExistir, m).toEqual({ tipo: 'sem_promessa' })
    }
  })
})

describe('um motivo só, na ordem (regra de ordem da marca de 30 dias)', () => {
  const cedo = naoMedido('idade_menor_que_90')
  const novo = { idadeDias: 61, canal: 'Leo' }
  it('menos de 90 dias e sem a medida de 30 dias: "nunca para este vídeo", nunca uma data', () => {
    for (const m of ['leitura_comecou_depois', 'descoberto_tarde', 'leitura_parou_antes', 'leituras_distantes', 'views_ocultas', 'sem_leitura'] as const) {
      const l = nm(leituraDoVideo(cedo, naoMedido(m), HOJE, novo))
      expect(l.motivo, m).toBe('sem_v30')
      expect(l.passaAExistir.tipo, m).toBe('nunca')
    }
  })
  it('menos de 90 dias e 640 views aos 30 dias: "nunca para este vídeo" (menos de 1.000)', () => {
    const l = nm(leituraDoVideo(cedo, v30(640), HOJE, novo))
    expect(l.motivo).toBe('poucas_views')
    expect(l.passaAExistir.tipo).toBe('nunca')
    expect(l.falta).toMatchObject({ tipo: 'barra', feitos: 640, total: MEASURE_RULES.peak.minV30, legenda: '640 de 1.000' })
  })
  it('1.000 exatamente aos 30 dias não é "poucas views": segue para a data', () => {
    expect(nm(leituraDoVideo(cedo, v30(MEASURE_RULES.peak.minV30), HOJE, novo)).motivo).toBe('menos_de_90_dias')
  })
  it('menos de 90 dias e a medida de 30 dias ainda por fechar: diz a data', () => {
    for (const m of [naoMedido('fecha_em'), naoMedido('aguardando_calculo'), v30(2500)]) {
      const l = nm(leituraDoVideo(cedo, m, HOJE, novo))
      expect(l.motivo).toBe('menos_de_90_dias')
      expect(l.passaAExistir).toEqual({ tipo: 'data', data: somaDias(HOJE, 29), faltam: 29 })
      expect(l.falta).toMatchObject({ tipo: 'barra', feitos: 61, total: 90, unidade: 'dias' })
    }
  })
  it('leitura_falhou e calculo_falhou na medida de 30 dias: não carregou, nunca "menos de 90 dias"', () => {
    for (const m of ['leitura_falhou', 'calculo_falhou'] as const) expect(leituraDoVideo(cedo, naoMedido(m), HOJE, novo).tipo, m).toBe('nao_carregou')
  })
  it('motivo de 30 dias fora da lista (coleta pausada) não promete data', () => {
    const l = nm(leituraDoVideo(cedo, naoMedido('coleta_pausada'), HOJE, novo))
    expect(l.motivo).toBe('sem_v30')
    expect(l.passaAExistir).toEqual({ tipo: 'sem_promessa' })
  })
  it('sem a informação de 30 dias (nula) também não promete data', () => {
    expect(nm(leituraDoVideo(cedo, null, HOJE, novo)).passaAExistir).toEqual({ tipo: 'sem_promessa' })
  })
  it('a frase "publicados antes de 03/10/2026" só vale para a leitura que começou depois', () => {
    expect(nm(leituraDoVideo(cedo, naoMedido('leitura_comecou_depois'), HOJE, novo)).explica).toContain('03/10/2026')
    expect(nm(leituraDoVideo(cedo, naoMedido('views_ocultas'), HOJE, novo)).explica).toBeNull()
  })
  it('canal com menos de 5: cinco bolas, "3 de 5, faltam 2" e a condição', () => {
    const l = nm(ler(entrada({}, { nElegiveis: 3 })))
    expect(l.motivo).toBe('poucos_videos')
    expect(l.falta).toEqual({ tipo: 'bolas', feitos: 3, total: 5, legenda: '3 de 5, faltam 2' })
    expect(l.explica).toContain('Leo tem 3 vídeos longos')
  })
  it('sem reação pública sem a parte medida: três casas em hachura, nunca ✓ ✓ ✕ e nunca casa calculada na tela', () => {
    const l = nm(ler(entrada({ reacao: null })))
    expect(l.motivo).toBe('sem_reacao_publica')
    expect(l.casas).toBe('mmm')
    expect(l.casas).not.toMatch(/n/)
  })
})

describe('fronteira: a conta é a da E4, a tela só a mostra', () => {
  it('três condições: "estourou e parou", casas ✓ ✓ ✓ e a frase dos 3 sinais', () => {
    const l = ler(entrada())
    expect(l).toMatchObject({ tipo: 'estourou_e_parou', casas: 'vvv', frase: 'Os 3 sinais batem: muitas views cedo, quase nada depois e pouca reação do público.' })
  })
  it('igual ao limite bate, e o cartão avisa "igual"', () => {
    const l = ler(entrada())
    if (l.tipo !== 'estourou_e_parou') throw new Error(l.tipo)
    expect(l.cartoes.viewsCedo.igual).toBe(true)
    expect(l.cartoes.quaseNada.igualCauda).toBe(true)
    expect(l.cartoes.quaseNada.igualRende).toBe(true)
    expect(l.cartoes.reacao.igual).toBe(true)
  })
  it('duas de três: "não é o caso", os três números e a frase que diz qual sinal falhou e por quanto', () => {
    const l = ler(entrada({ reacao: { taxa: 0.016 * 1.25, componente: 'os_dois' } }, { medianaReacao: 0.02 }))
    if (l.tipo !== 'nao_e_o_caso') throw new Error(l.tipo)
    expect(l.casas).toBe('vvn')
    expect(l.frase).toBe('Só 2 dos 3 sinais batem, então não é o caso: a reação do público (2% das views) ficou acima do limite de 1%.')
    expect(l.cartoes.viewsCedo.valor).toBe(2000)
  })
  it('"ainda rende" acima do limite com a cauda boa: a frase fala do que ainda rende', () => {
    const l = ler(entrada({ aindaRende: 0.031 }))
    if (l.tipo !== 'nao_e_o_caso') throw new Error(l.tipo)
    expect(l.casas).toBe('vnv')
    expect(l.frase).toContain('o vídeo ainda rende 3,1% nos últimos 28 dias, acima do limite de 2%')
  })
  it('views cedo abaixo de 2× o normal e cauda alta: a frase usa a cauda', () => {
    const l = ler(entrada({ v30: 1990 }))
    if (l.tipo !== 'nao_e_o_caso') throw new Error(l.tipo)
    expect(l.casas).toBe('nvv')
    expect(l.frase).toContain('as views dos 30 primeiros dias não chegaram a 2× o normal')
  })
  it('nenhum percentual de chance, nota ou a palavra "veredito" em nenhuma frase', () => {
    const todas = [ler(entrada()), ler(entrada({ v30: 1990 })), ler(entrada({ v30: 640 })), ler(entrada({ reacao: null })), leituraDoVideo(null, null, HOJE, VIDEO)]
    for (const l of todas) expect(JSON.stringify(l).toLowerCase()).not.toMatch(/veredito|chance|nota /)
  })
  it('zero medido na cauda: a leitura traz o 0 como número (a tela o desenha em caixa vazada)', () => {
    const l = ler(entrada({ cauda: 0, aindaRende: 0 }))
    if (l.tipo !== 'estourou_e_parou') throw new Error(l.tipo)
    expect(l.cartoes.quaseNada.cauda).toBe(0)
    expect(l.cartoes.quaseNada.ganho).toBe(0)
  })
  it('o limite de views e o de poucas views saem das constantes da E4, nenhum 1.000 escrito na tela', () => {
    const l = nm(ler(entrada({ v30: 640 })))
    expect(l.curta).toContain('1.000')
    expect(l.passaAExistir).toMatchObject({ tipo: 'nunca' })
  })
})

describe('motivos com frase própria e "sem previsão" (G-2 do Gio)', () => {
  it.each([
    ['serie_diaria_incompleta', 'serie_incompleta', 'Faltam leituras diárias das últimas 4 semanas deste vídeo.'],
    ['base_zero', 'base_zero', 'O vídeo não tinha views no começo do período comparado.'],
    ['contagem_recuou', 'contagem_recuou', 'O total de views do vídeo diminuiu durante o período lido; assim a conta não fecha.'],
  ] as const)('%s: título específico, "sem previsão" e nunca "não foi calculada"', (m, motivo, titulo) => {
    const l = nm(leituraDoVideo(naoMedido(m), null, HOJE, VIDEO))
    expect(l.motivo).toBe(motivo)
    expect(l.titulo).toBe(titulo)
    expect(l.passaAExistir).toEqual({ tipo: 'condicao', texto: 'sem previsão' })
    expect(JSON.stringify(l)).not.toContain('não foi calculada')
  })
})
