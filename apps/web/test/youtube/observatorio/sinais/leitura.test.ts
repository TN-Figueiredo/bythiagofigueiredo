// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { listarSinaisDoNicho, dispensarSinal } from '@/lib/youtube/observatorio/sinais/leitura'
import { fakeSb, type Consulta, type Resposta } from './fake-sb'

const SITE = '00000000-0000-4000-8000-000000000001'
const AGORA = new Date('2026-10-24T15:00:00Z')
const HORA = 3_600_000
const iso = (deltaH: number): string => new Date(AGORA.getTime() + deltaH * HORA).toISOString()
const EV = { outliers: [{ video_id: 'o1', canal_id: 'c1', published_at: iso(-48), mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: ['foto-antiga'] }

interface Mundo {
  sinais?: Array<Record<string, unknown>>
  total?: number
  estado?: Record<string, unknown> | null
  respondidos?: number
  lugares?: Array<{ video_id: string; chaves: string[] }>
  lugaresDoSite?: boolean
  videos?: Array<{ id: string; youtube_video_id: string }>
  metas?: Array<{ youtube_video_id: string; privacy_status: string | null; day_pt: string }>
}
const linha = (id: string, chave: string, extra: Record<string, unknown> = {}) => ({
  id, kind: 'destino', subject_key: chave, acao: 'video_novo', forca: '12.50', motivo: 'dois canais estouraram', rule_version: 'sinais-v1+semente-1',
  evidence: EV, first_seen_at: iso(-72), expires_at: iso(24 * 20), ...extra,
})

function mundo(m: Mundo) {
  return fakeSb((c: Consulta): Resposta => {
    if (c.tabela === 'niche_signals' && c.opcoes?.head) return { data: null, count: m.respondidos ?? 0 }
    if (c.tabela === 'niche_signals') return { data: m.sinais ?? [], count: m.total ?? (m.sinais ?? []).length }
    if (c.tabela === 'niche_signals_estado') return { data: m.estado === undefined ? null : [m.estado] }
    if (c.tabela === 'video_lugares' && c.filtros.some((f) => f.op === 'overlaps')) return { data: m.lugares ?? [] }
    if (c.tabela === 'video_lugares') return { data: m.lugaresDoSite === false ? [] : [{ video_id: 'x' }] }
    if (c.tabela === 'youtube_videos') return { data: m.videos ?? [] }
    if (c.tabela === 'yt_own_video_meta_daily') return { data: m.metas ?? [] }
    return { data: [] }
  })
}
const estado = (extra: Record<string, unknown> = {}) => ({ computed_at: iso(-2), motivo_vazio: null, contagens: { canais_total: 5, outliers_total: 3 }, ...extra })
const meta = (yt: string, p = 'public') => ({ youtube_video_id: yt, privacy_status: p, day_pt: '2026-10-23' })

describe('listarSinaisDoNicho: o N e a lista', () => {
  it('N é o total (count exact), não o tamanho da página; a consulta filtra aberto e expires_at > agora, ordena por forca desc e first_seen_at', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], total: 73, estado: estado(), lugaresDoSite: true })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA, 1)
    expect(l.n).toBe(73)
    expect(l.itens).toHaveLength(1)
    const q = w.consultas.find((c) => c.tabela === 'niche_signals')!
    expect(q.opcoes).toEqual({ count: 'exact' })
    expect(q.filtros).toEqual(expect.arrayContaining([
      { op: 'eq', col: 'site_id', val: SITE }, { op: 'eq', col: 'status', val: 'aberto' }, { op: 'gt', col: 'expires_at', val: AGORA.toISOString() },
    ]))
    expect(q.ordem.map((o) => `${o.col}:${o.asc}`).slice(0, 2)).toEqual(['forca:false', 'first_seen_at:true'])
    expect(q.limite).toBe(1)
  })

  it('o item traz forca numérica, acao derivada, acao_gravada e a evidência intacta (a foto histórica fica, mas a contagem vem de proprios_agora)', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }], videos: [{ id: 'p1', youtube_video_id: 'YT1' }], metas: [meta('YT1')] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    const it0 = l.itens[0]!
    expect(it0.forca).toBe(12.5)
    expect(it0.acao_gravada).toBe('video_novo')
    expect(it0.acao).toBe('titulo_descricao')
    expect(it0.n_proprios).toBe(1)
    expect(it0.proprios_agora).toEqual(['p1'])
    expect(it0.evidence.proprios).toEqual(['foto-antiga'])
    expect(l.motivoVazio).toBeNull()
  })
})

