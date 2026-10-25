// @vitest-environment node
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
      expect(t).toContain(`[ ! -d '${d}' ] || rm -r --one-file-system -- '${d}'`)
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
    expect(() => montarComandosDoCanal({ channelRef: REF, prefixos, raiz: { ...raiz, numerico: '/mnt/../x' }, geradoEm })).toThrow('raiz_invalida')
  })
})
