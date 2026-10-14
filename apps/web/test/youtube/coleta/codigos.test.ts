// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  ORIGEM_LOTE,
  APARELHO_LOTE,
  SISTEMA_LOTE,
  ORIGEM_DE_BUSCA,
  ORIGEM_EXTERNA,
  MOTIVOS_NORMALIZADOR,
  rotuloOrigem,
  rotuloAparelho,
  rotuloSistema,
  tipoDoDetalhe,
  motivoNormalizadorHumano,
} from '@/lib/youtube/reporting/codigos'

describe('codigos (catálogo de origens, aparelhos, sistemas e motivos)', () => {
  it('todo código visto em produção está no catálogo', () => {
    for (const c of ['4', '5', '8']) expect(rotuloOrigem(c).catalogado).toBe(true)
    for (const c of ['101', '102', '104', '105']) expect(rotuloAparelho(c).catalogado).toBe(true)
    for (const c of ['2', '4', '5', '9', '12']) expect(rotuloSistema(c).catalogado).toBe(true)
  })

  it('o catálogo de origens tem os 24 códigos da documentação', () => {
    expect(Object.keys(ORIGEM_LOTE).sort((a, b) => Number(a) - Number(b))).toEqual(
      ['0', '1', '3', '4', '5', '7', '8', '9', '11', '14', '17', '18', '19', '20', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'],
    )
    expect(Object.keys(APARELHO_LOTE).sort()).toEqual(['100', '101', '102', '103', '104', '105'])
    const sistemas = Object.keys(SISTEMA_LOTE).map(Number).sort((a, b) => a - b)
    expect(sistemas).toHaveLength(31)
    expect(sistemas).not.toContain(8)
    expect(sistemas[0]).toBe(1)
    expect(sistemas[sistemas.length - 1]).toBe(32)
  })

  it('código fora do catálogo não some', () => {
    expect(rotuloOrigem('99')).toEqual({ rotulo: 'código 99', catalogado: false })
    expect(rotuloAparelho('99')).toEqual({ rotulo: 'código 99', catalogado: false })
    expect(rotuloSistema('8')).toEqual({ rotulo: 'código 8', catalogado: false })
    expect(rotuloOrigem('ALGO_NOVO')).toEqual({ rotulo: 'ALGO_NOVO', catalogado: false })
  })

  it('chaves herdadas do Object não viram catálogo', () => {
    for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(rotuloOrigem(k).catalogado).toBe(false)
      expect(rotuloAparelho(k).catalogado).toBe(false)
      expect(rotuloSistema(k).catalogado).toBe(false)
      expect(tipoDoDetalhe(k)).toBe('outro')
    }
  })

  it('a busca é o 5 e o externo é o 9', () => {
    expect(ORIGEM_DE_BUSCA).toBe('5')
    expect(ORIGEM_EXTERNA).toBe('9')
    expect(ORIGEM_LOTE[ORIGEM_DE_BUSCA].nome).toBe('YT_SEARCH')
    expect(ORIGEM_LOTE[ORIGEM_EXTERNA].nome).toBe('EXT_URL')
    expect(tipoDoDetalhe('5')).toBe('termo')
    expect(tipoDoDetalhe('9')).toBe('url')
    expect(tipoDoDetalhe('0')).toBe('nenhum')
    expect(tipoDoDetalhe('999')).toBe('outro')
  })

  it('nenhum nome repetido em dois códigos', () => {
    for (const cat of [ORIGEM_LOTE, APARELHO_LOTE, SISTEMA_LOTE]) {
      const nomes = Object.values(cat)
        .map((e) => e.nome)
        .filter((n): n is string => n !== null)
      expect(new Set(nomes).size).toBe(nomes.length)
    }
  })

  it('nome da API e código do mesmo par dão o mesmo rótulo', () => {
    const grupos: Array<[Record<string, { nome: string | null; rotulo: string }>, (v: string) => { rotulo: string; catalogado: boolean }]> = [
      [ORIGEM_LOTE, rotuloOrigem],
      [APARELHO_LOTE, rotuloAparelho],
      [SISTEMA_LOTE, rotuloSistema],
    ]
    for (const [cat, fn] of grupos) {
      for (const [codigo, e] of Object.entries(cat)) {
        expect(fn(codigo)).toEqual({ rotulo: e.rotulo, catalogado: true })
        if (e.nome) expect(fn(e.nome)).toEqual({ rotulo: e.rotulo, catalogado: true })
      }
    }
    expect(rotuloOrigem('YT_SEARCH').rotulo).toBe(rotuloOrigem('5').rotulo)
    expect(rotuloAparelho('MOBILE').rotulo).toBe(rotuloAparelho('104').rotulo)
    expect(rotuloSistema('IOS').rotulo).toBe(rotuloSistema('5').rotulo)
  })

  it('os pares afirmados pelo plano que a documentação confirma', () => {
    const esperado: Record<string, string> = {
      '0': 'NO_LINK_OTHER', '1': 'ADVERTISING', '4': 'YT_CHANNEL', '5': 'YT_SEARCH', '8': 'YT_OTHER_PAGE',
      '9': 'EXT_URL', '11': 'ANNOTATION', '14': 'PLAYLIST', '17': 'NOTIFICATION', '20': 'END_SCREEN',
      '24': 'SHORTS', '25': 'PRODUCT_PAGE', '26': 'HASHTAGS', '27': 'SOUND_PAGE', '28': 'LIVE_REDIRECT',
      '30': 'VIDEO_REMIXES',
    }
    for (const [c, n] of Object.entries(esperado)) expect(ORIGEM_LOTE[c].nome).toBe(n)
    expect(APARELHO_LOTE['101'].nome).toBe('DESKTOP')
    expect(APARELHO_LOTE['102'].nome).toBe('TV')
    expect(APARELHO_LOTE['103'].nome).toBe('GAME_CONSOLE')
    expect(APARELHO_LOTE['104'].nome).toBe('MOBILE')
    expect(APARELHO_LOTE['105'].nome).toBe('TABLET')
    expect(APARELHO_LOTE['100'].nome).toBe('UNKNOWN_PLATFORM')
    expect(SISTEMA_LOTE['4'].nome).toBe('ANDROID')
    expect(SISTEMA_LOTE['5'].nome).toBe('IOS')
  })

  it('todo motivo do catálogo tem frase, e a frase não repete o código cru', () => {
    expect([...MOTIVOS_NORMALIZADOR]).toEqual([
      'bruto_ausente', 'gzip_invalido', 'cabecalho_inesperado', 'linha_invalida',
      'canal_inesperado', 'dia_inesperado', 'recusado_pelo_banco',
    ])
    for (const m of MOTIVOS_NORMALIZADOR) {
      const frase = motivoNormalizadorHumano(m)
      expect(frase.length).toBeGreaterThan(10)
      expect(frase).not.toContain(m)
      expect(frase).not.toContain('_')
      expect(frase).not.toBe('motivo não catalogado')
    }
    expect(new Set(MOTIVOS_NORMALIZADOR.map(motivoNormalizadorHumano)).size).toBe(MOTIVOS_NORMALIZADOR.length)
  })

  it('motivo fora do catálogo não lança', () => {
    expect(motivoNormalizadorHumano('qualquer_coisa')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('__proto__')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('toString')).toBe('motivo não catalogado')
  })
})
