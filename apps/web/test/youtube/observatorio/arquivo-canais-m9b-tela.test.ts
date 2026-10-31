// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { montarBloco, marcaAoLadoDaPastilha, type ListaRemovidosV2, type PendenciasDoBloco, type PendenciaDoCanal } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import type { Casa } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const casa: Casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' }
const cap = (o: Record<string, boolean> = {}) => ({ comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null, blobsLigados: true, ...o })
const iso = (dias: number): string => new Date(AGORA - dias * D).toISOString()
const linha = (o: Record<string, unknown>): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: REF, estado: 'pedido', decided_at: iso(5),
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: iso(5), removido_via: 'botao',
  primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 118402, classes: ['serie'], ...o }) as ListaRemovidosV2[number]
const pend = (o: Partial<PendenciaDoCanal> = {}): PendenciasDoBloco => ({ ok: true, canais: new Map([[REF, { tempo: 'copiar', falta: null, snapLiberaEm: null, snapBloqueio: null, marcadoRodadoEm: null, b2Nomes: 0, ...o }]]) })
const bloco = (l: ListaRemovidosV2[number], o: { cap?: Record<string, boolean>; administra?: boolean; pend?: PendenciasDoBloco } = {}) =>
  montarBloco([l], { agora: AGORA, casa, cap: cap(o.cap), administra: o.administra ?? true, pend: o.pend ?? pend() }).linhas[0]!

describe('M9b T7: capacidades', () => {
  it('blobsLigados: variável ausente = desligado; só "on" liga', () => {
    const env: NodeJS.ProcessEnv = { OBS_ARQUIVO_LIMPEZA_BLOBS: 'on' }
    expect(lerCapacidades(env).blobsLigados).toBe(true)
    delete env.OBS_ARQUIVO_LIMPEZA_BLOBS
    expect(lerCapacidades(env).blobsLigados).toBe(false)
    for (const v of ['ON', '1', '']) expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_BLOBS: v } as NodeJS.ProcessEnv).blobsLigados).toBe(false)
  })
  it('a variável da tela não liga os blobs', () => {
    expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL: 'on' } as NodeJS.ProcessEnv).blobsLigados).toBe(false)
  })
})

