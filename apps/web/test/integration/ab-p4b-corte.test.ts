import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
import { faseNovaTentativa } from '@/lib/youtube/ab-watchdog-nova-tentativa'

// P4b T6 (P4b-I4): o SQL do corte do deploy e o da volta, provados no bythiago_int. O arquivo de migration real nasce
// só no envio; aqui o corpo é lido de fixtures/ e executado com `pg`.
const DIR = join(__dirname, 'fixtures')
const sql = (nome: string) => readFileSync(join(DIR, nome), 'utf8')
const HORA = 3_600_000
const iso = (d: number) => new Date(Date.now() + d).toISOString()
const ERRO = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
const campo = (extra: Record<string, unknown> = {}) => ({ estado: 'falhou', destino: 'original', em: iso(-HORA), forcado: true, escreveu: false, erro: ERRO, attempts: 1, ...extra })
const OK = campo({ estado: 'ok', erro: null })
const ok = () => OK

// O SQL real varre a tabela toda; no banco compartilhado isso atropelaria os testes que rodam em paralelo (T3). O
// executor injeta só o filtro por id (ids = os semeados aqui) e confere que o ponto de injeção existe no arquivo.
const ALVO = 'where t.restore_status is not null'
const semeados: string[] = []
async function rodar(arquivo: string): Promise<void> {
  const texto = sql(arquivo)
  if (!texto.includes(ALVO)) throw new Error('ponto de injeção ausente no SQL')
  const escopo = texto.replace(ALVO, `where t.id in (${semeados.map((i) => `'${i}'`).join(',')}) and t.restore_status is not null`)
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL })
  await c.connect()
  try { await c.query(escopo) } finally { await c.end() }
}

describe.skipIf(skipIfNoLocalDb())('P4b T6: corte do falhou anterior ao deploy', () => {
  const db = clienteServico()

  async function semear(restoreStatus: unknown, seq = 1) {
    const t = await semearTesteAb({ status: 'active', cicloAberto: null, testType: 'combo' })
    const r = await db.from('ab_tests').update({ status: 'completed', restore_seq: seq, restore_status: restoreStatus }).eq('id', t.testId)
    if (r.error) throw new Error(`semear: ${r.error.message}`)
    semeados.push(t.testId)
    return t
  }
  const ler = async (id: string) => (await db.from('ab_tests').select('status, restore_seq, restore_status').eq('id', id).single()).data!
  const linhas = async (id: string) => (await db.from('ab_test_restores').select('seq, campo, estado').eq('test_id', id).order('seq')).data ?? []

  it('title falhou e thumbnail ok → title desistiu/antes_da_nova_tentativa, resto intacto, seq + 1, linha nova no histórico', async () => {
    const t = await semear({ title: campo({ attempts: 2 }), thumbnail: ok() })
    const antes = await ler(t.testId)
    await rodar('ab-p4b-corte.sql')
    const depois = await ler(t.testId)
    const rs = depois.restore_status as Record<string, Record<string, unknown>>
    const ant = antes.restore_status as Record<string, Record<string, unknown>>
    expect(rs.title).toEqual({ ...ant.title, estado: 'desistiu', motivo: 'antes_da_nova_tentativa' })
    expect(rs.thumbnail).toEqual(ant.thumbnail)
    expect(depois.restore_seq).toBe(antes.restore_seq + 1)
    const l = await linhas(t.testId)
    expect(l.at(-1)).toMatchObject({ seq: 2, campo: 'title', estado: 'desistiu' })
  })

  it('restore_status null, {} e só ok → não mudam (restore_seq igual)', async () => {
    const a = await semear(null)
    const b = await semear({})
    const c = await semear({ title: ok() })
    await rodar('ab-p4b-corte.sql')
    for (const t of [a, b, c]) expect((await ler(t.testId)).restore_seq).toBe(1)
    expect((await ler(c.testId)).restore_status).toEqual({ title: ok() })
  })

  it('rodar duas vezes → a segunda não muda nada', async () => {
    const t = await semear({ title: campo() })
    await rodar('ab-p4b-corte.sql')
    const um = await ler(t.testId)
    expect(um.restore_seq).toBe(2)
    await rodar('ab-p4b-corte.sql')
    expect(await ler(t.testId)).toEqual(um)
  })

  it('depois do corte, faseNovaTentativa não tenta o campo convertido (P4b-I4)', async () => {
    const t = await semear({ title: campo() })
    await rodar('ab-p4b-corte.sql')
    expect((await ler(t.testId)).restore_status).toMatchObject({ title: { estado: 'desistiu' } })
    let chamadas = 0
    const r = await faseNovaTentativa(db, { inicio: Date.now(), agora: () => Date.now() }, fetch, 4, {
      tentar: async (id) => { if (id === t.testId) chamadas++; return { resultado: 'ja_encerrado' } as never },
    })
    expect(chamadas).toBe(0)
    expect(r).toBeDefined()
  })

  it('corte, volta: o restore_status fica igual ao de antes (exceto restore_seq)', async () => {
    const t = await semear({ title: campo({ attempts: 2 }), thumbnail: campo({ destino: 'abc' }) })
    const antes = await ler(t.testId)
    await rodar('ab-p4b-corte.sql')
    await rodar('ab-p4b-corte-volta.sql')
    const depois = await ler(t.testId)
    expect(depois.restore_status).toEqual(antes.restore_status)
    expect(depois.restore_seq).toBe(antes.restore_seq + 2)
    await rodar('ab-p4b-corte-volta.sql') // idempotente
    expect((await ler(t.testId)).restore_seq).toBe(antes.restore_seq + 2)
  })

  it('teste com um campo em_andamento: o corte não toca a linha (S1)', async () => {
    const t = await semear({ title: campo(), thumbnail: campo({ estado: 'em_andamento', erro: null }) })
    const antes = await ler(t.testId)
    await rodar('ab-p4b-corte.sql')
    expect(await ler(t.testId)).toEqual(antes)
  })
})
