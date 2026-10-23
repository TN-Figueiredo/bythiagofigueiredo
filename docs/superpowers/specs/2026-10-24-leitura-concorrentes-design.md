# Leitura dos concorrentes pelo título exibido (regra v2 da T13) — design

**r2.1, 24/10/2026. Acordo: Phil 91 SIM, Yannis 93 SIM, Hanna SIM (consertos C1–C5 aplicados).** r2.1 = pendências menores da re-revisão (`spec-r2-{phil,yannis}.md`), §13.

**r2.** r1 revisado por Phil (80, NÃO), Yannis (84, NÃO) e Hanna (84, SIM condicionado); pareceres em `.superpowers/sdd/ab-lab/leitura-concorrentes/spec-r1-{phil,yannis,hanna}.md`. O r2 aplica todos os achados; o registro está no §13.

Entrada: `.superpowers/sdd/ab-lab/leitura-concorrentes/solucao.md` (acordo Phil 90, Yannis 91, corte da Hanna). Decisões do dono D1–D3 tomadas em 23/10 conforme a recomendação ("Vamos prosseguir com as recomendações"). Este spec substitui, para a T13, a regra de inferência do §5.8 de `2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` ("Como se infere" e "Qual ficou"). O resto do §5.8 (tabelas, cursor, poda, purga, export, flag) continua valendo.

Evidência (pasta `.superpowers/sdd/ab-lab/leitura-concorrentes/`): `medidas.md`, `replay-ajuste.md`, `prototipo/replay_v2_mistas_hist.py` (regra de referência), `replay-resultado-mistas-hist-23-10.md`, `replay-23-10.csv` (export real), `yannis-export-replay.sql`, `rotulos-23-10.md`, `corte-hanna.md`.

## 1. Problema e solução

A sonda (`yt_watch_readings`) lê os vídeos dos concorrentes a partir do Vercel. Do IP de datacenter, o YouTube devolve a página "bloqueada" (`jogador_bloqueado = true`), e a regra v1 descarta essas leituras. Em produção, 0 dos 176 alvos elegíveis têm leitura.

Mesmo bloqueadas, 9.388 das 9.431 leituras trazem `titulo_exibido`, o título do renderer da página. Esse título é a **variante servida àquele espectador**, e 24 alvos mostram de 2 a 6 títulos alternando. `videoDetails.title`, `og:title` e a Data API devolvem sempre o título canônico. A variante de miniatura não é visível em nenhuma fonte gratuita.

**Solução.** A regra v2 lê o **título exibido** da leitura bloqueada e infere, por rodadas sobre o histórico do alvo, um destes estados: *teste em andamento*, *em andamento com versão sumindo*, *provavelmente terminou*, *troca*, *sem troca vista* ou *não medido*. Na miniatura, promete **só a troca definitiva**. Não há rede nova, Data API nova nem **migration**, e sonda e watch não mudam.

**Fora deste spec** (com gatilho, §10): reserva pela forja, leitura incremental, parser com várias ocorrências do renderer e tela.

## 2. Glossário

- **Rodada**: `rodada_id` da sonda. Hoje são 4 por dia (cadência de 6 h), com 3 leituras cada.
- **Rodada válida do campo**: rodada com ≥ 1 leitura válida do campo (§3.1). No título, conta só a leitura do idioma majoritário.
- **Versão**: título normalizado (`normalizarTitulo`) ou componente de dhash da miniatura (união com Hamming < `DHASH_MIN_TROCA = 10`, como hoje).
- **Versão qualificada numa janela**: vista em ≥ 2 rodadas daquela janela. Vista em 1 rodada só é blip e se ignora. "Versão do alvo", para teto e contagem, é a versão qualificada em alguma janela.
- **Rodada mista**: rodada em que aparecem ≥ 2 das versões qualificadas da janela avaliada.
- **Janelas**:
  - **W**: as últimas 8 rodadas válidas do campo.
  - **W⁻**: as 8 anteriores a W.
  - **W₋₁**: a janela de 8 que termina uma rodada antes de W.
- **Alvo ativo**: alvo concorrente com `saiu_em is null` e publicação há ≤ 30 dias.
- **Alvo aprendendo**: publicação há < 4 dias.
- **Canônico vigente** × **canônico histórico**: o título da Data API agora (`competitor_videos`) × qualquer valor que ele já teve (`competitor_field_versions`). Só a conferência do §8.2 os usa; a regra não usa nenhum dos dois.

## 3. A regra v2 (pura, em `observados/inferir.ts`)

### 3.1 Validade por campo

**Título**
- Uma leitura vale com `http = 200`, `erro is null`, `titulo_exibido is not null` e `idioma is not null`. `jogador_bloqueado` **não** invalida.
- Só vota o **idioma majoritário** do alvo: a maioria entre as leituras válidas; no empate, ganha o idioma da leitura mais recente, como já faz `maioria()`. Assim a tradução automática fica fora do voto (42 alvos tinham exibido ≠ Data API só por causa do idioma).
- Título suspenso pela guarda (§6.2) conta como leitura inválida.
- A fonte passa de `titulo_oficial` para `titulo_exibido`.

**Miniatura**
- Vale a thumb com `http = 200` e `dhash` não nulo, sem o placeholder 120×90, e só da variante dominante, como hoje. `jogador_bloqueado` não invalida.

### 3.2 Janela e mínimos

- W = as últimas **8** rodadas válidas do campo (~48 h a 4 rodadas por dia).
- W só conta como medida quando:
  - tem ≥ **6** rodadas (título) ou ≥ **4** (miniatura);
  - da 1ª à 8ª rodada passam ≤ **72 h**;
  - a última rodada tem menos de **`FRESCOR_H = 9 h`** em relação a `agoraMs`.
- W₋₁ e W⁻ exigem só o mínimo de rodadas (6 no título, 4 na miniatura), sem as 72 h e sem frescor, como o protótipo.
- Acoplamento declarado: `W = 8` ↔ `FRESCOR_H = 9 h` ↔ cadência de 6 h. Mudar a cadência exige refazer os três e as taxas do §3.6.

