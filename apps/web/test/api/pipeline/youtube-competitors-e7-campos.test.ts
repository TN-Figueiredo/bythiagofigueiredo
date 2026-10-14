// @vitest-environment node
// A5 · E7, Tarefa 4: o leitor das mudanças de campo (`campos=todos`): lista fechada do que sai, valor anterior, a diferença
// entre "nenhuma mudança" e "não lemos", a ponta final da cobertura (canais e vídeos) e o filtro de site em toda consulta.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const capturarMensagem = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => capturarMensagem(...a), captureException: vi.fn() }))

import {
  listarMudancasDeCampo, FRASES_DE_CAMPO, CAMPOS_DE_VIDEO_QUE_SAEM, CAMPOS_DE_CANAL_QUE_SAEM, CAMPOS_DE_CANAL_QUE_NUNCA_SAEM, CAMPOS_DE_VIDEO_QUE_NUNCA_SAEM,

} from '@/lib/pipeline/services/competitors-campos'
import { VIDEO_FIELDS, CHANNEL_FIELDS } from '@/lib/youtube/observatorio/field-catalog'
import { baseE7, criarBancoFalso, AGORA, aoDia, idVideo, SITE_A, SITE_B, CANAL_A1, CANAL_A2, CANAL_B1, SENTINELA_ERRO, type Linha, type Tabelas, type BancoFalso, type ModoDaTabela } from './e7-fixture'

let seq = 0
interface V { canal?: string; video?: number; field: string; value: unknown; first: string; precision?: string; window?: string | null; site?: string; id?: number }
const versao = (v: V): Linha => ({
  id: v.id ?? ++seq, site_id: v.site ?? SITE_A, competitor_channel_id: v.canal ?? CANAL_A1, video_id: v.video === undefined ? null : idVideo(v.video),
  field: v.field, value: v.value, first_seen_at: v.first, last_seen_at: v.first, window_start: v.window ?? null, precision: v.precision ?? '1d', is_current: false,
})
const SENT = 'SENTINELA_DESCRICAO contato@exemplo.test'

function mundo(versoes: Linha[], mut?: (t: Tabelas) => void): BancoFalso {
  const t = baseE7()
  for (const c of t['competitor_channels']!) c['last_seen_at'] = aoDia(0, 2)
  for (const v of t['competitor_videos']!) v['last_seen_at'] = aoDia(0, 3)
  t['competitor_field_versions'] = versoes
  mut?.(t)
  return criarBancoFalso(t)
}
/** A base com uma primeira leitura e duas trocas: tags do vídeo 1 e nome do canal A1. */
const base = (): Linha[] => [
  versao({ video: 1, field: 'tags', value: ['a', 'b'], first: aoDia(5), precision: 'first' }),
  versao({ video: 1, field: 'tags', value: ['a', 'b', 'c'], first: aoDia(2), precision: '1d', window: aoDia(3) }),
  versao({ field: 'name', value: 'Canal Alfa', first: aoDia(5), precision: 'first' }),
  versao({ field: 'name', value: 'Canal Alfa Novo', first: aoDia(1), precision: '7d', window: aoDia(8) }),
]
const ler = (b: BancoFalso, limite = 25, site = SITE_A, o: { bloco?: number } = {}) => listarMudancasDeCampo(b.sb, site, { limite, ...o })
async function lerOk(b: BancoFalso, limite = 25, site = SITE_A, o: { bloco?: number } = {}) {
  const r = await ler(b, limite, site, o)
  if (r.estado !== 'lido') throw new Error('esperava lido, veio ' + r.motivo)
  return r
}

beforeEach(() => { capturarMensagem.mockReset(); seq = 0 })

