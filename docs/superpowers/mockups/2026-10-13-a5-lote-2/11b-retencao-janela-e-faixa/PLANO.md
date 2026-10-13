# Plano de UX do mockup 11b: Retenção do vídeo próprio com janela e faixa (13/10/2026)

Feito antes do HTML, com a skill `frontend-design`. Acréscimo ao bloco "Retenção" aprovado (mockup 6, curva de exemplo): o que já existe aparece normal; o que a proposta acrescenta leva o contorno tracejado verde-água e "+ novo". Mesmos tokens de `a4.css`; nenhum matiz novo.

## Para quem é e a pergunta de 3 segundos

O dono, sozinho no CMS, olhando um vídeo dele. Perguntas, nesta ordem: (1) "esse vídeo segura as pessoas bem ou mal?"; (2) "onde elas saem?"; (3) "isso vale para a estreia ou para a vida toda?".

Resposta de relance, em duas peças lado a lado no topo do bloco:
- **frase**: "Nos primeiros 30 dias, metade das pessoas já saiu aos 3:12 (19% do vídeo)."
- **faixa**: "▲ Acima de vídeos de duração parecida", dita como cálculo do YouTube, com régua de 0 a 1 e a marca.

## Direção visual (plano feito antes do código, revisto contra o pedido)

- **Cor** (os tokens do produto, nada novo): curva em laranja (`--lado-o`, "o canal do dono"); direção só em verde ▲ / âmbar ▼ / neutro ＝ (`--dir-*`); não medido em rosa com hachura (`--nm*`); zero medido em caixa vazada (`--im-zero`); erro na família do erro; proposta em verde-água tracejado.
- **Tipo**: Inter no corpo, JetBrains Mono nos números (tabular), Fraunces só no título do vídeo (já do cabeçalho). Nenhuma fonte nova.
- **A forma memorável (uma só): a régua do YouTube.** Uma barra de 0 a 1 em três zonas (abaixo, na média, acima) com a marca do vídeo cravada nela e o 0,5 tracejado. É a única peça nova com desenho próprio; o resto reaproveita a linguagem do lote 1.
- **Seletor = três cartões que já mostram a curva.** Cada cartão tem uma miniatura da curva da janela, a frase curta e a data da leitura. O dono compara as três janelas sem clicar, e o clique só decide qual vai para o gráfico grande. Janela sem dado vira cartão com hachura e o motivo.

## Hierarquia

1. Título "Retenção" + ⓘ (existe) e a marca "exemplo".
2. Seletor de janela (novo): 3 cartões, "Salvo neste navegador · Voltar ao padrão" quando a escolha não é o padrão (vida inteira).
3. Frase (existe, agora por janela) à esquerda; faixa do YouTube (nova) à direita. Abaixo de 900 px, a faixa desce.
4. Curva grande (existe) com, na vida inteira e havendo duas leituras ou mais, a primeira leitura tracejada por baixo.
5. "Como a curva mudou desde dd/mm" (novo): três linhas antes/agora/mudou com ▲ ▼ ＝; as leituras todas num `<details>`.
6. Maiores saídas e trechos revistos (existem): agora com os mesmos símbolos da curva, e "0" em caixa vazada quando não há trecho.
7. A data da leitura sempre escrita ("Leitura de 12/10"). Método sempre no ⓘ.

## O que a tela NÃO mistura

A faixa do YouTube (contra vídeos de todo o YouTube de duração parecida) e o "% assistido contra o canal" (mockup 5 e B, contra os outros vídeos do canal; régua "na média = até 2 pontos") têm cada um a sua régua e a sua frase. A faixa traz a marca "cálculo do YouTube" e a régua de 0 a 1; o ⓘ diz que não é o % assistido.

## Estados (todos por `?caso=`, e `?janela=7|30|vida`)

típico, janela ainda aberta, extremo (Short, curva acima de 100% e marca encostada em 1), vídeo de 2015, poucas views com curva serrilhada, poucas views sem curva, YouTube sem a comparação, zero medido, não coletada (hoje), vídeo novo (vazio), erro com leitura anterior, erro sem leitura, só leitura (número privado). Em todos: 1440 escuro e 390 claro.

## Descartado

- Seletor em abas só com o nome: o dono teria de clicar três vezes para saber se as janelas diferem. Ficou o cartão com miniatura.
- Faixa como semáforo de três bolas: perde o "quanto". Ficou a régua com a marca e o valor.
- Cor nova para "acima/na média/abaixo": o lote 1 já usa ▲ ▼ ＝ com as cores de direção para a mesma ideia; a diferença está na régua e no selo "cálculo do YouTube", não em matiz.
- Texto corrido explicando as janelas: foi para o ⓘ.
