// E5b Tarefa 15: o modelo dos três cartões de % assistido por período (números e frases do mockup B).
import { describe, it, expect } from 'vitest'
import { buildAssistidoPeriodos, type EntradaAssistido } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodo-model'
import type { NormalDoPeriodo, PeriodoAssistido } from '../../../src/lib/youtube/observatorio/proprio/assistido-periodo'
import type { FaixaId } from '../../../src/lib/youtube/observatorio/proprio/assistido'

const ok = (periodo: PeriodoAssistido, pct: number, views: number, videos = 20): NormalDoPeriodo => ({ periodo, de: '2026-01-01', ate: '2026-10-10', pct, pctArredondado: Math.round(pct), views, videos, motivo: null })
const sem = (periodo: PeriodoAssistido, motivo: NonNullable<NormalDoPeriodo['motivo']>, views = 0): NormalDoPeriodo => ({ periodo, de: null, ate: null, pct: null, pctArredondado: null, views, videos: 0, motivo })
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const dmy = (d: string) => `${dm(d)}/${d.slice(0, 4)}`
const FX: FaixaId[] = ['ate-5', '5-a-15', 'acima-15']
const faixasOk = (): EntradaAssistido['faixas'] => ({
  inteiro: FX.map((faixa, i) => ({ faixa, normal: ok('inteiro', [52, 47.4, 41][i] as number, [124000, 185000, 103000][i] as number) })),
  '90': FX.map((faixa, i) => ({ faixa, normal: ok('90', [55.4, 52.6, 43.2][i] as number, [56000, 85000, 47000][i] as number) })),
  '28': FX.map((faixa, i) => ({ faixa, normal: ok('28', [56.2, 54.1, 44.4][i] as number, [18000, 27000, 15000][i] as number) })),
})
const entrada = (o: Partial<EntradaAssistido> = {}): EntradaAssistido => ({
  tela: 'video', acesso: 'ok',
  normais: { inteiro: ok('inteiro', 47.2, 412000), '90': ok('90', 51.1, 188000), '28': ok('28', 52.3, 60000) },
  faixas: null, videoPct: 54, buracos: { inteiro: { comBuraco: 0, naConta: 35 }, '90': { comBuraco: 0, naConta: 35 }, '28': { comBuraco: 0, naConta: 35 } },
  diarioDesde: null, ultimoDia: '2026-10-10', dm, dmy, ...o,
})