### 3.3 Detector (decisão sobre a condição P1 do Yannis)

**Decisão: caminho (b).** A regra é a do protótipo portada para TS: `qualificadas(janela)` mais a contagem de rodadas mistas, feitas em `inferir.ts`. `classificarTitulo` entra **só como teste de contrato** (§9.4).

**Motivo.** `classificarTitulo` foi feito para o próprio canal e liga os pares do histórico inteiro. Sobre o export real, em 5 dos 15 alvos em andamento ele devolve versões que já saíram de W (sonda do Yannis). Como decisor, ele mostraria como teste atual um título que já saiu. A regra (b) é a que tem prova.

**Fração de rodadas mistas.** Não entra; o absoluto do §3.4 basta. Yannis retirou por escrito a condição do AND: as frações reais vão de 0,33 a 1,0, e a prova foi feita sem ela.

`PADROES_DETECCAO`, `classificarTitulo` e as fixtures do próprio canal ficam **intocados**.

**Custo.**
- Agrupar por rodada é O(L).
- `qual` e `mistas` são O(R·v), com R = rodadas válidas e v ≤ 8 versões.
- A busca da última janela de teste (§3.5.2) é **O(R²·v) no pior caso**: R ≈ 19 hoje e ≤ 120 no fim da janela de 30 dias, ou seja, ~14 mil operações por alvo.
- Tudo isso é aceitável e fica declarado. Nenhuma leitura nova vai ao banco, fora a do §6.2.

### 3.4 Teste

**Teste** (estado *em andamento*) exige as duas condições:
1. em W há **≥ 2 versões qualificadas**;
2. o histórico do alvo tem **≥ 2 rodadas mistas** dessas versões (`MIN_RODADAS_MISTAS_HIST = 2`).

Uma troca limpa A→B não tem rodada mista e nunca vira teste. Na simulação, ela passa por sem troca → não medido → troca, com 0 "em andamento".

No título, isso é o estado **em andamento**. Na miniatura nunca há teste: o mesmo caso é **indeterminada** (§3.7).

### 3.5 Quando W tem uma versão só (X)

**Pré-condição.** W₋₁ precisa ter ≥ mínimo de rodadas e uma só versão qualificada, igual a X. Senão o estado é **não medido** (transição).

1. **Última janela de teste.** É a janela de 8 rodadas mais recente (deslizando para trás, terminando em cada rodada) que satisfaz o §3.4 com o histórico até o fim dela. As versões dela formam S.
2. **Título com janela de teste e S ≠ {X}.** Para cada Y ∈ S − {X}, Y precisa estar ausente há **R ≥ ⌈ln α / ln(1 − min(q; 0,999))⌉ rodadas**, com α = 0,0005.
   - q = fração de rodadas com Y no **período de Y**: da 1ª à última rodada com Y, estendido para trás até ter no mínimo **16 rodadas**.
   - A trava em 0,999 é obrigatória. Sem ela, q = 1 dá `ln 0 = −∞` e a exigência some. Com ela, o mínimo é R ≥ 2. A pré-condição (W e W₋₁ só com X) já garante Y em ≤ 1 das últimas 9 rodadas.
   - Se todas as Y cumprem, o estado é **provavelmente terminou, ficou X**. Se alguma não cumpre, é **em andamento, versão sumindo**.
   - O estado é reversível: se Y volta, ele volta a *em andamento*.
   - Como no protótipo, X não precisa estar em S: um teste A/B seguido de troca manual para C vira "provavelmente terminou, ficou C" (semente no §9.2).
3. **Sem janela de teste, ou miniatura.** Olha-se W⁻ **depois da carência**, tirando as rodadas que começam antes de publicação + 24 h.
   - W⁻ abaixo do mínimo → **não medido**.
   - W⁻ = {X} → **sem troca vista**.
   - W⁻ = {Y}, Y ≠ X, e Y ausente há R rodadas pela mesma fórmula, mas com **q sobre W⁻** (não sobre o período de Y, como no protótipo) → **troca Y → X**.
   - Na miniatura, W⁻ com uma versão qualificada diferente que ainda não cumpriu R → **indeterminada**.
   - Qualquer outro caso → **não medido**.
   - Sem piso extra para R na troca (Phil N4, decidido pelo controlador): a pré-condição (W e W₋₁ só com X, W⁻ = {Y}) já deixa Y fora de ≥ 7 das últimas 8 rodadas, e a simulação da troca limpa (troca 7 rodadas depois) foi feita assim. Mudar o piso exigiria refazer a prova.
4. **Sem versão qualificada em W, ou com ≥ 2 versões sem rodada mista no histórico** → **não medido** (transição).

A carência de 24 h vale **só** para a "versão antes" da troca. O teste não tem carência, porque o YouTube testa desde a publicação.

### 3.6 Taxas que a regra garante (simulação, `replay-ajuste.md`)

**"Provavelmente terminou" falso com o teste ainda vivo**

| Pesos | Falso no fim | Falso em algum momento (se desfaz) |
|---|---|---|
| 50/50 | 0,0% | 0,0% |
| 80/20 | 0,1% | 3,3% |
| 90/10 | 0,6% | 6,0% |
| 95/5 | 1,1% | 7,4% |

**"Terminou" verdadeiro.** A mediana depois do fim do teste vai de 8 rodadas (2 dias) em 50/50 a 24 (6 dias) em 95/5. Em 95/5, 29% não são detectados em 60 rodadas.

**Título único com 1% de blip da mesma variante (pior caso):** "em andamento" falso em 2,0% no fim.

As taxas **supõem leituras independentes, o que não foi verificado.**

### 3.7 Miniatura

