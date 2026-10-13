// @vitest-environment node
// A5 · E14, Tarefa 3: a resposta de commentThreads.list e comments.list vira valor nosso.
import { describe, expect, it } from 'vitest'
import { limparTexto, conversaDe, loteDe, porIdDe, agregadosDoLote } from '@/lib/youtube/observatorio/comentarios/normalizar'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'
import type { Conversa } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  T0, H, iso, canal, CANAL_DO_VIDEO, CANAL_ACOMPANHADO,
  SENT_TEXTO_TOPO, SENT_NOME, SENT_TEXTO_TERCEIRO, SENT_NOME_TERCEIRO, SENT_ID_TOPO,
  conversa, resposta, corpoDeConversas, corpoPorId, comentarioPorId,
} from './comentarios-fixtures'

const ok = (item: unknown, pos = 0): Conversa => {
  const c = conversaDe(item, pos, CANAL_DO_VIDEO)
  if (!c) throw new Error('conversa descartada')
  return c
}

describe('limparTexto', () => {
  it('2.001 pontos de código são cortados e marcados; 2.000 não', () => {
    const r1 = limparTexto('a'.repeat(COMMENT_RULES.bodyMax + 1))
    expect(r1.cortado).toBe(true)
    expect(Array.from(r1.texto)).toHaveLength(COMMENT_RULES.bodyMax)
    const r2 = limparTexto('a'.repeat(COMMENT_RULES.bodyMax))
    expect(r2.cortado).toBe(false)
    expect(r2.texto).toHaveLength(COMMENT_RULES.bodyMax)
  })
  it('emoji no corte não parte o par', () => {
    const r = limparTexto('a'.repeat(COMMENT_RULES.bodyMax - 1) + '😀' + 'b')
    expect(r.cortado).toBe(true)
    expect(Array.from(r.texto)).toHaveLength(COMMENT_RULES.bodyMax)
    expect(r.texto.endsWith('😀')).toBe(true)
    expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(r.texto)).toBe(false)
  })
  it('NUL sai e substituto solitário vira U+FFFD; par válido fica', () => {
    const r = limparTexto('a\u0000b\ud800c😀\udc00d')
    expect(r.texto).toBe('ab�c😀�d')
    expect(r.cortado).toBe(false)
  })
  it('HTML fica como veio (é texto; quem escapa é a tela)', () => {
    expect(limparTexto('<script>alert(1)</script> &amp;').texto).toBe('<script>alert(1)</script> &amp;')
  })
})