describe('E5b T15: modelo de % assistido por período', () => {
  it('os três cartões com 47, 51 e 52 e as setas do mockup (▲ +4 e ▲ +5 contra o canal inteiro)', () => {
    const v = buildAssistidoPeriodos(entrada())
    expect(v.cartoes.map(c => [c.rotulo, c.curto, c.valor, c.seta?.texto ?? null, c.legenda])).toEqual([
      ['Canal inteiro', 'Inteiro', '47%', null, '412 mil views'],
      ['Últimos 90 dias', '90 dias', '51%', '▲ +4', '188 mil views'],
      ['Últimos 28 dias', '28 dias', '52%', '▲ +5', '60 mil views'],
    ])
  })

  it('a frase do vídeo: "Acima do normal dos últimos 90 dias: 54% contra 51% (+3 pontos)"', () => {
    const v = buildAssistidoPeriodos(entrada())
    expect(v.conteudos['90'].frase?.texto).toBe('Acima do normal dos últimos 90 dias: 54% contra 51% (+3 pontos).')
    expect(v.conteudos['28'].frase?.texto).toBe('Na média dos últimos 28 dias: 54% contra 52% (+2 pontos).')
    expect(v.conteudos.inteiro.frase?.texto).toBe('Acima do normal do canal inteiro: 54% contra 47% (+7 pontos).')
  })

  it('a diferença é feita sobre os arredondados (51,4 e 47,6 dão +3, não +4)', () => {
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 47.6, 400000), '90': ok('90', 51.4, 100000), '28': ok('28', 52, 50000) } }))
    expect(v.cartoes[1]?.seta?.texto).toBe('▲ +3')
  })

  it('piorando: ▼ com o sinal de menos', () => {
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 49.25, 380000), '90': ok('90', 46.25, 150000), '28': ok('28', 43.25, 52000) } }))
    expect(v.cartoes.map(c => c.seta?.texto ?? null)).toEqual([null, '▼ −3', '▼ −6'])
  })

  it('a frase do canal usa "vídeo típico": 90 dias e 28 dias; o canal inteiro compara os 90', () => {
    const v = buildAssistidoPeriodos(entrada({ tela: 'canal', faixas: faixasOk() }))
    expect(v.conteudos['90'].frase?.texto).toBe('Nos últimos 90 dias, o vídeo típico foi assistido por 51%; no canal inteiro, 47% (+4 pontos).')
    expect(v.conteudos['28'].frase?.texto).toBe('Nos últimos 28 dias, o vídeo típico foi assistido por 52%; no canal inteiro, 47% (+5 pontos).')
    expect(v.conteudos.inteiro.frase?.texto).toBe(v.conteudos['90'].frase?.texto)
  })

  it('poucas views: sem número, sem seta, com "340 de 1.000 views"; a frase diz o que falta e oferece o canal inteiro', () => {
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 47.7, 296000), '90': ok('90', 48.7, 41000), '28': sem('28', 'poucas-views', 340) } }))
    const c = v.cartoes[2]!
    expect([c.estado, c.valor, c.seta, c.semNumero, c.legenda]).toEqual(['sem-numero', null, null, 'poucas views', '340 de 1.000 views'])
    expect(v.conteudos['28'].frase).toMatchObject({ leitura: 'sem', verInteiro: true })
    expect(v.conteudos['28'].frase?.texto).toBe('Sem comparação com os últimos 28 dias: o canal teve só 340 views no período (precisa de 1.000).')
  })

  it('cobertura-parcial: "N de M vídeos com dias sem leitura no período", e o cartão não diz "poucas views"', () => {
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 47, 300000), '90': ok('90', 49, 40000), '28': sem('28', 'cobertura-parcial', 340) }, buracos: { inteiro: { comBuraco: 0, naConta: 35 }, '90': { comBuraco: 0, naConta: 35 }, '28': { comBuraco: 2, naConta: 34 } } }))
    const c = v.cartoes[2]!
    expect([c.valor, c.seta, c.legenda]).toEqual([null, null, '2 de 34 vídeos com dias sem leitura no período'])
    expect(JSON.stringify(c)).not.toContain('poucas views')
  })

  it('cobertura não conhecida: "não sabemos se o período inteiro foi coletado"', () => {
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 47, 300000), '90': ok('90', 49, 40000), '28': sem('28', 'cobertura-parcial', 340) }, buracos: { inteiro: null, '90': null, '28': null } }))
    expect(v.cartoes[2]?.legenda).toBe('não sabemos se todos os dias foram coletados')
  })

  it('diário que começa depois da publicação: o primeiro cartão se chama "Desde dd/mm/aaaa"', () => {
    const v = buildAssistidoPeriodos(entrada({ diarioDesde: '2026-08-20' }))
    expect([v.cartoes[0]?.rotulo, v.cartoes[0]?.curto]).toEqual(['Desde 20/08/2026', 'Desde 20/08'])
    const c = buildAssistidoPeriodos(entrada())
    expect(c.cartoes[0]?.rotulo).toBe('Canal inteiro')
  })

  it('sem diário: os três cartões "sem dado" e a frase da coleta que não rodou', () => {
    const n = (p: PeriodoAssistido) => sem(p, 'sem-diario')
    const v = buildAssistidoPeriodos(entrada({ normais: { inteiro: n('inteiro'), '90': n('90'), '28': n('28') } }))
    expect(v.cartoes.map(c => c.semNumero)).toEqual(['sem dado', 'sem dado', 'sem dado'])
    expect(v.conteudos['90'].frase?.texto).toBe('A coleta diária ainda não rodou: sem ela não há % assistido, nem do vídeo nem do canal.')
  })

  it('negado: nenhum número na vista, só a frase de acesso de hoje', () => {
    const v = buildAssistidoPeriodos(entrada({ acesso: 'negado', normais: { inteiro: ok('inteiro', 73.5, 73519), '90': ok('90', 73.5, 73519), '28': ok('28', 73.5, 73519) } }))
    expect(v.vazio).toBe('Só quem edita o site vê o % assistido.')
    expect(v.cartoes).toEqual([])
    expect(JSON.stringify(v)).not.toMatch(/73519|73%|74%/)
  })

  it('erro de leitura: a frase de falha e nenhum número', () => {
    const v = buildAssistidoPeriodos(entrada({ acesso: 'erro' }))
    expect(v.vazio).toBe('A leitura do % assistido falhou agora; recarregue a página.')
    expect(v.cartoes).toEqual([])
  })

  it('aba do canal: a tabela por faixa fecha por célula (valor, seta contra o canal inteiro, views)', () => {
    const v = buildAssistidoPeriodos(entrada({ tela: 'canal', faixas: faixasOk() }))
    const t = v.conteudos['90'].tabela!
    expect(t.map(l => l.rotulo)).toEqual(['Até 5 min', '5 a 15 min', 'Acima de 15 min'])
    expect(t[0]?.celulas.inteiro).toMatchObject({ valor: '52%', seta: null, legenda: '124 mil views' })
    expect(t[0]?.celulas['90']).toMatchObject({ valor: '55%', legenda: '56 mil views' })
    expect(t[0]?.celulas['90'].seta?.texto).toBe('▲ +3')
    expect(t[2]?.celulas['28'].seta?.texto).toBe('▲ +3')
    expect(t[1]?.celulas['28'].seta?.texto).toBe('▲ +7')
  })

  it('faixa com poucas views no período: "poucas views" e "n de 1.000", sem número', () => {
    const f = faixasOk()!
    f['28'][0] = { faixa: 'ate-5', normal: sem('28', 'poucas-views', 100) }
    const v = buildAssistidoPeriodos(entrada({ tela: 'canal', faixas: f }))
    expect(v.conteudos['28'].tabela![0]?.celulas['28']).toMatchObject({ estado: 'sem-numero', valor: null, seta: null, semNumero: 'poucas views', legenda: '100 de 1.000 views' })
  })

  it('faixa com views mas menos de 5 vídeos: "n de 5 vídeos"', () => {
    const f = faixasOk()!
    f['90'][2] = { faixa: 'acima-15', normal: { ...sem('90', 'poucas-views'), motivo: null, views: 5000, videos: 3 } }
    const v = buildAssistidoPeriodos(entrada({ tela: 'canal', faixas: f }))
    expect(v.conteudos['90'].tabela![2]?.celulas['90']?.legenda).toBe('3 de 5 vídeos')
  })

  it('o título da lista segue o período', () => {
    const v = buildAssistidoPeriodos(entrada({ tela: 'canal', faixas: faixasOk() }))
    expect(v.conteudos['90'].tituloLista).toBe('Vídeos mais assistidos, contra o normal da faixa (últimos 90 dias)')
  })

  it('a página do vídeo não tem tabela por faixa', () => {
    expect(buildAssistidoPeriodos(entrada()).conteudos['90'].tabela).toBeNull()
  })

  it('padrão é o canal inteiro', () => {
    expect(buildAssistidoPeriodos(entrada()).padrao).toBe('inteiro')
  })
})

