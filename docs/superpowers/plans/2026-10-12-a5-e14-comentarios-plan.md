# A5, etapa E14: comentários de destaque dos vídeos de concorrentes (coleta e dado)

> Plano de implementação. Ordem 6 da Sequência v2.3. Migration: **MG8** (lote B, depois da MG10 e da MG9). Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/02-comentarios-de-destaque.md` (4.6 inteira; itens 107 a 127, 144 a 149, 232 e 233). Escrito em 12/10/2026 (noite) e **emendado no portão em 12/10/2026, 23h30 de São Paulo**, contra o HEAD local `9d806ab0` (**emenda 2 do portão, 13/10: HEAD `c8bfcaee`; `9d806ab0` é ancestral**; E1 e E2 fecharam o portão final; a corretiva `20261012000004` está em produção) (emenda do portão: R7, S-m7).
> Ledger da etapa: `.superpowers/sdd/a5-e14/progress.md` (a Tarefa 0 cria). O SQL validado e a saída da validação estão em `.superpowers/sdd/a5-e14/` (`mg8.sql`, `mg8-prova.sql`, `mg8-prova.out`), **já na versão emendada**. A resposta aos dois pareceres, achado por achado: `.superpowers/sdd/a5/resposta-revisao-plano-e14-comentarios.md`.
> **Como achar o que mudou:** todo trecho emendado traz "(emenda do portão: código)". Os códigos: `D-…` é o parecer de dados, `S-…` o de software (`C` crítico, `A` ou `I` importante, `M` ou `m` menor), `R1` a `R10` são as decisões do controlador.
> **Terceira emenda em 13/10/2026, depois do fecho da emenda 2** (dados: 1 trava e 5 menores; software: 3 travas e 4 menores). Cada trecho traz "(emenda 3 do portão: código)". Códigos: `D-T1` (dados) e `S-T3` (software) são a mesma correção (a E14 acrescenta `anular_identidade` à lista `antesDoLoteAntigo`, em `agenda/executar.ts`); `S-T1` (`codigoDe` e a forma real do `rpc` abortado); `S-T2` (`motivos` de frase fixa e `fraseDe` em campo separado); `D-m1` a `D-m5` e `S-m1` a `S-m4` (menores, todos aplicados como troca de texto); `AG` (alinhamento com a seção 9.1 do plano da agenda depois da emenda 3 dele: `S3-T1`, `S3-T2`, `S3-m2`); `dec. 61` (as respostas do dono). **O Apêndice A (SQL da MG8) não mudou.**
> **Quarta emenda em 13/10/2026, depois do fecho da emenda 3** (dados: CONCORDO com uma condição e 4 menores; software: NÃO CONCORDO, 1 trava, 1 condição e 5 menores). Cada trecho traz "(emenda 4 do portão: código)". Códigos: `S4-T1` (software: de qual chave de `numeros` sai cada número de `fraseDe`, e o que ela devolve sem o número); `D4-C` e `S4-C` (a condição da Tarefa 12 sobre `prova_ilegivel` × `schema_nao_conferido`, que os dois pareceres descrevem: a troca vale **só** para a prova do começo da coleta, e a frase é a mesma nas três origens); `D4-m1` a `D4-m4` e `S4-m1` a `S4-m5` (menores aplicados como troca de texto; o resto está na seção 14). **O Apêndice A (SQL da MG8) não mudou. Nenhum teste foi criado nem removido: as contagens seguem 10 (Tarefa 2), 17 (8), 27 (9) e 13 (12); os acréscimos entram dentro de testes existentes.**

**Objetivo.** Guardar, de cada vídeo novo de concorrente, um retrato de cerca de 12 comentários nas idades de 1, 7 e 30 dias (os mais curtidos entre os lidos, os que têm o criador e os de autor de destaque), com as curtidas por idade. A identidade de quem comentou (nome, id do canal, foto) fica numa tabela à parte, que só quem edita lê, e é apagada aos 28 dias por uma rotina diária que falha em vermelho. Nada disto tem tela nesta etapa: é coleta, dado e prova.

**Fica FORA (e onde entra):**

| Fora | Onde entra |
|---|---|
| O leitor de tela e a seção de comentários na página do vídeo | depois do passo 0 da E17 (ordem 9: nasce com o token `LeituraPrivadaDoSite`) e do **mockup 20** aprovado |
| O aviso no cabeçalho do Observatório ("identidade de autores vencida e não apagada: N"; "retratos de comentários: N ficaram para trás") | é texto de tela: mockup 15 (E16) e mockup 20. Até lá o aviso é **cron vermelho**, que o vigia leva ao dono por **e-mail** (não se conta com push nem com o sino do CMS) (emenda do portão: R10) |
| M11 ("o criador responde") e M12 ("peso do comentário de topo") | E4 (ordem 16) |
| A fila "Saíram do YouTube" mostrando comentários, e a resposta "apagar" (`competitor_video_purge`, que não existe ainda) | E9 (ordem 18). Esta etapa só **marca** `missing_since` e respeita o que já foi apagado |
| Export por canal e mês | E10 (ordem 15). Regra que a E10 herda: a tabela de identidade **não entra** na lista do export |
| Pacote para IA ("Perguntar a uma IA") com comentários anônimos | E17, degrau 1 |
| Leitura do texto por IA (forja ou Cowork) | decisão à parte, não desta fase (4.6.8) |
| Retrato avulso dos 1.390 vídeos já guardados (marco 0) | pergunta 12 do spec: padrão "não" |
| Respostas completas das conversas escolhidas (`comments.list?parentId=`) | pergunta 11 do spec: padrão "não" |
| Comentários dos vídeos do canal do dono | pergunta 44 do spec: padrão "não entram" |
| A redação da chave de API do YouTube (`key=`) no Sentry | **fora dos planos, num commit próprio, antes de qualquer etapa** (emenda do portão: R8). Este plano só exige a redação dos ids de autor e de comentário (Tarefa 7a) |
| Recriar `competitor_channel_removal_impact` ou `youtube_channel_removal_impact` | **nenhuma migration deste plano as recria** (emenda do portão: R1; desvio 6) |

**Depende de (duro):** MG1 e MG2 em produção (estão, desde 12/10 23:31 UTC; produção está na versão `20261012000004`); o código da E1 e da E2 em `main` (a coleta lê `missing_since`, `live_*` e `comment_count` que elas mantêm); **MG8 aplicada**; o commit da redação da chave (R8) no HEAD, para a Tarefa 7a; e, só para a Tarefa 12 (ligar na agenda), a **E16 parte 1** no HEAD, com o contrato que o plano dela definir **depois da emenda dele** (emenda do portão: R4). As Tarefas 0 a 11 não esperam a E16. **C0.3 está feita** (a chave de API basta: a etapa segue). **C0.9 está feita pela metade** (a configuração foi lida; o evento com texto sentinela não foi provocado): a Tarefa 7a fecha o que falta, antes do deploy.

**Este plano não cria rota em `api/pipeline/`** e não toca `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `api-registry.ts`.

**O que pode começar JÁ, sem esperar migration, mockup nem a E16** (emenda do portão: pedido do controlador; D, recomendação 3): Tarefa 0 (ledger); Tarefa 2 (regras, tipos, erro com `codigoDe`, ordem, frases), que destrava as demais (**e é a primeira a commitar**); depois dela, ao mesmo tempo, as Tarefas 3, 4, 5, 6, 7b e 8; a Tarefa 1a (os dois testes de banco, com a MG8 aplicada **só no `bythiago_int`** a partir de `.superpowers/sdd/a5-e14/mg8.sql`); em seguida 10, 9 e 11. A Tarefa 7a começa assim que o commit da R8 existir. **Esperam (emenda 2 do portão: P1: só a Tarefa 12 espera o plano da agenda; todo o resto pode começar):** a Tarefa 1b (criar o arquivo da migration) espera a vez do lote B, depois dos arquivos da MG10 e da MG9; a Tarefa 12 espera a E16 parte 1 (e, emenda 3 do portão: D-T1, é a única que toca arquivo da agenda: `catalogo.ts` e uma entrada em `executar.ts`); a Tarefa 13 espera a 11; nada espera mockup.

---

## 1. Perguntas que só o dono responde

**(emenda 3 do portão: dec. 61) As cinco foram respondidas pelo dono em 13/10 (decisão 61 de `.superpowers/sdd/a5/decisoes-do-dono.md`); nenhuma fica aberta.** Nenhuma trava o início. Onde o spec tem padrão, vale o padrão (decisão 44). Cada linha: a pergunta, a recomendação e o que vale se ele não responder. As decisões R1 a R10 do controlador já responderam o resto (ordem das migrations, corpo único de `removal_impact`, redação da chave, aviso por e-mail).

1. **No primeiro dia, coletar também os 49 vídeos que já estão dentro da tolerância de um marco?** (medido em 13/10 02:01 UTC: 10 no marco 1, 14 no 7, 25 no 30; custo: cerca de 100 unidades, uma vez; cerca de 590 comentários e identidades de terceiros a mais.) **Recomendação: sim** (é a regra dele de 12/10, "coletar mais dado do que usa", e o retrato está dentro da tolerância do próprio spec, com a idade real gravada). **Padrão se ele não responder: não**, porque o spec diz "retroação nenhuma" e a decisão 44 manda valer o padrão do spec (emenda do portão: S-m4; a versão anterior deste plano adotava "sim" por silêncio, e isso foi revertido). **As duas respostas cabem no SQL final** (parâmetro `p_since` na lista e na prova; emenda do portão: D-A6): a resposta só muda uma constante do código (`COMMENT_SINCE`, Tarefa 2), preenchida no commit do envio; enquanto ela estiver em `'a_decidir'`, a tarefa para em vermelho e não coleta. **RESPONDIDA em 13/10 (decisão 61): sim, coletar no primeiro dia os 49 vídeos que já estão dentro da tolerância.** No commit do envio, `COMMENT_SINCE = null`; o "padrão: não" desta linha deixou de valer.
2. **Ensaio com a API real gravando só no banco local** (Tarefa 13): 3 vídeos, cerca de 10 unidades; texto e identidade ficam no `bythiago_int` só durante o ensaio. **Recomendação e padrão: fazer.** O ensaio usa **só a chave de API**: não passa por `obterToken` nem por `ensureFreshToken`, que gravariam o token renovado em produção (emenda do portão: R6). **RESPONDIDA em 13/10 (decisão 61): sim, fazer o ensaio com a API real gravando só em banco local.** Nenhum token entra neste ensaio: só a chave de API, passada na linha de comando (Tarefa 13).
3. **`competitor_comment_identity_purge` e a escrita rodam como quem chama (`security invoker`)**, não como dono (`definer`, o que o spec pede). Só o `service_role` executa as duas e ele já passa por cima da RLS. **Recomendação e padrão: `invoker`**, como as funções da MG1 e da MG2. Não muda comportamento. **RESPONDIDA em 13/10 (decisão 61): `invoker` (vale a recomendação).** O Apêndice A já está assim.
4. **Se a E16 atrasar, a E14 espera por ela** (não entra "de ponte" no lote antigo)? Cada dia de espera perde os retratos de cerca de 4 vídeos novos e, no primeiro dia, 6 do marco 30 saem da tolerância a cada 24 horas (emenda do portão: D-M1). **Recomendação e padrão: esperar; o controlador reabre se ela passar de 3 dias.** **RESPONDIDA em 13/10 (decisão 61): os comentários esperam a agenda** (sem ponte no lote antigo).
5. **Guardar, junto do retrato, contagens do lote de 100 conversas que é lido e descartado** (`pool_stats`: somas, máximos e contagens; nenhum texto, nome ou id; o banco recusa texto ali)? A API só devolve o estado de agora: o que o lote dizia no dia 1 não volta. Custo: cerca de 250 B por retrato. **Recomendação e padrão: guardar** (regra dele de 12/10) (emenda do portão: D-A7). Se ele disser não, a coluna fica nula e nada mais muda. **RESPONDIDA em 13/10 (decisão 61): guardar as contagens do lote de 100 conversas** (`pool_stats`).

**Da mesma decisão 61, e que toca este plano sem ser pergunta dele (emenda 3 do portão: dec. 61):** a MG10 e a MG9 vão ao dono sem esperar a MG8 (a MG8 continua no lote B, depois delas: R2; nada muda aqui); a `YOUTUBE_API_KEY` **não** é trocada agora (fica para o pós-conclusão, sem data): o risco 6 continua aberto.

**Saiu da lista de perguntas** (emenda do portão: S-C1): "a prova do Sentry por transporte falso em vez do evento em preview". A prova passa a ser feita com chamadas HTTP de verdade a um servidor local, dentro do SDK inicializado (Tarefa 7a e Tarefa 9, teste 23). O evento em preview só volta, e aí como **passo obrigatório antes do lote b**, se o SDK não instrumentar o `fetch` sob o vitest (a afirmação positiva do teste falha em vez de passar por não ter enviado nada).

**Aviso (não é pergunta): o que só liga depois.** Nada desta etapa espera calendário para ser escrito. O que só se **confere** depois, com data relativa a `E14_DEPLOY` em `conferencias.ts` (Tarefa 12): o dia seguinte (D+1), a medição de tamanho e cota (D+7, itens 122 e 149), o primeiro apagamento de identidade (D+29) e os primeiros retratos do marco 30 de vídeos vistos no marco 1 (D+31).

---

## 2. O que é do dono

**Uma coisa: aplicar a MG8, na vez dela dentro do lote B.** Nenhum agente roda `db:push:prod`.

**Ordem do lote B, decidida pelo controlador (emenda do portão: R2): MG10, MG9, MG8.** As duas primeiras são do plano da ordem 5 (E16 e E15 parte 1). A MG8 **não depende delas em SQL** (rodada sozinha no banco local, que não tem nenhuma das duas), mas o `db:new` carimba pela hora: **o arquivo da MG8 só é criado depois dos arquivos da MG10 e da MG9**, e nunca antes da vez do lote B (arquivo criado cedo entra no próximo `db:push:prod` de outro lote). Produção está na versão `20261012000004`.

