// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { schemaReady, healthVerdict, parseCaptureHealth, parseSeriesHealth, readSiteHealth, WEEKLY_DUE_FROM_HOUR_SP, DAILY_DUE_FROM_HOUR_SP, type CaptureHealth, type SeriesHealth } from '@/lib/youtube/competitor-health'

type Fail = { message: string; code?: string }
// o falso responde por tabela; `failing[t]` = erro do banco, `weird[t]` = a forma devolvida no lugar de { data, error }
const sbOf = (failing: Record<string, Fail> = {}, weird: Record<string, unknown> = {}, throws: Record<string, boolean> = {}) => {
  const asked: string[] = []
  return {
    asked,
    sb: {
      from: (t: string) => ({
        select: (cols: string) => ({
          limit: () => {
            asked.push(t + ': ' + cols)
            if (throws[t]) return Promise.reject(new Error('fetch failed'))
            if (t in weird) return Promise.resolve(weird[t])
            return Promise.resolve(failing[t] ? { data: null, error: failing[t] } : { data: [], error: null })
          },
        }),
      }),
    } as never,
  }
}
describe('schemaReady (a ordem migration → código não pode falhar em verde)', () => {
  it('tudo no lugar: null, e a guarda da E1 não pergunta por tabela da MG2', async () => {
    const e1 = sbOf()
    expect(await schemaReady(e1.sb, 'e1')).toBeNull()
    expect(e1.asked.some(a => a.includes('tier') || a.includes('early') || a.includes('weekly_pass_date'))).toBe(false)
    expect(await schemaReady(sbOf().sb, 'e1e2')).toBeNull()
  })
  it('coluna da MG1 ausente: o texto diz qual migration e o erro do banco', async () => {
    expect(await schemaReady(sbOf({ competitor_videos: { code: '42703', message: 'column competitor_videos.miss_streak does not exist' } }).sb, 'e1')).toMatch(/MG1.*miss_streak/)
  })
  it('MG1 aplicada e MG2 não: a guarda completa acusa a MG2; a da E1 passa', async () => {
    const half = { competitor_video_tier_spans: { code: 'PGRST205', message: 'relation does not exist' } }
    expect(await schemaReady(sbOf(half).sb, 'e1')).toBeNull()
    expect(await schemaReady(sbOf(half).sb, 'e1e2')).toMatch(/MG2/)
  })
  it('nenhuma das duas aplicada: a MG1 é acusada primeiro, nas duas guardas, e a guarda da E1 pergunta só pelas tabelas da E1', async () => {
    const none = () => sbOf({
      competitor_videos: { code: '42703', message: 'column competitor_videos.discovered_at does not exist' },
      competitor_channels: { code: '42703', message: 'column does not exist' },
      competitor_field_versions: { code: '42P01', message: 'relation does not exist' },
      competitor_raw: { code: '42P01', message: 'relation does not exist' },
      competitor_video_tier_spans: { code: '42P01', message: 'relation does not exist' },
    })
    const a = none()
    expect(await schemaReady(a.sb, 'e1')).toMatch(/MG1.*competitor_videos/)
    // as consultas partem em paralelo (A5 E16, Tarefa 12): a afirmação é sobre o CONJUNTO perguntado, e o texto é o da primeira tabela da lista
    expect(a.asked.map(q => q.split(':')[0]).sort()).toEqual(['competitor_channels', 'competitor_field_versions', 'competitor_raw', 'competitor_videos'])
    expect(await schemaReady(none().sb, 'e1e2')).toMatch(/MG1/)
  })
  it('cada código de "coluna ou tabela que não existe" diz "migration … não aplicada"; erro sem código (rede) diz "não foi possível conferir o schema"', async () => {
    for (const code of ['42703', '42P01', 'PGRST204', 'PGRST205']) {
      expect(await schemaReady(sbOf({ competitor_raw: { code, message: 'x' } }).sb, 'e1')).toMatch(/^migration MG1 não aplicada \(competitor_raw\)/)
    }
    const net = await schemaReady(sbOf({ competitor_videos: { message: 'fetch failed' } }).sb, 'e1')
    expect(net).toMatch(/^não foi possível conferir o schema \(competitor_videos\): fetch failed/)
    expect(net).not.toMatch(/migration/)
  })
  describe('a PRÓPRIA leitura da guarda falha: nunca "pronto"', () => {
    it('a consulta lança (rede, timeout)', async () => {
      const r = await schemaReady(sbOf({}, {}, { competitor_videos: true }).sb, 'e1')
      expect(r).toMatch(/^não foi possível conferir o schema \(competitor_videos\): fetch failed/)
    })
    it('o banco devolve nulo no lugar do resultado', async () => {
      expect(await schemaReady(sbOf({}, { competitor_videos: null }).sb, 'e1')).toMatch(/não foi possível conferir o schema \(competitor_videos\)/)
      expect(await schemaReady(sbOf({}, { competitor_channels: undefined }).sb, 'e1e2')).toMatch(/não foi possível conferir o schema \(competitor_channels\)/)
    })
    it('sem erro mas sem a lista de linhas (data nulo, objeto, texto): não é "pronto"', async () => {
      for (const odd of [{ data: null, error: null }, { data: {}, error: null }, { data: 'ok', error: null }, {}]) {
        expect(await schemaReady(sbOf({}, { competitor_raw: odd }).sb, 'e1')).toMatch(/não foi possível conferir o schema \(competitor_raw\)/)
      }
    })
    it('a falha aparece também na MG2 (guarda completa)', async () => {
      expect(await schemaReady(sbOf({}, { competitor_video_early: { data: null, error: null } }).sb, 'e1e2')).toMatch(/não foi possível conferir o schema \(competitor_video_early\)/)
      expect(await schemaReady(sbOf({}, { competitor_video_early: { data: null, error: null } }).sb, 'e1')).toBeNull() // a da E1 não pergunta
    })
  })
})

