// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CATALOGO, DEFINICOES, agendaLigada, tarefasDesligadas, notaDoInterruptorDaAgenda } from '@/lib/youtube/agenda/catalogo'
import { DEFINICOES_COMENTARIOS, TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import {
  LIMITE_FUNCAO_MS, ARRENDAMENTO_TTL_S, HORARIA_ULTIMA_ONDA_MS, HORARIA_CHAMADA_MS, HORARIA_FIM_MS, BANCO_MS,
  LEVE_COMECA_ATE_MS, LEVE_FIM_MS, PESADA_FIM_MS, RODANDO_VENCE_MIN,
} from '@/lib/youtube/agenda/relogio'
import { BATCH_BUDGET_MS, WEEKLY_DEADLINE_MS, COMPETITORS_MAX_DURATION_S, RECORD_RESERVE_MS, CHANNEL_CALL_WORST_MS, WEEKLY_CALL_WORST_MS } from '@/lib/youtube/competitor-sync-batch'
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

describe('nota do interruptor da agenda', () => {
  const NOTA = 'valor não reconhecido em OBS_AGENDA; a agenda segue ligada'
  it('sem nota com a variável apagada, vazia ou exatamente off (lê process.env)', () => {
    delete process.env.OBS_AGENDA
    expect(notaDoInterruptorDaAgenda()).toBeNull()
    expect(notaDoInterruptorDaAgenda({})).toBeNull()
    expect(notaDoInterruptorDaAgenda({ OBS_AGENDA: '' })).toBeNull()
    expect(notaDoInterruptorDaAgenda({ OBS_AGENDA: 'off' })).toBeNull()
    process.env.OBS_AGENDA = 'off'
    expect(notaDoInterruptorDaAgenda()).toBeNull()
  })
  it('qualquer outro valor: nota fixa, sem o valor, e a agenda segue ligada', () => {
    for (const v of ['OFF', ' off', 'off\n', 'off ', '0', 'false', 'disabled', ' ', 'on']) {
      const n = notaDoInterruptorDaAgenda({ OBS_AGENDA: v })
      expect(n, JSON.stringify(v)).toBe(NOTA)
      expect(agendaLigada({ OBS_AGENDA: v }), JSON.stringify(v)).toBe(true)
    }
    process.env.OBS_AGENDA = 'segredo-xyz'
    expect(notaDoInterruptorDaAgenda()).toBe(NOTA)
    expect(notaDoInterruptorDaAgenda()).not.toContain('segredo')
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
    expect(r.ignoradas).toEqual(['b'])
  })
  it('ignoradas: só as nuncaDesliga pedidas, sem repetir; vazia quando nenhuma', () => {
    const cat = [{ nome: 'a' }, { nome: 'b', nuncaDesliga: true }, { nome: 'c', nuncaDesliga: true }]
    expect(tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'b,a,b,x' }, cat).ignoradas).toEqual(['b'])
    expect(tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'c,b' }, cat).ignoradas).toEqual(['c', 'b'])
    expect(tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'a' }, cat).ignoradas).toEqual([])
    expect(tarefasDesligadas({}, cat).ignoradas).toEqual([])
    expect(tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'b' }, cat).desligadas.has('b')).toBe(false)
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
  it('começo mais a pior chamada cabe no fim, para cada definição', () => {
    const pior = (n: string): number => n === 'sincronizar_canais' ? CHANNEL_CALL_WORST_MS : n === 'serie_semanal' ? WEEKLY_CALL_WORST_MS : HORARIA_CHAMADA_MS
    for (const d of DEFINICOES) expect(d.comecaAteMs + pior(d.nome), d.nome).toBeLessThanOrEqual(d.fimAteMs)
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

describe('a lista única de definições (o catálogo e o vigia leem a mesma)', () => {
  it('são cinco, em ordem, e as do catálogo e as do vigia vêm do mesmo lugar (catalogo re-exporta o módulo leve)', () => {
    expect(TODAS_AS_DEFINICOES.map(d => d.nome)).toEqual(['leitura_horaria', 'anular_identidade', 'sincronizar_canais', 'retratos_comentarios', 'serie_semanal'])
    expect(TODAS_AS_DEFINICOES.map(d => d.ordem)).toEqual([1, 2, 6, 7, 8])
    expect(DEFINICOES_COMENTARIOS.map(d => d.nome)).toEqual(['anular_identidade', 'retratos_comentarios'])
    expect(DEFINICOES.length).toBe(3)
    expect(TODAS_AS_DEFINICOES.length).toBe(DEFINICOES.length + DEFINICOES_COMENTARIOS.length)
  })
  it('as duas da E14, valor por valor', () => {
    const por = (n: string) => TODAS_AS_DEFINICOES.find(d => d.nome === n)!
    expect(por('anular_identidade')).toMatchObject({ rotulo: 'anular identidade de autores', ordem: 2, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 3, tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null, nuncaDesliga: true })
    expect(por('retratos_comentarios')).toMatchObject({ rotulo: 'retratos de comentários', ordem: 7, peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 13, tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: 6, cedeA: ['sincronizar_canais'] })
    expect(por('retratos_comentarios').nuncaDesliga).toBeUndefined()
  })
  it('a Tarefa do catálogo carrega a definição inteira da lista única (nada diverge entre o que roda e o que o vigia cobra)', () => {
    expect(CATALOGO.map(t => t.nome)).toEqual(TODAS_AS_DEFINICOES.map(d => d.nome))
    for (const d of TODAS_AS_DEFINICOES) {
      const t = CATALOGO.find(x => x.nome === d.nome)!
      const { fraseDe: _f, ...semFuncao } = d
      expect(t, d.nome).toMatchObject(semFuncao)
      expect(typeof t.rodar, d.nome).toBe('function')
    }
  })
  it('começo antes do fim e fim dentro do teto do peso, também para as duas da E14', () => {
    for (const d of DEFINICOES_COMENTARIOS) {
      expect(d.comecaAteMs, d.nome).toBeLessThan(d.fimAteMs)
      expect(d.fimAteMs, d.nome).toBeLessThanOrEqual(d.peso === 'pesada' ? PESADA_FIM_MS : LEVE_FIM_MS)
    }
  })
})

describe('OBS_AGENDA_TASKS_OFF e as duas tarefas da E14 (o catálogo real e a lista do vigia)', () => {
  const dois = [
    ['o catálogo real', CATALOGO.map(t => ({ nome: t.nome, nuncaDesliga: t.nuncaDesliga }))],
    ['a lista do vigia', TODAS_AS_DEFINICOES.map(d => ({ nome: d.nome, nuncaDesliga: d.nuncaDesliga }))],
  ] as const
  for (const [quem, cat] of dois) {
    it(`${quem}: anular_identidade (nuncaDesliga) é ignorada e vai em "ignoradas"; retratos_comentarios desliga`, () => {
      const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: 'anular_identidade,retratos_comentarios' }, cat)
      expect(r.ignoradas).toEqual(['anular_identidade'])
      expect([...r.desligadas]).toEqual(['retratos_comentarios'])
      expect(r.desconhecidas).toEqual([])
    })
    it(`${quem}: só a anulação no interruptor: nada desliga, uma nota`, () => {
      const r = tarefasDesligadas({ OBS_AGENDA_TASKS_OFF: ' anular_identidade ,anular_identidade' }, cat)
      expect(r.ignoradas).toEqual(['anular_identidade'])
      expect(r.desligadas.size).toBe(0)
    })
  }
})
