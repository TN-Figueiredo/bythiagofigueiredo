// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { avaliarVideo, corteDaJanela, decidirRegistro, type EntradaVideo } from '@/lib/youtube/teste-youtube/registro/registrar'
import type { AcaoRegistro, Fechamentos, NovoRegistro, RegistroAberto } from '@/lib/youtube/teste-youtube/registro/tipos'
import { JANELA_V14_MS } from '@/lib/youtube/teste-youtube/registro/constantes'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { rodadasDeTitulo } from '@/lib/youtube/teste-youtube/rodadas'
import type { EscritaConhecida, LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9, TITULO_A, TITULO_B } from '../../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura, rodadas } from '../sintetico'

const H = 3_600_000
const MIN = 60_000
const DIA = 24 * H
const iso = (ms: number): string => new Date(ms).toISOString()
const SEM: Fechamentos = { encerradoEm: null, descartadoEm: null }
const textos = { A: 'Titulo A', B: 'Titulo B' }
let seq = 0
const novoId = (): string => `id-${++seq}`

function entrada(p: Partial<EntradaVideo> & { leituras: readonly LeituraWatch[]; agora: string }): EntradaVideo {
  return { escritas: [], aberto: null, fechamentos: SEM, novoId, retroativa: false, ...p }
}
const ultima = (ls: readonly LeituraWatch[]): number => Math.max(...ls.map(l => Date.parse(l.lidaEm)))
/** O que o banco guardaria depois de aplicar `criar`. */
function abertoDe(n: NovoRegistro, extra: Partial<RegistroAberto> = {}): RegistroAberto {
  return {
    id: n.id, updatedAt: '2026-10-18T21:45:37.471588+00:00', origem: 'detectado', campos: n.campos, variantesTitulo: n.variantesTitulo,
    votosTitulo: n.votosTitulo, primeiraVista: n.primeiraVista, ultimaVista: n.ultimaVista, veredito: n.veredito, evidencia: n.evidencia, ...extra,
  }
}
function criado(a: AcaoRegistro): NovoRegistro {
  if (a.tipo !== 'criar') throw new Error(`esperava criar, veio ${a.tipo}`)
  return a.novo
}

describe('corteDaJanela', () => {
  it('é o maior entre agora - 14 d, encerrado_em e descartado_em', () => {
    const agora = Date.parse('2026-10-18T12:00:00Z')
    expect(corteDaJanela(agora, SEM)).toBe(agora - JANELA_V14_MS)
    expect(corteDaJanela(agora, { encerradoEm: iso(agora - 3 * DIA), descartadoEm: null })).toBe(agora - 3 * DIA)
    expect(corteDaJanela(agora, { encerradoEm: iso(agora - 3 * DIA), descartadoEm: iso(agora - 2 * DIA) })).toBe(agora - 2 * DIA)
    expect(corteDaJanela(agora, { encerradoEm: iso(agora - 30 * DIA), descartadoEm: null })).toBe(agora - JANELA_V14_MS)
  })
})

