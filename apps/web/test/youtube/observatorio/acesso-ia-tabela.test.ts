// @vitest-environment node
/**
 * A5 F1b T7: o modo tabela das listas (`saida: 'tabela'`), pelo `responder` real e pelos empacotadores reais das três telas.
 * (1) canais em CSV · (2) paridade com a tela · (3) destaques e mudanças · (4) corte por linha inteira · (5) privacidade · (6) sem chaves ·
 * (7) sem comentário · (8) modo texto igual · (10) inventário · (11) pizza.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>,
  captured: [] as Array<[string, { extra?: Record<string, unknown> }?]>,
  segmentar: [] as unknown[],
  csv: [] as unknown[],
}))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a as never), captureException: (...a: unknown[]) => m.captured.push(a as never) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/segmentar', async (original) => {
  const mod = await original<typeof import('@/lib/youtube/observatorio/contexto-ia/segmentar')>()
  return { ...mod, segmentar: (...a: Parameters<typeof mod.segmentar>) => { m.segmentar.push(a[0]); return mod.segmentar(...a) } }
})
vi.mock('@/lib/youtube/observatorio/contexto-ia/tabela-csv', async (original) => {
  const mod = await original<typeof import('@/lib/youtube/observatorio/contexto-ia/tabela-csv')>()
  return { ...mod, csvDaTabela: (...a: Parameters<typeof mod.csvDaTabela>) => { m.csv.push(a[0]); return mod.csvDaTabela(...a) } }
})

import type { Dataset } from '@/lib/youtube/observatorio/types'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { casosDeMudancas, casosDeOutliers } from './contexto-ia-x-telas-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { classeDa, CLASSES_NA_IA } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/corte-da-ia'
import { SEM_CSV_LISTA_VAZIA, SEM_CSV_SEM_CHAVES } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { FRASE_CANAL_PROPRIO } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { numeroCsv, PIZZA_PERMITIDA } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import * as F from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Celula, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const AGORA = Date.UTC(2026, 10, 9, 15)
const TETO = 60_000

/* ---- parser RFC 4180 (o do teste do gerador) */
function parse(csv: string): string[][] {
  const linhas: string[][] = []
  let campo = ''; let linha: string[] = []; let aspas = false
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]!
    if (aspas) { if (ch === '"') { if (csv[i + 1] === '"') { campo += '"'; i++ } else aspas = false } else campo += ch } else if (ch === '"') aspas = true
    else if (ch === ',') { linha.push(campo); campo = '' } else if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = '' } else campo += ch
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}
/** Os blocos ```csv do texto, por título (`## título`), com a tabela relida. */
function blocos(texto: string): Map<string, { cabecalho: string[]; linhas: string[][]; antes: string }> {
  const out = new Map<string, { cabecalho: string[]; linhas: string[][]; antes: string }>()
  for (const sec of texto.split(/\n(?=## )/)) {
    const i = sec.indexOf('```csv\n')
    if (i < 0) continue
    const titulo = sec.slice(3, sec.indexOf('\n'))
    const corpo = sec.slice(i + 7, sec.indexOf('\n```', i))
    const t = parse(`${corpo}\n`)
    out.set(titulo, { cabecalho: t[0]!, linhas: t.slice(1), antes: sec.slice(0, i) })
  }
  return out
}

/* ---- mundos */
function mundoCom(n: number, nomeLongo = 0) {
  return a3World((ds: Dataset) => {
    const concorrentes = ds.channels.filter((c) => !c.own)
    let i = 0
    while (ds.channels.length < n) {
      const molde = concorrentes[i % concorrentes.length]!
      const id = `${molde.id}-c${i}`
      ds.channels.push({ ...structuredClone(molde), id, name: `${molde.name} ${i + 2}`, fullName: `${molde.fullName} ${i + 2}` })
      for (const v of ds.videos.filter((x) => x.ch === molde.id)) ds.videos.push({ ...structuredClone(v), id: `${v.id}-c${i}`, ch: id })
      i += 1
    }
    ds.channels = ds.channels.slice(0, Math.max(n, ds.channels.filter((c) => c.own).length))
    if (nomeLongo > 0) for (const c of ds.channels) { c.name = `${c.name} ${'n'.repeat(nomeLongo)}`.slice(0, nomeLongo); c.fullName = c.name }
  })
}
function modeloDe(n: number, nomeLongo = 0): PacoteModelo {
  const { obs } = mundoCom(n, nomeLongo)
  const view = buildCanaisView(obs, { niche: 'todos', limit: 200, fmt: 'longos', medidas: medidasDoOraculo(obs) }, undefined)
  const ri = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
  return empacotarCanais(modeloDeCanais(view, ri), { acessoPorCanal: {}, negativa: null })
}
const uuid = (i: number): string => `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
/** Em produção o Id é o uuid do banco; a fixture usa slug. */
function comUuids(mod: PacoteModelo): PacoteModelo {
  return { ...mod, tabelas: mod.tabelas.map((t) => {
    if (classeDa(mod.tela, t) !== 'principal') return t
    const col = t.colunas.indexOf('Id')
    return { ...t, linhas: t.linhas.map((l, i) => l.map((c, j) => (j === col ? { ...c, texto: uuid(i) } as typeof c : c))) }
  }) }
}
const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
const principalDe = (mod: PacoteModelo): Tabela => mod.tabelas.find((t) => classeDa(mod.tela, t) === 'principal')!
const rodar = (e: Record<string, unknown>) => responder(e, ABRIDOR_DE_SESSAO, AGORA)

beforeEach(() => {
  m.captured.length = 0; m.segmentar.length = 0; m.csv.length = 0
  for (const t of ['canais', 'outliers', 'mudancas']) m.empacotar[t] = vi.fn(async () => null)
})

describe('(1) listar_canais em tabela: 34 canais', () => {
  it('o bloco da principal tem 34 linhas, o cabeçalho das chaves + motivos, ids da fixture e a Cobertura fecha o texto', async () => {
    const mod = comUuids(modeloDe(34))
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    const p = principalDe(mod)
    const b = blocos(r.texto).get(p.titulo)!
    expect(b.linhas).toHaveLength(34)
    expect(b.cabecalho).toEqual([...p.chaves!, 'motivos'])
    const iId = b.cabecalho.indexOf('id')
    expect(b.linhas.map((l) => l[iId])).toEqual(Array.from({ length: 34 }, (_, i) => uuid(i)))
    for (const l of b.linhas) expect(l).toHaveLength(b.cabecalho.length)
    expect(r.texto).not.toMatch(/^\| /m) // nenhuma tabela markdown
    const cob = r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))
    expect(cob).toContain('linhas 1–34 de 34')
    expect(cob).toContain('Os canais acompanhados')
    expect(r.texto.lastIndexOf('```')).toBeLessThan(r.texto.lastIndexOf('## Cobertura'))
    expect(r.params).toMatchObject({ saida: 'tabela', linhas: 34, total: 34, sem_x: 0 })
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
    expect(r.texto).toContain(F.COMO_LER_TABELA)
  })
})

