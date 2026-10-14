# Revisão Logan (UX), peça 4: o interruptor do automático, rodada 1

Commit revisado: b56494d4e. Arquivos: `19-mes-fora-do-banco/interruptor.html`, `interruptor.js`, e a peça dentro dos cartões de `arquivo.html` (`?auto=...&visto=1`). Abertos no Playwright sobre `file://`, 390 e 1440 px, escuro; capturas em arquivo temporário da sessão (não versionadas). Erros de script: 0.

## Resumo

Veredito da peça: **volta para ajuste** (nenhum bloqueio de produção; 4 achados "corrige" que vão ao dono só depois de corrigidos, mais sugestões).

Pergunta de quem abre: "Está ligado? Vai tirar algo sem eu ver? Parou por quê?"

As três fricções que mais custam:
1. **Quem chega pelo chip "automático desligou" não encontra a resposta.** A frase-resumo da página fala de outra coisa e o painel está 1,4 a 2,8 telas abaixo (390 px).
2. **Depois de parado, o caminho de volta não existe dentro da peça** ("Falta: uma simulação nova", sem botão para fazê-la).
3. **Os "o que fazer" supõem que o dono mexe nas máquinas de casa** (forja, NAS), e o dono está fora do país.

## O que a proposta acerta

- Um estado por forma e por texto (ligado = visto; desligado = pontilhado; vencendo/parou = triângulo; não medido = hachura "nada sai sozinho"). Lido de relance, o título "Automático: ..." responde "está ligado?" sem abrir nada.
- A barra "saídas feitas por você / simulações vistas" mede o que falta; o texto "Falta: 2 saídas (1 de 3)" diz o que fazer.
- A janela de ligar funciona de verdade: foco em Cancelar, Esc fecha e devolve o foco ao botão (testado), Tab preso, botão só libera com a frase.
- Cada motivo de parada tem frase própria e "o que fazer"; as quatro recusas que não desligam não aparecem como problema.
- O chip "ligado" deixou de mentir quando nada está ligado.

## Tela por tela

### Painel "desligou sozinho" (motivos 1 a 13) e o chip na faixa — **volta para ajuste**
Passos da tarefa "ver por que parou e ligar de novo", como está: toque no chip (1), rolar até o cartão (3 rolagens a 390 px: o painel de hora fica a 1.158 px e o de views a 2.342 px do topo, abaixo do bloco "Canais removidos"), ler, rolar até "Ver o que sairia" na linha do mês (1 a 2), tocar (1), fechar (1), rolar de volta (1 a 2), "Ligar de novo" (1), rolar a janela (1 a 2), digitar a frase (33 caracteres), confirmar (1). Cerca de 12 gestos mais a digitação. Com as correções abaixo: chip (1), "Ver o que sairia" no painel (1), fechar (1), "Ligar de novo" (1), digitar, confirmar (1): 5 gestos mais a digitação.

**A1 (corrige). O chip leva à página, não ao painel.**
- Falha: o link do chip é `arquivo.html?...&visto=1`, sem âncora; a página abre em `scrollY` 0 (medido). A frase-resumo ("1 mês precisa de você ... Um mês já pode sair") não menciona o automático.
- Por quê: o dono clicou para saber "parou por quê?" e leu uma frase sobre outra coisa. Contraria "o mais importante é o que primeiro se lê".
- Custo: ele lê o resumo, conclui que o aviso era sobre outra coisa e sai sem ter lido o motivo. No celular, entre uma gravação e outra, ele não vai rolar 3 telas para conferir.
- Solução: (a) o chip aponta para `#auto-<tipo>` e a página rola até o painel e põe o foco nele; (b) enquanto o aviso não foi visto, a frase-resumo começa com "O automático de views por dia desligou em 02/05: <motivo curto>." (o motivo curto é o título dos quadros, p.ex. "a casa ficou mais de 36 horas sem responder"), com o nome do tipo em link para o painel; o resto da frase (Logan 11.8) segue depois.

