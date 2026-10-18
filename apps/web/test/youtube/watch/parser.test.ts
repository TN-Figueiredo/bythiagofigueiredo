// @vitest-environment node
// Parser da watch (A5 S4, Tarefa 4): A1 (fixtures reais) e A2 (sintéticas derivadas).
import { describe, it, expect } from 'vitest'
import { extrairDaWatch, normalizarIdioma, jsonApos } from '@/lib/youtube/watch/parser'
import { RENDERERS_TITULO } from '@/lib/youtube/teste-youtube'
import { contarPagina } from '@/app/api/cron/watch-pv/contar'
import {
  PAGINA_A, PAGINA_B, semInitialData, semYtcfg, comPlayability, comHL, rendererCom, layoutNovo, semVideoDetails,
  corpoConsentimento, corpoRoboSemTitulo, jogadorBloqueadoDoVercel, loginRequiredForaDoPlayability,
} from '../../fixtures/watch-html/derivar'

const TITULO_B = 'Consistência e Compromisso (Part 4)'
const ID = 'qIg9a7vqcNo'
const TITULO_A = '5 - Como somos controlados - Consistência e Compromisso (Part 4)'
const textos = (h: string): Array<string | null> => extrairDaWatch(h, ID).titulosExibidos.map((t) => t.texto)
const pvBloqueado = (h: string): boolean => contarPagina(h, 200, null, ID).jogadorBloqueado

describe('A1: fixtures reais', () => {
  it('página A: títulos, oficial, idioma, sqp', () => {
    const r = extrairDaWatch(PAGINA_A(), ID)
    expect(r.erro).toBeNull()
    expect(r.titulosExibidos.map((t) => t.renderer)).toEqual([...RENDERERS_TITULO])
    // Real: o videoTitleHeaderViewModel só aparece como nome numa lista na A, então só 2 renderers têm texto.
    expect(r.titulosExibidos.map((t) => t.texto)).toEqual([TITULO_A, TITULO_A, null])
    expect(r.tituloOficial).toBe(TITULO_A)
    expect(r.titulo_oficial_fonte).toBe('videoDetails')
    expect(r.tituloOficial).not.toMatch(/ - YouTube$/)
    expect(r.idioma).toBe('pt-BR')
    expect(r.rendicoesSqp).toBe(4)
    expect(r.jogadorBloqueado).toBe(false)
  })

  it('página B: exibidos mostram o B e o oficial continua A', () => {
    const r = extrairDaWatch(PAGINA_B(), ID)
    expect(r.erro).toBeNull()
    // Real: 2 renderers com o TITULO_B (o videoTitleHeaderViewModel não traz texto na página).
    expect(r.titulosExibidos.map((t) => t.texto)).toEqual([TITULO_B, TITULO_B, null])
    expect(r.tituloOficial).toBe(TITULO_A)
  })

  it('runs[] concatenados', () => {
    const r = extrairDaWatch(rendererCom(PAGINA_A(), ['5 - ', 'Como …']), ID)
    expect(r.titulosExibidos[0]?.texto).toBe('5 - Como …')
  })

  it('&amp; vira & (só no og:title)', () => {
    const h = semVideoDetails(PAGINA_A()).replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Tom &amp; Jerry">')
    const r = extrairDaWatch(h, ID)
    expect(r.tituloOficial).toBe('Tom & Jerry')
    expect(r.titulo_oficial_fonte).toBe('og_title')
  })

  it('sem videoDetails usa og:title', () => {
    const r = extrairDaWatch(semVideoDetails(PAGINA_A()), ID)
    expect(r.titulo_oficial_fonte).toBe('og_title')
    expect(r.tituloOficial).toBe(TITULO_A)
  })

  it('sqp de outro vídeo não conta', () => {
    const extra = '<script>var x="https://i.ytimg.com/vi/OUTRO1234567/hqdefault.jpg?sqp=-oaymwEZZZZ\\u0026rs=AO";</script>'
    expect(extrairDaWatch(PAGINA_A() + extra, ID).rendicoesSqp).toBe(4)
  })
})

