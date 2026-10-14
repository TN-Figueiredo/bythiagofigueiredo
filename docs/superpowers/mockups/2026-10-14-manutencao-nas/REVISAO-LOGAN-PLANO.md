# Revisão do Logan (UX) sobre o PLANO-DAS-TELAS da M4

14/10/2026. Revisão de plano, antes do desenho. Lidos: `PLANO-DAS-TELAS.md` inteiro; do spec 04, só as linhas citadas (L13-47, L265-293, L336-358, L413-416, L494, L544-556); `CONVENCOES.md` §1.8; `remove-dialog.tsx` e `canais-screen.tsx` (o retorno da remoção); `canais.html` aprovado (diálogo e toast); `bl.js` do 18 (conferir que não há "Remover").

## Veredito: ACORDO COM CONDIÇÕES

O desenho pode começar pelo diálogo e pelo 18-v2. As condições abaixo (C1 a C9) entram no desenho, não num novo plano. Nenhum achado bloqueia o início; os marcados **corrige** têm de estar resolvidos no mockup antes de ele ir ao dono.

| Tela | Pergunta de quem abre | Passos da tarefa principal | Veredito do plano |
|---|---|---|---|
| Diálogo "Remover canal" | "Quanto eu perco, e o arquivo vai junto?" | 3 (menu, "Remover canal…", confirmar); 4 com a frase digitada (D4) | volta para ajuste (C1-C6) |
| 18-v2 | "O banco fica sem espaço antes do alívio chegar?" | 0 (lê na pastilha) a 1 (abre o painel) | volta para ajuste (C7-C9) |
| 19, peças 1 a 8 | (seções 4-10b) | não contadas nesta rodada: avaliadas só nos pontos da §11 | segue para desenho |

**As três fricções que mais custam ao conjunto:**
1. O retorno de hoje depois de remover é um toast verde que some e diz "os dados coletados dele foram apagados" (C3). Depois de 28/11 isso é falso e a única data de ação (30 dias) se perde.
2. O plano trata D1/D2 como o caso de produção, mas a partir da primeira cópia (28/11) **todo canal tem arquivo**: o caso normal passa a ser D3 "Não | Não", o mais longo em prosa, a 390 px (C1, C2).
3. A linha da cópia do 18-v2 não tem estado para "ainda nenhuma cópia" nem para "cópia atrasada": mostra um visto cinza com data velha. O sistema falha em verde aqui (C7).

---

## 1. O que a proposta acerta (preservar na correção)

- A régua de etapas como a única forma memorável da fase, e meses como linhas de lista, não cartões verdes: o olho acha a linha com contorno de cor sem ler.
- O diálogo cresce como **mais uma linha da lista de perdas** e não como parágrafo novo; a tabela por capacidade presente (nunca por data) está transcrita sem desvio.
- D5 nunca diz "0 meses" nem "nada a limpar"; D7 é espera com saída dita (pontilhado neutro), não erro. Zero medido e não medido têm duas versões desenhadas em toda lista.
- O carregamento declarado por peça (servidor sem esqueleto; requisição com esqueleto da altura final).

---

## 2. Os 10 pontos da §11

**11.1 Vocabulário (CONV §1.8 contra o spec).** Trecho do plano: "Plano: o spec manda (é mais novo e específico), e a CONV ganha uma nota no 19." **Confirmo, com escopo fechado.** O spec define as duas expressões com sentido próprio e sem alternativa livre ("cópia" já é a mensal; L31 proíbe "cópia de segurança"). Mas a exceção vale só para as expressões exatas, não para as palavras soltas:
- liberadas: "snapshot do NAS" / "snapshots do NAS" / "Fora dos snapshots" (rótulo da 4ª etapa) e "lido em dd/mm" (sempre com data, sempre junto de um número);
- continuam proibidas: "lido" sem data ("lido pela forja", "não lido"), "snapshot" sem "do NAS", e "série" (também na lista do §1.8; o plano a usa só como nome interno, e assim deve ficar: o rótulo de tela é "Views por dia").
- **Solução:** a nota vai em dois lugares, não só no 19: no índice do 19 e numa linha acrescentada ao `CONVENCOES.md` §1.8 ("Exceção da fase de manutenção (spec 04 L29, L31): 'snapshot(s) do NAS' e 'lido em dd/mm'"); quem abrir o lote 3 lê a CONV, não o 19. O teste de vocabulário do item de aceite 38 ganha a lista de exceções por expressão exata (não por palavra), para "lido" solto continuar reprovando. Severidade: **corrige**.

