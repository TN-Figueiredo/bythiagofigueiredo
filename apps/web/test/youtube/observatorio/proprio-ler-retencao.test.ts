// @vitest-environment node
// A5 · E8 · Tarefa 12b: leitor de servidor da curva de retenção do vídeo próprio (banco falso; o banco de verdade é o arquivo -db).
// Pergunta que guia os testes: "o que acontece quando o dado não existe?". Ausência nunca vira zero nem "ok" silencioso.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe, leituraPorDireitoDe } from './leitura-teste'
import { edicaoDe } from './edicao-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerDiario } from '@/lib/youtube/observatorio/proprio/ler'
import { lerRetencao, TETO_LEITURAS, TETO_TENTATIVAS } from '@/lib/youtube/observatorio/proprio/ler-retencao'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import { lerCurva } from '@/lib/youtube/observatorio/proprio/retencao-curva'

const captureException = vi.fn()
const captureMessage = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), captureMessage: (...a: unknown[]) => captureMessage(...a) }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', OUTRO_CANAL = '9a9a9a9a-5a47-4d0e-9b1c-7e6a2d4f8a10'
const V = 'vid00000001', OUTRO_V = 'vid00000002'
const HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const SENTINELA = 'zz-sentinela-12b'
afterEach(() => { captureException.mockClear(); captureMessage.mockClear() })

/** 100 pontos da grade 0,01 a 1,00 (o `segment_impressions` vem junto no banco e NÃO sai do leitor). */
const grade = (n = 100): Array<Record<string, unknown>> => Array.from({ length: n }, (_, k) => ({ t: (k + 1) / n, ratio: 1 - k / (2 * n), relative: 0.5, segment_impressions: 10 + k }))
const ret = (kind: string, fim: string, over: Row = {}): Row => ({
  youtube_video_id: V, window_kind: kind, segment: 'organico', window_start: d(60), window_end: fim, requested_end: fim,
  site_id: S, channel_id: C, points: grade(), point_count: 100, metrics_returned: ['elapsedVideoTimeRatio', 'audienceWatchRatio'],
  views_at_read: 1234, collected_at: fim + 'T10:00:00Z', ...over,
})
const tent = (dia: string, outcome: string, over: Row = {}): Row => ({
  scope_type: 'video', scope_id: V, kind: 'retencao_vida', attempt_day: dia, site_id: S, channel_id: C, outcome, last_attempt_at: dia + 'T10:00:00Z', ...over,
})

/** Um cliente que faz falhar com o código dado toda leitura de UMA tabela (o falso só sabe falhar com XX000). */
function comErroNaTabela(sb: SupabaseClient, tabela: string, code: string): SupabaseClient {
  return {
    from: (t: string) => {
      if (t !== tabela) return sb.from(t)
      const falha = { data: null, error: { code, message: 'conteudo ' + SENTINELA } }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'neq', 'is']) q[m] = () => q
      q.range = async () => falha
      q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(falha).then(ok, ko)
      return q
    },
  } as unknown as SupabaseClient
}
/** Uma tabela que responde `data: null` SEM erro (resposta que não é lista). */
function comDataNula(sb: SupabaseClient, tabela: string): SupabaseClient {
  return {
    from: (t: string) => {
      if (t !== tabela) return sb.from(t)
      const vazio = { data: null, error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'neq', 'is']) q[m] = () => q
      q.range = async () => vazio
      q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(vazio).then(ok, ko)
      return q
    },
  } as unknown as SupabaseClient
}

let pedido: { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: string; ytId: string }
beforeAll(async () => { pedido = { leitura: await leituraDe(S), canalId: C, hoje: HOJE, ytId: V } })
const ok = async (db: { client: SupabaseClient }, p = pedido) => {
  const r = await lerRetencao(db.client, p)
  if (r.acesso !== 'ok') throw new Error('esperava ok, veio ' + r.acesso)
  return r.dado
}