**A2 (corrige). "Visto" é marcado ao chegar, não ao ver.** O `visto=1` vem na URL do chip; a abertura pelo menu "Arquivo" não o marca, e o clique no chip o marca sem o painel ter aparecido na tela.
- Custo: o triângulo e o chip somem sem o dono ter lido nada, ou ficam para sempre se ele entrou pelo menu.
- Solução: "visto" = o painel esteve com pelo menos metade na tela por 1 segundo (IntersectionObserver). Com A1(a), o chip leva o painel à tela e isso basta. O texto do painel fica sempre, como no quadro D-VISTO.

**A3 (corrige). "Falta: uma simulação nova" sem caminho.** O painel pede uma simulação e não oferece como fazê-la; "Ligar de novo" é um botão tracejado mudo. A mesma exigência aparece três vezes (parágrafo "Para ligar de novo...", barra "0 de 1", linha "Falta"). O quadro "Ainda não dá para ligar" tem o mesmo defeito (a explicação diz "Ver o que sairia", que não é botão).
- Custo: 12 gestos em vez de 5 (contagem acima); a exigência mal explicada vira dúvida ("onde faço isso?").
- Solução: no painel parado (e no "ainda não dá"), logo abaixo do "o que fazer": botão **"Ver o que sairia"** (a mesma ação e o mesmo nome da linha "Pode sair", Logan A7 do 19-1). Tirar a barra "0 de 1" e a linha "Falta" do parado; fica uma linha só: "Para ligar de novo: veja o que sairia (uma vez) e digite a frase." e o botão "Ligar de novo" liberado quando a simulação foi vista; antes disso, ele fica visível com o texto "Falta ver o que sairia" ao lado, não abaixo. A barra de uma só unidade é um visto, não uma barra.

**A4 (corrige). O "o que fazer" supõe o dono em casa e usa dois nomes para a mesma coisa.**
- Motivo 2: o motivo diz "aviso do banco" e o "o que fazer" diz "aviso da casa no topo desta página"; o painel de aviso da casa pode nem estar na tela (nos quadros e na página cheia não há aviso da casa; a casa pode ter voltado desde 02/05). Motivo 3: "veja se a forja e o NAS estão ligados"; motivo 10 e 13: "rode a conferência do B2 no seu Mac". Motivo 9 e 11: "quem cuida do site" é o próprio dono.
- Por quê: Jakob/uso real. O dono abre o painel de fora do país (memória do projeto: jan/2027 na Ásia). Uma instrução que exige a forja ligada em casa e um terminal no Mac, sem dizer se pode esperar, o deixa sem saber se é urgente.
- Custo: ele pode pensar que perdeu dado, ou ficar tentando resolver à distância o que pode esperar a volta.
- Solução: (a) uma linha fixa no topo de todo "o que fazer", antes do passo: **"Nada saiu do banco por causa disso, e nada sai até você ligar de novo."** (verdade pelo spec: o automático não religa sozinho). (b) Motivos que dependem de máquina em casa (2, 3, 3b, 4, 10, 13) acrescentam: "Pode esperar: se você está fora de casa, resolva quando voltar." (c) Motivo 2 e 4: usar "o aviso da casa" nos dois lados, e só mostrar o apontamento se o aviso existe; se a casa já voltou, dizer "A casa voltou a responder em dd/mm" no lugar de "espere ela voltar" (estado do dado, não da hora do desligamento). (d) Motivos 9 e 11: trocar "quem cuida do site" por "você, na configuração do site (ⓘ)" e "se não entender, anote a frase e deixe para o Claude Code ou o Cowork" é decisão do dono; no mínimo, tirar "avise quem cuida do site".

