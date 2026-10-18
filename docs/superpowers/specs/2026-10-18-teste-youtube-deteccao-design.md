# Spec S0 + S1 + S3: contrato da leitura da watch e regra pura de detecção do teste do YouTube

- **Data:** 18/10/2026. **Estado:** 2º rascunho (conserto da rodada 2, sobre os pareceres de Yannis e Phil), para os dois re-revisarem e a A5 assinar o contrato. As decisões onde os pareceres se sobrepõem estão em §12.
- **Frente:** A/B Lab. A coleta (S4) é da A5 e **não** entra aqui; este spec só fixa o que a coleta entrega e o que a regra devolve.
- **Fontes:** `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md` (§0, §1.1, §1.2, §8, §9), `contexto-da-discussao.md`, `phil-concorrentes.md`; pareceres `review-spec-yannis.md` e `review-spec-phil.md` da mesma pasta; dados do experimento em `~/portao-dhash/nativo-qIg9a7vqcNo/`; código em `origin/main` (`1d9785dd9`).
- **Decisão do dono que vale aqui (§9 do plano):** detecção automática é a base; a guarda age no "provável"; **miniatura ainda pede confirmação de 1 toque e não é detectada na v1** (linha "sai" do plano); qIg9 corre até o fim do teste.
- **Libera:** escrever o plano da S1+S3 e, depois do acordo de Phil e Yannis, o código (lib pura + fixture + testes). **Não libera:** publicar código do A/B antes do E8 do T19 (a lib pura pode ir ao staging, porque nada a chama; ver §10). Não toca `actions.ts` nem as assinaturas de `startAbTest`/`createAbTest`.
- Legenda: **[V]** verificado (dado ou código citado); **[H]** hipótese.

---

## 1. O que o experimento de 18/10 mostra (dados até 17:23 UTC)

Teste ativo no Studio desde 16:42 UTC (`qIg9a7vqcNo`): A = título longo + miniatura original; B = "Consistência e Compromisso (Part 4)" + variante com matiz trocado e espelhada.

| # | Fato | Prova | Peso na regra |
|---|---|---|---|
| F1 | **Título em teste é visível de fora.** Em 60 leituras anônimas da watch, 31 mostram B nos 3 renderers e 29 mostram A. A contagem de B por leitura é sempre 0 ou 3, nunca 1 ou 2: os 3 renderers concordam dentro da leitura. Os 3 renderers estão confirmados no HTML de 18/10 ~18:00: `videoPrimaryInfoRenderer.title.runs[]`, `playerOverlayVideoDetailsRenderer.title.simpleText`, `videoTitleHeaderViewModel.videoTitle.content` | `titulos.tsv`: watch `A=12 B=0` × 29, `A=9 B=3` × 31; leitura do HTML pelo Phil [V] | Título é o único campo detectável. |
| F2 | **Proporção medida de B é 31/60 = 52 %, não "~2 de 3"** como está no plano e no contexto. | mesma tabela [V] | Os limiares usam 1/2 e testam 1/3 por segurança. O plano conjunto deve ser corrigido. |
| F3 | **A mistura acontece dentro da mesma rodada.** Em 20 rodadas de 3 leituras (~2 min de intervalo), **13 têm A e B juntos; 7 são homogêneas** (AAA ×4, BBB ×3). | sequência por rodada: `ABB AAA BAA ABB ABB BBA BBB BBA AAA BBA BBA BAB AAB AAA BBB AAA AAB BBB ABB AAB` (conferida rodada a rodada por Yannis e Phil) [V] | É o que separa o teste nativo (divisão simultânea) de quem alterna por tempo. A fração observada, 13/20 = 0,65, está no acaso de 0,75 (p = 1/2). |
| F4 | `<title>` do HTML traz sufixo ("... - YouTube"); `og:title`, `twitter:title`, `itemprop name` e `videoDetails.title` vêm sem sufixo e continuam A em todas as leituras. As 9 ocorrências restantes de A são `<title>`, `meta title`, 2 × `title=` de link, `og:title`, `twitter:title`, `itemprop name`, `videoDetails.title` e `playerMicroformatRenderer`. | HTML lido pelo Phil às ~18:00 [V] | `tituloOficial` = `videoDetails.title` (fallback `og:title`), **nunca `<title>`**; não vê o teste; serve para conferir o desfecho. |
| F5 | **Miniatura sempre A** nos endereços canônicos (`/vi/<id>/<variante>.jpg`, sem query): 5 variantes × 3 hosts × com/sem cache (489 sondas). Nenhuma imagem a menos de 30 bits da A ficou perto da B. As rendições `sqp` referenciadas pela watch (F11), medidas uma vez às ~18:00 UTC, também são A (3 a 8 bits da A original de 1280×720). | dHash calculado com o `dhashOf` de `thumb-fingerprint.ts` (tabela §2.3) [V] | Miniatura em teste é invisível de fora. |
| F6 | **Recompressão no início:** a `hqdefault` ganhou ETag `"1792341745"` = **2026-10-18T16:42:25Z** (o instante em que o teste começou); o ETag antigo `"1567171355"` = 2019-08-30. Mesma imagem: dHash a 1 bit (`106068c9a7a3c3c8` → `106068cba7a3c3c8`). | `sondas.tsv` + dHash [V] | Sinal fraco: "algo foi reenviado agora". |
| F7 | **As bordas do CDN alternam as duas codificações e continuam alternando** (a sequência por sonda `normal`, `oNNoNoNNNNoNNN`, seguia até 17:30; não são "40 min"): no modo `normal`, a `hqdefault` volta ao sha antigo em 14 de 17 sondas no início; no `semcache`, sempre a nova. sha e ETag oscilam; dHash não. | `sondas.tsv` [V] | Proíbe regra por sha/ETag, e exige que o sinal fraco não dependa da ordem das leituras (§4.3 passo 7). |
| F8 | **dHash muda de 10 a 11 bits entre variantes de proporção diferente** da mesma imagem: `hqdefault`/`sddefault` (4:3 com faixas pretas) × `mqdefault`/`maxresdefault`/`hq720` (16:9). | A original 1280×720 `686068cfa7a3a3c6`; `hqdefault` `106068cba7a3c3c8` (10 bits); `sddefault` `106068cba7a3c388` (11) [V] | Comparar só dentro da mesma classe (F11). |
| F9 | **O 404 tem corpo de imagem:** `i9.ytimg.com` com `?r=` devolve 404 com a imagem cinza padrão (sha `20e9aab22032d856`, dHash `400e716969691648`, 32 bits da A); o 404 também aparece **sem** `?r=` (4 sondas `normal`). O script guardou esse corpo como se fosse miniatura. | `sondas.tsv` (`http=404`) + `img/*-20e9aab22032d856.jpg` [V] | dHash só existe com HTTP 200; a imagem padrão nunca conta como variante. |
| F10 | Na página de busca (`results`), B aparece em 38 de 60 leituras. | `titulos.tsv` [V] | Fora do contrato (só watch); anotado para a S4 decidir. |
| F11 | **A mesma `variante` do nome do arquivo tem rendições de tamanhos diferentes na watch.** A watch referencia `hqdefault.jpg?sqp=…&rs=…` em 4 tamanhos (168×94, 196×110, 246×138, 336×188), além da `hqdefault` 480×360 canônica. Entre as rendições da mesma imagem A o dHash difere de 7 a 14 bits (168×94 × 246×138 = 9; 168×94 × 196×110 = 7), acima de `DHASH_MAX_SAME = 6`. O script de 18/10 cortou a URL antes de `&rs=`; sem a assinatura o CDN ignora `sqp` e devolve a 480×360 comum (por isso `img-pag/u5..u13` são todas `106068cba7a3c3c8`). | download das URLs completas pelo Phil, 18/10 ~18:00 UTC (tabela §2.3) [V] | **A classe de comparação é `variante|largura×altura`**, não só o nome (§4.2). Sem isso, toda leitura da watch dá "dois grupos diferentes na mesma variante". |

**O que ainda não se sabe:** como o teste termina visto de fora (o qIg9 corre até o fim, com `sondar-paginas` de hora em hora no Mac); se o título oficial passa a B quando B vence; se a miniatura B aparece para logado, na home ou na recomendação; quanto tempo uma troca **comum** de título leva para propagar na watch (base dos 30 min, §10).

---

## 2. S0: fixture versionada

### 2.1 Onde e o quê

`apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo/` (uma só cópia; a A5 importa daqui, §1.2 do plano).

**Recorte fixo.** A fonte continua crescendo (o `sondar-paginas` anexa de hora em hora; em ~18:00 UTC `titulos.tsv` já tinha 138 a 145 linhas e `sondas.tsv` 624 a 655). A fixture é o **recorte `em ≤ 2026-10-18T17:23:00Z`** (60 leituras da watch em 20 rodadas, com as sondas no mesmo corte), gerado por um comando gravado no README, com o sha256 **do recorte** (não da fonte). C1–C8 nunca mudam. Dado posterior entra **só por arquivo novo de ampliação** (`titulos-ate-<data>.tsv`, `sondas-ate-<data>.tsv`), nunca por edição dos arquivos do recorte.

| Arquivo | Origem | Tamanho | Por quê |
|---|---|---|---|
| `titulos.tsv` | recorte da fonte (`em ≤ 17:23:00Z`) | ~121 linhas | título exibido por leitura (F1–F4) |
| `sondas.tsv` | recorte da fonte | ~535 linhas | ETag, sha e 404 por sonda (F6, F7, F9) |
| `paginas-watch.tsv` | `paginas.tsv` filtrado para `pagina = watch` **e** `rotulo = teste`, no mesmo recorte, URL limpa (tira o sufixo `');` que o grep do script deixou) | 360 linhas | URLs de miniatura vistas em cada leitura da watch |
| `dhash.tsv` | **derivado** uma vez com `dhashOf` sobre `img/`, `img-pag/`, `para-o-studio/` e as 4 rendições `sqp` completas (as imagens **não** entram) | 35 linhas (15 de `img/`, 14 de `img-pag/`, 2 de `para-o-studio/`, 4 `sqp`) | `arquivo, sha16, variante, largura, altura, url, dhash, origem`; mapeia `sha` (sondas) e URL (páginas) para dHash. As 4 rendições entram com `origem = sqp-completa-18/10` |
| `carregar.ts` | novo | — | converte os TSV em `LeituraWatch[]` (§2.2) |
| `README.md` | novo | — | origem, horário, comando do recorte, script de origem, sha256 de cada arquivo do recorte (padrão de `test/fixtures/observatorio/README.md`), "não editar: anexar arquivo novo", e a nota "as URLs de página foram truncadas antes de `&rs=`: o dHash dessas linhas é o da imagem canônica, não o da rendição `sqp`; as rendições reais estão em `dhash.tsv` com `origem = sqp-completa-18/10`" |

Sem imagem binária e sem HTML: o script não guardou o HTML, e o parser dos renderers é da A5 (S4), que terá a própria fixture de HTML recortado.

### 2.2 Como vira `LeituraWatch[]` (`carregar.ts`)

`carregarQIg9(): { leituras: LeituraWatch[]; sondas: LeituraWatch[] }`, só leitura de arquivo, determinístico.

