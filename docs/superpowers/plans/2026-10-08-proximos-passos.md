# Observatório, coleta e A/B Lab — onde paramos e o que vem (08/10/2026)

Documento de continuidade. Quem retomar lê isto primeiro, depois o spec da etapa que for fazer.
Método do dono: terminar um plano, conferir se foi entregue por inteiro, refinar os specs
seguintes com o que se aprendeu, e só então seguir. Mockup aprovado antes de qualquer tela.

## 1. O que está em produção

| Item | Estado |
|---|---|
| Lote L1a da coleta (jobs e bruto da Reporting API, metadados diários, veredito único do cron) | `main` 38d6fc1b, migration `20261007000006` aplicada |
| Primeira execução (08/10 09:01 SP) | sucesso; 8 jobs `ativo` (4 tipos × 2 canais); 35 linhas de metadados para 35 vídeos |
| Reporting API | ativada no projeto certo (os jobs foram criados) |
| Lote L1b da coleta (estado de autorização do canal, `privacy_status` e `is_short` pela `videos.list`, chave estrangeira, execuções do cron gravadas) | migration `20261008000002` aplicada pelo dono em 08/10; código em `staging` `4cea52a5`; a promoção para `main` e a primeira execução (09/10 09:00) estão no ledger do L1b |

## 2. Promovido para `main` em 08/10 (merge 0b7b8aea)

| Commit | O que é | Precisa de |
|---|---|---|
| `a3b1b153` | migration `20261008000001`: colunas do alerta de fadiga aceitam views | aplicada em produção pelo dono em 08/10 |
| `08491bd8` | thumbnail arquivada em 1280×720 (cai para 640×480, depois 480×360); identidade segue pela `hqdefault` | promoção; vale só para arquivamentos futuros |
| `3a2c9784`, `0db29355`, `b59ec6b9` | specs, plano do L1a, mockup do canal e do histórico | nada |
| `80ceed03` + `e89e4e46` + `1613cb6f` | aviso de fadiga no sininho, feito e desfeito no mesmo dia (ver §5) | nada |

Toda promoção futura para `main`: pedir autorização explícita ao dono na hora.

## 3. Pendências com data

1. **09/10 (T+24 h):** rodar os SELECTs do Step 2 da Task 17 do plano
   `2026-10-07-coleta-l1a-plan.md`. Zero relatórios em 24 h não é falha (o Google leva até 48 h).
2. **11/10 (T+72 h):** aceite 8 (Step 3 da Task 17). Depois: fechar o runbook (Step 4), revisão de
   totalidade (Step 5, tabela de 35 requisitos) e as 10 perguntas do Step 6.
3. **Quando o primeiro CSV de alcance chegar:** anotar o cabeçalho real, a unidade do CTR, se há
   coluna de cliques, se o relatório combinado abre por origem de tráfego, e se dias ou vídeos de
   baixo volume somem do arquivo. Conferir 3 vídeos contra o YouTube Studio. Isso decide o L2.
4. ~~A conferir: 10 tentativas `sondagem` e 10 `relatorio`.~~ **Resolvido em 08/10** (código e
   produção): são 2 de escopo canal + 8 de escopo job em cada tipo (`jobs-step.ts:60-61`,
   `reports-step.ts:72` e `:256`). É o desenho.
4a. **Leitura antecipada de 08/10 12:20 (T+3 h), não substitui os itens 1 e 2:** 0 relatórios e 0
   brutos; 8 jobs `ativo`; 35 linhas de metadados; 0 órfãos. Revisão de totalidade parcial no
   ledger: 33 de 35 linhas com commit, a 34 (aceite 8) espera 11/10.
4b. **Falha em verde a decidir antes do L2:** os dois canais estão fora do filtro "publicou nos
   últimos 90 dias" (`tnFigueiredo` publicou pela última vez em 10/12/2024; `Thiago Figueiredo`
   tem 0 vídeos em `youtube_videos`). Para eles "4 vazios seguidos" e "6 dias sem relatório" nunca
   ficam vermelhos. E os tempos de cada passo do cron não ficam gravados em lugar nenhum.
5. Ao fechar o L1a: listar ao dono os "Rulings" do ledger
   (`.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`) e só então apagar a pasta.

## 3a. Onde retomar (escrito em 08/10 à tarde)

Decisão do dono em 08/10: **fazer o L2 inteiro a partir de 09/10 depois das 09:00**, sem modo economia até o
L2 (revisor em cada tarefa, revisão final no modelo mais capaz), e **parar antes do A/B Lab**.

1. Conferir a execução das 09:00 com o código do L1b: SELECTs do Step 1 da Task 13 de
   `2026-10-08-coleta-l1b-plan.md`. O que olhar primeiro: `com_privacidade = linhas` no canal com
   vídeos, e uma linha nova em `yt_own_collection_runs` com `falhas` vazia.
2. Ver se já existe relatório de alcance `baixado`. Se sim: anotar o cabeçalho real e pedir ao dono o
   export para `apps/web/test/fixtures/yt-reporting/`. Se não: perguntar ao dono se espera mais um dia
   ou se faz já a metade do diário por vídeo (que não depende do CSV).
3. Escrever o plano do L2 inteiro e executar.
4. Fechar o L1a em 11/10 (item 2 acima) e, com o sim do dono, apagar as duas pastas de trabalho
   (`.superpowers/sdd/2026-10-07-coleta-l1a-plan` e `…/2026-10-08-coleta-l1b-plan`), depois de listar a
   ele os "Rulings" dos dois ledgers.

Pendências do L1b que são do dono: (a) o aceite "canal revogado de teste vira `reautorizar` e volta a
`ok`" exige revogar e reconectar um canal de verdade na conta Google; sem isso fica "coberto só por
teste"; (b) decidir se a função de remover canal deve apagar sozinha tentativas e jobs (emenda 6 do
spec da coleta).

Esforço medido do L1b: cerca de 2,9 milhões de tokens de subagente (implementadores ~780 mil,
revisores por tarefa e final ~940 mil, duas ondas de correção ~540 mil, três re-revisões no modelo
mais capaz ~600 mil), em cerca de 2 horas de relógio. Estimativa para o L2 no mesmo regime: 3 a 3,5
milhões.

## 3b. Onde retomar (escrito em 09/10 ~14:30, fim de sessão por orçamento)

Ledger com tudo (rulings, achados, esforço): `.superpowers/sdd/2026-10-09-coleta-l2-plan/progress.md`. Leia-o inteiro antes de qualquer coisa.

**Conferências de 09/10 (feitas):** L1b verde em produção (execução das 09:00, 35 de 35 com `privacy_status`, canais em `ok`). Os relatórios chegaram: cabeçalho real `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr`, CTR em 0–1, sem cliques. Achado: os relatórios fecham o dia às 07:00 UTC (Pacífico com horário de verão), não UTC-8 fixo; `seconds_*_reporting` está 1 h deslocado até 01/11 (emenda 9 do spec da coleta; corrigir depois de medir novembro).

**L2 (plano `2026-10-09-coleta-l2-plan.md`): código quase todo feito, NADA no remoto.** 15 commits locais em `staging` (`eb85a52b..daad59bb`). Migration `20261009000001` NÃO aplicada em produção.
- Completas e revisadas: Tasks 1, 2, 3, 4, 5, 6, 8.
- Task 7 (ligar os passos em `index.ts`, `tres-dias`): implementada no commit `daad59bb` (593 testes verdes na pasta da coleta e nos dois testes da rota). A REVISÃO dela não foi despachada: o pacote está pronto em `review-d7cc8e0b..daad59bb.diff` na pasta do ledger.
- Faltam: revisão da Task 7; Task 9 (runbook; as emendas ao spec da coleta já estão commitadas); revisão final do lote no modelo mais capaz; suíte inteira com log; os 3 testes de integração com `HAS_LOCAL_DB=1`; `npm run db:push:prod` (dono); push (autorização); CI; promoção (autorização); Task 11 (conferência em produção) e aceite 9 em 48 h.
- Duas emendas ao plano decididas na execução, já no código: o diário grava em trechos contíguos por dia e para na primeira falha; o critério B do alcance só acusa quando chegou relatório `baixado` e nenhuma linha entrou; CTR fora de 0–1 recusa o relatório.

**Telas (etapa 5 do roteiro): mockup em rodadas, AINDA NÃO APROVADO.** Pasta `docs/superpowers/mockups/2026-10-07-pagina-canal/`, tudo SEM COMMIT (rodadas 5 a 8; a 8 estava em execução: confira a seção "Rodada 8" do LEIAME e as capturas `shots/r8-*`). Servir com `python3 -m http.server 8791 --bind 127.0.0.1` dentro da pasta. Decisões do dono em 09/10, a levar ao spec de telas (hoje v8, commit `6219f1bf`) como v9 quando ele aprovar o mockup:
- cartão novo da forja entra na fase A; Histórico sem abas de seção; o botão da forja do cabeçalho rola E pede, com andamento em TRÊS etapas (Na fila, Escrevendo, Pronta);
- painel lateral de Canais sai para concorrente; cabeçalho do canal com a faixa de números mais rica ("Todos os números");
- canal próprio: página própria, e aparece no TOPO e NA LISTA de Canais, com a posição na ordenação; "Comparar com o meu canal"; atalho "Meu canal" na moldura;
- cliques sempre em contagem, sem corte e sem percentual por vídeo;
- o dono disse da rodada 7: "perto da versão final, mas ainda precisa melhorar". Pediu na tela do vídeo próprio: Anterior/Próximo, números com rótulo, ⓘ preenchido, mais detalhe; perguntou se vale leitura da forja para vídeo próprio (resposta dada: vale, depois do L2 em produção; no mockup fica "ainda não disponível").

**A/B Lab (etapa 4): spec v6 commitado (`cfbbb558`), esperando o dono.** Ele mandou esperar o mockup fechar. Revisão deu 62 ao v5 e 86 ao v6; a "parte 1" virou quatro entregas (P1 fadiga e vídeo em alta; P2 avaliação automática desligada; P3 sai a descrição; P4 restauração segura); dez perguntas na seção 8 do spec.