describe('listarSinaisDoNicho: o que acontece quando o dado não existe', () => {
  it('sem estado: nunca-calculado, desatualizado, sem consulta de respondidos', async () => {
    const w = mundo({ estado: null })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA, 50, false)
    expect(l).toMatchObject({ n: 0, motivoVazio: 'nunca-calculado', computado_em: null, desatualizado: true, calculoLigado: false })
    expect(w.consultas.some((c) => c.opcoes?.head)).toBe(false)
  })

  it('zero abertos com estado sem-lugar: motivoVazio e a contagem do estado', async () => {
    const w = mundo({ estado: estado({ motivo_vazio: 'sem-lugar', contagens: { outliers_sem_lugar: 4, outliers_total: 4 } }) })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.motivoVazio).toBe('sem-lugar')
    expect(l.contagens.outliers_sem_lugar).toBe(4)
    expect(l.contagens.respondidos_30d).toBe(0)
  })

  it('2 gravados e os 2 dispensados, estado sem motivo e computed_at antigo: tudo-respondido com respondidos_30d (por coalesce(dispensado_em, expires_at), não por computed_at)', async () => {
    const w = mundo({ estado: estado({ computed_at: iso(-24 * 20) }), respondidos: 2 })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.motivoVazio).toBe('tudo-respondido')
    expect(l.contagens.respondidos_30d).toBe(2)
    expect(l.desatualizado).toBe(true)
    const q = w.consultas.find((c) => c.opcoes?.head)!
    const corte = new Date(AGORA.getTime() - 30 * 24 * HORA).toISOString()
    expect(q.filtros).toEqual(expect.arrayContaining([
      { op: 'in', col: 'status', val: ['dispensado', 'feito', 'expirado'] },
      { op: 'or', col: `dispensado_em.gt.${corte},and(dispensado_em.is.null,expires_at.gt.${corte})`, val: undefined },
    ]))
  })

  it('estado sem motivo e sem respondidos: o catch-all sem-grupo (nunca null com n = 0)', async () => {
    const l = await listarSinaisDoNicho(mundo({ estado: estado(), respondidos: 0 }).sb, SITE, AGORA)
    expect(l.motivoVazio).toBe('sem-grupo')
  })

  it('propriedade: para qualquer combinação (estado, motivo, itens, respondidos), n = 0 implica motivoVazio != null; n > 0 implica null', async () => {
    const estados = [null, estado(), estado({ motivo_vazio: 'sem-lugar' }), estado({ motivo_vazio: 'sync-atrasado' }), estado({ motivo_vazio: 'sem-historico' })]
    for (const est of estados) for (const abertos of [0, 1, 3]) for (const respondidos of [0, 5]) {
      const w = mundo({ estado: est, sinais: Array.from({ length: abertos }, (_, i) => linha(`s${i}`, `k${i}`)), respondidos })
      const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
      if (l.n === 0) expect(l.motivoVazio, JSON.stringify({ est, abertos, respondidos })).not.toBeNull()
      else expect(l.motivoVazio).toBeNull()
    }
  })

  it('uma linha com expires_at passado e status aberto (gravador parado) não entra: o filtro vai à consulta, e computed_at de 37 h dá desatualizado', async () => {
    const w = mundo({ estado: estado({ computed_at: iso(-37) }), sinais: [] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.desatualizado).toBe(true)
    expect(w.consultas.find((c) => c.tabela === 'niche_signals')!.filtros).toContainEqual({ op: 'gt', col: 'expires_at', val: AGORA.toISOString() })
    expect((await listarSinaisDoNicho(mundo({ estado: estado({ computed_at: iso(-35) }) }).sb, SITE, AGORA)).desatualizado).toBe(false)
  })

  it('erro do banco lança (nunca lista vazia disfarçada), sem a mensagem crua', async () => {
    const sb = fakeSb(() => ({ data: null, error: { code: '42P01', message: 'relation "x" does not exist' } })).sb
    await expect(listarSinaisDoNicho(sb, SITE, AGORA)).rejects.toThrow(/sinais: leitura de/)
    await expect(listarSinaisDoNicho(sb, SITE, AGORA)).rejects.not.toThrow(/does not exist/)
  })
})

