import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('CHECK ab_tests_restore_status_shape e histórico', () => {
  // Fixture única; cada caso a copia por spread (nunca muta).
  const OK = { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: '2026-10-12T08:02:00Z', attempts: 0 }
  const casos: Array<[string, Record<string, unknown>]> = [
    ['sem estado', { ...OK, estado: undefined }],
    ['sem forcado', { ...OK, forcado: undefined }],
    ['sem attempts', { ...OK, attempts: undefined }],
    ['em_andamento sem forcado e attempts', { estado: 'em_andamento', destino: 'original', em: OK.em }],
    ['attempts 1.5', { ...OK, attempts: 1.5 }],
    ['attempts 3000000000', { ...OK, attempts: 3000000000 }],
    ['em "agora"', { ...OK, em: 'agora' }],
    ['escreveu "sim"', { ...OK, escreveu: 'sim' }],
    ['destino objeto', { ...OK, destino: { id: 'x' } }],
  ]
  it.each(casos)('%s falha no CHECK com o nome da constraint', async (_n, campo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: JSON.parse(JSON.stringify(campo)) } }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_restore_status_shape/)
  })

  it('o CHECK aceita em_andamento com o id da variante como destino e erro com chamada (P4a grava os dois; D3, F-D10)', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: {
      title: { estado: 'em_andamento', destino: t.varB, forcado: false, escreveu: null, erro: null, em: OK.em, attempts: 0 },
      thumbnail: { ...OK, estado: 'falhou', escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }, attempts: 1 } } }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })

  it('o passo 4 não incrementa restore_seq; regravar o mesmo seq substitui a linha do histórico', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    await clienteServico().from('ab_tests').update({ restore_seq: 1, restore_status: { title: { ...OK, estado: 'falhou', escreveu: false, erro: { status: 403, reason: 'forbidden' } } } }).eq('id', t.testId)
    const g1 = (await clienteServico().from('ab_test_restores').select('gravado_em').eq('test_id', t.testId).single()).data!.gravado_em
    await clienteServico().from('ab_tests').update({ restore_status: { title: OK } }).eq('id', t.testId)
    const linhas = (await clienteServico().from('ab_test_restores').select('seq, estado, gravado_em').eq('test_id', t.testId)).data!
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ seq: 1, estado: 'ok' })
    expect(linhas[0].gravado_em).not.toBe(g1)
    const x = (await clienteServico().from('ab_tests').select('restore_seq').eq('id', t.testId).single()).data!
    expect(x.restore_seq).toBe(1)
  })

  it('Y-D3: regravar o resultado anterior com seq novo não cria linha; e o gatilho tem a guarda (pg_get_functiondef)', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    await clienteServico().from('ab_tests').update({ restore_seq: 1, restore_status: { title: OK } }).eq('id', t.testId)
    await clienteServico().from('ab_tests').update({ restore_seq: 2, restore_status: { title: { ...OK, estado: 'em_andamento', escreveu: null } } }).eq('id', t.testId)
    await clienteServico().from('ab_tests').update({ restore_status: { title: OK } }).eq('id', t.testId).eq('restore_seq', 2)
    expect((await clienteServico().from('ab_test_restores').select('seq').eq('test_id', t.testId)).data).toHaveLength(1)
    const def = await q<{ tem: boolean }>(`select pg_get_functiondef('public.tg_ab_tests_restore_log'::regproc) like '%r.seq < new.restore_seq%' as tem`)
    expect(def[0]!.tem).toBe(true)
  })

  it('erro de 10 000 caracteres: o escritor trunca antes (o CHECK não tem teto)', async () => {
    // a garantia é de código (truncarErro, Tarefa 2); aqui só se prova que o banco aceitaria e por isso o teto é do código
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: { ...OK, estado: 'falhou', erro: 'x'.repeat(10_000) } } }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })

  it('só select para authenticated e service_role em ab_test_restores (sem chamar)', async () => {
    const r = await q(`select has_table_privilege('authenticated','public.ab_test_restores','insert') as ins,
                              has_table_privilege('authenticated','public.ab_test_restores','select') as sel,
                              has_table_privilege('anon','public.ab_test_restores','select') as anon_sel`)
    expect(r[0]).toEqual({ ins: false, sel: true, anon_sel: false })
  })
})
