# Spec S4 (A5): T&C-coleta, leitura anônima da página watch

- **Data:** 18/10/2026, ~19:00 UTC. **Estado:** r3 aplicada (conserto de Sonnet sobre `revisao-spec-s4-phil-r3.md` e `revisao-spec-s4-yannis-r3.md`, depois da r1 e da r2; ver "Registro da r1", "da r2" e "da r3" no fim), para Phil e Yannis assinarem a r4 (releitura só dos itens R1–R5 e N9–N11). P1–P3 medidas (`.superpowers/sdd/a5/tc/medicoes-p1-p3.md`). Sem commit (o controlador commita).
- **Frente:** A5 (Observatório). Fatia S4 do plano conjunto (`.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md` §1). A S5 (tela) só esboçada no §14.
- **Contrato congelado (não se mexe aqui):** `LeituraWatch`, `leituraWatchSchema`, `validarLeituras`, `RENDERERS_TITULO`, `detectarTesteYoutube` em `apps/web/src/lib/youtube/teste-youtube/` (spec do A/B `docs/superpowers/specs/2026-10-18-teste-youtube-deteccao-design.md` §3, §8, §12; assinaturas da A5: Yannis r2 assina, Phil r2 assina com a frase do CHECK, que entrou em `94755c6b9`).
- **Fontes:** plano conjunto §1, §1.1, §1.2, §8–§10; `resposta-a5-contrato.md`; `.superpowers/sdd/a5/tc/contrato-phil.md`, `contrato-yannis.md`, `assinatura-*.md`; código em `origin/staging` (`fe32b8976`, que já traz a lib da S3 [V]): `lib/youtube/thumb-hamming.ts`, `thumb-fingerprint.ts`, `agenda/*`, `horaria/*`; sonda do dono em `~/portao-dhash/nativo-qIg9a7vqcNo/`.
- **Decisões do dono que valem aqui (não reabrir):** concorrentes ≤ 30 dias + próprios ≤ 14 dias + todo vídeo em teste nosso; leitura no Vercel se o P-V passar, senão na forja; tabela `yt_watch_readings` normalizada (~290 B/leitura), ETag na chave da miniatura, retenção de 30 dias, CHECK contra `''` e dHash fora de hex 16, nulo = não lido; exportar `lerWatchSemCookie(ytId)`; miniatura B nunca aparece anônima (detecção só por título; a miniatura é gravada como prova).
- **Libera:** Phil e Yannis revisarem este texto; depois do acordo, escrever o plano da S4. **Não libera:** código, migration, push, nada na forja, nada em produção. O P-V (§12) tem prazo próprio: a rota vai num push próprio que **espera o ok do dono** (§12).
- Legenda: **[V]** verificado (dado ou código citado); **[H]** hipótese.

---

## 1. Resumo

1. Uma tarefa nova da agenda (`leitura_watch`, peso leve) roda dentro do disparo que já existe (`sync-youtube?mode=competitors`, `*/20`, GET do cron do Vercel): **nenhuma rota nova, nenhum cron novo, nenhum pg_cron** (sem split-brain).
2. Cada vídeo na coleta tem **uma rodada a cada 6 h** (4 por dia), **3 leituras por rodada** na mesma invocação, a segundos uma da outra, e uma sonda de miniatura por rodada. Hora-base por vídeo em faixas equilibradas, mais ±20 min sorteados por rodada.
3. Volume com V ≈ 145 vídeos: 1.740 leituras/dia, ~0,43 MB/dia no banco, ~19 MB em regime (sem título oficial no Vercel, r5); ~540 MB/dia de HTML baixado; ~15 s de função por disparo.
4. Toda tentativa grava linha, inclusive a que falhou (`erro`). Página de consentimento, verificação de robô, 429, vídeo removido e layout novo do YouTube viram **"não lido"** com contagem visível, nunca "sem teste".
5. O P-V (Vercel enxerga a divisão do teste?) tem de rodar **antes de 21/10 ~12:22 UTC** (a sonda de controle do Mac acaba ~13:21; o teste do qIg9 acaba ~17:45), com a rota **no ar até 20/10 09:00 UTC** por push próprio (que espera o ok do dono, §12). Falhou ou inconclusivo: a leitura vai para a forja (§13).

---

## 2. Escopo

**Entra:**
- `lerWatchSemCookie` (leitor puro, exportado) + parser puro + sonda de miniatura.
- Tarefa `leitura_watch` (seleção de alvos, rodadas, gravação, extensão da coleta).
- Tarefa `poda_leituras_watch` (retenção de 30 dias + prova diária de saúde).
- Migration: `yt_watch_alvos`, `yt_watch_thumbs`, `yt_watch_readings`, função de gravação, função de prova, função de poda, RLS.
- Expansor puro banco → `LeituraWatch[]` (`leiturasDoBanco`), que a S5, a S6 e a S7 usam.
- Rota temporária do P-V (§12), removida no lote da S4.

**Fora de escopo (explícito):**
- A regra de detecção (S3, do A/B) e qualquer mudança no contrato.
- Detectar miniatura em teste (linha "sai" do plano; o B nunca aparece anônimo, §10 do plano).
- Página `results` (F10 do spec do A/B: B em 38/60): exige termo de busca por vídeo; fica para depois.
- Leitura logada, home, recomendação.
- Tela (S5; só esboço no §14), registro do nativo (S7), guarda (S6).
- HTML cru no banco (nunca; fixture recortada fica em `test/fixtures`).
- Arquivo mensal / export (`obs_archive_registry`): a tabela é crua e de vida curta, não entra no arquivo (D5, §18).
- Acesso de IA (lista da E17): entra quando a S5 precisar (D6, §18).

---

## 3. Fatos que sustentam o desenho

| # | Fato | Prova | Uso aqui |
|---|---|---|---|
| T1 | **Leituras a 1–2 s uma da outra, do mesmo IP, já misturam A e B.** Na sonda do Mac, as 3 leituras da watch de cada rodada saem a ~1–2 s (ex.: 18:21:09 B, 18:21:10 A, 18:21:12 B); 13 de 20 rodadas mistas. O "~2 min" do spec do A/B é o intervalo **entre** rodadas. | `titulos.tsv` (`teste` 16:42–17:43 e `hora` 18:21 UTC) [V, Mac] | Responde a A4 do Yannis para o Mac: o sorteio é por requisição. Falta só o Vercel (P-V). |
| T2 | Watch do qIg9 com `hl=pt-BR&gl=BR`: 200, 310 KB comprimido, 1,3 MB descomprimido, 0,7–0,85 s; parse de `ytInitialData` + `ytInitialPlayerResponse` 3,3 ms no Mac. Idioma servido `HL=pt`, `GL=BR`. | `contrato-phil.md` (medições de 18/10) [V, Mac] | Conta de tempo e de rede (§11). `idioma = 'pt-BR'` montado do servido. |
| T3 | A página lista 62 URLs `sqp` de 21 vídeos; do próprio vídeo: 4 `sqp`, `maxresdefault`, `hqdefault`. | idem [V] | Filtro pelo id (contrato §3). |
| T4 | Miniatura sempre A de fora (29 imagens distintas, todas a ≤ 0,6 de A). | plano conjunto §10 [V] | Uma sonda por rodada basta (prova, não detecção). |
| T5 | A agenda roda tarefas `sempre` → `leve` → uma `pesada` em série no disparo `*/20` (72 por dia); leve começa até 75 s e termina até 90 s de `t0`; função 300 s. | `agenda/despachante.ts:270`, `agenda/relogio.ts` [V] | Onde a tarefa mora (§4). |
| T6 | `lerCandidatos` (horária) já lista concorrentes e próprios por janela, mas com `RULES.hourly.ageDays = 14` fixo. | `horaria/gravar.ts:140`, `observatorio/rules.ts:52` [V] | Reuso com a janela como parâmetro. |
| T7 | `probeThumb` não decodifica dimensão e herda dHash pelo ETag. | `thumb-fingerprint.ts` [V] | A S4 tem sonda própria, sempre com GET (§5.4). |
| T9 | **C0 feita (18/10 18:50 UTC):** 6 páginas reais, 2 só A e 4 só B; **os 3 renderers concordam dentro de cada página** (o "A=9 B=3" do `grep -c` conta o HTML inteiro, não renderers); `videoDetails.title` e `og:title` trazem sempre A; `HL=pt`, `GL=BR`, `playabilityStatus=OK`. Há fixture B **real** (sem fixture sintética). As páginas trazem `VISITOR_DATA`/`visitorData`, **`"remoteHost"` com o IP de casa do dono (IPv6; conferido pelo controlador nas 6)** e `videoDetails.viewCount`. | `~/portao-dhash/nativo-qIg9a7vqcNo/html/` (parse de Phil e Yannis) [V] | Fixtures A1; `titulos_divergentes` será raro; T1 reconfirmado (sorteio por requisição sem cookie). |
| T8 | Sonda horária do Mac viva: `sondar-paginas.sh hora 68 3600` desde 18/10 18:21 UTC; 68 rodadas = até ~21/10 13:21 UTC. | `ps` às 18:42 UTC [V] | Controle do P-V (§12) e prazo. |
| H1 | O Vercel cai em braço fixo, recebe verificação de robô ou consentimento. | não medido [H] | É o P-V. |
| H2 | O Vercel não cobra a entrada de `fetch` feita pela função. | não conferido [H] | Conferência D+1 na página de uso (§16, C8). |

---

## 4. Onde roda

- **Tarefa `leitura_watch`** no catálogo da agenda (`agenda/definicoes.ts` + `agenda/tarefas/leitura-watch.ts`), `peso: 'leve'`, `periodo: 'hora'`, `devidaPeloDado: () => true` (a tarefa decide pelo banco quem está devido), `ligaCom: 'OBS_WATCH_READ'` (só `on` liga; deploy desligado, liga depois da migration e do P-V; **liga longe das 05:00 SP**, M3), `comecaAteMs: LEVE_COMECA_ATE_MS`, `fimAteMs: 88_000` (guarda dura; o teto real é o do §6.3), `toleranciaVigiaH: 2`, `ordem: 5.9` (**depois** das leves diárias, `playlists_semanais` inclusa, e antes das pesadas), `naoTerminouVermelhoEm: 6` (2 h de `sobrou` seguidos = capacidade insuficiente, vermelho), **`tetoTentativas: 3`** (D3 resolvida pelos dois revisores: reabrir `ok` e retomar `parcial` com `done_n > 0` não gastam tentativa, `competitor_agenda_claim`, migration `20261013000001` linha 69 [V]; `parcial` com zero feito gasta, e é o sinal certo: vira `esgotada` + aviso).
  - **Sem alvo devido:** `ok` com `feitas = 0` **só se a conciliação leu `alvos_ativos > 0`** (há alvos, nenhum devido). `alvos_ativos = 0` com `candidatos_esperados > 0` (as 3 consultas da conciliação, §7) ⇒ `parcial`, motivo `sem_alvos` (C3 de Phil: coleta morta em verde).
  - `feitas` = só leituras **sem erro e com título lido**; leitura com erro ou sem título não conta como feita (§6.3, estados).
- **Tarefa `poda_leituras_watch`**: `peso: 'leve'`, `periodo: 'dia'`, `aPartirDaHoraSP: 5`, `toleranciaVigiaH: 36`, **sem `ligaCom`** (Yannis I9: desligar a coleta por variável, §17, não pode parar a poda e quebrar a promessa dos 30 dias; com zero linhas ela devolve `ok`; `42P01`, tabela ausente antes da migration, ⇒ `parcial`, motivo `schema_ausente`, como as outras), poda + prova (§10). **Ela lê `OBS_WATCH_READ` só para a prova** (r2, Yannis N3): coleta desligada ⇒ a prova devolve os motivos de coleta sem cor e não há aviso (§10.2). Teste: `delete process.env.OBS_WATCH_READ` ⇒ `leitura_watch` em `desligadas`, `poda_leituras_watch` não, e a poda com alvos atrasados e tabela vazia devolve `ok` sem `leitura_watch_vermelha`.
- Por que na agenda e não numa rota própria: herda arrendamento, vigia (`saude.ts`), `/api/health`, relato ao Sentry sem texto de fora e o interruptor por variável; o cron `*/20` é GET do Vercel (o split-brain GET/POST não se aplica). Custo: disputa o tempo do disparo com a horária (até 60 s) e com a pesada; a tarefa tem orçamento próprio (§6.3).
- **Módulos novos** (A5), em `apps/web/src/lib/youtube/watch/`:

| Arquivo | Conteúdo | Puro? |
|---|---|---|
| `parser.ts` | `extrairDaWatch(html, ytId)`: títulos por renderer, oficial + fonte, idioma servido, `rendicoesSqp`, sinais de erro (consentimento, robô, indisponível), `jogadorBloqueado`; exporta a constante `VERSAO_LEITOR` | sim (sem rede, sem sharp) |
| `leitor.ts` | `lerWatchSemCookie(ytId, opts)`, devolve o envelope `ResultadoLeitor` (§5.1) | rede injetada |
| `miniatura.ts` | `sondarMiniatura(ytId, f)`: GET da `hqdefault` canônica, dHash (`dhashOf`), dimensão (`sharp().metadata()`), ETag, sha16, cinza do 404 → nulo | sharp |
| `rodada.ts` | `proximaRodada`, `faixaMenosCheia`, `planejarDisparo` | sim |
| `expansor.ts` | `paraLinhas(ResultadoLeitor)` (grava `http` e `jogador_bloqueado` do envelope e `versao_leitor` de `VERSAO_LEITOR`; canoniza e valida contra o espelho do banco, §8.1), `leiturasDoBanco(linhas, thumbs)` (devolve só `LeituraWatch`: os campos extras ficam no banco, fora do contrato), `linhaCabeNoBanco` | sim |
| `puro.ts` | reexporta **só** `extrairDaWatch`, `leiturasDoBanco`, `paraLinhas` | sim |

**Sem barril misto** (Yannis I8): `leitor.ts` e `miniatura.ts` puxam `sharp` e `@vercel/blob` (via `dhashOf` de `thumb-fingerprint.ts`), então `watch/puro.ts` é a única porta para a S5/S6 e o servidor importa `watch/leitor.ts` direto. Teste de grafo de módulos (como o C20 do A/B): importar `watch/puro.ts` não carrega `sharp`, `@vercel/blob` nem `@supabase/*` (`vi.mock` que lança ao ser carregado). `IMAGEM_PADRAO_YT` vem de `lib/youtube/teste-youtube/imagem.ts` (não duplicar a constante).

---

## 5. Leitor puro

### 5.1 Assinatura

