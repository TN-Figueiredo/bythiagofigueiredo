// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { montarComandosDoCanal } from '@/lib/youtube/observatorio/arquivo-mensal/comandos-canal'

const REF = '6f1c1b9e-0000-4000-8000-000000000001'
const raiz = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }
const geradoEm = new Date('2026-10-25T12:00:00Z')
const prefixos = [
  { filho: 'numerico' as const, prefixo: `serie/canais/${REF}/` },
  { filho: 'texto' as const, prefixo: `texto/canais/${REF}/` },
]
const gerar = (p = prefixos) => montarComandosDoCanal({ channelRef: REF, prefixos: p, raiz, geradoEm })

describe('comandos do canal', () => {
  it('cabeçalho, trava de host, montagem e sentinela por filho', () => {
    const t = gerar()
    expect(t.startsWith('#!/bin/bash')).toBe(true)
    expect(t).toContain('set -euo pipefail')
    expect(t).toContain('umask 077')
    expect(t).toContain('[ "$(hostname -s)" = forja ]')
    for (const f of ['numerico', 'texto'] as const) {
      expect(t).toContain(`mountpoint -q '${raiz[f]}'`)
      expect(t).toContain(`'${raiz[f]}/.arquivo-vivo'`)
    }
  })
  it('remove prefixo, _recebendo e quarentena, um por prefixo', () => {
    const t = gerar()
    for (const p of prefixos) for (const rel of [p.prefixo, `_recebendo/${p.prefixo}`, `_recebendo/_quarentena/${p.prefixo}`]) {
      const d = `${raiz[p.filho]}/${rel}`
      expect(t).toContain(`if [ -d '${d}' ]; then rm -r --one-file-system -- '${d}' && obs_ok=$((obs_ok+1)) ||`)
      expect(t).toContain(`OBS-ARQUIVO: FALHOU: ${d}`)
    }
  })
  it('validade de 24 h', () => {
    const t = gerar()
    const limite = Math.floor(geradoEm.getTime() / 1000) + 86400
    expect(t).toContain(`-le ${limite}`)
    expect(t).toContain('OBS-ARQUIVO: VENCIDO')
    expect(t).toContain('return 4')
  })
  it('fecho e função chamada na mesma linha do }', () => {
    const t = gerar()
    expect(t).toContain(`OBS-ARQUIVO: CANAL ${REF} APAGADO DO NAS`)
    expect(t).toContain('}; obs_canal_main; exit $?')
  })
  it('recusa entradas fora da forma', () => {
    expect(() => montarComandosDoCanal({ channelRef: 'x', prefixos, raiz, geradoEm })).toThrow('canal_invalido')
    expect(() => gerar([])).toThrow('sem_prefixo')
    for (const ruim of [`serie/canais/${REF}/../`, `serie/canais/${REF}/'a/`, `serie/canais/${REF}/ a/`, `serie/canais/${REF}/$a/`])
      expect(() => gerar([{ filho: 'numerico', prefixo: ruim }])).toThrow('prefixo_invalido')
    expect(() => gerar([{ filho: 'numerico', prefixo: 'serie/canais/00000000-0000-4000-8000-000000000002/' }])).toThrow('prefixo_invalido')
    expect(() => gerar([{ filho: 'texto', prefixo: `serie/canais/${REF}/` }])).toThrow('prefixo_filho_incoerente')
    expect(() => gerar([{ filho: 'numerico', prefixo: `texto/canais/${REF}/` }])).toThrow('prefixo_filho_incoerente')
    expect(() => montarComandosDoCanal({ channelRef: REF, prefixos, raiz: { ...raiz, numerico: '/mnt/../x' }, geradoEm })).toThrow('raiz_invalida')
  })
})

describe('comandos do canal: o script gerado, rodado numa raiz temporária', () => {
  function roda(criar: boolean, travarRm = false) {
    const dir = mkdtempSync(join(tmpdir(), 'expurgo-canal-'))
    try {
      const r = { numerico: join(dir, 'numerico'), texto: join(dir, 'texto') }
      for (const f of ['numerico', 'texto'] as const) { mkdirSync(r[f], { recursive: true }); writeFileSync(join(r[f], '.arquivo-vivo'), '') }
      const alvo = join(r.numerico, `serie/canais/${REF}`)
      if (criar) { mkdirSync(alvo, { recursive: true }); writeFileSync(join(alvo, 'a.csv.gz'), 'x') }
      if (travarRm) chmodSync(join(r.numerico, 'serie/canais'), 0o500)
      const bin = join(dir, 'bin'); mkdirSync(bin)
      writeFileSync(join(bin, 'hostname'), '#!/bin/bash\necho forja\n'); chmodSync(join(bin, 'hostname'), 0o755)
      writeFileSync(join(bin, 'mountpoint'), '#!/bin/bash\nexit 0\n'); chmodSync(join(bin, 'mountpoint'), 0o755)
      // o script roda no Linux da forja (GNU rm); aqui o rm do BSD não tem --one-file-system
      writeFileSync(join(bin, 'rm'), '#!/bin/bash\nargs=(); for a in "$@"; do [ "$a" = --one-file-system ] || args+=("$a"); done\nexec /bin/rm "${args[@]}"\n'); chmodSync(join(bin, 'rm'), 0o755)
      const sh = join(dir, 'canal.sh')
      writeFileSync(sh, montarComandosDoCanal({ channelRef: REF, prefixos: [prefixos[0]!], raiz: r, geradoEm: new Date() }))
      const x = spawnSync('bash', [sh], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' })
      const resto = existsSync(alvo)
      if (travarRm) chmodSync(join(r.numerico, 'serie/canais'), 0o700)
      return { ...x, resto }
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }
  it('passa por bash -n', () => {
    expect(() => execFileSync('bash', ['-n'], { input: gerar() })).not.toThrow()
  })
  it('com a pasta: apaga e conta 1 removido', () => {
    const r = roda(true)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('1 removido(s), 2 já ausente(s)')
    expect(r.resto).toBe(false)
  })
  it('sem a pasta: não finge que apagou (0 removidos)', () => {
    const r = roda(false)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('0 removido(s), 3 já ausente(s)')
  })
  it('rm que falha: linha FALHOU e saída 6, sem "APAGADO"', () => {
    const r = roda(true, true)
    if (process.getuid?.() === 0) return
    expect(r.status).toBe(6)
    expect(r.stdout).toContain('OBS-ARQUIVO: FALHOU:')
    expect(r.stdout).not.toContain('APAGADO DO NAS')
  })
  it('prefixos repetidos não geram rm duplicado', () => {
    const t = gerar([prefixos[0]!, prefixos[0]!])
    expect(t.split('rm -r').length - 1).toBe(3)
  })
})
