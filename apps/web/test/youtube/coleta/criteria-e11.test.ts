// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabase, type FakeDb } from './fake-supabase'
import { criteriosE11 } from '@/lib/youtube/coleta/criteria-e11'
import type { ProvaE11 } from '@/lib/youtube/coleta/e11-config'

afterEach(() => { vi.useRealTimers() })

// hoje = 2026-10-13; ligadoEm = 2026-10-10 (a carência da cobertura acaba em 13/10; a da fila, em 15/10).
const HOJE = '2026-10-13'
const E11 = { desde: '2026-10-01', ligadoEm: '2026-10-10' }
const LIMPA: ProvaE11 = {
  faltando_cobertura: 0, videos_com_base: 12, videos_base_antes_do_inicio: 0, videos_sem_base: 0,
  base_ate: '2026-10-12', dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 0,
}
const LIGADOS = { dimensoes: false, normalizadores: false }

function montar(prova: unknown = LIMPA, site = 'site-1') {
  const db = fakeSupabase({})
  db.rpcHandlers.yt_own_dim_prova = () => ({ data: prova, error: null })
  return { db, site }
}
async function rodar(db: FakeDb, o: { prova?: Partial<ProvaE11>; hoje?: string; e11?: unknown; sites?: string[]; desligados?: { dimensoes: boolean; normalizadores: boolean } } = {}) {
  const falhas: string[] = []
  const r = await criteriosE11({
    supabase: db.client, falhas, hoje: o.hoje ?? HOJE, e11: (o.e11 ?? E11) as typeof E11,
    sites: o.sites ?? ['site-1'], desligados: o.desligados ?? LIGADOS,
  })
  return { falhas, r }
}
const com = (p: Partial<ProvaE11>): ProvaE11 => ({ ...LIMPA, ...p })

describe('criteriosE11: o caminho limpo', () => {
  it('prova limpa: sem nota, avalia os dois, chama a prova uma vez por site com os parâmetros certos', async () => {
    const { db } = montar()
    const { falhas, r } = await rodar(db)
    expect(falhas).toEqual([])
    expect(r.avaliados).toEqual(['dimensoes', 'normalizadores'])
    expect(r.desligados).toEqual([])
    expect(r.provas).toEqual({ 'site-1': LIMPA })
    expect(db.rpcCalls).toEqual([{ name: 'yt_own_dim_prova', args: { p_site: 'site-1', p_hoje: HOJE, p_desde: '2026-10-01' } }])
  })

  it('tabela vazia (tudo 0, base_ate nulo, 0 vídeos) = sem nota', async () => {
    const vazia = com({ videos_com_base: 0, base_ate: null })
    const { db } = montar(vazia)
    const { falhas, r } = await rodar(db)
    expect(falhas).toEqual([])
    expect(r.provas['site-1']).toEqual(vazia)
  })

  it('não aceita prova pronta de fora: chama sempre', async () => {
    const { db } = montar()
    await rodar(db)
    await rodar(db)
    expect(db.rpcCalls).toHaveLength(2)
  })
})