```ts
export interface OpcoesLeitor {
  rodadaId: string                       // uuid gerado pela coleta, um por rodada
  origemRede: 'vercel' | 'forja' | 'mac-casa'
  fetchImpl?: typeof fetch               // padrão: fetch global
  agora?: () => number                   // padrão: Date.now; lidaEm = instante da RESPOSTA
  timeoutMs?: number                     // padrão 10_000
  sondarMiniatura?: boolean              // padrão false; a coleta passa true na 1ª passada de cada vídeo e, se essa leitura terminar com erro, na 2ª, e na 3ª; o leitor só sonda se a PRÓPRIA leitura terminou com erro = null (§5.4)
}

/** Envelope (r2, Yannis N1): `LeituraWatch` e `leituraWatchSchema` não têm `http` da leitura, `jogadorBloqueado` nem versão do leitor, e o schema não é `strict` (o `safeParse` descarta campo extra). Por isso o leitor devolve a leitura do contrato MAIS os campos de coluna, lado a lado. */
export interface ResultadoLeitor {
  leitura: LeituraWatch                  // passou por leituraWatchSchema.safeParse
  http: number | null                    // status da resposta da watch (null em timeout/rede)
  jogadorBloqueado: boolean              // §5.3; só com leitura.erro === null
}

/** Uma tentativa = um ResultadoLeitor. Nunca lança por falha de página/transporte: vira `leitura.erro` com os campos de dado nulos ou vazios. */
export async function lerWatchSemCookie(ytId: string, opts: OpcoesLeitor): Promise<ResultadoLeitor>
```

- A `leitura` do envelope passa por `leituraWatchSchema.safeParse` antes de sair. Se o schema recusar (defeito do parser), devolve `erro: 'parser'` com os campos zerados; nunca devolve uma leitura que o contrato recusa. `paraLinhas` recebe o envelope: `http` e `jogador_bloqueado` vêm dele, `versao_leitor` da constante `VERSAO_LEITOR` exportada pelo parser; `leiturasDoBanco` devolve só `LeituraWatch`. É a mesma validação que o A/B faz na leitura do banco: o desencontro aparece na S4, não na regra.
- **Erro de opção** (id inválido, `rodadaId` que não é uuid, `origemRede` fora do catálogo) **não é gravado como `erro` da leitura**: é defeito de quem chama, lança `TypeError` antes de qualquer rede (emenda r5 do spec da detecção, que a A5 assinou). Só falha de página/transporte vira `erro`.
- **Quem chama `detectarTesteYoutube`** (a tarefa na extensão, §7, e a S5/S6) faz **`try/catch` por vídeo** e **agrupa as leituras por vídeo antes**: uma exceção de um vídeo não derruba os outros nem o disparo (vira motivo `extensao_falhou` no relato, contado, e o alvo não sai nesse disparo). `escritasConhecidas[].em` vem **só de `toISOString()` ou de uma coluna `timestamptz`** (nunca string montada à mão), que é o formato que o Zod da lib aceita (emenda r5).
- A S6 do A/B pode chamar a função direto (S6 lê o gravado no `settleOnAir`; chamada ao vivo só fora do teto de 55 s, decisão da S6).

### 5.2 Requisição

- `GET https://www.youtube.com/watch?v=<id>&hl=pt-BR&gl=BR`, sem cookie (nenhum `Cookie` enviado; os `Set-Cookie` da resposta são descartados), `Accept-Language: pt-BR`, User-Agent fixo de navegador de mesa (constante única em `leitor.ts`), `redirect: 'manual'` para ver o desvio a `consent.youtube.com`, compressão padrão do `fetch` (gzip/br).
- Sem nova tentativa dentro da rodada: repetir enviesa a proporção (a 2ª tentativa só existe quando a 1ª falhou).
- `fetch` com `cache: 'no-store'`; o `AbortSignal.timeout` cobre também a leitura do corpo (`res.text()`), não só os cabeçalhos.
- **Parser sobre texto de terceiros** (Yannis M5): extração de `ytInitialData`, `ytInitialPlayerResponse` e `ytcfg` por `indexOf` do marcador + `JSON.parse` do trecho até `;</script>` (ou varredura de chaves), **sem regex com `.*?` sobre 1,3 MB**.

### 5.3 Parser (`extrairDaWatch`)

| Campo do contrato | De onde | Ausente |
|---|---|---|
| `titulosExibidos` | os 3 de `RENDERERS_TITULO`: `videoPrimaryInfoRenderer.title.runs[].text` concatenado; `playerOverlayVideoDetailsRenderer.title.simpleText`; `videoTitleHeaderViewModel.videoTitle.content`. Entidades HTML decodificadas, sem normalizar. | renderer ausente ou texto que `normalizarTitulo` reduz a `''` → `texto: null` |
| `tituloOficial` + `titulo_oficial_fonte` | `ytInitialPlayerResponse.videoDetails.title` → `'videoDetails'`; senão `og:title` → `'og_title'`; **nunca `<title>`**. **Emenda r5 (P-V de 18/10):** no Vercel (iad1) o player vem bloqueado e a página não traz `videoDetails` nem `og:title` (0/156 leituras); o parser grava os dois nulos e **a Data API nunca preenche este campo** (nem com `fonte = 'videoDetails'`: seria gravar uma mentira; o enum do contrato está congelado) | os dois nulos; **com `jogadorBloqueado` é o esperado no Vercel (§12)** |
| `idioma` | `ytcfg.set({... "HL":"pt", "GL":"BR" ...})` → `'pt-BR'`. **Sem concatenação cega:** `HL` que já traz região (`/-/`, ex.: `es-419`, `pt-PT`) fica como está; senão `${HL}-${GL}`; só `HL` → `'pt'`. Normalizado para o formato do banco (`^[a-z]{2,3}(-([A-Z]{2}\|[0-9]{3}))?$`) antes de sair; o que não couber vira `null` (Yannis C1) | nulo; com título lido vira `erro: 'sem_idioma'` (a linha conta como falha, não some como inválida) |
| `rendicoesSqp` | URLs `ytimg.com/vi/<ytId>/…?sqp=` distintas (só deste id) | `null` se o HTML não foi lido |
| `miniaturas` | só a sonda (§5.4) na 1ª leitura da rodada **que terminou com `erro = null`**; nas outras `[]`. URLs listadas na página não entram (só a contagem de `sqp`). | `[]` |
| `jogadorBloqueado` (campo do envelope `ResultadoLeitor` e coluna da tabela, **fora do contrato**) | `playabilityStatus.status === 'LOGIN_REQUIRED'` **e** renderers presentes ≥ 1, igual ao `contar.ts` do P-V (`renderers > 0 && loginRequired`). O **motivo** (robô ou outro texto) não decide o campo (r5, Phil A2: o P-V não mediu o motivo); se o plano quiser guardá-lo, vai só no relato, nunca como condição. Teste: o `contar.ts` e o `extrairDaWatch` dão o mesmo booleano sobre a mesma fixture (Yannis C2) | `false` |

**Catálogo de `erro`** (fechado, `/^[a-z0-9_]{1,40}$/`):

| Código | Detecção |
|---|---|
| `http_429` | status 429 |
| `http_4xx` / `http_5xx` | outro status de erro |
| `consentimento` | 3xx para `consent.youtube.com`, ou formulário de consentimento no corpo |
| `redirecionado` | qualquer outro 3xx (ex.: `/shorts/<id>`, página de idade), `http` gravado (Phil I6) |
| `verificacao_robo` | **só quando não há título legível**: renderers ausentes e corpo com o texto "confirm you're not a bot" / "confirme que você não é um robô" (ou `LOGIN_REQUIRED` de robô sem título). Com título legível e player bloqueado: `erro: null`, títulos gravados, `jogador_bloqueado = true` (Yannis I2: o portão de robô de IP de nuvem costuma ser só do player) |
| `indisponivel` | `playabilityStatus.status` em `ERROR` / `UNPLAYABLE` sem título (removido, privado) |
| `sem_initial_data` | 200 sem `ytInitialData` legível |
| `sem_idioma` | título lido, `ytcfg` HL ilegível |
| `timeout` / `rede` | `AbortSignal.timeout` / exceção de transporte |
| `parser` | exceção no parser ou saída recusada pelo schema |
| `fora_do_formato` | só vem de `paraLinhas` (§8.1): leitura válida no Zod que o espelho do banco não aceita; linha de erro canônica que sempre cabe |

O erro de um **lote** (transação) não é erro de leitura; ver `gravacao_falhou` (§6.4).

Layout novo (os 3 renderers somem, `ytInitialData` presente): **não é erro**, é leitura com `erro: null`, títulos `null`. A regra devolve `titulo_nao_lido`; a coleta conta `sem_titulo` e acende o vigia (§10.2). Separar os dois casos é o que permite dizer "o YouTube mudou a página" em vez de "falhou".

### 5.4 Sonda de miniatura (uma por rodada)

- `GET https://i.ytimg.com/vi/<id>/hqdefault.jpg` (canônica, sem query), **sempre com GET** (~11 KB; 580/dia = ~6 MB/dia): sem HEAD+herança, o dHash gravado é sempre medido (resolve o "herdado" de Phil e Yannis sem estado).
- **Quando:** na **primeira leitura da rodada que terminar com `erro = null`**. A opção é decidida antes da chamada, quando o resultado ainda não existe (r2, Yannis N6): a coleta passa `sondarMiniatura: true` na 1ª passada de cada vídeo e, se essa leitura terminar com erro, na 2ª, e na 3ª; o leitor só sonda se a **própria** leitura terminou com `erro = null` (A3). Se nenhuma das 3 ler, a rodada fica sem miniatura (`[]`). Motivo (Phil I1): o contrato recusa `erro ≠ null` com miniatura medida, e a sonda numa leitura 429 trocaria o código por `parser` (1 de cada 3 leituras em bloqueio apareceria como defeito do parser, e o disjuntor enxergaria 2/3).
- `http ≠ 200` ou dHash = `IMAGEM_PADRAO_YT` (`400e716969691648`, de `lib/youtube/teste-youtube/imagem.ts`) → `dhash`, `largura`, `altura` nulos; `etag` e `http` gravados.
- Nunca guarda a imagem no Blob: a prova é dHash + ETag + sha16; o arquivo da imagem dos concorrentes já é feito pela coleta deles (`archiveThumb`).

---

## 6. A rodada

### 6.1 N, espaçamento, horário

| Parâmetro | Valor | Por quê |
|---|---|---|
| Leituras por rodada (N) | **3** | O spec do A/B mede mistura dentro da rodada com 3 (13/20 no Mac); `minLeituras = 9` da regra dá "provável" na 3ª rodada (~12 h). |
| Rodadas por vídeo | **4/dia**, uma a cada 6 h | Pedido 6 do contrato; com 4, o desfecho junta 18 votos estáveis em ~1,5 dia. |
| Espaçamento entre as 3 | **passadas intercaladas** na mesma invocação: lê todos os vídeos do disparo, depois de novo, depois de novo; com 8–16 vídeos e concorrência 3, ~2–5 s entre as leituras do mesmo vídeo | T1: 1–2 s já misturam no Mac. Rodada dura < 30 s, muito abaixo de `maxDuracaoRodadaMs` (10 min). |
| Hora-base | cada alvo recebe, ao entrar, a **faixa de 20 min menos cheia** das 18 de um período de 6 h (`faixaMenosCheia`), mais um deslocamento por hash dentro da faixa | Pedido 6; hash puro (`mod 360`) deixa faixas com 1,7× a média com V = 145; a faixa menos cheia garante equilíbrio. |
| Sorteio por rodada | ±20 min uniforme, independente por rodada (`rng` injetado) | Quebra a fase com alternador de período divisor de 6 h (E3 do spec do A/B). |
| Próxima rodada | `proximaRodada(agora, horaBase, rng)`: o primeiro instante `horaBase + k·6 h` maior que `agora + 3 h`, mais o sorteio | Nunca duas rodadas a menos de **2h40** (`agora + 3 h` menos o pior sorteio de 20 min; um número só, A5 e o teste afirmam este). |

### 6.2 Conta do disparo

**Unidades (r2, Phil N1 e Yannis N4: a r1 misturou "por leitura" e "por vídeo" e o teto de 30 s derrubou a capacidade).** O custo é **por vídeo**, e já contém as 3 leituras em concorrência 3, a sonda e o parse: `SEGUNDOS_POR_VIDEO = 1,2` (medido 0,8 s de leitura [3 × 0,8 s ÷ 3] + ~0,06 s de miniatura + ~0,05 s de parse = ~0,9 s por vídeo no Mac, com ~33 % de margem para o Vercel, a remedir no P-V) e `SEGUNDOS_FIXOS = 3` (conciliação, gravação em 1 chamada, extensão), pagos uma vez por disparo. Constantes do catálogo, atualizadas no plano com o p90 medido.

- Demanda: rodadas/dia = V × 4 = 145 × 4 = **580**; disparos/dia = 72 → **8,1 vídeos por disparo** em média (24 leituras).
- Teto por disparo **K = 16 vídeos** (48 leituras + 16 GET de miniatura): 2× de folga sobre a média. Tempo do disparo cheio: 16 × 0,9 + 3 ≈ **17,4 s medido, 22,2 s com a margem** (16 × 1,2 + 3). Capacidade nominal 72 × 16 = 1.152 rodadas/dia.
- **A capacidade real depende de quando a leve começa** (Phil I4, Yannis I5): as leves rodam em série depois da `leitura_horaria` (`fimAteMs` 60 s). Fórmula única do §6.3: `K_agora = min(16, devidos, ⌊(min(70 − decorrido, 30) − 3) / 1,2⌋)`. Tabela (teste de unidade de `planejarDisparo` com estes `decorrido`):

| Leve começa em (s) | Orçamento `min(70 − d, 30)` (s) | K_agora | Capacidade/dia (72 × K) | ÷ 580 |
|---|---|---|---|---|
| 20 | 30 | 16 | 1.152 | 1,99 |
| 45 | 25 (⌊22/1,2⌋ = 18, corta em 16) | 16 | 1.152 | 1,99 |
| 50 | 20 | 14 | 1.008 | 1,74 |
| 55 | 15 | 10 | 720 | 1,24 |
| 60 | 10 | 5 | 360 | 0,62 (insuficiente) |
| 70 | 0 | 0 | 0 | não começa |

