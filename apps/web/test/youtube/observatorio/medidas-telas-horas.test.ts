// A5 E5a, Tarefa 14a: lerHorasDoCanal (teto de 72 horas por vídeo na consulta, blocos por tempo, três leituras de uma linha).
import { describe, expect, it } from 'vitest'
import { lerHorasDoCanal, blocosPorTempo, type HorasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'
import { REGRAS_DAS_72_HORAS as R } from '@/lib/youtube/observatorio/medidas-telas/tracao-72h'
import { espiar, falsoPostgrest, type Linha } from './medidas-fixture'

const H = 3_600_000
const MIN = 60_000
const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()
const slot = (ms: number): string => iso(Math.floor(ms / H) * H)
const hora = (video: string, lidaMs: number, views: number, site = 's1'): Linha => ({ video_id: video, site_id: site, hour_slot: slot(lidaMs), taken_at: iso(lidaMs), views, likes: null, comments: null })
const agenda = (extra: Linha[] = []): Linha[] => extra

function tabelas(horas: Linha[], runs: Linha[] = [{ task: 'leitura_horaria', status: 'ok', started_at: iso(T0 - 2 * H), finished_at: iso(T0 - 2 * H + 5 * MIN) }]): Record<string, Linha[]> {
  return { competitor_video_hourly: horas, competitor_agenda_runs: agenda(runs) }
}
const ler = (sb: ReturnType<typeof falsoPostgrest>['sb'], videos: Array<{ id: string; publicadoEmMs: number }>) =>
  lerHorasDoCanal(sb, { siteId: 's1', channelId: 'c1', videos, agoraMs: T0 })
const dados = (r: Awaited<ReturnType<typeof ler>>): HorasDoCanal => { if (!r.lido) throw new Error('não lido: ' + r.causa); return r.dados }

describe('E5a T14a: horas, dado ausente', () => {
  it('tabela de horas vazia: lido, mapa vazio, zero linhas, e nenhuma medida vira zero', async () => {
    const f = falsoPostgrest(tabelas([]))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }]))
    expect(d.porVideo.size).toBe(0)
    expect(d.primeiraHoraDoSiteMs).toBeNull()
    expect(d.ultimoOkDaTarefaMs).toBe(T0 - 2 * H + 5 * MIN)
    expect(d.primeiraExecucaoDaTarefaMs).toBe(T0 - 2 * H)
  })
  it('tabela de horas ausente: schema_ausente', async () => {
    const f = falsoPostgrest({ competitor_agenda_runs: [] })
    expect(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }])).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it('a leitura da agenda falhou: a parte inteira é não lida, nada diz "começou" nem "parada"', async () => {
    const f = falsoPostgrest(tabelas([hora('v1', T0 - 4 * H, 10)]), { erros: { competitor_agenda_runs: { code: 'XX000', message: 'x' } } })
    expect(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }])).toEqual({ lido: false, causa: 'erro_do_banco' })
  })
  it('agenda sem nenhuma execução: lido, com as duas datas nulas', async () => {
    const f = falsoPostgrest(tabelas([], []))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }]))
    expect(d.ultimoOkDaTarefaMs).toBeNull()
    expect(d.primeiraExecucaoDaTarefaMs).toBeNull()
  })
  it('consulta que lança: não lida, e a função não rejeita', async () => {
    const f = falsoPostgrest(tabelas([]), { lancam: ['competitor_video_hourly'] })
    expect(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }])).toEqual({ lido: false, causa: 'erro_do_banco' })
  })
  it('a primeira hora do site e o último ok vêm do banco', async () => {
    const f = falsoPostgrest(tabelas([hora('v9', T0 - 30 * H, 5), hora('v1', T0 - 4 * H, 10)], [
      { task: 'leitura_horaria', status: 'erro', started_at: iso(T0 - 9 * H), finished_at: iso(T0 - 9 * H + MIN) },
      { task: 'leitura_horaria', status: 'ok', started_at: iso(T0 - 5 * H), finished_at: iso(T0 - 5 * H + MIN) },
      { task: 'outra_tarefa', status: 'ok', started_at: iso(T0), finished_at: iso(T0) },
    ]))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: T0 - 5 * H }]))
    expect(d.primeiraHoraDoSiteMs).toBe(Math.floor((T0 - 30 * H) / H) * H)
    expect(d.ultimoOkDaTarefaMs).toBe(T0 - 5 * H + MIN)
    expect(d.primeiraExecucaoDaTarefaMs).toBe(T0 - 9 * H)
  })
})

