import { DHASH_MAX_SAME, dhashOf, hamming } from '@/lib/youtube/thumb-fingerprint'
import { PORTAO, Recusa } from './regras'
import { classificar, horas, lacunas, primeiraEstavel, type Sonda } from './classificar'
import { baixar, dhashComoHq, gerarImagemTeste, maiorCopia, urlDaVariante, type Variante } from './imagem'
import { sha256, type Diario, type Estado, type Medida } from './diario'
import type { Escritor } from './youtube'

export interface Sinal { parar: boolean }
export interface Deps {
  video: string
  diario: Diario
  f: typeof fetch
  sondar: (video: string) => Promise<{ dhash: string | null; etag: string | null }>
  escritor: () => Promise<Escritor>
  agora: () => number
  dormir: (ms: number, sinal: Sinal) => Promise<void>
  sinal: Sinal
  log: (linha: string) => void
}
export interface Saida { codigo: 0 | 1 | 2 | 3; mensagem: string }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const cmd = (c: string, v: string) => `bash scripts/portao-dhash.sh ${c} ${v}`

interface Preparo { variante: Variante; largura: number; altura: number; maior: Buffer; hq: Buffer; dhashHq: string; teste: Buffer; dhashTeste: string; distancia: number }

async function preparar(d: Deps, aceitarMenor: boolean): Promise<Preparo> {
  const maior = await maiorCopia(d.video, d.f)
  const hq = await baixar(urlDaVariante(d.video, 'hqdefault'), d.f)
  if (!hq) throw new Recusa('o YouTube não serve a hqdefault deste vídeo: sem ela não há o que medir')
  const dhashHq = await dhashOf(hq)
  const coerencia = hamming(await dhashComoHq(maior.bytes), dhashHq)
  if (coerencia > DHASH_MAX_SAME) throw new Recusa(`a ${maior.variante} não bate com a hqdefault (distância ${coerencia}): a cópia grande pode ser antiga`)
  if (maior.variante !== 'maxresdefault' && !aceitarMenor)
    throw new Recusa(`a original só existe em ${maior.variante} (${maior.largura}×${maior.altura}); devolver sobe essa imagem. Rode com --aceitar-menor se o dono aceitar, ou use o vídeo reserva`)
  const teste = await gerarImagemTeste(maior.bytes)
  if (teste.length > PORTAO.limiteBytes) throw new Recusa(`a imagem de teste passou de 2 MB (${teste.length} bytes)`)
  const dhashTeste = await dhashComoHq(teste)
  const distancia = hamming(dhashTeste, dhashHq)
  if (distancia < PORTAO.distanciaMinimaTeste) throw new Recusa(`a imagem de teste ficou perto demais da original (${distancia} < ${PORTAO.distanciaMinimaTeste})`)
  return { variante: maior.variante, largura: maior.largura, altura: maior.altura, maior: maior.bytes, hq, dhashHq, teste, dhashTeste, distancia }
}

export async function ensaio(d: Deps, aceitarMenor: boolean): Promise<Saida> {
  const p = await preparar(d, aceitarMenor)
  d.log(`original: ${p.variante} ${p.largura}×${p.altura}; teste a ${p.distancia} bits da original; limite ${DHASH_MAX_SAME}`)
  d.log(`cota prevista: 101 unidades (151 no pior caso); sonda a cada ${PORTAO.intervaloMs / 60_000} min, teto ${PORTAO.tetoMs / 3_600_000} h para aparecer e ${PORTAO.tetoMs / 3_600_000} h para voltar`)
  d.log(`pasta de trabalho: ${d.diario.pasta}${d.diario.temAlgo() ? ' (JÁ USADA: valer vai recusar)' : ''}`)
  return { codigo: 0, mensagem: 'ensaio: nada foi escrito no YouTube nem no disco' }
}

