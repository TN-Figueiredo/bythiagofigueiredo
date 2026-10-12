// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerEntradaDaJanela, consultaDaJanela, EntradaInvalida } from '@/lib/pipeline/leitura-janela-entrada'

const ok = (dia: string) => JSON.stringify({ rows: [{ dia_sp: dia, controle: 3, sem_read: 0, linhas: 3, tarefas_forja: 1 }] })

describe('E19: entrada do script da janela', () => {
  it('aceita a data pura e a data com hora (banco local) com o mesmo resultado', () => {
    expect(lerEntradaDaJanela(ok('2026-10-13'))[0]!.dia_sp).toBe('2026-10-13')
    expect(lerEntradaDaJanela(`aviso\n${ok('2026-10-13T00:00:00Z')}\nfim`)[0]!.dia_sp).toBe('2026-10-13')
  })
  it('entrada malformada lança EntradaInvalida (array solto, tabela, rows:[null], sem rows)', () => {
    for (const e of ['[{"dia_sp":"2026-10-13"},{"dia_sp":"2026-10-14"}]', '| dia | controle |\n| 2026 | 3 |', '{"rows":[null]}', '{"x":1}', '', '{"rows":[{"dia_sp":"ontem"}]}']) {
      expect(() => lerEntradaDaJanela(e), e).toThrow(EntradaInvalida)
    }
  })
  it('a consulta é só select, usa o fuso de São Paulo (corte T03:00:00Z) e conta só tarefa concluída', () => {
    const q = consultaDaJanela('2026-10-13')
    expect(q).toMatch(/^with /)
    expect(q).not.toMatch(/\b(insert|update|delete|drop|alter)\b/i)
    expect(q).toContain("'America/Sao_Paulo'")
    expect(q).toContain("completed_at >= '2026-10-13T03:00:00Z'")
    expect(q).toContain("status = 'completed'")
    expect(() => consultaDaJanela("x'; drop")).toThrow(EntradaInvalida)
  })
})
