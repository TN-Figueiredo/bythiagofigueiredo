// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fraseDoTopo, oracaoDoUltimoVideo, type EntradaDaFrase, type UltimoVideo } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/frase-do-topo'
import { estadoDaPagina, type EstadoDaPagina } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/estado-model'
import { celulaDeDirecao } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { AGORA, HOJE, m3a, m8, J } from './medidas-canal-fixture'

const FMT = { fmt: 'long' as const, doisFormatos: false, soShorts: false }
const sync = { state: 'ok' as const, last: AGORA - 3_600_000, errorSince: null }
const ativo = (): EstadoDaPagina => estadoDaPagina(m8('ativo'), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
const dir = (r: number, a: number, janela = J) => celulaDeDirecao(m3a(r, a, janela), null)
const base = (o: Partial<EntradaDaFrase> = {}): EntradaDaFrase => ({
  estado: ativo(), direcao: dir(118, 100), formato: FMT, ritmo: { porSemana: 1.7, semanasLidas: 13, semanasComPublicacao: 11 },
  acerto: { k: 3, n: 20 }, parado: null, queda: null, ultimoVideo: { tipo: 'nenhum' }, hojeSP: HOJE, ...o,
})
const ULT_PERTO: UltimoVideo = { tipo: 'medido', v: { tipo: 'faixa', titulo: 'Tokyo em 3 dias', dia: 1, razao: 1.4 } }

describe('frase do topo', () => {
  it('ativo subindo: a frase da tabela, com o último vídeo', () => {
    const f = fraseDoTopo(base({ ultimoVideo: ULT_PERTO }))
    expect(f.texto).toBe('Subindo +18%: nos últimos 28 dias o canal ganhou mais views do que nos 28 anteriores. Publica 1,7 vídeos por semana e acertou 3 de 20 vídeos recentes. O último vídeo, “Tokyo em 3 dias”, está perto do normal (1,4× no dia 1).')
    expect(f.tom).toBe('up')
  })
  it('+10% é subindo, +9% é "quase as mesmas views que", 0% é "as mesmas"', () => {
    expect(fraseDoTopo(base({ direcao: dir(110, 100) })).texto).toMatch(/^Subindo \+10%: .* ganhou mais views do que/)
    expect(fraseDoTopo(base({ direcao: dir(109, 100) })).texto).toMatch(/^Sem mudança \+9%: .* ganhou quase as mesmas views que/)
    expect(fraseDoTopo(base({ direcao: dir(100, 100) })).texto).toMatch(/^Sem mudança 0%: .* ganhou as mesmas views que/)
    expect(fraseDoTopo(base({ direcao: dir(88, 100) })).texto).toMatch(/^Descendo −12%: .* ganhou menos views do que/)
    expect(fraseDoTopo(base({ direcao: dir(91, 100) })).texto).toMatch(/ganhou quase as mesmas views que/)
  })
  it('a ressalva da janela aparece enquanto cruza 24/08', () => {
    const f = fraseDoTopo(base({ direcao: dir(118, 100, { de: '2026-08-10', ate: '2026-09-07', dias: 28 }) }))
    expect(f.texto).toContain('(a janela ainda cruza a mudança de contagem de 24/08)')
    expect(fraseDoTopo(base()).texto).not.toContain('24/08')
  })
  it('menos de 56 dias: "Ainda não dá para dizer…" com a data da medida', () => {
    const d = celulaDeDirecao(naoMedido('pouco_registro', { fechaEm: '2026-11-12', n: 26 }), null)
    const f = fraseDoTopo(base({ direcao: d, ritmo: { porSemana: 2 / 13, semanasLidas: 13, semanasComPublicacao: 2 } }))
    expect(f.texto).toMatch(/^Ainda não dá para dizer para onde o canal anda: faltam \d+ dias de registro \(completa em 12\/11\)\. Ele publicou 2 vídeos longos nas últimas 13 semanas\./)
  })
  it('canal novo com semanas sem leitura: "nas N semanas com leitura"', () => {
    const d = celulaDeDirecao(naoMedido('pouco_registro', { fechaEm: '2026-11-12' }), null)
    const f = fraseDoTopo(base({ direcao: d, ritmo: { porSemana: 0.5, semanasLidas: 5, semanasComPublicacao: 2 } }))
    expect(f.texto).toContain('nas 5 semanas com leitura.')
  })
  it('medidas não carregaram: a frase não afirma direção nem estado', () => {
    const f = fraseDoTopo(base({ direcao: null }))
    expect(f.texto).not.toMatch(/Subindo|Descendo|Ativo|Parado|queda/)
    expect(f.texto).toMatch(/não deu para ler as medidas deste canal agora/)
  })
  it('parado, em queda, erro, fora e canal novo (frases da tabela)', () => {
    const par = estadoDaPagina(m8('parado', { dias: 64, limite: 28 }), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(fraseDoTopo(base({ estado: par, parado: { dias: 64, ultimaEm: '2026-08-10', costumava: 5 } })).texto)
      .toBe('Parado há 64 dias: o último vídeo saiu em 10/08. Ele costumava publicar a cada 5 dias.')
    const que = estadoDaPagina(m8('em_queda', { queda: [-0.34, -0.21, -0.14] }), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(fraseDoTopo(base({ estado: que, queda: [-0.34, -0.21, -0.14] })).texto)
      .toBe('Em queda sustentada: as três últimas janelas de 28 dias ganharam menos views que a anterior (−34%, −21%, −14%).')
    const err = estadoDaPagina(m8('ativo'), { state: 'erro', last: Date.parse('2026-10-04T12:00:00Z'), errorSince: Date.parse('2026-10-08T12:00:00Z') }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(fraseDoTopo(base({ estado: err })).texto).toBe('Os números abaixo são de 04/10.')
    const fora = estadoDaPagina(m8('ativo'), { state: 'ok', last: Date.parse('2026-10-09T12:00:00Z'), errorSince: null }, { missingSince: '2026-10-09', doisFormatos: false }, null, HOJE, AGORA)
    expect(fraseDoTopo(base({ estado: fora })).texto).toBe('Os números valem até 09/10.')
    const nova = estadoDaPagina(null, { state: 'backfill', last: null, errorSince: null }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(fraseDoTopo(base({ estado: nova })).texto).toBe('Canal novo na lista: os números aparecem aos poucos.')
  })
  it('parado (dois formatos) diz "longo ou Short" e "um longo"', () => {
    const par = estadoDaPagina(m8('parado'), sync, { missingSince: null, doisFormatos: true }, null, HOJE, AGORA)
    const f = fraseDoTopo(base({ estado: par, formato: { fmt: 'long', doisFormatos: true, soShorts: false }, parado: { dias: 40, ultimaEm: '2026-09-07', costumava: 5 } }))
    expect(f.texto).toContain('o último vídeo (longo ou Short) saiu em 07/09')
    expect(f.texto).toContain('publicar um longo a cada 5 dias')
  })
  it('canal só de Shorts', () => {
    const f = fraseDoTopo(base({ formato: { fmt: 'short', doisFormatos: false, soShorts: true } }))
    expect(f.texto).toMatch(/^Canal só de Shorts: publica 1,7 Shorts por semana, e as views do canal subiram \+18% em 28 dias\./)
  })
})

describe('oração do último vídeo', () => {
  const q = { quem: 'vídeo', ate: null }
  it('as sete formas', () => {
    expect(oracaoDoUltimoVideo({ tipo: 'medido', v: { tipo: 'passou', titulo: 'A', dia: 2, razao: 2.6 } }, q)).toBe('O último vídeo, “A”, saiu acima do normal já no dia 2 (2,6×).')
    expect(oracaoDoUltimoVideo({ tipo: 'medido', v: { tipo: 'faixa', titulo: 'A', dia: 1, razao: 0.5 } }, q)).toBe('O último vídeo, “A”, está abaixo do normal (0,5× no dia 1).')
    expect(oracaoDoUltimoVideo({ tipo: 'medido', v: { tipo: 'sem_normal', titulo: 'A' } }, q)).toBe('O último vídeo, “A”, ainda não tem normal para comparar: faltam vídeos medidos na mesma idade.')
    expect(oracaoDoUltimoVideo({ tipo: 'saiu_agora', quando: 'hoje', anterior: { tipo: 'faixa', titulo: 'B', dia: 3, razao: 1.2 } }, q))
      .toBe('O último vídeo saiu hoje e ainda não fechou o primeiro dia de leitura. O anterior, “B”, está perto do normal (1,2× no dia 3).')
    expect(oracaoDoUltimoVideo({ tipo: 'sem_contagem', motivo: 'antes_da_contagem' }, q)).toBe('Sem leitura do último vídeo: ele saiu antes de começarmos a guardar as views por vídeo (03/10).')
    expect(oracaoDoUltimoVideo({ tipo: 'canal_novo' }, q)).toBe('Sem leitura do último vídeo: a primeira busca ainda não terminou.')
    expect(oracaoDoUltimoVideo({ tipo: 'medido', v: { tipo: 'faixa', titulo: 'A', dia: 1, razao: 1.4 } }, { quem: 'vídeo', ate: '04/10' })).toMatch(/^Até 04\/10, o último vídeo, “A”/)
  })
  it('sem contagem por vídeo: a oração diz o motivo e não inventa "perto do normal"', () => {
    const t = oracaoDoUltimoVideo({ tipo: 'sem_contagem', motivo: 'sem_dia_completo' }, q)!
    expect(t).not.toMatch(/perto do normal/)
    expect(t).toMatch(/ainda não fechou o primeiro dia de leitura/)
  })
  it('nenhum vídeo: a frase não tem a oração do último vídeo', () => {
    expect(oracaoDoUltimoVideo({ tipo: 'nenhum' }, q)).toBeNull()
    expect(fraseDoTopo(base()).texto).not.toMatch(/último vídeo/)
  })
  it('canal com os dois formatos diz "o último vídeo longo"', () => {
    const f = fraseDoTopo(base({ formato: { fmt: 'long', doisFormatos: true, soShorts: false }, ultimoVideo: ULT_PERTO }))
    expect(f.texto).toContain('O último vídeo longo, “Tokyo em 3 dias”')
  })
})

describe('estado da página: a ordem', () => {
  const e = (s: Parameters<typeof estadoDaPagina>[1], x: { missingSince: string | null }, m: ReturnType<typeof m8>, pausadoEm: string | null = null) =>
    estadoDaPagina(m, s, { missingSince: x.missingSince, doisFormatos: false }, { collectionPausedAt: pausadoEm, missingSince: null }, HOJE, AGORA).tipo
  const erro = { state: 'erro' as const, last: AGORA - 5 * 86_400_000, errorSince: AGORA - 4 * 86_400_000 }
  const novo = { state: 'backfill' as const, last: null, errorSince: null }
  it('saiu vence erro, erro vence primeira busca, parado vence em queda', () => {
    expect(e(erro, { missingSince: '2026-10-09' }, m8('ativo'))).toBe('saiu')
    expect(e(erro, { missingSince: null }, m8('ativo'))).toBe('erro')
    expect(e(novo, { missingSince: null }, m8('ativo'))).toBe('primeira_busca')
    expect(e(sync, { missingSince: null }, m8('parado', { queda: [-0.2, -0.2, -0.2] }))).toBe('parado')
    expect(e(sync, { missingSince: null }, m8('em_queda', { queda: [-0.2, -0.2, -0.2] }))).toBe('em_queda')
    expect(e(sync, { missingSince: null }, m8('ativo'))).toBe('ativo')
  })
  it('canal em primeira busca nunca é "Ativo"; pausado tem pastilha própria; M8 que não veio não carregou', () => {
    expect(estadoDaPagina(m8('ativo'), novo, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA).pastilha).toBe('Primeira busca')
    expect(e(sync, { missingSince: null }, m8('ativo'), '2026-10-01T00:00:00Z')).toBe('pausado')
    expect(estadoDaPagina(null, sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA).tipo).toBe('nao_carregou')
  })
  it('"Em erro há N dias" e a data da última leitura boa', () => {
    const r = estadoDaPagina(m8('ativo'), erro, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(r.pastilha).toBe('Em erro há 4 dias')
    expect(r.ate).toBe('2026-10-12')
  })
  it('a base do ativo: "último vídeo hoje / ontem / há N dias"', () => {
    const r = estadoDaPagina(m8('ativo'), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(r.base).toBe('último vídeo há 3 dias')
  })
})