describe('decisão 75: o estado de ausência de cada cartão', () => {
  const todos = (m: NonNullable<NormalDoPeriodo['motivo']>) => ({ inteiro: sem('inteiro', m), '90': sem('90', m), '28': sem('28', m) })
  it('sem-acesso com sem_direito → restrito; guarda caída ou sem negativa → falhou (nunca cadeado)', () => {
    // sem acesso a vista não tem cartões: o estado vai em `vazioEstado`
    const restrito = buildAssistidoPeriodos(entrada({ acesso: 'negado', negativa: 'sem_direito', normais: todos('sem-acesso') }))
    expect(restrito.cartoes).toEqual([])
    expect(restrito.vazioEstado).toBe('restrito')
    for (const negativa of ['nao_foi_possivel_conferir', null, undefined] as const) {
      expect(buildAssistidoPeriodos(entrada({ acesso: 'negado', negativa, normais: todos('sem-acesso') })).vazioEstado).toBe('falhou')
    }
    expect(buildAssistidoPeriodos(entrada({ acesso: 'ok' })).vazioEstado).toBeNull()
  })
  it('leitura-falhou → falhou; acima-do-teto, cobertura-parcial, poucas-views e sem-diario → nao_medido; medido → null', () => {
    expect(buildAssistidoPeriodos(entrada({ acesso: 'erro', normais: todos('leitura-falhou') })).vazioEstado).toBe('falhou')
    expect(buildAssistidoPeriodos(entrada({ normais: todos('leitura-falhou') })).cartoes.every(c => c.ausencia === 'falhou')).toBe(true)
    for (const m of ['acima-do-teto', 'cobertura-parcial', 'poucas-views', 'sem-diario'] as const) {
      expect(buildAssistidoPeriodos(entrada({ normais: todos(m) })).cartoes.every(c => c.ausencia === 'nao_medido')).toBe(true)
    }
    expect(buildAssistidoPeriodos(entrada()).cartoes.every(c => c.ausencia === null)).toBe(true)
  })
})