describe('conversaDe', () => {
  it('1. conversa completa; editadoEm nulo quando updatedAt = publishedAt', () => {
    const c = ok(conversa(3, { texto: 'Olá\ncom quebra de linha 😀', nome: 'Autor Inventado 3', canalId: canal(103), curtidas: 42, totalReplyCount: 0 }), 7)
    expect(c).toEqual({
      id: 'Ugx-sintetico-03', posicao: 7, texto: 'Olá\ncom quebra de linha 😀', cortado: false,
      publicadoEm: iso(T0 + 3 * H), editadoEm: null, curtidas: 42, respostasTotal: 0,
      autor: { nome: 'Autor Inventado 3', canalId: canal(103), foto: 'https://exemplo.invalid/foto/3.jpg' },
      doCriador: false, criadorRespondeu: false, respostasDoCriador: [], canaisNasRespostas: [],
    })
  })
  it('editadoEm preenchido só quando updatedAt difere de publishedAt', () => {
    const c = ok(conversa(3, { editadoEm: iso(T0 + 9 * H) }))
    expect(c.editadoEm).toBe(iso(T0 + 9 * H))
  })
  it('2. criador_respondeu: sim com resposta do canal do vídeo entre as vistas', () => {
    const pai = 'Ugx-sintetico-10'
    const c = ok(conversa(10, { totalReplyCount: 811, respostas: [resposta(pai, 1), resposta(pai, 2, { canalId: CANAL_DO_VIDEO, texto: 'Resposta do criador inventada' })] }))
    expect(c.criadorRespondeu).toBe(true)
    expect(c.respostasDoCriador.map(r => r.texto)).toEqual(['Resposta do criador inventada'])
    expect(c.respostasDoCriador[0]!.autorCanalId).toBe(CANAL_DO_VIDEO)
  })
  it('3. criador_respondeu: não só quando vistas = total (3 de 3, nenhuma dele)', () => {
    const pai = 'Ugx-sintetico-11'
    const c = ok(conversa(11, { totalReplyCount: 3, respostas: [resposta(pai, 1), resposta(pai, 2), resposta(pai, 3)] }))
    expect(c.criadorRespondeu).toBe(false)
  })
  it('4. criador_respondeu: nulo quando vieram 5 de 811 e nenhuma é dele', () => {
    const pai = 'Ugx-sintetico-12'
    const rs = [1, 2, 3, 4, 5].map(n => resposta(pai, n))
    const c = ok(conversa(12, { totalReplyCount: 811, respostas: rs }))
    expect(c.criadorRespondeu).toBeNull()
    expect(c.respostasTotal).toBe(811)
  })
  it('5. comentário de topo do criador: doCriador verdadeiro', () => {
    const c = ok(conversa(4, { canalId: CANAL_DO_VIDEO }))
    expect(c.doCriador).toBe(true)
    expect(c.autor.canalId).toBe(CANAL_DO_VIDEO)
  })
  it('6. no máximo 3 respostas do criador, as mais antigas primeiro', () => {
    const pai = 'Ugx-sintetico-13'
    // fora de ordem de propósito: as datas decidem
    const rs = [5, 2, 4, 1, 3].map(n => resposta(pai, n, { canalId: CANAL_DO_VIDEO }))
    const c = ok(conversa(13, { totalReplyCount: 5, respostas: rs }))
    expect(c.respostasDoCriador).toHaveLength(COMMENT_RULES.creatorRepliesMax)
    expect(c.respostasDoCriador.map(r => r.publicadoEm)).toEqual([1, 2, 3].map(n => iso(T0 + n * H)))
  })
  it('7. descarta conversa sem id, sem likeCount, com likeCount "abc", sem publishedAt, com publishedAt "ontem", sem texto', () => {
    const ruins = [
      conversa(1, { id: null }),
      conversa(2, { curtidas: 'sem-chave' }),
      conversa(3, { curtidas: 'abc' }),
      conversa(4, { publicadoEm: 'sem-chave' }),
      conversa(5, { publicadoEm: 'ontem' }),
      conversa(6, { texto: null }),
    ]
    for (const r of ruins) expect(conversaDe(r, 0, CANAL_DO_VIDEO)).toBeNull()
    const lote = loteDe(corpoDeConversas(ruins), CANAL_DO_VIDEO)
    expect(lote).not.toBeNull()
    expect(lote!.conversas).toEqual([])
    expect(lote!.descartadas).toBe(6)
  })
  it('descarta também item sem snippet, sem topLevelComment, texto só de NUL ou de espaços, e valor que não é objeto', () => {
    const ruins: unknown[] = [conversa(1, { semSnippet: true }), conversa(2, { semTopLevel: true }), conversa(3, { texto: '\u0000\u0000' }), conversa(4, { texto: '  \n ' }), null, 'texto', 42, []]
    for (const r of ruins) expect(conversaDe(r, 0, CANAL_DO_VIDEO)).toBeNull()
  })
  it('likeCount ausente nunca vira 0: a conversa some em vez de aparecer com 0 curtida; 0 de verdade fica', () => {
    expect(conversaDe(conversa(1, { curtidas: 'sem-chave' }), 0, CANAL_DO_VIDEO)).toBeNull()
    expect(ok(conversa(1, { curtidas: 0 })).curtidas).toBe(0)
    expect(ok(conversa(1, { curtidas: '17' })).curtidas).toBe(17)
  })
  it('8. autor sem authorChannelId: canalId nulo, doCriador falso (e sem nome: nome nulo)', () => {
    const c = ok(conversa(5, { canalId: 'sem-chave', nome: null }))
    expect(c.autor.canalId).toBeNull()
    expect(c.autor.nome).toBeNull()
    expect(c.doCriador).toBe(false)
  })
  it('totalReplyCount ausente: sem respostas vistas é nulo; replies ausente com total 0 é falso', () => {
    expect(ok(conversa(6, { totalReplyCount: 'sem-chave' })).criadorRespondeu).toBeNull()
    const c = ok(conversa(6, { totalReplyCount: 0, respostas: 'sem-chave' }))
    expect(c.criadorRespondeu).toBe(false)
    expect(c.respostasDoCriador).toEqual([])
    const d = ok(conversa(7, { totalReplyCount: 4, respostas: 'sem-chave' }))
    expect(d.criadorRespondeu).toBeNull()
    expect(d.respostasTotal).toBe(4)
  })
  it('9. texto longo é cortado e marcado; com emoji no corte não parte o par', () => {
    const longo = ok(conversa(8, { texto: 'a'.repeat(2001) }))
    expect(longo.cortado).toBe(true)
    expect(Array.from(longo.texto)).toHaveLength(2000)
    const justo = ok(conversa(8, { texto: 'a'.repeat(2000) }))
    expect(justo.cortado).toBe(false)
    const emoji = ok(conversa(8, { texto: 'a'.repeat(1999) + '😀😀' }))
    expect(emoji.cortado).toBe(true)
    expect(emoji.texto.endsWith('😀')).toBe(true)
    expect(Array.from(emoji.texto)).toHaveLength(2000)
  })
  it('10. texto, nome e foto com NUL e substituto solitário são limpos; <script> fica como veio', () => {
    const c = ok(conversa(9, { texto: 'a\u0000b\ud83dc <script>x</script>', nome: 'Nome\u0000 Inventado\udc00' }))
    expect(c.texto).toBe('ab�c <script>x</script>')
    expect(c.autor.nome).toBe('Nome Inventado�')
    expect(JSON.stringify(c)).not.toMatch(/\\u0000/)
  })
  it('resposta com data ilegível ou sem curtida legível não conta como vista (a resposta do criador some, o resultado é "não se sabe")', () => {
    const pai = 'Ugx-sintetico-14'
    const rs = [resposta(pai, 1, { canalId: CANAL_DO_VIDEO, publicadoEm: 'ontem' }), resposta(pai, 2, { canalId: CANAL_DO_VIDEO, curtidas: 'sem-chave' })]
    const c = ok(conversa(14, { totalReplyCount: 2, respostas: rs }))
    expect(c.respostasDoCriador).toEqual([])
    expect(c.criadorRespondeu).toBeNull()
  })
  it('16. duas respostas do criador com o mesmo id: uma', () => {
    const pai = 'Ugx-sintetico-15'
    const rs = [resposta(pai, 1, { id: 'repetido', canalId: CANAL_DO_VIDEO }), resposta(pai, 2, { id: 'repetido', canalId: CANAL_DO_VIDEO })]
    const c = ok(conversa(15, { totalReplyCount: 2, respostas: rs }))
    expect(c.respostasDoCriador).toHaveLength(1)
  })
  it('15. nenhuma resposta de terceiro tem texto ou nome na saída; o id do canal dele fica em canaisNasRespostas', () => {
    const pai = 'Ugx-sintetico-16'
    const rs = [
      resposta(pai, 1, { texto: SENT_TEXTO_TERCEIRO, nome: SENT_NOME_TERCEIRO, canalId: CANAL_ACOMPANHADO }),
      resposta(pai, 2, { canalId: CANAL_DO_VIDEO, texto: 'Resposta do criador inventada' }),
      resposta(pai, 3, { canalId: CANAL_ACOMPANHADO }),
      resposta(pai, 4, { canalId: 'sem-chave' }),
    ]
    const c = ok(conversa(16, { totalReplyCount: 4, respostas: rs }))
    const json = JSON.stringify(c)
    expect(json).not.toContain(SENT_TEXTO_TERCEIRO)
    expect(json).not.toContain(SENT_NOME_TERCEIRO)
    expect(c.canaisNasRespostas.sort()).toEqual([CANAL_ACOMPANHADO, CANAL_DO_VIDEO].sort())
    for (const r of c.respostasDoCriador) expect(r.autorCanalId).toBe(CANAL_DO_VIDEO)
  })
})