1. **Leituras da watch:** cada linha `pagina = watch`, `rotulo = teste` de `titulos.tsv` vira uma leitura (60). **Rodada por intervalo**, não por índice: uma leitura com mais de 30 s depois da anterior abre rodada nova (`rodadaId = 'r' + n`); `assert` de que há 20 rodadas de exatamente 3 leituras. `lidaEm = em`. `idioma = 'pt-BR'` (o script manda `Accept-Language: pt-BR`). `origemRede = 'mac-casa'`. `erro = null`.
2. `tituloOficial = TITULO_A` (F4). `titulosExibidos` = os 3 renderers de F1, todos com `TITULO_B` se `B = 3`, senão `TITULO_A`. Que os 3 tenham o mesmo texto é inferido da contagem 0/3 [V por contagem; renderer a renderer é H].
3. `TITULO_A` exato: o script só casa o padrão `5 - Como somos controlados - Consist…Part 4)`. O implementador confirma o texto com uma leitura pública de `videoDetails.title` (só leitura) e o grava no README. `TITULO_B = 'Consistência e Compromisso (Part 4)'` [V].
4. **Miniaturas da leitura:** em `paginas-watch.tsv` (já filtrado para `rotulo = teste`) cada leitura tem 6 linhas consecutivas; o bloco k casa com a leitura k, com `assert` de 360 linhas e de que o `em` do bloco está em até 2 s do `em` da leitura (um bloco pode atravessar a virada do segundo, então agrupar por timestamp também erra). Cada URL vira `{ url, host, variante (nome do arquivo sem .jpg), largura, altura (de dhash.tsv), http: 200, etag: null, sha16: null, dhash }`. Limitação: as imagens das páginas foram baixadas **uma vez** (~16:44 UTC), não a cada leitura [V]; o dHash por leitura é suposto igual [H, coerente com F5]. **URL da watch sem linha em `dhash.tsv`** (8 URLs, 28 miniaturas em 7 leituras, surgidas depois do download de 16:44) vira miniatura com `http`, `etag`, `sha16`, `largura`, `altura` e `dhash` nulos (não buscada); proibido casar por prefixo ou por variante. Total: 28 sem dHash e 332 com.
5. **Sondas:** cada volta do `sondar.sh` (30 sondas, mesmo minuto) vira uma `LeituraWatch` só de miniaturas (são 17 voltas: 16 de 30 sondas e a última, cortada pelo recorte, com 2) (`titulosExibidos: []`, `tituloOficial: null`, `idioma: null`, `erro: null`), com `http`, `etag`, `sha16`, `largura`, `altura` e `dhash` (via `sha` → `dhash.tsv`; `http ≠ 200` → `dhash`, `largura`, `altura` nulos). Serve aos casos de recompressão e de CDN alternando (C6, C7). Usa-se como leitura "só miniatura" para testar a regra, sem dizer que a A5 colete assim.

### 2.3 dHash de referência (para conferir o `dhash.tsv`)

| Imagem | dHash | da A original | da B |
|---|---|---|---|
| A original 1280×720 (`para-o-studio/A`) | `686068cfa7a3a3c6` | 0 | 30 |
| B variante 1280×720 (`para-o-studio/B`) | `e9f9e90c1a3a3a9c` | 30 | 0 |
| `hq720`, `maxresdefault` (todas as cópias) | `686068cfa7a3a3c6` | 0 | 30 |
| `mqdefault` sha `24633e…` / `8d0db2…` | `686068c9a7a3a3c7` / `686068cba7a3a3c7` | 3 / 2 | 31 / 32 |
| `hqdefault` 480×360 sha `0e5ef9…` / `967c11…` | `106068c9a7a3c3c8` / `106068cba7a3c3c8` | 11 / 10 | 35 / 36 |
| `sddefault` sha `97d121…` / `e43686…` | `106068cba7a3c388` (as duas) | 11 | 35 |
| Corpo do 404 (sha `20e9aa…`) | `400e716969691648` | 32 | 34 |
| `hqdefault` rendição `sqp` 168×94 (`…CKgBEF5…`) | `686060cbc7a3a3a3` | 8 | — |
| `hqdefault` rendição `sqp` 196×110 (`…CMQBEG5…`) | `686068c9a5a3a3c3` | 5 | — |
| `hqdefault` rendição `sqp` 336×188 (`…CNACELwB…`) | `686068cfa7a3a383` | 3 | — |
| `hqdefault` rendição `sqp` 246×138 (`…CPYBEIoB…`) | `606068cda5a3a3c3` | 5 | — |

As quatro rendições `sqp` ficam a 14, 11, 11 e 11 bits da `hqdefault` 480×360 comum; entre si, até 9 bits (F11). Dentro da mesma classe (variante e dimensão), a recompressão mede **0 a 1 bit**; contra a imagem enviada ao Studio, 0 a 3 bits na mesma proporção. Se o CDN mudar uma rendição, anotar no README.

---

## 3. S1: contrato (`apps/web/src/lib/youtube/teste-youtube/tipos.ts`)

Dono: A/B. A A5 importa; pedido de mudança vai por mensagem. Os 3 pedidos da A5 (§8.1 do plano) estão no tipo, e `largura`, `altura`, `erro` e `idioma` entram nesta rodada (§8, "Pedidos à A5"). Regra de honestidade em todo campo: **nulo = não lido**; `""` e `0` nunca significam ausência (o Zod recusa `""`).

```ts
/** Versão da regra; vai junto de todo veredito e de todo desfecho para a S7 gravar e a S8 citar. Sobe a cada mudança de limiar ou de critério. */
export const REGRA_TESTE_YOUTUBE_VERSAO = 1

/** Os renderers em que o título exibido foi visto variar em 18/10. A coleta pode mandar outros; a regra aceita qualquer nome. */
export const RENDERERS_TITULO = ['videoPrimaryInfoRenderer', 'playerOverlayVideoDetailsRenderer', 'videoTitleHeaderViewModel'] as const

/** Uma leitura anônima (sem cookie) da página watch de um vídeo. Produzida pela A5 (S4). */
export interface LeituraWatch {
  youtubeVideoId: string            // 11 caracteres [A-Za-z0-9_-]
  lidaEm: string                    // ISO 8601; a saída do Zod é sempre UTC com Z e milissegundos (ver abaixo)
  /** Agrupa as N leituras da mesma rodada. Gerado pela coleta e OPACO para a regra: só se compara por igualdade.
   *  A coleta garante um só `origemRede`, um só `idioma` e duração de poucos minutos; recomenda-se uuid.
   *  A regra confere a duração (`maxDuracaoRodadaMs`) em vez de confiar. */
  rodadaId: string
  origemRede: string | null         // 'vercel' | 'forja' | 'mac-casa' ...; null = não registrado
  /** Idioma SERVIDO: HL/GL lidos do ytcfg da página, nunca o pedido (pedido `pt-BR`, servido `pt`). Títulos traduzidos pelo dono diferem por idioma:
   *  misturar idiomas seria "teste" falso. Sem ytcfg legível e com título lido = null, e a leitura é recusada e contada em `invalidas`.
   *  A coleta manda `hl=` e `gl=` explícitos na URL, não só Accept-Language. */
  idioma: string | null
  /** Código curto quando a leitura falhou ('http_429', 'consentimento', 'timeout', 'sem_initial_data' ...). null = leu.
   *  Leitura com erro nunca vota; os campos de dado vêm nulos ou vazios. Toda tentativa grava linha, inclusive a que falhou
   *  (sem linha de falha, a taxa de leituras válidas fica indefinida e a falha some em verde). */
  erro: string | null
  /** Título oficial = `videoDetails.title` (fallback `og:title`), já sem entidades HTML. NUNCA o `<title>` (traz " - YouTube"). null = não lido. */
  tituloOficial: string | null
  /** De onde veio `tituloOficial`: 'videoDetails' | 'og_title'; null quando `tituloOficial` é null. Gravado junto pela S4 (o fallback não pode passar por videoDetails). */
  titulo_oficial_fonte: 'videoDetails' | 'og_title' | null
  /** Um item por renderer procurado. texto null = o renderer NÃO estava na página (ausente); nunca "".
   *  Texto já sem entidades HTML e sem normalização (a regra normaliza). Para `videoPrimaryInfoRenderer` o texto é a
   *  concatenação de `title.runs[].text` (título com link ou hashtag vem partido em runs). */
  titulosExibidos: Array<{ renderer: string; texto: string | null }>
  /** Quantas rendições `sqp` a watch listou para ESTE vídeo (só URLs `ytimg.com/vi/<youtubeVideoId>/`; sqp de outros vídeos, como recomendados, nunca entram). null = não contado.
   *  Só a existência: nenhuma `sqp` é buscada nem entra em `miniaturas` (§8, pedido 4). */
  rendicoesSqp: number | null
  /** Só URLs `ytimg.com/vi/<youtubeVideoId>/`; as de outros vídeos nunca entram (a watch lista miniaturas de recomendados). */
  miniaturas: Array<{
    url: string
    host: string                    // i.ytimg.com, i1.ytimg.com ...
    variante: string                // nome do arquivo sem extensão nem query: hqdefault, mqdefault, sddefault, maxresdefault, hq720
    /** Dimensão decodificada da imagem (não lida da URL). null = não decodificada. A classe de comparação é `variante|largura×altura` (F11). */
    largura: number | null
    altura: number | null
    http: number | null             // null = não buscada
    etag: string | null
    sha16: string | null            // 16 hex do SHA-256 dos bytes
    /** 16 hex minúsculos, mesmo algoritmo de dhashOf (thumb-fingerprint.ts). Só com http 200; nunca do corpo de um 404.
     *  Nunca herdado de ETag igual: ETag igual a de leitura anterior = `dhash`, `largura` e `altura` nulos (a S4 decodifica a dimensão; dHash herdado nunca vai como lido). */
    dhash: string | null
  }>
}
```

**Zod** (`leituraWatchSchema`, no mesmo arquivo, Zod 3):

- `youtubeVideoId` `/^[A-Za-z0-9_-]{11}$/`; `rodadaId` `min(1).max(200)`.
- `lidaEm`: `z.string().datetime({ offset: true }).transform(s => new Date(s).toISOString())`. Aceita `Z`, `+00:00` (formato que o PostgREST devolve para `timestamptz`) e `-03:00`; recusa sem fuso. A saída é sempre UTC com `Z` e milissegundos. Toda comparação e ordenação da regra usa o **inteiro em ms** (`Date.parse` uma vez, ao validar), nunca texto: por texto, `"…16:42:56.5Z" < "…16:42:56Z"` (`.` < `Z`) mas no tempo é o contrário. Os campos de instante do veredito devolvem o ISO da leitura escolhida.
- Textos (`titulosExibidos[].texto` e `tituloOficial`): `z.string().max(500).refine(s => normalizarTitulo(s) !== '').nullable()`: recusa `""`, `"   "`, U+00A0 e U+200B (só espaço invisível não é título). O teste T1 afirma a recusa dos três. `url` `max(2048)`; `titulosExibidos.max(10)`; `miniaturas.max(60)` (o limite não muda: o filtro pelo id do vídeo é que impede estouro); `rendicoesSqp` inteiro 0–200 nullable; `titulo_oficial_fonte` nulo se e só se `tituloOficial` é nulo; `erro` `/^[a-z0-9_]{1,40}$/` nullable.
- `dhash` e `sha16` `/^[0-9a-f]{16}$/` nullable; `http` inteiro 100–599 nullable; `largura`/`altura` inteiros 1–4096 nullable, nulos juntos.
- `refine`: `dhash !== null ⇒ http === 200 && largura !== null`.
- `refine`: `erro !== null ⇒ titulosExibidos.every(t => t.texto === null) && miniaturas.every(m => m.dhash === null)`.
- `refine`: `erro === null && titulosExibidos.some(t => t.texto !== null) ⇒ idioma !== null` (sem idioma a defesa contra título traduzido some em silêncio).
- Exporta também `validarLeituras(x: unknown[]): { validas: LeituraWatch[]; invalidas: number }` para quem lê do banco.

