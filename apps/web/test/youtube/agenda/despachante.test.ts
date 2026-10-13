// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { despachar, type OpsAgenda, type ResumoDisparo } from '@/lib/youtube/agenda/despachante'
import type { ContextoTarefa, EstadoAgenda, LinhaTarefa, Lido, ResultadoTarefa, Tarefa } from '@/lib/youtube/agenda/tipos'
import { chaveDoPeriodo } from '@/lib/youtube/agenda/periodo'
import { CATALOGO, DEFINICOES } from '@/lib/youtube/agenda/catalogo'
import { LEVE_COMECA_ATE_MS, LIMITE_FUNCAO_MS } from '@/lib/youtube/agenda/relogio'

// Um dia fixo no passado serve de âncora; o que importa é a hora do relógio de São Paulo (UTC−3).
const DIA0 = Date.UTC(2026, 9, 12)
const sp = (h: number, m = 0, s = 0) => DIA0 + (h + 3) * 3_600_000 + m * 60_000 + s * 1000

afterEach(() => { vi.useRealTimers() })

// ---- fábricas ----------------------------------------------------------------------------------------------------

const okPadrao = async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: 1, deixadas: 0 })

function tarefa(nome: string, ordem: number, over: Partial<Tarefa> = {}): Tarefa {
  return {
    nome, rotulo: nome.replace(/_/g, ' '), ordem, peso: 'leve', periodo: 'dia',
    tetoTentativas: 5, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
    comecaAteMs: 70_000, fimAteMs: 85_000,
    motivos: { sobrou: 'ficaram itens para o próximo disparo', lote_em_erro: 'o lote falhou' },
    rodar: okPadrao,
    ...over,
  }
}
const sempre = (nome: string, ordem: number, over: Partial<Tarefa> = {}) =>
  tarefa(nome, ordem, { peso: 'sempre', periodo: 'hora', comecaAteMs: 22_000, fimAteMs: 60_000, tetoTentativas: 3, naoTerminouVermelhoEm: 3, ...over })
const pesada = (nome: string, ordem: number, over: Partial<Tarefa> = {}) =>
  tarefa(nome, ordem, { peso: 'pesada', comecaAteMs: 200_000, fimAteMs: 285_000, ...over })

/** O catálogo completo de mentira: as oito tarefas do spec, com os pesos de 4.8.2. */
function catalogoCompleto(): Tarefa[] {
  return [
    sempre('leitura_horaria', 1),
    tarefa('anular_identidade', 2, { aPartirDaHoraSP: 3 }),
    tarefa('soma_do_mapa', 3, { aPartirDaHoraSP: 4 }),
    tarefa('tamanho_do_banco', 4, { aPartirDaHoraSP: 5 }),
    tarefa('podas', 5, { aPartirDaHoraSP: 5 }),
    pesada('sincronizar_canais', 6, { periodo: 'faixa', tetoTentativas: 9, naoTerminouVermelhoEm: 6 }),
    pesada('retratos_comentarios', 7, { aPartirDaHoraSP: 13, cedeA: ['sincronizar_canais'] }),
    pesada('serie_semanal', 8, { aPartirDaHoraSP: 12, tetoTentativas: 12, cedeA: ['sincronizar_canais', 'retratos_comentarios'] }),
  ]
}

/** O catálogo desta ordem: as três definições reais, com `rodar` falso. */
function catalogoDestaOrdem(): Tarefa[] {
  return DEFINICOES.map(d => ({ ...d, rodar: okPadrao }))
}

function linha(t: Pick<Tarefa, 'nome' | 'periodo'>, t0: number, over: Partial<LinhaTarefa> = {}): LinhaTarefa {
  return {
    task: t.nome, period_key: chaveDoPeriodo(t.periodo, t0), status: null, attempts: null, runs: null, unfinished_n: null,
    started_at: null, finished_at: null, done_n: null, left_n: null, reason: null,
    last_ok_at: null, last_run_status: null, last_run_done_n: null, ...over,
  }
}
const estadoDe = (linhas: LinhaTarefa[], t0: number): Lido<EstadoAgenda> =>
  ({ valor: { agora: new Date(t0).toISOString(), desde: null, tarefas: linhas } })

interface Chamada { nome: string; em: number }
interface Montagem {
  catalogo: Tarefa[]; t0: number; estado?: Lido<EstadoAgenda>; desligadas?: string[]
  tomar?: OpsAgenda['tomar']; esgotar?: OpsAgenda['esgotar']; fechar?: OpsAgenda['fechar']
  linhas?: ContextoTarefa['linhas']
}

function montar(o: Montagem) {
  const relogio = { agora: o.t0 }
  const chamadas: Chamada[] = []
  const catalogo = o.catalogo.map(t => ({
    ...t,
    rodar: (c: ContextoTarefa) => { chamadas.push({ nome: t.nome, em: relogio.agora }); return t.rodar(c) },
  }))
  const ops = {
    tomar: vi.fn<OpsAgenda['tomar']>(o.tomar ?? (async () => ({ valor: true }))),
    fechar: vi.fn<OpsAgenda['fechar']>(o.fechar ?? (async () => ({ valor: true }))),
    adiar: vi.fn<OpsAgenda['adiar']>(async () => undefined),
    esgotar: vi.fn<OpsAgenda['esgotar']>(o.esgotar ?? (async () => ({ valor: false }))),
    relatar: vi.fn<OpsAgenda['relatar']>(),
  }
  const agora = () => relogio.agora
  const contexto: ContextoTarefa = { t0: o.t0, agora, apiKey: 'chave', sb: {} as SupabaseClient, linhas: o.linhas ?? null }
  const rodar = (): Promise<ResumoDisparo> => despachar({
    catalogo, desligadas: new Set(o.desligadas ?? []), t0: o.t0, agora,
    estado: o.estado ?? estadoDe([], o.t0), contexto, ops,
  })
  return { relogio, chamadas, ops, rodar }
}
const nomes = (cs: Chamada[]) => cs.map(c => c.nome)
const final = (r: ResumoDisparo, nome: string) => {
  const f = r.tarefas.find(t => t.tarefa === nome)
  if (!f) throw new Error(`sem resumo para ${nome}`)
  return f
}

// ---- a regra do período ----------------------------------------------------------------------------------------

