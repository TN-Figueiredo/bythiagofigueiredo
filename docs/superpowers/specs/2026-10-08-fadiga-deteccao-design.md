# Detecção de "fadiga" dos vídeos próprios — proposta (08/10/2026)

Rascunho para aprovação do dono. Nada aqui está implementado, exceto o que a seção 1 diz que já existe.

## 0. A pergunta que o alerta responde

"Vale testar título ou thumbnail novos neste vídeo antigo?" Um alerta só serve se, quando dispara,
a resposta honesta for "provavelmente sim". Tudo abaixo decorre disso: o alerta tem de separar
**as pessoas veem e clicam menos** (problema de embalagem, um teste A/B ajuda) de **o YouTube mostra
menos** (problema de distribuição, um teste de thumbnail não resolve).

## 1. O que existe hoje e por que não serve (VERIFICADO no código e em produção, 08/10)

Cálculo: `apps/web/src/lib/youtube/ab-fatigue.ts`, chamado pelo cron `sync-analytics-metrics`.
Ajusta `log(views) = a + b·log(idade)` aos dias com 50 views ou mais dos últimos 60 dias e alerta
quando a média dos 7 últimos resíduos fica 1,5 desvio abaixo da média dos resíduos.

1. **A entrada não é diária.** `youtube_video_analytics.views` é o total da janela de sincronização
   (90 dias, `dimensions=video`), regravado todo dia com `date = hoje`. Em produção um mesmo vídeo
   mostra 11, 11, 11, 11, 11, 11, 7, 7 em dias seguidos. O detector ajusta uma curva de decaimento
   a uma soma móvel. O resultado não tem interpretação.
2. **O filtro esconde a queda.** Dias com menos de 50 views são descartados antes do ajuste. Um
   vídeo que cai de 80 para 30 tem os dias ruins removidos; "os 7 últimos" passam a ser os 7
   últimos dias bons.
3. **A estatística não é calibrada.** Os 7 resíduos testados entram no próprio ajuste; a média de 7
   dias é comparada com o desvio de um dia; resíduos de dias vizinhos são correlacionados. Não se
   sabe a taxa de alarme falso.
4. **Só views.** Não distingue menos impressões de menos cliques. Não há controle para queda do
   canal inteiro, dia da semana, mudança de origem de tráfego, nem para troca de título/thumbnail
   no período.
5. **Dedup só enquanto `pending`.** Dispensado hoje, alerta de novo amanhã.
6. **Nunca disparou e não dispararia:** 0 alertas; 478 linhas, 17 vídeos, 1 084 "views" somadas
   desde 06/09; nenhum dia com 50 ou mais. `impressions` e `ctr` da tabela são 0 em todas as linhas
   (a Analytics API não os entrega).

Observação fora do escopo, mesma causa: `detectViral` soma dois totais de 90 dias e compara com uma
"média de 48 h". Os 10 avisos `youtube.trending_viral` já enviados são suspeitos.

O que já foi feito em 08/10: colunas alargadas (migration `20261008000001`), aviso no sininho com
texto que diz o que o número é (commits `80ceed03`, `e89e4e46`).

## 2. O que mudou: dados que não tínhamos

| Dado | De onde | Quando existe |
|---|---|---|
| Impressões e CTR de thumbnail por vídeo e por dia | Reporting API, `channel_reach_basic_a1` (bruto já sendo baixado desde 08/10; até 30 dias de backfill) | normalizado no lote L2 (`yt_own_video_reach_daily`) |
| O mesmo, aberto por origem de tráfego | `channel_reach_combined_a1` (A CONFIRMAR no cabeçalho real, que chega em até 48 h) | bruto guardado; normalizador não previsto ainda |
| Views diárias de verdade por vídeo | Analytics API `dimensions=day` | lote L2 (`yt_own_video_daily`) |
| Título e thumbnail no ar em cada dia, e teste A/B no ar | `yt_own_video_meta_daily` | em produção desde 08/10 |

## 3. Proposta: três vereditos, um só vira alerta

Para cada vídeo próprio com 45 dias ou mais de publicado, sem teste A/B em nenhum estado ativo:

- **Janela recente R:** os 14 dias fechados mais recentes com relatório de alcance.
- **Janela de base B:** os 28 dias imediatamente anteriores.
- **Exclusão:** se `yt_own_video_meta_daily` mostra troca de título ou de thumbnail, ou teste A/B,
  em qualquer dia de R ou B, o vídeo não é avaliado ("embalagem mudou no período"). Dia sem linha de
  metadados conta como desconhecido e também impede a avaliação.

Números por janela: impressões somadas, cliques somados (`impressões × CTR` por dia, somados; ou a
coluna de cliques, se o relatório trouxer), `CTR = cliques / impressões`.

**Portão de volume.** Só avalia se R e B têm, cada uma, pelo menos 10 000 impressões e pelo menos
10 dias com dado. Conta de onde sai o número: detectar queda relativa de 20% num CTR de 4%
(4,0% → 3,2%), unilateral a 5% com 80% de poder, pede cerca de 6 700 impressões por janela sob
binomial puro; 10 000 dá folga para a variação entre dias ser maior que a binomial. Abaixo do portão
o veredito é **"sem volume para avaliar"**, contado na resposta do cron e mostrado no A/B Lab com o
quanto falta. Nunca é silêncio e nunca é "está tudo bem".

**Estatística.** Razão `r = CTR_R / CTR_B`. Intervalo por reamostragem de dias (bootstrap em blocos
de 7 dias dentro de cada janela, 2 000 réplicas, semente fixa por vídeo e data para o resultado ser
reproduzível). A unidade reamostrada é o dia, não a impressão, justamente porque impressões do mesmo
dia não são independentes.

**Controle do canal.** A mesma razão para o resto do canal (todos os outros vídeos elegíveis,
somados): `r_canal`. O que se testa é `r / r_canal`. Uma queda do canal inteiro vira um aviso único
de canal, não um alerta por vídeo.

**Controle de origem (se o relatório combinado trouxer a origem).** `r` padronizado pela mistura de
origens da base: `Σ w_s(B)·CTR_s(R) / Σ w_s(B)·CTR_s(B)`. Sem isso, um vídeo que passa a receber mais
impressões de busca (CTR naturalmente diferente) parece ter mudado sem ter mudado. Se a origem não
existir, o alerta sai marcado "sem controle de origem".

**Vereditos:**

| Veredito | Condição | O que acontece |
|---|---|---|
| **CTR caiu com alcance mantido** | limite superior de 95% de `r / r_canal` abaixo de 0,90; estimativa pontual ≤ 0,80; impressões por dia em R ≥ 70% das de B; verdadeiro em 3 avaliações diárias seguidas | alerta + sininho: "vale testar título ou thumbnail" |
| **Alcance caiu** | impressões por dia em R < 70% das de B, CTR sem queda confirmada | aparece no A/B Lab como informação; sem sininho; texto diz que teste de thumbnail não ataca isso |
| **Sem mudança confirmada** | o resto | nada |
| **Sem volume / não avaliável** | portão ou exclusão | contado e mostrado, com o motivo |

**Repetição.** Um alerta por vídeo a cada 30 dias. Dispensar silencia aquele vídeo por 30 dias.
Criar um teste A/B resolve o alerta.

## 4. Como saber se o detector presta antes de ligar

1. **Simulação com semente (testes de unidade).** Séries sintéticas com variação entre dias maior
   que a binomial e efeito de dia da semana: (a) sem mudança real, taxa de alerta por vídeo-mês
   abaixo de 5%; (b) queda real de 20% no volume do portão, detecção em pelo menos 80% dos casos;
   (c) queda do canal inteiro, nenhum alerta por vídeo; (d) mudança só na mistura de origens, nenhum
   alerta; (e) troca de thumbnail dentro da janela, "não avaliável".
2. **Modo sombra, 4 semanas.** O cron calcula e grava o veredito de cada vídeo, sem sininho. O dono
   olha a lista: os que teriam alertado fazem sentido? Só depois o sininho liga.
3. **E-mail** só depois da sombra.

## 5. A realidade de hoje

