// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { VersaoPropria, VersoesDoVideo } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import { diaDaTroca, desdeDaTroca, trocasQueContam } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-contam'

const D = '2026-03-20'
const meio = (dia: string): string => `${dia}T20:00:00.000Z`
let n = 0
function v(extra: Partial<VersaoPropria> = {}): VersaoPropria {
  n++
  return {
    id: 'v' + n, ytId: 'abcdefghijk', campo: 'title', texto: 'Novo', hash: 'h', thumb: null, primeiroDia: D, ultimoDia: D,
    vistaDesde: meio(D), vistaAte: meio(D), janela: { de: meio(addDays(D, -1)), ate: meio(D) }, precisao: '1d',
    origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, preRegistro: false, corrente: true, ...extra,
  }
}
const video = (versoes: VersaoPropria[]): VersoesDoVideo => ({
  ytId: 'abcdefghijk', versoes,
  registro: { title: { estado: 'com_trocas', conferidoAte: D }, thumb: { estado: 'com_trocas', conferidoAte: D }, desc: { estado: 'sem_versao', conferidoAte: null } },
})
const thumb = (retoque = false) => ({ dhash: 'a', sha256: null, blobUrl: null, imagemExata: true, retoque })

describe('trocasQueContam', () => {
  it('linha de base, rotação, retoque, descrição e pré-registro ficam fora', () => {
    const fora = [v({ origem: 'linha_de_base' }), v({ origem: 'ab_lab', eventoAb: 'rotacao' }), v({ campo: 'thumb', thumb: thumb(true) }), v({ campo: 'desc' }), v({ preRegistro: true })]
    expect(trocasQueContam(video(fora))).toEqual([])
  })
  it('vencedor, restauro, fora do sistema e origem não sabida entram', () => {
    const dentro = [v({ origem: 'ab_lab', eventoAb: 'vencedor' }), v({ origem: 'ab_lab', eventoAb: 'restauro' }), v({ origem: 'fora_do_sistema' }), v({ origem: 'nao_se_sabe' })]
    expect(trocasQueContam(video(dentro))).toHaveLength(4)
  })
  it('origem cms entra (a tela a trata como não sabida e conta)', () => {
    expect(trocasQueContam(video([v({ origem: 'cms' })]))).toHaveLength(1)
  })
  it('título e thumbnail no mesmo dia: título primeiro; depois por data', () => {
    const t = v({ campo: 'thumb', thumb: thumb(), janela: { de: meio(addDays(D, -1)), ate: `${D}T10:00:00.000Z` } })
    const ti = v({ campo: 'title', janela: { de: meio(addDays(D, -1)), ate: `${D}T20:00:00.000Z` } })
    const antes = v({ campo: 'thumb', thumb: thumb(), janela: { de: meio(addDays(D, -9)), ate: meio(addDays(D, -8)) } })
    expect(trocasQueContam(video([t, ti, antes])).map(x => x.id)).toEqual([antes.id, ti.id, t.id])
  })
  it('vídeo sem versão: lista vazia', () => { expect(trocasQueContam(video([]))).toEqual([]) })
})

describe('diaDaTroca e desdeDaTroca', () => {
  it('captura às 12:00 UTC é o dia do Pacífico, não o dia UTC', () => {
    const x = v({ janela: { de: '2026-03-19T05:00:00.000Z', ate: '2026-03-20T05:00:00.000Z' } })
    expect(diaDaTroca(x)).toBe(dayPt(new Date('2026-03-20T05:00:00.000Z')))
    expect(diaDaTroca(x)).toBe('2026-03-19')
  })
  it('janela nula: lança nas duas', () => {
    expect(() => diaDaTroca(v({ janela: null }))).toThrow()
    expect(() => desdeDaTroca(v({ janela: null }), 7)).toThrow()
  })
  it('janela começando há 6 dias dá hoje − 15 (6 + 7 + 2)', () => {
    const hoje = '2026-04-20'
    const x = v({ janela: { de: meio(addDays(hoje, -6)), ate: meio(addDays(hoje, -5)) } })
    expect(desdeDaTroca(x, 7)).toBe(addDays(hoje, -15))
  })
})
