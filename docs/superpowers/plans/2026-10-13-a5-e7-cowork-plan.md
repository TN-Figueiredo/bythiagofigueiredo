# A5, ordem 21: E7, o que o Cowork passa a ler do Observatório (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/07-forja-cowork-e-contexto-para-ia.md`, seção 8 (linhas 7 a 17) e itens de aceite 51, 52 e 53; `00-indice-decisoes-e-sequencia.md` (linha 350: ordem 21, sem migration, sem mockup, depende da E4; linha 417: volta = reverter o commit; itens 245 a 247). Itens de outras etapas que esta toca: 9, 89, 119, 168 e 216. Migration: **nenhuma** (confirmado no spec, linha 350, e neste plano: nada é criado nem alterado no banco). Fatos levantados antes: `.superpowers/sdd/a5-planos-onda-2/e7-cowork/fatos.md` (conferi no código o que decide o desenho; o que não conferi está dito). Ledger da execução: `.superpowers/sdd/a5-e7/progress.md`.

**Objetivo, em três frases.** A rota `competitors/channels` passa a devolver, por canal concorrente, o perfil lido do YouTube (handle, país, data de criação) e cinco medidas da E4 (direção do canal inteiro, direção dos vídeos novos, estado do canal, ritmo e taxa de acerto), cada uma como objeto que diz "medido" com valor, amostra e janela, ou "não medido" com o código do motivo e a frase do motivo. A rota `competitors/changes` ganha o parâmetro opcional `campos=todos`, que acrescenta as mudanças de campo (tags, categoria, duração, idioma, nome do canal e as demais do catálogo, menos a descrição do canal); sem o parâmetro o corpo é o de hoje, byte a byte. O documento vivo do Cowork para esses dois endpoints é reescrito para dizer o que o código devolve de verdade (hoje ele descreve campos que não existem), e a ferramenta MCP `youtube_observatory` passa a aceitar os parâmetros que o adaptador já lia.

**Fica FORA deste plano.**
- **Série por vídeo (M2, M5, M9), M1, M7, M10, M12 e M11.** O brief desta etapa fala em "série, comentários"; o spec (linha 13) lista só M3(a), M3(b), M8, M6, M4, handle, país e data de criação, e a linha 15 proíbe M10 e as leituras em bruto. Vale o spec. M11 "pode entrar" pelo spec, mas o leitor dela exige o token de quem edita o site, que uma chave de API não tem (seção 8, desvio 2). Nenhuma dessas medidas aparece na resposta, e o documento diz isso numa linha.
- **Texto de comentário, identidade de autor, `raw`, descrição do canal, leituras das primeiras horas em bruto e qualquer tabela do canal próprio** (spec, linha 15; pergunta 16 com o padrão "nenhum texto de comentário"). Há teste que varre as respostas atrás de sentinelas (Tarefa 8).
- **A forja:** nenhum arquivo de `lib/youtube/observatorio/forja/`, `pack.ts`, `forja-queue.ts` nem a rota `competitors/readings`. Nenhum comando na forja. A prova é o retrato de `buildSent` (Tarefa 1).
- **`outliers` e `insights`:** não mudam (o teste de paridade de `consumidores-semanal.test.ts:323-335` continua verde sem mudança).
- **Os quatro recursos MCP do Observatório** (`pipeline://youtube/competitors/*`): não mudam. O de `channels` lê a tabela direto e continua sem medidas; o documento diz que as medidas vêm da rota e da ferramenta.
- **Rota nova, permissão nova, chave nova:** nenhuma. `endpoint_count` do domínio `youtube` continua 36; `api-registry.ts`, `leitura-rotas.ts`, `helpers.ts` e `auth.ts` não são tocados.
- **`docs/cowork-pipeline-reference.md` e `scripts/seed-pipeline-reference.ts`:** não mudam (seção 8, desvio 3).
- **Consertar os zeros que parecem medida de `insights`** (`last_upload_days: -1`, `engagement_rate: 0`) e o `video_count` de `channels` (é "quantos vídeos entraram na conta", no máximo 50): ficam como dívida (seção 13). O documento novo diz a verdade sobre `video_count`.
- **Toda tela.** Nenhum arquivo de `app/cms/`.

**Emenda do portão.** Ainda não houve portão. As respostas aos pareceres vão em `.superpowers/sdd/a5-planos-onda-2/e7-cowork/resposta-rN.md`.

**Emenda 1 (13/10, resposta à rodada 1 dos dois pareceres).** Cada trecho mudado leva a marca "(emenda 1: <id>)", com `d:` para o parecer de dados e `s:` para o de software. O que mudou de mais pesado: o teto de tempo passou a ser um prazo do pedido inteiro, com corrida contra o relógio (4.5 e seção 5); `campos=todos` ganhou a ponta final da cobertura, destino para a falha das consultas auxiliares e um ramo escrito para quando 100 linhas não bastam (4.3, Tarefa 4, P-2); o Lote 1 ganhou um teste contra o PostgREST de verdade (Tarefa 8b); o retrato do "antes" passou a ser conferido na árvore em que o lote vai (P-13, Tarefas 1 e 9); o tamanho passou a ser medido na porta MCP (P-14, Tarefas 12 e 13); e os commits que disparam a semente passaram ao controlador, com a conferência P-8b. A lista por achado está em `resposta-r1.md`.

**Emenda 2 (13/10, resposta à rodada 2 dos dois pareceres).** Cada trecho mudado leva a marca "(emenda 2: <id>)", com `d:` e `s:` como na emenda 1. O que mudou de mais pesado: `lido_ate` ganhou a ponta final **dos vídeos**, porque 10 dos 16 campos que saem são de vídeo e têm leitura separada da do canal (4.3, Tarefa 4, P-15); `contraOPrazo` passou a receber uma função, e não uma promessa, e a limpar o temporizador (Tarefas 12 e 13); a porta MCP ganhou medição de `get_changes` e um aviso em execução quando a resposta se aproxima do limite (Tarefas 6b e 13); a volta leva junto o arquivo de integração; e a árvore do lote ganhou a receita de montagem e de envio (Tarefa 9). Os trechos que a emenda 1 tinha deixado lado a lado com o texto antigo foram consolidados (s:m10). A lista por achado está em `resposta-r2.md`.

**Dois envios.** O plano divide a etapa em **Lote 1** (não depende da E4: perfil do canal, `campos=todos`, MCP, documento corrigido; Tarefas 1 a 9, com a 8b) e **Lote 2** (depende do código da E4: as cinco medidas; Tarefas 10 a 16). O Lote 1 pode **começar** já; **(emenda 1: s:I4)** ele só vai a produção antes dos commits locais do motor (E2) se a P-13 mostrar que o retrato da forja é igual nas duas árvores, e senão vai depois do lote que leva esses commits. O Lote 2 só compila depois de as Tarefas 1, 13 e 14 da E4 estarem commitadas, e só vai a produção depois do lote da E4.

**Foco de revisão** (o que atacar primeiro): (1) a regra do estado do canal quando a leitura falhou, para "ativo" nunca sair por falta (4.4); (2) o teto de tempo e o tamanho da resposta com mais canais (seção 5); (3) o corpo de `changes` sem parâmetro igual ao de hoje (Tarefas 2 e 5); (4) a lista fechada de campos que saem e a prova de que a descrição do canal não sai (Tarefas 4 e 8); (5) o commit que edita o documento dispara, sozinho, a semente em produção (seção 2); (6) os filtros de site nos leitores novos, que rodam com cliente de serviço.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa de outras etapas (conferido contra o texto real)

| O que uso | Forma exata, lida onde | Onde uso |
|---|---|---|
| `competitor_channels` (MG1, em produção) | colunas novas `custom_url`, `country`, `published_at`, `last_seen_at`, todas anuláveis (`supabase/migrations/20261012000002_observatorio_a5_e1_campos_sinalizadores_raw.sql:58-70`) | o perfil (Tarefa 3) |
| `competitor_field_versions` (MG1, em produção) | `id bigint`, `site_id`, `competitor_channel_id`, `video_id` (nulo = campo do canal), `field`, `value jsonb`, `first_seen_at`, `last_seen_at`, `window_start`, `precision` em `('6h','1d','7d','gap','first')`, `is_current`; índice `idx_cfv_channel_seen (competitor_channel_id, first_seen_at)` (mesmo arquivo, linhas 75 a 95) | a prova de que o perfil foi lido (Tarefa 3); as mudanças de campo (Tarefa 4) |
| O catálogo de campos | `VIDEO_FIELDS` (10 nomes) e `CHANNEL_FIELDS` (7 nomes, um deles `description`) em `apps/web/src/lib/youtube/observatorio/field-catalog.ts` | a lista do que sai (Tarefa 4) |
| Quem grava o perfil | `competitor-capture.ts:166-184`: `custom_url`, `description`, `published_at` e `country` só são gravados **quando a parte `snippet` veio**, e nessa hora o código grava também uma versão do campo `custom_url` (com valor nulo se o canal não tem handle); `competitor-sync.ts:995`: `last_seen_at` do canal só é carimbado quando a captura deu certo | a regra "lido, e o YouTube não informou" contra "ainda não lido" (4.2) |
| O serviço de hoje | `apps/web/src/lib/pipeline/services/competitors.ts`: `listCompetitorChannels` (155-216) devolve `{ channels: [{ id, channel_id, channel_name, thumbnail_url, subscriber_count, video_count, last_synced_at, added_at, avg_engagement }], count }`; `listCompetitorChanges` (223-269) devolve `{ changes, count }`, com filtros `type`, `bookmarked`, `limit` (padrão 25, máximo 100); `loadObservatory` (276-285) carrega o motor do site inteiro | o que não pode mudar; onde a integração entra |
| O motor | `Observatory.videos` (cada vídeo com `id` = uuid de `competitor_videos` e `mult: MultiplierResult`), `MultiplierResult { value: number \| null; weak: boolean; n: number; … }` (`observatorio/multiplier.ts:10-15`, `observatorio/index.ts:86-107`) | os múltiplos de M4 (Tarefa 12) |
| **E4, Tarefa 1** (plano fechado em 13/10; **código ainda não existe**: `apps/web/src/lib/youtube/observatorio/medidas/` não está na árvore local, conferido) | `M/tipos.ts`: `Medida<T>`, `Janela`, `Nota`, `MotivoNaoMedido` (união fechada de 34 códigos; **reconciliação 13/10: R3: passam a 35, com `'coleta_pausada'`, que o plano da E4 ganhou por causa da pausa da E10; `FRASES_DE_MOTIVO` precisa da frase dele, e onde este plano confere "34 códigos", na Tarefa 10 (a), confere 35**), `MOTIVOS_NAO_MEDIDO`, `Formato = 'long' \| 'short'`, `naoMedido(motivo, extra?)`; `M/regras.ts`: `MEASURE_RULES.ruleVersion` | as frases (Tarefa 11); a projeção (Tarefa 12) |
| **E4, Tarefa 13** | `M/ler.ts` (`server-only`): `lerCanal(sb, { siteId, channelId })`, `lerVideosDoCanal`, `lerMarcasDoCanal(sb, { siteId, channelId, videoIds })`, `lerRetratosDoCanal(sb, { siteId, channelId, desde })` (120 dias por padrão); todos devolvem `Parte<T> = { lido: true; dados } \| { lido: false; causa: 'schema_ausente' \| 'erro_do_banco' \| 'cortado' \| 'canal_de_outro_site' }` e nunca lançam | o orquestrador (Tarefa 12) |
| **E4, Tarefa 14** | `M/do-canal.ts` (puro): `medidasDoCanal(i: Insumos, o: { agoraMs }): { porFormato: Record<Formato, { m3b; m4; m6; … }>; m3a; m8; porVideo; falhas }`; `Insumos.series` e `.mudancas` aceitam `'nao_pedida'`, `.multiplos` aceita `'nao_pedido'` ou `Map<string, { valor: number \| null; baseFraca: boolean }>`, `.comentarios` aceita `'nao_pedido'`; `m8` é `{ estado: 'fora_do_ar' \| 'pausado' \| 'parado' \| 'em_queda' \| 'ativo'; parado: Medida; queda: Medida }` (reconciliação 13/10, emenda 2: S2-m1: o quinto valor, `'pausado'`, é o que a Tarefa 4 da E4 fixou) | o orquestrador (Tarefa 12) |
| E19 (modo aviso em produção) | `authenticateRead` (`lib/pipeline/helpers.ts:32-56`): as duas rotas tocadas já a usam; chave com `read` passa em qualquer modo; `registrarLeitura` grava em `audit_log` a leitura por chave enquanto o modo for `aviso` | nada muda; a conferência de uso (P-5) lê esse registro |
| E17 passo 0 (plano de 13/10) | o direito "ver desempenho privado" vale para tabelas do canal próprio e para o texto de comentário | esta etapa não lê nenhuma dessas tabelas; a prova é a Tarefa 8 |

**Três dependências que não são de arquivo.**
1. **O Lote 2 espera o código da E4.** As Tarefas 11 a 15 importam `medidas/tipos`, `medidas/ler` e `medidas/do-canal`. A Tarefa 10 confere o contrato real contra esta tabela antes de qualquer linha do Lote 2. Se o que a E4 entregou for diferente, a tarefa para e avisa.
2. **O Lote 2 só vai a produção depois do lote da E4** (que por sua vez vai depois do Lote B). Não é escolha: sem os arquivos de `medidas/` no remoto o typecheck do CI quebra.
3. **A MG4 não é pré-requisito de nenhuma das cinco medidas desta etapa.** M3(a), M3(b), M8, M6 e M4 não leem marcas (M3(b) usa as views de hoje; quem usa V30 é M3(c), que não sai). Com a MG4 ausente, a parte `marcas` responde `schema_ausente` e as cinco medidas seguem.

### 0.2 O que não foi medido (e o plano não afirma)

Nenhuma leitura de produção foi feita para este plano. Tudo o que só produção responde está em 3.2, com o comando. Os três que mais pesam: o tempo da rota `channels` com o motor mais os leitores por canal (P-4), o tamanho da resposta em bytes (P-4 e conferência `e7-l2-d0`), e se a chave `forja (so leitura)` lê essas duas rotas (P-5 e P-7).

### 0.3 Avisos de topo
- **Nenhuma rota nova de pipeline.** `endpoint_count` igual. Nada a registrar em `api-registry.ts` nem em `leitura-rotas.ts`.
- **Nenhuma escrita no banco.** A etapa só lê. O único efeito de uma chamada continua sendo a linha de `audit_log` que a E19 já grava.
- **O commit que toca `apps/web/data/pipeline-docs/` dispara a semente em produção, sozinho** (`.husky/pre-commit:38-49`, conferido). Ver seção 2.
- **Nenhum agente chama as rotas em produção com a chave do Cowork.** A decisão 53 (item 4) do dono não autorizou GET manual por agente. As conferências que pedem a resposta real são do dono (um comando por linha, preparado na Tarefa 9 e na 16).
- **Nenhuma chave é criada, revogada ou alterada.** `PIPELINE_COWORK_KEY` só é citada como variável de ambiente no comando do dono.
- **Tudo o que este plano avisa ao dono é conferência com data** (`lib/conferencias.ts`), que deixa o cron da coleta vermelho quando vence há mais de 7 dias. Não há cron novo, sino nem e-mail.
- **Zona reservada enquanto a A4 não for a `staging`:** nenhuma tarefa usa navegador, `next dev`, o banco 54321/54322, `apps/web/e2e/**`, `apps/web/src/app/cms/(authed)/youtube/competitors/**` nem `observatorio/proprio/**`.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Uma linha cada, com a recomendação e o padrão que vale se ele não responder.

| # | Pergunta | Padrão assumido | O que trava |
|---|---|---|---|
| 1 | O Cowork deve receber a série por vídeo (M2, M5, M9) e alguma coisa de comentários? O pedido desta etapa citava os dois; o spec aprovado deixa a série de fora e proíbe o texto. | **Não.** Vale o spec: só as cinco medidas por canal. Série e comentário ficam para uma decisão sua, em etapa própria. | nada |
| 2 | A contagem "em quantos vídeos o criador respondeu" (M11, sem texto) entra em `channels`? Ela é lida de tabelas que hoje só quem edita o site lê; uma chave de API teria de ganhar esse direito. | **Não entra.** O documento diz que a medida existe nas telas e não é entregue ao Cowork nesta fase. | nada |
| 3 | `campos=todos` devolve mudança de quais campos? Recomendo todos os do catálogo, menos a descrição do canal (que costuma trazer e-mail). | **Todos menos `description` do canal:** 10 de vídeo e 6 de canal (lista na Tarefa 4). Campo novo no catálogo nasce fora até alguém classificá-lo. | nada |
| 4 | Divido em dois envios? O primeiro (perfil, `campos=todos`, documento corrigido) não depende das medidas e pode ir já. | **Sim**, dois envios. | o Lote 1 esperaria a E4 |
| 5 | Autoriza o agente a fazer uma leitura (GET) nas duas rotas em produção, com a chave do Cowork, no dia de cada envio? | **Não.** Você cola dois comandos de uma linha (seção 2) e me devolve a saída, que só tem contagens. | a conferência D0 de cada lote fica com o dono |
| 6 | Na ferramenta MCP `youtube_observatory`, o parâmetro `channel_id` está anunciado e nunca foi obedecido. Tiro do anúncio (o serviço não filtra por canal) e passo a anunciar `type`, `bookmarked` e `tier`, que o código já lia e a ferramenta descartava? | **Sim.** Chamada antiga com `channel_id` continua funcionando (o parâmetro é ignorado, como hoje). | nada |
| 7 | `docs/cowork-pipeline-reference.md` não fala do Observatório e nenhuma semente o leva ao banco. Deixo como está? | **Sim**, não muda. O documento que o Cowork lê sobre estes endpoints é `cowork-docs-youtube.md`. | nada |
| 8 | A chave `forja (so leitura)` tem `read` e por isso alcança os campos novos. Tudo o que sai é dado público do YouTube. Aceita? | **Sim**, nada a fazer. Se a P-7 mostrar que o kit da forja lê `channels` ou `changes`, eu aviso antes do envio. | nada |
| 9 | **(emenda 1: s:I5)** Por qual programa o Cowork chama a ferramenta `youtube_observatory`, e qual o tamanho máximo de resposta de ferramenta que ele aceita? A lista de canais com medidas fica grande, e um programa que corta resposta longa deixaria de receber a lista sem nenhum erro do nosso lado. | **Sem resposta, vale o limite conservador de 60.000 caracteres** no texto que a ferramenta entrega (P-14); acima disso a ferramenta passa a responder sem indentação antes do envio do Lote 2. | nada |

---

## 2. O que é do dono

**Nenhuma migration. Nenhuma variável nova na Vercel.** O que é dele:

| Passo | Quem | O quê |
|---|---|---|
| 1 | controlador | roda P-1 a P-15 (3.2) e anota no ledger; a P-8 e a P-8b de novo antes de cada commit de documento. **(emenda 2: d:m-5)** As que leem produção (P-1 a P-5, P-8b, P-10 e P-15) são só leitura; se o controlador não tiver a leitura de produção liberada, **o dono cola a consulta e devolve a saída**, e a etapa espera por ela (sem a P-8b o commit do documento não sai) |
| 2 | agentes | Tarefas 1 a 8b, commits locais por lista de arquivos (**menos** os das Tarefas 7 e 14, que o agente deixa prontos e não commita) |
| 3 | controlador | **(emenda 1: s:I6)** faz ele mesmo o commit da Tarefa 7 (documento), que **dispara a semente** (ver abaixo), sem `--no-verify` e sem outro agente commitando entre a P-8, a P-8b e o commit; confere o log pela hora |
| 4 | agente (Tarefa 9) | push do Lote 1 em `staging`, CI verde, promoção a `main` |
| 5 | **dono** | cola os três comandos do Lote 1 abaixo e devolve a saída |
| 6 | agentes | Lote 2 (Tarefas 10 a 15), depois do lote da E4 em produção |
| 7 | agente (Tarefa 16) | push e promoção do Lote 2 |
| 8 | **dono** | cola os dois comandos do Lote 2 e devolve a saída |

**A semente (item 52 do spec).** O pre-commit roda `npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts` sempre que o commit inclui arquivo de `docs/cowork-*`, `data/pipeline-docs/`, `api-registry.ts` ou o próprio script. O `.env.local` aponta para produção. O script regrava em `reference_content` as entradas da lista dele (nove arquivos `docs/cowork-*.md` mais as entradas de sistema); **o documento do YouTube não está nessa lista**: ele chega ao Cowork pelo deploy, lido do arquivo por `GET /api/pipeline/docs/youtube`. Conferido em 13/10: nenhum dos nove arquivos difere de `origin/main` (`git diff --stat origin/main -- docs/cowork-*` vazio), então a semente regrava o mesmo conteúdo. A memória do Cowork nunca é sobrescrita (o script só insere quando não existe). O que este plano faz com isso: o commit da Tarefa 7 e o da Tarefa 14 são os únicos da etapa que tocam esses caminhos; antes de cada um rodam-se a P-8 e a P-8b; depois, a prova é a do parágrafo seguinte (a hora do log e a linha "Done!"; **emenda 2: s:m10**, a frase antiga pedia só o fim do log). "Semente rodada" no item 52 é isso, e o plano não roda o script à mão.

**(emenda 1: s:I6, d:m-10) O que a semente faz de fato, e quem a dispara.** Conferido no script (`scripts/seed-pipeline-reference.ts:236-251`): para toda entrada que não termina em `-memory` ele faz `upsert` de `content_md` e `content_compact` com o que está **no disco** e grava `updated_at` com a hora da execução. Logo: (a) "regrava o mesmo conteúdo" vale para o texto, mas **`updated_at` muda em produção a cada um desses commits** (e nas voltas); se `version` também muda não foi conferido (o script não a envia; depende de gatilho do banco), e a P-8b mostra o antes e o depois; (b) a P-8 compara o disco com o remoto, não com o banco: se alguma entrada foi editada em produção por outra via, a semente a apagaria, e é a P-8b que vê isso. Regras: os commits das Tarefas 7 e 14, e os reverts deles na volta, são **do controlador**, sem `--no-verify` (com ele o gancho não roda e ninguém nota), e sem outro agente commitando entre a P-8, a P-8b e o commit; a prova de que a semente rodou é a hora do log (`stat -f %Sm /tmp/seed-pipeline.log` posterior ao início do commit, porque o arquivo é único e qualquer commit de qualquer agente o sobrescreve) mais a linha "Done! All reference entries seeded."; o relatório copia as linhas `✓ <chave> (v<n>)` do log.

**Convive com o código que está em `main`?** Sim, nos dois sentidos:
- **Código novo, Cowork antigo (que não conhece os campos):** tudo é acréscimo. `changes` sem parâmetro é igual; `channels` mantém as nove chaves de hoje com os mesmos valores (Tarefa 2 prova).
- **Código antigo, documento novo:** não acontece (o documento vai no mesmo deploy do código).
- **Lote 2 sem a MG4:** as cinco medidas não dependem dela (0.1).
- **Banco sem a MG1** (não é o caso de produção): o perfil responde `nao_lido`, motivo `tabela_ausente`, e as chaves antigas seguem; `campos=todos` responde `nao_lido`, `tabela_ausente`.

**Os comandos do dono (um por linha; a saída não tem dado, só contagens).** Lote 1:
```
curl -s -H "Authorization: Bearer $PIPELINE_COWORK_KEY" 'https://bythiagofigueiredo.com/api/pipeline/youtube/competitors/channels' | jq '{canais: .data.count, perfis: ([.data.channels[].perfil.estado] | group_by(.) | map({(.[0]): length}) | add)}'
curl -s -H "Authorization: Bearer $PIPELINE_COWORK_KEY" 'https://bythiagofigueiredo.com/api/pipeline/youtube/competitors/changes?campos=todos&limit=100' | jq '{trocas: .data.count, campo: (.data.mudancas_de_campo | {estado, count, cortado, coleta_desde, lido_ate, fora_da_lista, video_de_outro_site, video_ausente, motivo})}'
curl -s -o /dev/null -w '%{http_code} %{time_total}s %{size_download}bytes\n' -H "Authorization: Bearer $PIPELINE_COWORK_KEY" 'https://bythiagofigueiredo.com/api/pipeline/youtube/competitors/channels'
```
**(emenda 2: d:m-4)** A terceira linha do Lote 1 mede o tempo da rota `channels` **antes** de ela ganhar `maxDuration = 60` (que só entra no Lote 2): é o número que a P-12 pede.
Lote 2:
```
curl -s -o /tmp/e7-channels.json -w '%{http_code} %{time_total}s %{size_download}bytes\n' -H "Authorization: Bearer $PIPELINE_COWORK_KEY" 'https://bythiagofigueiredo.com/api/pipeline/youtube/competitors/channels'
jq '{canais: .data.count, indisponiveis: .data.medidas_indisponiveis, meta: .data.medidas_meta}' /tmp/e7-channels.json
```

---

## 3. Fatos de que o desenho depende

### 3.1 Conferidos (no código local ou no spec)

