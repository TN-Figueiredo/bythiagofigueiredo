// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { lerCandidatos, lerEscritas, lerLeiturasPaginadas } from '@/lib/youtube/teste-youtube/registro/ler'
import { FRESCOR_MAX_MS } from '@/lib/youtube/teste-youtube/registro/frescor'
import { criarBanco, type Linha } from './banco-falso'

const AGORA = Date.UTC(2026, 9, 18, 21, 40, 0)
const MIN = 60_000
const HORA = 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString()
const SITE = '00000000-0000-4000-8000-000000000001'
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const vid = (n: number): string => `00000000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`

interface Cfg {
  rodadasPorDia?: 1 | 4
  ultimaRodadaHaMin?: number | null
  saiuHaDias?: number
  semVideo?: boolean
  testeNosso?: boolean
  aberto?: { updatedAt?: string } | false
  fechado?: { encerradoHaMin: number }
  ultimas?: Partial<{ alguma: boolean; ultimaHaMin: number | null; okHaMin: number | null; erroHaMin: number | null; erro: string | null; erroId: number | null; id: number | null; semRodadaHaMin: number | null }>
}
function cenario(videos: Record<number, Cfg>, extra: { falhar?: Parameters<typeof criarBanco>[1] } = {}) {
  const alvos: Linha[] = []
  const youtubeVideos: Linha[] = []
  const abTests: Linha[] = []
  const nativos: Linha[] = []
  const ultimas = new Map<string, Linha>()
  for (const [k, c] of Object.entries(videos)) {
    const n = Number(k)
    alvos.push({
      id: n, site_id: SITE, youtube_video_id: yt(n), tipo: 'proprio', rodadas_por_dia: c.rodadasPorDia ?? 4,
      ultima_rodada_em: c.ultimaRodadaHaMin === undefined ? iso(AGORA - 30 * MIN) : c.ultimaRodadaHaMin === null ? null : iso(AGORA - c.ultimaRodadaHaMin * MIN),
      saiu_em: c.saiuHaDias === undefined ? null : iso(AGORA - c.saiuHaDias * 86_400_000), ativo_desde: iso(AGORA - 40 * 86_400_000),
    })
    if (!c.semVideo) youtubeVideos.push({ id: vid(n), site_id: SITE, youtube_video_id: yt(n) })
    if (c.testeNosso) abTests.push({ id: `t${n}`, youtube_video_id: vid(n), status: 'running', created_at: iso(AGORA - HORA), updated_at: iso(AGORA - HORA) })
    if (c.aberto !== undefined && c.aberto !== false) {
      nativos.push({
        id: `r${n}`, site_id: SITE, video_id: vid(n), youtube_video_id: yt(n), estado: 'em_andamento', origem: 'detectado', campos: ['titulo'],
        variantes_titulo: ['A', 'B'], votos_titulo: { '0': 3, '1': 3 }, primeira_vista: iso(AGORA - 5 * HORA), ultima_vista: iso(AGORA - HORA),
        veredito: null, evidencia: [], desfecho_estado: null, desfecho_motivo: null, encerrado_em: null, descartado_em: null,
        created_at: iso(AGORA - 5 * HORA), updated_at: c.aberto.updatedAt ?? '2026-10-18T21:45:37.471588+00:00',
      })
    }
    if (c.fechado) {
      nativos.push({ id: `f${n}`, site_id: SITE, video_id: vid(n), youtube_video_id: yt(n), estado: 'encerrado', encerrado_em: iso(AGORA - c.fechado.encerradoHaMin * MIN), descartado_em: null, created_at: iso(AGORA - 9 * HORA) })
    }
    const u = c.ultimas ?? {}
    const t = (m: number | null | undefined): string | null => (m === null || m === undefined ? null : iso(AGORA - m * MIN))
    ultimas.set(vid(n), {
      video_id: vid(n), alguma: u.alguma ?? true, ultima_em: t(u.ultimaHaMin === undefined ? 20 : u.ultimaHaMin), ultima_ok_em: t(u.okHaMin === undefined ? 20 : u.okHaMin),
      ultimo_erro_em: t(u.erroHaMin), ultimo_erro: u.erro ?? null, ultimo_erro_id: u.erroId ?? null, ultima_id: u.id ?? 1, ultimo_sem_rodada_em: t(u.semRodadaHaMin),
    })
  }
  const b = criarBanco(
    { yt_watch_alvos: alvos, youtube_videos: youtubeVideos, ab_tests: abTests, ab_native_tests: nativos },
    {
      ...(extra.falhar ?? {}),
      rpcs: { ab_native_ultimas: a => ({ data: (a.p_videos as string[]).map(v => ultimas.get(v) ?? { video_id: v, alguma: false, ultima_em: null, ultima_ok_em: null, ultimo_erro_em: null, ultimo_erro: null, ultimo_erro_id: null, ultima_id: null, ultimo_sem_rodada_em: null }), error: null }) },
    },
  )
  return b
}
const devidosDe = async (b: ReturnType<typeof cenario>) => {
  const r = await lerCandidatos(b.sb, AGORA)
  if (!('valor' in r)) throw new Error('falhou: ' + r.porque)
  return r.valor
}

