// @vitest-environment node
/**
 * Tarefa 11d: a cota diária da forja saiu. Um pedido novo só é aceito quando o dado mudou desde a última leitura concluída do mesmo
 * alvo (tipo + nicho; tipo + nicho + vídeo em `leitura-video`). O servidor (`planAsk` com `obs.forja.planOpts`, o mesmo que
 * `services/forja-queue` usa) e a sessão da tela decidem pela MESMA função. Dado ausente: cada ramo tem o seu teste com o valor nulo.
 */
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { plain } from './fase4-world'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { createClock } from '@/lib/youtube/observatorio/time'
import { machineOf } from '@/lib/youtube/observatorio/forja/states'
import { planAsk } from '@/lib/youtube/observatorio/forja/session'
import type { Dataset, ForjaRequest, FrozenReading } from '@/lib/youtube/observatorio/types'

const MIN = 6e4, DAY = 864e5
const FRASE = 'já usa o dado mais recente. Dá para pedir de novo quando houver coleta nova.'
const NICHO_ID = 'padroes-titulo-ia-20-10', VIDEO_ID = 'leitura-video-matt-opus55-20-10', TROCAS_ID = 'resumo-trocas-ia-20-10'

let base: Dataset | null = null
const baseDs = (): Dataset => (base ??= plain(datasetFromOracle(loadOracle())))
const clockOf = (ds: Dataset) => createClock(ds.now, ds.seriesStart, ds.snap0)
const reading = (ds: Dataset, id: string): FrozenReading => ds.readings.find(r => r.id === id)!

function world(mut?: (ds: Dataset, lastIdx: number) => void): { obs: Observatory; ds: Dataset; lastIdx: number } {
  const ds = plain(baseDs())
  const lastIdx = createObservatory(ds).LAST_IDX
  mut?.(ds, lastIdx)
  return { obs: createObservatory(ds), ds, lastIdx }
}
/**
 * Congela a leitura no registro diário `idx` (a marca que `since` lê: `sent.asOf`, sem `asOfIdx`), escrita depois de tudo o que o conjunto
 * conhece (nenhuma troca posterior) e sem a base congelada do oráculo (que é de 20/10): sem ela o "Desde então" não compara e a marca decide.
 */
function freezeAt(ds: Dataset, id: string, idx: number) {
  const r = reading(ds, id)
  r.sent.asOf = clockOf(ds).snapTime(idx)
  delete r.sent.asOfIdx
  r.generatedAt = ds.now - MIN
  delete r.base
  r.effects = []
}
const ask = (w: { obs: Observatory; ds: Dataset }, scope: string, target: { type: string; video?: string | null }, requests?: ForjaRequest[]) => {
  const clock = clockOf(w.ds)
  return planAsk(requests ?? w.ds.requests, machineOf(w.ds.queue.lastPollAt, clock), clock, w.obs.forja.planOpts, scope, target)
}
function dbReq(ds: Dataset, o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }): ForjaRequest {
  const type = o.type ?? 'padroes-titulo', niche = o.niche ?? 'ia'
  return {
    id: 'db-' + type + '-' + niche + '-' + o.state, type, niche, status: 'pending', video: null, target: { kind: 'niche', niche, fmt: 'long' },
    createdAt: ds.now - 4 * MIN, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
    ...o,
  }
}