- Só **troca definitiva** (§3.5.3).
- **Indeterminada** grava linha só com **≥ 2 componentes qualificados**: alternando em W (o que no título seria teste) ou W⁻ ≠ W sem cumprir R.
- A **mudança pequena** (Hamming de 7 a 9, um componente só) **não grava linha**. Ela conta em `obs_indeterminadas`, como hoje, e a leitura mostra *sem troca vista*. Gravá-la violaria `n_versoes >= 2`, o upsert lançaria e o alvo voltaria à fila a cada disparo.
- `possivel_teste_youtube` na miniatura é **proibido por tipo** (§5), **por asserção** no ponto de montagem do `Observado` (lança) **e por teste**. Texto ao dono (D3): "o teste de miniatura dos concorrentes não é visível para nós".

### 3.8 Estados fora da regra (A3 do Phil)

- **Aprendendo**: alvo com publicação há < 4 dias e cursor `validas_titulo = 0`. É *não medido* com motivo `aprendendo`, contado à parte no alarme e na cobertura.
- **Fora da janela**: alvo que saiu com `saiu_por = 'janela'` (publicação + 30 d). Mantém o último estado, com a data. O frescor **não** o derruba para *não medido*, e ele também é contado à parte.

## 4. Gravação, sem migration

`OBS_REGRA_VERSAO = 2`. Grava-se linha em `ab_native_observados` só quando há algo a dizer além de "sem troca vista".

| Estado | Campo | `veredito` | `ficou_estado` | `tipo_troca` |
|---|---|---|---|---|
| em andamento (e sumindo) | título | `possivel_teste_youtube` | `em_andamento` | `alternada` |
| provavelmente terminou, ficou X | título | `possivel_teste_youtube` | `estavel` | `alternada` |
| troca Y → X | título ou miniatura | `troca_observada` | `estavel` | `sequencial` |
| indeterminada | miniatura | `troca_observada` | `em_andamento` | `alternada` |
| em andamento ou indeterminada de alvo que saiu | os dois | (mantido) | `sem_desfecho` (fechamento atual do `passo.ts`) | (mantido) |

**Invariantes** (testadas):
- o título nunca grava `troca_observada` + `em_andamento`;
- a miniatura nunca grava `possivel_teste_youtube`.

Com isso, a leitura distingue *indeterminada* de *em andamento* sem coluna nova.

**`trocas`**
- Um item por **versão do alvo** (não por corrida), na ordem da 1ª vista: `{ v, ref, primeira_vista, ultima_vista, leituras, rodadas }`.
- **Teto de armazenamento: 8 versões.** O máximo medido é 6 (`lnPfS9BCC_M`). Acima de 8, gravam-se as 8 com `ultima_vista` mais recente, `n_versoes` fica com o total real e `ficou.versoes_omitidas = n − 8`. A decisão segue normal (ela usa só W, que tem no máximo 4 qualificadas), e `obs_versoes_demais` conta o caso.

**`ficou`** (< 4 KB por linha, testado com 8 versões de 300 caracteres)
- Título: `{ titulo, versoes: [{ v, rodadas_em_w, ultima_vista }], sumindo, mistas_hist, janela_teste: { de, ate } | null, versoes_omitidas }`.
- Miniatura: `{ dhash, versoes: [...], versoes_omitidas }`.
- `rodadas_em_w` é o número de rodadas de W com aquela versão, **contado nas passagens da sonda** (nunca é uma fração de público).
- `mistas_hist` guarda "já teve ≥ 2 rodadas mistas" para quando a leitura passar a olhar só as últimas 60 rodadas (dívida do §10). Sem isso, troca antiga e teste antigo ficariam iguais.
- O tipo `Observado.ficou` muda para uma interface por campo, porque o `Record` de hoje não comporta arrays.

**`primeira_troca_em`**: `primeira_vista` da 2ª versão em ordem de 1ª vista, no histórico inteiro. É determinístico: rodar duas vezes dá o mesmo valor.

**Reavaliação**
- `agora` é capturado **uma vez**, no topo da avaliação de cada alvo, e usado na linha e no cursor (hoje `passo.ts` chama `c.agora()` de novo ao gravar o cursor; sem isso a comparação do §5 passo 7 nunca vale). Teste com relógio que avança entre as duas gravações.
- Quando a regra emite linha: upsert com `ultima_atualizacao_em = agora`, e o cursor é gravado com `avaliado_em =` **o mesmo `agora`**. É isso que permite à leitura saber se a linha descreve a avaliação mais recente (§5).
- Quando a regra diz *sem troca vista* ou *não medido*: a linha anterior fica intocada (uma troca que aconteceu continua registrada), e o cursor é gravado com o novo `agora`. A linha passa a ser **não atual**.

**Cursor**
- `validas_titulo` e `validas_miniatura` passam a significar "rodadas válidas de W usadas na decisão". **0 significa que a regra devolveu não medido**, por qualquer motivo, inclusive a guarda.
- Em `estado-de-leitura.ts` e no contador `obs_sem_leitura_valida` (`passo.ts`), a comparação com `VALIDAS_MIN_MEDIDO` passa a ser `> 0`.

**v1**: 0 cursores e 0 linhas em produção (a flag nunca foi ligada), então não há nada a migrar. A leitura trata linha com `versao_regra < 2` como ausente.

## 5. Leitura: `estadoDeLeitura` por campo

`estado-de-leitura.ts` passa a devolver um tipo por campo, de modo que o compilador barre o que hoje só a asserção barra:

```ts
type Motivo = 'flag_off' | 'aprendendo' | 'sem_leitura' | 'sem_publicacao' | 'saiu' | 'regra'
type EstadoTitulo =
  | { estado: 'em_andamento'; sumindo: boolean; versoes: VersaoLida[]; desde: string; ate: string }
  | { estado: 'provavelmente_terminou'; ficou: string; sumidas: VersaoLida[] }   // reversível
  | { estado: 'troca'; antes: string; depois: string; entre: { de: string; ate: string }; vistoAte: string }
  | { estado: 'sem_troca_vista'; desde: string }
  | { estado: 'nao_medido'; motivo: Motivo; ultimo?: EstadoTituloBase; vistoAte?: string }
  | { estado: 'fora_da_janela'; ultimo: EstadoTituloBase | null; vistoAte: string }
type EstadoMiniatura = /* troca | indeterminada | sem_troca_vista | nao_medido | fora_da_janela, com a mesma forma */
```

