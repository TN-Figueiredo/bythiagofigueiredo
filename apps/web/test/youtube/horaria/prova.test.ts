// @vitest-environment node
// A prova da leitura horária (A5 E16, Tarefa 10): a leitura conferida de `competitor_hourly_health`, o veredito e a leitura
// dos vídeos do dono que a resposta do YouTube negou. Sem banco, sem rede: cada teste traz o seu cliente falso.
// Este é um ALARME: função ausente, resposta nula, forma errada, chave faltando, número negativo, rpc abortado e exceção
// são sempre vermelho com motivo escrito, nunca verde e nunca zero.
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  lerProvaHoraria,
  veredictoHorario,
  lerNegadosDoDono,
  type ProvaHoraria,
} from '@/lib/youtube/horaria/prova'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'

const MIN = 60_000
const H = 3_600_000
const NOW = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
const atras = (ms: number): string => iso(NOW - ms)
const SENTINELA = 'SENTINELA-texto-do-banco-UC12345'

const comoSb = (x: object): SupabaseClient => x as never

/** Uma prova sã: 55 vídeos de concorrentes cobrados, 24 horas lidas, nada do dono. */
const prova = (p: Partial<ProvaHoraria> = {}): ProvaHoraria => ({
  desde: atras(3 * 24 * H), ultima_leitura: atras(10 * MIN), horas_lidas_24h: 24,
  videos_na_lista: 55, videos_fora_do_teto: 0, videos_cobrados: 55, videos_abaixo_de_22h: 0, videos_abaixo_do_lido: 0,
  proprios_desde: null, proprios_ultima_leitura: null, proprios_na_lista: 0, proprios_fora_do_teto: 0, proprios_sem_captura: 0,
  proprios_cobrados: 0, proprios_abaixo_de_22h: 0, proprios_abaixo_do_lido: 0, proprios_em_competitor: 0,
  ...p,
})
type Opcoes = Parameters<typeof veredictoHorario>[1]
const opcoes = (o: Partial<Opcoes> = {}): Opcoes => ({
  agoraMs: NOW, ligada: true, agendaDesde: atras(3 * 24 * H), listaDoDisparo: 55, semStatusNoDisparo: 0,
  negadosDoDono: 0, negadosSemClasse: 0, ...o,
})
/** O dono tem um vídeo público sem leitura há 5 h 10 (a prova do caso "negado há 5 horas"). */
const donoParado = (p: Partial<ProvaHoraria> = {}): ProvaHoraria =>
  prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 1, proprios_ultima_leitura: atras(5 * H + 10 * MIN), proprios_desde: atras(3 * 24 * H), ...p })

const spTexto = (ms: number): string => {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  const partes = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return `${partes.day}/${partes.month} ${partes.hour}:${partes.minute}`
}

// ───────── lerProvaHoraria ─────────

const rpcCom = (resposta: unknown) => {
  const rpc = vi.fn(() => Promise.resolve(resposta))
  return { rpc, sb: comoSb({ rpc }) }
}
const lerCom = (data: unknown) => lerProvaHoraria(rpcCom({ data, error: null }).sb, 'S1', iso(NOW))

