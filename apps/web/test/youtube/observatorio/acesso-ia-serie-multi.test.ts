// @vitest-environment node
/**
 * A5 F2b T11: a `serie` de vários canais (`canal_ids`) em CSV: um bloco de linhas por canal na ordem do pedido, canal não encontrado e canal não lido
 * viram linhas `nao_medido` (nunca o canal próprio no lugar), privacidade por OR de todos os modelos, bases diferentes no topo, e o prazo DENTRO do
 * `responder` (dois cortes pelo MESMO relógio que a `executar` recebe: antes de cada canal, pela estimativa; e uma corrida por canal contra `limiteMs`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>,
  captured: [] as unknown[][],
  proprio: { id: 'proprio-resolvido' as string | null, chamadas: 0 },
}))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a), captureException: (...a: unknown[]) => m.captured.push(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({
  EMPACOTAR: m.empacotar,
  resolverProprio: async () => { m.proprio.chamadas += 1; return m.proprio.id },
}))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import type { Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { base, medido, modeloCheio, naoMedido, rotulo } from './contexto-ia-fixture'

const abrir = ABRIDOR_DE_SESSAO
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const D = '44444444-4444-4444-8444-444444444444'
const E = '55555555-5555-4555-8555-555555555555'
const INEXISTENTE = '99999999-9999-4999-8999-999999999999'
const PROPRIO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
/** 10/11/2026 12:00 em São Paulo. */
const AGORA = Date.UTC(2026, 10, 10, 15, 0, 0)

const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`)
const mais = (d: string, n: number): string => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10)
const entre = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / 86_400_000)
const dmDe = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const med = (x: number): Celula => medido(String(x), x, 'p')

function tabela(o: { id?: string; ultimo?: string; n?: number; privada?: boolean; fuso?: 'sao_paulo' | 'pacifico'; valor?: (d: string) => Celula | null; col2?: boolean } = {}): Tabela {
  const ultimo = o.ultimo ?? '2026-11-08'
  const n = o.n ?? 90
  const dias = Array.from({ length: n }, (_, i) => mais(ultimo, -i))
  const valor = o.valor ?? ((d: string) => med(1000 + entre('2026-08-01', d)))
  return {
    id: o.id ?? 'canal-linha-do-tempo', titulo: 'Linha do tempo: views ganhas por dia', tipo: 'dia_a_dia', nomeNoCorte: 'views por dia do canal', privada: o.privada ?? false,
    semana: 'soma', fuso: o.fuso ?? 'sao_paulo', dias,
    colunas: ['Dia', 'Views ganhas', 'Situação'],
    linhas: dias.map((d, i): Celula[] => [rotulo(`seg ${dmDe(d)}`, `p.t[${i}].dia`), valor(d) ?? naoMedido('sem registro', 'p'), (o.col2 ? med(10 + i) : base('com views', `p.t[${i}].s`))]),
  }
}
const concorrente = (nome: string, t: Tabela = tabela()): PacoteModelo => ({ ...modeloCheio(), tela: 'canal', foco: [{ nome, oQueE: 'concorrente', detalhe: 'canal' }], tabelas: [t] })
const proprio = (incluido: boolean, t: Tabela = tabela({ id: 'privado-views-por-dia', privada: true, fuso: 'pacifico', ultimo: '2026-11-07' })): PacoteModelo => ({
  ...modeloCheio(), tela: 'canal-proprio', foco: [{ nome: 'Meu Canal', oQueE: 'canal próprio', detalhe: 'canal' }],
  tabelas: incluido ? [t] : [],
  privado: incluido ? { estado: 'incluido', itens: 'views por dia' } : { estado: 'excluido', motivo: 'sem_direito', itens: 'views por dia' },
})

interface Fonte { modelo: PacoteModelo; atraso?: number }
const lidos: string[] = []
/** `canal` e `canal-proprio` respondem pelo id (o responder tenta os dois, como o registro de verdade); o atraso é por canal, em timers falsos. */
function fontes(f: Record<string, Fonte>, ordemInvertida = false): void {
  const pelaTela = (tela: 'canal' | 'canal-proprio') => async ({ id }: { id?: string }) => {
    const x = f[id ?? '']
    if (!x || x.modelo.tela !== tela) return null
    lidos.push(id!)
    if (x.atraso !== undefined) {
      if (ordemInvertida) await Promise.resolve()
      await new Promise<void>((res) => setTimeout(res, x.atraso))
    }
    return { modelo: x.modelo, recente: '10/11/2026 09:10', estado: {} }
  }
  m.empacotar['canal'] = vi.fn(pelaTela('canal'))
  m.empacotar['canal-proprio'] = vi.fn(pelaTela('canal-proprio'))
}

const csvDe = (texto: string): string[] => {
  const a = texto.indexOf('```csv\n')
  if (a < 0) return []
  const resto = texto.slice(a + 7)
  return resto.slice(0, resto.indexOf('\n```')).split('\n')
}
const PEDIDO = (ids: string[], extra: Record<string, unknown> = {}) => ({ acao: 'serie', canal_ids: ids, de: '2026-11-01', ate: '2026-11-08', grao: 'dia', saida: 'tabela', ...extra })