describe('a lista do que sai', () => {
  it('a lista do que sai mais a do que nunca sai é o catálogo, campo a campo', () => {
    expect([...CAMPOS_DE_VIDEO_QUE_SAEM, ...CAMPOS_DE_VIDEO_QUE_NUNCA_SAEM].sort()).toEqual([...VIDEO_FIELDS].sort())
    expect([...CAMPOS_DE_CANAL_QUE_SAEM, ...CAMPOS_DE_CANAL_QUE_NUNCA_SAEM].sort()).toEqual([...CHANNEL_FIELDS].sort())
    const sai = new Set<string>([...CAMPOS_DE_VIDEO_QUE_SAEM, ...CAMPOS_DE_CANAL_QUE_SAEM])
    for (const n of [...CAMPOS_DE_VIDEO_QUE_NUNCA_SAEM, ...CAMPOS_DE_CANAL_QUE_NUNCA_SAEM]) expect(sai.has(n) && n === 'description').toBe(false)
    expect(CAMPOS_DE_CANAL_QUE_NUNCA_SAEM).toEqual(['description'])
    expect(CAMPOS_DE_CANAL_QUE_SAEM).not.toContain('description')
  })
})

describe('o que a lista entrega', () => {
  it('mudança de tags de um vídeo', async () => {
    const r = await lerOk(mundo(base()))
    const m = r.itens.find(i => i.campo === 'tags')!
    expect(m).toMatchObject({
      alvo: 'video', channel_name: 'Canal Alfa', video_id: 'yt_sintetico_1', video_title: 'Alfa um', campo: 'tags',
      valor_novo: ['a', 'b', 'c'], valor_anterior: { estado: 'lido', valor: ['a', 'b'] }, visto_em: aoDia(2), janela_desde: aoDia(3), precisao: '1d',
    })
    expect(typeof m.id).toBe('number')
  })

  it('mudança de nome do canal: alvo canal, sem video_id nem video_title', async () => {
    const r = await lerOk(mundo(base()))
    const m = r.itens.find(i => i.campo === 'name')!
    expect(m).toMatchObject({ alvo: 'canal', channel_name: 'Canal Alfa', video_id: null, video_title: null, valor_novo: 'Canal Alfa Novo', valor_anterior: { estado: 'lido', valor: 'Canal Alfa' }, precisao: '7d' })
  })

  it('a primeira leitura não é mudança: lido, vazio, com coleta_desde', async () => {
    const r = await lerOk(mundo([versao({ video: 1, field: 'tags', value: ['a'], first: aoDia(5), precision: 'first' })]))
    expect(r).toMatchObject({ estado: 'lido', itens: [], count: 0, cortado: false, coleta_desde: aoDia(5) })
  })

  it('site sem nenhuma versão: nao_lido, coleta_ainda_nao_comecou, com frase', async () => {
    const r = await ler(mundo([]))
    expect(r).toEqual({ estado: 'nao_lido', motivo: 'coleta_ainda_nao_comecou', frase: FRASES_DE_CAMPO.coleta_ainda_nao_comecou })
    expect(Object.keys(FRASES_DE_CAMPO).sort()).toEqual(['cortado', 'coleta_ainda_nao_comecou', 'erro_do_banco', 'tabela_ausente'].sort())
  })

  it('valor novo nulo é valor', async () => {
    const r = await lerOk(mundo([...base(), versao({ video: 2, field: 'default_language', value: 'pt', first: aoDia(6), precision: 'first' }), versao({ video: 2, field: 'default_language', value: null, first: aoDia(0), precision: '1d' })]))
    expect(r.itens.find(i => i.campo === 'default_language')).toMatchObject({ valor_novo: null, valor_anterior: { estado: 'lido', valor: 'pt' } })
  })

  it('mudança sem linha anterior: nao_lido, sem_versao_anterior', async () => {
    const r = await lerOk(mundo([versao({ video: 1, field: 'tags', value: ['x'], first: aoDia(5), precision: '1d' })]))
    expect(r.itens[0]!.valor_anterior).toEqual({ estado: 'nao_lido', motivo: 'sem_versao_anterior' })
  })

  it('description do canal nunca sai, nem a frase plantada', async () => {
    const r = await lerOk(mundo([...base(),
      versao({ field: 'description', value: 'antes', first: aoDia(5), precision: 'first' }),
      versao({ field: 'description', value: SENT, first: aoDia(0), precision: '1d' })]))
    expect(r.itens.map(i => i.campo)).not.toContain('description')
    expect(r.itens.some(i => i.campo === 'name')).toBe(true)
    expect(JSON.stringify(r)).not.toContain('SENTINELA_DESCRICAO')
    expect(r.fora_da_lista).toBe(0)
  })

  it('campo de canal numa linha de vídeo: descartada e contada em fora_da_lista', async () => {
    const r = await lerOk(mundo([...base(), versao({ video: 1, field: 'name', value: 'impossível', first: aoDia(0, 5), precision: '1d' })]))
    expect(r.fora_da_lista).toBe(1)
    expect(r.itens.some(i => i.valor_novo === 'impossível')).toBe(false)
  })
})

