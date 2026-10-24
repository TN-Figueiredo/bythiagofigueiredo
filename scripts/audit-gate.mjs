#!/usr/bin/env node
/**
 * audit-gate.mjs — gate de `npm audit --omit=dev` com allowlist datada.
 *
 * Falha (exit 1) se: (1) algum high/critical depende, transitivamente, de advisory
 * fora da allowlist; (2) uma exceção venceu; (3) um id da allowlist não aparece mais
 * (exceção obsoleta: remover). Detalhe e condição de saída: docs/audit-baseline.md.
 *
 * Testes: AUDIT_GATE_INPUT=<arquivo.json> usa um JSON pronto em vez de rodar o npm;
 * AUDIT_GATE_TODAY=AAAA-MM-DD simula a data.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ALLOWLIST = {
  'GHSA-mrhx-c7xc-m3w5': {
    expires: '2027-01-31',
    reason:
      'zod <4.6.6: DoS por acúmulo de issues em z.array. cms@0.2.0 prende zod 3.23.8; mitigado em código (boundedArray, auth antes do parse).',
  },
}

const today = process.env.AUDIT_GATE_TODAY ?? new Date().toISOString().slice(0, 10)
const input = process.env.AUDIT_GATE_INPUT ?? process.argv[2]

function loadAudit() {
  if (input) return JSON.parse(readFileSync(input, 'utf8'))
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  } catch (e) {
    // npm audit sai com 1 quando há achados, mas ainda imprime o JSON
    if (e.stdout) return JSON.parse(e.stdout)
    throw e
  }
}

const audit = loadAudit()
if (!audit.vulnerabilities) {
  console.error('audit-gate: JSON sem "vulnerabilities" (erro do npm?)', JSON.stringify(audit).slice(0, 500))
  process.exit(1)
}
const vulns = audit.vulnerabilities
const errors = []

const idOf = (url) => (url.match(/GHSA-[a-z0-9-]+/i) ?? [url])[0]

// advisories alcançáveis a partir de um pacote, seguindo `via` que são nomes de pacote
function advisories(name, seen = new Set()) {
  const out = new Set()
  if (seen.has(name)) return out
  seen.add(name)
  const v = vulns[name]
  if (!v) return out
  for (const via of v.via) {
    if (typeof via === 'string') {
      for (const id of advisories(via, seen)) out.add(id)
    } else if (via.url) out.add(idOf(via.url))
  }
  return out
}

const seenAny = new Set()
for (const name of Object.keys(vulns)) for (const id of advisories(name)) seenAny.add(id)

for (const [id, meta] of Object.entries(ALLOWLIST)) {
  if (today > meta.expires) errors.push(`exceção ${id} venceu em ${meta.expires}: resolver ou renovar com justificativa`)
  if (!seenAny.has(id)) errors.push(`exceção ${id} não aparece mais no audit: remover da allowlist`)
}

const blocked = []
for (const [name, v] of Object.entries(vulns)) {
  if (v.severity !== 'high' && v.severity !== 'critical') continue
  const ids = [...advisories(name)]
  const bad = ids.filter((id) => !ALLOWLIST[id] || today > ALLOWLIST[id].expires)
  if (ids.length === 0 || bad.length > 0) blocked.push(`${name} (${v.severity}): ${(bad.length ? bad : ['sem advisory resolvido']).join(', ')}`)
}
if (blocked.length) errors.push(`high/critical fora da allowlist:\n  - ${blocked.join('\n  - ')}`)

if (errors.length) {
  for (const e of errors) console.error(`audit-gate FALHOU: ${e}`)
  process.exit(1)
}
const allowed = Object.keys(vulns).filter((n) => ['high', 'critical'].includes(vulns[n].severity)).length
console.log(`audit-gate OK: ${allowed} high/critical, todos cobertos por exceção datada (${Object.keys(ALLOWLIST).join(', ')}).`)
