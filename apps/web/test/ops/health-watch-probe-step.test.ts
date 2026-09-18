// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Companheiro de `health-watch-alert-step.test.ts`, que cobre a DECISÃO. Aqui
// se cobre a CLASSIFICAÇÃO, e a divisão importa: o incidente de 2026-09-07..18
// nasceu no probe, não na decisão. O secret `CRON_SECRET` nunca existiu no
// repositório, /api/health recusava com 401, e o probe chamava 401 de "not-ok"
// — o mesmo balde de "o site não respondeu". O estado travou lá, nenhuma
// transição voltou a ser detectável (logo uma queda real não alertaria) e o
// re-alerta despejou push urgente falso a cada 6 h por 11 dias.
//
// Mutar a classificação no YAML tem de deixar este arquivo VERMELHO: sem ele,
// devolver `blind` para `not-ok` passava por todos os testes do projeto.

const WORKFLOW = fileURLToPath(new URL('../../../../.github/workflows/health-watch.yml', import.meta.url))

function probeStepScript(): string {
  const yaml = readFileSync(WORKFLOW, 'utf8')
  const match = /- name: Probe \/api\/health\n[\s\S]*?run: \|\n([\s\S]*?)\n {6}- name: Resolve previous state/.exec(yaml)
  if (!match || match[1] === undefined) throw new Error('passo "Probe /api/health" não encontrado')
  return match[1]
    .split('\n')
    .map((line) => (line.startsWith(' '.repeat(10)) ? line.slice(10) : line))
    .join('\n')
}

let workdir = ''
let scriptPath = ''

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'health-watch-probe-'))
  scriptPath = join(workdir, 'probe-step.sh')
  writeFileSync(scriptPath, probeStepScript())
  const fakeBin = join(workdir, 'bin')
  spawnSync('mkdir', ['-p', fakeBin])
  // O `curl` real é substituído por um que grava o corpo no destino de `-o` e
  // imprime o código de `-w '%{http_code}'`, que é exatamente o contrato que o
  // passo consome.
  writeFileSync(
    join(fakeBin, 'curl'),
    [
      '#!/bin/bash',
      'out=""',
      'while [ $# -gt 0 ]; do',
      '  case "$1" in -o) out="$2"; shift 2 ;; *) shift ;; esac',
      'done',
      '[ -n "$out" ] && printf \'%s\' "${FAKE_BODY:-}" > "$out"',
      'printf \'%s\' "${FAKE_HTTP:-200}"',
      '',
    ].join('\n'),
  )
  chmodSync(join(fakeBin, 'curl'), 0o755)
})

interface IProbeResult {
  state: string | undefined
  httpCode: string | undefined
  status: string | undefined
  /** `::error::`/`::warning::` são comandos de workflow: saem em stdout. */
  stdout: string
}

function runProbe(opts: { httpCode: string; body?: string; cronSecret?: string }): IProbeResult {
  const outputPath = join(workdir, 'github-output')
  writeFileSync(outputPath, '')
  writeFileSync(join(workdir, 'step-summary'), '')
  const res = spawnSync('bash', [scriptPath], {
    cwd: workdir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(workdir, 'bin')}:${process.env.PATH ?? ''}`,
      RUNNER_TEMP: workdir,
      GITHUB_OUTPUT: outputPath,
      GITHUB_STEP_SUMMARY: join(workdir, 'step-summary'),
      HEALTH_URL: 'https://example.invalid/api/health',
      CRON_SECRET: opts.cronSecret ?? 'segredo-de-teste',
      FAKE_HTTP: opts.httpCode,
      FAKE_BODY: opts.body ?? '{"status":"ok","crons":[],"unknownNames":[]}',
    },
  })
  const out = readFileSync(outputPath, 'utf8')
  const pick = (k: string): string | undefined => new RegExp(`^${k}=(.*)$`, 'm').exec(out)?.[1]
  return {
    state: pick('state'),
    httpCode: pick('http_code'),
    status: pick('status'),
    stdout: res.stdout ?? '',
  }
}

describe('health-watch · passo "Probe /api/health"', () => {
  it('200 com status ok => ok', () => {
    expect(runProbe({ httpCode: '200' }).state).toBe('ok')
  })

  it('401 => blind (sonda sem credencial), NUNCA not-ok', () => {
    const r = runProbe({ httpCode: '401', body: '' })
    expect(r.state).toBe('blind')
    expect(r.httpCode).toBe('401')
  })

  it('403 => blind pelo mesmo motivo', () => {
    expect(runProbe({ httpCode: '403', body: '' }).state).toBe('blind')
  })

  it('000 (timeout/DNS/TLS) => not-ok: ali o site realmente não respondeu', () => {
    expect(runProbe({ httpCode: '000', body: '' }).state).toBe('not-ok')
  })

  it('503 => not-ok', () => {
    expect(runProbe({ httpCode: '503', body: '' }).state).toBe('not-ok')
  })

  it('200 com status degraded => not-ok (o HTTP está bom, o sistema não)', () => {
    const r = runProbe({
      httpCode: '200',
      body: '{"status":"degraded","crons":[{"name":"sync-youtube","status":"late"}],"unknownNames":[]}',
    })
    expect(r.state).toBe('not-ok')
    expect(r.status).toBe('degraded')
  })

  it('secret ausente nomeia a causa no log mas NÃO aborta — abortar recria o silêncio', () => {
    const r = runProbe({ httpCode: '401', body: '', cronSecret: '' })
    expect(r.stdout).toContain('::error::')
    expect(r.stdout).toContain('secrets.CRON_SECRET ausente')
    // o passo seguiu até o fim e classificou
    expect(r.state).toBe('blind')
  })
})