Por que o Zod importa aqui e não só na borda: `hamming()` de `thumb-fingerprint.ts` faz `parseInt` de cada caractere; um caractere fora de hex vira `NaN` e o laço não roda. Com **os dois** lados inválidos a distância sai **0** = "mesma imagem"; com um só inválido sai o popcount do outro (31 para a A). Um dHash malformado nunca pode chegar a `hamming` [V no código].

**Veredito** (substitui o rascunho do §1.1 do plano; mudanças justificadas em §9):

```ts
export type CampoTeste = 'titulo' | 'miniatura'

/** Diagnóstico que acompanha todo veredito: deixa a tela dizer "0 de 12 leituras válidas" em vez de silêncio. */
export interface ContagemLeituras {
  recebidas: number; invalidas: number; comErro: number
  validasTitulo: number             // leituras sem erro com ≥1 renderer de título lido
  validasMiniatura: number          // leituras sem erro com ≥1 miniatura com dHash
  rodadas: number
  rodadasLongas: number             // rodadas que passaram de maxDuracaoRodadaMs (não contam como mistas)
  rodadasMistasTitulo: number       // depois de excluir rodadas longas e rodadas em quarentena de escrita nossa
  rodadasEmQuarentena: number       // rodadas que tocaram a quarentena de uma escritasConhecidas (N2 de Yannis r3)
  textosDistintosTitulo: number
  primeiraMistura: string | null    // ISO da 1ª leitura de uma rodada mista; null = nenhuma
}

export interface SinalFraco {
  tipo: 'reenvio_mesma_imagem'      // ETag numérico novo, imagem igual (F6)
  em: string                        // instante do ETag (ISO)
  variante: string
}

/** Estado de cada campo, separado do veredito geral. A miniatura NUNCA é 'provavel_teste' na v1. */
export type EstadoCampoTitulo =
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; motivo: 'poucas_leituras' | 'janela_curta' | 'span_ilegivel' }   // span_ilegivel: emenda de 18/10, rodada 4
  | { estado: 'nada_visivel'; motivo: 'um_valor_so' | 'troca_sem_mistura' | 'mistura_isolada' | 'mistura_esparsa' | 'mistura_atipica' }
  | { estado: 'provavel_teste' }
export type EstadoCampoMiniatura =
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; motivo: 'poucas_leituras' }
  | { estado: 'nada_visivel'; motivo: 'um_valor_so' | 'miniatura_variou' }

interface Base {
  versaoRegra: number
  contagem: ContagemLeituras
  sinaisFracos: SinalFraco[]
  /** O mais frequente entre as leituras válidas (empate: o primeiro pela chave de desempate); null = nenhum lido. */
  tituloOficial: string | null
  porCampo: { titulo: EstadoCampoTitulo; miniatura: EstadoCampoMiniatura }
}

/** O estado geral é o do TÍTULO, salvo 'provavel_teste'. Miniatura 'nada_visivel' nunca sobe para o geral (§4.3 passo 8). */
export type VereditoTesteYoutube = Base & (
  | { estado: 'sem_leitura' }                                           // nenhuma leitura válida de nada: NUNCA "sem teste"
  | { estado: 'insuficiente'
      detalhe:
        | { motivo: 'titulo_nao_lido' }                                 // há leitura de miniatura, mas o título não foi lido
        | { motivo: 'poucas_leituras'; minimo: number; atual: number }  // votos de título
        | { motivo: 'janela_curta'; janelaMs: number; minimoMs: number; variantes: string[] }
        | { motivo: 'span_ilegivel'; ilegiveis: number; rodadasSpan: number } }   // N2: mais da metade do span é rodada longa ou em quarentena
  | { estado: 'nada_visivel'                                            // NÃO quer dizer "não há teste"
      campos: ['titulo']
      motivo: 'um_valor_so' | 'troca_sem_mistura' | 'mistura_isolada' | 'mistura_esparsa' | 'mistura_atipica'
      valorUnico?: { titulo: string }                                   // presente quando motivo = 'um_valor_so'
      janela: { de: string; ate: string } }                             // primeira e última leitura válida de título
  | { estado: 'provavel_teste'
      campos: Array<'titulo'>                                           // v1: só título
      variantes: { titulo: string[] }                                   // texto como exibido
      proporcao: { titulo: Record<string, number> }                     // fração de votos, soma 1
      votos: { titulo: Record<string, number> }                         // contagem absoluta
      primeiraVista: string; ultimaVista: string                        // 1ª e última leitura das rodadas mistas dos pares aprovados
      janela: { de: string; ate: string } }
)

export interface EscritaConhecida {
  em: string                        // ISO 8601 COM fuso (Z ou ±hh:mm) do instante em que o app escreveu
  campo: CampoTeste                 // v1: só 'titulo' tem efeito
}

export interface OpcoesDeteccao {
  minLeituras?: number              // padrão 9
  minVotosPorVariante?: number      // padrão 2
  minRodadasMistas?: number         // padrão 2
  minJanelaMistaMs?: number         // padrão 30 min
  minFracaoRodadasMistas?: number   // padrão 0,4
  maxDuracaoRodadaMs?: number       // padrão 10 min
  maxVariantes?: number             // padrão 3 (limite do Test & Compare)
  dhashMaxSame?: number             // padrão DHASH_MAX_SAME (6); ninguém muda o valor neste ciclo
  /** Escritas do próprio app (S6/S7 passam as das últimas 30 h): rodada cujo intervalo [min lidaEm, max lidaEm] toca [em − maxDuracaoRodadaMs, em + quarentena] não conta como mista. */
  escritasConhecidas?: ReadonlyArray<EscritaConhecida>
  quarentenaEscritaMs?: number      // padrão 60 min
}

// `resolverOpcoes` (chamada por `detectarTesteYoutube` e `inferirDesfecho`) LANÇA `Error` para: limiar numérico NaN, infinito ou negativo;
// `escritasConhecidas[i].em` ausente, ilegível ou sem fuso (ISO sem `Z`/`±hh:mm` seria lido no fuso do servidor e deslocaria a quarentena em silêncio);
// `inferirDesfecho` valida também `minLeiturasEstavel`, `minJanelaEstavelMs` e `maxIdadeColetaMs`. `0` é aceito (escolha explícita do chamador).
// Consumidor (S4/S5/S6/S7): capturar o erro POR VÍDEO, registrar e seguir; um `em` ruim numa linha não pode derrubar o laço do cron inteiro.
// `em` sai de Date#toISOString() ou de timestamptz do Supabase (+00:00), nunca de `timestamp` sem fuso nem de string montada.
// Na S5, try/catch por vídeo: o erro vira "não deu para ler" daquele vídeo, registrado, sem derrubar a lista nem virar verde.
// Teste (da S5): `em` sem fuso no 2º de 3 vídeos, e os outros 2 renderizam. Erro de opção não é gravado como `erro` da leitura (falha do chamador).

export type ComparacaoImagem = 'mesma' | 'diferente' | 'incomparavel'

export interface ImagemComparavel { variante: string; largura: number | null; altura: number | null; dhash: string | null }

export type Desfecho =
  | { estado: 'vencedor_provavel'; vencedor: string; leiturasDescartadas: number; versaoRegra: number }
  | { estado: 'em_andamento'; motivo: 'teste_visivel' | 'estavel_curto'; versaoRegra: number }
  | { estado: 'sem_dado'
      motivo: 'antes_sem_teste' | 'depois_sem_leitura' | 'janelas_sobrepostas' | 'valor_fora_do_teste'
            | 'oficial_diverge' | 'oficial_nao_lido' | 'depois_ambiguo' | 'coleta_encerrada'
      versaoRegra: number }

/** Herda `escritasConhecidas` e os demais limiares: o p.7 do §4.4 chama `detectarTesteYoutube(leiturasDepois, opts)` com elas. */
export interface OpcoesDesfecho extends OpcoesDeteccao {
  minLeiturasEstavel?: number       // 18
  minJanelaEstavelMs?: number       // 24 h
  /** Instante de "agora", passado por quem chama (a regra continua sem Date.now()). OBRIGATÓRIO: opcional recriaria o defeito
   *  por omissão (teste acabado há semanas lido como 'em_andamento'). `inferirDesfecho(antes, depois, {})` lança. */
  agora: string
  maxIdadeColetaMs?: number         // 48 h
}
```

---

## 4. S3: regra pura

Arquivos em `apps/web/src/lib/youtube/teste-youtube/`: `tipos.ts`, `normalizar-titulo.ts`, `imagem.ts`, `detectar.ts`, `desfecho.ts`, `index.ts` (reexporta o que a A5 e a S6–S8 usam). Sem banco, sem rede, sem `Date.now()` (o tempo vem das leituras e de `opts.agora`), sem `sharp`.

**Dependência de `thumb-fingerprint.ts` (decidido: extrair por reexportação, primeiro commit da série).** `thumb-fingerprint.ts` importa `sharp` e `@vercel/blob` no topo [V]; a lib pura não pode puxar isso (C20 falharia por desenho, e um componente `'use client'` que importasse `normalizarTitulo` faria o `next build` empacotar `sharp`). Copiar é proibido pelo plano (§1.2, duas definições de `DHASH_MAX_SAME` divergem no primeiro ajuste). **Emenda da rodada 4:** a S2 da A5 já entregou `apps/web/src/lib/youtube/thumb-hamming.ts` (sem `sharp`) com `DHASH_MAX_SAME = 6`, `hamming`, `sameThumb` e `thumbRepresentatives`; é a fonte única. Nada se extrai de `thumb-fingerprint.ts`.

- `apps/web/src/lib/youtube/teste-youtube/dhash.ts` só reexporta de `@/lib/youtube/thumb-hamming` e nada mais.
- Teste: C32b afirma `tf.hamming === dhash.hamming` e `tf.DHASH_MAX_SAME === 6`.

**Desempate total (determinismo).** Toda ordenação "primeiro visto" usa a chave `(lidaEm em ms, rodadaId, índice do renderer em RENDERERS_TITULO, texto cru em ordem de code point)`. Sem isso, duas leituras no mesmo segundo com B em NFC e NFD devolveriam textos diferentes conforme a ordem de entrada.

### 4.1 `normalizarTitulo(s: string): string`

Na ordem: `normalize('NFC')` (acento composto e decomposto viram o mesmo texto; "Consistência" com `ê` em U+00EA ou `e`+U+0302); remove U+200B, U+FEFF, U+2060 e os seletores de variação U+FE0E/U+FE0F (um renderer pode mandar o emoji com ou sem seletor) [H: diferença real entre renderers não observada]; **mantém** U+200D (une emojis compostos; tirar quebraria a família 👨‍👩‍👧 em três); troca toda sequência de espaço Unicode (`\s` + U+00A0, U+202F) por um espaço; `trim`.

