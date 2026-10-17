// @vitest-environment jsdom
// E5a Tarefa C4: "O que o criador respondeu" (célula e bloco). A conta é a M11 da E4; aqui se prova o estado, a frase e a lista.
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { criadorDoCanal, type EntradaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-model'
import { listaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-lista-model'
import { CriadorResponde } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-responde'
import { lerComentariosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/comentarios-do-canal'
import { canalNaoCarregou } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado-async'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { link } from '@/lib/youtube/observatorio/links'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { ContagemDeRespostas, ParteLida, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams('') }))

const DIA = 86_400_000
const AGORA = Date.UTC(2026, 9, 24, 18)
const HOJE = '2026-10-24'
const BASE = { formato: { fmt: 'long' as const, doisFormatos: false, soShorts: false }, agoraMs: AGORA }

const vid = (i: number, idade: number, over: Partial<VideoLido> = {}): VideoLido => ({
  id: `v${i}`, videoId: `v${i}`, publishedAt: new Date(AGORA - idade * DIA).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false,
  isShort: false, durationSeconds: 600, viewCount: 1000, likeCount: 10, commentCount: 5, likesHidden: false, commentsDisabled: false, viewsHidden: false,
  discoveredAt: null, missingSince: null, seriesTier: null, lastCheckedAt: null, ...over,
})
const ok = <T,>(dados: T): ParteLida<T> => ({ lido: true, dados }) as ParteLida<T>
const contagem = (porVideo: Array<[string, string | null, boolean]>, over: Partial<ContagemDeRespostas> = {}): ParteLida<ContagemDeRespostas> => ok({
  porVideo: new Map(porVideo.map(([id, r, c]) => [id, { retrato30: r, algumComRespostaDoCriador: c }])),
  coletaDoSiteDesdeMs: AGORA - 200 * DIA, coletaDoCanalDesdeMs: AGORA - 200 * DIA, ultimoOkDaTarefaMs: AGORA - 3_600_000, primeiraExecucaoDaTarefaMs: AGORA - 200 * DIA, ...over,
})
const ativo = { tipo: 'ativo', pastilha: 'Ativo', base: '', ate: null } as unknown as EntradaDoCriador['estado']
const LONGO = { fmt: 'long' as const, doisFormatos: false, soShorts: false }

function entrada(videos: VideoLido[], c: ParteLida<ContagemDeRespostas> | null, over: Partial<EntradaDoCriador> = {}): EntradaDoCriador {
  return { nome: 'Matt', formato: LONGO, videos, contagem: c, estado: ativo, agoraMs: AGORA, hojeSP: HOJE, ...over }
}
/** n vídeos com 40+ dias, retrato ok; os `k` primeiros com resposta. */
function quadro(n: number, k: number): { videos: VideoLido[]; c: ParteLida<ContagemDeRespostas> } {
  const videos = Array.from({ length: n }, (_, i) => vid(i, 35 + i))
  return { videos, c: contagem(videos.map((v, i) => [v.id, 'ok', i < k])) }
}

describe('criadorDoCanal: sem contradição (trem 5.1)', () => {
  it('vídeos em coleta e nenhum com retrato: nunca "não têm coleta"; diz quantos estão em coleta e quando o primeiro fecha', () => {
    const videos = [vid(1, 5), vid(2, 9), vid(3, 12)]
    const c = contagem(videos.map(v => [v.id, null, false]), { coletaDoSiteDesdeMs: AGORA - 20 * DIA, coletaDoCanalDesdeMs: null })
    const b = criadorDoCanal(entrada(videos, c)).bloco
    expect(b.tipo).toBe('nao_medido')
    expect(b.frase.resto).not.toContain('ainda não têm coleta')
    expect(b.frase.resto).toContain('3 vídeos estão em coleta; o primeiro fecha 30 dias em 11/11.')
    expect(b.semColeta).toBeUndefined()
  })
  it('nenhum vídeo em coleta e nenhum retrato: a frase "não têm coleta" fica e a lista de respostas não aparece', () => {
    const videos = [vid(1, 40), vid(2, 50)]
    const c = contagem(videos.map(v => [v.id, null, false]), { coletaDoSiteDesdeMs: AGORA - 20 * DIA, coletaDoCanalDesdeMs: null })
    const b = criadorDoCanal(entrada(videos, c)).bloco
    expect(b.frase.resto).toContain('ainda não têm coleta de comentários')
    expect(b.semColeta).toBe(true)
    const lista = listaDoCriador({ nome: 'Matt', resposta: ok({ nivel: 'texto', total: 0, itens: [] } as unknown as RespostasDoCriador), videos, titulos: new Map(), nBase: 0 })
    const h = renderToStaticMarkup(<CriadorResponde bloco={b} lista={lista} />)
    expect(h).not.toContain('data-lista-do-criador')
  })
})

describe('criadorDoCanal: a frase só cita números que estão na legenda (C2 do Phil, trem 7)', () => {
  it('1 com retrato de 30 dias, 6 em coleta, 7 anteriores à coleta: 14 vídeos, e a frase não inventa um "2"', () => {
    const videos = [vid(0, 35), ...[3, 4, 5, 6, 7, 8].map((d, i) => vid(1 + i, d)), ...[50, 51, 52, 53, 54, 55, 56].map((d, i) => vid(7 + i, d))]
    const porVideo: Array<[string, string | null, boolean]> = videos.map((v, i) => [v.id, i === 0 ? 'ok' : null, false])
    const c = contagem(porVideo, { coletaDoSiteDesdeMs: AGORA - 9 * DIA, coletaDoCanalDesdeMs: AGORA - 9 * DIA })
    const b = criadorDoCanal(entrada(videos, c)).bloco
    expect(b.tipo).toBe('nao_medido')
    const legenda = b.legenda.map(l => l.texto).join(' | ')
    expect(legenda).toContain('6 em coleta, ainda sem os 30 dias')
    expect(legenda).toContain('7 já tinham mais de 37 dias quando a coleta começou (15/10)')
    expect(b.frase.resto).toMatch(/^ Só 1 dos 14 vídeos dos últimos \d+ dias já tem o retrato de 30 dias; o primeiro dos outros fecha em \d{2}\/\d{2}\.$/)
    // os números da frase (fora a janela e a data) são os da legenda e da base
    const numeros = (b.frase.resto.replace(/dos últimos \d+ dias/, '').replace(/retrato de 30 dias/, '').replace(/\d{2}\/\d{2}/, '').match(/\d+/g) ?? []).map(Number)
    const nosDados = new Set([1, 6, 7, 14])
    for (const n of numeros) expect(nosDados.has(n), `número ${n} sem par na legenda`).toBe(true)
    expect(b.frase.resto).not.toContain('coleta de comentários')
  })
})

describe('criadorDoCanal: sem coleta esconde a lista (D2 do Gio)', () => {
  const vazia = (videos: VideoLido[]) => listaDoCriador({ nome: 'Matt', resposta: ok({ nivel: 'texto', total: 0, itens: [] } as unknown as RespostasDoCriador), videos, titulos: new Map(), nBase: 0 })
  it('coleta que ainda não começou: a lista de respostas não renderiza', () => {
    const { videos } = quadro(6, 0)
    const b = criadorDoCanal(entrada(videos, contagem([], { coletaDoSiteDesdeMs: null, coletaDoCanalDesdeMs: null, ultimoOkDaTarefaMs: null, primeiraExecucaoDaTarefaMs: null }))).bloco
    expect(b.semColeta).toBe(true)
    expect(renderToStaticMarkup(<CriadorResponde bloco={b} lista={vazia(videos)} />)).not.toContain('data-lista-do-criador')
  })
  it('coleta parada: a lista de respostas não renderiza', () => {
    const { videos } = quadro(6, 2)
    const b = criadorDoCanal(entrada(videos, contagem(videos.map(v => [v.id, 'ok', false]), { ultimoOkDaTarefaMs: AGORA - 30 * DIA }))).bloco
    expect(b.semColeta).toBe(true)
    expect(renderToStaticMarkup(<CriadorResponde bloco={b} lista={vazia(videos)} />)).not.toContain('data-lista-do-criador')
  })
})

describe('criadorDoCanal: estados', () => {
  it('nenhum retrato no site: a coleta ainda não começou', () => {
    const { videos } = quadro(6, 0)
    const m = criadorDoCanal(entrada(videos, contagem([], { coletaDoSiteDesdeMs: null, coletaDoCanalDesdeMs: null, ultimoOkDaTarefaMs: null, primeiraExecucaoDaTarefaMs: null })))
    expect(m.celula.valor).toBe('nao_medido')
    expect(m.celula.motivo).toContain('a coleta de comentários ainda não começou')
    expect(m.bloco.frase.resto).toContain('A coleta de comentários ainda não começou')
  })
  it('coleta do canal há 20 dias: "Ainda não dá para medir", com a data em que fecha', () => {
    const videos = [...Array.from({ length: 6 }, (_, i) => vid(i, 5 + i * 3)), vid(7, 60), vid(8, 70)]
    const c = contagem(videos.map(v => [v.id, null, false]), { coletaDoCanalDesdeMs: AGORA - 20 * DIA })
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula.valor).toBe('nao_medido')
    expect(m.bloco.frase.negrito).toBe('Ainda não dá para medir.')
    expect(m.bloco.frase.resto).toMatch(/fecha em \d{2}\/\d{2}/)
  })
  it('item d do Gio (trem 6), refeito no C2: vídeo anterior à coleta mas com retrato de 30 dias é o "1" da frase; nunca "Só 0 dos"', () => {
    const videos = [...Array.from({ length: 6 }, (_, i) => vid(i, 5 + i * 3)), vid(7, 60), vid(8, 70)]
    const c = contagem(videos.map(v => [v.id, v.id === 'v7' ? 'ok' : null, false]), { coletaDoCanalDesdeMs: AGORA - 20 * DIA })
    const b = criadorDoCanal(entrada(videos, c)).bloco
    expect(b.legenda.map(l => l.texto).join('|')).toContain('1 vídeo em que não vimos resposta')
    expect(b.frase.resto).toContain('Só 1 dos 8 vídeos')
    expect(b.frase.resto).not.toContain('Só 0 dos')
  })
  it('coleta parada', () => {
    const { videos, c } = quadro(6, 2)
    const parada = contagem(videos.map(v => [v.id, 'ok', false]), { ultimoOkDaTarefaMs: AGORA - 30 * DIA })
    const m = criadorDoCanal(entrada(videos, parada))
    expect(m.celula.motivo).toBe('não medido: a coleta de comentários está parada')
    void c
  })
  it('3 vídeos: pede pelo menos 5', () => {
    const { videos, c } = quadro(3, 1)
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula.valor).toBe('nao_medido')
    expect(m.bloco.frase.resto).toContain('pelo menos 5')
  })
  it('poucos vídeos com N=1: verbo no singular na frase e na célula (Gio CO, trem 7)', () => {
    const { videos, c } = quadro(1, 0)
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.bloco.frase.resto).toContain('Só 1 dos 1 vídeos tem retrato de 30 dias')
    expect(m.celula.motivo).toContain('só 1 de 1 vídeos tem retrato')
    const dois = criadorDoCanal(entrada(...Object.values(quadro(2, 0)) as [VideoLido[], ParteLida<ContagemDeRespostas>]))
    expect(dois.bloco.frase.resto).toContain('Só 2 dos 2 vídeos têm retrato')
  })
  it('desligados pelo canal', () => {
    const videos = Array.from({ length: 6 }, (_, i) => vid(i, 35 + i))
    const m = criadorDoCanal(entrada(videos, contagem(videos.map(v => [v.id, 'desligados', false]))))
    expect(m.bloco.tipo).toBe('desligados')
    expect(m.celula.valor).toBe('nao_medido')
  })
  it('a leitura falhou: não carregou, nunca "0 de 0"', () => {
    const { videos } = quadro(6, 2)
    for (const c of [{ lido: false, causa: 'erro_do_banco' } as ParteLida<ContagemDeRespostas>, null]) {
      const m = criadorDoCanal(entrada(videos, c))
      expect(m.celula.valor).toBe('nao_carregou')
      expect(m.bloco.tipo).toBe('nao_carregou')
      expect(JSON.stringify(m)).not.toMatch(/0 de 0/)
    }
    expect(criadorDoCanal(entrada(null as unknown as VideoLido[], null)).celula.valor).toBe('nao_carregou')
  })
  it('o canal saiu do YouTube', () => {
    const { videos, c } = quadro(6, 2)
    const m = criadorDoCanal(entrada(videos, c, { estado: { tipo: 'saiu', pastilha: 'x', base: '', ate: null } as unknown as EntradaDoCriador['estado'] }))
    expect(m.bloco.tipo).toBe('fora')
  })
})