// ───────── Tarefa 12: a prova embutida ─────────
const C: CaptureHealth = { videos_vistos_sem_raw: 0, canais_vistos_sem_raw: 0, canais_vistos_dia_pacifico: 15, cota_dia_pacifico: 200, videos_ausentes: 0, canais_ausentes: 0, canais_em_erro_12h: 0, canais_em_erro_3d: 0, canais_total: 15 }
const S: SeriesHealth = { hoje: '2026-06-10', hora_sp: 19, fora_da_prova: 0, sem_faixa: 0, diaria_sem_ponto_hoje: 0, diaria_buracos_3d: 0, semanal_atrasados: 0, semanal_atrasados_9d: 0, semanal_devidos_hoje: 0, sem_miniatura_9d: 0, diaria_total: 674, semanal_total: 716, fora_canal_em_erro_3d: 0 }
const done = { slotDone: true, e2: true }

describe('healthVerdict', () => {
  it('tudo em ordem: ok, sem problema', () => {
    expect(healthVerdict(C, S, done)).toEqual({ ok: true, problems: [], notes: [] })
  })
  it('Review Focus 5: prova que não veio (nulo) é FALHA, nunca verde', () => {
    expect(healthVerdict(null, S, done)).toMatchObject({ ok: false, problems: ['não foi possível ler a prova da captura'] })
    expect(healthVerdict(C, null, done)).toMatchObject({ ok: false, problems: ['não foi possível ler a prova da série'] })
    expect(healthVerdict(C, null, { slotDone: true, e2: false }).ok).toBe(true) // só a E1 em produção: a prova da série não é cobrada
  })
  it.each([
    [{ videos_vistos_sem_raw: 3 }, '3 vídeos lidos sem resposta guardada'],
    [{ canais_vistos_sem_raw: 1 }, '1 canal lido sem resposta guardada'],
    [{ cota_dia_pacifico: 0 }, 'cota do dia não registrada (15 canais lidos)'],
    [{ canais_em_erro_12h: 2 }, '2 canais em erro há mais de 12 h'],
  ] as Array<[Partial<CaptureHealth>, string]>)('captura %j → %s', (over, msg) => {
    expect(healthVerdict({ ...C, ...over }, S, done)).toMatchObject({ ok: false, problems: [msg] })
  })
  it('cota em 0 sem nenhum canal lido no dia do Pacífico não é falha (nada foi gasto)', () => {
    expect(healthVerdict({ ...C, canais_vistos_dia_pacifico: 0, cota_dia_pacifico: 0 }, S, done).ok).toBe(true)
  })
  it.each([
    [{ sem_faixa: 4 }, '4 vídeos sem faixa de série'],
    [{ diaria_buracos_3d: 7 }, '7 buracos na série diária nos últimos 3 dias'],
    [{ semanal_atrasados: 2 }, '2 vídeos da faixa semanal no 8º dia sem ponto'],
    [{ semanal_atrasados: 3, semanal_atrasados_9d: 3 }, '3 vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)'],
    [{ semanal_devidos_hoje: 4 }, '4 vídeos da faixa semanal devidos hoje e ainda sem ponto'],
    [{ sem_miniatura_9d: 6 }, '6 vídeos sem cópia da miniatura depois de 9 dias'],
    [{ diaria_sem_ponto_hoje: 5 }, '5 vídeos da faixa diária sem ponto hoje'],
  ] as Array<[Partial<SeriesHealth>, string]>)('série %j → %s', (over, msg) => {
    expect(healthVerdict(C, { ...S, ...over }, done)).toMatchObject({ ok: false, problems: [msg] })
  })
  it('"sem ponto hoje" só é cobrado depois das 18:00 de São Paulo E com a faixa inteira tentada', () => {
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5, hora_sp: 17 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5 }, { slotDone: false, e2: true }).ok).toBe(true)
  })
  // (emenda do portão: D-I1, CTRL-d) o vermelho do canal em erro tem fim
  it('canal em erro: vermelho das 12 horas aos 3 dias; depois é nota e o cron volta a verde', () => {
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 0 }, S, done)).toMatchObject({ ok: false, problems: ['2 canais em erro há mais de 12 h'], notes: [] })
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 1 }, S, done)).toMatchObject({ ok: false, problems: ['1 canal em erro há mais de 12 h'], notes: ['1 canal em erro há mais de 3 dias (ver acao_do_dono)'] })
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 2 }, S, done)).toEqual({ ok: true, problems: [], notes: ['2 canais em erro há mais de 3 dias (ver acao_do_dono)'] })
  })
  // (emenda do portão: D-m1, D-I3) antes das 19:00 o 8º dia e os devidos de hoje não são falha; o 9º dia é sempre
  it('semanal: antes das 19:00 (ou com a faixa incompleta) o 8º dia é nota e os devidos de hoje não aparecem; o 9º dia é vermelho a qualquer hora', () => {
    const early = { ...S, hora_sp: 13 }
    expect(healthVerdict(C, { ...early, semanal_atrasados: 2, semanal_devidos_hoje: 30 }, done)).toEqual({ ok: true, problems: [], notes: ['2 vídeos da faixa semanal no 8º dia sem ponto'] })
    expect(healthVerdict(C, { ...S, semanal_atrasados: 2, semanal_devidos_hoje: 30 }, { slotDone: false, e2: true }).ok).toBe(true)
    expect(healthVerdict(C, { ...early, semanal_atrasados: 5, semanal_atrasados_9d: 3 }, done)).toEqual({ ok: false, problems: ['3 vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)'], notes: ['2 vídeos da faixa semanal no 8º dia sem ponto'] })
  })
  it('thumbs: false (pergunta 1 vetada): a falta de cópia da miniatura não é cobrada', () => {
    expect(healthVerdict(C, { ...S, sem_miniatura_9d: 687 }, { ...done, thumbs: false }).ok).toBe(true)
  })
  it('ausentes e fora da prova são nota (o dono vê o número), não falha', () => {
    expect(healthVerdict({ ...C, videos_ausentes: 2, canais_ausentes: 1 }, { ...S, fora_da_prova: 3 }, done)).toEqual({ ok: true, problems: [], notes: ['2 vídeos e 1 canal não vêm mais do YouTube', '3 fora da prova de série (sem contagem, estreia agendada, ausente ou de canal em erro há mais de 3 dias)'] })
  })
  // ── as regras de tempo vivem em constantes com nome, e as fronteiras são testadas ──
  it('as horas de cobrança são 18 (diária) e 19 (semanal), em constantes', () => {
    expect(DAILY_DUE_FROM_HOUR_SP).toBe(18)
    expect(WEEKLY_DUE_FROM_HOUR_SP).toBe(19)
  })
  it('fronteira 18:59 × 19:00 (hora_sp 18 × 19): os devidos de hoje e o 8º dia só viram vermelho às 19:00', () => {
    const over: Partial<SeriesHealth> = { semanal_atrasados: 2, semanal_devidos_hoje: 4 }
    expect(healthVerdict(C, { ...S, ...over, hora_sp: 18 }, done)).toEqual({ ok: true, problems: [], notes: ['2 vídeos da faixa semanal no 8º dia sem ponto'] })
    expect(healthVerdict(C, { ...S, ...over, hora_sp: 19 }, done)).toEqual({ ok: false, problems: ['2 vídeos da faixa semanal no 8º dia sem ponto', '4 vídeos da faixa semanal devidos hoje e ainda sem ponto'], notes: [] })
    expect(healthVerdict(C, { ...S, ...over, hora_sp: 23 }, done).ok).toBe(false)
    expect(healthVerdict(C, { ...S, ...over, hora_sp: 0 }, done).ok).toBe(true) // a virada do dia: o SQL já zerou a conta de hoje
  })
  it('fronteira 17:59 × 18:00: "sem ponto hoje" da faixa diária', () => {
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5, hora_sp: 17 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5, hora_sp: 18 }, done).ok).toBe(false)
  })
  it('as chaves de dia (8º e 9º dia) não dependem da hora nem do relógio do código: vêm prontas do SQL', () => {
    // dia 7 (nada em 8º nem 9º): verde às 23h; dia 8: vermelho só com a hora; dia 9: vermelho às 03h
    expect(healthVerdict(C, { ...S, hora_sp: 23 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, hora_sp: 3, semanal_atrasados: 1 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, hora_sp: 3, semanal_atrasados: 1, semanal_atrasados_9d: 1 }, done).ok).toBe(false)
  })
  it('thumbs ausente = cobra (o padrão é coletar); só thumbs === false desliga', () => {
    expect(healthVerdict(C, { ...S, sem_miniatura_9d: 1 }, { slotDone: true, e2: true }).ok).toBe(false)
    expect(healthVerdict(C, { ...S, sem_miniatura_9d: 1 }, { slotDone: true, e2: true, thumbs: true }).ok).toBe(false)
  })
  it('singular e plural de cada frase', () => {
    expect(healthVerdict(C, { ...S, semanal_atrasados: 1, semanal_devidos_hoje: 1, sem_miniatura_9d: 1, sem_faixa: 1, diaria_buracos_3d: 1, diaria_sem_ponto_hoje: 1, semanal_atrasados_9d: 0 }, done).problems).toEqual([
      '1 vídeo sem faixa de série', '1 buraco na série diária nos últimos 3 dias', '1 vídeo da faixa semanal no 8º dia sem ponto',
      '1 vídeo da faixa semanal devidos hoje e ainda sem ponto', '1 vídeo sem cópia da miniatura depois de 9 dias', '1 vídeo da faixa diária sem ponto hoje',
    ])
  })
  it('vermelho que NÃO some só porque o disparo não tinha o que fazer: a captura não depende de slotDone', () => {
    expect(healthVerdict({ ...C, videos_vistos_sem_raw: 1 }, S, { slotDone: false, e2: true }).ok).toBe(false)
    expect(healthVerdict(C, { ...S, sem_faixa: 1, semanal_atrasados_9d: 1 }, { slotDone: false, e2: true }).problems).toHaveLength(2)
  })
})

