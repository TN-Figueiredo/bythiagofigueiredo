// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isChannelSlug, nicheSlugFromLabel, nicheSlugOrNull, normalizeNicheLabel, parseRemovalRpc, removalLines, removalKeepLine,
  blockedLead, blockerDetail, nicheUsage, languageChangeEffect, languageChangeLines, removalConnectionLine, type RemovalImpact,
} from '@/lib/youtube/channel-registry'
import { CHANNEL_LOCALES, isChannelLocale, channelLocaleDef } from '@/lib/youtube/channel-locales'
import { showcaseChannelId } from '@/lib/youtube/showcase'

const IMPACT: RemovalImpact = { name: 'N', slug: 's-1', videos: 2, comments: 3, syncLogs: 4, abTests: 5, abDrafts: 0, analyses: 6, tasks: 7, notes: 8, notifications: 0, connections: 0, pipelineLinks: 9, blockers: [] }

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
  const row = { status: 'ok', name: 'N', slug: 's-1', videos: 2, comments: 3, sync_logs: 4, ab_tests: 5, ab_drafts: 0, analyses: 6, tasks: 7, notes: 8, notifications: 0, connections: 0, pipeline_links: 9, blockers: [] }
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
  it('frase do bloqueio: "is running" só quando todos estão rodando; com pausado ou na fila, diz que não terminaram', () => {
    const b = (status: 'active' | 'paused' | 'queued') => ({ id: status, name: 'T', videoTitle: 'V', status, since: null })
    expect(blockedLead([b('active')])).toBe('An A/B test is running on one of its videos. Stop it first:')
    expect(blockedLead([b('active'), b('active')])).toBe('A/B tests are running on its videos. Stop them first:')
    expect(blockedLead([b('paused')])).toBe('An A/B test on one of its videos has not finished. Stop it first:')
    expect(blockedLead([b('queued')])).toBe('An A/B test on one of its videos has not finished. Stop it first:')
    expect(blockedLead([b('active'), b('queued')])).toBe('A/B tests on its videos have not finished. Stop them first:')
  })
  it('rascunhos e notificações têm linha própria, só quando há; os encerrados não os incluem', () => {
    expect(removalLines(IMPACT).map(l => l.key)).toEqual(['videos', 'comments', 'syncLogs', 'abTests', 'analyses', 'notes'])
    const withBoth = removalLines({ ...IMPACT, abDrafts: 2, notifications: 1 })
    expect(withBoth.map(l => l.key)).toEqual(['videos', 'comments', 'syncLogs', 'abTests', 'abDrafts', 'analyses', 'notes', 'notifications'])
    expect(withBoth.filter(l => l.key === 'abDrafts' || l.key === 'notifications').map(l => `${l.count} ${l.text}`)).toEqual(['2 draft A/B tests', '1 notification about its videos and tests'])
    expect(removalLines({ ...IMPACT, abDrafts: 1, notifications: 4 }).filter(l => l.key === 'abDrafts' || l.key === 'notifications').map(l => `${l.count} ${l.text}`)).toEqual(['1 draft A/B test', '4 notifications about its videos and tests'])
  })
  it('a conexão do YouTube só é citada quando existe', () => {
    expect(removalConnectionLine(IMPACT)).toBeNull()
    expect(removalConnectionLine({ ...IMPACT, connections: 1 })).toBe('The YouTube connection of this channel is disconnected and its saved tokens are erased.')
  })
  it('linha do teste: rodando, pausado, e sem data (o dado não existe)', () => {
    const fmt = () => 'Oct 18'
    const b = { id: 't', name: 'T', videoTitle: 'V' }
    expect(blockerDetail({ ...b, status: 'active', since: 'x' }, fmt)).toBe('· running since Oct 18, on “V”')
    expect(blockerDetail({ ...b, status: 'paused', since: 'x' }, fmt)).toBe('· paused since Oct 18, on “V”')
    expect(blockerDetail({ ...b, status: 'active', since: null }, fmt)).toBe('· on “V”')
    expect(blockerDetail({ ...b, status: 'paused', since: null }, fmt)).toBe('· paused, on “V”')
    expect(blockerDetail({ ...b, status: 'queued', since: null }, fmt)).toBe('· queued, on “V”')
    expect(blockerDetail({ ...b, status: 'queued', since: 'x' }, fmt)).toBe('· queued, on “V”')
  })
  it('uso do nicho', () => {
    expect(nicheUsage(0, 0)).toBe('no channels yet · 0 competitors')
    expect(nicheUsage(1, 1)).toBe('1 channel · 1 competitor')
    expect(nicheUsage(3, 12)).toBe('3 channels · 12 competitors')
    expect(nicheUsage(3, null)).toBe('3 channels')
  })
})

