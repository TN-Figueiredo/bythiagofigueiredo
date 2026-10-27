import { describe, it, expect } from 'vitest'
import { lerCampoDeRestauracao, lerRestauracao, truncarErro, paraRestoreStatus, restoreStatusIlegivel, camposDoTeste, SEM_RESPOSTA_MIN, converterInterrompido, MOTIVOS_INTERNOS, CHAMADAS_YOUTUBE } from '@/lib/youtube/ab-restore'

const base = { destino: 'original', forcado: false, escreveu: null, erro: null, attempts: 0 }
const agora = new Date('2026-10-12T08:10:00Z')
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString()

describe('lerCampoDeRestauracao', () => {
  it('4 min: em andamento', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: minutosAtras(4) }, agora).tipo).toBe('em_andamento')
  })
  it('5:00 exato: ainda em andamento (a emenda diz "mais de 5 min")', () => {
    expect(SEM_RESPOSTA_MIN).toBe(5)
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: minutosAtras(5) }, agora).tipo).toBe('em_andamento')
  })
  it('5:01: sem resposta, não interrompido', () => {
    const l = lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: new Date(agora.getTime() - 301_000).toISOString() }, agora)
    expect(l).toMatchObject({ tipo: 'sem_resposta', interrompido: false })
  })
  it('16 min: sem resposta, interrompido (a leitura não muda o estado gravado)', () => {
    const campo = { ...base, estado: 'em_andamento' as const, em: minutosAtras(16) }
    expect(lerCampoDeRestauracao(campo, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: true })
    expect(campo.estado).toBe('em_andamento')
  })
  it('em no futuro (relógio adiantado): em andamento, nunca negativo', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: '2026-10-12T09:00:00Z' }, agora).tipo).toBe('em_andamento')
  })
  it('em ilegível: sem resposta, nunca NaN', () => {
    const l = lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: 'lixo' }, agora)
    expect(l.tipo).toBe('sem_resposta')
    expect(JSON.stringify(l)).not.toMatch(/NaN|Invalid/)
  })
  it('15:00 exato: sem resposta, não interrompido; 15:01: interrompido', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: minutosAtras(15) }, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: false })
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: new Date(agora.getTime() - 901_000).toISOString() }, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: true })
  })
  it('falhou com erro interrompido é lido como sem resposta', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'falhou', erro: 'interrompido', em: minutosAtras(30) }, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: true })
  })
  it('ok, falhou, pulados e desistiu: final', () => {
    for (const estado of ['ok', 'falhou', 'pulado_drift', 'pulado_sem_original', 'desistiu'] as const)
      expect(lerCampoDeRestauracao({ ...base, estado, em: minutosAtras(1) }, agora).tipo).toBe('final')
  })
})

describe('lerRestauracao', () => {
  it('nulo (mundo antigo) → null; {} → {}', () => {
    expect(lerRestauracao(null, agora)).toBeNull()
    expect(lerRestauracao({}, agora)).toEqual({})
  })
  it('title em andamento (4 min) e thumbnail ok: um de cada tipo', () => {
    const r = lerRestauracao({ title: { ...base, estado: 'em_andamento', em: minutosAtras(4) }, thumbnail: { ...base, estado: 'ok', em: minutosAtras(1) } }, agora)
    expect(r?.title?.tipo).toBe('em_andamento')
    expect(r?.thumbnail?.tipo).toBe('final')
  })
})

