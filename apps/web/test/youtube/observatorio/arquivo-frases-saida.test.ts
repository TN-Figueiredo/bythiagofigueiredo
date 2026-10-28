// apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { nomeDoMes, fraseDaFalta, fraseDaSimulacao, fraseDoRetorno, estadoDaLinha, fraseDaLinhaDestacada, fraseDaFalha, fraseDoRetornoDaAcao, FRASE_CODIGO_DESCONHECIDO, fraseDaLinhaDescartada, ddmmaaaa } from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'
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
      const semCodigo = t.replace(/ \(código: [a-z_]+\)/, '')   // o código só aparece na marca discreta "(código: x)" (Logan U1)
      expect(semCodigo, codigo).not.toContain(codigo)
      expect(semCodigo, codigo).not.toContain('_')
    }
  })
  it('simulação', () => {
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 1234567, bytes: null, canais: 45, fracao: 0.38, canalSemUnidade: false }, MES))
      .toBe('Se você apagasse outubro de 2027 do banco agora: 45 canais, 1.234.567 registros, 38% do que este tipo de dado ocupa. Contado agora: tudo bate.')
  })
  it('retornos T6, T8r, T8x, T9, T10, T10b, T10c, T10d', () => {
    const c = { mes: MES, doisPassos: true }
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ocupado', faltam: [] }, c).texto).toBe('Ocupado: a coleta está gravando. Tente em alguns minutos.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'conteudo_mudou', faltam: [] }, c).texto).toBe('O dado mudou desde a cópia: nada foi escondido; o mês será copiado de novo.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'gatilho_ausente', faltam: [] }, c).texto).toBe('A proteção contra remoção durante a saída não está instalada: nada foi escondido. É defeito de instalação; avise quem cuida do site.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: 'ja_descartado', faltam: [], descartadoEm: '2028-05-03T17:32:00Z' }, c).texto).toBe('Este mês já foi apagado do banco em 03/05/2028.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: null, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo' }] }, c).texto).toBe('A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). Nada foi apagado do banco e o mês continua podendo voltar às telas.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: [] }, { ...c, hoje: '2028-05-03' }).texto).toBe('Outubro de 2027 aparece de novo nas telas.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: ['x'] }, { ...c, hoje: '2028-05-03' }).texto).toBe('O mês voltou às telas. A proteção contra remoção durante a saída não está instalada; avise quem cuida do site antes de esconder outro mês.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'orfa_inesperada', faltam: [] }, c).texto).toBe('Não foi possível mostrar de novo: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] }, c).texto).toBe('Este mês já saiu das telas.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'esquema_divergente', faltam: [] }, c).texto).toBe('A tabela deste mês mudou de forma desde a cópia: nada foi escondido; o mês será copiado de novo.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'fora_do_mes', faltam: [] }, c).texto).toBe('Não foi possível mostrar de novo: há registros fora deste mês. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'somente_leitura' }, c).texto).toBe('O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.')
  })
  it('linha destacada: m8 antes da data, m8a no dia, m8b depois de 15 dias; T9 descartado', () => {
    const base = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: '2028-05-02T15:00:00Z', liberar_a_partir: '2028-05-09' }
    expect(estadoDaLinha(base, '2028-05-05')).toBe('T7')
    expect(fraseDaLinhaDestacada(base, '2028-05-05', 4)).toBe('Escondido das telas em 02/05/2028. Você pode mostrar de novo até apagar do banco. A partir de 09/05/2028 dá para apagar do banco. Até lá não dá para remover canal nem apagar vídeo. Apagar do banco devolve cerca de 4% do banco.')
    expect(estadoDaLinha(base, '2028-05-09')).toBe('T7a')
    expect(estadoDaLinha(base, '2028-05-18')).toBe('T7b')
    expect(fraseDaLinhaDestacada(base, '2028-05-18', 4)).toMatch(/^Escondido das telas há 16 dias e ainda não apagado do banco\./)
    expect(estadoDaLinha({ ...base, estado: 'descartado', descartado_em: '2028-05-03T17:32:00Z' }, '2028-05-20')).toBe('T9')
  })
})