| # | Fato | Fonte |
|---|---|---|
| F1 | O spec pede só M3(a), M3(b), M8, M6, M4, handle, país e data de criação em `channels`, e `campos=todos` em `changes`; sem rota nova | spec 07, linha 13 |
| F2 | Medida não medida sai com `estado: 'nao_medido'`, `motivo` e `desde` quando há; nunca omitida, nula, zero ou lista vazia; o endpoint acrescenta `medidas_indisponiveis`; o texto que o Cowork recebe contém a frase do motivo | spec 07, linha 17 |
| F3 | As medidas da E4 não escrevem frase (só código); a frase das telas é da E5 | plano da E4, 4.5 |
| F4 | O documento do Cowork descreve hoje, para `channels`, campos que o código não devolve (`growthDelta`, `recentVideos`, `vsYou`, camelCase) e, para `changes`, parâmetros que não existem (`change_type`, `channel_id`) e padrão errado (50; o código usa 25) | `cowork-docs-youtube.md:608-720` contra `competitors.ts:13-28, 223-269` e `changes/route.ts:14-19` |
| F5 | A ferramenta MCP anuncia `action`, `channel_id`, `limit`, `fmt`; o adaptador lê `type`, `bookmarked`, `tier` (que o SDK descarta por não estarem no anúncio) e nunca usa `channel_id`. **(emenda 1: conferido a pedido do parecer de software)** o SDK monta o anúncio com `z.object(shape)` sem modo estrito (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/zod-compat.js:14-24`), então chave fora do anúncio é descartada e não dá erro | `mcp/tools.ts:717-727`; `mcp/services/youtube-observatory.ts:33-51` |
| F17 | **(emenda 1: s:I5)** A ferramenta MCP entrega o resultado com indentação: `JSON.stringify(data, null, 2)` | `mcp/errors.ts:162-168` |
| F18 | **(emenda 1: s:I4)** `forja/sent.ts` importa `effectAt` de `../effect` e `viewsAtIdx` de `../series`, e esses dois arquivos diferem entre a árvore local e `origin/staging` (10 e 71 linhas), por commits locais da E2 (`f3677ef8`, `1cf7f783`); `load.ts` e `index.ts` do motor também diferem. **(emenda 2: s:m9)** Diferem ainda `stats.ts`, `types.ts`, `rules.ts`, `pack.ts`, `links.ts`, `load-channel.ts` e `load-page.ts`, e `forja/sent.ts` importa também `rules`, `types`, `catalog`, `time`, `niche`, `insights` e `changes` (`forja/sent.ts:10-19`; `git diff --stat origin/staging -- apps/web/src/lib/youtube/observatorio`, rodado em 13/10) | `forja/sent.ts:13-14`; `git diff --stat origin/staging -- apps/web/src/lib/youtube/observatorio/{effect,series,load,index}.ts`, rodado em 13/10 |
| F19 | **(emenda 1: d:I-1, s:I1)** Nem as consultas de vídeo de hoje (uma por canal, em série) nem as leituras do motor têm tempo limite | `competitors.ts:179-187`; `grep -n "abortSignal\|timeout" observatorio/load.ts` devolve zero linhas |
| F21 | **(emenda 2: d:I-2b)** Os campos de vídeo são capturados em outra chamada, em blocos de 50, com `try` próprio e carimbo próprio (`competitor_videos.last_seen_at`, gravado só depois de a captura do bloco dar certo); a falha liga um disjuntor que pula os blocos seguintes daquele canal, e a captura do canal não olha esse disjuntor. Vídeo da faixa semanal não é relido todo dia. Logo, canal lido hoje não prova vídeo lido hoje | `competitor-sync.ts:534-538, 592-612, 976-996`; `competitor-sync.ts:822-832` (`weeklyDue`); MG1, linhas 41-42 e 54 (`competitor_videos.missing_since` e `last_seen_at`) |
| F22 | **(emenda 2: s:m4)** Pela ferramenta MCP o `limit` tem padrão **50** (o anúncio usa `.default(50)`, e o "ou 25" do adaptador nunca é alcançado); pela rota HTTP o padrão é 25 | `mcp/tools.ts:723`; `mcp/services/youtube-observatory.ts:43` |
| F23 | **(emenda 2: d:m-2)** Toda versão aberta numa sincronização leva o mesmo `nowIso`: empate de `first_seen_at` é a regra, não a exceção | `competitor-capture.ts:236-241` |
| F20 | **(emenda 1: s:m6, d:m-3)** Na coleta, as versões de campo do canal são gravadas primeiro (dentro de `try`) e a linha do canal é atualizada depois, numa segunda gravação cujo erro é tratado como tardio; `last_seen_at` do canal é carimbado quando a captura deu certo, mesmo que a parte `snippet` não tenha vindo naquela leitura | `competitor-sync.ts:978-996` |
| F6 | O prompt `competitor-report` manda anotar "Growth delta", "Recent videos" e "VsYou", que a rota não devolve | `mcp/prompts.ts:1268-1272` |
| F7 | O documento é lido do arquivo implantado, não do banco; o pre-commit semeia outros documentos em produção quando ele é commitado | `services/utilities.ts:489-508`; `.husky/pre-commit:38-49`; `scripts/seed-pipeline-reference.ts` |
| F8 | `docs/cowork-pipeline-reference.md` não cita Observatório nem concorrente | `grep -n -i "competitor\|observat"` devolve zero linhas |
| F9 | O teste da varredura de comentários proíbe o texto `competitor_video_comment` em `app/api/pipeline`, `lib/pipeline`, `observatorio/forja`, `data/pipeline-docs` e `pack.ts` | `test/youtube/observatorio/comentarios-varredura.test.ts:226-243` |
| F10 | Só seis arquivos podem chamar `loadRows`, `loadDataset`, `rowsToDataset` ou `loadChannelRows`; `competitors.ts` é um deles; nenhum arquivo fora de `lib/youtube/observatorio` pode citar `unobservedSeries`, `tierSpans` ou `weeklySeries` | `test/youtube/observatorio/consumidores-semanal.test.ts:176-192` |
| F11 | Os testes de `listCompetitorChannels` usam um falso que responde por tabela, em fila; tabela sem resposta na fila devolve `{ data: null, error: null }`; eles afirmam campo a campo, não o objeto inteiro | `test/api/pipeline/youtube-competitors.test.ts:41-71, 140-212` |
| F12 | As rotas `channels` e `changes` não têm `maxDuration`; `readings` e `/api/mcp` têm 60 | os dois `route.ts`; `readings/route.ts:13`; `api/mcp/route.ts:10` |
| F13 | O site aceita até 75 canais concorrentes | `observatorio/rules.ts:25` (`channelLimit: 75`) |
| F14 | O contexto do serviço traz o cliente de serviço (ignora RLS) e o `siteId` **da chave**, não de GUC nem de cabeçalho | `services/http-adapter.ts:6-17`; `mcp/services/youtube-observatory.ts:18-27` |
| F15 | O documento local difere de `origin/staging` em duas linhas, do commit local `2035904f` (regra do novo pedido à forja), que é de outra frente | `git diff origin/staging -- apps/web/data/pipeline-docs/cowork-docs-youtube.md` |
| F16 | Erro 400 de parâmetro inválido nos serviços do pipeline usa o código `VALIDATION_ERROR` (77 usos) | `grep` em `lib/pipeline/services` |

### 3.2 Conferências pendentes (só produção ou a forja respondem; o controlador roda; todas só leitura)

**P-1. O perfil está preenchido?** Decide o que o D0 do Lote 1 espera.
```sql
select count(*) as canais, count(custom_url) as com_handle, count(country) as com_pais, count(published_at) as com_criacao, count(last_seen_at) as relidos, (select count(distinct competitor_channel_id) from public.competitor_field_versions where video_id is null and field = 'custom_url' and is_current) as com_versao_de_handle from public.competitor_channels;
```
Esperado: `com_versao_de_handle` = `canais` (todo canal foi relido depois da E1). Se for menor: a diferença sai `nao_lido`, motivo `canal_ainda_nao_relido`, e o esperado do D0 passa a ser esse número. `com_pais` menor que `canais` é normal (o YouTube não obriga país). **(emenda 1: s:m6)** Como a prova do perfil passou a ser as **duas** versões correntes (handle e país, 4.2), a P-1 ganha uma segunda consulta, e o número que o D0 espera em `lido` é o dela:
```sql
select count(*) as com_as_duas_versoes from (select competitor_channel_id from public.competitor_field_versions where video_id is null and is_current and field in ('custom_url', 'country') group by 1 having count(distinct field) = 2) t;
```
Esperado: igual a `com_versao_de_handle` (as duas versões nascem na mesma leitura). Se for menor: anotar a diferença (canais com handle lido e país não), que sai `nao_lido`, e avisar, porque contradiz o que o código da coleta faz (`competitor-capture.ts:176-184`).

**P-2. Quantas mudanças de campo existem, de quais campos e de que tamanho?** Decide se o teto de 100 linhas basta e se há valor grande.
```sql
select field, (video_id is null) as do_canal, count(*) filter (where precision <> 'first') as mudancas, max(length(value::text)) as bytes_max, min(first_seen_at) as desde from public.competitor_field_versions group by 1, 2 order by 3 desc;
```
Se `bytes_max` de algum campo que sai passar de 2.000: a Tarefa 4 ganha um corte por valor (texto cortado em 500 caracteres, com `cortado_em` no item) antes do envio. Se toda `mudancas` for zero: o D0 espera `estado: 'lido'`, `count: 0` e `coleta_desde` com data. Se a tabela estiver vazia: espera `nao_lido`, `coleta_ainda_nao_comecou` (e isso contradiz o brief, que dá a E1 em produção: parar e avisar).

**(emenda 1: d:I-4, d:m-1) Segunda consulta da P-2: o volume por dia e por campo, e o tamanho da tabela.**
```sql
select (first_seen_at at time zone 'America/Sao_Paulo')::date as dia, field, count(*) as mudancas from public.competitor_field_versions where precision <> 'first' group by 1, 2 order by 1 desc, 3 desc;
select count(*) as linhas, count(*) filter (where precision = 'first') as primeiras from public.competitor_field_versions;
```
O ramo, com número: somando só os campos que saem (lista da Tarefa 4), **se algum dia tiver mais de 100 mudanças, ou se a soma de 7 dias seguidos passar de 100, o Lote 1 só vai com a continuação da leitura** (o contrato está escrito em 4.3, "Continuação", e a Tarefa 4 ganha os testes dela). Abaixo disso, o Lote 1 vai sem a continuação, e o documento diz o que `cortado: true` significa e o que fazer (Tarefa 7). Sem a resposta da P-2 o Lote 1 não vai. `linhas` é o número que o Apêndice A compara com 200.000; a conta de ordem de grandeza está na seção 5. **(emenda 2: d:m-3)** A captura de campos começou em 12/10: a P-2 anota no ledger **quantos dias de dado** a consulta viu (o número de valores distintos de `dia`). Com menos de 7 dias a regra "soma de 7 dias seguidos" ainda não pôde ser aplicada inteira, e por isso a mesma consulta é repetida na `e7-l1-d7` com o mesmo ramo (Tarefa 9).

**P-3. As tabelas da E4 existem em produção?** Decide a ordem do Lote 2.
```sql
select to_regclass('public.competitor_video_marks') as marcas, to_regclass('public.competitor_video_mark_misses') as faltas, (select max(version) from supabase_migrations.schema_migrations) as ultima;
```
Nulo: normal até o lote da E4; o Lote 2 não vai antes dele. Não nulo sem o lote da E4 enviado: parar (alguém criou fora do plano).

**P-4. Quanto pesa uma chamada?** Decide o teto de tempo e se a resposta cabe.
```sql
select count(*) as canais, (select count(*) from public.competitor_videos) as videos, (select count(*) from public.competitor_video_daily) as leituras_diarias, (select count(*) from public.competitor_channel_snapshots where snapshot_date > current_date - 120) as retratos_120d from public.competitor_channels;
```
Com `canais` até 20 e `videos` até 2.500, vale a conta da seção 5. Acima disso, refazer a conta antes do Lote 2 e, se o total de consultas passar de 200, baixar `CANAIS_EM_PARALELO` não ajuda: a Tarefa 12 passa a ler os vídeos de todos os canais numa consulta só (pedido novo ao plano, não improviso).

**P-5. Quem lê estas rotas hoje, e com que chave?**
```sql
select after_data->>'key_name' as chave, after_data->>'rota' as rota, count(*) as vezes, min(created_at) as primeira, max(created_at) as ultima from public.audit_log where action = 'pipeline_leitura_aviso' and after_data->>'rota' like '%competitors%' group by 1, 2 order by 1, 2;
```
Só cobre HTTP desde 12/10 e **não cobre o MCP** (`/api/mcp` não passa por `authenticateRead`). Se `forja (so leitura)` ou `forja (fila)` aparecer em `channels` ou `changes`: rodar a P-7 antes do envio e levar a pergunta 8 ao dono com o fato. Se só `cowork-permanent`: seguir. Zero linhas não prova que ninguém usa. **(emenda 1: d:m-6)** Dois limites a mais, conferidos em `leitura-registro.ts:172-181`: a linha de uma chave que **tem** `read` (o caso de `cowork-permanent`) só é gravada enquanto o controle estiver aberto, então depois do veredito da E19 (20/10) ou do fechamento do controle ela deixa de aparecer, e zero linhas passa a ser o normal; e a rota é gravada sem a query (`rotaNormalizada(pathname)`), então a P-5 nunca distingue `changes` de `changes?campos=todos`.

**P-6. O remoto tem o que o brief diz?**
```
git ls-remote origin staging main
```
Depois, com os dois hashes: ~~`git merge-base --is-ancestor 7f28d3de <hash-de-main> && echo sim || echo nao`~~ (reconciliação 13/10, emenda 3: m1) **por conteúdo, não por hash local: `git cat-file -e <hash-de-main>:apps/web/src/lib/pipeline/leitura-registro.ts && echo sim || echo nao`** (E19 lote 1; o arquivo nasce nesse commit). O `is-ancestor` responde `nao` com a E19 em produção, porque ela foi enviada por árvore de lote e a cópia em `main` tem outro hash (`41e563bc`); medido em 13/10: `is-ancestor` de `7f28d3de` contra `origin/main` = `nao`, `cat-file -e` = `sim`. `nao`: o plano não pode dizer "modo aviso em produção" e a P-5 não tem o que ler; nada mais muda.

**P-7. O kit da forja lê `channels` ou `changes`?** (leitura; o kit local é `~/Workspace/forja/ferramentas`)
```
grep -rn "competitors/" ~/Workspace/forja/ferramentas | grep -v readings | head
```
Vazio: o item 53 vale como está. Achou: a cópia na forja pode estar atrás da local (runbook, seção 2); avisar o dono, que decide se lê lá com `ssh forja 'grep -rn "competitors/" <caminho do kit>'`. Campo a mais em JSON não quebra leitor que ignora chave desconhecida, mas o validador do kit pode não ignorar: sem a resposta, o Lote 1 não vai.

**P-8. A semente vai regravar o que já está lá?** Rodar **antes** de cada commit que toca `data/pipeline-docs/`:
```
git status --short -- docs/cowork-architect-memory.md docs/cowork-architect-templates.md docs/cowork-content-curator-skill.md docs/cowork-curator-memory.md docs/cowork-curator-rules.md docs/cowork-playlist-architect-skill.md docs/cowork-research-memory.md docs/cowork-research-rules.md docs/cowork-research-strategist-skill.md scripts/seed-pipeline-reference.ts
git diff --stat origin/main -- docs/cowork-* scripts/seed-pipeline-reference.ts
```
As duas saídas vazias: o commit segue. Qualquer linha: parar; a semente levaria a produção um texto que ninguém enviou. **(emenda 1: d:m-5)** `origin/main` aqui é a referência **local**, que pode estar velha (em 13/10 ela era `6d63f387`). A P-8 começa por `git ls-remote origin main` e o segundo comando usa o hash devolvido no lugar de `origin/main`; se o `git diff` reclamar que não conhece o hash, o controlador atualiza as referências (`git fetch origin main`) e roda de novo. Sem isso a P-8 só prova "igual à minha referência local".

**P-8b. (emenda 1: s:I6) O banco tem o mesmo texto que o disco?** Rodar **antes** de cada commit que dispara a semente (os das Tarefas 7 e 14 e os reverts da volta), junto com a P-8, só leitura:
```sql
select key, version, updated_at, md5(coalesce(content_md, '')) as md5_banco from public.reference_content where key not like '%-memory' order by key;
```
comparada com `md5 -q <arquivo>` de cada arquivo que o script lê. Igual em todas as entradas de arquivo: seguir. Diferente em alguma: **parar**, porque a semente apagaria uma edição feita em produção; a decisão é do dono. As entradas de sistema (sem arquivo) não têm com o que comparar: anotar a `version` e o `updated_at` de antes, e rodar a mesma consulta depois do commit para ver o que o carimbo mudou (é o que responde se `version` sobe com conteúdo igual).

**P-9. As conferências da E4 que mudam número daqui** (C-5: buracos nos retratos de canal, que fazem M3(a) responder `sem_registro_na_borda`; C-14 e C-16): estão no plano da E4, 3.2, com o comando. Este plano não duplica; a resposta só muda **quantas** medidas saem não medidas, nunca a forma.

**P-10. (emenda 1: d:I-3) Quantos dias de retrato cada canal tem?** Decide o que o D0 do Lote 2 e a conferência de 15/12 esperam por canal. Rodar antes do Lote 2:
```sql
select c.channel_name, c.added_at::date as entrou, min(s.snapshot_date) as primeiro, max(s.snapshot_date) as ultimo, count(*) filter (where s.view_count is not null) as dias_com_views, (max(s.snapshot_date) - min(s.snapshot_date)) as cobertura_dias from public.competitor_channels c left join public.competitor_channel_snapshots s on s.competitor_channel_id = c.id group by 1, 2 order by 6 nulls first;
```
A queda de M8 precisa de cinco bordas em 112 dias. Canal com `cobertura_dias` menor que 112 tem a queda não medida por falta de borda, antes e depois de 14/12/2026, e a data em que ela fecha é `primeiro` mais 112 dias (anotar por canal no ledger). Qual motivo aparece quando faltam bordas **e** a janela cruza a mudança de contagem, o plano da E4 não diz: é a pergunta (i) da Tarefa 10. Por isso nenhuma conferência deste plano escreve um número de canais por motivo.

**P-11. (emenda 1: s:I3) O banco local de integração tem a MG1?** Leitura do banco **local** `bythiago_int`, não de produção:
```
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "select to_regclass('public.competitor_field_versions') as versoes, (select count(*) from information_schema.columns where table_name = 'competitor_channels' and column_name in ('custom_url', 'country', 'published_at', 'last_seen_at')) as colunas_do_perfil;"
```
`versoes` não nulo e `colunas_do_perfil` = 4: a Tarefa 8b roda. Outra coisa: a Tarefa 8b para e avisa o controlador (quem aplica migration no banco local é ele); o Lote 1 não vai sem a 8b verde.

**P-12. (emenda 1: s:m10) Qual o tempo máximo de função do projeto na Vercel?** Leitura do painel (Project Settings, Functions, "Function Max Duration"), do dono ou do controlador. Se for 60 s ou menos: `maxDuration = 60` não baixa nada. Se for maior: a rota `channels` passa a ter um teto **menor** que o de hoje; o desenho não muda (o prazo do pedido é 40 s, seção 5), e o fato fica anotado no ledger e no relatório da Tarefa 13. **(emenda 2: d:m-4)** Nesse ramo (teto do projeto maior que 60 s), antes do envio do Lote 2 confere-se o `time_total` que o dono devolveu na terceira linha dos comandos do Lote 1 (seção 2): abaixo de 30 s, seguir; **30 s ou mais, parar**, porque a rota de hoje já anda perto do teto novo e `maxDuration = 60` passaria a matar chamadas que hoje respondem (a decisão é do dono: enviar sem `maxDuration`, ou antes consertar a dívida 10).

**P-13. (emenda 1: s:I4) O pacote da forja e o motor são os mesmos na árvore local e na do envio?** Rodar antes da Tarefa 1:
```
git log --oneline origin/staging..HEAD -- apps/web/src/lib/youtube/observatorio/effect.ts apps/web/src/lib/youtube/observatorio/series.ts apps/web/src/lib/youtube/observatorio/insights.ts apps/web/src/lib/youtube/observatorio/niche.ts apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/src/lib/youtube/observatorio/forja
```
Em 13/10 a lista **não é vazia** (`f3677ef8` e `1cf7f783`, da E2, só locais: F18). **(emenda 2: s:m9)** A lista de caminhos deste comando não cobre tudo o que o motor importa (F18), então ela serve só de aviso: **a comparação do `sha256` abaixo é feita sempre**, com a lista vazia ou não. O controlador monta a **árvore do lote** (uma cópia de trabalho separada, em `HEAD` destacado, com `origin/staging` mais a lista de commits do Lote 1; sem branch novo e sem mexer na árvore principal), gera nela o retrato da Tarefa 1 e compara o `sha256` com o gerado na árvore local. **Iguais:** o Lote 1 pode ir antes dos commits da E2. **Diferentes:** o Lote 1 só vai **depois** do lote que leva esses commits, e o retrato que vale é o da árvore local; ninguém regenera o retrato na árvore do lote para "fazer passar". **(emenda 2: s:m9)** O atalho "lista vazia, segue sem comparar" saiu.

**P-14. (emenda 1: s:I5) Qual o teto de resultado de ferramenta do programa que o Cowork usa?** É a pergunta 9 ao dono. Sem a resposta vale 60.000 caracteres no texto que a ferramenta entrega (cerca de 15 a 20 mil tokens; a conta exata depende do modelo e não é afirmada). Com a resposta: o limite dos testes das Tarefas 12, 13 e 15 passa a ser 80% do teto informado (a folga de 20% é escolha deste plano, não medida).

**P-15. (emenda 2: d:I-2b) Até quando os vídeos foram lidos?** Decide o que o D0 do Lote 1 espera na ponta dos vídeos e o que o documento diz de `videos_mais_antigo`. Só leitura:
```sql
select count(*) as videos, count(last_seen_at) as com_leitura, min(last_seen_at) as mais_antiga, max(last_seen_at) as mais_recente, count(*) filter (where last_seen_at < now() - interval '8 days') as mais_de_8_dias from public.competitor_videos where missing_since is null;
```
`mais_recente` do dia (ou de ontem, antes da coleta): é o esperado de `lido_ate.videos_mais_recente` na `e7-l1-d0`. `mais_recente` mais antiga que isso: a captura de vídeo está parada **hoje**; parar e avisar antes do envio (não é defeito desta etapa, mas é exatamente o que ela passaria a mostrar). `mais_de_8_dias` maior que zero: há vídeo que nenhuma faixa relê, `videos_mais_antigo` não serve de sinal de coleta parada, e o documento (Tarefa 7) diz isso com a frase escrita lá; o campo continua saindo, porque é dado. `videos` menos `com_leitura` maior que zero: há vídeo nunca lido desde a E1, que não entra em nenhuma das duas pontas; o documento diz, e fica a dívida 11.

---

## 4. Desenho, no que difere de "acrescentar campos ao JSON"

### 4.1 Onde mora o código

Quatro módulos novos em `apps/web/src/lib/pipeline/services/`, ao lado do serviço: `competitors-perfil.ts` e `competitors-campos.ts` (Lote 1), `competitors-frases.ts` e `competitors-medidas.ts` (Lote 2). O serviço `competitors.ts` só ganha os tipos, as chamadas e o parâmetro. Nenhum dos quatro contém o texto `loadRows`, `rowsToDataset`, `weeklySeries` nem `competitor_video_comment` (F9, F10): o motor continua sendo carregado em `competitors.ts`, pela função `loadObservatory` que já existe, e entra no orquestrador por parâmetro. As medidas **não são recalculadas nem redefinidas aqui**: o orquestrador chama os leitores e o montador da E4 e projeta o resultado.

### 4.2 O perfil: "o YouTube não informou" não é "ainda não lemos"

`handle`, `pais` e `criado_em` saem dentro de um objeto `perfil`:
```ts
export type MotivoDePerfil = 'canal_ainda_nao_relido' | 'tabela_ausente' | 'erro_do_banco' | 'cortado'
export type PerfilDoCanal =
  | { estado: 'lido'; lido_em: string | null; handle: string | null; pais: string | null; criado_em: string | null }
  | { estado: 'nao_lido'; motivo: MotivoDePerfil; frase: string }
```
A prova de que o perfil foi lido é a existência de uma versão corrente do campo `custom_url` do canal em `competitor_field_versions` (F: quem grava o perfil). Com a prova, `null` em `handle` ou `pais` quer dizer "o YouTube não informou na leitura"; sem a prova, o canal sai `nao_lido`, motivo `canal_ainda_nao_relido`, e nenhum dos três campos aparece. `lido_em` é `competitor_channels.last_seen_at`.

**(emenda 1: s:m6, d:m-3) Uma fonte só para a prova e para o valor.** A versão e a coluna são duas gravações separadas (F20): versão gravada com a coluna ainda não atualizada daria `lido` com `handle: null`, que o documento manda ler como "o YouTube não informou". Por isso `handle` e `pais` saem do `value` das versões correntes dos campos `custom_url` e `country` do canal (as duas nascem juntas, na mesma leitura da parte `snippet`), e não das colunas. A prova passa a ser **as duas** versões correntes: faltou qualquer uma, o canal sai `nao_lido`, `canal_ainda_nao_relido`. Só `criado_em` (`published_at`) e `lido_em` (`last_seen_at`) vêm da linha do canal, porque não são campos do catálogo. Três coisas que o documento diz, porque o código não tem como saber mais: `lido_em` é a última leitura boa do canal e pode ser posterior à leitura do perfil (F20); `criado_em` nulo com o perfil lido quer dizer "não informado, ou ainda não gravado na linha do canal"; e a frase de `canal_ainda_nao_relido` não afirma a causa: "o histórico do perfil deste canal ainda não tem a primeira leitura de handle e país". A leitura do perfil é **uma consulta à parte** das que o serviço já faz: se ela falhar, só o perfil sai `nao_lido`; as nove chaves de hoje seguem.

### 4.3 `campos=todos`: lista fechada, valor anterior, e a diferença entre "nenhuma mudança" e "não lemos"

```ts
export type ValorAnterior = { estado: 'lido'; valor: Json } | { estado: 'nao_lido'; motivo: 'sem_versao_anterior' | 'erro_do_banco' | 'cortado' }
export interface MudancaDeCampo { id: number; alvo: 'video' | 'canal'; channel_name: string; video_id: string | null; video_title: string | null; campo: string; valor_novo: Json; valor_anterior: ValorAnterior; visto_em: string; janela_desde: string | null; precisao: '6h' | '1d' | '7d' | 'gap' }
export type MudancasDeCampo =
  | { estado: 'lido'; itens: MudancaDeCampo[]; count: number; limite: number; cortado: boolean; coleta_desde: string; lido_ate: LidoAte; fora_da_lista: number; video_de_outro_site: number; video_ausente: number }
  | { estado: 'nao_lido'; motivo: 'coleta_ainda_nao_comecou' | 'tabela_ausente' | 'erro_do_banco' | 'cortado'; frase: string }
// (emenda 1: d:I-2) a ponta final da cobertura, tirada de competitor_channels.last_seen_at dos canais do site
// (emenda 2: d:I-2b) videos_*: a ponta final dos campos de VÍDEO, tirada de competitor_videos.last_seen_at
export interface LidoAte { mais_antigo: string | null; mais_recente: string | null; canais_sem_leitura: number; videos_mais_antigo: string | null; videos_mais_recente: string | null }
```
- **(emenda 1: d:I-2, d:m-7) A lista diz até quando vale.** Uma versão de campo só nasce quando a coleta roda e dá certo; se a coleta parar, a tabela não ganha linhas e a resposta seria igual à de uma semana sem mudança. `lido_ate` vem da consulta (5), que já lê os canais do site e passa a pedir também `last_seen_at`: `mais_antigo` e `mais_recente` são a menor e a maior última leitura boa entre os canais, e `canais_sem_leitura` conta os que têm `last_seen_at` nulo. Com zero canais os dois são `null`. A lista cobre de `coleta_desde` até `lido_ate`; o documento diz que canal com leitura mais antiga que a de hoje não foi conferido depois dela, e que `coleta_desde` é a primeira leitura **do site** (canal acrescentado depois tem cobertura menor).
- **(emenda 2: d:I-2b) A ponta do canal não vale para os campos de vídeo.** `mais_antigo`, `mais_recente` e `canais_sem_leitura` medem a leitura **do canal** e cobrem só os 6 campos de canal. Os 10 campos de vídeo têm captura, falha e cadência próprias (F21): com a captura de vídeo parada e a do canal funcionando, a resposta seria igual à de "nenhum vídeo mudou". Por isso `lido_ate` traz também `videos_mais_recente` e `videos_mais_antigo`: a maior e a menor `competitor_videos.last_seen_at` entre os vídeos dos canais de (5) com `missing_since` nulo e `last_seen_at` não nulo, lidas pela consulta (7) da Tarefa 4. Sem vídeo, ou com todos sem leitura, os dois são `null`, e `null` aqui quer dizer "nenhum vídeo com leitura", nunca "em dia". O sinal de captura de vídeo parada é `videos_mais_recente` anterior a hoje; `videos_mais_antigo` é dado, e pode ser antigo sem defeito (vídeo da faixa semanal, ou que nenhuma faixa relê: P-15). Falha na consulta (7) segue a regra das auxiliares: `nao_lido`, nunca lista.
- **(emenda 2: s:m7) Vídeo que sumiu no meio da leitura não é defeito de dado.** Vídeo que está na página (2) e não volta na consulta (6), com a (6) lida, foi apagado entre as duas: o item é descartado e contado em `video_ausente`, **sem** contar em `video_de_outro_site` e sem aviso ao Sentry.
- **(emenda 1: s:I2) Dois contadores, porque são duas coisas.** `fora_da_lista` conta linha com campo fora da lista do alvo dela. `video_de_outro_site` conta mudança cujo vídeo não é de canal do site: maior que zero é defeito de dado, e vai `Sentry.captureMessage('e7.video_de_outro_site')` com a contagem (sem id nem título).
- **(emenda 1: s:I2, d:m-8) Falha de consulta auxiliar nunca vira lista.** Erro, tabela ausente, exceção, corte ou resposta `{ data: null, error: null }` em **qualquer** das consultas (1), (2), (5), (6) ou (7, emenda 2) da Tarefa 4 responde `nao_lido` com o motivo (`erro_do_banco`, `tabela_ausente`, `cortado`), nunca `lido`. Só (3) e (4), os valores anteriores, degradam por item.
- **(emenda 1: d:I-4) Continuação (só entra se a P-2 passar do número escrito nela).** `changes` aceita `antes_de=<id>`, o `id` do último item recebido, que só vale junto de `campos=todos` (sozinho, ou com valor que não é inteiro positivo: 400, `VALIDATION_ERROR`). O serviço lê `first_seen_at` daquela linha **com o filtro do site** (linha de outro site ou inexistente: 400) e a página passa a pedir só o que vem depois dela na mesma ordem (`first_seen_at` menor, ou igual com `id` menor). **(emenda 2: s:m6, d:m-1, d:m-2)** Quem valida o cursor é uma função à parte, `lerCursor` (Tarefa 4), chamada pelo serviço **antes** do leitor: o leitor continua devolvendo só `lido` ou `nao_lido`, e o 400 nasce no serviço. A condição "menor, ou igual com `id` menor" é um `.or(…)` do PostgREST; o `first_seen_at` do cursor entra nele **como o texto que o banco devolveu**, entre aspas duplas, sem passar por `Date` (que perderia os microssegundos e repetiria ou pularia linha no empate, e o empate é a regra: F23). A resposta `lido` ganha `proximo: number | null`: o `id` do último item quando `cortado` é verdadeiro, senão `null`. `changes` e `count` (as trocas de título e miniatura) não mudam com `antes_de`. Sem esse ramo, `cortado: true` quer dizer "há mudanças mais antigas que esta chamada não entrega", e o documento diz isso.
- **Sem o parâmetro**, a chave `mudancas_de_campo` não existe no objeto (nem como `undefined`), e nenhuma consulta nova é feita.
- **Com `campos=todos`**, `changes` e `count` são os de hoje e a chave nova entra. `type` e `bookmarked` não filtram as mudanças de campo (o documento diz); `limit` vale para as duas listas, cada uma com o seu corte.
- **`campos` com outro valor** responde 400, `VALIDATION_ERROR`, com a lista do que é aceito. Valor desconhecido ignorado em silêncio faria o Cowork achar que pediu e recebeu.
- **O que sai:** os 10 campos de vídeo do catálogo e 6 dos 7 de canal. `description` do canal nunca sai (spec, linha 15). A consulta filtra por `in('field', lista do que sai)`; o que vier com alvo e campo fora da lista é descartado e contado em `fora_da_lista`.
- **Lista vazia só com `estado: 'lido'`** e sempre com `coleta_desde` (a primeira leitura de campo do site): "nenhuma mudança desde dd/mm" é uma resposta; tabela sem nenhuma linha do site é `nao_lido`, `coleta_ainda_nao_comecou`.
- **`precision = 'first'` fica fora** (primeira leitura não é mudança, a mesma regra do leitor da E4).
- `valor_novo` nulo é valor: o campo deixou de ser informado pelo YouTube.

### 4.4 As medidas: o que sai por canal

```ts
export type MedidaParaCowork<T> =
  | { estado: 'medido'; valor: T; n: number; janela: Janela; notas?: Nota[] }
  | { estado: 'nao_medido'; motivo: MotivoNaoMedido; frase: string; desde?: string; fechaEm?: string; n?: number; minimo?: number; notas?: Nota[] }
export interface MedidasDoCanalParaCowork {
  direcao_do_canal: MedidaParaCowork<…>            // M3(a), o `m3a` do montador
  estado_do_canal: { situacao: 'fora_do_ar' | 'pausado' | 'parado' | 'em_queda' | 'ativo' | 'nao_determinada'; confirmada: boolean; parado: MedidaParaCowork<…>; queda: MedidaParaCowork<…> }   // M8  (reconciliação 13/10, emenda 2: S2-m1: 'pausado' entrou no tipo)
  por_formato: Record<'long' | 'short', { direcao_dos_videos_novos: MedidaParaCowork<…>; ritmo: MedidaParaCowork<…>; taxa_de_acerto: MedidaParaCowork<…> }>   // M3(b), M6, M4
}
```
- **A projeção é só de transporte.** Os campos `estado`, `valor`, `n`, `janela`, `motivo`, `desde`, `fechaEm`, `minimo` e `notas` são os da E4, com os mesmos nomes e valores. O que a E7 faz: acrescenta `frase` a toda medida não medida; omite `notas` quando a lista está vazia (é a única omissão, e é de uma lista auxiliar, não de medida). **(emenda 1: s:m9) A E7 não arredonda número nenhum:** arredondar `variacao` separaria o número da leitura dele (0,00004 viraria 0 ao lado de `direcao: 'subindo'`); os valores saem como a E4 os entregou. Nenhuma medida é omitida: as nove (uma, duas dentro do estado, e três por formato vezes dois) existem em todo canal, sempre.
- **Longos e Shorts nunca se misturam** (item 32 da E4): os dois formatos saem, cada um com as suas três medidas.
- **O estado do canal não pode dizer "ativo" por falta.** O montador da E4 devolve `estado: 'ativo'` quando a queda não foi medida e manda a tela mostrar os dois. Para um leitor de texto isso não basta. Regras da E7: (a) `confirmada` é verdadeiro quando `situacao` não é `'ativo'` (reconciliação 13/10, emenda 2: D2-m7, S2-m1) **nem `'pausado'`**, ou quando `parado` e `queda` estão medidos (com `'pausado'` os dois saem não medidos, então `confirmada` é falso pelas duas metades da regra); (b) quando a parte `canal` ou a parte `videos` dos insumos não foi lida, `situacao` sai `'nao_determinada'` (valor que só a E7 escreve) e `confirmada` é falso. A Tarefa 10 confere se a E4 real já tem um valor para esse caso; se tiver, usa-se o dela e (b) some. **(reconciliação 13/10: R3) Terceiro caso, que este plano não previa: canal com a coleta pausada (E10, `collection_paused_at`). A E4 passou a devolver `parado` e `queda` não medidos com o motivo `coleta_pausada` e um estado próprio (~~proposto~~ **(reconciliação 13/10, emenda 1: S-I2) fixado: `'pausado'`**; plano da E4, 0.1, dependência 3, e Tarefa 4 de lá). A `situacao` daqui é `'pausado'` e `confirmada` é falso; nunca `'ativo'` nem `'parado'` para canal que ninguém está lendo. A lista de perguntas da Tarefa 10 ganha este caso.** **(reconciliação 13/10, emenda 2: D2-m7, S2-m1) Teste com este nome na Tarefa 12: `canal pausado: situacao pausado, confirmada false, parado e queda nao_medido com coleta_pausada`. O `tsc` pega o tipo; só o teste pega o `confirmada`.**
- **`medidas_indisponiveis`** (no topo da resposta): `{ total: number; indisponiveis: number; por_motivo: Record<string, number> }`. `total` é canais vezes nove. `por_motivo` vazio só com `indisponiveis: 0`.
- **`medidas_meta`** (no topo): `{ calculado_em: string; regra: number; duracao_ms: number; canais_cortados_por_tempo: number }`. `regra` é `MEASURE_RULES.ruleVersion`.
- **A frase do motivo** vem de um dicionário da E7 (`competitors-frases.ts`), tipado como `Record<MotivoNaoMedido, …>`: código novo na E4 quebra o typecheck daqui até ganhar frase. Nenhuma frase traz número escrito: os números vêm de `n`, `minimo`, `desde` e `fechaEm` da própria medida (a regra do projeto: sem limiar fixo em texto).

### 4.5 Tempo: o motor uma vez, os canais em paralelo, e um teto

`listCompetitorChannels` passa a: (1) ler os canais e os vídeos como hoje; (2) ler os perfis; (3) carregar o motor uma vez (`loadObservatory`, dentro de `try`); (4) para cada canal, com no máximo `CANAIS_EM_PARALELO = 4` ao mesmo tempo, chamar `lerCanal`, `lerVideosDoCanal`, `lerMarcasDoCanal` e `lerRetratosDoCanal`, e o montador com `series: 'nao_pedida'`, `mudancas: 'nao_pedida'`, `comentarios: 'nao_pedido'`. A rota ganha `export const maxDuration = 60` (igual a `readings`; a P-12 diz se isso baixa o teto de hoje). As constantes são operacionais (tempo e concorrência), não regra de negócio.

**(emenda 1: d:I-1, s:I1) O prazo é do pedido, não das medidas, e é uma corrida contra o relógio.** Os quatro passos acima dizem **o que** roda; **quando cada um para** é o que segue, e é o único desenho de tempo que vale **(emenda 2: s:m10: a descrição do teto antigo saiu daqui)**. O motivo: os leitores da E4 e as leituras do motor não têm tempo limite (F19), e sem a corrida a função podia ser morta aos 60 s levando junto as nove chaves que hoje respondem.
- `PRAZO_DO_PEDIDO_MS = 40_000`, contado de um `inicio` marcado na **primeira linha** de `listCompetitorChannels`. Tudo o que vem antes das medidas (as consultas de hoje e o perfil) consome o mesmo prazo.
- **O motor corre contra o relógio:** `loadObservatory` é disputado com um temporizador de `min(PRAZO_DO_MOTOR_MS = 15_000, o que resta do prazo)`. **(emenda 2: s:m1)** Com o prazo já vencido o motor **nem é chamado** (a corrida recebe uma função, não uma promessa já em andamento: Tarefa 12). Não terminou (ou o prazo já tinha acabado): `obs = null`, que é o caminho que já existe (taxa de acerto `leitura_falhou`, as outras sete medidas seguem), mais um aviso ao Sentry.
- **Cada canal corre contra o que resta do prazo:** canal que não começou, e canal **em andamento** que não terminou quando o prazo passa, saem com as nove medidas `leitura_falhou`, `situacao: 'nao_determinada'`, e contam em `canais_cortados_por_tempo`. Canal em andamento deixa de poder segurar a resposta.
- **A leitura perdida na corrida não é cancelada** (os leitores da E4 não aceitam sinal de cancelamento): ela segue em segundo plano até a função devolver a resposta. Custa uma consulta que ninguém lê; não segura nada. **Pedido ao controlador** (o plano da E4 não é meu): se os leitores de `M/ler.ts` ganharem tempo limite por consulta, a corrida continua valendo e passa a ser a segunda defesa.
- **O que o prazo não cobre, dito sem suavizar:** as consultas de vídeo de hoje (uma por canal, em série, sem tempo limite; este plano não as muda, para o corpo de hoje ficar igual). Se elas, sozinhas, levarem mais de cerca de 50 s, a plataforma mata a função: é o risco que a rota **já tem hoje**, e não é criado por esta etapa. A conta das parcelas está na seção 5.

**Por que ler as marcas se nenhuma das cinco medidas as usa:** `Insumos.marcas` não aceita "não pedida" no contrato da E4, e entregar ao montador uma parte "lida e vazia" seria mentir para ele. Custa duas consultas por canal. **Pedido ao controlador** (o plano da E4 não é meu): se a E4 aceitar `marcas: 'nao_pedida'`, a Tarefa 12 passa a usá-la e economiza as duas.

### 4.6 A ferramenta MCP

`YoutubeObservatoryShape` passa a ter exatamente o que o adaptador lê: `action`, `type`, `bookmarked`, `tier`, `limit`, `fmt`, `campos`. `channel_id` sai do anúncio. A descrição de `get_outliers` passa a dizer o que ele faz (vídeos com múltiplo de 2 ou mais). Um teste compara a lista de chaves do anúncio com a lista de parâmetros lidos pelo adaptador, nos dois sentidos, para o desencontro não voltar.

### 4.7 Segurança e dado pessoal

- **Quem lê:** as mesmas credenciais de hoje: chave com `read` (ou `write`, `admin`) e sessão de quem edita o site (`auth.ts:111-118`). Em produção: `cowork-permanent` e `forja (so leitura)` (C0.4). A chave do perfil `observatorio_leitura` é recusada em todo o pipeline (`auth.ts:99-108`).
- **O que sai é da classe (i) do spec (8.1.3), dado que o YouTube mostra a qualquer um:** handle, país e data de criação de canal de terceiro; nome, avatar e disponibilidade; tags, categoria, duração e idioma de vídeo; e medidas calculadas sobre contagens públicas. Nenhum dado do canal próprio, nenhum texto de comentário, nenhum autor.
- **O que nunca sai, com teste:** `description` do canal, `raw`, texto e autor de comentário, linha de `yt_own_*` (Tarefa 8).
- **Cliente de serviço:** os leitores novos rodam com ele (ignora RLS). O site é o da chave ou da sessão (F14), nunca um parâmetro do pedido e nunca o GUC `app.site_id`. Todo leitor novo filtra por `site_id`, com prova por mutação. `competitor_videos` não tem `site_id`: os vídeos buscados por id são conferidos contra os canais do site antes de entrarem na resposta.
- **Retenção e apagamento:** a etapa não grava nada. Canal ou vídeo apagado some da resposta no mesmo instante, por ter saído do banco.
- **Sentry e erro:** só código de catálogo, nome de classe e SQLSTATE. Nenhuma mensagem do banco vai para a resposta: as frases são do dicionário.

---

## 5. As contas

**Linhas gravadas:** zero por dia, zero por ano. **Chamadas à API do YouTube:** zero. **Cron:** nenhum; os orçamentos acoplados (20 min do claim, 25 min do cron, 30 min do vigia) não são tocados.

**Consultas ao banco por chamada de `channels`, com N canais (hoje 15, não conferido nesta data: P-4).**

| Parte | Hoje | Lote 1 | Lote 2 |
|---|---|---|---|
| canais | 1 | 1 | 1 |
| vídeos para o engajamento (um por canal, como hoje) | N | N | N |
| perfil (canais e versões de `custom_url`) | | 2 | 2 |
| motor (`loadObservatory`: uma leitura paginada por tabela, a mesma de `outliers`) | | | as de `outliers` hoje (não contadas aqui; P-4 dá o volume) |
| por canal: `lerCanal` 1, vídeos 1 a 2, marcas 2 por bloco de 150, retratos 1 | | | 5 a 6 por canal **se** `lerCanal` rodar uma vez só; **8 a 9** se cada leitor repetir a leitura do canal, como o texto da E4 diz ("todo leitor abaixo chama este primeiro", Tarefa 13 dela) **(emenda 1: d:m-4, s:I1)** |
| **Total com N = 15** | 16 | 18 | 18 + motor + 75 a 135 (não medido; a pergunta (j) da Tarefa 10 dá o número por leitor e esta linha é refeita no relatório dela) |

Com 4 canais em paralelo, as 75 a 135 consultas por canal viram cerca de 20 a 35 rodadas. **O tempo real não foi medido** e não é afirmado: a Tarefa 15 mede no banco local com a semente (15 canais, 1.400 vídeos) e o D0 do Lote 2 mede em produção (`time_total`). Esperado para aceitar: abaixo de 10 s. Entre 10 e 40 s: a resposta sai inteira, e abre-se o conserto (ler os vídeos de todos os canais numa consulta só). A partir de 40 s: canais cortados, medidas `leitura_falhou`, `canais_cortados_por_tempo` maior que zero, e o D0 fica vermelho.

**(emenda 1: d:I-1, s:I1) A conta do tempo máximo, parcela por parcela, contra os 60 s da plataforma.**

| Parcela | Limite | De onde vem o limite |
|---|---|---|
| consultas de hoje (canais, e vídeos de cada canal em série): terminam em `t0` | **nenhum**, como hoje | F19; este plano não as muda |
| perfil | até 10 s depois de `t0` | 2 consultas de uma página cada (até 75 canais e 150 versões), 5 s cada |
| motor | até 15 s, e nunca além dos 40 s do pedido | corrida com temporizador (4.5) |
| canais | até os 40 s do pedido | corrida com temporizador (4.5) |
| montar e serializar a resposta | não medido; sem ida ao banco | a Tarefa 15 anota |

A resposta sai, no pior caso, em `max(40 s, t0 + 10 s)` mais a montagem. Com `t0` de até 30 s sobram 20 s de folga contra os 60 s. A função só é morta se `t0` passar de cerca de 50 s, e nesse caso a rota de hoje também estaria perto de ser morta (com o teto que a P-12 informar). Com `t0` acima de 30 s o motor e os canais não chegam a rodar: a resposta sai com as nove chaves, o perfil e todas as medidas `leitura_falhou`, o que é vermelho no D0, não 504.

**(emenda 1: d:m-1) Volume de `competitor_field_versions` (ordem de grandeza, não medida; a P-2 dá o número).** A primeira leitura grava uma linha por campo: cerca de 1.400 vídeos × 10 campos mais 15 canais × 7 = 14.100 linhas no primeiro dia, e mais 10 por vídeo novo. Com 75 canais (o teto do site) são da ordem de 70.000 só de primeiras leituras. A tabela não tem índice que comece por `site_id`; por isso a página de mudanças passa a filtrar também por `in('competitor_channel_id', <canais do site>)`, que usa `idx_cfv_channel_seen` (Tarefa 4), e a contagem é repetida na conferência `e7-l2-d7`.

**`changes` com `campos=todos`:** a consulta de hoje, mais até 8 (primeira leitura do site; canais; **emenda 2: d:I-2b**, as duas da ponta dos vídeos; a página de mudanças; títulos; valores anteriores de vídeo e de canal). Sem o parâmetro: a de hoje, só.

**Tamanho da resposta de `channels` (estimado; medido no D0).** Hoje cerca de 0,4 KB por canal. Lote 1: mais 0,15 KB. Lote 2: nove medidas de 0,15 a 0,3 KB cada, cerca de 2 KB por canal. Com 15 canais: perto de 40 KB pela rota HTTP. **Com 75 canais (o teto do site, F13) seriam 190 KB, que não cabem numa resposta de ferramenta.** Não há paginação nesta rota e o plano não cria: é a dívida 2 (seção 13), com gatilho escrito na conferência `e7-l2-d7` **(emenda 2: s:m3: o gatilho passou a ser o da porta MCP, que estoura antes; o número de canais sai da medição da Tarefa 15, e não de "30")**.

**(emenda 1: s:I5) O tamanho que decide é o da porta MCP, e ele é maior.** A ferramenta entrega o JSON com indentação (F17), e a resposta nova é bem aninhada: o texto pela ferramenta pode chegar perto do dobro dos bytes da rota (estimativa, não medida). Um programa que corta ou recusa resposta longa de ferramenta deixaria de receber a lista sem erro do nosso lado, com a rota HTTP verde. Por isso: a Tarefa 12 mede `toMcpSuccess(data).content[0].text.length` sobre uma base de 15 canais e anota; o limite é o da P-14 (60.000 caracteres sem a resposta do dono); **se passar, o conserto entra na Tarefa 13 e não em D+7:** a ação `list_channels` do adaptador passa a montar o resultado com `JSON.stringify(data)` sem indentação (só essa ação; `toMcpSuccess`, que é de todas as ferramentas, não é tocado), e o teste mede de novo. Se mesmo sem indentação passar do limite com 15 canais: parar e avisar (a dívida 2 vira pré-requisito do Lote 2). **(emenda 2: s:m3) E depois do envio, quem avisa do crescimento:** a ação `list_channels` do adaptador mede o texto que vai devolver e, acima de 80% do limite da P-14, manda `Sentry.captureMessage('e7.resposta_da_ferramenta_grande')` com o número de caracteres e o de canais (sem dado nenhum). A conferência `e7-l2-d7` roda uma vez só; canal acrescentado depois dela passa a ter esse aviso. **(emenda 2: s:m4)** `get_changes` com `campos: 'todos'` sai pela mesma porta, com `limit` padrão 50 (F22): a Tarefa 6b mede o texto dela antes do envio do Lote 1.

**Quando estoura:** tempo, o prazo de 40 s descrito acima; tamanho, nada corta sozinho (por isso a medição antes do envio e a conferência); limite de taxa da chave (100 por minuto, em memória), não muda.

---

## 6. O que acontece quando o dado não existe, e em cada falha

Não há cron nem e-mail nesta etapa. "Vermelho" aqui é: a resposta diz a falha com palavras, e a conferência com data fica por fazer. Em nenhuma linha abaixo a rota responde 200 com o dado faltando em silêncio.

### 6.1 `competitors/channels`

| Situação | O que a resposta traz | Veredito |
|---|---|---|
| Erro do banco na lista de canais | 500, `DB_ERROR` (como hoje) | vermelho, com o código |
| Site sem canal | `channels: []`, `count: 0`; `medidas_indisponiveis: { total: 0, indisponiveis: 0, por_motivo: {} }` | verde: é a resposta certa |
| Colunas da MG1 ausentes | perfil de todos: `nao_lido`, `tabela_ausente`, com a frase; chaves antigas normais | nota na resposta |
| Erro do banco na leitura do perfil | perfil de todos: `nao_lido`, `erro_do_banco` | nota na resposta |
| Canal sem versão corrente de `custom_url` **ou de `country`** (emenda 1: s:m6; nunca relido depois da E1, ou a gravação do histórico falhou) | perfil dele: `nao_lido`, `canal_ainda_nao_relido`, com a frase que não afirma a causa | nota na resposta |
| Versão gravada e linha do canal ainda não atualizada (emenda 1: s:m6) | `lido`, com `handle` e `pais` das versões; `criado_em` pode vir `null` | nota no documento: `criado_em` nulo é "não informado, ou ainda não gravado" |
| Canal relido, sem país ou sem handle no YouTube | `estado: 'lido'`, o campo `null` | verde: o documento diz o que o nulo quer dizer |
| Mais de 1.000 canais ou versões numa página sem a seguinte | perfil: `nao_lido`, `cortado` | nota na resposta |
| O motor lança (erro de banco em `loadRows`) | M4 dos dois formatos, em todo canal: `leitura_falhou`; as outras sete seguem; `Sentry.captureException` com a classe | nota na resposta |
| Motor carregado, canal sem múltiplo em nenhum vídeo | M4: o que a E4 responder (`sem_multiplo` ou `poucos_videos`) | nota |
| Tabela de marcas ausente (MG4 não aplicada) | nenhuma das nove medidas muda (não dependem de marcas) | verde |
| Uma parte de um canal não lida (`erro_do_banco`, `cortado`) | só as medidas que dependem dela: `leitura_falhou`; o resto do canal e os outros canais seguem | nota |
| Parte `canal` ou `videos` não lida | `estado_do_canal.situacao: 'nao_determinada'`, `confirmada: false` | nota; nunca "ativo" |
| Queda não medida (antes de 14/12/2026, toda) | `situacao` pelo que foi medido, `confirmada: false` se for `'ativo'`, `queda` com o motivo e a frase | nota |
| Canal sem retrato suficiente, sem vídeo, sem publicação | o motivo da E4 (`pouco_registro`, `poucos_videos`, `sem_publicacao`), com a frase | nota |
| Uma medida lança dentro do montador | aquela medida: `calculo_falhou`; `falhas` do montador vai ao Sentry (nome da medida e da classe) | nota |
| O orquestrador inteiro lança (defeito nosso) | todas as medidas de todos os canais: `leitura_falhou`; `Sentry.captureException`; as chaves antigas e o perfil seguem | nota na resposta, erro no Sentry |
| O prazo do pedido (40 s) passa **(emenda 1: d:I-1, s:I1)** | canais não começados **e canais em andamento que não terminaram**: nove medidas `leitura_falhou`, `situacao: 'nao_determinada'`; `canais_cortados_por_tempo` > 0; as nove chaves e o perfil saem | nota; D0 vermelho |
| O motor não termina em 15 s, ou o prazo acabou antes dele **(emenda 1)** | `obs = null`: taxa de acerto dos dois formatos `leitura_falhou` em todo canal; as outras sete seguem; aviso ao Sentry | nota |
| As consultas de hoje gastam o prazo inteiro **(emenda 1)** | motor e canais não rodam: todas as medidas `leitura_falhou`, `canais_cortados_por_tempo` = o número de canais; as nove chaves e o perfil saem | nota; D0 vermelho |
| Resposta `{ data: null, error: null }` nas consultas do perfil **(emenda 1: d:m-8)** | perfil de todos: `nao_lido`, `erro_do_banco`; nunca "lido, mapa vazio" | nota na resposta |
| A plataforma mata a função (60 s) | 504 da Vercel | vermelho. **(emenda 1)** Pode acontecer se as consultas de vídeo de hoje, que não têm tempo limite e este plano não muda, passarem sozinhas de cerca de 50 s (conta na seção 5); é o risco que a rota já tem hoje. Tudo o que a etapa acrescenta corre contra o prazo. O D0 mede `time_total` |
| Código do motivo sem frase | não compila (`Record<MotivoNaoMedido, …>`); em execução, com código desconhecido, a frase é a de `leitura_falhou` e vai um aviso ao Sentry | não chega a produção |

### 6.2 `competitors/changes`

| Situação | O que a resposta traz | Veredito |
|---|---|---|
| Sem `campos` | o corpo de hoje, sem chave nova, sem consulta nova | verde |
| `campos=todos`, tabela ausente | `changes` normal; `mudancas_de_campo: { estado: 'nao_lido', motivo: 'tabela_ausente', frase }` | nota |
| `campos=todos`, erro do banco na página de mudanças | `changes` normal; `nao_lido`, `erro_do_banco` | nota |
| `campos=todos`, site sem nenhuma versão de campo | `nao_lido`, `coleta_ainda_nao_comecou` | nota |
| `campos=todos`, nenhuma mudança (só primeiras leituras) | `estado: 'lido'`, `itens: []`, `count: 0`, `coleta_desde` com data **e `lido_ate`** | verde só se **as duas pontas** forem de hoje, `lido_ate.mais_recente` e `lido_ate.videos_mais_recente` (emenda 2: d:I-2b): é resposta |
| `campos=todos`, a captura de vídeo parou e a do canal segue **(emenda 2: d:I-2b)** | `estado: 'lido'`, `lido_ate.mais_recente` de hoje e `lido_ate.videos_mais_recente` com a data da última leitura boa de vídeo, anterior a hoje | nota: a resposta deixa de ser igual à de "nenhum vídeo mudou"; o documento manda dizer até quando os campos de vídeo valem |
| `campos=todos`, nenhum vídeo com leitura **(emenda 2: d:I-2b)** | `videos_mais_recente: null` e `videos_mais_antigo: null` | nota: `null` é "nenhum vídeo com leitura", nunca "em dia" |
| `campos=todos`, erro, tabela ausente, exceção ou `{ data: null, error: null }` na ponta dos vídeos (7) **(emenda 2: d:I-2b)** | `changes` normal; `mudancas_de_campo`: `nao_lido` com o motivo | nota |
| Vídeo da página (2) que não volta em (6), com (6) lida **(emenda 2: s:m7)** | o item é descartado e contado em `video_ausente`; sem aviso ao Sentry | nota: o vídeo foi apagado no meio da leitura |
| `campos=todos`, a coleta parou há dias **(emenda 1: d:I-2)** | `estado: 'lido'`, a lista que existir, e `lido_ate.mais_recente` com a data da última leitura boa, anterior a hoje | nota: a resposta deixa de ser igual à de "nada mudou"; o documento manda dizer até quando a lista vale |
| `campos=todos`, canal do site nunca relido **(emenda 1: d:I-2)** | `lido_ate.canais_sem_leitura` > 0 | nota |
| `campos=todos`, erro, tabela ausente, exceção ou `{ data: null, error: null }` na primeira leitura do site (1), nos canais (5) ou nos vídeos (6) **(emenda 1: s:I2, d:m-8)** | `changes` normal; `mudancas_de_campo`: `nao_lido` com `erro_do_banco` ou `tabela_ausente`; **nunca** `lido` com lista vazia nem `coleta_ainda_nao_comecou` | nota |
| Mais mudanças que o `limit` | `cortado: true`, `limite` com o número (e `proximo`, se a continuação da P-2 entrou) | nota; o documento diz o que fazer |
| Falha ao buscar os valores anteriores | os itens saem, cada um com `valor_anterior: { estado: 'nao_lido', motivo: 'erro_do_banco' }` | nota |
| Mudança sem versão anterior (não deveria: a primeira leitura existe) | `valor_anterior: { estado: 'nao_lido', motivo: 'sem_versao_anterior' }` | nota |
| Vídeo da mudança não é de canal do site (com (5) e (6) lidas) | o item é descartado e contado em `video_de_outro_site` **(emenda 1: s:I2)**, com aviso ao Sentry | nota; é defeito de dado |
| Linha com campo fora da lista do alvo | descartada e contada em `fora_da_lista` | nota |
| `campos=outro` | 400, `VALIDATION_ERROR` | vermelho, com o texto |
| Erro do banco em `competitor_changes` | 500, `DB_ERROR` (como hoje), com ou sem o parâmetro | vermelho |
| Chave sem `read`, modo aviso | lê e é registrada (E19); modo recusa: 403 | o da E19 |
| Limite de taxa da chave | 429 (como hoje) | o de hoje |

### 6.3 Interruptor

**Não há variável.** O spec (linha 417) dá a volta desta etapa como "reverter o commit", e uma variável que desligasse as medidas teria de inventar um estado "desligado" que a E4 não tem. O que protege a rota é o prazo do pedido, de 40 s (4.5). As duas integrações (Tarefas 5 e 13) são um commit cada, para reverter sozinhas.

---

## 7. Simulação do dia do envio e dos seguintes

**Lote 1, D0.** O deploy sobe. O Cowork que chamar `channels` recebe as nove chaves de sempre e `perfil`. Com a P-1 dizendo que os 15 canais têm versão de handle: 15 perfis `lido`. `changes` sem parâmetro: igual. `changes?campos=todos`: `lido`, com as mudanças desde a primeira leitura da E1 (data da P-2). O documento novo passa a ser servido por `/api/pipeline/docs/youtube`. O dono cola os três comandos; o agente anota e preenche `feitaEm`. **(emenda 2: d:I-2b)** Em `lido_ate`, as duas pontas de hoje: a do canal e a dos vídeos.

**Lote 1, D+7.** A P-5 de novo: quem leu as duas rotas na semana, e com que chave. Zero leituras do Cowork não é falha desta etapa (decisão 53: o dono não quer depender do Cowork estar online); fica anotado.

**Lote 2, D0.** As nove medidas aparecem em todo canal. O que se espera ver, por desenho: `queda` não medida em todos, **(emenda 1: d:I-3, s:m5)** cada uma com um motivo do catálogo (a janela cruza a mudança de contagem até 14/12/2026, e canal com menos de 112 dias de retrato também não tem as bordas; qual dos dois motivos aparece é a regra da E4, pergunta (i) da Tarefa 10, e a P-10 diz a cobertura por canal: nenhum número de canais por motivo é esperado); `direcao_do_canal` medida nos canais com 56 dias de retrato sem buraco na borda (C-5 da E4 diz quantos); `ritmo` e `direcao_dos_videos_novos` medidos na maioria dos longos; Shorts com muitos `poucos_videos`. `medidas_indisponiveis.indisponiveis` alto é o esperado, não defeito: o que se confere é que **cada** uma tem motivo do catálogo e frase, e que `canais_cortados_por_tempo` é 0.

**Lote 2, D+1 e D+7.** Mesma leitura; `indisponiveis` não pode subir sem causa (subiu: um leitor passou a falhar; ver `por_motivo.leitura_falhou`).

**15/12/2026.** `por_motivo.janela_cruza_mudanca_de_contagem` cai a zero. **(emenda 1: d:I-3)** Isso não quer dizer que a queda passa a ser medida em todo canal: nos que têm menos de 112 dias de retrato ela continua não medida, por falta de borda, até a data que a P-10 deu para cada um.

---

## 8. Desvios do texto do spec, com o motivo

| # | O spec (ou o brief) diz | O plano faz | Motivo |
|---|---|---|---|
| 1 | Brief: o Cowork recebe "medidas e marcas da E4, série, comentários" | só as cinco medidas por canal e as mudanças de campo | o spec aprovado (linhas 13 e 15) limita a isso; pergunta 1 |
| 2 | "M11 pode entrar em `competitors/channels`" | não entra | o leitor de M11 (E4, Tarefa 15) exige o token de quem edita o site, e o spec diz que ele não se fabrica de fora; pergunta 2 |
| 3 | "Atualizar `docs/cowork-pipeline-reference.md`, e rodar a semente da referência" (e item 52: "os dois documentos") | atualiza só `cowork-docs-youtube.md`; a semente roda sozinha no pre-commit e não leva esse documento | F7 e F8: o segundo arquivo não fala do Observatório e nenhuma semente o lê; pergunta 7 |
| 4 | "handle, país, data de criação" como campos soltos | um objeto `perfil` com estado | sem estado, `null` não distingue "sem país" de "ainda não lido" (4.2) |
| 5 | "o texto que o Cowork recebe contém a frase do motivo" | dicionário de frases próprio da E7 | a E4 só entrega o código, e a frase das telas (E5) ainda não existe (F3) |
| 6 | "estado M8" | `situacao` mais `confirmada`, e o valor `nao_determinada` | "ativo" não pode sair por falta de leitura (4.4) |
| 7 | "taxa de acerto M4" e "ritmo M6", sem dizer o formato | os dois formatos, separados | item 32 da E4: longos e Shorts nunca juntos |
| 8 | `campos=todos` "devolve também as mudanças de campo" | todas as do catálogo menos `description` do canal; valor desconhecido de `campos` dá 400 | linha 15 do spec (descrição do canal não sai); falha em verde |
| 9 | não fala do MCP | a ferramenta ganha `campos` e passa a anunciar o que o adaptador lê | F5: sem isso `campos` seria o quarto parâmetro ignorado em silêncio |
| 10 | "aditivo" no documento | os blocos `channels` e `changes` são **reescritos** para o formato real | F4: acrescentar a um bloco falso repete o erro |
| 11 | "o retrato de `buildSent` de antes e de depois é igual (teste)" | retrato em arquivo, gerado antes de qualquer código da etapa, mais uma guarda de importação | não existe retrato congelado hoje (os testes da forja não têm nenhum) |
| 12 | sem interruptor | sem interruptor, com prazo do pedido (4.5) | 6.3 |
| 13 | uma etapa | dois envios | o Lote 1 não depende da E4; pergunta 4 |

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`. `S/` = `src/lib/pipeline/services/`; `TP/` = `test/api/pipeline/`; `M/` = `src/lib/youtube/observatorio/medidas/` (da E4; só leitura). "Novo" = criado por esta etapa. A lista de cada tarefa é fechada: precisou de outro arquivo, para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 1 | Retrato de `buildSent` e guarda de importação (item 53) | `test/youtube/observatorio/forja-sent-congelado.test.ts`, `test/youtube/observatorio/__retratos__/forja-sent.json` (novos) | nada; **antes de qualquer código** | 2 |
| 2 | Fixture e retrato do corpo de hoje de `changes` e `channels` (**emenda 2: d:m-1, s:m6:** se a continuação da P-2 entrar depois de a 2 estar commitada, a Tarefa 4 pode editar `TP/e7-fixture.ts` só para acrescentar `or`) | `TP/e7-fixture.ts`, `TP/youtube-competitors-e7-paridade.test.ts`, `TP/__retratos__/e7-changes-hoje.json`, `TP/__retratos__/e7-channels-hoje.json` (novos) | nada; **antes de qualquer código** | 1 |
| 3 | Leitor do perfil | `S/competitors-perfil.ts`, `TP/youtube-competitors-e7-perfil.test.ts` (novos) | 2 (usa o falso) | 4, 6 |
| 4 | Leitor das mudanças de campo | `S/competitors-campos.ts`, `TP/youtube-competitors-e7-campos.test.ts` (novos); **(emenda 2: d:m-1, s:m6) só se a continuação entrar e o falso ainda não tiver `or`:** `TP/e7-fixture.ts` e o teste do falso no arquivo de paridade | 2 | 3, 6 |
| 5 | **Integração do Lote 1** | `S/competitors.ts`; `src/app/api/pipeline/youtube/competitors/changes/route.ts`; `TP/youtube-competitors-e7-paridade.test.ts` (acrescenta casos) | 3, 4 | nenhuma |
| 6a | MCP: anúncio igual ao que o adaptador já lê (`type`, `bookmarked`, `tier`; sai `channel_id`) **(emenda 1: s:m2)** | `src/lib/pipeline/mcp/tools.ts` (só `YoutubeObservatoryShape` e a palavra `export`); `src/lib/pipeline/mcp/services/youtube-observatory.ts`; `test/mcp/youtube-observatory-parametros.test.ts` (novo) | nada | 3, 4 |
| 6b | MCP: `campos` no anúncio e repassado ao serviço **(emenda 1: s:m2)** | os mesmos três arquivos da 6a | **5** (antes dela o parâmetro seria anunciado e ignorado) | 8 |
| 7 | Documento e prompt, Lote 1 (**o commit é do controlador**) | `data/pipeline-docs/cowork-docs-youtube.md` (só da seção "Competitor Observatory" até antes de `outliers`, e o bloco "2. Competitor Monitoring"); `src/lib/pipeline/mcp/prompts.ts` (só as linhas 1266 a 1272); `test/mcp/youtube-cowork-docs-observatorio.test.ts` (novo) | 5, 6b; P-8 e P-8b | 8, 8b |
| 8 | Varredura de saída (itens 89, 119, 168) | `TP/youtube-competitors-e7-varredura.test.ts` (novo) | 5 | 6b, 7, 8b |
| 8b | Lote 1 contra o PostgREST de verdade **(emenda 1: s:I3)** | `test/integration/observatorio-a5-e7-lote1.test.ts` (novo) | 5; P-11; `bythiago_int` | 7, 8 |
| 9 | Envio do Lote 1 e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | 1 a 8b; P-1 a P-9, P-11 a P-13 e P-15 (a P-10 é do Lote 2; a P-14 vale nos dois, emenda 2) | nenhuma |
| 10 | Conferência do contrato da E4 (leitura) | nenhum arquivo de código; relatório em `.superpowers/sdd/a5-e7/task-10-report.md` | E4, Tarefas 1, 13 e 14 commitadas | 1 a 9 |
| 11 | Frases dos motivos | `S/competitors-frases.ts`, `TP/youtube-competitors-e7-frases.test.ts` (novos) | 10 | 12 |
| 12 | Orquestrador das medidas | `S/competitors-medidas.ts`, `TP/youtube-competitors-e7-medidas.test.ts` (novos); `TP/e7-fixture.ts` (acrescenta tabelas) | 10, 11 | nenhuma do Lote 2 |
| 13 | **Integração do Lote 2** | `S/competitors.ts`; `src/app/api/pipeline/youtube/competitors/channels/route.ts`; `TP/youtube-competitors-e7-paridade.test.ts` (acrescenta casos); **(emenda 2: s:m3) sempre**, pelo aviso de tamanho: `src/lib/pipeline/mcp/services/youtube-observatory.ts` (só a ação `list_channels`) e `test/mcp/youtube-observatory-parametros.test.ts`; o conserto da indentação (emenda 1: s:I5), no mesmo arquivo, continua condicional à medição da Tarefa 12 | 12; **5 e 6b já commitadas** | nenhuma |
| 14 | Documento e prompt, Lote 2, e varredura estendida (**o commit é do controlador**) | `data/pipeline-docs/cowork-docs-youtube.md` (o bloco de `channels`); `src/lib/pipeline/mcp/prompts.ts` (uma linha a mais no bloco que a Tarefa 7 escreveu, **emenda 1: s:m3**); `test/mcp/youtube-cowork-docs-observatorio.test.ts`; `TP/youtube-competitors-e7-varredura.test.ts` | 13; P-8 e P-8b | 15 |
| 15 | Testes de ponta contra o banco, com tempo medido | `test/integration/observatorio-a5-e7-cowork.test.ts` (novo) | 13; `bythiago_int` | 14 |
| 16 | Envio do Lote 2 e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | 10 a 15; lote da E4 em produção | nenhuma |

**Ondas.** Já: 1 e 2, juntas (a P-13 antes da 1). Depois: 3, 4 e a 6a, juntas. Depois: 5, sozinha. Depois: 6b, 8 e 8b, juntas; em seguida a 7 (que depende da 6b). Por último no Lote 1: 9. **(emenda 1: s:m2, s:I3)** Quando a E4 tiver as Tarefas 1, 13 e 14 commitadas: 10; depois 11; depois 12; depois 13, sozinha; depois 14 e 15, juntas; por último 16.

**Arquivos compartilhados (uma tarefa por vez em cada um).**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `S/competitors.ts` | ninguém mais na A5 (a E1/E2 só exige que `outliers` e `insights` não mudem) | **só a Tarefa 5 e, depois dela, só a 13**, em fila, nunca juntas; um commit cada; `listCompetitorOutliers`, `getCompetitorInsights` e `loadObservatory` não são editados |
| `data/pipeline-docs/cowork-docs-youtube.md` | o commit local `2035904f` (regra da forja, de outra frente, F15); a linha 161 é pendência do dono (plano da E19) | **só a Tarefa 7 e, depois, só a 14**; nada acima da linha 600; a linha 161 não é tocada; o envio do Lote 1 leva `2035904f` junto ou depois dele (Tarefa 9) |
| `src/lib/pipeline/mcp/tools.ts` | ninguém na A5 | **só a Tarefa 6a e, depois da 5, a 6b**; um bloco de 10 linhas e uma palavra |
| `src/lib/pipeline/mcp/services/youtube-observatory.ts` | ninguém na A5 | **6a, depois 6b, depois a 13** (emenda 2: s:m3: a 13 passou a tocar sempre a ação `list_channels`), em fila |
| `src/lib/pipeline/mcp/prompts.ts` | ninguém na A5 | **só a Tarefa 7 e, depois, a 14** (uma linha, emenda 1: s:m3); sete linhas |
| `lib/conferencias.ts`, o teste e o espelho | todas as etapas | um bloco por lote (`E7_LOTE1_DEPLOY`, `E7_LOTE2_DEPLOY`); **só as Tarefas 9 e 16**; o arquivo local difere do remoto em blocos de outros lotes: envio por lista de commits |
| `TP/e7-fixture.ts` | só esta etapa | nasce na 2; a 12 acrescenta tabelas, sem mudar o que a 2 escreveu; a 4 só acrescenta `or`, e só no caso da continuação (emenda 2) |
| `TP/youtube-competitors.test.ts` (o de hoje) | ninguém | **não é editado**: tem de continuar verde como está, com o falso dele, nas Tarefas 5 e 13 |
| `M/**`, `observatorio/rules.ts`, `observatorio/forja/**`, `pack.ts`, `load*.ts`, `consumidores-semanal.test.ts`, `comentarios-varredura.test.ts`, `api-registry.ts`, `leitura-*.ts`, `helpers.ts`, `auth.ts`, `mcp/resources.ts`, `docs/cowork-*`, `scripts/seed-pipeline-reference.ts`, `test/helpers/**` | E4, E5, E2, E19, E17 e outras | **este plano não toca** |

**Restrições globais.** TypeScript estrito, sem `any`, sem `as unknown as` novo (`bash scripts/check-type-debt.sh`). Arquivos em kebab-case. Os três módulos de servidor começam com `import 'server-only'`; `competitors-frases.ts` é puro. Nenhum texto de exceção vai para a resposta: código de catálogo e frase do dicionário; ao Sentry, só nome de classe e SQLSTATE. Toda consulta nova leva `.abortSignal(AbortSignal.timeout(LEITURA_MS))` com `LEITURA_MS = 5_000`, é paginada em 1.000 linhas e usa `in()` em blocos de 150. **(emenda 1: s:m7, d:m-2, d:m-8)** Toda leitura paginada ordena por `id` (página sem ordem estável repete e pula linha) e pede a página seguinte enquanto a anterior vier cheia; **exatamente 1.000 linhas seguidas de uma página vazia é leitura completa**; `cortado` é só o caso em que o teto de páginas (`MAX_PAGINAS = 10`) foi atingido com a última página cheia. Resposta `{ data: null, error: null }` é tratada como `erro_do_banco`, nunca como zero linhas. Os leitores da E4 (`M/ler.ts`) não são desta etapa e não têm tempo limite por consulta: quem os limita aqui é o prazo do pedido (4.5). Testes de servidor com `// @vitest-environment node`. Datas de teste relativas a um `AGORA` fixo do passado declarado no arquivo; nenhuma data futura escrita. Os retratos em arquivo usam `toMatchFileSnapshot`; ninguém roda `vitest -u` sem dizer no relatório por quê. Cada tarefa termina com `npm run typecheck -w apps/web` limpo, os testes dos seus arquivos verdes (saída em arquivo; no relatório, só as falhas) e commit local por lista explícita de arquivos, sem push **(emenda 1: s:I6: menos as Tarefas 7 e 14, em que o agente entrega os arquivos prontos e testados e quem commita é o controlador, seção 2)**. Regras do implementador: `.superpowers/sdd/a5-e1-e2/regras-implementador.md` e `.superpowers/sdd/a5-e11/regras-implementador.md`. Modelo dos implementadores: Sonnet, effort `high`. **(emenda 2: s:m10) O brief de cada tarefa leva o texto final dela:** onde este plano ainda tiver, lado a lado, uma frase e a emenda que a substitui, o controlador entrega ao implementador só a que vale (a da emenda de número maior), e não o trecho cru.

---

## 10. As tarefas

Em toda tarefa: **os testes são escritos antes e têm de falhar primeiro** (o vermelho vai no relatório `.superpowers/sdd/a5-e7/task-<N>-report.md`). Onde a tabela diz "mutação", o relatório mostra o vermelho obtido ao remover o filtro à mão e o verde ao devolvê-lo.

### Tarefa 1: retrato de `buildSent` e guarda de importação (item 53)

**Objetivo.** Ter o "antes" gravado em arquivo antes de a etapa escrever a primeira linha, e impedir que a forja passe a importar o que é do Cowork.
**Contrato.** O teste monta o motor com o oráculo que `forja-sent.test.ts` já usa (`loadOracle`, `datasetFromOracle` de `./oracle`), chama `buildSent(obs, tipo, alvo)` para todo tipo de leitura e todo nicho do oráculo, e para `leitura-video` dos 5 primeiros vídeos por ordem de `id`, serializa com as chaves ordenadas e compara com `__retratos__/forja-sent.json`. O cabeçalho do arquivo de teste diz: "Este retrato é a prova do item 53 da A5 (a E7 não muda o pacote da forja). Outra etapa que mude o pacote de propósito regenera com `vitest -u` neste arquivo e diz no commit."
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `o pacote da forja é o do retrato` | o oráculo | igual ao arquivo |
| `o retrato não está vazio` | o arquivo | mais de 10 pacotes, e pelo menos um com `nVideos` maior que zero (retrato vazio contra pacote vazio daria verde) |
| `nada em observatorio/forja nem pack.ts importa de lib/pipeline/services/competitors` | os arquivos das duas origens | nenhuma ocorrência de `pipeline/services/competitors` |
| `nada em observatorio/forja importa de observatorio/medidas` | idem | nenhuma ocorrência (se a E4 ou a E5 precisarem, mudam este teste de propósito) |
| `a rota readings não importa os módulos novos` | `readings/route.ts` e `S/forja-queue.ts` | nenhuma ocorrência de `competitors-medidas`, `competitors-campos`, `competitors-perfil`, `competitors-frases` |
| `as pastas varridas existem` | os caminhos | existem (pasta que some não vira verde) |

**Pronto quando:** o retrato foi gerado com a árvore **antes** de qualquer commit das Tarefas 3 a 16 (o relatório traz o hash do `HEAD` usado e o `sha256` do arquivo), e os testes estão verdes. **(emenda 1: s:I4)** O relatório traz também o resultado da P-13: o `sha256` do retrato gerado na árvore do lote (montada pelo controlador), ao lado do da árvore local. Iguais: seguir. Diferentes: a tarefa fica pronta do mesmo jeito (o retrato que vale é o local), **e o relatório diz em letras grandes que o Lote 1 só vai depois do lote que leva os commits da E2**; o agente não regenera nada na árvore do lote.

### Tarefa 2: fixture e retrato do corpo de hoje (itens 9, 51, 216)

**Objetivo.** Congelar o que `changes` e `channels` devolvem hoje, sobre uma base fixa, antes de mexer no serviço.
**Arquivos.** `TP/e7-fixture.ts`: um falso de PostgREST em memória (tabelas por nome; `select`, `eq`, `neq`, `in`, `is`, `lt`, `gte`, `lte`, `or`, `order`, `limit`, `range`, `abortSignal`, `maybeSingle`; **(emenda 2: d:m-1, s:m6, d:I-2b)** o `or` aceita só a forma da continuação (`a.lt.X,and(a.eq.X,b.lt.Y)`, com o valor entre aspas duplas) e lança em qualquer outra; o `order` obedece `ascending` e `nullsFirst`, e sem `nullsFirst` imita o padrão do Postgres (nulos por último na ordem crescente, **primeiro na decrescente**); a incorporação `competitor_videos!inner(…competitor_channels!inner(…))` que `listCompetitorChanges` usa; contador de consultas por tabela; registro das colunas pedidas; modo "tabela ausente" que devolve o erro `42P01`/`PGRST205`; modo "erro" e modo "lança"). E a base: **dois sites** (A e B), 3 canais em A e 1 em B com o mesmo `channel_id` do YouTube de um canal de A, 12 vídeos, 8 linhas de `competitor_changes` em A e 2 em B, e `AGORA` fixo.
**Testes** (`youtube-competitors-e7-paridade.test.ts`, primeira parte).

| Nome | Entrada | Esperado |
|---|---|---|
| `changes de hoje: o corpo é o do retrato` | `listCompetitorChanges(ctxA, {})` | `JSON.stringify` igual a `e7-changes-hoje.json` |
| `changes de hoje com type, bookmarked e limit` | três chamadas | iguais aos três blocos do retrato |
| `channels de hoje: as nove chaves são as do retrato` | `listCompetitorChannels(ctxA)` | para cada canal, a projeção nas nove chaves de hoje igual a `e7-channels-hoje.json`; `count` igual |
| `o retrato tem linhas` | os dois arquivos | 8 mudanças e 3 canais (vazio contra vazio não vale) |
| `o site B não aparece no retrato de A` | os dois arquivos | nenhum id de B |

**Pronto quando:** os dois retratos foram gerados com `competitors.ts` igual ao de `HEAD` (o relatório traz `git diff --stat -- apps/web/src/lib/pipeline/services/competitors.ts` vazio e o hash) e os testes estão verdes. **(emenda 1: s:m8)** Esta é a maior tarefa do plano, apesar do nome: o falso de PostgREST é a base de todos os testes do Lote 1 e de parte do Lote 2. Ela leva relatório e revisão de tarefa grande (o revisor lê o falso inteiro), e o falso ganha testes próprios no mesmo arquivo de paridade: `o falso recusa método que não conhece` (chamar um método fora da lista lança, em vez de devolver a tabela inteira) e `eq, in, is, neq, order e range do falso filtram de verdade` (um caso por método; **emenda 2:** mais `or do falso filtra a forma da continuação e lança nas outras` e `order decrescente sem nullsFirst põe os nulos primeiro`). O que amarra o falso ao banco de verdade é a Tarefa 8b.

### Tarefa 3: leitor do perfil

**Arquivo.** `S/competitors-perfil.ts` (`server-only`).
**Contrato.**
- Tipos `PerfilDoCanal` e `MotivoDePerfil` (4.2); `FRASES_DE_PERFIL: Record<MotivoDePerfil, string>` (a frase de `canal_ainda_nao_relido` é a da emenda 1, abaixo; o exemplo que estava aqui afirmava a causa e saiu).
- `lerPerfis(sb, siteId: string): Promise<{ lido: true; porCanal: Map<string, PerfilDoCanal> } | { lido: false; motivo: 'tabela_ausente' | 'erro_do_banco' | 'cortado' }>`. Duas consultas, as duas com `.eq('site_id', siteId)` **(emenda 2: s:m10: esta frase passou a trazer as colunas finais, as mesmas do último item deste contrato)**: `competitor_channels` (`id, published_at, last_seen_at`) e `competitor_field_versions` (`competitor_channel_id, field, value`, com `.is('video_id', null).in('field', ['custom_url', 'country']).eq('is_current', true)`). Nunca lança. Não seleciona `description`.
- `perfilDe(canalId: string, r: resultado de lerPerfis): PerfilDoCanal`: resultado não lido, o motivo dele para todo canal; canal sem **qualquer uma** das duas versões, `canal_ainda_nao_relido`; com as duas, `lido`.
- **(emenda 1: s:m6, d:m-3, d:m-8) O que muda nas duas consultas, por 4.2.** A de `competitor_channels` pede só `id, published_at, last_seen_at` (deixa de pedir `custom_url` e `country`). A de `competitor_field_versions` pede `competitor_channel_id, field, value`, com `.is('video_id', null).in('field', ['custom_url', 'country']).eq('is_current', true)`. `handle` e `pais` são o `value` das duas versões (texto ou nulo; valor que não é texto nem nulo: tratado como nulo, com `Sentry.captureMessage('e7.perfil_valor_inesperado')`). Canal sem **qualquer uma** das duas versões: `canal_ainda_nao_relido`. As duas consultas ordenam por `id` e paginam pela regra global. Resposta `{ data: null, error: null }` em qualquer das duas: `lido: false`, `erro_do_banco`. A frase de `canal_ainda_nao_relido` passa a ser "o histórico do perfil deste canal ainda não tem a primeira leitura de handle e país" (a do exemplo acima afirmava a causa).
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `canal relido com tudo` | as duas versões correntes, `published_at` e `last_seen_at` na linha | `lido`, os três valores, `lido_em` = `last_seen_at` |
| `canal relido sem país` | versão corrente de `country` com valor nulo | `lido`, `pais: null` |
| `canal relido sem handle` | versão corrente de `custom_url` com valor nulo | `lido`, `handle: null` |
| `canal nunca relido` | sem versão | `nao_lido`, `canal_ainda_nao_relido`, frase presente, **sem** as chaves `handle`, `pais`, `criado_em` |
| `colunas com valor mas sem versão` (o caso de quem preencheu a coluna por outro caminho) | coluna preenchida, sem versão | `nao_lido` (a prova é a versão) |
| `tabela ausente` | modo ausente em cada uma das duas | `lido: false`, `tabela_ausente`; nunca mapa vazio |
| `erro do banco` e `consulta que lança` | modo erro e modo lança | `erro_do_banco`, sem a mensagem (o teste planta uma frase sentinela no erro) |
| `teto de páginas atingido com a última cheia` **(emenda 1: s:m7; substitui "página cheia de 1.000 sem a seguinte")** | `MAX_PAGINAS` forçado a 1 no teste, 1.000 linhas | `cortado` |
| `exatamente 1.000 linhas e a página seguinte vazia é leitura completa` **(emenda 1: s:m7)** | 1.000 linhas | `lido: true`, 1.000 no mapa; duas consultas feitas |
| `duas páginas, sem repetir nem pular` **(emenda 1: d:m-2)** | 1.500 versões inseridas fora de ordem | 1.500 lidas, cada `id` uma vez; o registro do falso mostra `order('id')` nas duas consultas |
| `resposta com data nula e erro nulo` **(emenda 1: d:m-8)** | o falso devolve `{ data: null, error: null }` em cada uma das duas | `lido: false`, `erro_do_banco`; nunca mapa vazio |
| `handle e país vêm da versão, não da coluna` **(emenda 1: s:m6)** | versões com `@novo` e `BR`; colunas da linha do canal com valores antigos | `handle: '@novo'`, `pais: 'BR'`; o registro das colunas pedidas não tem `custom_url` nem `country` em `competitor_channels` |
| `versão de handle sem versão de país` **(emenda 1: s:m6)** | só a versão de `custom_url` | `nao_lido`, `canal_ainda_nao_relido` |
| `a frase de canal não relido não afirma a causa` **(emenda 1: d:m-3)** | `FRASES_DE_PERFIL` | sem "ainda não foi relido" |
| `site sem canal` | base vazia | `lido: true`, mapa vazio |
| `o select não pede description` | registro das colunas | `description` ausente |
| **mutação:** `as duas consultas filtram pelo site` | canal de B com versão e colunas; pedir A | o canal de B não está no mapa; removendo qualquer um dos dois `.eq('site_id')`, falha |

**Pronto quando:** testes verdes; o relatório traz as duas mutações.

### Tarefa 4: leitor das mudanças de campo

**Arquivo.** `S/competitors-campos.ts` (`server-only`).
**Contrato.**
- `CAMPOS_DE_VIDEO_QUE_SAEM = ['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability'] as const`; `CAMPOS_DE_CANAL_QUE_SAEM = ['name', 'custom_url', 'country', 'avatar_url', 'subscribers_hidden', 'availability'] as const`; `CAMPOS_DE_CANAL_QUE_NUNCA_SAEM = ['description'] as const`; `CAMPOS_DE_VIDEO_QUE_NUNCA_SAEM = [] as const`.
- Tipos de 4.3; `FRASES_DE_CAMPO` para os três motivos de `nao_lido`.
- `listarMudancasDeCampo(sb, siteId: string, o: { limite: number }): Promise<MudancasDeCampo>`. Nunca lança. Ordem das consultas, todas com o site: (1) a primeira leitura do site (`competitor_field_versions`, `.eq('site_id', siteId).order('first_seen_at').limit(1)`): zero linhas, `coleta_ainda_nao_comecou`; (2) a página: `.eq('site_id', siteId).in('field', união das duas listas que saem).neq('precision', 'first').order('first_seen_at', { ascending: false }).order('id', { ascending: false }).limit(limite + 1)`; veio `limite + 1`, `cortado: true` e a última é descartada; (3) e (4) as versões anteriores das chaves da página (vídeo: `.eq('site_id', siteId).in('video_id', bloco).in('field', campos)`; canal: `.eq('site_id', siteId).is('video_id', null).in('competitor_channel_id', bloco).in('field', campos)`): a anterior de uma mudança é a linha da mesma chave com o maior `first_seen_at` menor que o dela; (5) `competitor_channels` (`id, channel_name`, `.eq('site_id', siteId)`); (6) `competitor_videos` (`id, video_id, title, competitor_channel_id`, `.in('id', bloco)`), e **todo vídeo cujo `competitor_channel_id` não está no resultado de (5) é descartado** junto com as mudanças dele.
- Depois da consulta, cada linha é conferida de novo contra a lista do alvo dela (`video_id` nulo: lista de canal; senão: lista de vídeo). Fora: descartada e contada em `fora_da_lista`.
- **(emenda 1: s:I2, d:I-2, d:m-1, d:m-8) Ordem de execução e destino de cada falha.** Os números (1) a (6) acima continuam sendo os nomes das consultas; a **ordem em que rodam** passa a ser (1), (5), (7), (2), (6), (3) e (4) (a (7), a ponta dos vídeos, é da emenda 2 e está descrita abaixo). A (5) pede `id, channel_name, last_seen_at`, ordenada por `id`, e dela sai `lido_ate` (4.3). A página (2) ganha, além do `.eq('site_id', siteId)`, o filtro `.in('competitor_channel_id', ids de (5))`, que usa o índice `idx_cfv_channel_seen`; com (5) lida e sem nenhum canal, nem a (7) nem a (2) rodam e a resposta é `lido`, `itens: []`, `lido_ate` com os quatro instantes nulos. **Erro, tabela ausente, exceção, corte ou `{ data: null, error: null }` em (1), (5), (7), (2) ou (6): `nao_lido` com o motivo, e nada mais é consultado.** Em (1), "zero linhas" (`data: []`) é `coleta_ainda_nao_comecou`; `data: null` é `erro_do_banco`. Vídeo cujo canal não está em (5), com (5) e (6) lidas, é descartado com as mudanças dele e contado em `video_de_outro_site` (não mais em `fora_da_lista`), com o aviso ao Sentry de 4.3. `FRASES_DE_CAMPO` passa a ter os quatro motivos (entra `cortado`).
- **(emenda 2: d:I-2b) A consulta (7), a ponta dos vídeos.** Roda depois da (5) e antes da (2): a ordem de execução fica (1), (5), (7), (2), (6), (3) e (4). São duas leituras de uma linha em `competitor_videos`, com os ids de (5) em blocos de 150 e o tempo limite da regra global: `.select('last_seen_at').in('competitor_channel_id', bloco).is('missing_since', null).order('last_seen_at', { ascending: false, nullsFirst: false }).limit(1)` para `videos_mais_recente`, e a mesma com `{ ascending: true }` (nulos por último, o padrão) para `videos_mais_antigo`; com mais de um bloco, fica o maior e o menor entre os blocos. A linha devolvida com `last_seen_at` nulo quer dizer "nenhum vídeo com leitura naquele bloco" e não entra na conta; sem nenhum valor, os dois saem `null`. `competitor_videos` não tem `site_id`: o filtro de site é o `in()` pelos canais de (5), como na (6). Com (5) lida e sem canal, a (7) não roda. Erro, tabela ausente, exceção, corte ou `{ data: null, error: null }` na (7): `nao_lido` com o motivo, e nada mais é consultado.
- **(emenda 2: s:m7)** Vídeo que está na página (2) e **não está no resultado de (6)**, com a (6) lida: descartado com as mudanças dele e contado em `video_ausente`; não conta em `video_de_outro_site` e não manda aviso. Só o vídeo que **voltou** em (6) com canal fora de (5) é `video_de_outro_site`.
- **(emenda 1: d:I-4) Continuação, só se a P-2 mandar (3.2).** `listarMudancasDeCampo(sb, siteId, { limite, cursor?: { firstSeenAt: string; id: number } })`, pelo contrato de 4.3. Quem decide é o número da P-2, anotado no ledger antes de a tarefa começar: o implementador não escolhe. **(emenda 2: s:m6, d:m-1, d:m-2)** O leitor não recebe mais o `id` cru: recebe o cursor já validado por `lerCursor(sb, siteId, antesDe: number): Promise<{ ok: true; cursor: { firstSeenAt: string; id: number } } | { ok: false; causa: 'invalido' | 'tabela_ausente' | 'erro_do_banco' }>`, exportada deste módulo, que lê a linha com `.eq('site_id', siteId).eq('id', antesDe)` (linha de outro site ou inexistente: `invalido`) e nunca lança. O serviço (Tarefa 5) traduz `invalido` em 400 e as outras duas causas em `mudancas_de_campo: nao_lido`. A página (2) ganha `.or('first_seen_at.lt."<texto>",and(first_seen_at.eq."<texto>",id.lt.<id>))`, com `<texto>` igual ao `first_seen_at` que o banco devolveu, sem passar por `Date`. Se o falso ainda não tiver `or` quando esta tarefa começar, ela o acrescenta (seção 9).
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `a lista do que sai mais a do que nunca sai é o catálogo, campo a campo` | `VIDEO_FIELDS`, `CHANNEL_FIELDS` | as uniões são iguais aos catálogos e as interseções são vazias (campo novo no catálogo quebra este teste até ser classificado) |
| `mudança de tags de um vídeo` | duas versões | um item, `valor_anterior.lido` com as tags antigas, `valor_novo` com as novas, `precisao` da linha |
| `mudança de nome do canal` | duas versões com `video_id` nulo | `alvo: 'canal'`, `video_id` e `video_title` nulos |
| `a primeira leitura não é mudança` | só linhas `first` | `lido`, `itens: []`, `count: 0`, `coleta_desde` = a data da primeira |
| `site sem nenhuma versão` | tabela vazia para o site | `nao_lido`, `coleta_ainda_nao_comecou`, frase |
| `tabela ausente`, `erro do banco`, `consulta que lança` | os três modos, na consulta (2) | `nao_lido` com o motivo, sem a mensagem sentinela |
| `limite 2 com 3 mudanças` | três | 2 itens, `cortado: true`, `limite: 2`, as duas mais recentes |
| `limite 2 com 2 mudanças` | duas | `cortado: false` |
| `empate de first_seen_at` | duas linhas na mesma hora | ordem pelo `id`, estável em duas chamadas |
| `falha ao ler os valores anteriores` | modo erro em (3) | os itens saem; `valor_anterior` de todos: `nao_lido`, `erro_do_banco` |
| `mudança sem linha anterior` | linha `1d` sem a `first` | `nao_lido`, `sem_versao_anterior` |
| `valor novo nulo é valor` | `value` nulo | `valor_novo: null`, item presente |
| `description do canal nunca sai` | uma mudança de `description` (com a frase sentinela) e uma de `name` | só a de `name`; o JSON da resposta não contém a sentinela |
| **mutação:** `tirar description da lista do que nunca sai e pô-la na que sai faz o teste do catálogo e o da sentinela falharem` | | os dois vermelhos no relatório |
| `campo de canal numa linha de vídeo` (por exemplo `name` com `video_id`) | linha plantada | descartada; `fora_da_lista: 1` |
| `o in() é montado em blocos de 150` (com o limite máximo de 100 cabe num bloco; o teste força o tamanho do bloco para 40) | limite 100, 100 vídeos, bloco 40 | três chamadas, nenhum vídeo perdido |
| **mutação:** `a página filtra pelo site` | mudanças em A e em B | pedir A não traz as de B; sem o `.eq('site_id')`, falha |
| **mutação:** `as versões anteriores filtram pelo site` | versão anterior de B com a mesma chave de vídeo | o valor anterior é o de A |
| **mutação:** `os canais filtram pelo site, e vídeo de canal de outro site é descartado` | linha de versão em A apontando para vídeo de canal de B | item descartado, `video_de_outro_site: 1` e `fora_da_lista: 0` **(emenda 1: s:I2)**, aviso ao Sentry chamado; sem o cruzamento, o título do vídeo de B apareceria e o teste falha |
| `toda consulta leva o tempo limite` | registro do falso | `abortSignal` chamado em todas |
| **`falha em (1), (5) ou (6) nunca vira lista`** **(emenda 1: s:I2, d:m-8)** | os quatro modos (tabela ausente, erro, lança, `{ data: null, error: null }`) em cada uma das três consultas: doze casos | em todos, `estado: 'nao_lido'` com `tabela_ausente` ou `erro_do_banco`; **nunca** `lido`, e em (1) nunca `coleta_ainda_nao_comecou`; sem a mensagem sentinela |
| `tempo limite estourado em (5)` **(emenda 1: s:I2)** | o falso rejeita com `AbortError` na consulta de canais | `nao_lido`, `erro_do_banco`; nenhuma mudança de vídeo descartada em silêncio |
| `lido_ate traz a ponta final` **(emenda 1: d:I-2)** | três canais com `last_seen_at` em três dias diferentes | `mais_antigo` e `mais_recente` são o menor e o maior; `canais_sem_leitura: 0` |
| **`coleta parada: a resposta mostra a data da última leitura boa, anterior ao AGORA`** **(emenda 1: d:I-2)** | todos os canais com `last_seen_at` 7 dias antes do `AGORA` do teste, nenhuma mudança depois | `estado: 'lido'`, e `lido_ate.mais_recente` é 7 dias anterior ao `AGORA`; a resposta **difere** da de uma base igual com `last_seen_at` = `AGORA` |
| `canal nunca relido conta em canais_sem_leitura` **(emenda 1: d:I-2)** | um canal com `last_seen_at` nulo | `canais_sem_leitura: 1`; `mais_antigo` é o menor dos não nulos |
| `site com versões e sem canal` **(emenda 1)** | (1) com uma linha e (5) vazia (no banco a cascata impede; o caso só existe no falso e prova que a função não lança) | `lido`, `itens: []`, `lido_ate` com os quatro instantes nulos; as consultas (7) e (2) não foram feitas (emenda 2) |
| **mutação:** `a página filtra pelos canais do site` **(emenda 1: d:m-1)** | registro do falso | a consulta (2) leva `in('competitor_channel_id', …)` com os ids de (5) **e** o `.eq('site_id')` |
| **só se a P-2 mandar:** `duas páginas pela continuação, sem repetir nem faltar` **(emenda 1: d:I-4)** | 5 mudanças, limite 2, três chamadas seguindo `proximo`; duas delas com o mesmo `first_seen_at` | os 5 ids, cada um uma vez, na ordem; a última com `cortado: false` e `proximo: null` |
| **só se a P-2 mandar:** `lerCursor de linha de outro site ou inexistente` **(emenda 2: s:m6; substitui o teste que esperava 400 de uma função que só devolve `lido` ou `nao_lido`; o 400 é testado na Tarefa 5)** | id de B; id que não existe | `ok: false`, `invalido`; nenhuma página lida. **mutação:** sem o `.eq('site_id')` de `lerCursor`, o id de B é aceito e o teste falha |
| **só se a P-2 mandar:** `lerCursor com erro do banco não vira parâmetro inválido` **(emenda 2: s:m6)** | os quatro modos de falha | `ok: false` com `tabela_ausente` ou `erro_do_banco`; nunca `invalido` |
| **só se a P-2 mandar:** `o corte da página cai dentro de um empate` **(emenda 2: d:m-2, s:m6)** | 5 mudanças, **três com o mesmo `first_seen_at`**, com microssegundos diferentes de zero; limite 2 | os 5 ids, cada um uma vez; o registro do falso mostra que o texto do `or` é idêntico ao `first_seen_at` gravado (nenhum dígito perdido) |
| **`captura de vídeo parada com o canal lido hoje: a resposta difere`** **(emenda 2: d:I-2b)** | canais com `last_seen_at` = `AGORA`; vídeos com `last_seen_at` 7 dias antes do `AGORA`; nenhuma mudança depois | `estado: 'lido'`, `lido_ate.mais_recente` = `AGORA`, `lido_ate.videos_mais_recente` 7 dias antes; a resposta **difere** da de uma base igual com os vídeos lidos em `AGORA` |
| **`falha na leitura da ponta dos vídeos nunca vira lista`** **(emenda 2: d:I-2b)** | os quatro modos de falha na consulta (7), e o tempo limite estourado | `nao_lido` com `tabela_ausente` ou `erro_do_banco`; nunca `lido`; a consulta (2) não foi feita |
| `nenhum vídeo com leitura: as duas pontas dos vídeos saem nulas` **(emenda 2: d:I-2b)** | vídeos todos com `last_seen_at` nulo; depois, canal sem vídeo | `videos_mais_recente: null`, `videos_mais_antigo: null`, `estado: 'lido'` |
| `vídeo com missing_since e vídeo nunca lido não entram na ponta` **(emenda 2: d:I-2b)** | um vídeo lido ontem; um com `missing_since` e `last_seen_at` de hoje; um com `last_seen_at` nulo | as duas pontas são a de ontem (o nulo não vira a ponta mais recente, que é o que o `nullsFirst: false` garante) |
| **mutação:** `a ponta dos vídeos só olha os canais do site` **(emenda 2: d:I-2b)** | vídeo de canal de B lido em `AGORA`; os de A lidos 7 dias antes | `videos_mais_recente` é a de A; sem o `in()` pelos canais de (5), falha |
| `vídeo da página que não volta em (6)` **(emenda 2: s:m7)** | o falso tira o vídeo de `competitor_videos` entre a (2) e a (6) | item descartado, `video_ausente: 1`, `video_de_outro_site: 0`, o aviso ao Sentry **não** foi chamado |

**Pronto quando:** testes verdes; o relatório traz as seis mutações (as quatro de antes, a da emenda 1 e a da ponta dos vídeos, emenda 2; mais a de `lerCursor`, se a continuação entrou) e diz, com o número da P-2, se a continuação entrou.

### Tarefa 5: integração do Lote 1 (a única do lote que toca `competitors.ts`)

**Arquivos.** `S/competitors.ts`; `changes/route.ts`; o teste de paridade.
**Contrato.**
- `CompetitorChannelRow` ganha `perfil: PerfilDoCanal`. `listCompetitorChannels` chama `lerPerfis(supabase, siteId)` **depois** das consultas de hoje (a ordem das chamadas a `competitor_videos` não muda) e preenche `perfil` com `perfilDe`. A chamada fica dentro de `try`: se lançar, todo perfil sai `nao_lido`, `erro_do_banco`, e vai `Sentry.captureException`.
- `CompetitorChangeFilters` ganha `campos?: string | null`. `CompetitorChangeList` ganha `mudancas_de_campo?: MudancasDeCampo`. Em `listCompetitorChanges`: `campos` nulo, indefinido ou vazio, o caminho de hoje sem tocar em nada; `'todos'`, o corpo de hoje mais `mudancas_de_campo` (com `limite` = o mesmo `changeLimit`); outro valor, `err('VALIDATION_ERROR', "campos aceita só 'todos'", 400)`, **antes** de qualquer consulta.
- `changes/route.ts`: lê `searchParams.get('campos')` e repassa.
- **(emenda 1: d:I-4) Só se a continuação da P-2 entrou:** a rota lê também `antes_de`; `antes_de` sem `campos=todos`, ou que não é inteiro positivo, é 400 antes de qualquer consulta; **(emenda 2: s:m6)** válido na forma, o serviço chama `lerCursor` antes de qualquer outra consulta: `invalido` é 400, `VALIDATION_ERROR` (teste aqui: `antes_de de linha de outro site ou inexistente dá 400 e nenhuma página é lida`); `tabela_ausente` ou `erro_do_banco` devolve `changes` normal com `mudancas_de_campo: nao_lido`; `ok`, o cursor é repassado ao leitor; o teste `os parâmetros documentados de changes são os que a rota lê` (Tarefa 7) passa a incluí-lo. Se não entrou, a rota não lê `antes_de` e o documento não o cita.
**Testes** (acrescentados ao arquivo de paridade).

| Nome | Entrada | Esperado |
|---|---|---|
| `changes sem o parâmetro é o corpo de hoje, byte a byte` (itens 9 e 51) | `{}` e `{ campos: null }` e `{ campos: '' }` | `JSON.stringify` igual ao retrato da Tarefa 2; `Object.keys` é `['changes', 'count']` |
| `sem o parâmetro nenhuma consulta nova é feita` | contador do falso | `competitor_field_versions` com zero consultas |
| `com campos=todos: changes e count iguais aos de hoje, mais a chave` | `{ campos: 'todos' }` | os dois primeiros iguais ao retrato; `mudancas_de_campo.estado` presente |
| `campos=todos com a tabela ausente não derruba changes` | modo ausente | 200, `changes` do retrato, `nao_lido` |
| `campos com valor desconhecido: 400 e nenhuma consulta` | `'tudo'`, `'TODOS'`, `'todos,x'` | `VALIDATION_ERROR`, 400; contador zerado |
| `erro em competitor_changes continua 500, com e sem o parâmetro` | modo erro | `DB_ERROR` |
| `channels: as nove chaves de hoje não mudaram` (item 216) | base da Tarefa 2 | projeção igual ao retrato |
| `channels: todo canal tem perfil` | base | chave presente nos 3, com `estado` |
| `channels: lerPerfis que lança não derruba a lista` | modo lança só nas consultas do perfil | 200, nove chaves iguais, perfil `nao_lido` |
| **mutação:** `channels filtra os canais pelo site` | base com A e B | sem o `.eq('site_id')` da consulta de hoje, o canal de B aparece e o teste falha |
| `a rota repassa campos` | `GET …/changes?campos=todos` com o serviço simulado | o serviço recebe `campos: 'todos'`; sem o parâmetro, recebe `null` |

**Mais:** `TP/youtube-competitors.test.ts` (o de hoje) roda **sem nenhuma edição** e fica verde.
**Pronto quando:** tudo verde; `git diff --stat` do commit só tem os três arquivos.

### Tarefa 6: MCP (em duas partes, 6a e 6b)

**(emenda 1: s:m2) Duas partes, cada uma com o seu commit e o seu "pronto quando".** Anunciar `campos` antes da Tarefa 5 seria, por um commit, o defeito que a tarefa conserta (parâmetro anunciado e ignorado), e o typecheck quebraria ao repassar a um tipo que ainda não tem a chave. **6a** (pode rodar antes da 5): o anúncio ganha `type`, `bookmarked` e `tier`, perde `channel_id`, a descrição de `get_outliers` é corrigida, e `PARAMETROS_LIDOS` nasce **sem** `campos`; valem todos os testes abaixo menos os três que citam `campos`. **6b** (depois da 5): `campos` entra no anúncio, em `PARAMETROS_LIDOS` e no repasse; valem os três testes de `campos`. O contrato abaixo descreve o estado final, depois da 6b.

**Arquivos.** `mcp/tools.ts` (o bloco `YoutubeObservatoryShape`, que passa a ser exportado); `mcp/services/youtube-observatory.ts`; o teste novo.
**Contrato.** O anúncio passa a ter: `action` (como hoje, com a descrição de `get_outliers` corrigida para "videos with a multiplier of 2x or more vs the channel"); `type` (`z.enum(['all', 'title', 'thumbnail', 'description']).optional()`; conferir os valores reais de `change_type` em `competitors.ts` e nos testes de hoje antes de escrever a lista, e usar os do código); `bookmarked` (`z.boolean().optional()`); `tier` (`z.enum(['all', 'top', 'high', 'mid']).optional()`); `limit` (como hoje); `fmt` (como hoje); `campos` (`z.enum(['todos']).optional()`, com a descrição "get_changes: also return field changes (tags, category, duration, language, channel name and others)"). `channel_id` sai. O adaptador exporta `PARAMETROS_LIDOS = ['action', 'type', 'bookmarked', 'tier', 'limit', 'fmt', 'campos'] as const` e repassa `campos` a `listCompetitorChanges`.
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `o anúncio e o adaptador falam dos mesmos parâmetros` | `Object.keys(YoutubeObservatoryShape)` e `PARAMETROS_LIDOS` | iguais como conjunto |
| `todo params.<nome> lido no arquivo do adaptador está em PARAMETROS_LIDOS` | o texto do arquivo, por expressão regular `params\.(\w+)` | nenhum nome fora da lista (parâmetro lido e não anunciado volta a quebrar) |
| `get_changes repassa campos, type e bookmarked` | serviço simulado | os três chegam |
| `get_changes sem campos não manda campos` | idem | `campos` indefinido |
| `campos com outro valor é recusado pelo anúncio` | `z.object(shape).safeParse({ action: 'get_changes', campos: 'x' })` | falha |
| `chamada antiga com channel_id continua aceita` | `safeParse({ action: 'get_changes', channel_id: '<uuid>' })` | sucesso, e a chave some do resultado |
| `list_channels, get_outliers e get_insights seguem como antes` | serviço simulado | os mesmos argumentos de hoje |

**Mais:** `test/mcp/youtube-mcp-tools.test.ts` e `test/mcp/mcp-schema-parity.test.ts` rodam e ficam verdes (se o segundo tiver retrato do anúncio, regenera-se e o relatório mostra o diff, que só pode ter as chaves desta tarefa).
**(emenda 2: s:m4) Mais um teste na 6b, de tamanho.** `get_changes com campos pela ferramenta: o texto é medido`: o adaptador com o serviço simulado devolvendo 50 trocas e 50 mudanças de `tags` (o `limit` padrão da ferramenta é 50, F22), cada lista de tags com o `bytes_max` de `tags` que a P-2 deu (sem a P-2 anotada: 500 caracteres por lista, e o relatório diz que usou o padrão); `toMcpSuccess(data).content[0].text.length` vai ao relatório ao lado do limite da P-14. **Dentro do limite:** segue. **Acima:** o teste não é afrouxado; o relatório traz o maior `limit` que cabe (medido descendo de 50), e a Tarefa 7 escreve esse número no documento ("pela ferramenta, com `campos`, peça `limit` de até N"). O teste afirma, em qualquer caso, que o texto com o `limit` documentado cabe.
**Pronto quando:** 6a: os testes que não citam `campos` verdes, typecheck limpo, um commit. 6b: os sete testes e o de tamanho verdes, typecheck limpo, outro commit; o relatório diz "DENTRO do limite" ou "ACIMA, o maior `limit` que cabe é N".

### Tarefa 7: documento e prompt, Lote 1

**Antes:** P-8 (as duas saídas vazias) e P-8b. **O commit desta tarefa dispara a semente** (seção 2); a prova é a do parágrafo seguinte (**emenda 2: s:m10**). Se o log disser "Seed failed", o commit não é bloqueado pelo hook: a tarefa para e avisa.
**(emenda 1: s:I6) Quem commita.** O agente escreve os três arquivos, roda os testes e o typecheck, e **para sem commitar**, entregando a lista de arquivos. O controlador roda a P-8 e a P-8b, faz o commit (sem `--no-verify`, sem outro commit de agente no intervalo) e confere a semente pela hora do log e pela linha "Done!" (seção 2). O relatório traz as linhas `✓` do log.
**Arquivos e o que muda.**
- `cowork-docs-youtube.md`, bloco `GET …/competitors/channels`: reescrito para o formato real (`{ "data": { "channels": [ … ], "count": n } }`, snake_case), com as nove chaves de hoje e `perfil` nos dois estados. Notas obrigatórias: `video_count` é quantos vídeos entraram na conta de engajamento, no máximo 50, e não o total do canal; `avg_engagement` e `subscriber_count` podem ser `null`; dentro de `perfil` com `estado: "lido"`, `null` quer dizer que o YouTube não informou; `perfil` com `estado: "nao_lido"` não traz os três campos e traz `frase`; o recurso MCP `pipeline://youtube/competitors/channels` lê a tabela direto e não traz `perfil`.
- Bloco `GET …/competitors/changes`: reescrito para o real (parâmetros `type`, `bookmarked`, `limit` com padrão 25 **pela rota HTTP e 50 pela ferramenta `youtube_observatory`** (emenda 2: s:m4, F22) e máximo 100; **não há filtro por canal**; resposta `{ "data": { "changes": [ … ], "count": n } }`), mais `campos=todos` com um exemplo de cada estado de `mudancas_de_campo`, a lista dos campos que saem, a frase "a descrição do canal não é entregue", o que é `precisao` (`gap` = a janela da mudança é um buraco de coleta) e que `type` e `bookmarked` não filtram as mudanças de campo.
- **(emenda 1) Frases que o documento passa a ter, uma por achado.** No bloco de `channels`: `perfil.lido_em` é a última leitura boa do canal e pode ser posterior à leitura do perfil; `criado_em` nulo quer dizer "não informado, ou ainda não gravado" (d:m-3, s:m6). No bloco de `changes`: a lista de mudanças de campo cobre de `coleta_desde` até `lido_ate`; canal com leitura mais antiga que a de hoje não foi conferido depois dela; se `lido_ate.mais_recente` não for de hoje, **diga até quando a lista vale e não escreva "nada mudou"** (d:I-2); `coleta_desde` é a primeira leitura do site, e canal acrescentado depois tem cobertura menor (d:m-7); `cortado: true` quer dizer que há mudanças mais antigas que esta chamada não entrega: sem a continuação, relate que a lista está incompleta e a partir de que data; com a continuação (se a P-2 a trouxe), chame de novo com `antes_de=<proximo>` até `proximo` ser `null` (d:I-4); `video_de_outro_site` maior que zero é defeito nosso, a relatar (s:I2); `campos` vazio (`?campos=`) é tratado como ausente, e qualquer outro valor que não `todos` dá 400 (s:m13).
- **(emenda 2) Frases a mais, uma por achado.** No bloco de `changes`: **(d:I-2b; substitui, para os campos de vídeo, a frase única da emenda 1)** "`lido_ate.mais_recente` e `mais_antigo` valem para os campos **do canal** (nome, handle, país, avatar, inscritos ocultos, disponibilidade)"; "os campos **de vídeo** são relidos na cadência de cada vídeo (parte todo dia, parte uma vez por semana): a ausência de mudança num vídeo só vale até a última leitura dele; se `lido_ate.videos_mais_recente` não for de hoje, diga até quando os campos de vídeo valem e não escreva 'nada mudou'"; "`videos_mais_recente` e `videos_mais_antigo` nulos querem dizer que nenhum vídeo tem leitura, não que está em dia"; e, **só se a P-15 mostrou `mais_de_8_dias` ou vídeo sem leitura maior que zero**, "`videos_mais_antigo` pode ser antigo sem defeito: há vídeo que não é relido, e vídeo nunca lido não entra nas pontas". **(s:m7)** "`video_ausente` conta mudança de vídeo apagado durante a leitura; não é defeito". **(s:m4)** Se a Tarefa 6b disse "ACIMA": "pela ferramenta, com `campos`, peça `limit` de até N" (o N do relatório dela); se disse "DENTRO", a frase não entra.
- Uma subseção nova, curta, "O que não é entregue ao Cowork nesta fase": série por vídeo, texto e contagem de comentários, descrição do canal, dado do canal próprio.
- O bloco "2. Competitor Monitoring" (linhas 1604 a 1612): a linha 2 ganha "`?campos=todos` para incluir mudanças de campo".
- O documento não pode conter o texto `competitor_video_comment` (F9) nem nome de tabela de comentário.
- `prompts.ts`, linhas 1266 a 1272: as três linhas falsas ("Growth delta", "Recent videos", "VsYou") saem; entram duas: uma que manda ler os campos reais em `GET /api/pipeline/docs/youtube`, seção "Competitor Observatory", e uma regra: "when a field comes with `estado: nao_lido` or `estado: nao_medido`, quote its `frase` and do not estimate the value". Nenhum limiar nem estratégia entra no prompt.
**Testes** (`youtube-cowork-docs-observatorio.test.ts`: é o teste de **conteúdo** que os de estrutura não fazem).

| Nome | Entrada | Esperado |
|---|---|---|
| `o exemplo de channels tem as mesmas chaves que o serviço devolve` | o primeiro bloco JSON da subseção, e `listCompetitorChannels` sobre a base da Tarefa 2 | o conjunto de chaves de um canal do exemplo é igual ao do canal real (nos dois estados de `perfil`) |
| `o exemplo de changes sem parâmetro tem as chaves de hoje` | idem, com `listCompetitorChanges` | iguais; o topo é `changes` e `count` |
| `o exemplo de campos=todos tem as chaves de MudancaDeCampo` | idem | iguais |
| `os parâmetros documentados de changes são os que a rota lê` | os nomes em "Query params" e os `searchParams.get('…')` de `changes/route.ts` | iguais como conjunto |
| `a lista de campos do documento é a do código` | a lista escrita no documento e as duas constantes da Tarefa 4 | iguais |
| `o documento não cita os campos que não existem` | o texto da seção | sem `growthDelta`, `recentVideos`, `vsYou`, `change_type`, `channelThumbnailUrl`, `"history"` |
| `o documento não cita tabela de comentário` | o arquivo | sem `competitor_video_comment` |
| `a seção Coaching continua dentro dos 8.000 caracteres` | o arquivo | o teste de hoje (`youtube-cowork-docs.test.ts`) verde, sem edição |
| `o prompt competitor-report não manda anotar campo inexistente` | o texto do prompt gerado | sem "Growth delta", "VsYou", "Recent videos"; com `/api/pipeline/docs/youtube` e com a regra de `frase` |
| `há blocos JSON para comparar` | a seção | pelo menos 4 blocos que fazem `JSON.parse` sem erro |
| `o documento diz até quando a lista vale e o que fazer com cortado` **(emenda 1: d:I-2, d:I-4)** | o texto do bloco de `changes` | contém `lido_ate`, `coleta_desde` e `cortado`, cada um numa frase fora de bloco de código; o exemplo de `campos=todos` tem a chave `lido_ate` com as **cinco** chaves de `LidoAte` (emenda 2: d:I-2b) |
| `o documento separa a ponta do canal da ponta dos vídeos` **(emenda 2: d:I-2b)** | o texto do bloco de `changes`, fora de bloco de código | contém `videos_mais_recente` numa frase que também contém "vídeo", e `mais_recente` numa frase que contém "canal"; o exemplo tem as chaves `video_ausente`, `videos_mais_recente` e `videos_mais_antigo` |
| `o documento diz o padrão de limit das duas portas` **(emenda 2: s:m4)** | o texto do bloco de `changes` | cita 25 e 50, cada um ao lado da porta dele; e o 50 é igual ao `.default(…)` do anúncio (lido de `YoutubeObservatoryShape`, não escrito no teste) |
| `o documento só cita antes_de se a rota o lê` **(emenda 1: d:I-4)** | o texto e `changes/route.ts` | os dois têm, ou nenhum tem |

**Pronto quando:** testes verdes; `git diff --stat` do commit com os três arquivos; nenhuma linha acima da 600 do documento mudou (`git diff -U0` no relatório); o commit foi feito pelo controlador e o relatório traz a hora do log da semente.

### Tarefa 8: varredura de saída (itens 89, 119, 168)

**Arquivo.** `TP/youtube-competitors-e7-varredura.test.ts`.
**Contrato.** A base da Tarefa 2 ganha, **dentro do próprio teste**, sentinelas: `description` do canal = `"SENTINELA_DESCRICAO contato@exemplo.test"`; uma versão corrente e uma mudança do campo `description` com a mesma frase; `competitor_raw` com `"SENTINELA_RAW"`; uma linha em cada tabela de comentário (o nome das tabelas é montado por concatenação no teste, para o arquivo não conter o texto proibido pela F9, e o teste mora em `test/`, que a varredura de F9 não percorre) com `"SENTINELA_COMENTARIO"` e autor `"SENTINELA_AUTOR"`; uma linha de `yt_own_video_traffic_detail_daily` com `"SENTINELA_TERMO"`.
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `nenhuma resposta contém sentinela` | o JSON serializado de `channels`, `changes`, `changes?campos=todos`, `outliers` e `insights` | nenhuma das cinco sentinelas |
| `as sentinelas estão na base` | o falso | cada uma é achada por leitura direta (base sem sentinela daria verde) |
| `os módulos novos não pedem as tabelas proibidas` | registro do falso depois das cinco chamadas | zero consultas a `competitor_raw`, às tabelas de comentário e a qualquer tabela `yt_own_*` |
| `os módulos novos não citam as tabelas proibidas` | o texto dos arquivos `S/competitors-*.ts` | sem `competitor_raw`, sem `yt_own_`, sem `youtube_analytics`, sem `description` em nenhuma lista de colunas de `select` |
| `a resposta de channels não tem chave description` | varredura recursiva das chaves | ausente |

**Pronto quando:** testes verdes. A Tarefa 14 acrescenta as respostas do Lote 2 à mesma varredura.

### Tarefa 8b: o Lote 1 contra o PostgREST de verdade (emenda 1: s:I3, d:m-9)

**Por quê.** O cliente do serviço é `SupabaseClient` sem o tipo do banco (`services/types.ts:17`) e `test/**` está fora do typecheck (`tsconfig.json`, `exclude`): nome de coluna errado, `.is('video_id', null)` mal escrito, a ordenação dupla ou o `in()` por canal não são pegos por tipo nem pelo falso. Sem esta tarefa, um erro desses faria `campos=todos` responder `nao_lido`, `erro_do_banco` para sempre em produção (resposta honesta de uma função que nunca funcionou), e quem descobriria seria o dono, no D0.
**Antes.** P-11 (o `bythiago_int` tem a MG1). Sem ela: parar e avisar.
**Arquivo.** `test/integration/observatorio-a5-e7-lote1.test.ts`, gated em `HAS_LOCAL_DB`, contra o `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`), sem paralelismo entre arquivos. Cada teste cria o **seu** site, canais, vídeos e versões, e apaga no fim; nunca conta "o banco inteiro"; nunca roda `db:reset`; nunca chama função como `anon` ou `authenticated`. Nenhum arquivo de `test/helpers/**` é editado (só usado).
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `as consultas do perfil são aceitas pelo PostgREST` | um site, 2 canais, as duas versões correntes de cada | `channels` 200; os dois perfis `lido` com handle e país das versões; nenhum `erro_do_banco` |
| `as consultas de campos=todos são aceitas pelo PostgREST` | o mesmo site, 6 versões de campo (2 `first`, 4 mudanças: 3 de vídeo, 1 de canal) | `estado: 'lido'`, 4 itens na ordem certa, cada um com `valor_anterior` lido, `lido_ate` preenchido |
| `changes sem parâmetro contra o banco tem as mesmas chaves do retrato do falso` | `listCompetitorChanges(ctx, {})` no banco, com 2 trocas de título | o conjunto de chaves do topo e de um item é igual ao de `e7-changes-hoje.json` (é o que amarra o falso à realidade) |
| `dois sites no mesmo banco não se enxergam` | sites A e B com canais do mesmo `channel_id` do YouTube e versões nos dois | a resposta de A não tem id, nome, título nem valor de B, em `channels` e em `changes?campos=todos` |
| `o vídeo apagado some` **(d:m-9)** | apaga um vídeo que tem mudança de campo e chama de novo | a mudança dele não está em `mudancas_de_campo` (a cascata por `video_id` levou as versões); `video_de_outro_site: 0` |
| `o canal apagado some` | apaga um canal e chama de novo | não está em `channels` nem em `mudancas_de_campo` |
| `só se a continuação entrou: duas páginas no banco` | 5 mudanças, limite 2; **(emenda 2: d:m-2, s:m6)** três das cinco com o mesmo `first_seen_at` (com microssegundos), e o corte da primeira página caindo dentro do empate | os 5 ids, cada um uma vez (é este teste que prova o `.or(…)`, as aspas e o instante como texto no PostgREST de verdade) |
| `a ponta dos vídeos no banco` **(emenda 2: d:I-2b)** | 3 vídeos: um lido ontem, um lido hoje, um com `last_seen_at` nulo; mais um de outro site lido depois | `videos_mais_recente` é o de hoje e `videos_mais_antigo` o de ontem; o nulo não vira a ponta mais recente (prova o `nullsFirst: false` no banco de verdade); o do outro site não entra |

