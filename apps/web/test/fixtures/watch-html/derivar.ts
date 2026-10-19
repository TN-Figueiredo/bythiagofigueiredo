// Deriva as páginas sintéticas do A2 a partir da página A real (watch-185033-1.html). Tudo puro: recebe o HTML, devolve HTML.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = { [k: string]: Json }

const DIR = __dirname
export const PAGINA_A = (): string => readFileSync(join(DIR, 'watch-185033-1.html'), 'utf8')
export const PAGINA_B = (): string => readFileSync(join(DIR, 'watch-185036-2.html'), 'utf8')

const MARCADOR_PLAYER = 'var ytInitialPlayerResponse = '
const MARCADOR_DATA = 'var ytInitialData = '
const MARCADOR_CFG = 'ytcfg.set('

function ehObj(v: Json | undefined): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Fim (exclusivo) do objeto JSON que começa em `ini`, respeitando strings e escapes. */
function fimDoObjeto(s: string, ini: number): number {
  let d = 0
  let emString = false
  let esc = false
  for (let j = ini; j < s.length; j++) {
    const c = s[j]
    if (emString) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') emString = false
    } else if (c === '"') emString = true
    else if (c === '{') d++
    else if (c === '}') {
      d--
      if (d === 0) return j + 1
    }
  }
  return -1
}

/** Aplica `fn` ao JSON do bloco que segue `marcador`; devolve o HTML com o bloco reescrito. */
function mutarBloco(html: string, marcador: string, fn: (o: Obj) => void): string {
  const i = html.indexOf(marcador)
  if (i < 0) throw new Error(`marcador ausente: ${marcador}`)
  const ini = i + marcador.length
  const fim = fimDoObjeto(html, ini)
  if (fim < 0) throw new Error(`bloco sem fim: ${marcador}`)
  const o = JSON.parse(html.slice(ini, fim)) as Json
  if (!ehObj(o)) throw new Error('bloco não é objeto')
  fn(o)
  return html.slice(0, ini) + JSON.stringify(o) + html.slice(fim)
}

/** Remove o `<script>…</script>` inteiro que contém `marcador`. */
function semScriptCom(html: string, marcador: string): string {
  const i = html.indexOf(marcador)
  if (i < 0) return html
  const ini = html.lastIndexOf('<script', i)
  const fimTag = html.indexOf('</script>', i)
  if (ini < 0 || fimTag < 0) return html
  return html.slice(0, ini) + html.slice(fimTag + '</script>'.length)
}

function percorrer(v: Json, visita: (o: Obj, pai: Json[] | null) => void, pai: Json[] | null = null): void {
  if (Array.isArray(v)) {
    for (const x of v) percorrer(x, visita, v)
  } else if (ehObj(v)) {
    visita(v, pai)
    for (const x of Object.values(v)) percorrer(x, visita, null)
  }
}

const TITULO_NO_HTML = /<meta property="og:title" content="[^"]*">/

