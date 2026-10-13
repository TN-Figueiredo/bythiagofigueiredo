// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'
import { atrasadosDaCobertura, criterioCobertura } from '@/lib/youtube/coleta/criteria-cobertura'
import { criarRelogio, type Relogio } from '@/lib/youtube/coleta/clock'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'

// 2026-10-13 15:00 UTC = 08:00 em Los Angeles: o dia do Pacífico e o dia UTC são o mesmo.
const AGORA = '2026-10-13T15:00:00.000Z'
const HOJE = '2026-10-13'
const SITE = 'site-1'
const CANAL: ColetaChannel = {
  id: 'ch-1', channel_id: 'UC1', site_id: SITE, name: 'Canal A', sync_enabled: true, collection_status: 'ok', video_count: 35,
}
const OUTRO: ColetaChannel = { ...CANAL, id: 'ch-2', channel_id: 'UC2', name: 'Canal B' }
const D = (n: number): string => addDays(HOJE, n)
const DD = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(AGORA), toFake: ['Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.useRealTimers()
})

const id = (i: number): string => `v${String(i).padStart(2, '0')}`
const publicado = (diasAtras: number): string => `${D(-diasAtras)}T12:00:00.000Z`
const video = (i: number, idade: number, canal: ColetaChannel = CANAL): Row => ({
  youtube_video_id: id(i), channel_id: canal.id, published_at: publicado(idade),
})
const cob = (ytId: string, ate: string, canal: ColetaChannel = CANAL): Row => ({
  site_id: SITE, channel_id: canal.id, youtube_video_id: ytId, metric_set: 'base',
  covered_from: '2026-01-01', covered_to: ate, collected_at: `${AGORA}`,
})
/** Tentativa do diário `n` dias antes de hoje (UTC). */
const tent = (ytId: string, n: number, outcome: string, http_status: number | null = null, error: string | null = null, dia = D(-n)): Row => ({
  site_id: SITE, scope_type: 'video', scope_id: ytId, kind: 'diario', attempt_day: dia, outcome, http_status, error, attempts: 1,
})
const quatro404 = (ytId: string): Row[] => [0, 1, 2, 3].map(n => tent(ytId, n, 'erro_http', 404, 'http_404'))

/** `n` vídeos de 30 dias; todos cobertos até ontem, menos `ate` (null = nunca coberto) no vídeo 0. */
function canal35(opts: { ate?: string | null; n?: number; descobertos?: number[]; ateDeles?: string | null } = {}): Record<string, Row[]> {
  const n = opts.n ?? 35
  const descobertos = new Set(opts.descobertos ?? [0])
  const ateDeles = opts.ateDeles === undefined ? opts.ate : opts.ateDeles
  const videos: Row[] = []
  const coberturas: Row[] = []
  for (let i = 0; i < n; i++) {
    videos.push(video(i, 30))
    if (!descobertos.has(i)) coberturas.push(cob(id(i), D(-1)))
    else if (ateDeles != null) coberturas.push(cob(id(i), ateDeles))
  }
  return { youtube_videos: videos, yt_own_video_coverage: coberturas }
}

async function rodar(db: FakeDb, canais: ColetaChannel[] = [CANAL], relogio: Relogio = criarRelogio()) {
  const falhas: string[] = []
  const r = await criterioCobertura({ supabase: db.client, channels: canais, falhas, relogio })
  return { falhas, acaoDoDono: r.acaoDoDono }
}
const semAvaliar = (motivo: string, canal = 'Canal A'): string => `critérios: não foi possível avaliar cobertura de ${canal} (${motivo})`

