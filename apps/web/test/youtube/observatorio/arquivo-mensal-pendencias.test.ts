// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerPendencias, pendenciasParaTela, LINHA_DO_DONO, FALTAS, MOTIVOS } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const SHA = 'a'.repeat(64)
const base = (itens: unknown[], extra: Record<string, unknown> = {}) => ({ versao: 2, lido_em: '2026-12-01T10:00:00Z', total: itens.length, itens, ...extra })
const canal = (o: Record<string, unknown> = {}) => ({ item_id: 'canal:6f1c1b9e-0000-4000-8000-000000000001', kind: 'canal', tempo: 'sem_comando',
  desde: '2026-10-01T12:00:00Z', mes: null, channel_ref: '6f1c1b9e-0000-4000-8000-000000000001', youtube_id: 'UCx', marcado_rodado_em: null,
  apagar: [], b2_nomes: [], motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o,
  // a falta acompanha o tempo, para cada caso inválido falhar pelo motivo que o nome diz (não por falta fora de lugar)
  falta: 'falta' in o ? o.falta : (o.tempo ?? 'sem_comando') === 'sem_comando' ? 'snapshots' : null })

describe('lerPendencias: a forma do C12', () => {
  it('a linha do dono é a da peça 7, com cd e com -s (E-D1)', () => {
    expect(LINHA_DO_DONO).toBe("cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'")
  })
  it('zero medido é ok com lista vazia', () => {
    expect(lerPendencias(base([]))).toEqual({ ok: true, lidoEm: new Date('2026-12-01T10:00:00Z'), itens: [] })
  })
  it('um canal sem comando', () => {
    const l = lerPendencias(base([canal()]))
    expect(l.ok && l.itens[0]!.tempo).toBe('sem_comando')
  })
  it('o formato de data do Postgres (jsonb, com microssegundos e deslocamento) é aceito', () => {
    expect(lerPendencias({ ...base([canal({ desde: '2026-10-01T12:00:00.123456+00:00' })]), lido_em: '2026-12-01T10:00:00.5+00:00' }).ok).toBe(true)
  })
  it('um item de vídeo da E9 e o apagar_antigas bem formado (M9) passam', () => {
    const video = canal({ item_id: 'item:42', kind: 'video', channel_ref: null, youtube_id: 'abc_DEF-123' })
    expect(lerPendencias(base([video])).ok).toBe(true)
    const antigas = canal({ tempo: 'apagar_antigas', falta: null, mes: '2026-10',
      apagar: [{ filho: 'numerico', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/2026-10.v1.csv.gz', sha256: SHA, nova: { caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/2026-10.v2.csv.gz', sha256: SHA } }] })
    expect(lerPendencias(base([antigas])).ok).toBe(true)
  })
  it.each([
    ['nulo', null],
    ['lista', []],
    ['versão 1 (banco sem a M9)', base([], { versao: 1 })],
    ['sem lido_em', { versao: 1, total: 0, itens: [] }],
    ['total diferente', { ...base([canal()]), total: 2 }],
    ['campo a mais', base([], { extra: 1 })],
    ['campo a mais no item', base([canal({ extra: 1 })])],
    ['tempo desconhecido', base([canal({ tempo: 'apagar' })])],
    ['kind desconhecido', base([canal({ kind: 'playlist' })])],
    ['desde nulo', base([canal({ desde: null })])],
    ['apagar fora de apagar_antigas', base([canal({ apagar: [{ filho: 'numerico', caminho: 'serie/x.csv.gz', sha256: SHA, nova: null }] })])],
    ['apagar_antigas sem nada a apagar', base([canal({ tempo: 'apagar_antigas' })])],
    ['b2_nomes fora de conferir_b2', base([canal({ b2_nomes: ['a'] })])],
    ['b2_nomes em apagar_antigas', base([canal({ tempo: 'apagar_antigas', falta: null, b2_nomes: ['a/b'], apagar: [{ filho: 'texto', caminho: 'a/b', sha256: SHA, nova: null }] })])],
    ['b2_nomes vazio em conferir_b2', base([canal({ tempo: 'conferir_b2', falta: null })])],
    ['nome de B2 com aspas', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ["a'b"] })])],
    ['nome de B2 com espaço', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['a b'] })])],
    ['nome de B2 com cifrão', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['a$b'] })])],
    ['nome de B2 com crase', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['a`b'] })])],
    ['nome de B2 com quebra de linha', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['a\nb'] })])],
    ['nome de B2 com ..', base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['a/../b'] })])],
    ['falta fora de sem_comando', base([canal({ tempo: 'conferir_b2', b2_nomes: ['a/b'], falta: 'snapshots' })])],
    ['falta desconhecida (site mais novo)', base([canal({ falta: 'nova_falta' })])],
    ['motivo fora de bloqueado', base([canal({ motivo: 'depende_m10b' })])],
    ['bloqueado sem motivo', base([canal({ tempo: 'bloqueado', falta: null })])],
    ['motivo desconhecido', base([canal({ tempo: 'bloqueado', falta: null, motivo: 'outro' })])],
    ['antiga: com kind video', base([canal({ item_id: 'antiga:11111111-1111-4111-8111-111111111115', kind: 'video', channel_ref: null })])],
    ['kind versao sem antiga:', base([canal({ item_id: 'item:5', kind: 'versao', channel_ref: null })])],
    ['prefixos fora de canal', base([canal({ item_id: 'item:5', kind: 'video', channel_ref: null, prefixos: ['a/b'] })])],
    ['canal:A com prefixo do canal B (M9b)', base([canal({ tempo: 'apagar_antigas', falta: null, prefixos: ['serie/canais/6f1c1b9e-0000-4000-8000-000000000002'], apagar: [{ filho: 'numerico', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/a.csv.gz', sha256: SHA, nova: null }] })])],
    ['canal:A com caminho a apagar do canal B (M9b)', base([canal({ tempo: 'apagar_antigas', falta: null, prefixos: ['serie/canais/6f1c1b9e-0000-4000-8000-000000000001'], apagar: [{ filho: 'numerico', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000002/a.csv.gz', sha256: SHA, nova: null }] })])],
    ['canal:A com apagar.nova do canal B (M9b)', base([canal({ tempo: 'apagar_antigas', falta: null, prefixos: ['serie/canais/6f1c1b9e-0000-4000-8000-000000000001'], apagar: [{ filho: 'numerico', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/a.csv.gz', sha256: SHA, nova: { caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000002/b.csv.gz', sha256: SHA } }] })])],
    ['canal:A com prefixo genérico fora de <classe>/canais/<ref> (M9b)', base([canal({ tempo: 'apagar_antigas', falta: null, prefixos: ['serie'], apagar: [{ filho: 'numerico', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/a.csv.gz', sha256: SHA, nova: null }] })])],
    ['caminho com ..', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: '../etc/x', sha256: SHA, nova: null }] })])],
    ['caminho com .. no meio', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: 'a/../x', sha256: SHA, nova: null }] })])],
    ['caminho absoluto', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: '/etc/x', sha256: SHA, nova: null }] })])],
    ['caminho com aspas', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: "a'b", sha256: SHA, nova: null }] })])],
    ['caminho novo com cifrão', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: 'a', sha256: SHA, nova: { caminho: 'a$b', sha256: SHA } }] })])],
    ['filho desconhecido', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'appdata', caminho: 'a', sha256: SHA, nova: null }] })])],
    ['item_id com substituição de comando', base([canal({ item_id: 'item:$(touch X)' })])],
    ['item_id com crase', base([canal({ item_id: 'canal:`id`' })])],
    ['canal: com channel_ref diferente', base([canal({ channel_ref: '6f1c1b9e-0000-4000-8000-000000000002' })])],
    ['canal: com kind video', base([canal({ kind: 'video' })])],
    ['item: com kind canal', base([canal({ item_id: 'item:7' })])],
    ['youtube_id com crase', base([canal({ youtube_id: 'UC`id`' })])],
    ['sha curto', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: 'a', sha256: 'abc', nova: null }] })])],
    ['mes inválido', base([canal({ mes: '2026-13' })])],
    ['caminho com // (mesmo arquivo que o sem //; Phil I1)', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'texto//2026-10/v2.csv.gz', sha256: SHA, nova: { caminho: 'texto/2026-10/v2.csv.gz', sha256: SHA } }] })])],
    ['caminho com / no fim', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'texto/2026-10/', sha256: SHA, nova: { caminho: 'texto/2026-10/v2.csv.gz', sha256: SHA } }] })])],
    ['caminho da nova com //', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'a/v1', sha256: SHA, nova: { caminho: 'a//v2', sha256: SHA } }] })])],
    ['antiga igual à nova (Phil I1)', base([canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'a/v2', sha256: SHA, nova: { caminho: 'a/v2', sha256: SHA } }] })])],
    ['antiga de um item é a nova de outro, mesmo filho (Phil I1)', base([
      canal({ tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'a/v1', sha256: SHA, nova: { caminho: 'a/v2', sha256: SHA } }] }),
      canal({ item_id: 'item:9', kind: 'video', channel_ref: null, youtube_id: 'x', tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'a/v2', sha256: SHA, nova: { caminho: 'a/v3', sha256: SHA } }] })])],
  ])('%s: { ok: false }, nunca "nada pendente"', (_, bruto) => {
    expect(lerPendencias(bruto).ok).toBe(false)
  })
  it('a razão da recusa não repete o valor recebido', () => {
    const l = lerPendencias(base([canal({ youtube_id: 'UC`id`' })]))
    expect(l.ok).toBe(false)
    if (!l.ok) expect(l.porque).not.toContain('`id`')
  })
})

