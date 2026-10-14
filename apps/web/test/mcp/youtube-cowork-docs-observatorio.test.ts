// @vitest-environment node
// A5 · E7, Tarefa 7: o teste de CONTEÚDO do documento vivo do Cowork para o Observatório de concorrentes (os de estrutura não o
// fazem). O que o documento mostra tem de ser o que o código devolve: chaves dos exemplos, parâmetros da rota, lista de campos,
// frases que não podem faltar, e nada de campo que não existe.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listCompetitorChannels, listCompetitorChanges } from '@/lib/pipeline/services/competitors'
import { CAMPOS_DE_VIDEO_QUE_SAEM, CAMPOS_DE_CANAL_QUE_SAEM } from '@/lib/pipeline/services/competitors-campos'
import { YoutubeObservatoryShape } from '@/lib/pipeline/mcp/tools'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { baseE7, criarBancoFalso, contextoDe, aoDia, CANAL_A1, SITE_A, type Linha } from '../api/pipeline/e7-fixture'

const RAIZ = process.cwd()
const doc = readFileSync(join(RAIZ, 'data/pipeline-docs/cowork-docs-youtube.md'), 'utf8')
const secao = doc.slice(doc.indexOf('## Competitor Observatory'), doc.indexOf('\n## Leituras do observatório'))
const subsecao = (titulo: string): string => {
  const i = secao.indexOf('### ' + titulo)
  expect(i, titulo).toBeGreaterThan(-1)
  const j = secao.indexOf('\n### ', i + 5)
  return secao.slice(i, j === -1 ? undefined : j)
}
const CHANNELS = subsecao('GET /api/pipeline/youtube/competitors/channels')
const CHANGES = subsecao('GET /api/pipeline/youtube/competitors/changes')
const OUTLIERS = subsecao('GET /api/pipeline/youtube/competitors/outliers')
const INSIGHTS = subsecao('GET /api/pipeline/youtube/competitors/insights')
const NAO_ENTREGUE = subsecao('O que não é entregue ao Cowork nesta fase')

const blocosJson = (texto: string): string[] => [...texto.matchAll(/```json\n([\s\S]*?)```/g)].map(m => m[1]!)
const foraDeBloco = (texto: string): string => texto.replace(/```[\s\S]*?```/g, '')
const frases = (texto: string): string[] => foraDeBloco(texto).split(/(?<=[.!?])\s+|\n+/).map(f => f.trim()).filter(Boolean)
const chaves = (v: unknown): string[] => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort() : [])

const versao = (id: number, over: Linha): Linha => ({
  id, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'name', value: 'x', first_seen_at: aoDia(2), last_seen_at: aoDia(2),
  window_start: aoDia(3), precision: '1d', is_current: false, ...over,
})
async function mundoReal() {
  const t = baseE7()
  for (const c of t['competitor_channels']!) c['last_seen_at'] = aoDia(0, 2)
  for (const v of t['competitor_videos']!) v['last_seen_at'] = aoDia(0, 3)
  t['competitor_field_versions'] = [
    versao(1, { field: 'custom_url', value: '@alfa', is_current: true }), versao(2, { field: 'country', value: 'BR', is_current: true }),
    versao(3, { field: 'name', value: 'Antes', precision: 'first', first_seen_at: aoDia(5) }), versao(4, { field: 'name', value: 'Depois' }),
  ]
  const b = criarBancoFalso(t)
  const channels = (await listCompetitorChannels(contextoDe(b))).data.channels
  const changes = (await listCompetitorChanges(contextoDe(b), { campos: 'todos' })).data
  const vazio = criarBancoFalso(baseE7())
  const semHistorico = (await listCompetitorChanges(contextoDe(vazio), { campos: 'todos' })).data
  return { channels, changes, semHistorico }
}

