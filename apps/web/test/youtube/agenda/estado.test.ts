// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  lerEstado, tomarArrendamento, soltarArrendamento, tomar, fechar, adiar, esgotar,
} from '@/lib/youtube/agenda/estado'
import { ARRENDAMENTO_TTL_S, BANCO_MS } from '@/lib/youtube/agenda/relogio'

type Resposta = { data: unknown; error: { message: string; code: string } | null }
interface Chamada { fn: string; args: Record<string, unknown>; sinal: AbortSignal | undefined }

/** Cliente falso: `rpc(fn, args).abortSignal(sinal)` devolve a promessa da resposta, como o do supabase-js. */
function falso(responder: (fn: string, args: Record<string, unknown>) => Resposta | Promise<Resposta>) {
  const chamadas: Chamada[] = []
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => ({
    abortSignal: (sinal?: AbortSignal) => {
      chamadas.push({ fn, args, sinal })
      return Promise.resolve(responder(fn, args))
    },
  }))
  const sb = { rpc } as unknown as SupabaseClient
  return { sb, rpc, chamadas }
}
function quemLanca(erro: unknown) {
  const rpc = vi.fn(() => { throw erro })
  return { sb: { rpc } as unknown as SupabaseClient, rpc }
}

const PARES = [{ task: 'leitura_horaria', period_key: '2026-10-12T21' }, { task: 'serie_semanal', period_key: '2026-10-12' }]
function linha(par: { task: string; period_key: string }, o: Record<string, unknown> = {}) {
  return {
    task: par.task, period_key: par.period_key, status: null, attempts: null, runs: null, unfinished_n: null,
    started_at: null, finished_at: null, done_n: null, left_n: null, reason: null,
    last_ok_at: null, last_run_status: null, last_run_done_n: null, ...o,
  }
}
const estadoBom = (tarefas: unknown[] = PARES.map(p => linha(p))) => ({ agora: new Date().toISOString(), desde: null, tarefas })
const semPortugues = (s: string) => expect(s).toMatch(/[a-zç]{3,}/i)

// As sete funções, cada uma com a chamada que a exercita e a resposta boa.
const FUNCOES: Array<{ nome: string; rpc: string; boa: unknown; chamar: (sb: SupabaseClient) => Promise<unknown> }> = [
  { nome: 'lerEstado', rpc: 'competitor_agenda_state', boa: estadoBom(), chamar: sb => lerEstado(sb, PARES) },
  { nome: 'tomarArrendamento', rpc: 'competitor_agenda_lease_take', boa: true, chamar: sb => tomarArrendamento(sb, 'h1') },
  { nome: 'tomar', rpc: 'competitor_agenda_claim', boa: true, chamar: sb => tomar(sb, { task: 't', period_key: 'p', teto: 3, reabrir: false }) },
  { nome: 'fechar', rpc: 'competitor_agenda_finish', boa: true, chamar: sb => fechar(sb, { task: 't', period_key: 'p', estado: 'ok', feitas: 1, deixadas: null, ms: 10 }) },
  { nome: 'esgotar', rpc: 'competitor_agenda_exhaust', boa: true, chamar: sb => esgotar(sb, { task: 't', period_key: 'p', teto: 3 }) },
]

