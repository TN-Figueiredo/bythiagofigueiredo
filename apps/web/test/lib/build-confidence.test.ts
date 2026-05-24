import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')

describe('build confidence pipeline', () => {
  it('build:packages script exists in root package.json', () => {
    const pkgPath = join(ROOT, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts?.['build:packages']).toBeDefined()
    expect(pkg.scripts['build:packages'].trim()).not.toBe('')
  })

  it('postinstall references build:packages', () => {
    const pkgPath = join(ROOT, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts?.['postinstall']).toBeDefined()
    expect(pkg.scripts['postinstall']).toContain('build:packages')
  })

  it('every dist-exporting workspace package is in build:packages', () => {
    const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const buildScript: string = rootPkg.scripts?.['build:packages'] ?? ''

    const packagesDir = join(ROOT, 'packages')
    const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    const violations: string[] = []

    for (const dir of packageDirs) {
      const pkgPath = join(packagesDir, dir, 'package.json')
      if (!existsSync(pkgPath)) continue

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const main: string = pkg.main ?? ''

      if (main.includes('dist/')) {
        const name: string = pkg.name ?? dir
        if (!buildScript.includes(`packages/${dir}`)) {
          violations.push(`${name} (packages/${dir}) has main: "${main}" but is not in build:packages script`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('build:packages only references existing packages with build scripts', () => {
    const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const buildScript: string = rootPkg.scripts?.['build:packages'] ?? ''

    const workspaceMatches = [...buildScript.matchAll(/-w\s+packages\/(\S+)/g)]
    const referencedPackages = workspaceMatches.map((m) => m[1])

    const violations: string[] = []

    for (const pkgName of referencedPackages) {
      const pkgDir = join(ROOT, 'packages', pkgName)
      if (!existsSync(pkgDir)) {
        violations.push(`packages/${pkgName} is referenced in build:packages but directory does not exist`)
        continue
      }

      const pkgJsonPath = join(pkgDir, 'package.json')
      if (!existsSync(pkgJsonPath)) {
        violations.push(`packages/${pkgName} is referenced in build:packages but has no package.json`)
        continue
      }

      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
      if (!pkg.scripts?.['build']) {
        violations.push(`packages/${pkgName} is referenced in build:packages but has no build script`)
      }
    }

    expect(violations).toEqual([])
  })

  it('src-exporting workspace packages are in transpilePackages', () => {
    const nextConfigPath = join(ROOT, 'apps', 'web', 'next.config.ts')
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8')

    const match = nextConfigContent.match(/transpilePackages:\s*\[([^\]]+)\]/)
    expect(match).not.toBeNull()

    const transpilePackages = (match![1].match(/'([^']+)'|"([^"]+)"/g) ?? []).map((s) =>
      s.replace(/['"]/g, '')
    )

    const packagesDir = join(ROOT, 'packages')
    const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    const violations: string[] = []

    for (const dir of packageDirs) {
      const pkgPath = join(packagesDir, dir, 'package.json')
      if (!existsSync(pkgPath)) continue

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const main: string = pkg.main ?? ''

      if (main.includes('src/')) {
        const name: string = pkg.name ?? dir
        if (!transpilePackages.includes(name)) {
          violations.push(`${name} (packages/${dir}) has main: "${main}" (src-based) but is not in transpilePackages`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it.each([
    ['apps/web', 'src'],
    ['apps/api', 'src'],
  ])('no @tn-figueiredo/* import in %s without package.json declaration', (app, srcSubdir) => {
    const { execSync } = require('node:child_process')

    const appDir = join(ROOT, app)
    const appPkgPath = join(appDir, 'package.json')
    if (!existsSync(appPkgPath)) return

    const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf-8'))
    const declaredDeps = new Set([
      ...Object.keys(appPkg.dependencies ?? {}),
      ...Object.keys(appPkg.devDependencies ?? {}),
    ])

    let grepOutput = ''
    try {
      grepOutput = execSync(
        `grep -rh --include="*.ts" --include="*.tsx" "@tn-figueiredo/" ${appDir}/${srcSubdir}`,
        { encoding: 'utf-8' }
      )
    } catch (err: unknown) {
      const e = err as { status?: number }
      if (e.status === 1) {
        grepOutput = ''
      } else {
        throw err
      }
    }

    const importedPackages = new Set<string>()
    const importRegex = /@tn-figueiredo\/[\w-]+/g
    for (const match of grepOutput.matchAll(importRegex)) {
      importedPackages.add(match[0])
    }

    const violations: string[] = []
    for (const pkg of importedPackages) {
      if (!declaredDeps.has(pkg)) {
        violations.push(`${pkg} is imported in ${app}/src but not declared in ${app}/package.json`)
      }
    }

    expect(violations).toEqual([])
  })
})