describe('acesso: o token de edição e a forma do pedido', () => {
  it('sem token: negado e NENHUMA consulta', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1))], yt_own_collection_attempts: [tent(d(1), 'ok')] })
    expect(await lerRetencao(db.client, { ...pedido, leitura: null })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('token forjado (objeto literal): negado e nenhuma consulta', async () => {
    const db = fakeSupabase({})
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    expect(await lerRetencao(db.client, { ...pedido, leitura: forjado })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('a guarda é a mesma de ler.ts: edição forjada, canalId que não é uuid e ytId inválido dão negado aqui e em lerDiario', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    const invalidos = [
      { ...pedido, leitura: null },
      { ...pedido, leitura: forjado },
      { ...pedido, canalId: 'nao-e-uuid' },
      { ...pedido, canalId: '' },
      { ...pedido, canalId: C + 'x' },
    ]
    for (const p of invalidos) {
      const db = fakeSupabase({})
      expect(await lerRetencao(db.client, p), JSON.stringify(p.canalId)).toEqual({ acesso: 'negado' })
      expect(await lerDiario(db.client, { ...p, ytIds: [V] }), JSON.stringify(p.canalId)).toEqual({ acesso: 'negado' })
      expect(db.trips).toEqual([])
    }
  })
  it('ytId fora de /^[A-Za-z0-9_-]{11}$/: negado sem consulta', async () => {
    for (const ytId of ['', 'curto', 'vid000000012', 'vid 0000001', 'vid/0000001', 'vid0000000\n', "vid';drop--", 'vid0000000é']) {
      const db = fakeSupabase({})
      expect(await lerRetencao(db.client, { ...pedido, ytId }), JSON.stringify(ytId)).toEqual({ acesso: 'negado' })
      expect(db.trips, JSON.stringify(ytId)).toEqual([])
    }
    // não é texto: também negado (o tipo diz string, o JSON da rota não)
    const db = fakeSupabase({})
    expect(await lerRetencao(db.client, { ...pedido, ytId: 12345678901 as unknown as string })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('ytId com hífen e sublinhado é válido', async () => {
    const db = fakeSupabase({})
    const r = await lerRetencao(db.client, { ...pedido, ytId: 'a-b_C-d_E-f' })
    expect(r.acesso).toBe('ok')
  })
})

describe('o que acontece quando o dado não existe', () => {
  it('tabelas vazias: sem curva, sem leitura, sem tentativa (nada vira zero)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [], yt_own_collection_attempts: [] })
    expect(await ok(db)).toEqual({
      ytId: V, curvas: {}, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: false, janelasIlegiveis: [],
    })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('só tentativa sem_dado_na_janela: ultimaTentativa e ultimaResposta com o dia e o resultado; curvas vazias', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [], yt_own_collection_attempts: [tent(d(2), 'sem_dado_na_janela')] })
    const r = await ok(db)
    expect(r.curvas).toEqual({})
    expect(r.ultimaTentativa).toEqual({ dia: d(2), resultado: 'sem_dado_na_janela' })
    expect(r.ultimaResposta).toEqual({ dia: d(2), resultado: 'sem_dado_na_janela' })
  })
  it('resposta vazia há 8 dias e erro_http ontem: ultimaTentativa = ontem (erro_http); ultimaResposta = há 8 dias (sem_dado_na_janela)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [], yt_own_collection_attempts: [tent(d(8), 'sem_dado_na_janela'), tent(d(1), 'erro_http')] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.ultimaResposta).toEqual({ dia: d(8), resultado: 'sem_dado_na_janela' })
  })
  it('só tentativas sem resposta: ultimaResposta nulo', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tent(d(1), 'erro_http'), tent(d(2), 'sem_autorizacao'), tent(d(3), 'nao_alcancado_orcamento'), tent(d(4), 'schema_ausente')] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.ultimaResposta).toBeNull()
  })
  it('a última resposta fica além das 30 tentativas lidas: é buscada à parte (null seria mentira)', async () => {
    const muitas = Array.from({ length: TETO_TENTATIVAS }, (_, k) => tent(d(k + 1), 'erro_http'))
    const db = fakeSupabase({ yt_own_collection_attempts: [...muitas, tent(d(200), 'ok')] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.ultimaResposta).toEqual({ dia: d(200), resultado: 'ok' })
    expect(db.trips.filter(t => t === 'yt_own_collection_attempts')).toHaveLength(2)
  })
  it('30 tentativas sem resposta e nenhuma além: ultimaResposta nulo', async () => {
    const muitas = Array.from({ length: TETO_TENTATIVAS }, (_, k) => tent(d(k + 1), 'erro_http'))
    const db = fakeSupabase({ yt_own_collection_attempts: muitas })
    expect((await ok(db)).ultimaResposta).toBeNull()
  })
  it('com menos de 30 tentativas a busca à parte não acontece', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tent(d(1), 'erro_http')] })
    await ok(db)
    expect(db.trips.filter(t => t === 'yt_own_collection_attempts')).toHaveLength(1)
  })
  it('as 30 linhas lidas são a lista da mais nova para a mais velha, pedidas com range(0, 29)', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: Array.from({ length: 45 }, (_, k) => tent(d(k + 1), 'erro_http')) })
    await ok(db)
    const faixas = db.ranges.filter(r => r.table === 'yt_own_collection_attempts').map(r => r.range)
    expect(faixas[0]).toEqual([0, TETO_TENTATIVAS - 1])
  })
  it('a tentativa MAIS NOVA com dia ilegível lança: a seguinte não vira "última" em silêncio (M-1)', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tent('zzzz', 'ok', { last_attempt_at: d(0) + 'T23:00:00Z' }), tent(d(3), 'erro_http')] })
    await expect(lerRetencao(db.client, pedido)).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('tentativa mais antiga com dia ilegível: ignorada e contada; a legível mais nova segue como última', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tent(d(1), 'erro_http'), tent('2026-02-30', 'ok')] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.descartados).toBe(1)
  })
  it('resultado que não é texto: "desconhecido", nunca "ok"', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tent(d(1), null as unknown as string)] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'desconhecido' })
    expect(r.ultimaResposta).toBeNull()
  })
})