describe('despachante: quem é devido', () => {
  it('com ok no período, não roda; sem a linha, roda (hora, faixa e dia)', async () => {
    const t0 = sp(14, 40)
    const cat = [
      tarefa('por_hora', 1, { periodo: 'hora' }),
      tarefa('por_faixa', 2, { periodo: 'faixa' }),
      tarefa('por_dia', 3, { periodo: 'dia' }),
    ]
    const com = montar({ catalogo: cat, t0, estado: estadoDe(cat.map(t => linha(t, t0, { status: 'ok', runs: 1 })), t0) })
    const r1 = await com.rodar()
    expect(com.chamadas).toEqual([])
    expect(com.ops.tomar).not.toHaveBeenCalled()
    expect(r1.tarefas.map(t => t.estado)).toEqual(['nao_devida', 'nao_devida', 'nao_devida'])
    expect(r1.problemas).toEqual([])

    const sem = montar({ catalogo: cat, t0, estado: estadoDe([], t0) })
    await sem.rodar()
    expect(nomes(sem.chamadas)).toEqual(['por_hora', 'por_faixa', 'por_dia'])
    expect(sem.ops.tomar).toHaveBeenCalledTimes(3)
  })

  it('disparo pulado: o seguinte, 20 min adiante na mesma hora, acha a tarefa devida', async () => {
    const t0 = sp(14, 20)
    const horaria = sempre('leitura_horaria', 1)
    // a linha `ok` é da hora ANTERIOR (13h): a das 14h não existe porque o disparo do minuto 0 não rodou
    const anterior = { ...linha(horaria, sp(13, 0), { status: 'ok', runs: 1 }) }
    const m = montar({ catalogo: [horaria], t0, estado: estadoDe([anterior], t0) })
    await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria'])
    expect(m.ops.tomar).toHaveBeenCalledWith({ task: 'leitura_horaria', period_key: '2026-10-12T14', teto: 3, reabrir: false })
  })

  it('fora do horário não é devida nem adiada (serie_semanal às 11:59 e às 12:00)', async () => {
    const cat = [tarefa('serie_semanal', 1, { aPartirDaHoraSP: 12 })]
    const antes = montar({ catalogo: cat, t0: sp(11, 59, 59) })
    const r = await antes.rodar()
    expect(final(r, 'serie_semanal').estado).toBe('nao_devida')
    expect(antes.ops.adiar).not.toHaveBeenCalled()
    expect(antes.ops.tomar).not.toHaveBeenCalled()
    expect(r.problemas).toEqual([])

    const depois = montar({ catalogo: cat, t0: sp(12, 0, 0) })
    await depois.rodar()
    expect(nomes(depois.chamadas)).toEqual(['serie_semanal'])
  })

  it('devida pelo dado reabre o ok (desvio 3)', async () => {
    const t0 = sp(13, 0)
    const devidaPeloDado = vi.fn(() => true)
    const t = tarefa('com_dado', 1, { devidaPeloDado })
    const m = montar({ catalogo: [t], t0, estado: estadoDe([linha(t, t0, { status: 'ok', runs: 1 })], t0), linhas: [] })
    await m.rodar()
    expect(m.ops.tomar).toHaveBeenCalledWith({ task: 'com_dado', period_key: '2026-10-12', teto: 5, reabrir: true })
    expect(devidaPeloDado).toHaveBeenCalledWith({ linhas: [], agora: expect.any(Function) })
    expect(nomes(m.chamadas)).toEqual(['com_dado'])
  })

  it('ok no período e o dado diz que não: não roda; o dado só é consultado quando a linha é ok', async () => {
    const t0 = sp(13, 0)
    const devidaPeloDado = vi.fn(() => false)
    const t = tarefa('com_dado', 1, { devidaPeloDado })
    const ok = montar({ catalogo: [t], t0, estado: estadoDe([linha(t, t0, { status: 'ok' })], t0) })
    expect(final(await ok.rodar(), 'com_dado').estado).toBe('nao_devida')
    expect(devidaPeloDado).toHaveBeenCalledTimes(1)
    const sem = montar({ catalogo: [t], t0, estado: estadoDe([], t0) })
    await sem.rodar()
    expect(devidaPeloDado).toHaveBeenCalledTimes(1) // linha nula já é devida: sem consulta
    expect(sem.ops.tomar).toHaveBeenCalledWith(expect.objectContaining({ reabrir: false }))
  })

  it('devidaPeloDado que lança: não roda, vira nota, e o texto do erro não sai', async () => {
    const t0 = sp(13, 0)
    const t = tarefa('com_dado', 1, { devidaPeloDado: () => { throw new Error('Failing row contains (UCsentinela)') } })
    const m = montar({ catalogo: [t, tarefa('outra', 2)], t0, estado: estadoDe([linha(t, t0, { status: 'ok' })], t0) })
    const r = await m.rodar()
    expect(final(r, 'com_dado').estado).toBe('nao_devida')
    expect(r.notas.join('|')).toContain('com dado')
    expect(JSON.stringify(r)).not.toContain('sentinela')
    expect(nomes(m.chamadas)).toEqual(['outra'])
  })

  it('tarefa desligada não roda e aparece como desligada (item 211)', async () => {
    const t0 = sp(14, 40)
    const m = montar({ catalogo: [sempre('leitura_horaria', 1), tarefa('outra', 2)], t0, desligadas: ['leitura_horaria'] })
    const r = await m.rodar()
    expect(final(r, 'leitura_horaria').estado).toBe('desligada')
    expect(m.ops.tomar).toHaveBeenCalledTimes(1)
    expect(m.ops.tomar).toHaveBeenCalledWith(expect.objectContaining({ task: 'outra' }))
    expect(nomes(m.chamadas)).toEqual(['outra'])
  })
})

// ---- a ordem e a vaga da pesada --------------------------------------------------------------------------------

