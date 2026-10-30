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
import { passoDaRemocao } from './passo-da-remocao'
import { exportarCanal, NOME_DE_LOTE, type Disco } from './exportar'
import { nomeDoLote, validarManifesto, type Manifesto } from './manifesto'
import type { Baixar } from './miniaturas'
import type { PedirPendencias } from './credencial'
import { lerPendencias } from '../arquivo-mensal/pendencias'
import { scriptDasPendencias, scriptDeFalha } from './pendencias-script'
import { prepararCopias, type Copia, type DepsExpurgo } from './expurgar'
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
  | { nome: 'pedidos'; por: string; site: string | null; pasta: string; destino: string | null }
  | { nome: 'pendencias' }
  | { nome: 'expurgar'; item: string; apagarAntigas: boolean }

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
  '  pedidos          --por <e-mail> [--site <uuid>] [--pasta <raiz>] [--destino <usuario@host:/caminho>]   (remoções pedidas no CMS)',
  '  pendencias       (sem opção; chave em ~/.config/obs-arquivo/chave; imprime o script da forja: npm run -s obs:arquivo | ssh forja \'bash -s\')',
  '  expurgar         --item <n> [--apagar-antigas]     (prepara a cópia do item e imprime o script: npm run -s obs:expurgar -- --item <n> | ssh forja "bash -s"; --canal: M9b)',
  '  comandos-recarga --lote <nome> [--pasta <raiz>]                                    (só imprime)',
  'ambiente: OBS_ARQUIVO_DB_URL (conexão direta ao banco; o .env.local nunca é lido)',
]