**Pronto quando:** testes verdes com o banco local (saída em arquivo); o relatório diz o que a P-11 mostrou. **O Lote 1 não vai sem este arquivo verde** (Tarefa 9).

### Tarefa 9: envio do Lote 1 e conferências

**Antes.** P-1 a P-9, P-11 a P-13 e **P-15** feitas e anotadas (a P-10 é do Lote 2; **emenda 2: s:m4:** a P-14 passou a valer também aqui, pelo teste de tamanho da Tarefa 6b, com o padrão de 60.000 se o dono não respondeu); acordo dos dois especialistas sobre este plano; Tarefas 1 a 8b commitadas; `2035904f` já enviado ou na mesma lista de commits (F15); suíte do web inteira verde na árvore do lote (saída em arquivo).
**(emenda 1: s:I3, s:I4, d:I-4) Mais, antes do envio.** A Tarefa 8b verde contra o `bythiago_int`. A P-2 respondida, com a decisão da continuação anotada. A P-13 respondida: se o retrato da forja difere entre as duas árvores, **o Lote 1 espera o lote que leva os commits da E2**, e esta tarefa não começa. **A árvore do lote** é a cópia de trabalho separada que o controlador monta (`origin/staging` mais a lista de commits do Lote 1, em `HEAD` destacado); é **nela** que rodam o typecheck e a suíte inteira do web antes do push, e o relatório traz o hash dela e o `sha256` dos três retratos (iguais aos da árvore local: seguir; diferentes: parar e avisar, sem regenerar). Quem monta a árvore e quem roda a suíte nela é o controlador (ou um agente que ele despache só para isso); a árvore principal não é tocada.
**(emenda 2: s:m8, s:m12) A árvore do lote, em quatro frases.** (1) **Como se monta:** `git worktree add --detach <pasta fora do repositório> origin/staging`, e nela `git cherry-pick <commit>` para cada commit da lista do lote, na ordem; antes da suíte a pasta precisa de `npm ci` e `npm run build:packages` (saída em arquivo). É novidade neste programa (os envios anteriores da A5 foram só por comandos de encanamento, sem cópia de trabalho: `.superpowers/sdd/a5-e12/progress.md:98`), e é o preço de rodar a suíte na árvore que vai. Não cria branch, não toca a árvore principal nem o índice dela, e a pasta é removida com `git worktree remove` depois do envio. (2) **O commit de `conferencias.ts` vai conflitar nela:** o arquivo local tem blocos de outros lotes que `origin/staging` não tem (aconteceu no lote B, `.superpowers/sdd/a5-e16-e15/progress.md:82`). Quem resolve é o controlador, deixando o arquivo com o que `origin/staging` tem mais **só** o bloco `E7_LOTE1_DEPLOY`, o mesmo para o teste, e rodando `conferencias.test.ts` nela antes de seguir. (3) **O push sai do `HEAD` dessa árvore,** a mesma em que o typecheck e a suíte rodaram (`git push origin HEAD:staging`, dentro de `bash -c`), e não de uma remontagem por encanamento feita depois: o que foi testado é o que vai. (4) **Na árvore do lote não se copia o `.env.local`:** a suíte roda sem ele, como na CI, e o gancho de pre-commit pula a semente quando o arquivo não existe (`.husky/pre-commit:40-49`); com ele lá, o commit de resolução de um conflito do documento dispararia a semente uma segunda vez, de outro disco.
**No commit do envio.** `conferencias.ts`: `export const E7_LOTE1_DEPLOY: string | null = '<dia de São Paulo da promoção>'` e `conferenciasE7Lote1(deploy)`, no molde de `conferenciasE1E2` (nula = nenhuma entrada; malformada = uma entrada de 1970, vermelha), espalhada em `CONFERENCIAS`; o espelho em `.superpowers/sdd/a5/conferencias-com-data.md`. Entradas (`etapa: 'E7'`):

