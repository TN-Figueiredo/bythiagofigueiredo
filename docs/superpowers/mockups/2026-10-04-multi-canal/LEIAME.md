# Multi-canal — mockups para aprovação (Task 1)

Estes mockups são o gate das Tasks 6 (Observatório) e 7 (cadastro). Nenhum código de tela começa antes do sim do dono.

## O que abrir

| Arquivo | O que mostra |
|---|---|
| `cms-youtube-canais.html` | `/cms/youtube`, aba Painel, com o cadastro de canais e de nichos. O primeiro quadro é a página inteira com 3 canais; abaixo, um quadro por estado (zero canais, Add channel, erros, canal sem nicho, remoção com a lista, remoção bloqueada, nichos). |
| `observatorio-n-nichos.html` | Índice: só aponta para os estados do Observatório. |
| `observatorio-n-nichos/canais.html` | Aba Canais com os nichos criados pelo dono. Em “Estados do mockup” > “Nichos do site”: 2, 3, 4 ou 6 nichos (ou `?nichos=`). |
| `observatorio-n-nichos/insights-n-canais.html` | Insights num nicho criado pelo dono (`?nichos=4&niche=jogos`) e num nicho recém-criado, sem concorrentes e sem temas (`&niche=pessoal`). |

Todas aceitam `?theme=light|dark`. Capturas em `shots/` (1440×900 e 768×1024, claro e escuro; a pasta não vai para o git).

A subpasta `observatorio-n-nichos/` é cópia de `2026-10-03-observatorio-seus-canais/{canais.html, insights-n-canais.html, mockup.css, mockup.js, segundo-canal.js}` e de `2026-10-02-observatorio/{chrome.css, chrome.js, dados.js}`. Nenhum arquivo de 02/10 ou de 03/10 foi alterado. O que mudou nas cópias está marcado com o comentário `n-nichos`; o arquivo novo é `n-nichos.js`. Com 2 nichos, o texto da tela sai igual ao de 03/10 e todo elemento visível fica na mesma posição (conferido elemento a elemento em 1440, 1100 e 768 px; só mudam as caixas invisíveis que contêm as abas e a barra).

## Decisões de desenho

### Cadastro, em `/cms/youtube`

1. **Onde entra.** O cadastro entra onde a configuração do canal já mora: “Add channel” no topo da lista (é a ação que falta à tela e a que o estado vazio precisa oferecer), idioma, nicho, slug e remoção dentro do “Configurar” de cada cartão, e “Niches” abaixo dos cartões, porque é configuração de apoio, usada poucas vezes.
2. **Nada de diálogo.** A área abre tudo no lugar (“Configurar”, “Remove weekly pick?”). O formulário de cadastro e a confirmação de remoção seguem isso. A confirmação de remoção usa o desenho do “Remove weekly pick?” (título, texto, Cancel, botão vermelho) em vez de `window.confirm`, que não comporta uma lista com contagens.
3. **Faixa de identidade no cartão.** Uma linha nova, sempre visível, com `Niche` e `Slug`. O idioma fica ao lado do nome.
4. **Idioma em texto, não em bandeira.** Hoje o cartão mostra 🇧🇷/🇺🇸. Bandeira é país, não idioma, e não cresce (que bandeira tem o espanhol?). O chip `PT-BR` / `EN` é o mesmo do Observatório. O campo é um seletor comum: um idioma novo é mais uma opção, sem redesenho.
5. **Nada supõe um canal por nicho nem um canal por idioma.** A página inteira mostra três canais, dois deles com o mesmo nicho e o mesmo idioma (tnFigueiredo e Cortes do tnFigueiredo, PT-BR, Viagem). O bloco de nichos diz “3 channels” em Viagem. Não existe erro por idioma repetido.
6. **Slugs.** Os dois canais atuais aparecem como `tnfigueiredo` e `thiago-figueiredo`. No cadastro, o slug vem preenchido a partir do handle e pode ser editado; depois de gravado, aparece só para leitura.
7. **Idioma dos textos.** A tela hoje mistura inglês (corpo dos cartões: “videos”, “Weekly Pick”, “Schedule Config”, “Save”) e português (“Configurar”, “Reconectar Token”, “Nunca”). Os textos novos estão em inglês, como o corpo dos cartões e como os textos exatos da Task 7; o que já existe ficou como está.
8. **Cores.** Nenhuma cor nova na área. O que já existe usa as cores que o código usa hoje; os elementos novos usam os mesmos tokens (`.btn primary`, `.btn danger`, o vermelho do “Unpin”, o âmbar do “Nunca”). A única cor de dado é a do nicho.

