// Mundo em memória para os testes da tarefa `registro_teste_nativo`: tabelas, RPCs e relógio.
import { RENDERERS_TITULO, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { PADROES, criarBanco, type Linha, type OpcoesBanco } from './banco-falso'

export const T0 = Date.UTC(2026, 9, 18, 21, 40, 0)
export const SITE = '00000000-0000-4000-8000-000000000001'
export const MIN = 60_000
export const H = 3_600_000
export const iso = (ms: number): string => new Date(ms).toISOString()
export const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
export const vid = (n: number): string => `00000000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`
const uuidDeRodada = (r: string): string => {
  const n = [...r].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 1_000_000_007, 7)
  return `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`
}

let seqLinha = 0
export function linhasDeLeituras(ls: readonly LeituraWatch[], n: number): Linha[] {
  return ls.map(l => {
    const texto = l.titulosExibidos.find(t => t.texto !== null)?.texto ?? null
    const todos = l.titulosExibidos.every(t => t.texto === texto)
    return {
      id: ++seqLinha, site_id: SITE, youtube_video_id: yt(n), lida_em: l.lidaEm, rodada_id: uuidDeRodada(l.rodadaId), origem_rede: 'vercel', versao_leitor: 1,
      http: 200, erro: l.erro, idioma: l.idioma, titulo_oficial: l.tituloOficial, titulo_oficial_fonte: l.titulo_oficial_fonte,
      titulo_exibido: todos ? texto : null, renderers_presentes: todos && texto !== null ? (1 << RENDERERS_TITULO.length) - 1 : 0,
      titulos_divergentes: todos ? null : l.titulosExibidos.map(t => ({ renderer: t.renderer, texto: t.texto })), rendicoes_sqp: null, jogador_bloqueado: false, miniatura_id: null,
    }
  })
}

export interface VideoCfg {
  n: number
  leituras?: readonly LeituraWatch[]
  /** 'auto' = a última leitura; null = nunca; ou instante. */
  ultimaRodadaEm?: 'auto' | string | null
  rodadasPorDia?: 1 | 4
  saiuEm?: string | null
  semVideo?: boolean
  avaliacoes?: Linha[]
  aberto?: Linha
  winnerAppliedAt?: string
}

export function avaliacaoSemente(n: number, id: number, p: Partial<Linha> & { avaliada_em: string; estado_14: string }): Linha {
  return {
    id, site_id: SITE, video_id: vid(n), ate_lida_em: null, motivo_14: null, estado_48: null, mistas_48: null, mistas_48_fora_quarentena: null, min_desde_escrita: null,
    contagem: null, escritas: null, versao_regra: 1, registro_id: null, erro: null, retroativa: false, aviso: null, ...p,
  }
}
export function registroSemente(n: number, id: string, p: Partial<Linha> = {}): Linha {
  return {
    id, site_id: SITE, video_id: vid(n), youtube_video_id: yt(n), estado: 'em_andamento', origem: 'detectado', campos: ['titulo'], variantes_titulo: ['Titulo A', 'Titulo B'],
    votos_titulo: { '0': 20, '1': 10 }, titulo_oficial: null, primeira_vista: iso(T0 - 70 * H), ultima_vista: iso(T0 - 5 * H), veredito: null, versao_regra: 1,
    sinais_fracos: [], evidencia: [], miniatura_a: null, desfecho_estado: null, desfecho_motivo: null, desfecho_versao_regra: null, desfecho_em: null, vencedor_titulo: null,
    vencedor_fonte: null, encerrado_em: null, descartado_em: null, evidencia_cortada: false, created_at: iso(T0 - 70 * H), updated_at: '2026-10-18T10:00:00.000001+00:00', ...p,
  }
}

export interface OpcoesMundo extends Omit<OpcoesBanco, 'rpcs'> {
  /** Retorno de `yt_watch_reter`; padrão 1. */
  reter?: number | { erro: string }
  /** Falha o N-ésimo (1-based) `ab_native_reproduzir` com este erro. */
  reproduzirFalha?: { vez: number; code: string }
  /** Retorno forçado de `ab_native_reproduzir`. */
  reproduzirRetorna?: number
}

