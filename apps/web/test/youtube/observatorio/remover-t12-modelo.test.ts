// @vitest-environment node
// M3b T12 (B1/B2): as frases do diálogo "Remover canal" que dependem do arquivo e do Blob, e o aviso depois de apagar.
import { describe, it, expect } from 'vitest'
import {
  fraseBlobDialogo, fraseCapacidade, fraseDoErro, linhaArquivo, mesAno, opcaoApagar, temArquivo, toastApagado, type ArquivoImpact,
} from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'
import { parseImpactoDoArquivo } from '@/lib/youtube/observatorio/arquivo/impacto-arquivo'

const VAZIO: ArquivoImpact = { meses: 0, de: null, ate: null, foraDoBanco: { meses: 0, de: null, ate: null }, videosRetirados: { n: 0, de: null, ate: null }, imagensBlob: 0 }
const com = (o: Partial<ArquivoImpact>): ArquivoImpact => ({ ...VAZIO, ...o })
const PODE = { pode: true } as const

describe('parseImpactoDoArquivo', () => {
  const OK = { status: 'ok', meses: 2, de: '2026-09', ate: '2026-10', registros: 40, fora_do_banco: { meses: 1, de: '2026-09', ate: '2026-09' }, videos_retirados: { n: 3, de: '2026-01-02', ate: '2026-02-03' }, imagens_blob: 47 }
  it('lê a forma da função', () => {
    expect(parseImpactoDoArquivo(OK)).toEqual({ meses: 2, de: '2026-09', ate: '2026-10', foraDoBanco: { meses: 1, de: '2026-09', ate: '2026-09' }, videosRetirados: { n: 3, de: '2026-01-02', ate: '2026-02-03' }, imagensBlob: 47 })
  })
  it('canal sem arquivo: zeros de verdade e datas nulas', () => {
    const r = parseImpactoDoArquivo({ status: 'ok', meses: 0, de: null, ate: null, registros: 0, fora_do_banco: { meses: 0, de: null, ate: null }, videos_retirados: { n: 0, de: null, ate: null }, imagens_blob: 0 })
    expect(r).toEqual(VAZIO)
  })
  it('nao_encontrado é nulo', () => { expect(parseImpactoDoArquivo({ status: 'nao_encontrado' })).toBeNull() })
  it.each([
    ['nulo', null], ['lista', []], ['status', { ...OK, status: 'x' }], ['meses ausente', { ...OK, meses: undefined }], ['meses texto', { ...OK, meses: '2' }],
    ['imagens ausente', { ...OK, imagens_blob: undefined }], ['imagens negativas', { ...OK, imagens_blob: -1 }],
    ['fora ausente', { ...OK, fora_do_banco: undefined }], ['retirados sem n', { ...OK, videos_retirados: {} }],
  ])('%s lança, nunca vira zero', (_n, d) => { expect(() => parseImpactoDoArquivo(d)).toThrow('obs_archive_channel_archive_impact') })
})

describe('mesAno e a 5ª linha (Q1)', () => {
  it('YYYY-MM vira MM/YYYY', () => { expect(mesAno('2026-09')).toBe('09/2026') })
  it('sem arquivo (N = 0): sem linha', () => { expect(linhaArquivo(VAZIO)).toBeNull() })
  it('meses sem as datas: a frase não cita faixa (singular e plural)', () => {
    expect(linhaArquivo(com({ meses: 3, de: null, ate: null }))).toEqual({ n: 3, rotulo: 'meses já no arquivo', sub: 'Ficam como estão: o arquivo não é tocado.' })
    expect(linhaArquivo(com({ meses: 1, de: null, ate: null }))).toEqual({ n: 1, rotulo: 'mês já no arquivo', sub: 'Fica como está.' })
  })
  it('9 meses', () => {
    expect(linhaArquivo(com({ meses: 9, de: '2026-01', ate: '2026-09' }))).toEqual({ n: 9, rotulo: 'meses já no arquivo', sub: 'de 01/2026 a 09/2026. Ficam como estão: o arquivo não é tocado.' })
  })
  it('1 mês (singular)', () => {
    expect(linhaArquivo(com({ meses: 1, de: '2026-09', ate: '2026-09' }))).toEqual({ n: 1, rotulo: 'mês já no arquivo', sub: 'em 09/2026. Fica como está.' })
  })
  it('só vídeos retirados, sem mês: sem linha (a linha conta meses)', () => {
    expect(linhaArquivo(com({ videosRetirados: { n: 3, de: null, ate: null } }))).toBeNull()
  })
})

describe('temArquivo', () => {
  it('meses ou vídeos retirados', () => {
    expect(temArquivo(VAZIO)).toBe(false)
    expect(temArquivo(com({ meses: 1 }))).toBe(true)
    expect(temArquivo(com({ videosRetirados: { n: 1, de: null, ate: null } }))).toBe(true)
    expect(temArquivo(null)).toBe(false)
  })
})

