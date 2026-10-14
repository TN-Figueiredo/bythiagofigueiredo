// @vitest-environment node
/**
 * A5 · E10, Tarefa 10 (item 231, OP-11): a lista fechada do que apaga dado no Observatório, parte estática (roda na CI).
 * Varre o código-fonte atrás de `.delete()` de cliente do banco, `delete from` em texto e `del(` do Blob. Toda ocorrência tem de casar
 * com um par (arquivo, tabela) da lista abaixo; par sem ocorrência também falha. Quem apaga algo novo muda a lista de propósito.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../../../', import.meta.url))

export interface ParDaLista { arquivo: string; tabela: string; disparo: 'dono' | 'cron' | 'forja'; classe: string; excecao?: string }

/** Caminhos relativos a `apps/web/`. A linha de cada par é a de 9.2 do spec (ver o plano da E10, Tarefa 10). */
const LISTA: ParDaLista[] = [
  { arquivo: 'src/app/cms/(authed)/youtube/competitors/actions.ts', tabela: 'competitor_channels', disparo: 'dono', classe: 'dado coletado, com export (a 11b move a ocorrência para a função do banco e atualiza esta linha)' },
  { arquivo: 'src/app/api/cron/sync-analytics-metrics/route.ts', tabela: 'yt_own_collection_runs', disparo: 'cron', classe: 'estado de execução' },
  { arquivo: 'src/lib/youtube/coleta/alerts.ts', tabela: 'ops_alert_state', disparo: 'cron', classe: 'estado de execução' },
  { arquivo: 'src/lib/pipeline/services/forja-queue.ts', tabela: 'youtube_intelligence_tasks', disparo: 'dono', classe: 'fila (só as pendentes)' },
  { arquivo: 'src/lib/pipeline/services/forja-queue.ts', tabela: 'competitor_readings', disparo: 'forja', classe: 'desfaz gravação órfã ou incompleta' },
  // R6: o apagamento por idade que a lista do spec não tinha. EXCEÇÃO declarada (pergunta R-A ao dono): nada sai antes de o retrato fazer 365 dias.
  { arquivo: 'src/app/api/cron/ab-watchdog/route.ts', tabela: 'competitor_channel_snapshots', disparo: 'cron', classe: 'retrato de canal com mais de 365 dias', excecao: 'R-A' },
  // Fora do Observatório (A/B Lab), mas na pasta varrida: classificado para não sair da lista sem aviso.
  { arquivo: 'src/app/api/cron/ab-watchdog/route.ts', tabela: 'ab_test_polls', disparo: 'cron', classe: 'leitura do A/B Lab com mais de 7 dias (não é do Observatório)' },
  // Linha 17 (E10 T11a): o único `del` do Blob do Observatório. Prefixo `observatorio/thumbs/`, conferido por `soMiniaturasDoObservatorio`.
  { arquivo: 'src/lib/youtube/observatorio/arquivo/remover.ts', tabela: 'blob', disparo: 'dono', classe: 'miniatura de canal removido, com cópia conferida no arquivo (prefixo observatorio/thumbs/; nova tentativa diária das pendências)' },
  // Poda do acesso externo da IA (E17, MG11): a tabela chega por parâmetro de `podarTabela`, resolvido em PARAMETROS_RESOLVIDOS.
  { arquivo: 'src/lib/youtube/observatorio/acesso-ia/poda.ts', tabela: 'obs_ai_access_log', disparo: 'cron', classe: 'registro de acesso da IA com mais de 400 dias' },
  { arquivo: 'src/lib/youtube/observatorio/acesso-ia/poda.ts', tabela: 'obs_ai_rate', disparo: 'cron', classe: 'contador de taxa da IA com mais de 2 dias' },
]

/** Identificador de `from(...)` que não é constante, e sim parâmetro: vale só para o par (arquivo, identificador), com os valores conferidos no próprio texto. */
const PARAMETROS_RESOLVIDOS: Array<{ arquivo: string; ident: string; funcao: string; valores: string[] }> = [
  { arquivo: 'src/lib/youtube/observatorio/acesso-ia/poda.ts', ident: 'tabela', funcao: 'podarTabela', valores: ['obs_ai_access_log', 'obs_ai_rate'] },
]