describe('M9b T7: Apagar do arquivo (guardado e sem_destino)', () => {
  it('guardado, administra, comando ligado: ação apagar e diálogo com o nome', () => {
    const l = bloco(linha({ estado: 'guardado' }))
    expect(l.acao).toBe('apagar')
    expect(l.dialogo).toMatchObject({ titulo: 'Apagar do arquivo os 14 meses de Viagem Lenta?', confirma: 'Viagem Lenta', porCodigo: false, loteE10: false, avisoBlob: false })
    expect(l.dialogo!.corpo).toBe('Os 14 meses (de 10/2026 a 11/2027) saem do arquivo e podem ser a única cópia dos registros deste canal.')
  })
  it('1 mês: singular', () => {
    expect(bloco(linha({ estado: 'guardado', meses: 1, ultimo_mes: '2026-10' })).dialogo!.titulo).toBe('Apagar do arquivo o 1 mês de Viagem Lenta?')
  })
  it('meses nulos: sem botão e sem diálogo (não há número a mostrar), a frase diz por quê, nunca "0 meses"', () => {
    for (const meses of [null, 0]) {
      for (const estado of ['guardado', 'sem_destino']) {
        const l = bloco(linha({ estado, meses, primeiro_mes: null, ultimo_mes: null }))
        expect(l.acao).toBeNull(); expect(l.dialogo).toBeNull()
        expect(l.frase).toContain('Não foi possível ler quantos meses o arquivo deste canal tem')
        expect(l.frase).not.toMatch(/\b0 meses|null/)
      }
    }
    // com os meses lidos, o botão volta
    expect(bloco(linha({ estado: 'guardado' })).acao).toBe('apagar')
  })
  it('quem só edita: sem ação, frase diz que espera quem administra', () => {
    const l = bloco(linha({ estado: 'guardado' }), { administra: false })
    expect(l.acao).toBeNull(); expect(l.dialogo).toBeNull()
    expect(l.frase).toContain('Espera quem administra o site para apagar do arquivo.')
  })
  it('flag da limpeza ausente: sem ação, frase "espera o comando"', () => {
    const l = bloco(linha({ estado: 'guardado' }), { cap: { comandoDeLimpeza: false } })
    expect(l.acao).toBeNull()
    expect(l.frase).toContain('Espera o comando')
  })
  it('lote da E10: aviso só quando removido_via é e10_export', () => {
    expect(bloco(linha({ estado: 'guardado', removido_via: 'e10_export' })).dialogo!.loteE10).toBe(true)
    expect(bloco(linha({ estado: 'guardado', removido_via: 'botao' })).dialogo!.loteE10).toBe(false)
  })
  it('sem_destino: digita o código, aviso do Blob, vermelho e no topo', () => {
    const l = bloco(linha({ estado: 'sem_destino', nome: null, removido_em: null, removido_via: 'sem_registro', meses: 9, ultimo_mes: '2027-06' }))
    expect(l.acao).toBe('apagar'); expect(l.noTopo).toBe(true)
    expect(l.dialogo).toMatchObject({ titulo: 'Apagar do arquivo os 9 meses do código AAAAAAAA?', confirma: 'AAAAAAAA', porCodigo: true, avisoBlob: true })
  })
  it('guardado com imagens no Blob: a linha diz que saem quando o arquivo for apagado (o site só tenta as de remoção apagar)', () => {
    const l = bloco(linha({ estado: 'guardado', blobs_pendentes: 3 }))
    expect(l.blob?.frase).toMatch(/3 imagens do canal ainda não foram apagadas do Blob/)
    expect(l.blob?.frase).toMatch(/Saem quando você apagar do arquivo/)
  })
})