describe('criadorDoCanal: a conta', () => {
  it('5 de 14 = 36%', () => {
    const { videos, c } = quadro(14, 5)
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula).toMatchObject({ valor: 'medido', k: 5, n: 14, pct: 36 })
    expect(m.bloco.frase.negrito).toContain('5 de 14')
    expect(m.bloco.frase.negrito).toContain('(36%)')
  })
  it('0 de 16: zero medido, caixa vazada, "(0%)"', () => {
    const { videos, c } = quadro(16, 0)
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula).toMatchObject({ valor: 'zero', k: 0, n: 16, pct: 0 })
    expect(m.bloco.tipo).toBe('zero')
    expect(m.bloco.frase.negrito).toContain('em nenhum dos 16 vídeos')
    expect(m.bloco.frase.resto).toContain('zero medido')
  })
  it('5 de 9: sem percentual', () => {
    const { videos, c } = quadro(9, 5)
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula).toMatchObject({ valor: 'medido', k: 5, n: 9, pct: null })
    expect(m.bloco.frase.negrito).not.toContain('%')
  })
  it('vídeo sem retrato de 30 dias fica fora do denominador e vira casa hachurada', () => {
    const { videos } = quadro(7, 3)
    const c = contagem(videos.map((v, i) => [v.id, i === 6 ? 'falhou' : 'ok', i < 3]))
    const m = criadorDoCanal(entrada(videos, c))
    expect(m.celula.n).toBe(6)
    expect(m.bloco.casas.filter(x => x === 'sem_retrato')).toHaveLength(1)
    expect(m.bloco.casas).toHaveLength(7)
  })
  it('vídeo recente (menos de 30 dias) é "espera", pontilhado, fora da conta', () => {
    const { videos } = quadro(6, 2)
    const novo = vid(99, 4)
    const m = criadorDoCanal(entrada([...videos, novo], contagem([...videos.map(v => [v.id, 'ok', false] as [string, string, boolean]), [novo.id, null, false]])))
    expect(m.bloco.casas.filter(x => x === 'espera')).toHaveLength(1)
    expect(m.celula.n).toBe(6)
  })
  it('nunca escreve "não respondeu"', () => {
    for (const [n, k] of [[14, 5], [16, 0], [9, 5], [3, 1]]) {
      const { videos, c } = quadro(n, k)
      const m = criadorDoCanal(entrada(videos, c))
      expect(JSON.stringify(m).toLowerCase()).not.toMatch(/n[ãa]o respondeu/)
    }
  })
})

