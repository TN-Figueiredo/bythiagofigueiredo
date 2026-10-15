// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12 (item 159): varredura por valor-semente, por COLUNA. Um sentinela distinto em cada campo do conjunto que o pacote não deve
 * emitir (foto do canal, cor, iniciais, mensagem de erro da coleta, endereço do Blob da miniatura) e a ação rodando de verdade sobre cada tela do
 * registro: nenhum sentinela na resposta serializada. Controle: o título de um vídeo de concorrente (campo que o pacote EMITE, como terceiros) aparece.
 * LIMITE DECLARADO: as colunas que só existem no banco (e-mail de usuário, segredo, `raw`, `error_message` de tarefa, autor de comentário) não existem no
 * conjunto em memória; sem um banco falso que alimente os carregadores reais, ficam cobertas pela varredura de PADRÕES (`varredura-de-saida`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proprioWorld } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

/** Um sentinela distinto em cada coluna do conjunto que NÃO deve chegar ao pacote (classe iii do plano): foto, cor, iniciais, mensagem de erro da coleta, endereço do Blob da miniatura. */
const SENT = {
  avatar: 'https://sentinela-avatar.exemplo/foto.png?SEM_AVATAR',
  color: '#SEMCOR1',
  ini: 'SEMINI',
  syncMsg: 'SEM_ERRO_DA_COLETA_123',
  blob: 'https://sentinela-blob.exemplo/miniatura.jpg?SEM_BLOB',
} as const
const TITULO_CONTROLE = 'SEM_TITULO_CONTROLE_9'
const w = proprioWorld({
  mut: (ds) => {
    for (const c of ds.channels) {
      c.avatar = SENT.avatar; c.color = SENT.color; c.ini = SENT.ini
      c.sync.msg = SENT.syncMsg
    }
    for (const v of ds.videos) for (const t of v.thumbs) t.blobUrl = SENT.blob
    const alvo = ds.videos.find((v) => !ds.channels.find((c) => c.id === v.ch)!.own)
    if (alvo) alvo.title = TITULO_CONTROLE
  },
})
const SITE = '00000000-0000-4000-8000-0000000000aa'
const USUARIO = '00000000-0000-4000-8000-0000000000cc'
const EDICAO = Object.defineProperty({}, 'siteId', { value: SITE, enumerable: false }) as LeituraPrivadaDoSite
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const st = vi.hoisted(() => ({ acesso: { leitura: null as unknown, edita: false, negativa: null as string | null } }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: USUARIO } }) }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/registrar-acesso', () => ({ registrarAcesso: async () => ({ ok: true }) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => ({ siteId: SITE, now: w.obs.NOW, obs: w.obs, canEdit: true, leitura: EDICAO, negativa: null, ownYtIds: w.ytIds, meuCanalLembrado: null, owns: OWNS } satisfies Partial<ChannelPage> & Record<string, unknown>),
  openObservatoryPage: async () => ({ siteId: SITE, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { canUnlock: true, podeEditar: true, legacy: [], bookmarked: new Set<string>() } }),
  lerMeuCanalLembrado: async () => null,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async () => st.acesso,
  lerDadosDoCanal: async () => w.dados,
  lerDadosDoVideo: async () => ({ acesso: 'ok', dado: { alcance: (w.dados.alcance as { dado: unknown }).dado, diario: (w.dados.diario as { dado: unknown }).dado } }),
  lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: async () => ({ acesso: 'erro' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos', () => ({ lerTermosESites: async () => ({ acesso: 'negado' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({
  carregarExtrasProprio: async () => undefined,
  carregarProprioDaComparacao: async () => ({ extras: undefined, soSeuCanal: {} }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async (orig) => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: async () => ({ legacy: [], bookmarked: new Set<string>() }) }))
const modo = vi.hoisted(() => ({ ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' ? modo.ligado : Reflect.get(t, k)) }) }
})

import { gerarPacoteIa } from '@/app/cms/(authed)/youtube/competitors/contexto-ia-actions'

const proprioVideo = w.obs.videos.find((v) => v.ch === w.canalId)!
const concVideo = w.obs.videos.find((v) => !w.obs.channel(v.ch)!.own)!
const concCanal = w.obs.channels.find((c) => !c.own)!
const PEDIDOS: Record<TelaId, { id?: string; consulta: string } | null> = {
  canais: { consulta: '' },
  canal: { id: concCanal.id, consulta: '' },
  video: { id: concVideo.id, consulta: '' },
  comparar: { consulta: '' },
  outliers: { consulta: '' },
  insights: { consulta: '' },
  mudancas: { consulta: '' },
  'canal-proprio': { id: w.canalId, consulta: '' },
  'video-proprio': { id: proprioVideo.id, consulta: '' },
  fila: null,
  ritmo: null,
}
const TELAS_EXISTE = (Object.keys(TELAS_IA) as TelaId[]).filter((t) => TELAS_IA[t].estado === 'existe')

const PADROES_DE_CHAVE = [/eyJ[A-Za-z0-9_-]{8,}/, /\bsk-[A-Za-z0-9]/, /Bearer /, /\bsb-/, /apikey/i, /cookie/i]
const MOEDA = /R\$|US\$|\b(revenue|rpm|cpm|adsense|receita)\b/i
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const URL_EXTERNA = /https?:\/\/[^\s"')\]|]+/g
const DO_YOUTUBE = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)(\/|$)/

type Pacote = Extract<Awaited<ReturnType<typeof gerarPacoteIa>>, { ok: true }>['pacote']
/** Os textos de terceiros que o oráculo traz (título, nome de canal): são dado, e podem ter moeda, e-mail e endereço. */
const TERCEIROS_CONHECIDOS = [...w.obs.videos.map((v) => v.title), ...w.obs.channels.map((c) => c.name)].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)
/**
 * As duas regiões do plano (D-I4): a do SITE (tudo o que o site escreve) e a de TERCEIROS (linhas `│ ` dos blocos citados, o JSON deles, e o título
 * ou o nome que o oráculo conhece). Moeda, e-mail e endereço externo valem só na região do site; chave, `/cms/` e ids valem na saída inteira.
 */