describe('troca de idioma: o efeito na vitrine do site público (a regra é a de showcase.ts)', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString()
  const PT = { id: 'a', name: 'tnFigueiredo', locale: 'pt', created_at: day(1) }
  const EN = { id: 'b', name: 'Thiago Figueiredo', locale: 'en', created_at: day(2) }
  const CORTES = { id: 'c', name: 'Cortes', locale: 'pt', created_at: day(3) }
  it('único canal pt vira en: PT-BR fica sem canal e EN passa a mostrar o mais antigo', () => {
    expect(languageChangeEffect([PT, EN], 'a', 'en')).toEqual([{ chip: 'PT-BR', name: null }, { chip: 'EN', name: 'tnFigueiredo' }])
    expect(languageChangeLines([PT, EN], 'a', 'en')).toEqual(['PT-BR will show no channel.', 'EN will show “tnFigueiredo”.'])
  })
  it('o mais antigo de pt vira en com outro pt atrás: o seguinte assume o PT-BR', () => {
    expect(languageChangeLines([PT, EN, CORTES], 'a', 'en')).toEqual(['PT-BR will show “Cortes”.', 'EN will show “tnFigueiredo”.'])
  })
  it('a ordem é a de CADASTRO (created_at), não a da lista recebida', () => {
    expect(languageChangeLines([CORTES, EN, PT], 'a', 'en')).toEqual(['PT-BR will show “Cortes”.', 'EN will show “tnFigueiredo”.'])
    // o canal en mais novo vira pt: o pt mais antigo continua sendo a vitrine, e EN fica vazio
    expect(languageChangeLines([EN, PT], 'b', 'pt')).toEqual(['EN will show no channel.'])
  })
  it('empate de created_at: desempata por id, como o site', () => {
    const X = { id: 'x', name: 'X', locale: 'en', created_at: day(5) }
    const B = { id: 'b2', name: 'B', locale: 'pt', created_at: day(5) }
    expect(languageChangeLines([X, B], 'x', 'pt')).toEqual(['EN will show no channel.'])
    expect(languageChangeLines([X, B], 'b2', 'en')).toEqual(['PT-BR will show no channel.', 'EN will show “B”.'])
  })
  it('um canal que não é a vitrine muda para um idioma que já tem canal mais antigo: o site não muda', () => {
    expect(languageChangeEffect([PT, EN, CORTES], 'c', 'en')).toEqual([])
    expect(languageChangeLines([PT, EN, CORTES], 'c', 'en')).toEqual(['The public site does not change.'])
  })
  it('um canal mais novo entra num idioma vazio: passa a aparecer nele', () => {
    expect(languageChangeLines([PT, CORTES], 'c', 'en')).toEqual(['EN will show “Cortes”.'])
  })
  it('paridade com showcase.ts: para 2 e 3 canais e toda troca possível, o efeito é a diferença entre as duas vitrines', () => {
    for (const rows of [[PT, EN], [PT, EN, CORTES], [{ ...PT, created_at: day(4) }, { ...EN, created_at: day(4) }, CORTES]]) {
      for (const ch of rows) for (const next of ['pt', 'en']) {
        const after = rows.map(r => (r.id === ch.id ? { ...r, locale: next } : r))
        const expected = ['pt', 'en'].flatMap((l) => {
          const was = showcaseChannelId(rows, l), now = showcaseChannelId(after, l)
          return was === now ? [] : [{ chip: l === 'pt' ? 'PT-BR' : 'EN', name: after.find(r => r.id === now)?.name ?? null }]
        })
        expect(languageChangeEffect(rows, ch.id, next), `${ch.id}→${next}`).toEqual(expected)
      }
    }
  })
  it('o dado não existe — canal fora da lista, mesmo idioma, lista vazia, created_at ausente: sem lançar', () => {
    expect(languageChangeEffect([PT], 'zzz', 'en')).toEqual([])
    expect(languageChangeEffect([PT], 'a', 'pt')).toEqual([])
    expect(languageChangeEffect([], 'a', 'en')).toEqual([])
    expect(languageChangeLines([{ id: 'a', name: 'A', locale: 'pt', created_at: null }], 'a', 'en')).toEqual(['PT-BR will show no channel.', 'EN will show “A”.'])
  })
})