describe('T12: causa, não medido, código sem frase, descartes (Hanna, Phil, Yannis)', () => {
  const c = { mes: MES, doisPassos: true }
  it('toda causa de falha tem frase própria por ação, vinda da causa (não só do error)', () => {
    expect(fraseDoRetorno('liberar', { tipo: 'falhou', causa: 'prazo' }, c).texto).toBe('Não foi possível confirmar se o mês foi apagado do banco. Recarregue a página antes de tentar de novo.')
    expect(fraseDoRetorno('trazer', { tipo: 'falhou', causa: 'tempo_no_banco' }, c).texto).toBe('O banco não terminou a tempo. Nada foi mostrado de novo; tente de novo em alguns minutos.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'sem_tempo' }, c).texto).toBe('Faltou tempo nesta página para chamar o banco. Nada foi escondido; clique de novo.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'forma' }, c).texto).toBe('Não foi possível esconder outubro de 2027 agora. Nada foi escondido; tente de novo em alguns minutos. Se repetir, avise quem cuida do site. (código: forma)')
    expect(fraseDaFalha('banco', 'liberar')).toMatch(/^Não foi possível apagar o mês do banco agora\. Nada foi apagado;/)
  })
  it('a retorno da ação (ok:false) usa a causa; sem causa usa o error; ok:true usa a resposta', () => {
    expect(fraseDoRetornoDaAcao('tirar', { ok: false, error: 'qualquer', causa: 'prazo' }, c).texto).toMatch(/^Não foi possível confirmar se o mês foi escondido/)
    expect(fraseDoRetornoDaAcao('tirar', { ok: false, error: 'Só quem administra o site pode esconder um mês das telas.' }, c))
      .toEqual({ tom: 'erro', texto: 'Só quem administra o site pode esconder um mês das telas.' })
    expect(fraseDoRetornoDaAcao('tirar', { ok: true, resposta: { tipo: 'recusado', codigo: 'ocupado', faltam: [] } }, c).texto).toBe('Ocupado: a coleta está gravando. Tente em alguns minutos.')
  })
  it('conferência parcial: mostra quantos canais faltam quando o número vem; sem número, a frase de sempre', () => {
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial', restantes: 12 }, c).texto).toBe('A conferência dos canais passou do tempo desta página. Nada foi escondido; faltam 12 canais; clique de novo para continuar de onde parou.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial', restantes: 1 }, c).texto).toContain('falta 1 canal; clique de novo')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'conferencia_parcial' }, c).texto).toBe('A conferência dos canais passou do tempo desta página. Nada foi escondido; clique de novo para continuar de onde parou.')
  })
  it('linhas nulas aparecem como "não medido", nunca 0', () => {
    const t = fraseDaSimulacao({ tipo: 'simulado', linhas: null, bytes: null, canais: 45, fracao: 0.38, canalSemUnidade: false }, MES)
    expect(t).toBe('Se você apagasse outubro de 2027 do banco agora: 45 canais, registros: não medido, 38% do que este tipo de dado ocupa. Contado agora: tudo bate.')
    expect(t).not.toMatch(/\b0 registros/)
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 0, bytes: null, canais: 0, fracao: 0, canalSemUnidade: false }, MES)).toContain('0 registros')
  })
  it('particao_ausente tem frase própria, em qualquer ação, sem a genérica', () => {
    for (const op of ['tirar', 'liberar', 'trazer'] as const) {
      const t = fraseDoRetorno(op, { tipo: 'recusado', codigo: 'particao_ausente', faltam: [] }, c).texto
      expect(t).toBe('A tabela deste mês não existe mais no banco do site. Nada foi alterado; recarregue a página para ver o estado.')
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
      const semCodigo = t.replace(/ \(código: [a-z_]+\)/, '')
      expect(semCodigo, rotulo).not.toContain(codigo)
      expect(semCodigo, rotulo).not.toContain('_')
      expect(t, rotulo).not.toContain('undefined')
      vistas.set(rotulo, t)
    }
    expect(vistas.size).toBe(CODIGOS_DA_SAIDA.length * 3)
    // fora da lista: a frase de desconhecido, com o verbo da ação, sem o código
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'desconhecido', faltam: [] }, c).texto).toBe(FRASE_CODIGO_DESCONHECIDO)
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: 'desconhecido', faltam: [] }, c).texto).toContain('nada foi apagado')
    expect(FRASE_CODIGO_DESCONHECIDO).toBe(DESCONHECIDO_DO_SAIDA)
  })
  it('Hanna: nenhuma frase diz "descartes" sem "à mão" e "nesta classe"', () => {
    const todas = [NOTA_DESCARTES, faltaParaLigar(1, 0), faltaParaLigar(3, 2)]
    expect(NOTA_DESCARTES).toContain('descartes feitos à mão nesta classe')
    for (const t of todas) if (/descarte/i.test(t)) { expect(t).toContain('à mão'); expect(t).toContain('nesta classe') }
  })
})

