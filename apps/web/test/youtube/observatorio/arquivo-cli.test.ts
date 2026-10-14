// @vitest-environment node
/**
 * A5 · E10, Tarefa 7: o comando (`arquivo/cli.ts`): `interpretar` (puro) e `rodar` (banco, disco, relógio e terminal falsos).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretar, rodar, pastaPadrao, USO, type Comando, type DepsDoComando } from '@/lib/youtube/observatorio/arquivo/cli'
import { FRASES_E10, type CodigoE10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import type { ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { SITE, CANAL, LOTE, AGORA, bancoFalso, discoFalso, baixarFalso, tabelasPadrao, type TabelaFalsa } from './arquivo-fakes'

const URL_DO_BANCO = 'postgresql://postgres:SENHA-SECRETA-123@db.example.test:5432/postgres'
const ENV = { OBS_ARQUIVO_DB_URL: URL_DO_BANCO, HOME: '/home/dono' }
const EMAIL = 'dono@example.test'
const USUARIO = '11111111-2222-4333-8444-555555555555'
const argv = (s: string): string[] => s.split(' ').filter(Boolean)
const cmd = (s: string, env: NodeJS.ProcessEnv = ENV): Comando => {
  const c = interpretar(argv(s), env)
  if ('erro' in c) throw new Error(c.erro)
  return c
}

type Rota = [RegExp, (parametros: unknown[]) => Array<Record<string, unknown>> | Error]
function roteirizado(rotas: Rota[]) {
  const chamadas: Array<{ texto: string; parametros: unknown[] }> = []
  const sql: ClienteSql = {
    async query(texto, parametros = []) {
      chamadas.push({ texto, parametros })
      for (const [re, f] of rotas) {
        if (re.test(texto)) {
          const r = f(parametros)
          if (r instanceof Error) throw r
          return { rows: r }
        }
      }
      if (/^\s*(begin|commit|rollback|set local)/i.test(texto)) return { rows: [] }
      throw new Error('consulta sem rota: ' + texto.slice(0, 80))
    },
  }
  return { sql, chamadas, textos: () => chamadas.map(c => c.texto.trim()) }
}
const rotaSite: Rota = [/select distinct site_id/, () => [{ site_id: SITE }]]
const rotaUsuario: Rota = [/from auth\.users/, () => [{ id: USUARIO }]]
const rotaAdmin = (ok: boolean): Rota => [/obs_archive_is_site_admin/, () => [{ ok }]]
const dinheiro = (o: Partial<DepsDoComando> = {}): DepsDoComando => ({
  sql: null, disco: discoFalso().disco, baixar: baixarFalso().baixar, agora: () => AGORA, ehTerminal: true,
  perguntar: async () => '', versaoDoScript: 'teste', ...o,
})
const tudo = (s: { saida: string[] }): string => s.saida.join('\n')

describe('A5 E10 T7: interpretar', () => {
  it('variável ausente: erro (código 2 no script) e nenhuma leitura de .env.local', () => {
    const antes = process.env.OBS_ARQUIVO_DB_URL
    delete process.env.OBS_ARQUIVO_DB_URL // o teste que APAGA a variável: sem ela, nada de padrão escondido
    try {
      const r = interpretar(argv(`estado`), process.env)
      expect('erro' in r && r.erro).toContain('OBS_ARQUIVO_DB_URL')
      const e = interpretar(argv(`exportar --canal ${CANAL}`), {})
      expect('erro' in e).toBe(true)
    } finally {
      if (antes !== undefined) process.env.OBS_ARQUIVO_DB_URL = antes
    }
    const src = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/arquivo/cli.ts'), 'utf8')
    expect(src).not.toMatch(/readFile|dotenv|node:fs|process\.env/) // o ambiente chega por parâmetro; nenhum arquivo é lido
  })

  it('variável vazia ou só espaços: erro', () => {
    expect('erro' in interpretar(argv('estado'), { OBS_ARQUIVO_DB_URL: '' })).toBe(true)
    expect('erro' in interpretar(argv('estado'), { OBS_ARQUIVO_DB_URL: '   ' })).toBe(true)
  })

  it('os dois subcomandos que só imprimem não pedem a variável', () => {
    expect('erro' in interpretar(argv(`comandos-nas --lote ${LOTE} --destino u@nas:/vol/arquivo`), { HOME: '/h' })).toBe(false)
    expect('erro' in interpretar(argv(`comandos-recarga --lote ${LOTE} --pasta /x`), {})).toBe(false)
  })

  it('sem argumento: o uso; subcomando desconhecido; opção desconhecida; opção sem valor', () => {
    expect(interpretar([], ENV)).toEqual({ erro: USO.join('\n') })
    expect('erro' in interpretar(['voar'], ENV)).toBe(true)
    expect((interpretar(['voar'], ENV) as { erro: string }).erro).toContain('subcomando desconhecido: voar')
    expect('erro' in interpretar(argv(`estado --nada x`), ENV)).toBe(true)
    expect('erro' in interpretar(argv(`pausar --canal ${CANAL} --por`), ENV)).toBe(true)
    expect('erro' in interpretar(argv(`pausar --canal ${CANAL}`), ENV)).toBe(true) // falta --por
  })

  it('--canal que não é uuid, --site que não é uuid, --por que não é e-mail', () => {
    expect((interpretar(argv(`exportar --canal 123`), ENV) as { erro: string }).erro).toContain('--canal')
    expect((interpretar(argv(`estado --site abc`), ENV) as { erro: string }).erro).toContain('--site')
    expect((interpretar(argv(`pausar --canal ${CANAL} --por sem-arroba`), ENV) as { erro: string }).erro).toContain('--por')
  })

  it('--lote com maiúscula ou barra é recusado; nome certo passa', () => {
    for (const ruim of ['Maiuscula', 'com/barra', '../fora', 'ab', 'a b']) {
      expect('erro' in interpretar(['conferir', '--canal', CANAL, '--lote', ruim], ENV), ruim).toBe(true)
    }
    expect(cmd(`conferir --canal ${CANAL} --lote ${LOTE}`)).toMatchObject({ nome: 'conferir', lote: LOTE })
  })

  it('raiz padrão quando --pasta falta (com HOME injetado); sem HOME e sem --pasta, erro', () => {
    expect(cmd(`exportar --canal ${CANAL}`, { ...ENV, HOME: '/home/dono/' })).toMatchObject({ pasta: '/home/dono/Workspace/arquivo-observatorio', lote: null })
    expect(cmd(`exportar --canal ${CANAL} --pasta /outra`)).toMatchObject({ pasta: '/outra' })
    expect(pastaPadrao({})).toBeNull()
    expect('erro' in interpretar(argv(`exportar --canal ${CANAL}`), { OBS_ARQUIVO_DB_URL: URL_DO_BANCO })).toBe(true)
  })

  it('as bandeiras do exportar', () => {
    expect(cmd(`exportar --canal ${CANAL} --refazer --aceitar-miniaturas-ausentes`)).toMatchObject({ refazer: true, aceitarMiniaturasAusentes: true })
    expect(cmd(`exportar --canal ${CANAL}`)).toMatchObject({ refazer: false, aceitarMiniaturasAusentes: false })
  })

  it('--destino precisa ser usuario@host:/caminho', () => {
    expect('erro' in interpretar(argv(`comandos-nas --lote ${LOTE} --destino nas-sem-caminho`), ENV)).toBe(true)
    expect('erro' in interpretar(argv(`comandos-nas --lote ${LOTE} --destino host:relativo`), ENV)).toBe(true)
  })
})

describe('A5 E10 T7: rodar, os que só imprimem', () => {
  it('comandos-nas não chama o banco nem o disco: imprime o rsync e o sha256sum -c, um por linha', async () => {
    const quebrado: DepsDoComando = dinheiro({
      disco: { existe: async () => { throw new Error('disco') }, listar: async () => { throw new Error('disco') }, criarPasta: async () => { throw new Error('disco') }, gravar: async () => { throw new Error('disco') }, ler: async () => { throw new Error('disco') }, apagar: async () => { throw new Error('disco') }, dentroDeRepositorio: async () => { throw new Error('disco') } },
    })
    const r = await rodar(cmd(`comandos-nas --lote ${LOTE} --destino thiago@nas:/mnt/fast/arquivo --pasta /home/dono/arq`, { HOME: '/h' }), quebrado)
    expect(r.codigo).toBe(0)
    expect(r.saida).toEqual([
      `rsync -av --partial '/home/dono/arq/${LOTE}/' 'thiago@nas:/mnt/fast/arquivo/${LOTE}/'`,
      `ssh 'thiago@nas' 'cd '\\''/mnt/fast/arquivo/${LOTE}'\\'' && sha256sum -c manifesto.sha256'`,
    ])
  })

  it('comandos-nas põe aspas: destino com espaço ou ponto e vírgula não vira comando', async () => {
    const r = await rodar({ nome: 'comandos-nas', lote: LOTE, destino: 'u@nas:/vol/a b;rm -rf x', pasta: '/p' }, dinheiro())
    expect(r.saida[0]).toContain(`'u@nas:/vol/a b;rm -rf x/${LOTE}/'`)
  })

  async function pastaComManifesto() {
    const b = bancoFalso({ urls: [] })
    const d = discoFalso()
    const { exportarCanal } = await import('@/lib/youtube/observatorio/arquivo/exportar')
    const e = await exportarCanal({ sql: b.sql, disco: d.disco, baixar: baixarFalso().baixar, pastaRaiz: '/arquivo', lote: LOTE, siteId: SITE, canalId: CANAL, aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => AGORA, versaoDoScript: 't' })
    expect(e.ok).toBe(true)
    return d
  }

  it('comandos-recarga não chama o banco, lista as colunas do manifesto e põe pai antes de filho', async () => {
    const d = await pastaComManifesto()
    const r = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /arquivo`, { HOME: '/h' }), dinheiro({ disco: d.disco, sql: null }))
    expect(r.codigo).toBe(0)
    expect(r.saida).toHaveLength(4)
    expect(r.saida[0]).toBe(`\\copy public.competitor_channels ("id", "channel_name") from program 'gzip -dc /arquivo/${LOTE}/competitor_channels/${CANAL}/unico.csv.gz' csv header`)
    const ordem = r.saida.map(l => /public\.(\w+)/.exec(l)![1])
    expect(ordem.indexOf('competitor_channels')).toBeLessThan(ordem.indexOf('competitor_videos'))
    expect(ordem.indexOf('competitor_videos')).toBeLessThan(ordem.indexOf('competitor_video_daily'))
    for (const l of r.saida) expect(l).toMatch(/^\\copy public\.\w+ \(("\w+"(, )?)+\) from program 'gzip -dc [^']+' csv header$/)
  })

  /** Uma pasta exportada de verdade (com os falsos) que inclui tabelas de identidade (`id` gerado) e a tarefa antes da leitura. */
  async function pastaComIdentidade() {
    const tabelas = tabelasPadrao()
    const umaLinha = (): TabelaFalsa => ({
      colunas: [{ nome: 'id', tipo: 'bigint', nulo: false }], filtro: 't.id = $1', periodo: null, soma: null, ordem: 't.id', linhas: [{ id: '7' }],
    })
    delete tabelas.competitor_readings // o falso lista na ordem de inserção: a tarefa entra antes da leitura, como no registro do banco
    tabelas.youtube_intelligence_tasks = umaLinha()
    tabelas.competitor_readings = umaLinha()
    tabelas.competitor_field_versions = umaLinha()
    tabelas.competitor_raw = umaLinha()
    const b = bancoFalso({ urls: [], tabelas })
    const d = discoFalso()
    const { exportarCanal } = await import('@/lib/youtube/observatorio/arquivo/exportar')
    const e = await exportarCanal({ sql: b.sql, disco: d.disco, baixar: baixarFalso().baixar, pastaRaiz: '/arquivo', lote: LOTE, siteId: SITE, canalId: CANAL, aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => AGORA, versaoDoScript: 't' })
    expect(e.ok).toBe(true)
    return d
  }

  it('comandos-recarga reajusta as sequências de identidade das tabelas que o manifesto carrega, DEPOIS de todos os \\copy (revisão Phil 14/10, I-3)', async () => {
    const d = await pastaComIdentidade()
    const r = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /arquivo`, { HOME: '/h' }), dinheiro({ disco: d.disco, sql: null }))
    expect(r.codigo).toBe(0)
    const copias = r.saida.filter(l => l.startsWith('\\copy'))
    const ajustes = r.saida.filter(l => l.startsWith('select setval'))
    // só as tabelas de identidade que ESTÁ no manifesto (a lista fixa é conferida contra o catálogo na integração)
    expect(ajustes).toEqual([
      `select setval(pg_get_serial_sequence('public.competitor_field_versions', 'id'), (select max(id) from public.competitor_field_versions));`,
      `select setval(pg_get_serial_sequence('public.competitor_raw', 'id'), (select max(id) from public.competitor_raw));`,
    ])
    expect(copias.length + ajustes.length).toBe(r.saida.length)
    expect(r.saida.slice(0, copias.length)).toEqual(copias) // nenhum ajuste no meio dos \\copy: o máximo só vale com tudo carregado
    // a ordem do manifesto (a do registro) é a ordem impressa: a tarefa vem antes da leitura que aponta para ela
    const ordem = copias.map(l => /public\.(\w+)/.exec(l)![1])
    expect(ordem.indexOf('youtube_intelligence_tasks')).toBeGreaterThan(-1)
    expect(ordem.indexOf('youtube_intelligence_tasks')).toBeLessThan(ordem.indexOf('competitor_readings'))
  })

  it('comandos-recarga com --pasta com espaço ou aspa: o caminho vai entre aspas do shell dentro do programa, e o caminho comum continua sem aspas (revisão Yannis 14/10, M9)', async () => {
    const d = await pastaComManifesto()
    const r = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /arquivo`, { HOME: '/h' }), dinheiro({ disco: d.disco, sql: null }))
    expect(r.saida[0]).toContain(`from program 'gzip -dc /arquivo/${LOTE}/competitor_channels/`) // caminho comum: nada muda
    // o manifesto é lido da pasta pedida: o falso do disco guarda tudo em `/arquivo`; copiamos para uma pasta com espaço e aspa
    for (const pasta of ['/tmp/a b', `/tmp/o'neil`, '/tmp/a;rm -rf x']) {
      const d2 = discoFalso()
      for (const [k, v] of d.arquivos) d2.arquivos.set(k.replace('/arquivo/', `${pasta}/`), v)
      const out = await rodar({ nome: 'comandos-recarga', lote: LOTE, pasta }, dinheiro({ disco: d2.disco, sql: null }))
      expect(out.codigo, pasta).toBe(0)
      const l = out.saida[0]!
      const caminho = `${pasta}/${LOTE}/competitor_channels/${CANAL}/unico.csv.gz`
      // dentro do literal do psql a aspa do shell vira duas; desfeito o literal, sobra `gzip -dc '<caminho>'` com a aspa do caminho em `'\''`
      const literal = /from program '(.*)' csv header$/.exec(l)![1]!.replace(/''/g, `'`)
      expect(literal).toBe(`gzip -dc '${caminho.replace(/'/g, `'\\''`)}'`)
    }
  })

  it('comandos-recarga sem tabela de identidade no manifesto não imprime ajuste algum', async () => {
    const d = await pastaComManifesto()
    const r = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /arquivo`, { HOME: '/h' }), dinheiro({ disco: d.disco, sql: null }))
    expect(r.saida.some(l => l.startsWith('select setval'))).toBe(false)
  })

  it('comandos-recarga: pasta sem manifesto ou com manifesto adulterado não imprime nada', async () => {
    const vazio = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /nada`, { HOME: '/h' }), dinheiro())
    expect(vazio.codigo).toBe(1)
    const d = await pastaComManifesto()
    d.arquivos.set(`/arquivo/${LOTE}/manifesto.json`, Buffer.from('{ "versao": 7 }'))
    const ruim = await rodar(cmd(`comandos-recarga --lote ${LOTE} --pasta /arquivo`, { HOME: '/h' }), dinheiro({ disco: d.disco }))
    expect(ruim.codigo).toBe(1)
    expect(ruim.saida.some(l => l.startsWith('\\copy'))).toBe(false)
  })
})

describe('A5 E10 T7: rodar, pausar, despausar, exportar, conferir', () => {
  it('--por com e-mail que não existe: código 2; com dois usuários: código 2', async () => {
    const a = roteirizado([rotaSite, [/from auth\.users/, () => []]])
    expect((await rodar(cmd(`pausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: a.sql }))).codigo).toBe(2)
    const b = roteirizado([rotaSite, [/from auth\.users/, () => [{ id: USUARIO }, { id: USUARIO }]]])
    expect((await rodar(cmd(`pausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: b.sql }))).codigo).toBe(2)
    expect(a.textos().some(t => /competitor_channel_pause/.test(t))).toBe(false)
  })

  it('--site: sem ele vale o único site; com mais de um, exige a opção (código 2)', async () => {
    const dois = roteirizado([[/select distinct site_id/, () => [{ site_id: SITE }, { site_id: 'outro' }]]])
    const r = await rodar(cmd(`estado`), dinheiro({ sql: dois.sql }))
    expect(r.codigo).toBe(2)
    expect(tudo(r)).toContain('--site')
    const nenhum = roteirizado([[/select distinct site_id/, () => []]])
    expect((await rodar(cmd(`estado`), dinheiro({ sql: nenhum.sql }))).codigo).toBe(2)
  })

  it('pausar e despausar: o resultado do banco vira frase; despausar diz quantos arquivos perderam a conferência', async () => {
    const p = roteirizado([rotaSite, rotaUsuario, [/competitor_channel_pause\(/, () => [{ r: { status: 'pausado' } }]]])
    const rp = await rodar(cmd(`pausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: p.sql }))
    expect(rp.codigo).toBe(0)
    expect(tudo(rp)).toContain('coleta pausada')
    expect(p.chamadas.find(c => /competitor_channel_pause\(/.test(c.texto))!.parametros).toEqual([SITE, CANAL, USUARIO])
    const u = roteirizado([rotaSite, rotaUsuario, [/competitor_channel_unpause\(/, () => [{ r: { status: 'despausado', arquivos_invalidados: 5 } }]]])
    const ru = await rodar(cmd(`despausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: u.sql }))
    expect(tudo(ru)).toContain('5 arquivo(s)')
    const n = roteirizado([rotaSite, rotaUsuario, [/competitor_channel_unpause\(/, () => [{ r: { status: 'nao_pausado' } }]]])
    expect(tudo(await rodar(cmd(`despausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: n.sql })))).toContain('não estava pausada')
  })

  const CODIGOS_DO_BANCO: CodigoE10[] = ['forja_em_andamento', 'canal_nao_encontrado', 'nao_pausado', 'sem_lote', 'lote_nao_conferido', 'lote_nao_confirmado', 'despausado_depois_do_export', 'banco_difere_do_manifesto', 'tabela_sem_export', 'sobrou_linha', 'sem_direito', 'pausa_recente', 'sincronizando', 'lote_ja_apagado', 'pausa_sem_remendo', 'parametro_nulo', 'apagou_alem_do_arquivo']
  it.each(CODIGOS_DO_BANCO)('código do banco vira frase do catálogo: %s', async codigo => {
    const m = roteirizado([rotaSite, rotaUsuario, [/competitor_channel_pause\(/, () => Object.assign(new Error(`E10:${codigo}: competitor_video_daily 2026-09-01 banco=3 arquivo=2 SEGREDO`), { code: 'P0001' })]])
    const r = await rodar(cmd(`pausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql }))
    expect(r.codigo).toBe(1)
    expect(tudo(r)).toBe(FRASES_E10[codigo])
    for (const parte of ['competitor_video_daily', 'SEGREDO', 'banco=3']) expect(tudo(r)).not.toContain(parte)
  })

  it('a URL do banco nunca aparece na saída (nem num erro inesperado)', async () => {
    const m = roteirizado([rotaSite, rotaUsuario, [/competitor_channel_pause\(/, () => new Error(`falha ao conectar em ${URL_DO_BANCO}`)]])
    const r = await rodar(cmd(`pausar --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql }))
    expect(tudo(r)).not.toContain('SENHA-SECRETA')
    expect(tudo(r)).not.toContain('db.example.test')
    const usos = interpretar([], ENV)
    expect(JSON.stringify(usos)).not.toContain('SENHA-SECRETA')
    // o uso nem repete o valor da variável
    expect(USO.join('\n')).not.toContain('postgresql://')
  })

  it('exportar: lote padrão canal-<8>-<dia>, pasta padrão, e a saída diz a pasta e o próximo passo', async () => {
    const b = bancoFalso({ urls: [] })
    const original = b.sql.query.bind(b.sql)
    b.sql.query = async (t, p) => (/select distinct site_id/.test(t) ? { rows: [{ site_id: SITE }] } : original(t, p))
    const d = discoFalso()
    const r = await rodar(cmd(`exportar --canal ${CANAL}`, { ...ENV, HOME: '/home/dono' }), dinheiro({ sql: b.sql, disco: d.disco }))
    expect(r.codigo, tudo(r)).toBe(0)
    expect(tudo(r)).toContain(`exportação canal-0a1b2c3d-${AGORA.toISOString().slice(0, 10)} registrada`)
    expect(tudo(r)).toContain('/home/dono/Workspace/arquivo-observatorio/canal-0a1b2c3d-')
    expect(tudo(r)).toContain('próximo passo: conferir')
    // recusa do export: código 1 com a frase
    const c = bancoFalso({ semPausa: true })
    const o2 = c.sql.query.bind(c.sql)
    c.sql.query = async (t, p) => (/select distinct site_id/.test(t) ? { rows: [{ site_id: SITE }] } : o2(t, p))
    const r2 = await rodar(cmd(`exportar --canal ${CANAL}`), dinheiro({ sql: c.sql }))
    expect(r2.codigo).toBe(1)
    expect(tudo(r2)).toBe(FRASES_E10.nao_pausado)
  })
})

