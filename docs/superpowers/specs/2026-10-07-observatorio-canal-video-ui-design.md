# Observatório em torno de canal e vídeo — telas

Data: 07/10/2026, emendado em 09/10/2026 e 10/10/2026 · Estado: v9 (10/10/2026), **aprovada pelo dono em 10/10** com as emendas 44 a 46 (respostas às oito perguntas, posição geral entre nichos, leitor do L2 dentro da A4) · Base da v7: `staging` 6dd468ae; referências da v8 conferidas em 09/10 sobre `staging` eb85a52b; referências novas da v9 conferidas em 10/10 sobre `staging` c0399682. Specs irmãos: `2026-10-07-coleta-canais-proprios-design.md` ("spec de coleta") e `2026-10-07-ab-lab-honesto-design.md` ("spec do A/B"). Mockup aprovado "por enquanto" pelo dono em 10/10/2026: `docs/superpowers/mockups/2026-10-07-pagina-canal/` (doze rodadas, no `LEIAME.md`). Decisões do dono: `docs/superpowers/plans/2026-10-08-proximos-passos.md` ("roteiro"), seções 3b, 3c, 3d, 4, 5 e 6. Caminhos sem prefixo são relativos a `apps/web/src/app/cms/(authed)/youtube/competitors/`; `lib/` é `apps/web/src/lib/youtube/observatorio/`. Nos wireframes, 📌 🔍 ↗ ⋯ ⓘ representam ícones SVG de `_historico/icons.tsx` (`HIcon`), nunca emoji. A marca [INFERÊNCIA] indica afirmação sobre o código que não foi conferida; VERIFICADO (arquivo:linha) indica o que foi lido no código; "a conferir no plano" indica o que ninguém abriu. **Mapa do documento:** seções 1 a 13 como na v8, atualizadas; 14 perguntas abertas; 15 lista de Canais; 16 canal próprio; 17 vídeo próprio; 18 comparação entre dois canais; 19 regras de todas as telas (dicas, cores, números); 20 "A rever no fim". As seções 15 a 20 ficam depois da 14 para os números das seções 5 a 13 continuarem os que os outros documentos citam.

## Emendas de 09/10/2026 (depois do mockup aprovado)

A v7 foi escrita antes do mockup. O dono aprovou o mockup em quatro rodadas e mudou decisões. **Regra de leitura: onde o texto do corpo e uma emenda discordarem, vale a emenda.** Na v8 o corpo foi reescrito para dizer o mesmo que as emendas 1 a 21; a lista abaixo fica como registro do que mudou e de onde veio. **Na v9, as emendas 22 a 43 (mais abaixo) alteram algumas destas** (8, 13, 15, 17, 21 e as perguntas 1 a 10); os números de pergunta citados nas emendas 1 a 21 são os da v8. Onde o `LEIAME.md` do mockup e o roteiro discordam, vale o roteiro, que é mais recente; cada divergência está na seção 14.

1. **A página do vídeo não é uma tela nova.** A v7 (seção 6) descrevia uma página de vídeo nova, com faixa "Resumo", barra presa de seções, tira de capas no cabeçalho e "Versões" sem thumbnails. Passa a valer: o destino é o **Histórico do vídeo que já está em produção** (`_historico/historico-screen.tsx`), e nada dele se perde. Entram só três acréscimos: a chegada com a troca destacada, o visualizador de thumbnail e o cartão novo da leitura da forja. Origem: rodada 3 do mockup (o dono reprovou o desenho novo da rodada 2 por ser mais pobre); roteiro, seção 6.
2. **O nome da tela continua "Histórico do vídeo".** A v7 (seção 3) trocava o rótulo da trilha e o título da aba do navegador para "Vídeo". Passa a valer: os dois ficam como estão (`_historico/pager.tsx:13`, `video/[id]/page.tsx:12`). Origem: consequência da emenda 1; a trilha do mockup aprovado diz "Canais / Leo Khev / Histórico do vídeo".
3. **Chegada pela troca.** A v7 não tinha esse caminho: a marca de troca só preenchia a comparação na mesma página (seção 3). Passa a valer: a URL do Histórico aceita `troca=`; com ela a troca chega selecionada em "Antes e depois", marcada no gráfico e na raia, com o foco no marcador dela e o aviso lido pelo leitor de tela (seção 6.2). Origem: rodadas 2 e 3 (pedido do dono: "não tem como ver histórico a partir de trocas").
4. **Aba Trocas: um cartão e um botão por vídeo.** A v7 (seção 5.6) reaproveitava os `SwapCard` de hoje em largura cheia. Passa a valer: um cartão por vídeo, com as trocas dele dentro; um botão "Abrir histórico do vídeo" por cartão; em cartão com duas ou mais trocas, um link "Abrir nesta troca" por troca; cada troca antecipa o efeito em 7 dias com o mesmo motor do Histórico (seção 5.7). Origem: rodada 4; roteiro, seção 6 ("aprovada").
5. **Visualizador de thumbnail.** A v7 não tinha. Passa a valer: diálogo que amplia a thumbnail, com zoom, versões e comparação lado a lado (seção 6.3). Na raia Thumbnail do gráfico, o **clique duplo** amplia e o clique simples continua levando ao cartão da versão. Origem: rodada 4; roteiro, seção 6 ("aprovado").
6. **Vista padrão Capas, 5 por linha em 1440 px.** A v7 deixava a vista padrão em aberto (seção 14, item 1) e herdava a grade de Outliers (`repeat(auto-fill,minmax(232px,1fr))`, seção 2). Passa a valer: Capas é o padrão; 5 colunas em 1440 px. Origem: rodadas 1 e 3; roteiro, seção 6.
7. **"Carregar mais" por botão, de 40 em 40.** A v7 dizia "até 200 vídeos mais os fixados no pacote; 60 por vez na tela" e desenhava "[Mostrar mais 60]" (seções 5.1 e 5.8). Passa a valer: a grade abre com os vídeos acompanhados do canal (hoje 50) e os fixados; os mais antigos só entram pelo botão "Carregar mais", centralizado no fim, 40 por clique, sob um divisor com aviso. Não há carregamento automático ao rolar. Origem: rodadas 3 e 4; roteiro, seção 6.
8. **Cabeçalho do canal com os números atuais.** A v7 (seção 5.3) pedia um ⓘ por número e tirava o engajamento. Passa a valer: os números que o mockup aprovado mostra (inscritos, ritmo, views por dia nos longos, inscritos em 30 dias), sem mudança, com um ⓘ só. A linha 3 passa a dizer quantos vídeos são acompanhados e quantos são antigos. Origem: rodada 3, decisão 3; roteiro, seção 6. O roteiro diz "os quatro números atuais" sem listá-los; ver a pergunta 3 da seção 14.
9. **Cartão de vídeo: três colunas fixas, sem ⓘ no cartão.** A v7 (seções 5.1 e 5.4) pedia os três números em uma linha de texto e um ⓘ no múltiplo de cada cartão. Passa a valer: três colunas fixas, valor em cima e rótulo embaixo; a base do múltiplo fica no menu "Ações do vídeo" e numa nota sob a grade; quando faltam views por dia e múltiplo, uma frase só. Origem: rodada 1 (tabela "Diferenças em relação ao spec"), aprovada junto com a vista Capas.
10. **Um múltiplo só por vídeo.** A v7 não dizia de onde a grade tirava o múltiplo. Passa a valer: a grade do canal e o Histórico mostram o mesmo número, o do motor (`lib/multiplier.ts`, por formato e faixa de idade). Origem: rodada 3 (o mockup mostrava 3,4× na grade e 2,1× no histórico para o mesmo vídeo).
11. **Gráfico em 30 dias por padrão.** A v7 (seção 6.1) desenhava "[7 d|30 d|90 d|Tudo]" sem padrão; a produção abre no vídeo inteiro e só oferece o filtro com mais de 30 dias de série (`lib/rules.ts:20`). Passa a valer: 30 dias é o padrão e o seletor aparece sempre. A faixa "antes de 03/10, sem registro" fica. Origem: rodada 3; roteiro, seção 6.
12. **Thumbnails continuam na seção de versões; a tira de capas não entra.** A v7 (seções 6.2, 6.3 e 14, item 2) tirava as thumbnails de "Versões" e punha uma tira de capas no cabeçalho, "a validar no mockup". Passa a valer: a seção "Thumbnails" da produção fica inteira e a tira de capas não é feita. Origem: rodada 3, decisão 4; roteiro, seção 6.
13. **O cartão novo da forja substitui o cartão de hoje; o botão do cabeçalho fica e rola até ele.** A v7 (seção 6.3) tirava o botão da forja do cabeçalho. Passa a valer: o botão "Pedir leitura à forja" continua no cabeçalho do Histórico e rola até o cartão "Leitura da forja", que passa a ser o da seção 7.1 no lugar do de hoje (`_historico/video-reading.tsx:90`). Origem: rodadas 2 e 3; roteiro, seção 6. O `LEIAME.md` diz que o botão rola **e dispara** o pedido; o roteiro diz só que rola. Vale o roteiro; ver a pergunta 4 da seção 14.
14. **Leitura sem efeito medido abre com o que fazer.** A v7 não tratava do caso. Passa a valer: quando nenhuma troca tem efeito medido, a leitura abre com a ação ("O que fazer: esperar 7 dias depois da troca…") e pode citar o desempenho anterior à troca, sempre sem afirmar causa (seção 7.1). Origem: rodada 3, decisão 5; roteiro, seção 6.
15. **O paliativo no painel de Canais deixa de existir.** A v7 (seção 4, "Fase A — paliativo no painel atual") reordenava as abas do painel lateral e punha links nele. Passa a valer: não se mexe no painel; a fase A entrega a página do canal (seção 4). Origem: roteiro, seção 4, etapa 5.
16. **Borda que reprova contraste não bloqueia estas telas.** A v7 (seção 11, linha 12) dizia "par reprovado bloqueia". Passa a valer: os tokens de linha do produto (`--border`, `--border-subtle`, `--border-strong`, `--forja-line`) reprovam 3:1 em todo o CMS e viram pendência separada; nestas telas, onde a borda é o que identifica o controle, usa-se `--dim` ou `--muted`. Origem: rodada 1 (prova 2); roteiro, seção 6.
17. **A unidade do CTR está fixada.** A v7 (seção 8.3) só desenhava a célula do CTR "depois de o runbook fixar a unidade". Passa a valer: no CSV real `thumbnail_ctr` vem de 0 a 1; a tela multiplica por 100 e mostra percentual. Não existe coluna de cliques, então nenhuma tela mostra cliques. Origem: fatos de 09/10 (lote L2 da coleta).
18. **`youtube_video_analytics.views` é total de 90 dias.** A v7 já tratava o percentual assistido como total da janela (seção 8.3), mas não dizia o mesmo das views. Passa a valer: esse número nunca é mostrado nem somado como views de um dia. Origem: roteiro, seção 5.
19. **Sem entidade "criador"; TikTok fora.** A v7 não tratava do assunto. Passa a valer: cada canal do YouTube é uma página; nada neste spec cria chave comum entre canais ou plataformas, e TikTok não é planejado aqui. Origem: roteiro, seção 8.
20. **A thumbnail arquivada pode ter 1280×720.** O `LEIAME.md` (rodada 4) dizia que o arquivo guarda só a `hqdefault` (480×360). Isso mudou em 08/10: o arquivamento tenta `maxresdefault`, depois `sddefault`, e só então fica com a `hqdefault` (`apps/web/src/lib/youtube/thumb-fingerprint.ts:84`). Vale só para o que for arquivado dali em diante; as versões antigas continuam em 480×360. Origem: roteiro, seção 2 (commit `08491bd8`).
21. **Entrega em fases.** A v7 não separava o que entra primeiro. Passa a valer a seção 4: a fase A é a página do canal, a aba Trocas, a chegada ao Histórico com a troca destacada e o visualizador de thumbnail. Origem: roteiro, seção 4.

## Emendas de 10/10/2026 (rodadas 5 a 12 do mockup, aprovado "por enquanto" em 10/10)

O dono aprovou o mockup em 10/10, depois da rodada 12, e mandou prosseguir: este spec v9, o "pode" dele, o plano. A v9 leva ao spec **tudo** o que as rodadas 5 a 12 e as respostas do dono de 09 e 10/10 decidiram, para que o plano da fase A possa ser escrito só a partir do spec, sem reler o mockup. **Regra de leitura: onde o corpo e uma emenda discordarem, vale a emenda; entre duas emendas, a mais recente.** O corpo das seções afetadas foi atualizado para dizer o mesmo; as seções 15 a 20 são novas e ficam depois da seção 14 para não mudar a numeração que os outros documentos citam (§7.3, §8, §9). As frases "(emenda N)" do corpo apontam para esta lista. Fontes: roteiro, seções 3b, 3c e 3d; `LEIAME.md` do mockup, rodadas 5 a 12.

22. **A fase A é cortada em A0 a A4.** A v8 (seção 4.1) tinha 13 itens de aceite para uma fase só. Passa a valer a seção 4: A0 fundação (camada de dicas, tokens, carregador), A1 canal do concorrente, A2 Histórico, A3 lista de Canais e comparação, A4 canal próprio e vídeo próprio; cada item com dado, dado ausente e aceite. Origem: pedido de reescrever a fase A com aceite por item (esta revisão); rodadas 5 a 12.
23. **O cartão novo da forja entra na fase A (em A2).** A v8 (seção 4.2 e pergunta 1) deixava o cartão fora e perguntava. Passa a valer: entra, no lugar do cartão de hoje (`_historico/video-reading.tsx:90`). Origem: dono, rodada 5, item (a); roteiro, seção 3b.
24. **O botão do cabeçalho rola E pede, com andamento em três etapas: Na fila, Escrevendo, Pronta.** A emenda 13 e a pergunta 4 da v8 diziam "só rola". Passa a valer: rola até o cartão, põe o foco nele e envia o pedido; com pedido em andamento só rola. A quarta etapa "Conferindo os números" foi descartada (o código só distingue 'na fila', 'trabalhando' e 'publicado'); ela é detalhe de "Escrevendo" (6.5, 7.4). Origem: dono, rodada 5, item (c); rodada 7, decisão 1.
25. **O Histórico do vídeo fica só com a trilha: sem abas de seção e sem barra de nicho,** em todas as origens. A recomendação da pergunta 2 da v8 ("o Histórico fica com a moldura de hoje") cai. Origem: dono, rodada 5, item (b); roteiro, seção 3b.
26. **O painel lateral de Canais sai para concorrente.** Clique em nome ou avatar leva à página do canal. A pergunta 5 da v8 recomendava manter o painel para canal próprio; o canal próprio ganha página própria em A4, e até lá continua abrindo o painel (3, 15.2). Origem: dono, rodada 5, item (d).
27. **O cabeçalho do canal tem a "faixa de números" rica.** A emenda 8 e a pergunta 3 da v8 falavam em "quatro números atuais". Passa a valer: seis células na faixa (inscritos, inscritos em 30 dias, longos + Shorts por semana, views/dia nos longos, engajamento nos longos, vídeos acima de 2× em 90 dias) e doze em "Todos os números" (5.3); mais respiro entre nome, faixa, sincronização e abas (+18 px na grade, rodada 11). O engajamento nos longos, que a v7 mandava tirar do cabeçalho, volta como célula da faixa. Origem: dono, rodada 5, item (e), e rodada 11, item 3.
28. **"Trocas em 30 dias" fica fora da faixa principal;** vai para "Todos os números", porque o número já está no rótulo da aba Trocas. Origem: dono, rodada 6, item 3 ("fica"). O aceite da v8 que exigia que os números batessem com o painel de Canais continua valendo para as células da faixa.
29. **Lista de Canais com filtro de formato "Todos | Longos | Shorts"** (padrão Longos, `?fmt=` sempre na URL; em Todos, duas medidas por célula, sem mediana misturada, ordenação pelos longos dita no cabeçalho) (15.3). Origem: dono, rodada 12, item 2.
30. **O canal próprio aparece no TOPO e NA LISTA de Canais, com a posição na ordenação,** e há o atalho "Meu canal" na moldura (15.2). Isto troca o grupo fixo no topo de hoje (`_canais/view-model.ts:105`). Origem: dono, rodadas 6 e 7.
31. **Canal próprio tem página própria** (seção 16): faixa de números, grade com impressões e cliques em contagem, "Como o canal está" **recolhida por padrão**, gráfico de impressões por dia em três estados com uma cor por estado. Substitui o texto de 5.2 da v7 e a regra de que o canal próprio "não entra na fase A". Origem: dono, rodadas 5 a 8 e 11.
32. **Vídeo próprio tem tela própria** (seção 17): paginador Anterior/Próximo na ordem da lista de origem; faixa de números com rótulo e ⓘ com a conta; "Este vídeo no canal" como frase-resumo e uma régua por número; cartão da forja "ainda não disponível". Substitui 6.6 ("o vídeo próprio abre como abre hoje"). Origem: dono, rodadas 8 e 10.
33. **Tela própria de comparação entre dois canais** (seção 18), com seletor de cada lado, "Inverter lados", quatro entradas, canal próprio sempre laranja e o outro azul (areia no lado A sem canal próprio), "Leitura rápida" calculada, régua do nicho com posição escrita ("13º de 14", não percentil), "Só o seu canal mede", cartão da forja "ainda não disponível". Origem: dono, rodada 9 ("o botão Comparar só navegava para o meu canal"); rodadas 10 a 12.
34. **Dicas, popovers e menus vivem numa camada única, sempre acima do conteúdo e dentro da janela** (19.1), com itens de aceite próprios (A0.1, A0.2). Registra o conserto parcial de produção (`45a9bbfb`, só CSS da tabela de Canais) e o que ele não cobre: a linha do meio encostada no pé da janela. Origem: dono, rodada 12, item 1.
35. **Uma cor única de "não medido" em todas as telas: rosa com hachura.** Cor nunca é o único sinal. Nenhum `color-mix()` em CSS (o Opera do dono o renderiza transparente) (19.2). Origem: dono, rodada 11, item 2; rodada 12, C7.
36. **Cliques: sempre em contagem estimada, sem corte e sem percentual por vídeo.** Altera a emenda 17 da v8 ("nenhuma tela mostra cliques"): a unidade do CTR (0 a 1) continua; a tela passa a mostrar a contagem estimada, impressões × CTR por dia e vídeo (8.3, 19.3). Origem: dono, rodadas 6 e 7.
37. **"Views por dia" abaixo de 10 com uma casa decimal; zero exato é "0".** Fecha a pergunta 8 da v8: a regra já está no mockup (`dados.js:158`). Resta a borda de valor positivo menor que 0,05 (19.3). Origem: roteiro, seção 6; rodada 5.
38. **Correção de INFERÊNCIA da v8, "poucos vídeos para comparar (2; precisa de 5)".** O motor calcula o múltiplo com qualquer base e marca "base fraca" abaixo de 3 vídeos (`lib/youtube/observatorio/multiplier.ts:42-45`, `RULES.weakBase`); só devolve nulo quando não há nenhum vídeo comparável ("sem comparação"). A tabela de 5.9 foi corrigida. VERIFICADO em 10/10.
39. **O parâmetro `?comparar=` não existe em produção.** Ele só existiu em rodadas do mockup (`canal-proprio.html`); nenhum código de produção o usa (busca em 10/10). Não há redirecionamento a fazer (18.1).
40. **Os leitores de `yt_own_video_daily` e `yt_own_video_reach_daily` não existem.** As tabelas estão em produção desde 09/10 (L2); nenhuma tela as lê (VERIFICADO por busca em 10/10). Tudo o que as seções 16 e 17 mostram de impressões e de views por dia do canal próprio depende de um leitor novo (A4.1) e da conferência da Task 11 do L2 (16.1, 16.7).
41. **Perguntas abertas refeitas:** fechadas as da v8 de número 1 (a), 2, 3, 4, 5 e 8; mantidas a 1 (b, agora pergunta 1), 6, 7, 9 e 10 (agora 2, 3, 4 e 5); três novas (6 a 8). Total de oito, cada uma com recomendação e custo de errar (seção 14).
42. **Seção nova "A rever no fim"** (seção 20): os 12 pontos que o dono pediu para conferir com tudo implementado, com a fase em que cada um nasce. Origem: roteiro, seção 3d.
43. **Mockup, doze rodadas.** A seção 12 foi atualizada: o que foi aprovado nas rodadas 5 a 12, o que foi medido, e o que continua não provado.
44. **As oito perguntas da seção 14 foram respondidas pelo dono em 10/10: todas as recomendações aceitas**, a 8 com a emenda 45. Passam a ser requisito: (1) a aba "Leitura" mostra a leitura do nicho, rotulada, com o botão do canal apagado; (2) a aba Trocas fica com título e thumbnail e diz isso no título da seção; (3) com troca fora do período, o gráfico abre no menor período que a inclui; (4) o pager segue a ordem da grade, antigos inclusive; (5) A1 a A3 aceitam com dados semeados e A4 só começa depois da Task 11 do L2 e de alguns dias de série; (6) **a lista de Canais mantém as colunas de produção** (Ritmo, Views/dia, Outliers, Trocas, Crescimento, Sincronização) e só acrescenta o filtro de formato, o bloco "Seus canais" com posição, "Comparar" e o link para a página; (7) "Todos" usa o `is_short` que a produção tem e mostra "formato não confirmado (N)" quando há nulos. O corte em A0 a A4 (emenda 22) também foi aceito.
45. **A posição segue o filtro de nicho, e existe posição geral (decisão do dono em 10/10).** Com um nicho escolhido, a posição é entre os canais daquele nicho ("13º de 14 em Viagem"). Com o nicho em **"Todos"**, a posição é **geral**, entre todos os canais do site, de todos os nichos ("40º de 75 no geral"): o dono quer saber quem é o canal mais bem-sucedido entre nichos diferentes, e a lista em "Todos" tem de ordenar e numerar todos juntos. Consequências: (a) canal sem nicho recebe posição geral e só fica sem posição dentro de um nicho; (b) a tela de comparação aceita dois canais de **nichos diferentes**, e aí a régua e a posição são as gerais, com o nicho de cada um escrito ao lado do nome; com os dois no mesmo nicho, mostra a posição no nicho e, em texto apagado, a geral; (c) toda frase de posição diz o conjunto ("em Viagem", "no geral"), nunca só "de N"; (d) a posição continua existindo só para os seis números da pergunta 8 e no formato do filtro de formato. Aviso que a tela dá em "Todos": canais de nichos diferentes têm públicos de tamanhos diferentes, então a posição geral ordena, não julga. Corrige 15.4 e a seção 18.
46. **O leitor das tabelas do L2 faz parte da A4, não fica para depois (decisão do dono em 10/10: "o plano tem de mostrar tudo no fim").** A fase A4 inclui o trabalho de servidor que lê `yt_own_video_daily` e `yt_own_video_reach_daily` (emenda 40) e o que separa "zero medido" de "não medido" a partir de `yt_reporting_reports`. Nenhum bloco do mockup aprovado do canal e do vídeo próprio pode ficar sem dado por falta de leitor: o que a A4 não conseguir ler vira item explícito do plano seguinte, com dono e data, nunca um "não medido" permanente.

## 1. Para quem e para quê
- Quem usa: o dono do canal e uma editora de vídeo, no desktop, tema escuro.
- Pergunta que a pessoa traz: "o que este canal publicou e o que deu certo?" e depois "o que aconteceu com este vídeo?".
- Hoje o caminho passa por "trocas" e por um painel de 404 px que mostra 5 vídeos. Passa a ser canal → vídeo.
- Precisa parecer produto que se vende: navegar não dá tranco e nenhum número é inventado.
- Nenhuma tabela nova de métricas. A grade exige as mudanças no carregador de 5.10; leitura por canal exige o trabalho de servidor de 7.3.
- A v9 acrescenta quatro telas ao caminho: a lista de Canais com filtro de formato (15), a página do canal próprio (16), o vídeo próprio (17) e a comparação entre dois canais (18). Elas leem só o que a produção já tem ou o que o lote L2 da coleta já grava; nenhuma tabela de métricas nova é criada.
- Cada canal do YouTube é uma página. Não existe entidade "criador" que junte canais ou plataformas, e TikTok não faz parte deste spec.

**Vocabulário, igual em todas as telas.** "Sincronizar" e "sincronização": buscar dados de concorrente no YouTube. "Coleta": só os dados dos canais próprios. "Leitura": só o texto da forja. "Resumo": só a faixa de números do vídeo. "Múltiplo": quantas vezes o vídeo fica acima do normal do canal, com o nível por escrito: de 2 a 5, "alto"; de 5 a 10, "muito alto"; 10 ou mais, "topo"; abaixo de 2, sem palavra. "Trocas": mudanças de título e de thumbnail nos últimos 30 dias, a mesma janela em todo lugar. Horários em São Paulo; só os dados dos canais próprios são "dia do YouTube", dito uma vez por seção, no cabeçalho, com o botão ⓘ. "Não medido": o dado não foi coletado, e a tela diz o motivo; nunca vira zero. "Zero medido": o dado foi coletado e vale 0; escreve-se "0", e por forma e cor é outra coisa que "não medido" (19.2, 19.3). "Meu canal" quando é a pessoa agindo (o atalho, "Abrir meu canal", "Comparar com o meu canal"); "seu canal" quando é a tela falando (o selo, "Você está na 10ª posição…"). "Cliques": sempre uma contagem estimada, impressões × CTR, e rotulada como estimada (19.3). "Posição": "13º de 14 no nicho", nunca percentil.

## 2. Linguagem visual reutilizada
Nada de paleta ou fonte nova.

| O quê | Valor real | Onde |
|---|---|---|
| Superfícies e linhas | `--bg #1A1714`, `--surface #221E1A`, `--surface-2 #272219`, `--sunk #16130F`; `--border #332D25`, `--border-subtle #2A251F`, `--border-strong #40382D` | `_chrome/chrome.css:8-9` |
| Texto | `--text #F5EFE6`, `--muted #A89D88`, `--dim #958A75`. Corpo mínimo de 12 px na interface nova (há 11 e 11,5 px em `chrome.css`; não se copiam) | `chrome.css:10` |
| Ação da pessoa | `--accent #FF8240` sobre `--on-accent #1A120A`; no máximo um botão preenchido por vista | `chrome.css:11`; `docs/superpowers/mockups/2026-10-02-observatorio/CONVENCOES.md`, "Hierarquia de ações" |
| Forja | `--forja #5CC3B2`, `--forja-subtle rgba(92,195,178,.12)`, `--forja-line rgba(92,195,178,.35)`, `--on-forja #0E2A25` | `chrome.css:13` |
| Estado | `--success`, `--warning-text`, `--danger #F26B6B`; fundos `--warn-subtle`, `--danger-subtle`, `--ok-subtle` (rgba literais) | `chrome.css:12,16` |
| Níveis do múltiplo | `--tier-mid #38BDF8`, `--tier-high #A78BFA`, `--tier-top #E0735C`, sempre com a palavra do nível | `chrome.css:15` |
| Cores novas (rodadas 11 e 12) | "não medido" rosa com hachura (`--nm #E59CC0`), lados da comparação (`--lado-o #FF8240`, `--lado-b #7CC8F8`, `--lado-n #D9C08F`), terço de baixo (`--terco-baixo #F2C14E`), cliques e zero medido (`--im-cl #38BDF8`, `--im-zero #7A8FA6`). Definidas num arquivo só, com hex ou rgba literal, nunca `color-mix()` | seção 19.2; mockup `camadas.css`, `comparar.css`, `regua.css`, `impressoes.css` |
| Tipos | Inter (`--font-sans`) na interface; JetBrains Mono (`.num`/`.mono`, `tabular-nums`) só em números; Fraunces só no título da página e no texto das leituras | `CONVENCOES.md`, "Tipografia e números" |
| Botões | `.obs-ch-btn` (34 px, `chrome.css:57`), `.obs-ch-ghost`, `.obs-ch-forja-solid` (`chrome.css:67`). A tela nova adota 34 px. Os `.btn` de cada tela não são copiados: 36 px em `canais.css:33` (32 px é `.btn.small`), 34 px em `historico.css:37` | `_chrome/chrome.css` |
| Largura, grade, raios | conteúdo em `max-width:1240px` (`chrome.css:44`); a grade do canal tem 5 colunas em 1440 px, com `gap:14px` (grade própria: a de Outliers, `repeat(auto-fill,minmax(232px,1fr))` em `_outliers/outliers.css:86`, não é reaproveitada); raio 8 px cartão, 6 px controle, 4 px selo | mockup `canal.css`; contagem nos seis `.css` |
| Foco | `outline:2px solid var(--accent); outline-offset:2px`, nunca cortado pelo `overflow` do cartão | `canais.css` |

