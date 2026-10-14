// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 9: as nove ações da ferramenta `observatorio_leitura`, o esquema de entrada e o mapa de cada ação para a tela do degrau 1.
 * Puro: sem banco, sem relógio. Entrada sem parâmetro equivalente na tela NUNCA some: sai em `semEquivalente` (e a Tarefa 10 a escreve no topo da resposta).
 */
import { describe, expect, it } from 'vitest'
import { ACOES, ENTRADA, traduzir, type Acao, type Pedido } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { DEFAULT_AGES } from '@/lib/youtube/observatorio/rules'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { FRASES_DA_FERRAMENTA } from '@/lib/youtube/observatorio/acesso-ia/frases'

const C1 = '11111111-1111-4111-8111-111111111111'
const C2 = '22222222-2222-4222-8222-222222222222'
const C3 = '33333333-3333-4333-8333-333333333333'
const C4 = '44444444-4444-4444-8444-444444444444'
const C5 = '55555555-5555-4555-8555-555555555555'
const C6 = '66666666-6666-4666-8666-666666666666'
const C7 = '77777777-7777-4777-8777-777777777777'
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

type Entrada = Record<string, unknown>

/** Passa pelo esquema e pela tradução, como a ferramenta faz. */
function pedir(entrada: Entrada): { ok: true; pedido: Pedido } | { ok: false; frase: string } {
  const lida = ENTRADA.safeParse(entrada)
  if (!lida.success) return { ok: false, frase: 'esquema: ' + lida.error.issues.map((i) => i.message).join('; ') }
  return traduzir(lida.data)
}
const aceita = (e: Entrada): Pedido => {
  const r = pedir(e)
  if (!r.ok) throw new Error('esperava aceitar: ' + r.frase)
  return r.pedido
}
const recusa = (e: Entrada): string => {
  const r = pedir(e)
  if (r.ok) throw new Error('esperava recusar')
  return r.frase
}

describe('as nove ações', () => {
  it('são as do spec (lista escrita aqui de propósito)', () => {
    expect([...ACOES]).toEqual(['definicoes', 'listar_canais', 'canal', 'video', 'comparar', 'destaques', 'serie', 'mudancas', 'pacote_da_tela'])
  })

  it('o mapa cobre as nove: cada ação tem uma entrada mínima que é aceita', () => {
    const minimas = {
      definicoes: { acao: 'definicoes' },
      listar_canais: { acao: 'listar_canais' },
      canal: { acao: 'canal', canal_id: C1 },
      video: { acao: 'video', video_id: V1 },
      comparar: { acao: 'comparar', canal_ids: [C1, C2] },
      destaques: { acao: 'destaques' },
      serie: { acao: 'serie', canal_id: C1, de: '2026-09-01', ate: '2026-09-30' },
      mudancas: { acao: 'mudancas' },
      pacote_da_tela: { acao: 'pacote_da_tela', tela: 'canais' },
    } satisfies Record<Acao, Entrada>
    for (const a of ACOES) expect(pedir(minimas[a]).ok, a).toBe(true)
  })

  it("ação desconhecida, '__proto__', 'constructor' e vazia: recusadas pelo esquema", () => {
    for (const acao of ['apagar', '__proto__', 'constructor', '', 'CANAL']) expect(ENTRADA.safeParse({ acao }).success, acao).toBe(false)
    expect(ENTRADA.safeParse({}).success).toBe(false)
    expect(ENTRADA.safeParse(null).success).toBe(false)
    expect(ENTRADA.safeParse('canal').success).toBe(false)
  })

  it('campo que o esquema não conhece é recusado (texto livre não existe): pergunta, texto, q, termo', () => {
    for (const campo of ['pergunta', 'texto', 'q', 'termo', 'busca']) {
      expect(ENTRADA.safeParse({ acao: 'canal', canal_id: C1, [campo]: 'o que ele publica?' }).success, campo).toBe(false)
    }
  })

  it('nenhum campo aceita texto livre com mais de 64 caracteres', () => {
    const longo = 'x'.repeat(65)
    expect(ENTRADA.safeParse({ acao: 'listar_canais', nicho: longo }).success).toBe(false)
    expect(ENTRADA.safeParse({ acao: 'pacote_da_tela', tela: 'canais', parametros: { niche: longo } }).success).toBe(false)
    expect(ENTRADA.safeParse({ acao: 'pacote_da_tela', tela: longo }).success).toBe(false)
    expect(ENTRADA.safeParse({ acao: 'canal', canal_id: longo }).success).toBe(false)
  })
})