const resp = (over: Partial<RespostasDoCriador> = {}): ParteLida<RespostasDoCriador> => ok({
  nivel: 'texto', total: 2, itens: [
    { videoId: 'v0', texto: 'ótimo @ana', cortado: false, respostaTexto: 'valeu @…', respostaCortada: false, curtidas: 12, marco: 7, mencoesTrocadas: 2 },
    { videoId: 'v1', texto: 'um', cortado: true, respostaTexto: 'dois', respostaCortada: false, curtidas: null, marco: null, mencoesTrocadas: 0 },
  ], ...over,
})

describe('a lista', () => {
  const titulos = new Map([['v0', 'Vídeo zero'], ['v1', 'Vídeo um']])
  const videos = [vid(0, 40), vid(1, 35)]
  it('o vídeo mais recente primeiro, com título', () => {
    const l = listaDoCriador({ nome: 'Matt', resposta: resp(), videos, titulos, nBase: 6 })
    expect(l.tipo).toBe('itens')
    if (l.tipo === 'itens') expect(l.itens.map(i => i.videoId)).toEqual(['v1', 'v0'])
  })
  it('nível contagem: só o número e a frase de quem vê só a contagem, sem texto', () => {
    const l = listaDoCriador({ nome: 'Matt', resposta: resp({ nivel: 'contagem', itens: [] }), videos, titulos, nBase: 6 })
    expect(l.tipo).toBe('contagem')
    const html = renderToStaticMarkup(<CriadorResponde bloco={criadorDoCanal(entrada(...Object.values(quadro(14, 5)) as [VideoLido[], ParteLida<ContagemDeRespostas>])).bloco} lista={l} />)
    expect(html).toContain('Você vê o número, não o texto.')
    expect(html).not.toContain('ótimo')
  })
  it('nível contagem com zero respostas: nunca "respondeu a 0 comentários" ao lado de "Não vimos resposta"', () => {
    const l = listaDoCriador({ nome: 'Matt', resposta: resp({ nivel: 'contagem', total: 0, itens: [] }), videos, titulos, nBase: 6 })
    expect(l.tipo).toBe('contagem')
    if (l.tipo === 'contagem') {
      const t = l.frase.negrito + l.frase.resto
      expect(t).not.toMatch(/respondeu a 0/)
      expect(t).toContain('Nenhuma resposta dele nos comentários guardados até agora.')
      expect(t).toContain('ele pode ter respondido a outros')
    }
    const um = listaDoCriador({ nome: 'Matt', resposta: resp({ nivel: 'contagem', total: 1, itens: [] }), videos, titulos, nBase: 6 })
    if (um.tipo === 'contagem') expect(um.frase.negrito).toBe('Matt respondeu a 1 comentário guardados.'.replace('guardados', 'guardado'))
  })
  it('lista falhou: não carregou', () => {
    expect(listaDoCriador({ nome: 'M', resposta: { lido: false, causa: 'erro_do_banco' } as ParteLida<RespostasDoCriador>, videos, titulos, nBase: 6 }).tipo).toBe('nao_carregou')
  })
  it('sem nome de autor, texto com dir=auto, menção "@…", ligação ao Histórico, nunca "não respondeu"', () => {
    const { videos: vs, c } = quadro(14, 5)
    const bloco = criadorDoCanal(entrada(vs, c)).bloco
    const l = listaDoCriador({ nome: 'Matt', resposta: resp(), videos, titulos, nBase: bloco.nBase })
    const html = renderToStaticMarkup(<CriadorResponde bloco={bloco} lista={l} canalId="c1" />)
    expect(html).toContain(link.historico('v1', { from: 'canais', canal: 'c1' }).replace(/&/g, '&amp;'))
    expect(html).toContain('dir="auto"')
    expect(html).toContain('@…')
    expect(html.toLowerCase()).not.toMatch(/n[ãa]o respondeu/)
    expect(html).not.toMatch(/author|display_name|autor:/i)
    expect(html).toContain('id="criador"')
  })
  it('as casas do bloco têm os mesmos vídeos da conta', () => {
    const { videos: vs, c } = quadro(14, 5)
    const b = criadorDoCanal(entrada(vs, c)).bloco
    expect(b.casas.filter(x => x === 'com' || x === 'sem')).toHaveLength(14)
    expect(b.casas.filter(x => x === 'com')).toHaveLength(5)
  })
})