**Não** faz: minúsculas (o dono pode testar "Part 4" × "PART 4"; é variante real), tirar acento, tirar emoji, decodificar entidade HTML (é da coleta, §3). Igualdade só por texto normalizado; o texto devolvido em `variantes` é o primeiro visto pela chave de desempate, sem normalização.

### 4.2 `mesmaImagem(a: ImagemComparavel, b: ImagemComparavel, dhashMaxSame?): ComparacaoImagem`

Devolve `incomparavel` se algum dHash é nulo ou fora de `/^[0-9a-f]{16}$/`; se `variante`, `largura` ou `altura` diferem ou algum é nulo (F8, F11: a classe de comparação é `variante|largura×altura`); ou se algum é a imagem padrão do YouTube (`hamming(d, IMAGEM_PADRAO_YT) ≤ dhashMaxSame`, com `IMAGEM_PADRAO_YT = '400e716969691648'`, F9). Senão, `mesma` se `hamming ≤ dhashMaxSame`, `diferente` acima.

Tolerância: 6 (o valor vigente). Recompressão medida: 0–1 bit na mesma classe; menor rotação real do spike S1: 10; A × B do experimento: 30. Margem dos dois lados [V]. As rendições `sqp` (7 a 14 bits entre si) só não viram falso `diferente` porque cada tamanho é uma classe.

**Limiar customizado (condição a da A5):** com `dhashMaxSame` diferente do padrão, `mesmaImagem` não delega a `sameThumb` (sem parâmetro de limiar): limiar customizado chama `hamming` direto (ainda da fonte única). **S6 e S7 nunca passam `dhashMaxSame`**: o veredito carrega `REGRA_TESTE_YOUTUBE_VERSAO`, não o limiar, e um registro gravado com limiar diferente deixaria de ser recalculável; a opção é de teste (I6). Dívida declarada: dois laços de agrupamento; gatilho: `thumbRepresentatives` ganhar parâmetro de limiar (então o laço local sai). **Teste de equivalência:** com limiar 6, o laço guloso local e `thumbRepresentatives` dão o mesmo agrupamento em entrada embaralhada (C21) e nas 5 entradas do C22 (T5 do plano).

**Implementação (emenda da rodada 4):** `mesmaImagem` é invólucro de `sameThumb` de `thumb-hamming.ts`, não alias: guarda a classe `variante|largura×altura`, o hex minúsculo de 16 caracteres e a imagem cinza do 404, e só então delega a comparação; a fonte do limiar e do `hamming` é única.

Muda a assinatura do rascunho (`(dhashA, dhashB) => boolean`): booleano obrigaria a escolher entre "diferente" e "mesma" quando não dá para comparar, e os dois erram (F8/F11 dão falso teste; F9 dá falsa igualdade). §9.

### 4.3 `detectarTesteYoutube(leituras, opts?): VereditoTesteYoutube`

1. **Validação.** Cada leitura passa no `leituraWatchSchema`; inválida conta em `invalidas` e sai. Se as válidas têm mais de um `youtubeVideoId`, **lança** `Error` (erro de programação de quem chamou, não de dado; quem chama num laço de cron isola por vídeo e captura). `erro ≠ null` conta em `comErro` e sai. Toda comparação de tempo usa ms (§3).
2. **Voto de título por leitura.** Textos não nulos dos renderers, normalizados. Nenhum → a leitura não vota título. Todos iguais → 1 voto nesse texto. Discordam → não vota (conta em `validasTitulo`, mas fora dos votos) [conservador: em 18/10 nunca discordaram, F1].
3. **Rodada.** Chave `JSON.stringify([rodadaId, idioma, origemRede])` (o `rodadaId` é opaco e pode conter `|`; `null` e `'null'` não colidem). Rodada com mais de um `idioma` ou `origemRede` vira várias rodadas pela própria chave (defesa contra título traduzido parecer variante). **Rodada longa:** `max(lidaEm) − min(lidaEm) > maxDuracaoRodadaMs` (10 min) **não conta como mista** e soma em `contagem.rodadasLongas` (defesa contra coleta que reusa `rodadaId` num retry 6 h depois e juntaria leituras de antes e depois de uma troca comum). **Quarentena de escrita nossa:** rodada cujo intervalo `[min lidaEm, max lidaEm]` toca `[em − maxDuracaoRodadaMs, em + quarentenaEscritaMs]` de uma `escritasConhecidas` do mesmo campo não conta como mista (os votos continuam contando para `minLeituras`; só a mistura é ignorada). O intervalo, e não o primeiro voto, cobre a rodada que atravessa a escrita (09:58–10:02 com escrita às 10:00). Rodada longa e rodada em quarentena ficam **fora do numerador e do denominador** da fração do passo 5 (são ilegíveis; contá-las como "não mista" inventaria dado).
4. **Rodada mista (título):** rodada válida pelo passo 3 com ≥ 2 textos distintos entre os votos.
5. **Classificação do título, por pares.** Conta-se a mistura **por par de variantes** (chave = os dois textos normalizados, ordenados): um par coexiste numa rodada mista quando os dois textos têm voto nela. Isso impede que a troca A→B no dia 2 e a troca B→C no dia 20 (uma rodada mista cada) somem duas rodadas e virem "teste de 3 títulos". Ordem:
   - `validasTitulo = 0` → título `nao_lido`.
   - votos `< minLeituras` → `insuficiente`, `poucas_leituras`.
   - 1 texto só → `nada_visivel`, `um_valor_so`, `valorUnico.titulo`.
   - Vários textos, nenhuma rodada mista → `nada_visivel`, `troca_sem_mistura` (é alternância por tempo ou troca comum; a tela dos concorrentes cuida disso em `changes.ts`, não esta regra).
   - Nenhum par com `≥ minRodadasMistas` rodadas em que os dois coexistem e `≥ minVotosPorVariante` votos de cada texto → `nada_visivel`, `mistura_isolada`.
   - Textos ligados pelos pares que passaram `> maxVariantes` → `nada_visivel`, `mistura_atipica`.
   - Janela mista do par (do primeiro voto da 1ª rodada mista dele ao último voto da última) `< minJanelaMistaMs` em todos os pares aprovados → `insuficiente`, `janela_curta` (com `janelaMs`, `minimoMs`, `variantes`).
   - **Span ilegível (N2 de Yannis r3):** no span do conjunto de pares aprovados (abaixo), se rodadas longas + rodadas em quarentena `>` metade das rodadas do span → `insuficiente`, `span_ilegivel`. Sem isso, um `rodadaId` reaproveitado somado a uma ferramenta de terceiros encolhe o denominador e duas mistas passam. `span_ilegivel` cobre também o caso em que **nenhuma rodada do span** tem ≥ 3 votos válidos e não é longa nem em quarentena (a fração do passo seguinte ficaria sem base: 0/0): `insuficiente`, `span_ilegivel`, com `ilegiveis = rodadasSpan = ` todas as rodadas do span. A S5 (A5) não deve mostrar só 'rodada longa ou em quarentena' neste motivo: o texto é 'não deu para ler o período'.
   - **Fração (anti-ferramenta de terceiros):** entre a 1ª e a última rodada mista do par, inclusive, rodadas mistas (qualquer par) **com ≥ 3 votos válidos de título** ÷ rodadas **com ≥ 3 votos válidos de título** (numerador e denominador com o mesmo filtro, então a fração nunca passa de 1; N1 de Yannis r3) (o tamanho de projeto da rodada; rodada longa e rodada em quarentena ficam fora do numerador e do denominador, passo 3) `< minFracaoRodadasMistas` (0,4) → `nada_visivel`, `mistura_esparsa`. O numerador é a mistura geral e não a do par, para que 3 variantes a 1/3 (par A–B coexiste em só 44 % das rodadas) não caiam no limiar. Com mais de um par aprovado, o span vai da 1ª à última rodada mista de **qualquer** par aprovado (o conjunto dos pares aprovados). Em span ≤ 5 rodadas, duas mistas passam (2/5 = 0,4 não é `< 0,4`); risco residual ~1 % para ferramenta com q = 2 %. Se a A5 mudar o tamanho da rodada, o limiar é revisto com `REGRA_TESTE_YOUTUBE_VERSAO` 2.
   - Senão → **provável teste de título**. Variantes = textos ligados por pares aprovados; ordem: o igual a `tituloOficial` mais frequente primeiro, depois por primeira aparição (chave de desempate). `proporcao` e `votos` contam todos os votos da janela nessas variantes. `primeiraVista`/`ultimaVista` = 1ª e última leitura das rodadas mistas dos pares aprovados.
6. **Miniatura (v1: nunca `provavel_teste`).** Cada miniatura com dHash utilizável vira um voto; **deduplica-se por `(leitura, classe, grupo)`** (uma leitura com 2 hosts não cumpre sozinha `minVotosPorVariante`). Agrupa por **classe** `variante|largura×altura`; dHashes "iguais" são agrupados pelo representante (primeiro visto pela chave de desempate, guloso: `mesmaImagem` não é transitiva, A~A′ e A′~A″ não garantem A~A″). Estado: nenhuma leitura com miniatura → `nao_lido`; `validasMiniatura < minLeituras` → `insuficiente`, `poucas_leituras`; alguma classe com ≥ 2 grupos `diferente`, cada um com ≥ `minVotosPorVariante` votos → `nada_visivel`, `miniatura_variou` (informa, não promove); senão `nada_visivel`, `um_valor_so`. Motivo: hoje a miniatura em teste nativo é invisível de fora (F5), então o único "provável" que essa regra produziria é falso: numa troca real de imagem nossa, as bordas do CDN servem a antiga e a nova ao mesmo tempo (F7) e duas rotações nossas somariam `minRodadasMistas`, pausando o nosso próprio teste (a S6 leria `provavel_teste`); nos concorrentes, a alternância manual voltaria a ser "teste do YouTube". Reabrir quando o gatilho do plano disparar (leitura logada, home ou results mostrar a B), com `REGRA_TESTE_YOUTUBE_VERSAO` 2.
7. **Sinal fraco (F6).** Por variante (nome do arquivo): só se todos os dHash dessa variante, **dentro de cada classe de dimensão**, caem num grupo só. Cada instante de ETag numérico de 9–11 dígitos (instante de envio, como em `uploadInstant`) **distinto, exceto o mais antigo visto na janela**, vira um `SinalFraco { tipo: 'reenvio_mesma_imagem', em: instante do ETag, variante }`, ordenado por `(ms do em, variante por code point)`: o mesmo reenvio aparece em várias variantes com o mesmo `em`, então o desempate pela variante é o que torna a ordem independente da ordem das miniaturas dentro da leitura. No qIg9 saem **5 sinais** (um por variante, todos às 16:42:25Z). Quem agrupa por instante é a S7, na exibição. A regra independe da ordem de entrada (C21) e do CDN alternando (F7): com `{2019-08-30, 2026-10-18T16:42:25Z}` o único sinal de cada variante é o de 2026. A primeira leitura nunca emite sozinha. **Nunca muda o `estado`** e não entra em `campos`: o dono reenviando a mesma capa produz o mesmo sinal. A S7 pode mostrar "a capa foi reenviada às 16:42" ao lado de um teste de título; mais do que isso, não.
8. **Junção.** `provavel_teste` se o título é provável (`campos = ['titulo']`). Senão o estado geral **é o do título**, e a miniatura nunca o altera: título `nada_visivel` → `nada_visivel`; título `insuficiente` → `insuficiente` com o `detalhe` do título; título `nao_lido` → `sem_leitura` se não houve nenhuma leitura válida de nada (`validasTitulo = 0` e `validasMiniatura = 0`), senão `insuficiente`, `titulo_nao_lido`. Miniatura lida e título não lido **nunca** vira "nada visível": seria a prova de ausência vinda do único campo que nunca mostra o teste (F5), e a S6 liberaria a escrita no dia em que o YouTube mudar o layout e o parser perder os 3 renderers. O tempo e o diagnóstico da miniatura ficam em `porCampo.miniatura`.

