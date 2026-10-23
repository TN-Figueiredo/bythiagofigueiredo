// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  estadoDaLinha, agruparLinhas, resumoDaLista, retomarAPartirDe, rotuloRetomar, foiTardia, prazoDoTeste,
  type EstadoLinha, type LinhaDoCaminho, type RegistroDaLista,
} from '@/lib/youtube/teste-youtube/nativo/lista'
import type { Caminho } from '@/lib/youtube/teste-youtube/nativo/roteador'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { INATIVIDADE_DESCARTE_MS } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'

const H = 3600_000
const D = 24 * H
const AGORA = new Date('2026-11-10T12:00:00Z')
const ant = (ms: number): string => new Date(AGORA.getTime() - ms).toISOString()

const nativo: Caminho = { tipo: 'nativo', portao: true, motivo: 'm' }
const nosso: Caminho = { tipo: 'nosso', motivo: 'm' }
const naoConf: Caminho = { tipo: 'nao_confirmado', motivo: 'm' }
const semVol: Caminho = { tipo: 'sem_volume', motivo: 'm' }

const reg = (o: Partial<RegistroDaLista> = {}): RegistroDaLista => ({
  estado: 'em_andamento', confirmadoEm: ant(5 * D), primeiraVista: null, createdAt: ant(5 * D),
  respostaDono: null, vencedorFonte: null, vencedorTitulo: null, tituloDaResposta: null, ...o,
})
const ficha = (variantes: number[], o: Partial<FichaLida> = {}): FichaLida => ({
  id: 'f1', site_id: 's', video_id: 'v', campos: ['titulo'],
  variantes: variantes.map((n) => ({ n, tipo: 'titulo' as const, titulo: `t${n}` })),
  criada_em: ant(1 * D), criada_por: null, atualizada_em: ant(1 * D), studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null,
  aberta: true, enviada: false, ...o,
})
const estado = (e: { caminho?: Caminho; ficha?: FichaLida | null; registro?: RegistroDaLista | null; nosso?: { status: 'active' | 'paused' } | null }): EstadoLinha =>
  estadoDaLinha({ caminho: e.caminho ?? nativo, ficha: e.ficha ?? null, registro: e.registro ?? null, nosso: e.nosso ?? null }, AGORA)

describe('estadoDaLinha: um caso por estado', () => {
  it('caminho sem nada', () => {
    expect(estado({ caminho: nativo })).toBe('sugerido_youtube')
    expect(estado({ caminho: nosso })).toBe('sugerido_nosso')
    expect(estado({ caminho: naoConf })).toBe('formato_nao_confirmado')
    expect(estado({ caminho: semVol })).toBe('sem_volume')
  })
  it('em_preparo: ficha aberta com ao menos uma versão nova; só a A não conta', () => {
    expect(estado({ ficha: ficha([1, 2]) })).toBe('em_preparo')
    expect(estado({ ficha: ficha([1]) })).toBe('sugerido_youtube')
    expect(estado({ ficha: ficha([]) })).toBe('sugerido_youtube')
  })
  it('ficha vinculada (não aberta) não é em_preparo', () => {
    expect(estado({ ficha: ficha([1, 2], { aberta: false, registro_id: 'r' }) })).toBe('sugerido_youtube')
  })
  it('ficha vencida (inatividade > 14 d) não é em_preparo; no limite ainda é', () => {
    const vencida = ficha([1, 2], { criada_em: ant(INATIVIDADE_DESCARTE_MS + 60_000), atualizada_em: ant(INATIVIDADE_DESCARTE_MS + 60_000) })
    expect(estado({ ficha: vencida })).toBe('sugerido_youtube')
    const noLimite = ficha([1, 2], { criada_em: ant(INATIVIDADE_DESCARTE_MS - 60_000), atualizada_em: ant(INATIVIDADE_DESCARTE_MS - 60_000) })
    expect(estado({ ficha: noLimite })).toBe('em_preparo')
    const lembreteRecente = ficha([1, 2], { criada_em: ant(30 * D), atualizada_em: ant(30 * D), lembrar_em: ant(1 * D) })
    expect(estado({ ficha: lembreteRecente })).toBe('em_preparo')
  })
  it('nosso_rodando só com teste active; pausado volta ao caminho', () => {
    expect(estado({ nosso: { status: 'active' } })).toBe('nosso_rodando')
    expect(estado({ nosso: { status: 'paused' } })).toBe('sugerido_youtube')
  })
  it('detectado em_andamento sem confirmação: em_teste_studio (visto de fora)', () => {
    expect(estado({ registro: reg({ confirmadoEm: null, primeiraVista: ant(3 * D) }) })).toBe('em_teste_studio')
  })
  it('registro descartado, ou encerrado sem confirmação, não conta', () => {
    expect(estado({ registro: reg({ estado: 'descartado', confirmadoEm: null }) })).toBe('sugerido_youtube')
    expect(estado({ registro: reg({ estado: 'encerrado', confirmadoEm: null }) })).toBe('sugerido_youtube')
  })
})