describe('A5 E6 · atrasadosDaCobertura (pura)', () => {
  const v = (ytId: string, idade: number) => ({ ytId, publicadoEm: publicado(idade) })

  it('elegível = publicado há 5 dias ou mais; hoje, ontem e 4 dias não contam', () => {
    const r = atrasadosDaCobertura([v('a', 0), v('b', 1), v('c', 4), v('d', 5), v('e', 30)], new Map(), HOJE)
    expect(r.elegiveis).toBe(2)
    expect(r.atrasados.map(a => a.ytId)).toEqual(['d', 'e'])
  })

  it('sem cobertura: diasAtrasado = idade − 5 e ate nulo', () => {
    const r = atrasadosDaCobertura([v('d', 5), v('e', 30)], new Map(), HOJE)
    expect(r.atrasados).toEqual([{ ytId: 'd', ate: null, diasAtrasado: 0 }, { ytId: 'e', ate: null, diasAtrasado: 25 }])
  })

  it('com cobertura: hoje − 5 não é atraso; hoje − 6 é atraso de 0 dia; hoje − 9 é de 3 dias', () => {
    const cobertura = new Map([['a', D(-5)], ['b', D(-6)], ['c', D(-9)], ['d', D(-1)]])
    const r = atrasadosDaCobertura([v('a', 30), v('b', 30), v('c', 30), v('d', 30)], cobertura, HOJE)
    expect(r.elegiveis).toBe(4)
    expect(r.atrasados).toEqual([{ ytId: 'b', ate: D(-6), diasAtrasado: 0 }, { ytId: 'c', ate: D(-9), diasAtrasado: 3 }])
  })

  it('cobertura de vídeo que a lista não tem é ignorada; lista vazia dá zero', () => {
    expect(atrasadosDaCobertura([], new Map([['x', D(-30)]]), HOJE)).toEqual({ elegiveis: 0, atrasados: [] })
  })

  it('data de publicação ilegível lança, nunca vira "não elegível"', () => {
    expect(() => atrasadosDaCobertura([{ ytId: 'a', publicadoEm: 'ontem' }], new Map(), HOJE)).toThrow()
  })
})

