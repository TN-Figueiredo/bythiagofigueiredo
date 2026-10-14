// A5 · E7, Tarefa 2: um falso de PostgREST em memória e a base sintética da etapa.
// Não é o banco: é o suficiente para provar o que o serviço pede (colunas, filtros, ordem, tempo limite) e o que ele
// faz com a resposta. O que amarra o falso ao banco de verdade é a Tarefa 8b (integração contra o PostgREST local).
// Método que o falso não conhece LANÇA (nunca devolve a tabela inteira por engano). Toda a base é sintética.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceContext } from '@/lib/pipeline/services/types'

export type Linha = Record<string, unknown>
export type Tabelas = Record<string, Linha[]>
export type ModoDaTabela = 'ausente' | 'erro' | 'lanca' | 'nulo' | 'aborta'

/** Texto plantado nos erros: se aparecer numa resposta, vazou mensagem do banco. */
export const SENTINELA_ERRO = 'SENTINELA_ERRO_DO_BANCO'

export interface Filtro { op: 'eq' | 'neq' | 'in' | 'is' | 'lt' | 'gte' | 'lte' | 'or'; coluna: string; valor: unknown }
export interface Ordem { coluna: string; ascendente: boolean; nullsFirst: boolean | undefined }
export interface Consulta {
  /** Posição da consulta entre as da mesma tabela (começa em 0). */
  n: number
  tabela: string
  select: string
  /** Colunas do nível de cima; as incorporadas entram como `relacao.coluna`. */
  colunas: string[]
  filtros: Filtro[]
  ordens: Ordem[]
  limite: number | null
  faixa: [number, number] | null
  abortSignal: boolean
  maybeSingle: boolean
}

interface Falha { modo: ModoDaTabela; quando?: (c: Consulta) => boolean }

/** Relações que o falso sabe incorporar: tabela → nome da relação → coluna que aponta e tabela de destino. */
const RELACOES: Record<string, Record<string, { fk: string; tabela: string }>> = {
  competitor_changes: { competitor_videos: { fk: 'video_id', tabela: 'competitor_videos' } },
  competitor_videos: { competitor_channels: { fk: 'competitor_channel_id', tabela: 'competitor_channels' } },
}

interface Campo { nome: string; incorporado: null | { interno: boolean; subselect: string } }

/** Divide por vírgula só no nível de cima (as incorporações têm parênteses). */
function dividir(s: string): string[] {
  const out: string[] = []
  let prof = 0, atual = ''
  for (const ch of s) {
    if (ch === '(') prof++
    if (ch === ')') prof--
    if (ch === ',' && prof === 0) { out.push(atual.trim()); atual = ''; continue }
    atual += ch
  }
  if (atual.trim()) out.push(atual.trim())
  return out
}

function campos(select: string): Campo[] {
  return dividir(select).map(tok => {
    const m = /^(\w+)(!inner)?\((.*)\)$/s.exec(tok)
    return m ? { nome: m[1]!, incorporado: { interno: m[2] === '!inner', subselect: m[3]! } } : { nome: tok, incorporado: null }
  })
}

function comparar(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  return Number(a) - Number(b)
}

function sorteio(l: Linha[], ordens: Ordem[]): Linha[] {
  if (ordens.length === 0) return l
  return [...l].sort((x, y) => {
    for (const o of ordens) {
      const a = x[o.coluna] ?? null, b = y[o.coluna] ?? null
      if (a === null && b === null) continue
      // padrão do Postgres: nulos por último na ordem crescente, primeiro na decrescente
      const nulosPrimeiro = o.nullsFirst ?? !o.ascendente
      if (a === null) return nulosPrimeiro ? -1 : 1
      if (b === null) return nulosPrimeiro ? 1 : -1
      const c = comparar(a, b)
      if (c !== 0) return o.ascendente ? c : -c
    }
    return 0
  })
}

/** A única forma de `or` que o falso aceita: `a.lt."X",and(a.eq."X",b.lt.Y)` (a continuação de `changes`). */
const OR_CONTINUACAO = /^(\w+)\.lt\."([^"]+)",and\(\1\.eq\."\2",(\w+)\.lt\.([^)]+)\)$/