describe('estadoDaLinha: precedências', () => {
  it('registro aberto vence a ficha aberta e o nosso rodando', () => {
    expect(estado({ registro: reg(), ficha: ficha([1, 2]), nosso: { status: 'active' } })).toBe('em_teste_studio')
  })
  it('registro vence mesmo com ficha pronta no mesmo vídeo (detectado)', () => {
    expect(estado({ registro: reg({ confirmadoEm: null, primeiraVista: ant(1 * D) }), ficha: ficha([1, 2, 3]) })).toBe('em_teste_studio')
  })
  it('ficha aberta vence o nosso rodando', () => {
    expect(estado({ ficha: ficha([1, 2]), nosso: { status: 'active' } })).toBe('em_preparo')
  })
})

describe('estadoDaLinha: fronteiras do registro confirmado (L1: 14 d e 16 d, relógio injetado)', () => {
  const comInicio = (ms: number, o: Partial<RegistroDaLista> = {}): RegistroDaLista => reg({ confirmadoEm: ant(ms), createdAt: ant(ms), ...o })
  it('13 d 23 h: em_teste_studio', () => {
    expect(estado({ registro: comInicio(14 * D - H) })).toBe('em_teste_studio')
  })
  it('14 d 1 h: resultado_pronto (ainda em_andamento)', () => {
    expect(estado({ registro: comInicio(14 * D + H) })).toBe('resultado_pronto')
  })
  it('15 d 23 h: resultado_pronto', () => {
    expect(estado({ registro: comInicio(16 * D - H) })).toBe('resultado_pronto')
  })
  it('16 d 1 h: sem_resposta', () => {
    expect(estado({ registro: comInicio(16 * D + H) })).toBe('sem_resposta')
  })
  it('sem_desfecho sem resposta, ou resposta "sem_resposta": sem_resposta mesmo antes de 16 d', () => {
    expect(estado({ registro: comInicio(15 * D, { estado: 'sem_desfecho' }) })).toBe('sem_resposta')
    expect(estado({ registro: comInicio(15 * D, { estado: 'encerrado', respostaDono: 'sem_resposta' }) })).toBe('sem_resposta')
  })
  it('encerrado pelo registrador antes de 14 d com resposta nula: ainda em_teste_studio', () => {
    expect(estado({ registro: comInicio(10 * D, { estado: 'encerrado' }) })).toBe('em_teste_studio')
  })
  it('encerrado pelo registrador entre 14 e 16 d, sem resposta: resultado_pronto (o dono ainda responde)', () => {
    expect(estado({ registro: comInicio(15 * D, { estado: 'encerrado' }) })).toBe('resultado_pronto')
  })
  it('o início é o menor entre primeira_vista e confirmado_em', () => {
    // visto há 15 d 1 h, confirmado há 5 d: o teste começou na primeira vista
    expect(estado({ registro: reg({ primeiraVista: ant(15 * D + H), confirmadoEm: ant(5 * D) }) })).toBe('resultado_pronto')
  })
})

