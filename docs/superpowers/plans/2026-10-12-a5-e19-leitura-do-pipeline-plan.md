# A5 · E19: a leitura do pipeline passa a respeitar `permissions` — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## O que mudou na emenda do portão (12/10/2026)

Os dois revisores aprovaram com ressalvas, sem crítico. Resposta linha a linha: `.superpowers/sdd/a5/resposta-revisao-planos-e19-e20.md`. Cada trecho mexido traz `(emenda do portão: <id>)`.

1. **A janela só fecha com uma execução real da fila dentro dela** (S19-I2): 7 dias medidos **e** pelo menos um dia medido com tarefa da forja concluída. Tarefa 6, com teste.
2. **Ninguém roda o `curl` de controle por padrão** (S19-I6, decisão do controlador): dia sem leitura com `read` é "não medido" e a janela espera. O `curl` é comando opcional do dono. O agente não usa a chave dele.
3. **A volta do dia da recusa tem roteiro e precondição** (S19-I4, decisão do controlador): sessão aberta e dono avisado nas 2 horas seguintes, ou a recusa não é promovida; commit 2 promovido sozinho; comandos da volta no ledger antes de promover. O "Instant Rollback" da Vercel é opção do dono.
4. **O registro tem teto no tempo também no modo recusa** (D-I4) **e teto de tempo por leitura** (S19-I5: 1,5 s para o registro inteiro).
5. **A Tarefa 3 conserta o teste que ela quebraria** (S19-I1: `context-filters.test.ts`).
6. **Conferências com data** (S19-I3, item 246): entram em `lib/conferencias.ts`, criado pela Tarefa 6 do plano da E20; até lá valem em `.superpowers/sdd/a5/conferencias-com-data.md`.
7. Menores: falha de gravação com uma captura por hora e argumento obrigatório no script (S19-M1, D-M11); dia que bate no teto marcado (D-M10, S19-M6); constantes em arquivo sem dependência (S19-M7); varredura com chave `read` e com as oito exceções (S19-M3); runbook da forja (S19-M5, S19-M8); pendência da E17 (S19-M4).

## O que é do DONO

1. **A decisão ao fim dos 7 dias medidos, vendo a lista** (Tarefa 8). O agente entrega a lista (chave, rota, método, vezes) e o veredito da janela. Pela resposta à pergunta 43 ("se uma chave que não tem permissão estiver lendo temos que aumentar a restrição"), o padrão já está dado: **a recusa sobe e nenhuma chave ganha permissão**. O que sobra para o dono é só o caso em que a lista traz a chave `forja (fila)` lendo alguma rota de leitura: (a) a rota passa a aceitar `intelligence` (código, o agente faz), ou (b) a forja passa a usar a chave `forja (so leitura)` para aquela leitura (mudança na forja, do dono). Pela leitura do kit instalado na forja (abaixo), o esperado é **lista vazia** e nenhuma decisão.
2. **Nenhuma chave é criada, revogada nem alterada.** A resposta à pergunta 47 (chave da irmã só quando ela for acessar) não muda nada aqui: a E19 não cria chave.
3. **Se o dono quiser avisar o Cowork** de que leitura passa a exigir `read`: é editar `apps/web/data/pipeline-docs/` ou `docs/cowork-*`, e o pre-commit semeia em produção. **Este plano não toca nesses arquivos nem em `api-registry.ts`.** Não é necessário: a chave do Cowork tem `{read, write, admin}` e nada muda para ela. *(emenda do portão: S19-M5)* Um texto desses arquivos está errado desde antes e também é seu: `apps/web/data/pipeline-docs/cowork-docs-youtube.md:161` diz que a chave da fila é `{read,intelligence}`; em produção ela é `{intelligence}`.
4. **Olhar a forja, só se a conferência do dia da recusa acusar** (Tarefa 10). O agente lê por `ssh forja '<leitura>'`; qualquer escrita lá é do dono.
5. *(emenda do portão: CTRL-a, S19-I6)* **A leitura de controle é sua, e é opcional.** Um dia só conta como "medido" se alguma chave com `read` leu uma rota de leitura do pipeline naquele dia. O Cowork pelo MCP não conta (não passa por `authenticateRead`). **Ninguém faz essa leitura por você:** o agente não usa a sua chave. Dia sem ela é "não medido" e a janela espera; nada quebra. Se quiser medir um dia, são dois comandos, um por linha (o segundo não imprime a chave; a resposta esperada é `200`):

```bash
cd ~/Workspace/bythiagofigueiredo
curl -s -o /dev/null -w "%{http_code}\n" -H "X-Pipeline-Key: $(grep '^PIPELINE_COWORK_KEY=' apps/web/.env.local | cut -d= -f2- | tr -d '"')" https://bythiagofigueiredo.com/api/pipeline/stats
```

   O dia que mais importa é a **segunda-feira** (a tarefa semanal da fila roda às 08:10 UTC): sem uma segunda medida a janela não fecha.
6. *(emenda do portão: CTRL-b, S19-I4)* **No dia em que a recusa sobe, estar avisado pelas 2 horas seguintes.** Sem sessão aberta do agente e sem você avisado, a recusa não é promovida. Se algo legítimo for cortado, o agente reverte o commit, envia e promove (roteiro na Tarefa 10, Step 4; cerca de 20 a 30 minutos). **Você tem um caminho mais rápido, se quiser:** no painel da Vercel, projeto do site, aba Deployments, o deploy de produção anterior, "Instant Rollback" (segundos, sem build). Avisos: ele **não desfaz o commit** (o `main` continua com a recusa, e o próximo deploy de `main` a religa), então o revert do agente vem em seguida do mesmo jeito; e, pelo comportamento documentado da Vercel, depois de um rollback a produção deixa de acompanhar o `main` sozinha até você promover um deploy de novo (confira no painel). O agente não faz o rollback: é seu.

## Perguntas que sobram

Nenhuma trava o lote 1. Quatro decisões do plano que o portão ou o dono podem vetar (os dois revisores as aceitaram), e uma consequência da decisão sobre o `curl`:

1. **A regra própria do perfil `observatorio_leitura` entra agora** (Tarefa 2), e não só no degrau 2 da E17 como diz 8.1.4. Motivo: o item 209 é aceite da E19 e pede a prova com o commit 2 revertido; a regra tem 3 linhas, é só mais restrição, e nenhuma chave tem essa permissão hoje (medido: 0). *(emenda do portão: S19-M4)* Ela vale em `/api/pipeline/*`; `/api/mcp` tem autenticador próprio e é do item 235 da E17.
2. **Fechar a janela é um ato registrado, não um cálculo a cada requisição.** O spec diz que as linhas de controle "param quando a janela fecha". O plano não consulta o estado da janela em toda leitura (seriam até 15 consultas por instância, com cache, e mais um jeito de falhar calado). A janela é fechada pelo veredito da função testada (Tarefa 6), anotado no ledger, e vira código: ou o commit 2 (caminho normal, no mesmo dia), ou uma linha (`controleFechadoEm`). Se ninguém fechar, o teto por data vale sozinho: do 15º dia em diante, uma linha por chave, rota e dia.
3. **Teto diário em vez de "1 em cada 20".** Não há como contar as leituras de um dia **antes** de ligar (nenhuma tabela registra requisição do pipeline; `last_used_at` é um instante só; o log da Vercel não dura). O plano troca a amostragem por um teto conferido no banco: passadas 5.000 linhas no dia, o registro cai para uma linha por chave, rota e dia. O dia continua "medido" e o volume fica limitado sem depender de uma contagem prévia.
4. **Uma segunda tela seria poluída, além da que o revisor achou:** `/admin/audit` lista `audit_log` inteiro para o super admin, sem filtrar `site_id`. A Tarefa 5 tira as duas ações da listagem padrão (continuam visíveis filtrando pela ação).
5. *(emenda do portão: CTRL-a)* **Sem o `curl`, a janela pode demorar.** Os dias medidos passam a depender de o Cowork ler pela API REST (e não pelo MCP) ou de o dono rodar o comando do item 5 acima, e um deles tem de cair numa segunda-feira. Se não acontecer, nada quebra: no 15º dia o registro se reduz sozinho e o dono é avisado; no 30º a escolha vai a ele. É a consequência aceita de o agente não usar a chave do dono.

---

**Goal:** Chave sem `read` deixa de ler o pipeline, depois de 7 dias medidos provarem que nenhuma leitura legítima depende disso, sem derrubar a forja nem o Cowork.

**Architecture:** Um módulo de configuração (`leitura-modo.ts`) diz `aviso` ou `recusa`; trocar essa palavra **é** o commit 2. `authenticateRead` passa por um registrador (`leitura-registro.ts`) que grava em `audit_log`, com `site_id` nulo, uma linha por leitura feita por chave, com controle positivo (`tem_read = true`) e teto de 1,5 s por leitura. A lista e o veredito da janela saem de uma função pura testada, que só fecha a janela com 7 dias medidos e uma execução real da fila da forja entre eles. A prova de que toda rota recusa é uma varredura que importa os 91 `route.ts` e chama os 129 handlers. *(emenda do portão: S19-I2, S19-I5)*

**Tech Stack:** Next.js 16 (route handlers), TypeScript estrito, Supabase (PostgREST, cliente de serviço), Vitest, Sentry.

**Spec:** `docs/superpowers/specs/2026-10-12-observatorio-a5/07-forja-cowork-e-contexto-para-ia.md` seção 8.2 e 8.1.4 (recusa própria do perfil), itens 207 a 210 e 250; `00-indice-decisoes-e-sequencia.md` ordem 7, C0.4, perguntas 43 e 47 (respondidas em 12/10), OP-6, OP-12, OP-16. Decisões: `.superpowers/sdd/a5/decisoes-do-dono.md` itens 43 e 44. Ledger da etapa: `.superpowers/sdd/a5-e19/progress.md` (criar na Tarefa 0).

## Global Constraints

- **Sem migration.** `audit_log` aceita a linha como está (`action` e `resource_type` são os únicos `not null`; sem gatilho sobre ela; três policies, todas de `select`; precedente em `app/api/waitlists/rights/route.ts:94`).
- **Nenhum agente cria, revoga nem altera chave ou permissão de chave.** `PIPELINE_COWORK_KEY` é permanente.
- **Não tocar** em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `apps/web/src/lib/pipeline/api-registry.ts` (o pre-commit semeia em produção). Nenhuma rota é criada nem apagada: `endpoint_count` não muda.
- **Nada de escrita na forja.** `ssh forja '<leitura>'` é permitido.
- Branch `staging`, sem branch nem worktree. **Nunca** `git stash` nem `git reset`. Commit por caminho explícito. **Não fazer push:** o envio é do controlador, separado da A4.
- A linha de registro **nunca** contém a chave nem o hash, nem a query string (pode trazer texto de busca).
- `site_id` da linha é **nulo**; o site vai dentro de `after_data`.
- Falha ao registrar **não derruba a leitura** e vai ao Sentry.
- Nenhum comando nem espera acima de 4 minutos. Suíte: saída para arquivo, só as falhas no contexto.
- TypeScript `strict`, nunca `any`. Testes de servidor com `// @vitest-environment node`. Datas de teste relativas ou com relógio falso.
- **Este sistema falha em verde.** "Nenhuma linha sem `read`" só vale com o controle positivo do mesmo dia.

## Fatos medidos (12/10/2026)

**Produção, só `select`:**

| Fato | Valor |
|---|---|
| Chaves ativas (C0.4, sem hash) | `cowork-permanent` `{read,write,admin}`, último uso 12/10 02:37 UTC; `forja (fila)` `{intelligence}`, último uso 12/10 18:30 UTC (a cada 10 min); `forja (so leitura)` `{read}`, último uso 05/10 12:17 UTC |
| Chaves com `observatorio_leitura` | 0 |
| `audit_log` | 140 linhas desde 07/05; 137 com `site_id` nulo; 200 kB; zero linhas `pipeline_leitura%`; 8 linhas nos últimos 30 dias |
| Tarefas da fila da forja | concluídas em 05/10 e 12/10 às 08:10 UTC: **uma por semana**. "Uma tarefa concluída em 2 horas" não serve de prova (confirma N11) |
| Banco | 171 MB de 500 MB |

**Código (grep e varredura executada em 12/10):** 91 `route.ts` em `app/api/pipeline/`, 129 handlers exportados: 56 chamam `authenticateRead` (55 `GET` e o `POST` de `audio-library/resolve`), 64 `authenticateWrite`, 7 `authenticateIntel`, 1 `authenticateReadOrIntel` (`GET youtube/channels`), 1 `authenticatePipeline` direto (`GET context`). Nenhum handler sem autenticação. O spec diz "57 arquivos": são os 56 mais `context/route.ts`.

**O que a forja de fato chama** (lido em 12/10 em `/opt/agente/docs/trilha/fila_intel.py`, `leituras_obs.py` e `/opt/agente/docs/sitio.py`, por `ssh forja` só de leitura; o cron é `*/10 … fila_intel.py --cron`):

| Chamada | Chave | Helper da rota | Muda com a E19? |
|---|---|---|---|
| `POST youtube/intelligence/task/claim`, `POST …/task/:id/fail` | fila | `authenticateIntel` | não |
| `GET` e `PATCH youtube/intelligence` | fila | `authenticateIntel` | não |
| `GET` e `POST youtube/competitors/readings` | fila | `authenticateIntel` | não |
| `GET youtube/channels` | fila | `authenticateReadOrIntel` | não |
| as 13 rotas de leitura da fase 1 do proxy (`stats`, `up-next`, `analytics/*`, `search`, `items/*`, `research/focos/active`, `competitors/insights`, `ab-tests/learnings`, `links`) | `SITIO_CHAVE` = a `{read}` | `authenticateRead` | não: tem `read` |

Conclusão: **nenhuma chamada do worker da fila passa por `authenticateRead`.** A lista da fase 2 do `sitio.py` *permite* à fila as rotas da fase 1, mas o `fila_intel.py` instalado não as chama. A medição existe para provar isso em produção, não para descobrir.

## Volume e duração máxima do modo aviso (OP-6, OP-12)

- **Linha:** cerca de 0,5 kB com os quatro índices (a conta do revisor de dados). Nada apaga `audit_log`: as linhas ficam, e por isso não entram na lista do que apaga (9.2).
- **Esperado:** dezenas a poucas centenas de linhas por dia (o Cowork lê em sessões do dono; a chave de leitura da forja está parada desde 05/10; a da fila não lê). Menos de 0,1 MB por dia.
- **Teto, por construção:** 5.000 linhas cheias por dia, mais o estouro do cache de 5 minutos (até 100 por minuto por chave: no pior caso cerca de 1.500), ou seja, **no máximo cerca de 3,3 MB por dia**; 14 dias no teto dão 46 MB. Do 15º dia em diante: uma linha por chave, rota, método e dia, no máximo cerca de 175 por dia (87 kB).
- *(emenda do portão: S19-R3)* **Esses tetos valem por instância da função.** O limite de 100 pedidos por minuto por chave é em memória, e a contagem do teto fica em cache 5 minutos em cada instância: com N instâncias no ar, o estouro é N vezes os cerca de 1.500. No modo reduzido, duas instâncias podem gravar a mesma linha (conferem e depois gravam, sem índice único): aceito, são três chaves do dono, e a duplicata só aumenta `vezes` em 1.
- *(emenda do portão: D-I4, S19-M2)* **Modo recusa:** nas 48 horas da conferência (`conferenciaAte`), toda recusa e toda leitura aceita gravam linha cheia, com o mesmo teto diário. **Passada a conferência, a recusa é sempre reduzida:** uma linha por chave, rota, método e dia (no máximo cerca de 175 por dia, 87 kB, ou 32 MB por ano no pior caso; o esperado é zero). Sem isso uma chave sem `read` em laço gravaria até 6.500 linhas por dia para sempre (cerca de 100 MB por mês), numa tabela que nada limpa. O item 210 só lê as recusas dentro das 48 horas.
- **Dia 0 é a contagem que o spec pedia antes de ligar:** a conferência de D+1 lê quantas linhas cada chave gerou.
- **Duração:** janela fecha com 7 dias medidos, um deles com tarefa da forja concluída *(emenda do portão: S19-I2)*; no 15º dia corrido sem fechar, modo reduzido sozinho, uma mensagem por dia no Sentry e aviso ao dono pelo controlador (a data está em `lib/conferencias.ts` e em `.superpowers/sdd/a5/conferencias-com-data.md`: não depende de alguém lembrar, S19-I3); **no 30º dia (12/11/2026, se o lote 1 subir em 13/10)** o controlador leva ao dono a escolha: subir a recusa ou congelar o controle (`controleFechadoEm`). Nunca silêncio.
- **Custo por leitura:** uma escrita a mais (10 a 30 ms) e uma contagem a cada 5 minutos por instância. Só para leitura por chave; sessão do CMS não paga nada. *(emenda do portão: S19-I5)* **Teto: 1,5 s para o registro inteiro** (contagem, conferência de duplicata e gravação somadas). Banco que aceita a conexão e não responde atrasa a leitura no máximo isso; o estouro conta como falha de gravação.