describe('os ids', () => {
  it.each([
    ['com barra', 'abc/def'],
    ['com 300 caracteres', 'a'.repeat(300)],
    ['com espaço', 'abc def'],
    ['com ponto e vírgula', 'abc;def'],
    ['vazio', ''],
    ['com acento', 'canalé'],
  ])('id %s: recusado', (_n, id) => {
    expect(ENTRADA.safeParse({ acao: 'canal', canal_id: id }).success).toBe(false)
    expect(ENTRADA.safeParse({ acao: 'video', video_id: id }).success).toBe(false)
  })

  it('aceita uuid, id de canal do YouTube (UC + 22) e id de vídeo do YouTube (11)', () => {
    expect(ENTRADA.safeParse({ acao: 'canal', canal_id: C1 }).success).toBe(true)
    expect(ENTRADA.safeParse({ acao: 'canal', canal_id: 'UCabcdefghijklmnopqrstuv' }).success).toBe(true)
    expect(ENTRADA.safeParse({ acao: 'video', video_id: 'dQw4w9WgXcQ' }).success).toBe(true)
  })
})

describe('comparar', () => {
  it('com 1 canal e com 7: recusado com a frase; com 2 e com 6: aceito (fronteira)', () => {
    expect(recusa({ acao: 'comparar', canal_ids: [C1] })).toBe('comparar aceita de 2 a 6 canais; vieram 1')
    expect(recusa({ acao: 'comparar', canal_ids: [C1, C2, C3, C4, C5, C6, C7] })).toBe('comparar aceita de 2 a 6 canais; vieram 7')
    expect(recusa({ acao: 'comparar', canal_ids: [] })).toBe('comparar aceita de 2 a 6 canais; vieram 0')
    expect(pedir({ acao: 'comparar', canal_ids: [C1, C2] }).ok).toBe(true)
    expect(pedir({ acao: 'comparar', canal_ids: [C1, C2, C3, C4, C5, C6] }).ok).toBe(true)
  })

  it('o mesmo canal duas vezes: recusado (em maiúsculas também)', () => {
    expect(recusa({ acao: 'comparar', canal_ids: [C1, C1] })).toMatch(/mesmo canal/)
    expect(recusa({ acao: 'comparar', canal_ids: [C1, C2, C1.toUpperCase()] })).toMatch(/mesmo canal/)
  })

  it('com 4 canais: três pares, todos com o primeiro como a', () => {
    const p = aceita({ acao: 'comparar', canal_ids: [C1, C2, C3, C4] })
    expect(p.telas.map((t) => t.tela)).toEqual(['comparar', 'comparar', 'comparar'])
    expect(p.telas.map((t) => [t.sp.a, t.sp.b])).toEqual([[C1, C2], [C1, C3], [C1, C4]])
    expect(p.teto).toBe(60_000)
  })
})

describe('serie', () => {
  const base = { acao: 'serie', de: '2026-09-01', ate: '2026-09-30' }

  it('sem video_id nem canal_id, ou com os dois: recusada', () => {
    expect(recusa(base)).toMatch(/video_id ou canal_id/)
    expect(recusa({ ...base, video_id: V1, canal_id: C1 })).toMatch(/video_id ou canal_id/)
  })

  it('com de depois de ate: recusada; de igual a ate: aceita (fronteira)', () => {
    expect(recusa({ ...base, canal_id: C1, de: '2026-10-01', ate: '2026-09-30' })).toMatch(/depois/)
    expect(pedir({ ...base, canal_id: C1, de: '2026-09-30', ate: '2026-09-30' }).ok).toBe(true)
  })

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '26-09-01', '2026/09/01', '2026-09-1', 'ontem'])('data %s que não existe ou fora de forma: recusada', (d) => {
    expect(pedir({ ...base, canal_id: C1, de: d }).ok).toBe(false)
    expect(pedir({ ...base, canal_id: C1, ate: d }).ok).toBe(false)
  })

  it('ano bissexto: 2028-02-29 existe; 2027-02-29 não', () => {
    expect(pedir({ ...base, canal_id: C1, de: '2028-02-29', ate: '2028-03-01' }).ok).toBe(true)
    expect(pedir({ ...base, canal_id: C1, de: '2027-02-29', ate: '2027-03-01' }).ok).toBe(false)
  })

  it('o grão padrão é dia; semana é aceito; outro valor é recusado; o limite é de 400 pontos', () => {
    expect(aceita({ ...base, canal_id: C1 })).toMatchObject({ grao: 'dia', de: '2026-09-01', ate: '2026-09-30', limite: { tipo: 'pontos', n: 400 } })
    expect(aceita({ ...base, canal_id: C1, grao: 'semana' }).grao).toBe('semana')
    expect(ENTRADA.safeParse({ ...base, canal_id: C1, grao: 'mes' }).success).toBe(false)
  })

  it("canal_id vira a tela 'canal?' e video_id vira 'video?', com o id", () => {
    expect(aceita({ ...base, canal_id: C1 }).telas).toEqual([{ tela: 'canal?', id: C1, sp: { niche: 'todos' } }])
    expect(aceita({ ...base, video_id: V1 }).telas).toEqual([{ tela: 'video?', id: V1, sp: { niche: 'todos' } }])
  })
})

