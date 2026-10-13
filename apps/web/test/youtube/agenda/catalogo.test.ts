// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFINICOES, agendaLigada, tarefasDesligadas } from '@/lib/youtube/agenda/catalogo'
import {
  LIMITE_FUNCAO_MS, ARRENDAMENTO_TTL_S, HORARIA_ULTIMA_ONDA_MS, HORARIA_CHAMADA_MS, HORARIA_FIM_MS, BANCO_MS,
  LEVE_COMECA_ATE_MS, LEVE_FIM_MS, PESADA_FIM_MS, RODANDO_VENCE_MIN,
} from '@/lib/youtube/agenda/relogio'
import { BATCH_BUDGET_MS, WEEKLY_DEADLINE_MS, COMPETITORS_MAX_DURATION_S, RECORD_RESERVE_MS } from '@/lib/youtube/competitor-sync-batch'
import { RULES } from '@/lib/youtube/observatorio/rules'

const guardado = { a: process.env.OBS_AGENDA, t: process.env.OBS_AGENDA_TASKS_OFF }
beforeEach(() => { delete process.env.OBS_AGENDA; delete process.env.OBS_AGENDA_TASKS_OFF })
afterEach(() => {
  if (guardado.a === undefined) delete process.env.OBS_AGENDA; else process.env.OBS_AGENDA = guardado.a
  if (guardado.t === undefined) delete process.env.OBS_AGENDA_TASKS_OFF; else process.env.OBS_AGENDA_TASKS_OFF = guardado.t
})

const CAT = DEFINICOES.map(d => ({ nome: d.nome, nuncaDesliga: d.nuncaDesliga }))

describe('OBS_AGENDA', () => {
  it('agenda ligada com a variável ausente (padrão: lê process.env, apagada)', () => {
    delete process.env.OBS_AGENDA
    expect(agendaLigada()).toBe(true)
    expect(agendaLigada({})).toBe(true)
  })
  it('agenda desligada só com off', () => {
    expect(agendaLigada({ OBS_AGENDA: 'off' })).toBe(false)
    for (const v of ['OFF', 'Off', '0', '', ' ', ' off', 'off ', 'false', 'on']) expect(agendaLigada({ OBS_AGENDA: v }), JSON.stringify(v)).toBe(true)
  })
  it('sem argumento, lê process.env na hora da chamada', () => {
    process.env.OBS_AGENDA = 'off'
    expect(agendaLigada()).toBe(false)
    process.env.OBS_AGENDA = ''
    expect(agendaLigada()).toBe(true)
  })
})

describe('OBS_AGENDA_TASKS_OFF', () => {
  it('todas as tarefas ligadas com a variável ausente', () => {
    delete process.env.OBS_AGENDA_TASKS_OFF
    const r = tarefasDesligadas(process.env, CAT)
    expect([...r.desligadas]).toEqual([])
    expect(r.desconhecidas).toEqual([])
  })
  it('vazia ou só espaços: nada desligado, nada desconhecido', () => {
    for (const v of ['', '   ', ',', ' , , ']) {
      const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: v }, CAT)
      expect([...r.desligadas], JSON.stringify(v)).toEqual([])
      expect(r.desconhecidas, JSON.stringify(v)).toEqual([])
    }
  })
  it('lista com espaços, vazios e nome desconhecido', () => {
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: ' leitura_horaria , ,nao_existe' }, CAT)
    expect([...r.desligadas]).toEqual(['leitura_horaria'])
    expect(r.desconhecidas).toEqual(['nao_existe'])
  })
  it('nome desconhecido repetido aparece uma vez; os conhecidos entram todos', () => {
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'x,x,serie_semanal,sincronizar_canais' }, CAT)
    expect([...r.desligadas].sort()).toEqual(['serie_semanal', 'sincronizar_canais'])
    expect(r.desconhecidas).toEqual(['x'])
  })
  it('maiúsculas não casam: o nome é exato e o erro de digitação fica visível em desconhecidas', () => {
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'LEITURA_HORARIA' }, CAT)
    expect([...r.desligadas]).toEqual([])
    expect(r.desconhecidas).toEqual(['LEITURA_HORARIA'])
  })
  it('nome que parece o de uma propriedade de objeto é só desconhecido', () => {
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: '__proto__,constructor' }, CAT)
    expect([...r.desligadas]).toEqual([])
    expect(r.desconhecidas).toEqual(['__proto__', 'constructor'])
  })
  it('tarefa que nunca desliga é ignorada na lista', () => {
    const cat = [{ nome: 'a' }, { nome: 'b', nuncaDesliga: true }]
    const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'a,b' }, cat)
    expect([...r.desligadas]).toEqual(['a'])
    expect(r.desconhecidas).toEqual([])
  })
})