## O que acontece quando o dado não existe, e em cada falha

| Situação | O que acontece | Como o dono vê |
|---|---|---|
| Dia sem nenhuma linha de controle (ninguém leu com `read`, ou o registro está mudo) | o dia é "não medido"; a janela não fecha | o veredito diz "N dias medidos de 7: a recusa não sobe" e lista o dia |
| O Cowork só usa o MCP no dia, ou ninguém lê *(emenda do portão: CTRL-a)* | `/api/mcp` não passa por `authenticateRead`: nenhuma linha | dia "não medido"; a janela espera. **Ninguém roda `curl` por padrão**; o dono pode, se quiser ("O que é do DONO", item 5) |
| 7 dias medidos e nenhum com tarefa da forja concluída *(emenda do portão: S19-I2)* | a janela não fecha | veredito "N dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe" |
| A consulta do veredito não traz a coluna `tarefas_forja` (consulta antiga) | conta como zero tarefas | a janela não fecha: dado ausente não é "teve tarefa" |
| O dia bateu no teto de 5.000 linhas *(emenda do portão: D-M10)* | o registro cai para uma linha por chave, rota e dia; `vezes` daquele dia fica cortado | uma mensagem no Sentry no dia; o veredito marca o dia com "contagem cortada pelo teto". A presença de `tem_read = false` é preservada |
| O banco aceita a conexão e não responde *(emenda do portão: S19-I5)* | o registro desiste em 1,5 s; a leitura segue | Sentry (`tipo: gravacao`); o dia vira "não medido" |
| A gravação falha | a leitura passa; o erro vai ao Sentry, uma captura por instância por hora (`action:leitura_registro tipo:gravacao`) *(emenda do portão: S19-M1)* | o dia entra na lista de dias com falha e vira "não medido"; o script do veredito não roda sem a lista (`--falhas=`) |
| A contagem do teto falha | o registro segue cheio (prefere medir) | Sentry |
| A conferência de duplicata (modo reduzido) falha | grava a linha | Sentry |
| A chave não tem `name` | `key_name` nulo; `key_id` identifica | a lista mostra o id |
| Leitura por sessão do CMS | não grava | nada; é o esperado |
| Lista vazia de `tem_read = false` com 7 dias medidos | "ninguém lê sem `read`" | veredito "a recusa pode subir" |
| Lista vazia **sem** 7 dias medidos | nada se conclui | veredito "a recusa não sobe" |
| Depois da recusa: zero linhas `pipeline_leitura_recusada` | só vale com linha de controle **depois** do deploy | a conferência da Tarefa 10 exige as duas |
| Depois da recusa: uma chave legítima é recusada | 403 para ela; a forja marca `desfecho: chave` e o check dela fica vermelho | linha `pipeline_leitura_recusada` com a chave e a rota; reverte-se o commit 2 no mesmo dia |
| Fila da forja vazia nas 2 horas | não é defeito | prova por `last_used_at` e por zero recusas |
| Chave com `observatorio_leitura` (não existe hoje) | 403 em todo `/api/pipeline/*`, em qualquer modo | teste de varredura |

## Simulação: do lote 1 ao plano de volta

| Dia | Quem | O quê |
|---|---|---|
| D−1 | agente | Tarefa 0: ledger com a lista de chaves (item 207) e as respostas da OP-6 |
| D0 (previsto 13/10) | agente, controlador | Tarefas 1 a 7 = **"commit 1" do spec (lote 1, modo aviso)**; envio separado da A4; CI verde; promoção a `main`. `avisoDesde` = o dia de São Paulo do envio |
| D0 + 10 min *(emenda do portão: CTRL-a)* | controlador | olhar se já há linha (Tarefa 8, Step 1). **Não há `curl` do agente.** Sem linha: o registro ainda não foi provado em produção e o dia está "não medido" (a prova de que a gravação funciona é o teste de integração da Tarefa 5). Com linha de alguma chave: conferir os campos. Linha que deveria existir e não existe (o dono rodou o `curl` e nada apareceu): registro mudo, **parar e consertar** |
| D+1 | controlador | contagem do dia 0 por chave; conferir o painel do CMS e `/admin/audit` sem linhas novas |
| D+1 em diante *(emenda do portão: CTRL-a)* | ninguém, por padrão | dia em que uma chave com `read` leu pela API é medido; os outros ficam "não medido" e a janela espera. O dono pode rodar o `curl` dele |
| D+8 no mínimo (21/10 se todo dia foi medido, e a segunda 19/10 entre eles) | agente | Tarefa 8: lista e veredito no ledger. Janela fechada (7 dias medidos e um com tarefa da forja) e zero `tem_read = false` → segue. Alguma linha `tem_read = false` → decisão por linha (a rota aceita `intelligence`, ou a forja troca de chave), e a recusa só sobe depois |
| mesmo dia, **ou o primeiro em que houver sessão aberta e o dono avisado por 2 horas** *(emenda do portão: CTRL-b)* | agente, controlador | Tarefa 9 = **"commit 2" do spec**: um commit só, que troca `aviso` por `recusa` e liga o controle por 48 horas. Roteiro da volta no ledger; envio; CI; promoção **só deste commit** |
| + 20 min | controlador, dono avisado | Tarefa 10: `last_used_at` da fila avançou; log da forja sem `desfecho: chave`; zero `pipeline_leitura_recusada`. A linha de controle **depois** do deploy vem de uma leitura do dono (o `curl` dele) ou do Cowork; sem ela, "zero recusas" não prova que o registro está vivo, e a conferência se apoia nos dois primeiros sinais, que não dependem do registro *(emenda do portão: CTRL-a)* |
| + 2 h | controlador | repetir. Qualquer recusa para `forja (fila)`, `forja (so leitura)` ou `cowork-permanent`, ou `last_used_at` da fila parado por 2 horas com a forja de pé: **reverter o commit 2 no mesmo dia** |
| + 48 h | — | o controle para sozinho (`conferenciaAte`) |
| D+15 (27/10) | controlador | se o commit 2 não subiu: modo reduzido já vale; avisar o dono |
| D+30 (12/11) | controlador | se ainda aberto: levar a escolha ao dono |

## Interruptor e plano de volta

- **Não há interruptor novo.** A recusa é uma constante em `leitura-modo.ts`; desligar é `git revert <commit 2>`, envio e promoção (o modo aviso volta a medir). Nenhuma chave e nada na forja são tocados.
- *(emenda do portão: CTRL-b, S19-I4)* **A volta tem roteiro, e ele é escrito antes de a recusa subir.** Caminho do agente: reverter o commit 2 por cima de `origin/staging`, enviar, esperar o CI, promover (Tarefa 10, Step 4, com os comandos; tempo esperado de 20 a 30 minutos, dos quais o CI é a maior parte: o tempo real do CI é anotado no envio do lote 1, Tarefa 7). **Precondição da promoção do commit 2:** sessão do agente aberta e dono avisado pelas 2 horas seguintes; sem isso não se promove. Caminho do dono, mais rápido e opcional: "Instant Rollback" na Vercel ("O que é do DONO", item 6); não desfaz o commit, e o revert vem em seguida do mesmo jeito. Para o rollback do dono significar exatamente "voltar ao modo aviso", **o commit 2 é promovido sozinho**: o deploy anterior de produção é o lote 1 e mais nada.
- **Reverter o commit 2 não reabre nada para o perfil `observatorio_leitura`:** a regra dele mora em `authenticatePipeline` (Tarefa 2), fora do commit 2. A varredura prova com o modo `aviso`.
- **Volta do lote 1:** reverter os commits das Tarefas 1 a 7. As linhas já gravadas ficam em `audit_log` (ninguém as lê: o painel filtra por site, `/admin/audit` as esconde por padrão).

## Envio (separado da fase A4)

A A4 local está 78 commits à frente de `origin/staging`. `git diff --name-only origin/staging..HEAD -- apps/web/src` em 12/10: 67 arquivos (59 em `app/cms/(authed)`, 8 em `lib/youtube/observatorio`). **Nenhum** é arquivo deste plano: `lib/pipeline/{helpers,auth,leitura-modo,leitura-registro,leitura-janela}.ts`, `app/api/pipeline/context/route.ts`, `app/admin/(authed)/audit/*`, `scripts/e19-janela.ts` e os testes. *(emenda do portão)* Entram na lista: `lib/pipeline/leitura-acoes.ts`, `test/api/pipeline/context-filters.test.ts`, `docs/ops/forja-fila-inteligencia-runbook.md` e, se a Tarefa 6 do plano da E20 já estiver commitada, `lib/conferencias.ts` (conferir de novo que a A4 não toca nenhum). O envio usa o roteiro da E12 (`.superpowers/sdd/a5-e12/progress.md`, "Roteiro do envio separado"). Refazer o `git diff` no dia.

## Review Focus

1. **Registro mudo lido como "ninguém lê":** dia sem linha de controle tem de ser "não medido". Teste na Tarefa 6 (apaga o controle de um dos 7 dias).
2. **Laço de uma chave enchendo `audit_log`:** teto diário e modo reduzido. Testes na Tarefa 1.
3. **Rota nova sem autenticação, ou com helper trocado:** a varredura quebra. Tarefa 4.
4. **Lote 1 indo a produção já em `recusa` por descuido:** teste que prende o valor publicado. Tarefas 1 e 9.
5. **Teste de rota existente que conta chamadas ao banco:** o registro acrescenta chamadas. O conserto é simular `leitura-registro` naquele teste, nunca afrouxar o registro. Tarefa 3.
6. *(emenda do portão)* **Janela que fecha sem a fila ter rodado:** teste na Tarefa 6 (sete dias medidos sem a segunda-feira). **Recusa em laço enchendo `audit_log` depois das 48 horas:** teste na Tarefa 1 (50 recusas, uma linha). **Banco que não responde segurando a leitura:** teste na Tarefa 1 (1,5 s).

## Riscos aceitos (emenda do portão)

- *(S19-R2)* **O dia do deploy do lote 1 conta como medido mesmo sendo parcial**, se houver linha de controle nele. Não mudei: a janela já exige 7 dias medidos e um deles com tarefa da forja; tirar o dia 1 só empurra o veredito um dia.
- *(S19-R1)* **A janela mede o kit instalado na forja naquele período.** Kit novo instalado depois do veredito não foi medido: reconferir o kit é precondição da Tarefa 9.
- *(S19-M6)* A recusa do perfil `observatorio_leitura` sai com `code: 'UNAUTHORIZED'` e status 403, porque os helpers embrulham assim todo erro de `authenticatePipeline`. Cosmético; mudar trocaria o contrato de erro das 129 rotas.
- *(S19-M3)* 28 handlers validam o UUID antes de autenticar e devolvem 400 a um id malformado, sem dado nenhum. A varredura usa UUID válido e não os acusa. Não é brecha.
- *(CTRL-a)* Sem leitura com `read` num dia, o dia não é medido; sem uma segunda-feira medida, a janela não fecha. O 15º e o 30º dia têm data e dono.

---

### Task 0: ledger, C0.4 e OP-6 (sem código)

**Files:** Create: `.superpowers/sdd/a5-e19/progress.md`

- [ ] **Step 1:** Gravar no ledger: a tabela de chaves da seção "Fatos medidos" (nome, permissões, criação, último uso; **sem hash**), quem rodou (o controlador, em 12/10, por `npx supabase db query --linked`), e a autorização do dono (decisões 43 e 44 de `.superpowers/sdd/a5/decisoes-do-dono.md`, que citam o resultado). Frase final: "nenhuma chave foi criada, revogada ou alterada por agente".
- [ ] **Step 2:** Reconferir no dia (as chaves podem ter mudado): `npx supabase db query --linked "select name, permissions, created_at::date as criada, last_used_at from pipeline_api_keys where revoked_at is null order by name"` e `npx supabase db query --linked "select count(*) from pipeline_api_keys where 'observatorio_leitura' = any(permissions)"`. Se aparecer chave nova, ou a segunda não for 0: parar e levar ao controlador.
- [ ] **Step 3:** Gravar as respostas da OP-6: DDL e gatilhos de `audit_log` lidos (`supabase/migrations/20260507000001_schema.sql:721-734`, índices 5356-5366, policies 6228-6238; sem gatilho sobre a tabela); leituras por dia **não contáveis antes do lote 1** (motivo na pergunta 3 do topo); a contagem é a de D+1.

- [ ] **Step 4** *(emenda do portão: S19-M4)*: Gravar no ledger, como pendência da **E17 (item 235)**: "a recusa própria do perfil `observatorio_leitura` (Tarefa 2 da E19) mora em `authenticatePipeline` e vale em `/api/pipeline/*`. `/api/mcp` usa `resolveMcpAuth` (`lib/pipeline/mcp/auth.ts`): uma chave com `observatorio_leitura` **e** `read` passaria no servidor MCP geral. Hoje não existe chave com esse perfil (medido: 0). A E17 fecha isso antes de criar a primeira." E copiar para o ledger as linhas da E19 de `.superpowers/sdd/a5/conferencias-com-data.md`.

**Critério de pronto:** o ledger tem os quatro blocos (item 207, e a pendência da E17).

---

### Task 1: modo, registrador e teto

**Files:**
- Create: `apps/web/src/lib/pipeline/leitura-modo.ts`
- Create: `apps/web/src/lib/pipeline/leitura-acoes.ts` *(emenda do portão: S19-M7)*
- Create: `apps/web/src/lib/pipeline/leitura-registro.ts`
- Test: `apps/web/test/lib/pipeline/leitura-registro.test.ts`

**Interfaces:**
- Produces:
  - `interface ConfigLeitura { modo: 'aviso' | 'recusa'; avisoDesde: string; controleFechadoEm: string | null; conferenciaAte: string | null }` e `modoLeitura(): ConfigLeitura`
  - `ACAO_AVISO = 'pipeline_leitura_aviso'`, `ACAO_RECUSA = 'pipeline_leitura_recusada'`, `ACOES_DE_LEITURA`, `RECURSO_CHAVE = 'pipeline_api_key'` (moram em `leitura-acoes.ts`, que não importa nada; `leitura-registro.ts` as reexporta), `TETO_LINHAS_DIA = 5000`, `DIAS_CORRIDOS_CHEIOS = 14`, `TETO_REGISTRO_MS = 1500` *(emenda do portão: S19-M7, S19-I5)*
  - `rotaNormalizada(pathname: string): string`, `diaSP(d: Date): string`, `inicioDoDiaSP(dia: string): string`, `diasCorridos(desde: string, hoje: string): number`
  - `registrarLeitura(req: NextRequest, auth: PipelineAuth, desfecho: 'aviso' | 'recusada'): Promise<void>` (nunca lança; nunca passa de `TETO_REGISTRO_MS`)
  - `zerarEstadoDoRegistro(): void` (só para teste)
- Consumes: `PipelineAuth.keyId`, `PipelineAuth.keyName?: string | null` (o campo `keyName` é criado na Tarefa 2; aqui o código já o lê como opcional, então declare-o em `auth.ts` neste commit: uma linha na interface).