describe('A5 E6 · criterioCobertura · o que faz subir e o que não faz', () => {
  it('sobe: vídeo antigo sem cobertura (mapa vazio, nenhuma tentativa lida): "nunca coberto", em falhas', async () => {
    const db = fakeSupabase({ youtube_videos: [video(0, 30)], yt_own_video_coverage: [] })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([`diário: Canal A: 1 de 1 vídeos sem cobertura até ${DD(D(-5))} (v00 (nunca coberto))`])
    expect(acaoDoDono).toEqual([])
  })

  it('sobe: cobertura parada em hoje − 6 (0 dia de atraso): a nota traz o id e a data; nenhuma tentativa é lida', async () => {
    const db = fakeSupabase(canal35({ ate: D(-6) }))
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([`diário: Canal A: 1 de 35 vídeos sem cobertura até ${DD(D(-5))} (v00 (coberto até ${DD(D(-6))}))`])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras.yt_own_collection_attempts ?? 0).toBe(0)
  })

  it('não sobe: cobertura em hoje − 5; nada mais é lido', async () => {
    const db = fakeSupabase(canal35({ ate: D(-5) }))
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras.yt_own_collection_attempts ?? 0).toBe(0)
    expect(db.leituras.yt_own_video_meta_daily ?? 0).toBe(0)
  })

  it('não sobe: vídeo de 2 dias sem cobertura (e o de 4 dias); o de exatamente 5 dias sobe', async () => {
    const dois = fakeSupabase({ youtube_videos: [video(0, 2), video(1, 4), video(2, 0)], yt_own_video_coverage: [] })
    expect((await rodar(dois)).falhas).toEqual([])
    const cinco = fakeSupabase({ youtube_videos: [video(0, 5), video(1, 4)], yt_own_video_coverage: [] })
    expect((await rodar(cinco)).falhas).toEqual([`diário: Canal A: 1 de 1 vídeos sem cobertura até ${DD(D(-5))} (v00 (nunca coberto))`])
  })

  it('não sobe: canal desligado ou em reautorizar: nenhuma leitura, nenhuma nota', async () => {
    const db = fakeSupabase(canal35({ ate: D(-20) }))
    const off = { ...CANAL, sync_enabled: false }
    const reaut = { ...OUTRO, collection_status: 'reautorizar' as const }
    const { falhas, acaoDoDono } = await rodar(db, [off, reaut])
    expect(falhas).toEqual([])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras).toEqual({})
  })

  it('tabela vazia com vídeos antigos: TODOS atrasados, vermelho, sem "pane" (não há candidato) e nenhum vira ação do dono', async () => {
    const db = fakeSupabase({ youtube_videos: Array.from({ length: 35 }, (_, i) => video(i, 30)), yt_own_video_coverage: [] })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toContain('35 de 35 vídeos sem cobertura')
    expect(falhas[0]).toContain('e mais 30')
    expect(falhas[0]).not.toContain('pane')
    expect(acaoDoDono).toEqual([])
  })

  it('canal sem vídeo: nenhuma nota e a cobertura nem é lida', async () => {
    const db = fakeSupabase({ youtube_videos: [], yt_own_video_coverage: [] })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras.yt_own_video_coverage ?? 0).toBe(0)
  })

  it('a nota diz quantos, de quantos, e até 5 ids (os mais atrasados primeiro), com "e mais 2"', async () => {
    const videos = Array.from({ length: 10 }, (_, i) => video(i, 30))
    const cobertos = [7, 8, 9].map(i => cob(id(i), D(-1)))
    const db = fakeSupabase({ youtube_videos: videos, yt_own_video_coverage: cobertos })
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([
      `diário: Canal A: 7 de 10 vídeos sem cobertura até ${DD(D(-5))} ` +
      '(v00 (nunca coberto), v01 (nunca coberto), v02 (nunca coberto), v03 (nunca coberto), v04 (nunca coberto), e mais 2)',
    ])
  })

  it('exatamente 5 atrasados: nenhum "e mais"; ordem do mais atrasado ao menos', async () => {
    const videos = [video(0, 10), video(1, 40), video(2, 20), video(3, 12), video(4, 6), video(5, 30)]
    const db = fakeSupabase({ youtube_videos: videos, yt_own_video_coverage: [cob(id(5), D(-1))] })
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([
      `diário: Canal A: 5 de 6 vídeos sem cobertura até ${DD(D(-5))} ` +
      '(v01 (nunca coberto), v02 (nunca coberto), v03 (nunca coberto), v00 (nunca coberto), v04 (nunca coberto))',
    ])
  })

  it('dois canais: cada um é avaliado, e a nota leva o nome do seu canal', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(0, 30), video(1, 30, OUTRO)],
      yt_own_video_coverage: [cob(id(1), D(-1), OUTRO)],
    })
    const { falhas } = await rodar(db, [CANAL, OUTRO])
    expect(falhas).toEqual([`diário: Canal A: 1 de 1 vídeos sem cobertura até ${DD(D(-5))} (v00 (nunca coberto))`])
  })
})

