// @vitest-environment node
// M9b conserto 1 (Phil 66, Yannis 74): cada item do brief, com o caso que falhava antes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { montarBloco, marcaAoLadoDaPastilha, esperaSnapshots, type ListaRemovidosV2, type PendenciasDoBloco, type PendenciaDoCanal } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias, pendenciasParaTela, marcaDoItem, sinalDoVerificador } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import type { Casa } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const AGORA = Date.parse('2026-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const casa: Casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' }
const cap = (o: Record<string, boolean> = {}) => ({ comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null, blobsLigados: true, ...o })
const iso = (dias: number): string => new Date(AGORA - dias * D).toISOString()
const linha = (o: Record<string, unknown>): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: REF, estado: 'pedido', decided_at: iso(5),
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: iso(5), removido_via: 'botao',
  primeiro_mes: '2024-10', ultimo_mes: '2025-11', meses: 14, registros: 118402, classes: ['serie'], ...o }) as ListaRemovidosV2[number]
const pend = (o: Partial<PendenciaDoCanal> = {}): PendenciasDoBloco => ({ ok: true, canais: new Map([[REF, { tempo: 'copiar', falta: null, snapLiberaEm: null, snapBloqueio: null, marcadoRodadoEm: null, b2Nomes: 0, ...o }]]) })
const bloco = (l: ListaRemovidosV2[number], o: { cap?: Record<string, boolean>; casa?: Casa; administra?: boolean; pend?: PendenciasDoBloco; verificadorEm?: number | null } = {}) =>
  montarBloco([l], { agora: AGORA, casa: o.casa ?? casa, cap: cap(o.cap), administra: o.administra ?? true, pend: o.pend ?? pend(), verificadorEm: o.verificadorEm }).linhas[0]!

describe('item 1: marca "Já rodei" velha (refutado falso)', () => {
  const ITEM = (o: Record<string, unknown>) => ({ item_id: `canal:${REF}`, kind: 'canal', tempo: 'copiar', desde: iso(5), mes: null, channel_ref: REF, youtube_id: null, marcado_rodado_em: iso(2),
    apagar: [], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o })
  const APAGAR = { tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: `serie/canais/${REF}/b.csv`, sha256: 'a'.repeat(64), nova: null }] }
  const B2 = { tempo: 'conferir_b2', b2_nomes: ['a/b.csv'] }
  const tela = (item: Record<string, unknown>, verificadorEm?: number | null) => {
    const t = pendenciasParaTela(lerPendencias({ versao: 2, lido_em: new Date(AGORA).toISOString(), total: 1, itens: [item] }), { podeVerComandos: true, agora: new Date(AGORA), verificadorEm })
    if (t.estado !== 'com_itens') throw new Error('fixture')
    return t.itens[0]!
  }
  it.each([
    ['apagar_antigas + conferência rodou depois de marca+24 h', APAGAR, AGORA - 300_000, { refutado: true, atrasado: false, incerto: false, marca: true }],
    ['apagar_antigas + conferência nunca deu sinal', APAGAR, null, { refutado: false, atrasado: true, incerto: false, marca: true }],
    ['apagar_antigas + conferência rodou ANTES de marca+24 h', APAGAR, AGORA - 2 * D - 3_600_000, { refutado: false, atrasado: true, incerto: false, marca: true }],
    ['apagar_antigas + aviso não lido: neutro, sem culpar a forja', APAGAR, undefined, { refutado: false, atrasado: false, incerto: true, marca: true }],
    ['conferir_b2 + forja responde + 2 dias: volta "Já rodei"', B2, AGORA - 300_000, { refutado: false, atrasado: false, incerto: false, marca: false }],
    ['conferir_b2 + forja parada + 2 dias', B2, null, { refutado: false, atrasado: false, incerto: false, marca: false }],
    ['copiar + forja responde + 2 dias', {}, AGORA - 300_000, { refutado: false, atrasado: false, incerto: false, marca: false }],
  ])('%s', (_t, extra, forja, esp) => {
    const i = tela(ITEM(extra), forja)
    expect({ refutado: i.marcadoRefutado, atrasado: i.marcadoAtrasado, incerto: i.marcadoIncerto, marca: i.marcadoRodadoEm !== null }).toEqual(esp)
  })
  it('marcado há 1 hora nunca é refutado, qualquer tempo', () => {
    for (const extra of [APAGAR, B2, {}]) {
      const i = tela(ITEM({ ...extra, marcado_rodado_em: iso(1 / 24) }), AGORA)
      expect(i).toMatchObject({ marcadoRefutado: false, marcadoAtrasado: false })
      expect(i.marcadoRodadoEm).not.toBeNull()
    }
  })
  it('marcaDoItem: sem marca = nada', () => {
    expect(marcaDoItem({ tempo: 'apagar_antigas', marcadoRodadoEm: null }, new Date(AGORA), AGORA)).toEqual({ marcadoRodadoEm: null, marcadoRefutado: false, marcadoAtrasado: false, marcadoIncerto: false })
  })
  it('forja voltou há 5 min (copiador), conferência parada, marca de 3 dias: atrasado, não refutado', () => {
    const casa = [{ worker: 'copiador', last_poll_at: new Date(AGORA - 300_000).toISOString(), updated_at: null }, { worker: 'conferir_b2', last_poll_at: new Date(AGORA - 4 * D).toISOString(), updated_at: null }]
    expect(marcaDoItem({ tempo: 'apagar_antigas', marcadoRodadoEm: new Date(AGORA - 3 * D) }, new Date(AGORA), sinalDoVerificador(casa))).toMatchObject({ marcadoRefutado: false, marcadoAtrasado: true, marcadoIncerto: false })
  })
  it('sinalDoVerificador: sem conferir_b2 = nulo', () => {
    expect(sinalDoVerificador([{ worker: 'copiador', last_poll_at: new Date(AGORA).toISOString(), updated_at: null }])).toBeNull()
  })
})

