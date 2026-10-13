# Plano do mockup 16: Lista de Canais com direção, estado e filtros (13/10/2026)

Feito antes do HTML, pela skill `frontend-design`, e revisto contra o pedido. A tela é a Lista de Canais já aprovada (mockup 8 e lote 1, tela C). Nenhum matiz novo; só formas novas.

## Para quem é e a pergunta de 3 segundos

O dono, sozinho, de manhã. Pergunta: "Algum canal que eu acompanho parou, está caindo ou sumiu, e quais estão subindo?" Resposta de relance: uma frase ("2 canais parados, 1 em queda, 4 subindo") e uma barra de quatro casas (subindo, sem mudança, descendo, não medido) com o número dentro de cada casa. A lista embaixo é a prova: cada linha repete a mesma forma, em miniatura.

## Contexto que o desenho precisa respeitar

- Hoje é 13/10/2026. A direção (M3a) já existe para canais com 56 dias de registro (os mais antigos têm 133). **"Em queda" só passa a ser medida em 14/12/2026.** Então o estado típico de hoje não tem nenhum canal "em queda", e a tela diz isso (hachura rosa e a data), em vez de mostrar 0. "Parado" já existe hoje.
- Até 19/10 a janela de 56 dias cruza a mudança de contagem de 24/08: a faixa da base avisa em uma linha.
- A linha com o acréscimo fica entre 132 e 155 px (aprovado no mockup 8); a linha em erro do lote 1 mede 141 px e é reaproveitada sem redesenho.

## Hierarquia (de cima para baixo)

1. **Frase-resumo** + **barra de direção** (4 casas, sempre as 4, mesmo com 0: zero medido é caixa vazada com 0). É a forma memorável da tela; o resto fica quieto.
2. **Filtros de estado** (Todos, Parados, Em queda, Fora do ar, Em erro) com contagem. Em queda, antes de 14/12, mostra "não medido" no lugar do número.
3. **Faixa da base** (uma linha): "views dos últimos 28 dias contra os 28 anteriores, cada canal contra ele mesmo" + legenda dos quatro símbolos. O método completo fica no ⓘ.
4. **Tabela.** Duas peças novas: a coluna **Direção** (quadrado com símbolo, percentual, régua de -50% a +50% com a faixa "sem mudança" entre -10% e +10%, e os dois números comparados) e a linha de **estado** sob o nome do canal (pastilha). O resto das colunas é o da produção.

## Decisões de forma, cor e símbolo

| O quê | Forma | Cor | Símbolo |
|---|---|---|---|
| Subindo | quadrado cheio + régua | verde `--dir-up` (só direção) | ▲ |
| Sem mudança | quadrado cheio + régua curta dentro da faixa | neutro `--dir-eq` | ＝ |
| Descendo | quadrado cheio + régua | âmbar `--dir-dn` (nunca vermelho) | ▼ |
| Não medido | pastilha com hachura rosa + motivo ("fecha em 14/11") | rosa `--nm` | hachura |
| Zero medido | caixa vazada com 0 | `--im-zero` | 0 |
| Parado | pastilha com contorno âmbar | âmbar | ícone de pausa |
| Em queda | pastilha com contorno âmbar | âmbar | ▼ em quadrado |
| Fora do ar | pastilha cheia, contorno e fundo da família do erro | `--danger` | círculo com X |
| Em erro | a do lote 1, sem mudança | família do erro | triângulo, relógio ou envelope |
| Sem vídeos | pastilha em contorno pontilhado ("ainda não existe") | neutro | ícone de vídeo |
| Inscritos ocultos | pastilha com hachura rosa ("oculto pelo canal") | rosa | hachura |

Texto de pastilha fica em `--text`; a cor mora na borda e no ícone (lição do lote 1).

## Estados (seletor no topo, fora da tela)

Típico (13/10), Dezembro (queda já medida), Extremo, Zero parados e em queda, Magro (não medido), Erro, Fora do ar, Carregando, Só leitura, 78 canais; mais o filtro de estado e o de nicho, que funcionam na própria tela.

## O que foi descartado e por quê

- **Duas colunas novas (Direção e Estado).** Estouraria a tabela de 1176 px. Estado vai sob o nome do canal; a coluna Sincronização continua só com a sincronização (e o erro do lote 1).
- **Régua com três setas por linha** (as três leituras M3 a, b, c). Só a (28 contra 28) existe hoje; (b) e (c) são da página do canal.
- **Barra com um segmento por canal.** Para 78 canais viraria listra ilegível; a barra é por contagem.
- **Cor própria para "em queda".** Seria matiz novo; a forma (quadrado com ▼ e o texto) já separa de "parado".
- **Parado e em queda como duas pastilhas.** Estouraria a altura da linha; vira uma pastilha (a causa, "parado") e uma frase curta.
