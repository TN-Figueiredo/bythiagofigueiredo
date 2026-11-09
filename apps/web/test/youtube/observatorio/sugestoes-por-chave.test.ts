// @vitest-environment node
/**
 * E17 degrau 2, M-2 (Yannis): `sugestoes` lida pela chave. O site é o da PROVA (que o abridor repassa), sem guarda de sessão; o acesso privado é o da chave
 * (`edita` sempre falso). O tráfego privado só entra com o direito; sem ele sai excluído com a frase, nunca some calado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ chamadas: [] as unknown[][], lista: null as unknown, calculoLigado: true, falha: null as Error | null, carregou: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => { throw new Error('guarda de sessão não pode rodar por chave') }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn(async () => { throw new Error('getSiteContext não pode rodar por chave') }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  carregarObservatorio: h.carregou, carregarCanal: h.carregou, openObservatoryPage: h.carregou, openChannelPage: h.carregou,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ marca: 'cliente-de-servico' }) }))
vi.mock('@/lib/youtube/observatorio/sinais/leitura', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/sinais/leitura')>()),
  calculoLigadoNoAmbiente: () => h.calculoLigado,
  listarSinaisDoNicho: vi.fn(async (...a: unknown[]) => { h.chamadas.push(a); if (h.falha) throw h.falha; return h.lista }),
}))

import { montarSugestoes } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/montar'
import { EMPACOTAR } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { abridorDaChave } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave'
import { FRASES_DA_FERRAMENTA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import type { Abridor } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'

const SITE = 'site-da-prova'
const OUTRO = 'site-de-sessao'
const item = (motivo: 'sem_direito' | null): ItemDeSinal => ({
  id: 'aaaaaaaa-0000-4000-8000-000000000001', kind: 'destino', subject_key: 'pais:BR', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'video_novo', forca: 12.5,
  motivo: 'dois canais estouraram no mesmo lugar nos últimos 14 dias', rule_version: 'sinais-v1+semente-1',
  evidence: { outliers: [{ video_id: '00000000-0000-4000-8000-000000000001', canal_id: '11111111-0000-4000-8000-000000000000', published_at: '2026-10-20T12:00:00Z', mult_vpd7: 12.3, mult_tela: 4.5, vpd7: 1234.5, formato: 'long' }], outliers_total: 3, canais: 3, proprios: [] },
  first_seen_at: '2026-10-20T12:00:00Z', expires_at: '2026-11-19T12:00:00Z', adiada_em: null, proprios_agora: [], proprios_agora_n: 0,
  trafego_do_terceiro: motivo
    ? { estado: 'nao_medido', motivo, terceiro_video_id: 'cccccccc-0000-4000-8000-000000000001', videos_com_trafego: 0, videos_medidos: 0, videos_total: 2, views: null, ate: null, desde: '2026-10-20', coberto_ate: null, regra: 'f4-trafego-v1' }
    : { estado: 'nao', motivo: null, terceiro_video_id: 'cccccccc-0000-4000-8000-000000000001', videos_com_trafego: 0, videos_medidos: 2, videos_total: 2, views: null, ate: '2026-10-27', desde: '2026-10-20', coberto_ate: '2026-10-28', regra: 'f4-trafego-v1' },
})
const lista = (itens: ItemDeSinal[], o: Partial<ListaDeSinais> = {}): ListaDeSinais => ({ n: itens.length, itens, computado_em: '2026-10-24T10:00:00Z', desatualizado: false, motivoVazio: null, contagens: { canais_total: 5, outliers_total: 8, proprios: 3 }, calculoLigado: true, ...o })

const abridorFalso = (acesso: AcessoPrivado): Abridor & { pedidos: string[] } => {
  const pedidos: string[] = []
  return {
    pedidos,
    observatorio: (async (extra?: (s: string) => Promise<unknown>) => ({ siteId: SITE, extra: extra ? await extra(SITE) : undefined })) as unknown as Abridor['observatorio'],
    doSite: (ler) => ler(SITE),
    canal: (async () => { throw new Error('não usado') }) as unknown as Abridor['canal'],
    acessoPrivado: async (s) => { pedidos.push(s); return acesso },
  }
}
const SEM: AcessoPrivado = { leitura: null, edita: false, negativa: 'sem_direito' }
const COM = { leitura: { marca: 'leitura-valida' }, edita: false, negativa: null } as unknown as AcessoPrivado

beforeEach(() => { h.chamadas.length = 0; h.lista = null; h.calculoLigado = true; h.falha = null; h.carregou.mockReset() })

describe('sugestões pela chave (M-2)', () => {
  it('lê o site da PROVA, sem guarda de sessão, e o acesso passado à lista é o da chave com edita falso', async () => {
    h.lista = lista([item(null)])
    const abrir = abridorFalso(COM)
    const p = await montarSugestoes(abrir)
    expect(p).not.toBeNull()
    expect(h.chamadas).toHaveLength(1)
    expect(h.chamadas[0]![1]).toBe(SITE)
    expect(h.chamadas[0]![1]).not.toBe(OUTRO)
    expect(abrir.pedidos).toEqual([SITE])
    expect(h.chamadas[0]![5]).toMatchObject({ edita: false, leitura: COM.leitura })
  })

  it('edita:true vindo do abridor nunca chega à lista', async () => {
    h.lista = lista([item(null)])
    await montarSugestoes(abridorFalso({ ...COM, edita: true }))
    expect((h.chamadas[0]![5] as AcessoPrivado).edita).toBe(false)
  })

  it('com direito: o tráfego privado entra; sem direito: a lista sai e o tráfego vem excluído por sem_direito', async () => {
    h.lista = lista([item(null)])
    const com = await montarSugestoes(abridorFalso(COM))
    expect(com!.modelo.tabelas.some((t) => t.id === 'sugestoes-trafego')).toBe(true)
    expect(com!.modelo.privado.estado).toBe('incluido')
    h.lista = lista([item('sem_direito')])
    const sem = await montarSugestoes(abridorFalso(SEM))
    expect(sem!.modelo.tabelas.some((t) => t.id === 'sugestoes-trafego')).toBe(false)
    expect(sem!.modelo.tabelas.length).toBeGreaterThan(0)
    expect(sem!.modelo.privado).toMatchObject({ estado: 'excluido', motivo: 'sem_direito' })
    expect(h.chamadas[1]![5]).toMatchObject({ leitura: null, negativa: 'sem_direito' })
  })

  it('cálculo desligado / lista vazia: a frase do vazio, nunca um pacote mudo', async () => {
    h.calculoLigado = false
    h.lista = lista([], { n: 0, motivoVazio: 'calculo_desligado', calculoLigado: false, computado_em: null, contagens: {} })
    const p = await montarSugestoes(abridorFalso(SEM))
    expect(p).not.toBeNull()
    expect(p!.modelo.vazio).toBeTruthy()
    expect(h.chamadas[0]![4]).toBe(false)
  })

  it('responder pela chave: desfecho ok com dado; não é nao_encontrado', async () => {
    h.lista = lista([item(null)])
    const r = await responder({ acao: 'sugestoes' }, abridorFalso(COM), Date.now())
    expect(r.desfecho).toBe('ok')
    expect(r.texto.length).toBeGreaterThan(0)
  })

  it('o empacotador por chave não devolve null (antes devolvia)', async () => {
    h.lista = lista([item(null)])
    expect(await EMPACOTAR.sugestoes({ sp: {} }, abridorFalso(SEM))).not.toBeNull()
  })

  it('I-1: pela chave NÃO carrega o conjunto do Observatório, só lê as sugestões do site da prova', async () => {
    h.lista = lista([item(null)])
    const prova = fabricarProva(SITE, 'pessoa-1', 'chave-1', new Date(Date.now() + 30 * 86_400_000).toISOString())
    const r = await responder({ acao: 'sugestoes' }, abridorDaChave(prova, COM), Date.now())
    expect(r.desfecho).toBe('ok')
    expect(h.carregou).not.toHaveBeenCalled()
    expect(h.chamadas).toHaveLength(1)
    expect(h.chamadas[0]![1]).toBe(SITE)
    expect(h.chamadas[0]![5]).toMatchObject({ edita: false })
  })

  it('M-A: a leitura das sugestões falhar dá falhou (nunca verde nem nao_encontrado)', async () => {
    h.falha = new Error('x')
    const prova = fabricarProva(SITE, 'pessoa-1', 'chave-1', new Date(Date.now() + 30 * 86_400_000).toISOString())
    const r = await responder({ acao: 'sugestoes' }, abridorDaChave(prova, COM), Date.now())
    expect(r.desfecho).toBe('falhou')
    expect(r.desfecho).not.toBe('nao_encontrado')
    expect(r.texto).toBe(FRASES_DA_FERRAMENTA.nao_montou)
  })
})
