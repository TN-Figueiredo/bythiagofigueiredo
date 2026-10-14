// @vitest-environment node
// A5 · E7, Tarefa 8: a varredura de saída (itens 89, 119 e 168). Nenhuma resposta das rotas de concorrentes leva a descrição do
// canal, a resposta crua, texto ou autor de comentário, nem termo de pesquisa do canal próprio. As sentinelas são plantadas
// DENTRO deste teste (o nome das tabelas de comentário é montado por concatenação, para o arquivo não conter o texto que a
// varredura da F9 proíbe nos módulos de src/).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { listCompetitorChannels, listCompetitorChanges, listCompetitorOutliers, getCompetitorInsights } from '@/lib/pipeline/services/competitors'
import { baseE7, criarBancoFalso, contextoDe, aoDia, CANAL_A1, SITE_A, type BancoFalso, type Linha } from './e7-fixture'

const SENTINELAS = {
  descricao: 'SENTINELA_DESCRICAO contato@exemplo.test',
  raw: 'SENTINELA_RAW',
  comentario: 'SENTINELA_COMENTARIO',
  autor: 'SENTINELA_AUTOR',
  termo: 'SENTINELA_TERMO',
} as const

const T_COMENTARIO = 'competitor_video_' + 'comments'
const T_AUTOR = 'competitor_video_' + 'comment_authors'
const T_PROIBIDAS = ['competitor_raw', T_COMENTARIO, T_AUTOR, 'competitor_video_' + 'comment_snaps', 'competitor_video_' + 'comment_marks']

function mundo(): BancoFalso {
  const t = baseE7()
  t['competitor_channels']![0]!['description'] = SENTINELAS.descricao
  t['competitor_field_versions'] = [
    { id: 1, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'description', value: 'antes', first_seen_at: aoDia(6), last_seen_at: aoDia(6), window_start: null, precision: 'first', is_current: false },
    { id: 2, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'description', value: SENTINELAS.descricao, first_seen_at: aoDia(1), last_seen_at: aoDia(1), window_start: null, precision: '1d', is_current: true },
    { id: 3, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'name', value: 'Canal Alfa', first_seen_at: aoDia(6), last_seen_at: aoDia(6), window_start: null, precision: 'first', is_current: false },
    { id: 4, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'name', value: 'Canal Alfa Novo', first_seen_at: aoDia(1), last_seen_at: aoDia(1), window_start: null, precision: '1d', is_current: true },
  ]
  t['competitor_raw'] = [{ id: 1, site_id: SITE_A, body: SENTINELAS.raw } as Linha]
  t[T_COMENTARIO] = [{ id: 1, text: SENTINELAS.comentario, author_id: 1 }]
  t[T_AUTOR] = [{ id: 1, name: SENTINELAS.autor }]
  t['yt_own_video_traffic_detail_daily'] = [{ id: 1, detail: SENTINELAS.termo }]
  // as tabelas que o carregador do motor lê (vazias): outliers e insights passam pelo caminho de verdade
  for (const nome of ['competitor_settings', 'competitor_readings', 'youtube_intelligence_tasks', 'forja_heartbeat', 'youtube_channels', 'youtube_videos', 'competitor_video_daily', 'competitor_channel_snapshots', 'competitor_video_versions', 'competitor_video_tier_spans']) t[nome] = []
  return criarBancoFalso(t)
}

async function todasAsRespostas(b: BancoFalso): Promise<Record<string, unknown>> {
  const ctx = contextoDe(b)
  return {
    channels: (await listCompetitorChannels(ctx)).data,
    changes: (await listCompetitorChanges(ctx, {})).data,
    changes_campos: (await listCompetitorChanges(ctx, { campos: 'todos' })).data,
    outliers: (await listCompetitorOutliers(ctx, {})).data,
    insights: (await getCompetitorInsights(ctx)).data,
  }
}

function chaves(v: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) v.forEach(x => chaves(x, acc))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.add(k); chaves(x, acc) }
  return acc
}

describe('varredura de saída', () => {
  it('as sentinelas estão na base (base sem sentinela daria verde)', () => {
    const b = mundo()
    for (const s of Object.values(SENTINELAS)) expect(JSON.stringify(b.tabelas), s).toContain(s)
    expect((b.tabelas['competitor_channels']![0]!['description'] as string)).toBe(SENTINELAS.descricao)
  })

  it('nenhuma resposta contém sentinela', async () => {
    const r = await todasAsRespostas(mundo())
    const texto = JSON.stringify(r)
    for (const s of Object.values(SENTINELAS)) expect(texto, s).not.toContain(s)
    expect(texto).not.toContain('contato@exemplo.test')
    // a resposta de campos=todos tem o nome do canal (campo que sai) e não tem a descrição
    expect(JSON.stringify(r['changes_campos'])).toContain('Canal Alfa Novo')
    expect((r['changes_campos'] as { mudancas_de_campo: { estado: string } }).mudancas_de_campo.estado).toBe('lido')
  })

  it('os módulos novos não pedem as tabelas proibidas', async () => {
    const b = mundo()
    await todasAsRespostas(b)
    const tabelas = new Set(b.consultas.map(c => c.tabela))
    for (const proibida of T_PROIBIDAS) expect(tabelas.has(proibida), proibida).toBe(false)
    expect([...tabelas].filter(t => t.startsWith('yt_own_'))).toEqual([])
    expect(tabelas.has('competitor_field_versions')).toBe(true)
  })

  it('nenhuma consulta pede a coluna description nem a resposta crua', async () => {
    const b = mundo()
    await todasAsRespostas(b)
    const colunas = b.consultas.flatMap(c => c.colunas)
    expect(colunas).not.toContain('description')
    expect(colunas).not.toContain('raw')
    expect(colunas).not.toContain('*')
  })

  it('a resposta de channels não tem chave description, e a de changes também não', async () => {
    const r = await todasAsRespostas(mundo())
    for (const nome of ['channels', 'changes', 'changes_campos']) expect(chaves(r[nome]).has('description'), nome).toBe(false)
  })

  it('os módulos novos não citam as tabelas proibidas', () => {
    const dir = join(process.cwd(), 'src/lib/pipeline/services')
    const arquivos = readdirSync(dir).filter(f => /^competitors-.*\.ts$/.test(f))
    expect(arquivos).toEqual(expect.arrayContaining(['competitors-perfil.ts', 'competitors-campos.ts']))
    for (const f of arquivos) {
      const codigo = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(codigo, f).not.toMatch(/competitor_raw|yt_own_|youtube_analytics/)
      // nenhuma lista de colunas de select cita description
      for (const m of codigo.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g)) expect(m[2], f).not.toMatch(/\bdescription\b/)
    }
  })
})
