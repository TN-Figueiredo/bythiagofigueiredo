// apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { nomeDoMes, fraseDaFalta, fraseDaSimulacao, fraseDoRetorno, estadoDaLinha, fraseDaLinhaDestacada, fraseDaFalha, fraseDoRetornoDaAcao, FRASE_CODIGO_DESCONHECIDO } from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'
import { CODIGOS_DA_SAIDA, FRASE_CODIGO_DESCONHECIDO as DESCONHECIDO_DO_SAIDA } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { faltaParaLigar, NOTA_DESCARTES } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

const MES = '2027-10-01'
describe('frases da peça 3 (literais do arquivo.js)', () => {
  it('nome do mês', () => { expect(nomeDoMes(MES)).toBe('outubro de 2027') })
  it('T1: cada falta tem a frase do mockup', () => {
    expect(fraseDaFalta({ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 9, dias_dono: null }, { mes: MES, janelaMeses: 6 })).toBe('A forja não confere o B2 há 9 dias.')
    expect(fraseDaFalta({ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: null, dias_dono: 41 }, { mes: MES, janelaMeses: 6 })).toBe('Falta conferir o B2 (última conferência há 41 dias).')
    expect(fraseDaFalta({ codigo: 'nas_sem_atestacao', horas: 30 }, { mes: MES, janelaMeses: 6 })).toBe('Cópia sem verificação há 30 horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.')
    expect(fraseDaFalta({ codigo: 'ainda_na_janela', pode_sair_em: '2028-06-01' }, { mes: MES, janelaMeses: 6 })).toBe('Ainda dentro dos 6 meses: pode sair em 01/06/2028.')
  })
  it('toda falta do catálogo tem frase; código desconhecido tem frase genérica, nunca o código', () => {
    for (const codigo of ['classe_nao_liberada', 'ainda_na_janela', 'nao_selado', 'canal_sem_unidade', 'conteudo_mudou', 'nas_sem_atestacao', 'b2_sem_atestacao',
      'restauracao_vencida', 'esquema_mudou', 'dia_nao_somado', 'marca_pendente', 'marcas_ausentes', 'expurgo_pendente', 'sem_direito', 'interruptor_desligado',
      'outro_site_na_particao', 'saida_fora_de_ordem', 'esquema_divergente', 'fora_do_mes', 'codigo_que_nao_existe']) {
      const t = fraseDaFalta({ codigo, antes: '2027-09-01', pode_sair_em: '2028-06-01' }, { mes: MES, janelaMeses: 6 })
      expect(t, codigo).toMatch(/^[A-ZÀ-Ú]/)
      expect(t, codigo).not.toContain(codigo)
      expect(t, codigo).not.toContain('_')
    }
  })
  it('simulação', () => {
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 1234567, bytes: null, canais: 45, fracao: 0.38, canalSemUnidade: false }, MES))
      .toBe('Se você tirasse outubro de 2027 agora: 45 canais, 1.234.567 registros, 38% do que este tipo de dado ocupa. Contado agora: tudo bate.')
  })
  it('retornos T6, T8r, T8x, T9, T10, T10b, T10c, T10d', () => {
    const c = { mes: MES, doisPassos: true }
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ocupado', faltam: [] }, c).texto).toBe('Ocupado: a coleta está gravando. Tente em alguns minutos.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'conteudo_mudou', faltam: [] }, c).texto).toBe('O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'gatilho_ausente', faltam: [] }, c).texto).toBe('A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; avise quem cuida do site.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: 'ja_descartado', faltam: [], descartadoEm: '2028-05-03T17:32:00Z' }, c).texto).toBe('O espaço deste mês já foi liberado em 03/05/2028.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: null, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo' }] }, c).texto).toBe('A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). O espaço não foi liberado e o mês continua podendo voltar.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: [] }, { ...c, hoje: '2028-05-03' }).texto).toBe('Outubro de 2027 voltou ao banco online em 03/05/2028.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: ['x'] }, { ...c, hoje: '2028-05-03' }).texto).toBe('O mês voltou. A proteção contra remoção durante a saída não está instalada; avise quem cuida do site antes de tirar outro mês.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'orfa_inesperada', faltam: [] }, c).texto).toBe('Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] }, c).texto).toBe('Este mês já saiu das telas.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'esquema_divergente', faltam: [] }, c).texto).toBe('A tabela deste mês mudou de forma desde a cópia: nada foi tirado; o mês será copiado de novo.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'fora_do_mes', faltam: [] }, c).texto).toBe('Não foi possível trazer de volta: há registros fora deste mês. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'somente_leitura' }, c).texto).toBe('O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.')
  })
  it('linha destacada: m8 antes da data, m8a no dia, m8b depois de 15 dias; T9 descartado', () => {
    const base = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: '2028-05-02T15:00:00Z', liberar_a_partir: '2028-05-09' }
    expect(estadoDaLinha(base, '2028-05-05')).toBe('T7')
    expect(fraseDaLinhaDestacada(base, '2028-05-05', 4)).toBe('Saiu das telas em 02/05/2028. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de 09/05/2028 você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo. Liberar o espaço devolve cerca de 4% do banco.')
    expect(estadoDaLinha(base, '2028-05-09')).toBe('T7a')
    expect(estadoDaLinha(base, '2028-05-18')).toBe('T7b')
    expect(fraseDaLinhaDestacada(base, '2028-05-18', 4)).toMatch(/^Saiu das telas há 16 dias e o espaço ainda não foi liberado\./)
    expect(estadoDaLinha({ ...base, estado: 'descartado', descartado_em: '2028-05-03T17:32:00Z' }, '2028-05-20')).toBe('T9')
  })
})

