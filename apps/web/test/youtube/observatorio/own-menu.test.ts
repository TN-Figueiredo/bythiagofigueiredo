// @vitest-environment node
// A3 Tarefa 10: a lista pequena de canais próprios do atalho "Meu canal" (spec 15.2, D15/D16): uma origem pelo motor (telas que leem o site)
// e outra por uma leitura leve (página do canal, cujo conjunto LANÇA em ownChannels), mantidas iguais por um teste de paridade.
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
let client: SupabaseClient | null = null
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => client! }))

import { a3World } from './a3-fixture'
import { ownMenuOf, ownMenuFromRows } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { loadOwnMenuRows } from '@/lib/youtube/observatorio/own-menu'
import { ownChannelHref } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'
import { link } from '@/lib/youtube/observatorio/links'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/load'

/** Dois canais próprios com vídeos (preset 2), e o segundo sem nenhum. */
const doisUmSemVideos = () => a3World(ds => {
  const second = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))[1]!
  ds.videos = ds.videos.filter(v => v.ch !== second.id)
  second.subs = 3
})
const semProprios = () => a3World(ds => {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(v => !own.has(v.ch))
})
const nenhumComVideos = () => a3World(ds => {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  ds.videos = ds.videos.filter(v => !own.has(v.ch))
})

describe('ownMenuOf (telas que leem o site)', () => {
  it('devolve os canais na ordem do motor, com a nota e o destino de ownChannelHref para quem tem vídeos', () => {
    const { obs } = a3World()
    const m = ownMenuOf(obs)
    expect(m.itens.map(i => i.id)).toEqual(obs.ownChannels().map(c => c.id))
    expect(m.itens).toHaveLength(2)
    for (const i of m.itens) {
      const c = obs.channel(i.id)!
      expect(i.name).toBe(c.name)
      expect(i.nota).toMatch(new RegExp(`^último vídeo (hoje|há \\d+ dias?), ${obs.fmt.subs(c.subs)} inscritos$`)) // 11c: a recência primeiro (D-C.5)
      expect(i.href).toBe(ownChannelHref(i.id))
      expect(i.href).toBe(link.canal(i.id)) // A4: o atalho abre a PÁGINA do canal, não o painel lateral
    }
    expect(m.itens[0]!.nota).toBe('último vídeo hoje, 3,21 mil inscritos')
    expect(m.listaHref).toBe(link.canais())
  })
  it('o sem vídeos tem href null e a nota "sem vídeos, N inscritos: ainda sem página"; o principal é o primeiro com vídeos', () => {
    const { obs } = doisUmSemVideos()
    const m = ownMenuOf(obs)
    const sem = m.itens.find(i => i.href == null)!
    expect(sem.nota).toBe('sem vídeos, 3 inscritos: ainda sem página')
    expect(m.itens.filter(i => i.href != null)).toHaveLength(1)
    expect(m.principal).toBe(m.itens.find(i => i.href != null))
  })
  it('o sem vídeos pode vir PRIMEIRO na ordem do motor: o principal é o primeiro COM vídeos (D16), não o primeiro', () => {
    const { obs } = a3World(ds => {
      const first = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))[0]!
      ds.videos = ds.videos.filter(v => v.ch !== first.id)
    })
    const m = ownMenuOf(obs)
    expect(m.itens[0]!.href).toBeNull()
    expect(m.principal!.id).toBe(m.itens[1]!.id)
  })
  it('nenhum com vídeos: principal null; site sem canal próprio: itens vazios, principal null', () => {
    expect(ownMenuOf(nenhumComVideos().obs).principal).toBeNull()
    expect(ownMenuOf(nenhumComVideos().obs).itens.every(i => i.href == null)).toBe(true)
    const vazio = ownMenuOf(semProprios().obs)
    expect(vazio.itens).toEqual([])
    expect(vazio.principal).toBeNull()
  })
  it('singular: "1 inscrito"', () => {
    const { obs } = a3World(ds => {
      const own = ds.channels.find(c => c.own)!
      own.subs = 1
      let keep = true
      ds.videos = ds.videos.filter(v => v.ch !== own.id || (keep && !(keep = false)))
    }, '1')
    expect(ownMenuOf(obs).itens[0]!.nota).toBe('último vídeo hoje, 1 inscrito')
  })
  it('inscritos escondidos pelo YouTube não viram zero: a nota diz que a contagem não é informada', () => {
    const { obs } = a3World(ds => { ds.channels.find(c => c.own)!.subs = null }, '1')
    const nota = ownMenuOf(obs).itens[0]!.nota
    expect(nota).toBe('último vídeo hoje, inscritos ocultos')
    expect(nota).not.toMatch(/\b0\b|—/)
  })
  it('num conjunto de UM canal ele lança: por isso a página do canal usa a leitura leve', () => {
    const { obs } = a3World(ds => { ds.scope = 'canal' })
    expect(() => ownMenuOf(obs)).toThrow()
  })
})

