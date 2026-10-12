// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabase, type FakeDb } from './fake-supabase'
import { conferirGuarda, contarBrutosAoAbrir, GUARDA_PRAZO_MS, GUARDA_ABERTURA_PRAZO_MS } from '@/lib/youtube/coleta/guarda'

type Linha = Record<string, unknown>
const baixado = (id: string, extra: Linha = {}): Linha => ({ report_id: id, status: 'baixado', downloaded_at: '2026-10-01T12:00:00.000Z', ...extra })
const bruto = (id: string): Linha => ({ report_id: id, site_id: 'site-1', csv_gz: '\\x00' })
/** Uma execução anterior do cron. `blobs = null`: execução que não conferiu a guarda (resumo sem o número). */
const execucao = (ran_at: string, blobs: number | null): Linha => ({ ran_at, resumo: blobs === null ? { relatorios: {} } : { guarda: { blobs_guardados: blobs } } })
const rodar = async (db: FakeDb, prazoMs?: number, brutosAoAbrir?: number | null) => {
  const falhas: string[] = []
  const guarda = await conferirGuarda({ supabase: db.client, falhas, ...(prazoMs !== undefined && { prazoMs }), ...(brutosAoAbrir !== undefined && { brutosAoAbrir }) })
  return { guarda, falhas }
}
const brutosEmMemoria = (n: number): Linha[] => Array.from({ length: n }, (_, i) => bruto(`r${i}`))
const NOTA_ABERTURA = 'relatórios: brutos não contados antes do passo de relatórios; a queda de hoje foi comparada só depois dos downloads'
const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

afterEach(() => {
  vi.useRealTimers()
})

