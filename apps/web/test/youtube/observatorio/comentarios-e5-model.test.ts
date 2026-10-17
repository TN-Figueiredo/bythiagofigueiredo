// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { secaoDeComentarios } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/model'
import { FRASES } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/frases'
import type { ComentariosDoVideo, EstadoDoMarco } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { Marco } from '@/lib/youtube/observatorio/comentarios/tipos'
import { DIA, OPCOES, T0, cartao, dados, doze, resumo } from './comentarios-e5-secao-fixture'

const so7 = (e: EstadoDoMarco, nivel: 'identidade' | 'texto' | 'contagem' = 'identidade'): ComentariosDoVideo =>
  ({ nivel, comentarios: [], marcos: { 1: { estado: 'fecha_em', fechaEmMs: T0 + DIA }, 7: e, 30: { estado: 'fecha_em', fechaEmMs: T0 + 30 * DIA } } }) as ComentariosDoVideo

describe('C2 · modelo · nove estados sem lista', () => {
  const casos: Array<[string, EstadoDoMarco, string, string]> = [
    ['sem_comentarios', { estado: 'sem_comentarios', tomadoEmMs: T0 + 7 * DIA }, 'nenhum comentário', 'Com 7 dias, nenhum comentário.'],
    ['desligados', { estado: 'desligados', tomadoEmMs: T0 + 7 * DIA }, 'desligados pelo canal', 'Comentários desligados pelo canal.'],
    ['nao_coletado tarde', { estado: 'nao_coletado', porque: { causa: 'tarde' } }, 'não coletado', 'Não coletado com 7 dias.'],
    ['nao_coletado lista_vazia', { estado: 'nao_coletado', porque: { causa: 'lista_vazia', tomadoEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA, encerrada: false, totalDoDia: 57 } }, 'não coletado', 'Não coletado com 7 dias.'],
    ['nao_coletado erro', { estado: 'nao_coletado', porque: { causa: 'erro', tentouEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA, encerrada: false, codigo: 'rede', totalDoDia: null } }, 'não coletado', 'Não coletado com 7 dias.'],
    ['nao_coletado janela_perdida', { estado: 'nao_coletado', porque: { causa: 'janela_perdida' } }, 'não coletado', 'Não coletado com 7 dias: a coleta não rodou enquanto o vídeo tinha essa idade'],
    ['antes_da_coleta', { estado: 'antes_da_coleta', coletaDesdeMs: T0 }, 'antes da coleta', 'Este vídeo é anterior à coleta de comentários.'],
    ['fecha_em', { estado: 'fecha_em', fechaEmMs: T0 + 7 * DIA }, 'fecha em 13/10', 'O retrato de 7 dias fecha em 13/10.'],
    ['a_caminho', { estado: 'a_caminho', fezEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA }, 'a caminho', 'Ainda não existe: o vídeo fez 7 dias em 13/10; o retrato sai na próxima coleta, até 16/10.'],
    ['coleta_parada', { estado: 'coleta_parada', desdeMs: T0 + 2 * DIA, semOk: false }, 'coleta parada', 'A coleta de comentários está parada desde 08/10.'],
    ['coleta_parada sem ok', { estado: 'coleta_parada', desdeMs: T0 + 2 * DIA, semOk: true }, 'coleta parada', 'A coleta de comentários está parada: sem execução completa desde 08/10.'],
    ['coleta_nao_comecou', { estado: 'coleta_nao_comecou' }, 'coleta não começou', 'A coleta de comentários ainda não começou.'],
  ]
  for (const [nome, e, aba, titulo] of casos) {
    it(nome, () => {
      const s = secaoDeComentarios(so7(e), { ...OPCOES, marcoAberto: 7 })
      expect(s.abas[1]!.estado).toBe(aba)
      const p = s.paineis[7]
      expect(p.kind).toBe('estado')
      if (p.kind === 'estado') expect(p.titulo).toBe(titulo)
    })
  }
  it('só o zero medido escreve o algarismo 0 (nos outros estados nenhuma frase tem 0 isolado)', () => {
    for (const [nome, e] of casos) {
      const p = secaoDeComentarios(so7(e), OPCOES).paineis[7]
      const t = JSON.stringify(p)
      if (nome === 'sem_comentarios') expect(t).toMatch(/informou 0 comentários/)
      else expect(t, nome).not.toMatch(/(^|[^\d/.])0(?![\d/.])/)
    }
  })
  it('a_caminho e coleta parada não prometem "fecha em"', () => {
    for (const e of [casos[8]![1], casos[9]![1]]) {
      const s = secaoDeComentarios(so7(e), { ...OPCOES, marcoAberto: 7 })
      expect(JSON.stringify(s.paineis[7])).not.toMatch(/fecha em/)
    }
  })
  it('a data de "tarde" vem do vídeo: descoberto com 4 dias, prazo de 10 dias para o marco de 7', () => {
    const p = secaoDeComentarios(so7(casos[2]![1]), OPCOES).paineis[7]
    expect(p.kind === 'estado' && p.corpo).toBe('Descobrimos o vídeo com 4 dias, depois do prazo de 10 dias para esta idade.')
  })
})

