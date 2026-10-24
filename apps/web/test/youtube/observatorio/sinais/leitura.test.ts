// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { listarSinaisDoNicho, dispensarSinal, adiarSinal, naoAdiado, contarSinaisAbertos, contarAbertosEntre, lerEstadoDaAba, LIMITE_PENDENTES } from '@/lib/youtube/observatorio/sinais/leitura'
import { textoDoVazio } from '@/lib/youtube/observatorio/sinais/frases'
import { fakeSb, type Consulta, type Resposta } from './fake-sb'

const SITE = '00000000-0000-4000-8000-000000000001'
const AGORA = new Date('2026-10-24T15:00:00Z')
const HORA = 3_600_000
const iso = (deltaH: number): string => new Date(AGORA.getTime() + deltaH * HORA).toISOString()
const EV = { outliers: [{ video_id: 'o1', canal_id: 'c1', published_at: iso(-48), mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: ['foto-antiga'] }

interface Mundo {
  sinais?: Array<Record<string, unknown>>
  /** linhas devolvidas à consulta das adiadas (.gt adiado_ate); `'erro'` = a consulta falha. */
  adiadas?: Array<{ adiado_ate: string; expires_at: string }> | 'erro'
  total?: number
  estado?: Record<string, unknown> | null
  respondidos?: number
  lugares?: Array<{ video_id: string; chaves: string[] }>
  lugaresDoSite?: boolean
  /** origens que têm linha em video_lugares no site (padrão: proprio e competidor). A sonda de existência só vê as que ela filtra. */
  origensNoSite?: string[]
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
    if (c.tabela === 'niche_signals' && c.filtros.some((f) => f.op === 'gt' && f.col === 'adiado_ate')) {
      return m.adiadas === 'erro' ? { data: null, error: { code: 'XX000', message: 'boom' } } : { data: m.adiadas ?? [] }
    }
    if (c.tabela === 'niche_signals') return { data: m.sinais ?? [], count: m.total ?? (m.sinais ?? []).length }
    if (c.tabela === 'niche_signals_estado') return { data: m.estado === undefined ? null : [m.estado] }
    if (c.tabela === 'video_lugares' && c.filtros.some((f) => f.op === 'overlaps')) return { data: m.lugares ?? [] }
    if (c.tabela === 'video_lugares') {
      const origens = m.origensNoSite ?? ['proprio', 'competidor']
      const f = c.filtros.find((x) => x.op === 'eq' && x.col === 'origem')
      const ha = m.lugaresDoSite === false ? false : f ? origens.includes(String(f.val)) : origens.length > 0
      return { data: ha ? [{ video_id: 'x' }] : [] }
    }
    if (c.tabela === 'youtube_videos') { const ids = c.filtros.find((x) => x.op === 'in')?.val as string[] | undefined; return { data: (m.videos ?? []).filter((v) => !ids || ids.includes(v.id)) } }
    if (c.tabela === 'yt_own_video_meta_daily') { const ids = c.filtros.find((x) => x.op === 'in')?.val as string[] | undefined; return { data: (m.metas ?? []).filter((x) => !ids || ids.includes(x.youtube_video_id)) } }
    return { data: [] }
  })
}
/** A consulta da lista (não a das adiadas, que filtra `gt adiado_ate`). */
const daLista = (c: Consulta): boolean => c.tabela === 'niche_signals' && !c.opcoes?.head && !c.filtros.some((f) => f.col === 'adiado_ate' && f.op === 'gt')
const estado = (extra: Record<string, unknown> = {}) => ({ computed_at: iso(-2), motivo_vazio: null, contagens: { canais_total: 5, outliers_total: 3 }, ...extra })
const meta = (yt: string, p = 'public') => ({ youtube_video_id: yt, privacy_status: p, day_pt: '2026-10-23' })

