/**
 * A5 · E10: o comando `obs-arquivo` (pausar, despausar, exportar, conferir, comandos-nas, confirmar-nas, remover, comandos-recarga,
 * estado). Só `node:` e importação relativa; NÃO importa `remover.ts` (Blob e Sentry): o `tsx` da raiz não resolve `@/`, `server-only`
 * nem `next/*`. `interpretar` é puro; `rodar` recebe o banco, o disco, o `fetch`, o relógio e o terminal por parâmetro.
 *
 * Regras que não mudam: a URL do banco (`OBS_ARQUIVO_DB_URL`) nunca aparece na saída; `.env.local` nunca é lido (ele aponta para a
 * produção); toda mensagem do banco vira frase do catálogo (`codigos.ts`); quem confirma o NAS e quem remove digita o nome da
 * exportação num terminal de verdade. Códigos de saída: 0 feito; 1 recusado ou diferença; 2 argumento ou ambiente inválido.
 */
import { codigoE10, FRASES_E10, type CodigoE10 } from './codigos'
import { conferirLote } from './conferir'
import { exportarCanal, NOME_DE_LOTE, type Disco } from './exportar'
import { nomeDoLote, validarManifesto } from './manifesto'
import type { Baixar } from './miniaturas'
import type { ClienteSql } from './sessao'
import { sinalDoBanco, type LinhaBruta } from './sinal-do-banco'

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DESTINO = /^([A-Za-z0-9._-]+@)?([A-Za-z0-9.-]+):(\/[^\0]*)$/

export type Comando =
  | { nome: 'estado'; site: string | null; pasta: string }
  | { nome: 'pausar' | 'despausar'; canal: string; por: string; site: string | null }
  | { nome: 'exportar'; canal: string; lote: string | null; pasta: string; refazer: boolean; aceitarMiniaturasAusentes: boolean; site: string | null }
  | { nome: 'conferir'; canal: string; lote: string; pasta: string; site: string | null }
  | { nome: 'comandos-nas'; lote: string; destino: string; pasta: string }
  | { nome: 'confirmar-nas'; canal: string; lote: string; por: string; site: string | null }
  | { nome: 'remover'; canal: string; por: string; site: string | null; pasta: string }
  | { nome: 'comandos-recarga'; lote: string; pasta: string }

export const USO = [
  'uso: npx tsx scripts/obs-arquivo.ts <comando> [opções]',
  '  estado           [--site <uuid>]',
  '  pausar           --canal <uuid> --por <e-mail> [--site <uuid>]',
  '  despausar        --canal <uuid> --por <e-mail> [--site <uuid>]',
  '  exportar         --canal <uuid> [--lote <nome>] [--pasta <raiz>] [--refazer] [--aceitar-miniaturas-ausentes] [--site <uuid>]',
  '  conferir         --canal <uuid> --lote <nome> [--pasta <raiz>] [--site <uuid>]',
  '  comandos-nas     --lote <nome> --destino <usuario@host:/caminho> [--pasta <raiz>]   (só imprime)',
  '  confirmar-nas    --canal <uuid> --lote <nome> --por <e-mail> [--site <uuid>]',
  '  remover          --canal <uuid> --por <e-mail> [--site <uuid>]',
  '  comandos-recarga --lote <nome> [--pasta <raiz>]                                    (só imprime)',
  'ambiente: OBS_ARQUIVO_DB_URL (conexão direta ao banco; o .env.local nunca é lido)',
]