describe('item 2: so_prefixo em "pedido" não é mudo', () => {
  it('pedido + so_prefixo: o comando volta, a frase diz das pastas vazias, nunca "nada a fazer"', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'sem_comando', falta: 'so_prefixo' }) })
    expect(l.acao).toBe('comandos')
    expect(l.frase).toContain('Só restam pastas vazias do canal no NAS')
    expect(l.frase).not.toContain('nada a fazer')
    expect(l.comandos?.titulo).toContain('pastas vazias')
  })
  it('quem só edita: frase de quem administra, sem botão', () => {
    const l = bloco(linha({}), { administra: false, pend: pend({ tempo: 'sem_comando', falta: 'so_prefixo' }) })
    expect(l.acao).toBeNull(); expect(l.frase).toContain('quem administra o site')
  })
  it('outra falta de espera (ex.: snapshots) segue como "Espera o site"', () => {
    expect(bloco(linha({}), { pend: pend({ tempo: 'sem_comando', falta: 'snapshots' }) }).frase).toContain('Espera o site; nada a fazer agora.')
  })
})

describe('item 3: apagado_b2 nunca verde por falta de dado', () => {
  const b2 = (o: Record<string, unknown> = {}) => linha({ estado: 'apagado_b2', nas_absent_at: iso(20), b2_absent_at: iso(1), decided_at: iso(10), snapshots_clear_on: '2026-04-20', ...o })
  it('lote_e10 aberto: frase própria, sem "conclui sozinho" e sem culpar o B2', () => {
    const l = bloco(b2(), { pend: pend({ tempo: 'sem_comando', falta: 'lote_e10' }) })
    expect(l.frase).toContain('A exportação que você fez à mão deste canal ainda está aberta. Termine-a antes: a limpeza espera.')
    expect(l.frase).not.toMatch(/conclui a limpeza sozinho|conferência do B2/)
    expect(l.forma).not.toBe('visto')
  })
  it('imagens sem aceite: hachura e "peça para olhar"', () => {
    const l = bloco(b2(), { pend: pend({ tempo: 'sem_comando', falta: 'imagens' }) })
    expect(l).toMatchObject({ forma: 'hachura', gravidade: 'nao_medido' })
    expect(l.frase).toContain('Peça para olhar; a limpeza espera.')
    expect(l.frase).not.toContain('conclui a limpeza sozinho')
  })
  it('a leitura das pendências falhou ou não foi feita: hachura, nunca "não há mais nada a rodar"', () => {
    for (const p of [{ ok: false } as PendenciasDoBloco, undefined]) {
      const l = montarBloco([b2()], { agora: AGORA, casa, cap: cap(), administra: true, ...(p ? { pend: p } : {}) }).linhas[0]!
      expect(l).toMatchObject({ forma: 'hachura', gravidade: 'nao_medido' })
      expect(l.frase).toContain('A linha dos comandos não foi lida; recarregue a página.')
      expect(l.frase).not.toContain('não há mais nada a rodar')
    }
  })
  it('controle: com a leitura boa e sem falta, segue "Sua parte terminou. O site conclui..."', () => {
    expect(bloco(b2(), { pend: pend({ tempo: 'sem_comando' }) }).frase).toContain('O site conclui a limpeza sozinho')
  })
})