describe('os exemplos do documento têm as chaves do que o código devolve', () => {
  it('o exemplo de channels tem as mesmas chaves que o serviço devolve (nos dois estados de perfil)', async () => {
    const { channels } = await mundoReal()
    const lido = channels.find(c => c.perfil.estado === 'lido')!
    const naoLido = channels.find(c => c.perfil.estado === 'nao_lido')!
    const [a, b] = blocosJson(CHANNELS)
    const exemplo = JSON.parse(a!) as { data: { channels: Array<Record<string, unknown>>; count: number } }
    expect(chaves(exemplo.data)).toEqual(['channels', 'count'])
    expect(chaves(exemplo.data.channels[0])).toEqual(chaves(lido))
    expect(chaves(exemplo.data.channels[0]!['perfil'])).toEqual(chaves(lido.perfil))
    expect(chaves(JSON.parse(b!))).toEqual(chaves(naoLido.perfil))
  })

  it('o exemplo de changes sem parâmetro tem as chaves de hoje', async () => {
    const { changes } = await mundoReal()
    const exemplo = JSON.parse(blocosJson(CHANGES)[0]!) as { data: { changes: Array<Record<string, unknown>> } }
    expect(chaves(exemplo.data)).toEqual(['changes', 'count'])
    expect(chaves(exemplo.data.changes[0])).toEqual(chaves(changes.changes[0]))
  })

  it('o exemplo de campos=todos tem as chaves de MudancaDeCampo e de LidoAte', async () => {
    const { changes } = await mundoReal()
    const real = changes.mudancas_de_campo!
    if (real.estado !== 'lido') throw new Error('esperava lido')
    const bloco = blocosJson(CHANGES).map(b => JSON.parse(b) as { data?: { mudancas_de_campo?: Record<string, unknown> } }).find(b => b.data?.mudancas_de_campo)!
    const doExemplo = bloco.data!.mudancas_de_campo as { itens: Array<Record<string, unknown>>; lido_ate: Record<string, unknown> }
    expect(chaves(doExemplo)).toEqual(chaves(real))
    expect(chaves(doExemplo.itens[0])).toEqual(chaves(real.itens[0]))
    expect(chaves(doExemplo.itens[0]!['valor_anterior'])).toEqual(chaves(real.itens[0]!.valor_anterior))
    expect(chaves(doExemplo.lido_ate)).toEqual(['canais_sem_leitura', 'mais_antigo', 'mais_recente', 'videos_mais_antigo', 'videos_mais_recente'])
    expect(chaves(doExemplo)).toEqual(expect.arrayContaining(['video_ausente', 'video_de_outro_site', 'fora_da_lista']))
  })

  it('o exemplo de nao_lido tem as chaves do código', async () => {
    const { semHistorico } = await mundoReal()
    const real = semHistorico.mudancas_de_campo!
    expect(real.estado).toBe('nao_lido')
    const exemplo = blocosJson(CHANGES).map(b => JSON.parse(b) as Record<string, unknown>).find(b => b['estado'] === 'nao_lido')!
    expect(chaves(exemplo)).toEqual(chaves(real))
  })

  it('há blocos JSON para comparar', () => {
    const validos = blocosJson(CHANNELS).concat(blocosJson(CHANGES))
    expect(validos.length).toBeGreaterThanOrEqual(4)
    for (const b of validos) expect(() => JSON.parse(b)).not.toThrow()
  })
})

