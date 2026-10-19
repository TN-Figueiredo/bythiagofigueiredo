// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  MOTIVO, TXT, opcaoApagar, nomeConfere, botaoPrincipal, idadeDoAgendado, pedidoAoAgente, fraseDoErro, codigoPassageiro,
  desfeitoCorpo, toastApagadoCorpo, normalizarNome, type Fase,
} from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'

describe('opcaoApagar (M3.1)', () => {
  it('sem contagem ou com a contagem falhada: precisa da contagem', () => {
    const f = 'Precisa da contagem para apagar sem guardar.'
    expect(opcaoApagar({ fase: 'falha_contagem', semGuardar: { pode: true } })).toEqual({ ativa: false, porque: f })
    expect(opcaoApagar({ fase: 'contando', semGuardar: null })).toEqual({ ativa: false, porque: f })
  })
  it('antigo diz os meses (1 mês no singular)', () => {
    expect(opcaoApagar({ fase: 'pronto', semGuardar: { pode: false, porque: 'antigo', meses: 7 } })).toEqual({ ativa: false, porque: 'Este canal tem 7 meses de histórico. Para não perder tudo por engano, use "Guardar no NAS".' })
    expect(opcaoApagar({ fase: 'pronto', semGuardar: { pode: false, porque: 'antigo', meses: 1 } })).toMatchObject({ porque: expect.stringContaining('1 mês de histórico') })
  })
  it('sem data e liberado', () => {
    expect(opcaoApagar({ fase: 'pronto', semGuardar: { pode: false, porque: 'sem_data' } })).toEqual({ ativa: false, porque: 'Não sabemos quando este canal foi adicionado. Para não perder nada por engano, use "Guardar no NAS".' })
    expect(opcaoApagar({ fase: 'pronto', semGuardar: { pode: true } })).toEqual({ ativa: true })
  })
})

describe('botaoPrincipal (M3.2)', () => {
  const fases: Fase[] = ['contando', 'pronto', 'falha_contagem', 'enviando', 'incerto', 'erro']
  it('guardar fica desabilitado só em contando e enviando', () => {
    for (const fase of fases) {
      expect(botaoPrincipal({ caminho: 'guardar', fase, nomeOk: false }).desabilitado).toBe(fase === 'contando' || fase === 'enviando')
    }
    expect(botaoPrincipal({ caminho: 'guardar', fase: 'falha_contagem', nomeOk: false }).desabilitado).toBe(false)
  })
  it('rótulos e ocupado', () => {
    expect(botaoPrincipal({ caminho: 'guardar', fase: 'pronto', nomeOk: false })).toEqual({ rotulo: 'Parar coleta e agendar guarda no NAS', desabilitado: false, ocupado: false })
    expect(botaoPrincipal({ caminho: 'guardar', fase: 'enviando', nomeOk: false })).toEqual({ rotulo: 'Parando a coleta…', desabilitado: true, ocupado: true })
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'enviando', nomeOk: true })).toEqual({ rotulo: 'Apagando…', desabilitado: true, ocupado: true })
  })
  it('apagar exige o nome e a contagem', () => {
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'pronto', nomeOk: true }).desabilitado).toBe(false)
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'pronto', nomeOk: false }).desabilitado).toBe(true)
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'falha_contagem', nomeOk: true }).desabilitado).toBe(true)
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'contando', nomeOk: true }).desabilitado).toBe(true)
    expect(botaoPrincipal({ caminho: 'apagar', fase: 'pronto', nomeOk: true }).rotulo).toBe('Apagar sem guardar')
  })
})

describe('MOTIVO (M3.3)', () => {
  it('casa com a forma da F1', () => {
    for (const m of Object.values(MOTIVO)) expect(m).toMatch(/^[a-z_]{1,40}$/)
  })
})

/** Tabela única de paridade com `obs_nome_normalizado` do banco. */
export const CASOS_NOME: Array<[string, string, boolean]> = [
  ['  Ryan Otis ', 'Ryan Otis', true],
  ['Ryan Otis\u00a0', 'Ryan Otis', true],
  ['Ryan\u00a0Otis', 'Ryan Otis', true],
  ['\tRyan Otis', 'Ryan Otis', true],
  ['ryan otis', 'Ryan Otis', true],
  ['RYAN OTIS', 'Ryan Otis', true],
  ['Ryan  Otis', 'Ryan Otis', true],
  ['\ufeffRyan Otis', 'Ryan Otis', true],
  ['ÉDEN', 'Éden', true],
  ['SÃO', 'são', true],
  ['Eden', 'Éden', false],
  ['Sao', 'São', false],
  ['ryan otic', 'Ryan Otis', false],
  ['', '', false],
  ['   ', '', false],
]
describe('nomeConfere (M3.4, paridade com o banco)', () => {
  it.each(CASOS_NOME)('%j x %j = %s', (d, n, esperado) => {
    expect(nomeConfere(d, n)).toBe(esperado)
  })
  it('a normalização é a do banco: espaços Unicode viram um, pontas saem, caixa baixa', () => {
    expect(normalizarNome('\u2003A\u3000 B\u00a0')).toBe('a b')
  })
})