| Passo | Quem | O quê |
|---|---|---|
| 1 | agente (Tarefa 1a, **já**) | os dois testes de integração, com a MG8 aplicada **só no `bythiago_int`** a partir de `.superpowers/sdd/a5-e14/mg8.sql` (não cria arquivo de migration) |
| 2 | agente (Tarefa 1b, **na vez do lote B**, depois dos arquivos da MG10 e da MG9) | `npm run db:new observatorio_a5_e14_comentarios_de_destaque`, cola o Apêndice A, `diff` vazio contra `mg8.sql`, `mg8-prova.sql` sem erro, V1 a V4 no banco local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`), uma vez para o lote B. **Só depois do acordo dos dois especialistas sobre este plano** (decisão 45): o Apêndice A é o texto final |
| 4 | agente | V1, V1b, V2, V3 e V4 em produção (só leitura, `npx supabase db query --linked`) e o resultado no ledger |
| 5 | agente | push do código por lista explícita de commits, e promoção (seção 9.4) |

**Nome para o `db:new`:** `observatorio_a5_e14_comentarios_de_destaque` (uma migration só).

**Janela de aplicação: fora de 12:00 a 12:20 e de 18:00 a 18:20 de São Paulo** (emenda do portão: D-M2). A frase anterior ("qualquer hora; não disputa trava com o cron") era falsa: medido pelo revisor de dados em `pg_locks`, a MG8 segura `ShareRowExclusiveLock` em `sites`, `competitor_videos` e `competitor_channels` (por causa das chaves estrangeiras) até o fim da transação, e isso conflita com qualquer escrita nessas tabelas. Dura menos de 1 segundo e o `lock_timeout = '5s'` protege os dois lados (se o cron estiver gravando, a migration falha limpa e o dono roda de novo). É a mesma janela que o plano da ordem 5 pede para a MG9.

**Consultas de conferência depois de aplicar (texto na seção 11), com o esperado:**

| Consulta | Esperado em produção depois da MG8 | Antes da MG8 (medido em 12/10) |
|---|---|---|
| V1 | `4, 4, 0, 6, 5` (tabelas com RLS, policies de leitura, policies de escrita, índices, funções) | `0, 0, 0, 0, 0` |
| V1b | `2, 2` (as duas colunas e as duas constraints da emenda) | `0, 0` |
| V2 | identidade e as duas de texto em `can_edit_site(site_id)`, o retrato em `can_view_site(site_id)` (sem a MG11); `0` funções executáveis por quem não deve | nada |
| V3 | `author_purged_at`; as sete colunas da identidade; `0` colunas de inscritos | nada |
| V4 | `0, 0, 0, 0` e `competitor_videos` com a contagem de antes | as tabelas não existem |

**Compatibilidade, nos dois sentidos.**
- **MG8 aplicada, código antigo em `main`** (pode durar dias): nada lê nem grava as quatro tabelas; as cinco funções não são chamadas. Conferido em produção em 12/10: nenhum dos nove nomes existe hoje (`to_regclass` e `pg_proc`), e `competitor_removed_items` já aceita `kind = 'comentario'` (MG1).
- **Código novo sem a MG8** (ordem invertida): a tarefa `retratos_comentarios` para em vermelho na primeira ida ao banco ("<rótulo>: migration não aplicada" (emenda 5 do portão: S5-T1) (a frase de `schema_ausente` em `frases.ts` continua existindo para o Sentry e para o teste 8, mas a agenda não a mostra)), sem chamar o YouTube; `anular_identidade` idem. Guarda na Tarefa 8, com teste.
- **MG8 com assinatura antiga** (alguém aplicou o texto de antes da emenda): as funções de lista, prova e rotina são chamadas por nome de parâmetro; assinatura que não bate devolve `PGRST202`, que o código trata como `schema_ausente` (vermelho), nunca como "nada devido". Não deve acontecer: nada foi aplicado em produção (emenda do portão: S-I7).
- **MG11 antes ou depois:** o bloco PL escolhe a policy do texto na hora da aplicação. Rodado nos dois estados no banco local (cenário C14 da seção 11, novo): sem `can_view_private_site` as duas tabelas de texto nascem em `can_edit_site`; com ela, em `can_view_private_site`; a de identidade fica em `can_edit_site` nos dois.
- **MG14, MG9 e as funções de impacto de remoção** (emenda do portão: R1): a MG8 não recria nenhuma das duas e não cria FK para `youtube_channels`. Rodado: o `md5` de `pg_get_functiondef` das duas é o mesmo antes e depois da MG8, então a ordem de aplicação entre a MG8 e qualquer migration que as recrie não muda o resultado delas.

---

## 3. Fatos medidos

**Em produção, 13/10/2026 01:33 UTC (12/10 22:33 de São Paulo), `npx supabase db query --linked`, só `select`.**

| Fato | Valor | Consulta |
|---|---|---|
| Canais acompanhados; sites com canal | 15; 1 (de 3 sites) | `count(*)`, `count(distinct site_id)` em `competitor_channels` |
| Vídeos guardados | 1.390 | `count(*)` em `competitor_videos` |
| Vídeos publicados nos últimos 37, 90 e 365 dias | 151; 365; 869 | `published_at > now() - interval …` |
| Vídeos novos por dia (90 dias) | média **4,06**; percentil 95 = **8**; máximo **10**; todos os 90 dias tiveram vídeo | agrupado pelo dia de São Paulo |
| Por canal e ano | 869 ÷ 15 = **58** nos últimos 365 dias; 365 ÷ 90 × 365 ÷ 15 = **99** no ritmo dos últimos 90 (o spec supõe 98) | conta |
| Dentro da tolerância agora | marco 1: 10 (1 a 3 dias); marco 7: 14; marco 30: 25. **49 retratos no primeiro dia** (pergunta 1) | `count(*) filter` por faixa de idade, `missing_since is null` |
| `comment_count` nos vídeos de até 90 dias | mediana 51; máximo 4.313; 137 com 100 ou mais (o lote vem cheio e há mais páginas); 226 com 1 a 99; **2 com 0** | `percentile_cont`, `count(*) filter` |
| `comment_count` nulo; `comments_disabled` verdadeiro; `discovered_at` nulo | 0; 0; **1.390** (o código da E1 ainda não está em `main`) | `count(*)` |
| Vídeos de até 37 dias com leitura mais velha que 26 h | 7 de 151 | `last_checked_at < now() - interval '26 hours'` |
| Inscritos dos 15 canais | de 258 a 4.550.000; nenhum nulo, nenhum oculto | `min`, `max`, `count(*) filter` |
| Canais do dono | 2 | `youtube_channels` |
| Linhas em `youtube_quota_usage` | 0 (a E1 ainda não gravou) | `count(*)` |
| Tamanho do banco | 171 MB | `pg_database_size` |
| Os nove nomes da MG8; `can_view_private_site`; `competitor_agenda_runs` | nenhum existe | `to_regclass`, `to_regprocedure`, `pg_proc` |

**Da conferência C0.3 (12/10, chave de API, sem OAuth), que este plano usa como contrato:** `commentThreads.list` devolve 100 conversas com `nextPageToken`; `relevance` não é ordem por curtidas (49 de 99 pares vizinhos fora de ordem); `authorChannelId` veio em 100 de 100; `replies.comments` traz **no máximo 5 respostas, as mais antigas** (76 de 100 conversas vieram parciais); `comments.list?id=` aceita **50 ids**, recusa `maxResults` (400 `unexpectedParameter`), e o id ausente **some da lista** com HTTP 200 (nunca 404); `commentsDisabled` é 403 com `reason: commentsDisabled`; `videoNotFound` é 404; e **`comment_count = 0` não é "desligado"** (41 de 41 vídeos com contagem 0 deram 200 com lista vazia).

**Medido pelo revisor de dados em produção, 13/10/2026 02:01 UTC (só `select`), e usado nesta emenda** (emenda do portão: D-M1, D-C1, D-A6):

| Fato | Valor |
|---|---|
| Retratos na tolerância agora, pela regra da prova | **49** (10, 14 e 25), como acima |
| Desses, quantos a prova já conta como atrasados (marco + 30 h) | **31** (2 no marco 1, 8 no 7, 21 no 30). É o que `retratos_atrasados` vale no primeiro disparo se a pergunta 1 for "sim" |
| Vídeos do marco 30 que saem da tolerância nas próximas 24 h | **6** (cada dia de espera perde esses, além dos 4 novos) |
| Dias com vídeo novo, de 90 | 90: a lista de devidos **nunca vem vazia** em regime (cerca de 12 linhas por dia) |
| Canais do dono em `competitor_channels` | 0 |
| Horário de publicação (90 dias, São Paulo) | picos às 03h (62), 07h (93) e 18h a 19h (64): com a tarefa às 13:00, o "marco 1" sai entre 25 e 48 h |
| Travas da MG8 (`pg_locks`, banco local) | `ShareRowExclusiveLock` em `sites`, `competitor_videos` e `competitor_channels` até o fim da transação; menos de 1 s |

**No banco local `bythiago_int` (`127.0.0.1:54422`, Postgres 17.11), dentro de `begin; … rollback;`.** (emenda do portão: R7, D-M7.) A versão anterior deste plano rodou 13 cenários em 12/10 à tarde; **a MG8 emendada foi rodada de novo em 12/10 às 23h25 de São Paulo, duas vezes**, aplicada duas vezes seguidas em cada transação (a segunda só emite "already exists, skipping"), com os cenários antigos adaptados (a função agora calcula a idade, então os vídeos envelhecem por SQL) e os novos de cada achado. Roteiro: `.superpowers/sdd/a5-e14/mg8-prova.sql`; saída: `mg8-prova.out`; **0 `ERROR`, 0 `FALHOU`**. Depois de cada `rollback`: `to_regclass` das tabelas nulo, nenhuma função da MG8, `competitor_channels` com a mesma contagem de antes (o banco estava em uso por outra suíte: havia 1 a 3 canais de teste de outra etapa, por isso o roteiro cria sites próprios). **O `bythiago_int` está na migration `20261012000003`; produção está na `…0004`** (a corretiva das provas de E1 e E2): não toca a MG8, mas a frase "todas as migrations" da regra do planejador não vale mais. O que cada cenário mostrou está na seção 11.

**NÃO medido (dito como tal):**
- **A latência das três chamadas** (`commentThreads.list` com 100 conversas, `channels.list` com 20 ids, `comments.list` com 50 ids). A C0.3 guardou forma e contagem, não tempo. A conta de tempo da seção 4 usa 0,3 a 1,0 s por chamada como hipótese; a Tarefa 13 mede.
- **A ordem de `relevance` além do primeiro item** e se ela é estável entre duas chamadas seguidas (a seleção não depende disso: reordena por curtidas).
- **Se `publishedAt` de uma estreia agendada é a hora da estreia ou a do agendamento.** O plano usa o maior entre `published_at` e `live_actual_start_at` (seção 8, desvio 3); a Tarefa 13 confere num vídeo real se houver um.
- **O tamanho real das linhas** (o spec estima 1,3 MB por canal por ano): nenhum comentário existe. É a conferência de deploy + 7 dias.
- **A regra de arredondamento de `subscriberCount`** com chave de API (o spec diz três algarismos significativos, sem conferir).
- **O Data Scrubber do projeto no Sentry** (lado do servidor) e **se a chave de API do YouTube já apareceu em algum evento**: a C0.9 não teve autorização para ler. A redação da chave daqui para a frente é do commit de fora dos planos (emenda do portão: R8).
- **Se a instrumentação de `fetch` do SDK do Sentry roda sob o vitest** (emenda do portão: S-C1): a Tarefa 7a descobre; se não rodar, o evento em preview vira obrigatório.
- **Se o YouTube responde 403 `forbidden` em `commentThreads.list` para vídeo só de membros** (decide a lista `MOTIVOS_PERDA_ACEITA`): a Tarefa 13 olha, se houver um.
- **Se a API devolve o mesmo comentário duas vezes no mesmo lote** (emenda do portão: D-A3): não observado na C0.3; o código e o banco agora aguentam, e a Tarefa 13 anota.
- **O corpo do erro de cota esgotada nesta chamada** (`quotaExceeded`): o plano trata 403 com esse `reason` e 429; não foi provocado.

---

## 4. As contas

### 4.1 Cota (Data API, 10.000 unidades por dia)

Por retrato: **1** (`commentThreads.list`) **+ até 1** (`channels.list`, só se sobrar algum autor a consultar entre os 20 mais curtidos; **ou**, no lugar dela, `videos.list?part=statistics` quando o lote vem vazio: 2 de 365 vídeos têm contagem 0) **+ nos marcos 7 e 30, 1 a cada 50 comentários guardados que não vieram no lote, até 3 blocos** (em geral 1; um vídeo guarda no máximo cerca de 36 de topo e as respostas do criador). **Máximo por retrato: 5** (emenda do portão: S-m1; a conta anterior dizia 4 e supunha 2 blocos).

| Cenário | Retratos por dia | Unidades por dia |
|---|---|---|
| Hoje, em regime (15 canais, 4,06 vídeos por dia, 3 marcos) | 12,2 | **até 32** (marco 1: 2; marcos 7 e 30: 3) = 2,2 por canal e dia. O spec estima 2,16. Refeito pelo revisor de dados: 4,06 × 2 + 8,12 × 3 = 32,5 |
| Dia de pico (percentil 95: 8 vídeos por dia nos três marcos ao mesmo tempo) | 24 | até 64 |
| Primeiro dia, se a resposta à pergunta 1 for "sim" (49 retratos, nada guardado ainda) | 49 | **98** (2 cada), uma vez |
| Primeiro dia, se for "não" (o padrão) | cerca de 12 (só os marcos atingidos depois da promoção) | até 32 |
| 75 canais (o teto de `RULES.channelLimit`), no ritmo de 99 vídeos por canal e ano | 61 | até 163 |
| Nova tentativa de retrato em erro | 1 por dia por retrato, até a tolerância acabar (2, 3 ou 7 dias) | no pior caso +1 por retrato em erro |

**Teto por execução:** `callsMax = 60` chamadas (o proposto pelo spec). Regime: 1 execução por dia. Primeiro dia com "sim": 2 a 4 execuções (as seguintes nos disparos de 20 em 20 minutos; quem corta primeiro é o tempo de 40 s ou o teto de chamadas, conforme a latência). 75 canais: 3 a 5 execuções. O que não coube é contado (`ficaram`) e é o primeiro da execução seguinte, porque a lista vem ordenada pelo prazo.

### 4.2 Tempo (a função morre aos 300 s; a tarefa é pesada, uma por disparo)

(emenda do portão: S-I4, S-m1, S-I5, D "Contas refeitas". A conta anterior, "pior fim de 66 s", era hipótese: as idas ao banco não tinham tempo máximo, e o relógio era o da tarefa, não o do disparo.)

Idas ao banco por execução: **6 fixas + 2 por retrato**, cada uma com `abortSignal` de 5 s (`dbTimeoutMs`). Fixas: a prova (que também é a guarda de schema), a lista de devidos, os canais acompanhados e os canais do dono (em paralelo, por site), a cota (todos os sites em paralelo, uma espera) e a prova do fim. Por retrato: os ids já guardados do vídeo (só nos marcos 7 e 30) e a escrita atômica. `anular_identidade`: 2 idas (a rotina e a prova de depois).

| | Chamadas à API | Idas ao banco | Tempo estimado |
|---|---|---|---|
| Um retrato | 2 a 3 (máximo 5) | 2 | 1 a 3 s (hipótese: 0,3 a 1,0 s por chamada; 0,1 a 0,2 s por ida, o medido na E1 e na E2). **Pior caso pelos tetos: 5 × 6 s + 2 × 5 s = 40 s** (`WORST_SNAP_MS`) |
| Regime (12 retratos) | até 32 | 30 | **12 a 36 s** |
| Primeiro dia com "sim" (49) | 98 | 104 | **não cabe numa execução.** Cada execução para de começar retrato aos 40 s ou às 56 chamadas, o que vier antes: entre 13 retratos (a 3 s cada) e 28 (teto de chamadas). São 2 a 4 execuções |

**Onde o relógio é conferido, e o pior fim.** O relógio que manda é o do disparo (`t0`), como no plano da ordem 5. Três limites, todos conferidos **antes de começar** algo:

| Limite | Valor | Contado de | Quem confere |
|---|---|---|---|
| a tarefa não começa depois de | 130 s (`startsByMs`, o `comecaAteMs` do catálogo) | `t0` | o despachante da E16 |
| não começa retrato depois de | 40 s (`startBudgetMs`) | o começo da tarefa | `coletar`, passo 4 |
| não começa retrato depois de | 170 s (`lastSnapStartsByMs`) | `t0` | `coletar`, passo 4 |

**Pior fim, contado de `t0`:** o último retrato começa aos 170 s; gasta no máximo 40 s (5 chamadas de 6 s e 2 idas de 5 s); depois do laço, a cota e a prova do fim, com uma de folga, 3 × 5 s. **170 + 40 + 15 = 225 s** (`WORST_END_FROM_T0_MS`). A rota precisa de 20 s para a prova do fecho e 15 s para o registro: 300 − 35 = 265 s. **Folga: 40 s.** A desigualdade é um teste (Tarefa 2, teste 5). Num disparo típico a tarefa começa entre 1 e 10 s de `t0` e termina antes de 50 s; os 225 s são o que os tetos permitem, não o esperado.

**`anular_identidade`:** 2 idas ao banco, no máximo 2 × 5 s = **10 s** (o orçamento do spec). Com 15 canais apaga cerca de 12 × 12 = 144 linhas por dia em regime (as do dia 28). Estimado: menos de 1 s.

**O que continua hipótese:** a latência da API (Tarefa 13 mede) e o tempo das idas ao banco deste passo (o medido é o da E1 e da E2).

### 4.3 Volume no banco e no Blob

- **Blob: zero.** Nenhuma foto é copiada (só a URL, que some com a linha de identidade).
- **Banco** (emenda do portão: D "Contas refeitas", D-A7): a estimativa do spec (9.5) é **1,3 MB por canal por ano**; a do revisor de dados, refeita com índices, é **1,8 MB** (99 vídeos × (24 comentários × 500 B + 48 leituras × 100 B + 3 retratos × 300 B)), e **1,9 MB com `pool_stats`** (cerca de 250 B por retrato). Com 15 canais: 20 a 28 MB por ano, sobre 171 MB de hoje; com 75 canais: até 140 MB por ano. **As duas são estimativas sem nenhum dado**: a conferência de D+7 decide. A tabela de identidade não cresce: fica num patamar de 28 dias de comentários novos (1.400 a 2.300 linhas com 15 canais).
- **Primeiro dia com "sim":** 49 retratos × até 12 comentários = até 590 comentários, cerca de 0,4 MB.

---

## 5. O que acontece quando o dado não existe, e em cada falha

**Regra que vale para toda linha (emenda do portão: R3):** nenhum texto vindo do YouTube ou do banco entra em mensagem de erro, em `error_reason`, em `competitor_agenda_runs.reason`, no retorno do cron, no Sentry nem em `console`. O que se grava é **código de lista fechada**: `MOTIVOS` para o retrato (o banco só aceita `^[a-z0-9_]{1,40}$` em `error_reason`) e `CODIGOS_EXECUCAO` para a tarefa. A frase que o dono lê sai de `fraseDe(codigo, numeros)` (Tarefa 2). As frases citadas na coluna da direita são as dessa função.

**(emenda 3 do portão: S-T2) Como ler as frases desta tabela, da seção 2 e da seção 6.** Onde está escrito "comentários: <frase>.", o dono lê "<rótulo da tarefa>: <frase>", sem o ponto final. O prefixo é o `rotulo` ("retratos de comentários" ou "anular identidade de autores"), posto uma vez só por `fraseDoMotivo` da agenda; `frases.ts` não escreve prefixo nem ponto final (Tarefa 2).

| Situação | O que o código faz | O que fica gravado | Verde ou vermelho |
|---|---|---|---|
| MG8 não aplicada (função ou tabela ausente: `PGRST202`, `42883`, `42P01`, `PGRST205`) | para antes de chamar o YouTube | nada | **vermelho**: "<rótulo>: migration não aplicada" (emenda 5 do portão: S5-T1) (a frase de `schema_ausente` em `frases.ts` continua existindo para o Sentry e para o teste 8, mas a agenda não a mostra) |
| A prova não responde, lança, ou vem fora da forma | para (não dá para saber se há identidade vencida) | nada | **vermelho**: "comentários: não foi possível ler a prova" |
| `identidade_vencida > 0` (a rotina não rodou) | **não coleta** | nada | **vermelho**: "comentários: identidade de autores vencida e não apagada: N. A coleta parou até a rotina de anulação rodar." |
| Tabelas vazias, nenhum vídeo na janela (primeiro dia sem vídeo novo) | lista de devidos vazia; 0 chamadas | nada | verde, com a nota "nenhum retrato devido"; `retratos_na_janela = 0` |
| A fila zerou (ou a lista veio vazia) **e** a prova do fim diz `retratos_atrasados > 0` | incoerência: algo devido não foi listado ou não foi gravado (emenda do portão: D-C1: antes só era olhado com a lista vazia, que em regime nunca vem vazia) | nada | **vermelho**: "comentários: N vídeos passaram do marco sem retrato e não estavam na lista." |
| A fila **não** zerou (parcial) e a prova diz `retratos_atrasados > 0` | esperado: o que falta está na fila (o primeiro dia tem 31) | — | não é vermelho por isso |
| `COMMENT_SINCE` ainda em `'a_decidir'` (emenda do portão: D-A6) | para antes de qualquer ida ao banco | nada | **vermelho**: "comentários: a data de início da coleta não foi decidida (COMMENT_SINCE). Nada foi coletado." |
| A prova devolve **nulo** (algum parâmetro nulo; emenda do portão: D-A1) | igual a prova ilegível | nada | **vermelho** (nunca "tudo zero") |
| `identidade_prazo_errado`, `identidade_de_criador` ou `respostas_de_terceiros` > 0, no começo ou no fim (emenda do portão: D-C1, S-I3) | a coleta **segue** (decisão da Tarefa 10); a execução termina em erro | os retratos | **vermelho**: "comentários: a guarda da identidade está quebrada (…)." |
| Janela de marco fechou sem retrato final nos últimos 7 dias, por motivo que não é `proibido` (emenda do portão: D-A5) | nada a fazer (o retrato não volta) | nada | **vermelho por 7 dias**: "comentários: N retratos perdidos nos últimos 7 dias (a janela fechou sem retrato)." |
| Três ou mais retratos na janela presos em `erro` com o mesmo motivo "do vídeo" (emenda do portão: D-A5) | segue tentando a cada 20 h | os retratos `erro` | **vermelho**: "comentários: N retratos presos no mesmo motivo (X)." |
| Lista de devidos não é lista (resposta nula, objeto) | falha de leitura, nunca "nada devido" | nada | **vermelho** |
| Vídeo sem `published_at` | fora da lista (não há idade) | nada | hoje são 0; a prova não conta (limite conhecido, seção 13) |
| Vídeo com `missing_since`, ou de canal com `missing_since` | fora da lista | nada | verde |
| Vídeo `upcoming` ou `live` agora | fora da lista até virar vídeo | nada | verde |
| 200 com `items` com 1 a 100 conversas | retrato `ok` | retrato, comentários, leituras, identidades | verde |
| **200 sem a chave `items`, ou `items` que não é lista** | falha da chamada | retrato `erro`, `resposta_sem_lista` | passageiro: nova tentativa no disparo seguinte; **vermelho** enquanto durar |
| 200 com `items: []` (emenda do portão: D-M3) | **sempre** uma chamada `videos.list?part=statistics` (1 unidade) para ler a contagem agora; a contagem guardada não é usada, porque o carimbo `last_checked_at` é posto mesmo quando a resposta veio sem `statistics` | contagem lida 0 → `sem_comentarios`; maior que 0 → `erro` `lista_vazia_com_contagem` (nova tentativa em 20 h); a chamada falhou → `erro` `contagem_nao_lida` (passageiro); veio sem a contagem → `erro` `contagem_ausente` | verde só no primeiro caso |
| Conversa com id repetido no lote, ou id que veio no lote e também por id (emenda do portão: D-A3, S-m3) | fica uma (a primeira do lote); `montarPacote` não manda repetido e o banco deduplica de novo | o retrato inteiro, com `nao_gravados` somando o descartado | verde (antes: erro `21000` a cada tentativa, até o marco se perder) |
| Nome, foto ou texto com NUL ou meio par UTF-16 (emenda do portão: S-I2) | todo corpo da API é limpo na entrada (`sanitizeForDb`) | o retrato, com o texto limpo | verde (antes: `22P05` a cada tentativa) |
| Comentário com `publishedAt` que não é data | a conversa é descartada | nada dela; `descartados` soma | o retrato segue |
| 403 `commentsDisabled` | "desligados" (só este erro dá este estado; nunca a contagem 0) | retrato `desligados` | verde |
| 404 `videoNotFound` | o sumiço é da E1; aqui é um retrato que não deu | retrato `erro`, `video_nao_encontrado` (desvio 4) | nova tentativa em 20 h, até a E1 marcar `missing_since` |
| 403 `quotaExceeded`, ou 429 | **para a execução inteira**; o vídeo não tem culpa | nada para este vídeo | **vermelho**: "comentários: a cota do YouTube acabou; N retratos ficaram" |
| Outro 403 (`forbidden`) ou 400 | um retrato que não deu, por causa do vídeo | retrato `erro` (`proibido`, `http_400`) | nota; nova tentativa em 20 h |
| 5xx, rede, tempo esgotado, JSON ilegível | um retrato que não deu, por causa da chamada | retrato `erro` (`http_5xx`, `rede`, `tempo_esgotado`, `resposta_ilegivel`) | passageiro: nova tentativa no disparo seguinte; **vermelho** enquanto durar; três seguidas param a execução |
| Conversa sem `topLevelComment.id`, sem `likeCount` numérico, sem `publishedAt` ou sem texto | a conversa é descartada (não vira comentário com curtida 0) | nada dela; `descartados` soma | o retrato segue; se **todas** forem descartadas, `erro` `lote_ilegivel` |
| Comentário sem `authorChannelId` | não é o criador, não é consultado; conta em `featured_unknown_n` se estava entre os 20 | comentário sem `channel_id` na identidade | verde |
| Comentário sem nome, sem id e sem foto | nenhuma linha de identidade | comentário | verde |
| `channels.list` falha, ou 200 sem `items` com `totalResults` diferente de 0 | o retrato **não falha**; ninguém é marcado por tamanho | `featured_lookup_n` **nulo** | verde; conta em `consultas_de_autor_falhas` |
| `channels.list` devolve menos canais do que foi pedido | os que faltam são "não se sabe" | `featured_unknown_n` soma | verde |
| Autor com `hiddenSubscriberCount`, ou sem `subscriberCount` | "não se sabe", **nunca "pequeno"** | `featured_unknown_n` soma | verde |
| Canal do vídeo com inscritos nulos, ocultos ou 0 | vale só o piso de 100 mil; a razão é "não medida" | `featured_ratio_band` nula | verde |
| Nenhum autor a consultar (todos são o criador, acompanhados, do dono ou sem id) | 0 chamadas | `featured_lookup_n = 0` | verde |
| `comments.list?id=` falha (marcos 7 e 30) | o retrato é gravado; **nenhuma ausência é marcada** e `last_checked_at` não muda para os não conferidos | retrato `ok`; `conferencias_falhas` soma | verde com nota |
| `comments.list?id=` devolve 200 sem `items` | idem (falha), **nunca "todos sumiram"** | idem | idem |
| Comentário guardado que não veio no lote nem por id | 1ª ausência: `miss_streak = 1`; 2ª seguida, ou qualquer uma no marco 30: `missing_since` | o comentário **não é apagado** | verde |
| Comentário que o dono já mandou apagar (`competitor_removed_items`) e voltou no lote | não é gravado de novo; `returned_seen_at` é carimbado | nada | verde; conta em `nao_gravados` |
| Comentário com identidade já apagada que volta num marco posterior | o texto e as curtidas atualizam; **a identidade não é regravada** | sem linha de identidade | verde |
| Retrato passaria da tolerância entre a lista e a escrita, ou o relógio de quem chama está errado (emenda do portão: D-A4) | o código não chama o banco; se chamar, **o banco recalcula a idade e devolve `fora_da_tolerancia`** | nada; `fora_da_tolerancia` soma | verde |
| `taken_at` mais de 10 minutos no futuro (emenda do portão: D-A2) | o banco recusa (`22023`): conta como erro de gravação | nada | **vermelho** |
| A escrita falha no banco | nada do retrato fica (uma transação) | nada; o código do Postgres (`banco:23514`) vai só ao retorno e ao Sentry, **nunca `message` nem `details`**, e **nunca a `error_reason`** (não há linha de retrato) | **vermelho** (conta como falha passageira); devido de novo no disparo seguinte |
| Uma ida ao banco não responde em 5 s (emenda do portão: S-I4) | a ida é cortada (`banco:tempo_esgotado`); prova → ilegível; lista → ilegível; escrita → falha passageira | nada daquela ida | **vermelho**; a tarefa termina dentro do limite e o fecho do disparo roda |
| Mais de 150 comentários guardados fora do lote num vídeo (emenda do portão: S-m1) | confere 150 (3 blocos); o resto fica para o marco seguinte | nenhuma ausência para os não conferidos; `conferencias_nao_feitas` soma | verde com o número no retorno |
| A tarefa lança uma exceção que ninguém previu (emenda do portão: R3, S-I5) | o adaptador da agenda pega, relata ao Sentry só o nome do erro e devolve o código `inesperado` | a cota já gasta (pelo `finally`) | **vermelho**: "comentários: N retratos falharam com erro inesperado (ver Sentry)." |
| Dois disparos com o mesmo (vídeo, marco) | o segundo espera a trava e recebe `ja_existe` | um retrato só | verde |
| O vídeo é apagado entre a lista e a escrita | a função devolve `video_ausente` | nada | verde; conta |
| Houve falha passageira na execução | — | os retratos `erro` | **vermelho**: "comentários: N leituras falharam (motivo mais comum: X); nova tentativa no próximo disparo" |
| Toda consulta de inscritos da execução falhou (3 ou mais tentadas), ou toda conferência por id | os retratos são gravados | `featured_lookup_n` nulo; nenhuma ausência | **vermelho**: "comentários: a consulta de tamanho dos autores falhou N vezes seguidas" (sem isto, "nenhum canal grande" para sempre, em verde) |
| A cota gasta não consegue ser gravada | a coleta não é desfeita | retratos gravados; a cota fica de fora | **vermelho**: "comentários: N unidades de cota não registradas" (como na E1) |
| A rotina de anulação falha | nada é apagado (uma instrução) | nada | **vermelho** na própria tarefa, e no dia seguinte a coleta para (linha 3) |
| A rotina apaga, mas a prova de depois ainda mostra identidade vencida, prazo errado ou identidade de criador, ou não dá para ler (emenda do portão: D-C1, S-I3) | o que deu para apagar foi apagado | — | **vermelho** na tarefa `anular_identidade` |
| `OBS_AGENDA=off`, ou a guarda da MG10 falha (emenda do portão: S-I5) | a anulação roda mesmo assim, antes do lote antigo (com tomada no primeiro caso; sem tomada, em todo disparo, no segundo). **(emenda 3 do portão: D-T1, AG)** Só roda porque a Tarefa 12 põe `anular_identidade` na lista `antesDoLoteAntigo`: **com a lista vazia nada roda e nada fica vermelho**. No primeiro caso o estado é lido antes da tomada: já feita no dia = não roda de novo, sem nota; esgotou as 12 tentativas do dia = não roda e o cron fica vermelho em todo disparo até o dia virar; estado ilegível = roda sem fechar, com nota | — | o resultado dela entra na mensagem do disparo |
| **(emenda 3 do portão: D-m3)** `OBS_AGENDA=off` (ou `retratos_comentarios` em `OBS_AGENDA_TASKS_OFF`) por mais de 48 horas | a coleta não roda (só a anulação); a janela de cada marco fecha sem retrato | nada: cerca de 4 retratos perdidos por dia e por marco vencido (risco 24) | **verde enquanto durar** (o vigia mostra `desligada`); vermelho só depois de religar (`retratos_perdidos`, por 7 dias) |
| A rotina roda com a tabela vazia | apaga 0; `restantes = 0` | nada | verde, com a nota "nenhuma identidade guardada" |
| `OBS_AGENDA_TASKS_OFF` contém `retratos_comentarios` | a coleta não roda; a anulação **roda** | nada novo | a tarefa aparece "desligada", nunca "em dia" (E16) |

---

## 6. Simulação do dia do deploy e dos seguintes

Hipótese: MG8 aplicada antes; E16 parte 1 em `main`; **promoção antes das 13:00 de São Paulo do dia D** (emenda do portão: D-M1), com `COMMENT_SINCE` e `E14_DEPLOY` preenchidas no commit do envio.

(emenda do portão: D-M1: a versão anterior dizia "a prova vem com tudo zero" no primeiro disparo. Medido em produção em 13/10 02:01 UTC pela regra da prova: `retratos_na_janela = 49` e `retratos_atrasados = 31`, sendo 2 no marco 1, 8 no 7 e 21 no 30. E 6 vídeos do marco 30 saem da tolerância a cada 24 horas.)

| Quando | O que acontece | O que se confere |
|---|---|---|
| D, primeiro disparo depois das 03:00 | a agenda acha `anular_identidade` devida: roda, apaga 0, lê a prova de depois (zeros), `ok` | a linha da tarefa |
| D, 13:00 (ou o primeiro disparo depois, se a vaga da pesada estiver com `sincronizar_canais`) | **Se a pergunta 1 for "não" (o padrão), `COMMENT_SINCE` = o instante da promoção:** a prova, com o corte, vem com `retratos_na_janela` e `retratos_atrasados` em 0 ou perto disso; a lista traz só os marcos atingidos desde a promoção (poucos); `ok`. **Se for "sim", `COMMENT_SINCE = null`:** a prova do começo vem com 49 na janela e 31 atrasados; a lista traz os 49, ordenados pelo prazo (primeiro os de 30 a 37 dias que estão para sair da tolerância); faz entre 13 e 28 retratos (40 s ou o teto de chamadas) e devolve `parcial` com `feitos` e `ficaram`. **Os 31 atrasados não deixam a execução vermelha**, porque a fila não zerou (`filaZerada` falso) | retorno do cron: `comentarios.feitos`, `ficaram`, `unidades`, `retratos_atrasados` |
| D, 13:20 a 14:20 (só com "sim") | a retomada de `parcial` com progresso não gasta tentativa (regra da E16): faz os restantes em 1 a 3 disparos; no último a fila zera, a prova do fim tem de vir com `retratos_atrasados = 0`, e a execução é `ok` | `ficaram 0`; `youtube_quota_usage.operations.comentarios` do dia do Pacífico perto de 98 |
| **Se `COMMENT_SINCE` ficou em `'a_decidir'`** | a tarefa devolve `erro` `inicio_nao_decidido` sem ir ao banco; cron vermelho com a frase; nada é coletado até o conserto (uma constante) | o e-mail do vigia |
| D+1, 03:00 | anulação: apaga 0 | — |
| D+1, 13:00 | devidos: os vídeos que fizeram 24 h, 168 h ou 720 h desde a última execução (cerca de 12). Nos marcos 7 e 30 ainda não há nada guardado desses vídeos: sem conferência por id | `e14-d1`: V5 = 0 atrasados; cota contra `units_used` |
| D+6 a D+7 | primeiros marcos 7 de vídeos vistos no marco 1: primeira conferência por id; `miss_streak` 1 nos que não vieram | `conferencias_falhas = 0` |
| **D+7** | **conferência com data:** tamanho das quatro tabelas e unidades por canal e dia (itens 122 e 149); retratos em `proibido` | ledger; corrige 9.5 e 9.6 do spec se passar de 30% |
| **D+28** | as identidades dos comentários do dia D vencem (`expires_at = first_seen_at + 28 dias`, portanto à tarde de D+28) e saem na rotina das 03:00 de **D+29** | — |
| **D+29, 03:00** | **a primeira anulação de verdade:** apaga as do dia D (cerca de 590 linhas com "sim"; cerca de 140 com "não") | **conferência com data:** `apagadas > 0` na execução, `identidade_vencida = 0`, e V6 = 0, 0, 0 |
| D+29 a D+30 | marco 30 dos vídeos vistos no marco 1: os comentários voltam no lote **sem** regravar identidade; ausência no marco 30 marca `missing_since` | **conferência com data (D+31):** identidade em comentário com `author_purged_at` = 0; comentários com `missing_since` aparecem |
| Um dia em que a rotina não rode (agenda parada, erro) | às 13:00 a coleta lê a prova. Enquanto nenhuma identidade passou de 29 dias, coleta. No dia em que passar: para, vermelho | o vigia da E16 cobra `anular_identidade` em 36 h, antes disso, por e-mail |
| Um dia em que a tarefa de comentários não rode | os marcos do dia seguem devidos enquanto a tolerância durar (2, 3 e 7 dias de folga); a ordem pelo prazo salva primeiro o que está para vencer. Janela que fechar sem retrato vira `retratos_perdidos_7d` e fica vermelha por 7 dias | o vigia da E16 cobra em 36 h |
| Um dia em que a cota do YouTube acabe antes das 13:00 | a tarefa para na primeira chamada, `erro` `cota_esgotada`, e tenta de novo a cada disparo: gasta as 12 tentativas do dia até as 17:00 (a cota só volta de madrugada). No dia seguinte é período novo | risco 10 |

**O que a idade do retrato vai ser, na prática.** A tarefa fica devida uma vez por dia, a partir das 13:00. Um vídeo publicado às 14:00 tem 23 h às 13:00 do dia seguinte e não entra; entra no outro dia, com 47 h. **Os retratos do "marco 1" são tirados entre 24 e 48 horas de idade** (o revisor de dados refez com o horário real de publicação dos 90 dias: entre 25 e 48); **os do 7, entre 168 e 192; os do 30, entre 720 e 744.** A idade real fica em `video_age_hours`, calculada pelo banco. Isto é consequência do período diário da agenda, e a tela (mockup 20) tem de dizer a idade real.

---

## 7. Regras que este plano fecha (onde o spec deixa aberto)

1. **O destaque gravado não é revisto.** `featured_reason` e as faixas são gravados na primeira vez em que a consulta determina; um marco posterior nunca os apaga nem troca (o comentário pode ter saído dos 20 mais curtidos, e aí não há consulta nova). Um comentário **sem** destaque pode ganhá-lo num marco posterior, inclusive depois de a identidade ter sido apagada: a faixa é o que o spec já aceita guardar sem prazo.
2. **`creator_replied`: vale a última leitura, com uma exceção.** "Sim" não vira "não se sabe" (uma resposta vista não deixa de ter existido porque a janela de 5 respostas mudou). "Sim" só vira "não" quando todas as respostas foram vistas e nenhuma é dele. Comentário lido só por id não muda o valor (a chamada por id não traz respostas).
3. **Um comentário que volta zera `miss_streak` e `missing_since`.** `removal_decision` não muda.
4. **Quem é consultado em `channels.list`:** os autores dos 20 comentários de topo mais curtidos do lote (desempate da seleção), tirando o criador, os canais acompanhados do mesmo site, os canais do dono e quem não tem id; sem repetir autor. Autor de **resposta** não é consultado nem marcado por tamanho; a regra (a), canal acompanhado, vale também para resposta vista ("ou de uma resposta vista", 4.6.2), e marca o comentário de topo.
5. **Nova tentativa de retrato em erro, por tipo de motivo.** Motivo **do vídeo** (`proibido`, `video_nao_encontrado`, `lista_vazia_com_contagem`, `contagem_ausente`, `http_400`, `http_4xx`): no máximo uma a cada 20 horas (`retryAfterHours`), até a tolerância acabar; não deixa a execução vermelha (é nota). Motivo **passageiro** (`MOTIVOS_PASSAGEIROS`: rede, tempo esgotado, 5xx, resposta ilegível ou sem a lista, lote ilegível, contagem não lida): volta a ser devido em 15 minutos, ou seja, no disparo seguinte, e a execução fica vermelha enquanto durar. Três falhas passageiras **seguidas** param a execução (`breakerAfter`): o YouTube está fora, e cada tentativa a mais custa 1 unidade e até 6 s. Sem coluna nova: `taken_at` e `error_reason` do retrato em erro decidem, dentro de `competitor_comment_due`. (Com a emenda, um motivo "do vídeo" que se repete em 3 retratos, ou que leva à perda do retrato, fica vermelho pela prova: regra 11.)
6. **A lista de devidos tem teto de 200 linhas e devolve o total.** Com mais de 200 devidos, a execução trabalha os 200 mais urgentes e `ficaram` conta todos.
7. **Texto:** `textDisplay` com `textFormat=plainText`, passado por `sanitizeForDb` e cortado em 2.000 **caracteres Unicode** (por ponto de código, para não partir um emoji), com `body_truncated`. `textOriginal` é ignorado (veio com chave de API na C0.3, contra a documentação; não se depende dele). **Além disso, o corpo inteiro de toda resposta da API passa por `sanitizeForDb` na entrada** (nome e foto do autor também são texto de fora; emenda do portão: S-I2).
8. **`edited_at`** só quando `updatedAt` difere de `publishedAt`.
9. **O que se guarda do lote que não é guardado** (emenda do portão: D-A7): `pool_stats` no retrato, só com números e sim/não (13 contagens do lote e `conferencia_falhou`), e `creator_replied` em cada leitura por marco, com o que **aquela** leitura viu, sem a regra 2 (que vale para a coluna do comentário). Nenhum texto, nome ou id: o banco recusa.
10. **O corte de início** (emenda do portão: D-A6): `COMMENT_SINCE` nulo = entra tudo o que estiver na tolerância; com data = só o marco **atingido** (`t0 + from_h`) nela ou depois. O mesmo valor vai à lista e à prova, sempre os dois.
11. **Retrato perdido e retrato preso** (emenda do portão: D-A5): perdido = a janela do marco fechou nos últimos 7 dias sem retrato final; fica vermelho, salvo se o motivo do último erro é `proibido`. Preso = 3 ou mais retratos na janela em `erro` com o mesmo motivo que não é passageiro; fica vermelho, qualquer que seja o motivo.
12. **Conferência por id tem teto** (emenda do portão: S-m1): no máximo 3 blocos de 50 por retrato; o que passar não é conferido naquele marco e não vira ausente.

---

## 8. Desvios do texto do spec, com o motivo

| # | O spec diz | O plano faz | Motivo |
|---|---|---|---|
| 1 | Retroação nenhuma: só marcos atingidos depois do deploy | **vale o spec por padrão** (`COMMENT_SINCE` = o instante da promoção); só passa a "a tolerância decide" se o dono responder "sim" à pergunta 1 | (emenda do portão: S-m4) a versão anterior invertia o padrão do spec por silêncio; a decisão 44 não deixa. O SQL aceita as duas respostas (`p_since`) |
| 2 | `apply_competitor_comment_snap(p_video, p_mark, p_snap, p_comments)` | um quinto parâmetro, `p_missing text[] default '{}'` | a conferência por id (v2.3, I-10) precisa entrar na **mesma** transação do retrato; sem ele seriam duas escritas e um retrato poderia existir sem as ausências dele |
| 3 | A idade conta de `published_at` (item 123) | conta de `greatest(published_at, live_actual_start_at)` | estreia agendada e transmissão têm `published_at` anterior ao momento em que o público viu; sem isso o "marco 1" de uma estreia poderia cair antes dela. **A E4 (marcas de views na mesma idade) tem de usar a mesma base**: aviso em 9.3 |
| 4 | `videoNotFound` "não grava nada" | grava retrato `erro` com `video_nao_encontrado` | sem linha, a tentativa se repetiria a cada retomada do dia (até 12 vezes); com a linha, é uma por 20 h e a tela tem o motivo. O sumiço continua sendo da E1 |
| 5 | Item 123: "passou do marco há 24 horas ou mais" | a prova cobra depois de **30 horas** (`graceHours`) e só de vídeo conhecido há 30 horas | a tarefa roda uma vez por dia e pode ser adiada 20 ou 40 minutos pela regra de uma pesada por disparo; com 24 h a prova piscaria vermelho todo dia |
| 6 | `competitor_channel_removal_impact` passa a contar as tabelas (item 120) | função própria, `competitor_channel_comment_impact`, e a antiga **não é tocada** | (emenda do portão: R1) três planos recriavam as funções de impacto com corpos diferentes e a ordem de aplicação apagava tabelas de um no outro. Decisão do controlador: um corpo só, por catálogo, com um dono (o plano das ordens 8 e 10). **A MG8 não recria nenhuma das duas** (rodado: o `md5` das duas é igual antes e depois dela). A função própria fica porque as leituras e as identidades não têm FK direta para o canal e `featured_elsewhere` não é contagem por FK. A remoção em si leva tudo por cascata (provado, C12) |
| 7 | A rotina é `security definer` | `security invoker` | pergunta 3 |
| 8 | A rotina "tem chave própria em `cron_health`" (4.6.6, ponto 6; item 127) | sem chave por tarefa | OP-5 do próprio spec: a fonte é `competitor_agenda_runs`, pelo catálogo da E16 |
| 9 | Parâmetros `commentsTarget`, `commentsCreatorMax`… em `rules.ts` | `RULES.comments.target`, `.creatorMax`… definidos em `comentarios/regras.ts` e ligados em `rules.ts` por uma linha | `rules.ts` é arquivo compartilhado com outras etapas em paralelo |
| 10 | "O plano mede o tempo com 75 canais simulados antes de promover" | o teste de integração simula 61 retratos (o dia de 75 canais) com `fetch` fixo e mede idas ao banco e tempo local; a latência real da API vem do ensaio com 3 vídeos | simular 75 canais contra a API real gastaria cota e guardaria texto de terceiros sem necessidade |
| 11 | C0.9: evento em preview | chamadas HTTP de verdade a um servidor local, com o SDK inicializado e afirmação positiva de que houve envio | (emenda do portão: S-C1, R8) prova mais que o evento em preview (todos os caminhos de erro, repetível) e não depende de `fetch` falso, que a instrumentação não vê. O preview só volta se o SDK não instrumentar sob o vitest |
| 12 | DDL do spec | constraints a mais (`error_reason` só com `erro` **e em formato de código**; resposta só do criador; `pool_stats` só objeto pequeno; nomes explícitos), dois índices a mais (`parent_id`, `featured_channel_id`: sem eles a cascata do pai e o `set null` da remoção de canal varrem a tabela), a recusa de prazo de identidade acima de 28 dias, **de `taken_at` no futuro e de retrato fora da tolerância do marco** dentro da função | o banco passa a garantir os itens **112**, 115 e 125 em vez de só o código (emenda do portão: D-A2, D-A4, R3; a versão anterior deixava o 112 só no TypeScript e o banco aceitava "marco 7" num vídeo de 30 horas, que virava final) |
| 13 | A lista de devidos e a prova sem filtro de site nem de data | `competitor_comment_due(…, p_since, p_site_id)`, `competitor_comment_health(…, p_since)`, `competitor_comment_identity_purge(p_site_id)`; em produção, site sempre nulo | (emenda do portão: S-I7, R5, D-A6) o banco de integração é compartilhado entre etapas; e a resposta "não" à pergunta 1 precisa do corte nos dois lados, senão a prova cobra o que a lista não lista |
| 14 | O lote de 100 não deixa rastro | `pool_stats` (só números e sim/não) no retrato e `creator_replied` por leitura | (emenda do portão: D-A7) regra do dono de 12/10: gravar também o que ainda não tem tela, com prioridade ao que a origem expira. Não contraria a minimização de 4.6.6, que proíbe guardar **o lote**: aqui não há texto, nome nem id, e o banco recusa se houver. Pergunta 5 |
| 15 | Itens 123 e 127: a prova existe | cada número da prova tem um chamador que fica vermelho, e três números a mais (`erros_por_motivo`, `perdidos_por_motivo`, e `retratos_perdidos_7d` passa de nota a alarme) | (emenda do portão: D-C1, S-I3, D-A5, R9) a prova estava certa e ninguém a escutava |
| 16 | "Frases" do aviso junto do código | código em toda coluna de motivo e de estado; a frase sai de `fraseDe` | (emenda do portão: R3) texto de exceção pode carregar dado de terceiros |

---

## 9. Arquivos, tarefas, ordem e paralelismo

### 9.1 Arquivos novos (todos desta etapa; ninguém mais toca)

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `.superpowers/sdd/a5-e14/progress.md` | ledger (obrigações OP copiadas, estados, medições, datas) | 0 |
| `apps/web/test/integration/observatorio-a5-e14-migration.test.ts` | as cinco funções, nos dois sentidos e com parâmetro nulo | 1a |
| `apps/web/test/integration/observatorio-a5-e14-rls.test.ts` | RLS das quatro tabelas com GUC forjado; quem executa | 1a |
| `supabase/migrations/<carimbo>_observatorio_a5_e14_comentarios_de_destaque.sql` | MG8 (Apêndice A). **Só na vez do lote B** (R2) | 1b |
| `apps/web/src/lib/youtube/observatorio/comentarios/regras.ts` | `COMMENT_RULES`, `COMMENT_SINCE`, faixas, as listas fechadas de motivos e de códigos de execução | 2 |
| `…/comentarios/tipos.ts` | os tipos compartilhados, **inclusive `ProvaComentarios` e `Devido`** (emenda do portão: S-I6) | 2 |
| `…/comentarios/erro.ts` | `ComentariosErro` (emenda do portão: S-I6: saiu de `api.ts`, porque `relato.ts` e `gravar.ts` também a usam) e `codigoDe` (emenda 2 do portão: S-F1: saiu de `relato.ts`, porque a Tarefa 8 a usa e roda junto com a 7b) | 2 |
| `…/comentarios/ordem.ts` | `ordenar` (emenda do portão: S-I6: saiu de `selecao.ts`, porque `destaque.ts` também a usa) | 2 |
| `…/comentarios/frases.ts` | `fraseDe(codigo, numeros)` e `FRASES_FIXAS` (emenda 3 do portão: S-T2): a única fonte do texto que o dono lê (emenda do portão: R3) | 2 |
| `apps/web/test/youtube/observatorio/comentarios-regras.test.ts` | testes de regras, ordem e frases (emenda do portão: S-I6: antes ficavam no arquivo da Tarefa 3) | 2 |
| `…/comentarios/normalizar.ts` | puro: resposta da API → conversa normalizada; texto; sinalizadores do criador; os agregados do lote | 3 |
| `…/comentarios/destaque.ts` | puro: regra do autor de destaque e as faixas | 4 |
| `…/comentarios/selecao.ts` | puro: os três grupos e o desempate | 5 |
| `…/comentarios/api.ts` | as quatro chamadas, corpo limpo na entrada, classificação de erro por código fixo | 6 |
| `apps/web/test/lib/sentry-comentarios-http.test.ts` | a redação dos ids com chamada HTTP de verdade a servidor local | 7a |
| `…/comentarios/relato.ts` | o único caminho deste passo para o Sentry (só números e códigos); **não** tem `codigoDe` (emenda 2 do portão: S-F1) | 7b |
| `…/comentarios/gravar.ts` | montagem do pacote, as cinco funções do banco (com tempo máximo), `lerProva` (que é a guarda de schema) | 8 |
| `…/comentarios/prova.ts` e `…/comentarios/anular.ts` | `veredito` (puro) e `runAnularIdentidade` | 10 |
| `…/comentarios/coletar.ts` | `runRetratosComentarios` | 9 |
| `apps/web/test/youtube/observatorio/comentarios-{normalizar,destaque,selecao,api,relato,gravar,coletar,anular-prova}.test.ts` | testes de cada módulo | 3 a 10 |
| `apps/web/test/youtube/observatorio/comentarios-fixtures.ts` | respostas fixas **sintéticas** (nenhum texto nem autor real) | 3 |
| `apps/web/test/integration/observatorio-a5-e14-coleta.test.ts` | a coleta inteira contra o banco local, com `fetch` fixo | 11 |
| `apps/web/test/youtube/observatorio/comentarios-varredura.test.ts` | varreduras estáticas (itens 119 e 127; R6) | 11 |
| `apps/web/src/lib/youtube/agenda/tarefas/anular-identidade.ts`, `…/agenda/tarefas/retratos-comentarios.ts` | as duas entradas do catálogo e o adaptador (nomes que o plano da ordem 5 reservou para a E14) | 12 |

### 9.2 Arquivos existentes modificados

| Arquivo | O que muda | Tarefa | Compartilhado com |
|---|---|---|---|
| `apps/web/src/lib/sentry-pii.ts` | regra **por campo**: em breadcrumb ou span das rotas de comentário, `http.query` e `url.query` somem inteiros; a query some de `http.url`, `url.full`, `url` e `description` (emenda do portão: S-C1) | 7a | **o commit da R8** (fora dos planos) mexe no mesmo arquivo antes: a 7a começa depois dele e parte do que ele deixar |
| `apps/web/test/lib/sentry-pii.test.ts` | casos novos com as formas reais do SDK | 7a | o commit da R8 |
| `apps/web/src/lib/youtube/observatorio/rules.ts` | uma linha: `comments: COMMENT_RULES` | 12 | **E15** (`RULES.hourly`), **E4** (chaves diferentes) |
| `apps/web/src/lib/youtube/agenda/catalogo.ts` | duas linhas de importação e as duas entradas | 12 | **E16 (dona)**, E15, E10 (OP-3) |
| `apps/web/src/lib/youtube/agenda/executar.ts` | **uma importação e uma entrada** (emenda 3 do portão: D-T1, S-T3): a E14 acrescenta `anular_identidade` à lista `antesDoLoteAntigo`, que a E16 define vazia e percorre nos dois caminhos sem agenda (plano da agenda, 9.1 e Tarefa 12). `nuncaDesliga` sozinho NÃO põe a tarefa nesses caminhos: quem roda é quem está na lista. A função `rodarAntesDoLoteAntigo` e a chamada na rota são da E16 e não são tocadas. Nenhuma outra linha do arquivo muda | 12 | **E16 (dona)** |
| `apps/web/test/youtube/agenda/tarefas.test.ts`, `despachante.test.ts` | os casos da Tarefa 12 (o `executar.test.ts` fica com a E16; os testes 4 e 5 da Tarefa 12 usam o ponto que ela entrega, **com a lista real**; emenda 3 do portão: D-T1) | 12 | **E16 (dona)** |
| `apps/web/test/lib/conferencias.test.ts` | o teste 12 da Tarefa 12 (emenda 2 do portão: S-menor) | 12 | toda etapa (só acrescenta) |
| `apps/web/src/lib/conferencias.ts` | `E14_DEPLOY` e `conferenciasE14(deploy)`, no padrão de `E1_E2_DEPLOY` | 12 | **toda etapa** (só acrescenta) |
| `.superpowers/sdd/a5/conferencias-com-data.md` | o espelho das quatro conferências (emenda do portão: S-m7) | 12 | toda etapa |
| `docs/ops/env-vars.md` | os dois nomes de tarefa aceitos em `OBS_AGENDA_TASKS_OFF` (emenda do portão: S-m7); **(emenda 4 do portão: D4-m2)** na entrada de `OBS_AGENDA` e na de `OBS_AGENDA_TASKS_OFF`, o aviso: `desligada por mais de 48 h, perde retratos de comentários que não voltam (cerca de 4 por dia por marco)` | 12 | E16 (cria a seção) |

**Não são tocados:** `apps/web/test/helpers/db-seed.ts` e `db-skip.ts` (a URL por variável já foi feita no commit `69bd83c7`; emenda do portão: R5, S-I1); `apps/web/src/lib/redact-secrets.ts` e os dois `sentry.*.config.ts` (a chave é da R8; emenda do portão: R8); `competitor-sync.ts`, `competitor-sync-batch.ts`, `competitor-health.ts`, `competitor-capture.ts`, `competitor-quota.ts` (só importados); `competitor-removal-impact.ts`; `database.types.ts`; `apps/web/src/app/api/cron/sync-youtube/route.ts` (emenda 3 do portão: D-T1: quem chama `rodarAntesDoLoteAntigo` é a rota, e isso é da Tarefa 12 da E16; a E14 só acrescenta a entrada na lista, em `executar.ts`); os testes de `executar` e os dois testes da rota, que são da E16 (o que a E14 precisa que mude neles está em 9.3, itens 9 e 10); a semente de e2e (não há tela).

### 9.3 O que esta etapa pede às outras (o controlador repassa)

- **E16 (ordem 5, dona da agenda; emenda do portão: R4, S-I5).** Este plano escreve contra o que o plano dela diz **na emenda 5 dele (13/10)** (emenda 3 do portão: D-m1; emenda 4 do portão: D4-m1, S4-m1: este item dizia "na emenda 3 dele", e a agenda já está na 5) (`agenda/tipos.ts` **(emenda 4 do portão: S4-m2: o tipo `Tarefa` mora em `tipos.ts`, não em `catalogo.ts`; `catalogo.ts` tem `CATALOGO`)**: `Tarefa`, `ContextoTarefa { t0; agora; apiKey; sb; linhas }`, `ResultadoTarefa { estado; feitas; deixadas; motivo?; detalhe?; extra? }`; `agenda/relogio.ts`: `LEVE_COMECA_ATE_MS`, `BANCO_MS`, `LIMITE_FUNCAO_MS`; `agenda/executar.ts`: `antesDoLoteAntigo`). Os nomes dos campos de `ContextoTarefa` e de `ResultadoTarefa` seguem a conferir no código que ela entregar. A Tarefa 12 relê o plano emendado antes de começar. O que a E14 precisa que continue valendo, ou que mude:
  1. `comecaAteMs` de `retratos_comentarios` = **130.000** e o pior fim dela, contado de `t0`, = **225.000 ms** (a conta está em 4.2), não os 40 s do spec.
  2. `naoTerminouVermelhoEm` de `retratos_comentarios` = **6** (o primeiro dia leva 2 a 4 disparos parciais por desenho).
  3. `anular_identidade` com `nuncaDesliga: true`, e rodando também com `OBS_AGENDA=off` **e** quando a guarda da MG10 falha.
  4. **O que vai para `competitor_agenda_runs.reason` é o código** que a tarefa devolve em `motivo` (lista fechada, `CODIGOS_EXECUCAO`), e **o texto que o dono lê sai de uma função** (`fraseDe`, em `comentarios/frases.ts`), ligada ao registro por **dois campos** do contrato dela (emenda 3 do portão: S-T2): `motivos` (código → frase fixa: `FRASES_FIXAS` sem os códigos que já estão em `MOTIVOS_COMUNS`) e `fraseDe` (a frase com números); quem monta "<rótulo>: <frase>" é `fraseDoMotivo` da agenda (R3). Exceção nunca vira texto em `reason`: as duas tarefas da E14 embrulham o próprio `rodar` e devolvem código.
  5. **Guarda de schema:** o plano dela pede que a E14 use `schemaTablesReady` para a MG8. **A E14 não usa**, por decisão (emenda do portão: S-m6): a guarda é a prova (`competitor_comment_health`), que é uma ida em vez de quatro, e acusa também função ausente ou de assinatura antiga, o que `schemaTablesReady` (tabela e coluna) não vê. A MG8 é uma transação: ou entrou inteira ou não entrou. O plano da ordem 5 deve trocar a frase "a E14 deve usar essa função" por "a E14 usa a prova como guarda".
  6. **Nos dois caminhos sem agenda** (`OBS_AGENDA=off` e guarda da MG10 falhando), a anulação roda antes do lote antigo e pode gastar até 10 s: o lote antigo tem de contar o tempo a partir do `t0` do disparo (`started = t0`), não do próprio começo, ou o pior disparo passa de 300 s. **(emenda 2 do portão: P1) `antesDoLoteAntigo` é da E16**, que a define e a chama nos dois caminhos; este plano não a define nem toca `route.ts`; em `executar.ts` acrescenta só a entrada `anular_identidade` na lista (uma importação, uma entrada) (emenda 3 do portão: D-T1). Com `OBS_AGENDA=off`, as tarefas de outras etapas não rodam; só quem está na lista. **(emenda 3 do portão: AG, da emenda 3 da agenda)** No caminho `interruptor` a agenda lê o estado antes da tomada: linha `ok` no período = não roda de novo e não sai nota; tarefa esgotada = não roda e vira o problema "anular identidade de autores: esgotou as 12 tentativas do período", com o cron vermelho em todo disparo do período; estado ilegível ou tomada que devolve `{ porque }` = roda sem `fechar`, com nota. O prazo do `late` do lote antigo também conta de `t0` (285 s). O teste de contrato dela confere o **maior** `fimAteMs` da lista (85.000 ≤ 90.000), não a soma.
  7. Quem ganha a vaga da pesada entre `retratos_comentarios` (ordem 7) e `serie_semanal` (ordem 8), quando as duas estão devidas e sãs e `sincronizar_canais` não está: pela regra dela (a mais antiga pelo início do período; empate pela `ordem`), ganha `retratos_comentarios`. Em regime ela toma 1 disparo; no primeiro dia, 2 a 4. A semanal tem das 12:20 às 13:00 sozinha e volta depois.
  8. **(emenda 2 do portão: P1) Contrato de registro de tarefa** (a E16 o escreve na emenda 2 dela): `nome`, `rotulo`, `motivos` (catálogo de código → frase **fixa**) e `fraseDe` (campo **separado**: a função que monta a frase com números; emenda 3 do portão: S-T2), `fimAteMs` em milissegundos e a guarda de schema que cada tarefa declara. A E14 declara `fimAteMs` 225.000 (`retratos_comentarios`) e 85.000 (`anular_identidade`) e usa a prova como guarda; o plano da ordem 5 deve trocar "a E14 declara 66 s" e "a E14 usa `schemaTablesReady`" por estes dois fatos (feito na emenda 2 dele).
  9. **(emenda 3 do portão: D-T1, S-T3) O teste da agenda `lista vazia: a resposta com OBS_AGENDA=off é a de hoje mais a chave agenda_desligada` tem de passar `lista: []` injetada**, e os dois testes atuais da rota com `off` não podem depender de a lista real estar vazia (injetar a lista ou simular `rodarAntesDoLoteAntigo`). Hoje o plano dela diz "`antesDoLoteAntigo` real (vazia)": no commit da Tarefa 12 daqui a lista real deixa de ser vazia e esses testes ficariam vermelhos. A E14 **não edita** teste da E16. **(emenda 4 do portão: D4-m1, S4-m1: ATENDIDO na emenda 5 do plano da agenda: o teste `lista vazia…` passa `lista: []` injetada, "nunca a real", e os dois testes antigos da rota falseiam `rodarAntesDoLoteAntigo`. A Tarefa 12 confere no HEAD e, se não estiver lá, para.)**
  10. **(emenda 3 do portão: AG) A dívida `S3-m5` do plano dela vira tarefa, antes da Tarefa 12 daqui:** as duas saídas antecipadas do bloco antigo da rota (guarda `e1e2` não pronta; lote que lança ou passa do tempo) hoje perdem `semAgenda`, `antes.problemas` e `antes_do_lote`. Com `anular_identidade` na lista, é nelas que a frase "identidade de autores vencida…" sumiria da mensagem (o disparo continua vermelho, sem dizer por quê). **(emenda 4 do portão: D4-m1, S4-m1: ATENDIDO: a dívida `S3-m5` está PAGA na Tarefa 12 da agenda, ponto (vi), com teste. A Tarefa 12 daqui confere no HEAD.)**
  11. **(emenda 4 do portão: D4-C, S4-C; ruling do controlador, 13/10) O contrato 9.1 da agenda não muda; o adaptador troca o código só na guarda.** A prova do COMEÇO de `retratos_comentarios` é a guarda de schema: ilegível, o adaptador devolve **`schema_nao_conferido`** (comum da agenda; `numeros = { na_guarda: 1 }` é como ele a reconhece). `prova_ilegivel` continua sendo o código da prova do FIM da coleta e da prova de depois de apagar em `anular_identidade`: não são guarda (o schema já respondeu; foi a leitura do que sobrou que falhou), são resultado da tarefa, que o 9.1 admite; trocar essas duas faria o dono ler "não foi possível conferir o schema" quando o que houve foi "apagou, ou gravou, e não sabe o que sobrou". `relatarComentarios` e o Sentry recebem sempre `prova_ilegivel`. Vermelho nos três casos. No começo o dono lê "<rótulo>: não foi possível conferir o schema" (frase comum da agenda); no fim da coleta e depois de anular, "<rótulo>: não foi possível ler a prova (banco)". (emenda 5 do portão: S5-T1). Estado: **fechado pelo ruling de 13/10**; resta à Tarefa 12 conferir no HEAD que `MOTIVOS_COMUNS` da agenda continua com `schema_nao_conferido`.

- **E15 (ordem 5, MG9) e os planos das ordens 8+10 e 11** (emenda do portão: R1): a MG8 não recria `competitor_channel_removal_impact` nem `youtube_channel_removal_impact`, e não precisa que elas conheçam as tabelas de comentários (desvio 6). Se o corpo por catálogo de `competitor_channel_removal_impact` contar tabelas pela FK para `competitor_channels`, ele passa a contar sozinho `competitor_video_comment_snaps` e `competitor_video_comments` (as duas com FK direta `on delete cascade`), em qualquer ordem de aplicação; as leituras e as identidades só são alcançadas pelo comentário e ficam na função própria.
- **E17, passo 0 (ordem 9, MG11):** trocar `competitor_video_comments_select` e `competitor_video_comment_marks_select` para `can_view_private_site`; **não** tocar `competitor_video_comment_authors_select`. A metade "com o direito, lê o texto e recebe zero linhas da identidade" do item 232 só pode ser testada com a MG11: fica como teste **no plano dela**; aqui se prova a metade "sem o direito" e "quem edita".
- **E4 (ordem 16):** as marcas de views nas idades 1, 7 e 30 usam a mesma base de idade (desvio 3), ou a promessa "na mesma idade" de 4.6.4 quebra para estreias. `pool_stats` e `competitor_video_comment_marks.creator_replied` existem para a M11 e a M12 não nascerem como piso (seção 7, regra 9).
- **E9 (ordem 18):** "apagar" de comentário grava `competitor_removed_items` com `kind = 'comentario'` e `youtube_id` = o id do comentário: é isso que impede a volta (cenário C10). `competitor_video_purge` conta as quatro tabelas.
- **E10 (ordem 15):** a lista de tabelas do export **não contém** `competitor_video_comment_authors`; `competitor_channel_comment_impact` existe para a tela de remoção.

### 9.4 Tarefas, ordem e o que roda ao mesmo tempo

(emenda do portão: S-I6: a tabela anterior punha em paralelo tarefas que dependiam uma da outra; as dependências abaixo foram refeitas a partir dos `import` de cada contrato.)

| # | Tarefa | Arquivos (fechado) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Ledger | `progress.md` | — | todas |
| 1a | Os dois testes de banco (MG8 só no `bythiago_int`) | os dois testes de integração | `regras.ts` da 2, só para `MOTIVOS` no teste 34 (emenda 2 do portão: S-menor); o SQL é o do Apêndice A | 3 a 8, 10 |
| 1b | O arquivo da migration (**na vez do lote B, depois da MG10 e da MG9**) | o arquivo da migration | 1a; R2 | qualquer uma |
| 2 | Regras, tipos, erro (com `codigoDe`), ordem e frases | `regras.ts`, `tipos.ts`, `erro.ts`, `ordem.ts`, `frases.ts`, `comentarios-regras.test.ts` | — | 0, 7a |
| 3 | Normalizar | `normalizar.ts`, o teste, `comentarios-fixtures.ts` | 2 | 4, 5, 6, 7a, 7b, 8, 1a |
| 4 | Destaque | `destaque.ts`, o teste | 2 | 3, 5, 6, 7a, 7b, 8, 1a |
| 5 | Seleção | `selecao.ts`, o teste | 2 | 3, 4, 6, 7a, 7b, 8, 1a |
| 6 | Chamadas à API | `api.ts`, o teste | 2 | 3, 4, 5, 7a, 7b, 8, 1a |
| 7a | Sentry: redação dos ids (**vai a produção sozinha; lote a**) | `sentry-pii.ts`, `sentry-pii.test.ts`, `sentry-comentarios-http.test.ts` | o commit da R8 (já no HEAD, `b4f25dce`) | todas |
| 7b | Relato | `relato.ts`, o teste | 2 | 3, 4, 5, 6, 7a, 8, 1a |
| 8 | Gravar | `gravar.ts`, o teste | 2 (`codigoDe` vem de `erro.ts`; emenda 2 do portão: S-F1) | 3, 4, 5, 6, 7a, 7b, 1a |
| 10 | Prova (veredito) e anular | `prova.ts`, `anular.ts`, o teste | 2, 7b, 8 | 3, 4, 5, 6, 1a |
| 9 | Coletar | `coletar.ts`, o teste | 3, 4, 5, 6, 7a, 7b, 8, 10 | — |
| 11 | Integração contra o banco e varreduras | os dois testes | 1a, 9, 10 | — |
| 12 | Ligar na agenda (**pequena; a ÚNICA que espera a E16 parte 1 no HEAD**) | `agenda/tarefas/anular-identidade.ts`, `agenda/tarefas/retratos-comentarios.ts`, `agenda/catalogo.ts`, `rules.ts`, `conferencias.ts`, `test/lib/conferencias.test.ts`, `conferencias-com-data.md`, `docs/ops/env-vars.md`, `test/youtube/agenda/{tarefas,despachante}.test.ts`, **`agenda/executar.ts` (só uma importação e uma entrada em `antesDoLoteAntigo`; emenda 3 do portão: D-T1, S-T3)** | 9, 10, **E16 parte 1 com o contrato de registro e `antesDoLoteAntigo` (emenda 2 do portão: P1)**, mais os itens 9 e 10 de 9.3 no HEAD (emenda 3 do portão: D-T1, AG) | 13 |
| 13 | Ensaio com a API real em banco local | nenhum arquivo de código; o ledger | 11 (pergunta 2) | 12 |
| 14 | Portão: os dois especialistas, e o envio | o ledger; `regras.ts` (uma constante) e `conferencias.ts` (uma constante), no commit do envio | 11, 12, 13 | — |

**Seis frentes ao mesmo tempo depois da Tarefa 2:** 3, 4, 5, 6, 7b e 8 (a 8 importa `codigoDe` de `erro.ts`, da 2, e não da 7b: emenda 2 do portão: S-F1), mais a 1a, que só precisa de `regras.ts`. Nenhuma delas divide arquivo (os testes de regras têm arquivo próprio). A 10 entra quando a 7b e a 8 fecham; a 9 é a junção e roda sozinha.

**(emenda 3 do portão) O que a emenda 3 muda na ordem.** (a) A Tarefa 2 continua sendo a primeira e ganhou contrato (`codigoDe` com a forma real do aborto: S-T1; `FRASES_FIXAS` e frases sem prefixo: S-T2): quem já começou a 2 refaz `erro.ts`, `frases.ts` e os testes 8 e 10 antes de liberar as seis frentes. (b) A 8 e a 9 mudam só em teste e em um passo (`tolerancia_incoerente`): continuam nos mesmos arquivos e nas mesmas dependências. (c) **A Tarefa 12 passa a ser a única tarefa deste plano que edita um arquivo de código da E16 além do catálogo** (`agenda/executar.ts`, uma entrada): só começa com a Tarefa 12 da agenda commitada (o arquivo tem de existir) e com os itens 9 e 10 de 9.3 no HEAD; nunca roda ao mesmo tempo que uma tarefa da E16 que mexa em `executar.ts` ou em `catalogo.ts`. (d) Entre a E16 parte 1 em `main` e a Tarefa 12 daqui, a lista está vazia e a anulação não roda sem agenda: não há perda, porque sem a coleta (lote b) não existe identidade guardada.

**Envio.** Dois lotes, por lista explícita de commits.
- **Lote a (assim que a R8 estiver no HEAD):** a Tarefa 7a sozinha. Compila sozinha: só toca `sentry-pii.ts` e testes, sem importar nada de `comentarios/` (emenda do portão: S-I6; antes o lote a levava `relato.ts`, que importa de `api.ts` e de `tipos.ts`, e o `tsc` do pre-commit quebrava).
- **Lote b:** Tarefas 0 a 6 e 7b a 12, depois de: MG8 aplicada e conferida; E1 e E2 em `main`; E16 parte 1 em `main`; a Tarefa 13 feita; `COMMENT_SINCE` e `E14_DEPLOY` preenchidas; o acordo dos dois especialistas. **Promoção cedo no dia, antes das 13:00 de São Paulo** (emenda do portão: D-M1): a tarefa fica devida às 13:00 e, se a resposta à pergunta 1 for "sim", cada dia de atraso perde 6 retratos do marco 30.

---

## 10. As tarefas

**Restrições globais (valem em todas).** TypeScript estrito, sem `any`. **Sem Zod neste passo** (o erro do Zod carrega o valor): guardas à mão, no padrão de `competitor-capture.ts` (`obj`, `str`, `optCount`, `rowsAs`). Nenhum `console.*`. Nenhum `throw` com texto que não seja constante. Nenhuma leitura do banco com id de comentário ou de autor na URL (o `.in('youtube_comment_id', …)` do PostgREST vai para a URL e daí para o log do Supabase e para o breadcrumb do Sentry): lê-se por `video_id` (uuid nosso) ou por função (`rpc`, corpo de POST). **Toda ida ao banco deste passo leva tempo máximo** (`COMMENT_RULES.dbTimeoutMs`; emenda do portão: S-I4). **Nenhum módulo de `comentarios/` importa código de token OAuth** (`obterToken`, `ensureFreshToken`): o passo usa só a chave de API (emenda do portão: R6). Testes de módulo puro com `// @vitest-environment node`. Fixtures temporais sempre relativas a `now`. Saída de suíte para arquivo; no contexto só as falhas. Commit por tarefa, por caminho explícito.

