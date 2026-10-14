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
  type TipoDetalhe,
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

  // Tabela inteira, escrita à mão: trocar dois vizinhos quaisquer em codigos.ts mata um destes testes.
  // `detalhe` segue a seção traffic_source_detail da documentação do Reporting API; sem menção
  // lá, 'nenhum' (na dúvida, o valor que NÃO deixa passar texto de terceiros).
  const ORIGENS: Array<[string, string | null, string, TipoDetalhe]> = [
    ['0', 'NO_LINK_OTHER', 'Direto ou desconhecido', 'nenhum'],
    ['1', 'ADVERTISING', 'Publicidade no YouTube', 'outro'],
    ['3', 'SUBSCRIBER', 'Recursos de navegação', 'outro'],
    ['4', 'YT_CHANNEL', 'Canais do YouTube', 'canal'],
    ['5', 'YT_SEARCH', 'Pesquisa do YouTube', 'termo'],
    ['7', 'RELATED_VIDEO', 'Vídeos sugeridos', 'video'],
    ['8', 'YT_OTHER_PAGE', 'Outros recursos do YouTube', 'outro'],
    ['9', 'EXT_URL', 'Externa (links de outros sites)', 'url'],
    ['11', 'ANNOTATION', 'Cards e anotações de vídeo', 'nenhum'],
    ['14', 'PLAYLIST', 'Playlists', 'nenhum'],
    ['17', 'NOTIFICATION', 'Notificações', 'outro'],
    ['18', null, 'Páginas de playlist', 'nenhum'],
    ['19', null, 'Programação de conteúdo reivindicado', 'video'],
    ['20', 'END_SCREEN', 'Tela final', 'video'],
    ['23', null, 'Stories', 'nenhum'],
    ['24', 'SHORTS', 'Shorts', 'nenhum'],
    ['25', 'PRODUCT_PAGE', 'Páginas de produto', 'outro'],
    ['26', 'HASHTAGS', 'Páginas de hashtag', 'outro'],
    ['27', 'SOUND_PAGE', 'Páginas de som', 'video'],
    ['28', 'LIVE_REDIRECT', 'Redirecionamento de live', 'canal'],
    ['29', null, 'Podcasts', 'nenhum'],
    ['30', 'VIDEO_REMIXES', 'Vídeo remixado', 'video'],
    ['31', null, 'Feed vertical de lives', 'nenhum'],
    ['32', null, 'Vídeo relacionado', 'nenhum'],
  ]
  const APARELHOS: Array<[string, string, string]> = [
    ['100', 'UNKNOWN_PLATFORM', 'Desconhecido'],
    ['101', 'DESKTOP', 'Computador'],
    ['102', 'TV', 'TV'],
    ['103', 'GAME_CONSOLE', 'Console de videogame'],
    ['104', 'MOBILE', 'Celular'],
    ['105', 'TABLET', 'Tablet'],
  ]
  const SISTEMAS: Array<[string, string | null, string]> = [
    ['1', 'OTHER', 'Outro'],
    ['2', 'WINDOWS', 'Windows'],
    ['3', 'WINDOWS_MOBILE', 'Windows Mobile'],
    ['4', 'ANDROID', 'Android'],
    ['5', 'IOS', 'iOS'],
    ['6', 'SYMBIAN', 'Symbian'],
    ['7', 'BLACKBERRY', 'BlackBerry'],
    ['9', 'MACINTOSH', 'Macintosh'],
    ['10', 'PLAYSTATION', 'PlayStation'],
    ['11', 'BADA', 'Bada'],
    ['12', 'WEBOS', 'webOS'],
    ['13', 'LINUX', 'Linux'],
    ['14', 'HIPTOP', 'Hiptop'],
    ['15', 'MEEGO', 'MeeGo'],
    ['16', 'WII', 'Wii'],
    ['17', 'XBOX', 'Xbox'],
    ['18', 'PLAYSTATION_VITA', 'PlayStation Vita'],
    ['19', 'SMART_TV', 'Smart TV'],
    ['20', 'NINTENDO_3DS', 'Nintendo 3DS'],
    ['21', 'CHROMECAST', 'Chromecast'],
    ['22', 'TIZEN', 'Tizen'],
    ['23', 'FIREFOX', 'Firefox OS'],
    ['24', 'REALMEDIA', 'RealMedia'],
    ['25', 'KAIOS', 'KaiOS'],
    ['26', null, 'Roku'],
    ['27', null, 'Nintendo Switch'],
    ['28', null, 'Apple tvOS'],
    ['29', null, 'Fire OS'],
    ['30', null, 'ChromeOS'],
    ['31', 'VIDAA', 'Vidaa'],
    ['32', null, 'VegaOS'],
  ]

  it('origens: a tabela inteira (código, par da Analytics, rótulo, detalhe)', () => {
    expect(ORIGENS).toHaveLength(24)
    expect(Object.keys(ORIGEM_LOTE)).toHaveLength(ORIGENS.length)
    for (const [codigo, nome, rotulo, detalhe] of ORIGENS) {
      expect(ORIGEM_LOTE[codigo], `origem ${codigo}`).toEqual({ nome, rotulo, detalhe })
      expect(rotuloOrigem(codigo), `rótulo da origem ${codigo}`).toEqual({ rotulo, catalogado: true })
      if (nome) expect(rotuloOrigem(nome), `rótulo de ${nome}`).toEqual({ rotulo, catalogado: true })
      expect(tipoDoDetalhe(codigo), `detalhe da origem ${codigo}`).toBe(detalhe)
    }
  })

  it('aparelhos: a tabela inteira (código, par da Analytics, rótulo)', () => {
    expect(Object.keys(APARELHO_LOTE)).toHaveLength(APARELHOS.length)
    for (const [codigo, nome, rotulo] of APARELHOS) {
      expect(APARELHO_LOTE[codigo], `aparelho ${codigo}`).toEqual({ nome, rotulo })
      expect(rotuloAparelho(codigo)).toEqual({ rotulo, catalogado: true })
      expect(rotuloAparelho(nome)).toEqual({ rotulo, catalogado: true })
    }
  })

  it('sistemas: a tabela inteira (código, par da Analytics, rótulo)', () => {
    expect(SISTEMAS).toHaveLength(31)
    expect(Object.keys(SISTEMA_LOTE)).toHaveLength(SISTEMAS.length)
    for (const [codigo, nome, rotulo] of SISTEMAS) {
      expect(SISTEMA_LOTE[codigo], `sistema ${codigo}`).toEqual({ nome, rotulo })
      expect(rotuloSistema(codigo)).toEqual({ rotulo, catalogado: true })
      if (nome) expect(rotuloSistema(nome)).toEqual({ rotulo, catalogado: true })
    }
  })

  it('entrada com espaço ou vazia: trim, e vazio vira "sem valor"', () => {
    for (const v of [' 5', '5 ', '5\n', '\t5\r\n']) {
      expect(rotuloOrigem(v), JSON.stringify(v)).toEqual({ rotulo: 'Pesquisa do YouTube', catalogado: true })
      expect(tipoDoDetalhe(v), JSON.stringify(v)).toBe('termo')
    }
    expect(rotuloAparelho(' 104 ')).toEqual({ rotulo: 'Celular', catalogado: true })
    expect(rotuloSistema('IOS\n')).toEqual({ rotulo: 'iOS', catalogado: true })
    expect(rotuloOrigem(' 99 ')).toEqual({ rotulo: 'código 99', catalogado: false })
    for (const v of ['', '   ', '\n']) {
      expect(rotuloOrigem(v)).toEqual({ rotulo: 'sem valor', catalogado: false })
      expect(rotuloAparelho(v)).toEqual({ rotulo: 'sem valor', catalogado: false })
      expect(rotuloSistema(v)).toEqual({ rotulo: 'sem valor', catalogado: false })
      expect(tipoDoDetalhe(v)).toBe('outro')
    }
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
    expect(motivoNormalizadorHumano('bruto_ausente')).toBe('o arquivo bruto do relatório não está guardado')
    expect(motivoNormalizadorHumano('gzip_invalido')).toBe('o arquivo do relatório não abriu (compactação inválida)')
    expect(motivoNormalizadorHumano('cabecalho_inesperado')).toBe('o cabeçalho do relatório não é o esperado')
    expect(motivoNormalizadorHumano('linha_invalida')).toBe('o relatório tem uma linha que não pôde ser lida')
    expect(motivoNormalizadorHumano('canal_inesperado')).toBe('o relatório traz linhas de outro canal')
    expect(motivoNormalizadorHumano('dia_inesperado')).toBe('o relatório traz um dia fora do esperado')
    expect(motivoNormalizadorHumano('recusado_pelo_banco')).toBe('o banco recusou a gravação das linhas do relatório')
  })

  it('motivo fora do catálogo não lança', () => {
    expect(motivoNormalizadorHumano('qualquer_coisa')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('__proto__')).toBe('motivo não catalogado')
    expect(motivoNormalizadorHumano('toString')).toBe('motivo não catalogado')
  })
})
