// @vitest-environment node
/** A5 · E17 degrau 1, portão do N3 (Yannis Y2): `mascararCrus` troca a mensagem técnica crua da coleta por uma frase fixa em todo campo de texto do modelo. */
import { describe, expect, it } from 'vitest'
import { mascararCrus } from '@/lib/youtube/observatorio/contexto-ia/mascarar'
import { ERRO_DA_COLETA_SEM_DETALHE } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { modeloCheio } from './contexto-ia-fixture'

const CRU = 'trava do canal: duplicate key value violates unique constraint "x_pkey"'

function comCru(): PacoteModelo {
  const m = modeloCheio()
  const t = m.tabelas[0]!
  t.linhas[0]![0] = { papel: 'base', texto: `erro desde 10/10 · ${CRU}`, origem: 'x.a' }
  t.linhas[0]![1] = { papel: 'numero', estado: 'nao_medido', motivo: `por causa de ${CRU}`, origem: 'x.b' }
  t.linhas[0]![2] = { papel: 'terceiros', texto: CRU, origem: 'x.c' }
  m.citados = [{ rotulo: 'r', texto: `a ${CRU} b`, origem: 'x.d' }]
  m.avisos = [`aviso ${CRU}`]
  m.avisosPrivados = [`privado ${CRU}`]
  m.naoMede = [`nao ${CRU}`]
  m.definicoes = [{ medida: 'm', frase: `def ${CRU}`, limiares: [`lim ${CRU}`] }]
  m.foco = [{ nome: 'n', oQueE: 'concorrente', detalhe: `det ${CRU}` }]
  m.janela = `j ${CRU}`
  m.vazio = `v ${CRU}`
  m.motivoDoMagro = `mm ${CRU}`
  return m
}

describe('mascararCrus', () => {
  it('nenhum campo de texto do modelo leva a mensagem crua depois; a frase fixa entra no lugar', () => {
    const saida = mascararCrus(comCru(), [CRU])
    const json = JSON.stringify(saida)
    expect(json).not.toContain(CRU)
    expect(json).not.toContain('duplicate key')
    expect(json.split(ERRO_DA_COLETA_SEM_DETALHE).length - 1).toBeGreaterThanOrEqual(13)
  })
  it('não altera o modelo de entrada (cópia)', () => {
    const m = comCru()
    const antes = JSON.stringify(m)
    mascararCrus(m, [CRU])
    expect(JSON.stringify(m)).toBe(antes)
  })
  it('lista vazia e cru vazio não mudam nada', () => {
    const m = comCru()
    expect(mascararCrus(m, [])).toEqual(m)
    expect(mascararCrus(m, [''])).toEqual(m)
  })
  it('é idempotente', () => {
    const uma = mascararCrus(comCru(), [CRU])
    expect(mascararCrus(uma, [CRU])).toEqual(uma)
  })
  it('vários crus: cada um sai, o mais longo primeiro (um cru dentro de outro não deixa resto)', () => {
    const m = comCru()
    m.avisos = ['abc', `abc def ${'abc'}`]
    const saida = mascararCrus(m, ['abc', 'abc def', CRU])
    expect(JSON.stringify(saida)).not.toContain('abc')
  })
})