**Limiares e porquê** (todos em `opts`, versão 1):

| Limiar | Valor | Justificativa com o dado de hoje |
|---|---|---|
| `minLeituras` | 9 | O que manda é ter ≥ 2 rodadas mistas, não o número de votos de B. Probabilidade de ≥ 2 rodadas mistas (3 leituras por rodada), por divisão e por número de rodadas (rodadas a cada 6 h): 2 variantes 1/2 (q = 0,75): 3 rodadas 0,84, 4 rodadas 0,95, 5 rodadas 0,98; 2 variantes 1/3 × 2/3 (q = 0,67): 0,74, 0,89, 0,96; 3 variantes 1/3 (q = 0,89): 0,97, 0,99, 1,00. Isto é, nas primeiras 12–18 h de um teste nativo, 5 a 26 % dos casos ainda saem `insuficiente` ou `mistura_isolada`; por isso `contagem.rodadasMistasTitulo` existe (D10 de Phil). 9 = 3 rodadas de 3, o desenho do experimento. |
| `minVotosPorVariante` | 2 | Um voto isolado pode ser glitch de parser ou de borda; 2 exige repetição. No experimento, B tem 31. |
| `minRodadasMistas` | 2 (por par) | Uma troca comum de título pode deixar uma rodada mista durante a propagação [H: tempo de propagação não medido]. Duas rodadas mistas separadas já não são propagação. 13 de 20 no experimento. |
| `minJanelaMistaMs` | 30 min | Duas rodadas mistas a menos de 30 min ainda podem ser a mesma propagação [H]. No experimento a mistura cobre 16:42:56→17:22:26 (39,5 min) e a regra acende a partir da rodada das 17:16. |
| `minFracaoRodadasMistas` | 0,4 | Nativo a p = 1/2 tem q = 0,75 por rodada; ferramenta de terceiros que alterna o título por horas só deixa mistura quando a rodada cai na propagação (q de poucos por cento). Em 30 dias × 4 rodadas = 120 rodadas, q = 2 % dá P(≥ 2 rodadas mistas) = 0,70 e q = 5 % dá 0,98: sem esta fração, o concorrente com TubeBuddy aparece como teste do YouTube. Fixture: 13/20 = 0,65 (C1) e 11/17 = 0,65 (C4) passam. Nativo com 10 rodadas dá falso `mistura_esparsa` com P = 0,15 % (2 variantes a 1/2; 0,67 % a 1/3 × 2/3). O denominador conta só rodadas com ≥ 3 votos de título: o 0,4 foi calibrado com 3 votos (q = 0,75); com 2 votos, q cai a ~0,5. |
| `maxDuracaoRodadaMs` | 10 min | A promessa da coleta é "poucos minutos" (a rodada do experimento dura ~2 min); a regra confere em vez de confiar em `rodadaId` reaproveitado. |
| `quarentenaEscritaMs` | 60 min | Cobre a propagação da nossa escrita [H: não medida] para o A/B Lab não se pausar sozinho. |
| `maxVariantes` | 3 | Limite do Test & Compare (support.google.com/youtube/answer/13861714). Mais de 3 misturadas não é este teste. |
| `dhashMaxSame` | 6 | §4.2. |

### 4.4 `inferirDesfecho(antes, leiturasDepois, opts?): Desfecho`

`antes` é um veredito `provavel_teste`. `leiturasDepois` são as **leituras** posteriores a `antes.ultimaVista` (quem chama recorta no SQL). A função recebe leituras, não um segundo veredito, porque precisa do sufixo estável e do `tituloOficial` por leitura (um veredito agregado esconde ambos). Ordem dos ramos:

1. `antes.estado ≠ 'provavel_teste'` ou `'titulo'` fora de `antes.campos` → `sem_dado`, `antes_sem_teste`.
2. Valida as leituras como em §4.3. Nenhum voto de título → `sem_dado`, `depois_sem_leitura`.
3. A primeira leitura válida com `lidaEm ≤ antes.ultimaVista` → `sem_dado`, `janelas_sobrepostas`.
4. **Sufixo estável.** Ordena por `lidaEm` (chave de desempate). O voto final é o da última leitura com voto; o sufixo é a maior sequência final de leituras cujo voto é o voto final. **Leitura sem voto** (renderers discordantes, sem título, idioma diferente) **é ignorada**: não conta nos 18 e não quebra o sufixo; leitura com voto diferente quebra. (Quebrar faria um glitch de parser zerar 18 votos; contá-la deixaria título traduzido passar por estável.) O **idioma de referência** é o mais frequente entre as leituras **votantes** de `depois`; `idioma = null` conta como um idioma como os outros; em empate vale o idioma da 1ª leitura votante pela ordem de desempate. Leitura votante de outro idioma conta como sem voto. Vale só para o desfecho (ramos 2 a 5); a detecção do ramo 7 lê todas as leituras (rodadas já separam por idioma, §4.3 p.3). Dívida registrada (gatilho: a S4 coletar de duas origens/idiomas para o mesmo vídeo): em empate o desfecho pode mudar quando entra leitura nova; o erro cai para `sem_dado`, nunca para vencedor errado. O que vem antes é ignorado e contado em `leiturasDescartadas` (a cauda homogênea do perdedor, 25 % dos testes a q = 0,75, não pode travar o desfecho para sempre: sem isso `depois = [AAA em teste, BBB, BBB, …]` vira `troca_sem_mistura` indefinidamente).
5. Sufixo com `≥ minLeiturasEstavel` (18) votos **e** janela `≥ minJanelaEstavelMs` (24 h):
   - voto final fora de `antes.variantes.titulo` (normalizado) → `sem_dado`, `valor_fora_do_teste` (o dono trocou para um terceiro título);
   - sufixo sem nenhum `tituloOficial` não nulo → `sem_dado`, `oficial_nao_lido` (parser que perdeu `videoDetails.title` não pode virar `vencedor_provavel`);
   - `tituloOficial` mais frequente do sufixo (entre os não nulos) diferente do voto final → `sem_dado`, `oficial_diverge` [H: que o oficial vire B quando B vence ainda não foi visto];
   - senão → `vencedor_provavel`, `vencedor` = a **variante canônica** de `antes.variantes.titulo` cujo texto normalizado é igual ao voto final (não o texto cru da leitura, que pode trazer espaço no fim ou outra composição Unicode), `leiturasDescartadas`. O `tituloOficial` é comparado após `normalizarTitulo` (NFC, espaços), e vem só do sufixo.
6. Senão, com a última leitura com mais de `maxIdadeColetaMs` (48 h) antes de `opts.agora` (obrigatório; ausente lança `Error`) → `sem_dado`, `coleta_encerrada` (a coleta parou antes de juntar 18 votos estáveis; sem isso o dono leria "em andamento" num teste acabado há semanas).
7. Senão: `detectarTesteYoutube(leiturasDepois, opts)` (repassa `escritasConhecidas`: a escrita nossa na janela `depois` não vira `teste_visivel`) é `provavel_teste` → `em_andamento`, `teste_visivel`; senão, com `v = detectarTesteYoutube(leiturasDepois, opts)`: `v.estado === 'insuficiente'`, ou `v.estado === 'nada_visivel'` com `motivo === 'um_valor_so'` → `em_andamento`, `estavel_curto`; qualquer outro (troca sem mistura, vários textos sem mistura, mistura isolada ou esparsa) → `sem_dado`, `depois_ambiguo` (decisão do controlador, regra proposta por Yannis na rodada 4: o sufixo é de um texto só por definição, então a distinção tem de vir do veredito de `depois`).

Todo ramo devolve `versaoRegra` (a S7 grava o vencedor com a versão que o produziu).

**Por que 18 e 24 h:** com B a 1/2, P(18 votos todos iguais durante o teste) ≈ 4×10⁻⁶; 24 h cobre a pausa de uma faixa de coleta. Se o YouTube concentrar tráfego no líder durante o teste [H], 18 iguais deixa de ser raro; por isso a palavra é "provável". Com 4 rodadas × 3 leituras por dia, 18 votos estáveis pedem ≥ 1,5 dia **depois do fim** do teste; por isso o requisito de coleta em §8.
**O que "vencedor" quer dizer:** o título que **ficou no ar**. Quando o YouTube encerra sem vencedor claro, a A fica, e a regra a chama de vencedora provável; a tela (S7/S9) diz "ficou no ar", nunca "ganhou". Miniatura não tem desfecho (F5).

---

## 5. Quando o dado não existe (o sistema falha em verde)

| Situação | O que a regra devolve | Por que não é verde |
|---|---|---|
| Lista vazia | `sem_leitura`, contagem zerada | Nunca `nada_visivel` sem leitura. |
| Todas as leituras com `erro` (429, consentimento, bloqueio do Vercel) | `sem_leitura`, `comErro = N` | A tela mostra "N leituras falharam". |
| YouTube muda o layout e os 3 renderers somem (`texto: null`) com miniaturas intactas | `insuficiente`, `titulo_nao_lido`; `porCampo.miniatura = nada_visivel` | A miniatura nunca vira prova de ausência (§4.3 passo 8); `validasTitulo = 0` fica visível. Sem miniatura também: `sem_leitura`. |
| Só um renderer some | os outros votam | Perde redundância, não o sinal. |
| `""` vindo do parser | recusado pelo Zod → `invalidas` | `""` não é "título vazio". |
| `idioma` nulo com título lido | recusado pelo Zod → `invalidas` | A defesa contra título traduzido não desliga em silêncio. |
| dHash malformado | recusado pelo Zod; `mesmaImagem` → `incomparavel` | `hamming` daria 0 ou 31 (§3). |
| 404 com corpo de imagem | `dhash` nulo pelo contrato; mesmo que venha, a imagem padrão é `incomparavel` | F9. |
| Variantes de proporção ou de rendição diferentes | nunca comparadas | F8, F11. |
| CDN alternando codificações | um grupo de dHash só; sinal fraco independente da ordem | F7; sha e ETag nunca decidem. |
| Teste só de miniatura | `nada_visivel` no campo miniatura; geral é o do título | O tipo diz "não visível de fora"; a S5/S7 tem de escrever isso, e a confirmação de 1 toque é o caminho (decisão do dono). |
| Leituras de vídeos diferentes misturadas | lança erro | Agregar dois vídeos inventaria variantes. |
| `rodadaId` reaproveitado por horas | rodada longa, não mista, `rodadasLongas` | A promessa da coleta é conferida. |
| Coleta parou antes do desfecho | `sem_dado`, `coleta_encerrada` (`agora` obrigatório) | Evita "em andamento" eterno. |