describe('A5 E6 · criterioCobertura · fim do alarme (vermelho x ação do dono)', () => {
  it('3 dias de vermelho antes de virar ação do dono: ate = hoje − 6, − 7, − 8, com 4 falhas do diário', async () => {
    for (const n of [6, 7, 8]) {
      const db = fakeSupabase({ ...canal35({ ate: D(-n) }), yt_own_collection_attempts: quatro404('v00') })
      const { falhas, acaoDoDono } = await rodar(db)
      expect(falhas).toEqual([`diário: Canal A: 1 de 35 vídeos sem cobertura até ${DD(D(-5))} (v00 (coberto até ${DD(D(-n))}))`])
      expect(acaoDoDono).toEqual([])
    }
  })

  it('no 4º dia vira ação do dono e sai de falhas; a situação vem do dia mais recente', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-9) }),
      yt_own_collection_attempts: quatro404('v00'),
      yt_own_video_meta_daily: [
        { channel_id: CANAL.id, youtube_video_id: 'v00', day_pt: D(-30), privacy_status: 'public' },
        { channel_id: CANAL.id, youtube_video_id: 'v00', day_pt: D(-2), privacy_status: 'private' },
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toEqual([
      `diário: Canal A: o YouTube não devolve mais o vídeo v00 (última situação conhecida: privado; coberto até ${DD(D(-9))}). ` +
      'Se foi apagado, tire-o da lista (runbook, seção 6)',
    ])
  })

  it('nunca coberto e sem situação conhecida: "desconhecida" e "nunca coberto"', async () => {
    const db = fakeSupabase({ ...canal35({ ate: null }), yt_own_collection_attempts: quatro404('v00') })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toEqual([
      'diário: Canal A: o YouTube não devolve mais o vídeo v00 (última situação conhecida: desconhecida; nunca coberto). ' +
      'Se foi apagado, tire-o da lista (runbook, seção 6)',
    ])
  })

  it.each([['public', 'público'], ['unlisted', 'não listado'], ['private', 'privado'], ['outra', 'desconhecida']])(
    'situação %s sai como %s', async (bruto, texto) => {
      const db = fakeSupabase({
        ...canal35({ ate: D(-20) }),
        yt_own_collection_attempts: quatro404('v00'),
        yt_own_video_meta_daily: [{ channel_id: CANAL.id, youtube_video_id: 'v00', day_pt: D(-2), privacy_status: bruto }],
      })
      const { acaoDoDono } = await rodar(db)
      expect(acaoDoDono[0]).toContain(`última situação conhecida: ${texto};`)
    })

  it('não vira ação do dono se o diário não tentou de verdade: 3 erro_http e 1 nao_alcancado_orcamento', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [
        tent('v00', 0, 'nao_alcancado_orcamento'),
        ...[1, 2, 3].map(n => tent('v00', n, 'erro_http', 404, 'http_404')),
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toContain('v00 (coberto até')
    expect(acaoDoDono).toEqual([])
  })

  it('não vira ação do dono sem tentativa nenhuma (o passo do diário não rodou)', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: [] })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toContain('v00')
    expect(acaoDoDono).toEqual([])
    expect(db.leituras.yt_own_collection_attempts).toBe(1)
  })

  it('só 3 dos 4 dias com tentativa (4 dias de janela, uma lacuna): continua vermelho', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [0, 1, 2].map(n => tent('v00', n, 'erro_http', 404, 'http_404')),
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(acaoDoDono).toEqual([])
  })

  it('metade do canal sem resposta é pane: 18 de 35 em falhas, com "é pane da coleta"; nada vira ação do dono', async () => {
    const descobertos = Array.from({ length: 18 }, (_, i) => i)
    const tentativas = descobertos.flatMap(i => quatro404(id(i)))
    const db = fakeSupabase({ ...canal35({ ate: D(-20), descobertos }), yt_own_collection_attempts: tentativas })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toContain('18 de 35 vídeos sem cobertura')
    expect(falhas[0]).toContain('e mais 13')
    expect(falhas[0]).toMatch(/; metade ou mais do canal: é pane da coleta, não dos vídeos$/)
    expect(acaoDoDono).toEqual([])
  })

  it('um a menos que a metade (17 de 35) NÃO é pane: os 17 viram ação do dono; só 5 situações são lidas', async () => {
    const descobertos = Array.from({ length: 17 }, (_, i) => i)
    const tentativas = descobertos.flatMap(i => quatro404(id(i)))
    const db = fakeSupabase({ ...canal35({ ate: D(-20), descobertos }), yt_own_collection_attempts: tentativas })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toHaveLength(17)
    expect(db.leituras.yt_own_video_meta_daily).toBe(5)
    expect(acaoDoDono[16]).toContain('desconhecida')
  })

  it('mistura: um vídeo permanente vira ação do dono e o outro (atrasado sem tentativa) segue vermelho', async () => {
    const db = fakeSupabase({
      ...canal35({ descobertos: [0, 1], ate: D(-20) }),
      yt_own_collection_attempts: quatro404('v00'),
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toHaveLength(1)
    expect(acaoDoDono[0]).toContain('vídeo v00')
    expect(falhas).toEqual([`diário: Canal A: 1 de 35 vídeos sem cobertura até ${DD(D(-5))} (v01 (coberto até ${DD(D(-20))}))`])
  })

  it('só quem tem 3+ dias de atraso gasta leitura de tentativa', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-8) }), yt_own_collection_attempts: quatro404('v00') })
    await rodar(db)
    expect(db.leituras.yt_own_collection_attempts ?? 0).toBe(0)
  })
})