describe('prova que não existe = vermelho com motivo, nunca verde', () => {
  it('função ausente (schema): nota com o motivo', async () => {
    const db = fakeSupabase({}) // sem handler: PGRST202
    const { falhas, r } = await rodar(db)
    expect(falhas).toEqual(['dimensões: prova não avaliada (schema ausente: yt_own_dim_prova)'])
    expect(r.provas).toEqual({ 'site-1': null })
    expect(r.avaliados).toEqual([])
  })

  it('resposta nula (data null sem erro): forma inesperada', async () => {
    const { db } = montar(null)
    const { falhas, r } = await rodar(db)
    expect(falhas).toEqual(['dimensões: prova não avaliada (forma inesperada: resposta)'])
    expect(r.provas['site-1']).toBeNull()
  })

  it('resposta que não é objeto (lista): forma inesperada', async () => {
    const { db } = montar([])
    expect((await rodar(db)).falhas).toEqual(['dimensões: prova não avaliada (forma inesperada: resposta)'])
  })

  it.each(Object.keys(LIMPA))('chave faltando (%s): nota com o campo, nunca 0', async (campo) => {
    const incompleta: Record<string, unknown> = { ...LIMPA }
    delete incompleta[campo]
    const { db } = montar(incompleta)
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([`dimensões: prova não avaliada (forma inesperada: ${campo})`])
  })

  it('campo numérico como texto ou negativo: forma inesperada', async () => {
    expect((await rodar(montar({ ...LIMPA, faltando_cobertura: '3' }).db)).falhas).toEqual(['dimensões: prova não avaliada (forma inesperada: faltando_cobertura)'])
    expect((await rodar(montar({ ...LIMPA, pendentes_normalizar: -1 }).db)).falhas).toEqual(['dimensões: prova não avaliada (forma inesperada: pendentes_normalizar)'])
  })

  it('o rpc devolve o erro de parâmetro nulo (22023): prova não avaliada', async () => {
    const db = fakeSupabase({})
    db.errors['rpc:yt_own_dim_prova'] = { code: '22023', message: 'yt_own_dim_prova: p_site, p_hoje e p_desde são obrigatórios' }
    const { falhas } = await rodar(db)
    expect(falhas).toEqual(['dimensões: prova não avaliada (erro de banco)'])
    expect(falhas.join(' ')).not.toContain('obrigatórios') // nunca o texto do Postgres
  })

  it('o rpc lança: erro de banco, não exceção', async () => {
    const db = fakeSupabase({})
    db.rpcHandlers.yt_own_dim_prova = () => { throw new Error('rede caiu') }
    const { falhas } = await rodar(db)
    expect(falhas).toEqual(['dimensões: prova não avaliada (erro de banco)'])
  })

  it('promessa que não resolve: sem resposta em 5 s', async () => {
    vi.useFakeTimers()
    const db = fakeSupabase({})
    db.rpcHandlers.yt_own_dim_prova = () => new Promise(() => {}) as never
    const p = rodar(db)
    await vi.advanceTimersByTimeAsync(5_001)
    const { falhas, r } = await p
    expect(falhas).toEqual(['dimensões: prova não avaliada (sem resposta em 5 s)'])
    expect(r.provas['site-1']).toBeNull()
  })

  it('lista de sites vazia com passo ligado: nota, nunca silêncio', async () => {
    const { db } = montar()
    const { falhas, r } = await rodar(db, { sites: [] })
    expect(falhas).toEqual(['dimensões: prova não avaliada (nenhum site com coleta ligada para avaliar)'])
    expect(db.rpcCalls).toHaveLength(0)
    expect(r.avaliados).toEqual([])
  })

  it('site vazio na lista: nota, sem chamar o banco', async () => {
    const { db } = montar()
    const { falhas } = await rodar(db, { sites: [''] })
    expect(falhas).toEqual(['dimensões: prova não avaliada (site sem id)'])
    expect(db.rpcCalls).toHaveLength(0)
  })

  it('configuração das datas faltando ou inválida: nota, sem chamar o banco', async () => {
    for (const e11 of [undefined, {}, { desde: '2026-10-01' }, { desde: 'ontem', ligadoEm: '2026-10-10' }, { desde: '2026-10-11', ligadoEm: '2026-10-10' }]) {
      const { db } = montar()
      const falhas: string[] = []
      await criteriosE11({ supabase: db.client, falhas, hoje: HOJE, e11: e11 as typeof E11, sites: ['site-1'], desligados: LIGADOS })
      expect(falhas).toHaveLength(1)
      expect(falhas[0]).toMatch(/^dimensões: prova não avaliada \(configuração das dimensões/)
      expect(db.rpcCalls).toHaveLength(0)
    }
  })

  it('hoje inválido: nota, sem chamar o banco', async () => {
    for (const hoje of ['', '13/10/2026', '2026-02-30']) {
      const { db } = montar()
      const { falhas } = await rodar(db, { hoje })
      expect(falhas).toEqual(['dimensões: prova não avaliada (data de hoje inválida)'])
      expect(db.rpcCalls).toHaveLength(0)
    }
  })

  it('base_ate nulo com vídeos com base: forma inesperada, não "sem atraso"', async () => {
    const { db } = montar(com({ videos_com_base: 3, base_ate: null }))
    expect((await rodar(db)).falhas).toEqual(['dimensões: prova não avaliada (forma inesperada: base_ate)'])
  })
})

describe('videos_sem_base (decisão 3)', () => {
  it('sobe: nenhuma base e vídeos antigos = vermelho', async () => {
    const { db } = montar(com({ videos_com_base: 0, videos_sem_base: 35, base_ate: null }))
    const { falhas } = await rodar(db)
    expect(falhas).toEqual(['dimensões: nenhum vídeo com cobertura do diário (base): confira se a dieta (E6 P2) está em produção'])
  })
  it('não sobe: base em alguns e 2 vídeos sem base = sem nota, número no resumo', async () => {
    const prova = com({ videos_com_base: 10, videos_sem_base: 2 })
    const { db } = montar(prova)
    const { falhas, r } = await rodar(db)
    expect(falhas).toEqual([])
    expect(r.provas['site-1']?.videos_sem_base).toBe(2)
  })
  it('tabela vazia: 0 base e 0 sem base = sem nota', async () => {
    expect((await rodar(montar(com({ videos_com_base: 0, videos_sem_base: 0, base_ate: null })).db)).falhas).toEqual([])
  })
})

describe('base_ate (hoje − 4)', () => {
  it('sobe: base_ate há 5 dias = vermelho, com dd/mm', async () => {
    const { db } = montar(com({ base_ate: '2026-10-08' }))
    expect((await rodar(db)).falhas).toEqual(['dimensões: a cobertura do diário (base) parou em 08/10 no canal mais atrasado'])
  })
  it('não sobe: base_ate há 4 dias = sem nota', async () => {
    expect((await rodar(montar(com({ base_ate: '2026-10-09' })).db)).falhas).toEqual([])
  })
  it('virada de mês e de ano', async () => {
    expect((await rodar(montar(com({ base_ate: '2026-12-26' })).db, { hoje: '2027-01-01' })).falhas).toEqual(['dimensões: a cobertura do diário (base) parou em 26/12 no canal mais atrasado'])
    expect((await rodar(montar(com({ base_ate: '2026-12-28' })).db, { hoje: '2027-01-01' })).falhas).toEqual([])
  })
})

describe('faltando_cobertura (carência de 3 dias)', () => {
  const faltando = com({ faltando_cobertura: 4 })
  it('dia 2 depois de ligadoEm: só no resumo', async () => {
    const { db } = montar(faltando)
    const { falhas, r } = await rodar(db, { hoje: '2026-10-12' })
    expect(falhas).toEqual([])
    expect(r.provas['site-1']?.faltando_cobertura).toBe(4)
  })
  it('dia 3 depois de ligadoEm: nota com a contagem e a data (hoje − 4)', async () => {
    const { db } = montar(faltando)
    expect((await rodar(db, { hoje: '2026-10-13' })).falhas).toEqual([
      'dimensões: 4 par(es) vídeo e conjunto sem cobertura até 09/10 (origem, aparelho, país ou inscrito)',
    ])
  })
  it('a data da nota é a menor entre hoje − 4 e base_ate', async () => {
    const { db } = montar(com({ faltando_cobertura: 1, base_ate: '2026-10-11' }))
    expect((await rodar(db, { hoje: '2026-10-14' })).falhas).toEqual([
      'dimensões: 1 par(es) vídeo e conjunto sem cobertura até 10/10 (origem, aparelho, país ou inscrito)',
    ])
  })
  it('zero faltando depois da carência = sem nota', async () => {
    expect((await rodar(montar(com({ base_ate: '2026-11-29' })).db, { hoje: '2026-11-30' })).falhas).toEqual([])
  })
})

describe('normalizadores', () => {
  it('dois relatórios no mesmo dia (detalhe) sobe sem carência', async () => {
    const { db } = montar(com({ dias_dois_relatorios_detalhe: 2 }))
    expect((await rodar(db, { hoje: '2026-10-10' })).falhas).toEqual(['normalizadores: 2 dia(s) com linhas de dois relatórios (item 249)'])
  })
  it('dois relatórios no mesmo dia (alcance) sobe', async () => {
    const { db } = montar(com({ dias_dois_relatorios_alcance: 1 }))
    expect((await rodar(db)).falhas).toEqual(['normalizadores: 1 dia(s) com linhas de dois relatórios (item 249)'])
  })
  it('detalhe e alcance juntos: uma nota só, com a soma', async () => {
    const { db } = montar(com({ dias_dois_relatorios_detalhe: 1, dias_dois_relatorios_alcance: 2 }))
    expect((await rodar(db)).falhas).toEqual(['normalizadores: 3 dia(s) com linhas de dois relatórios (item 249)'])
  })
  it('zero dias com dois relatórios = sem nota', async () => {
    expect((await rodar(montar().db)).falhas).toEqual([])
  })
  it('fila: dia 4 depois de ligadoEm só no resumo; dia 5 vira nota', async () => {
    const { db } = montar(com({ pendentes_normalizar: 7 }))
    const dia4 = await rodar(db, { hoje: '2026-10-14' })
    expect(dia4.falhas).toEqual([])
    expect(dia4.r.provas['site-1']?.pendentes_normalizar).toBe(7)
    expect((await rodar(db, { hoje: '2026-10-15' })).falhas).toEqual(['normalizadores: 7 relatório(s) baixado(s) há mais de 2 dias sem normalizar'])
  })
  it('fila vazia depois da carência = sem nota', async () => {
    expect((await rodar(montar(com({ base_ate: '2026-10-19' })).db, { hoje: '2026-10-20' })).falhas).toEqual([])
  })
})

describe('passo desligado', () => {
  const tudo = com({ faltando_cobertura: 5, dias_dois_relatorios_detalhe: 1, pendentes_normalizar: 3, videos_com_base: 0, videos_sem_base: 4, base_ate: null })
  it('dimensões desligado: os critérios dele não rodam e o nome vai em desligados', async () => {
    const { db } = montar(tudo)
    const { falhas, r } = await rodar(db, { hoje: '2026-10-20', desligados: { dimensoes: true, normalizadores: false } })
    expect(falhas).toEqual([
      'normalizadores: 1 dia(s) com linhas de dois relatórios (item 249)',
      'normalizadores: 3 relatório(s) baixado(s) há mais de 2 dias sem normalizar',
    ])
    expect(r.desligados).toEqual(['dimensoes'])
    expect(r.avaliados).toEqual(['normalizadores'])
  })
  it('normalizadores desligado: só as notas das dimensões', async () => {
    const { db } = montar(tudo)
    const { falhas, r } = await rodar(db, { hoje: '2026-10-20', desligados: { dimensoes: false, normalizadores: true } })
    expect(falhas).toEqual([
      'dimensões: nenhum vídeo com cobertura do diário (base): confira se a dieta (E6 P2) está em produção',
      'dimensões: 5 par(es) vídeo e conjunto sem cobertura até 16/10 (origem, aparelho, país ou inscrito)',
    ])
    expect(r.desligados).toEqual(['normalizadores'])
    expect(r.avaliados).toEqual(['dimensoes'])
  })
  it('os dois desligados: nenhuma chamada, nenhuma nota, diz desligado (nunca ok)', async () => {
    const { db } = montar(tudo)
    const { falhas, r } = await rodar(db, { desligados: { dimensoes: true, normalizadores: true } })
    expect(falhas).toEqual([])
    expect(r.desligados).toEqual(['dimensoes', 'normalizadores'])
    expect(r.avaliados).toEqual([])
    expect(r.provas).toEqual({})
    expect(db.rpcCalls).toHaveLength(0)
  })
  it('os dois desligados com lista de sites vazia: continua sem nota', async () => {
    const { db } = montar()
    const { falhas } = await rodar(db, { sites: [], desligados: { dimensoes: true, normalizadores: true } })
    expect(falhas).toEqual([])
  })
  it('prova que falha com só os normalizadores ligados: nota, nunca verde', async () => {
    const db = fakeSupabase({})
    const { falhas } = await rodar(db, { desligados: { dimensoes: true, normalizadores: false } })
    expect(falhas).toEqual(['dimensões: prova não avaliada (schema ausente: yt_own_dim_prova)'])
  })
})

describe('mais de um site', () => {
  it('uma chamada por site, notas separadas', async () => {
    const db = fakeSupabase({})
    db.rpcHandlers.yt_own_dim_prova = (a) => ({ data: a.p_site === 'site-a' ? com({ dias_dois_relatorios_detalhe: 1 }) : com({ dias_dois_relatorios_detalhe: 1, base_ate: '2026-10-01' }), error: null })
    const { falhas, r } = await rodar(db, { sites: ['site-a', 'site-b'] })
    expect(db.rpcCalls.map((c) => c.args.p_site)).toEqual(['site-a', 'site-b'])
    expect(falhas).toEqual([
      'normalizadores: 1 dia(s) com linhas de dois relatórios (item 249) [site site-a]',
      'dimensões: a cobertura do diário (base) parou em 01/10 no canal mais atrasado [site site-b]',
      'normalizadores: 1 dia(s) com linhas de dois relatórios (item 249) [site site-b]',
    ])
    expect(Object.keys(r.provas)).toEqual(['site-a', 'site-b'])
  })
  it('um site com prova ruim não esconde o outro', async () => {
    const db = fakeSupabase({})
    db.rpcHandlers.yt_own_dim_prova = (a) => a.p_site === 'site-a' ? { data: null, error: { code: '57014', message: 'x' } } : { data: LIMPA, error: null }
    const { falhas, r } = await rodar(db, { sites: ['site-a', 'site-b'] })
    expect(falhas).toEqual(['dimensões: prova não avaliada (erro de banco) [site site-a]'])
    expect(r.provas).toEqual({ 'site-a': null, 'site-b': LIMPA })
    expect(r.avaliados).toEqual([])
  })
  it('site repetido na lista: uma chamada só', async () => {
    const { db } = montar()
    await rodar(db, { sites: ['site-1', 'site-1'] })
    expect(db.rpcCalls).toHaveLength(1)
  })
  it('com um site só a nota não leva sufixo', async () => {
    const { db } = montar(com({ dias_dois_relatorios_alcance: 1 }))
    expect((await rodar(db)).falhas[0]).not.toContain('[site')
  })
})