describe('qIg9 (teste nativo real)', () => {
  const { leituras } = carregarQIg9()
  const agora = iso(ultima(leituras) + H)

  it('C-1: cria 1 registro detectado com os dois títulos, votos 29/31 e a evidência', () => {
    const { acao, avaliacao } = avaliarVideo(entrada({ leituras, agora }))
    const n = criado(acao)
    expect(n.origem).toBe('detectado')
    expect(n.campos).toEqual(['titulo'])
    expect(n.variantesTitulo).toEqual([TITULO_A, TITULO_B])
    expect(n.votosTitulo).toEqual({ [TITULO_A]: 29, [TITULO_B]: 31 })
    const v = detectarTesteYoutube(leituras)
    if (v.estado !== 'provavel_teste') throw new Error('fixture')
    expect(n.primeiraVista).toBe(v.primeiraVista)
    expect(n.evidencia).toHaveLength(20)
    expect(n.evidencia.filter(e => e.mista)).toHaveLength(13)
    expect(n.evidenciaCortada).toBe(false)
    expect(n.versaoRegra).toBe(1)
    expect(avaliacao.estado14).toBe('provavel_teste')
    expect(avaliacao.registroId).toBe(n.id)
    expect(avaliacao.mistas48).not.toBeNull()
    expect(avaliacao.retroativa).toBe(false)
  })

  it('C-2: repetir com o registro já gravado dá nada (depois de gravar o desfecho uma vez)', () => {
    const n = criado(avaliarVideo(entrada({ leituras, agora })).acao)
    const p2 = avaliarVideo(entrada({ leituras, agora, aberto: abertoDe(n) })).acao
    // a 2ª passada só pode trazer o desfecho que o criar não tinha; o resto do registro fica igual
    let aberto2 = abertoDe(n)
    if (p2.tipo === 'atualizar') {
      expect(p2.mudanca.evidencia).toEqual(n.evidencia)
      expect(p2.mudanca.votosTitulo).toEqual(n.votosTitulo)
      expect(p2.mudanca.ultimaVista).toBe(n.ultimaVista)
      const d = p2.mudanca.desfecho
      if (d === undefined) throw new Error('atualizar sem mudança real')
      aberto2 = abertoDe(n, { desfechoEstado: d.estado, desfechoMotivo: 'motivo' in d ? d.motivo : null })
    } else {
      expect(p2.tipo).toBe('nada')
    }
    expect(avaliarVideo(entrada({ leituras, agora, aberto: aberto2 })).acao.tipo).toBe('nada')
  })

  it('C-8: encerrado em T, as mesmas leituras não reabrem (v14 só vê depois de T)', () => {
    const T = ultima(leituras)
    const { acao, avaliacao } = avaliarVideo(entrada({ leituras, agora, fechamentos: { encerradoEm: iso(T), descartadoEm: null } }))
    expect(acao.tipo).toBe('nada')
    expect(avaliacao.estado14).not.toBe('provavel_teste')
  })

  it('descartado: só cria se a evidência é posterior ao descarte', () => {
    const depois = avaliarVideo(entrada({ leituras, agora, fechamentos: { encerradoEm: null, descartadoEm: iso(ultima(leituras)) } }))
    expect(depois.acao.tipo).toBe('nada')
    const antes = avaliarVideo(entrada({ leituras, agora, fechamentos: { encerradoEm: null, descartadoEm: iso(Date.parse(leituras[0]!.lidaEm) - H) } }))
    expect(antes.acao.tipo).toBe('criar')
  })
})