---

## 6. Complexidade

N leituras, R renderers por leitura (3), M miniaturas por leitura (≤ 30; o Zod limita a 60), L tamanho do título (≤ 100 no YouTube), k grupos de dHash por classe (1–3 na prática), P pares de variantes por rodada (≤ 3).

- Validação Zod: O(N·(R·L + M)); os limites do Zod (§3) barateiam o pior caso e impedem que lixo de parser vire variante.
- `normalizarTitulo`: O(L); `mesmaImagem`: O(1) (16 caracteres).
- Votos e agrupamento por rodada (Map): O(N·R·L); pares por rodada O(N·P); agrupamento guloso de dHash O(N·M·k), sem termo quadrático em N.
- Janela, primeira e última vista: mínimo e máximo em O(N). Ordenação para o desempate determinístico: O(N log N) uma vez.
- Total O(N log N + N·(R·L + M·k)) tempo, O(N + variantes) memória. `inferirDesfecho`: O(N log N) (reordena), V ≤ 3.

**N grande:** a coleta decidida (concorrentes ≤ 30 dias, próprios ≤ 14 dias) com, por exemplo, 4 rodadas de 3 leituras por dia dá ≤ 360 leituras por vídeo: abaixo de 1 ms. A regra é **por vídeo** (lança se misturar); quem chama nunca passa a tabela inteira, recorta a janela no SQL (índice por `youtube_video_id, lida_em`, decisão da S4). **Risco do chamador, não da lib:** a S5, com centenas de vídeos de concorrentes numa tela, calcula por página visível ou grava o veredito por vídeo (com `versaoRegra`); nunca valida a tabela inteira numa requisição. A janela do `depois` no desfecho é recorte do chamador; a regra não guarda estado entre chamadas.

---

## 7. Critérios de aceite (Vitest, `// @vitest-environment node`)

Arquivos em `apps/web/test/youtube/teste-youtube/`. Fixture real (§2) onde o caso existe; sintético mínimo onde não.

| # | Caso | Esperado |
|---|---|---|
| C1 | Fixture inteira (60 leituras, 20 rodadas) | `provavel_teste`, `campos = ['titulo']`, `variantes.titulo = [A, B]`, `votos = {A: 29, B: 31}`, `proporcao.B ≈ 0,517`, `primeiraVista = 2026-10-18T16:42:56Z`, `ultimaVista = 2026-10-18T17:22:26Z`, `contagem.rodadasMistasTitulo = 13`, `rodadasLongas = 0`; `porCampo.miniatura.estado = 'nada_visivel'` |
| C2 | Prefixo: 1ª rodada (3 leituras) | `insuficiente`, `detalhe = { poucas_leituras, minimo: 9, atual: 3 }` |
| C3 | Prefixo até a rodada das 17:07 (mistura cobre < 30 min) | `insuficiente`, `janela_curta` (com `variantes`) |
| C4 | Prefixo até a rodada das 17:16 | `provavel_teste` |
| C5 | Fixture com `minLeituras = 61` | `insuficiente` (o limiar é opção, não constante escondida) |
| C6 | Sondas da fixture (só miniaturas, sondas de teste do corte) | `porCampo.miniatura = nada_visivel`, `um_valor_so`; nenhum `diferente` entre `0e5e…` e `967c…`; **geral `insuficiente`, `titulo_nao_lido`** (a miniatura nunca sobe para o geral) |
| C7 | Sondas: sinal fraco | exatamente **5** `SinalFraco` `reenvio_mesma_imagem`, um por variante (`hq720`, `hqdefault`, `maxresdefault`, `mqdefault`, `sddefault`), todos em `2026-10-18T16:42:25Z`, ordenados por (`em`, variante por code point); **nenhum sinal com `em` < 2026-10-18** (o ETag de 2019 "voltando" não emite); as sondas `http 404` não contam; as sondas embaralhadas (e as miniaturas de cada sonda embaralhadas) dão o mesmo array; o estado continua o de C6 |
| C8 | Sondas com 404 | as sondas `http = 404` não votam; corpo do 404 forçado com `dhash = '400e716969691648'` e `http = 200` → `mesmaImagem` = `incomparavel`, sem `miniatura_variou` |
| C9 | `mesmaImagem` | mesma classe a 1 bit → `mesma`; A × B (30 bits) → `diferente`; `hqdefault` × `maxresdefault` da mesma A → `incomparavel`; `hqdefault` 480×360 × `hqdefault` 336×188 → `incomparavel`; dimensão nula → `incomparavel`; dHash `'zz…'` ou com 15 caracteres → `incomparavel`; limite exato: 6 bits `mesma`, 7 `diferente` |
| C10 | Concorrente que alterna por tempo: 3 dias, 4 rodadas/dia de 3 leituras, título A no dia 1, B no 2, A no 3, cada rodada homogênea | `nada_visivel`, `troca_sem_mistura` (não é teste do YouTube) |
| C10b | Ferramenta que alterna o título a cada 3 h por 30 dias × 4 rodadas de 3, com 1 rodada em cada 25 caindo na propagação (mista) | `nada_visivel`, `mistura_esparsa` |
| C11 | Troca comum de título com 1 rodada mista no meio | `nada_visivel`, `mistura_isolada` |
| C12 | Fixture com `videoPrimaryInfoRenderer.texto = null` em todas | mesmo veredito de C1. Com os 3 renderers nulos e as miniaturas intactas: `insuficiente`, `titulo_nao_lido`, `contagem.validasTitulo = 0`, `porCampo.miniatura.estado = 'nada_visivel'`; nunca o geral `nada_visivel`. Com os 3 nulos e sem miniatura válida: `sem_leitura` |
| C13 | Leitura com erro: fixture + 20 leituras `erro: 'http_429'`; e só leituras com erro | 1º: mesmo veredito de C1 e `comErro = 20`; 2º: `sem_leitura` |
| C14 | Desfecho sintético: `antes` = C1; `leiturasDepois` = 24 leituras em 26 h só com B e `tituloOficial = B` | `vencedor_provavel`, `vencedor = B`. Variações: `depois` = AAA em teste + 24 B em 26 h → `vencedor_provavel` B com `leiturasDescartadas = 3`; 10 leituras → `em_andamento` `estavel_curto`; oficial = A → `sem_dado` `oficial_diverge`; oficial = "B - YouTube" (erro de coleta: usou `<title>`) → `oficial_diverge`, documentando o caso para a S4; valor C → `valor_fora_do_teste`; `depois` misto → `em_andamento` `teste_visivel`; `depois` `troca_sem_mistura` → `sem_dado` `depois_ambiguo`; `depois` vazio → `depois_sem_leitura`; `depois` começando antes de `ultimaVista` → `janelas_sobrepostas`; `depois` com 10 leituras e a última há 72 h de `agora` → `sem_dado` `coleta_encerrada`; todo desfecho carrega `versaoRegra`; `tituloOficial` nulo em todo o sufixo → `sem_dado` `oficial_nao_lido`; B×24 com 2 leituras sem voto no meio → ainda `vencedor_provavel`; B×24 com 1 voto A no meio → sufixo menor (`em_andamento` `estavel_curto` ou `leiturasDescartadas` maior); `depois` com rodada mista dentro da quarentena de `escritasConhecidas` → com < 9 votos, `estavel_curto`; com ≥ 9 votos (a mistura só existe na quarentena e a detecção a ignora, então o veredito de `depois` é `nada_visivel`/`troca_sem_mistura` ou similar), `sem_dado`, `depois_ambiguo` (conservador: não grava vencedor nem teste), nunca `teste_visivel`; `inferirDesfecho(antes, depois, {})` sem `agora` lança (e `@ts-expect-error` no tipo). (Quando o qIg9 terminar, entra o caso real.) |
| C15 | Acento e emoji: mesmas leituras com B em NFD (`e` + U+0302), com espaço duplo, com U+00A0, com `🔥` × `🔥︎` (U+FE0E) | tudo conta como a mesma variante B; `variantes.titulo[1]` é o texto como visto primeiro. `PART 4` × `Part 4` → variantes distintas. Emoji com U+200D preservado |
| C16 | Idioma: rodada com leituras `pt-BR` (A) e `en` (título traduzido) | não conta como rodada mista |
| C17 | 4 títulos misturados em ≥ 2 rodadas | `nada_visivel`, `mistura_atipica` |
| C18 | Leituras de dois `youtubeVideoId` | lança `Error` |
| C19 | Zod | `""` em `texto` recusado; `dhash` com `http = 404` recusado; `dhash` sem `largura` recusado; `lidaEm` sem fuso recusado, `+00:00` aceito e normalizado para `Z`, `-03:00` aceito e convertido; `titulosExibidos` lido com `idioma = null` recusado; leitura inválida conta em `invalidas` e não muda o veredito |
| C20 | Pureza | `detectar.ts`, `desfecho.ts`, `imagem.ts`, `normalizar-titulo.ts` não importam `sharp`, `@vercel/blob`, `next/*` nem Supabase (teste que lê o grafo de imports ou `grep` no próprio teste) |
| C21 | Determinismo | mesmas leituras embaralhadas → mesmo veredito (igualdade profunda), inclusive duas leituras no mesmo segundo com B em NFC e NFD; mesma leitura com `.500Z` e outra com `Z` no mesmo segundo → ordem cronológica por ms |
| C22 | Rendições `sqp` da watch: 5 entradas (a `hqdefault` 480×360 mais as 4 rendições da tabela §2.3) × 9 leituras em 3 rodadas | `porCampo.miniatura = nada_visivel`, `um_valor_so` por classe; nunca `provavel_teste`; nenhuma rodada mista de miniatura |
| C23 | Sondas sintéticas com dois dHash a 30 bits na mesma classe `hqdefault|480×360`, alternando em 3 rodadas por 2 h | `porCampo.miniatura = nada_visivel`, `miniatura_variou`; estado geral nunca `provavel_teste` |
| C24 | Título A/B alternado por escrita nossa a cada 24 h por 3 dias, com uma rodada mista logo depois de cada escrita | com `escritasConhecidas`: `nada_visivel`; sem elas: `provavel_teste` (prova que a opção é o que segura) |
| C25 | Troca A→B no dia 2 e B→C no dia 20, uma rodada mista em cada | `nada_visivel`, `mistura_isolada` (C1 continua igual: o par A–B coexiste em 13 rodadas) |
| C26 | Mesma `rodadaId` com A às 10:00 e B às 16:00, duas vezes | rodada longa, não mista; `rodadasLongas = 2`; `nada_visivel` ou `insuficiente`, nunca `provavel_teste` |
| C27 | Roundtrip do banco: `lidaEm` como `…+00:00` e fração de segundo | `validarLeituras` aceita todas; ordem por ms |
| C28 | Quarentena que atravessa a escrita: escrita nossa às 10:00, rodada mista com leituras 09:58–10:02 | com `escritasConhecidas`: rodada não mista; sem elas: mista (junto de C24) |
| C29 | Denominador da fração: nativo com algumas rodadas de 2 votos (uma leitura `erro`), uma delas mista, e uma rodada longa e uma em quarentena | rodadas de 2 votos (mesmo a mista), longas e em quarentena fora do numerador e do denominador; fração ≤ 1 sempre; `provavel_teste` se as de ≥ 3 votos passam 0,4 |
| C32a | Span ilegível (N2): C26 repetido em 4 de 5 rodadas do span + 2 rodadas mistas | `insuficiente`, `span_ilegivel`; nunca `provavel_teste`; `contagem.rodadasLongas = 4` |
| C30 | Span com mais de um par aprovado (3 variantes) | fração medida da 1ª à última mista de qualquer par aprovado; span ≤ 5 com 2 mistas passa |
| C31 | `inferirDesfecho` sem `agora` | lança `Error`; com `agora` obrigatório no tipo |
| C32b | Reexportação | `tf.hamming === dhash.hamming` e `tf.DHASH_MAX_SAME === 6` |