**Perguntas do dono ainda sem resposta:** ordem telas × A/B; a função de remover canal apagar sozinha tentativas e jobs (com o L2 são sete `delete`); o aceite do L1b com revogação real; a lente "Referências" (vídeos grandes no nicho: o outlier atual é relativo ao próprio canal, por isso o Nômade Raiz quase não aparece; medido em 09/10).

**Regras novas do dono (09/10), também na memória:** Opus planeja, Sonnet executa; effort dos subagentes começa em `high` e desce para `medium`; nunca `xhigh` nem `max`; custo sempre visível (linha de status configurada; tokens de subagente informados a cada fecho). O export do CSV para fixture pode ser feito pelo agente.

**Pendências com data:** toda manhã depois das 09:00, a execução do cron e relatórios novos; **11/10**, fechar o L1a (item 2 da seção 3) e perguntar se pode apagar as pastas de trabalho do L1a e do L1b.

## 3c. Estado de 09/10 à noite (retomada)

**L2:** código, runbook, revisão final (Opus) e onda de correção fechados; suíte inteira verde (21.795 testes), integração com banco local verde (30 testes). Migration `20261009000001` **aplicada em produção pelo dono em 09/10** (conferido: duas tabelas vazias, função e duas policies). Faltam: push em `staging` (autorização), CI, promoção (autorização), Task 11 (conferência em produção na execução seguinte das 09:00) e o aceite 9 em 48 h. Ledger: `.superpowers/sdd/2026-10-09-coleta-l2-plan/progress.md`.

**Respostas do dono às perguntas abertas (09/10):**
- **Ordem:** telas antes do A/B Lab.
- **Remover canal:** nem apagar na hora, nem sete `delete` manuais. O dono quer remoção reversível: o canal fica marcado, um cron apaga tudo depois de um prazo, e até lá dá para desfazer, com o aviso "se não reverter em N dias, perde tudo". A desenhar (emenda ao spec da coleta; prazo, o que a tela mostra, o que o cron apaga e em que ordem) antes do L3.
- **Lente "Referências"** (vídeos grandes no nicho, em números absolutos, não relativos ao próprio canal): entra no roteiro, depois da fase A das telas.
- **Aceite do L1b com revogação real:** o dono não lembrava do item; reexplicado, espera resposta.
- **Mockup:** rodada 9 pedida pelo dono. Tela própria de comparação entre dois canais (`comparar.html`), porque "Comparar com o meu canal" só navegava para o canal próprio.

**Pendência que a revisão final do L2 levantou:** o critério B do alcance não avalia os dois canais reais (estão fora do filtro "publicou nos últimos 90 dias"); é o item 4b da seção 3, ainda sem decisão.

## 3d. Mockup aprovado em 10/10 (rodadas 5 a 12) e o que rever no fim

**O dono aprovou o mockup "por enquanto" em 10/10**, depois da rodada 12, e mandou prosseguir: spec de telas v9, o "pode" dele, plano da fase A. **L2 em produção desde 09/10 à noite** (`main` em `c8d26d0b`); falta a Task 11 (conferência da execução das 09:00) e o aceite 9. **Aceite do L1b com revogação real: não fazer**; fica "coberto só por teste", e se um canal cair em `reautorizar` sozinho, conferir a volta a `ok`. O conserto da dica presa na tabela de Canais está commitado (`45a9bbfb`), **sem push por decisão do dono**: vai num push só com o que vier.

Decisões das rodadas 9 a 12, a levar ao spec v9:
- **Tela própria de comparação** (`comparar.html?a=&b=`): dois canais lado a lado, seletor de cada lado, "Inverter lados"; entradas pelo cabeçalho do concorrente, pela lista de Canais e pelo canal próprio. O canal próprio é sempre laranja, o outro azul, e sem canal próprio o lado A é areia. "Leitura rápida" calculada no topo; régua do nicho com os dois canais marcados e a posição escrita ("13º de 14"), não percentil; "maior" a partir de 10% de diferença, "×" só acima de 2×, percentual abaixo; "maior não é melhor". Bloco "Só o seu canal mede". Cartão da leitura da forja (pacote novo, não existe no produto).
- **"Este vídeo no canal"**: frase-resumo e uma régua por número (um traço por vídeo do canal, pelo valor; cor por terço; duração neutra); impressões contam "de 33" quando 2 vídeos não têm impressão.
- **Cor por estado no gráfico de impressões** e uma cor única de "não medido" (rosa com hachura) em todas as telas.
- **Dicas sempre acima do conteúdo**: camada única no fim da página, viram para cima, nunca saem da janela; quatro itens de aceite na subseção "Para o produto" da rodada 12 do LEIAME.
- **Lista de Canais com "Todos | Longos | Shorts"**, padrão Longos; em "Todos" as duas medidas por célula, sem mediana misturada, ordem pelos longos.
- Cliques sempre em contagem, sem percentual (mantido).

**A rever no fim, com tudo implementado (pedido do dono em 10/10; são os pontos que o controlador acha fracos):**
1. "Todos" na lista de Canais está pesado: "longos"/"Shorts" repetidos em cada célula; levar o rótulo para o cabeçalho da coluna.
2. "escala √" embaixo de réguas é texto de engenheiro; vai para o ⓘ.
3. A coluna Ritmo da tabela de produção (uploads por semana) não existe na lista do mockup.
4. Um ⓘ por linha ao lado dos inscritos dá 72 paradas de Tab na lista de 70.
5. A tela de comparação é densa (cinco colunas); a Leitura rápida ainda é uma linha comprida quando um lado ganha em muita coisa.
6. Muitos "não medido" no lado do canal próprio; três linhas se resolvem com o L2 em produção (views por dia), conferir depois.
7. Concorrente × concorrente é magro no mockup por falta de dados (só Leo Khev e o canal próprio têm vídeos); conferir com dados reais.
8. Dica de uma linha do meio encostada no pé da janela ainda é cortada em produção (o conserto `45a9bbfb` cobre a linha de baixo e a última); some quando a dica ganhar camada própria na fase A.
9. Não testados em nenhuma rodada: toque real, leitor de tela, rotação em aparelho, contraste medido na tela (foi calculado por script), outros navegadores além do Chrome. O dono usa Opera.
10. A lista de grupo da linha do tempo do Histórico foi movida para a camada nova sem dado para exercitá-la.
11. Empate na régua com um lado destacado afasta 2,6 px em vez de empilhar.
12. Leitura da forja para comparação e para vídeo próprio: cartões de exemplo; são pacotes novos (L4).

## 3e. Onde retomar (escrito em 10/10 de madrugada, fim de sessão por tamanho)

**Spec de telas v9 aprovado pelo dono em 10/10** (`docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md`, emendas 22 a 46). A fase A virou cinco: **A0** fundação (camada única de dicas e menus, tokens de cor, carregador do canal) → **A1** canal do concorrente → **A2** Histórico com o cartão da forja (risco alto) e **A3** lista de Canais e comparação (independentes entre si) → **A4** canal e vídeo próprio, com o leitor das tabelas do L2 dentro dela. Decisões do dono em 10/10 além das recomendações aceitas: a posição segue o filtro de nicho e é **geral** quando o nicho é "Todos" (ele quer ver o canal mais bem-sucedido entre nichos; a comparação aceita canais de nichos diferentes); a lista de Canais mantém as colunas de produção; "o plano tem de mostrar tudo no fim" (nada do mockup fica sem dado por falta de leitor).

**Próximos passos, em ordem:**
1. **Task 11 do L2** (só SELECT, depois das 09:00 de 10/10): a execução nova em `yt_own_collection_runs` (`falhas`, `ms_passos` com `alcance` e `diario`, `resumo.alcance.erros` por causa do bytea), linhas em `yt_own_video_daily` e `yt_own_video_reach_daily`; conferir 3 vídeos contra o YouTube Studio. Anotar no ledger do L2. Aceite 9 em 48 h. Depois, fecho do L2 com a lista de rulings do ledger (`.superpowers/sdd/2026-10-09-coleta-l2-plan/progress.md`) e a pergunta se pode apagar a pasta.
2. **Plano da A0** (superpowers:writing-plans, a partir da seção 4.2 "A0" e da seção 19 do spec), o "pode" do dono e a execução por subagente.
3. **Um push só**, com autorização do dono: hoje estão só locais `45a9bbfb` (conserto da dica da tabela de Canais), `c0399682` (mockup) e o commit do spec v9. O dono mandou segurar o push até haver mais coisa pronta. O `45a9bbfb` toca o CMS e já teve validação autenticada local.
4. **11/10:** fechar o L1a (item 2 da seção 3) e perguntar se pode apagar as pastas de trabalho do L1a e do L1b.
5. Depois das telas: A/B Lab (reapresentar as dez perguntas da seção 8 do spec v6 e pedir para planejar P1, P2 e P3). Desenhar a remoção reversível de canal antes do L3. Lente "Referências" depois da fase A.

**Custo desta sessão (subagentes):** 2,50 milhões de tokens (2,21 milhões em Sonnet, 286 mil em Opus): L2 792 mil, mockup rodadas 9 a 12 1,20 milhão, conserto da dica 149 mil, spec v9 363 mil. Cada rodada de mockup custou de 200 a 400 mil.

## 3f. Onde retomar (escrito em 10/10 à tarde: A0 em produção, Task 11 do L2 conferida)

**A0 está em produção** desde 10/10 08:08 (`staging` `17731aa4`, `main` `1840d083`, sem migration). CI e deploys verdes. Falta só o dono abrir o Observatório logado em produção (em especial no Opera, onde os flutuantes não foram testados). Ledger: `.superpowers/sdd/2026-10-10-telas-a0-fundacao-plan/progress.md`. Custo de subagentes da A0: ≈4,52 M tokens Sonnet + 373 k Opus.