describe('as curvas', () => {
  it('duas leituras de vida: a mais nova é a curva, as duas entram na lista (da mais nova para a mais velha)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [
      ret('vida', d(9), { views_at_read: 10 }), ret('vida', d(2), { views_at_read: 20 }),
    ] })
    const r = await ok(db)
    expect(Object.keys(r.curvas)).toEqual(['vida'])
    expect(r.curvas.vida).toMatchObject({ janela: 'vida', windowEnd: d(2), windowStart: d(60), coletadaEm: d(2) + 'T10:00:00Z', viewsAtRead: 20 })
    expect(r.leituras).toEqual([
      { janela: 'vida', windowEnd: d(2), coletadaEm: d(2) + 'T10:00:00Z' },
      { janela: 'vida', windowEnd: d(9), coletadaEm: d(9) + 'T10:00:00Z' },
    ])
    expect(r.leiturasCortadas).toBe(false)
  })
  it('três janelas: três curvas, cada uma a mais recente da sua janela', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [
      ret('vida', d(1)), ret('vida', d(5)), ret('primeiros_7_dias', d(30)), ret('primeiros_30_dias', d(10)),
    ] })
    const r = await ok(db)
    expect(Object.keys(r.curvas).sort()).toEqual(['primeiros_30_dias', 'primeiros_7_dias', 'vida'])
    expect(r.curvas.vida?.windowEnd).toBe(d(1))
    expect(r.curvas.primeiros_7_dias?.windowEnd).toBe(d(30))
    expect(r.curvas.primeiros_30_dias?.windowEnd).toBe(d(10))
    expect(r.leituras.map(l => l.janela)).toEqual(['vida', 'vida', 'primeiros_30_dias', 'primeiros_7_dias'])
  })
  it('uma janela sem leitura fica fora das curvas (não vira curva vazia)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1))] })
    const r = await ok(db)
    expect(r.curvas.primeiros_7_dias).toBeUndefined()
    expect(r.curvas.primeiros_30_dias).toBeUndefined()
    expect('primeiros_7_dias' in r.curvas).toBe(false)
  })
  it('a janela rara fora das 200 mais novas da lista ainda aparece como curva (consulta própria por janela)', async () => {
    const vidas = Array.from({ length: 205 }, (_, k) => ret('vida', d(k + 1)))
    const db = fakeSupabase({ yt_own_video_retention: [...vidas, ret('primeiros_7_dias', d(400))] })
    const r = await ok(db)
    expect(r.leiturasCortadas).toBe(true)
    expect(r.leituras.every(l => l.janela === 'vida')).toBe(true)
    expect(r.curvas.primeiros_7_dias?.windowEnd).toBe(d(400))
  })
  it('os pontos saem só com t, ratio e relative (segment_impressions fica no banco) e a curva completa passa pelo modelo da 12a', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1))] })
    const c = (await ok(db)).curvas.vida!
    expect(c.pontos).toHaveLength(100)
    expect(c.pontos[0]).toEqual({ t: 0.01, ratio: 1, relative: 0.5 })
    expect(Object.keys(c.pontos[99]!).sort()).toEqual(['ratio', 'relative', 't'])
    expect(c.metricas).toEqual(['elapsedVideoTimeRatio', 'audienceWatchRatio'])
    const leitura = lerCurva(c.pontos)
    expect(leitura?.completa).toBe(true)
  })
  it('relative nulo continua nulo (a API não mediu; nunca 0) e relative ausente também', async () => {
    const pontos = [{ t: 0.5, ratio: 0.8, relative: null }, { t: 1, ratio: 0.4 }]
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { points: pontos, point_count: 2 })] })
    expect((await ok(db)).curvas.vida!.pontos).toEqual([{ t: 0.5, ratio: 0.8, relative: null }, { t: 1, ratio: 0.4, relative: null }])
  })
  it('ratio acima de 1 (replays) e ratio 0 medido passam como estão', async () => {
    const pontos = [{ t: 0.5, ratio: 1.3, relative: 0.4 }, { t: 1, ratio: 0, relative: 0 }]
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { points: pontos, point_count: 2 })] })
    expect((await ok(db)).curvas.vida!.pontos).toEqual([{ t: 0.5, ratio: 1.3, relative: 0.4 }, { t: 1, ratio: 0, relative: 0 }])
  })
  it('views_at_read nulo fica nulo (não se sabia), nunca 0; texto numérico (bigint) vira número; lixo vira nulo', async () => {
    for (const [entrada, saida] of [[null, null], [0, 0], ['0', 0], ['4096', 4096], [77, 77], [-5, null], ['abc', null], [Number.NaN, null], ['', null]] as const) {
      const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { views_at_read: entrada })] })
      expect((await ok(db)).curvas.vida!.viewsAtRead, String(entrada)).toBe(saida)
    }
  })
  it('201 leituras: leiturasCortadas true e 200 na lista; 200 não corta', async () => {
    const mk = (n: number) => fakeSupabase({ yt_own_video_retention: Array.from({ length: n }, (_, k) => ret('vida', d(k + 1))) })
    const cortada = await ok(mk(TETO_LEITURAS + 1))
    expect(cortada.leiturasCortadas).toBe(true)
    expect(cortada.leituras).toHaveLength(TETO_LEITURAS)
    expect(cortada.leituras[0]!.windowEnd).toBe(d(1))
    const exata = await ok(mk(TETO_LEITURAS))
    expect(exata.leiturasCortadas).toBe(false)
    expect(exata.leituras).toHaveLength(TETO_LEITURAS)
  })
  it('a lista é pedida SEM points, com 201 linhas; as curvas pedem 1 linha cada (no máximo três consultas pequenas)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1)), ret('primeiros_7_dias', d(1)), ret('primeiros_30_dias', d(1))] })
    await ok(db)
    const dosRetencao = db.selects.map((s, i) => ({ ...s, range: db.ranges[i]!.range })).filter(s => s.table === 'yt_own_video_retention')
    const lista = dosRetencao.filter(s => !/points/.test(s.cols))
    const comPontos = dosRetencao.filter(s => /points/.test(s.cols))
    expect(lista).toHaveLength(1)
    expect(lista[0]!.range).toEqual([0, TETO_LEITURAS])
    expect(comPontos).toHaveLength(3)
    for (const c of comPontos) expect(c.range).toEqual([0, 0])
  })
})

