// @vitest-environment node
// F2 do Remover canal, T7: o canal agendado no view model (linha, cabeçalho e gaveta).
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import type { Observatory } from '@/lib/youtube/observatorio'

const DIA = 86_400_000
function mundo(n: number, diasAtras = 3) {
  let escolhidos: string[] = []
  const w = a3World(ds => {
    escolhidos = ds.channels.filter(c => !c.own).slice(0, n).map(c => c.id)
    for (const c of ds.channels) if (escolhidos.includes(c.id)) c.removalRequestedAt = new Date(ds.now - diasAtras * DIA).toISOString()
  })
  return { ...w, escolhidos }
}
const viewDe = (obs: Observatory, channel?: string) => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', ...(channel ? { channel } : {}) })
const linhas = (v: ReturnType<typeof viewDe>) => [...v.list.ranked, ...v.list.unranked]

describe('canal agendado no view model', () => {
  it('V7.1 a linha do agendado traz desde e idade; as outras, null', () => {
    const { obs, escolhidos } = mundo(1)
    const rows = linhas(viewDe(obs))
    const r = rows.find(x => x.id === escolhidos[0])!
    expect(r.agendado?.idade).toBe('agendado há 3 dias')
    expect(typeof r.agendado?.desde).toBe('string')
    expect(rows.filter(x => x.id !== escolhidos[0]).every(x => x.agendado === null)).toBe(true)
  })
  it('V7.2 o cabeçalho conta o agendado, no singular e no plural, e some sem agendado', () => {
    const um = mundo(1), dois = mundo(2), nenhum = mundo(0)
    const t1 = viewDe(um.obs).slots, t2 = viewDe(dois.obs).slots, t0 = viewDe(nenhum.obs).slots
    expect(t1.text).toBe(`${t1.used} de ${t1.limit} canais · 1 agendado para guardar`)
    expect(t1.agendados).toBe(1)
    expect(t2.text).toBe(`${t2.used} de ${t2.limit} canais · 2 agendados para guardar`)
    expect(t0.text).toBe(`${t0.used} de ${t0.limit} canais`)
    expect(t0.agendados).toBe(0)
    expect(t1.used).toBe(t0.used - 1)
  })
  it('V7.3 a gaveta do agendado tem a idade; a de outro canal, null', () => {
    const { obs, escolhidos } = mundo(1)
    expect(viewDe(obs, escolhidos[0]).drawer?.agendado).toEqual({ idade: 'agendado há 3 dias' })
    const outro = obs.channels.find(c => !c.own && c.id !== escolhidos[0])!.id
    expect(viewDe(obs, outro).drawer?.agendado).toBeNull()
  })
  it('V7.4 o canal próprio nunca é agendado', () => {
    const w = a3World(ds => { for (const c of ds.channels) if (c.own) c.removalRequestedAt = new Date(ds.now - DIA).toISOString() })
    const rows = linhas(viewDe(w.obs))
    expect(rows.filter(r => r.own).every(r => r.agendado === null)).toBe(true)
    expect(viewDe(w.obs, w.owns[0]).drawer?.agendado ?? null).toBeNull()
  })
})
