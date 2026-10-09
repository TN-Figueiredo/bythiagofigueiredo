# Observatório em torno de canal e vídeo — telas

Data: 07/10/2026, emendado em 09/10/2026 · Estado: rascunho v8 (09/10/2026) · Base da v7: `staging` 6dd468ae; referências de código conferidas de novo em 09/10 sobre `staging` eb85a52b. Specs irmãos: `2026-10-07-coleta-canais-proprios-design.md` ("spec de coleta") e `2026-10-07-ab-lab-honesto-design.md` ("spec do A/B"). Mockup aprovado: `docs/superpowers/mockups/2026-10-07-pagina-canal/` (quatro rodadas, no `LEIAME.md`). Decisões do dono: `docs/superpowers/plans/2026-10-08-proximos-passos.md` ("roteiro"), seções 4, 5 e 6. Caminhos sem prefixo são relativos a `apps/web/src/app/cms/(authed)/youtube/competitors/`; `lib/` é `apps/web/src/lib/youtube/observatorio/`. Nos wireframes, 📌 🔍 ↗ ⋯ ⓘ representam ícones SVG de `_historico/icons.tsx` (`HIcon`), nunca emoji. A marca [INFERÊNCIA] indica afirmação sobre o código que não foi conferida.

## Emendas de 09/10/2026 (depois do mockup aprovado)

A v7 foi escrita antes do mockup. O dono aprovou o mockup em quatro rodadas e mudou decisões. **Regra de leitura: onde o texto do corpo e uma emenda discordarem, vale a emenda.** O corpo já foi reescrito para dizer o mesmo que as emendas (seções 3, 4, 5, 6, 12 e 14 inteiras; trechos de 7, 8, 10, 11 e 13); a lista abaixo fica como registro do que mudou e de onde veio. Onde o `LEIAME.md` do mockup e o roteiro discordam, vale o roteiro, que é mais recente; cada divergência está na seção 14.

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

## 1. Para quem e para quê
- Quem usa: o dono do canal e uma editora de vídeo, no desktop, tema escuro.
- Pergunta que a pessoa traz: "o que este canal publicou e o que deu certo?" e depois "o que aconteceu com este vídeo?".
- Hoje o caminho passa por "trocas" e por um painel de 404 px que mostra 5 vídeos. Passa a ser canal → vídeo.
- Precisa parecer produto que se vende: navegar não dá tranco e nenhum número é inventado.
- Nenhuma tabela nova de métricas. A grade exige as mudanças no carregador de 5.10; leitura por canal exige o trabalho de servidor de 7.3.
- Cada canal do YouTube é uma página. Não existe entidade "criador" que junte canais ou plataformas, e TikTok não faz parte deste spec.

**Vocabulário, igual em todas as telas.** "Sincronizar" e "sincronização": buscar dados de concorrente no YouTube. "Coleta": só os dados dos canais próprios. "Leitura": só o texto da forja. "Resumo": só a faixa de números do vídeo. "Múltiplo": quantas vezes o vídeo fica acima do normal do canal, com o nível por escrito: de 2 a 5, "alto"; de 5 a 10, "muito alto"; 10 ou mais, "topo"; abaixo de 2, sem palavra. "Trocas": mudanças de título e de thumbnail nos últimos 30 dias, a mesma janela em todo lugar. Horários em São Paulo; só os dados dos canais próprios são "dia do YouTube", dito uma vez por seção, no cabeçalho, com o botão ⓘ.

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
| Tipos | Inter (`--font-sans`) na interface; JetBrains Mono (`.num`/`.mono`, `tabular-nums`) só em números; Fraunces só no título da página e no texto das leituras | `CONVENCOES.md`, "Tipografia e números" |
| Botões | `.obs-ch-btn` (34 px, `chrome.css:57`), `.obs-ch-ghost`, `.obs-ch-forja-solid` (`chrome.css:67`). A tela nova adota 34 px. Os `.btn` de cada tela não são copiados: 36 px em `canais.css:33` (32 px é `.btn.small`), 34 px em `historico.css:37` | `_chrome/chrome.css` |
| Largura, grade, raios | conteúdo em `max-width:1240px` (`chrome.css:44`); a grade do canal tem 5 colunas em 1440 px, com `gap:14px` (grade própria: a de Outliers, `repeat(auto-fill,minmax(232px,1fr))` em `_outliers/outliers.css:86`, não é reaproveitada); raio 8 px cartão, 6 px controle, 4 px selo | mockup `canal.css`; contagem nos seis `.css` |
| Foco | `outline:2px solid var(--accent); outline-offset:2px`, nunca cortado pelo `overflow` do cartão | `canais.css` |

**Reuso exige promoção.** As classes estão presas a uma tela por seletor: `.dstats`, `.btn`, `.youtag` sob `[data-obs-screen="canais"]`; `.stamp` sob `[data-obs-screen="insights"]`; `.obs-out-card`, `.obs-out-ttl` sob `.obs-out`. O plano as promove para `_chrome/` com prefixo `obs-ch-`. `Thumb` e `MultBlock` (`_outliers/outlier-card.tsx`) recebem hoje o `OutlierCardView` inteiro; passam a aceitar uma prop mínima.

Princípios destas telas:
1. **A thumbnail é o assunto.** Em Capas ela aparece inteira, em 16:9. O corte 2,6:1 de Outliers (`outliers.css:92`) não se repete. Toda thumbnail destas telas pode ser ampliada (6.3).
2. **Os números não mudam de lugar.** Views, views/dia e múltiplo ficam na mesma ordem. A ordenação só muda qual fica em `--text` com peso 600.
3. **O que falta ocupa o lugar do que faltou.** Célula sem dado mostra uma frase curta ("não medido", "sem contagem"). Nunca "0" inventado, nunca "—" sozinho. Vídeo que não pode ser ordenado vai para o fim, sob um divisor com contagem; nenhum some.
4. **A página não se mexe enquanto carrega.** Cabeçalho, abas e controles ficam; só o miolo troca.
5. **Teal é a forja, laranja é a ação da pessoa.** Texto do modelo vem sob o selo, em Fraunces; frase do site fica fora do selo, em Inter (como em `_insights/reading-hero.tsx`).
6. **O conteúdo começa cedo.** Em 1440×900 a grade do canal começa a no máximo 300 px do topo. No Histórico do vídeo, que é a tela de produção, o gráfico e as três raias cabem sem rolar (terminam em 737 px no mockup); "Antes e depois" começa abaixo da dobra, e isso foi aceito junto com a decisão de não perder nada da tela.