describe('parse', () => {
  it('objeto com todas as chaves numéricas passa; chave faltando, texto no lugar de número ou negativo → null (nunca 0 por palpite)', () => {
    expect(parseCaptureHealth(C)).toEqual(C)
    expect(parseCaptureHealth({ ...C, cota_dia_pacifico: undefined })).toBeNull()
    expect(parseCaptureHealth({ ...C, videos_ausentes: '2' })).toBeNull()
    expect(parseCaptureHealth(null)).toBeNull()
    expect(parseSeriesHealth(S)).toEqual(S)
    expect(parseSeriesHealth({ ...S, semanal_atrasados: -1 })).toBeNull()
    expect(parseSeriesHealth({ ...S, hoje: 5 })).toBeNull()
  })
  it.each([
    ['undefined', undefined], ['null', null], ['lista', [C]], ['lista vazia', []], ['texto', 'ok'], ['número', 0], ['objeto vazio', {}],
  ] as Array<[string, unknown]>)('captura: %s → null', (_n, v) => {
    expect(parseCaptureHealth(v)).toBeNull()
  })
  it.each([
    ['undefined', undefined], ['null', null], ['lista', [S]], ['texto', '{}'], ['objeto vazio', {}],
  ] as Array<[string, unknown]>)('série: %s → null', (_n, v) => {
    expect(parseSeriesHealth(v)).toBeNull()
  })
  it('cada chave da captura, uma a uma, faltando / texto / negativo / NaN / Infinity / fração / nulo → null', () => {
    for (const k of Object.keys(C) as Array<keyof CaptureHealth>) {
      const { [k]: _gone, ...without } = C
      void _gone
      expect(parseCaptureHealth(without), k + ' ausente').toBeNull()
      for (const bad of ['3', -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, null, true, [3]]) {
        expect(parseCaptureHealth({ ...C, [k]: bad }), k + ' = ' + String(bad)).toBeNull()
      }
    }
  })
  it('cada chave da série (menos "hoje"), uma a uma, faltando / texto / negativo / NaN / fração / nulo → null', () => {
    for (const k of Object.keys(S).filter(x => x !== 'hoje') as Array<keyof SeriesHealth>) {
      const { [k]: _gone, ...without } = S
      void _gone
      expect(parseSeriesHealth(without), k + ' ausente').toBeNull()
      for (const bad of ['3', -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, null, true]) {
        expect(parseSeriesHealth({ ...S, [k]: bad }), k + ' = ' + String(bad)).toBeNull()
      }
    }
  })
  it('"hoje" tem de ser uma data AAAA-MM-DD; "hora_sp" tem de ser 0 a 23', () => {
    for (const bad of [undefined, null, 5, '', 'hoje', '10/06/2026', '2026-6-10']) expect(parseSeriesHealth({ ...S, hoje: bad }), String(bad)).toBeNull()
    expect(parseSeriesHealth({ ...S, hora_sp: 24 })).toBeNull()
    expect(parseSeriesHealth({ ...S, hora_sp: 0 })).toEqual({ ...S, hora_sp: 0 })
    expect(parseSeriesHealth({ ...S, hora_sp: 23 })).toEqual({ ...S, hora_sp: 23 })
  })
  it('uma chave NOVA que a função passe a devolver não quebra o leitor (e não entra no resultado)', () => {
    expect(parseCaptureHealth({ ...C, canais_novos: 4 })).toEqual(C)
    expect(parseSeriesHealth({ ...S, outra_coisa: 'x' })).toEqual(S)
  })
  it('a forma REAL devolvida pelo banco local (medida em 12/10) passa', () => {
    expect(parseCaptureHealth({ canais_ausentes: 0, videos_ausentes: 1, canais_em_erro_3d: 0, cota_dia_pacifico: 0, canais_em_erro_12h: 0, canais_vistos_sem_raw: 0, videos_vistos_sem_raw: 1, canais_vistos_dia_pacifico: 0, canais_total: 1 })).not.toBeNull()
    expect(parseSeriesHealth({ hoje: '2026-10-12', hora_sp: 20, sem_faixa: 0, diaria_total: 1, fora_da_prova: 1, semanal_total: 0, sem_miniatura_9d: 1, diaria_buracos_3d: 0, semanal_atrasados: 0, semanal_atrasados_9d: 0, semanal_devidos_hoje: 0, diaria_sem_ponto_hoje: 1, fora_canal_em_erro_3d: 0 })).not.toBeNull()
  })
})