**Reuso exige promoção.** As classes estão presas a uma tela por seletor: `.dstats`, `.btn`, `.youtag` sob `[data-obs-screen="canais"]`; `.stamp` sob `[data-obs-screen="insights"]`; `.obs-out-card`, `.obs-out-ttl` sob `.obs-out`. O plano as promove para `_chrome/` com prefixo `obs-ch-`. `Thumb` e `MultBlock` (`_outliers/outlier-card.tsx`) recebem hoje o `OutlierCardView` inteiro; passam a aceitar uma prop mínima.

Princípios destas telas:
1. **A thumbnail é o assunto.** Em Capas ela aparece inteira, em 16:9. O corte 2,6:1 de Outliers (`outliers.css:92`) não se repete. Toda thumbnail destas telas pode ser ampliada (6.3).
2. **Os números não mudam de lugar.** Views, views/dia e múltiplo ficam na mesma ordem. A ordenação só muda qual fica em `--text` com peso 600.
3. **O que falta ocupa o lugar do que faltou.** Célula sem dado mostra uma frase curta ("não medido", "sem contagem") com o motivo, na cor única de "não medido" (19.2). Nunca "0" inventado, nunca "—" sozinho. Vídeo que não pode ser ordenado vai para o fim, sob um divisor com contagem; nenhum some.
4. **A página não se mexe enquanto carrega.** Cabeçalho, abas e controles ficam; só o miolo troca.
5. **Teal é a forja, laranja é a ação da pessoa.** Texto do modelo vem sob o selo, em Fraunces; frase do site fica fora do selo, em Inter (como em `_insights/reading-hero.tsx`).
6. **O conteúdo começa cedo.** Em 1440×900 a grade do canal começa a no máximo 340 px do topo (319 px medido na rodada 5, mais 18 px de respiro da rodada 11). No Histórico do vídeo, que é a tela de produção, o gráfico e as três raias cabem sem rolar (terminam em 737 px no mockup); "Antes e depois" começa abaixo da dobra, e isso foi aceito junto com a decisão de não perder nada da tela.

## 3. Mapa de navegação
`link` hoje tem `canais`, `mudancas`, `outliers`, `insights`, `historico` (`lib/links.ts:67-154`). A rota `canal/[id]` ainda não existe. Na página do canal, na do vídeo e na da comparação a moldura mostra só a trilha, sem as abas de seção nem a barra de nicho (emenda 25); a seção de origem continua sendo "Canais". À direita da trilha fica o atalho "Meu canal" (15.2).

| Tela | URL | Helper |
|---|---|---|
| Canal | `/cms/youtube/competitors/canal/<id>?tab=videos\|trocas\|leitura\|retencao&fmt=todos\|longos\|shorts\|fixados&sort=recentes\|vistos\|multiplo\|vpd&dir=asc\|desc&q=<texto>&ver=capas\|lista&n=<quantos antigos carregados>&video=<id, só na aba Trocas>&nums=1` | novo `link.canal(id, p)`; os padrões (`tab=videos`, `fmt=todos`, `sort=recentes`, `ver=capas`, `n=0`, sem `nums`) ficam fora da URL. `nums=1` abre "Todos os números". Aceita `from` e `back` só quando vem de Outliers, Mudanças ou do vídeo. Canal próprio usa a mesma rota, com `sort=imp` (impressões) e `painel=0\|1` ("Como o canal está"); ver a seção 16 |
| Comparação | `/cms/youtube/competitors/comparar?a=<id>&b=<id>` | novo `link.comparar(a, b)`; o id é o `ObsChannel.id` (canal próprio: `youtube_channels.id`; concorrente: `competitor_channels.id`). Seção 18 |
| Lista de Canais | `/cms/youtube/competitors?fmt=todos\|longos\|shorts&...` (o que `link.canais` já gera) | `fmt` passa a aceitar `todos`; a produção grava hoje só `fmt=short` e deixa `long` fora (`_canais/canais-screen.tsx:282`). Seção 15 |
| Histórico do vídeo | `/cms/youtube/competitors/video/<id>?from=canais&back=…&ids=…&troca=<id da troca>&range=7\|30\|90\|tudo` (rota que já existe) | `link.historico` (`lib/links.ts:136`) ganha `troca` e `range`; o nome do helper e o valor `from=canais` não mudam |

- `n` conta só os vídeos antigos já carregados pelo botão "Carregar mais" (0, 40, 80…), não o total na tela. É o que faz o Voltar reabrir a grade com os mesmos cartões.
- `troca` leva o identificador que o Histórico já usa para cada troca (`changeId`, `_historico/view-model.ts:541`). O mockup usa o instante da troca em milissegundos só porque não tem banco. [INFERÊNCIA: o `changeId` é estável entre duas cargas da página; o plano confirma antes de pôr o valor na URL.]
- `range` ausente passa a significar 30 dias; o vídeo inteiro passa a ser `range=tudo` (hoje é o contrário: `parseRange`, `_historico/many-versions.ts:16`).
- O id do canal na URL é o id interno (`competitor_channels.id`), que não muda quando o canal troca de @.
- `link.canais({ channel })` continua aceito por um ciclo: para concorrente redireciona para `link.canal(id)` (emenda 26); para canal próprio continua abrindo o painel lateral até a fase A4.
- `ids=` leva no máximo 100 ids, em torno do vídeo aberto. O pager conta a lista de origem ("vídeo 7 de 51").
- Anterior/Próximo **substituem** a entrada do histórico do navegador. "Voltar" sai para a lista de origem, no cartão do **último** vídeo visto, com o foco nele; `n` cresce até incluí-lo. Rolagem e foco voltam pelo histórico do navegador, não pela URL. O item do canal na trilha equivale ao Voltar do navegador quando a pessoa veio do canal.

| Entrada | Leva a | "Voltar" preserva |
|---|---|---|
| Linha ou cartão em Canais (nome e avatar) | Canal, aba Vídeos | nicho, busca, ordenação e rolagem da tabela |
| Nome do canal em Outliers, em Mudanças ou na trilha do Histórico | Canal | filtros da tela de origem (em `back=`) |
| "Ver fixados" (Canais) | Canal com `fmt=fixados` | idem |
| Thumbnail ou título na grade ou na lista do canal | Histórico do vídeo, com `from=canais`, `back=` e `ids=` da vizinhança filtrada e ordenada | aba, filtro, ordenação, busca, vista e `n` |
| Botão "Abrir histórico do vídeo" de um cartão da aba Trocas | Histórico do vídeo. Cartão com uma troca: já com `troca=`. Cartão com duas ou mais: sem `troca=`, foco no título | aba Trocas, rolagem e foco no botão do cartão |
| Link "Abrir nesta troca" de uma troca | Histórico do vídeo com `troca=` dessa troca | aba Trocas, rolagem e foco no link da troca |
| Cartão de Outliers, linha de Mudanças, item de Insights | Histórico do vídeo, com o `from` de hoje | como hoje (`back=` começa com `?`, `links.ts:147`) |
| Marca de troca no gráfico | preenche "Antes e depois" na mesma página (como hoje) | — |
| "Comparar" de uma linha ou cartão de Canais; "Comparar com o meu canal" no cabeçalho do concorrente; "Comparar com…" no canal próprio | Comparação, com `a` e `b` | a lista de origem (Canais) ou o canal de origem, com foco no gatilho |
| Menu "Meu canal" | página do canal próprio ou lista de Canais | o foco volta ao gatilho do menu (Esc) |
| Cartão do canal próprio | Vídeo próprio (seção 17), com `back=` da lista | aba, ordenação, busca, vista e `n`; o paginador anda na ordem da lista |
| Vídeo mais visto ou "Vídeos que mais apareceram" | Histórico (concorrente) ou vídeo próprio | a tela de origem |
| Miniatura na raia Thumbnail do gráfico | clique simples: vai ao cartão da versão, como hoje; clique duplo: abre o visualizador | — |

Trilha do Histórico vindo do canal: "Canais › <canal> › Histórico do vídeo". O segundo item já existe como `crumbs.sub` (`_historico/pager.tsx:12`, montado em `_historico/view-model.ts:592`); hoje ele aponta para Canais com o painel aberto e passa a apontar para a página do canal. O terceiro item não muda (`pager.tsx:13`).

## 4. Fases de entrega
A v7 abria com um paliativo no painel lateral de Canais; ele deixou de fazer sentido e continua fora (emenda 15). Cada fase tem plano próprio. A ordem geral do trabalho está no roteiro, seção 4; a "fase A" deste spec é a etapa 5 de lá.

Depois das rodadas 5 a 12 a fase A ficou grande demais para um plano só: cobre a página do canal do concorrente, o Histórico, a lista de Canais, a comparação, o canal próprio, o vídeo próprio e a camada de dicas. Este spec **propõe cortá-la em cinco entregas, A0 a A4**, por dependência de dado e por risco. O corte é proposta (o dono aprova junto com o spec); o resto do documento vale com ou sem ele. O texto abaixo mantém o nome "fase A" para o conjunto.

### 4.1 O corte proposto
| Fase | Entrega sozinha | Depende de dado | Risco | Depende de |
|---|---|---|---|---|
| **A0 Fundação** | Dicas, popovers e menus de todas as telas do Observatório abrem acima do conteúdo e dentro da janela; escala de camadas num arquivo; tokens de cor e de "não medido"; `loadChannelDataset` com nulos | nenhum dado novo | médio: toca todas as telas do Observatório e troca o CSS parcial `45a9bbfb` pela camada | nada |
| **A1 Canal do concorrente** | Do clique na lista de Canais à página do canal: cabeçalho com a faixa de números, Capas e Lista, controles, "Carregar mais", aba Trocas. O painel lateral deixa de abrir para concorrente | o que a produção tem hoje; **não precisa do L2** | médio: rota nova, tela nova, comportamento novo de um clique | A0 |
| **A2 Histórico** | Chegada pela troca, visualizador de thumbnail, gráfico em 30 dias, trilha e pager vindos do canal, moldura só com a trilha, cartão novo da leitura da forja e botão do cabeçalho que rola e pede, em três etapas | o que a produção tem hoje (leituras e fila da forja); sem servidor novo | **alto**: muda uma tela em produção aberta por quatro origens e troca um componente por outro; testes existentes mudam | A0; A1 só para trilha e pager vindos do canal |
| **A3 Lista de Canais e comparação** | Filtro "Todos \| Longos \| Shorts", bloco "Seus canais" com a posição, "Comparar", atalho "Meu canal"; tela de comparação entre dois canais | o que a produção tem hoje; o lado do canal próprio mostra "não medido" onde falta (views por dia, impressões) | médio: muda o comportamento do grupo "Seus canais" e testes; depende das perguntas 6 a 8 | A0, A1 |
| **A4 Canal próprio e vídeo próprio** | Página do canal próprio, gráfico de impressões por dia, "Como o canal está", posição no nicho, tela do vídeo próprio com paginador, faixa com ⓘ e "Este vídeo no canal"; a linha "Só o seu canal mede" da comparação | **L2 em produção**: `yt_own_video_reach_daily` e `yt_own_video_daily`, hoje sem leitor na tela; precisa da conferência da Task 11 e de alguns dias de dado | médio: é a que mais depende de dado real, e o aceite com 1 a 2 dias de série é fraco (pergunta 5) | A0, A1, A3 |

Ordem: A0, A1, depois A2 e A3 em qualquer ordem (independentes entre si), A4 por último. A1, A2 e A3 não esperam o L2. A0 vem antes de tudo porque cada tela nova nasceria com o defeito de dica cortada se a camada não existisse. A2 pode ir antes de A1 se o dono quiser a mudança do Histórico primeiro, com o custo de a trilha e o pager vindos do canal ficarem para depois.

**Fora da fase A inteira, e do que depende:**

| Item | Depende de | Onde está descrito |
|---|---|---|
| Leitura da forja para canal, para vídeo próprio, para canal próprio e para comparação (pedido real) | pacotes novos da forja (lote L4 do spec de coleta, seção 8) e o trabalho de servidor de 7.3; os cartões ficam "ainda não disponível" | 7.3, 17.4, 18.8 |
| Aba e seção Retenção; percentual assistido | lote L3 da coleta; mockup da Retenção ainda não feito | 8 |
| Inscritos em 30 dias do canal próprio | contagem diária de inscritos do canal próprio (lote L5); hoje "sem contagem de 30 dias atrás" | 16.1 |
| Telas do A/B | spec do A/B e mockup ainda não feito | 9 |
| Teclado e leitor de tela exercitados de verdade, zoom de 200 a 400%, movimento reduzido, toque real, Opera | não foram exercitados no mockup; viram tarefa de verificação do plano de cada fase | 11, 12.2, 20 |
| Bordas que reprovam contraste | pendência separada, do CMS inteiro | 11, linha 12 |
| Lente "Referências" (vídeos grandes no nicho, em números absolutos) | roteiro: entra depois da fase A das telas | roteiro, seção 3c |
| Remoção reversível de canal | emenda ao spec da coleta, antes do L3 | roteiro, seção 3c |

### 4.2 Itens de aceite, por fase
Formato: **o que entra** (seção), **de onde vem o dado** (VERIFICADO com arquivo e linha, ou INFERÊNCIA; "a conferir" quando o plano precisa abrir o código), **quando o dado não existe** (este sistema falha em verde: sempre "não medido" com o motivo, nunca zero, nunca tela vazia sem explicação) e **aceite verificável**. Caminhos sem prefixo: `competitors/` e `lib/` como no cabeçalho.

#### A0 Fundação
| # | O que entra | De onde vem o dado | Dado ausente | Aceite |
|---|---|---|---|---|
| A0.1 | Contêiner único de flutuantes `#flut`, componente de posicionamento e comportamento (19.1); ⓘ, menus, "Meu canal" e dicas das telas novas e do Histórico passam por ele | nenhum dado; hoje a dica é filha da célula (`_canais/cells.tsx:37-44`, `canais.css:55-61`) | n/a | Os quatro itens de aceite de 19.1 passam em 1440 e 390 px, com o controle negativo reprovando; o script de conferência é teste automatizado ou roteiro executável, e a saída vai para o ledger |
| A0.2 | Escala de camadas em arquivo único; nenhum `z-index` numérico fora dele nas telas novas | a pasta tem 35 linhas com `z-index` (busca em 10/10) | n/a | `grep` por `z-index:` numérico nas telas novas devolve zero fora do arquivo da escala; as 35 existentes ficam, e a migração é decisão do plano |
| A0.3 | Tokens de cor (19.2) e promoção de classes presas a uma tela (`.dstats`, `.btn`, `.youtag`, `.stamp`, `.obs-out-card`) para `_chrome/` com prefixo `obs-ch-`; `Thumb` e `MultBlock` com props mínimas (seção 2) | `_outliers/outlier-card.tsx` | n/a | Nenhum `color-mix()` no CSS novo; telas existentes sem mudança visual (captura antes e depois) |
| A0.4 | `loadChannelDataset(siteId, channelId)` e as mudanças de 5.10 (`comments` e `isShort` nulos, vídeos sem data, canal próprio) | `loadChannelRows` (`lib/load-channel.ts:20`), `cachedPack` (`lib/load-page.ts:59`, não exportado); a função não existe (busca em 10/10) | testes de `load`, um por caso de dado ausente de 5.9, afirmando o valor nulo, nunca o padrão | `loadChannelDataset` não lê os outros canais; resultado igual ao da leitura do site inteiro para o mesmo canal (teste, como `load-channel.test.ts`); cache quente e frio medidos e registrados |

#### A1 Canal do concorrente
| # | O que entra | De onde vem o dado | Dado ausente | Aceite |
|---|---|---|---|---|
| A1.1 | Rota `canal/<id>` e carregador (3, 5.9, 5.10) | `loadChannelDataset` (A0.4) | id desconhecido: "Canal não encontrado" na moldura, status 200, sem erro no Sentry | um teste de `load` por caso de 5.9; moldura da página com **só a trilha** (sem abas de seção nem barra de nicho) |
| A1.2 | Cabeçalho com a **faixa de números** de 6 células e "Todos os números" de 12 (5.3) | `channelStats()` e `cadence()` (`channels.ts:71-158`); derivados novos: duração mediana, views somadas, mediana de views, tema dominante (`RULES.theme`, `rules.ts`; "sem tema ainda" até a forja classificar) | cada célula sem dado mostra a frase ("nenhum longo em 90 dias", "horário variado (2 longos)", "sem tema ainda"); base com menos de 3 vídeos mostra "n = 2" (`RULES.weakBase`) | cabeçalho recolhido com no máximo 150 px (109 px no mockup, rodada 11); cada número bate com o do painel de Canais de hoje para o mesmo canal; todo número tem base escrita no ⓘ; "trocas em 30 dias" só em "Todos os números"; linha 3 soma certo (acompanhados + fixados antigos + mais antigos = total) |
| A1.3 | Vista Capas, 5 por linha (5.1, 5.4) | `ChannelVideoView` (5.10) | "sem contagem: <motivo>", "fixado antigo", "formato não confirmado", "views/dia e múltiplo: não medido" (5.9) | em 1440×900 na moldura real: 5 colunas, cartões da mesma altura; a grade começa a no máximo 340 px do topo do conteúdo (319 px na rodada 5 mais o respiro da rodada 11, +18 px; INFERÊNCIA: o plano mede e registra); meta de 10 cartões inteiros na carga, a conferir na moldura real; sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px |
| A1.4 | Vista Lista (5.1) | idem | idem | 8 ou mais linhas inteiras na carga em 1440×900; cabeçalho de coluna ordena e inverte; abaixo de 820 px vira pilha com rótulo e valor |
| A1.5 | Controles (5.5) | no navegador, sobre os campos brutos | "Nenhum Short neste canal." etc. (5.9) | cada troca atualiza a tela em menos de 100 ms sem indicador e sem navegar; a URL reproduz o estado; "Longos + Shorts + formato não confirmado = Todos"; os três números não mudam de ordem ao reordenar; views por dia com uma casa decimal abaixo de 10 (19.3) |
| A1.6 | "Carregar mais" (5.6) | `trackedVideoIds` (`lib/load.ts:456`) | filtro que só casa antigos: frase com a contagem | como na v8: abre só com acompanhados e fixados; 40 por clique; rolagem não muda; foco no primeiro cartão novo; status lido; `n` na URL |
| A1.7 | Aba Trocas (5.7) | `changesIn()` e `lib/effect.ts` | "sem série", "aguardando", "sem base" (5.7); aba vazia com frase | N vídeos com troca = N botões; links "Abrir nesta troca" só com 2 ou mais; frase de efeito igual à do Histórico |
| A1.8 | O painel lateral deixa de abrir para concorrente; clique em nome ou avatar (Canais, Outliers, Mudanças, trilha) leva à página (3, emenda 26) | `link.canal(id, p)` novo | canal próprio continua abrindo o painel de hoje até A4 | o painel só abre para canal próprio; o "?" e o menu da linha continuam; o botão da forja do rodapé do painel (`drawer-forja.tsx:39`) fica enquanto o painel existir |
| A1.9 | Aba Leitura (5.8, pergunta 1) | a leitura do nicho, no componente de hoje | "Leitura por canal ainda não existe…" | texto exato de 7.1; rótulo "não é só deste canal" |
| A1.10 | Regras de projeto (19.4) | n/a | n/a | nenhum `Link` passado de Server Component; validação autenticada da rota nova (`docs/ops/runbook-cms-e2e-local.md`) antes de promover |

#### A2 Histórico
| # | O que entra | De onde vem o dado | Dado ausente | Aceite |
|---|---|---|---|---|
| A2.1 | Chegada pela troca (6.2) | `changeId` (`_historico/view-model.ts:541`); estável entre cargas é INFERÊNCIA, o plano confirma | `troca=` inválido ou ausente: abre como hoje, sem erro | troca selecionada em "Antes e depois" com a linha "Aberta pela aba Trocas do canal: …", marcada no gráfico e na raia, foco no marcador |
| A2.2 | Voltar e pager a partir do canal (3, 6.5) | `ids=` e `back=` | lista de origem vazia: sem pager | Voltar devolve aba, rolagem e foco; Anterior/Próximo não fazem o histórico do navegador crescer; a frase de posição lê a origem em `back=` |
| A2.3 | Visualizador de thumbnail (6.3) | `ARCHIVE_VARIANTS` (`lib/thumb-fingerprint.ts:84`) e a versão atual | versão sem imagem: quadro explicativo, Baixar e Abrir original apagados | os seis gatilhos; Esc devolve o foco; fundo inerte; clique simples na raia continua indo ao cartão da versão |
| A2.4 | Gráfico em 30 dias por padrão (6.4) | `_historico/many-versions.ts:16`, `lib/rules.ts:20` | série curta e faixa "antes de 03/10, sem registro" como hoje | sem `range` o gráfico mostra 30 dias; seletor 7/30/90/tudo sempre; `range=tudo` mostra o vídeo inteiro |
| A2.5 | Nada do Histórico se perde (6.1) | a tela de produção | os estados que ela já tem | testes existentes passam sem mudar expectativa, salvo o padrão de período e a moldura (A2.6); a lista de 6.1 conferida item a item na tela |
| A2.6 | Moldura do Histórico **só com a trilha**, em todas as origens (emenda 25) | `video/[id]/page.tsx:33` hoje renderiza a moldura inteira | n/a | sem abas de seção nem barra de nicho; o `nicheOverride` (R47) deixa de ter uso e sai com o teste dele; quem chega de Mudanças, Outliers ou Insights volta pela trilha |
| A2.7 | Cartão novo da forja no lugar do de hoje (7.1, 7.2, 7.4) | `competitor_readings` e `youtube_intelligence_tasks`; estados em `forja/states.ts:33`, `:85-100` | as quatro situações de 7.2; sem leitura: "Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje." | selo único "em treino"; "Leu N vídeos e M trocas"; evidências numeradas; "Do site"; leitura sem efeito medido abre com o que fazer |
| A2.8 | Botão "Pedir leitura à forja" do cabeçalho **rola e pede**, com andamento em três etapas (6.5, 7.4, emenda 24) | `askForjaReading('leitura-video', …)` (`forja-actions.ts:44`); hoje o botão já pede e dá `router.refresh()` (`_historico/video-reading.tsx:29-44`) | cota do dia, pedido em andamento, forja sem capacidade: o botão vira "Ver a leitura" com a frase de 7.1 | um clique faz uma só chamada, rola, põe o foco no título do cartão e mostra a etapa; com pedido em andamento o botão só rola; teste que apaga o estado e afirma que sem pedido não há etapa |

#### A3 Lista de Canais e comparação
| # | O que entra | De onde vem o dado | Dado ausente | Aceite |
|---|---|---|---|---|
| A3.1 | Filtro "Todos \| Longos \| Shorts" (15.3) | `channelStats(ctx, id, fmt)` (`channels.ts:131`) | "sem Shorts", "não medido", "aguarda o 2º registro"; nunca 0 | `?fmt=` sempre na URL; padrão Longos; Todos mostra duas medidas rotuladas, ordena pelos longos e diz isso no cabeçalho; links antigos `fmt=short` continuam |
| A3.2 | Bloco "Seus canais" com a posição, canal na posição dele na tabela e nos cartões, linha presa no pé (15.2) | `obs.ownChannels()` e as posições do nicho (pergunta 8) | sem medida: divisor "Ainda sem medida para ordenar (N)" e frase do motivo | trocar a ordenação troca a frase; canal sem vídeos vira linha fina; testes "R73" atualizados no mesmo commit |
| A3.3 | "Comparar" por linha e cartão; atalho "Meu canal" (15.2) | n/a | canal de exemplo e canal próprio sem a ação | foco e Esc do menu; nome acessível "Comparar <canal> com o meu canal" |
| A3.4 | Colunas da lista (pergunta 6) | produção + mockup | n/a | decisão registrada antes de começar |
| A3.5 | Tela `comparar`: seletores, inverter lados, quatro entradas, cores dos lados (18.1, 18.2) | `ObsChannel` dos dois canais | canal sem vídeos: "sem vídeos" | URL reproduz o par; trocar o seletor não recarrega; o outro lado fica desabilitado |
| A3.6 | Leitura rápida, "Número a número" com as 13 linhas, régua do nicho (18.3 a 18.5) | 18.9 | pastilha de hachura "não medido" com o motivo; linha sem dado em nenhum lado não aparece e o rodapé conta | no máximo três itens por linha; "maior" só a partir de 10%; "×" só acima de 2×; "praticamente igual" abaixo de 10%; posição escrita, nunca percentil |
| A3.7 | Os 5 mais vistos, publicação em 90 dias, cartão da forja "ainda não disponível" (18.7, 18.8) | `ObsVideo` | bloco de publicação só aparece com datas | os traços da faixa no mesmo eixo; o botão do cartão apagado com o porquê |