**Task 11 do L2 conferida por SELECT em 10/10 15:45.** A execução das 09:03 veio sem falha: alcance com 0 erros (o bytea pelo PostgREST real funcionou), 87 linhas em `yt_own_video_reach_daily`, 93.440 em `yt_own_video_daily`, 144,7 s de 270 s. Dois achados, anotados no ledger do L2, sem correção:
- **A.** A Analytics API devolve todos os dias da janela com zero: 97,6% das linhas do diário têm `views = 0`, e nelas `avg_view_percentage` e `avg_view_duration_seconds` vêm 0 em vez de nulo. O spec da coleta supunha que esses dias não vinham. Decisão do dono: anular as médias quando `views = 0` (e corrigir as linhas já gravadas) ou aceitar. Pesa na A4, que lê essa tabela.
- **B.** A fila de relatórios drena 16 por execução e recebe ~8 por dia; os 168 `listado` levam cerca de três semanas. Observar `atrasados`.

**Próximos passos, em ordem:**
1. Dono: conferir 3 vídeos contra o YouTube Studio; aceite 9 formal depois de 11/10 à noite; fecho do L2 e a pergunta sobre apagar a pasta.
2. **Plano da A1** (canal do concorrente), com o "pode" do dono. O plano carrega: aposentar ou reescrever os ~305 testes e2e de fidelidade contra os mockups de 02/10 (ruling G1); valores do tema claro em `tokens-telas.css` (D7); a guarda de acesso antes de `loadChannelDataset` e os campos que lançam no conjunto de um canal; flutuante dentro de modal (achado 9) e `aria-describedby` nas dicas (achado 6); os pulados de `nice-to-have.md` e os 3 menores de `final-fix-rereview.md`; a decisão sobre `comment_count ?? 0` (ruling G2).
3. 11/10: fechar o L1a e perguntar se apaga as pastas do L1a e do L1b.
4. Depois de A1: A2 e A3, A4, e então o A/B Lab (itens 5 da seção 3e seguem valendo).

## 3g. Onde retomar (escrito em 10/10 à noite: A1 em staging)

**Estado.** Fase A1 (página do canal do concorrente, `canal/<id>`) implementada e em `staging` remoto (`1ac235a5`): as 10 tarefas de código do plano `2026-10-10-telas-a1-canal-concorrente-plan.md`, a revisão final em Opus e uma onda de conserto. Promovida para produção em 10/10 à noite: `main` = `31425bf9` (árvore igual à de `staging` `1ac235a5`), CI e deploys de produção verdes. O ledger da execução foi apagado em 10/10 por decisão do dono; o que sobra dele está nesta seção.

**Medido em 10/10.** Vitest inteiro: 22.385 testes, zero falhas. Typecheck limpo. `next build` verde. Playwright local (`canal.spec.ts` + `flutuantes.spec.ts`): 85 passando. Validação logada no CMS local: roteiro inteiro em 1440 px no tema escuro, console limpo, nenhuma resposta 500. O CI ficou vermelho nos dois primeiros pushes por limite de tempo do executor de testes (todos os testes verdes); conserto no fixture em `1ac235a5`.

**Decisões tomadas pelo controlador (o dono pode reverter).**
- Teto de tamanho da D2: 3.000 vídeos antigos dão 3,77 MB de JSON cru e 114 KB com gzip; o teste passou a exigir 200 KB gzip no lugar de 1,2 MB cru. Corte barato disponível: tirar `pin.hint` de cada vídeo e derivar campos no cliente.
- O painel lateral de concorrente continua montado no modelo de Canais (a página redireciona antes); o corte do código morto e de uns 25 testes é tarefa própria.
- A barra de controles não fica presa em 390 px: o spec 5.2 só prende com largura de 768 px ou mais.
- Push para `staging` feito pelo controlador, por ordem do dono em 10/10.

**Decisões do dono em 10/10 à noite.**
1. Cor do "não medido" no tema claro (D7): fica como está (`#8E2A62` sobre `#F7E1EC`).
2. Vista Lista: apertar a linha para caber 8 inteiras em 1440×900 (linha de 50 px, miniatura de 80 px), em vez de aceitar 7.
3. Frescor: fechar quando o gatilho sai da janela é o comportamento desejado (já é o da camada; nada a mudar).
4. Pastas da A0 e da A1 em `.superpowers/sdd/` apagadas; os achados menores adiados da A1 estão copiados no fim desta seção.

**O que nenhum agente conferiu.** Canal próprio abrindo o painel lateral em navegador (o banco local não tem canal próprio; só teste unitário); o roteiro em 390 px e no tema claro fora do que o Playwright mede; Opera; leitor de tela (VoiceOver: filtrar, buscar, trocar a vista, tabela por célula, `aria-describedby` das dicas); zoom de 200 a 400% em 320 px; toque real; o menu ⋯ fechando antes de o diálogo de remoção abrir; tempo de Canais até a página em build de produção.

**Pendências herdadas da A0.** `session.current('todos')` e `compose` com `split` lançam com a mensagem de `forja.niches`: adiado, a página do canal não os chama. `onHl(null)` pode limpar destaque de outra origem: adiado, impacto desprezível. `gap` da prova de flutuantes declarado à mão: adiado, segue como segunda fonte.

**Menores adiados da A1.** Os de mais peso: links de vídeo levam `ids=` com até 100 vizinhos na URL (cerca de 4 KB); `use-rolagem-ao-voltar.ts` pode reaplicar rolagem velha num Voltar entre abas; aviso intermitente de `key` duplicada do React visto uma vez; "Ver as N trocas em Mudanças" abre uma tela que também conta troca de descrição.

**Custo de subagentes em 10/10 (A1).** Cerca de 5,6 milhões de tokens Sonnet (10 implementadores, 9 revisores, 4 consertos, validação em navegador, re-revisão) e 225 mil Opus (revisão final).

**Menores adiados da A1, lista completa (copiada do ledger antes de apagar a pasta).**
- Task 1:: vpdText(NaN) sem guarda de Number.isFinite (numeros.ts:5)
- Task 1:: vpdText 999,5..999,99 vira "1000" (numeros.ts:8); teste não cobre a borda do milhar
- Task 1:: link.historico fixa ordem das chaves e descarta chave fora da lista (links.ts:187-202)
- Task 1:: canalQuery emite video fora da aba trocas e parseCanalState descarta (params.ts:89)
- Task 1:: RED não observado
- Task 2:: acima2x mostra "0" sem longo comparável ("0 de 0")
- Task 2:: vpdPorMil com subs = 0 cai em frase errada
- Task 2:: dois testes (n = 2, partes zeradas) guardados por if podem passar sem testar
- Task 2:: corpo do texto de erro e atraso sem asserção
- Task 2:: ultimoVideo usa D.ago(lastAt) em vez de kl.lastUploadAgo (equivalente)
- Task 3:: dois console.log no teste canal-videos-model
- Task 3:: testes condicionais vazios se o fixture não tiver o caso; teste de thumbSrc frouxo
- Task 3:: classe de combinantes de norm com caracteres literais no fonte
- Task 3:: resultado com busca e filtro diz "vídeos" em vez do formato; cast e anotação redundantes
- Task 4:: id de canal em maiúsculas na URL cai em "Canal não encontrado" (page.tsx:24); demais em task-4-review.md
- Task 5:: "Abrir no YouTube" não fecha o menu; notas do topo do menu fora da navegação por setas; busca sem maxLength=100; selos do cartão duplicam badges do modelo; demais em task-5-review.md
- Task 6:: thead{display:none} sem teste; .cv-tw sem overflow-x:auto de segurança; views nulas repetem "sem contagem" em três células; ramo morto VISTA LISTA no teste de CSS
- Task 7:: BACK fixo ?tab=trocas perde from/back e video=; clique na aba ativa mantém video=; effLine é terceiro produtor de texto de efeito sem a exceção de fixado antigo; nenhum teste lê o cabeçalho para bater a contagem; duplicações vizinhanca/cap
- Task 8:: rótulo do nicho vem do conjunto do canal e o cartão do conjunto do site (site sem o nicho abre em Todos sob o rótulo); sem teste da guarda com tab=leitura e obs null; id/tabIndex de cl-h2 sem uso
- Task 9:: M-1..M-6 em task-9-review.md; #cv-h2 sem scroll-margin-top (conferir na Task 10); janela de 1500 ms da pré-carga é palpite
- Final:: use-rolagem-ao-voltar.ts:24-37 popstate global pode reaplicar rolagem velha num Voltar entre abas; :78-95 restaurar() não cancela no unmount (limitado a 6 s); frase longa na célula Trocas em backfill em coluna estreita; aviso React de key duplicada intermitente em CanalScreen (nó leitura)

**Próximo passo.** Dono confere em produção; depois a fase A2 (Histórico: chegada pela troca, `canal=` no pager e na trilha).

## 3h. Onde retomar (escrito em 11/10: A2 em produção)

**Em produção desde 11/10 à tarde.** `staging` = `e14cfd2e` (26 commits desde `dc30643c`), CI desse commit verde em todos os jobs, deploys de preview verdes; `main` = `f6bebde2` (árvore igual à de `staging` `e14cfd2e`), deploys de produção do web e da API verdes, home e login do CMS respondendo 200. Depois do texto abaixo (escrito antes do push) entraram a revisão final do lote em Opus e uma onda de conserto de cinco commits (`eca3b769`, `b9f390a0`, `58319d5f`, `917fcdcd`, `e14cfd2e`): vídeo fora dos acompanhados volta a mostrar o histórico inteiro (herdava os 30 dias sem ter seletor); o botão do cabeçalho com pedido em andamento só rola; escolher "30 d" depois de "7 d" com troca antiga não pula mais para 90 d; a lupa não cobre o texto da miniatura sem imagem; o selo da forja não quebra com o ícone sozinho em 390 px. Voltar do navegador com o visualizador aberto foi provado no Playwright e não trava a página. Medição final sobre `e14cfd2e`: Vitest inteiro 22.887 verdes, zero falhas, 200 s; typecheck web e API sem erro; `next build` verde; Playwright 119 passando (Histórico 35, canal 40, flutuantes 39). Abertos da revisão final: os menores m2 a m9, com o motivo de cada um em `.superpowers/sdd/2026-10-11-telas-a2-historico-plan/final-fix-report.md` (o de mais peso: o link de evidência da leitura diria "Aberta pela aba Trocas do canal" e perderia a origem; ainda não aparece em produção porque a leitura guardada não traz evidência por item). A revisão final não reverteu nenhuma decisão, mas pediu que o dono veja antes de confiar: o plano executado sem aprovação prévia, a regra de `range` explícito, `tot` como lista carregada, o "Baixar" que sempre abre outra aba por causa da CSP, e o prazo "Se passar de HH:MM" que anda a cada consulta da forja. **Próximo passo:** fase A3 (lista de Canais e comparação).