describe('estadoDaLinha: respostas do dono', () => {
  const resp = (r: RegistroDaLista['respostaDono'], o: Partial<RegistroDaLista> = {}): RegistroDaLista =>
    reg({ estado: 'encerrado', respostaDono: r, ...o })
  it('venceu_nova / venceu_original: ficou_no_ar', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'dono', vencedorTitulo: 'B', tituloDaResposta: 'B' }) })).toBe('ficou_no_ar')
    expect(estado({ registro: resp('venceu_original', { vencedorFonte: 'dono', vencedorTitulo: 'A', tituloDaResposta: 'A' }) })).toBe('ficou_no_ar')
  })
  it('as três sem vencedor: respondido_sem_vencedor, nunca ficou_no_ar', () => {
    for (const r of ['ficou_igual', 'inconclusivo', 'nao_vi'] as const) {
      expect(estado({ registro: resp(r, { estado: r === 'nao_vi' ? 'sem_desfecho' : 'encerrado' }) })).toBe('respondido_sem_vencedor')
    }
  })
  it('data_api com título diferente do escolhido: respostas_diferentes', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'data_api', vencedorTitulo: 'No ar', tituloDaResposta: 'Outro' }) })).toBe('respostas_diferentes')
  })
  it('regra: vencedor B e dono B -> ficou_no_ar; vencedor A e dono B -> respostas_diferentes', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'regra', vencedorTitulo: 'B', tituloDaResposta: 'B' }) })).toBe('ficou_no_ar')
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'regra', vencedorTitulo: 'A', tituloDaResposta: 'B' }) })).toBe('respostas_diferentes')
  })
  it('a comparação ignora espaços do título e não ignora caixa', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'regra', vencedorTitulo: ' B  x', tituloDaResposta: 'B x' }) })).toBe('ficou_no_ar')
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'regra', vencedorTitulo: 'b', tituloDaResposta: 'B' }) })).toBe('respostas_diferentes')
  })
  it('fonte dono nunca é conflito, mesmo com títulos diferentes', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'dono', vencedorTitulo: 'A', tituloDaResposta: 'B' }) })).toBe('ficou_no_ar')
  })
  it('data_api = A e dono "Ficou igual" -> respondido_sem_vencedor, nunca respostas_diferentes', () => {
    for (const r of ['ficou_igual', 'inconclusivo', 'nao_vi'] as const) {
      expect(estado({ registro: resp(r, { vencedorFonte: 'data_api', vencedorTitulo: 'A', tituloDaResposta: null }) })).toBe('respondido_sem_vencedor')
      expect(estado({ registro: resp(r, { vencedorFonte: 'regra', vencedorTitulo: 'A', tituloDaResposta: 'B' }) })).toBe('respondido_sem_vencedor')
    }
  })
  it('data_api com o mesmo título: ficou_no_ar', () => {
    expect(estado({ registro: resp('venceu_nova', { vencedorFonte: 'data_api', vencedorTitulo: 'Igual', tituloDaResposta: 'Igual' }) })).toBe('ficou_no_ar')
  })
  it('a resposta vence o prazo: respondida há mais de 16 d continua ficou_no_ar', () => {
    expect(estado({ registro: resp('venceu_nova', { confirmadoEm: ant(40 * D), createdAt: ant(40 * D), vencedorFonte: 'dono', vencedorTitulo: 'B', tituloDaResposta: 'B' }) })).toBe('ficou_no_ar')
  })
})

