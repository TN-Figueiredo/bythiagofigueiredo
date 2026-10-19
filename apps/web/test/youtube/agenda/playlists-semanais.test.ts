// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CATALOGO, DEFINICAO_PLAYLISTS_SEMANAIS, TODAS_AS_DEFINICOES, tarefasDesligadas, validarCatalogo } from '@/lib/youtube/agenda/catalogo'
import { avaliarAgenda, MOTIVO_AGENDA_OFF } from '@/lib/youtube/agenda/saude'
import { despachar, type OpsAgenda } from '@/lib/youtube/agenda/despachante'
import { CODIGO_RE } from '@/lib/youtube/agenda/motivos'
import { rodarPlaylistsSemanais } from '@/lib/youtube/agenda/tarefas/playlists-semanais'
import type { ContextoTarefa, EstadoAgenda, Lido, Tarefa } from '@/lib/youtube/agenda/tipos'
import type { OpsX3, LeituraDoCanal } from '@/lib/youtube/observatorio/playlists/gravar'
import { FIM_ATE_MS, X3_RULES } from '@/lib/youtube/observatorio/playlists/regras'
import { PRIORIDADE_DE_MOTIVOS, type ResultadoDaVisita } from '@/lib/youtube/observatorio/playlists/visitar'

const T0 = Date.UTC(2026, 9, 12) + (13 + 3) * 3_600_000 // 13:00 em São Paulo
afterEach(() => { vi.unstubAllEnvs() })
const def = DEFINICAO_PLAYLISTS_SEMANAIS
const tarefaReal = (): Tarefa => CATALOGO.find(t => t.nome === 'playlists_semanais')!

describe('playlists_semanais: definição', () => {
  it('números e igualdades com X3_RULES', () => {
    expect(def.naoTerminouVermelhoEm).toBe(9)
    expect(def.comecaAteMs).toBe(X3_RULES.canalComecaAteMs)
    expect(def.fimAteMs).toBe(FIM_ATE_MS)
    expect(def.ligaCom).toBe('OBS_X3_PLAYLISTS')
    expect(def.nuncaDesliga).toBeUndefined()
  })
  it('motivos: todos casam CODIGO_RE e cobrem a prioridade da visita', () => {
    for (const k of Object.keys(def.motivos)) expect(CODIGO_RE.test(k), k).toBe(true)
    for (const m of PRIORIDADE_DE_MOTIVOS) expect(def.motivos[m], m).toBeTruthy()
  })
  it('o catálogo e a lista do vigia a trazem', () => {
    expect(TODAS_AS_DEFINICOES.some(d => d.nome === def.nome)).toBe(true)
    expect(CATALOGO.some(t => t.nome === def.nome)).toBe(true)
  })
})

describe('playlists_semanais: interruptor ligaCom', () => {
  it('variável apagada e OBS_AGENDA_TASKS_OFF apagada: desligada e não ligada', () => {
    const env: NodeJS.ProcessEnv = {}
    delete env.OBS_X3_PLAYLISTS
    delete env.OBS_AGENDA_TASKS_OFF
    const r = tarefasDesligadas(env, CATALOGO)
    expect(r.desligadas.has('playlists_semanais')).toBe(true)
    expect(r.naoLigadas.has('playlists_semanais')).toBe(true)
    expect([...r.naoLigadas]).toEqual(['playlists_semanais', 'leitura_watch', 'registro_teste_nativo'])
  })
  it('com OBS_AGENDA_TASKS_OFF=marcas_de_idade: as duas desligadas', () => {
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'marcas_de_idade' }, CATALOGO)
    expect([...r.desligadas].sort()).toEqual(['leitura_watch', 'marcas_de_idade', 'playlists_semanais', 'registro_teste_nativo'])
  })
  it('só o valor exato on liga; ON, 1, vazio e " on" não', () => {
    expect(tarefasDesligadas({ OBS_X3_PLAYLISTS: 'on' }, CATALOGO).desligadas.has('playlists_semanais')).toBe(false)
    for (const v of ['ON', '1', '', ' on', 'true']) expect(tarefasDesligadas({ OBS_X3_PLAYLISTS: v }, CATALOGO).desligadas.has('playlists_semanais'), JSON.stringify(v)).toBe(true)
  })
  it('as únicas com ligaCom no catálogo são as esperadas', () => {
    expect(CATALOGO.filter(t => t.ligaCom !== undefined).map(t => t.nome)).toEqual(['playlists_semanais', 'leitura_watch', 'registro_teste_nativo'])
  })
  it('o catálogo recusa ligaCom junto com nuncaDesliga', () => {
    expect(() => validarCatalogo([{ nome: 'x', ligaCom: 'V', nuncaDesliga: true }])).toThrow()
    expect(() => validarCatalogo(CATALOGO)).not.toThrow()
  })
  it('vigia: variável apagada diz "tarefa ainda não ligada (OBS_X3_PLAYLISTS)"; agenda off vence', () => {
    const estado: Lido<EstadoAgenda> = { valor: { agora: new Date(T0).toISOString(), desde: null, tarefas: [] } }
    const a = avaliarAgenda(estado, TODAS_AS_DEFINICOES, T0, {})
    expect(a.find(i => i.nome === 'playlists_semanais')).toMatchObject({ status: 'desligada', motivo: 'tarefa ainda não ligada (OBS_X3_PLAYLISTS)' })
    const b = avaliarAgenda(estado, TODAS_AS_DEFINICOES, T0, { OBS_AGENDA: 'off', OBS_X3_PLAYLISTS: 'on' })
    expect(b.find(i => i.nome === 'playlists_semanais')).toMatchObject({ status: 'desligada', motivo: MOTIVO_AGENDA_OFF })
  })
})