describe('item 4: tempo parado vira âmbar', () => {
  it('pedido marcado há 2 dias, apagar_antigas, forja responde: âmbar, nota, "rode a linha de novo", sem "em até 24 horas"', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'apagar_antigas', marcadoRodadoEm: AGORA - 2 * D }), verificadorEm: AGORA - 300_000 })
    expect(l).toMatchObject({ forma: 'triangulo', gravidade: 'ambar', acao: 'comandos' })
    expect(l.frase).toContain('Rode a linha de novo (ver os comandos)')
    expect(l.frase).not.toContain('em até 24 horas')
    expect(l.nota?.frase).toBe('Você marcou que rodou em 01/05, mas a verificação não achou a mudança.')
    expect(l.nota?.forma).toBe('triangulo')
  })
  it('pedido marcado há 2 dias, apagar_antigas, aviso não lido: nota neutra, sem refutar nem culpar a forja', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'apagar_antigas', marcadoRodadoEm: AGORA - 2 * D }) })
    expect(l.nota?.frase).toContain('não sabemos se já foi verificado')
    expect(l.frase).not.toContain('Rode a linha de novo')
    expect(`${l.frase} ${l.nota?.frase}`).not.toMatch(/forja/i)
  })
  it('pedido marcado há 2 dias em conferir_b2: a marca vale nada, volta "Falta você rodar a linha" e sem nota', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'conferir_b2', b2Nomes: 1, marcadoRodadoEm: AGORA - 2 * D }) })
    expect(l.nota).toBeNull(); expect(l.frase).toContain('Falta você rodar a linha no Mac'); expect(l.frase).not.toContain('Falta a confirmação do site')
  })
  it('pedido marcado há 1 hora: continua a espera de até 24 horas', () => {
    const l = bloco(linha({}), { pend: pend({ tempo: 'apagar_antigas', marcadoRodadoEm: AGORA - 3_600_000 }) })
    expect(l.frase).toContain('Falta a confirmação do site, em até 24 horas.')
    expect(l.gravidade).toBe('nenhuma')
  })
  it('refutado aos 63 dias de pedido: continua vermelho (o âmbar não rebaixa)', () => {
    const l = bloco(linha({ decided_at: iso(63) }), { pend: pend({ tempo: 'apagar_antigas', marcadoRodadoEm: AGORA - 2 * D }) })
    expect(l).toMatchObject({ forma: 'octogono', gravidade: 'vermelho' })
  })
  it('apagado_nas com prazo cumprido e "espera o site" aos 95 dias: a cor da idade manda (nunca neutro)', () => {
    const nas = (dias: number) => linha({ estado: 'apagado_nas', nas_absent_at: iso(dias), decided_at: iso(dias + 5), snapshots_clear_on: '2026-01-01' })
    const p = pend({ tempo: 'sem_comando', falta: null })
    expect(bloco(nas(95), { pend: p })).toMatchObject({ gravidade: 'vermelho', forma: 'octogono' })
    expect(bloco(nas(40), { pend: p })).toMatchObject({ gravidade: 'ambar', forma: 'triangulo' })
    expect(bloco(nas(3), { pend: p })).toMatchObject({ gravidade: 'nenhuma', forma: 'pontilhado' })
  })
})