describe('ponto em forma ruim: a curva inteira é tratada como ausente e descartados sobe', () => {
  const ruins: Array<[string, unknown]> = [
    ['ratio de texto', [{ t: 0.5, ratio: '0.8', relative: 0.5 }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['t de texto', [{ t: '0.5', ratio: 0.8, relative: 0.5 }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['ratio negativo', [{ t: 0.5, ratio: -0.1, relative: 0.5 }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['t acima de 1', [{ t: 0.5, ratio: 0.8, relative: 0.5 }, { t: 1.2, ratio: 0.4, relative: 0.5 }]],
    ['t negativo', [{ t: -0.1, ratio: 0.8, relative: 0.5 }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['t repetido', [{ t: 0.5, ratio: 0.8, relative: 0.5 }, { t: 0.5, ratio: 0.4, relative: 0.5 }]],
    ['fora de ordem', [{ t: 1, ratio: 0.8, relative: 0.5 }, { t: 0.5, ratio: 0.4, relative: 0.5 }]],
    ['relative de texto', [{ t: 0.5, ratio: 0.8, relative: 'alto' }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['ponto nulo', [null, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['ponto que é número', [3, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['ratio ausente', [{ t: 0.5, relative: 0.5 }, { t: 1, ratio: 0.4, relative: 0.5 }]],
    ['lista vazia', []],
    ['points que não é lista', { t: 1 }],
    ['points nulo', null],
  ]
  for (const [nome, pontos] of ruins) {
    it(nome, async () => {
      const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { points: pontos, point_count: 2 })] })
      const r = await ok(db)
      expect(r.curvas).toEqual({})
      expect(r.janelasIlegiveis).toEqual(['vida'])
      expect(r.descartados).toBe(1)
      // a leitura continua na lista (existe, só não é desenhável)
      expect(r.leituras).toHaveLength(1)
    })
  }
  it('ratio infinito/NaN (JSON não os carrega, mas o falso sim): descartado', async () => {
    for (const x of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { points: [{ t: 1, ratio: x, relative: null }], point_count: 1 })] })
      expect((await ok(db)).descartados).toBe(1)
    }
  })
  it('linha com metrics_returned, datas ou coleta ilegíveis: curva ausente, descartados', async () => {
    for (const over of [{ metrics_returned: null }, { metrics_returned: [1, 2] }, { metrics_returned: 'x' }, { window_end: 'amanhã' }, { window_start: null }, { window_start: '2026-02-30' }, { collected_at: 'ontem' }, { collected_at: null }, { collected_at: '12' }, { collected_at: '2026' }]) {
      const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), over)] })
      const r = await ok(db)
      expect(r.curvas, JSON.stringify(over)).toEqual({})
      expect(r.descartados, JSON.stringify(over)).toBeGreaterThanOrEqual(1)
    }
  })
  for (const [kind, janela] of [['vida', 'vida'], ['primeiros_7_dias', 'primeiros_7_dias'], ['primeiros_30_dias', 'primeiros_30_dias']] as const) {
    it(`I-1: a curva mais recente de ${janela} ilegível entra em janelasIlegiveis (não é "não coletada")`, async () => {
      const db = fakeSupabase({ yt_own_video_retention: [ret(kind, d(1), { points: [{ t: 1, ratio: 'x', relative: null }], point_count: 1 })], yt_own_collection_attempts: [tent(d(1), 'ok')] })
      const r = await ok(db)
      expect(r.curvas).toEqual({})
      expect(r.janelasIlegiveis).toEqual([janela])
      expect(r.ultimaResposta).toEqual({ dia: d(1), resultado: 'ok' })
    })
  }
  it('I-1: sem nenhuma ilegível, janelasIlegiveis é lista vazia (nunca undefined), com e sem curva', async () => {
    for (const linhas of [[], [ret('vida', d(1))]]) {
      const r = await ok(fakeSupabase({ yt_own_video_retention: linhas }))
      expect(r.janelasIlegiveis).toEqual([])
    }
  })
  it('I-1: janela sem leitura NÃO é ilegível; só a que tem linha ruim', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1), { points: null }), ret('primeiros_30_dias', d(1))] })
    const r = await ok(db)
    expect(r.janelasIlegiveis).toEqual(['vida'])
    expect(Object.keys(r.curvas)).toEqual(['primeiros_30_dias'])
  })
  it('a ruim de uma janela não derruba a boa de outra', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [
      ret('vida', d(1), { points: [{ t: 1, ratio: 'x', relative: null }], point_count: 1 }), ret('primeiros_7_dias', d(1)),
    ] })
    const r = await ok(db)
    expect(Object.keys(r.curvas)).toEqual(['primeiros_7_dias'])
    expect(r.descartados).toBe(1)
  })
  it('item da lista com janela desconhecida ou dia ilegível: fora da lista e contado', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(1)), ret('janela_nova', d(2)), ret('vida', 'lixo')] })
    const r = await ok(db)
    expect(r.leituras.map(l => l.windowEnd)).toEqual([d(1)])
    expect(r.descartados).toBeGreaterThanOrEqual(2)
  })
})