- [ ] **Step 1: Teste que falha.** Criar `apps/web/test/lib/pipeline/leitura-registro.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'

type Linha = { action: string; resource_type: string; site_id: string | null; after_data: Record<string, unknown>; created_at: string }
const banco = vi.hoisted(() => ({
  linhas: [] as Linha[],
  erroInsert: null as { code: string; message: string } | null,
  erroSelect: null as { code: string; message: string } | null,
  selects: 0,
  /** (emenda do portão: S19-I5) true = o banco aceita o pedido e nunca responde. */
  pendura: false,
  sinais: [] as AbortSignal[],
}))
const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (tabela: string) => {
      if (tabela !== 'audit_log') throw new Error(`tabela inesperada: ${tabela}`)
      const filtros: Array<(l: Linha) => boolean> = []
      const consulta = {
        is: (c: 'site_id', v: null) => { filtros.push(l => l[c] === v); return consulta },
        in: (c: 'action', vs: string[]) => { filtros.push(l => vs.includes(l[c])); return consulta },
        gte: (c: 'created_at', v: string) => { filtros.push(l => l[c] >= v); return consulta },
        eq: (c: string, v: unknown) => {
          const campo = c.startsWith('after_data->>') ? c.slice('after_data->>'.length) : null
          filtros.push(l => (campo ? String(l.after_data[campo]) === String(v) : (l as unknown as Record<string, unknown>)[c] === v))
          return consulta
        },
        abortSignal: (s: AbortSignal) => { banco.sinais.push(s); return consulta },
        then: (ok: (r: { count: number | null; error: typeof banco.erroSelect }) => unknown) => {
          banco.selects++
          if (banco.pendura) return new Promise<never>(() => {})
          return Promise.resolve(banco.erroSelect ? { count: null, error: banco.erroSelect } : { count: banco.linhas.filter(l => filtros.every(f => f(l))).length, error: null }).then(ok)
        },
      }
      return {
        select: () => consulta,
        // (emenda do portão: S19-I5) a escrita devolve um construtor com abortSignal, como o cliente de verdade.
        insert: (l: Omit<Linha, 'created_at'>) => {
          const feito = async (): Promise<{ error: typeof banco.erroInsert }> => {
            if (banco.erroInsert) return { error: banco.erroInsert }
            banco.linhas.push({ ...l, created_at: new Date().toISOString() })
            return { error: null }
          }
          const escrita = {
            abortSignal: (s: AbortSignal) => { banco.sinais.push(s); return escrita },
            then: (ok: (r: { error: typeof banco.erroInsert }) => unknown, falha?: (e: unknown) => unknown) =>
              (banco.pendura ? new Promise<never>(() => {}) : feito()).then(ok, falha),
          }
          return escrita
        },
      }
    },
  }),
}))

import { registrarLeitura, rotaNormalizada, diaSP, diasCorridos, zerarEstadoDoRegistro, ACAO_AVISO, ACAO_RECUSA, TETO_LINHAS_DIA, TETO_REGISTRO_MS } from '@/lib/pipeline/leitura-registro'
import type { PipelineAuth } from '@/lib/pipeline/auth'

const AGORA = new Date('2026-10-14T15:00:00.000Z')   // 12:00 em São Paulo, 2º dia corrido
const ID = '11111111-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const pedido = (caminho = `/api/pipeline/items/${ID}`, metodo = 'GET') => new NextRequest(`https://x.test${caminho}?q=texto-secreto`, { method: metodo, headers: { 'X-Pipeline-Key': 'forja_SEGREDO' } })
const chave = (permissions: string[], extra: Partial<PipelineAuth> = {}): PipelineAuth => ({ siteId: 'site-1', permissions, source: 'api_key', keyHash: HASH, keyId: 'key-1', keyName: 'forja (fila)', ...extra })

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.clearAllMocks()
  banco.linhas.length = 0
  banco.erroInsert = null
  banco.erroSelect = null
  banco.selects = 0
  banco.pendura = false
  banco.sinais.length = 0
  Object.assign(cfg, { modo: 'aviso', avisoDesde: '2026-10-13', controleFechadoEm: null, conferenciaAte: null })
  zerarEstadoDoRegistro()
})
afterEach(() => vi.useRealTimers())

describe('rotaNormalizada, diaSP, diasCorridos', () => {
  it('troca uuid e número por marcador e nunca traz a query string', () => {
    expect(rotaNormalizada(`/api/pipeline/items/${ID}/sections/roteiro`)).toBe('/api/pipeline/items/:id/sections/roteiro')
    expect(rotaNormalizada('/api/pipeline/topics/42')).toBe('/api/pipeline/topics/:n')
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    expect(diaSP(new Date('2026-10-14T02:59:00Z'))).toBe('2026-10-13')
    expect(diaSP(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14')
  })
  it('o dia do deploy é o dia 1', () => {
    expect(diasCorridos('2026-10-13', '2026-10-13')).toBe(1)
    expect(diasCorridos('2026-10-13', '2026-10-27')).toBe(15)
  })
})

describe('registrarLeitura, modo aviso', () => {
  it('chave só com intelligence grava tem_read = false, com id, nome, rota e método, site_id nulo e o site em after_data', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]).toMatchObject({
      action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null,
      after_data: { site_id: 'site-1', key_id: 'key-1', key_name: 'forja (fila)', rota: '/api/pipeline/items/:id', metodo: 'GET', tem_read: false },
    })
  })
  it('controle positivo: chave com read grava a mesma linha com tem_read = true; write e admin também contam como read', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['write']), 'aviso')
    await registrarLeitura(pedido(), chave(['admin']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.tem_read)).toEqual([true, true, true])
  })
  it('a linha não contém a chave, o hash nem a query string', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    const texto = JSON.stringify(banco.linhas)
    expect(texto).not.toContain('forja_SEGREDO')
    expect(texto).not.toContain(HASH)
    expect(texto).not.toContain('texto-secreto')
  })
  it('sessão de usuário não grava', async () => {
    await registrarLeitura(pedido(), { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' }, 'aviso')
    expect(banco.linhas).toHaveLength(0)
  })
  it('gravação que falha não lança e vai ao Sentry', async () => {
    banco.erroInsert = { code: '08006', message: 'conexão caiu' }
    await expect(registrarLeitura(pedido(), chave(['read']), 'aviso')).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
  it('chave sem nome: key_name nulo, a linha é gravada', async () => {
    await registrarLeitura(pedido(), chave(['read'], { keyName: undefined }), 'aviso')
    expect(banco.linhas[0]!.after_data.key_name).toBeNull()
  })
})

describe('registrarLeitura: o registro tem fim e tem teto', () => {
  it('janela fechada: leitura com read não grava; leitura sem read continua gravando', async () => {
    cfg.controleFechadoEm = '2026-10-21'
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.tem_read)).toEqual([false])
  })
  it('15º dia corrido sem fechar: duas leituras da mesma chave na mesma rota no mesmo dia gravam uma linha só', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.rota)).toEqual(['/api/pipeline/items/:id', '/api/pipeline/stats'])
  })
  it('15º dia, outra instância (memória zerada): a linha de hoje no banco impede a segunda', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    zerarEstadoDoRegistro()
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
  })
  it('14º dia ainda grava cheio', async () => {
    vi.setSystemTime(new Date('2026-10-26T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(2)
  })
  it('teto do dia: com 5.000 linhas hoje, passa a uma por chave, rota e dia (para as duas espécies)', async () => {
    const hoje = new Date().toISOString()
    for (let i = 0; i < TETO_LINHAS_DIA; i++) banco.linhas.push({ action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null, after_data: { key_id: 'outra', rota: '/x', metodo: 'GET', tem_read: true }, created_at: hoje })
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas).toHaveLength(TETO_LINHAS_DIA + 1)
  })
  it('a contagem do teto é lida uma vez a cada 5 minutos por instância, não a cada leitura', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.selects).toBe(1)
  })
  it('contagem do teto que falha: o registro segue cheio (prefere medir) e o erro vai ao Sentry', async () => {
    banco.erroSelect = { code: '57014', message: 'timeout' }
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe('registrarLeitura, modo recusa', () => {
  beforeEach(() => { cfg.modo = 'recusa' })
  it('recusa grava pipeline_leitura_recusada com os mesmos campos', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas[0]).toMatchObject({ action: ACAO_RECUSA, site_id: null, after_data: { key_id: 'key-1', rota: '/api/pipeline/items/:id', tem_read: false } })
  })
  it('leitura aceita grava o controle só até conferenciaAte (as 48 horas da conferência), e nesse período grava todas', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-30T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(0)
    cfg.conferenciaAte = '2026-11-01T00:00:00.000Z'   // dentro da conferência, mesmo passado o 15º dia: sem modo reduzido
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(2)
  })
  it('sem conferenciaAte, leitura aceita não grava nada', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(0)
  })

  // (emenda do portão: D-I4, S19-M2) O modo recusa também tem teto no tempo.
  it('dentro das 48 horas da conferência a recusa grava todas (é o que o item 210 lê)', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-22T15:00:00.000Z'))
    for (let i = 0; i < 3; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(3)
  })
  it('passada a conferência, a recusa é sempre reduzida: 50 recusas da mesma chave na mesma rota, dois dias depois, gravam UMA linha', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'))
    for (let i = 0; i < 50; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(2)   // outra rota: outra linha
    vi.setSystemTime(new Date('2026-10-26T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(3)   // outro dia: outra linha
  })
  it('passada a conferência, outra instância (memória zerada) não grava a segunda linha do dia', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    zerarEstadoDoRegistro()
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
  })
  it('modo recusa sem conferenciaAte (não deveria ser publicado): reduzido, nunca cheio', async () => {
    for (let i = 0; i < 10; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
  })
})

// (emenda do portão: S19-I5, S19-M1, D-M10)
describe('registrarLeitura: teto de tempo, e o Sentry sem enxurrada', () => {
  it('banco que aceita a conexão e não responde: o registro desiste em 1,5 s, a leitura segue, e a falha vai ao Sentry como gravação', async () => {
    vi.useFakeTimers({ now: AGORA })   // neste teste o relógio de setTimeout também é falso
    banco.pendura = true
    let terminou = false
    const p = registrarLeitura(pedido(), chave(['read']), 'aviso').then(() => { terminou = true })
    await vi.advanceTimersByTimeAsync(TETO_REGISTRO_MS - 1)
    expect(terminou).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(terminou).toBe(true)
    expect(banco.linhas).toHaveLength(0)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureException).mock.calls[0]![1]).toMatchObject({ tags: { action: 'leitura_registro', tipo: 'gravacao' } })
    expect(banco.sinais.length).toBeGreaterThan(0)
    expect(banco.sinais.every(s => s.aborted)).toBe(true)
  })
  it('gravação recusada de forma sistemática: uma captura por hora por instância, não uma por leitura', async () => {
    banco.erroInsert = { code: '42501', message: 'recusado' }
    for (let i = 0; i < 5; i++) await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 61 * 60_000))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
  })
  it('falha de contagem e falha de gravação têm tipos diferentes: uma não cala a outra', async () => {
    banco.erroSelect = { code: '57014', message: 'timeout' }
    banco.erroInsert = { code: '42501', message: 'recusado' }
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(vi.mocked(Sentry.captureException).mock.calls.map(c => (c[1] as { tags: { tipo: string } }).tags.tipo).sort()).toEqual(['contagem', 'gravacao'])
  })
  it('dia que bate no teto: uma mensagem no Sentry, não uma por leitura', async () => {
    const hoje = new Date().toISOString()
    for (let i = 0; i < TETO_LINHAS_DIA; i++) banco.linhas.push({ action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null, after_data: { key_id: 'outra', rota: '/x', metodo: 'GET', tem_read: true }, created_at: hoje })
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')
    const doTeto = vi.mocked(Sentry.captureMessage).mock.calls.filter(c => String(c[0]).includes('teto'))
    expect(doTeto).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/lib/pipeline/leitura-registro.test.ts > /tmp/e19-t1.log 2>&1; tail -15 /tmp/e19-t1.log`. Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Criar `apps/web/src/lib/pipeline/leitura-modo.ts`.**

```ts
// E19 (A5, spec 07 §8.2). Trocar `modo` de 'aviso' para 'recusa' É o commit 2 da etapa; reverter esse commit volta a medir.
// Não é variável de ambiente de propósito: o valor publicado é o que está no git, e um teste o prende.
export interface ConfigLeitura {
  /** 'aviso': chave sem `read` lê e a leitura é registrada. 'recusa': recebe 403. */
  modo: 'aviso' | 'recusa'
  /** Dia de São Paulo (AAAA-MM-DD) em que o modo aviso foi a produção: é o dia 1 dos 14 dias de registro cheio. */
  avisoDesde: string
  /** Dia de São Paulo em que a janela fechou com 7 dias medidos (ledger). null = aberta. Fechada: leitura com `read` não grava mais. */
  controleFechadoEm: string | null
  /** Só no modo recusa: até este instante (ISO, UTC) toda leitura ACEITA de chave grava a linha de controle. Sem ela, "zero
   *  recusas" não se distingue de "registro mudo" na conferência do dia da promoção. */
  conferenciaAte: string | null
}

const CONFIG: ConfigLeitura = {
  modo: 'aviso',
  avisoDesde: '2026-10-13',
  controleFechadoEm: null,
  conferenciaAte: null,
}

export function modoLeitura(): ConfigLeitura {
  return CONFIG
}
```

- [ ] **Step 3b** *(emenda do portão: S19-M7)*: **Criar `apps/web/src/lib/pipeline/leitura-acoes.ts`** (nenhum import; é o que `admin/(authed)/audit/filtros.ts` importa na Tarefa 5). Não pode morar em `leitura-modo.ts`: quatro testes deste plano simulam esse módulo só com `modoLeitura`, e importar dele uma constante quebraria o import.

```ts
// E19: as ações que o registro de leitura do pipeline grava em audit_log. Sem dependência nenhuma, de propósito.
export const ACAO_AVISO = 'pipeline_leitura_aviso'
export const ACAO_RECUSA = 'pipeline_leitura_recusada'
export const ACOES_DE_LEITURA: readonly string[] = [ACAO_AVISO, ACAO_RECUSA]
export const RECURSO_CHAVE = 'pipeline_api_key'
```

- [ ] **Step 4: Criar `apps/web/src/lib/pipeline/leitura-registro.ts`.** *(emenda do portão: S19-I5, D-I4, S19-M1, D-M10: o registro passou a ter teto de tempo, o modo recusa passou a ter redução, e as capturas do Sentry passaram a ter tipo e limite. A função `registrarLeitura` de antes virou `registrarLeitura` (o teto) mais `gravar` (o corpo, com três mudanças marcadas).)*

```ts
// E19: registro das leituras do pipeline feitas por chave. Vai para audit_log (dura os 7 dias; o log da Vercel não dura).
// site_id NULO de propósito: com o site da chave, o feed de atividade do painel (fetchActivityFeed) mostraria estas linhas.
import * as Sentry from '@sentry/nextjs'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requirePermission, type PipelineAuth } from './auth'
import { modoLeitura } from './leitura-modo'

// (emenda do portão: S19-M7) As quatro constantes moram em leitura-acoes.ts, que não importa nada: a tela de /admin/audit
// as usa sem carregar o Sentry nem o cliente de serviço.
import { ACAO_AVISO, ACAO_RECUSA, ACOES_DE_LEITURA, RECURSO_CHAVE } from './leitura-acoes'
export { ACAO_AVISO, ACAO_RECUSA, ACOES_DE_LEITURA, RECURSO_CHAVE }
/** Passado isto no dia (as duas ações somadas), o registro cai para uma linha por chave, rota, método e dia. */
export const TETO_LINHAS_DIA = 5000
/** Do dia seguinte a este em diante, sem a janela fechar, vale o modo reduzido. */
export const DIAS_CORRIDOS_CHEIOS = 14
const TTL_CONTAGEM_MS = 5 * 60_000

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Caminho sem query string (pode trazer texto de busca), com ids trocados por marcador para a lista agrupar por rota. */
export function rotaNormalizada(pathname: string): string {
  return pathname.replace(UUID, ':id').replace(/\/\d+(?=\/|$)/g, '/:n').slice(0, 200)
}

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export function diaSP(d: Date): string {
  return FMT_SP.format(d)
}
/** São Paulo é UTC−3 o ano todo desde 2019 (sem horário de verão): o dia começa às 03:00 UTC. */
export function inicioDoDiaSP(dia: string): string {
  return `${dia}T03:00:00.000Z`
}
/** O dia `desde` é o dia 1. */
export function diasCorridos(desde: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1
}

// Estado por instância: só economiza consultas. A regra vale pelo banco.
let contagem: { dia: string; n: number; lidaEm: number } | null = null
let diaDosVistos = ''
const vistos = new Set<string>()
let avisouAtraso = ''
let avisouTeto = ''
const ultimaFalha: { gravacao: number; contagem: number } = { gravacao: 0, contagem: 0 }
export function zerarEstadoDoRegistro(): void {
  contagem = null
  diaDosVistos = ''
  vistos.clear()
  avisouAtraso = ''
  avisouTeto = ''
  ultimaFalha.gravacao = 0
  ultimaFalha.contagem = 0
}

/**
 * (emenda do portão: S19-M1) Uma captura por instância, por hora e por tipo: gravação recusada de forma sistemática não vira
 * um evento por leitura. `tipo: 'gravacao'` é o que marca o dia como "não medido" no fechamento da janela (a linha pode não
 * ter sido gravada); `'contagem'` não marca (a linha foi gravada, só o teto ficou sem número).
 */
function avisarFalha(tipo: 'gravacao' | 'contagem', e: unknown): void {
  const agora = Date.now()
  if (agora - ultimaFalha[tipo] < 3_600_000) return
  ultimaFalha[tipo] = agora
  Sentry.captureException(e, { tags: { component: 'pipeline', action: 'leitura_registro', tipo }, level: 'warning' })
}

type Cliente = ReturnType<typeof getSupabaseServiceClient>

async function linhasDeHoje(supabase: Cliente, hoje: string, agoraMs: number, sinal: AbortSignal): Promise<number> {
  if (contagem && contagem.dia === hoje && agoraMs - contagem.lidaEm < TTL_CONTAGEM_MS) return contagem.n
  const r = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .is('site_id', null)
    .in('action', [...ACOES_DE_LEITURA])
    .gte('created_at', inicioDoDiaSP(hoje))
    .abortSignal(sinal)
  if (r.error || r.count === null) {
    // Contagem indisponível não cala o registro: segue cheio (prefere medir) e avisa.
    avisarFalha('contagem', new Error(`pipeline leitura: contagem do teto indisponível (${r.error?.code ?? 'sem contagem'})`))
    return contagem && contagem.dia === hoje ? contagem.n : 0
  }
  contagem = { dia: hoje, n: r.count, lidaEm: agoraMs }
  return r.count
}

/** (emenda do portão: S19-I5) Teto de tempo do registro INTEIRO: contagem, conferência de duplicata e gravação somadas. */
export const TETO_REGISTRO_MS = 1500

/**
 * Grava a linha da leitura. NUNCA lança, e nunca segura a leitura por mais de TETO_REGISTRO_MS: em modo aviso a leitura
 * passa mesmo se o registro falhar ou o banco não responder (o erro vai ao Sentry, e o dia em que houve falha é "não
 * medido" no fechamento da janela).
 * `desfecho = 'aviso'`: a leitura foi aceita. `'recusada'`: a chave recebeu 403.
 */
export async function registrarLeitura(req: NextRequest, auth: PipelineAuth, desfecho: 'aviso' | 'recusada'): Promise<void> {
  if (auth.source !== 'api_key' || !auth.keyId) return
  const corte = new AbortController()
  let relogio: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      gravar(req, auth, auth.keyId, desfecho, corte.signal),
      new Promise<never>((_, recusar) => {
        relogio = setTimeout(() => {
          corte.abort()   // cancela as idas ao banco que ainda estiverem no ar
          recusar(new Error(`registro de leitura passou de ${TETO_REGISTRO_MS} ms`))
        }, TETO_REGISTRO_MS)
      }),
    ])
  } catch (e) {
    avisarFalha('gravacao', e)
  } finally {
    clearTimeout(relogio)
  }
}