describe('A5 E10 T7: confirmar-nas e remover', () => {
  it('confirmar-nas sem terminal recusa e não chega ao banco', async () => {
    const m = roteirizado([rotaSite, rotaUsuario])
    const r = await rodar(cmd(`confirmar-nas --canal ${CANAL} --lote ${LOTE} --por ${EMAIL}`), dinheiro({ sql: m.sql, ehTerminal: false }))
    expect(r.codigo).toBe(1)
    expect(m.textos().some(t => /obs_archive_confirm_nas|^begin/.test(t))).toBe(false)
  })

  it('confirmar-nas com o nome digitado diferente recusa; com o nome certo confirma', async () => {
    const m = roteirizado([rotaSite, rotaUsuario, [/obs_archive_confirm_nas/, () => [{ r: { status: 'confirmado', arquivos: 7 } }]]])
    const r = await rodar(cmd(`confirmar-nas --canal ${CANAL} --lote ${LOTE} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => 'outro-nome' }))
    expect(r.codigo).toBe(1)
    expect(m.textos().some(t => /obs_archive_confirm_nas/.test(t))).toBe(false)
    const ok = await rodar(cmd(`confirmar-nas --canal ${CANAL} --lote ${LOTE} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => `  ${LOTE}  ` }))
    expect(ok.codigo).toBe(0)
    expect(tudo(ok)).toContain('7 arquivo(s)')
    expect(m.chamadas.find(c => /obs_archive_confirm_nas/.test(c.texto))!.parametros).toEqual([SITE, LOTE, CANAL, USUARIO])
  })

  const rotasRemover = (extra: Rota[] = [], admin = true): Rota[] => [
    rotaSite, rotaUsuario, rotaAdmin(admin),
    [/select channel_name from public\.competitor_channels/, () => [{ channel_name: 'Canal sintético' }]],
    [/select batch from public\.obs_archive_batches/, () => [{ batch: LOTE }]],
    ...extra,
  ]
  const removido = (batch = LOTE): Rota => [/competitor_channel_remove_archived/, () => [{ r: { status: 'removido', batch, arquivos: 10, linhas: 1234, blob_urls: ['a', 'b', 'c'], featured_refs_cleared: 0 } }]]

  it('remover sem terminal recusa e não abre transação', async () => {
    const m = roteirizado(rotasRemover([removido()]))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, ehTerminal: false }))
    expect(r.codigo).toBe(1)
    expect(m.textos().some(t => /^begin|competitor_channel_remove_archived/.test(t))).toBe(false)
  })

  it('remover com o nome do lote digitado errado recusa, sem transação', async () => {
    const m = roteirizado(rotasRemover([removido()]))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => 'errado' }))
    expect(r.codigo).toBe(1)
    expect(m.textos().some(t => /^begin|competitor_channel_remove_archived/.test(t))).toBe(false)
  })

  it('remover com --por que não administra o site recusa antes de chamar a função (e antes de perguntar)', async () => {
    let perguntou = false
    const m = roteirizado(rotasRemover([removido()], false))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => { perguntou = true; return LOTE } }))
    expect(r.codigo).toBe(1)
    expect(tudo(r)).toBe(FRASES_E10.sem_direito)
    expect(perguntou).toBe(false)
    expect(m.textos().some(t => /competitor_channel_remove_archived|^begin/.test(t))).toBe(false)
  })

  it('remover declara o statement_timeout antes de chamar a função, e a mostra o canal e o lote que vai liberar', async () => {
    const m = roteirizado(rotasRemover([removido()]))
    let pergunta = ''
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async p => { pergunta = p; return LOTE } }))
    expect(r.codigo, tudo(r)).toBe(0)
    const t = m.textos()
    const iBegin = t.indexOf('begin')
    const iTimeout = t.indexOf(`set local statement_timeout = '10min'`)
    const iFuncao = t.findIndex(x => /competitor_channel_remove_archived/.test(x))
    expect(iBegin).toBeGreaterThan(-1)
    expect(iTimeout).toBeGreaterThan(iBegin)
    expect(iFuncao).toBeGreaterThan(iTimeout)
    expect(t.at(-1)).toBe('commit')
    expect(pergunta).toContain('Canal sintético')
    expect(pergunta).toContain(LOTE)
    expect(m.chamadas[iFuncao]!.parametros).toEqual([SITE, CANAL, USUARIO])
  })

  it('remover: o lote devolvido difere do digitado: rollback, nada de commit', async () => {
    const m = roteirizado(rotasRemover([removido('canal-0a1b2c3d-outro')]))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => LOTE }))
    expect(r.codigo).toBe(1)
    expect(tudo(r)).toContain('lote_mudou')
    expect(m.textos().at(-1)).toBe('rollback')
    expect(m.textos()).not.toContain('commit')
  })

  it('remover: 57014 vira demorou_demais e a saída diz que nada foi apagado', async () => {
    const m = roteirizado(rotasRemover([[/competitor_channel_remove_archived/, () => Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })]]))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => LOTE }))
    expect(r.codigo).toBe(1)
    expect(tudo(r)).toContain(FRASES_E10.demorou_demais)
    expect(tudo(r)).toContain('nada foi apagado')
    expect(m.textos().at(-1)).toBe('rollback')
  })

  it('remover avisa dos 15 minutos de cache e das miniaturas que ficam no Blob', async () => {
    const m = roteirizado(rotasRemover([removido()]))
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => LOTE }))
    expect(tudo(r)).toContain('até 15 minutos')
    expect(tudo(r)).toContain('3 miniatura(s) continuam no Blob')
    expect(tudo(r)).toContain('1234 registro(s) em 10 arquivo(s)')
  })

  it('remover: canal sem exportação recusa com a frase de sem_lote', async () => {
    const m = roteirizado([rotaSite, rotaUsuario, rotaAdmin(true), [/select channel_name from public\.competitor_channels/, () => [{ channel_name: 'x' }]], [/select batch from public\.obs_archive_batches/, () => []]])
    const r = await rodar(cmd(`remover --canal ${CANAL} --por ${EMAIL}`), dinheiro({ sql: m.sql, perguntar: async () => LOTE }))
    expect(tudo(r)).toBe(FRASES_E10.sem_lote)
  })
})