describe('T12: causa, não medido, código sem frase, descartes (Hanna, Phil, Yannis)', () => {
  const c = { mes: MES, doisPassos: true }
  it('toda causa de falha tem frase própria por ação, vinda da causa (não só do error)', () => {
    expect(fraseDoRetorno('liberar', { tipo: 'falhou', causa: 'prazo' }, c).texto).toBe('Não foi possível confirmar se o espaço foi liberado. Recarregue a página antes de tentar de novo.')
    expect(fraseDoRetorno('trazer', { tipo: 'falhou', causa: 'tempo_no_banco' }, c).texto).toBe('O banco não terminou a tempo. Nada foi trazido; tente de novo em alguns minutos.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'sem_tempo' }, c).texto).toBe('Faltou tempo nesta página para chamar o banco. Nada foi tirado; clique de novo.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'forma' }, c).texto).toBe('Não foi possível ler o estado deste mês. Nada foi tirado.')
    expect(fraseDaFalha('banco', 'liberar')).toBe('Não foi possível ler o estado deste mês. Nada foi liberado.')
  })
  it('a retorno da ação (ok:false) usa a causa; sem causa usa o error; ok:true usa a resposta', () => {
    expect(fraseDoRetornoDaAcao('tirar', { ok: false, error: 'qualquer', causa: 'prazo' }, c).texto).toMatch(/^Não foi possível confirmar se o mês saiu/)
    expect(fraseDoRetornoDaAcao('tirar', { ok: false, error: 'Só quem administra o site pode tirar um mês do banco online.' }, c))
      .toEqual({ tom: 'erro', texto: 'Só quem administra o site pode tirar um mês do banco online.' })
    expect(fraseDoRetornoDaAcao('tirar', { ok: true, resposta: { tipo: 'recusado', codigo: 'ocupado', faltam: [] } }, c).texto).toBe('Ocupado: a coleta está gravando. Tente em alguns minutos.')
  })
  it('conferência parcial: mostra quantos canais faltam quando o número vem; sem número, a frase de sempre', () => {
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial', restantes: 12 }, c).texto).toBe('A conferência dos canais passou do tempo desta página. Nada foi tirado; faltam 12 canais; clique de novo para continuar de onde parou.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial', restantes: 1 }, c).texto).toContain('falta 1 canal; clique de novo')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial' }, c).texto).toBe('A conferência dos canais passou do tempo desta página. Nada foi tirado; clique de novo para continuar de onde parou.')
  })
  it('linhas nulas aparecem como "não medido", nunca 0', () => {
    const t = fraseDaSimulacao({ tipo: 'simulado', linhas: null, bytes: null, canais: 45, fracao: 0.38, canalSemUnidade: false }, MES)
    expect(t).toBe('Se você tirasse outubro de 2027 agora: 45 canais, registros: não medido, 38% do que este tipo de dado ocupa. Contado agora: tudo bate.')
    expect(t).not.toMatch(/\b0 registros/)
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 0, bytes: null, canais: 0, fracao: 0, canalSemUnidade: false }, MES)).toContain('0 registros')
  })
  it('particao_ausente tem frase própria, em qualquer ação, sem a genérica', () => {
    for (const op of ['tirar', 'liberar', 'trazer'] as const) {
      const t = fraseDoRetorno(op, { tipo: 'recusado', codigo: 'particao_ausente', faltam: [] }, c).texto
      expect(t).toBe('A tabela deste mês não existe mais no banco online. Nada foi alterado; recarregue a página para ver o estado.')
    }
  })
  it('lista fechada de códigos x frases: código sem frase própria derruba o teste', () => {
    const GENERICAS = [FRASE_CODIGO_DESCONHECIDO, 'O banco recusou; nada mudou. Avise quem cuida do site.']
    const vistas = new Map<string, string>()
    for (const codigo of CODIGOS_DA_SAIDA) for (const op of ['tirar', 'liberar', 'trazer'] as const) {
      const t = fraseDoRetorno(op, { tipo: 'recusado', codigo, faltam: [], descartadoEm: '2028-05-03T17:32:00Z', liberarAPartir: '2028-06-01' }, c).texto
      const rotulo = `${codigo}/${op}`
      expect(t, rotulo).toMatch(/^[A-ZÀ-Ú]/)
      expect(GENERICAS.some(g => t.startsWith(g.slice(0, 30))), rotulo).toBe(false)
      expect(t, rotulo).not.toContain(codigo)
      expect(t, rotulo).not.toContain('_')
      expect(t, rotulo).not.toContain('undefined')
      vistas.set(rotulo, t)
    }
    expect(vistas.size).toBe(CODIGOS_DA_SAIDA.length * 3)
    // fora da lista: a frase de desconhecido, com o verbo da ação, sem o código
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'desconhecido', faltam: [] }, c).texto).toBe(FRASE_CODIGO_DESCONHECIDO)
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: 'desconhecido', faltam: [] }, c).texto).toContain('nada foi liberado')
    expect(FRASE_CODIGO_DESCONHECIDO).toBe(DESCONHECIDO_DO_SAIDA)
  })
  it('Hanna: nenhuma frase diz "descartes" sem "à mão" e "nesta classe"', () => {
    const todas = [NOTA_DESCARTES, faltaParaLigar(1, 0), faltaParaLigar(3, 2)]
    expect(NOTA_DESCARTES).toContain('descartes feitos à mão nesta classe')
    for (const t of todas) if (/descarte/i.test(t)) { expect(t).toContain('à mão'); expect(t).toContain('nesta classe') }
  })
})