#### A4 Canal próprio e vídeo próprio
| # | O que entra | De onde vem o dado | Dado ausente | Aceite |
|---|---|---|---|---|
| A4.1 | Leitores de `yt_own_video_reach_daily` e `yt_own_video_daily` no carregador do canal próprio, com tipos | tabelas em `types/database.types.ts:9887` e `:10084`; RLS por `can_edit_site` (migration `20261009000001`, linhas 63-73); nenhum leitor existe hoje | os três estados de 16.6; sem linha de diário não é zero | teste de `load` por estado (com impressão, zero medido, não medido) afirmando o valor nulo; conferência da Task 11 registrada |
| A4.2 | Página do canal próprio: cabeçalho, faixa de 6 e "Todos os números" de 11 (16.3) | 16.7 | inscritos, views por dia, retenção: frase com o motivo | selo "seu canal"; cabeçalho dentro do teto de 150 px; células sem base falham o teste |
| A4.3 | Grade e Lista do canal próprio, ordenação por impressões (16.4) | `youtube_videos` e A4.1 | "sem impressão no período"; "sem views diárias" uma vez só | cartão com três colunas e terceira linha em contagem de cliques, **sem corte e sem percentual por vídeo** |
| A4.4 | "Como o canal está" recolhida por padrão, frase única, vídeos que mais apareceram, "No nicho", "O que ainda não é medido" (16.5) | A4.1; posição (pergunta 8) | volume pequeno: a frase diz que é pouco para concluir | recolhida por padrão; estado lembrado com try/catch; `?painel=` abre e fecha |
| A4.5 | Gráfico de impressões por dia com três estados e uma cor cada, legenda, tabela, dica por dia, repintura ao redimensionar (16.6) | A4.1 e `yt_reporting_reports` (dia do relatório, a conferir) | dia sem relatório: coluna hachurada rosa | os três estados nunca se confundem em escala de cinza; a tabela tem todos os dias; teclado percorre os dias |
| A4.6 | Tela do vídeo próprio: cabeçalho, paginador na ordem da lista de origem, faixa com rótulo e ⓘ com a conta (17.1, 17.2) | `youtube_videos`, `multiplier.ts` | célula sem base não existe (teste) | Anterior apagado no primeiro, Próximo no último; `[` e `]` só com o foco certo; o ⓘ abre com a conta feita |
| A4.7 | "Este vídeo no canal": frase-resumo e uma régua por número (17.3) | valores dos vídeos do canal | vídeo sem o dado fora da contagem ("de 33"); sem impressão: frase e nada mais | um traço por vídeo; terço pela posição média; duração neutra; cor nunca sozinha; texto só para leitor de tela por régua |
| A4.8 | Cartão da forja "ainda não disponível" no vídeo próprio (17.4) | nenhum (não há pacote) | é o próprio estado | botão apagado com `aria-disabled`; sem etapas |
| A4.9 | Linha "Só o seu canal mede" na comparação (18.6) | A4.1 | some quando nenhum lado é canal seu | impressões, cliques estimados e relatórios em contagem, sem percentual |

### 4.3 Regras que valem em todas as fases
Validação autenticada do CMS antes de promover (`docs/ops/runbook-cms-e2e-local.md`); nunca passar `next/link` nem componente importado num Server Component como prop para componente cliente; server actions por props; teste que muda no mesmo commit; horários em São Paulo; sem entidade "criador"; TikTok fora; nenhum `color-mix()`. Detalhe em 19.4. Os itens A11 e A12 da v8 (padrão de 30 dias e "nada do Histórico se perde", agora A2.4 e A2.5) mexem numa tela que está em produção e é aberta também a partir de Mudanças, Outliers e Insights; o plano trata os dois como mudança de comportamento para todas as origens.

## 5. Página do canal
Aprovada no mockup (`canal.html`, rodadas 1, 3, 4, 5 e 11) para canal de concorrente. O canal próprio tem a seção 16. Os números dos wireframes são os do canal do mockup (Leo Khev, 133 vídeos guardados, 50 acompanhados).
### 5.1 Wireframe, 1440×900 (concorrente, vista Capas, que é a vista padrão)
```
 Canais › Leo Khev                                       Meu canal: tnFigueiredo ▾   Horários em São Paulo
 (av) Leo Khev  [Viagem ▾]               [Abrir no YouTube] [Comparar com o meu canal] [⋯]
  1,5 mil     +1,3%       0,2 + 0,1     0,3          15,7%         0
  inscritos   inscritos   longos+Shorts views/dia    engajamento   acima de 2×
              em 30 dias  por semana    nos longos   nos longos    em 90 dias
 Sincronizado há 4 h (07/10 18:03) · 133 vídeos: 50 acompanhados, 1 fixado antigo,
 82 mais antigos sem contagem diária                       [ⓘ] [Todos os números ▾]   (cabeçalho ≤ 150 px)
  Vídeos 133    Trocas 7 em 30 d    Leitura       133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado.
 ──────────────────────────────────────────────────────────────────────────────────────────────────────
 [Todos 133|Longos 61|Shorts 71|Fixados 3]  [Mais recentes ▾]  [🔍 Buscar por título   ]  [Capas|Lista]
 ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  ← ≤ 340 px
 │ thumb 16:9   🔍 │ │ thumb        🔍 │ │ thumb        🔍 │ │ thumb 📌     🔍 │ │ thumb        🔍 │    do topo
 │ 2 trocas   12:41│ │            Short│ │ formato não     │ │             8:02│ │ 1 troca    21:15│
 │ Título em até   │ │ Título em até   │ │ confirmado      │ │ Título…         │ │ Título…         │
 │ duas linhas     │ │ duas linhas     │ │ Título…         │ │                 │ │                 │    cartão
 │ há 3 d      [⋯] │ │ há 5 d      [⋯] │ │ há 9 d      [⋯] │ │ há 14 meses [⋯] │ │ há 22 d     [⋯] │    224 × 247 px
 │ 84 mil 6,1 mil  │ │ 1,2 mi  40 mil  │ │ sem contagem:   │ │ 310 mil         │ │ 12 mil  480     │
 │ views  views/dia│ │ views  views/dia│ │ ainda           │ │ views           │ │ views  views/dia│
 │        3,4× alto│ │ 8,2× muito alto │ │ sincronizando   │ │ fixado antigo:  │ │            0,6× │
 └─────────────────┘ └─────────────────┘ └─────────────────┘ │ sem views/dia   │ └─────────────────┘
 … segunda fileira inteira visível (10 cartões na carga) …   │ nem múltiplo    │
                                                             └─────────────────┘
 ── Sem data de publicação (2) ────────────────────────────────────────────────────────────────────────
 ── Mais antigos, sem contagem diária (82) ──────────────── (só aparece depois do primeiro "Carregar mais")
                     ┌──────────────────────────────────────────────────────────┐
                     │ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░                              │
                     │ Mostrando 51 de 133 vídeos                               │
                     │ Mais 40 vídeos antigos, sem contagem diária.             │
                     │ Depois deste lote faltam 42.                             │
                     │              [ Carregar mais 40 vídeos ]                 │
                     └──────────────────────────────────────────────────────────┘
 Múltiplo = views do vídeo ÷ mediana dos outros vídeos do mesmo formato e da mesma faixa de idade… (nota fixa)
```
No cartão real os três números ficam em **três colunas fixas**, com o valor em cima e o rótulo embaixo; o desenho acima só não tem largura para mostrá-las lado a lado. Ao rolar, só a linha de controles fica presa. Medido no mockup em 1440×900: na rodada 1, cabeçalho de 79 px e grade a 297 px do topo da tela simulada; com a faixa de números (rodada 5), cabeçalho recolhido de 101 px e grade a 319 px (meta ≤ 320) e 10 cartões inteiros na carga; com o respiro da rodada 11, cabeçalho de 109 px e a grade 18 px mais baixa (limite pedido: cerca de 24 px). Com "Todos os números" aberto o cabeçalho tem 247 px (rodada 5) e a grade começa a 465 px; a faixa recolhida é o padrão. A moldura do mockup é estática e copia a altura do mockup de 06/10, não o `YouTubeShell` real, e por isso o aceite A1.3 mede de novo com a moldura real; a soma 319 + 18 é INFERÊNCIA (a rodada 11 mediu o contêiner `#miolo`, de 350 para 368 px, outra referência).

Vista **Lista** (`ver=lista`): tabela, linha de 56 px, 9 linhas na carga no mockup (meta: 8 ou mais); o cabeçalho de coluna ordena. O bloco "Carregar mais" é o mesmo, no fim da tabela.
```
 Vídeo                                          Publicado  Views    Views/dia  Múltiplo         Curtidas  Comentários  Trocas
 [thumb 96 12:41] Como morar em Lisboa gast…    há 3 d     84 mil   6,1 mil    3,4× alto        2,1 mil   140          2
 [thumb 96 Short] 3 erros na imigração          há 5 d     1,2 mi   40 mil     8,2× muito alto  40 mil    não medido   0
```
### 5.2 Concorrente em ~390 px; o canal próprio está na seção 16
O canal próprio foi ao mockup nas rodadas 5 a 8, 11 e 12 e tem agora a seção 16 (página, faixa de números, grade com impressões, "Como o canal está") e a seção 17 (vídeo). O texto da v7 que ficava aqui ("cartão do canal próprio: '1,2 mil views' e 'sem views diárias'") foi substituído por elas. Em canal próprio o carregador continua montando os vídeos sem série diária e sem versões de capa (5.10); a aba "Trocas" diz "Trocas dos seus vídeos ainda não são lidas nesta tela." e as trocas do canal próprio ficam no A/B Lab (`_canais/view-model.ts:319`).
```
 ‹ Canais                                   (~390 px)
 (av) Nomad Capitalist BR   [Viagem ▾] @nomadbr ↗
 212 mil inscritos │ +2,1% em 30 d             ← a faixa de números quebra em duas colunas, não rola
 1,5 + 3,0 longos e Shorts por semana │ 4,2 mil views/dia nos longos
 (demais células na mesma grade)
 Sincronizado há 6 h · 51 vídeos     [ⓘ] [Todos os números ▾]
 Vídeos 51 │ Trocas 7 em 30 d │ Leitura      ← abas e filtro rolam na horizontal; alvos de 44 px
 [Todos|Longos|Shorts|Fixados]  [Mais recentes ▾]  [Capas|Lista]  [🔍 Buscar…]     (nada fica preso)
 ┌ thumb 16:9 ──────── 12:41 ┐   uma coluna. Lista vira pilha: cada vídeo é um bloco
 │ Título em até duas linhas │   com rótulo e valor ("Views: 84 mil").
 └ 84 mil views  6,1 mil/dia  3,4× alto ┘
```
A largura de ~390 px foi ao mockup para concorrente. Diferença em relação ao desenho acima: a Lista vira pilha já abaixo de 820 px (duas colunas de blocos até 480 px, uma abaixo disso), porque nove colunas não cabem em 768 px sem rolagem horizontal. Nenhum alvo fica abaixo de 44 × 44 px com toque.
### 5.3 Cabeçalho (até 150 px; 109 px no mockup recolhido)
- **Linha 1:** avatar, nome (`h1`, Fraunces, 22 px), selo "seu canal" quando próprio (seção 16), nicho, @ com link externo **quando o canal tem um** (no painel de hoje o @ já é opcional, `_canais/channel-drawer.tsx:117`; o canal do mockup não tem). Os inscritos saíram da linha do nome e são a primeira célula da faixa (rodada 5). À direita: "Abrir no YouTube", **"Comparar com o meu canal"** (ao lado, não dentro do menu: é o caminho que o dono pediu para existir; abre a comparação, seção 18) e o menu ⋯ ("Sincronizar só este canal"; "Remover canal…" só para quem administra). `NicheSelect` é editável para todos em concorrente; em canal próprio é só leitura para a editora (`channel-drawer.tsx:116`).
- **Faixa de números (rodada 5; emenda 27).** Seis células sem cartão, com fio vertical entre elas, valor em JetBrains Mono em cima e rótulo em Inter 12 px embaixo, alinhadas ao nome do canal. Mais respiro que na rodada 5: nome para faixa 10 px (era 5), padding lateral de 20 px entre as células (era 14), faixa para "Sincronizado há…" 8 px (era 3), cabeçalho para abas 14 px (era 6); em 600 px ou menos o padding lateral é 14 px (rodada 11). Em 768 px a faixa quebra em três colunas iguais e em 390 e 320 px em duas; **quebra, não rola**, porque a rolagem lateral esconde números sem avisar (custo: em 390 px a grade começa a 784 px).
- **Os seis números da faixa** (cada um com a origem em produção):

| Célula | De onde vem | Situação |
|---|---|---|
| inscritos | `ObsChannel.subs`; arredondamento em `roundingOf` (`lib/youtube/observatorio/channels.ts`) | existe |
| inscritos em 30 dias (% e "≈ 0" dentro do arredondamento) | `channelStats().growth30` (`channels.ts:131-158`) | existe; sem duas contagens com 30 dias entre elas: "sem contagem de 30 dias atrás" |
| longos + Shorts por semana (13 semanas) | `cadence().pw` (`channels.ts:71-93`) | existe |
| views/dia nos longos (mediana) | `channelStats().vpdMedian` | existe; sem registro diário: "sem contagem diária ainda"; com menos de 3 vídeos, "n = 2" ao lado |
| engajamento nos longos | `channelStats().engagement` (`engagementOf`, `channels.ts:116`), por longo acompanhado de até 90 dias | existe; "nenhum longo em 90 dias" quando não há; o do mockup (15,7%) vem de 2 longos |
| vídeos acima de 2× em 90 dias | `channelStats().outliers90` | existe (no mockup soma longos e Shorts; em produção é por formato); a base ("0 de 2") está no ⓘ |

- **"Todos os números"** (botão com `aria-expanded`, estado em `?nums=1`): abre mais **12 células abaixo da linha de sincronização**, empurrando a grade, sem modal. "Trocas em 30 dias" mora aqui, não na faixa (emenda 28). As doze: trocas em 30 dias (`changes30`); views/dia por mil inscritos (`perMilSubs`); views/dia nos Shorts e engajamento nos Shorts (`channelStats(id, 'short')`); múltiplo típico em 90 dias (`typicalMult`, hoje sem tela); maior múltiplo em 90 dias (`bestOutlier`, `maxMultBelowMin`); desde o último vídeo (`lastUpload`); dia e hora em que mais publica (`cadence().habit`, `RULES.habit`); duração mediana dos longos, views somadas dos acompanhados, mediana de views de longos e Shorts e tema dominante (`RULES.theme`) são **derivados novos**, a conferir no plano. Sem tema: "sem tema ainda". Existe e **não entrou:** `vpd7Median` (`channels.ts:153`), porque com a série curta é o mesmo número de views/dia. Saiu "% dos vídeos de 90 dias acima de 2×" (a base está no ⓘ da contagem).
- **O ⓘ único**, "De onde vêm os números do canal", lista a base de cada número da faixa e, com "Todos os números" aberto, a dos outros doze, com a conta ("mediana em 14 longos, últimos 90 dias"; "de 1.510 em 07/09 para 1.530 em 07/10"). Ele e "Todos os números" ficam na linha de sincronização, à direita, e não no fim da faixa (na faixa tiravam largura e os rótulos quebravam).
- **Base fraca e sem base.** Mediana com menos de 3 vídeos (`RULES.weakBase`): o valor aparece com "n = 2". Sem base nenhuma: a frase ("nenhum longo em 90 dias", "horário variado (2 longos)", "sem tema ainda"), nunca zero nem traço. Os zeros que aparecem são medidos (0 acima de 2× entre 2 vídeos).
- **Linha de sincronização, em frase:** "Sincronizado há 4 h (07/10 18:03) · 133 vídeos: 50 acompanhados, 1 fixado antigo, 82 mais antigos sem contagem diária". As partes que valem zero somem da frase. Em `--warning-text`, começando por "Sincronização atrasada: a última foi…", quando a sincronização está atrasada; em `--danger`, com "Erro:", quando falhou.
- A linha de resultado ("133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado.") fica à direita das abas, na mesma linha, para não custar altura.
- Nenhum botão preenchido no cabeçalho.
### 5.4 Cartão de vídeo (vista Capas, 224 × 247 px em 1440)
Reaproveita `Thumb`, `.obs-out-ttl` (13,5 px, 2 linhas) e `MultBlock` compacto (`_outliers/outlier-card.tsx:35` e `:50`), com as props mínimas da seção 2. Muda:
- Sai o cartão principal de duas colunas (`.obs-out-lead`), o nome do canal, o chip de nicho, a régua e a frase "por quê".
- Grade de 5 colunas em 1440 px, própria desta página; a grade de Outliers (`minmax(232px,1fr)`) não é reaproveitada.
- Thumbnail em 16:9; ela e o título são um link só para o Histórico do vídeo.
- Três números em **três colunas fixas**, sempre na mesma ordem (views, views por dia, múltiplo), valor em cima e rótulo embaixo. O múltiplo leva a palavra do nível. A ordenação só muda qual coluna fica em `--text` com peso 600.
- Quando faltam views por dia **e** múltiplo, uma frase só ocupa as duas colunas: "views/dia e múltiplo: não medido" (ou "fixado antigo: sem views/dia nem múltiplo"). Duas células "não medido" lado a lado não cabem.
- O múltiplo é o do motor (`lib/multiplier.ts`), o mesmo número que o Histórico do vídeo mostra. Não há ⓘ no cartão: a base ("contra os longos do canal com 91 a 365 dias, n = 18") fica no topo do menu "Ações do vídeo" e na nota fixa sob a grade.
- Selos sobre a thumbnail, todos texto e nenhum controle: duração ou "Short", "fixado", "sem duração", "formato não confirmado", "sem data", "2 trocas".
- Um botão de lupa no canto da thumbnail, sempre visível (28 px; 44 px com toque), abre o visualizador (6.3). Ele fica fora da ordem de Tab (`tabindex="-1"`), para o cartão continuar com 2 paradas; quem usa teclado tem o item "Ampliar thumbnail" no menu.
- Um botão "Ações do vídeo" (⋯), sempre visível: "Fixar"/"Desafixar", "Ampliar thumbnail", "Abrir no YouTube", "Ver trocas"; no topo do menu, a base do múltiplo e o motivo de cada "não medido" do cartão. Curtidas e comentários ficam na Lista e no Histórico.
- Views por dia com **uma casa decimal abaixo de 10** ("0,3"), inteiro de 10 a 999, milhar de 1.000 em diante; zero exato é "0" (19.3, emenda 37).
- Todos os cartões têm a mesma altura, com ou sem dado.
### 5.5 Controles (uma linha; rótulos exatos)
- Grupo "Formato": "Todos 133", "Longos 61", "Shorts 71", "Fixados 3".
- Ordenação (select): "Mais recentes", "Mais vistos", "Maior múltiplo", "Mais views por dia". Na Lista, o cabeçalho da coluna faz o mesmo e inverte a direção.
- Busca: texto de apoio "Buscar por título"; botão "Limpar busca". Ignora acento e maiúsculas. Busca vazia dentro de um filtro diz quantos há em "Todos" e oferece "Buscar em Todos".
- Grupo "Vista": "Capas" (padrão), "Lista".
- A borda da busca e do seletor de ordenação usa `--dim`, e o contorno do segmento ativo usa `--muted`: ali a borda é o que identifica o controle, e os tokens de linha não passam de 3:1 (seção 11, linha 12).
- A linha de resultado fica à direita das abas (5.3). Com busca ativa ela diz "5 vídeos com “lisboa”". O anúncio para leitor de tela existe sempre (seção 11, linha 3).
- Divisores de fim de lista, com contagem: "Sem data de publicação (2)" em toda ordenação; "Sem contagem de views (1)" na ordenação "Mais vistos"; "Sem múltiplo ainda (6)" e "Sem views por dia ainda (4)" só na ordenação que depende do número. Filtro, ordenação e busca valem para o que está na tela; os vídeos antigos ainda não carregados não entram na conta dos divisores, só na frase do bloco "Carregar mais".
- Nota fixa sob a grade ou a tabela: o que é o múltiplo, os três níveis e como as views por dia são calculadas (média entre a primeira e a última contagem diária dos últimos 7 dias; a contagem diária existe desde 03/10 e só para os vídeos acompanhados).
### 5.6 "Carregar mais"
- **O que abre.** A página abre com os vídeos **acompanhados** do canal (os `video_limit` mais recentes, hoje 50; regra de `trackedVideoIds`, `lib/load.ts:456`) e com os fixados, inclusive o fixado antigo. No canal do mockup: 51 de 133.
- **O que falta.** Os outros são "mais antigos, sem contagem diária": a contagem de views deles é antiga e não há views por dia. Só entram pelo botão.
- **O bloco** fica centralizado no fim da grade ou da tabela, com borda e fundo: uma linha de progresso (`role="progressbar"`, 51 de 133); "Mostrando 51 de 133 vídeos" em destaque; a frase do que vem ("Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 42."; no último lote, "…Depois deste lote não falta nenhum."); e o botão, o único preenchido da tela, com 44 px de altura: "Carregar mais 40 vídeos" (no fim: "Carregar os últimos 2 vídeos" ou "Carregar o último vídeo").
- **Cada clique traz 40**, sob o divisor "Mais antigos, sem contagem diária (82)", com o aviso: "a contagem de views deles é antiga; não há views por dia, e o múltiplo é o de quando foram contados". Os antigos ficam sempre abaixo dos acompanhados, em qualquer ordenação.
- **Só botão.** Nada carrega sozinho ao chegar perto do fim. Motivos, do `LEIAME.md` (rodada 4): carregar ao rolar empurra o que a pessoa está lendo e tira a nota do rodapé do alcance; teclado e leitor de tela precisam do botão de qualquer jeito; os que faltam são os de menor valor; e o Voltar precisa reabrir a grade com os mesmos cartões.
- **Depois do clique:** a rolagem não se mexe; o foco vai para o primeiro cartão novo (sem rolar); o status anuncia "Mostrando 91 de 133 vídeos. 40 vídeos antigos carregados." (ou "…Não falta nenhum."); o botão some quando não falta nenhum.
- **URL:** o total de antigos carregados vai em `n` (`?n=40`), sem navegar.
- **Filtro ou busca que só casa vídeos antigos:** uma frase diz quantos há ("Nenhum dos vídeos acompanhados tem “japão”. Há 3 vídeos antigos, sem contagem diária.") e o bloco aparece.
### 5.7 Aba Trocas
Contagem na aba: "7 em 30 d" (título e thumbnail, a janela de 30 dias da seção 1). Título da seção: "Trocas de título e thumbnail nos últimos 30 dias". Uma frase no topo diz que o Histórico do vídeo é a tela que mostra o efeito de cada troca.
```
 ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
 │ [thumb 🔍]  Tailândia barrou a minha entrada          2 trocas neste vídeo                    │
 │                                                              [Abrir histórico do vídeo ›]    │
 │   O botão abre o histórico do vídeo todo. Cada troca abaixo tem o seu link e abre o          │
 │   histórico já nela.                                                                         │
 │   ⇄ Thumbnail trocada   vista pela 1ª vez há 2 d (05/10 14:22)                               │
 │     Antes: imagem anterior não arquivada      Agora: a thumbnail ao lado                     │
 │     No histórico, efeito em 7 dias: aguardando: 1 de 7 dias coletados, leitura em 13/10      │
 │                                                                       Abrir nesta troca ›    │
 │   ⇄ Título trocado      visto pela 1ª vez há 9 d (entre 28/09 09h e 28/09 15h)               │
 │     Antes: <título anterior>                  Agora: <título atual>                          │
 │     No histórico, efeito em 7 dias: sem série: a contagem diária começa em 03/10…            │
 │                                                                       Abrir nesta troca ›    │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Um cartão por vídeo**, mesmo quando as trocas dele não são vizinhas no tempo. Os cartões saem na ordem da troca mais recente de cada vídeo; dentro do cartão, as trocas ficam da mais recente para a mais antiga, cada uma com a sua data. No mockup, 7 trocas viram 5 cartões.
- **Um botão por cartão**, ao lado do título: "Abrir histórico do vídeo" (nome acessível "Abrir histórico do vídeo: <título>"). Com duas ou mais trocas ele abre o Histórico do vídeo todo, sem troca escolhida. Com uma troca só, abre já nela.
- **Um link por troca**, só em cartão com duas ou mais: "Abrir nesta troca ›", em texto sublinhado, sem forma de botão (nome acessível "Abrir o histórico do vídeo na troca de título de 28/09: <título>"). Em cartão com uma troca não há link: seria repetir o botão. O botão é o vídeo; o link é a troca.
- **Cada troca mostra:** o campo ("Título trocado" ou "Thumbnail trocada"); quando foi vista pela primeira vez (título tem a janela entre duas sincronizações; thumbnail tem o minuto); antes e agora (título: os dois textos; thumbnail: a imagem anterior quando foi arquivada, senão "imagem anterior não arquivada"); e a linha "No histórico, efeito em 7 dias: …", calculada pelo mesmo motor do Histórico (`lib/effect.ts`), sem número inventado: "aguardando: 1 de 7 dias coletados, leitura na terça, 13/10", "sem série: a contagem diária começa em 03/10…", "sem base: só há o primeiro registro diário…", ou o veredito quando existir.
- Título e thumbnail do cartão são links para o mesmo destino do botão (a thumbnail fica fora da ordem de Tab, por ser redundante). A linha de cada troca é clicável com o mouse. Um botão de lupa sobre a thumbnail abre o visualizador; aqui ele **é** uma parada de Tab (o limite de 2 paradas vale para o cartão da grade, não para este).
- O link "Ver as 7 trocas em Mudanças" continua no fim (`d.swaps.link`, `_canais/view-model.ts:498`).
- O pager do Histórico, vindo daqui, anda pelos vídeos que têm troca, na ordem dos cartões ("vídeo 3 de 5 com trocas de Leo Khev").
- Voltar: do botão do cartão, o foco volta para o botão; do link de uma troca, para o link dela; a rolagem é a mesma de antes.
- Aba vazia: "Nenhuma troca de título ou thumbnail nos últimos 30 dias."
- "Ver trocas", no menu "Ações do vídeo" de um cartão da grade, abre esta aba só com as trocas daquele vídeo (`video=<id>` na URL): uma linha diz "Só as trocas de “<título>”: 2 de 7" e oferece "Ver as 7 trocas do canal". Vídeo sem troca: "Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias."
- A descrição também é observada (o Histórico tem a raia "Descrição" e o painel de hoje fala em "título, thumbnail ou descrição", `view-model.ts:497`), mas a aba aprovada conta só título e thumbnail. Ver a pergunta 2 da seção 14.
### 5.8 Abas Leitura e Retenção
- **Leitura.** O mockup aprovado mostra o cartão da seção 7.1 no escopo do canal. Leitura própria do canal depende do trabalho de servidor de 7.3 e não entra na fase A. O que a aba mostra na fase A é a pergunta 1 da seção 14.
- **Retenção.** Só em canal próprio (seção 8). No mockup a aba existe e diz "Retenção ainda não coletada: chega com o lote L3."; o conteúdo real depende do lote L3 da coleta e não entra na fase A.
### 5.9 Vazios, erros e dado ausente
- Canal sem vídeos: "Este canal ainda não tem vídeos sincronizados." + "Sincronizar só este canal". Aba Trocas vazia: "Nenhuma troca de título ou thumbnail nos últimos 30 dias."
- Filtro ou busca sem resultado: "Nenhum Short neste canal." / "Nenhum vídeo longo neste canal." / "Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes." / "Nenhum vídeo com “<texto>”." + "Limpar busca".
- Id desconhecido, dentro da moldura e nunca 500: "Canal não encontrado. Ele pode ter sido removido." + "Voltar para Canais".
- Falha no miolo, com o cabeçalho no lugar: "Os vídeos não carregaram. Os números do cabeçalho são de 05/10 09:00." + "Tentar de novo".
- "Canal não encontrado" e a faixa "Erro: a última sincronização falhou" não foram ao mockup (12.3, item 4); as frases valem.
- O motivo de cada "não medido" fica no topo do menu "Ações do vídeo" do cartão, não num ⓘ (5.4).

| Dado ausente | Hoje | Na tela nova |
|---|---|---|
| Comentários nulos | viram 0 (`lib/load.ts:278`) | "não medido"; no menu "Ações do vídeo", "O YouTube não devolveu a contagem." |
| Curtidas nulas | sem engajamento | "não medido" |
| Marca de Short nula | entra como longo (`load.ts:240`) | selo "formato não confirmado"; conta em "Todos", fora de "Longos" e de "Shorts"; a linha de resultado mostra a soma |
| Vídeo sem data | some (`load.ts:234-235`) | entra no fim, sob "Sem data de publicação (3)", com selo "sem data", sem idade nem múltiplo |
| Duração nula | o selo some (`outlier-card.tsx:44`) | selo "sem duração" no mesmo canto |
| Fixado fora dos recentes | views congeladas, sem aviso | "fixado antigo: sem views/dia nem múltiplo", com a data da última contagem no menu "Ações do vídeo" |
| Fixado ainda não conferido | — | "aguardando a primeira sincronização" (`aguardando-primeira`) ou "o YouTube não devolveu este vídeo" (`sem-resposta`), de `pinState` (`lib/types.ts`) |
| Views nulas | "sem contagem: <motivo>" (`view-model.ts:229`) | a mesma frase, no lugar de views e de views/dia |
| Múltiplo sem base | "—" | VERIFICADO (`multiplier.ts:42-45`, `RULES.weakBase` = 3): com 1 ou 2 vídeos comparáveis o motor devolve o valor com "base fraca (n = 2)"; só sem nenhum vídeo comparável é nulo, e a tela diz "sem comparação: nenhum vídeo do canal na mesma faixa de idade". Vai para "Sem múltiplo ainda" só no segundo caso (emenda 38) |
| Canal em primeira sincronização | "Buscando vídeos" | faixa sobre a grade: "Sincronizando: 12 de 48 vídeos. Os números aparecem quando a sincronização terminar." (a palavra é "sincronizar", da seção 1) |
| Sincronização atrasada | só na célula | linha 3 em `--warning-text` + faixa "Atenção: dados de 04/10 09:02. A sincronização está atrasada." |
| Sincronização com erro | só na célula | faixa "Erro: a última sincronização falhou em 06/10 09:00. Os números são de 05/10." |
| Série ou capas de canal próprio | não existem | "sem views diárias" uma vez por tela, na nota e em "Ações do vídeo"; seção 16 |
| Vídeo fora dos acompanhados (mais antigo que os `video_limit` mais recentes) | não aparece no painel | só entra por "Carregar mais" (5.6); views com a data da contagem no menu; "views/dia e múltiplo: não medido" quando faltam os dois; no menu, "Este vídeo está fora dos 50 acompanhados, então não há contagem diária dele." |
| Views por dia zero medido | "0" | "0" (zero exato) ou uma casa decimal abaixo de 10 ("0,3"); nunca confundir com "não medido" (19.3) |

### 5.10 Trabalho no carregador (pré-requisito da grade)
- `ObsVideo.comments` passa a `number | null` (hoje `v.comment_count ?? 0`, `lib/load.ts:278`; o tipo é `comments: number`, `lib/types.ts:30`). Todo leitor é revisto.
- `ObsVideo.isShort: boolean | null` ao lado de `fmt` (hoje `v.is_short ? 'short' : 'long'`, `load.ts:240`).
- Lista e contagem dos vídeos sem data, por canal (hoje filtrados em `load.ts:234-235` e, nos próprios, `:304`).
- `loadChannelDataset(siteId, channelId)`: função nova, para um canal só (VERIFICADO em 10/10: a função não existe). A leitura por canal já existe e já traz **todos** os vídeos guardados do canal, não só os acompanhados (`loadChannelRows`, `lib/load-channel.ts:20`), e o cache por canal também (`cachedPack`, `lib/load-page.ts:59`, que hoje não é exportado). Falta a função que monta o conjunto de dados de um canal sem ler os outros, e reduz as leituras vivas (`loadLiveRows`) ao que a tela usa. O múltiplo só compara vídeos do próprio canal, então um canal basta.
- `ChannelVideoView`: campos brutos (id, título, `pub` em ms, views, `vpd7`, `mult`, `fmt`, `isShort`, `pinned`, `pinState`, `tracked`, `dur`, likes, comments, `swaps` dos últimos 30 dias, `thumbSrc` = blob atual ou `mqdefault`) e, ao lado, o texto já formatado. A v7 falava em "até 200 vídeos no pacote; 60 por vez"; passa a valer 5.6: acompanhados e fixados na carga, antigos de 40 em 40. Se os antigos já vêm no primeiro pacote ou são pedidos a cada clique é decisão do plano, com uma condição: o clique não pode mover a rolagem nem mostrar esqueleto de página inteira.
- `ObsVideo.tags` (a coluna já vem em `VIDEO_COLS`, `load.ts:71`, mas `rowsToDataset` não a mapeia) saiu da fase A: a seção de tags era da página de vídeo nova, que não é mais feita (seção 13).
- Canal próprio: série e capas passam a vir de `yt_own_video_daily` e `yt_own_video_reach_daily` (lote L2, em produção desde 09/10) e `yt_own_video_meta_daily` (L1a, em produção) do spec de coleta, por um **leitor novo** (A4.1; nenhuma tela lê essas tabelas hoje, emenda 40). Até lá valem as frases de 16.7. `youtube_video_analytics.views` é total de 90 dias e nunca alimenta "views por dia".
- Testes de `load`: um vídeo por caso (comentário nulo, marca nula, sem data, vídeo fora dos acompanhados, canal próprio sem série), afirmando o valor nulo, nunca o padrão.

## 6. Histórico do vídeo: a tela de produção, com três acréscimos
A v7 desenhava aqui uma página de vídeo nova. O dono a reprovou na rodada 2 do mockup, por ser mais pobre que a tela que já existe. Passa a valer: o clique num vídeo do canal de concorrente, ou numa troca, leva ao **Histórico do vídeo de produção** (`/cms/youtube/competitors/video/<id>`), e **nada dele se perde**. Entram três coisas: a chegada com a troca destacada (6.2), o visualizador de thumbnail (6.3) e o cartão novo da leitura da forja (6.5, fase A2, emenda 23). A moldura fica só com a trilha (emenda 25). O vídeo de canal próprio tem tela própria (seção 17). Mudam dois comportamentos: o período padrão do gráfico (6.4) e de onde vêm a trilha e o pager quando a pessoa chega pelo canal (6.5). O mockup aprovado é `video.html`, que copia a tela de produção e marca cada mudança com "rodada 3" ou "rodada 4".
### 6.1 O que a tela já tem e continua tendo
Conferido no código em 09/10 (`_historico/historico-screen.tsx:112-181`), nesta ordem:

| Parte | O que mostra | Onde está |
|---|---|---|
| Trilha e pager | origem › canal (quando veio de Canais) › "Histórico do vídeo"; "Anterior", posição na lista de origem, "Próximo" | `Crumbs`, `_historico/pager.tsx:7` |
| Cabeçalho | thumbnail atual com a duração; título; "Fixar vídeo" e "Abrir no YouTube"; o botão da forja; canal e nicho; views; "publicado há 257 dias (23/01 17:00)"; formato; sincronização; múltiplo com a base e o método; selos de fixado e de contagem de versões ("2 títulos", "Nenhuma troca registrada") | `section.vhead`, `historico-screen.tsx:118-151` |
| "Views por dia e cada troca" | a curva em degraus, o dia em coleta hachurado, as três raias alinhadas ao eixo (Título, Thumbnail, Descrição) com marcadores, janelas de sincronização e agrupamento de trechos densos, a legenda, o filtro de período e "Ver os registros diários em tabela" | `Timeline`, `_historico/views-chart.tsx:42`; raias em `Lanes`, `_historico/lanes.tsx:29` |
| Resumo por imagem | quando uma thumbnail voltou ao ar: tempo no ar e views por dia de cada imagem | `ImageSummary`, `_historico/image-summary.tsx` |
| "Antes e depois de cada troca" | botões de troca (ou a lista com filtros de campo e situação, a partir de 7 trocas), antes e depois, veredito e frase, com as regras de 7 dias e de trocas em sequência | `Compare`, `_historico/compare.tsx:47` |
| "Leitura da forja" | o cartão de hoje | `VideoReading`, `_historico/video-reading.tsx:90` |
| Versões | três seções: "Thumbnails" (cartões com período, tempo no ar e média de views por dia), "Títulos" (com a diferença por palavra) e "Descrições" (linha a linha) | `Versions`, `_historico/versions.tsx:23` |
| Estados | vídeo fora dos acompanhados (aviso `fx-notice` e só as raias), fixado ainda não conferido, vídeo não encontrado dentro da moldura, série curta, sincronização com erro | `HistState`, `_historico/view-model.ts:21`; `historico-screen.tsx:92-103` e `:153-165` |

As thumbnails **continuam** na seção "Thumbnails". A tira de capas no cabeçalho, a faixa "Resumo" de cinco células, a barra presa de seções e a linha de tags da v7 não são feitas.
### 6.2 Chegada pela troca
Vale quando a URL traz `troca=` (seção 3) e a troca existe neste vídeo.
- A troca chega **selecionada em "Antes e depois"**, com uma linha a mais no cartão: "Aberta pela aba Trocas do canal: <troca>, <quando>."
- Ela fica **marcada no gráfico** (a faixa e a linha do par selecionado, que a tela já desenha) e **na raia** dela (marcador com anel).
- **O foco vai para o marcador da troca** na raia. Se o marcador estiver fora da área visível, a página rola até ele; se não, não rola.
- O status lê: "Aberta a troca: <troca>, <quando>. Ela está destacada no gráfico, na faixa e em Antes e depois."
- Sem `troca=`, ou com um valor que não é deste vídeo: a tela abre como hoje, com o foco no título e o par padrão (`view.defaultPair`), sem mensagem de erro.
- A seleção é só o estado inicial: escolher outra troca na tela funciona como hoje e não muda a URL.
- Regra nova deste spec, que o mockup não exercitou: se a troca de `troca=` for mais antiga que o período padrão de 30 dias (6.4), o gráfico abre no menor período que a inclui. Ver a pergunta 3 da seção 14.

Hoje a seleção inicial é só `view.defaultPair` (`historico-screen.tsx:29`); não existe parâmetro de troca na rota.
### 6.3 Visualizador de thumbnail
Diálogo modal, aprovado na rodada 4 (`viewer.js` e `viewer.css` do mockup). Não existe em produção.
```
┌ Thumbnail: Tailândia barrou a minha entrada ────────────────────────────────────────────── ✕ ┐
│ ‹ Anterior    Capa B · 2 de 2    Próxima ›                          [Comparar lado a lado]   │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                                          │ │
│ │                              imagem (arrastar move; roda e pinça ampliam)                │ │
│ │                                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h                                     │
│ Exibindo maxresdefault.jpg, 1280×720 px (maior resolução disponível). Acima de 100% a imagem │
│ é aumentada: ganha tamanho, não detalhe.                                                     │
│ [−] [+] [Ajustar] [100%]                         [Abrir original em nova aba]  [Baixar]      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Diálogo:** `role="dialog"`, `aria-modal`, o fundo fica inerte, o foco fica preso (Tab e Shift+Tab giram), Esc fecha e o foco volta ao gatilho. Abre com o foco no título do diálogo.
- **Resolução da thumbnail atual:** pede `maxresdefault` (1280×720) ao YouTube; cai para `sddefault` (640×480), `hqdefault` (480×360) e `mqdefault` (320×180). A tela escreve o arquivo que carregou e o tamanho medido. Quando cai para uma menor: "o YouTube não tem versão maior deste vídeo". Sem rede: "A imagem não carregou."
- **Versão anterior arquivada:** mostra a imagem guardada, no tamanho em que foi guardada, e a linha de resolução diz isso. As arquivadas até 08/10 têm 480×360; as arquivadas depois podem ter até 1280×720 (`apps/web/src/lib/youtube/thumb-fingerprint.ts:84`, `ARCHIVE_VARIANTS`). Ampliar não dá detalhe a uma imagem pequena, e a tela diz.
- **Versão não arquivada:** sem imagem quebrada. Um quadro tracejado explica: "A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (<de> até <até>) saiu do ar antes disso, então não há imagem para mostrar nem para baixar." "Baixar" e "Abrir original" ficam apagados.
- **Zoom:** botões − e +; roda do mouse, em torno do cursor; pinça; arrastar para mover; clique duplo na imagem alterna "Ajustar" e 100%; "Ajustar"; "100%" (um pixel da imagem por pixel da tela); teclas `+`, `-`, `0` e `1`. Com o foco na imagem, as setas movem (com zoom) ou trocam de versão (sem zoom).
- **Versões:** com mais de uma versão de thumbnail, "Anterior" e "Próxima" ("Capa B · 2 de 2"), com a legenda de cada uma (período e tempo no ar). "Comparar lado a lado" abre duas imagens com um seletor "Comparar com"; nesse modo não há zoom (os botões ficam apagados e o contador diz "sem zoom").
- **"Abrir original em nova aba"** abre a resolução que está na tela. **"Baixar"** baixa o arquivo; se o navegador recusar, abre a imagem em outra aba e o status diz para salvar por lá. [INFERÊNCIA: não foi conferido se a política de conteúdo do site e o `i.ytimg.com` deixam a página buscar a imagem para baixar; `next.config.ts` só libera esse domínio para imagens. O plano confere antes de prometer o botão.]
- **Gatilhos**, seis:
  1. a thumbnail do cabeçalho do Histórico;
  2. as thumbnails de "Antes e depois";
  3. as thumbnails dos cartões da seção "Thumbnails" (as três com o ícone de lupa no canto e `role="button"`);
  4. a miniatura na raia Thumbnail do gráfico, por **clique duplo**. O clique simples continua levando ao cartão da versão (`onClip`, `_historico/lanes.tsx:108`, que chama `goVersion`, `historico-screen.tsx:66`), e a legenda do gráfico diz isso. Quem usa teclado chega à mesma imagem um Tab depois, no cartão da versão;
  5. o botão de lupa sobre a thumbnail de cada cartão da aba Trocas;
  6. na grade e na Lista do canal, o botão de lupa no canto da thumbnail e o item "Ampliar thumbnail" do menu "Ações do vídeo" (5.4).
