// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { CODIGO_RE, MOTIVOS_COMUNS, codigoDoMotivo, fraseDoMotivo, resumoTecnico } from '@/lib/youtube/agenda/motivos'
import { DEFINICOES } from '@/lib/youtube/agenda/catalogo'

const horaria = DEFINICOES.find(d => d.nome === 'leitura_horaria')!
const base = { rotulo: 'tarefa de teste', motivos: { sobrou: 'ficaram vídeos', outra: 'outra coisa' } }

describe('motivos', () => {
  it('todo código de motivo tem o formato do banco e frase sem dado de fora', () => {
    const todos: Array<[string, string]> = [
      ...Object.entries(MOTIVOS_COMUNS),
      ...DEFINICOES.flatMap(d => Object.entries(d.motivos)),
    ]
    expect(todos.length).toBeGreaterThan(20)
    for (const [codigo, frase] of todos) {
      expect(CODIGO_RE.test(codigo), codigo).toBe(true)
      expect(frase.length, codigo).toBeGreaterThan(0)
      expect(/[${}%]/.test(frase), `${codigo}: ${frase}`).toBe(false)
      expect(frase.endsWith('.'), codigo).toBe(false)
    }
  })

  it('os três catálogos têm exatamente os códigos do plano', () => {
    const de = (n: string) => Object.keys(DEFINICOES.find(d => d.nome === n)!.motivos).sort()
    expect(de('leitura_horaria')).toEqual(['api_falhou', 'cota_esgotada', 'curva_falhou', 'gravacao_falhou', 'gravacao_sem_tempo', 'ja_lidos_falhou', 'lista_cortada', 'lista_falhou', 'resposta_vazia', 'sobrou'])
    expect(de('sincronizar_canais')).toEqual(['lote_em_erro', 'sobrou'])
    expect(de('serie_semanal')).toEqual(['canais_nao_lidos', 'semanal_com_erros', 'semanal_erro', 'sobrou'])
  })

  it('frase do motivo: conhecido, comum, desconhecido e nulo', () => {
    expect(fraseDoMotivo(horaria, 'cota_esgotada')).toBe('leitura horária: cota do YouTube esgotada')
    expect(fraseDoMotivo(horaria, 'passou_do_tempo')).toBe(`leitura horária: ${MOTIVOS_COMUNS.passou_do_tempo}`)
    const desc = `leitura horária: ${MOTIVOS_COMUNS.motivo_desconhecido}`
    expect(fraseDoMotivo(horaria, 'nao_existe')).toBe(desc)
    expect(fraseDoMotivo(horaria, null)).toBe(desc)
    expect(fraseDoMotivo(horaria, undefined)).toBe(desc)
  })

  it('código fora do catálogo vira frase fixa de "desconhecido", nunca undefined nem o texto cru', () => {
    for (const cru of ['Failing row contains (x)', 'outro_codigo', '', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const f = fraseDoMotivo(base, cru)
      expect(typeof f).toBe('string')
      expect(f).toBe(`tarefa de teste: ${MOTIVOS_COMUNS.motivo_desconhecido}`)
      expect(f).not.toContain(cru === '' ? '\u0000' : cru)
    }
  })

  it('código fora do catálogo vira motivo_desconhecido', () => {
    expect(codigoDoMotivo(base, 'Failing row contains (x)')).toBe('motivo_desconhecido')
    expect(codigoDoMotivo(base, 'outro_codigo')).toBe('motivo_desconhecido')
    expect(codigoDoMotivo(base, undefined)).toBe('motivo_desconhecido')
    expect(codigoDoMotivo(base, '__proto__')).toBe('motivo_desconhecido')
    expect(codigoDoMotivo(base, 'sobrou')).toBe('sobrou')
    expect(codigoDoMotivo(base, 'excecao')).toBe('excecao')
  })

  it('a frase com números vem de fraseDe, a partir do detalhe', () => {
    const t = { ...base, fraseDe: (c: string, n: Readonly<Record<string, number>>) => c === 'sobrou' ? 'ficaram ' + n.ficaram + ' retratos' : undefined }
    expect(fraseDoMotivo(t, 'sobrou', { ficaram: 7 })).toBe('tarefa de teste: ficaram 7 retratos')
    // outro código: fraseDe devolve undefined, vale a fixa
    expect(fraseDoMotivo(t, 'outra', { ficaram: 7 })).toBe('tarefa de teste: outra coisa')
    // sem detalhe: a fixa
    expect(fraseDoMotivo(t, 'sobrou')).toBe('tarefa de teste: ficaram vídeos')
  })

  it('fraseDe que devolve vazio, lança ou devolve texto longo cai na frase fixa ou é cortada', () => {
    const vazio = { ...base, fraseDe: () => '' }
    const lanca = { ...base, fraseDe: () => { throw new Error('boom') } }
    const longo = { ...base, fraseDe: () => 'x'.repeat(300) }
    expect(fraseDoMotivo(vazio, 'sobrou', { a: 1 })).toBe('tarefa de teste: ficaram vídeos')
    expect(fraseDoMotivo(lanca, 'sobrou', { a: 1 })).toBe('tarefa de teste: ficaram vídeos')
    const f = fraseDoMotivo(longo, 'sobrou', { a: 1 })
    expect(f).toBe('tarefa de teste: ' + 'x'.repeat(160))
  })

  it('fraseDe não é chamada para código fora do catálogo da tarefa', () => {
    const fraseDe = vi.fn(() => 'texto de fora')
    expect(fraseDoMotivo({ ...base, fraseDe }, 'Failing row', { a: 1 })).toBe(`tarefa de teste: ${MOTIVOS_COMUNS.motivo_desconhecido}`)
    expect(fraseDe).not.toHaveBeenCalled()
  })

  it('fraseDe só recebe números', () => {
    const fraseDe = vi.fn((_c: string, _n: Readonly<Record<string, number>>) => 'ok')
    fraseDoMotivo({ ...base, fraseDe }, 'sobrou', { a: 1, b: Number.NaN, c: 'x' as never, d: Infinity })
    expect(fraseDe).toHaveBeenCalledWith('sobrou', { a: 1 })
  })

  it('resumo técnico não leva a mensagem', () => {
    const e = Object.assign(new Error('Key (author_channel_id)=(UCsentinela)'), { code: '23505' })
    const r = resumoTecnico(e)
    expect(r).toEqual({ classe: 'Error', sqlstate: '23505' })
    expect(JSON.stringify(r)).not.toContain('sentinela')
  })

  it('resumo técnico: sem código, código que não é de 5 caracteres, classe estranha e não-erro', () => {
    expect(resumoTecnico(new TypeError('x'))).toEqual({ classe: 'TypeError', sqlstate: null })
    expect(resumoTecnico(Object.assign(new Error('x'), { code: 'ECONNRESET with sentinela' }))).toEqual({ classe: 'Error', sqlstate: null })
    const estranha = Object.assign(new Error('x'), { name: 'UCsentinela: texto livre com espaço' })
    expect(JSON.stringify(resumoTecnico(estranha))).not.toContain('sentinela')
    for (const v of ['texto sentinela', null, undefined, 42, { message: 'sentinela', code: '23505' }]) {
      const r = resumoTecnico(v)
      expect(JSON.stringify(r)).not.toContain('sentinela')
      expect(typeof r.classe).toBe('string')
    }
  })
})