function opsAgenda(): OpsAgenda {
  return {
    tomar: vi.fn(async () => ({ valor: true })), fechar: vi.fn(async () => ({ valor: true })), adiar: vi.fn(async () => undefined),
    esgotar: vi.fn(async () => ({ valor: false })), relatar: vi.fn(),
  }
}
function despacho(agora: () => number, desligadas: Set<string>) {
  const rodar = vi.fn(async () => ({ estado: 'ok' as const, feitas: 0, deixadas: 0 }))
  const t: Tarefa = { ...tarefaReal(), rodar }
  const ops = opsAgenda()
  const p = despachar({
    catalogo: [t], desligadas, t0: T0, agora,
    estado: { valor: { agora: new Date(T0).toISOString(), desde: null, tarefas: [] } },
    contexto: { t0: T0, agora, apiKey: 'k', sb: {} as SupabaseClient, linhas: null }, ops,
  })
  return { p, rodar, ops }
}

describe('playlists_semanais: despachante', () => {
  it('variável apagada: desligada, rodar nunca chamado', async () => {
    const env: NodeJS.ProcessEnv = {}
    const { p, rodar } = despacho(() => T0, tarefasDesligadas(env, CATALOGO).desligadas)
    const r = await p
    expect(r.tarefas.find(t => t.tarefa === 'playlists_semanais')?.estado).toBe('desligada')
    expect(rodar).not.toHaveBeenCalled()
  })
  it('55 s do começo: adiada sem_tempo, tomar nunca chamado, nenhuma tentativa gasta', async () => {
    const { p, ops, rodar } = despacho(() => T0 + 55_000, new Set())
    const r = await p
    expect(r.tarefas.find(t => t.tarefa === 'playlists_semanais')).toMatchObject({ estado: 'adiada', motivo: 'sem_tempo' })
    expect(ops.tomar).not.toHaveBeenCalled()
    expect(rodar).not.toHaveBeenCalled()
  })
  it('canais_sem_volta_14d > 0 vira problema do disparo mesmo com ok', async () => {
    const agora = () => T0
    const t: Tarefa = { ...tarefaReal(), rodar: async () => ({ estado: 'ok', feitas: 0, deixadas: 0, detalhe: { canais_sem_volta_14d: 2 } }) }
    const r = await despachar({
      catalogo: [t], desligadas: new Set(), t0: T0, agora, estado: { valor: { agora: new Date(T0).toISOString(), desde: null, tarefas: [] } },
      contexto: { t0: T0, agora, apiKey: 'k', sb: {} as SupabaseClient, linhas: null }, ops: opsAgenda(),
    })
    expect(r.problemas.some(x => x.includes('2 canais sem volta'))).toBe(true)
  })
})

// ---- rodar -----------------------------------------------------------------------------------------------------------