function tituloOficialDe(html: string): string {
  const m = html.match(/"videoDetails":\{"videoId":"[^"]+","title":"((?:[^"\\]|\\.)*)"/)
  if (!m) throw new Error('página sem videoDetails.title')
  return JSON.parse(`"${m[1]}"`) as string
}

export function semInitialData(html: string): string {
  return semScriptCom(html, MARCADOR_DATA)
}

export function semYtcfg(html: string): string {
  return semScriptCom(html, MARCADOR_CFG)
}

export function comPlayability(html: string, status: string, motivo?: string): string {
  return mutarBloco(html, MARCADOR_PLAYER, (o) => {
    const novo: Obj = { status }
    if (motivo !== undefined) novo.reason = motivo
    o.playabilityStatus = novo
  })
}

export function comHL(html: string, hl: string | null, gl: string | null): string {
  return mutarBloco(html, MARCADOR_CFG, (o) => {
    if (hl === null) delete o.HL
    else o.HL = hl
    if (gl === null) delete o.GL
    else o.GL = gl
  })
}

const NOMES_RENDERER = ['videoPrimaryInfoRenderer', 'playerOverlayVideoDetailsRenderer', 'videoTitleHeaderViewModel'] as const
export type NomeRenderer = (typeof NOMES_RENDERER)[number]

function escreverTitulo(alvo: Obj, nome: NomeRenderer, partes: string[]): void {
  if (nome === 'videoPrimaryInfoRenderer') alvo.title = { runs: partes.map((text) => ({ text })) }
  else if (nome === 'playerOverlayVideoDetailsRenderer') alvo.title = { simpleText: partes.join('') }
  else alvo.videoTitle = { content: partes.join('') }
}

/** Põe `texto` (ou os `runs`, se for lista) como título do renderer; cria o `videoTitleHeaderViewModel` se a página não o tiver. */
export function rendererCom(html: string, texto: string | string[], renderer: NomeRenderer = 'videoPrimaryInfoRenderer'): string {
  const partes = Array.isArray(texto) ? texto : [texto]
  return mutarBloco(html, MARCADOR_DATA, (data) => {
    let achou = false
    let irmaos: Json[] | null = null
    percorrer(data, (o, pai) => {
      const alvo = o[renderer]
      if (ehObj(alvo)) {
        escreverTitulo(alvo, renderer, partes)
        achou = true
      }
      if (irmaos === null && pai !== null && o.videoPrimaryInfoRenderer !== undefined) irmaos = pai
    })
    if (!achou) {
      if (irmaos === null) throw new Error('sem onde inserir o renderer')
      const novo: Obj = {}
      escreverTitulo(novo, renderer, partes)
      ;(irmaos as Json[]).push({ [renderer]: novo })
    }
  })
}

/** Com os 3 renderers de título presentes e legíveis (a página real A só traz 2 com texto). */
function comOsTresRenderers(html: string): string {
  const titulo = tituloOficialDe(html)
  let r = html
  for (const nome of NOMES_RENDERER) r = rendererCom(r, titulo, nome)
  return r
}

/** Layout novo: os 3 renderers de título somem (renomeados), o resto da página fica. */
export function layoutNovo(html: string): string {
  return NOMES_RENDERER.reduce((r, nome) => r.split(`"${nome}"`).join(`"${nome}Novo"`), html)
}

export function semVideoDetails(html: string): string {
  return mutarBloco(html, MARCADOR_PLAYER, (o) => {
    delete o.videoDetails
  })
}

export function corpoConsentimento(): string {
  return '<!DOCTYPE html><html><head><title>Before you continue to YouTube</title></head><body>'
    + '<form action="https://consent.youtube.com/save" method="POST"><button>Accept all</button></form></body></html>\n'
}

export function corpoRoboSemTitulo(): string {
  return '<!DOCTYPE html><html><head><title>YouTube</title></head><body>'
    + '<div>Confirm you are not a bot</div><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED",'
    + '"reason":"Sign in to confirm you are not a bot"}};</script></body></html>\n'
}

/**
 * Formato medido no P-V no Vercel (r3): LOGIN_REQUIRED, os 3 renderers de título presentes e legíveis,
 * sem `videoDetails` e sem a meta `og:title`.
 */
export function jogadorBloqueadoDoVercel(html: string, motivo = 'Sign in to confirm you are not a bot'): string {
  const base = comOsTresRenderers(html).replace(TITULO_NO_HTML, '')
  return semVideoDetails(comPlayability(base, 'LOGIN_REQUIRED', motivo))
}

/**
 * Ressalva do Yannis (r3b): `playabilityStatus.status` é OK, mas a string "LOGIN_REQUIRED" aparece em outro ponto do JSON.
 * Regra escolhida: o parser segue o spec (status do playability => jogadorBloqueado false); o contar.ts do P-V
 * (indexOf no HTML todo, rota provisória) dá true. A divergência é conhecida e o teste a afirma.
 */
export function loginRequiredForaDoPlayability(html: string): string {
  const ok = comPlayability(html, 'OK')
  return mutarBloco(ok, MARCADOR_PLAYER, (o) => {
    o.logTelemetria = { estado: 'LOGIN_REQUIRED' }
  })
}
