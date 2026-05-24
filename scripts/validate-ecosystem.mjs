#!/usr/bin/env node
/**
 * validate-ecosystem.mjs
 *
 * Validates structural integrity of the monorepo's dependency graph.
 * Runs during pre-push hook. Exits 0 on success, 1 on errors.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'

const ROOT = resolve(import.meta.dirname, '..')

const errors = []
const warnings = []

function err(msg) {
  errors.push(msg)
  console.error(`❌ ${msg}`)
}

function warn(msg) {
  warnings.push(msg)
  console.warn(`⚠️  ${msg}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Parse `-w packages/NAME` patterns from a script string.
 * Returns an array of package directory names (e.g. ['links', 'links-admin', 'social']).
 */
function parseBuildPackagesWorkspaces(script) {
  const matches = [...script.matchAll(/-w\s+packages\/([^\s]+)/g)]
  return matches.map((m) => m[1])
}

/**
 * Read transpilePackages from next.config.ts by grepping for the array literal.
 * Returns an array of package names.
 */
function readTranspilePackages(nextConfigPath) {
  if (!existsSync(nextConfigPath)) return []
  const content = readFileSync(nextConfigPath, 'utf8')
  // Match: transpilePackages: ['pkg1', 'pkg2', ...]
  const match = content.match(/transpilePackages\s*:\s*\[([^\]]+)\]/)
  if (!match) return []
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

// ---------------------------------------------------------------------------
// Check 1: Build pipeline coverage
// ---------------------------------------------------------------------------

function checkBuildPipelineCoverage() {
  const rootPkg = readJson(join(ROOT, 'package.json'))
  if (!rootPkg) {
    err('Cannot read root package.json')
    return
  }

  const buildScript = rootPkg.scripts?.['build:packages'] ?? ''
  const builtWorkspaces = parseBuildPackagesWorkspaces(buildScript)

  const transpilePackages = readTranspilePackages(
    join(ROOT, 'apps/web/next.config.ts')
  )

  const packagesDir = join(ROOT, 'packages')
  if (!existsSync(packagesDir)) {
    err('packages/ directory not found')
    return
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = join(packagesDir, pkgDir, 'package.json')
    const pkgJson = readJson(pkgJsonPath)
    if (!pkgJson) continue

    const mainField = pkgJson.main ?? ''
    const pkgName = pkgJson.name ?? pkgDir

    if (mainField.includes('dist/')) {
      // Must be listed in build:packages
      if (!builtWorkspaces.includes(pkgDir)) {
        err(
          `Package "${pkgName}" (packages/${pkgDir}) has main pointing to dist/ but is not listed in root build:packages script.`
        )
      }
    } else if (mainField.includes('src/')) {
      // Should be in transpilePackages
      if (!transpilePackages.includes(pkgName)) {
        warn(
          `Package "${pkgName}" (packages/${pkgDir}) has main pointing to src/ but is not listed in transpilePackages in next.config.ts.`
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: Stale reference check
// ---------------------------------------------------------------------------

function checkStaleReferences() {
  const rootPkg = readJson(join(ROOT, 'package.json'))
  if (!rootPkg) return // already reported in check 1

  const buildScript = rootPkg.scripts?.['build:packages'] ?? ''
  const builtWorkspaces = parseBuildPackagesWorkspaces(buildScript)

  for (const pkgDir of builtWorkspaces) {
    const pkgPath = join(ROOT, 'packages', pkgDir)
    if (!existsSync(pkgPath)) {
      err(
        `build:packages references packages/${pkgDir} but that directory does not exist.`
      )
      continue
    }

    const pkgJson = readJson(join(pkgPath, 'package.json'))
    if (!pkgJson) {
      err(
        `packages/${pkgDir} is referenced in build:packages but has no package.json.`
      )
      continue
    }

    if (!pkgJson.scripts?.build) {
      err(
        `packages/${pkgDir} is referenced in build:packages but has no "build" script in its package.json.`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3: Import ↔ Declaration check
// ---------------------------------------------------------------------------

function checkImportDeclarations() {
  const apps = [
    { name: 'apps/web', srcDir: join(ROOT, 'apps/web/src') },
    { name: 'apps/api', srcDir: join(ROOT, 'apps/api/src') },
  ]

  for (const app of apps) {
    if (!existsSync(app.srcDir)) continue

    const appPkgJson = readJson(join(ROOT, app.name, 'package.json'))
    if (!appPkgJson) {
      warn(`Cannot read ${app.name}/package.json — skipping import check.`)
      continue
    }

    const declared = new Set([
      ...Object.keys(appPkgJson.dependencies ?? {}),
      ...Object.keys(appPkgJson.devDependencies ?? {}),
      ...Object.keys(appPkgJson.peerDependencies ?? {}),
    ])

    // grep for all @tn-figueiredo/* imports in the src directory
    let grepOutput = ''
    try {
      grepOutput = execSync(
        `grep -r --include="*.ts" --include="*.tsx" -h "@tn-figueiredo/" "${app.srcDir}"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch (e) {
      // grep exits 1 when no matches found — that's fine
      grepOutput = e.stdout ?? ''
    }

    // Extract unique @tn-figueiredo/NAME (stop at quote, slash after name, or whitespace)
    const importedPackages = new Set(
      [...grepOutput.matchAll(/@tn-figueiredo\/([a-z0-9-]+)/g)].map(
        (m) => `@tn-figueiredo/${m[1]}`
      )
    )

    for (const pkg of importedPackages) {
      if (!declared.has(pkg)) {
        err(
          `"${pkg}" is imported in ${app.name}/src/ but not declared in ${app.name}/package.json.`
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: Postinstall check
// ---------------------------------------------------------------------------

function checkPostinstall() {
  const rootPkg = readJson(join(ROOT, 'package.json'))
  if (!rootPkg) return // already reported

  const postinstall = rootPkg.scripts?.postinstall ?? ''
  if (!postinstall.includes('build:packages')) {
    warn(
      'Root package.json postinstall script does not reference build:packages. Workspace packages may not be built after npm install.'
    )
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

checkBuildPipelineCoverage()
checkStaleReferences()
checkImportDeclarations()
checkPostinstall()

if (errors.length === 0) {
  console.log('✅ Ecosystem validation passed.')
  process.exit(0)
} else {
  process.exit(1)
}
