// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  vistaDaFicha, motivoDoErro, motivoDoErroDescartar, motivoDoErroResponder, INATIVIDADE_DESCARTE_MS,
  type EntradaFicha, type VistaFicha,
} from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'

const MIN = 60_000
const D = 86_400_000
const AGORA = new Date('2026-11-10T15:00:00Z')
const ant = (ms: number): string => new Date(AGORA.getTime() - ms).toISOString()
const img = (largura = 1280, altura = 720) => ({ url: 'https://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/a.jpg', sha256: 'a'.repeat(64), largura, altura })

const fichaCom = (n: 1 | 2 | 3, o: Partial<FichaLida> = {}): FichaLida => ({
  id: 'f1', site_id: 's', video_id: 'v', campos: ['titulo', 'miniatura'],
  variantes: [
    { n: 1, tipo: 'combo', titulo: 'Original', imagem: img() },
    ...(n >= 2 ? [{ n: 2, tipo: 'combo' as const, titulo: 'Nova', imagem: img() }] : []),
    ...(n >= 3 ? [{ n: 3, tipo: 'combo' as const, titulo: 'Outra', imagem: img() }] : []),
  ],
  criada_em: ant(1 * D), criada_por: null, atualizada_em: ant(1 * D), studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null,
  aberta: true, enviada: false, ...o,
})
const ent = (o: Partial<EntradaFicha> & { n?: 1 | 2 | 3; ficha?: FichaLida } = {}): EntradaFicha => {
  const { n, ...resto } = o
  return {
    ficha: fichaCom(n ?? 2), agora: AGORA, largura: 'larga', nosso: null, registroDetectado: null,
    studioAbertoNestaSessao: false, criadaEmOutroAparelho: false, confirmacao: 'fechada', ...resto,
  }
}
const nosso = (originalDeVolta: 'sim' | 'restaurando' | 'falhou' | 'nao', status: 'active' | 'paused' = 'active') => ({ status, dia: 5, originalDeVolta })

type Esp = Partial<Pick<VistaFicha, 'primario' | 'faixa' | 'abrirStudioHabilitado' | 'apoio' | 'idade' | 'jaIniciouHabilitado' | 'acaoDoTopo'>> & { frase: string }
const estreita = { largura: 'estreita' as const }

