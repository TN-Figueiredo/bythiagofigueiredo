// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isChannelSlug, nicheSlugFromLabel, nicheSlugOrNull, normalizeNicheLabel, parseRemovalRpc, removalLines, removalKeepLine,
  blockedLead, blockerDetail, nicheUsage, type RemovalImpact,
} from '@/lib/youtube/channel-registry'
import { CHANNEL_LOCALES, isChannelLocale, channelLocaleDef } from '@/lib/youtube/channel-locales'

const IMPACT: RemovalImpact = { name: 'N', slug: 's-1', videos: 2, comments: 3, syncLogs: 4, abTests: 5, analyses: 6, tasks: 7, notes: 8, pipelineLinks: 9, blockers: [] }

describe('idiomas do canal (lista central)', () => {
  it('pt e en, com chip e nome; qualquer outro valor é recusado', () => {
    expect(CHANNEL_LOCALES.map(l => [l.id, l.chip, l.name])).toEqual([['pt', 'PT-BR', 'Português (Brasil)'], ['en', 'EN', 'English']])
    expect(isChannelLocale('pt')).toBe(true)
    expect(isChannelLocale('es')).toBe(false)
    expect(isChannelLocale(null)).toBe(false)
  })
  it('o dado não existe — idioma fora da lista aparece como veio, sem lançar', () => {
    expect(channelLocaleDef('es')).toEqual({ id: 'es', chip: 'ES', name: 'es' })
  })
})

describe('slug', () => {
  it('forma do slug de canal: a do CHECK do banco (2 a 32, minúsculas, números, hífen simples)', () => {
    for (const ok of ['ab', 'tnfigueiredo', 'thiago-figueiredo', 'a1-b2', 'x'.repeat(32)]) expect(isChannelSlug(ok), ok).toBe(true)
    for (const bad of ['a', '', 'Não Vale', '-a', 'a-', 'a--b', 'A-B', 'x'.repeat(33), null, 3]) expect(isChannelSlug(bad), String(bad)).toBe(false)
  })
  it('slug de nicho sai do nome: sem acento, minúsculo, hífens, até 24', () => {
    expect(nicheSlugFromLabel('Jogos')).toBe('jogos')
    expect(nicheSlugFromLabel('Culinária Fácil')).toBe('culinaria-facil')
    expect(nicheSlugFromLabel('Finanças & Ações-2')).toBe('financas-acoes-2')
    expect(nicheSlugFromLabel('abcdefghij abcdefghij abcdef')).toBe('abcdefghij-abcdefghij-ab')
    expect(nicheSlugFromLabel('abcdefghij abcdefghijkl x')).toBe('abcdefghij-abcdefghijkl')
  })
  it('nome que não serve: vazio, só símbolos, reservado, um caractere, comprido demais', () => {
    for (const bad of ['', '   ', '&', 'Todos', 'all', 'sem', 'none', 'x', 'Um nome comprido demais para nicho']) expect(nicheSlugOrNull(bad), bad).toBeNull()
    expect(nicheSlugOrNull(' Jogos ')).toBe('jogos')
  })
})

