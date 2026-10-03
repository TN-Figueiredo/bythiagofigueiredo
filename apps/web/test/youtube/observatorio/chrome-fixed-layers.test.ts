// @vitest-environment node
/**
 * The fixed layers of the Observatório screens (dialogs and their backdrops, the drawer below 1280 px, the row menu)
 * must resolve `position: fixed` against the viewport. Two declarations of chrome.css once made an ancestor of every
 * screen their containing block instead — the size container on .obs-ch-content and a transform on .obs-ch-screen
 * (the CSS build turned `transform:none; translate:none` into `translate3d(0,0,0)`) — so the "Adicionar canal"
 * backdrop covered only the content column. jsdom has no layout: this guards the cause in the stylesheet itself.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const css = fs.readFileSync(path.join(DIR, '_chrome/chrome.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Every `selector{declarations}` of the sheet, at-rule wrappers flattened. */
function rules(src: string): Array<{ sel: string; body: string; at: string | null }> {
  const out: Array<{ sel: string; body: string; at: string | null }> = []
  const walk = (s: string, at: string | null) => {
    let i = 0
    while (i < s.length) {
      const open = s.indexOf('{', i)
      if (open < 0) break
      let depth = 1, j = open + 1
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++ }
      const head = s.slice(i, open).trim(), body = s.slice(open + 1, j - 1)
      if (head.startsWith('@container') || head.startsWith('@media') || head.startsWith('@supports')) walk(body, head)
      else if (!head.startsWith('@')) out.push({ sel: head, body, at })
      i = j
    }
  }
  walk(src, null)
  return out
}
const all = rules(css)
/** Declarations that make a box the containing block of its position:fixed descendants. */
const CAPTURES = /(^|;)\s*(container(-type)?|transform|translate|rotate|scale|perspective|filter|backdrop-filter|will-change|contain)\s*:/
/** The last compound of each selector of a rule is a wrapper of the screen (.obs-ch-root, .obs-ch-content, .obs-ch-screen). */
const targetsWrapper = (sel: string) => sel.split(',').some(s => /(\.obs-ch-root|\.obs-ch-content|\.obs-ch-screen)\s*$/.test(s.trim()))

describe('Observatório chrome · fixed layers resolve against the viewport', () => {
  it('no wrapper of the screen declares anything that captures position: fixed', () => {
    const bad = all.filter(r => targetsWrapper(r.sel) && CAPTURES.test(r.body)).map(r => r.sel)
    expect(bad).toEqual([])
  })
  it('the size container of the compact chrome is the chrome block itself', () => {
    const owners = all.filter(r => /(^|;)\s*container\s*:\s*obscontent\b/.test(r.body)).map(r => r.sel)
    expect(owners).toEqual(['[data-obs] .obs-ch-content>[data-obs-chrome]'])
  })
  it('the container queries still exist and style only chrome classes, which no screen uses', () => {
    const queried = all.filter(r => r.at?.startsWith('@container obscontent'))
    expect(queried.length).toBeGreaterThan(20)
    const classes = new Set(queried.flatMap(r => r.sel.match(/\.obs-ch-[a-z0-9-]+/g) ?? []).map(c => c.slice(1)))
    expect(classes.has('obs-ch-head') && classes.has('obs-ch-tabs') && classes.has('obs-ch-tz')).toBe(true)
    // every queried class is rendered by a _chrome component and by nothing else: nothing outside the chrome block
    // (the screen is its sibling) depended on being inside the container
    const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [])
    const outside = files(DIR).filter(f => !f.includes(`${path.sep}_chrome${path.sep}`)).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    expect([...classes].filter(c => new RegExp(`\\b${c}\\b`).test(outside))).toEqual([])
  })
})