describe('prioridade (§1 item 3)', () => {
  it('T19 (teste nosso) primeiro, reproduções por último; com 300 antigos simulados o T19 segue o 1º', async () => {
    const cfg: Record<number, Cfg> = { 1: { testeNosso: true, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 60 } } }
    for (let i = 2; i <= 13; i++) cfg[i] = { ultimaRodadaHaMin: 5 + i, ultimas: { okHaMin: 120 } }
    for (let i = 14; i <= 16; i++) cfg[i] = { saiuHaDias: 3, ultimas: { alguma: false } }
    for (let i = 100; i < 400; i++) cfg[i] = { rodadasPorDia: 1, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 600 } }
    const r = await devidosDe(cenario(cfg))
    expect(r.devidos[0]!.ytId).toBe(yt(1))
    expect(r.devidos[0]!.prioridade).toBe(1)
    expect(r.devidos.slice(-3).every(d => d.motivo === 'reproduzir' && d.prioridade === 5)).toBe(true)
    expect(r.antigosFora).toBe(300)
    expect(r.total).toBe(316)
    expect(r.devidos.some(d => d.prioridade === 3)).toBe(true)
  })
  it('empate de prioridade: rodada mais antiga primeiro, depois ytId', async () => {
    const r = await devidosDe(cenario({ 3: { ultimaRodadaHaMin: 10, ultimas: { okHaMin: 90 } }, 2: { ultimaRodadaHaMin: 10, ultimas: { okHaMin: 90 } }, 4: { ultimaRodadaHaMin: 50, ultimas: { okHaMin: 90 } } }))
    expect(r.devidos.map(d => d.ytId)).toEqual([yt(4), yt(2), yt(3)])
  })
  it('registro aberto (nível 2) vem antes do alvo comum (nível 3) e depois do teste nosso', async () => {
    const r = await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } }, 2: { aberto: {}, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } }, 3: { testeNosso: true, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } } }))
    expect(r.devidos.map(d => d.prioridade)).toEqual([1, 2, 3])
    expect(r.devidos.map(d => d.ytId)).toEqual([yt(3), yt(2), yt(1)])
  })
  it('primeira avaliação de vídeo novo (alvo ativo, sem avaliação) é prioridade 3, não 5', async () => {
    const r = await devidosDe(cenario({ 1: { ultimas: { alguma: false, ultimaHaMin: null, okHaMin: null, id: null } } }))
    expect(r.devidos[0]).toMatchObject({ motivo: 'reproduzir', prioridade: 3 })
  })
})