async function gravar(req: NextRequest, auth: PipelineAuth, keyId: string, desfecho: 'aviso' | 'recusada', sinal: AbortSignal): Promise<void> {
  const cfg = modoLeitura()
  const agora = new Date()
  const hoje = diaSP(agora)
  const temRead = requirePermission(auth, 'read')
  const emConferencia = cfg.modo === 'recusa' && !!cfg.conferenciaAte && agora.getTime() <= Date.parse(cfg.conferenciaAte)
  // Linha de controle (leitura aceita de chave COM read): tem fim.
  if (desfecho === 'aviso' && temRead) {
    if (cfg.modo === 'recusa' ? !emConferencia : cfg.controleFechadoEm !== null) return
  }
  // No modo recusa, leitura aceita sem read não existe (seria recusada); nada a gravar fora da conferência.
  if (desfecho === 'aviso' && cfg.modo === 'recusa' && !emConferencia) return

  const action = desfecho === 'recusada' ? ACAO_RECUSA : ACAO_AVISO
  const rota = rotaNormalizada(req.nextUrl.pathname)
  const metodo = req.method
  const supabase = getSupabaseServiceClient()

  const passouDoPrazo = cfg.modo === 'aviso' && diasCorridos(cfg.avisoDesde, hoje) > DIAS_CORRIDOS_CHEIOS
  if (passouDoPrazo && avisouAtraso !== hoje) {
    avisouAtraso = hoje
    Sentry.captureMessage(`pipeline: modo aviso da leitura aberto há ${diasCorridos(cfg.avisoDesde, hoje)} dias sem fechar (E19); registro reduzido`, 'warning')
  }
  // (emenda do portão: D-I4) O registro cheio tem fim nos DOIS modos. Aviso: até o 14º dia corrido. Recusa: só nas 48 horas
  // da conferência; depois, uma linha por chave, rota, método e dia, para sempre. Modo recusa sem `conferenciaAte` (não
  // deveria ser publicado: um teste prende) cai no reduzido, nunca no cheio.
  const foraDoCheio = cfg.modo === 'recusa' ? !emConferencia : passouDoPrazo
  const noTeto = !foraDoCheio && (await linhasDeHoje(supabase, hoje, agora.getTime(), sinal)) >= TETO_LINHAS_DIA
  // (emenda do portão: D-M10) Um laço de uma chave aparece no dia, não só na conferência seguinte.
  if (noTeto && avisouTeto !== hoje) {
    avisouTeto = hoje
    Sentry.captureMessage(`pipeline: o registro de leitura bateu no teto de ${TETO_LINHAS_DIA} linhas hoje (E19); registro reduzido até o fim do dia e contagem de vezes cortada`, 'warning')
  }
  const reduzido = foraDoCheio || noTeto
  const marca = `${keyId}|${rota}|${metodo}|${action}|${temRead}`
  if (reduzido) {
    if (diaDosVistos !== hoje) {
      vistos.clear()
      diaDosVistos = hoje
    }
    if (vistos.has(marca)) return
    const ja = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .is('site_id', null)
      .eq('action', action)
      .gte('created_at', inicioDoDiaSP(hoje))
      .eq('after_data->>key_id', keyId)
      .eq('after_data->>rota', rota)
      .eq('after_data->>metodo', metodo)
      .abortSignal(sinal)
    if (!ja.error && (ja.count ?? 0) > 0) {
      vistos.add(marca)
      return
    }
    // Conferência que falha: grava (prefere medir).
  }

  const { error } = await supabase
    .from('audit_log')
    .insert({
      action,
      resource_type: RECURSO_CHAVE,
      site_id: null,
      after_data: { site_id: auth.siteId, key_id: keyId, key_name: auth.keyName ?? null, rota, metodo, tem_read: temRead },
    })
    .abortSignal(sinal)
  if (error) throw new Error(`audit_log recusou a linha de leitura (${error.code ?? 'sem código'})`)
  if (reduzido) vistos.add(marca)
  if (contagem && contagem.dia === hoje) contagem.n++
}
```

Em `apps/web/src/lib/pipeline/auth.ts`, na interface `PipelineAuth`, acrescentar depois de `keyId`:

```ts
  /** pipeline_api_keys.name — só para o registro de leitura (E19). Nunca a chave. */
  keyName?: string | null
```

- [ ] **Step 5: Rodar e ver passar.** Run: `cd apps/web && npx vitest run test/lib/pipeline/leitura-registro.test.ts > /tmp/e19-t1.log 2>&1; grep -E "×|FAIL|Tests" /tmp/e19-t1.log`. Expected: PASS em todos. No teste "contagem do teto é lida uma vez", `banco.selects` é 1 porque as duas leituras estão dentro do TTL; no teste do teto, as duas conferências de duplicata somam selects e não importam. *(emenda do portão)* No teste do banco que não responde, o relógio falso cobre `setTimeout` só naquele teste (`vi.useFakeTimers({ now: AGORA })`); o `afterEach` do arquivo devolve o relógio de verdade. Se o `abortSignal` do cliente de serviço não existir na versão instalada do `@supabase/postgrest-js` para alguma das três cadeias (contagem com `head`, conferência, `insert`), o typecheck acusa: nesse caso tirar o `.abortSignal(sinal)` **só daquela cadeia** e anotar no ledger; o teto de 1,5 s continua valendo, porque quem o garante é o `Promise.race`, não o cancelamento.

- [ ] **Step 6: Commit.** `git commit -m "feat: registro das leituras do pipeline por chave em audit_log, com teto e fim (A5, E19; modo aviso)" -- apps/web/src/lib/pipeline/leitura-modo.ts apps/web/src/lib/pipeline/leitura-acoes.ts apps/web/src/lib/pipeline/leitura-registro.ts apps/web/src/lib/pipeline/auth.ts apps/web/test/lib/pipeline/leitura-registro.test.ts`

---

### Task 2: nome da chave e recusa própria do perfil `observatorio_leitura`

**Files:**
- Modify: `apps/web/src/lib/pipeline/auth.ts:82-100`
- Test: `apps/web/test/lib/pipeline/auth-perfil.test.ts` (novo)

**Interfaces:**
- Produces: `authenticatePipeline` devolve `auth.keyName`; para chave cujo `permissions` contém `observatorio_leitura` devolve `{ ok: false, status: 403, error: 'Forbidden' }`.

- [ ] **Step 1: Teste que falha.**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const linha = vi.hoisted(() => ({ atual: { id: 'key-1', site_id: 'site-1', name: 'cowork-permanent', permissions: ['read'] as string[] }, updates: 0 }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: linha.atual }) }) }) }),
      update: () => ({ eq: async () => { linha.updates++; return {} } }),
    }),
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockRejectedValue(new Error('sem sessão')) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

import { authenticatePipeline } from '@/lib/pipeline/auth'

const pedido = (chave: string) => ({ headers: new Headers({ 'X-Pipeline-Key': chave }) }) as never

beforeEach(() => { linha.updates = 0 })

describe('authenticatePipeline (E19)', () => {
  it('devolve o nome da chave em keyName', async () => {
    linha.atual = { id: 'key-1', site_id: 'site-1', name: 'cowork-permanent', permissions: ['read', 'write', 'admin'] }
    const r = await authenticatePipeline(pedido('k-nome'))
    expect(r.ok && r.auth.keyName).toBe('cowork-permanent')
  })
  it('chave só com observatorio_leitura: 403, antes de qualquer outra permissão', async () => {
    linha.atual = { id: 'key-2', site_id: 'site-1', name: 'irma', permissions: ['observatorio_leitura'] }
    expect(await authenticatePipeline(pedido('k-perfil'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })
  it('chave com observatorio_leitura E read (ou admin): 403 do mesmo jeito', async () => {
    linha.atual = { id: 'key-3', site_id: 'site-1', name: 'x', permissions: ['observatorio_leitura', 'read', 'admin'] }
    expect(await authenticatePipeline(pedido('k-misto'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })
  it('chave com intelligence continua autenticando (quem decide é o helper da rota)', async () => {
    linha.atual = { id: 'key-4', site_id: 'site-1', name: 'forja (fila)', permissions: ['intelligence'] }
    const r = await authenticatePipeline(pedido('k-fila'))
    expect(r.ok && r.auth.permissions).toEqual(['intelligence'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/lib/pipeline/auth-perfil.test.ts`. Expected: FAIL no 1º, 2º e 3º.

- [ ] **Step 3: Implementar em `auth.ts`.** No `select`: `'id, site_id, name, permissions'`. Logo depois do `if (!keyRow)`:

```ts
    // A5, 8.1.4 (N2): a chave do perfil `observatorio_leitura` só vale no servidor MCP do Observatório. Em /api/pipeline/*
    // é recusada sempre, antes de qualquer outra permissão e sem depender do modo da E19 (reverter a recusa não a reabre).
    if (Array.isArray(keyRow.permissions) && keyRow.permissions.includes('observatorio_leitura')) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
```

E no retorno: `keyName: keyRow.name ?? null` dentro de `auth`.

- [ ] **Step 4: Rodar os testes de autenticação.** Run: `cd apps/web && npx vitest run test/lib/pipeline/auth-perfil.test.ts test/lib/pipeline/auth.test.ts test/api/pipeline-auth.test.ts test/lib/pipeline/auth-rate-limit-memory.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: authenticatePipeline devolve o nome da chave e recusa o perfil observatorio_leitura em todo o pipeline (A5, E19)" -- apps/web/src/lib/pipeline/auth.ts apps/web/test/lib/pipeline/auth-perfil.test.ts`

---

### Task 3: `authenticateRead` registra (e sabe recusar); `context/route.ts` passa a usá-lo

**Files:**
- Modify: `apps/web/src/lib/pipeline/helpers.ts:32-38`
- Modify: `apps/web/src/app/api/pipeline/context/route.ts:1-10`
- Modify: `apps/web/test/api/pipeline/context-filters.test.ts:15-25` e `:43-51` *(emenda do portão: S19-I1)*
- Test: `apps/web/test/lib/pipeline/helpers-leitura.test.ts` (novo)

**Interfaces:**
- Consumes: `registrarLeitura`, `modoLeitura` (Tarefa 1).
- Produces: `authenticateRead(req)` com a mesma assinatura; em modo `recusa` devolve 403 `{ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }` para chave sem `read`, `write` ou `admin` (o mesmo corpo de `authenticateWrite`).

- [ ] **Step 1: Teste que falha.**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('@/lib/pipeline/leitura-registro', () => ({ registrarLeitura: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(),
}))

import { authenticateRead, authenticateWrite, authenticateIntel, authenticateReadOrIntel } from '@/lib/pipeline/helpers'
import { authenticatePipeline, type PipelineAuth } from '@/lib/pipeline/auth'
import { registrarLeitura } from '@/lib/pipeline/leitura-registro'

const req = new NextRequest('https://x.test/api/pipeline/stats')
const chave = (permissions: string[]): PipelineAuth => ({ siteId: 's', permissions, source: 'api_key', keyHash: 'h', keyId: 'k', keyName: 'n' })
const sessao: PipelineAuth = { siteId: 's', permissions: ['read', 'write'], source: 'session' }
const entra = (auth: PipelineAuth) => vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth })

beforeEach(() => { vi.clearAllMocks(); cfg.modo = 'aviso' })

describe('authenticateRead, modo aviso', () => {
  it('chave só com intelligence continua lendo E a leitura é registrada', async () => {
    entra(chave(['intelligence']))
    const r = await authenticateRead(req)
    expect(r).toEqual({ ok: true, auth: chave(['intelligence']) })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['intelligence']), 'aviso')
  })
  it('chave com read lê e é registrada (controle positivo)', async () => {
    entra(chave(['read']))
    expect(await authenticateRead(req)).toMatchObject({ ok: true })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['read']), 'aviso')
  })
  it('chave inválida: 401, sem registro', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Invalid or revoked API key' })
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(401)
    expect(registrarLeitura).not.toHaveBeenCalled()
  })
})

describe('authenticateRead, modo recusa', () => {
  beforeEach(() => { cfg.modo = 'recusa' })
  it('chave só com intelligence: 403 com o corpo de authenticateWrite, e a recusa é registrada', async () => {
    entra(chave(['intelligence']))
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(403)
    expect(await (r as Response).json()).toEqual({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['intelligence']), 'recusada')
    entra(chave(['intelligence']))
    const w = await authenticateWrite(req)
    expect(await (w as Response).json()).toEqual({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
  })
  it('chave sem permissão nenhuma: 403', async () => {
    entra(chave([]))
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(403)
  })
  it.each([['read'], ['write'], ['admin']])('chave com %s lê como antes', async (p) => {
    entra(chave([p]))
    expect(await authenticateRead(req)).toMatchObject({ ok: true })
  })
  it('sessão de usuário lê como antes', async () => {
    entra(sessao)
    expect(await authenticateRead(req)).toEqual({ ok: true, auth: sessao })
  })
  it('os outros helpers não mudam: intelligence passa em Intel e em ReadOrIntel', async () => {
    entra(chave(['intelligence']))
    expect(await authenticateIntel(req)).toMatchObject({ ok: true })
    entra(chave(['intelligence']))
    expect(await authenticateReadOrIntel(req)).toMatchObject({ ok: true })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/lib/pipeline/helpers-leitura.test.ts`. Expected: FAIL (o registro não é chamado; a recusa não existe).

- [ ] **Step 3: Implementar.** Em `helpers.ts`, importar `modoLeitura` de `./leitura-modo` e `registrarLeitura` de `./leitura-registro`, e trocar `authenticateRead` por:

```ts
/**
 * Leitura do pipeline. Sessão de usuário passa como sempre. Chave de API precisa de `read` (ou `write`, `admin`).
 * E19 (A5): em modo `aviso` a chave sem `read` ainda lê, e toda leitura por chave é registrada (com controle positivo);
 * em modo `recusa` ela recebe 403 e a recusa é registrada. O modo é o de `leitura-modo.ts`.
 */
export async function authenticateRead(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | NextResponse
> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  const { auth } = authResult
  if (!requirePermission(auth, 'read') && modoLeitura().modo === 'recusa') {
    await registrarLeitura(req, auth, 'recusada')
    return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, auth)
  }
  await registrarLeitura(req, auth, 'aviso')
  return { ok: true, auth }
}
```

Em `context/route.ts`: tirar `authenticatePipeline` do import de `@/lib/pipeline/auth` (fica `buildRateLimitHeaders`), importar `authenticateRead` de `@/lib/pipeline/helpers` (o import de `pipelineError` sai se não for mais usado), e trocar as três primeiras linhas do `GET` por:

```ts
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result
```

- [ ] **Step 3b** *(emenda do portão: S19-I1)*: **Consertar `test/api/pipeline/context-filters.test.ts` neste mesmo commit.** Esse teste simula o módulo `@/lib/pipeline/helpers` inteiro só com `pipelineError` (linhas 20 a 25) e prepara `authenticatePipeline` (linha 51). Com `context/route.ts` importando `authenticateRead` de `@/lib/pipeline/helpers`, o vitest lança "No "authenticateRead" export is defined on the mock" e o arquivo inteiro falha. Simular `leitura-registro` não conserta. Três mudanças:

```ts
vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
}))
```

```ts
import { authenticateRead } from '@/lib/pipeline/helpers'
```

  e, onde hoje está `vi.mocked(authenticatePipeline).mockResolvedValue({ … })` (linha 51), passar a `vi.mocked(authenticateRead).mockResolvedValue({ ok: true, auth: <o mesmo objeto auth que o teste já monta> })`. O `vi.mock('@/lib/pipeline/auth', …)` fica só com `buildRateLimitHeaders` (a rota ainda o importa); o import de `authenticatePipeline` do teste sai. Nenhuma afirmação do arquivo muda: ele testa os filtros de `context`, não a autenticação (que agora é do teste do helper, Step 1).

- [ ] **Step 4: Rodar tudo que toca o pipeline.** Run: `cd apps/web && npx vitest run test/lib/pipeline test/api test/unit/pipeline test/ab-pipeline-api.test.ts > /tmp/e19-t3.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e19-t3.log | head -40`. Expected: PASS. Se um teste de rota quebrar por contar chamadas ao cliente do banco (o registro acrescenta uma contagem e uma escrita quando o teste entra com chave que tem `keyId`): acrescentar **naquele teste** `vi.mock('@/lib/pipeline/leitura-registro', () => ({ registrarLeitura: vi.fn().mockResolvedValue(undefined) }))`. Nunca tirar a chamada do helper. *(emenda do portão: S19-I1)* `test/api/pipeline/context-filters.test.ts` **não** passa sem o Step 3b (a frase que estava aqui dizia o contrário e estava errada). Antes de commitar, procurar outros testes na mesma situação: `grep -rln "vi.mock('@/lib/pipeline/helpers'" apps/web/test | xargs grep -L authenticateRead` lista os arquivos que simulam o módulo de helpers sem `authenticateRead`; para cada um, conferir se a rota que ele importa passou a usar o helper nesta tarefa (só `context` passou).

- [ ] **Step 5: Typecheck e commit.** Run: `npm run typecheck -w apps/web > /tmp/e19-tc.log 2>&1; tail -5 /tmp/e19-tc.log`.
`git commit -m "feat: authenticateRead registra toda leitura por chave e sabe recusar a que não tem read; context passa a usar o helper (A5, E19; modo aviso)" -- apps/web/src/lib/pipeline/helpers.ts apps/web/src/app/api/pipeline/context/route.ts apps/web/test/lib/pipeline/helpers-leitura.test.ts apps/web/test/api/pipeline/context-filters.test.ts` (mais os testes de rota que precisaram da simulação, pelo caminho).

---

### Task 4: a varredura dos 91 arquivos de rota (item 209)

**Files:**
- Test: `apps/web/test/api/pipeline/e19-varredura-rotas.test.ts` (novo)

**Interfaces:**
- Consumes: tudo das Tarefas 1 a 3. Não cria código de produção.

O arnês abaixo foi executado em 12/10 contra o código atual: importa os 91 módulos e chama handlers em 1,3 s, sem precisar simular serviço nenhum (a recusa acontece antes de qualquer serviço).

- [ ] **Step 1: Escrever o teste.**

```ts
// @vitest-environment node
// E19, item 209: a prova é pela lista de arquivos (glob), não por lista escrita à mão. Rota nova sem autenticação quebra aqui.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const estado = vi.hoisted(() => ({
  permissions: ['observatorio_leitura'] as string[],
  cfg: { modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => estado.cfg }))
