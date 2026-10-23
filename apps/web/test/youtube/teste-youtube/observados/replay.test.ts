// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { carregarExport, linhasDaFixture, type AlvoExport, type FixtureColunar } from '@/lib/youtube/teste-youtube/observados/ensaio'
import { decidirCampo, rodadasDaMiniatura, rodadasDoTitulo, type EstadoRegra } from '@/lib/youtube/teste-youtube/observados/inferir'

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/replay-23-10.json', import.meta.url)), 'utf8')) as FixtureColunar
const alvos = carregarExport(linhasDaFixture(fixture))
const agoraMs = Date.parse(fixture.agora)

const UNICOS = 'YXfydW4tLAU G-Hyv6lQG0c g0W5cPmkWKM 3kH2Mq6kE6E 5LrOAfgIdw4 teMVb72ZMB8 A-lHdxsfYCE dgFKO2dyYhc z9uCiPIfKb0 3vyzSTWAxno'.split(' ')

describe('replay do título sobre o export de 23/10 (35 alvos)', () => {
  const estado = (a: AlvoExport): EstadoRegra =>
    decidirCampo('titulo', rodadasDoTitulo(a.leituras).rodadas, { publicadoMs: a.publicadoEm!.getTime(), agoraMs }).estado
  const esperado: Record<EstadoRegra, string[]> = {
    em_andamento: '2emVR-6NEmM FxP6Yzehs3k KdCouw4w7uA rh4LfKilm6s NsYd2UAN2AA ADECP7e1kjE 0thg8eunUto lnPfS9BCC_M Y6pJEbktw7Y pilQupJKe2o TtjDltoXhqI vzD6swtayKk kY4nm1gdXwg bY2q7zTwep4 DUj-F_Ff2Aw'.split(' '),
    sumindo: 'AKKb2Oz77fw xQcKF7hVts0 iqTrdmtqCCg'.split(' '),
    sem_troca_vista: ['6MYeq9cWCT8', '50b-VZ_PJZU', 'hm7FwmxfHp4', 'wr_NzNbKDVY', ...UNICOS],
    nao_medido: ['Tk_0L_vS5Y4', '8fi8uOPOJA8', 'ZdJe2woz0jY'],
    terminou: [], troca: [], indeterminada: [],
  }
  it('todos os 35 batem com o protótipo (0 divergências)', () => {
    const obtido: Record<string, string> = {}
    for (const [id, a] of alvos) obtido[id] = estado(a)
    const esp: Record<string, string> = {}
    for (const [est, ids] of Object.entries(esperado)) for (const id of ids) esp[id] = est
    expect(Object.keys(esp)).toHaveLength(35)
    expect(obtido).toEqual(esp)
  })
  it('nenhum dos 10 de título único dá teste, sumindo, terminou ou troca', () => {
    for (const id of UNICOS) expect(estado(alvos.get(id)!)).toBe('sem_troca_vista')
  })
})

describe('replay da miniatura sobre o mesmo export', () => {
  const estadoM = (a: AlvoExport): EstadoRegra =>
    decidirCampo('miniatura', rodadasDaMiniatura(a.leituras, a.thumbsPorId), { publicadoMs: a.publicadoEm!.getTime(), agoraMs }).estado
  it('indeterminada 2, nao_medido 4, sem_troca_vista 29 (igualdade exata)', () => {
    const por: Record<string, string[]> = { indeterminada: [], nao_medido: [], sem_troca_vista: [] }
    for (const [id, a] of alvos) (por[estadoM(a)] ??= []).push(id)
    expect(Object.keys(por).sort()).toEqual(['indeterminada', 'nao_medido', 'sem_troca_vista'])
    expect(por.indeterminada!.sort()).toEqual(['0thg8eunUto', 'bY2q7zTwep4'])
    expect(por.nao_medido!.sort()).toEqual(['8fi8uOPOJA8', 'DUj-F_Ff2Aw', 'ZdJe2woz0jY', 'kY4nm1gdXwg'])
    expect(por.sem_troca_vista).toHaveLength(29)
  })
})