beforeEach(() => {
  m.captured.length = 0
  m.proprio.id = PROPRIO_ID
  m.proprio.chamadas = 0
  lidos.length = 0
})
afterEach(() => { vi.useRealTimers() })

describe('T11 (1): um bloco por canal, canal sem leitura e canal inexistente', () => {
  it('3 canais, um sem leitura e um id inexistente: três blocos na ordem do pedido, `canal não encontrado`, nenhuma linha com o id do canal próprio', async () => {
    const semLeitura = concorrente('Sem Leitura', tabela({ valor: () => null }))
    fontes({ [A]: { modelo: concorrente('Canal A') }, [B]: { modelo: semLeitura }, [PROPRIO_ID]: { modelo: proprio(true) } })
    const r = await responder(PEDIDO([A, B, INEXISTENTE]), abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const csv = csvDe(r.texto).slice(1)
    const por = (ap: string) => csv.filter((l) => l.split(',')[1] === ap)
    expect(por('c1').length).toBe(8)
    expect(por('c1').every((l) => l.includes(',medido,'))).toBe(true)
    expect(por('c2').length).toBe(8)
    expect(por('c2').every((l) => l.includes(',nao_medido,'))).toBe(true)
    expect(por('c3').length).toBe(8)
    expect(por('c3').every((l) => l.includes(',nao_medido,'))).toBe(true)
    expect(r.texto).toContain('canal não encontrado')
    // os blocos seguem a ordem do pedido
    expect(csv.map((l) => l.split(',')[1]).filter((c, i, a) => i === 0 || c !== a[i - 1])).toEqual(['c1', 'c2', 'c3'])
    // o canal inexistente NUNCA vira o canal próprio: nenhuma leitura do próprio, nenhuma linha com o id dele
    expect(lidos).not.toContain(PROPRIO_ID)
    expect(r.texto).not.toContain(PROPRIO_ID)
    expect(r.texto).toContain(`- c3: ${INEXISTENTE}`)
    expect(r.params).toMatchObject({ n_canais: 3, canais_lidos: 2 })
    expect(r.texto).toContain('Canais: 2 de 3 lidos; 1 não encontrado')
    expect(r.params.completa).toBe(false)
  })
  it('todos os canais inexistentes: nao_encontrado com os ids (regra A1c)', async () => {
    fontes({})
    const r = await responder(PEDIDO([A, B]), abrir, AGORA)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(r.texto).toContain(A)
    expect(r.texto).toContain(B)
  })
  it('nenhum ponto medido em nenhum canal: a 1ª linha diz o intervalo e "para os canais pedidos"', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A', tabela({ valor: () => null })) }, [B]: { modelo: concorrente('Canal B', tabela({ valor: () => null })) } })
    const r = await responder(PEDIDO([A, B]), abrir, AGORA)
    expect(r.texto).toContain('Nenhum ponto medido entre 01/11/2026 e 08/11/2026 para os canais pedidos')
  })
  it('intervalo fora da tabela: linhas `nao_medido` por canal, sem estourar', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A') } })
    const r = await responder(PEDIDO([A], { de: '2025-01-01', ate: '2025-01-05' }), abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('a tela cobre de')
  })
})