// Um caso por estado `ficha-*` do mockup M2 (24). `carregando` não tem ficha: a cópia é de FRASES (teste à parte).
const TABELA: [string, EntradaFicha, Esp][] = [
  ['ficha-so-original', ent({ n: 1 }), { frase: 'Falta a versão B para levar ao Studio.', apoio: 'A versão A é a atual do vídeo; escreva pelo menos uma nova.', primario: null, faixa: null, abrirStudioHabilitado: false, jaIniciouHabilitado: false }],
  ['ficha-so-original 390', ent({ n: 1, ...estreita }), { frase: 'Falta a versão B para levar ao Studio.', primario: 'lembrar', abrirStudioHabilitado: false }],
  ['ficha-duas', ent(), { frase: 'Próximo passo: abrir no Studio e copiar as duas versões.', apoio: 'A ficha salva sozinha a cada campo.', primario: 'abrir_studio', faixa: null, abrirStudioHabilitado: true, acaoDoTopo: 'abrir_studio', idade: 'normal' }],
  ['ficha-duas 390', ent(estreita), { frase: 'Próximo passo: mandar esta ficha ao computador.', apoio: 'No celular o Studio não liga o teste. A ficha salva sozinha a cada campo.', primario: 'lembrar', abrirStudioHabilitado: false }],
  ['ficha-tres', ent({ n: 3, ficha: fichaCom(3, { variantes: [
    { n: 1, tipo: 'combo', titulo: 'a', imagem: img() }, { n: 2, tipo: 'combo', titulo: 'b', imagem: img() }, { n: 3, tipo: 'combo', titulo: 'c', imagem: img(854, 480) }] }) }),
  { frase: 'Três versões prontas; a C está abaixo de 1280 × 720.', apoio: 'Com uma imagem menor, o Studio reduz todas as versões.', primario: 'abrir_studio', abrirStudioHabilitado: true }],
  ['ficha-so-titulo', ent({ ficha: fichaCom(2, { campos: ['titulo'] }) }), { frase: 'Teste só de título: copie as duas versões.', apoio: 'Sem coluna de miniatura.', primario: 'abrir_studio' }],
  ['ficha-so-miniatura', ent({ ficha: fichaCom(2, { campos: ['miniatura'] }) }), { frase: 'Teste só de miniatura: baixe as duas imagens.', apoio: 'O título do vídeo não muda.', primario: 'abrir_studio' }],
  ['ficha-imagem-falhou', ent({ imagemFalhou: 2 }), { frase: 'A imagem da versão B não carregou.', apoio: 'O resto da ficha está salvo.', primario: 'abrir_studio' }],
  ['ficha-salvando', ent({ salvamento: 'salvando' }), { frase: 'Próximo passo: abrir no Studio e copiar as duas versões.', apoio: null, primario: 'abrir_studio' }],
  ['ficha-salvando 390 (Logan 3)', ent({ salvamento: 'salvando', ...estreita }), { frase: 'Próximo passo: ligar o teste no computador.', apoio: null, primario: 'lembrar' }],
  ['ficha-offline', ent({ salvamento: 'offline' }), { frase: 'Sem conexão: as mudanças ainda não foram salvas.', apoio: 'O que você escreveu continua na tela.', primario: 'abrir_studio' }],
  ['ficha-offline 390 (lembrar segue habilitado)', ent({ salvamento: 'offline', ...estreita }), { frase: 'Sem conexão: as mudanças ainda não foram salvas.', primario: 'lembrar' }],
  ['ficha-outro-aparelho', ent({ criadaEmOutroAparelho: true }), { frase: 'A ficha que você começou no celular está aqui.', apoio: 'Próximo passo: abrir no Studio.', primario: 'abrir_studio', abrirStudioHabilitado: true }],
  ['ficha-outro-aparelho 390 (sem rodapé: Copiar título)', ent({ criadaEmOutroAparelho: true, ...estreita }), { frase: 'Para ligar o teste, termine no computador; aqui dá para revisar.', apoio: 'A ficha foi feita lá; as versões estão abaixo.', primario: 'copiar_titulo', abrirStudioHabilitado: false }],
  ['ficha-studio-aberto', ent({ studioAbertoNestaSessao: true }), { frase: 'Você iniciou o teste no Studio?', apoio: 'Se sim, toque em Já iniciei; se não, a ficha espera.', primario: 'ja_iniciei', acaoDoTopo: 'confirmar' }],
  ['ficha-studio-aberto sem B', ent({ n: 1, studioAbertoNestaSessao: true }), { frase: 'Falta a versão B para levar ao Studio.', primario: null, jaIniciouHabilitado: false }],
  ['ficha-ja-iniciei', ent({ studioAbertoNestaSessao: true, confirmacao: 'aberta' }), { frase: 'Confirme que o teste já está ligado no Studio.', apoio: null, primario: 'confirmar', acaoDoTopo: 'confirmar' }],
  ['ficha-ja-iniciei 390 (lembrar vira secundário)', ent({ confirmacao: 'aberta', ...estreita }), { frase: 'Confirme que o teste já está ligado no Studio.', primario: 'confirmar' }],
  ['ficha-registrada', ent({ studioAbertoNestaSessao: true, confirmacao: 'registrada' }), { frase: 'Teste do YouTube registrado. O Lab fica parado neste vídeo.', apoio: 'Lembrete em 24/11.', primario: 'voltar', faixa: null, abrirStudioHabilitado: false }],
  ['ficha-erro incompleta', ent({ studioAbertoNestaSessao: true, confirmacao: { erro: 'incompleta' } }), { frase: 'O teste não foi registrado.', apoio: 'O motivo está no passo 3.', primario: 'ja_iniciei' }],
  ['ficha-erro sem_conexao', ent({ studioAbertoNestaSessao: true, confirmacao: { erro: 'sem_conexao' } }), { frase: 'O teste não foi registrado.', primario: 'ja_iniciei' }],
  ['ficha-ainda-nao', ent({ studioAbertoNestaSessao: true, confirmacao: 'ainda_nao' }), { frase: 'A ficha fica salva até você iniciar no Studio.', apoio: null, primario: null }],
  ['ficha-detectado', ent({ studioAbertoNestaSessao: true, registroDetectado: { primeiraVista: ant(2 * D) } }), { frase: 'Parece que o teste já começou no Studio.', apoio: 'Se foi você, confirme no passo 3.', faixa: '0c', primario: 'ja_iniciei', acaoDoTopo: 'confirmar' }],
  ['ficha-nosso-rodando', ent({ nosso: nosso('nao') }), { frase: 'Antes do Studio, pause o nosso teste neste vídeo.', apoio: 'Os dois juntos se atrapalham.', faixa: '0b', primario: 'pausar', abrirStudioHabilitado: false, jaIniciouHabilitado: false, acaoDoTopo: null }],
  ['ficha-pausar-confirma', ent({ nosso: nosso('nao'), confirmacao: 'aberta' }), { frase: 'Confirme a pausa do nosso teste.', apoio: null, faixa: '0b-ask', primario: 'pausar', abrirStudioHabilitado: false }],
  ['ficha-restaurando', ent({ nosso: nosso('restaurando') }), { frase: 'Restaurando a versão A no YouTube.', apoio: null, faixa: 'restaurando', primario: null, abrirStudioHabilitado: false }],
  ['ficha-restaurar-falhou', ent({ nosso: nosso('falhou') }), { frase: 'A original não voltou: o nosso teste segue rodando.', apoio: 'Reconecte o canal e tente de novo.', faixa: 'falhou', primario: 'pausar', abrirStudioHabilitado: false }],
  ['ficha-restaurada', ent({ nosso: nosso('sim', 'paused') }), { frase: 'Original de volta no vídeo. Próximo passo: abrir no Studio.', faixa: 'restaurada', primario: 'abrir_studio', abrirStudioHabilitado: true, jaIniciouHabilitado: true }],
  ['ficha-restaurada 390', ent({ nosso: nosso('sim', 'paused'), ...estreita }), { frase: 'Original de volta no vídeo. Próximo passo: mandar a ficha ao computador.', faixa: 'restaurada', primario: 'lembrar', abrirStudioHabilitado: false }],
  ['ficha-lembrete 390', ent({ ficha: fichaCom(2, { lembrar_em: ant(2 * MIN) }), ...estreita }), { frase: 'Lembrete enviado: abra a ficha no computador.', apoio: 'No celular o teste do YouTube não se liga.', primario: 'copiar_titulo' }],
  ['ficha-13d', ent({ ficha: fichaCom(2, { criada_em: ant(20 * D), atualizada_em: ant(13 * D) }) }), { frase: 'Esta ficha está parada há 13 dias.', apoio: 'Amanhã ela é descartada se nada mudar.', idade: 'parada', primario: 'abrir_studio' }],
  ['ficha-15d', ent({ ficha: fichaCom(2, { criada_em: ant(20 * D), atualizada_em: ant(15 * D) }) }), { frase: 'Esta ficha venceu e ficou só para consulta.', apoio: 'Para testar, comece outra.', idade: 'vencida', primario: 'comecar_outra', faixa: null, abrirStudioHabilitado: false, jaIniciouHabilitado: false, acaoDoTopo: null }],
]

