// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type Row } from './fake-supabase'
import { criterioConectadoDesligado } from '@/lib/youtube/coleta/criteria-conectados'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'

const canal = (o: Partial<ColetaChannel> = {}): ColetaChannel => ({
  id: 'ch-1', channel_id: 'UC1', site_id: 's1', name: 'Canal Um', sync_enabled: false, collection_status: 'ok', video_count: 3, ...o,
})
const conexao = (o: Row = {}): Row => ({ provider: 'youtube', account_id: 'UC1', site_id: 's1', revoked_at: null, ...o })
const NOTA = 'coleta: Canal Um está conectado com a coleta desligada; ligue a coleta ou desconecte o canal'

async function rodar(channels: ColetaChannel[], conexoes: Row[]) {
  const db = fakeSupabase({ social_connections: conexoes })
  const falhas: string[] = []
  const notas = await criterioConectadoDesligado({ supabase: db.client, falhas, channels })
  return { db, falhas, notas }
}

describe('F0-b · criterioConectadoDesligado', () => {
  it('conectado com a coleta desligada: vermelho e acao_do_dono com o texto exato', async () => {
    const { falhas, notas } = await rodar([canal()], [conexao()])
    expect(falhas).toEqual([NOTA])
    expect(notas).toEqual([NOTA])
  })

  it('conexão revogada: nada', async () => {
    const { falhas, notas } = await rodar([canal()], [conexao({ revoked_at: '2026-10-01T00:00:00Z' })])
    expect(falhas).toEqual([])
    expect(notas).toEqual([])
  })

  it('collection_status reautorizar: nada', async () => {
    const { falhas, notas } = await rodar([canal({ collection_status: 'reautorizar' })], [conexao()])
    expect(falhas).toEqual([])
    expect(notas).toEqual([])
  })

  it('conexão de outro site ou de outro canal: nada', async () => {
    const { falhas, notas } = await rodar([canal()], [conexao({ site_id: 's2' }), conexao({ account_id: 'UC9' })])
    expect(falhas).toEqual([])
    expect(notas).toEqual([])
  })

  it('todos com a coleta ligada: zero leituras de social_connections', async () => {
    const { db, falhas, notas } = await rodar([canal({ sync_enabled: true })], [conexao()])
    expect(db.leituras.social_connections ?? 0).toBe(0)
    expect(falhas).toEqual([])
    expect(notas).toEqual([])
  })

  it('uma só leitura para vários canais desligados', async () => {
    const { db, notas } = await rodar([canal(), canal({ id: 'ch-2', channel_id: 'UC2', name: 'Dois' })], [conexao()])
    expect(db.leituras.social_connections).toBe(1)
    expect(notas).toEqual([NOTA])
  })

  it('leitura falha: nota de não avaliado, nunca verde', async () => {
    const db = fakeSupabase({ social_connections: [conexao()] })
    db.errors.social_connections = { code: 'XX000', message: 'boom' }
    const falhas: string[] = []
    const notas = await criterioConectadoDesligado({ supabase: db.client, falhas, channels: [canal()] })
    expect(notas).toEqual([])
    expect(falhas).toContain('critérios: não foi possível avaliar canais conectados com a coleta desligada (social_connections)')
  })
})