**Estado.** Fase A2 (Histórico do vídeo, `video/<id>`) implementada em `staging`, local: 19 commits de `b0ff4737` a `4857c7ec` (a base é `cffa9e71`), nove tarefas do plano `2026-10-11-telas-a2-historico-plan` com revisão e rodada de conserto em cada uma. O que a A2 entregou: o gráfico abre em 30 dias por padrão; a troca da aba Trocas do canal chega selecionada (`troca=`), marcada no gráfico e na raia; trilha e pager vêm da página do canal (`canal=`, `back=`, `pos=`, `tot=`) e o Voltar leva ao canal com o foco no último vídeo visto; a moldura da tela ficou só com a trilha, em todas as origens; o visualizador de thumbnail (diálogo com zoom, troca de versão e comparação lado a lado) abre em seis gatilhos, dois deles na página do canal; o cartão novo "Leitura da forja" tem etapas (Na fila, Escrevendo, Pronta), pausa da atualização automática e os dois botões (cabeçalho e cartão), e o botão do cabeçalho rola até o cartão e pede. Ainda NÃO houve push nem promoção para `main`.

**Medido em 11/10.** Vitest inteiro do app: 1.275 arquivos passaram e 76 foram pulados (1.351 no total); 22.882 testes passaram, 635 pulados e 7 `todo` (23.524 no total); zero falhas; 199,4 s com a máquina calma, sem nenhum timeout de 20 s. Os 15 arquivos novos desta fase (`historico-a2-*`, `thumb-viewer*`, `canal-viewer`) somam 498 testes verdes e 21 s de execução; os mais lentos: forja-card 4,4 s, forja-model 4,2 s, pager 3,9 s, canal-viewer 3,4 s, os demais abaixo de 1,3 s (tempo de execução dos testes, sem a carga do módulo). Typecheck do web e da API: zero erros. `npm run build:web` (`next build` de produção): verde, 130 páginas geradas. Playwright local, projeto `observatorio` (`historico-a2.spec.ts` 32 testes, `canal.spec.ts` 40, `flutuantes.spec.ts` 39, mais 4 de login e 1 de limpeza): 116 passaram, zero falhas, 17,9 min. Validação logada em navegador (Chrome, 1440×900, tema escuro, banco local com a semente do oráculo e relógio congelado em 24/10): abertura do Histórico pelo canal, pela aba Trocas, por Mudanças e por Outliers, e por URL com `from=insights` (a tela de Insights não tem link direto para vídeo); em todas a moldura tem só a trilha, a trilha volta com o estado, console sem erro e nenhuma resposta 500. Roteiro curto repetido em 390 px no tema claro. Capturas na pasta não versionada `docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a2/`. Relatório completo em `.superpowers/sdd/2026-10-11-telas-a2-historico-plan/task-9-report.md`.

**Decisões tomadas pelo controlador (o dono pode reverter).**
- Seguir o prompt do handoff sem esperar aprovação do plano, porque o dono escolheu "Seguir tudo, sem parar" em 11/10; se errado, o plano é refeito antes de promover.
- Etapas do cartão da forja: "nova tentativa" fica em Escrevendo e "liberado pelo vigia" em Na fila, como no mockup aprovado (o spec 7.4 pedia confirmação); custo de errar: uma linha no mapa de etapas.
- `troca=` válida sem `range` na URL abre o gráfico no menor período que a inclui; com `range` explícito vale o da URL e, se a troca ficar fora dele, não há chegada (a tela abre como hoje, sem destaque). O seletor grava `range` explícito sempre, inclusive em 30 d; custo de errar: quem escolhe um período menor perde o destaque da troca antiga, que é o comportamento esperado de um filtro.
- Vídeo não encontrado vindo de um canal volta para a página do canal (com o `back=`), e vídeo sem data não entra em `ids=`; custo: nenhum.
- No Voltar, depois de restaurar a rolagem, o cartão do último vídeo visto é trazido à área visível; custo: nenhum.
- O `tot` do pager é o tamanho da lista carregada na grade (não o total que casa com o filtro), porque é a lista que a pessoa estava vendo; custo de errar: a contagem cresce depois de "Carregar mais".
- O conserto de foco da chegada que reaparece ao trocar de período (o foco de chegada acontece uma vez por vídeo aberto) foi feito dentro da Tarefa 3, e o conserto do registro do último vídeo visto dentro da Tarefa 4, em commits próprios, para poupar agentes; custo: nenhum além da ordem dos commits.
- O aceite "gráfico e raias cabem sem rolar em 1440×900" vale como no máximo 900 px (medido 823 e 831); os 760 px do plano vinham do mockup, que tem outra casca e um cabeçalho de 99 px contra 132 da produção; custo de errar: compactar o cabeçalho é tarefa própria.
- Um push só, no fim da A2, depois da revisão final, da suíte inteira, do typecheck e do `next build`; custo: o CI só vê o lote no fim.
- A política de segurança de conteúdo (CSP) NÃO foi alterada: sem `i.ytimg.com` em `connect-src`, o "Baixar" da thumbnail atual sempre abre a imagem em outra aba com o aviso para salvar por lá; custo de errar: o download direto fica indisponível até o dono decidir.
- O layout do visualizador segue o spec 6.3 (zoom e arquivo embaixo), não o mockup (tudo no alto), porque o spec é de 10/10 e posterior à rodada 4 do mockup; custo: mover a barra é CSS.
- O visualizador ganhou a imagem de pré-visualização (a que já está na tela aparece enquanto a maior carrega) e, ao fechar, o foco vai para o título da tela quando o gatilho foi desmontado.
- Vídeo antigo e vídeo sem data não carregam o conjunto do visualizador no canal (a tela monta só a versão atual na hora): com o conjunto em todos, 3.000 vídeos antigos estouravam o teto do pacote (4,81 MB contra 4,2 MB); custo: nenhum para quem usa.
- O clique simples na miniatura da raia marca o alvo na hora, mas a rolagem até o cartão da versão espera a janela do duplo clique (cerca de 250 ms) e é cancelada se vier o segundo clique, que abre o visualizador; custo: 250 ms de atraso na rolagem do clique simples, e o plano dizia "não atrase com temporizador".
- Os índices ¹ ² das evidências só aparecem quando a leitura guardada traz a evidência por item; a leitura em produção não traz, então o cartão sai sem índices e a tela não inventa link.
- Leitura publicada sem evidências no dia em que saiu: a frase "Pode pedir de novo." vira "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.", porque a do spec seria falsa (o limite do dia foi gasto e o botão fica apagado).
- "Se passar de HH:MM, a tela avisa aqui" é a última consulta da forja mais 30 minutos (hora em que ela é dada como parada), interpretação do implementador.
- O número da frase "saíram N trocas" e o da ação "Ver as N trocas" têm de ser o mesmo conjunto: a ação só aparece com a contagem de título e thumbnail dentro da janela de 30 dias da aba Trocas; trocas de descrição ou mais antigas entram na frase e a ação vira "rolar até as raias" do próprio Histórico.
- A frase duplicada "Ainda não há leitura deste vídeo" ficou uma só, tirando a oração repetida do bloco do nicho (3 literais de teste mudaram); o texto do bloco do nicho, que era protegido contra mudança, mudou.
- Com o nicho bloqueado, o botão do cabeçalho "Ver a leitura" fica (spec 6.5: com leitura pronta o botão só rola; a mensagem de bloqueio está no cartão).

**Perguntas para o dono.**
1. Liberar `i.ytimg.com` em `connect-src` da CSP? Sem isso o "Baixar" da thumbnail atual abre a imagem em outra aba e pede para salvar por lá.
2. Posição dos controles do visualizador: embaixo (como no spec 6.3, é o que está feito) ou no alto (como no mockup `viewer.js`)?
3. Uma leitura publicada sem evidências deve consumir o limite do dia? Hoje consome, e o botão fica apagado até as 00:00.
4. A conta de "Se passar de HH:MM, a tela avisa aqui" (última consulta da forja mais 30 minutos) é a que você quer?
5. Os índices ¹ ² das evidências dependem de a forja (ou do carregador) trazer a evidência por item; vale pedir isso à forja, já que hoje a leitura em produção não traz?
6. "Baixar" e "Abrir original" na comparação lado a lado agem só na imagem da esquerda: está certo, ou devem agir na imagem escolhida?
7. Frases de tela que não estão no spec e passaram: "Tela atualizada agora", "Sincronizando…", "Canal sincronizado…", "A sincronização não respondeu…", "Pronta: leitura publicada em dd/mm às HH:MM." (leitura de outro dia), "Precisa de você: os dados deste canal estão antigos demais para ler.", "Não deu: o pedido falhou [às HH:MM]. Pode pedir de novo.", "Não deu: o pedido terminou, mas a leitura não está aqui. Pode pedir de novo." e "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00." Aprovar, trocar ou cortar?
8. Compactar o cabeçalho do vídeo (132 px de altura contra 99 do mockup)? Hoje o gráfico e as raias cabem em 900 px sem isso.