describe('desfecho do registro aberto', () => {
  // teste: mistura por 3 dias (rodadas a cada 4 h), depois só B
  const inicio = Date.parse('2026-10-10T00:00:00Z')
  const mistura = rodadas({ inicio: iso(inicio), intervaloMs: 4 * H, padroes: Array.from({ length: 18 }, () => 'AAB'), textos })
  const fimMistura = ultima(mistura)
  const aberto = (): RegistroAberto => {
    const agora = iso(fimMistura + H)
    return abertoDe(criado(avaliarVideo(entrada({ leituras: mistura, agora })).acao))
  }
  /** 18 votos B ao longo de 24 h+ (leituras de 1 em 1 h, uma por rodada). */
  const soB = (ini: number, n: number, passoMs = 90 * MIN): LeituraWatch[] =>
    Array.from({ length: n }, (_, i) => leitura({ em: iso(ini + i * passoMs), rodada: `b${i}`, titulo: textos.B, oficial: textos.B }))

  it('C-7: sufixo estável de 18 votos B em 24 h encerra com o vencedor B', () => {
    const ab = aberto()
    const depois = soB(fimMistura + 2 * H, 18)
    const todas = [...mistura, ...depois]
    const { acao } = avaliarVideo(entrada({ leituras: todas, agora: iso(ultima(depois) + H), aberto: ab }))
    if (acao.tipo !== 'encerrar') throw new Error(`veio ${acao.tipo}`)
    expect(acao.fim.estado).toBe('encerrado')
    expect(acao.fim.vencedorTitulo).toBe(textos.B)
    expect(acao.fim.desfechoVersaoRegra).toBe(1)
    expect(acao.lido).toBe(ab.updatedAt)
  })

  it('C-7b: v14 ainda provável e sufixo estável: encerra mesmo assim (ordem fixa)', () => {
    const ab = aberto()
    const depois = soB(fimMistura + 2 * H, 18)
    const todas = [...mistura, ...depois]
    const agora = iso(ultima(depois) + H)
    expect(detectarTesteYoutube(todas).estado).toBe('provavel_teste')
    expect(avaliarVideo(entrada({ leituras: todas, agora, aberto: ab })).acao.tipo).toBe('encerrar')
  })

  it('C-7d: depois só leituras com erro por 49 h: sem_desfecho por sem_leitura_depois', () => {
    const ab = aberto()
    const erros = Array.from({ length: 6 }, (_, i) => leitura({ em: iso(fimMistura + (i + 1) * 8 * H), rodada: `e${i}`, erro: 'http_429', titulo: null }))
    const agora = iso(Date.parse(ab.ultimaVista!) + 49 * H)
    const { acao } = avaliarVideo(entrada({ leituras: [...mistura, ...erros], agora, aberto: ab }))
    if (acao.tipo !== 'encerrar') throw new Error(`veio ${acao.tipo}`)
    expect(acao.fim.estado).toBe('sem_desfecho')
    expect(acao.fim.desfechoMotivo).toBe('sem_leitura_depois')
  })

  it('C-8b: havia leitura votante depois, a última há 49 h: sem_desfecho por coleta_encerrada', () => {
    const ab = aberto()
    const poucas = soB(fimMistura + 2 * H, 3)
    const agora = iso(ultima(poucas) + 49 * H)
    const { acao } = avaliarVideo(entrada({ leituras: [...mistura, ...poucas], agora, aberto: ab }))
    if (acao.tipo !== 'encerrar') throw new Error(`veio ${acao.tipo}`)
    expect(acao.fim.estado).toBe('sem_desfecho')
    expect(acao.fim.desfechoMotivo).toBe('coleta_encerrada')
  })

  it('registro encerrado não reabre pelas mesmas leituras (C-7d)', () => {
    const ab = aberto()
    const erros = [leitura({ em: iso(fimMistura + 8 * H), rodada: 'e0', erro: 'http_429', titulo: null })]
    const agora = iso(Date.parse(ab.ultimaVista!) + 49 * H)
    const fim = avaliarVideo(entrada({ leituras: [...mistura, ...erros], agora, aberto: ab })).acao
    if (fim.tipo !== 'encerrar') throw new Error('x')
    const { acao } = avaliarVideo(entrada({ leituras: [...mistura, ...erros], agora, fechamentos: { encerradoEm: fim.fim.encerradoEm, descartadoEm: null } }))
    expect(acao.tipo).toBe('nada')
  })

  it('C-7c: nova mistura 8 d depois da última vista encerra como teste_novo e cria outro na mesma execução', () => {
    const ab = aberto()
    const t1 = Date.parse(ab.ultimaVista!) + 8 * DIA
    const nova = rodadas({ inicio: iso(t1), intervaloMs: 4 * H, padroes: Array.from({ length: 12 }, () => 'AAB'), textos })
    const agora = iso(ultima(nova) + H)
    // a última vista do aberto fica 8+ d antes da nova mistura e ainda dentro da janela de 14 d; a mistura antiga já saiu dela
    const { acao } = avaliarVideo(entrada({ leituras: nova, agora, aberto: ab }))
    if (acao.tipo !== 'encerrar_e_criar') throw new Error(`veio ${acao.tipo}`)
    expect(acao.fim.estado).toBe('sem_desfecho')
    expect(acao.fim.desfechoMotivo).toBe('teste_novo')
    expect(acao.novo.id).not.toBe(ab.id)
    expect(acao.id).toBe(ab.id)
  })

  it('atualiza quando há leitura mista nova (ultima_vista maior)', () => {
    const ab = aberto()
    const mais = rodadas({ inicio: iso(fimMistura + 4 * H), intervaloMs: 4 * H, padroes: ['AAB', 'AAB', 'AAB'], textos }).map(l => ({ ...l, rodadaId: 'n' + l.rodadaId }))
    const { acao } = avaliarVideo(entrada({ leituras: [...mistura, ...mais], agora: iso(ultima(mais) + H), aberto: ab }))
    if (acao.tipo !== 'atualizar') throw new Error(`veio ${acao.tipo}`)
    expect(Date.parse(acao.mudanca.ultimaVista!)).toBeGreaterThan(Date.parse(ab.ultimaVista!))
    expect(acao.mudanca.evidencia!.length).toBeGreaterThan(ab.evidencia.length)
    expect(acao.lido).toBe(ab.updatedAt)
  })

  it('C-7f (parte pura): confirmado de miniatura que recebe título provável vira [titulo, miniatura]', () => {
    const confirmado: RegistroAberto = {
      id: 'conf-1', updatedAt: '2026-10-18T21:45:37.471588+00:00', origem: 'confirmado', campos: ['miniatura'], variantesTitulo: null, votosTitulo: null,
      primeiraVista: null, ultimaVista: null, veredito: null, evidencia: [],
    }
    const { acao } = avaliarVideo(entrada({ leituras: mistura, agora: iso(fimMistura + H), aberto: confirmado }))
    if (acao.tipo !== 'atualizar') throw new Error(`veio ${acao.tipo}`)
    expect(acao.mudanca.campos).toEqual(['titulo', 'miniatura'])
    expect(acao.mudanca.variantesTitulo).toEqual([textos.A, textos.B])
    expect(acao.mudanca.votosTitulo).toBeDefined()
  })

  it('variantes_demais: 4ª variante não atualiza e a avaliação leva o aviso (sem o caso, aviso null)', () => {
    const ab = aberto()
    const v14 = detectarTesteYoutube(mistura)
    if (v14.estado !== 'provavel_teste') throw new Error('x')
    const demais: RegistroAberto = { ...ab, variantesTitulo: ['Titulo A', 'Titulo B', 'Titulo C', 'Titulo D'] }
    const { acao, aviso } = decidirRegistro(demais, v14, null, {
      agora: iso(fimMistura + H), fechamentos: SEM, novoId, rodadas: rodadasDeTitulo(mistura), escritas: [], ultimaVotanteDepoisMs: null, miniaturaA: null,
    })
    expect(acao.tipo).toBe('nada')
    expect(aviso).toBe('variantes_demais')
    const normal = avaliarVideo(entrada({ leituras: mistura, agora: iso(fimMistura + H), aberto: ab }))
    expect(normal.avaliacao.aviso).toBeNull()
  })
})

