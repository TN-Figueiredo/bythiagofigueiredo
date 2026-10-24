// Testes do audit-gate.mjs (node --test scripts/audit-gate.test.mjs). Sem rede: usa AUDIT_GATE_INPUT.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'audit-gate.mjs')
delete process.env.AUDIT_GATE_INPUT
const dir = mkdtempSync(join(tmpdir(), 'audit-gate-'))
const ID = 'GHSA-mrhx-c7xc-m3w5'
const adv = (id) => ({ url: `https://github.com/advisories/${id}` })

function run(vulns, today = '2026-10-24') {
  const f = join(dir, `a-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(f, JSON.stringify({ vulnerabilities: vulns }))
  const r = spawnSync('node', [GATE, f], { encoding: 'utf8', env: { ...process.env, AUDIT_GATE_TODAY: today } })
  return { code: r.status, out: r.stdout + r.stderr }
}

const baseline = {
  zod: { severity: 'high', via: [adv(ID)] },
  'cms-pkg': { severity: 'high', via: ['zod'] },
}

test('passa com a baseline atual', () => {
  const r = run(baseline)
  assert.equal(r.code, 0, r.out)
})

test('falha com outro high fora da allowlist', () => {
  const r = run({ ...baseline, outro: { severity: 'high', via: [adv('GHSA-aaaa-bbbb-cccc')] } })
  assert.equal(r.code, 1)
  assert.match(r.out, /GHSA-aaaa-bbbb-cccc/)
})

test('falha quando o id da baseline sumiu (exceção morta)', () => {
  const r = run({ x: { severity: 'low', via: [adv('GHSA-aaaa-bbbb-cccc')] } })
  assert.equal(r.code, 1)
  assert.match(r.out, /não aparece mais/)
})

test('falha com a exceção vencida', () => {
  const r = run(baseline, '2027-02-01')
  assert.equal(r.code, 1)
  assert.match(r.out, /venceu/)
})

test('falha sem vulnerabilities no JSON (fecha em falha)', () => {
  const f = join(dir, 'vazio.json')
  writeFileSync(f, '{}')
  const r = spawnSync('node', [GATE, f], { encoding: 'utf8' })
  assert.equal(r.status, 1)
})
