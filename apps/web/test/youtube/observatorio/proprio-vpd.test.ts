import { describe, it, expect } from 'vitest'
import { vpdDoVideo, vpdDoCanal, motivoVpdTexto, baseVpdTexto, MIN_DIAS_VPD } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiarioCanal, DiarioLinha, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const HOJE = '2026-10-11', ULT = '2026-10-08'
const d = (n: number) => addDays(ULT, -n)
const serie = (ytId: string, views: Array<number | null>): DiarioLinha[] => views.map((v, k) => ({ ytId, dia: d(k), views: v }))
const ok = (linhas: DiarioLinha[], ultimoDia: string | null = ULT): Privado<DiarioCanal> => ({ acesso: 'ok', dado: { canalId: 'c', ultimoDia, linhas, descartados: 0 } })
const dm = (x: string) => x.slice(8) + '/' + x.slice(5, 7)

describe('views por dia de um vídeo', () => {
  it('média sobre os dias COM linha: zero medido conta, dia sem linha não', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', [7, 0, 0, 0, 0, 0, 0]), descartados: 0 }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 7 })
  })
  it('views nulas não contam como dia medido', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', [7, null, 0, 0, 0, 0, 0, 0]), descartados: 0 }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 7 })
  })
  it('menos de 7 dias medidos: null, nunca 0', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', Array(MIN_DIAS_VPD - 1).fill(3)), descartados: 0 }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: null, dias: MIN_DIAS_VPD - 1 })
  })
  it('vídeo sem linha: null com 0 dias; canal sem último dia: null', () => {
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: ULT, linhas: [], descartados: 0 }, 'v1')).toEqual({ vpd: null, dias: 0 })
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: null, linhas: [], descartados: 0 }, 'v1')).toEqual({ vpd: null, dias: 0 })
  })
  it('só os 28 dias que terminam no último dia gravado', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: [...serie('v1', Array(28).fill(1)), { ytId: 'v1', dia: d(28), views: 1000 }], descartados: 0 }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 28 })
  })
  it('sete dias de zero medido dão 0 medido (canal parado), não null', () => {
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: ULT, linhas: serie('v1', Array(7).fill(0)), descartados: 0 }, 'v1')).toEqual({ vpd: 0, dias: 7 })
  })
  it('linha de outro vídeo e linha depois do último dia gravado não entram', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: [...serie('v1', Array(7).fill(2)), ...serie('v2', Array(7).fill(900)), { ytId: 'v1', dia: addDays(ULT, 1), views: 5000 }], descartados: 0 }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 2, dias: 7 })
  })
  it('exatamente 7 dias medidos já bastam, com o menor da janela (o 28º dia entra)', () => {
    const linhas = [...serie('v1', Array(6).fill(0)), { ytId: 'v1', dia: d(27), views: 14 }]
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: ULT, linhas, descartados: 0 }, 'v1')).toEqual({ vpd: 2, dias: 7 })
  })
})