---

## 8. O que fica para a S6, S7 e S8 (só as interfaces que consomem) e pedidos à A5

- **S6 (guarda no canal próprio):** consome `VereditoTesteYoutube` do vídeo.
  - **Início:** o início **não** passa por `settleOnAir` [V: `startAbTestInternal` em `ab-start.ts:182`, chamado por `actions.ts:658`, `ab-rotate-phases.ts:123` e `ab-evaluate-phases.ts:37`]. A guarda de início vai em `startAbTestInternal` (lib), sem tocar `actions.ts` nem as assinaturas de `startAbTest`/`createAbTest`: a colisão do §1.2 do plano não existe.
  - **Saída e rotação:** `settleOnAir` já recebe portas (`PortasSaida`); a guarda entra como porta nova (`lerVereditoTesteYoutube(videoId)`) que lê as leituras **gravadas** (S4) e chama a lib. Nunca ler a watch ao vivo dentro do teto de 55 s. "Pausar ao original" é uma escrita: com teste nativo provável, a pausa não pode restaurar o título.
  - **Política recomendada (decisão é da S6):** no canal próprio, **bloqueia** a escrita: `provavel_teste`; `insuficiente` (inclusive `janela_curta`, onde a mistura já foi vista e a regra ainda não acende, ~12 h com rodadas a cada 6 h); `sem_leitura`; e `nada_visivel` com `contagem.rodadasMistasTitulo ≥ 1`. Falso positivo custa atraso; falso negativo corrompe dois testes. Não bloqueia: `nada_visivel` com `rodadasMistasTitulo = 0`.
  - Passa `escritasConhecidas` (as escritas do app nas últimas 30 h: `restore_status`, `inicioUltimoCiclo`, `winner_applied_at`) para o app não pausar o próprio teste (C24).
- **S7 (registro automático):** consome `variantes.titulo`, `votos`, `primeiraVista`, `ultimaVista`, `sinaisFracos`, `tituloOficial`, `versaoRegra` para gravar o registro `detectado`, e `inferirDesfecho(antes, leiturasDepois)` para gravar o vencedor provável com a `versaoRegra` do desfecho. O veredito é recalculável e muda se a regra mudar (achado 3 do Phil). Miniatura: só por confirmação; `sinaisFracos` pode sugerir o momento. Na exibição a S7 agrupa `sinaisFracos` por `em` ("a capa foi reenviada às 16:42, 5 tamanhos"): a fusão é de tela, o dado fica um por variante.
- **S8 (placar):** não consome a regra diretamente; consome os registros da S7 para saber que um vídeo esteve em teste nativo e em que janela (nunca os dois testes no mesmo vídeo ao mesmo tempo).
- **A5 (S4, S5) importa** `LeituraWatch`, `leituraWatchSchema`, `validarLeituras`, `RENDERERS_TITULO`, `detectarTesteYoutube`, `mesmaImagem` (serve também ao `revertTo` por Hamming da S2, se quiser a mesma regra de classe e imagem padrão) de `@/lib/youtube/teste-youtube`.
- **Pedidos à A5 (a assinar):**
  1. Os 3 já aceitos: `texto` nulo = renderer ausente (nunca `""`); `dhash` hex minúsculo de 16 caracteres, igual a `dhashOf`; `rodadaId` opaco gerado pela coleta.
  2. Toda tentativa grava linha, inclusive a que falhou (`erro`); `titulo_oficial_fonte` gravado com `tituloOficial`. `largura` e `altura` decodificadas em cada miniatura; `erro` e `idioma` no tipo, com uma rodada = um só idioma e uma só origem, duração de poucos minutos, `rodadaId = uuid`; `hl=` e `gl=` explícitos na URL. **`idioma` = HL/GL servido (ytcfg), não o pedido** (emenda da rodada 4, contestação da A5 aceita: pedido `pt-BR`, servido `pt`). A migration da S4 leva CHECK contra `''` nos textos e contra `dhash` fora de `/^[0-9a-f]{16}$/` (Phil, assinatura da A5).
  3. `tituloOficial` = `videoDetails.title` (fallback `og:title`), nunca `<title>`; `videoPrimaryInfoRenderer` = concatenação de `runs[].text`.
  4. Para dHash, buscar só as URLs canônicas sem query (`/vi/<id>/<variante>.jpg`) e gravar das `sqp` só a existência (`rendicoesSqp`): menos bytes e uma classe por variante. Filtrar as miniaturas pelo id do vídeo (`ytimg.com/vi/<youtubeVideoId>/`): a watch lista as de recomendados.
  5. **Requisito de coleta (D7; forma trocada pela emenda da rodada 4: a S4 grava `coleta_ate` sem depender da S7):** vídeo com veredito `provavel_teste` sem desfecho continua na coleta até `vencedor_provavel` ou até 30 dias após `ultimaVista` (4 rodadas × 3/dia pedem ≥ 1,5 dia depois do fim do teste para juntar 18 votos estáveis; sem isso o teste que começa perto do corte de 14 ou 30 dias nunca fecha).
  6. **Hora-base espalhada por vídeo** (emenda da rodada 4, no lugar do jitter fixo de ±20 min em torno do múltiplo de 6 h): cada vídeo tem a sua hora-base dentro do período de 6 h, fixa e espalhada entre os vídeos, mais ±20 min sorteados por rodada (como no §12, item 6), para a rodada não ficar em fase com o período de uma ferramenta de terceiros (período divisor de 6 h trocando em fase deixaria q efetivo = 1 e daria `provavel_teste` falso; chance de coincidir ~1–3 %).
  7. **Gravação normalizada de ~290 B por leitura** (emenda da rodada 4): a S4 grava `(variante, largura, altura, dhash)` com o ETag na chave da miniatura (só quando muda) e mantém a leitura crua por **30 dias** após o vídeo sair da coleta. A conta de V vídeos e do plano gratuito é da S4 (V não medido).
- **S5 (A5, tela):** `insuficiente` com `motivo = 'span_ilegivel'` (emenda da rodada 4) significa "não deu para ler o período" (texto fixo, sem causa; não citar "longa" nem "quarentena"): a S5 trata como "não deu para ler", nunca verde, nem "sem teste" nem "poucas leituras, aguarde". Mapa motivo → texto com `switch` exaustivo (`never` no `default`) e um teste de componente por motivo, incluindo `span_ilegivel`, que mostra `ilegiveis/rodadasSpan` só como "N de M rodadas sem leitura utilizável", sem causa. O teste de componente de `span_ilegivel` cobre 2 casos (maioria longa; 0/0 com rodadas curtas) e afirma que o texto não contém "longa" nem "quarentena". A guarda da S6 já bloqueia todo `insuficiente`.

---

## 9. Decisões tomadas neste rascunho (mudam o §1.1 do plano)

1. `LeituraWatch` ganha `erro` (leitura com erro precisava existir no contrato), `idioma` (título traduzido pelo dono seria teste falso) e `largura`/`altura` (F11). A A5 assina.
2. `mesmaImagem` recebe `{ variante, largura, altura, dhash }` e devolve três valores (F8, F9, F11).
3. O veredito ganha `versaoRegra`, `contagem` (com rodadas mistas e longas), `sinaisFracos`, `tituloOficial`, `porCampo`, `motivo`, `janela`, `votos`; `proporcao` e `variantes` ficam só em título.
4. Mistura conta só dentro da rodada (F3) e por par de variantes: é o critério que separa o nativo de quem alterna por tempo.
5. `hamming`/`DHASH_MAX_SAME` extraídos para `lib/youtube/dhash.ts` com reexportação (§4).
6. A proporção "2 de 3" do plano está errada pelo próprio dado (31/60); pedir correção do plano conjunto.
7. Miniatura não é detectada na v1 (linha "sai" do plano); `Desfecho` vira união discriminada com `versaoRegra` e `inferirDesfecho` recebe leituras.

---

## 10. Verificado × hipótese, e o que não conferi

- **[V]:** F1–F11 (contas sobre os TSV, dHash recalculado com o algoritmo de produção e HTML lido pelo Phil às ~18:00); `hamming` devolve 0 (dois lados inválidos) ou o popcount do outro lado; `thumb-fingerprint.ts` importa `sharp` e `@vercel/blob`; Zod 3.25 no `apps/web` (`datetime()` sem `offset` recusa `+00:00`); testes do domínio em `apps/web/test/youtube/`; os 3 renderers e `videoDetails.title` sem sufixo.
- **[H]:** que os 3 renderers concordem sempre (inferido da contagem 0/3); tempo de propagação de uma troca comum de título (base dos 30 min, da fração 0,4 e da quarentena de 60 min); que a divisão do YouTube seja estável e não adaptativa (base do desfecho); que o título oficial vire B quando B vence; que a imagem padrão do 404 seja a mesma para todo vídeo; que os seletores de variação difiram entre renderers; que a troca de **imagem** (não só a recompressão) deixe as bordas servindo a antiga (inferido de F7).
- **Limite conhecido [H] (E3):** alternador por ferramenta cujo período divide 6 h e que troca em fase com a nossa rodada passa na fração (q efetivo = 1); mitigado pela hora-base espalhada por vídeo (pedido 6 à A5). Discriminador opcional para a v2: no nativo 1/3 das rodadas mistas têm ordem não monotônica (ABA, BAB); a propagação é sempre monotônica. Divisão desigual do YouTube (menor variante < ~16 % do tráfego) faz q < 0,4 e dá falso `mistura_esparsa`: erro para o lado seguro (a S6 bloqueia por `rodadasMistasTitulo ≥ 1`).
- **Conferência sem custo (não é portão):** na primeira troca comum de título do dono num vídeo próprio, sondar a watch (`sondar-paginas`) a cada 30 s por 1 h, só leitura, e anexar o resultado aqui com data (mede a propagação que sustenta 30 min, 0,4 e 60 min).
- **Não conferi:** o HTML guardado (não foi); leitura logada ou na home; outro vídeo ou outra rede; leitura a partir do Vercel ou da forja (consentimento, 429, idioma pelo IP: P-V da A5); se as rendições `sqp` mudam de tamanho ou assinatura; o fim do teste; o volume real da S4. A medição da propagação de uma troca comum (Mac sonda a watch a cada 30 s por 2 h depois de o dono trocar o título de um vídeo próprio sem teste) fica **pendente**, fora deste spec (§12, recusados). O lote só com a lib pura pode ir ao staging antes do E8 do T19 (nada a chama, nenhuma rota, nenhuma migration); quem decide é o controlador com Hanna.

