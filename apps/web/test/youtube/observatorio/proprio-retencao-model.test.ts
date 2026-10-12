// @vitest-environment node
// A4 Tarefa 13.3, aba Retenção = "% assistido" (mockup 5, aprovado em 12/10): normal por faixa de duração, a frase de relance, a tabela por vídeo e a legenda.
// Decisões do dono: % assistido em 28 dias (média pesada pelas views); "na média" = até 2 pontos (arredonda antes de decidir); faixa normal a partir de 5 vídeos;
// poucas views = menos de 10; ACIMA de 100% é dado válido (número real, sem recorte). "Não medido" nunca vira zero.
import { afterEach, describe, it, expect } from 'vitest'
import { proprioWorld, type CenarioDados } from './proprio-fixture'
import { comDiario, diarioComPct, duracoesDosLongos, type PlanoDoVideo } from './proprio-assistido-fixture'
import { buildRetencao, METODO_ASSISTIDO, type RetencaoView } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-model'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))
// 6 curtos (até 5 min), 5 médios (5 a 15 min), 3 longos (acima de 15 min)
const DUR = [200, 200, 200, 200, 200, 200, 600, 600, 600, 600, 600, 1000, 1000, 1000]
type World = ReturnType<typeof proprioWorld>
const MUNDO = proprioWorld({ mut: duracoesDosLongos(DUR) })
const plano = (pcts: Array<number | null>, vpd: number[], dias = 10): PlanoDoVideo[] => pcts.map((pct, i) => ({ dias, views: vpd[i] ?? 0, pct }))
// views por dia e % de cada vídeo (ver a conta no comentário de cada teste)
const PCT = [40, 42, 44, 46, 48, 50, 30, 32, 34, 36, 60, 50, 55, 60]
const VPD = [9, 8, 7, 6, 5, 4, 12, 3, 2, 1, 20, 6, 5, 4]
const com = (w: World, p: PlanoDoVideo[], cenario?: CenarioDados) => ({ ...w, dados: cenario ? proprioWorld({ cenario, mut: duracoesDosLongos(DUR) }).dados : comDiario(w.dados, diarioComPct(w.canalId, w.ytIds, w.hoje, p)) })
const monta = (w: World): RetencaoView => buildRetencao(w.obs, w.canalId, w.dados, { dm: w.dm, hoje: w.hoje })
const cheio = () => monta(com(MUNDO, plano(PCT, VPD)))

describe('13.3 retenção: normal por faixa de duração', () => {
  it('as três faixas, na ordem, com o normal (mediana) só a partir de 5 vídeos com views', () => {
    const r = cheio()
    expect(r.faixas.map(f => f.rotulo)).toEqual(['Até 5 min', '5 a 15 min', 'Acima de 15 min'])
    expect(r.faixas.map(f => f.videos)).toEqual([6, 5, 3])
    // mediana de 40,42,44,46,48,50 = 45; de 30,32,34,36,60 = 34; três vídeos: sem normal
    expect(r.faixas[0]).toMatchObject({ normal: '45%', estado: 'normal' })
    expect(r.faixas[1]).toMatchObject({ normal: '34%', estado: 'normal' })
    expect(r.faixas[2]).toMatchObject({ normal: null, estado: 'poucos', texto: 'poucos vídeos para comparar (3; precisa de 5)' })
  })
  it('faixa sem vídeo, e faixa cujos vídeos não tiveram views: duas frases diferentes (a segunda é não medido)', () => {
    const w = proprioWorld({ mut: duracoesDosLongos(DUR.map(() => 200)) })
    const r = monta(com(w, plano(PCT.map(() => 50), VPD)))
    expect(r.faixas[1]).toMatchObject({ videos: 0, estado: 'nenhum', texto: 'nenhum vídeo nesta faixa', normal: null })
    const semViews = monta(com(MUNDO, plano(PCT, VPD.map((v, i) => (i >= 11 ? 0 : v)))))
    expect(semViews.faixas[2]).toMatchObject({ videos: 3, estado: 'sem-views', texto: 'nenhum vídeo desta faixa teve views nos 28 dias', normal: null })
  })
})

