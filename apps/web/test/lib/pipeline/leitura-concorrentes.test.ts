// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lerLeituraDosConcorrentes, type RespostaLeitura } from '@/lib/pipeline/services/leitura-concorrentes'
import { PipelineServiceError, type ServiceContext } from '@/lib/pipeline/services/types'
import { textoTitulo } from '@/lib/youtube/teste-youtube/observados/textos'
import { fakeSb, type Consulta } from '../../youtube/observatorio/sinais/fake-sb'

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const SITE = 'site-1'
const AGORA = Date.parse('2026-10-23T12:00:00.000Z')
const H = 3_600_000
const iso = (h: number): string => new Date(AGORA + h * H).toISOString()
const ON = { OBS_TROCAS_CONCORRENTE: 'on' } as NodeJS.ProcessEnv

type Row = Record<string, unknown>
interface Mundo { alvos: Row[]; cursores: Row[]; linhas: Row[]; canais: Row[]; videos: Row[]; erro?: string; pagina?: (faixa: [number, number] | null) => Row[] }

function aplicar(rows: Row[], c: Consulta): Row[] {
  return rows.filter(r => c.filtros.every(f => {
    if (f.op === 'eq') return r[f.col] === f.val
    if (f.op === 'in') return (f.val as unknown[]).includes(r[f.col])
    return true
  }))
}
function ctxDe(m: Mundo): ServiceContext {
  const { sb } = fakeSb(c => {
    if (m.erro === c.tabela) return { data: null, error: { message: 'boom' } }
    const base = { yt_watch_alvos: m.alvos, ab_native_obs_cursor: m.cursores, ab_native_observados: m.linhas, competitor_channels: m.canais, competitor_videos: m.videos }[c.tabela]
    if (!base) return { data: [], count: 0 }
    const rows = aplicar(base, c)
    if (m.pagina) return { data: m.pagina(c.faixa), count: null }
    if (c.faixa) return { data: rows.slice(c.faixa[0], c.faixa[1] + 1), count: rows.length }
    return { data: rows, count: rows.length }
  })
  return { siteId: SITE, permissions: ['read'], supabase: sb }
}

const mundoVazio = (): Mundo => ({ alvos: [], cursores: [], linhas: [], canais: [{ id: 'ch1', site_id: SITE, channel_name: 'Canal Um', removal_requested_at: null }], videos: [], })

/** Alvo saudável: rodada fresca, cursor em dia, vídeo publicado há 20 dias. */
function alvo(m: Mundo, id: string, o: { canal?: string; pub?: string | null; semVideo?: boolean; saiu?: { em: string; por: string }; cursor?: boolean; ultimaRodadaH?: number } = {}): void {
  const ultima = iso(o.ultimaRodadaH ?? -2)
  m.alvos.push({ id: `a-${id}`, site_id: SITE, tipo: 'concorrente', youtube_video_id: id, rodadas: 40, ultima_rodada_em: ultima, saiu_em: o.saiu?.em ?? null, saiu_por: o.saiu?.por ?? null })
  if (!o.semVideo) m.videos.push({ video_id: id, title: `Video ${id}`, published_at: o.pub === undefined ? iso(-480) : o.pub, competitor_channel_id: o.canal ?? 'ch1' })
  if (o.cursor !== false) m.cursores.push({ site_id: SITE, youtube_video_id: id, avaliado_ate_rodada: 39, avaliado_em: iso(-1), avaliado_motivo: 'ok', validas_titulo: 8, validas_miniatura: 8 })
}
const base = { tipo_troca: 'sequencial', versao_regra: 2, motivo: null, ultima_atualizacao_em: iso(-1) }
function linhaTesteTitulo(id: string): Row {
  return {
    site_id: SITE, youtube_video_id: id, campo: 'titulo', ...base, veredito: 'possivel_teste_youtube', ficou_estado: 'em_andamento',
    trocas: [{ v: 1, ref: 'Titulo A', ultima_vista: iso(-1) }, { v: 2, ref: 'Titulo B', ultima_vista: iso(-1) }],
    ficou: { titulo: 'Titulo B', sumindo: false, janela_teste: { de: iso(-30), ate: iso(-1) }, transicao: null, versoes: [{ v: 1, rodadas_em_w: 4, ultima_vista: iso(-1) }, { v: 2, rodadas_em_w: 4, ultima_vista: iso(-1) }] },
  }
}
function linhaTrocaTitulo(id: string): Row {
  return {
    site_id: SITE, youtube_video_id: id, campo: 'titulo', ...base, veredito: 'troca_observada', ficou_estado: 'estavel',
    trocas: [{ v: 1, ref: 'Titulo A', ultima_vista: iso(-30) }, { v: 2, ref: 'Titulo B', ultima_vista: iso(-1) }],
    ficou: { titulo: 'Titulo B', sumindo: false, janela_teste: null, transicao: { antes: 'Titulo A', de: iso(-30), ate: iso(-24) }, versoes: [{ v: 2, rodadas_em_w: 8, ultima_vista: iso(-1) }] },
  }
}
function linhaTrocaMiniatura(id: string): Row {
  return {
    site_id: SITE, youtube_video_id: id, campo: 'miniatura', ...base, veredito: 'troca_observada', ficou_estado: 'estavel',
    trocas: [{ v: 1, ref: 'x', ultima_vista: iso(-30) }, { v: 2, ref: 'y', ultima_vista: iso(-1) }],
    ficou: { dhash: 'ffffffffffffffff', transicao: { antes: '0000000000000000', de: iso(-30), ate: iso(-24) } },
  }
}