describe('listarSinaisDoNicho: proprios_agora e a ação derivada (r6)', () => {
  it('dois sinais: um próprio entrou em video_lugares depois do sinal; proprios_agora o inclui, evidence.proprios não', async () => {
    const w = mundo({ sinais: [linha('a', 'pt'), linha('b', 'es')], estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }], videos: [{ id: 'p1', youtube_video_id: 'YT1' }], metas: [meta('YT1')] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.itens.map((i) => i.proprios_agora)).toEqual([['p1'], []])
    expect(l.itens.map((i) => i.acao)).toEqual(['titulo_descricao', 'video_novo'])
    expect(l.itens[0]!.evidence.proprios).toEqual(['foto-antiga'])
  })

  it('uma consulta de lugares para todos os sinais (sem laço), com as subject_keys em overlaps', async () => {
    const w = mundo({ sinais: [linha('a', 'pt'), linha('b', 'es'), linha('c', 'pt', { kind: 'parecido' })], estado: estado(), lugares: [] })
    await listarSinaisDoNicho(w.sb, SITE, AGORA)
    const q = w.consultas.filter((c) => c.tabela === 'video_lugares' && c.filtros.some((f) => f.op === 'overlaps'))
    expect(q).toHaveLength(1)
    expect(q[0]!.filtros).toContainEqual({ op: 'overlaps', col: 'chaves', val: ['pt', 'es'] })
    expect(q[0]!.filtros).toContainEqual({ op: 'eq', col: 'origem', val: 'proprio' })
  })

  it('próprio private e próprio is_hidden ficam fora; sem linha de privacidade também não conta', async () => {
    const lugares = ['pub', 'priv', 'oculto', 'semmeta'].map((v) => ({ video_id: v, chaves: ['pt'] }))
    const w = mundo({
      sinais: [linha('a', 'pt')], estado: estado(), lugares,
      // 'oculto' não volta de youtube_videos (is_hidden = false filtra no banco)
      videos: [{ id: 'pub', youtube_video_id: 'YPUB' }, { id: 'priv', youtube_video_id: 'YPRIV' }, { id: 'semmeta', youtube_video_id: 'YSEM' }],
      metas: [meta('YPUB'), meta('YPRIV', 'private')],
    })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.itens[0]!.proprios_agora).toEqual(['pub'])
    const v = w.consultas.find((c) => c.tabela === 'youtube_videos')!
    expect(v.filtros).toEqual(expect.arrayContaining([{ op: 'eq', col: 'is_hidden', val: false }, { op: 'eq', col: 'site_id', val: SITE }]))
  })

  it('vale a ÚLTIMA privacidade: public antigo e private recente = fora', async () => {
    const w = mundo({
      sinais: [linha('a', 'pt')], estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }], videos: [{ id: 'p1', youtube_video_id: 'Y1' }],
      metas: [{ youtube_video_id: 'Y1', privacy_status: 'private', day_pt: '2026-10-23' }, { youtube_video_id: 'Y1', privacy_status: 'public', day_pt: '2026-10-01' }],
    })
    expect((await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!.proprios_agora).toEqual([])
  })

  it('sem video_lugares do site: proprios_agora é null, a ação fica a gravada com rótulo genérico (não medido ≠ nenhum vídeo seu)', async () => {
    const w = mundo({ sinais: [linha('a', 'pt', { acao: 'titulo_descricao' })], estado: estado(), lugares: [], lugaresDoSite: false })
    const i = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!
    expect(i.proprios_agora).toBeNull()
    expect(i).toMatchObject({ acao: 'titulo_descricao', rotulo_acao: 'generico', n_proprios: null })
  })

  it('o caso quarenta: a 10ª linha gravada video_novo e 1 vídeo hoje', async () => {
    const sinais = Array.from({ length: 10 }, (_, i) => linha(`s${i}`, i === 9 ? 'pt' : `k${i}`))
    const w = mundo({ sinais, estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }], videos: [{ id: 'p1', youtube_video_id: 'Y1' }], metas: [meta('Y1')] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.itens[9]).toMatchObject({ acao_gravada: 'video_novo', acao: 'titulo_descricao', n_proprios: 1 })
  })

  it('a leitura nunca escreve (nenhum update, insert, delete nem rpc)', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }], videos: [{ id: 'p1', youtube_video_id: 'Y1' }], metas: [meta('Y1')] })
    await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(w.consultas.filter((c) => c.mutacao !== null)).toEqual([])
    expect(w.rpc).toEqual([])
  })
})

describe('dispensarSinal', () => {
  it('chama niche_signals_dispensar com o site da guarda; ok e os motivos da função', async () => {
    const respostas = [{ ok: true }, { ok: false, motivo: 'nao_encontrado' }]
    const w = fakeSb(() => ({ data: respostas.shift() }))
    expect(await dispensarSinal(w.sb, SITE, 'id1', 'dispensado', 'ja_fiz', 'key:k1')).toEqual({ ok: true })
    expect(await dispensarSinal(w.sb, SITE, 'id2', 'dispensado', 'ja_fiz', 'key:k1')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(w.rpc[0]).toEqual({ nome: 'niche_signals_dispensar', args: { p_site: SITE, p_id: 'id1', p_status: 'dispensado', p_motivo: 'ja_fiz', p_por: 'key:k1' } })
  })
})

describe('o leitor é único: só leitura.ts (e a F2b) toca niche_signals e a coluna acao', () => {
  const SRC = resolve(__dirname, '../../../../src')
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  it("só leitura.ts e o gravador (que lê chaves abertas, nunca `acao`) fazem .from('niche_signals')", () => {
    const leem = arquivos(SRC).filter((f) => /from\(\s*['"]niche_signals['"]\s*\)/.test(readFileSync(f, 'utf8')))
    expect(leem.map((f) => f.slice(SRC.length + 1)).sort()).toEqual(['lib/youtube/observatorio/sinais/gravador.ts', 'lib/youtube/observatorio/sinais/leitura.ts'])
    const g = readFileSync(join(SRC, 'lib/youtube/observatorio/sinais/gravador.ts'), 'utf8')
    for (const m of g.matchAll(/from\('niche_signals'\)\.select\('([^']*)'/g)) expect(m[1]).not.toMatch(/\bacao\b/)
  })
})