describe('item 5: imagens do Blob sem promessa que o site não cumpre', () => {
  const g = (blobs: boolean) => bloco(linha({ estado: 'guardado', blobs_pendentes: 3 }), { cap: { blobsLigados: blobs } })
  it('guardado + tentativa diária ligada: "saem quando você apagar do arquivo"', () => {
    expect(g(true).blob?.frase).toContain('Saem quando você apagar do arquivo')
  })
  it('guardado + tentativa diária desligada: nada de "o site só tenta apagá-las depois"', () => {
    const f = g(false).blob!.frase
    expect(f).toContain('o comando que as apaga ainda não tem data para chegar')
    expect(f).not.toMatch(/Saem quando|tenta/)
  })
  it('sem_arquivo com imagens: nunca "tenta de novo", ligada ou não; com 40 dias diz que deve ser investigado', () => {
    for (const blobs of [true, false]) {
      const l = bloco(linha({ estado: 'sem_arquivo', blobs_pendentes: 412, decided_at: iso(40) }), { cap: { blobsLigados: blobs } })
      expect(l.frase).not.toMatch(/tenta/)
      expect(l.frase).toContain('412 imagens do canal ainda não foram apagadas')
    }
    expect(bloco(linha({ estado: 'sem_arquivo', blobs_pendentes: 412, decided_at: iso(40) })).frase).toContain('Peça para investigar o apagamento no Blob.')
  })
  it('blobsLigados false: a cor do Blob é cinza (não vira vermelho por idade que ninguém conta)', () => {
    const l = bloco(linha({ estado: 'sem_arquivo', blobs_pendentes: 4, decided_at: iso(200) }), { cap: { blobsLigados: false } })
    expect(l.gravidade).toBe('nenhuma')
    const ligado = bloco(linha({ estado: 'sem_arquivo', blobs_pendentes: 4, decided_at: iso(200) }), { cap: { blobsLigados: true } })
    expect(ligado.gravidade).toBe('vermelho')
  })
})

describe('item 6: meses nulo = sem botão (o diálogo não tem número)', () => {
  it.each([[null, null, null], [0, '2024-10', '2024-10'], [3, null, '2024-10'], [3, '2024-10', null]])('meses=%s primeiro=%s ultimo=%s', (meses, primeiro_mes, ultimo_mes) => {
    const l = bloco(linha({ estado: 'guardado', meses, primeiro_mes, ultimo_mes }))
    expect(l.acao).toBeNull(); expect(l.dialogo).toBeNull(); expect(l.frase).toContain('quantos meses')
  })
  it('quem não administra não lê a frase dos meses (não é com ele)', () => {
    expect(bloco(linha({ estado: 'guardado', meses: null }), { administra: false }).frase).not.toContain('quantos meses')
  })
})

describe('item 9: a marca da pastilha', () => {
  const nas = (o: Record<string, unknown> = {}) => linha({ estado: 'apagado_nas', nas_absent_at: iso(9), decided_at: iso(20), snapshots_clear_on: null, ...o })
  const marca = (l: ListaRemovidosV2[number], p?: PendenciasDoBloco) => marcaAoLadoDaPastilha([l], { agora: AGORA, casa, cap: cap(), ...(p ? { pend: p } : {}) })
  it('esperando snapshots sem bloqueio, ou com ilegivel: fora da marca', () => {
    expect(marca(nas(), pend({ tempo: 'sem_comando', falta: 'snapshots' }))).toBeNull()
    expect(marca(nas(), pend({ tempo: 'sem_comando', falta: 'snapshots', snapBloqueio: 'ilegivel' }))).toBeNull()
  })
  it('retido e fora_do_padrao (e os outros bloqueios): seguem na marca', () => {
    for (const b of ['retido', 'fora_do_padrao', 'lista_vazia', 'mtime_diverge', 'relogio'] as const) {
      expect(marca(nas(), pend({ tempo: 'sem_comando', falta: 'snapshots', snapBloqueio: b }))).toMatchObject({ n: 1 })
    }
  })
  it('a leitura das pendências falhou ou não veio: a espera por snapshots não infla a marca', () => {
    expect(marca(nas(), { ok: false })).toBeNull()
    expect(marca(nas())).toBeNull()
  })
  it('apagado_nas com o prazo vencido pela data da linha conta sem precisar da leitura (a leitura é só para o resto)', () => {
    expect(marca(nas({ snapshots_clear_on: '2026-04-01' }))).toMatchObject({ n: 1 })
  })
  it('pedido segue contando', () => {
    expect(marca(linha({}))).toMatchObject({ n: 1 })
  })
  it('esperaSnapshots: nula ou futura = espera; vencida = não; outro estado = não', () => {
    expect(esperaSnapshots(nas(), AGORA)).toBe(true)
    expect(esperaSnapshots(nas({ snapshots_clear_on: '2026-05-10' }), AGORA)).toBe(true)
    expect(esperaSnapshots(nas({ snapshots_clear_on: '2026-05-03' }), AGORA)).toBe(false)
    expect(esperaSnapshots(linha({}), AGORA)).toBe(false)
  })
})
