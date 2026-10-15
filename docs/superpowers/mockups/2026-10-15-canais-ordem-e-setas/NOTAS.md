# Canais, 2ª leva: ordem e setas (mockup 17, 15/10/2026)

Abrir: `open -a Opera docs/superpowers/mockups/2026-10-15-canais-ordem-e-setas/index.html` (sem build; fontes do Google). Parte do mockup 16 (`2026-10-13-a5-lote-2/16-lista-canais-direcao-estado`) e dos tokens dele (escuro e claro, copiados). Dados SINTÉTICOS: 14 canais inventados, nenhum real. Decisões do dono de 15/10: `.superpowers/sdd/a5/decisoes-do-dono.md` (fim) e `discussao-direcao/hanna.md`.

Controles (barra tracejada no topo, fora da tela): ordem (Inscritos, Views/dia, Crescimento, Direção), sentido, largura 1440 ou 390 (mesmo código, container query), tema, "Marcar o que mudou". Os cabeçalhos da tabela também ordenam; clicar de novo inverte. A 390 a ordem sai da barra "Ordenar por". Capturas em `shots/` (escuro 1440 e 390 nas três ordens; claro de Crescimento).

## O que mudou na r3 (dica por célula, 15/10)
Pedido do dono (15/10): passar o mouse (e tocar, e Tab) em CADA célula de um canal e ver a conta DAQUELE número. Backup da r2: `index.r2.html`. Capturas em `shots/r3/` (1440 e 390). Dados continuam SINTÉTICOS (14 canais inventados; hoje = 15/10/2026).
- **Padrão `Tip` da tela:** abre no hover e no foco (fica enquanto um dos dois segura), Esc fecha, no toque abre ao tocar e fecha ao tocar fora; nunca `title` nativo. O gatilho é a própria célula (`role="button"`, `tabindex="0"`, sublinhado pontilhado no número, fundo suave quando aberta); a caixa tem `role="tooltip"` e `aria-describedby`. Cada texto está marcado com `data-texto-a-revisar` (na caixa `.tb`).
- **Colunas novas:** Ritmo (13 semanas), Outliers (contra o esperado), Trocas, Sincronização. Inscritos passou para baixo do nome, como no produto; o cabeçalho "Canal e inscritos" ainda ordena por inscritos. Comparar e ações seguem fora.
- **Dicas (texto exato em `shots/r3/` e no `tipXxx()` do HTML):**
  - Direção: "Últimos 28 dias: 198 mil views. 28 dias anteriores: 121 mil. Subiu 64%." / "Caiu N%" / "Variou +5%: dentro de ±10%, conta como sem mudança." Não medido: motivo e **data em que passa a medir** (Estreia Tardia 28/11/2026; Meu Canal 20/11/2026 na Direção) ou "Sem data".
  - Crescimento: inscritos há 30 d e hoje (número inteiro), ganho absoluto e %, passo de arredondamento do canal; "dentro do arredondamento" explica que a diferença é menor que 2 passos e pode ser só arredondamento. Não medido: motivo e data (Estreia Tardia 02/11/2026; "Sem data" para canal que esconde inscritos e para o canal próprio sem coleta).
  - Views/dia: mediana dos N longos em 90 d, absoluto e por mil inscritos ("menos de 0,1" quando pequeno; "sem proporção" se inscritos ocultos; aviso com menos de 5 vídeos).
  - Ritmo: longos e Shorts em 13 semanas, último vídeo há X dias. Outliers: título, múltiplo, views contra o esperado na mesma idade; sem outlier ("nenhum" ou "sem base" com menos de 5 longos). Trocas: o que mudou (título, thumbnail ou ambos), de qual vídeo, há quantos dias e a data. Sincronização: quando, quantos vídeos acompanhados, de quanto em quanto tempo volta e por quê; **Voo Baixo mostra uma falha** (em laranja, "falhou"; o dado é o de antes).
  - Inscritos (sob o nome): número arredondado pelo YouTube, o passo do canal e a margem ("até 5 mil acima ou abaixo").
- **Regras de redação:** até ~2 a 3 linhas, números em destaque (mono, negrito), frases com verbo, sem jargão interno.
- **Ainda sintético / a confirmar com Phil e Yannis:** o intervalo de sincronização por ritmo (6 h, 24 h, 3 dias), o limiar de 5 vídeos para "esperado" e a data de "passa a medir" do canal próprio são inventados neste mockup.