`EstadoTituloBase` é o tipo sem `nao_medido` nem `fora_da_janela`.

**Entrada**
- A linha de cada campo (`veredito`, `ficouEstado`, `ficou`, `trocas`, `versaoRegra`, `motivo`, `ultimaAtualizacaoEm`).
- `alvo`: `rodadas`, `ultimaRodadaEm`, `saiuPor`, `publicadoEm`.
- `cursor`: `avaliadoAteRodada`, `avaliadoEm`, `motivo`, `validas*`.
- `flagLigada` (booleano; quem lê o env é `modoTrocasConcorrente`), `agoraMs`, `frescorMs`.

**Ordem** (a primeira que casa decide):
1. Flag off → `nao_medido/flag_off`.
2. `saiuPor = 'janela'` → `fora_da_janela`. O `ultimo` é o que os passos 7 e 8 dariam: `sem_desfecho` + `possivel_teste_youtube` vira `em_andamento`, e `sem_desfecho` + `troca_observada` na miniatura vira `indeterminada`. Alvo sem linha dá `ultimo = sem_troca_vista`, ou `null` se `validas = 0`. `vistoAte = ultimaRodadaEm`.
3. Alvo ausente, `saiuPor` diferente de `'janela'` (inclusive `alvo_podado`), ou linha `sem_desfecho` com `motivo ≠ 'janela'` → `nao_medido/saiu`, com `ultimo` quando há linha.
4. Cursor com `motivo = 'sem_publicacao'` → `nao_medido/sem_publicacao`.
5. Cursor ausente com publicação há < 4 dias → `nao_medido/aprendendo`. Alvo sem rodada fresca (`agoraMs − ultimaRodadaEm > frescorMs`), cursor ausente, ou cursor fora de dia (`avaliadoAteRodada < rodadas − 1` e `agoraMs − avaliadoEm > frescorMs`, a defesa de hoje) → `nao_medido/sem_leitura`, com `ultimo` e `vistoAte` quando há linha.
6. `validas_campo = 0` → `nao_medido/aprendendo` (publicação há < 4 dias) ou `nao_medido/regra`, com `ultimo` quando há linha.
7. Linha v2 **atual** (`ultimaAtualizacaoEm >= cursor.avaliadoEm`) → o estado da linha.
8. Linha v2 não atual que seja troca (`troca_observada` + `estavel` + `sequencial`) → `troca`, com `vistoAte`. A troca é evento passado e continua valendo.
9. Senão → `sem_troca_vista`.

Os motivos `suspenso` (guarda) e `versoes_demais` não existem na leitura. A guarda resulta em `regra`, e `versoes_demais` deixou de ser *não medido* (§4). Dívida no §10: o motivo fino da leitura inconclusiva.

**`estavel` é reversível**, e isso fica escrito no contrato que Cowork e F2 leem. "Provavelmente terminou" pode voltar a "em andamento" na rodada seguinte. "Troca" quer dizer apenas que a versão anterior não voltou até `vistoAte`.

A tabela-verdade completa vira teste (§9.5).

## 6. Defesas (falha em verde)

### 6.1 Alarme de degradação

É uma parte nova de `avisos_pendentes` (09:00 BRT), com `try/catch` próprio, depois das partes existentes. A falha dela não reprova o lembrete do dia 14 nem o outbox do nicho.

**O que avalia.** O **dia BRT anterior** D, `[D 00:00, D+1 00:00)` calculado com `America/Sao_Paulo` (não com −3 h fixo), sobre os alvos **ativos e não aprendendo**. Ficam fora da conta os alvos fora da janela e os aprendendo.

**Leitura.** Colunas `youtube_video_id, rodada_id, http, erro, titulo_exibido, idioma` (o canal vem do mapa de `competitor_videos.competitor_channel_id`, para a função do aviso da guarda), em lotes de 100 ids (usa o índice `(youtube_video_id, lida_em)`). São ~2.000 leituras estreitas por dia (medido de 1.986 a 2.049), uma vez por dia, mais o mesmo para D−1.

**Disparo.** Vale a 1ª condição que casar:
1. Há ≥ 1 alvo ativo e **0 leituras** no dia: dispara com "sonda sem leitura de concorrentes ontem". Sem esta condição, 0/0 calaria o alarme no pior caso.
2. Leituras sem título utilizável (§3.1) acima de **20%** das leituras do dia.
3. Alvos sem leitura acima de **10%** dos ativos. Alvo sem leitura é o alvo ativo não aprendendo com **0 rodadas com leitura válida de título no dia** (o esperado são 4).

**Idempotência, expiração e 2º dia**
- Chave do aviso: `dedupKey = 'obs-degradada:' + D` (índice único `idx_notifications_dedup (site_id, user_id, dedup_key)`). Rodar a parte duas vezes no mesmo dia manda um aviso só.
- Quando a condição de D é falsa, expiram-se os `obs-degradada:*` ainda abertos do site, no mesmo padrão de `expired_at` de `avisos-pendentes.ts`.
- `obs-titulo-suspenso:*` expira pela mesma regra: no 1º dia em que `titulosSuspensos` de D sai vazio.
- A condição 3 (10% dos ativos sem leitura) é estimativa: a base dela não foi medida; o ensaio a seco do §8.0 a mede antes de ligar, e o limiar não se relaxa depois.
- O "2º dia seguido" é recalculado sobre D−1 pela mesma função pura, sem estado guardado.
- `fan.total === 0` vai para o `Sentry`, como no lembrete.
- A base medida hoje fica entre 0,8% e 6,8% por dia.

**Textos**
- 1º dia: "Leitura dos concorrentes degradada ontem: 34% das leituras sem título. Os estados de título podem ficar 'não medido'. Se continuar, a leitura de títulos dos concorrentes para até construirmos a leitura pela forja (hoje ela não existe)."
- 2º dia seguido: acrescenta "2º dia seguido: é o gatilho para construir a leitura pela forja."

### 6.2 Guarda de título repetido (placeholder): checagem cruzada por versão