### Observatório

9. **Barra de nicho: uma linha, e rola quando não cabe.** A barra fica sempre ao lado das abas. As abas mantêm a largura delas; a barra ocupa o que sobra. Quando os nichos não cabem, o trilho da barra rola para o lado com o mesmo degradê que as abas já usam, e o nicho ativo é sempre trazido para a vista. Medido: 6 nichos cabem inteiros em 1440 px; em 768 px cabem 3 (Todos · Viagem · IA · Jogos), e do quarto em diante a barra rola.
   - Por que não quebrar em duas linhas: a barra é um controle de segmentos colados; quebrada, vira dois pedaços soltos e empurra a tela para baixo (a regra é o herói acima da dobra).
   - Por que não um menu “Mais”: esconderia nichos e contagens atrás de um clique, e seria uma peça nova. A rolagem com degradê já existe na tela, nas abas.
10. **Ordem.** `Todos`, depois Viagem e IA, depois os criados pelo dono, na ordem de criação. A mesma ordem vale no seletor de nicho da linha, nos grupos da tabela e no formulário de adicionar.
11. **Grupos da tabela.** Em Todos, um grupo por nicho que tem canal; nicho vazio não ganha grupo.
12. **Adicionar canal.** Até 3 nichos, botões (como hoje); a partir de 4, um seletor, para o diálogo continuar com uma linha.
13. **Nicho recém-criado, sem concorrentes.** Canais: “Nenhum canal em Pessoal. Para acompanhar um canal novo, use Adicionar canal.” (o texto que o produto já usa para nicho vazio). Insights: cada card diz o que falta, com os textos que o produto já tem, e o botão da forja fica desabilitado.
14. **Nicho sem lista de temas** (todo nicho criado pelo dono, por enquanto). Temas e Lacunas mostram a frase da Task 6, sem selo da forja (a frase é do site). Fórmulas usa só as universais.
15. **Paleta dos nichos criados: quatro cores, não seis.** Ver P-cor abaixo.

## Perguntas do plano, com o que foi desenhado

- **P2 — Onde fica o cadastro.** Decidido pelo dono: tudo em `/cms/youtube`. Desenhado assim (decisão 1). Falta o sim ao lugar de cada peça.
- **P3 — Slugs.** Decidido: `tnfigueiredo` e `thiago-figueiredo`. Desenhado nos cartões.
- **P4 — Temas de um nicho novo.** Decidido: nasce sem temas. Desenhado em Insights (Jogos e Pessoal) e dito no bloco de nichos (“New niches start without a theme list in the Observatório.”).
- **P7 — Remoção com teste A/B.** Decidido: teste ativo bloqueia; encerrados são apagados junto. Os dois estados estão nos quadros 6 e 7.

## Perguntas que os mockups deixam para o dono

1. **P-cor.** A paleta do plano tinha seis cores: âmbar, violeta, rosa, ciano, laranja e cinza. Quatro delas repetem cores que já têm significado no Observatório: violeta é o Cowork, ciano é a forja e “informação”, laranja é a ação principal e “seu canal”, âmbar é aviso. Proponho quatro que não repetem nenhuma: **ameixa** `#D29AE8 / #7B2A91`, **rosa** `#F293C2 / #A3216B`, **lima** `#B9CB62 / #55650B`, **ardósia** `#AAB4C0 / #4B5563` (escuro / claro, todas com contraste AA). Com Viagem e IA, cobrem seis nichos sem repetir; a partir do sétimo a cor se repete, e o nome sempre acompanha a cor. Quatro cores bastam, ou você quer seis mesmo com a colisão?
2. **Barra de nicho em telas estreitas.** Rolagem com degradê (desenhado) ou menu “Mais”?
3. **Confirmação de remoção.** No cartão, como desenhado, em vez de `window.confirm`. De acordo? Quer ter de digitar o slug para confirmar?
4. **Bandeira → chip de idioma** no cartão do Painel. De acordo?
5. **Textos novos em inglês** na aba Painel (a tela é mista). De acordo, ou em português?
6. **“Schedule and sync →”** do brief sumiu: o cadastro e os horários ficam no mesmo cartão, então não há para onde apontar.
7. **Nicho sem concorrentes: o botão da forja desabilitado** com “Nenhum concorrente em Pessoal ainda”. De acordo?
8. **Contagem no bloco de nichos:** mostra quantos canais seus usam o nicho. Quer também quantos concorrentes?