/** Item 78: nenhuma série, versão, texto de comentário ou bruto sai por idade nem por cron. A exceção declarada tem nome. */
const PROIBIDAS_POR_CRON = [
  'competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly', 'competitor_video_versions', 'competitor_field_versions',
  'competitor_raw', 'competitor_video_comments', 'competitor_channel_snapshots', 'yt_reporting_report_blobs', 'yt_own_video_daily',
]

const PASTAS = [
  'src/lib/youtube',
  'src/app/api/cron/sync-youtube',
  'src/app/api/cron/sync-analytics-metrics',
  'src/app/api/cron/ab-watchdog',
  'src/app/cms/(authed)/youtube/competitors',
]
const ARQUIVOS = ['src/lib/pipeline/services/forja-queue.ts', '../../scripts/obs-arquivo.ts']

export interface Ocorrencia { arquivo: string; tabela: string | null; tipo: 'delete' | 'delete_from' | 'blob'; linha: number }
export interface Ignorada { arquivo: string; linha: number; temArgumento: boolean; temFromAntes: boolean }
export interface Varredura { ocorrencias: Ocorrencia[]; ignoradas: Ignorada[] }

const linhaDe = (texto: string, i: number): number => texto.slice(0, i).split('\n').length

/** O texto da cadeia que termina em `pos`: a linha de `pos` mais as linhas anteriores enquanto a linha atual começa por `.`. */
function cadeiaAte(texto: string, pos: number): string {
  const linhas = texto.split('\n')
  const n = linhaDe(texto, pos)
  const inicioDaLinha = texto.lastIndexOf('\n', pos - 1) + 1
  let primeira = n - 1
  while (primeira > 0 && linhas[primeira].trimStart().startsWith('.')) primeira--
  const ate = texto.slice(inicioDaLinha, pos)
  return [...linhas.slice(primeira, n - 1), ate].join('\n')
}

const FROM_RE = /(?<!Array|Buffer|Object)\.from\(/g

function resolverTabela(cadeia: string, texto: string, arquivo: string): string | null {
  let ultimo = -1
  for (const m of cadeia.matchAll(FROM_RE)) ultimo = m.index ?? -1
  if (ultimo < 0) return null
  const resto = cadeia.slice(ultimo + '.from('.length)
  const lit = /^\s*(?:'([^']+)'|"([^"]+)")\s*\)/.exec(resto)
  if (lit) return lit[1] ?? lit[2]
  const id = /^\s*([A-Za-z_]\w*)\s*\)/.exec(resto)
  if (id) {
    const c = new RegExp(`const\\s+${id[1]}\\s*=\\s*(?:'([^']+)'|"([^"]+)")`).exec(texto)
    if (c) return c[1] ?? c[2]
    const p = PARAMETROS_RESOLVIDOS.find(x => x.arquivo === arquivo && x.ident === id[1])
    if (p && p.valores.every(v => new RegExp(`${p.funcao}\\([^,]+,\\s*'${v}'`).test(texto))) return p.valores.join('|')
  }
  return null
}