describe('despachante: ordem e pesadas', () => {
  it('a leitura horária é sempre a primeira (item 155)', async () => {
    const m = montar({ catalogo: catalogoCompleto().reverse(), t0: sp(13, 0) })
    await m.rodar()
    expect(nomes(m.chamadas)[0]).toBe('leitura_horaria')
  })

  it('anular_identidade roda antes de retratos_comentarios (item 155)', async () => {
    const m = montar({ catalogo: catalogoCompleto(), t0: sp(13, 0) })
    await m.rodar()
    const n = nomes(m.chamadas)
    expect(n.indexOf('anular_identidade')).toBeGreaterThanOrEqual(0)
    expect(n.indexOf('anular_identidade')).toBeLessThan(n.indexOf('retratos_comentarios') === -1 ? Infinity : n.indexOf('retratos_comentarios'))
    // e antes de qualquer pesada
    expect(n.indexOf('anular_identidade')).toBeLessThan(n.indexOf('sincronizar_canais'))
  })

  it('arranque: estado vazio, catálogo completo às 13:00 (item 214): a horária, as leves e UMA pesada', async () => {
    const m = montar({ catalogo: catalogoCompleto(), t0: sp(13, 0) })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'anular_identidade', 'soma_do_mapa', 'tamanho_do_banco', 'podas', 'sincronizar_canais'])
    expect(final(r, 'retratos_comentarios')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(m.ops.adiar).toHaveBeenCalledTimes(2)
    expect(m.ops.adiar).toHaveBeenCalledWith({ task: 'retratos_comentarios', period_key: '2026-10-12', motivo: 'uma_pesada_por_disparo' })
    expect(m.ops.adiar).toHaveBeenCalledWith({ task: 'serie_semanal', period_key: '2026-10-12', motivo: 'uma_pesada_por_disparo' })
    expect(r.problemas).toEqual([])
  })

  it('arranque com o catálogo desta ordem (OP-3): estado vazio às 14:40', async () => {
    const m = montar({ catalogo: catalogoDestaOrdem(), t0: sp(14, 40) })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'sincronizar_canais'])
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(m.ops.adiar).toHaveBeenCalledWith({ task: 'serie_semanal', period_key: '2026-10-12', motivo: 'uma_pesada_por_disparo' })
  })

  it('nunca duas pesadas, com cada tarefa no pior caso (item 215)', async () => {
    const t0 = sp(13, 0)
    const cat = catalogoCompleto().map(t => ({
      ...t,
      // cada `rodar` leva a tarefa até o `fimAteMs` dela e devolve parcial
      rodar: async (): Promise<ResultadoTarefa> => {
        relogio.agora = Math.max(relogio.agora, t0 + t.fimAteMs)
        return { estado: 'parcial', feitas: 1, deixadas: 3, motivo: 'sobrou' }
      },
    }))
    const m = montar({ catalogo: cat, t0 })
    const relogio = m.relogio
    const r = await m.rodar()
    const pesadas = new Set(['sincronizar_canais', 'retratos_comentarios', 'serie_semanal'])
    expect(m.chamadas.filter(c => pesadas.has(c.nome))).toHaveLength(1)
    for (const c of m.chamadas) {
      const t = cat.find(x => x.nome === c.nome)
      expect(c.em - t0, c.nome).toBeLessThanOrEqual(t?.comecaAteMs ?? 0)
    }
    expect(relogio.agora - t0).toBeLessThanOrEqual(LIMITE_FUNCAO_MS)
    // as leves que não couberam foram adiadas por falta de tempo, sem tomar
    expect(final(r, 'soma_do_mapa')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
    expect(m.ops.tomar).not.toHaveBeenCalledWith(expect.objectContaining({ task: 'soma_do_mapa' }))
  })

  it('a semanal cede a vez à sincronização às 18:00 (desvio 2)', async () => {
    const t0 = sp(18, 0)
    const cat = catalogoDestaOrdem()
    const semanal = cat.find(t => t.nome === 'serie_semanal')!
    const m = montar({
      catalogo: cat, t0,
      estado: estadoDe([linha(semanal, t0, { status: 'parcial', runs: 1, unfinished_n: 1, started_at: new Date(sp(12, 0)).toISOString(), last_run_status: 'parcial', last_run_done_n: 5 })], t0),
    })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'sincronizar_canais'])
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
  })

  it('a pesada quebrada vai para o fim (item 251b)', async () => {
    const t0 = sp(14, 0)
    const cat = catalogoDestaOrdem().filter(t => t.nome !== 'leitura_horaria')
    const sinc = cat.find(t => t.nome === 'sincronizar_canais')!
    const semanal = cat.find(t => t.nome === 'serie_semanal')!
    const quebrada = linha(sinc, t0, { status: 'erro', runs: 1, last_run_status: 'erro', last_run_done_n: 0 })

    const a = montar({ catalogo: cat, t0, estado: estadoDe([quebrada], t0) })
    const ra = await a.rodar()
    expect(nomes(a.chamadas)).toEqual(['serie_semanal'])
    expect(final(ra, 'sincronizar_canais')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })

    // sem pesada sã devida (a semanal já tem ok no dia): roda a quebrada
    const b = montar({ catalogo: cat, t0, estado: estadoDe([quebrada, linha(semanal, t0, { status: 'ok', runs: 1 })], t0) })
    await b.rodar()
    expect(nomes(b.chamadas)).toEqual(['sincronizar_canais'])
  })

  it('entre duas quebradas, a de execução mais antiga vem primeiro', async () => {
    const t0 = sp(14, 0)
    const a = pesada('a_pesada', 1, { periodo: 'faixa' })
    const b = pesada('b_pesada', 2, { periodo: 'faixa' })
    const m = montar({
      catalogo: [a, b], t0,
      estado: estadoDe([
        linha(a, t0, { status: 'erro', started_at: new Date(sp(13, 50)).toISOString(), last_run_status: 'erro' }),
        linha(b, t0, { status: 'erro', started_at: new Date(sp(12, 10)).toISOString(), last_run_status: 'erro' }),
      ], t0),
    })
    await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['b_pesada'])
  })

  it('a semanal não cede a vez a uma sincronização esgotada, nem a uma que ficou rodando (S-I9)', async () => {
    const t0 = sp(14, 0)
    const cat = catalogoDestaOrdem().filter(t => t.nome !== 'leitura_horaria')
    const sinc = cat.find(t => t.nome === 'sincronizar_canais')!
    for (const ultima of ['esgotada', 'rodando']) {
      const m = montar({ catalogo: cat, t0, estado: estadoDe([linha(sinc, t0, { status: 'adiada', last_run_status: ultima, last_run_done_n: 2 })], t0) })
      const r = await m.rodar()
      expect(nomes(m.chamadas), ultima).toEqual(['serie_semanal'])
      expect(final(r, 'sincronizar_canais'), ultima).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    }
  })

  it('uma parcial com done_n = 0 na última execução também não é sã', async () => {
    const t0 = sp(14, 0)
    const cat = catalogoDestaOrdem().filter(t => t.nome !== 'leitura_horaria')
    const sinc = cat.find(t => t.nome === 'sincronizar_canais')!
    const m = montar({ catalogo: cat, t0, estado: estadoDe([linha(sinc, t0, { status: 'parcial', last_run_status: 'parcial', last_run_done_n: 0 })], t0) })
    await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['serie_semanal'])
  })

  it('esgotada com canal devido continua vermelha em todo disparo da faixa (S-I9)', async () => {
    const devidaPeloDado = vi.fn(() => true)
    const sinc = pesada('sincronizar_canais', 6, { periodo: 'faixa', tetoTentativas: 9, devidaPeloDado })
    for (const t0 of [sp(12, 0), sp(14, 40), sp(17, 50)]) {
      const m = montar({ catalogo: [sinc], t0, estado: estadoDe([linha(sinc, t0, { status: 'esgotada', attempts: 9, runs: 9 })], t0) })
      const r = await m.rodar()
      expect(final(r, 'sincronizar_canais').estado).toBe('esgotada')
      expect(r.problemas).toEqual(['sincronizar canais: esgotou as 9 tentativas do período'])
      expect(m.ops.tomar).not.toHaveBeenCalled()
      expect(m.ops.esgotar).not.toHaveBeenCalled()
      expect(r.tarefas.map(t => t.estado)).not.toContain('ocupada')
    }
    expect(devidaPeloDado).not.toHaveBeenCalled()
  })

  // m-5 do portão final: documenta (NÃO muda) o desempate da vaga da pesada. É a prioridade do spec: quem já tem andamento e está sã
  // continua na vaga até terminar. Com `retratos_comentarios` em `parcial` COM progresso a cada disparo, a `serie_semanal` (mesma ordem de
  // período, `ordem` 8 contra 7) fica adiada enquanto isso durar; o que vigia o custo é a conferência D+1 ("a série semanal fechou ok no dia").
  it('fome da vaga: retratos em parcial com progresso levam a vaga e a série semanal fica adiada (prioridade do spec; a conferência D+1 vigia)', async () => {
    const t0 = sp(14, 0)
    const retratos = pesada('retratos_comentarios', 7, { aPartirDaHoraSP: 13 })
    const sem = pesada('serie_semanal', 8, { aPartirDaHoraSP: 12 })
    const estado = estadoDe([linha(retratos, t0, {
      status: 'parcial', attempts: 2, runs: 2, unfinished_n: 2, last_run_status: 'parcial', last_run_done_n: 40, done_n: 40, left_n: 300,
    })], t0)
    for (const dt of [0, 20, 40]) {
      const t = t0 + dt * 60_000
      const m = montar({ catalogo: [retratos, sem], t0: t, estado })
      const r = await m.rodar()
      expect(nomes(m.chamadas), `disparo +${dt} min`).toEqual(['retratos_comentarios'])
      expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    }
  })

  it('esgotada de outra pesada não segura a vaga: a outra roda', async () => {
    const t0 = sp(14, 0)
    const sinc = pesada('sincronizar_canais', 6, { periodo: 'faixa' })
    const sem = pesada('serie_semanal', 8, { cedeA: ['sincronizar_canais'] })
    const m = montar({ catalogo: [sinc, sem], t0, estado: estadoDe([linha(sinc, t0, { status: 'esgotada' })], t0) })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['serie_semanal'])
    expect(r.problemas).toHaveLength(1)
  })
})