## 11. Perguntas (com recomendação)

1. **Resolvida (Yannis):** extrair `dhash.ts` por reexportação (§4).
2. **Para a A5:** assinar o §8 "Pedidos à A5", em especial `erro`, `idioma` (uma rodada = um idioma e uma origem), `largura`/`altura` e o requisito de coleta 5. Sem isso, C16, C22 e o desfecho não têm como ser garantidos na coleta.
3. **Para a Hanna levar ao dono:** o A/B nosso espera ~12 h de leitura (3 rodadas) antes da 1ª escrita num vídeo sem histórico? Recomendo sim: a política de bloqueio do §8 (S6) faz o falso positivo custar só atraso, e `minLeituras = 9` e a janela de 30 min deixam o "provável" aparecer na 3ª rodada (~12 h). O teste nativo dura dias.

---

## 12. Decisões da rodada 2 (onde Yannis e Phil se sobrepõem ou conflitam)

| Tema | Yannis | Phil | Escolha |
|---|---|---|---|
| Miniatura na v1 | C1: nunca `provavel_teste`; `miniatura_variou` | D1: classe `variante|largura×altura`; D2: `porCampo`, geral é o do título | **Os três juntos** (o mais restritivo): miniatura nunca provável, classe com dimensão, e miniatura lida nunca promove o geral a `nada_visivel`. `miniatura_variou` fica em `porCampo.miniatura`. |
| Contagem de rodadas mistas | F3 = 13/7 (I4) | P1 = 13/7 | 13 mistas e 7 homogêneas; C1 afirma `rodadasMistasTitulo = 13`. |
| Fixture | recorte `em ≤ 17:23:00Z`, anexo por arquivo novo (I4) | mesmo recorte, mais junção por bloco com `assert`, rodada por intervalo > 30 s, URLs truncadas no README (D11) | Recorte único; Phil complementa o carregador e o README. |
| Sinal fraco | Todo instante de ETag distinto exceto o mais antigo, se as imagens caem num grupo (I6) | Só instante maior que todos os anteriores, com leitura anterior menor (D8) | **Yannis**: independe da ordem de entrada (C21), e dá o mesmo resultado em C7. |
| Assinatura do desfecho | `(antes, depois)` com `tituloOficial` na Base (I3) | Sufixo estável precisa de leituras (D6), `agora` (D7) | `inferirDesfecho(antes, leiturasDepois, opts)`; `tituloOficial` entra na Base do veredito de qualquer forma (S7 grava). Desfecho em união discriminada com `versaoRegra` (Yannis) e motivos `coleta_encerrada` (Phil) e `depois_ambiguo` (Yannis). |
| Mistura por par × fração | I2: contagem por par | D3: fração mínima de rodadas mistas | Os dois, nessa ordem; o numerador da fração é a mistura geral (para não punir 3 variantes a 1/3). |
| Política da S6 | trata `janela_curta` como provável | bloqueia com `rodadasMistasTitulo ≥ 1`, `sem_leitura` e `insuficiente` | União, que é o mais restritivo (§8). |
| Instante `lidaEm` | ms numéricos para comparar (I5) | `datetime({ offset: true })` + normalização (D4) | Os dois: o Zod aceita offset e normaliza; a regra compara ms. |
| `tituloOficial` | campo na Base (I3) | fonte = `videoDetails.title`, nunca `<title>` (D5) | Os dois. |
| `idioma` | chave de rodada com `JSON.stringify` (M2) | Zod exige `idioma` quando há título (D12) | Os dois. |

**Aplicados sem conflito:** Yannis M1–M6, `dhash.ts` por reexportação de `thumb-hamming.ts` (a linha `mesmaImagem` = alias da emenda anterior foi corrigida na rodada 4: é invólucro), guarda S6 em `startAbTestInternal` e porta no `settleOnAir` lendo leituras gravadas; Phil D4, D5, D6, D7, D8, D9, D10, D12, P1–P4, P6, P7.

**Recusados:** **P5 (medir a propagação de troca comum de título)**: exige o dono trocar o título de um vídeo e uma sonda de 2 h; é experimento novo, não conserto de spec. Fica como pendência em §10, e o resultado ajusta `minJanelaMistaMs`, a fração e a quarentena na versão 2.

**Decisões da rodada 3 (controlador):**

- **Denominador de `minFracaoRodadasMistas`:** só rodadas com ≥ 3 votos válidos de título (R3 de Yannis). Rodadas longas e em quarentena ficam FORA do numerador E do denominador, porque são ilegíveis: contá-las como "não mista" seria inventar dado (falha em verde). Isso supera o primeiro ponto da E2 de Phil (que as queria no denominador). Os outros dois pontos da E2 valem: span do conjunto de pares aprovados; leitura sem voto ignorada no sufixo (igual a R2).
- `agora` obrigatório em `OpcoesDesfecho` (E1); `OpcoesDesfecho extends OpcoesDeteccao` (R5); `oficial_nao_lido` (R1); quarentena por intervalo da rodada (R4).

### Decisões da conferência final (rodada 3, Yannis)

- N1 e N2 aplicados pelo controlador: o numerador da fração usa o mesmo filtro de ≥ 3 votos do denominador; span com mais da metade de rodadas ilegíveis → `insuficiente`, `span_ilegivel` (C32a). Phil (r3) mantém o ACORDO e pede medir `rodadasLongas` e `rodadasEmQuarentena` por teste depois do deploy.

### Emenda de 18/10 (A5, conflito do dHash)

A S2 da A5 (acordo de Phil e Yannis) cria `apps/web/src/lib/youtube/thumb-hamming.ts`, sem sharp, com `hamming`, `DHASH_MAX_SAME`, `sameThumb(a, b)` e `thumbRepresentatives(keys)` (com âncora). O `thumb-fingerprint.ts` passa a reexportar desse arquivo. **Substitui o diff de reexportação do §4:** `teste-youtube/dhash.ts` reexporta de `thumb-hamming.ts`; `mesmaImagem` é invólucro de `sameThumb`, não alias (corrigido na emenda da rodada 4; fonte única do limiar e do `hamming` em `thumb-hamming.ts`); o agrupamento do §4.3 p.6 usa `thumbRepresentatives` se a semântica for a mesma (representante = primeiro visto, sem deriva por elos). A tarefa que toca o dHash espera a S2 chegar ao staging.

### Emenda de 18/10, rodada 4 (revisão do plano S0/S1/S3 por Yannis e Phil, e contestações da A5)

Pareceres: `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/review-plano-s013-yannis.md` e `review-plano-s013-phil.md`; A5 em `resposta-a5-contrato.md`. O texto errado foi corrigido no lugar; esta seção é o resumo.

1. **C7: 5 sinais.** Um por variante (`hq720`, `hqdefault`, `maxresdefault`, `mqdefault`, `sddefault`), todos às `2026-10-18T16:42:25Z`, ordenados por `(ms do em, variante por code point)` (§4.3 p.7, C7). Quem agrupa por instante é a S7, na exibição (§8). A regra não muda; o texto de C7 é que estava errado.
2. **`span_ilegivel` em `EstadoCampoTitulo`** (aditivo; a A5 foi avisada por mensagem). O C32 duplicado vira **C32a** (span ilegível) e **C32b** (reexportação).
3. **`mesmaImagem` é invólucro de `sameThumb`, não alias.** Assinaturas diferentes (`sameThumb(a: string|null, b): boolean` × `mesmaImagem(ImagemComparavel, ImagemComparavel, limiar?): ComparacaoImagem`). O invólucro guarda a classe `variante|largura×altura`, o hex minúsculo de 16 caracteres e o cinza do 404 (`400e716969691648`) antes de delegar. Fonte única do limiar e do `hamming` em `thumb-hamming.ts`. Corrigidos o §4.2, o §12 e a emenda anterior. Com `dhashMaxSame` diferente do padrão, o agrupamento da miniatura usa o laço guloso local sobre `mesmaImagem` (a `thumbRepresentatives` da S2 não recebe limiar).
4. **`estavel_curto` × `depois_ambiguo`** (§4.4 p.7), decisão do controlador, regra proposta por Yannis: depois dos ramos 1–6, `v = detectarTesteYoutube(leiturasDepois, opts)`; `provavel_teste` → `teste_visivel`; `insuficiente` ou `nada_visivel` com `um_valor_so` → `estavel_curto`; qualquer outro → `depois_ambiguo`.
5. **Fixture (Phil).** URL da watch sem linha em `dhash.tsv`: 8 URLs, 28 miniaturas em 7 leituras, `http`/`dhash` nulos, 332 com dHash, proibido casar por prefixo; sondas = 17 voltas, `[30 x 16, 2]`; `dhash.tsv` com 35 linhas; commit dos 6 arquivos por nome, com teste da lista da pasta (§2.1, §2.2).
6. **Contestações da A5, aceitas pelo controlador** (`resposta-a5-contrato.md`):
   - Itens 1, 3 e 4 como a A5 aceitou: item 1 com refine `normalizarTitulo(s) !== ''` no Zod e CHECK no banco contra `''` e dHash fora do formato; item 3 com a coluna `titulo_oficial_fonte` (qual dos dois, `videoDetails.title` ou `og:title`); item 4 com o filtro das miniaturas pelo id do vídeo (a página tem 62 URLs `sqp` de 21 vídeos e estoura `max(60)`) e o campo de `sqp` no tipo.
   - Item 2: **idioma = HL/GL servido, não o pedido** (medido: pedido `pt-BR`, servido `pt`; título traduzido viraria "teste" falso). Toda tentativa grava linha, inclusive falha. A S4 decodifica a dimensão; dHash herdado por ETag nunca vai como "lido".
   - **Pedido 5 trocado:** a S4 roda a regra e grava `coleta_ate` sem depender da S7 (que não existe); o teste nosso entra na coleta na criação.
   - **Pedido 6 trocado:** hora-base espalhada por vídeo, mais ±20 min sorteados por rodada, no lugar do jitter de ±20 min em torno do múltiplo de 6 h (junta tudo em 3 invocações: 145 x 0,8 s = 116 s; x 3 canais = 348 s > 300 s). Fica a nota do limite do alternador em fase (§10).
   - **Pedido 7 trocado:** gravação normalizada de ~290 B por leitura (~0,5 MB/dia, ~23 MB em regime) em vez do cru de ~2,2–2,4 KB (1.740 leituras/dia = ~4 MB/dia, esgotaria a folga do banco grátis em ~75 dias, ~1º/jan/2027); o ETag entra na chave da miniatura (conjunto distinto por vídeo com upsert e expansor puro; "só quando muda" sem ETag na chave mata o sinal fraco por recompressão); retenção de 30 dias após sair da coleta, salvo registro da S7. A conta final é da S4.
   - Portão P-V com data: rodar do Vercel no qIg9 enquanto o teste está no ar (19/10), critério >= 4 de 10 rodadas mistas, medindo também 3 leituras a segundos de distância; teste já encerrado = inconclusivo, não "passou".

### Registro de revisões

- r5 (18/10): emenda do fechamento do lote S0/S1/S3, assinada pela A5 (Phil e Yannis)
