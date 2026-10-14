// @vitest-environment node
// A5 · E7, Tarefa 6a: o anúncio da ferramenta `youtube_observatory` diz exatamente os parâmetros que o adaptador lê
// (type, bookmarked e tier eram lidos e não anunciados; channel_id era anunciado e ignorado).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const servico = vi.hoisted(() => ({
  listCompetitorChannels: vi.fn(async () => ({ data: { channels: [], count: 0 } })),
  listCompetitorChanges: vi.fn(async () => ({ data: { changes: [], count: 0 } })),
  listCompetitorOutliers: vi.fn(async () => ({ data: { outliers: [], count: 0 } })),
  getCompetitorInsights: vi.fn(async () => ({ data: {} })),
}))
vi.mock('@/lib/pipeline/services/competitors', () => servico)
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: 'site-sintetico', permissions: ['read'], keyHash: 'h' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { YoutubeObservatoryShape } from '@/lib/pipeline/mcp/tools'
import { youtubeObservatory, PARAMETROS_LIDOS } from '@/lib/pipeline/mcp/services/youtube-observatory'

const shape = z.object(YoutubeObservatoryShape)
beforeEach(() => Object.values(servico).forEach(f => f.mockClear()))

describe('o anúncio e o adaptador', () => {
  it('falam dos mesmos parâmetros', () => {
    expect(new Set(Object.keys(YoutubeObservatoryShape))).toEqual(new Set(PARAMETROS_LIDOS))
    expect(PARAMETROS_LIDOS).toContain('campos')
  })

  it('todo params.<nome> lido no arquivo do adaptador está em PARAMETROS_LIDOS', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/pipeline/mcp/services/youtube-observatory.ts'), 'utf8')
    const lidos = new Set([...t.matchAll(/params\.(\w+)/g)].map(m => m[1]!))
    expect(lidos.size).toBeGreaterThan(3)
    for (const nome of lidos) expect(PARAMETROS_LIDOS as readonly string[], nome).toContain(nome)
  })

  it('type, bookmarked e tier são anunciados; channel_id não', () => {
    expect(Object.keys(YoutubeObservatoryShape)).toEqual(expect.arrayContaining(['type', 'bookmarked', 'tier']))
    expect(Object.keys(YoutubeObservatoryShape)).not.toContain('channel_id')
  })

  it('os valores de type são os de change_type do banco, mais all', () => {
    expect(shape.safeParse({ action: 'get_changes', type: 'title' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'thumbnail' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'description' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'all' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'tags' }).success).toBe(false)
    expect(shape.safeParse({ action: 'get_outliers', tier: 'banana' }).success).toBe(false)
    expect(shape.safeParse({ action: 'get_outliers', tier: 'top' }).success).toBe(true)
  })

  it('a descrição de get_outliers diz o que ele faz, não "mudanças marcadas"', () => {
    const d = YoutubeObservatoryShape.action.description ?? ''
    expect(d).toContain('videos with a multiplier of 2x or more vs the channel')
    expect(d).not.toContain('bookmarked notable changes')
  })

  it('chamada antiga com channel_id continua aceita, e a chave some do resultado', () => {
    const r = shape.safeParse({ action: 'get_changes', channel_id: '00000000-0000-4000-8000-000000000001' })
    expect(r.success).toBe(true)
    if (r.success) expect(Object.keys(r.data)).not.toContain('channel_id')
  })
})

describe('campos (6b)', () => {
  it('campos=todos é anunciado e só aceita todos', () => {
    expect(Object.keys(YoutubeObservatoryShape)).toContain('campos')
    expect(shape.safeParse({ action: 'get_changes', campos: 'todos' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', campos: 'x' }).success).toBe(false)
  })

  it('get_changes repassa campos, type e bookmarked', async () => {
    await youtubeObservatory({ action: 'get_changes', campos: 'todos', type: 'thumbnail', bookmarked: false })
    expect(servico.listCompetitorChanges).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ campos: 'todos', type: 'thumbnail', bookmarked: false }))
  })

  it('get_changes sem campos não manda campos', async () => {
    await youtubeObservatory({ action: 'get_changes' })
    const filtros = (servico.listCompetitorChanges.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1]
    expect(filtros['campos']).toBeUndefined()
  })
})