/** Os subcomandos que falam com o banco; os outros dois só imprimem. */
const COM_BANCO = new Set(['estado', 'pausar', 'despausar', 'exportar', 'conferir', 'confirmar-nas', 'remover', 'pedidos'])
const OPCOES: Record<string, { valor: string[]; bandeira: string[]; obrigatorias: string[] }> = {
  estado: { valor: ['site', 'pasta'], bandeira: [], obrigatorias: [] },
  pausar: { valor: ['canal', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'por'] },
  despausar: { valor: ['canal', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'por'] },
  exportar: { valor: ['canal', 'lote', 'pasta', 'site'], bandeira: ['refazer', 'aceitar-miniaturas-ausentes'], obrigatorias: ['canal'] },
  conferir: { valor: ['canal', 'lote', 'pasta', 'site'], bandeira: [], obrigatorias: ['canal', 'lote'] },
  'comandos-nas': { valor: ['lote', 'destino', 'pasta'], bandeira: [], obrigatorias: ['lote', 'destino'] },
  'confirmar-nas': { valor: ['canal', 'lote', 'por', 'site'], bandeira: [], obrigatorias: ['canal', 'lote', 'por'] },
  remover: { valor: ['canal', 'por', 'site', 'pasta'], bandeira: [], obrigatorias: ['canal', 'por'] },
  pedidos: { valor: ['por', 'site', 'pasta', 'destino'], bandeira: [], obrigatorias: ['por'] },
  'comandos-recarga': { valor: ['lote', 'pasta'], bandeira: [], obrigatorias: ['lote'] },
  pendencias: { valor: [], bandeira: [], obrigatorias: [] },
  expurgar: { valor: ['item', 'canal'], bandeira: ['apagar-antigas'], obrigatorias: [] },
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
  if (sub === 'expurgar') {
    if (valores.has('canal')) return { erro: 'expurgar --canal fica para a M9b; nada foi feito' }
    const item = valores.get('item')
    if (item === undefined) return { erro: 'falta --item' }
    if (!/^[1-9][0-9]{0,18}$/.test(item)) return { erro: '--item precisa ser o número do item (ex.: 12)' }
    return { nome: 'expurgar', item, apagarAntigas: bandeiras.has('apagar-antigas') }
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
  if (pasta === null && ['estado', 'exportar', 'conferir', 'comandos-nas', 'remover', 'comandos-recarga', 'pedidos'].includes(sub)) return { erro: 'sem --pasta e sem HOME: diga onde fica a pasta das exportações' }
  const destino = valores.get('destino')
  if (destino !== undefined && !DESTINO.test(destino)) return { erro: '--destino precisa ser usuario@host:/caminho' }

  switch (sub) {
    case 'pendencias': return { nome: 'pendencias' }
    case 'estado': return { nome: 'estado', site, pasta: pasta! }
    case 'pausar': case 'despausar': return { nome: sub, canal: canal!, por: por!, site }
    case 'exportar': return { nome: 'exportar', canal: canal!, lote: lote ?? null, pasta: pasta!, refazer: bandeiras.has('refazer'), aceitarMiniaturasAusentes: bandeiras.has('aceitar-miniaturas-ausentes'), site }
    case 'conferir': return { nome: 'conferir', canal: canal!, lote: lote!, pasta: pasta!, site }
    case 'comandos-nas': return { nome: 'comandos-nas', lote: lote!, destino: destino!, pasta: pasta! }
    case 'confirmar-nas': return { nome: 'confirmar-nas', canal: canal!, lote: lote!, por: por!, site }
    case 'remover': return { nome: 'remover', canal: canal!, por: por!, site, pasta: pasta! }
    case 'pedidos': return { nome: 'pedidos', por: por!, site, pasta: pasta!, destino: destino ?? null }
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
  /** Só `pendencias`: a ida à rota C13 com a chave do arquivo (nula = a chave não foi lida). */
  pedirPendencias?: PedirPendencias
  /** `pendencias`/`expurgar`: o tempo `copiar` no Mac (M9, Tarefa 8). Ausente = o comando não prepara cópias. */
  expurgo?: DepsExpurgo
}
export interface Saida { codigo: 0 | 1 | 2; saida: string[]; erros?: string[] }

const feito = (...saida: string[]): Saida => ({ codigo: 0, saida })
const recusado = (...saida: string[]): Saida => ({ codigo: 1, saida })
const invalido = (...saida: string[]): Saida => ({ codigo: 2, saida })
const aspasSh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`
const texto = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
/** Nome de canal é texto de terceiro: sem caractere de controle (sequência de escape) no terminal do dono (revisão Yannis 14/10, M5). */
export const limpo = (v: unknown): string => texto(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, '?')
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
  if (c.nome === 'pendencias') return await pendencias(d)
  if (c.nome === 'expurgar') return await pendencias(d, { itemId: `item:${c.item}`, apagarAntigas: c.apagarAntigas })
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
      case 'pedidos': return await pedidos(c, d, sql, s.site)
    }
  } catch (e) {
    // nenhuma mensagem do banco sai daqui: só a frase do código
    return recusado(frase(erroDoBanco(e)))
  }
}

// ───────────────────────── pendencias (peça 7, M3b-forja) ─────────────────────────

/** Todo código ≠ 0 vira script de falha: `bash -s` com entrada vazia sairia 0 na forja (D-F22). */
function falhaDaPendencias(codigo: 1 | 2, frase: string): Saida {
  return { codigo, saida: scriptDeFalha(frase), erros: [frase] }
}

type Lida = { ok: true; l: Extract<ReturnType<typeof lerPendencias>, { ok: true }> } | { ok: false; saida: Saida }

/** A ida à rota C13 e a leitura estrita. Qualquer falha vira script de falha (nunca "nada pendente"). */
async function lerDaRota(d: DepsDoComando): Promise<Lida> {
  const falha = (frase: string): Lida => ({ ok: false, saida: falhaDaPendencias(1, frase) })
  if (d.pedirPendencias === undefined) return falha('obs:arquivo: a chave do arquivo não foi lida; nada foi feito')
  let r: { status: number; corpo: string }
  try {
    r = await d.pedirPendencias()
  } catch (e) {
    const tempo = (e as { name?: string } | null)?.name === 'TimeoutError'
    return falha(tempo ? 'obs:arquivo: o site não respondeu em 15 s; nada foi feito' : 'obs:arquivo: não consegui falar com o site (rede); nada foi feito')
  }
  let json: unknown = undefined
  let temJson = true
  try { json = JSON.parse(r.corpo) } catch { temJson = false }
  if (r.status !== 200) {
    const codigo = temJson && typeof json === 'object' && json !== null ? ((json as { error?: { code?: unknown } }).error?.code) : undefined
    if (r.status === 503 && codigo === 'arquivo_desligado') return falha('obs:arquivo: o arquivo está desligado no site; nada foi feito')
    if (r.status === 401 || r.status === 403) return falha('obs:arquivo: o site recusou a chave; rode o m3b-obs-arquivo-credencial.sh')
    return falha(`obs:arquivo: o site não respondeu como esperado (HTTP ${r.status}); nada foi feito`)
  }
  if (!temJson) return falha('obs:arquivo: a resposta do site veio sem JSON; não consegui ler as pendências')
  const env = json as Record<string, unknown> | null
  const dentro = typeof env === 'object' && env !== null && !Array.isArray(env) && Object.keys(env).length === 1 && 'data' in env ? env.data : undefined
  const l = lerPendencias(dentro)
  if (!l.ok) return falha(`obs:arquivo: não consegui ler as pendências do site (${l.porque}); nada foi feito`)
  return { ok: true, l }
}

const TEMPO_EM_PALAVRAS: Record<string, string> = {
  sem_comando: 'ainda não há comando liberado para ele', copiar: 'a cópia ainda não foi preparada', conferir_b2: 'o passo agora é conferir o B2',
  apagar_antigas: 'o passo agora é apagar as versões antigas', bloqueado: 'ele está bloqueado',
}

async function pendencias(d: DepsDoComando, so?: { itemId: string; apagarAntigas: boolean }): Promise<Saida> {
  try {
    const primeira = await lerDaRota(d)
    if (!primeira.ok) return primeira.saida
    let l = primeira.l
    const todos = l.itens
    const avisos: string[] = []
    if (so) {
      const i = l.itens.find(x => x.itemId === so.itemId)
      if (!i) return falhaDaPendencias(1, `obs:arquivo: ${so.itemId} não está na lista de pendências (já concluído ou desconhecido); nada foi feito`)
      if (so.apagarAntigas && i.tempo !== 'apagar_antigas' && i.tempo !== 'conferir_b2') {
        return falhaDaPendencias(1, `obs:arquivo: ${so.itemId}: ${TEMPO_EM_PALAVRAS[i.tempo] ?? i.tempo}; só apago as antigas quando os três arquivos novos estiverem recebidos; nada foi feito`)
      }
      l = { ...l, itens: [i] }
    }
    let copias: Copia[] = []
    if (d.expurgo) {
      let prep: Awaited<ReturnType<typeof prepararCopias>>
      try { prep = await prepararCopias(l.itens, d.expurgo, undefined, todos) } catch {
        return falhaDaPendencias(1, 'obs:arquivo: a preparação da cópia falhou no meio (rede, NAS ou resposta fora da forma); nada foi gravado no NAS')
      }
      avisos.push(...prep.avisos)
      copias = prep.copias
      if (!prep.nasFora && (copias.length > 0 || prep.avisos.length > 0 || l.itens.some(i => i.tempo === 'copiar'))) {
        // o registro mudou os tempos: o script sai do estado novo (D-F23)
        const segunda = await lerDaRota(d)
        if (!segunda.ok) return { ...segunda.saida, erros: ['obs:arquivo: o site registrou a cópia; rode de novo para o script', ...(segunda.saida.erros ?? [])] }
        l = so ? { ...segunda.l, itens: segunda.l.itens.filter(x => x.itemId === so.itemId) } : segunda.l
      }
    }
    if (so?.apagarAntigas) l = { ...l, itens: l.itens.filter(i => i.tempo === 'apagar_antigas' || i.tempo === 'conferir_b2') }
    const s = scriptDasPendencias(l, { versao: d.versaoDoScript, copias })
    if (!s.ok) return falhaDaPendencias(1, `obs:arquivo: ${s.porque}; nada foi feito`)
    return { codigo: 0, saida: s.linhas, erros: [...avisos, s.resumo] }
  } catch {
    return falhaDaPendencias(1, 'obs:arquivo: erro inesperado; nada foi feito')
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
  return feito(...comandosDeRecarga(m.valor, pasta))
}

/**
 * As tabelas do registro cuja coluna `id` é de identidade (`generated always as identity`): o `\copy` grava o `id` do arquivo e deixa a
 * sequência onde estava, então o primeiro `insert` da coleta bate em `id` repetido. A lista é fixa e a integração a confere contra o
 * catálogo (revisão Phil 14/10, I-3); tabela nova com identidade no registro reprova o teste até entrar aqui.
 */
export const TABELAS_COM_IDENTIDADE: readonly string[] = [
  'competitor_channel_sections', 'competitor_collection_pauses', 'competitor_field_versions', 'competitor_playlist_versions', 'competitor_raw',
  'competitor_video_comments', 'yt_watch_alvos', 'yt_watch_readings', 'yt_watch_thumbs', 'ab_native_observados',
]

/**
 * (F1 do Remover canal, Phil M-4) O estado "remoção pedida" não volta com a recarga: o canal restaurado não nasce "agendado" nem fora da
 * conta de vagas. Depois do `\copy` do canal, as quatro colunas voltam a nulo (o CSV tem as colunas, então elas não podem sair do `\copy`).
 */
const ZERAR_PEDIDO = (canal: string): string =>
  `update public.competitor_channels set removal_requested_at = null, removal_requested_by = null, removal_was_paused = null, removal_reason = null, removal_reter_antes = null where id = '${canal}' and removal_requested_at is not null;`

/**
 * (Phil C-2) O CSV do alvo exportado durante o pedido traz `reter_ate = infinity`, que a poda nunca alcançaria. Devolve o valor guardado no pedido
 * (`removal_reter_antes`, por id do alvo) ANTES de zerar a coluna; tem de rodar depois de todos os `\copy`.
 */
const DEVOLVER_RETENCAO = (canal: string): string =>
  `update public.yt_watch_alvos a set reter_ate = (c.removal_reter_antes ->> a.id::text)::timestamptz from public.competitor_channels c where c.id = '${canal}' and a.site_id = c.site_id and a.tipo = 'concorrente' and a.reter_ate = 'infinity' and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = c.id);`

/**
 * O caminho dentro de `from program '...'`: caminho comum fica como está; com espaço, aspa ou qualquer caractere do shell, vai entre aspas do shell
 * (`aspasSh`) e, como tudo está dentro do literal do psql, cada aspa simples é dobrada (revisão Yannis 14/10, M9).
 */
const caminhoNoPrograma = (caminho: string): string => (/^[A-Za-z0-9._\/@%+=:,-]+$/.test(caminho) ? caminho : aspasSh(caminho).replace(/'/g, "''"))

/**
 * Os comandos de recarga: um `\copy` por arquivo do manifesto, na ordem do manifesto (a do registro do banco: pai antes de filho,
 * porque a recarga não desliga chave estrangeira) e, depois de TODOS, o reajuste da sequência de cada tabela de identidade carregada
 * (o máximo só vale com tudo carregado). `greatest` com o `last_value` da sequência: numa recarga sobre o banco vivo o `max(id)` nunca baixa a sequência
 * abaixo de um id já entregue (revisão Yannis 17/10, M3). Puro: só imprime.
 */
export function comandosDeRecarga(m: Manifesto, pasta: string): string[] {
  const copias = m.arquivos.map(a =>
    `\\copy public.${a.tabela} (${a.colunas.map(x => `"${x.nome}"`).join(', ')}) from program 'gzip -dc ${caminhoNoPrograma(`${pasta}/${a.caminho}`)}' csv header`)
  const carregadas = [...new Set(m.arquivos.map(a => a.tabela))].filter(t => TABELAS_COM_IDENTIDADE.includes(t))
  const ajustes = carregadas.map(t => `select setval(pg_get_serial_sequence('public.${t}', 'id'), greatest((select max(id) from public.${t}), (select last_value from public.${t}_id_seq)));`)
  const comCanal = m.arquivos.some(a => a.tabela === 'competitor_channels')
  const zerar = comCanal ? [...(m.arquivos.some(a => a.tabela === 'yt_watch_alvos') ? [DEVOLVER_RETENCAO(m.canal.id)] : []), ZERAR_PEDIDO(m.canal.id)] : []
  return [...copias, ...zerar, ...ajustes]
}

// ───────────────────────── com o banco ─────────────────────────

async function estado(c: Extract<Comando, { nome: 'estado' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  const saida: string[] = []
  const pausados = await sql.query(
    `select id, channel_name, collection_paused_at::text as desde from public.competitor_channels where site_id = $1 and collection_paused_at is not null order by collection_paused_at`, [site])
  saida.push(`canais com a coleta pausada: ${pausados.rows.length}`)
  for (const p of pausados.rows) saida.push(`  ${texto(p.id)}  ${limpo(p.channel_name)}  desde ${texto(p.desde)}`)
  const pedidas = await sql.query(
    `select id, channel_name, removal_requested_at::text as pedida_em, collection_paused_at::text as pausada_em from public.competitor_channels where site_id = $1 and removal_requested_at is not null order by removal_requested_at`, [site])
  saida.push(`remoções pedidas: ${pedidas.rows.length}`)
  for (const p of pedidas.rows) {
    const passo = await passoDoPedido(sql, site, p, d.agora().getTime())
    saida.push(`  ${texto(p.id)}  ${limpo(p.channel_name)}  pedida em ${texto(p.pedida_em)}: ${rotuloDoPasso(passo)}`)
  }
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
    saida.push(`  ${texto(l.batch)}  ${limpo(l.canal)}  ${texto(l.exportado_em)}  ${texto(l.arquivos)} arquivo(s): ${passo}`)
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
  const { codigoDoExport: _c, ...saida } = await exportarDetalhado(c, d, sql, site)
  return saida
}

/** Como `exportar`, mas devolve também o código da recusa (o `pedidos` escolhe a opção que destrava o pedido). */
async function exportarDetalhado(c: Extract<Comando, { nome: 'exportar' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida & { codigoDoExport?: string }> {
  const lote = c.lote ?? nomeDoLote(c.canal, hoje(d))
  const r = await exportarCanal({
    sql, disco: d.disco, baixar: d.baixar, pastaRaiz: c.pasta, lote, siteId: site, canalId: c.canal,
    aceitarMiniaturasAusentes: c.aceitarMiniaturasAusentes, refazer: c.refazer, porIdade: false, agora: d.agora, versaoDoScript: d.versaoDoScript,
  })
  if (!r.ok) return { ...recusado(r.frase, ...(r.detalhe ?? []).map(x => `  ${x}`)), codigoDoExport: r.codigo }
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

async function confirmarNas(c: Extract<Comando, { nome: 'confirmar-nas' }>, d: DepsDoComando, sql: ClienteSql, site: string, doPedido = false): Promise<Saida> {
  if (!d.ehTerminal) return recusado('confirmar a cópia no NAS só se faz num terminal: a confirmação é digitada por você')
  const u = await resolverUsuario(sql, c.por)
  if ('erro' in u) return invalido(u.erro)
  const digitado = (await d.perguntar(`Digite o nome da exportação (${c.lote}) para confirmar que a cópia no NAS está conferida: `)).trim()
  if (digitado !== c.lote) return recusado('o nome digitado não é o da exportação; nada foi confirmado')
  try {
    await sql.query('begin')
    if (doPedido && (await pedidoDesfeito(sql, site, c.canal, true))) { await sql.query('rollback'); return recusado(DESFEITO) }
    const r = (await sql.query('select public.obs_archive_confirm_nas($1, $2, $3, $4) as r', [site, c.lote, c.canal, u.id])).rows[0]?.r as Record<string, unknown> | undefined
    await sql.query('commit')
    return feito(`cópia no NAS confirmada: ${texto(r?.arquivos)} arquivo(s)`, 'próximo passo: remover o canal (pelo CMS ou pelo comando remover)')
  } catch (e) {
    await sql.query('rollback').catch(() => undefined)
    return recusado(frase(erroDoBanco(e)))
  }
}

async function remover(c: Extract<Comando, { nome: 'remover' }>, d: DepsDoComando, sql: ClienteSql, site: string, doPedido = false): Promise<Saida> {
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
  const digitado = (await d.perguntar(`Vai remover o canal "${limpo(canal.channel_name)}" e liberar a exportação ${nome}. Digite o nome da exportação para continuar: `)).trim()
  if (digitado !== nome) return recusado('o nome digitado não é o da exportação; nada foi apagado')
  try {
    await sql.query('begin')
    await sql.query(`set local statement_timeout = '10min'`)
    if (doPedido && (await pedidoDesfeito(sql, site, c.canal, true))) { await sql.query('rollback'); return recusado(DESFEITO) }
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

// ───────────────────────── remoções pedidas no CMS (F1 do Remover canal) ─────────────────────────

const DESFEITO = 'o pedido foi desfeito no CMS; nada foi apagado'
const SUMIU = 'o canal já foi apagado pelo CMS (sem guardar); nada a fazer aqui'

/** O pedido ainda está de pé? Com `travar`, `for update` na transação aberta: serializa com o `cancel_removal` (sem janela entre o teste e o uso). */
async function estadoDoPedido(sql: ClienteSql, site: string, canal: string, travar: boolean): Promise<'de_pe' | 'desfeito' | 'sumiu'> {
  const r = await sql.query(
    `select removal_requested_at from public.competitor_channels where id = $1 and site_id = $2${travar ? ' for update' : ''}`, [canal, site])
  if (r.rows[0] === undefined) return 'sumiu'
  return r.rows[0].removal_requested_at === null || r.rows[0].removal_requested_at === undefined ? 'desfeito' : 'de_pe'
}

/** Verdadeiro se o pedido não está mais de pé (desfeito, ou o canal já foi apagado). */
async function pedidoDesfeito(sql: ClienteSql, site: string, canal: string, travar: boolean): Promise<boolean> {
  return (await estadoDoPedido(sql, site, canal, travar)) !== 'de_pe'
}

type PassoCalculado = ReturnType<typeof passoDaRemocao> & { lote: string | null }

/** O lote que vale para a pausa atual (aberto e exportado depois dela) e o passo que a regra única manda dar. */
async function passoDoPedido(sql: ClienteSql, site: string, p: Record<string, unknown>, agoraMs: number): Promise<PassoCalculado> {
  const pausadoEm = typeof p.pausada_em === 'string' ? p.pausada_em : null
  let lote: Record<string, unknown> | undefined
  if (pausadoEm !== null) {
    lote = (await sql.query(
      `select b.batch, min(b.exported_at)::text as exportado_em, bool_and(b.verified_at is not null) as conferido, bool_and(b.nas_confirmed_at is not null) as confirmado
         from public.obs_archive_batches b
        where b.site_id = $1 and b.channel_ref = $2 and b.deleted_at is null and b.closed_at is null and b.exported_at >= $3
        group by b.batch order by min(b.exported_at) desc, b.batch desc limit 1`, [site, texto(p.id), pausadoEm])).rows[0]
  }
  const exp = lote ? texto(lote.exportado_em) : ''
  const passo = passoDaRemocao({
    pausadoEm,
    lote: lote ? { exportadoEm: exp, conferidoEm: lote.conferido === true ? exp : null, confirmadoEm: lote.confirmado === true ? exp : null, fechadoEm: null } : null,
  }, agoraMs)
  return { ...passo, lote: lote ? texto(lote.batch) : null }
}

/** Argumento de linha de comando que o dono cola no shell: comum fica como está, o resto vai entre aspas simples. */
function aspasDoDono(v: string): string {
  return /^[A-Za-z0-9_./@:+=,-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`
}