export function varrer(arquivo: string, texto: string): { ocorrencias: Ocorrencia[]; ignoradas: Ignorada[] } {
  const ocorrencias: Ocorrencia[] = []
  const ignoradas: Ignorada[] = []
  for (const m of texto.matchAll(/\.delete\(/g)) {
    const i = m.index ?? 0
    const vazio = /^\.delete\(\s*(\{[^)]*\})?\s*\)/.test(texto.slice(i))
    const cadeia = cadeiaAte(texto, i)
    if (vazio) {
      ocorrencias.push({ arquivo, tabela: resolverTabela(cadeia, texto, arquivo), tipo: 'delete', linha: linhaDe(texto, i) })
    } else {
      ignoradas.push({ arquivo, linha: linhaDe(texto, i), temArgumento: true, temFromAntes: [...cadeia.matchAll(FROM_RE)].length > 0 })
    }
  }
  for (const m of texto.matchAll(/delete\s+from\s+(?:public\.)?([a-z_0-9]+)/gi)) {
    ocorrencias.push({ arquivo, tabela: m[1], tipo: 'delete_from', linha: linhaDe(texto, m.index ?? 0) })
  }
  const importaDel = /import\s*\{[^}]*\bdel\b[^}]*\}\s*from\s*['"]@vercel\/blob['"]/.test(texto)
  if (importaDel) {
    for (const m of texto.matchAll(/(?<![\w.])del\(/g)) ocorrencias.push({ arquivo, tabela: 'blob', tipo: 'blob', linha: linhaDe(texto, m.index ?? 0) })
    if (!/(?<![\w.])del\(/.test(texto)) ocorrencias.push({ arquivo, tabela: 'blob', tipo: 'blob', linha: 1 })
  }
  return { ocorrencias, ignoradas }
}

function listarFontes(dir: string, saida: string[]): void {
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome)
    if (statSync(cheio).isDirectory()) {
      if (nome === 'node_modules' || nome.startsWith('ab-')) continue
      listarFontes(cheio, saida)
    } else if (/\.(ts|tsx)$/.test(nome) && !nome.startsWith('ab-')) {
      saida.push(cheio)
    }
  }
}

function varrerRepositorio(): Varredura & { lidos: number } {
  const arquivos: string[] = []
  for (const p of PASTAS) if (existsSync(join(WEB, p))) listarFontes(join(WEB, p), arquivos)
  for (const a of ARQUIVOS) if (existsSync(join(WEB, a))) arquivos.push(join(WEB, a))
  const ocorrencias: Ocorrencia[] = []
  const ignoradas: Ignorada[] = []
  for (const f of arquivos) {
    const v = varrer(relative(WEB, f), readFileSync(f, 'utf8'))
    ocorrencias.push(...v.ocorrencias)
    ignoradas.push(...v.ignoradas)
  }
  return { ocorrencias, ignoradas, lidos: arquivos.length }
}

const chave = (arquivo: string, tabela: string): string => `${arquivo}::${tabela}`

/** Cada ocorrência vira uma ou mais chaves (o parâmetro resolvido devolve vários valores). */
function chavesDe(o: Ocorrencia): string[] {
  if (o.tabela === null) return [chave(o.arquivo, '<tabela não resolvida>')]
  return o.tabela.split('|').map(t => chave(o.arquivo, t))
}

function conferir(v: Varredura, lista: ParDaLista[]): { semPar: string[]; semOcorrencia: string[] } {
  const naLista = new Set(lista.map(p => chave(p.arquivo, p.tabela)))
  const achadas = new Set(v.ocorrencias.flatMap(chavesDe))
  return {
    semPar: [...achadas].filter(k => !naLista.has(k)).sort(),
    semOcorrencia: [...naLista].filter(k => !achadas.has(k)).sort(),
  }
}