describe('rótulo de nicho', () => {
  it('aparado, espaços internos colapsados; letras (com acento), números, espaço, hífen e &', () => {
    expect(normalizeNicheLabel('  Culinária    Fácil ')).toBe('Culinária Fácil')
    expect(normalizeNicheLabel('Finanças & Ações-2')).toBe('Finanças & Ações-2')
    expect(normalizeNicheLabel('IA')).toBe('IA')
  })
  it('recusa quebra de linha, tabulação, pontuação de expressão regular, aspas, vazio e mais de 24', () => {
    for (const bad of ['', '   ', 'a\nb', 'a\tb', 'a\rb', 'C++', 'a.b', '(x)', '[x]', '{x}', 'a|b', 'a\\b', 'a^b', 'a$', 'a*b', 'a?', 'a/b', '“x”', '"x"', "d'água", 'x'.repeat(25)]) {
      expect(normalizeNicheLabel(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})

describe('resposta das funções de remoção', () => {
  const row = { status: 'ok', name: 'N', slug: 's-1', videos: 2, comments: 3, sync_logs: 4, ab_tests: 5, analyses: 6, tasks: 7, notes: 8, pipeline_links: 9, blockers: [] }
  it('lê as contagens', () => {
    expect(parseRemovalRpc(row)).toEqual({ status: 'ok', impact: IMPACT })
  })
  it('teste pausado usa a data da pausa; ativo, a do início; sem data fica null', () => {
    const b = (o: object) => ({ id: 't', name: 'T', status: 'active', started_at: '2026-10-18T00:00:00Z', paused_at: null, video_title: 'V', ...o })
    const r = parseRemovalRpc({ ...row, status: 'blocked', blockers: [b({}), b({ status: 'paused', paused_at: '2026-10-20T00:00:00Z' }), b({ started_at: null })] })
    expect(r.status === 'blocked' && r.impact.blockers.map(x => x.since)).toEqual(['2026-10-18T00:00:00Z', '2026-10-20T00:00:00Z', null])
  })
  it('not_found e slug_mismatch passam; qualquer outra coisa é "invalid", nunca sucesso', () => {
    expect(parseRemovalRpc({ status: 'not_found' })).toEqual({ status: 'not_found' })
    expect(parseRemovalRpc({ status: 'slug_mismatch' })).toEqual({ status: 'slug_mismatch' })
    for (const bad of [null, undefined, 'removed', {}, { status: 'removed' }, { ...row, videos: -1 }, { ...row, status: 'apagado' }, { ...row, blockers: [{ id: 't' }] }]) {
      expect(parseRemovalRpc(bad)).toEqual({ status: 'invalid' })
    }
  })
})

describe('textos da remoção', () => {
  it('singular quando a contagem é 1', () => {
    const one = { ...IMPACT, videos: 1, comments: 1, syncLogs: 1, abTests: 1, analyses: 1, tasks: 1, notes: 1, pipelineLinks: 1 }
    expect(removalLines(one).map(l => `${l.count} ${l.text}`)).toEqual([
      '1 video, with its analytics, grades and optimization cycles', '1 curated comment', '1 sync log entry',
      '1 finished A/B test, with its variants and results', '1 intelligence analysis and 1 queued task', '1 note',
    ])
    expect(removalKeepLine(one)).toEqual({ strong: '1 pipeline item', rest: ' keeps its content and loses the link to its video.' })
  })
  it('frase do bloqueio: singular e plural', () => {
    expect(blockedLead(1)).toBe('An A/B test is running on one of its videos. Stop it first:')
    expect(blockedLead(2)).toBe('A/B tests are running on its videos. Stop them first:')
  })
  it('linha do teste: rodando, pausado, e sem data (o dado não existe)', () => {
    const fmt = () => 'Oct 18'
    const b = { id: 't', name: 'T', videoTitle: 'V' }
    expect(blockerDetail({ ...b, status: 'active', since: 'x' }, fmt)).toBe('· running since Oct 18, on “V”')
    expect(blockerDetail({ ...b, status: 'paused', since: 'x' }, fmt)).toBe('· paused since Oct 18, on “V”')
    expect(blockerDetail({ ...b, status: 'active', since: null }, fmt)).toBe('· on “V”')
    expect(blockerDetail({ ...b, status: 'paused', since: null }, fmt)).toBe('· paused, on “V”')
  })
  it('uso do nicho', () => {
    expect(nicheUsage(0, 0)).toBe('no channels yet · 0 competitors')
    expect(nicheUsage(1, 1)).toBe('1 channel · 1 competitor')
    expect(nicheUsage(3, 12)).toBe('3 channels · 12 competitors')
    expect(nicheUsage(3, null)).toBe('3 channels')
  })
})
