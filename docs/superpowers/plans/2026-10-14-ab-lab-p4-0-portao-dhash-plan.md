
# A/B Lab honesto, P4-0: o portão do dHash (plano de implementação)

Escrito em 14/10/2026. Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (3.3 "Thumbnail recém-trocada"; 3.4 "Portão"; emendas 25, 29, 30 e 33). Roteiro: `docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md` (etapa 7). **Estado: rascunho do controlador; espera a revisão do Yannis (o script escreve no YouTube) e o "pode" do dono.**

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa, com passos em caixa (`- [ ]`). **Despacho de implementação: Sonnet, effort `medium`, nas Tarefas 1 a 6.** Revisão de cada tarefa: Sonnet, effort `medium`. Revisão da Tarefa 7: Yannis, Opus, effort `high`. As linhas citadas foram lidas em 14/10; quem executa confere de novo por `grep` no dia.

> **Quem faz o quê (roteiro, regra 2):** o agente escreve o código e roda os testes e o `ensaio`. O ensaio só lê URLs públicas do `i.ytimg.com`, sem banco nem credencial. **Só o dono roda `valer`, `devolver` e `conferir`**, porque esses comandos escrevem no canal ou leem a credencial de produção. Nenhum agente roda esses três. Nenhuma chave do pipeline é criada nem revogada.

**Objetivo.** Medir com imagens reais as três coisas que a P4a presume: (i) um arquivo 1280×720 e a `hqdefault` que o YouTube serve dele ficam dentro de `DHASH_MAX_SAME`; (ii) a cópia 480×360 guardada e a `hqdefault` depois da devolução também ficam; (iii) quantas horas a `hqdefault` leva para mudar depois de um `thumbnails.set`, o que confirma ou corrige as 3 h da 3.3. A medida (iv), a distância entre as variantes de um teste real, sai por um subcomando local, `distancias`, sem rede.

**Vídeo (dono, 14/10).** "Lolzin D5", `6jL-jeux_1Y`, público. Reserva: `WDRy_uldCI8`. Os dois estão numa lista fixa no código, e o script recusa qualquer outro.

**Cota.** Caminho feliz: 1 `videos.list` + 2 `thumbnails.set` = 101 unidades. Pior caso, com uma nova tentativa de devolução: 151. As sondagens usam a URL pública e custam zero.

**O que se reaproveita.** De `apps/web/src/lib/youtube/thumb-fingerprint.ts`: `dhashOf` (l. 29), `hamming` (l. 18), `DHASH_MAX_SAME = 6` (l. 9) e `probeThumb(id, null)` (l. 60), a mesma sonda que o vigia vai usar. A credencial do canal próprio segue o caminho de `ab-start.ts:90-101`: `channelAccountIdForVideo` (`channel-account.ts:15`) e depois `ensureFreshToken(siteId, 'youtube', canal)` (`lib/social/token-refresh.ts:71`). O `setThumbnail` de `ab-youtube.ts:7` **não** é importado: ele puxa o Sentry e lança só "failed: 403". O script tem um cliente mínimo próprio, com `status` e `reason`. `biggerCopy` (l. 87) continua privado (quem o exporta é a P4a). Aqui existe uma `maiorCopia` local, que diz qual variante achou e separa 404 ("não existe") de falha de rede ("não sei").

**Fica fora:** Migration 0, `hqdefaultLike` definitivo (a P4a decide onde ele mora), exportar `biggerCopy`, qualquer tela e qualquer leitura de produção pelo agente.

## Como o script protege a original

1. **Cópia antes da troca.** Baixa `maxresdefault` → `sddefault` → `hqdefault`. Um 404 passa para a próxima. Um erro de rede aborta sem ter escrito nada. A maior cópia precisa bater com a `hqdefault` (distância ≤ `DHASH_MAX_SAME`, comparando como hqdefault). Se não bater, a cópia grande pode ser antiga, e o script recusa. Se só existir uma cópia menor que a `maxresdefault`, o script recusa sem `--aceitar-menor`.
2. **A cópia mora fora do repositório.** Fica em `~/portao-dhash/<id>/`, gravada com a flag `wx`, que nunca sobrescreve, e com sha256 no estado. `valer` recusa se a pasta já tem qualquer arquivo. Isso impede que uma segunda rodada, depois de um processo morto, guarde a imagem de teste como se fosse a "original".
3. **Diário antes de cada passo.** O `estado.json` é gravado de forma atômica (arquivo temporário + `fsync` + `rename`) e passa pelas fases `preparado` → `trocando` (gravada ANTES de chamar a API) → `trocada` → `devolvendo` → `devolvida` → `conferida`, ou então `devolvida_sem_conferir` ou `devolucao_falhou`. Cada evento e cada sonda vão para `registro.jsonl`, com `appendFileSync`.
4. **A devolução acontece sempre.** Ela roda depois de `trocando`, em qualquer saída: medida concluída, teto, erro de rede, erro da API na própria troca, Ctrl-C, SIGTERM ou SIGHUP. Os sinais só levantam a flag `parar`. Um segundo Ctrl-C durante a devolução é ignorado, com aviso. São duas tentativas de devolução, com 60 s entre elas.
5. **Processo morto de verdade** (SIGKILL, falta de luz, Mac dormindo). Nesses casos nenhum código roda. O que resolve é o `devolver <id>`, que lê o estado e sobe `original-maior.jpg` de qualquer fase depois de `preparado`. Se a fase for `preparado`, a resposta é "nada foi escrito". O wrapper roda com `caffeinate -i`, para o Mac não dormir. Último recurso, sem cota: subir `original-maior.jpg` à mão no Studio.
6. **Conferir a devolução.** Depois do `thumbnails.set` da original, o script sonda até 3 leituras seguidas darem "original" pelo dHash, com o mesmo teto. Se for interrompido, a fase fica `devolvida_sem_conferir`, e `conferir <id>` retoma só a sondagem.

