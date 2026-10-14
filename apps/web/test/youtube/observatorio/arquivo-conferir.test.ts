// @vitest-environment node
/**
 * A5 · E10, Tarefa 6: `conferirLote`. Exporta com os falsos de `arquivo-fakes.ts` e estraga UMA coisa por vez. Em toda falha,
 * `obs_archive_verify` nunca é chamada (nada é marcado) e nenhuma mensagem do banco aparece.
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { exportarCanal } from '@/lib/youtube/observatorio/arquivo/exportar'
import { conferirLote, FRASES_DA_CONFERENCIA, LIMITE_DE_DIFERENCAS } from '@/lib/youtube/observatorio/arquivo/conferir'
import { validarManifesto, textoDoSha256, type Manifesto } from '@/lib/youtube/observatorio/arquivo/manifesto'
import { FRASES_E10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { SITE, CANAL, LOTE, RAIZ, PASTA, AGORA, bancoFalso, discoFalso, baixarFalso, sha, type OpcoesDoBanco } from './arquivo-fakes'

const URLS = [
  { url: 'https://blob.example.test/observatorio/thumbs/v1/capa-a.jpg', video: 'yt1' },
  { url: 'https://blob.example.test/observatorio/thumbs/v2/capa-b.jpg', video: 'yt2' },
]

async function exportado(banco: OpcoesDoBanco = {}) {
  const b = bancoFalso({ urls: URLS, ...banco })
  const d = discoFalso()
  const r = baixarFalso()
  const e = await exportarCanal({
    sql: b.sql, disco: d.disco, baixar: r.baixar, pastaRaiz: RAIZ, lote: LOTE, siteId: SITE, canalId: CANAL,
    aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => AGORA, versaoDoScript: 't',
  })
  if (!e.ok) throw new Error('a preparação do teste falhou: ' + e.codigo)
  b.chamadas.length = 0
  const conferir = (o: { canalId?: string; lote?: string; siteId?: string } = {}) =>
    conferirLote({ sql: b.sql, disco: d.disco, pastaRaiz: RAIZ, lote: LOTE, siteId: SITE, canalId: CANAL, ...o })
  const verificou = (): boolean => b.chamadas.some(c => /obs_archive_verify/.test(c.texto))
  return { b, d, conferir, verificou }
}
type Prep = Awaited<ReturnType<typeof exportado>>

/** Reescreve o manifesto e o .sha256 de forma CONSISTENTE: só a parte (b) e (c) podem pegar o que mudou. */
function reescrever(p: Prep, mudar: (m: Manifesto) => void): void {
  const v = validarManifesto(JSON.parse(Buffer.from(p.d.arquivos.get(`${PASTA}/manifesto.json`)!).toString('utf8')))
  if (!('valor' in v)) throw new Error(v.porque)
  mudar(v.valor)
  const json = Buffer.from(JSON.stringify(v.valor, null, 2) + '\n')
  p.d.arquivos.set(`${PASTA}/manifesto.json`, json)
  p.d.arquivos.set(`${PASTA}/manifesto.sha256`, Buffer.from(textoDoSha256(v.valor, sha(json))))
}
const caminhoDoDaily = (p: Prep, mes: string): string => {
  const v = validarManifesto(JSON.parse(Buffer.from(p.d.arquivos.get(`${PASTA}/manifesto.json`)!).toString('utf8')))
  if (!('valor' in v)) throw new Error(v.porque)
  return v.valor.arquivos.find(a => a.tabela === 'competitor_video_daily' && a.periodo === mes)!.caminho
}