| id | Data | Responsável | O que conferir e o esperado |
|---|---|---|---|
| `e7-l1-d0` | D0 | dono | os três comandos do Lote 1 (seção 2). Esperado: `canais` = o número da P-1; `perfis` com `lido` = `com_as_duas_versoes` da P-1 (emenda 1: s:m6; antes era `com_versao_de_handle`) e `nao_lido` = a diferença para `canais`; `campo.estado` = `lido`, `coleta_desde` = a data da P-2, `count` até 100; **(emenda 1: d:I-2, s:I2)** `lido_ate.mais_recente` do dia (a coleta roda perto de 12:00 UTC; se o comando for colado antes dela, o de ontem), `lido_ate.canais_sem_leitura` = `canais` menos `relidos` da P-1, `video_de_outro_site` = 0; **(emenda 2: d:I-2b)** `lido_ate.videos_mais_recente` do dia (ou de ontem, se o comando for colado antes da coleta), igual em dia ao `mais_recente` da P-15: **anterior a isso é vermelho** (a captura de vídeo está parada, e é o que esta chave existe para mostrar); `videos_mais_antigo` igual em dia ao `mais_antiga` da P-15, sem esperado de "hoje". **(emenda 2: d:m-4)** A terceira linha: anotar `time_total` e `size_download` no ledger (é a base da P-12). Outra coisa: anotar e abrir conserto |
| `e7-l1-d1` | D+1 | agente | Sentry: nenhum evento novo com origem em `competitors-perfil` ou `competitors-campos`, nem `e7.video_de_outro_site` ou `e7.perfil_valor_inesperado`; a P-5 de novo (quem leu) |
| `e7-l1-d7` | D+7 | agente | a P-5 de novo: chaves e rotas da semana. Anotar se `forja (so leitura)` leu `channels` ou `changes` (se leu, levar ao dono com a pergunta 8). **(emenda 1: d:m-6)** Depois do veredito da E19 (20/10) ou do fechamento do controle, `cowork-permanent` deixa de ser registrada: **zero linhas não quer dizer que ninguém usou**, e a P-5 nunca separa `changes` de `changes?campos=todos`. **(emenda 2: d:m-3)** E a segunda consulta da P-2 de novo (só leitura), agora com 7 dias de dado, com o mesmo ramo: algum dia com mais de 100 mudanças dos campos que saem, ou a soma de 7 dias seguidos acima de 100, e a continuação **não** entrou no Lote 1: abrir a continuação como conserto (o contrato já está em 4.3 e os testes nas Tarefas 4, 5, 7 e 8b) e levar ao dono |