describe('C2 · modelo · aba aberta', () => {
  it('é a última com estado diferente de "fecha em" e "a caminho"', () => {
    expect(secaoDeComentarios(dados(), OPCOES).aberta).toBe(7)
    const m = (e30: EstadoDoMarco, e7: EstadoDoMarco) => ({ 1: dados().marcos[1], 7: e7, 30: e30 }) as Record<Marco, EstadoDoMarco>
    expect(secaoDeComentarios(dados({ marcos: m({ estado: 'a_caminho', fezEmMs: 1, ateMs: 2 }, { estado: 'fecha_em', fechaEmMs: 1 }) }), OPCOES).aberta).toBe(1)
    expect(secaoDeComentarios(dados({ marcos: m({ estado: 'desligados', tomadoEmMs: 1 }, dados().marcos[7]) }), OPCOES).aberta).toBe(30)
  })
  it('marcoAberto vence', () => expect(secaoDeComentarios(dados(), { ...OPCOES, marcoAberto: 1 }).aberta).toBe(1))
})

describe('C2 · modelo · soma 8+4=12 em barra, aba, casas e cartões', () => {
  const s = secaoDeComentarios(dados(), OPCOES)
  const p = s.paineis[7]
  it('os quatro lugares dizem 12', () => {
    if (p.kind !== 'lista') throw new Error('lista')
    expect(p.barra.texto).toBe('12 de 100')
    expect(s.abas[1]!.estado).toBe('12 guardados')
    expect(p.casas.filter(c => c.id !== null)).toHaveLength(12)
    expect(p.cartoes).toHaveLength(12)
    expect(p.cartoes[0]!.rotuloDaPosicao).toBe('1 de 12')
    expect(p.legenda.map(l => l.n)).toEqual([8, 4, 0, 0])
  })
  it('frase-resumo com o trecho "ele respondeu a 2" só quando há resposta vista', () => {
    if (p.kind !== 'lista') throw new Error('lista')
    expect(p.frase).toBe('Com 7 dias, guardamos 12 dos 100 primeiros comentários que o YouTube mostra, na ordem de relevância dele: 8 mais curtidos e 4 com o criador (ele respondeu a 3).')
    const sem = secaoDeComentarios(dados({ comentarios: doze().map(c => ({ ...c, nosMarcos: [7], criador: 'nao_vimos' as const })) }), OPCOES).paineis[7]
    expect(sem.kind === 'lista' && sem.frase).not.toMatch(/ele respondeu/)
  })
  it('lote completo: "12 de todos os 37" e "todos os 9" com menos de 12', () => {
    const c = dados({ marcos: { ...dados().marcos, 7: { estado: 'ok', resumo: resumo({ amostra: 37, amostraCompleta: true, totalDoDia: 37 }) } } })
    const a = secaoDeComentarios(c, OPCOES).paineis[7]
    expect(a.kind === 'lista' && a.barra.texto).toBe('12 de 37 (todos)')
    expect(a.kind === 'lista' && a.frase).toContain('12 de todos os 37 comentários do vídeo')
    const nove = doze().slice(0, 9).map(x => ({ ...x, nosMarcos: [7] as Marco[] }))
    const b = secaoDeComentarios(dados({ comentarios: nove, marcos: { ...dados().marcos, 7: { estado: 'ok', resumo: resumo({ amostra: 9, amostraCompleta: true, totalDoDia: 9 }) } } }), OPCOES).paineis[7]
    expect(b.kind === 'lista' && b.frase).toContain('guardamos todos os 9 comentários do vídeo')
  })
  it('a fileira ordena por curtidas do marco aberto (maior primeiro)', () => {
    if (p.kind !== 'lista') throw new Error('lista')
    const v = p.casas.filter(c => c.curtidas !== null).map(c => c.curtidas as number)
    expect(v).toEqual([...v].sort((a, b) => b - a))
  })
})