describe('(2) paridade com a tela', () => {
  it('toda célula medida da principal sai numeroCsv(x); toda não medida sai vazia e a coluna motivos cita a chave', async () => {
    const mod = comUuids(modeloDe(34))
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    const p = principalDe(mod)
    const b = blocos(r.texto).get(p.titulo)!
    let medidas = 0, vazias = 0
    p.linhas.forEach((linha, n) => linha.forEach((c: Celula, j) => {
      if (c.papel !== 'numero') return
      const campo = b.linhas[n]![j]!
      if ((c.estado === 'medido' || c.estado === 'zero_medido') && typeof c.x === 'number') { medidas += 1; expect(campo, `${p.chaves![j]} linha ${n + 1}`).toBe(numeroCsv(c.x)) }
      else if (c.estado === 'nao_medido' || c.estado === 'falhou' || c.estado === 'restrito') {
        vazias += 1
        expect(campo).toBe('')
        expect(b.linhas[n]![b.cabecalho.length - 1]).toMatch(new RegExp(`${p.chaves![j]}:m\\d+`))
      }
    }))
    expect(medidas).toBeGreaterThan(100)
    expect(vazias).toBeGreaterThan(0)
  })
})

describe('(3) destaques e mudanças em tabela; apoio com dona', () => {
  it('destaques: a coluna id existe; mudancas: idem', async () => {
    const o = casosDeOutliers().find((c) => c.nome === 'padrão')!.pacote
    dobra('outliers', o)
    const r = await rodar({ acao: 'destaques', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    const b = blocos(r.texto).get(principalDe(o).titulo)!
    expect(b.cabecalho).toContain('id')
    expect(b.linhas.length).toBeGreaterThan(5)
    const mu = casosDeMudancas().find((c) => c.nome === 'padrão')!.pacote
    dobra('mudancas', mu)
    const r2 = await rodar({ acao: 'mudancas', saida: 'tabela' })
    expect(r2.desfecho).toBe('ok')
    expect(blocos(r2.texto).get(principalDe(mu).titulo)!.cabecalho).toContain('id')
  })
  it('canais: canais-direcao-numeros sai com canal_id igual ao id da linha da principal do mesmo canal; notas e dicas não saem e a Cobertura diz Notas e dicas', async () => {
    const mod = comUuids(modeloDe(34))
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    const tp = mod.tabelas.find((t) => t.id === 'canais-direcao-numeros')!
    const b = blocos(r.texto).get(tp.titulo)!
    expect(b.cabecalho[0]).toBe('canal_id')
    const p = principalDe(mod)
    const ids = new Set(p.linhas.map((l) => (l[p.colunas.indexOf('Id')] as { texto: string }).texto))
    expect(b.linhas).toHaveLength(tp.linhas.length)
    for (const l of b.linhas) expect(ids.has(l[0]!)).toBe(true)
    // o canal da linha 1 da tabela de apoio é o da linha da principal que tem o mesmo nome
    const nomeNaPrincipal = (l: readonly Celula[]) => (l[p.colunas.indexOf('Canal')] as { texto: string }).texto
    const nomeNoApoio = (tp.linhas[0]![0] as { texto: string }).texto
    const dona = p.linhas.find((l) => nomeNaPrincipal(l) === nomeNoApoio)!
    expect(b.linhas[0]![0]).toBe((dona[p.colunas.indexOf('Id')] as { texto: string }).texto)
    for (const id of ['canais-notas', 'canais-dicas']) expect(blocos(r.texto).has(mod.tabelas.find((t) => t.id === id)?.titulo ?? '#')).toBe(false)
    expect(r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))).toContain('Notas e dicas')
  })
})