// ---- o fecho e os problemas ------------------------------------------------------------------------------------

describe('despachante: o que a tarefa devolve', () => {
  it('o adiar das pesadas que cederam vem DEPOIS da leitura horária (não gasta o tempo dela)', async () => {
    const t0 = sp(13, 0)
    const ordem: string[] = []
    const cat = catalogoCompleto().map(t => (t.nome === 'leitura_horaria'
      ? { ...t, rodar: async (): Promise<ResultadoTarefa> => { ordem.push('horaria'); return { estado: 'ok', feitas: 1, deixadas: 0 } } }
      : t))
    const m = montar({ catalogo: cat, t0 })
    m.ops.adiar.mockImplementation(async (a) => { ordem.push(`adiar:${a.task}`) })
    const r = await m.rodar()
    expect(ordem[0]).toBe('horaria')
    expect(ordem.some(x => x.startsWith('adiar:'))).toBe(true)
    expect(ordem.indexOf('horaria')).toBeLessThan(ordem.findIndex(x => x.startsWith('adiar:')))
    // o resultado e o resumo não mudam
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(m.ops.adiar).toHaveBeenCalledWith({ task: 'serie_semanal', period_key: '2026-10-12', motivo: 'uma_pesada_por_disparo' })
  })

  it('cota não registrada no detalhe é problema mesmo com a tarefa em ok ou parcial (item 227: vermelho)', async () => {
    const t0 = sp(14, 40)
    for (const estado of ['ok', 'parcial'] as const) {
      const cat = [sempre('leitura_horaria', 1, { rodar: async (): Promise<ResultadoTarefa> => ({
        estado, feitas: 55, deixadas: 0, ...(estado === 'parcial' ? { motivo: 'sobrou' } : {}), detalhe: { cota_nao_registrada: 2, chamadas: 2 },
      }) })]
      const r = await montar({ catalogo: cat, t0 }).rodar()
      expect(r.problemas, estado).toContain('leitura horaria: 2 unidades de cota não registradas')
    }
  })

  it('uma única unidade de cota não registrada já é problema (fronteira do > 0; m-2 do portão final, mutante M08)', async () => {
    const cat = [sempre('leitura_horaria', 1, { rodar: async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: 55, deixadas: 0, detalhe: { cota_nao_registrada: 1 } }) })]
    const r = await montar({ catalogo: cat, t0: sp(14, 40) }).rodar()
    expect(r.problemas).toContain('leitura horaria: 1 unidades de cota não registradas')
  })

  it('sem cota não registrada (ausente ou zero) não há problema', async () => {
    const t0 = sp(14, 40)
    for (const detalhe of [{ chamadas: 2 }, { cota_nao_registrada: 0 }]) {
      const cat = [sempre('leitura_horaria', 1, { rodar: async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: 55, deixadas: 0, detalhe }) })]
      const r = await montar({ catalogo: cat, t0 }).rodar()
      expect(r.problemas).toEqual([])
    }
  })

  it('tarefa que estoura para e as seguintes rodam (item 152)', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => ({ estado: 'parcial', feitas: 2, deixadas: 7, motivo: 'sobrou' }) })
    const b = tarefa('b_leve', 2)
    const m = montar({ catalogo: [a, b], t0 })
    const r = await m.rodar()
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ task: 'a_leve', estado: 'parcial', feitas: 2, deixadas: 7, motivo: 'sobrou' }))
    expect(nomes(m.chamadas)).toEqual(['a_leve', 'b_leve'])
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'parcial', feitas: 2, deixadas: 7, motivo: 'sobrou' })
  })

  it('fecho leva o período, a duração inteira e o detalhe só numérico', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1, { rodar: async () => {
      m.relogio.agora += 1234.6
      return { estado: 'ok', feitas: 3.4, deixadas: null, detalhe: { x: 1, y: Number.NaN } }
    } })], t0 })
    await m.rodar()
    const arg = m.ops.fechar.mock.calls[0][0]
    expect(arg).toMatchObject({ task: 'a_leve', period_key: '2026-10-12', estado: 'ok', feitas: 3, deixadas: null, ms: 1235, detalhe: { x: 1 } })
    expect(Number.isInteger(arg.ms) && Number.isInteger(arg.feitas)).toBe(true)
  })

  it('tarefa que lança: erro com o código, as outras rodam, e o texto da exceção não sai (item 154; S-I4)', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => { throw new Error('Failing row contains (UCsentinela)') } })
    const b = tarefa('b_leve', 2)
    const m = montar({ catalogo: [a, b], t0 })
    const r = await m.rodar()
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ task: 'a_leve', estado: 'erro', motivo: 'excecao' }))
    expect(m.ops.relatar).toHaveBeenCalledWith('a_leve', { codigo: 'excecao', tecnico: { classe: 'Error', sqlstate: null } })
    expect(nomes(m.chamadas)).toEqual(['a_leve', 'b_leve'])
    expect(JSON.stringify(m.ops.fechar.mock.calls)).not.toContain('sentinela')
    expect(JSON.stringify(r)).not.toContain('sentinela')
    expect(r.problemas).toEqual(['a leve: falhou com erro inesperado (ver Sentry)'])
  })

  it('rodar que lança de forma síncrona também é erro, não derruba o disparo', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: () => { throw Object.assign(new Error('x'), { code: '57014' }) } })
    const m = montar({ catalogo: [a, tarefa('b_leve', 2)], t0 })
    await m.rodar()
    expect(m.ops.relatar).toHaveBeenCalledWith('a_leve', { codigo: 'excecao', tecnico: { classe: 'Error', sqlstate: '57014' } })
    expect(nomes(m.chamadas)).toEqual(['a_leve', 'b_leve'])
  })

  it('rodar que devolve algo fora da forma é erro, nunca ok em verde', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: () => Promise.resolve(undefined as never) })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(final(r, 'a_leve').estado).toBe('erro')
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'erro', motivo: 'motivo_desconhecido' }))
    expect(m.ops.relatar).toHaveBeenCalledWith('a_leve', { codigo: 'motivo_desconhecido' })
    expect(r.problemas).toHaveLength(1)
  })

  it('erro sem motivo vira motivo_desconhecido e vai ao Sentry', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => ({ estado: 'erro', feitas: 0, deixadas: null }) })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'erro', motivo: 'motivo_desconhecido' }))
    expect(m.ops.relatar).toHaveBeenCalledWith('a_leve', { codigo: 'motivo_desconhecido' })
    expect(r.problemas).toEqual(['a leve: falhou (motivo fora do catálogo; ver Sentry)'])
  })

  it('tarefa em erro: a frase leva os números do detalhe (E14-P1)', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('retratos_comentarios', 1, {
      rotulo: 'retratos de comentários',
      fraseDe: (c, n) => (c === 'sobrou' ? `ficaram ${n.ficaram} retratos` : undefined),
      rodar: async () => ({ estado: 'erro', feitas: 0, deixadas: 7, motivo: 'sobrou', detalhe: { ficaram: 7 } }),
    })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(r.problemas).toEqual(['retratos de comentários: ficaram 7 retratos'])
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'sobrou', detalhe: { ficaram: 7 } }))
  })

  it('motivo fora do catálogo da tarefa vira motivo_desconhecido (S-I4)', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'texto qualquer' }) })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'motivo_desconhecido' }))
    expect(m.ops.relatar).toHaveBeenCalledWith('a_leve', { codigo: 'motivo_desconhecido' })
    expect(JSON.stringify(r)).not.toContain('texto qualquer')
    expect(JSON.stringify(m.ops.fechar.mock.calls)).not.toContain('texto qualquer')
  })

  it('motivo comum (schema_ausente) é aceito sem ir ao Sentry', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'schema_ausente' }) })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(m.ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'schema_ausente' }))
    expect(m.ops.relatar).not.toHaveBeenCalled()
    expect(r.problemas).toEqual(['a leve: migration não aplicada'])
  })

  it('fechar devolve { porque }: o resultado não foi gravado, é problema e nota, e o estado do trabalho fica', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1), tarefa('b_leve', 2)], t0, fechar: async () => ({ porque: 'o banco não respondeu' }) })
    const r = await m.rodar()
    expect(final(r, 'a_leve').estado).toBe('ok')
    expect(r.notas).toContain('a leve: não foi possível gravar o fecho')
    expect(r.problemas).toContain('a leve: não foi possível gravar o fecho (o banco não respondeu)')
    expect(nomes(m.chamadas)).toEqual(['a_leve', 'b_leve'])
  })

  it('fechar que lança ou devolve false também é fecho não gravado', async () => {
    const t0 = sp(13, 0)
    const lanca = montar({ catalogo: [tarefa('a_leve', 1)], t0, fechar: async () => { throw new Error('Failing row contains (UCsentinela)') } })
    const r1 = await lanca.rodar()
    expect(r1.problemas).toHaveLength(1)
    expect(JSON.stringify(r1)).not.toContain('sentinela')
    const falso = montar({ catalogo: [tarefa('a_leve', 1)], t0, fechar: async () => ({ valor: false }) })
    const r2 = await falso.rodar()
    expect(r2.problemas).toHaveLength(1)
    expect(r2.notas).toContain('a leve: não foi possível gravar o fecho')
  })

  it('terceira parcial seguida da horária é problema (item 156)', async () => {
    const t0 = sp(14, 20)
    const horaria = sempre('leitura_horaria', 1, { rotulo: 'leitura horária', rodar: async () => ({ estado: 'parcial', feitas: 10, deixadas: 4, motivo: 'sobrou' }) })
    const m = montar({ catalogo: [horaria], t0, estado: estadoDe([linha(horaria, t0, { status: 'parcial', unfinished_n: 2 })], t0) })
    const r = await m.rodar()
    expect(r.problemas).toEqual(['leitura horária: 3 disparos seguidos sem terminar (ficaram 4)'])
    const menos = montar({ catalogo: [horaria], t0, estado: estadoDe([linha(horaria, t0, { status: 'parcial', unfinished_n: 1 })], t0) })
    expect((await menos.rodar()).problemas).toEqual([])
  })

  it('parcial da semanal nunca é problema por contagem (desvio 4)', async () => {
    const t0 = sp(14, 0)
    const semanal = pesada('serie_semanal', 8, { naoTerminouVermelhoEm: null, rodar: async () => ({ estado: 'parcial', feitas: 1, deixadas: 5, motivo: 'sobrou' }) })
    const m = montar({ catalogo: [semanal], t0, estado: estadoDe([linha(semanal, t0, { status: 'parcial', unfinished_n: 9 })], t0) })
    expect((await m.rodar()).problemas).toEqual([])
  })

  it('adiada por ceder a vez não conta (unfinished_n = 0, três disparos)', async () => {
    const sinc = pesada('sincronizar_canais', 6, { periodo: 'faixa', naoTerminouVermelhoEm: 1 })
    const semanal = pesada('serie_semanal', 8, { naoTerminouVermelhoEm: 1, cedeA: ['sincronizar_canais'] })
    for (const t0 of [sp(14, 0), sp(14, 20), sp(14, 40)]) {
      const m = montar({ catalogo: [sinc, semanal], t0, estado: estadoDe([linha(semanal, t0, { status: 'adiada', unfinished_n: 0 })], t0) })
      const r = await m.rodar()
      expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
      expect(r.problemas).toEqual([])
    }
  })

  it('adiada por falta de tempo conta, e chegando ao limite é problema', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { naoTerminouVermelhoEm: 3 })
    const m = montar({ catalogo: [a], t0, estado: estadoDe([linha(a, t0, { status: 'adiada', unfinished_n: 2 })], t0) })
    m.relogio.agora = t0 + 80_000
    const r = await m.rodar()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
    expect(r.problemas).toEqual(['a leve: 3 disparos seguidos sem terminar'])
  })
})