describe('C2 · modelo · motivo com zero dito', () => {
  const lista = (r: Partial<ReturnType<typeof resumo>>, cs = doze().map(c => ({ ...c, nosMarcos: [7] as Marco[] }))) => {
    const p = secaoDeComentarios(dados({ comentarios: cs, marcos: { ...dados().marcos, 7: { estado: 'ok', resumo: resumo(r) } } }), OPCOES).paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    return p
  }
  it('canal acompanhado e canal grande', () => {
    const p = lista({})
    expect(p.legenda[2]!.texto).toBe('nenhum canal que você acompanha comentou')
    expect(p.legenda[3]!.texto).toBe('nenhum canal grande entre os 20 mais curtidos')
  })
  it('com inscritos ocultos: "entre os 19 que deu para medir"', () => {
    const p = lista({ autoresSemTamanho: 1 })
    expect(p.legenda[3]!.texto).toBe('nenhum canal grande entre os 19 que deu para medir')
    expect(p.inscritosOcultos).toBe('1 autor com inscritos ocultos')
  })
  it('com menos de 20 comentários principais: "entre os comentários do vídeo"', () => {
    const p = lista({ autoresConsultados: 9, amostra: 9, amostraCompleta: true, totalDoDia: 9 })
    expect(p.legenda[3]!.texto).toBe('nenhum canal grande entre os comentários do vídeo')
  })
  it('um canal grande: legenda e base em duas escadas de três degraus', () => {
    const g = cartao(1, 'inscritos', { nosMarcos: [7], autor: { tipo: 'canal_grande' }, faixas: { tamanho: '1m_10m', razao: null } })
    const p = lista({}, [g, ...doze().slice(1).map(c => ({ ...c, nosMarcos: [7] as Marco[] }))])
    expect(p.legenda[3]!.texto).toBe('1 de canal grande, entre os 20 mais curtidos')
    const v = p.cartoes.find(c => c.chave === 'g')!
    expect(v.base).toEqual({ tamanho: { degrau: 2, texto: 'de 1 a 10 milhões de inscritos' }, razao: 'nao_medida' })
    expect(v.autor).toEqual({ tipo: 'grande', faixa: '1m_10m' })
  })
  it('a frase do canal grande segue a faixa de inscritos, nunca fixa em 10 milhões (trem 5, defeito 2)', () => {
    expect(FRASES.canalGrandeSemNome('100k_1m')).toBe('Um canal de 100 mil a 1 milhão de inscritos comentou')
    expect(FRASES.canalGrandeSemNome('1m_10m')).toBe('Um canal de 1 a 10 milhões de inscritos comentou')
    expect(FRASES.canalGrandeSemNome('10m_mais')).toBe('Um canal com mais de 10 milhões de inscritos comentou')
    expect(FRASES.canalGrandeSemNome(null)).not.toContain('10 milhões')
  })
})