/** Os subcomandos que falam com o banco; os outros dois só imprimem. */
const COM_BANCO = new Set(['estado', 'pausar', 'despausar', 'exportar', 'conferir', 'confirmar-nas', 'remover'])
const OPCOES: Record<string, { valor: string[]; bandeira: string[]; obrigatorias: string[] }> = {
  estado: { valor: ['site', 'pasta'], bandeira: [], obrigatorias: [] },
  pausar: { valor: ['canal', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'por'] },
  despausar: { valor: ['canal', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'por'] },
  exportar: { valor: ['canal', 'lote', 'pasta', 'site'], bandeira: ['refazer', 'aceitar-miniaturas-ausentes'], obrigatorias: ['canal'] },
  conferir: { valor: ['canal', 'lote', 'pasta', 'site'], bandeira: [], obrigatorias: ['canal', 'lote'] },
  'comandos-nas': { valor: ['lote', 'destino', 'pasta'], bandeira: [], obrigatorias: ['lote', 'destino'] },
  'confirmar-nas': { valor: ['canal', 'lote', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'lote', 'por'] },
  remover: { valor: ['canal', 'por', 'site', 'pasta'], bandeira: [], obrigatorias: ['canal', 'por'] },
  'comandos-recarga': { valor: ['lote', 'pasta'], bandeira: [], obrigatorias: ['lote'] },
}

export function pastaPadrao(env: NodeJS.ProcessEnv): string | null {
  const home = env.HOME
  return typeof home === 'string' && home !== '' ? `${home.replace(/\/+$/, '')}/Workspace/arquivo-observatorio` : null
}

export function interpretar(argv: string[], env: NodeJS.ProcessEnv): Comando | { erro: string } {
  const [sub, ...resto] = argv
  if (sub === undefined || sub === '--ajuda' || sub === '-h') return { erro: USO.join('\n') }
  const regra = OPCOES[sub]
  if (!regra) return { erro: `subcomando desconhecido: ${sub}\n${USO.join('\n')}` }
  const valores = new Map<string, string>()
  const bandeiras = new Set<string>()
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i]!
    if (!a.startsWith('--')) return { erro: `argumento inesperado: ${a}` }
    const nome = a.slice(2)
    if (regra.bandeira.includes(nome)) { bandeiras.add(nome); continue }
    if (!regra.valor.includes(nome)) return { erro: `opção desconhecida para ${sub}: --${nome}` }
    const v = resto[i + 1]
    if (v === undefined || v.startsWith('--')) return { erro: `--${nome} precisa de um valor` }
    valores.set(nome, v)
    i++
  }
  for (const o of regra.obrigatorias) if (!valores.has(o)) return { erro: `falta --${o}` }
  if (COM_BANCO.has(sub) && (typeof env.OBS_ARQUIVO_DB_URL !== 'string' || env.OBS_ARQUIVO_DB_URL.trim() === '')) {
    return { erro: 'OBS_ARQUIVO_DB_URL não está definida. Ela é a conexão direta ao banco e não vem do .env.local.' }
  }
  const canal = valores.get('canal')
  if (canal !== undefined && !ID.test(canal)) return { erro: '--canal precisa ser um uuid' }
  const site = valores.get('site') ?? null
  if (site !== null && !ID.test(site)) return { erro: '--site precisa ser um uuid' }
  const lote = valores.get('lote')
  if (lote !== undefined && !NOME_DE_LOTE.test(lote)) return { erro: '--lote só pode ter letras minúsculas, números e hífen (3 a 61 caracteres), sem barra' }
  const por = valores.get('por')
  if (por !== undefined && !EMAIL.test(por)) return { erro: '--por precisa ser um e-mail' }
  const pasta = valores.get('pasta') ?? pastaPadrao(env)
  if (pasta === null && ['estado', 'exportar', 'conferir', 'comandos-nas', 'remover', 'comandos-recarga'].includes(sub)) return { erro: 'sem --pasta e sem HOME: diga onde fica a pasta das exportações' }
  const destino = valores.get('destino')
  if (destino !== undefined && !DESTINO.test(destino)) return { erro: '--destino precisa ser usuario@host:/caminho' }

  switch (sub) {
    case 'estado': return { nome: 'estado', site, pasta: pasta! }
    case 'pausar': case 'despausar': return { nome: sub, canal: canal!, por: por!, site }
    case 'exportar': return { nome: 'exportar', canal: canal!, lote: lote ?? null, pasta: pasta!, refazer: bandeiras.has('refazer'), aceitarMiniaturasAusentes: bandeiras.has('aceitar-miniaturas-ausentes'), site }
    case 'conferir': return { nome: 'conferir', canal: canal!, lote: lote!, pasta: pasta!, site }
    case 'comandos-nas': return { nome: 'comandos-nas', lote: lote!, destino: destino!, pasta: pasta! }
    case 'confirmar-nas': return { nome: 'confirmar-nas', canal: canal!, lote: lote!, por: por!, site }
    case 'remover': return { nome: 'remover', canal: canal!, por: por!, site, pasta: pasta! }
    default: return { nome: 'comandos-recarga', lote: lote!, pasta: pasta! }
  }
}