describe('A5 E6 · criterioCobertura · N1: só o que o YouTube respondeu conta', () => {
  const quatro = (ytId: string, status: number | null, error: string | null, outcome = 'erro_http'): Row[] =>
    [0, 1, 2, 3].map(n => tent(ytId, n, outcome, status, error))

  it('4 dias de erro_de_banco NÃO viram "o YouTube não devolve mais o vídeo": vermelho, a nota traz o id', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: quatro('v00', null, 'erro_de_banco') })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([`diário: Canal A: 1 de 35 vídeos sem cobertura até ${DD(D(-5))} (v00 (coberto até ${DD(D(-20))}))`])
    expect(acaoDoDono).toEqual([])
  })

  it('o mesmo com forma_inesperada, http_500, cota 403, 429 e exceção: vermelho em todos', async () => {
    const casos: Array<[string, Row[]]> = [
      ['forma_inesperada', quatro('v00', null, 'forma_inesperada')],
      ['http_500', quatro('v01', 500, 'http_500')],
      ['http_403_quotaExceeded', quatro('v02', 403, 'http_403_quotaExceeded')],
      ['http_429', quatro('v03', 429, 'http_429')],
      ['excecao', quatro('v04', null, 'excecao')],
    ]
    const db = fakeSupabase({
      ...canal35({ ate: D(-20), descobertos: [0, 1, 2, 3, 4] }),
      yt_own_collection_attempts: casos.flatMap(([, linhas]) => linhas),
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toEqual([])
    expect(falhas).toHaveLength(1)
    for (const i of [0, 1, 2, 3, 4]) expect(falhas[0]).toContain(`v0${i} (coberto até`)
    expect(falhas[0]).toContain('5 de 35 vídeos')
    expect(falhas[0]).not.toContain('pane')
  })

  it('4 dias de 404 viram ação do dono, sem nada em falhas', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: quatro('v00', 404, 'http_404') })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toHaveLength(1)
    expect(acaoDoDono[0]).toContain('vídeo v00')
  })

  it('403 que não é de cota, 410 e sem_dado_na_janela também contam (misturados nos 4 dias)', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [
        tent('v00', 0, 'erro_http', 403, 'http_403_forbidden'),
        tent('v00', 1, 'erro_http', 410, 'http_410'),
        tent('v00', 2, 'sem_dado_na_janela'),
        tent('v00', 3, 'erro_http', 404, 'http_404'),
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toHaveLength(1)
  })

  it('3 dias de 404 e o 4º de erro_de_banco: vermelho (a falha nossa quebra a sequência)', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [
        tent('v00', 0, 'erro_http', null, 'erro_de_banco'),
        ...[1, 2, 3].map(n => tent('v00', n, 'erro_http', 404, 'http_404')),
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(acaoDoDono).toEqual([])
  })

  it('tentativa de outro tipo (kind), de outro escopo ou de outro site não conta', async () => {
    const outras: Row[] = [
      ...[0, 1, 2, 3].map(n => ({ ...tent('v00', n, 'erro_http', 404, 'http_404'), kind: 'retencao_vida' })),
      ...[0, 1, 2, 3].map(n => ({ ...tent('v00', n, 'erro_http', 404, 'http_404'), scope_type: 'canal' })),
      ...[0, 1, 2, 3].map(n => ({ ...tent('v00', n, 'erro_http', 404, 'http_404'), site_id: 'outro-site' })),
    ]
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: outras })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(acaoDoDono).toEqual([])
  })

  it('janela com teto: 4 dias de 404 mais uma de amanhã contam 4 (não 5) e a de hoje − 4 fica de fora', async () => {
    const dentro = quatro404('v00')
    const db = fakeSupabase({
      ...canal35({ ate: D(-20), descobertos: [0, 1] }),
      yt_own_collection_attempts: [
        ...dentro,
        tent('v00', -1, 'erro_http', 404, 'http_404'),
        // v01: 3 dentro da janela + 1 em hoje − 4 (fora): conta 3
        ...[0, 1, 2].map(n => tent('v01', n, 'erro_http', 404, 'http_404')),
        tent('v01', 4, 'erro_http', 404, 'http_404'),
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toHaveLength(1)
    expect(acaoDoDono[0]).toContain('vídeo v00')
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toContain('v01')
  })

  it('só a tentativa de amanhã não faz o 4º dia: 3 dias de 404 + 1 de amanhã continua vermelho', async () => {
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [...[0, 1, 2].map(n => tent('v00', n, 'erro_http', 404, 'http_404')), tent('v00', -1, 'erro_http', 404, 'http_404')],
    })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toHaveLength(1)
    expect(acaoDoDono).toEqual([])
  })

  it('virada do dia UTC: às 02:00 UTC o dia UTC já é amanhã do Pacífico; a janela usa o dia UTC', async () => {
    vi.setSystemTime(new Date('2026-10-14T02:00:00.000Z'))
    // Pacífico: 13/10 (19:00). UTC: 14/10. Cobertura calculada pelo Pacífico; janela de tentativas pelo UTC (14, 13, 12 e 11/10).
    const utc = '2026-10-14'
    const dias = [0, 1, 2, 3].map(n => addDays(utc, -n))
    const db = fakeSupabase({
      ...canal35({ ate: D(-20) }),
      yt_own_collection_attempts: [
        ...dias.map(d => tent('v00', 0, 'erro_http', 404, 'http_404', d)),
        tent('v00', 0, 'erro_http', 404, 'http_404', addDays(utc, 1)), // além do teto
      ],
    })
    const { falhas, acaoDoDono } = await rodar(db, [CANAL], criarRelogio())
    expect(falhas).toEqual([])
    expect(acaoDoDono).toHaveLength(1)
  })
})