vi.mock('@/lib/supabase/service', () => {
  // Banco mínimo: devolve a chave com as permissões do teste e aceita qualquer outra chamada sem fazer nada.
  const cadeia = (tabela: string): unknown => {
    const alvo: Record<string | symbol, unknown> = {
      single: async () => ({ data: tabela === 'pipeline_api_keys' ? { id: 'k1', site_id: 's1', name: 'teste', permissions: estado.permissions } : null, error: null }),
      insert: async () => ({ error: null }),
      then: (ok: (v: unknown) => unknown) => ok({ data: [], error: null, count: 0 }),
    }
    return new Proxy(alvo, { get: (t, p) => (p in t ? t[p] : () => cadeia(tabela)) })
  }
  return { getSupabaseServiceClient: () => ({ from: (t: string) => cadeia(t), rpc: async () => ({ data: null, error: null }) }) }
})

const modulos = import.meta.glob('../../../src/app/api/pipeline/**/route.ts')
const METODOS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const
type Metodo = (typeof METODOS)[number]
type Helper = 'authenticateRead' | 'authenticateWrite' | 'authenticateIntel' | 'authenticateReadOrIntel' | 'authenticatePipeline' | 'NENHUM'
const ID = '00000000-0000-4000-8000-000000000001'
const PARAMS = { id: ID, key: 'k', code: 'c', domain: 'd', section: 's', linkId: ID }
const rotaDe = (arq: string) => arq.replace(/^.*\/src\/app\/api\/pipeline\/?/, '').replace(/\/?route\.ts$/, '')

/** As únicas rotas em que a chave só com `intelligence` passa: as de authenticateIntel e a de authenticateReadOrIntel. */
const EXCECOES_INTELLIGENCE = [
  'GET youtube/channels',
  'GET youtube/competitors/readings',
  'POST youtube/competitors/readings',
  'GET youtube/intelligence',
  'PATCH youtube/intelligence',
  'GET youtube/intelligence/task',
  'POST youtube/intelligence/task/[id]/fail',
  'POST youtube/intelligence/task/claim',
].sort()

interface Handler { rota: string; metodo: Metodo; helper: Helper; chamar: (req: NextRequest, ctx: unknown) => Promise<Response> }

