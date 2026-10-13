// @vitest-environment node
// A5 · E11 · Tarefa 11: o modelo dos estados das dimensões. Puro. A tela só lê o que sai daqui para nunca mentir:
// vazio (ainda não coletado), zero medido, não medido, coleta em erro, passo desligado e schema ausente são seis
// estados distintos, e nenhum vira zero nem vira o outro.
import { describe, it, expect } from 'vitest'
import {
  estadoDoDia, estadoDoDiaLido, taxaDeClique, classificarConjunto, rotuloDoValor,
  type EstadoConjunto, type EstadoValor,
} from '@/lib/youtube/observatorio/proprio/dimensoes-estado'

const base = {
  coberto: true, baseMedida: true, antesDoInicio: false, desde: '2026-10-10',
  linhas: [] as { valor: string; views: number | null; minutos: number | null }[], base: 10 as number | null,
}

describe('estadoDoDia', () => {
  it('fora da cobertura = não medido (a cobertura é apagada no teste e o dia nunca vira zero)', () => {
    const d = estadoDoDia({ ...base, coberto: false, linhas: [{ valor: 'BR', views: 10, minutos: 1 }] })
    expect(d.de('BR')).toEqual({ tipo: 'nao_medido', motivo: 'fora_da_cobertura', desde: '2026-10-10' })
    expect(d.de('US')).toEqual({ tipo: 'nao_medido', motivo: 'fora_da_cobertura', desde: '2026-10-10' })
  })
  it('antes do início traz a data do conjunto e vence a falta de cobertura', () => {
    const d = estadoDoDia({ ...base, coberto: false, antesDoInicio: true, desde: '2026-09-08' })
    expect(d.de('BR')).toEqual({ tipo: 'nao_medido', motivo: 'antes_do_inicio', desde: '2026-09-08' })
  })
  it('coberto com linha = valor, com as métricas como vieram', () => {
    const d = estadoDoDia({ ...base, linhas: [{ valor: 'BR', views: 7, minutos: 2.5 }] })
    expect(d.de('BR')).toEqual({ tipo: 'valor', views: 7, minutos: 2.5 })
  })
  it('métrica nula na linha continua nula (nunca zero)', () => {
    const d = estadoDoDia({ ...base, linhas: [{ valor: 'BR', views: null, minutos: 3 }] })
    expect(d.de('BR')).toEqual({ tipo: 'valor', views: null, minutos: 3 })
  })
  it('coberto, sem linha do valor e a soma fecha com a base = zero medido', () => {
    const d = estadoDoDia({ ...base, linhas: [{ valor: 'BR', views: 10, minutos: 1 }] })
    expect(d.de('US')).toEqual({ tipo: 'zero_medido' })
    expect(d.soma).toBe(10)
    expect(d.omitido).toBe(0)
  })
  it('soma abaixo da base = zero ou abaixo do limiar, e o omitido é a diferença', () => {
    const d = estadoDoDia({ ...base, linhas: [{ valor: 'BR', views: 6, minutos: 1 }] })
    expect(d.de('US')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
    expect(d.omitido).toBe(4)
    expect(d.emRevisao).toBe(false)
  })
  it('soma acima da base = em revisão para TODO valor do dia, sem número', () => {
    const d = estadoDoDia({ ...base, linhas: [{ valor: 'BR', views: 12, minutos: 1 }] })
    expect(d.emRevisao).toBe(true)
    expect(d.omitido).toBeNull()
    expect(d.de('BR')).toEqual({ tipo: 'em_revisao' })
    expect(d.de('US')).toEqual({ tipo: 'em_revisao' })
  })
  it('base nula com base medida quer dizer dia medido sem atividade (base 0): sem linha = zero medido', () => {
    const d = estadoDoDia({ ...base, base: null })
    expect(d.de('BR')).toEqual({ tipo: 'zero_medido' })
  })
  it('buraco na base: coberto no conjunto e base não medida = não medido, motivo base_nao_medida', () => {
    const d = estadoDoDia({ ...base, baseMedida: false, base: null })
    expect(d.de('BR')).toEqual({ tipo: 'nao_medido', motivo: 'base_nao_medida', desde: null })
    expect(d.de('BR').tipo).not.toBe('zero_medido')
  })
  it('base não medida com linha gravada continua não medido (a linha existe, a referência não)', () => {
    const d = estadoDoDia({ ...base, baseMedida: false, base: null, linhas: [{ valor: 'BR', views: 5, minutos: 1 }] })
    expect(d.de('BR')).toMatchObject({ tipo: 'nao_medido', motivo: 'base_nao_medida' })
    expect(d.emRevisao).toBe(false)
  })
  it('linha com views nulas nunca afirma zero: o valor ausente fica "zero ou abaixo do limiar", sem omitido', () => {
    const d = estadoDoDia({ ...base, base: 5, linhas: [{ valor: 'BR', views: null, minutos: 2 }] })
    expect(d.de('US')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
    expect(d.omitido).toBeNull()
  })
})

describe('estadoDoDiaLido (o dia como o leitor entrega)', () => {
  it('equivale a estadoDoDia com os mesmos campos', () => {
    const dia = { dia: '2026-10-11', coberto: true, baseMedida: true, base: 3, antesDoInicio: false, desde: '2026-10-10', linhas: [{ valor: 'BR', views: 3, minutos: null }] }
    expect(estadoDoDiaLido(dia).de('BR')).toEqual({ tipo: 'valor', views: 3, minutos: null })
    expect(estadoDoDiaLido(dia).de('US')).toEqual({ tipo: 'zero_medido' })
  })
})

describe('taxaDeClique', () => {
  it('8 impressões e 1 clique = 0,125', () => expect(taxaDeClique(8, 1)).toBe(0.125))
  it('sem cliques = nula, não zero', () => expect(taxaDeClique(8, null)).toBeNull())
  it('sem impressões, ou impressões 0, = nula', () => {
    expect(taxaDeClique(null, 1)).toBeNull()
    expect(taxaDeClique(0, 0)).toBeNull()
  })
  it('zero clique medido com impressões = 0 (medido), diferente de nulo', () => expect(taxaDeClique(8, 0)).toBe(0))
})

describe('classificarConjunto: os seis estados são distintos', () => {
  const sem = { schemaAusente: false, passoDesligado: false, ultimaTentativa: null, temCobertura: false, temLinhas: false }
  const seis: Record<string, EstadoConjunto | EstadoValor> = {
    nao_coletado: classificarConjunto(sem),
    coleta_em_erro: classificarConjunto({ ...sem, ultimaTentativa: { outcome: 'erro_http' } }),
    passo_desligado: classificarConjunto({ ...sem, passoDesligado: true }),
    schema_ausente: classificarConjunto({ ...sem, schemaAusente: true }),
    zero_medido: estadoDoDia({ ...base, base: 0 }).de('BR'),
    nao_medido: estadoDoDia({ ...base, coberto: false }).de('BR'),
  }
  it('cada estado tem o seu tipo, e os seis tipos são diferentes entre si', () => {
    for (const [nome, e] of Object.entries(seis)) expect(e.tipo).toBe(nome)
    expect(new Set(Object.values(seis).map(e => e.tipo)).size).toBe(6)
  })
  it('tabela vazia sem cobertura = nao_coletado (não é zero)', () => {
    expect(classificarConjunto(sem)).toEqual({ tipo: 'nao_coletado' })
  })
  it('com cobertura, ainda que sem linha, = coletado (o zero vem do dia, não do conjunto)', () => {
    expect(classificarConjunto({ ...sem, temCobertura: true })).toEqual({ tipo: 'coletado' })
    expect(classificarConjunto({ ...sem, temLinhas: true })).toEqual({ tipo: 'coletado' })
  })
  it('precedência: schema ausente > passo desligado > erro > não coletado', () => {
    const tudo = { schemaAusente: true, passoDesligado: true, ultimaTentativa: { outcome: 'erro_http' }, temCobertura: false, temLinhas: false }
    expect(classificarConjunto(tudo).tipo).toBe('schema_ausente')
    expect(classificarConjunto({ ...tudo, schemaAusente: false }).tipo).toBe('passo_desligado')
    expect(classificarConjunto({ ...tudo, schemaAusente: false, passoDesligado: false }).tipo).toBe('coleta_em_erro')
  })
  it('desligado ou em erro com dado antigo diz que há dado (comDados), sem virar "coletado"', () => {
    expect(classificarConjunto({ ...sem, passoDesligado: true, temCobertura: true })).toEqual({ tipo: 'passo_desligado', comDados: true })
    expect(classificarConjunto({ ...sem, passoDesligado: true })).toEqual({ tipo: 'passo_desligado', comDados: false })
    expect(classificarConjunto({ ...sem, ultimaTentativa: { outcome: 'sem_conexao' }, temLinhas: true })).toEqual({ tipo: 'coleta_em_erro', outcome: 'sem_conexao', comDados: true })
  })
  it.each(['ok', 'sem_dado_na_janela', 'video_novo'])('tentativa %s não é erro', (outcome) => {
    expect(classificarConjunto({ ...sem, ultimaTentativa: { outcome }, temCobertura: true }).tipo).toBe('coletado')
  })
  it.each(['sem_conexao', 'sem_autorizacao', 'erro_http', 'nao_alcancado_orcamento', 'schema_ausente'])('tentativa %s é coleta em erro', (outcome) => {
    expect(classificarConjunto({ ...sem, ultimaTentativa: { outcome }, temCobertura: true })).toMatchObject({ tipo: 'coleta_em_erro', outcome })
  })
  it('tentativa com resultado fora do catálogo é erro, com o resultado "desconhecido" (o texto de fora não passa)', () => {
    expect(classificarConjunto({ ...sem, ultimaTentativa: { outcome: 'qualquer coisa de fora' } })).toEqual({ tipo: 'coleta_em_erro', outcome: 'desconhecido', comDados: false })
  })
})

describe('rotuloDoValor: código desconhecido aparece como desconhecido, nunca vazio', () => {
  it('origem catalogada, por nome da API e por código do lote', () => {
    expect(rotuloDoValor('trafego', 'YT_SEARCH')).toEqual({ rotulo: 'Pesquisa do YouTube', catalogado: true })
    expect(rotuloDoValor('detalhe', '5')).toEqual({ rotulo: 'Pesquisa do YouTube', catalogado: true })
  })
  it('origem desconhecida: rótulo visível de desconhecida, com o código', () => {
    const r = rotuloDoValor('trafego', 'NOVA_ORIGEM')
    expect(r.catalogado).toBe(false)
    expect(r.rotulo).toContain('NOVA_ORIGEM')
    expect(r.rotulo.toLowerCase()).toContain('desconhecid')
    const n = rotuloDoValor('alcance_dim', '999|104|4')
    expect(n.rotulo.toLowerCase()).toContain('desconhecid')
    expect(n.catalogado).toBe(false)
  })
  it('aparelho e sistema (par MOBILE|ANDROID) e par com sistema desconhecido', () => {
    expect(rotuloDoValor('dispositivo', 'MOBILE|ANDROID')).toEqual({ rotulo: 'Celular · Android', catalogado: true })
    const r = rotuloDoValor('dispositivo', 'HOLOGRAMA|ANDROID')
    expect(r.catalogado).toBe(false)
    expect(r.rotulo).toContain('HOLOGRAMA')
    expect(r.rotulo.toLowerCase()).toContain('desconhecid')
  })
  it('alcance por dimensão: origem|aparelho|sistema do lote', () => {
    expect(rotuloDoValor('alcance_dim', '5|104|4')).toEqual({ rotulo: 'Pesquisa do YouTube · Celular · Android', catalogado: true })
  })
  it('país e inscrito; valor vazio tem rótulo próprio', () => {
    expect(rotuloDoValor('pais', 'BR')).toEqual({ rotulo: 'BR', catalogado: true })
    expect(rotuloDoValor('pais', 'ZZ').rotulo.toLowerCase()).toContain('desconhecid')
    expect(rotuloDoValor('inscrito', 'SUBSCRIBED')).toEqual({ rotulo: 'Inscritos', catalogado: true })
    expect(rotuloDoValor('inscrito', 'OUTRA').catalogado).toBe(false)
    expect(rotuloDoValor('trafego', '').rotulo).not.toBe('')
  })
})
