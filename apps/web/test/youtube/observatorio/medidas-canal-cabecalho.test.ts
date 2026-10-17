// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { celulasDoCabecalho, colunasDosPontinhos, formatoDoCanal, maisNumeros, type EntradaDoCabecalho } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/cabecalho-model'
import { estadoDaPagina } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/estado-model'
import { createFmt } from '@/lib/youtube/observatorio/fmt'
import { createClock } from '@/lib/youtube/observatorio/time'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { canalWorld } from './canal-fixture'
import { acerto, AGORA, HOJE, m3a, m8, medidasFalsas, ritmo, videoLido } from './medidas-canal-fixture'

const F = createFmt(createClock(AGORA, AGORA - 90 * 86_400_000, AGORA), undefined)
const sync = { state: 'ok' as const, last: AGORA - 3_600_000, errorSince: null }
const FMT = { fmt: 'long' as const, doisFormatos: false, soShorts: false }

function entrada(o: Partial<EntradaDoCabecalho> = {}): EntradaDoCabecalho {
  const medidas = o.medidas === undefined ? medidasFalsas({}) : o.medidas
  return {
    F, subs: 84_000, medidas, formato: FMT,
    estado: estadoDaPagina(medidas?.m8 ?? null, sync, { missingSince: null, doisFormatos: false }, { collectionPausedAt: null, missingSince: null }, HOJE, AGORA),
    extras: { missingSince: null }, semVideos: false, hojeSP: HOJE, ...o,
  }
}
const por = (cs: ReturnType<typeof celulasDoCabecalho>, k: string) => cs.find(c => c.chave === k)!