async function listarHandlers(): Promise<Handler[]> {
  const out: Handler[] = []
  for (const arq of Object.keys(modulos).sort()) {
    const fonte = readFileSync(resolve(__dirname, arq), 'utf8')
    expect(fonte, `${arq}: handler exportado como const não é lido por esta varredura`).not.toMatch(/export\s+const\s+(GET|POST|PATCH|PUT|DELETE)\b/)
    const partes = fonte.split(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/)
    const helperDe = new Map<string, Helper>()
    for (let i = 1; i < partes.length; i += 2) {
      const achado = partes[i + 1]!.match(/\b(authenticateReadOrIntel|authenticateRead|authenticateWrite|authenticateIntel|authenticatePipeline)\(/)
      helperDe.set(partes[i]!, (achado?.[1] as Helper | undefined) ?? 'NENHUM')
    }
    const mod = (await modulos[arq]!()) as Record<string, unknown>
    for (const metodo of METODOS) {
      const h = mod[metodo]
      if (typeof h !== 'function') continue
      out.push({ rota: rotaDe(arq), metodo, helper: helperDe.get(metodo) ?? 'NENHUM', chamar: h as Handler['chamar'] })
    }
  }
  return out
}

// Uma chave por pedido: o limite de 100 pedidos por minuto é por chave, e a varredura faz mais de 600.
let pedidos = 0
const pedir = (h: Handler) => h.chamar(
  new NextRequest(`https://x.test/api/pipeline/${h.rota.replace(/\[(\w+)\]/g, (_, n: string) => PARAMS[n as keyof typeof PARAMS] ?? 'x')}`, {
    method: h.metodo, headers: { 'X-Pipeline-Key': `chave-de-teste-${pedidos++}`, 'content-type': 'application/json' }, body: h.metodo === 'GET' ? undefined : '{}',
  }),
  { params: Promise.resolve(PARAMS) },
)

let handlers: Handler[] = []
beforeEach(async () => {
  if (handlers.length === 0) handlers = await listarHandlers()
  estado.cfg.modo = 'aviso'
  estado.permissions = ['observatorio_leitura']
})

describe('E19: todo route.ts de app/api/pipeline', () => {
  it('o glob achou as rotas (se vier vazio, a prova não prova nada)', () => {
    expect(Object.keys(modulos).length).toBeGreaterThanOrEqual(91)
    expect(handlers.length).toBeGreaterThanOrEqual(129)
  })

  it('todo handler autentica por um dos quatro helpers; nenhum chama authenticatePipeline direto', () => {
    const fora = handlers.filter(h => h.helper === 'NENHUM' || h.helper === 'authenticatePipeline').map(h => `${h.metodo} ${h.rota}`)
    expect(fora).toEqual([])
    expect(handlers.find(h => h.rota === 'context' && h.metodo === 'GET')?.helper).toBe('authenticateRead')
    expect(handlers.find(h => h.rota === 'audio-library/resolve' && h.metodo === 'POST')?.helper).toBe('authenticateRead')   // leitura que não é GET
  })

  it('as exceções da chave intelligence são exatamente as oito escritas neste teste', () => {
    const reais = handlers.filter(h => h.helper === 'authenticateIntel' || h.helper === 'authenticateReadOrIntel').map(h => `${h.metodo} ${h.rota}`).sort()
    expect(reais).toEqual(EXCECOES_INTELLIGENCE)
  })

  it('chave só com observatorio_leitura: 403 em todo handler, em todo método, COM A RECUSA DA E19 DESLIGADA (commit 2 revertido)', async () => {
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  it('chave com observatorio_leitura E read: 403 em todo handler também', async () => {
    estado.permissions = ['observatorio_leitura', 'read']
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  it('modo recusa, chave só com intelligence: 403 em todo handler que não é exceção (leitura e escrita)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['intelligence']
    const passou: string[] = []
    let chamados = 0
    for (const h of handlers) {
      if (EXCECOES_INTELLIGENCE.includes(`${h.metodo} ${h.rota}`)) continue
      chamados++
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
    expect(chamados).toBe(handlers.length - EXCECOES_INTELLIGENCE.length)
  }, 60_000)

  it('modo recusa, chave sem permissão nenhuma: 403 em todo handler', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = []
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  // (emenda do portão: S19-M3) O outro lado do item 209: quem TEM a permissão continua passando, rota a rota.
  // Aqui o handler segue para o serviço com o banco mínimo: pode devolver 404, 400, 500 ou lançar. Tudo isso conta como
  // "passou da autenticação"; só 401 e 403 são barrados. Handler que não responde em 3 s também passou (está no serviço).
  const desfechoDe = async (h: Handler): Promise<number | 'lancou' | 'demorou'> => {
    try {
      return await Promise.race([
        pedir(h).then(r => r.status),
        new Promise<'demorou'>(ok => setTimeout(() => ok('demorou'), 3000)),
      ])
    } catch {
      return 'lancou'
    }
  }

  it('modo recusa, chave com read: nenhum handler de leitura devolve 401 nem 403 (lê como antes)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['read']
    const barrados: string[] = []
    const leitura = handlers.filter(h => h.helper === 'authenticateRead')
    expect(leitura.length).toBeGreaterThanOrEqual(57)
    for (const h of leitura) {
      const d = await desfechoDe(h)
      if (d === 401 || d === 403) barrados.push(`${h.metodo} ${h.rota} -> ${d}`)
    }
    expect(barrados).toEqual([])
  }, 240_000)

  it('modo recusa, chave só com intelligence: passa nas oito exceções (a fila da forja não é cortada)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['intelligence']
    const barrados: string[] = []
    for (const h of handlers.filter(x => EXCECOES_INTELLIGENCE.includes(`${x.metodo} ${x.rota}`))) {
      const d = await desfechoDe(h)
      if (d === 401 || d === 403) barrados.push(`${h.metodo} ${h.rota} -> ${d}`)
    }
    expect(barrados).toEqual([])
  }, 60_000)

  it('não existe handler do pipeline fora de route.ts (a varredura só lê route.ts)', () => {
    expect(Object.keys(import.meta.glob('../../../src/app/api/pipeline/**/route.{tsx,js,jsx,mjs}'))).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar.** Run: `cd apps/web && npx vitest run test/api/pipeline/e19-varredura-rotas.test.ts > /tmp/e19-t4.log 2>&1; grep -E "✓|×|FAIL|Tests|->" /tmp/e19-t4.log | head -40`. Expected: PASS nos dez *(emenda do portão: S19-M3. Os três últimos testes **não foram executados pelo planejador**; os sete primeiros foram, em 12/10. Se um handler de leitura devolver 403 a uma chave com `read` por uma regra própria do recurso, e não pela autenticação, é achado a investigar e registrar, nunca motivo para tirar o handler da lista. Se a varredura passar de 4 minutos, baixar os 3 s do `desfechoDe` para 1 s: a afirmação não muda. Sessão de usuário, rota a rota, não entra: ela não tem ramo por rota, e o teste do helper da Tarefa 3 a cobre nos dois modos.)* (o código das Tarefas 1 a 3 já está no lugar; o teste "modo recusa" passa desde já porque o caminho da recusa foi escrito na Tarefa 3). **Prova de que o teste morde:** tirar temporariamente as três linhas da regra do perfil em `auth.ts` e rodar de novo: o 4º teste tem de falhar (com a lista dos handlers de leitura, ou com a exceção de um deles ao entrar no serviço sem banco); devolver as linhas e ver verde de novo. Anotar no ledger que foi feito.

Se um handler aparecer na lista com status diferente de 403 por fazer algo **antes** de autenticar (ler o corpo, validar parâmetro), é achado: a autenticação sobe para a primeira linha do handler, neste commit. *(emenda do portão: S19-M3)* **Limite conhecido:** a varredura usa um UUID válido, então **não acusa** os 28 handlers que validam o formato do id antes de autenticar e devolvem 400 a um id malformado. Não é brecha (nenhum dado sai antes da autenticação) e não é mexido aqui.

- [ ] **Step 3: Commit.** `git commit -m "test: varredura dos 91 route.ts do pipeline prova a recusa por arquivo e o isolamento do perfil observatorio_leitura (A5, E19, item 209)" -- apps/web/test/api/pipeline/e19-varredura-rotas.test.ts`

---

### Task 5: as linhas não aparecem em nenhuma tela (F-A) e a gravação funciona no banco de verdade

**Files:**
- Create: `apps/web/src/app/admin/(authed)/audit/filtros.ts`
- Modify: `apps/web/src/app/admin/(authed)/audit/page.tsx:72-84`
- Test: `apps/web/test/app/admin/audit-filtros.test.ts` (novo)
- Test: `apps/web/test/integration/pipeline-leitura-aviso.test.ts` (novo, banco local)

**Interfaces:**
- Consumes: `ACOES_DE_LEITURA`, `registrarLeitura`.
- Produces: `aplicarFiltrosDeAuditoria<Q extends ConsultaDeAuditoria<Q>>(q: Q, f: { org?: string; action?: string; resource?: string }): Q`.

- [ ] **Step 1: Teste da listagem de `/admin/audit` (falha).**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { aplicarFiltrosDeAuditoria } from '@/app/admin/(authed)/audit/filtros'

const gravador = () => {
  const chamadas: string[] = []
  const q = {
    eq: (c: string, v: string) => { chamadas.push(`eq ${c} ${v}`); return q },
    not: (c: string, op: string, v: string) => { chamadas.push(`not ${c} ${op} ${v}`); return q },
  }
  return { q, chamadas }
}

describe('aplicarFiltrosDeAuditoria', () => {
  it('sem filtro de ação: as duas ações do registro de leitura do pipeline ficam fora da listagem', () => {
    const { q, chamadas } = gravador()
    aplicarFiltrosDeAuditoria(q, {})
    expect(chamadas).toEqual(['not action in (pipeline_leitura_aviso,pipeline_leitura_recusada)'])
  })
  it('com filtro de ação: vale o filtro (é assim que se veem as linhas do registro)', () => {
    const { q, chamadas } = gravador()
    aplicarFiltrosDeAuditoria(q, { action: 'pipeline_leitura_aviso', org: 'o1', resource: 'pipeline_api_key' })
    expect(chamadas).toEqual(['eq org_id o1', 'eq action pipeline_leitura_aviso', 'eq resource_type pipeline_api_key'])
  })
})
```

- [ ] **Step 2: Implementar.** `filtros.ts`:

```ts
import { ACOES_DE_LEITURA } from '@/lib/pipeline/leitura-acoes'   // (emenda do portão: S19-M7) sem Sentry nem cliente de serviço

export interface ConsultaDeAuditoria<Q> {
  eq(coluna: string, valor: string): Q
  not(coluna: string, operador: string, valor: string): Q
}

/**
 * Filtros da listagem de /admin/audit. O registro de leitura do pipeline (E19) grava uma linha por leitura feita por chave:
 * sem isto, a listagem padrão do super admin viraria só essas linhas. Filtrando pela ação elas aparecem.
 */
export function aplicarFiltrosDeAuditoria<Q extends ConsultaDeAuditoria<Q>>(q: Q, f: { org?: string; action?: string; resource?: string }): Q {
  let out = q
  if (f.org) out = out.eq('org_id', f.org)
  if (f.action) out = out.eq('action', f.action)
  else out = out.not('action', 'in', `(${ACOES_DE_LEITURA.join(',')})`)
  if (f.resource) out = out.eq('resource_type', f.resource)
  return out
}
```

Em `page.tsx`, trocar as três linhas `if (org) … if (actionFilter) … if (resourceFilter) …` por `query = aplicarFiltrosDeAuditoria(query, { org, action: actionFilter, resource: resourceFilter })` (ajustar o nome das variáveis ao que a página usa; `undefined` e string vazia contam como "sem filtro"). Se o tipo do builder do Supabase não casar com `ConsultaDeAuditoria`, tipar a chamada com o tipo do builder (`typeof query`), sem `any`.

Run: `cd apps/web && npx vitest run test/app/admin/audit-filtros.test.ts`. Expected: PASS.

- [ ] **Step 3: Teste de integração no banco local.** Criar `apps/web/test/integration/pipeline-leitura-aviso.test.ts`:

```ts
// @vitest-environment node
// E19: a linha entra em audit_log de verdade (cliente de serviço, sem ator, site_id nulo), os filtros por after_data->>
// funcionam no PostgREST, e o feed de atividade do painel não recebe nenhuma delas (F-A).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { registrarLeitura, zerarEstadoDoRegistro, diaSP, ACAO_AVISO } from '@/lib/pipeline/leitura-registro'
import { fetchActivityFeed } from '@/app/cms/(authed)/_components/dashboard-queries'
import type { PipelineAuth } from '@/lib/pipeline/auth'

describe.skipIf(skipIfNoLocalDb())('E19: registro de leitura no banco local', () => {
  const sb = getSupabaseServiceClient()
  const keyId = randomUUID()
  let siteId = ''
  const auth = (permissions: string[]): PipelineAuth => ({ siteId, permissions, source: 'api_key', keyHash: 'h'.repeat(64), keyId, keyName: 'teste-e19' })
  const req = (rota: string) => new NextRequest(`https://x.test/api/pipeline/${rota}`)
  const minhas = async () => (await sb.from('audit_log').select('id, site_id, actor_user_id, after_data').eq('action', ACAO_AVISO).eq('after_data->>key_id', keyId)).data ?? []
  const hojeMenos = (dias: number) => diaSP(new Date(Date.now() - dias * 86_400_000))

  beforeAll(async () => { siteId = (await seedSite(sb)).siteId })
  beforeEach(() => { zerarEstadoDoRegistro(); Object.assign(cfg, { modo: 'aviso', avisoDesde: hojeMenos(1), controleFechadoEm: null, conferenciaAte: null }) })
  afterAll(async () => {
    await sb.from('audit_log').delete().eq('after_data->>key_id', keyId)
    await sb.from('audit_log').delete().eq('site_id', siteId)
  })

  it('a linha é aceita sem ator e com site_id nulo; o site fica em after_data', async () => {
    await registrarLeitura(req('stats'), auth(['read']), 'aviso')
    const linhas = await minhas()
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ site_id: null, actor_user_id: null, after_data: { site_id: siteId, key_id: keyId, rota: '/api/pipeline/stats', metodo: 'GET', tem_read: true } })
  })

  it('40 linhas de aviso: o feed de atividade do site devolve as mesmas linhas de antes', async () => {
    await sb.from('audit_log').insert({ action: 'update', resource_type: 'blog_posts', site_id: siteId })
    const antes = await fetchActivityFeed(siteId)
    for (let i = 0; i < 40; i++) await registrarLeitura(req(`items/${randomUUID()}`), auth(i % 2 ? ['read'] : ['intelligence']), 'aviso')
    expect((await minhas()).length).toBeGreaterThanOrEqual(40)
    const depois = await fetchActivityFeed(siteId)
    expect(depois).toEqual(antes)
    expect(JSON.stringify(depois)).not.toContain('pipeline_leitura')
  })

  it('15º dia: a conferência de duplicata funciona contra o PostgREST (after_data->>), uma linha só', async () => {
    cfg.avisoDesde = hojeMenos(20)
    const rota = 'links/fixo-e19'
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    zerarEstadoDoRegistro()
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    expect((await minhas()).filter(l => (l.after_data as { rota: string }).rota === `/api/pipeline/${rota}`)).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Rodar.** Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/pipeline-leitura-aviso.test.ts > /tmp/e19-t5.log 2>&1; tail -15 /tmp/e19-t5.log` (com `npm run db:start` de pé; **nunca** `db:reset`). Expected: PASS nos três. É a resposta executada da OP-6: o banco aceita a linha do cliente de serviço sem ator. Se `fetchActivityFeed` pedir outra simulação de `next/*` para rodar fora do Next, acrescentar a simulação; não trocar a função por uma cópia da consulta.

- [ ] **Step 5: Commit.** `git commit -m "feat: as linhas do registro de leitura do pipeline ficam fora do feed do painel e da listagem padrão de /admin/audit (A5, E19, F-A)" -- "apps/web/src/app/admin/(authed)/audit/filtros.ts" "apps/web/src/app/admin/(authed)/audit/page.tsx" apps/web/test/app/admin/audit-filtros.test.ts apps/web/test/integration/pipeline-leitura-aviso.test.ts`

---

### Task 6: a janela e a lista (função pura e o comando que o controlador roda)

**Files:**
- Create: `apps/web/src/lib/pipeline/leitura-janela.ts`
- Create: `scripts/e19-janela.ts`
- Test: `apps/web/test/lib/pipeline/leitura-janela.test.ts`

**Interfaces:**
- Produces *(emenda do portão: S19-I2, D-M10)*: `interface DiaLido { dia_sp: string; controle: number; sem_read: number; linhas?: number; tarefas_forja?: number }`; `interface DiaDaJanela { dia: string; estado: 'medido' | 'nao_medido' | 'em_curso'; motivo?: 'sem_linha_de_controle' | 'falha_de_gravacao'; controle: number; sem_read: number; tarefas_forja: number; teto: boolean }`; `interface Janela { dias: DiaDaJanela[]; dias_medidos: number; dias_com_tarefa: number; fechada: boolean; linhas_sem_read: number; frase: string }`; `montarJanela(lidos: DiaLido[], o: { desde: string; hoje: string; diasComFalha?: string[] }): Janela`; `DIAS_MEDIDOS_PARA_FECHAR = 7`; `TETO_LINHAS_DIA_DA_JANELA = 5000`.

Regra: só conta dia **completo** (anterior a `hoje`); o dia em curso é `em_curso`. Dia medido = dia completo com pelo menos uma linha `tem_read = true` e sem falha de gravação no Sentry. *(emenda do portão: S19-I2)* **A janela fecha com 7 dias medidos e pelo menos um dia medido em que a forja concluiu uma tarefa da fila** (`youtube_intelligence_tasks.completed_at` naquele dia de São Paulo). A tarefa é semanal, às segundas (05/10 e 12/10, 08:10 UTC): na prática, a janela precisa de uma segunda-feira medida. Sem essa regra a recusa poderia subir sem que o caminho completo da fila tivesse rodado uma vez sob medição. Coluna `tarefas_forja` ausente da consulta conta como zero: dado ausente não fecha janela.

- [ ] **Step 1: Teste que falha.**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarJanela, type DiaLido } from '@/lib/pipeline/leitura-janela'

const DESDE = '2026-10-13'
// (emenda do portão: S19-I2) 19/10/2026 é segunda-feira: o dia da tarefa semanal da fila da forja.
const seteDias = (): DiaLido[] => ['14', '15', '16', '17', '18', '19', '20'].map(d => ({ dia_sp: `2026-10-${d}`, controle: 12, sem_read: 0, linhas: 12, tarefas_forja: d === '19' ? 1 : 0 }))

describe('montarJanela', () => {
  it('7 dias completos com controle e nenhuma leitura sem read: fecha, e a recusa pode subir', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 3, sem_read: 0 }, ...seteDias()], { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(8)
    expect(j.fechada).toBe(true)
    expect(j.frase).toBe('8 dias medidos e nenhuma leitura sem read: a recusa pode subir')
  })
  it('APAGA as linhas de controle de um dos 7 dias: 6 dias medidos de 7, a recusa não sobe, e o dia sai como "não medido" (nunca "limpo")', () => {
    const lidos = seteDias().filter(d => d.dia_sp !== '2026-10-17')
    const j = montarJanela(lidos, { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(6)
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('6 dias medidos de 7: a recusa não sobe')
    expect(j.dias.find(d => d.dia === '2026-10-17')).toMatchObject({ estado: 'nao_medido', motivo: 'sem_linha_de_controle', controle: 0 })
  })
  it('dia só com linhas sem read e nenhuma de controle também é "não medido"', () => {
    const lidos = seteDias().map(d => (d.dia_sp === '2026-10-16' ? { ...d, controle: 0, sem_read: 4 } : d))
    const j = montarJanela(lidos, { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias.find(d => d.dia === '2026-10-16')!.estado).toBe('nao_medido')
    expect(j.fechada).toBe(false)
    expect(j.linhas_sem_read).toBe(4)
  })
  it('dia com falha de gravação no Sentry é "não medido", mesmo com linhas de controle', () => {
    const j = montarJanela(seteDias(), { desde: '2026-10-14', hoje: '2026-10-21', diasComFalha: ['2026-10-18'] })
    expect(j.dias.find(d => d.dia === '2026-10-18')).toMatchObject({ estado: 'nao_medido', motivo: 'falha_de_gravacao' })
    expect(j.frase).toBe('6 dias medidos de 7: a recusa não sobe')
  })
  it('o dia de hoje é "em curso" e não conta, mesmo com controle', () => {
    const j = montarJanela([...seteDias().slice(0, 6), { dia_sp: '2026-10-20', controle: 9, sem_read: 0 }], { desde: '2026-10-14', hoje: '2026-10-20' })
    expect(j.dias.at(-1)).toMatchObject({ dia: '2026-10-20', estado: 'em_curso' })
    expect(j.dias_medidos).toBe(6)
    expect(j.fechada).toBe(false)
  })
  it('7 dias medidos com leitura sem read: fecha, mas a frase manda decidir linha a linha', () => {
    const lidos = seteDias().map(d => (d.dia_sp === '2026-10-15' ? { ...d, sem_read: 2 } : d))
    const j = montarJanela(lidos, { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.fechada).toBe(true)
    expect(j.frase).toBe('7 dias medidos; 2 leitura(s) sem read: decidir linha a linha antes da recusa')
  })
  it('nenhuma linha: nada medido, nada concluído', () => {
    const j = montarJanela([], { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(0)
    expect(j.dias.filter(d => d.estado === 'nao_medido')).toHaveLength(7)
    expect(j.frase).toBe('0 dias medidos de 7: a recusa não sobe')
  })

  // (emenda do portão: S19-I2) A recusa nunca sobe sem uma execução real da fila observada dentro da janela.
  it('o cenário do revisor: a segunda-feira da tarefa não foi medida e os outros 7 dias foram: 7 dias medidos, a janela NÃO fecha', () => {
    const lidos: DiaLido[] = [
      { dia_sp: DESDE, controle: 3, sem_read: 0, linhas: 3, tarefas_forja: 0 },
      ...seteDias().map(d => (d.dia_sp === '2026-10-19' ? { ...d, controle: 0, linhas: 0 } : d)),   // a forja rodou em 19/10, mas ninguém leu com read
    ]
    const j = montarJanela(lidos, { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('7 dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe')
    expect(j.dias.find(d => d.dia === '2026-10-19')).toMatchObject({ estado: 'nao_medido', tarefas_forja: 1 })
  })
  it('7 dias medidos e a fila não rodou em nenhum deles: não fecha', () => {
    const j = montarJanela(seteDias().map(d => ({ ...d, tarefas_forja: 0 })), { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('7 dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe')
  })
  it('consulta antiga, sem a coluna tarefas_forja: conta como zero, não fecha (dado ausente não é "teve tarefa")', () => {
    const semColuna: DiaLido[] = seteDias().map(({ dia_sp, controle, sem_read }) => ({ dia_sp, controle, sem_read }))
    const j = montarJanela(semColuna, { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
  })
  it('a tarefa caiu num dia com falha de gravação: aquele dia não conta, a janela não fecha', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 3, sem_read: 0, tarefas_forja: 0 }, ...seteDias()], { desde: DESDE, hoje: '2026-10-21', diasComFalha: ['2026-10-19'] })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
  })
  it('basta um dia medido com tarefa: fecha, e o veredito conta os dois números', () => {
    const j = montarJanela(seteDias(), { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j).toMatchObject({ dias_medidos: 7, dias_com_tarefa: 1, fechada: true })
  })
  // (emenda do portão: D-M10)
  it('dia que bateu no teto de linhas sai marcado; a decisão não muda', () => {
    const j = montarJanela(seteDias().map(d => (d.dia_sp === '2026-10-16' ? { ...d, linhas: 5000 } : d)), { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias.filter(d => d.teto).map(d => d.dia)).toEqual(['2026-10-16'])
    expect(j.fechada).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/lib/pipeline/leitura-janela.test.ts`. Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `leitura-janela.ts`** (sem nenhum import: o script o usa fora do Next).

```ts
// E19: a janela de medição do modo aviso. Função pura. "Nenhuma leitura sem read" só vale com o controle positivo do dia.
export const DIAS_MEDIDOS_PARA_FECHAR = 7
/** O mesmo número de TETO_LINHAS_DIA do registrador. Este arquivo não importa nada (o script o usa fora do Next); um teste
 *  em leitura-registro.test.ts prende a igualdade. */
export const TETO_LINHAS_DIA_DA_JANELA = 5000

/** `linhas` e `tarefas_forja` vêm da consulta por dia do plano. Ausentes (consulta antiga) contam como zero. */
export interface DiaLido { dia_sp: string; controle: number; sem_read: number; linhas?: number; tarefas_forja?: number }
export interface DiaDaJanela {
  dia: string
  estado: 'medido' | 'nao_medido' | 'em_curso'
  motivo?: 'sem_linha_de_controle' | 'falha_de_gravacao'
  controle: number
  sem_read: number
  /** (emenda do portão: S19-I2) Tarefas da fila da forja concluídas neste dia de São Paulo. */
  tarefas_forja: number
  /** (emenda do portão: D-M10) O dia bateu no teto de linhas: a coluna `vezes` da lista está cortada para ele. */
  teto: boolean
}
export interface Janela {
  dias: DiaDaJanela[]
  dias_medidos: number
  /** Dias MEDIDOS em que a forja concluiu pelo menos uma tarefa da fila. A janela não fecha com zero. */
  dias_com_tarefa: number
  fechada: boolean
  linhas_sem_read: number
  frase: string
}

const proximo = (dia: string): string => new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const numero = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * `lidos`: uma linha por dia de São Paulo que teve registro ou tarefa da forja (a consulta por dia do plano). Dia ausente
 * da lista é dia sem linha nenhuma: "não medido", nunca "limpo". `hoje` ainda está em curso e não conta. `diasComFalha`:
 * dias em que o Sentry registrou falha de gravação do registro.
 *
 * (emenda do portão: S19-I2) A janela só fecha com 7 dias medidos E pelo menos um dia medido em que a forja concluiu uma
 * tarefa da fila. A tarefa é semanal (segundas, 08:10 UTC): sem essa regra, sete dias medidos sem a segunda-feira fechariam
 * a janela sem que o caminho completo da fila (claim, leituras, PATCH) tivesse rodado uma vez sob medição.
 */
export function montarJanela(lidos: DiaLido[], o: { desde: string; hoje: string; diasComFalha?: string[] }): Janela {
  const porDia = new Map(lidos.map(l => [l.dia_sp, l]))
  const falhas = new Set(o.diasComFalha ?? [])
  const dias: DiaDaJanela[] = []
  for (let dia = o.desde; dia <= o.hoje; dia = proximo(dia)) {
    const l = porDia.get(dia)
    const base = {
      dia,
      controle: numero(l?.controle),
      sem_read: numero(l?.sem_read),
      tarefas_forja: numero(l?.tarefas_forja),
      teto: numero(l?.linhas) >= TETO_LINHAS_DIA_DA_JANELA,
    }
    if (dia === o.hoje) dias.push({ ...base, estado: 'em_curso' })
    else if (falhas.has(dia)) dias.push({ ...base, estado: 'nao_medido', motivo: 'falha_de_gravacao' })
    else if (base.controle < 1) dias.push({ ...base, estado: 'nao_medido', motivo: 'sem_linha_de_controle' })
    else dias.push({ ...base, estado: 'medido' })
  }
  const medidos = dias.filter(d => d.estado === 'medido')
  const dias_medidos = medidos.length
  const dias_com_tarefa = medidos.filter(d => d.tarefas_forja > 0).length
  const linhas_sem_read = dias.reduce((s, d) => s + d.sem_read, 0)
  const fechada = dias_medidos >= DIAS_MEDIDOS_PARA_FECHAR && dias_com_tarefa >= 1
  const frase = dias_medidos < DIAS_MEDIDOS_PARA_FECHAR
    ? `${dias_medidos} dias medidos de ${DIAS_MEDIDOS_PARA_FECHAR}: a recusa não sobe`
    : dias_com_tarefa === 0
      ? `${dias_medidos} dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe`
      : linhas_sem_read === 0
        ? `${dias_medidos} dias medidos e nenhuma leitura sem read: a recusa pode subir`
        : `${dias_medidos} dias medidos; ${linhas_sem_read} leitura(s) sem read: decidir linha a linha antes da recusa`
  return { dias, dias_medidos, dias_com_tarefa, fechada, linhas_sem_read, frase }
}
```

- [ ] **Step 4: Criar `scripts/e19-janela.ts`** (lê da entrada padrão a saída de `supabase db query`, que traz texto antes e depois do JSON). *(emenda do portão: D-M11, S19-M1: o script não roda sem a declaração dos dias com falha de gravação; quem esquece de buscar no Sentry não ganha um dia medido de graça.)*

```ts
// Uso: npx supabase db query --linked "<consulta por dia do plano da E19>" | npx tsx scripts/e19-janela.ts <desde AAAA-MM-DD> --falhas=<nenhuma | AAAA-MM-DD,AAAA-MM-DD>
import { montarJanela, type DiaLido } from '../apps/web/src/lib/pipeline/leitura-janela'

const [desde, argFalhas, ...resto] = process.argv.slice(2)
if (!desde || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
  console.error('informe o primeiro dia da janela (AAAA-MM-DD)')
  process.exit(2)
}
if (!argFalhas?.startsWith('--falhas=') || resto.length > 0) {
  console.error('informe --falhas=nenhuma (depois de buscar no Sentry por action:leitura_registro tipo:gravacao no período) ou --falhas=AAAA-MM-DD,AAAA-MM-DD')
  process.exit(2)
}
const valorFalhas = argFalhas.slice('--falhas='.length)
const diasComFalha = valorFalhas === 'nenhuma' ? [] : valorFalhas.split(',')
if (valorFalhas !== 'nenhuma' && (diasComFalha.length === 0 || diasComFalha.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)))) {
  console.error('--falhas= aceita "nenhuma" ou dias AAAA-MM-DD separados por vírgula')
  process.exit(2)
}
let entrada = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c: string) => { entrada += c })
process.stdin.on('end', () => {
  const ini = entrada.indexOf('{')
  const fim = entrada.lastIndexOf('}')
  if (ini < 0 || fim < ini) {
    console.error('a entrada não tem o JSON da consulta: nada foi concluído')
    process.exit(2)
  }
  const corpo = JSON.parse(entrada.slice(ini, fim + 1)) as { rows?: DiaLido[] }
  if (!Array.isArray(corpo.rows)) {
    console.error('a consulta não devolveu "rows": nada foi concluído')
    process.exit(2)
  }
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const j = montarJanela(corpo.rows, { desde, hoje, diasComFalha })
  for (const d of j.dias) {
    console.log(`${d.dia}  ${d.estado.padEnd(10)}  controle=${d.controle}  sem_read=${d.sem_read}  tarefas_forja=${d.tarefas_forja}${d.motivo ? `  (${d.motivo})` : ''}${d.teto ? '  (contagem cortada pelo teto)' : ''}`)
  }
  console.log(`dias medidos: ${j.dias_medidos}; com tarefa da forja: ${j.dias_com_tarefa}; falhas de gravação declaradas: ${valorFalhas}`)
  console.log(j.frase)
  process.exit(j.fechada && j.linhas_sem_read === 0 ? 0 : 1)
})
```

- [ ] **Step 5: Rodar o teste e o script com a consulta de produção (hoje sem nenhuma linha do registro).**

Run: `cd apps/web && npx vitest run test/lib/pipeline/leitura-janela.test.ts` → PASS.

A consulta por dia *(emenda do portão: S19-I2, D-M10; RODADA em produção em 12/10 com a data de corte em 01/10: devolve os dias 05/10 e 12/10 com `tarefas_forja = 1` e zero linhas do registro)*. Trocar `<avisoDesde>` pelo valor de `leitura-modo.ts`:

```bash
npx supabase db query --linked "with l as (select (created_at at time zone 'America/Sao_Paulo')::date as dia_sp, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'true') as controle, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'false') as sem_read, count(*) as linhas from audit_log where action in ('pipeline_leitura_aviso','pipeline_leitura_recusada') group by 1), t as (select (completed_at at time zone 'America/Sao_Paulo')::date as dia_sp, count(*) as tarefas_forja from youtube_intelligence_tasks where completed_at >= '<avisoDesde>T03:00:00Z' group by 1) select coalesce(l.dia_sp, t.dia_sp) as dia_sp, coalesce(l.controle, 0) as controle, coalesce(l.sem_read, 0) as sem_read, coalesce(l.linhas, 0) as linhas, coalesce(t.tarefas_forja, 0) as tarefas_forja from l full join t using (dia_sp) order by 1" | npx tsx scripts/e19-janela.ts <avisoDesde> --falhas=nenhuma; echo "saida=$?"
```

Expected (antes do lote 1): nenhum dia medido (nenhuma linha de dia, ou só `em_curso`), a frase `0 dias medidos de 7: a recusa não sobe`, `saida=1`. É a prova de que zero linhas não vira "limpo". Sem o `--falhas=`: mensagem de uso e `saida=2`.

- [ ] **Step 6: Commit.** `git commit -m "feat: janela de medição do modo aviso (dia sem controle é não medido) e o comando que monta o veredito (A5, E19, item 208)" -- apps/web/src/lib/pipeline/leitura-janela.ts scripts/e19-janela.ts apps/web/test/lib/pipeline/leitura-janela.test.ts`

---

### Task 7: fecho do lote 1 (o "commit 1" do spec)

**Files:**
- Modify: `apps/web/src/lib/pipeline/leitura-modo.ts` (só `avisoDesde`, se o envio não for em 13/10)
- Modify: `docs/ops/forja-fila-inteligencia-runbook.md:36` *(emenda do portão: S19-M5, S19-M8)*
- Modify: `apps/web/src/lib/conferencias.ts`, se já existir (Tarefa 6 do plano da E20); senão, `.superpowers/sdd/a5/conferencias-com-data.md` *(emenda do portão: CTRL-c, S19-I3)*
- Test: `apps/web/test/lib/pipeline/leitura-modo.test.ts` (novo)

- [ ] **Step 1: Teste que prende o que vai a produção neste lote.**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { modoLeitura } from '@/lib/pipeline/leitura-modo'

describe('o que está publicado (E19)', () => {
  it('lote 1: modo aviso, janela aberta, sem conferência de recusa', () => {
    expect(modoLeitura()).toMatchObject({ modo: 'aviso', controleFechadoEm: null, conferenciaAte: null })
    expect(modoLeitura().avisoDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

  *(emenda do portão: D-M10)* E, em `leitura-registro.test.ts`, um teste a mais (lá os módulos de Sentry e de banco já estão simulados): `import { TETO_LINHAS_DIA_DA_JANELA } from '@/lib/pipeline/leitura-janela'` e `it('o teto que a janela usa para marcar o dia é o mesmo do registrador', () => { expect(TETO_LINHAS_DIA_DA_JANELA).toBe(TETO_LINHAS_DIA) })`.

- [ ] **Step 2b** *(emenda do portão: CTRL-c, S19-I3; item 246 do spec; fazer depois do Step 2, quando `avisoDesde` estiver certo)*: **As conferências com data da E19 ganham dono durável, no commit do deploy.** O mecanismo (`apps/web/src/lib/conferencias.ts`, com o cron diário listando as vencidas em `coleta.conferencias_vencidas`) é criado pela Tarefa 6 do plano da E20, que não depende da MG13. Com `D` = `avisoDesde`:
  - **Se `apps/web/src/lib/conferencias.ts` já existe** (`test -f`): acrescentar à lista `CONFERENCIAS`, neste commit, as entradas `e19-d1` (`D` + 1 dia; contagem do dia 0 por chave, telas sem as linhas, tamanho de `audit_log`), `e19-veredito` (`D` + 8 dias; lista e veredito da janela, Tarefa 8), `e19-15o-dia` (`D` + 14 dias; se a recusa não subiu, avisar o dono: o registro já está reduzido) e `e19-30o-dia` (`D` + 30 dias, 12/11 para o lote 1 em 13/10, responsável `dono`; escolher entre subir a recusa e congelar o controle), todas com `etapa: 'E19'`, `feitaEm: null` e `onde` apontando para este plano. O commit da Tarefa 6 da E20 vai no mesmo envio do lote 1, se ainda não tiver subido.
  - **Se não existe:** as quatro datas já estão em `.superpowers/sdd/a5/conferencias-com-data.md` (escritas na emenda, para o lote 1 em 13/10); corrigir as datas lá se `avisoDesde` mudou, e deixar no ledger da etapa a linha "mover as entradas da E19 para `lib/conferencias.ts` quando a Tarefa 6 da E20 for commitada". A dependência é declarada: enquanto o arquivo não estiver em produção, quem lembra é o `.md`, lido no começo de cada sessão da A5, não o cron.
  - A entrada da conferência de 48 horas (`e19-t0-48h`) entra na Tarefa 9, com a data real da promoção.

- [ ] **Step 2c** *(emenda do portão: S19-M5, S19-M8)*: **Runbook da forja** (`docs/ops/forja-fila-inteligencia-runbook.md`, não é documento do Cowork). Linha 36: onde está "permissões `{read,intelligence}`", passar a "permissões `{intelligence}`" (é o que produção tem, medido em 12/10). E uma linha nova logo abaixo da tabela: "Desde a E19 da A5, chave sem `read` não lê as rotas de leitura do pipeline. A chave `forja (fila)` só passa nas rotas de `authenticateIntel` e em `GET youtube/channels`. A lista da fase 2 do `sitio.py` permite à fila as 13 rotas de leitura da fase 1, mas nenhum código as chama: um cartão futuro que as use com a chave da fila recebe 403; a leitura tem de ir com `SITIO_CHAVE` (a chave `{read}`)."

- [ ] **Step 2:** Acertar `avisoDesde` para o dia de São Paulo do envio. Rodar: `cd apps/web && npx vitest run test/lib/pipeline test/api/pipeline/e19-varredura-rotas.test.ts test/app/admin/audit-filtros.test.ts > /tmp/e19-t7.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e19-t7.log` e `npm run typecheck -w apps/web > /tmp/e19-tc.log 2>&1; tail -5 /tmp/e19-tc.log`. Expected: tudo verde.

- [ ] **Step 3:** Suíte inteira em background com saída em arquivo (leva cerca de 160 s): `cd apps/web && npx vitest run > /tmp/e19-suite.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e19-suite.log | head -30`. Expected: sem falha nova (comparar com as falhas que já existiam antes do lote, se houver).

- [ ] **Step 4: Commit e devolução.** `git commit -m "test: prende o modo publicado da leitura do pipeline em aviso (A5, E19, lote 1)" -- apps/web/src/lib/pipeline/leitura-modo.ts apps/web/test/lib/pipeline/leitura-modo.test.ts apps/web/test/lib/pipeline/leitura-registro.test.ts docs/ops/forja-fila-inteligencia-runbook.md` (mais `apps/web/src/lib/conferencias.ts`, se o Step 2b o tocou). Devolver ao controlador: lote 1 pronto para o envio separado. *(emenda do portão: S19-I4)* **No envio, anotar no ledger quanto tempo o CI levou** (do push ao verde) e o SHA de `origin/main` antes e depois da promoção: é o número que o roteiro de volta da Tarefa 10 usa.

**Critério de pronto do lote 1:** itens 207 e 208 (parte de teste) cobertos; varredura verde; nenhum arquivo de `docs/cowork-*`, `pipeline-docs/` ou `api-registry.ts` no `git diff --stat` do lote.

---

### Task 8: os 7 dias medidos (operação; nenhuma linha de código, salvo o caso da forja)

**Files:** Modify: `.superpowers/sdd/a5-e19/progress.md`

- [ ] **Step 1: A primeira linha do registro, sem `curl` do agente** *(emenda do portão: CTRL-a, S19-I6)*. **O agente não lê `PIPELINE_COWORK_KEY` nem chama a API com ela.** O spec (8.2) diz que a leitura de controle é do dono; o plano que foi ao portão a tinha passado ao controlador sem declarar. Volta a ser do dono, e opcional: os dois comandos estão em "O que é do DONO", item 5.

  Dez minutos depois da promoção, e no começo de cada sessão da janela, só leitura do banco:

```bash
npx supabase db query --linked "select after_data->>'key_name' as chave, after_data->>'rota' as rota, after_data->>'tem_read' as tem_read, created_at from audit_log where action = 'pipeline_leitura_aviso' order by created_at desc limit 3"
```

  Três desfechos:
  - **Há linha** de alguma chave: o registro está provado em produção. Conferir os campos (`chave`, `rota` sem query string, `tem_read`).
  - **Não há linha e ninguém leu com chave** (o Cowork não abriu sessão pela API; o dono não rodou o `curl`): o dia é "não medido" e o registro **ainda não foi provado em produção**. Não é defeito e não se conserta nada; a prova de que a gravação funciona é, até lá, o teste de integração da Tarefa 5. Anotar no ledger "D0 sem leitura por chave".
  - **Não há linha e houve leitura** (o dono rodou o `curl` e recebeu `200`, ou `last_used_at` de `forja (so leitura)` avançou): **o registro está mudo. Parar, olhar o Sentry (`action:leitura_registro`) e consertar antes de contar qualquer dia.** Nada foi cortado: é modo aviso.

- [ ] **Step 2: D+1, a contagem do dia 0 (OP-6) e as telas.** `npx supabase db query --linked "select (created_at at time zone 'America/Sao_Paulo')::date as dia_sp, after_data->>'key_name' as chave, count(*) as linhas from audit_log where action = 'pipeline_leitura_aviso' group by 1, 2 order by 1, 2"`. Anotar no ledger. Abrir o painel do CMS e `/admin/audit`: nenhuma linha `pipeline_leitura_aviso` (o dono confere, ou um subagente Sonnet com navegador). Tamanho: `npx supabase db query --linked "select pg_total_relation_size('public.audit_log') as bytes, count(*) as linhas from audit_log"` (base: 204.800 bytes, 140 linhas).

- [ ] **Step 3: No dia em que houver 7 dias completos medidos (21/10 no mínimo), o veredito.**

*(emenda do portão: S19-I2, S19-M1, D-M11)* **Antes de rodar: os dias com falha de gravação.** Quem busca é o controlador da sessão do veredito (com um subagente Sonnet de navegador, ou pedindo ao dono, que tem o Sentry aberto): no Sentry, busca de eventos com `action:leitura_registro tipo:gravacao`, do dia `avisoDesde` até hoje; anotar no ledger os dias de São Paulo com evento (ou "nenhum evento no período", com a hora da busca). **Sem essa busca o script não roda:** ele exige `--falhas=nenhuma` ou `--falhas=<dias>`. Se o Sentry não puder ser consultado, o veredito espera.

A consulta por dia é a da Tarefa 6, Step 5 (com `<avisoDesde>` trocado), que traz também `linhas` e `tarefas_forja`:

```bash
npx supabase db query --linked "<a consulta por dia da Tarefa 6, Step 5>" | npx tsx scripts/e19-janela.ts <avisoDesde> --falhas=<nenhuma | AAAA-MM-DD,AAAA-MM-DD>
```

O veredito só vale com **7 dias medidos e pelo menos um deles com tarefa da forja concluída** (a linha `dias medidos: N; com tarefa da forja: M` da saída). Para o ledger, as tarefas da janela, uma a uma (RODADA em produção em 12/10 com corte em 01/10: duas tarefas, 05/10 e 12/10):

```bash
npx supabase db query --linked "select id, status, completed_at, (completed_at at time zone 'America/Sao_Paulo')::date as dia_sp from youtube_intelligence_tasks where completed_at >= '<avisoDesde>T03:00:00Z' order by completed_at"
```

Dia marcado com "contagem cortada pelo teto": anotar; nesses dias a coluna `vezes` da lista abaixo está subcontada (a presença de `tem_read = false` não).

E a lista do spec:

```bash
npx supabase db query --linked "select (after_data->>'key_name') as chave, (after_data->>'rota') as rota, (after_data->>'metodo') as metodo, (after_data->>'tem_read') as tem_read, count(*) as vezes, min(created_at) as primeira, max(created_at) as ultima from audit_log where action = 'pipeline_leitura_aviso' group by 1,2,3,4 order by 1,2"
```

As três saídas vão inteiras para o ledger (item 208), com o número de linhas de controle por dia, os dias com tarefa da forja e o resultado da busca no Sentry.

- [ ] **Step 4: Decisão, linha a linha (pergunta 43, já respondida).**
  - Veredito "a recusa pode subir" (janela fechada, zero `tem_read = false`): seguir para a Tarefa 9. Não há o que perguntar ao dono; avisar que sobe.
  - Linha `tem_read = false` da chave `forja (fila)`: levar ao dono as duas saídas possíveis. (a) A rota é da fila: trocar o helper daquele handler para `authenticateReadOrIntel` (um commit, com teste que acrescenta a rota a `EXCECOES_INTELLIGENCE` na varredura), esperar um dia medido com ela zerada, e então a Tarefa 9. (b) A forja passa a usar `SITIO_CHAVE` para aquela leitura: o agente prepara os comandos, um por linha; o dono cola. **Nenhuma chave ganha permissão.**
  - Linha `tem_read = false` de qualquer outra chave: fica cortada (é o que o dono mandou). Registrar no ledger.
  - Veredito "a recusa não sobe": continuar medindo; no 15º dia corrido, avisar o dono.
  - *(emenda do portão: S19-I2)* Veredito "N dias medidos, nenhum com tarefa da forja concluída": falta um dia medido em que a fila rodou. A próxima tarefa é na segunda-feira seguinte, 08:10 UTC; para o dia contar é preciso uma leitura com `read` nele (o Cowork pela API, ou o `curl` do dono). Avisar o dono da data, uma linha, na véspera. Se a fila ficar duas segundas sem tarefa nenhuma, é assunto do runbook da forja, não deste plano: levar ao dono.

- [ ] **Step 5 (só se a recusa não for subir no mesmo dia):** commit de uma linha, `controleFechadoEm: '<dia do veredito>'`, com o teste da Tarefa 7 ajustado para o valor, para as linhas de controle pararem.

---

### Task 9: a recusa (o "commit 2" do spec; um commit só, revertível)

**Files:**
- Modify: `apps/web/src/lib/pipeline/leitura-modo.ts` (`modo`, `controleFechadoEm`, `conferenciaAte`)
- Modify: `apps/web/test/lib/pipeline/leitura-modo.test.ts`

Pré-condição: Tarefa 8 com o veredito "a recusa pode subir" no ledger, e a varredura verde.

*(emenda do portão: CTRL-b, S19-I4, S19-R1)* **Precondições da promoção** (o commit pode ser feito sem elas; a promoção a `main`, não):

1. **Sessão do agente aberta e dono avisado pelas 2 horas seguintes.** O plano que foi ao portão dizia "de preferência". É condição: sem as duas coisas a recusa espera outro dia. O aviso ao dono é uma mensagem com a hora prevista e o lembrete dos dois comandos do `curl` de controle ("O que é do DONO", item 5), que ele pode rodar aos 20 minutos e às 2 horas.
2. **O commit 2 é promovido sozinho:** `git diff --stat origin/main <NOVO do commit 2>` lista só `leitura-modo.ts` e `leitura-modo.test.ts`. Se `origin/staging` tiver outra coisa esperando promoção, ela é promovida antes, em outro deploy. Assim o deploy anterior de produção é exatamente o lote 1 em modo aviso, e o "Instant Rollback" do dono significa o que parece.
3. **O roteiro de volta está no ledger, preenchido** (Step 4).
4. **O kit da forja é o mesmo que foi medido** (leitura; RODADA em 12/10): `ssh forja 'grep -o "/api/pipeline/[a-zA-Z0-9_/{}-]*" /opt/agente/docs/trilha/fila_intel.py /opt/agente/docs/trilha/leituras_obs.py | sort | uniq -c'`. Esperado, como em 12/10: `youtube/channels`, `youtube/intelligence`, `youtube/intelligence/task/`, `youtube/intelligence/task/claim` e `youtube/competitors/readings`, e nenhuma outra. Rota nova na lista: o kit mudou depois da janela; a recusa não sobe até um dia medido com o kit novo.

- [ ] **Step 1: Trocar o teste do valor publicado (falha).**

```ts
  it('lote 2: modo recusa, com a conferência de 48 horas marcada', () => {
    const c = modoLeitura()
    expect(c.modo).toBe('recusa')
    expect(c.conferenciaAte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(c.controleFechadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
```

- [ ] **Step 2: Mudar a configuração.** Em `leitura-modo.ts`: `modo: 'recusa'`, `controleFechadoEm: '<dia do veredito>'`, `conferenciaAte: '<instante do envio + 48 h, em ISO UTC>'`. Nada mais muda: o caminho da recusa está no ar, testado, desde o lote 1.

- [ ] **Step 3: Rodar.** `cd apps/web && npx vitest run test/lib/pipeline test/api/pipeline/e19-varredura-rotas.test.ts > /tmp/e19-t9.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e19-t9.log` e o typecheck. Expected: verde.

- [ ] **Step 4: Commit único.** `git commit -m "feat: chave sem read deixa de ler o pipeline (A5, E19, commit 2; reverter este commit volta ao modo aviso)" -- apps/web/src/lib/pipeline/leitura-modo.ts apps/web/test/lib/pipeline/leitura-modo.test.ts`. Anotar o SHA no ledger: é o que se reverte. *(emenda do portão: CTRL-b, S19-I4)* **Antes de devolver ao controlador, copiar para o ledger o roteiro de volta da Tarefa 10, Step 4, com tudo preenchido:** o SHA local do commit 2; depois do envio a `staging`, o SHA dele em `origin/staging` (é o `C2` do roteiro); o SHA de `origin/main` antes da promoção; e o tempo de CI medido no lote 1. Acrescentar a entrada `e19-t0-48h` (data da promoção + 2 dias) a `lib/conferencias.ts`, se existir, ou a `.superpowers/sdd/a5/conferencias-com-data.md`. Devolver ao controlador para o envio, logo depois de um ciclo da forja (minutos terminados em 0), **com as quatro precondições acima cumpridas**.

---

### Task 10: conferência do dia da promoção (item 210) e plano de volta

**Files:** Modify: `.superpowers/sdd/a5-e19/progress.md`

- [ ] **Step 1: Anotar o instante da promoção** (`T0`, UTC) no ledger.

- [ ] **Step 2: T0 + 20 min. Controle positivo e prova de aceite.**
  1. *(emenda do portão: CTRL-a)* **Controle positivo: é do dono.** Se ele rodou o `curl` ("O que é do DONO", item 5) depois de `T0`, ou o Cowork leu pela API, o item 2 traz a linha de controle. Se ninguém leu, **não há controle positivo do registro**, e a conferência se apoia nos itens 3 e 4, que não dependem dele: a forja registra `desfecho: chave` no log dela quando leva 403. Anotar no ledger qual dos dois casos foi. O agente não roda o `curl`.
  2. `npx supabase db query --linked "select action, after_data->>'key_name' as chave, after_data->>'rota' as rota, after_data->>'tem_read' as tem_read, created_at from audit_log where action in ('pipeline_leitura_aviso','pipeline_leitura_recusada') and created_at > '<T0>' order by created_at"`. Esperado: pelo menos a linha de controle do `curl` (`pipeline_leitura_aviso`, `cowork-permanent`, `true`) e **zero** linhas `pipeline_leitura_recusada` de `forja (fila)`, `forja (so leitura)` e `cowork-permanent`. Sem a linha de controle, zero recusas no banco não prova nada sobre o registro: vale então só o que os itens 3 e 4 mostram, e isso fica escrito no ledger ("aceite pela forja, sem controle positivo do registro").
  3. `npx supabase db query --linked "select name, last_used_at from pipeline_api_keys where revoked_at is null order by name"`: `forja (fila)` com `last_used_at` posterior a `T0` (ela consulta a fila a cada 10 minutos). Lembrar: `last_used_at` prova que o pedido **chegou**, não que foi aceito (é gravado antes da permissão); a prova de aceite é a ausência de linha de recusa com o controle vivo.
  4. Leitura na forja: `ssh forja 'tail -n 3 /opt/agente/log/fila_intel.err'` e o estado do check da fila no healthchecks (o dono vê, ou o runbook da forja, seção de vigilância). Um `desfecho: chave` depois de `T0` é recusa.
  5. Se houver tarefa concluída depois de `T0` (`select id, status, completed_at from youtube_intelligence_tasks where completed_at > '<T0>'`), anotar como prova a mais. Fila vazia **não** é defeito.

- [ ] **Step 3: T0 + 2 h. Repetir os itens 2 a 4** e fechar no ledger com os horários.

- [ ] **Step 4: Plano de volta, se algum sinal acusar** (linha `pipeline_leitura_recusada` de uma das três chaves, `desfecho: chave` na forja, ou `last_used_at` da fila parado por 2 horas com a forja de pé). *(emenda do portão: CTRL-b, S19-I4. O roteiro abaixo é copiado para o ledger, com os SHAs preenchidos, na Tarefa 9, Step 4, ANTES da promoção: na hora da volta ninguém improvisa.)*

  **Caminho do agente** (o `git revert` do spec, feito por cima de `origin/staging`, porque a `staging` local leva os commits da A4 inacabada e não pode subir). Só cria objetos; não toca o índice, a árvore de trabalho nem branch. A sintaxe do `merge-tree` invertido foi provada em 12/10 num commit qualquer do repositório (devolve a árvore com o diff do commit espelhado).

  1. Montar o revert (cerca de 1 minuto):

```bash
bash <<'VOLTA'
set -euo pipefail
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git fetch origin
C2=<SHA do commit 2 em origin/staging, do ledger>
BASE=$(git rev-parse origin/staging)
git merge-base --is-ancestor "$C2" "$BASE"                           # o commit 2 está em origin/staging; senão o script para aqui
T=$(git merge-tree --write-tree --merge-base="$C2" "$BASE" "$C2^")    # aplica o INVERSO do commit 2 sobre origin/staging
NOVO=$(git commit-tree "$T" -p "$BASE" -m "revert: chave sem read volta a ler o pipeline em modo aviso (A5, E19; desfaz $C2)")
git diff --stat "$BASE" "$NOVO"                                      # esperado: só leitura-modo.ts e leitura-modo.test.ts
git show "$NOVO:apps/web/src/lib/pipeline/leitura-modo.ts" | grep -n "modo:"   # esperado: modo: 'aviso'
echo "NOVO=$NOVO"
VOLTA
```

  2. Enviar para `staging` (pre-push de cerca de 1 minuto; sem `--force`; se o remoto andou, refazer desde o `fetch`):

```bash
bash -c 'git push origin "$0:refs/heads/staging"' "<NOVO>"
```

  3. Esperar o CI do push ficar verde (`gh run list --branch staging --limit 1`; a duração real do CI é a anotada no ledger no envio do lote 1, Tarefa 7). O revert devolve os dois arquivos ao conteúdo do lote 1, que já passou pelo CI; mesmo assim não se promove sem o verde.

  4. Promover a `main`, do mesmo jeito que a E12 e o lote 1 (árvore de `staging`, pais `main` e `staging`):

```bash
bash <<'PROMOVE'
set -euo pipefail
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git fetch origin
M=$(git commit-tree "$(git rev-parse 'origin/staging^{tree}')" -p "$(git rev-parse origin/main)" -p "$(git rev-parse origin/staging)" -m "chore: promove staging a main (volta da recusa da E19)")
bash -c 'git push origin "$0:refs/heads/main"' "$M"
PROMOVE
```

  5. Esperar o deploy de produção ficar "Ready" na Vercel (build de cerca de 2 minutos, medido em 12/10).

  6. **Conferir que voltou** (leitura):
     - `npx supabase db query --linked "select action, after_data->>'key_name' as chave, after_data->>'rota' as rota, created_at from audit_log where action in ('pipeline_leitura_aviso','pipeline_leitura_recusada') and created_at > '<instante do deploy da volta>' order by created_at"`: nenhuma `pipeline_leitura_recusada` nova; a chave que tinha sido cortada reaparece com `pipeline_leitura_aviso` e `tem_read = false` na leitura seguinte dela.
     - `ssh forja 'tail -n 3 /opt/agente/log/fila_intel.err'`: sem `desfecho: chave` depois do deploy.
     - `npx supabase db query --linked "select name, last_used_at from pipeline_api_keys where revoked_at is null order by name"`: a fila avançando.

  7. Trazer o revert para a `staging` local: `git fetch origin` e `git merge --no-edit origin/staging` (roteiro da E12, "Volta para a `staging` local").

  **Tempo esperado, do sinal à produção de volta:** 20 a 30 minutos, quase todo do CI. Nesse intervalo a chave cortada fica recebendo 403: a fila da forja roda a cada 10 minutos e tenta de novo sozinha; nenhum dado se perde (o relatório dela fica na fila).

  **Caminho do dono, opcional e mais rápido:** "Instant Rollback" do deploy anterior na Vercel ("O que é do DONO", item 6). Vale porque o commit 2 foi promovido sozinho (Tarefa 9): o deploy anterior é o lote 1 em modo aviso. **Não desfaz o commit:** os passos 1 a 7 acima são feitos em seguida do mesmo jeito, senão o próximo deploy de `main` religa a recusa. O agente não faz o rollback.

  O modo aviso volta a medir (as linhas de controle voltam se `controleFechadoEm` for devolvido a `null`: o revert do commit 2 já faz isso quando a Tarefa 8, Step 5, não foi usada). Nenhuma chave e nada na forja são tocados. A chave do perfil `observatorio_leitura` continua recusada (regra da Tarefa 2). Registrar no ledger a linha que causou a volta: ela é a entrada da decisão da Tarefa 8, Step 4. **Depois de uma volta o estado é "modo aviso, já reduzido, sem data para a recusa":** gravar em `.superpowers/sdd/a5/conferencias-com-data.md` (e em `lib/conferencias.ts`, se já existir) a entrada `e19-depois-da-volta`, com a data de 7 dias depois e o dono como responsável pela decisão.

- [ ] **Step 5: T0 + 48 h.** Conferir que as linhas de controle pararam (`select max(created_at) from audit_log where action = 'pipeline_leitura_aviso'` anterior a `conferenciaAte`) e marcar a E19 como concluída no ledger: a partir daqui o degrau 2 da E17 pode começar.

---

## Conferências com data (lote 1 em 13/10/2026; deslocar se o envio atrasar)

*(emenda do portão: CTRL-c, S19-I3)* **Onde estas datas vivem:** em `apps/web/src/lib/conferencias.ts` (Tarefa 6 do plano da E20; o cron diário lista as vencidas em `coleta.conferencias_vencidas`), preenchidas no commit do deploy (Tarefa 7, Step 2b); e em `.superpowers/sdd/a5/conferencias-com-data.md`, que vale desde 12/10 e é o que a sessão lê enquanto o arquivo de código não está em produção. O responsável de cada uma está na tabela daquele arquivo; "o controlador da sessão do dia" deixou de ser o único lembrete.

| Quando | O quê | Esperado |
|---|---|---|
| 13/10, envio + 10 min | Tarefa 8, Step 1 | há linha do registro, ou "D0 sem leitura por chave" no ledger (sem `curl` do agente) |
| 14/10 | Tarefa 8, Step 2 | contagem por chave do dia 0 no ledger; painel e `/admin/audit` sem as linhas; tamanho de `audit_log` |
| 19/10 (segunda) | a tarefa semanal da fila roda às 08:10 UTC | para o dia contar, uma leitura com `read` nele; o dono é avisado na véspera |
| 21/10 (no mínimo) | Tarefa 8, Step 3 e 4; Tarefa 9 | veredito (7 dias medidos e um com tarefa da forja) e lista no ledger; recusa enviada, se as precondições da Tarefa 9 valerem |
| mesmo dia, + 20 min e + 2 h | Tarefa 10 | zero recusa das três chaves, controle vivo, fila consultando |
| + 48 h | Tarefa 10, Step 5 | controle parado; E19 concluída |
| 27/10 (15º dia) | se a recusa não subiu | avisar o dono; o registro já está reduzido |
| 12/11 (30º dia) | se ainda aberto | escolha do dono: subir a recusa ou congelar o controle |

## Fora desta etapa

- Criar chave do perfil, o servidor MCP do Observatório e o ponto único de validade (`expires_at`): E17, degrau 2. A E19 só deixa a regra de recusa do perfil pronta.
- `/api/mcp`: já exige `read` (`route.ts:33`); a E19 não o toca. As leituras do Cowork pelo MCP não passam por `authenticateRead` e não geram linha.
- Registrar leituras de `authenticateReadOrIntel` (`youtube/channels`): a rota aceita `intelligence` por desenho; não é o que a E19 mede.
- Limpar `audit_log`: nada apaga a tabela; as linhas da E19 ficam (volume na seção própria).
- *(emenda do portão: S19-M4)* Fechar `/api/mcp` para uma chave com `observatorio_leitura` **e** `read`: item 235 da E17 (pendência no ledger, Tarefa 0, Step 4). A regra da Tarefa 2 vale em `/api/pipeline/*`.
- *(emenda do portão: S19-M6)* Trocar o `code` da recusa do perfil de `UNAUTHORIZED` para `FORBIDDEN`: mudaria o contrato de erro de todas as rotas; fica como está.
- *(emenda do portão: S19-M5)* Corrigir `apps/web/data/pipeline-docs/cowork-docs-youtube.md:161`: é documento do Cowork, do dono.
