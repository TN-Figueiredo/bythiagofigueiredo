// @vitest-environment node
// Manutenção M5, conserto r3 (27/10): Logan A1/A2/A3/A4, Naksu N1. Frases e contagens do modelo da página Arquivo.
import { describe, it, expect } from 'vitest'
import { montarPagina, casaVenceOTopo, ancoraDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { descreverVermelho } from '@/lib/youtube/observatorio/arquivo-mensal/vermelhos'
import { paginaVazia, mesCom, AGORA } from '../youtube/observatorio/fixtures/arquivo-pagina'

const liga = { arquivoLigado: true }
const vermelho = () => mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 3 })
const casaVelha = (h: number) => { const t = new Date(AGORA - h * 3_600_000).toISOString(); return [{ ...paginaVazia().casa[0]!, last_poll_at: t, updated_at: t }] }

describe('A1: a frase do topo nomeia o mês e linka', () => {
  it('1 mês vermelho: a frase diz qual e leva à linha pelo id', () => {
    const p = montarPagina(paginaVazia({ meses: [vermelho()] }), liga)
    const l = p.tipos[0]!.linhas[0]!
    expect(p.resumo.forma).toBe('octogono')
    expect(p.resumo.texto).toBe(`1 mês precisa de você; o mais urgente: Views por dia, ${l.mesNome}: ver a cópia atrasada.`)
    expect(p.resumo.partes).toContainEqual({ texto: `Views por dia, ${l.mesNome}: ver a cópia atrasada`, ancora: ancoraDoMes(l.chave) })
  })
  it('a âncora é um id estável (tipo e mês), sem dois-pontos', () => { expect(ancoraDoMes('serie:2027-11-01')).toBe('mes-serie-2027-11-01') })
  it('vazio com o pulso em vermelho de mês (495 arquivos): não soma de novo e não diz "52 problemas"', () => {
    const p = montarPagina(paginaVazia({ vermelhos: ['atraso de cópia: 495 arquivos', 'mês sem selo há mais de 30 dias: 2'] }), liga)
    expect(p.resumo.texto).toBe('1 outro problema abaixo.')
    expect(p.resumo.texto).not.toMatch(/495|52/)
  })
  it('canais sem destino contam como canais, não como "problemas"', () => {
    const p = montarPagina(paginaVazia({ vermelhos: ['3 canais removidos sem destino do arquivo'] }), liga)
    expect(p.resumo.texto).toBe('3 canais removidos estão sem destino do arquivo (ver).')
    expect(p.resumo.partes).toContainEqual({ texto: 'ver', ancora: 'canais-removidos' })
  })
  it('mês vermelho + canal + outro + triângulo: as partes na ordem do Logan', () => {
    const p = montarPagina(paginaVazia({ meses: [vermelho()], vermelhos: ['1 canais removidos sem destino do arquivo', 'xyz:1', 'b2_piso_acima_do_teto'] }), liga)
    expect(p.resumo.texto).toMatch(/^1 mês precisa de você; o mais urgente: .+\. 1 canal removido está sem destino do arquivo \(ver\)\. 1 outro problema abaixo\. 1 ponto de atenção\.$/)
  })
  it('só triângulos: "pontos de atenção", forma triângulo', () => {
    const p = montarPagina(paginaVazia({ vermelhos: ['b2_piso_acima_do_teto'] }), liga)
    expect(p.resumo).toMatchObject({ texto: 'O arquivo tem 1 ponto de atenção', forma: 'triangulo' })
  })
})

describe('A1c: a regra do cabeçalho (casa x forma mais grave), num lugar só', () => {
  it('a função: octógono vence triângulo; empate vence a casa; sem problema a casa vence', () => {
    expect(casaVenceOTopo('triangulo', 'octogono')).toBe(false)
    expect(casaVenceOTopo('octogono', 'octogono')).toBe(true)
    expect(casaVenceOTopo('octogono', 'triangulo')).toBe(true)
    expect(casaVenceOTopo('triangulo', 'triangulo')).toBe(true)
    expect(casaVenceOTopo('triangulo', null)).toBe(true)
  })
  it('casa a 64 h (octógono) + mês vermelho: a casa é o título e o problema desce em "alem", nunca some', () => {
    const p = montarPagina(paginaVazia({ casa: casaVelha(64), meses: [vermelho()] }), liga)
    expect(p.resumo.texto).toBe(p.casa.frase)
    expect(p.alem?.texto).toMatch(/^1 mês precisa de você/)
    expect(p.alem?.forma).toBe('octogono')
  })
  it('casa a 20 h (triângulo) + mês vermelho: o problema é o título; a casa fica na linha da casa', () => {
    const p = montarPagina(paginaVazia({ casa: casaVelha(20), meses: [vermelho()] }), liga)
    expect(p.resumo.texto).toMatch(/^1 mês precisa de você/)
    expect(p.alem).toBeNull()
    expect(p.casa.estado).toBe('nao_respondeu')
  })
  it('casa a 64 h sem problema algum: sem "alem"', () => {
    expect(montarPagina(paginaVazia({ casa: casaVelha(64) }), liga).alem).toBeNull()
  })
})

