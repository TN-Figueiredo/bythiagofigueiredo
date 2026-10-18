// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { AlvoAtivo } from '@/lib/youtube/watch/alvos'
import type { LinhaLeitura } from '@/lib/youtube/watch/expansor'
import { gravarComDegrau, type AtualizacaoAlvo, type PayloadDisparo } from '@/lib/youtube/watch/gravar'

const AGORA = Date.UTC(2026, 9, 18, 12, 0, 0)
const SITE = '00000000-0000-4000-8000-000000000099'
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`

function leitura(n: number, o: Partial<LinhaLeitura> = {}): LinhaLeitura {
  return {
    site_id: SITE, youtube_video_id: yt(n), lida_em: new Date(AGORA).toISOString(), rodada_id: '00000000-0000-4000-8000-000000000001', origem_rede: 'vercel',
    versao_leitor: 1, http: 200, erro: null, idioma: 'pt-BR', titulo_oficial: null, titulo_oficial_fonte: null, titulo_exibido: 'T', renderers_presentes: 7,
    titulos_divergentes: null, rendicoes_sqp: null, jogador_bloqueado: false, thumb_k: null, ...o,
  }
}
const alvo = (n: number): AlvoAtivo => ({ id: n, siteId: SITE, ytId: yt(n), horaBaseMin: 0, rodadasPorDia: 4, proximaRodadaEm: new Date(AGORA - 600_000).toISOString(),
  coletaAte: new Date(AGORA + 86_400_000).toISOString(), motivoAte: 'janela_concorrente', extensoesCurtas: 0, indisponivelSeguidas: 0, rodadas: 0, temTesteNosso: false })
const payloadDe = (n: number): PayloadDisparo => ({
  thumbs: [], leituras: Array.from({ length: n }, (_, i) => leitura(i + 1)),
  alvos: Array.from({ length: n }, (_, i): AtualizacaoAlvo => ({ id: i + 1, rodadas_mais: 1 })),
})

interface Chamada { p: PayloadDisparo }
function banco(resposta: (c: Chamada, n: number) => { error: unknown } | 'lanca') {
  const chamadas: Chamada[] = []
  const sb = {
    rpc: (nome: string, args: Chamada) => {
      expect(nome).toBe('yt_watch_gravar_disparo')
      chamadas.push(args)
      const r = resposta(args, chamadas.length)
      return { abortSignal: () => (r === 'lanca' ? Promise.reject(new Error('timeout')) : Promise.resolve({ data: null, error: r.error })) }
    },
  } as never
  return { sb, chamadas }
}
const ok = { error: null }
const violacao = { error: { code: '23514', message: 'SEGREDO' } }

describe('A10 gravarComDegrau', () => {
  it('sucesso: uma chamada só', async () => {
    const b = banco(() => ok)
    expect(await gravarComDegrau(b.sb, payloadDe(3), { agora: () => AGORA, ateMs: AGORA + 83_000 })).toEqual({ ok: true, foraDoFormato: 0, degrau: false })
    expect(b.chamadas).toHaveLength(1)
  })
  it('payload vazio: nenhuma ida ao banco', async () => {
    const b = banco(() => ok)
    expect((await gravarComDegrau(b.sb, { thumbs: [], leituras: [], alvos: [] }, { agora: () => AGORA, ateMs: AGORA + 1 })).ok).toBe(true)
    expect(b.chamadas).toHaveLength(0)
  })
  it('conta as fora_do_formato', async () => {
    const b = banco(() => ok)
    const p = payloadDe(2)
    p.leituras[1] = leitura(2, { erro: 'fora_do_formato', titulo_exibido: null, renderers_presentes: 0, idioma: null })
    expect((await gravarComDegrau(b.sb, p, { agora: () => AGORA, ateMs: AGORA + 83_000 })).foraDoFormato).toBe(1)
  })
  it('timeout: uma chamada, gravacao_falhou (ok false), sem degrau', async () => {
    const b = banco(() => 'lanca')
    expect(await gravarComDegrau(b.sb, payloadDe(4), { agora: () => AGORA, ateMs: AGORA + 83_000, alvos: [1, 2, 3, 4].map(alvo) })).toEqual({ ok: false, foraDoFormato: 0, degrau: false })
    expect(b.chamadas).toHaveLength(1)
  })
  it('erro de outra classe (57014): sem degrau', async () => {
    const b = banco(() => ({ error: { code: '57014' } }))
    expect((await gravarComDegrau(b.sb, payloadDe(4), { agora: () => AGORA, ateMs: AGORA + 83_000 })).degrau).toBe(false)
    expect(b.chamadas).toHaveLength(1)
  })
  it('23514: degrau vídeo a vídeo grava os bons; o ruim falha de novo e recebe +20 min numa chamada só de alvos', async () => {
    const b = banco(c => (c.p.leituras.some(l => l.youtube_video_id === yt(2)) ? violacao : ok))
    const r = await gravarComDegrau(b.sb, payloadDe(3), { agora: () => AGORA, ateMs: AGORA + 83_000, alvos: [1, 2, 3].map(alvo) })
    expect(r).toEqual({ ok: false, foraDoFormato: 0, degrau: true })
    // 1 do lote + 3 por vídeo + 1 de adiamento
    expect(b.chamadas).toHaveLength(5)
    const ultima = b.chamadas[4]!.p
    expect(ultima.leituras).toEqual([])
    expect(ultima.alvos).toEqual([{ id: 2, proxima_rodada_em: new Date(AGORA + 20 * 60_000).toISOString() }])
    const porVideo = b.chamadas.slice(1, 4).map(c => c.p.leituras.map(l => l.youtube_video_id))
    expect(porVideo).toEqual([[yt(1)], [yt(2)], [yt(3)]])
    expect(b.chamadas[1]!.p.alvos).toEqual([{ id: 1, rodadas_mais: 1 }])
  })
  it('alvo ainda no futuro: o adiamento soma 20 min ao proxima_rodada_em dele', async () => {
    const b = banco(c => (c.p.leituras.length > 0 ? violacao : ok))
    const a = { ...alvo(1), proximaRodadaEm: new Date(AGORA + 600_000).toISOString() }
    await gravarComDegrau(b.sb, payloadDe(1), { agora: () => AGORA, ateMs: AGORA + 83_000, alvos: [a] })
    expect(b.chamadas.at(-1)!.p.alvos[0]!.proxima_rodada_em).toBe(new Date(AGORA + 600_000 + 20 * 60_000).toISOString())
  })
  it('degrau que recupera tudo: ok true', async () => {
    const b = banco((c, n) => (n === 1 ? violacao : ok))
    expect(await gravarComDegrau(b.sb, payloadDe(2), { agora: () => AGORA, ateMs: AGORA + 83_000, alvos: [1, 2].map(alvo) })).toMatchObject({ ok: true, degrau: true })
  })
  it('sem tempo (relógio em 84 s depois da 1ª chamada): sem degrau', async () => {
    let agora = AGORA
    const b = banco(() => { agora = AGORA + 84_000; return violacao })
    const r = await gravarComDegrau(b.sb, payloadDe(3), { agora: () => agora, ateMs: AGORA + 83_000, alvos: [1, 2, 3].map(alvo) })
    expect(r).toEqual({ ok: false, foraDoFormato: 0, degrau: false })
    expect(b.chamadas).toHaveLength(1)
  })
  it('relógio já passou de 83 s: nem a primeira chamada', async () => {
    const b = banco(() => ok)
    expect((await gravarComDegrau(b.sb, payloadDe(1), { agora: () => AGORA + 84_000, ateMs: AGORA + 83_000 })).ok).toBe(false)
    expect(b.chamadas).toHaveLength(0)
  })
})