describe('A5 E6 · criterioCobertura · leitura que falha nunca é verde', () => {
  it('a leitura das tentativas falha: todos vermelhos, nota "não foi possível avaliar"; nenhum vira ação do dono', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: quatro404('v00') })
    db.errors.yt_own_collection_attempts = { code: 'XX000', message: 'texto do postgres que não pode vazar' }
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toEqual([])
    expect(falhas).toContain(semAvaliar('yt_own_collection_attempts'))
    expect(falhas).toContain('erro de banco ao ler yt_own_collection_attempts')
    expect(falhas.some(f => f.startsWith('diário: Canal A: 1 de 35 vídeos sem cobertura'))).toBe(true)
    expect(falhas.join('\n')).not.toContain('postgres')
  })

  it('tentativas com tabela ausente: schema_ausente, e todos vermelhos', async () => {
    const db = fakeSupabase(canal35({ ate: D(-20) }))
    db.errors.yt_own_collection_attempts = { code: '42P01', message: 'x' }
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toContain('schema_ausente: yt_own_collection_attempts')
    expect(falhas).toContain(semAvaliar('yt_own_collection_attempts'))
    expect(acaoDoDono).toEqual([])
  })

  it('1.000 linhas de tentativa em um pedido é leitura cortada: não avalia (nunca ação do dono)', async () => {
    const lixo = Array.from({ length: 1000 }, () => tent('v00', 0, 'erro_http', 404, 'http_404'))
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: lixo })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toEqual([])
    expect(falhas).toContain(semAvaliar('yt_own_collection_attempts'))
  })

  it('linha de tentativa em forma estranha (outcome nulo): não avalia', async () => {
    const ruim = { ...tent('v00', 0, 'erro_http', 404, 'http_404'), outcome: null }
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: [ruim, ...[1, 2, 3].map(n => tent('v00', n, 'erro_http', 404, 'http_404'))] })
    const { falhas, acaoDoDono } = await rodar(db)
    expect(acaoDoDono).toEqual([])
    expect(falhas).toContain(semAvaliar('yt_own_collection_attempts'))
  })

  it('a situação do vídeo não pôde ser lida: a nota sai com "desconhecida" e nada mais cai', async () => {
    const db = fakeSupabase({ ...canal35({ ate: D(-20) }), yt_own_collection_attempts: quatro404('v00') })
    db.errors.yt_own_video_meta_daily = { code: 'XX000', message: 'x' }
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual([])
    expect(acaoDoDono).toHaveLength(1)
    expect(acaoDoDono[0]).toContain('última situação conhecida: desconhecida;')
  })

  it('leitura da cobertura falha: "não foi possível avaliar", e nenhuma nota de atraso', async () => {
    const db = fakeSupabase({ youtube_videos: [video(0, 30)], yt_own_video_coverage: [] })
    db.errors.yt_own_video_coverage = { code: 'XX000', message: 'texto do postgres' }
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual(['erro de banco ao ler yt_own_video_coverage', semAvaliar('yt_own_video_coverage')])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras.yt_own_collection_attempts ?? 0).toBe(0)
  })

  it('cobertura com linha ilegível (covered_to nulo): não avalia, nunca "sem cobertura"', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(0, 30)],
      yt_own_video_coverage: [{ ...cob('v00', D(-1)), covered_to: null }],
    })
    const { falhas } = await rodar(db)
    expect(falhas).toContain(semAvaliar('yt_own_video_coverage'))
    expect(falhas.some(f => f.includes('sem cobertura até'))).toBe(false)
  })

  it('tabela de cobertura ausente (42P01): schema_ausente: yt_own_video_coverage', async () => {
    const db = fakeSupabase({ youtube_videos: [video(0, 30)] })
    db.errors.yt_own_video_coverage = { code: '42P01', message: 'x' }
    const { falhas, acaoDoDono } = await rodar(db)
    expect(falhas).toEqual(['schema_ausente: yt_own_video_coverage', semAvaliar('yt_own_video_coverage')])
    expect(acaoDoDono).toEqual([])
  })

  it('a leitura dos vídeos falha: não avalia, sem ler a cobertura', async () => {
    const db = fakeSupabase({})
    db.errors.youtube_videos = { code: 'XX000', message: 'x' }
    const { falhas } = await rodar(db)
    expect(falhas).toEqual(['erro de banco ao ler youtube_videos', semAvaliar('youtube_videos')])
    expect(db.leituras.yt_own_video_coverage ?? 0).toBe(0)
  })

  it('vídeos com tabela ausente: schema_ausente: youtube_videos', async () => {
    const db = fakeSupabase({})
    db.errors.youtube_videos = { code: '42P01', message: 'x' }
    const { falhas } = await rodar(db)
    expect(falhas).toEqual(['schema_ausente: youtube_videos', semAvaliar('youtube_videos')])
  })

  it('mais de 1.000 vídeos: não avalia (nunca "tudo em dia")', async () => {
    const videos = Array.from({ length: 1001 }, (_, i) => video(i, 30))
    const db = fakeSupabase({ youtube_videos: videos, yt_own_video_coverage: videos.map(v => cob(v.youtube_video_id as string, D(-1))) })
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([semAvaliar('mais de 1000 vídeos')])
  })

  it('exatamente 1.000 vídeos todos em dia: avalia e fica verde', async () => {
    const videos = Array.from({ length: 1000 }, (_, i) => video(i, 30))
    const db = fakeSupabase({ youtube_videos: videos, yt_own_video_coverage: videos.map(v => cob(v.youtube_video_id as string, D(-1))) })
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([])
  })

  it('vídeo com data de publicação ilegível: não avalia o canal', async () => {
    const db = fakeSupabase({ youtube_videos: [{ ...video(0, 30), published_at: 'ontem' }], yt_own_video_coverage: [] })
    const { falhas } = await rodar(db)
    expect(falhas).toEqual([semAvaliar('youtube_videos: dado ilegível')])
  })
})