**Quando roda.** No `passo.ts`, **antes do upsert de toda linha de título** (≈ 17 dos 176 alvos hoje).

**O que confere.** Cada versão citada em `trocas` (no máximo 8) é procurada nas leituras de **outros** alvos concorrentes do site, com o mesmo texto bruto de `titulo_exibido`, no período da versão ± 24 h:

```ts
sb.from('yt_watch_readings').select('youtube_video_id')
  .in('youtube_video_id', <alvos concorrentes do site, lotes de 100>).neq('youtube_video_id', <alvo>)
  .eq('titulo_exibido', <texto bruto>).gte('lida_em', primeira_vista − 24 h).lte('lida_em', ultima_vista + 24 h).limit(1000)
```

A consulta usa o índice `(youtube_video_id, lida_em)`. Os vídeos são **deduplicados no cliente** (um vídeo com muitas leituras não pode esconder o segundo). Se a consulta bater o teto de 1000 linhas, a versão é tratada como placeholder (conservador) e conta em `obs_titulo_suspenso`.

**Quais versões.** Todas as versões qualificadas do alvo, não só as que cabem nas 8 de `trocas`.

**O que conta como placeholder.** A versão vista em **≥ 2 outros vídeos**, ou em **≥ 1 vídeo de outro canal**. O canal vem de `competitor_videos.competitor_channel_id`, mapa que `publicacoes()` já monta.

**O que acontece com ele**
- As leituras do placeholder saem do voto **desse alvo** (§3.1), em todo o histórico, e a regra roda de novo para o alvo, só em memória. A nova saída pode citar versão ainda não conferida: regra e conferência se repetem até nenhuma versão nova aparecer, com **teto de 3 iterações**; no teto, nada é gravado e o cursor fica com `validas_titulo = 0`.
- O contador `obs_titulo_suspenso` sobe.
- Se o resultado for *não medido*, o cursor grava `validas_titulo = 0`.
- Como a checagem acontece a cada emissão de linha, o placeholder nunca entra numa linha gravada, nem no dia seguinte, nem dias depois via "última janela de teste".

**Custo.** ≈ 17 alvos × ~3 versões × 4 avaliações por dia × 2 lotes de 100 ids ≈ **400 consultas por dia**, cada uma com ≤ 1000 linhas de uma coluna (tipicamente 0). Com 3× canais, ≈ 1.200 a 1.800. Nada roda em disparo sem linha a emitir.

**Aviso.** A função pura `titulosSuspensos(leiturasDoDia)` (título normalizado em ≥ 3 vídeos, ou em ≥ 2 vídeos de canais distintos) roda na parte do §6.1, sobre as leituras de D que ela já leu, sem custo a mais. A chave é `dedupKey = 'obs-titulo-suspenso:' + D`. Texto: "Leitura de título suspensa ontem em 5 vídeos: o mesmo título apareceu em vídeos diferentes (provável falha da página do YouTube). Nada foi gravado com esse título."

**Caso legítimo medido.** `Main AD Diamante 2 - Lolzin raiz!` aparece em 2 vídeos do mesmo canal e não dispara.

**Residual declarado.** A checagem é por texto bruto, então um placeholder que varie em espaço ou caixa escapa; e um placeholder que coincida com o título de **um só** outro vídeo **do mesmo canal** passa (é o caso legítimo `Lolzin`). Medido hoje: 0 casos.

### 6.3 Outros riscos

| Risco | Defesa |
|---|---|
| Título de outro vídeo no renderer | medido 0 em 26 títulos de baixa partilha; a checagem do §6.2 pega o caso que aparece em outro alvo; regressão com semente (§9.2) |
| Tradução automática | só vota o idioma majoritário; o §8.2 compara o evento, não o texto |
| "Provavelmente terminou" falso | estado reversível, texto "pode reabrir", taxas do §3.6 |
| Volume | por alvo, ≤ 30 d × 4 × 3 = 360 leituras = 1 página; capacidade de 50 alvos/disparo × 18 disparos por rodada de 6 h = 900 avaliações por rodada, contra 176 hoje e 528 com 3× canais; banco em 138 MB |

## 7. Envios

### Envio A (código, com a flag **off**)

**O que entra**
- regra v2 em `inferir.ts`;
- `titulo_exibido` e `idioma` no `select` de `passo.ts`;
- guarda do §6.2;
- `estadoDeLeitura` por campo;
- alarme e aviso da guarda em `avisos_pendentes`;
- script de ensaio a seco (§8.0);
- testes do §9.

**Quando.** Na promoção de **25/10** (24/10 é só da F3), se spec, plano e código passarem pela revisão até a véspera. Senão, vai na promoção seguinte.

**Nada se perde na espera.** A inferência recalcula a partir do bruto desde 19/10, que fica guardado até 30 dias depois da saída do alvo. A 1ª poda do bruto fica por volta do fim de novembro (*conferir a data no plano*). Se o envio A escorregar para perto dela, ele vira prioridade.

### Ligar a flag

O controlador liga a flag a partir do D+1 do envio A, quando os critérios **de entrada** do §8 passarem, sem relaxar nenhum depois de ver o número. Ligar a variável no Vercel pede um build, que entra na conta de builds do dia (≤ 3 por terminal até 27/10).

Os critérios **de permanência** são conferidos com a flag ligada. Se algum falhar, a flag volta a off no mesmo dia.

### Envio B: leitura no Cowork (D1)

**Não depende da flag.** Com a flag off, a resposta é "Leitura de concorrentes desligada" (motivo `flag_off`), nunca uma lista vazia. Entra na mesma promoção de A se plano e código ficarem prontos; senão, na seguinte.

**Forma.** É uma ação só de leitura: um `GET` no domínio `youtube` da pipeline e a mesma ação na tool MCP `youtube_observatory`, as duas pela **mesma função**, para dar o mesmo número no Cowork e no Claude Code. Segue a "Pipeline Integrity" do `CLAUDE.md`: registro, `endpoint_count` e doc do domínio.

