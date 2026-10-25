// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts
/** Manutenção M9: o resumo do mês refeito a partir das unidades já filtradas (02 §11.3). Puro. A prova é o teste de ouro contra o SQL. */
import type { LinhasDoResumo } from './resumo'
import type { Celula, UnidadeLida } from './expurgo-filtro'

const COLUNAS_CANAL = ['canal', 'tabela', 'mes', 'videos_com_linha', 'linhas', 'dias_medidos', 'dias_do_mes', 'primeira_leitura', 'ultima_leitura',
  'var_views', 'var_likes', 'var_comments', 'hash_conteudo_unidade', 'versao_resumo']
const COLUNAS_VIDEO = ['video', 'canal', 'tabela', 'mes', 'linhas', 'dias_medidos', 'views_primeira', 'views_ultima', 'likes_primeira', 'likes_ultima',
  'comments_primeira', 'comments_ultima', 'hash_conteudo_unidade', 'versao_resumo']
const MEDIDAS = new Set(['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early'])
const DIA_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Texto de timestamptz do Postgres com `timezone = 'UTC'` ("2026-09-01 03:00:00+00") ou data ("2026-09-01"). */
function diaSP(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  // sem offset o JS leria no fuso da máquina (Mac e forja não são UTC): recusa em vez de adivinhar
  if (!/(?:[+-]\d{2}(?::?\d{2})?|Z)$/.test(ts)) throw new Error(`instante_ilegivel: ${ts}`)
  const iso = ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`instante_ilegivel: ${ts}`)
  return DIA_SP.format(d)
}

interface Leitura { video: string; ts: string; dia: string; a: string | null; b: string | null; c: string | null }

function leituras(tabela: string, u: UnidadeLida, comentarios: UnidadeLida | undefined): Leitura[] {
  const col = (n: string): number => { const i = u.colunas.indexOf(n); if (i < 0) throw new Error(`coluna_ausente: ${tabela}.${n}`); return i }
  const v = (l: Celula[], n: string): Celula => l[col(n)] ?? null
  if (tabela === 'competitor_video_comments' || tabela === 'competitor_video_comment_marks') {
    const base = tabela === 'competitor_video_comments' ? u : comentarios
    if (!base) throw new Error('resumo_de_marcas_sem_comentarios')
    const bi = (n: string): number => { const i = base.colunas.indexOf(n); if (i < 0) throw new Error(`coluna_ausente: comentarios.${n}`); return i }
    const porId = new Map(base.linhas.map(l => [l[bi('id')]!, l]))
    return u.linhas.map(l => {
      const k = tabela === 'competitor_video_comments' ? l : porId.get(v(l, 'comment_id')!)
      if (!k) throw new Error('marca_sem_comentario_no_mes')
      const pai = k[bi('parent_id')] ? porId.get(k[bi('parent_id')]!) : undefined
      const ts = (pai?.[bi('first_seen_at')] ?? k[bi('first_seen_at')])!
      return { video: k[bi('video_id')]!, ts, dia: diaSP(ts), a: null, b: null, c: null }
    })
  }
  const tsCol = tabela === 'competitor_video_daily' ? 'snap_date' : tabela === 'competitor_video_early' ? 'taken_at'
    : tabela === 'competitor_raw' ? 'last_seen_at' : 'hour_slot'
  const medida = MEDIDAS.has(tabela)
  return u.linhas.map(l => ({
    video: v(l, 'video_id')!, ts: v(l, tsCol)!, dia: diaSP(v(l, tsCol)!),
    a: medida ? v(l, 'views') : null, b: medida ? v(l, 'likes') : null, c: medida ? v(l, 'comments') : null,
  }))
}

const inteiroDe = (v: string, coluna: string): bigint => {
  if (!/^-?\d+$/.test(v)) throw new Error(`valor_nao_inteiro: ${coluna}`)
  return BigInt(v)
}
const difSoma = (pares: Array<[string | null, string | null]>): string | null =>
  pares.some(([x, y]) => x === null || y === null) ? null : pares.reduce((s, [x, y]) => s + (inteiroDe(y!, 'medida') - inteiroDe(x!, 'medida')), BigInt(0)).toString()

export function refazerResumo(o: {
  classe: string; canal: string; mes: string; diasDoMes: number; versao: number
  unidades: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }>
  vazias: Array<{ tabela: string; hashConteudo: string }>
  comentarios?: UnidadeLida
}): LinhasDoResumo {
  if (o.unidades.length + o.vazias.length === 0) throw new Error('resumo_sem_unidades')
  const canal: Celula[][] = []; const video: Celula[][] = []
  const ver = String(o.versao)
  const todas = [...o.unidades.map(u => ({ ...u, ls: leituras(u.tabela, u.unidade, o.comentarios) })),
    ...o.vazias.map(v => ({ tabela: v.tabela, hashConteudo: v.hashConteudo, unidade: { colunas: [], linhas: [] }, ls: [] as Leitura[] }))]
    .sort((x, y) => (x.tabela < y.tabela ? -1 : x.tabela > y.tabela ? 1 : 0))
  for (const u of todas) {
    const porVideo = new Map<string, Leitura[]>()
    for (const l of u.ls) { const a = porVideo.get(l.video) ?? []; a.push(l); porVideo.set(l.video, a) }
    const pv = [...porVideo.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([vid, ls]) => {
      const ord = [...ls].sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : 0))
      const p = ord[0]!, ul = ord[ord.length - 1]!
      return { vid, n: ls.length, nd: new Set(ls.map(l => l.dia)).size, t1: p.ts, t2: ul.ts, a1: p.a, a2: ul.a, b1: p.b, b2: ul.b, c1: p.c, c2: ul.c }
    })
    const vazia = u.ls.length === 0
    canal.push([o.canal, u.tabela, o.mes, String(pv.length), String(u.ls.length), String(new Set(u.ls.map(l => l.dia)).size), String(o.diasDoMes),
      vazia ? null : pv.reduce((m, x) => (x.t1 < m ? x.t1 : m), pv[0]!.t1), vazia ? null : pv.reduce((m, x) => (x.t2 > m ? x.t2 : m), pv[0]!.t2),
      vazia ? null : difSoma(pv.map(x => [x.a1, x.a2])), vazia ? null : difSoma(pv.map(x => [x.b1, x.b2])), vazia ? null : difSoma(pv.map(x => [x.c1, x.c2])),
      u.hashConteudo, ver])
    for (const x of pv) video.push([x.vid, o.canal, u.tabela, o.mes, String(x.n), String(x.nd), x.a1, x.a2, x.b1, x.b2, x.c1, x.c2, u.hashConteudo, ver])
  }
  const vazio = todas.every(u => u.ls.length === 0)
  return { versao: o.versao, vazio, colunas_canal: COLUNAS_CANAL, colunas_video: COLUNAS_VIDEO, canal: vazio ? [] : canal, video: vazio ? [] : video, unit_hashes: {} }
}
