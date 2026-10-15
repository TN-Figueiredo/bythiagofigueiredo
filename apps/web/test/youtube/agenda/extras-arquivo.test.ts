// @vitest-environment node
/**
 * A5 · E10, Tarefa 9: `extrasDoDisparo` e `juntarVermelho` (puros). O sinal é montado com o `sinalDoBanco` de verdade a partir de linhas
 * sintéticas; nada aqui lê banco, relógio nem rede.
 */
import { describe, it, expect } from 'vitest'
import { extrasDoDisparo, juntarVermelho, FRASE_SINAL_NAO_LIDO, type EntradaExtras } from '@/lib/youtube/agenda/extras-arquivo'
import type { BatchRow } from '@/lib/youtube/competitor-sync-batch'
import type { PendenciasDoArquivo } from '@/lib/youtube/observatorio/arquivo/ler-pendencias'
import type { SinalLido } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { fraseDeNuncaMedido, sinalDoBanco, type LinhaBruta } from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'
import { RULES } from '@/lib/youtube/observatorio/rules'

const MB = 1_048_576
const H = 3_600_000
/** 12:00 em São Paulo; o dia de leitura é 13/10. */
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const dia = (offset: number): string => new Date(Date.UTC(2026, 9, 13 + offset)).toISOString().slice(0, 10)
const linha = (offset: number, dbMb: number, medidoEm?: string): LinhaBruta => ({
  day: dia(offset), db_bytes: Math.round(dbMb * MB), competitor_bytes: Math.round(dbMb * 0.2 * MB), own_bytes: Math.round(dbMb * 0.1 * MB),
  measured_at: medidoEm ?? `${dia(offset)}T08:10:00.000Z`,
})
const sinalDe = (linhas: LinhaBruta[]): SinalLido => ({ valor: sinalDoBanco(linhas, AGORA) })
const verde = (): SinalLido => sinalDe([linha(0, 100)])
const amarelo = (): SinalLido => sinalDe([linha(0, 360)])
const vermelho = (): SinalLido => sinalDe([linha(0, 440)])

const canal = (id: string, o: Partial<BatchRow> = {}): BatchRow => ({
  id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, site_id: 's1', last_synced_at: null, last_ok_synced_at: null, sync_status: null,
  sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, collection_paused_at: null, ...o,
})
const SEM_PENDENCIA: PendenciasDoArquivo = { semExport: { valor: [] }, miniaturas: { valor: { urls: 0, lotes: 0, diasDaMaisAntiga: null } } }
const entrada = (o: Partial<EntradaExtras> = {}): EntradaExtras => ({
  todas: [canal('a')], sinal: verde(), agoraMs: AGORA, agendaDesde: new Date(AGORA - 5 * H).toISOString(), pendencias: SEM_PENDENCIA, tamanhoOkHa36h: true, ...o,
})
const sinalLido = (s: SinalLido) => ('valor' in s ? s.valor : null)!