describe('11d: dado igual bloqueia (nicho)', () => {
  it('leitura congelada no último registro diário: o motor diz que não pode, e o servidor recusa com a frase da regra nova', () => {
    const w = world((ds, last) => freezeAt(ds, NICHO_ID, last))
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
    const r = ask(w, 'ia', { type: 'padroes-titulo' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('A leitura de IA ' + FRASE)
    expect(r.reason).not.toMatch(/cota|hoje|libera/i)
  })
  it('a sessão da tela decide igual ao servidor (mesma frase)', () => {
    const w = world((ds, last) => freezeAt(ds, NICHO_ID, last))
    const r = w.obs.forja.session.ask('ia', { type: 'padroes-titulo' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('A leitura de IA ' + FRASE)
  })
  it('Todos: o nicho sem novidade fica de fora e o outro entra, na ordem dos cliques', () => {
    const w = world((ds, last) => freezeAt(ds, NICHO_ID, last))
    const r = ask(w, 'todos', { type: 'padroes-titulo' })
    expect(r.results).toEqual([
      { niche: 'ia', ok: false, reason: 'A leitura de IA ' + FRASE },
      expect.objectContaining({ niche: 'viagem', ok: true }),
    ])
  })
})

describe('11d: dado novo libera, no mesmo dia e na segunda leitura do dia', () => {
  it('pedido publicado hoje, mas a leitura é de um registro diário mais velho: pode pedir', () => {
    const w = world((ds, last) => {
      freezeAt(ds, NICHO_ID, last - 1)
      ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 30 * MIN, publishedAt: ds.now - 10 * MIN }))
    })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toMatchObject({ pode: true, porque: 'dado-novo' })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(true)
  })
  it('duas leituras no mesmo dia: a mais recente decide (dado igual bloqueia, a anterior não conta)', () => {
    const w = world((ds, last) => {
      const antiga = reading(ds, NICHO_ID)
      freezeAt(ds, NICHO_ID, last - 2)
      ds.readings.push({ ...plain(antiga), id: 'padroes-titulo-ia-hoje', generatedAt: ds.now - 20 * MIN })
      freezeAt(ds, 'padroes-titulo-ia-hoje', last)
      reading(ds, 'padroes-titulo-ia-hoje').generatedAt = ds.now - MIN
      reading(ds, NICHO_ID).generatedAt = ds.now - 3 * 36e5
    })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
    const w2 = world((ds, last) => {
      const antiga = reading(ds, NICHO_ID)
      freezeAt(ds, NICHO_ID, last - 2)
      ds.readings.push({ ...plain(antiga), id: 'padroes-titulo-ia-hoje', generatedAt: ds.now - 20 * MIN })
      freezeAt(ds, 'padroes-titulo-ia-hoje', last - 1)
      reading(ds, 'padroes-titulo-ia-hoje').generatedAt = ds.now - MIN
      reading(ds, NICHO_ID).generatedAt = ds.now - 3 * 36e5
    })
    expect(w2.obs.forja.novidade('padroes-titulo', 'ia', null)).toMatchObject({ pode: true, porque: 'dado-novo' })
  })
})

describe('11d: leitura vazia ou sem evidência vale como leitura', () => {
  it('itens vazios e dado igual: bloqueia, com a mesma frase', () => {
    const w = world((ds, last) => { freezeAt(ds, NICHO_ID, last); reading(ds, NICHO_ID).text.items = [] })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).reason).toBe('A leitura de IA ' + FRASE)
  })
  it('itens vazios e dado novo: libera', () => {
    const w = world((ds, last) => { freezeAt(ds, NICHO_ID, last - 1); reading(ds, NICHO_ID).text.items = [] })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null).pode).toBe(true)
  })
})

describe('11d: leitura de vídeo', () => {
  it('a leitura do vídeo A concluída com dado igual não bloqueia o vídeo B do mesmo nicho', () => {
    const w = world()
    const A = reading(w.ds, VIDEO_ID).target!.video!
    const B = w.ds.videos.find(v => v.id !== A && v.niche === 'ia' && v.tracked && !w.ds.channels.find(c => c.id === v.ch)!.own)!.id
    const chLast = w.obs.channel(w.obs.video(A)!.ch)!.lastIdx!
    const w2 = world(ds => freezeAt(ds, VIDEO_ID, chLast))
    expect(w2.obs.forja.novidade('leitura-video', 'ia', A)).toEqual({ pode: false })
    expect(w2.obs.forja.novidade('leitura-video', 'ia', B).pode).toBe(true)
    const rA = ask(w2, 'ia', { type: 'leitura-video', video: A })
    expect(rA.ok).toBe(false)
    expect(rA.reason).toBe('A leitura deste vídeo ' + FRASE)
    expect(ask(w2, 'ia', { type: 'leitura-video', video: B }).ok).toBe(true)
  })
  it('um pedido ativo de vídeo do nicho continua bloqueando os outros (o banco só aceita um ativo por tipo e nicho)', () => {
    const w = world()
    const A = reading(w.ds, VIDEO_ID).target!.video!
    const B = w.ds.videos.find(v => v.id !== A && v.niche === 'ia' && v.tracked)!.id
    const ativo = dbReq(w.ds, { state: 'na fila', type: 'leitura-video', video: A, target: { kind: 'video', niche: 'ia', video: A } })
    const r = ask(w, 'ia', { type: 'leitura-video', video: B }, [...w.ds.requests, ativo])
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/leitura de vídeo de IA em andamento/)
  })
})