function passa(l: Linha, f: Filtro): boolean {
  const v = l[f.coluna] ?? null
  switch (f.op) {
    case 'eq': return v !== null && v === f.valor
    case 'neq': return v !== null && v !== f.valor
    case 'in': return Array.isArray(f.valor) && f.valor.includes(v)
    case 'is': return f.valor === null ? v === null : v === f.valor
    case 'lt': return v !== null && comparar(v, f.valor) < 0
    case 'gte': return v !== null && comparar(v, f.valor) >= 0
    case 'lte': return v !== null && comparar(v, f.valor) <= 0
    case 'or': {
      const m = OR_CONTINUACAO.exec(String(f.valor))
      if (!m) throw new Error('o falso só aceita o or da continuação: ' + String(f.valor))
      const [, a, texto, b, id] = m
      const va = l[a!] ?? null, vb = l[b!] ?? null
      if (va === null) return false
      return comparar(va, texto) < 0 || (comparar(va, texto) === 0 && vb !== null && comparar(vb, Number(id)) < 0)
    }
  }
}

export interface BancoFalso {
  /** O cliente, tipado como o do Supabase só para entrar em `ServiceContext`. */
  sb: SupabaseClient
  tabelas: Tabelas
  consultas: Consulta[]
  falha(tabela: string, modo: ModoDaTabela, quando?: (c: Consulta) => boolean): void
  limparFalhas(): void
  doTabela(tabela: string): Consulta[]
  total(tabela: string): number
}

type Resposta = { data: unknown; error: { code: string; message: string } | null }

export function criarBancoFalso(tabelas: Tabelas): BancoFalso {
  const consultas: Consulta[] = []
  const contagem = new Map<string, number>()
  let falhas = new Map<string, Falha[]>()

  function projetar(tabela: string, l: Linha, select: string): Linha | null {
    const campo = campos(select)
    if (campo.length === 1 && campo[0]!.nome === '*') return { ...l }
    const out: Linha = {}
    for (const c of campo) {
      if (!c.incorporado) { out[c.nome] = l[c.nome] ?? null; continue }
      const rel = RELACOES[tabela]?.[c.nome]
      if (!rel) throw new Error('relação desconhecida no falso: ' + tabela + '.' + c.nome)
      const alvo = (tabelas[rel.tabela] ?? []).find(x => x['id'] === l[rel.fk]) ?? null
      const filho = alvo ? projetar(rel.tabela, alvo, c.incorporado.subselect) : null
      if (filho === null && c.incorporado.interno) return null
      out[c.nome] = filho
    }
    return out
  }

  function colunasDe(select: string): string[] {
    const out: string[] = []
    for (const c of campos(select)) {
      if (!c.incorporado) out.push(c.nome)
      else for (const sub of colunasDe(c.incorporado.subselect)) out.push(c.nome + '.' + sub)
    }
    return out
  }

  class Consultavel implements PromiseLike<Resposta> {
    private c: Consulta
    constructor(tabela: string) {
      const n = contagem.get(tabela) ?? 0
      contagem.set(tabela, n + 1)
      this.c = { n, tabela, select: '*', colunas: ['*'], filtros: [], ordens: [], limite: null, faixa: null, abortSignal: false, maybeSingle: false }
      consultas.push(this.c)
    }
    select(s = '*') { this.c.select = s; this.c.colunas = colunasDe(s); return this }
    eq(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'eq', coluna, valor }); return this }
    neq(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'neq', coluna, valor }); return this }
    in(coluna: string, valor: readonly unknown[]) { this.c.filtros.push({ op: 'in', coluna, valor }); return this }
    is(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'is', coluna, valor }); return this }
    lt(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'lt', coluna, valor }); return this }
    gte(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'gte', coluna, valor }); return this }
    lte(coluna: string, valor: unknown) { this.c.filtros.push({ op: 'lte', coluna, valor }); return this }
    or(expr: string) { this.c.filtros.push({ op: 'or', coluna: '', valor: expr }); return this }
    order(coluna: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
      this.c.ordens.push({ coluna, ascendente: o?.ascending ?? true, nullsFirst: o?.nullsFirst })
      return this
    }
    limit(n: number) { this.c.limite = n; return this }
    range(a: number, b: number) { this.c.faixa = [a, b]; return this }
    abortSignal(_s: AbortSignal) { this.c.abortSignal = true; return this }
    maybeSingle() { this.c.maybeSingle = true; return this }

    then<A = Resposta, B = never>(ok?: ((v: Resposta) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
      return this.executar().then(ok, no)
    }

    private async executar(): Promise<Resposta> {
      const c = this.c
      const falha = (falhas.get(c.tabela) ?? []).find(f => !f.quando || f.quando(c))
      if (falha?.modo === 'lanca') throw new Error(SENTINELA_ERRO)
      if (falha?.modo === 'aborta') throw new DOMException('The operation was aborted. ' + SENTINELA_ERRO, 'AbortError')
      if (falha?.modo === 'ausente') return { data: null, error: { code: '42P01', message: 'relation "' + c.tabela + '" does not exist ' + SENTINELA_ERRO } }
      if (falha?.modo === 'erro') return { data: null, error: { code: 'XX000', message: SENTINELA_ERRO } }
      if (falha?.modo === 'nulo') return { data: null, error: null }
      const base = tabelas[c.tabela]
      if (!base) return { data: null, error: { code: '42P01', message: 'tabela sem dados no falso: ' + c.tabela } }
      let l = base.filter(x => c.filtros.every(f => passa(x, f)))
      l = sorteio(l, c.ordens)
      if (c.faixa) l = l.slice(c.faixa[0], c.faixa[1] + 1)
      if (c.limite !== null) l = l.slice(0, c.limite)
      const proj = l.map(x => projetar(c.tabela, x, c.select)).filter((x): x is Linha => x !== null)
      if (c.maybeSingle) return { data: proj[0] ?? null, error: null }
      return { data: proj, error: null }
    }
  }

  const cliente = { from: (tabela: string) => new Consultavel(tabela) }
  return {
    sb: cliente as never,
    tabelas,
    consultas,
    falha(tabela, modo, quando) { falhas.set(tabela, [...(falhas.get(tabela) ?? []), { modo, quando }]) },
    limparFalhas() { falhas = new Map() },
    doTabela: t => consultas.filter(c => c.tabela === t),
    total: t => consultas.filter(c => c.tabela === t).length,
  }
}