describe('pacote_da_tela', () => {
  it('tela inexistente: recusada com a frase própria, que lista as telas que existem', () => {
    const f = recusa({ acao: 'pacote_da_tela', tela: 'financeiro' })
    expect(f).toMatch(/tela desconhecida/)
    expect(f).toContain('canais')
  })

  it('tela em espera_a_tela (fila, ritmo): recusada com a frase própria', () => {
    expect(recusa({ acao: 'pacote_da_tela', tela: 'fila' })).toBe(FRASES_DA_FERRAMENTA.tela_sem_pacote)
    expect(recusa({ acao: 'pacote_da_tela', tela: 'ritmo' })).toBe(FRASES_DA_FERRAMENTA.tela_sem_pacote)
  })

  it('segue o registro do degrau 1: toda tela que EXISTE é aceita (com id quando pede), e toda em espera é recusada', () => {
    for (const [tela, def] of Object.entries(TELAS_IA)) {
      const r = pedir({ acao: 'pacote_da_tela', tela, ...(def.pedeId ? { id: C1 } : {}) })
      expect(r.ok, tela).toBe(def.estado === 'existe')
    }
  })

  it('tela que pede id sem id: recusada; id numa tela que não pede: vai para semEquivalente, não some', () => {
    expect(recusa({ acao: 'pacote_da_tela', tela: 'canal' })).toMatch(/pede um id/)
    const p = aceita({ acao: 'pacote_da_tela', tela: 'canais', id: C1 })
    expect(p.semEquivalente.join(' ')).toMatch(/id/)
  })

  it('tem teto 30.000 e as outras ações 60.000', () => {
    expect(aceita({ acao: 'pacote_da_tela', tela: 'canais' }).teto).toBe(30_000)
    expect(aceita({ acao: 'pacote_da_tela', tela: 'canais' }).teto).toBe(ACESSO_IA_RULES.tetoPacoteDaTela)
    for (const e of [{ acao: 'definicoes' }, { acao: 'listar_canais' }, { acao: 'canal', canal_id: C1 }, { acao: 'video', video_id: V1 }, { acao: 'destaques' }, { acao: 'mudancas' }]) {
      expect(aceita(e).teto, e.acao).toBe(60_000)
    }
  })

  it('os parâmetros da tela passam pelo que a tela entende; os que ela não entende aparecem em semEquivalente', () => {
    const p = aceita({ acao: 'pacote_da_tela', tela: 'canais', parametros: { fmt: 'shorts', sort: 'vpd', win: '30' } })
    expect(p.telas[0]!.sp).toMatchObject({ fmt: 'shorts', sort: 'vpd', niche: 'todos' })
    expect(p.telas[0]!.sp.win).toBeUndefined()
    expect(p.semEquivalente.join(' ')).toMatch(/win/)
  })
})