describe('lerProvaHoraria', () => {
  afterEach(() => { vi.useRealTimers() })

  it('resposta nula do banco, forma errada, campo faltando, número negativo', async () => {
    const boa = { ...prova() }
    expect(await lerCom(boa)).toEqual({ valor: boa })
    const casos: Array<[string, unknown]> = [
      ['nula', null],
      ['indefinida', undefined],
      ['lista no lugar de objeto', [boa]],
      ['texto', 'ok'],
      ['número', 0],
      ['objeto vazio', {}],
      ['chave de contagem faltando', Object.fromEntries(Object.entries(boa).filter(([k]) => k !== 'videos_cobrados'))],
      ['chave de data faltando', Object.fromEntries(Object.entries(boa).filter(([k]) => k !== 'ultima_leitura'))],
      ['contagem com texto', { ...boa, videos_na_lista: '55' }],
      ['contagem nula', { ...boa, videos_na_lista: null }],
      ['contagem negativa', { ...boa, videos_abaixo_do_lido: -1 }],
      ['contagem não inteira', { ...boa, horas_lidas_24h: 23.5 }],
      ['contagem NaN', { ...boa, proprios_cobrados: Number.NaN }],
      ['data ilegível', { ...boa, desde: 'ontem' }],
      ['data com número', { ...boa, ultima_leitura: 12345 }],
      ['data do dono ilegível', { ...boa, proprios_ultima_leitura: 'xx' }],
    ]
    for (const [nome, data] of casos) {
      const r = await lerCom(data)
      expect(r, nome).toHaveProperty('porque')
      expect((r as { porque: string }).porque.length, nome).toBeGreaterThan(10)
    }
  })

  it('a prova é pedida com o site', async () => {
    const { rpc, sb } = rpcCom({ data: prova(), error: null })
    await lerProvaHoraria(sb, 'S1', iso(NOW))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('competitor_hourly_health', { p_site_id: 'S1', p_now: iso(NOW), p_age_days: 14, p_cap: 25 })
  })

  it('datas ausentes (nulo) são válidas: o site ainda não tem leitura', async () => {
    const vazia = prova({ desde: null, ultima_leitura: null, proprios_desde: null, proprios_ultima_leitura: null })
    expect(await lerCom(vazia)).toEqual({ valor: vazia })
  })

  it('rpc abortado, erro do banco, função ausente, exceção e cliente sem resposta: vermelho com motivo, sem o texto do banco', async () => {
    const respostas: Array<[string, () => Promise<unknown>]> = [
      ['abortado', () => Promise.resolve({ data: null, error: { message: 'AbortError: ' + SENTINELA, code: '' } })],
      ['erro do banco', () => Promise.resolve({ data: null, error: { message: SENTINELA, code: '57014' } })],
      ['função ausente (PGRST202)', () => Promise.resolve({ data: null, error: { message: SENTINELA, code: 'PGRST202' } })],
      ['função ausente (42883)', () => Promise.resolve({ data: null, error: { message: SENTINELA, code: '42883' } })],
      ['erro com dado válido junto', () => Promise.resolve({ data: prova(), error: { message: SENTINELA, code: '' } })],
      ['lança', () => Promise.reject(new Error(SENTINELA))],
      ['lança de forma síncrona', () => { throw new Error(SENTINELA) }],
      ['cliente devolve nulo', () => Promise.resolve(null)],
      ['cliente devolve indefinido', () => Promise.resolve(undefined)],
    ]
    for (const [nome, resp] of respostas) {
      const r = await lerProvaHoraria(comoSb({ rpc: resp }), 'S1', iso(NOW))
      expect(r, nome).toHaveProperty('porque')
      expect(JSON.stringify(r), nome).not.toContain(SENTINELA)
    }
    const ausente = await lerProvaHoraria(comoSb({ rpc: respostas[2]![1] }), 'S1', iso(NOW))
    expect((ausente as { porque: string }).porque).toMatch(/não existe|não aplicada|ausente/)
  })

  it('o rpc que nunca volta não segura a leitura: passa de BANCO_MS e vira "não li"', async () => {
    vi.useFakeTimers()
    const sb = comoSb({ rpc: () => new Promise(() => undefined) })
    const pendente = lerProvaHoraria(sb, 'S1', iso(NOW))
    await vi.advanceTimersByTimeAsync(BANCO_MS + 1)
    const r = await pendente
    expect(r).toHaveProperty('porque')
  })

  it('instante ilegível não vai ao banco', async () => {
    const { rpc, sb } = rpcCom({ data: prova(), error: null })
    const r = await lerProvaHoraria(sb, 'S1', 'não é data')
    expect(r).toHaveProperty('porque')
    expect(rpc).not.toHaveBeenCalled()
  })
})

// ───────── veredictoHorario ─────────