describe('alvos', () => {
  it('alvo sem youtube_videos conta em semVideo e fica fora de devidos', async () => {
    const r = await devidosDe(cenario({ 1: { semVideo: true }, 2: { ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } } }))
    expect(r.semVideo).toBe(1)
    expect(r.devidos.map(d => d.ytId)).toEqual([yt(2)])
  })
  it('alvo rodadas_por_dia 1 sem teste nosso nem registro aberto: fora e contado; com teste nosso entra', async () => {
    const r = await devidosDe(cenario({
      1: { rodadasPorDia: 1, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } },
      2: { rodadasPorDia: 1, testeNosso: true, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } },
      3: { rodadasPorDia: 1, aberto: {}, ultimaRodadaHaMin: 5, ultimas: { okHaMin: 90 } },
    }))
    expect(r.antigosFora).toBe(1)
    expect(r.devidos.map(d => d.ytId).sort()).toEqual([yt(2), yt(3)])
  })
  it('alvo saído há mais de 30 dias não é lido (o filtro do banco o exclui)', async () => {
    const b = cenario({ 1: { saiuHaDias: 40, ultimas: { alguma: false } }, 2: { saiuHaDias: 10, ultimas: { alguma: false } } })
    const r = await devidosDe(b)
    expect(r.total).toBe(1)
    expect(r.devidos.map(d => d.ytId)).toEqual([yt(2)])
  })
})

describe('devido (§5.2)', () => {
  it('erro há 40 min não é devido; há 56 min é', async () => {
    const quarenta = await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 5, ultimas: { alguma: false, okHaMin: null, erroHaMin: 40, erro: 'banco', erroId: 7, id: 7 } } }))
    expect(quarenta.devidos).toEqual([])
    const cinquentaSeis = await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 5, ultimas: { alguma: false, okHaMin: null, erroHaMin: 56, erro: 'banco', erroId: 7, id: 7 } } }))
    expect(cinquentaSeis.devidos).toHaveLength(1)
  })
  it('sem_rodada_nova: ultimaRodada há 9 h e ultimoSemRodada há 3 h não é devido; há 7 h é', async () => {
    const base = { ultimaRodadaHaMin: 9 * 60, ultimas: { okHaMin: 20 } }
    expect((await devidosDe(cenario({ 1: { ...base, ultimas: { ...base.ultimas, semRodadaHaMin: 3 * 60 } } }))).devidos).toEqual([])
    const r = await devidosDe(cenario({ 1: { ...base, ultimas: { ...base.ultimas, semRodadaHaMin: 7 * 60 } } }))
    expect(r.devidos[0]).toMatchObject({ motivo: 'sem_rodada_nova', prioridade: 4 })
    const nulo = await devidosDe(cenario({ 1: base }))
    expect(nulo.devidos[0]!.motivo).toBe('sem_rodada_nova')
  })
  it('sem_rodada_nova só passa do FRESCOR_MAX_MS (8 h 40): 8 h não é; 8 h 41 é', async () => {
    expect(FRESCOR_MAX_MS).toBe(8 * HORA + 40 * MIN)
    const o = (m: number): Cfg => ({ ultimaRodadaHaMin: m, ultimas: { okHaMin: 20 } })
    expect((await devidosDe(cenario({ 1: o(8 * 60) }))).devidos).toEqual([])
    expect((await devidosDe(cenario({ 1: o(8 * 60 + 41) }))).devidos).toHaveLength(1)
  })
  it('registro aberto de alvo saído, última avaliação há 25 h: devido registro_aberto', async () => {
    const r = await devidosDe(cenario({ 1: { saiuHaDias: 5, aberto: {}, ultimaRodadaHaMin: 30 * 60, ultimas: { ultimaHaMin: 25 * 60, okHaMin: 25 * 60 } } }))
    expect(r.devidos[0]).toMatchObject({ motivo: 'registro_aberto', prioridade: 2 })
    const novo = await devidosDe(cenario({ 1: { saiuHaDias: 5, aberto: {}, ultimaRodadaHaMin: 30 * 60, ultimas: { ultimaHaMin: 23 * 60, okHaMin: 23 * 60 } } }))
    expect(novo.devidos).toEqual([])
  })
  it('registro aberto sem alvo na coleta (alvo saído há mais de 30 dias) continua candidato', async () => {
    const b = cenario({ 1: { saiuHaDias: 40, aberto: {}, ultimas: { ultimaHaMin: 25 * 60, okHaMin: 25 * 60 } } })
    const r = await devidosDe(b)
    expect(r.devidos.map(d => d.ytId)).toEqual([yt(1)])
    expect(r.devidos[0]!.motivo).toBe('registro_aberto')
  })
  it('rodada gravada no mesmo disparo é devida; rodada partida (ultima_rodada_em não atualizado) não; igual a ultimaOkEm não', async () => {
    expect((await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 1, ultimas: { okHaMin: 20 } } }))).devidos[0]!.motivo).toBe('rodada_nova')
    expect((await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 30, ultimas: { okHaMin: 20 } } }))).devidos).toEqual([])
    expect((await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 20, ultimas: { okHaMin: 20 } } }))).devidos).toEqual([])
  })
  it('fechamentos chegam ao candidato', async () => {
    const r = await devidosDe(cenario({ 1: { ultimaRodadaHaMin: 1, ultimas: { okHaMin: 20 }, fechado: { encerradoHaMin: 300 } } }))
    expect(r.devidos[0]!.fechamentos).toEqual({ encerradoEm: iso(AGORA - 300 * MIN), descartadoEm: null })
  })
})