export async function valer(d: Deps, aceitarMenor: boolean): Promise<Saida> {
  if (d.diario.temAlgo()) throw new Recusa(`a pasta ${d.diario.pasta} já tem arquivos: rode "${cmd('devolver', d.video)}" ou "conferir"; para medir de novo, mova a pasta`)
  const p = await preparar(d, aceitarMenor)
  const esc = await d.escritor()
  const v = await esc.conferirVideo(d.video)
  if (!v) throw new Recusa('videos.list não devolveu o vídeo (apagado ou fora do alcance desta credencial)')
  if (v.canal !== esc.canal) throw new Recusa(`o vídeo é do canal ${v.canal}, não de ${esc.canal}`)
  if (v.privacidade !== 'public') throw new Recusa(`o vídeo está ${v.privacidade}, não público`)
  if (d.sinal.parar) throw new Recusa('interrompido antes de escrever: nada foi trocado')
  let etagAntes: string | null = null
  try { etagAntes = (await d.sondar(d.video)).etag } catch { /* sem ETag anterior: a (ii) sai "sem conclusão" */ }

  const criadoEm = new Date(d.agora()).toISOString()
  const e: Estado = {
    versao: 1, video: d.video, fase: 'preparado', criadoEm, atualizadoEm: criadoEm,
    original: { variante: p.variante, largura: p.largura, altura: p.altura, sha256: d.diario.salvarUmaVez('original-maior.jpg', p.maior), sha256Hq: d.diario.salvarUmaVez('original-hq.jpg', p.hq), dhashHq: p.dhashHq },
    teste: { sha256: d.diario.salvarUmaVez('teste-1280x720.jpg', p.teste), dhashComoHq: p.dhashTeste, distanciaDoOriginal: p.distancia },
    trocaEm: null, devolucaoEm: null, cotaGasta: PORTAO.cota.videosList, tentativasDevolucao: 0, aparicao: null, volta: null, etagAntes,
  }
  d.diario.gravar(e)
  d.diario.registrar('preparado', { variante: p.variante, distancia: p.distancia, etagAntes })

  // a cópia que vai servir à devolução é a do DISCO, não a da memória (falta de luz, disco com defeito)
  const doDisco = d.diario.lerArquivo('original-maior.jpg')
  if (sha256(doDisco) !== e.original.sha256) throw new Recusa('a cópia da original gravada no disco não confere (sha256): nada foi trocado')
  const dist = hamming(await dhashComoHq(doDisco), p.dhashHq)
  if (dist > DHASH_MAX_SAME) throw new Recusa(`a cópia da original no disco não bate com a hqdefault (distância ${dist}): nada foi trocado`)

  let falha: unknown = null
  try {
    e.fase = 'trocando'; d.diario.gravar(e)          // ANTES da API: um processo morto aqui ainda é devolvido
    await esc.definirThumb(d.video, p.teste)
    e.cotaGasta += PORTAO.cota.thumbnailsSet; e.trocaEm = d.agora(); e.fase = 'trocada'; d.diario.gravar(e)
    d.diario.registrar('trocada')
    e.aparicao = await sondarAte(d, 'teste', e.trocaEm, e)
    d.diario.gravar(e)
  } catch (err) { falha = err }
  if (falha !== null) {
    try { d.diario.registrar('erro_com_a_troca_no_ar', { erro: msg(falha) }); d.log(`erro: ${msg(falha)}. Devolvendo a original.`) } catch { /* a devolução vem antes de qualquer aviso */ }
  }
  return devolverEConferir(d, e, esc)                // sempre, depois de 'trocando'
}

export async function devolver(d: Deps): Promise<Saida> {
  const e = d.diario.ler()
  if (!e) throw new Recusa(`não há estado em ${d.diario.pasta}: este script não trocou nada neste vídeo`)
  if (e.fase === 'preparado') {
    // o diário pode estar atrás do mundo (falta de luz antes do rename de 'trocando'): olhar a hqdefault pública (cota zero)
    let r: { dhash: string | null } = { dhash: null }
    try { r = await d.sondar(d.video) } catch { /* sem leitura */ }
    const leitura = classificar(r.dhash, { original: e.original.dhashHq, teste: e.teste.dhashComoHq }).leitura
    if (leitura === 'teste') {
      d.log('o diário diz "preparado", mas a hqdefault pública mostra a imagem de teste: devolvendo a original')
      return devolverEConferir(d, e, await d.escritor())
    }
    if (leitura === 'original') return { codigo: 0, mensagem: 'nada foi escrito no YouTube (fase preparado; a hqdefault pública mostra a original)' }
    return { codigo: 1, mensagem: `fase preparado, mas não consegui ler a hqdefault (${leitura}): confira a thumbnail do vídeo ${e.video} no Studio antes de dar por terminado` }
  }
  return devolverEConferir(d, e, await d.escritor())
}

export async function conferir(d: Deps): Promise<Saida> {
  const e = d.diario.ler()
  if (!e || e.devolucaoEm === null) throw new Recusa('não há devolução registrada para conferir; se a troca aconteceu, rode devolver')
  e.volta = await sondarAte(d, 'original', e.devolucaoEm, e)
  e.fase = e.volta.motivo === 'estavel' ? 'conferida' : 'devolvida_sem_conferir'
  d.diario.gravar(e)
  return fechar(d, e)
}

