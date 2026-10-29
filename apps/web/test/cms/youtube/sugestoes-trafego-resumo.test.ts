// F4 T4 (resto): frase-resumo, barra e faixa de motivo geral. Puro.
import { describe, expect, it } from 'vitest'
import { resumirTrafego, type TrafegoDaVista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/trafego'

const mk = (estado: TrafegoDaVista['estado'], motivo: TrafegoDaVista['motivo'] = null, ateIso: string | null = '2026-10-27'): { trafego: TrafegoDaVista } =>
  ({ trafego: { estado, texto: 'x', curto: 'x', info: 'i', podePedir: false, motivo, ateIso } })

describe('resumirTrafego', () => {
  it('sem cartão com linha: null', () => {
    expect(resumirTrafego([{ trafego: null }])).toBeNull()
    expect(resumirTrafego([])).toBeNull()
  })
  it('todos "não": frase única', () => {
    const r = resumirTrafego([mk('nao'), mk('nao'), mk('nao')])!
    expect(r.frase).toBe('Visitas vindas dos concorrentes: nenhuma sugestão te manda visitas hoje (dado até 27/10).')
    expect(r.barra).toEqual([{ estado: 'nao', n: 3 }])
    expect(r.geral).toBeNull()
  })
  it('mistura: diz a mistura, com singular/plural', () => {
    const r = resumirTrafego([mk('sim'), mk('nao'), mk('nao'), mk('nao_medido', 'origem_nao_informada'), mk('erro', 'erro_de_leitura')])!
    expect(r.frase).toBe('Visitas vindas dos concorrentes: 1 de 5 já te manda visitas; 2 não mandam; 1 ainda não medida; 1 não pôde ser lida (dado até 27/10).')
    expect(r.barra.map((b) => b.estado)).toEqual(['sim', 'nao', 'nao_medido', 'erro'])
  })
  it('sem "sim": o "não" leva "de N sugestões"', () => {
    expect(resumirTrafego([mk('nao'), mk('nao_medido', 'sem_terceiro')])!.frase).toContain('1 de 2 sugestões não te mandam visitas; 1 ainda não medida')
  })
  it('motivo geral igual em todos: faixa com texto completo, sem frase', () => {
    const r = resumirTrafego([mk('nao_medido', 'cobertura_velha', '2026-10-24'), mk('nao_medido', 'cobertura_velha', '2026-10-24')])!
    expect(r.frase).toBeNull()
    expect(r.geral).toEqual({ tom: 'warn', texto: 'A coleta da origem das visitas parou em 24/10. Até ela voltar, nenhum cartão diz sim ou não.' })
    for (const m of ['sem_cobertura', 'nao_conferido', 'coleta_desligada'] as const) expect(resumirTrafego([mk('nao_medido', m)])!.geral?.tom).toBe('warn')
  })
  it('motivos gerais diferentes entre si: frase, não faixa', () => {
    const r = resumirTrafego([mk('nao_medido', 'cobertura_velha'), mk('nao_medido', 'sem_cobertura')])!
    expect(r.geral).toBeNull()
    expect(r.frase).toContain('2 ainda não medidas')
  })
  it('todos erro: faixa de erro, sem frase', () => {
    const r = resumirTrafego([mk('erro', 'erro_de_leitura'), mk('erro', 'schema_ausente')])!
    expect(r.frase).toBeNull()
    expect(r.geral?.tom).toBe('err')
  })
  it('nunca escreve "0 visitas"', () => {
    for (const r of [resumirTrafego([mk('nao')]), resumirTrafego([mk('nao_medido', 'origem_nao_informada')])]) expect(JSON.stringify(r)).not.toMatch(/\b0 visitas/)
  })
})
