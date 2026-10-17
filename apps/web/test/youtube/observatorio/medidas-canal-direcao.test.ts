// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { blocoDeDirecao, type EntradaDaDirecao } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/direcao-model'
import { DirecaoBloco } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/direcao-bloco'
import { estadoDaPagina, type EstadoDaPagina } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/estado-model'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { mesmaIdadeExisteEm } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { AGORA, HOJE, J, m3a, m8, medidasFalsas } from './medidas-canal-fixture'

const F = { num: (v: number | null) => (v === null ? '—' : String(v)) }
const sync = { state: 'ok' as const, last: AGORA - 3_600_000, errorSince: null }
const ativo = (): EstadoDaPagina => estadoDaPagina(m8('ativo'), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
const emErro = (): EstadoDaPagina => estadoDaPagina(m8('ativo'), { state: 'erro', last: Date.parse('2026-10-12T12:00:00Z'), errorSince: AGORA - 4 * 86_400_000 }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
const videos = (variacao: number) => medido({ variacao, direcao: 'estavel', medianaRecente: 100 * (1 + variacao), medianaAnterior: 100 }, 20, J)
const com = (m: MedidasDoCanal, long: Partial<MedidasDoCanal['porFormato']['long']>): MedidasDoCanal => ({ ...m, porFormato: { ...m.porFormato, long: { ...m.porFormato.long, ...long } } })
const ent = (o: Partial<EntradaDaDirecao> = {}): EntradaDaDirecao => ({ F, medidas: medidasFalsas({}), soShorts: false, estado: ativo(), hojeSP: HOJE, ...o })
const html = (e: EntradaDaDirecao) => renderToStaticMarkup(createElement(DirecaoBloco, { bloco: blocoDeDirecao(e) }))

describe('bloco Direção: dado ausente', () => {
  it('canal inteiro não medido: barra de progresso com a data, e a frase não dá veredito', () => {
    const e = ent({ medidas: medidasFalsas({ m3a: naoMedido('pouco_registro', { n: 40, fechaEm: '2026-10-30' }) }) })
    const b = blocoDeDirecao(e)
    const l = b.linhas[0]!
    expect(l.estado).toBe('progresso')
    if (l.estado === 'progresso') expect(l.progresso).toMatchObject({ total: 56, fechaEm: '2026-10-30', feitos: 43 })
    expect(b.frase.simbolo).toBeNull()
    expect(`${b.frase.negrito}${b.frase.resto}`).toMatch(/^Sem veredito ainda: faltam 13 dias de registro/)
    expect(`${b.frase.negrito}${b.frase.resto}`).not.toMatch(/Subindo|Descendo|Sem mudança/)
    expect(html(e)).toContain('passa a existir em <b class="num">30/10/2026</b>')
  })
  it('queda antes da data: três casas pontilhadas e a barra, nunca "0 janelas em queda"', () => {
    const b = blocoDeDirecao(ent())
    expect(b.queda.estado).toBe('progresso')
    expect(b.queda.casas.map(c => c.estado)).toEqual(['ainda_nao_existe', 'ainda_nao_existe', 'ainda_nao_existe'])
    const h = html(ent())
    expect(h).not.toMatch(/0 janelas/)
    expect(h).toContain('de 112 dias')
  })
  it('queda depois da data e não medida neste canal: hachura com o motivo', () => {
    const e = ent({ hojeSP: '2027-01-10', medidas: medidasFalsas({ m8: m8('ativo') }) })
    const b = blocoDeDirecao(e)
    expect(b.queda.estado).toBe('hachura')
    expect(b.queda.casas.every(c => c.estado === 'nao_medida')).toBe(true)
  })
  it('leitura justa antes da data: barra de 180 dias com a data do calendário; depois da data, hachura', () => {
    const antes = blocoDeDirecao(ent()).linhas[2]!
    expect(antes.estado).toBe('progresso')
    if (antes.estado === 'progresso') expect(antes.progresso).toMatchObject({ total: 180, fechaEm: mesmaIdadeExisteEm() })
    expect(blocoDeDirecao(ent({ hojeSP: '2027-04-10' })).linhas[2]!.estado).toBe('hachura')
  })
  it('canal com a leitura parada: nenhuma barra promete data', () => {
    const b = blocoDeDirecao(ent({ estado: emErro(), medidas: medidasFalsas({ m3a: naoMedido('pouco_registro', { n: 40, fechaEm: '2026-10-30' }) }) }))
    expect(b.linhas.some(l => l.estado === 'progresso')).toBe(false)
    expect(b.queda.estado).not.toBe('progresso')
    const l = b.linhas[0]!
    expect(l.estado === 'hachura' && l.motivo).toMatch(/a leitura parou em 12\/10/)
  })
  it('medidas não carregaram: todas as linhas em não carregou, frase sem veredito', () => {
    const b = blocoDeDirecao(ent({ medidas: null }))
    expect(b.linhas.every(l => l.estado === 'nao_carregou')).toBe(true)
    expect(b.queda.estado).toBe('nao_carregou')
    expect(b.frase.simbolo).toBeNull()
    const h = html(ent({ medidas: null }))
    expect(h).toContain('obs-au-falhou')
    expect(h).not.toContain('obs-ch-nm')
    expect(h).not.toContain('role="alert"')
  })
})

describe('bloco Direção: fronteiras', () => {
  it('−49,8% não é fora da escala; −50,4% é, com "ou menos"', () => {
    const dentro = blocoDeDirecao(ent({ medidas: com(medidasFalsas({}), { m3b: videos(-0.498) }) })).linhas[1]!
    const fora = blocoDeDirecao(ent({ medidas: com(medidasFalsas({}), { m3b: videos(-0.504) }) })).linhas[1]!
    expect(dentro.estado === 'medido' && dentro.foraDaEscala).toBeNull()
    expect(fora.estado === 'medido' && fora.foraDaEscala).toBe('abaixo')
    expect(html(ent({ medidas: com(medidasFalsas({}), { m3b: videos(-0.504) }) }))).toContain('ou menos, fora da escala')
    expect(html(ent({ medidas: com(medidasFalsas({}), { m3b: videos(-0.498) }) }))).not.toContain('fora da escala')
  })
  it('as três casas em ▼ são "Em queda sustentada"; duas não', () => {
    const tres = blocoDeDirecao(ent({ medidas: medidasFalsas({ m8: m8('em_queda', { queda: [-0.3, -0.2, -0.15] }) }) })).queda
    const duas = blocoDeDirecao(ent({ medidas: medidasFalsas({ m8: m8('ativo', { queda: [-0.3, -0.2, 0.05] }) }) })).queda
    expect(tres.estado === 'medida' && tres.emQueda).toBe(true)
    expect(duas.estado === 'medida' && duas.emQueda).toBe(false)
    expect(tres.casas.map(c => c.rotulo)).toEqual(['janela atual', 'a anterior', 'antes dela'])
  })
  it('canal só de Shorts: as duas linhas de vídeos novos dizem que não há longos, e a frase não aponta para elas', () => {
    const b = blocoDeDirecao(ent({ soShorts: true }))
    expect(b.linhas[1]).toMatchObject({ estado: 'hachura', motivo: 'este canal não tem vídeos longos' })
    expect(b.linhas[2]).toMatchObject({ estado: 'hachura', motivo: 'este canal não tem vídeos longos' })
    expect(b.frase.resto).not.toMatch(/linhas abaixo/)
  })
  it('a dica de idade fica só na linha de "views de hoje", e só quando desce', () => {
    const desce = blocoDeDirecao(ent({ medidas: com(medidasFalsas({}), { m3b: videos(-0.3), m3c: videos(-0.3) }) }))
    expect(desce.linhas.map(l => l.estado === 'medido' ? l.dica : 'x')).toEqual([null, expect.stringContaining('só idade'), null])
    const sobe = blocoDeDirecao(ent({ medidas: com(medidasFalsas({}), { m3b: videos(0.3) }) }))
    expect(sobe.linhas[1]!.estado === 'medido' && sobe.linhas[1]!.dica).toBeNull()
  })
  it('o veredito da frase é só o do canal inteiro (+18%, +10%, +9%, 0%)', () => {
    const txt = (r: number) => { const b = blocoDeDirecao(ent({ medidas: medidasFalsas({ m3a: m3a(r, 100) }) })); return b.frase.negrito }
    expect(txt(118)).toBe('Subindo +18% em 28 dias.')
    expect(txt(110)).toBe('Subindo +10% em 28 dias.')
    expect(txt(109)).toBe('Sem mudança +9% em 28 dias.')
    expect(txt(100)).toBe('Sem mudança 0% em 28 dias.')
  })
  it('a janela que cruza 24/08 leva o aviso com a data em que fica limpa', () => {
    const m = medido({ variacao: 0.18, direcao: 'subindo', ganhoRecente: 118, ganhoAnterior: 100 }, 56, { de: '2026-08-10', ate: '2026-09-07', dias: 28 }, [])
    const l = blocoDeDirecao(ent({ medidas: medidasFalsas({ m3a: m as never }) })).linhas[0]!
    expect(l.estado === 'medido' && l.aviso).toMatch(/cruza a mudança de contagem de 24\/08; fica limpa em \d\d\/\d\d\/2026/)
  })
})