**Testes de integração (emenda do portão: R5, S-I1).** Com `describe.skipIf(skipIfNoLocalDb())`, contra o `bythiago_int`, **um arquivo por vez**, com exatamente estas variáveis:

```
HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres
```

A versão anterior deste plano mandava `SUPABASE_URL=…`, que ninguém lê: o cliente de serviço usa `NEXT_PUBLIC_SUPABASE_URL` (`apps/web/lib/supabase/service.ts`) e `apps/web/test/setup.ts:15` a preenche com a porta 54321 quando falta; o `rpc` iria ao banco do navegador (que a regra manda nunca tocar) e o `pg` direto ao 54422. Os auxiliares que já existem (commit `69bd83c7`): `localSupabaseUrl()` em `apps/web/test/helpers/db-skip.ts` e `SUPABASE_URL` em `db-seed.ts`. **O primeiro teste de cada arquivo de integração** afirma que os dois caminhos falam com o mesmo banco: `to_regclass('public.competitor_video_comment_snaps')` não é nulo pelo `pg` direto, e um `select` de `competitor_video_comment_snaps` pelo cliente de serviço não devolve `PGRST205`. **Todo teste de integração cria o próprio site** (e apaga no fim) e **passa esse site a toda função que lista ou apaga** (`p_site_id` em `competitor_comment_due`, `competitor_comment_health` e `competitor_comment_identity_purge`; `siteId` no `TarefaCtx`): o banco é compartilhado com as outras etapas, que semeiam vídeos de até 14 dias. Neste Postgres local, **não chamar** função como `anon` ou `authenticated` sem `execute` (derruba o servidor): "quem executa" é provado por `has_function_privilege`.

**Foco de revisão (o que os revisores devem tentar quebrar):** (1) qualquer caminho em que texto de comentário, nome, id de autor, id de comentário ou número de inscritos chegue a um erro, a um retorno, ao Sentry, a uma coluna de motivo ou a uma URL do banco; (2) qualquer estado em que "não li" vire `sem_comentarios`, "não respondeu" ou "pequeno"; (3) identidade regravada, ou com prazo diferente de 28 dias; (4) corte por tempo ou por teto que não conte o que ficou; (5) ausência marcada por causa de uma chamada que falhou; (6) **número de prova que ninguém lê, ou que fica verde com parâmetro nulo** (emenda do portão: R9).

### Tarefa 0: ledger

(emenda do portão: R5, S-I1: a metade "URL do banco de teste por variável" **saiu**; já foi feita no lote de E1/E2, commit `69bd83c7`. Esta tarefa não edita `db-seed.ts`.)

- **Objetivo:** abrir o ledger.
- **Arquivos:** `.superpowers/sdd/a5-e14/progress.md`.
- **Contrato:** o ledger começa com: a linha da OP-3 (o catálogo cresce por etapa: `anular_identidade` e `retratos_comentarios` entram na ordem 6); os itens de aceite desta etapa com o estado; os fatos da seção 3; as perguntas 1 a 5 com a resposta que valer; a tabela de números de prova da Tarefa 10; a lista "dívida registrada" (seção 14) copiada; e **a versão das migrations do `bythiago_int`** (em 12/10 23h20 estava em `20261012000003`, uma atrás de produção: se continuar assim, avisar o controlador; a MG8 não depende da `…0004`; emenda do portão: D-M7).
- **Pronto quando:** o ledger existe com as seções acima.

### Tarefa 1: MG8 e os testes de banco (em duas metades)

(emenda do portão: R2: a tarefa foi partida. A metade 1a começa já; a 1b só cria o arquivo na vez do lote B.)

- **Objetivo:** os testes de banco das cinco funções (1a) e o arquivo da migration com o texto do Apêndice A (1b).
- **Arquivos:** 1a: `apps/web/test/integration/observatorio-a5-e14-migration.test.ts`, `apps/web/test/integration/observatorio-a5-e14-rls.test.ts`. 1b: `supabase/migrations/<carimbo>_observatorio_a5_e14_comentarios_de_destaque.sql`.
- **Como (1a):** aplicar no `bythiago_int` o texto de `.superpowers/sdd/a5-e14/mg8.sql` com `psql -X -f` **só desse arquivo** (é idempotente; nunca `db:reset`), e anotar no ledger que o banco de integração passou a tê-la. Antes, o roteiro inteiro dentro de transação: `cd .superpowers/sdd/a5-e14 && psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -X -f mg8-prova.sql` (faz `begin`, aplica duas vezes, roda os cenários C1 a C14 e as consultas V, e dá `rollback`). A aplicação segura `ShareRowExclusiveLock` em três tabelas por menos de 1 s: se outro agente estiver rodando teste de integração nesse segundo, o teste dele pode falhar por tempo; avisar no ledger a hora.
- **Como (1b), só na vez do lote B e depois de existirem os arquivos da MG10 e da MG9:** `npm run db:new observatorio_a5_e14_comentarios_de_destaque` (nunca à mão) e colar o Apêndice A sem mudar nada. `diff` contra `.superpowers/sdd/a5-e14/mg8.sql` vazio. `ls supabase/migrations | tail -3` mostra a MG10, a MG9 e a MG8, nessa ordem.
- **Testes de `…-migration.test.ts`** (cada um cria o próprio site, canal e vídeos e apaga no fim; toda chamada de lista, prova e rotina leva o site):
  1. `escrita: retrato ok grava retrato, comentários, leituras e identidade numa chamada`: 3 de topo (criador, destaque, comum) → 3 comentários, 3 leituras, **2** identidades (o criador não tem), `expires_at = first_seen_at + 28 dias`.
  2. `escrita: resposta do criador entra, a de terceiro não, e no máximo 3 por conversa`: 4 do criador + 1 de terceiro → 3 gravadas, as 3 mais antigas.
  3. `escrita: o mesmo retrato de novo devolve ja_existe e não muda nada`.
  4. `escrita: retrato em erro é substituído pelo ok e as unidades somam`.
  5. `escrita: recusa erro sem motivo, comentário em retrato que não é ok, marco 3 e prazo de identidade de 60 dias` (quatro `raise` ou `check`).
  6. `escrita: vídeo inexistente devolve video_ausente`.
  7. `escrita: comentário sem curtidas não é gravado e conta em nao_gravados` (nunca curtida 0).
  8. `escrita: comentário que volta num marco posterior atualiza texto e curtidas e NÃO regrava identidade` (item 126): primeiro com identidade apagada pela rotina, depois sem ter sido apagada (existia): nos dois, a contagem de linhas de identidade não muda.
  9. `escrita: destaque gravado não é apagado por marco sem destaque; criador_respondeu sim não vira nulo no comentário, e a leitura do marco guarda o que ESTA leitura viu` (emenda do portão: D-A7).
  10. `escrita: achado por id atualiza texto e curtidas com posição nula; id que não existe no banco não vira comentário`.
  11. `ausência: primeira entre 7 e 30 deixa miss_streak 1 e missing_since nulo; segunda marca; no marco 30 uma basta` (item 233), em chamadas separadas (o vídeo envelhece por SQL entre elas).
  12. `ausência: id que está em p_missing e também veio não é marcado`.
  13. `apagado pelo dono não volta e returned_seen_at é carimbado`.
  14. `duas escritas simultâneas do mesmo (vídeo, marco): uma grava, a outra recebe ja_existe` (duas conexões `pg`, `Promise.all`).
  15. `rotina: nada vencido apaga 0; vencida apaga, carimba author_purged_at e conta vencidas_ha_mais_de_1_dia; segunda vez apaga 0` (item 126); os sinalizadores do comentário são iguais antes e depois (comparação da linha).
  16. `rotina: erro no meio não muda nada` (item 232): dentro de uma transação, com um gatilho de teste que lança no `update` de `competitor_video_comments`, a chamada falha e as linhas de identidade continuam lá.
  17. `rotina: site sem identidade devolve apagadas 0 e restantes 0`; `rotina chamada para outro site não apaga a deste` (emenda do portão: R5).
  18. `devidos: site sem retrato devolve os vídeos na janela, ordenados pelo prazo, com total_due`; `o limite não esconde o total`; `outro site só vê os dele` (emenda do portão: S-I7).
  19. `devidos: fora da lista o de 5 horas, o de 4 dias, o com missing_since, o de canal com missing_since, o upcoming, o sem published_at; a transmissão conta do início real`.
  20. `devidos: retrato em erro volta depois de 20 horas e não antes; com motivo passageiro volta depois de 15 minutos e não antes; retrato final não volta`.
  21. `prova: site vazio devolve zeros, mapas vazios e primeira_coleta nula` (o estado "tabela vazia").
  22. `prova: identidade_vencida sobe com comentário de 29 dias e 1 hora com identidade; NÃO sobe com 28 dias e 23 horas`.
  23. `prova: identidade_de_criador, respostas_de_terceiros e identidade_prazo_errado sobem com a linha forjada por SQL direto e ficam em 0 com tudo gravado pela função` (os dois sentidos; "respostas_de_terceiros" só é forjável desligando a constraint dentro da transação do teste).
  24. `prova: retratos_atrasados sobe com vídeo de 9 dias sem retrato; NÃO sobe com vídeo de 8 dias, nem com o descoberto há 1 hora, nem com retrato em erro (esse vai para retratos_em_erro e para erros_por_motivo)`.
  25. `prova: retratos_perdidos_7d só conta janela aberta depois da primeira coleta (ou do corte, quando há), e não conta vídeo descoberto tarde; perdidos_por_motivo separa sem_retrato de cada motivo de erro` (emenda do portão: D-A5).
  26. `prova: site sem nada devolve zeros` (filtro por site).
  27. `remoção: competitor_channel_comment_impact conta as quatro tabelas e devolve not_found para canal de outro site; apagar o canal zera as quatro` (item 120).
  28. `colunas: competitor_video_comments só tem author_purged_at com prefixo author; competitor_video_comment_authors tem exatamente as sete colunas; nenhuma coluna de inscritos nem de razão nas quatro tabelas` (itens 113 e 146).
  29. **(emenda do portão: D-A1, R9)** `parâmetro nulo nunca é verde`: a prova com `p_now`, `p_marks` (nulo, objeto e lista vazia), `p_identity_days` ou `p_grace` nulos devolve **nulo** (cinco casos) e com tudo preenchido devolve objeto; com uma identidade de 40 dias gravada, `p_identity_days = 28` dá 1 e `null` dá nulo, não 0. A lista com `p_now` nulo ou `p_marks` que não é lista com itens **lança** (`22023`); com `p_limit` nulo devolve até 200; com `p_retry_after` nulo usa 20 horas; com `p_retry_fast` nulo usa 15 minutos.
  30. **(emenda do portão: D-A2)** `relógio de quem grava`: `taken_at` 12 dias no futuro é recusado (`22023`); 9 minutos no futuro passa; identidade com `first_seen_at` de hoje e `created_at` de 30 dias atrás (forjada por SQL) faz `identidade_vencida = 1` e `identidade_prazo_errado = 1`; desfeita a forja, 0 e 0.
  31. **(emenda do portão: D-A3)** `id repetido no pacote não derruba a escrita`: três de topo com o mesmo id mais o mesmo id como `via: 'id'` → um comentário, com o `slot` e a posição do primeiro do lote, `nao_gravados = 3`; dois `via: 'id'` iguais → um.
  32. **(emenda do portão: D-A4)** `o rótulo do marco é do banco`: marco 7 num vídeo de 30 h, marco 1 num de 8 dias, marco 1 num de 5 h, marco 1 com 72 h exatas e vídeo sem `published_at` devolvem `fora_da_tolerancia` e não gravam; 24 h exatas grava; a idade gravada é a calculada (30,00), não a mandada (999); retrato sem `from_h` ou `until_h` é recusado.
  33. **(emenda do portão: D-A6)** `corte p_since`: a lista com corte de 12 horas atrás traz só os marcos atingidos depois; com corte no futuro, nada; a prova com o mesmo corte não cobra o que a lista não lista (`retratos_atrasados = 0`, `retratos_na_janela` menor); com corte e nenhuma coleta, `retratos_perdidos_7d` conta as janelas fechadas depois do corte.
  34. **(emenda do portão: D-A7, R3)** `pool_stats e formato do motivo`: `pool_stats` com números e sim/não é gravado; com texto ou com lista é recusado (`22023`); `error_reason` com texto livre ("Failing row contains …") é recusado pelo check; cada item de `MOTIVOS` passa no check (o teste importa a lista do TypeScript).
- **Testes de `…-rls.test.ts`** (padrão de `observatorio-a5-e1-e2-rls.test.ts`: três usuários, `set local role`, `request.jwt.claims`, GUC `app.site_id` **forjado**):
  1. `anônimo e usuário de fora: zero linhas nas quatro`.
  2. `leitor (reporter): lê o retrato; zero linhas de texto, de leitura e de identidade` (sem a MG11).
  3. `editor: lê as quatro`.
  4. `ninguém além do service_role insere, altera ou apaga nas quatro` (tentativa por papel `authenticated` editor: recusada).
  5. `as cinco funções: execute só para service_role, e uma função por nome (nenhuma sobrecarga)` (por `has_function_privilege` e `pg_proc`, sem chamar).
  6. `a policy da identidade é can_edit_site` (lista `pg_policies`); `as duas de texto são can_edit_site sem a MG11`.
- **Armadilhas:** `(c.xmax = 0)` no `returning` é o que diz "inserido agora": não trocar por comparação de datas. O `on conflict … where c.parent_id is null` impede um id de resposta de sobrescrever um de topo. Não há `p_now` na rotina de propósito (ninguém adianta o relógio): os testes envelhecem as linhas por SQL direto. **A função de escrita calcula a idade do vídeo**: para testar um marco, o teste envelhece `published_at` por SQL (não basta mandar outro marco). **Efeito de uma função `volatile` não é visível a uma subconsulta da mesma instrução**: ler o que ela gravou numa instrução seguinte (o roteiro tropeçou nisso ao ser emendado). A lista de devidos virou `plpgsql` com `#variable_conflict use_column`: não tirar essa linha (os nomes de saída são iguais aos das colunas).
- **Pronto quando:** 1a: os 34 + 6 testes passam no `bythiago_int` com as três variáveis; `mg8-prova.sql` roda sem `ERROR` nem `FALHOU`. 1b: `diff` vazio; V1, V1b, V2, V3 e V4 (seção 11) dão o esperado no banco local.

### Tarefa 2: regras, tipos, erro, ordem e frases

(emenda do portão: S-I6, R3, S-I4, S-m1, D-A6.) **(emenda 4 do portão: S4-T1, S4-m5)** `frases.ts` ganha a coluna "Chaves de `n`", a regra de número ausente (devolve `''`) e o índice em `MOTIVOS` para o X; a Tarefa 2 não começa sem isto. Os arquivos e o número de testes (10) não mudam.

- **Arquivos:** `comentarios/regras.ts`, `comentarios/tipos.ts`, `comentarios/erro.ts`, `comentarios/ordem.ts`, `comentarios/frases.ts`, `apps/web/test/youtube/observatorio/comentarios-regras.test.ts`.
- **Contrato (`regras.ts`):**

```ts
export const COMMENT_RULES = {
  version: 1,
  target: 12, creatorMax: 4, featuredMax: 2, pool: 100, creatorRepliesMax: 3,
  featuredLookup: 20, featuredMinSubs: 100_000, featuredMinRatio: 10,
  identityDays: 28, bodyMax: 2000,
  marks: [{ mark: 1, fromH: 24, untilH: 72 }, { mark: 7, fromH: 168, untilH: 240 }, { mark: 30, fromH: 720, untilH: 888 }],
  dueFromHourSP: 13, callsMax: 60,
  startBudgetMs: 40_000,        // contado do começo da TAREFA: depois disto não começa retrato
  startsByMs: 130_000,          // contado de t0 (começo do disparo): depois disto a tarefa nem começa (é o `comecaAteMs` do catálogo)
  lastSnapStartsByMs: 170_000,  // contado de t0: depois disto não começa retrato
  callTimeoutMs: 6_000, dbTimeoutMs: 5_000,
  checkChunk: 50, checkBlocksMax: 3,
  callsPerSnapMax: 5,           // conversas + (inscritos OU contagem) + até 3 blocos de conferência por id
  dbPerSnapMax: 2,              // guardados + escrita
  dbAfterLoopMax: 3,            // cota (todos os sites em paralelo, uma espera) + prova do fim + 1 de folga
  retryAfterHours: 20, retryFastMinutes: 15, breakerAfter: 3, graceHours: 30, dueLimit: 200,
  stuckSameReasonRed: 3,
} as const
export const WORST_SNAP_MS = 5 * 6_000 + 2 * 5_000                       // derivado dos campos acima: 40.000
export const WORST_END_FROM_T0_MS = 170_000 + WORST_SNAP_MS + 3 * 5_000  // derivado: 225.000
/** 'a_decidir' = a pergunta 1 não foi respondida nem o envio preencheu: a tarefa para em vermelho. null = coletar tudo o que estiver na tolerância. ISO = só marco atingido a partir deste instante. */
export const COMMENT_SINCE: 'a_decidir' | null | string = 'a_decidir'
export const SIZE_BANDS = [['100k_1m', 100_000], ['1m_10m', 1_000_000], ['10m_mais', 10_000_000]] as const
export const RATIO_BANDS = [['10x_100x', 10], ['100x_1000x', 100], ['1000x_mais', 1000]] as const
/** O que pode ir a competitor_video_comment_snaps.error_reason. O banco só aceita ^[a-z0-9_]{1,40}$. */
export const MOTIVOS = ['resposta_sem_lista', 'resposta_ilegivel', 'lote_ilegivel', 'lista_vazia_com_contagem', 'contagem_ausente',
  'contagem_nao_lida', 'video_nao_encontrado', 'proibido', 'http_400', 'http_4xx', 'http_5xx', 'rede', 'tempo_esgotado'] as const
/** Falha que não é do vídeo: volta a ser devida em 15 minutos e deixa a execução vermelha. */
export const MOTIVOS_PASSAGEIROS = ['rede', 'tempo_esgotado', 'http_5xx', 'resposta_ilegivel', 'resposta_sem_lista', 'lote_ilegivel', 'contagem_nao_lida'] as const
/** Retrato perdido com este motivo não fica vermelho sozinho (vídeo só para membros). Três presos no mesmo motivo ficam (stuckSameReasonRed). */
export const MOTIVOS_PERDA_ACEITA = ['proibido'] as const
/** O que a tarefa devolve em `motivo` e o que vai para competitor_agenda_runs.reason: código, nunca texto. Em ordem de gravidade. */
export const CODIGOS_EXECUCAO = ['schema_ausente', 'prova_ilegivel', 'inicio_nao_decidido', 'identidade_vencida', 'identidade_invariante',
  'lista_de_devidos_ilegivel', 'cadastro_ilegivel', 'cota_esgotada', 'cota_nao_registrada', 'inesperado', 'falhas_passageiras', 'disjuntor',
  'consulta_de_autores_falhou', 'conferencia_falhou', 'retratos_atrasados', 'retratos_perdidos', 'erros_presos', 'banco'] as const
```

  As duas constantes derivadas são escritas como expressão sobre `COMMENT_RULES` (o bloco acima mostra os valores). `ruleParams()` devolve o que vai em `rule_params` do retrato: os tetos, o lote, os três parâmetros de destaque e os limites das faixas (para uma mudança de parâmetro não reescrever a leitura antiga). `countFreshHours` **saiu** (emenda do portão: D-M3: lista vazia sempre relê a contagem).