describe('T11 (2): privacidade por OR e bases diferentes', () => {
  it('[concorrente, próprio] sem o direito: linhas restrito do próprio, nenhum número dele', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A') }, [PROPRIO_ID]: { modelo: proprio(false) } })
    // `proprio` só pode ser o 1º: [proprio, A]
    const r2 = await responder(PEDIDO(['proprio', A]), abrir, AGORA)
    const csv = csvDe(r2.texto).slice(1)
    const doProprio = csv.filter((l) => l.split(',')[1] === 'c1')
    expect(doProprio.length).toBeGreaterThan(0)
    expect(doProprio.every((l) => l.split(',')[4] === 'restrito' && l.split(',')[3] === '')).toBe(true)
    expect(r2.incluiuPrivado).toBe(false)
    expect(r2.params.privado).toBe(false)
    expect(r2.texto).not.toContain('privado: sim')
  })
  it('com o direito: `privado: sim`, incluiuPrivado e params.privado por OR de todos os modelos (o último, concorrente, não é privado)', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A') }, [PROPRIO_ID]: { modelo: proprio(true) } })
    const r = await responder(PEDIDO(['proprio', A]), abrir, AGORA)
    expect(r.texto).toContain('privado: sim')
    expect(r.incluiuPrivado).toBe(true)
    expect(r.params.privado).toBe(true)
    expect(m.proprio.chamadas).toBe(1)
  })
  it('só concorrentes: incluiuPrivado e params.privado falsos', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A') }, [B]: { modelo: concorrente('Canal B') } })
    const r = await responder(PEDIDO([A, B]), abrir, AGORA)
    expect(r.incluiuPrivado).toBe(false)
    expect(r.params.privado).toBe(false)
  })
  it('[próprio, concorrente]: duas bases distintas no dicionário e a frase do topo; só concorrentes: sem a frase', async () => {
    fontes({ [A]: { modelo: concorrente('Canal A') }, [PROPRIO_ID]: { modelo: proprio(true) } })
    const r = await responder(PEDIDO(['proprio', A]), abrir, AGORA)
    expect(r.texto).toContain('Bases diferentes nesta tabela: o seu canal soma só vídeos longos acompanhados, no dia do YouTube (Pacífico); os concorrentes, o canal inteiro com Shorts, no dia de São Paulo. Não compare sem citar as duas.')
    const bases = r.texto.split('\n').filter((l) => /^ {2}- c\d · \w+:/.test(l)).map((l) => l.split('base: ')[1])
    expect(new Set(bases).size).toBe(2)
    fontes({ [A]: { modelo: concorrente('Canal A') }, [B]: { modelo: concorrente('Canal B') } })
    const so = await responder(PEDIDO([A, B]), abrir, AGORA)
    expect(so.texto).not.toContain('Bases diferentes nesta tabela')
  })
  it('`proprio` sem canal próprio no site: linhas nao_medido `canal não encontrado`, o concorrente segue', async () => {
    m.proprio.id = null
    fontes({ [A]: { modelo: concorrente('Canal A') } })
    const r = await responder(PEDIDO(['proprio', A]), abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(csvDe(r.texto).slice(1).filter((l) => l.split(',')[1] === 'c1').every((l) => l.includes(',nao_medido,'))).toBe(true)
    expect(r.texto).toContain('canal não encontrado')
  })
})

describe('T11 (3): tamanho', () => {
  it('[proprio, A, B, C, D, E] × 90 dias no grão dia cabe sem corte (texto ≤ 60.000, cortes 0)', async () => {
    const t90 = (ultimo: string, o: Parameters<typeof tabela>[0] = {}) => tabela({ ultimo, n: 120, ...o })
    fontes({
      // o pior caso: o próprio com 3 medidas (views, impressões e cliques)
      [PROPRIO_ID]: { modelo: { ...proprio(true, t90('2026-11-07', { id: 'privado-views-por-dia', privada: true, fuso: 'pacifico' })), tabelas: [t90('2026-11-07', { id: 'privado-views-por-dia', privada: true, fuso: 'pacifico' }), t90('2026-11-07', { id: 'privado-impressoes-por-dia', privada: true, fuso: 'pacifico', col2: true })] } },
      [A]: { modelo: concorrente('Canal A', t90('2026-11-09')) }, [B]: { modelo: concorrente('Canal B', t90('2026-11-09')) },
      [C]: { modelo: concorrente('Canal C', t90('2026-11-09')) }, [D]: { modelo: concorrente('Canal D', t90('2026-11-09')) }, [E]: { modelo: concorrente('Canal E', t90('2026-11-09')) },
    })
    const r = await responder(PEDIDO(['proprio', A, B, C, D, E], { de: '2026-08-12', ate: '2026-11-09' }), abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.params.cortes).toBe(0)
    expect(csvDe(r.texto).length - 1).toBe(8 * 90) // 5 concorrentes × 1 medida + o próprio × 3 medidas, 90 dias (08 e 09/11 do próprio: não chegados)
    expect(r.texto.length).toBe(MEDIDO_6X90)
    expect(r.texto.length).toBeLessThanOrEqual(60_000)
  })
  it('pacote que estoura: corta as datas mais antigas por igual em todos os canais, linha inteira, bloco fechado, params.cortes > 0', async () => {
    const grande = (ultimo: string) => tabela({ ultimo, n: 400 })
    fontes({ [A]: { modelo: concorrente('Canal A', grande('2026-11-09')) }, [B]: { modelo: concorrente('Canal B', grande('2026-11-09')) }, [C]: { modelo: concorrente('Canal C', grande('2026-11-09')) }, [D]: { modelo: concorrente('Canal D', grande('2026-11-09')) }, [E]: { modelo: concorrente('Canal E', grande('2026-11-09')) } })
    const r = await responder(PEDIDO([A, B, C, D, E], { de: '2025-10-12', ate: '2026-11-09' }), abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.params.cortes as number).toBeGreaterThan(0)
    expect(r.texto.length).toBeLessThanOrEqual(60_000)
    const linhas = csvDe(r.texto).slice(1)
    const porCanal = ['c1', 'c2', 'c3', 'c4', 'c5'].map((c) => linhas.filter((l) => l.split(',')[1] === c))
    expect(new Set(porCanal.map((x) => x.length)).size).toBe(1) // por igual
    expect(new Set(porCanal.map((x) => x[0]!.split(',')[0])).size).toBe(1) // a mesma data mais antiga em todos
    expect(r.texto).toMatch(/```csv\n[\s\S]*\n```/)
    expect(r.texto).toContain('Cortado:')
  })
})