describe('extrasDoDisparo: o sinal', () => {
  it('verde, sem pausa, sem ilegíveis: nada em acao, problemas nem avisos; banco com estado e cor', () => {
    const x = extrasDoDisparo(entrada())
    expect(x).toMatchObject({ acao: [], problemas: [], avisos: [], notas: [] })
    expect(x.banco).toMatchObject({ estado: 'medido', cor: 'verde', ilegiveis: 0 })
  })
  it('verde com medidas ilegíveis: uma linha em acao com a contagem (mutação: não ler sinal.ilegiveis)', () => {
    const ruim: LinhaBruta = { day: dia(-1), db_bytes: -5, competitor_bytes: 0, own_bytes: 0, measured_at: `${dia(-1)}T08:10:00.000Z` }
    const mais = (n: number) => Array.from({ length: n }, (_, i) => ({ ...ruim, day: dia(-1 - i) }))
    const x = extrasDoDisparo(entrada({ sinal: sinalDe([linha(0, 100), ...mais(3)]) }))
    expect(x.acao).toHaveLength(1)
    expect(x.acao[0]).toContain('3 medida(s) ilegível(is)')
    expect(x.acao[0]).not.toMatch(/MB|lote/)
    expect(x).toMatchObject({ problemas: [], avisos: [] })
    expect(x.banco).toMatchObject({ ilegiveis: 3 })
  })
  it('amarelo com 1 ilegível: a frase do amarelo e a das ilegíveis; sem leitura hoje com 1 ilegível: duas; sem agenda, verde com 2: uma', () => {
    const ruim = (d: number): LinhaBruta => ({ day: dia(d), db_bytes: -5, competitor_bytes: 0, own_bytes: 0, measured_at: `${dia(d)}T08:10:00.000Z` })
    const a = extrasDoDisparo(entrada({ sinal: sinalDe([linha(0, 360), ruim(-1)]) }))
    expect(a.acao).toHaveLength(2)
    expect(a.acao[1]).toContain('1 medida(s) ilegível(is)')
    const s = extrasDoDisparo(entrada({ sinal: sinalDe([linha(-1, 100), ruim(-2)]) }))
    expect(s.acao).toHaveLength(2)
    const sem = extrasDoDisparo(entrada({ todas: null, agendaDesde: null, tamanhoOkHa36h: null, sinal: sinalDe([linha(0, 100), ruim(-1), ruim(-2)]) }))
    expect(sem.acao).toHaveLength(1)
    expect(sem.acao[0]).toContain('2 medida(s)')
  })
  it('todas as linhas ilegíveis (I-1 N9): agenda há 73 h vai a problemas, uma linha só em acao; há 10 h não vai', () => {
    const ruim = (d: number): LinhaBruta => ({ day: dia(d), db_bytes: -5, competitor_bytes: 0, own_bytes: 0, measured_at: `${dia(d)}T08:10:00.000Z` })
    const tudo = Array.from({ length: 29 }, (_, i) => ruim(-i - 1))
    const longa = extrasDoDisparo(entrada({ sinal: sinalDe(tudo), agendaDesde: new Date(AGORA - 73 * H).toISOString() }))
    const frase = sinalLido(sinalDe(tudo)).frase
    expect(longa.problemas).toEqual([frase])
    expect(longa.acao).toEqual([frase])
    const curta = extrasDoDisparo(entrada({ sinal: sinalDe(tudo), agendaDesde: new Date(AGORA - 10 * H).toISOString() }))
    expect(curta.problemas).toEqual([])
    expect(curta.acao).toEqual([frase])
  })
  it('amarelo: uma linha em acao e um aviso por site com periodo mes; vermelho: periodo semana; nunca problema (P2)', () => {
    const duasSites = [canal('a'), canal('b', { site_id: 's2' }), canal('c')]
    const a = extrasDoDisparo(entrada({ sinal: amarelo(), todas: duasSites }))
    expect(a.acao).toEqual([sinalLido(amarelo()).frase])
    expect(a.avisos).toEqual([
      { siteId: 's1', chave: 'banco_no_limite', tarefa: 'tamanho do banco', frase: sinalLido(amarelo()).frase, periodo: 'mes' },
      { siteId: 's2', chave: 'banco_no_limite', tarefa: 'tamanho do banco', frase: sinalLido(amarelo()).frase, periodo: 'mes' },
    ])
    expect(a.problemas).toEqual([])
    const v = extrasDoDisparo(entrada({ sinal: vermelho() }))
    expect(v.avisos).toHaveLength(1)
    expect(v.avisos[0]).toMatchObject({ chave: 'banco_no_limite', periodo: 'semana' })
    expect(v.problemas).toEqual([])
  })
  it('sem leitura há 10 h e há 73 h: linha em acao nas duas; problema só na segunda', () => {
    const com = (h: number) => extrasDoDisparo(entrada({ sinal: sinalDe([linha(-1, 100, new Date(AGORA - h * H).toISOString())]) }))
    const x10 = com(10)
    expect(x10.acao).toHaveLength(1)
    expect(x10.problemas).toEqual([])
    const x73 = com(73)
    expect(x73.acao).toHaveLength(1)
    expect(x73.problemas).toHaveLength(1)
    expect(x73.problemas[0]).toBe(x73.acao[0])
  })
  it('nunca medido com a agenda de 1 h e de 80 h; a promessa da data só com a medida agendada (mutação: passar true fixo)', () => {
    const nunca = (): SinalLido => ({ valor: sinalDoBanco([], AGORA) })
    const dd = sinalLido(nunca()).diaDeLeitura
    const curta = extrasDoDisparo(entrada({ sinal: nunca(), agendaDesde: new Date(AGORA - H).toISOString() }))
    expect(curta.problemas).toEqual([])
    expect(curta.acao).toEqual([fraseDeNuncaMedido(dd, true)])
    expect(curta.acao[0]).toContain('A primeira leitura é em')
    const longa = extrasDoDisparo(entrada({ sinal: nunca(), agendaDesde: new Date(AGORA - 80 * H).toISOString() }))
    expect(longa.problemas).toHaveLength(1)
    expect(longa.acao[0]).toBe(`${fraseDeNuncaMedido(dd, false)} A agenda roda há mais de ${RULES.dbSize.unmeasuredRedHours} h e a medida não veio.`)
    expect(longa.acao[0]).not.toContain('primeira leitura')
  })
  it('nunca medido sem agenda não promete a primeira leitura e não é vermelho', () => {
    const x = extrasDoDisparo(entrada({ todas: null, agendaDesde: null, tamanhoOkHa36h: null, sinal: { valor: sinalDoBanco([], AGORA) } }))
    expect(x.acao).toEqual(['Ainda sem medida do tamanho do banco do site. A agenda está desligada: a medida das 05:00 não roda.'])
    expect(x.acao[0]).not.toContain('primeira leitura')
    expect(x.problemas).toEqual([])
  })
  it('nunca medido com a tarefa desligada na agenda ligada: sem data prometida e sem vermelho', () => {
    const x = extrasDoDisparo(entrada({ sinal: { valor: sinalDoBanco([], AGORA) }, tamanhoDesligada: true }))
    expect(x.acao[0]).not.toContain('primeira leitura')
    expect(x.problemas).toEqual([])
  })
  it('sinal não lido por prazo: nota, banco.nao_lido e nenhuma cor nem a palavra verde', () => {
    const x = extrasDoDisparo(entrada({ sinal: { porque: 'prazo' }, tamanhoOkHa36h: false }))
    expect(x.notas).toContain(FRASE_SINAL_NAO_LIDO)
    expect(x.banco).toEqual({ nao_lido: 'prazo' })
    expect(x.problemas).toEqual([])
    expect(JSON.stringify(x)).not.toMatch(/verde|amarelo|vermelho/)
  })
  it.each([['forma_invalida', true], ['schema_ausente', true], ['erro_do_banco', false], ['excecao', false]] as const)(
    'sinal não lido, causa %s: problema = %s (mutação: trocar problemas por notas)', (causa, esperaProblema) => {
      const x = extrasDoDisparo(entrada({ sinal: { porque: causa }, tamanhoOkHa36h: false }))
      expect(x.problemas.length > 0).toBe(esperaProblema)
      expect(x.notas).toContain(FRASE_SINAL_NAO_LIDO)
    },
  )
  it('leitura transitória falhando: acao só com a medida em dia nas últimas 36 h', () => {
    const com = (ok: boolean | null) => extrasDoDisparo(entrada({ sinal: { porque: 'erro_do_banco' }, tamanhoOkHa36h: ok })).acao
    expect(com(true)).toEqual([FRASE_SINAL_NAO_LIDO])
    expect(com(false)).toEqual([])
    expect(com(null)).toEqual([])
  })
  it('sem agenda: sinal não lido por qualquer causa vai também para acao (mutação: tirar a linha)', () => {
    for (const causa of ['prazo', 'erro_do_banco', 'excecao'] as const) {
      const x = extrasDoDisparo(entrada({ todas: null, agendaDesde: null, tamanhoOkHa36h: null, sinal: { porque: causa } }))
      expect(x.notas, causa).toContain(FRASE_SINAL_NAO_LIDO)
      expect(x.acao, causa).toEqual([FRASE_SINAL_NAO_LIDO])
    }
    // com agenda e tamanhoOkHa36h falso, só a nota
    expect(extrasDoDisparo(entrada({ sinal: { porque: 'prazo' }, tamanhoOkHa36h: false })).acao).toEqual([])
  })
})