describe('M6a T12 r1: frases (Gio 1, 2, 5; Logan U1-U3; Yannis I-3)', () => {
  const ctx = { mes: MES, janelaMeses: 6 }
  it('U1: registro_diverge tem frase própria e a que não tem cita o código', () => {
    const t = fraseDaFalta({ codigo: 'registro_diverge' }, ctx)
    expect(t).toMatch(/não batem com a cópia/); expect(t).not.toMatch(/não conhece/); expect(t).toContain('(código: registro_diverge)')
    expect(fraseDaFalta({ codigo: 'qualquer_novo' }, ctx)).toContain('(código: qualquer_novo)')
  })
  it('U1: todo código da lista fechada que o exit_check devolve em faltam tem frase que não é a genérica', () => {
    for (const codigo of CODIGOS_DA_SAIDA) {
      const t = fraseDaFalta({ codigo }, ctx)
      if (['ocupado', 'ja_destacado', 'ja_descartado', 'cedo_demais', 'particao_ausente', 'nao_destacado', 'tabela_invalida', 'dois_passos_obrigatorios', 'mudou_durante_a_leitura', 'gatilho_ausente', 'orfa_inesperada'].includes(codigo)) continue
      expect(t, codigo).not.toMatch(/não conhece/)
    }
  })
  it('U3: falha de escrita nunca diz "ler"; diz o verbo da operação e o código da causa', () => {
    for (const op of ['tirar', 'liberar', 'trazer'] as const) for (const causa of ['banco', 'forma'] as const) {
      const t = fraseDaFalha(causa, op)
      expect(t, `${op}/${causa}`).not.toMatch(/ler/); expect(t).toMatch(/Nada foi (escondido|apagado|mostrado de novo)/); expect(t).toContain(`(código: ${causa})`)
    }
    expect(fraseDaFalha('banco', 'tirar')).toBe('Não foi possível esconder o mês agora. Nada foi escondido; tente de novo em alguns minutos. Se repetir, avise quem cuida do site. (código: banco)')
    expect(fraseDaFalha('banco', 'liberar')).toMatch(/^Não foi possível apagar o mês do banco agora\./)
    expect(fraseDaFalha('forma', 'trazer')).toMatch(/^Não foi possível mostrar o mês de novo agora\./)
  })
  it('I-3: data ausente ou torta não lança e a frase sai sem a data', () => {
    expect(ddmmaaaa(null)).toBeNull(); expect(ddmmaaaa(undefined)).toBeNull(); expect(ddmmaaaa('')).toBeNull(); expect(ddmmaaaa('lixo')).toBeNull()
    expect(ddmmaaaa('2028-06-01')).toBe('01/06/2028'); expect(ddmmaaaa('2028-06-01T12:00:00Z')).toBe('01/06/2028')
    expect(() => fraseDaFalta({ codigo: 'ainda_na_janela' }, ctx)).not.toThrow()
    expect(fraseDaFalta({ codigo: 'ainda_na_janela' }, ctx)).not.toMatch(/undefined|em \./)
    expect(fraseDaFalta({ codigo: 'b2_sem_atestacao', motivo: 'retirada' }, ctx)).not.toMatch(/undefined| em \./)
    const c = { mes: MES, doisPassos: true }
    const rec = (codigo: string, extra: object = {}) => fraseDoRetorno('liberar', { tipo: 'recusado', codigo, faltam: [], ...extra } as never, c).texto
    expect(rec('ja_descartado')).not.toMatch(/undefined|em \./); expect(rec('cedo_demais')).not.toMatch(/undefined|NaN/)
    expect(() => fraseDoRetorno('tirar', { tipo: 'ok', linhas: 1, bytes: null } as never, c)).not.toThrow()
    expect(() => fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null } as never, c)).not.toThrow()
    const dest = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: null, liberar_a_partir: null }
    expect(() => fraseDaLinhaDestacada(dest, '2028-05-02', null)).not.toThrow()
    expect(fraseDaLinhaDestacada(dest, '2028-05-02', null)).not.toMatch(/undefined|NaN/)
    expect(() => fraseDaLinhaDescartada({ estado: 'descartado', faltam: [], descartes: 0, dois_passos: true, descartado_em: null }, null)).not.toThrow()
    expect(() => fraseDaLinhaDestacada({ ...dest, destacado_em: 'lixo' }, '2028-05-02', null)).not.toThrow()
  })
})