describe('13.3 retenção: a tabela por vídeo', () => {
  it('ordenada por views de 28 dias (maior primeiro), com faixa, views, % e "contra a faixa"', () => {
    const r = cheio()
    // views em 28 dias = views por dia × 10 dias: 200 (idx10), 120 (idx6), 90, 80, 70, 60, 60, 50, 50, 40, 40, 30, 20, 10
    expect(r.videos.map(v => v.views28)).toEqual(['200', '120', '90', '80', '70', '60', '60', '50', '50', '40', '40', '30', '20', '10'])
    expect(r.videos.length).toBe(14)
    const v6 = r.videos[1]!
    expect(v6).toMatchObject({ faixa: '5 a 15 min', pct: '30%', alvo: true })
    expect(v6.contra).toEqual({ leitura: 'abaixo', sinal: '−', pontos: '4 pontos', texto: 'abaixo do normal da faixa (34%)' })
  })
  it('"na média" = até 2 pontos, para cima ou para baixo (arredonda antes): "=" e o texto, sem sinal de cor', () => {
    const r = cheio()
    const por = (pct: string, faixa: string) => r.videos.find(v => v.pct === pct && v.faixa === faixa)!
    expect(por('44%', 'Até 5 min').contra).toEqual({ leitura: 'na-media', sinal: '=', pontos: '1 ponto', texto: 'na média da faixa (45%), −1 ponto' })
    expect(por('32%', '5 a 15 min').contra).toMatchObject({ leitura: 'na-media', texto: 'na média da faixa (34%), −2 pontos' })
    expect(por('34%', '5 a 15 min').contra).toMatchObject({ leitura: 'na-media', texto: 'na média da faixa (34%)' })
    expect(por('36%', '5 a 15 min').contra).toMatchObject({ leitura: 'na-media', texto: 'na média da faixa (34%), +2 pontos' })
  })
  it('3 pontos ou mais já é acima ou abaixo', () => {
    const r = cheio()
    expect(r.videos.find(v => v.pct === '48%')!.contra).toEqual({ leitura: 'acima', sinal: '+', pontos: '3 pontos', texto: 'acima do normal da faixa (45%)' })
    expect(r.videos.find(v => v.pct === '42%')!.contra).toMatchObject({ leitura: 'abaixo', sinal: '−', pontos: '3 pontos' })
  })
  it('faixa sem normal: "poucos vídeos para comparar" e nenhum sinal', () => {
    const v = cheio().videos.find(x => x.faixa === 'Acima de 15 min')!
    expect(v.contra).toEqual({ leitura: 'sem', sinal: null, pontos: null, texto: 'poucos vídeos para comparar' })
  })
  it('poucas views (menos de 10): o % sai com a contagem ao lado e não compara com o normal', () => {
    const p = plano(PCT, VPD); p[0] = { dias: 8, views: 1, pct: 70 }   // 8 views no total
    const v = monta(com(MUNDO, p)).videos.find(x => x.nViews === '8 views')!
    expect(v).toMatchObject({ pct: '70%' })
    expect(v.contra).toEqual({ leitura: 'sem', sinal: null, pontos: null, texto: 'poucas views para comparar' })
    // exatamente 10 views já compara
    const q = plano(PCT, VPD); q[0] = { dias: 10, views: 1, pct: 70 }
    expect(monta(com(MUNDO, q)).videos.find(x => x.pct === '70%')!.nViews).toBeNull()
  })
  it('% assistido ACIMA de 100 é dado válido: o número real, a barra cheia, marcado por forma, sem recorte', () => {
    const p = plano(PCT, VPD); p[10] = { dias: 10, views: 20, pct: 112.4 }
    const v = monta(com(MUNDO, p)).videos.find(x => x.pct === '112%')!
    expect(v).toMatchObject({ pct: '112%', barra: 1, acimaDe100: true })
    expect(cheio().videos.every(x => x.acimaDe100 === false)).toBe(true)
    expect(v.alt).toContain('acima de 100%')
  })
  it('a marca do normal da faixa fica na posição do normal (0 a 1)', () => {
    const v = cheio().videos.find(x => x.pct === '30%')!
    expect(v.barra).toBeCloseTo(0.3, 5)
    expect(v.normalPos).toBeCloseTo(0.34, 5)
    expect(cheio().videos.find(x => x.faixa === 'Acima de 15 min')!.normalPos).toBeNull()
  })
})

describe('13.3 retenção: fronteiras (os mutantes de >= e de 4 vídeos)', () => {
  const cinco = (pcts: number[], vpd: number[]) => monta(com(MUNDO, plano(pcts, vpd)))
  it('faixa com exatamente 4 vídeos com views: sem normal ("precisa de 5"); com 5, tem', () => {
    const r4 = cinco([50, 50, 50, 50], [1, 2, 4, 5])
    expect(r4.faixas[0]).toMatchObject({ normal: null, estado: 'poucos', texto: 'poucos vídeos para comparar (4; precisa de 5)' })
    const r5 = cinco([50, 50, 50, 50, 50], [1, 2, 4, 5, 3])
    expect(r5.faixas[0]).toMatchObject({ normal: '50%', estado: 'normal' })
  })
  it('as views IGUAIS ao normal do canal não são "acima": só estritamente acima conta', () => {
    // views em 28 dias: 10, 20, 40, 50 e 30 (o do % 40): a mediana é 30, igual ao dele
    const igual = cinco([50, 50, 50, 50, 40], [1, 2, 4, 5, 3])
    expect(igual.videos.find(v => v.pct === '40%')).toMatchObject({ views28: '30', alvo: false })
    expect(igual.relance!.negrito).toBe('')
    // com 4 views por dia (40 em 28 dias) passa da mediana (que vira 40): ainda igual; com 5, passa
    const acima = cinco([50, 50, 50, 50, 40], [1, 2, 4, 5, 6])
    expect(acima.videos.find(v => v.pct === '40%')).toMatchObject({ views28: '60', alvo: true })
  })
  it('exatamente 100% não passa de 100: sem a marca; 100,1% passa', () => {
    const cem = cinco([100, 50, 50, 50, 50], [1, 2, 4, 5, 3])
    expect(cem.videos.find(v => v.pct === '100%')).toMatchObject({ acimaDe100: false, barra: 1 })
    const alem = cinco([100.6, 50, 50, 50, 50], [1, 2, 4, 5, 3])
    expect(alem.videos.find(v => v.pct === '101%')).toMatchObject({ acimaDe100: true, barra: 1 })
  })
})

