// @vitest-environment node
// A4 Tarefa 13.3, cabeçalho do canal próprio (mockups 1 e 2, aprovados em 12/10): a linha-resumo sob o nome, a faixa 1 com a segunda linha de cada
// célula, o "parado" com forma e palavra, e a faixa 2 ("Todos os números") com a taxa de clique do canal, o % assistido e a retenção (curva).
// Este sistema falha em VERDE: cada caso afirma o valor nulo E a frase. Número privado só para quem edita; "não medido" nunca vira zero.
import { afterEach, describe, it, expect } from 'vitest'
import { proprioWorld, alcanceCheio, CHEIO, type CenarioDados } from './proprio-fixture'
import { comDiario, diarioComPct, ultimoVideoHa } from './proprio-assistido-fixture'
import { buildProprioHeader, type ProprioHeaderView } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))
type World = ReturnType<typeof proprioWorld>
const build = (w: World): ProprioHeaderView => buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null, muitosProprios: false })!
const cel = (h: ProprioHeaderView, key: string) => { const c = [...h.faixa, ...h.todos].find(x => x.key === key); if (!c) throw new Error('célula inexistente: ' + key); return c }
const mundo = (ha: number, cenario: CenarioDados = 'cheio') => proprioWorld({ mut: ultimoVideoHa(ha), cenario })

describe('13.3 linha-resumo sob o nome', () => {
  it('mais de 60 dias sem vídeo: "Canal parado há N dias" em destaque (parado) e o resto com as impressões e o número de dias do período', () => {
    const h = build(mundo(666))
    expect(h.resumo).toEqual({ destaque: 'Canal parado há 666 dias', parado: true, resto: `; ${CHEIO.imp} impressões em 21 dias.` })
  })
  it('até 60 dias: "Último vídeo há N dias" sem destaque (60 exatos ainda não é parado)', () => {
    expect(build(mundo(12)).resumo).toMatchObject({ destaque: 'Último vídeo há 12 dias', parado: false })
    expect(build(mundo(60)).resumo).toMatchObject({ destaque: 'Último vídeo há 60 dias', parado: false })
    expect(build(mundo(61)).resumo).toMatchObject({ destaque: 'Canal parado há 61 dias', parado: true })
    expect(build(mundo(1)).resumo?.destaque).toBe('Último vídeo há 1 dia')
  })
  it('sem relatório: "; ainda sem números de alcance." (nunca "0 impressões")', () => {
    const h = build(mundo(666, 'vazio'))
    expect(h.resumo?.resto).toBe('; ainda sem números de alcance.')
  })
  it('sem permissão ou leitura com erro: a frase do motivo, sem nenhum dígito do dado privado', () => {
    expect(build(mundo(666, 'negado')).resumo?.resto).toBe('; só quem edita o site vê os números de alcance.')
    expect(build(mundo(666, 'erro')).resumo?.resto).toBe('; a leitura do alcance falhou agora; recarregue a página.')
    expect(JSON.stringify(build(mundo(666, 'negado')).resumo)).not.toMatch(/\d{2,}\s+impress/)
  })
  it('só zeros medidos: "nenhuma impressão em N dias lidos" (zero medido é um valor)', () => {
    const w = mundo(666)
    const h = build({ ...w, dados: { ...w.dados, alcance: { acesso: 'ok', dado: { ...alcanceCheio(w.canalId, w.ytIds, w.hoje), linhas: [] } } } })
    expect(h.resumo?.resto).toBe(`; nenhuma impressão em ${CHEIO.diasLidos} dias lidos.`)
  })
})