const linha = (o: Partial<LinhaDoCaminho> & { estado: EstadoLinha; id?: string }): LinhaDoCaminho => ({
  videoId: o.id ?? o.videoId ?? 'v', ytId: 'y', titulo: 't', miniaturaUrl: null, publicadoEm: ant(10 * D), estado: o.estado,
  caminho: nativo, fichaId: null, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: null, ...o,
})
const regLinha = (n: number | null): NonNullable<LinhaDoCaminho['registro']> => ({
  id: 'r', updatedAt: ant(D), confirmadoEm: ant(15 * D), primeiraVista: null, diaDe14: 15,
  variantes: n === null ? null : Array.from({ length: n }, (_, i) => ({ n: i + 1, titulo: `t${i}`, imagem: null })), variantesTitulo: null, campos: ['titulo'], respostaDono: null,
  tituloAntes: null, varianteVencedora: null, respondidoEm: null, respostaMudadaEm: null, vencedorFonte: null, vencedorTitulo: null, desfechoEm: null, inicio: ant(15 * D),
})
const pausado = { testId: 't', restoreSeq: 0, dia: 3, status: 'paused' as const }

describe('agruparLinhas', () => {
  it('Precisa de você: sem_resposta, resultado_pronto, em_teste_studio com nosso pausado; o resto por publicadoEm desc', () => {
    const g = agruparLinhas([
      linha({ id: 'novo', estado: 'sugerido_youtube', publicadoEm: ant(1 * D) }),
      linha({ id: 'pronto', estado: 'resultado_pronto' }),
      linha({ id: 'studio-livre', estado: 'em_teste_studio', publicadoEm: ant(5 * D) }),
      linha({ id: 'studio-pausado', estado: 'em_teste_studio', nosso: pausado }),
      linha({ id: 'sem', estado: 'sem_resposta' }),
      linha({ id: 'velho', estado: 'sem_volume', publicadoEm: ant(50 * D) }),
    ])
    expect(g.precisaDeVoce.map((l) => l.videoId)).toEqual(['sem', 'pronto', 'studio-pausado'])
    expect(g.outros.map((l) => l.videoId)).toEqual(['novo', 'studio-livre', 'velho'])
  })
})