describe('13.3 retenção: a frase de relance', () => {
  it('vídeos com views acima do normal do canal (mediana) e % abaixo do normal da faixa são nomeados, do mais visto ao menos', () => {
    // mediana das views em 28 dias dos 14 vídeos = 55; abaixo: idx6 (120 views, −4), idx0 (90, −5), idx1 (80, −3)
    const r = cheio()
    expect(r.relance).toEqual({ negrito: '3 vídeos têm', resto: expect.stringMatching(/ views acima do normal do canal e % assistido abaixo do normal da faixa: “.+”, “.+”, “.+”\.$/) })
    expect(r.videos.filter(v => v.alvo)).toHaveLength(3)
    expect(r.videos.filter(v => v.alvo).map(v => v.views28)).toEqual(['120', '90', '80'])
  })
  it('um vídeo só: "1 vídeo tem"; nenhum: a frase negativa', () => {
    const nenhum = monta(com(MUNDO, plano(PCT.map(() => 50), VPD)))
    expect(nenhum.relance).toEqual({ negrito: '', resto: 'Nenhum vídeo tem views acima do normal do canal com % assistido abaixo do normal da faixa.' })
    const um = plano(PCT, VPD); um[0] = { dias: 10, views: 9, pct: 45 }; um[1] = { dias: 10, views: 8, pct: 45 }
    // idx6 continua abaixo (−4) com 120 views
    expect(monta(com(MUNDO, um)).relance!.negrito).toBe('1 vídeo tem')
  })
})

describe('13.3 retenção: estados sem número (nunca zero)', () => {
  it('sem permissão: só a frase, sem vídeo, sem faixa, sem relance e nenhum dígito', () => {
    const r = monta(com(MUNDO, [], 'negado'))
    expect(r).toMatchObject({ estado: 'negado', vazio: 'Só quem edita o site vê o % assistido.', faixas: [], videos: [], relance: null })
    expect(JSON.stringify(r)).not.toMatch(/\d/)
  })
  it('leitura que falhou, diário vazio e nenhum vídeo com views: três frases diferentes', () => {
    expect(monta(com(MUNDO, [], 'erro'))).toMatchObject({ estado: 'erro', vazio: 'A leitura do % assistido falhou agora; recarregue a página.', videos: [] })
    expect(monta(com(MUNDO, [], 'vazio'))).toMatchObject({ estado: 'sem-diario', vazio: 'A coleta diária ainda não rodou para este canal: não há % assistido de nenhum vídeo.', videos: [] })
    const zero = monta(com(MUNDO, plano(PCT, VPD.map(() => 0))))
    expect(zero.estado).toBe('sem-views')
    expect(zero.vazio).toMatch(/^Nenhum vídeo teve views nos 28 dias até \d\d\/\d\d\. Sem views não há % assistido para comparar\./)
    expect(zero.videos).toEqual([])
  })
  it('há views mas o YouTube não entregou o % assistido: a frase diz isso (nunca "sem views")', () => {
    const r = monta(com(MUNDO, plano(PCT.map(() => null), VPD)))
    expect(r.estado).toBe('sem-percentual')
    expect(r.vazio).toBe('O YouTube ainda não entregou o % assistido de nenhum vídeo.')
  })
  it('vídeos com views sem % entre os que têm: ficam fora da tabela e uma nota diz quantos', () => {
    const p = plano(PCT, VPD); p[3] = { dias: 10, views: 6, pct: null }
    const r = monta(com(MUNDO, p))
    expect(r.videos).toHaveLength(13)
    expect(r.semPercentual).toBe('1 vídeo teve views, mas o YouTube ainda não entregou o % assistido dele.')
    expect(cheio().semPercentual).toBeNull()
  })
  it('a nota do período diz até que dia vão os 28 dias', () => {
    expect(cheio().nota).toMatch(/^Dado do diário do YouTube, dia do YouTube, dos 28 dias até \d\d\/\d\d\. A curva de retenção por minuto fica na página de cada vídeo\.$/)
  })
  it('o texto do ⓘ é estático (4 itens) e nunca fala de dado do canal', () => {
    expect(METODO_ASSISTIDO).toHaveLength(4)
    expect(METODO_ASSISTIDO.join(' ')).toContain('até 2 pontos')
    expect(METODO_ASSISTIDO.join(' ')).toContain('Acima de 100%: trecho que muita gente voltou para rever')
  })
})
