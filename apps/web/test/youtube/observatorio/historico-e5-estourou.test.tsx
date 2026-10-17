// @vitest-environment node
// apps/web/test/youtube/observatorio/historico-e5-estourou.test.tsx
// A5 · E5a, Tarefa 10a: o bloco "Estourou e parou" no Histórico do vídeo (desenho, texto obrigatório, leitura do servidor).
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { EstourouCarregando, EstourouEParou } from '@/app/cms/(authed)/youtube/competitors/_historico/estourou-e-parou'
import { leituraSemConsulta, lerLeituraDoVideo, lerLeituraDoConjunto, type IObservatorioDaLeitura } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-leitura'
import { leituraDoVideo, type Leitura } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-model'
import { TEXTO_M10 } from '@/lib/youtube/observatorio/medidas-telas/texto-m10'
import { picoSemCauda, type EntradaPico } from '@/lib/youtube/observatorio/medidas/pico'
import { estourouExisteEm, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { MedidasDoVideo } from '@/lib/youtube/observatorio/medidas/do-canal'

const COMP = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const HOJE = somaDias(estourouExisteEm(), 30)
const AGORA = Date.parse(HOJE + 'T15:00:00Z')
const J = { de: null, ate: null, dias: null }
const v30 = (views: number): Medida<ValorM1> => medido({ views, gapHoras: 0, fonte: 'marca' as const }, 1, J)
const VIDEO = { idadeDias: 120, canal: 'Leo' }
const entrada = (over: Partial<EntradaPico> = {}, canal: Partial<EntradaPico['canal']> = {}): EntradaPico => ({
  wasLive: false, idadeDias: 120, v30: 2000, cauda: 0.2, aindaRende: 0.02, reacao: { taxa: 0.01, componente: 'os_dois' },
  canal: { nElegiveis: 5, medianaV30: 1000, medianaCauda: 0.4, medianaReacao: 0.02, ...canal }, ...over,
})
const leitura = (e: EntradaPico): Leitura => leituraDoVideo(picoSemCauda(e), v30(e.v30 ?? 0), HOJE, VIDEO)
const html = (l: Leitura) => renderToStaticMarkup(<EstourouEParou leitura={l} />)
const texto = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

describe('o bloco, em cada estado', () => {
  it('três condições: o texto obrigatório aparece com as três frases inteiras, abaixo da frase-resumo e antes dos cartões', () => {
    const h = html(leitura(entrada()))
    const t = texto(h)
    for (const f of [TEXTO_M10.titulo, TEXTO_M10.oQueVimos, TEXTO_M10.hipoteseNossa, TEXTO_M10.oQueNinguemDeForaVe]) expect(t).toContain(f)
    expect(h.indexOf('Os 3 sinais batem')).toBeLessThan(h.indexOf('lm-txt'))
    expect(h.indexOf('lm-txt')).toBeLessThan(h.indexOf('lm-cards'))
    expect(h).toContain('indício')
    expect(h).toContain('Estourou e parou')
  })
  it('duas de três: "não é o caso", os três cartões com os números e nenhum texto obrigatório', () => {
    const h = html(leitura(entrada({ v30: 1990 })))
    const t = texto(h)
    expect(t).toContain('não é o caso')
    expect(t).not.toContain(TEXTO_M10.oQueVimos)
    expect(t).not.toContain('Indício, não medição')
    expect((h.match(/class="lm-c"/g) ?? []).length).toBe(3)
    expect(h).toContain('Leitura:')
  })
  it('as frases dos cartões são as do NOTAS', () => {
    const t = texto(html(leitura(entrada())))
    for (const f of ['Muitas views cedo', 'views nos 30 primeiros dias', 'Bate se tiver 2.000 views ou mais (2× o normal).', 'Quase nada depois', 'das views vieram depois do dia 30', 'E ainda rende pouco', 'Bate se for até 2% das views dos 30 primeiros dias.', 'Pouca reação do público', 'curtidas e comentários por view, aos 30 dias', 'Igual ao limite: bate.']) {
      expect(t, f).toContain(f)
    }
  })
  it('nenhuma cor de direção nem de erro nos cartões, e nenhum percentual de chance, nota ou "veredito" no HTML', () => {
    for (const l of [leitura(entrada()), leitura(entrada({ v30: 1990 }))]) {
      const h = html(l)
      expect(h).not.toMatch(/--dir-|--danger|dir-up|dir-dn|sobe|desce/)
      expect(h.toLowerCase()).not.toMatch(/veredito|retenção/)
    }
  })
  it('cada cartão traz a régua com texto por extenso e o texto das casas por extenso', () => {
    const h = html(leitura(entrada()))
    expect(h).toContain('aria-label="Três sinais: muitas views cedo bate; quase nada depois bate; pouca reação bate"')
    expect((h.match(/aria-label="Régua\. Este vídeo:/g) ?? []).length).toBe(4)
  })
  it('antes da data: uma linha só, sem casas, sem régua, sem selo "indício"; a data é a deste vídeo', () => {
    const hoje = somaDias(estourouExisteEm(), -10)
    const l = leituraDoVideo(null, null, hoje, VIDEO)
    const h = html(l)
    expect(h).toContain('lm-sd')
    expect(h).not.toContain('lm-tl')
    expect(h).not.toContain('lm-cs')
    expect(h).not.toContain('lm-ind')
    expect(h).toContain('ainda não medido')
    expect(texto(h)).toContain('Ainda sem leitura.')
    expect(texto(h)).not.toContain(TEXTO_M10.oQueVimos)
    // a data vem da mesma conta do "fecha em" do bloco de cima: hoje + os dias que faltam a ESTE vídeo
    const d = somaDias(hoje, Math.max(0, 90 - VIDEO.idadeDias))
    expect(texto(h)).toContain(`faz 90 dias em ${d.slice(8, 10)}/${d.slice(5, 7)}`)
    expect(texto(h)).not.toContain('nenhum vídeo')
  })
  it('medida que não veio: forma de erro e "Isto não quer dizer que o vídeo não estourou"', () => {
    const h = html(leituraDoVideo(null, null, HOJE, VIDEO))
    expect(h).toContain('role="alert"')
    expect(texto(h)).toContain('Isto não quer dizer que o vídeo não estourou')
    expect(texto(h.replace(/<details.*<\/details>/s, ''))).not.toContain('não é o caso')
    expect(h).not.toContain('lm-cards')
  })
  it('sem reação pública: três casas em hachura, os cartões não são desenhados, e a condição para passar a existir', () => {
    const h = html(leitura(entrada({ reacao: null })))
    expect(h).toContain('lm-cs m')
    expect(h).not.toContain('lm-cs n')
    expect(h).not.toContain('lm-cards')
    expect(texto(h)).toContain('Curtidas ocultas e comentários desligados: nenhum número de reação, nem zero.')
    expect(texto(h)).toContain('Passa a existir: se o canal mostrar as curtidas ou ligar os comentários.')
  })
  it('menos de 1.000 views: a barra "640 de 1.000" e "nunca para este vídeo"', () => {
    const h = html(leitura(entrada({ v30: 640 })))
    expect(texto(h)).toContain('640 de 1.000')
    expect(texto(h)).toContain('Passa a existir: nunca para este vídeo (a medida dos 30 primeiros dias não muda).')
  })
  it('só um motivo na tela (os outros não aparecem)', () => {
    // 640 views, canal com 3 e vídeo de 61 dias: três motivos possíveis, um só na tela, na ordem do NOTAS (30 dias, depois views, depois canal, depois idade)
    const l = leituraDoVideo(picoSemCauda(entrada({ v30: 640, idadeDias: 61 }, { nElegiveis: 3 })), v30(640), HOJE, { idadeDias: 61, canal: 'Leo' })
    const t = texto(html(l).replace(/<details.*<\/details>/s, ''))
    expect(t).toContain('o vídeo teve menos de 1.000 views')
    expect(t).not.toContain('o canal tem menos de 5')
    expect(t).not.toContain('ainda não tem 90 dias')
  })
  it('a pastilha "indício" acompanha o nome em todos os estados', () => {
    for (const l of [leitura(entrada()), leitura(entrada({ v30: 1990 })), leitura(entrada({ v30: 640 })), leituraDoVideo(null, null, HOJE, VIDEO)]) {
      expect(html(l), l.tipo).toContain('lm-ind')
    }
    // sem leitura, o selo de grau de certeza sai e entra o "ainda não medido"
    const ainda = html(leituraDoVideo(null, null, somaDias(estourouExisteEm(), -1), VIDEO))
    expect(ainda).not.toContain('lm-ind')
    expect(ainda).toContain('obs-ch-nm')
    expect(renderToStaticMarkup(<EstourouCarregando />)).toContain('lm-ind')
  })
  it('carregando: role=status com aria-busy', () => {
    expect(renderToStaticMarkup(<EstourouCarregando />)).toMatch(/role="status" aria-busy="true"/)
  })
  it('ao vivo: o chip "ao vivo ou estreia" e "nunca para este vídeo"', () => {
    const h = html(leituraDoVideo(naoMedido('ao_vivo_ou_estreia'), null, HOJE, VIDEO))
    expect(texto(h)).toContain('ao vivo ou estreia')
    expect(texto(h)).toContain('Ao vivo e estreia ficam de fora.')
  })
})

describe('arquivos novos', () => {
  const ler = (p: string) => fs.readFileSync(path.join(COMP, p), 'utf8')
  it('historico.css não tem color-mix nem z-index numérico novo no bloco', () => {
    const css = ler('_historico/historico.css')
    const bloco = css.slice(css.indexOf('prefixo lm-'))
    expect(bloco).not.toMatch(/color-mix|z-index/)
  })
  it('nenhum next/link nem componente passa como prop para componente cliente', () => {
    for (const f of ['_historico/estourou-e-parou.tsx', '_chrome/medidas/estourou-casas.tsx', '_chrome/medidas/texto-indicio.tsx', '_chrome/medidas/estourou-leitura.ts']) {
      expect(ler(f), f).not.toMatch(/next\/link/)
    }
    expect(ler('video/[id]/page.tsx')).toMatch(/estourou=\{estourou\}/)
  })
  it('a página: antes da data o bloco sai pronto (sem consulta); depois dela, vai como "ler" e sai do MESMO conjunto do canal (nenhuma leitura própria da página)', () => {
    const pagina = ler('video/[id]/page.tsx')
    expect(pagina).toMatch(/leituraSemConsulta\(obs, view\.video\.id/)
    expect(pagina).toMatch(/sincrona === 'ler' \? 'ler'/)
    expect(pagina).not.toContain('lerLeituraDoVideo')
    expect(pagina).not.toContain('carregarMedidasDoSite')
    expect(ler('_historico/medidas/blocos-do-video.tsx')).toContain('lerLeituraDoConjunto')
  })
  it('o bloco de CSS usa media query, não container query (o teste da Fase 4 exige todo seletor dentro da tela)', () => {
    const css = ler('_historico/historico.css')
    expect(css.slice(css.indexOf('prefixo lm-'))).not.toContain('@container')
  })
  it('a legenda não usa a classe .mk da linha do tempo do gráfico, que é um botão absoluto de 32 px (G-5)', () => {
    const h = html(leitura(entrada()))
    expect(h).toContain('class="g pto"')
    expect(h).not.toMatch(/class="g mk"/)
  })
  it('o estado "não carregou" traz o botão "Tentar de novo" (G-3)', () => {
    const h = html({ tipo: 'nao_carregou' })
    expect(texto(h)).toContain('Tentar de novo')
    expect(h).toMatch(/<a class="btn" href="">Tentar de novo<\/a>/)
  })
  it('a tela de histórico só desenha o bloco num bloco isolado e com a marca', () => {
    expect(ler('_historico/historico-screen.tsx')).toContain('bloco: estourou-e-parou')
  })
})

// ───── a leitura do servidor ─────

const m1Ok = v30(2000)
function videoMedido(over: Partial<MedidasDoVideo> = {}): MedidasDoVideo {
  return {
    formato: 'long', m1: { 1: m1Ok, 7: m1Ok, 30: m1Ok }, m5: naoMedido('serie_nao_pedida'), m7: naoMedido('sem_reacao_publica'),
    m9: { cauda: medido(0.2, 1, J), aindaRende: medido(0.02, 1, J) }, m10: picoSemCauda(entrada()), m12: { 7: naoMedido('serie_nao_pedida'), 30: naoMedido('serie_nao_pedida') }, ...over,
  } as MedidasDoVideo
}
const siteCom = (mv: MedidasDoVideo | null, canal = 'c1'): MedidasDoSite => ({
  porCanal: new Map([[canal, mv === null ? { naoCarregou: 'erro_do_banco' as const } : { porVideo: new Map([['v1', mv]]) } as unknown as NonNullable<MedidasDoSite['porCanal'] extends Map<string, infer T> ? T : never>]]),
  extras: { lido: true, dados: new Map() }, falhas: [], esgotou: 0,
})
function obsDe(over: { ageDays?: number; own?: boolean; semVideo?: boolean } = {}): IObservatorioDaLeitura {
  return {
    channels: [{ id: 'c1', own: over.own ?? false, sync: { last: AGORA } }],
    video: (id: string) => (id === 'v1' && !over.semVideo ? { id: 'v1', ch: 'c1', ageDays: over.ageDays ?? 120 } : undefined),
    channel: (id: string) => (id === 'c1' ? { id: 'c1', name: 'Leo', own: over.own ?? false } : undefined),
  } as unknown as IObservatorioDaLeitura
}
const sb = {} as SupabaseClient
const pedir = (obs: IObservatorioDaLeitura, carregar: ReturnType<typeof vi.fn>, now = AGORA) =>
  lerLeituraDoVideo({ sb, siteId: 's1', obs, videoId: 'v1', now, carregar: carregar as never })

describe('lerLeituraDoVideo', () => {
  it('antes da data nada é pedido: zero consultas', async () => {
    const carregar = vi.fn()
    const l = await pedir(obsDe(), carregar, Date.parse(somaDias(estourouExisteEm(), -3) + 'T15:00:00Z'))
    expect(l?.tipo).toBe('ainda_nao_existe')
    expect(carregar).not.toHaveBeenCalled()
  })
  it('vídeo de outro site na URL: nenhuma consulta de série e nenhuma medida (prova por mutação: sem o cruzamento o teste falha)', async () => {
    const carregar = vi.fn()
    expect(await pedir(obsDe({ semVideo: true }), carregar)).toBeNull()
    expect(carregar).not.toHaveBeenCalled()
  })
  it('canal próprio: nenhuma medida de concorrente é lida', async () => {
    const carregar = vi.fn()
    expect(await pedir(obsDe({ own: true }), carregar)).toBeNull()
    expect(carregar).not.toHaveBeenCalled()
  })
  it('vídeo de 90 dias ou mais: UMA chamada ao motor, com a série só deste vídeo (M-1)', async () => {
    const carregar = vi.fn().mockResolvedValue(siteCom(videoMedido()))
    const l = await pedir(obsDe(), carregar)
    expect(l?.tipo).toBe('estourou_e_parou')
    expect(carregar).toHaveBeenCalledTimes(1)
    expect([...carregar.mock.calls[0]![1].seriesDe.entries()]).toEqual([['c1', ['v1']]])
  })
  it('vídeo com menos de 90 dias: UMA chamada, sem série (M-1)', async () => {
    const carregar = vi.fn().mockResolvedValue(siteCom(videoMedido()))
    await pedir(obsDe({ ageDays: 61 }), carregar)
    expect(carregar).toHaveBeenCalledTimes(1)
    expect(carregar.mock.calls[0]![1].seriesDe).toBeUndefined()
  })
  it('série não pedida depois da data e que continua sem leitura: não carregou, nunca "não é o caso"', async () => {
    const falhou = videoMedido({ m10: naoMedido('serie_nao_pedida'), m9: { cauda: medido(0.2, 1, J), aindaRende: naoMedido('leitura_falhou') } })
    const carregar = vi.fn().mockResolvedValue(siteCom(falhou))
    expect((await pedir(obsDe(), carregar))?.tipo).toBe('nao_carregou')
  })
  it.each(['leitura_falhou', 'calculo_falhou'] as const)('série pedida e não lida (serie_diaria_incompleta e aindaRende %s): não carregou, nunca não medido (I-1)', async (motivo) => {
    const carregar = vi.fn()
      .mockResolvedValueOnce(siteCom(videoMedido({ m10: naoMedido('serie_diaria_incompleta'), m9: { cauda: medido(0.2, 1, J), aindaRende: naoMedido(motivo) } })))
    expect((await pedir(obsDe(), carregar))?.tipo).toBe('nao_carregou')
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('série do vídeo não lida'), expect.objectContaining({ fingerprint: ['medidas-telas', 'estourou-serie', motivo] }))
  })
  it('"sem reação pública" com a reação (M7) que falhou ao calcular: não carregou, nunca "curtidas ocultas" (M-2)', async () => {
    const carregar = vi.fn().mockResolvedValue(siteCom(videoMedido({ m10: naoMedido('sem_reacao_publica'), m7: naoMedido('calculo_falhou') })))
    expect((await pedir(obsDe(), carregar))?.tipo).toBe('nao_carregou')
    const ocultas = vi.fn().mockResolvedValue(siteCom(videoMedido({ m10: naoMedido('sem_reacao_publica'), m7: naoMedido('sem_reacao_publica') })))
    expect(await pedir(obsDe(), ocultas)).toMatchObject({ tipo: 'nao_medido', motivo: 'sem_reacao_publica' })
  })
  it('canal que não carregou, vídeo ausente do canal e carregador que lança: não carregou, sem lançar', async () => {
    expect((await pedir(obsDe(), vi.fn().mockResolvedValue(siteCom(null))))?.tipo).toBe('nao_carregou')
    expect((await pedir(obsDe(), vi.fn().mockResolvedValue(siteCom(videoMedido(), 'outro'))))?.tipo).toBe('nao_carregou')
    expect((await pedir(obsDe(), vi.fn().mockRejectedValue(new Error('banco'))))?.tipo).toBe('nao_carregou')
  })
  it('vídeo com menos de 90 dias: a idade vem do conjunto, e a série não é pedida', async () => {
    const carregar = vi.fn().mockResolvedValue(siteCom(videoMedido({ m10: naoMedido('idade_menor_que_90'), m1: { 1: m1Ok, 7: m1Ok, 30: naoMedido('fecha_em') } })))
    const l = await pedir(obsDe({ ageDays: 61 }), carregar)
    expect(l).toMatchObject({ tipo: 'nao_medido', motivo: 'menos_de_90_dias' })
    expect(carregar).toHaveBeenCalledTimes(1)
  })
})

const conjuntoCom = (mv: MedidasDoVideo | null, serie: Map<string, never[]> | null = new Map()) => ({
  medidas: mv === null ? { naoCarregou: 'erro_do_banco' } : { porVideo: new Map([['v1', mv]]) },
  serie: serie === null ? { lido: false, causa: 'erro_do_banco' } : { lido: true, dados: serie },
}) as unknown as Parameters<typeof lerLeituraDoConjunto>[0]['c']
const doConjunto = (c: Parameters<typeof lerLeituraDoConjunto>[0]['c'], carregar: ReturnType<typeof vi.fn>, obs = obsDe(), now = AGORA) =>
  lerLeituraDoConjunto({ c, sb, siteId: 's1', obs, videoId: 'v1', now, carregar: carregar as never })

describe('lerLeituraDoConjunto (plano E5a §4.8: uma leitura da base do canal por visita)', () => {
  it('a medida já está no conjunto: nenhuma leitura da base do canal (carregarMedidasDoSite não é chamado)', async () => {
    const carregar = vi.fn()
    const l = await doConjunto(conjuntoCom(videoMedido()), carregar)
    expect(l?.tipo).toBe('estourou_e_parou')
    expect(carregar).not.toHaveBeenCalled()
  })
  it('Estourou sai do mesmo conjunto: o m10 do conjunto aparece no bloco', async () => {
    const carregar = vi.fn()
    expect(await doConjunto(conjuntoCom(videoMedido()), carregar)).toEqual(await pedir(obsDe(), vi.fn().mockResolvedValue(siteCom(videoMedido()))))
  })
  it('vídeo fora da série do conjunto (180 dias) e a medida pede a série dele: cai na leitura própria, uma chamada que já pede a série dele', async () => {
    const carregar = vi.fn().mockResolvedValueOnce(siteCom(videoMedido()))
    const l = await doConjunto(conjuntoCom(videoMedido({ m10: naoMedido('serie_diaria_incompleta') })), carregar)
    expect(l?.tipo).toBe('estourou_e_parou')
    expect(carregar).toHaveBeenCalledTimes(1)
    expect(carregar.mock.calls[0][1].seriesDe).toBeInstanceOf(Map)
  })
  it('série incompleta de verdade (o vídeo está na série do conjunto): não relê a base', async () => {
    const carregar = vi.fn()
    const l = await doConjunto(conjuntoCom(videoMedido({ m10: naoMedido('serie_diaria_incompleta') }), new Map([['v1', []]])), carregar)
    expect(l).not.toBeNull()
    expect(carregar).not.toHaveBeenCalled()
  })
  it('série do conjunto que falhou: não carregou, nunca "não é o caso"', async () => {
    const falhou = videoMedido({ m10: naoMedido('leitura_falhou'), m9: { cauda: medido(0.2, 1, J), aindaRende: naoMedido('leitura_falhou') } })
    expect((await doConjunto(conjuntoCom(falhou, null), vi.fn()))?.tipo).toBe('nao_carregou')
  })
  it('antes da data, outro site e canal próprio: nada é lido', async () => {
    const carregar = vi.fn()
    expect((await doConjunto(conjuntoCom(videoMedido()), carregar, obsDe(), Date.parse(somaDias(estourouExisteEm(), -3) + 'T15:00:00Z')))?.tipo).toBe('ainda_nao_existe')
    expect(await doConjunto(conjuntoCom(videoMedido()), carregar, obsDe({ semVideo: true }))).toBeNull()
    expect(await doConjunto(conjuntoCom(videoMedido()), carregar, obsDe({ own: true }))).toBeNull()
    expect(carregar).not.toHaveBeenCalled()
  })
})

describe('leituraSemConsulta', () => {
  it('antes da data: a leitura sai pronta; depois: "ler"; vídeo fora do site ou de canal próprio: nulo', () => {
    expect(leituraSemConsulta(obsDe(), 'v1', Date.parse(somaDias(estourouExisteEm(), -1) + 'T15:00:00Z'))).toMatchObject({ tipo: 'ainda_nao_existe' })
    expect(leituraSemConsulta(obsDe(), 'v1', AGORA)).toBe('ler')
    expect(leituraSemConsulta(obsDe({ semVideo: true }), 'v1', AGORA)).toBeNull()
    expect(leituraSemConsulta(obsDe({ own: true }), 'v1', AGORA)).toBeNull()
  })
})
