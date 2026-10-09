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