describe('limite, empate e blocos', () => {
  const tres = (): Linha[] => [
    versao({ video: 1, field: 'tags', value: ['0'], first: aoDia(9), precision: 'first' }),
    versao({ video: 1, field: 'tags', value: ['1'], first: aoDia(3) }), versao({ video: 1, field: 'tags', value: ['2'], first: aoDia(2) }), versao({ video: 1, field: 'tags', value: ['3'], first: aoDia(1) }),
  ]
  it('limite 2 com 3 mudanças: 2 itens, cortado, as mais recentes', async () => {
    const r = await lerOk(mundo(tres()), 2)
    expect(r).toMatchObject({ cortado: true, limite: 2, count: 2 })
    expect(r.itens.map(i => i.valor_novo)).toEqual([['3'], ['2']])
  })
  it('limite 2 com 2 mudanças: cortado false', async () => {
    const r = await lerOk(mundo(tres().slice(0, 3)), 2)
    expect(r).toMatchObject({ cortado: false, count: 2 })
  })
  it('empate de first_seen_at: ordem pelo id, estável em duas chamadas', async () => {
    const mesmo = aoDia(1)
    const vs = [versao({ video: 1, field: 'tags', value: ['0'], first: aoDia(9), precision: 'first' }),
      versao({ video: 1, field: 'category_id', value: '1', first: aoDia(9), precision: 'first' }),
      versao({ video: 1, field: 'tags', value: ['a'], first: mesmo, id: 50 }), versao({ video: 1, field: 'category_id', value: '2', first: mesmo, id: 51 })]
    const a = await lerOk(mundo(vs)), b = await lerOk(mundo(vs))
    expect(a.itens.map(i => i.id)).toEqual([51, 50])
    expect(b.itens.map(i => i.id)).toEqual([51, 50])
  })
  it('o in() é montado em blocos: limite 100, 100 vídeos, bloco 40, nenhum vídeo perdido', async () => {
    const extra: Linha[] = [], vs: Linha[] = []
    for (let i = 100; i < 200; i++) {
      extra.push({ id: idVideo(i), competitor_channel_id: CANAL_A1, video_id: 'yt_x_' + i, title: 'Extra ' + i, view_count: 1, like_count: 0, comment_count: 0, published_at: aoDia(20), last_seen_at: aoDia(0), missing_since: null })
      vs.push(versao({ video: i, field: 'tags', value: ['a'], first: aoDia(10), precision: 'first' }), versao({ video: i, field: 'tags', value: ['b', String(i)], first: aoDia(1, i - 99) }))
    }
    const b = mundo(vs, t => t['competitor_videos']!.push(...extra))
    const r = await lerOk(b, 100, SITE_A, { bloco: 40 })
    expect(r.itens).toHaveLength(100)
    expect(new Set(r.itens.map(i => i.video_id)).size).toBe(100)
    const porId = b.doTabela('competitor_videos').filter(c => c.filtros.some(f => f.op === 'in' && f.coluna === 'id'))
    expect(porId).toHaveLength(3)
    for (const c of porId) expect((c.filtros.find(f => f.coluna === 'id')!.valor as unknown[]).length).toBeLessThanOrEqual(40)
    expect(r.itens.every(i => i.valor_anterior.estado === 'lido')).toBe(true)
  })
})