describe('E5a T14a: horas, o teto de 72 horas', () => {
  it('vídeo publicado às 10:20 e lido às 10:40 entra (a hora cheia no limite de baixo)', async () => {
    const pub = Date.UTC(2026, 9, 10, 10, 20)
    const f = falsoPostgrest(tabelas([hora('v1', pub + 20 * MIN, 100)]))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }]))
    expect(d.porVideo.get('v1')?.map((l) => l.views)).toEqual([100])
  })
  it('a linha da hora 100 de um vídeo não entra', async () => {
    const pub = Date.UTC(2026, 9, 10, 10, 20)
    const f = falsoPostgrest(tabelas([hora('v1', pub + 2 * H, 1), hora('v1', pub + 100 * H, 9)]))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }]))
    expect(d.porVideo.get('v1')?.map((l) => l.views)).toEqual([1])
  })
  it('a linha de um vídeo do mesmo bloco, dentro da janela do bloco e fora das 72 horas dele, é descartada no código', async () => {
    const pubA = Date.UTC(2026, 9, 10, 0, 20)
    const pubB = pubA + 60 * H
    // v1 foi lido na hora 80 dele, que está dentro da janela do bloco (a janela vai até a publicação de B + 73 h)
    const f = falsoPostgrest(tabelas([hora('v1', pubA + 5 * H, 1), hora('v1', pubA + 80 * H, 7), hora('v2', pubB + 5 * H, 2)]))
    const bl = blocosPorTempo([{ id: 'v1', publicadoEmMs: pubA }, { id: 'v2', publicadoEmMs: pubB }])
    expect(bl.length).toBe(1)
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pubA }, { id: 'v2', publicadoEmMs: pubB }]))
    expect(d.porVideo.get('v1')?.map((l) => l.views)).toEqual([1])
    expect(d.porVideo.get('v2')?.map((l) => l.views)).toEqual([2])
  })
  it('a leitura da hora 72,5 (dentro da folga de 73 horas) fica, para fechar o intervalo da hora 72', async () => {
    const pub = Date.UTC(2026, 9, 10, 10, 0)
    const f = falsoPostgrest(tabelas([hora('v1', pub + 72 * H + 30 * MIN, 5)]))
    expect(dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }])).porVideo.get('v1')?.length).toBe(1)
  })
  it('leitura antes da publicação não entra', async () => {
    const pub = Date.UTC(2026, 9, 10, 10, 20)
    const f = falsoPostgrest(tabelas([hora('v1', pub - 10 * MIN, 1)]))
    expect(dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }])).porVideo.size).toBe(0)
  })
})

describe('E5a T14a: horas, blocos por tempo', () => {
  const D = 24 * H
  it('vídeos a mais de 72 horas um do outro nunca dividem bloco', () => {
    const a = { id: 'a', publicadoEmMs: T0 }
    expect(blocosPorTempo([a, { id: 'b', publicadoEmMs: T0 + 72 * H }]).length).toBe(1)
    expect(blocosPorTempo([a, { id: 'b', publicadoEmMs: T0 + 72 * H + 1 }]).length).toBe(2)
  })
  it('mais de 150 vídeos: o in() é partido', () => {
    const vs = Array.from({ length: 151 }, (_, i) => ({ id: 'v' + i, publicadoEmMs: T0 + i }))
    expect(blocosPorTempo(vs).map((b) => b.length)).toEqual([R.IDS_POR_BLOCO, 1])
  })
  it('109 vídeos espalhados em 90 dias: cerca de 30 blocos, pedidos 6 de cada vez, e o teto aparece nas linhas devolvidas', async () => {
    const vs = Array.from({ length: 109 }, (_, i) => ({ id: 'v' + i, publicadoEmMs: T0 - 90 * D + Math.floor((i * 90 * D) / 109) }))
    const linhas: Linha[] = []
    // cada vídeo com 336 linhas (14 dias de horas): o teto da consulta deve cortar para ~146
    for (const v of vs) for (let k = 0; k < 336; k++) linhas.push(hora(v.id, v.publicadoEmMs + k * H, 100 + k))
    const f = falsoPostgrest(tabelas(linhas))
    let voando = 0, maximo = 0, devolvidas = 0, pedidos = 0
    const sb = espiar(f.sb, async (t, _e, seguir) => {
      if (t !== 'competitor_video_hourly') return seguir()
      voando++; maximo = Math.max(maximo, voando); pedidos++
      await new Promise((r) => setTimeout(r, 1))
      const r = await seguir() as { data: unknown[] | null }
      devolvidas += r.data?.length ?? 0
      voando--
      return r
    })
    const d = dados(await ler(sb, vs))
    expect(maximo).toBeLessThanOrEqual(R.BLOCOS_AO_MESMO_TEMPO)
    expect(maximo).toBeGreaterThan(1)
    expect(devolvidas).toBeLessThan(16_000)
    expect(pedidos).toBeLessThan(40)
    expect(blocosPorTempo(vs).length).toBeGreaterThan(25)
    for (const v of vs) expect(d.porVideo.get(v.id)!.length).toBeLessThanOrEqual(74)
  })
})