describe('lerPendencias: a versao 2 (M9)', () => {
  it('lê a versao 2: campos novos mapeados e kind versao', () => {
    const c2 = '6f1c1b9e-0000-4000-8000-000000000002'
    const l = lerPendencias(base([
      canal({ falta: 'snapshots', snapshot_mais_antigo: '2026-11-01T00:00:00Z', bloqueados: 2, marcado_rodado_em: '2026-11-02T00:00:00Z' }),
      canal({ item_id: 'antiga:11111111-1111-4111-8111-111111111117', kind: 'versao', channel_ref: null, youtube_id: null, falta: 'segunda_conferencia', mes: '2026-09' }),
      canal({ item_id: 'item:9', kind: 'video', channel_ref: null, tempo: 'bloqueado', falta: null, motivo: 'grande_demais' }),
      canal({ item_id: 'canal:' + c2, channel_ref: c2, tempo: 'apagar_antigas', falta: null, prefixos: ['serie/canais/' + c2], apagar: [{ filho: 'numerico', caminho: 'serie/canais/' + c2 + '/a.csv.gz', sha256: SHA, nova: null }] }),
      canal({ item_id: 'item:11', kind: 'video', channel_ref: null, tempo: 'conferir_b2', falta: null, b2_nomes: ['numerico/serie/x.csv.gz'] })]))
    if (!l.ok) throw new Error(l.porque)
    expect(l.itens[0]).toMatchObject({ falta: 'snapshots', motivo: null, bloqueados: 2, snapshotMaisAntigo: '2026-11-01T00:00:00Z', marcadoRodadoEm: new Date('2026-11-02T00:00:00Z'), prefixos: [] })
    expect(l.itens[1]).toMatchObject({ kind: 'versao', itemId: 'antiga:11111111-1111-4111-8111-111111111117', falta: 'segunda_conferencia' })
    expect(l.itens[2]).toMatchObject({ tempo: 'bloqueado', motivo: 'grande_demais' })
    expect(l.itens[3]).toMatchObject({ prefixos: ['serie/canais/' + c2], apagar: [{ nova: null }] })
    expect(l.itens[4]!.b2Nomes).toEqual(['numerico/serie/x.csv.gz'])
  })
  it('recusa a versao 1 e diz por quê', () => {
    const l = lerPendencias(base([], { versao: 1 }))
    expect(l.ok).toBe(false)
    if (!l.ok) expect(l.porque).toContain('versao')
  })
  it('Phil: até 2000 prefixos passa; 2001 é recusado (o teto do attest do site)', () => {
    const pref = (n: number) => Array.from({ length: n }, () => 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001')
    expect(lerPendencias(base([canal({ prefixos: pref(2000) })])).ok).toBe(true)
    const l = lerPendencias(base([canal({ prefixos: pref(2001) })]))
    expect(l.ok).toBe(false)
    if (!l.ok) expect(l.porque).toContain('prefixos')
  })
  it('nome de B2 seguro passa', () => {
    expect(lerPendencias(base([canal({ tempo: 'conferir_b2', falta: null, b2_nomes: ['numerico/serie/canais/x_y-1.csv.gz'] })])).ok).toBe(true)
  })
  it('a tela leva falta, motivo, bloqueados e snapshotMaisAntigo, nunca apagar nem b2_nomes', () => {
    const t = pendenciasParaTela(lerPendencias(base([canal({ falta: 'snapshots', snapshot_mais_antigo: '2026-11-01T00:00:00Z', bloqueados: 3 })])), { podeVerComandos: false, agora: new Date('2026-12-01T12:00:00Z') })
    expect(t).toMatchObject({ estado: 'com_itens', itens: [{ falta: 'snapshots', motivo: null, bloqueados: 3, snapshotMaisAntigo: '2026-11-01T00:00:00Z' }] })
  })
  it('M9-snap: o leitor aceita o item com e sem as três chaves de espera por snapshot, e a tela leva os dias e a data', () => {
    const sem = lerPendencias(base([canal({ falta: 'snapshots' })]))
    expect(sem.ok && sem.itens[0]).toMatchObject({ snapEsperaDesde: null, snapLiberaEm: null, snapBloqueio: null })
    const com = lerPendencias(base([canal({ falta: 'snapshots', snap_espera_desde: '2026-11-22T12:00:00Z', snap_libera_em: '2026-12-06T20:00:00Z', snap_bloqueio: null })]))
    expect(com.ok && com.itens[0]).toMatchObject({ snapEsperaDesde: new Date('2026-11-22T12:00:00Z'), snapLiberaEm: new Date('2026-12-06T20:00:00Z'), snapBloqueio: null })
    const t = pendenciasParaTela(com, { podeVerComandos: false, agora: new Date('2026-12-01T12:00:00Z') })
    expect(t).toMatchObject({ itens: [{ snapEsperaDias: 9, snapLiberaHoje: false }] })
    const vencida = pendenciasParaTela(com, { podeVerComandos: false, agora: new Date('2026-12-07T12:00:00Z') })
    expect(vencida).toMatchObject({ itens: [{ snapLiberaHoje: true }] })
    expect(lerPendencias(base([canal({ falta: 'snapshots', snap_bloqueio: 'retido' })])).ok).toBe(true)
    expect(lerPendencias(base([canal({ falta: 'snapshots', snap_bloqueio: 'anterior' })])).ok).toBe(false)
  })
  it('FALTAS e MOTIVOS são as listas do contrato', () => {
    expect(FALTAS).toHaveLength(14)
    expect(MOTIVOS).toEqual(['antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente'])
  })
})

describe('pendenciasParaTela (E-D4)', () => {
  const agora = new Date('2026-12-01T12:00:00Z')
  it('quem só edita vê contagem e idade, sem a linha', () => {
    const t = pendenciasParaTela(lerPendencias(base([canal()])), { podeVerComandos: false, agora })
    expect(t).toMatchObject({ estado: 'com_itens', n: 1, maisAntigoDias: 61, linha: null })
    expect(JSON.stringify(t)).not.toContain('b2_nomes')
  })
  it('quem administra recebe a linha', () => {
    expect(pendenciasParaTela(lerPendencias(base([canal()])), { podeVerComandos: true, agora })).toMatchObject({ linha: LINHA_DO_DONO })
  })
  it('a tela nunca recebe apagar nem b2_nomes', () => {
    const antigas = canal({ tempo: 'apagar_antigas', falta: null, apagar: [{ filho: 'texto', caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/b', sha256: SHA, nova: { caminho: 'serie/canais/6f1c1b9e-0000-4000-8000-000000000001/c', sha256: SHA } }] })
    const t = pendenciasParaTela(lerPendencias(base([antigas])), { podeVerComandos: true, agora })
    expect(JSON.stringify(t)).not.toMatch(/apagar"|b2_nomes|sha256|caminho/)
    expect(t).toMatchObject({ estado: 'com_itens', itens: [{ item_id: antigas.item_id, kind: 'canal', tempo: 'apagar_antigas', idadeDias: 61 }] })
  })
  it('zero medido e não medido são estados diferentes; sem permissão não há linha nem com zero', () => {
    expect(pendenciasParaTela(lerPendencias(base([])), { podeVerComandos: true, agora })).toMatchObject({ estado: 'zero' })
    expect(pendenciasParaTela(lerPendencias(base([])), { podeVerComandos: false, agora })).toMatchObject({ estado: 'zero', linha: null })
    expect(pendenciasParaTela(lerPendencias(null), { podeVerComandos: true, agora })).toEqual({ estado: 'nao_medido' })
  })
  it('Yannis I-3: cada item leva o título resolvido pelos mapas (canal pelo id, vídeo pelo id do YouTube); sem nome, o mês; nada de apagar/b2_nomes', () => {
    const c2 = '6f1c1b9e-0000-4000-8000-000000000002'
    const l = lerPendencias(base([
      canal(), canal({ item_id: 'canal:' + c2, channel_ref: c2, mes: '2028-03' }),
      canal({ item_id: 'item:7', kind: 'video', channel_ref: null, youtube_id: 'abc123', mes: '2028-03' }),
      canal({ item_id: 'item:8', kind: 'comentario', channel_ref: null, youtube_id: 'zzz', mes: '2028-04' }),
      canal({ item_id: 'canal:6f1c1b9e-0000-4000-8000-000000000003', channel_ref: '6f1c1b9e-0000-4000-8000-000000000003', mes: null })]))
    const t = pendenciasParaTela(l, { podeVerComandos: false, agora, nomes: { canais: new Map([['6f1c1b9e-0000-4000-8000-000000000001', 'Canal Um']]), videos: new Map([['abc123', 'O vídeo']]) } })
    if (t.estado !== 'com_itens') throw new Error('esperava itens')
    expect(t.itens.map(i => i.titulo)).toEqual(['Canal Um', 'março de 2028', 'O vídeo', 'abril de 2028', '6f1c1b9e'])   // canal sem nome e sem mês: o código, nunca o vazio (r2 R-1)
    expect(JSON.stringify(t)).not.toMatch(/b2_nomes|sha256|apagar"/)
  })
  it('o mais antigo vem do menor desde, mesmo fora de ordem', () => {
    const l = lerPendencias(base([canal({ desde: '2026-11-20T12:00:00Z' }), canal({ item_id: 'item:3', kind: 'video', channel_ref: null, desde: '2026-10-01T12:00:00Z' })]))
    expect(pendenciasParaTela(l, { podeVerComandos: false, agora })).toMatchObject({ n: 2, maisAntigoDias: 61 })
  })
})
