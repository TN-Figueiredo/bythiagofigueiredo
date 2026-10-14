// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabase, type FakeDb } from './fake-supabase'
import {
  configE11, janelaDoConjunto, lerProva, chamarProva, schemaE11, type ProvaE11,
  DIMENSOES_DESDE, DIMENSOES_LIGADO_EM, JANELA_DIAS, MAX_CONSULTAS_DIMENSOES, FOLGA_PARA_COMECAR_MS,
  CARENCIA_COBERTURA_DIAS, CARENCIA_NORMALIZAR_DIAS, PRAZO_DA_PROVA_MS, TIPOS_E11, LOTE_DESDE,
} from '@/lib/youtube/coleta/e11-config'

afterEach(() => { vi.useRealTimers() })

const PROVA: ProvaE11 = {
  faltando_cobertura: 0, videos_com_base: 12, videos_base_antes_do_inicio: 1, videos_sem_base: 2,
  base_ate: '2026-10-11', dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 3,
}
const P = { site: 'site-1', hoje: '2026-10-13', desde: '2026-10-03' }
const longe = () => Date.now() + 60_000
const comProva = (db: FakeDb, data: unknown = PROVA) => { db.rpcHandlers.yt_own_dim_prova = () => ({ data, error: null }); return db }

describe('constantes', () => {
  it('valores do contrato', () => {
    expect(JANELA_DIAS).toBe(10)
    expect(MAX_CONSULTAS_DIMENSOES).toBe(400)
    expect(FOLGA_PARA_COMECAR_MS).toBe(3_000)
    expect(CARENCIA_COBERTURA_DIAS).toBe(3)
    expect(CARENCIA_NORMALIZAR_DIAS).toBe(5)
    expect(PRAZO_DA_PROVA_MS).toBe(5_000)
    expect(TIPOS_E11).toEqual({ detalhe: 'channel_traffic_source_a3', alcance_dim: 'channel_reach_combined_a1' })
    expect(LOTE_DESDE).toBe('2026-09-08')
  })
})

describe('configE11', () => {
  it.each([
    ['vazia', { desde: '', ligadoEm: '' }],
    ['só desde', { desde: '2026-10-01' }],
    ['só ligadoEm', { ligadoEm: '2026-10-01' }],
    ['objeto vazio', {}],
    ['formato inválido', { desde: '01/10/2026', ligadoEm: '2026-10-11' }],
    ['sem zero à esquerda', { desde: '2026-1-1', ligadoEm: '2026-10-11' }],
    ['data que não existe (31 de novembro)', { desde: '2026-11-31', ligadoEm: '2026-12-05' }],
    ['29 de fevereiro de ano não bissexto', { desde: '2026-02-29', ligadoEm: '2026-03-05' }],
    ['desde depois de ligadoEm', { desde: '2026-10-12', ligadoEm: '2026-10-11' }],
  ])('%s = não ok com motivo', (_nome, entrada) => {
    const r = configE11(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0)
  })

  it('válida, e desde igual a ligadoEm é aceito', () => {
    expect(configE11({ desde: '2026-10-01', ligadoEm: '2026-10-11' })).toEqual({ ok: true, desde: '2026-10-01', ligadoEm: '2026-10-11' })
    expect(configE11({ desde: '2026-10-11', ligadoEm: '2026-10-11' }).ok).toBe(true)
    expect(configE11({ desde: '2024-02-29', ligadoEm: '2024-03-01' }).ok).toBe(true)
  })

  it('as constantes do repositório são uma configuração válida', () => {
    expect(DIMENSOES_DESDE).not.toBe('')
    expect(DIMENSOES_LIGADO_EM).not.toBe('')
    expect(configE11()).toEqual({ ok: true, desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM })
  })
})

