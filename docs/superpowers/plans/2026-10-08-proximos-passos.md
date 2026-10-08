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

## 2. O que está em `staging`, sem promoção

| Commit | O que é | Precisa de |
|---|---|---|
| `a3b1b153` | migration `20261008000001`: colunas do alerta de fadiga aceitam views | aplicada em produção pelo dono em 08/10 |
| `08491bd8` | thumbnail arquivada em 1280×720 (cai para 640×480, depois 480×360); identidade segue pela `hqdefault` | promoção; vale só para arquivamentos futuros |
| `3a2c9784`, `0db29355`, `b59ec6b9` | specs, plano do L1a, mockup do canal e do histórico | nada |
| `80ceed03` + `e89e4e46` + `1613cb6f` | aviso de fadiga no sininho, feito e desfeito no mesmo dia (ver §5) | nada |

Promoção para `main`: pedir autorização explícita ao dono na hora.

## 3. Pendências com data

1. **09/10 (T+24 h):** rodar os SELECTs do Step 2 da Task 17 do plano
   `2026-10-07-coleta-l1a-plan.md`. Zero relatórios em 24 h não é falha (o Google leva até 48 h).
2. **11/10 (T+72 h):** aceite 8 (Step 3 da Task 17). Depois: fechar o runbook (Step 4), revisão de
   totalidade (Step 5, tabela de 35 requisitos) e as 10 perguntas do Step 6.
3. **Quando o primeiro CSV de alcance chegar:** anotar o cabeçalho real, a unidade do CTR, se há
   coluna de cliques, se o relatório combinado abre por origem de tráfego, e se dias ou vídeos de
   baixo volume somem do arquivo. Conferir 3 vídeos contra o YouTube Studio. Isso decide o L2.
4. **A conferir na revisão de totalidade:** vieram 10 tentativas `sondagem` e 10 `relatorio` com
   `ok` na primeira execução; o plano esperava uma sondagem por canal. Ler o código antes de afirmar.
5. Ao fechar o L1a: listar ao dono os "Rulings" do ledger
   (`.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`) e só então apagar a pasta.

## 4. Ordem recomendada do trabalho

| # | Etapa | Spec | Depende de |
|---|---|---|---|
| 1 | Fechar o L1a (Task 17) | coleta | 72 h de produção |
| 2 | **L1b:** estado de autorização do canal, `videos.list` (`is_short`, `privacy_status`), chave estrangeira com tratamento de órfãos | coleta §0, §6 | etapa 1 |
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

- Autorizar a promoção do que está em `staging` quando quiser a thumbnail em alta resolução.
- Ler as Developer Policies do YouTube na íntegra antes de qualquer decisão de produto.
- Pedir uma leitura real à forja (nunca foi usada em produção).
- Deriva do `database.types.ts` em relação a migrations recentes.

## 8. Frente futura, grande, ainda sem plano: TikTok (anotado em 08/10 a pedido do dono)

O dono quer algo parecido com o Observatório para o TikTok: ver o que estoura numa plataforma e na
outra, analytics, capas. E ligar contas do TikTok a canais do YouTube do mesmo criador (um criador
pode ter duas contas de TikTok, ou mais de um canal). **Não planejar agora.** Mockup da página do
canal: "aprovado por enquanto" (08/10).

O que pensar quando chegar a hora:
- **Modelo de dados antes de tudo:** uma entidade "criador" acima de canal/conta, com N canais do
  YouTube e N contas do TikTok. Hoje tudo é chaveado por canal do YouTube; quanto mais telas e
  tabelas nascerem assim, mais caro fica. Vale decidir o nome e a chave dessa entidade cedo, mesmo
  sem TikTok, para as tabelas novas não fecharem a porta.
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