/* ------------------------------------------------------------------ o prazo */

const T0 = AGORA
/** A resposta e o instante (relógio falso) em que ela ficou pronta. */
const rodar = async (ids: string[], limiteMs: number): Promise<Awaited<ReturnType<typeof responder>> & { fim: number }> => {
  let fim = 0
  const p = responder(PEDIDO(ids), abrir, AGORA, { limiteMs, relogio: () => Date.now() }).then((r) => { fim = Date.now(); return r })
  await vi.advanceTimersByTimeAsync(120_000)
  return Object.assign(await p, { fim })
}
const seis = (atrasos: number[]): Record<string, Fonte> => {
  const ids = [A, B, C, D, E, '66666666-6666-4666-8666-666666666666']
  return Object.fromEntries(ids.map((id, i) => [id, { modelo: concorrente(`Canal ${i + 1}`), atraso: atrasos[i]! * 1000 }]))
}
const SEIS = [A, B, C, D, E, '66666666-6666-4666-8666-666666666666']

describe.each([false, true])('T11 (4) prazo, abridor de 11 s por canal (ordem dos timers invertida: %s)', (invertida) => {
  for (let rodada = 0; rodada < 20; rodada++) {
    it(`rodada ${rodada + 1}: lê 4 (0, 11, 22, 33 s), o 5º (44 + 11 > 48) e o 6º saem "não lido"`, async () => {
      vi.useFakeTimers()
      vi.setSystemTime(T0)
      lidos.length = 0
      fontes(seis([11, 11, 11, 11, 11, 11]), invertida)
      const r = await rodar(SEIS, T0 + 48_000)
      expect(r.desfecho).toBe('ok')
      expect(lidos).toEqual(SEIS.slice(0, 4))
      expect(r.params).toMatchObject({ canais_lidos: 4, n_canais: 6 })
      const csv = csvDe(r.texto).slice(1)
      for (const ap of ['c5', 'c6']) {
        const doCanal = csv.filter((l) => l.split(',')[1] === ap)
        expect(doCanal.length).toBe(8)
        expect(doCanal.every((l) => l.includes(',nao_medido,'))).toBe(true)
      }
      expect(r.texto).toContain('não lido: o prazo da chamada acabou')
      expect(r.texto).toContain('Canais: 4 de 6 lidos; 2 não lidos (o prazo da chamada acabou)')
      expect(r.params.completa).toBe(false)
      expect(csv.filter((l) => ['c1', 'c2', 'c3', 'c4'].includes(l.split(',')[1]!) && l.includes(',medido,')).length).toBeGreaterThan(0)
      expect(r.params.cortes as number).toBe(2)
      expect(r.fim).toBe(T0 + 44_000) // o 4º termina em 44 s e nada mais é lido
    })
  }
})

