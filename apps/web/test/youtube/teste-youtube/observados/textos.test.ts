// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { EstadoMiniatura, EstadoTitulo, EstadoTituloBase } from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { decidirCampo, qualificadas } from '@/lib/youtube/teste-youtube/observados/inferir'
import { AINDA_NAO_CONFERIDA, dia, NOTA_PASSAGENS, quando, TEXTO_MOTIVO, textoMiniatura, textoTitulo } from '@/lib/youtube/teste-youtube/observados/textos'

const AGORA = Date.parse('2026-10-23T15:00:00Z') // 23/10 12h em São Paulo
const H = 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString()
const o = { agoraMs: AGORA, trocaConferida: false }
const v = (ref: string, n: number, hAtras = 3) => ({ ref, rodadasEmW: n, ultimaVista: iso(AGORA - hAtras * H) })

describe('formatação de datas (America/Sao_Paulo)', () => {
  it('quando e dia', () => {
    expect(quando('2026-10-22T13:00:00Z')).toBe('22/10 10h')
    expect(quando('2026-10-21T04:00:00Z')).toBe('21/10 01h')
    expect(dia('2026-10-22T13:00:00Z')).toBe('22/10')
    expect(dia('2026-10-23T02:59:00Z')).toBe('22/10') // ainda 22/10 em SP
  })
  it('tabela de motivos literal do §11', () => {
    expect(TEXTO_MOTIVO).toEqual({
      aprendendo: 'vídeo novo, juntando passagens (até 4 dias)', sem_leitura: 'sonda sem leitura desde {quando}', flag_off: 'leitura de concorrentes desligada',
      sem_publicacao: 'sem data de publicação', saiu: 'saiu da observação', regra: 'leitura inconclusiva agora: títulos mudando sem padrão claro',
    })
    expect(NOTA_PASSAGENS).toBe('a contagem é das nossas passagens, não da divisão de público do YouTube')
    expect(AINDA_NAO_CONFERIDA).toBe('Ainda não conferida com os dados do YouTube.')
  })
})