describe('resumoDaLista', () => {
  const g = (...ls: LinhaDoCaminho[]) => agruparLinhas(ls)
  it('mockup: dois esperam (um passou do prazo, um terminou hoje); dois em teste, um em preparo, Lab pausado em dois', () => {
    const r = resumoDaLista(g(
      linha({ id: 'a', estado: 'sem_resposta', registro: regLinha(2) }),
      linha({ id: 'b', estado: 'resultado_pronto', registro: regLinha(2) }),
      linha({ id: 'c', estado: 'em_teste_studio', nosso: pausado, registro: regLinha(2) }),
      linha({ id: 'd', estado: 'em_teste_studio', nosso: pausado, registro: regLinha(2) }),
      linha({ id: 'e', estado: 'em_preparo' }),
    ))
    expect(r.frase).toBe('Dois vídeos esperam a sua resposta: um passou do prazo, um terminou hoje.')
    expect(r.apoio).toBe('Dois em teste no Studio, um em preparo. O Lab está pausado em dois deles.')
  })
  it('I-3: o detectado (sem confirmação) não entra em "em teste no Studio"; vai em "parece haver teste no Studio em N vídeos"', () => {
    const r = resumoDaLista(g(
      linha({ id: 'a', estado: 'sem_resposta', registro: regLinha(2) }),
      linha({ id: 'c', estado: 'em_teste_studio', registro: { ...regLinha(2), confirmadoEm: null, primeiraVista: ant(2 * D) } }),
      linha({ id: 'd', estado: 'em_teste_studio', registro: regLinha(2) }),
    ))
    expect(r.apoio).toBe('Um em teste no Studio, parece haver teste no Studio em um vídeo.')
  })
  it('nada espera: frase de D-7 e apoio com N em teste ou em preparo', () => {
    const r = resumoDaLista(g(
      linha({ id: 'a', estado: 'em_teste_studio' }), linha({ id: 'b', estado: 'em_preparo' }), linha({ id: 'c', estado: 'sugerido_youtube' }),
    ))
    expect(r.frase).toBe('Nada espera a sua resposta hoje.')
    expect(r.apoio).toBe('Dois vídeos em teste ou em preparo. Os demais seguem sem teste.')
  })
  it('nada espera e N = 0: apoio omitido', () => {
    expect(resumoDaLista(g(linha({ id: 'c', estado: 'sugerido_youtube' })))).toEqual({ frase: 'Nada espera a sua resposta hoje.', apoio: null })
    expect(resumoDaLista(g())).toEqual({ frase: 'Nada espera a sua resposta hoje.', apoio: null })
  })
  it('toda linha resultado_pronto/sem_resposta espera a resposta, tenha 2 versões, 3 ou derivada', () => {
    const r = resumoDaLista(g(
      linha({ id: 'a', estado: 'resultado_pronto', registro: regLinha(2) }),
      linha({ id: 'b', estado: 'resultado_pronto', registro: regLinha(null) }),
      linha({ id: 'c', estado: 'sem_resposta', registro: regLinha(null) }),
    ))
    expect(r.frase).toBe('Três vídeos esperam a sua resposta: um passou do prazo, dois terminaram hoje.')
  })
  it('1 linha de 2 versões e 2 derivadas: "Três vídeos esperam a sua resposta." sem apoio de caso misto', () => {
    const r = resumoDaLista(g(
      linha({ id: 'a', estado: 'resultado_pronto', registro: regLinha(2) }),
      linha({ id: 'b', estado: 'resultado_pronto', registro: regLinha(null) }),
      linha({ id: 'c', estado: 'resultado_pronto', registro: regLinha(null) }),
    ))
    expect(r).toEqual({ frase: 'Três vídeos esperam a sua resposta.', apoio: null })
  })
  it('um só com 3 versões: singular, na frase de esperam', () => {
    expect(resumoDaLista(g(linha({ id: 'a', estado: 'resultado_pronto', registro: regLinha(3) }))).frase).toBe('Um vídeo espera a sua resposta.')
  })
  it('L-10: respostas_diferentes e ficou_no_ar ficam fora de "Precisa de você" e de "esperam a sua resposta"', () => {
    const ls = [linha({ id: 'a', estado: 'respostas_diferentes' }), linha({ id: 'b', estado: 'ficou_no_ar' })]
    expect(agruparLinhas(ls).precisaDeVoce).toEqual([])
    expect(resumoDaLista(g(...ls)).frase).toBe('Nada espera a sua resposta hoje.')
  })
  it('respondido_sem_vencedor e ficou_no_ar não contam em nada de "espera"', () => {
    const r = resumoDaLista(g(linha({ id: 'a', estado: 'respondido_sem_vencedor' }), linha({ id: 'b', estado: 'ficou_no_ar' }), linha({ id: 'c', estado: 'respostas_diferentes' })))
    expect(r.frase).toBe('Nada espera a sua resposta hoje.')
  })
  it('números acima de dez em algarismos', () => {
    const ls = Array.from({ length: 11 }, (_, i) => linha({ id: `v${i}`, estado: 'sem_resposta', registro: regLinha(2) }))
    expect(resumoDaLista(g(...ls)).frase).toBe('11 vídeos esperam a sua resposta.')
  })
})

describe('resumoDaLista: Lab pausado sem resposta pendente', () => {
  const g2 = (...ls: LinhaDoCaminho[]) => agruparLinhas(ls)
  it('só uma pausada: conta a pausa, não diz "Nada espera"', () => {
    const r = resumoDaLista(g2(linha({ id: 'a', estado: 'em_teste_studio', nosso: pausado })))
    expect(r.frase).toBe('Lab pausado em um vídeo.')
    expect(r.apoio).toBe('Um vídeo em teste ou em preparo. Os demais seguem sem teste.')
  })
  it('duas pausadas: número por extenso', () => {
    expect(resumoDaLista(g2(linha({ id: 'a', estado: 'em_teste_studio', nosso: pausado }), linha({ id: 'b', estado: 'em_teste_studio', nosso: pausado }))).frase).toBe('Lab pausado em dois vídeos.')
  })
  it('pausada + resposta pendente: frase da resposta, apoio conta a pausa', () => {
    const r = resumoDaLista(g2(linha({ id: 'a', estado: 'sem_resposta', registro: regLinha(2) }), linha({ id: 'b', estado: 'em_teste_studio', nosso: pausado })))
    expect(r.frase).toBe('Um vídeo espera a sua resposta.')
    expect(r.apoio).toContain('O Lab está pausado em um deles.')
  })
  it('nenhuma pausada: segue "Nada espera"', () => {
    expect(resumoDaLista(g2(linha({ id: 'a', estado: 'em_teste_studio' }))).frase).toBe('Nada espera a sua resposta hoje.')
  })
})