- Aberto pela grade do canal ou pela aba Trocas, o visualizador abre na thumbnail atual e oferece as outras versões do mesmo vídeo, como no Histórico (conferido em `viewer.js` do mockup). A página do canal já tem esse dado: a leitura por canal traz as versões de título e de thumbnail de todos os vídeos (`lib/load-channel.ts:32`).
### 6.4 Gráfico: 30 dias por padrão
- O período padrão passa a ser **30 dias**. O seletor "7 d | 30 d | 90 d | tudo" aparece **sempre** que há gráfico. Hoje o padrão é o vídeo inteiro e o seletor só é oferecido com mais de 30 dias de série ou com a grade de thumbnails recolhida (`lib/rules.ts:20`, `rangeFromDays`; `_historico/view-model.ts:396-397`; `parseRange`, `_historico/many-versions.ts:16`).
- Na URL: sem `range` = 30 dias; `range=tudo` = desde a publicação. Hoje a tela tira o parâmetro quando o valor é "tudo" (`onRange`, `historico-screen.tsx:39`); isso inverte. Links antigos sem `range` passam a abrir em 30 dias, e é o que se quer.
- **A faixa "antes de 03/10, sem registro" fica.** A contagem diária por vídeo só existe desde 03/10; o trecho anterior aparece comprimido e hachurado, com o texto, e os eventos anteriores continuam nas raias, na escala comprimida. A produção já desenha esse trecho (`view-model.ts:834` e a legenda em `:971`). No mockup ele ocupa 34% da largura em 30 dias. [INFERÊNCIA: a proporção exata que a produção usa não foi conferida; a fase A não a muda.]
- Vale para toda origem (Mudanças, Outliers, Insights e Canais), não só para quem chega pelo canal.
- "Mostrar o vídeo inteiro", que a comparação oferece quando o filtro esconde todas as trocas (`onWholeVideo`, `historico-screen.tsx:173`), continua levando a `range=tudo`.
### 6.5 Leitura da forja, trilha e pager
- **Cartão da forja.** O cartão "Leitura da forja" passa a ser o da seção 7.1 (selo único, "Leu N vídeos e M trocas", evidências numeradas, "Do site", as situações de 7.2), no lugar do cartão de hoje (`VideoReading`). Fica no mesmo lugar da tela: depois de "Antes e depois", antes das versões.
- **Botão do cabeçalho.** "Pedir leitura à forja" continua no cabeçalho (`ForjaAskButton`, `_historico/video-reading.tsx:29`, na linha `.frow` de `historico-screen.tsx:129`) e passa a **rolar até o cartão, pôr o foco nele e enviar o pedido**, com o andamento em três etapas (7.4; emenda 24). Hoje ele já envia o pedido direto, sem sair do lugar (`video-reading.tsx:34-44`: chama `onAsk('leitura-video', …)`, mostra o aviso e faz `router.refresh()`); a mudança é rolar e focar o cartão e trocar o aviso pelas etapas. O que o botão diz em cada situação: "Pedir leitura à forja" (livre); "Pedindo…" (`aria-busy`, ponto que pulsa) enquanto o servidor responde; com pedido em andamento, "Leitura em andamento: ver", que só rola; com leitura pronta, "Ver a leitura", que só rola; depois de "Não deu", "Pedir leitura à forja de novo"; no limite do dia, "Ver a leitura" com a frase "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00." (o cartão mostra o botão apagado com a mesma frase). Se o servidor recusar, o botão volta ao estado livre e diz o motivo. O status lê, quando já existe uma situação: "A leitura da forja já tem uma situação; ela está logo abaixo." Os dois botões do Histórico (cabeçalho e cartão) enviam o mesmo pedido; só o do cartão conta como "o botão do cartão" (7.1).
- **Trilha vinda do canal:** "Canais › <canal> › Histórico do vídeo". O item do canal leva à página do canal (seção 3).
- **Moldura.** O Histórico do vídeo mostra só a trilha: sem as abas de seção e sem a barra de nicho, em qualquer origem (emenda 25). Hoje a página renderiza a moldura inteira (`video/[id]/page.tsx:33`, `ObservatoryChromeServer`) e um vídeo de outro nicho mostra o nicho dele só nesta tela (`nicheOverride`, R47). Sem a barra de nicho, o `nicheOverride` perde o uso e sai junto com o teste dele; a trilha é o caminho de volta para quem chega de Mudanças, Outliers ou Insights.
- **Pager vindo do canal:** anda pela lista de origem, passada em `ids=`, e a frase de posição a descreve. Da grade: "vídeo 7 de 51 de Leo Khev (longos, do mais novo ao mais antigo)", com o filtro e a ordenação que estavam ativos. Da aba Trocas: "vídeo 3 de 5 com trocas de Leo Khev (trocas dos últimos 30 dias, da mais recente à mais antiga)". Hoje, com `from=canais`, a frase é fixa em "(longos acompanhados, do mais novo ao mais antigo)" (`_historico/view-model.ts:593`); precisa passar a ler a origem em `back=`.
- **Anterior/Próximo** substituem a entrada do histórico do navegador e deixam o foco no botão; o status lê "Vídeo 8 de 51: <título>". `[` e `]` fazem o mesmo, só com o foco no título ou dentro do pager.
- **Voltar** (do navegador, ou o item do canal na trilha): devolve a página do canal na mesma aba, com a mesma rolagem, e o foco no cartão do último vídeo visto ou no botão ou link da troca (seção 3).
### 6.6 O que não entra agora
- **Canal próprio.** O vídeo de canal próprio tem tela própria (seção 17, fase A4): selo "seu canal", paginador, faixa de números, "Este vídeo no canal" e gráfico de impressões. A série diária de `yt_own_video_daily` aparece quando o leitor existir (A4.1); percentual assistido e a seção "Retenção" dependem do lote L3 e ficam fora da fase A (seção 8).
- **Dado ausente.** Os estados e as frases são os que a tela de produção já tem (6.1); a fase A não cria frase nova nesta tela, fora as de 6.2 e 6.3. A tabela de dado ausente da v7 valia para a página nova e saiu com ela.
- Do mockup, não foram exercitados com os dados do canal de exemplo, e por isso não contam como aprovados nem como reprovados: o veredito com número em "Antes e depois" (a série tinha 5 dias), o resumo por imagem e a lista de trocas com filtros. Os três são da produção e ficam como estão.

## 7. Forja
**Explicação, igual em todo cartão:** "A forja é um computador nosso que lê estes números e escreve uma leitura com as evidências. Não muda nada no canal. Leva de 10 a 25 minutos; pode sair desta página." Depois da primeira leitura publicada no escopo, recolhe no botão "O que é a forja?".
### 7.1 Cartão de leitura
```
┌ Leitura da forja ─────────────────────────────────────────────────────────────┐
│ [O que é a forja? ▸]                                                          │
│ ◷ Aguardando: na fila desde 14:58, atrás do pedido de temas de IA.            │
│   atualizado há 1 min        [Cancelar pedido]  [Pausar atualização automática]│
│ ───────────────────────────────────────────────────────────────────────────── │
│ [forja · Gemma 12B · em treino · gerada 05/10 14:10 (SP)]    Leitura anterior │
│ Leu 31 vídeos e 7 trocas, dados de 05/10 09:00                                │
│ Texto da leitura em Fraunces, com as evidências numeradas¹ ²                  │
│ Do site: desde então, 2 vídeos novos e 1 troca. Ver os 2 vídeos               │
│                                      [Pedir nova leitura deste vídeo à forja] │
└───────────────────────────────────────────────────────────────────────────────┘
```
Um selo só, com "em treino" dentro dele; no ⓘ: "O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências." Sob o selo, "Leu N vídeos e M trocas, dados de dd/mm hh:mm". Os índices ¹ ² são links para o vídeo ou a troca citados. Um botão por cartão, o único preenchido em teal (`.obs-ch-forja-solid`).

| Escopo | Onde mora | Rótulo do botão (primeira vez / depois) | Tipo |
|---|---|---|---|
| Nicho | Mudanças | "Pedir leitura das trocas de <nicho> à forja" / "Pedir nova leitura das trocas de <nicho> à forja" | `resumo-trocas` |
| Canal | Canal, aba Leitura | "Pedir leitura deste canal à forja" / "Pedir nova leitura deste canal à forja" | `leitura-canal` (7.3) |
| Vídeo | Histórico do vídeo, cartão "Leitura da forja" | "Pedir leitura deste vídeo à forja" / "Pedir nova leitura deste vídeo à forja" | `leitura-video` |
| Padrões | Insights | "Pedir leitura de padrões de <nicho> à forja" / "Pedir nova leitura de padrões de <nicho> à forja" | `padroes-titulo`, `padroes-titulo-shorts`, `temas` |

**No Histórico do vídeo** há dois botões de pedido: o do cabeçalho ("Pedir leitura à forja"), que rola até o cartão, põe o foco nele **e envia o pedido** (6.5; emenda 24), e o do cartão, que também envia. Os dois são teal; só o do cartão conta como "o botão do cartão". Nos cartões de canal próprio e de comparação o botão fica apagado, com "ainda não disponível" (17.4, 18.8).

**Leitura sem efeito medido.** A contagem diária por vídeo começa em 03/10 e a comparação pede 7 dias depois da troca, então por semanas nenhuma troca terá efeito medido. Nesse caso a leitura:
- abre com o que fazer, antes de qualquer constatação: "O que fazer: esperar 7 dias depois da troca antes de tirar conclusão; a leitura da mais recente fica possível em 13/10." A data é a do motor de efeito, a mesma de "Antes e depois";
- pode citar o desempenho anterior à troca, quando existe ("Antes da troca, o vídeo ganhava 3,0 views por dia (média de 2 dias de registro, até 05/10)"), e diz "não há registro diário" quando não existe;
- nunca afirma causa: toda frase que cita uma troca termina com "não prova causa";
- só cita o que a forja recebe de concorrente: views públicas, títulos, thumbnails, datas e trocas. Nada de CTR, retenção, impressões, curtidas ou comentários.

Isso é regra para o texto que a forja escreve e para o que o validador aceita; o site não reescreve a leitura. Todo texto de leitura do mockup foi escrito à mão, como exemplo: a forja ainda não produziu uma leitura real em produção.

**Quem vê os botões:** quem pode editar o site (o dono e a editora) vê e usa os quatro e "Cancelar pedido" (conferido em 09/10: pedir e cancelar passam pelo mesmo guarda de edição do site, `sessionContext`, `forja-actions.ts:28-33`). O botão do rodapé do painel de canal, que pede `resumo-trocas` do nicho inteiro sob rótulo de canal (`_canais/drawer-forja.tsx:39`), sai junto com o painel de concorrente (emenda 26); enquanto o painel existir, ele fica como está.

Texto sob o botão apagado:
- Antes do primeiro pedido (botão aceso): "Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje."
- Leitura por canal: "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo."
- Pedido em andamento: "Há um pedido de 06/10 14:58 ainda em andamento."
- Limite do dia usado (um por tipo e nicho, `lib/forja/quota.ts`): "Já houve uma leitura de Viagem hoje. Libera amanhã às 00:00."
### 7.2 Quatro situações
A pessoa vê uma de quatro situações; o estado do código vira o detalhe da frase. Quando há pedido em andamento, o cartão mostra também as **três etapas** de 7.4.

| Situação | Estado no código (`lib/forja/states.ts:33`) | Frase | Ação |
|---|---|---|---|
| Aguardando | na fila | "Aguardando: na fila desde 14:58." | "Cancelar pedido" |
| | trabalhando | "Aguardando: a forja está escrevendo desde 15:00. Leva de 10 a 25 minutos." | — |
| | nova tentativa | "Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo às 15:30." | — |
| | liberado pelo vigia | "Aguardando: o pedido travou e voltou para a fila sozinho, às 15:30." | — |
| Aguardando, com atraso | atrasado | "Aguardando, com atraso: esperando há 40 min, mais que o normal. Se passar de 15:40, a tela avisa aqui." | "Cancelar pedido" |
| | sem máquina | "Aguardando, com atraso: a forja está desligada ou sem internet desde 13:40. O pedido fica guardado e roda quando ela voltar." | "Cancelar pedido" |
| Pronta | publicado | "Pronta: leitura publicada às 15:18." | — |
| Pronta, mas desatualizada | publicado, com troca ou vídeo novo depois da leitura | "Pronta, mas desatualizada: depois que ela foi escrita, saíram 3 trocas." (faixa âmbar, ícone próprio) | "Ver as 3 trocas", que abre a aba Trocas do canal; "Pedir nova leitura…" |
| Precisa de você | recusado (dado velho) | "Precisa de você: os dados deste canal são de 02/10, antigos demais para ler." | "Sincronizar este canal"; depois, "Pode pedir de novo." |
| Não deu | falhou | "Não deu: o texto citava números que não batem com os dados, em todas as tentativas. Pode pedir de novo." (travamento: "Não deu: o pedido travou 3 vezes. Pode pedir de novo.") | "Pedir de novo" |
| | publicado, sem itens nem evidência | "Não deu: a leitura saiu sem evidências. Pode pedir de novo." | "Pedir de novo" |