describe.each(FUNCOES)('$nome: nenhum caminho devolve valor sem ter lido', ({ rpc, boa, chamar }) => {
  it('resposta boa: devolve o valor, com o sinal de prazo do banco', async () => {
    const f = falso(() => ({ data: boa, error: null }))
    const r = await chamar(f.sb)
    expect(r).toHaveProperty('valor')
    expect(f.chamadas).toHaveLength(1)
    expect(f.chamadas[0].fn).toBe(rpc)
    expect(f.chamadas[0].sinal).toBeInstanceOf(AbortSignal)
  })

  it('função ausente (PGRST202) é schema ausente, nunca ok', async () => {
    const f = falso(() => ({ data: null, error: { message: 'Could not find the function public.sentinela', code: 'PGRST202' } }))
    const r = await chamar(f.sb)
    expect(r).not.toHaveProperty('valor')
    const porque = (r as { porque: string }).porque
    expect(porque).toContain('PGRST202')
    expect(porque).toMatch(/migration|não aplicada/)
    expect(porque).not.toContain('sentinela')
  })

  it('42883 (função do Postgres) também é schema ausente', async () => {
    const f = falso(() => ({ data: null, error: { message: 'function sentinela does not exist', code: '42883' } }))
    const r = await chamar(f.sb) as { porque: string }
    expect(r.porque).toContain('42883')
    expect(r.porque).toMatch(/migration|não aplicada/)
    expect(r.porque).not.toContain('sentinela')
  })

  it('resposta nula não é valor', async () => {
    const f = falso(() => ({ data: null, error: null }))
    const r = await chamar(f.sb)
    expect(r).not.toHaveProperty('valor')
    semPortugues((r as { porque: string }).porque)
  })

  it('resposta de forma errada (lista, texto, número) não é valor', async () => {
    for (const data of [[], ['x'], 'texto', 42, {}, { sentinela: 1 }]) {
      const f = falso(() => ({ data, error: null }))
      const r = await chamar(f.sb)
      expect(r, JSON.stringify(data)).not.toHaveProperty('valor')
      expect((r as { porque: string }).porque).not.toContain('sentinela')
    }
  })

  it('erro do banco: o porque leva o código e não leva o texto do erro', async () => {
    const f = falso(() => ({ data: null, error: { message: 'Failing row contains (sentinela)', code: '23514' } }))
    const r = await chamar(f.sb) as { porque: string }
    expect(r.porque).toContain('23514')
    expect(r.porque).not.toContain('sentinela')
    expect(r.porque).not.toContain('Failing')
  })

  it('rpc abortado pelo prazo: o cliente não lança, devolve AbortError sem código', async () => {
    const f = falso(() => ({ data: null, error: { message: 'AbortError: The operation was aborted due to timeout sentinela', code: '' } }))
    const r = await chamar(f.sb) as { porque: string }
    expect(r).not.toHaveProperty('valor')
    expect(r.porque).toContain('o banco não respondeu')
    expect(r.porque).not.toContain('sentinela')
  })

  it('exceção (assíncrona ou na montagem da chamada): não propaga, não vaza o texto', async () => {
    const assinc = falso(() => { throw new Error('texto sentinela') })
    const a = await chamar(assinc.sb) as { porque: string }
    expect(a).not.toHaveProperty('valor')
    expect(a.porque).not.toContain('sentinela')
    const sinc = quemLanca(new Error('texto sentinela'))
    const b = await chamar(sinc.sb) as { porque: string }
    expect(b).not.toHaveProperty('valor')
    expect(b.porque).not.toContain('sentinela')
    expect(b.porque).toContain('o banco não respondeu')
  })
})

