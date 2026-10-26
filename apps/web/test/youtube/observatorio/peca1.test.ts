// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoDaIdade, coletaDoVideo, frasePeca1, frase72h, fraseNormalDoCanal, frasePeriodo, fraseComentarioSemTexto, fraseDesdeDaHoraria, IDADES_DE_MARCA } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

const sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const base = { pub: sp('2026-10-10'), deMarca: false, onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), now: sp('2027-06-10') }

describe('peça 1', () => {
  it('nada saiu: a tela não muda, em toda idade', () => {
    for (const idadeDias of [2, 3, 5, 14, 21, 60, 90]) expect(estadoDaIdade({ ...base, onlineDesde: null, idadeDias })).toEqual({ k: 'nada_saiu' })
  })
  it('14 dias com o dia 14 no arquivo: no arquivo, nunca número', () => expect(estadoDaIdade({ ...base, idadeDias: 14 })).toEqual({ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }))
  it('Phil I8: canal adicionado depois do começo da série: coleta por vídeo, antes_da_coleta e não no arquivo', () => {
    expect(coletaDoVideo({ seriesStart: sp('2026-10-03'), addedAt: sp('2027-03-15') })).toBe(sp('2027-03-15'))
    expect(coletaDoVideo({ seriesStart: sp('2026-10-03'), addedAt: null })).toBe(sp('2026-10-03'))
    expect(estadoDaIdade({ pub: sp('2027-01-10'), idadeDias: 14, deMarca: false, onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2027-03-15'), now: sp('2027-06-10') }).k).toBe('antes_da_coleta')
  })
  it('Phil I7: o desde da horária com um mês fora diz o mês', () => {
    expect(fraseDesdeDaHoraria({ desde: sp('2026-10-01'), precisao: 'mes' })).toBe('desde outubro de 2026')
    expect(fraseDesdeDaHoraria({ desde: Date.parse('2026-11-02T17:00:00Z'), precisao: 'hora' })).toBe('desde 02/11 às 14:00')
  })
  it('1, 7 e 30 dias vêm da marca: nunca no arquivo', () => {
    expect(IDADES_DE_MARCA).toEqual([1, 7, 30])
    for (const idadeDias of IDADES_DE_MARCA) expect(estadoDaIdade({ ...base, idadeDias, deMarca: true }).k).toBe('nada_saiu')
  })
  it('o online começa depois da publicação e o ponto já está online: desde dd/mm', () => {
    expect(estadoDaIdade({ ...base, pub: sp('2027-04-20'), idadeDias: 14 })).toEqual({ k: 'desde', desde: sp('2027-05-01') })
  })
  it('não lido: só o ponto anterior ao início seguro vira não medido; o recente fica como hoje', () => {
    expect(estadoDaIdade({ ...base, onlineDesde: null, lido: false, idadeDias: 14 }).k).toBe('nao_medido')
    expect(estadoDaIdade({ ...base, pub: sp('2027-06-01'), onlineDesde: null, lido: false, idadeDias: 5 }).k).toBe('nada_saiu')
  })
  it('item 36: no arquivo, sem registro e antes da coleta dão três frases diferentes', () => {
    const a = frasePeca1({ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }, 'edita').texto
    const b = frasePeca1({ k: 'sem_registro', conferidoEm: sp('2027-05-02') }, 'edita').texto
    const c = frasePeca1({ k: 'antes_da_coleta', coleta: sp('2026-10-03') }, 'edita').texto
    expect(new Set([a, b, c]).size).toBe(3)
    expect(a).toBe('01/10 a 30/04/2027 no arquivo')
    expect(b).toBe('Sem registro neste mês (conferimos em 02/05)')
    expect(c).toBe('A coleta começou em 10/2026')
  })
  it('formas: arquivo, zero, pontilhado, hachura e nenhuma', () => {
    expect(frasePeca1({ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }, 'edita').forma).toBe('arquivo')
    expect(frasePeca1({ k: 'sem_registro', conferidoEm: sp('2027-05-02') }, 'edita').forma).toBe('zero')
    expect(frasePeca1({ k: 'antes_da_coleta', coleta: sp('2026-10-03') }, 'edita').forma).toBe('pontilhado')
    expect(frasePeca1({ k: 'nada_saiu' }, 'edita')).toEqual({ texto: '', forma: 'nenhuma', portaVerAntigo: false })
    expect(frasePeca1({ k: 'desde', desde: sp('2027-05-01') }, 'edita')).toEqual({ texto: 'desde 01/05', forma: 'nenhuma', portaVerAntigo: false })
  })
  it('não lido: frase própria, hachura', () => {
    expect(frasePeca1({ k: 'nao_medido' }, 'edita')).toEqual({ texto: 'Não foi possível ler desde quando há dado online.', forma: 'hachura', portaVerAntigo: false })
  })
  it('item 85: quem só lê vê a frase do trecho e nunca a porta', () => {
    expect(frasePeca1({ k: 'no_arquivo', de: sp('2027-08-25'), ate: sp('2027-09-30') }, 'so_le')).toEqual({ texto: '25/08 a 30/09/2027 no arquivo.', forma: 'arquivo', portaVerAntigo: false })
  })
  it('item 84: as 72 horas no arquivo (mockup: com o ano)', () => {
    expect(frase72h({ horasNoArquivoDesde: sp('2027-02-01'), lido: true })).toEqual({ texto: 'As 72 primeiras horas deste vídeo estão no arquivo desde 01/02/2027. Não dá para calcular sem as horas.', forma: 'arquivo' })
    expect(frase72h({ horasNoArquivoDesde: null, lido: true })).toBeNull()
    expect(frase72h({ horasNoArquivoDesde: null, lido: false })?.forma).toBe('hachura')
  })
  it('item 84: normal do canal com menos vídeos, e abaixo do mínimo (mockup: maiúscula, ano e ponto)', () => {
    expect(fraseNormalDoCanal({ n: 9, noArquivo: 4, minimo: 3, desde: null })).toBe('Calculado com 9 vídeos; 4 estão no arquivo.')
    expect(fraseNormalDoCanal({ n: 9, noArquivo: 0, minimo: 3, desde: null })).toBeNull()
    expect(fraseNormalDoCanal({ n: 2, noArquivo: 7, minimo: 3, desde: sp('2027-03-01') })).toBe('Não medido: desde 01/03/2027 só há 2 vídeos com as 72 horas online.')
  })
  it('item 84: período maior que o online, com o motivo', () => {
    expect(frasePeriodo({ pedidoDias: 365, online: { desde: sp('2027-03-01'), meses: 3 }, motivo: 'arquivo' })).toBe('Mostrando desde 01/03/2027 (3 meses online). Os meses anteriores estão no arquivo.')
    expect(frasePeriodo({ pedidoDias: 365, online: { desde: sp('2026-10-03'), meses: 0 }, motivo: 'coleta_recente' })).toBe('Mostrando desde 03/10/2026 (menos de 1 mês online). A coleta começou em 03/10/2026.')
  })
  it('item 84: comentário em destaque sem texto', () => {
    expect(fraseComentarioSemTexto('03/2027')).toBe('Comentário de 03/2027. O texto está no arquivo e não aparece aqui.')
  })
})