describe('lerComentariosDoCanal', () => {
  const inteiro = (lido: boolean): CanalInteiro => ({ ...canalNaoCarregou(), videos: lido ? { lido: true, dados: [vid(0, 40)] } : { lido: false, causa: 'erro_do_banco' } })
  const linhas = (): Record<string, Linha[]> => ({ competitor_video_comment_snaps: [], competitor_video_comments: [], competitor_video_comment_marks: [], competitor_agenda_runs: [] })
  it('se os vídeos do canal não foram lidos (canal de outro site), zero consultas', async () => {
    const f = falsoComentarios(linhas())
    const p = Promise.resolve(inteiro(false))
    const r = await lerComentariosDoCanal(p, inteiro(false), { siteId: 's', channelId: 'c', nome: 'n', provas: null }, BASE, () => f.client)
    expect(f.pedidos).toHaveLength(0)
    expect(r.contagem).toBeNull()
  })
  it('com os vídeos lidos, lê uma vez por promessa', async () => {
    const f = falsoComentarios(linhas())
    const c = inteiro(true)
    const p = Promise.resolve(c)
    await lerComentariosDoCanal(p, c, { siteId: 's', channelId: 'c', nome: 'n', provas: null }, BASE, () => f.client)
    const n = f.pedidos.length
    expect(n).toBeGreaterThan(0)
    await lerComentariosDoCanal(p, c, { siteId: 's', channelId: 'c', nome: 'n', provas: null }, BASE, () => f.client)
    expect(f.pedidos).toHaveLength(n)
  })
})