describe('M9b T7: Ver os comandos (pedido)', () => {
  it('pedido a 5, 34 e 63 dias: a mesma frase, forma e cor pela idade', () => {
    const f = (d: number) => bloco(linha({ decided_at: iso(d) }))
    expect(f(5)).toMatchObject({ acao: 'comandos', forma: 'arquivo', gravidade: 'nenhuma' })
    expect(f(34)).toMatchObject({ forma: 'triangulo', gravidade: 'ambar' })
    expect(f(63)).toMatchObject({ forma: 'octogono', gravidade: 'vermelho' })
    expect(f(5).frase).toContain('Limpeza pedida há 5 dias. Falta você rodar a linha no Mac (ver os comandos).')
    expect(f(63).frase).toContain('há 63 dias, mais de 60.')
    expect(f(5).comandos).toMatchObject({ titulo: 'Para limpar o arquivo de Viagem Lenta, rode uma linha no Mac.' })
    expect(f(5).comandos!.linha).toContain('obs:arquivo')
  })
  it('régua de 4 etapas na ordem nova', () => {
    expect(bloco(linha({})).regua.map(e => e.curto)).toEqual(['Pedida', 'NAS', 'Snapshots', 'B2'])
  })
  it('leitura das pendências falhou: hachura, sem botão, nunca painel vazio', () => {
    const l = bloco(linha({}), { pend: { ok: false } })
    expect(l).toMatchObject({ acao: null, forma: 'hachura', gravidade: 'nao_medido' })
    expect(l.frase).toContain('Não foi possível ler a linha dos comandos; recarregue a página.')
  })
  it('quem só edita: espera quem administra, sem botão', () => {
    const l = bloco(linha({}), { administra: false })
    expect(l.acao).toBeNull(); expect(l.frase).toContain('Espera quem administra o site rodar a linha.')
  })
  it('marcado como rodado: leitura sem botão novo, nota com a data', () => {
    const l = bloco(linha({}), { pend: pend({ marcadoRodadoEm: AGORA - 1 * D }) })
    expect(l.frase).toContain('Falta a confirmação do site, em até 24 horas.')
    expect(l.nota?.frase).toBe('Você marcou que rodou em 02/05; a confirmação chega em até 24 horas.')
  })
  it('arquivo reapareceu: octógono', () => {
    const l = bloco(linha({ reappeared_at: iso(2), reappeared_count: 1 }))
    expect(l.forma).toBe('octogono'); expect(l.frase).toContain('reapareceu em 01/05/2028, depois de apagado. Falta você rodar a linha de novo')
    expect(l.comandos!.titulo).toBe('Para limpar de novo o arquivo de Viagem Lenta, rode uma linha no Mac.')
  })
  it('falta lote_e10: espera, sem botão', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'sem_comando', falta: 'lote_e10' }) })
    expect(l.acao).toBeNull(); expect(l.frase).toContain('A exportação que você fez à mão deste canal ainda está aberta. Termine-a antes: a limpeza espera.')
  })
  it('falta imagens: hachura, peça para olhar', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'sem_comando', falta: 'imagens' }) })
    expect(l).toMatchObject({ acao: null, forma: 'hachura' }); expect(l.frase).toContain('Peça para olhar; a limpeza espera.')
  })
  it('falta so_prefixo: volta o comando', () => {
    const l = bloco(linha({ estado: 'apagado_b2', b2_absent_at: iso(3), nas_absent_at: iso(20), snapshots_clear_on: '2028-04-20' }), { pend: pend({ tempo: 'sem_comando', falta: 'so_prefixo' }) })
    expect(l.acao).toBe('comandos'); expect(l.frase).toContain('Só restam pastas vazias do canal no NAS')
  })
  it('flag da limpeza desligada: sem comando e a data', () => {
    const l = bloco(linha({}), { cap: { comandoDeLimpeza: false } })
    expect(l.acao).toBeNull(); expect(l.frase).toContain('Espera o comando, que ainda não tem data para chegar.')
  })
})

