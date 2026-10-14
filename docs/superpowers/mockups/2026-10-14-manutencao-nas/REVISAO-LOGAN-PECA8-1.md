# Revisão do Logan (UX): peça 8, os vídeos antigos, rodada 1

Revisado: `peca8-canal.html` (canal: tres, dez26, um, nl; vídeo: mensal, parado, sem, arquivo), `peca8-estados.html` (16 estados), a seção "Vídeos antigos" em `arquivo.html`, `peca8.js`, `peca8.css`, NOTAS.md (bloco "Peça 8"), PLANO §1 e §10, spec 04 L474-520. Aberto com Playwright sobre `file://`, 390 e 1440 px, tema escuro (padrão do mockup): rolagem horizontal 0 e erros de script 0 nas 20 combinações; abri a simulação e o diálogo de confirmação e testei Esc (o foco volta ao botão que abriu). Capturas em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/61d7ed7e-f76d-43f4-aaa5-0d29b6b7c07a/scratchpad/p8/`.

## Resumo

Veredito do conjunto: **volta para ajuste**. Sem acordo ainda. Telas: canal (volta para ajuste), vídeo (volta para ajuste), seção "Vídeos antigos" (volta para ajuste); nenhuma reprovada, nenhuma pronta. 2 bloqueantes, 6 correções, 4 sugestões.

Três fricções que mais custam:
1. Nenhum dos 16 estados diz "pode esperar" ou "o que fazer de longe", e o único caminho de desfazer ("ver o comando") é um botão morto (B1).
2. A frase "quem cuida do site" manda o dono para ninguém: quem cuida é ele (B2).
3. O estado "ainda sem leitura mensal" está desenhado com datas que o transformam em falha silenciosa e com duas frases que se contradizem lado a lado (C1).

Não consegui verificar: leitor de tela, rede lenta de verdade, aparelho real, e se o dono consegue de fora do país mudar uma variável do Vercel (fato de infra). O bloco "Peça 8" de NOTAS.md tem só o cabeçalho (sem tabela de decisões); li as decisões do desenhista em ROTEIRO 19g §3 e as julguei ali (seção "Veredito nas decisões").

## O que a proposta acerta (preservar)

- A pergunta ("onde foram parar os vídeos velhos deste canal?") é respondida na frase "93 vídeos: 41 acompanhados, 12 em leitura mensal, 40 no arquivo", com a barra de três segmentos logo abaixo, sem rolar, a 390 px. Os três segmentos se distinguem por preenchimento (cheio, escuro, contorno), não só por tom.
- Dado ausente nunca vira zero: no canal "arquivo não lido", "pelo menos 53 vídeos" e a hachura; "0" na caixa de zero medido em dezembro de 2026.
- Em toda linha e na página do vídeo, número vem com a data ("12,3 mil views, lido em 02/05/2028", com a leitura da passagem em apoio). O gráfico não liga os pontos mensais e traz a tabela com as datas.
- Confirmação de mandar para o arquivo: frase digitada, "o que você perde / o que continua / não dá para desfazer", prova contada na hora, foco no campo, Esc fecha e devolve o foco.
- O ◐ do estado "em leitura mensal" é distinto do pontilhado de "ainda não existe".

## Passos da tarefa principal

- Saber a divisão do canal: 0 passos (frase e barra na primeira tela). Ver um vídeo que está no arquivo: 2 (abrir "No arquivo (N)", tocar o vídeo). Ver o histórico dele: 3, mas o 3º leva a uma nota que diz "desenhado à parte" (C3).
- Entender o estado de um vídeo: 0 passos (a caixa de estado é o primeiro bloco).
- Mandar um mês de vídeos para o arquivo: rolar a página do Arquivo (6.391 px a 390 px; a seção é a última), 1 toque no botão, digitar 56 caracteres no celular, 1 toque = 3 ações mais ~7 telas de rolagem. A frase digitada é do spec; a rolagem é custo da ordem da página (S1).

## Achados

### B1. "Pode esperar / o que fazer de longe" não existe em nenhum estado, e o "Ver o comando" não faz nada (bloqueia)
- **Tela e estado:** seção "Vídeos antigos", todos os 16 estados; em especial "novos registros" (vermelho), "leitura atrasada >90 dias", "leitura desligada", "não medido", "mês de espera" e o diálogo de confirmação.
- **O que falha:** a lei do dono (jan/2027 fora do país: dizer o que fazer de longe ou "pode esperar") não aparece. Varri o texto dos estados: nenhuma ocorrência de "esperar" ou "de longe". O vermelho diz "Avise quem cuida do site" sem dizer se algo se perde esperando. No estado "mês de espera", o único caminho de desfazer é o botão "Ver o comando", e ele não tem ação (`peca8.js`: o botão tem `data-p8="cmd"` e nenhum tratamento de clique), então a lei "um arquivo + uma linha curta" não está desenhada.
- **Por quê:** lei do dono; cenário de uso real (celular, fora do país, entre gravações); Hick (vermelho sem saída dita é decisão sem informação).
- **Custo:** o dono lê "vermelho" no celular, não sabe se é urgente, e ou larga o que faz à toa ou ignora um problema real.
- **Solução:** acrescentar em cada estado que pede atenção uma linha curta em cinza, sempre no mesmo lugar (fim da frase), com o texto exato:
  - novos registros (vermelho): "Pode esperar: nada desta parte sai do banco enquanto isso. Ao voltar, avise o Claude Code para investigar." (sem prometer correção pelo Cowork)
  - leitura atrasada (âmbar e vermelho): "Pode esperar: as contagens só ficam paradas; nada se perde." Só se Phil confirmar que é verdade para o intervalo de 90+ dias; senão a linha diz o limite concreto ("pode esperar até dd/mm").
  - leitura desligada: "Pode esperar. Para religar, é preciso mexer na configuração do site, no computador."
  - não medido: "Pode esperar. Recarregue a página mais tarde; isto não quer dizer que não há vídeos antigos."
  - mês de espera e simulação ("Passar à leitura mensal"): "Nada a fazer agora. Dá para desfazer fixando o vídeo, ou rodando o comando abaixo no Mac."
  - diálogo de confirmação, no alto: "Não há pressa. O histórico continua no banco até você confirmar."
  - "Ver o comando" passa a abrir o arquivo + linha curta (no formato da peça 7: um arquivo e uma linha que o roda) para desfazer a passagem de um mês; sem isso, o botão sai e a frase fica só com "fixe o vídeo".

### B2. "Peça a quem cuida do site" e "Avise quem cuida do site" mandam o dono para ninguém (bloqueia)
- **Tela e estado:** "mês de espera" (`cong`), "novos registros" (`novos`), ⓘ do automático.
- **O que falha:** num produto de um dono só, "quem cuida do site" é ele mesmo; a frase não diz a quem avisar nem como. O ⓘ do automático cita a variável `OBS_VIDEOS_ANTIGOS_AUTO` sem dizer quem a muda nem onde; o Cowork não muda variável do Vercel, então a tela não pode insinuar esse caminho.
- **Por quê:** lei do dono; texto de interface que não diz o que acontece ao agir.
- **Custo:** o dono lê um aviso vermelho e fica sem destino para ele, de longe.
- **Solução:** trocar por "Avise o Claude Code (no Mac, ao voltar)" onde a ação é investigação, e por "Fixe o vídeo ou rode o comando" onde é desfazer. No ⓘ do automático: "Mudar isto é editar a variável no painel do Vercel e publicar de novo; o Cowork não faz isso." Trocar "quem cuida do site" em toda a seção. Nota: a frase vem do spec 04 L501 e L511; a correção volta ao spec pela tabela do 04 §14.9.

### C1. "Ainda sem leitura mensal" está desenhado como falha silenciosa e com duas frases contraditórias (corrige)
- **Tela e estado:** vídeo, `?vs=sem` (captura `video-sem-390.png`).
- **O que falha:** a caixa diz "Em leitura mensal desde 05/12/2027. Ainda sem leitura mensal." e "A primeira leitura chega em 03/05/2028", sendo 03/05/2028 o "hoje" do mockup: são 150 dias sem leitura, bem acima do corte de 45 dias que o próprio spec dá para "Sem leitura desde dd/mm" (âmbar). O estado neutro (círculo pontilhado) mostra como normal uma coisa que, com essas datas, é a falha que a regra manda pintar de âmbar.
- **Por quê:** o sistema "falha em verde" (CLAUDE.md); dado ausente nunca como normal.
- **Custo:** o dono testa o estado, aprende que "ainda sem leitura" é cinza tranquilo e depois não percebe o dia em que ele passa de 45 dias.
- **Solução:** mudar as datas do exemplo para a passagem no mesmo mês de "hoje" (passagem 05/04/2028, primeira leitura em 05/05/2028), e trocar as duas frases por uma: "Passou à leitura mensal em 05/04/2028. A primeira leitura mensal ainda não aconteceu; está prevista para 05/05/2028." Acrescentar um quadro `?vs=sem-atrasado` com triângulo âmbar para a mesma situação passando de 45 dias.

### C2. Lei "a caixa diz o trecho, nunca 'desde'" (corrige)
- **Tela e estado:** vídeo em leitura mensal e no arquivo; rótulo do gráfico ("mensal desde 05/12/2027"), texto do gráfico ("Em leitura mensal desde 05/12/2027: a contagem diária termina aqui"), caixa do estado ("Desde 05/12/2027 o site lê só as contagens dele").
- **O que falha:** onde a caixa ou o rótulo descrevem um período, dizem "desde" em vez do trecho com começo e fim.
- **Por quê:** lei do dono. Ressalva: o spec 04 L476 e L485 fixam "em leitura mensal desde dd/mm" e "No arquivo desde dd/mm" como frase de estado. Não consegui confirmar a extensão exata da lei (se vale só para caixas de período, como o gráfico, ou também para as frases de estado); peço que o controlador confirme com a fonte da lei antes de mexer nas frases do spec.
- **Solução, no escopo seguro:** rótulo do gráfico: "leitura mensal: 05/12/2027 a 03/05/2028"; texto abaixo: "A contagem diária vai de 14/03/2025 a 05/12/2027. De 05/12/2027 a 03/05/2028 só há as leituras mensais abaixo." Frases de estado só mudam se a lei for confirmada para elas.

### C3. "Ver antigo" no vídeo leva a uma nota que diz "desenhado à parte" (corrige)
- **Tela e estado:** vídeo no arquivo (`data-p8="va"`).
- **O que falha:** o botão só mostra "Leva ao pedido do período (peça 6), que é desenhado à parte". A peça 6 já foi desenhada (`peca6-ver-antigo.html`, com a "ficha do vídeo"). O caminho único ("Ver antigo") fica sem destino no mockup, e o dono não testa o fluxo inteiro.
- **Custo:** o dono toca em "Ver antigo" e encontra um aviso de mockup no lugar da ficha.
- **Solução:** ligar o botão à ficha do vídeo da peça 6 (mesma janela, volta ao vídeo preservando o scroll), e tirar a nota.

### C4. No canal "arquivo não lido", a lista "O que ficou de fora" mostra "N" literal e conta errado (corrige)
- **Tela e estado:** canal, `?cs=nl` (captura `canal-nl-390.png`).
- **O que falha:** "N trocas de vídeos que estão no arquivo", "N vídeos no arquivo ficaram fora da base" aparecem com a letra N, e "12 vídeos em leitura mensal ou no arquivo ficaram fora desta conta" conta só os 12 da leitura mensal, sem os do arquivo, que não foram lidos.
- **Por quê:** frase que afirma mais do que o dado sustenta; dado ausente apresentado como número.
- **Solução:** quando o arquivo não foi lido, cada linha diz "Não foi possível contar os vídeos do arquivo", e a primeira diz "pelo menos 12 vídeos ... ficaram fora desta conta" (o "pelo menos" é o mesmo recurso do "pelo menos 53 vídeos").

### C5. Dois nomes para a mesma data de leitura (corrige)
- **Tela e estado:** lista do canal ("visto na leitura de hoje") e vídeo ("lido em dd/mm").
- **O que falha:** o mesmo conceito tem dois nomes. O spec fixa "lido em dd/mm".
- **Por quê:** consistência de nome entre telas; o dono compara números por data.
- **Solução:** "lido em 03/05/2028" nos vídeos acompanhados também (a data de hoje em vez de "hoje"), ou "lido hoje" nos dois casos; escolher um e usar em toda linha.

### C6. A referência "(ver a lista)" no diálogo de confirmação não leva a lista nenhuma (corrige)
- **Tela e estado:** diálogo "Mandar para o arquivo os vídeos antigos de dezembro de 2027?".
- **O que falha:** "Se quiser manter algum, fixe-o antes (ver a lista)". A lista de vídeos do mês não está no diálogo nem tem link; "Ver quais" existe só no estado "deixaram de poder sair".
- **Custo:** o dono quer salvar um vídeo antes de confirmar, não acha qual e confirma mesmo assim, ou cancela e perde a frase digitada.
- **Solução:** no diálogo, uma linha "Ver os 37 vídeos" que abre a lista (a mesma da peça 6 / "Ver quais") sem fechar o diálogo, ou, mais simples, trocar por "Para manter algum, cancele, fixe o vídeo na tela dele e volte aqui".

### S1. A seção "Vídeos antigos" é a última da página do Arquivo (sugestão)
- 6.391 px a 390 px; a frase-resumo da página não a menciona. O dono que veio só para os vídeos rola ~7 telas. Sugestão: a frase-resumo no topo da página cita a peça só quando ela pede ação ("37 vídeos antigos podem ir para o arquivo") com a âncora para a seção.

### S2. O gráfico a 390 px tem texto de ~8 px (sugestão, "para a Naksu")
- `.p8-grafico text` é 15 px em viewBox de 640, vira ~8,4 px a 390 px. A tabela de leituras embaixo cobre a leitura exata, então não bloqueia. Medição de legibilidade é da Naksu.

### S3. Botão "Fixar o vídeo" não diz o efeito no rótulo (sugestão)
- A frase ao lado diz "volta a ser acompanhado por inteiro", o rótulo não. Alternativa: "Voltar a acompanhar por inteiro (fixar)". Só se o nome "Fixar" não for o de todo o produto; se for, manter (Lei de Jakob dentro do produto).

### S4. "Mostrar mais 25" da lista principal é morto no mockup (sugestão)
- O botão da lista principal (`data-p8="nada"`) não faz nada; o plano pede o teste "Mostrar mais 25 em 312 vídeos". Só o do grupo "No arquivo" funciona. Ligar o da lista principal ou dizer na barra do mockup que só o do arquivo é testável.

## Veredito nas decisões do desenhista (ROTEIRO 19g §3)

1. **Gráfico do vídeo em leitura mensal é de views acumuladas** (a leitura mensal é total): aprovo. Respeita o spec L486 (linha cheia, pontilhado, pontos isolados com data) e evita inventar média diária. Condições: C2 e S2.
2. **Canal em dezembro de 2026 = 52 acompanhados:** aprovo. A soma 41 + 12 + 40 = 93 e o 52/0/0 de dezembro contam a mesma história (52 vídeos que depois migraram, mais 41 novos); o 0 aparece na caixa de zero.
3. **Frase-resumo da seção:** aprovo com ajuste. A frase atual ("37 de dezembro de 2027 podem ir para o arquivo. Os 148 de dezembro de 2026 já estão lá.") não cita os 9 de abril de 2028 nem diz que pode esperar. Texto: "Vídeos antigos: 37 de dezembro de 2027 podem ir para o arquivo, sem pressa. 9 esperam o prazo da cópia." (B1.)
4. **Linha "Agora":** troco o nome. "Agora" não é um mês nem um estado entre meses. Texto: "Esperando você" (a linha que tem o botão "Ver o que passaria à leitura mensal"). Corrige-leve, junto com B1.
5. **"Leitura mensal desligada" com triângulo âmbar e "Não dá para dizer quantos vídeos estão atrasados":** aprovo. Cumpre o spec (nunca "0 atrasados"). Falta a linha de B1.
6. **"Mostrar mais 25" também na lista principal:** aprovo a regra (mesma altura de linha, mesmo botão), com S4.

## Para a Naksu (uma linha cada)
- Texto de ~8 px no gráfico a 390 px (S2).
- Conferir o contraste do ◐ e da caixa de arquivo em escala de cinza a 16 px (o dono testa; eu não medi).

## Acordo

Não dou o acordo nesta rodada. Dou quando B1 e B2 estiverem corrigidos e C1 a C6 respondidos (aceito contra-argumento por escrito em C2, onde a extensão da lei é incerta).