describe('A5 E10 T10: a lista fechada do que apaga (estático)', () => {
  const real = varrerRepositorio()

  it('a varredura leu pelo menos N arquivos (pasta vazia ou caminho errado falha, não passa)', () => {
    expect(real.lidos).toBeGreaterThan(100)
    for (const a of ARQUIVOS) expect(existsSync(join(WEB, a)), a).toBe(true)
    for (const p of PASTAS) expect(existsSync(join(WEB, p)), p).toBe(true)
  })

  it('toda ocorrência tem par e todo par tem ocorrência', () => {
    const r = conferir(real, LISTA)
    expect(r.semPar, 'apagamento sem par na lista: classifique-o aqui, de propósito').toEqual([])
    expect(r.semOcorrencia, 'par da lista sem ocorrência no código').toEqual([])
  })

  it('toda ocorrência de cliente do banco resolveu a tabela', () => {
    expect(real.ocorrencias.filter(o => o.tabela === null).map(o => `${o.arquivo}:${o.linha}`)).toEqual([])
  })

  it('o teste enxerga: exemplos ruins embutidos são acusados', () => {
    const ruins: Array<[string, string]> = [
      ['src/lib/youtube/ruim-1.ts', "await sb.from('competitor_video_daily').delete().eq('x', 1)\n"],
      ['src/lib/youtube/ruim-2.ts', "const r = await sb\n  .from('competitor_video_hourly')\n  .delete()\n  .lt('t', 1)\n"],
      ['src/lib/youtube/ruim-3.ts', "const T = 'competitor_raw'\nawait sb.from(T).delete().eq('x', 1)\n"],
      ['src/lib/youtube/ruim-4.ts', "import { del } from '@vercel/blob'\nawait del(url)\n"],
    ]
    for (const [arquivo, texto] of ruins) {
      const v = varrer(arquivo, texto)
      const r = conferir(v, LISTA)
      expect(r.semPar.length, arquivo).toBeGreaterThan(0)
    }
    expect(varrer(ruins[0][0], ruins[0][1]).ocorrencias[0].tabela).toBe('competitor_video_daily')
    expect(varrer(ruins[1][0], ruins[1][1]).ocorrencias[0].tabela).toBe('competitor_video_hourly')
    expect(varrer(ruins[2][0], ruins[2][1]).ocorrencias[0].tabela).toBe('competitor_raw')
    expect(varrer(ruins[3][0], ruins[3][1]).ocorrencias[0].tipo).toBe('blob')
    expect(varrer('x.ts', 'sql`delete from competitor_raw where x`').ocorrencias[0].tabela).toBe('competitor_raw')
  })

  it('cadeia cuja tabela não resolve faz o teste falhar', () => {
    const v = varrer('src/lib/youtube/ruim-5.ts', 'await sb.from(funcao()).delete().eq("a", 1)\n')
    expect(v.ocorrencias).toHaveLength(1)
    expect(v.ocorrencias[0].tabela).toBeNull()
    expect(conferir(v, LISTA).semPar).toEqual(['src/lib/youtube/ruim-5.ts::<tabela não resolvida>'])
  })

  it('parâmetro como tabela só vale para o par declarado, com os valores conferidos no texto', () => {
    const texto = "async function f(sb, tabela) { return sb.from(tabela).delete({ count: 'exact' }) }\n"
    expect(varrer('src/lib/youtube/qualquer.ts', texto).ocorrencias[0].tabela).toBeNull()
  })

  it('toda ocorrência ignorada tem argumento e não vem de um from', () => {
    // a contagem de ignoradas é impressa, não afirmada: um `q.delete(k)` novo de outra trilha não pode derrubar este teste
    console.info(`[lista-fechada] ocorrências ignoradas (Map, Set, URLSearchParams): ${real.ignoradas.length}`)
    for (const g of real.ignoradas) {
      expect(g.temArgumento, `${g.arquivo}:${g.linha}`).toBe(true)
      expect(g.temFromAntes, `${g.arquivo}:${g.linha}: .delete(arg) de cliente do banco`).toBe(false)
    }
    const ruim = varrer('src/lib/youtube/ruim-6.ts', "await sb.from('competitor_raw').delete(opcoes)\n")
    expect(ruim.ignoradas).toHaveLength(1)
    expect(ruim.ignoradas[0].temFromAntes).toBe(true)
  })

  it('nenhum par com disparo "cron" aponta para tabela de série, versão, texto de comentário ou bruto (item 78), salvo a exceção declarada', () => {
    const cron = LISTA.filter(p => p.disparo === 'cron' && PROIBIDAS_POR_CRON.includes(p.tabela))
    expect(cron.map(p => `${p.tabela}:${p.excecao ?? 'SEM EXCEÇÃO'}`)).toEqual(['competitor_channel_snapshots:R-A'])
    // a exceção só vale para a retenção de 365 dias do próprio arquivo citado
    const texto = readFileSync(join(WEB, 'src/app/api/cron/ab-watchdog/route.ts'), 'utf8')
    expect(texto).toMatch(/365 \* 86400000/)
  })

  it('o conjunto proibido não mudou sem querer', () => {
    expect(PROIBIDAS_POR_CRON).toHaveLength(10)
    expect(new Set(PROIBIDAS_POR_CRON).size).toBe(10)
  })
})