describe('estado', () => {
  it('estado: resposta nula, lista, texto, erro e exceção são "não li"', async () => {
    const formas: Array<() => Resposta> = [
      () => ({ data: null, error: null }),
      () => ({ data: [], error: null }),
      () => ({ data: 'texto', error: null }),
      () => ({ data: null, error: { message: 'x', code: '57014' } }),
      () => { throw new Error('boom') },
    ]
    for (const forma of formas) {
      const r = await lerEstado(falso(forma).sb, PARES)
      expect('porque' in r).toBe(true)
      expect('valor' in r).toBe(false)
      semPortugues((r as { porque: string }).porque)
    }
    const r = await lerEstado(falso(() => ({ data: null, error: { message: 'x', code: '57014' } })).sb, PARES)
    expect(r).toMatchObject({ porque: 'erro do banco (código 57014)' })
    expect(await lerEstado(falso(() => ({ data: null, error: null })).sb, PARES)).toMatchObject({ porque: 'o banco não respondeu' })
    expect(await lerEstado(falso(() => ({ data: [], error: null })).sb, PARES)).toMatchObject({ porque: 'resposta fora da forma esperada' })
  })

  it('estado: manda as duas listas na mesma ordem dos pares', async () => {
    const f = falso(() => ({ data: estadoBom(), error: null }))
    await lerEstado(f.sb, PARES)
    expect(f.chamadas[0].args).toEqual({ p_tasks: ['leitura_horaria', 'serie_semanal'], p_period_keys: ['2026-10-12T21', '2026-10-12'] })
  })

  it('estado: falta uma tarefa pedida', async () => {
    const f = falso(() => ({ data: estadoBom([linha(PARES[0])]), error: null }))
    expect(await lerEstado(f.sb, PARES)).toMatchObject({ porque: 'resposta fora da forma esperada' })
    const sobra = falso(() => ({ data: estadoBom([linha(PARES[0]), linha(PARES[1]), linha(PARES[1])]), error: null }))
    expect('porque' in await lerEstado(sobra.sb, PARES)).toBe(true)
  })

  it('estado: entradas fora de ordem ou de outro par não valem', async () => {
    const trocada = falso(() => ({ data: estadoBom([linha(PARES[1]), linha(PARES[0])]), error: null }))
    expect('porque' in await lerEstado(trocada.sb, PARES)).toBe(true)
    const outro = falso(() => ({ data: estadoBom([linha(PARES[0]), linha({ task: 'serie_semanal', period_key: 'outra' })]), error: null }))
    expect('porque' in await lerEstado(outro.sb, PARES)).toBe(true)
  })

  it('estado: tarefa sem linha tem status nulo', async () => {
    const f = falso(() => ({ data: estadoBom(), error: null }))
    const r = await lerEstado(f.sb, PARES)
    if (!('valor' in r)) throw new Error('devia ter lido')
    expect(r.valor.tarefas).toHaveLength(2)
    for (const t of r.valor.tarefas) {
      expect(t.status).toBeNull()
      expect(t.attempts).toBeNull()
      expect(t.runs).toBeNull()
      expect(t.unfinished_n).toBeNull()
      expect(t.done_n).toBeNull()
      expect(t.left_n).toBeNull()
      expect(t.last_ok_at).toBeNull()
    }
    expect(r.valor.desde).toBeNull()
  })

  it('estado: linha completa é lida campo a campo', async () => {
    const agora = new Date().toISOString()
    const completa = linha(PARES[0], {
      status: 'parcial', attempts: 2, runs: 3, unfinished_n: 1, started_at: agora, finished_at: agora,
      done_n: 5, left_n: 7, reason: 'sobrou', last_ok_at: agora, last_run_status: 'parcial', last_run_done_n: 5,
    })
    const f = falso(() => ({ data: { agora, desde: agora, tarefas: [completa, linha(PARES[1])] }, error: null }))
    const r = await lerEstado(f.sb, PARES)
    if (!('valor' in r)) throw new Error('devia ter lido')
    expect(r.valor.agora).toBe(agora)
    expect(r.valor.desde).toBe(agora)
    expect(r.valor.tarefas[0]).toEqual(completa)
  })

  it('estado: todos os seis status do banco passam', async () => {
    for (const status of ['rodando', 'ok', 'parcial', 'adiada', 'erro', 'esgotada']) {
      const f = falso(() => ({ data: estadoBom([linha(PARES[0], { status }), linha(PARES[1])]), error: null }))
      const r = await lerEstado(f.sb, PARES)
      expect('valor' in r, status).toBe(true)
    }
  })

  it('estado: status desconhecido', async () => {
    for (const status of ['feito', '', 7, true]) {
      const f = falso(() => ({ data: estadoBom([linha(PARES[0], { status }), linha(PARES[1])]), error: null }))
      expect(await lerEstado(f.sb, PARES), String(status)).toMatchObject({ porque: 'resposta fora da forma esperada' })
    }
  })

  it('estado: contador que não é inteiro ou nulo, e chave faltando, são "não li"', async () => {
    const ruins: Array<Record<string, unknown>> = [
      { attempts: '2' }, { attempts: 2.5 }, { runs: NaN }, { unfinished_n: true }, { done_n: 'x' }, { left_n: {} },
      { last_run_done_n: 1.5 }, { started_at: 5 }, { reason: 7 }, { last_ok_at: 'ontem de manhã' }, { agora: 1 },
    ]
    for (const o of ruins) {
      const alvo = 'agora' in o ? {} : o
      const dados = { ...estadoBom([linha(PARES[0], alvo), linha(PARES[1])]), ...('agora' in o ? o : {}) }
      const r = await lerEstado(falso(() => ({ data: dados, error: null })).sb, PARES)
      expect('porque' in r, JSON.stringify(o)).toBe(true)
    }
    const semChave = linha(PARES[0]) as Record<string, unknown>
    delete semChave.last_run_status
    const r = await lerEstado(falso(() => ({ data: estadoBom([semChave, linha(PARES[1])]), error: null })).sb, PARES)
    expect('porque' in r).toBe(true)
    const semTarefas = await lerEstado(falso(() => ({ data: { agora: new Date().toISOString(), desde: null }, error: null })).sb, PARES)
    expect('porque' in semTarefas).toBe(true)
    const semDesde = await lerEstado(falso(() => ({ data: { agora: new Date().toISOString(), tarefas: [linha(PARES[0]), linha(PARES[1])] }, error: null })).sb, PARES)
    expect('porque' in semDesde).toBe(true)
  })
})