describe('veredictoHorario', () => {
  it('prova que não veio é vermelho', () => {
    const v = veredictoHorario(null, opcoes())
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['não foi possível ler a prova da leitura horária'])
    expect(v.avisos).toEqual([])
  })

  it('tudo vazio no primeiro disparo: nota, não problema', () => {
    const v = veredictoHorario(prova({ desde: null, ultima_leitura: null, horas_lidas_24h: 0 }), opcoes({ agendaDesde: atras(10 * MIN) }))
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toHaveLength(1)
    expect(v.notes[0]).toMatch(/ainda sem leitura/)
    expect(v.avisos).toEqual([])
  })

  it('tudo vazio depois de 2 horas: vermelho e aviso', () => {
    const v = veredictoHorario(prova({ desde: null, ultima_leitura: null, horas_lidas_24h: 0 }), opcoes({ agendaDesde: atras(3 * H) }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['nenhuma leitura horária gravada'])
    expect(v.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
    expect(v.avisos[0]!.frase.length).toBeGreaterThan(5)
  })

  it('tudo vazio sem agenda conhecida não ganha carência que ninguém mediu', () => {
    // agendaDesde nulo = não há linha da agenda: "mais de 2 h" não se prova, e a nota de carência é a que sai (spec: "existe e é mais velho")
    const v = veredictoHorario(prova({ desde: null, ultima_leitura: null, horas_lidas_24h: 0 }), opcoes({ agendaDesde: null }))
    expect(v.problems).toEqual([])
    expect(v.notes).toHaveLength(1)
  })

  it('a carência tem fim: com 2 h 1 min de agenda vermelho, com 1 h 59 min nota', () => {
    const vazia = prova({ desde: null, ultima_leitura: null, horas_lidas_24h: 0 })
    expect(veredictoHorario(vazia, opcoes({ agendaDesde: atras(2 * H + MIN) })).ok).toBe(false)
    expect(veredictoHorario(vazia, opcoes({ agendaDesde: atras(2 * H - MIN) })).ok).toBe(true)
  })

  it('sem vídeo na janela: verde sem leitura', () => {
    const v = veredictoHorario(prova({ videos_na_lista: 0, videos_cobrados: 0, desde: null, ultima_leitura: null, horas_lidas_24h: 0 }), opcoes({ listaDoDisparo: 0 }))
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toEqual([])
    expect(v.avisos).toEqual([])
  })

  it('parada há 3 horas: vermelho e aviso; há 90 minutos: não', () => {
    const parada = veredictoHorario(prova({ ultima_leitura: atras(3 * H + MIN) }), opcoes())
    expect(parada.problems).toEqual(['leitura horária parada há 3 h'])
    expect(parada.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
    const folga = veredictoHorario(prova({ ultima_leitura: atras(90 * MIN) }), opcoes())
    expect(folga.ok).toBe(true)
    expect(folga.avisos).toEqual([])
  })

  it('leituras faltando num vídeo depois de 25 horas é vermelho', () => {
    const v = veredictoHorario(prova({ desde: atras(26 * H), videos_abaixo_do_lido: 3, horas_lidas_24h: 24 }), opcoes())
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['3 vídeos com leituras faltando nas últimas 24 horas (a tarefa leu 24 horas)'])
    expect(v.avisos).toEqual([])
  })

  it('leituras faltando antes de 25 horas de leitura não são cobradas', () => {
    const v = veredictoHorario(prova({ desde: atras(24 * H), videos_abaixo_do_lido: 3, horas_lidas_24h: 20 }), opcoes())
    expect(v.problems).toEqual([])
  })

  it('buraco geral já encerrado é nota com o número, não problema', () => {
    const v = veredictoHorario(prova({ horas_lidas_24h: 21, videos_abaixo_de_22h: 55, videos_abaixo_do_lido: 0, ultima_leitura: atras(10 * MIN) }), opcoes())
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toContain('3 horas sem leitura nas últimas 24 (lidas 21 de 24); 55 vídeos com menos de 22 leituras')
  })

  it('buraco geral e a leitura parada de novo: vermelho de novo', () => {
    const v = veredictoHorario(prova({ horas_lidas_24h: 21, videos_abaixo_de_22h: 55, videos_abaixo_do_lido: 0, ultima_leitura: atras(3 * H) }), opcoes())
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['leitura horária parada há 3 h'])
    expect(v.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
  })

  it('abaixo de 22 no primeiro dia é nota', () => {
    const desde = NOW - 10 * H
    const v = veredictoHorario(prova({ desde: iso(desde), videos_abaixo_de_22h: 55 }), opcoes())
    expect(v.ok).toBe(true)
    expect(v.notes).toContain('cobertura de 24 horas cobrada a partir de ' + spTexto(desde + 25 * H))
  })

  it('zero faltando não sobe', () => {
    const v = veredictoHorario(prova(), opcoes())
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toEqual([])
    expect(v.avisos).toEqual([])
  })

  it('vídeos do dono: faltando depois de 25 h sobe; cobrados = 0 não sobe; parada sobe', () => {
    const faltando = veredictoHorario(prova({ proprios_cobrados: 2, proprios_abaixo_do_lido: 2, proprios_ultima_leitura: atras(10 * MIN) }), opcoes())
    expect(faltando.problems).toEqual(['2 vídeos do seu canal com leituras faltando nas últimas 24 horas'])
    const vazio = veredictoHorario(prova({ proprios_cobrados: 0, proprios_abaixo_do_lido: 0, proprios_ultima_leitura: null }), opcoes())
    expect(vazio.ok).toBe(true)
    const parada = veredictoHorario(prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 0, proprios_ultima_leitura: atras(5 * H) }), opcoes())
    expect(parada.problems).toEqual(['leitura horária do seu canal parada há 5 h'])
    expect(parada.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
    // sem nenhuma leitura do dono, com vídeo cobrado: também parada
    const nunca = veredictoHorario(prova({ proprios_cobrados: 1, proprios_ultima_leitura: null }), opcoes())
    expect(nunca.ok).toBe(false)
    expect(nunca.avisos).toHaveLength(1)
    // agenda nova: a carência vale também para o dono
    expect(veredictoHorario(prova({ proprios_cobrados: 1, proprios_ultima_leitura: null }), opcoes({ agendaDesde: atras(30 * MIN) })).problems).toEqual([])
  })

  it('canal do dono em concorrentes', () => {
    const v = veredictoHorario(prova({ proprios_em_competitor: 1 }), opcoes())
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['canal do dono dentro da lista de concorrentes (1): remova da lista'])
  })

  it('lista vazia no disparo com vídeos elegíveis no banco', () => {
    const v = veredictoHorario(prova({ videos_na_lista: 12 }), opcoes({ listaDoDisparo: 0 }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['a leitura horária montou lista vazia com 12 vídeos elegíveis'])
    // lista não medida (nulo) não acusa
    expect(veredictoHorario(prova({ videos_na_lista: 12 }), opcoes({ listaDoDisparo: null })).problems).toEqual([])
  })

  it('desligada: uma nota e nenhum problema', () => {
    const ruim = prova({ desde: null, ultima_leitura: atras(9 * H), proprios_em_competitor: 3, videos_abaixo_do_lido: 9, proprios_cobrados: 4 })
    const v = veredictoHorario(ruim, opcoes({ ligada: false, listaDoDisparo: 0 }))
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toEqual(['leitura horária desligada'])
    expect(v.avisos).toEqual([])
    // desligada com prova que nem veio: também só a nota
    expect(veredictoHorario(null, opcoes({ ligada: false })).problems).toEqual([])
  })

  it('fora do teto, sem captura e sem status são notas com o número', () => {
    const v = veredictoHorario(prova({ videos_fora_do_teto: 15, proprios_sem_captura: 2 }), opcoes({ semStatusNoDisparo: 1 }))
    expect(v.ok).toBe(true)
    expect(v.notes).toHaveLength(3)
    expect(v.notes.join('|')).toMatch(/15 vídeos fora do teto de 25 por canal/)
    expect(v.notes.join('|')).toMatch(/2 vídeos do seu canal fora da prova: sem captura de privacidade há 3 dias/)
    expect(v.notes.join('|')).toMatch(/1 vídeo do seu canal não foi gravado: a resposta do YouTube veio sem o estado de privacidade/)
  })

  it('a nota do teto do dono diz que a conta inclui privados e não listados', () => {
    const v = veredictoHorario(prova({ proprios_fora_do_teto: 4 }), opcoes())
    expect(v.ok).toBe(true)
    expect(v.notes).toHaveLength(1)
    expect(v.notes[0]).toMatch(/4 vídeos do seu canal fora do teto de 25/)
    expect(v.notes[0]).toMatch(/privados e não listados/)
  })

  it('vídeo do dono negado há 5 horas não sobe', () => {
    const v = veredictoHorario(donoParado(), opcoes({ negadosDoDono: 1 }))
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.avisos).toEqual([])
    expect(v.notes).toHaveLength(1)
    expect(v.notes[0]).toMatch(/^1 vídeo do seu canal saiu do ar/)
  })

  it('vídeo do dono público, sem leitura e não negado sobe', () => {
    const v = veredictoHorario(donoParado(), opcoes({ negadosDoDono: 0 }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual([
      'leitura horária do seu canal parada há 5 h',
      '1 vídeo do seu canal com leituras faltando nas últimas 24 horas',
    ])
    expect(v.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
  })

  it('negado numa hora e de volta na seguinte', () => {
    const volta = prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 1, proprios_ultima_leitura: atras(10 * MIN) })
    const a = veredictoHorario(volta, opcoes({ negadosDoDono: 1 }))
    expect(a.ok).toBe(true)
    expect(a.notes).toHaveLength(1)
    expect(a.notes[0]).toMatch(/saiu do ar/)
    // a execução que o negou e o buraco saíram da janela juntos
    const b = veredictoHorario(prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 0, proprios_ultima_leitura: atras(10 * MIN) }), opcoes({ negadosDoDono: 0 }))
    expect(b.ok).toBe(true)
    expect(b.notes).toEqual([])
  })

  it('o desconto não esconde outro vídeo com leitura faltando', () => {
    const v = veredictoHorario(prova({ proprios_cobrados: 3, proprios_abaixo_do_lido: 3, proprios_ultima_leitura: atras(10 * MIN) }), opcoes({ negadosDoDono: 1 }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['2 vídeos do seu canal com leituras faltando nas últimas 24 horas'])
  })

  it('sem o estado de privacidade na resposta continua acusando', () => {
    const v = veredictoHorario(prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 1, proprios_ultima_leitura: atras(10 * MIN) }), opcoes({ negadosDoDono: 0, semStatusNoDisparo: 1 }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['1 vídeo do seu canal com leituras faltando nas últimas 24 horas'])
    expect(v.notes.join('|')).toMatch(/1 vídeo do seu canal não foi gravado: a resposta do YouTube veio sem o estado de privacidade/)
  })

  it('negados que não puderam ser lidos: sem desconto, com nota', () => {
    const v = veredictoHorario(donoParado(), opcoes({ negadosDoDono: null }))
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual([
      'leitura horária do seu canal parada há 5 h',
      '1 vídeo do seu canal com leituras faltando nas últimas 24 horas',
    ])
    expect(v.avisos.map(a => a.chave)).toEqual(['leitura_horaria_parada'])
    expect(v.notes.join('|')).toMatch(/não foi possível ler quantos vídeos do seu canal foram negados; o alarme do seu canal não desconta nada/)
  })

  it('negados maiores que o acusado não viram número negativo', () => {
    const v = veredictoHorario(prova({ proprios_cobrados: 0, proprios_abaixo_do_lido: 0 }), opcoes({ negadosDoDono: 2 }))
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toHaveLength(1)
    expect(v.notes[0]).toMatch(/^2 vídeos do seu canal saíram do ar/)
  })

  it('rascunho na janela não esconde vídeo público sem leitura', () => {
    // a tarefa negou 2 rascunhos (cobráveis 0): o desconto é 0, os 2 públicos sem leitura continuam acusados
    const base = prova({ proprios_cobrados: 2, proprios_abaixo_do_lido: 2, proprios_ultima_leitura: atras(5 * H) })
    const a = veredictoHorario(base, opcoes({ negadosDoDono: 0, negadosSemClasse: 0 }))
    expect(a.ok).toBe(false)
    expect(a.problems).toEqual([
      'leitura horária do seu canal parada há 5 h',
      '2 vídeos do seu canal com leituras faltando nas últimas 24 horas',
    ])
    expect(a.avisos.map(x => x.chave)).toEqual(['leitura_horaria_parada'])
    expect(a.notes.join('|')).not.toMatch(/saíram do ar|saiu do ar/)
    const b = veredictoHorario(base, opcoes({ negadosDoDono: 0, negadosSemClasse: 2 }))
    expect(b.problems).toEqual(a.problems)
    expect(b.notes).toHaveLength(1)
    expect(b.notes[0]).toBe('2 vídeos do seu canal foram negados e não foi possível conferir a captura deles; o alarme do seu canal não os desconta')
  })

  it('negados sem classe nunca descontam, nem somados aos cobráveis', () => {
    const v = veredictoHorario(prova({ proprios_cobrados: 3, proprios_abaixo_do_lido: 3, proprios_ultima_leitura: atras(10 * MIN) }), opcoes({ negadosDoDono: 1, negadosSemClasse: 2 }))
    expect(v.problems).toEqual(['2 vídeos do seu canal com leituras faltando nas últimas 24 horas'])
    expect(v.notes.join('|')).toMatch(/2 vídeos do seu canal foram negados e não foi possível conferir/)
    expect(v.notes.join('|')).toMatch(/1 vídeo do seu canal saiu do ar/)
  })

  it('a agenda nova não cobra o dono em 25 h, e a agenda de 26 h cobra', () => {
    const p = prova({ proprios_cobrados: 1, proprios_abaixo_do_lido: 1, proprios_ultima_leitura: atras(10 * MIN) })
    expect(veredictoHorario(p, opcoes({ agendaDesde: atras(24 * H) })).problems).toEqual([])
    expect(veredictoHorario(p, opcoes({ agendaDesde: atras(26 * H) })).problems).toHaveLength(1)
  })
})