describe('parâmetros, campos e o que não existe', () => {
  it('os parâmetros documentados de changes são os que a rota lê', () => {
    const rota = readFileSync(join(RAIZ, 'src/app/api/pipeline/youtube/competitors/changes/route.ts'), 'utf8')
    const lidos = new Set([...rota.matchAll(/searchParams\.get\('(\w+)'\)/g)].map(m => m[1]!))
    const paramsDoc = CHANGES.slice(CHANGES.indexOf('**Query params:**'), CHANGES.indexOf('**Response 200'))
    const documentados = new Set([...paramsDoc.matchAll(/^- `(\w+)`/gm)].map(m => m[1]!))
    expect(documentados).toEqual(lidos)
    expect([...lidos].sort()).toEqual(['bookmarked', 'campos', 'limit', 'type'])
  })

  it('a lista de campos do documento é a do código', () => {
    const linha = (rotulo: string) => CHANGES.split('\n').find(l => l.startsWith(rotulo))!
    const nomes = (l: string) => [...l.matchAll(/`(\w+)`/g)].map(m => m[1]!)
    expect(nomes(linha('**Campos de vídeo que saem:**'))).toEqual([...CAMPOS_DE_VIDEO_QUE_SAEM])
    expect(nomes(linha('**Campos de canal que saem:**'))).toEqual([...CAMPOS_DE_CANAL_QUE_SAEM])
    expect(CHANGES).toContain('A descrição do canal não é entregue')
  })

  it('o documento não cita os campos que não existem', () => {
    for (const morto of ['growthDelta', 'recentVideos', 'vsYou', 'channelThumbnailUrl', '"history"', 'growthSparkline', 'changeFlags']) expect(CHANNELS + CHANGES, morto).not.toContain(morto)
    // o parâmetro antigo (a chave `change_type` do corpo existe e fica)
    expect(CHANGES).not.toMatch(/`change_type` \(opcional\)|\?change_type=/)
    expect(CHANGES).not.toMatch(/`channel_id` \(opcional\)/)
  })

  it('o documento não cita tabela de comentário', () => {
    expect(doc).not.toContain('competitor_video_' + 'comment')
  })

  it('o documento só cita antes_de se a rota o lê', () => {
    const rota = readFileSync(join(RAIZ, 'src/app/api/pipeline/youtube/competitors/changes/route.ts'), 'utf8')
    expect(CHANGES.includes('antes_de')).toBe(rota.includes('antes_de'))
  })

  it('o documento diz o padrão de limit das duas portas', () => {
    const padraoDaFerramenta = YoutubeObservatoryShape.limit.parse(undefined)
    const f = frases(CHANGES).find(x => x.includes('`limit`') && x.includes('25'))!
    expect(f).toBeDefined()
    expect(f).toMatch(/25 pela rota HTTP/)
    expect(f).toContain(`${padraoDaFerramenta} pela ferramenta`)
  })

  it('a ferramenta com campos: o limit documentado é o da medida da Tarefa 6b', () => {
    expect(frases(CHANGES).some(f => f.includes('youtube_observatory') && f.includes('campos') && f.includes('`limit` de até 17'))).toBe(true)
  })
})