describe('(4) corte por linha inteira', () => {
  it('200 canais com nomes de 200 caracteres: k < 200, linhas relidas com o número de colunas, o bloco fecha, a próxima chamada leva a_partir_da_linha e saida', async () => {
    const mod = comUuids(modeloDe(200, 200))
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
    const p = principalDe(mod)
    const b = blocos(r.texto).get(p.titulo)!
    const k = b.linhas.length
    expect(k).toBeGreaterThan(0)
    expect(k).toBeLessThan(200)
    for (const l of b.linhas) expect(l).toHaveLength(b.cabecalho.length)
    expect(r.params.cortes).toBeGreaterThanOrEqual(0)
    expect(r.params.linhas).toBe(k)
    expect(r.texto).toContain(`"a_partir_da_linha":${k + 1}`)
    expect(r.texto).toMatch(new RegExp(`"a_partir_da_linha":${k + 1}[^\\n]*"saida":"tabela"|"saida":"tabela"[^\\n]*"a_partir_da_linha":${k + 1}`))
  })
  it('(4b) 200 linhas com 200 motivos de sincronização distintos: texto ≤ 60.000 e a última linha do bloco é a cerca, seguida da Cobertura', async () => {
    const base = comUuids(modeloDe(200))
    const p = principalDe(base)
    const iSinc = p.chaves!.indexOf('sincronizacao')
    const mod: PacoteModelo = { ...base, tabelas: base.tabelas.map((t) => t === p
      ? { ...t, linhas: t.linhas.map((l, i) => l.map((c, j) => (j === iSinc ? ({ papel: 'numero', estado: 'nao_medido', motivo: `motivo distinto número ${i} ${'z'.repeat(150)}`, origem: `o${i}` } as Celula) : c))) }
      : t) }
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
    const fim = r.texto.lastIndexOf('```')
    expect(r.texto.slice(fim)).toMatch(/^```\n\n## Cobertura/)
    expect(blocos(r.texto).get(p.titulo)!.linhas.length).toBeLessThan(200)
  })
})

describe('(5) privacidade', () => {
  const comPrivada = (mod: PacoteModelo, estado: PacoteModelo['privado']): PacoteModelo => {
    const p = principalDe(mod)
    const priv: Tabela = { ...p, id: 'privado-canais', titulo: 'Seu canal (privado)', nomeNoCorte: 'tabela privada', privada: true, linhas: p.linhas.slice(0, 1).map((l) => l.map((c) => (c.papel === 'numero' && (c.estado === 'medido') ? { ...c, x: 987654, texto: '987654' } : c))) }
    return estado.estado === 'incluido' ? { ...mod, privado: estado, tabelas: [...mod.tabelas, priv] } : { ...mod, privado: estado }
  }
  it('excluido: nenhuma linha privada, nenhum número do próprio no texto, e o texto diz que não entrou', async () => {
    dobra('canais', comPrivada(comUuids(modeloDe(34)), { estado: 'excluido', motivo: 'sem_direito', itens: 'o seu canal' }))
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    expect(r.incluiuPrivado).toBe(false)
    expect(r.texto).not.toContain('987654')
    expect(r.texto).not.toContain('privado: sim')
    expect(r.texto).toContain(F.NAO_INCLUIDO_SEM_DIREITO('o seu canal'))
  })
  it('incluido: bloco com privado: sim e incluiuPrivado', async () => {
    dobra('canais', comPrivada(comUuids(modeloDe(34)), { estado: 'incluido', itens: 'o seu canal' }))
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    expect(r.incluiuPrivado).toBe(true)
    expect(r.texto).toContain('privado: sim')
    expect(r.texto).toContain('987654')
  })
  it('incluido, janela 2 (a tabela privada não está na janela): não lança e não declara privado', async () => {
    dobra('canais', comPrivada(comUuids(modeloDe(34)), { estado: 'incluido', itens: 'o seu canal' }))
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela', a_partir_da_linha: 5, marca: 'aaaaaaaa' })
    expect(r.desfecho).toBe('ok')
    expect(r.incluiuPrivado).toBe(false)
    expect(r.texto).not.toContain('987654')
  })
  it('I1: modo TEXTO, incluido, janela 2 (sem tabela privada): não lança, não declara privado e não vaza o número', async () => {
    dobra('canais', comPrivada(comUuids(modeloDe(34)), { estado: 'incluido', itens: 'o seu canal' }))
    const r = await rodar({ acao: 'listar_canais', a_partir_da_linha: 5, marca: 'aaaaaaaa' })
    expect(r.desfecho).toBe('ok')
    expect(r.incluiuPrivado).toBe(false)
    expect(r.texto).not.toContain('987654')
  })
  it('modelo com tabela privada e privado excluido: segmentar lança, desfecho falhou e nada de CSV', async () => {
    const mod = comPrivada(comUuids(modeloDe(34)), { estado: 'incluido', itens: 'o seu canal' })
    dobra('canais', { ...mod, privado: { estado: 'excluido', motivo: 'sem_direito', itens: 'x' } })
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('falhou')
    expect(r.texto).not.toContain('```csv')
  })
  it('(5b) o objeto lido pelo CSV é o mesmo que foi a segmentar', async () => {
    dobra('canais', comUuids(modeloDe(34)))
    await rodar({ acao: 'listar_canais', saida: 'tabela' })
    const modelos = m.segmentar as PacoteModelo[]
    const ultimo = modelos[modelos.length - 1]!
    expect(m.csv.length).toBeGreaterThan(0)
    const lidas = m.csv.slice(-ultimo.tabelas.length)
    for (const t of lidas) expect(ultimo.tabelas.includes(t as Tabela)).toBe(true)
  })
})

describe('(6) tabela sem chaves', () => {
  it('as outras saem, o aviso é um por tabela, a Cobertura cita a tabela e o desfecho é ok', async () => {
    const base = comUuids(modeloDe(34))
    const alvo = base.tabelas.find((t) => t.id === 'canais-nicho')!
    const mod: PacoteModelo = { ...base, tabelas: base.tabelas.map((t) => (t === alvo ? (({ chaves: _c, ...resto }) => resto)(t) as Tabela : t)) }
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.desfecho).toBe('ok')
    const b = blocos(r.texto)
    expect(b.has(alvo.titulo)).toBe(false)
    expect(b.has(principalDe(mod).titulo)).toBe(true)
    expect(m.captured.filter((c) => String(c[0]).includes('tabela_sem_chaves'))).toHaveLength(1)
    expect(r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))).toContain(alvo.nomeNoCorte)
  })
})