describe('loteDe', () => {
  it('11. sem items, com items objeto, com corpo nulo ou de outro tipo: nulo (nunca lista vazia)', () => {
    expect(loteDe({ kind: 'x' }, CANAL_DO_VIDEO)).toBeNull()
    expect(loteDe({ items: { a: 1 } }, CANAL_DO_VIDEO)).toBeNull()
    expect(loteDe(null, CANAL_DO_VIDEO)).toBeNull()
    expect(loteDe(undefined, CANAL_DO_VIDEO)).toBeNull()
    expect(loteDe('texto', CANAL_DO_VIDEO)).toBeNull()
    expect(loteDe([], CANAL_DO_VIDEO)).toBeNull()
  })
  it('12. items [] é lista vazia e completa', () => {
    expect(loteDe(corpoDeConversas([]), CANAL_DO_VIDEO)).toEqual({ conversas: [], descartadas: 0, completo: true })
  })
  it('13. completo é falso com nextPageToken', () => {
    const l = loteDe(corpoDeConversas([conversa(1)], { nextPageToken: 'token-inventado' }), CANAL_DO_VIDEO)
    expect(l!.completo).toBe(false)
    expect(l!.conversas).toHaveLength(1)
    expect(loteDe(corpoDeConversas([conversa(1)]), CANAL_DO_VIDEO)!.completo).toBe(true)
  })
  it('a posição é a da lista da API, mesmo com descartadas no meio', () => {
    const l = loteDe(corpoDeConversas([conversa(1), conversa(2, { id: null }), conversa(3)]), CANAL_DO_VIDEO)!
    expect(l.conversas.map(c => c.posicao)).toEqual([0, 2])
    expect(l.descartadas).toBe(1)
  })
  it('16. duas conversas com o mesmo id: uma (a primeira) e descartadas 1', () => {
    const l = loteDe(corpoDeConversas([conversa(1, { id: 'igual', curtidas: 5 }), conversa(2, { id: 'igual', curtidas: 9 })]), CANAL_DO_VIDEO)!
    expect(l.conversas).toHaveLength(1)
    expect(l.conversas[0]!.curtidas).toBe(5)
    expect(l.descartadas).toBe(1)
  })
})

