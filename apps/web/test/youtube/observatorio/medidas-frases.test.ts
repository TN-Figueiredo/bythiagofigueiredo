// @vitest-environment node
// A5 · E7, Tarefa 11: a tabela única de frases dos motivos de "não medido" (a rota do Cowork e as telas leem a mesma).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const capturarMensagem = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => capturarMensagem(...a) }))

import { FRASES_DE_MOTIVO, fraseDoMotivo, type ContextoDaFrase } from '@/lib/youtube/observatorio/medidas-frases'
import { MOTIVOS_NAO_MEDIDO, naoMedido, type MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { TERMOS_PROIBIDOS, acharTermoProibido } from './medidas-termos-proibidos'

const CHEIO: ContextoDaFrase = { n: 2, minimo: 5, desde: '2026-10-03', fechaEm: '2026-12-14', idade: 7 }
const VAZIO: ContextoDaFrase = {}
beforeEach(() => capturarMensagem.mockReset())

describe('a tabela cobre o catálogo', () => {
  it('todo motivo do catálogo tem frase: mais de 15 caracteres, sem undefined, null, NaN nem chaves', () => {
    expect(MOTIVOS_NAO_MEDIDO).toHaveLength(35)
    for (const m of MOTIVOS_NAO_MEDIDO) for (const c of [VAZIO, CHEIO]) {
      const f = FRASES_DE_MOTIVO[m](c)
      expect(f.length, m).toBeGreaterThan(15)
      expect(f, m).not.toMatch(/undefined|null|NaN|[{}]/)
    }
  })

  it('nenhuma frase traz número escrito quando o argumento vem vazio', () => {
    for (const m of MOTIVOS_NAO_MEDIDO) expect(FRASES_DE_MOTIVO[m](VAZIO), m).not.toMatch(/\d/)
  })

  it('duas frases nunca são iguais', () => {
    const todas = MOTIVOS_NAO_MEDIDO.map(m => FRASES_DE_MOTIVO[m](VAZIO))
    expect(new Set(todas).size).toBe(todas.length)
  })

  it('uma oração, sem imperativo para o Cowork e sem ponto final no meio', () => {
    for (const m of MOTIVOS_NAO_MEDIDO) {
      const f = FRASES_DE_MOTIVO[m](CHEIO)
      expect(f, m).not.toMatch(/\.\s|\.$/)
      expect(f, m).not.toMatch(/\b(use|tente|peça|chame|espere|aguarde|ignore)\b/i)
    }
  })
})

describe('o que vem do argumento', () => {
  it('os números vêm do argumento', () => {
    expect(FRASES_DE_MOTIVO.poucos_videos({ n: 2, minimo: 5 })).toBe('há 2 vídeos na janela e a medida pede 5')
    expect(FRASES_DE_MOTIVO.poucos_videos({})).toBe('há poucos vídeos na janela para medir')
    const p = FRASES_DE_MOTIVO.poucas_publicacoes({ n: 3, minimo: 4 })
    expect(p).toContain('3')
    expect(p).toContain('4')
  })

  it('a data sai no formato do Brasil', () => {
    expect(FRASES_DE_MOTIVO.sem_registro_na_borda({ desde: '2026-10-03' })).toBe('falta o registro do canal no dia 03/10/2026')
    expect(FRASES_DE_MOTIVO.janela_cruza_mudanca_de_contagem({ fechaEm: '2026-12-14' })).toBe('a janela cruza o dia em que o YouTube mudou a contagem de views; a primeira leitura limpa fecha em 14/12/2026')
    expect(FRASES_DE_MOTIVO.janela_cruza_mudanca_de_contagem({})).not.toMatch(/fecha em/)
    expect(FRASES_DE_MOTIVO.fecha_em({ fechaEm: '2026-12-14T03:00:00.000Z' })).toContain('14/12/2026')
    expect(FRASES_DE_MOTIVO.fecha_em({})).toBe('a janela ainda não fechou e não há data prevista para fechar')
  })

  it('a idade entra na frase quando vem, e a frase não inventa idade quando não vem', () => {
    expect(FRASES_DE_MOTIVO.sem_leitura({ idade: 30 })).toContain('30')
    expect(FRASES_DE_MOTIVO.sem_leitura({})).not.toMatch(/\d/)
  })

  it('leitura_falhou diz que o valor não é conhecido', () => {
    expect(FRASES_DE_MOTIVO.leitura_falhou(VAZIO)).toBe('a leitura do banco falhou ou foi cortada nesta consulta; o valor não é conhecido')
  })

  it('fraseDoMotivo usa n, minimo, desde e fechaEm da própria medida', () => {
    const m = naoMedido('poucos_videos', { n: 2, minimo: 5 })
    if (m.estado !== 'nao_medido') throw new Error('esperava nao_medido')
    expect(fraseDoMotivo(m)).toBe('há 2 vídeos na janela e a medida pede 5')
    const b = naoMedido('sem_registro_na_borda', { desde: '2026-10-03' })
    if (b.estado !== 'nao_medido') throw new Error('esperava nao_medido')
    expect(fraseDoMotivo(b)).toContain('03/10/2026')
    const c = naoMedido('janela_cruza_mudanca_de_contagem', { fechaEm: '2026-12-14' })
    if (c.estado !== 'nao_medido') throw new Error('esperava nao_medido')
    expect(fraseDoMotivo(c)).toContain('14/12/2026')
  })
})

describe('código fora do catálogo em execução', () => {
  it('devolve a frase de leitura_falhou e avisa o Sentry com o código', () => {
    const fora = { estado: 'nao_medido', motivo: 'motivo_que_nao_existe', notas: [] } as unknown as Parameters<typeof fraseDoMotivo>[0]
    expect(fraseDoMotivo(fora)).toBe(FRASES_DE_MOTIVO.leitura_falhou(VAZIO))
    expect(capturarMensagem).toHaveBeenCalledWith('medidas.frase_sem_motivo', expect.objectContaining({ extra: { motivo: 'motivo_que_nao_existe' } }))
  })

  it('nome herdado de objeto (constructor) não vira frase', () => {
    const fora = { estado: 'nao_medido', motivo: 'constructor', notas: [] } as unknown as Parameters<typeof fraseDoMotivo>[0]
    expect(fraseDoMotivo(fora)).toBe(FRASES_DE_MOTIVO.leitura_falhou(VAZIO))
    expect(capturarMensagem).toHaveBeenCalled()
  })
})

describe('termos proibidos e dependências', () => {
  it('a lista de termos tem os dez e o achador funciona', () => {
    expect(TERMOS_PROIBIDOS).toHaveLength(10)
    expect(acharTermoProibido('o canal foi lido ontem')).toBe('lido')
    expect(acharTermoProibido('a retenção caiu')).toBe('retenção')
    expect(acharTermoProibido('a série semanal')).toBe('série')
    expect(acharTermoProibido('Ctr baixo')).toBe('CTR')
    expect(acharTermoProibido('a leitura falhou; o valor não é conhecido')).toBeNull()
  })

  it('nenhuma frase tem termo proibido nem a palavra do item 56', () => {
    for (const m of MOTIVOS_NAO_MEDIDO) for (const c of [VAZIO, CHEIO]) expect(acharTermoProibido(FRASES_DE_MOTIVO[m](c)), m).toBeNull()
  })

  it('a tabela única não depende de servidor', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/youtube/observatorio/medidas-frases.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const proibido of ['server-only', 'next/', '@/lib/supabase', '@/lib/pipeline']) expect(t, proibido).not.toContain(proibido)
    // só o aviso do código desconhecido usa o Sentry; o resto é importação de tipo
    expect([...t.matchAll(/^import .*$/gm)].map(m => m[0]).sort()).toEqual([
      "import * as Sentry from '@sentry/nextjs'",
      "import type { Medida, MotivoNaoMedido } from './medidas/tipos'",
    ].sort())
  })

  it('o singular: 1 vídeo, 1 publicação, 1 dia', () => {
    expect(FRASES_DE_MOTIVO.poucos_videos({ n: 1, minimo: 5 })).toBe('há 1 vídeo na janela e a medida pede 5')
    expect(FRASES_DE_MOTIVO.poucos_videos({ n: 2, minimo: 5 })).toBe('há 2 vídeos na janela e a medida pede 5')
    expect(FRASES_DE_MOTIVO.poucas_publicacoes({ n: 1, minimo: 4 })).toBe('há 1 publicação na janela e a medida pede 4')
    expect(FRASES_DE_MOTIVO.descoberto_tarde({ idade: 1 })).toContain('(1 dia)')
    expect(FRASES_DE_MOTIVO.descoberto_tarde({ idade: 30 })).toContain('(30 dias)')
    expect(FRASES_DE_MOTIVO.sem_leitura({ idade: 1 })).toContain('aos 1 dia de vida')
    expect(FRASES_DE_MOTIVO.sem_leitura({ idade: 7 })).toContain('aos 7 dias de vida')
  })

  it('a longa não varia por tela: a função recebe só o contexto e o módulo não tem chave tela', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/youtube/observatorio/medidas-frases.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(t).not.toMatch(/\btela\b/)
    for (const m of MOTIVOS_NAO_MEDIDO) expect(FRASES_DE_MOTIVO[m as MotivoNaoMedido].length, m).toBeLessThanOrEqual(1)
  })
})
