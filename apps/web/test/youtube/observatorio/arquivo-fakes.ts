/**
 * Falsos do export e da conferência (A5 · E10, Tarefa 6): um banco em memória que entende só as consultas do módulo `arquivo/`,
 * um disco em memória e um `baixar` falso. Usados por `arquivo-exportar.test.ts` e `arquivo-conferir.test.ts`. Tudo sintético.
 */
import { createHash } from 'node:crypto'
import type { ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import type { Disco } from '@/lib/youtube/observatorio/arquivo/exportar'
import type { Baixar } from '@/lib/youtube/observatorio/arquivo/miniaturas'

export const SITE = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
export const CANAL = '0a1b2c3d-1111-4222-8333-444455556666'
export const LOTE = 'canal-0a1b2c3d-teste'
export const RAIZ = '/arquivo'
export const PASTA = `${RAIZ}/${LOTE}`
export const AGORA = new Date('2026-10-13T15:00:00.000Z')

type Linha = Record<string, string | null>
export interface TabelaFalsa {
  colunas: Array<{ nome: string; tipo: string; nulo: boolean }>
  filtro: string
  /** null = arquivo único */
  periodo: string | null
  soma: string | null
  ordem: string
  linhas: Linha[]
  /** Como o mês de uma linha é calculado (primeiro dia, AAAA-MM-DD); só com `periodo`. */
  mes?: (l: Linha) => string
}

export function tabelasPadrao(): Record<string, TabelaFalsa> {
  return {
    competitor_channels: {
      colunas: [{ nome: 'id', tipo: 'uuid', nulo: false }, { nome: 'channel_name', tipo: 'text', nulo: true }],
      filtro: 't.id = $1', periodo: null, soma: null, ordem: 't.id',
      linhas: [{ id: CANAL, channel_name: 'Canal, "sintético"' }],
    },
    competitor_videos: {
      colunas: [{ nome: 'id', tipo: 'uuid', nulo: false }, { nome: 'title', tipo: 'text', nulo: true }],
      filtro: 't.competitor_channel_id = $1', periodo: null, soma: null, ordem: 't.id',
      linhas: [{ id: 'v1', title: 'um' }, { id: 'v2', title: '' }, { id: 'v3', title: null }],
    },
    competitor_video_daily: {
      colunas: [{ nome: 'video_id', tipo: 'uuid', nulo: false }, { nome: 'snap_date', tipo: 'date', nulo: false }, { nome: 'views', tipo: 'bigint', nulo: false }],
      filtro: 't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
      periodo: 't.snap_date', soma: 't.views', ordem: 't.video_id, t.snap_date',
      mes: l => l.snap_date!.slice(0, 7) + '-01',
      linhas: [
        { video_id: 'v1', snap_date: '2026-08-30', views: '100' }, { video_id: 'v1', snap_date: '2026-09-01', views: '9007199254740993' },
        { video_id: 'v2', snap_date: '2026-09-02', views: '7' },
      ],
    },
    // tabela do registro sem nenhuma linha do canal -> vai para tabelasSemLinha
    competitor_readings: {
      colunas: [{ nome: 'id', tipo: 'bigint', nulo: false }], filtro: 't.video_id in (select 1)', periodo: null, soma: null, ordem: 't.id', linhas: [],
    },
  }
}

export interface OpcoesDoBanco {
  tabelas?: Record<string, TabelaFalsa>
  /** Tabelas que o registro lista mas o banco ainda não tem. */
  ausentes?: string[]
  urls?: Array<{ url: string; video: string }>
  semPausa?: boolean
  pausaRecente?: boolean
  sincronizando?: boolean
  outroSite?: boolean
  naoCobertas?: string[]
  /** Chamado a cada consulta; se devolver um erro, ele é lançado. */
  falhaEm?: (texto: string, parametros: unknown[]) => Error | null
  /** O que `obs_archive_register` faz: lança isto, se dado. */
  erroDoRegistro?: { message: string; code?: string }
  erroDaVerificacao?: { message: string; code?: string }
}

export interface Chamada { texto: string; parametros: unknown[] }

export function bancoFalso(op: OpcoesDoBanco = {}) {
  const tabelas = op.tabelas ?? tabelasPadrao()
  const chamadas: Chamada[] = []
  const cursores = new Map<string, Linha[]>()
  const ausentes = new Set(op.ausentes ?? ['competitor_video_marks'])
  const urls = op.urls ?? []

  const contagens = (): Array<Record<string, unknown>> => {
    const out: Array<Record<string, unknown>> = []
    for (const [nome, t] of Object.entries(tabelas)) {
      if (t.linhas.length === 0) continue
      const grupos = new Map<string, Linha[]>()
      for (const l of t.linhas) {
        const m = t.periodo === null ? '1970-01-01' : t.mes!(l)
        grupos.set(m, [...(grupos.get(m) ?? []), l])
      }
      for (const [inicio, ls] of [...grupos].sort()) {
        const coluna = t.soma === null ? null : t.soma.replace(/^t\./, '')
        const soma = coluna === null ? null : ls.reduce((s, l) => s + BigInt(l[coluna] ?? '0'), BigInt(0)).toString()
        out.push({ table_name: nome, inicio, linhas: String(ls.length), soma })
      }
    }
    return out
  }

  const sql: ClienteSql = {
    async query(texto, parametros = []) {
      chamadas.push({ texto, parametros })
      const erro = op.falhaEm?.(texto, parametros)
      if (erro) throw erro
      const t = texto.trim()
      if (/^(begin|set local|commit|rollback)/.test(t)) return { rows: [] }
      if (/from public\.competitor_channels c where c\.id = \$1 and c\.site_id = \$2/.test(t)) {
        if (op.outroSite || parametros[1] !== SITE || parametros[0] !== CANAL) return { rows: [] }
        return { rows: [{ channel_id: 'UCsintetico', channel_name: 'Canal, "sintético"', sem_pausa: op.semPausa === true, pausa_recente: op.pausaRecente === true, sincronizando: op.sincronizando === true }] }
      }
      if (/obs_archive_uncovered\(\) as nomes/.test(t)) return { rows: [{ nomes: op.naoCobertas ?? [] }] }
      if (/from public\.obs_archive_registry\(\)/.test(t)) {
        const nomes = [...Object.keys(tabelas), ...ausentes]
        return { rows: nomes.map(n => {
          const x = tabelas[n]
          return { table_name: n, filter_sql: x?.filtro ?? 't.video_id in (select 1)', period_sql: x?.periodo ?? null, sum_sql: x?.soma ?? null, order_sql: x?.ordem ?? 't.video_id, t.age_days' }
        }) }
      }
      if (/obs_archive_excluded\(\)/.test(t)) return { rows: [{ table_name: 'competitor_video_comment_authors', reason: 'identidade do autor' }] }
      if (/obs_archive_channel_counts\(\$1\)/.test(t)) return { rows: contagens() }
      if (/to_regclass\('public\.' \|\| quote_ident\(\$1\)\) is not null as existe/.test(t)) return { rows: [{ existe: parametros[0] as string in tabelas }] }
      if (/from pg_attribute a/.test(t)) return { rows: (tabelas[parametros[0] as string]?.colunas ?? []).map(c => ({ nome: c.nome, tipo: c.tipo, nulo: c.nulo })) }
      if (/from public\.competitor_video_versions x join public\.competitor_videos v/.test(t)) return { rows: urls }
      const d = /^declare (\w+) no scroll cursor for (.*)$/s.exec(t)
      if (d) {
        const nome = /from public\."(\w+)" t/.exec(d[2]!)![1]!
        const tabela = tabelas[nome]!
        const mes = parametros[1] as string | undefined
        cursores.set(d[1]!, tabela.linhas.filter(l => mes === undefined || tabela.mes!(l) === mes).map(l => ({ ...l })))
        return { rows: [] }
      }
      const f = /^fetch forward (\d+) from (\w+)/.exec(t)
      if (f) {
        const fila = cursores.get(f[2]!) ?? []
        return { rows: fila.splice(0, Number(f[1])) }
      }
      if (/^close /.test(t)) return { rows: [] }
      if (/obs_archive_register/.test(t)) {
        if (op.erroDoRegistro) throw Object.assign(new Error(op.erroDoRegistro.message), { code: op.erroDoRegistro.code ?? 'P0001' })
        return { rows: [{ r: { status: 'exportado' } }] }
      }
      if (/obs_archive_verify/.test(t)) {
        if (op.erroDaVerificacao) throw Object.assign(new Error(op.erroDaVerificacao.message), { code: op.erroDaVerificacao.code ?? 'P0001' })
        return { rows: [{ r: { status: 'conferido' } }] }
      }
      throw new Error('consulta que o falso não conhece: ' + t.slice(0, 80))
    },
  }
  return { sql, chamadas, tabelas }
}

export const sha = (d: Uint8Array | string): string => createHash('sha256').update(d).digest('hex')

export function discoFalso(inicial: Record<string, Uint8Array | string> = {}, opcoes: { repositorio?: boolean } = {}) {
  const arquivos = new Map<string, Uint8Array>()
  const eventos: string[] = []
  for (const [p, c] of Object.entries(inicial)) arquivos.set(p, typeof c === 'string' ? Buffer.from(c) : c)
  const pastas = new Set<string>()
  const disco: Disco = {
    async existe(p) {
      return arquivos.has(p) || pastas.has(p) || [...arquivos.keys()].some(k => k.startsWith(p + '/'))
    },
    async listar(p) {
      return [...arquivos.keys()].filter(k => k.startsWith(p + '/')).map(k => k.slice(p.length + 1)).sort()
    },
    async criarPasta(p) { eventos.push('criarPasta ' + p); pastas.add(p) },
    async gravar(p, d) { eventos.push('gravar ' + p); arquivos.set(p, d) },
    async ler(p) {
      const d = arquivos.get(p)
      if (!d) throw new Error('ENOENT ' + p)
      return d
    },
    async apagar(p) { eventos.push('apagar ' + p); arquivos.delete(p) },
    async dentroDeRepositorio() { return opcoes.repositorio === true },
  }
  return { disco, arquivos, eventos }
}

/** `baixar` falso: 200 com bytes derivados da URL, ou o que o mapa disser (estado, ou erro lançado). */
export function baixarFalso(respostas: Record<string, number | 'lanca'> = {}) {
  const chamadas: string[] = []
  const baixar: Baixar = async url => {
    chamadas.push(url)
    const r = respostas[url]
    if (r === 'lanca') throw new Error('rede')
    if (r !== undefined && r !== 200) return { status: r, corpo: null }
    return { status: 200, corpo: new Uint8Array(Buffer.from('imagem:' + url)) }
  }
  return { baixar, chamadas }
}
