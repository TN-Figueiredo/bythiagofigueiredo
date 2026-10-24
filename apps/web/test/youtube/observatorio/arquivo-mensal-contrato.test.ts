// apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  CLASSES, TABELAS_DA_CLASSE, FILHO_DA_CLASSE, RESERVADOS, COLUNA_DE_CONTROLE, CorpoExportar, CorpoAtestar, CorpoBatimento,
  RespostaPlanoB2, RespostaBatimento, parDaPolitica, MES_RE, TETO_LINHAS_DA_UNIDADE,
} from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import {
  caminhoDaUnidade, caminhoDaParte, caminhoDoResumo, caminhoDoManifesto, caminhoDoCanario, idDaParte, idDoManifesto, lerArquivoId,
  CaminhoInvalido,
} from '@/lib/youtube/observatorio/arquivo-mensal/caminho'

const CANAL = '0b8f7a52-3c1e-4d2a-9f00-1234567890ab'

describe('arquivo mensal: contrato e caminhos (itens 131 e 158)', () => {
  it('a classe é o primeiro nível e o canal vem logo abaixo dela', () => {
    expect(caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-10', versao: 1 }))
      .toBe(`serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.csv.gz`)
  })
  it('o bruto nas duas classes gera dois caminhos diferentes, em filhos diferentes só quando a classe pede', () => {
    const a = caminhoDaUnidade({ classe: 'texto', canal: CANAL, tabela: 'competitor_raw', mes: '2026-12', versao: 1 })
    const b = caminhoDaUnidade({ classe: 'video_antigo', canal: CANAL, tabela: 'competitor_raw', mes: '2026-12', versao: 1 })
    expect(a).not.toBe(b)
    expect(FILHO_DA_CLASSE.texto).toBe('texto')
    expect(FILHO_DA_CLASSE.video_antigo).toBe('texto')
  })
  it('parte, resumo, manifesto e canário', () => {
    expect(caminhoDaParte({ classe: 'horaria', canal: CANAL, tabela: 'competitor_video_hourly', mes: '2026-11', versao: 2, parte: 3 }))
      .toBe(`horaria/canais/${CANAL}/competitor_video_hourly/2026-11.v2.p03.csv.gz`)
    expect(caminhoDoResumo({ classe: 'serie', canal: CANAL, mes: '2026-10', versao: 1, papel: 'video' }))
      .toBe(`serie/canais/${CANAL}/resumo/2026-10.v1.video.csv.gz`)
    expect(caminhoDoManifesto({ classe: 'serie', mes: '2026-10', versao: 1, papel: 'sha256' })).toBe('serie/manifestos/2026-10.v1.sha256')
    expect(caminhoDoCanario('2026-11-28')).toBe('_canario/2026-11-28')
  })
  it('a ficha só existe na classe video_antigo', () => {
    expect(() => caminhoDoResumo({ classe: 'serie', canal: CANAL, mes: '2026-10', versao: 1, papel: 'ficha' })).toThrow(CaminhoInvalido)
  })
  it('nenhuma classe e nenhuma tabela usa nome reservado', () => {
    const tabelas = Object.values(TABELAS_DA_CLASSE).flat()
    for (const r of RESERVADOS) {
      expect(CLASSES as readonly string[]).not.toContain(r)
      expect(tabelas).not.toContain(r)
    }
  })
  it('valor fora das listas lança, nunca monta caminho', () => {
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_raw', mes: '2026-10', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: '../x', tabela: 'competitor_video_daily', mes: '2026-10', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-13', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-10', versao: 0 })).toThrow(CaminhoInvalido)
  })
  it('ids: forma, ida e volta', () => {
    expect(idDaParte(CANAL, 7)).toBe(`p:${CANAL}:07`)
    expect(idDoManifesto('texto', '2026-11', 3, 'json')).toBe('m:texto:2026-11:v3:json')
    expect(lerArquivoId(`s:${CANAL}:canal`)).toEqual({ tipo: 'resumo', id: CANAL, papel: 'canal' })
    expect(lerArquivoId('m:texto:2026-11:v3:sha256')).toEqual({ tipo: 'manifesto', classe: 'texto', mes: '2026-11', versao: 3, papel: 'sha256' })
    expect(lerArquivoId('x:1')).toBeNull()
  })
  it('coluna de controle igual à da E10', () => {
    expect(COLUNA_DE_CONTROLE.competitor_video_daily).toBe('views')
    expect(COLUNA_DE_CONTROLE.competitor_video_comment_marks).toBe('likes')
    expect(COLUNA_DE_CONTROLE.competitor_raw).toBeNull()
  })
  it('par (classe, tabela) fora da política: o Zod aceita a forma, a regra recusa (a rota responde 422, nunca 400)', () => {
    expect(CorpoExportar.safeParse({ classe: 'serie', tabela: 'competitor_raw', canal: CANAL, mes: '2026-10' }).success).toBe(true)
    expect(parDaPolitica({ classe: 'serie', tabela: 'competitor_raw' })).toBe(false)
    expect(parDaPolitica({ classe: 'texto', tabela: 'competitor_raw' })).toBe(true)
  })
  it('mês fora de 20xx recusa (o ::date do banco daria 500)', () => {
    expect(MES_RE.test('0000-01')).toBe(false)
    expect(MES_RE.test('2026-10')).toBe(true)
  })
  it('atestar do B2 com presente exige file_id e upload_timestamp; prefixo_* não existe na M3b', () => {
    const base = { fonte: 'b2', execucao_id: CANAL, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'presente', sha256: 'a'.repeat(64), bytes: 1, linhas: 1, soma: '1', tentativa: 1 }] }
    expect(CorpoAtestar.safeParse(base).success).toBe(false)
    expect(CorpoAtestar.safeParse({ ...base, itens: [{ ...base.itens[0], file_id: '4_zabc', upload_timestamp: 1 }] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ ...base, itens: [{ arquivo_id: 'x', resultado: 'prefixo_ausente', tentativa: 1 }] }).success).toBe(false)
  })
  it('nao_decifra (K4): exige file_id e upload_timestamp, proíbe sha256', () => {
    const it0 = { arquivo_id: `u:${CANAL}`, resultado: 'nao_decifra', file_id: '4_zabc', upload_timestamp: 1, tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [it0] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...it0, sha256: 'a'.repeat(64) }] }).success).toBe(false)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...it0, file_id: undefined }] }).success).toBe(false)
  })
  it('controle negativo presente vai com file_id e sem sha256 (Pedido 10)', () => {
    const neg = { arquivo_id: 'controle_negativo', resultado: 'presente', file_id: '4_zabc', upload_timestamp: 1, tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [neg] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...neg, sha256: 'a'.repeat(64), bytes: 1 }] }).success).toBe(false)
  })
  it('attest do B2: 1..200 itens', () => {
    const item = { arquivo_id: `u:${CANAL}`, resultado: 'ausente', tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: Array(201).fill(item) }).success).toBe(false)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [] }).success).toBe(false)
  })
  it('ilegivel no NAS (K4): sem sha256, linhas e soma', () => {
    const nas = { fonte: 'nas', plano_id: CANAL, filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [] }
    expect(CorpoAtestar.safeParse({ ...nas, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'ilegivel' }] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ ...nas, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'ilegivel', sha256: 'a'.repeat(64), bytes: 1 }] }).success).toBe(false)
  })
  it('batimento exige total_bytes e aceita parado_no_teto', () => {
    const b = { versao: 'abc1234', hora_maquina: '2026-11-28T03:17:00-03:00', nas_ok: true, montagens_ok: { numerico: true, texto: true },
      sentinela_ok: { numerico: true, texto: true }, livre_bytes: { numerico: 10, texto: 10 }, parado_no_teto: null, ultimo_erro: null }
    expect(CorpoBatimento.safeParse(b).success).toBe(false)
    expect(CorpoBatimento.safeParse({ ...b, total_bytes: { numerico: 100, texto: 100 } }).success).toBe(true)
  })
  it('plano do B2: estado por filho e dois canários, caminho nulo aceito (K1, Pedido 8)', () => {
    const r = RespostaPlanoB2.safeParse({ execucao_id: CANAL, gerado_em: '2026-11-30T14:07:00Z', modo: 'normal', cursor_seguinte: null,
      primeira_selagem: '2026-10', vermelhos: [], estado: { numerico: 'nada_devido', texto: 'aguardando_primeira_selagem' },
      teto_bytes_dia: 6e9, teto_bytes_mes: 5e10, controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico', caminho: '_canario/x-nao-existe' },
      canarios: [{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: '_canario/2026-11-29' }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }],
      arquivos: [], prefixos_ausentes: [], retomado_de: null, cobertura: null })
    expect(r.success).toBe(true)
  })
  it('plano do B2: retomado_de e cobertura (r2.2, I3 do Phil)', () => {
    const base = { execucao_id: CANAL, gerado_em: '2026-11-30T14:07:00Z', cursor_seguinte: null, primeira_selagem: '2026-10', vermelhos: [],
      estado: { numerico: 'com_pedidos', texto: 'com_pedidos' }, teto_bytes_dia: 6e9, teto_bytes_mes: 5e10,
      controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico', caminho: '_controle/x' },
      canarios: [{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: null }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }],
      arquivos: [], prefixos_ausentes: [] }
    const cur = `${CANAL}|u:${CANAL}`
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: cur, cobertura: { paginas_aceitas: 3, paginas_total: 5 } }).success).toBe(true)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 1 } }).success).toBe(true)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: null }).success).toBe(false)          // completo sem cobertura
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 6, paginas_total: 5 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 0 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', retomado_de: cur, cobertura: null }).success).toBe(false)              // normal nunca retoma
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 1 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', cobertura: null }).success).toBe(false)                                 // campo ausente
  })
  it('batimento: a cor do teto só nas três cores, ou nula (r2.2, M6 do Phil)', () => {
    for (const teto of ['verde', 'ambar', 'vermelho', null]) expect(RespostaBatimento.safeParse({ gravado: false, teto }).success).toBe(true)
    expect(RespostaBatimento.safeParse({ gravado: true, teto: 'amarelo' }).success).toBe(false)
    expect(RespostaBatimento.safeParse({ gravado: true }).success).toBe(false)
  })
})

describe('teto de linhas por unidade (Phil I-1)', () => {
  // 99.200 linhas levaram 11,7 s local; x4,05 em produção = 47,4 s > 30 s (metade do maxDuration). replan-23-10/phil.md §1c
  it('fica em 60.000 ou menos', () => {
    expect(TETO_LINHAS_DA_UNIDADE).toBeLessThanOrEqual(60_000)
  })
})
