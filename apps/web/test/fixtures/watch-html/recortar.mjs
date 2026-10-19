// Recorta o HTML bruto de uma watch do YouTube: só ytInitialPlayerResponse, ytInitialData, o ytcfg.set com "HL"
// (sem os blocos gigantes) e a meta og:title. Troca visitorData/VISITOR_DATA/remoteHost e os pares
// {"key":"visitor_data"|"ipcc","value":…} por "X".
// Uso: node recortar.mjs <bruto.html> > fixture.html
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LIMITE_CHAVE_CFG = 2000 // chaves do ytcfg maiores que isso (player configs, experimentos) saem
const CHAVES_FORA_DO_DATA = ['topbar', 'engagementPanels', 'frameworkUpdates']

/** Devolve o texto do objeto JSON que começa em `ini` (uma `{`), respeitando strings e escapes. */
function objetoBalanceado(s, ini) {
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
      if (d === 0) return s.slice(ini, j + 1)
    }
  }
  return null
}

function aposMarcador(html, marcador) {
  const i = html.indexOf(marcador)
  if (i < 0) return null
  return objetoBalanceado(html, i + marcador.length)
}

export function mascarar(texto) {
  return texto
    .replace(/("(?:visitorData|VISITOR_DATA|remoteHost)"\s*:\s*)"[^"]*"/gi, '$1"X"')
    .replace(/(\\?"(?:visitorData|VISITOR_DATA|remoteHost)\\?"\s*:\s*\\?)"[^"\\]*/gi, '$1"X')
    // serviceTrackingParams: {"key":"visitor_data","value":"..."} (e ipcc, o país do IP)
    .replace(/("key"\s*:\s*"(?:visitor_data|ipcc|remote_host)"\s*,\s*"value"\s*:\s*)"[^"]*"/gi, '$1"X"')
}

function cfgComHL(html) {
  let pos = 0
  for (;;) {
    const i = html.indexOf('ytcfg.set({', pos)
    if (i < 0) return null
    const obj = objetoBalanceado(html, i + 'ytcfg.set('.length)
    pos = i + 1
    if (!obj || !obj.includes('"HL"')) continue
    try {
      const o = JSON.parse(obj)
      const enxuto = {}
      for (const [k, v] of Object.entries(o)) if (JSON.stringify(v).length <= LIMITE_CHAVE_CFG) enxuto[k] = v
      return JSON.stringify(enxuto)
    } catch {
      return null
    }
  }
}

function dataEnxuto(bruto) {
  try {
    const o = JSON.parse(bruto)
    for (const k of CHAVES_FORA_DO_DATA) delete o[k]
    return JSON.stringify(o)
  } catch {
    return bruto
  }
}

export function recortar(html) {
  const partes = []
  const og = html.match(/<meta property="og:title" content="[^"]*">/)
  if (og) partes.push(og[0])
  const cfg = cfgComHL(html)
  if (cfg) partes.push(`<script>ytcfg.set(${cfg});</script>`)
  const player = aposMarcador(html, 'var ytInitialPlayerResponse = ')
  if (player) partes.push(`<script>var ytInitialPlayerResponse = ${player};</script>`)
  const data = aposMarcador(html, 'var ytInitialData = ')
  if (data) partes.push(`<script>var ytInitialData = ${dataEnxuto(data)};</script>`)
  return mascarar(`<!DOCTYPE html><html><head>\n${partes.join('\n')}\n</head><body></body></html>\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2]) {
  process.stdout.write(recortar(readFileSync(process.argv[2], 'utf8')))
}