const linhaCanal = (n: number, site = 's1') => ({ id: `c${n}`, channel_id: `UC${n}`, channel_name: null, site_id: site, last_synced_at: null, last_ok_synced_at: null, sync_status: null, sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, collection_paused_at: null })
const ESTADO = { playlists: [], empty_streak: 0, sections_empty_streak: 0, ultima_secao_vazia: null }
const resultado = (o: Partial<ResultadoDaVisita> = {}): ResultadoDaVisita => ({ iniciada: true, estado: 'ok', motivo: null, unidades: 5, playlistsLeft: 0, cotaEsgotada: false, tetoPorCanal: false, cotaNaoRegistrada: 0, numeros: {}, ...o })

function ops(o: Partial<OpsX3> = {}): OpsX3 {
  return {
    schemaPresente: async () => true, lerLeituras: async () => new Map<string, LeituraDoCanal>(), cotaDoDia: async () => new Map(),
    lerCanais: async (_s, ids) => new Map(ids.map(i => [i, ESTADO])), canaisComSecoes: async () => 3, itensPresentes: async () => 0,
    playlistsRecord: vi.fn(), itemsRecord: vi.fn(), sectionsRecord: vi.fn(), visitClose: vi.fn(), registrarCota: vi.fn(), ...o,
  } as OpsX3
}
function ctx(linhas: ContextoTarefa['linhas'], agora: () => number = () => T0): ContextoTarefa {
  return { t0: T0, agora, apiKey: 'k', sb: {} as SupabaseClient, linhas }
}
const rodar = (c: ContextoTarefa, o: OpsX3, visitar: (...a: never[]) => Promise<ResultadoDaVisita>) =>
  rodarPlaylistsSemanais(c, { criarOps: () => o, visitar: visitar as never, fetchImpl: vi.fn() as never })