describe('as seis células', () => {
  it('rótulos na ordem do mockup', () => {
    expect(celulasDoCabecalho(entrada()).map(c => c.rotulo)).toEqual(['Inscritos', 'Direção', 'Estado', 'Acerto', 'Ritmo', 'Criador responde'])
  })
  it('medidas não carregaram: Direção, Estado, Acerto e Ritmo dizem não carregou, Inscritos segue', () => {
    const cs = celulasDoCabecalho(entrada({ medidas: null }))
    for (const k of ['direcao', 'estado', 'acerto', 'ritmo']) expect(por(cs, k).valor, k).toBe('nao_carregou')
    expect(por(cs, 'inscritos').valor).toBe('medido')
  })
  it('inscritos ocultos: hachura com motivo, nunca 0', () => {
    const c = por(celulasDoCabecalho(entrada({ subs: null })), 'inscritos')
    expect(c.valor).toBe('nao_medido')
    expect(c.motivo).toMatch(/ocultos/)
    expect(JSON.stringify(c)).not.toMatch(/"texto":"0"/)
  })
  it('9,84 mi e 2,08 mi têm três algarismos', () => {
    const t = (n: number) => (por(celulasDoCabecalho(entrada({ subs: n })), 'inscritos').detalhe as { texto: string }).texto
    expect(t(9_840_000)).toBe('9,84 mi')
    expect(t(2_080_000)).toBe('2,08 mi')
  })
  it('menos de 5 vídeos, menos de 4 longos e canal sem longo: cada célula com o seu motivo', () => {
    const cs = celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m4: naoMedido('poucos_videos', { n: 3, minimo: 5 }), m6: naoMedido('poucas_publicacoes', { n: 2, minimo: 4 }) }) }))
    expect(por(cs, 'acerto').valor).toBe('nao_medido')
    expect(por(cs, 'acerto').motivo).toBeTruthy()
    expect(por(cs, 'ritmo').valor).toBe('nao_medido')
    expect(por(cs, 'ritmo').motivo).toBeTruthy()
  })
  it('canal em primeira busca: estado "Primeira busca", nunca "Ativo", e nenhum "0 de N"', () => {
    const medidas = medidasFalsas({ m4: naoMedido('poucos_videos', { n: 0, minimo: 5 }) })
    const estado = estadoDaPagina(medidas.m8, { state: 'backfill', last: null, errorSince: null }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    const cs = celulasDoCabecalho(entrada({ medidas, estado }))
    expect(estado.tipo).toBe('primeira_busca')
    expect(por(cs, 'estado').detalhe).toMatchObject({ estado: { pastilha: 'Primeira busca' } })
    expect(JSON.stringify(cs)).not.toMatch(/Ativo|0 de /)
  })
  it('Yannis I1: M8 não medido (sem base) é "não medido", nunca "não carregou"; erro do banco ou M8 ausente seguem "não carregou"', async () => {
    const { fraseDoTopo } = await import('@/app/cms/(authed)/youtube/competitors/_canal/medidas/frase-do-topo')
    const { celulaDeDirecao } = await import('@/app/cms/(authed)/youtube/competitors/_canais/direcao-model')
    const semBase = { ...m8('ativo'), estado: naoMedido('sem_publicacao') } as ReturnType<typeof m8>
    const medidas = medidasFalsas({ m8: semBase })
    const estado = estadoDaPagina(medidas.m8, sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(estado.tipo).toBe('nao_medido')
    const c = por(celulasDoCabecalho(entrada({ medidas, estado })), 'estado')
    expect(c.valor).toBe('nao_medido')
    expect(c.motivo?.trim().length ?? 0).toBeGreaterThan(0)
    const frase = fraseDoTopo({ estado, direcao: celulaDeDirecao(m3a(118, 100), null), formato: FMT, ritmo: null, acerto: null, parado: null, queda: null, ultimoVideo: { tipo: 'nenhum' }, hojeSP: HOJE } as unknown as Parameters<typeof fraseDoTopo>[0])
    expect(frase.texto).not.toMatch(/Não carregou/)
    const falhou = { ...m8('ativo'), estado: naoMedido('leitura_falhou') } as ReturnType<typeof m8>
    const e2 = estadoDaPagina(falhou, sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
    expect(e2.tipo).toBe('nao_carregou')
    expect(estadoDaPagina(null, sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA).tipo).toBe('nao_carregou')
  })
  it('sem o grupo C: Criador responde diz que a coleta não foi pedida, sem "ainda não começou" nem "parada"', () => {
    const c = por(celulasDoCabecalho(entrada()), 'criador')
    expect(c.valor).toBe('nao_medido')
    expect(c.motivo).toBe('não medido: a coleta de comentários não foi pedida')
    expect(JSON.stringify(c)).not.toMatch(/ainda não começou|parada/)
  })
  it('nenhuma célula não medida fica sem motivo (varredura)', () => {
    const casos = [
      entrada({ medidas: null }), entrada({ subs: null }),
      entrada({ medidas: medidasFalsas({ m3a: naoMedido('pouco_registro', { fechaEm: '2026-11-12', n: 26 }), m4: naoMedido('poucos_videos', { n: 2, minimo: 5 }), m6: naoMedido('ritmo_parcial') }) }),
      entrada({ medidas: medidasFalsas({ m4: naoMedido('leitura_falhou') }) }),
    ]
    for (const e of casos) for (const c of celulasDoCabecalho(e)) {
      if (c.valor === 'nao_medido' || c.valor === 'nao_carregou') expect(c.motivo?.trim().length ?? 0, `${c.chave}`).toBeGreaterThan(0)
    }
  })
})

describe('Direção e a ressalva da janela', () => {
  it('enquanto a janela cruza 24/08 a célula traz o aviso, e no dia seguinte ele some', () => {
    const cruza = { de: '2026-08-10', ate: '2026-09-07', dias: 28 }
    const limpa = { de: '2026-08-25', ate: '2026-09-22', dias: 28 }
    const a = por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m3a: m3a(118, 100, cruza) }) })), 'direcao')
    const b = por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m3a: m3a(118, 100, limpa) }) })), 'direcao')
    expect((a.detalhe as { avisoAte: string | null }).avisoAte).not.toBeNull()
    expect((b.detalhe as { avisoAte: string | null }).avisoAte).toBeNull()
  })
  it('+10% é subindo, +9% é "quase as mesmas", 0% é "as mesmas" (símbolo da célula)', () => {
    const sim = (r: number, a: number) => (por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m3a: m3a(r, a) }) })), 'direcao').detalhe as { direcao: { simbolo: string } }).direcao.simbolo
    expect(sim(110, 100)).toBe('sobe')
    expect(sim(109, 100)).toBe('estavel')
    expect(sim(100, 100)).toBe('estavel')
  })
})