describe('A5 E6 · criterioCobertura · prazo de 3 s', () => {
  /** Cliente cujas consultas às tabelas pedidas nunca respondem. */
  function travandoTudo(db: FakeDb, tabelas: string[]): SupabaseClient {
    return {
      from: (t: string) => {
        if (!tabelas.includes(t)) return db.client.from(t)
        const q: unknown = new Proxy({}, {
          get: (_alvo, prop) => (prop === 'then' ? () => undefined : () => q),
        })
        return q
      },
      rpc: db.client.rpc.bind(db.client),
    } as unknown as SupabaseClient
  }

  it('a leitura da cobertura não volta: "(sem tempo)" e nenhuma nota de atraso', async () => {
    const db = fakeSupabase({ youtube_videos: [video(0, 30)] })
    const falhas: string[] = []
    const p = criterioCobertura({ supabase: travandoTudo(db, ['yt_own_video_coverage']), channels: [CANAL], falhas, relogio: criarRelogio() })
    await vi.advanceTimersByTimeAsync(3_100)
    const r = await p
    expect(falhas).toEqual([semAvaliar('sem tempo')])
    expect(r.acaoDoDono).toEqual([])
  })

  it('a leitura das tentativas não volta (no meio): "(sem tempo)" e NENHUMA nota de atraso', async () => {
    const db = fakeSupabase(canal35({ ate: D(-20) }))
    const falhas: string[] = []
    const p = criterioCobertura({ supabase: travandoTudo(db, ['yt_own_collection_attempts']), channels: [CANAL], falhas, relogio: criarRelogio() })
    await vi.advanceTimersByTimeAsync(3_100)
    const r = await p
    expect(falhas).toEqual([semAvaliar('sem tempo')])
    expect(r.acaoDoDono).toEqual([])
  })

  it('a leitura dos vídeos não volta: o segundo canal também sai com "(sem tempo)"', async () => {
    const db = fakeSupabase({})
    const falhas: string[] = []
    const p = criterioCobertura({ supabase: travandoTudo(db, ['youtube_videos']), channels: [CANAL, OUTRO], falhas, relogio: criarRelogio() })
    await vi.advanceTimersByTimeAsync(3_100)
    await p
    expect(falhas).toEqual([semAvaliar('sem tempo'), semAvaliar('sem tempo', 'Canal B')])
  })

  it('prazo já vencido na entrada (relógio com 297 s): a mesma nota, SEM nenhuma leitura', async () => {
    const db = fakeSupabase(canal35({ ate: D(-20) }))
    const relogio = criarRelogio(Date.now() - 297_000)
    const { falhas, acaoDoDono } = await rodar(db, [CANAL, OUTRO], relogio)
    expect(falhas).toEqual([semAvaliar('sem tempo'), semAvaliar('sem tempo', 'Canal B')])
    expect(acaoDoDono).toEqual([])
    expect(db.leituras).toEqual({})
  })

  it('o prazo vence entre os canais: o primeiro foi avaliado, o segundo sai "(sem tempo)"', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(0, 6), video(1, 30, OUTRO)],
      yt_own_video_coverage: [],
    })
    // Quando a leitura de cobertura do canal A responde, o relógio já passou dos 3 s.
    const original = db.client
    const comRelogio = (q: PromiseLike<unknown>): unknown => {
      const proxy: unknown = new Proxy(q as object, {
        get: (alvo, prop) => {
          const v = (alvo as Record<string | symbol, unknown>)[prop]
          if (prop === 'then') {
            return (ok?: (x: unknown) => unknown, ko?: (e: unknown) => unknown) =>
              q.then((x) => { vi.setSystemTime(Date.now() + 4_000); return ok ? ok(x) : x }, ko)
          }
          if (typeof v !== 'function') return v
          return (...args: unknown[]) => {
            const r = (v as (...a: unknown[]) => unknown).apply(alvo, args)
            return r === alvo ? proxy : r
          }
        },
      })
      return proxy
    }
    const client = {
      from: (t: string) => (t === 'yt_own_video_coverage' ? comRelogio(original.from(t) as unknown as PromiseLike<unknown>) : original.from(t)),
      rpc: original.rpc.bind(original),
    } as unknown as SupabaseClient
    const falhas: string[] = []
    await criterioCobertura({ supabase: client, channels: [CANAL, OUTRO], falhas, relogio: criarRelogio(Date.now()) })
    expect(falhas).toEqual([
      `diário: Canal A: 1 de 1 vídeos sem cobertura até ${DD(D(-5))} (v00 (nunca coberto))`,
      semAvaliar('sem tempo', 'Canal B'),
    ])
  })
})