A linha "Pronta, mas desatualizada" foi pedida pelo dono na rodada 2 do mockup; é estado de tela, derivado de "Do site: desde então…" (hoje `r.since`, `_historico/video-reading.tsx:79`). "Aguardando, com atraso" é a variante de atenção de "Aguardando" (`--warning-text`, ícone de relógio com aviso). "Precisa de você" e "Não deu" usam `--danger` e ícone de aviso (grupos `WARN_STATES` e `DEAD`, `_chrome/forja-view-model.ts:115-116`). A última linha é estado de tela, derivado da leitura (hoje a frase de `forja-view-model.ts:208`). As palavras "cota", "vigia", "validador" e "conferência" não aparecem em tela.
### 7.3 Trabalho de servidor da leitura por canal (plano próprio)
Nada desta lista existe hoje. Até existir, o botão de canal fica apagado.
1. **Tipo `leitura-canal`.** O CHECK de `task_type` em `youtube_intelligence_tasks` aceita seis valores, e a regra `(task_type = 'leitura-video') = (target_video_id is not null)` recusa alvo novo (`supabase/migrations/20261003000004_observatorio_forja.sql:24-31`). Não há coluna de canal-alvo na tarefa nem em `competitor_readings` (`load.ts:510`). Migration com `npm run db:new`.
2. **Listas de tipos:** `OBS_TYPES` (`apps/web/src/lib/pipeline/services/forja-queue.ts:32`), `OBS_TASK_TYPES` (`load.ts:101`), `TYPE_SHORT` (`states.ts:107`).
3. **Limite por canal** em `lib/forja/quota.ts`, que hoje conta por tipo e nicho, e por vídeo só em `leitura-video`.
4. **Pacote de canal** em `lib/forja/sent.ts` (`buildSentCtx` só conhece vídeo e nicho, `sent.ts:151-160`).
5. **Capacidade anunciada:** a forja escreve o tipo em `forja_heartbeat.capabilities` (`lib/types.ts:99`); o kit da forja é do dono.
6. **"Só se os dados mudaram":** precisa de um marcador (comparar o conteúdo de `items` do pacote com o da última leitura do escopo). Sem marcador, a regra não é mostrada.

### 7.4 Etapas do pedido (três)
Rodadas 5 e 7. Com pedido em andamento o cartão mostra uma sequência de **três etapas**, na ordem: **Na fila, Escrevendo, Pronta**. A etapa atual tem o ponto que pulsa e as palavras "em andamento"; as concluídas têm o visto. Só a etapa atual se move; com `prefers-reduced-motion` o ponto para e as palavras carregam o sentido. Embaixo, a frase da situação (7.2) e a linha "Pedido feito há 16 min, às 21:59. Tela atualizada há 1 min. Pode sair desta página: o pedido continua.", com "Cancelar pedido" enquanto está na fila. Com pedido em andamento não há botão de pedir.

A versão de quatro etapas ("Conferindo os números") foi descartada pelo dono na rodada 7: o código só distingue 'na fila', 'trabalhando' e 'publicado', e a conferência do texto contra os dados acontece dentro de 'trabalhando'; uma quarta etapa seria algo que a tela não consegue observar. Se a forja um dia reportar a conferência, a etapa entra sem redesenho.

| Etapa | Estados do código (`forja/states.ts:33`, derivação em `:85-100`) | Variações |
|---|---|---|
| Na fila | 'na fila'; 'liberado pelo vigia' | 'atrasado' e 'sem máquina': a etapa fica em âmbar, "em andamento, com atraso" (ícone de relógio com aviso) |
| Escrevendo | 'trabalhando'; 'nova tentativa' | 'nova tentativa' acrescenta o detalhe "o texto citava números que não batem; a forja tenta de novo às 15:30". O detalhe ": conferindo os números" do mockup existe só como cenário simulado, porque o site só sabe da conferência pelo resultado (`failKindOf`, `states.ts:177-179`) |
| Pronta | 'publicado' | sem etapas quando a leitura está pronta: a frase "Pronta: leitura publicada às 20:18." e a própria leitura bastam |

"Não deu" marca em vermelho a etapa em que o pedido parou: "Escrevendo, parou aqui" para o pedido que travou (`failKindOf` = 'travou'); "Escrevendo, parou aqui, ao conferir os números" para números que não batem e para leitura sem evidências (`validador`). 'recusado (dado velho)' ("Precisa de você") não é etapa: é a situação de 7.2. **Observação VERIFICADA:** no código, 'nova tentativa' e 'liberado pelo vigia' são linhas `pending` com `retry_count > 0` (`states.ts:94-99`), isto é, voltaram para a fila; o mockup mostra a primeira em "Escrevendo" porque a máquina já trabalhou nela, e a segunda em "Na fila". É escolha do mockup aprovado; o plano confirma com o dono se prefere "Na fila" para as duas.

"Tela atualizada há 1 min" é texto, a situação anuncia (`polite`) só quando muda, e há o botão "Pausar atualização automática" (seção 11, linha 14). O clique real no mockup percorreu fila (2,2 s), escrevendo (2,6 s) e pronta; a simulação é do mockup, em produção as etapas seguem a fila.

## 8. Retenção dos canais próprios
Fora da fase A: depende do lote L3 da coleta (seção 4.1). Em 10/10 a coleta tem L1a, L1b e L2 em produção (`yt_own_video_daily` e `yt_own_video_reach_daily`, migration aplicada em 09/10); o mockup mostra a aba e a seção só como "ainda não coletada" e o desenho completo da Retenção continua sem mockup (12.3).
Cabeçalho da aba e da seção: "Retenção · datas no dia do YouTube ⓘ" ("O YouTube fecha o dia no horário do Pacífico, não em São Paulo"; `day_pt`, spec de coleta, seção 1). Datas de tentativa são outra coisa e dizem "coleta de 05/10".
### 8.1 Aba Retenção: "views boas, retenção ruim"
```
 Retenção · datas no dia do YouTube ⓘ        % assistido e views: os 90 dias até 05/10.
 Faixa de duração    Vídeos   Normal da faixa (mediana de % assistido)
 Short               12       71%
 Até 5 min            3       poucos vídeos para comparar (3; precisa de 5)
 5 a 15 min           9       42%
 Acima de 15 min      6       31%
 Sem faixa            5       duração ou formato ainda não coletados
 Views acima do normal do canal e % assistido abaixo do normal da faixa: 4 vídeos
 Vídeo                                  Faixa       Views nos 90 dias  % assistido          Contra a faixa
 [thumb 12:41] Como morar em Lisboa…    5–15 min    84 mil             33%                  9 pontos abaixo (normal da faixa: 42%)
 [thumb  3:10] Mala de mão: o que levar até 5 min   51 mil             38%                  poucos vídeos para comparar
 [thumb 18:22] Roteiro de 7 dias…       > 15 min    40 mil             sem dado: vídeo novo sem comparação
```
- **Antes de 28 dias:** "Coletando: 9 de 28 dias. A comparação por faixa aparece em 26/10. Os percentuais de cada vídeo já aparecem na página dele." N = dias distintos com linha em `yt_own_video_daily` do canal.
- **Comparação por faixa:** exige N ≥ 28 e 5 ou mais vídeos na faixa. Abaixo disso, "poucos vídeos para comparar (3; precisa de 5)"; os vídeos aparecem com o próprio percentual e ficam fora da contagem "4 vídeos".
- **Faixa:** a de Short vem de `yt_own_video_meta_daily.is_short`; as outras, de `duration_seconds`. Vídeo sem um dos dois fica em "Sem faixa (5)".
- **Views da lista:** as da mesma janela de 90 dias do percentual, nunca o total da vida.
### 8.2 Seção Retenção na página do vídeo próprio
```
 Retenção · datas no dia do YouTube ⓘ        curva da vida inteira do vídeo, coletada em 05/10   [Ver como tabela]
 100% ┤█▇
      │  ▆▅▅▄▄▄▃▃▃▃▃▃▂▂▂▂▂▂▃▄▃▂▂▂▂▂▂▁▁▁▁
   0% └┬────────┬────────┬▲───────┬────────┬      ▲ trecho reassistido
      0:00     3:10     6:20     9:30    12:41
 % assistido: 33% nos 90 dias até 05/10   (normal da faixa 5–15 min: 42%)
 O número é dos últimos 90 dias; a curva é da vida inteira do vídeo. As janelas são diferentes.
 Trechos reassistidos:  6:05 a 6:40, vistos 1,3 vez em média   Abrir neste ponto no YouTube
 Maiores saídas:  0:00 a 0:25, de 100% para 71%;  3:00 a 3:20, de 58% para 49%;  9:10 a 9:30, de 31% para 26%
```
Trecho reassistido = pontos seguidos com `ratio` acima de 1 em `yt_own_video_retention.points`. Nenhum: "Nenhum trecho reassistido." `point_count` menor que 100: "Curva com 37 de 100 pontos: o YouTube devolveu só parte."
### 8.3 De onde vem cada número, e o que dizer quando falta
- **% assistido:** `youtube_video_analytics.avg_view_percentage`, total da janela de 90 dias na data da coleta. A tela sempre mostra a data. **Curva:** `yt_own_video_retention`, `window_kind = 'vida'`.
- **Impressões e CTR:** `yt_own_video_reach_daily`, valor de **um** dia, o último com linha ("em 04/10"). A unidade está fixada: no CSV real `thumbnail_ctr` vem de 0 a 1; a tela multiplica por 100 e mostra percentual com uma casa ("4,2%"). O CSV **não tem coluna de cliques**. A tela mostra a **contagem estimada** (impressões × CTR por dia e vídeo, somados), sempre rotulada "estimados", em contagem, **sem corte de volume e sem percentual por vídeo** (emenda 36; 19.3). Nunca estima o CTR de um vídeo a partir dos cliques estimados.
- **Views:** `youtube_video_analytics.views` é o total da janela de 90 dias, regravado a cada dia, não a contagem do dia. Nunca aparece como "views por dia" nem é somado entre dias. Views por dia de vídeo próprio só existem a partir de `yt_own_video_daily`.
- Canal com `youtube_channels.collection_status = 'reautorizar'`: faixa "Erro: o YouTube pede nova autorização deste canal. A coleta parou em 02/10." Quem administra vê "Reconectar"; a editora vê "Peça a quem administra para reconectar este canal."

| `yt_own_collection_attempts.outcome` | Frase no lugar do número |
|---|---|
| sem linha de tentativa | "coleta ainda não iniciada" |
| `ok`, com o valor nulo | "o YouTube não devolveu este número" |
| `sem_dado_na_janela` | "sem dado: o YouTube não tem números para este período" |
| `video_novo` | "sem dado: vídeo novo (menos de 3 dias)" |
| `sem_conexao` | "sem dado: o canal não está conectado" |
| `sem_autorizacao` | "sem dado: o canal precisa de nova autorização" |
| `erro_http` | "sem dado: o YouTube respondeu com erro na coleta de 05/10; nova tentativa amanhã" |
| `nao_alcancado_orcamento` | "sem dado: a coleta de 05/10 não chegou a este vídeo; ele entra na próxima" |
| `schema_ausente` | "sem dado: falha interna na coleta de 05/10" |

Para concorrentes, nenhum texto usa a palavra "retenção".

## 9. A/B Lab
Regras: spec do A/B, seções 3 e 4. Aqui só as telas. Caminhos em `ab-lab/_components/`. Horários em São Paulo (a rotação é às 05:00); só a linha de datas das views é "dia do YouTube".
### 9.1 Acompanhamento sem confiança
```
 Teste: Título + thumbnail   mede o conjunto; não separa título de thumbnail.            no ar há 9 dias
 Ainda não dá para comparar: C tem 1 dia inteiro no ar; precisa de 3.
 Views por dia, nos dias em que a variante ficou o dia inteiro no ar (dia do YouTube ⓘ)
                               30/09   01/10   02/10   03/10   04/10   05/10   06/10   07/10     Views/dia  Dias válidos
 A (original) [thumb] Como…    5,9 mil                 5,6 mil                 5,9 mil            5,8 mil    3
 B            [thumb] Lisboa…          6,6 mil                 6,1 mil                 6,5 mil    6,4 mil    3
 C            [thumb] Morar…                   5,1 mil                 descartado                 5,1 mil    1
 9 dias de teste: 7 válidos, 1 descartado por troca atrasada, 1 sem medição.
 Cada variante foi medida em dias diferentes; vídeo novo perde views sozinho, então a ordem da rotação pesa.
```
- **Calendário:** linhas = variantes, colunas = dias. Célula com valor = dia válido; célula vazia = fora do ar; "descartado" e "sem medição" escritos na célula. Definição de dia válido: spec do A/B, 4.2.
- **Três contagens:** dias válidos, "N dias descartados por troca atrasada", "N dias sem medição". Teste anterior à coleta mostra só "sem medição".
- **Destaque:** só quando todas as variantes têm 3 ou mais dias válidos. A de mais views por dia ganha o rótulo "mais views/dia até agora". Nunca "líder", "vencedor", diferença percentual ou intervalo. Abaixo disso, a frase diz o que falta, como no wireframe.
- Saem "Impressões", "CTR", todo número de confiança, as curvas, o medidor, os gates e "será aplicado automaticamente".
### 9.2 Diálogo "Encerrar teste"
Hoje: "Aplicar variante lider" (a primeira da lista, `ab-end-test-dialog.tsx:35-36`), "Manter original" e "Arquivar sem aplicar" com "Encerra o teste e mantem o que esta no ar" (`:78-79`).
```
┌ Encerrar teste ───────────────────────────────────────────────────────── ✕ ┐
│ A rotação para. No ar agora: variante C, desde 07/10 05:00.                 │
│ O que fica no vídeo?                                                        │
│ ( ) [thumb] A (original)  Como morar em Lisboa gastando pouco em 2026       │
│ ( ) [thumb] B  Lisboa por R$ 4 mil por mês                                  │
│             mais views/dia até agora: 6,4 mil em 3 dias. Pode ser acaso.    │
│ ( ) [thumb] C  Morar fora barato                             no ar agora    │
│                                              [Cancelar]  [Encerrar]         │
└─────────────────────────────────────────────────────────────────────────────┘
```
- Uma opção por variante, a original primeiro, nenhuma marcada. "no ar agora" marca a que está. A linha "mais views/dia até agora" só existe com o destaque de 9.1.
- O botão "Encerrar" fica desabilitado até a escolha e passa a nomeá-la: "Encerrar e ficar com B" / "Encerrar e ficar com A (original)". Enviando: "Encerrando…".
- Sem nota prévia sobre edição externa. Só se o servidor responder `precisa_confirmar`, o corpo vira: "O título no YouTube não é de nenhuma variante: alguém editou por fora." + os dois títulos lado a lado ("No YouTube agora" e "Variante B") + "Voltar" e "Trocar pelo título de B e encerrar". Para thumbnail, o mesmo com as duas imagens.
- Escolhendo a original, a edição externa fica como está e a faixa de 9.4 avisa depois.
- Original guardada pequena: "O original foi guardado em baixa resolução.", sob a opção A.
- Quem não administra vê só a opção A e a nota que já existe (`AdminOnlyNote`). Resposta `em_andamento`: "Outra tentativa está em andamento. Tente de novo em instantes." Erro do servidor fica escrito no diálogo.
### 9.3 Depois de encerrado ou pausado
- Ficou uma variante: "Encerrado · variante B no ar desde 07/10 05:00", com o botão "Voltar ao original" até a data de `revert_expires_at` ("disponível até 14/10"), só para quem administra.
- Ficou a original, por escolha: "Encerrado sem vencedor". Por duração máxima: "Encerrado sem vencedor: o prazo acabou". Nunca aparece como playoff.
- Pausado por falha do YouTube ou por edição externa: faixa "Atenção: teste pausado. O YouTube recusou a troca das 05:00." (ou "Alguém editou a thumbnail fora do teste.") + o que aconteceu com título e thumbnail (a faixa de 9.4) + "Retomar".
### 9.4 Faixa de restauração
Lida de `ab_tests.restore_status`, por campo (`title`, `thumbnail`), com `destino` e `motivo`. Uma linha por campo quando os estados diferem. Com `destino` original a frase diz "não voltou ao original"; com `destino` variante, "O título da variante B não foi aplicado".

| `estado` | Faixa | Ações |
|---|---|---|
| `falhou` | "Erro: o título não voltou ao original: o YouTube recusou em 07/10 05:02. Nova tentativa automática na próxima verificação." | "Tentar agora", "Já corrigi no YouTube: dispensar aviso" |
| `desistiu` | "Erro: a restauração falhou 3 vezes e parou. O título no ar ainda é o da variante B." | as duas, e "Abrir no YouTube Studio" |
| `pulado_drift` | "Atenção: a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado." | "Já corrigi no YouTube: dispensar aviso" |
| `pulado_drift`, motivo `sem_base_de_comparacao` | "Atenção: não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado." | idem |
| `pulado_sem_original` | "Atenção: o título original não foi guardado quando o teste começou. Nada foi alterado." | "Abrir no YouTube Studio para conferir", "Já corrigi no YouTube: dispensar aviso" |
| `ok` | sem faixa; linha "Título e thumbnail voltaram ao original em 07/10 05:02." | — |

Permissão das ações: a de encerrar, quando o destino é o original; a de quem administra, quando o destino é uma variante.
### 9.5 Correções de texto na criação
O fluxo de 5 passos fica como está nesta versão. Mudam só os textos: todo o fluxo em pt-BR ("Remove variant", "Title for variant", `step-variantes.tsx:334,423`; "Untitled", `ab-create-wizard.tsx:545`; "MAX. 4 VARIANTES", `step-variantes.tsx:648`, viram "Remover variante B", "Título da variante B", "Sem título", "Até 4 variantes"); o tipo combo se chama "Título + thumbnail", sem selo "recomendado"; somem o interruptor e a frase de aplicação automática. Todo `alert()` (`active-detail.tsx:100,150,161,192-209`; `winner-detail.tsx:51,94`) vira faixa de erro na página.

## 10. Contrato de carregamento
Causas de hoje: as cinco páginas são `force-dynamic` (`page.tsx:16` e as quatro irmãs); cada filtro é uma navegação; `loading.tsx` troca a página inteira por um esqueleto de outra forma; o painel muda o grid (`canais.css:315`). A rota `canal/[id]` usa `loadChannelDataset` (5.10), sobre o cache por canal que já existe (`unstable_cache`, tag `observatoryTag(siteId)` = `observatorio:<siteId>`). A meta de 1 s vale depois dessa função, com cache quente; o plano mede fria e quente e registra as duas.

| Navegação | O que acontece | Alvo | Indicador |
|---|---|---|---|
| Canais → Canal | pré-carga depois de ~150 ms de hover ou foco, no máximo 3 em andamento; a trilha fica; o cabeçalho abre com nome, avatar, nicho e inscritos que a linha tinha | < 1 s (quente) | até 100 ms, nada; depois esqueleto na forma final: 3 linhas de cabeçalho e cartões 16:9 |
| Filtro, ordenação, busca, vista | no navegador, sobre os campos brutos; URL atualizada sem navegar | < 100 ms | nenhum; o status anuncia |
| Troca de aba do canal | Vídeos e Trocas vêm no mesmo pacote; Leitura e Retenção carregam à parte | < 100 ms / < 1 s | esqueleto do miolo após 100 ms |
| Canal → Histórico do vídeo | pré-carga igual; título e duração imediatos. A transição da thumbnail do cartão para o cabeçalho não foi ao mockup e fica para depois (seção 13) | < 1 s (quente) | esqueleto na forma da tela de produção: cabeçalho e bloco do gráfico na altura final |
| "Carregar mais" | 40 cartões entram sob o divisor; a rolagem não muda; o foco vai para o primeiro cartão novo | < 100 ms se os antigos já vieram no pacote; < 1 s se forem pedidos | nenhum abaixo de 1 s; nunca esqueleto de página inteira |
| Abrir o visualizador | o diálogo abre na hora, com a imagem que já está na tela; a maior resolução entra quando carregar | < 100 ms para abrir | a linha de resolução diz qual arquivo está na tela |
| Anterior / Próximo | o vizinho é pré-carregado quando a página assenta; a trilha e o pager ficam; o miolo anterior continua visível, esmaecido | < 300 ms | barra fina no topo só depois de 300 ms |
| Voltar | o navegador restaura a rolagem; a URL restaura filtro, ordenação, vista e quantidade | imediato | nenhum |
| Pedir leitura | o botão vira situação na hora (rola, foca o cartão, mostra a etapa Na fila); se o servidor recusar, volta e diz o motivo | < 100 ms | linha de situação |
| Canais → Comparação | pré-carga como Canais → Canal; a trilha fica | < 1 s (quente) | esqueleto na forma final: cabeçalho de lados e tabela |
| Trocar o seletor de um lado da comparação, "Inverter lados" | no navegador; URL atualizada sem recarregar | < 100 ms | nenhum; o `role="status"` anuncia |
| Abrir ou fechar dica, popover ou menu; abrir "Como o canal está" | no navegador, sem rede | < 100 ms | nenhum |

Regras: abaixo de 1 s, nenhum indicador; esqueleto com a mesma forma e altura do conteúdo; conteúdo anterior na tela durante a transição; `loading.tsx` por rota, cobrindo só o miolo.
**Regra de implementação.** Todo `Link` da grade, da lista e do pager é importado dentro de módulo `'use client'`, no modelo de `apps/web/src/app/cms/(authed)/_shared/cms-link.tsx`; nunca passado como prop a partir de Server Component. Server actions (fixar, pedir leitura, encerrar teste) chegam aos componentes cliente por props.

## 11. Acessibilidade
| # | Critério | Regra | Como testar | Bloqueia o mockup? |
|---|---|---|---|---|
| 1 | Foco não encoberto (2.4.11) | Na página do canal só a linha de controles fica presa, e só com largura ≥ 768 px **e** altura ≥ 600 px; fora disso, fluxo normal e `--obs-sticky-h` = 0. O Histórico do vídeo não tem barra presa. Todo alvo de foco com `scroll-margin-top` = `--obs-sticky-h` (medida por `ResizeObserver`) + 12 px. O foco nunca é cortado pelo `overflow` do cartão | Tab e Shift+Tab em 1440, 768 e 390 px e em zoom 200%: nenhum foco sob a barra nem cortado | Sim |
| 2 | Atalhos de tecla (2.1.4) | `[` e `]` valem só com o foco no título do vídeo ou dentro do pager; no visualizador, `+`, `-`, `0`, `1` e as setas só valem com o diálogo aberto; ignoram Ctrl, Alt e Meta; nenhum atalho global | digitar `[` no campo de busca: nada acontece | Sim |
| 3 | Filtro, vista e resultado (4.1.2, 4.1.3) | Filtro: `role="group"` "Formato", botões com `aria-pressed`, contagem no nome ("Longos, 31"). Vista: `role="group"` "Vista" com `aria-pressed`; ao trocar, o status diz "Vista Lista, 51 vídeos". "Ordenar" é `select` nativo. Status: `role="status"`, atômico, 500 ms depois da última tecla; nunca move o foco | leitor de tela: filtrar, buscar, trocar a vista; um anúncio por mudança | Sim |
| 4 | Capas e Lista (1.3.1) | Capas = `ul`/`li`. Lista = `table` com `th scope="col"`, botão dentro do `th` ordenável, `aria-sort` só na coluna ativa; anúncio "Ordenado por Views, decrescente". No DOM o rótulo acompanha o valor ("84 mil views") | navegar a tabela por célula no leitor de tela | Sim |
| 5 | Cartão (2.4.1, 2.1.1) | 2 paradas de Tab por cartão: o link thumbnail+título e o botão "Ações do vídeo: <título>". O selo "2 trocas" é texto. Menu no padrão menu button (`aria-haspopup`, `aria-expanded`, setas, Home, End, Esc devolve o foco). Link "Pular a lista de vídeos" antes da grade. Nenhum controle some fora do hover. O botão de lupa do cartão fica fora da ordem de Tab; o teclado amplia pelo item "Ampliar thumbnail" do menu. Na aba Trocas o limite de 2 não vale: botão do cartão, lupa e um link por troca | contar as paradas em 12 cartões: 24 | Sim |
| 6 | Gráficos (1.1.1, 2.1.1) | No Histórico do vídeo, o gráfico, as raias e os marcadores ficam como estão em produção (setas, Home e End nas raias; tabela dos registros diários); a fase A só acrescenta o foco inicial no marcador da troca (6.2) e o clique duplo na raia Thumbnail, que tem equivalente por teclado no cartão da versão. O resto desta linha vale para gráfico **novo** (retenção): `figure` com o resumo de uma frase. O SVG `role="img"` é **irmão** do grupo de marcas, nunca pai. Marcas = `role="toolbar"` rotulada "Trocas do vídeo", botões em `tabindex` rolante (setas, Home, End; Enter ou Espaço preenche a comparação), nome "Troca de título, 22/09, de A para B"; a dica aparece também no foco. "Ver como tabela" é botão com `aria-expanded` que abre a tabela logo abaixo (`caption`, `th scope`, coluna "Troca"). Retenção: as 3 maiores saídas em texto + tabela | só teclado: chegar a cada marca, abrir a tabela, ler os números | Sim |
| 7 | Visualizador de thumbnail (APG, 4.1.2) | `role="dialog"`, `aria-modal`, `aria-labelledby` no título; fundo inerte; foco inicial no título do diálogo; Tab preso; Esc fecha e devolve o foco ao gatilho. Cada gatilho tem nome próprio ("Ampliar a thumbnail: <título>"). A linha de resolução e as mensagens de "Baixar" vão numa região viva. Em "Comparar lado a lado" os botões de zoom ficam com `aria-disabled`. Alvos de 44 px em 390 px | só teclado: abrir por cada gatilho, ampliar, trocar de versão, comparar, fechar; o foco volta ao gatilho | Sim |
| 8 | Abas do canal (2.4.1, 2.4.5) | Cada aba é URL, então `nav` "Seções do canal" com links e `aria-current="page"`; não é `tablist`. O Histórico do vídeo não ganha barra de seções | trocar de aba só com teclado; o foco vai para o título da aba | Sim |
| 9 | Títulos e regiões (1.3.1, 2.4.6) | `h1` = nome do canal. No Histórico os níveis de título ficam como estão em produção (o título do vídeo é hoje um `h2`, `_historico/historico-screen.tsx:120`). Aba ativa e seções do canal = `h2`; cada cartão da aba Trocas = `h3`. Cartão de vídeo sem título de seção. Leitura da forja = `region` rotulada. "O que é a forja?" é disclosure com `aria-expanded` | lista de títulos do leitor de tela: sem salto de nível | Sim |
| 10 | Diálogo de encerrar (APG) | `role="dialog"`, `aria-modal`, `aria-labelledby` no título, `aria-describedby` na frase "No ar agora…"; `fieldset` com `legend` "O que fica no vídeo?" e `radio` nativo; foco inicial no primeiro radio; "Encerrar" com `aria-disabled="true"` e `aria-describedby` "Escolha uma opção"; Tab preso; Esc cancela e devolve o foco ao botão que abriu. Em `precisa_confirmar` o corpo vira `role="alertdialog"`, com foco em "Voltar". Erro em `role="alert"` sem mover o foco; "Encerrando…" com `aria-busy` | só teclado, do abrir ao cancelar, ao confirmar e à confirmação extra | Sim |
| 11 | Calendário do A/B (1.3.1) | Tabela real: `th` de linha = variante, `th` de coluna = dia; valor em texto na célula ("5,9 mil", "descartado", "fora do ar" só para leitor de tela); nunca caracteres de bloco | ler linha e coluna de qualquer célula no leitor de tela | Sim |
| 12 | Contraste e tamanho (1.4.3, 1.4.11) | O mockup traz a tabela "par → razão medida" de todo token de texto e de borda de componente. Rever: `--dim` sobre `--surface-2`; `--forja` 12 px sobre `--forja-subtle`; `--tier-top` e `--tier-mid` em texto pequeno; `--warning-text` sobre `--warn-subtle`. Borda de selo em cor sólida ≥ 3:1. Texto ≥ 12 px. Medido no mockup: todo par de texto passa. Os pares novos das rodadas 11 e 12 (19.2) foram **calculados por script** contra o cartão `#221E1A`, não medidos no navegador. Reprovam como componente os tokens de linha do produto (`--border-strong` 1,55:1, `--border` 1,31:1, `--border-subtle` 1,18:1, `--forja-line` 2,11:1); onde a borda é o que identifica o controle (busca, ordenação, segmento ativo), estas telas usam `--dim` ou `--muted` | medir cada par: texto 4,5:1; texto grande e componente 3:1 | Texto: sim, par reprovado bloqueia. Borda nos tokens de linha: não; é pendência separada, do CMS inteiro (decisão do dono) |
| 13 | Cor nunca sozinha (1.4.1) | Nível do múltiplo por escrito; situações da forja com ícone distinto para atraso e para falha; faixas com "Erro:" ou "Atenção:" | captura em escala de cinza: tudo continua distinguível | Sim |
| 14 | Atualização automática (2.2.2, 4.1.3) | A situação da forja anuncia (`polite`) só quando muda; "atualizado há 1 min" em texto; botão "Pausar atualização automática" | deixar o cartão aberto 5 min com leitor de tela; pausar | Sim |
| 15 | Foco após navegar (2.4.3) | Navegação cliente: foco no `h1`. Voltar: foco no cartão do último vídeo visto. Anterior/Próximo: foco continua no botão, status "Vídeo 8 de 51: <título>", `aria-disabled` no fim da lista. "Carregar mais": foco no primeiro cartão novo, sem mover a rolagem, e o status diz "Mostrando 91 de 133 vídeos. 40 vídeos antigos carregados.". Chegada pela troca: foco no marcador da troca (6.2). Voltar para a aba Trocas: foco no botão do cartão ou no link da troca. Esqueleto com `aria-hidden` e "Carregando…" para leitor de tela; miolo com `aria-busy` | navegar canal → vídeo → próximo → voltar só com teclado | Sim |
| 16 | Tamanho do alvo (2.5.8) | 24×24 sempre; 44×44 sob `pointer:coarse` **e** em viewport ≤ 900 px (hoje há alvos de 32 e 40 px em `chrome.css`) | `getBoundingClientRect` em todo controle, nas duas condições | Sim |
| 17 | Truncamento e refluxo (1.4.10, 1.4.4) | Texto truncado tem o nome inteiro no nome acessível. Em 320 px e zoom 200–400%, tabelas viram pilhas com rótulo; só gráfico e faixa de abas rolam na horizontal | 320 px e zoom 400%: sem rolagem horizontal da página | Sim |
| 18 | Texto alternativo, idioma, datas, dicas, avisos | `alt=""` na thumbnail dentro do link com título; na comparação, rótulo + período. `lang` no título e nas tags de canal em outro idioma. Ícones decorativos com `aria-hidden`. Datas em `<time datetime>`. Links externos dizem "abre em nova aba". Nada explicado só em `title`: botão ⓘ com nome único ("Sobre o múltiplo de <título>") e popover que fecha com Esc. Aviso de tela: `status` para sucesso, `alert` para erro, pelo menos 6 s, com fechar | inspeção do DOM e leitor de tela nas duas telas | Não |
| 19 | Dicas, popovers e menus (2.1.1, 2.4.3, 4.1.2) | Camada única de 19.1: gatilho com `aria-expanded` (popover e menu) ou `aria-describedby` (dica); Esc fecha e devolve o foco; clique fora e perda de foco fecham; uma aberta por vez; a dica de mouse também aparece no foco; nenhuma cobre o gatilho | script de conferência de 19.1, em 1440 e 390 px, com o controle negativo reprovando | Sim |
| 20 | Régua, gráfico de impressões e cor (1.1.1, 1.4.1, 2.1.1) | Régua visual `aria-hidden` + texto só para leitor com posição, terço, empate, valor, faixa e mediana; uma parada de Tab por régua, setas/Home/End, Enter abre, Esc fecha, região `aria-live`. Gráfico de impressões: uma parada de Tab, setas/Home/End pelos dias, "Ver como tabela" com todos os dias e a situação por extenso; os três estados distinguíveis em escala de cinza (barra, traço, hachura) | teclado de verdade e escala de cinza em 17.3 e 16.6 | Sim |
| 21 | Comparação (1.3.1, 4.1.3) | Tabela real (`caption`, `th scope`, `role` explícito em cada elemento porque `display:grid` em `<tr>` tira a semântica); seletores rotulados; `role="status"` ao trocar o par; "não medido" escrito por extenso para leitor; símbolos ▲ ＝ ● com texto equivalente | leitor de tela: percorrer a tabela por célula (não exercitado no mockup) | Sim |
| 22 | Faixa de números (1.3.1, 3.3.2) | `dl` rotulado; cada célula na ordem valor e rótulo no DOM ("84 mil views"); o ⓘ nunca abre vazio (teste que falha se a célula não tiver base); "Todos os números" é botão com `aria-expanded` | inspeção do DOM e abrir cada ⓘ | Sim |