describe('MG2b: as duas chaves novas são OBRIGATÓRIAS (a guarda da migration corretiva)', () => {
  const done = { slotDone: true, e2: true }
  it('captura sem canais_total e série sem fora_canal_em_erro_3d → nulo (nunca 0 adivinhado)', () => {
    const { canais_total: _c, ...oldC } = C
    const { fora_canal_em_erro_3d: _s, ...oldS } = S
    void _c; void _s
    expect(parseCaptureHealth(oldC)).toBeNull()
    expect(parseSeriesHealth(oldS)).toBeNull()
  })
  it('sem a corretiva aplicada, o leitor diz em português "migration corretiva das provas não aplicada" e fica vermelho', async () => {
    const { canais_total: _c, ...oldC } = C
    const { fora_canal_em_erro_3d: _s, ...oldS } = S
    void _c; void _s
    const sb = { rpc: (name: string) => Promise.resolve({ data: name === 'competitor_capture_health' ? oldC : oldS, error: null }) } as never
    const v = await readSiteHealth(sb, 's', '2026-10-12T22:00:00.000Z', done)
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
    expect(v.notes.join(' | ')).toContain('prova da captura: migration corretiva das provas não aplicada')
    expect(v.notes.join(' | ')).toContain('prova da série: migration corretiva das provas não aplicada')
  })
  it('só uma das duas chaves faltando também é a migration corretiva (cada prova se explica sozinha)', async () => {
    const { canais_total: _c, ...oldC } = C
    void _c
    const sb = { rpc: (name: string) => Promise.resolve({ data: name === 'competitor_capture_health' ? oldC : S, error: null }) } as never
    const v = await readSiteHealth(sb, 's', '2026-10-12T22:00:00.000Z', done)
    expect(v.problems).toEqual(['não foi possível ler a prova da captura'])
    expect(v.notes.join(' | ')).toContain('migration corretiva das provas não aplicada')
  })
  it('fora_canal_em_erro_3d vira nota: "N vídeos de canal em erro há mais de 3 dias fora da prova"', () => {
    expect(healthVerdict(C, { ...S, fora_da_prova: 4, fora_canal_em_erro_3d: 4 }, done)).toEqual({
      ok: true, problems: [],
      notes: ['4 fora da prova de série (sem contagem, estreia agendada, ausente ou de canal em erro há mais de 3 dias)', '4 vídeos de canal em erro há mais de 3 dias fora da prova'],
    })
    expect(healthVerdict(C, { ...S, fora_da_prova: 1, fora_canal_em_erro_3d: 1 }, done).notes).toContain('1 vídeo de canal em erro há mais de 3 dias fora da prova')
    expect(healthVerdict(C, S, done).notes.some(x => x.includes('fora da prova'))).toBe(false) // zero: sem nota
  })
  it('metade ou mais dos canais em erro há mais de 3 dias é vermelho ("N de M"): pane geral, não canal isolado', () => {
    const at = (erro3d: number, total: number) => healthVerdict({ ...C, canais_em_erro_12h: erro3d, canais_em_erro_3d: erro3d, canais_total: total }, S, done)
    expect(at(1, 15).ok).toBe(true)
    expect(at(7, 15).ok).toBe(true)
    expect(at(8, 15)).toMatchObject({ ok: false, problems: ['8 de 15 canais em erro há mais de 3 dias'] })
    expect(at(15, 15)).toMatchObject({ ok: false, problems: ['15 de 15 canais em erro há mais de 3 dias'] })
    expect(at(1, 2)).toMatchObject({ ok: false, problems: ['1 de 2 canais em erro há mais de 3 dias'] })
    expect(at(1, 1)).toMatchObject({ ok: false, problems: ['1 de 1 canal em erro há mais de 3 dias'] })
    expect(at(0, 0).ok).toBe(true) // sem canais: nada a dizer
  })
})