**O que nenhum agente conferiu.** Opera, Safari e Firefox (só Chromium foi usado, por Playwright e à mão); leitor de tela (VoiceOver: o diálogo do visualizador, o status do pager, o status da chegada, o cartão de etapas); zoom de 200 a 400%; toque real e pinça (o toque foi só emulado e a pinça de dois dedos não foi provada); o CORS do Blob real da Vercel (o spec usa um Blob simulado, e a decisão do "Baixar" para o `i.ytimg.com` depende da pergunta 1); o build de produção rodando no navegador (a validação à mão foi feita em `next dev`; o `next build` só foi conferido até gerar as páginas); o visualizador com imagem de verdade, à vista (a semente local não tem imagens arquivadas e a rede do ambiente não carrega o `i.ytimg.com`, então à mão só se viram os estados "não arquivada" e "não carregou"; o zoom pela roda, o arrastar e o Baixar com imagem foram provados só pelos 10 testes de Playwright A2.3); nenhum pedido real à forja foi enviado (o botão "Pedir leitura à forja" não foi clicado; o cartão foi visto com uma leitura pronta e com um pedido em andamento semeados); o Fixar vídeo não foi clicado; a troca com mais de 90 dias, sem fixture de navegador (só teste unitário).

**Menores adiados da A2.**
- Tarefa 1: o vermelho dos testes de modelo não foi observado (código antes do teste); os specs de Playwright antigos que abrem o Histórico podem depender do vídeo inteiro por padrão (o `flutuantes` e o `historico-a2` passaram); em desenvolvimento, o StrictMode pode mover o foco do pager; a frase do período pode ficar nula por outro motivo além da chegada; mais três menores e o fixture de um sexto na revisão da Tarefa 1.
- Tarefa 2: o Próximo some no fim da janela de 100 ids mesmo com lista maior (o spec aceita 100); as teclas `[` e `]` não ignoram o repetir; Ctrl+clique deixa o registro de pager velho; duas restaurações de rolagem sobrepostas podem limpar pendentes uma da outra; o aviso novo de leitor de tela depois de remontar pode não ser anunciado; o caminho da trilha supõe a URL atualizada no efeito de layout; o registro do último vídeo expira em 30 min; há um comentário desatualizado no topo de `historico-a2-pager.test.tsx`.
- Tarefa 3: `coworkFor="historico"` e `coworkText('historico')` ficaram sem chamador (código morto) e a classe `.tz` também; um parâmetro de nicho vestigial em teste e uma asserção redundante do aviso de nicho; o frescor e o batimento da forja somem do Histórico fora do cartão novo.
- Tarefa 4: a troca com mais de 90 dias não tem fixture de navegador; a prova foi feita em `next dev` e não em build de produção; o nome do teste A2.5 ainda diz 760 px (a afirmação é 900); esperas fixas por tempo depois de polling; um seletor de `#hv-live` sem `:visible`; a renovação do registro sem prazo revive registro velho quando o vídeo é "não encontrado"; mais três em `task-4-review.md`.
- Tarefa 5: `onError` na imagem já exibida; `inert` para portais criados depois da montagem; "Baixar" e "Abrir original" agem só na versão da esquerda na comparação; Safari e Firefox não testados; na comparação o texto do palco ainda promete zoom; o espaço de resolução vazio dá um salto de uns 15 px quando a imagem chega; duplo clique em "Baixar" (YouTube) abre duas abas; o contorno do foco pode ser cortado; reserva de 2,9em no celular; um SVG arquivado de outra origem aberto em aba poderia executar script (o Blob é nosso); o `Referer` do CMS vai ao host da imagem.
- Tarefa 6: a legenda do visualizador no canal usa período e duração mais simples que a do Histórico; pinça com dois toques e duplo toque em tela de toque não provados; só Chromium; CORS do Blob real da Vercel não medido; no canal a versão "atual" passa a ser a última, como no Histórico; mais cinco menores da revisão (M1, M3, M4, M6, M7).
- Tarefa 7: o motivo aparece repetido na faixa da situação, sob o botão apagado e no status do cabeçalho; "excluído" só exercita "fora dos acompanhados" no teste de palavras; publicado com leitura ligada nunca vira "desatualizada" (já era assim); o N de "Ver as N trocas" é um subconjunto do que a aba lista; os menores 1, 4, 5, 6, 7, 8 e 10 da revisão (6 e 8 são do carregador `load.ts`).
- Tarefa 8: com o nicho nulo uma leitura guardada de antes não aparece no cartão; sem teste do `useTransition` pendente nem Playwright com aceite semeado; mais treze menores da revisão em `task-8-review.md`.
- Achados desta validação (Tarefa 9, nenhum bloqueia o push): a miniatura sem imagem arquivada, quando pequena (Antes e depois, 1440 px), tem o texto "A imagem desta versão não foi arquivada." coberto pelo botão da lupa; em 390 px o mesmo texto aparece em corpo grande na miniatura do cabeçalho; em 390 px o selo "forja · Gemma 12B…" quebra com o ícone sozinho numa linha e o ⓘ cai para a linha de baixo, e a legenda do gráfico ocupa cerca de 1.000 px de altura; o cartão do vídeo na grade do canal diz "5 trocas" enquanto o Histórico diz "6 de 6 trocas" (a descrição não conta na grade); a tela de Insights não tem link direto para vídeo, então a origem `from=insights` só existe por URL; a contagem de testes do `historico-a2.spec.ts` é 32, não 37 como dizia o ledger.

**Próximo passo.** Controlador: revisão final em Opus do lote inteiro, conferir esta seção, push para `staging`, CI verde, depois promoção para `main`. Em seguida, A3 e A4, e então o A/B Lab (seção 3f, item 4).

## 3i. Onde retomar (escrito em 12/10: A3 em staging, local, sem push)

**Estado.** Fase A3 (lista de Canais e comparação entre dois canais) implementada em `staging`, local: 42 commits desde `98186e04` (base do lote), 43 à frente de `origin/staging` (`e14cfd2e`, a A2 em produção). Plano `2026-10-11-telas-a3-canais-comparacao-plan`, tarefas 1 a 11 com revisão e rodada de conserto, mais as extras 11b, 11c e 11d pedidas pelo dono (abaixo) e esta Tarefa 13. **A Tarefa 12 (corte do painel lateral de concorrente, D20) ficou de fora do lote e está PENDENTE**; nenhum aceite depende dela. Nada foi empurrado. O que a A3 entregou: filtro Longos | Shorts | Todos na URL; posição por inscritos e por views/dia no nicho ou no geral; bloco "Seus canais", canal próprio na posição dele e linha presa no pé; lista única (sem grupos por nicho); "Comparar" na linha e no cartão, "Comparar com o meu canal" no cabeçalho do concorrente e o atalho "Meu canal" nas molduras; a tela `comparar?a=&b=` (seletores, inverter, Leitura rápida, 13 linhas número a número, régua do nicho, cinco mais vistos, publicação em 90 dias, cartão da forja "ainda não disponível"); a escolha do "meu canal" para N canais próprios (cookie `obs-meu-canal`); a regra nova de pedido à forja (11d).

**Medido em 12/10 (tudo depois do último commit de código, `03e3d627`).** Vitest inteiro do app: 1.306 arquivos passaram e 76 pulados (1.382); 23.652 testes passaram, 635 pulados e 7 `todo`; zero falhas; 243 s. `tsc --noEmit` do web e da API: limpos. `npm run build:web`: verde. Playwright, projeto `observatorio`, banco local, uma rodada por arquivo: `canais-a3` 48 passaram + 1 `fixme` (320 px, anterior à fase); `comparar-a3` 55 + 1 `fixme`; `canal` 45; `historico-a2` 42; `flutuantes` 48; `validacao-a3` (roteiro do passo 3, abaixo) 15; `nichos` 53 passaram e 32 pulados (os 8 estados de `nichos-canais`, ver "Achados"), zero falhas. Arquivos novos do Vitest: o mais lento é `canais-a3-posicao.test.ts` com 27,4 s na suíte inteira (19 s sozinho; o teste mais lento dele leva 8,1 s); nenhum outro passa de 10 s.

**Validação logada no CMS local (Tarefa 13, passo 3).** `docs/ops/runbook-cms-e2e-local.md` (login real do staff semeado, Supabase e API locais), 1440 px, tema escuro, mais o roteiro curto a 390 px escuro, 1440 px claro e 390 px claro. Feita por um spec de Playwright que percorre o roteiro como o dono (`e2e/tests/cms/observatorio/validacao-a3.spec.ts`), com console sem erro, nenhuma resposta 5xx e nenhuma server action escapando (todo POST é abortado); 43 capturas em `docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a3/` (não commitadas, como as outras `shots/`) e o diário em `.superpowers/sdd/2026-10-11-telas-a3-canais-comparacao-plan/task-13-diario-validacao.txt`. Conferido item a item: **A3.1** os três formatos × as seis ordenações × as duas direções × as duas escalas (42 combinações, a frase do bloco de cada uma; fora de Inscritos e Views/dia o bloco diz "Esta ordenação não mostra posição" e nunca um ordinal), cartões nos três formatos, um nicho (IA) e "Todos" ("no geral"), busca (com e sem resultado), "só com problema"; **A3.2** o bloco "Seus canais" com os dois canais, o canal próprio na posição, a linha presa (a sonda de rolagem do roteiro não a pegou visível; a prova dela é o `canais-a3` A3.2, verde); **A3.3** "Comparar" na linha (1440) e no cartão (390), "Comparar com o meu canal" no cabeçalho do concorrente, o atalho "Meu canal" presente e abrindo o menu nas quatro abas (Canais, Mudanças, Outliers, Insights), na página do canal, na comparação e no Histórico do vídeo; **A3.5 a A3.7** meu canal × concorrente do mesmo nicho, × outro nicho, concorrente × concorrente (lado A areia), os dois canais próprios, meu canal × canal sem nicho ("Dois canais, lado a lado…" sem a palavra Viagem) e × o canal próprio sem vídeos (nenhum preset do seed o dá: os vídeos dele saem do banco local no teste e o seed é refeito no fim), inverter, trocar os dois seletores, `a`/`b` lixo e ausentes; **o que não mudou** adicionar canal (abre e fecha, sem enviar), menu ⋯ da linha (5 itens), editor de nicho, painel lateral do canal próprio, página do concorrente, Histórico. 390 px e tema claro: sem rolagem horizontal em Canais (tabela e cartões) nem na comparação; capturas conferidas por olho (lista a 1440 claro e a 390 escuro, comparação a 1440).