- **Contrato (`tipos.ts`):** `Marco = 1 | 7 | 30`; `EstadoRetrato`; `Motivo = typeof MOTIVOS[number]` (emenda do portão: R3: o `banco:${string}` saiu do tipo, porque código do Postgres nunca vai a `error_reason`); `CodigoExecucao = typeof CODIGOS_EXECUCAO[number]`; `Autor { nome: string | null; canalId: string | null; foto: string | null }`; `RespostaVista { id; texto; cortado; publicadoEm; editadoEm: string | null; curtidas: number; autorCanalId: string | null }`; `Conversa { id; posicao: number; texto; cortado: boolean; publicadoEm; editadoEm: string | null; curtidas: number; respostasTotal: number; autor: Autor; doCriador: boolean; criadorRespondeu: boolean | null; respostasDoCriador: RespostaVista[]; canaisNasRespostas: string[] }`; `Destaque { motivo: 'canal_acompanhado' | 'inscritos' | 'canal_proprio'; canalRowId: string | null; faixaTamanho: string | null; faixaRazao: string | null }`; `Escolhido { conversa: Conversa; grupo: 'criador' | 'destaque' | 'curtidos'; destaque: Destaque | null }`; `Devido` (as quinze colunas de `competitor_comment_due`, em camelCase, com `mark: Marco`); `ProvaComentarios` (as chaves de `competitor_comment_health`: os contadores como `number`, `erros_por_motivo` e `perdidos_por_motivo` como `Record<string, number>`, as duas datas como `string | null`); `AgregadosDoLote` (só `number` e `boolean`); `TarefaCtx { sb; apiKey: string; now: () => number; t0: number; inicioMs: number; siteId?: string; fetchImpl?: typeof fetch; apiBase?: string }` (`siteId` e `apiBase` só os testes passam); `TarefaSaida { status: 'ok' | 'parcial' | 'erro'; feitos: number; ficaram: number; motivo?: CodigoExecucao; numeros: Record<string, number> }`.
- **Contrato (`erro.ts`):** `class ComentariosErro extends Error { readonly codigo: Motivo | 'cota_esgotada' | 'limite_de_taxa' | 'comentarios_desligados'; readonly http: number | null }`. A mensagem é **sempre** `'comentarios: ' + codigo`. Nunca `cause`. **(emenda 2 do portão: S-F1)** `codigoDe(err: unknown): string` mora aqui (saiu de `relato.ts`, porque `gravar.ts` da Tarefa 8 e o adaptador da Tarefa 12 também a usam, e a 8 roda ao mesmo tempo que a 7b). O contrato de códigos: `err.codigo` se for `ComentariosErro`; **(emenda 3 do portão: S-T1) `'banco:tempo_esgotado'`, conferido ANTES das regras de `code`:** se `err.name` for `AbortError` ou `TimeoutError` (o `DOMException` tem `code` numérico 20 ou 23 e cairia em `sem_codigo`), **ou** se for objeto com `message` em texto que começa por `AbortError:` ou `TimeoutError:`. Esta segunda é a forma real: com o sinal abortado, o `postgrest-js` 2.103.2 não lança, devolve `error = { message: 'AbortError: This operation was aborted', details: <pilha>, hint: 'Request was aborted (timeout or manual cancellation)', code: '' }`, objeto simples e sem `name`. Só o prefixo é lido; a mensagem nunca é devolvida; `'banco:' + sqlstate.toLowerCase()` se for erro do banco com `code` de 5 caracteres alfanuméricos (objeto que **não** é instância de `Error`: o erro do PostgREST chega como objeto simples; `Error` com `code`, como o errno `EPIPE` ou `EBUSY` do Node, segue para `inesperado:`; emenda 3 do portão: S-m3) (**em minúsculas**: `22P05` tem letra maiúscula e o filtro de `relato.ts`, `/^[a-z0-9_:]+$/`, o trocaria por `codigo_invalido`); `'banco:pgrst' + os três dígitos` se o `code` for `PGRST` mais três dígitos; **`'banco:sem_codigo'`** se for erro do banco (objeto que não é instância de `Error`, com `message` em texto e `code`, `details` ou `hint`; emenda 3 do portão: S-m3) sem `code`, com `code` que não é texto ou que não casa com nenhuma das duas formas (é o que o PostgREST devolve sem SQLSTATE; sem esta linha cairia em `inesperado:` com nome vazio); senão `'inesperado:' + nome` com `nome` = `err.name` filtrado por `/^[A-Za-z]{1,30}$/` e em minúsculas (o **nome**, nunca a mensagem; nome vazio ou fora do filtro vira `'inesperado:desconhecido'`). Perde-se o rastro de pilha: é o preço, dito no ledger. **(emenda 3 do portão: S-m3)** Nenhum módulo de `comentarios/` usa `.throwOnError()`: com ele o erro do banco viria como `PostgrestError`, que estende `Error`, e cairia em `inesperado:`.
- **Contrato (`ordem.ts`):** `ordenar(conversas: Conversa[]): Conversa[]` (curtidas desc; `respostasTotal` desc; `posicao` asc; `id` em ordem alfabética). É o desempate de toda a etapa.
- **Contrato (`frases.ts`)** (emenda do portão: R3): `fraseDe(codigo: string, n: Record<string, number>): string`, pura. É **a única** fonte de texto que o dono lê neste passo; nenhum outro módulo de `comentarios/` tem frase em português. Código fora de `CODIGOS_EXECUCAO` devolve "falha de código desconhecido (ver Sentry)" (nunca o código cru, que poderia ser texto). **(emenda 3 do portão: S-T2)** As frases **não levam o prefixo "comentários: " nem ponto final**: quem prefixa é `fraseDoMotivo` da agenda, com o `rotulo` da tarefa. `frases.ts` exporta também `FRASES_FIXAS: Record<CodigoExecucao, string>`: uma frase por código, **sem número variável**, sem ponto final e sem `$`, `{` ou `%` (é o valor do campo `motivos` do registro da tarefa, Tarefa 12). `fraseDe` devolve a frase com números e, para código fora de `CODIGOS_EXECUCAO`, a frase de "desconhecido" acima. **(emenda 4 do portão: S4-T1) De onde vem cada número.** `n` é o `numeros` que a tarefa devolve (`TarefaSaida.numeros`, e `detalhe` na agenda); a coluna "Chaves de `n`" da tabela diz de qual chave sai cada letra, e **são os mesmos nomes que as Tarefas 9 e 10 gravam**: um nome só, nenhum `n.n`. `X` é um **índice em `MOTIVOS`** (número; fora da faixa ou não inteiro = "outro"): `Record<string, number>` não carrega texto, e o motivo mais comum nunca é texto livre. **Se uma chave que a frase usa estiver ausente ou não for número finito, `fraseDe` devolve `''`** (a agenda cai na frase fixa de `motivos`); nunca escreve "undefined" nem "NaN". As frases, por código:

| Código | Frase com números, de `fraseDe` (N, M, K e X vêm de `n`, pelas chaves da quarta coluna; X é um índice em `MOTIVOS`) | Frase fixa, de `FRASES_FIXAS` (emenda 3 do portão: S-T2) | Chaves de `n` (emenda 4 do portão: S4-T1) |
|---|---|---|---|
| `schema_ausente` | "migration MG8 não aplicada. Nada foi gravado" | "migration MG8 não aplicada; nada foi gravado" | nenhuma |
| `prova_ilegivel` (emenda 4 do portão: D4-m4, S4-m5: "nada foi coletado" era falso no fim da coleta, com retratos já gravados, e na anulação, que não coleta e já apagou; a frase vale para as três origens e para o começo, que sai como `schema_nao_conferido` e usa a mesma frase) | "não foi possível ler a prova (banco)" | "não foi possível ler a prova (banco)" | nenhuma |
| `inicio_nao_decidido` | "a data de início da coleta não foi decidida (COMMENT_SINCE). Nada foi coletado" | "a data de início da coleta não foi decidida (COMMENT_SINCE); nada foi coletado" | nenhuma |
| `identidade_vencida` | "identidade de autores vencida e não apagada: N. A coleta parou até a rotina de anulação rodar" | "identidade de autores vencida e não apagada; a coleta parou até a anulação rodar" | N = `identidade_vencida` |
| `identidade_invariante` | "a guarda da identidade está quebrada (prazo diferente de 28 dias: N; identidade de criador: M; respostas de terceiros: K)" | "a guarda da identidade está quebrada (prazo diferente de 28 dias, identidade de criador ou respostas de terceiros)" | N = `identidade_prazo_errado`, M = `identidade_de_criador`, K = `respostas_de_terceiros` |
| `lista_de_devidos_ilegivel` | "não foi possível ler a lista do que está devido. Nada foi coletado" | "não foi possível ler a lista do que está devido; nada foi coletado" | nenhuma |
| `cadastro_ilegivel` | "não foi possível ler os canais acompanhados. Nada foi coletado" | "não foi possível ler os canais acompanhados; nada foi coletado" | nenhuma |
| `cota_esgotada` | "a cota do YouTube acabou; N retratos ficaram para o próximo disparo" | "a cota do YouTube acabou; ficaram retratos para o próximo disparo" | N = `ficaram` |
| `cota_nao_registrada` | "N unidades de cota não registradas" | "unidades de cota não registradas" | N = `unidades_nao_registradas` |
| `inesperado` | "N retratos falharam com erro inesperado (ver Sentry)" | "retratos falharam com erro inesperado (ver Sentry)" | N = `inesperados` |
| `falhas_passageiras` | "N leituras falharam (motivo mais comum: X); nova tentativa no próximo disparo" | "leituras falharam; nova tentativa no próximo disparo" | N = `falhas_passageiras`, X = `motivo_mais_comum` |
| `disjuntor` | "três falhas seguidas (X); a execução parou e N retratos ficaram" | "três falhas seguidas; a execução parou e ficaram retratos por fazer" | X = `motivo_mais_comum`, N = `ficaram` |
| `consulta_de_autores_falhou` | "a consulta de tamanho dos autores falhou N vezes seguidas" | "a consulta de tamanho dos autores falhou em todas as tentativas da execução" | N = `consultas_de_autor_falhas` |
| `conferencia_falhou` | "a conferência dos comentários guardados falhou N vezes seguidas" | "a conferência dos comentários guardados falhou em todas as tentativas da execução" | N = `conferencias_falhas` |
| `retratos_atrasados` | "N vídeos passaram do marco sem retrato e não estavam na lista" | "vídeos passaram do marco sem retrato e não estavam na lista" | N = `retratos_atrasados` |
| `retratos_perdidos` | "N retratos perdidos nos últimos 7 dias (a janela fechou sem retrato)" | "retratos perdidos nos últimos 7 dias (a janela fechou sem retrato)" | N = `perdidos_fora_do_aceito` |
| `erros_presos` | "N retratos presos no mesmo motivo (X)" | "retratos presos no mesmo motivo" | N = `erros_presos_max`, X = `motivo_preso` |
| `banco` | "o banco não respondeu a tempo ou recusou (N vezes)" | "o banco não respondeu a tempo ou recusou" | N = `erros_de_gravacao` |

- **Testes (`comentarios-regras.test.ts`):** (os testes 9 e 10 vieram da Tarefa 7b; emenda 2 do portão: S-F1)
  1. `as janelas dos marcos não se sobrepõem e estão em ordem`.
  2. `todo motivo passageiro e todo motivo de perda aceita está na lista de motivos`.
  3. `todo motivo e todo código de execução casa com ^[a-z0-9_]{1,40}$` (o check do banco; R3).
  4. `identityDays é 28` (o banco recusa mais que isso).
  5. **(emenda do portão: S-I4, S-m1)** `os limites cabem na função`: `WORST_SNAP_MS = callsPerSnapMax × callTimeoutMs + dbPerSnapMax × dbTimeoutMs`; `startsByMs + startBudgetMs ≤ lastSnapStartsByMs`; `WORST_END_FROM_T0_MS ≤ COMPETITORS_MAX_DURATION_S × 1000 − PROOF_TIMEOUT_MS − RECORD_RESERVE_MS` (225.000 ≤ 265.000; as três constantes são importadas de `competitor-sync-batch.ts`); `callsPerSnapMax = 2 + checkBlocksMax`.
  6. `COMMENT_SINCE é 'a_decidir', null ou um instante ISO que Date aceita` (emenda do portão: D-A6).
  7. `ordenar: empate em curtidas decide respostasTotal, depois posição, depois id`; `a mesma lista embaralhada dá a mesma ordem`.
  8. `fraseDe: todo código de CODIGOS_EXECUCAO tem frase própria` (nenhum cai na frase de "desconhecido"); `código que não está na lista, inclusive um texto com a sentinela, devolve a frase fixa sem a sentinela`; `X fora de MOTIVOS vira "outro"` (o motivo mais comum nunca é texto livre). **(emenda 3 do portão: S-T2)** `FRASES_FIXAS tem exatamente as chaves de CODIGOS_EXECUCAO; nenhuma frase, fixa ou com números, começa por "comentários:", termina em ponto, contém $, { ou %, nem passa de 160 caracteres com n = 999.999 em todo número`. **(emenda 4 do portão: S4-T1)** `para cada código com número: fraseDe(codigo, {}) e fraseDe(codigo, { <chave>: NaN }) devolvem ''; com as chaves da tabela a frase traz cada número`; `motivo_mais_comum = MOTIVOS.indexOf('http_5xx') escreve http_5xx; −1 e 99 escrevem outro`. **(emenda 4 do portão: D4-m4, S4-m5)** `a frase de prova_ilegivel não contém "coletado"`.
  9. **(emenda 2 do portão: S-F1)** `codigoDe: erro do banco com message e details contendo a sentinela devolve só banco:23514`; `22P05 devolve banco:22p05 e passa no filtro de relato`; `PGRST202 devolve banco:pgrst202`; `erro do banco sem code, ou com code numérico, devolve banco:sem_codigo`.
  10. **(emenda 2 do portão: S-F1)** `codigoDe: ComentariosErro devolve o código; TypeError devolve inesperado:typeerror; valor que não é objeto (texto com a sentinela, nulo) devolve inesperado:desconhecido`; **(emenda 3 do portão: S-T1)** `a forma real do cliente, { message: 'AbortError: This operation was aborted', details: 'pilha com a sentinela', hint: 'Request was aborted (timeout or manual cancellation)', code: '' }, devolve banco:tempo_esgotado e não banco:sem_codigo`; `new DOMException('x', 'AbortError') e new DOMException('y', 'TimeoutError') (code 20 e 23) devolvem banco:tempo_esgotado`; **(emenda 3 do portão: S-m3)** `Error lançado com code 'EPIPE' devolve inesperado:error, não banco:epipe nem banco:sem_codigo`.
- **Pronto quando:** compila e os 10 testes passam. **É a primeira a ser commitada**: destrava 3 a 8.

### Tarefa 3: normalizar

- **Objetivo:** transformar a resposta de `commentThreads.list` e de `comments.list` em valores nossos, sem deixar passar forma inesperada.
- **Arquivos:** `comentarios/normalizar.ts`; `comentarios-normalizar.test.ts`; `comentarios-fixtures.ts`.
- **Contrato:**
  - `limparTexto(s: string): { texto: string; cortado: boolean }`: `sanitizeForDb` e corte em `bodyMax` **pontos de código** (`Array.from`).
  - `conversaDe(item: unknown, posicao: number, canalDoVideo: string): Conversa | null`: nulo quando falta `snippet.topLevelComment.id`, `likeCount` numérico (via `optCount`), `publishedAt` **que `Date.parse` aceite** (uma data ilegível derrubaria a escrita do retrato inteiro, a cada tentativa: mesma classe de S-I2 e D-A3) ou `textDisplay` (tem de ser texto e não vazio depois da limpeza: comentário sem texto é descartado). `doCriador` = `authorChannelId.value === canalDoVideo`. `respostasDoCriador` = as respostas vistas cujo autor é o canal do vídeo, **as mais antigas primeiro**, no máximo `creatorRepliesMax`, **sem id repetido**. `criadorRespondeu`: `true` se houver ao menos uma; `false` se `respostas vistas === totalReplyCount` e nenhuma é dele; `null` se vieram menos que `totalReplyCount` e nenhuma é dele; com `totalReplyCount` ausente e nenhuma resposta vista, `null`. `canaisNasRespostas` = ids de canal distintos das respostas vistas (para a regra (a)); **o texto e o nome das respostas de terceiros não saem desta função**.
  - `loteDe(body: unknown, canalDoVideo: string): { conversas: Conversa[]; descartadas: number; completo: boolean } | null`: nulo quando `items` não é lista. `completo` = não há `nextPageToken`. **Conversa de id repetido é descartada (fica a primeira) e conta em `descartadas`** (emenda do portão: D-A3).
  - `porIdDe(body: unknown): Map<string, { texto; cortado; editadoEm; curtidas; respostasTotal: number | null }> | null`: nulo quando `items` não é lista.
  - **(emenda do portão: D-A7)** `agregadosDoLote(lote: { conversas: Conversa[]; descartadas: number }, t0Ms: number): AgregadosDoLote`, pura. Chaves, todas número: `conversas`, `descartadas`, `curtidas_soma`, `curtidas_max`, `curtidas_mediana`, `respostas_soma`, `do_criador`, `criador_respondeu_sim`, `criador_respondeu_nao`, `criador_respondeu_nao_se_sabe`, `autores_distintos`, `sem_canal`, `nas_primeiras_24h` (comentários publicados até 24 h depois de `t0`). Lote vazio: tudo 0 e `curtidas_max` e `curtidas_mediana` ausentes (não 0). **Nenhum texto, nome ou id** (o banco recusa).
- **Testes:**
  1. `conversa completa`: todos os campos, `editadoEm` nulo quando `updatedAt = publishedAt`.
  2. `criador_respondeu: sim com resposta do canal do vídeo entre as vistas` (item 110).
  3. `criador_respondeu: não só quando vistas = total` (3 de 3, nenhuma dele).
  4. `criador_respondeu: nulo quando vieram 5 de 811 e nenhuma é dele`.
  5. `comentário de topo do criador: doCriador verdadeiro`.
  6. `no máximo 3 respostas do criador, as mais antigas`.
  7. `descarta conversa sem id, sem likeCount, com likeCount "abc", sem publishedAt, com publishedAt "ontem", sem texto`: 6 entradas, 6 nulos, e `loteDe` conta `descartadas = 6`.
  8. `autor sem authorChannelId: canalId nulo, doCriador falso`.
  9. `texto com 2.001 caracteres é cortado e marcado; com 2.000 não` (item 116); `texto com emoji no corte não parte o par`.
  10. `texto com NUL e substituto solitário é limpo` (usa `sanitizeForDb`); `texto com <script> e HTML fica como veio` (é texto; quem escapa é a tela).
  11. `lote sem items, com items objeto, com corpo nulo: nulo` (nunca lista vazia).
  12. `lote com items [] é lista vazia, completo`.
  13. `completo é falso com nextPageToken`.
  14. `por id: 10 pedidos, 9 devolvidos: mapa com 9`; `sem items: nulo`.
  15. `nenhuma resposta de terceiro tem texto na saída` (varre o objeto devolvido por uma sentinela posta no texto de uma resposta de terceiro).
  16. **(emenda do portão: D-A3)** `duas conversas com o mesmo id: uma, e descartadas 1`; `duas respostas do criador com o mesmo id: uma`.
  17. **(emenda do portão: D-A7)** `agregados: 5 conversas conhecidas dão as 13 chaves certas`; `lote vazio não inventa máximo nem mediana`; `a saída serializada não contém nenhuma das sentinelas de texto, nome e id da fixture, e todo valor é número`.
- **Armadilha:** `replies` pode não existir (16 de 100 na C0.3): é "zero respostas vistas", e aí `criadorRespondeu` é `false` só se `totalReplyCount === 0`.
- **Pronto quando:** os 17 passam; a fixture não tem nenhum texto, nome ou id real (os ids são do tipo `Ugx-sintetico-01`).

### Tarefa 4: destaque

- **Arquivos:** `comentarios/destaque.ts`; `comentarios-destaque.test.ts`.
- **Contrato:**
  - `quemConsultar(conversas: Conversa[], ctx: { canalDoVideo: string; acompanhados: Map<string, string>; proprios: Set<string> }): { ids: string[]; semId: number }`: dos `featuredLookup` comentários de topo mais curtidos (**`ordenar`, de `comentarios/ordem.ts`**; emenda do portão: S-I6: antes era "a ordem da Tarefa 5", uma dependência escondida), os `canalId` distintos que não são o criador, nem acompanhado, nem do dono. `semId` = quantos desses 20 não têm `canalId`.
  - `inscritosDe(body: unknown, pedidos: string[]): Map<string, number | null> | null`: nulo quando a resposta não dá para ler (sem `items` **e** `pageInfo.totalResults` diferente de 0, ou ausente). `items` ausente com `totalResults = 0` é mapa vazio (o YouTube omite `items` quando nenhum id existe). Valor `null` = `hiddenSubscriberCount` ou sem `subscriberCount` numérico.
  - `destaqueDe(c: Conversa, ctx: { …; inscritosDoCanalDoVideo: number | null; inscritos: Map<string, number | null> | null }): Destaque | null`. Ordem: (a) `canalId` do comentário **ou** algum de `canaisNasRespostas` é acompanhado → `canal_acompanhado` com `canalRowId` (se os dois forem, o do comentário); o autor é canal do dono → `canal_proprio`; (b) inscritos ≥ `featuredMinSubs` **e** (razão ≥ `featuredMinRatio` **ou** razão não se sabe) → `inscritos` com as faixas. O criador nunca é destaque.
  - `desconhecidos(...)`: quantos dos consultados ficaram "não se sabe" (para `featured_unknown_n`).
- **Testes** (item 144, bordas):
  1. `99.999 inscritos: não é destaque`.
  2. `100.000 e razão 9,9: não é`.
  3. `100.000 e razão 10: é, faixas 100k_1m e 10x_100x`.
  4. `bordas das faixas: 999.999 → 100k_1m; 1.000.000 → 1m_10m; 10.000.000 → 10m_mais; razão 100 → 100x_1000x; razão 1.000 → 1000x_mais`.
  5. `inscritos ocultos: não é destaque e conta em desconhecidos`.
  6. `autor sem id: não consultado e conta em semId`.
  7. `canal do vídeo com inscritos nulos, e com 0: vale só o piso, faixa da razão nula`.
  8. `canal acompanhado ganha de canal grande` (autor acompanhado **e** com 5 milhões: motivo `canal_acompanhado`).
  9. `canal acompanhado numa resposta vista marca o comentário de topo`.
  10. `autor é canal do dono: canal_proprio, sem canalRowId`.
  11. `consulta falhou (mapa nulo): ninguém por tamanho; os de (a) continuam`.
  12. `quemConsultar: no máximo 20, sem o criador, sem acompanhados, sem os do dono, sem repetir` (item 145).
  13. `canal devolvido a menos: conta em desconhecidos`.
  14. `nenhum número de inscritos nem razão exata na saída` (o tipo `Destaque` não tem campo numérico; teste que serializa e procura a sentinela 437000000: item 146).
- **Pronto quando:** os 14 passam.

### Tarefa 5: seleção

- **Arquivos:** `comentarios/selecao.ts`; `comentarios-selecao.test.ts`.
- **Contrato:** `selecionar(conversas, destaques: Map<string, Destaque>, r = COMMENT_RULES): Escolhido[]`, usando `ordenar` de `comentarios/ordem.ts` (emenda do portão: S-I6). Três grupos nesta ordem, cada comentário em um só: **criador** (até 4: `doCriador` ou `criadorRespondeu === true`); **destaque** (até 2, fora os já escolhidos: primeiro `canal_acompanhado` e `canal_proprio`, depois `inscritos` da faixa maior para a menor, empate pela ordem geral); **curtidos** (o que faltar para 12). Vaga não usada de criador ou destaque passa para curtidos. Lote com menos de 12: todos. O `destaque` do `Escolhido` é preenchido para todo comentário que o tenha, qualquer que seja o grupo.
- **Testes** (item 109 e 149):
  1. `reproduzível: a mesma lista embaralhada dentro do mesmo likeCount dá os mesmos escolhidos, na mesma ordem` (20 embaralhamentos com semente fixa).
  2. `lote de 5: os 5`; `lote de 100: 12`; `lote vazio: lista vazia`.
  3. `nenhum com o criador: 0 em criador, as 4 vagas vão para curtidos`.
  4. `mais de 4 com o criador: 4 em criador (os mais curtidos), os outros disputam como comuns`.
  5. `o mais curtido que também tem resposta do criador entra uma vez, no grupo criador, com os dois sinalizadores`.
  6. `criadorRespondeu nulo NÃO entra no grupo criador`.
  7. `preferência nas duas vagas: acompanhado antes de grande; entre os grandes, faixa maior primeiro`.
  8. `comentário de destaque já escolhido em criador não ocupa vaga de destaque`.
  9. `sempre no máximo 12 e nunca repetido` (propriedade, 200 lotes aleatórios com semente fixa).
- **Pronto quando:** os 9 passam (o teste de empate passou para a Tarefa 2, com `ordenar`).

### Tarefa 6: chamadas à API

- **Objetivo:** as quatro chamadas, com o corpo limpo na entrada, erro classificado por código fixo e contagem de unidades.
- **Arquivos:** `comentarios/api.ts`; `comentarios-api.test.ts`.
- **Contrato:**
  - `criarApi(o: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs: number; base?: string }): { conversas(videoId): Promise<unknown>; inscritos(ids: string[]): Promise<unknown>; porId(ids: string[]): Promise<unknown>; contagem(videoId): Promise<number | null>; unidades(): number }`. `base` tem padrão `https://www.googleapis.com/youtube/v3` e só os testes a passam (o servidor local da Tarefa 7a e da Tarefa 9, teste 23); uma varredura da Tarefa 11 afirma que nenhum arquivo de `src/` passa `base` nem `apiBase`. `ComentariosErro` vem de `comentarios/erro.ts`.
  - **Todo corpo JSON passa por `sanitizeForDb(body).value` antes de ser devolvido** (um ponto só, como o `api()` da E1) (emenda do portão: S-I2). A versão anterior só limpava o texto do comentário: um `authorDisplayName` com NUL ou com meio par UTF-16 ia cru dentro de `p_comments`, o Postgres recusava o `jsonb` (`22P05`), o retrato era tentado de novo a cada disparo até a tolerância acabar, e o marco se perdia.
  - URLs: `commentThreads?part=snippet,replies&videoId=…&order=relevance&maxResults=100&textFormat=plainText`; `channels?part=statistics&id=…` (até 50; o plano manda até 20); `comments?part=snippet&id=…&textFormat=plainText` (**sem `maxResults`**; até 50 ids, senão `invalidFilters`); `videos?part=statistics&id=…`. Toda chamada soma 1 unidade **antes** do `fetch` (uma chamada que falha também gasta) e leva `AbortSignal.timeout(timeoutMs)`.
  - Classificação, só por `status` e por `error.errors[0].reason` validado contra `/^[A-Za-z]{1,40}$/`: 403 `commentsDisabled` → `comentarios_desligados`; 403 `quotaExceeded` ou `dailyLimitExceeded`, e 429 → `cota_esgotada` ou `limite_de_taxa`; 404 `videoNotFound` → `video_nao_encontrado`; outro 403 → `proibido`; 400 → `http_400`; outro 4xx → `http_4xx`; 5xx → `http_5xx`; `TimeoutError` ou `AbortError` → `tempo_esgotado`; outro erro do `fetch` → `rede`; corpo que não é JSON → `resposta_ilegivel` (o `catch` troca o erro do `JSON.parse`, que cita um pedaço do corpo, pela mensagem fixa).
  - `contagem`: `statistics.commentCount` via `optCount`; ausente → `null`; resposta sem `items` → lança `resposta_sem_lista`.
- **Testes** (com `fetch` falso):
  1. `conversas: a URL tem os cinco parâmetros e não tem pageToken`.
  2. `por id: a URL não tem maxResults; 51 ids lança antes de chamar` (erro de programação, código `http_400`, 0 unidades).
  3. `inscritos: no máximo 50 ids; lista vazia não chama` (0 unidades).
  4. `cada chamada soma 1 unidade, inclusive a que falha`.
  5. `403 commentsDisabled → comentarios_desligados` (corpo da fixture `c03-comments-disabled.json`, que é só forma).
  6. `403 quotaExceeded → cota_esgotada; 429 → limite_de_taxa`.
  7. `404 videoNotFound → video_nao_encontrado; 403 forbidden → proibido; 400 → http_400; 503 → http_5xx`.
  8. `tempo esgotado → tempo_esgotado; fetch que lança → rede`.
  9. `corpo "<html>…" com status 200 → resposta_ilegivel`.
  10. `a mensagem de todo erro é só o código`: para cada caso acima, com um corpo de erro que contém a sentinela `TEXTO-SENTINELA-123` em `error.message` e em `reason` (um `reason` com espaço ou com 80 letras é ignorado), `String(err)`, `err.message`, `err.stack` e `JSON.stringify(err)` não contêm a sentinela nem a chave de API.
  11. `contagem: commentCount "57" → 57; ausente → nulo; sem items → lança`.
  12. **(emenda do portão: S-I2)** `corpo com NUL e substituto solitário no nome do autor, na foto e no texto sai limpo`: o objeto devolvido por `conversas` não tem `\u0000` nem substituto solitário em nenhuma string, e `JSON.stringify` dele é aceito por um `::jsonb` do Postgres (a metade de banco é o teste 9 da Tarefa 11).
  13. `sem base, a URL começa por https://www.googleapis.com/youtube/v3/` (teste do padrão, sem passar o parâmetro: regra do projeto).
- **Armadilha:** não reusar o `api()` de `competitor-sync.ts` (é interno do `runChannel` e tem 10 s de tempo). A chave vai na URL como nas outras chamadas do projeto; quem a tira da telemetria é o commit da R8, e quem tira os ids é a Tarefa 7a.
- **Pronto quando:** os 13 passam.

### Tarefa 7a: Sentry, a redação dos ids de autor e de comentário. Fecha a C0.9

(emenda do portão: S-C1, R8. A tarefa foi reescrita. O que **saiu** dela: `key` em `redact-secrets.ts` e o registro de `YOUTUBE_API_KEY` nas duas configurações, que são do commit de fora dos planos. O que **mudou**: a regra deixa de ser "sobre a URL" e passa a ser "por campo", porque o SDK não põe a query na URL.)

- **Objetivo:** nenhum id de canal de autor nem id de comentário sai do processo para o Sentry pelas chamadas HTTP deste passo. Vai a produção sozinha (lote a).
- **Depende de:** o commit da R8, **que já está no HEAD (`b4f25dce`, 12/10 23:21; emenda 2 do portão: fato vencido, a 7a pode começar já)**. Em 12/10 23h20 ele estava em andamento em outro terminal (os testes `apps/web/test/lib/sentry-redigir-url.test.ts` e `sentry-configs-redigem-chave.test.ts` existem sem commit e importam `@/lib/redigir-segredos-de-url`, que ainda não existe). **Antes de começar:** `git log --oneline -3 -- apps/web/src/lib/sentry-pii.ts` e ler o que ele deixou; esta tarefa parte dali e não refaz a redação da chave.
- **Arquivos:** `apps/web/src/lib/sentry-pii.ts`; `apps/web/test/lib/sentry-pii.test.ts`; `apps/web/test/lib/sentry-comentarios-http.test.ts` (novo).
- **Por que por campo (provado pelo revisor de software no SDK instalado, `@sentry/nextjs` 10.48.0):** no breadcrumb de `fetch` do Node, `data.url` vem **sem** a query e a query vai em `data['http.query']` (`node_modules/@sentry/node-core/build/cjs/utils/outgoingFetchRequest.js:197-204`); no span `http.client`, em `http.query` e `url.query`, além de `http.url` e `url.full` (`node_modules/@sentry/core/build/cjs/fetch.js:313`, `utils/url.js:146`). `scrubRecordStrings` passa cada string de `data` sozinha pela redação: o valor `?part=snippet&id=Ugx…,Ugy…` não tem host nem caminho, e uma regra "sobre a URL" não casa. Os ids de até 20 autores por retrato sairiam em todo evento de erro do processo e em 10% das transações.
- **Contrato (`sentry-pii.ts`):** uma função interna `redigirConsultaDeComentarios(data: Record<string, unknown> | undefined, descricao?: string): string | undefined`, chamada por `scrubBreadcrumbPii` (com `breadcrumb.data`) e por `scrubEventPii` (para cada breadcrumb e para cada span, com `span.data` e `span.description`), **antes** de `scrubDataRecord` (os dois pontos de chamada: `sentry-pii.ts:208` e `:266`; é ela que chama `scrubRecordStrings` por dentro; emenda 3 do portão: S-m2):
  - **Casa** quando algum de `data.url`, `data['http.url']`, `data['url.full']` ou a descrição contém o caminho `/youtube/v3/comments`, `/youtube/v3/commentThreads` ou `/youtube/v3/channels` (regex **ancorada no caminho, não no host**: `/\/youtube\/v3\/(?:comments|commentThreads|channels)(?:[?#\s]|$)/`).
  - **Quando casa:** `data['http.query']` e `data['url.query']` viram `'[REDACTED]'` inteiros (se existirem); em `data.url`, `data['http.url']`, `data['url.full']` e na descrição, tudo depois do primeiro `?` vira `[REDACTED]`; `data['http.fragment']` e `data['url.fragment']`, se existirem, idem.
  - **Quando não casa:** nada muda (as chamadas a `videos`, `playlistItems` e as outras seguem como o commit da R8 as deixou).
  - Efeito colateral aceito: as chamadas a `channels` que a E1 já faz (ids de canal de concorrente, que não são sensíveis) perdem a query no Sentry. Anotar no ledger (emenda do portão: S-m9).
- **Testes de `sentry-pii.test.ts` (formas copiadas do SDK, não inventadas):**
  1. `breadcrumb http real`: `{ category: 'http', data: { url: 'https://www.googleapis.com/youtube/v3/comments', 'http.method': 'GET', 'http.query': '?part=snippet&id=UgxSENTINELAcomentario01,UgxB&textFormat=plainText&key=K' } }` → `http.query` é `[REDACTED]`; a serialização não contém `UgxSENTINELA`.
  2. `span http.client real`: `{ op: 'http.client', description: 'GET https://www.googleapis.com/youtube/v3/channels', data: { 'http.url': '…/channels?part=statistics&id=UCsentinelaAUTOR000000001&key=K', 'url.full': idem, 'http.query': '?part=statistics&id=UCsentinelaAUTOR000000001&key=K', 'url.query': idem } }` → os quatro campos sem o id.
  3. `commentThreads: a query some inteira` (o `videoId` não é sensível, mas a regra é uma só para as três rotas).
  4. `videos e playlistItems: http.query continua lá` (só o que o commit da R8 tirar): o outro sentido.
  5. `breadcrumb sem data, span sem data, data.url que não é texto: não lança e não muda nada`.
  6. `host diferente com o mesmo caminho (http://127.0.0.1:PORTA/youtube/v3/comments) também é redigido` (a regra é pelo caminho; é o que deixa o teste de HTTP de verdade valer).
- **Teste de `sentry-comentarios-http.test.ts` (emenda do portão: S-C1, R8: chamada HTTP de verdade, não `fetch` falso):**
  7. Sobe um servidor `http` do Node em `127.0.0.1` numa porta livre, que responde JSON fixo e sintético em `/youtube/v3/commentThreads`, `/youtube/v3/channels`, `/youtube/v3/comments` e `/youtube/v3/videos`. Inicializa `@sentry/nextjs` com `dsn` falso, **`tracesSampleRate: 1`**, `beforeSend`, `beforeSendTransaction` e `beforeBreadcrumb` **importados dos mesmos módulos que `sentry.server.config.ts` usa**, e um `transport` que guarda os envelopes. Dentro de `Sentry.startSpan`, faz com o **`fetch` global** as quatro chamadas, com as sentinelas na query (`id=UgxSENTINELAcomentario01,…` em `comments`; `id=UCsentinelaAUTOR000000001,…` em `channels`), depois `Sentry.captureException(new Error('falha de teste'))` e `Sentry.flush()`. **Afirmações positivas** (sem elas o teste passaria por não ter enviado nada): há um envelope de transação com um span `http.client` para **cada uma** das quatro rotas; há um evento de erro com breadcrumbs `http` das quatro. **Afirmações negativas:** nenhum envelope serializado contém `UgxSENTINELAcomentario01` nem `UCsentinelaAUTOR000000001`.
- **Armadilha (não validado):** se a instrumentação de `fetch` do SDK não rodar sob o vitest (ambiente `node`), as afirmações positivas do teste 7 **falham**. Nesse caso: (i) tentar o SDK de Node puro (`@sentry/node`) com as mesmas três funções; (ii) se ainda assim não instrumentar, o teste 7 vira os testes 1 a 6 mais as formas reais, **e o evento em preview da C0.9 passa a ser passo obrigatório antes do lote b** (uma rota de teste em preview que faz as quatro chamadas com sentinela e lança; conferir o evento no Sentry; apagar a rota). O ledger diz qual das formas valeu.
- **Pronto quando:** os testes 1 a 7 passam; as suítes de `redact-secrets`, `sentry-pii` e as duas do commit da R8 continuam verdes; o lote a é enviado.

### Tarefa 7b: relato

(emenda do portão: S-I6: `relato.ts` saiu do lote a e vai no lote b; depende da Tarefa 2.)

- **Arquivos:** `comentarios/relato.ts`; `comentarios-relato.test.ts`.
- **Contrato:** `relatarComentarios(passo: 'coletar' | 'anular', codigo: string, numeros: Record<string, number>): void` chama `Sentry.captureMessage('comentarios: ' + passo + ': ' + codigo, { level: 'error', tags: { component: 'sync-youtube', mode: 'comentarios', codigo }, extra: <só as entradas cujo valor é number finito> })`. `codigo` é cortado em 60 caracteres e filtrado por `/^[a-z0-9_:]+$/`; o que não casar vira `'codigo_invalido'`. **É a única chamada ao Sentry de todo o diretório `comentarios/`.** `codigoDe` **não mora aqui**: está em `erro.ts` (Tarefa 2; emenda 2 do portão: S-F1). **O detalhe técnico vai ao Sentry só nesta forma, já redigida** (R3).
- **Testes:**
  1. `relato: extra só leva números` (passa `{ n: 3, texto: 'x' as never, nan: NaN }` → só `n`).
  2. `relato: código com texto livre vira codigo_invalido`.
  (os antigos 3 e 4, de `codigoDe`, foram para a Tarefa 2, testes 9 e 10; emenda 2 do portão: S-F1.)
- **Pronto quando:** os 2 passam.

### Tarefa 8: gravar