// ---- tempo -----------------------------------------------------------------------------------------------------

describe('despachante: o relógio', () => {
  it('sem tempo: adiada, sem tomar (relógio em 80 s e uma leve devida)', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1)], t0 })
    m.relogio.agora = t0 + 80_000
    const r = await m.rodar()
    expect(m.ops.adiar).toHaveBeenCalledWith({ task: 'a_leve', period_key: '2026-10-12', motivo: 'sem_tempo' })
    expect(m.ops.tomar).not.toHaveBeenCalled()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
  })

  it('leve com comecaAteMs maior que 75 s ainda assim não começa depois de 75 s', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1, { comecaAteMs: 85_000 })], t0 })
    m.relogio.agora = t0 + LEVE_COMECA_ATE_MS + 1
    const r = await m.rodar()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
    expect(m.ops.tomar).not.toHaveBeenCalled()
  })

  it('a pesada começa até o comecaAteMs dela, mesmo depois dos 75 s das leves', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: [pesada('sincronizar_canais', 6, { periodo: 'faixa' })], t0 })
    m.relogio.agora = t0 + 100_000
    await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['sincronizar_canais'])
    const tarde = montar({ catalogo: [pesada('sincronizar_canais', 6, { periodo: 'faixa' })], t0 })
    tarde.relogio.agora = t0 + 200_001
    expect(final(await tarde.rodar(), 'sincronizar_canais')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
  })

  it('tarefa que nunca volta: erro no fim do prazo dela, e a pesada roda (S-I1)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(sp(14, 40))
    const t0 = Date.now()
    const cat = catalogoDestaOrdem()
    const horaria = cat.find(t => t.nome === 'leitura_horaria')!
    horaria.rodar = () => new Promise<ResultadoTarefa>(() => undefined)
    const chamadas: string[] = []
    const ops = {
      tomar: vi.fn<OpsAgenda['tomar']>(async () => ({ valor: true })),
      fechar: vi.fn<OpsAgenda['fechar']>(async () => ({ valor: true })),
      adiar: vi.fn<OpsAgenda['adiar']>(async () => undefined),
      esgotar: vi.fn<OpsAgenda['esgotar']>(async () => ({ valor: false })),
      relatar: vi.fn<OpsAgenda['relatar']>(),
    }
    const sinc = cat.find(t => t.nome === 'sincronizar_canais')!
    const original = sinc.rodar
    sinc.rodar = async c => { chamadas.push('sincronizar_canais'); return original(c) }
    const p = despachar({
      catalogo: cat, desligadas: new Set(), t0, agora: () => Date.now(),
      estado: estadoDe([], t0), contexto: { t0, agora: () => Date.now(), apiKey: 'k', sb: {} as SupabaseClient, linhas: null }, ops,
    })
    await vi.advanceTimersByTimeAsync(60_000)
    const r = await p
    expect(ops.fechar).toHaveBeenCalledWith(expect.objectContaining({ task: 'leitura_horaria', estado: 'erro', motivo: 'passou_do_tempo', ms: 60_000 }))
    expect(chamadas).toEqual(['sincronizar_canais'])
    expect(ops.tomar).toHaveBeenCalledWith(expect.objectContaining({ task: 'sincronizar_canais' }))
    expect(r.problemas).toContain('leitura horária: passou do tempo e foi interrompida')
    expect(final(r, 'leitura_horaria')).toMatchObject({ estado: 'erro', motivo: 'passou_do_tempo' })
  })

  it('leve que nunca volta não impede a pesada (S-I1)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(sp(13, 0))
    const t0 = Date.now()
    const cat = catalogoCompleto()
    cat.find(t => t.nome === 'anular_identidade')!.rodar = () => new Promise<ResultadoTarefa>(() => undefined)
    const chamadas: string[] = []
    for (const t of cat) { const r = t.rodar; t.rodar = (c) => { chamadas.push(t.nome); return r(c) } }
    const ops = {
      tomar: vi.fn<OpsAgenda['tomar']>(async () => ({ valor: true })),
      fechar: vi.fn<OpsAgenda['fechar']>(async () => ({ valor: true })),
      adiar: vi.fn<OpsAgenda['adiar']>(async () => undefined),
      esgotar: vi.fn<OpsAgenda['esgotar']>(async () => ({ valor: false })),
      relatar: vi.fn<OpsAgenda['relatar']>(),
    }
    const p = despachar({
      catalogo: cat, desligadas: new Set(), t0, agora: () => Date.now(),
      estado: estadoDe([], t0), contexto: { t0, agora: () => Date.now(), apiKey: 'k', sb: {} as SupabaseClient, linhas: null }, ops,
    })
    await vi.advanceTimersByTimeAsync(90_000)
    const r = await p
    const fecho = ops.fechar.mock.calls.map(c => c[0]).find(c => c.task === 'anular_identidade')
    expect(fecho).toMatchObject({ estado: 'erro', motivo: 'passou_do_tempo' })
    expect(fecho?.ms).toBeLessThanOrEqual(90_000)
    expect(chamadas.filter(n => ['sincronizar_canais', 'retratos_comentarios', 'serie_semanal'].includes(n))).toEqual(['sincronizar_canais'])
    expect(final(r, 'sincronizar_canais').estado).toBe('ok')
  })
})