describe('vistaDaFicha: tabela dos estados ficha-* do mockup', () => {
  it.each(TABELA)('%s', (_n, entrada, esp) => {
    const v = vistaDaFicha(entrada)
    const { frase, ...resto } = esp
    expect(v.frase).toBe(frase)
    expect(v).toMatchObject(resto)
    // no máximo 1 primário: o campo é um valor só; nunca fica `undefined`
    expect(v.primario === null || typeof v.primario === 'string').toBe(true)
  })

  it('o estado ficha-carregando vive só em FRASES (não há ficha ainda)', () => {
    expect(FRASES.ficha.carregando).toEqual({ frase: 'Próximo passo: abrir no Studio e copiar as duas versões.', apoio: 'A ficha salva sozinha a cada campo.' })
    expect(FRASES.ficha.carregandoMeta).toBe('Carregando a ficha…')
  })

  it('Abrir no Studio: só com nosso === null ou original de volta (spec §6)', () => {
    expect(vistaDaFicha(ent()).abrirStudioHabilitado).toBe(true)
    expect(vistaDaFicha(ent({ nosso: nosso('sim', 'paused') })).abrirStudioHabilitado).toBe(true)
    for (const o of ['nao', 'restaurando', 'falhou'] as const) expect(vistaDaFicha(ent({ nosso: nosso(o) })).abrirStudioHabilitado).toBe(false)
  })

  it('falta B: Abrir no Studio desabilitado com o motivo escrito', () => {
    const v = vistaDaFicha(ent({ n: 1 }))
    expect(v.abrirStudioHabilitado).toBe(false)
    expect(v.motivoDesabilitado).toBe('Falta a versão B: escreva o título ou envie a imagem.')
  })

  it('nosso pausado por pulado_teste_youtube (original de volta) não mostra 0b', () => {
    expect(vistaDaFicha(ent({ nosso: nosso('sim', 'paused') })).faixa).not.toBe('0b')
    expect(vistaDaFicha(ent({ nosso: nosso('sim', 'paused') })).faixa).toBe('restaurada')
    expect(vistaDaFicha(ent({ nosso: nosso('nao', 'active') })).faixa).toBe('0b')
  })

  it('nosso pausado com a original ainda não restaurada nunca libera o Studio', () => {
    const v = vistaDaFicha(ent({ nosso: nosso('nao', 'paused') }))
    expect(v.faixa).toBe('restaurando')
    expect(v.abrirStudioHabilitado).toBe(false)
  })

  it('B só com imagem conta como B; B vazia (sem título nem imagem) não', () => {
    const f = fichaCom(2, { variantes: [{ n: 1, tipo: 'combo', titulo: 'a' }, { n: 2, tipo: 'miniatura', imagem: img() }] })
    expect(vistaDaFicha(ent({ ficha: f })).abrirStudioHabilitado).toBe(true)
    const g = fichaCom(2, { variantes: [{ n: 1, tipo: 'combo', titulo: 'a' }] })
    expect(vistaDaFicha(ent({ ficha: g })).abrirStudioHabilitado).toBe(false)
  })
})

