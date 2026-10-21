// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { rodadasDeTitulo } from '@/lib/youtube/teste-youtube/rodadas'
import { REGRA_TESTE_YOUTUBE_VERSAO, type OpcoesDeteccao } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9 } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura, rodadas } from './sintetico'

const INICIO = '2026-10-10T10:00:00.000Z'
const H = 3_600_000
const textos = { A: 'Titulo A', B: 'Titulo B' }

const cenarios: Array<[string, ReturnType<typeof rodadas>]> = [
  ['mistura estavel', rodadas({ inicio: INICIO, intervaloMs: 4 * H, padroes: ['AB', 'AB', 'AAB', 'ABB', 'AB', 'BA'], textos })],
  ['sem mistura', rodadas({ inicio: INICIO, intervaloMs: 4 * H, padroes: ['AA', 'AA', 'AA', 'AA'], textos })],
  ['so B', rodadas({ inicio: INICIO, intervaloMs: 4 * H, padroes: ['BBB', 'BB', 'BBB'], textos })],
]

describe('rodadasDeTitulo', () => {
  it('fixture qIg9: 20 rodadas, 13 mistas', () => {
    const { leituras } = carregarQIg9()
    const r = rodadasDeTitulo(leituras)
    expect(r).toHaveLength(20)
    expect(r.filter(x => x.mista)).toHaveLength(13)
    expect(r.filter(x => x.mista).length).toBe(detectarTesteYoutube(leituras).contagem.rodadasMistasTitulo)
  })

  it('paridade com a regra nos sinteticos, com e sem escritas conhecidas', () => {
    const escritas: OpcoesDeteccao = { escritasConhecidas: [{ em: '2026-10-10T14:20:00.000Z', campo: 'titulo' }, { em: '2026-10-10T22:00:00.000Z', campo: 'titulo' }] }
    for (const [nome, ls] of cenarios) {
      for (const opts of [undefined, escritas]) {
        const v = detectarTesteYoutube(ls, opts)
        const r = rodadasDeTitulo(ls, opts)
        expect(r.length, nome).toBe(v.contagem.rodadas)
        expect(r.filter(x => x.mista).length, nome).toBe(v.contagem.rodadasMistasTitulo)
        expect(r.filter(x => x.emQuarentena).length, nome).toBe(v.contagem.rodadasEmQuarentena)
        expect(r.filter(x => x.longa).length, nome).toBe(v.contagem.rodadasLongas)
      }
    }
  })

  it('misturada inclui a rodada em quarentena', () => {
    const ls = rodadas({ inicio: INICIO, intervaloMs: 4 * H, padroes: ['AB'], textos })
    const escrita: OpcoesDeteccao = { escritasConhecidas: [{ em: '2026-10-10T09:30:00.000Z', campo: 'titulo' }] }
    const [r] = rodadasDeTitulo(ls, escrita)
    expect(r?.emQuarentena).toBe(true)
    expect(r?.mista).toBe(false)
    expect(r?.misturada).toBe(true)
    expect(r?.rodadaId).toBe('r0')
    expect(r?.de).toBe(INICIO)
    expect(Object.keys(r?.votos ?? {})).toHaveLength(2)
    expect(Object.values(r?.textos ?? {}).sort()).toEqual(['Titulo A', 'Titulo B'])
  })

  it('chave distingue origem', () => {
    const ls = [
      leitura({ em: INICIO, rodada: 'r0', titulo: 'Titulo A', origem: 'vercel' }),
      leitura({ em: '2026-10-10T10:00:02.000Z', rodada: 'r0', titulo: 'Titulo A', origem: 'forja' }),
    ]
    const r = rodadasDeTitulo(ls)
    expect(r).toHaveLength(2)
    expect(r[0]!.chave).not.toBe(r[1]!.chave)
    expect(r[0]!.rodadaId).toBe(r[1]!.rodadaId)
  })

  it('versao da regra nao muda', () => {
    expect(REGRA_TESTE_YOUTUBE_VERSAO).toBe(2)
  })
})