describe('CAS (Phil P5): updatedAt é texto cru', () => {
  it('RegistroAberto.updatedAt sai byte a byte igual ao texto do banco', async () => {
    const r = await devidosDe(cenario({ 1: { aberto: { updatedAt: '2026-10-18T21:45:37.471588+00:00' }, ultimaRodadaHaMin: 1, ultimas: { okHaMin: 20 } } }))
    expect(r.devidos[0]!.aberto!.updatedAt).toBe('2026-10-18T21:45:37.471588+00:00')
    expect(r.devidos[0]!.aberto!.id).toBe('r1')
  })
})

describe('falhas da lista (dado ausente nunca vira lista vazia)', () => {
  it('erro do banco na tabela de alvos vira porque/causa, nunca lista vazia', async () => {
    const b = cenario({ 1: {} }, { falhar: { falhar: p => (p.tabela === 'yt_watch_alvos' ? { code: '42P01' } : null) } })
    const r = await lerCandidatos(b.sb, AGORA)
    expect('valor' in r).toBe(false)
    if (!('valor' in r)) expect(r.causa).toBe('erro_do_banco')
  })
  it('erro no rpc ab_native_ultimas também falha a lista', async () => {
    const b = criarBanco({ yt_watch_alvos: [{ id: 1, site_id: SITE, youtube_video_id: yt(1), tipo: 'proprio', rodadas_por_dia: 4, ultima_rodada_em: null, saiu_em: null, ativo_desde: iso(AGORA) }], youtube_videos: [{ id: vid(1), site_id: SITE, youtube_video_id: yt(1) }] },
      { rpcs: { ab_native_ultimas: () => ({ data: null, error: { code: 'XX000' } }) } })
    const r = await lerCandidatos(b.sb, AGORA)
    expect('valor' in r).toBe(false)
  })
  it('zero alvos devolve total 0 (não é falha)', async () => {
    const r = await devidosDe(cenario({}))
    expect(r).toEqual({ devidos: [], semVideo: 0, antigosFora: 0, total: 0, candidatosTotal: 0 })
  })
})

function linhaLeitura(i: number, lidaMs: number): Linha {
  return {
    site_id: SITE, youtube_video_id: yt(1), lida_em: iso(lidaMs), rodada_id: '00000000-0000-4000-8000-000000000001', origem_rede: 'vercel', versao_leitor: 1,
    http: 200, erro: null, idioma: 'pt-BR', titulo_oficial: null, titulo_oficial_fonte: null, titulo_exibido: 'T', renderers_presentes: 7, titulos_divergentes: null,
    rendicoes_sqp: null, jogador_bloqueado: false, miniatura_id: null, id: i,
  }
}