describe('listarSinaisDoNicho: o N e a lista', () => {
  it('N é o total (count exact), não o tamanho da página; a consulta filtra aberto e expires_at > agora, ordena por forca desc e first_seen_at', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], total: 73, estado: estado(), lugaresDoSite: true })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA, 1)
    expect(l.n).toBe(73)
    expect(l.itens).toHaveLength(1)
    const q = w.consultas.find(daLista)!
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

  it('catch-all com o cálculo velho (> 36 h): a frase não diz "nenhum grupo", diz que a leitura é antiga; com cálculo novo continua o genérico', async () => {
    const velho = await listarSinaisDoNicho(mundo({ estado: estado({ computed_at: iso(-40) }), respondidos: 0 }).sb, SITE, AGORA)
    expect(velho.desatualizado).toBe(true)
    expect(velho.motivoVazio).toBe('sem-grupo')
    expect(textoDoVazio(velho.motivoVazio!, velho.contagens, AGORA, true)).toMatch(/última leitura do nicho é antiga/)
    const novo = await listarSinaisDoNicho(mundo({ estado: estado(), respondidos: 0 }).sb, SITE, AGORA)
    expect(textoDoVazio(novo.motivoVazio!, novo.contagens, AGORA, true)).toMatch(/nenhum grupo forma um evento/)
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
    expect(w.consultas.find(daLista)!.filtros).toContainEqual({ op: 'gt', col: 'expires_at', val: AGORA.toISOString() })
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

  it('site só com linhas de origem competidor: proprios_agora é null (a sonda filtra origem = proprio; nunca vira "nenhum vídeo seu")', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado(), lugares: [], origensNoSite: ['competidor'] })
    const i = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!
    expect(i.proprios_agora).toBeNull()
    expect(i.proprios_agora_n).toBeNull()
    expect(i).toMatchObject({ acao: 'video_novo', rotulo_acao: 'generico', n_proprios: null })
    const sondas = w.consultas.filter((c) => c.tabela === 'video_lugares')
    expect(sondas).toHaveLength(2)
    for (const c of sondas) expect(c.filtros).toContainEqual({ op: 'eq', col: 'origem', val: 'proprio' })
  })

  it('site com linhas proprio mas nenhuma cobre o lugar: [] (medido, nenhum vídeo seu) e video_novo', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado(), lugares: [], origensNoSite: ['proprio'] })
    const i = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!
    expect(i.proprios_agora).toEqual([])
    expect(i).toMatchObject({ acao: 'video_novo', rotulo_acao: 'abrir-concorrente', n_proprios: 0, proprios_agora_n: 0 })
  })

  it('450 vídeos seus no lugar: proprios_agora tem 20 ids, proprios_agora_n 450, a ação usa o total e nenhum .in passa de 200 valores', async () => {
    const N = 450
    const ids = Array.from({ length: N }, (_, k) => `v${String(k).padStart(3, '0')}`)
    const w = mundo({
      sinais: [linha('a', 'pt')], estado: estado(), lugares: ids.map((id) => ({ video_id: id, chaves: ['pt'] })),
      videos: ids.map((id) => ({ id, youtube_video_id: `Y${id}` })), metas: ids.map((id) => meta(`Y${id}`)),
    })
    const i = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!
    expect(i.proprios_agora).toHaveLength(20)
    expect(i.proprios_agora).toEqual(ids.slice(0, 20))
    expect(i.proprios_agora_n).toBe(N)
    expect(i).toMatchObject({ acao: 'titulo_descricao', n_proprios: N })
    const ins = w.consultas.flatMap((c) => c.filtros.filter((f) => f.op === 'in' && (c.tabela === 'youtube_videos' || c.tabela === 'yt_own_video_meta_daily')))
    expect(ins.length).toBeGreaterThanOrEqual(6)
    for (const f of ins) expect((f.val as unknown[]).length).toBeLessThanOrEqual(200)
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

describe('listarSinaisDoNicho: parecido usa os próprios da evidência (DF6)', () => {
  const par = (id: string, proprios: string[]) => linha(id, `outlier:${id}`, { kind: 'parecido', evidence: { ...EV, proprios } })
  const um = { videos: [{ id: 'p1', youtube_video_id: 'YT1' }], metas: [meta('YT1')] }

  it('p1 público: proprios_agora [p1], abrir-seus, titulo_descricao', async () => {
    const w = mundo({ sinais: [par('a', ['p1'])], estado: estado(), lugares: [], ...um })
    const i = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens[0]!
    expect(i.proprios_agora).toEqual(['p1'])
    expect(i).toMatchObject({ proprios_agora_n: 1, rotulo_acao: 'abrir-seus', n_proprios: 1, acao: 'titulo_descricao' })
  })

  it('p1 privado ou oculto: [] e abrir-concorrente', async () => {
    const priv = mundo({ sinais: [par('a', ['p1'])], estado: estado(), videos: um.videos, metas: [meta('YT1', 'private')] })
    expect((await listarSinaisDoNicho(priv.sb, SITE, AGORA)).itens[0]).toMatchObject({ proprios_agora: [], rotulo_acao: 'abrir-concorrente', proprios_agora_n: 0 })
    const oculto = mundo({ sinais: [par('a', ['p1'])], estado: estado(), videos: [], metas: [meta('YT1')] })
    expect((await listarSinaisDoNicho(oculto.sb, SITE, AGORA)).itens[0]).toMatchObject({ proprios_agora: [], rotulo_acao: 'abrir-concorrente' })
  })

  it('site sem video_lugares próprio: destino null/generico, parecido com p1 público segue [p1]', async () => {
    const w = mundo({ sinais: [linha('d', 'pt'), par('a', ['p1'])], estado: estado(), lugares: [], lugaresDoSite: false, ...um })
    const [d, p] = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens
    expect(d).toMatchObject({ proprios_agora: null, rotulo_acao: 'generico' })
    expect(p).toMatchObject({ proprios_agora: ['p1'], rotulo_acao: 'abrir-seus' })
  })

  it('lista mista: filtrarPublicos roda uma vez (uma consulta a youtube_videos) e cada tipo recebe os seus', async () => {
    const w = mundo({
      sinais: [linha('d', 'pt'), par('a', ['p2'])], estado: estado(), lugares: [{ video_id: 'p1', chaves: ['pt'] }],
      videos: [{ id: 'p1', youtube_video_id: 'YT1' }, { id: 'p2', youtube_video_id: 'YT2' }], metas: [meta('YT1'), meta('YT2')],
    })
    const [d, p] = (await listarSinaisDoNicho(w.sb, SITE, AGORA)).itens
    expect(d!.proprios_agora).toEqual(['p1'])
    expect(p!.proprios_agora).toEqual(['p2'])
    expect(w.consultas.filter((c) => c.tabela === 'youtube_videos')).toHaveLength(1)
    const ov = w.consultas.find((c) => c.filtros.some((f) => f.op === 'overlaps'))!
    expect(ov.filtros).toContainEqual({ op: 'overlaps', col: 'chaves', val: ['pt'] })
  })
})

describe('contagens da aba', () => {
  it('contarSinaisAbertos: head + count exact, aberto e vigente; count nulo → null; erro lança', async () => {
    const w = fakeSb(() => ({ data: null, count: 7 }))
    expect(await contarSinaisAbertos(w.sb, SITE, AGORA)).toBe(7)
    const q = w.consultas[0]!
    expect(q.opcoes).toEqual({ count: 'exact', head: true })
    expect(q.filtros).toEqual(expect.arrayContaining([{ op: 'eq', col: 'site_id', val: SITE }, { op: 'eq', col: 'status', val: 'aberto' }, { op: 'gt', col: 'expires_at', val: AGORA.toISOString() }]))
    expect(await contarSinaisAbertos(fakeSb(() => ({ data: null, count: null })).sb, SITE, AGORA)).toBeNull()
    await expect(contarSinaisAbertos(fakeSb(() => ({ data: null, error: { message: 'segredo' } })).sb, SITE, AGORA)).rejects.toThrow(/sinais: leitura de/)
  })
  it('contarAbertosEntre: 450 ids com o 420º dispensado → soma de 3 consultas; só o site da guarda', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `s${i}`)
    const w = fakeSb((c) => {
      const lote = c.filtros.find((f) => f.op === 'in')!.val as string[]
      return { data: null, count: lote.filter((x) => x !== 's419').length }
    })
    expect(await contarAbertosEntre(w.sb, SITE, ids, AGORA)).toBe(449)
    expect(w.consultas).toHaveLength(3)
    for (const c of w.consultas) expect(c.filtros).toEqual(expect.arrayContaining([{ op: 'eq', col: 'site_id', val: SITE }, { op: 'eq', col: 'status', val: 'aberto' }, { op: 'gt', col: 'expires_at', val: AGORA.toISOString() }]))
  })
  it('contarAbertosEntre: ids de outro site não contam (o banco devolve 0), duplicados contam uma vez, 501 → null sem consulta, vazio → 0', async () => {
    const w = fakeSb(() => ({ data: null, count: 0 }))
    expect(await contarAbertosEntre(w.sb, SITE, ['alheio'], AGORA)).toBe(0)
    const w2 = fakeSb((c) => ({ data: null, count: (c.filtros.find((f) => f.op === 'in')!.val as string[]).length }))
    expect(await contarAbertosEntre(w2.sb, SITE, ['a', 'a', 'b'], AGORA)).toBe(2)
    const w3 = fakeSb(() => ({ data: null, count: 1 }))
    expect(LIMITE_PENDENTES).toBe(500)
    expect(await contarAbertosEntre(w3.sb, SITE, Array.from({ length: 501 }, (_, i) => `s${i}`), AGORA)).toBeNull()
    expect(w3.consultas).toHaveLength(0)
    expect(await contarAbertosEntre(w3.sb, SITE, [], AGORA)).toBe(0)
  })
  it('lerEstadoDaAba: sem linha, recente, velha (> 36 h) e erro (null)', async () => {
    expect(await lerEstadoDaAba(fakeSb(() => ({ data: null })).sb, SITE, AGORA)).toEqual({ calculado: false, velho: false, computado_em: null })
    expect(await lerEstadoDaAba(fakeSb(() => ({ data: [{ computed_at: iso(-2) }] })).sb, SITE, AGORA)).toEqual({ calculado: true, velho: false, computado_em: iso(-2) })
    expect((await lerEstadoDaAba(fakeSb(() => ({ data: [{ computed_at: iso(-37) }] })).sb, SITE, AGORA))?.velho).toBe(true)
    expect(await lerEstadoDaAba(fakeSb(() => ({ data: null, error: { message: 'x' } })).sb, SITE, AGORA)).toBeNull()
  })
})

