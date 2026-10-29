// @vitest-environment jsdom
// M9-snap (D-M9-9b), sub-tarefa 9b-T: a frase que diz por que um item espera os snapshots do NAS (peça 7). Texto e estado, sem layout novo.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { scriptDasPendencias } from '@/lib/youtube/observatorio/arquivo/pendencias-script'
import { lerPendencias, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const LIDO = new Date('2026-12-01T12:00:00Z')
const it1 = (o: Record<string, unknown>) => ({ item_id: 'canal:x', kind: 'canal', tempo: 'sem_comando' as const, falta: 'snapshots' as const, idadeDias: 3, titulo: 'Nômade Raiz' as string | null,
  desde: new Date('2026-11-28T12:00:00Z'), codigo: 'abc' as string | null, snapEsperaDias: null as number | null, snapLiberaEm: null as Date | null, snapLiberaHoje: false, snapBloqueio: null as string | null, ...o })
const tela = (i: ReturnType<typeof it1>): PendenciasDaTela => ({ estado: 'com_itens', lidoEm: LIDO, n: 1, maisAntigoDias: i.idadeDias, itens: [i] as never, linha: null })
const LIBERA = new Date('2026-12-06T20:00:00Z')

describe('9b-T: frase (a), a espera que termina sozinha', () => {
  it.each([[0, 'Aguardando os snapshots do NAS desde hoje; libera por volta de 06/12, sem ação sua.'],
    [1, 'Aguardando os snapshots do NAS há 1 dia; libera por volta de 06/12, sem ação sua.'],
    [9, 'Aguardando os snapshots do NAS há 9 dias; libera por volta de 06/12, sem ação sua.']])('N = %s', (n, texto) => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDias: n, snapLiberaEm: LIBERA }))} />)
    expect(screen.getByText(texto)).toBeTruthy()
    expect(document.querySelector('[data-snap="espera"]')).not.toBeNull()
  })
  it('data de liberar já passada: "libera hoje", nunca uma data no passado (Yannis m2, Phil m1)', () => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDias: 15, snapLiberaEm: new Date('2026-11-30T20:00:00Z'), snapLiberaHoje: true }))} />)
    expect(screen.getByText('Aguardando os snapshots do NAS há 15 dias; libera hoje, sem ação sua.')).toBeTruthy()
    expect(screen.queryByText(/30\/11/)).toBeNull()
  })
})
describe('9b-T: frase (b), âmbar, a espera não termina sozinha', () => {
  it.each([['fora_do_padrao', 'há snapshot manual ou de outra tarefa'], ['retido', 'há snapshot de antes da remoção que não expira (hold ou retenção maior que 14 dias)'],
    ['lista_vazia', 'a forja não vê nenhum snapshot'], ['mtime_diverge', 'a hora dos snapshots não confere'], ['relogio', 'a hora dos snapshots não confere'],
    ['ilegivel', 'a forja não conseguiu ler a lista']])('%s', (b, palavras) => {
    render(<EsperamComandos t={tela(it1({ snapEsperaDias: 16, snapLiberaEm: LIBERA, snapBloqueio: b }))} />)
    expect(screen.getByText(`Os snapshots do NAS não liberam sozinhos (${palavras}). Veja o runbook, Tarefa 14, Passo 2.`)).toBeTruthy()
    expect(screen.queryByText(/sem ação sua/)).toBeNull()
    expect(screen.queryByText(/libera por volta/)).toBeNull()
    expect(document.querySelector('[data-snap="bloqueado"]')).not.toBeNull()
  })
})
describe('9b-T: sem a espera, nenhuma frase', () => {
  it('sem snapEsperaDias (banco sem a migration ou item sem linha esperando)', () => {
    render(<EsperamComandos t={tela(it1({}))} />)
    expect(document.querySelector('[data-snap]')).toBeNull()
  })
  it('falta diferente de snapshots', () => {
    render(<EsperamComandos t={tela(it1({ falta: 'resumo', snapEsperaDias: 3, snapLiberaEm: LIBERA }))} />)
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
  it('ramo (a): sufixo "libera por volta de DD/MM", sem "mais antigo"', () => {
    const t = lido({ snap_espera_desde: '2026-11-22T12:00:00Z', snap_libera_em: '2026-12-06T20:00:00Z', snapshot_mais_antigo: '2026-11-20T00:00:00Z' })
    expect(t).toContain('os snapshots do NAS de antes da remoção ainda não expiraram (14 dias); a limpeza segue sozinha; libera por volta de 06/12')
    expect(t).not.toContain('mais antigo')
  })
  it('ramo (a) com a data já passada: "libera hoje"', () => {
    expect(lido({ snap_espera_desde: '2026-11-10T12:00:00Z', snap_libera_em: '2026-11-30T20:00:00Z' })).toContain('; libera hoje')
  })
  it('ramo (b): a frase âmbar, sem data', () => {
    const t = lido({ snap_espera_desde: '2026-11-10T12:00:00Z', snap_libera_em: '2026-11-30T20:00:00Z', snap_bloqueio: 'fora_do_padrao' })
    expect(t).toContain('Os snapshots do NAS não liberam sozinhos (há snapshot manual ou de outra tarefa). Veja o runbook, Tarefa 14, Passo 2.')
    expect(t).not.toContain('libera por volta')
  })
  it('sem as chaves: a frase-base, sem sufixo', () => {
    const t = lido({})
    expect(t).toContain('a limpeza segue sozinha')
    expect(t).not.toContain('libera')
  })
})