describe('idadeDoAgendado (M3.5)', () => {
  const AGO = Date.parse('2026-10-19T12:00:00Z'), H = 3_600_000
  const desde = (ms: number) => new Date(AGO - ms).toISOString()
  it('conta por horas decorridas', () => {
    expect(idadeDoAgendado(desde(0), AGO)).toBe('agendado hoje')
    expect(idadeDoAgendado(desde(24 * H - 60_000), AGO)).toBe('agendado hoje')
    expect(idadeDoAgendado(desde(24 * H), AGO)).toBe('agendado há 1 dia')
    expect(idadeDoAgendado(desde(48 * H - 60_000), AGO)).toBe('agendado há 1 dia')
    expect(idadeDoAgendado(desde(48 * H), AGO)).toBe('agendado há 2 dias')
    expect(idadeDoAgendado(desde(40 * 24 * H), AGO)).toBe('agendado há 40 dias')
  })
  it('relógio torto (desde no futuro) = hoje', () => {
    expect(idadeDoAgendado(desde(-5 * H), AGO)).toBe('agendado hoje')
  })
})

describe('pedidoAoAgente (M3.6)', () => {
  it('texto exato', () => {
    expect(pedidoAoAgente('Ryan Otis', 'a@b.co')).toBe(
      'Peço que rode, no repositório bythiagofigueiredo:\n`npx tsx scripts/obs-arquivo.ts pedidos --por a@b.co`\nEle leva a remoção de Ryan Otis ao próximo passo (exportar, conferir, copiar para o NAS e remover). Avise quando Ryan Otis sair da lista de Canais (a lista pode levar até 15 minutos para atualizar).',
    )
  })
  it('sem e-mail', () => {
    expect(pedidoAoAgente('X', null)).toContain('--por <seu e-mail>')
  })
})

describe('frases (M3.7, M3.8)', () => {
  it('erro permanente do apagar mostra a frase recebida', () => {
    expect(fraseDoErro('video_compartilhado', 'F')).toEqual({ titulo: 'Nada foi apagado.', corpo: 'F' })
  })
  it('sem resposta: as duas variantes, sem "Nada mudou" nem "Apagado"', () => {
    const a = fraseDoErro('sem-resposta'), b = fraseDoErro('sem-resposta', undefined, 'guardar')
    expect(a).toEqual({ titulo: TXT.incertoTitulo, corpo: TXT.incertoApagarCorpo })
    expect(b).toEqual({ titulo: TXT.incertoTitulo, corpo: TXT.incertoGuardarCorpo })
    expect(b.corpo).toContain('Agendado para guardar no NAS')
    for (const x of [a, b]) expect(x.titulo + x.corpo).not.toMatch(/Nada mudou|Apagado/)
  })
  it('erro do guardar: passageiro vs permanente', () => {
    expect(fraseDoErro('leitura', 'F', 'guardar')).toEqual({ titulo: TXT.erroGuardarTitulo, corpo: TXT.erroGuardarCorpo })
    expect(fraseDoErro('sem_direito', 'F', 'guardar')).toEqual({ titulo: TXT.erroGuardarTitulo, corpo: 'Nada mudou. F' })
  })
  it('codigoPassageiro', () => {
    for (const c of ['leitura', 'inesperado', 'demorou_demais'] as const) expect(codigoPassageiro(c)).toBe(true)
    for (const c of ['sem_direito', 'saiu_do_youtube', 'itens_na_fila', 'canal_nao_encontrado'] as const) expect(codigoPassageiro(c)).toBe(false)
  })
  it('desfeitoCorpo (U3)', () => {
    expect(desfeitoCorpo('X', true)).toBe('A coleta de X foi retomada e a remoção foi cancelada.')
    expect(desfeitoCorpo('X', false)).toBe('A remoção de X foi cancelada. O canal continua pausado, como estava antes.')
  })
  it('toastApagadoCorpo usa todos os números e omite o que faltou', () => {
    const c = toastApagadoCorpo('Ryan', { videos: 340, dias: 12, leituras: 48 })
    expect(c).toContain('48 leituras')
    expect(c).toContain('12 dias de registros')
    expect(c).toBe('Ryan saiu, sem cópia: 340 vídeos, 12 dias de registros e 48 leituras. A vaga foi liberada. A ação foi registrada.')
    const so = toastApagadoCorpo('Ryan', { videos: 340 })
    expect(so).toBe('Ryan saiu, sem cópia: 340 vídeos. A vaga foi liberada. A ação foi registrada.')
    expect(so).not.toMatch(/\b0\b/)
  })
  it('nenhuma frase fixa diz lote, MB ou runbook (Logan R3)', () => {
    const todas = Object.values(TXT).map(v => (typeof v === 'function' ? (v as (...a: never[]) => string)(...([3, 2] as never[])) : v))
    for (const t of todas) expect(t).not.toMatch(/\blotes?\b|\bMB\b|runbook/i)
  })
})