describe('truncarErro e paraRestoreStatus', () => {
  it('string de 10 000 vira 500', () => { expect((truncarErro('x'.repeat(10_000)) as string).length).toBe(500) })
  it('objeto do YouTube guarda só status e reason', () => {
    expect(truncarErro({ status: 403, reason: 'forbidden', corpo: 'segredo' } as never)).toEqual({ status: 403, reason: 'forbidden' })
  })
  it('jsonb malformado → null, sem lançar; e restoreStatusIlegivel diz true (nulo e {} dizem false)', () => {
    expect(paraRestoreStatus({ title: { estado: 'x' } })).toBeNull()
    expect(restoreStatusIlegivel({ title: { estado: 'x' } })).toBe(true)
    expect(restoreStatusIlegivel(null)).toBe(false); expect(restoreStatusIlegivel({})).toBe(false)
  })
  it('erro com chamada: truncarErro mantém status, reason e chamada (e nada mais)', () => {
    expect(truncarErro({ status: 403, reason: 'forbidden', chamada: 'thumbnails.set', corpo: 'x' } as never)).toEqual({ status: 403, reason: 'forbidden', chamada: 'thumbnails.set' })
    expect(paraRestoreStatus({ title: { estado: 'falhou', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, attempts: 1 } })).toEqual({ title: { estado: 'falhou', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, attempts: 1 } })
  })
  it('corte nunca parte par substituto (emoji na fronteira)', () => {
    const r = truncarErro('a'.repeat(499) + '😀') as string
    expect(r).toBe('a'.repeat(499))
    expect(JSON.stringify(r)).not.toMatch(/\\ud83d/i)
    const o = truncarErro({ status: 1, reason: 'a'.repeat(99) + '😀' }) as { reason: string }
    expect(o.reason).toBe('a'.repeat(99))
    const m = truncarErro({ motivo: 'a'.repeat(99) + '😀' }) as { motivo: string }
    expect(JSON.stringify(m)).not.toMatch(/\\ud83d/i)
  })
  it('reason e motivo acima de 100 viram 100', () => {
    expect((truncarErro({ status: 1, reason: 'r'.repeat(300) }) as { reason: string }).reason.length).toBe(100)
    expect((truncarErro({ motivo: 'm'.repeat(300) }) as { motivo: string }).motivo.length).toBe(100)
  })
  it('ilegível: erro {}, attempts -1 e 1.5, em lixo; legível: sem escreveu/erro vira null', () => {
    const v = { estado: 'falhou', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: false, erro: null, attempts: 1 }
    expect(restoreStatusIlegivel({ title: v })).toBe(false)
    expect(restoreStatusIlegivel({ title: { ...v, erro: {} } })).toBe(true)
    expect(restoreStatusIlegivel({ title: { ...v, attempts: -1 } })).toBe(true)
    expect(restoreStatusIlegivel({ title: { ...v, attempts: 1.5 } })).toBe(true)
    expect(restoreStatusIlegivel({ title: { ...v, em: 'lixo' } })).toBe(true)
    const { escreveu: _e, erro: _r, ...semOpcionais } = v
    expect(paraRestoreStatus({ title: semOpcionais })?.title).toEqual({ ...semOpcionais, escreveu: null, erro: null })
  })
  it('camposDoTeste', () => {
    expect(camposDoTeste('combo')).toEqual(['title', 'thumbnail'])
    expect(camposDoTeste('thumbnail')).toEqual(['thumbnail'])
    expect(camposDoTeste('title')).toEqual(['title'])
  })
})

describe('converterInterrompido', () => {
  const emAnd = (m: number) => ({ ...base, estado: 'em_andamento' as const, em: minutosAtras(m) })
  it('14 min e 15:00 exato: não converte (null)', () => {
    expect(converterInterrompido(emAnd(14), agora)).toBeNull()
    expect(converterInterrompido(emAnd(15), agora)).toBeNull()
  })
  it('16 min: falhou/interrompido, attempts 1, escreveu null, em mantido, sem mutar o original', () => {
    const c = emAnd(16)
    expect(converterInterrompido(c, agora)).toMatchObject({ estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null, em: c.em })
    expect(c.estado).toBe('em_andamento')
  })
  it('em ilegível converte; estado diferente de em_andamento não', () => {
    expect(converterInterrompido({ ...emAnd(1), em: 'lixo' }, agora)?.erro).toBe('interrompido')
    expect(converterInterrompido({ ...base, estado: 'ok', em: minutosAtras(60) }, agora)).toBeNull()
  })
})

describe('constantes', () => {
  it('11 motivos internos, sem repetição, e as chamadas do YouTube', () => {
    expect(MOTIVOS_INTERNOS.length).toBe(11)
    expect(new Set(MOTIVOS_INTERNOS).size).toBe(11)
    expect([...CHAMADAS_YOUTUBE]).toEqual(['videos.list', 'videos.update', 'thumbnails.set', 'blob'])
  })
})

describe('M7b: iniciativa do dono', () => {
  const campo = (iniciativa?: 'dono') => ({ estado: 'falhou' as const, destino: 'vc', em: '2026-10-27T10:00:00.000Z', forcado: false, escreveu: false, erro: null, attempts: 1, ...(iniciativa ? { iniciativa } : {}) })
  it('camposPendentes: o vigia pula o campo da escolha do dono; o humano não', async () => {
    const { camposPendentes, daEscolhaDoDono } = await import('@/lib/youtube/ab-restore')
    const rs = { title: campo('dono'), thumbnail: campo() }
    expect(camposPendentes(rs, 'vigia')).toEqual(['thumbnail'])
    expect(camposPendentes(rs, 'humano')).toEqual(['title', 'thumbnail'])
    expect(daEscolhaDoDono(rs.title)).toBe(true); expect(daEscolhaDoDono(rs.thumbnail)).toBe(false)
  })
  it('paraRestoreStatus preserva a chave iniciativa e descarta valor desconhecido sem invalidar o resto', async () => {
    const { paraRestoreStatus } = await import('@/lib/youtube/ab-restore')
    expect(paraRestoreStatus({ title: campo('dono') })?.title?.iniciativa).toBe('dono')
    const r = paraRestoreStatus({ title: { ...campo(), iniciativa: 'x' } })
    expect(r?.title?.estado).toBe('falhou'); expect(r?.title?.iniciativa).toBeUndefined()
  })
})