Testes em `conferencias.test.ts`: `sem a data não há entradas do Lote 1 da E7`; `com a data, as três nas datas certas`; `data malformada vira uma entrada vermelha`; `a constante publicada é nula ou uma data real`.
**Lista de arquivos do lote** (envio por lista explícita de commits; há outros lotes locais): os dois de `S/` novos, `competitors.ts`, `changes/route.ts`, `mcp/tools.ts`, `mcp/services/youtube-observatory.ts`, `mcp/prompts.ts`, o documento, os testes das Tarefas 1 a 8b com os retratos (**emenda 1: s:I3:** inclui `test/integration/observatorio-a5-e7-lote1.test.ts`), `conferencias.ts`, o teste e o espelho.
**Janela.** Promover fora de 11:55 a 12:15 UTC, por hábito (cron da coleta); não há trava de banco.
**Ordem que não pode inverter.** (1) acordo dos especialistas; (2) P-8, P-8b e o commit do documento, pelo controlador (emenda 1: s:I6); (3) push em `staging`, CI verde; (4) promoção a `main`; (5) `e7-l1-d0`. Não há migration nem variável. Se o documento fosse enviado antes do código, o Cowork leria um parâmetro que a rota ignora: por isso os dois vão no mesmo push.
**Volta (emenda 1: s:m1, s:I6; substitui o texto anterior, que dizia que a Tarefa 6 podia ficar).** Reverter, **nesta ordem**: (1) o commit da Tarefa 7 (o documento volta; **o hook roda a semente de novo**: é commit do controlador, com a P-8 e a P-8b antes e a hora do log depois, como na ida; o conteúdo não muda, o `updated_at` das entradas muda); (2) o commit da **6b**; (3) o commit da Tarefa 5 (a rota volta ao corpo de hoje; os módulos novos ficam sem uso). O motivo da ordem: com a 5 revertida e a 6b no lugar, o adaptador passaria `campos` num literal a um tipo que não tem mais essa chave, e o typecheck do pre-commit e do CI quebra (propriedade a mais); não é "ignorado pelo serviço". A 6a pode ficar (só anuncia o que já era lido). Os testes de módulo (Tarefas 3, 4 e 8) ficam e continuam verdes, porque os módulos ficam. **(emenda 2: s:m5; substitui "a Tarefa 8b fica … continuam verdes")** A Tarefa 8b **não** fica como está: ela testa pelo serviço (`channels` com `perfil`, `changes?campos=todos`), e com a 5 revertida ficaria vermelha no banco local, onde a CI não vê e o próximo agente acharia uma falha que não é dele. No **mesmo commit** do revert da Tarefa 5, `test/integration/observatorio-a5-e7-lote1.test.ts` passa a `describe.skip`, com uma linha dizendo o motivo e o hash do revert; o mesmo vale para os casos do arquivo de paridade e da varredura que afirmam `perfil` ou `mudancas_de_campo` pelo serviço (ficam `skip`, com o mesmo motivo). Nada no banco para desfazer.
**Pronto quando:** `e7-l1-d0` feita e anotada; `feitaEm` preenchido.