const ligada = (r: RespostaLeitura): Extract<RespostaLeitura, { ligada: true }> => {
  if (!r.ligada) throw new Error('esperava ligada')
  return r
}
const soma = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0)

beforeEach(() => { sentry.captureException.mockClear() })
afterEach(() => { delete process.env.OBS_TROCAS_CONCORRENTE })

describe('lerLeituraDosConcorrentes', () => {
  it('flag off (variável apagada, sem env): desligada, sem itens', async () => {
    delete process.env.OBS_TROCAS_CONCORRENTE
    const { data } = await lerLeituraDosConcorrentes(ctxDe(mundoVazio()), { agoraMs: AGORA })
    expect(data).toEqual({ ligada: false, motivo: 'flag_off', resumo: 'Leitura de concorrentes desligada' })
    expect('itens' in data).toBe(false)
  })

  it('3 alvos (teste, troca, aprendendo): resumo, itens e textos', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTesteTitulo('v1'))
    alvo(m, 'v2'); m.linhas.push(linhaTrocaTitulo('v2'), linhaTrocaMiniatura('v2'))
    alvo(m, 'v3', { pub: iso(-24), cursor: false })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.resumo).toBe('3 vídeos de concorrentes observados: 1 com possível teste em andamento, 0 provavelmente terminados, 1 troca, 1 não medido (aprendendo 1)')
    expect(r.resumo_miniatura).toBe('Miniatura: 1 troca, 0 alternando sem dar para afirmar troca.')
    const titulos = r.itens.filter(i => i.campo === 'titulo')
    expect(titulos).toHaveLength(2)
    expect(titulos[0]!.estado).toBe('em_andamento')
    expect(titulos[0]!.canal).toBe('Canal Um')
    expect(titulos[0]!.titulo_video).toBe('Video v1')
    expect(titulos[0]!.texto).toMatch(/possível/i)
    expect(titulos[0]!.texto).toBe(textoTitulo({
      estado: 'em_andamento', sumindo: false, passagens: 8, desde: iso(-30), ate: iso(-1),
      versoes: [{ ref: 'Titulo A', rodadasEmW: 4, ultimaVista: iso(-1) }, { ref: 'Titulo B', rodadasEmW: 4, ultimaVista: iso(-1) }],
    }, { agoraMs: AGORA, trocaConferida: false }))
    expect(r.itens.filter(i => i.campo === 'miniatura')).toHaveLength(1)
    expect(r.nota).toBe('a contagem é das nossas passagens, não da divisão de público do YouTube')
    expect(r.janela_dias).toBe(14)
  })

  it('1 alvo só: concordância no singular', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTrocaTitulo('v1'))
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.resumo).toBe('1 vídeo de concorrentes observado: 0 com possível teste em andamento, 0 provavelmente terminados, 1 troca, 0 não medidos')
  })

  it('a soma das chaves da contagem é N, por título e por miniatura', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTesteTitulo('v1'))
    alvo(m, 'v2'); m.linhas.push(linhaTrocaTitulo('v2'), linhaTrocaMiniatura('v2'))
    alvo(m, 'v3', { pub: iso(-24), cursor: false })
    alvo(m, 'v4')
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(4)
    expect(soma(r.contagem.miniatura)).toBe(4)
    expect(r.contagem.titulo.sem_troca_vista).toBe(1)
  })

  it('canal com remoção pedida: fora dos itens e de N', async () => {
    const m = mundoVazio()
    m.canais.push({ id: 'ch2', site_id: SITE, channel_name: 'Removido', removal_requested_at: iso(-5) })
    alvo(m, 'v1'); m.linhas.push(linhaTrocaTitulo('v1'))
    alvo(m, 'v2', { canal: 'ch2' }); m.linhas.push(linhaTrocaTitulo('v2'))
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1)
    expect(r.itens.map(i => i.video_id)).toEqual(['v1'])
    expect(r.resumo.startsWith('1 vídeo')).toBe(true)
  })

  it('alvo fora da janela: na lista, fora de N, contado à parte', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTrocaTitulo('v1'))
    alvo(m, 'v9', { saiu: { em: iso(-72), por: 'janela' }, ultimaRodadaH: -72 })
    m.linhas.push({ ...linhaTesteTitulo('v9'), ultima_atualizacao_em: iso(-73) })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1)
    expect(r.fora_da_janela).toBe(1)
    const fora = r.itens.find(i => i.video_id === 'v9')
    expect(fora?.estado).toBe('fora_da_janela')
    expect(fora?.fora_da_observacao).toBe(true)
    expect(fora?.ultimo).toBe('em_andamento')
    expect(fora?.texto).toContain('Fora da observação')
    expect(r.itens[r.itens.length - 1]!.video_id).toBe('v9')
    expect(r.resumo).toBe('1 vídeo de concorrentes observado: 0 com possível teste em andamento, 0 provavelmente terminados, 1 troca, 0 não medidos, mais 1 que já saiu da observação')
  })

  it('sem publicação (published_at nulo ou sem vídeo) entra em N como não medido', async () => {
    const m = mundoVazio()
    alvo(m, 'v1', { pub: null })
    alvo(m, 'v2', { semVideo: true })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.contagem.nao_medido_por_motivo.sem_publicacao).toBe(2)
    expect(soma(r.contagem.titulo)).toBe(2)
    expect(soma(r.contagem.miniatura)).toBe(2)
    expect(r.resumo).toContain('2 não medidos (sem publicação 2)')
  })

  it('alvo que saiu há 15 dias: fora da lista e do campo fora_da_janela; sem rodada fresca, a troca fica só na contagem', async () => {
    const m = mundoVazio()
    alvo(m, 'v8', { saiu: { em: iso(-15 * 24), por: 'janela' }, ultimaRodadaH: -15 * 24 })
    m.linhas.push(linhaTesteTitulo('v8'))
    alvo(m, 'v1', { ultimaRodadaH: -30 })
    m.linhas.push(linhaTrocaTitulo('v1'))
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.itens).toHaveLength(0)
    expect(r.fora_da_janela).toBe(0)
    expect(soma(r.contagem.titulo)).toBe(1)
  })

  it('linha versao_regra 1 é ignorada', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push({ ...linhaTrocaTitulo('v1'), versao_regra: 1 })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.itens).toHaveLength(0)
    expect(r.contagem.titulo.troca).toBe(0)
  })

  it('só do site do contexto', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTrocaTitulo('v1'))
    m.alvos.push({ id: 'a-x', site_id: 'outro', tipo: 'concorrente', youtube_video_id: 'vx', rodadas: 1, ultima_rodada_em: iso(-1), saiu_em: null, saiu_por: null })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1)
  })

  it('erro de banco lança PipelineServiceError 500', async () => {
    for (const t of ['yt_watch_alvos', 'ab_native_obs_cursor', 'ab_native_observados', 'competitor_channels', 'competitor_videos']) {
      const m = mundoVazio()
      alvo(m, 'v1')
      m.erro = t
      await expect(lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).rejects.toMatchObject({ status: 500 })
      await expect(lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).rejects.toBeInstanceOf(PipelineServiceError)
    }
    // dois lançamentos por tabela acima: cada falha vai ao Sentry (Yannis M-2)
    expect(sentry.captureException).toHaveBeenCalledTimes(10)
    expect(sentry.captureException.mock.calls[0]![1]).toMatchObject({ tags: { area: 'leitura_concorrentes' } })
  })

  it('mais de 1000 alvos: pagina de verdade, sem repetir nem perder linha (Phil M-3a)', async () => {
    const m = mundoVazio()
    for (let i = 0; i < 1001; i++) alvo(m, `p${String(i).padStart(4, '0')}`, { cursor: false })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1001)
    expect(r.resumo.startsWith('1001 vídeos')).toBe(true)
  })

  it('passar de 60 páginas lança 500 e nunca devolve lista parcial (Phil M-3a)', async () => {
    const m = mundoVazio()
    m.pagina = () => Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}`, youtube_video_id: `x${i}`, rodadas: 1, ultima_rodada_em: iso(-1), saiu_em: null, saiu_por: null }))
    await expect(lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).rejects.toMatchObject({ status: 500 })
    expect(sentry.captureException).toHaveBeenCalled()
  })

  it('alvo FORA da janela de canal com remoção pedida: nem na lista nem em fora_da_janela (Phil M-3b)', async () => {
    const m = mundoVazio()
    m.canais.push({ id: 'ch2', site_id: SITE, channel_name: 'Removido', removal_requested_at: iso(-5) })
    alvo(m, 'v9', { canal: 'ch2', saiu: { em: iso(-72), por: 'janela' }, ultimaRodadaH: -72 })
    m.linhas.push({ ...linhaTesteTitulo('v9'), ultima_atualizacao_em: iso(-73) })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(r.itens).toHaveLength(0)
    expect(r.fora_da_janela).toBe(0)
    expect(r.resumo).not.toContain('mais')
  })

  it('vídeo em dois canais, o removido primeiro: fica em N com o canal vivo (Yannis M-6)', async () => {
    const m = mundoVazio()
    m.canais.push({ id: 'ch0', site_id: SITE, channel_name: 'Removido', removal_requested_at: iso(-5) })
    alvo(m, 'v1', { canal: 'ch0' }); m.linhas.push(linhaTrocaTitulo('v1'))
    m.videos.push({ video_id: 'v1', title: 'Video v1', published_at: iso(-480), competitor_channel_id: 'ch1' })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1)
    expect(r.itens[0]!.canal).toBe('Canal Um')
  })

  it('saiu por indisponibilidade/removido nos últimos 14 dias: fora de N, contado em saiu_por_outro_motivo e no resumo (Phil M-1)', async () => {
    const m = mundoVazio()
    alvo(m, 'v1'); m.linhas.push(linhaTrocaTitulo('v1'))
    alvo(m, 'v2', { saiu: { em: iso(-48), por: 'indisponivel' } })
    alvo(m, 'v3', { saiu: { em: iso(-48), por: 'removido' } })
    alvo(m, 'v4', { saiu: { em: iso(-15 * 24), por: 'indisponivel' } })
    m.canais.push({ id: 'ch2', site_id: SITE, channel_name: 'Removido', removal_requested_at: iso(-5) })
    alvo(m, 'v5', { canal: 'ch2', saiu: { em: iso(-48), por: 'indisponivel' } })
    const r = ligada((await lerLeituraDosConcorrentes(ctxDe(m), { agoraMs: AGORA, env: ON })).data)
    expect(soma(r.contagem.titulo)).toBe(1)
    expect(r.saiu_por_outro_motivo).toBe(2)
    expect(r.fora_da_janela).toBe(0)
    expect(r.itens.map(i => i.video_id)).toEqual(['v1'])
    expect(r.resumo).toBe('1 vídeo de concorrentes observado: 0 com possível teste em andamento, 0 provavelmente terminados, 1 troca, 0 não medidos, e 2 que saíram por indisponibilidade')
  })

  it('sem consulta com count exact (Yannis M-5a)', async () => {
    const m = mundoVazio()
    alvo(m, 'v1')
    const { sb, consultas } = fakeSb(() => ({ data: [] }))
    await lerLeituraDosConcorrentes({ siteId: SITE, permissions: ['read'], supabase: sb }, { agoraMs: AGORA, env: ON })
    expect(consultas.length).toBeGreaterThan(0)
    expect(consultas.every(c => c.opcoes?.count === undefined)).toBe(true)
  })
})