describe('M6a T12 layout r4: vocabulário dos botões nas frases', () => {
  it('nenhuma frase da saída usa os nomes velhos (Tirar, Trazer de volta, Liberar o espaço, banco online)', () => {
    const c = { mes: MES, doisPassos: true, hoje: '2028-05-03', nomeDoDado: 'Views por dia' }
    const textos: string[] = []
    for (const op of ['tirar', 'liberar', 'trazer'] as const) {
      for (const causa of ['prazo', 'banco', 'forma', 'tempo_no_banco', 'sem_tempo', 'conferencia_parcial', 'somente_leitura'] as const) textos.push(fraseDaFalha(causa, op, 2, MES))
      for (const codigo of CODIGOS_DA_SAIDA) textos.push(fraseDoRetorno(op, { tipo: 'recusado', codigo, faltam: [], descartadoEm: '2028-05-03T17:32:00Z', liberarAPartir: '2028-06-01' }, c).texto)
      textos.push(fraseDoRetorno(op, { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: [] }, c).texto)
    }
    for (const t of textos) expect(t).not.toMatch(/Tirar|Tire |tirar|tirado|Trazer de volta|trazer de volta|Liberar o espaço|liberar o espaço|banco online/)
  })
  it('mensagens de sucesso nomeiam o mês e o dado; simulação no plural certo', () => {
    const c = { mes: MES, doisPassos: true, nomeDoDado: 'Primeiras horas' }
    expect(fraseDoRetorno('tirar', { tipo: 'ok', linhas: 1, bytes: null }, c).texto).toBe('Outubro de 2027 foi escondido das telas de “Primeiras horas”. Ainda não foi apagado do banco.')
    expect(fraseDoRetorno('liberar', { tipo: 'ok', linhas: 1, bytes: null }, c).texto).toBe('Outubro de 2027 foi apagado do banco de “Primeiras horas”.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: [] }, c).texto).toBe('Outubro de 2027 aparece de novo nas telas de “Primeiras horas”.')
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 1, bytes: null, canais: 1, fracao: 0.01, canalSemUnidade: false }, MES, 'Primeiras horas')).toBe('Se você apagasse outubro de 2027 de “Primeiras horas” do banco agora: 1 canal, 1 registro, 1% do que “Primeiras horas” ocupa. Contado agora: tudo bate.')
  })
})