describe('C2 · modelo · entraram e saíram', () => {
  it('conjunto entre dois marcos; dia 1 diz que é o primeiro retrato', () => {
    const cs = doze().map((c, i) => ({ ...c, nosMarcos: (i < 9 ? [1, 7] : i < 11 ? [1] : [7]) as Marco[], entrouNoMarco: (i === 11 ? 7 : 1) as Marco }))
    const s = secaoDeComentarios(dados({ comentarios: cs }), OPCOES)
    const p1 = s.paineis[1], p7 = s.paineis[7]
    if (p1.kind !== 'lista' || p7.kind !== 'lista') throw new Error('lista')
    expect(p1.movimento.texto).toBe('Este é o primeiro retrato. O dia 7 mostra quem entrou e quem saiu dos 12.')
    expect(p7.movimento.texto).toBe('1 entrou nos 12 do dia 1 ao dia 7')
    expect(p7.movimento.saidas).toBe('2 saíram')
    expect(p7.saidos).toHaveLength(2)
    expect(p7.cartoes.find(c => c.entrouNoDia)?.entrouNoDia).toBe('entrou nos 12 no dia 7')
  })
  it('ids dos cartões nunca se repetem entre painéis', () => {
    const s = secaoDeComentarios(dados(), OPCOES)
    const ids = Object.values(s.paineis).flatMap(p => (p.kind === 'lista' ? [...p.cartoes, ...p.saidos].map(c => c.id) : []))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('C2 · modelo · cartão', () => {
  const um = (c: ReturnType<typeof cartao>) => {
    const p = secaoDeComentarios(dados({ comentarios: [{ ...c, nosMarcos: [7] }] }), OPCOES).paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    return p.cartoes[0]!
  }
  it('resposta do criador nas três formas e nunca "não respondeu"', () => {
    expect(um(cartao(1, 'curtidos', { criador: 'nao_vimos', respostas: 4 })).resposta).toEqual({ forma: 'nao_vimos', texto: 'Não vimos resposta do criador. Conferimos as 4 respostas que o YouTube mostrou e nenhuma é dele.' })
    expect(um(cartao(1, 'curtidos', { criador: 'nao_vimos', respostas: 1 })).resposta).toEqual({ forma: 'nao_vimos', texto: 'Não vimos resposta do criador. Conferimos a única resposta que o YouTube mostrou e ela não é dele.' })
    expect(um(cartao(1, 'curtidos', { criador: 'nao_sabemos', respostas: 62 })).resposta).toEqual({ forma: 'nao_sabemos', texto: 'Não sabemos se o criador respondeu. O YouTube mostrou só 5 das 62 respostas e nenhuma é dele.' })
    expect(um(cartao(1, 'curtidos', { criador: 'respondeu', respostas: 3, respostasDoCriador: [{ texto: 'x', cortado: false }] })).resposta).toMatchObject({ forma: 'respondeu', titulo: 'Leo respondeu' })
  })
  it('com 5 respostas ou menos nunca "Não sabemos"; sem respostas nada', () => {
    expect(um(cartao(1, 'curtidos', { criador: 'nao_sabemos', respostas: 5 })).resposta).toBeNull()
    expect(um(cartao(1, 'curtidos', { criador: 'nao_vimos', respostas: 0 })).resposta).toBeNull()
  })
  it('curtidas: fora dos 12 nunca vira 0; "fecha em" no marco que ainda não existe; mesma escala', () => {
    const v = um(cartao(1, 'curtidos', { curtidas: { 1: 'fora_dos_12', 7: 50, 30: 'ainda_nao' } }))
    expect(v.curtidas.map(c => c.texto)).toEqual(['fora dos 12', '50', 'fecha em 05/11'])
    expect(v.curtidas[0]!.tipo).toBe('fora')
    expect(v.curtidas[1]!.pct).toBe(100)
  })
  it('autor: identidade guardada até, espectador, criador, canal próprio', () => {
    expect(um(cartao(1, 'curtidos', { autor: { tipo: 'com_identidade', nome: 'Ana', fotoUrl: null, guardadaAte: '2026-11-04' } })).autor).toMatchObject({ tipo: 'identidade', ate: '04/11' })
    expect(um(cartao(1, 'curtidos')).autor).toEqual({ tipo: 'espectador' })
    expect(um(cartao(1, 'criador', { doCriador: true, autor: { tipo: 'criador' } })).autor).toEqual({ tipo: 'criador', nome: 'Leo' })
    expect(um(cartao(1, 'canal_proprio')).autor).toEqual({ tipo: 'proprio' })
  })
  it('rodapé: publicado e respostas (singular, plural, zero)', () => {
    expect(um(cartao(1, 'curtidos', { respostas: 62 })).rodape).toEqual({ publicado: 'Publicado em 07/10', respostas: { n: 62, texto: '62 respostas' } })
    expect(um(cartao(1, 'curtidos', { respostas: 1 })).rodape.respostas?.texto).toBe('1 resposta')
    expect(um(cartao(1, 'curtidos', { respostas: 0 })).rodape.respostas?.n).toBe(0)
  })
  it('saiu do YouTube: "hoje (13/10)" ou a data', () => {
    expect(um(cartao(1, 'curtidos', { saiuDoYouTubeDesde: '2026-10-13' })).saiu).toBe('Não veio mais do YouTube desde hoje (13/10). O YouTube não diz por quê.')
    expect(um(cartao(1, 'curtidos', { saiuDoYouTubeDesde: '2026-10-10' })).saiu).toBe('Não veio mais do YouTube desde 10/10. O YouTube não diz por quê.')
  })
  it('endereço no texto é detectado (só como aviso)', () => {
    expect(um(cartao(1, 'curtidos', { texto: 'veja https://exemplo.example/x' })).texto?.temEndereco).toBe(true)
    expect(um(cartao(1, 'curtidos', { texto: 'sem nada' })).texto?.temEndereco).toBe(false)
  })
})

describe('C2 · modelo · níveis', () => {
  const contagem = (): ComentariosDoVideo => ({
    nivel: 'contagem', marcos: dados().marcos,
    comentarios: doze().map(c => ({
      ordem: c.ordem, motivo: c.motivo, curtidas: c.curtidas, respostas: c.respostas, criador: c.criador, criadorNome: c.criadorNome, doCriador: false,
      entrouNoMarco: 7 as Marco, nosMarcos: [7] as Marco[], saiuDoYouTubeDesde: null, faixas: c.faixas,
    })),
  })
  it('contagem: o texto nunca aparece no objeto, nem o autor', () => {
    const s = secaoDeComentarios(contagem(), OPCOES)
    const j = JSON.stringify(s)
    expect(j).not.toContain('Comentário sintético')
    expect(j).not.toContain('Resposta ')
    expect(s.faixa).toBe(FRASES.faixaContagem)
    const p = s.paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    expect(p.cartoes.every(c => c.texto === null && c.textoReservado)).toBe(true)
    expect(p.cartoes[0]!.autor).toEqual({ tipo: 'reservado' })
    expect(p.cartoes.find(c => c.resposta?.forma === 'respondeu')!.resposta).toMatchObject({ textos: null, reservado: 'O criador respondeu. O texto da resposta é reservado.' })
  })
  it('texto: sem nome e sem foto; identidade: sem faixa', () => {
    const t = dados(); const tx = { ...t, nivel: 'texto' as const } as ComentariosDoVideo
    expect(secaoDeComentarios(tx, OPCOES).faixa).toBe(FRASES.faixaTexto)
    expect(secaoDeComentarios(dados(), OPCOES).faixa).toBeNull()
    const c = cartao(1, 'curtidos', { autor: { tipo: 'com_identidade', nome: 'Ana Secreta', fotoUrl: 'https://x.example/f.png', guardadaAte: '2026-11-04' } })
    const s = secaoDeComentarios({ nivel: 'texto', marcos: dados().marcos, comentarios: [{ ...c, nosMarcos: [7] }] } as ComentariosDoVideo, OPCOES)
    expect(JSON.stringify(s)).not.toContain('Ana Secreta')
  })
  it('menções trocadas: o ⓘ avisa do marcador "@…"', () => {
    const c = cartao(1, 'curtidos', { mencoesTrocadas: 2 })
    const s = secaoDeComentarios(dados({ comentarios: [{ ...c, nosMarcos: [7] }] }), OPCOES)
    expect(s.mencoesTrocadas).toBe(2)
    expect(s.info.paragrafos.join(' ')).toContain('@…')
    expect(secaoDeComentarios(dados(), OPCOES).info.paragrafos.join(' ')).not.toContain('@…')
  })
})

describe('C2 · frases', () => {
  const textos = (): string[] => {
    const out: string[] = []
    const ve = (v: unknown): void => {
      if (typeof v === 'string') out.push(v)
      else if (typeof v === 'function') { try { const r = (v as (...a: never[]) => unknown)(...([3, 3, 3] as never[])); ve(r) } catch { /* sem argumentos úteis */ } }
      else if (Array.isArray(v)) v.forEach(ve)
      else if (v && typeof v === 'object') Object.values(v).forEach(ve)
    }
    ve(FRASES); ve(FRASES.infoParagrafos(2))
    return out
  }
  it('as duas retiradas não existem (desvios 17 e 18)', () => {
    const t = textos().join('\n')
    expect(t).not.toMatch(/o nome fica/)
    expect(t).not.toMatch(/Nada foi apagado/)
    expect(t).not.toMatch(/continua lá/)
  })
  it('as acrescentadas existem (desvio 16 e @…)', () => {
    expect(FRASES.naoComecou).toBe('A coleta de comentários ainda não começou.')
    expect(FRASES.parada('08/10')).toBe('A coleta de comentários está parada desde 08/10.')
    expect(FRASES.janelaPerdida(7)).toBe('Não coletado com 7 dias: a coleta não rodou enquanto o vídeo tinha essa idade')
    expect(FRASES.paradaSemOk('08/10')).toContain('sem execução completa desde 08/10')
    expect(FRASES.aCaminho(7, '13/10', '16/10')).toContain('o retrato sai na próxima coleta, até 16/10')
    expect(FRASES.infoParagrafos(1).join(' ')).toContain('“@…”')
  })
  it('nenhuma frase diz "não respondeu"', () => expect(textos().join('\n')).not.toMatch(/não respondeu/i))
  it('o erro de leitura é o do plano', () => expect(FRASES.erroDeLeitura).toBe('Não deu para abrir os comentários agora. A leitura falhou.'))
})

describe('N10b · modelo · lista vazia, erro encerrado, singular e posição', () => {
  const painel = (e: EstadoDoMarco) => {
    const p = secaoDeComentarios(so7(e), { ...OPCOES, marcoAberto: 7 }).paineis[7]
    if (p.kind !== 'estado') throw new Error('estado')
    return p
  }
  const vazia = (total: number | null, encerrada = false): EstadoDoMarco =>
    ({ estado: 'nao_coletado', porque: { causa: 'lista_vazia', tomadoEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA, encerrada, totalDoDia: total } })
  it('lista vazia com total: a data e a contagem guardada; a nota "a contagem diz que há" só aqui', () => {
    const p = painel(vazia(57))
    expect(p.corpo).toBe('Em 13/10 o vídeo tinha 57 comentários pela última contagem, mas o YouTube devolveu a lista vazia.')
    expect(p.nota).toContain('a contagem diz que há')
  })
  it('lista vazia sem total: nenhum algarismo de contagem, nenhum "diz que tem" e nenhuma nota de contagem', () => {
    const p = painel(vazia(null))
    expect(p.corpo).toBe('Em 13/10 o YouTube devolveu a lista vazia.')
    expect(JSON.stringify(p)).not.toMatch(/diz que (tem|há)|contagem diz/)
    expect(p.corpo).not.toMatch(/\d{3}/)
  })
  it('erro por código escolhe a frase (proibido, vídeo não encontrado, o resto), sem texto do banco', () => {
    const erro = (codigo: string): EstadoDoMarco => ({ estado: 'nao_coletado', porque: { causa: 'erro', tentouEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA, encerrada: false, codigo, totalDoDia: null } })
    expect(painel(erro('proibido')).corpo).toMatch(/só para membros/)
    expect(painel(erro('video_nao_encontrado')).corpo).toMatch(/não encontrou este vídeo/)
    expect(painel(erro('rede')).corpo).toBe('O YouTube não devolveu os comentários em 13/10.')
    expect(JSON.stringify(painel(erro('zz-texto-do-banco')))).not.toContain('zz-texto-do-banco')
  })
  it('janela encerrada: nenhuma frase promete "tentamos de novo" (erro e lista vazia)', () => {
    const erro: EstadoDoMarco = { estado: 'nao_coletado', porque: { causa: 'erro', tentouEmMs: T0 + 7 * DIA, ateMs: T0 + 10 * DIA, encerrada: true, codigo: 'rede', totalDoDia: null } }
    for (const e of [erro, vazia(57, true), vazia(null, true)]) {
      const t = JSON.stringify(painel(e))
      expect(t).not.toMatch(/tentamos de novo/i)
      expect(t).toContain('Tentamos até 16/10; esta idade ficou sem retrato.')
    }
    expect(JSON.stringify(painel(vazia(57, false)))).toMatch(/Tentamos de novo até 16\/10/)
  })
  it('retrato ok sem nenhum cartão no marco: "não carregou" com "tentar de novo", não acusa o YouTube', () => {
    const s = secaoDeComentarios({ nivel: 'identidade', comentarios: [], marcos: { 1: { estado: 'fecha_em', fechaEmMs: T0 }, 7: { estado: 'ok', resumo: resumo() }, 30: { estado: 'fecha_em', fechaEmMs: T0 } } }, OPCOES)
    const p = s.paineis[7]
    expect(p).toMatchObject({ kind: 'estado', tentar: true })
    expect(JSON.stringify(p)).not.toMatch(/devolveu a lista vazia/)
    expect(s.abas[1]!.estado).toBe('não carregou')
  })
  it('escolhidos nulo: a aba diz "guardados", sem número (nulo não é 0)', () => {
    const s = secaoDeComentarios(so7({ estado: 'ok', resumo: resumo({ escolhidos: null }) }), OPCOES)
    expect(s.abas[1]!.estado).not.toMatch(/\d/)
  })
  it('um comentário, lote completo, 1 curtida: singular na frase e no rótulo da casa', () => {
    const c = { ...cartao(1, 'curtidos', { curtidas: { 1: 1, 7: 'ainda_nao', 30: 'ainda_nao' }, nosMarcos: [1] as Marco[], entrouNoMarco: 1 as Marco }) }
    const s = secaoDeComentarios(dados({
      comentarios: [c],
      marcos: { 1: { estado: 'ok', resumo: resumo({ idadeHoras: 24, amostraCompleta: true, totalDoDia: 1, amostra: 1, escolhidos: 1 }) }, 7: { estado: 'fecha_em', fechaEmMs: T0 }, 30: { estado: 'fecha_em', fechaEmMs: T0 } },
    }), { ...OPCOES, marcoAberto: 1 })
    const p = s.paineis[1]
    if (p.kind !== 'lista') throw new Error('lista')
    expect(p.frase).toBe('Com 1 dia, guardamos o único comentário do vídeo: 1 mais curtido.')
    expect(p.casas[0]!.rotulo).toBe('Comentário 1 de 1, mais curtido, 1 curtida com 1 dia')
  })
  it('a posição do YouTube desempata empate de curtidas e de respostas', () => {
    const a = cartao(1, 'curtidos', { curtidas: { 1: 'ainda_nao', 7: 10, 30: 'ainda_nao' }, posicao: { 1: null, 7: 9, 30: null } })
    const b = cartao(2, 'curtidos', { curtidas: { 1: 'ainda_nao', 7: 10, 30: 'ainda_nao' }, posicao: { 1: null, 7: 3, 30: null } })
    const s = secaoDeComentarios(dados({ comentarios: [a, b] }), OPCOES)
    const p = s.paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    expect(p.cartoes.map((x) => x.id)).toEqual(['cd-7-2', 'cd-7-1'])
  })
})
