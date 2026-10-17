# Inventário: entradas do teste A/B a partir do Observatório (mockup de 17/10/2026)

Mockup: `index.html` (dados sintéticos; tokens copiados de `_chrome/chrome.css` e `tokens-telas.css`; sem `color-mix()`; quadros em 1440 e 390, escuro e claro; botão de tema no topo). Base: pareceres `.superpowers/sdd/a5/noite/ab-entrada-{logan,naksu,hanna}.md` e decisão do dono de 17/10 (seção "começar teste A/B a partir do Observatório").
Caminhos de código relativos a `apps/web/src/app/cms/(authed)/youtube/` (checkout `~/Workspace/wt-trem7`). Nenhum código de produto foi editado.

## Regras comuns a todas as entradas
- Só navegam (`<a href>`, sem `target=_blank`). Não criam teste, não abrem modal, não preenchem a variante B com material do concorrente, nenhum texto diz "copiar", "faça igual" ou "funcionou".
- Quem não tem `podeEditar` (reporter) não vê o botão nem o item (sem botão desligado).
- Vídeo já em teste ativo: o gatilho vira "Ver teste" e leva a `ab-lab/<id do teste>`.
- Vídeo próprio sem dado medido: sem botão nem item; no cabeçalho, uma frase diz por quê. Interpretação desta rodada de "sem dado": o vídeo próprio está `não medido`/`restrito`/`falhou` nas leituras do cabeçalho (`_proprio/header-model.ts`). Confirmar com Phil/Yannis.
- Alvo de toque 44 px em quadro estreito (`@container (max-width:600px)`); no código, a condição do menu deve ser `(pointer:coarse),(max-width:600px)` (parecer da Naksu).
- Contorno tracejado laranja no mockup = marca do que é novo; não existe em produção.

## 1. Cabeçalho do vídeo próprio (`competitors/_historico/historico-screen.tsx`, linha `.arow`)
| Estado | Texto | Destino | Origem do dado |
|---|---|---|---|
| Próprio, editor, com dado | botão "Testar thumbnail ou título" (ícone frasco, `.btn` igual a Fixar) | `ab-lab/new?videoId=<youtube_videos.id>` | `ehProprio(v)`, `podeEditar`, estado das células do cabeçalho (`header-model.ts`); id a confirmar (Hanna: id da rota = `youtube_videos.id`?) |
| Próprio, teste ativo | botão "Ver teste" + frase "Teste de thumbnail em andamento, dia 4 de 7." | `ab-lab/<id>` | teste ativo por vídeo: consulta nova ou reaproveitar a de `getEligibleVideosForPicker` (confirmar com Yannis) |
| Próprio, não medido | sem botão; "Este vídeo ainda não foi medido. O teste precisa de uma base para comparar." | n/a | `nao_medido` |
| Próprio, restrito | sem botão; "A leitura deste vídeo é restrita: só quem tem acesso ao Analytics vê os números." | n/a | `negado` |
| Próprio, leitura falhou | sem botão; "A leitura deste vídeo falhou. Recarregue a página para tentar de novo." | n/a | `erro` |
| Reporter | sem botão | n/a | `podeEditar` |
| Concorrente | sem botão (a entrada é a troca e o menu) | n/a | `ehProprio(v)` falso |
Celular: `.arow` já quebra linha; botões 44 px.

## 2. Troca de concorrente (`_historico/compare.tsx` e cartões de Mudanças; `_canal/trocas.tsx`)
| Estado | Texto | Destino | Origem |
|---|---|---|---|
| Troca de thumbnail ou título, com `podeEditar` | botão "Testar uma ideia no meu canal" | `ab-lab/new?ref=competitor&changeType=thumbnail\|title&competitorThumb=<url>&competitorTitle=<texto>&refVideoId=<id>` | troca (versão depois), `changeType` já é o par; `refVideoId` parâmetro novo (Logan 4) |
| Thumbnail sem imagem guardada | sem botão (não há botão desligado); frase "Sem imagem guardada desta troca: não há o que usar de referência." | n/a | `thumbSrc` nulo (Hanna: confirmar com Phil se a URL expira) |
| Reporter | sem botão | n/a | `podeEditar` |
Texto de leitura: "Visualizações por dia: X antes, Y depois. Isto é o que aconteceu no canal dele; não prova que a thumbnail foi a causa." Quando falta medida: pastilha `não medido`, sem juízo. A URL da imagem só passa se for `https://i.ytimg.com/` (Naksu 3).