describe('extrasDoDisparo: as pendências do arquivo', () => {
  it('tabela sem export: uma linha em acao com o nome; problemas vazio', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { ...SEM_PENDENCIA, semExport: { valor: ['competitor_x'] } } }))
    expect(x.acao).toEqual(['arquivo: 1 tabela(s) sem export: competitor_x'])
    expect(x.problemas).toEqual([])
  })
  it('miniaturas pendentes há 2 dias não geram linha; há 3 dias geram, com a contagem e o ritmo (450 → faltam 3; 200 → falta 1)', () => {
    const com = (urls: number, dias: number) => extrasDoDisparo(entrada({ pendencias: { ...SEM_PENDENCIA, miniaturas: { valor: { urls, lotes: 1, diasDaMaisAntiga: dias } } } })).acao
    expect(com(450, 2)).toEqual([])
    const tres = com(450, 3)
    expect(tres).toHaveLength(1)
    expect(tres[0]).toContain('450 miniatura(s) de canal removido ainda públicas há 3 dias')
    expect(tres[0]).toContain('faltam 3 dia(s)')
    expect(com(200, 3)[0]).toContain('falta 1')
  })
  it('pendências não lidas: nota, e nenhuma linha "nenhuma pendência"', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { porque: 'prazo' } }))
    expect(x.notas).toContain('arquivo: não foi possível ler as pendências')
    expect(x.acao).toEqual([])
    expect(x.problemas).toEqual([]) // causa transitória não deixa o cron vermelho
    const y = extrasDoDisparo(entrada({ pendencias: { semExport: { porque: 'erro_do_banco' }, miniaturas: { valor: { urls: 0, lotes: 0, diasDaMaisAntiga: null } } } }))
    expect(y.notas).toContain('arquivo: não foi possível ler as pendências')
  })
})