describe.each([false, true])('T11 (4b) variância [8, 8, 8, 8, 20, 8] s, limiteMs = t0 + 48 s (ordem dos timers invertida: %s)', (invertida) => {
  for (let rodada = 0; rodada < 20; rodada++) {
    it(`rodada ${rodada + 1}: 4 lidos, o 5º cortado PELA CORRIDA, o 6º não lido, resposta em ≤ limiteMs`, async () => {
      vi.useFakeTimers()
      vi.setSystemTime(T0)
      lidos.length = 0
      fontes(seis([8, 8, 8, 8, 20, 8]), invertida)
      const r = await rodar(SEIS, T0 + 48_000)
      expect(r.desfecho).toBe('ok')
      // o 5º foi lido (começou) mas perdeu a corrida; o 6º nem começou
      expect(lidos).toEqual(SEIS.slice(0, 5))
      expect(r.params).toMatchObject({ canais_lidos: 4, n_canais: 6 })
      const csv = csvDe(r.texto).slice(1)
      expect(csv.filter((l) => l.split(',')[1] === 'c5').every((l) => l.includes(',nao_medido,'))).toBe(true)
      expect(csv.filter((l) => l.split(',')[1] === 'c6').every((l) => l.includes(',nao_medido,'))).toBe(true)
      expect(csv.filter((l) => ['c1', 'c2', 'c3', 'c4'].includes(l.split(',')[1]!) && l.includes(',medido,')).length).toBeGreaterThan(0)
      expect(r.fim).toBeLessThanOrEqual(T0 + 48_000)
      expect(r.fim).toBeLessThanOrEqual(T0 + 50_000)
      expect(r.fim).toBe(T0 + 48_000) // o corte pela corrida cai em 48.000
    })
  }
})

describe('T11 prazo: sem `limiteMs` nada é cortado; a estimativa do 1º canal é a de regras', () => {
  it('sem limite: 6 canais lidos', async () => {
    fontes(Object.fromEntries(SEIS.map((id, i) => [id, { modelo: concorrente(`Canal ${i + 1}`) }])))
    const r = await responder(PEDIDO(SEIS), abrir, AGORA)
    expect(r.params).toMatchObject({ canais_lidos: 6, n_canais: 6, cortes: 0 })
  })
  it('limite já vencido (restam 5 s, a estimativa do 1º é 8 s): nenhum canal é lido e a resposta é ok', async () => {
    fontes(Object.fromEntries(SEIS.map((id, i) => [id, { modelo: concorrente(`Canal ${i + 1}`) }])))
    const r = await responder(PEDIDO(SEIS), abrir, AGORA, { limiteMs: Date.now() + 5_000, relogio: () => Date.now() })
    expect(r.desfecho).toBe('ok')
    expect(lidos).toEqual([])
    expect(r.params).toMatchObject({ canais_lidos: 0, n_canais: 6 })
  })
})

/* ------------------------------------------------------------------ o registro */

describe('T11 (5): registro de n_canais e canais_lidos', () => {
  const inserido = async (params: Record<string, unknown>) => {
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    const r = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('site-da-prova', 'user-da-prova', 'key-da-prova', new Date(Date.now() + 86_400_000).toISOString()), acao: 'serie', params: { desfecho: 'ok', ...params }, incluiuPrivado: false, caracteres: 10, resultado: 'ok' })
    expect(r.ok).toBe(true)
    return linhas[0]!.params as Record<string, unknown>
  }
  it('contadores passam; negativo, fração e texto saem', async () => {
    expect(await inserido({ n_canais: 4, canais_lidos: 3 })).toMatchObject({ n_canais: 4, canais_lidos: 3 })
    const ruim = await inserido({ n_canais: -1, canais_lidos: 'quatro' })
    expect(ruim).not.toHaveProperty('n_canais')
    expect(ruim).not.toHaveProperty('canais_lidos')
    expect(await inserido({ n_canais: 1.5 })).not.toHaveProperty('n_canais')
  })
  it('o registro da resposta não guarda nome de canal nem valor: varredura dos params', async () => {
    fontes({ [A]: { modelo: concorrente('Nome Secreto do Canal A') }, [B]: { modelo: concorrente('Canal B') } })
    const r = await responder(PEDIDO([A, B]), abrir, AGORA)
    const json = JSON.stringify(r.params)
    expect(json).not.toContain('Nome Secreto')
    expect(json).not.toMatch(/\b1[0-9]{3}\b.*medido/)
    expect(Object.keys(r.params).sort()).toEqual(expect.arrayContaining(['n_canais', 'canais_lidos', 'saida', 'linhas', 'total', 'cortes', 'ms']))
    expect(r.params.canal_ids).toEqual([A, B]) // ids (forma de uuid), nunca o nome
  })
})

/** O tamanho do texto da pior fixture (6 canais × 90 dias), medido e gravado literal; o teste (3) falha se a montagem do CSV mudar. */
const MEDIDO_6X90 = 31_887
