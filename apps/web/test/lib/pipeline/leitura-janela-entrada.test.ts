// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerEntradaDaJanela, consultaDaJanela, EntradaInvalida } from '@/lib/pipeline/leitura-janela-entrada'

const ok = (dia: string) => JSON.stringify({ rows: [{ dia_sp: dia, controle: 3, sem_read: 0, linhas: 3, tarefas_forja: 1, perdidas: 0 }] })

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

  // Onda 3, C (software I1, dados I-2): quem concluiu a tarefa vem de result_summary->>'closed_by'.
  it('a tarefa só conta se foi fechada por chave ATIVA sem read (closed_by junto de pipeline_api_keys), e não por nome escrito no código', () => {
    const q = consultaDaJanela('2026-10-13')
    expect(q).toContain("result_summary->>'closed_by'")
    expect(q).toMatch(/join pipeline_api_keys \w+ on \w+\.id::text = \w+\.result_summary->>'closed_by'/)
    expect(q).toMatch(/revoked_at is null/)
    expect(q).toMatch(/not \(\w+\.permissions && array\['read','write','admin'\]\)/)
    expect(q).not.toMatch(/forja \(fila\)/)
    expect(q).not.toMatch(/\bname\b\s*=/)
  })
  it('a consulta devolve as leituras perdidas por dia, cobrindo do dia de perdidas_desde ao dia da linha', () => {
    const q = consultaDaJanela('2026-10-13')
    expect(q).toContain("after_data->>'perdidas'")
    expect(q).toContain("after_data->>'perdidas_desde'")
    expect(q).toContain('generate_series')
  })

  // Onda 3, E (dados I-3 a): ausência não vira zero.
  it('coluna ausente é entrada malformada, uma por uma (sem_read, controle, linhas, tarefas_forja, perdidas)', () => {
    const base = { dia_sp: '2026-10-13', controle: 3, sem_read: 0, linhas: 3, tarefas_forja: 1, perdidas: 0 }
    for (const campo of ['sem_read', 'controle', 'linhas', 'tarefas_forja', 'perdidas'] as const) {
      const { [campo]: _fora, ...sem } = base
      expect(() => lerEntradaDaJanela(JSON.stringify({ rows: [sem] })), campo).toThrow(new RegExp(`"${campo}"`))
      expect(() => lerEntradaDaJanela(JSON.stringify({ rows: [{ ...base, [campo]: null }] })), `${campo} nulo`).toThrow(EntradaInvalida)
    }
  })
  it('a linha de produção devolvida por inteiro continua aceita, com os números como texto (o banco devolve bigint como texto em alguns clientes)', () => {
    const r = lerEntradaDaJanela(JSON.stringify({ rows: [{ dia_sp: '2026-10-13', controle: '3', sem_read: '2', linhas: '5', tarefas_forja: '1', perdidas: '0' }] }))
    expect(r[0]).toEqual({ dia_sp: '2026-10-13', controle: 3, sem_read: 2, linhas: 5, tarefas_forja: 1, perdidas: 0 })
  })
})