**A5 (corrige, emenda ao spec). Motivo 8 (validade de 90 dias) parece alarme.** O quadro diz "Nada deu errado", mas leva o triângulo âmbar e o chip "!" em todas as telas do Observatório. Acontece por desenho, a cada 90 dias.
- Custo: a faixa passa a ter "!" quatro vezes por ano sem problema nenhum; o dono aprende a ignorar o chip e ignora o motivo 1 ou 13.
- Solução: no motivo 8 (e só nele), o painel entra em contorno pontilhado neutro, sem triângulo e sem chip na faixa; o texto fica ("A validade de 90 dias acabou. Nada deu errado: ligue de novo quando quiser."). Isto diverge de 04 L310 (chip para toda parada) e de PLANO §1.2; declarar a divergência ao dono. Se ele preferir manter o chip, o chip de motivo 8 leva o círculo cinza, não o triângulo.

**S1 (sugestão). Excesso de blocos no painel parado.** Hoje: título, motivo, "o que fazer", "Para ligar de novo...", ⓘ, barra, botão, "Falta". Oito blocos para quatro perguntas. Com A3 ficam: título, motivo, "o que fazer" (com a linha fixa de A4), uma linha de religar e o botão.

**S2 (sugestão). O chip da faixa não diz de qual tipo.** "automático desligou em 02/05": com dois tipos, ou com um só, o dono não sabe qual. Texto: "automático desligou em 02/05" fica (frase do spec); acrescentar o tipo só em `aria-label` e no destino da âncora (A1).

### Painel "ligado", "dois passos", "perto de vencer" — **volta para ajuste**
- **A6 (corrige). Sem caminho para ler a regra nem para parar.** O ⓘ "Como desligar" manda o dono à configuração do site (variável `OBS_ARQUIVO_AUTO_DROP`), e o painel diz que "os motivos estão na regra, ao ligar": a regra só abre antes de ligar. Fora do país, para parar o automático ele troca uma variável do Vercel e refaz o deploy pelo celular (6 passos ou mais, fora do produto), e a lista que ele aceitou não está mais em lugar nenhum.
  - Custo: o "interruptor" só liga. Se ele vê algo estranho depois de um mês sair, não consegue parar na hora; o dono que consente "sem ver" precisa saber como se retira.
  - Solução: (a) link "Ver a regra" no painel ligado, abrindo a mesma janela em modo leitura (só "Fechar"); (b) pedir ao dono, em decisão separada, um botão "Desligar o automático" (um toque, confirmação simples, sem frase: é o sentido seguro). Isso é fora do spec (04 L303-312 não o tem): vai ao dono com as duas posições se Phil e Yannis discordarem. Se o dono recusar o botão, o ⓘ deve dizer em português simples quem faz e como ("peça ao Claude Code para desligar a variável ...") e não só o nome da variável.
- **S3 (sugestão). "Vai tirar algo sem eu ver?" tem resposta no futuro, não no passado.** "Próximo mês: outubro de 2027, a partir de 04/05/2028" diz o que vem; falta o que já foi: "Último que saiu: setembro de 2027, em 03/05" (o dado já existe na lista de meses).
- **Perto de vencer.** O limite de 14 dias (decisão 3) é razoável para quem passa semanas fora; o triângulo, porém, avisa de algo em que o dono não pode agir (não há "renovar"; ele só pode esperar desligar e religar com nova simulação). Aviso sem ação ensina a ignorar triângulos. Sugestão: pontilhado neutro com o texto "Vence em 6 dias. Depois disso, ele desliga e você liga de novo (veja o que sairia, digite a frase)", e se o dono aprovar renovar (decisão dele), o triângulo volta com o botão.

### Janela "Ligar o automático" — **volta para ajuste**
Passos: botão (1), ler, rolar a janela (a 390 px a janela tem 920 px de conteúdo para 685 px visíveis; a frase e o botão ficam abaixo da dobra), digitar 33 a 43 caracteres, confirmar (1).