describe('textos do título (§11, igualdade exata)', () => {
  const emAndamento: EstadoTitulo = { estado: 'em_andamento', sumindo: false, passagens: 8, desde: '2026-10-22T13:00:00Z', ate: iso(AGORA - 3 * H), versoes: [v('A', 5), v('B', 2), v('C', 1)] }
  it('em andamento', () => {
    expect(textoTitulo(emAndamento, o)).toBe("Possível teste do YouTube: 3 títulos alternando desde 22/10 10h (8 passagens da sonda). 'A' em 5 de 8 passagens, 'B' em 2 de 8, 'C' em 1 de 8.")
  })
  it('sumindo', () => {
    const e: EstadoTitulo = { estado: 'em_andamento', sumindo: true, passagens: 8, desde: '2026-10-22T13:00:00Z', ate: iso(AGORA), versoes: [v('A', 8), v('B', 0), { ref: 'C', rodadasEmW: 0, ultimaVista: '2026-10-22T21:00:00Z' }] }
    expect(textoTitulo(e, o)).toBe("Possível teste do YouTube: 1 título segue. 'B' e 'C' não aparecem desde 23/10 09h.")
    expect(textoTitulo({ ...e, versoes: [v('A', 4), v('X', 4), { ref: 'B', rodadasEmW: 0, ultimaVista: '2026-10-22T21:00:00Z' }] }, o))
      .toBe("Possível teste do YouTube: 2 títulos seguem. 'B' não aparece desde 22/10 18h.")
  })
  it('provavelmente terminou, com 1 e com 2 sumidas', () => {
    const um: EstadoTitulo = { estado: 'provavelmente_terminou', ficou: 'X', sumidas: [{ ref: 'B', rodadasEmW: 0, ultimaVista: iso(AGORA - 3 * 86_400_000 - H) }] }
    expect(textoTitulo(um, o)).toBe("Possível teste do YouTube, provavelmente terminou: ficou 'X'. 'B' não aparece há 3 dias. Pode reabrir se 'B' voltar.")
    const dois: EstadoTitulo = { estado: 'provavelmente_terminou', ficou: 'X', sumidas: [um.sumidas[0]!, { ref: 'C', rodadasEmW: 0, ultimaVista: iso(AGORA - 5 * 86_400_000) }] }
    expect(textoTitulo(dois, o)).toBe("Possível teste do YouTube, provavelmente terminou: ficou 'X'. 'B' e 'C' não aparecem há 3 dias. Pode reabrir se 'B' ou 'C' voltar.")
  })
  it('terminou há menos de 1 dia: "há menos de 1 dia", nunca "há 0 dias"; 1 dia e 2 dias seguem', () => {
    const sum = (ms: number): EstadoTitulo => ({ estado: 'provavelmente_terminou', ficou: 'X', sumidas: [{ ref: 'B', rodadasEmW: 0, ultimaVista: iso(AGORA - ms) }] })
    expect(textoTitulo(sum(5 * H), o)).toBe("Possível teste do YouTube, provavelmente terminou: ficou 'X'. 'B' não aparece há menos de 1 dia. Pode reabrir se 'B' voltar.")
    expect(textoTitulo(sum(0), o)).toContain('há menos de 1 dia')
    expect(textoTitulo(sum(86_400_000), o)).toContain('há 1 dia.')
    expect(textoTitulo(sum(2 * 86_400_000 + H), o)).toContain('há 2 dias.')
  })
  it('"0 títulos seguem" é inalcançável: todo "sumindo" decidido tem a versão que ficou (x) em >= 2 rodadas de W', () => {
    let s = 12345
    const rnd = (): number => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
    let sumindos = 0
    for (let it = 0; it < 30000; it++) {
      const teste = 8 + Math.floor(rnd() * 8)
      const cauda = 8 + Math.floor(rnd() * 5)
      const n = teste + cauda
      const rs = Array.from({ length: n }, (_, i) => {
        const vs = new Set<string>()
        if (i < teste) { vs.add(rnd() < 0.5 ? 'A' : 'B'); if (rnd() < 0.3) vs.add('A').add('B') } else { vs.add('A'); if (rnd() < 0.15) vs.add(rnd() < 0.5 ? 'B' : 'C') }
        return { tMs: AGORA - (n - i) * 6 * H, rodadaId: `r${i}`, versoes: vs as ReadonlySet<string> }
      })
      const d = decidirCampo('titulo', rs, { publicadoMs: AGORA - 90 * 86_400_000, agoraMs: AGORA })
      if (d.estado !== 'sumindo') continue
      sumindos++
      const seguem = [...qualificadas(d.w)].filter(v => !d.sumidas.includes(v))
      expect(seguem.length, JSON.stringify(rs.map(r => [...r.versoes]))).toBeGreaterThanOrEqual(1)
    }
    expect(sumindos).toBeGreaterThan(0)
  })
  it('troca, com e sem conferida; troca que cruza o dia', () => {
    const t: EstadoTitulo = { estado: 'troca', antes: 'A', depois: 'B', entre: { de: '2026-10-20T16:00:00Z', ate: '2026-10-20T22:00:00Z' }, vistoAte: iso(AGORA) }
    expect(textoTitulo(t, o)).toBe("Título trocado entre 20/10 13h e 19h: 'A' → 'B'. Pode ser edição manual. Ainda não conferida com os dados do YouTube.")
    expect(textoTitulo(t, { ...o, trocaConferida: true })).toBe("Título trocado entre 20/10 13h e 19h: 'A' → 'B'. Pode ser edição manual.")
    const cruza: EstadoTitulo = { ...t, entre: { de: '2026-10-20T22:00:00Z', ate: '2026-10-21T04:00:00Z' } }
    expect(textoTitulo(cruza, { ...o, trocaConferida: true })).toBe("Título trocado entre 20/10 19h e 21/10 01h: 'A' → 'B'. Pode ser edição manual.")
  })
  it('sem troca vista', () => {
    expect(textoTitulo({ estado: 'sem_troca_vista', desde: '2026-10-21T15:00:00Z' }, o)).toBe('Um título só nas últimas 8 passagens (desde 21/10). Não quer dizer que não houve teste antes.')
  })
  it('não medido: cada motivo', () => {
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'aprendendo' }, o)).toBe('Não medido agora (vídeo novo, juntando passagens (até 4 dias)).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'flag_off' }, o)).toBe('Não medido agora (leitura de concorrentes desligada).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'sem_publicacao' }, o)).toBe('Não medido agora (sem data de publicação).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'saiu' }, o)).toBe('Não medido agora (saiu da observação).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'regra' }, o)).toBe('Não medido agora (leitura inconclusiva agora: títulos mudando sem padrão claro).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'sem_leitura', vistoAte: '2026-10-23T13:00:00Z' }, o)).toBe('Não medido agora (sonda sem leitura desde 23/10 10h).')
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'sem_leitura' }, o)).toBe('Não medido agora (sonda sem leitura).')
  })
  it('não medido com último estado visto', () => {
    const ultimo: EstadoTituloBase = { estado: 'sem_troca_vista', desde: '2026-10-21T15:00:00Z' }
    expect(textoTitulo({ estado: 'nao_medido', motivo: 'sem_leitura', vistoAte: '2026-10-23T13:00:00Z', ultimo }, o))
      .toBe('Não medido agora (sonda sem leitura desde 23/10 10h). Último estado visto até 23/10: Um título só nas últimas 8 passagens (desde 21/10). Não quer dizer que não houve teste antes.')
  })
  it('fora da janela', () => {
    const ultimo: EstadoTituloBase = { estado: 'sem_troca_vista', desde: '2026-10-21T15:00:00Z' }
    expect(textoTitulo({ estado: 'fora_da_janela', ultimo, vistoAte: '2026-10-22T13:00:00Z' }, o))
      .toBe('Fora da observação desde 22/10 (30 dias da publicação). Último estado: Um título só nas últimas 8 passagens (desde 21/10). Não quer dizer que não houve teste antes.')
    expect(textoTitulo({ estado: 'fora_da_janela', ultimo: null, vistoAte: '2026-10-22T13:00:00Z' }, o)).toBe('Fora da observação desde 22/10 (30 dias da publicação). Último estado: não medido.')
    expect(textoTitulo({ estado: 'fora_da_janela', ultimo: null, vistoAte: '' }, o)).toBe('Fora da observação (30 dias da publicação). Último estado: não medido.') // Yannis M-4: nunca "desde "
  })
  it('versão de 100 emojis: corta em 79 pontos de código + reticências, sem surrogate solto', () => {
    const longo = '😀'.repeat(100)
    const t = textoTitulo({ estado: 'provavelmente_terminou', ficou: longo, sumidas: [] }, o)
    expect(t).toContain("'" + '😀'.repeat(79) + "…'")
    expect(t).not.toContain('😀'.repeat(80))
    expect(t).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
    expect(textoTitulo({ estado: 'provavelmente_terminou', ficou: '😀'.repeat(80), sumidas: [] }, o)).toContain("'" + '😀'.repeat(80) + "'")
  })
})