describe('A2: sintéticas', () => {
  it('consentimento e robô sem título', () => {
    expect(extrairDaWatch(corpoConsentimento(), ID).erro).toBe('consentimento')
    expect(extrairDaWatch(corpoRoboSemTitulo(), ID).erro).toBe('verificacao_robo')
  })

  it('LOGIN_REQUIRED com renderers: erro null, títulos lidos, bloqueado', () => {
    const h = comPlayability(rendererCom(PAGINA_A(), TITULO_A), 'LOGIN_REQUIRED', 'Sign in to confirm you are not a bot')
    const r = extrairDaWatch(h, ID)
    expect(r.erro).toBeNull()
    expect(r.titulosExibidos[0]?.texto).toBe(TITULO_A)
    expect(r.jogadorBloqueado).toBe(true)
  })

  it('jogadorBloqueadoDoVercel (e com outro motivo): contrato do Vercel e mesmo booleano do contar.ts', () => {
    for (const motivo of [undefined, 'Este vídeo exige login por outro motivo']) {
      const h = jogadorBloqueadoDoVercel(PAGINA_A(), motivo)
      const r = extrairDaWatch(h, ID)
      expect(r.erro).toBeNull()
      expect(r.titulosExibidos.map((t) => t.texto)).toEqual([TITULO_A, TITULO_A, TITULO_A])
      expect(r.tituloOficial).toBeNull()
      expect(r.titulo_oficial_fonte).toBeNull()
      expect(r.jogadorBloqueado).toBe(true)
      expect(r.idioma).toBe('pt-BR')
      expect(pvBloqueado(h)).toBe(true)
    }
  })

  it('o contar.ts e o parser dão o mesmo booleano nas fixtures reais', () => {
    for (const h of [PAGINA_A(), PAGINA_B()]) expect(extrairDaWatch(h, ID).jogadorBloqueado).toBe(pvBloqueado(h))
  })

  it('LOGIN_REQUIRED fora do playabilityStatus: parser false (regra do spec), contar.ts true', () => {
    const h = loginRequiredForaDoPlayability(PAGINA_A())
    // A regra do spec (status do playability) é a escolhida; o contar.ts provisório usa indexOf no HTML todo.
    expect(extrairDaWatch(h, ID).jogadorBloqueado).toBe(false)
    expect(pvBloqueado(h)).toBe(true)
  })

  it('UNPLAYABLE sem renderers: indisponivel; sem initial data', () => {
    expect(extrairDaWatch(comPlayability(layoutNovo(PAGINA_A()), 'UNPLAYABLE'), ID).erro).toBe('indisponivel')
    expect(extrairDaWatch(semInitialData(PAGINA_A()), ID).erro).toBe('sem_initial_data')
  })

  it('idioma', () => {
    const idioma = (hl: string | null, gl: string | null): string | null => extrairDaWatch(comHL(PAGINA_A(), hl, gl), ID).idioma
    expect(idioma('es-419', 'BR')).toBe('es-419')
    expect(idioma('pt', 'BR')).toBe('pt-BR')
    expect(idioma('pt', null)).toBe('pt')
    expect(idioma('xx_YY', 'ZZ')).toBeNull()
    expect(extrairDaWatch(comHL(PAGINA_A(), 'xx_YY', 'ZZ'), ID).erro).toBe('sem_idioma')
    expect(extrairDaWatch(semYtcfg(PAGINA_A()), ID).erro).toBe('sem_idioma')
    expect(normalizarIdioma(null, 'BR')).toBeNull()
  })

  it('texto vazio ou só invisível vira null', () => {
    for (const v of [' ', ' ', '​', '﻿']) {
      expect(extrairDaWatch(rendererCom(PAGINA_A(), v), ID).titulosExibidos[0]?.texto).toBeNull()
    }
  })

  it('layout novo: erro null e 3 textos null', () => {
    const r = extrairDaWatch(layoutNovo(PAGINA_A()), ID)
    expect(r.erro).toBeNull()
    expect(textos(layoutNovo(PAGINA_A()))).toEqual([null, null, null])
  })

  it('erro ≠ null ⇒ títulos e oficial nulos (sempre 3 itens)', () => {
    for (const h of [corpoConsentimento(), corpoRoboSemTitulo(), semInitialData(PAGINA_A()), semYtcfg(PAGINA_A()), '']) {
      const r = extrairDaWatch(h, ID)
      expect(r.erro).not.toBeNull()
      expect(r.titulosExibidos).toHaveLength(3)
      expect(r.titulosExibidos.every((t) => t.texto === null)).toBe(true)
      expect(r.tituloOficial).toBeNull()
      expect(r.titulo_oficial_fonte).toBeNull()
    }
  })

  it('jsonApos respeita strings com chaves', () => {
    expect(jsonApos('x = {"a":"}{","b":{"c":1}};y', 'x = ')).toEqual({ a: '}{', b: { c: 1 } })
    expect(jsonApos('nada', 'x = ')).toBeNull()
  })

  it('HTML de 2 MB sem marcador termina em < 50 ms', () => {
    const grande = '<div>' + 'a"b{c '.repeat(350_000) + '</div>'
    const t0 = performance.now()
    const r = extrairDaWatch(grande, ID)
    expect(performance.now() - t0).toBeLessThan(50)
    expect(r.erro).toBe('sem_initial_data')
  })
})