// ---------------------------------------------------------------------------
// A base sintética
// ---------------------------------------------------------------------------

/** Instante fixo, no passado: tudo na base é relativo a ele. */
export const AGORA = Date.parse('2026-10-12T12:00:00.000Z')
export const aoDia = (diasAntes: number, horas = 0): string => new Date(AGORA - diasAntes * 86_400_000 - horas * 3_600_000).toISOString()

export const SITE_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
export const SITE_B = 'bbbbbbbb-0000-4000-8000-00000000000b'
/** O mesmo canal do YouTube acompanhado pelos dois sites. */
export const YT_COMPARTILHADO = 'UC_SINTETICO_COMPARTILHADO'

export const CANAL_A1 = 'c1a00000-0000-4000-8000-000000000001'
export const CANAL_A2 = 'c1a00000-0000-4000-8000-000000000002'
export const CANAL_A3 = 'c1a00000-0000-4000-8000-000000000003'
export const CANAL_B1 = 'c1b00000-0000-4000-8000-000000000001'

const id = (prefixo: string, n: number) => prefixo + String(n).padStart(8, '0').slice(-8) + '-0000-4000-8000-000000000000'
export const idVideo = (n: number): string => id('d', n)
export const idMudanca = (n: number): string => id('e', n)

function canal(idc: string, site: string, ytId: string, nome: string, addedDiasAntes: number, subs: number | null): Linha {
  return {
    id: idc, site_id: site, channel_id: ytId, channel_name: nome, thumbnail_url: 'https://exemplo.test/' + nome + '.jpg',
    subscriber_count: subs, last_synced_at: aoDia(0, 2), added_at: aoDia(addedDiasAntes),
    custom_url: null, country: null, published_at: null, last_seen_at: null,
  }
}