async function devolverEConferir(d: Deps, e: Estado, esc: Escritor): Promise<Saida> {
  const original = d.diario.lerArquivo('original-maior.jpg')
  if (sha256(original) !== e.original.sha256) {
    e.fase = 'devolucao_falhou'; d.diario.gravar(e)
    return { codigo: 3, mensagem: `A CÓPIA DA ORIGINAL MUDOU NO DISCO (sha256 diferente). Nada foi enviado. Confira ${d.diario.pasta}` }
  }
  e.fase = 'devolvendo'; d.diario.gravar(e)
  const semParar: Sinal = { parar: false }          // a devolução não obedece a Ctrl-C
  for (let t = 1; t <= PORTAO.tentativasDevolucao; t++) {
    e.tentativasDevolucao++
    try {
      await esc.definirThumb(e.video, original)
      e.cotaGasta += PORTAO.cota.thumbnailsSet; e.devolucaoEm = d.agora(); e.fase = 'devolvida'; d.diario.gravar(e)
      d.diario.registrar('devolvida', { tentativa: t })
      break
    } catch (err) {
      d.diario.registrar('devolucao_falhou', { tentativa: t, erro: msg(err) })
      if (t < PORTAO.tentativasDevolucao) await d.dormir(PORTAO.esperaEntreDevolucoesMs, semParar)
    }
  }
  if (e.fase !== 'devolvida') {
    e.fase = 'devolucao_falhou'; d.diario.gravar(e)
    return { codigo: 3, mensagem: `A ORIGINAL NÃO FOI DEVOLVIDA. Rode: ${cmd('devolver', e.video)}. Sem cota, suba à mão no Studio o arquivo ${d.diario.pasta}/original-maior.jpg` }
  }
  e.volta = await sondarAte(d, 'original', e.devolucaoEm!, e)
  e.fase = e.volta.motivo === 'estavel' ? 'conferida' : 'devolvida_sem_conferir'
  d.diario.gravar(e)
  return fechar(d, e)
}

function fechar(d: Deps, e: Estado): Saida {
  const r = montarResultado(e)
  d.diario.escrever('resultado.md', r + '\n')
  d.log(r)
  if (e.fase === 'devolvida_sem_conferir') return { codigo: 1, mensagem: `a original foi enviada, mas a volta não foi conferida. Rode: ${cmd('conferir', e.video)}` }
  return { codigo: e.aparicao?.motivo === 'estavel' ? 0 : 1, mensagem: `pronto. Resultado em ${d.diario.pasta}/resultado.md` }
}

async function sondarAte(d: Deps, alvo: 'teste' | 'original', desde: number, e: Estado): Promise<Medida> {
  const ref = { original: e.original.dhashHq, teste: e.teste.dhashComoHq }
  const leituras: Sonda[] = []
  let primeiraEm: number | null = null
  let menor: number | null = null
  const fim = (motivo: Medida['motivo'], estavel?: Sonda): Medida => ({
    motivo, primeiraEm, estavelEm: estavel?.em ?? null,
    distanciaNaEstavel: estavel ? (alvo === 'teste' ? estavel.dTeste : estavel.dOriginal) : null,
    menorDistancia: menor, sondas: leituras.length, etagNaEstavel: estavel?.etag ?? null,
    outras: leituras.filter((l) => l.leitura === 'outra').length,
    semDado: leituras.filter((l) => l.leitura === 'sem_dado').length,
    lacunas: lacunas(leituras.map((l) => l.em), PORTAO.intervaloMs),
  })
  for (;;) {
    if (d.sinal.parar) return fim('parado')
    let r: { dhash: string | null; etag: string | null }
    try { r = await d.sondar(d.video) } catch (err) { r = { dhash: null, etag: null }; d.diario.registrar('sonda_falhou', { erro: msg(err) }) }
    const s: Sonda = { em: d.agora(), dhash: r.dhash, etag: r.etag, ...classificar(r.dhash, ref) }
    leituras.push(s)
    d.diario.registrar('sonda', { alvo, horasDesde: horas(s.em - desde), ...s })
    const dist = alvo === 'teste' ? s.dTeste : s.dOriginal
    if (dist !== null && (menor === null || dist < menor)) menor = dist
    if (s.leitura === alvo && primeiraEm === null) primeiraEm = s.em
    const i = primeiraEstavel(leituras, alvo, PORTAO.sondasEstaveis)
    if (i !== null) return fim('estavel', leituras[i]!)
    if (d.agora() - desde >= PORTAO.tetoMs) return fim('teto')
    await d.dormir(PORTAO.intervaloMs, d.sinal)
  }
}