- **Objetivo:** a fronteira TypeScript × SQL: montar o pacote e chamar as cinco funções, sem confiar em forma nenhuma e sem esperar para sempre.
- **Arquivos:** `comentarios/gravar.ts`; `comentarios-gravar.test.ts`.
- **Contrato:**
  - **Toda ida ao banco deste módulo leva `.abortSignal(<sinal de COMMENT_RULES.dbTimeoutMs>)` (um `AbortController` com `setTimeout`, não `AbortSignal.timeout`, para obedecer ao relógio falso dos testes; emenda 2 do portão: S-menor)** (emenda do portão: S-I4). O cliente de serviço não tem tempo máximo próprio (`apps/web/lib/supabase/service.ts`): um `rpc` pendurado seguraria a tarefa até a plataforma matar a função aos 300 s, sem fecho, sem `cron_health` e sem cota registrada. Estouro vira `banco:tempo_esgotado` (falha passageira).
  - `lerProva(sb, p: { siteId: string | null; nowIso: string; since: string | null }): Promise<{ ok: true; prova: ProvaComentarios } | { ok: false; motivo: 'schema_ausente' | 'prova_ilegivel' }>`: chama `competitor_comment_health` **por nome de parâmetro** (`p_site_id`, `p_now`, `p_marks` montado de `COMMENT_RULES.marks`, `p_identity_days`, `p_grace = graceHours + ' hours'`, `p_since`). Erro com código `PGRST202`, `42883`, `42P01` ou `PGRST205` → `schema_ausente`; qualquer outro erro, exceção, tempo esgotado, **resposta nula** (é o que a função devolve com parâmetro nulo: emenda do portão: D-A1), chave numérica ausente ou não inteira, ou mapa (`erros_por_motivo`, `perdidos_por_motivo`) que não é objeto de inteiros → `prova_ilegivel`. **É também a guarda de schema** (a MG8 entra inteira ou não entra: uma transação; ver 9.3, item 5).
  - `lerDevidos(sb, p: { nowIso: string; since: string | null; siteId: string | null }): Promise<{ linhas: Devido[]; total: number } | null>`: `competitor_comment_due` por nome de parâmetro (`p_now`, `p_marks`, `p_retry_after: '20 hours'`, `p_limit: 200`, `p_fast_reasons: MOTIVOS_PASSAGEIROS`, `p_retry_fast: '15 minutes'`, `p_since`, `p_site_id`); nulo quando há erro (a função **lança** com parâmetro nulo), quando a resposta não é lista ou quando alguma linha não passa na guarda. Lista vazia → `{ linhas: [], total: 0 }`.
  - `lerGuardados(sb, videoRowId): Promise<Array<{ youtubeId: string; topo: boolean }> | null>`: `select youtube_comment_id, parent_id` por `video_id` (uuid nosso na URL; **nunca** filtro por id de comentário), uma página de 1.000 e erro se vierem 1.000 (um vídeo guarda dezenas; mais que isso é defeito).
  - `lerCadastro(sb, siteId): Promise<{ acompanhados: Map<string, string>; proprios: Set<string> } | null>`: `competitor_channels` (id do YouTube → id da linha) e `youtube_channels` (`channel_id`) do site, as duas em paralelo.
  - `montarPacote(p: { devido; tiradoEm: string; estado; motivo?; lote?; escolhidos?; guardados?; porId?; ausentes?; consulta: { n: number | null; desconhecidos: number }; agregados?: AgregadosDoLote; conferenciaFalhou?: boolean; unidades: number }): { snap: Json; comments: Json[]; missing: string[] }`: produz exatamente as chaves do cabeçalho da função no Apêndice A, **com `from_h` e `until_h` do marco** (obrigatórios; emenda do portão: D-A4) e **sem `video_age_hours`** (quem calcula é o banco). `pool_stats` = `agregados` mais `conferencia_falhou` (emenda do portão: D-A7). `author` é nulo para o criador. `slot` só nos escolhidos. **Os já guardados que vieram no lote sem ser escolhidos entram com `slot` nulo e a posição, e levam junto as respostas do criador vistas neles** (é o caso "o criador respondeu depois"; emenda do portão: D-M6). Os achados por id entram com `via: 'id'`. **Sem id repetido:** um id que está no lote e em `porId` sai só como `lote`; dois iguais no mesmo grupo saem uma vez (emenda do portão: S-m3; o banco também deduplica, D-A3, e as duas defesas ficam: a do banco protege a escrita, a daqui mantém `nao_gravados` honesto).
  - `gravarRetrato(sb, videoRowId, marco, pacote): Promise<{ ok: true; resultado: { status: 'gravado' | 'ja_existe' | 'video_ausente' | 'fora_da_tolerancia'; … } } | { ok: false; codigo: string }>`: `rpc('apply_competitor_comment_snap', …)`; no erro devolve **só** `codigoDe(error)` (`banco:<sqlstate>`, `banco:tempo_esgotado` ou `banco:sem_codigo`) ou `tolerancia_incoerente` (janela do pacote diferente da de `COMMENT_RULES.marks` para o marco, valor ausente ou marco fora da lista; sem ida ao banco: teste 16) (emenda 3 do portão: D-m2).
  - `anular(sb, siteId?: string)`, `lerImpacto(sb, siteId, channelRowId)`: `rpc` das outras duas, com guarda de forma (contagem que não é inteiro ≥ 0 lança `ComentariosErro('resposta_ilegivel')`, nunca vira 0). **Em produção `anular` é chamada sem site** (apaga de todos): uma varredura da Tarefa 11 afirma que nenhum arquivo de `src/` passa o segundo argumento.
- **Testes** (com `sb` falso):
  1. `lerProva: função ausente → schema_ausente` (os quatro códigos).
  2. `lerProva: erro de rede, exceção, resposta nula, chave faltando, chave "3" em texto, mapa que é lista → prova_ilegivel`.
  3. `lerProva e lerDevidos mandam p_since e p_site_id` (inspeciona os argumentos do falso); `com since nulo mandam null, não omitem`. **(emenda 2 do portão: D-menor-1)** `o p_marks enviado a lerProva e a lerDevidos é EXATAMENTE [{mark: 1, from_h: 24, until_h: 72}, {mark: 7, from_h: 168, until_h: 240}, {mark: 30, from_h: 720, until_h: 888}]`, inteiros, com estas três chaves e nenhuma outra, derivado de COMMENT_RULES.marks (igualdade profunda, não contagem): o banco dá verde com item de chave errada (`fromH`, sem `from_h`: lista 0, janela 0, atrasados 0 onde o certo é 4 e 2), e os testes de integração não rodam na CI; este roda.
  4. `lerDevidos: [] é lista vazia; null, objeto, erro e linha sem mark são nulo`.
  5. `lerGuardados: a URL da consulta só tem video_id`; `1.000 linhas lança`.
  6. `montarPacote: retrato ok tem todas as chaves, com from_h e until_h do marco e sem video_age_hours; identity_days 28; rule_params com os limites das faixas`.
  7. `montarPacote: o criador sai com author nulo` (item 113).
  8. `montarPacote: nenhuma resposta de terceiro` (item 115).
  9. `montarPacote: retrato que não é ok sai com comments vazio, missing vazio e sem pool_stats`.
  10. `montarPacote: nenhum número de inscritos nem razão em nenhuma chave` (sentinela 437000000; item 146); `pool_stats só tem número e sim/não`.
  11. **(emenda do portão: S-m3)** `montarPacote: id que está no lote e em porId sai uma vez, como lote, com o slot`.
  12. **(emenda do portão: D-M6)** `montarPacote: guardado não escolhido que veio no lote leva as respostas do criador vistas agora`.
  13. `gravarRetrato: erro do banco com a sentinela em message e details devolve só banco:23514`; `fora_da_tolerancia é resultado, não erro`.
  14. **(emenda do portão: S-I4)** `ida que não responde: lerProva, lerDevidos e gravarRetrato voltam em até dbTimeoutMs (relógio falso) com prova_ilegivel, nulo e banco:tempo_esgotado`. **(emenda 3 do portão: S-T1)** O `sb` falso **resolve** com `{ data: null, error: <a forma real do teste 10 da Tarefa 2> }` quando o sinal aborta (não lança): é o que o cliente faz.
  15. `lerImpacto: contagem "8" em texto lança; not_found devolve nulo`.
  16. **(emenda 2 do portão: D-menor-2)** `marco 7 com a janela do marco 1 não é enviado`: o banco confere a tolerância que o chamador manda, então o TypeScript confere antes: `gravarRetrato` compara `from_h` e `until_h` do pacote com o item de `COMMENT_RULES.marks` do marco e, se diferirem (marco 7 com 24 e 72; marco 1 com 168 e 240; valor ausente), devolve `{ ok: false, codigo: 'tolerancia_incoerente' }` **sem chamar o banco** (o `rpc` falso não é chamado); marco e janela certos chamam uma vez.
  17. **(emenda 2 do portão: menor de software; emenda 3 do portão: S-m4: era uma nota, agora é teste)** `o tempo máximo obedece ao relógio falso: com vi.useFakeTimers(), avançar dbTimeoutMs − 1 não aborta e avançar mais 1 aborta; nenhum arquivo de comentarios/ usa AbortSignal.timeout` (varredura). O tempo máximo da ida é aplicado por um `AbortController` com `setTimeout` (ou por parâmetro injetável com padrão `COMMENT_RULES.dbTimeoutMs`); o teste 14 usa esse caminho, e os testes 16 e 17 da Tarefa 9 também.
- **Pronto quando:** os 17 passam.

### Tarefa 10: prova (veredito) e anular

(vem antes da Tarefa 9 na ordem de execução: a 9 chama `veredito`.)

- **Arquivos:** `comentarios/prova.ts`; `comentarios/anular.ts`; `comentarios-anular-prova.test.ts`.
- **Contrato (`prova.ts`)** (emenda do portão: D-C1, S-I3, D-A5, R9): `veredito(p: ProvaComentarios | null, ctx: { filaZerada: boolean; so?: 'identidade' }): { vermelhos: Array<{ codigo: CodigoExecucao; n: number }>; numeros: Record<string, number> }`, pura. `lerProva` fica em `gravar.ts` (a tabela 9.1 anterior dizia que morava aqui; não mora). Os vermelhos:

| Número da prova | Fica vermelho quando | Código | Quem chama o veredito (o caminho até o vermelho) |
|---|---|---|---|
| a prova inteira | resposta nula ou ilegível (inclusive parâmetro nulo) | `prova_ilegivel` | `coletar` no começo e no fim; `anular` depois de apagar. **(emenda 4 do portão: D4-C, S4-C)** Só a do COMEÇO é guarda: o `coletar` grava `numeros = { na_guarda: 1 }` nela, e o adaptador da Tarefa 12 a devolve como `schema_nao_conferido`. As do fim e de depois de apagar não levam `na_guarda` e saem `prova_ilegivel` |
| `identidade_vencida` | > 0 | `identidade_vencida` | `coletar` no começo (**para a coleta**); `anular` depois de apagar |
| `identidade_prazo_errado` | > 0 | `identidade_invariante` | `coletar` no começo e no fim; `anular` depois de apagar |
| `identidade_de_criador` | > 0 | `identidade_invariante` | idem |
| `respostas_de_terceiros` | > 0 | `identidade_invariante` | idem |
| `retratos_atrasados` | > 0 **e** `filaZerada` | `retratos_atrasados` | `coletar` no fim (inclusive quando a lista veio vazia) |
| `retratos_perdidos_7d`, por `perdidos_por_motivo` | a soma dos motivos que **não** estão em `MOTIVOS_PERDA_ACEITA` é > 0 | `retratos_perdidos` | `coletar` no fim |
| `retratos_em_erro`, por `erros_por_motivo` | algum motivo que não é passageiro tem `stuckSameReasonRed` (3) ou mais | `erros_presos` | `coletar` no fim |
| `comentarios_ausentes_sem_decisao`, `retratos_total`, `retratos_ok`, `comentarios_total`, `identidades_total`, `retratos_na_janela`, as duas datas | **nunca: são informação, não prova** (a fila "Saíram do YouTube" é da E9) | — | vão em `numeros` |

  `filaZerada` = a execução não deixou nada (`ficaram = 0`) e não parou por cota nem pelo disjuntor. Com fila pendente, atraso é esperado: no primeiro disparo em produção `retratos_atrasados` vale 31 se a pergunta 1 for "sim" (medido em 13/10 02:01 UTC) e a execução é `parcial`, não vermelha por isso. `so: 'identidade'` devolve só as quatro primeiras linhas (é o que `anular` usa). **Cada chamador vira `status: 'erro'` na tarefa, que o despachante da E16 leva ao resumo do disparo, ao cron vermelho e ao e-mail do vigia** (R9, R10).

  **Decisão registrada (os dois pareceres pedem coisas diferentes aqui).** (1) O de software pede que os três números de invariante, no começo, **parem** a coleta; o de dados pede só o vermelho. **Vale: vermelho, e a coleta segue**; só `identidade_vencida` para a coleta (item 127 do spec). Motivo: os três só sobem por linha forjada fora da função de escrita (a função e as constraints os impedem; teste 23 da Tarefa 1), então coletar não piora nada, e parar perde retratos que não voltam. (2) O de dados pede `retratos_perdidos_7d > 0` vermelho, sempre. **Vale: vermelho, menos os perdidos com motivo `proibido`** (vídeo só para membros: o retrato fica em `erro proibido` por toda a tolerância e é perda legítima; sem a exceção, um concorrente que publica para membros toda semana deixaria o cron vermelho para sempre e calaria os outros avisos). O defeito nosso que caísse em `proibido` (a chave perde o acesso e tudo vira 403) é pego pela outra regra do mesmo parecer: três ou mais na janela presos no mesmo motivo. A quebra por motivo vem do SQL (`perdidos_por_motivo`), então trocar a lista de motivos aceitos é uma linha de TypeScript, sem migration.
- **Contrato (`anular.ts`):** `runAnularIdentidade(ctx: Pick<TarefaCtx, 'sb' | 'now' | 'siteId'>): Promise<TarefaSaida>`: chama `anular`. Função ausente → `erro` `schema_ausente`. Outro erro → `erro` `banco`, com `relatarComentarios('anular', codigoDe(err), {})`. Sucesso: **lê a prova depois de apagar** (`lerProva`; é a "mais 1 ida" que a seção 4.2 já contava e o contrato anterior esquecia) e aplica `veredito(prova, { filaZerada: false, so: 'identidade' })`: qualquer vermelho → `erro` com o primeiro código; senão `ok`, `feitos = apagadas`, `numeros: { apagadas, comentarios_carimbados, vencidas_ha_mais_de_1_dia, restantes, identidade_vencida, identidade_prazo_errado, identidade_de_criador, respostas_de_terceiros }`. **`vencidas_ha_mais_de_1_dia > 0` não é erro da execução** (ela acabou de consertar), mas vai no retorno e é relatado ao Sentry com esse número: é o sinal de que a rotina ficou sem rodar.
- **Testes:**
  1. `anular: apaga N e devolve os oito números`.
  2. `anular: tabela vazia é ok com apagadas 0`.
  3. `anular: função ausente é erro schema_ausente`; `erro do banco não vaza a mensagem`.
  4. `anular: vencidas_ha_mais_de_1_dia 3 relata ao Sentry com o número e segue ok`.
  5. **(emenda do portão: D-C1, S-I3)** `anular: prova depois com identidade_vencida 1: erro identidade_vencida`; `com prazo errado 1: erro identidade_invariante`; `com identidade de criador 1: erro`; `prova depois ilegível: erro prova_ilegivel` (apagou, mas não sabe se sobrou). **(emenda 4 do portão: S4-T1)** `fraseDe('identidade_vencida', saida.numeros) contém o 1` (a frase sai dos números da própria execução). **(emenda 4 do portão: D4-C)** `prova depois ilegível: numeros não tem na_guarda`.
  6. `veredito: cada número da tabela sobe sozinho e dá o código da linha` (oito casos) e `nenhum sobe com tudo zero e mapas vazios`.
  7. `veredito: prova nula é vermelho` (nunca verde por falta).
  8. `veredito: retratos_atrasados 31 com filaZerada falsa NÃO é vermelho; com filaZerada verdadeira é`.
  9. **(emenda do portão: D-A5)** `veredito: perdidos {sem_retrato: 1} é vermelho; {proibido: 2} não é; {proibido: 2, http_400: 1} é, com n = 1`.
  10. **(emenda do portão: D-A5)** `veredito: erros_por_motivo {http_400: 3} é erros_presos; {http_400: 2} não é; {proibido: 3} é; {rede: 5} não é por esta regra` (passageiro já deixa a execução vermelha por outro caminho).
  11. `veredito: retratos_total 0 com tudo zero não é vermelho` (primeiro dia sem vídeo); `so: 'identidade' ignora atrasados, perdidos e presos`.
- **Pronto quando:** os 11 passam.

### Tarefa 9: coletar

- **Objetivo:** `runRetratosComentarios(ctx: TarefaCtx): Promise<TarefaSaida>`, a tarefa `retratos_comentarios`.
- **Arquivos:** `comentarios/coletar.ts`; `comentarios-coletar.test.ts`.
- **O laço, na ordem:**
  0. **(emenda do portão: D-A6, S-m4)** `COMMENT_SINCE === 'a_decidir'` → `{ status: 'erro', motivo: 'inicio_nao_decidido' }`, sem ida ao banco nem chamada. `since` = `COMMENT_SINCE` (nulo ou ISO) segue para a prova e para a lista.
  1. `lerProva` (começo). `schema_ausente` ou `prova_ilegivel` → erro. **(emenda 4 do portão: D4-C)** No `prova_ilegivel` do começo, `numeros = { na_guarda: 1 }` (o adaptador da Tarefa 12 usa isso para devolver `schema_nao_conferido`); o `prova_ilegivel` da prova do fim não leva `na_guarda`. `identidade_vencida > 0` → `{ status: 'erro', motivo: 'identidade_vencida' }`, **sem chamar o YouTube** (item 127). Invariante quebrada (`identidade_prazo_errado`, `identidade_de_criador` ou `respostas_de_terceiros` > 0): anota o vermelho `identidade_invariante` e **segue** (decisão da Tarefa 10).
  2. `lerDevidos`. Nulo → erro `lista_de_devidos_ilegivel`. Vazia → pula para o passo 12 com `filaZerada = true`, **usando a prova do passo 1** (sem ida a mais).
  3. `lerCadastro` por site presente na lista (uma vez por site). Nulo → erro `cadastro_ilegivel` (sem o cadastro a regra (a) marcaria errado).
  4. Para cada devido, **antes de começar**, para e conta o resto em `ficaram` se: `now() − inicioMs ≥ startBudgetMs`; **ou** `now() − t0 ≥ lastSnapStartsByMs`; **ou** `api.unidades() + reserva > callsMax`, com `reserva = 2` no marco 1 e `2 + min(ceil(stored_n ÷ checkChunk), checkBlocksMax)` nos marcos 7 e 30 (emenda do portão: S-m1: a reserva fixa de 4 supunha no máximo 2 blocos de conferência).
  5. `api.conversas`. `comentarios_desligados` → retrato `desligados`. `cota_esgotada` ou `limite_de_taxa` → **para tudo** (vermelho `cota_esgotada`). Outro erro → retrato `erro` com o código. Três retratos **seguidos** em erro passageiro → para (`disjuntor`), e o resto é `ficaram`.
  6. `loteDe`. Nulo → `erro` `resposta_sem_lista`. Zero conversas válidas com `descartadas > 0` → `erro` `lote_ilegivel`. **Zero conversas e zero descartadas → sempre `api.contagem`** (1 unidade): falhou → `erro` `contagem_nao_lida`; nula → `erro` `contagem_ausente`; 0 → `sem_comentarios`; > 0 → `erro` `lista_vazia_com_contagem`. (emenda do portão: D-M3: a versão anterior confiava na contagem guardada se `last_checked_at` tivesse menos de 26 h; mas `competitor-capture.ts:131` carimba `last_checked_at` mesmo quando a resposta vem sem `statistics`, e aí a contagem é velha com carimbo novo. 2 de 365 vídeos têm contagem 0: o custo é desprezível.)
  7. Com conversas: `agregadosDoLote`; `quemConsultar` → se houver ids, `api.inscritos` (falha → `inscritos` nulo, `featured_lookup_n` nulo; o retrato segue); `destaqueDe` para cada conversa; `selecionar`.
  8. Marcos 7 e 30, e só se `stored_n > 0`: `lerGuardados`; os guardados que não estão no lote nem entre as respostas do criador vistas vão a `api.porId` em blocos de `checkChunk`, **no máximo `checkBlocksMax` blocos**; o que passar disso não é conferido neste marco, conta em `conferencias_nao_feitas` e **não vira ausente**. Bloco que falha → `conferencias_falhas` soma, `conferencia_falhou` vai ao `pool_stats`, e **nenhum id daquele bloco** vira ausente. Bloco que responde → os que vieram entram com `via: 'id'`; os que não vieram vão para `missing`.
  9. Idade na hora da escrita: `(now − t0DoVideo) ÷ 3.600.000`. Se passou de `untilH` do marco → não chama o banco; `fora_da_tolerancia` soma. (O banco confere de novo e devolve `fora_da_tolerancia` se o relógio daqui estiver errado: emenda do portão: D-A4.)
  10. `montarPacote` e `gravarRetrato`. `ja_existe`, `video_ausente` e `fora_da_tolerancia` contam à parte e não são erro. Erro do banco → conta em `erros_de_gravacao` com o código; o retrato fica devido. **(emenda 3 do portão: D-m2, S-m1)** `tolerancia_incoerente` é defeito nosso, não do banco (o banco nem foi chamado): conta em `inesperados`, não em `erros_de_gravacao` (execução vermelha, código `inesperado`), é relatado com `relatarComentarios('coletar', 'tolerancia_incoerente', { marco })` e o retrato fica devido.
  11. **Num `finally` que cobre o laço inteiro** (emenda do portão: D-M4, S-m2: antes a cota só era gravada se o laço chegasse ao fim): `recordQuota` por site, **todos em paralelo e numa corrida contra `dbTimeoutMs`** (`recordQuota` não aceita sinal e `competitor-quota.ts` não é tocado), com `mode: 'comentarios'`, `extra: { comentarios_retratos, comentarios_erros }`, `max: { comentarios_ficaram }`. Falha ou tempo → vermelho `cota_nao_registrada` com as unidades. Se a função for morta pela plataforma, nem o `finally` roda: aí a fonte de reconciliação é a soma de `units_used` dos retratos do dia (dito no ledger e na conferência D+1).
  12. Prova do fim (`lerProva` de novo, salvo o atalho do passo 2) e `veredito(prova, { filaZerada })`. **Todo vermelho do veredito vira vermelho da execução** (emenda do portão: D-C1, S-I3: antes a prova do fim servia "só para os números do retorno" e `veredito` não tinha chamador).
  13. Um `try/catch` por devido: exceção inesperada vira `relatarComentarios('coletar', codigoDe(err), { marco })` e conta em `inesperados`; o laço segue.
- **Estado da execução.** Vermelhos, além dos do veredito: parou por cota; `cota_nao_registrada`; `inesperados > 0`; houve **alguma falha passageira** (retrato `erro` com motivo de `MOTIVOS_PASSAGEIROS`, ou erro de gravação no banco: `falhas_passageiras`, ou `banco` quando todas foram do banco); o disjuntor abriu; uma das chamadas auxiliares (inscritos; conferência por id) foi tentada 3 ou mais vezes e falhou em **todas**. `status = 'erro'` se houver qualquer vermelho, com `motivo` = o primeiro deles **na ordem de `CODIGOS_EXECUCAO`** e os outros contados em `numeros.vermelhos`. Retrato em erro por motivo do vídeo **não** deixa a execução vermelha sozinho (a regra dos três presos e a dos perdidos, na Tarefa 10, é que o fazem). `parcial` se não há vermelho e `ficaram > 0` (com `feitos` = retratos gravados nesta execução, inclusive os `erro`, para a regra de progresso da E16); `ok` no resto. `numeros` traz sempre: `devidos`, `feitos`, `ficaram`, `ok`, `sem_comentarios`, `desligados`, `erros`, `descartados`, `conferencias_falhas`, `conferencias_nao_feitas`, `consultas_de_autor_falhas`, `ausentes_marcados`, `fora_da_tolerancia`, `erros_de_gravacao`, `inesperados`, `unidades`, `ms`, `vermelhos`, e **os números da prova do fim, todos** (`identidade_vencida`, `identidade_prazo_errado`, `identidade_de_criador`, `respostas_de_terceiros`, `retratos_atrasados`, `retratos_em_erro`, `retratos_perdidos_7d`, `perdidos_fora_do_aceito`, `erros_presos_max`, `identidades_total`). **(emenda 4 do portão: S4-T1)** `numeros` traz também, para a frase: `unidades_nao_registradas`, `falhas_passageiras`, `motivo_mais_comum` e `motivo_preso` (os dois últimos **índices em `MOTIVOS`**; ausentes quando não há): são as chaves que `fraseDe` lê, com o nome da coluna "Chaves de `n`" da Tarefa 2. **(emenda 4 do portão: D4-C)** `na_guarda: 1` só na saída de `prova_ilegivel` do começo.
- **Frases que o dono lê:** nenhuma em `coletar.ts` (emenda do portão: R3). A tarefa devolve **código** e números; a frase sai de `fraseDe` (Tarefa 2).
- **Testes** (com os falsos de `api` e de `sb`, relógio falso):
  1. `MG8 ausente: erro schema_ausente, 0 chamadas ao YouTube`.
  2. `identidade vencida: erro, 0 chamadas, nada gravado` (item 127).
  3. `prova ilegível (inclusive resposta nula): erro, 0 chamadas`. **(emenda 4 do portão: D4-C)** `prova do começo ilegível: numeros.na_guarda é 1; prova do fim ilegível: não tem na_guarda`.
  4. `COMMENT_SINCE a_decidir: erro inicio_nao_decidido, 0 idas ao banco`; `com since ISO, a prova e a lista recebem o mesmo instante`.
  5. `nada devido e nada atrasado: ok, 0 chamadas, uma ida só para a prova`; `nada devido mas a prova diz 2 atrasados: erro retratos_atrasados`.
  6. `lista de devidos ilegível: erro` (nunca "nada devido").
  7. `caminho feliz no marco 1: 2 chamadas (conversas e inscritos), a leitura de guardados não é feita (stored_n 0), 1 escrita`; conta as chamadas e confere os ids pedidos (item 145).
  8. `commentsDisabled grava desligados`; `200 vazio e contagem lida 0 grava sem_comentarios`; `200 vazio e contagem lida 57 grava erro, não sem_comentarios`; `falha de rede grava erro` (item 111).
  9. **(emenda do portão: D-M3)** `200 vazio com contagem guardada 0 e carimbo de 1 hora atrás: a contagem é lida de novo mesmo assim; com a leitura falhando, erro contagem_nao_lida`.
  10. `consulta de inscritos falha: o retrato é gravado, featured_lookup_n nulo, ninguém por tamanho` (item 145).
  11. `marco 7: guardado fora do lote e achado por id entra com posição nula; fora do lote e não achado vai para missing` (item 118).
  12. `marco 7: a chamada por id falha: nenhum ausente, conferencias_falhas 1, retrato gravado com conferencia_falhou no pool_stats`.
  13. **(emenda do portão: S-m1)** `marco 7: 120 guardados fora do lote: 3 chamadas por id de 50, 50 e 20`; `200 guardados: 3 chamadas (150 ids), 50 em conferencias_nao_feitas e nenhum deles ausente`; `a reserva antes de começar é 2 + 3`.
  14. `tolerância: retrato cujo tempo passou de 240 h entre a lista e a escrita não é gravado` (relógio falso avançado durante a chamada: item 112); `o banco devolvendo fora_da_tolerancia conta e não é erro`.
  15. `teto de chamadas: com 40 devidos e callsMax 60, faz 30 no máximo, ficaram conta o resto, e os primeiros são os de prazo mais curto` (item 121).
  16. **(emenda do portão: S-I4)** `teto de tempo: com cada chamada e cada ida custando o seu tempo máximo (relógio falso), para de COMEÇAR aos 40 s do começo da tarefa, e também aos 170 s de t0 quando a tarefa começou tarde; o fim nunca passa de WORST_END_FROM_T0_MS`.
  17. **(emenda do portão: S-I4)** `ida ao banco que não responde: a escrita volta banco:tempo_esgotado, conta como falha passageira, e a tarefa termina dentro do limite` (emenda 3 do portão: S-T1: o `sb` falso resolve com a forma real do erro de aborto, não lança).
  18. `cota esgotada no terceiro: para, os dois primeiros ficam gravados, ficaram conta o resto, status erro cota_esgotada`.
  19. `falha passageira: 1 de 5 com http_5xx deixa a execução em erro falhas_passageiras, com o motivo mais comum nos números; 1 de 5 com proibido NÃO deixa`; `três passageiras seguidas param a execução (disjuntor) e o resto é ficaram`; `inscritos falha nas 3 tentadas: erro; falha em 2 de 3: não`. **(emenda 4 do portão: S4-T1)** `fraseDe(saida.motivo, saida.numeros) contém "1 leituras" e "http_5xx"` (a frase sai dos números da própria execução).
  20. `exceção inesperada num vídeo: os outros seguem, relato chamado com inesperado:typeerror, status erro`.
  21. **(emenda do portão: D-M4, S-m2)** `a cota é somada por site, com o modo comentarios e os dois contadores`; `recordQuota falha ou não responde: status erro e cota_nao_registrada`; `exceção fora do try por devido (o cadastro lança): a cota já gasta é gravada mesmo assim`.
  22. **(emenda do portão: D-C1, S-I3, R9)** `12 devidos, todos gravados, prova do fim com 2 atrasados: erro retratos_atrasados`; `40 devidos, 13 feitos, prova do fim com 31 atrasados: parcial, NÃO é vermelho por isso` (o primeiro dia); `prova do começo com prazo errado 1: a coleta é feita e a execução termina em erro identidade_invariante`; `prova do fim com perdidos {sem_retrato: 1}: erro retratos_perdidos; com {proibido: 2}: ok`; `prova do fim com erros_por_motivo {http_400: 3}: erro erros_presos`; `prova do fim ilegível: erro prova_ilegivel`; `numeros traz os dez números da prova`.
  23. **A prova da C0.9 de ponta a ponta (itens 114 e 146), com HTTP de verdade (emenda do portão: S-C1, R8).** O servidor local e o SDK da Tarefa 7a (mesma montagem: `tracesSampleRate: 1`, as três funções reais, transporte que guarda). `runRetratosComentarios` com `apiBase` apontando para o servidor, **sem `fetchImpl`** (o `fetch` global), `sb` falso, dentro de `Sentry.startSpan`. O servidor devolve um comentário com o texto `TEXTO-SENTINELA-123`, o autor `AUTOR-SENTINELA`, o id de canal `UCsentinelaAUTOR000000001`, o id de comentário `UgxSENTINELAcomentario01` e, na consulta de inscritos, 437.000.000. Em sequência forçam-se: erro HTTP em cada uma das quatro rotas, JSON ilegível, falha da escrita no banco (falso que devolve `{ code: '23514', message: 'Failing row contains (… TEXTO-SENTINELA-123 …)', details: '…' }`) e um `TypeError` dentro do laço. Depois `Sentry.flush()`. **Afirma (positivo):** há transação com spans `http.client` das quatro rotas e há pelo menos um evento de erro com breadcrumbs `http`. **Afirma (negativo):** nenhum envelope serializado contém nenhuma das cinco sentinelas. (A chave de API não é afirmada aqui: é do commit da R8, que tem os testes dele.)
  24. `competitor_raw não é tocado` (o falso do banco recusa qualquer chamada a essa tabela; item 114).
  25. `nada do lote não escolhido é gravado`: 100 conversas com sentinela própria em cada texto; o pacote enviado contém as sentinelas dos 12 escolhidos (e das respostas do criador deles) e nenhuma das outras 88; o `pool_stats` não contém nenhuma.
  26. `coletar.ts não lê process.env` (os parâmetros vêm de `COMMENT_RULES`) e `não tem nenhuma frase em português` (procura "comentários:" no arquivo: R3; **emenda 3 do portão: S-T2:** como as frases perderam o prefixo, a busca passa a ser também por letra acentuada em literal de texto e por qualquer frase de `FRASES_FIXAS`: `coletar.ts` só tem códigos e nomes).
  27. **(emenda 3 do portão: D-m2, S-m1)** `gravarRetrato devolve tolerancia_incoerente: conta em inesperados e não em erros_de_gravacao, relato chamado com ('coletar', 'tolerancia_incoerente', { marco }), status erro com motivo inesperado (não banco), o retrato continua devido`.
- **Pronto quando:** os 27 passam (26 até a emenda 2 e 1 da emenda 3 do portão: D-m2). O teste 23 exige a Tarefa 7a: se o commit da R8 atrasar, a tarefa fecha os outros 26 e o 23 fica pendente no ledger; **o lote b não vai sem ele**.

### Tarefa 11: integração contra o banco e varreduras

- **Objetivo:** a junção de verdade (TypeScript × SQL), o custo medido e as provas de "não vazou".
- **Arquivos:** `apps/web/test/integration/observatorio-a5-e14-coleta.test.ts`; `apps/web/test/youtube/observatorio/comentarios-varredura.test.ts`.
- **Testes de integração** (`bythiago_int` com as três variáveis das restrições globais; `fetch` fixo sintético; cliente de serviço de verdade; **site próprio, passado em `ctx.siteId` em toda execução**: emenda do portão: R5, S-I7):
  0. **(emenda do portão: S-I1)** `os dois caminhos falam com o mesmo banco`: a tabela existe pelo `pg` direto e pelo cliente de serviço (ver restrições globais). Se falhar, os outros nem rodam.
  1. `do zero ao marco 30`: um vídeo; roda a coleta com o vídeo em 30 h, 8 dias e 31 dias (**envelhecendo `published_at` por SQL**, porque o banco calcula a idade), com respostas fixas diferentes em cada idade; no fim: 3 retratos `ok` com `video_age_hours` de 30, 192 e 744; leituras por marco com as curtidas de cada idade e o `creator_replied` de cada leitura; um comentário que saiu do lote no marco 7 e não veio por id tem `miss_streak 1`; no marco 30, `missing_since`.
  2. `identidade no tempo` (itens 125, 126, 147, 148): depois do marco 1, envelhece `first_seen_at`, `expires_at` e `created_at` em 29 dias por SQL; `runRetratosComentarios` **recusa** coletar (`identidade_vencida`); `runAnularIdentidade` apaga e devolve `ok` com a prova de depois em zero; a coleta do marco 30 roda; o comentário que volta não ganha identidade; `featured_reason`, as faixas e `featured_channel_id` do comentário do canal acompanhado são os de antes; as consultas de V6 dão 0, 0, 0.
  3. `os quatro estados`: `ok`, `sem_comentarios`, `desligados` e `erro`, e o vídeo sem linha nenhuma (as quatro tabelas sem linha para ele).
  4. `sentinelas` (itens 114 e 146): com texto, autor, id de autor e 437.000.000 de inscritos sentinelas na resposta fixa de um comentário **não escolhido**, depois da coleta: `select` de todas as colunas de texto e `jsonb` das quatro tabelas (inclusive `pool_stats`), de `competitor_raw` (contagem igual antes e depois), de `youtube_quota_usage.operations` e de `competitor_agenda_runs` (se existir) não acha nenhuma; e o número 437000000 não está em lugar nenhum nem para o escolhido.
  5. `custo`: conta as idas ao banco (interceptando o `fetch` do cliente pelo host de `localSupabaseUrl()`) e as chamadas à API de uma execução com 12 retratos: afirma **6 + 2 por retrato no máximo** e até 3 chamadas por retrato; anota o tempo local no ledger.
  6. `o dia de 75 canais`: 61 devidos (semente por SQL, **todos no site do teste**), `callsMax 60`: três execuções seguidas zeram a fila do site; cada uma devolve `ficaram` certo (o `total_due` é o do site, não o do banco); a última devolve `ok` com `retratos_atrasados = 0`; anota tempo e idas (item 121).
  7. `duas execuções ao mesmo tempo`: `Promise.all` de duas coletas sobre os mesmos devidos: cada (vídeo, marco) tem um retrato; nenhuma identidade duplicada; a cota somada é a das duas (o gasto em dobro é real e fica registrado; quem impede a corrida é a tomada atômica da E16).
  8. `a remoção leva tudo`: `competitor_channel_comment_impact` antes; `delete` do canal; as quatro tabelas zeradas para ele (item 120).
  9. **(emenda do portão: S-I2)** `retrato com autor de nome sujo é gravado`: a resposta fixa tem um autor cujo nome contém NUL e um substituto solitário; o retrato sai `ok` (antes: `22P05` para sempre) e o nome guardado não tem nenhum dos dois.
  10. **(emenda do portão: D-C1, R9)** `o número da prova chega à execução, nos dois sentidos`: um vídeo de 9 dias do site cujo retrato não consegue ser gravado (a resposta fixa traz uma curtida de 3.000.000.000, que não cabe em `integer`: `banco:22003`) → a execução termina em `erro` e `numeros.retratos_atrasados = 1`, lido da prova do fim no banco de verdade; com a resposta consertada, `ok` e 0. E: com uma identidade forjada por SQL com prazo errado, `runAnularIdentidade` termina em `erro` `identidade_invariante`; desfeita a forja, `ok`.
  11. **(emenda do portão: D-A6)** `o corte`: com `since` de agora (parâmetro de teste), a execução não coleta os vídeos que atingiram o marco antes e termina `ok` com `retratos_atrasados = 0`; com `since` nulo, coleta.