describe('limites de tempo e definições', () => {
  it('os limites cabem na função', () => {
    expect(HORARIA_ULTIMA_ONDA_MS + HORARIA_CHAMADA_MS).toBeLessThan(HORARIA_FIM_MS)
    expect(HORARIA_FIM_MS).toBeLessThanOrEqual(LEVE_COMECA_ATE_MS)
    expect(LEVE_COMECA_ATE_MS).toBeLessThan(LEVE_FIM_MS)
    expect(LEVE_FIM_MS).toBeLessThan(BATCH_BUDGET_MS)
    expect(ARRENDAMENTO_TTL_S * 1000).toBeLessThan(LIMITE_FUNCAO_MS)
    expect(LIMITE_FUNCAO_MS).toBe(COMPETITORS_MAX_DURATION_S * 1000)
    expect(PESADA_FIM_MS).toBe(LIMITE_FUNCAO_MS - RECORD_RESERVE_MS)
    expect(BANCO_MS).toBe(5_000)
    expect(RODANDO_VENCE_MIN).toBe(10)
  })
  it('LIMITE_FUNCAO_MS confere com o maxDuration da rota', () => {
    const src = readFileSync(resolve(__dirname, '../../../src/app/api/cron/sync-youtube/route.ts'), 'utf8')
    const m = /export const maxDuration = (\d+)/.exec(src)
    expect(m).not.toBeNull()
    expect(Number(m![1]) * 1000).toBe(LIMITE_FUNCAO_MS)
  })
  it('toda definição tem começo antes do fim e fim dentro do teto do peso', () => {
    expect(DEFINICOES.length).toBe(3)
    for (const d of DEFINICOES) {
      expect(d.comecaAteMs, d.nome).toBeLessThan(d.fimAteMs)
      if (d.peso === 'pesada') expect(d.fimAteMs, d.nome).toBeLessThanOrEqual(PESADA_FIM_MS)
      else expect(d.fimAteMs, d.nome).toBeLessThanOrEqual(LEVE_FIM_MS)
    }
  })
  it('as três linhas da tabela, valor por valor', () => {
    const por = (n: string) => DEFINICOES.find(d => d.nome === n)!
    const h = por('leitura_horaria')
    expect(h).toMatchObject({ rotulo: 'leitura horária', ordem: 1, peso: 'sempre', periodo: 'hora', tetoTentativas: 3, toleranciaVigiaH: 2, naoTerminouVermelhoEm: 3, comecaAteMs: 22_000, fimAteMs: HORARIA_FIM_MS })
    expect(h.aPartirDaHoraSP).toBeUndefined()
    const s = por('sincronizar_canais')
    expect(s).toMatchObject({ rotulo: 'sincronização dos canais', ordem: 6, peso: 'pesada', periodo: 'faixa', tetoTentativas: 9, toleranciaVigiaH: 8, naoTerminouVermelhoEm: 6, comecaAteMs: BATCH_BUDGET_MS, fimAteMs: PESADA_FIM_MS })
    const w = por('serie_semanal')
    expect(w).toMatchObject({ rotulo: 'série semanal', ordem: 8, peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 12, tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null, comecaAteMs: WEEKLY_DEADLINE_MS, fimAteMs: PESADA_FIM_MS, cedeA: ['sincronizar_canais'] })
    expect(new Set(DEFINICOES.map(d => d.nome)).size).toBe(3)
    expect(new Set(DEFINICOES.map(d => d.ordem)).size).toBe(3)
  })
  it('nenhuma definição é "nuncaDesliga" nesta ordem', () => {
    expect(DEFINICOES.some(d => d.nuncaDesliga)).toBe(false)
  })
})

describe('RULES.hourly', () => {
  it('os quatro valores do plano', () => {
    expect(RULES.hourly).toEqual({ ageDays: 14, videosMax: 25, bufferDays: 60, emptyAnswerMin: 5 })
  })
})