describe('playlists_semanais: rodar', () => {
  it('schema ausente: erro schema_ausente; leitura de schema que lança: gravacao_falhou', async () => {
    const v = vi.fn()
    expect(await rodar(ctx([]), ops({ schemaPresente: async () => false }), v)).toMatchObject({ estado: 'erro', motivo: 'schema_ausente' })
    expect(await rodar(ctx([]), ops({ schemaPresente: async () => { throw new Error('x') } }), v)).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou' })
    expect(v).not.toHaveBeenCalled()
  })
  it('linhas nula: canais_nao_lidos', async () => {
    expect(await rodar(ctx(null), ops(), vi.fn())).toMatchObject({ estado: 'erro', motivo: 'canais_nao_lidos' })
  })
  it('nenhum devido: ok, feitas 0, detalhe com canais_com_secoes', async () => {
    const r = await rodar(ctx([]), ops(), vi.fn())
    expect(r).toMatchObject({ estado: 'ok', feitas: 0, detalhe: { canais_com_secoes: 3, canais_sem_volta_14d: 0 } })
  })
  it('um parcial entre três: parcial com o motivo de maior gravidade; cada visita recebe o seu canal', async () => {
    const motivos = [null, 'teto_itens', 'lista_cortada']
    let i = 0
    const v = vi.fn(async () => { const m = motivos[i++]!; return resultado(m === null ? {} : { estado: 'parcial', motivo: m }) })
    const r = await rodar(ctx([linhaCanal(1), linhaCanal(2), linhaCanal(3)]), ops(), v)
    expect(r).toMatchObject({ estado: 'parcial', feitas: 3, motivo: 'lista_cortada' })
    expect(v).toHaveBeenCalledTimes(3)
  })
  it('todas as visitas em erro: erro com o motivo mais grave', async () => {
    const v = vi.fn(async () => resultado({ estado: 'erro', motivo: 'api_falhou' }))
    expect(await rodar(ctx([linhaCanal(1)]), ops(), v)).toMatchObject({ estado: 'erro', motivo: 'api_falhou' })
  })
  it('tempo acaba com canal devido e feitas >= 1: parcial sobrou com deixadas', async () => {
    let t = T0
    const v = vi.fn(async () => { t = T0 + X3_RULES.canalComecaAteMs + 1; return resultado() })
    const r = await rodar(ctx([linhaCanal(1), linhaCanal(2)], () => t), ops(), v)
    expect(r).toMatchObject({ estado: 'parcial', feitas: 1, deixadas: 1, motivo: 'sobrou' })
  })
  it('teto do dia lido de youtube_quota_usage: nenhum canal devido cabe -> teto_do_dia', async () => {
    const v = vi.fn()
    const r = await rodar(ctx([linhaCanal(1)]), ops({ cotaDoDia: async () => new Map([['s1', X3_RULES.unidadesPorDia]]) }), v)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'teto_do_dia' })
    expect(v).not.toHaveBeenCalled()
  })
  it('Yannis I-3: o teto do dia vale DURANTE a execução: 3 canais, cota lida 0, visita de 300 unidades: 2 visitados, o 3º não, parcial teto_do_dia', async () => {
    const v = vi.fn(async () => resultado({ unidades: 300 }))
    const r = await rodar(ctx([linhaCanal(1), linhaCanal(2), linhaCanal(3)]), ops(), v)
    expect(v).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ estado: 'parcial', feitas: 2, motivo: 'teto_do_dia' })
  })
  it('Yannis M-4: exatamente em canalComecaAteMs o canal não começa; 1 ms antes, começa', async () => {
    const v = vi.fn(async () => resultado())
    const noLimite = await rodar(ctx([linhaCanal(1)], () => T0 + X3_RULES.canalComecaAteMs), ops(), v)
    expect(v).not.toHaveBeenCalled()
    expect(noLimite).toMatchObject({ estado: 'parcial', feitas: 0, motivo: 'sem_tempo' })
    await rodar(ctx([linhaCanal(1)], () => T0 + X3_RULES.canalComecaAteMs - 1), ops(), v)
    expect(v).toHaveBeenCalledTimes(1)
  })
  it('Yannis M-5: o relógio salta para 50 s durante as leituras iniciais: parcial sem_tempo, feitas 0, nenhuma visita', async () => {
    let t = T0
    const v = vi.fn(async () => resultado())
    const o = ops({ lerCanais: async (_s, ids) => { t = T0 + X3_RULES.canalComecaAteMs; return new Map(ids.map(i => [i, ESTADO])) } })
    const r = await rodar(ctx([linhaCanal(1)], () => t), o, v)
    expect(v).not.toHaveBeenCalled()
    expect(r).toMatchObject({ estado: 'parcial', feitas: 0, motivo: 'sem_tempo', deixadas: 1 })
  })
  it('falha ao ler a cota do dia: erro gravacao_falhou, nenhuma visita, nunca teto 0', async () => {
    const v = vi.fn()
    expect(await rodar(ctx([linhaCanal(1)]), ops({ cotaDoDia: async () => { throw new Error('x') } }), v)).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou' })
    expect(v).not.toHaveBeenCalled()
  })
  it('falha ao ler as leituras ou o estado dos canais: erro, nunca "nenhum visto"', async () => {
    const v = vi.fn()
    expect(await rodar(ctx([linhaCanal(1)]), ops({ lerLeituras: async () => { throw new Error('x') } }), v)).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou' })
    expect(await rodar(ctx([linhaCanal(1)]), ops({ lerCanais: async () => { throw new Error('x') } }), v)).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou' })
    expect(v).not.toHaveBeenCalled()
  })
  it('cota esgotada: para, nenhum outro canal', async () => {
    const v = vi.fn(async () => resultado({ estado: 'parcial', motivo: 'cota_esgotada', cotaEsgotada: true }))
    const r = await rodar(ctx([linhaCanal(1), linhaCanal(2)]), ops(), v)
    expect(v).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'cota_esgotada', deixadas: 1 })
  })
  it('cota não registrada soma no detalhe', async () => {
    const v = vi.fn(async () => resultado({ cotaNaoRegistrada: 7 }))
    const r = await rodar(ctx([linhaCanal(1)]), ops(), v)
    expect(r.detalhe?.cota_nao_registrada).toBe(7)
  })
  it('canal pausado (collection_paused_at) ou removido não é visitado', async () => {
    const v = vi.fn(async () => resultado())
    await rodar(ctx([{ ...linhaCanal(1), collection_paused_at: '2026-01-01T00:00:00Z' }, { ...linhaCanal(2), missing_since: '2026-01-01' }]), ops(), v)
    expect(v).not.toHaveBeenCalled()
  })
})