### Tarefa 10: conferência do contrato da E4 (leitura; primeira do Lote 2)

**Objetivo.** Não escrever o Lote 2 contra um contrato que mudou.
**Passos.** Com as Tarefas 1, 13 e 14 da E4 commitadas, ler `M/tipos.ts`, `M/ler.ts` e `M/do-canal.ts` e responder no relatório, com arquivo e linha: (a) `MotivoNaoMedido` tem os ~~34~~ **35** códigos da tabela 0.1 deste plano (reconciliação 13/10, emenda 2: S2-m1: 35 com `coleta_pausada`, como a linha da Tarefa 1 da E4 em 0.1 já diz)? (lista e contagem); (a2) `m8.estado` tem o valor `'pausado'` e a precedência fora do ar, pausado, parado, em queda, ativo?; (b) as assinaturas de `lerCanal`, `lerVideosDoCanal`, `lerMarcasDoCanal`, `lerRetratosDoCanal` e de `medidasDoCanal`; (c) a chave de `Insumos.multiplos` é o uuid de `competitor_videos.id`?; (d) `Insumos.marcas` aceita "não pedida"? (se sim, a Tarefa 12 a usa e não lê marcas); (e) o que `m8` devolve quando a parte `canal` ou `videos` não foi lida (se já houver um valor de "não determinado", a regra (b) de 4.4 some); (f) `lerRetratosDoCanal` com o padrão cobre os 113 dias de que a queda de M8 precisa?; (g) os nomes exatos das chaves de `porFormato` (`m3b`, `m4`, `m6`); (h) `medidasDoCanal` lança em algum caso?
**(emenda 1) Mais quatro perguntas.** (i) **(d:I-3)** qual motivo `estadoDoCanal` devolve em `queda` quando faltam bordas **e** a janela cruza a mudança de contagem (o plano da E4 escreve as duas regras e não diz qual vence); a resposta entra no esperado da `e7-l2-d0` e da `e7-queda`, junto com a P-10. (j) **(d:m-4, s:I1)** quantas idas ao banco cada leitor faz, contando a de `lerCanal` que o texto da E4 diz que todo leitor repete; a tabela da seção 5 é refeita no relatório com esse número, e se o total com 15 canais passar de 200 vale o que a P-4 já diz (parar e pedir a leitura dos vídeos numa consulta só). (k) **(s:m11)** com que `AGORA` fixo a `queda` sai medida: a base cheia da Tarefa 12 precisa de uma janela de 112 dias que **não** cruze 24/08/2026, e as datas de teste não podem ser futuras, então o `AGORA` da base cheia é **anterior a 24/08/2026** (por exemplo 01/08/2026, com a janela inteira antes da mudança); conferir em `M/contagem.ts` que `cruzaMudancaDeContagem` devolve falso nesse caso e que nenhuma outra medida das nove deixa de ser medida com esse `AGORA`. (l) **(s:m8)** que métodos do cliente os quatro leitores da E4 chamam (lista, com linha): cada um tem de existir no falso `TP/e7-fixture.ts`; faltou algum, a Tarefa 12 o acrescenta ao falso (está na lista de arquivos dela). Se o falso da E4 (`medidas-fixture.ts`) puder ser importado sem editar arquivo dela, a Tarefa 12 usa o da E4 para os leitores da E4 e diz no relatório.
**Pronto quando:** as doze respostas estão no relatório. Qualquer diferença que mude um tipo de 4.4: parar e avisar o controlador antes da Tarefa 11.

### Tarefa 11: frases dos motivos

**Arquivo.** `S/competitors-frases.ts` (puro; importa só tipos de `M/tipos`).
**Contrato.** `FRASES_DE_MOTIVO: Record<MotivoNaoMedido, (m: { n?: number; minimo?: number; desde?: string; fechaEm?: string }) => string>` e `fraseDoMotivo(medida: Medida<unknown> & { estado: 'nao_medido' }): string`. Regras: frase em português, uma oração, sem número escrito no texto (os números vêm do argumento, e quando o argumento não os traz a frase não os cita); datas como `dd/mm/aaaa`; nenhuma frase diz o que o Cowork deve fazer. Exemplos: `poucos_videos` com `n: 2, minimo: 5`: "há 2 vídeos na janela e a medida pede 5"; sem os números: "há poucos vídeos na janela para medir"; `janela_cruza_mudanca_de_contagem`: "a janela cruza o dia em que o YouTube mudou a contagem de views; a primeira leitura limpa fecha em " mais `fechaEm`, quando há; `leitura_falhou`: "a leitura do banco falhou ou foi cortada nesta consulta; o valor não é conhecido"; `sem_registro_na_borda` com `desde`: "falta o registro do canal no dia " mais a data. Código fora do catálogo em execução: a frase de `leitura_falhou`, e `Sentry.captureMessage('e7.frase_sem_motivo')` com o código.
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `todo motivo do catálogo tem frase` | `MOTIVOS_NAO_MEDIDO` | para cada um, texto com mais de 15 caracteres, sem `undefined`, `null`, `NaN` nem chaves `{}` |
| `nenhuma frase traz número escrito quando o argumento vem vazio` | cada motivo com `{}` | sem dígito no texto |
| `os números vêm do argumento` | `poucos_videos` com `n: 2, minimo: 5`; `poucas_publicacoes` com `n: 3, minimo: 4` | o texto contém os dois números |
| `a data sai no formato do Brasil` | `desde: '2026-10-03'` | contém `03/10/2026` |
| `duas frases nunca são iguais` | todas com `{}` | todas diferentes (frase repetida esconde o motivo) |
| `código desconhecido em execução` | um texto fora do catálogo, forçado | a frase de `leitura_falhou`; o aviso foi chamado |
| `fraseDoMotivo usa n, minimo, desde e fechaEm da própria medida` | uma medida com os quatro | os quatro aparecem onde a frase daquele motivo os usa |

**Pronto quando:** testes verdes; `npm run typecheck -w apps/web` limpo (é o typecheck que garante a cobertura dos 34).

### Tarefa 12: orquestrador das medidas