- **Varreduras estáticas** (`comentarios-varredura.test.ts`, leem os arquivos do repositório):
  1. `nenhum arquivo de api/pipeline, lib/pipeline, observatorio/forja, pack.ts ou data/pipeline-docs cita competitor_video_comment` (item 119: hoje nenhum endpoint do pipeline nem pacote da forja pode conter comentário porque nenhum lê as tabelas; o teste trava isso).
  2. `competitor_video_comment_authors só é citada dentro de lib/youtube/observatorio/comentarios/` (item 127: nenhum export, nenhum leitor de tela).
  3. `o diretório comentarios/ não tem console., não importa zod, e só relato.ts importa @sentry/nextjs`.
  4. `nenhum .in('youtube_comment_id' nem .eq('youtube_comment_id' em src/` (id de comentário nunca vai para a URL do banco).
  5. **(emenda do portão: R6)** `nenhum arquivo de comentarios/ nem de agenda/tarefas/{anular-identidade,retratos-comentarios}.ts importa módulo de token OAuth` (procura `obterToken`, `ensureFreshToken`, `youtube-token`, `oauth`): o passo só usa a chave de API.
  6. **(emenda do portão: R3)** `só frases.ts tem texto em português para o dono` (procura "comentários:" nos outros arquivos de `comentarios/`; **emenda 3 do portão: S-T2:** as frases perderam o prefixo, então a varredura procura também letra acentuada em literal de texto e qualquer frase de `FRASES_FIXAS` fora de `frases.ts`); `nenhum arquivo de comentarios/ monta error_reason com template de texto` (procura `` error_reason: ` `` e `'banco:' +` fora de `erro.ts`; **emenda 3 do portão, achado ao emendar:** dizia `relato.ts`, mas `codigoDe` mora em `erro.ts` desde a emenda 2).
  7. **(emenda do portão: R5, S-I7)** `nenhum arquivo de src/ passa siteId ao TarefaCtx, nem o segundo argumento de anular, nem base/apiBase`: em produção a lista, a prova e a rotina valem para todos os sites e a API é a do YouTube.
- **Pronto quando:** os 12 + 7 passam; os números de custo e tempo estão no ledger.

### Tarefa 12: ligar na agenda (a ÚNICA que espera a E16 parte 1 no HEAD)

(emenda 2 do portão: P1. A tarefa foi reescrita contra o **contrato de registro de tarefa** que o plano da agenda recebe agora na emenda 2 dele (`docs/superpowers/plans/2026-10-12-a5-e16-e15-parte-1-plan.md`, Tarefa 12). Onde o detalhe ainda não existe lá, a tarefa está escrita em termos do contrato e marcada "(a conferir contra a Tarefa 12 do plano da agenda, emenda 2)". **Todas as outras tarefas deste plano (0 a 11, 13) começam sem esperar a agenda.**)

(emenda 3 do portão: D-T1, S-T3, S-T2, AG. O contrato agora existe: plano da agenda, seção 9.1 e Tarefa 12, na emenda 5 dele (emenda 4 do portão: D4-m1, S4-m1). Os "a conferir" que ele já respondeu foram trocados pelo fato: a lista `antesDoLoteAntigo` é preenchida **por esta tarefa**; `motivos` e `fraseDe` são dois campos; os rótulos são minúsculos; no caminho `interruptor` o estado é lido antes da tomada. Resta a conferir só o que depende do código entregue: os nomes de campo de `ContextoTarefa` e de `ResultadoTarefa`.)

- **Objetivo:** registrar as duas tarefas no catálogo da agenda, com os interruptores e as conferências com data. Pequena de propósito: nenhum módulo de `comentarios/` muda.
- **Arquivos (fechado):** `apps/web/src/lib/youtube/agenda/tarefas/anular-identidade.ts` e `…/retratos-comentarios.ts` (novos); `agenda/catalogo.ts` (duas importações e as duas entradas); `apps/web/src/lib/youtube/observatorio/rules.ts` (uma linha); `apps/web/src/lib/conferencias.ts`; `apps/web/test/lib/conferencias.test.ts` (emenda 2 do portão: S-menor, o teste 12 não tinha casa); `.superpowers/sdd/a5/conferencias-com-data.md`; `docs/ops/env-vars.md` (os dois nomes aceitos em `OBS_AGENDA_TASKS_OFF` e o aviso das 48 h nas entradas de `OBS_AGENDA` e de `OBS_AGENDA_TASKS_OFF`; emenda 4 do portão: D4-m2); `apps/web/test/youtube/agenda/tarefas.test.ts` e `despachante.test.ts`; **`apps/web/src/lib/youtube/agenda/executar.ts` (uma importação e uma entrada em `antesDoLoteAntigo`; nada mais; emenda 3 do portão: D-T1, S-T3)**. **`route.ts` não entra; de `agenda/executar.ts`, só a entrada na lista** (plano da agenda, 9.1 e Tarefa 12: "a E14 acrescenta `anular_identidade` (uma linha de importação e uma entrada)"). Os testes de `executar` e os da rota são da E16 e não entram.
- **Pré-requisitos (emenda 2 do portão: P1; nada disto é deste plano):**
  1. A E16 parte 1 no HEAD, com o contrato de registro de tarefa: `nome`, `rotulo`, `motivos`, `fraseDe` (emenda 3 do portão: S-T2), `fimAteMs`, a guarda de schema que cada tarefa declara.
  2. **`antesDoLoteAntigo` é pré-requisito, definida e chamada pela E16**, nos dois caminhos em que o lote antigo assume (`OBS_AGENDA=off` e guarda da MG10 falhando), com `started = t0`. Este plano **não define** `antesDoLoteAntigo` nem `rodarAntesDoLoteAntigo`, e não edita a rota. **(emenda 3 do portão: D-T1)** Se `rodarAntesDoLoteAntigo` não existir no HEAD, a Tarefa 12 **não começa**: para e avisa o controlador (a versão anterior deixava os testes 4 e 5 pendentes; não pode mais). A lista nasce vazia: **a entrada `anular_identidade` é desta tarefa** (uma importação e uma entrada em `agenda/executar.ts`). Sem ela a anulação não roda nos caminhos 2 e 3 e nada fica vermelho.
  3. Com `OBS_AGENDA=off`, **as tarefas de outras etapas não rodam**; roda só quem declara `nuncaDesliga` **e está na lista** (aqui, `anular_identidade`).
  4. **(emenda 3 do portão: D-T1, AG) No HEAD, antes de começar** (9.3, itens 9 e 10): o teste da agenda `lista vazia…` passa `lista: []` injetada e os dois testes da rota com `off` não dependem de a lista real estar vazia; as duas saídas antecipadas do bloco antigo da rota levam `semAgenda`, `antes.problemas` e `antes_do_lote` (a `S3-m5` de lá). Se faltar um deles, a Tarefa 12 para e pede ao controlador: **não edita teste nem `route.ts` da E16**. **(emenda 4 do portão: D4-m1, S4-m1: os dois itens já foram atendidos na emenda 5 do plano da agenda; a conferência no HEAD continua sendo o pré-requisito.)** **(emenda 5 do portão: S5-T1)** conferir no HEAD que `fraseDoMotivo` continua restringindo `fraseDe` a `tem(t.motivos, c)`; se a agenda passar a chamá-la para os comuns, os textos de S5-T1 voltam a ser revistos.
- **Antes de começar:** ler o plano da agenda emendado e o código que ele entregou (o tipo de registro, os nomes das constantes de relógio, como a guarda é declarada). Onde divergir do que está abaixo, vale o dele, e a diferença vai ao ledger.
- **As duas entradas** (campos do contrato):

| Campo | `anular_identidade` | `retratos_comentarios` |
|---|---|---|
| `nome` | `'anular_identidade'` | `'retratos_comentarios'` |
| `rotulo` | "anular identidade de autores" | "retratos de comentários" (os dois em minúsculas e sem ponto: é o contrato da agenda, e o rótulo prefixa toda frase; emenda 3 do portão: S-T2, D-m4) |
| `ordem` | 2 | 7 (spec 4.8.2) |
| `peso` | `'leve'` | `'pesada'` |
| `periodo` | `'dia'` | `'dia'` |
| `aPartirDaHoraSP` | 3 | 13 |
| `tetoTentativas` | 12 | 12 (a retomada de `parcial` com `feitas > 0` não gasta, regra da E16) |
| `toleranciaVigiaH` | 36 | 36 |
| `naoTerminouVermelhoEm` | `null` (só devolve `ok` ou `erro`) | **6** (o primeiro dia leva 2 a 4 disparos parciais por desenho) |
| `comecaAteMs` | o teto de começo das leves da E16 (75.000) | `COMMENT_RULES.startsByMs` (**130.000**) |
| `fimAteMs` (**em milissegundos, contado de `t0`**) | **85.000** (75 s para começar + 2 × `dbTimeoutMs` = 10 s; dentro do teto das leves, 90.000) | **225.000** (`WORST_END_FROM_T0_MS`; dentro do teto das pesadas, 285.000) |
| `cedeA` | — (nunca cede) | `['sincronizar_canais']` |
| `nuncaDesliga` | `true` | — |
| `motivos` (emenda 3 do portão: S-T2) | `FRASES_FIXAS` de `comentarios/frases.ts` **sem as chaves que já estão em `MOTIVOS_COMUNS`** da agenda (hoje, só `schema_ausente`): código → frase **fixa** | idem |
| `fraseDe` (emenda 3 do portão: S-T2) | campo **separado**: `(codigo, detalhe) => fraseDe(codigo, detalhe)` de `comentarios/frases.ts` (a frase com números). **(emenda 5 do portão: S5-T1)** A agenda só chama `fraseDe` para código que está em `motivos` da tarefa (`agenda/motivos.ts`, `fraseDoMotivo`); os comuns saem com a frase comum: `schema_ausente` → "<rótulo>: migration não aplicada" e `schema_nao_conferido` → "<rótulo>: não foi possível conferir o schema". Nenhum mapeamento de código aqui | idem |
| guarda de schema | a chamada da anulação devolve `schema_ausente` (função ausente). **(emenda 4 do portão: D4-C, S4-C; ruling do controlador, 13/10; substitui a nota da emenda 3, D-m4)** A tarefa não tem guarda de começo: a prova de depois de apagar é resultado, e seu `prova_ilegivel` **não** é trocado (o schema já respondeu: a função rodou). Registrado no ledger e em 9.3, item 11 | **a prova** (`lerProva` de `gravar.ts`, que chama `competitor_comment_health`): a guarda é a prova, não `schemaTablesReady` (9.3, item 5). **(emenda 4 do portão: D4-C, S4-C)** Prova do COMEÇO ilegível: `schema_nao_conferido` (comum da agenda). Prova do FIM ilegível: `prova_ilegivel`, sem troca |
| `rodar` | o adaptador abaixo | o adaptador abaixo |

  **(emenda 3 do portão: S-T2, AG)** Os campos da tabela são os do tipo `Tarefa` publicado na seção 9.1 do plano da agenda (`nome`, `rotulo`, `ordem`, `peso`, `periodo`, `aPartirDaHoraSP?`, `tetoTentativas`, `toleranciaVigiaH`, `naoTerminouVermelhoEm`, `comecaAteMs`, `fimAteMs`, `cedeA?`, `nuncaDesliga?`, `motivos`, `fraseDe?`, `devidaPeloDado?`, `rodar`). `devidaPeloDado` não é declarado por nenhuma das duas. A guarda não é campo: mora dentro do `rodar`. Onde o código entregue pela E16 divergir desta tabela, vale o dela e a diferença vai ao ledger.
- **O adaptador** (mora em `agenda/tarefas/*.ts`, não nos módulos de comentários): `rodar` chama `runRetratosComentarios` / `runAnularIdentidade` com `{ sb, apiKey, now, t0, inicioMs }` tirados do contexto da E16 e converte `TarefaSaida` no resultado dela (`status` → `estado`, `feitos` → `feitas`, `ficaram` → `deixadas`, `motivo` → `motivo`, `numeros` → `detalhe`, que é só `Record<string, number>`; nomes a conferir no código da E16). Um `try/catch` em volta devolve `erro` com `motivo: 'inesperado'`, chama `relatarComentarios(passo, codigoDe(err), {})` (`codigoDe` vem de `erro.ts`) e devolve números vazios (`inesperado` não tem número, e `fraseDe` devolve vazio sem ele: a agenda cai na frase fixa; emenda 4 do portão: S4-T1): **nenhuma exceção desta etapa chega ao `catch` do despachante**, que levaria a mensagem a `competitor_agenda_runs.reason` e a `cron_health.last_error` (e ao e-mail do vigia): uma mensagem do Postgres do tipo "Failing row contains (…)" levaria texto e nome de terceiros para fora do apagamento aos 28 dias. `motivo` é sempre um item de `CODIGOS_EXECUCAO` **ou `schema_nao_conferido`** (emenda 4 do portão: D4-C, S4-C; o que vai para `reason` é o **código**). **Em `retratos-comentarios.ts`, `motivo === 'prova_ilegivel'` com `numeros.na_guarda === 1` vira `schema_nao_conferido`; só esse caso (a prova do fim da coleta segue `prova_ilegivel`), e `relatarComentarios` continua recebendo `prova_ilegivel`. Em `anular-identidade.ts` não há troca** (emenda 4 do portão: D4-C, S4-C); o texto que o dono lê sai de `fraseDoMotivo(tarefa, motivo, detalhe)` da agenda, que usa `fraseDe` (com números) e, se ela devolver vazio, lançar ou passar de 160 caracteres, a frase fixa de `motivos`; o rótulo é posto uma vez só (emenda 3 do portão: S-T2).
- **O relógio** (o da E16: tudo contado de `t0`, nunca do começo da tarefa). A tarefa não começa depois de 130 s de `t0` (`comecaAteMs`); dentro dela, não começa retrato depois de 40 s do próprio começo **nem** depois de 170 s de `t0`; o pior fim é 225 s de `t0` (`fimAteMs`), que deixa os 20 s da prova e os 15 s do registro da rota (265 s). O teste 5 da Tarefa 2 afirma a desigualdade.
- **Os três caminhos da anulação** (item 127; N4 do spec), cada um com teste:
  1. **Agenda ligada:** pelo catálogo, ordem 2, com a tomada do período. (Não espera nada além do contrato.)
  2. **`OBS_AGENDA=off`:** a anulação roda antes do lote antigo, pelo ponto que a E16 define (`antesDoLoteAntigo`, pré-requisito 2), **com a tomada**; as tarefas de outras etapas não rodam. Se ela devolver `erro`, a frase entra na mensagem de falha do disparo. **(emenda 3 do portão: AG; é o `S3-T2` da agenda)** Antes da tomada a agenda lê o estado do dia: linha `ok` = **não roda de novo e não sai nota nenhuma** (a nota "outro disparo está com ela" só sai quando `tomar` devolve `false`, isto é, quando outro disparo está de fato com ela); `erro` com as 12 tentativas gastas = não roda e vira o problema "anular identidade de autores: esgotou as 12 tentativas do período", com o **cron vermelho em todo disparo até o dia virar**; estado ilegível ou tomada que devolve `{ porque }` = **roda sem `fechar`**, com nota (pode rodar em mais de um disparo do dia: a função é idempotente e custa 2 idas ao banco).
  3. **A guarda da MG10 falha** (a agenda não roda nada e o lote antigo assume): a anulação roda **sem tomada**, em todo disparo, pelo mesmo ponto. Pode: a função é idempotente, custa 2 idas ao banco e no máximo 10 s. Se a MG8 também não existir, devolve `schema_ausente` e a frase entra na mensagem de falha (que já está vermelha pela MG10). **(emenda 4 do portão: S4-m3)** É segura em duas execuções ao mesmo tempo: é um `DELETE` só; a segunda espera a trava de linha e apaga 0 (o `restantes` dela pode vir a maior, é só informação). O teste de `Promise.all` de duas anulações está na seção 14 (opcional).
  Nos caminhos 2 e 3 o lote antigo conta o tempo a partir de `t0` (a anulação gasta até 10 s antes dele); é o `started = t0` da E16, e a Tarefa 12 confere no código e, se não for assim, para e avisa. **(emenda 3 do portão: AG; é o `S3-T1` da agenda)** O prazo do `late` do lote antigo também conta de `t0` (285 s). Os testes 4 e 5 abaixo dependem do pré-requisito 2 **e rodam com a lista real** (emenda 3 do portão: D-T1).
- **`rules.ts`:** `comments: COMMENT_RULES`.
- **`conferencias.ts`** (no padrão que o lote de E1/E2 deixou: `E1_E2_DEPLOY` e `conferenciasE1E2`; formato de `apps/web/src/lib/conferencias.ts`): `export const E14_DEPLOY: string | null = null` (dia de São Paulo da promoção, `AAAA-MM-DD`, preenchido no commit do envio) e `conferenciasE14(deploy)`: `null` → nenhuma entrada e nada vence; data malformada → uma entrada `e14-deploy-invalido` vencida; data válida → quatro entradas, todas do agente:
  - `e14-d1` (D+1): V5 a V8 da seção 11; `comentarios` em `youtube_quota_usage.operations` **contra a soma de `units_used` dos retratos do dia** (reconciliação); a primeira execução no retorno do cron; o primeiro dia teve o número de retratos que a resposta à pergunta 1 manda (cerca de 49 ou cerca de 12); `select error_reason, count(*) from competitor_video_comment_snaps where status = 'erro' group by 1`. **(emenda 2 do portão: D-menor-4)** Se `COMMENT_SINCE` foi `null`, compara o primeiro dia contra os 49: os perdidos de antes da primeira coleta não entram em `retratos_perdidos_7d` (dívida D-M5), e é esta conferência que fecha o buraco.
  - `e14-d7` (D+7): tamanho das quatro tabelas e unidades por canal e dia, contra 1,3 a 1,9 MB por canal por ano e 2,16 (itens 122 e 149); diferença acima de 30% corrige 9.5 e 9.6 do spec; **quantos retratos ficaram em `proibido`**. **(emenda 2 do portão: D-menor-3)** Enquanto houver 3 ou mais vídeos presos em `proibido` ao mesmo tempo (`erros_por_motivo = {proibido: 3}`), o cron fica vermelho (Tarefa 10, teste 10; risco 22): se for recorrente e legítimo, a regra dos três presos é revista e `proibido` passa também a ser aceito como preso; se for zero, `MOTIVOS_PERDA_ACEITA` pode esvaziar. **(emenda 3 do portão: D-m5)** Até esta conferência, o vermelho de código `erros_presos` cujo motivo mais comum é `proibido` é esperado; qualquer outro código vermelho é defeito e é olhado no dia.
  - `e14-d29` (D+29): **a primeira anulação**: `apagadas > 0` na linha de `anular_identidade` do dia, e V6 = 0, 0, 0.
  - `e14-d31` (D+31): identidade em comentário com `author_purged_at` = 0; comentários com `missing_since` existem; `retratos_perdidos_7d` e `perdidos_por_motivo`.
- **Testes:**
  1. `catálogo: as duas tarefas existem, com cada campo da tabela` (`tarefas.test.ts`), inclusive `fimAteMs` 85.000 e 225.000 em milissegundos.
  2. `OBS_AGENDA_TASKS_OFF ausente: as duas ligadas` (teste que **apaga** a variável).
  3. `OBS_AGENDA_TASKS_OFF=anular_identidade,retratos_comentarios: a anulação roda, a coleta não` (aparece `desligada`).
  4. `OBS_AGENDA=off: a anulação roda antes do lote antigo, com tomada, e grava a linha; a coleta e as tarefas de outras etapas não rodam` (pré-requisito 2). **(emenda 3 do portão: D-T1, S-T3)** Chama `rodarAntesDoLoteAntigo` **sem o parâmetro `lista`** (a lista real), com `caminho: 'interruptor'`. **(emenda 3 do portão: AG)** Mais três afirmações do comportamento novo: `segundo disparo do mesmo dia, com a linha ok: a anulação não roda de novo e não há nota nenhuma` (em especial, não há "outro disparo está com ela"); `linha erro com 12 tentativas: não roda, problemas traz "anular identidade de autores: esgotou as 12 tentativas do período" e o disparo fica vermelho`; `estado ilegível: roda, fechar não é chamado, há nota`.
  5. `guarda da MG10 falhando: a anulação roda sem tomada antes do lote antigo; se ela falhar, a frase entra na mensagem de falha` (pré-requisito 2). **(emenda 3 do portão: D-T1, S-T3)** Chama `rodarAntesDoLoteAntigo` **sem o parâmetro `lista`**, com `caminho: 'guarda_mg10'`; em dois disparos seguidos ela roda duas vezes e `tomar`, `fechar` e `lerEstado` não são chamados.
  6. `ordem: anular_identidade antes de retratos_comentarios no mesmo disparo` (item 155).
  7. `a anulação falha: a coleta do mesmo disparo roda e decide pela prova`.
  8. `nunca duas pesadas, com cada tarefa no pior caso; relógio final ≤ 300 s`: o teste da E16 (`despachante.test.ts`), com o catálogo da ordem 6 e `retratos_comentarios` gastando até `WORST_END_FROM_T0_MS`.
  9. `comecaAteMs + o pior resto cabe`: `fimAteMs` de cada tarefa ≤ o teto da classe dela e `130.000 + (WORST_END_FROM_T0_MS − 130.000) ≤ LIMITE_FUNCAO_MS − 20.000 − 15.000`, com as constantes importadas dos módulos da E16 e de `competitor-sync-batch.ts`.
  10. `tarefa que lança com texto sentinela: o adaptador devolve motivo inesperado; a sentinela não aparece em fechar, em problemas nem no resumo` (as duas tarefas); `o motivo devolvido é sempre um item de CODIGOS_EXECUCAO ou schema_nao_conferido` (emenda 4 do portão: D4-C, S4-C); `a frase do resumo é fraseDe(motivo, numeros) com os números`. **(emenda 3 do portão: S-T2)** `todo item de CODIGOS_EXECUCAO é chave de motivos da tarefa ou de MOTIVOS_COMUNS, nas duas tarefas (codigoDoMotivo nunca devolve motivo_desconhecido para um código da E14)`; `nenhuma chave de motivos repete uma de MOTIVOS_COMUNS`; `fraseDoMotivo(tarefa, 'identidade_vencida', { identidade_vencida: 3 }) começa pelo rótulo uma vez só e traz o 3` (emenda 4 do portão: S4-T1: a chave é a da tabela da Tarefa 2, não `n`). **(emenda 4 do portão: D4-C, S4-C)** `prova do começo ilegível: o adaptador devolve schema_nao_conferido, codigoDoMotivo o aceita (é de MOTIVOS_COMUNS) e fraseDoMotivo devolve "retratos de comentários: não foi possível conferir o schema" (a comum; a fraseDe do registro NÃO é chamada)`; `prova do fim ilegível e prova de depois de apagar ilegível: motivo prova_ilegivel e fraseDoMotivo devolve "<rótulo>: não foi possível ler a prova (banco)"`; `MG8 ausente, nas duas tarefas: "<rótulo>: migration não aplicada"`; `nenhum caso devolve "falha de código desconhecido" nem "undefined"` (emenda 5 do portão: S5-T1); `relatarComentarios recebe prova_ilegivel nos três casos`. **(emenda 4 do portão: S4-T1)** `tarefa que lança: fraseDoMotivo devolve "<rótulo>: retratos falharam com erro inesperado (ver Sentry)" (a fixa), sem "undefined"`.
  11. `RULES.comments.target é 12` (a linha de `rules.ts`).
  12. `conferenciasE14: nulo não dá entrada; data válida dá as quatro, nas datas D+1, D+7, D+29 e D+31; data malformada dá a entrada vencida` (`apps/web/test/lib/conferencias.test.ts`).
  13. **(emenda 3 do portão: D-T1, S-T3)** `a lista REAL tem a anulação` (`tarefas.test.ts`): `antesDoLoteAntigo` importada de `agenda/executar.ts` (sem parâmetro `lista`) **não está vazia** e contém a entrada de nome `anular_identidade`; e toda tarefa do `CATALOGO` real com `nuncaDesliga: true` está em `antesDoLoteAntigo` (a recíproca do teste de contrato da E16, que só afirma "toda tarefa da lista é `nuncaDesliga`"). É este teste que fica vermelho se alguém tirar a entrada.
- **Armadilha:** a vaga da pesada. Às 13:00, com `serie_semanal` (ordem 8) também devida e as duas sãs, a regra da E16 escolhe pela mais antiga e, no empate, pela `ordem`: ganha `retratos_comentarios`. Conferir no teste do despachante que a semanal não fica sem rodar o dia inteiro quando a coleta de comentários está **quebrada** (a regra "a pesada quebrada vai para o fim" tem de valer para ela também).
- **Pronto quando:** os 13 passam (12 até a emenda 2 e 1 da emenda 3 do portão: D-T1), **nenhum pendente** (o 4, o 5 e o 13 são os que provam que a anulação roda sem agenda); o teste de contrato da E16 (`o catálogo real e a lista obedecem ao contrato de registro`) continua verde com as duas entradas e com a lista de uma tarefa (o maior `fimAteMs` da lista é 85.000); os testes do arranque e do pior disparo da E16 continuam verdes com o catálogo da ordem 6; `tsc` de `apps/web` limpo.

### Tarefa 13: ensaio com a API real em banco local (pergunta 2)

- **Objetivo:** medir o que a seção 3 diz que não foi medido, sem tocar produção.
- **Como:** um script fora do repositório (scratch), que chama `runRetratosComentarios` com `fetch` de verdade e o cliente de serviço apontado para o `bythiago_int`, sobre 3 vídeos semeados por SQL **num site próprio** com ids reais de canais acompanhados: um longo com centenas de comentários, um Short, e (se houver) uma estreia ou transmissão. Cerca de 10 unidades.
- **Nada grava em produção (emenda do portão: R6):**
  - O passo usa **só `YOUTUBE_API_KEY`**. Não chama `obterToken` nem `ensureFreshToken` (que gravam o token renovado em produção): nenhum módulo de `comentarios/` os importa, e a varredura 5 da Tarefa 11 trava isso.
  - O script **não carrega `.env.local`** (que tem a URL e a chave de serviço de produção). As variáveis são passadas na linha de comando: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`, a chave de serviço **local** e `YOUTUBE_API_KEY`.
  - A primeira linha do script lança se `process.env.NEXT_PUBLIC_SUPABASE_URL` não começar por `http://127.0.0.1:54421`, **antes** de criar qualquer cliente.
  - `ctx.siteId` é o site do ensaio.
- **O que anotar no ledger (só números e forma, nenhum texto, nome nem id):** tempo de cada uma das chamadas e de cada ida ao banco; conversas válidas e descartadas; quantas com resposta parcial; quantos autores consultados, quantos ocultos; `featured_reason` por tipo; tamanho médio do texto; bytes por linha das quatro tabelas (`pg_column_size`, `pg_total_relation_size`), com e sem `pool_stats`; o `published_at` contra `live_actual_start_at` na estreia (desvio 3); se a mesma chamada, repetida, devolve a mesma ordem; **se algum id veio repetido no lote** (D-A3); **o corpo e o código de um 403 num vídeo só para membros, se houver um** (decide a lista `MOTIVOS_PERDA_ACEITA`).
- **No fim:** `delete` do canal e do site de ensaio (leva tudo por cascata) e a conferência de que as quatro tabelas não têm linha desse site; apagar o script.
- **Pronto quando:** os números estão no ledger; a seção 4.2 deste plano é confirmada ou corrigida (se um retrato passar de 3 s em média, `callsMax` e o orçamento são revistos **antes** do envio); o banco local está limpo.

### Tarefa 14: portão e envio

- Os dois especialistas (`revisor-engenharia-dados-senior`, `revisor-engenharia-software-senior`) revisam o lote b inteiro, com o "foco de revisão" do topo da seção 10. Conserta-se até haver acordo.
- A MG8 só vai ao dono depois do acordo deles **sobre este plano** (decisão 45), e na vez do lote B, depois da MG10 e da MG9 (R2); o código, depois do acordo sobre a implementação.
- **No commit do envio, duas constantes:** `COMMENT_SINCE` (**`null`: o dono respondeu "sim" em 13/10, decisão 61; emenda 3 do portão: dec. 61**; a regra era: `null` se o dono respondeu "sim" à pergunta 1; o instante ISO da promoção se respondeu "não" ou não respondeu) e `E14_DEPLOY` (o dia de São Paulo da promoção). Com `COMMENT_SINCE` esquecida em `'a_decidir'`, a tarefa fica vermelha no primeiro disparo ("a data de início da coleta não foi decidida"): é de propósito.
- Envio por lista explícita de commits (há outros lotes locais). Conferir o CI a cada push. **Promover antes das 13:00 de São Paulo.** Depois da promoção: o retorno do primeiro disparo depois das 13:00, e as quatro conferências com data.
- **Plano de volta:** `retratos_comentarios` em `OBS_AGENDA_TASKS_OFF` para a coleta (variável da Vercel; **só vale depois de um redeploy sem mudar código**; emenda 2 do portão: S-menor); reverter os commits tira as duas tarefas do catálogo. **O que não se desfaz:** identidade apagada (por desenho). **O que não pode acontecer na volta:** tirar `anular_identidade` do catálogo enquanto houver linha em `competitor_video_comment_authors`. Se o lote b for revertido com identidade guardada, a reversão mantém a Tarefa 10 e a entrada `anular_identidade`, ou o dono roda uma vez por dia `select public.competitor_comment_identity_purge()` até a tabela zerar (28 dias); o ledger registra qual.

---

## 11. Consultas de conferência (rodadas)

**Rodadas de novo na emenda, em 12/10/2026 às 23h25 de São Paulo (13/10 02:25 UTC), no `bythiago_int` (`127.0.0.1:54422`), dentro de `begin; … rollback;`, duas vezes seguidas, com a MG8 emendada aplicada duas vezes em cada uma** (roteiro `mg8-prova.sql`, saída `mg8-prova.out`, em `.superpowers/sdd/a5-e14/`). Resultado: **0 `ERROR`, 0 `FALHOU`, 14 recusas esperadas confirmadas**; as duas saídas são iguais (fora os carimbos de hora); depois de cada `rollback`: `to_regclass` das tabelas nulo, nenhuma função `competitor_comment_*`, a contagem de `competitor_channels` igual à de antes e nenhum site de prova. O roteiro cria **dois sites próprios** dentro da transação (o banco estava em uso por outras suítes: havia canais `UCsync`, `UCatom` e `UCpinsync` de outra etapa), então nenhuma contagem depende de linha alheia. **V1 a V4** são para o dono conferir a aplicação; **V5 a V8** são as do dia seguinte ao deploy.

**V1: a migration entrou inteira?** Esperado depois de aplicada: `4, 4, 0, 6, 5` (rodado: deu isso). Em produção, hoje (antes de aplicar): `0, 0, 0, 0, 0`.

```sql
select (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity and c.relname in ('competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_authors', 'competitor_video_comment_marks')) as tabelas_com_rls,
       (select count(*) from pg_policies where schemaname = 'public' and tablename like 'competitor_video_comment%' and cmd = 'SELECT') as policies_de_leitura,
       (select count(*) from pg_policies where schemaname = 'public' and tablename like 'competitor_video_comment%' and cmd <> 'SELECT') as policies_de_escrita,
       (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_cvcs_channel_taken', 'idx_cvc_channel', 'idx_cvc_missing', 'idx_cvc_parent', 'idx_cvc_featured_channel', 'idx_cvca_due')) as indices,
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('apply_competitor_comment_snap', 'competitor_comment_identity_purge', 'competitor_comment_due', 'competitor_comment_health', 'competitor_channel_comment_impact')) as funcoes;
```

**V1b (emenda do portão): as colunas e as constraints da emenda entraram?** Esperado: `2, 2` (rodado: deu isso). Se der `0, 0` com V1 certo, foi aplicado o texto de antes da emenda.

```sql
select (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (('competitor_video_comment_snaps', 'pool_stats'), ('competitor_video_comment_marks', 'creator_replied'))) as colunas_da_emenda,
       (select count(*) from pg_constraint where conname in ('competitor_video_comment_snaps_reason_format_check', 'competitor_video_comment_snaps_pool_stats_check')) as constraints_da_emenda;
```

**V2: quem lê o quê e quem executa.** Esperado sem a MG11: a identidade e as duas de texto em `can_edit_site(site_id)`, o retrato em `can_view_site(site_id)`; com a MG11, as duas de texto em `can_view_private_site(site_id)` e **a identidade ainda em `can_edit_site`** (rodado nos dois estados: cenário C14). E `0` funções executáveis por `anon` ou `authenticated`. As cinco funções aparecem **uma vez cada** (nenhuma sobrecarga), com as assinaturas `…due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid)`, `…health(uuid, timestamptz, jsonb, integer, interval, timestamptz)` e `…identity_purge(uuid)`.

```sql
select tablename, qual from pg_policies where schemaname = 'public' and tablename like 'competitor_video_comment%' order by 1;
select count(*) as executaveis_por_quem_nao_deve from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('apply_competitor_comment_snap', 'competitor_comment_identity_purge', 'competitor_comment_due', 'competitor_comment_health', 'competitor_channel_comment_impact')
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'));
```

**V3: a identidade está só onde deve (itens 113 e 146).** Esperado: `author_purged_at`; `comment_id, site_id, display_name, channel_id, avatar_url, expires_at, created_at`; `0`. (Rodado: deu exatamente isso.)

```sql
select string_agg(column_name, ', ') from information_schema.columns where table_schema = 'public' and table_name = 'competitor_video_comments' and column_name like 'author%';
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_video_comment_authors';
select count(*) from information_schema.columns where table_schema = 'public' and table_name like 'competitor_video_comment%' and (column_name ilike '%subscri%' or column_name ilike '%inscrit%' or column_name ilike '%ratio' or column_name ilike '%subs');
```

**V4: nada foi tocado.** Esperado enquanto o código antigo estiver em `main`: `0, 0, 0, 0`, e `competitor_videos` com a contagem de antes (1.390 em 12/10).

```sql
select (select count(*) from public.competitor_video_comment_snaps) as retratos, (select count(*) from public.competitor_video_comments) as comentarios, (select count(*) from public.competitor_video_comment_marks) as leituras, (select count(*) from public.competitor_video_comment_authors) as identidades, (select count(*) from public.competitor_videos) as videos;
```

**V5 (NP-E14, item 123, com a folga de 30 h do desvio 5): a prova inteira, como a tarefa a lê.** Esperado no dia seguinte, com a fila zerada: `retratos_atrasados = 0`, `retratos_perdidos_7d = 0`, `erros_por_motivo` sem nenhum motivo com 3 ou mais, as quatro de identidade em 0. O último argumento é o corte: `null` se a pergunta 1 foi "sim"; o instante da promoção se foi "não" (o mesmo valor de `COMMENT_SINCE`; com `null` no lugar errado a consulta cobra os retratos antigos e parece vermelha). (Rodada: atrasados 0 com tudo dentro da folga; 1 com um vídeo de 9 dias sem retrato; 0 de novo depois de gravar o retrato em erro dele, que passou para `retratos_em_erro` e para `erros_por_motivo`; o vídeo descoberto há 1 hora e o de 8 dias não contam. **Com qualquer parâmetro nulo a função devolve nulo, não zeros.**)

```sql
select jsonb_pretty(public.competitor_comment_health(null, now(),
  '[{"mark":1,"from_h":24,"until_h":72},{"mark":7,"from_h":168,"until_h":240},{"mark":30,"from_h":720,"until_h":888}]'::jsonb, 28, interval '30 hours', null));
```

**V6 (item 125 e item 113): não existe identidade com mais de 29 dias pelo relógio de quem gravou nem pelo do banco, o prazo nunca foi outro, e o criador não tem identidade.** Esperado: `0, 0, 0`. (emenda do portão: D-A2: as duas primeiras passaram a olhar também `created_at`, o relógio do banco.) (Rodada: 0, 0, 0 no estado normal; 1 na primeira com um comentário de 29 dias e 1 hora antes da rotina, 0 depois dela; 1 e 1 nas duas primeiras com `created_at` forjado para 30 dias atrás; 1 e 1 na segunda e na terceira com a linha de criador forjada.)

```sql
select (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where least(c.first_seen_at, a.created_at) < now() - interval '29 days') as com_mais_de_29_dias,
       (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where a.expires_at is distinct from c.first_seen_at + interval '28 days' or a.expires_at > a.created_at + interval '28 days 10 minutes') as prazo_diferente_de_28,
       (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.is_creator) as identidade_de_criador;
```

**V7 (item 115): só respostas do criador, no máximo 3 por conversa.** Esperado: `0, 0`.

```sql
select (select count(*) from public.competitor_video_comments where parent_id is not null and not is_creator) as respostas_de_terceiros,
       (select count(*) from (select parent_id from public.competitor_video_comments where parent_id is not null group by 1 having count(*) > 3) x) as conversas_com_mais_de_3;
```

**V8 (emenda do portão: R3): os motivos gravados são códigos.** Esperado: `0` na primeira; a segunda lista os motivos e as contagens (um motivo "do vídeo" em muitos vídeos é defeito nosso, não do vídeo).

```sql
select count(*) as motivos_fora_do_formato from public.competitor_video_comment_snaps where error_reason is not null and error_reason !~ '^[a-z0-9_]{1,40}$';
select error_reason, count(*) from public.competitor_video_comment_snaps where status = 'erro' group by 1 order by 2 desc;
```

**Os cenários rodados sobre as funções** (`mg8-prova.sql`; resultado resumido; os marcados com o código do achado são novos ou mudaram na emenda):

| # | Cenário | Resultado |
|---|---|---|
| R1 | o `md5` de `competitor_channel_removal_impact` e de `youtube_channel_removal_impact` antes e depois da MG8; FK das quatro tabelas para `youtube_channels` | iguais, iguais, 0 |
| C1 | devidos do site com as tabelas vazias; 8 vídeos semeados | 4 linhas (o de 30 h, a transmissão que começou há 30 h, o de 8 dias, o de 31 dias), em ordem de prazo; ficam fora o de 5 h, o de 4 dias, o com `missing_since` e o `upcoming`; `total_due = 4` mesmo com `p_limit = 1` |
| C1c (S-I7, R5) | a lista por site | o outro site só vê o vídeo dele (1 linha, `total_due = 1`); sem site, vê os dos dois |
| C1d (D-A6) | a lista com corte | corte de 2 dias atrás: 4; de 12 horas atrás: 2 (só os marcos atingidos há 6 h); corte no futuro: 0 |
| C1e (D-A1) | a lista com parâmetro nulo | `p_now` nulo, `p_marks` nulo, objeto e lista vazia: **lançam** `22023` (4 de 4); `p_limit` nulo: 4 linhas (usa 200) |
| C2 | prova do site com tudo vazio | todos os contadores 0, os dois mapas `{}`, `primeira_coleta` nula, `retratos_na_janela = 4`, `retratos_atrasados = 0` (o de 192 h só é cobrado com 198; o de 744, com 750) |
| C2b (D-A1) | a prova com cada parâmetro nulo | `p_now`, `p_marks` (nulo, objeto, vazio), `p_identity_days`, `p_grace` e tudo nulo: **nulo** nas 7; com tudo preenchido: objeto |
| C2c (D-A6, D-M5) | a prova com corte | corte de 12 h: janela 2, atrasados 0; corte de 20 dias e **nenhuma coleta**: `retratos_perdidos_7d = 2`, `{"sem_retrato": 2}` (sem corte e sem coleta: 0) |
| C3 | retrato `ok` com 10 entradas (4 de topo válidos, 1 sem curtidas, 4 respostas do criador, 1 de terceiro), `pool_stats` e idade mandada 999 | 4 comentários, 3 respostas (a 4ª passa do teto), 2 identidades, 7 leituras com o `creator_replied` de cada uma; `nao_gravados = 3`; prazo = `first_seen_at + 28 dias`; **`video_age_hours = 30.00`, não 999** (D-A4); `pool_stats` gravado (D-A7) |
| C4 | o mesmo retrato de novo | `ja_existe`, nada muda |
| C4b (D-A4) | rótulo errado do marco | marco 7 com 30 h, marco 1 com 8 dias, marco 1 com 5 h, marco 1 com 72 h exatas e vídeo sem `published_at`: `fora_da_tolerancia` nos 5, **0 retratos gravados**; marco 1 com 24 h exatas: `gravado` |
| C5 | retrato em erro, depois `sem_comentarios` | devido de novo com espera de 20 h e não com 24 h; com o motivo na lista de passageiros volta em 15 minutos (e não aos 5 minutos, nem com outro motivo na lista); **espera nula usa 20 h e 15 min** (D-A1); `erros_por_motivo = {"http_5xx": 1}` e `{}` depois (D-A5); o erro é substituído; unidades 1 + 1 = 2 |
| C6 | nove recusas e vídeo inexistente | erro sem motivo (check); **motivo com texto livre (check de formato, R3)**; comentário em retrato que não é `ok`; marco 3; prazo de 60 dias; **`taken_at` 12 dias no futuro (D-A2)**; **retrato sem `from_h` e `until_h` (D-A4)**; **`pool_stats` com texto e com lista (D-A7)**: as 9 recusadas, 0 retratos gravados; `video_ausente`; `taken_at` 9 minutos adiante passa |
| C6b (D-A3) | id repetido no pacote (3 de topo iguais mais o mesmo como `id`) | antes: erro `21000`. Agora: `gravado`, 1 comentário com o texto, o `slot` e a posição do primeiro do lote, 1 identidade, `nao_gravados = 3` |
| C7 | a rotina: nada vencido; uma linha de 29 dias e 1 h; segunda vez; **para outro site (R5)** | apaga 0; a prova dá `identidade_vencida = 1` (e 0 se pedida 2 horas antes: o outro sentido); para o outro site apaga 0 e não mexe nesta; apaga 1, carimba 1, `vencidas_ha_mais_de_1_dia = 1`; segunda vez apaga 0; nenhum sinalizador mudou; prova volta a 0 |
| C7b (D-A2) | `created_at` forjado para 30 dias atrás, com `first_seen_at` de hoje | `identidade_vencida = 1` (antes da emenda: 0) e `identidade_prazo_errado = 1`; desfeito: 0 e 0 |
| C8 | marco 7 (o vídeo envelhece por SQL para 8 dias): comentário com identidade apagada volta; um novo; um achado por id; um id que não existe; três ids em `p_missing` (um deles também veio) | o que volta atualiza texto e **não** ganha identidade, mantém o destaque e o "criador respondeu: sim" no comentário, **e a leitura do marco 7 guarda nulo** (o que esta leitura viu: D-A7); o novo ganha identidade; o achado por id tem posição nula; o inexistente não vira comentário; 2 ausentes com `miss_streak = 1` e `missing_since` nulo |
| C9 | marco 30 (envelhece para 31 dias): dois ausentes de novo e um ausente pela primeira vez | os três com `missing_since` (2ª seguida, e "no marco 30 uma basta") |
| C10 | comentário apagado pelo dono volta no lote | não é gravado; `returned_seen_at` carimbado |
| C11 | a prova, nos dois sentidos | atrasados: 0 → 1 → 0, com `{"http_400": 1}` em `erros_por_motivo`; perdidos: 4 → 6 com dois vídeos novos elegíveis e um descoberto tarde que não conta; **`perdidos_por_motivo` = `{"proibido": 1, "sem_retrato": 5}` com um retrato `erro proibido` (D-A5)**; **com corte de 5 dias, 2; de 2 dias, 0 (D-A6)**; identidade de criador e prazo errado: 0 → 1 com a linha forjada; **respostas de terceiros: 0 → 1 com a constraint desligada na transação**; site inexistente: tudo 0; o outro site: 1 na janela, 0 comentários |
| C12 | contagem para remoção e a cascata | `comments 8, comment_marks 11, comment_snaps 8, comment_authors 2`; canal de outro site: `not_found`; apagado o canal, as quatro tabelas ficam com 0 linhas do site |
| C13 | RLS como `authenticated` sem vínculo, com `app.site_id` forjado | 0 linhas nas quatro; `insert` na identidade recusado |
| C14 | a mesma migration com `can_view_private_site` existindo (a MG11 antes) | as duas de texto em `can_view_private_site(site_id)`; a identidade **continua** em `can_edit_site(site_id)`; o retrato em `can_view_site(site_id)` |

**O que não foi rodado, dito como tal:** duas escritas simultâneas do mesmo (vídeo, marco), que precisam de duas conexões com dado gravado (é o teste 14 da Tarefa 1); a trava que a migration segura (medida pelo revisor de dados, não refeita); nenhuma consulta nova em produção nesta emenda (os fatos de produção são os da seção 3 e os que o revisor de dados mediu em 13/10 02:01 UTC).

---

## 12. Onde está cada item de aceite do spec

| Item | O que pede | Onde | Estado nesta etapa |
|---|---|---|---|
| 107 | a chamada de leitura, fixtures, a chave basta | C0.3 (`conferencias-c0-resultado.md`; `c0-fixtures/c03-*.json`) | **feito**; a ordem de `replies` e o limite de 50 estão no contrato da Tarefa 6 |
| 108 | perguntas 9, 10, 14 e 21 respondidas; parâmetros aprovados | decisões 25, 26 e 32; Tarefa 2 | feito |
| 109 | seleção reproduzível e bordas | Tarefa 5 (testes 1 a 9); o desempate, Tarefa 2 (teste 7) | inteiro |
| 110 | `criador_respondeu` nos três valores | Tarefa 3 (testes 2 a 4); "nenhuma tela escreve não respondeu": mockup 20 | o dado, inteiro; a tela, depois |
| 111 | os estados | Tarefa 9 (testes 8 e 9) e Tarefa 11 (teste 3); "teste do leitor" | a coleta, inteira; **o leitor, depois da E17 passo 0** |
| 112 | tolerância | **a função de escrita (o banco recusa)**: Tarefa 1 (testes 19, 20 e 32), Tarefa 9 (teste 14) | inteiro (emenda do portão: D-A4) |
| 113 | identidade só na tabela própria e só de quem não é o criador; nenhum arquivo de foto | Tarefa 1 (teste 28), V3, V6; nenhum código desta etapa grava no Blob | inteiro |
| 114 | bruto e lote não gravados; log sem a sentinela; Sentry | Tarefa 9 (testes 24 e 25), Tarefa 11 (teste 4), **Tarefa 7a (teste 7) e Tarefa 9 (teste 23), com HTTP de verdade** | inteiro, se o SDK instrumentar sob o vitest; senão, com o evento em preview (emenda do portão: S-C1) |
| 115 | só respostas do criador, no máximo 3 | constraint na MG8; Tarefa 1 (teste 2); V7 | inteiro |
| 116 | corte em 2.000; texto puro | Tarefa 3 (testes 9 e 10); "teste do componente" | o dado, inteiro; **o componente, com o mockup 20** |
| 117 | RLS | Tarefa 1 (`…-rls.test.ts`); "HTML e RSC" | o banco, inteiro; **a metade "com o direito" no plano da MG11**; a tela, depois |
| 118 | comentário que deixa de vir | Tarefa 1 (testes 10 a 13), Tarefa 9 (testes 11 a 13); a fila e o "apagar" | marcar, inteiro; **a fila e o apagar, E9** |
| 119 | nenhum endpoint do pipeline com o comentário | Tarefa 11 (varredura 1) | inteiro (por construção: ninguém lê as tabelas) |
| 120 | remover leva os comentários; a contagem | Tarefa 1 (teste 27), Tarefa 11 (teste 8); desvio 6 | inteiro, com a função própria; `competitor_video_purge` é da E9 |
| 121 | cota por dia no modo `comentarios`; teto com registro; tempo com 75 canais | Tarefa 9 (testes 15, 16 e 21), Tarefa 11 (testes 5 e 6); desvio 10 | inteiro |
| 122 | deploy + 7 dias: tamanho e unidades | `e14-d7` em `conferencias.ts` (Tarefa 12) | com data |
| 123 | NP-E14 | a prova (Tarefa 1, testes 21 a 26, 29 e 33), **o veredito e os chamadores dele** (Tarefa 10; Tarefa 9, teste 22; Tarefa 11, teste 10); V5; desvios 3, 5 e 15 | inteiro (emenda do portão: D-C1, S-I3: antes o número existia e ninguém ficava vermelho por ele em regime) |
| 124 | M11 e M12 | — | **E4** |
| 125 | nenhuma identidade com mais de 28 dias | Tarefa 1 (teste 22), Tarefa 11 (teste 2), V6, `e14-d29` | inteiro |
| 126 | a rotina é idempotente e não regrava | Tarefa 1 (testes 8 e 15), Tarefa 11 (teste 2) | inteiro |
| 127 | a rotina falha em vermelho; o leitor não devolve identidade vencida; o export não leva | Tarefa 9 (teste 2), Tarefa 10 (teste 5), Tarefa 12 (testes 3, 4, 5, 7 e 13; emenda 3 do portão: D-T1), Tarefa 11 (varredura 2); desvio 8 | a coleta e a agenda, inteiro, **nos três caminhos** (agenda ligada, `OBS_AGENDA=off`, guarda da MG10 falhando); **o cabeçalho e o leitor, depois; o export, E10** |
| 144 | regra (b) nas bordas | Tarefa 4 | inteiro; "a tela diz razão não medida": mockup 20 |
| 145 | uma consulta, no máximo 20, e a falha dela | Tarefa 4 (teste 12), Tarefa 9 (testes 7 e 10) | inteiro |
| 146 | inscritos e razão nunca gravados | Tarefa 4 (teste 14), Tarefa 8 (teste 10), Tarefa 11 (teste 4), V3, Tarefa 9 (teste 23) | inteiro |
| 147 | o que fica depois dos 28 dias | Tarefa 1 (teste 15), Tarefa 11 (teste 2); "teste do componente" | o dado, inteiro; a tela, depois |
| 148 | a exceção do canal acompanhado | Tarefa 11 (teste 2) | inteiro |
| 149 | preferência nas duas vagas; deploy + 7 dias | Tarefa 5 (teste 7); `e14-d7` | inteiro, com data |
| 232 | identidade em tabela própria; a rotina numa transação; a policy depois da MG11 | Tarefa 1 (teste 16; RLS 2, 3 e 6); V2 | **a metade com `site_private_viewers` é do plano da MG11** (9.3) |
| 233 | `last_checked_at` e `miss_streak` | Tarefa 1 (teste 11) | o dado, inteiro; "conferido pela última vez em dd/mm": tela |

**OP-3** (o catálogo cresce por etapa): Tarefa 12, testes 1 e 8. **OP-2** (`search_path = ''` e nomes qualificados): as cinco funções da MG8 (o cenário de V2 no roteiro mostra `proconfig`).

**As decisões do controlador, onde estão** (emenda do portão): **R1** desvio 6, seção 2 e cenário R1 da seção 11 (a MG8 não recria as funções de impacto; rodado). **R2** seção 2 e Tarefa 1 (lote B, depois da MG10 e da MG9; o arquivo só na vez). **R3** `frases.ts` e `CODIGOS_EXECUCAO` (Tarefa 2), o check de formato de `error_reason` (Apêndice A, cenário C6), o adaptador (Tarefa 12, teste 10), varredura 6. **R4** 9.3 e Tarefa 12. **R5** restrições globais da seção 10, Tarefa 0, `p_site_id` (desvio 13; cenários C1c e C7). **R6** Tarefa 13 e varredura 5. **R7** o cabeçalho, 9.2 e a Tarefa 12 (`conferencias.ts` no padrão de `E1_E2_DEPLOY`). **R8** Tarefa 7a e Tarefa 9, teste 23. **R9** a tabela da Tarefa 10 e os testes 29 da Tarefa 1, 22 da Tarefa 9 e 10 da Tarefa 11. **R10** "fica fora" e a tabela da Tarefa 10 (cron vermelho e e-mail do vigia).

---

## 13. Riscos que ficam, sem suavizar

1. **O texto de terceiros fica no banco sem prazo** (decisão do dono, risco aceito). Um comentário ofensivo, com e-mail ou telefone de alguém, fica guardado até o dono apagar pela fila (E9), que ainda não existe. Entre o deploy desta etapa e a E9, **não há como apagar um comentário pela tela**: só por SQL do dono.
2. **Depois dos 28 dias, texto + data + vídeo + faixa de tamanho ainda levam a quem escreveu**, para quem abrir o vídeo no YouTube enquanto o comentário estiver lá. É pseudonimização, não anonimização (riscos 19 e 27 do spec).
3. **A identidade pode viver até 29 dias e 10 horas**, não 28: vence 28 dias depois da coleta (em geral à tarde) e a rotina roda às 03:00. Se a agenda parar, o vigia da E16 cobra em 36 horas e a coleta para sozinha quando alguma identidade passa de 29 dias; **o apagamento em si só volta quando alguém consertar**. Não há segunda rotina.
4. **Se o lote for revertido com identidade guardada, a rotina sai junto** se ninguém seguir o plano de volta da Tarefa 14. É o único caminho conhecido para identidade ficar além do prazo sem alarme (o alarme mora no mesmo código).
5. **A prova do Sentry cobre o que sai do processo pelo SDK, não o que o servidor do Sentry guarda nem os logs da Vercel.** O Data Scrubber do projeto não foi lido. Os logs da Vercel não registram a URL das chamadas de saída por padrão, e o passo não usa `console`; isso é leitura de código, não medição. **E a prova só vale se o SDK instrumentar o `fetch` sob o vitest, o que não foi validado**: se não instrumentar, o evento em preview vira obrigatório (Tarefa 7a).
6. **A chave de API do YouTube pode já ter subido ao Sentry** pelas chamadas que existem (achado da C0.9). O conserto é do commit de fora dos planos (R8); o passado não foi verificado, e trocar a chave é decisão do dono. **A Tarefa 7a depende desse commit**: se ele atrasar, o lote a e o teste 23 da Tarefa 9 atrasam junto, e o lote b não vai sem o teste 23.
7. **O log do Postgres do Supabase guarda a linha recusada** (emenda do portão: S-m5). Uma violação de constraint na escrita põe "Failing row contains (…)" no log do banco, com texto e nome do comentário. O código deste plano não propaga a mensagem (só o código do erro), mas o log do Supabase a tem, pelo tempo de retenção dele. O que reduz: o corpo limpo na entrada (S-I2), a deduplicação (D-A3), a data validada e as guardas de `montarPacote`, que tiram as causas conhecidas de recusa. Não elimina.
8. **"Mais curtidos" é "entre os 100 primeiros por relevância".** Em 137 dos 365 vídeos de 90 dias o lote não é o vídeo inteiro. Um comentário muito curtido fora dos 100 não entra, e um canal grande cujo comentário ficou fora dos 20 mais curtidos não é marcado. `pool_stats` guarda os agregados do lote, não o que ficou fora dele.
9. **Em cerca de três quartos das conversas com resposta, "o criador respondeu" será "não se sabe"** (a API dá as 5 respostas mais antigas). M11 nasce como piso; `pool_stats` e o `creator_replied` por leitura dizem de quanto é o "não se sabe", mas não o resolvem.
10. **A idade do "marco 1" varia de 24 a 48 horas** entre vídeos, conforme a hora da publicação. A idade real está gravada (pelo banco), e a tela tem de mostrá-la. **O marco 1 tem duas chances** (a janela de 48 horas vê duas execuções diárias); o 7 tem três e o 30, sete. Dois dias seguidos de falha no marco 1 de um vídeo perdem esse retrato, e ele não volta. **Um dia de cota esgotada antes das 13:00 gasta as 12 tentativas do dia até as 17:00** (emenda do portão: S-m8) e conta como um desses dois dias; fica vermelho, mas o retrato não volta.
11. **Um retrato pode ficar em `erro` por toda a tolerância e se perder.** Agora isso é alarme, com dois recortes que são escolha deste plano (decisão da Tarefa 10): perdido com motivo `proibido` não fica vermelho sozinho, e um motivo "do vídeo" só fica vermelho com 3 ou mais presos ao mesmo tempo. **Um ou dois vídeos presos num motivo que é defeito nosso passam em verde até a janela fechar** (aí viram perdidos e ficam vermelhos, salvo `proibido`). Não foi medido se o YouTube responde 403 `forbidden` a vídeo só para membros nesta chamada: a Tarefa 13 e a conferência de D+7 olham.
12. **`retratos_perdidos_7d` é um alarme que dura 7 dias e não tem "ciente"**: uma perda legítima (o YouTube fora por dois dias) deixa o cron vermelho por uma semana, e durante ela outro vermelho do mesmo cron chega junto na mesma frase. Some sozinho.
13. **Vídeo sem `published_at` nunca tem retrato e não aparece na prova.** Hoje são 0 de 1.390.
14. **O gasto em dobro de cota em dois disparos simultâneos é possível** se a tomada atômica da E16 falhar: os dados não duplicam (trava e chave), a cota sim.
15. **A latência da API não foi medida**, nem o tempo das idas ao banco deste passo. O pior fim de 225 s vem dos tetos, com folga de 40 s; o típico é hipótese. A Tarefa 13 mede antes do envio.
16. **O tamanho por canal por ano (1,3 a 1,9 MB) é estimativa sem nenhum dado.**
17. **Esta etapa espera a E16, e a Tarefa 12 está escrita contra o contrato de registro da emenda 2 do plano dela, com os detalhes que ainda não existem marcados "a conferir"** (R4; emenda 2 do portão: P1). **(emenda 3 do portão: AG)** O contrato foi publicado (seção 9.1 do plano dela, emenda 3) e a Tarefa 12 está alinhada a ele; continua sendo plano contra plano: nenhum arquivo de `agenda/` existe no HEAD. Se o contrato, o relógio ou o `antesDoLoteAntigo` mudarem, a Tarefa 12 muda junto; os módulos de `comentarios/` não. Cada dia sem a E16 em `main` perde os retratos de cerca de 4 vídeos (pergunta 4).
18. **`COMMENT_SINCE` é uma constante preenchida à mão no commit do envio.** Esquecida em `'a_decidir'`, a tarefa fica vermelha (de propósito). Preenchida com o valor errado (`null` quando o dono disse "não"), a coleta retroage em verde: são 49 retratos e cerca de 590 identidades a mais, que a rotina apaga em 28 dias. A conferência de D+1 compara o número de retratos do primeiro dia com o esperado.
19. **O relógio de quem grava só é barrado para a frente.** `taken_at` no passado (relógio atrasado) é aceito: encurta o prazo da identidade (não o estica) e pode rotular a idade para menos. O relógio da Vercel é certo; não há teste disso em produção.
20. **A janela da migration:** menos de 1 s de trava em três tabelas. Aplicada às 12:00 ou às 18:00 pode falhar pelo `lock_timeout` (limpo: roda de novo) ou atrasar uma escrita do cron em até 1 s.
21. **A política III.E.4.h da API** (não derivar métricas de dados da API) é do spec (risco aceito, 11.1); esta etapa só coleta, e o que deriva é a E4. `pool_stats` são contagens, e é a E4 que decide se as mostra.

22. **(emenda 2 do portão: D-menor-3) `{proibido: 3}` deixa o cron vermelho enquanto durar.** Três vídeos só para membros presos ao mesmo tempo em `erros_por_motivo` cumprem a regra dos três presos (Tarefa 10, teste 10), e o cron fica vermelho até saírem da janela. Não foi medido se o YouTube responde 403 nesse caso. A conferência `e14-d7` decide (Tarefa 12); até lá o vermelho é esperado.
23. **(emenda 2 do portão: D-menor-4) Com `COMMENT_SINCE = null`, o buraco D-M5 fica aberto** até a conferência `e14-d1`, que compara o primeiro dia com os 49. **(emenda 3 do portão: dec. 61)** Deixou de ser hipótese: o dono respondeu "sim", `COMMENT_SINCE` vai `null`, e o buraco fica aberto no primeiro dia.
24. **(emenda 3 do portão: D-m3) Com `OBS_AGENDA=off` (ou `retratos_comentarios` em `OBS_AGENDA_TASKS_OFF`) a coleta para e ninguém avisa enquanto durar.** Até 48 h nada se perde (a janela mais curta, a do marco 1, vai de 24 a 72 h). Depois disso perdem-se cerca de 4 retratos do marco 1 por dia; depois de 72 h, mais cerca de 4 do marco 7 por dia; depois de 7 dias, mais cerca de 4 do marco 30 (estimativa: 4 vídeos novos por dia, pergunta 4). Aparecem como `retratos_perdidos` (motivo `sem_retrato`) no primeiro disparo depois de religar, por 7 dias. Durante o desligamento não há vermelho nem e-mail: a anulação segue rodando e verde, e o vigia mostra a coleta como `desligada`, que não suja o agregado. Os retratos perdidos não voltam. **(emenda 4 do portão: D4-m2)** Perda cuja janela fechou mais de 7 dias antes de religar não entra em `retratos_perdidos_7d`: não aparece em lugar nenhum (com a agenda desligada por 30 dias, as três primeiras semanas somem sem número). O aviso fica onde quem desliga lê: `docs/ops/env-vars.md` (Tarefa 12). Quem desligar anota a hora no ledger.
25. **(emenda 3 do portão: D-T1, S-T3) A anulação sem agenda depende de uma linha num arquivo que é de outra etapa.** Se a entrada `anular_identidade` sair de `antesDoLoteAntigo` (refatoração da E16, conflito de merge resolvido para o lado errado), com `OBS_AGENDA=off` ou com a guarda da MG10 falhando a anulação não roda, a coleta também não, ninguém lê a prova e a identidade de terceiros passa dos 28 dias **em verde**. A única defesa é o teste 13 da Tarefa 12 (roda na CI). Não há alarme em produção para esse estado.
26. **(emenda 3 do portão: AG) Com `OBS_AGENDA=off`, a anulação que falhar 12 vezes no dia para de ser tentada até o dia virar.** Fica vermelho em todo disparo ("esgotou as 12 tentativas do período"), mas nesse intervalo nenhuma identidade é apagada; volta sozinha no dia seguinte. **(emenda 4 do portão: D4-m1, S4-m1)** A dívida `S3-m5` do plano da agenda está PAGA nele (emenda 5); a Tarefa 12 confere no HEAD (9.3, item 10) e, se ela faltar, um disparo em que o lote antigo sai cedo fica vermelho **sem** a frase da anulação.

---

## 14. Dívida registrada (menores dos pareceres que não couberam numa linha, e o que a emenda deixou aberto)

| Item | De onde | O que fica | Quando volta |
|---|---|---|---|
| Perdas de antes da primeira coleta não contam quando não há corte | D-M5 | com `COMMENT_SINCE = null` (resposta "sim"), os retratos do primeiro dia que falharem e saírem da tolerância não entram em `retratos_perdidos_7d` (a conta começa na primeira coleta). Com corte, contam (consertado, cenário C2c) | conferência D+1: comparar retratos do dia com os 49 |
| Nenhuma das quatro tabelas tem índice por `site_id` | D-M8 | apagar um site varre as quatro. Raro; aceito | se um site for apagado em produção |
| "Os comentários do dono não entram" vale por dado, não por SQL | D-M9 | hoje 0 canais do dono em `competitor_channels` (medido); nada impede cadastrar um | E9 ou a tela de cadastro de concorrente |
| Cota esgotada gasta as 12 tentativas do dia | S-m8 | a tarefa não devolve "parcial sem gastar" porque a regra de tentativas é da E16; risco 10 | se acontecer uma vez: pedir à E16 um estado "adiada até o dia do Pacífico virar" |
| A redação da query de `channels` alcança as chamadas da E1 | S-m9 | perde-se detalhe de depuração no Sentry; aceito; ledger | — |
| Lista vazia num vídeo que já tem comentários guardados | achado ao emendar | o retrato sai `sem_comentarios` (ou `erro`), e retrato que não é `ok` não leva ausência: os guardados não ganham `miss_streak` nesse marco; seguem com o `last_checked_at` antigo | E9 (fila) ou a tela (mostra "conferido pela última vez em") |
| Mais de 150 guardados fora do lote num vídeo | S-m1 | os além de 150 não são conferidos naquele marco (`conferencias_nao_feitas`), sem alarme | se o número aparecer na conferência D+7 |
| `taken_at` no passado é aceito | D-A2 (metade) | risco 19 | se a Vercel um dia errar o relógio |
| O `bythiago_int` está uma migration atrás de produção | D-M7 | `…0003` contra `…0004`; não toca a MG8 | o controlador aplica |
| `schemaTablesReady` não é usada para a MG8 | S-m6 | decisão (9.3, item 5); o plano da ordem 5 trocou a frase na emenda 2 dele ("a prova do banco vale"; emenda 3 do portão: AG) | fechado |
| Alarme de perdidos sem "ciente" | achado ao emendar | risco 12 | mockup 15 ou 20 (o cabeçalho) |
| A frase de cada código chega ao e-mail pelo mecanismo da E16 | R3, R4 | `fraseDe` existe e é testada; a ligação ao resumo do disparo são os campos `motivos` (frase fixa) e `fraseDe` (com números) do contrato de registro (emenda 3 do portão: S-T2) | Tarefa 12 |
| MG8 aplicada cedo no `bythiago_int` (Tarefa 1a) | menor de software (emenda 2 do portão) | se `mg8.sql` mudar depois, `create table if not exists` deixa o schema velho sem avisar e mudança de assinatura cria sobrecarga. Desfazer: `drop` das quatro tabelas e das cinco funções no `bythiago_int` (descartável) e reaplicar; teste de outra etapa que conte tabelas pela FK de `competitor_channels` passa a ver duas a mais (a conferir com a ordem 5) | se o Apêndice A mudar |
| `retratos_perdidos` deixa a tarefa em `erro` por 7 dias | menor de software (emenda 2 do portão) | pedido do parecer de dados; gasta as 12 tentativas de cada dia. **Não há ação do dono**: o ledger (Tarefa 0) diz isso | risco 12 |
| `banco:tempo_esgotado` é reconhecido pelo prefixo da mensagem do `postgrest-js` 2.103.2 | emenda 3 do portão: S-T1 | se a biblioteca mudar o texto (`AbortError: …`), o tempo esgotado volta a sair `banco:sem_codigo`: o comportamento não muda (falha passageira, vermelho), perde-se a leitura. O teste 10 da Tarefa 2 fixa a forma de hoje, não a da biblioteca | todo bump de `@supabase/supabase-js` ou `@supabase/postgrest-js`: refazer a medição do aborto (servidor local que não responde) antes do push |
| `.throwOnError()` muda a forma do erro do banco | emenda 3 do portão: S-m3 | com ele o erro é `PostgrestError` (instância de `Error`) e `codigoDe` devolve `inesperado:` em vez de `banco:<sqlstate>`. Hoje nenhum módulo de `comentarios/` usa; não há varredura | se alguém usar `.throwOnError()` em `comentarios/`: acrescentar a varredura à Tarefa 11 |
| `prova_ilegivel` no lugar de `schema_nao_conferido` | emenda 3 do portão: D-m4; **fechado pelo ruling de 13/10 (emenda 4 do portão: D4-C, S4-C)** | o contrato da agenda não muda. O adaptador troca o código **só na prova do começo da coleta** (a guarda); o fim da coleta e a anulação seguem `prova_ilegivel`. No começo o dono lê "<rótulo>: não foi possível conferir o schema" (frase comum da agenda); no fim da coleta e depois de anular, "<rótulo>: não foi possível ler a prova (banco)". (emenda 5 do portão: S5-T1). Vermelho nos três casos | a Tarefa 12 confere no HEAD que `schema_nao_conferido` segue em `MOTIVOS_COMUNS` |
| O teste `lista vazia…` e os dois testes da rota com `off`, da agenda, supõem a lista real vazia | emenda 3 do portão: D-T1, S-T3 | ficam vermelhos no commit da Tarefa 12 daqui se o plano da agenda não passar `lista: []` injetada; a E14 não edita teste dela | **ATENDIDO na emenda 5 do plano da agenda** (emenda 4 do portão: D4-m1, S4-m1); a Tarefa 12 confere no HEAD (9.3, item 9) |
| Saídas antecipadas do bloco antigo da rota perdem `semAgenda` e `antes` | emenda 3 do portão: AG (`S3-m5` do plano da agenda) | com a anulação na lista, a frase dela some da mensagem nesses dois caminhos; o disparo continua vermelho | **ATENDIDO: `S3-m5` PAGA na Tarefa 12 da agenda, ponto (vi), com teste** (emenda 4 do portão: D4-m1, S4-m1); a Tarefa 12 confere no HEAD (9.3, item 10) |
| Ninguém avisa durante `OBS_AGENDA=off` que retratos estão se perdendo | emenda 3 do portão: D-m3; emenda 4 do portão: D4-m3 | risco 24: a perda só aparece depois de religar; até lá o aviso fica em `docs/ops/env-vars.md` (Tarefa 12; D4-m2) | E16 parte 2: `desligada` há mais de 48 h vira nota no e-mail do vigia (nota, não vermelho) |
| 9.1 da agenda diz "uma importação e uma entrada" em `CATALOGO` e em `antesDoLoteAntigo`; a E14 registra duas tarefas no catálogo e uma na lista | emenda 4 do portão: S4-m2 | só texto do plano da agenda: lê-se "por tarefa" (881: duas importações e duas entradas no catálogo; uma importação e uma entrada na lista) | o controlador ajusta o 9.1 na próxima emenda dele; a Tarefa 12 lê o código entregue |
| Teste de concorrência da anulação (`Promise.all` de duas chamadas: soma de `apagadas` = vencidas; prova depois = 0) | emenda 4 do portão: S4-m3 | opcional na Tarefa 11; o SQL é um `DELETE` só e é seguro (linha 917) | se a anulação ganhar um segundo chamador além do cron e do `OBS_AGENDA=off` |
| `banco:tempo_esgotado` por `name` (`AbortError`/`TimeoutError`) | emenda 4 do portão: S4-m4 | um `AbortError` do `fetch` que escape de `api.ts` e chegue ao `catch` do adaptador sai `banco:tempo_esgotado` sem ter sido o banco; só o Sentry vê | o primeiro `banco:tempo_esgotado` com `passo` fora de uma ida ao banco |
| Ninguém é dono do cálculo de `motivo_preso` (veredito da Tarefa 10 ou `coletar` da 9) e não há teste; se ninguém o calcular, a frase cai na fixa em silêncio (mesmo risco, menor, nas outras 11 chaves sem teste de ponta a ponta) | emenda 5 do portão: S5-T1 (menor 2) | teste genérico na Tarefa 9: para cada vermelho exercitado nos testes 19 a 22, `fraseDe(saida.motivo, saida.numeros)` não é `''` | na Tarefa 9, ou se alguma frase do e-mail aparecer sem número
| "1 leituras falharam" (teste 19): singular errado na frase que vai ao e-mail | emenda 5 do portão: S5-T1 (menor 4) | ajustar o plural em `frases.ts` | a revisão de texto do vigia

---

## Apêndice A: SQL final da MG8

Nome para o `db:new`: `observatorio_a5_e14_comentarios_de_destaque`. **Lote B, depois da MG10 e da MG9; o arquivo só é criado na vez dele** (emenda do portão: R2). Texto idêntico ao de `.superpowers/sdd/a5-e14/mg8.sql`, **emendado no portão** e aplicado duas vezes e exercitado em 12/10/2026 às 23h25 no `bythiago_int` dentro de `begin; … rollback;` (seção 11).

**O que mudou neste texto em relação ao que os revisores leram** (emenda do portão), para quem for conferir linha a linha:

| Achado | Onde no SQL | O quê |
|---|---|---|
| D-A1 | funções 7 e 8 | a prova devolve nulo com parâmetro nulo; a lista lança com `p_now` nulo ou `p_marks` que não é lista com itens (virou `plpgsql`), e usa 200, 20 horas e 15 minutos quando o limite e as esperas vêm nulos |
| D-A2 | função 5; função 8 | recusa `taken_at` mais de 10 minutos no futuro; `identidade_vencida` olha o mais antigo entre `first_seen_at` e `created_at`; `identidade_prazo_errado` também sobe quando o prazo passa do relógio do banco |
| D-A3 | função 5 | um comentário por id no pacote (o do lote ganha do achado por id) |
| D-A4 | função 5 | a idade é calculada pelo banco e gravada; fora de `from_h` a `until_h` devolve `fora_da_tolerancia` sem gravar; os dois são obrigatórios em `p_snap` |
| D-A5 | função 8 | `erros_por_motivo` e `perdidos_por_motivo` |
| D-A6, D-M5 | funções 7 e 8 | `p_since` (nulo = sem corte); os perdidos contam do corte quando há |
| D-A7 | tabelas 1 e 3; função 5 | `pool_stats jsonb` (só número e sim/não, até 2.000 bytes) e `creator_replied` na leitura por marco |
| S-I7, R5 | funções 6 e 7 | `p_site_id` na lista e na rotina (nulo = todos; é como a agenda chama) |
| R3 | tabela 1 | `error_reason` só em formato de código |
| R1 | cabeçalho; comentário da função 9 | diz que a MG8 não recria as funções de impacto de remoção |

```sql
-- =============================================================================
-- MIGRATION MG8: observatorio_a5_e14_comentarios_de_destaque
-- =============================================================================
-- Fase A5 do Observatório, etapa E14 (spec v2.3, arquivo 02, seção 4.6). DEPENDE da MG1 (competitor_removed_items com
-- 'comentario' no check de kind; missing_since e live_* em competitor_videos). NÃO depende da MG10 nem da MG9.
-- O que traz: o retrato dos comentários por vídeo e marco (1, 7 e 30 dias), o comentário (texto da última leitura),
-- a leitura por marco, a IDENTIDADE do autor em tabela própria com prazo (28 dias), a escrita atômica do retrato,
-- a rotina que apaga a identidade vencida, a lista do que está devido, a prova embutida e a contagem para remoção.
--
-- Idempotência: create table/index if not exists, create or replace function, drop policy if exists antes de create
-- policy. Rodar duas vezes não muda nada. Compatibilidade: só cria objeto novo; nenhuma tabela, coluna ou função
-- existente é alterada. O código que está em main não lê nem grava nada daqui.
-- NÃO recria competitor_channel_removal_impact nem youtube_channel_removal_impact (decisão R1 do controlador: essas duas
-- têm um corpo só, por catálogo, e o dono do texto é o plano das ordens 8 e 10). Nenhuma das quatro tabelas tem FK para
-- youtube_channels. Lote B, depois da MG10 e da MG9 (não depende delas em SQL).

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O retrato: uma linha por vídeo e marco. Sem linha = "não coletado".
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_snaps (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  taken_at timestamptz not null,
  video_age_hours numeric not null,
  status text not null check (status in ('ok', 'sem_comentarios', 'desligados', 'erro')),
  error_reason text,
  pool_size smallint,
  pool_complete boolean,
  video_comment_count bigint,
  selected_count smallint,
  featured_lookup_n smallint,
  featured_unknown_n smallint,
  rule_version smallint not null,
  rule_params jsonb not null,
  units_used smallint not null,
  pool_stats jsonb,
  primary key (video_id, mark),
  constraint competitor_video_comment_snaps_reason_check check ((status = 'erro') = (error_reason is not null)),
  constraint competitor_video_comment_snaps_reason_format_check check (error_reason is null or error_reason ~ '^[a-z0-9_]{1,40}$'),
  constraint competitor_video_comment_snaps_pool_stats_check check (pool_stats is null or (jsonb_typeof(pool_stats) = 'object' and octet_length(pool_stats::text) <= 2000))
);
create index if not exists idx_cvcs_channel_taken on public.competitor_video_comment_snaps (competitor_channel_id, taken_at);
comment on table public.competitor_video_comment_snaps is 'A5 E14: retrato dos comentários de um vídeo de concorrente numa idade (marco 1, 7 ou 30 dias). A linha separa ok, sem_comentarios, desligados e erro; sem linha = não coletado.';
comment on column public.competitor_video_comment_snaps.error_reason is 'CÓDIGO de um catálogo fechado (o check só aceita letras minúsculas, algarismos e _ até 40): nunca texto vindo da API nem do banco. A frase que o dono lê sai de uma função do código, a partir do código. Só com status = erro.';
comment on column public.competitor_video_comment_snaps.video_age_hours is 'Idade do vídeo no retrato, CALCULADA PELO BANCO (taken_at menos o maior entre published_at e live_actual_start_at). O valor mandado por quem chama é ignorado.';
comment on column public.competitor_video_comment_snaps.pool_stats is 'Agregados do lote lido (até 100 conversas) que NÃO é guardado: só números e sim/não (a função recusa texto, lista e objeto). Nenhum texto, nome ou id. Nulo = retrato sem lote.';
comment on column public.competitor_video_comment_snaps.featured_lookup_n is 'Autores consultados em channels.list neste retrato (0 a 20). Nulo = a consulta falhou.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O comentário: uma linha por comentário guardado; o texto é o da última leitura. SEM identidade do autor.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comments (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  youtube_comment_id text not null,
  parent_id bigint references public.competitor_video_comments(id) on delete cascade,
  body text not null,
  body_truncated boolean not null default false,
  published_at timestamptz not null,
  edited_at timestamptz,
  is_creator boolean not null,
  creator_replied boolean,
  featured_reason text check (featured_reason in ('canal_acompanhado', 'inscritos', 'canal_proprio')),
  featured_channel_id uuid references public.competitor_channels(id) on delete set null,
  featured_size_band text check (featured_size_band in ('100k_1m', '1m_10m', '10m_mais')),
  featured_ratio_band text check (featured_ratio_band in ('10x_100x', '100x_1000x', '1000x_mais')),
  author_purged_at timestamptz,
  last_checked_at timestamptz,
  miss_streak smallint not null default 0,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date,
  removal_decision text check (removal_decision in ('manter')),
  removal_decided_at timestamptz,
  removal_decided_by uuid,
  unique (video_id, youtube_comment_id),
  constraint competitor_video_comments_bands_check check ((featured_size_band is null and featured_ratio_band is null) or featured_reason = 'inscritos'),
  constraint competitor_video_comments_featured_channel_check check (featured_channel_id is null or featured_reason = 'canal_acompanhado'),
  constraint competitor_video_comments_reply_check check (parent_id is null or is_creator)
);
create index if not exists idx_cvc_channel on public.competitor_video_comments (competitor_channel_id, first_seen_at);
create index if not exists idx_cvc_missing on public.competitor_video_comments (site_id, missing_since) where missing_since is not null and removal_decision is null;
create index if not exists idx_cvc_parent on public.competitor_video_comments (parent_id) where parent_id is not null;
create index if not exists idx_cvc_featured_channel on public.competitor_video_comments (featured_channel_id) where featured_channel_id is not null;
comment on table public.competitor_video_comments is 'A5 E14: comentário de destaque guardado (texto de terceiros, risco aceito pelo dono). A identidade do autor NÃO fica aqui: está em competitor_video_comment_authors, com prazo.';
comment on column public.competitor_video_comments.parent_id is 'Nulo = comentário de topo. Preenchido = resposta DO CRIADOR a ele (o check impede resposta de outra pessoa).';
comment on column public.competitor_video_comments.creator_replied is 'Só no topo. true = há resposta do canal do vídeo entre as vistas; false = todas as respostas foram vistas e nenhuma é dele; nulo = não se sabe.';
comment on column public.competitor_video_comments.author_purged_at is 'Preenchido pela rotina de anulação. A escrita nunca regrava identidade de comentário que já existia.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. A identidade do autor, com prazo. Uma linha por comentário de quem NÃO é o criador; apagada aos 28 dias.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_authors (
  comment_id bigint primary key references public.competitor_video_comments(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  display_name text,
  channel_id text,
  avatar_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cvca_due on public.competitor_video_comment_authors (expires_at);
comment on table public.competitor_video_comment_authors is 'A5 E14: nome, id do canal e URL da foto do autor de um comentário. Dado pessoal de terceiros: só quem edita lê; a linha é APAGADA quando expires_at vence (competitor_comment_identity_purge).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A leitura: uma linha por comentário e marco.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_marks (
  comment_id bigint not null references public.competitor_video_comments(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  likes integer not null,
  reply_count integer,
  relevance_rank smallint,
  slot text check (slot in ('criador', 'destaque', 'curtidos')),
  creator_replied boolean,
  primary key (comment_id, mark)
);
comment on column public.competitor_video_comment_marks.relevance_rank is 'Posição 1 a 100 no lote. Nulo = fora do lote, lido por id.';
comment on column public.competitor_video_comment_marks.creator_replied is 'O que ESTA leitura viu (true, false ou nulo = não se sabe), sem a regra de "sim não vira não se sabe" da coluna de mesmo nome do comentário. Só no topo lido no lote.';
comment on column public.competitor_video_comment_marks.slot is 'Grupo pelo qual foi escolhido neste marco. Nulo = não escolhido (lido só para acompanhar).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS. Nenhuma policy de escrita (só service_role).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.competitor_video_comment_snaps enable row level security;
alter table public.competitor_video_comments enable row level security;
alter table public.competitor_video_comment_marks enable row level security;
alter table public.competitor_video_comment_authors enable row level security;

drop policy if exists "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps;
create policy "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps
  for select using (public.can_view_site(site_id));

-- O texto e as leituras: quem tem o direito "ver desempenho privado" (MG11) ou edita. Se a MG11 ainda não existe,
-- nasce em can_edit_site e a MG11 troca (ela procura as policies pelo nome <tabela>_select).
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['competitor_video_comments', 'competitor_video_comment_marks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
  end loop;
end $$;

-- A identidade: SEMPRE só quem edita. Fica fora do bloco acima e a MG11 não a troca.
drop policy if exists "competitor_video_comment_authors_select" on public.competitor_video_comment_authors;
create policy "competitor_video_comment_authors_select" on public.competitor_video_comment_authors
  for select using (public.can_edit_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. A escrita atômica do retrato: o retrato, os comentários, as leituras, a identidade e as ausências, numa transação.
-- ─────────────────────────────────────────────────────────────────────────────
-- p_snap: { taken_at, from_h, until_h (a tolerância do marco: OBRIGATÓRIOS), status, error_reason, pool_size, pool_complete,
--           video_comment_count, selected_count, featured_lookup_n, featured_unknown_n, rule_version, rule_params, units_used,
--           pool_stats (objeto só de números e sim/não, ou ausente), identity_days (padrão 28), creator_replies_max (padrão 3) }
--           A idade do vídeo NÃO vem de quem chama: o banco calcula de taken_at e recusa o retrato fora da tolerância.
-- p_comments: lista de { youtube_comment_id, parent_youtube_id (nulo = topo), via ('lote' | 'id'), body, body_truncated,
--           published_at, edited_at, is_creator, creator_replied, featured_reason, featured_channel_id,
--           featured_size_band, featured_ratio_band, author { display_name, channel_id, avatar_url } | null,
--           likes, reply_count, relevance_rank, slot }
-- p_missing: ids de comentário guardado que foram pedidos por id e NÃO vieram (só quando a chamada deu certo).
-- Devolve { status: 'gravado' | 'ja_existe' | 'video_ausente' | 'fora_da_tolerancia', ...contagens }.
-- Id repetido em p_comments: fica um (o do lote ganha do achado por id; depois o primeiro) e o resto conta em nao_gravados.
create or replace function public.apply_competitor_comment_snap(
  p_video uuid, p_mark smallint, p_snap jsonb, p_comments jsonb, p_missing text[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_site uuid;
  v_channel uuid;
  v_prev text;
  v_t0 timestamptz;
  v_age numeric;
  v_from integer := (p_snap->>'from_h')::integer;
  v_until integer := (p_snap->>'until_h')::integer;
  v_stats jsonb := p_snap->'pool_stats';
  v_taken timestamptz := (p_snap->>'taken_at')::timestamptz;
  v_status text := p_snap->>'status';
  v_days integer := coalesce((p_snap->>'identity_days')::integer, 28);
  v_replies_max integer := coalesce((p_snap->>'creator_replies_max')::integer, 3);
  v_comments jsonb := coalesce(p_comments, '[]'::jsonb);
  v_recebidos integer := 0;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_identidades integer := 0;
  v_leituras integer := 0;
  v_por_id integer := 0;
  v_resp_novas integer := 0;
  v_resp_atualizadas integer := 0;
  v_ausentes integer := 0;
  v_marcados integer := 0;
  v_ignorados integer := 0;
  n1 integer; n2 integer; n3 integer; n4 integer;
begin
  if v_taken is null or v_status is null then
    raise exception 'retrato sem taken_at ou sem status' using errcode = '22023';
  end if;
  if p_mark not in (1, 7, 30) then
    raise exception 'marco fora de 1, 7 e 30' using errcode = '22023';
  end if;
  if jsonb_typeof(v_comments) <> 'array' then
    raise exception 'p_comments nao e lista' using errcode = '22023';
  end if;
  if v_status <> 'ok' and (jsonb_array_length(v_comments) > 0 or coalesce(array_length(p_missing, 1), 0) > 0) then
    raise exception 'retrato que nao e ok nao leva comentario nem ausencia' using errcode = '22023';
  end if;
  if v_days < 1 or v_days > 28 then
    raise exception 'prazo de identidade fora de 1 a 28 dias' using errcode = '22023';
  end if;
  -- o prazo da identidade conta de taken_at: um relógio adiantado em quem chama esticaria os 28 dias
  if v_taken > now() + interval '10 minutes' then
    raise exception 'taken_at no futuro' using errcode = '22023';
  end if;
  if v_from is null or v_until is null or v_from < 0 or v_until <= v_from then
    raise exception 'retrato sem a tolerancia do marco (from_h, until_h)' using errcode = '22023';
  end if;
  if v_stats is not null and jsonb_typeof(v_stats) = 'null' then
    v_stats := null;
  end if;
  if v_stats is not null and (jsonb_typeof(v_stats) <> 'object'
      or exists (select 1 from jsonb_each(v_stats) e where jsonb_typeof(e.value) not in ('number', 'boolean', 'null'))) then
    raise exception 'pool_stats so leva numero e sim/nao' using errcode = '22023';
  end if;

  select c.site_id, v.competitor_channel_id, greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at))
    into v_site, v_channel, v_t0
    from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
   where v.id = p_video;
  if not found then
    return jsonb_build_object('status', 'video_ausente');
  end if;

  -- dois disparos com o mesmo (vídeo, marco): o segundo espera o primeiro e encontra o retrato pronto
  perform pg_advisory_xact_lock(hashtextextended('cvcs:' || p_video::text || ':' || p_mark::text, 0));
  select s.status into v_prev from public.competitor_video_comment_snaps s where s.video_id = p_video and s.mark = p_mark;
  if v_prev in ('ok', 'sem_comentarios', 'desligados') then
    return jsonb_build_object('status', 'ja_existe', 'anterior', v_prev);
  end if;

  -- o rótulo do marco é garantido aqui, não só em quem chama: retrato fora da tolerância não é gravado (e seria final)
  v_age := round((extract(epoch from (v_taken - v_t0)) / 3600.0)::numeric, 2);
  if v_age is null or v_age < v_from or v_age >= v_until then
    return jsonb_build_object('status', 'fora_da_tolerancia', 'idade_h', v_age);
  end if;

  insert into public.competitor_video_comment_snaps as s (
    video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, error_reason, pool_size, pool_complete,
    video_comment_count, selected_count, featured_lookup_n, featured_unknown_n, rule_version, rule_params, units_used, pool_stats)
  values (
    p_video, p_mark, v_site, v_channel, v_taken, v_age, v_status, p_snap->>'error_reason',
    (p_snap->>'pool_size')::smallint, (p_snap->>'pool_complete')::boolean, (p_snap->>'video_comment_count')::bigint,
    (p_snap->>'selected_count')::smallint, (p_snap->>'featured_lookup_n')::smallint, (p_snap->>'featured_unknown_n')::smallint,
    (p_snap->>'rule_version')::smallint, coalesce(p_snap->'rule_params', '{}'::jsonb), coalesce((p_snap->>'units_used')::smallint, 0), v_stats)
  on conflict (video_id, mark) do update set
    taken_at = excluded.taken_at, video_age_hours = excluded.video_age_hours, status = excluded.status,
    error_reason = excluded.error_reason, pool_size = excluded.pool_size, pool_complete = excluded.pool_complete,
    video_comment_count = excluded.video_comment_count, selected_count = excluded.selected_count,
    featured_lookup_n = excluded.featured_lookup_n, featured_unknown_n = excluded.featured_unknown_n,
    rule_version = excluded.rule_version, rule_params = excluded.rule_params, pool_stats = excluded.pool_stats,
    units_used = least(s.units_used + excluded.units_used, 32767);

  if v_status <> 'ok' then
    return jsonb_build_object('status', 'gravado', 'retrato', v_status, 'recebidos', 0);
  end if;

  v_recebidos := jsonb_array_length(v_comments);

  -- um id repetido no pacote derrubaria a escrita inteira (21000) a cada tentativa: fica um por id
  select coalesce(jsonb_agg(d.x order by d.ord), '[]'::jsonb) into v_comments from (
    select distinct on (t.x->>'youtube_comment_id') t.x, t.ord
      from jsonb_array_elements(v_comments) with ordinality as t(x, ord)
     where t.x->>'youtube_comment_id' is not null
     order by t.x->>'youtube_comment_id', (coalesce(t.x->>'via', 'lote') = 'lote') desc, t.ord) d;

  -- o comentário que o dono mandou apagar não volta; fica registrado que ele foi visto de novo
  with ids as (select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x)
  update public.competitor_removed_items r set returned_seen_at = v_taken
   where r.site_id = v_site and r.kind = 'comentario' and r.returned_seen_at is null
     and r.youtube_id in (select yid from ids);

  -- (a) comentários de topo vindos no lote: insere ou atualiza; identidade só na inserção e só de quem não é o criador
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
      published_at timestamptz, edited_at timestamptz, is_creator boolean, creator_replied boolean,
      featured_reason text, featured_channel_id uuid, featured_size_band text, featured_ratio_band text,
      author jsonb, likes integer, reply_count integer, relevance_rank smallint, slot text)
     where x.parent_youtube_id is null and coalesce(x.via, 'lote') = 'lote'
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null
       and x.is_creator is not null and x.likes is not null
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id = x.youtube_comment_id)
  ), up as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, creator_replied, featured_reason, featured_channel_id, featured_size_band, featured_ratio_band,
      last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, i.youtube_comment_id, null, i.body, coalesce(i.body_truncated, false), i.published_at, i.edited_at,
           i.is_creator, i.creator_replied, i.featured_reason, i.featured_channel_id, i.featured_size_band, i.featured_ratio_band,
           v_taken, v_taken, v_taken
      from inp i
    on conflict (video_id, youtube_comment_id) do update set
      body = excluded.body, body_truncated = excluded.body_truncated, edited_at = excluded.edited_at,
      creator_replied = case when c.creator_replied is true and excluded.creator_replied is null then true else excluded.creator_replied end,
      featured_reason = coalesce(c.featured_reason, excluded.featured_reason),
      featured_channel_id = case when c.featured_reason is null then excluded.featured_channel_id else c.featured_channel_id end,
      featured_size_band = case when c.featured_reason is null then excluded.featured_size_band else c.featured_size_band end,
      featured_ratio_band = case when c.featured_reason is null then excluded.featured_ratio_band else c.featured_ratio_band end,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      where c.parent_id is null
    returning c.id, c.youtube_comment_id, (c.xmax = 0) as inserted, c.is_creator
  ), au as (
    insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, channel_id, avatar_url, expires_at)
    select u.id, v_site, i.author->>'display_name', i.author->>'channel_id', i.author->>'avatar_url', v_taken + make_interval(days => v_days)
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
     where u.inserted and not u.is_creator and jsonb_typeof(i.author) = 'object'
       and coalesce(i.author->>'display_name', i.author->>'channel_id', i.author->>'avatar_url') is not null
    on conflict (comment_id) do nothing
    returning 1
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot, creator_replied)
    select u.id, p_mark, v_site, i.likes, i.reply_count, i.relevance_rank, i.slot, i.creator_replied
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set
      likes = excluded.likes, reply_count = excluded.reply_count, relevance_rank = excluded.relevance_rank, slot = excluded.slot,
      creator_replied = excluded.creator_replied
    returning 1
  )
  select (select count(*) from up where inserted), (select count(*) from up where not inserted), (select count(*) from au), (select count(*) from mk)
    into n1, n2, n3, n4;
  v_novos := n1; v_atualizados := n2; v_identidades := n3; v_leituras := n4;

  -- (b) comentários JÁ guardados (topo ou resposta) que não vieram no lote e foram achados por id: só atualiza
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, via text, body text, body_truncated boolean, edited_at timestamptz, likes integer, reply_count integer)
     where x.via = 'id' and x.youtube_comment_id is not null and x.body is not null and x.likes is not null
  ), up as (
    update public.competitor_video_comments c set
      body = i.body, body_truncated = coalesce(i.body_truncated, false), edited_at = i.edited_at,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      from inp i
     where c.video_id = p_video and c.youtube_comment_id = i.youtube_comment_id
    returning c.id, c.youtube_comment_id, c.parent_id
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select u.id, p_mark, v_site, i.likes, case when u.parent_id is null then i.reply_count end, null, null
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set likes = excluded.likes, reply_count = excluded.reply_count, relevance_rank = null, slot = null,
      creator_replied = null
    returning 1
  )
  select (select count(*) from up), (select count(*) from mk) into n1, n2;
  v_por_id := n1; v_leituras := v_leituras + n2;

  -- (c) respostas DO CRIADOR vistas no lote que já estão guardadas: atualiza
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean, edited_at timestamptz,
      is_creator boolean, likes integer)
     where x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is true
       and x.youtube_comment_id is not null and x.body is not null and x.likes is not null
  ), up as (
    update public.competitor_video_comments c set
      body = i.body, body_truncated = coalesce(i.body_truncated, false), edited_at = i.edited_at,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      from inp i
     where c.video_id = p_video and c.youtube_comment_id = i.youtube_comment_id and c.parent_id is not null
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select u.id, p_mark, v_site, i.likes, null, null, null
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set likes = excluded.likes
    returning 1
  )
  select (select count(*) from up), (select count(*) from mk) into n1, n2;
  v_resp_atualizadas := n1; v_leituras := v_leituras + n2;

  -- (d) respostas DO CRIADOR novas: as mais antigas primeiro, até o teto por conversa (contando as já guardadas)
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
      published_at timestamptz, edited_at timestamptz, is_creator boolean, likes integer)
     where x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is true
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null and x.likes is not null
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id in (x.youtube_comment_id, x.parent_youtube_id))
       and not exists (select 1 from public.competitor_video_comments k
                        where k.video_id = p_video and k.youtube_comment_id = x.youtube_comment_id)
  ), par as (
    select p.id as parent_id, p.youtube_comment_id,
           (select count(*) from public.competitor_video_comments k where k.parent_id = p.id) as ja
      from public.competitor_video_comments p
     where p.video_id = p_video and p.parent_id is null
  ), novo as (
    select i.*, par.parent_id, par.ja,
           row_number() over (partition by par.parent_id order by i.published_at, i.youtube_comment_id) as rn
      from inp i join par on par.youtube_comment_id = i.parent_youtube_id
  ), ins as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, n.youtube_comment_id, n.parent_id, n.body, coalesce(n.body_truncated, false), n.published_at, n.edited_at,
           true, v_taken, v_taken, v_taken
      from novo n
     where n.rn + n.ja <= v_replies_max
    on conflict (video_id, youtube_comment_id) do nothing
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select s.id, p_mark, v_site, n.likes, null, null, null
      from ins s join novo n on n.youtube_comment_id = s.youtube_comment_id
    on conflict (comment_id, mark) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from mk) into n1, n2;
  v_resp_novas := n1; v_leituras := v_leituras + n2;

  -- (e) guardados que foram pedidos por id e não vieram: a ausência soma; marca na 2ª seguida, ou na 1ª se o marco é o 30
  with seen as (
    select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x
  ), up as (
    update public.competitor_video_comments c set
      last_checked_at = v_taken,
      miss_streak = least(c.miss_streak + 1, 32767),
      missing_since = case when c.missing_since is null and (c.miss_streak + 1 >= 2 or p_mark = 30)
                           then (v_taken at time zone 'America/Sao_Paulo')::date else c.missing_since end
     where c.video_id = p_video and c.youtube_comment_id = any(coalesce(p_missing, '{}'))
       and c.youtube_comment_id not in (select yid from seen where yid is not null)
    returning (c.missing_since is not null) as marcado
  )
  select count(*), count(*) filter (where marcado) into n1, n2 from up;
  v_ausentes := n1; v_marcados := n2;

  v_ignorados := v_recebidos - (v_novos + v_atualizados + v_por_id + v_resp_novas + v_resp_atualizadas);

  return jsonb_build_object(
    'status', 'gravado', 'retrato', v_status, 'recebidos', v_recebidos,
    'comentarios_novos', v_novos, 'comentarios_atualizados', v_atualizados, 'achados_por_id', v_por_id,
    'respostas_novas', v_resp_novas, 'respostas_atualizadas', v_resp_atualizadas,
    'identidades', v_identidades, 'leituras', v_leituras,
    'ausentes', v_ausentes, 'ausentes_marcados', v_marcados, 'nao_gravados', v_ignorados);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. A rotina: apaga a identidade vencida e carimba o comentário, numa instrução. Sem parâmetro de relógio de
--    propósito: ninguém consegue apagar antes da hora nem "adiantar" o prazo.
--    p_site_id nulo = todos os sites (é como a agenda chama, SEMPRE). O parâmetro existe para o teste de integração,
--    que roda num banco compartilhado com outras etapas e só pode mexer nas linhas do próprio site.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comment_identity_purge(p_site_id uuid default null)
returns jsonb
language sql security invoker set search_path = '' as $$
  with antes as (
    select count(*) as n from public.competitor_video_comment_authors a where p_site_id is null or a.site_id = p_site_id
  ), gone as (
    delete from public.competitor_video_comment_authors a
     where a.expires_at <= now() and (p_site_id is null or a.site_id = p_site_id)
    returning a.comment_id, a.expires_at
  ), upd as (
    update public.competitor_video_comments c set author_purged_at = now()
      from gone g where c.id = g.comment_id
    returning 1
  )
  select jsonb_build_object(
    'apagadas', (select count(*) from gone),
    'comentarios_carimbados', (select count(*) from upd),
    'vencidas_ha_mais_de_1_dia', (select count(*) from gone where expires_at < now() - interval '1 day'),
    'restantes', (select n from antes) - (select count(*) from gone));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. O que está devido: (vídeo, marco) dentro da tolerância e sem retrato final. O mais perto de perder o prazo primeiro.
--    p_marks: [{ "mark": 1, "from_h": 24, "until_h": 72 }, …] (vem de rules; as janelas não se sobrepõem).
--    Retrato em erro volta a ser devido depois de p_retry_after; se o motivo é passageiro (p_fast_reasons: rede, tempo
--    esgotado, 5xx…), depois de p_retry_fast. total_due = quantos há ao todo (o p_limit não esconde).
--    p_since: nulo = sem corte; com data, só entra o marco ATINGIDO (t0 + from_h) nela ou depois ("retroação nenhuma").
--    p_site_id: nulo = todos os sites (a agenda); o teste de integração passa o próprio site (banco compartilhado).
--    Parâmetro nulo NUNCA vira "nada devido": p_now nulo ou p_marks que não é lista com itens LANÇA (22023).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comment_due(
  p_now timestamptz, p_marks jsonb, p_retry_after interval, p_limit integer,
  p_fast_reasons text[] default '{}', p_retry_fast interval default interval '15 minutes',
  p_since timestamptz default null, p_site_id uuid default null
) returns table (
  video_id uuid, youtube_video_id text, site_id uuid, channel_row_id uuid, channel_youtube_id text,
  channel_subscribers integer, channel_subscribers_hidden boolean,
  mark smallint, t0 timestamptz, deadline timestamptz,
  video_comment_count bigint, video_checked_at timestamptz, prev_status text, stored_n bigint, total_due bigint
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if p_now is null or jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks) = 0 then
    raise exception 'competitor_comment_due: p_now nulo ou p_marks que nao e lista com itens' using errcode = '22023';
  end if;
  return query
  with m as (
    select (x->>'mark')::smallint as mark, (x->>'from_h')::integer as from_h, (x->>'until_h')::integer as until_h
      from jsonb_array_elements(p_marks) x
  ), base as (
    select v.id as video_id, v.video_id as youtube_video_id, c.site_id, c.id as channel_row_id, c.channel_id as channel_youtube_id,
           c.subscriber_count, c.subscribers_hidden, v.comment_count, v.last_checked_at,
           greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where (p_site_id is null or c.site_id = p_site_id)
       and v.missing_since is null and c.missing_since is null and v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
  ), due as (
    select b.*, m.mark, b.t0 + make_interval(hours => m.until_h) as deadline, s.status as prev_status
      from base b
      join m on b.t0 <= p_now - make_interval(hours => m.from_h) and b.t0 > p_now - make_interval(hours => m.until_h)
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
     where (p_since is null or b.t0 + make_interval(hours => m.from_h) >= p_since)
       and (s.video_id is null
        or (s.status = 'erro' and s.taken_at <= p_now - case when s.error_reason = any(coalesce(p_fast_reasons, '{}'))
                                                               then coalesce(p_retry_fast, interval '15 minutes')
                                                               else coalesce(p_retry_after, interval '20 hours') end))
  )
  select d.video_id, d.youtube_video_id, d.site_id, d.channel_row_id, d.channel_youtube_id,
         d.subscriber_count, d.subscribers_hidden, d.mark, d.t0, d.deadline,
         d.comment_count, d.last_checked_at, d.prev_status,
         (select count(*) from public.competitor_video_comments k where k.video_id = d.video_id) as stored_n,
         count(*) over () as total_due
    from due d
   order by d.deadline asc, d.video_id, d.mark
   limit greatest(coalesce(p_limit, 200), 1);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. A prova embutida. p_site_id nulo = todos os sites. p_grace = folga depois do marco antes de cobrar o retrato.
--    p_since: o mesmo corte da lista de devidos (nulo = sem corte); sem ele a prova cobraria o que a lista não lista.
--    Parâmetro nulo NUNCA vira zero: p_now, p_identity_days ou p_grace nulos, ou p_marks que não é lista com itens,
--    devolvem NULO (quem lê trata nulo como "prova ilegível", vermelho).
--    Números que ficam vermelhos em quem lê (ver o plano): identidade_vencida, identidade_prazo_errado,
--    identidade_de_criador, respostas_de_terceiros, retratos_atrasados (com a fila zerada), retratos_perdidos_7d
--    (menos os de motivo aceito, por perdidos_por_motivo) e erros_por_motivo (3 ou mais presos no mesmo motivo).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comment_health(
  p_site_id uuid, p_now timestamptz, p_marks jsonb, p_identity_days integer, p_grace interval,
  p_since timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with m as (
    select (x->>'mark')::smallint as mark, (x->>'from_h')::integer as from_h, (x->>'until_h')::integer as until_h
      from jsonb_array_elements(case when jsonb_typeof(p_marks) = 'array' then p_marks else '[]'::jsonb end) x
  ), base as (
    select v.id as video_id, c.site_id, v.discovered_at,
           greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where (p_site_id is null or c.site_id = p_site_id)
       and v.missing_since is null and c.missing_since is null and v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
  ), janela as (
    select b.video_id, b.discovered_at, b.t0, m.mark, m.from_h, m.until_h, s.status, s.error_reason
      from base b
      join m on b.t0 <= p_now - make_interval(hours => m.from_h) and b.t0 > p_now - make_interval(hours => m.until_h)
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
     where p_since is null or b.t0 + make_interval(hours => m.from_h) >= p_since
  ), inicio as (
    select min(s.taken_at) as desde, max(s.taken_at) as ate, count(*) as n, count(*) filter (where s.status = 'ok') as n_ok
      from public.competitor_video_comment_snaps s
     where p_site_id is null or s.site_id = p_site_id
  ), perdidos as (
    -- janela que FECHOU nos últimos 7 dias sem retrato final. Conta do corte (p_since) quando há; sem corte, da primeira coleta.
    select coalesce(s.error_reason, 'sem_retrato') as motivo
      from base b
      join m on b.t0 + make_interval(hours => m.until_h) <= p_now
            and b.t0 + make_interval(hours => m.until_h) > p_now - interval '7 days'
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
      cross join inicio i
     where (s.video_id is null or s.status = 'erro')
       and coalesce(p_since, i.desde) is not null
       and b.t0 + make_interval(hours => m.from_h) >= coalesce(p_since, i.desde)
       and coalesce(b.discovered_at, b.t0) <= b.t0 + make_interval(hours => m.until_h) - p_grace
  )
  select case when p_now is null or p_identity_days is null or p_grace is null
                or jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks) = 0
  then null else jsonb_build_object(
    'identidade_vencida', (
      -- o mais antigo entre o relógio de quem gravou (first_seen_at) e o do banco (created_at): relógio adiantado não esconde
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id)
         and least(c.first_seen_at, a.created_at) < p_now - make_interval(days => p_identity_days + 1)),
    'identidade_prazo_errado', (
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id)
         and (a.expires_at is distinct from c.first_seen_at + make_interval(days => p_identity_days)
              or a.expires_at > a.created_at + make_interval(days => p_identity_days) + interval '10 minutes')),
    'identidade_de_criador', (
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id) and c.is_creator),
    'respostas_de_terceiros', (
      select count(*) from public.competitor_video_comments c
       where (p_site_id is null or c.site_id = p_site_id) and c.parent_id is not null and not c.is_creator),
    'retratos_atrasados', (
      select count(*) from janela j
       where j.status is null
         and j.t0 <= p_now - make_interval(hours => j.from_h) - p_grace
         and coalesce(j.discovered_at, j.t0) <= p_now - p_grace),
    'retratos_em_erro', (select count(*) from janela j where j.status = 'erro'),
    'erros_por_motivo', (
      select coalesce(jsonb_object_agg(x.error_reason, x.n), '{}'::jsonb)
        from (select j.error_reason, count(*) as n from janela j where j.status = 'erro' group by 1) x),
    'retratos_na_janela', (select count(*) from janela),
    'retratos_perdidos_7d', (select count(*) from perdidos),
    'perdidos_por_motivo', (
      select coalesce(jsonb_object_agg(x.motivo, x.n), '{}'::jsonb)
        from (select p.motivo, count(*) as n from perdidos p group by 1) x),
    'retratos_total', (select n from inicio),
    'retratos_ok', (select n_ok from inicio),
    'primeira_coleta', (select desde from inicio),
    'ultima_coleta', (select ate from inicio),
    'comentarios_total', (
      select count(*) from public.competitor_video_comments c where p_site_id is null or c.site_id = p_site_id),
    'identidades_total', (
      select count(*) from public.competitor_video_comment_authors a where p_site_id is null or a.site_id = p_site_id),
    'comentarios_ausentes_sem_decisao', (
      select count(*) from public.competitor_video_comments c
       where (p_site_id is null or c.site_id = p_site_id) and c.missing_since is not null and c.removal_decision is null))
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. O que a remoção de um canal leva das quatro tabelas (a remoção já leva tudo por cascata; isto é a contagem).
--    Função PRÓPRIA, de propósito: competitor_channel_removal_impact NÃO é recriada aqui (decisão R1: um corpo só,
--    por catálogo, com um dono). As leituras e as identidades não têm FK direta para o canal (chegam pelo comentário)
--    e featured_elsewhere não é contagem por FK: por isso a contagem dos comentários tem função dela.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_channel_comment_impact(p_site_id uuid, p_channel_id uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select case when not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id)
    then jsonb_build_object('status', 'not_found')
    else jsonb_build_object(
      'status', 'ok',
      'comment_snaps', (select count(*) from public.competitor_video_comment_snaps s where s.competitor_channel_id = p_channel_id),
      'comments', (select count(*) from public.competitor_video_comments c where c.competitor_channel_id = p_channel_id),
      'comment_marks', (select count(*) from public.competitor_video_comment_marks m
                          join public.competitor_video_comments c on c.id = m.comment_id where c.competitor_channel_id = p_channel_id),
      'comment_authors', (select count(*) from public.competitor_video_comment_authors a
                            join public.competitor_video_comments c on c.id = a.comment_id where c.competitor_channel_id = p_channel_id),
      'featured_elsewhere', (select count(*) from public.competitor_video_comments c
                              where c.featured_channel_id = p_channel_id and c.competitor_channel_id <> p_channel_id))
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Quem executa: só service_role.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.competitor_comment_identity_purge(uuid) from public, anon, authenticated;
revoke all on function public.competitor_comment_due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_comment_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) to service_role;
grant execute on function public.competitor_comment_identity_purge(uuid) to service_role;
grant execute on function public.competitor_comment_due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid) to service_role;
grant execute on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) to service_role;
grant execute on function public.competitor_channel_comment_impact(uuid, uuid) to service_role;
```