describe('lerLeiturasPaginadas (C-3)', () => {
  const T0 = iso(AGORA)
  const desde = AGORA - 14 * 86_400_000
  const leituras = (n: number, base = AGORA - 3_000_000): Linha[] => Array.from({ length: n }, (_, i) => linhaLeitura(i, base + i * 1000))
  const valor = (r: Awaited<ReturnType<typeof lerLeiturasPaginadas>>) => { if (!('valor' in r)) throw new Error(r.porque); return r.valor }

  it('1.000 + 300: 1.300 lidas, em duas páginas, com count exato na primeira', async () => {
    const b = criarBanco({ yt_watch_readings: leituras(1300), yt_watch_thumbs: [] })
    const v = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    expect(v.leituras).toHaveLength(1300)
    const ps = b.pedidos.filter(p => p.tabela === 'yt_watch_readings')
    expect(ps.map(p => p.faixa)).toEqual([[0, 999], [1000, 1999]])
    expect(ps[0]!.count).toBe(true)
    expect(ps[1]!.count).toBe(false)
  })
  it('soma diferente do count (1.301 declarado) vira paginacao/forma_invalida', async () => {
    const b = criarBanco({ yt_watch_readings: leituras(1300) }, { falhar: undefined })
    const orig = b.tabelas.yt_watch_readings!
    // o falso responde count do filtro; para forçar divergência, uma linha é inserida entre as páginas com lida_em <= t0
    let chamadas = 0
    const sb = {
      from: (t: string) => {
        const q = (b.sb as { from: (t: string) => Record<string, unknown> }).from(t)
        if (t !== 'yt_watch_readings') return q
        const then = q.then as (ok: (r: unknown) => unknown, err: (e: unknown) => unknown) => unknown
        q.then = (ok: (r: { count?: number | null }) => unknown, err: (e: unknown) => unknown) => then.call(q, (r: { count?: number | null }) => { chamadas++; return ok(r.count != null ? { ...r, count: r.count + 1 } : r) }, err)
        return q
      },
    } as never
    const r = await lerLeiturasPaginadas(sb, yt(1), SITE, desde, T0)
    expect(orig).toHaveLength(1300)
    expect(chamadas).toBeGreaterThan(0)
    expect(r).toMatchObject({ porque: expect.any(String), causa: 'forma_invalida' })
  })
  it('3 linhas inseridas entre as páginas com lida_em > t0 não entram nem quebram a soma', async () => {
    const base = leituras(1300)
    const b = criarBanco({ yt_watch_readings: base })
    const semDepois = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    b.tabelas.yt_watch_readings!.push(linhaLeitura(5000, AGORA + 1000), linhaLeitura(5001, AGORA + 2000), linhaLeitura(5002, AGORA + 3000))
    const comDepois = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    expect(comDepois.leituras).toHaveLength(1300)
    expect(comDepois.leituras.map(l => l.lidaEm)).toEqual(semDepois.leituras.map(l => l.lidaEm))
  })
  it('empate de lida_em na fronteira da página: nenhuma repetida nem pulada (ordem lida_em, id)', async () => {
    const mesma = AGORA - 3_000_000
    const linhas = Array.from({ length: 1005 }, (_, i) => linhaLeitura(i + 1, mesma + (i < 995 ? 0 : i * 1000)))
    const b = criarBanco({ yt_watch_readings: linhas })
    const ordem = b.tabelas.yt_watch_readings!.map(l => l.id as number)
    const v = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    expect(v.leituras).toHaveLength(1005)
    const ps = b.pedidos.filter(p => p.tabela === 'yt_watch_readings').map(p => p.filtros.join('|'))
    expect(ordem).toHaveLength(1005)
    expect(ps[0]).toContain('lte:lida_em')
  })
  it('erro do banco ou resposta torta vira falha, nunca lista vazia', async () => {
    const b = criarBanco({ yt_watch_readings: [] }, { falhar: p => (p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    expect('porque' in (await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))).toBe(true)
  })
  it('linha que a regra recusa conta em invalidas e segue', async () => {
    const ruim = { ...linhaLeitura(1, AGORA - 1000), erro: 'ERRO MAIUSCULO' }
    const b = criarBanco({ yt_watch_readings: [ruim, linhaLeitura(2, AGORA - 2000)] })
    const v = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    expect(v.leituras).toHaveLength(1)
    expect(v.invalidas).toBe(1)
  })
  it('miniaturas lidas por id, em lotes de 500', async () => {
    const linhas = Array.from({ length: 600 }, (_, i) => ({ ...linhaLeitura(i + 1, AGORA - 600_000 + i * 100), miniatura_id: i + 1 }))
    const thumbs = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, site_id: SITE, youtube_video_id: yt(1), host: 'i.ytimg.com', variante: 'hqdefault', http: 200, etag: null, sha16: null, dhash: null, largura: null, altura: null }))
    const b = criarBanco({ yt_watch_readings: linhas, yt_watch_thumbs: thumbs })
    const v = valor(await lerLeiturasPaginadas(b.sb, yt(1), SITE, desde, T0))
    expect(v.leituras).toHaveLength(600)
    expect(b.pedidos.filter(p => p.tabela === 'yt_watch_thumbs')).toHaveLength(2)
  })
})