**Resposta**
1. Uma linha de resumo: "N vídeos de concorrentes observados: X com possível teste em andamento, Y provavelmente terminados, Z trocas, W não medidos (motivos)".
2. A lista dos estados em andamento, sumindo, provavelmente terminou e troca dos últimos 14 dias. Cada item traz canal, vídeo, estado, o texto do §11 e "visto até".
3. *Sem troca vista* e *não medido* aparecem só na contagem.

**Regra para o Cowork, na doc do domínio**
- Repetir o texto do §11 sem reescrever.
- Nunca tirar "possível" nem "provavelmente".
- Nunca dizer "venceu".
- "Não medido" nunca vira 0 nem "não testou".
- "Provavelmente terminou" pode reabrir.

Depois de editar a doc, rodar de novo o seed da referência do Cowork.

**Chave.** É por pessoa, e o plano confirma que o caminho por pessoa já existe. Se não existir, o B espera; a chave permanente nunca é usada no Claude Code.

### 7.1 O que o dono vê e quando

| Momento | O que muda para o dono | O que ele faz |
|---|---|---|
| Envio A no ar (25/10, flag off) | **Nada visível.** | nada |
| Envio B no ar, flag off | O Cowork responde "leitura de concorrentes desligada". | nada |
| Flag ligada (≥ 26/10) | O sino pode mostrar o aviso de degradação ou de título suspenso, no máximo 1 de cada por dia. | se o aviso vier 2 dias seguidos, decide se constrói a forja |
| B no ar e flag ligada | No Cowork ou no Claude Code, a pergunta "quais concorrentes estão testando título agora?" devolve a lista (no replay de 23/10 seriam de 14 a 17 vídeos), com o mesmo número nos dois. | pergunta e confere |
| D+7 e D+14 da flag | As trocas perdem o "ainda não conferida", ou ficam com "não provado". | nada |

## 8. Critérios

### 8.0 Ensaio a seco (flag off)

O envio A traz um script só de leitura, `scripts/obs-dry-run.ts`:
- **Entrada:** um export do bruto de produção, no formato de `yannis-export-replay.sql`, que o controlador roda por `supabase db query --linked`.
- **Processamento:** roda `inferir.ts` real, inclusive a guarda do §6.2 sobre o próprio export, e `estadoDeLeitura`.
- **Saída:** por alvo, o estado e o texto do §11, mais a cobertura e os títulos suspensos.

É o mesmo carregador do replay de CI (§9.1); só muda a entrada. Nada é gravado.

### 8.1 Critérios de entrada (ligar a flag)

1. **Cobertura** (ensaio do dia): ≥ 90% dos alvos ativos com ≥ 8 rodadas têm título medido, e ≥ 80% têm miniatura medida. Aprendendo e fora da janela contam à parte. Hoje: 154 de 162.
2. **Contaminação**: 0 título de outro vídeo no ensaio (nenhuma versão emitida aparece em ≥ 2 outros vídeos), mais a regressão com semente.
4. **Gio no YouTube**: de 5 a 10 vídeos *em andamento* e todos os *sumindo* **do ensaio do dia**, incluindo os IDs de 23/10 que ainda estiverem ativos (`2emVR-6NEmM`, `FxP6Yzehs3k`, `pilQupJKe2o`, `TtjDltoXhqI`, `bY2q7zTwep4`; sumindo `AKKb2Oz77fw`, `xQcKF7hVts0`, `iqTrdmtqCCg`), mais 5 miniaturas indeterminadas. Todos têm de bater, 100%. `8fi8uOPOJA8` entra quando virar troca.
5. **Falha visível**: alarme e guarda testados com semente (§9.2), e o ensaio do dia abaixo do limiar.
7. **Tamanho**: banco < 400 MB e projeção de 3× < 450 MB. As tabelas da T13 crescem ~0,5 a 1,3 MB por ano (≈ 4 MB com 3× canais).
8. **CI**: os testes do §9, verdes.

### 8.2 Critérios de permanência (flag ligada; falhou = flag off no mesmo dia)

6. **Orçamento**: no 1º dia ligado, `obs_sem_tempo = 0` em ≥ 90% dos disparos, `obs_devidos ≤ 50` e `obs_falhou = 0` às 23:59 BRT.
3. **Data API, por evento**:
   - Toda troca ou "provavelmente terminou" tem versão nova em `competitor_field_versions` a < 12 h do evento.
   - Toda versão nova da Data API aparece na watch em ≤ 3 dias.
   - Compara-se o **evento** (a data), nunca o texto.
   - Confere-se em D+7 e D+14. Até lá, a troca e o "provavelmente terminou" carregam "ainda não conferida".
   - Com < 5 eventos em D+14, registra-se "não provado" e o rótulo fica.

**Conferência da cobertura em produção** (D+1 ligado; esperado ≥ 0,90 e ≥ 0,80):
```sql
select round(avg((k.validas_titulo > 0)::int)::numeric, 3) as titulo, round(avg((k.validas_miniatura > 0)::int)::numeric, 3) as miniatura, count(*) as alvos
  from yt_watch_alvos a join ab_native_obs_cursor k using (site_id, youtube_video_id)
 where a.tipo = 'concorrente' and a.saiu_em is null and a.rodadas >= 8
   and not exists (select 1 from competitor_videos v where v.video_id = a.youtube_video_id and v.published_at > now() - interval '4 days');
```

### 8.3 Em linguagem do dono

- **Envio A pronto.** A CI está verde com o replay dos 35 vídeos rotulados (0 divergências). Um teste prova que a miniatura nunca sai como "possível teste", e outro prova que um dia sem leitura dispara o aviso. Em produção, com a flag off, nada novo é gravado. Quem confere: CI e controlador.
- **Flag ligada.** O ensaio do dia mostra pelo menos 90% dos vídeos ativos com título lido e 80% com miniatura, e nenhum título que pertença a outro vídeo. A Gio abriu no YouTube os vídeos em andamento e sumindo, e todos batem. Quem confere: controlador e Gio.
- **Envio B pronto.** A mesma pergunta no Cowork e no Claude Code devolve a mesma contagem e os mesmos vídeos, com "possível" em todo teste. Com a flag off, a resposta é "leitura desligada". Quem confere: o controlador, pelos dois caminhos; o dono confirma uma vez.