describe('I3: pediu tabela e não saiu CSV', () => {
  it('lista vazia: texto com a linha SEM_CSV no topo, sem bloco csv e o registro grava saida texto, sem sem_x', async () => {
    dobra('outliers', casosDeOutliers().find((c) => c.nome.includes('vazio'))!.pacote)
    const r = await rodar({ acao: 'destaques', saida: 'tabela' })
    expect(r.texto).toContain(SEM_CSV_LISTA_VAZIA)
    expect(r.texto).not.toContain('```csv')
    expect(r.params.saida).toBe('texto')
    expect(r.params).not.toHaveProperty('sem_x')
  })
  it('principal sem chaves: SEM_CSV_SEM_CHAVES com o nome da tabela e registro texto', async () => {
    const base = comUuids(modeloDe(34))
    const p = principalDe(base)
    dobra('canais', { ...base, tabelas: base.tabelas.map((t) => (t === p ? (({ chaves: _c, ...resto }) => resto)(t) as Tabela : t)) })
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.texto).toContain(SEM_CSV_SEM_CHAVES(p.titulo))
    expect(r.texto).not.toContain('```csv')
    expect(r.params.saida).toBe('texto')
    expect(r.params).not.toHaveProperty('sem_x')
  })
})

describe('(7) sem texto de comentário', () => {
  it.each(['listar_canais', 'destaques', 'mudancas'] as const)('%s em tabela não carrega o rótulo de comentário', async (acao) => {
    dobra('canais', comUuids(modeloDe(34)))
    dobra('outliers', casosDeOutliers().find((c) => c.nome === 'padrão')!.pacote)
    dobra('mudancas', casosDeMudancas().find((c) => c.nome === 'padrão')!.pacote)
    const r = await rodar({ acao, saida: 'tabela' })
    expect(r.texto).not.toContain(F.COMENTARIOS_TITULO)
    expect(r.texto).not.toContain(F.COMENTARIOS_TITULO_SEM_TEXTO)
  })
})