describe('A5 E10 T6: conferirLote', () => {
  it('tudo igual: ok, e só então obs_archive_verify, com o site, o lote e o canal', async () => {
    const p = await exportado()
    const r = await p.conferir()
    expect(r).toEqual({ ok: true, arquivos: 4, miniaturas: 2 })
    const v = p.b.chamadas.filter(c => /obs_archive_verify/.test(c.texto))
    expect(v).toHaveLength(1)
    expect(v[0]!.parametros).toEqual([SITE, LOTE, CANAL])
    // a leitura usa a mesma sessão fixada do export e termina desfeita; o carimbo vem numa transação de escrita, depois
    const textos = p.b.chamadas.map(c => c.texto)
    expect(textos[0]).toBe('begin isolation level repeatable read read only')
    expect(textos.indexOf('rollback')).toBeLessThan(textos.findIndex(t => /obs_archive_verify/.test(t)))
    expect(textos.at(-1)).toBe('commit')
  })

  it('conferir sem manifesto: sem_manifesto, sem tocar o banco', async () => {
    const b = bancoFalso()
    const d = discoFalso({ [`${PASTA}/qualquer.txt`]: 'x' })
    const r = await conferirLote({ sql: b.sql, disco: d.disco, pastaRaiz: RAIZ, lote: LOTE, siteId: SITE, canalId: CANAL })
    expect(r).toMatchObject({ ok: false, codigo: 'sem_manifesto', frase: FRASES_DA_CONFERENCIA.sem_manifesto })
    expect(b.chamadas).toHaveLength(0)
  })

  it('manifesto ilegível ou fora da forma: manifesto_invalido', async () => {
    const p = await exportado()
    p.d.arquivos.set(`${PASTA}/manifesto.json`, Buffer.from('{ isto não é json'))
    expect(await p.conferir()).toMatchObject({ ok: false, codigo: 'manifesto_invalido' })
    const q = await exportado()
    q.d.arquivos.set(`${PASTA}/manifesto.json`, Buffer.from(JSON.stringify({ versao: 9 })))
    expect(await q.conferir()).toMatchObject({ ok: false, codigo: 'manifesto_invalido' })
    expect(p.verificou() || q.verificou()).toBe(false)
  })

  it('manifesto de outro canal, de outro site ou de outro nome de exportação', async () => {
    const p = await exportado()
    expect(await p.conferir({ canalId: '0a1b2c3d-1111-4222-8333-000000000000' })).toMatchObject({ ok: false, codigo: 'manifesto_de_outro_canal' })
    expect(await p.conferir({ siteId: '00000000-0000-4000-8000-000000000000' })).toMatchObject({ ok: false, codigo: 'manifesto_de_outro_canal' })
    expect(await p.conferir({ lote: 'outro-nome' })).toMatchObject({ ok: false })
    expect(p.verificou()).toBe(false)
  })

  it('um byte trocado numa miniatura: sha256_diferente com o caminho; obs_archive_verify não é chamada', async () => {
    const p = await exportado()
    const caminho = [...p.d.arquivos.keys()].find(k => k.includes('/miniaturas/'))!
    const bytes = Buffer.from(p.d.arquivos.get(caminho)!)
    bytes[0] = bytes[0]! ^ 0xff
    p.d.arquivos.set(caminho, bytes)
    const r = await p.conferir()
    expect(r).toMatchObject({ ok: false, codigo: 'sha256_diferente' })
    if (!r.ok) expect(r.diferencas).toEqual([caminho.slice(PASTA.length + 1)])
    expect(p.verificou()).toBe(false)
    expect(p.b.chamadas.some(c => /^declare/.test(c.texto.trim()))).toBe(false) // parou na primeira classe: nem leu o banco
  })

  it('arquivo a mais na pasta, arquivo faltando e sha256 do gzip diferente: uma classe de cada vez, cada uma nomeada', async () => {
    const a = await exportado()
    a.d.arquivos.set(`${PASTA}/intruso.txt`, Buffer.from('x'))
    const ra = await a.conferir()
    expect(ra).toMatchObject({ ok: false, codigo: 'arquivo_sobrando' })
    if (!ra.ok) expect(ra.diferencas).toEqual(['intruso.txt'])

    const b = await exportado()
    const faltando = caminhoDoDaily(b, '2026-08')
    b.d.arquivos.delete(`${PASTA}/${faltando}`)
    const rb = await b.conferir()
    expect(rb).toMatchObject({ ok: false, codigo: 'arquivo_faltando' })
    if (!rb.ok) expect(rb.diferencas).toEqual([faltando])

    const c = await exportado()
    const gz = Buffer.from(c.d.arquivos.get(`${PASTA}/${caminhoDoDaily(c, '2026-09')}`)!)
    gz[gz.length - 1] = gz[gz.length - 1]! ^ 0x01
    c.d.arquivos.set(`${PASTA}/${caminhoDoDaily(c, '2026-09')}`, gz)
    expect(await c.conferir()).toMatchObject({ ok: false, codigo: 'sha256_diferente' })
    for (const p of [a, b, c]) expect(p.verificou()).toBe(false)
  })

  it('manifesto.sha256 que não diz o mesmo que o manifesto: recusado', async () => {
    const p = await exportado()
    const antigo = Buffer.from(p.d.arquivos.get(`${PASTA}/manifesto.sha256`)!).toString('utf8').split('\n')
    p.d.arquivos.set(`${PASTA}/manifesto.sha256`, Buffer.from(antigo.slice(1).join('\n')))
    const r = await p.conferir()
    expect(r.ok).toBe(false)
    expect(p.verificou()).toBe(false)
  })

  it('registro a menos e soma diferente (manifesto consistente, conteúdo não): csv_diferente, nomeando o arquivo', async () => {
    const a = await exportado()
    reescrever(a, m => { m.arquivos.find(x => x.tabela === 'competitor_videos')!.linhas += 1 })
    const ra = await a.conferir()
    expect(ra).toMatchObject({ ok: false, codigo: 'csv_diferente' })
    if (!ra.ok) expect(ra.diferencas.join()).toMatch(/competitor_videos\/.*: 3 registro\(s\) no arquivo, 4 no manifesto/)

    const b = await exportado()
    reescrever(b, m => { m.arquivos.find(x => x.tabela === 'competitor_video_daily' && x.periodo === '2026-09')!.soma = '1' })
    const rb = await b.conferir()
    expect(rb).toMatchObject({ ok: false, codigo: 'csv_diferente' })
    if (!rb.ok) expect(rb.diferencas.join()).toContain('soma 9007199254741000 no arquivo, 1 no manifesto')

    const c = await exportado()
    reescrever(c, m => { m.arquivos[1]!.colunas = [{ nome: 'outra', tipo: 'text', nulo: true }, ...m.arquivos[1]!.colunas.slice(1)] })
    const rc = await c.conferir()
    expect(rc).toMatchObject({ ok: false, codigo: 'csv_diferente' })
    if (!rc.ok) expect(rc.diferencas.join()).toContain('cabeçalho')
    for (const p of [a, b, c]) expect(p.verificou()).toBe(false)
  })

  it('CSV trocado por outro com o mesmo manifesto consistente (csvSha256 do manifesto manda): csv_diferente', async () => {
    const p = await exportado()
    const caminho = `${PASTA}/${caminhoDoDaily(p, '2026-08')}`
    const novo = gzipSync(Buffer.from('video_id,snap_date,views\nv1,2026-08-30,999\n'))
    p.d.arquivos.set(caminho, novo)
    reescrever(p, m => { m.arquivos.find(x => x.periodo === '2026-08')!.sha256 = sha(novo) })
    const r = await p.conferir()
    expect(r).toMatchObject({ ok: false, codigo: 'csv_diferente' })
    if (!r.ok) expect(r.diferencas.join()).toContain('o conteúdo mudou')
    expect(p.verificou()).toBe(false)
  })

  it('o banco mudou depois do export: banco_mudou com a tabela e o mês; nada marcado', async () => {
    const p = await exportado()
    p.b.tabelas.competitor_video_daily!.linhas.push({ video_id: 'v3', snap_date: '2026-09-03', views: '5' })
    const r = await p.conferir()
    expect(r).toMatchObject({ ok: false, codigo: 'banco_mudou', frase: FRASES_DA_CONFERENCIA.banco_mudou })
    if (!r.ok) expect(r.diferencas.join()).toContain('competitor_video_daily 2026-09')
    expect(p.verificou()).toBe(false)
    // uma linha a mais numa tabela de arquivo único também é pega
    const q = await exportado()
    q.b.tabelas.competitor_videos!.linhas.push({ id: 'v9', title: 'novo' })
    const rq = await q.conferir()
    expect(rq).toMatchObject({ ok: false, codigo: 'banco_mudou' })
    if (!rq.ok) expect(rq.diferencas.join()).toContain('competitor_videos arquivo único')
    // e uma linha MUDADA (mesma contagem) também: o que vale é o sha256 do CSV
    const s = await exportado()
    s.b.tabelas.competitor_videos!.linhas[0]!.title = 'mudou'
    expect(await s.conferir()).toMatchObject({ ok: false, codigo: 'banco_mudou' })
  })

  it('miniatura nova no banco que o manifesto não tem, e miniatura do manifesto que sumiu do banco', async () => {
    const p = await exportado()
    // o falso devolve a lista `urls` capturada na criação: troca a consulta
    const original = p.b.sql.query.bind(p.b.sql)
    p.b.sql.query = async (t, v) => (/from public\.competitor_video_versions x join/.test(t) ? { rows: [...URLS, { url: 'https://blob.example.test/observatorio/thumbs/v9/nova.jpg', video: 'yt9' }] } : original(t, v))
    expect(await p.conferir()).toMatchObject({ ok: false, codigo: 'miniaturas_diferentes' })
    const q = await exportado()
    const o2 = q.b.sql.query.bind(q.b.sql)
    q.b.sql.query = async (t, v) => (/from public\.competitor_video_versions x join/.test(t) ? { rows: [URLS[0]!] } : o2(t, v))
    expect(await q.conferir()).toMatchObject({ ok: false, codigo: 'miniaturas_diferentes' })
    expect(p.verificou() || q.verificou()).toBe(false)
  })

  it('erro do banco na conferência: erro_do_banco, sem a mensagem do banco, nada marcado', async () => {
    const p = await exportado()
    const original = p.b.sql.query.bind(p.b.sql)
    p.b.sql.query = async (t, v) => { if (/^declare/.test(t.trim())) throw new Error('SEGREDO do banco'); return original(t, v) }
    const r = await p.conferir()
    expect(r).toMatchObject({ ok: false, codigo: 'erro_do_banco' })
    expect(JSON.stringify(r)).not.toContain('SEGREDO')
    expect(p.verificou()).toBe(false)
  })

  it('o banco recusa o carimbo: o código do catálogo, nunca a mensagem; rollback da transação de escrita', async () => {
    const p = await exportado({ erroDaVerificacao: { message: 'E10:despausado_depois_do_export: SEGREDO' } })
    const r = await p.conferir()
    expect(r).toMatchObject({ ok: false, codigo: 'despausado_depois_do_export', frase: FRASES_E10.despausado_depois_do_export })
    expect(JSON.stringify(r)).not.toContain('SEGREDO')
    expect(p.b.chamadas.at(-1)!.texto).toBe('rollback')
  })

  it(`lista no máximo ${LIMITE_DE_DIFERENCAS} diferenças`, async () => {
    const p = await exportado()
    for (let i = 0; i < 25; i++) p.d.arquivos.set(`${PASTA}/sobra-${i}.txt`, Buffer.from('x'))
    const r = await p.conferir()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.diferencas).toHaveLength(LIMITE_DE_DIFERENCAS)
  })

  it('conferir nunca grava no disco', async () => {
    const p = await exportado()
    p.d.eventos.length = 0
    await p.conferir()
    expect(p.d.eventos).toEqual([])
  })
})
