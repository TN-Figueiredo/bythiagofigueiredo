// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recortar } from '../../fixtures/watch-html/recortar.mjs'
import {
  PAGINA_A, PAGINA_B, comPlayability, jogadorBloqueadoDoVercel, layoutNovo, loginRequiredForaDoPlayability,
  rendererCom, semInitialData, semVideoDetails,
} from '../../fixtures/watch-html/derivar'
import { contarPagina } from '../../fixtures/watch-html/contar-pv'

const DIR = process.env.WATCH_FIXTURES_DIR ?? join(__dirname, '../../fixtures/watch-html')
const VISITOR = /visitor_?data\\?"\s*:\s*\\?"(?!X\b)/i
const REMOTE = /"remoteHost"\s*:\s*"(?!X")/i
const PAR_CHAVE_VALOR = /"key"\s*:\s*"(?:visitor_data|ipcc|remote_host)"\s*,\s*"value"\s*:\s*"(?!X")/i
const IPV6 = /[0-9a-f]{1,4}(:[0-9a-f]{0,4}){5,7}|::[0-9a-f]{1,4}/i
const IPV4_NO_REMOTE = /"remoteHost"\s*:\s*"\d{1,3}(\.\d{1,3}){3}/
// Exceções: nenhuma por ora (o varredor passa sem lista).
const EXCECOES_IPV6: RegExp[] = []

function htmls(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.html')).map((f) => join(DIR, f))
}

describe('fixtures da watch sem IP', () => {
  it('há pelo menos 2 fixtures no diretório varrido', () => {
    expect(htmls().length).toBeGreaterThanOrEqual(2)
  })

  it('nenhuma fixture em watch-html tem visitorData, remoteHost ou IP', () => {
    for (const f of htmls()) {
      const t = readFileSync(f, 'utf8')
      expect(VISITOR.test(t), `${f}: visitorData`).toBe(false)
      expect(REMOTE.test(t), `${f}: remoteHost`).toBe(false)
      expect(PAR_CHAVE_VALOR.test(t), `${f}: {key: visitor_data|ipcc}`).toBe(false)
      expect(IPV4_NO_REMOTE.test(t), `${f}: IPv4`).toBe(false)
      const m = t.match(new RegExp(IPV6.source, 'gi')) ?? []
      const sobra = m.filter((x) => !EXCECOES_IPV6.some((e) => e.test(x)))
      expect(sobra, `${f}: IPv6`).toEqual([])
    }
  })

  it('as fixtures têm menos de 400 KB', () => {
    for (const f of htmls()) expect(readFileSync(f).length).toBeLessThan(400 * 1024)
  })

  it('o recortador tira o IP de uma página bruta', () => {
    const bruto = '<html><script>var ytInitialPlayerResponse = {"a":1};</script><script>ytcfg.set({"HL":"pt","GL":"BR",'
      + '"remoteHost":"2804:abcd::1","VISITOR_DATA":"CgswMVN6","visitorData":"abc",'
      + '"params":[{"key":"visitor_data","value":"CgtQUVJTVFU"},{"key":"ipcc","value":"BR"}]});</script></html>'
    const saida = recortar(bruto)
    expect(saida).toContain('"remoteHost":"X"')
    expect(saida).not.toContain('2804:abcd')
    expect(saida).not.toContain('CgswMVN6')
    expect(saida).not.toMatch(/"visitorData":"abc"/)
    expect(saida).not.toContain('CgtQUVJTVFU')
    expect(saida).toContain('{"key":"ipcc","value":"X"}')
  })
})

describe('derivar.ts sobre a página A', () => {
  it('B tem o título B nos renderers e o oficial A', () => {
    expect(PAGINA_B()).toContain('"Consist')
    expect(PAGINA_A()).toContain('"videoDetails":{"videoId":"qIg9a7vqcNo"')
  })

  it('loginRequiredForaDoPlayability: status OK, string em outro ponto; contar.ts diz true', () => {
    const h = loginRequiredForaDoPlayability(PAGINA_A())
    expect(h).toContain('"playabilityStatus":{"status":"OK"')
    expect(h).toContain('"LOGIN_REQUIRED"')
    expect(contarPagina(h, 200, null).jogadorBloqueado).toBe(true)
    expect(contarPagina(PAGINA_A(), 200, null).jogadorBloqueado).toBe(false)
  })

  it('jogadorBloqueadoDoVercel: LOGIN_REQUIRED, 3 renderers, sem videoDetails nem og:title', () => {
    const h = jogadorBloqueadoDoVercel(PAGINA_A())
    expect(h).toContain('"status":"LOGIN_REQUIRED"')
    expect(h).not.toContain('"videoDetails":{"videoId"')
    expect(h).not.toContain('og:title')
    const c = contarPagina(h, 200, null)
    expect(c.renderers).toBe(3)
    expect(c.jogadorBloqueado).toBe(true)
    expect(c.oficial).toBe(false)
  })

  it('layoutNovo, semInitialData, semVideoDetails, comPlayability e rendererCom', () => {
    expect(contarPagina(layoutNovo(PAGINA_A()), 200, null).renderers).toBe(0)
    expect(semInitialData(PAGINA_A())).not.toContain('var ytInitialData')
    expect(semVideoDetails(PAGINA_A())).not.toContain('"videoDetails":{"videoId"')
    expect(comPlayability(PAGINA_A(), 'UNPLAYABLE', 'x')).toContain('"status":"UNPLAYABLE"')
    expect(rendererCom(PAGINA_A(), ['5 - ', 'Teste'])).toContain('{"text":"5 - "},{"text":"Teste"}')
  })
})
