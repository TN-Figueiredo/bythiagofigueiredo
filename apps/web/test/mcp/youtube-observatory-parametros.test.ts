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
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: 'site-sintetico', permissions: ['read'], keyHash: 'h' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { YoutubeObservatoryShape } from '@/lib/pipeline/mcp/tools'
import { youtubeObservatory, PARAMETROS_LIDOS, LIMITE_MUDANCAS_TEXTO, LIMITE_DO_TEXTO_DA_FERRAMENTA } from '@/lib/pipeline/mcp/services/youtube-observatory'

const shape = z.object(YoutubeObservatoryShape)
beforeEach(() => { Object.values(servico).forEach(f => f.mockClear()); sentry.captureMessage.mockReset() })

describe('F2 T8: get_signals e dismiss_signal no anúncio', () => {
  it('as duas ações existem e os três parâmetros novos são anunciados', () => {
    expect(shape.safeParse({ action: 'get_signals' }).success).toBe(true)
    expect(shape.safeParse({ action: 'dismiss_signal', signal_id: '22222222-2222-4222-8222-222222222222', status: 'dispensado', motivo: 'ja_fiz' }).success).toBe(true)
    expect(Object.keys(YoutubeObservatoryShape)).toEqual(expect.arrayContaining(['signal_id', 'status', 'motivo']))
    expect(PARAMETROS_LIDOS).toEqual(expect.arrayContaining(['signal_id', 'status', 'motivo']))
  })
  it("E-1: status 'feito' é rejeitado pelo esquema; signal_id precisa ser uuid; motivo é lista fechada", () => {
    expect(shape.safeParse({ action: 'dismiss_signal', signal_id: '22222222-2222-4222-8222-222222222222', status: 'feito', motivo: 'ja_fiz' }).success).toBe(false)
    expect(shape.safeParse({ action: 'dismiss_signal', signal_id: 'x', status: 'dispensado', motivo: 'ja_fiz' }).success).toBe(false)
    expect(shape.safeParse({ action: 'dismiss_signal', signal_id: '22222222-2222-4222-8222-222222222222', motivo: 'porque sim' }).success).toBe(false)
  })
  it('a descrição pede para citar motivoVazio como está e diz "associação, não causa"', () => {
    const d = YoutubeObservatoryShape.action.description ?? ''
    expect(d).toMatch(/motivoVazio as is/)
    expect(d).toMatch(/association and never a cause/)
    expect(d).toMatch(/can help/)
  })
})

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
const LIMIT_DOCUMENTADO_COM_CAMPOS = LIMITE_MUDANCAS_TEXTO

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

  it('o adaptador impõe o teto: com limit 50 e campos=todos o serviço recebe o teto e o texto fica abaixo de 60.000', async () => {
    servico.listCompetitorChanges.mockImplementationOnce((async (_ctx: unknown, p: { limit: number }) => ({ data: corpo(p.limit) })) as never)
    const r = await youtubeObservatory({ action: 'get_changes', campos: 'todos', limit: 50 })
    expect(servico.listCompetitorChanges.mock.calls[0]?.[1]).toMatchObject({ limit: LIMITE_MUDANCAS_TEXTO })
    const c = r.content[0]
    expect(c && c.type === 'text' ? c.text.length : Infinity).toBeLessThan(LIMITE_DE_TEXTO)
  })

  it('sem campos o limit passa como veio; sem limit com campos o padrão 25 também é cortado no teto', async () => {
    await youtubeObservatory({ action: 'get_changes', limit: 50 })
    expect(servico.listCompetitorChanges.mock.calls[0]?.[1]).toMatchObject({ limit: 50 })
    await youtubeObservatory({ action: 'get_changes', campos: 'todos' })
    expect(servico.listCompetitorChanges.mock.calls[1]?.[1]).toMatchObject({ limit: LIMITE_MUDANCAS_TEXTO })
  })
})

// ---------------------------------------------------------------------------
// A5 · E7, Tarefa 13: `list_channels` sai sem indentação (a Tarefa 12 mediu: 15 canais passam do limite com a indentação) e avisa
// o Sentry acima de 80% do limite. As outras três ações seguem com `toMcpSuccess`.
// ---------------------------------------------------------------------------