function rotuloDoPasso(p: ReturnType<typeof passoDaRemocao>): string {
  switch (p.passo) {
    case 'esperar': return `espere ${p.minutos ?? 0} min para exportar`
    case 'exportar': return 'falta exportar'
    case 'conferir': return 'falta conferir'
    case 'copiar_e_confirmar': return 'falta copiar para o NAS e confirmar'
    case 'remover': return 'pronto para remover'
  }
}

async function pedidos(c: Extract<Comando, { nome: 'pedidos' }>, d: DepsDoComando, sql: ClienteSql, site: string): Promise<Saida> {
  const u = await resolverUsuario(sql, c.por)
  if ('erro' in u) return invalido(u.erro)
  if (!(await administra(sql, site, u.id))) return recusado(frase('sem_direito'))
  const trava = 'obs-arquivo:pedidos:' + site
  // lock de SESSÃO: o CLI usa a conexão direta ao banco, nunca o pooler em modo transação
  if ((await sql.query('select pg_try_advisory_lock(hashtextextended($1, 0)) as ok', [trava])).rows[0]?.ok !== true) {
    return recusado('outro terminal está processando os pedidos deste site')
  }
  try {
    const lista = (await sql.query(
      `select id, channel_name, removal_requested_at::text as pedida_em, collection_paused_at::text as pausada_em
         from public.competitor_channels where site_id = $1 and removal_requested_at is not null order by removal_requested_at`, [site])).rows
    if (lista.length === 0) return feito('nenhuma remoção pedida')
    const saida: string[] = []
    let falhou = false
    for (const p of lista) {
      const nome = limpo(p.channel_name)
      let linhas: string[]
      try {
        const r = await umPedido(c, d, sql, site, p)
        if (r.codigo !== 0) {
          falhou = true
          const est = await estadoDoPedido(sql, site, texto(p.id), false)
          linhas = est === 'desfeito' ? [DESFEITO] : est === 'sumiu' ? [SUMIU] : r.saida
        } else linhas = r.saida
      } catch (e) {
        falhou = true
        linhas = [frase(erroDoBanco(e))]
      }
      linhas.forEach((l, i) => saida.push(i === 0 ? `canal ${nome}: ${l}` : `  ${l}`))
    }
    return falhou ? recusado(...saida) : feito(...saida)
  } finally {
    await sql.query('select pg_advisory_unlock(hashtextextended($1, 0))', [trava]).catch(() => undefined)
  }
}