**Sondagem.** A cada 5 min, por `probeThumb(id, null)`, sem cache-buster, porque o que interessa é o que o vigia vai ver. Cada leitura é classificada pelo dHash contra a original e contra a imagem de teste, e a URL nunca entra na comparação: `teste`, `original`, `outra` ou `sem_dado`. "Apareceu" quer dizer 3 leituras seguidas iguais ao alvo, e o instante registrado é o da primeira das três. O teto é de 12 h para aparecer e de 12 h para voltar. Uma lacuna maior que 2 intervalos (Mac dormindo) é contada e marca a medida como imprecisa.

**Imagem de teste.** É o negativo da maior cópia, em 1280×720 (`contain` com fundo preto, depois `negate`), em JPEG q90 e abaixo de 2 MB. O negativo inverte quase todos os bits do dHash. O script recusa se a distância, comparando como hqdefault, for menor que 20.

**Códigos de saída:** 0 medido e conferido; 1 devolvido mas sem conclusão (teto ou interrupção); 2 recusa antes de escrever; 3 **original não devolvida** (a mensagem diz o comando).

## Arquivos

- Criar: `apps/web/src/lib/youtube/portao-dhash/regras.ts`, `classificar.ts`, `imagem.ts`, `diario.ts`, `youtube.ts`, `executar.ts`
- Criar: `apps/web/scripts/portao-dhash.ts` (fino) e `scripts/portao-dhash.sh` (wrapper)
- Testes: `apps/web/test/youtube/portao-dhash/{regras,classificar,imagem,diario,youtube,executar}.test.ts`
- Nenhum arquivo existente é alterado.

---

### Tarefa 0: ramo

- [ ] Árvore `../bythiago-ab-p4-0`, galho `lote/ab-p4-0`, saindo de `origin/staging` atualizado (mesmo fluxo da P1 e da P2: push por refspec para o staging, depois promoção ao main). Nunca `apps/web/.env.local` na árvore.

### Tarefa 1: regras, argumentos e classificação (Sonnet, medium)

**Arquivos:** `regras.ts`, `classificar.ts`, `test/youtube/portao-dhash/regras.test.ts`, `classificar.test.ts`

- [ ] Escrever os testes primeiro:

```ts
// apps/web/test/youtube/portao-dhash/regras.test.ts
import { describe, it, expect } from 'vitest'
import { lerArgs } from '@/lib/youtube/portao-dhash/regras'

describe('lerArgs', () => {
it('aceita os quatro comandos com um vídeo aprovado', () => {
  for (const c of ['ensaio', 'valer', 'devolver', 'conferir'])
    expect(lerArgs([c, '6jL-jeux_1Y'])).toEqual({ ok: true, comando: c, video: '6jL-jeux_1Y', aceitarMenor: false })
})
it('aceita a reserva e --aceitar-menor', () => {
  expect(lerArgs(['valer', 'WDRy_uldCI8', '--aceitar-menor'])).toMatchObject({ ok: true, aceitarMenor: true })
})
it('recusa vídeo fora da lista do dono', () => {
  expect(lerArgs(['valer', 'dQw4w9WgXcQ'])).toMatchObject({ ok: false })
})
it('recusa comando desconhecido, flag desconhecida e falta de vídeo', () => {
  expect(lerArgs(['apagar', '6jL-jeux_1Y']).ok).toBe(false)
  expect(lerArgs(['valer', '6jL-jeux_1Y', '--forcar']).ok).toBe(false)
  expect(lerArgs(['valer']).ok).toBe(false)
})
it('distancias pede dois arquivos ou mais', () => {
  expect(lerArgs(['distancias', 'a.jpg', 'b.jpg'])).toEqual({ ok: true, comando: 'distancias', arquivos: ['a.jpg', 'b.jpg'] })
  expect(lerArgs(['distancias', 'a.jpg']).ok).toBe(false)
})
})
```

```ts
// apps/web/test/youtube/portao-dhash/classificar.test.ts
import { describe, it, expect } from 'vitest'
import { classificar, primeiraEstavel, lacunas, horas } from '@/lib/youtube/portao-dhash/classificar'

const ORIG = '0000000000000000', TESTE = 'ffffffffffffffff'
describe('classificar', () => {
it('perto do teste → teste; perto da original → original', () => {
  expect(classificar('000000000000000f', { original: ORIG, teste: TESTE }).leitura).toBe('original') // d=4
  expect(classificar('fffffffffffffff0', { original: ORIG, teste: TESTE }).leitura).toBe('teste')
})
it('longe dos dois → outra; dhash nulo → sem_dado', () => {
  expect(classificar('00000000ffffffff', { original: ORIG, teste: TESTE }).leitura).toBe('outra')
  expect(classificar(null, { original: ORIG, teste: TESTE })).toEqual({ leitura: 'sem_dado', dOriginal: null, dTeste: null })
})
})
describe('primeiraEstavel', () => {
const L = (s: string) => s.split('').map((c) => ({ leitura: c === 't' ? 'teste' as const : c === 'o' ? 'original' as const : 'sem_dado' as const }))
it('devolve o índice da primeira de n seguidas', () => { expect(primeiraEstavel(L('ootottt'), 'teste', 3)).toBe(4) })
it('sem_dado quebra a sequência', () => { expect(primeiraEstavel(L('tt-tt'), 'teste', 3)).toBeNull() })
})
describe('lacunas e horas', () => {
it('conta intervalos maiores que o dobro do previsto', () => { expect(lacunas([0, 300_000, 900_000, 2_000_000], 300_000)).toBe(1) })
it('arredonda para duas casas', () => { expect(horas(5_400_000)).toBe(1.5) })
})
```

- [ ] Rodar `cd apps/web && npx vitest run test/youtube/portao-dhash` e ver a falha (os módulos ainda não existem).
- [ ] Implementar:

```ts
// apps/web/src/lib/youtube/portao-dhash/regras.ts
// Portão do dHash (P4-0 do A/B Lab, spec 3.4 e emenda 30). Números deste arquivo = o que o Yannis revisa.
export const VIDEOS_APROVADOS = ['6jL-jeux_1Y', 'WDRy_uldCI8'] as const // dono, 14/10/2026: Lolzin D5 e reserva

export const PORTAO = {
intervaloMs: 5 * 60_000,          // sonda a cada 5 min (URL pública, cota zero)
tetoMs: 12 * 3_600_000,           // 12 h para aparecer; 12 h para voltar
sondasEstaveis: 3,                // "apareceu" = 3 leituras seguidas
distanciaMinimaTeste: 20,         // a imagem de teste tem de ser bem diferente da original
tentativasDevolucao: 2,
esperaEntreDevolucoesMs: 60_000,
limiteBytes: 2 * 1024 * 1024,     // limite do thumbnails.set
horasDaRegra: 3,                  // a regra da 3.3 que o portão confirma ou corrige
cota: { videosList: 1, thumbnailsSet: 50 },
} as const

export class Recusa extends Error {
constructor(m: string) { super(m); this.name = 'Recusa' }
}

export type ComandoDeVideo = 'ensaio' | 'valer' | 'devolver' | 'conferir'
export type Args =
| { ok: true; comando: ComandoDeVideo; video: string; aceitarMenor: boolean }
| { ok: true; comando: 'distancias'; arquivos: string[] }
| { ok: false; erro: string }

const USO = 'uso: portao-dhash <ensaio|valer|devolver|conferir> <id> [--aceitar-menor] | distancias <a.jpg> <b.jpg> [...]'

export function lerArgs(argv: string[]): Args {
const [comando, ...resto] = argv
if (comando === 'distancias') {
  return resto.length >= 2 ? { ok: true, comando, arquivos: resto } : { ok: false, erro: `distancias pede dois arquivos ou mais. ${USO}` }
}
if (comando !== 'ensaio' && comando !== 'valer' && comando !== 'devolver' && comando !== 'conferir') return { ok: false, erro: USO }
const [video, ...flags] = resto
if (!video) return { ok: false, erro: USO }
if (!(VIDEOS_APROVADOS as readonly string[]).includes(video)) return { ok: false, erro: `o vídeo ${video} não está na lista aprovada pelo dono (${VIDEOS_APROVADOS.join(', ')})` }
const desconhecida = flags.find((f) => f !== '--aceitar-menor')
if (desconhecida) return { ok: false, erro: `flag desconhecida: ${desconhecida}. ${USO}` }
return { ok: true, comando, video, aceitarMenor: flags.includes('--aceitar-menor') }
}
```

```ts
// apps/web/src/lib/youtube/portao-dhash/classificar.ts
import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-fingerprint'

export type Leitura = 'original' | 'teste' | 'outra' | 'sem_dado'
export interface Sonda { em: number; dhash: string | null; etag: string | null; leitura: Leitura; dOriginal: number | null; dTeste: number | null }

/** Pelo dHash, nunca pela URL (spec 3.4). */
export function classificar(dhash: string | null, ref: { original: string; teste: string }): Pick<Sonda, 'leitura' | 'dOriginal' | 'dTeste'> {
if (!dhash) return { leitura: 'sem_dado', dOriginal: null, dTeste: null }
const dOriginal = hamming(dhash, ref.original)
const dTeste = hamming(dhash, ref.teste)
if (dTeste <= DHASH_MAX_SAME && dTeste < dOriginal) return { leitura: 'teste', dOriginal, dTeste }
if (dOriginal <= DHASH_MAX_SAME && dOriginal < dTeste) return { leitura: 'original', dOriginal, dTeste }
return { leitura: 'outra', dOriginal, dTeste }
}

/** Índice da primeira de `n` leituras seguidas iguais a `alvo`; null se ainda não houve. */
export function primeiraEstavel(sondas: readonly Pick<Sonda, 'leitura'>[], alvo: Leitura, n: number): number | null {
let seguidas = 0
for (let i = 0; i < sondas.length; i++) {
  seguidas = sondas[i]!.leitura === alvo ? seguidas + 1 : 0
  if (seguidas === n) return i - n + 1
}
return null
}

/** Quantos vãos entre sondas passaram do dobro do intervalo (Mac dormindo, rede parada). */
export function lacunas(instantes: readonly number[], intervaloMs: number): number {
let n = 0
for (let i = 1; i < instantes.length; i++) if (instantes[i]! - instantes[i - 1]! > 2 * intervaloMs) n++
return n
}

export const horas = (ms: number): number => Math.round(ms / 36_000) / 100
```

- [ ] Rodar os testes até passarem. Commit: `feat(ab-lab): regras e classificação do portão do dHash (P4-0)`.

### Tarefa 2: imagens (Sonnet, medium)

**Arquivos:** `imagem.ts`, `test/youtube/portao-dhash/imagem.test.ts`

- [ ] Testes, sem rede (o `fetch` é falso):

```ts
// apps/web/test/youtube/portao-dhash/imagem.test.ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { hamming, dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { maiorCopia, baixar, dhashComoHq, gerarImagemTeste, hqdefaultLike, distancias } from '@/lib/youtube/portao-dhash/imagem'
import { imagemSintetica, respostaImagem, fetchFalso } from './util'

describe('maiorCopia', () => {
it('prefere maxresdefault', async () => {
  const big = await imagemSintetica(1280, 720, 3)
  const f = fetchFalso({ maxresdefault: respostaImagem(big) })
  expect(await maiorCopia('6jL-jeux_1Y', f)).toMatchObject({ variante: 'maxresdefault', largura: 1280, altura: 720 })
})
it('404 passa para a próxima; só hqdefault → hqdefault', async () => {
  const hq = await imagemSintetica(480, 360, 3)
  const f = fetchFalso({ hqdefault: respostaImagem(hq) })
  expect((await maiorCopia('6jL-jeux_1Y', f)).variante).toBe('hqdefault')
})
it('erro de rede ou 5xx lança (não confunde "não sei" com "não existe")', async () => {
  const f = fetchFalso({ maxresdefault: new Response('', { status: 503 }) })
  await expect(maiorCopia('6jL-jeux_1Y', f)).rejects.toThrow(/503/)
})
it('nenhuma variante → recusa', async () => {
  await expect(maiorCopia('6jL-jeux_1Y', fetchFalso({}))).rejects.toThrow(/nenhuma cópia/)
})
it('resposta que não é imagem conta como inexistente', async () => {
  expect(await baixar('https://i.ytimg.com/x.jpg', fetchFalso({ x: new Response('<html>', { headers: { 'content-type': 'text/html' } }) }))).toBeNull()
})
})

describe('comparação como hqdefault', () => {
it('1280×720 e a hqdefault 480×360 com faixas dão o mesmo dHash', async () => {
  const big = await imagemSintetica(1280, 720, 3)
  expect(hamming(await dhashComoHq(big), await dhashOf(await hqdefaultLike(big)))).toBe(0)
})
it('o negativo fica longe da original', async () => {
  const big = await imagemSintetica(1280, 720, 3)
  const teste = await gerarImagemTeste(big)
  const meta = await sharp(teste).metadata()
  expect([meta.width, meta.height, meta.format]).toEqual([1280, 720, 'jpeg'])
  expect(hamming(await dhashComoHq(teste), await dhashComoHq(big))).toBeGreaterThanOrEqual(20)
})
it('distancias lista os pares', async () => {
  const a = await imagemSintetica(1280, 720, 3), b = await imagemSintetica(1280, 720, 7)
  const l = await distancias([a, a, b], ['a', 'a2', 'b'])
  expect(l).toHaveLength(3)
  expect(l[0]).toBe('a × a2: 0')
})
})
```

