// @vitest-environment node
/**
 * F4 T9: o leitor dos títulos pedidos à forja (fila, gerando, parada, pronto, recusado com motivo, falhou) e a paridade
 * tela x rota x get_signals do MCP (D-F4-4: o Cowork só LÊ, o mesmo dado da tela).
 */
import { describe, it, expect, vi } from 'vitest'
import { fakeSb, type Consulta, type Resposta } from '../../youtube/observatorio/sinais/fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const mundo = vi.hoisted(() => ({ sb: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: SITE, permissions: ['read'], keyHash: 'h', keyId: 'k' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mundo.sb }))

import type { ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { lerTitulosDosSinais } from '@/lib/youtube/observatorio/sinais/titulos-complementares/ler'
import { youtubeObservatory } from '@/lib/pipeline/mcp/services/youtube-observatory'
import { listNicheSignals } from '@/lib/pipeline/services/niche-signals'
import { montarVistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'

const AGORA = Date.parse('2026-10-29T22:00:00Z')
const min = (n: number): string => new Date(AGORA - n * 60_000).toISOString()
const S = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`
const V = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`
const T = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`

type Tarefa = Record<string, unknown>
const tarefa = (o: Tarefa): Tarefa => ({ id: T(1), status: 'pending', requested_at: min(5), started_at: null, completed_at: null, failed_at: null, refused_at: null, released_at: null, retry_count: 0, refused_reason: null, error_message: null, target_own_video_id: V(1), target_signal_id: S(1), ...o })
const beat = (lastMin: number, caps: string[] = ['titulo-complementar']) => [{ last_poll_at: min(lastMin), capabilities: caps }]

function sbCom(o: { beat?: unknown[]; tarefas?: Tarefa[]; leituras?: Tarefa[]; erro?: string }) {
  return fakeSb((c: Consulta): Resposta => {
    if (o.erro && c.tabela === o.erro) return { data: null, error: { message: 'boom' } }
    if (c.tabela === 'forja_heartbeat') return { data: o.beat ?? [] }
    if (c.tabela === 'youtube_intelligence_tasks') return { data: o.tarefas ?? [] }
    if (c.tabela === 'competitor_readings') return { data: o.leituras ?? [] }
    return { data: [] }
  }).sb
}
const ler = async (o: Parameters<typeof sbCom>[0]) => lerTitulosDosSinais(sbCom(o), SITE, [S(1)], AGORA)
const par = async (o: Parameters<typeof sbCom>[0]) => (await ler(o)).porSinal.get(S(1))?.[0]

describe('lerTitulosDosSinais', () => {
  it('na fila, gerando, e parada quando a forja não consulta há mais de 3 ciclos', async () => {
    expect(await par({ beat: beat(3), tarefas: [tarefa({})] })).toMatchObject({ estado: 'fila', own_video_id: V(1) })
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'running', started_at: min(2) })] })).toMatchObject({ estado: 'gerando' })
    expect(await par({ beat: beat(90), tarefas: [tarefa({})] })).toMatchObject({ estado: 'parada', parada_desde: min(90) })
    expect(await par({ beat: [], tarefas: [tarefa({})] })).toMatchObject({ estado: 'parada', parada_desde: null })
  })
  it('pronto: os títulos da leitura daquele pedido', async () => {
    const r = await par({ beat: beat(3), tarefas: [tarefa({ id: T(2), status: 'completed', completed_at: min(1) })], leituras: [{ task_id: T(2), own_video_id: V(1), signal_id: S(1), generated_at: min(1), text: { items: ['Um', 'Dois'] } }] })
    expect(r).toMatchObject({ estado: 'pronto', titulos: ['Um', 'Dois'] })
  })
  it('concluído sem resultado legível NÃO é "pronto com zero": é falhou', async () => {
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'completed' })], leituras: [] })).toMatchObject({ estado: 'falhou' })
    expect(await par({ beat: beat(3), tarefas: [tarefa({ id: T(2), status: 'completed' })], leituras: [{ task_id: T(2), own_video_id: V(1), signal_id: S(1), generated_at: min(1), text: { items: [] } }] })).toMatchObject({ estado: 'falhou' })
  })
  it('recusado pelo validador leva o motivo (inclusive vazio); recusa de outra causa é falhou', async () => {
    for (const m of ['demais', 'longo', 'repetido', 'numero_fora', 'vazio']) {
      expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'refused', refused_reason: `validador-${m}` })] })).toMatchObject({ estado: 'recusado', motivo: m })
    }
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'refused', refused_reason: 'dado-velho' })] })).toMatchObject({ estado: 'falhou' })
  })
  it('vale o pedido mais recente do par; outro vídeo seu é outro par', async () => {
    const r = await ler({ beat: beat(3), tarefas: [tarefa({ id: T(3), status: 'refused', refused_reason: 'validador-longo', requested_at: min(1) }), tarefa({ id: T(2), status: 'completed', requested_at: min(60) }), tarefa({ id: T(4), target_own_video_id: V(2) })] })
    const pares = r.porSinal.get(S(1))!
    expect(pares.find((p) => p.own_video_id === V(1))).toMatchObject({ estado: 'recusado', motivo: 'longo' })
    expect(pares.find((p) => p.own_video_id === V(2))).toMatchObject({ estado: 'fila' })
  })
  it('M2: failed com error_message "validador" (o kit gastou as tentativas) é recusado "reprovado"; outro failed segue falhou', async () => {
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'failed', error_message: 'validador', failed_at: min(1), retry_count: 2 })] })).toMatchObject({ estado: 'recusado', motivo: 'reprovado' })
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'failed', error_message: 'travou-3x' })] })).toMatchObject({ estado: 'falhou' })
  })
  it('P5: recusa da forja por outra causa mantém o motivo (frase de refusedReasonText), sem virar "recusado pelo validador"', async () => {
    const p = await par({ beat: beat(3), tarefas: [tarefa({ status: 'refused', refused_reason: 'dado-velho' })] })
    expect(p).toMatchObject({ estado: 'falhou', motivo_forja: 'a máquina recebeu dados anteriores à última sincronização. Peça de novo.' })
    expect(await par({ beat: beat(3), tarefas: [tarefa({ status: 'failed' })] })).not.toHaveProperty('motivo_forja')
  })
  it('M3: pedido pendente e heartbeat vivo SEM a capacidade é sem_capacidade (nunca parada com hora de agora), mesmo após 25 h', async () => {
    const velha = tarefa({ requested_at: min(25 * 60) })
    const p = await par({ beat: beat(2, ['temas']), tarefas: [velha] })
    expect(p).toMatchObject({ estado: 'sem_capacidade' })
    expect(p).not.toHaveProperty('parada_desde')
    expect(await par({ beat: beat(2, ['temas']), tarefas: [tarefa({ status: 'running', started_at: min(1) })] })).toMatchObject({ estado: 'gerando' })
  })
  it('P4: heartbeat vivo com capacidade e pedido velho (>24 h) é parada SEM "desde"; só heartbeat morto de verdade leva o horário', async () => {
    expect(await par({ beat: beat(2), tarefas: [tarefa({ requested_at: min(25 * 60) })] })).toMatchObject({ estado: 'parada', parada_desde: null })
    expect(await par({ beat: beat(31), tarefas: [tarefa({})] })).toMatchObject({ estado: 'parada', parada_desde: min(31) })
  })
  it('P3: as leituras são buscadas por task_id só das concluídas que valem; bater o teto de pedidos avisa no Sentry', async () => {
    const consultas: Consulta[] = []
    const sb = fakeSb((c: Consulta): Resposta => {
      consultas.push(c)
      if (c.tabela === 'forja_heartbeat') return { data: beat(3) }
      if (c.tabela === 'youtube_intelligence_tasks') return { data: Array.from({ length: 1000 }, (_, i) => tarefa({ id: T(100 + i), status: 'completed', requested_at: min(10 + i), target_own_video_id: i === 0 ? V(1) : V(2000 + i) })) }
      return { data: [] }
    }).sb
    const r = await lerTitulosDosSinais(sb, SITE, [S(1)], AGORA)
    const cols = consultas.filter((c) => c.tabela === 'competitor_readings').flatMap((c) => c.filtros.map((f) => f.col))
    expect(cols).toContain('task_id')
    expect(cols).not.toContain('signal_id')
    expect(r.porSinal.get(S(1))!.every((p) => p.estado === 'falhou')).toBe(true) // concluídas sem leitura: falha dita, não "pronto"
    const Sentry = await import('@sentry/nextjs')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('titulos.teto_de_tarefas', expect.anything())
  })
  it('capacidade: lista a do heartbeat; sem heartbeat é null (nunca true)', async () => {
    expect((await ler({ beat: beat(3) })).forjaSabePedir).toBe(true)
    expect((await ler({ beat: beat(3, ['temas']) })).forjaSabePedir).toBe(false)
    expect((await ler({ beat: [] })).forjaSabePedir).toBeNull()
  })
  it('erro de banco lança (a lista vira "leitura: erro", nunca "sem pedidos")', async () => {
    await expect(ler({ erro: 'youtube_intelligence_tasks' })).rejects.toThrow()
    await expect(ler({ erro: 'forja_heartbeat' })).rejects.toThrow()
  })
})

// ---- paridade: a tela, a rota e o get_signals do MCP leem o MESMO dado
const agoraIso = new Date().toISOString()
const linhaSinal = { id: S(1), kind: 'destino', subject_key: 'pais:JP', acao: 'titulo_descricao', forca: 5, motivo: 'm', rule_version: 'sinais-v1+semente-1', first_seen_at: agoraIso, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), adiado_ate: null, adiado_em: null,
  evidence: { outliers: [{ video_id: 'v1', canal_id: 'c1', published_at: agoraIso, mult_vpd7: 8, mult_tela: 8, vpd7: 100, formato: 'long' }], outliers_total: 1, canais: 1, proprios: [] } }
function montarMundo(titulos: { beat: unknown[]; tarefas: Tarefa[]; leituras: Tarefa[] }): void {
  mundo.sb = fakeSb((c: Consulta): Resposta => {
    if (c.tabela === 'niche_signals') return { data: [linhaSinal], count: 1 }
    if (c.tabela === 'niche_signals_estado') return { data: [{ computed_at: agoraIso, motivo_vazio: null, contagens: {} }] }
    if (c.tabela === 'video_lugares') return { data: [{ video_id: V(1), chaves: ['pais:JP'] }] }
    if (c.tabela === 'forja_heartbeat') return { data: titulos.beat }
    if (c.tabela === 'youtube_intelligence_tasks') return { data: titulos.tarefas }
    if (c.tabela === 'competitor_readings') return { data: titulos.leituras }
    return { data: [] }
  }).sb
}
const ctx = () => ({ siteId: SITE, permissions: ['read'], keyHash: 'h', keyId: 'k', supabase: mundo.sb, source: 'api_key' }) as never

describe('F4 T9: Cowork lê os mesmos títulos que a tela', () => {
  const TITULOS = ['Japão em 15 dias: onde o dinheiro foi', 'O custo real do Japão']
  it('rota e get_signals trazem os títulos do par; a vista da tela mostra os mesmos; nenhuma ação de pedido existe no MCP', async () => {
    montarMundo({
      beat: beat(3), tarefas: [tarefa({ id: T(2), status: 'completed', target_signal_id: S(1), target_own_video_id: V(1) })],
      leituras: [{ task_id: T(2), own_video_id: V(1), signal_id: S(1), generated_at: min(1), text: { items: TITULOS } }],
    })
    const rota = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
    const mcp = JSON.parse((await youtubeObservatory({ action: 'get_signals' })).content[0]!.text!) as ListaDeSinais
    for (const l of [rota, mcp]) {
      expect(l.titulos_forja).toEqual({ leitura: 'ok', forja_sabe_pedir: true })
      expect(l.itens[0]!.titulos_complementares).toMatchObject([{ own_video_id: V(1), estado: 'pronto', titulos: TITULOS }])
    }
    const amostra = new Map([[V(1), { titulo: 'Meu vídeo do Japão', miniatura: null, origem: 'proprio' as const, canal: null, chaves: ['pais:JP'] }]])
    const vista = montarVistaDaLista({ lista: { ...rota, itens: rota.itens.map((i) => ({ ...i, proprios_agora: [V(1)], proprios_agora_n: 1 })) }, amostra, agora: new Date(), filtro: 'todas', saiuDoAviso: false, limite: 100 })
    const par = vista.linhas[0]!.titulos!.videos[0]!.par
    expect(par).toMatchObject({ estado: 'pronto', titulos: TITULOS })
    // o Cowork não pede: nenhuma ação do MCP aceita pedir títulos
    const r = await youtubeObservatory({ action: 'pedir_titulos' } as never)
    expect(r.isError).toBe(true)
    expect(r.content[0]!.text).toMatch(/Unknown action .*pedir_titulos/)
  })
  it('sem nenhum pedido: o item não leva o campo (resposta enxuta) e a lista diz que leu', async () => {
    montarMundo({ beat: beat(3), tarefas: [], leituras: [] })
    const rota = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
    expect(rota.itens[0]).not.toHaveProperty('titulos_complementares')
    expect(rota.titulos_forja).toEqual({ leitura: 'ok', forja_sabe_pedir: true })
  })
  it('leitura dos pedidos falha: a lista continua e diz leitura "erro" (nunca "sem pedidos")', async () => {
    const sb = fakeSb((c: Consulta): Resposta => {
      if (c.tabela === 'youtube_intelligence_tasks') return { data: null, error: { message: 'x' } }
      if (c.tabela === 'niche_signals') return { data: [linhaSinal], count: 1 }
      if (c.tabela === 'niche_signals_estado') return { data: [{ computed_at: agoraIso, motivo_vazio: null, contagens: {} }] }
      if (c.tabela === 'video_lugares') return { data: [{ video_id: V(1), chaves: ['pais:JP'] }] }
      return { data: [] }
    }).sb
    mundo.sb = sb
    const rota = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
    expect(rota.n).toBe(1)
    expect(rota.titulos_forja).toEqual({ leitura: 'erro', forja_sabe_pedir: null })
  })
})