describe('opcaoApagar com arquivo (Q2)', () => {
  const dois = { meses: 2, de: '2026-09', ate: '2026-10' }
  it('Q2a: meses, todos no banco, sem "única cópia"', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com(dois) })
    expect(o).toEqual({ ativa: false, porque: 'Este canal tem 2 meses no arquivo (09/2026 a 10/2026). Para não perder esse histórico, use Guardar no NAS.' })
  })
  it('Q2b: algum mês fora do banco => única cópia', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com({ ...dois, foraDoBanco: { meses: 1, de: '2026-09', ate: '2026-09' } }) })
    expect(o).toEqual({ ativa: false, porque: 'Este canal tem 2 meses no arquivo (09/2026 a 10/2026), 1 já fora do banco. Para não perder a única cópia, use Guardar no NAS.' })
  })
  it('Q2c: só vídeos retirados', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com({ videosRetirados: { n: 3, de: null, ate: null } }) })
    expect(o).toEqual({ ativa: false, porque: '3 vídeos deste canal já foram retirados do banco e só existem no arquivo. Para não perder a única cópia, use Guardar no NAS.' })
  })
  it('Q2c singular', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com({ videosRetirados: { n: 1, de: null, ate: null } }) })
    expect(o).toMatchObject({ ativa: false, porque: '1 vídeo deste canal já foi retirado do banco e só existe no arquivo. Para não perder a única cópia, use Guardar no NAS.' })
  })
  it('1 mês: sem "a"', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com({ meses: 1, de: '2026-09', ate: '2026-09' }) })
    expect(o).toMatchObject({ porque: 'Este canal tem 1 mês no arquivo (09/2026). Para não perder esse histórico, use Guardar no NAS.' })
  })
  it('meses e vídeos retirados juntos: as duas frases e a única cópia', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: com({ ...dois, videosRetirados: { n: 2, de: null, ate: null } }) })
    expect(o).toMatchObject({ ativa: false, porque: 'Este canal tem 2 meses no arquivo (09/2026 a 10/2026). 2 vídeos deste canal já foram retirados do banco e só existem no arquivo. Para não perder a única cópia, use Guardar no NAS.' })
  })
  it('sem arquivo: liga como hoje', () => {
    expect(opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: VAZIO })).toEqual({ ativa: true })
    expect(opcaoApagar({ fase: 'pronto', semGuardar: PODE })).toEqual({ ativa: true })
  })
  it('corrida (o servidor respondeu apagar_com_arquivo): desligado com a frase do Q2 sem números', () => {
    expect(opcaoApagar({ fase: 'pronto', semGuardar: PODE, arquivo: VAZIO, corrida: true }))
      .toEqual({ ativa: false, porque: 'Este canal tem meses no arquivo. Para não perder esse histórico, use Guardar no NAS.' })
  })
  it('falha_contagem: continua desligado (fail closed), mesmo com arquivo lido antes', () => {
    expect(opcaoApagar({ fase: 'falha_contagem', semGuardar: null, arquivo: null })).toMatchObject({ ativa: false, porque: 'Precisa da contagem para apagar sem guardar.' })
  })
  it('contando: desligado, sem frase', () => {
    expect(opcaoApagar({ fase: 'contando', semGuardar: null, arquivo: null })).toEqual({ ativa: false, porque: '' })
  })
  it('canal antigo com arquivo: a frase do arquivo (a perda é maior)', () => {
    const o = opcaoApagar({ fase: 'pronto', semGuardar: { pode: false, porque: 'antigo', meses: 7 }, arquivo: com(dois) })
    expect(o).toMatchObject({ ativa: false }); expect((o as { porque: string }).porque).toContain('2 meses no arquivo')
  })
})

describe('a recusa apagar_com_arquivo no catálogo', () => {
  it('a frase é a do Q2, não a genérica antiga', () => {
    const f = fraseDoErro('apagar_com_arquivo', undefined, 'apagar')
    expect(f.corpo).toContain('Para não perder esse histórico, use Guardar no NAS.')
  })
})