```ts
// apps/web/test/youtube/portao-dhash/util.ts
import sharp from 'sharp'

/** Imagem com gradiente (cor lisa dá dHash zero e não serve para teste). `semente` muda o desenho. */
export async function imagemSintetica(w: number, h: number, semente: number): Promise<Buffer> {
const px = Buffer.alloc(w * h * 3)
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const v = Math.floor(127 + 120 * Math.sin((x / w) * Math.PI * semente + (y / h) * Math.PI * ((semente % 3) + 1)))
  const i = (y * w + x) * 3
  px[i] = v; px[i + 1] = 255 - v; px[i + 2] = (v * semente) & 255
}
return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()
}

export const respostaImagem = (b: Buffer) => new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg' } })

/** fetch falso por nome de variante (o trecho antes de ".jpg"); o que não estiver no mapa responde 404. */
export function fetchFalso(mapa: Record<string, Response | (() => Response)>): typeof fetch {
return (async (url: string | URL) => {
  const nome = String(url).split('/').pop()!.replace('.jpg', '')
  const r = mapa[nome]
  if (!r) return new Response('', { status: 404 })
  return typeof r === 'function' ? r() : r.clone()
}) as unknown as typeof fetch
}
```

- [ ] Implementar:

```ts
// apps/web/src/lib/youtube/portao-dhash/imagem.ts
import sharp from 'sharp'
import { dhashOf, hamming } from '@/lib/youtube/thumb-fingerprint'
import { Recusa } from './regras'

export type Variante = 'maxresdefault' | 'sddefault' | 'hqdefault'
const ORDEM: readonly Variante[] = ['maxresdefault', 'sddefault', 'hqdefault']

export const urlDaVariante = (video: string, v: Variante) => `https://i.ytimg.com/vi/${encodeURIComponent(video)}/${v}.jpg`

/** null = a imagem não existe (404 ou resposta que não é imagem). Rede ou 5xx lança: "não sei" não é "não existe". */
export async function baixar(url: string, f: typeof fetch): Promise<Buffer | null> {
const res = await f(url, { signal: AbortSignal.timeout(15_000) })
if (res.status === 404) return null
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
if (!(res.headers.get('content-type') ?? '').startsWith('image/')) return null
const b = Buffer.from(await res.arrayBuffer())
return b.length > 0 ? b : null
}

export async function maiorCopia(video: string, f: typeof fetch): Promise<{ variante: Variante; bytes: Buffer; largura: number; altura: number }> {
for (const variante of ORDEM) {
  const bytes = await baixar(urlDaVariante(video, variante), f)
  if (!bytes) continue
  const m = await sharp(bytes).metadata()
  return { variante, bytes, largura: m.width ?? 0, altura: m.height ?? 0 }
}
throw new Recusa(`nenhuma cópia pública da thumbnail de ${video}: nada foi escrito`)
}

/** Spec 3.4: como o YouTube monta a hqdefault (480×360, faixas pretas). A P4a decide onde a versão definitiva mora. */
export async function hqdefaultLike(bytes: Buffer): Promise<Buffer> {
return sharp(bytes).resize(480, 360, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
}

export const dhashComoHq = async (bytes: Buffer): Promise<string> => dhashOf(await hqdefaultLike(bytes))

/** O negativo da original em 1280×720: inverte quase todos os bits do dHash. */
export async function gerarImagemTeste(maior: Buffer): Promise<Buffer> {
return sharp(maior).resize(1280, 720, { fit: 'contain', background: '#000' }).negate({ alpha: false }).jpeg({ quality: 90 }).toBuffer()
}

/** (iv) do portão: distância par a par, só arquivos locais. */
export async function distancias(imagens: Buffer[], nomes: string[]): Promise<string[]> {
const h = await Promise.all(imagens.map(dhashComoHq))
const linhas: string[] = []
for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) linhas.push(`${nomes[i]} × ${nomes[j]}: ${hamming(h[i]!, h[j]!)}`)
return linhas
}
```

- [ ] Testes passando. Commit: `feat(ab-lab): cópias e imagem de teste do portão do dHash (P4-0)`.

### Tarefa 3: diário em disco (Sonnet, medium)

**Arquivos:** `diario.ts`, `test/youtube/portao-dhash/diario.test.ts`

- [ ] Testes, numa pasta temporária (`fs.mkdtempSync(path.join(os.tmpdir(), 'portao-'))`):
- `gravar` e `ler` voltam o mesmo estado, e não sobra `estado.json.tmp`.
- `salvarUmaVez` devolve o sha256 e, numa segunda chamada com o mesmo nome, lança `EEXIST` sem mudar os bytes.
- `temAlgo()` é falso numa pasta inexistente ou vazia e verdadeiro com um único arquivo.
- `registrar` acrescenta uma linha JSON por evento, com `em` ISO.
- `ler()` devolve null sem `estado.json` e lança se o JSON estiver corrompido (não inventa estado).
- [ ] Implementar:

```ts
// apps/web/src/lib/youtube/portao-dhash/diario.ts
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { Variante } from './imagem'

export type Fase = 'preparado' | 'trocando' | 'trocada' | 'devolvendo' | 'devolvida' | 'conferida' | 'devolvida_sem_conferir' | 'devolucao_falhou'