describe('janelaDoConjunto', () => {
  const base = { desde: '2026-10-01', hoje: '2026-10-13', baseAte: '2026-10-12' }

  it('nunca antes de desde (item 228, parte pura)', () => {
    expect(janelaDoConjunto({ ...base, desde: '2026-10-08', ultimoCoberto: null })).toEqual({ de: '2026-10-08', ate: '2026-10-12' })
    expect(janelaDoConjunto({ ...base, ultimoCoberto: '2026-09-01' })).toEqual({ de: '2026-10-01', ate: '2026-10-12' })
  })

  it('sem cobertura começa em desde, se desde é depois de hoje − 10 ainda assim vale desde', () => {
    expect(janelaDoConjunto({ ...base, ultimoCoberto: null })).toEqual({ de: '2026-10-01', ate: '2026-10-12' })
  })

  it('em regime o começo é hoje − 10 quando o último coberto é recente', () => {
    expect(janelaDoConjunto({ ...base, desde: '2026-09-01', ultimoCoberto: '2026-10-12' })).toEqual({ de: '2026-10-03', ate: '2026-10-12' })
  })

  it('último coberto há 20 dias começa nele', () => {
    expect(janelaDoConjunto({ ...base, desde: '2026-09-01', ultimoCoberto: '2026-09-23' })).toEqual({ de: '2026-09-23', ate: '2026-10-12' })
  })

  it('base nula = null', () => {
    expect(janelaDoConjunto({ ...base, ultimoCoberto: null, baseAte: null })).toBeNull()
  })

  it('base antes de de = null', () => {
    expect(janelaDoConjunto({ ...base, desde: '2026-10-08', ultimoCoberto: null, baseAte: '2026-10-05' })).toBeNull()
  })

  it('base depois de hoje é cortada em hoje', () => {
    expect(janelaDoConjunto({ ...base, baseAte: '2026-10-20', ultimoCoberto: null })).toEqual({ de: '2026-10-01', ate: '2026-10-13' })
  })

  it('de igual a ate é uma janela de um dia', () => {
    expect(janelaDoConjunto({ ...base, desde: '2026-10-12', ultimoCoberto: null })).toEqual({ de: '2026-10-12', ate: '2026-10-12' })
  })

  it('atravessa virada de mês e de ano', () => {
    expect(janelaDoConjunto({ desde: '2025-12-01', hoje: '2026-01-05', ultimoCoberto: '2026-01-04', baseAte: '2026-01-04' })).toEqual({ de: '2025-12-26', ate: '2026-01-04' })
  })
})

describe('lerProva', () => {
  it('forma completa é ok e a prova volta igual', () => {
    expect(lerProva(PROVA)).toEqual({ ok: true, prova: PROVA })
  })

  it('base_ate nula é válida', () => {
    expect(lerProva({ ...PROVA, base_ate: null })).toEqual({ ok: true, prova: { ...PROVA, base_ate: null } })
  })

  it.each(Object.keys(PROVA))('campo %s faltando = não ok com o nome do campo', (campo) => {
    const x: Record<string, unknown> = { ...PROVA }
    delete x[campo]
    expect(lerProva(x)).toEqual({ ok: false, campo })
  })

  it('texto no lugar de número = não ok com o nome do campo (nunca vira 0)', () => {
    expect(lerProva({ ...PROVA, faltando_cobertura: '3' })).toEqual({ ok: false, campo: 'faltando_cobertura' })
    expect(lerProva({ ...PROVA, pendentes_normalizar: null })).toEqual({ ok: false, campo: 'pendentes_normalizar' })
    expect(lerProva({ ...PROVA, videos_sem_base: Number.NaN })).toEqual({ ok: false, campo: 'videos_sem_base' })
  })

  it('negativo = não ok', () => {
    expect(lerProva({ ...PROVA, videos_com_base: -1 })).toEqual({ ok: false, campo: 'videos_com_base' })
  })

  it('base_ate com formato ruim = não ok', () => {
    expect(lerProva({ ...PROVA, base_ate: 'ontem' })).toEqual({ ok: false, campo: 'base_ate' })
    expect(lerProva({ ...PROVA, base_ate: 20261011 })).toEqual({ ok: false, campo: 'base_ate' })
  })

  it('não objeto = não ok', () => {
    for (const x of [null, undefined, 'x', 3, [PROVA]]) expect(lerProva(x).ok).toBe(false)
  })
})

describe('chamarProva', () => {
  it('chama a função com os três parâmetros e devolve a prova lida', async () => {
    const db = comProva(fakeSupabase())
    const r = await chamarProva(db.client, P, longe())
    expect(r).toEqual({ ok: true, prova: PROVA })
    expect(db.rpcCalls).toEqual([{ name: 'yt_own_dim_prova', args: { p_site: 'site-1', p_hoje: '2026-10-13', p_desde: '2026-10-03' } }])
  })

  it('promessa que não resolve = sem_resposta (no prazo da prova)', async () => {
    vi.useFakeTimers()
    const db = fakeSupabase()
    db.rpcHandlers.yt_own_dim_prova = () => new Promise(() => {}) as never
    const p = chamarProva(db.client, P, Date.now() + 60_000)
    await vi.advanceTimersByTimeAsync(PRAZO_DA_PROVA_MS + 1)
    expect(await p).toEqual({ ok: false, motivo: 'sem_resposta' })
  })

  it('o prazo do passo menor que o da prova manda', async () => {
    vi.useFakeTimers()
    const db = fakeSupabase()
    db.rpcHandlers.yt_own_dim_prova = () => new Promise(() => {}) as never
    const p = chamarProva(db.client, P, Date.now() + 1_000)
    await vi.advanceTimersByTimeAsync(1_001)
    expect(await p).toEqual({ ok: false, motivo: 'sem_resposta' })
  })

  it('prazo do passo já vencido: sem_resposta sem chamar o banco', async () => {
    const db = comProva(fakeSupabase())
    expect(await chamarProva(db.client, P, Date.now() - 1)).toEqual({ ok: false, motivo: 'sem_resposta' })
    expect(db.rpcCalls).toHaveLength(0)
  })

  it('42883 e PGRST202 = schema_ausente', async () => {
    for (const code of ['42883', 'PGRST202']) {
      const db = fakeSupabase()
      db.errors['rpc:yt_own_dim_prova'] = { code, message: 'x' }
      expect(await chamarProva(db.client, P, longe())).toEqual({ ok: false, motivo: 'schema_ausente' })
    }
  })

  it('outro erro = erro_de_banco, sem carregar o texto', async () => {
    const db = fakeSupabase()
    db.errors['rpc:yt_own_dim_prova'] = { code: '57014', message: 'statement timeout segredo' }
    const r = await chamarProva(db.client, P, longe())
    expect(r).toEqual({ ok: false, motivo: 'erro_de_banco' })
    expect(JSON.stringify(r)).not.toContain('segredo')
  })

  it('resposta nula ou com campo faltando = forma_inesperada com o campo', async () => {
    expect(await chamarProva(comProva(fakeSupabase(), null).client, P, longe())).toMatchObject({ ok: false, motivo: 'forma_inesperada' })
    const { pendentes_normalizar: _x, ...semUm } = PROVA
    expect(await chamarProva(comProva(fakeSupabase(), semUm).client, P, longe())).toEqual({ ok: false, motivo: 'forma_inesperada', campo: 'pendentes_normalizar' })
  })

  it('rpc que lança = erro_de_banco, não exceção', async () => {
    const db = fakeSupabase()
    db.rpcHandlers.yt_own_dim_prova = () => { throw new Error('rede') }
    expect(await chamarProva(db.client, P, longe())).toEqual({ ok: false, motivo: 'erro_de_banco' })
  })
})