## 3. Mapa de navegação
`link` hoje tem `canais`, `mudancas`, `outliers`, `insights`, `historico` (`lib/links.ts:67-154`). A rota `canal/[id]` ainda não existe. Na página do canal a moldura do Observatório mostra só a trilha (sem as abas de seção nem a barra de nicho); a seção de origem continua sendo "Canais". A moldura do Histórico do vídeo é assunto da pergunta 2 da seção 14.

| Tela | URL | Helper |
|---|---|---|
| Canal | `/cms/youtube/competitors/canal/<id>?tab=videos\|trocas\|leitura\|retencao&fmt=todos\|longos\|shorts\|fixados&sort=recentes\|vistos\|multiplo\|vpd&dir=asc\|desc&q=<texto>&ver=capas\|lista&n=<quantos antigos carregados>&video=<id, só na aba Trocas>` | novo `link.canal(id, p)`; os padrões (`tab=videos`, `fmt=todos`, `sort=recentes`, `ver=capas`, `n=0`) ficam fora da URL. Aceita `from` e `back` só quando vem de Outliers, Mudanças ou do vídeo |
| Histórico do vídeo | `/cms/youtube/competitors/video/<id>?from=canais&back=…&ids=…&troca=<id da troca>&range=7\|30\|90\|tudo` (rota que já existe) | `link.historico` (`lib/links.ts:136`) ganha `troca` e `range`; o nome do helper e o valor `from=canais` não mudam |

- `n` conta só os vídeos antigos já carregados pelo botão "Carregar mais" (0, 40, 80…), não o total na tela. É o que faz o Voltar reabrir a grade com os mesmos cartões.
- `troca` leva o identificador que o Histórico já usa para cada troca (`changeId`, `_historico/view-model.ts:541`). O mockup usa o instante da troca em milissegundos só porque não tem banco. [INFERÊNCIA: o `changeId` é estável entre duas cargas da página; o plano confirma antes de pôr o valor na URL.]
- `range` ausente passa a significar 30 dias; o vídeo inteiro passa a ser `range=tudo` (hoje é o contrário: `parseRange`, `_historico/many-versions.ts:16`).
- O id do canal na URL é o id interno (`competitor_channels.id`), que não muda quando o canal troca de @.
- `link.canais({ channel })` continua aceito por um ciclo. Se ele redireciona para `link.canal(id)` ou continua abrindo o painel lateral depende da pergunta 5 da seção 14.
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
| Miniatura na raia Thumbnail do gráfico | clique simples: vai ao cartão da versão, como hoje; clique duplo: abre o visualizador | — |

Trilha do Histórico vindo do canal: "Canais › <canal> › Histórico do vídeo". O segundo item já existe como `crumbs.sub` (`_historico/pager.tsx:12`, montado em `_historico/view-model.ts:592`); hoje ele aponta para Canais com o painel aberto e passa a apontar para a página do canal. O terceiro item não muda (`pager.tsx:13`).

## 4. Fases de entrega
A v7 abria com um paliativo no painel lateral de Canais (reordenar as abas e pôr links). Ele deixou de fazer sentido: a fase A entrega a própria página do canal, e mexer no painel antes disso seria trabalho jogado fora. Nada do painel muda neste spec, salvo o destino dos links, que depende da pergunta 5 da seção 14.

Cada fase tem plano próprio. A ordem geral do trabalho está no roteiro, seção 4; a fase A deste spec é a etapa 5 de lá.

### 4.1 Fase A (mockup aprovado; pode ser planejada depois do "pode" do dono neste spec)

| # | Item | Onde está descrito | Critério de aceite (verificável) |
|---|---|---|---|
| A1 | Rota e carregador da página do canal | 3, 5.9, 5.10 | `/cms/youtube/competitors/canal/<id>` abre para concorrente; id desconhecido mostra "Canal não encontrado" dentro da moldura, com status 200 e sem erro no Sentry; um teste de `load` por caso de dado ausente de 5.9 afirma o valor nulo |
| A2 | Cabeçalho do canal | 5.3 | Em 1440×900 o cabeçalho tem no máximo 150 px de altura; os números batem com os que o painel de Canais mostra hoje para o mesmo canal; a linha 3 soma certo (acompanhados + fixados antigos + mais antigos = total) |
| A3 | Vista Capas, 5 por linha | 5.1, 5.4 | Em 1440×900, com a moldura real do CMS: 5 colunas, 10 cartões inteiros na carga, todos com a mesma altura com ou sem dado; a grade começa a no máximo 300 px do topo do conteúdo; sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px |
| A4 | Vista Lista | 5.1 | 8 ou mais linhas inteiras na carga em 1440×900; o cabeçalho de coluna ordena e inverte; abaixo de 820 px vira pilha com rótulo e valor |
| A5 | Controles (formato, ordenação, busca, vista) | 5.5 | Cada troca atualiza a tela em menos de 100 ms sem indicador e sem navegar; a URL reproduz o estado ao recarregar; "Longos + Shorts + formato não confirmado = Todos"; os três números não mudam de ordem ao reordenar |
| A6 | "Carregar mais" | 5.6 | Abre só com os acompanhados e os fixados; o botão fica centralizado no fim e traz 40 por clique; não há carga ao rolar; depois do clique a rolagem não muda, o foco vai para o primeiro cartão novo e o leitor de tela ouve "Mostrando N de M vídeos…"; o botão some quando não falta nenhum; `n` vai para a URL |
| A7 | Aba Trocas | 5.7 | Um cartão por vídeo e um botão por cartão (N vídeos com troca = N botões); cartão com duas ou mais trocas tem um link "Abrir nesta troca" por troca; cartão com uma troca não tem o link; a frase de efeito de cada troca é a mesma que o Histórico mostra para ela |
| A8 | Chegada ao Histórico pela troca | 6.2 | Com `troca=` válido: a troca chega selecionada em "Antes e depois" com a linha "Aberta pela aba Trocas do canal: …", marcada no gráfico e na raia, com o foco no marcador dela; com `troca=` inválido ou ausente a tela abre como hoje, sem erro |
| A9 | Voltar e pager a partir do canal | 3, 6.5 | Voltar (do navegador ou pela trilha) devolve a aba, a rolagem e o foco: no cartão do último vídeo visto (grade), no botão do cartão ou no link da troca (aba Trocas); Anterior/Próximo não fazem o histórico do navegador crescer; a frase de posição descreve a lista de origem |
| A10 | Visualizador de thumbnail | 6.3 | Abre pelos seis gatilhos de 6.3; Esc fecha e devolve o foco ao gatilho; o fundo fica inerte; a linha de resolução mostra o arquivo e o tamanho medidos; versão sem imagem mostra o quadro com a explicação e deixa Baixar e Abrir original apagados; o clique simples na raia continua indo ao cartão da versão |
| A11 | Gráfico em 30 dias por padrão | 6.4 | Sem `range` na URL o gráfico mostra 30 dias e o seletor 7/30/90/tudo aparece em todo vídeo com série; `range=tudo` mostra o vídeo inteiro; a faixa "antes de 03/10, sem registro" continua |
| A12 | Nada do Histórico se perde | 6.1 | Os testes existentes do Histórico passam sem alteração de expectativa, fora os do padrão de período (A11); a lista de 6.1 é conferida item a item na tela |
| A13 | Regras de projeto | 2, 10, 11 | Nenhum `color-mix()` no CSS novo; todo horário em São Paulo; nenhum `Link` passado como prop a partir de Server Component; validação autenticada da rota nova antes de promover (`docs/ops/runbook-cms-e2e-local.md`) |