describe('um só primário', () => {
  const combos: Partial<EntradaFicha>[] = []
  for (const largura of ['larga', 'estreita'] as const)
    for (const confirmacao of ['fechada', 'aberta', 'ainda_nao', 'registrada', { erro: 'incompleta' as const }] as const)
      for (const n of [null, nosso('nao'), nosso('nao', 'paused'), nosso('restaurando'), nosso('falhou'), nosso('sim', 'paused')])
        for (const studio of [false, true]) combos.push({ largura, confirmacao, nosso: n, studioAbertoNestaSessao: studio })
  it('toda combinação devolve no máximo um primário e a 390 nunca fica sem ação (exceto faixa restaurando)', () => {
    for (const c of combos) {
      const v = vistaDaFicha(ent(c))
      expect(Array.isArray(v.primario)).toBe(false)
      if (c.largura === 'estreita' && v.faixa !== 'restaurando') expect(v.primario).not.toBeNull()
    }
  })
  it('Naksu 1: com a confirmação aberta, o primário é "confirmar" e "lembrar" some', () => {
    expect(vistaDaFicha(ent({ ...estreita, confirmacao: 'aberta' })).primario).toBe('confirmar')
    expect(vistaDaFicha(ent({ ...estreita })).primario).toBe('lembrar')
  })
})

describe('fronteiras de idade (relógio injetado)', () => {
  const comInatividade = (ms: number): EntradaFicha => ent({ ficha: fichaCom(2, { criada_em: ant(ms + 5 * D), atualizada_em: ant(ms) }) })
  it('13 d exatos: parada', () => expect(vistaDaFicha(comInatividade(13 * D)).idade).toBe('parada'))
  it('13 d − 1 min: normal', () => expect(vistaDaFicha(comInatividade(13 * D - MIN)).idade).toBe('normal'))
  it('14 d − 1 min: parada', () => expect(vistaDaFicha(comInatividade(14 * D - MIN)).idade).toBe('parada'))
  it('14 d exatos: ainda parada (vencida só com inatividade > 14 d)', () => expect(vistaDaFicha(comInatividade(14 * D)).idade).toBe('parada'))
  it('14 d + 1 min: vencida, só consulta, primário "comecar_outra"', () => {
    const v = vistaDaFicha(comInatividade(14 * D + MIN))
    expect(v.idade).toBe('vencida')
    expect(v.primario).toBe('comecar_outra')
    expect(v.abrirStudioHabilitado).toBe(false)
  })
  it('a constante é 14 dias', () => expect(INATIVIDADE_DESCARTE_MS).toBe(14 * D))
  it('inatividade = maior de criada/atualizada/Studio/lembrete: Studio aberto ontem reanima a ficha velha', () => {
    const f = fichaCom(2, { criada_em: ant(30 * D), atualizada_em: ant(30 * D), studio_aberto_em: ant(1 * D) })
    expect(vistaDaFicha(ent({ ficha: f })).idade).toBe('normal')
    const g = fichaCom(2, { criada_em: ant(30 * D), atualizada_em: ant(30 * D), lembrar_em: ant(14 * D + MIN) })
    expect(vistaDaFicha(ent({ ficha: g })).idade).toBe('vencida')
  })
  it('vencida vence a faixa e o nosso: ainda assim só consulta', () => {
    const v = vistaDaFicha(ent({ ficha: fichaCom(2, { atualizada_em: ant(15 * D), criada_em: ant(16 * D) }), nosso: nosso('nao') }))
    expect(v.primario).toBe('comecar_outra')
    expect(v.frase).toBe('Esta ficha venceu e ficou só para consulta.')
  })
})