describe('schemaE11', () => {
  it('prova responde: ok com a prova, sem tocar na cobertura', async () => {
    const db = comProva(fakeSupabase())
    expect(await schemaE11(db.client, P, longe())).toEqual({ ok: true, prova: PROVA })
    expect(db.rpcCalls).toHaveLength(1)
  })

  it('42883 diz MG7', async () => {
    const db = fakeSupabase({ yt_own_video_coverage: [] })
    db.errors['rpc:yt_own_dim_prova'] = { code: '42883', message: 'function does not exist' }
    expect(await schemaE11(db.client, P, longe())).toEqual({ ok: false, nota: 'schema_ausente: MG7 não aplicada (yt_own_dim_prova)' })
  })

  it('PGRST205 na cobertura diz MG14', async () => {
    const db = fakeSupabase()
    db.errors['rpc:yt_own_dim_prova'] = { code: '42P01', message: 'relation does not exist' }
    db.errors.yt_own_video_coverage = { code: 'PGRST205', message: 'Could not find the table' }
    expect(await schemaE11(db.client, P, longe())).toEqual({ ok: false, nota: 'schema_ausente: MG14 não aplicada (yt_own_video_coverage)' })
  })

  it('erro de banco e sem resposta viram nota sem o texto do Postgres', async () => {
    const db = fakeSupabase()
    db.errors['rpc:yt_own_dim_prova'] = { code: '57014', message: 'statement timeout segredo' }
    const r = await schemaE11(db.client, P, longe())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.nota).toBe('erro de banco ao ler yt_own_dim_prova')
      expect(r.nota).not.toContain('segredo')
    }
  })

  it('forma inesperada vira nota com o campo', async () => {
    const { base_ate: _b, ...semBase } = PROVA
    const r = await schemaE11(comProva(fakeSupabase(), semBase).client, P, longe())
    expect(r).toEqual({ ok: false, nota: 'dimensões: a prova de cobertura veio sem o campo base_ate' })
  })

  it('sem resposta vira nota própria', async () => {
    const r = await schemaE11(comProva(fakeSupabase()).client, P, Date.now() - 1)
    expect(r).toEqual({ ok: false, nota: 'dimensões: a prova de cobertura não respondeu a tempo' })
  })
})

describe('relação entre as duas datas', () => {
  it('desde = ligadoEm menos JANELA_DIAS dias', () => {
    const d = new Date(`${DIMENSOES_LIGADO_EM}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() - JANELA_DIAS)
    expect(d.toISOString().slice(0, 10)).toBe(DIMENSOES_DESDE)
  })
})

describe('env: a configuração não lê variável de ambiente', () => {
  it('apagar as variáveis não muda o padrão das constantes (o padrão é o do repositório)', () => {
    delete process.env.DIMENSOES_DESDE
    delete process.env.DIMENSOES_LIGADO_EM
    delete process.env.YT_OWN_STEPS_OFF
    expect(configE11()).toEqual({ ok: true, desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM })
  })
})

describe('schemaE11: resposta que não é objeto', () => {
  it('nota sem inventar nome de campo', async () => {
    const r = await schemaE11(comProva(fakeSupabase(), null).client, P, longe())
    expect(r).toEqual({ ok: false, nota: 'dimensões: a prova de cobertura veio em forma inesperada' })
  })
})