**11.2 "Apagar do arquivo" com frase digitada.** Confirmo: é sem volta e pode ser a única cópia; o padrão do próprio produto (comentários, vídeos antigos, D4) e o dos painéis conhecidos (GitHub, Vercel: digitar o nome) é digitar. Condições: colar permitido; comparação sem distinção de maiúscula, acento e espaço duplo (mesma regra de C5); no `sem_destino`, o código de 8 caracteres aparece em mono, ao lado do campo, selecionável, com o rótulo "Digite o código deste arquivo: AB12CD34". Severidade: **corrige** (o desenho precisa do quadro).

**11.3 Duas leituras no diálogo (D5 e D8).** Confirmo que convivem, com duas condições que o plano não cobre:
- **D8 desenhado com a quinta linha.** Hoje, quando a contagem do banco falha, a lista some e vira o parágrafo "Remover apaga todo o histórico deste canal: os vídeos…" (`remove-dialog.tsx` L61-64). O plano não diz onde fica a linha "No arquivo" nesse caso. **Solução:** em D8 o parágrafo de hoje substitui só as quatro linhas do banco; a linha "No arquivo" continua abaixo dele como linha da lista, com o mesmo desenho de D3 (e o parágrafo D4, se couber).
- **D5 com as quatro linhas lidas:** as contagens que têm parcela no arquivo (ver 11.5) ficam incompletas. Mostrar "420 dias de registros" quando o total é 812 é um número parcial apresentado como total. **Solução:** em D5, cada contagem que teria parcela no arquivo vira "pelo menos 420 dias de registros", apoio "a parte no arquivo não foi lida". 
- D5 + D8 juntos: um quadro próprio; o de confirmar não é oferecido (vale a regra mais restritiva).
- Severidade: **corrige**.

**11.4 "Mockup 18" no diálogo.** Confirmo (ver o achado do redator, seção 4). Severidade: n/a.

**11.5 Parcela do arquivo nas contagens.** Confirmo a forma ("812 dias de registros", apoio "420 no banco, 392 no arquivo"), com duas condições:
- **A parcela só aparece quando a parte no arquivo for maior que zero.** Antes de 28/11, e em canal novo, o apoio fica o de hoje ("views diárias dos vídeos"); repetir "0 no arquivo" em quatro linhas é ruído em toda remoção.
- **O apoio de hoje não some**, ele recebe a parcela: "views diárias dos vídeos; 392 dias no arquivo". Senão a linha perde o "o que é" para ganhar o "onde está".
- Em D5, a regra "pelo menos N" de 11.3. Severidade: **corrige**.

**11.6 Cor de "a casa não respondeu".** Trecho: "triângulo até 36 h, octógono a partir de 36 h". Confirmo: 36 h já é o limite do motivo 2 do automático (04 L319), e um só limite em toda peça evita a mesma ausência com duas cores em duas telas. Condições: a frase leva sempre a data e a hora do último sinal; o limite de 36 h fica no ⓘ da legenda ("Como ler as formas"), não na frase; o mesmo limite vale no diálogo (D6), no 18-v2 (V8) e na peça 2. Severidade: n/a (acordo).

**11.7 "Quem ocupa" com o mês destacado.** Confirmo a sub-linha recuada com o pontilhado neutro (é o mesmo pontilhado da etapa "Espaço liberado" da peça 2: coerente). Condições:
- a sub-linha é **parte** de "Concorrentes", não soma de novo no total (o maior resto é feito no nível de cima; a sub-linha só detalha);
- o mesmo mês entra **em primeiro lugar** na lista "O que libera espaço" (V5) e na linha da cópia com 70% ou mais (V3): "Outubro saiu das telas: liberar o espaço devolve cerca de N% do banco". É a alavanca mais barata e já está meio feita; o plano lista "meses prontos para sair" primeiro e esquece o mês que já deu o primeiro passo. Severidade: **corrige**.

