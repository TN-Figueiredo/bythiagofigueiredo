// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarAvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'
import { casaDe } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { caso } from './fixtures/aviso-v2-casos'

const a = (id: string) => montarAvisoV2(caso(id))

describe('aviso do banco 18-v2: estados V', () => {
  it('V0: antes da 1ª cópia é pontilhado com a data', () => {
    const l = a('v0').linhaDaCopia
    expect(l.forma).toBe('pontilhado')
    expect(l.texto).toContain('A primeira cópia é a de outubro, a partir de 28/11')
    const c = caso('v0')
    expect(montarAvisoV2({ ...c, leve: { ...c.leve!, primeira_devida_mes: null } }).linhaDaCopia.texto).toContain('Ainda não há cópia.')
    expect(a('v0').regua).toBeNull()
  })
  it('V1: com folga, cópia em dia (visto), sem régua nem chega a', () => {
    const x = a('v1')
    expect(x.pastilha).toMatchObject({ cor: 'neutra', pct: 43, texto: 'Com folga' })
    expect(x.linhaDaCopia).toMatchObject({ forma: 'visto', portaArquivo: false })
    expect(x.barra.chegaAPct).toBeNull()
    expect(x.oQueLibera).toBeNull()
    expect(x.casa).toBeNull()
  })
  it('V1a 12 dias: triângulo, porta para o Arquivo; 34 dias: octógono', () => {
    expect(a('v1a').linhaDaCopia).toMatchObject({ forma: 'triangulo', portaArquivo: true })
    expect(a('v1a').linhaDaCopia.texto).toBe('A cópia de janeiro está atrasada há 12 dias.')  // o mês vem do atraso_mes do banco, nunca de mais_antiga - 28 (Phil I4)
    expect(a('v1b').linhaDaCopia).toMatchObject({ forma: 'octogono', portaArquivo: true })
  })
  it('Phil I4: com margem de 45 dias a frase nomeia o mês do banco, não a data menos 28 dias', () => {
    const c = caso('v1a')
    const leve = { ...c.leve!, atraso: { ...c.leve!.atraso, mais_antiga: '2026-12-14' }, atraso_mes: '2026-10-01', hoje: '2026-12-20' }
    expect(montarAvisoV2({ ...c, leve }).linhaDaCopia.texto).toBe('A cópia de outubro está atrasada há 6 dias.')
    const semMes = { ...c.leve!, atraso_mes: null }
    expect(montarAvisoV2({ ...c, leve: semMes }).linhaDaCopia.texto).toBe('Há cópia atrasada.')
  })
  it('V1n: cópia não medida é hachura, nunca visto, e a régua não desenha o traço da saída', () => {
    expect(a('v1n').linhaDaCopia.forma).toBe('hachura')
    expect(a('v1n').regua).toBeNull()
  })
  it('V2: 66% hoje e chega a 78% antes da próxima saída → pastilha âmbar, barra na cor de hoje, sem "pico"', () => {
    const x = a('v2')
    expect(x.pastilha.cor).toBe('ambar')
    expect(x.barra).toMatchObject({ hojePct: 66, chegaAPct: 78, rotuloChegaA: 'chega a 78% antes da próxima saída' })
    expect(JSON.stringify(x)).not.toMatch(/pico/i)
  })
  it('V3: 74% sem próxima saída conhecida → âmbar, sem "chega a"', () => {
    expect(a('v3').pastilha).toMatchObject({ cor: 'ambar', pct: 74 })
    expect(a('v3').barra.chegaAPct).toBeNull()
  })
  it('V4: o losango vem antes do traço → "O alívio chega depois do aperto: 20 dias"; pastilha vermelha pelo que chega a 89%', () => {
    const x = a('v4')
    expect(x.pastilha.cor).toBe('vermelho')
    expect(x.barra).toMatchObject({ hojePct: 72, chegaAPct: 89 })
    expect(x.regua?.alivioDepoisDoAperto).toBe(true)
    expect(x.regua?.frase).toContain('O alívio chega depois do aperto: 20 dias')
    expect(x.regua!.losango85!).toBeLessThan(x.regua!.tracoProximaSaida!)
  })
  it('V5: com 85%+, o que libera nunca fala em plano pago', () => {
    const x = a('v5')
    expect(x.oQueLibera).not.toBeNull()
    expect(x.oQueLibera!.join(' ')).not.toMatch(/plano pago|upgrade|Pro\b/i)
    expect(x.pastilha.cor).toBe('vermelho')
  })
  it('V8 64 h: casa fora com octógono e três itens em "O que fazer"', () => {
    const x = a('v8')
    expect(x.casa).toMatchObject({ forma: 'octogono' })
    expect(x.casa!.oQueFazer).toHaveLength(3)
    expect(x.casa!.oQueFazer[2]).toContain('pause a coleta')
    expect(x.linhaDaCopia.texto).toContain('A próxima espera a casa.')
  })
  it('V8 curta (abaixo de 36 h): triângulo; o copiador há 20,5 h já é triângulo (mockup pc1), há 12 h responde', () => {
    expect(a('v8curta').casa?.forma).toBe('triangulo')
    const agora = Date.parse('2024-02-20T15:00:00Z')
    const antes = (h: number) => new Date(agora - h * 3_600_000).toISOString()
    const cop = (h: number) => ({ worker: 'copiador', last_poll_at: antes(h), updated_at: antes(h), nas_ok: true, nas_checked_at: antes(1) })
    expect(casaDe([cop(20.5)], [], agora)).toMatchObject({ estado: 'nao_respondeu', forma: 'triangulo' })
    expect(casaDe([cop(12)], [], agora).estado).not.toBe('nao_respondeu')
  })
  it('M-6 (Yannis): âmbar só pela projeção, pausa inexistente, data da última cópia ilegível e sem régua por falta de ritmo', () => {
    const c = caso('v2')
    // ritmo de crescimento nulo: sem "chega a" e sem régua
    const semRitmo = montarAvisoV2({ ...c, aviso: { banco: { valor: { ...(c.aviso.banco as { valor: never }).valor, tela: { ...(c.aviso.banco as { valor: { tela: { mb: object } } }).valor.tela, mb: { ...(c.aviso.banco as { valor: { tela: { mb: object } } }).valor.tela.mb, porDia: null } } } as never } } })
    expect(semRitmo.barra.chegaAPct).toBeNull()
    expect(semRitmo.regua).toMatchObject({ losango85: null })
    // pastilha neutra que a projeção torna âmbar
    expect(a('v2').pastilha).toMatchObject({ cor: 'ambar', texto: 'Enchendo' })
    expect(a('v8a').casa!.oQueFazer[2]).toBe('A pausa da coleta de canais ainda não existe.')
    const v1 = caso('v1')
    expect(montarAvisoV2({ ...v1, leve: { ...v1.leve!, ultima_copia: 'não é data' } }).linhaDaCopia.texto).toContain('data ilegível')
  })
  it('V8a: sem o comando pausar o 3º item diz que a pausa ainda não existe', () => {
    expect(a('v8a').casa!.oQueFazer[2]).toBe('A pausa da coleta de canais ainda não existe.')
  })
  it('V8b: NAS fora; V8c: NAS cheio, com "O que fazer"', () => {
    expect(a('v8b').casa?.oQueFazer[0]).toContain('pasta do arquivo está montada')
    expect(a('v8c').casa?.oQueFazer[0]).toContain('Libere espaço no NAS')
    expect(a('v8b').linhaDaCopia.texto).toContain('A próxima espera o NAS.')
  })
  it('V9: sem leitura hoje → sem número na pastilha, cor nunca verde, última medida na barra', () => {
    const x = a('v9')
    expect(x.pastilha).toMatchObject({ pct: null, texto: 'Sem leitura hoje' })
    expect(x.pastilha.cor).not.toBe('neutra')
    expect(x.barra.hojePct).toBe(43)
  })
  it('V10: séries sem medida → pastilha não medido, sem número', () => {
    expect(a('v10').pastilha).toMatchObject({ cor: 'nao_medido', pct: null })
    expect(a('v10').barra.hojePct).toBeNull()
    expect(a('v10').linhaDaCopia.forma).toBe('hachura')
  })
  it('V12: a marca dos canais removidos vem do argumento (12, 34 e 64 dias → forma)', () => {
    expect(a('v12a').marcas.canaisRemovidos).toEqual({ n: 2, forma: 'arquivo' })
    expect(a('v12b').marcas.canaisRemovidos).toEqual({ n: 2, forma: 'triangulo' })
    expect(a('v12c').marcas.canaisRemovidos).toEqual({ n: 1, forma: 'octogono' })
    expect(a('v12a').marcas.automatico).toBeNull()
  })
  it('V12n: sem o comando de limpeza a marca não é desenhada', () => {
    expect(a('v12n').marcas.canaisRemovidos).toBeNull()
  })
  it('nenhum estado diz "pico" nem fala em plano pago', () => {
    for (const id of ['v0', 'v1', 'v1a', 'v1b', 'v1n', 'v2', 'v3', 'v4', 'v5', 'v8', 'v8a', 'v8b', 'v8c', 'v9', 'v10']) expect(JSON.stringify(a(id))).not.toMatch(/pico|plano pago|upgrade/i)
  })
})