describe('readSiteHealth', () => {
  type Ans = { data: unknown; error: { message: string } | null }
  const sbOf = (answers: Record<string, Ans | (() => Promise<Ans>)>) => ({
    rpc: (name: string) => {
      const a = answers[name]
      return typeof a === 'function' ? a() : Promise.resolve(a ?? { data: null, error: null })
    },
  }) as never
  const NOW = '2026-06-10T22:00:00Z'
  const RED_CAP = ['não foi possível ler a prova da captura']
  it('lê as duas provas e devolve o veredito', async () => {
    expect(await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: { data: { ...S, semanal_atrasados: 1 }, error: null } }), 's', NOW, done)).toMatchObject({ ok: false, problems: ['1 vídeo da faixa semanal no 8º dia sem ponto'] })
  })
  it('zero em tudo: verde, sem frase e sem nota', async () => {
    expect(await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: { data: S, error: null } }), 's', NOW, done)).toEqual({ ok: true, problems: [], notes: [] })
  })
  it('erro do banco ou resposta vazia (o falso devolve data nula): falha', async () => {
    expect((await readSiteHealth(sbOf({ competitor_capture_health: { data: null, error: { message: 'boom' } } }), 's', NOW, done)).ok).toBe(false)
    expect((await readSiteHealth(sbOf({}), 's', NOW, done)).problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
  })
  it('só a E1: não chama a prova da série', async () => {
    let asked = ''
    const sb = { rpc: (name: string) => { asked += name + ' '; return Promise.resolve({ data: C, error: null }) } } as never
    expect((await readSiteHealth(sb, 's', NOW, { slotDone: true, e2: false })).ok).toBe(true)
    expect(asked.trim()).toBe('competitor_capture_health')
  })
  it('passa p_site_id e p_now às duas funções', async () => {
    const calls: Array<[string, unknown]> = []
    const sb = { rpc: (name: string, args: unknown) => { calls.push([name, args]); return Promise.resolve({ data: name === 'competitor_capture_health' ? C : S, error: null }) } } as never
    await readSiteHealth(sb, 'site-1', NOW, done)
    expect(calls).toEqual([['competitor_capture_health', { p_site_id: 'site-1', p_now: NOW }], ['competitor_series_health', { p_site_id: 'site-1', p_now: NOW }]])
  })
  // ── toda forma de "não li" é vermelho, com o motivo em português numa nota, e nunca vira zero ──
  const BAD: Array<[string, Ans | (() => Promise<Ans>), RegExp]> = [
    ['a chamada lança', () => Promise.reject(new Error('fetch failed')), /fetch failed/],
    ['a chamada lança sem ser Error', () => Promise.reject('texto'), /falhou/],
    ['data nulo e erro nulo', { data: null, error: null }, /vazia/],
    ['erro do banco', { data: null, error: { message: 'function does not exist' } }, /function does not exist/],
    ['erro do banco com data', { data: C, error: { message: 'boom' } }, /boom/],
    ['lista no lugar de objeto', { data: [C], error: null }, /lista/],
    ['texto no lugar de objeto', { data: 'ok', error: null }, /objeto/],
    ['objeto sem um campo', { data: { ...C, cota_dia_pacifico: undefined }, error: null }, /cota_dia_pacifico/],
    ['campo em texto', { data: { ...C, videos_ausentes: '2' }, error: null }, /videos_ausentes/],
    ['campo negativo', { data: { ...C, videos_ausentes: -1 }, error: null }, /videos_ausentes/],
    ['campo NaN', { data: { ...C, videos_ausentes: Number.NaN }, error: null }, /videos_ausentes/],
  ]
  it.each(BAD)('captura: %s → vermelho com "não foi possível ler a prova da captura" e o motivo numa nota', async (_n, ans, why) => {
    const v = await readSiteHealth(sbOf({ competitor_capture_health: ans, competitor_series_health: { data: S, error: null } }), 's', NOW, done)
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(RED_CAP)
    expect(v.notes.join(' | ')).toMatch(/^prova da captura: /)
    expect(v.notes.join(' | ')).toMatch(why)
  })
  it.each(BAD)('série: %s → vermelho com "não foi possível ler a prova da série" (a captura boa não a esconde)', async (_n, ans) => {
    const v = await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: ans }), 's', NOW, done)
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['não foi possível ler a prova da série'])
    expect(v.notes.join(' | ')).toMatch(/^prova da série: /)
  })
  it('a série com "hoje" fora do formato ou hora_sp 99: vermelho', async () => {
    for (const bad of [{ ...S, hoje: 5 }, { ...S, hora_sp: 99 }]) {
      const v = await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: { data: bad, error: null } }), 's', NOW, done)
      expect(v.problems).toEqual(['não foi possível ler a prova da série'])
    }
  })
  it('uma prova que lança não derruba a outra: as duas falhas aparecem', async () => {
    const boom = () => Promise.reject(new Error('rede'))
    const v = await readSiteHealth(sbOf({ competitor_capture_health: boom, competitor_series_health: boom }), 's', NOW, done)
    expect(v.problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
  })
  it('rpc que lança de forma síncrona (cliente quebrado) também é vermelho', async () => {
    const sb = { rpc: () => { throw new Error('cliente sem rpc') } } as never
    const v = await readSiteHealth(sb, 's', NOW, done)
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
  })
  it('resposta que não é nem objeto (undefined) é vermelho', async () => {
    const sb = { rpc: () => Promise.resolve(undefined) } as never
    expect((await readSiteHealth(sb, 's', NOW, done)).problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
  })
  it('só a E1 com a captura ilegível: vermelho, e a série não é pedida nem cobrada', async () => {
    const v = await readSiteHealth(sbOf({ competitor_capture_health: { data: null, error: { message: 'x' } } }), 's', NOW, { slotDone: true, e2: false })
    expect(v.problems).toEqual(RED_CAP)
  })
})