**11.8 Frases-resumo da página do Arquivo e da fila.** Confirmo as duas, com a ordem de prioridade dita, porque o plano só desenha o caso de um mês:
- Arquivo, ordem do que vai à frase: (1) a casa não responde, que explica as outras linhas: "A casa não responde desde dd/mm hh:mm: nenhum mês pode sair até ela voltar."; (2) meses que precisam do dono: "2 meses precisam de você; o mais urgente: Views por dia, outubro: conferir o B2."; (3) canais removidos que pedem comando: "e 1 canal removido pede um comando seu."; (4) só então "Próxima saída possível: dd/mm/aaaa.".
- Sem nada: a do plano, na caixa de zero medido? **Não**: "Nenhum mês precisa de você" não é dado zero, é estado calmo; texto `--muted`, sem caixa, sem verde.
- Não medido: hachura, "Não foi possível ler o estado do arquivo."; nunca "Nenhum mês precisa de você".
- Fila: a do plano; zero, "Nenhum item espera um comando seu." (caixa de zero medido: aqui é contagem); não medido, hachura. Severidade: **corrige**.

**11.9 "Arquivo" com dois sentidos.** Confirmo a troca para "a cópia de <mês> no NAS" onde o plano escreve frase nova. Acrescento um caso que vai a produção: a frase fixada do D3 diz "marca o arquivo para apagar. Os arquivos só somem do NAS e do B2" (ficheiros), duas palavras iguais em dois sentidos na mesma linha. Proposta, a levar ao dono junto do spec (não muda sem acordo): "marca o arquivo para apagar. Ele só some do NAS e do B2 depois de um comando seu…". E no ⓘ: "Depois dos arquivos, os snapshots…" vira "Depois disso, os snapshots…". Severidade: **sugestão**.

**11.10 Casa fora no diálogo (D6).** Trecho: "o plano a mostra antes e depois do clique". Confirmo **depois do clique sempre**; **antes do clique só na combinação "Sim | Sim"**. Motivo: antes do clique a frase não muda a decisão ("A remoção vale do mesmo jeito"), e em "Não | Não" e "Não | Sim" nada se limpa de qualquer jeito até o comando existir, então a frase a mais só pede leitura. Em "Sim | Sim" ela muda a promessa "em até 30 dias", e aí vale antes. Severidade: **corrige**.

---

## 3. A fricção, cirúrgica (achados fora da §11)

### C1. O caso de produção depois de 28/11 é D3 "Não | Não", não D1/D2 (corrige)
- **Trecho:** §2, "os estados que o dono verá primeiro em produção são os da combinação 'Não | Não': D1, D2 e D5."
- **Falha:** é verdade só até 28/11. A primeira cópia leva outubro de **todos** os canais ao arquivo; do dia seguinte em diante toda remoção é D3 (e, sem o comando, "Não | Não").
- **Custo:** o quadro mais testado e polido seria o que deixa de existir em seis semanas; o que fica é o mais longo.
- **Solução:** no §2 e no roteiro de teste (2.5), D3 "Não | Não" a 390 px no tema claro entra como o primeiro quadro de teste, junto de D1 e D2. O item 2 de 2.5 vira "D1, D2 (até 28/11) e D3 Não | Não (a partir de 29/11)".

### C2. D3 a 390 px: prosa empilhada e o botão abaixo da dobra (corrige)
- **Trecho:** §2.1, itens 3 a 9 (lista de 5 linhas + "Também saem…" + "O que acontece:" com cinco frases em "Não | Não" + "Não dá para desfazer:" + botões).
- **Falha:** são três parágrafos seguidos depois da lista, cerca de 90 palavras; a 390 px o par de botões cai abaixo da primeira tela. A pessoa rola para achar o botão e passa os olhos por prosa que não muda a decisão. Contraria a preferência do dono (nada de bloco em prosa) e o cenário de celular.
- **Solução, em ordem:**
  1. Rodapé de botões fixo na caixa (o conteúdo rola por dentro, os botões ficam à vista), como as folhas de confirmação do iOS e do Android. **Para a Naksu:** altura, sombra de borda e o tamanho do sizer com o rodapé fixo.
  2. "O que acontece:" vira lista de itens curtos, **uma frase do spec por item, sem mudar palavra**: "O site remove o canal agora e marca o arquivo para apagar." / "Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac." / "Esse comando ainda não existe e ainda não tem data para chegar. Até lá o arquivo continua no NAS e no B2." / "A página do Arquivo vai mostrar cada passo e o dia em que acabou."
  3. Ordem: lista de perdas → "O que acontece:" → "Não dá para desfazer:" → "Também saem as leituras da forja…" (é a informação de menor peso; desce) → parágrafo D4 + campo → botões.