// ---- a tomada --------------------------------------------------------------------------------------------------

describe('despachante: a tomada', () => {
  it('tomada recusada com teto batido vira esgotada (OP-4)', async () => {
    const t0 = sp(14, 0)
    const a = pesada('sincronizar_canais', 6, { periodo: 'faixa', tetoTentativas: 9 })
    const m = montar({ catalogo: [a], t0, tomar: async () => ({ valor: false }), esgotar: async () => ({ valor: true }) })
    const r = await m.rodar()
    expect(m.ops.esgotar).toHaveBeenCalledWith({ task: 'sincronizar_canais', period_key: '2026-10-12#12', teto: 9 })
    expect(final(r, 'sincronizar_canais').estado).toBe('esgotada')
    expect(r.problemas).toEqual(['sincronizar canais: esgotou as 9 tentativas do período'])
    expect(m.chamadas).toEqual([])
  })

  it('tomada recusada sem teto é "ocupada" (OP-4): nota, sem problema, rodar não chamado', async () => {
    const t0 = sp(14, 0)
    const a = tarefa('a_leve', 1)
    const m = montar({
      catalogo: [a], t0,
      estado: estadoDe([linha(a, t0, { status: 'rodando', attempts: 1, started_at: new Date(t0 - 60_000).toISOString() })], t0),
      tomar: async () => ({ valor: false }), esgotar: async () => ({ valor: false }),
    })
    const r = await m.rodar()
    expect(final(r, 'a_leve').estado).toBe('ocupada')
    expect(r.notas).toEqual(['a leve: outro disparo está com ela'])
    expect(r.problemas).toEqual([])
    expect(m.chamadas).toEqual([])
    expect(m.ops.fechar).not.toHaveBeenCalled()
  })

  it('esgotar sem resposta: não dá para saber, é erro de tomada, nunca "ocupada" em verde', async () => {
    const t0 = sp(14, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1)], t0, tomar: async () => ({ valor: false }), esgotar: async () => ({ porque: 'o banco não respondeu' }) })
    const r = await m.rodar()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'erro', motivo: 'tomada_falhou' })
    expect(r.problemas).toEqual(['a leve: não foi possível tomar a tarefa (o banco não respondeu)'])
    expect(m.chamadas).toEqual([])
  })

  it('tomada que falha não roda a tarefa', async () => {
    const t0 = sp(14, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1), tarefa('b_leve', 2)], t0, tomar: async a => (a.task === 'a_leve' ? { porque: 'o banco não respondeu' } : { valor: true }) })
    const r = await m.rodar()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'erro', motivo: 'tomada_falhou' })
    expect(r.problemas).toEqual(['a leve: não foi possível tomar a tarefa (o banco não respondeu)'])
    expect(nomes(m.chamadas)).toEqual(['b_leve'])
    expect(m.ops.fechar).toHaveBeenCalledTimes(1)
  })

  it('tomada que lança é a mesma coisa que tomada que falha', async () => {
    const t0 = sp(14, 0)
    const m = montar({ catalogo: [tarefa('a_leve', 1)], t0, tomar: async () => { throw new Error('Failing row contains (UCsentinela)') } })
    const r = await m.rodar()
    expect(final(r, 'a_leve')).toMatchObject({ estado: 'erro', motivo: 'tomada_falhou' })
    expect(JSON.stringify(r)).not.toContain('sentinela')
    expect(m.chamadas).toEqual([])
  })

  it('tarefa rodando e vencida (mais de 10 min) é retomada, não fica presa', async () => {
    const t0 = sp(14, 0)
    const a = tarefa('a_leve', 1)
    const m = montar({
      catalogo: [a], t0,
      estado: estadoDe([linha(a, t0, { status: 'rodando', attempts: 1, runs: 1, started_at: new Date(t0 - 11 * 60_000).toISOString(), last_run_status: 'rodando' })], t0),
    })
    const r = await m.rodar()
    expect(m.ops.tomar).toHaveBeenCalledWith({ task: 'a_leve', period_key: '2026-10-12', teto: 5, reabrir: false })
    expect(nomes(m.chamadas)).toEqual(['a_leve'])
    expect(final(r, 'a_leve').estado).toBe('ok')
  })
})