describe('E5a T14a: horas, fronteira e erro', () => {
  const pub = Date.UTC(2026, 9, 10, 10, 20)
  it('a paginação pede ordem por video_id e hour_slot', async () => {
    const f = falsoPostgrest(tabelas([hora('v1', pub + H, 1)]))
    await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }])
    const c = f.consultas.find((x) => x.tabela === 'competitor_video_hourly' && x.filtros.some((y) => y.coluna === 'video_id'))!
    expect(c.ordem).toEqual(['video_id', 'hour_slot'])
  })
  it('prova por mutação: sem o filtro de site voltaria a hora de outro site', async () => {
    const f = falsoPostgrest(tabelas([hora('v1', pub + H, 1), hora('v1', pub + 2 * H, 99, 's2')]))
    const d = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }]))
    expect(d.porVideo.get('v1')?.map((l) => l.views)).toEqual([1])
    const c = f.consultas.find((x) => x.tabela === 'competitor_video_hourly' && x.filtros.some((y) => y.coluna === 'video_id'))!
    expect(c.filtros).toContainEqual({ op: 'eq', coluna: 'site_id', valor: 's1' })
  })
  it('prova por mutação: sem o cruzamento com os vídeos do canal, a hora de um vídeo de outro canal voltaria', async () => {
    const f = falsoPostgrest(tabelas([hora('v1', pub + H, 1)]))
    // um banco que ignora o in(): devolve também a linha de um vídeo que não é do canal
    const sb = espiar(f.sb, async (t, _e, seguir) => {
      const r = await seguir() as { data: unknown[] | null; error: unknown }
      if (t !== 'competitor_video_hourly' || r.data === null || r.data.length === 0) return r
      return { ...r, data: [...r.data, { video_id: 'de-outro-canal', hour_slot: slot(pub + H), taken_at: iso(pub + H), views: 5, likes: null, comments: null }] }
    })
    const d = dados(await ler(sb, [{ id: 'v1', publicadoEmMs: pub }]))
    expect([...d.porVideo.keys()]).toEqual(['v1'])
    expect(d.foraDoCanal).toBe(1)
  })
  it('página cheia sem a seguinte: cortado, nunca o pedaço como se fosse tudo', async () => {
    const f = falsoPostgrest(tabelas([hora('v1', pub + H, 1)]))
    const sb = espiar(f.sb, async (t, eqs, seguir) => {
      const r = await seguir() as { data: unknown[] | null; error: unknown }
      if (t !== 'competitor_video_hourly' || eqs.length > 1) return r
      return { ...r, data: Array.from({ length: 1000 }, () => ({ video_id: 'v1', hour_slot: slot(pub + H), taken_at: iso(pub + H), views: 1, likes: null, comments: null })) }
    })
    expect(await ler(sb, [{ id: 'v1', publicadoEmMs: pub }])).toEqual({ lido: false, causa: 'cortado' })
  })
  it('bigint como texto vira número', async () => {
    const f = falsoPostgrest(tabelas([{ ...hora('v1', pub + H, 1), views: '12345', likes: '7' }]))
    const l = dados(await ler(f.sb, [{ id: 'v1', publicadoEmMs: pub }])).porVideo.get('v1')![0]!
    expect(l.views).toBe(12345)
    expect(l.likes).toBe(7)
  })
  it('sem vídeos: nenhuma consulta de hora por bloco', async () => {
    const f = falsoPostgrest(tabelas([]))
    dados(await ler(f.sb, []))
    expect(f.consultas.filter((c) => c.tabela === 'competitor_video_hourly' && c.filtros.some((x) => x.coluna === 'video_id')).length).toBe(0)
  })
})