/** Uma lista cujo `JSON.stringify` tem exatamente `alvo` caracteres (enchimento num campo de texto). */
function listaComTamanho(alvo: number): { channels: Array<{ nome: string }>; count: number } {
  const vazia = { channels: [{ nome: '' }], count: 1 }
  const falta = alvo - JSON.stringify(vazia).length
  return { channels: [{ nome: 'x'.repeat(falta) }], count: 1 }
}
async function textoDe(data: unknown): Promise<string> {
  servico.listCompetitorChannels.mockResolvedValueOnce({ data } as never)
  const r = await youtubeObservatory({ action: 'list_channels' })
  const c = r.content[0]
  return c && c.type === 'text' ? c.text : ''
}

describe('list_channels: texto sem indentação e aviso de tamanho', () => {
  it('o limite é o da P-14', () => { expect(LIMITE_DO_TEXTO_DA_FERRAMENTA).toBe(60_000) })

  it('sai sem indentação, faz JSON.parse e é igual ao dado; as outras três ações seguem com o formato de antes', async () => {
    const dado = { channels: [{ id: 'a', medidas: { x: { y: 1 } } }], count: 1, medidas_indisponiveis: { total: 9, indisponiveis: 0, por_motivo: {} } }
    const t = await textoDe(dado)
    expect(JSON.parse(t)).toEqual(dado)
    expect(t).not.toContain('\n  ')
    expect(t).toBe(JSON.stringify(dado))
    servico.getCompetitorInsights.mockResolvedValueOnce({ data: { a: { b: 1 } } } as never)
    const ins = await youtubeObservatory({ action: 'get_insights' })
    const ci = ins.content[0]
    expect(ci && ci.type === 'text' ? ci.text : '').toContain('\n  ')
    const r = await youtubeObservatory({ action: 'list_channels' })
    expect(r.isError).toBe(false)
  })

  it('15 canais com medidas cabem no limite sem indentação', async () => {
    const medida = { estado: 'medido', valor: { variacao: 0.3, direcao: 'subindo', ganhoRecente: 130000, ganhoAnterior: 100000 }, n: 3, janela: { de: '2026-06-05', ate: '2026-07-31', dias: 56 } }
    const canais = Array.from({ length: 15 }, (_, i) => ({ id: 'c' + i, channel_name: 'Canal ' + i, medidas: { a: medida, b: medida, c: medida, d: medida, e: medida, f: medida, g: medida, h: medida, i: medida } }))
    const t = await textoDe({ channels: canais, count: 15 })
    expect(t.length).toBeLessThan(LIMITE_DO_TEXTO_DA_FERRAMENTA)
  })

  it('avisa quando o texto passa de 80% do limite, uma vez, só com caracteres e canais; abaixo, nenhum aviso; a resposta é a mesma', async () => {
    const abaixo = listaComTamanho(0.8 * LIMITE_DO_TEXTO_DA_FERRAMENTA - 1)
    const acima = listaComTamanho(0.8 * LIMITE_DO_TEXTO_DA_FERRAMENTA + 1)
    const t1 = await textoDe(abaixo)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    const t2 = await textoDe(acima)
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage).toHaveBeenCalledWith('e7.resposta_da_ferramenta_grande', { extra: { caracteres: t2.length, canais: 1 } })
    expect(JSON.parse(t1)).toEqual(abaixo)
    expect(JSON.parse(t2)).toEqual(acima)
  })

  it('o aviso que lança não derruba a resposta', async () => {
    sentry.captureMessage.mockImplementation(() => { throw new Error('Sentry fora do ar') })
    const acima = listaComTamanho(0.8 * LIMITE_DO_TEXTO_DA_FERRAMENTA + 1)
    servico.listCompetitorChannels.mockResolvedValueOnce({ data: acima } as never)
    const r = await youtubeObservatory({ action: 'list_channels' })
    expect(r.isError).toBe(false)
    const c = r.content[0]
    expect(JSON.parse(c && c.type === 'text' ? c.text : 'null')).toEqual(acima)
    sentry.captureMessage.mockReset()
  })
})