- **Aceite da capacidade (fecha com folga, sem "medir depois"):** capacidade ≥ 1,5 × 580 = 870 exige K ≥ 13 (72 × 12 = 864 ainda fica abaixo), isto é, a leve começar até **~51 s** (K = 13 em 51 s, 936/dia). A horária termina em 60 s no pior caso por desenho, mas o p90 medido em produção é que vale: **p90 do início da leve ≤ 50 s** (folga para K = 14, 1.008/dia). Se a P1 mostrar p90 acima de 50 s, o desenho muda de uma de duas formas, escolhida no plano com a conta: (a) **concorrência 4** (`SEGUNDOS_POR_VIDEO` cai para ~0,9 s, K = 16 até o início em ~52 s, 12 até ~56 s; r3, Yannis N11: a conta é `⌊(70 − d − 3) / 0,9⌋`, e o teste é o de tabela de `K_agora` com o parâmetro 0,9) ou (b) **menos rodadas para os concorrentes de 14 a 30 d** (2 por dia em vez de 4; muda o pedido 6 do contrato, então só com acordo de Phil; a demanda cai na proporção dos alvos nessa faixa, medida no plano). Testes: tabela de `K_agora` em `decorrido` ∈ {5, 20, 45, 50, 55, 60, 65, 70} e um teste de que `72 × K(início p90 medido) ≥ 1,5 × 580`, com o p90 como constante do catálogo.
- **P1 medida (18/10 ~20:00 UTC, controlador; `.superpowers/sdd/a5/tc/medicoes-p1-p3.md`): PASSA.** `leitura_horaria`, 7 d, n = 117: p50 2,6 s, p90 **3,2 s**, p99 4,4 s, máx 5,2 s; as leves diárias ficam ≤ 1,6 s no p90; o início da leve (horária + leves diárias antes da `ordem 5.9`) fica abaixo de ~10 s, muito longe do limite de 50 s. Logo K = 16 e a capacidade é 72 × 16 = 1.152/dia (≈ 2 × 580). `sincronizar_canais` (pesada) tem p90 148,8 s, fora da leve. **Fica para o plano:** o atraso de partida do disparo até a primeira tarefa (o plano mede `started_at` da primeira tarefa contra a hora do cron). Consulta usada (para repetir):
- Consulta da P1 (feita; o plano repete se mudar a agenda) (leitura de produção só select; se o modo automático negar, o dono roda): `select percentile_disc(array[0.5,0.9,0.99]) within group (order by extract(epoch from finished_at - started_at)) from competitor_agenda_runs where task = 'leitura_horaria' and started_at > now() - interval '7 days';` (colunas `started_at`/`finished_at` ou `duration_ms`: o plano confere o nome; o início da leve é o fim da horária mais o das leves diárias que rodaram antes, pela `ordem 5.9`), e o mesmo para as leves das 03–07 SP e para `sincronizar_canais` (`left_n`, `status = 'parcial'`: folga da pesada). O P-V fase 2 (§12) registra o **tempo de parede da rajada de 16 vídeos** e valida os 1,2 s: aceite ≤ 16 × 1,2 + 3 = 22,2 s.
- Com 3× canais (V ≈ 435): 1.740 rodadas/dia → ~24 por disparo, acima de K. **Gatilho de replanejar:** `alvos_atrasados > 0` em 2 provas seguidas (§10.2) ou V > 300.

### 6.3 Orçamento dentro do disparo

- A tarefa começa só se `decorrido ≤ 70 s` (mais estreito que os 75 s das leves, para não tirar tempo de `retratos_comentarios`, `comecaAteMs` 130 s) **e dura no máximo 30 s de parede própria**. `K_agora = min(16, devidos, ⌊(min(70 s − decorrido, 30 s) − 3 s) / 1,2 s⌋)` (custo por vídeo e fixo do §6.2; tabela lá); vídeo que não coube fica devido (`proxima_rodada_em` intacto) e vai para o disparo seguinte (`parcial`, motivo `sobrou`).
- Nenhuma ida ao banco começa depois de 83 s; `fimAteMs` 88 s fica como guarda dura (dentro do teto de 90 s das leves).
- **Acoplamento declarado:** pior caso horária 60 s + watch 30 s = 90 s, ainda < `COMMENT_RULES.startsByMs`. Teste de catálogo: `fimAteMs ≤ LEVE_FIM_MS`; teste de orçamento que soma `HORARIA_FIM_MS` + 30 s + margem e afirma `< COMMENT_RULES.startsByMs`. Mexer num número exige refazer a conta dos outros.
- **Disjuntor:** 3 respostas de **bloqueio** no mesmo disparo (`http_429`, `verificacao_robo` **ou `consentimento`**) param as leituras novas (as já feitas são gravadas); motivo `bloqueado`. O próximo disparo (20 min) tenta de novo: no máximo 9 leituras bloqueadas por hora, nenhuma rajada. **Rodada partida** (M7): vídeo com 1 ou 2 leituras quando o disjuntor dispara grava as leituras (mesmo `rodadaId`; rodada com < 3 votos, que a regra já exclui da fração) e **continua devido** (`proxima_rodada_em` intacto, `rodadas` não sobe). Teste: disjuntor na 2ª passada ⇒ alvos com 1 leitura continuam devidos.
- **Estado de cada motivo** (tabela fechada; `detalhe` leva só números: `lidas`, `com_erro`, `sem_titulo`, `jogador_bloqueado`). Onde Phil pedia `parcial` e Yannis `erro`, vale o mais estrito (`erro`: com 3 disparos na hora vira `esgotada` = problema vermelho dentro da hora, e sem `ok` o `last_ok_at` envelhece e o vigia fica `late` em 2 h):

| Motivo | Quando, no disparo | Estado |
|---|---|---|
| `bloqueado` | disjuntor disparou | `erro` |
| `leitura_bloqueada` | ≥ 6 tentativas **de ≥ 3 vídeos distintos** e (leituras com `erro` **exceto `indisponivel`**) / (tentativas **exceto `indisponivel`**) > 0,5, só com códigos que não são bloqueio (`sem_initial_data`, `http_5xx`, `http_4xx`, `redirecionado`, `fora_do_formato`, `timeout`, `rede`); vídeo removido ou privado é propriedade do vídeo, não bloqueio (r2, Phil N5 e Yannis N8). Os códigos de bloqueio (`consentimento`, `verificacao_robo`, `http_429`) já param no disjuntor em 3 tentativas e viram `bloqueado` | `erro` |
| `layout_mudou` | ≥ 6 leituras sem erro e > 50 % delas sem título | `erro` |
| `gravacao_falhou` | a gravação (e o degrau de recuperação, §6.4) falhou | `erro` |
| `sem_alvos` | `alvos_ativos = 0` com `candidatos_esperados > 0` | `parcial` (estado único em todo o texto; o vigia o enxerga porque `parcial` não renova `last_ok_at`, §10.2) |
| `sobrou` | vídeo devido que não coube | `parcial` |
| `extensao_falhou` | exceção da S3 em algum vídeo (contada) | `parcial` |
| resto | | `ok` |

### 6.4 Gravação

Uma chamada por disparo, `yt_watch_gravar_disparo(p jsonb)` (transação única): upsert das miniaturas distintas (devolve ids), insert das leituras, update dos alvos (`proxima_rodada_em`, `ultima_rodada_em`, `rodadas`, `indisponivel_seguidas`).

**Uma linha nunca derruba o lote** (C1 de Phil e de Yannis, o mesmo defeito: os CHECKs do banco são mais estreitos que o Zod do contrato, uma linha recusada aborta a transação, o alvo envenenado continua devido com a `proxima_rodada_em` mais antiga e derruba o disparo seguinte, para sempre, sem `indisponivel_seguidas` subir). Três camadas:
1. **`paraLinhas` canoniza** antes de gravar: `erro ≠ null` ⇒ `titulo_oficial`, `titulo_oficial_fonte`, `titulo_exibido`, `titulos_divergentes` nulos e `renderers_presentes = 0`; títulos exibidos sempre 3 itens na ordem de `RENDERERS_TITULO` (a ida e volta não diverge entre `[]` e 3 nulos); idioma normalizado (§5.3).
2. **`linhaCabeNoBanco(linha)`** (função pura, em `expansor.ts`) espelha **cada** CHECK do §8.1, um a um (schemas Zod `linhaLeituraSchema` e `linhaThumbSchema` com os mesmos limites dos CHECKs). Linha que não cabe vira linha de `erro = 'fora_do_formato'` canônica (que sempre cabe), nunca some, e conta no relato do disparo. (Phil propunha `parser`; vale `fora_do_formato`, que distingue defeito de formato de defeito de parser.)
3. **Degrau de recuperação:** se a chamada única ainda assim falhar **com SQLSTATE de classe 23 (violação de restrição)**, e só enquanto houver orçamento (nenhuma ida ao banco depois de 83 s), a tarefa regrava **vídeo a vídeo** (1 chamada por vídeo só nesse caso); o vídeo cujo lote falhar de novo ganha `proxima_rodada_em += 20 min` (segunda chamada mínima, só update de alvos), para não encabeçar o disparo seguinte; motivo `gravacao_falhou`. **Erro de transporte ou banco fora do ar** (timeout, conexão, classe 08/53/57) **não tem degrau**: vai direto a `gravacao_falhou` sem regravar (16 gravações e 16 updates falhando por timeout estourariam o teto de 83 s; r2, Yannis N7). Teste: cliente falso que lança timeout ⇒ uma única chamada, sem degrau.

---

## 7. Quem é lido (`yt_watch_alvos`)

| Origem | Entra | `coleta_ate` |
|---|---|---|
| Concorrente | `competitor_videos` com `published_at` ≤ 30 dias, canal não pausado nem ausente (mesmos filtros de `horaria/lista.ts`) | `published_at + 30 d` |
| Próprio | `youtube_videos` com `published_at` ≤ 14 dias, público | `published_at + 14 d` |
| Próprio antigo | **decisão do dono (D2, aberta; não decidida aqui)**: todos os próprios públicos a 1 rodada/dia. Recomendação de Phil: incluir (é o caso que originou a frente) | a definir em D2 |
| Teste nosso | `ab_tests.status not in ('completed','archived')` (cobre `draft`, `queued`, `active`, `paused` e fica certo se surgir status novo de teste em aberto), **desde a criação**; `draft` só entra se `created_at` ou `updated_at` ≤ 30 d (rascunho esquecido custaria 12 leituras/dia para sempre; P3 medida em 18/10: `active` 1, `archived` 1, `completed` 1; **nenhum `draft` nem `queued` hoje**, então o custo do rascunho esquecido é zero por ora; a regra fica). **`ab_tests.youtube_video_id` é o uuid de `youtube_videos.id`, não o id de 11 caracteres**: a consulta é `ab_tests t join youtube_videos v on v.id = t.youtube_video_id`, lendo `v.youtube_video_id` e `v.site_id` (copiar o uuid viola o CHECK de 11 caracteres e, em transação única, nenhum alvo novo entra) | `now() + 1 d`, renovado a cada conciliação enquanto o teste existir |
| Extensão (pedido 5) | alvo cujo veredito é `provavel_teste` | `greatest(coleta_ate, ultimaVista + 30 d)` |
| Extensão curta | alvo a < 48 h do corte com `rodadasMistasTitulo ≥ 1` e veredito ainda não provável | `coleta_ate + 3 d`, no máximo 2 vezes |

- **Conciliação** (no começo de cada disparo, 3 consultas por índice, ~150 linhas; `Set` dos alvos, proibido `find` em laço): insere alvo novo (faixa menos cheia, com contador incremental em memória, nunca recontando do banco por inserção; `proxima_rodada_em = agora`), renova `coleta_ate` dos testes nossos. Conta também `candidatos_esperados` (as mesmas 3 consultas) e `alvos_ativos`, para `sem_alvos` (§4, §10.2). Reuso: `lerCandidatos` ganha a janela como parâmetro (padrão `RULES.hourly.ageDays`, a horária não muda); um teste confere que a horária continua pedindo 14.
  - **Conflito de chave** (`unique (site_id, youtube_video_id)`; Phil I2): `on conflict (site_id, youtube_video_id) do update` com regra escrita: `coleta_ate = greatest(coleta_ate, novo)` (e `motivo_ate` do maior). **Alvo ativo** (`saiu_em` nulo): só isso. **Alvo já saído** (`saiu_em` preenchido): tabela fechada (r2, Phil N2 e Yannis N2: a r1 dizia "se o motivo novo vale", sem definir, e a conciliação, que roda 72 vezes por dia, reativaria em laço o vídeo que saiu por `indisponivel` e ainda está dentro dos 30 d):

| `saiu_por` do alvo | Motivo novo da conciliação | Reativa? |
|---|---|---|
| qualquer | `teste_nosso` | **sim**: `saiu_em = null`, `saiu_por = null`, `proxima_rodada_em = agora` (`indisponivel_seguidas` não zera) |
| `removido` | `janela_concorrente` (o vídeo voltou a existir em `competitor_videos`, canal readicionado) | **sim**, mesmos campos: a causa da saída deixou de valer |
| `removido` | `janela_propria` | **não**: `removido` só nasce de concorrente apagado de `competitor_videos`; janela de próprio contra alvo `removido` usa `on conflict do nothing` (r3, Yannis) |
| `indisponivel` | `janela_concorrente`, `janela_propria` | **não**: o candidato de janela contra alvo saído usa `on conflict do nothing` |
| `janela` | `janela_concorrente`, `janela_propria` | **não**, idem (a janela é a mesma que o fez sair) |
| qualquer | `extensao`, `extensao_curta` | **não** (extensão só nasce de alvo ativo, §7 abaixo) |

    A poda nunca toca alvo com `saiu_em` nulo. Cobre vídeo próprio antigo que já foi alvo e ganhou teste nosso, e concorrente removido e readicionado. `indisponivel_seguidas` só volta a zero quando uma leitura lê título.
  - **Alvo com teste nosso vivo nunca sai por `indisponivel`** (Yannis I1, fluxo comum do dono: sobe o vídeo privado, cria o rascunho, publica depois): só conta `indisponivel_seguidas` e espaça as rodadas para 1 a cada 6 h; ao publicar, volta a ler. A conciliação **reativa** alvo saído que voltou a ter teste nosso vivo (primeira linha da tabela acima).
- **Extensão:** para os alvos lidos agora com `coleta_ate − agora < 48 h` ou já estendidos, **no mesmo passo em que decide a saída** (ver abaixo), lê as leituras **por vídeo**, só as colunas do expansor, `lida_em >= coleta_ate − 30 d` (a regra não precisa de mais), **paginadas por `range` até esgotar e com `count` conferido** (`max_rows = 1000` em `supabase/config.toml:15`: o PostgREST corta **sem erro** e, em ordem ascendente, joga fora as mais recentes: veredito errado em verde; 60 d = 720 linhas, uma consulta `.in()` para 16 vídeos chega a 5.760). No máximo **4 vídeos avaliados por disparo**, em paralelo, dentro do teto de 30 s (§6.3). Expande (`leiturasDoBanco`), agrupa por vídeo e chama `detectarTesteYoutube` **com `try/catch` por vídeo** (§5.1). `coleta_ate` só cresce (função pura `estenderColeta`, monótona). Quando o veredito é `provavel_teste`, grava também **`reter_ate = greatest(reter_ate, ultimaVista + 180 d)`** (Phil I3: sem isso, até a S7 existir a prova de todo teste detectado seria apagada 30 d depois de sair; pior caso ≤ 10 vídeos × 12 leituras/dia × ~60 d × 320 B ≈ 2,3 MB a mais; a S7 depois troca pela regra dela).
- **Saída:** `agora > coleta_ate` → `saiu_em = agora`, `saiu_por = 'janela'` **só no mesmo passo que avaliou a extensão**: sem tempo para avaliar, o alvo não sai neste disparo (sai no seguinte), para o vídeo em teste perto do corte não sair calado e sem veredito (Yannis I7); 4 rodadas seguidas com `indisponivel` (e sem teste nosso vivo) → `saiu_por = 'indisponivel'`; vídeo de concorrente apagado de `competitor_videos` (canal removido pelo dono) e sem teste → `saiu_por = 'removido'`. O alvo fica; as leituras vão na poda (§10.1).
- **Shorts e redirecionamento** (Phil I6): o código `redirecionado` (§5.3) registra o 3xx que não é consentimento. **P2 medida em 18/10: dos 176 vídeos de concorrente publicados nos últimos 30 dias, 51 são Shorts (29 %); `is_short` nunca é nulo** (`.superpowers/sdd/a5/tc/medicoes-p1-p3.md`). Passa de ~20 %, então a decisão "Shorts entram em V?" é do plano, com um teste de 1 página: se o T&C não valer para Shorts, ficam de fora e V cai para ~103 (a capacidade só melhora); se entrarem, uma fração fixa das leituras pode dar `redirecionado`, e o plano a exclui das razões de `leitura_bloqueada` ou mede antes.
- **Dependência de ordem (resolvida):** a extensão importa `detectarTesteYoutube` da S3, e a lib já está em `origin/staging` (`fe32b8976`, `lib/youtube/teste-youtube/{detectar,imagem,tipos,...}.ts`) [V]. Sem ela o teste perto do corte sairia calado; deixou de ser risco.