describe('Acerto', () => {
  it('0 de 12: caixa vazada e "(0%)"; 0 de 8: sem percentual', () => {
    const z12 = por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m4: acerto(0, 12) }) })), 'acerto')
    expect(z12.valor).toBe('zero')
    expect(z12.detalhe).toMatchObject({ k: 0, n: 12, pct: 0 })
    const z8 = por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m4: acerto(0, 8) }) })), 'acerto')
    expect(z8.detalhe).toMatchObject({ k: 0, n: 8, pct: null })
  })
  it('8 vídeos em uma fileira; 9 em duas (5 e 4); 20 em duas de 10; 21 sem pontinhos', () => {
    expect(colunasDosPontinhos(8)).toEqual({ colunas: 8, soNumero: false })
    expect(colunasDosPontinhos(9)).toEqual({ colunas: 5, soNumero: false })
    expect(colunasDosPontinhos(20)).toEqual({ colunas: 10, soNumero: false })
    expect(colunasDosPontinhos(21)).toEqual({ colunas: 0, soNumero: true })
    const c = por(celulasDoCabecalho(entrada({ medidas: medidasFalsas({ m4: acerto(5, 21) }) })), 'acerto')
    expect(c.detalhe).toMatchObject({ pontos: [], soNumero: true })
  })
})

describe('Ritmo', () => {
  it('"com um longo em N de 13 semanas"; Short em canal só de Shorts; semanas sem leitura', () => {
    expect(por(celulasDoCabecalho(entrada()), 'ritmo').base).toBe('com um longo em 11 de 13 semanas')
    expect(por(celulasDoCabecalho(entrada({ formato: { fmt: 'short', doisFormatos: false, soShorts: true } })), 'ritmo').base).toBe('com um Short em 11 de 13 semanas')
    expect(por(celulasDoCabecalho(entrada({ semanasLidas: 11, medidas: medidasFalsas({ m6: ritmo(1, 10) }) })), 'ritmo').base).toBe('10 de 11 semanas com leitura')
  })
})

describe('formato do canal', () => {
  it('só Shorts, os dois ou só longos', () => {
    expect(formatoDoCanal([videoLido('a', { isShort: true })])).toMatchObject({ fmt: 'short', soShorts: true })
    expect(formatoDoCanal([videoLido('a'), videoLido('b', { isShort: true })])).toMatchObject({ fmt: 'long', doisFormatos: true })
    expect(formatoDoCanal([videoLido('a')])).toMatchObject({ fmt: 'long', doisFormatos: false })
  })
})

describe('Mais números', () => {
  it('traz os mesmos quatro valores do cabeçalho de hoje, com os motivos', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    const mais = maisNumeros(h)
    expect(mais.map(n => n.chave)).toEqual(['growth30', 'vpd', 'engajamento', 'medianaViews'])
    const cel = (k: string) => [...h.faixa, ...h.todos].find(c => c.key === k)!
    for (const n of mais) {
      expect(n.valor, n.chave).toBe(cel(n.chave).value)
      if (n.valor === null) expect(n.motivo, n.chave).toBe(cel(n.chave).missing)
      expect(n.base.trim().length).toBeGreaterThan(0)
    }
  })
  it('célula ausente vira "não carregou", nunca zero', () => {
    const mais = maisNumeros({ faixa: [], todos: [] })
    for (const n of mais) { expect(n.valor).toBeNull(); expect(n.motivo).toBe('não carregou') }
  })
})
void m8