describe('T19 girando todo dia (Review Focus 1)', () => {
  const inicio = Date.parse('2026-10-05T00:00:00Z')
  const agora = iso(inicio + 13 * DIA + 20 * H)
  const escritas: EscritaConhecida[] = Array.from({ length: 14 }, (_, d) => ({ em: iso(inicio + d * DIA), campo: 'titulo' }))
  /** Por dia: rodada a +30 min (quarentena), `mistas` rodadas fora da quarentena, e rodadas puras de A a cada 8 h. */
  function dias(mistasPorDia: number): LeituraWatch[] {
    const out: LeituraWatch[] = []
    for (let d = 0; d < 14; d++) {
      const base = inicio + d * DIA
      const padroes: Array<[number, string]> = [[30 * MIN, 'AAB']]
      for (let m = 0; m < mistasPorDia; m++) padroes.push([70 * MIN + m * 20 * MIN, 'AAB'])
      padroes.push([8 * H, 'AAA'], [16 * H, 'AAA'])
      padroes.forEach(([off, padrao], k) => {
        const ls = rodadas({ inicio: iso(base + off), intervaloMs: H, padroes: [padrao], textos })
        out.push(...ls.map(l => ({ ...l, rodadaId: `d${d}k${k}` })))
      })
    }
    return out
  }

  it('1 rodada misturada fora da quarentena por rotação: nenhum criar; a medida da propagação aparece', () => {
    const { acao, avaliacao } = avaliarVideo(entrada({ leituras: dias(1), escritas, agora }))
    expect(acao.tipo).not.toBe('criar')
    expect(avaliacao.estado14).not.toBe('provavel_teste')
    expect(avaliacao.mistas48ForaQuarentena).toBe(2) // 2 rotações dentro das 48 h, 1 rodada que vazou em cada
    expect(avaliacao.minDesdeEscrita).toEqual([30, 30, 70, 70])
  })

  it('ACHADO para a fase 2: na janela curta de 48 h a propagação diária pode ler provavel_teste (o span das mistas exclui as puras de fora); o registrador usa só v14', () => {
    const { avaliacao } = avaliarVideo(entrada({ leituras: dias(1), escritas, agora }))
    expect(avaliacao.estado48).toBe('provavel_teste')
  })

  it('fronteira do limiar que o C-17b mede: 2 rodadas misturadas fora da quarentena por rotação (fração 0,67) criam', () => {
    const { acao } = avaliarVideo(entrada({ leituras: dias(2), escritas, agora }))
    expect(acao.tipo).toBe('criar')
  })
})

describe('a avaliação sempre sai', () => {
  it('lista vazia: sem_leitura e ate_lida_em null', () => {
    const { acao, avaliacao } = avaliarVideo(entrada({ leituras: [], agora: '2026-10-18T12:00:00.000Z' }))
    expect(acao.tipo).toBe('nada')
    expect(avaliacao.estado14).toBe('sem_leitura')
    expect(avaliacao.ateLidaEm).toBeNull()
    expect(avaliacao.registroId).toBeNull()
    expect(avaliacao.versaoRegra).toBe(1)
    expect(avaliacao.erro).toBeNull()
  })
  it('ate_lida_em é a maior lidaEm recebida; escritas = quantas foram passadas', () => {
    const ls = rodadas({ inicio: '2026-10-18T00:00:00.000Z', intervaloMs: H, padroes: ['AA', 'AA'], textos })
    const { avaliacao } = avaliarVideo(entrada({ leituras: ls, agora: '2026-10-18T12:00:00.000Z', escritas: [{ em: '2026-10-17T00:00:00Z', campo: 'titulo' }] }))
    expect(avaliacao.ateLidaEm).toBe(iso(ultima(ls)))
    expect(avaliacao.escritas).toBe(1)
  })
})