---

## 8. Banco

### 8.1 Migration (uma, `npm run db:new observatorio_a5_s4_leitura_watch`)

**Fila:** Migration A do A/B → **esta** → `ab_native_tests`. Antes do `db:new`: `git fetch`, trazer `origin/staging` para a árvore, conferir que a Migration A já está lá e avisar a sessão do A/B; anotar na fila. **A partir de 30/10 não há dia de migration** (destrutivas da A5): esta tem de entrar até 29/10.

```sql
-- forma de titulos_divergentes (r2, Phil N4): array de até 10 {renderer: text não vazio, texto: text não vazio | JSON null}; chave sumida e string 'null' recusadas
create or replace function public.yt_watch_titulos_ok(j jsonb) returns boolean
language sql immutable as $$
  select j is null or (
    jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 10
    and not exists (
      select 1 from jsonb_array_elements(j) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(jsonb_typeof(e->'renderer'), '') <> 'string'
         or btrim(e->>'renderer') = ''
         or not (e ? 'texto')
         or coalesce(jsonb_typeof(e->'texto'), '') not in ('string', 'null')
         or (jsonb_typeof(e->'texto') = 'string' and btrim(e->>'texto') = '')
    )
  )
$$;

-- yt_watch_alvos: quem está na coleta e quando é a próxima rodada (~V linhas)
create table if not exists public.yt_watch_alvos (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  tipo text not null check (tipo in ('concorrente','proprio')),
  motivo_ate text not null check (motivo_ate in ('janela_concorrente','janela_propria','teste_nosso','extensao','extensao_curta')),
  coleta_ate timestamptz not null,
  extensoes_curtas smallint not null default 0 check (extensoes_curtas between 0 and 2),
  hora_base_min smallint not null check (hora_base_min between 0 and 359),
  proxima_rodada_em timestamptz not null,
  ultima_rodada_em timestamptz,
  rodadas integer not null default 0,
  indisponivel_seguidas smallint not null default 0,
  saiu_em timestamptz,
  saiu_por text check (saiu_por in ('janela','indisponivel','removido')),
  reter_ate timestamptz,                         -- a S4 põe ultimaVista + 180 d no provavel_teste (§7); a S7 troca pela regra dela; a poda respeita
  created_at timestamptz not null default now(),
  unique (site_id, youtube_video_id),
  check ((saiu_em is null) = (saiu_por is null))
);
create index if not exists yt_watch_alvos_devidos on public.yt_watch_alvos (proxima_rodada_em) where saiu_em is null;

-- yt_watch_thumbs: miniaturas DISTINTAS por vídeo; ETag e sha na chave (o sinal fraco F6 precisa delas)
create table if not exists public.yt_watch_thumbs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  host text not null check (host ~ '^i[0-9]*\.ytimg\.com$'),
  variante text not null check (variante ~ '^[a-z0-9]{1,100}$'),   -- alinhado ao Zod do contrato (até 100)
  http smallint check (http between 100 and 599),
  etag text check (etag is null or (etag <> '' and length(etag) <= 200)),   -- alinhado ao Zod (até 200)
  sha16 text check (sha16 is null or sha16 ~ '^[0-9a-f]{16}$'),
  dhash text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  largura smallint check (largura between 1 and 4096),
  altura smallint check (altura between 1 and 4096),
  primeira_vista timestamptz not null,
  ultima_vista timestamptz not null,
  vistas integer not null default 1,
  check ((largura is null) = (altura is null)),
  check (dhash is null or (http = 200 and largura is not null)),
  check (ultima_vista >= primeira_vista),
  unique nulls not distinct (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura)
);

-- yt_watch_readings: uma linha por TENTATIVA (inclusive a que falhou)
create table if not exists public.yt_watch_readings (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  lida_em timestamptz not null,
  rodada_id uuid not null,
  origem_rede text not null check (origem_rede in ('vercel','forja','mac-casa')),
  versao_leitor smallint not null,               -- sobe quando o parser muda (layout do YouTube)
  http smallint check (http between 100 and 599),
  erro text check (erro is null or erro ~ '^[a-z0-9_]{1,40}$'),
  idioma text check (idioma is null or idioma ~ '^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$'),   -- BCP 47 simples: aceita es-419, pt-PT
  titulo_oficial text check (titulo_oficial is null or (length(btrim(titulo_oficial)) > 0 and length(titulo_oficial) <= 500)),
  titulo_oficial_fonte text check (titulo_oficial_fonte in ('videoDetails','og_title')),
  titulo_exibido text check (titulo_exibido is null or (length(btrim(titulo_exibido)) > 0 and length(titulo_exibido) <= 500)),
  renderers_presentes smallint not null default 0 check (renderers_presentes between 0 and 7),  -- máscara de RENDERERS_TITULO
  titulos_divergentes jsonb check (public.yt_watch_titulos_ok(titulos_divergentes)),   -- [{renderer, texto|null}] só quando os presentes discordam ou há renderer fora da lista
  rendicoes_sqp smallint check (rendicoes_sqp between 0 and 200),
  jogador_bloqueado boolean not null default false,   -- fora do contrato; só com erro nulo (§5.3)
  miniatura_id bigint references public.yt_watch_thumbs(id) on delete set null,
  check ((titulo_oficial is null) = (titulo_oficial_fonte is null)),
  check (not (titulo_exibido is not null and titulos_divergentes is not null)),
  check ((titulo_exibido is null) or renderers_presentes > 0),
  check (not jogador_bloqueado or erro is null),
  check (erro is null or (titulo_exibido is null and titulos_divergentes is null and titulo_oficial is null and renderers_presentes = 0)),
  check (erro is not null or (titulo_exibido is null and titulos_divergentes is null) or idioma is not null)
);
create index if not exists yt_watch_readings_video_tempo on public.yt_watch_readings (youtube_video_id, lida_em);
```

- **Os CHECKs acima são espelhados, um a um, por `linhaCabeNoBanco` (§6.4)**; uma tabela de casos única (`valores que o banco recusa`) alimenta o teste do espelho Zod e o teste de integração, para os dois não divergirem. Onde o banco foi mais estreito que o contrato sem razão (idioma, etag, variante), foi alargado.
- O `''` é recusado em toda coluna de texto pelo `btrim` (também `'   '`); U+00A0 e U+200B o `btrim` não pega: o parser os reduz a `null` antes (`normalizarTitulo`), e o Zod recusa de novo. Teste de integração tenta inserir os três e espera `23514` no `''` e no espaço.
- `titulos_divergentes` passa por CHECK de forma (função `yt_watch_titulos_ok(jsonb)`, no DDL acima), para "renderer ausente" ser sempre JSON `null`, nunca chave sumida nem a string `'null'` (Phil, contrato item 1). `linhaCabeNoBanco` espelha também esta função.
- **`viewCount` (D7, SUSPENSA na r5, decisão do dono 18/10):** a coluna `view_count bigint` e o seu CHECK **não entram** na S4; os CHECKs de `yt_watch_readings` ficam em **17**. O P-V mostrou que, no Vercel, a página não traz `videoDetails` (de onde viria o `viewCount`): a coluna ficaria 100 % nula (falha em verde). Não verificado: se o `ytInitialData` traz a contagem em outro renderer. Retomada: se a coleta for à forja (onde o `videoDetails` volta) ou se a Data API (que já grava `viewCount` dos concorrentes) for a fonte.
- **Funções** (todas `security invoker`, `revoke all from public, anon, authenticated`, `grant execute to service_role`): `yt_watch_gravar_disparo(jsonb)`, `yt_watch_poda(p_agora timestamptz, p_lote int)`, `yt_watch_prova(p_agora timestamptz, p_coleta_ligada boolean)` (§10.2) e a pura `yt_watch_titulos_ok(jsonb)` (`immutable`, só leitura do argumento; fica fora do `revoke` porque o CHECK a chama com o papel de quem insere).
- **RLS** nas três tabelas, no padrão da E14/E18: `select` com `can_view_private_site(site_id)` se a MG11 existir, senão `can_edit_site(site_id)` (leitura sensível nunca por `can_view_row`, que confia no GUC); sem policy de escrita; `revoke all from anon`; `revoke insert, update, delete, truncate from authenticated`. `drop policy if exists` antes de cada `create policy`.
- Idempotência: `create table if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists`.

### 8.2 Expansor (`leiturasDoBanco`)

- `titulosExibidos`: com `titulos_divergentes` → o array como está; senão, para cada renderer de `RENDERERS_TITULO`, `texto = bit presente ? titulo_exibido : null`.
- `miniaturas`: `miniatura_id` → `[linha de yt_watch_thumbs]` com `url` remontada de `host` + `variante`; senão `[]`. Nunca estende a miniatura vigente para leitura que não a buscou (inventaria voto).
- `lidaEm`: lido por PostgREST (`+00:00`, aceito pelo Zod do contrato). Leitura por RPC SQL usa `to_json(lida_em)` (A9 do Yannis).
- **Ida e volta:** `paraLinhas` ∘ `leiturasDoBanco` = identidade sobre o que **o leitor produz** (0 ou 1 miniatura por leitura, renderers de `RENDERERS_TITULO`; uma leitura com 6 miniaturas não cabe em `miniatura_id`), em teste de propriedade com gerador **escrito à mão com `rng` semeado** (não há `fast-check` no repo; nenhuma dependência nova), 500 casos.

### 8.3 Volume

Linha de leitura: cabeçalho 24 + id 8 + site_id 16 + video 12 + lida_em 8 + rodada 16 + origem ~7 + versão 2 + http 2 + idioma ~6 + títulos ~124 + fonte ~13 + máscara 2 + sqp 2 + alinhamento ~10 ≈ **252 B**; índice `(youtube_video_id, lida_em)` ~40 B; PK ~28 B → **~320 B** com oficial; **no Vercel o oficial e a fonte são nulos (r5): −~75 B, ~245 B** (estimativa: a média de 62 B por título não foi medida) (o "~290 B" do contrato + `site_id` para a RLS sem junção e `versao_leitor`). Linha de erro ~150 B.

| Medida | Conta | Valor |
|---|---|---|
| Leituras/dia | 145 × 4 × 3 | 1.740 |
| Banco/dia | 1.740 × 245 B (Vercel; 320 B na forja) | **~0,43 MB** (0,56 MB na forja) |
| Vida média de uma leitura | metade da janela (~15 d) + 30 d de retenção | ~45 d |
| Regime | 0,43 MB × 45 | **~19 MB** (25 MB na forja) |
| 3× canais | × 3 | ~57 MB |
| Miniaturas distintas | ~2–3 por vídeo (codificações alternadas, F7) | < 0,1 MB |
| Folga do banco | 500 MB − 202 MB (14/10) | ~298 MB; a S4 usa ~6 % em regime |

---

## 9. Quando o dado não existe (falha em verde)

| Situação | O que fica gravado | O que a regra/tela vê | Alarme da coleta |
|---|---|---|---|
| Consentimento / robô sem título / 429 / 3xx | linha com `erro`, títulos nulos | `sem_leitura` ou `comErro = N` → "N leituras falharam" | **no disparo** (§6.3): `bloqueado` (disjuntor) para consentimento, robô e 429; `leitura_bloqueada` (≥ 6 tentativas de ≥ 3 vídeos, > 50 % com erro, sem contar `indisponivel`) para os demais códigos ⇒ `erro`, vigia em 2 h; na prova: `com_erro_24h / (leituras_24h − indisponiveis_24h) > 50 %` → vermelho + aviso (com a coleta ligada, §10.2) |
| Player bloqueado com título legível | linha sem `erro`, títulos, `jogador_bloqueado = true` | leitura normal | `jogador_bloqueado_24h` no detalhe (aviso) |
| Oficial ausente **sem** jogador bloqueado (erro nulo, título exibido lido; r5) | linha normal, oficial nulo | leitura normal | prova: `sem_oficial_sem_bloqueio_24h / leituras_sem_erro_24h > 20 %` → aviso; é o sinal de layout que o oficial nulo do Vercel esconderia |
| Vídeo removido ou privado | linha `indisponivel`; depois de 4 rodadas, alvo sai (`saiu_por = 'indisponivel'`) e a conciliação não o reativa por janela (§7) | "vídeo indisponível desde X", nunca "sem teste" | contado (`indisponiveis_24h`), fora das razões de bloqueio, não alarma |
| Layout novo (renderers somem) | linha sem `erro`, títulos nulos, `renderers_presentes = 0` | `insuficiente`, `titulo_nao_lido` | **no disparo**: ≥ 6 leituras sem erro e > 50 % sem título ⇒ `erro` `layout_mudou`; na prova: `sem_titulo_24h > 20 %` → vermelho + aviso |
| Nenhum alvo (filtro errado, join trocado) | nada | `sem_leitura` | `sem_alvos`: `candidatos_esperados > 0` e `alvos_ativos < 0,5 ×` isso ⇒ vermelho (na prova; com zero alvos e ao menos uma execução, sem esperar as 24 h) e `parcial` (no disparo; o vigia enxerga o `parcial`, §10.2) |
| Linha que o banco recusaria | linha `fora_do_formato` | `erro` nessa tentativa | contada no relato (`fora_do_formato_24h` na prova) |
| Nenhuma leitura no dia para um vídeo | nada (é o caso que some) | `sem_leitura` | `alvos_atrasados` (próxima rodada vencida há > 2 h) e `menos_de_3_rodadas_24h` na prova → vermelho |
| Coleta desligada (`OBS_WATCH_READ` ≠ `on`) | nada | `sem_leitura` | o vigia não cobra (é o contrato do `ligaCom`) **e a prova diária também não** (`p_coleta_ligada = false`: motivos de coleta sem cor, sem aviso, §10.2); a tela da S5 diz "coleta desligada" lendo a mesma variável |
| Idioma servido diferente | linha com o idioma servido | a regra separa por idioma | `idioma_diferente_24h > 0` vai no detalhe (aviso, não vermelho) |
| Gravação falhou | nada; alvos continuam devidos | atraso | `gravacao_falhou` no disparo; `alvos_atrasados` na prova |
| Extensão sem a lib S3 | impossível por desenho (deploy espera a S3) | — | — |
| Leitura com `erro = null` mas recusada pelo Zod na volta | — | `invalidas` | teste de ida e volta (§8.2) impede; se acontecer, `invalidas_24h` na prova |

---

## 10. Retenção e saúde

### 10.1 Poda (`poda_leituras_watch`, diária, a partir das 05:00 SP)