**Arquivo.** `S/competitors-medidas.ts` (`server-only`).
**Contrato.**
- `CANAIS_EM_PARALELO = 4`. **(emenda 1: d:I-1, s:I1)** A constante `ORCAMENTO_MEDIDAS_MS` da versão anterior **não existe mais**: o prazo é do pedido (`PRAZO_DO_PEDIDO_MS = 40_000` e `PRAZO_DO_MOTOR_MS = 15_000`, declaradas neste módulo e usadas por `competitors.ts`), e chega aqui como um instante absoluto.
- `multiplosDoMotor(obs: Observatory): Map<string, { valor: number | null; baseFraca: boolean }>`: uma entrada por vídeo de `obs.videos`, com `valor = v.mult?.value ?? null` e `baseFraca = v.mult?.weak ?? true`.
- `paraCowork<T>(m: Medida<T>): MedidaParaCowork<T>`: a projeção de 4.4 (acrescenta `frase`, omite `notas` vazia; **emenda 1: s:m9: não arredonda nada**, `valor` sai como a E4 entregou).
- **(emenda 1: d:I-1, s:I1)** `contraOPrazo<T>(f: () => Promise<T>, ateMs: number, relogio: () => number): Promise<{ terminou: true; valor: T } | { terminou: false }>` **(emenda 2: s:m1: recebe uma função, não uma promessa; com uma promessa, a leitura já teria começado antes de a corrida olhar o relógio)**: se `ateMs - relogio()` for zero ou negativo, devolve `terminou: false` **sem chamar `f`**; senão chama `f` uma vez e disputa a promessa dela com um temporizador de `ateMs - relogio()`; a rejeição de `f` é repassada a quem chamou; a promessa que perdeu a corrida ganha um `.catch` vazio, para não virar rejeição sem tratamento. **(emenda 2: s:m2) O temporizador é limpo (`clearTimeout`) quando a promessa de `f` resolve ou rejeita:** sem isso cada pedido deixaria um temporizador de até 15 s e um de até 40 s por canal vivos depois de a resposta sair. É exportada: a Tarefa 13 a usa para o motor.
- `medidasDosCanais(dep: { supabase; siteId: string }, canais: ReadonlyArray<{ id: string }>, o: { obs: Observatory | null; agoraMs: number; prazoAteMs: number; relogio?: () => number }): Promise<{ porCanal: Map<string, MedidasDoCanalParaCowork>; indisponiveis: { total: number; indisponiveis: number; por_motivo: Record<string, number> }; meta: { calculado_em: string; regra: number; duracao_ms: number; canais_cortados_por_tempo: number } }>`. **Nunca lança, e todo `id` de `canais` tem entrada em `porCanal`.** Por canal: `lerCanal` primeiro; depois `lerVideosDoCanal`; depois, em paralelo, `lerMarcasDoCanal` (com os ids dos vídeos lidos) e `lerRetratosDoCanal`; monta `Insumos` com `series: 'nao_pedida'`, `mudancas: 'nao_pedida'`, `comentarios: 'nao_pedido'` e `multiplos` = o mapa do motor ou, com `obs` nulo, `'nao_pedido'`; chama `medidasDoCanal`; projeta. Com `obs` nulo, **sobrescreve** a taxa de acerto dos dois formatos com `naoMedido('leitura_falhou')` (o montador diria `sem_multiplo`, que seria falso: o motor falhou, não é o canal que não tem múltiplo). As `falhas` do montador vão ao Sentry (`medida` e `classe`). O `siteId` é o de `dep`, repassado a todo leitor; nenhum outro site entra.
- **(emenda 1: d:I-1, s:I1; substitui a regra do teto de 25 s)** Canal não começado quando `relogio() >= o.prazoAteMs`, **e canal em andamento cuja leitura não terminou até `o.prazoAteMs`** (cada canal roda dentro de `contraOPrazo(() => <leitura e montagem do canal>, o.prazoAteMs, relogio)`, emenda 2: s:m1): as nove medidas com `naoMedido('leitura_falhou')`, `situacao: 'nao_determinada'`, e conta em `canais_cortados_por_tempo`. `medidasDosCanais` devolve, no pior caso, em `prazoAteMs` mais o tempo de montar a saída, qualquer que seja o estado dos leitores.
- Um canal que lança (defeito): o mesmo tratamento, mais `Sentry.captureException`; os outros seguem.
**Testes** (com o falso da Tarefa 2, que ganha `competitor_channel_snapshots`, `competitor_video_marks` e `competitor_video_mark_misses`, e uma base "cheia" em que as nove medidas de um canal saem medidas). **(emenda 1: s:m11)** A base cheia usa um `AGORA` fixo **anterior a 24/08/2026** (resposta (k) da Tarefa 10): só assim a janela de 112 dias da queda não cruza a mudança de contagem e a `queda` pode sair medida, sem escrever data futura. Os testes que precisam da queda **não** medida por cruzar a mudança usam um segundo `AGORA`, entre 24/08/2026 e o dia em que o teste é escrito, também declarado no arquivo.

| Nome | Entrada | Esperado |
|---|---|---|
| **`banco sem nenhuma linha nova: as nove medidas saem nao_medido com motivo do catálogo e frase`** (o teste que o spec manda, linha 17) | canal com vídeos e **sem** retratos, sem marcas, `obs` de um motor vazio | as nove: `estado: 'nao_medido'`, `motivo` dentro de `MOTIVOS_NAO_MEDIDO`, `frase` igual a `fraseDoMotivo`; `indisponiveis.indisponiveis` = 9 |
| `o texto serializado contém a frase de cada motivo` | o `JSON.stringify` da saída acima | contém cada frase, literalmente |
| `base cheia: as nove medidas medidas, com valor, n e janela` | a base cheia | nenhuma `nao_medido`; `indisponiveis: 0`; `por_motivo` vazio; três valores conferidos à mão no teste (a direção do canal com retratos 1.000.000, 1.100.000 e 1.230.000 dá +0,3; um ritmo; uma taxa de acerto) |
| `apagar por etapas` | parte da base cheia e apaga: (a) retratos; (b) vídeos; (c) o canal | (a) só `direcao_do_canal` e `queda` mudam; (b) as de vídeo mudam; (c) tudo `leitura_falhou` e `situacao: 'nao_determinada'` |
| `nenhuma folha é nula, indefinida, NaN ou Infinity, e nenhuma medida é zero por falta` | varredura recursiva nos quatro estágios | nenhuma |
| `tabela de marcas ausente não muda nenhuma das nove` | modo ausente nas duas tabelas de marcas | igual à base cheia |
| `tabela de retratos ausente` | modo ausente | `direcao_do_canal` e `queda`: `leitura_falhou`; ritmo, acerto e vídeos novos seguem |
| `erro do banco nos vídeos de um canal não afeta o outro` | modo erro só para o canal 1 | canal 1 com `leitura_falhou` nas de vídeo; canal 2 igual à base cheia |
| `motor nulo: a taxa de acerto diz leitura_falhou, nunca sem_multiplo; as outras sete seguem` | `obs: null` | conforme |
| `motor presente e canal sem múltiplo` | mapa sem os vídeos do canal | o motivo que a E4 der, com frase (não `leitura_falhou`) |
| `ativo só é confirmado com parado e queda medidos` | base cheia; depois sem os 113 dias de retrato | primeiro `situacao: 'ativo', confirmada: true`; depois `confirmada: false` |
| `parado e fora do ar são confirmados mesmo com a queda não medida` | canal com `missing_since`; canal sem publicar há muito | `confirmada: true` |
| `longos e Shorts não se misturam` | canal com 6 longos e 6 Shorts de números bem diferentes | os dois blocos de `por_formato` diferem e cada um bate com a conta feita só com o seu formato |
| `o prazo corta quem não começou` **(emenda 1: d:I-1, s:I1; substitui "o teto de tempo")** | relógio falso que passa de `prazoAteMs` depois do 2º canal, com 6 canais e `CANAIS_EM_PARALELO` 4 | os canais não começados: nove `leitura_falhou`, `situacao: 'nao_determinada'`; `canais_cortados_por_tempo` = o número deles; os que terminaram antes saem inteiros |
| **`canal em andamento que nunca responde não segura a resposta`** **(emenda 1)** | um leitor falso que devolve uma promessa que nunca resolve, no canal 2 de 3; temporizadores falsos avançados até `prazoAteMs` | `medidasDosCanais` resolve; o canal 2 tem as nove `leitura_falhou` e conta em `canais_cortados_por_tempo`; os canais 1 e 3 saem inteiros; nenhuma rejeição sem tratamento |
| `prazo já vencido na chegada` **(emenda 1)** | `prazoAteMs` menor que o relógio | todo canal cortado, nenhum leitor chamado (contador), `canais_cortados_por_tempo` = o número de canais |
| `contraOPrazo: termina antes, termina depois, rejeita, e prazo zero` **(emenda 1)** | quatro casos com temporizadores falsos | `terminou: true` com o valor; `terminou: false`; a rejeição sai; `terminou: false` sem esperar, **e a função não foi chamada** (contador; emenda 2: s:m1) |
| `contraOPrazo limpa o temporizador` **(emenda 2: s:m2)** | temporizadores falsos; `f` resolve antes do prazo; depois, `f` rejeita antes do prazo | `vi.getTimerCount()` igual a zero nos dois casos, logo depois de a corrida terminar |
| **`o texto que a ferramenta MCP entrega, com 15 canais, cabe no limite`** **(emenda 1: s:I5)** | uma base de 15 canais com as nove medidas (medidas e não medidas misturadas), montada no formato da resposta de `channels`, passada por `toMcpSuccess` | `content[0].text.length` anotado no relatório ao lado de `JSON.stringify(data).length`; **falha acima do limite da P-14** (60.000 sem a resposta do dono). Se falhar: não se mexe no limite; a Tarefa 13 leva o conserto da seção 5 e o teste passa a medir o texto sem indentação |
| `nunca mais que 4 canais ao mesmo tempo` | falso que conta as chamadas a `lerCanal` em aberto | máximo 4 |
| `todo canal pedido tem entrada, mesmo quando um leitor lança` | leitor de vídeos que lança no canal 2 | três entradas; a do canal 2 com `leitura_falhou`; nenhuma exceção sai |
| `lista de canais vazia` | `[]` | mapa vazio; `total: 0`, `indisponiveis: 0` |
| `os números saem como a E4 entregou, sem arredondar` **(emenda 1: s:m9; substitui o teste de 4 casas)** | `variacao: 0.00004` com `direcao: 'subindo'`, `n: 12` | `0.00004` e `12`, idênticos (o número não se separa da leitura dele) |
| `ativo com a queda não medida por cruzar a mudança de contagem` **(emenda 1: s:m11)** | o segundo `AGORA` (depois de 24/08/2026), retratos completos | `situacao: 'ativo'`, `confirmada: false`, `queda` não medida com motivo do catálogo e frase |
| `notas vazia some; notas com item fica` | uma medida de cada | conforme |
| `medidas_indisponiveis soma certo` | base mista | `total` = canais × 9; a soma de `por_motivo` = `indisponiveis` |
| **mutação:** `o site de dep chega a todo leitor` | canal de B pedido com `siteId` de A | tudo `leitura_falhou` (a E4 responde `canal_de_outro_site`), e **nenhuma** consulta a vídeos, marcas ou retratos é feita para ele; trocando o `siteId` repassado por outro valor, o teste falha |
| **mutação:** `os múltiplos de um canal não vazam para outro` | dois canais, múltiplos só dos vídeos do canal 1 | a taxa de acerto do canal 2 não é medida com os do 1 |
| `o arquivo não cita o que é proibido` | o texto de `competitors-medidas.ts` | sem `loadRows`, `rowsToDataset`, `loadDataset`, `loadChannelRows`, `weeklySeries`, `tierSpans`, `unobservedSeries`, `competitor_video_comment` |

**Pronto quando:** testes verdes; o relatório traz as duas mutações, os dois tamanhos do teste da porta MCP (com e sem indentação) e uma frase sem ambiguidade, "o texto da ferramenta ficou ACIMA do limite da P-14" ou "ficou DENTRO do limite", que decide a lista de arquivos da Tarefa 13.

### Tarefa 13: integração do Lote 2 (a única do lote que toca `competitors.ts`)

**Arquivos.** `S/competitors.ts`; `channels/route.ts`; o teste de paridade; **(emenda 2: s:m3)** `mcp/services/youtube-observatory.ts` (só a ação `list_channels`) e `test/mcp/youtube-observatory-parametros.test.ts`.
**Contrato.** `CompetitorChannelRow` ganha `medidas: MedidasDoCanalParaCowork`; `CompetitorChannelList` ganha `medidas_indisponiveis` e `medidas_meta`. Em `listCompetitorChannels`, depois do perfil: carrega o motor com a `loadObservatory` que já existe, dentro de `try` (falhou: `obs = null` e `Sentry.captureException`); chama `medidasDosCanais({ supabase, siteId }, canais, { obs, agoraMs, prazoAteMs, relogio })` **(emenda 2: s:m10: a chamada passou a mostrar os argumentos finais, os do parágrafo "O prazo" abaixo)**, com `agoraMs` de `observatoryNow()`. Se a chamada inteira lançar (defeito): todas as medidas de todos os canais com `leitura_falhou`, `situacao: 'nao_determinada'`, e a lista segue. `channels/route.ts` ganha `export const maxDuration = 60`.
**(emenda 1: d:I-1, s:I1) O prazo.** `listCompetitorChannels` ganha um segundo argumento opcional, `o?: { relogio?: () => number }` (padrão `Date.now`; a rota e o adaptador MCP continuam chamando só com o contexto), e marca `inicio` na **primeira linha**, antes da consulta de canais, e calcula `prazoAteMs = inicio + PRAZO_DO_PEDIDO_MS`. O motor roda dentro de `contraOPrazo(() => loadObservatory(…), min(agora + PRAZO_DO_MOTOR_MS, prazoAteMs), relogio)` **(emenda 2: s:m1: a função, não a promessa; com o prazo vencido `loadObservatory` não é chamada, que é o que o teste "o prazo conta do início" exige)**: não terminou, `obs = null` e `Sentry.captureMessage('e7.motor_fora_do_prazo')`. `medidasDosCanais` recebe o mesmo `prazoAteMs`. Nenhuma das consultas de hoje é editada nem ganha tempo limite (o corpo de hoje não muda); elas só consomem o prazo.
**(emenda 1: s:I5) Só se o relatório da Tarefa 12 disse que o texto da ferramenta ficou ACIMA do limite da P-14:** no adaptador `youtube-observatory.ts`, a ação `list_channels` deixa de usar `toMcpSuccess` e devolve `{ content: [{ type: 'text', text: JSON.stringify(result.data) }], isError: false }` (sem indentação; `mcp/errors.ts` não é tocado; as outras três ações não mudam). O relatório traz o tamanho antes e depois.
**(emenda 2: s:m3) Sempre, com ou sem o conserto acima: o aviso de tamanho.** O adaptador declara `LIMITE_DO_TEXTO_DA_FERRAMENTA` (o limite da P-14; 60.000 sem a resposta do dono; constante operacional, não regra de negócio) e, na ação `list_channels`, mede o texto que vai devolver: acima de 80% do limite, `Sentry.captureMessage('e7.resposta_da_ferramenta_grande')` com `{ caracteres, canais }` e nada mais (nenhum nome, id ou valor). O aviso não muda a resposta e não pode derrubá-la (fica dentro de `try`).
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `channels: as nove chaves de hoje não mudaram` | base da Tarefa 2 | projeção igual ao retrato |
| `channels: todo canal tem medidas, e o topo tem medidas_indisponiveis e medidas_meta` | base cheia | conforme; `medidas_meta.regra` = `MEASURE_RULES.ruleVersion` |
| `site sem canal` | base vazia | `channels: []`, `total: 0`, e **nenhuma** carga do motor nem leitor por canal (contador) |
| `o motor que lança não derruba a lista` | modo lança nas tabelas que só o motor lê | 200; as nove chaves e o perfil normais; taxa de acerto `leitura_falhou` |
| `medidasDosCanais que lança não derruba a lista` | módulo simulado que lança | 200; tudo `leitura_falhou`; nove chaves normais |
| `changes e outliers e insights não mudaram` | as três chamadas sobre a base da Tarefa 2 | `changes` igual ao retrato; os testes de hoje de `outliers` e `insights` verdes sem edição |
| `a rota declara maxDuration 60` | o módulo da rota | `maxDuration === 60` |
| **`motor que nunca responde não segura a resposta`** **(emenda 1: d:I-1, s:I1)** | o falso devolve promessa que nunca resolve nas tabelas que só o motor lê; temporizadores falsos avançados 15 s | 200; as nove chaves iguais ao retrato; perfil normal; taxa de acerto dos dois formatos `leitura_falhou`; as outras sete medidas seguem; o aviso `e7.motor_fora_do_prazo` foi chamado |
| **`leitor de canal que nunca responde não segura a resposta`** **(emenda 1)** | promessa pendente nos retratos de um canal; temporizadores avançados até os 40 s | 200; as nove chaves iguais ao retrato; aquele canal com as nove `leitura_falhou`; `canais_cortados_por_tempo: 1` |
| `o prazo conta do início do pedido` **(emenda 1)** | relógio injetado que já marca 41 s quando as consultas de hoje terminam | motor e leitores de canal **não são chamados** (contador); todas as medidas `leitura_falhou`; `canais_cortados_por_tempo` = o número de canais; as nove chaves e o perfil saem |
| `só se o conserto da porta MCP entrou: list_channels sai sem indentação e cabe no limite` **(emenda 1: s:I5)** | o adaptador com o serviço simulado devolvendo a base de 15 canais | o texto faz `JSON.parse` e é igual ao dado; não contém `"\n  "`; `length` abaixo do limite da P-14; `get_changes`, `get_outliers` e `get_insights` continuam com o formato de antes |
| `list_channels avisa quando o texto passa de 80% do limite` **(emenda 2: s:m3)** | o serviço simulado devolve uma lista cujo texto fica logo abaixo e, depois, logo acima de 80% do limite | abaixo: nenhum aviso; acima: `e7.resposta_da_ferramenta_grande` uma vez, com `caracteres` e `canais` e sem nenhuma outra chave; a resposta é a mesma nos dois casos |
| `o aviso que lança não derruba a resposta` **(emenda 2: s:m3)** | `Sentry.captureMessage` simulado que lança | a ferramenta devolve a lista, `isError: false` |

**Mais:** `TP/youtube-competitors.test.ts` (o de hoje, com o falso em fila) verde **sem edição**. **(emenda 2: s:m11; a frase anterior dizia que tudo respondia nulo)** Esse falso (`TP/youtube-competitors.test.ts:41-71`) não tem `abortSignal` nem `neq`: as consultas desta etapa que levam `.abortSignal` (as do perfil) **lançam `TypeError`** em vez de devolver nulo, e as que não levam (os leitores da E4, sem tempo limite) recebem `{ data: null, error: null }` da fila vazia. Os dois caminhos têm de terminar em `nao_lido` ou `leitura_falhou` sem lançar para fora do serviço. **O falso de hoje não é "consertado"** para ganhar `abortSignal`: o arquivo não é editado, e o caminho da exceção é justamente o que ele exercita. `test/youtube/observatorio/consumidores-semanal.test.ts` e `comentarios-varredura.test.ts` verdes sem edição. O retrato da Tarefa 1 verde.
**Pronto quando:** tudo verde; `git diff --stat` do commit com os cinco arquivos (emenda 2: s:m3; eram três).

### Tarefa 14: documento, Lote 2, e varredura estendida

**Antes:** P-8 e P-8b. **O commit dispara a semente** (mesma regra da Tarefa 7: **emenda 1: s:I6**, o agente entrega os arquivos prontos e testados e **não commita**; o commit é do controlador, com a hora do log no relatório).
**(emenda 1) O que muda a mais, por achado.**
- **(s:m3) `situacao: "ativo"` com `confirmada: false` será a resposta de quase todo canal até 14/12/2026,** e um leitor de texto lê "ativo". O documento ganha a regra, na subseção "Como ler uma medida": "quando `confirmada` é `false`, não diga que o canal está ativo: diga que não foi possível medir a queda e cite a `frase` de `queda`". E `prompts.ts` ganha **uma linha** no bloco que a Tarefa 7 escreveu: "when `estado_do_canal.confirmada` is false, do not state the channel is active: say the drop could not be measured and quote the `frase` of `queda`". O valor `'ativo'` não é trocado: é o que a E4 entrega e o que a tela vai mostrar (risco 9).
- **(s:m4) Canal cortado por tempo.** A frase "vale repetir a chamada" abaixo passa a ser: "repita a chamada **uma vez**; se `canais_cortados_por_tempo` continuar maior que zero, não repita de novo: relate quais canais ficaram sem medida". O corte depende do volume, e repetir sem limite cairia no mesmo prazo a cada vez.
- **(s:I5)** O documento diz que a ferramenta `youtube_observatory`, ação `list_channels`, devolve o mesmo conteúdo da rota (e, se o conserto da Tarefa 13 entrou, sem indentação).
**O que muda.**
- No bloco de `channels` do documento: o exemplo ganha `medidas`, `medidas_indisponiveis` e `medidas_meta`, com uma medida medida e uma não medida; uma subseção "Como ler uma medida", com as regras: toda medida existe sempre; `estado: "nao_medido"` traz `motivo` (código) e `frase` (o porquê, em português), e o valor não deve ser estimado; `n` é o tamanho da amostra e `janela` o período; `por_formato` separa longos (`long`) e Shorts (`short`), que nunca se comparam; `estado_do_canal.confirmada: false` quer dizer que "ativo" não foi confirmado, e `situacao: "nao_determinada"` que a leitura falhou; `medidas_meta.canais_cortados_por_tempo` maior que zero quer dizer que a resposta está incompleta (o que fazer: a regra "repita uma vez" da emenda 1 acima, que substitui o "vale repetir a chamada" da versão anterior). O nome de cada medida em uma linha (o que mede e contra o quê), copiado do spec 04, sem limiar: os limiares vêm nos próprios campos e mudam sem aviso. A lista dos 34 códigos **não** é copiada para o documento (a frase vem na resposta).
- A varredura da Tarefa 8 passa a incluir a resposta de `channels` com medidas.
**Testes** (acrescentados aos dois arquivos).

| Nome | Entrada | Esperado |
|---|---|---|
| `o exemplo de channels tem as chaves de medidas que o serviço devolve` | o bloco JSON e a base cheia | o conjunto de chaves de `medidas`, de `por_formato.long`, de `estado_do_canal`, de `medidas_indisponiveis` e de `medidas_meta` iguais |
| `o exemplo de medida não medida tem motivo do catálogo e a frase dele` | o bloco | `motivo` em `MOTIVOS_NAO_MEDIDO` e `frase` = `fraseDoMotivo` daquele exemplo |
| `o documento não traz número de limiar na subseção das medidas` | o texto da subseção, fora dos blocos de código | sem dígito seguido de `%`, "dias" ou "vídeos" |
| `a seção Coaching continua dentro dos 8.000 caracteres` | o teste de hoje | verde, sem edição |
| `nenhuma sentinela na resposta de channels com medidas` | a varredura | nenhuma |
| `o documento e o prompt dizem o que fazer com confirmada false` **(emenda 1: s:m3)** | o texto da subseção e o prompt gerado | os dois contêm `confirmada` e `queda` na mesma frase |
| `o documento manda repetir uma vez só` **(emenda 1: s:m4)** | a frase de `canais_cortados_por_tempo` | contém "uma vez"; não contém "vale repetir a chamada" sem limite |
| `o prompt continua sem campo inexistente` **(emenda 1: s:m3)** | o teste da Tarefa 7 | verde, sem edição da expectativa antiga |

**Pronto quando:** testes verdes; nenhuma linha acima da 600 do documento mudou; `git diff -U0` de `prompts.ts` com uma linha acrescentada; o commit foi feito pelo controlador.

### Tarefa 15: testes de ponta contra o banco, com tempo medido

**Arquivo.** `test/integration/observatorio-a5-e7-cowork.test.ts`, gated em `HAS_LOCAL_DB`, contra o `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`), sem paralelismo entre arquivos. Cada teste cria o **seu** site, canais e vídeos, e apaga no fim; nunca conta "o banco inteiro"; nunca roda `db:reset`; nunca chama função como `anon` ou `authenticated`.
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `as consultas dos módulos novos são aceitas pelo PostgREST de verdade` | um site com 2 canais, 20 vídeos, retratos de 120 dias, 6 versões de campo | `channels` 200 com `perfil` e `medidas`; `changes?campos=todos` com `estado: 'lido'` (é o que pega nome de coluna errado, que o falso não pega). **(emenda 1: s:I3)** A parte do perfil e de `campos=todos` já foi provada no Lote 1, pela Tarefa 8b, em arquivo próprio; aqui o que é novo são os leitores de medidas |
| `dois sites no mesmo banco não se enxergam` | sites A e B com canais do mesmo `channel_id` do YouTube | a resposta de A não tem nenhum id, nome nem título de B, em `channels` e em `changes?campos=todos` |
| `com as tabelas de marcas ausentes ou presentes, as nove medidas são as mesmas` | roda com o que o `bythiago_int` tiver; se a MG4 estiver aplicada nele, o relatório diz | iguais nos dois casos em que for possível rodar; se só um for possível, o relatório diz qual |
| `tempo com 15 canais e 1.400 vídeos` | a semente de e2e ou um site criado com esse volume | `medidas_meta.duracao_ms` anotado no relatório; **falha acima de 10.000** (no banco local, sem rede; se falhar, parar e avisar: é o gatilho do conserto da seção 5) |
| `tamanho da resposta com 15 canais` | a mesma chamada | os bytes de `JSON.stringify`, anotados; **falha acima de 80.000** |
| `tamanho pela porta MCP com 15 canais, no banco` **(emenda 1: s:I5)** | o texto que a ação `list_channels` do adaptador devolve para a mesma base | `content[0].text.length` anotado; **falha acima do limite da P-14** (é a medição com dado de verdade; a da Tarefa 12 é sobre base montada) |
| `o tempo de montar a resposta` **(emenda 1: d:I-1)** | a mesma chamada | o tempo entre o fim de `medidasDosCanais` e o retorno, anotado (é a parcela "montar e serializar" da conta da seção 5) |
| `o canal apagado some da resposta` | apaga um canal e chama de novo | não está em `channels` nem em `changes?campos=todos` |

**Pronto quando:** testes verdes com o banco local; os quatro números (tempo, bytes, texto da ferramenta e tempo de montagem) estão no relatório e no ledger, **(emenda 2: s:m3)** e mais dois derivados: os caracteres por canal (o texto da ferramenta dividido por 15) e o número de canais do gatilho da `e7-l2-d7`, `floor(0,8 × limite da P-14 ÷ caracteres por canal)`.

### Tarefa 16: envio do Lote 2 e conferências

**Antes.** O lote da E4 em produção (P-3 de novo: as duas tabelas existem e a conferência `e4-d0` foi feita); Tarefas 10 a 15 commitadas; o tempo e o tamanho da Tarefa 15 dentro do limite; suíte do web inteira verde na árvore do lote. **(emenda 1)** Mais: a P-10 respondida e anotada por canal (d:I-3); a P-12 e a P-14 respondidas ou com o padrão assumido escrito no ledger (s:m10, s:I5); o texto da ferramenta dentro do limite da P-14 nos testes das Tarefas 12 e 15 (s:I5); a árvore do lote montada e a suíte rodada nela pelo controlador, como na Tarefa 9 (s:I4).
**No commit do envio.** `E7_LOTE2_DEPLOY` e `conferenciasE7Lote2(deploy)`, no mesmo molde. Entradas (`etapa: 'E7'`):