describe('A5 E10 T7: estado', () => {
  it('lista pausados, as exportações e o passo de cada uma, o lote encerrado com o motivo e a pasta, e o histórico à parte', async () => {
    const m = roteirizado([
      rotaSite,
      [/collection_paused_at is not null/, () => [{ id: CANAL, channel_name: 'Canal sintético', desde: '2026-10-13 12:00:00+00' }]],
      [/from public\.obs_archive_batches b/, () => [
        { batch: 'lote-aberto', channel_ref: CANAL, canal: 'Canal sintético', exportado_em: '2026-10-13', arquivos: '5', conferido: false, confirmado: false, apagado: false, encerrado: null, canal_existe: true },
        { batch: 'lote-conferido', channel_ref: CANAL, canal: 'Canal sintético', exportado_em: '2026-10-12', arquivos: '5', conferido: true, confirmado: false, apagado: false, encerrado: null, canal_existe: true },
        { batch: 'lote-desistido', channel_ref: CANAL, canal: 'Canal sintético', exportado_em: '2026-10-11', arquivos: '5', conferido: false, confirmado: false, apagado: false, encerrado: 'despausado', canal_existe: true },
        { batch: 'lote-orfao', channel_ref: 'x', canal: 'Sumiu', exportado_em: '2026-10-10', arquivos: '5', conferido: true, confirmado: true, apagado: false, encerrado: null, canal_existe: false },
      ]],
      [/from public\.obs_db_size_daily/, () => []],
    ])
    const r = await rodar(cmd(`estado --pasta /arq`), dinheiro({ sql: m.sql }))
    expect(r.codigo).toBe(0)
    const s = tudo(r)
    expect(s).toContain('canais com a coleta pausada: 1')
    expect(s).toContain('lote-aberto')
    expect(s).toContain('exportada (falta conferir)')
    expect(s).toContain('conferida (falta confirmar no NAS)')
    expect(s).toContain('encerrada (despausado); pasta /arq/lote-desistido')
    expect(s).toContain('1 exportação(ões) de canal que não existe mais: histórico, não pendência')
    expect(s).toContain('banco do site: Ainda sem medida do tamanho do banco do site.')
  })
})

describe('A5 E10 T7: importações', () => {
  it('cli.ts não importa remover.ts (nem Blob, Sentry, next/*, server-only ou o alias @/)', () => {
    const src = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/arquivo/cli.ts'), 'utf8')
    expect(src).not.toMatch(/from ['"][^'"]*remover['"]/)
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1]!.startsWith('node:') || m[1]!.startsWith('.'), m[1]).toBe(true)
  })

  it('o script é fino e só lê OBS_ARQUIVO_DB_URL (nunca .env.local)', () => {
    const src = readFileSync(join(__dirname, '../../../../../scripts/obs-arquivo.ts'), 'utf8')
    expect(src).toContain('OBS_ARQUIVO_DB_URL')
    expect(src).not.toMatch(/\.env\.local['"`]\s*[,)]|dotenv|loadEnv|--env-file/)
    expect(src.split('\n').length).toBeLessThan(120)
  })
})