- Apaga as **leituras primeiro e depois as miniaturas órfãs** (na ordem inversa o `on delete set null` reescreveria cada leitura antes de apagá-la; Phil M3) de alvos com `saiu_em < agora − 30 d` e (`reter_ate` nulo ou vencido), em lotes de 5.000 linhas por chamada (`yt_watch_poda`), até 3 lotes por execução; o resto fica para o dia seguinte (`parcial`, `sobrou`: trabalho real pendente, que termina). Depois apaga o alvo sem leituras.
- Zero apagado é dado lido (nada venceu), `ok`.
- **A prova vermelha não muda o estado da poda** (r2, Phil N3; a r1 mandava `parcial`, e na agenda `parcial` com `done_n > 0` reabre o período sem gastar tentativa: a poda reroda até 72 vezes por dia sem aviso novo): a poda que concluiu o seu trabalho devolve **`ok`**, com **`detalhe.prova_vermelha = [motivos]`** (só números e códigos do catálogo). O destino do vermelho é outro (§10.2): o vigia da `leitura_watch` para `bloqueado`, `layout_mudou`, `leitura_bloqueada` e `sem_alvos`, e o aviso diário `leitura_watch_vermelha` para todos, que é o único canal de `rodadas_faltando`.
- Primeira poda com linhas: 30 dias depois do primeiro `saiu_em` (o vídeo de concorrente mais velho sai ~1 dia depois do deploy) → **~D+31**.

### 10.2 Prova diária (`yt_watch_prova(p_agora, p_coleta_ligada)`, rodada pela poda)

Devolve números (só números, catálogo fechado): `candidatos_esperados`, `alvos_ativos`, `alvos_atrasados`, `jogador_bloqueado_24h`, `fora_do_formato_24h`, `rodadas_24h`, `menos_de_3_rodadas_24h` (entre alvos com mais de 24 h na coleta), `leituras_24h`, `indisponiveis_24h` (leituras `indisponivel`), `com_erro_24h` (leituras com `erro` **exceto `indisponivel`**), `por_erro` (contagem por código, todos), `sem_titulo_24h`, **`sem_oficial_sem_bloqueio_24h`** (r5: erro nulo, `titulo_oficial` nulo, `jogador_bloqueado = false`, título exibido lido ou `titulos_divergentes` preenchido (leitura de teste); aviso quando a razão sobre as leituras sem erro passa de 20 %; `jogador_bloqueado_24h` fica no detalhe e, no Vercel, perto de 100 % não alarma), `idioma_diferente_24h`, `rodadas_longas_24h` (> 10 min; esperado 0), `primeira_leitura` (`min(lida_em)`, só informativo) e **`coleta_desde`** (`min(started_at)` das execuções de `leitura_watch` em `competitor_agenda_runs`, que existe mesmo com a tabela de leituras vazia; r3, Phil R3 e Yannis N9).

**Coleta ligada (r2, Yannis N3).** A poda lê `OBS_WATCH_READ` e passa `p_coleta_ligada`. Os motivos de **coleta** (`leitura_bloqueada`, `layout_mudou`, `rodadas_faltando`, `sem_alvos`) só têm cor quando `p_coleta_ligada` **e** `coleta_desde < p_agora − 24 h` (r3: o relógio é o das execuções da tarefa, não o da tabela de leituras, que fica vazia no pior caso, "nada grava"; **sem nenhuma execução** de `leitura_watch`, `coleta_desde` é nulo e vale "ainda não"). **Exceção sem relógio de 24 h:** com `p_coleta_ligada`, `candidatos_esperados > 0`, `alvos_ativos = 0` e **ao menos uma execução** de `leitura_watch`, `sem_alvos` é vermelho direto (a conciliação do primeiro disparo já cria os alvos; zero alvos depois de um disparo é defeito). **Religar a coleta:** `coleta_desde` vem da era anterior, então `rodadas_faltando` pode acender com o atraso do desligamento; o plano escolhe entre contar só desde a última execução `ok` ou aceitar um aviso no dia seguinte, e nesse caso o texto do aviso diz "coleta religada há pouco". Desligada, ou nas primeiras 24 h (fora a exceção do `sem_alvos`), a função devolve esses motivos como `null`, sem cor, e a poda não manda aviso nem põe `prova_vermelha`: sem isso, o deploy com a variável ainda desligada (tabela vazia, `sem_alvos` vermelho) ou o dono que desliga a coleta num bloqueio (§17) gerariam aviso diário por defeito que ele mesmo escolheu. Os números de retenção e `fora_do_formato_24h` seguem sendo calculados. Nas primeiras 24 h o disparo cobre o defeito (`layout_mudou`, `bloqueado` pelo vigia de 2 h), e o `sem_alvos` vermelho direto cobre o caso dos alvos que nunca nasceram.

| Motivo (catálogo) | Quando | Cor |
|---|---|---|
| `leitura_bloqueada` | `com_erro_24h / (leituras_24h − indisponiveis_24h) > 0,5` com ≥ 30 leituras (sem contar `indisponivel`) | vermelho |
| `layout_mudou` | `sem_titulo_24h / (leituras_24h − com_erro_24h − indisponiveis_24h) > 0,2` | vermelho |
| `rodadas_faltando` | `menos_de_3_rodadas_24h > 0` ou `alvos_atrasados > 0` | vermelho |
| `sem_alvos` | `candidatos_esperados > 0` e `alvos_ativos < 0,5 × candidatos_esperados` (com `alvos_ativos = 0`, vermelho já na primeira prova depois de uma execução, sem esperar as 24 h) | vermelho |
| `sobrou`, `bloqueado`, `gravacao_falhou`, `leitura_bloqueada`, `layout_mudou`, `sem_alvos` | no disparo da `leitura_watch`, com os estados do §6.3 | o vigia da agenda (2 h de tolerância) |

**A prova vermelha chega ao dono** (Phil C2: a prova rodava uma vez por dia e o vermelho não tinha destino): `ChaveAviso` (`aviso.ts`, catálogo fechado) ganha **`'leitura_watch_vermelha'`**, com a trava diária já existente, enviada pela poda quando qualquer motivo da prova acende, **com a coleta ligada há mais de 24 h (`coleta_desde`) ou `sem_alvos` direto**. Dois canais, sem o `parcial` da r1: (1) o vigia da `leitura_watch` (estado diferente de `ok` do disparo, ~2 h: `erro`, e `parcial` no `sem_alvos`, §6.3) para `bloqueado`, `leitura_bloqueada`, `layout_mudou`, `sem_alvos`; (2) o aviso diário para todos os motivos da prova, único para `rodadas_faltando` (diário basta). A poda fica `ok` com `prova_vermelha` no detalhe (§10.1), e a segunda execução do mesmo período não existe, então o aviso não se repete. Resultado: bloqueio e layout novo são vistos em ~2 h pelo disparo e em ≤ 1 dia pelo aviso; antes, ~1.650 leituras falhas com a agenda verde.

Mais o vigia de toda tarefa da agenda (`toleranciaVigiaH`), que já cobre "a tarefa não rodou".

---

## 11. Custo (plano atual, sem pago)

| Item | Conta | Valor | Estado |
|---|---|---|---|
| Invocações novas | roda no disparo `*/20` existente | **0** | [V] |
| Duração de função a mais | ~10 s × 72 | ~12 min/dia, ~6 h/mês de parede | [H] dentro do incluído do Pro; conferir D+1 (C8) |
| CPU ativa | parse 1.740 × ~15 ms + sharp 580 × ~10 ms | ~32 s/dia | [H] |
| Rede de entrada | 1.740 × 310 KB + 580 × 11 KB | ~545 MB/dia, ~16 GB/mês | [H2] conferir que não é cobrada (C8) |
| Cota de API do Google | página pública e `ytimg` | **0** | [V] |
| Limite de taxa do YouTube anônimo | não documentado; ~1,2 página/min em média, concorrência 3 | risco de robô em IP de datacenter | [H1] é o P-V; disjuntor §6.3 |
| Banco | §8.3 | ~19 MB em regime (Vercel) | conta |
| Blob | nenhum | 0 | — |

---

## 12. Portão P-V (Vercel enxerga a divisão?)

**O que roda:** rota temporária `GET /api/cron/watch-pv` (`maxDuration = 300`, `Authorization: Bearer CRON_SECRET`, `runtime = 'nodejs'`), que aceita só `v=qIg9a7vqcNo`, **não grava nada** e devolve JSON. Código mínimo e autocontido (contagem por marcador de texto nos 3 renderers, como `sondar-paginas.sh`, mais `HL`/`GL`, status, `videoDetails`/`og:title`, marcadores de consentimento e robô), para não depender do leitor completo. **Fase 1:** **10 rodadas de 3 leituras** (~1–2 s entre as leituras, 15 s entre rodadas: ~3 min). **Fase 2 (Yannis I3):** o P-V de uma só página a ~10/min não testa o tráfego da produção (rajadas de ~200 páginas/min, 16 vídeos); logo depois das 10 rodadas, **uma rajada igual à da coleta**: 16 vídeos × 3 passadas, concorrência 3, com lista **fixa no código** de 15 ids públicos próprios (escolhidos no plano) + o qIg9, sem parâmetro de entrada além do `v` fixo. O JSON grava também `process.env.VERCEL_REGION` e o `x-vercel-id` da resposta (de que bloco de IP veio o resultado; se a coleta depois rodar em outra região, o P-V não vale para ela). A rota segue sem gravar nada, sem cliente Supabase importado (teste de módulo).

**Push e promoção (D1 caducou; a S2 já foi, `main bdb21d7d9`):** a rota vai num **push próprio**, em commit isolado (`route.ts` + teste da rota), e esse push **espera o ok do dono** (marcado assim; nada sobe sem ele). A promoção à main leva junto **os commits do A/B que estiverem no staging** (`git log --oneline origin/main..origin/staging`, lista anotada no ledger antes de promover; hoje 28 commits à frente), e por isso precisa do **ok escrito da sessão do A/B** sobre eles (Yannis I4). `cherry-pick` da rota numa promoção só dela **não é opção** (main = staging é a regra). Alternativa só se a sessão do A/B não liberar a tempo: bypass de proteção de implantação no preview, que hoje não existe [V: nenhuma referência no repo] e é 1 variável no painel; perguntar ao dono, com a recomendação de Hanna, até 19/10. **Alvo: rota no ar até 20/10 09:00 UTC.**

**Teste da rota (no commit dela):** 401 sem header; 401 com segredo errado de mesmo tamanho (`timingSafeEqual`, como `sync-youtube/route.ts:36-46`); 400 com `v` diferente de `qIg9a7vqcNo`; `maxDuration = 300` e `runtime = 'nodejs'` exportados; `fetch` injetado mostrando que nada é gravado.

**Quando:** com a rota em produção. **Hora:** logo depois de uma rodada da sonda horária do Mac (que roda a `:21`), às **HH:22 UTC**, e só se a última rodada mista do Mac em `titulos.tsv` tiver menos de 3 h (teste ainda no ar). Alvo: **20/10**; última hora útil **21/10 12:22 UTC (09:22 BRT)** (a sonda do Mac acaba ~13:21; o teste acaba ~17:45).

**Critério (todos):**

| Medida | Passa |
|---|---|
| HTTP 200 | ≥ 28 de 30 |
| 3 renderers presentes | ≥ 28 de 30 |
| `HL`/`GL` servidos | `pt`/`BR` em 30 de 30 |
| Título oficial ausente **só** com `jogador_bloqueado` (LOGIN_REQUIRED com renderers; r5, substitui "`videoDetails.title` ou `og:title` 30 de 30") | 30 de 30 (fase 1) e 48 de 48 (fase 2); **uma** leitura sem oficial e sem bloqueio reprova |
| Consentimento, robô **sem título**, 429 (fase 1) | ≤ 2 de 30 |
| Player bloqueado **com** título (`jogador_bloqueado`) | só registra, não reprova (Yannis I2); é a explicação aceita para o oficial ausente |
| Rajada (fase 2): consentimento, robô sem título, 429 | ≤ 2 de 48 |
| **Rodadas mistas** | **≥ 4 de 10** (no Mac 13/20 = q 0,65; **P(≤ 3 mistas de 10 \| q = 0,65) = 2,6 % por execução, ~5,1 % (1 − 0,974²) para as duas execuções** de falso "não passou", aceito e escrito assim; com o q teórico de 0,75 daria 0,35 %. A C0, 4 B de 6, é compatível com q de 0,67 a 0,75) |
| **Duas execuções** | em horas diferentes (duas invocações, provavelmente dois IPs); passa só se **as duas** passam |
| Controle do Mac na mesma hora | a rodada `:21` do Mac (e a anterior) com B visto |

**Desfechos:** passa → coleta no Vercel (`origemRede = 'vercel'`). Mistas < 4 com o Mac vendo B → o Vercel cai em braço fixo → **forja**. Bloqueio > 2 → **forja**. Mac sem B nas últimas 3 rodadas → teste encerrado → **inconclusivo = não passou** (decisão do dono: "Vercel se o P-V passar") → **forja**, escrito assim, nunca "passou".

**Emenda r5 (18/10, decisão do dono, pareceres de Phil e Yannis em `.superpowers/sdd/a5/tc/parecer-emenda-pv-{phil,yannis}.md`).** O datacenter iad1 recebe o player bloqueado em 156 de 156 leituras e nunca o `videoDetails` nem o `og:title`: o critério antigo (oficial 30/30) reprovava com 0/30, mas o que o P-V pergunta (o Vercel enxerga a divisão do teste?) respondeu sim (3 renderers 30/30, 8 de 10 rodadas mistas nas duas execuções, HL/GL pt/BR 30/30, zero bloqueio, capacidade 1,63×). O critério novo é mais estreito e conferível nos dados existentes. As execuções 21:22Z e 22:22Z, reavaliadas por `pv-avaliar.mjs`, **passam**: sem oficial e sem bloqueio **0/78 nas duas** (fase 1 e fase 2); a saída está em `pv-veredito.md` ("Reavaliação com o critério emendado (r5)"). **Não precisa de nova execução.** Desfecho: **passa** (a coleta vai ao Vercel, `origemRede = 'vercel'`) com `OBS_WATCH_READ=on` ainda sujeito ao portão de Phil, Yannis e Gio e ao `db:push:prod`.

**Desfecho do oficial (r5).** `oficial_nao_lido` de `inferirDesfecho` é o estado **esperado** com leitura do Vercel (`desfecho.ts:62-64`); a S4 não injeta a Data API em `tituloOficial` (§5.3). O veredito, as contagens, a conciliação do §7 e `titulos_divergentes` não dependem do oficial (`titulo.ts:138-142` o usa só para ordenar variantes). **Dono do vencedor: a S7**, pela Data API, que já grava: concorrentes em `competitor_video_versions` (`field = 'title'`, `first_seen_at`, `precision '6h'`, um sync por canal a cada faixa de 6 h; folga de 7 h em `competitor-versions.ts:17`); próprios em `yt_own_video_versions` e `yt_own_video_meta_daily` (diária, captura ~12:00 UTC). A S7 decide a forma (valor `'data_api'` no contrato com o ok da sessão do A/B, ou parâmetro à parte). Regra de tempo fixada aqui: oficial = o valor da Data API **vigente na última leitura do sufixo**, lido de uma captura feita **depois** dela (e com data ≥ a 1ª leitura do sufixo). Sem esse título o estado fica `sem_dado`, nunca vencedor. Teste da S7: sufixo B×24 com oficial nulo e Data API = B dá vencedor B; Data API = A dá `oficial_diverge`; sem linha da Data API depois do sufixo dá `sem_dado`. Defasagem: o sufixo exige ≥ 18 leituras e ≥ 24 h (`tipos.ts:226-227`); concorrentes com atraso de até 7 h cabem; próprios até ~24 h (o desfecho do vídeo próprio sai até 1 dia depois de ficar estável, aceitável). Avisar a sessão do A/B (contrato congelado). **Dívida D-PV1** (coleta pelo Vercel sem título oficial; gatilho para pagar: o CHECK da C2 falhar ou a coleta ir à forja, onde o `videoDetails` volta; dono: a S7).