describe('falhas nunca viram lista', () => {
  const quando = (n: number) => (c: { n: number }) => c.n === n
  it.each(['ausente', 'erro', 'lanca', 'nulo', 'aborta'] as const)('modo %s na página (2): nao_lido, sem a mensagem sentinela', async modo => {
    const b = mundo(base()); b.falha('competitor_field_versions', modo, c => c.ordens.length === 2)
    const r = await ler(b)
    expect(r.estado).toBe('nao_lido')
    if (r.estado === 'nao_lido') expect(r.motivo).toBe(modo === 'ausente' ? 'tabela_ausente' : 'erro_do_banco')
    expect(JSON.stringify(r)).not.toContain(SENTINELA_ERRO)
  })

  const casos: Array<[string, string, (c: { n: number; colunas: string[]; ordens: unknown[]; filtros: Array<{ coluna: string }> }) => boolean]> = [
    ['(1) primeira leitura', 'competitor_field_versions', c => c.colunas.join() === 'first_seen_at'],
    ['(5) canais', 'competitor_channels', () => true],
    ['(6) vídeos da página', 'competitor_videos', c => c.filtros.some(f => f.coluna === 'id')],
    ['(7) ponta dos vídeos', 'competitor_videos', c => c.filtros.some(f => f.coluna === 'competitor_channel_id')],
  ]
  for (const [nome, tabela, qual] of casos) {
    it.each(['ausente', 'erro', 'lanca', 'nulo', 'aborta'] as const)(`falha em ${nome}, modo %s: nao_lido, nunca lido nem coleta_ainda_nao_comecou`, async (modo: ModoDaTabela) => {
      const b = mundo(base()); b.falha(tabela, modo, qual)
      const r = await ler(b)
      expect(r.estado).toBe('nao_lido')
      if (r.estado === 'nao_lido') expect(['tabela_ausente', 'erro_do_banco']).toContain(r.motivo)
      expect(JSON.stringify(r)).not.toContain(SENTINELA_ERRO)
    })
  }

  it('a falha na ponta dos vídeos (7) impede a página (2)', async () => {
    const b = mundo(base()); b.falha('competitor_videos', 'erro', c => c.filtros.some(f => f.coluna === 'competitor_channel_id'))
    await ler(b)
    expect(b.doTabela('competitor_field_versions').filter(c => c.ordens.length === 2)).toHaveLength(0)
  })

  it('falha ao ler os valores anteriores: os itens saem, valor_anterior de todos é nao_lido erro_do_banco', async () => {
    const b = mundo(base()); b.falha('competitor_field_versions', 'erro', c => c.ordens.length === 1 && c.ordens[0]!.coluna === 'id')
    const r = await lerOk(b)
    expect(r.itens.length).toBe(2)
    for (const i of r.itens) expect(i.valor_anterior).toEqual({ estado: 'nao_lido', motivo: 'erro_do_banco' })
  })

  it('só (3) ou só (4) falha: só os itens daquele alvo perdem o valor anterior', async () => {
    const b = mundo(base()); b.falha('competitor_field_versions', 'erro', c => c.filtros.some(f => f.op === 'in' && f.coluna === 'video_id'))
    const r = await lerOk(b)
    expect(r.itens.find(i => i.alvo === 'video')!.valor_anterior.estado).toBe('nao_lido')
    expect(r.itens.find(i => i.alvo === 'canal')!.valor_anterior.estado).toBe('lido')
  })

  it('site com versões e sem canal: lido, vazio, pontas nulas, sem (7) nem (2)', async () => {
    const b = mundo(base(), t => { t['competitor_channels'] = [] })
    const r = await lerOk(b)
    expect(r).toMatchObject({ itens: [], count: 0, lido_ate: { mais_antigo: null, mais_recente: null, canais_sem_leitura: 0, videos_mais_antigo: null, videos_mais_recente: null } })
    expect(b.doTabela('competitor_field_versions').filter(c => c.ordens.length === 2)).toHaveLength(0)
    expect(b.doTabela('competitor_videos')).toHaveLength(0)
  })

  it('toda consulta leva o tempo limite', async () => {
    const b = mundo(base()); await lerOk(b)
    expect(b.consultas.length).toBeGreaterThan(6)
    for (const c of b.consultas) expect(c.abortSignal).toBe(true)
  })
  void quando
})