describe('13.3 faixa 1', () => {
  it('impressões: o rótulo é curto e o período vai na segunda linha', () => {
    const w = mundo(12); const h = build(w)
    const c = cel(h, 'impressoes') as { label: string; sub: string | null }
    expect(c.label).toBe('impressões')
    expect(c.sub).toMatch(/^de \d\d\/\d\d a \d\d\/\d\d$/)
  })
  it('dias desde o último vídeo: "parado" só acima de 60 dias, e o valor continua o número medido', () => {
    const p = cel(build(mundo(666)), 'diasDesdeUltimo') as { value: string | null; parado: boolean }
    expect(p).toMatchObject({ value: '666 dias', parado: true })
    const v = cel(build(mundo(12)), 'diasDesdeUltimo') as { value: string | null; parado: boolean }
    expect(v).toMatchObject({ value: '12 dias', parado: false })
  })
  it('as seis células da faixa, nesta ordem', () => {
    expect(build(mundo(12)).faixa.map(c => c.key)).toEqual(['inscritos', 'videos', 'viewsSomadas', 'impressoes', 'diasComImpressao', 'diasDesdeUltimo'])
  })
  it('sem relatório: as células de alcance ficam nulas e UMA frase explica (a mesma do estado), sem repetir quatro vezes', () => {
    const h = build(mundo(666, 'vazio'))
    for (const k of ['impressoes', 'diasComImpressao']) expect(cel(h, k)).toMatchObject({ value: null })
    expect(h.faixaMotivo).toBe('Não medido: ainda sem relatório de alcance deste canal. Nenhum destes números é zero, só falta medir.')
  })
  it('sem permissão: a frase diz quem vê, sem "não medido" nem número', () => {
    const h = build(mundo(12, 'negado'))
    expect(h.faixaMotivo).toBe('Só quem edita o site vê este número.')
    expect(cel(h, 'impressoes').value).toBeNull()
  })
  it('tudo medido: nenhuma frase de motivo', () => {
    expect(build(mundo(12)).faixaMotivo).toBeNull()
  })
})

describe('13.3 faixa 2 (todos os números)', () => {
  it('as 13 células, nesta ordem', () => {
    expect(build(mundo(12)).todos.map(c => c.key)).toEqual([
      'cliques', 'taxaClique', 'videosComImpressao', 'medianaViews', 'maisVisto', 'engajamento90', 'engajamentoTodos', 'duracaoMediana', 'ritmo', 'vpdVideo', 'assistido', 'retencao', 'inscritos30',
    ])
  })
  it('cliques estimados: a segunda linha diz como se conta', () => {
    expect((cel(build(mundo(12)), 'cliques') as { sub: string | null }).sub).toBe('impressões × taxa de cada dia')
  })
  it('taxa de clique do canal: o valor com uma casa e o intervalo de 95% na segunda linha', () => {
    const h = build(mundo(12)); const c = cel(h, 'taxaClique') as { value: string | null; sub: string | null; label: string }
    expect(c.label).toBe('taxa de clique do canal')
    expect(c.value).toBe(((CHEIO.cliques / CHEIO.imp) * 100).toFixed(1).replace('.', ',') + '%')
    expect(c.sub).toMatch(/^entre \d+,\d% e \d+,\d%$/)
  })
  it('taxa de clique sem relatório ou sem permissão: nula com a frase do estado (nunca 0%)', () => {
    expect(cel(build(mundo(12, 'vazio')), 'taxaClique')).toMatchObject({ value: null, missing: 'ainda sem relatório de alcance deste canal' })
    expect(cel(build(mundo(12, 'negado')), 'taxaClique')).toMatchObject({ value: null, missing: 'só quem edita o site vê este número' })
  })
  it('views por dia por vídeo: a segunda linha diz a base', () => {
    expect((cel(build(mundo(12)), 'vpdVideo') as { sub: string | null }).sub).toBe('mediana dos longos, 28 dias')
  })
  it('retenção (curva): sem valor, "a curva ainda não é coletada", e a frase fica dentro da célula (não vira a frase de baixo)', () => {
    const h = build(mundo(12)); const c = cel(h, 'retencao') as { label: string; value: string | null; sub: string | null; missing: string | null }
    expect(c).toMatchObject({ label: 'retenção (curva)', value: null, missing: 'a curva ainda não é coletada', sub: 'a curva ainda não é coletada' })
    expect(h.todosMotivo ?? '').not.toContain('curva')
  })
})