describe('extrasDoDisparo: pendências ilegíveis por causa permanente (uma causa por teste)', () => {
  const OK = { valor: { urls: 0, lotes: 0, diasDaMaisAntiga: null } }
  it('tabelas sem export: schema_ausente vai para o vermelho', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { semExport: { porque: 'schema_ausente' }, miniaturas: OK } }))
    expect(x.problemas).toEqual(['arquivo: não foi possível ler as pendências'])
  })
  it('tabelas sem export: forma_invalida vai para o vermelho', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { semExport: { porque: 'forma_invalida' }, miniaturas: OK } }))
    expect(x.problemas).toHaveLength(1)
  })
  it('miniaturas: forma_invalida vai para o vermelho, uma vez só', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { semExport: { porque: 'schema_ausente' }, miniaturas: { porque: 'forma_invalida' } } }))
    expect(x.problemas).toHaveLength(1)
  })
  it('miniaturas: excecao (transitória) fica só na nota', () => {
    const x = extrasDoDisparo(entrada({ pendencias: { semExport: { valor: [] }, miniaturas: { porque: 'excecao' } } }))
    expect(x.problemas).toEqual([])
    expect(x.notas).toContain('arquivo: não foi possível ler as pendências')
  })
})

describe('extrasDoDisparo: a pausa', () => {
  const DIA = 86_400_000
  it('pausado há 8 dias: acao com o nome e aviso coleta_pausada_esquecida com periodo semana; a nota conta os pausados', () => {
    const x = extrasDoDisparo(entrada({ todas: [canal('a'), canal('b', { collection_paused_at: new Date(AGORA - 8 * DIA).toISOString() })] }))
    expect(x.acao).toHaveLength(1)
    expect(x.acao[0]).toContain('Canal b')
    expect(x.notas).toContain('1 canal com a coleta pausada')
    expect(x.avisos).toEqual([expect.objectContaining({ siteId: 's1', chave: 'coleta_pausada_esquecida', periodo: 'semana' })])
  })
  it('dois canais esquecidos no mesmo site: UM aviso com os dois nomes; um ilegível também entra', () => {
    const x = extrasDoDisparo(entrada({ todas: [
      canal('a', { collection_paused_at: new Date(AGORA - 9 * DIA).toISOString(), channel_name: 'Alfa' }),
      canal('b', { collection_paused_at: new Date(AGORA - 12 * DIA).toISOString(), channel_name: 'Beta' }),
      canal('c', { collection_paused_at: 'isso-nao-e-data', channel_name: 'Gama' }),
    ] }))
    expect(x.avisos).toHaveLength(1)
    expect(x.avisos[0]).toMatchObject({ siteId: 's1', chave: 'coleta_pausada_esquecida', periodo: 'semana' })
    expect(x.avisos[0]!.frase).toContain('3 canais')
    expect(x.avisos[0]!.frase).toContain('Alfa (9 dias)')
    expect(x.avisos[0]!.frase).toContain('Beta (12 dias)')
    expect(x.avisos[0]!.frase).toContain('Gama (tempo desconhecido)')
  })
  it('um canal ilegível sozinho gera aviso; sites diferentes geram um aviso cada', () => {
    const a = extrasDoDisparo(entrada({ todas: [canal('c', { collection_paused_at: 'lixo', channel_name: 'Gama' })] }))
    expect(a.avisos).toHaveLength(1)
    expect(a.avisos[0]!.frase).toContain('tempo desconhecido')
    const b = extrasDoDisparo(entrada({ todas: [
      canal('a', { site_id: 's1', collection_paused_at: new Date(AGORA - 9 * DIA).toISOString() }),
      canal('b', { site_id: 's2', collection_paused_at: new Date(AGORA - 9 * DIA).toISOString() }),
    ] }))
    expect(b.avisos.map(v => v.siteId).sort()).toEqual(['s1', 's2'])
  })
  it('canais não lidos (todas nulo): sem linha de pausa e sem aviso; a linha do banco continua', () => {
    const x = extrasDoDisparo(entrada({ todas: null, sinal: amarelo() }))
    expect(x.avisos).toEqual([])
    expect(x.acao).toEqual([sinalLido(amarelo()).frase])
  })
})