async function umPedido(c: Extract<Comando, { nome: 'pedidos' }>, d: DepsDoComando, sql: ClienteSql, site: string, p: Record<string, unknown>): Promise<Saida> {
  const canal = texto(p.id)
  const dado = await passoDoPedido(sql, site, p, d.agora().getTime())
  switch (dado.passo) {
    case 'esperar': return feito(rotuloDoPasso(dado))
    case 'exportar': {
      const lote = nomeDoLote(canal, hoje(d))
      const e = (await exportarDetalhado({ nome: 'exportar', canal, lote, pasta: c.pasta, refazer: false, aceitarMiniaturasAusentes: false, site }, d, sql, site))
      if (e.codigo !== 0) {
        // (Yannis I-1) o pedido não fica preso: o dono recebe o comando pronto. `--refazer` nunca é ligado sozinho (a pasta pode ser de um lote já apagado)
        const opcao = e.codigoDoExport === 'pasta_nao_vazia' ? ' --refazer' : e.codigoDoExport === 'miniaturas_ausentes' ? ' --aceitar-miniaturas-ausentes' : ''
        return recusado(...e.saida, `rode: npx tsx scripts/obs-arquivo.ts exportar --canal ${canal} --pasta ${aspasDoDono(c.pasta)}${opcao}`)
      }
      const v = await conferir({ nome: 'conferir', canal, lote, pasta: c.pasta, site }, d, sql, site)
      if (v.codigo !== 0) return recusado(...e.saida.slice(0, 1), ...v.saida)
      const proximo = c.destino !== null
        ? comandosNas({ nome: 'comandos-nas', lote, destino: c.destino, pasta: c.pasta }).saida
        : ['próximo passo: copiar para o NAS (rode de novo com --destino)']
      return feito(e.saida[0]!, v.saida[0]!, ...proximo)
    }
    case 'conferir': return await conferir({ nome: 'conferir', canal, lote: dado.lote!, pasta: c.pasta, site }, d, sql, site)
    case 'copiar_e_confirmar':
      if (!d.ehTerminal) return recusado('falta digitar: rode num terminal')
      return await confirmarNas({ nome: 'confirmar-nas', canal, lote: dado.lote!, por: c.por, site }, d, sql, site, true)
    case 'remover':
      if (!d.ehTerminal) return recusado('falta digitar: rode num terminal')
      return await remover({ nome: 'remover', canal, por: c.por, site, pasta: c.pasta }, d, sql, site, true)
  }
}
