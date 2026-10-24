// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { estadoMiniatura, estadoTitulo, FRESCOR_MS, type CursorLido, type EntradaEstado, type LinhaLida } from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { CADENCIA_H, FRESCOR_H } from '@/lib/youtube/teste-youtube/observados/inferir'
import { modoTrocasConcorrente } from '@/lib/youtube/teste-youtube/observados/flag'

const AGORA = Date.parse('2026-10-23T12:00:00Z')
const H = 3_600_000
const D = 24 * H
const iso = (ms: number): string => new Date(ms).toISOString()

const cursor = (o: Partial<CursorLido> = {}): CursorLido => ({
  avaliadoAteRodada: 40, avaliadoEm: iso(AGORA - 2 * H), motivo: 'ok', validasTitulo: 8, validasMiniatura: 8, ...o,
})
const ficouT = (o: Record<string, unknown> = {}) => ({
  titulo: 'a', versoes: [{ v: 0, rodadas_em_w: 5, ultima_vista: iso(AGORA - 3 * H) }, { v: 1, rodadas_em_w: 3, ultima_vista: iso(AGORA - 9 * H) }],
  sumindo: false, mistas_hist: true, janela_teste: { de: iso(AGORA - 50 * H), ate: iso(AGORA - 3 * H) }, versoes_omitidas: 0, transicao: null, ...o,
})
const trocas = [
  { v: 0, ref: 'a', primeira_vista: iso(AGORA - 60 * H), ultima_vista: iso(AGORA - 3 * H), leituras: 20, rodadas: 8 },
  { v: 1, ref: 'b', primeira_vista: iso(AGORA - 55 * H), ultima_vista: iso(AGORA - 9 * H), leituras: 10, rodadas: 3 },
]
const linha = (o: Partial<LinhaLida> = {}): LinhaLida => ({
  veredito: 'possivel_teste_youtube', ficouEstado: 'em_andamento', ficou: ficouT(), trocas, versaoRegra: 2, motivo: null,
  ultimaAtualizacaoEm: iso(AGORA - 2 * H), tipoTroca: 'alternada', ...o,
})
const linhaTroca = (o: Partial<LinhaLida> = {}): LinhaLida => linha({
  veredito: 'troca_observada', ficouEstado: 'estavel', tipoTroca: 'sequencial',
  ficou: ficouT({ titulo: 'b', transicao: { antes: 'a', de: iso(AGORA - 80 * H), ate: iso(AGORA - 74 * H) } }), ...o,
})
const ent = (o: Partial<EntradaEstado> = {}, l: { titulo?: LinhaLida | null; miniatura?: LinhaLida | null } = {}): EntradaEstado => ({
  flagLigada: true,
  alvo: { rodadas: 41, ultimaRodadaEm: iso(AGORA - 3 * H), saiuPor: null, publicadoEm: iso(AGORA - 10 * D) },
  cursor: cursor(), linhas: { titulo: l.titulo ?? null, miniatura: l.miniatura ?? null }, agoraMs: AGORA, frescorMs: FRESCOR_MS, ...o,
})
const ficouM = { dhash: 'dh-b', versoes: [{ v: 1, rodadas_em_w: 8, ultima_vista: iso(AGORA - 3 * H) }], versoes_omitidas: 0, transicao: { antes: 'dh-a', de: iso(AGORA - 80 * H), ate: iso(AGORA - 74 * H) } }
const trocasM = [{ v: 0, ref: 'dh-a', primeira_vista: iso(AGORA - 200 * H), ultima_vista: iso(AGORA - 80 * H), leituras: 9, rodadas: 3 }, { v: 1, ref: 'dh-b', primeira_vista: iso(AGORA - 74 * H), ultima_vista: iso(AGORA - 3 * H), leituras: 9, rodadas: 3 }]