// ───── trem 5: consertos do portão da C4 (Phil e Yannis I1 e I2, menores) e do Gio (defeito 3) ─────
describe('I2: "anterior à coleta" usa o começo da coleta do SITE', () => {
  it('site desde 120 dias, canal desde 40: vídeo de 60 dias sem retrato é "sem retrato", não "anterior"', () => {
    const { videos } = quadro(6, 2)
    const sem = vid(50, 60)
    const c = contagem([...videos.map(v => [v.id, 'ok', false] as [string, string, boolean]), [sem.id, null, false]], { coletaDoSiteDesdeMs: AGORA - 120 * DIA, coletaDoCanalDesdeMs: AGORA - 40 * DIA })
    const m = criadorDoCanal(entrada([...videos, sem], c))
    const textos = m.bloco.legenda.map(l => l.texto).join(' | ')
    expect(textos).toContain('sem retrato de 30 dias')
    expect(textos).not.toContain('anterior')
  })
  it('vídeo publicado antes da coleta do site: "já tinha mais de 37 dias quando a coleta começou (data)" com a data do site', () => {
    const { videos } = quadro(6, 2)
    const velho = vid(51, 80)
    const c = contagem([...videos.map(v => [v.id, 'ok', false] as [string, string, boolean]), [velho.id, null, false]], { coletaDoSiteDesdeMs: AGORA - 50 * DIA, coletaDoCanalDesdeMs: AGORA - 40 * DIA })
    const m = criadorDoCanal(entrada([...videos, velho], c))
    const l = m.bloco.legenda.find(x => x.texto.includes('quando a coleta começou'))
    expect(l?.texto).toMatch(/^1 já tinha mais de 37 dias quando a coleta começou \(\d{2}\/\d{2}\)$/)
    expect(l?.texto).toContain(new Date(AGORA - 50 * DIA).toISOString().slice(8, 10))
  })
})

