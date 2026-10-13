# Plano do mockup 14: a leitura M10 (13/10/2026)

Feito antes do HTML, seguindo a skill frontend-design. A linguagem visual é a do lote 1 aprovado (tokens, `.nm`, `.ex`, `.c2-novo`, ⓘ, zero = caixa vazada); este plano só decide o que é novo.

## Para quem e a pergunta de 3 segundos

Quem edita o site, olhando um vídeo de concorrente (Histórico do vídeo) ou a lista de Outliers. Pergunta: **"Este vídeo estourou e parou, ou não?"** E a pergunta de trás, que decide se a tela é honesta: **"Isso é medido ou é palpite?"**

Resposta de relance (nesta ordem): (1) **três casas** no alto: cheias = o sinal vale, vazadas = não vale, hachuradas = não medido; (2) uma frase com o número "3 de 3" ou "2 de 3"; (3) a palavra **indício** colada ao nome da leitura, sempre; (4) só depois as três réguas com os números.

## A forma memorável (uma só)

**As três casas.** São o mesmo desenho no bloco do Histórico (18 px, no cabeçalho), na linha do Outliers (14 px, na coluna Leitura) e no ⓘ. Elas contam sinais, não dão nota: nenhuma cor de bom ou de ruim, nenhum percentual, nenhum selo. É a resposta ao risco 11 (parecer veredito): o desenho mostra "quantos dos três sinais batem", e o texto obrigatório diz o que isso não prova.

Tudo em volta fica quieto: neutro (`--text`/`--muted`), com um único matiz de dado, o azul `--lado-b` ("o outro canal") para o marcador do vídeo. Verde e âmbar ficam de fora: são cor de direção, e aqui não há direção.

## Hierarquia do bloco

```
[+ novo] Estourou e parou  (indício)  ⓘ  [exemplo]
■■■  Os 3 sinais batem: ...         (uma frase, <span> único)
┌ Muitas views cedo ┐ ┌ Quase nada depois ┐ ┌ Pouca reação ┐   três cartões, mesma anatomia
│ ✓ vale            │ │ ✓ vale            │ │ ✓ vale       │   símbolo + palavra
│ 184 mil [exemplo] │ │ 9% [exemplo]      │ │ 0,6% [exemplo│   número grande
│ 3,4× o normal     │ │ 0,3× o normal     │ │ 0,3× o normal│
│ ●──┆────│  régua   │ │ ●┆───│  régua     │ │ ●┆──│ régua   │   marcador, limite, normal
│ este vídeo/limite/normal  (3 colunas)                       │
└───────────────────┘ └───────────────────┘ └──────────────┘
Nota fixa: Indício, não medição.  (3 linhas: o que vimos / hipótese nossa / o que ninguém de fora vê)
```

- Cada régua tem o mesmo desenho: trilho, **faixa "vale"** (sombra neutra), **limite** (linha tracejada grossa), **normal do canal** (linha fina), **este vídeo** (círculo azul). Valor acima do fim do trilho: o marcador vira ▶ colado na ponta. Zero: caixa vazada na ponta esquerda.
- O cartão "Quase nada depois" tem duas réguas (cauda e "ainda rende", que valem as duas); a segunda não tem "normal do canal" porque o limite de 2% é fixo.
- O texto obrigatório entra no corpo, **inteiro e frase por frase**, em três linhas com símbolo e rótulo curto: ◉ "O que vimos", ? "Hipótese nossa", ∅ "O que ninguém de fora vê". Não é parágrafo: o leitor distingue dado, palpite e o que é invisível pela forma do símbolo, não só pela leitura.
- Método e fonte no ⓘ (frase fixa "cálculo do Observatório sobre dados públicos do YouTube").

## Estados e o que cada um responde

| Estado | Casas | Frase | Observação |
|---|---|---|---|
| típico | ■■■ | Os 3 sinais batem | texto obrigatório presente |
| extremo | ■■■ | idem | marcador ▶ na ponta; 0,02% sem cortar |
| na borda | ■■■ | idem | exatamente 2×, metade e 2%: "igual ao limite vale" |
| zero medido | ■■■ | idem | "0" em caixa vazada (nenhuma view depois dos 30 dias) |
| não é o caso (2 de 3) | ■■□ | Só 2 dos 3 sinais batem: não é o caso | sem o texto obrigatório (ele afirmaria o que não vale); números todos à vista |
| não medido, 6 motivos | ▨▨▨ ou ■■▨ | Não medido: <motivo> | cada um diz quando passa a existir ou "nunca para este vídeo" |
| sem dado (a leitura ainda não existe) | ┈┈┈ pontilhadas | Só exemplo até 2027 | contorno pontilhado, não hachura |
| erro | — | Não foi possível calcular agora | família do erro; não parece "não é o caso" |
| carregando | — | Calculando... | `aria-busy` |

O Outliers repete a mesma lógica numa linha: casas + pastilha só quando há leitura; "não é o caso" em texto fraco; "não medido" com hachura e motivo curto. Acima da lista, uma barra de cobertura (com a leitura / não é o caso / não medido) e o texto obrigatório quando alguma linha tem a leitura.

## Revisão do plano contra o brief (o que mudei)

1. A primeira ideia era um selo grande "Estourou e parou" no cabeçalho. **Revisado:** selo é o risco 11. O nome virou título discreto com a pastilha "indício" ao lado, e a resposta de relance passou a ser a contagem de sinais (as três casas).
2. A ideia de pintar "vale" em verde e "não vale" em vermelho foi **descartada**: verde/âmbar são direção; vermelho é erro. Vale = casa cheia + ✓ + a palavra; não vale = casa vazada + ✕ + a palavra.
3. Um eixo único em "×" para as três réguas deixava as duas de "pouca coisa" coladas no zero. **Revisado:** cada régua tem eixo próprio (0 a 4× o normal; 0 a 2× o normal; 0 a 2× o normal), e a legenda de 3 colunas sob a régua diz os valores reais (não só em ×).
4. O texto obrigatório como parágrafo seria "prosa". **Revisado:** três linhas com símbolo e rótulo; as frases ficam idênticas ao spec.