describe('Retomar a partir de', () => {
  it('detectado visto em 19/10 (BRT): 04/11', () => {
    const t = retomarAPartirDe({ primeiraVista: '2026-10-19T03:00:00Z', confirmadoEm: null, createdAt: '2026-10-25T03:00:00Z' })
    expect(rotuloRetomar(t)).toBe('04/11')
  })
  it('confirmado em 18/10 com primeira_vista nula: 03/11', () => {
    expect(rotuloRetomar(retomarAPartirDe({ primeiraVista: null, confirmadoEm: '2026-10-18T03:00:00Z', createdAt: '2026-10-18T03:00:00Z' }))).toBe('03/11')
  })
  it('primeira_vista 19/10 22:00 BRT: o texto traz a hora', () => {
    expect(rotuloRetomar(retomarAPartirDe({ primeiraVista: '2026-10-20T01:00:00Z', confirmadoEm: null, createdAt: '2026-10-20T01:00:00Z' }))).toBe('04/11, 22:00')
  })
  it('o instante é a referência: um minuto antes e um depois', () => {
    const t = retomarAPartirDe({ primeiraVista: '2026-10-20T01:00:00Z', confirmadoEm: null, createdAt: '2026-10-20T01:00:00Z' })
    expect(t.toISOString()).toBe('2026-11-05T01:00:00.000Z')
    const registro = { ...reg({ confirmadoEm: '2026-10-20T01:00:00Z', createdAt: '2026-10-20T01:00:00Z' }), respostaDono: null }
    const em = (ms: number): EstadoLinha => estadoDaLinha({ caminho: nativo, ficha: null, registro, nosso: null }, new Date(t.getTime() + ms))
    expect(em(-60_000)).toBe('resultado_pronto')
    expect(em(0)).toBe('sem_resposta')
    expect(em(60_000)).toBe('sem_resposta')
  })
})

describe('foiTardia e prazoDoTeste (D-6)', () => {
  const ini = '2026-11-01T12:00:00Z'
  const em = (ms: number): string => new Date(Date.parse(ini) + ms).toISOString()
  it('inicio + 16 d - 1 min -> false; + 16 d -> true', () => {
    expect(foiTardia(ini, em(16 * D - 60_000))).toBe(false)
    expect(foiTardia(ini, em(16 * D))).toBe(true)
  })
  it('14 d exatos ainda não é tardia (a margem de 2 d conta)', () => {
    expect(foiTardia(ini, em(14 * D))).toBe(false)
  })
  it('1ª resposta no prazo + resposta mudada depois do prazo -> false (só respondidoEm vale)', () => {
    const r = regLinha(2)
    const base = { ...r, inicio: ini, respondidoEm: em(15 * D), respostaMudadaEm: em(30 * D) }
    expect(foiTardia(base.inicio, base.respondidoEm)).toBe(false)
    expect(foiTardia.length).toBe(2) // a assinatura não aceita `respostaMudadaEm`: a mudança tardia não vira rótulo
  })
  it('aceita Date no início; o prazo mostrado é início + 14 d', () => {
    expect(foiTardia(new Date(ini), em(17 * D))).toBe(true)
    expect(prazoDoTeste(ini).toISOString()).toBe(em(14 * D))
  })
})