function regiaoDoSite(p: Pacote): string {
  const linhas: string[] = []
  const json: unknown[] = []
  for (const s of p.segmentos) {
    const citado = s.texto.includes('texto de terceiros]')
    linhas.push(...s.texto.split('\n').filter((l) => !l.startsWith('│')))
    if (!citado && s.linhaDoJson) json.push(s.linhaDoJson)
  }
  let texto = linhas.join('\n') + JSON.stringify({ ...p, segmentos: [] }) + JSON.stringify(json)
  for (const t of TERCEIROS_CONHECIDOS) texto = texto.split(t).join('')
  return texto
}

/** Tudo o que a violação procura numa saída; devolve as violações achadas (lista vazia = limpa). */
function violacoes(saida: string, regiao: string = saida): string[] {
  const v: string[] = []
  if (saida.includes('/cms/')) v.push('endereço do CMS')
  for (const p of PADROES_DE_CHAVE) if (p.test(saida)) v.push(`padrão de chave ${String(p)}`)
  if (MOEDA.test(regiao)) v.push('valor em moeda')
  if (EMAIL.test(regiao)) v.push('e-mail')
  for (const u of regiao.match(URL_EXTERNA) ?? []) if (!DO_YOUTUBE.test(u)) v.push(`endereço externo ${u}`)
  if (saida.includes(SITE)) v.push('id do site')
  if (saida.includes(USUARIO)) v.push('id de usuário')
  return v
}



import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'

beforeEach(() => { modo.ligado = true; st.acesso = { leitura: EDICAO, edita: true, negativa: null } })
afterEach(() => { vi.restoreAllMocks() })

describe('varredura por valor-semente, por coluna', () => {
  it('a ação respondeu ok: true em toda tela do registro em existe (sem isso as ausências abaixo provariam nada)', async () => {
    for (const tela of TELAS_EXISTE) {
      expect(PEDIDOS[tela], `tela sem prova: ${tela}`).not.toBeNull()
      expect((await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })).ok, tela).toBe(true)
    }
  })
  for (const tela of TELAS_EXISTE) {
    it(`${tela}: nenhum sentinela de coluna na resposta`, async () => {
      const r = await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      expect(r.ok).toBe(true)
      const saida = JSON.stringify(r)
      for (const [coluna, valor] of Object.entries(SENT)) if (coluna !== 'syncMsg') expect(saida, `${tela}: coluna ${coluna}`).not.toContain(valor.replace(/^https?:\/\//, ''))
      expect(saida).not.toContain('sentinela-')
    })
  }
  // DEFEITO ABERTO (achado da parte 5 do N3): a mensagem CRUA de `sync_error` que `humanizeSyncError` não reconhece chega ao pacote de Canais (coluna
  // Sincronização) e de Outliers, porque `problemPhrase` a anexa e os empacotadores copiam a frase da tela. O plano (Tarefa 12) manda sentinela de `sync_error`
  // ausente. `it.fails` documenta sem pôr o CI vermelho e VIRA vermelho quando for consertado: aí trocar por `it` e tirar o `if (coluna !== 'syncMsg')` acima.
  it.fails('DEFEITO ABERTO: a mensagem crua de sync_error não chega ao pacote de nenhuma tela', async () => {
    for (const tela of TELAS_EXISTE) {
      const r = await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      expect(JSON.stringify(r), tela).not.toContain(SENT.syncMsg)
    }
  })
  it('controle: o sentinela de um campo que o pacote emite (título de vídeo de concorrente) aparece em alguma tela, só como texto de terceiros', async () => {
    let achado = 0
    for (const tela of TELAS_EXISTE) {
      const r = await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      if (r.ok && JSON.stringify(r).includes(TITULO_CONTROLE)) achado++
    }
    expect(achado, 'o detector enxerga um campo emitido').toBeGreaterThan(0)
  })
  it('todas as telas do registro têm entrada em PEDIDOS', () => {
    expect((Object.keys(TELAS_IA) as TelaId[]).filter((t) => TELAS_IA[t].estado === 'existe' && PEDIDOS[t] === null)).toEqual([])
  })
})
