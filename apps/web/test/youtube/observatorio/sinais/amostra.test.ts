// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerAmostraDasLinhas } from '@/lib/youtube/observatorio/sinais/amostra'
import { fakeSb } from './fake-sb'

const SITE = '00000000-0000-4000-8000-000000000001'

describe('lerAmostraDasLinhas', () => {
  it('20 ids = 2 consultas; o filtro de site é pelo canal (competidor) e por site_id + is_hidden (próprio)', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id${i}`)
    const w = fakeSb((c) => ({ data: c.tabela === 'competitor_videos' ? [{ id: 'id0', title: 'Japão em 7 dias', thumbnail_url: 'https://i.ytimg.com/vi/a/mq.jpg' }] : [{ id: 'id1', title: 'Meu vídeo', youtube_video_id: 'YT_1' }] }))
    const m = await lerAmostraDasLinhas(w.sb, SITE, ids)
    expect(w.consultas).toHaveLength(2)
    const comp = w.consultas.find((c) => c.tabela === 'competitor_videos')!
    expect(comp.colunas).toContain('competitor_channels!inner(site_id)')
    expect(comp.filtros).toContainEqual({ op: 'eq', col: 'competitor_channels.site_id', val: SITE })
    const prop = w.consultas.find((c) => c.tabela === 'youtube_videos')!
    expect(prop.filtros).toEqual(expect.arrayContaining([{ op: 'eq', col: 'site_id', val: SITE }, { op: 'eq', col: 'is_hidden', val: false }]))
    expect(m.get('id0')).toEqual({ titulo: 'Japão em 7 dias', miniatura: 'https://i.ytimg.com/vi/a/mq.jpg', origem: 'competidor' })
    expect(m.get('id1')).toEqual({ titulo: 'Meu vídeo', miniatura: 'https://i.ytimg.com/vi/YT_1/mqdefault.jpg', origem: 'proprio' })
  })

  it('id sem linha (outro site, oculto, inexistente) fica ausente; sem ids, nenhuma consulta', async () => {
    const w = fakeSb(() => ({ data: [] }))
    const m = await lerAmostraDasLinhas(w.sb, SITE, ['x'])
    expect(m.has('x')).toBe(false)
    const w2 = fakeSb(() => ({ data: [] }))
    expect((await lerAmostraDasLinhas(w2.sb, SITE, [])).size).toBe(0)
    expect(w2.consultas).toHaveLength(0)
  })

  it('título com <script> passa como string, sem tratamento (quem renderiza usa texto React)', async () => {
    const w = fakeSb((c) => ({ data: c.tabela === 'competitor_videos' ? [{ id: 'a', title: '<script>alert(1)</script>', thumbnail_url: null }] : [] }))
    const m = await lerAmostraDasLinhas(w.sb, SITE, ['a'])
    expect(m.get('a')).toEqual({ titulo: '<script>alert(1)</script>', miniatura: null, origem: 'competidor' })
  })

  it('erro do banco lança sem a mensagem crua', async () => {
    const w = fakeSb(() => ({ data: null, error: { message: 'segredo da conexão' } }))
    await expect(lerAmostraDasLinhas(w.sb, SITE, ['a'])).rejects.toThrow(/amostra: leitura de/)
    await expect(lerAmostraDasLinhas(w.sb, SITE, ['a'])).rejects.not.toThrow(/segredo/)
  })
})

describe('a amostra nunca vai à rota nem ao MCP', () => {
  it('nem o serviço do pipeline nem a ação sugestoes importam amostra.ts', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    for (const rel of ['src/lib/pipeline/services/niche-signals.ts', 'src/lib/pipeline/mcp/services/youtube-observatory.ts', 'src/app/cms/(authed)/youtube/competitors/_contexto-ia/sugestoes.ts', 'src/app/cms/(authed)/youtube/competitors/_sugestoes/dados.ts']) {
      expect(readFileSync(resolve(__dirname, '../../../..', rel), 'utf8'), rel).not.toMatch(/sinais\/amostra/)
    }
  })
})