describe('arrendamento', () => {
  it('toma com o nome do despachante, o holder e a validade em segundos', async () => {
    const f = falso(() => ({ data: true, error: null }))
    expect(await tomarArrendamento(f.sb, 'abc')).toEqual({ valor: true })
    expect(f.chamadas[0].args).toEqual({ p_name: 'despachante', p_holder: 'abc', p_ttl: `${ARRENDAMENTO_TTL_S} seconds` })
  })

  it('tomarArrendamento: true, false e erro são três coisas', async () => {
    expect(await tomarArrendamento(falso(() => ({ data: false, error: null })).sb, 'h')).toEqual({ valor: false })
    expect('porque' in await tomarArrendamento(falso(() => ({ data: null, error: { message: 'x', code: '57014' } })).sb, 'h')).toBe(true)
    expect('porque' in await tomarArrendamento(falso(() => ({ data: 't', error: null })).sb, 'h')).toBe(true)
  })

  it('soltar manda nome e holder e resolve com qualquer resposta', async () => {
    const f = falso(() => ({ data: true, error: null }))
    await expect(soltarArrendamento(f.sb, 'abc')).resolves.toBeUndefined()
    expect(f.chamadas[0].fn).toBe('competitor_agenda_lease_release')
    expect(f.chamadas[0].args).toEqual({ p_name: 'despachante', p_holder: 'abc' })
    expect(f.chamadas[0].sinal).toBeInstanceOf(AbortSignal)
    await expect(soltarArrendamento(falso(() => ({ data: null, error: { message: 'x', code: 'PGRST202' } })).sb, 'abc')).resolves.toBeUndefined()
  })

  it('soltar e adiar não lançam', async () => {
    const lanca = quemLanca(new Error('texto sentinela'))
    await expect(soltarArrendamento(lanca.sb, 'h')).resolves.toBeUndefined()
    await expect(adiar(lanca.sb, { task: 't', period_key: 'p', motivo: 'sem_tempo' })).resolves.toBeUndefined()
    const assinc = falso(() => { throw new Error('texto sentinela') })
    await expect(soltarArrendamento(assinc.sb, 'h')).resolves.toBeUndefined()
    await expect(adiar(assinc.sb, { task: 't', period_key: 'p', motivo: 'uma_pesada_por_disparo' })).resolves.toBeUndefined()
    const aborta = falso(() => ({ data: null, error: { message: 'AbortError: x', code: '' } }))
    await expect(adiar(aborta.sb, { task: 't', period_key: 'p', motivo: 'sem_tempo' })).resolves.toBeUndefined()
  })
})

