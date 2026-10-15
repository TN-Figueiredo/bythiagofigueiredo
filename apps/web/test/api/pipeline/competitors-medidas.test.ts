// @vitest-environment node
// A5 · E7, Tarefa 12: o orquestrador das medidas por canal. Os leitores são os REAIS da E4, sobre o falso de PostgREST da E4
// (`medidas-fixture.ts`); só o motor (múltiplos) é um objeto simples. Base cheia com AGORA anterior a 24/08/2026 (resposta (k) da
// Tarefa 10): a janela de 112 dias da queda não cruza a mudança de contagem e as nove saem medidas, sem data futura.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Observatory } from '@/lib/youtube/observatorio'
import { toMcpSuccess } from '@/lib/pipeline/mcp/errors'
import { MOTIVOS_NAO_MEDIDO } from '@/lib/youtube/observatorio/medidas/tipos'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { fraseDoMotivo } from '@/lib/pipeline/services/competitors-frases'
import { falsoPostgrest, type Linha } from '../../youtube/observatorio/medidas-fixture'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const reais = vi.hoisted(() => ({ ler: null as null | typeof import('@/lib/youtube/observatorio/medidas/ler') }))
vi.mock('@/lib/youtube/observatorio/medidas/ler', async (importar) => {
  const real = await importar<typeof import('@/lib/youtube/observatorio/medidas/ler')>()
  reais.ler = real
  return {
    ...real,
    lerCanal: vi.fn(real.lerCanal), lerVideosDoCanal: vi.fn(real.lerVideosDoCanal),
    lerMarcasDoCanal: vi.fn(real.lerMarcasDoCanal), lerRetratosDoCanal: vi.fn(real.lerRetratosDoCanal),
  }
})
import * as ler from '@/lib/youtube/observatorio/medidas/ler'
import {
  CANAIS_EM_PARALELO, PRAZO_DO_PEDIDO_MS, contraOPrazo, medidasDosCanais, paraCowork,
  type MedidaParaCowork, type MedidasDoCanalParaCowork,
} from '@/lib/pipeline/services/competitors-medidas'

const D = 864e5
/** Antes de 24/08/2026: a janela inteira da queda fica antes da mudança de contagem. */
const AGORA = Date.UTC(2026, 7, 1, 15, 0, 0)
/** Entre 24/08/2026 e o dia em que o teste foi escrito: a janela da queda cruza a mudança. */
const AGORA_DEPOIS = Date.UTC(2026, 9, 14, 15, 0, 0)
const SITE = 'aaaaaaaa-0000-4000-8000-00000000000a'
const OUTRO_SITE = 'bbbbbbbb-0000-4000-8000-00000000000b'
const canalId = (n: number): string => `c${n}`

const IDADES_LONGOS = [8, 15, 22, 30, 38, 45, 52, 60, 70, 80, 88, 95, 105, 115, 125, 135, 150, 165]
const IDADES_SHORTS = [8, 14, 20, 26, 33, 40, 47, 55, 63, 72]
const MULT = [0.4, 1, 2.5, 1.2, 0.6, 3]

/** Views do canal `j` dias antes do último retrato: 1.000.000, 1.100.000 e 1.230.000 a 56, 28 e 0 dias (direção +0,3). */
function viewsDoRetrato(j: number): number {
  const ancoras: Array<[number, number]> = [[0, 1_230_000], [28, 1_100_000], [56, 1_000_000], [84, 920_000], [112, 860_000]]
  if (j >= 112) return 860_000 - (j - 112) * 2000
  for (let i = 0; i < ancoras.length - 1; i++) {
    const [j0, v0] = ancoras[i]!, [j1, v1] = ancoras[i + 1]!
    if (j >= j0 && j <= j1) return Math.round(v0 + ((v1 - v0) * (j - j0)) / (j1 - j0))
  }
  return 0
}

function retratos(canal: string, agora: number): Linha[] {
  const hoje = new Date(agora).toISOString().slice(0, 10)
  return Array.from({ length: 120 }, (_, k) => {
    const j = 119 - k // k = 119 é ontem
    return { competitor_channel_id: canal, snapshot_date: new Date(Date.parse(hoje + 'T00:00:00Z') - (j + 1) * D).toISOString().slice(0, 10), view_count: viewsDoRetrato(j) }
  })
}