describe('11d: meia-noite não libera nem bloqueia', () => {
  it('um dia depois, sem registro diário novo: continua bloqueado (e pedido publicado ontem não muda nada)', () => {
    const w = world((ds, last) => {
      freezeAt(ds, NICHO_ID, last)
      ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 20 * 36e5, publishedAt: ds.now - 19 * 36e5 }))
      ds.now += 10 * 36e5
    })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(false)
  })
  it('um dia depois, com leitura velha: libera (a data do pedido não entra na conta)', () => {
    const w = world((ds, last) => { freezeAt(ds, NICHO_ID, last - 1); ds.now += DAY })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null).pode).toBe(true)
  })
})

describe('11d: falha, recusa e pedido ativo', () => {
  it('falha hoje com leitura velha: o botão pede de novo', () => {
    const w = world((ds, last) => {
      freezeAt(ds, NICHO_ID, last - 1)
      ds.requests.push(dbReq(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN }))
    })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(true)
  })
  it('falha e recusa hoje sem nenhuma leitura do alvo: pode pedir (não há o que comparar)', () => {
    for (const state of ['falhou', 'recusado (dado velho)'] as const) {
      const w = world(ds => {
        ds.readings = ds.readings.filter(r => !(r.type === 'padroes-titulo' && r.niche === 'ia'))
        ds.requests = ds.requests.filter(q => !(q.type === 'padroes-titulo' && q.niche === 'ia'))
        ds.requests.push(dbReq(ds, { state, status: state === 'falhou' ? 'failed' : 'refused', failedAt: ds.now - 5 * MIN, refusedAt: ds.now - 5 * MIN }))
      })
      expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toMatchObject({ pode: true, porque: 'sem-leitura' })
      expect(ask(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(true)
    }
  })
  it('a falha não conta como leitura: com a leitura em dia, ela não reabre o pedido', () => {
    const w = world((ds, last) => {
      freezeAt(ds, NICHO_ID, last)
      ds.requests.push(dbReq(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN }))
    })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).reason).toBe('A leitura de IA ' + FRASE)
  })
  it('pedido ativo bloqueia o próprio alvo mesmo com dado novo, e a frase é a do pedido em andamento', () => {
    const w = world((ds, last) => {
      freezeAt(ds, NICHO_ID, last - 3)
      ds.requests.push(dbReq(ds, { state: 'na fila', createdAt: ds.now - 2 * DAY }))
    })
    const r = ask(w, 'ia', { type: 'padroes-titulo' })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/^Nada enviado: já há um pedido de IA /)
  })
})

describe('11d: dado ausente ou desconhecido (falha em verde): permite pedir e diz por quê', () => {
  it('sem leitura nenhuma do alvo: porque = sem-leitura', () => {
    const w = world(ds => { ds.readings = ds.readings.filter(r => !(r.type === 'temas' && r.niche === 'viagem')) })
    expect(w.obs.forja.novidade('temas', 'viagem', null)).toEqual({ pode: true, porque: 'sem-leitura' })
  })
  it('leitura sem marca de registro diário (asOf não numérico): permite, porque = sem-marca', () => {
    const w = world(ds => { delete reading(ds, NICHO_ID).sent.asOfIdx; (reading(ds, NICHO_ID).sent as Record<string, unknown>).asOf = Number.NaN })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: true, porque: 'sem-marca' })
    expect(ask(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(true)
  })
  it('marca no futuro (depois do último registro diário): permite, porque = sem-marca', () => {
    const w = world((ds, last) => freezeAt(ds, NICHO_ID, last + 5))
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: true, porque: 'sem-marca' })
  })
  it('vídeo que não está mais no observatório: permite (o pedido é recusado adiante como "vídeo desconhecido")', () => {
    const w = world()
    expect(w.obs.forja.novidade('leitura-video', 'ia', 'nao-existe')).toEqual({ pode: true, porque: 'sem-marca' })
  })
})

describe('11d: o mesmo critério do "Desde então" (since.ts) também vale', () => {
  it('mesmo registro diário, mas houve troca depois de a leitura ser escrita: a leitura está desatualizada e o botão deixa pedir', () => {
    const w = world((ds, last) => {
      freezeAt(ds, TROCAS_ID, last)
      reading(ds, TROCAS_ID).generatedAt = Math.min(...ds.videos.flatMap(v => [...v.titles, ...v.thumbs].map(x => x.first_seen))) - DAY
    })
    expect(w.obs.forja.since(TROCAS_ID)!.text).toMatch(/^Desde então:/)
    expect(w.obs.forja.novidade('resumo-trocas', 'ia', null)).toMatchObject({ pode: true, porque: 'dado-novo' })
  })
})