- **Sugestão (não bloqueia):** debaixo de "O que acontece:", a régua de quatro etapas do canal removido em miniatura (Limpeza pedida, Apagado do NAS, Apagado do B2, Fora dos snapshots), a 1ª marcada "agora", as outras pontilhadas. É a mesma forma que o dono vai ler no bloco "Canais removidos": aprende uma vez.

### C3. O retorno depois do clique é um toast verde que some e mente (corrige)
- **Trecho:** §2.4, "verificar no `canais.html` aprovado qual é: aviso no topo da lista".
- **Evidência:** verificado. Não há faixa: é toast com temporizador (`_chrome/toasts.tsx` L56). Em produção, `canais-screen.tsx` L260: `toast('ok', \`${name} removido\`, 'O canal saiu do observatório e os dados coletados dele foram apagados.')`. Tipo `ok` (verde) e frase que diz que tudo foi apagado.
- **Falha:** depois de 28/11, com arquivo, "foram apagados" é falso; e na combinação "Sim | Sim" a única data de ação ("até dd/mm (30 dias). Ponha um lembrete no celular") some com o toast. Se o dono estiver gravando e desviar o olho, perde o prazo.
- **Solução:**
  - Sem arquivo e sem imagens (frase i): toast do tipo `ok`, com o temporizador de hoje, texto "Canal removido em dd/mm. Não havia arquivo: nada a limpar." É de fato terminado.
  - Com arquivo ou com imagens no Blob ("Não | Não" e "Não | Sim"): toast **neutro** (tipo `''`, nunca `ok`), com a frase do spec; como "até lá não há nada a fazer", pode ter temporizador, mas o dobro do tempo de hoje para a frase longa.
  - "Sim | Sim": **faixa persistente** no topo da tela Canais, neutra com a caixa de arquivo, com a frase inteira e "ver os comandos", que só sai com "Entendi" (ou quando o bloco "Canais removidos" mostrar o canal como limpo). Nunca toast.
  - A frase de hoje ("os dados coletados dele foram apagados") sai do código **no mesmo commit da M3b**: é texto de produção que fica falso no dia 29/11.

### C4. Conexão caída no clique de confirmar (corrige)
- **Trecho:** ausente no §2.2.
- **Evidência:** `canais-screen.tsx` L259: falha da requisição mostra "Não deu para remover o canal" / "<nome> continua no observatório.".
- **Falha:** se a conexão cai **depois** de o servidor remover (rede de celular no exterior), a tela afirma que o canal continua, e o dono tenta de novo sobre um canal que não existe mais, ou acha que o arquivo não foi marcado.
- **Solução:** estado D9 "a resposta não chegou": "Não foi possível confirmar se o canal foi removido: a conexão caiu. Recarregue a lista para ver." + botão "Recarregar". A frase "continua no observatório" só quando o servidor respondeu com recusa. D7r continua como está (é recusa com resposta).

### C5. D4: o nome a digitar no celular (corrige)
- **Trecho:** D4a, "desabilitado até o nome bater (maiúscula ou minúscula; colar não é bloqueado)".
- **Falha:** nome de canal de viagem tem acento, emoji e espaço duplo ("Mochilão ✈️ pelo Mundo"). Digitar emoji no teclado do celular é uma busca; acento errado reprova sem dizer por quê. O botão desabilitado não diz o que falta.
- **Solução:** comparar depois de tirar emoji e símbolos, acentos, espaços repetidos e das pontas, sem caixa. O nome a digitar aparece em negrito dentro do parágrafo D4, selecionável. Rótulo do campo: "Nome do canal". Status (`role="status"`) enquanto não bate: "Digite o nome do canal para continuar."; quando bate: "Nome confirmado." O campo fica **imediatamente acima dos botões** (ordem de C2), não separado deles por "Não dá para desfazer".

### C6. D5 e D7: o que fazer agora (corrige)
- **D5, trecho:** "Não foi possível ler o arquivo deste canal. Nada foi removido." + "Tentar de novo"; o de confirmar não é oferecido. A frase é do spec; falta o status que diz quando se pode remover. **Solução:** status de D5: "Não foi possível ler o arquivo deste canal. Remover fica disponível quando a leitura der certo." (mesmo molde do status de D0).
- **D7, trecho:** "No lugar do botão: …". O diálogo ainda mostra "Remover apaga todo o histórico deste canal:" e a contagem inteira de algo que não pode acontecer. **Solução:** em D7 não se conta; o diálogo é título + a frase de D7 + "Fechar" (não "Cancelar": não há o que cancelar). Se o estado só for conhecido depois da contagem, a frase entra no lugar da lista e o botão vira "Fechar". A tarefa cai de "ler 5 linhas, ler 3 parágrafos, descobrir que não pode" para "ler uma frase".

