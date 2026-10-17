// @vitest-environment node
/** A5 · E17 degrau 2, Tarefa 13b: `poda_acesso_ia` = adaptador de `podarAcessoIa` para a agenda. A poda em si é provada em acesso-ia-poda.test.ts. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const podar = vi.fn()
vi.mock('@/lib/youtube/observatorio/acesso-ia/poda', () => ({ podarAcessoIa: (...a: unknown[]) => podar(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { podaAcessoIa } from '@/lib/youtube/agenda/tarefas/poda-acesso-ia'
import { CATALOGO, DEFINICAO_PODA_ACESSO_IA, TODAS_AS_DEFINICOES, tarefasDesligadas } from '@/lib/youtube/agenda/catalogo'
import { MOTIVOS_COMUNS } from '@/lib/youtube/agenda/motivos'
import { LEVE_COMECA_ATE_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

const T0 = Date.parse('2026-10-12T21:10:00Z')
const ctx = (o: Partial<ContextoTarefa> = {}): ContextoTarefa => ({ t0: T0, agora: () => T0, apiKey: 'k', sb: {} as SupabaseClient, linhas: null, ...o })
const R = { registroTotal: 10, registroApagadas: 3, taxaTotal: 8, taxaApagadas: 5 }
beforeEach(() => { podar.mockReset() })

// A tarefa `playlists_semanais` só liga com `OBS_X3_PLAYLISTS=on`; os testes deste arquivo não são sobre ela (os dela: playlists-semanais.test.ts).
beforeEach(() => { process.env.OBS_X3_PLAYLISTS = 'on' })
afterEach(() => { delete process.env.OBS_X3_PLAYLISTS })

describe('poda_acesso_ia: definição', () => {
  it('cada campo da tabela do plano', () => {
    expect(DEFINICAO_PODA_ACESSO_IA).toMatchObject({
      nome: 'poda_acesso_ia', rotulo: 'poda do registro de acesso de IA', ordem: 5.2, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 5,
      tetoTentativas: 12, toleranciaVigiaH: 192, naoTerminouVermelhoEm: null, comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
    })
    expect(Object.keys(DEFINICAO_PODA_ACESSO_IA.motivos).sort()).toEqual(['atraso_restante', 'banco_falhou', 'contagem_ausente', 'sem_tempo_para_terminar'])
    expect(DEFINICAO_PODA_ACESSO_IA.nuncaDesliga).toBeUndefined()
  })
  it('está em TODAS_AS_DEFINICOES e o CATALOGO a reproduz (por nome, nunca por contagem)', () => {
    expect(TODAS_AS_DEFINICOES.map(d => d.nome)).toContain('poda_acesso_ia')
    expect(CATALOGO.map(t => t.nome)).toEqual(TODAS_AS_DEFINICOES.map(d => d.nome))
    expect(CATALOGO.find(t => t.nome === 'poda_acesso_ia')).toBe(podaAcessoIa)
  })
  it('posição relativa: depois de tamanho_do_banco, antes de marcas_de_idade e sempre antes de sincronizar_canais', () => {
    const pos = (n: string): number => TODAS_AS_DEFINICOES.findIndex(d => d.nome === n)
    const p = pos('poda_acesso_ia')
    expect(p).toBeGreaterThan(-1)
    for (const outro of ['tamanho_do_banco']) if (pos(outro) >= 0) expect(pos(outro)).toBeLessThan(p)
    for (const outro of ['marcas_de_idade', 'sincronizar_canais']) if (pos(outro) >= 0) expect(pos(outro)).toBeGreaterThan(p)
    for (const d of TODAS_AS_DEFINICOES) {
      if (d.peso === 'leve' && d.ordem < 5.2) expect(pos(d.nome), d.nome).toBeLessThan(p)
      if (d.peso === 'pesada') expect(pos(d.nome), d.nome).toBeGreaterThan(p)
    }
  })
  it('OBS_AGENDA_TASKS_OFF=poda_acesso_ia: desligada; variável APAGADA: roda (ligada)', () => {
    process.env.OBS_AGENDA_TASKS_OFF = 'poda_acesso_ia'
    try {
      const r = tarefasDesligadas(process.env, CATALOGO)
      expect([...r.desligadas]).toEqual(['poda_acesso_ia'])
      expect(r.desconhecidas).toEqual([])
    } finally { delete process.env.OBS_AGENDA_TASKS_OFF }
    delete process.env.OBS_AGENDA_TASKS_OFF
    expect(tarefasDesligadas(process.env, CATALOGO).desligadas.has('poda_acesso_ia')).toBe(false)
  })
})

describe('poda_acesso_ia: o adaptador', () => {
  it('ok: feitas = soma dos apagados, deixadas 0, detalhe só com números, sem motivo', async () => {
    podar.mockResolvedValue({ ok: true, r: R })
    const r = await podaAcessoIa.rodar(ctx())
    expect(r).toEqual({ estado: 'ok', feitas: 8, deixadas: 0, detalhe: { registro_total: 10, registro_apagadas: 3, taxa_total: 8, taxa_apagadas: 5 } })
  })
  it('as duas tabelas vazias: ok com zeros (dado lido, não ausente)', async () => {
    podar.mockResolvedValue({ ok: true, r: { registroTotal: 0, registroApagadas: 0, taxaTotal: 0, taxaApagadas: 0 } })
    const r = await podaAcessoIa.rodar(ctx())
    expect(r).toEqual({ estado: 'ok', feitas: 0, deixadas: 0, detalhe: { registro_total: 0, registro_apagadas: 0, taxa_total: 0, taxa_apagadas: 0 } })
  })
  it('passa o relógio do disparo e a sobra até o fimAteMs', async () => {
    podar.mockResolvedValue({ ok: true, r: R })
    let t = T0
    await podaAcessoIa.rodar(ctx({ agora: () => t }))
    expect(podar.mock.calls[0]![1]).toBe(T0)
    t = T0 + 10_000
    expect((podar.mock.calls[0]![2] as () => number)()).toBe(85_000 - 10_000)
  })
  it.each(['schema_ausente', 'banco_falhou', 'contagem_ausente'] as const)('%s: erro com o motivo, nunca ok', async (motivo) => {
    podar.mockResolvedValue({ ok: false, motivo, feito: { registroTotal: 4 } })
    const r = await podaAcessoIa.rodar(ctx())
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe(motivo)
    expect(r.detalhe).toEqual({ registro_total: 4 })
  })
  it.each(['sem_tempo_para_terminar', 'atraso_restante'] as const)('%s: parcial, com o que foi feito', async (motivo) => {
    podar.mockResolvedValue({ ok: false, motivo, feito: { registroTotal: 9, registroApagadas: 9, limpoAte: '2026-09-01T00:00:00.000Z' } })
    const r = await podaAcessoIa.rodar(ctx())
    expect(r).toMatchObject({ estado: 'parcial', motivo, feitas: 9 })
    expect(r.deixadas).toBeNull()
    // detalhe é só número: a data limpoAte vira "dias desde", nunca texto
    for (const v of Object.values(r.detalhe ?? {})) expect(typeof v).toBe('number')
    expect(r.detalhe?.limpo_ha_dias).toBe(Math.floor((T0 - Date.parse('2026-09-01T00:00:00.000Z')) / 86_400_000))
  })
  it('o motivo devolvido está sempre no catálogo da tarefa ou nos comuns', async () => {
    for (const motivo of ['schema_ausente', 'banco_falhou', 'contagem_ausente', 'sem_tempo_para_terminar', 'atraso_restante'] as const) {
      podar.mockResolvedValue({ ok: false, motivo, feito: {} })
      const r = await podaAcessoIa.rodar(ctx())
      expect(Object.keys(podaAcessoIa.motivos).concat(Object.keys(MOTIVOS_COMUNS))).toContain(r.motivo)
    }
  })
  it('a função lança: erro com motivo "excecao" (comum) e sem texto da exceção', async () => {
    podar.mockRejectedValue(new Error('sentinela-poda-xyz'))
    const r = await podaAcessoIa.rodar(ctx())
    expect(r).toMatchObject({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'excecao' })
    expect(JSON.stringify(r)).not.toContain('sentinela-poda-xyz')
  })
})