describe('textos da miniatura (§11)', () => {
  it('troca, indeterminada, sem troca vista', () => {
    expect(textoMiniatura({ estado: 'troca', antes: 'a', depois: 'b', entre: { de: '2026-10-20T16:00:00Z', ate: '2026-10-21T15:00:00Z' }, vistoAte: iso(AGORA) }, o)).toBe('Miniatura trocada em 21/10 (a anterior não voltou).')
    expect(textoMiniatura({ estado: 'indeterminada' }, o)).toBe('Miniatura alternando entre versões: não dá para afirmar troca.')
    expect(textoMiniatura({ estado: 'sem_troca_vista', desde: iso(AGORA) }, o)).toBe('A mesma miniatura nas últimas 8 passagens. O teste de miniatura dos concorrentes não é visível para nós.')
  })
  it('não medido e fora da janela com último', () => {
    expect(textoMiniatura({ estado: 'nao_medido', motivo: 'regra', ultimo: { estado: 'indeterminada' }, vistoAte: '2026-10-23T13:00:00Z' }, o))
      .toBe('Não medido agora (leitura inconclusiva agora: títulos mudando sem padrão claro). Último estado visto até 23/10: Miniatura alternando entre versões: não dá para afirmar troca.')
    expect(textoMiniatura({ estado: 'fora_da_janela', ultimo: { estado: 'indeterminada' }, vistoAte: '2026-10-22T13:00:00Z' }, o))
      .toBe('Fora da observação desde 22/10 (30 dias da publicação). Último estado: Miniatura alternando entre versões: não dá para afirmar troca.')
  })
})

describe('regras de redação do §11', () => {
  const titulos: EstadoTitulo[] = [
    { estado: 'em_andamento', sumindo: false, passagens: 8, desde: iso(AGORA - 50 * H), ate: iso(AGORA), versoes: [v('A', 5), v('B', 3)] },
    { estado: 'em_andamento', sumindo: true, passagens: 8, desde: iso(AGORA - 50 * H), ate: iso(AGORA), versoes: [v('A', 8), v('B', 0)] },
    { estado: 'provavelmente_terminou', ficou: 'X', sumidas: [v('B', 0, 80)] },
    { estado: 'troca', antes: 'A', depois: 'B', entre: { de: iso(AGORA - 90 * H), ate: iso(AGORA - 84 * H) }, vistoAte: iso(AGORA) },
    { estado: 'sem_troca_vista', desde: iso(AGORA - 48 * H) },
    { estado: 'nao_medido', motivo: 'regra', ultimo: { estado: 'em_andamento', sumindo: false, passagens: 8, desde: iso(AGORA - 50 * H), ate: iso(AGORA), versoes: [v('A', 5), v('B', 3)] }, vistoAte: iso(AGORA) },
    { estado: 'fora_da_janela', ultimo: { estado: 'provavelmente_terminou', ficou: 'X', sumidas: [v('B', 0, 80)] }, vistoAte: iso(AGORA) },
  ]
  const miniaturas: EstadoMiniatura[] = [{ estado: 'indeterminada' }, { estado: 'sem_troca_vista', desde: iso(AGORA) }, { estado: 'nao_medido', motivo: 'flag_off' }]
  const todos = [...titulos.map(t => textoTitulo(t, o)), ...titulos.map(t => textoTitulo(t, { ...o, trocaConferida: true })), ...miniaturas.map(m => textoMiniatura(m, o))]
  it('nenhum texto contém "venceu" nem "%"', () => {
    for (const t of todos) { expect(t).not.toMatch(/venceu/i); expect(t).not.toContain('%') }
  })
  it('todo texto que fala de "teste do YouTube" diz "possível teste do YouTube" (Yannis I2)', () => {
    for (const t of todos) if (/teste do YouTube/i.test(t)) expect(t, t).toMatch(/possível teste do YouTube/i)
  })
})
