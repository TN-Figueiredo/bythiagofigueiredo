// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Important #4 (review dos blocos 3-5): o passo "Decide and alert" do
// health-watch roda sob `set -uo pipefail` — SEM `-e`. Um `send` recusado
// (403/429; runners do GitHub compartilham IP de saída com a população que o
// ntfy.sh limita) devolvia != 0, o `case` seguia, `alerted_at` era armado como
// se o push tivesse chegado (suprimindo o re-alerta por 6 h) e o passo saía 0 —
// enquanto o comentário do próprio arquivo afirmava "Entrega VERIFICADA".
//
// Este teste não lê o YAML atrás de uma string: ele EXTRAI o script do passo e
// o EXECUTA com um `curl` falso no PATH, afirmando sobre o código de saída e
// sobre o arquivo de estado — os dois efeitos que decidem se o dono é avisado.

const WORKFLOW = fileURLToPath(new URL('../../../../.github/workflows/health-watch.yml', import.meta.url))

function alertStepScript(): string {
  const yaml = readFileSync(WORKFLOW, 'utf8')
  const match = /- name: Decide and alert[\s\S]*?run: \|\n([\s\S]*?)\n {6}- name: Save state/.exec(yaml)
  if (!match || match[1] === undefined) throw new Error('passo "Decide and alert" não encontrado')
  return match[1]
    .split('\n')
    .map((line) => (line.startsWith(' '.repeat(10)) ? line.slice(10) : line))
    .join('\n')
}

interface IRunResult {
  exitCode: number
  state: string | null
  alertedAt: string | null
}

let workdir = ''
let scriptPath = ''

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'health-watch-'))
  scriptPath = join(workdir, 'alert-step.sh')
  writeFileSync(scriptPath, alertStepScript())
  const fakeBin = join(workdir, 'bin')
  spawnSync('mkdir', ['-p', fakeBin])
  const curl = join(fakeBin, 'curl')
  // `exit $FAKE_CURL_EXIT` reproduz o `curl -f` diante de um 403/429.
  writeFileSync(curl, '#!/bin/bash\nexit "${FAKE_CURL_EXIT:-0}"\n')
  chmodSync(curl, 0o755)
})

function runStep(opts: {
  state: string
  prevState: string
  prevAlert: string
  curlExit: string
}): IRunResult {
  const statePath = join(workdir, '.health-watch-state')
  if (existsSync(statePath)) writeFileSync(statePath, '')
  const res = spawnSync('bash', [scriptPath], {
    cwd: workdir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(workdir, 'bin')}:${process.env.PATH ?? ''}`,
      NTFY_URL: 'https://ntfy.example/t',
      REALERT_AFTER_SECONDS: '21600',
      STATE: opts.state,
      PREV_STATE: opts.prevState,
      PREV_ALERT: opts.prevAlert,
      STATUS: 'degraded',
      HTTP_CODE: '200',
      LATE: 'instagram-sync',
      UNKNOWN: '',
      FAKE_CURL_EXIT: opts.curlExit,
    },
  })
  const raw = existsSync(statePath) ? readFileSync(statePath, 'utf8').split('\n') : []
  return {
    exitCode: res.status ?? -1,
    state: raw[0] ?? null,
    alertedAt: raw[1] ?? null,
  }
}

describe('health-watch · passo "Decide and alert"', () => {
  it('push aceito numa transição para not-ok: passo verde e supressão armada', () => {
    const r = runStep({ state: 'not-ok', prevState: 'ok', prevAlert: '', curlExit: '0' })
    expect(r.exitCode).toBe(0)
    expect(r.state).toBe('not-ok')
    expect(r.alertedAt).toMatch(/^[0-9]+$/)
  })

  it('push RECUSADO numa transição: passo FALHA e a supressão NÃO é armada', () => {
    const r = runStep({ state: 'not-ok', prevState: 'ok', prevAlert: '', curlExit: '22' })
    expect(r.exitCode).toBe(1)
    // Estado anterior preservado => o run seguinte (15 min) vê a MESMA
    // transição e tenta de novo. Gravar 'not-ok' aqui, com alerted_at vazio,
    // fecharia o ramo `re-alert` (que exige alerted_at) e viraria silêncio.
    expect(r.state).toBe('ok')
    expect(r.alertedAt).toBe('')
  })

  it('push RECUSADO num re-alerta: falha e mantém o carimbo antigo (segue vencido)', () => {
    const old = '1000000000'
    const r = runStep({ state: 'not-ok', prevState: 'not-ok', prevAlert: old, curlExit: '22' })
    expect(r.exitCode).toBe(1)
    expect(r.alertedAt).toBe(old)
  })

  it('push RECUSADO na recuperação: falha e o estado segue not-ok', () => {
    const r = runStep({ state: 'ok', prevState: 'not-ok', prevAlert: '1700000000', curlExit: '22' })
    expect(r.exitCode).toBe(1)
    expect(r.state).toBe('not-ok')
  })

  it('sem transição nenhuma: nada é enviado e o passo é verde', () => {
    const r = runStep({ state: 'ok', prevState: 'ok', prevAlert: '', curlExit: '22' })
    expect(r.exitCode).toBe(0)
    expect(r.state).toBe('ok')
  })
})