Os itens A11 e A12 mexem numa tela que está em produção e é aberta também a partir de Mudanças, Outliers e Insights; o plano trata os dois como mudança de comportamento para todas as origens.

### 4.2 O que fica para depois, e do que depende

| Item | Depende de | Onde está descrito |
|---|---|---|
| Cartão novo da leitura da forja no Histórico (e o botão do cabeçalho que rola até ele) | aprovado no mockup, sem servidor novo; **não está** na lista da etapa 5 do roteiro. Ver a pergunta 1 da seção 14 | 7.1, 7.2 |
| Aba Leitura do canal com leitura própria ("Pedir leitura deste canal à forja") | o trabalho de servidor de 7.3 (roteiro, etapa 8) | 5.8, 7.3 |
| Página e Histórico de canal próprio: selo "seu canal", série diária real, percentual assistido | lote L2 da coleta (série) e L3 (percentual assistido); mockup ainda não feito | 5.2, 6.6, 8 |
| Aba e seção Retenção | lote L3 da coleta; mockup ainda não feito | 8 |
| Telas do A/B | spec do A/B e mockup ainda não feito | 9 |
| Impressões e CTR do canal próprio | lote L2 da coleta (`yt_own_video_reach_daily`); mockup ainda não feito | 8.3 |
| Teclado e leitor de tela exercitados de verdade, zoom de 200 a 400%, movimento reduzido | não foram exercitados no mockup; viram tarefa de verificação do plano da fase A | 11, 12 |
| Bordas que reprovam contraste | pendência separada, do CMS inteiro | 11, linha 12 |

## 5. Página do canal
Aprovada no mockup (`canal.html`, rodadas 1, 3 e 4) para canal de concorrente. Os números dos wireframes são os do canal do mockup (Leo Khev, 133 vídeos guardados, 50 acompanhados).
### 5.1 Wireframe, 1440×900 (concorrente, vista Capas, que é a vista padrão)
```
 Canais › Leo Khev                                                               Horários em São Paulo
 (av) Leo Khev  [Viagem ▾]  1,5 mil inscritos                                   [Abrir no YouTube] [⋯]
      0,2 longo + 0,1 Short por semana · 0,3 views/dia nos longos · +1,3% inscritos em 30 d  ⓘ
      Sincronizado há 4 h (07/10 18:03) · 133 vídeos: 50 acompanhados, 1 fixado antigo,
      82 mais antigos sem contagem diária                                        (cabeçalho ≤ 150 px)
  Vídeos 133    Trocas 7 em 30 d    Leitura       133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado.
 ──────────────────────────────────────────────────────────────────────────────────────────────────────
 [Todos 133|Longos 61|Shorts 71|Fixados 3]  [Mais recentes ▾]  [🔍 Buscar por título   ]  [Capas|Lista]
 ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  ← ≤ 300 px
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
No cartão real os três números ficam em **três colunas fixas**, com o valor em cima e o rótulo embaixo; o desenho acima só não tem largura para mostrá-las lado a lado. Ao rolar, só a linha de controles fica presa. Medido no mockup em 1440×900: cabeçalho de 79 px, grade começando a 297 px do topo da tela simulada, 5 colunas, 10 cartões inteiros na carga. A moldura do mockup é estática e copia a altura do mockup de 06/10, não o `YouTubeShell` real: a folga é de 3 px, e por isso o aceite A3 mede de novo com a moldura real.

Vista **Lista** (`ver=lista`): tabela, linha de 56 px, 9 linhas na carga no mockup (meta: 8 ou mais); o cabeçalho de coluna ordena. O bloco "Carregar mais" é o mesmo, no fim da tabela.
```
 Vídeo                                          Publicado  Views    Views/dia  Múltiplo         Curtidas  Comentários  Trocas
 [thumb 96 12:41] Como morar em Lisboa gast…    há 3 d     84 mil   6,1 mil    3,4× alto        2,1 mil   140          2
 [thumb 96 Short] 3 erros na imigração          há 5 d     1,2 mi   40 mil     8,2× muito alto  40 mil    não medido   0