Movimento: rolagem suave, esmaecimento e transição de elemento compartilhado só sem `prefers-reduced-motion: reduce`. Fundos translúcidos só com os rgba literais da seção 2, nunca `color-mix()` (em alguns navegadores ele sai transparente). Horários sempre em São Paulo.

A coluna "Bloqueia o mockup?" foi escrita antes do mockup. Para a página do canal e para o Histórico ela já foi respondida em 12.2: o que foi medido passou, e o que não foi exercitado (leitor de tela, teclado completo, zoom, movimento reduzido) vira verificação do plano da fase A. Para os mockups que faltam (12.3) a coluna continua valendo como está.

## 12. Mockups: o que já foi aprovado e o que falta
A v7 pedia quatro mockups. O primeiro foi feito em doze rodadas e aprovado "por enquanto" pelo dono em 10/10; o segundo foi feito e reprovado, e virou outra coisa; os outros dois ainda não existem. Pasta: `docs/superpowers/mockups/2026-10-07-pagina-canal/` (servir com `python3 -m http.server 8791 --bind 127.0.0.1` dentro dela).
### 12.1 Aprovado pelo dono

| O quê | Rodada | Arquivo do mockup |
|---|---|---|
| Página do canal de concorrente: vista padrão Capas, 5 por linha em 1440 px, Lista, controles, estados de carregando, erro, primeira sincronização, atrasada, sem vídeos e busca sem resultado | 1 e 3 | `canal.html`, `canal.js` |
| "Carregar mais" por botão, centralizado, de 40 em 40, sem carga automática; os antigos entram com aviso | 3 e 4 | `canal.js` |
| Cabeçalho do canal com a faixa de números, "Todos os números", ⓘ único e mais respiro | 3, 5 e 11 | `canal.js`, `faixa-numeros.js`, `canal.css` |
| Aba Trocas: um cartão e um botão por vídeo; "Abrir nesta troca" por troca | 4 | `canal.js` |
| O destino é o Histórico do vídeo de produção, sem perder nada | 3 | `video.html`, `video.js`, `hist-dados.js` |
| Chegada com a troca destacada | 3 | `video.js` |
| Visualizador de thumbnail; na raia do gráfico, clique duplo amplia | 4 | `viewer.js`, `viewer.css` |
| Gráfico em 30 dias por padrão; a faixa "antes de 03/10, sem registro" fica | 3 | `video.js` |
| Thumbnails continuam na seção de versões | 3 | `video.js` |
| Cartão novo da forja no lugar do de hoje; o botão do cabeçalho rola e pede, com andamento em três etapas | 2, 3, 5 e 7 | `forja.js`, `forja-etapas.css` |
| Leitura sem efeito medido abre com o que fazer e pode citar o desempenho anterior, sem afirmar causa | 3 | `forja.js` |
| Canal próprio: página, faixa de números, grade com impressões, "Como o canal está" recolhida, gráfico de impressões em três estados | 5 a 8, 11 e 12 | `canal-proprio.html`, `dados-proprio.js`, `impressoes.js`, `impressoes.css` |
| Lista de Canais com canal próprio no topo e na lista, posição, linha presa, vista em cartões, busca; filtro "Todos \| Longos \| Shorts" | 6, 7, 8 e 12 | `canais.html`, `canais.js`, `canais.css`, `canais-dados.js` |
| Atalho "Meu canal" na moldura | 7 | `meu-canal.js`, `meu-canal.css` |
| Vídeo próprio: paginador, faixa com ⓘ, "Este vídeo no canal" com réguas, gráfico de impressões, cartão da forja indisponível | 8, 10, 11 e 12 | `video-proprio.html`, `video-proprio.js`, `regua.js`, `regua.css` |
| Comparação entre dois canais: seletores, inverter, Leitura rápida, "Número a número", régua do nicho, "Só o seu canal mede", 5 mais vistos, publicação em 90 dias, cartão da forja | 9 a 12 | `comparar.html`, `comparar.js`, `comparar.css`, `comparar-leo.js` |
| Camada única de dicas, popovers e menus, com script de conferência | 12 | `flut.js`, `camadas.css`, `prova-flutuantes.js` |
| Cor única de "não medido" (rosa com hachura), cores dos lados e dos terços | 11 e 12 | `camadas.css`, `comparar.css`, `regua.css`, `impressoes.css` |

Reprovado: a página de vídeo nova da rodada 2 (faixa "Resumo", barra presa, tira de capas, "Versões" sem thumbnails).

Decidido sem mockup novo: bordas que reprovam contraste são pendência separada, do CMS inteiro. O dono aprovou o conjunto "por enquanto" (roteiro, seção 3d): os pontos que ele quer rever com tudo implementado estão na seção 20.
### 12.2 O que o mockup provou com medida, e o que não provou
Medido no Chrome, em 1440×900, servido por HTTP: 10 cartões inteiros em Capas e 9 linhas em Lista na carga (rodada 1; a faixa de números da rodada 5 mudou a grade para 319 px, e o respiro da 11 para cerca de 337 px, ver 5.1); sem rolagem horizontal em 1440, 1280, 1024, 768, 390 e 320 px em todas as telas, incluindo 48 combinações da rodada 11 e 9 telas × 4 larguras na rodada 12; 2 paradas de Tab por cartão (24 em 12 cartões); troca de filtro em 16 a 29 ms, sem indicador; "Carregar mais" indo de 51 a 91, 131 e 133 sem mover a rolagem; ida e volta entre a aba Trocas e o Histórico com foco e rolagem preservados; o visualizador abrindo, ampliando, comparando e devolvendo o foco; lista de Canais com 70 linhas (12 na dobra em Longos, 11 em Todos e em Shorts); a prova das flutuantes (993 de 993 checagens, 123 flutuantes distintas em 1440, controle negativo reprovando); o gráfico de impressões repintando de 1440 para 700 e 400 px; régua e dica por teclado; simulação de deuteranopia por filtro. Todo par de texto passou de 4,5:1 (calculado).

**Não provado, e por isso vira verificação do plano de cada fase** (não pede mockup novo): leitor de tela de verdade (só os atributos foram conferidos); toque real e rotação em aparelho; teclado completo nas raias do gráfico e no visualizador; roda do mouse, pinça e "Baixar" no visualizador; o clique duplo na raia; a queda para `sddefault` e `hqdefault`; zoom do navegador de 200 a 400%; movimento reduzido; escala de cinza; outros navegadores além do Chrome (o dono usa Opera); contraste medido na tela (foi calculado); a altura da moldura real do CMS (a do mockup é estática); a lista de grupo da linha do tempo na camada nova; o caminho "os dois em zero" da comparação. É a lista do item 9 e 10 de "A rever no fim" (seção 20).

Fabricado no mockup, a não confundir com dado: as 7 trocas e os títulos "Antes" de Leo Khev, os 3 fixados, os casos de dado ausente, **todo** texto de leitura da forja (ela nunca produziu uma leitura real em produção; inclui a leitura de exemplo da comparação), **os Shorts dos 12 concorrentes reais menos Leo Khev e dos 57 canais de exemplo** (gerados por semente fixa), os 57 canais de exemplo da lista de 70 e a lista longa em si. Reais no mockup, mas exportações de 07 a 09/10, não o banco: os 13 concorrentes de `canais-dados.js`, o canal tnFigueiredo (35 vídeos, 140 impressões, 19 relatórios), os vídeos de Leo Khev. O múltiplo do mockup é uma aproximação; em produção vale o do motor.
### 12.3 O que ainda falta mockar, antes de qualquer tela
Regra do dono: mockup aprovado antes de qualquer tela. Valem para todos as linhas da seção 11 marcadas "Sim".
1. **Retenção.** O estado "Coletando: 9 de 28 dias". A lista com "poucos vídeos para comparar", "Sem faixa" e uma linha para cada frase de 8.3. Canal a reautorizar, visto por quem administra e pela editora. Curva incompleta e a frase das janelas diferentes. Variante opcional: a dispersão acima da lista (seção 13). **O dono decide lá:** só a lista, ou lista com dispersão.
2. **A/B: acompanhamento, diálogo e faixas.** O calendário com destaque e sem destaque. Nenhuma ocorrência de "confiança", "impressões", "CTR", "playoff", "líder", "vencedor" (fora de "Encerrado sem vencedor") ou "automaticamente". O diálogo sem opção marcada e com "Encerrar" desabilitado; a confirmação com os dois títulos lado a lado. Os estados de 9.3 e as seis linhas de 9.4, com destino original e com destino variante. **O dono decide lá:** o texto do rótulo "mais views/dia até agora" e o do botão "Encerrar e ficar com B".
3. **Pequenos, que cabem numa rodada curta do mockup atual:** os estados "Canal não encontrado" e "Erro: a última sincronização falhou" (5.9), que têm frase mas não têm tela; o fixado "o YouTube não devolveu este vídeo"; o múltiplo com "base fraca"; a "Leitura anterior" visível enquanto um pedido novo está na fila; a lista de Canais com as colunas de produção que o mockup nunca mostrou (Ritmo, Outliers, Trocas, Crescimento, Sincronização) se a pergunta 6 da seção 14 mantiver essas colunas.
4. **Canal próprio com os dados do L2 de verdade**, depois da conferência da Task 11 e de alguns dias de série: o gráfico de impressões e as réguas foram exercitados com uma exportação, não com o banco. Não pede mockup novo, pede conferência na fase A4.

## 13. Depois da primeira versão
Ficaram de fora desta versão, uma linha cada:
- Filtro "Com troca" na grade do canal.
- Carregamento automático dos vídeos antigos ao chegar perto do fim da grade (o botão continuaria existindo).
- Clique simples na raia Thumbnail ampliando, em vez do clique duplo.
- Tags do vídeo (linha de tags e `ObsVideo.tags`): eram da página de vídeo nova, que não é mais feita.
- Transição da thumbnail do cartão para o cabeçalho do Histórico; pré-carga no hover.
- Diminuir a faixa "antes de 03/10" quando a série passar de 14 dias.
- Capa anterior ("antes | agora") no hover e no foco do cartão.
- Menu de canais do mesmo nicho na trilha do vídeo.
- Faixa de números do canal presa ao rolar (só a linha de controles fica presa).
- Chip "hipótese: pico e queda" em vídeo de concorrente com 30 dias ou mais de série.
- Dispersão de retenção (views × pontos contra a faixa): segundo mockup opcional; o dono decide vendo.
- Arquivo de leituras em Insights. Exige ler `competitor_readings` sem o corte de 90 dias do carregador (`READING_DAYS`, `load.ts:95`, aplicado em `:510-511`).
- Criação do A/B em 2 passos ("O que testar" e "Revisar e ativar").
- Comparação com mais de dois canais e com canal de exemplo; filtro "só longos" nos cinco mais vistos da comparação.
- Ordenação por engajamento na lista de vídeos do canal (por isso a posição de engajamento no vídeo próprio não é link).
- Percentual de cliques do total do canal, com intervalo de Wilson (o dono decidiu contagem sempre; pede decisão nova).
- Página para o segundo canal próprio quando ele ganhar vídeos.
- Pedido real de leitura da forja para canal, canal próprio, vídeo próprio e comparação (pacotes novos, lote L4).
- Leitura da forja de comparação e de vídeo próprio com texto real (hoje os cartões são "ainda não disponível").

## 14. Perguntas abertas para o dono
Só o que o mockup, o roteiro e as decisões de 09 e 10/10 não respondem e que quem implementa teria de adivinhar. Eram oito. **Todas foram respondidas pelo dono em 10/10: as recomendações abaixo valem como requisito (emenda 44), e a 8 foi ampliada pela emenda 45 (posição geral quando o nicho é "Todos").** O texto fica para registrar o porquê e o custo de errar.

**Fechadas, para não voltarem:** a vista padrão é Capas (emenda 6); a tira de capas não entra (emenda 12); a leitura por canal não é feita antes de a página do canal estar em uso (roteiro, etapa 8); a URL do canal usa o id interno (seção 3); o selo continua "em treino"; o cartão novo da forja entra na fase A (emenda 23); o botão do cabeçalho rola e pede, em três etapas (emenda 24); o Histórico fica só com a trilha (emenda 25); o painel lateral sai para concorrente (emenda 26); o cabeçalho tem a faixa de números mais rica, com os "quatro números" deixando de ser uma pergunta (emenda 27); "0 views/dia" com uma casa decimal está resolvido pelo mockup (emenda 37); aceite do L1b com revogação real não se faz (roteiro, seção 3d).

1. **A aba "Leitura" do canal, na fase A.** A leitura por canal depende do trabalho de servidor de 7.3 e não existe. O que a aba mostra até lá? Recomendação: a aba aparece com a leitura do nicho, rotulada "Leitura do nicho Viagem (não é só deste canal)", dentro do cartão novo, com o botão de canal apagado e a frase "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo." (7.1). Custo de errar: baixo; é texto e uma aba. O risco é uma pessoa ler a leitura do nicho como se fosse do canal, e o rótulo existe para isso.
2. **Troca de descrição entra na aba Trocas?** A aba aprovada mostra título e thumbnail; a produção também observa a descrição (raia "Descrição"; `_canais/view-model.ts:497`). Recomendação: manter só título e thumbnail e dizer isso no título da seção, para a contagem não divergir sem explicação da de Mudanças. Custo de errar: a contagem "7 em 30 d" diferente da de Mudanças gera suspeita de bug; corrigir depois é só incluir o campo.
3. **Troca mais antiga que 30 dias, com o gráfico em 30 dias por padrão.** Quem chega de Mudanças com janela de 90 dias, ou por link antigo, pode abrir o Histórico numa troca que o período padrão esconde. Recomendação: com troca escolhida fora do período, o gráfico abre no menor período que a inclui e o texto do período diz por quê (6.2). Custo de errar: a troca destacada não aparece no gráfico e a pessoa acha que o link quebrou.
4. **Vídeo fora dos acompanhados, no pager.** Depois de "Carregar mais", o cartão de um vídeo antigo leva ao Histórico no estado "fora dos acompanhados" (aviso e só as raias). Recomendação: o pager segue a ordem da grade, com os antigos inclusive, e a tela de cada um diz o que não tem. Custo de errar: baixo; o alternativo, pular os antigos, esconde vídeos sem aviso.
5. **O aceite pode usar dados reais?** Em produção nenhum canal tem vídeo fixado, nenhum tem mais de 2 trocas e nenhuma troca tem 7 dias de série depois dela (a série começa em 03/10). O diário e o alcance do canal próprio (L2) só começaram a gravar em 09/10 à noite; a conferência da execução das 09:00 de 10/10 (Task 11 do L2) estava pendente em 10/10 (roteiro, seção 3d). Recomendação: aceitar A1 a A3 com os casos cobertos por teste (dados semeados) e conferir em produção só o que existe lá; começar A4 somente depois da Task 11 e de ao menos alguns dias de dado. Custo de errar: aceitar A4 sobre 1 ou 2 dias de dado dá gráficos quase vazios e uma impressão errada de defeito.
6. **Quais colunas a lista de Canais tem (nova).** O mockup aprovado tem seis colunas (Inscritos, Views/dia, Views/dia por mil, Mediana de views, Longos em 90 dias, Acompanhados) mais "Com o meu canal". A produção tem Ritmo, Views/dia, Outliers, Trocas, Crescimento e Sincronização, mais o menu da linha, a vista em cartões, os grupos por nicho e "Adicionar canal" (`_canais/channel-table.tsx:15-20`). O mockup nunca mostrou Ritmo, Outliers, Trocas, Crescimento nem Sincronização (LEIAME, rodada 6). Recomendação: a fase A3 não troca as colunas de hoje: acrescenta o filtro de formato, o bloco "Seus canais" com posição, a ação "Comparar" e o link para a página; as quatro colunas novas do mockup (Views/dia por mil, Mediana de views, Longos em 90 dias, Acompanhados) ficam na tela de comparação e só viram colunas da lista se o dono pedir. Custo de errar: trocar as colunas tira da editora o Ritmo e a Sincronização que ela usa; não trocar deixa a lista aprovada diferente da que se constrói.
7. **Shorts por canal em "Todos" (nova).** Em concorrente, `competitor_videos.is_short` existe e é gravado pela sincronização (VERIFICADO: `lib/youtube/competitor-sync.ts:495` e `:530`), mas pode ser nulo, e o carregador trata nulo como longo (`lib/youtube/observatorio/load.ts:240`). No canal próprio, o carregador deduz o formato pela duração e pelo texto "#Shorts" (`load.ts:143`), enquanto a coleta L1b grava `is_short` em `yt_own_video_meta_daily`. O mockup mostra Shorts de 69 canais inventados (LEIAME, rodada 12), só Leo Khev e o canal próprio têm dado real. Recomendação: "Todos" usa o que a produção tem, mostra "formato não confirmado (N)" quando há nulos, e o canal próprio passa a usar `yt_own_video_meta_daily.is_short` quando existir, com a dedução atual como reserva. Custo de errar: números de Shorts errados na lista lado a lado com os de longos, que é justamente o que "Todos" quer mostrar.
8. **Posição no nicho: para quais números e em que conjunto (nova).** O mockup calcula a posição ("13º de 14") para seis números e só entre os canais do nicho Viagem lidos em 09/10. Na produção, o conjunto é "os canais do mesmo nicho" ou "todos os canais do site"? E o canal próprio sem nicho (`niche` nulo, `load.ts:303`)? E o formato: a posição de "views/dia" é a dos longos ou muda com o filtro? Recomendação: o conjunto é o nicho do canal e o formato é o do filtro da tela; canal sem nicho não recebe posição e a tela diz "escolha o nicho do canal para ver a posição"; a posição existe só para os números que o motor já calcula por canal (inscritos, views/dia, views/dia por mil, longos acompanhados) mais os dois derivados do mockup (mediana de views, longos em 90 dias), nunca para os outros sete. Custo de errar: posição calculada sobre um conjunto diferente do que a pessoa imagina ("13º de 14" lido como "de todos os meus concorrentes").

## 15. Lista de Canais: filtro de formato, canal próprio na lista e atalhos
Fase A3 (seção 4). Mockup: `canais.html`, `canais.js`, `canais.css`, `canais-dados.js` (rodadas 6, 7, 8 e 12). Produção: `_canais/canais-screen.tsx`, `_canais/channel-table.tsx`, `_canais/channel-cards.tsx`, `_canais/view-model.ts`.

### 15.1 O que a produção tem hoje (VERIFICADO)
- Colunas da tabela: Ritmo, Views/dia, Outliers, Trocas, Crescimento (escondida em tela estreita) e Sincronização, mais o menu "Mais ações" da linha, que não existe em canal próprio (`_canais/channel-table.tsx:15-20` e `:59`). A vista em cartões existe (`_canais/channel-cards.tsx`).
- Filtro de formato com dois botões, "Longos" e "Shorts", padrão Longos (`_canais/canais-screen.tsx:281-282` e `:333-334`); `fmt` vai para a URL, o padrão fica fora dela.
- Os canais próprios ficam sempre no topo, num grupo à parte, "na ordem do motor (R73), nunca ordenados pela coluna clicada" (`_canais/view-model.ts:105` e `:235-237`).
- Um único "?" por linha, ao lado dos inscritos (`_canais/cells.tsx:203`, componente `Tip`, `cells.tsx:37-44`), filho da célula. O defeito de dica cortada e o conserto parcial estão em 19.1.
- O clique na linha ou no cartão abre o painel lateral (`channel-drawer.tsx`), e o rodapé do painel tem o botão da forja de nicho sob rótulo de canal (`_canais/drawer-forja.tsx:39`).

### 15.2 O que muda (aprovado no mockup)
```
 Canais                                   Meu canal: tnFigueiredo ▾   Horários em São Paulo
 Seus canais (2)
 ▌ (av) tnFigueiredo  [seu canal]   14º de 14 em mediana de views dos longos, com 135.
 ▌                                  Logo acima: Leo Khev (493). É o último da lista.   [Ir até a linha] [Abrir meu canal]
   Thiago Figueiredo: sem vídeos, fora das posições por vídeo.  Ir até a linha
 [Todos | Longos | Shorts]   [🔍 Buscar canal   ]   [Tabela | Cartões]          ordenado pelos longos (só em Todos)
 Canal              Inscritos  Views/dia            Outliers  Trocas ...   Com o meu canal
 Leo Khev           1,53 mil   longos 0,2           ...                    Comparar
                               Shorts 0
 ▌ tnFigueiredo     1,16 mil   longos: não medido   ...                    —            ← na posição dele
 ── Ainda sem medida para ordenar (2) ──
 ▓ seu canal · 14º de 14 em inscritos, com 1,16 mil.  [Ir até a linha] [Voltar ao topo]   ← linha presa no pé, só se nada acima está na tela
```
O desenho junta o que o mockup mostra (valores do mockup) com as colunas de hoje; quais colunas ficam é a pergunta 6 da seção 14. O que está aprovado, sem depender dela:
- **Bloco "Seus canais" no topo**, na mesma superfície da tabela, com o selo "seu canal" e um fio laranja à esquerda. Uma linha por canal próprio com vídeos: avatar, nome, a frase de posição na ordenação atual com os vizinhos, "Ir até a linha" e "Abrir meu canal". Trocar a ordenação troca a frase. Canal próprio sem vídeo vira uma linha fina ("Thiago Figueiredo: sem vídeos, fora das posições por vídeo. Ir até a linha"), sem avatar, selo nem botão grande, porque não há página para canal sem vídeos (16.8).
- **Na tabela e nos cartões**, cada canal próprio continua **na posição dele**, com o selo e o fio. Isto troca o comportamento de hoje (grupo fixo no topo, `view-model.ts:105`); os testes que afirmam "R73" mudam no mesmo commit.
- **Linha presa no pé**, de 30 px, só quando nem o bloco do topo nem a linha do canal estão na tela: "seu canal · 14º de 14 em inscritos, com 1,16 mil.", com "Ir até a linha" (rola e põe o foco) e "Voltar ao topo". Um canal sem medida na coluna ordenada vai para o fim, sob o divisor "Ainda sem medida para ordenar (N)", sem posição, e a frase diz o motivo ("Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação.").
- **Busca "Buscar canal":** filtra as linhas; as posições continuam as da lista inteira e a tela diz isso.
- **"Comparar"** no fim de cada linha e cartão de concorrente (coluna "Com o meu canal"; nome acessível "Comparar <canal> com o meu canal"), que abre a tela de comparação (seção 18). Não existe em canal de exemplo nem em canal próprio. É link visível, não menu: é a única ação da linha.
- **Atalho "Meu canal: <nome>"**: na lista, no grupo de ações do cabeçalho do Observatório, ao lado de "Adicionar canal" (`_chrome/observatory-chrome.tsx:219`, classe `obs-ch-actions`); nas páginas de canal, de vídeo e de comparação, na linha da trilha, à direita. Abre um menu com os canais próprios (o sem vídeos aparece apagado, "ainda sem página") e "Ver meus canais na lista de Canais". Esc fecha e devolve o foco; setas andam pelos itens. Em 390 px perde o rótulo e vira só o nome. O menu mora na camada única (19.1).
- **Clique no nome ou no avatar de concorrente** leva à página do canal (emenda 26). Canal próprio leva à página própria a partir da fase A4; até lá abre o painel de hoje.