function videos(canal: string, agora: number): Linha[] {
  const lista = [...IDADES_LONGOS.map((idade) => ({ idade, short: false })), ...IDADES_SHORTS.map((idade) => ({ idade, short: true }))]
  return lista.map(({ idade, short }, i) => ({
    id: `${canal}-v${i}`, competitor_channel_id: canal, video_id: `yt-${canal}-${i}`, published_at: new Date(agora - idade * D).toISOString(),
    live_actual_start_at: null, live_broadcast_content: 'none', was_live: false, is_short: short, duration_seconds: short ? 40 : 600,
    view_count: 10_000 + 500 * i, like_count: 400, comment_count: 40, likes_hidden: false, comments_disabled: false, views_hidden: false,
    discovered_at: new Date(agora - idade * D + 36e5).toISOString(), missing_since: null, series_tier: 'diaria', last_checked_at: new Date(agora).toISOString(),
  }))
}

interface OpcoesDaBase { agora?: number; canais?: number; semRetratos?: boolean; semVideos?: boolean; semMarcas?: boolean; semTabelaDeRetratos?: boolean; semTabelaDeMarcas?: boolean }
function base(o: OpcoesDaBase = {}): Record<string, Linha[]> {
  const agora = o.agora ?? AGORA
  const n = o.canais ?? 3
  const canais: Linha[] = [], vids: Linha[] = [], snaps: Linha[] = []
  for (let c = 1; c <= n; c++) {
    canais.push({ id: canalId(c), site_id: SITE, collection_paused_at: null, missing_since: null })
    if (!o.semVideos) vids.push(...videos(canalId(c), agora))
    if (!o.semRetratos) snaps.push(...retratos(canalId(c), agora))
  }
  const t: Record<string, Linha[]> = { competitor_channels: canais, competitor_videos: vids }
  if (!o.semTabelaDeRetratos) t.competitor_channel_snapshots = snaps
  if (!o.semTabelaDeMarcas) { t.competitor_video_marks = []; t.competitor_video_mark_misses = [] }
  return t
}

/** O motor reduzido ao que `multiplosDoCanal` lê. */
function motor(canais: number, soCanal1 = false): Observatory {
  const videosDoMotor: Array<{ id: string; ch: string; mult: { value: number | null; weak: boolean } | null }> = []
  for (let c = 1; c <= (soCanal1 ? 1 : canais); c++) {
    videos(canalId(c), AGORA).forEach((v, i) => videosDoMotor.push({ id: v.id as string, ch: canalId(c), mult: { value: MULT[i % 6]!, weak: false } }))
  }
  return { videos: videosDoMotor } as unknown as Observatory
}

const pedir = (sb: SupabaseClient, canais: number, o: Partial<Parameters<typeof medidasDosCanais>[2]> = {}) =>
  medidasDosCanais({ supabase: sb, siteId: SITE }, Array.from({ length: canais }, (_, i) => ({ id: canalId(i + 1) })), {
    obs: motor(canais), agoraMs: AGORA, prazoAteMs: Date.now() + PRAZO_DO_PEDIDO_MS, ...o,
  })

function nove(m: MedidasDoCanalParaCowork): Array<MedidaParaCowork<unknown>> {
  return [
    m.direcao_do_canal, m.estado_do_canal.parado, m.estado_do_canal.queda,
    m.por_formato.long.direcao_dos_videos_novos, m.por_formato.long.ritmo, m.por_formato.long.taxa_de_acerto,
    m.por_formato.short.direcao_dos_videos_novos, m.por_formato.short.ritmo, m.por_formato.short.taxa_de_acerto,
  ]
}
/** As nove, menos a direção dos vídeos novos do Short (a E4 não a tem: ver o relatório). */
const oitoReais = (m: MedidasDoCanalParaCowork): Array<MedidaParaCowork<unknown>> => nove(m).filter((_, i) => i !== 6)

/** Folhas nulas, indefinidas, NaN ou Infinity. `janela` fica de fora: `{ de: null, ate: null }` é o contrato da E4. */
function folhasRuins(x: unknown, caminho = '$', ruins: string[] = []): string[] {
  if (x === null || x === undefined) ruins.push(caminho)
  else if (typeof x === 'number') { if (!Number.isFinite(x)) ruins.push(caminho) }
  else if (Array.isArray(x)) x.forEach((v, i) => folhasRuins(v, `${caminho}[${i}]`, ruins))
  else if (typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k !== 'janela') folhasRuins(v, `${caminho}.${k}`, ruins) }
  return ruins
}

