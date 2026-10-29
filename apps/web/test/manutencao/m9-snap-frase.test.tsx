// @vitest-environment jsdom
// M9-snap (D-M9-9b), sub-tarefa 9b-T: a frase que diz por que um item espera os snapshots do NAS (peça 7). Texto e estado, sem layout novo.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { scriptDasPendencias } from '@/lib/youtube/observatorio/arquivo/pendencias-script'
import { lerPendencias, fraseSnapBloqueado, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const LIDO = new Date('2026-12-01T12:00:00Z')
const it1 = (o: Record<string, unknown>) => ({ item_id: 'canal:x', kind: 'canal', tempo: 'sem_comando' as const, falta: 'snapshots' as const, idadeDias: 3, titulo: 'Nômade Raiz' as string | null,
  desde: new Date('2026-11-28T12:00:00Z'), codigo: 'abc' as string | null, snapEsperaDias: null as number | null, snapLiberaEm: null as Date | null, snapLiberaHoje: false, snapBloqueio: null as string | null, ...o })
const tela = (i: ReturnType<typeof it1>): PendenciasDaTela => ({ estado: 'com_itens', lidoEm: LIDO, n: 1, maisAntigoDias: i.idadeDias, itens: [i] as never, linha: null })
const LIBERA = new Date('2026-12-06T20:00:00Z')
const DESDE = new Date('2026-11-22T12:00:00Z')

describe('9b-T: frase (a), a espera que termina sozinha', () => {
  it('com data: "desde DD/MM", sujeito do "libera", "Nada a fazer até lá", sem "sem ação sua"', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDias: 9, snapEsperaDesde: DESDE, snapLiberaEm: LIBERA }))} />)
    expect(screen.getByText('Aguardando os snapshots do NAS desde 22/11; o comando libera por volta de 06/12. Nada a fazer até lá.')).toBeTruthy()
    expect(screen.queryByText(/sem ação sua/)).toBeNull()
    expect(document.querySelector('[data-snap="espera"]')).not.toBeNull()
  })
  it('a ordem: a situação do cartão vem antes da frase, e o ícone do bloqueio tem o texto "Atenção:"', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDesde: DESDE, snapBloqueio: 'relogio' }))} />)
    expect(document.querySelector('[data-snap]')?.textContent).toMatch(/^Atenção:/)
  })
  it('data passada há menos de 24 h: "deve liberar na próxima verificação", nunca "libera hoje" nem a data', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDesde: DESDE, snapLiberaEm: new Date('2026-12-01T00:00:00Z'), snapLiberaHoje: true }))} />)
    expect(screen.getByText('Aguardando os snapshots do NAS desde 22/11; deve liberar na próxima verificação da forja. Nada a fazer até lá.')).toBeTruthy()
    expect(screen.queryByText(/libera hoje/)).toBeNull()
  })
  it('data passada há mais de 24 h: âmbar "prazo passou, aguarda a próxima conferência"', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDesde: DESDE, snapLiberaEm: new Date('2026-11-27T20:00:00Z'), snapLiberaHoje: true, snapLiberaAtrasada: true }))} />)
    expect(screen.getByText(/^Atenção: o prazo dos snapshots do NAS \(27\/11\) passou; aguarda a próxima conferência da forja\./)).toBeTruthy()
    expect(document.querySelector('[data-snap="bloqueado"]')).not.toBeNull()
    expect(screen.queryByText(/libera hoje/)).toBeNull()
  })
  it('ilegivel isolado: espera neutra, sem âmbar, diz que a próxima rodada tenta de novo', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDesde: DESDE, snapLiberaEm: LIBERA, snapBloqueio: 'ilegivel' }))} />)
    expect(screen.getByText(/a última leitura da lista falhou e a próxima rodada tenta de novo\. Nada a fazer até lá\./)).toBeTruthy()
    expect(document.querySelector('[data-snap="bloqueado"]')).toBeNull()
    expect(document.querySelector('[data-snap="espera"]')).not.toBeNull()
  })
})
describe('9b-T: frase (b), âmbar, com a ação', () => {
  it.each([['fora_do_padrao', 'há um snapshot manual ou de outra tarefa', 'decida se apaga esse snapshot'],
    ['retido', 'um snapshot de antes da remoção não expira (bloqueio ou retenção maior que 14 dias)', 'procure e retire o bloqueio ou a retenção'],
    ['lista_vazia', 'a forja não vê nenhum snapshot', 'confira a tarefa de snapshot no NAS'],
    ['mtime_diverge', 'a data gravada nos snapshots não bate com o nome deles', 'confira os snapshots no NAS'],
    ['relogio', 'o relógio da forja ou do NAS está errado', 'confira a hora da forja e a do NAS']])('%s', (b, motivo, acao) => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDesde: DESDE, snapLiberaEm: LIBERA, snapBloqueio: b }))} />)
    expect(screen.getByText(`Atenção: os snapshots do NAS não liberam sozinhos: ${motivo}. O que fazer: ${acao}. Detalhe: runbook, seção Snapshots por tempo.`)).toBeTruthy()
    expect(screen.queryByText(/hold|mtime|Tarefa 14/)).toBeNull()
    expect(screen.queryByText(/libera por volta/)).toBeNull()
    expect(document.querySelector('[data-snap="bloqueado"]')).not.toBeNull()
  })
  it('relogio e mtime_diverge têm frases distintas', () => {
    expect(fraseSnapBloqueado('relogio')).not.toBe(fraseSnapBloqueado('mtime_diverge'))
  })
  it('bloqueio sem snap_espera_desde continua visível (Logan I4)', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDias: null, snapBloqueio: 'fora_do_padrao' }))} />)
    expect(document.querySelector('[data-snap="bloqueado"]')).not.toBeNull()
  })
})
describe('9b-T: sem os dados da espera', () => {
  it('banco sem a migration: só "Aguardando os snapshots do NAS." (sem data inventada)', () => {
    render(<EsperamComandos t={tela(it1({}))} />)
    expect(screen.getByText('Aguardando os snapshots do NAS.')).toBeTruthy()
  })
  it('falta diferente de snapshots', () => {
    render(<EsperamComandos t={tela(it1({ falta: 'resumo', snapEsperaDesde: DESDE, snapLiberaEm: LIBERA }))} />)
    expect(document.querySelector('[data-snap]')).toBeNull()
  })
})

