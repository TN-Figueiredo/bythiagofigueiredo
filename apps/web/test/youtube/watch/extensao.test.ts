// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { AlvoAtivo } from '@/lib/youtube/watch/alvos'
import { avaliarExtensoes, juntarAtualizacoes, saidasPorJanela } from '@/lib/youtube/watch/extensao'
import type { ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import { RENDERERS_TITULO, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube'

const AGORA = Date.UTC(2026, 9, 18, 12, 0, 0)
const HORA = 3_600_000
const SITE = '00000000-0000-4000-8000-000000000099'
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const iso = (ms: number): string => new Date(ms).toISOString()

function alvo(n: number, o: Partial<AlvoAtivo> = {}): AlvoAtivo {
  return { id: n, siteId: SITE, ytId: yt(n), horaBaseMin: 0, rodadasPorDia: 4, proximaRodadaEm: iso(AGORA - 60_000), coletaAte: iso(AGORA + 10 * HORA),
    motivoAte: 'janela_concorrente', extensoesCurtas: 0, indisponivelSeguidas: 0, rodadas: 0, temTesteNosso: false, ...o }
}
function nova(n: number): ResultadoLeitor {
  const leitura: LeituraWatch = { youtubeVideoId: yt(n), lidaEm: iso(AGORA), rodadaId: '00000000-0000-4000-8000-000000000001', origemRede: 'vercel', idioma: 'pt-BR', erro: null,
    tituloOficial: null, titulo_oficial_fonte: null, rendicoesSqp: null, titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: 'T' })), miniaturas: [] }
  return { leitura, http: 200, jogadorBloqueado: false }
}
const novasDe = (...ns: number[]): Map<number, ResultadoLeitor[]> => new Map(ns.map(n => [n, [nova(n)]]))

/** Linha do banco para o vídeo `n` no instante `ms`, com o título `t`. */
function linha(n: number, ms: number, t: string, i = 0): Record<string, unknown> {
  return { site_id: SITE, youtube_video_id: yt(n), lida_em: iso(ms - i), rodada_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, origem_rede: 'vercel', versao_leitor: 1,
    http: 200, erro: null, idioma: 'pt-BR', titulo_oficial: null, titulo_oficial_fonte: null, titulo_exibido: t, renderers_presentes: 7, titulos_divergentes: null,
    rendicoes_sqp: null, jogador_bloqueado: false, miniatura_id: null }
}

interface Pedido { tabela: string; faixa: [number, number] | null; ytId: string | null }
/** `leituras(ytId)` devolve TODAS as linhas do vídeo; o falso corta por `range` e devolve `count`. */
function banco(leituras: (ytId: string) => Record<string, unknown>[] | 'erro', opcoes: { count?: (n: number) => number } = {}) {
  const pedidos: Pedido[] = []
  const sb = {
    from: (tabela: string) => {
      const p: Pedido = { tabela, faixa: null, ytId: null }
      pedidos.push(p)
      const q: Record<string, unknown> = {}
      for (const f of ['select', 'gte', 'order', 'abortSignal']) q[f] = () => q
      q.eq = (col: string, v: string) => { if (col === 'youtube_video_id') p.ytId = v; return q }
      q.range = (de: number, ate: number) => { p.faixa = [de, ate]; return q }
      q.then = (ok: (r: unknown) => unknown, err: (e: unknown) => unknown) => {
        if (tabela !== 'yt_watch_readings') return Promise.resolve({ data: [], error: null }).then(ok, err)
        const todas = leituras(p.ytId ?? '')
        if (todas === 'erro') return Promise.resolve({ data: null, error: { code: 'XX000' } }).then(ok, err)
        const [de, ate] = p.faixa ?? [0, 999]
        return Promise.resolve({ data: todas.slice(de, ate + 1), error: null, count: (opcoes.count ?? (x => x))(todas.length) }).then(ok, err)
      }
      return q
    },
  } as never
  return { sb, pedidos }
}
const ate = AGORA + 83_000
const deps = { relogio: () => AGORA }