## O que mudou na r2 (pareceres de Logan e Naksu, 15/10)
Capturas em `shots/r2/` (1440 e 390; Direção, Direção crescente, Crescimento, Inscritos crescente, barra fixa a 390). Dados continuam SINTÉTICOS.
- **P é a posição canônica** (Logan 1): 1º = maior valor da coluna ordenada, em qualquer sentido; crescente só inverte a ordem visual (13º no topo, 1º no fim). A linha do dono e a faixa dão o mesmo número (12º de 13). Texto novo na linha de ordem: "Posição: 1º é o maior valor, em qualquer sentido."
- **Empate em texto, sem "＝"** (Logan 2, Naksu C1): "6º" com "empate" embaixo (12 px, muted); a 390, "6º · empate". Coluna P a 64 px. Legenda: "Empate: mesmo valor na tela, mesma posição." O ＝ fica só na Direção ("sem mudança").
- **Empate na Direção nos dados:** Passaporte Cheio (+12,1%) e Bússola Quebrada (+11,6%) mostram +12% e dividem o 5º, em ordem A–Z nos dois sentidos (competição: depois vem o 7º). A faixa de ±10% do ▲ ＝ ▼ não entra no empate.
- **Faixa do dono** em Crescimento/Direção com o texto exato do Logan ("Seu canal ainda não tem Crescimento medido." / "...Direção medida." + frase do escopo); sem "Sem posição" ao lado de P numerada. A 390 os dois botões ficam lado a lado.
- **Divisor "Sem medida"** sem prometer 30 dias: "Estes canais não têm Crescimento medido; o motivo está em cada linha..." (idem Direção); o motivo de cada canal já aparece na linha (30 dias de registro, inscritos ocultos, sem coleta própria).
- **Crescimento "sem variação"** mostra "dentro do arredondamento (±N)" com o limite do canal (Naksu C2): Bússola Quebrada ±2 mil, Linha de Comando Zen ±1 mil, Rio Abaixo ±2 mil, Horizonte Seco ±20 mil.
- **Naksu:** S2 chevron inativo vira duplo (⇅, contraste acima de 3:1, sem direção); o ativo tem um só, para baixo = decrescente. S4 coluna ordenada a 390 vira fundo + borda de 1 px, sem contorno forte (que fica só para o foco). `.sortbar` sticky a 390 (único z-index da tela). Não entram: S1, S3, S5, line-clamp, paginação.
- Perguntas 1 e 3 da lista abaixo estão respondidas (posição canônica; empate em Direção com a mesma regra). Falta a dúvida do dono: "Quando você inverte a ordem, o 1º continua sendo o maior. Está bem?"

## ROTEIRO DE TESTE (dono, 5 a 8 minutos, Opera)
1. Abra o `index.html`, 1440 px, escuro. Clique em **Inscritos** na barra do mockup e depois em **Crescente**. Deve ver: Estreia Tardia no topo com **13º**, Meu Canal Exemplo **12º**, e a faixa dizendo **12º de 13**; o 1º é o último da lista.
2. Clique em **Direção**. Deve ver: Prompt Cru 1º; Bússola Quebrada e Passaporte Cheio ambos **5º** com "empate" embaixo, ambos +12%; depois 7º (sem 6º). Nenhum "＝" na coluna P.
3. Clique no cabeçalho **Direção** da tabela. Deve ver: ordem inversa, Terra Rasa no topo com 12º, os dois empatados ainda em A–Z (Bússola antes), e "Sem medida (2)" sempre no fim.
4. Clique em **Crescimento**. Deve ver: 3 canais em **6º** com "empate", cada um com "dentro do arredondamento (±N)" e N diferente; a faixa diz "Seu canal ainda não tem Crescimento medido." e não existe a frase "Sem posição". Divisor "Sem medida (3)" com o motivo em cada linha.
5. Olhe os cabeçalhos: os inativos mostram ⇅ (visível), o ordenado mostra um chevron só. Tecle Tab nos cabeçalhos e veja o anel de foco.
6. Largura **390 px**: P aparece no canto do cartão como "5º · empate"; na ordem Crescimento, os dois botões da faixa ficam lado a lado; role a lista e veja a barra "Ordenar por" ficar fixa no topo; a coluna ordenada tem fundo e borda fina, não parece foco.
7. Troque para **Claro** e repita o passo 2 em 390 e 1440.
8. Toque no ⓘ do Crescimento e da Direção: o texto do empate (±N por canal; percentual inteiro igual, A–Z).
9. (r3) Em 1440, passe o mouse em 3 células da mesma linha (ex.: Prompt Cru: Direção, Ritmo, Trocas). Cada uma abre uma caixa com a conta daquele número, sem atraso estranho, e some ao tirar o mouse. Tecle Tab até uma célula: a caixa abre; Esc fecha. Nenhuma dica nativa (balão cinza do navegador).
10. (r3) Role até "Sem medida" e passe o mouse em Direção da Estreia Tardia: deve dizer o motivo e a data em que passa a medir. Em Voo Baixo, a Sincronização aparece em laranja ("falhou") e a dica explica a falha.
11. (r3) Largura **390 px** (ou celular): toque em Ritmo, Trocas e Direção de um cartão. A caixa abre ao tocar, cabe na tela (sem corte nas bordas) e fecha ao tocar fora ou em outra célula. A célula inteira é o alvo do toque.