describe('estado de leitura do título (tabela-verdade do §5)', () => {
  it('constantes: FRESCOR_MS e a trava de D-P2', () => {
    expect(FRESCOR_MS).toBe(FRESCOR_H * H)
    expect(CADENCIA_H, 'a cadência da sonda mudou: revisar `desde` (D-P2) e `FRESCOR_H`').toBe(6)
  })
  it('1. flag off (env apagado) -> nao_medido/flag_off', () => {
    delete process.env.OBS_TROCAS_CONCORRENTE
    expect(estadoTitulo(ent({ flagLigada: modoTrocasConcorrente({}) === 'on' }))).toEqual({ estado: 'nao_medido', motivo: 'flag_off' })
  })
  it('2. saiuPor janela, sem linha: fora_da_janela com ultimo sem_troca_vista, ou null se validas = 0', () => {
    const alvo = { rodadas: 41, ultimaRodadaEm: iso(AGORA - 50 * H), saiuPor: 'janela', publicadoEm: iso(AGORA - 31 * D) }
    const e = estadoTitulo(ent({ alvo }))
    expect(e).toMatchObject({ estado: 'fora_da_janela', vistoAte: alvo.ultimaRodadaEm, ultimo: { estado: 'sem_troca_vista' } })
    expect(estadoTitulo(ent({ alvo, cursor: cursor({ validasTitulo: 0 }) }))).toEqual({ estado: 'fora_da_janela', ultimo: null, vistoAte: alvo.ultimaRodadaEm })
  })
  it('2. fora_da_janela com linha sem_desfecho + possivel_teste -> ultimo em_andamento; miniatura sem_desfecho + troca -> indeterminada', () => {
    const alvo = { rodadas: 41, ultimaRodadaEm: iso(AGORA - 50 * H), saiuPor: 'janela', publicadoEm: iso(AGORA - 31 * D) }
    const t = estadoTitulo(ent({ alvo }, { titulo: linha({ ficouEstado: 'sem_desfecho', motivo: 'janela' }) }))
    expect(t).toMatchObject({ estado: 'fora_da_janela', ultimo: { estado: 'em_andamento' } })
    const m = estadoMiniatura(ent({ alvo }, { miniatura: linha({ veredito: 'troca_observada', ficouEstado: 'sem_desfecho', motivo: 'janela', ficou: ficouM, trocas: trocasM }) }))
    expect(m).toMatchObject({ estado: 'fora_da_janela', ultimo: { estado: 'indeterminada' } })
  })
  it('3. sem_desfecho com motivo janela -> fora_da_janela; com alvo_podado -> nao_medido/saiu com ultimo', () => {
    expect(estadoTitulo(ent({}, { titulo: linha({ ficouEstado: 'sem_desfecho', motivo: 'janela' }) })).estado).toBe('fora_da_janela')
    expect(estadoTitulo(ent({}, { titulo: linha({ ficouEstado: 'sem_desfecho', motivo: 'alvo_podado' }) }))).toMatchObject({ estado: 'nao_medido', motivo: 'saiu', ultimo: { estado: 'em_andamento' } })
  })
  it('3. alvo nulo, ou saiu por outro motivo -> nao_medido/saiu', () => {
    expect(estadoTitulo(ent({ alvo: null }))).toEqual({ estado: 'nao_medido', motivo: 'saiu' })
    expect(estadoTitulo(ent({ alvo: { rodadas: 41, ultimaRodadaEm: iso(AGORA), saiuPor: 'removido', publicadoEm: iso(AGORA - 10 * D) } }))).toMatchObject({ estado: 'nao_medido', motivo: 'saiu' })
  })
  it('4. cursor sem_publicacao -> nao_medido/sem_publicacao', () => {
    expect(estadoTitulo(ent({ cursor: cursor({ motivo: 'sem_publicacao' }) }))).toEqual({ estado: 'nao_medido', motivo: 'sem_publicacao' })
  })
  it('5. cursor ausente: 3 dias -> aprendendo; 5 dias -> sem_leitura', () => {
    const alvo = (dias: number) => ({ rodadas: 4, ultimaRodadaEm: iso(AGORA - 3 * H), saiuPor: null, publicadoEm: iso(AGORA - dias * D) })
    expect(estadoTitulo(ent({ cursor: null, alvo: alvo(3) }))).toEqual({ estado: 'nao_medido', motivo: 'aprendendo' })
    expect(estadoTitulo(ent({ cursor: null, alvo: alvo(5) })).estado).toBe('nao_medido')
    expect(estadoTitulo(ent({ cursor: null, alvo: alvo(5) }))).toMatchObject({ motivo: 'sem_leitura' })
  })
  it('5. linha em_andamento com alvo sem rodada há 10 h -> sem_leitura com ultimo e vistoAte; foco 1: 8h59 x 9h01', () => {
    const ult = iso(AGORA - 10 * H)
    const alvo = (ms: number) => ({ rodadas: 41, ultimaRodadaEm: iso(AGORA - ms), saiuPor: null, publicadoEm: iso(AGORA - 10 * D) })
    expect(estadoTitulo(ent({ alvo: alvo(10 * H) }, { titulo: linha() }))).toMatchObject({ estado: 'nao_medido', motivo: 'sem_leitura', ultimo: { estado: 'em_andamento' }, vistoAte: ult })
    expect(estadoTitulo(ent({ alvo: alvo(9 * H - 60_000) }, { titulo: linha() })).estado).toBe('em_andamento')
    expect(estadoTitulo(ent({ alvo: alvo(9 * H + 60_000) }, { titulo: linha() }))).toMatchObject({ estado: 'nao_medido', motivo: 'sem_leitura' })
  })
  it('5. cursor fora de dia (rodadas adiante e avaliado há > 9 h) -> sem_leitura', () => {
    expect(estadoTitulo(ent({ cursor: cursor({ avaliadoAteRodada: 30, avaliadoEm: iso(AGORA - 10 * H) }) }))).toMatchObject({ motivo: 'sem_leitura' })
    expect(estadoTitulo(ent({ cursor: cursor({ avaliadoAteRodada: 30, avaliadoEm: iso(AGORA - 2 * H) }) })).estado).toBe('sem_troca_vista')
  })
  it('6. validas = 0: regra (com ultimo) ou aprendendo se vídeo novo', () => {
    expect(estadoTitulo(ent({ cursor: cursor({ validasTitulo: 0 }) }, { titulo: linha() }))).toMatchObject({ estado: 'nao_medido', motivo: 'regra', ultimo: { estado: 'em_andamento' } })
    const novo = { rodadas: 8, ultimaRodadaEm: iso(AGORA - 3 * H), saiuPor: null, publicadoEm: iso(AGORA - 2 * D) }
    expect(estadoTitulo(ent({ cursor: cursor({ validasTitulo: 0 }), alvo: novo }))).toEqual({ estado: 'nao_medido', motivo: 'aprendendo' })
  })
  it('7. linha v2 atual: em_andamento com versões lidas, desde e ate; sumindo', () => {
    const e = estadoTitulo(ent({}, { titulo: linha() }))
    expect(e).toEqual({
      estado: 'em_andamento', sumindo: false, passagens: 8, desde: iso(AGORA - 50 * H), ate: iso(AGORA - 3 * H),
      versoes: [{ ref: 'a', rodadasEmW: 5, ultimaVista: iso(AGORA - 3 * H) }, { ref: 'b', rodadasEmW: 3, ultimaVista: iso(AGORA - 9 * H) }],
    })
    // sumindo: a versão que saiu de W (rodadasEmW 0) vem junto, para o texto dizer qual não aparece mais
    const sum = linha({ ficou: ficouT({ sumindo: true, versoes: [{ v: 0, rodadas_em_w: 8, ultima_vista: iso(AGORA - 3 * H) }] }) })
    expect(estadoTitulo(ent({}, { titulo: sum }))).toMatchObject({
      estado: 'em_andamento', sumindo: true,
      versoes: [{ ref: 'a', rodadasEmW: 8, ultimaVista: iso(AGORA - 3 * H) }, { ref: 'b', rodadasEmW: 0, ultimaVista: iso(AGORA - 9 * H) }],
    })
  })
  it('7. linha estavel + possivel_teste -> provavelmente_terminou com sumidas', () => {
    const l = linha({ ficouEstado: 'estavel', ficou: ficouT({ titulo: 'a', versoes: [{ v: 0, rodadas_em_w: 8, ultima_vista: iso(AGORA - 3 * H) }] }) })
    expect(estadoTitulo(ent({}, { titulo: l }))).toEqual({ estado: 'provavelmente_terminou', ficou: 'a', sumidas: [{ ref: 'b', rodadasEmW: 0, ultimaVista: iso(AGORA - 9 * H) }] })
  })
  it('8. linha indeterminada nao atual, com cursor mais novo -> sem_troca_vista', () => {
    const l = linha({ veredito: 'troca_observada', ficouEstado: 'em_andamento', ficou: ficouM, trocas: trocasM, ultimaAtualizacaoEm: iso(AGORA - 8 * H) })
    // indeterminada é da miniatura; no título a mesma forma é inválida e vale ausente
    expect(estadoTitulo(ent({}, { titulo: l })).estado).toBe('sem_troca_vista')
    expect(estadoMiniatura(ent({}, { miniatura: linha({ ...l }) })).estado).toBe('sem_troca_vista')
  })
  it('atual x nao atual compara instantes, não texto (…58.82+00:00 contra …58.820Z)', () => {
    const c = cursor({ avaliadoEm: '2026-10-23T09:00:58.820Z' })
    expect(estadoTitulo(ent({ cursor: c }, { titulo: linha({ ultimaAtualizacaoEm: '2026-10-23T09:00:58.82+00:00' }) })).estado).toBe('em_andamento')
    expect(estadoTitulo(ent({ cursor: c }, { titulo: linha({ ultimaAtualizacaoEm: '2026-10-23T09:00:58.819+00:00' }) })).estado).toBe('sem_troca_vista')
  })
  it('8. troca nao atual continua troca, com vistoAte e entre', () => {
    const l = linhaTroca({ ultimaAtualizacaoEm: iso(AGORA - 30 * H) })
    expect(estadoTitulo(ent({}, { titulo: l }))).toEqual({
      estado: 'troca', antes: 'a', depois: 'b', entre: { de: iso(AGORA - 80 * H), ate: iso(AGORA - 74 * H) }, vistoAte: iso(AGORA - 3 * H),
    })
  })
  it('linha de versaoRegra 1 vale ausente; forma inválida vale ausente', () => {
    expect(estadoTitulo(ent({}, { titulo: linha({ versaoRegra: 1 }) })).estado).toBe('sem_troca_vista')
    expect(estadoTitulo(ent({}, { titulo: linha({ ficou: { lixo: true } }) })).estado).toBe('sem_troca_vista')
    expect(estadoTitulo(ent({}, { titulo: linha({ trocas: 'x' }) })).estado).toBe('sem_troca_vista')
  })
  it('9. sem linha -> sem_troca_vista com desde = avaliadoEm - 7 x CADENCIA_H (D-P2)', () => {
    expect(estadoTitulo(ent())).toEqual({ estado: 'sem_troca_vista', desde: iso(AGORA - 2 * H - 7 * CADENCIA_H * H) })
  })
})