describe('tomar, fechar, adiar, esgotar', () => {
  it('tomar manda tarefa, período, teto, a validade da linha rodando e o reabrir', async () => {
    const f = falso(() => ({ data: true, error: null }))
    await tomar(f.sb, { task: 'leitura_horaria', period_key: '2026-10-12T21', teto: 3, reabrir: true })
    expect(f.chamadas[0].args).toMatchObject({ p_task: 'leitura_horaria', p_period_key: '2026-10-12T21', p_max_attempts: 3, p_reopen: true })
  })

  it('tomar: true, false e erro são três coisas', async () => {
    const t = { task: 't', period_key: 'p', teto: 3, reabrir: false }
    expect(await tomar(falso(() => ({ data: true, error: null })).sb, t)).toEqual({ valor: true })
    expect(await tomar(falso(() => ({ data: false, error: null })).sb, t)).toEqual({ valor: false })
    expect('porque' in await tomar(falso(() => ({ data: null, error: { message: 'x', code: '57014' } })).sb, t)).toBe(true)
  })

  it('tomar: resposta que não é booleano', async () => {
    const t = { task: 't', period_key: 'p', teto: 3, reabrir: false }
    expect('porque' in await tomar(falso(() => ({ data: null, error: null })).sb, t)).toBe(true)
    expect('porque' in await tomar(falso(() => ({ data: 't', error: null })).sb, t)).toBe(true)
    expect('porque' in await esgotar(falso(() => ({ data: 'true', error: null })).sb, { task: 't', period_key: 'p', teto: 3 })).toBe(true)
  })

  it('tomar e esgotar recusam teto que não é inteiro positivo', async () => {
    for (const teto of [undefined, null, 0, -1, NaN, 2.5, Infinity, '3', 40_000]) {
      const f = falso(() => ({ data: true, error: null }))
      const a = await tomar(f.sb, { task: 't', period_key: 'p', teto: teto as never, reabrir: false })
      const b = await esgotar(f.sb, { task: 't', period_key: 'p', teto: teto as never })
      for (const r of [a, b]) {
        expect('porque' in r, String(teto)).toBe(true)
        semPortugues((r as { porque: string }).porque)
      }
      expect(f.rpc, String(teto)).not.toHaveBeenCalled()
    }
  })

  it('esgotar manda o teto e a validade', async () => {
    const f = falso(() => ({ data: true, error: null }))
    expect(await esgotar(f.sb, { task: 'serie_semanal', period_key: '2026-10-12', teto: 9 })).toEqual({ valor: true })
    expect(f.chamadas[0].fn).toBe('competitor_agenda_exhaust')
    expect(f.chamadas[0].args).toMatchObject({ p_task: 'serie_semanal', p_period_key: '2026-10-12', p_max_attempts: 9 })
  })

  it('fechar manda o código e troca texto livre por motivo_invalido', async () => {
    const base = { task: 't', period_key: 'p', estado: 'erro' as const, feitas: 0, deixadas: null, ms: 12 }
    const a = falso(() => ({ data: true, error: null }))
    await fechar(a.sb, { ...base, motivo: 'cota_esgotada' })
    expect(a.chamadas[0].args.p_reason).toBe('cota_esgotada')
    const b = falso(() => ({ data: true, error: null }))
    await fechar(b.sb, { ...base, motivo: 'Key (x)=(UCsentinela)' })
    expect(b.chamadas[0].args.p_reason).toBe('motivo_invalido')
    expect(JSON.stringify(b.chamadas[0].args)).not.toContain('sentinela')
    const c = falso(() => ({ data: true, error: null }))
    await fechar(c.sb, base)
    expect(c.chamadas[0].args.p_reason).toBeNull()
    const d = falso(() => ({ data: true, error: null }))
    await fechar(d.sb, { ...base, motivo: '' })
    expect(d.chamadas[0].args.p_reason).toBe('motivo_invalido')
  })

  it('fechar manda os contadores e o estado; deixadas nulo continua nulo', async () => {
    const f = falso(() => ({ data: true, error: null }))
    expect(await fechar(f.sb, { task: 'leitura_horaria', period_key: '2026-10-12T21', estado: 'parcial', feitas: 4, deixadas: null, ms: 1234.6, motivo: 'sobrou' })).toEqual({ valor: true })
    expect(f.chamadas[0].fn).toBe('competitor_agenda_finish')
    expect(f.chamadas[0].args).toEqual({
      p_task: 'leitura_horaria', p_period_key: '2026-10-12T21', p_status: 'parcial', p_done_n: 4, p_left_n: null,
      p_reason: 'sobrou', p_duration_ms: 1235, p_detail: null,
    })
  })

  it('fechar recusa números impossíveis e estado fora do conjunto, sem chamar o banco', async () => {
    const base = { task: 't', period_key: 'p', estado: 'ok' as const, feitas: 1, deixadas: 0, ms: 10 }
    const ruins = [{ feitas: NaN }, { feitas: -1 }, { feitas: 1.5 }, { ms: NaN }, { ms: -5 }, { deixadas: -2 }, { deixadas: NaN }, { estado: 'esgotada' as never }]
    for (const o of ruins) {
      const f = falso(() => ({ data: true, error: null }))
      const r = await fechar(f.sb, { ...base, ...o })
      expect('porque' in r, JSON.stringify(o)).toBe(true)
      expect(f.rpc, JSON.stringify(o)).not.toHaveBeenCalled()
    }
  })

  it('detalhe com valor que não é número é descartado', async () => {
    const f = falso(() => ({ data: true, error: null }))
    await fechar(f.sb, { task: 't', period_key: 'p', estado: 'ok', feitas: 1, deixadas: 0, ms: 5, detalhe: { a: 1, b: NaN, c: 'x' as never, d: Infinity, e: null as never } })
    expect(f.chamadas[0].args.p_detail).toEqual({ a: 1 })
    const g = falso(() => ({ data: true, error: null }))
    await fechar(g.sb, { task: 't', period_key: 'p', estado: 'ok', feitas: 1, deixadas: 0, ms: 5, detalhe: { x: NaN } })
    expect(g.chamadas[0].args.p_detail).toEqual({})
  })

  it('adiar manda tarefa, período e motivo, e usa o sinal do banco', async () => {
    const f = falso(() => ({ data: true, error: null }))
    await adiar(f.sb, { task: 'serie_semanal', period_key: '2026-10-12', motivo: 'uma_pesada_por_disparo' })
    expect(f.chamadas[0].fn).toBe('competitor_agenda_defer')
    expect(f.chamadas[0].args).toEqual({ p_task: 'serie_semanal', p_period_key: '2026-10-12', p_reason: 'uma_pesada_por_disparo' })
    expect(f.chamadas[0].sinal).toBeInstanceOf(AbortSignal)
  })

  it('o prazo de cada ida é BANCO_MS', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    const f = falso(() => ({ data: true, error: null }))
    await tomarArrendamento(f.sb, 'h')
    expect(espia).toHaveBeenCalledWith(BANCO_MS)
    espia.mockRestore()
  })
})