describe('data que o Postgres recusaria (M-1)', () => {
  const inexistentes = ['2026-02-30T10:00:00Z', '2026-13-01T10:00:00Z', '2026-04-31T00:00:00Z', '2025-02-29T00:00:00Z', '12']
  it('publishedAt de dia inexistente ou fora do formato descarta a conversa', () => {
    for (const publicadoEm of inexistentes) expect(conversaDe(conversa(1, { publicadoEm }), 0, CANAL_DO_VIDEO), publicadoEm).toBeNull()
  })
  it('dia existente passa, inclusive 29 de fevereiro de ano bissexto', () => {
    for (const publicadoEm of ['2024-02-29T10:00:00Z', '2026-01-31T23:59:59Z', '2026-02-28T00:00:00.000Z']) {
      expect(conversaDe(conversa(1, { publicadoEm }), 0, CANAL_DO_VIDEO)?.publicadoEm, publicadoEm).toBe(publicadoEm)
    }
  })
  it('updatedAt de dia inexistente vira editadoEm nulo (a conversa fica)', () => {
    const c = ok(conversa(2, { editadoEm: '2026-02-30T10:00:00Z' }))
    expect(c.editadoEm).toBeNull()
  })
  it('porIdDe: updatedAt de dia inexistente vira editadoEm nulo; publishedAt de dia inexistente também', () => {
    const m = porIdDe(corpoPorId([
      comentarioPorId('a', { editadoEm: '2026-02-30T10:00:00Z', publicadoEm: iso(T0) }),
      comentarioPorId('b', { editadoEm: iso(T0 + 5 * H), publicadoEm: '2026-02-30T10:00:00Z' }),
    ]))!
    expect(m.get('a')!.editadoEm).toBeNull()
    expect(m.get('b')!.editadoEm).toBeNull()
  })
})

describe('porIdDe', () => {
  it('14. 10 pedidos, 9 devolvidos: mapa com 9; sem items: nulo', () => {
    const itens = Array.from({ length: 9 }, (_, i) => comentarioPorId(`Ugx-id-${i}`, { curtidas: i, texto: `Texto ${i}` }))
    const m = porIdDe(corpoPorId(itens))!
    expect(m.size).toBe(9)
    expect(m.get('Ugx-id-4')).toEqual({ texto: 'Texto 4', cortado: false, editadoEm: null, curtidas: 4, respostasTotal: null })
    expect(m.has('Ugx-id-9')).toBe(false)
    expect(porIdDe({ kind: 'x' })).toBeNull()
    expect(porIdDe(null)).toBeNull()
    expect(porIdDe({ items: 'x' })).toBeNull()
    expect(porIdDe(corpoPorId([]))!.size).toBe(0)
  })
  it('texto cortado, limpo e editadoEm; curtida ilegível fica nula (não zero) e o comentário continua no mapa', () => {
    const m = porIdDe(corpoPorId([
      comentarioPorId('a', { texto: 'x'.repeat(2001), editadoEm: iso(T0 + 50 * H), publicadoEm: iso(T0) }),
      comentarioPorId('b', { texto: 'ok\u0000', curtidas: 'sem-chave' }),
    ]))!
    expect(m.get('a')!.cortado).toBe(true)
    expect(m.get('a')!.editadoEm).toBe(iso(T0 + 50 * H))
    expect(m.get('b')).toEqual({ texto: 'ok', cortado: false, editadoEm: null, curtidas: null, respostasTotal: null })
  })
})

