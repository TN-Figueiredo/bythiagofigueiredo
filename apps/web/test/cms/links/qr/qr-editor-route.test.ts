import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const QR_DIR = resolve(__dirname, '../../../../src/app/cms/(authed)/links/[id]/qr')
const DETAIL_DIR = resolve(__dirname, '../../../../src/app/cms/(authed)/links/[id]')

describe('QR editor route (/cms/links/[id]/qr)', () => {
  it('has [id] dynamic segment directory', () => {
    expect(existsSync(DETAIL_DIR)).toBe(true)
  })

  it('has [id]/page.tsx for link detail', () => {
    expect(existsSync(resolve(DETAIL_DIR, 'page.tsx'))).toBe(true)
  })

  it('link detail page exports a default function', () => {
    const content = readFileSync(resolve(DETAIL_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain('export default')
  })

  it('link detail page imports auth helpers', () => {
    const content = readFileSync(resolve(DETAIL_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain('requireSiteScope')
  })

  // --- QR route-specific tests ---

  it('qr/page.tsx exists', () => {
    expect(existsSync(resolve(QR_DIR, 'page.tsx'))).toBe(true)
  })

  it('qr/page.tsx is a server component (no use client)', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).not.toContain("'use client'")
  })

  it('qr/page.tsx uses force-dynamic', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain("export const dynamic = 'force-dynamic'")
  })

  it('qr/page.tsx requires edit scope', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain("requireSiteScope({ area: 'cms', siteId, mode: 'edit' })")
  })

  it('qr/page.tsx redirects to /cms if access denied', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain("redirect('/cms')")
  })

  it('qr/page.tsx calls notFound() for missing links', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain('notFound()')
  })

  it('qr/page.tsx filters by site_id for tenant isolation', () => {
    const content = readFileSync(resolve(QR_DIR, 'page.tsx'), 'utf-8')
    expect(content).toContain(".eq('site_id', siteId)")
  })

  it('qr/client.tsx exists and is a client component', () => {
    const clientPath = resolve(QR_DIR, 'client.tsx')
    expect(existsSync(clientPath)).toBe(true)
    const content = readFileSync(clientPath, 'utf-8')
    expect(content).toContain("'use client'")
  })

  it('qr/client.tsx delegates to QrCardBuilder from links-admin', () => {
    const content = readFileSync(resolve(QR_DIR, 'client.tsx'), 'utf-8')
    expect(content).toContain("from '@tn-figueiredo/links-admin/client'")
    expect(content).toContain('<QrCardBuilder')
  })

  it('qr/actions.ts exists and is a server action file', () => {
    const actionsPath = resolve(QR_DIR, 'actions.ts')
    expect(existsSync(actionsPath)).toBe(true)
    const content = readFileSync(actionsPath, 'utf-8')
    expect(content).toContain("'use server'")
  })

  it('qr/actions.ts validates composition with Zod schema', () => {
    const content = readFileSync(resolve(QR_DIR, 'actions.ts'), 'utf-8')
    expect(content).toContain('CardCompositionSchema.safeParse')
  })

  it('qr/actions.ts exports all required CRUD actions', () => {
    const content = readFileSync(resolve(QR_DIR, 'actions.ts'), 'utf-8')
    expect(content).toContain('export async function saveQrCard')
    expect(content).toContain('export async function loadQrCard')
    expect(content).toContain('export async function saveQrTemplate')
    expect(content).toContain('export async function listQrTemplates')
    expect(content).toContain('export async function deleteQrTemplate')
    expect(content).toContain('export async function exportQrCard')
    expect(content).toContain('export async function uploadQrImage')
  })

  it('qr/actions.ts enforces edit scope on all write actions', () => {
    const content = readFileSync(resolve(QR_DIR, 'actions.ts'), 'utf-8')
    // Every exported async function (except requireEditScope itself) should call requireEditScope
    const exportedFns = content.match(/export async function (\w+)/g) ?? []
    expect(exportedFns.length).toBeGreaterThanOrEqual(5)
    // Each exported function body should reference requireEditScope
    for (const fn of exportedFns) {
      const fnName = fn.replace('export async function ', '')
      // Find the function body
      const fnIndex = content.indexOf(`export async function ${fnName}`)
      const bodySlice = content.slice(fnIndex, fnIndex + 500)
      expect(bodySlice).toContain('requireEditScope')
    }
  })

  it('qr/actions.ts sanitizes blob: URLs before persisting', () => {
    const content = readFileSync(resolve(QR_DIR, 'actions.ts'), 'utf-8')
    expect(content).toContain('sanitizeBlobUrls')
    expect(content).toContain("startsWith('blob:')")
  })
})
