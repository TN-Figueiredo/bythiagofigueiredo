// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12 (item 161): o que acontece quando o dado NÃO existe, por tela do registro. A ação roda de verdade sobre o oráculo
 * mutado (sem vídeos, sem nenhuma coleta, sem nenhum canal, sem canal próprio, dado privado vazio/negado/com erro). Regra: o pacote nunca sai "ok"
 * com tudo vazio e calado: ou a ação recusa com motivo (`nao_encontrado`), ou o pacote traz o aviso na primeira linha (vazio ou magro), ou mede.
 * Nenhuma célula vazia, "undefined" ou traço; nenhum `0` solto que não seja "(zero medido)".
 * LIMITE DECLARADO: o caso 1 do plano (apagar as tabelas novas da A5 do BANCO e comparar célula a célula) pede um banco falso que alimente os
 * carregadores reais (`loadObservatory`); este arquivo trabalha sobre o modelo já carregado e NÃO prova esse caso. Ver relatório N3, parte 5.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { a3World } from './a3-fixture'
import { proprioWorld, semVideos, semCanalProprio, mundoSemProprio, type CenarioDados } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const cheio = proprioWorld()
interface Mundo { obs: typeof cheio.obs; canalId: string; ytIds: string[]; dados: typeof cheio.dados }
const st0: { w: Mundo } = { w: cheio }
const W = () => st0.w
const SITE = '00000000-0000-4000-8000-0000000000aa'
const USUARIO = '00000000-0000-4000-8000-0000000000cc'
const EDICAO = Object.defineProperty({}, 'siteId', { value: SITE, enumerable: false }) as LeituraPrivadaDoSite
const OWNS = (): OwnMenu => ({ itens: W().canalId ? [{ id: W().canalId, name: 'Meu', nota: 'n', href: '/x' }] : [], principal: null, listaHref: '/l' })

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
  openChannelPage: async () => ({ siteId: SITE, now: W().obs.NOW, obs: W().obs, canEdit: true, leitura: EDICAO, negativa: null, ownYtIds: W().ytIds, meuCanalLembrado: null, owns: OWNS() } satisfies Partial<ChannelPage> & Record<string, unknown>),
  openObservatoryPage: async () => ({ siteId: SITE, now: W().obs.NOW, rows: {}, obs: W().obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { canUnlock: true, podeEditar: true, legacy: [], bookmarked: new Set<string>() } }),
  lerMeuCanalLembrado: async () => null,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async () => st.acesso,
  lerDadosDoCanal: async () => W().dados,
  lerDadosDoVideo: async () => {
    const { alcance, diario } = W().dados
    if (alcance.acesso !== 'ok') return { acesso: alcance.acesso }
    if (diario.acesso !== 'ok') return { acesso: diario.acesso }
    return { acesso: 'ok', dado: { alcance: alcance.dado, diario: diario.dado } }
  },
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

const proprioVideo = cheio.obs.videos.find((v) => v.ch === cheio.canalId)!
const concVideo = cheio.obs.videos.find((v) => !cheio.obs.channel(v.ch)!.own)!
const concCanal = cheio.obs.channels.find((c) => !c.own)!
const PEDIDOS: Record<TelaId, { id?: string; consulta: string } | null> = {
  canais: { consulta: '' },
  canal: { id: concCanal.id, consulta: '' },
  video: { id: concVideo.id, consulta: '' },
  comparar: { consulta: '' },
  outliers: { consulta: '' },
  insights: { consulta: '' },
  mudancas: { consulta: '' },
  'canal-proprio': { id: cheio.canalId, consulta: '' },
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
const TERCEIROS_CONHECIDOS = [...cheio.obs.videos.map((v) => v.title), ...cheio.obs.channels.map((c) => c.name)].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)
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


import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'

const DADOS_CENARIO = (c: CenarioDados): Mundo => { const m = proprioWorld({ cenario: c }); return { obs: m.obs, canalId: m.canalId, ytIds: m.ytIds, dados: m.dados } }
const semNada = (ds: { channels: unknown[]; videos: unknown[] }): void => { ds.channels.length = 0; ds.videos.length = 0 }