## Textos novos (fora do que o plano já trazia)

Cadastro (inglês):
- Cabeçalho: `Channels` · `Your own YouTube channels. Each one has a language, a niche and a slug.`
- Estado vazio: `No YouTube channels yet` · `Add your first channel to sync its videos.` (o texto da Task 7 apontava para Settings; com P2 deixou de valer)
- Canal sem nicho: `No niche yet` · `It shows in every Observatório niche tab until you pick one in Configurar.`
- Slug depois de gravado: `The slug is the id the forja and Cowork use. It cannot be changed.`
- Remoção, linha do Configurar: `Remove this channel and everything synced from it. You will see what is deleted before confirming.` · botão `Remove channel…`
- Confirmação: `Remove “<nome>”?` · `This permanently deletes:` · lista: `<v> videos, with their analytics, grades and optimization cycles` · `<c> curated comments` · `<l> sync log entries` · `<k> finished A/B tests, with their variants and results` · `<a> intelligence analyses and <t> queued tasks` · `<n> notes` · `<p> pipeline items keep their content and lose the link to their video.` · `All of it is removed at once, or nothing is. This cannot be undone.` · `Cancel` / `Remove channel`
- Bloqueio (substitui o texto da Task 7, que mandava arquivar todos os testes): `“<nome>” cannot be removed yet` · `An A/B test is running on one of its videos. Stop it first:` (plural: `A/B tests are running on its videos. Stop them first:`) · `“<teste>” · running since <data>, on “<vídeo>”` · `Finished tests do not block: they are deleted with the channel. Nothing was deleted.` · `Open A/B Lab →`
- Nichos: `A niche groups your channels with the competitors you track in the Observatório. A niche can have more than one channel.` · `built-in` · `no channels yet` · `New niches start without a theme list in the Observatório. Niches can’t be renamed or deleted yet.`

Observatório (português):
- Insights em Todos, quando há nicho criado pelo dono: `Misturar nichos somaria públicos, horários e fórmulas que não têm nada a ver.` (com só Viagem e IA, a frase de hoje não muda) e um atalho `Ver <Nicho>` por nicho.
- Botão da forja desabilitado em nicho sem concorrente: `Nenhum concorrente em <Nicho> ainda`.

## Adendo proposto a CONVENCOES (aplicar só depois do sim)

Acrescentar a `docs/superpowers/mockups/2026-10-02-observatorio/CONVENCOES.md`:

> ## Nichos como dado (multi-canal, 04/10)
> - Nicho = Todos · <nichos do site, na ordem de `sort_order`>. Os de fábrica são Viagem e IA, com as cores atuais. Onde a forja enumera nichos, a ordem é IA, Viagem e depois os demais.
> - A mesma ordem vale na barra de nicho, no seletor de nicho da linha, nos grupos da tabela e no formulário de adicionar canal. Nicho sem canal não ganha grupo na tabela.
> - Barra de nicho: uma linha, ao lado das abas. Quando os nichos não cabem, o trilho da barra rola para o lado com o degradê das abas e o nicho ativo é trazido para a vista. A página nunca rola para o lado.
> - Adicionar canal: até 3 nichos, botões; a partir de 4, seletor.
> - Cores dos nichos criados pelo dono: ameixa `#D29AE8` / `#7B2A91`, rosa `#F293C2` / `#A3216B`, lima `#B9CB62` / `#55650B`, ardósia `#AAB4C0` / `#4B5563` (escuro / claro). Nenhuma repete cor com significado (laranja, teal da forja, violeta do Cowork, âmbar, vermelho, ciano). A cor nunca vem sem o nome do nicho.
> - Nicho criado pelo dono não tem lista de temas: Temas e Lacunas dizem “Ainda não há lista de temas para <Nicho>. Padrões de título, o mapa de publicação e “Você no nicho” funcionam normalmente.”, sem selo da forja. Fórmulas usa só as universais.
> - Pode haver mais de um canal próprio no mesmo nicho e no mesmo idioma. Nenhum texto diz “canal principal”.

## O que o mockup não é

- No Observatório, Jogos e Culinária recebem concorrentes que eram de IA e de Viagem, só para os grupos existirem; os números são os do motor.
- Com escopo Todos, o pedido à forja do mockup continua indo só a Viagem e IA.
- O cadastro é estático: os botões não gravam nada.