```
### 5.2 Canal próprio e ~390 px
O canal próprio **não foi ao mockup** e não entra na fase A (seção 4.2; pergunta 5 da seção 14). O texto abaixo é o da v7 e vale como ponto de partida do mockup que falta.
```
 (av) tnfigueiredotv  [seu canal] [PT]  [Viagem]  @tnfigueiredotv ↗  1,9 mil inscritos
  Vídeos 35     Trocas —     Leitura     Retenção
 ─────────────────────────────────────────────────────────────────────────────────────────
 ┌ thumb      12:41 ┐   cartão do canal próprio: "1,2 mil views" e "sem views diárias";
 │ Título…          │   sem múltiplo e sem selo de troca
 └──────────────────┘
```
Em canal próprio o carregador monta os vídeos sem série diária e sem versões de capa (5.10). Por isso: a aba "Trocas" mostra "—" e, dentro dela, "Trocas de título e capa dos seus vídeos ainda não são lidas nesta tela."; a página do vídeo próprio diz "Sem série diária do seu canal ainda." no lugar do gráfico.
```
 ‹ Canais                                   (~390 px)
 (av) Nomad Capitalist BR   [Viagem ▾] @nomadbr ↗  212 mil inscritos
 1,5 longo + 3,0 Shorts por semana · 4,2 mil views/dia nos longos · +2,1% em 30 d
 Sincronizado há 6 h · 51 vídeos
 Vídeos 51 │ Trocas 7 em 30 d │ Leitura      ← abas e filtro rolam na horizontal; alvos de 44 px
 [Todos|Longos|Shorts|Fixados]  [Mais recentes ▾]  [Capas|Lista]  [🔍 Buscar…]     (nada fica preso)
 ┌ thumb 16:9 ──────── 12:41 ┐   uma coluna. Lista vira pilha: cada vídeo é um bloco
 │ Título em até duas linhas │   com rótulo e valor ("Views: 84 mil").
 └ 84 mil views  6,1 mil/dia  3,4× alto ┘