**Respostas do dono de 11/10 (noite) e o que cada uma virou.** 1 "Baixar" não é obrigatório, CSP não muda: nada. 2 "O mockup vence o spec: controles do visualizador onde o mockup mostra": Tarefa 11b (B1, controles no topo, barra única). 3 "Se for por vídeo, conta; o limite é por NICHO": reperguntado, e a resposta seguinte ("não precisamos restringir tanto… a menos que o resultado não seja diferente") virou a 11d: sai o limite diário, pedido novo só com dado novo. 4 "Se passar de HH:MM" serve: nada. 5 "Baixar/Abrir original: um por imagem no comparar": 11b (B2, par de botões por imagem; Baixar de imagem do YouTube abre o original em nova aba, só Blob baixa direto). 6 cabeçalho de 132 px fica. 7 coluna Trocas da lista deixa de contar descrição: 11b (B3, título e thumbnail; 9c8c8571). 8 rolagem horizontal da tabela fica, 9 aperto fica, 11 "não medido" fica: nada. 10 e 12 (faixa a 390 px, frases novas) e 16 ("os dois canais atuais estão parados; virão 2 ou mais novos: a escolha do meu canal tem de servir para N"): o dono delegou ao `/frontend-design`, que entregou `design-decisoes.md` (D-A, D-B, D-C), aplicado na 11c (abas e trilha a 390 px, dez frases, `escolherPrincipal` e o cookie `obs-meu-canal`; substitui a D16 do plano). 13 a 15 e 17 a 22 aceitos. Depois da 11c e da 11d a revisão devolveu importantes que entraram na Tarefa 13 (commits `42034fa5` e `03e3d627`, abaixo).

**Decisões do plano (D1 a D20) que o dono pode reverter.** Destaques: **D2** lista única sem grupo por nicho em qualquer filtro (custo: quem usava o agrupamento perde a separação visual; voltar é reintroduzir `groups`); **D3** posição escrita só em Inscritos e Views/dia (nas outras ordenações o bloco diz que não há posição; ampliar é uma chave em `POSICIONADAS`); **D4** frases novas que o spec não traz (abaixo); **D6** "Todos" leva o rótulo para o cabeçalho da coluna (longos em cima, Shorts embaixo); nos cartões o rótulo fica na célula; **D7** vídeo com `is_short` nulo continua contado como longo, com o aviso "formato não confirmado (N)" na linha (custo: longos levemente contaminados até a coleta confirmar); **D12** a relação sempre nomeia o maior, a coluna é "Relação", abaixo de 2× vale "+N%" e a forma "8,7% dos inscritos de…" não é feita. As demais: D1 colunas de produção + posição + "Com o meu canal"; D5 `fmt` sempre na URL (um lampejo de Longos para quem lembra outro formato); D8 formato do canal próprio ainda deduzido (a A4 troca); D9 "longos em 90 dias" em 90 dias corridos; D10 "longos acompanhados", "acima de 2×" só de longos, "Trocas" título e thumbnail; D11 conjunto da posição (nicho ou geral); D13 uma só dica "Como ler esta tabela"; D14 a comparação lê o conjunto do site e calcula o par no navegador; D15 leitura leve para o menu na página do canal; D16 substituída pela escolha do dono em cookie; D17 "Só o seu canal mede" não é desenhado; D18 o Voltar devolve o foco ao gatilho; D19 os cinco mais vistos abrem o Histórico; D20 a Tarefa 12 é a única que pode ser pulada (foi). Decisões do controlador durante o lote, com o custo de errar: lista de Canais com tabela que rola por dentro abaixo de ~1428 px de janela (a meta de 1.200 px não é alcançável sem tirar colunas, o que contraria a resposta 6); mínimo de 3 canais para desenhar a régua do nicho (`MIN_REGUA`, o spec não dá mínimo); cores dos lados no tema claro (`--lado-o #B8481A`, `--lado-b #0B6BA8`, `--lado-n #7A5C14`, contraste calculado) a confirmar; "praticamente igual" simétrico (maior÷menor < 1,1); a relação some quando os dois lados escrevem o mesmo texto; `buildPar(x, x)` lança (nenhuma URL chega lá); o cartão da forja da comparação diz o motivo verdadeiro (a forja ainda não escreve leitura de comparação entre canais), afastando-se do spec 18.8, escrito antes da coleta entrar em produção; Histórico ganhou a origem `comparar` (trilha "Comparar canais › canal › Histórico do vídeo").

**Onde as decisões de design (11c) contrariam o mockup aprovado.** Quatro pontos: (1) a 390 px o atalho "Meu canal" sai do grupo de ações e vai para o menu ⋯ (o mockup o mantém no grupo; a spec 15.2 só pede que ele exista); (2) na trilha de canal e comparação a 390 px o atalho é só o ícone, 34×26 (44 com toque); (3) no Histórico e em toda trilha acima de 480 px o atalho é um glifo com o nome truncado em 14 caracteres (o mockup escreve "Meu canal: nome"); (4) o menu "Meu canal" marca o canal em uso com ✓ e traz a dica "Comparar com o meu canal usa o canal com ✓". Aceitos porque o dono delegou; reverter é CSS e um componente.

**Regra nova de pedido à forja (11d) e a rodada de conserto.** Sem limite por dia; pedido novo só quando há registro diário mais novo que o da última leitura concluída do mesmo alvo ((tipo, nicho), ou (tipo, nicho, vídeo) em leitura de vídeo), ou quando o "Desde então" da própria leitura tem o que dizer (troca nova, vídeo novo); leitura vazia com dado igual não repete; vídeo A não bloqueia vídeo B do nicho; falha e recusa não contam como leitura; pedido ativo bloqueia (o índice único do banco é por nicho: um vídeo em andamento ainda bloqueia os outros do nicho). Um ponto de decisão só (`forja/novidade.ts`, `obs.forja.novidade` e `planAsk` com `obs.forja.planOpts`), usado pelo servidor, pelas abas e pelo Histórico. A revisão reprovou a conformidade em um ponto e achou quatro defeitos de teste e de conta; a Tarefa 13 fechou os cinco importantes em `03e3d627`: o painel lateral de Canais usava uma regra própria (só apagava com pedido do dia) e agora usa a mesma função; para vídeo, o "dado atual" usa a conta do congelamento do envio (`videoFreezeIdx`, o mínimo entre o último registro do site e o último ponto do próprio vídeo), e o "Desde então" do vídeo também (vídeo parado ou sem ponto não fica "dado novo" para sempre); a janela de 30 dias de `sinceChanges` sai do último registro, como o envio, e não do relógio (leitura recém-feita não nasce "mudou"); novo `forja-novidade-sent.test.ts` com leituras montadas por `buildSent` para os cinco tipos (leitura recém-feita bloqueia, registro novo libera, painel e servidor dizem o mesmo); o teste [F8] compose do mockup voltou a rodar (só o fragmento `c.quota.usedToday === 2` sai, `ADAPTED_ASSERTIONS`). **Trechos de spec e runbook desatualizados (não reescritos):** `2026-10-02-observatorio-competidores-design.md` linhas 92 (D10 "cota por nicho + tipo/dia") e 110; `2026-10-07-observatorio-canal-video-ui-design.md` linhas 199 (A2.8 "cota do dia"), 475, 527 ("Libera amanhã às 00:00") e 550 ("Limite por canal em `lib/forja/quota.ts`", arquivo que não existe mais); mockups e planos antigos e o `dados.cjs`/`dados-teste.html` ainda falam da cota (ficam como oráculo, com as divergências nos testes). **Semeadura em produção:** o pre-commit do commit `bec37e5d` rodou `seed-pipeline-reference` contra PRODUÇÃO (hook padrão do repo, `.env.local` aponta para `novkqt…`): duas linhas da cota em `cowork-docs-youtube.md` foram ao banco ANTES de o código novo ser promovido (o Cowork leu a regra nova por alguns dias antes de ela valer em produção). Não revertido (seria outra escrita em produção). Menor da doc, deferido: a linha 875 diz "quando o dado mudou desde a última leitura publicada" e a 381 "a recusa não impede um novo pedido", mas o código também reabre pelo "Desde então" e uma falha ou recusa COM leitura em dia continua bloqueada pelo dado; corrigir é mexer em `data/pipeline-docs/` (o pre-commit semeia em produção), então fica para o commit que for semear de propósito.

**Frases de tela que não estão no spec.** D4: "14º de 14 em Viagem, em inscritos, com 1,16 mil." e "40º de 75 no geral…" (vírgula entre o conjunto e o número); "Sem posição escrita nesta ordenação…" (hoje "Esta ordenação não mostra posição. Ordene por Inscritos ou por Views/dia para ver a do seu canal."); "Dois canais de nichos diferentes, lado a lado, com o mesmo peso. A régua e as posições comparam com todos os canais do site."; "Para comparar é preciso ter dois canais."; no cartão da forja: selo "ainda não disponível" e o motivo verdadeiro (ver acima). As que surgiram: as 7 do implementador da Tarefa 2 (`task-2-report.md`); "poucos canais para comparar em X (2; precisa de 3)" (régua); "Meus canais" quando todos os próprios estão sem vídeos; "último vídeo hoje" e "há N dias/semanas/meses/anos" nas notas do menu; as dez frases da 11c; as da 11b e 11d (`task-11b-report.md`, `task-11d-report.md`: "A leitura de IA / deste vídeo / de cada nicho já usa o dado mais recente. Dá para pedir de novo quando houver coleta nova.", "Não dá para saber com que dados a leitura anterior foi escrita; pode pedir de novo.", "nenhuma de título ou thumbnail em 30 d", "Não dá para baixar: sem imagem nesta versão.").