describe('lerEscritas', () => {
  const janela = { deMs: AGORA - 10 * HORA, ateMs: AGORA }
  const tabelas = () => ({
    ab_tests: [
      { id: 'a', youtube_video_id: vid(1), test_type: 'title', winner_applied_at: iso(AGORA - 3 * HORA) },
      { id: 'b', youtube_video_id: vid(2), test_type: 'title', winner_applied_at: iso(AGORA - 2 * HORA) },
    ],
    ab_test_cycles: [
      { test_id: 'a', started_at: iso(AGORA - 40 * HORA), ended_at: iso(AGORA - 5 * HORA), end_reason: 'manual' },
      { test_id: 'a', started_at: iso(AGORA - 50 * HORA), ended_at: iso(AGORA - 45 * HORA), end_reason: 'manual' },
      { test_id: 'b', started_at: iso(AGORA - 4 * HORA), ended_at: null, end_reason: null },
    ],
    ab_test_restores: [
      { test_id: 'a', campo: 'title', escreveu: true, em: iso(AGORA - HORA) },
      { test_id: 'b', campo: 'title', escreveu: true, em: iso(AGORA - HORA) },
      { test_id: 'a', campo: 'title', escreveu: true, em: iso(AGORA - 90 * HORA) },
    ],
  })
  it('lê só os testes do vídeo pedido; ciclo só com ended_at na janela também entra; restauração fora da janela não', async () => {
    const b = criarBanco(tabelas())
    const r = await lerEscritas(b.sb, vid(1), janela)
    if (!('valor' in r)) throw new Error(r.porque)
    expect(r.valor.testes.map(t => t.id)).toEqual(['a'])
    expect(r.valor.ciclos).toHaveLength(1)
    expect(r.valor.ciclos[0]).toMatchObject({ test_id: 'a', end_reason: 'manual' })
    expect(r.valor.restauracoes).toHaveLength(1)
    expect(r.valor.restauracoes[0]!.test_id).toBe('a')
    const filtros = b.pedidos.filter(p => p.tabela === 'ab_test_cycles').flatMap(p => p.filtros)
    expect(filtros.some(f => f.startsWith('or:'))).toBe(true)
  })
  it('vídeo sem teste: três listas vazias sem consultar ciclos', async () => {
    const b = criarBanco(tabelas())
    const r = await lerEscritas(b.sb, vid(9), janela)
    expect(r).toEqual({ valor: { testes: [], ciclos: [], restauracoes: [] } })
    expect(b.pedidos.some(p => p.tabela === 'ab_test_cycles')).toBe(false)
  })
  it('erro do banco vira falha', async () => {
    const b = criarBanco(tabelas(), { falhar: p => (p.tabela === 'ab_test_restores' ? { code: 'XX000' } : null) })
    expect('porque' in (await lerEscritas(b.sb, vid(1), janela))).toBe(true)
  })
})