describe('H: os totais da série (diaria_total e semanal_total) entram no veredito', () => {
  const NOTE = 'nenhum vídeo com faixa ainda (esperado só no dia da ativação, antes das 18:00)'
  it('totais em zero com canal lido no dia, antes das 19:00: nota, nunca verde mudo, e nunca vermelho (a partir das 19:00 é o item 6, abaixo)', () => {
    const v = healthVerdict(C, { ...S, hora_sp: 12, diaria_total: 0, semanal_total: 0 }, done)
    expect(v.notes).toContain(NOTE)
    expect(v.ok).toBe(true)
  })
  it('a nota vale antes das 19:00 de São Paulo (dia da ativação: a faixa das 18:00 ainda vai classificar)', () => {
    for (const hora_sp of [0, 12, 17, 18]) {
      const v = healthVerdict(C, { ...S, hora_sp, diaria_total: 0, semanal_total: 0 }, done)
      expect(v.notes).toContain(NOTE)
      expect(v.ok).toBe(true)
    }
  })
  it('item 6: a partir das 19:00 com a faixa terminada, totais zerados com canal lido no dia é VERMELHO (a coleta não está classificando), e a nota some', () => {
    for (const hora_sp of [19, 20, 23]) {
      const v = healthVerdict(C, { ...S, hora_sp, diaria_total: 0, semanal_total: 0 }, done)
      expect(v.ok).toBe(false)
      expect(v.problems).toEqual(['nenhum vídeo com faixa de série: a coleta não está classificando'])
      expect(v.notes).not.toContain(NOTE)
    }
  })
  it('item 6: às 19:00 mas com a faixa NÃO terminada (slotDone falso) continua nota, não vermelho', () => {
    const v = healthVerdict(C, { ...S, hora_sp: 19, diaria_total: 0, semanal_total: 0 }, { slotDone: false, e2: true })
    expect(v.ok).toBe(true)
    expect(v.notes).toContain(NOTE)
  })
  it('item 6: diária zero mas semanal com vídeos (a coleta classificou; só não há vídeo novo): não é vermelho', () => {
    const v = healthVerdict(C, { ...S, hora_sp: 22, diaria_total: 0, semanal_total: 40 }, done)
    expect(v.ok).toBe(true)
  })
  it('item 6: sem canal lido no dia, totais zerados às 20:00 não são vermelho (nada para classificar)', () => {
    expect(healthVerdict({ ...C, canais_vistos_dia_pacifico: 0 }, { ...S, hora_sp: 20, diaria_total: 0, semanal_total: 0 }, done).ok).toBe(true)
  })
  it('sem nenhum canal lido no dia (nada para classificar) não há nota', () => {
    expect(healthVerdict({ ...C, canais_vistos_dia_pacifico: 0 }, { ...S, diaria_total: 0, semanal_total: 0 }, done).notes).not.toContain(NOTE)
  })
  it('qualquer um dos dois totais acima de zero: sem nota', () => {
    expect(healthVerdict(C, { ...S, diaria_total: 0, semanal_total: 5 }, done).notes).not.toContain(NOTE)
    expect(healthVerdict(C, { ...S, diaria_total: 3, semanal_total: 0 }, done).notes).not.toContain(NOTE)
  })
  it('sem a prova da captura (nula) a nota não aparece: o problema "não foi possível ler" já é vermelho', () => {
    const v = healthVerdict(null, { ...S, diaria_total: 0, semanal_total: 0 }, done)
    expect(v.notes).not.toContain(NOTE)
    expect(v.ok).toBe(false)
  })
  it('E1 sozinha (e2: false) não olha a série, então não tem a nota', () => {
    expect(healthVerdict(C, { ...S, diaria_total: 0, semanal_total: 0 }, { slotDone: true, e2: false }).notes).not.toContain(NOTE)
  })
})

