// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  noJunkText, oneFilledButton, linkCountsMatch, contrastRatio, contrastAA,
  forbiddenVocabulary, futureTimes, weekdaysMatch, brokenLinks,
} from './audits'
import { createClock } from '@/lib/youtube/observatorio/time'

const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d }
// 2026-10-24 15:02 São Paulo (a saturday)
const NOW = Date.UTC(2026, 9, 24, 18, 2)
const clock = createClock(NOW, Date.UTC(2026, 8, 1, 3), Date.UTC(2026, 8, 1, 3))
beforeEach(() => { document.body.innerHTML = '' })

describe('audits', () => {
  it('flags NaN / undefined / "há −"', () => {
    expect(noJunkText(el('<p>views NaN</p><p>há −3 h</p><p>undefined</p>')).length).toBe(3)
    expect(noJunkText(el('<p>há 3 h · −41%</p>'))).toEqual([])
  })
  it('noJunkText ignores hidden / sr-only / aria-hidden subtrees', () => {
    expect(noJunkText(el('<p hidden>NaN</p><p class="sr-only">undefined</p><div aria-hidden="true"><b>null</b></div>'))).toEqual([])
  })
  it('does not flag words that merely contain the junk token', () => {
    expect(noJunkText(el('<p>Nanda, nullable</p>'))).toEqual([])
  })
  it('catches NaN glued to symbols and units', () => {
    for (const x of ['NaN%', '−NaN×', 'NaNh', 'há NaN min', 'NaNd']) expect(noJunkText(el(`<p>${x}</p>`)), x).not.toEqual([])
    for (const x of ['Nanda', 'nullable']) expect(noJunkText(el(`<p>${x}</p>`)), x).toEqual([])
  })
  it('one filled button per view', () => {
    expect(oneFilledButton(el('<button class="btn-primary">A</button><button class="btn-forja-solid">B</button>'))).toHaveLength(1)
    expect(oneFilledButton(el('<button class="btn-primary">A</button><button class="btn-forja-solid" hidden>B</button>'))).toEqual([])
  })
  it('link N equals destination N', () => {
    expect(linkCountsMatch(el('<a data-link-n="5" data-link-key="out">Ver os 5 vídeos</a>'), { out: 5 })).toEqual([])
    expect(linkCountsMatch(el('<a data-link-n="5" data-link-key="out">Ver os 5 vídeos</a>'), { out: 4 })).toHaveLength(1)
    expect(linkCountsMatch(el('<a data-link-n="5" data-link-key="zzz">x</a>'), { out: 5 })).toHaveLength(1)
  })
  it('contrast: muted #A89D88 on surface #221E1A passes AA; #5C5345 fails', () => {
    expect(contrastRatio('#A89D88', '#221E1A')).toBeGreaterThan(4.5)
    expect(contrastAA([{ fg: '#5C5345', bg: '#221E1A', label: 'faint' }])).toHaveLength(1)
  })
  it('contrast: black on white is 21 and large text uses 3:1', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('rgb(255, 255, 255)', 'rgba(0,0,0,1)')).toBeCloseTo(21, 5)
    const mid = { fg: '#8a8a8a', bg: '#ffffff', label: 'mid' } // ~3.45:1
    expect(contrastAA([mid])).toHaveLength(1)
    expect(contrastAA([{ ...mid, large: true }])).toEqual([])
  })
  it('forbidden vocabulary', () => {
    expect(forbiddenVocabulary(el('<p>o watchdog liberou</p>'))).toHaveLength(1)
    expect(forbiddenVocabulary(el('<p>Tudo certo, sincronizado</p>'))).toEqual([])
  })
  it('vocabulary: standalone sync fails, async / sincronização pass, inflections caught', () => {
    for (const x of ['sync', 'Sync agora', 'diffs', 'snapshots', 'syncing', 'watchdogs']) expect(forbiddenVocabulary(el(`<p>${x}</p>`)), x).toHaveLength(1)
    for (const x of ['async', 'sincronização']) expect(forbiddenVocabulary(el(`<p>${x}</p>`)), x).toEqual([])
  })
  it('broken links: href "#" or dangling "?"', () => {
    expect(brokenLinks(el('<a href="#">a</a><a href="/x?">b</a><a href="/x?a=1">ok</a>'))).toHaveLength(2)
  })
})

describe('futureTimes', () => {
  it('flags a time later today without a forecast word', () => {
    expect(futureTimes(el('<p>Sincronizou às 18:30</p>'), NOW, clock)).toHaveLength(1)
  })
  it('flags a later date', () => {
    expect(futureTimes(el('<p>25/10 09:00 rodou</p>'), NOW, clock)).toHaveLength(1)
  })
  it('allows past times and forecast contexts and [data-future]', () => {
    expect(futureTimes(el('<p>Rodou às 14:59</p><p>volta às 18:30</p><p>23/10 22:00 ok</p>'), NOW, clock)).toEqual([])
    expect(futureTimes(el('<p><span data-future>às 23:00</span></p>'), NOW, clock)).toEqual([])
  })
})

describe('weekdaysMatch', () => {
  it('24/10/2026 is sáb', () => {
    expect(weekdaysMatch(el('<p>sáb 24/10</p>'), clock)).toEqual([])
    expect(weekdaysMatch(el('<p>seg 24/10</p>'), clock)).toHaveLength(1)
  })
  it('checks accented long names: wrong terça is flagged', () => {
    expect(weekdaysMatch(el('<p>terça 26/10</p>'), clock)).toHaveLength(1)
    expect(weekdaysMatch(el('<p>segunda 26/10</p><p>terça 27/10</p>'), clock)).toEqual([])
  })
})