O site soma cerca de 35 views por dia em todos os vídeos. Nenhum vídeo chega perto de 10 000
impressões em 14 dias. Com o detector novo, **todo vídeo vai aparecer como "sem volume para
avaliar"** por um bom tempo. Isso é a resposta certa: com esse volume não existe método que diga
com segurança que o CTR de um vídeo caiu. O valor imediato é a tela parar de sugerir que alguém
está vigiando quando não está.

## 6. O que acontece com o detector antigo

Recomendação: **desligar** quando o novo entrar em sombra (não rodar os dois). Até lá ele fica como
está; não vale consertar um cálculo cuja entrada é uma soma móvel.

## 7. Dependências e ordem

1. L2 da coleta (normalização do alcance e diário real) — já previsto.
2. Cabeçalho real dos relatórios (48 h) — decide se há cliques explícitos e origem de tráfego.
3. Este detector, em sombra, entra no plano do A/B Lab honesto.

## 8. Em aberto

- Os limiares (0,80, 0,90, 70%, 10 000, 45 dias) são ponto de partida defensável, não medida: a
  sombra e a simulação os confirmam ou corrigem.
- Vídeo movido a busca tem CTR e sazonalidade próprios; o controle de canal pode não servir para ele.
- Shorts: o alcance de Shorts não é "impressão de thumbnail". Proposta: Shorts ficam de fora.

---

## 9. Revisão adversarial (08/10) — nota 45/100; a proposta acima NÃO deve ser aprovada como está

Um revisor independente conferiu o código, a produção e as contas. O diagnóstico da seção 1 se
sustenta (as seis afirmações verificadas). O resto não:

- **A seção 5 está errada por ~90 vezes.** "35 views por dia" era a soma dos totais de 90 dias, o
  mesmo engano da seção 1.1. O real é cerca de 35 views em 90 dias no site inteiro (0,4 por dia). O
  portão de 10 000 impressões em 14 dias fica 3 a 4 ordens de grandeza acima dos canais.
- **A regra não entrega o poder que promete.** Os 6 700 conferem (6 702), mas valem para "r < 1".
  Com "pontual ≤ 0,80" e "limite superior < 0,90", uma queda real de 20% é detectada em 36% dos
  casos no portão (20% com dispersão 2×). Para 80% seriam ~50 000 impressões por janela.
- **O bootstrap de blocos de 7 dias não existe com 2 blocos** (3 reamostras distintas). O certo é
  quase-binomial sobre os 42 dias com dispersão estimada, ou razão de somas com erro robusto por dia.
- **"3 dias seguidos" reduz o alarme falso em ~2 vezes, não em 0,05³;** avaliar todo dia infla a
  taxa mensal. Avaliar uma vez por semana, com taxa por vídeo-mês declarada.
- **Regressão à média e idade:** o vídeo só passa o portão quando teve um surto, a base pega o
  surto, e o CTR cai por composição da audiência. O controle de canal não corrige isso.
- **Controles frágeis:** `r_canal` com poucos vídeos; origem de tráfego fragmenta o volume.
- **Sombra de 4 semanas não valida nada** sem vereditos avaliáveis; metadados diários só existem
  desde 07/10, então nada é avaliável antes de ~18/11 mesmo com volume.
- **Incerto na Reporting API:** unidade e arredondamento do CTR; se há coluna de cliques; se linhas
  de baixo volume são omitidas (o que enviesaria justamente canais pequenos). Só o cabeçalho real e
  uma conferência contra o YouTube Studio resolvem.

**Recomendação que substitui as seções 3 a 6:**

1. Desligar o detector antigo (e o sininho ligado a ele): roda sobre soma móvel.
2. No lugar de "alerta", uma tabela descritiva **"Candidatos a teste"**, sem sininho: por vídeo, nos
   últimos 28 ou 90 dias, impressões, CTR com intervalo de Wilson, mediana do canal, ordenado por
   cliques perdidos estimados (`impressões × (CTR mediano − limite superior do CTR do vídeo)`).
   Pouco volume aparece com intervalo largo e a etiqueta "poucos dados". Responde "onde um teste
   rende mais" sem afirmar que algo caiu.
3. O detector temporal fica adiado, com gatilho de volume (algum vídeo acima de ~20 000 impressões
   em 28 dias) e com as correções acima incorporadas antes de qualquer implementação.