describe('até quando a lista vale', () => {
  it('lido_ate traz a ponta final dos canais', async () => {
    const b = mundo(base(), t => {
      const cs = t['competitor_channels']!
      cs[0]!['last_seen_at'] = aoDia(3); cs[1]!['last_seen_at'] = aoDia(1); cs[2]!['last_seen_at'] = aoDia(0)
    })
    const r = await lerOk(b)
    expect(r.lido_ate).toMatchObject({ mais_antigo: aoDia(3), mais_recente: aoDia(0), canais_sem_leitura: 0 })
  })

  it('coleta parada: a resposta mostra a data da última leitura boa e difere da de uma base em dia', async () => {
    const parada = await lerOk(mundo(base(), t => { for (const c of t['competitor_channels']!) c['last_seen_at'] = aoDia(7) }))
    const emDia = await lerOk(mundo(base(), t => { for (const c of t['competitor_channels']!) c['last_seen_at'] = new Date(AGORA).toISOString() }))
    expect(parada.estado).toBe('lido')
    expect(parada.lido_ate.mais_recente).toBe(aoDia(7))
    expect(JSON.stringify(parada)).not.toBe(JSON.stringify(emDia))
  })

  it('canal nunca relido conta em canais_sem_leitura', async () => {
    const r = await lerOk(mundo(base(), t => { t['competitor_channels']![0]!['last_seen_at'] = null }))
    expect(r.lido_ate.canais_sem_leitura).toBe(1)
    expect(r.lido_ate.mais_antigo).toBe(aoDia(0, 2))
  })

  it('captura de vídeo parada com o canal lido hoje: a resposta difere', async () => {
    const canaisHoje = (t: Tabelas) => { for (const c of t['competitor_channels']!) c['last_seen_at'] = new Date(AGORA).toISOString() }
    const parada = await lerOk(mundo(base(), t => { canaisHoje(t); for (const v of t['competitor_videos']!) v['last_seen_at'] = aoDia(7) }))
    const emDia = await lerOk(mundo(base(), t => { canaisHoje(t); for (const v of t['competitor_videos']!) v['last_seen_at'] = new Date(AGORA).toISOString() }))
    expect(parada.lido_ate.mais_recente).toBe(new Date(AGORA).toISOString())
    expect(parada.lido_ate.videos_mais_recente).toBe(aoDia(7))
    expect(JSON.stringify(parada)).not.toBe(JSON.stringify(emDia))
  })

  it('nenhum vídeo com leitura: as duas pontas dos vídeos saem nulas; canal sem vídeo também', async () => {
    const a = await lerOk(mundo(base(), t => { for (const v of t['competitor_videos']!) v['last_seen_at'] = null }))
    expect(a.lido_ate).toMatchObject({ videos_mais_recente: null, videos_mais_antigo: null })
    const b = await lerOk(mundo(base(), t => { t['competitor_videos'] = [] }))
    expect(b.estado).toBe('lido')
    expect(b.lido_ate).toMatchObject({ videos_mais_recente: null, videos_mais_antigo: null })
  })

  it('vídeo com missing_since e vídeo nunca lido não entram na ponta', async () => {
    const b = mundo(base(), t => {
      const vs = t['competitor_videos']!.filter(v => v['competitor_channel_id'] === CANAL_A1 || v['competitor_channel_id'] === CANAL_A2)
      for (const v of vs) v['last_seen_at'] = null
      vs[0]!['last_seen_at'] = aoDia(1)
      vs[1]!['last_seen_at'] = aoDia(0); vs[1]!['missing_since'] = aoDia(0)
    })
    const r = await lerOk(b)
    // os vídeos dos outros canais de A seguem com a leitura de aoDia(0, 3), que é o limite de cima
    expect(r.lido_ate.videos_mais_antigo).toBe(aoDia(1))
  })
})