// ---- sem estado ------------------------------------------------------------------------------------------------

describe('despachante: estado ilegível', () => {
  it('sem estado: decide pelo relógio e segue, com um problema e sem reabrir', async () => {
    const t0 = sp(14, 40)
    const m = montar({ catalogo: catalogoCompleto(), t0, estado: { porque: 'o banco não respondeu' } })
    const r = await m.rodar()
    // 14:40: a horária, as leves no horário (anular às 3, soma às 4, tamanho e podas às 5) e UMA pesada
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'anular_identidade', 'soma_do_mapa', 'tamanho_do_banco', 'podas', 'sincronizar_canais'])
    expect(r.problemas).toEqual(['não foi possível ler o estado da agenda (o banco não respondeu)'])
    for (const c of m.ops.tomar.mock.calls) expect(c[0].reabrir).toBe(false)
    // nunca "nada a fazer": ninguém virou nao_devida por falta de leitura
    expect(r.tarefas.filter(t => t.estado === 'nao_devida')).toEqual([])
    expect(r.tarefas.filter(t => t.estado === 'adiada').map(t => t.tarefa)).toEqual(['retratos_comentarios', 'serie_semanal'])
  })

  it('sem estado, fora do horário continua fora do horário', async () => {
    const m = montar({ catalogo: [tarefa('so_de_tarde', 1, { aPartirDaHoraSP: 13 })], t0: sp(9, 0), estado: { porque: 'resposta fora da forma esperada' } })
    const r = await m.rodar()
    expect(final(r, 'so_de_tarde').estado).toBe('nao_devida')
    expect(r.problemas).toHaveLength(1)
  })

  it('sem estado a pesada é uma só e a que cede cede', async () => {
    const m = montar({ catalogo: catalogoDestaOrdem(), t0: sp(14, 40), estado: { porque: 'o banco não respondeu' } })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'sincronizar_canais'])
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
  })
})

// ---- o resumo --------------------------------------------------------------------------------------------------

describe('despachante: o resumo', () => {
  it('traz uma entrada por tarefa do catálogo, na ordem do catálogo, com a duração', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: catalogoCompleto().reverse(), t0, desligadas: ['podas'] })
    const r = await m.rodar()
    expect(r.tarefas.map(t => t.tarefa)).toEqual(['leitura_horaria', 'anular_identidade', 'soma_do_mapa', 'tamanho_do_banco', 'podas', 'sincronizar_canais', 'retratos_comentarios', 'serie_semanal'])
    expect(final(r, 'podas').estado).toBe('desligada')
    for (const t of r.tarefas) expect(Number.isInteger(t.ms) && t.ms >= 0).toBe(true)
  })

  it('o extra da tarefa passa para o resumo, e só ele', async () => {
    const t0 = sp(13, 0)
    const a = tarefa('a_leve', 1, { rodar: async () => ({ estado: 'ok', feitas: 1, deixadas: 0, extra: { videos: 3 } }) })
    const m = montar({ catalogo: [a], t0 })
    const r = await m.rodar()
    expect(final(r, 'a_leve').extra).toEqual({ videos: 3 })
    expect(m.ops.fechar.mock.calls[0][0]).not.toHaveProperty('extra')
  })
})

