// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESPERA_A_MG11, situacaoDaTabela } from '../../helpers/espera-a-mg11'

const conexao = (existe: string | null) => ({ query: vi.fn(async () => ({ rows: [{ existe }] })) }) as unknown as Parameters<typeof situacaoDaTabela>[0]
afterEach(() => { vi.restoreAllMocks() })

describe('espera-a-mg11 (os três ramos, com conexão simulada)', () => {
  it('tabela presente: roda, mesmo estando na lista', async () => {
    expect(await situacaoDaTabela(conexao('obs_ai_access_log'), 'obs_ai_access_log')).toBe('roda')
  })
  it('ausente e na lista: pula, e o aviso leva o nome recebido', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(await situacaoDaTabela(conexao(null), 'obs_tabela_que_nao_existe', ['obs_tabela_que_nao_existe'])).toBe('pula')
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('obs_tabela_que_nao_existe'))
  })
  it('ausente e fora da lista: lança', async () => {
    await expect(situacaoDaTabela(conexao(null), 'outra_tabela')).rejects.toThrow(/não existe/)
    await expect(situacaoDaTabela(conexao(null), 'obs_ai_access_log', [])).rejects.toThrow(/não existe/)
  })
  it('a MG11 já está em supabase/migrations: a lista padrão está vazia, e tabela ausente sem lista lança (não pula)', async () => {
    expect(ESPERA_A_MG11).toEqual([])
    await expect(situacaoDaTabela(conexao(null), 'obs_ai_access_log')).rejects.toThrow(/não existe/)
  })
})