describe('as frases que o documento não pode perder', () => {
  const fraseCom = (texto: string, ...partes: string[]) => frases(texto).find(f => partes.every(p => f.includes(p)))

  it('o documento diz até quando a lista vale e o que fazer com cortado', () => {
    expect(fraseCom(CHANGES, 'lido_ate')).toBeDefined()
    expect(fraseCom(CHANGES, 'coleta_desde')).toBeDefined()
    expect(fraseCom(CHANGES, 'cortado')).toBeDefined()
    expect(fraseCom(CHANGES, 'diga até quando', 'nada mudou')).toBeDefined()
  })

  it('o documento separa a ponta do canal da ponta dos vídeos', () => {
    expect(fraseCom(CHANGES, 'videos_mais_recente', 'vídeo')).toBeDefined()
    expect(fraseCom(CHANGES, 'mais_recente', 'canal')).toBeDefined()
    expect(fraseCom(CHANGES, 'videos_mais_antigo', 'pode ser antigo sem defeito')).toBeDefined()
    expect(fraseCom(CHANGES, '`video_ausente`', 'não é defeito')).toBeDefined()
  })

  it('o documento diz que -1 e zero de insights não são medida', () => {
    expect(fraseCom(INSIGHTS, 'last_upload_days', '-1')).toBeDefined()
    expect(fraseCom(INSIGHTS, 'engagement_rate', 'falta')).toBeDefined()
    expect(fraseCom(CHANNELS, 'video_count', 'falha')).toBeDefined()
    expect(fraseCom(CHANNELS, 'avg_engagement', 'ocultos como zero')).toBeDefined()
  })

  it('o documento diz que outliers responde todas as idades', () => {
    expect(OUTLIERS).toContain('todas as idades')
    expect(OUTLIERS).toContain('tela Outliers')
    expect(OUTLIERS).toContain('base fraca')
    expect(OUTLIERS).toContain('por fase')
    expect(OUTLIERS).not.toContain('menos vídeos')
    expect(OUTLIERS).not.toContain('não calculado')
  })

  it('o documento separa os números antigos do canal próprio dos do Observatório', () => {
    const f = frases(NAO_ENTREGUE).find(x => x.includes('analytics/overview') && x.includes('search-terms') && x.includes('não são os do Observatório'))
    expect(f).toBeDefined()
    expect(NAO_ENTREGUE).toContain('texto de antes e depois da descrição')
    expect(NAO_ENTREGUE).toContain('só concorrentes')
  })

  it('o recurso MCP de outliers devolve mudanças marcadas, e o de channels não traz perfil', () => {
    expect(fraseCom(CHANNELS, 'pipeline://youtube/competitors/outliers', 'mudanças marcadas')).toBeDefined()
    expect(fraseCom(CHANNELS, 'pipeline://youtube/competitors/channels', 'não traz `perfil`')).toBeDefined()
  })

  it('perfil: null é "não informou", nao_lido não traz os campos, criado_em nulo tem as duas leituras', () => {
    expect(fraseCom(CHANNELS, '`perfil`', 'não informou')).toBeDefined()
    expect(fraseCom(CHANNELS, 'nao_lido', 'não traz `handle`')).toBeDefined()
    expect(fraseCom(CHANNELS, '`criado_em` nulo', 'ainda não gravado')).toBeDefined()
    expect(fraseCom(CHANNELS, '`lido_em`', 'pode ser posterior')).toBeDefined()
  })

  it('o workflow de Competitor Monitoring cita campos=todos', () => {
    expect(doc).toMatch(/competitors\/changes\s+→ detectar mudanças recentes \(`\?campos=todos`/)
  })
})

describe('o prompt e o registro', () => {
  const prompts = readFileSync(join(RAIZ, 'src/lib/pipeline/mcp/prompts.ts'), 'utf8')
  const bloco = prompts.slice(prompts.indexOf("'competitor-report'"), prompts.indexOf('server.prompt(', prompts.indexOf("'competitor-report'") + 20))

  it('o prompt competitor-report não manda anotar campo inexistente', () => {
    for (const morto of ['Growth delta', 'VsYou', 'Recent videos']) expect(bloco, morto).not.toContain(morto)
    expect(bloco).toContain('/api/pipeline/docs/youtube')
    expect(bloco).toContain('quote its `frase` and do not estimate the value')
    expect(bloco).toContain('not Observatory numbers')
  })

  it('o prompt manda não relatar -1 nem taxa zero de insights como medida', () => {
    expect(bloco).toMatch(/never report `-1`/i)
  })

  it('os dois resumos do registro dizem o que a rota devolve', () => {
    const dominios = API_REGISTRY.capabilities
    const ent = (p: string) => dominios.flatMap(d => [...d.endpoints]).find(e => e.path === p)!
    expect(ent('/api/pipeline/youtube/competitors/changes').summary).toContain('campos')
    expect(ent('/api/pipeline/youtube/competitors/channels').summary).toContain('profile')
    const dominio = dominios.find(d => d.domain === 'youtube')!
    expect(dominio.endpoint_count).toBe(34)
    expect(dominio.endpoints.length).toBe(34)
  })
})