describe('9b-T: o script do Mac diz as mesmas frases', () => {
  const lido = (extra: Record<string, unknown>) => {
    const l = lerPendencias({ versao: 2, lido_em: '2026-12-01T12:00:00Z', total: 1, itens: [{ item_id: 'canal:6f1c1b9e-0000-4000-8000-000000000001', kind: 'canal', tempo: 'sem_comando', falta: 'snapshots',
      desde: '2026-11-28T12:00:00Z', mes: null, channel_ref: '6f1c1b9e-0000-4000-8000-000000000001', youtube_id: null, marcado_rodado_em: null, apagar: [], b2_nomes: [], motivo: null,
      prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...extra }] })
    if (!l.ok) throw new Error(l.porque)
    const r = scriptDasPendencias(l, { versao: 'teste' })
    if (!r.ok) throw new Error(r.porque)
    return r.linhas.join('\n')
  }
  it('ramo (a): mesma frase da tela', () => {
    const t = lido({ snap_espera_desde: '2026-11-22T12:00:00Z', snap_libera_em: '2026-12-06T20:00:00Z' })
    expect(t).toContain('Aguardando os snapshots do NAS desde 22/11; o comando libera por volta de 06/12. Nada a fazer até lá.')
  })
  it('ramo (a) com a data passada há menos de 24 h: "próxima verificação"', () => {
    expect(lido({ snap_espera_desde: '2026-11-10T12:00:00Z', snap_libera_em: '2026-12-01T00:00:00Z' })).toContain('deve liberar na próxima verificação da forja')
  })
  it('data passada há mais de 24 h: âmbar, nunca "libera hoje"', () => {
    const t = lido({ snap_espera_desde: '2026-11-10T12:00:00Z', snap_libera_em: '2026-11-27T20:00:00Z' })
    expect(t).toContain('Atenção: o prazo dos snapshots do NAS (27/11) passou')
    expect(t).not.toContain('libera hoje')
  })
  it('ramo (b): a frase âmbar com a ação, sem data', () => {
    const t = lido({ snap_espera_desde: '2026-11-10T12:00:00Z', snap_libera_em: '2026-11-30T20:00:00Z', snap_bloqueio: 'fora_do_padrao' })
    expect(t).toContain(fraseSnapBloqueado('fora_do_padrao'))
    expect(t).not.toContain('libera por volta')
  })
  it('sem as chaves: "Aguardando os snapshots do NAS."', () => {
    expect(lido({})).toContain('Aguardando os snapshots do NAS.')
  })
})