## 3. Menu ⋯ (`_canal/video-menu.tsx`, componente `Itens`; grade, tabela e Lista)
Grupo à parte, depois de "Abrir no YouTube" (e de "Ver trocas" no concorrente), separado por `<hr>`. Itens `<a role="menuitem">`.
| Estado | Item | Destino |
|---|---|---|
| Próprio, com dado | "Testar no A/B Lab" | `ab-lab/new?videoId=` |
| Próprio, teste ativo | "Ver teste" + `<small>em andamento</small>` | `ab-lab/<id>` |
| Próprio, sem dado ou reporter | item não existe | n/a |
| Concorrente | "Testar uma ideia a partir desta thumbnail" e "Testar uma ideia a partir deste título" (rótulos do Logan R1: "Testar esta thumbnail" lia como copiar; os do dono eram os curtos) | `ab-lab/new?ref=competitor&changeType=...` (sem `refVideoId` de troca: veio do menu) |
| Concorrente, thumbnail sem imagem | só o item do título; o da thumbnail não existe | n/a |
Origem: `ChannelVideoView` (`videos-model.ts`: `thumbSrc`, `title`, `url`), `ehProprio`, `podeEditar`; teste ativo igual ao de 1.

## 4. Antes e depois, vídeo próprio (`_historico/compare.tsx`)
| Estado | Texto | Destino | Origem |
|---|---|---|---|
| Troca manual com medida | botão "Testar esta troca" + dica "Abre o teste neste vídeo com esta troca como ponto de partida. A variante B começa vazia." | `ab-lab/new?videoId=<id>&changeType=<tipo>` | `_proprio/trocas-model.ts`, medida "cliques nas impressões" antes/depois (7 dias cada lado) |
| Troca que veio de um teste | botão "Ver o teste #12" | `ab-lab/<id>` | "veio do teste X" já existe em `trocas-model.ts:167,325` |
| Troca sem medida depois | sem botão; frase "Sem medida depois da troca, não há base para comparar." + pastilha `não medido` | n/a | janela ainda aberta ou dado ausente |
| Vídeo já em teste | aviso no topo do bloco "Este vídeo já tem um teste em andamento (dia 4 de 7)." com um só "Ver teste"; cartões sem botão | `ab-lab/<id>` | teste ativo |
Texto do resultado: "Os cliques caíram; isto não prova que a troca foi a causa." só quando a medida existe; nunca em `não medido`.

## 5. Faixa de referência (`ab-lab/new/client.tsx`, hoje linhas ~87-102)
| Estado | Texto | Origem |
|---|---|---|
| Thumbnail | miniatura 96×54 (`width`/`height` declarados) + "Referência · <canal> trocou a thumbnail" + título em 2 linhas (`line-clamp`) + "Referência, não modelo." + link "Ver a troca" + botão "Recolher" | query `competitorThumb`, `competitorTitle`, `refVideoId`, nome do canal (a buscar por `refVideoId`) |
| Título | sem miniatura; "Referência · <canal> trocou o título" + título citado em serifa + "Referência, não modelo." | `competitorTitle` |
| Sem imagem | quadro hachurado "sem imagem guardada" no lugar da miniatura | `competitorThumb` nulo ou fora do host permitido |
| Vinda do menu ⋯ | "Referência · thumbnail de <canal>" (sem "trocou": o vídeo pode nunca ter trocado) + link "Ver o vídeo" | `ref=competitor` sem `refVideoId` de troca |
| Recolhida | uma linha "Referência · <canal> trocou a thumbnail" + "Mostrar referência" (`aria-expanded`) | estado local; recolher não perde nada |
| Vídeo vindo de `?videoId=` inelegível | aviso `role=status`: "Este vídeo não pode entrar em teste agora: <motivo>. Escolha outro vídeo abaixo." + seletor em português ("Buscar vídeos…") | `getEligibleVideosForPicker`; motivo: teste em andamento, outro canal, inelegível |
| Caso normal | sem faixa; "O que testar" já marcado por `changeType`; vídeo pré-escolhido | `videoId` |
A variante B nasce vazia (drop de imagem ou campo de título vazio). Textos do picker em português ("Novo teste A/B", "Passo 2 de 3", "Voltar", "Continuar", "Trocar").

## Notas de rodada
- Nomes do vídeo próprio (cabeçalho "Testar thumbnail ou título", menu "Testar no A/B Lab", Antes e depois "Testar esta troca"): textos pedidos pelo dono; Logan R1 (C1) sugeriu unificar. Decisão do dono; o mockup mantém os três.
- Botão no concorrente com troca `não medido` continua: o gatilho depende da troca (fato observado), não da medida. No vídeo próprio depende de medida porque a pessoa decide sobre o próprio dado.
- O wizard real usa tokens `cms-*`; só a faixa e o aviso são novos (classe própria, valores literais iguais aos do mockup, sem `var(--accent-soft, fallback)`). O restante do wizard desenhado é ilustrativo.
- Para o código: `.num` do mockup está em 12 px (o CSS real usa `.92em`, abaixo de 12 px: item para a revisão visual).