export interface Medida {
motivo: 'estavel' | 'teto' | 'parado'
primeiraEm: number | null; estavelEm: number | null
distanciaNaEstavel: number | null; menorDistancia: number | null
sondas: number; outras: number; semDado: number; lacunas: number
}

export interface Estado {
versao: 1; video: string; fase: Fase; criadoEm: string; atualizadoEm: string
original: { variante: Variante; largura: number; altura: number; sha256: string; sha256Hq: string; dhashHq: string }
teste: { sha256: string; dhashComoHq: string; distanciaDoOriginal: number }
trocaEm: number | null; devolucaoEm: number | null
cotaGasta: number; tentativasDevolucao: number
aparicao: Medida | null; volta: Medida | null
}

export const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

export class Diario {
constructor(readonly pasta: string, private readonly agora: () => number) {}
private c(nome: string) { return path.join(this.pasta, nome) }
private garantir() { fs.mkdirSync(this.pasta, { recursive: true }) }

temAlgo(): boolean { return fs.existsSync(this.pasta) && fs.readdirSync(this.pasta).length > 0 }

ler(): Estado | null {
  if (!fs.existsSync(this.c('estado.json'))) return null
  return JSON.parse(fs.readFileSync(this.c('estado.json'), 'utf8')) as Estado
}

/** Atômico: temporário + fsync + rename. Um processo morto deixa o estado anterior inteiro. */
gravar(e: Estado): void {
  this.garantir()
  e.atualizadoEm = new Date(this.agora()).toISOString()
  const tmp = this.c('estado.json.tmp')
  const fd = fs.openSync(tmp, 'w')
  try { fs.writeSync(fd, JSON.stringify(e, null, 2)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(tmp, this.c('estado.json'))
}

/** Nunca sobrescreve (flag wx): a cópia da original não pode ser trocada pela imagem de teste numa segunda rodada. */
salvarUmaVez(nome: string, bytes: Buffer): string {
  this.garantir()
  fs.writeFileSync(this.c(nome), bytes, { flag: 'wx' })
  return sha256(bytes)
}

lerArquivo(nome: string): Buffer { return fs.readFileSync(this.c(nome)) }
escrever(nome: string, texto: string): void { this.garantir(); fs.writeFileSync(this.c(nome), texto) }

registrar(evento: string, dados: Record<string, unknown> = {}): void {
  this.garantir()
  fs.appendFileSync(this.c('registro.jsonl'), JSON.stringify({ em: new Date(this.agora()).toISOString(), evento, ...dados }) + '\n')
}
}
```

- [ ] Testes passando. Commit: `feat(ab-lab): diário em disco do portão do dHash (P4-0)`.

### Tarefa 4: cliente do YouTube e credencial (Sonnet, medium)

**Arquivos:** `youtube.ts`, `test/youtube/portao-dhash/youtube.test.ts`

- [ ] Testes de `escritorCom`, com `fetch` falso (nenhum teste chama o YouTube nem o banco):
- `definirThumb` faz POST em `.../upload/youtube/v3/thumbnails/set?videoId=6jL-jeux_1Y&uploadType=media`, com `Content-Type: image/jpeg` e `Authorization: Bearer <token>`. O token é pedido a cada chamada.
- Um 403 com `{"error":{"errors":[{"reason":"quotaExceeded"}]}}` lança `ErroYouTube`, com `status 403` e `reason 'quotaExceeded'`. Um corpo ilegível dá `reason null`.
- `conferirVideo`: `items` vazio → null; com item → `{ canal, privacidade }`.
- [ ] Implementar:

```ts
// apps/web/src/lib/youtube/portao-dhash/youtube.ts
// Único ponto que escreve no YouTube. Cota: videos.list 1; thumbnails.set 50.
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { Recusa } from './regras'

export interface Escritor {
canal: string
conferirVideo(video: string): Promise<{ canal: string; privacidade: string } | null>
definirThumb(video: string, jpeg: Buffer): Promise<void>
}

export class ErroYouTube extends Error {
constructor(readonly status: number, readonly reason: string | null) {
  super(`YouTube respondeu ${status}${reason ? ` (${reason})` : ''}`)
  this.name = 'ErroYouTube'
}
}

async function erroDe(res: Response): Promise<ErroYouTube> {
const j = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null
return new ErroYouTube(res.status, j?.error?.errors?.[0]?.reason ?? null)
}

export function escritorCom(canal: string, token: () => Promise<string>, f: typeof fetch): Escritor {
return {
  canal,
  async conferirVideo(video) {
    const res = await f(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(video)}`, {
      headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw await erroDe(res)
    const j = (await res.json()) as { items?: { snippet?: { channelId?: string }; status?: { privacyStatus?: string } }[] }
    const it = j.items?.[0]
    return it ? { canal: it.snippet?.channelId ?? '', privacidade: it.status?.privacyStatus ?? '' } : null
  },
  async definirThumb(video, jpeg) {
    const res = await f(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(video)}&uploadType=media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(jpeg),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw await erroDe(res)
  },
}
}

/** Mesmo caminho de ab-start.ts:90-101. Lê produção: só roda na máquina do dono, pelo `valer`/`devolver`. */
export async function escritorDoCanal(video: string): Promise<Escritor> {
const sb = getSupabaseServiceClient()
const { data, error } = await sb.from('youtube_videos').select('id, site_id').eq('youtube_video_id', video).limit(2)
if (error) throw new Error(`não li youtube_videos: ${error.message}`)
if (!data || data.length === 0) throw new Recusa('o vídeo não está em youtube_videos: sem canal conhecido não há credencial')
if (data.length > 1) throw new Recusa('o vídeo aparece em mais de um site: recuso escolher a credencial')
const { id, site_id } = data[0] as { id: string; site_id: string }
const canal = await channelAccountIdForVideo(sb as never, site_id, id) // conferir o tipo no dia: ab-start passa o mesmo cliente
if (!canal) throw new Recusa('canal do vídeo não identificado')
return escritorCom(canal, async () => (await ensureFreshToken(site_id, 'youtube', canal)).accessToken, fetch)
}
```

- [ ] Testes passando, e `npx tsc --noEmit -p apps/web` sem erro novo. Se o tipo do cliente bater sem o cast, tirar o `as never`.
- [ ] Commit: `feat(ab-lab): cliente mínimo do YouTube do portão do dHash (P4-0)`.

### Tarefa 5: orquestração (Sonnet, medium)

**Arquivos:** `executar.ts`, `test/youtube/portao-dhash/executar.test.ts`

- [ ] Testes primeiro, num "mundo" falso. O relógio é falso; `dormir` avança o relógio; `definirThumb` registra a escrita; a `hqdefault` visível passa a ser a última escrita só depois de `atrasoMs`; `sondar` devolve `dhashComoHq` do que está visível; a pasta é temporária.

```ts
// apps/web/test/youtube/portao-dhash/executar.test.ts (esqueleto do mundo; os casos vêm depois)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
import sharp from 'sharp'
import { Diario } from '@/lib/youtube/portao-dhash/diario'
import { dhashComoHq } from '@/lib/youtube/portao-dhash/imagem'
import { ensaio, valer, devolver, conferir, montarResultado, type Deps } from '@/lib/youtube/portao-dhash/executar'
import type { Escritor } from '@/lib/youtube/portao-dhash/youtube'
import { imagemSintetica, respostaImagem, fetchFalso } from './util'

const H = 3_600_000
async function mundo(o: { atrasoMs: number; semMaxres?: boolean; maxresAntiga?: boolean; falhasTroca?: number; falhasDevolucao?: number; video?: { canal: string; privacidade: string } | null }) {
const original = await imagemSintetica(1280, 720, 3)
const hq = await sharp(original).resize(480, 360, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
const sd = await sharp(original).resize(640, 480, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
const maxres = o.maxresAntiga ? await imagemSintetica(1280, 720, 9) : original
let t = 1_000_000
const escritas: { em: number; bytes: Buffer }[] = []
let falhasTroca = o.falhasTroca ?? 0, falhasDev = o.falhasDevolucao ?? 0
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'portao-'))
const diario = new Diario(pasta, () => t)
const esc: Escritor = {
  canal: 'UC_dono',
  conferirVideo: vi.fn(async () => (o.video === undefined ? { canal: 'UC_dono', privacidade: 'public' } : o.video)),
  definirThumb: vi.fn(async (_v: string, b: Buffer) => {
    const ehTroca = escritas.length === 0 && !fs.existsSync(path.join(pasta, 'estado.json')) ? false : JSON.parse(fs.readFileSync(path.join(pasta, 'estado.json'), 'utf8')).fase === 'trocando'
    if (ehTroca && falhasTroca-- > 0) throw new Error('rede caiu na troca')
    if (!ehTroca && falhasDev-- > 0) throw new Error('rede caiu na devolução')
    escritas.push({ em: t, bytes: b })
  }),
}
const visivel = () => [...escritas].reverse().find((e) => t >= e.em + o.atrasoMs)?.bytes ?? original
const d: Deps = {
  video: '6jL-jeux_1Y', diario,
  f: fetchFalso({ ...(o.semMaxres ? {} : { maxresdefault: respostaImagem(maxres) }), sddefault: respostaImagem(sd), hqdefault: respostaImagem(hq) }),
  sondar: async () => ({ dhash: await dhashComoHq(visivel()), etag: null }),
  escritor: vi.fn(async () => esc),
  agora: () => t,
  dormir: async (ms) => { t += ms },
  sinal: { parar: false },
  log: () => {},
}
return { d, esc, escritas, original, pasta, agora: () => t }
}
```

Casos, um `it` cada:
1. **ensaio** não chama `d.escritor`, não cria nada na pasta e devolve código 0.
2. **valer, caminho feliz** (`atrasoMs: 2 * H`):
   - a 1ª escrita é a imagem de teste e a 2ª é exatamente `original-maior.jpg`;
   - `estado.fase === 'conferida'`, `cotaGasta === 101` e código 0;
   - `aparicao.estavelEm - trocaEm` fica entre `2 * H` e `2 * H + 5 min`;
   - `resultado.md` contém "(iii)" e "confirmada".
3. **A cópia vem antes da troca:** dentro do `definirThumb` falso, na 1ª chamada, `original-maior.jpg` e `estado.json` já existem, com fase `trocando`.
4. **Teto** (`atrasoMs: 13 * H`): `aparicao.motivo === 'teto'`, a devolução acontece mesmo assim (2 escritas) e o código é 1.
5. **Ctrl-C durante a medida** (o `sondar` levanta `d.sinal.parar = true` na 3ª chamada): a original é devolvida, a fase fica `devolvida_sem_conferir` e o código é 1.
6. **Sonda que lança** conta como `sem_dado` e a medida continua.
7. **A troca lança** (`falhasTroca: 1`): a original é devolvida mesmo assim e `definirThumb` é chamado 2 vezes.
8. **A devolução falha duas vezes** (`falhasDevolucao: 2`): a fase fica `devolucao_falhou`, o código é 3, `definirThumb` é chamado exatamente 3 vezes e a mensagem contém `devolver 6jL-jeux_1Y` e `original-maior.jpg`.
9. **`devolver` depois de um processo morto:** a pasta é montada à mão (`salvarUmaVez` da original e estado com fase `trocada`). `devolver(d)` sobe a original e chega a `conferida`. Com a fase `preparado`, responde "nada foi escrito" e não chama `d.escritor`. Sem estado, recusa.
10. **`valer` com a pasta já usada:** um arquivo qualquer na pasta faz `valer` lançar `Recusa`, sem chamar `d.escritor`.
11. **Sem maxres:** recusa sem `aceitarMenor`. Com ela, segue e grava `variante 'sddefault'`.
12. **maxres antiga** (outra imagem): recusa, sem escritor e sem arquivo na pasta.
13. **`videos.list`** devolvendo null, outro canal ou `unlisted`: recusa sem `definirThumb` e sem arquivo na pasta.
14. **`conferir`** numa pasta com fase `devolvida_sem_conferir` mede a volta e grava `conferida`.
15. **`montarResultado`** com `aparicao` em teto e menor distância 9 escreve "FALHOU: a tolerância é decidida com o dono".

- [ ] Implementar:

```ts
// apps/web/src/lib/youtube/portao-dhash/executar.ts
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

const criadoEm = new Date(d.agora()).toISOString()
const e: Estado = {
  versao: 1, video: d.video, fase: 'preparado', criadoEm, atualizadoEm: criadoEm,
  original: { variante: p.variante, largura: p.largura, altura: p.altura, sha256: d.diario.salvarUmaVez('original-maior.jpg', p.maior), sha256Hq: d.diario.salvarUmaVez('original-hq.jpg', p.hq), dhashHq: p.dhashHq },
  teste: { sha256: d.diario.salvarUmaVez('teste-1280x720.jpg', p.teste), dhashComoHq: p.dhashTeste, distanciaDoOriginal: p.distancia },
  trocaEm: null, devolucaoEm: null, cotaGasta: PORTAO.cota.videosList, tentativasDevolucao: 0, aparicao: null, volta: null,
}
d.diario.gravar(e)
d.diario.registrar('preparado', { variante: p.variante, distancia: p.distancia })

try {
  e.fase = 'trocando'; d.diario.gravar(e)          // ANTES da API: um processo morto aqui ainda é devolvido
  await esc.definirThumb(d.video, p.teste)
  e.cotaGasta += PORTAO.cota.thumbnailsSet; e.trocaEm = d.agora(); e.fase = 'trocada'; d.diario.gravar(e)
  d.diario.registrar('trocada')
  e.aparicao = await sondarAte(d, 'teste', e.trocaEm, e)
  d.diario.gravar(e)
} catch (err) {
  d.diario.registrar('erro_com_a_troca_no_ar', { erro: msg(err) })
  d.log(`erro: ${msg(err)}. Devolvendo a original.`)
}
return devolverEConferir(d, e, esc)                // sempre, depois de 'trocando'
}

export async function devolver(d: Deps): Promise<Saida> {
const e = d.diario.ler()
if (!e) throw new Recusa(`não há estado em ${d.diario.pasta}: este script não trocou nada neste vídeo`)
if (e.fase === 'preparado') return { codigo: 0, mensagem: 'nada foi escrito no YouTube (fase preparado)' }
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
  menorDistancia: menor, sondas: leituras.length,
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
const a = e.aparicao
const regra = a?.estavelEm != null && e.trocaEm !== null
  ? (horas(a.estavelEm - e.trocaEm) <= PORTAO.horasDaRegra ? 'confirmada' : `corrigir: a nova levou ${horas(a.estavelEm - e.trocaEm)} h`)
  : `sem conclusão: a nova não estabilizou em ${PORTAO.tetoMs / 3_600_000} h`
return [
  `## Portão do dHash: ${e.video} (${e.atualizadoEm})`, '',
  `- Original guardada: ${e.original.variante} ${e.original.largura}×${e.original.altura} (sha256 ${e.original.sha256.slice(0, 12)}).`,
  `- Imagem de teste a ${e.teste.distanciaDoOriginal} bits da original (comparadas como hqdefault).`,
  `- (i) arquivo 1280×720 contra a hqdefault servida: ${item(a)}.`,
  `- (ii) cópia 480×360 guardada contra a hqdefault depois da devolução: ${item(e.volta)}.`,
  `- (iii) horas até a nova aparecer: ${tempo(a, e.trocaEm)}; até a original voltar: ${tempo(e.volta, e.devolucaoEm)}.`,
  `- Regra das ${PORTAO.horasDaRegra} h (3.3): ${regra}.`,
  `- Leituras "outra" (nem teste nem original): ${(a?.outras ?? 0) + (e.volta?.outras ?? 0)}.`,
  `- Cota gasta: ${e.cotaGasta} unidades. Fase final: ${e.fase}.`,
  `- (iv) distância entre variantes de um teste real: fora deste script (subcomando distancias).`,
].join('\n')
}
```

- [ ] Os 15 casos passando. Commit: `feat(ab-lab): orquestração do portão do dHash com devolução garantida (P4-0)`.

### Tarefa 6: script, wrapper e sinais (Sonnet, medium)

**Arquivos:** `apps/web/scripts/portao-dhash.ts`, `scripts/portao-dhash.sh`

- [ ] Script fino (a lógica testada fica em `src/`):

```ts
// apps/web/scripts/portao-dhash.ts
// Portão do dHash (P4-0 do A/B Lab, spec 3.4). `valer`, `devolver` e `conferir` são do DONO; agente roda só `ensaio` e `distancias`.
//   bash scripts/portao-dhash.sh <ensaio|valer|devolver|conferir> <id> [--aceitar-menor]
//   bash scripts/portao-dhash.sh distancias <a.jpg> <b.jpg> [...]
// Pasta de trabalho: ~/portao-dhash/<id>/ (cópia da original, estado.json, registro.jsonl, resultado.md).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { probeThumb } from '../src/lib/youtube/thumb-fingerprint'
import { lerArgs, Recusa } from '../src/lib/youtube/portao-dhash/regras'
import { Diario } from '../src/lib/youtube/portao-dhash/diario'
import { distancias } from '../src/lib/youtube/portao-dhash/imagem'
import { conferir, devolver, ensaio, valer, type Deps, type Sinal } from '../src/lib/youtube/portao-dhash/executar'

const dormir = (ms: number, sinal: Sinal) => new Promise<void>((r) => {
const t0 = Date.now()
const i = setInterval(() => { if (sinal.parar || Date.now() - t0 >= ms) { clearInterval(i); r() } }, 1_000)
})
const dizer = (l: string) => { try { console.log(l) } catch { /* terminal fechado: o registro.jsonl continua */ } }

async function main(): Promise<number> {
const a = lerArgs(process.argv.slice(2))
if (!a.ok) { console.error(a.erro); return 2 }
if (a.comando === 'distancias') {
  for (const l of await distancias(a.arquivos.map((p) => fs.readFileSync(p)), a.arquivos)) dizer(l)
  return 0
}
const sinal: Sinal = { parar: false }
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(s, () => {
    if (sinal.parar) { dizer('já estou parando: a original está sendo devolvida; espere'); return }
    sinal.parar = true
    dizer('parando: vou devolver a original antes de sair')
  })
}
const d: Deps = {
  video: a.video,
  diario: new Diario(path.join(os.homedir(), 'portao-dhash', a.video), Date.now),
  f: fetch,
  sondar: async (v) => { const p = await probeThumb(v, null); return { dhash: p.dhash, etag: p.etag } },
  // import tardio: o ensaio nunca carrega banco nem credencial
  escritor: async () => (await import('../src/lib/youtube/portao-dhash/youtube')).escritorDoCanal(a.video),
  agora: Date.now, dormir, sinal, log: dizer,
}
const s = a.comando === 'ensaio' ? await ensaio(d, a.aceitarMenor)
  : a.comando === 'valer' ? await valer(d, a.aceitarMenor)
  : a.comando === 'devolver' ? await devolver(d)
  : await conferir(d)
dizer(s.mensagem)
return s.codigo
}

main().then((c) => process.exit(c), (e: unknown) => {
if (e instanceof Recusa) { console.error(`recusado: ${e.message}`); process.exit(2) }
console.error(`falha: ${e instanceof Error ? e.message : String(e)}. Veja ~/portao-dhash/<id>/estado.json; se a fase não for "preparado", rode: bash scripts/portao-dhash.sh devolver <id>`)
process.exit(1)
})
```

```sh
#!/usr/bin/env bash
# scripts/portao-dhash.sh: portão do dHash (P4-0 do A/B Lab). caffeinate impede o Mac de dormir durante a medida.
set -euo pipefail
cd "$(dirname "$0")/.."
exec caffeinate -i npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs \
--env-file apps/web/.env.local apps/web/scripts/portao-dhash.ts "$@"
```

- [ ] Prova local, feita pelo controlador e sem a credencial (o ensaio não lê o banco): `npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs apps/web/scripts/portao-dhash.ts ensaio 6jL-jeux_1Y`. Anotar no ledger a variante, as dimensões e a distância. Se a resposta for "só existe em sddefault/hqdefault", isso vai para o dono decidir (ver "Depende do dono").
- [ ] `bash scripts/portao-dhash.sh valer dQw4w9WgXcQ` recusa com código 2 (vídeo fora da lista), sem rede.
- [ ] `cd apps/web && npx vitest run test/youtube/portao-dhash` todo verde e `npx tsc --noEmit -p apps/web` sem erro novo.
- [ ] Commit: `feat(ab-lab): script do portão do dHash (P4-0)`.

### Tarefa 7: revisão do Yannis (portão; Yannis, Opus, effort medium)

- [ ] Despachar o Yannis com o diff do ramo e este plano. Pontos da revisão:
- a devolução cobre todo caminho depois de `trocando`;
- `wx` e a recusa por pasta usada impedem que a original se perca;
- `ensureFreshToken` lendo e regravando o token em produção na máquina do dono é aceitável;
- números de `regras.ts`;
- a imagem de teste pode ser o negativo.
- [ ] Achados corrigidos por Sonnet, effort `medium`, com testes. Rodada de volta até haver acordo.
- [ ] Push do lote para o staging e promoção ao main (o script não roda sozinho; só o comando do dono escreve no YouTube). O "pode" do dono vale para a Tarefa 8.

### Tarefa 8: execução pelo dono e ledger (dono roda; o controlador anota)

- [ ] O dono, no `main` atualizado, com o Mac na tomada e o Terminal aberto, roda um ensaio e depois o comando para valer:

```
bash scripts/portao-dhash.sh ensaio 6jL-jeux_1Y
bash scripts/portao-dhash.sh valer 6jL-jeux_1Y
```

- [ ] Se o processo morrer ou o Mac desligar: `bash scripts/portao-dhash.sh devolver 6jL-jeux_1Y`. Se a fase ficar `devolvida_sem_conferir`: `bash scripts/portao-dhash.sh conferir 6jL-jeux_1Y`.
- [ ] O controlador copia `~/portao-dhash/6jL-jeux_1Y/resultado.md` (o dono cola o conteúdo) para o ledger da P4a. Com isso, a regra das 3 h (3.3) e `DHASH_MAX_SAME` deixam de ser "a confirmar". Se (i) ou (ii) disserem "FALHOU", a P4a não começa e a tolerância é decidida com o dono (3.4).
- [ ] Horas reais na linha 7 do roteiro.

## Dúvidas em aberto

1. **Credencial (Yannis).** O script lê `social_connections` de produção pelo `.env.local` do dono, e `ensureFreshToken` regrava o token renovado. Se o Google responder `invalid_grant`, a função marca a conexão como revogada, refletindo o que já é verdade. Nenhuma chave do pipeline é criada nem revogada.
2. **Vídeo de 2015 sem `maxresdefault`.** É provável. O ensaio responde antes de qualquer escrita.
3. **Original automática.** Se o vídeo nunca teve thumbnail personalizada, a devolução deixa uma personalizada igual a ela. A API não volta ao modo "automática".
4. **E18.** Se o retrato diário de `yt_own_video_meta_daily` rodar durante a janela, a imagem de teste vira uma "versão" no histórico do vídeo. Opções: aceitar o ruído ou o controlador anotar a janela.
5. **Imagem de teste = negativo da original.** Alternativa: um cartão neutro. A distância mínima de 20 continua valendo.
6. **(iv)** precisa dos arquivos das variantes de um teste real. Fica no subcomando `distancias`, com arquivos que o dono fornecer, sem o agente ler produção.

## Decisões do controlador sobre as dúvidas (14/10)

- 2: aceitar a maior resolução que existir; o ensaio mostra qual é e o dono vê antes de valer (a flag `--aceitar-menor` vai no comando final se o ensaio disser que não há `maxresdefault`).
- 3: aceito; o vídeo tem 0 view em 30 dias.
- 4: o controlador anota a janela no ledger; o retrato do dia que cair dentro dela é ruído conhecido, não versão.
- 5: o negativo serve (vídeo de 0 view; volta em horas).
- 1 e 6: com o Yannis na Tarefa 7.

### Arquivos de partida
- /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/lib/youtube/thumb-fingerprint.ts
- /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/lib/youtube/ab-start.ts
- /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/lib/social/token-refresh.ts
- /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/lib/youtube/channel-account.ts
- /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/scripts/observatorio-acesso.ts
