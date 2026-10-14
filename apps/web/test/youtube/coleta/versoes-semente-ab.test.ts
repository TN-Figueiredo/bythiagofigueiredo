// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { montarSementeAb, type CicloSemente } from '@/lib/youtube/coleta/versoes-semente-ab'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { executarSemente } from '../../../scripts/semear-versoes-ab-lab'

const REGISTRO = '2026-10-07'
const videos = [{ id: 'vid-1', ytId: 'abcdefghijk' }, { id: 'vid-2', ytId: 'lmnopqrstuv' }]
const testes = [{ id: 't-1', videoId: 'vid-1' }, { id: 't-2', videoId: 'vid-2' }]
const ciclo = (id: string, extra: Partial<CicloSemente> = {}): CicloSemente => ({
  id, testId: 't-1', variantId: 'var-1', iniciadoEm: '2026-06-01T15:00:00.000Z', encerradoEm: '2026-06-02T15:00:00.000Z', tituloSet: 'Título ' + id, ...extra,
})
const SETE = [ciclo('c1'), ciclo('c2'), ciclo('c3'), ciclo('c4'), ciclo('c5', { tituloSet: null }), ciclo('c6', { tituloSet: null, testId: 't-2' }), ciclo('c7', { tituloSet: null, testId: 't-2' })]

describe('montarSementeAb', () => {
  it('1. os 7 ciclos da forma medida (4 com metadado): 4 linhas e 3 fora por sem_titulo', () => {
    const r = montarSementeAb(testes, SETE, videos, REGISTRO)
    expect(r.linhas).toHaveLength(4)
    expect(r.fora).toEqual([{ ciclo: 'c5', motivo: 'sem_titulo' }, { ciclo: 'c6', motivo: 'sem_titulo' }, { ciclo: 'c7', motivo: 'sem_titulo' }])
    expect(r.linhas[0]).toEqual({
      youtube_video_id: 'abcdefghijk', video_id: 'vid-1', value_text: 'Título c1', value_hash: hashValue('Título c1'),
      first_seen_at: '2026-06-01T15:00:00.000Z', last_seen_at: '2026-06-02T15:00:00.000Z', ab_event: 'rotacao', ab_test_id: 't-1', ab_variant_id: 'var-1',
    })
  })
  it('1b. ciclo sem fim: last_seen_at = início', () => {
    const r = montarSementeAb(testes, [ciclo('c1', { encerradoEm: null })], videos, REGISTRO)
    expect(r.linhas[0]!.last_seen_at).toBe('2026-06-01T15:00:00.000Z')
  })
  it('2. ciclo iniciado depois do registro: depois_do_registro', () => {
    expect(montarSementeAb(testes, [ciclo('c1', { iniciadoEm: '2026-10-09T15:00:00.000Z', encerradoEm: null })], videos, REGISTRO).fora).toEqual([{ ciclo: 'c1', motivo: 'depois_do_registro' }])
  })
  it('3. vídeo que saiu de youtube_videos: video_ausente', () => {
    expect(montarSementeAb(testes, [ciclo('c1')], [videos[1]!], REGISTRO).fora).toEqual([{ ciclo: 'c1', motivo: 'video_ausente' }])
  })
  it('9. ciclo que atravessa o início do registro: atravessa_o_registro (fronteira: termina no dia anterior entra)', () => {
    const atravessa = ciclo('c1', { iniciadoEm: '2026-10-05T15:00:00.000Z', encerradoEm: '2026-10-07T20:00:00.000Z' })
    expect(montarSementeAb(testes, [atravessa], videos, REGISTRO).fora).toEqual([{ ciclo: 'c1', motivo: 'atravessa_o_registro' }])
    const antes = ciclo('c2', { iniciadoEm: '2026-10-05T15:00:00.000Z', encerradoEm: '2026-10-06T20:00:00.000Z' })
    expect(montarSementeAb(testes, [antes], videos, REGISTRO).linhas).toHaveLength(1)
  })
})