### 8.4 O que está provado e o que não está (P2 do Yannis)

- **Dado real.** 0 divergências em 35 alvos: 25 rotulados (5 deles ambíguos, aceitos pelo rótulo) e 10 de título único sorteados.
- **Os 22 *não medidos* do replay.** 14 estão fora da janela, 7 são aprendendo e 1 é falta de 2 janelas seguidas. Entre os ativos, o não medido é ~5%, todo de vídeo novo.
- **Sem exemplo real.** Não há exemplo real de troca 1→1 de título nem de "provavelmente terminou" com a regra final (`6MYeq9cWCT8` testou só em 19/10, fora das janelas). Os dois estão provados só por simulação.
- **Prazo do "provavelmente terminou".** Mediana de 2 dias (50/50) a 6 dias (95/5) depois do fim do teste.

## 9. Testes (CI, sem banco)

1. **Replay em TS sobre o export real.**
   - Fixture JSON com os 35 alvos: recorte de `replay-23-10.csv`, só com as colunas usadas (o CSV inteiro não entra no repo).
   - `agoraMs` = maior `lida_em` da fixture.
   - Esperado: os estados do `replay-resultado-mistas-hist-23-10.md` (0 divergências) e 0 teste ou troca nos 10 alvos de título único.
2. **Sementes** (relógio relativo, sem ano fixo):
   - troca limpa A→B: nunca vira teste, e a troca sai 7 rodadas depois;
   - Y em 100% de W⁻ e 1 blip de Y em W: não é troca enquanto R < 2;
   - Y presente em todas as rodadas do período: a trava em q funciona;
   - teste A/B seguido de troca manual para C: "provavelmente terminou, ficou C";
   - 2 idiomas: só a maioria vota, e o empate vai para o mais recente;
   - miniatura com Hamming 8: 0 linhas, cursor gravado, `obs_falhou = 0`;
   - placeholder P em 5 vídeos em 2 rodadas na virada do dia, avaliado em D+1 e D+3: 0 linhas com P em `trocas`;
   - caso `Lolzin` (2 vídeos, mesmo canal): não suspende;
   - um vídeo com 1000+ leituras do placeholder e um 2º vídeo: suspende (dedup no cliente e teto);
   - re-execução que cita versão nova não conferida: confere de novo; 3 iterações sem estabilizar → nada gravado, `validas_titulo = 0`;
   - relógio que avança entre linha e cursor: a linha continua "atual";
   - alvo de 31 dias: fora da janela, não conta no alarme;
   - dia sem leitura: dispara;
   - leitura sem erro e sem título: entra na conta dos 20%;
   - parte do alarme rodada 2× no mesmo dia: 1 chave; em dois dias: 2 chaves; dia abaixo do limiar expira a anterior (`fanOut` injetado por `DepsAvisos`).
3. **Simulação com semente fixa**: PRNG com semente (mulberry32) num helper do teste, com ≥ 1.000 alvos e < 5 s. Esperado: "terminou" falso no fim < 1% em 80/20 e em 90/10. Python e TS geram sequências diferentes, então não se compara número com número.
4. **Contrato com `classificarTitulo`.**
   - Alvos: os da fixture que a regra v2 dá como *em andamento*.
   - Limiares: `LIMIARES_CONCORRENTE = resolverOpcoes({ minLeituras: 18, minVotosPorVariante: 2, minRodadasMistas: 2, minJanelaMistaMs: 0, minFracaoRodadasMistas: 0.1, maxVariantes: 8, quarentenaEscritaMs: 0 })`. `resolverOpcoes` preenche `escritasConhecidas` e `dhashMaxSame`, e `maxDuracaoRodadaMs` fica no padrão de 10 min (a rodada da sonda dura ≤ 0,23 min).
   - Adaptador, só no teste: filtra a validade do §3.1 e monta `{ rodadaId, lidaEm, idioma, origemRede: null, erro: null, tituloOficial: null, titulo_oficial_fonte: null, rendicoesSqp: null, titulosExibidos: [{ renderer: 'videoPrimaryInfoRenderer', texto: titulo_exibido }], miniaturas: [] }` → `prepararLeituras`.
   - Esperado: `estado === 'provavel_teste'` **e** as variantes da v2 ⊆ `variantes` (15/15 na sonda do Yannis).
   - Motivo de cada valor: 18 = 6 rodadas × 3; 2 mistas = o absoluto do §3.4; 0,1 = margem para 95/5; 8 = teto de versões; quarentena zerada porque não há escrita própria em vídeo de concorrente.
   - Uma divergência não se resolve mexendo no limiar: volta ao spec.
5. **Tabela-verdade de `estadoDeLeitura`.** Todos os passos do §5, inclusive:
   - linha `em_andamento` com o alvo sem rodada há 10 h → `nao_medido/sem_leitura` com `ultimo`;
   - linha `em_andamento` com `validas = 0` → `nao_medido/regra`;
   - linha indeterminada não atual com W = W⁻ = {X} → `sem_troca_vista`;
   - troca não atual → `troca`;
   - `sem_desfecho` com `janela` e com `alvo_podado`;
   - fora da janela sem linha;
   - `sem_publicacao`;
   - flag off com a variável apagada: `delete process.env.OBS_TROCAS_CONCORRENTE` e então `modoTrocasConcorrente({})`.
6. **Invariantes.**
   - Miniatura nunca `possivel_teste_youtube`.
   - Título nunca `troca_observada` + `em_andamento`.
   - `ficou` < 4 KB com 8 versões.
   - 9 versões gravam 8, com `n_versoes = 9`, e o estado é decidido por W.
   - `primeira_troca_em` é igual em duas avaliações seguidas.

## 10. Dívidas com gatilho