// ---- a CAUSA da falha (conserto da revisão 5-11-16): o vigia classifica pela causa, nunca pela frase ---------------

describe('causa da falha', () => {
  const ok = (): Resposta => ({ data: true, error: null })
  const CHAMADAS: Array<{ nome: string; chamar: (sb: SupabaseClient) => Promise<unknown> }> = [
    { nome: 'lerEstado', chamar: sb => lerEstado(sb, PARES) },
    { nome: 'tomarArrendamento', chamar: sb => tomarArrendamento(sb, 'h') },
    { nome: 'tomar', chamar: sb => tomar(sb, { task: 't', period_key: 'p', teto: 3, reabrir: false }) },
    { nome: 'esgotar', chamar: sb => esgotar(sb, { task: 't', period_key: 'p', teto: 3 }) },
    { nome: 'fechar', chamar: sb => fechar(sb, { task: 't', period_key: 'p', estado: 'ok', feitas: 1, deixadas: null, ms: 10 }) },
  ]
  const causaDe = (r: unknown): unknown => (r as { causa?: unknown }).causa

  describe.each(CHAMADAS)('$nome', ({ chamar }) => {
    it.each(['PGRST202', 'PGRST205', '42P01', '42883'])('código %s: schema_ausente', async code => {
      expect(causaDe(await chamar(falso(() => ({ data: null, error: { message: 'x', code } })).sb))).toBe('schema_ausente')
    })
    it('AbortError (código vazio, prazo estourado): prazo', async () => {
      expect(causaDe(await chamar(falso(() => ({ data: null, error: { message: 'AbortError', code: '' } })).sb))).toBe('prazo')
    })
    it('código com forma inválida (transporte): prazo', async () => {
      expect(causaDe(await chamar(falso(() => ({ data: null, error: { message: 'fetch failed', code: 'x' } })).sb))).toBe('prazo')
    })
    it('erro do banco com código (permissão, timeout do servidor): erro_do_banco', async () => {
      for (const code of ['42501', '57014', '23514']) {
        expect(causaDe(await chamar(falso(() => ({ data: null, error: { message: 'x', code } })).sb)), code).toBe('erro_do_banco')
      }
    })
    it('exceção (assíncrona ou na montagem): excecao', async () => {
      expect(causaDe(await chamar(falso(() => { throw new Error('boom') }).sb))).toBe('excecao')
      expect(causaDe(await chamar(quemLanca(new Error('boom')).sb))).toBe('excecao')
    })
    it('resposta nula: forma_invalida', async () => {
      expect(causaDe(await chamar(falso(() => ({ data: null, error: null })).sb))).toBe('forma_invalida')
    })
  })

  it('lerEstado: resposta de outra forma é forma_invalida', async () => {
    for (const data of [[], 'texto', { agora: 'x' }, { agora: new Date().toISOString(), desde: null, tarefas: [] }]) {
      expect(causaDe(await lerEstado(falso(() => ({ data, error: null })).sb, PARES))).toBe('forma_invalida')
    }
  })

  it('resposta boa não leva causa', async () => {
    expect(await tomarArrendamento(falso(ok).sb, 'h')).toEqual({ valor: true })
  })

  it('boolean: resposta que não é boolean é forma_invalida', async () => {
    expect(causaDe(await tomar(falso(() => ({ data: 't', error: null })).sb, { task: 't', period_key: 'p', teto: 3, reabrir: false }))).toBe('forma_invalida')
  })

  it('entrada inválida do chamador (teto, contadores do fecho): forma_invalida, sem chamar o banco', async () => {
    const f = falso(ok)
    expect(causaDe(await tomar(f.sb, { task: 't', period_key: 'p', teto: 0, reabrir: false }))).toBe('forma_invalida')
    expect(causaDe(await fechar(f.sb, { task: 't', period_key: 'p', estado: 'ok', feitas: 1.5, deixadas: null, ms: 1 }))).toBe('forma_invalida')
    expect(f.chamadas).toHaveLength(0)
  })

  it('a causa é campo à parte: a frase do porque não mudou', async () => {
    expect(await lerEstado(falso(() => ({ data: null, error: { message: 'x', code: 'PGRST202' } })).sb, PARES))
      .toEqual({ porque: 'migration da agenda não aplicada (código PGRST202)', causa: 'schema_ausente' })
    expect(await lerEstado(falso(() => ({ data: null, error: { message: 'x', code: '' } })).sb, PARES))
      .toEqual({ porque: 'o banco não respondeu', causa: 'prazo' })
    expect(await lerEstado(falso(() => { throw new Error('b') }).sb, PARES))
      .toEqual({ porque: 'o banco não respondeu', causa: 'excecao' })
    expect(await lerEstado(falso(() => ({ data: null, error: { message: 'x', code: '57014' } })).sb, PARES))
      .toEqual({ porque: 'erro do banco (código 57014)', causa: 'erro_do_banco' })
  })
})