describe('nicho, janela e formato: o padrão e o que não tem equivalente', () => {
  it("nicho ausente vira 'todos' no sp (o padrão exercitado sem passar o campo)", () => {
    expect(aceita({ acao: 'listar_canais' }).telas[0]!.sp.niche).toBe('todos')
    expect(aceita({ acao: 'destaques' }).telas[0]!.sp.niche).toBe('todos')
    expect(aceita({ acao: 'mudancas' }).telas[0]!.sp.niche).toBe('todos')
  })

  it('nicho dado vai ao sp', () => {
    expect(aceita({ acao: 'listar_canais', nicho: 'viagem' }).telas[0]!.sp.niche).toBe('viagem')
    expect(aceita({ acao: 'destaques', nicho: 'ia' }).telas[0]!.sp.niche).toBe('ia')
  })

  it('destaques sem janela: o sp leva o recorte padrão da tela, e o pedido marca a janela usada para o cabeçalho escrever', () => {
    const p = aceita({ acao: 'destaques' })
    expect(p.telas[0]!.sp.age).toBe(DEFAULT_AGES.join(','))
    expect(p.janelaUsada).toMatch(/recorte padrão/)
  })

  it('destaques com janela: 30 -> 0-30; 90 -> o recorte de 90; todas -> all; 7 não existe na tela e aparece em semEquivalente', () => {
    expect(aceita({ acao: 'destaques', janela: '30' }).telas[0]!.sp.age).toBe('0-30')
    expect(aceita({ acao: 'destaques', janela: '90' }).telas[0]!.sp.age).toBe(DEFAULT_AGES.join(','))
    expect(aceita({ acao: 'destaques', janela: 'todas' }).telas[0]!.sp.age).toBe('all')
    const sete = aceita({ acao: 'destaques', janela: '7' })
    expect(sete.semEquivalente.join(' ')).toMatch(/7 dias/)
    expect(sete.janelaUsada).toBeDefined()
  })

  it('destaques: o formato todos não existe na tela (ela mostra longos); longos e shorts mapeiam para long e short', () => {
    expect(aceita({ acao: 'destaques', formato: 'longos' }).telas[0]!.sp.fmt).toBe('long')
    expect(aceita({ acao: 'destaques', formato: 'shorts' }).telas[0]!.sp.fmt).toBe('short')
    const t = aceita({ acao: 'destaques', formato: 'todos' })
    expect(t.semEquivalente.join(' ')).toMatch(/formato/)
  })

  it('destaques: o limite é de 50 vídeos', () => {
    expect(aceita({ acao: 'destaques' }).limite).toEqual({ tipo: 'linhas', n: 50 })
  })

  it('listar_canais: formato vai a fmt; janela não existe na tela de Canais e aparece em semEquivalente; limite 200', () => {
    const p = aceita({ acao: 'listar_canais', formato: 'shorts', janela: '30' })
    expect(p.telas[0]).toMatchObject({ tela: 'canais', sp: { fmt: 'shorts' } })
    expect(p.semEquivalente.join(' ')).toMatch(/janela/)
    expect(p.limite).toEqual({ tipo: 'linhas', n: 200 })
  })

  it('canal: formato vai a fmt; janela não existe na página do canal e aparece em semEquivalente', () => {
    const p = aceita({ acao: 'canal', canal_id: C1, formato: 'longos', janela: '90' })
    expect(p.telas[0]).toMatchObject({ tela: 'canal?', id: C1, sp: { fmt: 'longos' } })
    expect(p.semEquivalente.join(' ')).toMatch(/janela/)
  })

  it('comparar: janela e formato não existem na tela (ela compara um par) e aparecem em semEquivalente', () => {
    const p = aceita({ acao: 'comparar', canal_ids: [C1, C2], janela: '30', formato: 'longos' })
    expect(p.semEquivalente.join(' ')).toMatch(/janela/)
    expect(p.semEquivalente.join(' ')).toMatch(/formato/)
  })

  it('mudancas: janela 7, 30 e 90 vão a win; todas não existe (a tela vai até 90) e aparece em semEquivalente; desde também; canal_id vai a channel; limite 100', () => {
    expect(aceita({ acao: 'mudancas', janela: '7' }).telas[0]!.sp.win).toBe('7')
    expect(aceita({ acao: 'mudancas', janela: '90' }).telas[0]!.sp.win).toBe('90')
    const todas = aceita({ acao: 'mudancas', janela: 'todas' })
    expect(todas.telas[0]!.sp.win).toBe('90')
    expect(todas.semEquivalente.join(' ')).toMatch(/todas/)
    const desde = aceita({ acao: 'mudancas', desde: '2026-09-01', canal_id: C1 })
    expect(desde.telas[0]!.sp.channel).toBe(C1)
    expect(desde.semEquivalente.join(' ')).toMatch(/desde/)
    expect(aceita({ acao: 'mudancas' }).limite).toEqual({ tipo: 'linhas', n: 100 })
  })

  it("mudancas: formato todos vai a fmt 'all'; longos a long; shorts a short", () => {
    expect(aceita({ acao: 'mudancas', formato: 'todos' }).telas[0]!.sp.fmt).toBe('all')
    expect(aceita({ acao: 'mudancas', formato: 'longos' }).telas[0]!.sp.fmt).toBe('long')
    expect(aceita({ acao: 'mudancas', formato: 'shorts' }).telas[0]!.sp.fmt).toBe('short')
  })

  it('sem entrada sem equivalente, semEquivalente é vazio (não inventa aviso)', () => {
    for (const e of [{ acao: 'definicoes' }, { acao: 'listar_canais', formato: 'longos', nicho: 'viagem' }, { acao: 'canal', canal_id: C1 }, { acao: 'comparar', canal_ids: [C1, C2] }]) {
      expect(aceita(e).semEquivalente, e.acao).toEqual([])
    }
  })
})

describe('definicoes', () => {
  it('pede as cinco telas sem id, com o teto de 60.000 e limite fixo', () => {
    const p = aceita({ acao: 'definicoes' })
    expect(p.telas.map((t) => t.tela)).toEqual(['canais', 'comparar', 'outliers', 'insights', 'mudancas'])
    expect(p.teto).toBe(60_000)
    expect(p.limite.tipo).toBe('nenhum')
    for (const t of p.telas) expect(TELAS_IA[t.tela as keyof typeof TELAS_IA].pedeId).toBe(false)
  })
})