describe('frase do Blob no diálogo (Q3)', () => {
  it('sem imagens, nenhuma frase', () => { expect(fraseBlobDialogo(0)).toBeNull() })
  it('47 imagens: diz o que o clique faz (I3)', () => {
    expect(fraseBlobDialogo(47)).toEqual({
      linha1Antes: 'Este canal tem 47 imagens guardadas no Blob', linha1Depois: '. Ao apagar, elas ficam anotadas para apagar.',
      linha2: 'O site tenta apagar as imagens agora; o que não sair fica anotado, e o aviso depois do clique diz quantas sobraram.',
    })
  })
  it('1 imagem: singular', () => {
    expect(fraseBlobDialogo(1)).toEqual({
      linha1Antes: 'Este canal tem 1 imagem guardada no Blob', linha1Depois: '. Ao apagar, ela fica anotada para apagar.',
      linha2: 'O site tenta apagar a imagem agora; se não sair, fica anotada, e o aviso depois do clique diz se sobrou.',
    })
  })
  it('nada de "continuam no Blob" no diálogo; a frase de capacidade segue para o aviso', () => {
    expect(fraseBlobDialogo(47)!.linha2).not.toMatch(/continuam? no Blob|sem data|não tem data/)
    expect(fraseCapacidade('sim', 1, null, 'dialogo')).toBe('O site tenta apagá-la todo dia, e a página do Arquivo mostra quantas faltam.')
  })
  it('com data: "chega em dd/mm"', () => {
    expect(fraseCapacidade('nao-sim', 47, '2026-12-05', 'dialogo')).toBe('A limpeza das imagens chega em 05/12; até lá elas continuam no Blob, e a página do Arquivo mostra quantas faltam.')
  })
  it('data ilegível: cai em "ainda não tem data" (nunca "chega em sem data")', () => {
    expect(fraseCapacidade('nao-sim', 47, 'amanhã', 'dialogo')).toContain('ainda não tem data para chegar')
  })
  it('a palavra "comando" não aparece nas frases (D4)', () => {
    for (const cap of ['sim', 'nao-sim', 'nao-nao'] as const) {
      expect(fraseCapacidade(cap, 3, null, 'dialogo')).not.toMatch(/comando/i)
      expect(fraseCapacidade(cap, 3, null, 'toast')).not.toMatch(/comando/i)
    }
  })
  it('no toast, sem comando: "não há nada a fazer"', () => {
    expect(fraseCapacidade('nao-sim', 47, null, 'toast')).toBe('A limpeza das imagens ainda não tem data para chegar; até lá não há nada a fazer.')
  })
})

describe('toastApagado (Q4)', () => {
  const base = { videos: 12, leituras: 340 }
  const nome = 'Viaje com Marina'
  it('com imagens restantes: âmbar, título com o número lido, fixo', () => {
    const t = toastApagado(nome, { ...base, imagensRestantes: 47, imagensAoAbrir: 47, capacidade: 'nao-sim', dataDoComando: null })
    expect(t.kind).toBe('warn'); expect(t.fixo).toBe(true)
    expect(t.titulo).toBe('Apagado, com 47 imagens no Blob')
    expect(t.corpo).toBe('Viaje com Marina saiu, sem cópia: 12 vídeos e 340 leituras. 47 imagens do canal ainda estão no Blob. A limpeza das imagens ainda não tem data para chegar; até lá não há nada a fazer. A vaga foi liberada. A ação foi registrada.')
  })
  it('1 imagem, singular', () => {
    const t = toastApagado(nome, { ...base, imagensRestantes: 1, imagensAoAbrir: 1, capacidade: 'nao-nao', dataDoComando: null })
    expect(t.titulo).toBe('Apagado, com 1 imagem no Blob')
    expect(t.corpo).toContain('1 imagem do canal ainda está no Blob. A limpeza das imagens ainda não tem data para chegar; até lá não há nada a fazer.')
  })
  it('com o comando ligado: a frase "O site tenta apagá-las todo dia"', () => {
    const t = toastApagado(nome, { ...base, imagensRestantes: 47, imagensAoAbrir: 47, capacidade: 'sim', dataDoComando: null })
    expect(t.corpo).toContain('47 imagens do canal ainda estão no Blob. O site tenta apagá-las todo dia, e a página do Arquivo mostra quantas faltam. A vaga')
  })
  it('a leitura de depois do clique não veio e havia imagens ao abrir: âmbar, "sem conferir", nunca zero', () => {
    const t = toastApagado(nome, { ...base, imagensAoAbrir: 47, capacidade: 'nao-sim', dataDoComando: null })
    expect(t).toMatchObject({ kind: 'warn', fixo: true, titulo: 'Apagado, sem conferir as imagens' })
    expect(t.corpo).toBe('Viaje com Marina saiu, sem cópia: 12 vídeos e 340 leituras. Não deu para conferir as imagens do canal no Blob; quando você abriu esta janela havia 47. A vaga foi liberada. A ação foi registrada.')
  })
  it('zero lido depois do clique: verde, o aviso de hoje, some sozinho', () => {
    const t = toastApagado(nome, { ...base, imagensRestantes: 0, imagensAoAbrir: 47 })
    expect(t).toEqual({ kind: 'ok', fixo: false, titulo: 'Apagado', corpo: 'Viaje com Marina saiu, sem cópia: 12 vídeos e 340 leituras. A vaga foi liberada. A ação foi registrada.' })
  })
  it('sem nada sobre imagens (não havia ao abrir e nada veio): o aviso de hoje', () => {
    expect(toastApagado(nome, base).kind).toBe('ok')
  })
})