describe('juntarVermelho', () => {
  it('sem problema nenhum devolve o veredito como veio', () => {
    expect(juntarVermelho({ vermelho: false, mensagem: null }, [], 480)).toEqual({ vermelho: false, mensagem: null })
    expect(juntarVermelho({ vermelho: true, mensagem: 'x' }, [], 480)).toEqual({ vermelho: true, mensagem: 'x' })
  })
  it('verde com um problema vira vermelho com a frase', () => {
    expect(juntarVermelho({ vermelho: false, mensagem: null }, ['banco: não foi possível ler o tamanho'], 480)).toEqual({ vermelho: true, mensagem: 'banco: não foi possível ler o tamanho' })
  })
  it('junta com " | " quando cabe', () => {
    expect(juntarVermelho({ vermelho: true, mensagem: 'a' }, ['b'], 480)).toEqual({ vermelho: true, mensagem: 'a | b' })
  })
  it('corta sem partir frase: 470 caracteres mais um problema de 40 termina em "e mais 1 aviso" e nunca passa de 480', () => {
    const r = juntarVermelho({ vermelho: true, mensagem: 'x'.repeat(470) }, ['y'.repeat(40)], 480)
    expect(r.vermelho).toBe(true)
    expect(r.mensagem!.length).toBeLessThanOrEqual(480)
    expect(r.mensagem!.endsWith('e mais 1 aviso')).toBe(true)
  })
  it('com várias frases na mensagem, corta frase inteira do fim e conta cada uma no "e mais N avisos"', () => {
    const base = Array.from({ length: 8 }, (_, i) => `frase ${i} ` + 'z'.repeat(50)).join(' | ')
    const r = juntarVermelho({ vermelho: true, mensagem: base }, ['p'.repeat(60), 'q'.repeat(60)], 480)
    expect(r.mensagem!.length).toBeLessThanOrEqual(480)
    expect(r.mensagem).toMatch(/ \| e mais \d+ avisos$/)
    expect(r.mensagem).not.toMatch(/z \|$/)
  })
})