**Prova (r5).** O contador `sem_oficial_sem_bloqueio_24h` (§9, §10.2) com aviso acima de 20 %. **Sem CHECK de banco** do tipo "oficial nulo só com bloqueio": uma mudança de layout viraria `fora_do_formato` e perderia os títulos exibidos, que são o dado que expira. O DDL não muda (dois nulos passam em todos os CHECKs; 17 CHECKs).

**Reabertura (r5).** Se a **C2 de 19/10** mostrar a Data API vendo o braço B (título B em `yt_own_video_meta_daily`), a premissa "a Data API só vê o oficial" cai: reabrir esta emenda e avisar o A/B.

**Suspensão da D7 (r5).** `view_count` sai da S4 (§8.1, §18 D7).

**Rota removida** em commit próprio no lote da S4 (teste confere que o caminho não existe).

**Se a rajada reprovar:** a coleta lê com concorrência 1 (custo por vídeo 3 × 0,8 s + 0,1 s ≈ 2,5 s; no orçamento do §6.3 cabem `⌊(30 − 3) / 2,5⌋ = 10` vídeos, 720 rodadas/dia = 1,24 × 580, **abaixo** do aceite de 1,5 × do §6.2) e o P-V re-roda com esse padrão; se o aceite de 1,5 × não fechar, vai à forja.

---

## 13. Plano B: forja (só se o P-V não passar)

- O leitor é puro com `fetch` injetado: a forja roda o **mesmo** `lerWatchSemCookie` empacotado num arquivo único (`esbuild`, Node da forja) por cron `*/20` (BRT, fuso da forja), e envia as leituras a uma rota de pipeline nova (`POST /api/pipeline/youtube/watch-readings`, chave por pessoa/máquina, Zod com `leituraWatchSchema`, grava pela mesma `yt_watch_gravar_disparo`). Seleção de alvos e próxima rodada continuam no servidor (rota `GET .../watch-alvos-devidos`), para a forja não ter estado.
- **Gatilho escrito do recuo para a forja (r5; concilia Phil C4 e Yannis C4, vale o mais estrito):** abrir a emenda da forja se qualquer um ocorrer: (a) `verificacao_robo` + `http_429` > 10 % das leituras em 24 h; (b) o disjuntor `bloqueado` (robô sem título, 429 ou consentimento) em **2 de 7 dias** ou 2 disparos seguidos; (c) a fração de leituras com renderers ≥ 1 cair (a C7-bis em D+1 e D+7 registra a linha de base; queda nos renderers é o aviso antecipado). A resposta é `OBS_WATCH_READ` ≠ `on` e o spec próprio da forja. O player bloqueado em 100 % mostra que o IP do iad1 já está marcado; o próximo degrau (página de robô sem renderers) já vira `erro = verificacao_robo` e acende o disjuntor do §6.3, o vigia de 2 h e a C7. Custo do recuo: rota de pipeline, `seq` e kit; nada do que a S4 grava fica inválido (`origem_rede` separa as eras). **Dívida D-PV2:** `jogadorBloqueado` é a linha de base no Vercel; dono: o controlador, na C7-bis.
- **Idempotência (Phil M2, só se o P-V mandar para a forja):** a forja reenvia o POST se a resposta não chega e a mesma rodada gravaria duas vezes, inflando votos. Coluna `seq smallint` (1..3) e `unique (rodada_id, seq)`, com `on conflict do nothing` em `yt_watch_gravar_disparo` (custo ~2 B + ~40 B de índice por linha, +13 % de volume, ~3 MB em regime). No Vercel não há nova tentativa, então não há duplicata. Nota: `sharp` é nativo e não entra num arquivo único do `esbuild`; a sonda de miniatura na forja exige `sharp` instalado lá ou fica do lado do servidor.
- Integridade do pipeline: `api-registry.ts` (+2 endpoints, `endpoint_count`), `cowork-docs-youtube.md`.
- **Escrita na forja é do dono:** o plano B entrega o kit em `~/Workspace/forja/ferramentas` (commit local) e os comandos curtos, um por linha, para o dono colar. Nenhum agente escreve lá.
- Orçamento acoplado da forja (20 min do claim < 25 min do cron < 30 min do watchdog) **não muda**: a leitura da watch é um cron separado, com `timeout -k 10s 15m`.
- Esse caminho vira spec próprio (emenda) se o P-V falhar; aqui só a forma.

---

## 14. S5 (esboço; tela depois, com mockup de Logan e Naksu)

- Concorrentes, cartão "provável teste de título do YouTube" com A e B como exibidos, proporção (`votos`), primeira e última vista; consome `detectarTesteYoutube(leiturasDoBanco(...))`.
- Mapa motivo → texto com `switch` exaustivo (`never` no `default`), um teste de componente por motivo. **`span_ilegivel`: a S5 usa o texto fixo "não deu para ler o período"** (emenda r5 do spec da detecção, que a A5 assinou), cor de não medido, nunca verde, nem "sem teste" nem "poucas leituras, aguarde"; `ilegiveis`/`rodadasSpan` entram **só** como "N de M rodadas sem leitura utilizável", nunca como texto da causa.
- **Quem chama `detectarTesteYoutube` na S5 (como na S4, §5.1) faz `try/catch` por vídeo e agrupa as leituras por vídeo antes**; `escritasConhecidas[].em` vem só de `toISOString()` ou de `timestamptz`; erro de opção (id, `rodadaId`, `origemRede` inválidos) não é gravado como `erro` da leitura (emenda r5).
- Importa `watch/puro.ts` (§4), nunca `leitor.ts`: sem `sharp` no bundle do cliente.
- `nada_visivel` nunca vira "sem teste": "nada visível de fora"; miniatura: "a miniatura em teste não aparece de fora; confirme no Studio".
- FU do Gio: a ressalva "Não dá para saber a causa..." aparece **só no Histórico**.
- Coleta desligada, vídeo indisponível e `sem_leitura` têm textos próprios (§9).

---

## 15. Critérios de aceite