// ───────── lerNegadosDoDono ─────────

type Chamada = [string, ...unknown[]]
/** Um cliente falso que registra a cadeia da consulta e devolve `resposta` (ou lança o que ela lançar) ao ser aguardado. */
function fakeRuns(resposta: unknown | (() => unknown)) {
  const chamadas: Chamada[] = []
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gt', 'limit', 'abortSignal', 'order']) {
    b[m] = (...a: unknown[]) => { chamadas.push([m, ...a]); return b }
  }
  b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
    Promise.resolve().then(() => (typeof resposta === 'function' ? (resposta as () => unknown)() : resposta)).then(ok, ko)
  const sb = comoSb({ from: (t: string) => { chamadas.push(['from', t]); return b } })
  return { sb, chamadas }
}
const linhasDe = (...detalhes: Array<Record<string, unknown> | null | undefined>) =>
  ({ data: detalhes.map((detail, i) => ({ period_key: `h${i}`, detail })), error: null })

describe('lerNegadosDoDono', () => {
  afterEach(() => { vi.useRealTimers() })

  it('lerNegadosDoDono: o máximo das execuções, não a soma', async () => {
    const cinco = fakeRuns(linhasDe(...Array.from({ length: 5 }, () => ({ proprios_negados_cobraveis: 1, proprios_negados_sem_classe: 0 }))))
    expect(await lerNegadosDoDono(cinco.sb, iso(NOW))).toEqual({ valor: { negados: 1, semClasse: 0 } })
    const maior = fakeRuns(linhasDe(
      { proprios_negados_cobraveis: 1, proprios_negados_sem_classe: 0 },
      { proprios_negados_cobraveis: 2, proprios_negados_sem_classe: 3 },
      { proprios_negados_cobraveis: 1, proprios_negados_sem_classe: 1 },
    ))
    expect(await lerNegadosDoDono(maior.sb, iso(NOW))).toEqual({ valor: { negados: 2, semClasse: 3 } })
    // os dois contadores antigos não são lidos
    const antigos = fakeRuns(linhasDe(
      { proprios_fora_nao_publico: 3, proprios_nao_devolvidos: 2 },
      { proprios_fora_nao_publico: 3, proprios_nao_devolvidos: 2, proprios_fora_sem_status: 4 },
    ))
    expect(await lerNegadosDoDono(antigos.sb, iso(NOW))).toEqual({ valor: { negados: 0, semClasse: 0 } })
  })

  it('lerNegadosDoDono: só as 24 horas, só a tarefa pedida, campo ausente é 0', async () => {
    const f = fakeRuns(linhasDe(null, undefined, {}, { proprios_negados_cobraveis: 1 }, { proprios_negados_sem_classe: 2 }, { proprios_negados_cobraveis: null }))
    expect(await lerNegadosDoDono(f.sb, iso(NOW))).toEqual({ valor: { negados: 1, semClasse: 2 } })
    expect(f.chamadas).toContainEqual(['from', 'competitor_agenda_runs'])
    expect(f.chamadas).toContainEqual(['eq', 'task', 'leitura_horaria'])
    expect(f.chamadas).toContainEqual(['gt', 'started_at', iso(NOW - 24 * H)])
    const sel = f.chamadas.find(c => c[0] === 'select')!
    expect(String(sel[1])).toMatch(/period_key/)
    expect(String(sel[1])).toMatch(/detail/)
    expect(f.chamadas).toContainEqual(['limit', 25])
    // o nome da tarefa passado é o da consulta
    const g = fakeRuns({ data: [], error: null })
    expect(await lerNegadosDoDono(g.sb, iso(NOW), 'teste-abc')).toEqual({ valor: { negados: 0, semClasse: 0 } })
    expect(g.chamadas).toContainEqual(['eq', 'task', 'teste-abc'])
  })

  it('lerNegadosDoDono: resposta nula, fora da forma, erro ou exceção são "não li"', async () => {
    const casos: Array<[string, unknown]> = [
      ['nula', null],
      ['indefinida', undefined],
      ['dados nulos', { data: null, error: null }],
      ['dados que não são lista', { data: { period_key: 'h', detail: {} }, error: null }],
      ['linha que não é objeto', { data: [7], error: null }],
      ['detalhe que não é objeto', { data: [{ period_key: 'h', detail: 'texto' }], error: null }],
      ['campo com texto', { data: [{ period_key: 'h', detail: { proprios_negados_cobraveis: '1' } }], error: null }],
      ['campo negativo', { data: [{ period_key: 'h', detail: { proprios_negados_sem_classe: -1 } }], error: null }],
      ['campo não inteiro', { data: [{ period_key: 'h', detail: { proprios_negados_cobraveis: 1.5 } }], error: null }],
      ['erro do banco', { data: null, error: { message: SENTINELA, code: '57014' } }],
      ['abortado', { data: null, error: { message: 'AbortError: ' + SENTINELA, code: '' } }],
      ['erro com dados juntos', { data: [], error: { message: SENTINELA, code: '' } }],
      ['lança', () => { throw new Error(SENTINELA) }],
    ]
    for (const [nome, resp] of casos) {
      const f = fakeRuns(resp)
      const r = await lerNegadosDoDono(f.sb, iso(NOW))
      expect(r, nome).toHaveProperty('porque')
      const porque = (r as { porque: string }).porque
      expect(porque.length, nome).toBeGreaterThan(10)
      expect(porque, nome).not.toContain(SENTINELA)
      // a consulta leva abortSignal de BANCO_MS
      const sig = f.chamadas.find(c => c[0] === 'abortSignal')?.[1]
      expect(sig, nome).toBeInstanceOf(AbortSignal)
    }
    // instante ilegível: nem consulta
    const g = fakeRuns({ data: [], error: null })
    expect(await lerNegadosDoDono(g.sb, 'não é data')).toHaveProperty('porque')
    expect(g.chamadas).toEqual([])
  })

  it('a consulta que nunca volta não segura o fecho: passa de BANCO_MS e vira "não li"', async () => {
    vi.useFakeTimers()
    const f = fakeRuns(() => new Promise(() => undefined))
    // o falso devolve uma promessa pendente dentro do `then`: a leitura só termina pelo prazo
    const pendente = lerNegadosDoDono(f.sb, iso(NOW))
    await vi.advanceTimersByTimeAsync(BANCO_MS + 1)
    expect(await pendente).toHaveProperty('porque')
  })
})