describe('agregadosDoLote', () => {
  const lote = (): { conversas: Conversa[]; descartadas: number } => {
    const pai = (n: number): string => `Ugx-sintetico-${String(n).padStart(2, '0')}`
    const itens = [
      conversa(1, { curtidas: 10, canalId: canal(201), totalReplyCount: 2 }),
      conversa(2, { curtidas: 30, canalId: canal(201), totalReplyCount: 0, publicadoEm: iso(T0 + 30 * H) }),
      conversa(3, { curtidas: 0, canalId: 'sem-chave', totalReplyCount: 1, respostas: [resposta(pai(3), 1, { canalId: CANAL_DO_VIDEO })] }),
      conversa(4, { curtidas: 20, canalId: CANAL_DO_VIDEO, totalReplyCount: 5, respostas: [resposta(pai(4), 1)] }),
      conversa(5, { curtidas: 40, canalId: canal(205), totalReplyCount: 0 }),
      conversa(6, { id: null }),
    ]
    const l = loteDe(corpoDeConversas(itens), CANAL_DO_VIDEO)!
    return l
  }
  it('17. 5 conversas conhecidas dão as 13 chaves certas', () => {
    const a = agregadosDoLote(lote(), T0)
    expect(a).toEqual({
      conversas: 5, descartadas: 1, curtidas_soma: 100, curtidas_max: 40, curtidas_mediana: 20,
      respostas_soma: 8, do_criador: 1, criador_respondeu_sim: 1, criador_respondeu_nao: 2, criador_respondeu_nao_se_sabe: 2,
      autores_distintos: 3, sem_canal: 1, nas_primeiras_24h: 4,
    })
    expect(Object.keys(a)).toHaveLength(13)
  })
  it('mediana com quantidade par é a média dos dois do meio', () => {
    const l = loteDe(corpoDeConversas([conversa(1, { curtidas: 1 }), conversa(2, { curtidas: 4 })]), CANAL_DO_VIDEO)!
    expect(agregadosDoLote(l, T0).curtidas_mediana).toBe(2.5)
  })
  it('17. lote vazio não inventa máximo nem mediana', () => {
    const a = agregadosDoLote({ conversas: [], descartadas: 0 }, T0)
    expect(a).toEqual({
      conversas: 0, descartadas: 0, curtidas_soma: 0, respostas_soma: 0, do_criador: 0, criador_respondeu_sim: 0, criador_respondeu_nao: 0,
      criador_respondeu_nao_se_sabe: 0, autores_distintos: 0, sem_canal: 0, nas_primeiras_24h: 0,
    })
    expect('curtidas_max' in a).toBe(false)
    expect('curtidas_mediana' in a).toBe(false)
  })
  it('17. a saída serializada não contém sentinela de texto, nome nem id, e todo valor é número', () => {
    const l = loteDe(corpoDeConversas([
      conversa(1, { id: SENT_ID_TOPO, texto: SENT_TEXTO_TOPO, nome: SENT_NOME, canalId: canal(301), curtidas: 3 }),
      conversa(2, { texto: SENT_TEXTO_TERCEIRO, nome: SENT_NOME_TERCEIRO, canalId: CANAL_ACOMPANHADO, curtidas: 5, respostas: [resposta('p', 1, { texto: SENT_TEXTO_TERCEIRO })], totalReplyCount: 1 }),
    ]), CANAL_DO_VIDEO)!
    const a = agregadosDoLote(l, T0)
    const json = JSON.stringify(a)
    for (const s of [SENT_TEXTO_TOPO, SENT_NOME, SENT_TEXTO_TERCEIRO, SENT_NOME_TERCEIRO, SENT_ID_TOPO, canal(301), CANAL_ACOMPANHADO]) expect(json).not.toContain(s)
    for (const v of Object.values(a)) expect(typeof v).toBe('number')
  })
})