### C7. 18-v2, linha da cópia sem "ainda nenhuma" e sem "atrasada" (corrige)
- **Trecho:** V1, "Todo mês fechado é copiado para o NAS e para o B2. Última cópia: dd/mm", "linha da cópia em cinza com o visto".
- **Falha:** antes da primeira cópia (até 28/11) não há data a mostrar; e se a cópia de um mês fechado falhar, a linha continua cinza com visto e a data velha. É o sistema falhando em verde.
- **Solução:** três estados a mais na barra do 18-v2:
  - V0 antes da primeira cópia: "Todo mês fechado é copiado para o NAS e para o B2. A primeira cópia é a de outubro, a partir de 28/11." Círculo pontilhado neutro.
  - V1a cópia atrasada: "A cópia de <mês> está atrasada há N dias." com a forma de "atrasado" da peça 2 (âmbar acima de 5 dias, vermelho acima de 30), e a porta para a página do Arquivo.
  - V1n não medido: hachura, "Não foi possível ler a última cópia."; nunca o visto.

### C8. V4 sem as datas e V8 em bloco de prosa (corrige)
- **V4, trecho:** "a frase 'o alívio chega depois do aperto'". A frase não diz quanto tempo de aperto. **Solução:** a frase fixada fica; os dois marcos na régua levam a data embaixo ("85% em 12/03", "pronto em 01/05"), e a faixa âmbar-vermelho, o rótulo "50 dias".
- **V8, trecho:** a frase de cerca de 70 palavras. **Solução:** as mesmas palavras, quebradas: primeira frase como frase-resumo; "O que fazer:" vira lista de três itens na ordem do spec (religar a forja e o NAS; não acrescentar canais; pausar a coleta se chegar a 85%). Lido do celular no exterior, a ação tem de estar num item, não no meio de um parágrafo.

### C9. Quem lê a régua do 18-v2 V2 (sugestão)
- A pastilha âmbar com a barra de hoje abaixo de 70% vai ao dono como divergência; o plano já a declara. Pedido para o desenho: o segundo marcador da barra tem rótulo de texto visível (não só `title`), porque é ele que explica a cor da pastilha.

### Para a Naksu (uma linha cada, sem medição minha)
- O rótulo do botão troca de "Remover canal" para "Remover e apagar do arquivo" quando a contagem chega: largura reservada para o mais longo, e os dois botões empilhados a 390 px.
- Rodapé fixo da caixa (C2) com o sizer de hoje.

---

## 4. Os dois achados do redator

**A. "O mockup 18 não tem diálogo de remover canal; desenhar sobre a tela Canais."** Confirmo. Conferi `bl.js` do 18: a única menção a remover é o ⓘ da exportação ("o canal não pode ser removido"), na L239. Desenhar um diálogo dentro do 18 criaria um segundo lugar para a mesma ação, o que contraria "a mesma ação no mesmo lugar". Condições: a linha "18" da tabela de sincronia diz "sem quadro: o 18 não tem diálogo de remover; a remoção mora na tela Canais (menu, gaveta e linha de erro abrem o mesmo diálogo)"; e o spec 04 (L270-271), que diz "tela Canais e mockup 18", recebe a mesma nota no próximo fecho, para o implementador não procurar um segundo diálogo.

**B. "CONV §1.8 proíbe 'snapshot' e 'lido'; o spec fixa as duas."** Ver 11.1: o spec manda, só para as expressões exatas, com a nota também no `CONVENCOES.md` e a lista de exceções no teste do item 38.

---

## 5. O que eu NÃO verifiquei

- Nada foi aberto em navegador: é revisão de plano. Altura real do D3 a 390 px, posição do botão e quebra das frases longas ficam para a revisão do mockup.
- Leitor de tela (a ordem de anúncio do status com o campo de D4), rede lenta de verdade e aparelho real.
- Se as quatro contagens do banco de hoje são todas as que têm parcela no arquivo (C11.5): é do engenheiro de dados.
- As seções 4 a 10b do plano foram lidas, mas não avaliadas tela a tela; voltam na revisão do 19.