describe('erro de banco e tabela ausente', () => {
  it('erro de banco em qualquer das tabelas: lança ObservatoryLoadError, nunca vazio', async () => {
    for (const tabela of ['yt_own_video_retention', 'yt_own_collection_attempts']) {
      const db = fakeSupabase({}, { failOn: tabela })
      await expect(lerRetencao(db.client, pedido), tabela).rejects.toBeInstanceOf(ObservatoryLoadError)
    }
  })
  it('código de schema que não é de tabela (42703 coluna) lança: não é "ainda não coletamos"', async () => {
    const db = fakeSupabase({})
    await expect(lerRetencao(comErroNaTabela(db.client, 'yt_own_video_retention', '42703'), pedido)).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('resposta sem lista (data nulo sem erro) lança nas duas tabelas', async () => {
    const db = fakeSupabase({})
    await expect(lerRetencao(comDataNula(db.client, 'yt_own_video_retention'), pedido)).rejects.toBeInstanceOf(ObservatoryLoadError)
    await expect(lerRetencao(comDataNula(db.client, 'yt_own_collection_attempts'), pedido)).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('tabela de tentativas ausente (42P01) também lança: dizer "nunca tentou" seria mentira', async () => {
    const db = fakeSupabase({})
    await expect(lerRetencao(comErroNaTabela(db.client, 'yt_own_collection_attempts', '42P01'), pedido)).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('tabela de retenção ausente (42P01 e PGRST205): devolve o vazio com a marca tabelaAusente, sem lançar, sem consultar tentativas, e avisa o Sentry uma vez', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const base = fakeSupabase({ yt_own_collection_attempts: [tent(d(1), 'ok')] })
      const sb = comErroNaTabela(base.client, 'yt_own_video_retention', code)
      const r = await lerRetencao(sb, pedido)
      expect(r, code).toEqual({ acesso: 'ok', dado: { ytId: V, curvas: {}, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: true, janelasIlegiveis: [] } })
      expect(captureMessage, code).toHaveBeenCalledTimes(1)
      expect(base.trips, code).toEqual([])
      captureMessage.mockClear()
    }
  })
  it('o aviso do Sentry não leva o conteúdo do banco nem o id do vídeo', async () => {
    const base = fakeSupabase({})
    await lerRetencao(comErroNaTabela(base.client, 'yt_own_video_retention', '42P01'), pedido)
    const visto = JSON.stringify(captureMessage.mock.calls)
    expect(visto).not.toContain(SENTINELA)
    expect(visto).not.toContain(V)
    expect(visto).not.toContain(C)
  })
})

describe('filtros: site, canal e vídeo (cada um prova por dado de fora)', () => {
  const OUTRO = { site_id: 'outro-site' }
  it('retenção: linha de outro site, de outro canal e de outro vídeo (mesma janela, dia mais novo) não vaza para curva nem lista', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [
      ret('vida', d(5)),
      ret('vida', d(1), OUTRO),
      ret('vida', d(2), { channel_id: OUTRO_CANAL }),
      ret('vida', d(3), { youtube_video_id: OUTRO_V }),
      ret('primeiros_7_dias', d(1), OUTRO),
    ] })
    const r = await ok(db)
    expect(r.curvas.vida?.windowEnd).toBe(d(5))
    expect(r.curvas.primeiros_7_dias).toBeUndefined()
    expect(r.leituras.map(l => l.windowEnd)).toEqual([d(5)])
  })
  it('retenção: segmento que não é o orgânico fica de fora', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(5)), ret('vida', d(1), { segment: 'pago' })] })
    const r = await ok(db)
    expect(r.curvas.vida?.windowEnd).toBe(d(5))
    expect(r.leituras).toHaveLength(1)
  })
  it('retenção: com a prova de OUTRO site só aparece a linha daquele site (e o canal precisa ser o dele)', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(5)), ret('vida', d(1), { site_id: 'outro-site', points: grade(50), point_count: 50 })] })
    const outro = await lerRetencao(db.client, { ...pedido, leitura: await leituraDe('outro-site') })
    if (outro.acesso !== 'ok') throw new Error('esperava ok')
    expect(outro.dado.curvas.vida?.windowEnd).toBe(d(1))
    expect(outro.dado.curvas.vida?.pontos).toHaveLength(50)
  })
  it('tentativas: de outro site, de outro canal, de outro vídeo, de outro kind e de outro escopo não vazam', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [
      tent(d(9), 'erro_http'),
      tent(d(1), 'ok', OUTRO),
      tent(d(2), 'ok', { channel_id: OUTRO_CANAL }),
      tent(d(3), 'ok', { scope_id: OUTRO_V }),
      tent(d(4), 'ok', { kind: 'diario' }),
      tent(d(5), 'ok', { scope_type: 'canal' }),
    ] })
    const r = await ok(db)
    expect(r.ultimaTentativa).toEqual({ dia: d(9), resultado: 'erro_http' })
    expect(r.ultimaResposta).toBeNull()
  })
  it('tentativas: a busca à parte da última resposta também respeita site, canal, vídeo, kind e escopo', async () => {
    const muitas = Array.from({ length: TETO_TENTATIVAS }, (_, k) => tent(d(k + 1), 'erro_http'))
    const db = fakeSupabase({ yt_own_collection_attempts: [
      ...muitas,
      tent(d(100), 'ok', OUTRO), tent(d(101), 'ok', { channel_id: OUTRO_CANAL }), tent(d(102), 'ok', { scope_id: OUTRO_V }),
      tent(d(103), 'ok', { kind: 'diario' }), tent(d(104), 'ok', { scope_type: 'canal' }),
    ] })
    const r = await ok(db)
    expect(r.ultimaResposta).toBeNull()
    expect(db.trips.filter(t => t === 'yt_own_collection_attempts')).toHaveLength(2)
  })
})

describe('o token de LEITURA (E17 passo 0)', () => {
  it('com o token nascido do DIREITO, sem edição, o leitor lê a curva', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(2))], yt_own_collection_attempts: [] })
    const leitura = await leituraPorDireitoDe('7c1d2e3f-5a47-4d0e-9b1c-7e6a2d4f8a99')
    const r = await lerRetencao(db.client, { leitura, canalId: C, hoje: HOJE, ytId: V })
    expect(r.acesso).toBe('ok')
  })
  it('com um EdicaoDoSite no lugar do token (por cast) o leitor nega e não consulta nada', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(2))] })
    const leitura = (await edicaoDe(S)) as unknown as LeituraPrivadaDoSite
    expect(await lerRetencao(db.client, { leitura, canalId: C, hoje: HOJE, ytId: V })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('com leitura null o leitor nega e não consulta nada', async () => {
    const db = fakeSupabase({ yt_own_video_retention: [ret('vida', d(2))] })
    expect(await lerRetencao(db.client, { leitura: null, canalId: C, hoje: HOJE, ytId: V })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
})