**Pontos da seção 20 do spec que nascem na A3 e como ficaram.** 1 ("Todos" pesado): rótulo no cabeçalho da coluna, células de duas linhas; nos cartões o rótulo continua na célula; confirmar com olho do dono. 2 ("escala √"): saiu; fica uma dica "Como ler esta tabela". 3 (coluna Ritmo): a lista mantém as colunas de produção (D1), com o gráfico de ritmo em 100 px. 4 (um ⓘ por linha): **não resolvido na lista** (`cells.tsx` ainda tem a dica dos inscritos por linha; as paradas de Tab de uma lista de 75 não foram contadas); só a comparação trocou os ⓘ por linha por um da tabela (D13). 5 (comparação densa): no máximo três itens por linha na Leitura rápida; a tela mede 215 px do topo até "Número a número" a 1440 e 507 a 390. 6 ("não medido" do canal próprio): continua; views por dia, views por dia por mil e inscritos em 30 dias do canal próprio dizem o motivo e esperam a A4 (a Leitura rápida do canal próprio sempre fecha com "Sem como comparar ainda: N números"). 7 (concorrente × concorrente magro): visto só na semente de 16 canais, todos com vídeos; **não conferido com dados reais de produção**. 11 (empate na régua com lado destacado): os dois lados são separados em ±2,5 px e o texto diz empate.

**Perguntas ainda abertas ao dono.**
1. A coluna Trocas da lista conta título e thumbnail (resposta 7), mas o painel lateral do canal (aba Trocas, "Ver as N trocas em Mudanças") ainda conta descrição: lista 6 × painel 7. O painel conta descrição também?
2. Quando uma leitura veio vazia e o dado é igual, repetir o pedido? Hoje não repete (a regra "dado igual não repete"); a leitura vazia com dado igual fica bloqueada.
3. O limite de pedidos é por NICHO no banco (índice único de ativo por site, tipo e nicho): enquanto uma leitura de vídeo de IA anda, nenhum outro vídeo de IA pode ser pedido. Afrouxar exige migration.
4. Em 1280 px a tabela de Canais rola por dentro do invólucro (cabe a partir de ~1428 px de janela): tirar colunas, ou aceitar?
5. A frase da lista de Canais para o canal próprio sem views por dia ("Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve…", do spec 15.2) diz "começa em breve", enquanto a coleta diária já roda desde 09/10 e a comparação diz o motivo verdadeiro (a tela ainda não a lê, chega com a página do canal próprio). Trocar a frase da lista pela da comparação?
6. Cores dos lados da comparação no tema claro e o mínimo de 3 canais da régua: confirmar.
7. Quando "trocar só o concorrente" na comparação com um canal próprio ativo, o canal próprio vira o "meu canal" lembrado por um ano (cookie): é isso mesmo?

**O que nenhum agente conferiu.** Opera (o dono usa), Safari e Firefox: só Chromium; leitor de tela na tabela da comparação (a tabela vira `grid` com a letra do lado em cada valor abaixo de 820 px) e na régua (`role="group"`, não `img`); zoom de 200 a 400%; toque real e pinça (o toque é emulado, e na régua o foco por toque não foi provado); dados reais de produção em concorrente × concorrente e em canal próprio com N canais; o anúncio por leitor de tela do aviso do visualizador; a largura das células "nenhuma de título ou thumbnail em 30 d" e do rótulo longo no cartão em produção; `forced-colors`.

**Achados da validação (Tarefa 13).** `nichos.spec.ts` (Playwright, comparação de texto com os mockups de 02 e 04/10) tinha 64 falhas e 21 passes; causas, uma por linha: (a) 28 falhas: o atalho "Meu canal: tnFigueiredo" da moldura (A3.3) é texto novo que o mockup não tem (20 em `nichos-moldura`, 8 em `nichos-moldura-insights`); (b) 32 falhas em `nichos-canais`: a lista deixou de ser a do mockup de propósito, D2 (sem grupo por nicho: somem o cabeçalho de cada nicho, a contagem e a ordem por grupo), A3.2 (bloco "Seus canais", posição e "seu canal" nas linhas), A3.10 (coluna "Com o meu canal" e o botão "Comparar"), 11b (Trocas: "nenhuma de título ou thumbnail em 30 d"), A3.1 (controle Todos | Longos | Shorts) e a frase de ordenação; (c) 4 falhas no teste de comportamento do nicho criado (Jogos), que procurava o ponto do nicho no cabeçalho do grupo (`tr.group .dot.custom`), que a D2 removeu. Resolução: (a) o atalho entra como exclusão com a decisão no cabeçalho do spec e o alvo "Comparar" (24 px) fica fora da auditoria de 32 px; (b) os 8 estados de `nichos-canais` (32 testes) viraram `skip` com o motivo (equivale a `fixme`; o arquivo não foi apagado; a lista tem proteção em `canais-a3`, `canal` e `flutuantes`; reativar pede refazer o mockup de Canais com nichos criados); (c) a asserção passou a olhar o seletor de nicho da própria linha. Nenhuma falha veio de defeito de produto; a única diferença que pode ser anterior à A3 é a frase "Ordenado por Views/dia por mil inscritos" contra "Ordenado por Ritmo" do mockup, porque a ordenação padrão virou Views/dia em `cf67bf63` (04/10, antes da A2); **não rodei `e14cfd2e`** para provar se o arquivo passava na A2 (exigiria outra árvore e outro servidor sem `stash`/`worktree`). Outros achados: na lista a 1440 px escuro, o grupo de ações do cabeçalho "Sincronizar tudo / Abrir no Cowork" da casca do CMS fica cinza no tema claro (anterior à fase); o título "Comparar canais" mostra o anel de foco laranja ao abrir (o `h1:focus:not(:focus-visible)` da seção D-A.5, fora da fase); a linha presa não foi pega visível pela sonda do roteiro (a prova é o `canais-a3`).

**Menores adiados (todas as tarefas; detalhe nas revisões `task-N-review.md`).**
- T1: nota de Shorts imprecisa nas sentinelas -1; aria-live duplicado; dica diz "pelo YouTube"; `data-k` duplicado; teste de nota compara com a própria fonte; teste "sem zero" não afirma zero; varredura O(linhas × vídeos); links do chrome sem `fmt`; links antigos `fmt=short|long` funcionam mas não são reescritos; duas frases para a mesma ausência (Shorts e Todos).
- T2: payload RSC pode dobrar enquanto `rows`, `groups` e `list` coexistem (a T3 cortou); Ritmo e Outliers dão 0 a canal sem vídeos; motivo `sem-videos` falso como reserva; "fora das posições de Shorts" em ordenação sem posição; linha presa e bloco dependem do filtro de nicho; asserções vazias; falta teste de que canal sem nicho nunca é vizinho.
- T3: ressalva em nowrap alarga a coluna Views/dia; `aria-label` da linha fina por fatiamento de string; foco ao fechar o painel com a linha escondida pela busca; lacunas de teste (unmount, reduced motion); frase de vizinhos segue a ordem da tela em ordem crescente; M2, M3, M4, M5, M7, M8 e M10 da revisão; `fraseSeuCanal` usa `semMedida ?? 'ordenacao-sem-posicao'`, que pode inventar o motivo.
- T4: 6 linhas na dobra em Longos (o spec não dá meta); cobertura do gatilho encostado no pé perdida com a folga de 112 px; último teste do spec re-semeia duas vezes; faixa de frescor em duas linhas a 390 px sem captura aprovada e 321 a 389 px sem prova; `test.fixme` de 320 px sem ID de backlog (a página rola por causa do cabeçalho "Abrir no Cowork" e do menu ⋯ da casca, 349 > 320); o teste da tabela não mede fonte nem altura do cabeçalho; `chrome.spec.ts` tem 8 falhas de fidelidade anteriores (aposentado).
- T5/T6: canal só com vídeos sem data mostra "Longos publicados em 90 dias: 0" (pode ser falso; modelo da T5) e `ritmo` em canal só com vídeos sem data (fechado na 11c); negativo ou não finito vira "sem relação" calado; `Relacao` não capitaliza; o `vpdText` muda posição/empate na lista só abaixo de 10 views/dia e nenhum teste afirma; teto cru de 800 KB é medido × 1,25. Para o dono notar: com dois canais do dono o B sai azul; entre dois concorrentes "Inverter" não troca as cores.
- T7: re-render e leitura de layout a cada `pointermove` (M6); testes de unmount/disconnect e de empate no aria (M7); leitor de tela com `role=group`, `forced-colors`; clique com o grupo já focado não leva o teclado ao traço clicado (Q2).
- T8: 15 menores (`task-8-review.md`); a regra do conjunto de canais está escrita duas vezes (régua e `par-model`); se alguma métrica real puder ser negativa, `medido()` a trata como "não pôde ser calculado".
- T9: `Top5Item.href` morto no pacote; ids fixos duplicáveis; CSS duplicado do cartão da A2; 44 px só em coarse; eixo desalinhado dos traços; `onError` pós-SSR; top 5 e publicação discordam do formato nulo; teste de navegador do Voltar a renomear.
- T10: nome acessível não nomeia o canal próprio quando há dois; respiro de 8 px entre colunas; "100º" alarga a coluna; gráfico de ritmo a 100 px mais fino; `aria-current` morto até a A4; `p` dentro de `role="menu"`; prefetch dos 75 links; teste de "paralelo" fraco; a quebra a ≤560 px afeta as quatro abas e a trilha. Para pagar a coluna "Comparar" (68 px): respiro lateral 6→4 px, gráfico de ritmo 130→100 px, coluna de posição 40→32 px (pede olhar do dono).
- T11 (`task-11-review.md`): 7 menores. T11b: coluna Trocas sem ⓘ; cartões "Trocas, 30 d" sem a unidade nova; barra do visualizador em 3 linhas a 390 px (imagem 439 px em 390×844; janelas baixas não medidas); 2º clique durante o download ignorado em silêncio; `openTab` sem `noopener`.
- T11c: M-1 paridade motor × leitura leve para canal só com vídeos sem data; M-3 data futura (estreia agendada) vence a recência e a nota diz "último vídeo hoje"; M-4 `haTempo` não vira "1 ano" até 365 dias; M-5 título do teste I-A/I-C promete mais do que prova; M-6 lembrança de canal sem data sem teste; M-7 títulos de teste ainda citam "(D16)"; M-8 trocar só o concorrente fixa o canal próprio em cookie (pergunta 7 acima).
- T11d: M-1 sem pedido na janela do dia o botão do cabeçalho fica apagado só com `title` (sem nota visível, e em toque o motivo não aparece); M-2 `lastReading` ignora `fmt` (leitura "long" bloqueia o pedido "short" do mesmo tipo e nicho, se a tela mandar `fmt`); M-3 doc do pipeline (acima); M-4 `forja-parity` corta todo o roteiro para a base `publicado`; M-6 o 2º acionamento do mesmo botão apagado do visualizador não é reanunciado; M-7 `semNovidade` do cartão deduz "dado igual" do modo do botão apagado (outros motivos caem na frase). M-5 (`void scopeTodos`) foi fechado na Tarefa 13.
- Tarefa 13: o roteiro da validação (`validacao-a3.spec.ts`) não prova a linha presa nem o texto da Leitura rápida (o seletor dela voltou vazio); quem quiser reusar a ferramenta deve afinar esses dois.

