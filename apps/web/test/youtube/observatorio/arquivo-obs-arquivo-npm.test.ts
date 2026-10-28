// @vitest-environment node
/** Emenda da peça 7 (E-D1, D-F22): `npm run -s obs:arquivo` sem credencial sai 2 e a forja receberia só o script de falha. */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../../..')
const env = () => ({ PATH: process.env.PATH ?? '', HOME: mkdtempSync(join(tmpdir(), 'obs-home-')) })

describe('npm run -s obs:arquivo', () => {
  it('sem o arquivo da credencial: código 2, frase no stderr, stdout só o script de falha', () => {
    const r = spawnSync('npm', ['run', '-s', 'obs:arquivo'], { cwd: RAIZ, encoding: 'utf8', env: env(), timeout: 60_000 })
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('.config/obs-arquivo/chave')
    expect(r.stdout.startsWith('#!/bin/bash\n')).toBe(true)
    expect(r.stdout).toMatch(/\nexit 1\n?$/)
    // o que a forja receberia: sai 1 e a última coisa dita é a linha OBS-ARQUIVO (Yannis I2)
    const forja = spawnSync('bash', ['-s'], { input: r.stdout, encoding: 'utf8' })
    expect(forja.status).toBe(1)
    expect(forja.stderr).toContain('OBS-ARQUIVO: NÃO RODOU')
  }, 30_000)
  it('o cd da linha: se a pasta não existe nada roda e nada chega ao ssh (a linha do dono, E-D1)', () => {
    const r = spawnSync('bash', ['-c', 'cd /nao/existe/obs && npm run -s obs:arquivo | cat'], { encoding: 'utf8', env: env(), timeout: 30_000 })
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
  }, 30_000)
  it('a escrita é drenada: 1 MB no stdout de um pipe chega inteiro (Yannis I3)', () => {
    const r = spawnSync(process.execPath, [join(RAIZ, 'node_modules/.bin/tsx'), join(RAIZ, 'apps/web/test/fixtures/escreve-grande.ts')], { encoding: 'utf8', maxBuffer: 4_000_000, timeout: 30_000 })
    expect(r.stdout.length).toBe(1_000_001)   // 1.000.000 de 'x' e o \n; com process.exit logo após o write o macOS entregava 65.536
  }, 30_000)
  it('ssh que cai antes de ler (EPIPE no stdout): sem pilha do node no terminal, a frase da chave aparece (Yannis M2)', () => {
    const r = spawnSync('bash', ['-c', 'npm run -s obs:arquivo | (exec 0<&-; sleep 1)'], { cwd: RAIZ, encoding: 'utf8', env: env(), timeout: 60_000 })
    expect(r.stderr).not.toContain('node:internal')
    expect(r.stderr).toContain('.config/obs-arquivo/chave')
  }, 30_000)
  it('por que o -s: sem ele o npm põe o cabeçalho no stdout, que viraria comando na forja', () => {
    const r = spawnSync('npm', ['run', 'obs:arquivo'], { cwd: RAIZ, encoding: 'utf8', env: env(), timeout: 60_000 })
    expect(r.stdout.trimStart().startsWith('> ')).toBe(true)   // se o npm parar de imprimir, rever E-D1 (a linha da peça 7)
  }, 30_000)
})