describe('A12 avaliarExtensoes', () => {
  it('1.000 linhas por página com count 1.300: pagina e entrega 1.300', async () => {
    let recebidas = 0
    const todas = Array.from({ length: 1300 }, (_, i) => linha(1, AGORA - 60_000 - i * 1000, 'T', i))
    const b = banco(() => todas)
    const r = await avaliarExtensoes(b.sb, [alvo(1)], novasDe(1), AGORA, ate, {
      ...deps, detectar: ls => { recebidas = ls.length; return detectarTesteYoutube(ls) },
    })
    expect(recebidas).toBe(1301) // 1.300 do banco + 1 nova ainda não gravada
    expect(b.pedidos.filter(p => p.tabela === 'yt_watch_readings').map(p => p.faixa)).toEqual([[0, 999], [1000, 1999]])
    expect(r.avaliados.has(1)).toBe(true)
  })
  it('soma diferente do count: o vídeo não é avaliado e conta como falha', async () => {
    const todas = Array.from({ length: 10 }, (_, i) => linha(1, AGORA - 60_000 - i * 1000, 'T', i))
    const b = banco(() => todas, { count: n => n + 5 })
    const r = await avaliarExtensoes(b.sb, [alvo(1)], novasDe(1), AGORA, ate, deps)
    expect(r.avaliados.size).toBe(0)
    expect(r.falharam).toBe(1)
  })
  it('erro do banco: não avalia', async () => {
    const r = await avaliarExtensoes(banco(() => 'erro').sb, [alvo(1)], novasDe(1), AGORA, ate, deps)
    expect(r.avaliados.size).toBe(0)
    expect(r.falharam).toBe(1)
  })
  it('coleta_ate vencido sem avaliação: continua com saiu_em nulo', async () => {
    const a = alvo(1, { coletaAte: iso(AGORA - HORA) })
    const r = await avaliarExtensoes(banco(() => 'erro').sb, [a], novasDe(1), AGORA, ate, deps)
    expect(saidasPorJanela([a], r, AGORA)).toEqual([])
    // sem tempo: também não avalia
    const r2 = await avaliarExtensoes(banco(() => []).sb, [a], novasDe(1), AGORA, ate, { relogio: () => ate })
    expect(r2.avaliados.size).toBe(0)
    expect(saidasPorJanela([a], r2, AGORA)).toEqual([])
  })
  it('avaliado e vencido: sai por janela; avaliado e não vencido: fica', async () => {
    const vencido = alvo(1, { coletaAte: iso(AGORA - HORA) }), vivo = alvo(2, { coletaAte: iso(AGORA + HORA) })
    const r = await avaliarExtensoes(banco(() => []).sb, [vencido, vivo], novasDe(1, 2), AGORA, ate, deps)
    expect(r.avaliados).toEqual(new Set([1, 2]))
    expect(saidasPorJanela([vencido, vivo], r, AGORA)).toEqual([{ id: 1, saiu_em: iso(AGORA), saiu_por: 'janela' }])
  })
  it('detectar lança em 1 de 3: os outros 2 são avaliados e falharam 1', async () => {
    const r = await avaliarExtensoes(banco(() => []).sb, [alvo(1), alvo(2), alvo(3)], novasDe(1, 2, 3), AGORA, ate, {
      ...deps, detectar: ls => { if (ls[0]?.youtubeVideoId === yt(2)) throw new Error('boom'); return detectarTesteYoutube(ls) },
    })
    expect(r.avaliados).toEqual(new Set([1, 3]))
    expect(r.falharam).toBe(1)
  })
  it('provavel_teste: reter_ate = ultimaVista + 180 d e coleta_ate = ultimaVista + 30 d', async () => {
    const ultima = AGORA - 2 * HORA
    const a = alvo(1)
    const r = await avaliarExtensoes(banco(() => []).sb, [a], novasDe(1), AGORA, ate, {
      ...deps, detectar: () => ({ estado: 'provavel_teste', ultimaVista: iso(ultima), contagem: { rodadasMistasTitulo: 3 } } as unknown as ReturnType<typeof detectarTesteYoutube>),
    })
    const u = r.atualizacoes.get(1)
    expect(u).toMatchObject({ motivo_ate: 'extensao', reter_ate: iso(ultima + 180 * 86_400_000) })
    expect(Date.parse(u?.coleta_ate ?? '')).toBe(Math.max(Date.parse(a.coletaAte), ultima + 30 * 86_400_000))
  })
  it('só alvos perto do corte (< 48 h) ou já estendidos, lidos agora, no máximo 4', async () => {
    const longe = alvo(1, { coletaAte: iso(AGORA + 100 * HORA) })
    const estendido = alvo(2, { coletaAte: iso(AGORA + 100 * HORA), motivoAte: 'extensao' })
    const semLeitura = alvo(3)
    const muitos = [4, 5, 6, 7, 8].map(n => alvo(n))
    const b = banco(() => [])
    const r = await avaliarExtensoes(b.sb, [longe, estendido, semLeitura, ...muitos], novasDe(1, 2, 4, 5, 6, 7, 8), AGORA, ate, deps)
    expect(r.avaliados.size).toBe(4)
    expect(r.avaliados.has(1)).toBe(false)
    expect(r.avaliados.has(3)).toBe(false)
    // os 4 com o corte mais próximo vêm primeiro; o estendido (corte longe) espera a vez
    expect(r.avaliados).toEqual(new Set([4, 5, 6, 7]))
    const r2 = await avaliarExtensoes(b.sb, [longe, estendido, semLeitura], novasDe(1, 2), AGORA, ate, deps)
    expect(r2.avaliados).toEqual(new Set([2]))
  })
  it('juntarAtualizacoes: a última vence campo a campo', () => {
    expect(juntarAtualizacoes([{ id: 1, rodadas_mais: 1 }], [{ id: 1, reter_ate: 'x' }, { id: 2, rodadas_mais: 2 }])).toEqual([{ id: 1, rodadas_mais: 1, reter_ate: 'x' }, { id: 2, rodadas_mais: 2 }])
  })
})