describe('OBS_SINAIS_NICHO ausente', () => {
  const original = process.env.OBS_SINAIS_NICHO
  afterEach(() => { if (original === undefined) delete process.env.OBS_SINAIS_NICHO; else process.env.OBS_SINAIS_NICHO = original })
  it('sem a variável: calculoLigado false e, sem estado, "ainda não foi ligado"', async () => {
    delete process.env.OBS_SINAIS_NICHO
    const l = await listarSinaisDoNicho(mundo({ sinais: [], estado: null }).sb, SITE, AGORA)
    expect(l.calculoLigado).toBe(false)
    expect(l.motivoVazio).toBe('nunca-calculado')
    expect(textoDoVazio(l.motivoVazio!, l.contagens, AGORA, l.calculoLigado)).toMatch(/ainda não foi ligado/)
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

describe('F3b: adiadas na leitura', () => {
  const volta = (dias: number) => iso(24 * dias)
  it('naoAdiado: nulo ou já passado; a lista e as duas contagens usam o mesmo filtro', async () => {
    const f = { op: 'or', col: naoAdiado(AGORA.toISOString()), val: undefined }
    expect(naoAdiado('X')).toBe('adiado_ate.is.null,adiado_ate.lte.X')
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado() })
    await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(w.consultas.find(daLista)!.filtros).toContainEqual(f)
    const c = fakeSb(() => ({ data: null, count: 1 }))
    await contarSinaisAbertos(c.sb, SITE, AGORA)
    await contarAbertosEntre(c.sb, SITE, ['a'], AGORA)
    for (const q of c.consultas) expect(q.filtros).toContainEqual(f)
  })

  it('contagens.adiados conta só as que voltam antes de vencer; proximaVolta é a mais cedo delas (precedência: expira_antes não conta)', async () => {
    const w = mundo({
      sinais: [linha('a', 'pt')], estado: estado(),
      adiadas: [
        { adiado_ate: volta(2), expires_at: volta(10) },
        { adiado_ate: volta(5), expires_at: volta(3) }, // vence antes de voltar: não conta
        { adiado_ate: volta(4), expires_at: volta(9) },
      ],
    })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.contagens.adiados).toBe(2)
    expect(l.proximaVolta).toBe(volta(2))
    expect(l.motivoVazio).toBeNull()
    const q = w.consultas.find((c) => c.filtros.some((f) => f.col === 'adiado_ate' && f.op === 'gt'))!
    expect(q.filtros).toEqual(expect.arrayContaining([{ op: 'eq', col: 'status', val: 'aberto' }, { op: 'gt', col: 'expires_at', val: AGORA.toISOString() }, { op: 'gt', col: 'adiado_ate', val: AGORA.toISOString() }]))
  })

  it('lista vazia com adiadas que voltam: motivo adiado (P-C2), a razão do cálculo vira motivoDoCalculo', async () => {
    const w = mundo({ estado: estado({ motivo_vazio: 'sem-terceiro-outlier' }), adiadas: [{ adiado_ate: volta(3), expires_at: volta(20) }] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l).toMatchObject({ n: 0, motivoVazio: 'adiado', motivoDoCalculo: 'sem-terceiro-outlier', proximaVolta: volta(3) })
    expect(l.contagens.adiados).toBe(1)
  })

  it('lista vazia e nenhuma adiada volta (todas vencem antes): o motivo é o do cálculo, não "adiado"', async () => {
    const w = mundo({ estado: estado({ motivo_vazio: 'sem-lugar' }), adiadas: [{ adiado_ate: volta(5), expires_at: volta(2) }] })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.motivoVazio).toBe('sem-lugar')
    expect(l.contagens.adiados).toBe(0)
    expect(l.motivoDoCalculo).toBeNull()
  })

  it('o dado não existe: a consulta das adiadas falha → contagens.adiados AUSENTE (nunca 0); vazio vira adiado/não medido; lista com itens segue', async () => {
    const vazio = await listarSinaisDoNicho(mundo({ estado: estado({ motivo_vazio: 'sem-lugar' }), adiadas: 'erro' }).sb, SITE, AGORA)
    expect(vazio.motivoVazio).toBe('adiado')
    expect('adiados' in vazio.contagens).toBe(false)
    expect(vazio.motivoDoCalculo).toBe('sem-lugar')
    expect(vazio.proximaVolta).toBeNull()
    const cheia = await listarSinaisDoNicho(mundo({ sinais: [linha('a', 'pt')], estado: estado(), adiadas: 'erro' }).sb, SITE, AGORA)
    expect(cheia.n).toBe(1)
    expect('adiados' in cheia.contagens).toBe(false)
  })

  it('sem estado (nunca calculado) com adiadas ilegíveis continua nunca-calculado', async () => {
    const l = await listarSinaisDoNicho(mundo({ estado: null, adiadas: 'erro' }).sb, SITE, AGORA, 50, false)
    expect(l.motivoVazio).toBe('nunca-calculado')
  })

  it('uma chave "adiados" no estado do cálculo nunca vence a medida de agora', async () => {
    const w = mundo({ sinais: [linha('a', 'pt')], estado: estado({ contagens: { adiados: 99 } }), adiadas: [] })
    expect((await listarSinaisDoNicho(w.sb, SITE, AGORA)).contagens.adiados).toBe(0)
  })

  it('o item que voltou traz adiada_em (adiado_ate − 7 dias); o nunca adiado, null', async () => {
    const w = mundo({ sinais: [linha('a', 'pt', { adiado_ate: iso(-24) }), linha('b', 'br')], estado: estado() })
    const l = await listarSinaisDoNicho(w.sb, SITE, AGORA)
    expect(l.itens[0]!.adiada_em).toBe(iso(-24 - 24 * 7))
    expect(l.itens[1]!.adiada_em).toBeNull()
  })
})

describe('adiarSinal', () => {
  it('chama niche_signals_adiar com o site da guarda e devolve ok com a data, ou o motivo com os campos da função', async () => {
    const respostas = [
      { ok: true, adiado_ate: '2026-10-31T15:00:00Z' }, { ok: false, motivo: 'ja_adiado', adiado_ate: '2026-10-30T10:00:00Z' },
      { ok: false, motivo: 'expira_antes', expira_em: '2026-10-28T10:00:00Z' }, { ok: false, motivo: 'nao_aberto' }, null,
    ]
    const w = fakeSb(() => ({ data: respostas.shift() }))
    expect(await adiarSinal(w.sb, SITE, 'id1', 'user:u1')).toEqual({ ok: true, adiado_ate: '2026-10-31T15:00:00Z' })
    expect(await adiarSinal(w.sb, SITE, 'id1', 'user:u1')).toEqual({ ok: false, motivo: 'ja_adiado', adiado_ate: '2026-10-30T10:00:00Z' })
    expect(await adiarSinal(w.sb, SITE, 'id1', 'user:u1')).toEqual({ ok: false, motivo: 'expira_antes', expira_em: '2026-10-28T10:00:00Z' })
    expect(await adiarSinal(w.sb, SITE, 'id1', 'user:u1')).toEqual({ ok: false, motivo: 'nao_aberto' })
    expect(await adiarSinal(w.sb, SITE, 'id1', 'user:u1')).toEqual({ ok: false, motivo: 'falhou' })
    expect(w.rpc[0]).toEqual({ nome: 'niche_signals_adiar', args: { p_site: SITE, p_id: 'id1', p_por: 'user:u1' } })
  })
  it('erro do banco lança', async () => {
    await expect(adiarSinal(fakeSb(() => ({ data: null, error: { message: 'segredo' } })).sb, SITE, 'id1', 'user:u1')).rejects.toThrow(/sinais: leitura de/)
  })
})

describe('o leitor é único: só leitura.ts (e a F2b) toca niche_signals e a coluna acao', () => {
  const SRC = resolve(__dirname, '../../../../src')
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  it("só leitura.ts, o gravador e o outbox (avisos.ts) leem; gravador e outbox nunca selecionam `acao` ao fazer .from('niche_signals')", () => {
    const leem = arquivos(SRC).filter((f) => /from\(\s*['"]niche_signals['"]\s*\)/.test(readFileSync(f, 'utf8')))
    expect(leem.map((f) => f.slice(SRC.length + 1)).sort()).toEqual(['lib/youtube/observatorio/sinais/avisos.ts', 'lib/youtube/observatorio/sinais/gravador.ts', 'lib/youtube/observatorio/sinais/leitura.ts'])
    for (const arq of ['gravador.ts', 'avisos.ts']) {
      const g = readFileSync(join(SRC, 'lib/youtube/observatorio/sinais', arq), 'utf8')
      for (const m of g.matchAll(/from\('niche_signals'\)\.select\('([^']*)'/g)) expect(m[1]).not.toMatch(/\bacao\b/)
    }
  })
})
