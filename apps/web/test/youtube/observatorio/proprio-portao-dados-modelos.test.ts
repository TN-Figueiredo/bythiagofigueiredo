// @vitest-environment node
// Portão final de dados da A4 (13/10): os consertos que moram nos modelos.
//  I1  o teto de 50 vídeos do diário nunca corta em silêncio: nenhuma soma sai menor sem aviso e o cartão do vídeo cortado não diz "poucos dias";
//  I3  coleta de alcance parada há mais de 35 dias diz "parou em dd/mm" (nunca "ainda não há relatório"); nunca houve continua "ainda não há";
//  I4  o total do canal diz que inclui impressões de antes da publicação (só quando existem) e a contagem não muda nenhum total por vídeo;
//  I5  a dica do % assistido diz só COMO o número é calculado, sem afirmar igualdade com o YouTube;
//  M3  um CTR nulo derruba a taxa, e a frase diz de quantos dias; M4 as frases de causa não afirmam o que não foi lido.
import { afterEach, describe, it, expect } from 'vitest'
import { proprioWorld, alcanceVazio, alcanceCheio } from './proprio-fixture'
import { mundoVideo } from './proprio-video-fixture'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { buildProprioHeader, fraseDoAlcance, FRASE_SEM_RELATORIO } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { buildProprioVideos } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { montarComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { buildRetencao, METODO_ASSISTIDO } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-model'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { SEM_RELATORIO } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { assistidoDoCanal, viewsDoCanalPorDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/canal-agregados'
import { montarSoSeuCanalDado } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { alcanceAntesDaPublicacao, alcancePorVideo, publicacoesDe, resumir } from '@/lib/youtube/observatorio/proprio/dias'
import { baseVpdTexto, motivoVpdTexto, vpdDoCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import type { AlcanceCanal, DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const W = proprioWorld()
const d = (n: number) => addDays(W.hoje, -n)
const dm = (x: string) => dmDia(x)
const VIDEOS = W.obs.videos.filter(x => x.ch === W.canalId).map(x => ({ id: x.id, ytId: x.ytId, title: x.title, thumb: null }))
const PUBS = publicacoesDe(W.obs.videos.filter(x => x.ch === W.canalId))
const diarioOk = (w = W): DiarioCanal => { if (w.dados.diario.acesso !== 'ok') throw new Error('esperava diário'); return w.dados.diario.dado }
const alcanceOk = (w = W): AlcanceCanal => { if (w.dados.alcance.acesso !== 'ok') throw new Error('esperava alcance'); return w.dados.alcance.dado }
const header = (dados: DadosDoCanal) => buildProprioHeader(W.obs, W.canalId, dados, { hoje: W.hoje, dm, posicao: null, muitosProprios: false })!
const cel = (h: ReturnType<typeof header>, key: string) => {
  const c = [...h.faixa, ...h.todos].find(x => x.key === key)
  if (!c) throw new Error('célula inexistente: ' + key)
  return c
}
const comoEsta = (dados: DadosDoCanal) => montarComoEsta({ dados, hoje: W.hoje, dm, posicao: null, posicaoItens: null, videos: VIDEOS, concorrentes: [], canalId: W.canalId, publicacoes: PUBS })

const FRASE_FORA = (k: number) => `A leitura diária cobre só os 50 longos mais novos; ${k} ${k === 1 ? 'longo mais antigo ficou' : 'longos mais antigos ficaram'} de fora.`

/* ---------------------------------------------------------------- I1 */

describe('I1: o corte dos 50 longos mais novos é dito, nunca silencioso', () => {
  const [A, B, C] = W.ytIds as [string, string, string]
  /** O diário como o leitor o entrega com `fora` além do teto: sem linha deles e com a lista de quem ficou de fora. Todo dia traz % assistido 50. */
  const comCorte = (fora: string[]): DadosDoCanal => {
    const di = diarioOk()
    const linhas = di.linhas.filter(l => !fora.includes(l.ytId)).map(l => ({ ...l, pctAssistido: 50 }))
    return { ...W.dados, diario: { acesso: 'ok', dado: { ...di, linhas, foraDoTeto: fora } } }
  }

  it('vpdDoCanal: a mediana é dos lidos e o resultado diz quantos ficaram de fora; a base escrita também', () => {
    const di = comCorte([C]).diario as Privado<DiarioCanal>
    const v = vpdDoCanal(di, [A, B, C], W.hoje)
    expect(v.motivo).toBeNull()
    expect(v.n).toBe(2)
    expect(v.foraDoTeto).toBe(1)
    expect(baseVpdTexto(v, dm)).toContain('1 longo mais antigo ficou de fora da leitura')
    const sem = vpdDoCanal(comCorte([]).diario, [A, B, C], W.hoje)
    expect(sem.foraDoTeto).toBe(0)
    expect(baseVpdTexto(sem, dm)).not.toContain('de fora')
  })
  it('vpdDoCanal de UM vídeo cortado: motivo próprio, nunca "poucos dias medidos"', () => {
    const di = comCorte([C]).diario
    const v = vpdDoCanal(di, [C], W.hoje)
    expect(v.valor).toBeNull()
    expect(v.motivo).toBe('fora-da-leitura')
    expect(motivoVpdTexto('fora-da-leitura', v, dm)).toBe('este vídeo ficou fora da leitura diária, que cobre só os 50 longos mais novos')
    // o vídeo lido, sem linhas, continua sendo "poucos dias" (a causa verdadeira dele)
    const lidoSemLinha: Privado<DiarioCanal> = { acesso: 'ok', dado: { ...diarioOk(), linhas: [], foraDoTeto: [C] } }
    expect(vpdDoCanal(lidoSemLinha, [A], W.hoje).motivo).toBe('poucos-dias')
  })
  it('assistidoDoCanal e viewsDoCanalPorDia contam os pedidos que ficaram de fora (só os pedidos)', () => {
    const di = comCorte([B, C]).diario
    expect(assistidoDoCanal(di, [A, B, C]).foraDoTeto).toBe(2)
    expect(assistidoDoCanal(di, [A]).foraDoTeto).toBe(0)
    expect(viewsDoCanalPorDia(di, [A, B, C]).foraDoTeto).toBe(2)
    expect(viewsDoCanalPorDia(comCorte([]).diario, [A, B, C]).foraDoTeto).toBe(0)
    expect(assistidoDoCanal({ acesso: 'negado' }, [A]).foraDoTeto).toBe(0)
  })
  it('"Como o canal está": o gráfico da soma dos vídeos avisa que não é o canal inteiro; sem corte, nenhum aviso desse tipo', () => {
    const com = comoEsta(comCorte([B, C])).graficoViews
    expect(com.avisos).toContain(FRASE_FORA(2))
    const sem = comoEsta(comCorte([])).graficoViews
    expect(sem.avisos.some(a => a.includes('de fora'))).toBe(false)
  })
  it('cabeçalho: a base do % assistido e a das views por dia dizem quantos longos ficaram de fora', () => {
    const h = header(comCorte([C]))
    expect(cel(h, 'assistido').base).toContain(FRASE_FORA(1))
    expect(cel(h, 'vpdVideo').base).toContain('1 longo mais antigo ficou de fora da leitura')
    const sem = header(comCorte([]))
    expect(cel(sem, 'assistido').base).not.toContain('de fora')
  })
  it('aba de % assistido: a nota diz quantos longos ficaram de fora', () => {
    expect(buildRetencao(W.obs, W.canalId, comCorte([B, C]), { dm }).nota).toContain(FRASE_FORA(2))
    expect(buildRetencao(W.obs, W.canalId, comCorte([]), { dm }).nota).not.toContain('de fora')
  })
  it('cartão do vídeo cortado: a causa é o corte, nunca "menos de 7 dias medidos"', () => {
    const v = buildProprioVideos(W.obs, W.canalId, comCorte([C]), { hoje: W.hoje, dm })!
    const cartao = v.videos.find(x => x.ytId === C)!
    expect(cartao.vpdDiarioMissing).toBe('este vídeo ficou fora da leitura diária, que cobre só os 50 longos mais novos')
    expect(cartao.vpdDiarioText).toBeNull()
    expect(cartao.notas.join(' ')).not.toContain('menos de 7 dias')
    const outro = v.videos.find(x => x.ytId === A)!
    expect(outro.vpdDiarioMissing).toBeNull()
  })
})

/* ---------------------------------------------------------------- I3 */

describe('I3: coleta de alcance parada há mais de 35 dias diz desde quando', () => {
  const paradoHa = (n: number): AlcanceCanal => ({ canalId: W.canalId, relatorios: [], linhas: [], ultimoRelatorio: d(n), descartados: 0 })
  const dadosCom = (alcance: AlcanceCanal): DadosDoCanal => ({ ...W.dados, alcance: { acesso: 'ok', dado: alcance } })
  const FRASE = (n: number) => `A coleta de relatórios deste canal parou em ${dm(d(n))}; nenhum dia dos últimos 35 foi medido.`
  const CELULA = (n: number) => `a coleta de relatórios deste canal parou em ${dm(d(n))}; nenhum dia dos últimos 35 foi medido`

  it('relatório há 36 dias (a janela de 35 vem vazia): a frase tem a data e nunca "Ainda não há relatório"', () => {
    const dados = dadosCom(paradoHa(36))
    const c = comoEsta(dados)
    expect(c.view.frase).toBe(FRASE(36))
    expect(c.view.recolhida.startsWith(FRASE(36))).toBe(true)
    expect(c.grafico.vazio).toBe(FRASE(36))
    for (const t of [c.view.frase, c.view.recolhida, c.grafico.vazio ?? '']) expect(t).not.toContain('Ainda não há relatório')
    const h = header(dados)
    expect(cel(h, 'impressoes').missing).toBe(CELULA(36))
    expect(cel(h, 'taxaClique').missing).toBe(CELULA(36))
    expect(h.resumo?.resto).toBe(`; a coleta de relatórios parou em ${dm(d(36))}.`)
    expect([...h.faixa, ...h.todos].map(x => x.missing).join('|')).not.toContain('ainda sem relatório')
    expect(buildProprioVideos(W.obs, W.canalId, dados, { hoje: W.hoje, dm })!.motivoAlcance).toBe(CELULA(36))
  })
  it('relatório há 34 dias (dentro da janela): continua o caminho de sempre, com "parou em dd/mm"', () => {
    const dados = dadosCom({ canalId: W.canalId, relatorios: [{ dia: d(34), status: 'baixado', normalizado: true }], linhas: [], ultimoRelatorio: d(34), descartados: 0 })
    const c = comoEsta(dados)
    expect(c.view.recolhida).toContain(`A coleta parou em ${dm(d(34))}.`)
    expect(c.view.frase).not.toContain('nenhum dia dos últimos 35')
    expect(c.grafico.avisos.join(' ')).toContain(`A coleta de relatórios deste canal parou em ${dm(d(34))}.`)
  })
  it('nunca houve relatório (ultimoRelatorio nulo): continua "Ainda não há relatório"', () => {
    const dados = dadosCom(alcanceVazio(W.canalId))
    const c = comoEsta(dados)
    expect(c.view.frase).toBe(SEM_RELATORIO)
    expect(c.grafico.vazio).toBe(SEM_RELATORIO)
    expect(cel(header(dados), 'impressoes').missing).toBe(FRASE_SEM_RELATORIO)
    expect(header(dados).resumo?.resto).toBe('; ainda sem números de alcance.')
    expect(fraseDoAlcance('sem-relatorio')).toBe(FRASE_SEM_RELATORIO)
  })
  it('página do vídeo: o bloco de impressões diz desde quando parou (e "ainda não há" quando nunca houve)', () => {
    const w = mundoVideo()
    const di = (w.dados.diario as { dado: DiarioCanal }).dado
    const bl = (alc: AlcanceCanal) => buildVideoBlocos({ obs: w.obs, videoId: w.foco.id, dados: { acesso: 'ok', dado: { alcance: alc, diario: di } }, hoje: w.hoje, dm })
    const parado = bl({ canalId: w.canalId, relatorios: [], linhas: [], ultimoRelatorio: addDays(w.hoje, -40), descartados: 0 })
    expect(parado.impressoes?.frase).toBe(`A coleta de relatórios deste canal parou em ${dm(addDays(w.hoje, -40))}; nenhum dia dos últimos 35 foi medido.`)
    expect(bl(alcanceVazio(w.canalId)).impressoes?.frase).toBe(SEM_RELATORIO)
  })
  it('cartão da comparação: a frase diz desde quando parou; nunca houve mantém "ainda não chegaram"', () => {
    const base = { nome: 'Meu canal', diario: W.dados.diario, longos: W.ytIds, dm, F: { int: (n: number) => String(n) }, hoje: W.hoje }
    const parado = montarSoSeuCanalDado({ ...base, alcance: { acesso: 'ok', dado: paradoHa(36) } })
    expect(parado.view?.frase).toContain(`parou em ${dm(d(36))}; nenhum dia dos últimos 35 foi medido`)
    expect(parado.view?.frase).not.toContain('ainda não chegaram')
    expect(parado.view?.naoMedido).toBe(true)
    const nunca = montarSoSeuCanalDado({ ...base, alcance: { acesso: 'ok', dado: alcanceVazio(W.canalId) } })
    expect(nunca.view?.frase).toContain('ainda não chegaram')
  })
})

/* ---------------------------------------------------------------- I4 */

describe('I4: o total do canal inclui o que veio antes da publicação, e isso é dito (só quando existe)', () => {
  // um longo publicado há 10 dias: as linhas dele de antes da publicação existem no relatório do canal, mas não entram no total DELE
  const mut = (ds: { videos: Array<{ ch: string; tracked: boolean; fmt: string; ageDays: number; pub: number }> }) => {
    const v = ds.videos.filter(x => x.tracked && x.fmt === 'long').sort((a, b) => a.ageDays - b.ageDays)[0]
    if (!v) throw new Error('sem longo')
    v.pub += (v.ageDays - 10) * 86_400_000; v.ageDays = 10
  }
  const Wn = proprioWorld({ mut })
  const novo = Wn.obs.videos.filter(v => v.ch === Wn.canalId).sort((a, b) => a.ageDays - b.ageDays)[0]!
  const pubs = publicacoesDe(Wn.obs.videos.filter(v => v.ch === Wn.canalId))
  const pubDia = pubs.get(novo.ytId)!
  const base = (): AlcanceCanal => alcanceOk(Wn)
  const antes = (imp: number): AlcanceCanal => ({ ...base(), linhas: [...base().linhas, { ytId: novo.ytId, dia: addDays(pubDia, -2), imp, ctr: 0.1 }] })
  const h = (a: AlcanceCanal) => buildProprioHeader(Wn.obs, Wn.canalId, { ...Wn.dados, alcance: { acesso: 'ok', dado: a } }, { hoje: Wn.hoje, dm, posicao: null, muitosProprios: false })!
  const celula = (hh: ReturnType<typeof h>, key: string) => [...hh.faixa, ...hh.todos].find(x => x.key === key)!

  it('alcanceAntesDaPublicacao conta linhas e impressões que o corte do vídeo descarta, e nada mais', () => {
    expect(alcanceAntesDaPublicacao(antes(50), pubs)).toEqual({ linhas: 1, imp: 50 })
    expect(alcanceAntesDaPublicacao(base(), pubs)).toEqual({ linhas: 0, imp: 0 })
    // vídeo sem data de publicação: nenhum corte, nada a contar
    expect(alcanceAntesDaPublicacao(antes(50), new Map([[novo.ytId, null]]))).toEqual({ linhas: 0, imp: 0 })
    // linha sem impressão não conta
    expect(alcanceAntesDaPublicacao({ ...base(), linhas: [{ ytId: novo.ytId, dia: addDays(pubDia, -2), imp: null, ctr: null }] }, pubs)).toEqual({ linhas: 0, imp: 0 })
  })
  it('contar não muda o total por vídeo: o do vídeo continua sem as linhas anteriores à publicação', () => {
    const sem = alcancePorVideo(base(), pubs).get(novo.ytId)
    const com = alcancePorVideo(antes(50), pubs).get(novo.ytId)
    expect(com).toEqual(sem)
  })
  it('o ⓘ das impressões e dos cliques do cabeçalho diz que o total do canal inclui impressões de antes da publicação (e quantas)', () => {
    const frase = 'O total do canal inclui 50 impressões de dias anteriores à publicação do vídeo; o total de cada vídeo começa no dia da publicação, então a soma dos vídeos pode ser menor.'
    expect(celula(h(antes(50)), 'impressoes').base).toContain(frase)
    expect(celula(h(antes(50)), 'cliques').base).toContain(frase)
    expect(celula(h(antes(1)), 'impressoes').base).toContain('O total do canal inclui 1 impressão de dias anteriores')
    expect(celula(h(base()), 'impressoes').base).not.toContain('anteriores à publicação')
    expect(celula(h(base()), 'cliques').base).not.toContain('anteriores à publicação')
  })
})

/* ---------------------------------------------------------------- I5 */

describe('I5: a dica do % assistido diz só como é calculado', () => {
  it('a dica da tela do vídeo não afirma igualdade com o YouTube e conserva a conta', () => {
    const w = mundoVideo()
    const di = (w.dados.diario as { dado: DiarioCanal }).dado
    const al = (w.dados.alcance as { dado: AlcanceCanal }).dado
    const metodo = buildVideoBlocos({ obs: w.obs, videoId: w.foco.id, dados: { acesso: 'ok', dado: { alcance: al, diario: di } }, hoje: w.hoje, dm }).assistido!.metodo.join(' ')
    expect(metodo).not.toMatch(/mesmo valor|YouTube calcula/)
    expect(metodo).toContain('É a média do percentual de cada dia, pesada pelas views do dia.')
  })
  it('a dica da aba Retenção do canal também', () => {
    const texto = METODO_ASSISTIDO.join(' ')
    expect(texto).not.toMatch(/mesmo resultado|YouTube calcula/)
    expect(texto).toContain('média do percentual de cada dia, pesada pelas views do dia.')
  })
})

/* ---------------------------------------------------------------- M3 e M4 */

describe('M3: o CTR nulo derruba a taxa e a frase diz de quantos dias', () => {
  const comCtrNulo = (dias: number): DadosDoCanal => {
    const a = alcanceCheio(W.canalId, W.ytIds, W.hoje)
    let n = 0
    const linhas = a.linhas.map(l => (n < dias && l.ytId === W.ytIds[0] ? (n++, { ...l, ctr: null }) : l))
    return { ...W.dados, alcance: { acesso: 'ok', dado: { ...a, linhas } } }
  }
  it('resumir conta os dias com impressão e sem taxa', () => {
    expect(resumir([{ dia: d(5), situacao: 'com-impressoes', motivo: null, imp: 5, cliques: null }, { dia: d(4), situacao: 'com-impressoes', motivo: null, imp: 5, cliques: 1 }]).diasSemCtr).toBe(1)
    expect(resumir([]).diasSemCtr).toBe(0)
  })
  it('"Como o canal está": 1 dia e 3 dias, no singular e no plural', () => {
    expect(comoEsta(comCtrNulo(1)).view.taxa.vazio).toBe('Não dá para calcular a taxa: o YouTube não informou a taxa de clique de 1 dia com impressões.')
    expect(comoEsta(comCtrNulo(3)).view.taxa.vazio).toBe('Não dá para calcular a taxa: o YouTube não informou a taxa de clique de 3 dias com impressões.')
  })
})

describe('M4: as frases de causa não afirmam o que não foi lido', () => {
  it('a régua do vídeo: sem % assistido diz "sem medida" (a mesma frase vale para Short e para vídeo além do teto, que não foram lidos)', () => {
    const w = mundoVideo({ diario: { viewsFoco: 0 } })
    const b = buildVideoBlocos({ obs: w.obs, videoId: w.foco.id, dados: { acesso: 'ok', dado: { alcance: (w.dados.alcance as { dado: AlcanceCanal }).dado, diario: (w.dados.diario as { dado: DiarioCanal }).dado } }, hoje: w.hoje, dm })
    const l = b.canal.reguas.linhas.find(x => x.numero === 'assistido')!
    expect(l.valor).toBeNull()
    expect(l.semRegua).toBe('sem medida')
  })
  // o vídeo mais novo do canal passa a ter `idade` dias de vida; o último relatório de alcance é de hoje-10 (a coleta atrasou)
  const paginaDoNovo = (idade: number) => {
    const w = mundoVideo({ mut: ds => {
      const dono = ds.channels.find(c => c.own)!.id
      const v = ds.videos.filter(x => x.ch === dono && x.tracked && x.fmt === 'long').sort((a, b) => a.ageDays - b.ageDays)[0]!
      v.pub += (v.ageDays - idade) * 86_400_000; v.ageDays = idade
    } })
    const novo = w.obs.videos.filter(v => v.ch === w.canalId && v.fmt === 'long' && v.tracked).sort((a, b) => a.ageDays - b.ageDays)[0]!
    const ate = addDays(w.hoje, -10)
    const alc: AlcanceCanal = { canalId: w.canalId, relatorios: [{ dia: addDays(ate, -1), status: 'baixado', normalizado: true }, { dia: ate, status: 'baixado', normalizado: true }], linhas: [], ultimoRelatorio: ate, descartados: 0 }
    const di = (w.dados.diario as { dado: DiarioCanal }).dado
    const impressoes = buildVideoBlocos({ obs: w.obs, videoId: novo.id, dados: { acesso: 'ok', dado: { alcance: alc, diario: di } }, hoje: w.hoje, dm }).impressoes
    return { impressoes, ate }
  }
  it('I1 do portão de software: vídeo de 5 dias e último relatório 10 dias atrás NÃO é "vídeo novo": diz o último dia recebido e "ainda não medido" (a causa do cartão)', () => {
    const { impressoes, ate } = paginaDoNovo(5)
    expect(impressoes?.medido).toBe(false)
    expect(impressoes?.frase).toBe(`O último dia de alcance recebido é ${dm(ate)}, anterior à publicação deste vídeo: ainda não medido.`)
    expect(impressoes?.frase).not.toContain('Vídeo novo')
  })
  it('vídeo realmente novo (1 dia de vida) continua dizendo "Vídeo novo"', () => {
    expect(paginaDoNovo(1).impressoes?.frase).toBe('Vídeo novo: os números de alcance chegam com 2 a 3 dias de atraso, então ainda não há dia deste vídeo.')
  })
})