- **A7 (corrige). A frase digitada não aceita sem acento.** Medido: "ligar automatico de views por dia" mantém o botão travado; a maiúscula e o espaço extra liberam. O C5 do 19-1 (apagar do arquivo) compara sem caixa, acento e espaço duplo; aqui, não: duas regras diferentes para o mesmo gesto.
  - Custo: num teclado de fora do país, ou com o corretor do celular, o dono digita "automatico" ou o corretor troca a letra; o botão não libera e a janela não diz por quê (só "Digite a frase para continuar").
  - Solução: comparar sem caixa, acento e espaço no começo, no fim e duplo, igual ao C5. Quando o texto não bate, mostrar "Falta: <primeira palavra que difere>" ou ao menos "Ainda não confere com a frase" (hoje a mensagem é igual a de campo vazio).
- **A8 (corrige). Quinze itens antes do campo.** São 4 regras mais 11 motivos; a lista de motivos (04 L305 manda dizê-la inteira) é uma coluna sem agrupamento, e a frase que ele precisa digitar está abaixo da dobra. Miller: mais do que cabe sem agrupar.
  - Solução: manter os onze, agrupados em quatro linhas com título curto, na ordem de leitura: **"A casa ou a cópia deixa de responder"** (casa 36 h; cópia sem verificação duas vezes; cópia atrasa 30 dias; conferência do B2 falha; forja e Mac discordam); **"O arquivo ou o banco recusa"** (arquivo de um mês diferente; banco recusa tirar um mês; mais de um mês no mesmo dia); **"O banco passa de 85% ou não pode ser medido"**; **"Validade e configuração"** (90 dias acabam; desligado na configuração). Subir a frase e o botão para cima do rol dos motivos não é possível (o dono precisa ler antes); em vez disso, o campo e o botão ficam fixos no rodapé da janela a 390 px (hoje só o botão fica).
- **S4 (sugestão). "a cada 5 meses (duas a três vezes por ano; ...)"**: duas medidas para a mesma coisa. Fica "a cada 5 meses" (e a emenda de formato em frase própria). Frase do spec: volta ao fecho.

### Painéis "ainda não dá para ligar" e "desligado" — **volta para ajuste** (só S5, e A3 no primeiro)
- **S5 (sugestão).** "Desligado" repete o título no corpo ("Automático: desligado" / "Desligado. Você tira cada mês pelo botão."), e mostra duas barras cheias com visto: condição cumprida não precisa de barra. Troca: título "Automático: desligado", corpo "Você tira cada mês pelo botão. Para o automático ligar, você já cumpriu as 3 saídas e as 2 simulações." (uma linha, sem barras). As barras ficam só no estado "ainda não dá".
- Perfil "edita": "Quem administra o site liga o automático." aprovado.

### Travado pela configuração / não medido / comentários — **pronto para o dono**, com uma ressalva
Frase direta, forma própria, nada sai. Ressalva (sugestão): "travado" diz "desligado na configuração do site", e o ⓘ nomeia a variável; vale o ajuste do A6: o dono é quem muda isso, então o ⓘ diz como.

### `interruptor.html` (os 22 quadros) — **volta para ajuste**
- **A9 (corrige). A página é mapa de revisor, não explica a si mesma ao dono.** Cada quadro traz um código ("A-INDO", "D-QUATRO", "C3B") e uma fonte "spec 04 L316-330"; o dono não conhece o spec e foi isso que ele não entendeu no índice do 19. Treze quadros de "desligou sozinho" são quase iguais e ficam em fila, sem dizer qual é qual; o dono teria de ler 13 vezes o mesmo desenho para achar a diferença.
  - Custo: ele não aprova por não entender o que está olhando (como no índice), ou aprova sem ler.
  - Solução: (a) cada quadro com um título de uma linha que diz **quando acontece** em português do dono ("Quando a casa fica 36 horas sem responder"), sem código nem número de linha de spec na parte visível (código e fonte vão para o ⓘ do quadro, para o revisor); (b) abrir a página com três linhas para o dono, como a página do Arquivo ganhou: "Este é o interruptor do automático. Ele tira um mês do banco por dia, sozinho, depois que você o liga. Veja abaixo cada situação em que ele aparece ou para sozinho." (c) a ordem vira a do uso: Antes de ligar, Ligar (a regra), Ligado, Parou (um só quadro por tipo de causa, agrupados em quatro, igual ao A8: "casa ou cópia"; "arquivo ou banco"; "banco cheio ou sem medida"; "validade e configuração"), O aviso fora da página, Casos à parte; os 13 quadros continuam na página por `?e=`, para o revisor.

