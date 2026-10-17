import { describe, it, expect, beforeEach } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'

// `semearTesteAb` cria site, vídeo, duas variantes (A original, B) e o ciclo 0 aberto.
// Nenhuma função é chamada como anon/authenticated (SIGSEGV do Postgres local): permissão só por has_function_privilege.
const FN = {
  claim: 'public.ab_settle_claim(uuid,int,text[],text,text,jsonb,jsonb)',
  rotate: 'public.ab_rotate_commit(uuid,int,uuid,int,jsonb,int,int)',
  resume: 'public.ab_resume_commit(uuid,int,text,uuid,jsonb)',
}

// Fixture única do resultado de um campo restaurado com sucesso.
const OK = { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: '2026-10-12T08:02:00Z', attempts: 0 }
const andamento = (destino: string) => ({ ...OK, estado: 'em_andamento', escreveu: null, destino, em: new Date().toISOString() })

describe.skipIf(skipIfNoLocalDb())('migration da P4a', () => {
  let t: { testId: string; varA: string; varB: string }
  beforeEach(async () => { t = await semearTesteAb({ status: 'active', cicloAberto: 0 }) })

  it('rotate_cycle não existe mais', async () => {
    const r = await q<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'rotate_cycle'")
    expect(r[0]!.n).toBe(0)
  })

  it('só service_role executa as três funções; anon e authenticated não; PUBLIC não; search_path vazio (sem chamar)', async () => {
    for (const fn of Object.values(FN)) {
      const r = await q<{ r: string; ok: boolean }>(`select r, has_function_privilege(r, $1::regprocedure, 'execute') as ok from unnest(array['anon','authenticated','service_role']) as r`, [fn])
      expect(Object.fromEntries(r.map(x => [x.r, x.ok])), fn).toEqual({ anon: false, authenticated: false, service_role: true })
      const publico = await q<{ n: number }>(`select count(*)::int as n from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = $1::regprocedure and a.grantee = 0`, [fn])
      expect(publico[0]!.n, `PUBLIC em ${fn}`).toBe(0)
      const cfg = await q<{ proconfig: string[] }>(`select proconfig from pg_proc where oid = $1::regprocedure`, [fn])
      expect(String(cfg[0]!.proconfig)).toMatch(/search_path=""/)
    }
  })

  it('ab_rotate_commit com restore_seq trocado devolve nulo e não abre ciclo', async () => {
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 99, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    expect(r.data).toBeNull()
    const c = await clienteServico().from('ab_test_cycles').select('id').eq('test_id', t.testId)
    expect(c.data).toHaveLength(1)
  })

  it('ab_rotate_commit em teste completed devolve nulo (o buraco de rotate_cycle)', async () => {
    await clienteServico().from('ab_tests').update({ status: 'completed' }).eq('id', t.testId)
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    expect(r.data).toBeNull()
  })

  it('ab_rotate_commit certo: fecha com rotacao, grava views/likes, abre o seguinte, limpa marcador e falhas', async () => {
    await clienteServico().from('ab_tests').update({ last_applied_variant_id: t.varB, config: { consecutive_failures: 2 } }).eq('id', t.testId)
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {}, p_views: 10, p_likes: 1 })
    expect(r.error).toBeNull()
    expect(r.data).toBeTruthy()
    const c = await clienteServico().from('ab_test_cycles').select('cycle_number, ended_at, end_reason, views').eq('test_id', t.testId).order('cycle_number')
    expect(c.data?.[0]).toMatchObject({ end_reason: 'rotacao', views: 10 })
    expect(c.data?.[1]).toMatchObject({ cycle_number: 1, ended_at: null })
    const x = await clienteServico().from('ab_tests').select('last_applied_variant_id, config').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ last_applied_variant_id: null, config: { consecutive_failures: 0 } })
  })

  it('T8 r1 (Phil DEVE-2): ab_rotate_commit limpa a nota da rotação (nova tentativa / cota / antigas) e preserva outra nota', async () => {
    const s = clienteServico()
    for (const nota of ['nova tentativa 2/3: sem permissão', 'cota do YouTube esgotada hoje; a rotação tenta de novo amanhã', 'retry 1/3', 'auto-paused after 3']) {
      await s.from('ab_tests').update({ status_note: nota, restore_seq: 0 }).eq('id', t.testId)
      const r = await s.rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
      expect(r.error).toBeNull()
      const x = await s.from('ab_tests').select('status_note').eq('id', t.testId).single()
      expect(x.data?.status_note, nota).toBeNull()
      await s.from('ab_test_cycles').delete().eq('test_id', t.testId).neq('cycle_number', 0)
      await s.from('ab_test_cycles').update({ ended_at: null, end_reason: null }).eq('test_id', t.testId)
    }
    await s.from('ab_tests').update({ status_note: 'drift: título mudou' }).eq('id', t.testId)
    await s.rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    const y = await s.from('ab_tests').select('status_note').eq('id', t.testId).single()
    expect(y.data?.status_note).toBe('drift: título mudou')
  })

  it('T8 r1 (decisão 1): ab_settle_claim com limpar_carencia zera grace_expires_at; sem a chave preserva', async () => {
    const s = clienteServico()
    const futuro = new Date(Date.now() + 86_400_000).toISOString()
    await s.from('ab_tests').update({ grace_expires_at: futuro }).eq('id', t.testId)
    const sem = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'paused', p_end_reason: null, p_restore_status: {}, p_extra: {} })
    expect(sem.error).toBeNull()
    expect((await s.from('ab_tests').select('grace_expires_at').eq('id', t.testId).single()).data?.grace_expires_at).not.toBeNull()
    const com = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 1, p_de: ['paused'], p_para: 'completed', p_end_reason: null, p_restore_status: {}, p_extra: { limpar_carencia: true, status_note: null } })
    expect(com.error).toBeNull()
    expect((await s.from('ab_tests').select('grace_expires_at, status_note').eq('id', t.testId).single()).data).toMatchObject({ grace_expires_at: null, status_note: null })
  })

  it('F-D7: ciclo 0 fechado, 1 aberto e 2 aberto (auto-pausa antiga + retomar); p_cycle_number = 2 → fecha os dois abertos e abre o 3, sem erro', async () => {
    const s = clienteServico()
    await s.from('ab_test_cycles').update({ ended_at: new Date().toISOString() }).eq('test_id', t.testId).eq('cycle_number', 0)
    await s.from('ab_test_cycles').insert([
      { test_id: t.testId, variant_id: t.varB, cycle_number: 1, started_at: new Date(Date.now() - 86_400_000).toISOString() },
      { test_id: t.testId, variant_id: t.varA, cycle_number: 2, started_at: new Date().toISOString() },
    ])
    const r = await s.rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 2, p_applied_metadata: {} })
    expect(r.error).toBeNull(); expect(r.data).toBeTruthy()
    const c = (await s.from('ab_test_cycles').select('cycle_number, ended_at').eq('test_id', t.testId).order('cycle_number')).data!
    expect(c.map(x => x.cycle_number)).toEqual([0, 1, 2, 3])
    expect(c.filter(x => x.ended_at === null).map(x => x.cycle_number)).toEqual([3])
  })

  it('F-P4: sem poll (p_views nulo) não sobrescreve views/likes do ciclo com nulo', async () => {
    await clienteServico().from('ab_test_cycles').update({ views: 7, likes: 2 }).eq('test_id', t.testId)
    await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    const c = await clienteServico().from('ab_test_cycles').select('views, likes').eq('test_id', t.testId).eq('cycle_number', 0).single()
    expect(c.data).toMatchObject({ views: 7, likes: 2 })
  })

  it('ab_settle_claim: muda estado, grava em_andamento, fecha ciclo com end_reason e ended_at = paused_at', async () => {
    const rs = { title: andamento('original') }
    const r = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: rs, p_extra: { status_note: null } })
    expect(r.error).toBeNull()
    expect(r.data?.[0]?.claimed_seq).toBe(1)
    const x = await clienteServico().from('ab_tests').select('status, paused_at, restore_seq, restore_status').eq('id', t.testId).single()
    const c = await clienteServico().from('ab_test_cycles').select('ended_at, end_reason').eq('test_id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'paused', restore_seq: 1 })
    expect(c.data?.end_reason).toBe('pausa')
    expect(new Date(c.data!.ended_at).getTime()).toBe(new Date(x.data!.paused_at).getTime())
  })

  it('ab_settle_claim com seq velho ou estado fora de p_de: zero linhas, nada muda', async () => {
    const r1 = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 7, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: {}, p_extra: {} })
    const r2 = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['paused'], p_para: 'completed', p_end_reason: 'encerrado', p_restore_status: {}, p_extra: {} })
    expect(r1.data).toEqual([]); expect(r2.data).toEqual([])
    const x = await clienteServico().from('ab_tests').select('status, restore_seq').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'active', restore_seq: 0 })
  })

  it('de = para (reverter, vigia): p_end_reason nulo não fecha ciclo', async () => {
    await clienteServico().from('ab_tests').update({ status: 'completed' }).eq('id', t.testId)
    const r = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['completed'], p_para: 'completed', p_end_reason: null, p_restore_status: {}, p_extra: {} })
    expect(r.data?.[0]?.claimed_seq).toBe(1)
    const c = await clienteServico().from('ab_test_cycles').select('ended_at').eq('test_id', t.testId).single()
    expect(c.data?.ended_at).toBeNull()
  })

  it('Y-D4: ab_resume_commit certo (paused): active, {}, falhas zeradas, paused_at nulo, um ciclo aberto max+1', async () => {
    const s = clienteServico()
    await s.from('ab_test_cycles').update({ ended_at: new Date().toISOString(), end_reason: 'pausa' }).eq('test_id', t.testId)
    await s.from('ab_tests').update({ status: 'paused', restore_seq: 3, paused_at: new Date().toISOString(), config: { consecutive_failures: 3 }, restore_status: { title: andamento(t.varB) } }).eq('id', t.testId)
    const r = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 3, p_de: 'paused', p_variant_id: t.varB, p_applied_metadata: {} })
    expect(r.error).toBeNull()
    expect(r.data).toBeTruthy()
    const x = (await s.from('ab_tests').select('status, restore_status, paused_at, config').eq('id', t.testId).single()).data!
    expect(x).toMatchObject({ status: 'active', restore_status: {}, paused_at: null, config: { consecutive_failures: 0 } })
    const c = (await s.from('ab_test_cycles').select('cycle_number, ended_at').eq('test_id', t.testId).order('cycle_number')).data!
    expect(c.filter(y => y.ended_at === null)).toEqual([{ cycle_number: 1, ended_at: null }])
  })

  it('Y-D4: ab_resume_commit perde a vez (seq trocado ou estado fora de p_de) → nulo, nenhum ciclo novo, nada muda', async () => {
    const s = clienteServico()
    await s.from('ab_tests').update({ status: 'completed', restore_seq: 4 }).eq('id', t.testId)
    const a = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 3, p_de: 'paused', p_variant_id: t.varB, p_applied_metadata: {} })
    const b = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 4, p_de: 'paused', p_variant_id: t.varB, p_applied_metadata: {} })
    expect(a.data).toBeNull(); expect(b.data).toBeNull()
    expect((await s.from('ab_test_cycles').select('id').eq('test_id', t.testId)).data).toHaveLength(1)
    expect((await s.from('ab_tests').select('status').eq('id', t.testId).single()).data?.status).toBe('completed')
  })

  it('início: ab_resume_commit com p_de = active abre o ciclo 0 e grava {} (F-P3)', async () => {
    const s = clienteServico()
    await s.from('ab_test_cycles').delete().eq('test_id', t.testId)
    await s.from('ab_tests').update({ restore_seq: 1, restore_status: null }).eq('id', t.testId)
    const r = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 1, p_de: 'active', p_variant_id: t.varA, p_applied_metadata: {} })
    expect(r.error).toBeNull()
    expect(r.data).toBeTruthy()
    expect((await s.from('ab_tests').select('restore_status').eq('id', t.testId).single()).data?.restore_status).toEqual({})
    expect((await s.from('ab_test_cycles').select('cycle_number').eq('test_id', t.testId)).data).toEqual([{ cycle_number: 0 }])
  })

  it('R1: ciclo aberto de hoje + paused → ab_resume_commit fecha o antigo e deixa um ciclo aberto só', async () => {
    const s = clienteServico()
    await s.from('ab_test_cycles').delete().eq('test_id', t.testId)
    await s.from('ab_test_cycles').insert({ test_id: t.testId, variant_id: t.varA, cycle_number: 0, started_at: new Date().toISOString() })
    await s.from('ab_tests').update({ status: 'paused', restore_seq: 5 }).eq('id', t.testId)
    const r = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 5, p_de: 'paused', p_variant_id: t.varB, p_applied_metadata: {} })
    expect(r.error).toBeNull()
    const abertos = (await s.from('ab_test_cycles').select('cycle_number').eq('test_id', t.testId).is('ended_at', null)).data
    expect(abertos).toEqual([{ cycle_number: 1 }])
  })

  it('R1 (Phil DEVE 1): ciclo aberto há 3 dias, teste pausado há 2 → retomar fecha o antigo em paused_at com end_reason pausa (não em now)', async () => {
    const s = clienteServico()
    const DIA = 86_400_000
    const pausadoEm = new Date(Date.now() - 2 * DIA).toISOString()
    await s.from('ab_test_cycles').delete().eq('test_id', t.testId)
    await s.from('ab_test_cycles').insert({ test_id: t.testId, variant_id: t.varA, cycle_number: 0, started_at: new Date(Date.now() - 3 * DIA).toISOString() })
    await s.from('ab_tests').update({ status: 'paused', restore_seq: 5, paused_at: pausadoEm }).eq('id', t.testId)
    const r = await s.rpc('ab_resume_commit', { p_test_id: t.testId, p_seq: 5, p_de: 'paused', p_variant_id: t.varB, p_applied_metadata: {} })
    expect(r.error).toBeNull()
    const c0 = (await s.from('ab_test_cycles').select('ended_at, end_reason').eq('test_id', t.testId).eq('cycle_number', 0).single()).data!
    expect(new Date(c0.ended_at).getTime()).toBe(new Date(pausadoEm).getTime())
    expect(c0.end_reason).toBe('pausa')
  })

  it('Phil R1-1: ab_rotate_commit repetido com o mesmo seq devolve o mesmo ciclo e deixa um aberto só', async () => {
    const s = clienteServico()
    const args = { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: { x: 1 } }
    const a = await s.rpc('ab_rotate_commit', args)
    const b = await s.rpc('ab_rotate_commit', args)
    expect(a.error).toBeNull(); expect(b.error).toBeNull()
    expect(a.data).toBeTruthy()
    expect(b.data).toBe(a.data)
    const c = (await s.from('ab_test_cycles').select('cycle_number, ended_at, applied_metadata').eq('test_id', t.testId).order('cycle_number')).data!
    expect(c).toHaveLength(2)
    expect(c.filter(x => x.ended_at === null).map(x => x.cycle_number)).toEqual([1])
    expect(c[1]!.applied_metadata).toMatchObject({ x: 1, _rotate: 0 })
  })

  it('Phil R1-1: retry com p_cycle_number diferente e o mesmo seq devolve o mesmo ciclo e deixa um só', async () => {
    const s = clienteServico()
    const base = { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_applied_metadata: {} }
    const a = await s.rpc('ab_rotate_commit', { ...base, p_cycle_number: 1 })
    const b = await s.rpc('ab_rotate_commit', { ...base, p_cycle_number: 7 })
    expect(a.error).toBeNull(); expect(b.error).toBeNull()
    expect(b.data).toBe(a.data)
    const c = (await s.from('ab_test_cycles').select('cycle_number, ended_at').eq('test_id', t.testId).order('cycle_number')).data!
    expect(c.map(x => x.cycle_number)).toEqual([0, 1])
    expect(c.filter(x => x.ended_at === null)).toHaveLength(1)
  })

  it('Phil R1-1: rotações legítimas (restore_seq avança entre as chamadas) abrem ciclo novo; seq velho depois devolve nulo', async () => {
    const s = clienteServico()
    const base = { p_test_id: t.testId, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} }
    await s.rpc('ab_rotate_commit', { ...base, p_seq: 0 })
    await s.from('ab_tests').update({ restore_seq: 1 }).eq('id', t.testId)
    const r = await s.rpc('ab_rotate_commit', { ...base, p_seq: 1 })
    expect(r.error).toBeNull()
    expect(r.data).toBeTruthy()
    const velho = await s.rpc('ab_rotate_commit', { ...base, p_seq: 0 })
    expect(velho.error).toBeNull()
    expect(velho.data).toBeNull()
    const c = (await s.from('ab_test_cycles').select('cycle_number, ended_at, applied_metadata').eq('test_id', t.testId).order('cycle_number')).data!
    expect(c.map(x => x.cycle_number)).toEqual([0, 1, 2])
    expect(c.filter(x => x.ended_at === null).map(x => x.cycle_number)).toEqual([2])
    expect(c[2]!.applied_metadata).toMatchObject({ _rotate: 1 })
  })

  // Phil DEVE 3: os p_extra da tabela 3.1 (encerrado, duracao_maxima, drift, falha_api).
  it.each([
    { nome: 'encerrado', de: 'active', para: 'completed', reason: 'encerrado', extra: { completed_reason: 'manual_winner', limpar_confianca: true } },
    { nome: 'duracao_maxima', de: 'active', para: 'completed', reason: 'duracao_maxima', extra: { completed_reason: 'max_duration' } },
    { nome: 'drift', de: 'active', para: 'paused', reason: 'pausa', extra: { limpar_drift_ack: true, status_note: 'drift' } },
    { nome: 'falha_api (paused -> paused)', de: 'paused', para: 'paused', reason: 'falha_api', extra: { consecutive_failures: 3 } },
  ])('ab_settle_claim p_extra: $nome grava as colunas certas', async ({ de, para, reason, extra }) => {
    const s = clienteServico()
    const antes = new Date(Date.now() - 86_400_000).toISOString()
    await s.from('ab_tests').update({
      status: de, paused_at: de === 'paused' ? antes : null,
      confidence_at_completion: 0.9, drift_acknowledged_at: antes, config: { consecutive_failures: 1 },
    }).eq('id', t.testId)
    const ex = para === 'completed' && extra.completed_reason === 'manual_winner' ? { ...extra, winner_variant_id: t.varB } : extra
    const r = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: [de], p_para: para, p_end_reason: reason, p_restore_status: {}, p_extra: ex })
    expect(r.error).toBeNull()
    expect(r.data?.[0]?.claimed_seq).toBe(1)
    const x = (await s.from('ab_tests').select('status, paused_at, completed_at, completed_reason, winner_variant_id, confidence_at_completion, drift_acknowledged_at, status_note, config').eq('id', t.testId).single()).data!
    expect(x.status).toBe(para)
    if (para === 'completed') {
      expect(x.completed_at).not.toBeNull()
      expect(x.completed_reason).toBe((extra as { completed_reason: string }).completed_reason)
      expect(x.winner_variant_id).toBe('winner_variant_id' in ex ? t.varB : null)
      if ('limpar_confianca' in extra) expect(x.confidence_at_completion).toBeNull()
      else expect(x.confidence_at_completion).toBe(0.9)
    }
    if ('limpar_drift_ack' in extra) { expect(x.drift_acknowledged_at).toBeNull(); expect(x.status_note).toBe('drift') }
    else expect(x.drift_acknowledged_at).not.toBeNull()
    if ('consecutive_failures' in extra) expect(x.config).toMatchObject({ consecutive_failures: 3 })
    else expect(x.config).toMatchObject({ consecutive_failures: 1 })
    if (de === 'paused') expect(new Date(x.paused_at).getTime()).toBe(new Date(antes).getTime())   // paused -> paused não muda paused_at
    const c = (await s.from('ab_test_cycles').select('end_reason').eq('test_id', t.testId).single()).data!
    expect(c.end_reason).toBe(reason)
  })

  it('histórico: claim não grava linha; o passo 4 com o seq reivindicado grava as duas do combo', async () => {
    const s = clienteServico()
    const em = { title: andamento('original'), thumbnail: andamento('original') }
    await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: em, p_extra: {} })
    expect((await s.from('ab_test_restores').select('id').eq('test_id', t.testId)).data).toHaveLength(0)
    await s.from('ab_tests').update({ restore_status: { title: OK, thumbnail: OK } }).eq('id', t.testId).eq('restore_seq', 1)
    expect((await s.from('ab_test_restores').select('seq, campo').eq('test_id', t.testId)).data).toHaveLength(2)
  })

  it('F-B2: retomar que falha regrava o valor anterior → a contagem de ab_test_restores continua a mesma', async () => {
    const s = clienteServico()
    await s.from('ab_tests').update({ status: 'paused', restore_seq: 1, restore_status: { title: OK, thumbnail: OK } }).eq('id', t.testId)
    expect((await s.from('ab_test_restores').select('id').eq('test_id', t.testId)).data).toHaveLength(2)   // seq 1
    const a = andamento(t.varB)
    await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 1, p_de: ['paused'], p_para: 'paused', p_end_reason: null, p_restore_status: { title: a, thumbnail: a }, p_extra: {} })   // seq 2
    await s.from('ab_tests').update({ restore_status: { title: OK, thumbnail: OK } }).eq('id', t.testId).eq('restore_seq', 2)   // a falha regrava o anterior
    expect((await s.from('ab_test_restores').select('id').eq('test_id', t.testId)).data).toHaveLength(2)
    // Phil DEVE 2: lado "não engole": resultado novo (em diferente) com seq novo GRAVA (2 campos x seq 1 e 2).
    await s.from('ab_tests').update({ restore_seq: 3, restore_status: { title: a, thumbnail: a } }).eq('id', t.testId)
    await s.from('ab_tests').update({ restore_status: { title: { ...OK, em: '2026-10-13T08:03:00Z' }, thumbnail: { ...OK, em: '2026-10-13T08:03:00Z' } } }).eq('id', t.testId).eq('restore_seq', 3)
    const h = (await s.from('ab_test_restores').select('seq, campo').eq('test_id', t.testId)).data!
    expect(h).toHaveLength(4)
    expect(h.filter(x => x.seq === 3)).toHaveLength(2)
  })
})