| id | Data | Responsável | O que conferir e o esperado |
|---|---|---|---|
| `e7-l2-d0` | D0 | dono | os dois comandos do Lote 2 (seção 2). Esperado: `200`; `time_total` abaixo de 10 s (entre 10 e 40: abrir o conserto da seção 5; a partir de 40: vermelho); `size_download` abaixo de 80.000; `canais` = o número da P-4; `indisponiveis.total` = canais × 9; `meta.canais_cortados_por_tempo` = 0; em `por_motivo`, `leitura_falhou` = 0 e `calculo_falhou` = 0 (qualquer um maior que zero: ler o Sentry e abrir conserto); **(emenda 1: d:I-3, s:m5; substitui "`janela_cruza_mudanca_de_contagem` = o número de canais")** a soma de `por_motivo` é igual a `indisponiveis`, e a `queda` de todo canal está não medida, cada uma com motivo do catálogo: o motivo por canal é o da regra da E4 (resposta (i) da Tarefa 10) aplicada à cobertura que a P-10 mostrou, sem número fixo de canais por motivo. **(emenda 1: s:I5)** E uma linha a mais, do dono ou do Cowork: chamar a ferramenta `youtube_observatory` com `action: list_channels` e confirmar que a lista veio **inteira** (o último canal da lista aparece e o texto termina com `medidas_meta`); se veio cortada ou recusada: vermelho, e o conserto é o da seção 5 |
| `e7-l2-d1` | D+1 | agente | Sentry: nenhum evento de `competitors-medidas`, `e7.frase_sem_motivo`, `e7.motor_fora_do_prazo` nem `e7.resposta_da_ferramenta_grande` (emenda 2: s:m3); a P-5 de novo, **(emenda 1: d:m-6)** lembrando que depois do veredito da E19 (20/10) a chave `cowork-permanent` deixa de ser registrada e zero linhas não quer dizer que ninguém usou |
| `e7-l2-d7` | D+7 | dono e agente | os dois comandos de novo: `indisponiveis` não subiu sem causa; `leitura_falhou` = 0. Agente: `select count(*) from public.competitor_channels` (só leitura). **(emenda 2: s:m3; substitui "acima de 30 canais, ou `size_download` acima de 80.000")** O gatilho é o da porta que estoura primeiro, a MCP: o número de canais acima de `floor(0,8 × limite da P-14 ÷ caracteres por canal)`, em que "caracteres por canal" é o texto da ferramenta medido na Tarefa 15 dividido por 15; o número resultante é **escrito no ledger na Tarefa 15** e copiado para o texto desta conferência no commit do envio (nenhum número de canais é afirmado aqui antes da medição). Passou, ou `size_download` acima de 80.000, ou houve evento `e7.resposta_da_ferramenta_grande` no Sentry na semana: **abrir a dívida 2** (paginação ou filtro por canal) e levar ao dono. **(emenda 1: d:m-1)** E a contagem da tabela de versões de novo (`select count(*) from public.competitor_field_versions`): acima de 200.000, abrir o pedido de índice do Apêndice A |
| `e7-queda` | 15/12/2026 | dono | os dois comandos: **nenhum** `janela_cruza_mudanca_de_contagem` em `por_motivo`. Maior que zero: conferir com a `e4-queda` do plano da E4. **(emenda 1: d:I-3)** Não se espera que a queda esteja medida em todo canal: nos que a P-10 mostrou com menos de 112 dias de retrato ela continua não medida, por falta de borda, até a data anotada para cada um; o que se confere é que o motivo deles não é mais o da mudança de contagem |

Testes em `conferencias.test.ts`: os quatro do molde, mais `a entrada de 15/12/2026 é fixa e só existe com o Lote 2 enviado`.
**Lista de arquivos do lote.** `S/competitors-frases.ts`, `S/competitors-medidas.ts`, `competitors.ts` (o commit da Tarefa 13), `channels/route.ts`, o documento e a linha de `mcp/prompts.ts` (o commit da Tarefa 14), os testes das Tarefas 11 a 15, `TP/e7-fixture.ts`, `conferencias.ts`, o teste e o espelho; **(emenda 2: s:m3; antes era condicional)** e `mcp/services/youtube-observatory.ts` com o teste dele (no commit da Tarefa 13, sempre, pelo aviso de tamanho; o conserto da indentação vai junto se entrou).
**Ordem que não pode inverter.** (1) lote da E4 em produção; (2) P-8, P-8b e o commit do documento, pelo controlador; (3) push em `staging`, CI verde; (4) promoção a `main`, fora de 11:55 a 12:15 UTC; (5) `e7-l2-d0`. **Se (3) vier antes de (1):** o CI fica vermelho no typecheck (os arquivos de `medidas/` não existem no remoto) e nada é promovido. Não há variável a ligar.
**Volta.** Reverter o commit da Tarefa 13: `channels` volta ao Lote 1 (nove chaves e perfil); os dois módulos novos ficam sem uso. Reverter o da Tarefa 14 junto, para o documento não descrever o que a rota não devolve (o hook roda a semente de novo, sem mudança de conteúdo; **emenda 1: s:I6:** é commit do controlador, com a P-8 e a P-8b antes e a hora do log depois, e o `updated_at` das entradas muda). O aviso de tamanho da porta MCP (e o conserto da indentação, se entrou) está no commit da Tarefa 13 e volta junto com ela. **(emenda 2: s:m5)** No mesmo commit do revert da Tarefa 13, `test/integration/observatorio-a5-e7-cowork.test.ts` passa a `describe.skip` com o motivo e o hash do revert (ele testa `medidas` pelo serviço e ficaria vermelho no banco local), e o mesmo para os casos de paridade e de varredura que afirmam `medidas`. Nada no banco para desfazer.
**"Os números não mudam" (item 247).** Este plano não toca nenhum arquivo que calcula número de tela nem de pacote. A prova: os retratos das Tarefas 1 e 2 verdes; `consumidores-semanal.test.ts`, `channels-parity`, `forja-parity` e `forja-sent` verdes sem mudança de expectativa; e `git diff --stat` dos dois lotes sem nenhum arquivo de `observatorio/` nem de `app/cms/`.
**Pronto quando:** `e7-l2-d0` feita e anotada; `feitaEm` preenchido.

---

## 11. Consultas de conferência e o que foi rodado

**Migration:** não há; não há consulta pós-aplicação.

**O que foi rodado para este plano (13/10, só leitura do repositório local):**
- `ls apps/web/src/lib/youtube/observatorio/medidas`: não existe (a E4 ainda não tem código).
- `.husky/pre-commit` lido inteiro: a semente roda no commit que toca `docs/cowork-`, `data/pipeline-docs/`, `api-registry.ts` ou o script.
- `git diff --stat origin/main -- docs/cowork-*`: vazio. `git diff --stat origin/staging -- docs/cowork-* apps/web/data/pipeline-docs apps/web/src/lib/pipeline/api-registry.ts`: só `cowork-docs-youtube.md`, 2 linhas, do commit `2035904f`.
- `grep -rn "maxDuration" apps/web/src/app/api/pipeline`: só `intelligence` e `readings` (60).
- `grep -n "channelLimit" …/rules.ts`: 75.
- O serviço, as duas rotas, o adaptador MCP, o anúncio da ferramenta, o prompt, o documento (linhas 600 a 725 e 1600 a 1614), o teste de hoje e os dois testes de lista fechada foram lidos nos trechos citados em 3.1.

**(emenda 1) O que foi rodado para responder à rodada 1 (13/10, só leitura do repositório local):** `sed` nos trechos citados pelos dois pareceres de `competitors.ts` (170-232), `competitor-sync.ts` (970-1000), `competitor-capture.ts` (150-195), `mcp/errors.ts` (158-168), `services/types.ts`, `tsconfig.json` (`exclude`), `leitura-registro.ts` (165-200), `scripts/seed-pipeline-reference.ts` (215-260), `forja/sent.ts` (8-18), `mcp/services/youtube-observatory.ts` (25-60), a MG1 (86-97) e o plano da E4 (linhas 626 e 791 a 800); `grep -n "abortSignal\|timeout" observatorio/load.ts` (zero linhas); `git diff --stat origin/staging` e `git log origin/staging..HEAD` nos arquivos do motor (F18); `git rev-parse` das três referências (`origin/main` `6d63f387`, `origin/staging` `63db57ba`, `HEAD` `75ca8030`, 316 commits à frente); e `grep -n -A10 "export function objectFromShape"` no SDK do MCP (F5). Todos os fatos citados pelos pareceres que conferi estavam certos.

**(emenda 2) O que foi rodado para responder à rodada 2 (13/10, só leitura do repositório local):** `sed` em `competitor-sync.ts` (585-615 e 970-998), `competitor-capture.ts` (228-243), `mcp/tools.ts` (715-728), `mcp/services/youtube-observatory.ts` (1-60), `mcp/errors.ts` (158-170), `test/api/pipeline/youtube-competitors.test.ts` (38-75), `.husky/pre-commit` (36-50), a MG1 (56-96), `.superpowers/sdd/a5-e12/progress.md` (96-99) e `a5-e16-e15/progress.md` (82); `grep -n "weeklyDue\|series_tier"` e `grep -n "captureBroken"` em `competitor-sync.ts`; `grep -n "^import" forja/sent.ts`; `git diff --stat origin/staging -- apps/web/src/lib/youtube/observatorio`. Todos os fatos citados pelos dois pareceres que conferi estavam certos; o único achado não aceito (d:m-6) é uma afirmação sobre o plano de execução do Postgres que nenhum arquivo prova, e virou conferência pendente no Apêndice A.

**O que não foi rodado:** nenhuma suíte, nenhum build, nenhuma consulta a banco (nem local), nenhuma chamada HTTP. Todas as afirmações sobre produção estão em 3.2 como pendentes.

**Consultas de conferência depois de cada envio:** os comandos da seção 2 (do dono) e a P-5 (do agente), com os esperados nas tabelas das Tarefas 9 e 16.

---

## 12. Onde está cada item de aceite

| Item | O que pede | Tarefa |
|---|---|---|
| 51 (a) | `channels` devolve as medidas com `estado` | 12, 13 (e 15 no banco) |
| 51 (b) | `changes` sem parâmetro idêntico ao de hoje | 2 (retrato), 5 (prova) |
| 51 (c) | com `campos=todos` traz as mudanças de campo | 4, 5, e 8b no banco de verdade (emenda 1: s:I3) |
| 52 (a) | os dois documentos atualizados | 7 e 14 para `cowork-docs-youtube.md`; **`docs/cowork-pipeline-reference.md` fica fora**, pelo desvio 3 (não fala do Observatório; pergunta 7) |
| 52 (b) | a semente rodada | o hook a roda nos commits das Tarefas 7 e 14, feitos pelo controlador; o relatório traz o log com a hora (seção 2; emenda 1: s:I6) |
| 52 (c) | testes de estrutura do registro passam com `endpoint_count` inalterado | nenhuma tarefa toca `api-registry.ts`; a suíte inteira antes de cada envio (9 e 16) |
| 53 | `buildSent` de antes e de depois igual (teste) | 1 |
| Spec, linha 17 | banco sem linha nova devolve `nao_medido` com motivo, e o texto contém a frase | 11, 12 (o primeiro e o segundo teste) |
| Spec, linha 17 | `medidas_indisponiveis` | 12, 13 |
| 9 | `changes` devolve o mesmo corpo sem parâmetro | 2, 5 |
| 89 | nenhuma resposta de pipeline com linha de `yt_own_video_traffic_detail_daily` | 8, 14 |
| 119 | nenhuma resposta de pipeline com o comentário sentinela | 8, 14; e `comentarios-varredura.test.ts` verde sem edição (13) |
| 168 | a classe (iii) nunca sai (descrição do canal, `raw`) | 4, 8, 14 |
| 216 | `channels` igual antes e depois para o que já existia | 2, 5, 13 |
| 124 | M11 só como dado, sem "não respondeu" | fora: M11 não é entregue (desvio 2) |
| 245 | todo interruptor com teste que apaga a variável | não se aplica: a etapa não tem variável (6.3) |
| 246 | conferência com data absoluta, responsável e `feitaEm` | 9, 16 |
| 247 | "os números não mudam" sobre base congelada | 1, 2, 13, 16 |

Nenhum item órfão. Fora, com o motivo dito: a segunda metade do 52 (a) e o 124.

---

## 13. Riscos que ficam, sem suavizar

1. **O Lote 2 é escrito contra um contrato que ainda é só texto.** A E4 não tem código. A Tarefa 10 existe para isso, mas se a E4 mudar `Medida`, `Insumos` ou o `m8` depois dela, o Lote 2 quebra no typecheck (visível) ou, pior, na semântica do estado do canal (invisível). A regra (b) de 4.4 é a defesa contra o segundo caso e tem de ser reconferida se a E4 for emendada.
2. **Por meses quase tudo sai "não medido"** (a queda até 14/12/2026; Shorts com amostra pequena; direção do canal onde houver buraco de retrato). O Cowork vai receber muitas frases de motivo e poucos números. É o comportamento pedido, e é o que mais pode ser lido como defeito.
3. **Duas frases para o mesmo motivo.** O dicionário da E7 nasce antes do da E5 (telas). Nada os mantém iguais. Quando a E5 escrever o dela, um dos dois deve passar a importar o outro (dívida 3).
4. **O tempo da rota em produção é desconhecido** até o D0 do Lote 2. **(emenda 1: d:I-1, s:I1)** O prazo de 40 s do pedido, com corrida contra o relógio, limita tudo o que a etapa acrescenta, ao preço de uma resposta com canais cortados, que o Cowork só percebe se ler `medidas_meta`. **Ele não evita todo 504:** as consultas de vídeo de hoje continuam sem tempo limite (o plano não as muda), e se passarem sozinhas de cerca de 50 s a função é morta, como seria hoje. E a leitura que perde a corrida segue rodando no banco até a função devolver a resposta, porque os leitores da E4 não aceitam cancelamento (dívida 9).
5. **A resposta cresce com o número de canais e não tem paginação.** Com 15 cabe; o site aceita 75.
6. **O commit do documento escreve em produção** (a semente). A P-8 reduz o risco a "regravar o mesmo texto", mas depende de alguém rodá-la na hora, e outro agente pode commitar um `docs/cowork-*` entre a conferência e o commit. **(emenda 1: s:I6, d:m-10)** Mesmo com o texto igual, a semente carimba `updated_at` das entradas em produção a cada um desses commits (dois na ida, até dois na volta); e a P-8b, que compara o banco com o disco, é uma leitura de produção que só o controlador faz: se ela não for rodada, uma edição feita em produção por outra via é apagada em silêncio.
7. **O MCP não deixa rastro de leitura** (`/api/mcp` não passa por `authenticateRead`): se o Cowork ler só pela ferramenta, a P-5 fica vazia e não há como saber, pelo banco, se ele está usando os campos novos.
8. **A chave `forja (so leitura)` alcança tudo o que entrou.** O dado é público, mas o kit da forja não está neste repositório e a cópia na máquina pode estar atrás da local: a P-7 só prova a cópia local.
9. **`situacao: 'nao_determinada'` é um valor que só a E7 escreve.** Se a E5 mostrar o estado do canal com outra regra para o mesmo caso, tela e Cowork divergem.

### O que nenhum teste vai provar

- Que o Cowork **entende** as frases e não inventa valor quando lê `nao_medido`: depende do modelo e do prompt; o documento e o prompt só pedem.
- Que o documento está **certo em prosa**: o teste de conteúdo compara chaves, parâmetros e a lista de campos; o sentido das explicações é revisão humana.
- O **tempo e o tamanho em produção**: só o D0. O teste local roda sem rede.
- Que **o kit da forja instalado** não lê `channels` nem `changes`: só o dono vê a máquina.
- Que **as respostas reais** não contêm dado indevido além das sentinelas plantadas: a varredura prova o caminho do código (lista de colunas e de campos), não o conteúdo de produção.
- Que a **semente** regravou só o que já estava lá: a P-8 compara arquivos, não lê `reference_content`; quem lê é a P-8b (emenda 1: s:I6), que é conferência do controlador e não teste.
- **(emenda 1: s:I5)** Que o programa que o Cowork usa **aceita** o tamanho da resposta da ferramenta: os testes medem caracteres contra um limite assumido (P-14); só a chamada real da `e7-l2-d0` prova.
- **(emenda 2: d:I-2b)** Que a captura de **um** vídeo específico está em dia: `videos_mais_recente` é a maior leitura boa do site, e basta um vídeo lido hoje para ela ser de hoje. Ela distingue "a captura de vídeo parou" de "nada mudou"; não prova que cada vídeo foi relido. O documento diz que a ausência de mudança num vídeo vale até a última leitura dele.
- **(emenda 1: d:I-2)** Que `lido_ate` é entendido: a resposta passa a diferir quando a coleta para, mas quem escreve "nada mudou" ou "a lista vale até dd/mm" é o Cowork.
- **(emenda 1: s:I4)** Que o pacote da forja é o mesmo nos dois motores (o local, com os commits da E2, e o remoto): é a P-13, do controlador.
- Que o retrato de `buildSent` cobre todo pacote possível: cobre os do oráculo.

### Dívida registrada

1. `video_count` de `channels` é "vídeos na conta, no máximo 50" e o erro da consulta de vídeos por canal é engolido (vira 0 e `null`); `insights` devolve `last_upload_days: -1` e `engagement_rate: 0` por falta. São do corpo de hoje, que esta etapa não pode mudar sem quebrar o item 51; o documento novo diz a verdade sobre `video_count`. Conserto: etapa própria, com mudança de corpo anunciada ao Cowork.
2. Paginação ou filtro por canal em `channels` (gatilho na `e7-l2-d7`).
3. Um dicionário só de frases de motivo, compartilhado com a E5.
4. Os recursos MCP do Observatório continuam sem perfil e sem medidas, e o de `outliers` tem nome enganoso ("mudanças salvas").
5. O prompt `competitor-report` injeta os primeiros 6.000 caracteres do documento, que não alcançam a seção do Observatório (linha 604): o Cowork precisa buscar o documento. Trocar a fatia pela seção certa é pequeno e não é desta etapa.
6. `marcas: 'nao_pedida'` no montador da E4, para não ler marcas à toa (pedido ao controlador, 4.5).
7. `docs/cowork-pipeline-reference.md` e a memória `reference_cowork_pipeline_schemas.md` dizem que a referência é semeada por script; o código diz que essa entrada foi removida. Corrigir a memória é do controlador.
8. **(emenda 1: s:m12)** Os `summary` das duas rotas em `api-registry.ts` ("with engagement stats", "with type/bookmarked filters") ficam desatualizados. A regra de Pipeline Integrity não obriga (nenhuma rota nasce nem morre), e editar o registro seria mais um commit que dispara a semente em produção; fica para o próximo commit que tocar esse arquivo por outro motivo.
9. **(emenda 1: d:I-1, s:I1)** Tempo limite por consulta nos leitores de `M/ler.ts` (da E4) e nas leituras do motor (`observatorio/load.ts`): hoje não têm, e a E7 os limita por fora, com a corrida contra o prazo. Pedido ao controlador, para o plano da E4.
10. **(emenda 1: d:I-1)** As consultas de vídeo de hoje em `listCompetitorChannels` (uma por canal, em série, sem tempo limite) são o que resta sem limite na rota; trocá-las por uma consulta só muda o corpo de hoje (`video_count` e a média dependem do corte de 50 por canal) e vai junto com a dívida 1.
11. **(emenda 2: d:I-2b)** `lido_ate` não conta os vídeos sem nenhuma leitura (`last_seen_at` nulo) nem dá a ponta por canal: a contagem pede uma resposta de `count` sem linhas, que a regra global desta etapa trata como erro, e a ponta por canal multiplicaria as consultas. A P-15 dá o número de hoje; se ele for maior que zero, o documento diz, e a contagem entra junto com a dívida 2.
12. **(reconciliação 13/10, emenda 3: n3) Canal com a coleta pausada (E10) segura `lido_ate.mais_antigo`.** Canal pausado deixa de ser lido e a `last_seen_at` dele para no dia da pausa: enquanto ela durar, `mais_antigo` fica nesse dia, e um outro canal que pare por falha depois disso não aparece no campo que existe para mostrá-lo. Nada falso é afirmado (a lista vale até `mais_antigo`), mas a pausa feita de propósito mascara a parada por falha. **Presa à MG6 em produção, não antes** (o Lote 1 pode ir desde o passo 1a da reconciliação, antes da MG6; pedir a coluna sem ela dá `42703` e derruba a consulta (5)): com a MG6 aplicada e conferida, a consulta (5) passa a ler `collection_paused_at`, `mais_antigo` e `mais_recente` saem só dos canais não pausados, e `LidoAte` ganha `canais_pausados: number`. (reconciliação 13/10, emenda 4: p9) **Todos os canais pausados:** `mais_antigo` e `mais_recente` saem `null` (o tipo `LidoAte` já os aceita nulos), com `canais_pausados` igual ao total de canais do site: não há canal lido de onde tirar data, e nunca se usa a data de um pausado nem data inventada. Quem lê distingue "nada mudou" de "ninguém está sendo lido" por esse par, e o documento do Cowork ganha a frase. Teste, com este nome: `canal pausado não segura mais_antigo e conta em canais_pausados`. (reconciliação 13/10, emenda 4: p9) O mesmo teste ganha o caso `todos pausados: mais_antigo e mais_recente nulos, canais_pausados igual ao total` (mutação: cair na data do canal pausado quando a lista de não pausados é vazia). Entra no Lote 2 se a MG6 já estiver em produção no dia; senão, em tarefa própria depois dela. Não rodado.

---

## 14. Apêndices

### Apêndice A: SQL da migration

**Não há migration nesta etapa.** Nenhum objeto de banco é criado, alterado ou apagado; nenhuma policy, função, índice ou gatilho. As consultas novas usam índices que já existem: `idx_cfv_channel_seen` e os dois índices únicos parciais de versão corrente em `competitor_field_versions`; `competitor_channels` por `site_id`. A consulta da página de mudanças (`site_id` + `field in (…)` + `precision <> 'first'`, ordenada por `first_seen_at`) **não tem índice próprio por site**: com o volume de hoje (P-2 dá o número) é uma varredura pequena; se a P-2 mostrar mais de 200.000 linhas na tabela, abre-se um pedido de índice `(site_id, first_seen_at desc)` num lote de migrations, fora deste plano. **(emenda 1: d:m-1)** Para não depender disso, a página passa a filtrar também por `in('competitor_channel_id', <canais do site>)`, que usa `idx_cfv_channel_seen (competitor_channel_id, first_seen_at)`; a ordem de grandeza do volume está na seção 5 (da ordem de 14.000 linhas no primeiro dia com 15 canais, 70.000 com 75), e a contagem é repetida na `e7-l2-d7`, não só uma vez na P-2. A consulta (1), a primeira leitura do site (`site_id`, ordenada por `first_seen_at`, limite 1), continua sem índice próprio: é a que primeiro sentiria o volume, e o gatilho de 200.000 linhas vale para ela. **(emenda 2: d:m-6, não aceito como mudança, e por quê)** O parecer de dados sugeriu, como opcional, rodar a (5) antes da (1) e dar à (1) o mesmo `in('competitor_channel_id', …)`, para ela usar `idx_cfv_channel_seen` e o gatilho deixar de existir. Não mudei a ordem: com uma lista de canais no `in()`, a ordenação por `first_seen_at` não sai pronta do índice (ele é ordenado por canal e só depois por instante), e se o Postgres lê ou não menos linhas assim é fato do plano de execução, que não medi; e com um site só em produção as linhas dos canais do site são a tabela inteira. Fica como **conferência pendente**, a rodar quando o gatilho de 200.000 acender (só leitura; `explain` sem `analyze` não executa a consulta), trocando `<site>` e `<ids>` pelos de produção:
```sql
explain select first_seen_at from public.competitor_field_versions where site_id = '<site>' order by first_seen_at limit 1;
explain select first_seen_at from public.competitor_field_versions where site_id = '<site>' and competitor_channel_id in (<ids>) order by first_seen_at limit 1;
```
Se o segundo plano mostrar custo menor de verdade, a troca de ordem entra como conserto (ela muda o teste `site com versões e sem canal`, que passaria a não rodar a (1)); senão, o caminho é o índice `(site_id, first_seen_at)` já descrito acima.

### Apêndice B: forma final das respostas (exemplo, com valores inventados)

`GET /api/pipeline/youtube/competitors/channels` (Lote 2), um canal:
```json
{ "data": { "channels": [ {
  "id": "uuid", "channel_id": "UC...", "channel_name": "Canal", "thumbnail_url": "https://...", "subscriber_count": 50000,
  "video_count": 50, "last_synced_at": "2026-10-13T15:00:00Z", "added_at": "2026-10-02T12:00:00Z", "avg_engagement": 0.042,
  "perfil": { "estado": "lido", "lido_em": "2026-10-13T15:00:00Z", "handle": "@canal", "pais": null, "criado_em": "2019-03-01T10:00:00Z" },
  "medidas": {
    "direcao_do_canal": { "estado": "medido", "valor": { "variacao": 0.3, "direcao": "subindo", "ganhoRecente": 130000, "ganhoAnterior": 100000 }, "n": 3, "janela": { "de": "2026-08-18", "ate": "2026-10-13", "dias": 56 }, "notas": [ { "tipo": "mudanca_de_contagem" } ] },
    "estado_do_canal": { "situacao": "ativo", "confirmada": false,
      "parado": { "estado": "medido", "valor": { "dias": 3, "limite": 28 }, "n": 12, "janela": { "de": null, "ate": "2026-10-13", "dias": null } },
      "queda": { "estado": "nao_medido", "motivo": "janela_cruza_mudanca_de_contagem", "frase": "a janela cruza o dia em que o YouTube mudou a contagem de views; a primeira leitura limpa fecha em 14/12/2026", "fechaEm": "2026-12-14" } },
    "por_formato": {
      "long": { "direcao_dos_videos_novos": { "estado": "medido", "valor": { "variacao": -0.12, "direcao": "descendo" }, "n": 9, "janela": { "de": "2026-04-16", "ate": "2026-10-13", "dias": 180 } },
                "ritmo": { "estado": "medido", "valor": { "porSemana": 1.2, "intervaloMedianoDias": 6, "semanasComPublicacao": 11, "semanas": 13, "maiorBuracoDias": 15 }, "n": 16, "janela": { "de": "2026-07-14", "ate": "2026-10-13", "dias": 91 } },
                "taxa_de_acerto": { "estado": "medido", "valor": { "acertos": 3, "fracassos": 2, "total": 12, "pctAcerto": 0.25, "pctFracasso": 0.1667 }, "n": 12, "janela": { "de": "2026-07-15", "ate": "2026-10-06", "dias": 90 } } },
      "short": { "direcao_dos_videos_novos": { "estado": "nao_medido", "motivo": "poucos_videos", "frase": "há 1 vídeos na janela e a medida pede 3", "n": 1, "minimo": 3 },
                 "ritmo": { "estado": "nao_medido", "motivo": "poucas_publicacoes", "frase": "há 1 publicações na janela e a medida pede 4", "n": 1, "minimo": 4 },
                 "taxa_de_acerto": { "estado": "nao_medido", "motivo": "poucos_videos", "frase": "há 1 vídeos na janela e a medida pede 5", "n": 1, "minimo": 5 } } } } ],
  "count": 1,
  "medidas_indisponiveis": { "total": 9, "indisponiveis": 4, "por_motivo": { "janela_cruza_mudanca_de_contagem": 1, "poucos_videos": 2, "poucas_publicacoes": 1 } },
  "medidas_meta": { "calculado_em": "2026-10-13T18:00:00Z", "regra": 1, "duracao_ms": 2100, "canais_cortados_por_tempo": 0 } } }
```
Os nomes de dentro de `valor` e os de `janela` são os que a E4 entregar (a Tarefa 10 confere); os do exemplo vêm do plano dela. As frases do exemplo mostram a forma; o texto final é o da Tarefa 11, que acerta o plural.

`GET /api/pipeline/youtube/competitors/changes?campos=todos`:
```json
{ "data": { "changes": [ "…como hoje…" ], "count": 8,
  "mudancas_de_campo": { "estado": "lido", "count": 1, "limite": 25, "cortado": false, "coleta_desde": "2026-10-13T12:10:00Z",
    "lido_ate": { "mais_antigo": "2026-10-14T12:08:00Z", "mais_recente": "2026-10-14T12:10:00Z", "canais_sem_leitura": 0, "videos_mais_antigo": "2026-10-08T12:09:00Z", "videos_mais_recente": "2026-10-14T12:10:00Z" }, "fora_da_lista": 0, "video_de_outro_site": 0, "video_ausente": 0,
    "itens": [ { "id": 4812, "alvo": "video", "channel_name": "Canal", "video_id": "dQw4w9WgXcQ", "video_title": "Título", "campo": "tags",
      "valor_novo": ["viagem", "japão"], "valor_anterior": { "estado": "lido", "valor": ["viagem"] },
      "visto_em": "2026-10-14T12:10:00Z", "janela_desde": "2026-10-13T12:10:00Z", "precisao": "1d" } ] } } }
```