describe('proteções de site', () => {
  const duasBases = (): BancoFalso => mundo([...base(),
    versao({ canal: CANAL_B1, field: 'name', value: 'B antes', first: aoDia(5), precision: 'first', site: SITE_B }),
    versao({ canal: CANAL_B1, field: 'name', value: 'B depois', first: aoDia(0), precision: '1d', site: SITE_B }),
  ])

  it('a página filtra pelo site: pedir A não traz as mudanças de B', async () => {
    const b = duasBases()
    const r = await lerOk(b)
    expect(JSON.stringify(r)).not.toContain('B depois')
    expect(b.doTabela('competitor_field_versions').every(c => c.filtros.some(f => f.op === 'eq' && f.coluna === 'site_id' && f.valor === SITE_A))).toBe(true)
    const rb = await lerOk(b, 25, SITE_B)
    expect(rb.itens.map(i => i.valor_novo)).toEqual(['B depois'])
  })

  it('as versões anteriores filtram pelo site: o valor anterior é o de A', async () => {
    const b = mundo([...base(),
      versao({ video: 1, field: 'tags', value: ['de B'], first: aoDia(2, 5), precision: '1d', site: SITE_B }),
    ])
    const r = await lerOk(b)
    expect(r.itens.find(i => i.campo === 'tags')!.valor_anterior).toEqual({ estado: 'lido', valor: ['a', 'b'] })
  })

  it('os canais filtram pelo site, e vídeo de canal de outro site é descartado', async () => {
    const b = mundo([...base(),
      versao({ video: 10, field: 'tags', value: ['x'], first: aoDia(4), precision: 'first' }),
      versao({ video: 10, field: 'tags', value: ['y'], first: aoDia(0, 1), precision: '1d' }),
    ])
    const r = await lerOk(b)
    expect(r.video_de_outro_site).toBe(1)
    expect(r.fora_da_lista).toBe(0)
    expect(r.itens.some(i => i.video_title === 'Outro um')).toBe(false)
    expect(JSON.stringify(r)).not.toContain('Outro um')
    expect(capturarMensagem).toHaveBeenCalledWith('e7.video_de_outro_site', expect.anything())
    expect(JSON.stringify(capturarMensagem.mock.calls)).not.toContain('Outro um')
  })

  it('a página filtra pelos canais do site: leva o in() com os ids de (5) e o eq do site', async () => {
    const b = duasBases(); await lerOk(b)
    const pagina = b.doTabela('competitor_field_versions').filter(c => c.ordens.length === 2)
    expect(pagina.length).toBeGreaterThan(0)
    for (const c of pagina) {
      expect(c.filtros).toContainEqual({ op: 'eq', coluna: 'site_id', valor: SITE_A })
      const dentro = c.filtros.find(f => f.op === 'in' && f.coluna === 'competitor_channel_id')!
      expect(dentro.valor).toContain(CANAL_A1)
      expect(dentro.valor).not.toContain(CANAL_B1)
    }
  })

  it('a ponta dos vídeos só olha os canais do site', async () => {
    const b = mundo(base(), t => {
      for (const v of t['competitor_videos']!) v['last_seen_at'] = v['competitor_channel_id'] === CANAL_B1 ? new Date(AGORA).toISOString() : aoDia(7)
    })
    const r = await lerOk(b)
    expect(r.lido_ate.videos_mais_recente).toBe(aoDia(7))
  })

  it('vídeo da página que não volta em (6): descartado, video_ausente 1, sem aviso', async () => {
    const b = mundo(base())
    const original = b.sb.from.bind(b.sb)
    const antes = b.tabelas['competitor_videos']!
    // o vídeo some entre a página (2) e a leitura (6)
    b.sb.from = ((tabela: string) => {
      if (tabela === 'competitor_videos' && b.doTabela('competitor_field_versions').some(c => c.ordens.length === 2)) b.tabelas['competitor_videos'] = antes.filter(v => v['id'] !== idVideo(1))
      return original(tabela)
    }) as typeof b.sb.from
    const r = await lerOk(b)
    expect(r).toMatchObject({ video_ausente: 1, video_de_outro_site: 0 })
    expect(r.itens.some(i => i.alvo === 'video')).toBe(false)
    expect(capturarMensagem).not.toHaveBeenCalled()
  })
})

describe('o módulo', () => {
  it('é de servidor, não pede description nem as tabelas proibidas', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/pipeline/services/competitors-campos.ts'), 'utf8')
    expect(t).toContain("import 'server-only'")
    const codigo = t.replace(/\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/competitor_raw|yt_own_|youtube_analytics|competitor_video_comment/)
    expect(codigo).not.toMatch(/select\([^)]*description/)
  })
})

