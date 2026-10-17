// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { dicaInscritos, dicaViewsDia, dicaRitmo, dicaOutliers, dicaTrocas, dicaSync, dicaCrescimento, dicaDirecao, type Escrita } from '@/app/cms/(authed)/youtube/competitors/_canais/dicas-model'

const e: Escrita = {
  num: n => n.toLocaleString('pt-BR'),
  dec1: n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  dm: ms => new Date(ms).toISOString().slice(8, 10) + '/' + new Date(ms).toISOString().slice(5, 7),
  agora: Date.UTC(2026, 9, 14, 15),
}

describe('dicas à letra', () => {
  it('Inscritos', () => {
    expect(dicaInscritos({ subs: 1_230_000, passo: 10_000 }, e)).toBe('1.230.000 inscritos. O YouTube corta a contagem para 3 algarismos: o número real é este ou um pouco maior, em menos de 10.000.')
    expect(dicaInscritos({ subs: null, passo: 0 }, e)).toBe('O canal esconde o número de inscritos; não há o que mostrar.')
    expect(dicaInscritos({ subs: 812, passo: 0 }, e)).toBe('812 inscritos. Abaixo de mil, o YouTube mostra o número exato.')
  })
  it('Views/dia', () => {
    expect(dicaViewsDia({ mediana: 1200, n: 14, desde: 'desde 01/08', porMil: 0.05, oculto: false, fraco: false, formato: 'long' }, e))
      .toBe('1.200 views por dia: a mediana dos 14 vídeos longos acompanhados desde 01/08. Por mil inscritos: menos de 0,1 views por dia.')
    expect(dicaViewsDia({ mediana: 300, n: 2, desde: 'desde 01/08', porMil: null, oculto: true, fraco: true, formato: 'short' }, e))
      .toBe('300 views por dia: a mediana dos 2 Shorts acompanhados desde 01/08. Inscritos ocultos: sem proporção por mil. Poucos vídeos: leia com cautela.')
  })
  it('Ritmo', () => {
    expect(dicaRitmo({ longos: 6, shorts: 1, ultimoHaDias: 3, partialText: null })).toBe('Em 13 semanas: 6 vídeos longos e 1 Short. Último vídeo há 3 dias.')
    expect(dicaRitmo({ longos: 1, shorts: 0, ultimoHaDias: 0, partialText: null })).toBe('Em 13 semanas: 1 vídeo longo e 0 Shorts. Último vídeo hoje.')
    expect(dicaRitmo({ longos: 6, shorts: 1, ultimoHaDias: 3, partialText: 'ritmo parcial: só os 40 vídeos mais recentes foram buscados' })).toBe('Em 13 semanas: 6 vídeos longos e 1 Short. Último vídeo há 3 dias. ritmo parcial: só os 40 vídeos mais recentes foram buscados')
  })
  it('Outliers', () => {
    expect(dicaOutliers({ melhor: { titulo: 'Vídeo X', mult: 3.4, views: 34_000, esperado: 10_000 }, nVideos: 9, fraco: false, formato: 'long' }, e))
      .toBe('“Vídeo X”: 3,4× as views típicas do canal na mesma idade (34.000 contra 10.000).')
    expect(dicaOutliers({ melhor: null, nVideos: 2, fraco: true, formato: 'long' }, e)).toBe('Só 2 vídeos longos: ainda não dá para saber o que é típico deste canal.')
  })
  it('Trocas', () => {
    expect(dicaTrocas({ ultima: null }, e)).toBe('Nenhuma troca de título ou thumbnail nos últimos 30 dias.')
    expect(dicaTrocas({ ultima: { tipo: 'ambos', titulo: 'Vídeo Y', haDias: 4, em: Date.UTC(2026, 9, 10, 15) } }, e)).toBe('Mudou o título e a thumbnail de “Vídeo Y”, há 4 dias (10/10).')
  })
  it('Sync', () => {
    expect(dicaSync({ estado: 'ok', ha: 'há 2 h', nVideos: 40, horarios: ['00h', '06h', '12h', '18h'], proprio: null }))
      .toBe('Última sincronização há 2 h, com 40 vídeos acompanhados. Automática às 00h, 06h, 12h e 18h (São Paulo).')
    expect(dicaSync({ estado: 'erro', ha: 'há 5 h', nVideos: 40, horarios: [], proprio: null }))
      .toBe('A tentativa de há 5 h não completou. Seguimos com os dados de antes (40 vídeos) e tentamos de novo na próxima sincronização.')
  })
  it('Crescimento', () => {
    const de = Date.UTC(2026, 8, 12, 15), ate = Date.UTC(2026, 9, 12, 15) // 12/09 → 12/10
    expect(dicaCrescimento({ kind: 'ok', big: '+1,7%', cap: '', antes: 1_200_000, depois: 1_220_000, de, ate, atrasadoAte: null, abs: 20_000, pct: 20_000 / 1_200_000 }, e, false))
      .toBe('De 1.200.000 inscritos em 12/09 para 1.220.000 em 12/10: +20.000 (+1,7%). Inscritos arredondados a 3 algarismos pelo YouTube.')
    expect(dicaCrescimento({ kind: 'flat', big: 'sem variação', cap: '', limite: 20_000, antes: 1_200_000, depois: 1_210_000, de, ate, atrasadoAte: null, abs: 10_000, passo: 10_000 }, e, false))
      .toBe('De 1.200.000 inscritos em 12/09 para 1.210.000 em 12/10 (+10.000). A diferença é menor que 20.000, dentro do que o corte da contagem pelo YouTube explica.')
    // Phil M-6: abaixo de mil o número é exato, sem a frase do arredondamento
    expect(dicaCrescimento({ kind: 'ok', big: '+4,0%', cap: '', antes: 500, depois: 520, de, ate, atrasadoAte: null, abs: 20, pct: 0.04 }, e, false))
      .toBe('De 500 inscritos em 12/09 para 520 em 12/10: +20 (+4,0%).')
    expect(dicaCrescimento({ kind: 'flat', big: 'sem variação', cap: '', limite: 0, antes: 800, depois: 800, de, ate, atrasadoAte: null, abs: 0, passo: 1 }, e, false))
      .toBe('De 800 inscritos em 12/09 para 800 em 12/10: o mesmo número nas duas contagens.')
    expect(dicaCrescimento({ kind: 'ok', big: '+4,0%', cap: '', antes: 50_000, depois: 52_000, de, ate, atrasadoAte: Date.UTC(2026, 9, 8, 15), abs: 2000, pct: 0.04 }, e, true))
      .toContain('Última contagem em 08/10: a coleta está parada.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'sem-registro', fechaEm: null, dias: null }, e, true))
      .toBe('Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'novo', fechaEm: Date.UTC(2026, 10, 2, 15), dias: 12 }, e, false))
      .toBe('Só 12 dias de registro; a medida pede 30. A janela fecha em 02/11.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'novo', fechaEm: Date.UTC(2026, 9, 1, 15), dias: 12 }, e, false)) // fechaEm no passado: coleta parada
      .toBe('Só 12 dias de registro; a medida pede 30.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: 'Sem registro de inscritos ainda.', motivo: 'sem-registro', fechaEm: null, dias: null }, e, false)) // concorrente (Yannis M7)
      .toBe('Sem registro de inscritos ainda.')
  })
  it('Direção', () => {
    const med = { tipo: 'medido', pct: 18, simbolo: 'sobe', texto: '', ganhoRecente: 0, ganhoAnterior: 0, foraDaEscala: null, fracao: 0, avisoDeContagem: null } as const
    expect(dicaDirecao(med as never, { recente: '118 mil', anterior: '100 mil' }, e)).toBe('Últimos 28 dias: 118 mil views. 28 dias anteriores: 100 mil. Subiu 18%.')
    expect(dicaDirecao({ tipo: 'canal_proprio', curta: '', longa: '' }, null, e)).toBe('Esta coluna não mede a Direção do seu canal. Sem data prevista.')
    // sem mudança (Logan 6): o literal de `simbolo` é o de `SimboloDeDirecao` para "estável" (ler direcao-model.ts); `pct` dentro de ±10
    expect(dicaDirecao({ ...med, pct: -4, simbolo: 'estavel' } as never, { recente: '96 mil', anterior: '100 mil' }, e)).toBe('Últimos 28 dias: 96 mil views. 28 dias anteriores: 100 mil. Variou −4%. Até 10% para cima ou para baixo conta como sem mudança.')
    expect(dicaDirecao({ ...med, pct: 0, simbolo: 'estavel' } as never, { recente: '100 mil', anterior: '100 mil' }, e)).toBe('Últimos 28 dias: 100 mil views. 28 dias anteriores: 100 mil. Variou 0%. Até 10% para cima ou para baixo conta como sem mudança.')
    expect(dicaDirecao({ tipo: 'nao_medido', motivo: 'pouco_registro', n: 20, fechaEm: '2026-11-15', curta: '', longa: '' } as never, null, e)).toBe('Só 20 dias de registro; a medida pede 56 (28 contra 28). A janela fecha em 15/11.')
    // Yannis M4: coleta atrasada, a data já passou: a frase da data sai
    expect(dicaDirecao({ tipo: 'nao_medido', motivo: 'pouco_registro', n: 54, fechaEm: '2026-10-11', curta: '', longa: '' } as never, null, e)).toBe('Só 54 dias de registro; a medida pede 56 (28 contra 28).')
  })
})

describe('dicas à letra: casos restantes da tabela', () => {
  it('Outliers sem vídeo, Trocas hoje e 1 dia, Sync do canal próprio e sem errorSince', () => {
    expect(dicaOutliers({ melhor: null, nVideos: 12, fraco: false, formato: 'long' }, e)).toBe('Nenhum vídeo dos últimos 90 dias passou de 2× as views típicas do canal.')
    expect(dicaOutliers({ melhor: null, nVideos: 2, fraco: true, formato: 'short' }, e)).toBe('Só 2 Shorts: ainda não dá para saber o que é típico deste canal.')
    expect(dicaTrocas({ ultima: { tipo: 'title', titulo: 'V', haDias: 0, em: Date.UTC(2026, 9, 14, 15) } }, e)).toBe('Mudou o título de “V”, hoje (14/10).')
    expect(dicaTrocas({ ultima: { tipo: 'thumb', titulo: 'V', haDias: 1, em: Date.UTC(2026, 9, 13, 15) } }, e)).toBe('Mudou a thumbnail de “V”, há 1 dia (13/10).')
    expect(dicaSync({ estado: 'ok', ha: 'há 1 h', nVideos: 10, horarios: [], proprio: 'Seu canal não entra nesta rodada; ele sincroniza pelo Painel.' })).toBe('Última sincronização há 1 h, com 10 vídeos acompanhados. Seu canal não entra nesta rodada; ele sincroniza pelo Painel.')
    expect(dicaSync({ estado: 'erro', ha: '', nVideos: 3, horarios: [], proprio: null })).toBe('A última tentativa não completou. Seguimos com os dados de antes (3 vídeos) e tentamos de novo na próxima sincronização.')
  })
  it('Crescimento oculto, não carregou (title) e Direção não carregou / outro não medido', () => {
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'oculto', fechaEm: null, dias: null }, e, false)).toBe('O canal esconde os inscritos: não há o que comparar. Sem data prevista; só muda se ele mostrar.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: 'a leitura falhou', motivo: 'nao-carregou', fechaEm: null, dias: null }, e, false)).toBe('a leitura falhou')
    expect(dicaDirecao({ tipo: 'nao_carregou', motivo: 'leitura_falhou' }, null, e)).toBeNull()
    expect(dicaDirecao({ tipo: 'nao_medido', motivo: 'base_zero', curta: 'c', longa: 'texto longo' }, null, e)).toBe('texto longo')
  })
})