describe('(8) o modo texto não muda', () => {
  it('saida texto e sem saida dão o mesmo texto, e nenhum bloco csv', async () => {
    dobra('canais', comUuids(modeloDe(34)))
    const a = await rodar({ acao: 'listar_canais' })
    const b = await rodar({ acao: 'listar_canais', saida: 'texto' })
    expect(a.texto).toBe(b.texto)
    expect(a.texto).not.toContain('```csv')
    expect(a.params).not.toHaveProperty('sem_x')
  })
})

describe('(10) inventário das tabelas expostas', () => {
  const UNIDADE_JA_DECLARADA = new Set(['Canais', 'Contagem', 'Publicações'])
  const todos: Array<[string, PacoteModelo]> = [
    ['canais', modeloDe(34)],
    ...casosDeOutliers().map((c) => [`outliers: ${c.nome}`, c.pacote] as [string, PacoteModelo]),
    ...casosDeMudancas().map((c) => [`mudancas: ${c.nome}`, c.pacote] as [string, PacoteModelo]),
  ]
  it.each(todos)('%s: toda tabela de classe exposta declara chaves válidas', (_n, mod) => {
    const sem: string[] = []
    for (const t of mod.tabelas) {
      const base = t.id.replace(/^privado-/, '')
      const classe = classeDa(mod.tela, { id: base, tipo: t.tipo })
      if (classe === 'texto' || t.tipo === 'dia_a_dia') continue
      if (!t.chaves || t.chaves.length !== t.colunas.length || new Set(t.chaves).size !== t.chaves.length || !t.chaves.every((c) => /^[a-z][a-z0-9_]*$/.test(c))) sem.push(t.id)
    }
    expect(sem).toEqual([])
  })
  // I2: toda coluna com célula numérica traz a unidade no título (ou está na lista das que a declaram pelo nome); sem isso o gráfico sai 100× errado
  const TEM_UNIDADE = /%|×|\(|views|inscritos|dias|vídeos/i
  // medido nas três telas (10/11/2026): contagens e posições (a unidade é "quantos") não precisam de unidade no título
  const E_CONTAGEM = new Set(['Posição', 'Outliers', 'Trocas', 'Trocas do nicho na janela'])
  // DÍVIDA DECLARADA: colunas de %, pp ou × cujo título não traz a unidade (só o texto da célula, que o CSV não leva). Consertar o título muda o modo texto: decisão do dono (ver relatório F1b).
  const SEM_UNIDADE_NO_TITULO_CONHECIDA = new Set(['Direção', 'Crescimento', 'Múltiplo', 'Mediana do efeito', 'Observado', 'Esperado sem a troca', 'Efeito', 'Limite da faixa'])
  const semUnidade = (mod: PacoteModelo): string[] => {
    const out: string[] = []
    for (const t of mod.tabelas) {
      const base = t.id.replace(/^privado-/, '')
      if (classeDa(mod.tela, { id: base, tipo: t.tipo }) === 'texto' || t.tipo === 'dia_a_dia') continue
      t.colunas.forEach((titulo, i) => {
        if (!t.linhas.some((l) => l[i]?.papel === 'numero')) return
        if (!UNIDADE_JA_DECLARADA.has(titulo) && !E_CONTAGEM.has(titulo) && !SEM_UNIDADE_NO_TITULO_CONHECIDA.has(titulo) && !TEM_UNIDADE.test(titulo)) out.push(`${t.id}/${titulo}`)
      })
    }
    return out
  }
  it.each(todos)('%s: toda coluna numérica tem a unidade no título', (_n, mod) => {
    expect(semUnidade(mod)).toEqual([])
  })
  it('a dívida declarada não apodrece: toda coluna da lista ainda existe numérica e sem unidade em alguma tela', () => {
    const vistas = new Set<string>()
    for (const [, mod] of todos) for (const t of mod.tabelas) t.colunas.forEach((c, i) => { if (t.linhas.some((l) => l[i]?.papel === 'numero') && !TEM_UNIDADE.test(c)) vistas.add(c) })
    expect([...SEM_UNIDADE_NO_TITULO_CONHECIDA].filter((c) => !vistas.has(c))).toEqual([])
  })
  it('caso negativo: a coluna numérica "Ritmo" sem unidade é apontada', () => {
    const mod = todos.find(([n]) => n.startsWith('outliers'))![1]
    const t = mod.tabelas.find((x) => x.tipo === 'lista' && x.linhas.some((l) => l.some((c) => c.papel === 'numero')))!
    const i = t.linhas[0]!.findIndex((c) => c.papel === 'numero')
    const colunas = t.colunas.map((c, j) => (j === i ? 'Ritmo' : c))
    expect(semUnidade({ ...mod, tabelas: mod.tabelas.map((x) => (x === t ? { ...t, colunas } : x)) })).toEqual([`${t.id}/Ritmo`])
  })
  it('a lista de ids de classe texto é a que o corte conhece', () => {
    const textos = Object.entries(CLASSES_NA_IA).flatMap(([, ids]) => Object.entries(ids).filter(([, c]) => c === 'texto').map(([id]) => id))
    expect(textos.length).toBeGreaterThan(3)
    expect(UNIDADE_JA_DECLARADA.size).toBe(3)
  })
})

describe('(11) pizza (D2): só onde a soma das partes medidas é o todo da tela', () => {
  const numeros = (t: Tabela): number[] => t.linhas.flatMap((l) => l.flatMap((c) => (c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && typeof c.x === 'number' ? [c.x] : [])))
  const soma = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

  it('canais-resumo-direcao: subindo + sem mudança + descendo = canais da principal com direção medida, em todos os recortes da fixture', () => {
    let conferidos = 0
    for (const [niche, fmt] of [['todos', 'longos'], ['viagem', 'longos'], ['ia', 'longos'], ['todos', 'todos'], ['todos', 'shorts']] as const) {
      const { obs } = a3World()
      const view = buildCanaisView(obs, { niche, limit: 200, fmt, medidas: medidasDoOraculo(obs) }, undefined)
      const ri = buildRiView(obs, { agoraMs: obs.NOW, niche, fmt: fmt === 'longos' ? 'long' : fmt === 'shorts' ? 'short' : 'all', meuCanalLembrado: null, retratosProprios: new Map() }).view
      const mod = empacotarCanais(modeloDeCanais(view, ri), { acessoPorCanal: {}, negativa: null })
      const resumo = mod.tabelas.find((t) => t.id === 'canais-resumo-direcao')!
      const p = principalDe(mod)
      const di = p.colunas.indexOf('Direção')
      const comDirecao = p.linhas.filter((l) => { const c = l[di]!; return c.papel === 'numero' && c.estado === 'medido' && typeof c.x === 'number' }).length
      // as três primeiras casas são as direções medidas; a 4ª é "não medido"
      const partes = resumo.linhas.slice(0, 3)
      expect(soma(numeros({ ...resumo, linhas: partes })), `${niche}/${fmt}`).toBe(comDirecao)
      // M2: as 4 casas somam a principal SEM o canal próprio (o título do resumo diz "sem o seu canal")
      const proprios = p.linhas.filter((l) => l.some((c) => c.papel === 'numero' && c.estado === 'nao_medido' && c.motivo === FRASE_CANAL_PROPRIO)).length
      expect(resumo.linhas).toHaveLength(4)
      expect(soma(numeros(resumo)), `4 casas ${niche}/${fmt}`).toBe(p.linhas.length - proprios)
      expect(resumo.titulo).toContain('sem o seu canal')
      conferidos += 1
    }
    expect(conferidos).toBe(5)
  })
  it('grupos de Destaques: a soma dos grupos é o número de cartões, em todo caso da fixture que tem a tabela', () => {
    let comTabela = 0
    for (const caso of casosDeOutliers()) {
      const g = caso.pacote.tabelas.find((t) => t.id === 'grupos')
      if (!g) continue
      comTabela += 1
      expect(soma(numeros(g)), caso.nome).toBe(principalDe(caso.pacote).linhas.length)
    }
    expect(comTabela).toBeGreaterThanOrEqual(3)
  })
  it('o tamanho da lista branca não muda em silêncio: 2 (as duas tabelas acima fecharam a conta; nenhuma fica barra)', () => {
    expect([...PIZZA_PERMITIDA].sort()).toEqual(['canais-resumo-direcao', 'grupos'])
    expect(PIZZA_PERMITIDA.size).toBe(2)
  })
  it('pela resposta: o resumo da direção sai pizza; com uma parte não medida nesta resposta, sai barra e avisa', async () => {
    const mod = comUuids(modeloDe(34))
    dobra('canais', mod)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    const alvo = mod.tabelas.find((t) => t.id === 'canais-resumo-direcao')!
    const antes = blocos(r.texto).get(alvo.titulo)!.antes
    expect(antes).toContain('Gráfico sugerido: pizza')
    expect(antes).toContain('toda parte foi medida')
    expect(antes).not.toContain('{k}')
    expect(antes).not.toContain('0 sem medida')
    const ruim: PacoteModelo = { ...mod, tabelas: mod.tabelas.map((t) => (t === alvo ? { ...t, linhas: t.linhas.map((l, i) => (i === 1 ? [l[0]!, { papel: 'numero', estado: 'nao_medido', motivo: 'sem leitura', origem: 'o' } as Celula] : l)) } : t)) }
    m.captured.length = 0
    dobra('canais', ruim)
    const r2 = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(blocos(r2.texto).get(alvo.titulo)!.antes).toContain('Gráfico sugerido: barra')
    expect(m.captured.filter((c) => String(c[0]).includes('pizza_nao_fecha'))).toHaveLength(1)
  })
})

describe('M3, janelas, próximas chamadas e sem_x', () => {
  it('M3: o vídeo com menos de 7 dias de série leva a nota na coluna motivos da linha dele, e só na dele', async () => {
    const caso = casosDeOutliers().find((c) => c.nome === 'múltiplo mínimo 0')!
    dobra('outliers', caso.pacote)
    const r = await rodar({ acao: 'destaques', saida: 'tabela' })
    const p = principalDe(caso.pacote)
    const b = blocos(r.texto).get(p.titulo)!
    const cards = caso.modelo.groups.flatMap((g) => g.cards)
    const iMot = b.cabecalho.indexOf('motivos')
    // a tela é paginada; só confere as linhas que chegaram
    expect(b.linhas.length).toBeGreaterThan(0)
    let comNota = 0
    b.linhas.forEach((l, n) => {
      const nota = cards[n]!.vpdShortNote
      if (nota !== null) { comNota += 1; expect(l[iMot]).toContain(`views_dia_7d: ${nota}`) } else expect(l[iMot]).not.toContain('views_dia_7d: ')
    })
    expect(comNota).toBeGreaterThan(0)
  })
  it('janela 2 de canais: cabeçalho de novo, legenda recomeça, Cobertura 6–N e a próxima chamada leva saida', async () => {
    const mod = comUuids(modeloDe(34))
    dobra('canais', mod)
    const r1 = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r1.params.linhas).toBe(34)
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela', a_partir_da_linha: 6, marca: r1.texto.match(/"marca":"([0-9a-f]{8}p?)"/)?.[1] ?? 'aaaaaaaa' })
    expect(r.desfecho).toBe('ok')
    const p = principalDe(mod)
    const b = blocos(r.texto).get(p.titulo)!
    expect(b.linhas).toHaveLength(29)
    expect((b.linhas[0] ?? [])[b.cabecalho.indexOf('id')]).toBe(uuid(5))
    expect(r.texto).toContain('linhas 6–34 de 34')
    if (r.texto.includes('Motivos (')) expect(r.texto).toMatch(/- m1 \(/)
    expect(r.params).toMatchObject({ saida: 'tabela', a_partir_da_linha: 6 })
  })
  it('pedido além do fim: recusa da A7 T9', async () => {
    dobra('canais', comUuids(modeloDe(34)))
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela', a_partir_da_linha: 99 })
    expect(r.desfecho).toBe('pedido_invalido')
  })
  it('destaques em tabela: a chamada sugerida de todas as idades continua em tabela', async () => {
    dobra('outliers', casosDeOutliers().find((c) => c.nome === 'padrão')!.pacote)
    const r = await rodar({ acao: 'destaques', saida: 'tabela' })
    expect(r.texto).toContain('"janela":"todas"')
    expect(r.texto).toMatch(/\{[^}\n]*"janela":"todas"[^}\n]*"saida":"tabela"[^}\n]*\}|\{[^}\n]*"saida":"tabela"[^}\n]*"janela":"todas"[^}\n]*\}/)
  })
  it('sem_x: célula medida sem x conta no registro e dispara UM aviso csv_sem_x por chamada', async () => {
    const base = comUuids(modeloDe(34))
    const p = principalDe(base)
    const iIns = p.chaves!.indexOf('inscritos')
    const defeito = (l: readonly Celula[], n: number): Celula[] => l.map((c, j) => (j === iIns && n < 3 && c.papel === 'numero' && c.estado === 'medido' ? { ...c, x: null } : c))
    dobra('canais', { ...base, tabelas: base.tabelas.map((t) => (t === p ? { ...t, linhas: t.linhas.map(defeito) } : t)) })
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.params.sem_x).toBe(3)
    expect(m.captured.filter((c) => String(c[0]).includes('csv_sem_x'))).toHaveLength(1)
    expect(blocos(r.texto).get(p.titulo)!.linhas[0]![p.chaves!.length]).toContain(`inscritos:m`)
  })
  it('sem defeito: sem_x é 0 e nenhum aviso', async () => {
    dobra('canais', comUuids(modeloDe(34)))
    const r = await rodar({ acao: 'listar_canais', saida: 'tabela' })
    expect(r.params.sem_x).toBe(0)
    expect(m.captured.filter((c) => String(c[0]).includes('csv_sem_x'))).toHaveLength(0)
  })
})