| Item | Gatilho |
|---|---|
| Reserva pela forja (`origem_rede = 'forja'`) | alarme 2 dias seguidos |
| Ler só as últimas 60 rodadas por alvo (usa `ficou.mistas_hist`; `primeira_troca_em` passa a ser preservado da linha anterior) | histórico > ~5 páginas por alvo |
| Leitura incremental do passo | > 300 alvos, ou `obs_devidos > 50` no fim do dia por 3 dias |
| Parser com várias ocorrências do renderer | `obs_contaminadas > 0` ou caso conferido pela Gio |
| Motivo fino do *não medido* (`suspenso`, transição), hoje reduzido a `regra` | o Cowork ou o dono pedir o motivo |
| Placeholder que varia em espaço ou caixa (guarda por texto bruto) | 1º caso visto |
| Tela (Lab ou página do vídeo do concorrente) | flag ligada + 7 dias de dado; mockup com Logan e Naksu, aprovação do dono |

## 11. Textos (Hanna; o texto final da tela é do Logan)

Regras:
- "teste" vem sempre com "possível";
- nunca "venceu";
- "não medido" vem sempre com o motivo;
- cada estado diz até quando foi visto;
- conta-se em **passagens, nunca em %**, e a primeira vez diz "a contagem é das nossas passagens, não da divisão de público do YouTube";
- a duração sai da janela real.

**Título**
- **Em andamento**: "Possível teste do YouTube: 3 títulos alternando desde 22/10 10h (8 passagens da sonda). 'A' em 5 de 8 passagens, 'B' em 3 de 8."
- **Sumindo**: "Possível teste do YouTube: 2 títulos seguem. 'B' não aparece desde 22/10 18h."
- **Provavelmente terminou**: "Possível teste do YouTube, provavelmente terminou: ficou 'X'. 'B' não aparece há 3 dias. Pode reabrir se 'B' voltar." Com 2 ou mais versões sumidas: "'B' e 'C' não aparecem há 3 dias".
- **Troca**: "Título trocado entre 20/10 13h e 19h: 'A' → 'B'. Pode ser edição manual." Enquanto o §8.2 não provar, acrescenta-se "Ainda não conferida com os dados do YouTube."
- **Sem troca vista**: "Um título só nas últimas 8 passagens (desde 21/10). Não quer dizer que não houve teste antes."
- **Não medido**:

| Motivo | Texto |
|---|---|
| `aprendendo` | "vídeo novo, juntando passagens (até 4 dias)" |
| `sem_leitura` | "sonda sem leitura desde 23/10 10h" |
| `flag_off` | "leitura de concorrentes desligada" |
| `sem_publicacao` | "sem data de publicação" |
| `saiu` | "saiu da observação" |
| `regra` | "leitura inconclusiva agora: títulos mudando sem padrão claro" |

  Com `ultimo`: "Não medido agora (motivo). Último estado visto até 23/10: …".
- **Fora da janela**: "Fora da observação desde 22/10 (30 dias da publicação). Último estado: …"

**Miniatura**
- **Troca**: "Miniatura trocada em 21/10 (a anterior não voltou)."
- **Indeterminada**: "Miniatura alternando entre versões: não dá para afirmar troca."
- **Sem troca vista**: "A mesma miniatura nas últimas 8 passagens. O teste de miniatura dos concorrentes não é visível para nós."

## 12. Arquivos tocados (para o plano)

**Envio A**
- `observados/inferir.ts`: regra e tipos de `ficou`.
- `observados/passo.ts`: `select`, guarda, mesmo `agora` na linha e no cursor, e os contadores `obs_titulo_suspenso` e `obs_versoes_demais`.
- `observados/estado-de-leitura.ts`.
- Parte nova em `agenda/tarefas/avisos-pendentes.ts`.
- `scripts/obs-dry-run.ts`, sem estimativa (Yannis estima no plano; reaproveita o carregador da fixture do §9.1).
- Testes em `apps/web/test/youtube/teste-youtube/observados/`.

**Envio B**
- Rota da pipeline, `api-registry.ts`, doc do domínio e ação MCP.

**Nada muda** em sonda, watch e banco.

## 13. Registro das revisões

| Rodada | Revisor | Nota | Achados aplicados no r2 |
|---|---|---|---|
| r1 | Phil | 80 NÃO | C1 guarda por versão no momento de gravar (§6.2); I1 ordem da leitura com `ultimo` (§5); I2 alarme com 0 leituras, condição 3, `dedupKey`, expiração, D−1 e volume (§6.1); I3 ensaio a seco e dois portões (§8); I4 teto de armazenamento (§4); I5 mudança pequena sem linha (§3.7); M1–M5 |
| r1 | Yannis | 84 NÃO | I1 contrato com ⊆, `resolverOpcoes` e adaptador (§9.4); I2 q da troca sobre W⁻ e trava 0,999 (§3.5); I3 linha atual × cursor e defesas de hoje (§4, §5); I4 `sem_desfecho` e fora da janela sem linha (§5); I5 placeholder fora do histórico (§6.2, solução do Phil, sem a dívida de 72 h); I6 chaves e 0/0 (§6.1); M1–M8; condição do AND retirada por ele |
| r2 | Phil | 91 SIM | N1 dedup e teto da consulta; N2 iteração com teto 3; N3 cursor ausente → aprendendo e numeração do §5; N4 piso de R na troca: não adotado, motivo no §3.5.3; N5 condição 3 declarada estimativa, canal no alarme, SQL sem aprendendo, conta de ≈ 400 consultas |
| r2 | Yannis | 93 SIM | N1 limite; N2 residual do mesmo canal; N3 `agora` único por avaliação; N4 expiração do aviso da guarda; N5 conta; N6 todas as versões qualificadas conferidas |
| r1 | Hanna | 84 SIM cond. | C1 portões de entrada e permanência (§7, §8); C2 ensaio a seco (§8.0); C3 envio B desacoplado da flag (§7); C4 textos (§11, §6.1); C5 "o que o dono vê" (§7.1) e critérios em linguagem do dono (§8.3); S2 lista da Gio do ensaio do dia; S3 data da poda |