describe('estado de leitura da miniatura', () => {
  it('troca atual e nao atual; indeterminada atual; sem linha', () => {
    const t = linha({ veredito: 'troca_observada', ficouEstado: 'estavel', tipoTroca: 'sequencial', ficou: ficouM, trocas: trocasM })
    expect(estadoMiniatura(ent({}, { miniatura: t }))).toEqual({ estado: 'troca', antes: 'dh-a', depois: 'dh-b', entre: { de: iso(AGORA - 80 * H), ate: iso(AGORA - 74 * H) }, vistoAte: iso(AGORA - 3 * H) })
    expect(estadoMiniatura(ent({}, { miniatura: { ...t, ultimaAtualizacaoEm: iso(AGORA - 30 * H) } })).estado).toBe('troca')
    expect(estadoMiniatura(ent({}, { miniatura: { ...t, ficouEstado: 'em_andamento', tipoTroca: 'alternada' } })).estado).toBe('indeterminada')
    expect(estadoMiniatura(ent()).estado).toBe('sem_troca_vista')
  })
  it('miniatura nunca vira possivel_teste: linha com esse veredito vale ausente', () => {
    expect(estadoMiniatura(ent({}, { miniatura: linha() })).estado).toBe('sem_troca_vista')
  })
  it('validas_miniatura = 0 -> regra, independente do título', () => {
    const e = ent({ cursor: cursor({ validasMiniatura: 0 }) })
    expect(estadoMiniatura(e)).toEqual({ estado: 'nao_medido', motivo: 'regra' })
    expect(estadoTitulo(e).estado).toBe('sem_troca_vista')
  })
})
