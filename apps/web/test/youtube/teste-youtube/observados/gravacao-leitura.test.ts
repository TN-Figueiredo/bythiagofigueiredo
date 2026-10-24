// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { gravacao, inferirObservadoDetalhe, type EntradaObs } from '@/lib/youtube/teste-youtube/observados/inferir'
import { lerCursor, lerLinha } from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { DH_A, DH_B, agoraEm, leitura, rodadas, thumb } from './fabrica'

const mk = (n: number, ls: ReturnType<typeof rodadas>, thumbs: ReturnType<typeof thumb>[] = []): EntradaObs => ({
  leituras: ls, thumbsPorId: new Map(thumbs.map(t => [t.id, t])), publicadoEm: new Date(agoraEm(0)), agoraMs: agoraEm(6 + (n - 1) * 6 + 1),
})
const AGORA_ISO = new Date(agoraEm(6 + 29 * 6 + 1)).toISOString()

describe('ida e volta pelo formato do banco (gravacao -> lerLinha/lerCursor)', () => {
  it('teste de título (alternando A/B)', () => {
    const itens = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 'AAB' : 'ABB'))
    const r = inferirObservadoDetalhe(mk(itens.length, rodadas(6, itens, x => ({ tituloExibido: 'Titulo ' + x }))))
    const g = gravacao({ r, estourou: false }, { agoraIso: AGORA_ISO, rodadas: 30, saiuPor: null })
    const l = lerLinha(g.linhas[0] as unknown as Record<string, unknown>)
    expect(l).not.toBeNull()
    expect(l).toMatchObject({ veredito: g.linhas[0]!.veredito, ficouEstado: g.linhas[0]!.ficou_estado, ficou: g.linhas[0]!.ficou, versaoRegra: 2 })
    const c = lerCursor(g.cursor as unknown as Record<string, unknown>)
    expect(c).toMatchObject({ validasTitulo: g.cursor.validas_titulo, validasMiniatura: g.cursor.validas_miniatura, motivo: 'ok' })
    expect(g.cursor.validas_titulo).toBeGreaterThan(0)
  })
  it('troca de título (A depois B)', () => {
    const itens = [...Array(20).fill('AAA'), ...Array(8).fill('BBB')]
    const r = inferirObservadoDetalhe(mk(itens.length, rodadas(6, itens, x => ({ tituloExibido: 'Titulo ' + x }))))
    const g = gravacao({ r, estourou: false }, { agoraIso: AGORA_ISO, rodadas: 28, saiuPor: null })
    const linhas = g.linhas.map(x => lerLinha(x as unknown as Record<string, unknown>))
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas[0]).toMatchObject({ veredito: 'troca_observada', ficouEstado: 'estavel', tipoTroca: 'sequencial' })
    expect((linhas[0]!.ficou as { transicao: unknown }).transicao).not.toBeNull()
  })
  it('indeterminada de miniatura (alternando A/B de dhash)', () => {
    const itens = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 'AAB' : 'ABB'))
    const ls = rodadas(6, itens, x => ({ miniaturaId: x === 'A' ? 1 : 2 }))
    const r = inferirObservadoDetalhe(mk(itens.length, ls, [thumb(1, DH_A), thumb(2, DH_B)]))
    const g = gravacao({ r, estourou: false }, { agoraIso: AGORA_ISO, rodadas: 30, saiuPor: null })
    const m = g.linhas.find(x => x.campo === 'miniatura')!
    expect(m).toBeDefined()
    expect(lerLinha(m as unknown as Record<string, unknown>)).toMatchObject({ veredito: 'troca_observada', ficouEstado: 'em_andamento', ficou: m.ficou })
  })
  it('versaoRegra 1 e forma inválida -> null; cursor inválido -> null', () => {
    const base = { veredito: 'troca_observada', ficou_estado: 'estavel', tipo_troca: 'sequencial', ficou: {}, trocas: [], versao_regra: 2, motivo: null, ultima_atualizacao_em: AGORA_ISO }
    expect(lerLinha(base)).not.toBeNull()
    expect(lerLinha({ ...base, versao_regra: 1 })).toBeNull()
    expect(lerLinha({ ...base, veredito: 'x' })).toBeNull()
    expect(lerLinha({ ...base, ultima_atualizacao_em: 5 })).toBeNull()
    expect(lerCursor({ avaliado_ate_rodada: 'x' })).toBeNull()
  })
  it('leitura() importada: fabrica disponível', () => { expect(leitura(0).id).toBeGreaterThan(0) })
})