describe('item 7: weekly: false (a fase semanal desligada) não deixa a prova vermelha todo dia às 19:00', () => {
  const late = { ...S, hora_sp: 21, semanal_devidos_hoje: 6, semanal_atrasados: 4, semanal_atrasados_9d: 2 }
  it('ligada (padrão, e weekly: true): os semanais devidos, o 8º e o 9º dia continuam vermelhos', () => {
    for (const o of [done, { ...done, weekly: true }]) {
      const v = healthVerdict(C, late, o)
      expect(v.ok).toBe(false)
      expect(v.problems.join(' | ')).toMatch(/devidos hoje/)
      expect(v.problems.join(' | ')).toMatch(/9 dias ou mais/)
      expect(v.problems.join(' | ')).toMatch(/8º dia/)
      expect(v.notes).not.toContain('fase semanal desligada')
    }
  })
  it('desligada: nenhum dos três semanais é cobrado e a nota "fase semanal desligada" aparece', () => {
    const v = healthVerdict(C, late, { ...done, weekly: false })
    expect(v.ok).toBe(true)
    expect(v.problems).toEqual([])
    expect(v.notes).toContain('fase semanal desligada')
  })
  it('desligada: a nota está em toda execução (em qualquer hora, com a faixa terminada ou não), e a série diária continua cobrada', () => {
    for (const hora_sp of [3, 12, 19]) for (const slotDone of [true, false]) {
      expect(healthVerdict(C, { ...S, hora_sp }, { slotDone, e2: true, weekly: false }).notes).toContain('fase semanal desligada')
    }
    const v = healthVerdict(C, { ...S, hora_sp: 21, diaria_sem_ponto_hoje: 3, diaria_buracos_3d: 1 }, { ...done, weekly: false })
    expect(v.ok).toBe(false)
    expect(v.problems.join(' | ')).toMatch(/da faixa diária sem ponto hoje/)
    expect(v.problems.join(' | ')).toMatch(/buraco/)
  })
  it('desligada, mas a prova da série não veio: a nota aparece e o vermelho "não foi possível ler" continua', () => {
    const v = healthVerdict(C, null, { ...done, weekly: false })
    expect(v.ok).toBe(false)
    expect(v.notes).toContain('fase semanal desligada')
  })
  it('E1 sozinha (e2: false) não fala da fase semanal', () => {
    expect(healthVerdict(C, S, { slotDone: true, e2: false, weekly: false }).notes).not.toContain('fase semanal desligada')
  })
})