// --- o comando -------------------------------------------------------------------------------------------------------
const URL_PROJ = 'https://novkqtvcnsiwhkxihurk.supabase.co'
const CANAL = 'canal-1', SITE = 'site-a'
function montar(opts: { ciclos?: Row[]; rpc?: (nome: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>; estado?: boolean } = {}) {
  const db = fakeSupabase({
    youtube_channels: [{ id: CANAL, site_id: SITE }],
    youtube_videos: [{ id: 'vid-1', youtube_video_id: 'abcdefghijk', channel_id: CANAL }, { id: 'vid-2', youtube_video_id: 'lmnopqrstuv', channel_id: CANAL }],
    yt_own_versions_state: opts.estado === false ? [] : [{ channel_id: CANAL, site_id: SITE, tracking_since: REGISTRO }],
    ab_tests: [{ id: 't-1', youtube_video_id: 'vid-1' }, { id: 't-2', youtube_video_id: 'vid-2' }],
    ab_test_cycles: opts.ciclos ?? SETE.map(c => ({ id: c.id, test_id: c.testId, variant_id: c.variantId, started_at: c.iniciadoEm, ended_at: c.encerradoEm, applied_metadata: c.tituloSet === null ? {} : { title_set: c.tituloSet } })),
  })
  const rpc = vi.fn(opts.rpc ?? (async () => ({ data: { resultado: 'ok', inseridas: 4, ja_existiam: 0 }, error: null })))
  const sb = { from: db.client.from.bind(db.client), rpc } as unknown as SupabaseClient
  const saida: string[] = [], erros: string[] = []
  const deps = { env: { NEXT_PUBLIC_SUPABASE_URL: URL_PROJ }, sb, dizer: (l: string) => saida.push(l), dizerErro: (l: string) => erros.push(l) }
  return { rpc, saida, erros, deps }
}

describe('executarSemente', () => {
  it('4. invocação sem a flag: simulação, zero chamada de rpc, mostra o que gravaria sem imprimir título', async () => {
    const m = montar()
    expect(await executarSemente([], m.deps)).toBe(0)
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.saida.join('\n')).toContain('4 linha(s) a gravar')
    expect(m.saida.join('\n')).not.toContain('Título c1')
  })

  it('5. com a flag e a função devolvendo sem_estado: código de erro e mensagem de catálogo', async () => {
    const m = montar({ rpc: async () => ({ data: null, error: { message: 'sem_estado' } }) })
    expect(await executarSemente(['--gravar', '--confirmar=novkqtvcnsiwhkxihurk'], m.deps)).toBe(1)
    expect(m.erros.join('\n')).toContain('ainda não tem estado')
  })

  it('5b. erro desconhecido do banco: mensagem fixa, nunca o texto do banco', async () => {
    const m = montar({ rpc: async () => ({ data: null, error: { message: 'conteudo-secreto-zz' } }) })
    expect(await executarSemente(['--gravar', '--confirmar=novkqtvcnsiwhkxihurk'], m.deps)).toBe(1)
    expect(m.erros.join('\n')).not.toContain('conteudo-secreto-zz')
  })

  it('6. rodar duas vezes: a segunda devolve inseridas 0', async () => {
    const vistos = new Set<string>()
    const rpc = async (_n: string, a: Record<string, unknown>) => {
      const novas = (a.p_rows as Array<{ first_seen_at: string; youtube_video_id: string }>).filter(r => !vistos.has(r.youtube_video_id + r.first_seen_at))
      for (const r of novas) vistos.add(r.youtube_video_id + r.first_seen_at)
      return { data: { resultado: 'ok', inseridas: novas.length, ja_existiam: (a.p_rows as unknown[]).length - novas.length }, error: null }
    }
    const a = montar({ rpc }), b = montar({ rpc })
    const flags = ['--gravar', '--confirmar=novkqtvcnsiwhkxihurk']
    expect(await executarSemente(flags, a.deps)).toBe(0)
    expect(a.saida.join('\n')).toContain('inseridas 4')
    expect(await executarSemente(flags, b.deps)).toBe(0)
    expect(b.saida.join('\n')).toContain('inseridas 0')
  })

  it('7. lista vazia de testes: "nenhum ciclo para semear", saída 0, sem chamar a função', async () => {
    const m = montar({ ciclos: [] })
    expect(await executarSemente(['--gravar', '--confirmar=novkqtvcnsiwhkxihurk'], m.deps)).toBe(0)
    expect(m.saida.join('\n')).toContain('nenhum ciclo para semear')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('8. --gravar sem --confirmar, e com ref de outro projeto: zero rpc, código de erro, primeira linha é o endereço', async () => {
    for (const args of [['--gravar'], ['--gravar', '--confirmar=outroprojeto']]) {
      const m = montar()
      expect(await executarSemente(args, m.deps)).toBe(2)
      expect(m.rpc).not.toHaveBeenCalled()
      expect(m.saida[0]).toBe('projeto: novkqtvcnsiwhkxihurk.supabase.co')
      expect(m.deps.sb.from).toBeDefined()
    }
  })

  it('canal ainda sem estado: nada a semear, sem rpc', async () => {
    const m = montar({ estado: false })
    expect(await executarSemente(['--gravar', '--confirmar=novkqtvcnsiwhkxihurk'], m.deps)).toBe(0)
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