describe('motivoDoErro e variantes (exaustivos)', () => {
  it('confirmar', () => {
    const tabela = {
      ficha_incompleta: 'incompleta', ja_ha_teste_em_andamento: 'ja_ha_teste', estado_mudou: 'estado_mudou', nao_encontrada: 'estado_mudou',
      ja_confirmado: 'estado_mudou', sem_permissao: 'estado_mudou', pedido_invalido: 'estado_mudou', falha: 'estado_mudou', rede: 'sem_conexao',
    } as const
    for (const [k, v] of Object.entries(tabela)) expect(motivoDoErro(k as keyof typeof tabela)).toBe(v)
    expect(Object.keys(tabela)).toHaveLength(9)
  })
  it('descartar', () => {
    for (const k of ['nao_encontrado', 'confirmado', 'ja_encerrado', 'sem_permissao', 'pedido_invalido', 'falha'] as const) expect(motivoDoErroDescartar(k)).toBe('estado_mudou')
    expect(motivoDoErroDescartar('rede')).toBe('sem_conexao')
  })
  it('responder', () => {
    for (const k of ['ja_respondido', 'estado_mudou', 'nao_respondivel', 'nao_encontrado'] as const) expect(motivoDoErroResponder(k)).toBe('estado_mudou')
    for (const k of ['falha_escrita', 'falha', 'sem_permissao', 'pedido_invalido', 'variante_invalida'] as const) expect(motivoDoErroResponder(k)).toBe('falha')
    expect(motivoDoErroResponder('rede')).toBe('sem_conexao')
  })
})

