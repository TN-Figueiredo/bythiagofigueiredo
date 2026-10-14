/**
 * A5 · E10: `exportarCanal`, o passo 1 do arquivo (pausar, EXPORTAR, conferir, confirmar no NAS, remover). Só `node:` e importação
 * relativa. O banco, o disco, o `fetch` e o relógio chegam por parâmetro. A ORDEM DOS PASSOS É PARTE DO CONTRATO:
 *
 *  1 recusas de argumento (idade, nome); 2 pasta (repositório, não vazia, `--refazer` só com manifesto legível);
 *  3 transação de leitura + as recusas do banco, TODAS antes de criar a pasta; 4 o catálogo; 5 cada (tabela, mês) vira um CSV.gz
 *  conferido contra a contagem do banco; 6 as URLs de miniatura e o COMMIT da leitura (o retrato não fica aberto durante os
 *  downloads); 7 as miniaturas; 8 `manifesto.json` e `manifesto.sha256`, POR ÚLTIMO (pasta sem manifesto é pasta sem valor);
 *  9 numa segunda transação, `obs_archive_register`, que confere as contagens de novo.
 *
 * Nenhuma mensagem do banco vira frase: o código vem de `codigoE10`, a frase do catálogo. O nome do canal só vai para o manifesto.
 */
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { RULES } from '../rules'
import { codigoE10, FRASES_E10 } from './codigos'
import { ehArquivoDoSistema } from './sistema'
import {
  VERSAO_DO_MANIFESTO, caminhoDoArquivo, paraRegistro, textoDoSha256, validarManifesto, miniaturasAusentes,
  type ArquivoDoManifesto, type ColunaDoManifesto, type Manifesto, type MiniaturaDoManifesto,
} from './manifesto'
import { baixarMiniaturas, type Baixar } from './miniaturas'
import {
  abrirLeitura, fechar, consultaDoArquivo, lerCsvDoBanco, colunasDaExpressao, lerRegistro, lerExcluidas, tabelaExiste, lerColunasDaTabela,
  lerContagens, lerMiniaturasDoBanco, type ClienteSql,
} from './sessao'

export interface Disco {
  existe(p: string): Promise<boolean>
  /** Os caminhos de ARQUIVO sob `p`, relativos a `p`, recursivamente. */
  listar(p: string): Promise<string[]>
  /** Cria a pasta e os pais; não falha se já existe. */
  criarPasta(p: string, modo: number): Promise<void>
  gravar(p: string, d: Uint8Array): Promise<void>
  ler(p: string): Promise<Uint8Array>
  /** Apaga um arquivo; arquivo que não existe não é erro. */
  apagar(p: string): Promise<void>
  dentroDeRepositorio(p: string): Promise<boolean>
}

export type ResultadoExport =
  | { ok: true; lote: string; arquivos: number; linhas: number; miniaturas: number; miniaturasAusentes: number }
  | { ok: false; codigo: string; frase: string; detalhe?: string[] }

export const NOME_DE_LOTE = /^[a-z0-9][a-z0-9-]{2,60}$/
const MODO_DA_PASTA = 0o700

/** As frases dos códigos que são do export (os do banco vêm de `FRASES_E10`). */
export const FRASES_DO_EXPORT: Record<string, string> = {
  lote_por_idade_e_da_manutencao: 'O export por idade é da fase de manutenção e ainda não existe. Use o export de canal.',
  lote_invalido: 'O nome da exportação só pode ter letras minúsculas, números e hífen, de 3 a 61 caracteres, começando por letra ou número.',
  pasta_em_repositorio: 'A pasta de destino está dentro de um repositório git. Escolha outra pasta.',
  pasta_nao_vazia: 'A pasta da exportação já existe e não está vazia. Use --refazer para exportar de novo.',
  pasta_sem_manifesto: 'A pasta da exportação não está vazia e não tem um manifesto legível. Nada foi apagado. Escolha outra pasta.',
  contagem_do_arquivo_difere: 'A contagem de um arquivo não bate com a do banco. Nada foi registrado.',
  miniaturas_ausentes: 'Há miniaturas que não existem mais no Blob. Use --aceitar-miniaturas-ausentes para seguir sem elas.',
  miniaturas_nao_baixaram: 'Não foi possível baixar algumas miniaturas. Nada foi registrado.',
  erro_do_banco: 'O banco devolveu um erro durante a leitura. Nada foi registrado, e os arquivos da pasta não servem.',
  // 57014 no export é tempo da leitura: a frase do catálogo (`FRASES_E10`) fala da remoção e mandaria o dono para o `remover` (revisão Yannis 14/10, I1)
  demorou_demais: 'O banco passou do tempo durante a exportação. Nada foi registrado. Tente de novo; se repetir, avise.',
}

