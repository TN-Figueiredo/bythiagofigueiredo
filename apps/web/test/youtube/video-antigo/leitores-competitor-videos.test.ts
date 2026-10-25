// @vitest-environment node
// M10a (Tarefa 11, item 139): a lista dos leitores de competitor_videos bate com o que o código e as migrations dizem hoje.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  LEITORES_NO_CODIGO, LEITORES_NAS_MIGRATIONS, FUNCOES_VIVAS, GRAVADORES_DAS_8, ETAPAS_EM_ABERTO,
  TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS, type Ponto,
} from '@/lib/youtube/video-antigo/leitores-competitor-videos'

const RAIZ = path.resolve(__dirname, '../../../../..')
const PASTAS = ['apps/web/src', 'apps/web/lib', 'apps/api/src', 'scripts', ...(existsSync(path.join(RAIZ, 'packages')) ? readdirSync(path.join(RAIZ, 'packages')).map(p => `packages/${p}/src`) : [])]
const FORA = new Set([
  'apps/web/src/types/database.types.ts',
  'apps/web/src/lib/youtube/video-antigo/leitores-competitor-videos.ts',
  'apps/web/src/lib/youtube/video-antigo/tabelas-fora-da-classe.ts',
])
const OITO = ['competitor_video_versions', 'competitor_field_versions', 'competitor_raw', 'competitor_video_tier_spans', 'competitor_video_comment_snaps', 'competitor_hour_fold_log', 'competitor_changes', 'competitor_readings']
const RPCS_QUE_GRAVAM = ['apply_competitor_field_plan', 'apply_competitor_raw_plan', 'apply_competitor_version_plan', 'apply_competitor_tier_plan', 'apply_competitor_comment_snap']

function arquivos(dir: string): string[] {
  const abs = path.join(RAIZ, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  for (const n of readdirSync(abs)) {
    if (n === 'node_modules' || n === 'dist' || n === '.next') continue
    const p = path.join(abs, n)
    const rel = path.relative(RAIZ, p)
    if (statSync(p).isDirectory()) out.push(...arquivos(rel))
    else if (/\.(ts|tsx|js|mjs|cjs|sh|py|sql)$/.test(n) && !/\.test\./.test(n) && !FORA.has(rel)) out.push(rel)
  }
  return out
}
const TODOS = PASTAS.flatMap(arquivos)
const TEXTO = new Map(TODOS.map(f => [f, readFileSync(path.join(RAIZ, f), 'utf8')]))
const conta = (t: string) => t.split('competitor_videos').length - 1
const COM_O_TEXTO = [...TEXTO].filter(([, t]) => conta(t) > 0).map(([f]) => f)

describe('M10a: lista dos leitores de competitor_videos (código)', () => {
  it('(a) todo arquivo com o texto tem entrada', () => {
    const tem = new Set(LEITORES_NO_CODIGO.map(l => l.arquivo))
    expect(COM_O_TEXTO.filter(f => !tem.has(f))).toEqual([])
  })
  it('(b) toda entrada tem o arquivo e a contagem de ocorrências de hoje', () => {
    const erros: string[] = []
    for (const l of LEITORES_NO_CODIGO) {
      const t = TEXTO.get(l.arquivo)
      if (t === undefined) { erros.push(`${l.arquivo}: arquivo ausente`); continue }
      if (conta(t) !== l.ocorrencias) erros.push(`${l.arquivo}: ocorrencias ${l.ocorrencias}, hoje ${conta(t)}`)
    }
    expect(erros).toEqual([])
    expect(new Set(LEITORES_NO_CODIGO.map(l => l.arquivo)).size).toBe(LEITORES_NO_CODIGO.length)
  })
  it('(c) os oito pontos aparecem, e entrada com ponto não tem pendenteAte', () => {
    const pontos = new Set<Ponto>()
    for (const e of [...LEITORES_NO_CODIGO, ...LEITORES_NAS_MIGRATIONS, ...FUNCOES_VIVAS]) {
      if (e.ponto === undefined) continue
      expect(e.pendenteAte, JSON.stringify(e.ponto)).toBeUndefined()
      for (const p of Array.isArray(e.ponto) ? e.ponto : [e.ponto]) pontos.add(p as Ponto)
    }
    expect([...pontos].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it('pendenteAte só usa etapas em aberto', () => {
    const todas = [...LEITORES_NO_CODIGO, ...LEITORES_NAS_MIGRATIONS, ...FUNCOES_VIVAS, ...GRAVADORES_DAS_8]
    for (const e of todas) if (e.pendenteAte) expect(ETAPAS_EM_ABERTO).toContain(e.pendenteAte)
  })
  it('(d) quem grava nas 8 tabelas tem entrada em GRAVADORES_DAS_8', () => {
    const achados = new Set<string>()
    for (const [f, t] of TEXTO) {
      if (!f.startsWith('apps/web/src') && !f.startsWith('apps/web/lib')) continue
      const grava = OITO.some(tab => new RegExp(`\\.from\\('${tab}'\\)[\\s\\S]{0,300}?\\.(insert|upsert)\\(`).test(t))
        || RPCS_QUE_GRAVAM.some(r => t.includes(`rpc('${r}'`))
      if (grava) achados.add(f)
    }
    const com = new Set(GRAVADORES_DAS_8.map(g => g.arquivo))
    expect([...achados].filter(f => !com.has(f))).toEqual([])
    for (const g of GRAVADORES_DAS_8) {
      expect(TEXTO.has(g.arquivo), g.arquivo).toBe(true)
      expect(OITO).toContain(g.tabela)
      expect(g.porQueNuncaCongelado.length).toBeGreaterThan(20)
    }
  })
  it('limite declarado: nenhum arquivo monta o nome da tabela por concatenação', () => {
    const maus = [...TEXTO].filter(([, t]) => t.includes("'competitor_' +") || t.includes('`competitor_${')).map(([f]) => f)
    expect(maus).toEqual([])
  })
  it('as 16 tabelas filhas: cada uma numa classe só, as 8 da classe video_antigo', () => {
    const t = TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS
    expect(t).toHaveLength(16)
    expect(new Set(t.map(x => x.tabela)).size).toBe(16)
    expect(t.filter(x => x.classe === 'video_antigo').map(x => x.tabela).sort()).toEqual([...OITO].sort())
    expect(t.find(x => x.tabela === 'competitor_raw')?.motivo).toContain('a não corrente é da classe texto')
  })
})

describe('M10a: lista dos leitores de competitor_videos (migrations)', () => {
  const dir = path.join(RAIZ, 'supabase/migrations')
  const com = readdirSync(dir).filter(n => n.endsWith('.sql') && conta(readFileSync(path.join(dir, n), 'utf8')) > 0)
  it('toda migration que cita a tabela tem entrada, e toda entrada tem arquivo', () => {
    const tem = LEITORES_NAS_MIGRATIONS.map(m => m.arquivo)
    expect(com.filter(n => !tem.includes(n))).toEqual([])
    expect(tem.filter(n => !existsSync(path.join(dir, n)))).toEqual([])
    expect(new Set(tem).size).toBe(tem.length)
  })
  it('a migration da M10a está na lista', () => {
    expect(LEITORES_NAS_MIGRATIONS.some(m => m.arquivo.endsWith('_observatorio_m10a_video_antigo_base.sql'))).toBe(true)
  })
})