describe('o adaptador repassa o que lê', () => {
  it('get_changes repassa type e bookmarked', async () => {
    await youtubeObservatory({ action: 'get_changes', type: 'title', bookmarked: true, limit: 10 })
    expect(servico.listCompetitorChanges).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'title', bookmarked: true, limit: 10 }))
  })

  it('list_channels, get_outliers e get_insights seguem como antes', async () => {
    await youtubeObservatory({ action: 'list_channels' })
    expect(servico.listCompetitorChannels).toHaveBeenCalledTimes(1)
    await youtubeObservatory({ action: 'get_outliers', tier: 'high', limit: 7, fmt: 'short' })
    expect(servico.listCompetitorOutliers).toHaveBeenCalledWith(expect.anything(), { tier: 'high', limit: 7, fmt: 'short' })
    await youtubeObservatory({ action: 'get_outliers' })
    expect(servico.listCompetitorOutliers).toHaveBeenLastCalledWith(expect.anything(), { tier: 'all', limit: 25, fmt: 'long' })
    await youtubeObservatory({ action: 'get_insights' })
    expect(servico.getCompetitorInsights).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// O tamanho do texto que a ferramenta entrega com campos=todos (P-14: 60.000 caracteres sem a resposta do dono)
// ---------------------------------------------------------------------------

const LIMITE_DE_TEXTO = 60_000
/** O bytes_max de `tags` que a P-2 mediu em produção em 14/10 foi 561: uma lista de tags com esse tamanho, nos dois valores. */
const tags = (n: number): string[] => Array.from({ length: 51 }, (_, i) => 't' + String(n).padStart(4, '0') + String(i).padStart(2, '0'))
const troca = (n: number) => ({
  id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'), video_id: 'yt_sintetico_' + n, video_title: 'Título sintético do vídeo número ' + n + ' com tamanho realista', channel_name: 'Canal sintético ' + n,
  change_type: 'title', old_title: 'Título antigo sintético número ' + n, new_title: 'Título novo sintético número ' + n, old_thumbnail_url: null, new_thumbnail_url: null, view_count_at_change: 123456, detected_at: '2026-10-12T12:00:00.000Z', bookmarked: false,
})
const mudanca = (n: number) => ({
  id: n, alvo: 'video', channel_name: 'Canal sintético ' + n, video_id: 'yt_sintetico_' + n, video_title: 'Título sintético do vídeo número ' + n + ' com tamanho realista', campo: 'tags',
  valor_novo: tags(n), valor_anterior: { estado: 'lido', valor: tags(n + 5000) }, visto_em: '2026-10-12 12:00:00.123456+00', janela_desde: '2026-10-11 12:00:00.123456+00', precisao: '1d',
})
const corpo = (n: number) => ({
  changes: Array.from({ length: n }, (_, i) => troca(i)), count: n,
  mudancas_de_campo: {
    estado: 'lido', itens: Array.from({ length: n }, (_, i) => mudanca(i)), count: n, limite: n, cortado: false, coleta_desde: '2026-10-12 12:00:00.123456+00',
    lido_ate: { mais_antigo: '2026-10-12 12:00:00.123456+00', mais_recente: '2026-10-12 12:00:00.123456+00', canais_sem_leitura: 0, videos_mais_antigo: '2026-10-12 12:00:00.123456+00', videos_mais_recente: '2026-10-12 12:00:00.123456+00' },
    fora_da_lista: 0, video_de_outro_site: 0, video_ausente: 0,
  },
})
/** O maior `limit` cujo texto cabe: é o número que o documento escreve ("pela ferramenta, com `campos`, peça `limit` de até N"). */
const LIMIT_DOCUMENTADO_COM_CAMPOS = 17

describe('get_changes com campos pela ferramenta: o texto é medido', () => {
  async function tamanhoDoTexto(n: number): Promise<number> {
    servico.listCompetitorChanges.mockResolvedValueOnce({ data: corpo(n) } as never)
    const r = await youtubeObservatory({ action: 'get_changes', campos: 'todos', limit: n })
    const c = r.content[0]
    return c && c.type === 'text' ? c.text.length : -1
  }

  it('com o limit padrão da ferramenta (50) e o pior valor de tags da P-2, o texto passa do limite: o número que cabe é o documentado', async () => {
    const com50 = await tamanhoDoTexto(50)
    let maior = 0
    for (let n = 50; n >= 1; n--) if ((await tamanhoDoTexto(n)) <= LIMITE_DE_TEXTO) { maior = n; break }
    expect(com50).toBeGreaterThan(LIMITE_DE_TEXTO)
    expect(maior).toBe(LIMIT_DOCUMENTADO_COM_CAMPOS)
  })

  it('o texto com o limit documentado cabe, e com um a mais não cabe', async () => {
    expect(await tamanhoDoTexto(LIMIT_DOCUMENTADO_COM_CAMPOS)).toBeLessThanOrEqual(LIMITE_DE_TEXTO)
    expect(await tamanhoDoTexto(LIMIT_DOCUMENTADO_COM_CAMPOS + 1)).toBeGreaterThan(LIMITE_DE_TEXTO)
  })
})