describe('M9b T7: régua e snapshots', () => {
  const nas = (o: Record<string, unknown> = {}) => linha({ estado: 'apagado_nas', nas_absent_at: iso(9), decided_at: iso(20), ...o })
  const formas = (l: { regua: { forma: string }[] }) => l.regua.map(e => e.forma)
  it('apagado_nas sem snapshots_clear_on = passo dos snapshots', () => {
    expect(formas(bloco(nas(), { pend: pend({ tempo: 'sem_comando', falta: 'snapshots', snapLiberaEm: AGORA + 5 * D }) }))).toEqual(['visto', 'visto', 'pontilhado', 'pontilhado'])
  })
  it('apagado_nas com snapshots_clear_on vencida = passo do B2', () => {
    expect(formas(bloco(nas({ snapshots_clear_on: '2028-04-30' }), { pend: pend({ tempo: 'apagar_antigas' }) }))).toEqual(['visto', 'visto', 'visto', 'arquivo'])
  })
  it('apagado_b2 = tudo visto; snapshots_clear_on nulo não derruba', () => {
    expect(formas(bloco(linha({ estado: 'apagado_b2', nas_absent_at: iso(20), b2_absent_at: iso(1), snapshots_clear_on: null }), { pend: pend({ tempo: 'sem_comando' }) }))).toEqual(['visto', 'visto', 'visto', 'visto'])
  })
  it('espera com data: "Espere até dd/mm", sem comando, sem idade, fora da marca da pastilha', () => {
    const p = pend({ tempo: 'sem_comando', falta: 'snapshots', snapLiberaEm: Date.parse('2028-05-08T12:00:00Z') })
    const l = bloco(nas(), { pend: p })
    expect(l.acao).toBeNull(); expect(l.forma).toBe('pontilhado'); expect(l.gravidade).toBe('nenhuma')
    expect(l.frase).toContain('Apagado do NAS em'); expect(l.frase).toContain('Aguardando os snapshots do NAS. Espere até 08/05.')
    expect(marcaAoLadoDaPastilha([nas()], { agora: AGORA, casa, cap: cap(), pend: p })).toBeNull()
  })
  it('sem a data (nula): nunca "hoje" nem "0 dias"', () => {
    const l = bloco(nas(), { pend: pend({ tempo: 'sem_comando', falta: 'snapshots' }) })
    expect(l.forma).toBe('hachura'); expect(l.frase).toContain('a data em que expiram não foi lida')
    expect(l.frase).not.toMatch(/hoje|0 dias/)
  })
  it('pendências não lidas: hachura com a data não lida', () => {
    const l = bloco(nas(), { pend: { ok: false } })
    expect(l.forma).toBe('hachura'); expect(l.acao).toBeNull(); expect(l.frase).toContain('a data não foi lida')
  })
  it('snapBloqueio: âmbar, sem comando e sem data', () => {
    const l = bloco(nas(), { pend: pend({ tempo: 'sem_comando', falta: 'snapshots', snapBloqueio: 'retido', snapLiberaEm: AGORA + 5 * D }) })
    expect(l).toMatchObject({ acao: null, forma: 'triangulo', gravidade: 'ambar' })
    expect(l.frase).toContain('Os snapshots do NAS não puderam ser conferidos: peça para olhar a conferência dos snapshots.')
    expect(l.frase).not.toContain('Espere até')
  })
  it('B2 ainda lista arquivos: âmbar e comando', () => {
    const l = bloco(nas({ snapshots_clear_on: '2028-04-30' }), { pend: pend({ tempo: 'conferir_b2', b2Nomes: 7 }) })
    expect(l).toMatchObject({ acao: 'comandos', forma: 'triangulo' }); expect(l.frase).toContain('O B2 ainda lista 7 arquivos deste canal')
  })
  it('apagado_b2: sua parte terminou; blobs pendentes espera; confirmação atrasada vira âmbar', () => {
    const b2 = (o: Record<string, unknown> = {}) => linha({ estado: 'apagado_b2', nas_absent_at: iso(20), b2_absent_at: iso(1), decided_at: iso(10), snapshots_clear_on: '2028-04-20', ...o })
    expect(bloco(b2(), { pend: pend({ tempo: 'sem_comando' }) }).frase).toContain('Sua parte terminou. O site conclui a limpeza sozinho; não há mais nada a rodar.')
    const bl = bloco(b2({ blobs_pendentes: 412 }), { pend: pend({ tempo: 'sem_comando', falta: 'blobs' }) })
    expect(bl.frase).toContain('A limpeza do arquivo espera as imagens saírem do Blob.')
    expect(bl.blob?.frase).toContain('412 imagens do canal ainda não foram apagadas do Blob; o site tenta de novo')
    const atrasado = bloco(b2({ b2_absent_at: iso(3), completed_at: null }), { pend: pend({ tempo: 'sem_comando' }) })
    expect(atrasado).toMatchObject({ forma: 'triangulo', gravidade: 'ambar' }); expect(atrasado.frase).toContain('a confirmação final ainda não chegou')
  })
  it('blobs com a tentativa diária desligada: a frase diz que o comando não tem data (nunca "o site tenta")', () => {
    const l = bloco(linha({ estado: 'apagado_b2', nas_absent_at: iso(20), b2_absent_at: iso(1), blobs_pendentes: 412 }), { cap: { blobsLigados: false }, pend: pend({ tempo: 'sem_comando', falta: 'blobs' }) })
    expect(l.blob?.frase).toContain('o comando que as apaga ainda não tem data para chegar'); expect(l.blob?.frase).not.toContain('tenta de novo')
  })
})