### 15.3 Filtro de formato "Todos | Longos | Shorts"
- Controle segmentado ao lado da busca (`role="group"` "Formato", `aria-pressed`, a mudança é anunciada). Estado em `?fmt=todos|longos|shorts`, **sempre escrito na URL** (diferente dos outros padrões, que ficam fora) e lembrado em `localStorage` quando a URL não o traz. **Padrão: Longos**, que é o que a produção abre hoje (decisão a confirmar com o dono, mockup, rodada 12). Hoje o valor da URL é `fmt=short` e o padrão `long` fica fora (`canais-screen.tsx:282`); o plano mantém os links antigos funcionando.
- **Longos ou Shorts:** as colunas falam só daquele formato; títulos e unidades mudam ("Shorts em 90 dias", "mediana nos Shorts"); ordem e posição são do formato.
- **Todos:** cada célula numérica das colunas que dependem de formato mostra **duas medidas rotuladas** ("longos 79/dia" e "Shorts 310/dia"), **nunca uma mediana só**, porque misturar os dois formatos numa mediana não descreve nenhum deles. Formato sem dado diz "sem Shorts" (sem rótulo na frente, a frase já diz) ou o motivo ("não medido", "aguarda o 2º registro", "sem vídeos"); nunca 0. Inscritos, posição e "Com o meu canal" não mudam com o formato.
- **Ordenação em "Todos": pelos longos.** O cabeçalho da coluna ordenada diz "ordenado pelos longos" na linha da unidade; a frase do topo e o aviso sob o controle dizem o mesmo. Posição e frase do canal próprio seguem a mesma regra.
- **De onde vem:** `channelStats(ctx, id, 'long' | 'short')` já calcula tudo por formato (VERIFICADO: `lib/youtube/observatorio/channels.ts:131-158`, parâmetro `fmtId`). "Todos" chama as duas e não soma. A origem de `is_short` e o tratamento de nulo são a pergunta 7 da seção 14.
- **Aceite do dono pendente (A rever no fim, item 1):** "Todos" está pesado, com "longos" e "Shorts" repetidos em cada célula; o plano leva o rótulo para o cabeçalho da coluna e mede de novo.
- Medido no mockup, 1440×900, 70 linhas: Longos 12 linhas na dobra, Todos 11, Shorts 11 (o nome do canal pode quebrar em duas linhas em "Todos" e o padding vertical cai para 3 px para a tabela caber sem rolagem interna). A 768 px e menos a tabela rola dentro do próprio bloco, com a coluna do nome presa; a página não rola na horizontal.

### 15.4 Posição no nicho (regras)
- "1º = o maior". Empate dito ("1º de 14 no nicho (empate)"). Canal sem o valor fica fora do conjunto e a frase diz "de 12". O conjunto segue o filtro de nicho (emenda 45): dentro de um nicho, os canais do nicho ("13º de 14 em Viagem"); com o nicho em "Todos", todos os canais do site ("40º de 75 no geral"). A frase sempre diz o conjunto. O formato é o do filtro de formato, e só os seis números da pergunta 8 têm posição.
- O mockup tem 14 canais (13 concorrentes reais mais o canal próprio; o segundo canal próprio, sem vídeos, fica de fora e, se for escolhido numa comparação, entra e o "de 14" vira "de 15"). Os 57 canais de exemplo da lista longa (`?n=70`) são fictícios e só existem para testar a rolagem; a produção não os tem.
- Posição de exemplo medida no mockup (canal próprio): inscritos 14º de 14; mediana de views 14º de 14; longos em 90 dias 13º de 14 (empate); longos acompanhados 10º de 14; views/dia e views/dia por mil sem posição (não medido). O canal próprio fica em último em quase tudo, então a frase "É o último da lista" aparece sempre; o desenho só foi exercitado de verdade em "longos acompanhados" (A rever no fim, mockup rodada 7).

### 15.5 Dado ausente na lista
| Dado ausente | Na tela |
|---|---|
| Canal próprio sem views por dia | fim da lista sob "Ainda sem medida para ordenar (N)"; frase "Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve." (válida até o A4 ligar o diário do L2 à lista; depois do A4, vale a frase por vídeo, 16.7) |
| Concorrente "aguarda o 2º registro" | mesma regra, com a frase do motor (`channelStats`: "sem contagem diária ainda") |
| Canal sem Shorts, em Todos ou Shorts | "sem Shorts" |
| Shorts com `is_short` nulo | contados em "formato não confirmado (N)", fora de longos e de Shorts (5.9, linha "Marca de Short nula") |
| Canal próprio sem nicho | sem posição; "escolha o nicho do canal para ver a posição" (pergunta 8) |
| Busca ativa | "Posição na lista inteira, não só nos resultados da busca." |

## 16. Canal próprio: página, gráfico de impressões e posição
Fase A4 (seção 4). Mockup: `canal-proprio.html`, `dados-proprio.js`, `impressoes.js`, `impressoes.css`, `meu-canal.js` (rodadas 5 a 8, 11 e 12). Os números do mockup vêm de uma exportação de 09/10 do canal tnFigueiredo (35 vídeos, 140 impressões, 3 cliques estimados, 19 relatórios lidos), não do banco. A página é a mesma rota da seção 3 (`canal/<id>`), com ramo para canal próprio [INFERÊNCIA recomendada: o mockup usou um arquivo separado só para reaproveitar código].

### 16.1 O que a produção tem hoje (VERIFICADO)
- O canal próprio entra no mesmo conjunto de dados dos concorrentes, a partir de `youtube_channels` e `youtube_videos` (`lib/youtube/observatorio/load.ts:301-322` e `:507`). Colunas lidas: `view_count`, `like_count`, `comment_count`, `duration_seconds`, `published_at`, `updated_at`, `tags` (`load.ts:74`).
- Não tem série diária (`series: []`, `load.ts:314`), nem versões de capa (`thumbs: []`), nem contagem diária de inscritos (`snapshots: []`, `load.ts:322`). Por isso "inscritos em 30 dias" do canal próprio é "sem contagem de 30 dias atrás" e a coleta diária de inscritos é do lote L5 do spec de coleta (seção 0; INFERÊNCIA sobre o L5 não ter sido iniciado).
- O formato (longo ou Short) é deduzido pela duração e pelo texto "#Shorts" (`load.ts:143`).
- O múltiplo já funciona para vídeo próprio: sem série, o motor compara as views atuais com as dos outros vídeos do canal na mesma faixa de idade (`lib/youtube/observatorio/multiplier.ts:42-45`).
- `yt_own_video_daily` e `yt_own_video_reach_daily` existem em produção desde 09/10 (migration `20261009000001`, aplicada pelo dono; tipos em `types/database.types.ts:9887` e `:10084`), com leitura liberada a quem edita o site (`public.can_edit_site`, migration linhas 63-73) e escrita só por service role. **Nenhuma tela as lê hoje** (VERIFICADO por busca: só o código da coleta, `lib/youtube/coleta/diario-step.ts`, `alcance-step.ts` e `criteria-l2.ts`, e os tipos). Sem leitor, nada do que a seção 16 e a seção 17 mostram de impressões e de views por dia existe na tela de produção.
- O diário só grava dia com atividade: "sem linha = sem atividade ou não medido, nunca zero" (`diario-step.ts:4`). Um dia sem linha em `yt_own_video_daily` não pode ser lido como zero.

### 16.2 Wireframe, 1440 px (canal próprio, Capas)
```
 Canais › tnFigueiredo                                   Meu canal: tnFigueiredo ▾   Horários em São Paulo
 (av) tnFigueiredo [seu canal] [PT]   @tnfigueiredotv ↗                [Abrir no YouTube] [Comparar com…] [⋯]
  1,16 mil     35        1.xxx          140            11 de 19         666 dias        ← faixa: 6 números
  inscritos    vídeos    views somadas  impressões     dias com         desde o último
                                        de 09/09 a 07/10 impressão       vídeo
  Sincronizado há … · 35 vídeos                                          [ⓘ] [Todos os números ▾]
  Entre 14 canais de Viagem: 14º em inscritos, 14º em mediana de views, 13º em longos em 90 dias (nenhum).
  Views/dia por mil inscritos: ainda não medido.                       ← links para a lista já ordenada
  ▸ Como o canal está     140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos.   [recolhida]
  Vídeos 35    Trocas —    Leitura    Retenção
 ──────────────────────────────────────────────────────────────────────────────────────────────
 [Todos|Longos|Shorts]  [Mais recentes ▾ | Mais impressões no período]  [🔍 Buscar por título]  [Capas|Lista]
 ┌ thumb 16:9 ─────── 12:41 ┐
 │ Título em até duas linhas │   três colunas: views · impressões · múltiplo
 │ 118 views  18 impressões  │   terceira linha: "2 cliques em 6 dias", "nenhum clique em 4 dias",
 │ 0,9× o normal             │   ou "sem impressão no período"; nunca um percentual
 └───────────────────────────┘
```
Os números do cabeçalho do desenho são do mockup; "1.xxx" é uma soma que o plano calcula de `youtube_videos.view_count`.

### 16.3 Cabeçalho e faixa de números
- Mesma estrutura do cabeçalho de concorrente (5.3), com o selo "seu canal" no lugar do nicho, e o botão "Comparar com…" ao lado de "Abrir no YouTube" (abre a comparação com o concorrente logo acima em inscritos; o `title` diz qual).
- **Faixa principal, seis números:** inscritos (`youtube_channels.subscriber_count`, `OwnChannelRow`, `load.ts:23`); vídeos (contagem de `youtube_videos` não ocultos, `load.ts:507`); views somadas (soma de `view_count`); impressões do período (soma de `thumbnail_impressions` de `yt_own_video_reach_daily` no período lido, com o período escrito: "de 09/09 a 07/10", não "28 dias"); dias com impressão ("11 de 19": relatórios com impressão sobre relatórios lidos); dias desde o último vídeo.
- **"Todos os números", onze células:** cliques estimados no período; vídeos com alguma impressão; mediana de views por vídeo; views do vídeo mais visto; engajamento em 90 dias e de todos os vídeos; duração mediana; ritmo ("parado: nenhum em 13 semanas", `cadence`, `channels.ts:71`); views/dia por vídeo ("a coleta começa em breve" até o A4 ligar o L2); retenção e percentual assistido ("ainda não coletada (lote L3)"); inscritos em 30 dias ("sem contagem de 30 dias atrás").
- Cada célula tem base escrita no ⓘ único e nunca fica vazia: sem dado, a célula mostra a frase (mesma regra de 5.3). A montagem falha em teste se uma célula não tiver base.
- Mesmo respiro do cabeçalho de concorrente (emenda 27).

### 16.4 Grade e Lista do canal próprio
- Cartão com três colunas: views, impressões e múltiplo (o do motor, contra os outros vídeos do canal na mesma faixa de idade). A **terceira linha** diz o que as impressões permitem afirmar daquele vídeo: "2 cliques em 6 dias", "nenhum clique em 4 dias", "sem impressão no período". Sempre a contagem, **sem corte** de 10 impressões e **sem percentual por vídeo**: decisão do dono (09/10), apoiada na tabela da rodada 6, em que os intervalos de 18 e de 8 impressões quase se sobrepõem. O número de impressões já está na coluna do meio e não se repete na frase.
- Ordenação: "Mais impressões no período" entra no lugar de "Mais views por dia". Filtro sem "Fixados" (canal próprio não tem fixados). Lista: colunas Impressões e Cliques no lugar de Views/dia e Trocas.
- A frase "views por dia: a coleta começa em breve" aparece **uma vez** (na linha das abas, na nota sob a grade e em "Ações do vídeo"), não em cada cartão.
- Abas: Vídeos; Trocas ("Trocas dos seus vídeos ainda não são lidas nesta tela."; as trocas do canal próprio ficam no A/B Lab, `_canais/view-model.ts:319`); Leitura ("A leitura da forja para o seu canal ainda não existe." até o L4); Retenção ("Retenção ainda não coletada: chega com o lote L3.").

### 16.5 "Como o canal está"
- Seção **acima das abas**, recolhível, **recolhida por padrão** (decisão do dono, rodada 8). Recolhida, é uma linha: "140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos." Lembra o que a pessoa fez em `localStorage` (convenção por visitante, dentro de try/catch; a tela renderiza certo sem ele) e aceita `?painel=1` (abre) e `?painel=0` (fecha); `?comparar=` do mockup não existe em produção e a seção não abre sozinha por ele.
- Aberta, empurra a grade para cerca de 900 px do topo (907 px medido no mockup, rodada 8): por isso o padrão é recolhida.
- **Frase única do topo:** "Com 140 impressões em 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado." A frase é calculada do volume (140), nunca fixa: com volume maior, outra frase, a definir no plano a partir da tabela da rodada 6 (nenhum vídeo sozinho diz que a capa funciona melhor; só o total começa a dizer).
- **Gráfico "Impressões por dia"** (16.6).
- **"Vídeos que mais apareceram":** os 5 com mais impressões, com a contagem de cliques e de dias; cada um abre a tela do vídeo.
- **"No nicho":** as posições (links para a lista já ordenada) e um formulário `GET` "Comparar com…" (select e botão "Comparar", duas paradas de Tab; não navega ao mudar o select, porque a seta num select fechado dispara `change` em alguns navegadores).
- **"O que ainda não é medido":** em frase. Views por dia de cada vídeo, percentual assistido e retenção, origem do tráfego.

### 16.6 Gráfico de impressões por dia (também na tela do vídeo, 17.5)
Componente único para o canal e para o vídeo (`impressoes.js` e `impressoes.css`, no mockup). Três estados que nunca se confundem, cada um com forma **e** cor, e a legenda em uma linha com a amostra de cada um:

| Estado | Forma | Cor (rodada 12) | Quando |
|---|---|---|---|
| Dia com impressões | barra, com o número em cima; no mínimo 3 px | laranja `#FF8240` | há linha em `yt_own_video_reach_daily` para o dia |
| Zero medido | traço de 3 px na linha de base | azul-ardósia `#7A8FA6` | o relatório do dia foi baixado e normalizado (`vazio` ou `baixado` com `normalized_at`), e não trouxe impressão (no vídeo: trouxe outros vídeos mas não este) |
| Não medido | coluna inteira hachurada, de cima a baixo, também na faixa dos cliques | rosa com hachura (`--nm`, 19.2) | relatório do dia ainda não baixado, com erro ou inexistente |
| Cliques estimados | círculo `#38BDF8` com borda escura na base da barra do dia, e a linha "cliques" sob o eixo com o número do dia | azul `#38BDF8` | contagem estimada (19.3) |

- Escala **linear**, sem corte de eixo; teto do eixo 4, 10 ou múltiplo de 20. Eixo vertical com o nome "impressões". A área de barras do canal tem 180 px para que o dia de 71 impressões não apague o de 1 (3 px).
- "Ver como tabela": todos os dias (29 no mockup), com dia, situação ("com impressões", "relatório veio vazio", "ainda não baixado: não medido", por extenso), impressões e cliques estimados.
- Dica por dia, com mouse e teclado: uma parada de Tab no gráfico; setas, Home e End percorrem os dias; Esc fecha. Textos: "24/09: 1 impressão, 1 clique estimado"; "30/09: 9 impressões, nenhum clique"; "26/09: relatório veio vazio (nenhuma impressão)"; "12/09: relatório ainda não baixado (não medido)". A dica mora na camada única (19.1).
- O desenho nasce na largura em que aparece (de 560 a 860 px) e **repinta** quando a janela muda de largura ou o aparelho gira (`resize` com 120 ms de espera e `orientationchange`), preservando "Ver como tabela" aberto. Abaixo de 560 px de coluna o desenho tem a largura da coluna (324 px em 390).
- **De onde vem o dia:** `day_pt` de `yt_own_video_reach_daily` é o dia do Pacífico; o relatório fecha o dia às 07:00 UTC (emenda 9 do spec de coleta). A ligação entre o dia do relatório (`yt_reporting_reports.start_time` e `end_time`) e `day_pt` é a conferir no plano. O gráfico escreve "dia do YouTube" uma vez, com o ⓘ (seção 1).
- O mockup contou 29 dias de 09/09 a 07/10: 11 com impressão, 8 vazios, 10 sem relatório baixado. A "faltam baixar 12" das rodadas 5 e 6 era de uma janela de 30 dias; vale a contagem dia a dia.

### 16.7 De onde vem cada número do canal próprio, e o que dizer quando falta
| Número | Fonte em produção | Situação (10/10) | Quando falta |
|---|---|---|---|
| Inscritos | `youtube_channels.subscriber_count` (`load.ts:23`) | existe | "não medido" com o motivo; nunca 0 |
| Views, curtidas, comentários, duração, data | `youtube_videos` (`load.ts:74`) | existem; hoje `comments` nulo vira 0 só em concorrente (`load.ts:278`); em próprio o tipo é `number` | comentário nulo: "não medido" (5.9) |
| Impressões por dia | `yt_own_video_reach_daily.thumbnail_impressions` | tabela existe, **sem leitor** na tela; dado a conferir (Task 11 do L2) | os três estados de 16.6 |
| CTR | `yt_own_video_reach_daily.thumbnail_ctr`, em 0 a 1 | idem | "o YouTube não devolveu este número" |
| Cliques estimados | impressões × CTR por dia e vídeo, somados | derivado, novo | "não medido" quando falta um dos dois no dia |
| Views por dia | `yt_own_video_daily.views` (Analytics API, uma linha por dia com atividade) | tabela existe, **sem leitor**; dia sem linha é "sem atividade ou não medido" | "sem views diárias" com o motivo da tentativa (8.3); nunca 0 por falta de linha |
| Ritmo, dias desde o último vídeo | `cadence` e `lastUpload` (`channels.ts:71`) | existem | "parado: nenhum em 13 semanas" quando o valor é zero medido |
| Múltiplo | `multiplier.ts` | existe (base por faixa de idade) | "poucos vídeos para comparar" (5.9) |
| Percentual assistido, retenção | L3 | não existe | "ainda não coletada (lote L3)" |
| Inscritos em 30 dias | contagem diária de inscritos do canal | não existe (`load.ts:322`) | "sem contagem de 30 dias atrás" |

`youtube_video_analytics.views` é total de 90 dias e nunca alimenta "views por dia" nem impressões (emenda 18 e 19.3).

### 16.8 Segundo canal próprio, sem vídeos
O mockup tem dois canais próprios; o segundo (3 inscritos, nenhum vídeo) aparece no bloco da lista, no menu "Meu canal" e na comparação, sempre dizendo "sem vídeos", e **não tem página**. Alternativa não escolhida: escondê-lo até ter vídeo. Em produção, o conjunto de canais próprios é o que `youtube_channels` devolve para o site; o plano confere quantos há.

## 17. Vídeo próprio
Fase A4. Mockup: `video-proprio.html`, `video-proprio.js`, `regua.js`, `regua.css`, `faixa-numeros.js`, `impressoes.js` (rodadas 7 a 12). Hoje, o vídeo próprio abre o Histórico de produção, que para canal próprio não tem fixar nem leitura da forja (`_historico/view-model.ts:758` e `:990`) e mostra "sem série". A tela nova substitui esse caminho para canal próprio: a mesma rota `video/<id>` ramifica pelo dono do vídeo [INFERÊNCIA recomendada, para os links `link.historico` continuarem valendo; o plano decide].

```
 Canais › tnFigueiredo › Vídeo                                       ‹ Anterior   1 de 35   Próximo ›
 (thumb)  Título do vídeo                                          [Abrir no YouTube] [Ampliar thumbnail]
          publicado há 666 dias (23/01 17:00) · 39:57 · longo
  118        12         6          15,3%          0,9×             39:57         [ⓘ]
  views      curtidas   comentários engajamento  o normal do canal  duração
                                    (curtidas+comentários ÷ views)  (mediana dos outros 34: 138 views)
 Este vídeo no canal
  Primeiro do canal em impressões, mas com poucas. No meio em views, engajamento, curtidas e comentários.
  Alcance       Impressões  18      ▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▎ 1º de 33
                Views       118     ▏▏▏▏▏▏▎▏▏▏▏▏▏▏▏▏ 16º de 35
  ...
 Impressões por dia (gráfico de 16.6)                         [Ver como tabela]
 Leitura da forja   ainda não disponível para o seu canal
 O que ainda não há deste vídeo: views por dia, percentual assistido e retenção, origem do tráfego, trocas de título e thumbnail.
```

### 17.1 Paginador
"Anterior", "1 de 35", "Próximo" e a frase de ordem ("na ordem da lista: do mais novo ao mais antigo"). No primeiro vídeo "Anterior" fica apagado (`aria-disabled`, continua na tela); no último, "Próximo". Atalhos `[` e `]` só com o foco no título ou no paginador (seção 11, linha 2). **A ordem é a da lista de onde a pessoa veio:** o canal passa `sort`, `dir` e `q` em `back=`, e o paginador anda nessa ordem (por views, múltiplo, impressões ou data). Sem `back`, do mais novo ao mais antigo. Substitui a entrada do histórico do navegador, como o pager do Histórico (6.5). Nome dado pelo dono: "anterior ou próximo", não "vídeo mais antigo/mais recente" (rodada 8).

### 17.2 Faixa de números, com rótulo e ⓘ preenchido
Seis células com valor em JetBrains Mono em cima e rótulo em Inter 12 px embaixo, fio vertical entre elas: views, curtidas, comentários, engajamento ("curtidas + comentários por view"), múltiplo ("o normal do canal"), duração. **Um único ⓘ** no fim abre a base dos seis números, **com a conta feita**: "(12 curtidas + 6 comentários) ÷ 118 views = 15,3%"; "118 ÷ 138 = 0,9×; 138 é a mediana de views dos outros 34 vídeos". A montagem falha em teste se uma célula não tiver base: o ⓘ nunca abre vazio (queixa do dono na rodada 8; o plano reproduz o caso). Mesma marcação e mesmo respiro do cabeçalho do canal (emenda 27).

### 17.3 "Este vídeo no canal"
Substitui seis linhas de prosa por **frase-resumo e uma régua por número** (pedido do dono na rodada 10: "muito texto, difícil de compreender; cores").
- **Frase no topo, sem número, gerada dos dados:** "Primeiro do canal em impressões, mas com poucas. No meio em views, engajamento, curtidas e comentários." Cada oração leva a forma do seu terço (▲ ● ▼). A duração fica fora da frase. Vídeo sem impressão abre com "Sem impressão no período."
- **Tabela de verdade** (`caption`, `th scope`) em três grupos: Alcance (impressões, views), Resposta (engajamento, curtidas, comentários), Formato (duração). Por linha: nome, valor deste vídeo, régua, posição escrita ("18º de 35 · empate com 2").
- **Régua:** **um traço por vídeo do canal**, posto pelo valor real, menor à esquerda e maior à direita, os dois escritos nas pontas. O traço deste vídeo é maior (4 × 26 px contra 2 × 12), com contorno, na cor do terço. Triângulo sob a linha = mediana do canal. Empate: o mesmo valor abre 2,6 px para o lado (nas pontas, só para dentro); o traço deste vídeo fica no valor exato.
- **Cor por terço:** a posição média no empate (`posição + empates/2`) decide: até n/3 é cima, até 2n/3 é meio, o resto é baixo. A posição média, e não a melhor, para o empate não favorecer ninguém. Cima `#A78BFA` (`--tier-high`), meio `#38BDF8` (`--tier-mid`), baixo amarelo `#F2C14E` (`--terco-baixo`, "avisando", decisão a confirmar); a forma ▲ ● ▼ e a posição escrita acompanham sempre (cor nunca sozinha). A **duração é neutra** (`--text`): comprido não é bom nem ruim.
- **Vídeos sem o dado ficam fora da contagem:** impressões são "de 33", não "de 35", porque 2 vídeos não têm impressão; eles não entram na régua nem na posição (nulo não vira zero). O vídeo sem impressão mostra "sem impressão de 09/09 a 07/10" ocupando a linha toda: sem régua, sem traço destacado, sem posição, sem zero.
- **Escala:** se 60% ou mais dos vídeos cai no primeiro quarto do eixo linear, usa raiz quadrada de (valor menos o menor); senão linear. No mockup, raiz em impressões, views, curtidas, comentários e duração; linear em engajamento. **A explicação da escala vai para um ⓘ** ao fim da legenda, não para texto sob a régua (A rever no fim, item 2, ainda mostra "escala √" no mockup da comparação).
- **Acessibilidade:** a régua visual é `aria-hidden`; a célula tem texto só para leitor de tela ("16º de 35 em views, terço do meio, empate com 2; 135 views; no canal de 62 a 929; mediana 138"). Uma parada de Tab por régua (o foco cai neste vídeo e a dica aparece); setas, Home e End andam de vídeo em vídeo pelo valor; Enter abre o vídeo (preserva `back=`); Esc fecha a dica; cada passo é falado numa região `aria-live`. Toque: o primeiro toque mostra a dica, o segundo no mesmo traço abre. Sem animação. A dica mora na camada única (19.1).
- **Links:** a posição de views leva à lista ordenada por vistos e à âncora do vídeo; a de impressões, à lista por impressões. Engajamento, curtidas, comentários e duração não são link (a lista não os ordena).
- **Pouco dado, dito:** "18 impressões em 6 dias, somadas dos 19 relatórios diários lidos de 09/09 a 07/10 (10 dias ainda sem relatório baixado). Com tão poucas, a posição em impressões muda de um dia para o outro."
- **Contraste:** violeta e azul contra os traços cinza têm contraste de luminância de só 1,25:1 e 1,59:1; o traço deste vídeo se distingue por altura, largura e contorno, não pela cor (limite medido na rodada 10).

