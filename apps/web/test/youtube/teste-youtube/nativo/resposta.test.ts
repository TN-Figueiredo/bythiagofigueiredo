// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { derivadasDeVariantesTitulo, patchDaResposta, responderDia14, type RespostaDono } from '@/lib/youtube/teste-youtube/nativo/resposta'
import type { VarianteFicha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { roteiro, ok } from '../../../helpers/banco-roteirizado'
import * as Sentry from '@sentry/nextjs'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const img = (n: number) => ({ url: `https://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/${n}.jpg`, sha256: 'a'.repeat(64), largura: 1280, altura: 720 })
const comTitulos: VarianteFicha[] = [{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }, { n: 3, tipo: 'combo', titulo: 'Outra', imagem: img(3) }]
const soMiniatura: VarianteFicha[] = [{ n: 1, tipo: 'miniatura', imagem: img(1) }, { n: 2, tipo: 'miniatura', imagem: img(2) }]
const ficha = (itens: VarianteFicha[]) => ({ itens, origem: 'ficha' as const, originalConhecido: true })
const derivada = (titulos: string[]) => ({ ...derivadasDeVariantesTitulo(titulos, null)!, origem: 'derivada' as const })

describe('derivadasDeVariantesTitulo', () => {
  it('monta {n, tipo titulo, titulo} a partir de variantes_titulo; nulo ou vazio ou lixo -> null', () => {
    expect(derivadasDeVariantesTitulo(['A', 'B'], null)?.itens).toEqual([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B' }])
    expect(derivadasDeVariantesTitulo(null, null)).toBeNull()
    expect(derivadasDeVariantesTitulo([], null)).toBeNull()
    expect(derivadasDeVariantesTitulo('x', null)).toBeNull()
    expect(derivadasDeVariantesTitulo([1, 2], null)).toBeNull()
  })
})

describe('patchDaResposta', () => {
  it('venceu_nova com ficha: n=2 grava título da variante e fonte dono', () => {
    const p = patchDaResposta('venceu_nova', 2, ficha(comTitulos))
    expect(p).toMatchObject({
      sempre: { resposta_dono: 'venceu_nova', variante_vencedora: 2 },
      seEmAndamento: { estado: 'encerrado', desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'resposta_do_dono', vencedor_titulo: 'Nova', vencedor_fonte: 'dono' },
    })
  })
  it('venceu_nova só de miniatura: sem título, mas com variante_vencedora (passa no CHECK novo)', () => {
    const p = patchDaResposta('venceu_nova', 2, ficha(soMiniatura))
    expect(p).toMatchObject({ sempre: { variante_vencedora: 2 }, seEmAndamento: { vencedor_titulo: null, vencedor_fonte: 'dono' } })
  })
  it('3 variantes: n=3 grava, n=4 e n=0 recusam', () => {
    expect(patchDaResposta('venceu_nova', 3, ficha(comTitulos))).toMatchObject({ sempre: { variante_vencedora: 3 } })
    expect(patchDaResposta('venceu_nova', 4, ficha(comTitulos))).toEqual({ erro: 'variante_invalida' })
    expect(patchDaResposta('venceu_nova', 0, ficha(comTitulos))).toEqual({ erro: 'variante_invalida' })
    expect(patchDaResposta('venceu_nova', null, ficha(comTitulos))).toEqual({ erro: 'variante_invalida' })
  })
  it('n=1 em venceu_nova com ficha recusa (o original não é a nova); n maior que o array recusa', () => {
    expect(patchDaResposta('venceu_nova', 1, ficha(comTitulos))).toEqual({ erro: 'variante_invalida' })
    expect(patchDaResposta('venceu_nova', 3, ficha(soMiniatura))).toEqual({ erro: 'variante_invalida' })
  })
  it('origem derivada: n é o índice+1 em variantes_titulo, de 1 a N, e grava o título escolhido', () => {
    expect(patchDaResposta('venceu_nova', 1, derivada(['A', 'B']))).toMatchObject({ sempre: { variante_vencedora: 1 }, seEmAndamento: { vencedor_titulo: 'A', vencedor_fonte: 'dono' } })
    expect(patchDaResposta('venceu_nova', 2, derivada(['A', 'B']))).toMatchObject({ seEmAndamento: { vencedor_titulo: 'B' } })
    expect(patchDaResposta('venceu_nova', 3, derivada(['A', 'B']))).toEqual({ erro: 'variante_invalida' })
  })
  it('sem variantes nenhuma: venceu_nova recusa', () => {
    expect(patchDaResposta('venceu_nova', 2, null)).toEqual({ erro: 'variante_invalida' })
  })
  it('venceu_original: só com ficha; variante_vencedora 1 e título do original', () => {
    expect(patchDaResposta('venceu_original', null, ficha(comTitulos))).toMatchObject({
      sempre: { resposta_dono: 'venceu_original', variante_vencedora: 1 },
      seEmAndamento: { estado: 'encerrado', desfecho_estado: 'vencedor_provavel', vencedor_titulo: 'Original', vencedor_fonte: 'dono' },
    })
    expect(patchDaResposta('venceu_original', 1, ficha(soMiniatura))).toMatchObject({ seEmAndamento: { vencedor_titulo: null, vencedor_fonte: 'dono' }, sempre: { variante_vencedora: 1 } })
    expect(patchDaResposta('venceu_original', null, derivada(['A', 'B']))).toEqual({ erro: 'variante_invalida' })
    expect(patchDaResposta('venceu_original', null, null)).toEqual({ erro: 'variante_invalida' })
  })
  it.each<[RespostaDono, string, string]>([
    ['ficou_igual', 'encerrado', 'sem_dado'], ['inconclusivo', 'encerrado', 'sem_dado'], ['nao_vi', 'sem_desfecho', 'sem_dado'],
  ])('%s: variante_vencedora nula explícita, nunca vencedor', (r, estado, desf) => {
    const p = patchDaResposta(r, 2, ficha(comTitulos))
    expect(p).toMatchObject({
      sempre: { resposta_dono: r, variante_vencedora: null },
      seEmAndamento: { estado, desfecho_estado: desf, desfecho_motivo: 'resposta_do_dono', vencedor_titulo: null, vencedor_fonte: null },
    })
    expect('sempre' in p && Object.prototype.hasOwnProperty.call(p.sempre, 'variante_vencedora')).toBe(true)
  })
})

const AGORA = new Date('2026-10-21T12:00:00.000Z')
const base = { siteId: 's1', userId: 'u1', registroId: 'r1', lido: 'L0', agora: AGORA }
const linha = (o: Record<string, unknown> = {}) => ok({
  id: 'r1', estado: 'em_andamento', resposta_dono: null, vencedor_fonte: null, vencedor_titulo: null, confirmado_em: '2026-10-01T00:00:00+00:00',
  desfecho_motivo: null, variantes: comTitulos, variantes_titulo: null, updated_at: 'L0', ...o,
})

describe('responderDia14', () => {
  it('em_andamento + venceu_nova: um update com sempre + seEmAndamento + encerrado_em, CAS e guarda de resposta; expira o lembrete', async () => {
    const r = roteiro({ ab_native_tests: [linha(), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    const upd = r.chamadas[1]!.metodos.join(' ')
    expect(upd).toContain('"resposta_dono":"venceu_nova"')
    expect(upd).toContain('"respondido_em":"2026-10-21T12:00:00.000Z"')
    expect(upd).toContain('"desfecho_motivo":"resposta_do_dono"')
    expect(upd).toContain('"encerrado_em":"2026-10-21T12:00:00.000Z"')
    expect(upd).toContain('"vencedor_titulo":"Nova"')
    expect(r.chamadas[1]!.metodos).toContain('eq("updated_at","L0")')
    expect(r.chamadas[1]!.metodos.some((m) => m.startsWith('or(') && m.includes('resposta_dono.is.null'))).toBe(true)
    const n = r.chamadas.find((c) => c.alvo === 'notifications')!
    expect(n.metodos.join(' ')).toContain('lembrete-nativo:r1')
    expect(n.metodos.join(' ')).toContain('expired_at')
  })

  it('sem_desfecho sem fonte: vira encerrado/vencedor_provavel e mantém encerrado_em', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'sem_desfecho', resposta_dono: 'sem_resposta' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_original', n: null })).toEqual({ ok: true, conflito: null })
    const upd = r.chamadas[1]!.metodos.join(' ')
    expect(upd).toContain('"estado":"encerrado"')
    expect(upd).not.toContain('"encerrado_em"')
  })

  it('vencedor_fonte presente (data_api): guarda só a resposta e devolve conflito', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'encerrado', vencedor_fonte: 'data_api', vencedor_titulo: 'Original' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    const res = await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })
    expect(res).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    const upd = r.chamadas[1]!.metodos.join(' ')
    expect(upd).toContain('"variante_vencedora":2')
    expect(upd).not.toContain('"estado"')
    expect(upd).not.toContain('"vencedor_fonte"')
  })

  it('encerrado sem veredito (ficou_igual do registrador): só a resposta, sem conflito', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'encerrado' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    expect(r.chamadas[1]!.metodos.join(' ')).not.toContain('"estado"')
  })

  it('linha derivada (detectado confirmado, sem ficha): "Venceu a nova" n=2 grava o 2º título', async () => {
    const r = roteiro({ ab_native_tests: [linha({ variantes: null, variantes_titulo: ['A', 'B'] }), ok([{ id: 'r1' }])], yt_own_video_versions: [ok([])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2, tituloVisto: 'B' })).toEqual({ ok: true, conflito: null })
    expect(r.chamadas.find((c) => c.alvo === 'ab_native_tests' && c.metodos.some((m) => m.startsWith('update')))!.metodos.join(' ')).toContain('"vencedor_titulo":"B"')
  })

  it('derivada: título de antes lido uma vez (sem Lab, antes de primeira_vista); sem tituloVisto -> estado_mudou; título diferente -> estado_mudou', async () => {
    const mk = () => roteiro({ ab_native_tests: [linha({ variantes: null, variantes_titulo: ['B', 'A'], primeira_vista: '2026-10-05T00:00:00+00:00' }), ok([{ id: 'r1' }])], yt_own_video_versions: [ok([{ value_text: 'A' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    const a = mk()
    expect(await responderDia14({ ...base, sb: a.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: false, erro: 'estado_mudou' })
    const q = a.chamadas.find((c) => c.alvo === 'yt_own_video_versions')!.metodos.join(' ')
    expect(q).toContain('neq("origin","ab_lab")')
    expect(q).toContain('lte("first_seen_at","2026-10-05T00:00:00+00:00")')
    expect(a.chamadas.some((c) => c.metodos.some((m) => m.startsWith('update')))).toBe(false)
    const b = mk()
    expect(await responderDia14({ ...base, sb: b.sb, resposta: 'venceu_nova', n: 2, tituloVisto: 'C' })).toEqual({ ok: false, erro: 'estado_mudou' })
    const c = mk()
    expect(await responderDia14({ ...base, sb: c.sb, resposta: 'venceu_nova', n: 2, tituloVisto: 'B' })).toEqual({ ok: true, conflito: null })
    const d = mk()
    expect(await responderDia14({ ...base, sb: d.sb, resposta: 'venceu_original', n: null, tituloVisto: 'A' })).toEqual({ ok: true, conflito: null })
  })

  it('ficha: tituloVisto ausente ou nulo grava; título errado -> estado_mudou', async () => {
    const a = roteiro({ ab_native_tests: [linha(), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: a.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    const b = roteiro({ ab_native_tests: [linha({ variantes: soMiniatura }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: b.sb, resposta: 'venceu_nova', n: 2, tituloVisto: null })).toEqual({ ok: true, conflito: null })
    const c = roteiro({ ab_native_tests: [linha()] })
    expect(await responderDia14({ ...base, sb: c.sb, resposta: 'venceu_nova', n: 2, tituloVisto: 'Outra' })).toEqual({ ok: false, erro: 'estado_mudou' })
  })

  it('ja_respondido com a mesma resposta e n: ok sem escrever; resposta diferente: ja_respondido', async () => {
    const a = roteiro({ ab_native_tests: [linha({ resposta_dono: 'venceu_nova', variante_vencedora: 2 })] })
    expect(await responderDia14({ ...base, sb: a.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    expect(a.chamadas).toHaveLength(1)
    const b = roteiro({ ab_native_tests: [linha({ resposta_dono: 'venceu_original', variante_vencedora: 1 })] })
    expect(await responderDia14({ ...base, sb: b.sb, resposta: 'venceu_original', n: null })).toEqual({ ok: true, conflito: null })
    const c = roteiro({ ab_native_tests: [linha({ resposta_dono: 'venceu_nova', variante_vencedora: 2 })] })
    expect(await responderDia14({ ...base, sb: c.sb, resposta: 'venceu_nova', n: 3 })).toEqual({ ok: false, erro: 'ja_respondido' })
  })

  it('o veredito do dono zera desfecho_versao_regra; o rastro grava a variante escrita (1 em venceu_original)', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'sem_desfecho', desfecho_motivo: 'coleta_encerrada' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_original', n: null })).toEqual({ ok: true, conflito: null })
    expect(r.chamadas[1]!.metodos.join(' ')).toContain('"desfecho_versao_regra":null')
    expect(r.chamadas.find((c) => c.alvo === 'audit_log')!.metodos.join(' ')).toContain('"variante_vencedora":1')
  })

  it('já respondido: ja_respondido sem escrever; sem_resposta aceita nova resposta', async () => {
    const r = roteiro({ ab_native_tests: [linha({ resposta_dono: 'ficou_igual' })] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: false, erro: 'ja_respondido' })
    expect(r.chamadas).toHaveLength(1)
  })

  it('corrida de duplo toque: o update perde, a releitura vê resposta e devolve ja_respondido', async () => {
    const r = roteiro({ ab_native_tests: [linha(), ok([]), linha({ resposta_dono: 'venceu_nova', updated_at: 'L1' })] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: false, erro: 'ja_respondido' })
  })

  it('CAS perdido por evidência: relê uma vez, reavalia a elegibilidade e grava', async () => {
    const r = roteiro({ ab_native_tests: [linha(), ok([]), linha({ estado: 'encerrado', vencedor_fonte: 'data_api', vencedor_titulo: 'Original', updated_at: 'L1' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    const res = await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })
    expect(res).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    expect(r.chamadas[3]!.metodos).toContain('eq("updated_at","L1")')
  })

  it('variante inválida e inexistente / descartada / não confirmada', async () => {
    const a = roteiro({ ab_native_tests: [linha()] })
    expect(await responderDia14({ ...base, sb: a.sb, resposta: 'venceu_nova', n: 4 })).toEqual({ ok: false, erro: 'variante_invalida' })
    const b = roteiro({ ab_native_tests: [ok(null)] })
    expect(await responderDia14({ ...base, sb: b.sb, resposta: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'nao_encontrado' })
    const c = roteiro({ ab_native_tests: [linha({ estado: 'descartado' })] })
    expect(await responderDia14({ ...base, sb: c.sb, resposta: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'nao_respondivel' })
    const d = roteiro({ ab_native_tests: [linha({ confirmado_em: null })] })
    expect(await responderDia14({ ...base, sb: d.sb, resposta: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'nao_respondivel' })
  })

  it('erro de escrita volta como falha_escrita (sem texto cru do banco), vai ao Sentry, e a notificação não é tocada', async () => {
    const r = roteiro({ ab_native_tests: [linha(), { data: null, error: { message: 'queda' } }] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'nao_vi', n: null })).toEqual({ ok: false, erro: 'falha_escrita' })
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(r.chamadas.some((c) => c.alvo === 'notifications')).toBe(false)
  })

  it('falha ao expirar o lembrete não desfaz a resposta (vai ao log)', async () => {
    const r = roteiro({ ab_native_tests: [linha(), ok([{ id: 'r1' }])], notifications: [{ data: null, error: { message: 'queda' } }] })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'nao_vi', n: null })).toEqual({ ok: true, conflito: null })
    expect(log).toHaveBeenCalled(); log.mockRestore()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('expirar lembrete-nativo falhou', expect.objectContaining({ level: 'warning' }))
  })

  it('sem_desfecho COM vencedor_fonte de outro lado (data_api): conflito, estado e veredito intactos (Yannis C1)', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'sem_desfecho', vencedor_fonte: 'data_api', vencedor_titulo: 'Original' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    const res = await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })
    expect(res).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    const upd = r.chamadas[1]!.metodos.join(' ')
    expect(upd).not.toContain('"estado"')
    expect(upd).not.toContain('"vencedor_fonte"')
    expect(upd).not.toContain('"vencedor_titulo"')
  })

  it('sem_desfecho/teste_novo: a resposta não troca desfecho_motivo (Phil C1) mas encerra e marca o dono', async () => {
    const r = roteiro({ ab_native_tests: [linha({ estado: 'sem_desfecho', desfecho_motivo: 'teste_novo' }), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [ok(null)] })
    expect(await responderDia14({ ...base, sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    const upd = r.chamadas[1]!.metodos.join(' ')
    expect(upd).not.toContain('desfecho_motivo')
    expect(upd).toContain('"estado":"encerrado"')
    expect(upd).toContain('"vencedor_fonte":"dono"')
    expect(upd).toContain('"resposta_dono":"venceu_nova"')
  })

  it('grava o rastro de quem respondeu em audit_log (Phil m3); falha do audit não desfaz a resposta', async () => {
    const r = roteiro({ ab_native_tests: [linha(), ok([{ id: 'r1' }])], notifications: [ok(null)], audit_log: [{ data: null, error: { message: 'queda' } }] })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await responderDia14({ ...base, orgId: 'o1', sb: r.sb, resposta: 'venceu_nova', n: 2 })).toEqual({ ok: true, conflito: null })
    log.mockRestore()
    const a = r.chamadas.find((c) => c.alvo === 'audit_log')!
    const m = a.metodos.join(' ')
    expect(m).toContain('"action":"ab_native_respondido"')
    expect(m).toContain('"actor_user_id":"u1"')
    expect(m).toContain('"resposta_dono":"venceu_nova"')
    expect(m).toContain('"estado_anterior":"em_andamento"')
  })
})