**O que a A4 herda.** `ownChannelHref` (hoje devolve o painel lateral, `link.canais({ channel })`; a A4 troca uma linha quando o canal próprio ganhar página); o cartão "Só o seu canal mede" (D17, não desenhado: depende do leitor da A4); o destino dos cinco mais vistos do canal próprio (D19: abre como abre hoje até a A4); `is_short` da coleta (D8: o formato do canal próprio continua deduzido por duração e "#Shorts" até a A4 ler `yt_own_video_meta_daily.is_short`); views por dia, views por dia por mil e inscritos em 30 dias do canal próprio (leitores de `yt_own_*`, A4.1, e a contagem diária de inscritos, que exige tabela nova); o corte do painel lateral de concorrente se a Tarefa 12 continuar pulada (a A4 corta o painel inteiro quando o canal próprio ganhar página, D20); `aria-current` do menu "Meu canal" (morto até a A4); a pergunta 5 acima (frase "começa em breve").

**Próximo passo.** Controlador: revisão final em Opus do lote (a conformidade da 11d e os importantes da 11c foram fechados em `42034fa5` e `03e3d627`), conferir esta seção, push para `staging`, CI verde, depois promoção para `main`. Em seguida a A4 (plano `2026-10-12-telas-a4-canal-proprio-plan.md`).

## 4. Ordem recomendada do trabalho

| # | Etapa | Spec | Depende de |
|---|---|---|---|
| 1 | Fechar o L1a (Task 17) | coleta | 72 h de produção |
| 2 | **L1b:** estado de autorização do canal, `videos.list` (`is_short`, `privacy_status`), chave estrangeira com tratamento de órfãos — **feito em 08/10** (plano `2026-10-08-coleta-l1b-plan.md`) | coleta §0, §6 | — |
| 3 | **L2:** normalização do alcance e diário real por vídeo | coleta §5, §6 | cabeçalho real do CSV |
| 4 | **A/B Lab honesto, parte 1:** fim do teste de descrição, restauração segura, fim dos números inventados; **desligar o detector de fadiga e o aviso de "vídeo em alta"** (§5) | A/B Lab | uma rodada de revisão no spec (o dono pediu; nota atual 70/100) |
| 5 | **Telas, fase A:** página do canal (Capas, 5 por linha, "Carregar mais") e histórico do vídeo com a chegada pela troca e o visualizador de thumbnail | telas + mockup | mockup aprovado (§6) |
| 6 | **L3:** retenção e percentual assistido | coleta §6 | L2 |
| 7 | **"Candidatos a teste"** no A/B Lab (substitui o alerta de fadiga) | fadiga §9 | L2 e dados reais |
| 8 | **L4:** pacotes da forja; leitura por canal (servidor) | coleta §8, telas §7.3 | L2 |
| 9 | Telas de retenção e do A/B; canal próprio no histórico | telas §8, §9 | L3, etapa 4 |
| 10 | L5 | coleta | — |

Cada etapa: plano próprio (superpowers:writing-plans), execução por subagente por tarefa,
revisão final, suíte inteira, um push.

## 5. Fadiga e "vídeo em alta": decisão tomada, execução pendente

Achado de 08/10 (verificado em produção): `youtube_video_analytics.views` é o total da janela de 90
dias regravado a cada dia, não a contagem do dia. O detector de fadiga e o `detectViral` leem esse
número como diário. Os 10 avisos `youtube.trending_viral` já enviados são suspeitos. O volume real
é de cerca de 35 views em 90 dias no site inteiro.

O dono delegou a decisão ("como você recomendar"). Decidido:

- O aviso de fadiga no sininho foi retirado (`1613cb6f`).
- **A fazer na etapa 4:** remover a fase de fadiga do cron e o envio de `trending_viral`; esconder o
  cartão de fadiga do A/B Lab; ajustar os testes do cron e as rotas/ferramentas do pipeline que
  listam alertas de fadiga (`api/pipeline/youtube/ab-tests/fatigue-alerts`,
  `api/pipeline/youtube/thumbnails/fatigue`, registry e docs do Cowork, regra de Pipeline Integrity).
- **Etapa 7:** tabela "Candidatos a teste", sem sininho e sem a palavra "alerta": impressões, CTR
  com intervalo de Wilson, mediana do canal, ordenada por cliques perdidos estimados; pouco volume
  aparece como "poucos dados".
- O detector de queda de CTR fica adiado até algum vídeo passar de ~20 000 impressões em 28 dias.
  A proposta e a revisão que a reprovou (45/100) estão em `2026-10-08-fadiga-deteccao-design.md`.

## 6. Mockup: decisões fechadas pelo dono

Pasta `docs/superpowers/mockups/2026-10-07-pagina-canal/` (LEIAME com as quatro rodadas).
Servir com `python3 -m http.server 8791 --bind 127.0.0.1` dentro da pasta.

- Página do canal: vista padrão **Capas**, **5 por linha** em 1440 px; cabeçalho com os quatro
  números atuais; abre com os 50 acompanhados e **"Carregar mais"** por botão, centralizado, de 40
  em 40 (sem carregamento automático); os antigos entram na grade com aviso.
- Aba Trocas: **aprovada.** Um cartão e um botão por vídeo; "Abrir nesta troca" por troca.
- O destino da troca é o **Histórico do vídeo que já existe em produção**; nada dele se perde. Só
  entram a chegada com a troca destacada, a leitura da forja e o visualizador.
- Visualizador de thumbnail: **aprovado.** Na raia do gráfico, clique duplo amplia (o clique
  simples segue indo ao cartão da versão).
- Gráfico em **30 dias** por padrão; a faixa "antes de 03/10, sem registro" fica.
- Thumbnails continuam na seção de versões.
- O cartão novo da forja substitui o texto fixo da tela atual; o botão do cabeçalho rola até ele.
- Leitura sem efeito medido: abre com o que fazer ("espere 7 dias") e pode citar o desempenho
  anterior à troca, sem afirmar causa.
- Bordas que reprovam contraste: pendência separada, do CMS inteiro.

Ainda não feito no mockup: canal próprio (retenção, percentual assistido); telas do A/B; teclado e
leitor de tela exercitados de verdade; "0 views/dia" com uma casa decimal.

Antes de implementar a etapa 5: passar estas decisões para o spec de telas
(`2026-10-07-observatorio-canal-video-ui-design.md`, que ainda descreve uma página de vídeo nova
nas seções 6 e 12) e pedir o "pode" do dono sobre o spec atualizado.

## 7. Pendências do dono

- Ler as Developer Policies do YouTube na íntegra antes de qualquer decisão de produto.
- Pedir uma leitura real à forja (nunca foi usada em produção).
- Deriva do `database.types.ts` em relação a migrations recentes.

## 8. Frente futura, grande, ainda sem plano: TikTok (anotado em 08/10 a pedido do dono)

O dono quer algo parecido com o Observatório para o TikTok: ver o que estoura numa plataforma e na
outra, analytics, capas. E ligar contas do TikTok a canais do YouTube do mesmo criador (um criador
pode ter duas contas de TikTok, ou mais de um canal). **Não planejar agora.** Mockup da página do
canal: "aprovado por enquanto" (08/10).

O que pensar quando chegar a hora:
- **Decisão do dono (08/10): sem entidade "criador" por enquanto.** YouTube e TikTok ficam
  separados; nada de chave comum nas tabelas novas. Ligar contas do mesmo criador é assunto para
  quando a frente do TikTok for aberta.
- **De onde vem o dado é a pergunta que decide tudo, e precisa de pesquisa** (o que segue é de
  memória, NÃO verificado): para contas próprias existe API oficial com autorização do dono da
  conta (vídeos, capa, views, curtidas, comentários, compartilhamentos); para contas de terceiros a
  API de pesquisa é restrita a academia e não serve a uso comercial, e raspagem fere os termos.
  Se isso se confirmar, "concorrentes no TikTok" pode não ter caminho dentro das regras, e o escopo
  honesto vira "minhas contas no TikTok + concorrentes só no YouTube".
- O que não tem equivalente: no TikTok não há título nem thumbnail escolhida como no YouTube (há
  legenda e capa), nem impressões/CTR de capa. A comparação entre plataformas é de tema e formato,
  não de embalagem.
- Mesma regra da ambição ViewStats: só dentro da política de cada plataforma.

## 9. Fora deste trabalho

Chat (Open WebUI), produto multi-cliente, auditoria da API do YouTube, comparação com ViewStats e
vidIQ, alvo de toque no histórico em 768 px, suíte de fidelidade antiga, Fase 5 do plano mestre,
menores do convite/newsletter, e-mail duplo do ab-escalation, teto de 13 avisos por dia.
