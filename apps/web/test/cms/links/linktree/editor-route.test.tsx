import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('Linktree editor route (/cms/links/linktree)', () => {
  const routeDir = resolve(__dirname, '../../../../src/app/cms/(authed)/links/linktree')

  it('page.tsx exists at the route path', () => {
    expect(existsSync(resolve(routeDir, 'page.tsx'))).toBe(true)
  })

  it('page.tsx re-uses the LinktreeEditor component from _components/linktree/', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).toContain("from '../_components/linktree/linktree-editor'")
  })

  it('page.tsx is a server component (no use client)', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).not.toContain("'use client'")
  })

  it('page.tsx uses force-dynamic', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).toContain("export const dynamic = 'force-dynamic'")
  })

  it('page.tsx requires view scope before rendering', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).toContain("requireSiteScope({ area: 'cms', siteId, mode: 'view' })")
  })

  it('page.tsx checks edit scope for readOnly flag', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).toContain("requireSiteScope({ area: 'cms', siteId, mode: 'edit' })")
    expect(content).toContain('readOnly')
  })

  it('page.tsx redirects to /cms if view access denied', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile(resolve(routeDir, 'page.tsx'), 'utf-8')
    expect(content).toContain("redirect('/cms')")
  })

  it('TreeTab links to /cms/links/linktree', async () => {
    const fs = await import('fs/promises')
    const treeTabPath = resolve(__dirname, '../../../../src/app/cms/(authed)/links/_components/tree-tab.tsx')
    const content = await fs.readFile(treeTabPath, 'utf-8')
    expect(content).toContain('href="/cms/links/linktree"')
  })

  it('LinktreeEditor component exists at the expected path', () => {
    const editorPath = resolve(
      __dirname,
      '../../../../src/app/cms/(authed)/links/_components/linktree/linktree-editor.tsx',
    )
    expect(existsSync(editorPath)).toBe(true)
  })
})