const recusa = (codigo: string, detalhe?: string[]): ResultadoExport => ({
  ok: false, codigo, frase: FRASES_DO_EXPORT[codigo] ?? FRASES_E10[codigo as keyof typeof FRASES_E10] ?? FRASES_E10.inesperado, ...(detalhe ? { detalhe } : {}),
})

const sha256 = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex')
const texto = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const juntar = (...partes: string[]): string => partes.join('/').replace(/\/{2,}/g, '/')
const diretorioDe = (p: string): string => p.slice(0, p.lastIndexOf('/'))

/** O último dia do mês de `AAAA-MM-01`. */
export function ultimoDiaDoMes(inicio: string): string {
  const [a, m] = inicio.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

/** Um `create table` reconstruído do catálogo (colunas e tipos; sem chave, índice nem valor padrão): serve para recarregar daqui a anos. */
export function esquemaDaTabela(tabela: string, colunas: ColunaDoManifesto[]): string {
  const linhas = colunas.map(c => `  "${c.nome.replace(/"/g, '""')}" ${c.tipo}${c.nulo ? '' : ' not null'}`)
  return `create table public."${tabela}" (\n${linhas.join(',\n')}\n);`
}

function nomeSeguro(s: string, padrao: string): string {
  const limpo = s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
  return limpo === '' || /^\.+$/.test(limpo) ? padrao : limpo
}

/** O caminho da miniatura dentro da pasta: `miniaturas/<id do vídeo>/<arquivo>`, único dentro do lote. */
export function caminhoDaMiniatura(url: string, video: string, usados: Set<string>): string {
  let arquivo = 'miniatura'
  try {
    const partes = new URL(url).pathname.split('/').filter(Boolean)
    arquivo = nomeSeguro(partes[partes.length - 1] ?? '', 'miniatura')
  } catch { /* URL ilegível: nome padrão */ }
  const base = `miniaturas/${nomeSeguro(video, 'video')}/${arquivo}`
  let caminho = base
  for (let n = 2; usados.has(caminho); n++) caminho = `${base}-${n}`
  usados.add(caminho)
  return caminho
}

function caminhoNoBlobDe(url: string): string {
  try { return new URL(url).pathname.replace(/^\/+/, '') } catch { return url }
}

export async function exportarCanal(o: {
  sql: ClienteSql; disco: Disco; baixar: Baixar; pastaRaiz: string; lote: string; siteId: string; canalId: string
  aceitarMiniaturasAusentes: boolean; refazer: boolean; porIdade: boolean; agora: () => Date; versaoDoScript: string
}): Promise<ResultadoExport> {
  const { sql, disco } = o

  // 1 ── argumentos
  if (o.porIdade) return recusa('lote_por_idade_e_da_manutencao')
  if (!NOME_DE_LOTE.test(o.lote)) return recusa('lote_invalido')

  // 2 ── a pasta
  const pasta = juntar(o.pastaRaiz, o.lote)
  if (await disco.dentroDeRepositorio(pasta)) return recusa('pasta_em_repositorio')
  let paraApagar: string[] = []
  if (await disco.existe(pasta)) {
    const dentro = (await disco.listar(pasta)).filter(c => !ehArquivoDoSistema(c))
    if (dentro.length > 0) {
      if (!o.refazer) return recusa('pasta_nao_vazia')
      // refazer apaga SÓ o que o manifesto anterior lista; sem manifesto legível não se apaga às cegas
      let anterior: Manifesto | null = null
      try {
        if (await disco.existe(juntar(pasta, 'manifesto.json'))) {
          const v = validarManifesto(JSON.parse(Buffer.from(await disco.ler(juntar(pasta, 'manifesto.json'))).toString('utf8')))
          if ('valor' in v) anterior = v.valor
        }
      } catch { /* ilegível */ }
      if (anterior === null) return recusa('pasta_sem_manifesto')
      paraApagar = [
        ...anterior.arquivos.map(a => a.caminho),
        ...anterior.miniaturas.map(m => m.caminho).filter((c): c is string => c !== null),
        'manifesto.json', 'manifesto.sha256',
      ]
    }
  }

  // 3 ── a leitura, e as recusas do banco ANTES de criar a pasta
  let aberta = false
  const desfazer = async (): Promise<void> => { if (aberta) { aberta = false; await fechar(sql, 'rollback').catch(() => undefined) } }
  // Os caminhos que ESTA execução gravou. Saída `ok: false` antes do manifesto completo apaga só estes (nunca lista a pasta e apaga
  // às cegas, regra do passo 2): sem isso a pasta fica com arquivo e sem manifesto, e o mesmo nome nunca mais serve (revisão Yannis 14/10, I2).
  const gravados: string[] = []
  const gravar = async (rel: string, d: Uint8Array): Promise<void> => { gravados.push(rel); await disco.gravar(juntar(pasta, rel), d) }
  // Devolve os caminhos que NÃO saíram (revisão Yannis 14/10, M-1): o dono vê o que ficou na pasta em vez de bater em `pasta_nao_vazia` sem saber por quê.
  const limparGravados = async (): Promise<string[]> => {
    const ficaram: string[] = []
    for (const rel of gravados.splice(0)) {
      try { await disco.apagar(juntar(pasta, rel)) } catch { ficaram.push(rel) }
    }
    return ficaram
  }
  const comOQueFicou = (detalhe: string[] | undefined, ficaram: string[]): string[] | undefined =>
    ficaram.length === 0 ? detalhe : [...(detalhe ?? []), `não consegui apagar da pasta: ${ficaram.join(', ')}`]
  const recusarLimpando = async (codigo: string, detalhe?: string[]): Promise<ResultadoExport> => recusa(codigo, comOQueFicou(detalhe, await limparGravados()))
  let manifestoCompleto = false
  try {
    await abrirLeitura(sql)
    aberta = true
    const c = (await sql.query(
      `select c.channel_id, c.channel_name,
              c.collection_paused_at is null as sem_pausa,
              coalesce(c.collection_paused_at > clock_timestamp() - make_interval(mins => $3::int), false) as pausa_recente,
              coalesce(c.sync_status = 'syncing' and c.sync_started_at > clock_timestamp() - interval '10 minutes', false) as sincronizando
         from public.competitor_channels c where c.id = $1 and c.site_id = $2`,
      [o.canalId, o.siteId, RULES.pause.minMinutesBeforeExport],
    )).rows[0]
    if (!c) { await desfazer(); return recusa('canal_nao_encontrado') }
    if (c.sem_pausa === true) { await desfazer(); return recusa('nao_pausado') }
    if (c.pausa_recente === true) { await desfazer(); return recusa('pausa_recente') }
    if (c.sincronizando === true) { await desfazer(); return recusa('sincronizando') }
    const sem = (await sql.query('select public.obs_archive_uncovered() as nomes')).rows[0]?.nomes
    if (Array.isArray(sem) && sem.length > 0) { await desfazer(); return recusa('tabela_sem_export', sem.map(texto)) }

    // 4 ── o catálogo
    const registro = await lerRegistro(sql)
    const excluidas = await lerExcluidas(sql)
    const contagens = await lerContagens(sql, o.canalId)
    const tabelasAusentes: string[] = []
    const tabelasSemLinha: string[] = []
    const colunasPorTabela = new Map<string, ColunaDoManifesto[]>()
    const esquema: Record<string, string> = {}
    for (const e of registro) {
      if (!(await tabelaExiste(sql, e.tabela))) { tabelasAusentes.push(e.tabela); continue }
      if (!contagens.some(k => k.tabela === e.tabela)) { tabelasSemLinha.push(e.tabela); continue }
      const colunas = await lerColunasDaTabela(sql, e.tabela)
      colunasPorTabela.set(e.tabela, colunas)
      esquema[e.tabela] = esquemaDaTabela(e.tabela, colunas)
    }

    // a pasta nasce aqui, depois de todas as recusas (e o que o `--refazer` vai trocar sai agora)
    for (const rel of paraApagar) await disco.apagar(juntar(pasta, rel))
    await disco.criarPasta(pasta, MODO_DA_PASTA)

    // 5 ── cada (tabela, mês) vira um arquivo
    const arquivos: ArquivoDoManifesto[] = []
    for (const e of registro) {
      const colunas = colunasPorTabela.get(e.tabela)
      if (!colunas) continue
      const colunaDaSoma = colunasDaExpressao(e.soma)?.[0] ?? null
      for (const k of contagens.filter(x => x.tabela === e.tabela)) {
        const unico = e.periodo === null
        const periodo = unico ? 'unico' : k.inicio.slice(0, 7)
        const lido = await lerCsvDoBanco(sql, {
          consulta: consultaDoArquivo({ tabela: e.tabela, filtro: e.filtro, periodo: e.periodo, ordem: e.ordem, colunas: colunas.map(x => x.nome) }),
          parametros: unico ? [o.canalId] : [o.canalId, k.inicio],
          colunas: colunas.map(x => x.nome), colunaDaSoma, colunasDeOrdem: colunasDaExpressao(e.ordem),
        })
        // a soma do banco existe: o arquivo tem de somar igual, e soma que o export não sabe refazer (nula) é diferença, nunca conferência pulada em silêncio
        if (lido.linhas !== k.linhas || (k.soma !== null && lido.soma !== k.soma)) {
          await desfazer()
          return recusarLimpando('contagem_do_arquivo_difere', [`${e.tabela} ${unico ? 'arquivo único' : periodo}: banco ${k.linhas}, arquivo ${lido.linhas}`])
        }
        const gz = gzipSync(lido.csv, { level: 9 })
        const caminho = caminhoDoArquivo(e.tabela, o.canalId, periodo)
        await disco.criarPasta(diretorioDe(juntar(pasta, caminho)), MODO_DA_PASTA)
        await gravar(caminho, gz)
        arquivos.push({
          tabela: e.tabela, canal: o.canalId, periodo,
          periodStart: unico ? '1970-01-01' : k.inicio, periodEnd: unico ? '1970-01-01' : ultimoDiaDoMes(k.inicio),
          caminho, linhas: lido.linhas, soma: k.soma, menorChave: lido.menorChave, maiorChave: lido.maiorChave,
          sha256: sha256(gz), csvSha256: lido.sha256, colunas,
        })
      }
    }

    // 6 ── as URLs de miniatura, ainda dentro da transação; depois o commit da leitura
    const urls = await lerMiniaturasDoBanco(sql, o.canalId)
    await fechar(sql, 'commit')
    aberta = false

    // 7 ── as miniaturas, com a transação já fechada
    const usados = new Set<string>()
    const baixadas = await baixarMiniaturas(urls.map(u => u.url), { baixar: o.baixar, paralelo: 4, tentativas: 3 })
    const falhas = baixadas.filter(b => b.status !== 200 && b.status !== 404)
    if (falhas.length > 0) return recusarLimpando('miniaturas_nao_baixaram', [`${falhas.length} miniatura(s) sem resposta útil (estados: ${[...new Set(falhas.map(f => f.status))].sort().join(', ')})`])
    const ausentes = baixadas.filter(b => b.status === 404).length
    if (ausentes > 0 && !o.aceitarMiniaturasAusentes) return recusarLimpando('miniaturas_ausentes', [`${ausentes} miniatura(s) ausente(s)`])
    const miniaturas: MiniaturaDoManifesto[] = []
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i]!
      const b = baixadas[i]!
      if (b.status === 404 || b.corpo === null) {
        miniaturas.push({ url: u.url, caminhoNoBlob: caminhoNoBlobDe(u.url), caminho: null, bytes: null, sha256: null, ausente: true })
        continue
      }
      const caminho = caminhoDaMiniatura(u.url, u.video, usados)
      await disco.criarPasta(diretorioDe(juntar(pasta, caminho)), MODO_DA_PASTA)
      await gravar(caminho, b.corpo)
      miniaturas.push({ url: u.url, caminhoNoBlob: caminhoNoBlobDe(u.url), caminho, bytes: b.corpo.byteLength, sha256: sha256(b.corpo), ausente: false })
    }

    // 8 ── o manifesto, por último
    const manifesto: Manifesto = {
      versao: VERSAO_DO_MANIFESTO, script: o.versaoDoScript, lote: o.lote, site: o.siteId,
      canal: { id: o.canalId, youtubeId: texto(c.channel_id), nome: c.channel_name === null || c.channel_name === undefined ? null : texto(c.channel_name) },
      geradoEm: o.agora().toISOString(), sessao: { timezone: 'UTC', extraFloatDigits: 3 },
      arquivos, tabelasSemLinha, tabelasAusentes, excluidas, miniaturas, esquema,
    }
    const json = Buffer.from(JSON.stringify(manifesto, null, 2) + '\n', 'utf8')
    await gravar('manifesto.json', json)
    await gravar('manifesto.sha256', Buffer.from(textoDoSha256(manifesto, sha256(json)), 'utf8'))
    manifestoCompleto = true

    // 9 ── o registro, numa segunda transação (de escrita): o banco confere as contagens de novo
    try {
      await sql.query('begin')
      aberta = true
      await sql.query('select public.obs_archive_register($1, $2, $3, $4::jsonb)', [o.siteId, o.lote, o.canalId, JSON.stringify(paraRegistro(manifesto))])
      await fechar(sql, 'commit')
      aberta = false
    } catch (err) {
      await desfazer()
      return recusa(codigoE10(err as { message?: string; code?: string }))
    }
    return {
      ok: true, lote: o.lote, arquivos: arquivos.length, linhas: arquivos.reduce((s, a) => s + a.linhas, 0),
      miniaturas: miniaturas.length - miniaturasAusentes(manifesto), miniaturasAusentes: miniaturasAusentes(manifesto),
    }
  } catch (err) {
    await desfazer()
    const ficaram = manifestoCompleto ? [] : await limparGravados()
    const c = codigoE10(err as { message?: string; code?: string })
    return recusa(c === 'inesperado' ? 'erro_do_banco' : c, comOQueFicou(undefined, ficaram))
  }
}