**Unitários (Vitest, `// @vitest-environment node`):**
- A1. Parser sobre HTML recortado do qIg9 (**fixtures reais da C0**, `watch-185033-1.html` para A e `watch-185036-2.html` para B, em `apps/web/test/fixtures/watch-html/`, sem HTML inteiro; **o recorte troca `VISITOR_DATA`/`visitorData` e `"remoteHost"` por `"X"`** (r3, Phil R1 e Yannis N10: as 6 fixtures da C0 trazem `"remoteHost"` com o IP de casa do dono, conferido pelo controlador; o repo é público e depois do push só se remove reescrevendo a história). **Um teste varre `apps/web/test/fixtures/watch-html/` e exige zero ocorrências de** `/visitor_?data"\s*:\s*"(?!X")/i`, **de** `/"remoteHost"\s*:\s*"(?!X")/i` **e de qualquer literal de IP**: IPv6 `/[0-9a-f]{1,4}(:[0-9a-f]{0,4}){5,7}/i` e IPv4 só no valor de `"remoteHost"`, para não casar versão de cliente como `2.20261015.01.00` (lista de exceções escrita no teste, se algo casar). Teste do teste, uma vez, local: o varredor falha numa cópia da fixture com o `remoteHost` original e passa no recorte; e uma fixture bruta passada pelo recortador sai sem IP (Phil M1 e N7): 3 renderers com o texto certo; `runs[]` concatenados; `&amp;` → `&`; `tituloOficial` de `videoDetails` sem " - YouTube"; sem `videoDetails` → `og_title`; `idioma = 'pt-BR'`; ≤ 6 miniaturas, todas do id; `rendicoesSqp = 4`.
- A2. Fixtures sintéticas: consentimento (3xx e corpo), `redirecionado` (3xx para outro lugar), robô **sem título** (`verificacao_robo`), **robô de player com título, no formato medido no Vercel** (r5, Yannis C2 e Phil C4: derivada da página real com `playabilityStatus` trocado para `LOGIN_REQUIRED`, **sem `videoDetails` e sem a meta `og:title`**, com os 3 renderers: `erro: null`, títulos exibidos lidos, `tituloOficial: null`, `titulo_oficial_fonte: null`, `jogadorBloqueado: true`, idioma `pt-BR`; o `contar.ts` e o `extrairDaWatch` dão o mesmo booleano), 429, `UNPLAYABLE`, sem `ytInitialData`, idioma `es-419` (→ `es-419` e não `es-419-BR`), sem `ytcfg` com título (→ `sem_idioma`), renderer com `' '`, U+00A0, U+200B (→ `null`), layout novo (→ `erro: null`, títulos nulos).
- A3. `lerWatchSemCookie` com `fetch` injetado nunca lança por falha de página/transporte (timeout inclusive na leitura do corpo, rede, JSON quebrado); a `leitura` do envelope passa em `leituraWatchSchema`; **página de robô de player: `jogadorBloqueado === true` no envelope e `leitura.erro === null`; ida e volta por `paraLinhas` grava `jogador_bloqueado = true`, `http = 200` e `versao_leitor = VERSAO_LEITOR`** (Yannis N1); a sonda só roda se a própria leitura terminou com `erro = null`, mesmo com `sondarMiniatura: true`; `lidaEm` = instante da resposta; opção inválida lança `TypeError` e não vira `erro`. **429 na 1ª leitura + sonda 200 ⇒ `erro = 'http_429'` e miniatura na 2ª leitura** (Phil I1).
- A4. Sonda de miniatura: 200 → dimensão decodificada do JPEG; 404 com corpo de imagem → `dhash`/dimensão nulos; cinza do 404 com 200 → nulos.
- A5. `proximaRodada`: nunca < **2h40** da anterior; sorteio dentro de ±20 min; para 145 ids × 30 dias, carga máxima por disparo ≤ 1,5 × a média (`faixaMenosCheia`).
- A6. `estenderColeta` monótona, nula sem teste, curta no máximo 2 vezes.
- A7. Ida e volta `paraLinhas`/`leiturasDoBanco` (identidade sobre `ResultadoLeitor.leitura`; os campos do envelope voltam só pelas colunas; propriedade, gerador à mão com `rng` semeado, 500 casos, domínio = o que o leitor produz); a miniatura só na leitura que a buscou; a fixture do A/B (`test/fixtures/teste-youtube/qIg9a7vqcNo/`, 6 miniaturas por leitura) passa pelo expansor e exige-se o **mesmo veredito de título** que dá direto (C1 do spec do A/B: `rodadasMistasTitulo = 13`); a parte de miniatura é afirmada à parte (`nao_lido` ou `um_valor_so`).
- A8. Orçamento: com `agora` simulado em 70 s nenhum vídeo novo começa; a tarefa não passa de 30 s próprios; **`K_agora` em tabela: `decorrido` 5, 20, 45, 50, 55, 60, 65, 70 s ⇒ 16, 16, 16, 14, 10, 5, 1, 0 (§6.2), e `72 × K(início p90 medido) ≥ 1,5 × 580`; caso "a leve começa em 45 s e há 16 devidos ⇒ K_agora = 16"**; disjuntor com 3 `http_429` e com 3 `consentimento` para as leituras novas (`estado: 'erro', motivo: 'bloqueado'`); **16 tentativas com `sem_initial_data` de ≥ 3 vídeos ⇒ `erro`, `leitura_bloqueada`, `feitas = 0`; 2 vídeos `indisponivel` no mesmo disparo ⇒ não é `leitura_bloqueada`** (consentimento é bloqueio e para no disjuntor, Yannis N5); cliente de banco que lança timeout ⇒ uma chamada só, sem degrau, `gravacao_falhou`; 12 leituras sem renderers ⇒ `erro`, `layout_mudou`; gravação falsa que falha ⇒ `erro`, `gravacao_falhou`; disjuntor na 2ª passada ⇒ alvos com 1 leitura continuam devidos; `alvos_ativos = 0` com candidatos > 0 ⇒ `parcial`, `sem_alvos`.
- A9. `lerCandidatos` sem a janela continua pedindo 14 dias (a horária não muda).
- A10. Env com fallback: teste que **apaga** `OBS_WATCH_READ` e afirma `leitura_watch` desligada e `poda_leituras_watch` **não**; idem `'ON'` e `'1'`.
- A11. **Linha envenenada (C1):** gerador à mão de 300 `LeituraWatch` válidas pelo Zod, inclusive `erro` + `tituloOficial`, idioma `es-419`, etag de 150 e variante de 30 caracteres, passa por `paraLinhas` e toda linha passa em `linhaCabeNoBanco`; o que não passa vira `fora_do_formato`. **Mais (r5):** a linha da A2 do Vercel (`LOGIN_REQUIRED`, oficial e fonte nulos, `jogador_bloqueado = true`, `erro = null`) cabe em `linhaCabeNoBanco`.
- A12. Extensão: cliente falso que devolve 1.000 linhas com `count = 1.300` ⇒ a função pagina e entrega 1.300; alvo com `coleta_ate` vencido e extensão não avaliada (sem tempo) continua com `saiu_em` nulo; exceção da S3 num vídeo não derruba os outros (`try/catch` por vídeo).
- A13. Grafo de módulos: `watch/puro.ts` não carrega `sharp`, `@vercel/blob` nem `@supabase/*`.

**Integração (`HAS_LOCAL_DB`, banco `bythiago_int` 54421/54422):**
- B1. CHECK: `''`, `'   '`, dHash maiúsculo/curto, erro com título, `largura` sem `altura`, **`titulos_divergentes` com chave `texto` sumida, com a string `'null'` e com renderer vazio** → `23514` (`yt_watch_titulos_ok`); tabela de casos compartilhada com o teste do espelho Zod. **Sem nenhum 23514** para as 300 leituras do gerador de A11 passando por `paraLinhas` e `yt_watch_gravar_disparo`; **uma linha propositalmente inválida no meio de 16 não derruba as outras 15** (degrau de recuperação, §6.4); lote de 10 com uma `fora_do_formato` grava as 10.
- B2. RLS: `anon` sem `select`; editor de outro site não vê; teste que **forja o GUC** `app.site_id` como não-superusuário e não vê nada.
- B3. `yt_watch_gravar_disparo` atômica (falha no meio não deixa leitura sem alvo atualizado); upsert de miniatura repetida incrementa `vistas`, não duplica.
- B4. Poda: alvo com `saiu_em` há 31 dias perde leituras e miniaturas; há 29 dias não; `reter_ate` futuro protege; **alvo saído há 31 d com `reter_ate` posto pela extensão não perde leituras**.
- B5. Prova: os 4 motivos da prova (`leitura_bloqueada`, `layout_mudou`, `rodadas_faltando`, `sem_alvos`) acendem com dado sintético; **prova vermelha com a coleta ligada há > 24 h ⇒ aviso montado com `leitura_watch_vermelha` e poda `ok` com `prova_vermelha` no detalhe; segunda execução do mesmo período não repete o aviso; `p_coleta_ligada = false` (ou `coleta_desde` < 24 h) com alvos atrasados e tabela vazia ⇒ motivos de coleta `null`, sem aviso; tabela de leituras vazia, `leitura_watch` com execuções há 30 h e alvos com `proxima_rodada_em` atrasado ⇒ `rodadas_faltando` vermelho; tabela vazia, execuções há 30 h e candidatos > 0 com zero alvos ⇒ `sem_alvos` vermelho; zero execuções ⇒ motivos `null`** (r3, N9 e Phil R3); `sem_alvos` com candidatos > 0 e zero alvos (coleta ligada, execução há < 24 h) ⇒ vermelho direto.
- B6. Conciliação com `ab_tests` + `youtube_videos` semeados: alvo nasce com o id de 11 caracteres; `queued` entra; alvo de teste `draft` com 6 leituras `indisponivel` continua ativo; **alvo saído há 10 d + teste nosso novo ⇒ alvo ativo e devido**; `draft` com mais de 30 d fica de fora; **alvo `saiu_por = 'indisponivel'` com o vídeo ainda ≤ 30 d: 3 conciliações seguidas ⇒ continua saído, `rodadas` e `indisponivel_seguidas` inalterados; ganha teste nosso ⇒ reativa; alvo `removido` cujo vídeo voltou a `competitor_videos` ⇒ reativa** (tabela do §7).

**Produção (§16):** C7 a C11.

---

## 16. Conferências e lembretes

BRT = UTC − 3. "Controlador" = sessão da A5; leitura de produção por `supabase db query --linked` (se o modo automático negar, o controlador manda ao dono `bash <arquivo>.sh` com a mesma consulta).

| # | O quê | Quando (UTC / BRT) | Consulta ou comando exato | Quem | Se falhar |
|---|---|---|---|---|---|
| C0 | **Fixture HTML do qIg9 (A e B)** | **FEITA 18/10 18:50 UTC**: 6 páginas reais, 2 A e 4 B (§3, T9), em `~/portao-dhash/nativo-qIg9a7vqcNo/html/`; falta só o recorte sem `VISITOR_DATA` **e sem `remoteHost`** (A1). **Antes do commit das fixtures**, o controlador roda, no recorte e não na página original, `grep -c` do prefixo do IP do dono (fora do repo, sem imprimir o valor) e espera 0 (r3, Phil R1) | — | controlador | — (sem ramo de fixture sintética) |
| C1 | Sonda horária do Mac viva | 19/10 12:00 UTC / 09:00 BRT, e antes do P-V | `pgrep -fl sondar-paginas.sh; awk -F'\t' '$2=="hora" && $3=="watch"' ~/portao-dhash/nativo-qIg9a7vqcNo/titulos.tsv \| tail -6` | controlador | Morta: rearmar `nohup bash ~/portao-dhash/nativo-qIg9a7vqcNo/sondar-paginas.sh hora 50 3600 >> ~/portao-dhash/nativo-qIg9a7vqcNo/sondar-hora.out 2>&1 &` (só leitura, no Mac) |
| C2 | **E18 no qIg9**: a 1ª captura diária com o teste no ar não cria versão falsa | 19/10 12:30 UTC / 09:30 BRT (captura ~12:00 UTC) | `select day_pt, title, thumbnail_dhash from yt_own_video_meta_daily where youtube_video_id = 'qIg9a7vqcNo' order by day_pt desc limit 3;` e `select field, origin, value_text, thumb_dhash, thumb_similar, first_seen_at from yt_own_video_versions where youtube_video_id = 'qIg9a7vqcNo' order by first_seen_at;` | controlador | Título B na Data API: **reabre a emenda r5 do P-V** (§12) e avisa o A/B (muda a premissa "Data API só vê o oficial"; a fonte do oficial da S7 muda) e marcar a versão `fora_do_sistema` como falsa no ledger; miniatura nova com dHash 0–2 que não caiu em `thumb_similar`: defeito da âncora, conserto na E18 antes da S4 |
| C3 | **F2 D+1** (respostas de terceiros), pré-requisito do código da S4 | 19/10 17:00 UTC / 14:00 BRT (depois do 1º retrato, 16:00 UTC) | as 4 linhas "D+1" da Tarefa 8 de `docs/superpowers/plans/2026-10-17-a5-comentarios-f2-coleta-plan.md`, por exemplo `select count(*) from competitor_video_comments where parent_id is not null and not is_creator and speaker_no is null;` → `0` | controlador | Conforme o plano da F2; o código da S4 espera |
| C4 | **P-V** (§12), duas execuções em horas diferentes; rota no ar até 20/10 09:00 UTC por push próprio, **que espera o ok do dono** e o ok escrito da sessão do A/B | alvo 20/10, às HH:22 UTC; última 21/10 12:22 UTC / 09:22 BRT | `bash .superpowers/sdd/a5/tc/pv-rodar.sh` (a escrever no plano: `curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://bythiagofigueiredo.com/api/cron/watch-pv?v=qIg9a7vqcNo" -o .superpowers/sdd/a5/tc/pv-$(date -u +%Y%m%dT%H%M).json` + resumo + as 3 últimas rodadas do Mac; o JSON leva `VERCEL_REGION` e `x-vercel-id`) | controlador | §12: forja; inconclusivo = forja, escrito como inconclusivo |
| C5 | Fila de migration | antes do `db:new`; prazo **29/10 23:59 UTC** | `git fetch && git log --oneline origin/staging -- supabase/migrations \| head -5` (a Migration A do A/B tem de estar lá) | controlador | Migration A ausente: perguntar à sessão do A/B; sem resposta até 27/10, levar ao dono com a recomendação de Hanna |
| C6 | P0 depois do `db:push:prod` | logo após | `select relname, relrowsecurity from pg_class where relname in ('yt_watch_alvos','yt_watch_thumbs','yt_watch_readings');` (3 linhas, `true`) e `select count(*) from pg_constraint where conrelid = 'public.yt_watch_readings'::regclass and contype = 'c';` (**= 17**: 11 de coluna [`youtube_video_id`, `origem_rede`, `http`, `erro`, `idioma`, `titulo_oficial`, `titulo_oficial_fonte`, `titulo_exibido`, `renderers_presentes`, `titulos_divergentes` (o da função), `rendicoes_sqp`] e 6 de tabela; o plano reconta quando o DDL final fechar; r3, Phil R2) | controlador | Reaplicar é idempotente; RLS falsa = parar e consertar antes de ligar |
| C7 | **D+1 da coleta** (24 h depois de `OBS_WATCH_READ=on`) | data do deploy + 1 d, 12:00 UTC / 09:00 BRT | `select count(*) total, count(*) filter (where erro is not null) com_erro, count(*) filter (where erro is null and renderers_presentes = 0 and titulos_divergentes is null) sem_titulo, count(distinct youtube_video_id) videos, count(distinct rodada_id) rodadas from yt_watch_readings where lida_em > now() - interval '24 hours';` e `select public.yt_watch_prova(now());` | controlador | Esperado ≈ 12 × alvos leituras, `com_erro` < 10 %, `sem_titulo` = 0, prova sem vermelho; erro alto = P-V errado → desligar (`OBS_WATCH_READ` ≠ `on`) e ir à forja |
| C7-bis | **D+1 e D+7: linha de base do bloqueio** (r5, gatilho do §13) | junto da C7 e da C9 | `select count(*) filter (where titulo_oficial is null and not jogador_bloqueado and erro is null and titulo_exibido is not null) sem_of_sem_bloq, count(*) filter (where jogador_bloqueado) bloq, count(*) filter (where erro is null) sem_erro, count(*) filter (where erro is null and renderers_presentes >= 1) com_renderers from yt_watch_readings where lida_em > now() - interval '24 hours';` | controlador | `sem_of_sem_bloq = 0`; `bloq` perto de `sem_erro`; `com_renderers` perto de `sem_erro`. Fora disso, ou o gatilho do §13 (a, b, c): abrir a emenda da forja |
| C8 | Custo do Vercel D+1 | junto da C7 | página de uso do projeto (Functions: duração e CPU; Networking): o dia do deploy contra o anterior | dono (painel) | Entrada cobrada ou duração fora do incluído: reduzir K e levar ao dono |
| C9 | **D+7**: volume e qualidade | deploy + 7 d, 12:00 UTC / 09:00 BRT | `select pg_size_pretty(pg_total_relation_size('public.yt_watch_readings')), count(*), count(*) filter (where erro is not null) from yt_watch_readings where lida_em > now() - interval '7 days';` + `top_relations` de `obs_db_size_daily` do dia | controlador | Esperado ≈ 12.000 linhas, ≈ 3–3,5 MB (Vercel, ~245 B), erro < 10 %; acima de 2× → Phil refaz a conta antes de seguir |
| C10 | D+7: rodadas ilegíveis por teste (pedido de Phil r3) | junto da C9 | para cada vídeo com `provavel_teste`, `contagem.rodadasLongas` e `rodadasEmQuarentena` (script de leitura com o expansor) | controlador | > 0 sem explicação: defeito de agrupamento da coleta |
| C11 | Poda D+1 (rodou, mesmo sem apagar) | deploy + 1 d, depois das 08:00 UTC / 05:00 BRT | `select period_key, status, done_n, reason from competitor_agenda_runs where task = 'poda_leituras_watch' order by period_key desc limit 3;` | controlador | Sem linha: a tarefa não está no catálogo ou está desligada |
| C12 | **Primeira poda com linhas** | `select min(saiu_em) + interval '31 days' from yt_watch_alvos;` dá a data (~D+31) | `select count(*) from yt_watch_readings r join yt_watch_alvos a using (site_id, youtube_video_id) where a.saiu_em < now() - interval '30 days' and (a.reter_ate is null or a.reter_ate < now());` → `0` | controlador | > 0: a poda não roda ou não alcança; ver `reason` da C11 |
| P1 | **FEITA 18/10** (`.superpowers/sdd/a5/tc/medicoes-p1-p3.md`): `leitura_horaria` p50 2,6 s, p90 3,2 s, p99 4,4 s; passa (K = 16); falta só o atraso de partida do disparo, que o plano mede. Início das leves (§6.2): p50/p90/p99 da `leitura_horaria`, das leves 03–07 SP e folga da pesada | feita | a de `percentile_disc` do §6.2 | controlador | p90 do início da leve ≤ 50 s (K ≥ 14, 1.008/dia = 1,74 ×); senão o §6.2 troca por concorrência 4 ou menos rodadas para os concorrentes de 14 a 30 d, com a conta no plano |
| P2 | **FEITA 18/10**: 51 de 176 (29 %), `is_short` nunca nulo; decisão no plano (§7). Shorts em V (§7) | feita | `select count(*) filter (where is_short) shorts, count(*) total from competitor_videos where published_at > now() - interval '30 days';` (nome da coluna a conferir) | controlador | fração medida, decisão escrita no plano |
| P3 | **FEITA 18/10**: `active` 1, `archived` 1, `completed` 1; nenhum `draft` nem `queued` (§7). Rascunhos (§7) | feita | `select status, count(*) from ab_tests group by status;` | controlador | número de `draft`/`queued` |
| C7+ | D+1: estado da tarefa | junto da C7 | `select status, reason, count(*) from competitor_agenda_runs where task = 'leitura_watch' and started_at > now() - interval '24 hours' group by 1,2;` | controlador | maioria `ok`; nenhum `gravacao_falhou`; `parcial sobrou` < 10 % |
| C7+++ | D+1 e D+3: alvos reativados (r2, Phil N2) | junto da C7 e 2 dias depois | `select youtube_video_id, count(*) from yt_watch_alvos where saiu_por = 'indisponivel' group by 1;` estável, e `select count(*) from yt_watch_alvos where saiu_por is null and saiu_em is null and motivo_ate <> 'teste_nosso' and rodadas > 0 and indisponivel_seguidas >= 4;` → **0** (alvo ativo com 4 `indisponivel` e sem teste nosso é reativação indevida; r3, Phil R5) | controlador | Reativação em laço: defeito da tabela do §7 |
| C7++ | D+1: nenhuma linha envenenada (C1) | junto da C7 | `select erro, count(*) from yt_watch_readings where lida_em > now() - interval '24 hours' group by 1;` | controlador | `parser` = 0 e `fora_do_formato` = 0; senão ler o relato |

**Nota da C7 (Phil M3):** no deploy os ~145 alvos nascem devidos e, com K ≤ 16, levam ~9 disparos (~3 h) para esvaziar; a C7 e a primeira prova, se caírem nessas 3 h, mostram `alvos_atrasados > 0` sem defeito. Por isso `OBS_WATCH_READ=on` é ligado longe das 05:00 SP.

Lembretes no ledger da A5 (`.superpowers/sdd/a5/`): C1 a C4 com data fixa agora; C6 a C12 com data relativa ao deploy, preenchida no dia.

---

## 17. Riscos

| Risco | Efeito | Conserto |
|---|---|---|
| Vercel recebe robô ou braço fixo | coleta inútil ou "nada visível" falso | P-V antes do código; forja (§13) |
| YouTube muda o layout | títulos nulos em massa | `layout_mudou` vermelho; `versao_leitor` sobe com o parser novo; fixture HTML por versão |
| Bloqueio depois do P-V (dias depois) | `erro` cresce | disjuntor por disparo; `leitura_bloqueada` vermelho; desligar por variável sem deploy |
| P-V perde a janela (teste acaba antes) | não se prova a divisão no Vercel | inconclusivo = forja (decisão do dono); a S4 segue, na forja |
| Disputa de tempo no disparo | horária ou pesada atrasam | leve só começa até 70 s e dura ≤ 30 s; `ordem: 5.9`; K adaptativo; medição P1 antes do plano; gatilho de replanejar em §6.2 |
| Linha que o banco recusa | coleta inteira parada | espelho do banco + `fora_do_formato` + degrau de recuperação (§6.4) |
| Nenhum alvo (defeito de filtro) | coleta morta em verde | `sem_alvos` no disparo e na prova (§4, §10.2) |
| Migration perde a janela (30/10) | S4 sem tabela até a próxima janela | C5 com prazo 29/10; fila avisada |
| Lib S3 atrasa | — | resolvido: a lib está em `origin/staging` (`fe32b8976`) |
| Canal do concorrente removido pelo dono | leituras ficam até a poda | `saiu_por = 'removido'` na conciliação; poda em 30 d (D4, §18) |

---

## 18. Decisões abertas (com recomendação)

| # | Pergunta | Recomendação | Custo de cada lado |
|---|---|---|---|
| D1 | ~~Rota do P-V no push da S2~~ | **Caducou** (a S2 já foi, `main bdb21d7d9`). Vale o §12: push próprio da rota, que **espera o ok do dono**, e promoção com o ok escrito da sessão do A/B; alvo rota no ar até 20/10 09:00 UTC | — |
| D2 | **ABERTA, é do dono; este texto não decide.** Próprios antigos (o caso do qIg9: teste nativo do dono em vídeo de 2019 fora do A/B Lab) não entram com "≤ 14 dias". Incluir todos os próprios públicos a 1 rodada/dia? | Insumo, não decisão: Phil recomenda incluir (é o caso que originou a frente; a conta confere; a regra acende em ~2–3 dias com 1 rodada/dia). Hanna leva ao dono | Incluir: +105 leituras/dia, +~34 KB/dia, ~1 MB em regime, +~1,5 s por disparo. Não incluir: o caso que originou a frente não é coletado |
| D3 | `tetoTentativas` da `leitura_watch` | **Resolvida: 3** (os dois revisores; §4) | — |
| D4 | Canal de concorrente removido: apagar as leituras na hora ou em 30 d? | 30 d (padrão da S4; Phil de acordo: dado público de canal, sem dado pessoal) salvo se a E9 ("apagar pelo dono") exigir na hora; se exigir, a poda ganha o caminho `saiu_por = 'removido'` sem carência | Na hora: +1 caminho de apagar e teste |
| D5 | Entrar no arquivo mensal? | Não (cru, vida curta); Phil de acordo **desde que** o `reter_ate` do §7 guarde o que vale | Entrar: +volume no B2 sem leitor |
| D6 | Entrar na lista de acesso de IA (E17)? | Quando a S5 existir | Antes: superfície sem uso |
| D7 | **SUSPENSA na S4 (r5, decisão do dono 18/10).** Gravar `view_count bigint`? | O `videoDetails.viewCount` não vem no Vercel (player bloqueado): a coluna ficaria 100 % nula. Fica para a forja ou para a Data API (que já traz `viewCount` dos concorrentes). Os CHECKs voltam a 17 | Gravar agora: coluna que nunca enche, falha em verde. Suspender: perde-se o ponto diário de views de graça só se a coleta ficar no Vercel (a Data API cobre) |

---

## 19. Verificado × hipótese, e o que não conferi

- **[V]:** T1–T9; agenda, despachante e relógio em `origin/staging`; `lerCandidatos` com janela fixa; `probeThumb` herda dHash; `thumb-hamming.ts` sem sharp; tabelas `ab_tests` (status), `yt_own_video_meta_daily`, `yt_own_video_versions`, `obs_db_size_daily`; padrão de RLS da E14/E18; nenhuma região fixada em `apps/web/vercel.json`.
- **[H]:** H1 (Vercel), H2 (rede de entrada não cobrada), duração e CPU no Vercel (estimadas do Mac), V = 145 (127 medidos em 14/10 + estimativas), tamanho do banco hoje (último número de 14/10), se o HTML com verificação de robô mantém `og:title`, duração real da horária e das leves (P1), fração de Shorts (P2), região do Vercel e se ele cai em robô de player (é o P-V). A semântica de reabrir período `ok` na agenda deixou de ser hipótese (§4, [V]).
- **Não conferi:** nada no Vercel nem na forja; o banco de produção; `tipos.ts` real (o contrato é o §3 do spec do A/B); a árvore da A5 (`~/Workspace/wt-abentr`) além do plano das entradas; o checkout local está divergente de `origin/staging` (691/681 commits), por isso todo código foi lido de `origin/staging`.

---

## 20. Registro da r1

Divergências entre os dois revisores: estado de `bloqueado`/`layout_mudou` (Phil `parcial`, Yannis `erro`) vale `erro`, o mais estrito; código da linha que não cabe (Phil `parser`, Yannis `fora_do_formato`) vale `fora_do_formato`. Decisão do dono fora do texto: D2 (aberta), D7 (aberta), push da rota (espera o ok).

| Achado | Onde foi consertado |
|---|---|
| Phil C1 e Yannis C1 (linha envenenada) | §6.4: canonização em `paraLinhas`, `linhaCabeNoBanco`, `fora_do_formato`, degrau de recuperação vídeo a vídeo e `+20 min`; §8.1 (idioma BCP 47, etag 200, variante 100, espelho um a um); §5.3 (idioma sem concatenação cega); A11, B1 |
| Phil C2 e Yannis I6 (bloqueio e layout em verde, vermelho sem destino) | §6.3 (tabela de estados, disjuntor com consentimento, `feitas` só com título); §10.2 (`ChaveAviso` `leitura_watch_vermelha`, poda `parcial`); §9; A8, B5 |
| Phil C3 (nenhum alvo = ok) | §4 (`sem_alvos`, `ok` só com `alvos_ativos > 0`), §7, §10.2; A8, B5 |
| Phil I1 (sonda troca o código por `parser`) | §5.1, §5.4 (1ª leitura com `erro = null`); A3 |
| Phil I2 e Yannis I1 (teste nosso: `queued`, uuid, conflito, `indisponivel`) | §7 (linha "Teste nosso", conflito de chave, reativação, sem saída por `indisponivel`); B6 |
| Phil I3 (prova apagada antes da S7) | §7 (extensão grava `reter_ate = ultimaVista + 180 d`), §8.1; B4 |
| Phil I4 e Yannis I5 (capacidade e orçamento não medidos) | §4 (`ordem: 5.9`, `naoTerminouVermelhoEm: 6`), §6.2 (medição P1, aceite 1,5 ×), §6.3 (70 s e 30 s, teste de acoplamento); §16 P1 |
| Phil I5 e Yannis I4 (D1 caducou, q, região) | §1, §12 (push próprio que espera o ok do dono, ok da sessão do A/B, q = 0,65 ⇒ 2,6 %, `VERCEL_REGION`, teste da rota), §16 C4, §18 D1 |
| Phil I6 e Yannis M4 (3xx sem código, Shorts) | §5.3 (`redirecionado`), §7 (Shorts), §16 P2 |
| Yannis I2 (robô de player com título) | §5.3 (`jogador_bloqueado`), §8.1, §9, §12 (critério), A2 |
| Yannis I3 (P-V não testa a rajada) | §12 (fase 2 de rajada, duas execuções, plano se reprovar) |
| Yannis I7 (extensão sem veredito; corte de 1.000 linhas) | §7 (extensão, paginação, saída no mesmo passo, 4 vídeos); A12 |
| Yannis I8 (barril puxa `sharp`) | §4 (`puro.ts`, teste de grafo), §14; A13 |
| Yannis I9 (poda presa ao interruptor) | §4 (sem `ligaCom`, `schema_ausente`); A10 |
| Phil M1 (`VISITOR_DATA`) | §15 A1 (troca por `"X"` e teste do diretório) |
| Phil M2 (idempotência da forja) | §13 (`seq`, `unique (rodada_id, seq)`) |
| Phil M3 (ordem da poda, backlog do 1º dia) | §10.1, §16 (nota da C7), §4 (`OBS_WATCH_READ=on` longe das 05:00 SP) |
| Phil M4 (`viewCount`) | §8.1 (nota), §18 D7 (suspensa na r5) |
| Phil M5 (rascunho eterno) | §7 (`draft` ≤ 30 d), §16 P3 |
| Phil M6 / D3 / D2 / D4 / D5 | §4 (`tetoTentativas: 3`), §18 (D2 aberta sem decisão no texto; D4; D5 com `reter_ate`) |
| Yannis M1 (2h40) | §6.1, A5 |
| Yannis M2 (`IMAGEM_PADRAO_YT` em `imagem.ts`) | §4, §5.4 |
| Yannis M3 (S3 já em staging) | cabeçalho, §7, §17, §19 |
| Yannis M5 (parser sem regex, `no-store`, timeout no corpo) | §5.2 |
| Yannis M6 (gerador à mão, domínio do leitor, A7) | §8.2, A7 |
| Yannis M7 (rodada partida) | §6.3 |
| Yannis M8 / Phil fatos (C0 feita, fixture B real, plano B e `sharp`) | §3 (T9), §16 C0, A1, §13 |
| Emenda r5 do spec da detecção (texto fixo da S5, `try/catch` por vídeo, `em` só de `toISOString()`/`timestamptz`, erro de opção fora de `erro`) | §5.1, §7 (extensão), §14 |

### Registro da r2

Os consertos da r1 criaram defeitos novos; esta rodada releu §4, §5, §6, §7, §8.1, §9, §10, §12, §15 e §16 contra os números do §6.2 (K, 1,2 s, 3 s, 30 s, 70 s, 83 s, 580, 8,1) e do §10 (24 h, 0,5, 0,2, ≥ 6 tentativas). Consertos que atendem aos dois revisores: **capacidade (Phil N1 e Yannis N4)**, **laço da conciliação (Phil N2 e Yannis N2)**, **poda e prova vermelha (Phil N3 e Yannis N3)**.

| Achado | Onde foi consertado |
|---|---|
| Phil N1 e Yannis N4 (teto de 30 s, K ≤ 8, unidade 1,2 s ambígua, §6.2 com 13/6/2 antigos) | §6.2 refeito (unidades: 1,2 s **por vídeo** + 3 s fixos; tabela 20/45/50/55/60/70 s; aceite K ≥ 13, p90 do início ≤ 50 s; plano se não fechar: concorrência 4 ou menos rodadas, com a conta no plano; tempo de parede da rajada no P-V), fórmula do §6.3 sem o `÷ 3`, §12 (concorrência 1: K = 10, 720/dia), A8 (tabela de `K_agora` e `72 × K ≥ 870`), P1 |
| Phil N2 e Yannis N2 (reativação em laço) | §7 tabela `saiu_por` × motivo novo (só `teste_nosso` e `removido` + janela reativam; janela contra `indisponivel`/`janela` é `do nothing`), §9, B6, C7+++ |
| Phil N3 e Yannis N3 (poda `parcial` reabre; vermelho com a coleta desligada) | §10.1 (poda `ok` com `detalhe.prova_vermelha`), §10.2 (`p_coleta_ligada`, `primeira_leitura` > 24 h, canais: vigia da `leitura_watch` e aviso diário), §4, §8.1 (assinatura de `yt_watch_prova`), §9, B5, teste de `delete process.env.OBS_WATCH_READ` |
| Yannis N1 (`http`, `jogador_bloqueado`, `versao_leitor` sem caminho até `paraLinhas`) | §5.1 (`ResultadoLeitor` e `VERSAO_LEITOR`), §4, §5.3, A3, A7 |
| Phil N4 (`yt_watch_titulos_ok` fora do DDL) | §8.1 (função e CHECK no DDL, lista de funções), B1, C6 (≥ 15: a contagem real é 8 de coluna + 6 de tabela + 1; Phil escreveu 5 de tabela) |
| Phil N5 e Yannis N8b (`indisponivel` conta como bloqueio) | §6.3 (numerador e denominador sem `indisponivel`, ≥ 3 vídeos distintos), §10.2 (`indisponiveis_24h`), §9, A8 |
| Phil N6 e Yannis N8a (2,6 % é por execução) | §12 (2,6 % por execução, ~5,1 % para as duas) |
| Phil N7 (anti-`VISITOR_DATA` só pega maiúsculas) | A1 (regex `/visitor_?data"\s*:\s*"(?!X")/i` e `remoteHost`; conferência do `remoteHost` fica com o controlador) |
| Yannis N5 (A8 testava o que o disjuntor impede) | A8 (`sem_initial_data` no lugar de `consentimento`; consentimento testado no disjuntor), §9 linha 1 |
| Yannis N6 (sonda "na 1ª leitura sem erro") | §5.1 (opção `sondarMiniatura`), §5.4 |
| Yannis N7 (degrau com o banco fora do ar) | §6.4 camada 3 (só classe 23 e dentro de 83 s; transporte sem degrau), A8 |

### Registro da r3

Toque final: Phil e Yannis releem só os itens abaixo. Números conferidos no texto: K = 16 e 1.152/dia (P1), Shorts 29 % (51 de 176), 17 CHECKs (11 + 6), 580, 870, 5,1 %, 83 s e 70 s inalterados.

| Achado | Onde foi consertado |
|---|---|
| Phil R1 e Yannis N10 (`remoteHost` com o IP de casa nas 6 fixtures; repo público) | T9, A1 (troca por `"X"`, teste do diretório com as duas regex e IP, teste do teste), C0 (`grep -c` do prefixo do IP no recorte, antes do commit) |
| Phil R3 e Yannis N9 (prova cega com a tabela vazia) | §10.2 (`coleta_desde` = `min(started_at)` de `leitura_watch`; `sem_alvos` vermelho direto com coleta ligada, candidatos > 0 e alvos = 0 depois de ao menos uma execução; religar: plano escolhe, aviso D+1 aceito e dito), §9, B5 |
| Phil R4 (`sem_alvos` `parcial` × `erro`) | §6.3 (`parcial`, estado único), §10.2 ("estado diferente de `ok`") |
| Phil R2 (conta do C6) | C6 = 17 (11 + 6) |
| Phil R5 (C7+++ sem SQL) | C7+++ (consulta, esperado 0) |
| Yannis N11 (números da concorrência 4) | §6.2 (16 até ~52 s, 12 até ~56 s) |
| Yannis (linha `removido` × `janela_propria`) | §7 tabela: `removido` com `janela_propria` fica coberto pela linha `removido` × `janela_concorrente`, linha nova no §7 (`removido` × `janela_propria` = não reativa) |
| P1–P3 | §6.2, §7, §16: P1 passa (horária p90 3,2 s), Shorts 29 %, sem `draft`/`queued`; atraso de partida do disparo fica para o plano |
| Phil R6 | sem conserto (observação: o teto real é 70 s, o "90 s" é conservador) |

### Registro r5 (emenda do P-V, 18/10)

Decisão do dono ("Vamos seguir com a recomendação"); pareceres de Phil e Yannis em `.superpowers/sdd/a5/tc/parecer-emenda-pv-{phil,yannis}.md`. Nenhuma nova execução do P-V.

| Achado | Onde foi consertado |
|---|---|
| Phil C1 e A1 (critério: oficial ausente só com bloqueio, 30/30 e 48/48) | §12 (critério, desfecho, emenda), `pv-avaliar.mjs` (15/15), `pv-veredito.md` (reavaliação: passa, 0/78 nas duas) |
| Phil A2 (definição de `jogadorBloqueado` mais estreita que a medida) | §5.3 (igual ao `contar.ts`; motivo só no relato) |
| Phil C2 (linha do §9, prova no §10.2, DDL não muda) | §5.3, §9, §10.2, §12 (sem CHECK novo) |
| Phil C3 e A3, Yannis C1 (fonte do oficial é da S7; S4 não injeta a Data API) | §5.3, §12 (desfecho do oficial), §18/D-PV1, aviso à sessão do A/B |
| Phil C4 e Yannis C2 (fixture sem `videoDetails`/`og:title`; A11) | A2, A11 |
| Phil C4 e Yannis C4 (gatilho da forja, C7-bis em D+1 e D+7) | §13, C7-bis, C9, D-PV2 |
| Yannis C3 e Phil A4 (D7 sem objeto no Vercel) | §8.1, §18 D7 (suspensa; 17 CHECKs) |
| Phil A5 (volume cai) | §1, §8.3 (245 B, ~0,43 MB/dia, ~19 MB), §11, C9 |
| Reabertura | §12 e C2 (Data API vendo o braço B em 19/10) |