describe('A2 / N1: meses arquivados só dentro do ano', () => {
  it('o mês arquivado e conferido não vira linha; entra no ano com o nome e a data da verificação', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ descartadoHa: 60, nasHorasAtras: 5, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 })] }), liga)
    const t = p.tipos[0]!
    expect(t.linhas).toHaveLength(1)
    expect(t.anosNoArquivo[0]).toMatchObject({ ano: 2027, meses: 1, todosConferidos: true, semConferencia: 0 })
    expect(t.anosNoArquivo[0]!.itens![0]!.mesNome).toBe('outubro de 2027')
    expect(t.anosNoArquivo[0]!.itens![0]!.verificadoEm).not.toBeNull()
  })
  it('mês arquivado sem verificação há 46 dias continua como linha vermelha (sobe)', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ descartadoHa: 90, nasHorasAtras: 46 * 24, mesNum: 2 })] }), liga)
    expect(p.tipos[0]!.linhas).toHaveLength(1)
    expect(p.tipos[0]!.linhas[0]!.gravidade).toBe('vermelho')
    expect(p.resumo.texto).toContain('religar a casa')
  })
  it('as linhas vão do mais antigo ao corrente', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3, mesNum: 3 }), mesCom({ nasHorasAtras: 3, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 })] }), liga)
    expect(p.tipos[0]!.linhas.map(l => l.mesNome)).toEqual(['outubro de 2027', 'novembro de 2027', 'dezembro de 2027'])
  })
  it('o resumo do cartão diz o próximo a sair, com o mês e a data', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 })] }), liga)
    expect(p.tipos[0]!.resumo).toMatch(/^2 meses online, 0 no arquivo\. Outubro de 2027 pode sair (agora|em \d\d\/\d\d\/\d{4})\.$/)
  })
  it('a contagem do cartão não conta o mês arquivado duas vezes', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ descartadoHa: 60, nasHorasAtras: 5, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 })] }), liga)
    expect(p.tipos[0]!.resumo).toMatch(/^1 mês online, 1 no arquivo/)
  })
})

describe('A3: o ⓘ "Por que se espera" no mês fechado', () => {
  it('a linha "Fechado. Cópia a partir de" traz o texto com a margem da classe, não fixa', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ mes: 'fechado_ha', dias: 10 })] }), liga)
    const l = p.tipos[0]!.linhas[0]!
    const margem = p.tipos.length ? paginaVazia().classes.find(k => k.class === 'serie')!.seal_margin_days : 0
    expect(l.info).toBe(`A cópia espera o mês parar de mudar (${margem} dias depois de fechar), para não precisar ser refeita.`)
  })
  it('as outras linhas não têm ⓘ', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 })] }), liga)
    expect(p.tipos[0]!.linhas[0]!.info ?? null).toBeNull()
  })
})

describe('A4: as frases do pulso (sem plural em parêntese, com o mês e o que fazer)', () => {
  const f = (v: string) => descreverVermelho(v).frase
  it('canais removidos: singular e plural reais', () => {
    expect(f('1 canais removidos sem destino do arquivo')).toBe('1 canal removido está sem destino do arquivo.')
    expect(f('2 canais removidos sem destino do arquivo')).toBe('2 canais removidos estão sem destino do arquivo.')
  })
  it('mês sem selo: lê o número do fim, não o "30"', () => {
    expect(f('mês sem selo há mais de 30 dias: 1')).toBe('Um mês está sem a cópia concluída há mais de 30 dias.')
    expect(f('mês sem selo há mais de 30 dias: 3')).toBe('3 meses estão sem a cópia concluída há mais de 30 dias.')
  })
  it('atraso de cópia sem a contagem de arquivos', () => { expect(f('atraso de cópia: 495 arquivos')).toBe('Há cópia atrasada há mais de 30 dias. Veja os meses marcados.') })
  it('b2_atrasado, descartado sem releitura, recusa, canário e vigia dizem o que fazer ou o que não se perde', () => {
    expect(f('b2_atrasado')).toMatch(/Nada se perde: a cópia do NAS continua\. Veja a linha marcada\.$/)
    expect(f('mês descartado sem releitura')).toMatch(/veja se ela responde\.$/)
    expect(f('B2 recusou o fileId x')).toMatch(/Nada sai desse mês até uma conferência boa\.$/)
    expect(f('canário do filho numerico')).toBe('A cópia de teste diária não chega ao B2 há 5 dias ou mais: as cópias novas podem não estar chegando.')
    expect(f('vigia da remoção: consulta 3 com 1')).toBe('A conferência da remoção de canais achou uma diferença. Não remova outro canal até ela passar.')
  })
  it('base ausente: o nome da tela, nunca o interno', () => {
    expect(f('tabela_ausente:competitor_video_early')).toBe('Falta no banco o lugar dos dados de Primeiras horas, que o arquivo copia. Nada desse tipo sai até ele voltar.')
  })
  it('nenhuma frase tem "(is)", "(s)" ou "(es)"', () => {
    for (const v of ['1 canais removidos sem destino do arquivo', 'mês sem selo há mais de 30 dias: 2', 'atraso de cópia: 3', 'NAS: x', 'B2: x', 'b2_atrasado', 'xyz:1', 'nas_80:x'])
      expect(f(v)).not.toMatch(/\((is|s|es)\)/)
  })
})