describe('E20: conferirGuarda', () => {
  it('todo baixado tem bruto: os números vêm, nenhuma falha; sem execução anterior não há base de comparação', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('b'), { report_id: 'c', status: 'listado' }], yt_reporting_report_blobs: [bruto('a'), bruto('b')] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 2, blobs_guardados_antes: null, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 })
    expect(falhas).toEqual([])
  })

  it('um baixado sem bruto E um bruto sem baixado: os dois aparecem (a subtração antiga daria zero)', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a'), baixado('faltou'), { report_id: 'sobrou', status: 'expirado_sem_baixar', expired_at: '2026-10-02T12:00:00.000Z' }],
      yt_reporting_report_blobs: [bruto('a'), bruto('sobrou')],
    })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 2, baixados_sem_bruto: 1, brutos_sem_baixado: 1 })
    expect(falhas).toEqual(['relatórios: 1 relatório(s) baixado(s) estão sem o bruto guardado (2 baixados, 2 brutos): liste e resolva pela seção 13 do runbook da coleta (devolver à fila ou reconhecer a perda)'])
  })

  it('bruto sem baixado sozinho (o resíduo da E12) fica visível e NÃO é falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [{ report_id: 'x', status: 'listado' }], yt_reporting_report_blobs: [bruto('x')] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ baixados_sem_bruto: 0, brutos_sem_baixado: 1 })
    expect(falhas).toEqual([])
  })

  it('perda reconhecida pelo dono (blob_lost_at): sai do alarme, conta em perdas_reconhecidas, nenhuma falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('perdido', { blob_lost_at: '2026-10-03T12:00:00.000Z' })], yt_reporting_report_blobs: [bruto('a')] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ baixados_sem_bruto: 0, perdas_reconhecidas: 1 })
    expect(falhas).toEqual([])
  })

  it('a função devolve nulo: "não conferida", nunca zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
    db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: null, baixados: 1, baixados_sem_bruto: null, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados).toBeNull()
    expect(guarda.baixados_sem_bruto).toBeNull()
    expect(guarda.perdas_reconhecidas).toBeNull()
    expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
  })

  it('a função devolve lista vazia ou nada: "não conferida"', async () => {
    for (const data of [[], null]) {
      const db = fakeSupabase({})
      db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data, error: null })
      const { guarda, falhas } = await rodar(db)
      expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
      expect(guarda.blobs_guardados).toBeNull()
    }
  })

  it('a função devolve texto que não é número (bigint como string vale; lixo não): lixo é "não conferida"', async () => {
    const db = fakeSupabase({})
    db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: '160', baixados: '160', baixados_sem_bruto: '0', brutos_sem_baixado: '0', perdas_reconhecidas: '0' }], error: null })
    expect((await rodar(db)).guarda).toMatchObject({ blobs_guardados: 160, baixados_sem_bruto: 0 })
    db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: 'x', baixados: '160', baixados_sem_bruto: '0', brutos_sem_baixado: '0', perdas_reconhecidas: '0' }], error: null })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados).toBeNull()
    expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
  })

  it('MG13 não aplicada (a função não existe): schema_ausente, campos nulos, nada lança', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')] })
    delete db.rpcHandlers.yt_reporting_guarda_conferir   // sem resposta registrada, o rpc do banco em memória devolve PGRST202
    const { guarda, falhas } = await rodar(db)
    expect(falhas).toContain('schema_ausente: yt_reporting_guarda_conferir')
    expect(guarda.blobs_guardados).toBeNull()
    expect(guarda.baixados_sem_bruto).toBeNull()
  })

  it('erro de banco na função: nota de erro, campos nulos', async () => {
    const db = fakeSupabase({})
    db.errors['rpc:yt_reporting_guarda_conferir'] = { code: '57014', message: 'statement timeout' }
    const { guarda, falhas } = await rodar(db)
    expect(falhas).toEqual(['erro de banco ao ler yt_reporting_guarda_conferir'])
    expect(guarda).toMatchObject({ blobs_guardados: null, baixados_sem_bruto: null, brutos_sem_baixado: null, perdas_reconhecidas: null })
  })

  it('queda contra a ÚLTIMA EXECUÇÃO QUE TEM NÚMERO (pula a que não conferiu): falha, com os dois números', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a')],
      yt_reporting_report_blobs: [bruto('a')],
      yt_own_collection_runs: [execucao('2026-10-03T12:02:00.000Z', null), execucao('2026-10-02T12:02:00.000Z', 3), execucao('2026-10-01T12:02:00.000Z', 9)],
    })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_antes: 3 })
    expect(falhas).toEqual(['relatórios: os brutos guardados caíram de 3 para 1 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
  })

  it('a queda dura um dia: na execução seguinte a base já é o número novo', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a')],
      yt_reporting_report_blobs: [bruto('a')],
      yt_own_collection_runs: [execucao('2026-10-04T12:02:00.000Z', 1), execucao('2026-10-02T12:02:00.000Z', 3)],
    })
    expect((await rodar(db)).falhas).toEqual([])
  })

  it('número igual ou maior que o da última execução: nenhuma falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('b')], yt_reporting_report_blobs: [bruto('a'), bruto('b')], yt_own_collection_runs: [execucao('2026-10-02T12:02:00.000Z', 1)] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados_antes).toBe(1)
    expect(falhas).toEqual([])
  })

  it('execuções anteriores sem nenhum número (a primeira depois do envio): base nula, sem comparação, sem falha', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')],
      yt_own_collection_runs: [execucao('2026-10-02T12:02:00.000Z', null), { ran_at: '2026-10-01T12:02:00.000Z', resumo: null }, { ran_at: '2026-09-30T12:02:00.000Z', resumo: { guarda: { blobs_guardados: null } } }],
    })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados_antes).toBeNull()
    expect(falhas).toEqual([])
  })

  it('a leitura das execuções anteriores falha: a anti-junção vale, a queda fica sem base e o erro aparece', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
    db.erroNaLeitura = (tabela) => (tabela === 'yt_own_collection_runs' ? { code: '08006', message: 'conexão caiu' } : undefined)
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_antes: null, baixados_sem_bruto: 0 })
    expect(falhas).toEqual(['erro de banco ao ler yt_own_collection_runs'])
  })

  it('conta os expirados sem registro de vencimento (anteriores à MG13, ou vencidos por idade)', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        { report_id: 'velho', status: 'expirado_sem_baixar' },
        { report_id: 'novo', status: 'expirado_sem_baixar', expired_at: '2026-10-02T12:00:00.000Z' },
      ],
    })
    expect((await rodar(db)).guarda.expirados_sem_registro).toBe(1)
  })

  it('a contagem dos expirados sem registro vem nula do banco: fica nula, com nota, nunca zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [{ report_id: 'velho', status: 'expirado_sem_baixar' }] })
    db.semContagem.yt_reporting_reports = true
    const { guarda, falhas } = await rodar(db)
    expect(guarda.expirados_sem_registro).toBeNull()
    expect(falhas).toEqual(['relatórios: expirados sem registro de vencimento não contados (o banco não devolveu a contagem)'])
  })

  it('a leitura dos expirados falha: nota de erro, e a anti-junção ainda roda', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
    db.erroNaLeitura = (tabela, _n, colunas) => (tabela === 'yt_reporting_reports' && colunas === 'report_id' ? { code: '57014', message: 'statement timeout' } : undefined)
    const { guarda, falhas } = await rodar(db)
    expect(falhas).toEqual(['erro de banco ao ler yt_reporting_reports'])
    expect(guarda).toMatchObject({ expirados_sem_registro: null, blobs_guardados: 1 })
  })

  describe('queda contada ANTES dos downloads do dia (I2 da revisão final: perda menor que a entrada do dia)', () => {
    const ontem160 = [execucao('2026-10-11T12:02:00.000Z', 160)]
    /** O fim da execução: 176 brutos (150 que sobraram + 26 baixados hoje), anti-junção em dia. */
    const fimDaExecucao = (db: FakeDb) => {
      db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: 176, baixados: 176, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
    }

    it('cenário do revisor: ontem 160, somem 10, o passo baixa 26, o fim dá 176: a contagem de ABERTURA (150) acusa a queda', async () => {
      const db = fakeSupabase({ yt_own_collection_runs: ontem160 })
      fimDaExecucao(db)
      const { guarda, falhas } = await rodar(db, undefined, 150)
      expect(guarda).toMatchObject({ blobs_guardados: 176, blobs_guardados_ao_abrir: 150, blobs_guardados_antes: 160 })
      expect(falhas).toEqual(['relatórios: os brutos guardados caíram de 160 para 150 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
    })

    it('sem perda: abertura igual à base e o fim maior (entrou o dia): nenhuma falha, e o que fica gravado é o total do fim', async () => {
      const db = fakeSupabase({ yt_own_collection_runs: ontem160 })
      fimDaExecucao(db)
      const { guarda, falhas } = await rodar(db, undefined, 160)
      expect(guarda).toMatchObject({ blobs_guardados: 176, blobs_guardados_ao_abrir: 160 })
      expect(falhas).toEqual([])
    })

    it('perda DURANTE a execução (o fim abaixo da abertura) também é acusada, com o menor número', async () => {
      const db = fakeSupabase({ yt_own_collection_runs: [execucao('2026-10-11T12:02:00.000Z', 100)] })
      db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: 150, baixados: 150, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
      const { falhas } = await rodar(db, undefined, 160)
      expect(falhas).toEqual(['relatórios: os brutos guardados caíram de 160 para 150 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])   // acima da base 100, mas abaixo do que a própria execução viu ao abrir
      const db2 = fakeSupabase({ yt_own_collection_runs: ontem160 })
      db2.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: 155, baixados: 155, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
      expect((await rodar(db2, undefined, 165)).falhas).toEqual(['relatórios: os brutos guardados caíram de 160 para 155 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
    })

    it('abertura não informada ou não contada: cai para o total do fim (comportamento anterior), sem inventar número', async () => {
      for (const aberta of [undefined, null]) {
        const db = fakeSupabase({ yt_own_collection_runs: ontem160 })
        db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: 150, baixados: 150, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
        const { guarda, falhas } = await rodar(db, undefined, aberta)
        expect(guarda.blobs_guardados_ao_abrir).toBeNull()
        expect(falhas).toEqual(['relatórios: os brutos guardados caíram de 160 para 150 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
      }
    })

    describe('contarBrutosAoAbrir', () => {
      it('devolve a contagem dos brutos, sem nota', async () => {
        const db = fakeSupabase({ yt_reporting_report_blobs: brutosEmMemoria(7) })
        const falhas: string[] = []
        expect(await contarBrutosAoAbrir({ supabase: db.client, falhas })).toBe(7)
        expect(falhas).toEqual([])
      })
      it('tabela vazia é zero de verdade (a contagem veio)', async () => {
        const falhas: string[] = []
        expect(await contarBrutosAoAbrir({ supabase: fakeSupabase({}).client, falhas })).toBe(0)
        expect(falhas).toEqual([])
      })
      it('erro de banco: null, com a nota do erro e a nota do que isso significa', async () => {
        const db = fakeSupabase({})
        db.erroNaLeitura = (tabela) => (tabela === 'yt_reporting_report_blobs' ? { code: '57014', message: 'statement timeout' } : undefined)
        const falhas: string[] = []
        expect(await contarBrutosAoAbrir({ supabase: db.client, falhas })).toBeNull()
        expect(falhas).toEqual(['erro de banco ao ler yt_reporting_report_blobs', NOTA_ABERTURA])
      })
      it('o banco não devolve a contagem (nula): null com nota, nunca zero', async () => {
        const db = fakeSupabase({ yt_reporting_report_blobs: brutosEmMemoria(3) })
        const original = db.client.from.bind(db.client)
        db.client.from = ((tabela: string) => (tabela === 'yt_reporting_report_blobs'
          ? { select: () => Promise.resolve({ data: null, error: null, count: null }) }
          : original(tabela))) as typeof db.client.from
        const falhas: string[] = []
        expect(await contarBrutosAoAbrir({ supabase: db.client, falhas })).toBeNull()
        expect(falhas).toEqual([NOTA_ABERTURA])
      })
      it('estouro do prazo próprio: null, nota com o prazo, e a resposta tardia não mexe em nada', async () => {
        const db = fakeSupabase({})
        db.client.from = (() => ({ select: () => new Promise<never>(() => {}) })) as typeof db.client.from
        const falhas: string[] = []
        expect(await contarBrutosAoAbrir({ supabase: db.client, falhas, prazoMs: 20 })).toBeNull()
        expect(falhas).toEqual([`${NOTA_ABERTURA} (passou do prazo de 20 ms)`])
      })
      it('o prazo padrão é curto e cabe folgado dentro do da conferência do fim', () => {
        expect(GUARDA_ABERTURA_PRAZO_MS).toBeGreaterThan(0)
        expect(GUARDA_ABERTURA_PRAZO_MS).toBeLessThan(GUARDA_PRAZO_MS)
      })
      it('terminando a tempo, não deixa timer pendente', async () => {
        vi.useFakeTimers()
        await contarBrutosAoAbrir({ supabase: fakeSupabase({}).client, falhas: [] })
        expect(vi.getTimerCount()).toBe(0)
      })
    })
  })

  describe('prazo próprio (o relógio de 270 s da coleta não pode ser estourado pela conferência)', () => {
    it('o prazo padrão é curto: cabe nos 30 s de reserva que o relógio global deixa para o veredito', () => {
      expect(GUARDA_PRAZO_MS).toBeGreaterThan(0)
      expect(GUARDA_PRAZO_MS).toBeLessThanOrEqual(10_000)
    })

    it('a função do banco que não responde: o estouro vira nota, os campos ficam nulos, nada lança', async () => {
      const db = fakeSupabase({})
      db.rpcHandlers.yt_reporting_guarda_conferir = () => new Promise<never>(() => {})
      const { guarda, falhas } = await rodar(db, 20)
      expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (passou do prazo de 20 ms)'])
      expect(guarda).toEqual({
        blobs_guardados: null, blobs_guardados_ao_abrir: null, blobs_guardados_antes: null, baixados_sem_bruto: null, brutos_sem_baixado: null, perdas_reconhecidas: null, expirados_sem_registro: null,
      })
    })

    it('a consulta das execuções anteriores que não responde também estoura: nenhum número parcial vaza como se fosse completo', async () => {
      const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
      const original = db.client.from.bind(db.client)
      const pendurada = { select: () => ({ order: () => ({ limit: () => new Promise<never>(() => {}) }) }) }
      db.client.from = ((tabela: string) => (tabela === 'yt_own_collection_runs' ? pendurada : original(tabela))) as typeof db.client.from
      const { guarda, falhas } = await rodar(db, 20)
      expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (passou do prazo de 20 ms)'])
      expect(guarda.baixados_sem_bruto).toBeNull()
    })

    it('a resposta que chega DEPOIS do prazo não mexe em nada (nem nota, nem número)', async () => {
      const db = fakeSupabase({})
      db.rpcHandlers.yt_reporting_guarda_conferir = async () => {
        await dormir(60)
        return { data: [{ brutos: 5, baixados: 5, baixados_sem_bruto: 5, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null }
      }
      const { guarda, falhas } = await rodar(db, 20)
      await dormir(120)
      expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (passou do prazo de 20 ms)'])
      expect(guarda.baixados_sem_bruto).toBeNull()
    })

    it('terminando a tempo, não deixa timer pendente (o processo não segura a função)', async () => {
      vi.useFakeTimers()
      const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
      await rodar(db)
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