describe('menores da C4', () => {
  const titulos = new Map<string, string>()
  const videos = [vid(0, 40)]
  it('permissão não conferida no nível contagem: a frase da C3, não "falta de direito"', () => {
    const l = listaDoCriador({ nome: 'M', resposta: resp({ nivel: 'contagem', itens: [] }), videos, titulos, nBase: 6, permissaoFalhou: true })
    const { quadroBloco } = { quadroBloco: criadorDoCanal(entrada(...Object.values(quadro(14, 5)) as [VideoLido[], ParteLida<ContagemDeRespostas>])).bloco }
    const html = renderToStaticMarkup(<CriadorResponde bloco={quadroBloco} lista={l} />)
    expect(html).toContain('Não deu para conferir a sua permissão agora')
    expect(html).not.toContain('Você vê o número')
  })
  it('o aviso do nível contagem é negrito + resto, sem partir a frase por ponto', () => {
    const l = listaDoCriador({ nome: 'M', resposta: resp({ nivel: 'contagem', itens: [] }), videos, titulos, nBase: 6 })
    expect(l.tipo === 'contagem' ? l.aviso.negrito : '').toBe('Você vê o número, não o texto.')
  })
  it('o ⓘ puxa 10 e 5 de MEASURE_RULES.comments', () => {
    const { videos: vs, c } = quadro(14, 5)
    const html = renderToStaticMarkup(<CriadorResponde bloco={criadorDoCanal(entrada(vs, c)).bloco} lista={null} />)
    expect(html).toContain(`Percentual só com ${MEASURE_RULES.comments.pctFromN} vídeos ou mais; menos de ${MEASURE_RULES.comments.minVideos}`)
  })
  it('canal diferente do tamanho dos inscritos: nenhuma frase fixa de "10 milhões" na página do canal', () => {
    const { videos: vs, c } = quadro(14, 5)
    const html = renderToStaticMarkup(<CriadorResponde bloco={criadorDoCanal(entrada(vs, c)).bloco} lista={null} />)
    expect(html).not.toContain('10 milhões')
  })
  it('CanalView não tem campo de comentário nem de criador (a lista é de servidor, fora do modelo da página)', () => {
    const dir = 'src/app/cms/(authed)/youtube/competitors/_canal'
    for (const f of ['view-model.ts', 'header-model.ts', 'videos-model.ts', 'trocas-model.ts']) {
      const src = readFileSync(`${dir}/${f}`, 'utf8')
      expect(src, f).not.toMatch(/criador-|comentarios-do-canal|comentarios\/|RespostasDoCriador|ComentariosDoCanal/i)
    }
  })
})