## Veredito nas sete decisões do desenhista

1. **"Falta: 2 saídas feitas por você (1 de 3)", em vez de "3 saídas (1 de 3)" do spec: aprovada.** O texto do spec era contraditório (falta 3 e já fez 1). A conta do que falta é a que se lê. Pede-se a emenda do spec 04 L303 e o singular/plural já tratado ("1 saída").
2. **A linha "O que fazer" de cada motivo: aprovada a ideia, reprovada a execução.** Ver A4 (linha fixa de tranquilidade, "pode esperar", uso dos mesmos nomes, "quem cuida do site" é o dono). O motivo 11 usa frase inventada de catálogo: aceitável só como exemplo, e o mockup deve dizer isso no quadro (hoje parece frase real); a frase final vem do catálogo fechado da 14.3.
3. **Perto de vencer em 14 dias, sem botão de desligar nem renovar: 14 dias aprovado; ausência de ação reprovada (A6) e triângulo sem ação é sugestão (ver acima).**
4. **Frase de ligar da hora "ligar automático de leitura de hora em hora": aprovada a regra "ligar automático de <nome do cartão>"**, que dá uma frase por tipo sem inventar vocabulário. Mas são 43 caracteres para digitar no celular; vale a comparação sem acento (A7), e o dono deve saber que pode colar (o quadro já diz que colar vale).
5. **"Ligar de novo" tracejado com "Falta: uma simulação nova" e barra 0 de 1: reprovada** (A3): botão sem caminho para cumprir o que falta e a exigência escrita três vezes. Mudança no spec não é preciso; a regra do spec (uma simulação nova) continua.
6. **O chip "Automático ligado" some quando nada está ligado: aprovada.** O que ele mentia antes era um erro de leitura; agora responde "está ligado?" em qualquer tela. Sugestão: com um tipo só ligado, "Automático ligado: views por dia".
7. **Medição declarada: aceita**, com a nota de que o único alvo abaixo de 44 px a 390 px (o link da frase-resumo) é justamente o caminho de entrada do aviso; passa a ser o link que A1(b) torna principal (tarefa da Naksu; "para a Naksu": alvo de 44 px nesse link).

## O que cada estado diz ao dono que não entendeu o índice do 19

Pelo teste "se explica sozinho em 3 linhas": **ligado, desligado, ainda não dá, travado, não medido, comentários** passam (título + uma frase + forma). **Desligou sozinho** não passa hoje por A1, A3 e A4; **a janela de ligar** não passa por A8; **`interruptor.html`** não passa por A9.

## O que não consegui verificar

Opera real, leitor de tela, aparelho real, sol na tela, conexão ruim ou cara (o carregamento é "o estado vem do servidor com a página", sem esqueleto: não testável em mockup). O comportamento do "visto" (A2) só existe no mockup por parâmetro de URL. Não abri o tema claro; contraste e tokens são da Naksu.

## Acordo

Não há acordo ainda. Volta com A1 a A9 resolvidos (ou refutados por escrito) e a decisão do dono sobre o botão "Desligar" (A6b) e sobre a divergência do motivo 8 (A5). Sem esses, a peça não vai ao dono.