describe('FRASES: frases fechadas (exatidão)', () => {
  const dia = new Date('2026-11-04T15:00:00Z')
  it('D-7: respostas sem vencedor nunca dizem "Ficou no ar"', () => {
    expect(FRASES.resposta.ficouIgual).toBe('Você respondeu: ficou igual.')
    expect(FRASES.resposta.inconclusivo).toBe('Você respondeu: inconclusivo.')
    expect(FRASES.resposta.naoVi).toBe('Você respondeu: não vi o resultado.')
    expect(FRASES.resposta.apoioSemVencedor).toBe('Nada ficou registrado como versão no ar. O resultado oficial está só no Studio. Mudar a resposta por esta tela chega na próxima atualização.')
    for (const t of [FRASES.resposta.ficouIgual, FRASES.resposta.inconclusivo, FRASES.resposta.naoVi, FRASES.resposta.apoioSemVencedor]) expect(t).not.toContain('Ficou no ar')
  })
  it('D-7: frase tardia, dia 14 sem botão, guarda, estado mudou, rodapé, leitura', () => {
    expect(FRASES.resposta.tardia(dia)).toBe('O prazo acabou em 04/11. Ainda dá para responder.')
    expect(FRASES.resposta.semBotao).toBe('A resposta por esta tela chega na próxima atualização. O que o YouTube mostrou fica guardado e você poderá responder mesmo depois do prazo.')
    expect(FRASES.guarda.motivoRecusa(dia)).toBe('Este vídeo tem um teste do YouTube registrado até 04/11. Aguarde o resultado ou responda o teste antes de iniciar o nosso.')
    expect(FRASES.guarda.guardaFalhou).toBe('Não foi possível conferir o teste do YouTube agora. Nada foi iniciado. Tente de novo em alguns minutos.')
    expect(FRASES.guarda.tentarDeNovo).toBe('Tentar de novo')
    expect(FRASES.guarda.estadoMudou).toBe('O teste mudou enquanto a tela estava aberta.')
    expect(FRASES.guarda.atualizar).toBe('Atualizar')
    expect(FRASES.lista.rodape).toBe('Mostra os 20 mais recentes e os que têm ficha ou teste. Outros vídeos: Sugeridos para testar, acima.')
    expect(FRASES.lista.leituraFalhou).toBe('Não deu para ler a lista agora.')
    expect(FRASES.lista.nadaEspera).toBe('Nada espera a sua resposta hoje.')
    expect(FRASES.lista.apoioEmTesteOuPreparo(3)).toBe('Três vídeos em teste ou em preparo. Os demais seguem sem teste.')
    expect(FRASES.lista.resultadoProntoSemBotao(2)).toBe('Dois vídeos têm resultado pronto no YouTube.')
    expect(FRASES.lista.labPausado(1)).toBe('Lab pausado em um vídeo.')
    expect(FRASES.lista.labPausado(3)).toBe('Lab pausado em três vídeos.')
    expect(FRASES.lista.maisComResultadoPronto(2)).toBe('Mais dois têm resultado pronto; a resposta chega na próxima atualização.')
  })
  it('D-8: pergunta sem a palavra "ligou"; botões fechados', () => {
    expect(FRASES.guarda.pergunta).toBe('Você iniciou o teste do YouTube neste vídeo?')
    const apoio = FRASES.guarda.perguntaApoio(dia)
    expect(apoio).toBe('A ficha foi enviada em 04/11. Se o teste já está ligado no Studio, o nosso não pode começar: o Lab não troca título nem miniatura enquanto o do YouTube roda.')
    expect(FRASES.guarda.pergunta).not.toMatch(/ligou/i)
    expect(apoio).not.toMatch(/ligou/i)
    expect(FRASES.guarda.jaIniciei).toBe('Já iniciei')
    expect(FRASES.guarda.aindaNaoSeguir).toBe('Ainda não, seguir com o nosso teste')
    expect(FRASES.guarda.perguntaIncompleta).toBe('Complete a ficha para registrar')
  })
  it('erros do Já iniciei (MOT) e imagem', () => {
    expect(FRASES.motivo.incompleta.forte).toBe('Falta a versão B.')
    expect(FRASES.motivo.ja_ha_teste.forte(new Date('2026-10-19T15:00:00Z'))).toBe('Este vídeo já tem um teste do YouTube registrado, desde 19/10.')
    expect(FRASES.motivo.estado_mudou.resto('14:50')).toBe(' (o Lab pausou um teste às 14:50). Nada foi gravado.')
    expect(FRASES.motivo.estado_mudou.resto(null)).toBe('. Nada foi gravado.')
    expect(FRASES.motivo.sem_conexao.forte).toBe('Sem conexão. Nada foi registrado.')
    expect(FRASES.imagem.grande).toBe('A imagem precisa ter até 2 MB.')
    expect(FRASES.imagem.formato).toBe('A imagem precisa ser JPEG ou PNG.')
  })
  it('emendas de Logan: faixa de outro aparelho a 390 só com a data; bloco Confirmar sem o 3 no topo; passo 2 a 390', () => {
    expect(FRASES.ficha.faixaOutroAparelho('21/10, 14:32', true)).toEqual({ titulo: 'Ficha feita em 21/10, 14:32 no computador', apoio: null })
    expect(FRASES.ficha.faixaOutroAparelho('21/10, 14:32', false).titulo).toBe('Ficha feita em 21/10, 14:32 no celular')
    expect(FRASES.ficha.bloco3.numero(true)).toBeNull()
    expect(FRASES.ficha.bloco3.numero(false)).toBe(3)
    expect(FRASES.ficha.bloco2.ledeEstreitaOutroAparelho).toBe('Copie daqui se quiser; o teste se liga no computador.')
  })
  it('mensagens da T2/ficha vêm de FRASES (sem copiar o texto)', async () => {
    const { MSG_IMAGEM_GRANDE, MSG_IMAGEM_FORMATO } = await import('@/lib/youtube/teste-youtube/nativo/imagem-ficha')
    expect(MSG_IMAGEM_GRANDE).toBe(FRASES.imagem.grande)
    expect(MSG_IMAGEM_FORMATO).toBe(FRASES.imagem.formato)
    const { MSG_FICHA_MUDOU } = await import('@/lib/youtube/teste-youtube/nativo/ficha')
    expect(MSG_FICHA_MUDOU).toBe(FRASES.mudouEmOutroLugar)
  })
  it('nenhuma frase da ficha usa as palavras proibidas do glossário', () => {
    const textos: string[] = []
    const colher = (x: unknown): void => {
      if (typeof x === 'string') textos.push(x)
      else if (Array.isArray(x)) x.forEach(colher)
      else if (x && typeof x === 'object') Object.values(x).forEach(colher)
      else if (typeof x === 'function') { try { colher((x as (...a: never[]) => unknown)(...([new Date(AGORA), 1, 1, 1, '21/10'] as never[]))) } catch { /* função com outra assinatura */ } }
    }
    colher(FRASES.ficha)
    for (const t of textos) expect(t).not.toMatch(/variante|nativo|detectado/i)
  })
})