// ───────────────────────── rodar ─────────────────────────

export interface DepsDoComando {
  /** Nulo nos dois subcomandos que só imprimem. */
  sql: ClienteSql | null
  disco: Disco
  baixar: Baixar
  agora: () => Date
  ehTerminal: boolean
  /** Lê uma linha digitada. Só é chamada com `ehTerminal` verdadeiro. */
  perguntar: (pergunta: string) => Promise<string>
  versaoDoScript: string
}
export interface Saida { codigo: 0 | 1 | 2; saida: string[] }

const feito = (...saida: string[]): Saida => ({ codigo: 0, saida })
const recusado = (...saida: string[]): Saida => ({ codigo: 1, saida })
const invalido = (...saida: string[]): Saida => ({ codigo: 2, saida })
const aspasSh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`
const texto = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const frase = (c: CodigoE10): string => FRASES_E10[c]
const erroDoBanco = (e: unknown): CodigoE10 => codigoE10(e as { message?: string; code?: string })

async function resolverSite(sql: ClienteSql, pedido: string | null): Promise<{ site: string } | { erro: string }> {
  if (pedido !== null) return { site: pedido }
  const r = await sql.query('select distinct site_id from public.competitor_channels')
  const sites = r.rows.map(l => texto(l.site_id))
  if (sites.length === 1) return { site: sites[0]! }
  return { erro: sites.length === 0 ? 'nenhum site tem canal de concorrente' : `há ${sites.length} sites com canal de concorrente: diga qual com --site` }
}

async function resolverUsuario(sql: ClienteSql, email: string): Promise<{ id: string } | { erro: string }> {
  const r = await sql.query('select id from auth.users where lower(email) = lower($1)', [email])
  if (r.rows.length !== 1) return { erro: r.rows.length === 0 ? 'não achei nenhum usuário com esse e-mail' : 'mais de um usuário com esse e-mail' }
  return { id: texto(r.rows[0]!.id) }
}

async function administra(sql: ClienteSql, site: string, usuario: string): Promise<boolean> {
  const r = await sql.query('select public.obs_archive_is_site_admin($1, $2) as ok', [site, usuario])
  return r.rows[0]?.ok === true
}

export async function rodar(c: Comando, d: DepsDoComando): Promise<Saida> {
  try {
    if (c.nome === 'comandos-nas') return comandosNas(c)
    if (c.nome === 'comandos-recarga') return await comandosRecarga(c, d)
    if (d.sql === null) return invalido('este subcomando precisa do banco (OBS_ARQUIVO_DB_URL)')
    const sql = d.sql
    const s = await resolverSite(sql, c.site)
    if ('erro' in s) return invalido(s.erro)
    switch (c.nome) {
      case 'estado': return await estado(c, d, sql, s.site)
      case 'pausar': case 'despausar': return await pausarOuDespausar(c, sql, s.site)
      case 'exportar': return await exportar(c, d, sql, s.site)
      case 'conferir': return await conferir(c, d, sql, s.site)
      case 'confirmar-nas': return await confirmarNas(c, d, sql, s.site)
      case 'remover': return await remover(c, d, sql, s.site)
    }
  } catch (e) {
    // nenhuma mensagem do banco sai daqui: só a frase do código
    return recusado(frase(erroDoBanco(e)))
  }
}

// ───────────────────────── só imprimem ─────────────────────────

function comandosNas(c: Extract<Comando, { nome: 'comandos-nas' }>): Saida {
  const m = DESTINO.exec(c.destino)!
  const origem = `${c.pasta.replace(/\/+$/, '')}/${c.lote}/`
  const alvo = `${c.destino.replace(/\/+$/, '')}/${c.lote}/`
  const maquina = `${m[1] ?? ''}${m[2]}`
  const remota = `${m[3]!.replace(/\/+$/, '')}/${c.lote}`
  return feito(
    `rsync -av --partial ${aspasSh(origem)} ${aspasSh(alvo)}`,
    `ssh ${aspasSh(maquina)} ${aspasSh(`cd ${aspasSh(remota)} && sha256sum -c manifesto.sha256`)}`,
  )
}

async function comandosRecarga(c: Extract<Comando, { nome: 'comandos-recarga' }>, d: DepsDoComando): Promise<Saida> {
  const pasta = `${c.pasta.replace(/\/+$/, '')}/${c.lote}`
  if (!(await d.disco.existe(`${pasta}/manifesto.json`))) return recusado('a pasta não tem manifesto.json')
  let m
  try {
    m = validarManifesto(JSON.parse(Buffer.from(await d.disco.ler(`${pasta}/manifesto.json`)).toString('utf8')))
  } catch {
    return recusado('o manifesto.json não é um JSON legível')
  }
  if (!('valor' in m)) return recusado(`o manifesto não serve: ${m.porque}`)
  // o manifesto lista as tabelas na ordem do registro do banco: pai antes de filho
  return feito(...m.valor.arquivos.map(a =>
    `\\copy public.${a.tabela} (${a.colunas.map(x => `"${x.nome}"`).join(', ')}) from program 'gzip -dc ${pasta}/${a.caminho}' csv header`))
}

// ───────────────────────── com o banco ─────────────────────────

async function estado(c: Extract<Comando, { nome: 'estado' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  const saida: string[] = []
  const pausados = await sql.query(
    `select id, channel_name, collection_paused_at::text as desde from public.competitor_channels where site_id = $1 and collection_paused_at is not null order by collection_paused_at`, [site])
  saida.push(`canais com a coleta pausada: ${pausados.rows.length}`)
  for (const p of pausados.rows) saida.push(`  ${texto(p.id)}  ${texto(p.channel_name)}  desde ${texto(p.desde)}`)
  const lotes = await sql.query(
    `select b.batch, b.channel_ref, max(b.channel_label) as canal, min(b.exported_at)::text as exportado_em, count(*) as arquivos,
            bool_and(b.verified_at is not null) as conferido, bool_and(b.nas_confirmed_at is not null) as confirmado, bool_and(b.deleted_at is not null) as apagado,
            max(b.closed_reason) as encerrado, exists (select 1 from public.competitor_channels c where c.id::text = b.channel_ref) as canal_existe
       from public.obs_archive_batches b where b.site_id = $1 group by b.batch, b.channel_ref order by min(b.exported_at)`, [site])
  const historicos = lotes.rows.filter(l => l.canal_existe !== true && l.apagado !== true && l.encerrado === null)
  saida.push(`exportações: ${lotes.rows.length}`)
  for (const l of lotes.rows) {
    const passo = l.apagado === true ? 'canal removido' : l.encerrado !== null && l.encerrado !== undefined ? `encerrada (${texto(l.encerrado)}); pasta ${c.pasta.replace(/\/+$/, '')}/${texto(l.batch)}`
      : l.confirmado === true ? 'confirmada no NAS (falta remover)' : l.conferido === true ? 'conferida (falta confirmar no NAS)' : 'exportada (falta conferir)'
    saida.push(`  ${texto(l.batch)}  ${texto(l.canal)}  ${texto(l.exportado_em)}  ${texto(l.arquivos)} arquivo(s): ${passo}`)
  }
  if (historicos.length > 0) saida.push(`  (${historicos.length} exportação(ões) de canal que não existe mais: histórico, não pendência)`)
  const medidas = await sql.query('select day::text as day, db_bytes::text as db_bytes, competitor_bytes::text as competitor_bytes, own_bytes::text as own_bytes, measured_at::text as measured_at from public.obs_db_size_daily order by day desc limit 29')
  const num = (v: unknown): number | null => (typeof v === 'string' && /^\d{1,18}$/.test(v) ? Number(v) : null)
  const linhas: LinhaBruta[] = medidas.rows.map(l => ({
    day: typeof l.day === 'string' ? l.day : null, db_bytes: num(l.db_bytes), competitor_bytes: num(l.competitor_bytes), own_bytes: num(l.own_bytes),
    measured_at: typeof l.measured_at === 'string' ? l.measured_at : null,
  }))
  saida.push(`banco do site: ${sinalDoBanco(linhas, d.agora().getTime()).frase}`)
  return feito(...saida)
}

async function pausarOuDespausar(c: Extract<Comando, { nome: 'pausar' | 'despausar' }>, sql: ClienteSql, site: string): Promise<Saida> {
  const u = await resolverUsuario(sql, c.por)
  if ('erro' in u) return invalido(u.erro)
  try {
    const fn = c.nome === 'pausar' ? 'competitor_channel_pause' : 'competitor_channel_unpause'
    const r = (await sql.query(`select public.${fn}($1, $2, $3) as r`, [site, c.canal, u.id])).rows[0]?.r as Record<string, unknown> | undefined
    if (!r) return recusado(frase('inesperado'))
    if (c.nome === 'pausar') {
      return feito(r.status === 'ja_pausado' ? 'a coleta deste canal já estava pausada' : 'coleta pausada', `espere alguns minutos antes de exportar (o banco recusa antes disso)`)
    }
    if (r.status === 'nao_pausado') return feito('a coleta deste canal não estava pausada')
    const n = Number(r.arquivos_invalidados ?? 0)
    return feito('coleta retomada', n > 0 ? `${n} arquivo(s) de exportação perderam a conferência (a exportação deixou de valer)` : 'nenhuma exportação perdeu a conferência')
  } catch (e) {
    return recusado(frase(erroDoBanco(e)))
  }
}

const hoje = (d: DepsDoComando): string => d.agora().toISOString().slice(0, 10)

async function exportar(c: Extract<Comando, { nome: 'exportar' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  const lote = c.lote ?? nomeDoLote(c.canal, hoje(d))
  const r = await exportarCanal({
    sql, disco: d.disco, baixar: d.baixar, pastaRaiz: c.pasta, lote, siteId: site, canalId: c.canal,
    aceitarMiniaturasAusentes: c.aceitarMiniaturasAusentes, refazer: c.refazer, porIdade: false, agora: d.agora, versaoDoScript: d.versaoDoScript,
  })
  if (!r.ok) return recusado(r.frase, ...(r.detalhe ?? []).map(x => `  ${x}`))
  return feito(
    `exportação ${r.lote} registrada: ${r.arquivos} arquivo(s), ${r.linhas} registro(s), ${r.miniaturas} miniatura(s)` + (r.miniaturasAusentes > 0 ? `, ${r.miniaturasAusentes} ausente(s)` : ''),
    `pasta: ${c.pasta.replace(/\/+$/, '')}/${r.lote}`, 'próximo passo: conferir',
  )
}

async function conferir(c: Extract<Comando, { nome: 'conferir' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  const r = await conferirLote({ sql, disco: d.disco, pastaRaiz: c.pasta, lote: c.lote, siteId: site, canalId: c.canal })
  if (!r.ok) return recusado(r.frase, ...r.diferencas.map(x => `  ${x}`))
  return feito(`exportação ${c.lote} conferida: ${r.arquivos} arquivo(s), ${r.miniaturas} miniatura(s)`, 'próximo passo: copiar para o NAS (comandos-nas) e confirmar (confirmar-nas)')
}

async function confirmarNas(c: Extract<Comando, { nome: 'confirmar-nas' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  if (!d.ehTerminal) return recusado('confirmar a cópia no NAS só se faz num terminal: a confirmação é digitada por você')
  const u = await resolverUsuario(sql, c.por)
  if ('erro' in u) return invalido(u.erro)
  const digitado = (await d.perguntar(`Digite o nome da exportação (${c.lote}) para confirmar que a cópia no NAS está conferida: `)).trim()
  if (digitado !== c.lote) return recusado('o nome digitado não é o da exportação; nada foi confirmado')
  try {
    await sql.query('begin')
    const r = (await sql.query('select public.obs_archive_confirm_nas($1, $2, $3, $4) as r', [site, c.lote, c.canal, u.id])).rows[0]?.r as Record<string, unknown> | undefined
    await sql.query('commit')
    return feito(`cópia no NAS confirmada: ${texto(r?.arquivos)} arquivo(s)`, 'próximo passo: remover o canal (pelo CMS ou pelo comando remover)')
  } catch (e) {
    await sql.query('rollback').catch(() => undefined)
    return recusado(frase(erroDoBanco(e)))
  }
}

async function remover(c: Extract<Comando, { nome: 'remover' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  if (!d.ehTerminal) return recusado('remover só se faz num terminal: a remoção é digitada por você') // nenhuma transação foi aberta
  const u = await resolverUsuario(sql, c.por)
  if ('erro' in u) return invalido(u.erro)
  if (!(await administra(sql, site, u.id))) return recusado(frase('sem_direito'))
  const canal = (await sql.query('select channel_name from public.competitor_channels where id = $1 and site_id = $2', [c.canal, site])).rows[0]
  if (!canal) return recusado(frase('canal_nao_encontrado'))
  const lote = (await sql.query(
    `select batch from public.obs_archive_batches where site_id = $1 and channel_ref = $2 and deleted_at is null order by exported_at desc, batch desc limit 1`, [site, c.canal])).rows[0]
  if (!lote) return recusado(frase('sem_lote'))
  const nome = texto(lote.batch)
  const digitado = (await d.perguntar(`Vai remover o canal "${texto(canal.channel_name)}" e liberar a exportação ${nome}. Digite o nome da exportação para continuar: `)).trim()
  if (digitado !== nome) return recusado('o nome digitado não é o da exportação; nada foi apagado')
  try {
    await sql.query('begin')
    await sql.query(`set local statement_timeout = '10min'`)
    const r = (await sql.query('select public.competitor_channel_remove_archived($1, $2, $3) as r', [site, c.canal, u.id])).rows[0]?.r as Record<string, unknown> | undefined
    if (!r || r.status !== 'removido') { await sql.query('rollback'); return recusado(frase('inesperado')) }
    if (texto(r.batch) !== nome) {
      await sql.query('rollback')
      return recusado('a exportação mudou entre a sua conferência e a remoção (lote_mudou); nada foi apagado')
    }
    await sql.query('commit')
    const pendentes = Array.isArray(r.blob_urls) ? r.blob_urls.length : 0
    return feito(
      `canal removido: ${texto(r.linhas)} registro(s) em ${texto(r.arquivos)} arquivo(s) ficam só na exportação ${nome}`,
      `${pendentes} miniatura(s) continuam no Blob; a tarefa diária as apaga (até 200 por dia)`,
      'o canal pode continuar aparecendo no CMS por até 15 minutos (o comando não invalida o cache)',
    )
  } catch (e) {
    await sql.query('rollback').catch(() => undefined)
    const cod = erroDoBanco(e)
    return recusado(frase(cod), ...(cod === 'demorou_demais' ? ['nada foi apagado'] : []))
  }
}