// ---- A5 E14, Tarefa 12: o catálogo da ordem 6 (as cinco tarefas reais, com `rodar` falso) -------------------------------------
describe('despachante: as tarefas dos comentários de destaque no catálogo real', () => {
  /** O catálogo real do HEAD (definições de verdade), sem o código: `rodar` é do teste e `devidaPeloDado` não entra. */
  function catalogoReal(rodar: Record<string, Tarefa['rodar']> = {}): Tarefa[] {
    return CATALOGO.map(t => {
      const { rodar: _codigo, devidaPeloDado: _dado, ...definicao } = t
      return { ...definicao, rodar: rodar[t.nome] ?? okPadrao }
    })
  }
  const sinc = () => CATALOGO.find(t => t.nome === 'sincronizar_canais')!

  it('ordem: anular_identidade antes de retratos_comentarios no mesmo disparo (item 155)', async () => {
    const t0 = sp(13, 0)
    // a sincronização já tem ok na faixa: a vaga da pesada fica livre para a coleta de comentários
    const m = montar({ catalogo: catalogoReal(), t0, estado: estadoDe([linha(sinc(), t0, { status: 'ok', runs: 1 })], t0) })
    await m.rodar()
    const n = nomes(m.chamadas)
    expect(n).toContain('anular_identidade')
    expect(n).toContain('retratos_comentarios')
    expect(n.indexOf('leitura_horaria')).toBe(0)
    expect(n.indexOf('anular_identidade')).toBeLessThan(n.indexOf('retratos_comentarios'))
  })

  it('a anulação falha: a coleta do mesmo disparo roda, e a anulação é o problema (com o código, não o texto)', async () => {
    const t0 = sp(13, 0)
    const m = montar({
      catalogo: catalogoReal({ anular_identidade: async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'banco' }) }), t0,
      estado: estadoDe([linha(sinc(), t0, { status: 'ok', runs: 1 })], t0),
    })
    const r = await m.rodar()
    expect(nomes(m.chamadas)).toEqual(['leitura_horaria', 'anular_identidade', 'retratos_comentarios'])
    expect(final(r, 'anular_identidade')).toMatchObject({ estado: 'erro', motivo: 'banco' })
    expect(final(r, 'retratos_comentarios').estado).toBe('ok')
    expect(r.problemas).toEqual(['anular identidade de autores: o banco não respondeu a tempo ou recusou'])
  })

  /** Cada `rodar` leva a tarefa até o `fimAteMs` dela, contado de t0, e devolve parcial (o pior caso). */
  function noPiorCaso(t0: number, estado: Lido<EstadoAgenda>) {
    let relogio: { agora: number } = { agora: t0 }
    const pior: Record<string, Tarefa['rodar']> = {}
    for (const t of CATALOGO) {
      pior[t.nome] = async (): Promise<ResultadoTarefa> => {
        relogio.agora = Math.max(relogio.agora, t0 + t.fimAteMs)
        return { estado: 'parcial', feitas: 1, deixadas: 3, motivo: 'sobrou' }
      }
    }
    const m = montar({ catalogo: catalogoReal(pior), t0, estado })
    relogio = m.relogio
    return m
  }
  const PESADAS = new Set(['sincronizar_canais', 'retratos_comentarios', 'serie_semanal'])

  it('nunca duas pesadas, com cada tarefa no pior caso; relógio final ≤ 300 s (às 13:00, estado vazio)', async () => {
    const t0 = sp(13, 0)
    const m = noPiorCaso(t0, estadoDe([], t0))
    await m.rodar()
    expect(m.chamadas.filter(c => PESADAS.has(c.nome))).toHaveLength(1)
    for (const c of m.chamadas) expect(c.em - t0, c.nome).toBeLessThanOrEqual(CATALOGO.find(t => t.nome === c.nome)!.comecaAteMs)
    expect(m.relogio.agora - t0).toBeLessThanOrEqual(LIMITE_FUNCAO_MS)
  })

  it('nunca duas pesadas, com a coleta de comentários no pior caso: termina em 225 s e deixa os 20 s da prova e os 15 s do registro', async () => {
    const t0 = sp(13, 0)
    const m = noPiorCaso(t0, estadoDe([linha(sinc(), t0, { status: 'ok', runs: 1 })], t0))
    const r = await m.rodar()
    expect(m.chamadas.filter(c => PESADAS.has(c.nome)).map(c => c.nome)).toEqual(['retratos_comentarios'])
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    // anular termina em 85 s; a coleta começa aí (≤ 130 s) e vai a 225 s
    const anular = m.chamadas.find(c => c.nome === 'anular_identidade')!
    const coleta = m.chamadas.find(c => c.nome === 'retratos_comentarios')!
    expect(coleta.em - t0).toBeGreaterThanOrEqual(anular.em - t0)
    expect(coleta.em - t0).toBeLessThanOrEqual(130_000)
    expect(m.relogio.agora - t0).toBe(225_000)
    expect(m.relogio.agora - t0).toBeLessThanOrEqual(LIMITE_FUNCAO_MS - 20_000 - 15_000)
  })

  it('a vaga da pesada às 13:00: com as duas sãs e a sincronização feita, ganha retratos_comentarios (ordem 7), e a semanal espera', async () => {
    const t0 = sp(13, 0)
    const m = montar({ catalogo: catalogoReal(), t0, estado: estadoDe([linha(sinc(), t0, { status: 'ok', runs: 1 })], t0) })
    const r = await m.rodar()
    expect(m.chamadas.filter(c => PESADAS.has(c.nome)).map(c => c.nome)).toEqual(['retratos_comentarios'])
    expect(final(r, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
  })

  it('armadilha: com a coleta de comentários QUEBRADA, a semanal não fica sem rodar; no disparo seguinte, sem pesada sã, a quebrada roda', async () => {
    const t0 = sp(13, 0)
    const coleta = CATALOGO.find(t => t.nome === 'retratos_comentarios')!
    const semanal = CATALOGO.find(t => t.nome === 'serie_semanal')!
    const quebrada = linha(coleta, t0, { status: 'erro', runs: 2, attempts: 2, last_run_status: 'erro', last_run_done_n: 0 })
    const sincOk = linha(sinc(), t0, { status: 'ok', runs: 1 })

    const a = montar({ catalogo: catalogoReal(), t0, estado: estadoDe([sincOk, quebrada], t0) })
    const ra = await a.rodar()
    expect(a.chamadas.filter(c => PESADAS.has(c.nome)).map(c => c.nome)).toEqual(['serie_semanal'])
    expect(final(ra, 'retratos_comentarios')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })

    // a semanal já tem ok no dia: sem outra pesada sã, a coleta quebrada tem a vaga (não fica parada o dia inteiro)
    const t1 = sp(13, 20)
    const b = montar({
      catalogo: catalogoReal(), t0: t1,
      estado: estadoDe([linha(sinc(), t1, { status: 'ok', runs: 1 }), linha(coleta, t1, { status: 'erro', runs: 2, attempts: 2, last_run_status: 'erro', last_run_done_n: 0 }), linha(semanal, t1, { status: 'ok', runs: 1 })], t1),
    })
    await b.rodar()
    expect(b.chamadas.filter(c => PESADAS.has(c.nome)).map(c => c.nome)).toEqual(['retratos_comentarios'])
  })
})