describe('views por dia do canal', () => {
  it('mediana entre os longos acompanhados que têm o número', () => {
    const c = vpdDoCanal(ok([...serie('a', Array(7).fill(1)), ...serie('b', Array(7).fill(3)), ...serie('x', Array(7).fill(100)), ...serie('poucos', [9])]), ['a', 'b', 'poucos'], HOJE)
    expect(c).toEqual({ valor: 2, motivo: null, n: 2, janela: { de: d(27), ate: ULT }, ultimoDia: ULT })
  })
  it('mediana de número ímpar de vídeos é o do meio; um vídeo com zero medido entra como 0', () => {
    const c = vpdDoCanal(ok([...serie('a', Array(7).fill(0)), ...serie('b', Array(7).fill(4)), ...serie('c', Array(7).fill(9))]), ['a', 'b', 'c'], HOJE)
    expect(c).toMatchObject({ valor: 4, n: 3, motivo: null })
    const zero = vpdDoCanal(ok(serie('a', Array(7).fill(0))), ['a'], HOJE)
    expect(zero).toMatchObject({ valor: 0, n: 1, motivo: null })
  })
  it('cada ausência tem o seu motivo, e o valor é null', () => {
    expect(vpdDoCanal({ acesso: 'negado' }, ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'sem-acesso' })
    expect(vpdDoCanal({ acesso: 'erro' }, ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(vpdDoCanal(ok([], null), ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'sem-diario', janela: null })
    expect(vpdDoCanal(ok(serie('a', Array(7).fill(1))), [], HOJE)).toMatchObject({ valor: null, motivo: 'sem-longos' })
    expect(vpdDoCanal(ok(serie('a', [1, 1])), ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'poucos-dias', n: 0 })
  })
  it('sem número, a janela é null e n é 0: nada de base para um valor que não existe', () => {
    for (const c of [vpdDoCanal({ acesso: 'negado' }, ['a'], HOJE), vpdDoCanal({ acesso: 'erro' }, ['a'], HOJE), vpdDoCanal(ok([], null), ['a'], HOJE), vpdDoCanal(ok(serie('a', [1, 1])), ['a'], HOJE)]) {
      expect(c.valor).toBeNull(); expect(c.janela).toBeNull(); expect(c.n).toBe(0)
    }
  })
  it('longos acompanhados sem nenhuma linha no diário: poucos-dias, nunca 0', () => {
    expect(vpdDoCanal(ok(serie('outro', Array(7).fill(5))), ['a', 'b'], HOJE)).toMatchObject({ valor: null, motivo: 'poucos-dias', n: 0 })
  })
  it('diário parado há mais de 7 dias: null com o motivo, mesmo havendo linhas (o número velho não passa por atual)', () => {
    const c = vpdDoCanal(ok(serie('a', Array(7).fill(5))), ['a'], addDays(ULT, 8))
    expect(c).toMatchObject({ valor: null, motivo: 'diario-parado', ultimoDia: ULT })
    expect(vpdDoCanal(ok(serie('a', Array(7).fill(5))), ['a'], addDays(ULT, 7)).valor).toBe(5)
  })
  it('diário cheio e nenhum longo acompanhado: sem-longos com a frase certa, nunca "a coleta ainda não gravou"', () => {
    const c = vpdDoCanal(ok(serie('curto', Array(10).fill(3))), [], HOJE)
    expect(c).toMatchObject({ valor: null, motivo: 'sem-longos', ultimoDia: ULT })
    expect(motivoVpdTexto(c.motivo!, c, dm)).toBe('nenhum vídeo longo acompanhado')
  })
  it('diário vazio e nenhum longo acompanhado: sem-diario com a frase certa', () => {
    const c = vpdDoCanal(ok([], null), [], HOJE)
    expect(c).toMatchObject({ valor: null, motivo: 'sem-diario', ultimoDia: null })
    expect(motivoVpdTexto(c.motivo!, c, dm)).toBe('a coleta diária ainda não gravou este canal')
  })
  it('a ordem dos motivos: sem acesso e leitura falhou antes de tudo; parado antes de sem-longos', () => {
    expect(vpdDoCanal(ok([], null), [], HOJE).motivo).toBe('sem-diario')
    expect(vpdDoCanal(ok(serie('a', Array(7).fill(5))), [], addDays(ULT, 20)).motivo).toBe('diario-parado')
  })
})

describe('textos', () => {
  it('a base diz a janela e quantos vídeos; sem valor não há base', () => {
    const c = vpdDoCanal(ok([...serie('a', Array(7).fill(1)), ...serie('b', Array(7).fill(3))]), ['a', 'b'], HOJE)
    expect(baseVpdTexto(c, dm)).toBe('média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 2 longos')
    expect(baseVpdTexto(vpdDoCanal({ acesso: 'negado' }, ['a'], HOJE), dm)).toBeNull()
  })
  it('um longo só: singular', () => {
    expect(baseVpdTexto(vpdDoCanal(ok(serie('a', Array(7).fill(1))), ['a'], HOJE), dm)).toMatch(/de 1 longo$/)
  })
  it('zero medido tem base (é número); diário parado não tem', () => {
    expect(baseVpdTexto(vpdDoCanal(ok(serie('a', Array(7).fill(0))), ['a'], HOJE), dm)).not.toBeNull()
    expect(baseVpdTexto(vpdDoCanal(ok(serie('a', Array(7).fill(1))), ['a'], addDays(ULT, 30)), dm)).toBeNull()
  })
  it('motivos: frase por estado, com a data quando parou, sem palavra interna', () => {
    expect(motivoVpdTexto('diario-parado', { ultimoDia: ULT }, dm)).toBe('a coleta diária deste canal parou em 08/10')
    expect(motivoVpdTexto('poucos-dias', { ultimoDia: ULT }, dm)).toBe('menos de 7 dias medidos nos últimos 28')
    expect(motivoVpdTexto('sem-acesso', { ultimoDia: null }, dm)).toBe('só quem edita o site vê as views por dia do seu canal')
    expect(motivoVpdTexto('leitura-falhou', { ultimoDia: null }, dm)).toBe('a leitura das views por dia falhou agora; recarregue a página')
    expect(motivoVpdTexto('sem-diario', { ultimoDia: null }, dm)).toBe('a coleta diária ainda não gravou este canal')
    expect(motivoVpdTexto('sem-longos', { ultimoDia: null }, dm)).toBe('nenhum vídeo longo acompanhado')
    for (const m of ['sem-acesso', 'leitura-falhou', 'sem-diario', 'diario-parado', 'sem-longos', 'poucos-dias'] as const) {
      expect(motivoVpdTexto(m, { ultimoDia: ULT }, dm)).not.toMatch(/L2|lote|day_pt|Analytics|dataset|undefined|null/)
      expect(motivoVpdTexto(m, { ultimoDia: null }, dm)).not.toMatch(/L2|lote|day_pt|Analytics|dataset|undefined|null/)
    }
  })
  it('diário parado sem a data (não deveria ocorrer): a frase não imprime "undefined"', () => {
    expect(motivoVpdTexto('diario-parado', { ultimoDia: null }, dm)).toBe('a coleta diária deste canal parou')
  })
})