export function mundo(videos: VideoCfg[], o: OpcoesMundo = {}) {
  const alvos: Linha[] = []
  const youtubeVideos: Linha[] = []
  const leituras: Linha[] = []
  const abTests: Linha[] = []
  const avaliacoes: Linha[] = []
  const nativos: Linha[] = []
  for (const v of videos) {
    const ls = linhasDeLeituras(v.leituras ?? [], v.n)
    leituras.push(...ls)
    const ultima = v.ultimaRodadaEm === undefined || v.ultimaRodadaEm === 'auto' ? (ls.length ? ls.map(l => l.lida_em as string).sort().at(-1)! : null) : v.ultimaRodadaEm
    alvos.push({ id: v.n, site_id: SITE, youtube_video_id: yt(v.n), tipo: 'proprio', rodadas_por_dia: v.rodadasPorDia ?? 4, ultima_rodada_em: ultima, saiu_em: v.saiuEm ?? null, ativo_desde: iso(T0 - 40 * 86_400_000) })
    if (!v.semVideo) youtubeVideos.push({ id: vid(v.n), site_id: SITE, youtube_video_id: yt(v.n) })
    if (v.winnerAppliedAt !== undefined) abTests.push({ id: `t${v.n}`, youtube_video_id: vid(v.n), status: 'running', test_type: 'title', winner_applied_at: v.winnerAppliedAt, created_at: iso(T0 - H), updated_at: iso(T0 - H) })
    avaliacoes.push(...(v.avaliacoes ?? []))
    if (v.aberto) nativos.push(v.aberto)
  }
  const tabelas: Record<string, Linha[]> = {
    yt_watch_alvos: alvos, youtube_videos: youtubeVideos, yt_watch_readings: leituras, yt_watch_thumbs: [], ab_tests: abTests, ab_test_cycles: [], ab_test_restores: [],
    ab_native_avaliacoes: avaliacoes, ab_native_tests: nativos,
  }
  let reproducoes = 0
  let seq = 5000
  const b = criarBanco(tabelas, {
    ...o,
    rpcs: {
      ab_native_ultimas: a => ({
        error: null,
        data: (a.p_videos as string[]).map(video => {
          const todas = (tabelas.ab_native_avaliacoes ?? []).filter(x => x.video_id === video).sort((p, q) => Date.parse(p.avaliada_em as string) - Date.parse(q.avaliada_em as string))
          const reais = todas.filter(x => x.retroativa !== true)
          const ult = <T extends Linha>(xs: T[]): T | undefined => xs.at(-1)
          const u = ult(reais), ok = ult(reais.filter(x => x.estado_14 !== 'erro' && x.estado_14 !== 'sem_rodada_nova'))
          const er = ult(todas.filter(x => x.estado_14 === 'erro')), sr = ult(todas.filter(x => x.estado_14 === 'sem_rodada_nova'))
          return {
            video_id: video, alguma: todas.some(x => x.estado_14 !== 'erro'), ultima_em: u?.avaliada_em ?? null, ultima_ok_em: ok?.avaliada_em ?? null,
            ultimo_erro_em: er?.avaliada_em ?? null, ultimo_erro: er?.erro ?? null, ultimo_erro_id: er?.id ?? null, ultima_id: u?.id ?? null, ultimo_sem_rodada_em: sr?.avaliada_em ?? null,
          }
        }),
      }),
      ab_native_reproduzir: a => {
        reproducoes++
        if (o.reproduzirFalha && o.reproduzirFalha.vez === reproducoes) return { data: null, error: { code: o.reproduzirFalha.code } }
        if (o.reproduzirRetorna !== undefined) return { data: o.reproduzirRetorna, error: null }
        const video = a.p_video as string
        if ((tabelas.ab_native_avaliacoes ?? []).some(x => x.video_id === video && x.estado_14 !== 'erro')) return { data: 0, error: null }
        for (const r of a.p_registros as Linha[]) (tabelas.ab_native_tests ??= []).push({ ...(PADROES.ab_native_tests ?? {}), site_id: a.p_site, video_id: video, created_at: iso(T0), updated_at: iso(T0), ...r })
        const avs = [...(a.p_avaliacoes as Linha[])].sort((p, q) => Date.parse(p.avaliada_em as string) - Date.parse(q.avaliada_em as string))
        for (const av of avs) (tabelas.ab_native_avaliacoes ??= []).push({ id: ++seq, ...(PADROES.ab_native_avaliacoes ?? {}), site_id: a.p_site, video_id: video, ...av })
        return { data: avs.length, error: null }
      },
      yt_watch_reter: () => (typeof o.reter === 'object' ? { data: null, error: { code: o.reter.erro } } : { data: o.reter ?? 1, error: null }),
      ab_native_poda: () => ({ data: 0, error: null }),
    },
  })
  return b
}

/** `ir(state, ms)` abre um disparo novo `ms` depois do T0: t0 e relógio andam juntos. */
export function ir(state: { agora: number; t0: number }, ms: number): void {
  state.t0 = T0 + ms
  state.agora = T0 + ms
}
export function contexto(inicio = 0) {
  const state = { t0: T0, agora: T0 + inicio }
  const c = (sb: unknown): ContextoTarefa => ({ t0: state.t0, agora: () => state.agora, apiKey: '', sb: sb as never, linhas: null })
  return { state, c }
}