describe('13.3 % assistido do canal', () => {
  const seis = (w: World) => w.ytIds.slice(0, 6)
  const comPct = (w: World, plano: Parameters<typeof diarioComPct>[3]) => ({ ...w, dados: comDiario(w.dados, diarioComPct(w.canalId, seis(w), w.hoje, plano)) })
  const a = (w: World) => cel(build(w), 'assistido') as { value: string | null; sub: string | null; fraco: boolean; semNumero: boolean; missing: string | null; label: string }

  it('média pesada pelas views, em pontos, sem casa decimal; poucos views = "só N views: pouco para uma média" e cinza abaixo de 10', () => {
    const w = comPct(mundo(12), [{ dias: 8, views: 2, pct: 40 }, { dias: 8, views: 1, pct: 70 }])
    // 16 views a 40 e 8 views a 70 = 1200 / 24 = 50
    expect(a(w)).toMatchObject({ label: '% assistido', value: '50%', sub: 'só 24 views: pouco para uma média', fraco: false, semNumero: false })
    const pouco = comPct(mundo(12), [{ dias: 8, views: 1, pct: 40 }])
    expect(a(pouco)).toMatchObject({ value: '40%', sub: 'só 8 views: pouco para uma média', fraco: true })
  })
  it('30 views ou mais: a segunda linha é o método', () => {
    const w = comPct(mundo(12), [{ dias: 10, views: 5, pct: 45 }])
    expect(a(w)).toMatchObject({ value: '45%', sub: 'média pelas views, 28 dias', fraco: false })
  })
  it('as fronteiras: 30 views já é média (29 ainda é "pouco"); 10 views não é cinza (9 é)', () => {
    const w = mundo(12)
    const duas = (n1: number, d1: number, n2: number, d2: number) => a(comPct(w, [{ dias: d1, views: n1, pct: 40 }, { dias: d2, views: n2, pct: 40 }]))
    expect(duas(3, 10, 0, 0)).toMatchObject({ sub: 'média pelas views, 28 dias' })              // 30 views
    expect(duas(3, 9, 2, 1)).toMatchObject({ sub: 'só 29 views: pouco para uma média' })       // 29 views
    expect(duas(1, 10, 0, 0)).toMatchObject({ sub: 'só 10 views: pouco para uma média', fraco: false })   // 10 views: não é cinza
    expect(duas(1, 9, 0, 0)).toMatchObject({ fraco: true })    // 9 views em 9 dias
  })
  it('acima de 100 é dado válido: o número real, sem recorte', () => {
    const w = comPct(mundo(12), [{ dias: 10, views: 5, pct: 112.4 }])
    expect(a(w).value).toBe('112%')
  })
  it('poucos dias com dado (menos de 7): não crava número; diz que ainda não dá para dizer, com os dias', () => {
    const w = comPct(mundo(12), [{ dias: 3, views: 40, pct: 61 }])
    expect(a(w)).toMatchObject({ value: null, semNumero: true, missing: 'ainda não dá para dizer', sub: 'só 3 dias com dado; precisa de 7' })
    const um = comPct(mundo(12), [{ dias: 1, views: 40, pct: 61 }])
    expect(a(um).sub).toBe('só 1 dia com dado; precisa de 7')
    // exatamente 7 dias já dá número
    expect(a(comPct(mundo(12), [{ dias: 7, views: 40, pct: 61 }])).value).toBe('61%')
  })
  it('sem views nos 28 dias, % não entregue, diário vazio, sem permissão e leitura com erro: nula com a frase de cada um', () => {
    expect(a(comPct(mundo(12), [{ dias: 10, views: 0, pct: 50 }])).missing).toMatch(/^nenhum vídeo teve views nos 28 dias até \d\d\/\d\d$/)
    expect(a(comPct(mundo(12), [{ dias: 10, views: 5, pct: null }])).missing).toBe('o YouTube ainda não entregou o % assistido')
    expect(a(mundo(12, 'vazio')).missing).toBe('a coleta diária ainda não gravou este canal')
    expect(a(mundo(12, 'negado')).missing).toBe('só quem edita o site vê este número')
    expect(a(mundo(12, 'erro')).missing).toBe('a leitura do % assistido falhou agora; recarregue a página')
    for (const w of [mundo(12, 'vazio'), mundo(12, 'negado'), mundo(12, 'erro')]) expect(a(w).value).toBeNull()
  })
  it('usuário só de leitura: o cabeçalho não leva nenhum número privado (sentinelas)', () => {
    const w = mundo(666, 'negado')
    const h = build(w)
    const privadas = [...h.faixa, ...h.todos].filter(c => ['impressoes', 'diasComImpressao', 'cliques', 'taxaClique', 'vpdVideo', 'assistido', 'videosComImpressao'].includes(c.key))
    for (const c of privadas) expect(c, c.key).toMatchObject({ value: null, sub: null, n: null })
    // o texto do resumo e as frases de motivo não levam dígito nenhum do dado privado (o "666" é público: é a idade do vídeo)
    expect((h.resumo?.resto ?? '') + (h.faixaMotivo ?? '') + privadas.map(c => c.missing).join(' ')).not.toMatch(/\d/)
  })
})