## O que mudou na r1 (só três coisas)
1. **Posição numera toda ordenação.** Coluna P = 1º, 2º... pela coluna ordenada, também em Crescimento e Direção. "Sem medida" não numera (traço). A faixa "Seus canais" só dá a posição do dono em Inscritos e Views/dia ("9º de 13 ... do maior ao menor"); nas outras: "Sem posição por Crescimento. A coluna P numera os canais desta lista. A posição do seu canal só existe em Inscritos e Views/dia: ordene por uma delas para vê-la." (adaptado da Hanna; sem dar o porquê, que ela mandou confirmar) com dois botões que trocam a ordem.
   - **Empate (proposta):** mesmo valor mostrado = mesma posição, numeração de competição (6º＝, 6º＝, 6º＝, depois 9º). No Crescimento, quem tem |ganho| menor que 2 passos do arredondamento mostra "sem variação / dentro do arredondamento", fica entre quem cresceu e quem perdeu, todos na mesma posição, em ordem alfabética. O ⓘ do cabeçalho explica. A mesma regra vale para qualquer coluna (ex.: dois canais com +12% em Direção empatam).
2. **Crescimento sem seta:** "+1,8%" e "−0,4%" com o ganho em inscritos embaixo, na cor do texto (a cor de direção fica só para a Direção). ▲▼＝ só na Direção; a legenda da ordem diz isso.
3. **Direção ordenável:** cabeçalho vira botão com `aria-sort`; abre com quem mais sobe (percentual, decrescente), o 2º clique inverte. Não medido fica sempre no fim, abaixo do divisor "Sem medida (n)", nos dois sentidos, nunca como 0. O ícone de ordenação é um chevron, para não confundir com ▲▼.

## O que testar
- Em cada ordem, 1440 e 390: P bate com a ordem da coluna; empate em Crescimento (3 canais em 6º); "sem medida" no fim e com traço.
- Inverter Direção e Crescimento: "sem medida" continua no fim.
- Faixa do dono: posição em Inscritos e Views/dia; frase de motivo e botões nas outras duas.
- Foco por teclado nos cabeçalhos, ⓘ abre por toque, tema claro.

## Perguntas abertas
1. **Sentido crescente:** a coluna P reconta de 1º no topo (pedido do dono: "pela coluna ordenada"), mas a faixa do dono mostra a posição canônica (do maior ao menor). Em Inscritos crescente, o dono é "1º" na lista e "11º de 13" na faixa. Aceitar, ou travar P na posição canônica e só mudar a ordem visual?
2. **Texto da faixa:** sem o porquê (Logan e Naksu divergem; falta confirmar com software). Mantido assim.
3. **Empate em Direção:** vale a mesma regra (percentual inteiro igual = mesma posição)? Aqui sim.
4. **Colunas fora do mockup:** só Comparar e ações (Ritmo, Outliers, Trocas e Sincronização entraram na r3; Inscritos voltou para baixo do nome).
5. Canal próprio: Crescimento e Direção "não medido" (mockup assume que ele não tem coleta própria suficiente); muda se a R9 (inscritos do próprio pelo retrato público) entrar.