export function montarResultado(e: Estado): string {
  const item = (m: Medida | null) => {
    if (!m) return 'não medido'
    if (m.motivo === 'estavel') return `${m.distanciaNaEstavel} (limite ${DHASH_MAX_SAME}): passou`
    const falhou = m.menorDistancia !== null && m.menorDistancia > DHASH_MAX_SAME && m.menorDistancia < PORTAO.distanciaMinimaTeste
    return `não estabilizou (${m.motivo}); menor distância vista ${m.menorDistancia ?? 'nenhuma'}: ${falhou ? 'FALHOU: a tolerância é decidida com o dono' : 'sem conclusão'}`
  }
  const tempo = (m: Medida | null, desde: number | null) =>
    m?.estavelEm != null && desde !== null
      ? `${horas(m.estavelEm - desde)} h (primeira leitura em ${horas(m.primeiraEm! - desde)} h${m.lacunas ? `; ${m.lacunas} lacunas: medida imprecisa` : ''})`
      : 'não medido'
  const segunda = (x: Estado) => {
    const v = x.volta
    if (!v) return 'não medido'
    if (v.motivo !== 'estavel') return item(v)
    const base = `${v.distanciaNaEstavel} (limite ${DHASH_MAX_SAME})`
    if (x.aparicao?.motivo !== 'estavel') return `${base}: sem conclusão: a imagem de teste não chegou a aparecer, a volta pode ser cache`
    if (!x.etagAntes || !v.etagNaEstavel || x.etagAntes === v.etagNaEstavel) return `${base}: sem conclusão: o ETag da hqdefault não mudou (ou não foi lido), a volta pode ser a imagem antiga`
    return `${base}: passou`
  }
  const a = e.aparicao
  const regra = a?.estavelEm != null && e.trocaEm !== null
    ? (horas(a.estavelEm - e.trocaEm) <= PORTAO.horasDaRegra ? 'confirmada' : `corrigir: a nova levou ${horas(a.estavelEm - e.trocaEm)} h`)
    : `sem conclusão: a nova não estabilizou em ${PORTAO.tetoMs / 3_600_000} h`
  return [
    `## Portão do dHash: ${e.video} (${e.atualizadoEm})`, '',
    `- Original guardada: ${e.original.variante} ${e.original.largura}×${e.original.altura} (sha256 ${e.original.sha256.slice(0, 12)}).`,
    `- Imagem de teste a ${e.teste.distanciaDoOriginal} bits da original (comparadas como hqdefault).`,
    `- (i) arquivo 1280×720 contra a hqdefault servida: ${item(a)}.`,
    `- (ii) original grande devolvida contra a hqdefault antiga: ${segunda(e)}.`,
    `- (iii) horas até a nova aparecer: ${tempo(a, e.trocaEm)}; até a original voltar: ${tempo(e.volta, e.devolucaoEm)}.`,
    `- Regra das ${PORTAO.horasDaRegra} h (3.3): ${regra}.`,
    `- Leituras "outra" (nem teste nem original): ${(a?.outras ?? 0) + (e.volta?.outras ?? 0)}.`,
    `- Cota gasta: ${e.cotaGasta} unidades. Fase final: ${e.fase}.`,
    `- (iv) distância entre variantes de um teste real: fora deste script (subcomando distancias).`,
  ].join('\n')
}

const FASES_COM_TROCA = new Set<string>(['trocando', 'trocada', 'devolvendo', 'devolucao_falhou'])

/** Código de saída para uma falha lançada: se a troca pode estar no ar, 3 com o comando; Recusa sem troca, 2; o resto, 1. */
export function codigoDeFalha(diario: Diario, video: string, erro: unknown): Saida {
  let fase: string | null = null
  try { fase = diario.ler()?.fase ?? null } catch { /* estado ilegível: tratado como desconhecido */ }
  if (fase !== null && FASES_COM_TROCA.has(fase))
    return { codigo: 3, mensagem: `falha (${msg(erro)}) com a troca possivelmente no ar (fase ${fase}). Rode: ${cmd('devolver', video)}. Sem cota, suba à mão no Studio o arquivo ${diario.pasta}/original-maior.jpg` }
  if (erro instanceof Recusa) return { codigo: 2, mensagem: `recusado: ${erro.message}` }
  return { codigo: 1, mensagem: `falha: ${msg(erro)}. Veja ${diario.pasta}/estado.json` }
}