/** Um cliente de serviço simulado sobre as linhas do mesmo mundo: aplica de verdade os `eq`, para provar o filtro e não só a chamada. */
function fakeDb(tables: Record<string, Array<Record<string, unknown>>>, erro?: { table: string; code?: string }) {
  const calls: Array<{ table: string; cols: string; eq: Array<[string, unknown]> }> = []
  const sb = {
    from: (table: string) => ({
      select: (cols: string) => {
        const eq: Array<[string, unknown]> = []
        calls.push({ table, cols, eq })
        const q = {
          eq: (c: string, v: unknown) => { eq.push([c, v]); return q },
          order: () => q,
          range: async (a: number, b: number) => {
            if (erro && erro.table === table) return { data: null, error: { code: erro.code ?? '57014', message: 'timeout' } }
            const rows = (tables[table] ?? []).filter(r => eq.every(([c, v]) => r[c] === v))
            return { data: rows.slice(a, b + 1), error: null }
          },
        }
        return q
      },
    }),
  }
  return { sb: sb as unknown as SupabaseClient, calls }
}

/** O banco do mundo: os mesmos canais e vídeos do motor, mais um canal e vídeos de OUTRO site e um vídeo escondido. */
function bancoDo(world: ReturnType<typeof a3World>) {
  const { obs } = world
  const canais = obs.ownChannels().map(c => ({ id: c.id, channel_id: 'UC' + c.id, name: c.name, handle: c.handle, subscriber_count: c.subs, site_id: 'site-1', last_synced_at: null }))
  const videos = obs.videos.filter(v => canais.some(c => c.id === v.ch)).map(v => ({ id: v.id, channel_id: v.ch, site_id: 'site-1', is_hidden: false, published_at: new Date(v.pub).toISOString() }))
  return {
    youtube_channels: [...canais, { id: 'outro', channel_id: 'UCoutro', name: 'De outro site', handle: '@o', subscriber_count: 99, site_id: 'site-2', last_synced_at: null }],
    youtube_videos: [...videos, ...(canais[0] ? [{ id: 'esc', channel_id: canais[0].id, site_id: 'site-1', is_hidden: true, published_at: new Date(obs.NOW).toISOString() }] : []), { id: 'o1', channel_id: 'outro', site_id: 'site-2', is_hidden: false, published_at: new Date(obs.NOW).toISOString() }],
  }
}

describe('loadOwnMenuRows (a leitura leve da página do canal)', () => {
  it('filtra por site_id nas duas leituras e não conta vídeo escondido (is_hidden)', async () => {
    const w = a3World(), db = fakeDb(bancoDo(w)); client = db.sb
    const rows = await loadOwnMenuRows('site-1')
    expect(rows.map(r => r.id).sort()).toEqual(w.obs.ownChannels().map(c => c.id).sort())
    expect(rows.find(r => r.id === 'outro')).toBeUndefined()
    for (const c of db.calls) expect(c.eq).toContainEqual(['site_id', 'site-1'])
    const v = db.calls.find(c => c.table === 'youtube_videos')!
    expect(v.eq).toContainEqual(['is_hidden', false])
    const tn = rows.find(r => r.id === w.obs.ownChannels()[0]!.id)!
    expect(tn.videos).toBe(w.obs.videos.filter(x => x.ch === tn.id).length) // o escondido ficou de fora
    // `ultimo` = a publicação do vídeo mais novo VISÍVEL: o escondido (publicado "agora") não conta
    expect(tn.ultimo).toBe(Math.max(...w.obs.videos.filter(x => x.ch === tn.id).map(x => x.pub)))
    expect(tn.ultimo).toBeLessThan(w.obs.NOW)
  })
  it('PARIDADE: as linhas da leitura leve dão o mesmo menu que o motor (com dois, um sem vídeos, nenhum com vídeos e sem canal próprio)', async () => {
    for (const w of [a3World(), doisUmSemVideos(), nenhumComVideos(), semProprios(), a3World(undefined, '1')]) {
      client = fakeDb(bancoDo(w)).sb
      const rows = await loadOwnMenuRows('site-1')
      // com e sem a escolha do dono (11c): a regra é a mesma nas duas origens, a nota e o `ultimo` também
      for (const lembrado of [null, ...w.obs.ownChannels().map(c => c.id), 'lixo']) {
        expect(ownMenuFromRows(rows, w.obs.fmt, { lembrado, agora: w.obs.NOW }), String(lembrado)).toEqual(ownMenuOf(w.obs, lembrado))
      }
    }
  })
  it('um erro de leitura é propagado (lista vazia esconderia o atalho em silêncio)', async () => {
    const w = a3World()
    for (const table of ['youtube_channels', 'youtube_videos']) {
      client = fakeDb(bancoDo(w), { table }).sb
      await expect(loadOwnMenuRows('site-1')).rejects.toBeInstanceOf(ObservatoryLoadError)
    }
  })
})