const MUNDOS: Record<string, () => Mundo> = {
  'canal próprio sem vídeos': () => { const m = proprioWorld({ mut: semVideos }); return { obs: m.obs, canalId: m.canalId, ytIds: m.ytIds, dados: m.dados } },
  'sem nenhuma coleta (canais, zero vídeo, zero diário)': () => {
    const m = proprioWorld({ mut: (ds) => { ds.videos.length = 0 }, cenario: 'vazio' })
    return { obs: m.obs, canalId: m.canalId, ytIds: [], dados: m.dados }
  },
  'sem nenhum canal': () => ({ obs: a3World(semNada).obs, canalId: '', ytIds: [], dados: cheio.dados }),
  'sem canal próprio': () => ({ obs: mundoSemProprio(), canalId: '', ytIds: [], dados: cheio.dados }),
  'dado privado vazio': () => DADOS_CENARIO('vazio'),
  'dado privado negado': () => DADOS_CENARIO('negado'),
  'dado privado com erro': () => DADOS_CENARIO('erro'),
}

const TELAS_PEDIDO: Array<{ tela: TelaId; id?: string }> = TELAS_EXISTE.map((tela) => ({ tela, ...(PEDIDOS[tela]?.id ? { id: PEDIDOS[tela]!.id } : {}) }))
beforeEach(() => { modo.ligado = true; st.acesso = { leitura: EDICAO, edita: true, negativa: null }; st0.w = cheio })
afterEach(() => { vi.restoreAllMocks() })

const textoTodo = (p: Pacote): string => p.segmentos.map((s) => s.texto).join('\n')
/** Células da tabela em Markdown que são exatamente `0` (um zero solto, sem "(zero medido)"). */
const ZERO_SOLTO = /\|[ \t]*0[ \t]*(?=\|)/