### 17.4 Gráfico, forja e o que falta
- Gráfico de impressões **só deste vídeo** (16.6): dia com relatório em que o vídeo não apareceu é zero medido, com a dica "o relatório do dia não trouxe este vídeo". "Ver como tabela" tem os 29 dias.
- **Cartão da forja "ainda não disponível para o seu canal":** mesma classe visual do cartão de 7.1, sem etapas; diz o que a forja leria, mostra o botão "Pedir leitura deste vídeo à forja" **apagado** (contorno tracejado, texto `--muted`, `aria-disabled="true"`, sem mudança no hover) e, abaixo, o porquê: a forja só recebe dados públicos de concorrente e a leitura do canal próprio chega depois da coleta diária. **É pacote novo da forja (lote L4 do spec de coleta, seção 8) e fica fora da fase A.** O dono respondeu que vale pedir leitura de vídeo próprio, depois do L2 em produção (roteiro, seção 3b).
- **"O que ainda não há deste vídeo"**, em um parágrafo: views por dia, percentual assistido e retenção, origem do tráfego, trocas de título e thumbnail ("ainda não são lidas nesta tela").
- A caixa "Dias em que apareceu" saiu (rodada 12): "Ver como tabela" tem os mesmos dados e mais.

### 17.5 Dado ausente
| Dado ausente | Na tela |
|---|---|
| Vídeo sem impressão no período | frase na linha de impressões e na frase-resumo; fora da régua |
| Relatório do dia não baixado | coluna hachurada "não medido", em rosa |
| Comentário ou curtida nulos | "não medido" na célula, motivo no ⓘ |
| Views por dia | fora da faixa até o A4 ligar o diário do L2; depois, "sem views diárias" com o motivo da tentativa (8.3) |
| Poucos vídeos para a régua (menos de 3 com o dado) | sem régua; a frase diz "poucos vídeos para comparar (N)" |

## 18. Comparação entre dois canais
Fase A3 (entradas e tabela); a linha "Só o seu canal mede" depende do A4. Mockup: `comparar.html`, `comparar.js`, `comparar.css`, `comparar-leo.js`, `regua.js` (rodadas 9 a 12). Não existe em produção.

### 18.1 URL e entradas
- `/cms/youtube/competitors/comparar?a=<id>&b=<id>`. O id é o `ObsChannel.id`: para canal próprio, `youtube_channels.id` (`load.ts:318`); para concorrente, `competitor_channels.id`. Sem `a`, vale o canal próprio; sem `b`, vale o concorrente logo acima de A em inscritos. Trocar um seletor atualiza a URL (`history.replaceState`), o título e o `role="status"`, sem recarregar; o canal do outro lado fica desabilitado na lista do seletor.
- **Quatro entradas:** (1) "Comparar com o meu canal" no cabeçalho do concorrente, ao lado de "Abrir no YouTube" (não dentro do menu ⋯: é o caminho que o dono pediu para existir); (2) "Comparar" de cada linha e cartão da lista de Canais (15.2); (3) "Comparar com…" no cabeçalho do canal próprio; (4) o formulário "No nicho" de "Como o canal está" (16.5). O dono reclamou na rodada 9 que o botão "Comparar com meu canal" só navegava para o canal próprio; a tela existe por isso.
- O parâmetro `?comparar=<id>` só existiu nas rodadas do mockup (`canal-proprio.html`); nenhum código de produção o usa (VERIFICADO por busca). Nada a redirecionar em produção. [O brief original falava em redirecionar o `?comparar=` antigo; vale só para os arquivos do mockup.]
- Dois canais próprios (um deles sem vídeos) podem ser comparados (a tela mostra "sem vídeos" no lado B, 8 linhas, 5 de fora). A mesma pessoa não fica dos dois lados.

### 18.2 Cabeçalho e cores dos lados
- Um cartão por lado (avatar, nome, selo "seu canal", nicho, inscritos), um seletor por lado, "Inverter lados", "Abrir o canal …" (só quando o canal tem página).
- **A cor segue o canal, não a posição:** o canal próprio é sempre **laranja** `#FF8240` (`--lado-o`), no lado A ou no B; o outro canal é **azul** `#7CC8F8` (`--lado-b`); quando não há canal próprio no par, o lado A é **areia** `#D9C08F` (`--lado-n`) e o B azul. "Inverter lados" troca as cores junto com os canais. Cor nunca é o único sinal: chip "Lado A"/"Lado B", letra A/B nas réguas, sublinhado de 3 px no cabeçalho da coluna. Contraste contra o cartão `#221E1A`: 6,72, 9,04 e 9,37 para 1; texto escuro dos chips sobre cada cor, 7,51, 10,12 e 10,48 (calculado por script, não medido no navegador). Laranja e azul têm luminância parecida (razão 1,35): quem separa os lados é o matiz, a letra e o filete.

### 18.3 Leitura rápida
Calculada dos mesmos números, **sem IA**, no topo: "▲ Você é maior em: engajamento (14,9% contra 9,6%).", "▲ Leo Khev é maior em: longos em 90 dias (2 contra 0), ritmo de publicação (0,2 por semana contra 0), mediana de views (3,7×) e mais 2.", "＝ Praticamente iguais: longos acompanhados e duração.", "Sem como comparar ainda: 5 números (falta o dado do seu canal em …)". Nunca "ganha", "vencedor" ou "perdedor".
- **No máximo três itens por linha**, os de maior diferença (contra zero primeiro), terminando em "e mais N". "Praticamente iguais" também corta em três.
- **"Maior" a partir de 10% de diferença** (a mesma regra de "praticamente igual", abaixo de 10%). Contra zero, a linha escreve "(2 contra 0)", não uma razão infinita. "Dias desde o último vídeo" vira "publicou mais recentemente". Linha sem itens não aparece.
- O "◌" de "sem como comparar" foi trocado pela pastilha de hachura do "não medido" (`.nm-h`), porque o símbolo sumia no fundo escuro.
- Dono (rodada 11): "faltam interpretação, cores, símbolos"; a Leitura rápida é a interpretação, calculada. **Pendente de rever (A rever no fim, item 5):** quando um lado ganha em muita coisa a linha ainda fica comprida; em 390 px quebra em cinco linhas.

### 18.4 "Número a número"
Uma `<table>` de verdade (`caption`, `th scope="col"`, `"row"`, `"rowgroup"`; `role` explícito em cada elemento porque `display:grid` em `<tr>` tira a semântica em alguns navegadores; inferência: não foi testado com leitor de tela). Três grupos com ícone de traço e 22 px de respiro acima: **Tamanho** (inscritos, inscritos em 30 dias), **Publicação** (longos acompanhados, longos em 90 dias, longos + Shorts por semana, dias desde o último vídeo), **Desempenho** (mediana de views dos longos, views por dia nos longos, views por dia por mil inscritos, engajamento nos longos, vídeos acima de 2× em 90 dias, duração mediana dos longos, trocas de título e thumbnail em 30 dias). Treze linhas.
- Por linha: nome, base do número (12 px), valor de A, valor de B e **a relação, sempre nomeando o maior**: "▲ Lucas Bigodinho: 5,0× os longos acompanhados de Dale Philip", "▲ Você: +54% de engajamento". **"×" só a partir de 2×; abaixo de 2×, percentual** ("+32%"); abaixo de metade, a frase "8,7% dos inscritos de Dale Philip", mais clara que "−91%". Sem sinal de menos e sem seta contrariando. **Dentro de 10%: "praticamente igual".**
- **"Maior não quer dizer melhor":** o rodapé diz "Maior não quer dizer melhor: são canais de tamanhos diferentes." (o resto está no ⓘ do título). Sem verde, sem vermelho, sem "vencedor".
- **Barra por linha:** 4 px, no mesmo eixo, proporcional ao maior dos dois; se a menor for menos de 3% da maior ganha 3 px e a linha diz por escrito "menos de 3% da barra do outro lado". Sem barra quando um lado não foi medido, em crescimento em % e em "dias desde o último vídeo".
- **"Dias desde o último vídeo" em frase, sem barra:** "Leo Khev publicou há 55 dias; você, há 666 dias". A barra cheia do lado mais parado leria como vantagem, e inverter exigiria que a pessoa lesse a legenda do sentido.
- **Zero em linguagem de gente:** "você não publicou longos em 90 dias", "você não publicou em 13 semanas", "você não tem vídeo acima de 2× em 90 dias"; os dois em zero: "nenhum dos dois publicou longos em 90 dias". Razão com zero não se calcula: "sem razão: tnFigueiredo tem 0". Sem essa frase especial, o texto genérico é "X tem 0". (O caminho "os dois em zero" só está no código do mockup; nenhum par testado o exercita.)
- **Nulo, nunca zero:** o lado sem dado mostra a pastilha rosa com hachura "não medido" e o motivo numa segunda linha; a relação da linha some. Linha em que nenhum dos dois tem dado **não aparece**, e o rodapé conta e nomeia as que ficaram de fora ("3 números ficaram de fora…").
- **Engajamento sem janela de 90 dias**, para dar a mesma régua aos dois (o canal próprio não tem vídeo em 90 dias): vídeos com comentário nulo ficam de fora, não entram como 0. **Isto difere do engajamento do cabeçalho do concorrente** (por longo acompanhado de até 90 dias, `engagementOf`, `channels.ts:116`); a base de cada linha diz qual.

### 18.5 Régua do nicho
Os seis números que existem no nicho (inscritos, longos acompanhados, longos em 90 dias, mediana de views, views por dia, views por dia por mil) usam a régua de 17.3 generalizada: **um traço por canal do nicho, dois destacados** (A e B, cor do lado, letra embaixo); as letras se afastam quando os traços colidem (os traços não saem do valor). O valor continua escrito nas colunas, com a posição em texto apagado: **"14º de 14 no nicho", "11º de 14 no nicho (empate)". Posição, não percentil**: com 14 canais, percentil seria falsa precisão (o dono sugeriu "porcentagem ou percentil, não sei"; recomendação aceita no mockup). Os números só dos dois (engajamento, duração, ritmo, vídeos acima de 2×) têm duas barras finas, uma por lado, no mesmo eixo.
- **Empates colados:** valores idênticos sem lado destacado **empilham na vertical** (bloco de 3 px por canal, passo de 5 px; cinco canais = coluna de 23 px). Empate com lado destacado mantém o traço alto no valor exato e abre os outros 2,6 px para os lados (A rever no fim, item 11).
- **Dica:** como a da régua do vídeo (17.3). "5 canais com 50" e os nomes. Em `role="img"` com a posição dos dois lados no `aria-label`. Mora na camada única (19.1).
- **Escala:** a mesma regra dos 60% no primeiro quarto, calculada por linha; o rótulo "escala √" fica sob a régua no mockup e a explicação vai no ⓘ de cada linha (A rever no fim, item 2).
- A posição só existe quando o conjunto do nicho existe; pergunta 8 da seção 14.

### 18.6 Só o seu canal mede
Cartão à parte, com fio laranja, quando um dos dois é canal seu: impressões, cliques estimados e relatórios com impressão do canal próprio, com a frase "não porque seja zero". Os três números na cor do canal próprio; a linha "3 cliques estimados em 140 impressões" em contagem, sem percentual. Some quando nenhum dos dois é canal seu. Depende de A4 (leitura de `yt_own_video_reach_daily`); até lá a tela não mostra o cartão.

### 18.7 Os cinco mais vistos e a publicação em 90 dias
- **"Os 5 vídeos mais vistos de cada canal":** duas colunas (empilham abaixo de 820 px), capa, título, views, idade, marca "Short" (longos e Shorts misturados; um filtro "só longos" não foi feito). Cada vídeo abre a tela dele. Canal sem vídeos diz isso.
- **"Publicação nos últimos 90 dias":** uma faixa por canal, um traço por vídeo (alto: longo; baixo: Short), no **mesmo eixo**. Aparece quando um dos lados tem datas; para o outro, "As datas de publicação deste canal não estão carregadas" (em produção, "ainda sem vídeos sincronizados") e só a contagem de longos em 90 dias. Quando nenhum dos dois tem datas, o bloco não aparece e o rodapé diz.

### 18.8 Cartão da leitura da forja
No fim, classe do cartão de 7.1. **"Leitura de comparação" é um pacote novo para a forja: não existe no produto** (hoje há leitura de canal e de vídeo; 7.3). Em concorrente × concorrente o mockup simula o botão "Pedir leitura desta comparação à forja", as três etapas e uma leitura de exemplo de quatro frases, marcada "exemplo" e "texto escrito para o mockup". **Na fase A fica só o estado "ainda não disponível", como no vídeo próprio (17.4)**, nos dois casos (com e sem canal próprio); o cartão diz que o pacote é novo. O pedido real é L4 e depende de o dono querer a leitura (decisão da rodada 9: "vale, depois do L2").

### 18.9 De onde vem cada linha, em produção
| Linha | Fonte | Situação |
|---|---|---|
| Inscritos | `ObsChannel.subs` | existe |
| Inscritos em 30 dias | `channelStats().growth30` (`channels.ts`) | existe para concorrente; canal próprio não tem contagem diária (`load.ts:322`) |
| Longos acompanhados, longos + Shorts por semana, dias desde o último vídeo | `channelStats().tracked`, `cadence().pw`, `cadence().lastUpload` (`channels.ts:71-93`) | existem |
| Longos em 90 dias | derivável; o mockup usa 90 dias e o motor de ritmo usa 13 semanas (`RULES.habit.weeks`, `rules.ts`); a conferir qual janela vale | a conferir no plano |
| Mediana de views dos longos | derivável de `ObsVideo.views` | novo, derivável |
| Views por dia nos longos, por mil inscritos | `channelStats().vpdMedian` e `.perMilSubs` | existem em concorrente; canal próprio sem diário até o A4 |
| Engajamento nos longos | derivável sem janela; ver 18.4 | novo, derivável |
| Vídeos acima de 2× em 90 dias | `channelStats().outliers90` | existe; no mockup soma longos e Shorts, em produção é por formato |
| Duração mediana dos longos | derivável de `ObsVideo.dur` | novo, derivável |
| Trocas em 30 dias | `channelStats().changes30` | existe só em concorrente (canal próprio: "as trocas do seu canal ficam no A/B Lab") |
| Posição no nicho | derivada entre os canais do nicho | nova; pergunta 8 |

No mockup, "trocas em 30 dias" de Leo Khev (7) e os Shorts dos concorrentes (menos Leo Khev) são **fabricados**, e a tela marca "exemplo"; nada disso é dado de produção.

## 19. Regras de todas as telas novas
### 19.1 Dicas, popovers e menus: sempre acima do conteúdo
Decisão do dono (09/10): "Toda dica e popover fica sempre acima do conteúdo e dentro da janela, em nenhuma tela." Pedido nascido de um defeito de produção: na tabela de Canais, a dica do "?" ao lado dos inscritos abria por baixo da linha seguinte e o texto se misturava com o nome do canal de baixo.

**O que existe em produção (VERIFICADO):** a dica é um `span` filho da célula, com o balão `.tt` posicionado `absolute` dentro dela (`_canais/cells.tsx:37-44`; `_canais/canais.css:55-57`). Nenhuma tela da pasta usa `createPortal` e a pasta tem 35 linhas com `z-index`, cada uma local (busca em `apps/web/src/app/cms/(authed)/youtube/competitors`). **Conserto parcial já feito** (commit `45a9bbfb`, 09/10, só CSS, sem push por decisão do dono): a célula com a dica aberta sobe para `z-index:3`, e na última linha o balão abre para cima (`canais.css:59-61`). **O que ele não cobre:** a dica de uma linha do meio que encosta no pé da janela continua cortada, porque a tabela rola dentro de um contêiner com `overflow` e o balão abre para baixo (A rever no fim, item 8). O defeito não está só na tabela de Canais: qualquer balão filho de célula, cartão ou contêiner com `overflow` tem o mesmo problema.

**Regra (item de aceite da fase A0, "Para o produto" da rodada 12):** toda dica, popover e menu é renderizado num **contêiner único no fim do `<body>`** (`#flut`: `position:fixed; inset:0; pointer-events:none`), com `position:fixed` calculada do retângulo do gatilho. Acima de todo o conteúdo e abaixo só do modal.
- **Posição:** prefere abaixo; **vira para cima** quando não cabe; desloca-se na horizontal para não encostar na borda; largura máxima igual à janela menos 16 px (em 390 px ocupa a largura útil); se não couber em cima nem embaixo, ganha altura máxima com rolagem interna. Nunca cobre o gatilho. Reposiciona ao rolar (em qualquer contêiner) e ao redimensionar; fecha se o gatilho sai da janela.
- **Comportamento:** **uma aberta por vez** (abrir outra fecha a anterior); Esc fecha e devolve o foco ao gatilho; clique fora e perda de foco fecham. Dicas de mouse (régua, gráfico, linha do tempo) usam só o posicionamento, têm `pointer-events:none` e se escondem quando um popover abre.
- **Inventário das flutuantes das telas novas e do Histórico:** ⓘ da faixa de números e "Todos os números", menus "⋯" do vídeo e do canal, menu "Meu canal", dica da régua do vídeo, dica da régua do nicho, dica do gráfico de impressões, dica do marcador da linha do tempo, lista de grupo da linha do tempo. O aviso (toast) fica fora de `#flut`, na escala; o visualizador usa o nível de modal. `title` nativo e `<select>` nativo não são substituídos.

**Itens de aceite (A0.1 e A0.2):**
1. Nenhuma dica, popover ou menu é descendente de `<td>`, `<tr>`, cartão ou de elemento com `overflow`, `transform`, `filter`, `contain` ou `position:sticky`.
2. **Escala de camadas em variáveis num arquivo só**; nenhum `z-index` numérico fora dele: `--z-fundo` 0, `--z-conteudo` 1, `--z-marca` 2, `--z-marca-alta` 3, `--z-marca-topo` 4, `--z-grudado` 10, `--z-flutuante` 1000, `--z-aviso` 1100, `--z-modal` 2000 (valores do mockup, `camadas.css`; o plano reconcilia com a escala que o CMS já tem).
3. **Script de conferência**, modelo `prova-flutuantes.js` do mockup: para cada flutuante, em três posições do gatilho (centro da janela, colado embaixo, colado em cima), abre, espera e confere (a) `document.elementsFromPoint` no centro e nos quatro cantos devolve a própria dica ou um filho, (b) a caixa está inteira na janela, (c) mora em `#flut` e não cobre o gatilho, (d) Esc fecha e devolve o foco. Em 1440 e 390 px. Controle negativo obrigatório: uma caixa `absolute` dentro de uma célula da última linha, com `z-index` alto, **tem de reprovar** (no mockup reprova). O mockup passou 993 de 993 checagens em seis telas (369 em 1440, 279 em 768, 345 em 390).
4. Esc fecha e devolve o foco ao gatilho; clique fora e perda de foco fecham; uma aberta por vez.

**Não provado no mockup:** a lista do grupo da linha do tempo do Histórico foi portada para a camada nova sem dado para exercitá-la (nenhum vídeo tem trocas suficientes para formar grupo); toque real e rotação em aparelho; a prova mede com Chrome, e o dono usa Opera.

### 19.2 Cores, "não medido" e estados
- **Uma cor única de "não medido" em todas as telas: rosa com hachura.** Texto `#E59CC0` (`--nm`; 7,76:1 contra o cartão, 6,77:1 contra o fundo da hachura), fundo da hachura `#3A2232`, contorno `#B0678F` (`--nm-line`, 4,09:1). A hachura é a forma; a cor é o reforço. Vale no gráfico de impressões, na comparação, na lista, nas faixas de números e nos cartões. A cor anterior (violeta) saiu porque em deuteranopia se aproximava do azul do lado B (ΔE 10); o rosa tem ΔE 29 contra o azul do lado B, 63 contra o laranja, 33 contra a areia, 39 contra o azul dos cliques e 20 contra o ardósia do zero medido (também separados por forma). Decisão de cor a confirmar com o dono.
- **Tokens novos**, definidos num arquivo só e com `rgba` ou hex literais: `--nm`, `--nm-line`, fundo da hachura, `--lado-o`, `--lado-b`, `--lado-n`, `--terco-baixo` (`#F2C14E`, 9,86:1), `--im-cl` (`#38BDF8`, 7,73:1), `--im-zero` (`#7A8FA6`, 4,97:1). Os terços de cima e do meio reusam `--tier-high` e `--tier-mid`.
- **Cor nunca é o único sinal** (WCAG 1.4.1): forma (hachura, traço, círculo, barra, ▲ ● ▼ ＝), letra (A/B) e texto acompanham toda cor. Simulação de deuteranopia (matriz de Machado, severidade 1) sobre a comparação e o gráfico: os lados continuam distinguíveis, o "não medido" se separa pela hachura. Foi feita por script e filtro SVG, não pelo simulador do DevTools.
- **Sem `color-mix()` em CSS.** O navegador do dono, Opera, o renderiza transparente (memória `reference_colormix_renders_transparent`). Hoje a pasta de Competidores não usa `color-mix()` (VERIFICADO: só dois comentários que o proíbem, `_canais/canais.css:143` e `_canais/view-model.ts:155`).
- **Contraste dos pares novos:** todos acima de 4,5:1 (texto) e 3:1 (marca gráfica) contra o cartão, **calculados por script, não medidos no navegador** (A rever no fim, item 9).

### 19.3 Números e nulos
- **Cliques estimados: sempre em contagem, sem corte e sem percentual por vídeo.** O CSV de alcance não tem coluna de cliques (emenda 10 do spec de coleta); o número mostrado é **estimado**, impressões × CTR por dia e vídeo, somados, e a tela escreve "estimado". Isto altera a emenda 17 da v8 ("nenhuma tela mostra cliques"): a unidade do CTR (0 a 1) continua valendo, a tela não mostra o CTR, e passa a mostrar a contagem estimada com o rótulo. Como arredondar (por dia e vídeo, antes de somar, ou só no total) é a conferir no plano; a regra proposta é somar sem arredondar e arredondar uma vez, de modo que a soma dos vídeos bata com o total do canal. O mockup não mostra percentual nem do canal: qualquer percentual do total do canal (com intervalo de Wilson) fica fora até o dono pedir. Argumento da rodada 6: com 18 impressões o intervalo de 95% vai de 3% a 33%.
- **Nulo nunca vira zero.** Dia sem relatório, vídeo sem linha de diário, comentário sem contagem, canal sem posição: "não medido" com o motivo, ou a frase da tabela de dado ausente da seção. Zero medido é "0" (e é diferente, por forma e cor, de "não medido").
- **Views por dia com uma casa decimal abaixo de 10:** `0 → "0"`, `n < 10 → uma casa` ("0,3"), `10 ≤ n < 1.000 → inteiro`, `n ≥ 1.000 → milhar` (mockup, `dados.js:158`). Vale no cartão, na Lista e no cabeçalho. Borda não resolvida: um valor positivo menor que 0,05 vira "0,0"; o plano decide por "menos de 0,1" ou por mais casas.
- **`youtube_video_analytics.views` é o total da janela de 90 dias** (emenda 18); nunca vira "views por dia" nem impressão, nem é somado entre dias.
- **Horários em São Paulo**; só os dados dos canais próprios são "dia do YouTube", dito uma vez por seção com o ⓘ.
- **Sem entidade "criador"; TikTok fora** (emenda 19). Cada canal do YouTube é uma página; a comparação junta dois canais por seleção, sem chave comum.

### 19.4 Regras permanentes de projeto
- **Validação AUTENTICADA do CMS antes de promover** qualquer entrega que toque o CMS: `docs/ops/runbook-cms-e2e-local.md`. Vale para cada fase de A0 a A4; as rotas novas (`canal/<id>`, `comparar`) entram nela.
- **Nunca passar `next/link` nem componente importado num Server Component como prop para componente cliente.** Todo `Link` da grade, da lista, do pager, da comparação e do menu "Meu canal" é importado dentro de módulo `'use client'`, no modelo de `apps/web/src/app/cms/(authed)/_shared/cms-link.tsx`.
- **Server actions não são importadas direto em componente cliente:** fixar, pedir leitura, cancelar pedido e "Comparar" chegam por props.
- Leitura de `yt_own_*` com cliente de usuário respeita a RLS (`can_edit_site`); se o carregador usar `getSupabaseServiceClient()`, valida `canAdminSite(siteId)` antes.
- Teste que muda de expectativa (grupo "Seus canais" fixo no topo, `?fmt=`, painel que não abre mais, moldura do Histórico) vai no **mesmo commit** da mudança.
- Env com fallback e flags novas, se surgirem, ganham teste que apaga a variável.
- Mockup aprovado antes de qualquer tela (regra do dono): a seção 12.3 lista o que ainda não tem mockup.

## 20. A rever no fim
Pedido do dono em 10/10: a lista de pontos que o controlador do mockup acha fracos, para conferir **com tudo implementado**, não antes. São pendências de acabamento, não bloqueiam o aceite de cada fase, e cada uma diz em que fase aparece (cópia do roteiro, seção 3d, com a fase acrescentada).

| # | Ponto | Onde nasce |
|---|---|---|
| 1 | "Todos" na lista de Canais está pesado: "longos"/"Shorts" repetidos em cada célula; levar o rótulo para o cabeçalho da coluna. | A3, 15.3 |
| 2 | "escala √" embaixo de réguas é texto de engenheiro; vai para o ⓘ. | A3 e A4, 17.3 e 18.5 |
| 3 | A coluna Ritmo da tabela de produção (uploads por semana) não existe na lista do mockup. | A3, pergunta 6 |
| 4 | Um ⓘ por linha ao lado dos inscritos dá 72 paradas de Tab na lista de 70. | A3, 15.1 e seção 11 |
| 5 | A tela de comparação é densa (cinco colunas); a Leitura rápida ainda é uma linha comprida quando um lado ganha em muita coisa. | A3, 18.3 |
| 6 | Muitos "não medido" no lado do canal próprio; três linhas se resolvem com o L2 em produção (views por dia), conferir depois. | A3 e A4, 18.4 |
| 7 | Concorrente × concorrente é magro no mockup por falta de dados (só Leo Khev e o canal próprio têm vídeos); conferir com dados reais. | A3, 18.1 |
| 8 | Dica de uma linha do meio encostada no pé da janela ainda é cortada em produção (o conserto `45a9bbfb` cobre a linha de baixo e a última); some quando a dica ganhar camada própria na fase A. | A0, 19.1 |
| 9 | Não testados em nenhuma rodada: toque real, leitor de tela, rotação em aparelho, contraste medido na tela (foi calculado por script), outros navegadores além do Chrome. O dono usa Opera. | todas, 12.2 |
| 10 | A lista de grupo da linha do tempo do Histórico foi movida para a camada nova sem dado para exercitá-la. | A0 e A2, 19.1 |
| 11 | Empate na régua com um lado destacado afasta 2,6 px em vez de empilhar. | A3, 18.5 |
| 12 | Leitura da forja para comparação e para vídeo próprio: cartões de exemplo; são pacotes novos (L4). | fora da fase A, 17.4 e 18.8 |

Os itens 9 e 10 viram tarefa de verificação do plano de cada fase. O item 12 é o que mantém a leitura da forja de comparação e de vídeo próprio como "ainda não disponível" na fase A.