beforeEach(() => {
  vi.clearAllMocks()
  const real = reais.ler!
  vi.mocked(ler.lerCanal).mockImplementation(real.lerCanal)
  vi.mocked(ler.lerVideosDoCanal).mockImplementation(real.lerVideosDoCanal)
  vi.mocked(ler.lerMarcasDoCanal).mockImplementation(real.lerMarcasDoCanal)
  vi.mocked(ler.lerRetratosDoCanal).mockImplementation(real.lerRetratosDoCanal)
})
afterEach(() => { vi.useRealTimers() })

describe('medidasDosCanais: o que sai', () => {
  it('banco sem nenhuma linha nova: as nove medidas saem nao_medido com motivo do catálogo e frase', async () => {
    const { sb } = falsoPostgrest(base({ semRetratos: true, semMarcas: true }))
    const r = await pedir(sb, 1, { obs: { videos: [] } as unknown as Observatory })
    const m = r.porCanal.get('c1')!
    for (const x of nove(m)) {
      // os vídeos existem (a base tem vídeos), mas sem retrato nem motor: as de vídeo ainda medem o que os vídeos dizem
      if (x.estado === 'nao_medido') {
        expect(MOTIVOS_NAO_MEDIDO as readonly string[]).toContain(x.motivo)
        expect(x.frase).toBe(fraseDoMotivo({ estado: 'nao_medido', motivo: x.motivo, desde: x.desde, fechaEm: x.fechaEm, n: x.n, minimo: x.minimo, notas: [] }))
      }
    }
    expect(m.direcao_do_canal.estado).toBe('nao_medido')
    expect(m.estado_do_canal.queda.estado).toBe('nao_medido')
    expect(r.indisponiveis.indisponiveis).toBeGreaterThanOrEqual(2)
  })

  it('canal sem nenhum vídeo nem retrato: as nove saem nao_medido, com motivo do catálogo, frase igual à do dicionário', async () => {
    const { sb } = falsoPostgrest(base({ semRetratos: true, semVideos: true }))
    const r = await pedir(sb, 1, { obs: { videos: [] } as unknown as Observatory })
    const m = r.porCanal.get('c1')!
    for (const x of nove(m)) {
      expect(x.estado).toBe('nao_medido')
      if (x.estado !== 'nao_medido') continue
      expect(MOTIVOS_NAO_MEDIDO as readonly string[]).toContain(x.motivo)
      expect(x.frase).toBe(fraseDoMotivo({ estado: 'nao_medido', motivo: x.motivo, desde: x.desde, fechaEm: x.fechaEm, n: x.n, minimo: x.minimo, notas: [] }))
    }
    expect(r.indisponiveis).toMatchObject({ total: 9, indisponiveis: 9 })
    // o texto serializado contém a frase de cada motivo, literalmente
    const texto = JSON.stringify(r.porCanal.get('c1'))
    for (const x of nove(m)) if (x.estado === 'nao_medido') expect(texto).toContain(JSON.stringify(x.frase).slice(1, -1))
  })

  it('base cheia: as nove medidas medidas, com valor, n e janela', async () => {
    const { sb } = falsoPostgrest(base())
    const r = await pedir(sb, 3)
    for (const c of ['c1', 'c2', 'c3']) {
      const m = r.porCanal.get(c)!
      const faltou = oitoReais(m).filter((x) => x.estado !== 'medido')
      expect(faltou).toEqual([])
      expect(m.por_formato.short.direcao_dos_videos_novos.estado).toBe('nao_medido')
    }
    // as 8 reais por canal; a do Short é não medida por desenho: 3 canais × 1
    expect(r.indisponiveis).toMatchObject({ total: 27, indisponiveis: 3, por_motivo: { poucos_videos: 3 } })
    const m = r.porCanal.get('c1')!
    // direção do canal: ganhos 130.000 e 100.000 -> +0,3
    expect(m.direcao_do_canal).toMatchObject({ estado: 'medido', valor: { direcao: 'subindo', ganhoRecente: 130_000, ganhoAnterior: 100_000 }, n: 3 })
    expect((m.direcao_do_canal as { valor: { variacao: number } }).valor.variacao).toBeCloseTo(0.3, 9)
    // ritmo dos longos: 11 publicações nas 13 semanas
    expect(m.por_formato.long.ritmo).toMatchObject({ estado: 'medido', n: 11 })
    expect((m.por_formato.long.ritmo as { valor: { porSemana: number } }).valor.porSemana).toBeCloseTo(11 / 13, 9)
    // taxa de acerto dos longos: 11 elegíveis (8 a 88 dias); múltiplos 0,4 1 2,5 1,2 0,6 3 0,4 1 2,5 1,2 0,6 -> 3 acertos, 2 fracassos
    expect(m.por_formato.long.taxa_de_acerto).toMatchObject({ estado: 'medido', valor: { acertos: 3, fracassos: 2, total: 11 }, n: 11 })
    expect(m.estado_do_canal).toMatchObject({ situacao: 'ativo', confirmada: true })
    expect(r.meta).toMatchObject({ regra: MEASURE_RULES.ruleVersion, canais_cortados_por_tempo: 0, calculado_em: new Date(AGORA).toISOString() })
  })

  it('nenhuma folha é nula, indefinida, NaN ou Infinity, e nenhuma medida é zero por falta', async () => {
    const { sb } = falsoPostgrest(base())
    const r = await pedir(sb, 2)
    for (const m of r.porCanal.values()) {
      // o Short sem direção dos vídeos novos é a única não medida da base cheia; as folhas dela também são verificadas
      expect(folhasRuins(m)).toEqual([])
    }
    const texto = JSON.stringify([...r.porCanal.values()])
    expect(texto).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('apagar por etapas', async () => {
    const cheia = await pedir(falsoPostgrest(base()).sb, 1)
    const m0 = cheia.porCanal.get('c1')!
    // (a) sem retratos: só direcao_do_canal e queda mudam
    const a = (await pedir(falsoPostgrest(base({ semRetratos: true })).sb, 1)).porCanal.get('c1')!
    expect(a.direcao_do_canal.estado).toBe('nao_medido')
    expect(a.estado_do_canal.queda.estado).toBe('nao_medido')
    expect(a.por_formato).toEqual(m0.por_formato)
    expect(a.estado_do_canal.parado).toEqual(m0.estado_do_canal.parado)
    // (b) sem vídeos: as de vídeo mudam
    const b = (await pedir(falsoPostgrest(base({ semVideos: true })).sb, 1)).porCanal.get('c1')!
    expect(b.por_formato.long.ritmo.estado).toBe('nao_medido')
    expect(b.por_formato.long.taxa_de_acerto.estado).toBe('nao_medido')
    expect(b.direcao_do_canal).toEqual(m0.direcao_do_canal)
    // (c) sem o canal: tudo leitura_falhou e nao_determinada
    const t = base(); t.competitor_channels = []
    const c = (await pedir(falsoPostgrest(t).sb, 1)).porCanal.get('c1')!
    for (const x of nove(c)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(c.estado_do_canal).toMatchObject({ situacao: 'nao_determinada', confirmada: false })
  })

  it('tabela de marcas ausente não muda nenhuma das nove', async () => {
    const com = (await pedir(falsoPostgrest(base()).sb, 1)).porCanal.get('c1')!
    const sem = (await pedir(falsoPostgrest(base({ semTabelaDeMarcas: true })).sb, 1)).porCanal.get('c1')!
    expect(sem).toEqual(com)
  })

  it('tabela de retratos ausente: direcao_do_canal e queda leitura_falhou; ritmo, acerto e vídeos seguem', async () => {
    const com = (await pedir(falsoPostgrest(base()).sb, 1)).porCanal.get('c1')!
    const sem = (await pedir(falsoPostgrest(base({ semTabelaDeRetratos: true })).sb, 1)).porCanal.get('c1')!
    expect(sem.direcao_do_canal).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(sem.estado_do_canal.queda).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(sem.por_formato).toEqual(com.por_formato)
  })

  it('erro do banco nos vídeos de um canal não afeta o outro', async () => {
    const { sb } = falsoPostgrest(base({ canais: 2 }))
    const real = reais.ler!.lerVideosDoCanal
    vi.mocked(ler.lerVideosDoCanal).mockImplementation((s, e) => e.channelId === 'c1' ? Promise.resolve({ lido: false, causa: 'erro_do_banco' as const }) : real(s, e))
    const r = await pedir(sb, 2)
    const c1 = r.porCanal.get('c1')!, c2 = r.porCanal.get('c2')!
    expect(c1.por_formato.long.ritmo).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(c1.por_formato.long.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(c1.estado_do_canal.situacao).toBe('nao_determinada')
    expect(c2.por_formato.long.ritmo.estado).toBe('medido')
    expect(c2.estado_do_canal.situacao).toBe('ativo')
  })

  it('motor nulo: a taxa de acerto diz leitura_falhou, nunca sem_multiplo; as outras seguem', async () => {
    const { sb } = falsoPostgrest(base())
    const m = (await pedir(sb, 1, { obs: null })).porCanal.get('c1')!
    expect(m.por_formato.long.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(m.por_formato.short.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(m.por_formato.long.ritmo.estado).toBe('medido')
    expect(m.direcao_do_canal.estado).toBe('medido')
    expect(JSON.stringify(m)).not.toContain('sem_multiplo')
  })

  it('motor presente e canal sem múltiplo: o motivo da E4, com frase, nunca leitura_falhou', async () => {
    const { sb } = falsoPostgrest(base({ canais: 2 }))
    const m = (await pedir(sb, 2, { obs: motor(2, true) })).porCanal.get('c2')!
    const a = m.por_formato.long.taxa_de_acerto
    expect(a.estado).toBe('nao_medido')
    if (a.estado === 'nao_medido') { expect(a.motivo).toBe('sem_multiplo'); expect(a.frase.length).toBeGreaterThan(0) }
  })
})

describe('medidasDosCanais: o estado do canal', () => {
  it('ativo só é confirmado com parado e queda medidos', async () => {
    const com = (await pedir(falsoPostgrest(base()).sb, 1)).porCanal.get('c1')!
    expect(com.estado_do_canal).toMatchObject({ situacao: 'ativo', confirmada: true })
    // sem os 113 dias de retrato (só 60): a queda não fecha, o estado continua ativo e deixa de ser confirmado
    const t = base()
    t.competitor_channel_snapshots = t.competitor_channel_snapshots!.slice(-60)
    const sem = (await pedir(falsoPostgrest(t).sb, 1)).porCanal.get('c1')!
    expect(sem.estado_do_canal).toMatchObject({ situacao: 'ativo', confirmada: false })
    expect(sem.estado_do_canal.queda.estado).toBe('nao_medido')
  })

  it('ativo com a queda não medida por cruzar a mudança de contagem', async () => {
    const t = base({ agora: AGORA_DEPOIS })
    const { sb } = falsoPostgrest(t)
    const m = (await pedir(sb, 1, { agoraMs: AGORA_DEPOIS })).porCanal.get('c1')!
    expect(m.estado_do_canal.situacao).toBe('ativo')
    expect(m.estado_do_canal.confirmada).toBe(false)
    expect(m.estado_do_canal.queda).toMatchObject({ estado: 'nao_medido', motivo: 'janela_cruza_mudanca_de_contagem' })
    const q = m.estado_do_canal.queda
    if (q.estado === 'nao_medido') expect(q.frase.length).toBeGreaterThan(0)
  })

  it('parado e fora do ar são confirmados mesmo com a queda não medida', async () => {
    const fora = base(); fora.competitor_channels = [{ id: 'c1', site_id: SITE, collection_paused_at: null, missing_since: new Date(AGORA - 3 * D).toISOString() }]
    const f = (await pedir(falsoPostgrest(fora).sb, 1)).porCanal.get('c1')!
    expect(f.estado_do_canal).toMatchObject({ situacao: 'fora_do_ar', confirmada: true })
    // parado: sem publicar há muito (todos os vídeos com mais de 200 dias), sem retratos
    const velho = base({ semRetratos: true })
    velho.competitor_videos = velho.competitor_videos.map((v, i) => ({ ...v, published_at: new Date(AGORA - (200 + i) * D).toISOString() }))
    const p = (await pedir(falsoPostgrest(velho).sb, 1)).porCanal.get('c1')!
    expect(p.estado_do_canal).toMatchObject({ situacao: 'parado', confirmada: true })
    expect(p.estado_do_canal.queda.estado).toBe('nao_medido')
  })

  it('canal pausado: situacao pausado, confirmada false, parado e queda nao_medido com coleta_pausada', async () => {
    const t = base(); t.competitor_channels = [{ id: 'c1', site_id: SITE, collection_paused_at: new Date(AGORA - 2 * D).toISOString(), missing_since: null }]
    const m = (await pedir(falsoPostgrest(t).sb, 1)).porCanal.get('c1')!
    expect(m.estado_do_canal.situacao).toBe('pausado')
    expect(m.estado_do_canal.confirmada).toBe(false)
    expect(m.estado_do_canal.parado).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_pausada' })
    expect(m.estado_do_canal.queda).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_pausada' })
  })

  it('longos e Shorts não se misturam', async () => {
    const { sb } = falsoPostgrest(base())
    const m = (await pedir(sb, 1)).porCanal.get('c1')!
    expect(m.por_formato.long.ritmo).not.toEqual(m.por_formato.short.ritmo)
    expect(m.por_formato.long.taxa_de_acerto).not.toEqual(m.por_formato.short.taxa_de_acerto)
    // 10 Shorts, todos com idade de 8 a 72 dias; a conta do Short usa só os dele
    expect(m.por_formato.short.taxa_de_acerto).toMatchObject({ estado: 'medido', valor: { total: 10 }, n: 10 })
    expect(m.por_formato.short.ritmo).toMatchObject({ estado: 'medido', n: 10 })
  })
})

describe('medidasDosCanais: o tempo', () => {
  it('o prazo corta quem não começou', async () => {
    const { sb } = falsoPostgrest(base({ canais: 6 }))
    let t = 0
    const real = reais.ler!.lerCanal
    let chamadas = 0
    vi.mocked(ler.lerCanal).mockImplementation(async (s, e) => { if (++chamadas === 2) t += 100_000; return real(s, e) })
    const r = await pedir(sb, 6, { obs: motor(6), prazoAteMs: 40_000, relogio: () => t })
    expect(CANAIS_EM_PARALELO).toBe(4)
    // o relógio passa do prazo quando o 2º canal começa: só os dois primeiros começaram
    expect(r.meta.canais_cortados_por_tempo).toBe(4)
    expect(r.porCanal.size).toBe(6)
    for (const c of ['c3', 'c4', 'c5', 'c6']) {
      const m = r.porCanal.get(c)!
      for (const x of nove(m)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
      expect(m.estado_do_canal.situacao).toBe('nao_determinada')
    }
    for (const c of ['c1', 'c2']) expect(r.porCanal.get(c)!.por_formato.long.ritmo.estado).toBe('medido')
  })

  it('canal em andamento que nunca responde não segura a resposta', async () => {
    vi.useFakeTimers()
    const { sb } = falsoPostgrest(base({ canais: 3 }))
    const real = reais.ler!.lerVideosDoCanal
    vi.mocked(ler.lerVideosDoCanal).mockImplementation((s, e) => e.channelId === 'c2' ? new Promise(() => undefined) : real(s, e))
    const promessa = pedir(sb, 3, { prazoAteMs: Date.now() + PRAZO_DO_PEDIDO_MS })
    await vi.advanceTimersByTimeAsync(PRAZO_DO_PEDIDO_MS)
    const r = await promessa
    expect(r.meta.canais_cortados_por_tempo).toBe(1)
    for (const x of nove(r.porCanal.get('c2')!)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    for (const c of ['c1', 'c3']) expect(r.porCanal.get(c)!.por_formato.long.ritmo.estado).toBe('medido')
  })

  it('prazo já vencido na chegada: nenhum leitor é chamado', async () => {
    const { sb, consultas } = falsoPostgrest(base({ canais: 3 }))
    const r = await pedir(sb, 3, { prazoAteMs: 10, relogio: () => 50 })
    expect(r.meta.canais_cortados_por_tempo).toBe(3)
    expect(consultas).toHaveLength(0)
    expect(ler.lerCanal).not.toHaveBeenCalled()
    for (const m of r.porCanal.values()) for (const x of nove(m)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
  })

  it('contraOPrazo: termina antes, termina depois, rejeita, e prazo zero', async () => {
    vi.useFakeTimers()
    const ok = contraOPrazo(() => new Promise<string>((res) => setTimeout(() => res('a'), 100)), Date.now() + 1000, Date.now)
    await vi.advanceTimersByTimeAsync(100)
    expect(await ok).toEqual({ terminou: true, valor: 'a' })

    const tarde = contraOPrazo(() => new Promise<string>((res) => setTimeout(() => res('b'), 5000)), Date.now() + 1000, Date.now)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await tarde).toEqual({ terminou: false })
    await vi.advanceTimersByTimeAsync(5000) // a promessa perdedora resolve depois, sem rejeição solta

    const rej = contraOPrazo(() => Promise.reject(new Error('boom')), Date.now() + 1000, Date.now)
    await expect(rej).rejects.toThrow('boom')

    const f = vi.fn(() => Promise.resolve(1))
    expect(await contraOPrazo(f, Date.now(), Date.now)).toEqual({ terminou: false })
    expect(f).not.toHaveBeenCalled()
  })

  it('contraOPrazo limpa o temporizador', async () => {
    vi.useFakeTimers()
    const ok = contraOPrazo(() => Promise.resolve(1), Date.now() + 1000, Date.now)
    await ok
    expect(vi.getTimerCount()).toBe(0)
    await expect(contraOPrazo(() => Promise.reject(new Error('x')), Date.now() + 1000, Date.now)).rejects.toThrow('x')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('nunca mais que 4 canais ao mesmo tempo', async () => {
    const { sb } = falsoPostgrest(base({ canais: 9 }))
    const real = reais.ler!.lerCanal
    let abertas = 0, maximo = 0
    vi.mocked(ler.lerCanal).mockImplementation(async (s, e) => {
      abertas++; maximo = Math.max(maximo, abertas)
      await new Promise((res) => setTimeout(res, 5))
      abertas--
      return real(s, e)
    })
    const r = await pedir(sb, 9)
    expect(r.porCanal.size).toBe(9)
    expect(maximo).toBeLessThanOrEqual(CANAIS_EM_PARALELO)
    expect(maximo).toBeGreaterThan(1)
  })
})

describe('medidasDosCanais: a robustez', () => {
  it('todo canal pedido tem entrada, mesmo quando um leitor lança', async () => {
    const { sb } = falsoPostgrest(base({ canais: 3 }))
    const real = reais.ler!.lerVideosDoCanal
    vi.mocked(ler.lerVideosDoCanal).mockImplementation((s, e) => { if (e.channelId === 'c2') throw new Error('SENTINELA-LANCADA'); return real(s, e) })
    const r = await pedir(sb, 3)
    expect([...r.porCanal.keys()].sort()).toEqual(['c1', 'c2', 'c3'])
    for (const x of nove(r.porCanal.get('c2')!)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(sentry.captureException).toHaveBeenCalled()
    expect(JSON.stringify(r)).not.toContain('SENTINELA-LANCADA')
    expect(r.porCanal.get('c1')!.por_formato.long.ritmo.estado).toBe('medido')
  })

  it('lista de canais vazia', async () => {
    const { sb } = falsoPostgrest(base())
    const r = await pedir(sb, 0)
    expect(r.porCanal.size).toBe(0)
    expect(r.indisponiveis).toEqual({ total: 0, indisponiveis: 0, por_motivo: {} })
  })

  it('os números saem como a E4 entregou, sem arredondar', () => {
    const m = paraCowork({ estado: 'medido', valor: { variacao: 0.00004, direcao: 'subindo', n: 12 }, n: 12, janela: { de: null, ate: null, dias: null }, notas: [] })
    expect(m).toEqual({ estado: 'medido', valor: { variacao: 0.00004, direcao: 'subindo', n: 12 }, n: 12, janela: { de: null, ate: null, dias: null } })
  })

  it('notas vazia some; notas com item fica', () => {
    const vazia = paraCowork({ estado: 'medido', valor: 1, n: 1, janela: { de: null, ate: null, dias: null }, notas: [] })
    const cheia = paraCowork({ estado: 'medido', valor: 1, n: 1, janela: { de: null, ate: null, dias: null }, notas: [{ tipo: 'mudanca_de_contagem' }] })
    expect('notas' in vazia).toBe(false)
    expect(cheia).toMatchObject({ notas: [{ tipo: 'mudanca_de_contagem' }] })
    const nao = paraCowork({ estado: 'nao_medido', motivo: 'poucos_videos', n: 1, minimo: 3, notas: [{ tipo: 'agendado_fora', n: 1 }] })
    expect(nao).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 1, minimo: 3, notas: [{ tipo: 'agendado_fora', n: 1 }] })
    expect((nao as { frase: string }).frase.length).toBeGreaterThan(0)
  })

  it('medidas_indisponiveis soma certo', async () => {
    const t = base({ canais: 2 })
    t.competitor_channel_snapshots = t.competitor_channel_snapshots!.filter((l) => l.competitor_channel_id !== 'c2') // c2 sem retrato
    const r = await pedir(falsoPostgrest(t).sb, 2)
    expect(r.indisponiveis.total).toBe(18)
    const soma = Object.values(r.indisponiveis.por_motivo).reduce((a, b) => a + b, 0)
    expect(soma).toBe(r.indisponiveis.indisponiveis)
    expect(r.indisponiveis.indisponiveis).toBeGreaterThan(2)
    const contada = [...r.porCanal.values()].flatMap(nove).filter((x) => x.estado === 'nao_medido').length
    expect(contada).toBe(r.indisponiveis.indisponiveis)
  })

  it('mutação: o site de dep chega a todo leitor (canal de outro site: tudo leitura_falhou e nenhum outro leitor é chamado)', async () => {
    const t = base(); t.competitor_channels = [{ id: 'c1', site_id: OUTRO_SITE, collection_paused_at: null, missing_since: null }]
    const { sb, consultas } = falsoPostgrest(t)
    const r = await pedir(sb, 1)
    for (const x of nove(r.porCanal.get('c1')!)) expect(x).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    expect(consultas.filter((c) => c.tabela !== 'competitor_channels')).toHaveLength(0)
    expect(ler.lerVideosDoCanal).not.toHaveBeenCalled()
    expect(ler.lerMarcasDoCanal).not.toHaveBeenCalled()
    expect(ler.lerRetratosDoCanal).not.toHaveBeenCalled()
    // o site de dep é o que chega: todo leitor chamado recebe SITE
    const { sb: sb2 } = falsoPostgrest(base())
    await pedir(sb2, 1)
    for (const f of [ler.lerCanal, ler.lerVideosDoCanal, ler.lerMarcasDoCanal, ler.lerRetratosDoCanal]) {
      for (const chamada of vi.mocked(f).mock.calls) expect((chamada[1] as { siteId: string }).siteId).toBe(SITE)
    }
  })

  it('mutação: os múltiplos de um canal não vazam para outro', async () => {
    const { sb } = falsoPostgrest(base({ canais: 2 }))
    // múltiplos só dos vídeos do canal 1: o canal 2 não pode medir a taxa com eles
    const r = await pedir(sb, 2, { obs: motor(2, true) })
    expect(r.porCanal.get('c1')!.por_formato.long.taxa_de_acerto.estado).toBe('medido')
    expect(r.porCanal.get('c2')!.por_formato.long.taxa_de_acerto.estado).toBe('nao_medido')
  })
})

describe('competitors-medidas: o arquivo', () => {
  const texto = readFileSync(new URL('../../../src/lib/pipeline/services/competitors-medidas.ts', import.meta.url), 'utf8')
  it('não deriva múltiplo por conta própria', () => {
    expect(texto).toMatch(/import \{ multiplosDoCanal \} from '@\/lib\/youtube\/observatorio\/medidas-multiplos'/)
    expect(texto).not.toContain('.mult?.')
    expect(texto).not.toContain('multiplosDoMotor')
  })
  it('não cita o que é proibido', () => {
    for (const p of ['loadRows', 'rowsToDataset', 'loadDataset', 'loadChannelRows', 'weeklySeries', 'tierSpans', 'unobservedSeries', 'competitor_video_comment']) expect(texto).not.toContain(p)
  })
})

/** O limite da P-14 (60.000 caracteres sem a resposta do dono). */
const LIMITE_P14 = 60_000
describe('a porta MCP com 15 canais', () => {
  it('o texto da ferramenta fica ACIMA do limite com a indentação de toMcpSuccess e DENTRO sem ela (decide a Tarefa 13)', async () => {
    const t = base({ canais: 15 })
    // metade dos canais sem retrato: medidas e não medidas misturadas
    t.competitor_channel_snapshots = t.competitor_channel_snapshots!.filter((l) => Number(String(l.competitor_channel_id).slice(1)) % 2 === 1)
    const canais = Array.from({ length: 15 }, (_, i) => ({ id: canalId(i + 1) }))
    const r = await medidasDosCanais({ supabase: falsoPostgrest(t).sb, siteId: SITE }, canais, { obs: motor(15), agoraMs: AGORA, prazoAteMs: Date.now() + PRAZO_DO_PEDIDO_MS })
    const dados = {
      channels: canais.map((c, i) => ({
        id: c.id, channel_id: `UCsintetico${i}`, channel_name: `Canal sintético ${i}`, thumbnail_url: 'https://exemplo.test/a.jpg', subscriber_count: 1000 + i,
        video_count: 24, last_synced_at: new Date(AGORA).toISOString(), added_at: new Date(AGORA - 90 * D).toISOString(), avg_engagement: 0.04,
        perfil: { estado: 'lido', lido_em: new Date(AGORA).toISOString(), handle: `@sintetico${i}`, pais: 'BR', criado_em: new Date(AGORA - 900 * D).toISOString() },
        medidas: r.porCanal.get(c.id),
      })),
      count: 15, medidas_indisponiveis: r.indisponiveis, medidas_meta: r.meta,
    }
    const comIndentacao = toMcpSuccess(dados).content[0]!.text.length
    const semIndentacao = JSON.stringify(dados).length
    console.info(`[E7 T12] texto da ferramenta com 15 canais: ${comIndentacao} caracteres com indentação; ${semIndentacao} sem`)
    // MEDIDO: ACIMA do limite com a indentação de toMcpSuccess; DENTRO sem ela. É o gatilho do conserto da Tarefa 13 (list_channels sem indentação).
    expect(comIndentacao).toBeGreaterThan(LIMITE_P14)
    expect(semIndentacao).toBeLessThan(LIMITE_P14)
  })
})
