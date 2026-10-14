// @vitest-environment node
/**
 * A5 · E10, Tarefa 6: `exportarCanal`, `baixarMiniaturas`/`criarBaixar` e a sessão de leitura. Banco, disco e rede são falsos
 * (`arquivo-fakes.ts`); o que se prova é a ORDEM dos passos e o que NÃO acontece quando um passo recusa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { exportarCanal, FRASES_DO_EXPORT, ultimoDiaDoMes, caminhoDaMiniatura } from '@/lib/youtube/observatorio/arquivo/exportar'
import { baixarMiniaturas, criarBaixar } from '@/lib/youtube/observatorio/arquivo/miniaturas'
import { INSTRUCOES_DA_LEITURA, consultaDoArquivo, abrirLeitura } from '@/lib/youtube/observatorio/arquivo/sessao'
import { validarManifesto, type Manifesto } from '@/lib/youtube/observatorio/arquivo/manifesto'
import { lerCsv } from '@/lib/youtube/observatorio/arquivo/csv'
import { FRASES_E10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { SITE, CANAL, LOTE, RAIZ, PASTA, AGORA, bancoFalso, discoFalso, baixarFalso, tabelasPadrao, sha, type OpcoesDoBanco } from './arquivo-fakes'

const URL_A = 'https://blob.example.test/observatorio/thumbs/v1/capa-a.jpg'
const URL_B = 'https://blob.example.test/observatorio/thumbs/v2/capa-b.jpg'
const URL_C = 'https://blob.example.test/observatorio/thumbs/v3/capa-c.jpg'
const TRES = [{ url: URL_A, video: 'yt1' }, { url: URL_B, video: 'yt2' }, { url: URL_C, video: 'yt3' }]

function montar(banco: OpcoesDoBanco = {}, extra: { repositorio?: boolean; respostas?: Record<string, number | 'lanca'>; inicial?: Record<string, string> } = {}) {
  const b = bancoFalso(banco)
  const d = discoFalso(extra.inicial ?? {}, { repositorio: extra.repositorio })
  const r = baixarFalso(extra.respostas)
  const exportar = (o: Partial<Parameters<typeof exportarCanal>[0]> = {}) => exportarCanal({
    sql: b.sql, disco: d.disco, baixar: r.baixar, pastaRaiz: RAIZ, lote: LOTE, siteId: SITE, canalId: CANAL,
    aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => AGORA, versaoDoScript: 'obs-arquivo teste', ...o,
  })
  return { b, d, r, exportar }
}
const manifestoGravado = (d: ReturnType<typeof montar>['d']): Manifesto => {
  const v = validarManifesto(JSON.parse(Buffer.from(d.arquivos.get(`${PASTA}/manifesto.json`)!).toString('utf8')))
  if (!('valor' in v)) throw new Error(v.porque)
  return v.valor
}
const instrucoesDe = (chamadas: { texto: string }[]): string[] => chamadas.map(c => c.texto)

describe('A5 E10 T6: exportarCanal, recusas', () => {
  it('lote por idade é recusado, sem nenhuma consulta', async () => {
    const m = montar()
    const r = await m.exportar({ porIdade: true })
    expect(r).toMatchObject({ ok: false, codigo: 'lote_por_idade_e_da_manutencao' })
    expect(m.b.chamadas).toHaveLength(0)
    expect(m.d.eventos).toEqual([])
  })

  it('nome de lote fora de ^[a-z0-9][a-z0-9-]{2,60}$ é recusado', async () => {
    for (const lote of ['Maiuscula', 'com/barra', 'ab', '-comeca', 'a'.repeat(62), '../fora']) {
      const m = montar()
      expect(await m.exportar({ lote }), lote).toMatchObject({ ok: false, codigo: 'lote_invalido' })
      expect(m.b.chamadas).toHaveLength(0)
    }
  })

  it('canal não pausado: recusa sem criar a pasta e desfaz a leitura', async () => {
    const m = montar({ semPausa: true })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'nao_pausado', frase: FRASES_E10.nao_pausado })
    expect(m.d.eventos).toEqual([])
    expect(instrucoesDe(m.b.chamadas).at(-1)).toBe('rollback')
  })

  it('canal de outro site: canal_nao_encontrado, nada escrito', async () => {
    const m = montar({ outroSite: true })
    expect(await m.exportar({ siteId: '00000000-0000-4000-8000-000000000000' })).toMatchObject({ ok: false, codigo: 'canal_nao_encontrado' })
    expect(m.d.eventos).toEqual([])
    // e o filtro de site vai na própria consulta do canal
    const q = m.b.chamadas.find(c => /from public\.competitor_channels c/.test(c.texto))!
    expect(q.texto).toContain('c.site_id = $2')
    expect(q.parametros.slice(0, 2)).toEqual([CANAL, '00000000-0000-4000-8000-000000000000'])
  })

  it('pausa de 2 minutos: recusa antes de criar a pasta e antes de baixar qualquer coisa', async () => {
    const m = montar({ pausaRecente: true, urls: TRES })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'pausa_recente' })
    expect(m.d.eventos).toEqual([])
    expect(m.r.chamadas).toEqual([])
    // a espera que o banco confere vem de RULES (o mesmo número do corpo da função)
    const q = m.b.chamadas.find(c => /from public\.competitor_channels c/.test(c.texto))!
    expect(q.parametros[2]).toBe(RULES.pause.minMinutesBeforeExport)
  })

  it('sincronização recente: sincronizando, sem criar a pasta', async () => {
    const m = montar({ sincronizando: true })
    expect(await m.exportar()).toMatchObject({ ok: false, codigo: 'sincronizando' })
    expect(m.d.eventos).toEqual([])
  })

  it('tabela sem export: recusa com o nome da tabela', async () => {
    const m = montar({ naoCobertas: ['competitor_x'] })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'tabela_sem_export', detalhe: ['competitor_x'] })
    expect(m.d.eventos).toEqual([])
  })

  it('pasta dentro de repositório git: recusa antes de qualquer consulta', async () => {
    const m = montar({}, { repositorio: true })
    expect(await m.exportar()).toMatchObject({ ok: false, codigo: 'pasta_em_repositorio' })
    expect(m.b.chamadas).toHaveLength(0)
  })

  it('pasta não vazia sem --refazer: recusa; com --refazer e sem manifesto legível: recusa e não apaga nada', async () => {
    const a = montar({}, { inicial: { [`${PASTA}/qualquer.txt`]: 'x' } })
    expect(await a.exportar()).toMatchObject({ ok: false, codigo: 'pasta_nao_vazia' })
    const b = montar({}, { inicial: { [`${PASTA}/qualquer.txt`]: 'x' } })
    expect(await b.exportar({ refazer: true })).toMatchObject({ ok: false, codigo: 'pasta_sem_manifesto' })
    expect(b.d.eventos.filter(e => e.startsWith('apagar'))).toEqual([])
    expect(b.d.arquivos.has(`${PASTA}/qualquer.txt`)).toBe(true)
    const c = montar({}, { inicial: { [`${PASTA}/manifesto.json`]: '{ não é json', [`${PASTA}/outro.txt`]: 'y' } })
    expect(await c.exportar({ refazer: true })).toMatchObject({ ok: false, codigo: 'pasta_sem_manifesto' })
    expect(c.d.eventos.filter(e => e.startsWith('apagar'))).toEqual([])
  })
})

describe('A5 E10 T6: exportarCanal, o caminho feliz', () => {
  it('exporta: um CSV.gz por tabela e mês, tabela sem linha e tabela ausente no manifesto, manifesto por último', async () => {
    const m = montar({ urls: TRES })
    const r = await m.exportar()
    expect(r).toEqual({ ok: true, lote: LOTE, arquivos: 4, linhas: 1 + 3 + 1 + 2, miniaturas: 3, miniaturasAusentes: 0 })
    const man = manifestoGravado(m.d)
    expect(man.arquivos.map(a => `${a.tabela} ${a.periodo}`)).toEqual([
      'competitor_channels unico', 'competitor_videos unico', 'competitor_video_daily 2026-08', 'competitor_video_daily 2026-09',
    ])
    expect(man.tabelasSemLinha).toEqual(['competitor_readings'])
    expect(man.tabelasAusentes).toEqual(['competitor_video_marks'])
    expect(man.excluidas).toEqual([{ tabela: 'competitor_video_comment_authors', motivo: 'identidade do autor' }])
    expect(man.canal).toEqual({ id: CANAL, youtubeId: 'UCsintetico', nome: 'Canal, "sintético"' })
    expect(man.geradoEm).toBe(AGORA.toISOString())
    expect(Object.keys(man.esquema).sort()).toEqual(['competitor_channels', 'competitor_video_daily', 'competitor_videos'])
    expect(man.esquema.competitor_videos).toContain('"title" text')
    // nenhum arquivo de tabela sem linha nem ausente
    expect([...m.d.arquivos.keys()].some(k => k.includes('competitor_readings') || k.includes('competitor_video_marks'))).toBe(false)
    // o manifesto é o ÚLTIMO e o .sha256 o segue
    const gravacoes = m.d.eventos.filter(e => e.startsWith('gravar '))
    expect(gravacoes.slice(-2)).toEqual([`gravar ${PASTA}/manifesto.json`, `gravar ${PASTA}/manifesto.sha256`])
    // 1 canal, 3 vídeos, 1 linha de série em agosto e 2 em setembro
    expect(man.arquivos.map(a => a.linhas)).toEqual([1, 3, 1, 2])
  })

  it('o CSV gravado volta byte a byte: nulo, texto vazio, vírgula, aspas; sha256 do CSV e do gzip conferem', async () => {
    const m = montar()
    await m.exportar()
    const man = manifestoGravado(m.d)
    const v = man.arquivos.find(a => a.tabela === 'competitor_videos')!
    const gz = m.d.arquivos.get(`${PASTA}/${v.caminho}`)!
    expect(sha(gz)).toBe(v.sha256)
    const csv = gunzipSync(Buffer.from(gz))
    expect(sha(csv)).toBe(v.csvSha256)
    expect(lerCsv(csv.toString('utf8'))).toEqual({ colunas: ['id', 'title'], linhas: [['v1', 'um'], ['v2', ''], ['v3', null]] })
    const c = man.arquivos.find(a => a.tabela === 'competitor_channels')!
    expect(lerCsv(gunzipSync(Buffer.from(m.d.arquivos.get(`${PASTA}/${c.caminho}`)!)).toString('utf8')).linhas).toEqual([[CANAL, 'Canal, "sintético"']])
    // soma como texto, sem perder o bigint acima de 2^53
    const d = man.arquivos.find(a => a.periodo === '2026-09')!
    expect(d.soma).toBe('9007199254741000') // 9007199254740993 + 7: passa de 2^53 e sai inteira, como texto
    expect(d.periodStart).toBe('2026-09-01')
    expect(d.periodEnd).toBe('2026-09-30')
    expect([d.menorChave, d.maiorChave]).toEqual(['v1|2026-09-01', 'v2|2026-09-02'])
  })

  function manifestoDe(m: ReturnType<typeof montar>): Manifesto { return manifestoGravado(m.d) }

  it('o registro recebe o p_rows do manifesto, no site e no canal certos', async () => {
    const m = montar({ urls: TRES })
    await m.exportar()
    const reg = m.b.chamadas.find(c => /obs_archive_register/.test(c.texto))!
    expect(reg.parametros.slice(0, 3)).toEqual([SITE, LOTE, CANAL])
    const rows = JSON.parse(reg.parametros[3] as string) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(manifestoDe(m).arquivos.length)
    expect(rows[0]).toMatchObject({ table_name: 'competitor_channels', period_start: '1970-01-01', row_count: 1 })
    // abre uma segunda transação, de escrita, depois de fechar a de leitura
    const ordem = instrucoesDe(m.b.chamadas)
    const iCommit = ordem.indexOf('commit')
    const iSegunda = ordem.lastIndexOf('begin')
    expect(iCommit).toBeGreaterThan(-1)
    expect(iSegunda).toBeGreaterThan(iCommit)
    expect(ordem.at(-1)).toBe('commit')
  })

  it('a sessão é fixada antes de qualquer leitura de dado', async () => {
    const m = montar()
    await m.exportar()
    const textos = instrucoesDe(m.b.chamadas)
    expect(textos.slice(0, INSTRUCOES_DA_LEITURA.length)).toEqual([...INSTRUCOES_DA_LEITURA])
    expect(INSTRUCOES_DA_LEITURA[0]).toBe('begin isolation level repeatable read read only')
    expect(INSTRUCOES_DA_LEITURA.join('\n')).toMatch(/time zone 'UTC'[\s\S]*extra_float_digits = 3[\s\S]*datestyle = 'ISO, YMD'[\s\S]*intervalstyle = 'postgres'[\s\S]*bytea_output = 'hex'[\s\S]*statement_timeout = '60s'/)
    const primeiroSelect = textos.findIndex(t => /^select/.test(t.trim()))
    expect(primeiroSelect).toBe(INSTRUCOES_DA_LEITURA.length)
  })

  it('mais de 5.000 linhas: o cursor é lido até o fim', async () => {
    const tabelas = tabelasPadrao()
    tabelas.competitor_videos!.linhas = Array.from({ length: 12_001 }, (_, i) => ({ id: `v${String(i).padStart(5, '0')}`, title: `t${i}` }))
    const m = montar({ tabelas })
    const r = await m.exportar()
    expect(r.ok).toBe(true)
    const a = manifestoGravado(m.d).arquivos.find(x => x.tabela === 'competitor_videos')!
    expect(a.linhas).toBe(12_001)
    expect(lerCsv(gunzipSync(Buffer.from(m.d.arquivos.get(`${PASTA}/${a.caminho}`)!)).toString('utf8')).linhas).toHaveLength(12_001)
    const busca = m.b.chamadas.filter(c => /^fetch forward 5000 from/.test(c.texto)).length
    expect(busca).toBeGreaterThanOrEqual(4) // 5.000 + 5.000 + 2.001 + o vazio (e as outras tabelas)
  })

  it('contagem do arquivo difere da do banco: para, sem manifesto', async () => {
    const b = montar()
    // o cursor devolve uma linha a menos que a contagem
    const original = b.b.sql.query.bind(b.b.sql)
    let tirou = false
    b.b.sql.query = async (t, p) => {
      const r = await original(t, p)
      if (!tirou && /^fetch forward/.test(t.trim()) && r.rows.length === 3) { tirou = true; return { rows: r.rows.slice(0, 2) } }
      return r
    }
    const r = await b.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'contagem_do_arquivo_difere' })
    expect(b.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(false)
    expect(instrucoesDe(b.b.chamadas).at(-1)).toBe('rollback')
    expect(b.b.chamadas.some(c => /obs_archive_register/.test(c.texto))).toBe(false)
  })

  it('erro do banco no meio: nenhum manifesto, rollback chamado, nenhuma mensagem do banco no resultado', async () => {
    let n = 0
    const m = montar({ falhaEm: t => (/^declare/.test(t.trim()) && ++n === 3 ? new Error('SEGREDO do banco') : null) })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'erro_do_banco', frase: FRASES_DO_EXPORT.erro_do_banco })
    expect(JSON.stringify(r)).not.toContain('SEGREDO')
    expect(m.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(false)
    expect(instrucoesDe(m.b.chamadas).at(-1)).toBe('rollback')
  })

  it('57014 (tempo esgotado) na leitura: a frase é a da leitura, sem a palavra remoção nem o comando remover (revisão Yannis 14/10, I1)', async () => {
    const m = montar({ falhaEm: t => (/^fetch forward/.test(t.trim()) ? Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' }) : null) })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'demorou_demais', frase: FRASES_DO_EXPORT.demorou_demais })
    if (r.ok) throw new Error('esperava recusa')
    expect(r.frase).not.toMatch(/remo[çc]/i)
    expect(r.frase).not.toContain('remover')
    expect(r.frase).toContain('Nada foi registrado')
    expect(JSON.stringify(r)).not.toContain('statement timeout')
    expect(m.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(false)
  })

  it('o registro recusa: os arquivos ficam e o resultado diz o código, com a frase do catálogo (nunca a do banco)', async () => {
    const m = montar({ erroDoRegistro: { message: 'E10:banco_difere_do_manifesto: competitor_video_daily 2026-09-01 banco=3 arquivo=2' } })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'banco_difere_do_manifesto', frase: FRASES_E10.banco_difere_do_manifesto })
    expect(JSON.stringify(r)).not.toContain('competitor_video_daily')
    expect(m.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(true) // os arquivos ficam no disco; o lote não existe no banco
    expect(instrucoesDe(m.b.chamadas).at(-1)).toBe('rollback')
  })
})

describe('A5 E10 T6: exportarCanal, miniaturas', () => {
  it('nenhuma miniatura é baixada com a transação aberta: o commit da leitura vem antes do primeiro download', async () => {
    const eventos: string[] = []
    const m = montar({ urls: TRES })
    const original = m.b.sql.query.bind(m.b.sql)
    m.b.sql.query = async (t, p) => { if (t.trim() === 'commit') eventos.push('commit'); return original(t, p) }
    const baixar = m.r.baixar
    const r = await exportarCanal({
      sql: m.b.sql, disco: m.d.disco, baixar: async u => { eventos.push('baixar'); return baixar(u) }, pastaRaiz: RAIZ, lote: LOTE, siteId: SITE, canalId: CANAL,
      aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => AGORA, versaoDoScript: 't',
    })
    expect(r.ok).toBe(true)
    expect(eventos.indexOf('commit')).toBe(0)
    expect(eventos.slice(1, 4)).toEqual(['baixar', 'baixar', 'baixar'])
  })

  it('grava as miniaturas em miniaturas/<video>/<arquivo> e registra bytes e sha256; blob_count e blob_bytes batem', async () => {
    const tabelas = tabelasPadrao()
    tabelas.competitor_video_versions = {
      colunas: [{ nome: 'id', tipo: 'bigint', nulo: false }], filtro: 't.video_id in (select 1)', periodo: 't.first_seen_at', soma: null, ordem: 't.id',
      mes: () => '2026-09-01', linhas: [{ id: '1' }, { id: '2' }],
    }
    const m = montar({ tabelas, urls: TRES })
    await m.exportar()
    const man = manifestoGravado(m.d)
    expect(man.miniaturas).toHaveLength(3)
    for (const mi of man.miniaturas) {
      expect(mi.caminho).toMatch(/^miniaturas\/yt[123]\/capa-[abc]\.jpg$/)
      const bytes = m.d.arquivos.get(`${PASTA}/${mi.caminho}`)!
      expect(mi.bytes).toBe(bytes.byteLength)
      expect(mi.sha256).toBe(sha(bytes))
      expect(mi.caminhoNoBlob).toMatch(/^observatorio\/thumbs\//)
    }
    const reg = m.b.chamadas.find(c => /obs_archive_register/.test(c.texto))!
    const rows = JSON.parse(reg.parametros[3] as string) as Array<{ table_name: string; blob_count: number | null; blob_bytes: number | null; blob_missing: number | null }>
    const versoes = rows.filter(x => x.table_name === 'competitor_video_versions')
    expect(versoes).toHaveLength(1)
    expect(versoes[0]).toMatchObject({ blob_count: 3, blob_missing: 0 })
    expect(versoes[0]!.blob_bytes).toBe(man.miniaturas.reduce((s, x) => s + (x.bytes ?? 0), 0))
    expect(rows.filter(x => x.table_name !== 'competitor_video_versions').every(x => x.blob_count === null && x.blob_bytes === null && x.blob_missing === null)).toBe(true)
  })

  it('miniatura 404 sem a opção para com "1 miniatura ausente"; com a opção segue e o manifesto marca a ausente', async () => {
    const sem = montar({ urls: TRES }, { respostas: { [URL_B]: 404 } })
    const r1 = await sem.exportar()
    expect(r1).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes', detalhe: ['1 miniatura(s) ausente(s)'] })
    expect(sem.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(false)
    const com = montar({ urls: TRES }, { respostas: { [URL_B]: 404 } })
    const r2 = await com.exportar({ aceitarMiniaturasAusentes: true })
    expect(r2).toMatchObject({ ok: true, miniaturas: 2, miniaturasAusentes: 1 })
    const ausente = manifestoGravado(com.d).miniaturas.find(x => x.url === URL_B)!
    expect(ausente).toMatchObject({ ausente: true, caminho: null, bytes: null, sha256: null })
    const sha256sum = Buffer.from(com.d.arquivos.get(`${PASTA}/manifesto.sha256`)!).toString('utf8')
    expect(sha256sum).not.toContain('capa-b') // miniatura ausente não entra no sha256
    expect(sha256sum).toContain('capa-a')
  })

  it.each([[500], [429], [403], [0], ['lanca' as const]])('miniatura com resposta %s: três tentativas, para, nenhum manifesto', async estado => {
    const m = montar({ urls: TRES }, { respostas: { [URL_B]: estado } })
    const r = await m.exportar()
    expect(r).toMatchObject({ ok: false, codigo: 'miniaturas_nao_baixaram' })
    expect(m.r.chamadas.filter(u => u === URL_B)).toHaveLength(3)
    expect(m.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(false)
    expect(m.b.chamadas.some(c => /obs_archive_register/.test(c.texto))).toBe(false)
  })
})

describe('A5 E10 T6: --refazer', () => {
  it('refazer apaga SÓ o que o manifesto anterior lista, depois das recusas do banco, e exporta de novo', async () => {
    const m = montar({ urls: [] })
    await m.exportar()
    const antes = new Set(m.d.arquivos.keys())
    m.d.arquivos.set(`${PASTA}/anotacao-do-dono.txt`, Buffer.from('meu texto'))
    m.d.eventos.length = 0
    const r = await m.exportar({ refazer: true })
    expect(r.ok).toBe(true)
    expect(m.d.arquivos.has(`${PASTA}/anotacao-do-dono.txt`)).toBe(true)
    const apagados = m.d.eventos.filter(e => e.startsWith('apagar ')).map(e => e.slice(7))
    expect(apagados).not.toContain(`${PASTA}/anotacao-do-dono.txt`)
    expect(apagados.sort()).toEqual([...antes].sort())
  })

  it('refazer com o canal não pausado: recusa e o export antigo continua inteiro', async () => {
    const m = montar({ urls: [] })
    await m.exportar()
    const antes = new Set(m.d.arquivos.keys())
    const n = montar({ semPausa: true })
    for (const [k, v] of m.d.arquivos) n.d.arquivos.set(k, v)
    const r = await n.exportar({ refazer: true })
    expect(r).toMatchObject({ ok: false, codigo: 'nao_pausado' })
    expect(new Set(n.d.arquivos.keys())).toEqual(antes)
  })
})

describe('A5 E10: exportarCanal, recusa depois de criar a pasta não envenena o nome (revisão Yannis 14/10, I2)', () => {
  const arquivosDe = (d: ReturnType<typeof montar>['d']): string[] => [...d.arquivos.keys()].sort()

  it('404 sem a opção e depois com a opção na MESMA pasta termina ok', async () => {
    const m = montar({ urls: TRES }, { respostas: { [URL_B]: 404 } })
    const r1 = await m.exportar()
    expect(r1).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes' })
    expect(arquivosDe(m.d)).toEqual([]) // nada do que a execução gravou ficou
    const r2 = await m.exportar({ aceitarMiniaturasAusentes: true })
    expect(r2).toMatchObject({ ok: true, miniaturas: 2, miniaturasAusentes: 1 })
  })

  it('404 sem a opção e depois com --refazer e a opção na MESMA pasta também termina ok', async () => {
    const m = montar({ urls: TRES }, { respostas: { [URL_B]: 404 } })
    expect(await m.exportar()).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes' })
    expect(await m.exportar({ refazer: true, aceitarMiniaturasAusentes: true })).toMatchObject({ ok: true, miniaturasAusentes: 1 })
  })

  it('--refazer que falha no passo 7 não deixa lixo, e repetir com a opção termina ok', async () => {
    const respostas: Record<string, number | 'lanca'> = {}
    const m = montar({ urls: TRES }, { respostas })
    await m.exportar()
    respostas[URL_B] = 404
    expect(await m.exportar({ refazer: true })).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes' })
    expect(arquivosDe(m.d)).toEqual([]) // o lote antigo saiu pelo --refazer (dívida M2) e o novo, incompleto, foi limpo
    expect(await m.exportar({ refazer: true, aceitarMiniaturasAusentes: true })).toMatchObject({ ok: true, miniaturasAusentes: 1 })
  })

  it('a limpeza apaga SÓ o que esta execução gravou: o arquivo do dono na pasta continua', async () => {
    const respostas: Record<string, number | 'lanca'> = {}
    const m = montar({ urls: TRES }, { respostas })
    await m.exportar()
    m.d.arquivos.set(`${PASTA}/anotacao-do-dono.txt`, Buffer.from('meu texto'))
    respostas[URL_B] = 404
    expect(await m.exportar({ refazer: true })).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes' })
    expect(arquivosDe(m.d)).toEqual([`${PASTA}/anotacao-do-dono.txt`])
    const gravados = m.d.eventos.filter(e => e.startsWith('gravar ')).map(e => e.slice(7))
    const apagados = m.d.eventos.filter(e => e.startsWith('apagar ')).map(e => e.slice(7))
    expect(apagados).not.toContain(`${PASTA}/anotacao-do-dono.txt`)
    expect(gravados).not.toContain(`${PASTA}/anotacao-do-dono.txt`)
  })

  it('contagem_do_arquivo_difere, miniaturas_nao_baixaram e erro do banco no passo 5 também limpam o que foi gravado', async () => {
    // contagem difere no SEGUNDO arquivo: o primeiro já foi gravado e tem de sair
    const a = montar()
    const original = a.b.sql.query.bind(a.b.sql)
    let n = 0
    a.b.sql.query = async (t, p) => {
      const r = await original(t, p)
      if (/^fetch forward/.test(t.trim()) && r.rows.length === 3 && ++n === 1) return { rows: r.rows.slice(0, 2) }
      return r
    }
    expect(await a.exportar()).toMatchObject({ ok: false, codigo: 'contagem_do_arquivo_difere' })
    expect(arquivosDe(a.d)).toEqual([])
    // miniatura que não baixa: os CSV.gz já gravados saem
    const b = montar({ urls: TRES }, { respostas: { [URL_B]: 500 } })
    expect(await b.exportar()).toMatchObject({ ok: false, codigo: 'miniaturas_nao_baixaram' })
    expect(arquivosDe(b.d)).toEqual([])
    // erro do banco no meio do passo 5
    let k = 0
    const c = montar({ falhaEm: t => (/^declare/.test(t.trim()) && ++k === 3 ? new Error('SEGREDO do banco') : null) })
    expect(await c.exportar()).toMatchObject({ ok: false, codigo: 'erro_do_banco' })
    expect(arquivosDe(c.d)).toEqual([])
    // e as miniaturas já gravadas quando a segunda falha (200, 200 e 404 sem a opção: não grava; 200 e depois lança: nada fica)
    const e = montar({ urls: TRES }, { respostas: { [URL_C]: 404 } })
    expect(await e.exportar()).toMatchObject({ ok: false, codigo: 'miniaturas_ausentes' })
    expect(arquivosDe(e.d)).toEqual([])
  })

  it('o registro recusa no passo 9: os arquivos e o manifesto ficam (a limpeza é só antes do manifesto)', async () => {
    const m = montar({ erroDoRegistro: { message: 'E10:banco_difere_do_manifesto: x' } })
    expect(await m.exportar()).toMatchObject({ ok: false, codigo: 'banco_difere_do_manifesto' })
    expect(m.d.arquivos.has(`${PASTA}/manifesto.json`)).toBe(true)
  })
})

describe('A5 E10 T6: miniaturas.ts e sessao.ts', () => {
  it('baixarMiniaturas: ordem das URLs, até 4 ao mesmo tempo, 3 tentativas só para o que pode ser passageiro', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://blob.example.test/${i}.jpg`)
    let ativos = 0, pico = 0
    const tentativas = new Map<string, number>()
    const baixar = async (u: string) => {
      ativos++; pico = Math.max(pico, ativos)
      tentativas.set(u, (tentativas.get(u) ?? 0) + 1)
      await new Promise(r => setTimeout(r, 2))
      ativos--
      if (u.endsWith('/3.jpg')) return { status: 404, corpo: null }
      if (u.endsWith('/5.jpg')) return { status: 500, corpo: null }
      if (u.endsWith('/7.jpg') && (tentativas.get(u) ?? 0) < 3) return { status: 429, corpo: null }
      return { status: 200, corpo: new Uint8Array([1]) }
    }
    const r = await baixarMiniaturas(urls, { baixar, paralelo: 4, tentativas: 3 })
    expect(r.map(x => x.url)).toEqual(urls)
    expect(pico).toBeLessThanOrEqual(4)
    expect(tentativas.get(urls[3]!)).toBe(1) // 404 é resposta final
    expect(tentativas.get(urls[5]!)).toBe(3)
    expect(r[5]!.status).toBe(500)
    expect(r[7]!.status).toBe(200) // deu certo na terceira
    expect(r[0]!.corpo).toEqual(new Uint8Array([1]))
    expect(r[3]!.corpo).toBeNull()
    expect(await baixarMiniaturas([], { baixar, paralelo: 4, tentativas: 3 })).toEqual([])
  })

  it('criarBaixar: 200 devolve os bytes; outro status, erro e prazo viram status sem corpo', async () => {
    const ok = criarBaixar(async () => ({ status: 200, arrayBuffer: async () => new Uint8Array([9, 8]).buffer }))
    expect(await ok('u')).toEqual({ status: 200, corpo: new Uint8Array([9, 8]) })
    expect(await criarBaixar(async () => ({ status: 404, arrayBuffer: async () => new ArrayBuffer(0) }))('u')).toEqual({ status: 404, corpo: null })
    expect(await criarBaixar(async () => { throw new Error('rede') })('u')).toEqual({ status: 0, corpo: null })
    let sinal: AbortSignal | undefined
    await criarBaixar(async (_u, init) => { sinal = init.signal; return { status: 200, arrayBuffer: async () => new ArrayBuffer(0) } }, 15_000)('u')
    expect(sinal).toBeInstanceOf(AbortSignal)
  })

  it('consultaDoArquivo: select por coluna como texto, filtro do canal, mês opcional e ordem', () => {
    const q = consultaDoArquivo({ tabela: 'competitor_video_daily', filtro: 't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)', periodo: 't.snap_date', ordem: 't.video_id, t.snap_date', colunas: ['video_id', 'snap_date'] })
    expect(q).toBe(`select t."video_id"::text as "video_id", t."snap_date"::text as "snap_date" from public."competitor_video_daily" t where t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1) and date_trunc('month', (t.snap_date)::timestamp)::date = $2::date order by t.video_id, t.snap_date`)
    const u = consultaDoArquivo({ tabela: 'competitor_channels', filtro: 't.id = $1', periodo: null, ordem: 't.id', colunas: ['id'] })
    expect(u).not.toContain('$2')
    expect(() => consultaDoArquivo({ tabela: 'x; drop table y', filtro: 'true', periodo: null, ordem: 't.id', colunas: ['id'] })).toThrow()
    expect(() => consultaDoArquivo({ tabela: 'competitor_channels', filtro: 'true', periodo: null, ordem: 't.id', colunas: [] })).toThrow()
    // aspas dentro de um nome de coluna são dobradas
    expect(consultaDoArquivo({ tabela: 'a', filtro: 'true', periodo: null, ordem: 't.id', colunas: ['a"b'] })).toContain('t."a""b"::text as "a""b"')
  })

  it('abrirLeitura emite o begin e a sessão fixada, nesta ordem, e mais nada', async () => {
    const b = bancoFalso()
    await abrirLeitura(b.sql)
    expect(instrucoesDe(b.chamadas)).toEqual([...INSTRUCOES_DA_LEITURA])
  })

  it('ultimoDiaDoMes e caminhoDaMiniatura (único dentro do lote, nome seguro)', () => {
    expect(ultimoDiaDoMes('2026-02-01')).toBe('2026-02-28')
    expect(ultimoDiaDoMes('2024-02-01')).toBe('2024-02-29')
    expect(ultimoDiaDoMes('2026-12-01')).toBe('2026-12-31')
    const usados = new Set<string>()
    expect(caminhoDaMiniatura('https://x.test/a/b/capa.jpg', 'yt1', usados)).toBe('miniaturas/yt1/capa.jpg')
    expect(caminhoDaMiniatura('https://y.test/z/capa.jpg', 'yt1', usados)).toBe('miniaturas/yt1/capa.jpg-2')
    expect(caminhoDaMiniatura('https://x.test/a/../../etc?x=1', 'a/b', usados)).toMatch(/^miniaturas\/a_b\/[A-Za-z0-9._-]+$/)
    expect(caminhoDaMiniatura('não é url', '..', usados)).toBe('miniaturas/video/miniatura')
  })

  it('os módulos do comando só importam de node: e de caminho relativo', () => {
    for (const f of ['sessao', 'miniaturas', 'exportar', 'conferir']) {
      const src = readFileSync(join(__dirname, `../../../src/lib/youtube/observatorio/arquivo/${f}.ts`), 'utf8')
      for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1]!.startsWith('node:') || m[1]!.startsWith('.'), `${f}: ${m[1]}`).toBe(true)
    }
  })
})