function video(n: number, canalId: string, titulo: string, views: number | null, likes: number | null, comentarios: number | null, publicadoDiasAntes: number): Linha {
  return {
    id: idVideo(n), competitor_channel_id: canalId, video_id: 'yt_sintetico_' + n, title: titulo,
    view_count: views, like_count: likes, comment_count: comentarios, published_at: aoDia(publicadoDiasAntes),
    last_seen_at: null, missing_since: null,
  }
}

function mudanca(n: number, site: string, videoN: number, tipo: 'title' | 'description' | 'thumbnail', diasAntes: number, favorita: boolean, views: number | null): Linha {
  return {
    id: idMudanca(n), site_id: site, video_id: idVideo(videoN), change_type: tipo,
    old_title: tipo === 'thumbnail' ? null : 'Título velho ' + n, new_title: tipo === 'thumbnail' ? null : 'Título novo ' + n,
    old_thumbnail_url: tipo === 'thumbnail' ? 'https://exemplo.test/velha-' + n + '.jpg' : null,
    new_thumbnail_url: tipo === 'thumbnail' ? 'https://exemplo.test/nova-' + n + '.jpg' : null,
    view_count_at_change: views, detected_at: aoDia(diasAntes), bookmarked: favorita,
  }
}

/**
 * Dois sites. Site A: 3 canais (o primeiro com o mesmo `channel_id` do YouTube de um canal do site B), 9 vídeos e 8 mudanças.
 * Site B: 1 canal, 3 vídeos e 2 mudanças. As tabelas novas (versões de campo, retratos) começam vazias: cada teste põe as suas.
 */
export function baseE7(): Tabelas {
  return {
    competitor_channels: [
      canal(CANAL_A1, SITE_A, YT_COMPARTILHADO, 'Canal Alfa', 30, 120_000),
      canal(CANAL_A2, SITE_A, 'UC_SINTETICO_BETA', 'Canal Beta', 20, null),
      canal(CANAL_A3, SITE_A, 'UC_SINTETICO_GAMA', 'Canal Gama', 10, 4_500),
      canal(CANAL_B1, SITE_B, YT_COMPARTILHADO, 'Canal Alfa do Outro Site', 5, 120_000),
    ],
    competitor_videos: [
      video(1, CANAL_A1, 'Alfa um', 1000, 100, 10, 40), video(2, CANAL_A1, 'Alfa dois', 2000, 150, 20, 30), video(3, CANAL_A1, 'Alfa três', 3000, 90, 5, 20),
      video(4, CANAL_A2, 'Beta um', 500, 10, 1, 35), video(5, CANAL_A2, 'Beta dois', null, null, null, 25), video(6, CANAL_A2, 'Beta três', 800, 40, 4, 15),
      video(7, CANAL_A3, 'Gama um', 0, 0, 0, 12), video(8, CANAL_A3, 'Gama dois', 100, 5, 0, 8), video(9, CANAL_A3, 'Gama três', 250, 20, 2, 3),
      video(10, CANAL_B1, 'Outro um', 9000, 900, 90, 20), video(11, CANAL_B1, 'Outro dois', 7000, 700, 70, 10), video(12, CANAL_B1, 'Outro três', 5000, 500, 50, 4),
    ],
    competitor_changes: [
      mudanca(1, SITE_A, 1, 'title', 9, false, 900), mudanca(2, SITE_A, 2, 'thumbnail', 8, true, 1800), mudanca(3, SITE_A, 3, 'title', 7, false, 2500),
      mudanca(4, SITE_A, 4, 'description', 6, false, 400), mudanca(5, SITE_A, 6, 'thumbnail', 5, true, null), mudanca(6, SITE_A, 7, 'title', 4, false, 0),
      mudanca(7, SITE_A, 8, 'title', 3, true, 90), mudanca(8, SITE_A, 9, 'thumbnail', 2, false, 200),
      mudanca(9, SITE_B, 10, 'title', 6, false, 8000), mudanca(10, SITE_B, 11, 'thumbnail', 3, true, 6500),
    ],
    competitor_field_versions: [],
  }
}

export function contextoDe(banco: BancoFalso, siteId: string = SITE_A): ServiceContext {
  return { siteId, permissions: ['read'], supabase: banco.sb }
}