const RESULTADOS: Record<string, string> = {}
describe('o que acontece quando o dado não existe', () => {
  it('controle: com o mundo cheio a ação responde ok em toda tela (o resto prova algo)', async () => {
    for (const { tela, id } of TELAS_PEDIDO) expect((await gerarPacoteIa({ tela, ...(id ? { id } : {}), consulta: '' })).ok, tela).toBe(true)
  })

  for (const [nome, fazer] of Object.entries(MUNDOS)) {
    describe(nome, () => {
      for (const { tela, id } of TELAS_PEDIDO) {
        it(`${tela}: nunca ok com pacote vazio e calado`, async () => {
          st0.w = fazer()
          const r = await gerarPacoteIa({ tela, ...(id ? { id } : {}), consulta: '' })
          RESULTADOS[`${nome} | ${tela}`] = r.ok ? `ok medidos=${r.pacote.numeros.medidos + r.pacote.numeros.zerosMedidos} nao=${r.pacote.numeros.naoMedidos} vazio=${r.pacote.vazio} aviso=${r.pacote.primeiraLinhaDeAviso ? 'sim' : 'nao'} priv=${r.pacote.privado.estado === 'excluido' ? 'excluido:' + r.pacote.privado.motivo : r.pacote.privado.estado} privMed=${r.pacote.numeros.privadosMedidos}` : r.motivo
          if (!r.ok) { expect(['nao_encontrado', 'falhou']).toContain(r.motivo); return }
          const p = r.pacote
          const total = p.numeros.medidos + p.numeros.zerosMedidos + p.numeros.naoMedidos
          const medidos = p.numeros.medidos + p.numeros.zerosMedidos
          if (medidos === 0) {
            expect(p.primeiraLinhaDeAviso, 'sem nenhum número medido, a primeira linha avisa').toMatch(/^AVISO/)
          } else if (total > 0 && p.numeros.naoMedidos / total >= CONTEXTO_IA_RULES.magroAPartirDe) {
            expect(p.primeiraLinhaDeAviso, 'magro avisa').toMatch(/^AVISO/)
          }
          const texto = textoTodo(p)
          expect(texto).not.toMatch(/undefined|\bNaN\b|\[object/)
          expect(texto).not.toMatch(/\|[ \t]*\|/)
          expect(texto, 'zero solto').not.toMatch(ZERO_SOLTO)
        })
      }
    })
  }

  const pedir = (tela: TelaId) => gerarPacoteIa({ tela, ...(PEDIDOS[tela]?.id ? { id: PEDIDOS[tela]!.id } : {}), consulta: '' })

  it('sem nenhum canal: as telas de lista dizem "não há nada" na primeira linha; as de um canal ou vídeo respondem nao_encontrado (nunca ok vazio)', async () => {
    st0.w = MUNDOS['sem nenhum canal']!()
    for (const tela of ['canais', 'comparar', 'outliers', 'insights', 'mudancas'] as const) {
      const r = await pedir(tela)
      expect(r.ok, tela).toBe(true)
      if (!r.ok) continue
      expect(r.pacote.vazio, tela).toBe(true)
      expect(r.pacote.primeiraLinhaDeAviso, tela).toMatch(/^AVISO: esta tela ainda não tem nenhum número \(/)
    }
    for (const tela of ['canal', 'video', 'canal-proprio', 'video-proprio'] as const) expect(await pedir(tela), tela).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  it('sem canal próprio: as duas telas próprias respondem nao_encontrado e as públicas seguem com dado medido', async () => {
    st0.w = MUNDOS['sem canal próprio']!()
    for (const tela of ['canal-proprio', 'video-proprio'] as const) expect(await pedir(tela), tela).toEqual({ ok: false, motivo: 'nao_encontrado' })
    const r = await pedir('canais')
    expect(r.ok && r.pacote.numeros.medidos > 0).toBe(true)
  })

  it('sem nenhuma coleta: sem vídeo não há tela de vídeo; Canal, Outliers e Mudanças avisam que está vazio', async () => {
    st0.w = MUNDOS['sem nenhuma coleta (canais, zero vídeo, zero diário)']!()
    expect(await pedir('video')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    for (const tela of ['canal', 'outliers', 'mudancas'] as const) {
      const r = await pedir(tela)
      expect(r.ok && r.pacote.vazio && /^AVISO/.test(r.pacote.primeiraLinhaDeAviso ?? ''), tela).toBe(true)
    }
  })

  it('dado privado VAZIO (lido, sem linha): o privado entra (incluido) mas com zero número medido, e as células privadas saem "não medido"', async () => {
    st0.w = MUNDOS['dado privado vazio']!()
    for (const tela of ['canal-proprio', 'video-proprio'] as const) {
      const r = await pedir(tela)
      expect(r.ok, tela).toBe(true)
      if (!r.ok) continue
      expect(r.pacote.privado.estado, tela).toBe('incluido')
      expect(r.pacote.numeros.privadosMedidos, `${tela}: nenhum número privado medido`).toBe(0)
      expect(r.pacote.numeros.naoMedidos, tela).toBeGreaterThan(0)
    }
  })

  it('dado privado NEGADO ou com ERRO: o pacote exclui o privado com o motivo certo, sem tabela privada e sem número privado', async () => {
    for (const [nome, motivo] of [['dado privado negado', 'nao_conferido'], ['dado privado com erro', 'leitura_falhou']] as const) {
      st0.w = MUNDOS[nome]!()
      for (const tela of ['canal-proprio', 'video-proprio'] as const) {
        const r = await pedir(tela)
        expect(r.ok, `${nome} ${tela}`).toBe(true)
        if (!r.ok) continue
        expect(r.pacote.privado, `${nome} ${tela}`).toMatchObject({ estado: 'excluido', motivo })
        expect(r.pacote.numeros.privadosMedidos).toBe(0)
        expect(textoTodo(r.pacote)).not.toContain('(privado do canal)')
      }
    }
  })

  it('controle negativo: o detector de zero solto, de célula vazia e de "undefined" acha cada um num exemplo ruim', () => {
    expect('| Views | 0 | base |').toMatch(ZERO_SOLTO)
    expect('| Views | 0 (zero medido) | base |').not.toMatch(ZERO_SOLTO)
    expect('| Views |  | base |').toMatch(/\|[ \t]*\|/)
    expect('| Views | undefined |').toMatch(/undefined/)
  })

  it('resumo da matriz (informativo)', () => { console.info('MATRIZ', JSON.stringify(RESULTADOS, null, 1)) })
})