```
A largura de ~390 px foi ao mockup para concorrente. Diferença em relação ao desenho acima: a Lista vira pilha já abaixo de 820 px (duas colunas de blocos até 480 px, uma abaixo disso), porque nove colunas não cabem em 768 px sem rolagem horizontal. Nenhum alvo fica abaixo de 44 × 44 px com toque.
### 5.3 Cabeçalho (até 150 px; 79 px no mockup)
- **Linha 1:** avatar, nome (`h1`, Fraunces, 22 px), selo "seu canal" quando próprio, nicho, @ com link externo **quando o canal tem um** (no painel de hoje o @ já é opcional, `_canais/channel-drawer.tsx:117`; o canal do mockup não tem), inscritos; à direita "Abrir no YouTube" e o menu ⋯ ("Sincronizar só este canal"; "Remover canal…" só para quem administra). `NicheSelect` é editável para todos em concorrente; em canal próprio é só leitura para a editora (`channel-drawer.tsx:116`).
- **Linha 2, em texto:** os números atuais, sem mudança, calculados como o painel de Canais já calcula em `DrawerView.stats` (`_canais/view-model.ts:436-460`): ritmo ("0,2 longo + 0,1 Short por semana", `obs.cadence`), views por dia nos longos (`S.vpdMedian`) e inscritos em 30 dias (`S.growth30`). Com os inscritos da linha 1, são os quatro números do cabeçalho. Um ⓘ só, "Sobre os números do canal", explica as três bases ("mediana em 14 longos, últimos 90 dias"; de quanto para quanto foram os inscritos). O painel de hoje mostra também "Engajamento"; ele não aparece no mockup aprovado (pergunta 3 da seção 14).
- **Linha 3:** "Sincronizado há 4 h (07/10 18:03) · 133 vídeos: 50 acompanhados, 1 fixado antigo, 82 mais antigos sem contagem diária". As partes que valem zero somem da frase. Em `--warning-text`, começando por "Sincronização atrasada: a última foi…", quando a sincronização está atrasada; em `--danger`, com "Erro:", quando falhou.
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
- A descrição também é observada (o Histórico tem a raia "Descrição" e o painel de hoje fala em "título, thumbnail ou descrição", `view-model.ts:497`), mas a aba aprovada conta só título e thumbnail. Ver a pergunta 6 da seção 14.
### 5.8 Abas Leitura e Retenção
- **Leitura.** O mockup aprovado mostra o cartão da seção 7.1 no escopo do canal. Leitura própria do canal depende do trabalho de servidor de 7.3 e não entra na fase A. O que a aba mostra na fase A é a pergunta 1 da seção 14.
- **Retenção.** Só em canal próprio (seção 8). Não foi ao mockup e depende do lote L3 da coleta; não entra na fase A.
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
| Múltiplo sem base | "—" | "poucos vídeos para comparar (2; precisa de 5)" [INFERÊNCIA: o mínimo real sai de `lib/multiplier.ts`]; vai para "Sem múltiplo ainda" |
| Canal em primeira sincronização | "Buscando vídeos" | faixa sobre a grade: "Sincronizando: 12 de 48 vídeos. Os números aparecem quando a sincronização terminar." (a palavra é "sincronizar", da seção 1) |
| Sincronização atrasada | só na célula | linha 3 em `--warning-text` + faixa "Atenção: dados de 04/10 09:02. A sincronização está atrasada." |
| Sincronização com erro | só na célula | faixa "Erro: a última sincronização falhou em 06/10 09:00. Os números são de 05/10." |
| Série ou capas de canal próprio | não existem | "sem views diárias" no cartão; frases de 5.2 |
| Vídeo fora dos acompanhados (mais antigo que os `video_limit` mais recentes) | não aparece no painel | só entra por "Carregar mais" (5.6); views com a data da contagem no menu; "views/dia e múltiplo: não medido" quando faltam os dois; no menu, "Este vídeo está fora dos 50 acompanhados, então não há contagem diária dele." |
| Views por dia zero medido | "0" | regra de casas decimais em aberto (pergunta 8 da seção 14); nunca confundir com "não medido" |

### 5.10 Trabalho no carregador (pré-requisito da grade)
- `ObsVideo.comments` passa a `number | null` (hoje `v.comment_count ?? 0`, `lib/load.ts:278`; o tipo é `comments: number`, `lib/types.ts:30`). Todo leitor é revisto.
- `ObsVideo.isShort: boolean | null` ao lado de `fmt` (hoje `v.is_short ? 'short' : 'long'`, `load.ts:240`).
- Lista e contagem dos vídeos sem data, por canal (hoje filtrados em `load.ts:234-235` e, nos próprios, `:304`).
- `loadChannelDataset(siteId, channelId)`: função nova, para um canal só. A leitura por canal já existe e já traz **todos** os vídeos guardados do canal, não só os acompanhados (`loadChannelRows`, `lib/load-channel.ts:20`), e o cache por canal também (`cachedPack`, `lib/load-page.ts:59`, que hoje não é exportado). Falta a função que monta o conjunto de dados de um canal sem ler os outros, e reduz as leituras vivas (`loadLiveRows`) ao que a tela usa. O múltiplo só compara vídeos do próprio canal, então um canal basta.
- `ChannelVideoView`: campos brutos (id, título, `pub` em ms, views, `vpd7`, `mult`, `fmt`, `isShort`, `pinned`, `pinState`, `tracked`, `dur`, likes, comments, `swaps` dos últimos 30 dias, `thumbSrc` = blob atual ou `mqdefault`) e, ao lado, o texto já formatado. A v7 falava em "até 200 vídeos no pacote; 60 por vez"; passa a valer 5.6: acompanhados e fixados na carga, antigos de 40 em 40. Se os antigos já vêm no primeiro pacote ou são pedidos a cada clique é decisão do plano, com uma condição: o clique não pode mover a rolagem nem mostrar esqueleto de página inteira.
- `ObsVideo.tags` (a coluna já vem em `VIDEO_COLS`, `load.ts:71`, mas `rowsToDataset` não a mapeia) saiu da fase A: a seção de tags era da página de vídeo nova, que não é mais feita (seção 13).
- Canal próprio: série e capas passam a vir de `yt_own_video_daily` (lote L2, em implementação em 09/10) e `yt_own_video_meta_daily` (L1a, em produção) do spec de coleta. Até a tela de canal próprio ser desenhada, valem as frases de 5.2. `youtube_video_analytics.views` é total de 90 dias e nunca alimenta "views por dia".
- Testes de `load`: um vídeo por caso (comentário nulo, marca nula, sem data, vídeo fora dos acompanhados, canal próprio sem série), afirmando o valor nulo, nunca o padrão.

## 6. Histórico do vídeo: a tela de produção, com três acréscimos
A v7 desenhava aqui uma página de vídeo nova. O dono a reprovou na rodada 2 do mockup, por ser mais pobre que a tela que já existe. Passa a valer: o clique num vídeo do canal, ou numa troca, leva ao **Histórico do vídeo de produção** (`/cms/youtube/competitors/video/<id>`), e **nada dele se perde**. Entram três coisas: a chegada com a troca destacada (6.2), o visualizador de thumbnail (6.3) e o cartão novo da leitura da forja (6.5, fora da fase A até a pergunta 1 da seção 14 ser respondida). Mudam dois comportamentos: o período padrão do gráfico (6.4) e de onde vêm a trilha e o pager quando a pessoa chega pelo canal (6.5). O mockup aprovado é `video.html`, que copia a tela de produção e marca cada mudança com "rodada 3" ou "rodada 4".
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
- Regra nova deste spec, que o mockup não exercitou: se a troca de `troca=` for mais antiga que o período padrão de 30 dias (6.4), o gráfico abre no menor período que a inclui. Ver a pergunta 7 da seção 14.

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
- **Botão do cabeçalho.** "Pedir leitura à forja" continua no cabeçalho (`ForjaAskButton`, `_historico/video-reading.tsx:29`, na linha `.frow` de `historico-screen.tsx:129`) e passa a **rolar até o cartão**, com o foco nele. Hoje ele envia o pedido direto, sem sair do lugar (`video-reading.tsx:34-44`). Se o clique também envia o pedido é a pergunta 4 da seção 14. Se já existe uma situação (pedido em andamento, leitura pronta), ele só rola e o status diz "A leitura da forja já tem uma situação; ela está logo abaixo."
- **Trilha vinda do canal:** "Canais › <canal> › Histórico do vídeo". O item do canal leva à página do canal (seção 3).
- **Pager vindo do canal:** anda pela lista de origem, passada em `ids=`, e a frase de posição a descreve. Da grade: "vídeo 7 de 51 de Leo Khev (longos, do mais novo ao mais antigo)", com o filtro e a ordenação que estavam ativos. Da aba Trocas: "vídeo 3 de 5 com trocas de Leo Khev (trocas dos últimos 30 dias, da mais recente à mais antiga)". Hoje, com `from=canais`, a frase é fixa em "(longos acompanhados, do mais novo ao mais antigo)" (`_historico/view-model.ts:593`); precisa passar a ler a origem em `back=`.
- **Anterior/Próximo** substituem a entrada do histórico do navegador e deixam o foco no botão; o status lê "Vídeo 8 de 51: <título>". `[` e `]` fazem o mesmo, só com o foco no título ou dentro do pager.
- **Voltar** (do navegador, ou o item do canal na trilha): devolve a página do canal na mesma aba, com a mesma rolagem, e o foco no cartão do último vídeo visto ou no botão ou link da troca (seção 3).
### 6.6 O que não entra agora
- **Canal próprio.** O Histórico de vídeo próprio (selo "seu canal", série diária de `yt_own_video_daily`, percentual assistido, seção "Retenção") não foi ao mockup e depende dos lotes L2 e L3 da coleta. Até lá, o vídeo próprio abre como abre hoje.
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

**No Histórico do vídeo** há dois botões de pedido: o do cabeçalho ("Pedir leitura à forja"), que rola até o cartão e põe o foco nele, e o do cartão, que envia o pedido (6.5; pergunta 4 da seção 14). Os dois são teal; só o do cartão conta como "o botão do cartão".

**Leitura sem efeito medido.** A contagem diária por vídeo começa em 03/10 e a comparação pede 7 dias depois da troca, então por semanas nenhuma troca terá efeito medido. Nesse caso a leitura:
- abre com o que fazer, antes de qualquer constatação: "O que fazer: esperar 7 dias depois da troca antes de tirar conclusão; a leitura da mais recente fica possível em 13/10." A data é a do motor de efeito, a mesma de "Antes e depois";
- pode citar o desempenho anterior à troca, quando existe ("Antes da troca, o vídeo ganhava 3,0 views por dia (média de 2 dias de registro, até 05/10)"), e diz "não há registro diário" quando não existe;
- nunca afirma causa: toda frase que cita uma troca termina com "não prova causa";
- só cita o que a forja recebe de concorrente: views públicas, títulos, thumbnails, datas e trocas. Nada de CTR, retenção, impressões, curtidas ou comentários.

Isso é regra para o texto que a forja escreve e para o que o validador aceita; o site não reescreve a leitura. Todo texto de leitura do mockup foi escrito à mão, como exemplo: a forja ainda não produziu uma leitura real em produção.

**Quem vê os botões:** quem pode editar o site (o dono e a editora) vê e usa os quatro e "Cancelar pedido" (conferido em 09/10: pedir e cancelar passam pelo mesmo guarda de edição do site, `sessionContext`, `forja-actions.ts:28-33`). O botão do rodapé do painel de canal, que pede `resumo-trocas` do nicho inteiro sob rótulo de canal (`_canais/drawer-forja.tsx:39`), sai junto com o painel de concorrente (pergunta 5 da seção 14); enquanto o painel existir, ele fica como está.

Texto sob o botão apagado:
- Antes do primeiro pedido (botão aceso): "Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje."
- Leitura por canal: "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo."
- Pedido em andamento: "Há um pedido de 06/10 14:58 ainda em andamento."
- Limite do dia usado (um por tipo e nicho, `lib/forja/quota.ts`): "Já houve uma leitura de Viagem hoje. Libera amanhã às 00:00."
### 7.2 Quatro situações
A pessoa vê uma de quatro situações; o estado do código vira o detalhe da frase.

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

## 8. Retenção dos canais próprios
Fora da fase A: não foi ao mockup e depende do lote L3 da coleta (seção 4.2). Em 09/10 a coleta tem L1a e L1b em produção e o L2 em implementação (`yt_own_video_daily` e `yt_own_video_reach_daily`).
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
- **Impressões e CTR:** `yt_own_video_reach_daily`, valor de **um** dia, o último com linha ("em 04/10"). A unidade está fixada: no CSV real `thumbnail_ctr` vem de 0 a 1; a tela multiplica por 100 e mostra percentual com uma casa ("4,2%"). O CSV **não tem coluna de cliques**: nenhuma tela mostra cliques nem os estima a partir de impressões e CTR.
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
| Pedir leitura | o botão vira situação na hora; se o servidor recusar, volta e diz o motivo | < 100 ms | linha de situação |

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
| 12 | Contraste e tamanho (1.4.3, 1.4.11) | O mockup traz a tabela "par → razão medida" de todo token de texto e de borda de componente. Rever: `--dim` sobre `--surface-2`; `--forja` 12 px sobre `--forja-subtle`; `--tier-top` e `--tier-mid` em texto pequeno; `--warning-text` sobre `--warn-subtle`. Borda de selo em cor sólida ≥ 3:1. Texto ≥ 12 px. Medido no mockup: todo par de texto passa. Reprovam como componente os tokens de linha do produto (`--border-strong` 1,55:1, `--border` 1,31:1, `--border-subtle` 1,18:1, `--forja-line` 2,11:1); onde a borda é o que identifica o controle (busca, ordenação, segmento ativo), estas telas usam `--dim` ou `--muted` | medir cada par: texto 4,5:1; texto grande e componente 3:1 | Texto: sim, par reprovado bloqueia. Borda nos tokens de linha: não; é pendência separada, do CMS inteiro (decisão do dono) |
| 13 | Cor nunca sozinha (1.4.1) | Nível do múltiplo por escrito; situações da forja com ícone distinto para atraso e para falha; faixas com "Erro:" ou "Atenção:" | captura em escala de cinza: tudo continua distinguível | Sim |
| 14 | Atualização automática (2.2.2, 4.1.3) | A situação da forja anuncia (`polite`) só quando muda; "atualizado há 1 min" em texto; botão "Pausar atualização automática" | deixar o cartão aberto 5 min com leitor de tela; pausar | Sim |
| 15 | Foco após navegar (2.4.3) | Navegação cliente: foco no `h1`. Voltar: foco no cartão do último vídeo visto. Anterior/Próximo: foco continua no botão, status "Vídeo 8 de 51: <título>", `aria-disabled` no fim da lista. "Carregar mais": foco no primeiro cartão novo, sem mover a rolagem, e o status diz "Mostrando 91 de 133 vídeos. 40 vídeos antigos carregados.". Chegada pela troca: foco no marcador da troca (6.2). Voltar para a aba Trocas: foco no botão do cartão ou no link da troca. Esqueleto com `aria-hidden` e "Carregando…" para leitor de tela; miolo com `aria-busy` | navegar canal → vídeo → próximo → voltar só com teclado | Sim |
| 16 | Tamanho do alvo (2.5.8) | 24×24 sempre; 44×44 sob `pointer:coarse` **e** em viewport ≤ 900 px (hoje há alvos de 32 e 40 px em `chrome.css`) | `getBoundingClientRect` em todo controle, nas duas condições | Sim |
| 17 | Truncamento e refluxo (1.4.10, 1.4.4) | Texto truncado tem o nome inteiro no nome acessível. Em 320 px e zoom 200–400%, tabelas viram pilhas com rótulo; só gráfico e faixa de abas rolam na horizontal | 320 px e zoom 400%: sem rolagem horizontal da página | Sim |
| 18 | Texto alternativo, idioma, datas, dicas, avisos | `alt=""` na thumbnail dentro do link com título; na comparação, rótulo + período. `lang` no título e nas tags de canal em outro idioma. Ícones decorativos com `aria-hidden`. Datas em `<time datetime>`. Links externos dizem "abre em nova aba". Nada explicado só em `title`: botão ⓘ com nome único ("Sobre o múltiplo de <título>") e popover que fecha com Esc. Aviso de tela: `status` para sucesso, `alert` para erro, pelo menos 6 s, com fechar | inspeção do DOM e leitor de tela nas duas telas | Não |

Movimento: rolagem suave, esmaecimento e transição de elemento compartilhado só sem `prefers-reduced-motion: reduce`. Fundos translúcidos só com os rgba literais da seção 2, nunca `color-mix()` (em alguns navegadores ele sai transparente). Horários sempre em São Paulo.

A coluna "Bloqueia o mockup?" foi escrita antes do mockup. Para a página do canal e para o Histórico ela já foi respondida em 12.2: o que foi medido passou, e o que não foi exercitado (leitor de tela, teclado completo, zoom, movimento reduzido) vira verificação do plano da fase A. Para os mockups que faltam (12.3) a coluna continua valendo como está.

## 12. Mockups: o que já foi aprovado e o que falta
A v7 pedia quatro mockups. O primeiro foi feito em quatro rodadas e aprovado; o segundo foi feito e reprovado, e virou outra coisa; os outros dois ainda não existem. Pasta: `docs/superpowers/mockups/2026-10-07-pagina-canal/` (servir com `python3 -m http.server 8791 --bind 127.0.0.1` dentro dela).
### 12.1 Aprovado pelo dono

| O quê | Rodada | Arquivo do mockup |
|---|---|---|
| Página do canal de concorrente: vista padrão Capas, 5 por linha em 1440 px, Lista, controles, estados de carregando, erro, primeira sincronização, atrasada, sem vídeos e busca sem resultado | 1 e 3 | `canal.html`, `canal.js` |
| "Carregar mais" por botão, centralizado, de 40 em 40, sem carga automática; os antigos entram com aviso | 3 e 4 | `canal.js` |
| Cabeçalho do canal com os números atuais | 3 | `canal.js` |
| Aba Trocas: um cartão e um botão por vídeo; "Abrir nesta troca" por troca | 4 | `canal.js` |
| O destino é o Histórico do vídeo de produção, sem perder nada | 3 | `video.html`, `video.js`, `hist-dados.js` |
| Chegada com a troca destacada | 3 | `video.js` |
| Visualizador de thumbnail; na raia do gráfico, clique duplo amplia | 4 | `viewer.js`, `viewer.css` |
| Gráfico em 30 dias por padrão; a faixa "antes de 03/10, sem registro" fica | 3 | `video.js` |
| Thumbnails continuam na seção de versões | 3 | `video.js` |
| Cartão novo da forja no lugar do de hoje; o botão do cabeçalho rola até ele | 2 e 3 | `forja.js` |
| Leitura sem efeito medido abre com o que fazer e pode citar o desempenho anterior, sem afirmar causa | 3 | `forja.js` |

Reprovado: a página de vídeo nova da rodada 2 (faixa "Resumo", barra presa, tira de capas, "Versões" sem thumbnails).

Decidido sem mockup novo: bordas que reprovam contraste são pendência separada, do CMS inteiro.
### 12.2 O que o mockup provou com medida, e o que não provou
Medido no Chrome, em 1440×900, servido por HTTP: 10 cartões inteiros em Capas e 9 linhas em Lista na carga; cabeçalho do canal de 79 px; grade a 297 px do topo; sem rolagem horizontal em 1440, 1280, 1024, 768, 390 e 320 px; 2 paradas de Tab por cartão (24 em 12 cartões); troca de filtro em 16 a 29 ms, sem indicador; "Carregar mais" indo de 51 a 91, 131 e 133 sem mover a rolagem; ida e volta entre a aba Trocas e o Histórico com foco e rolagem preservados; o visualizador abrindo, ampliando, comparando e devolvendo o foco. Todo par de texto passou de 4,5:1.

**Não provado, e por isso vira verificação do plano da fase A** (não pede mockup novo): leitor de tela de verdade (só os atributos foram conferidos); teclado completo nas raias do gráfico e no visualizador; roda do mouse, pinça e "Baixar" no visualizador; o clique duplo na raia; a queda para `sddefault` e `hqdefault`; zoom do navegador de 200 a 400%; movimento reduzido; escala de cinza; outros navegadores além do Chrome; a altura da moldura real do CMS (a do mockup é estática).

Fabricado no mockup, a não confundir com dado: as 7 trocas e os títulos "Antes", os 3 fixados, os casos de dado ausente e **todo** texto de leitura da forja (ela nunca produziu uma leitura real em produção). O múltiplo do mockup é uma aproximação; em produção vale o do motor.
### 12.3 O que ainda falta mockar, antes de qualquer tela
Regra do dono: mockup aprovado antes de qualquer tela. Valem para todos as linhas da seção 11 marcadas "Sim".
1. **Canal próprio**, na página do canal e no Histórico: selo "seu canal", cartão sem múltiplo, aba Trocas, série diária real, percentual assistido. Depende do L2 (série) e do L3 (percentual assistido) para ter dado de verdade.
2. **Retenção.** O estado "Coletando: 9 de 28 dias". A lista com "poucos vídeos para comparar", "Sem faixa" e uma linha para cada frase de 8.3. Canal a reautorizar, visto por quem administra e pela editora. Curva incompleta e a frase das janelas diferentes. Variante opcional: a dispersão acima da lista (seção 13). **O dono decide lá:** só a lista, ou lista com dispersão.
3. **A/B: acompanhamento, diálogo e faixas.** O calendário com destaque e sem destaque. Nenhuma ocorrência de "confiança", "impressões", "CTR", "playoff", "líder", "vencedor" (fora de "Encerrado sem vencedor") ou "automaticamente". O diálogo sem opção marcada e com "Encerrar" desabilitado; a confirmação com os dois títulos lado a lado. Os estados de 9.3 e as seis linhas de 9.4, com destino original e com destino variante. **O dono decide lá:** o texto do rótulo "mais views/dia até agora" e o do botão "Encerrar e ficar com B".
4. **Pequenos, que cabem numa rodada curta do mockup atual:** "0 views/dia" com uma casa decimal (pergunta 8 da seção 14); os estados "Canal não encontrado" e "Erro: a última sincronização falhou" (5.9), que têm frase mas não têm tela; o fixado "o YouTube não devolveu este vídeo"; o múltiplo "poucos vídeos para comparar"; a "Leitura anterior" visível enquanto um pedido novo está na fila.

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

## 14. Perguntas abertas para o dono
Só o que o mockup e o roteiro não respondem e que quem implementa teria de adivinhar. Cada uma traz uma recomendação; nenhuma é decisão.

Fechadas desde a v7, para não voltarem: a vista padrão é Capas (emenda 6); a tira de capas no cabeçalho não entra (emenda 12); a leitura por canal não é feita antes de a página do canal estar em uso (roteiro, etapa 8); a URL do canal usa o id interno (seção 3). O selo continua "em treino", como está no mockup aprovado.

1. **O cartão novo da forja entra na fase A?** O roteiro (seção 6) diz que no Histórico "só entram a chegada com a troca destacada, a leitura da forja e o visualizador", mas a etapa 5 (seção 4), que define a fase A, cita só a chegada e o visualizador. Daí saem duas dúvidas. (a) O cartão novo no Histórico e o botão do cabeçalho que rola até ele são fase A ou uma fase própria logo depois? (b) O que a aba "Leitura" do canal mostra na fase A, já que a leitura por canal depende de 7.3: a leitura do nicho, rotulada "Leitura do nicho Viagem (não é só deste canal)", ou a aba só aparece quando 7.3 existir? Recomendação: fase própria para o cartão (ele troca um componente que está em produção e nunca recebeu uma leitura real); na fase A a aba "Leitura" aparece com a leitura do nicho, rotulada, no componente de hoje.
2. **A moldura do Histórico perde as abas de seção e a barra de nicho?** A seção 3 da v7 pedia só a trilha nas páginas de canal e de vídeo, e o mockup aprovado está assim. Mas a decisão da rodada 3 é "nada da tela de produção se perde", e hoje o Histórico tem a moldura inteira (`video/[id]/page.tsx:33`), usada também por quem chega de Mudanças, Outliers e Insights. Recomendação: a página do canal nasce só com a trilha; o Histórico fica com a moldura de hoje na fase A.
3. **Quais são "os quatro números atuais" do cabeçalho do canal?** O mockup aprovado mostra inscritos, ritmo (longos e Shorts por semana), views por dia nos longos e inscritos em 30 dias, e o spec assume esses quatro (5.3). O painel de Canais de hoje mostra também "Engajamento" (`_canais/view-model.ts:457`), que a v7 mandava sair. Recomendação: os quatro do mockup, sem engajamento.
4. **O botão "Pedir leitura à forja" do cabeçalho só rola, ou rola e já pede?** Divergência entre as fontes: o `LEIAME.md` (rodada 3) descreve "rola até a seção Leitura e dispara o pedido"; a pergunta 4 da mesma rodada recomenda rolar "em vez de pedir às cegas"; o roteiro diz "o botão do cabeçalho rola até ele". O spec seguiu o roteiro (6.5): só rola, e o pedido é feito no botão do cartão. Confirmar.
5. **O painel lateral de Canais sai quando a página do canal entrar?** A seção 3 diz que o clique no nome ou no avatar leva à página, e não diz o que acontece com o painel (`_canais/channel-drawer.tsx`). Liga-se a isto: o canal **próprio** também aparece em Canais e a página dele não foi ao mockup. Recomendação: na fase A o clique no concorrente leva à página e o painel deixa de abrir para concorrente; o canal próprio continua abrindo o painel de hoje até a página dele ser mockada.
6. **Troca de descrição entra na aba Trocas?** A aba aprovada mostra título e thumbnail. A produção também observa a descrição (raia "Descrição" no Histórico; o painel de hoje conta "título, thumbnail ou descrição", `_canais/view-model.ts:497`). Recomendação: manter só título e thumbnail na aba, como foi aprovado, e dizer isso no título da seção, para a contagem não divergir sem explicação da de Mudanças.
7. **Troca mais antiga que 30 dias, com o gráfico em 30 dias por padrão.** Quem chega de Mudanças com janela de 90 dias, ou por um link antigo, pode abrir o Histórico numa troca que o período padrão esconde. O mockup não cobre: a aba Trocas só tem 30 dias. Recomendação: quando há troca escolhida e ela está fora do período, o gráfico abre no menor período que a inclui (90 dias ou tudo), e o texto do período diz por quê (6.2).
8. **"0 views/dia" com uma casa decimal: qual é a regra?** O roteiro lista como não feito no mockup. Em canal pequeno a maioria dos vídeos ganha menos de uma view por dia e a tela mostra "0", que é zero medido e parece ausência. Recomendação: abaixo de 10, uma casa decimal ("0,3 views/dia"); zero exato continua "0"; de 10 para cima, inteiro. Vale no cartão, na Lista e no cabeçalho.
9. **Vídeo fora dos acompanhados, aberto pela grade.** Depois de "Carregar mais", o cartão de um vídeo antigo leva ao Histórico no estado "fora dos acompanhados" de hoje (aviso e só as raias). Um pager que anda pela grade mistura vídeos com gráfico e vídeos sem. O mockup mostra o estado, não a sequência. Recomendação: o pager segue a ordem da grade, com os antigos inclusive, e a tela de cada um diz o que não tem.
10. **O aceite da fase A pode usar dados reais?** Em produção nenhum canal tem vídeo fixado, nenhum tem mais de 2 trocas e nenhuma troca tem 7 dias de série depois dela (a série começa em 03/10). O mockup fabricou esses casos. Recomendação: aceitar a fase A com os casos cobertos por teste (dados semeados), e conferir em produção só o que existe lá (grade, "Carregar mais", cabeçalho, uma troca real, o visualizador).
