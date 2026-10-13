# Plano do mockup 22: "Perguntar a uma IA" (feito antes do desenho, com a skill frontend-design)

Spec: `07-forja-cowork-e-contexto-para-ia.md` 8.1.5 e 8.1.4; `04-medidas...` tabela 6.5b linha 163 e item 159. Lote 1 aprovado e `CONVENCOES.md` são a linguagem: nenhum matiz novo, sem `color-mix()`, hachura rosa = "não medido", caixa vazada = "zero medido".

## Para quem é e a pergunta de 3 segundos

Quem vê o Observatório (o dono, a irmã, um editor) e quer levar o que a tela mostra para uma IA. Em 3 segundos o diálogo tem de responder, nesta ordem:

1. **O que vai sair do site?** A frase-resumo no topo: "Pacote da tela Comparar: 7 tabelas, 12.400 caracteres, nada privado".
2. **Cabe?** A barra de tamanho com a marca do limite (30.000) e, se cortou, a parte cortada desenhada.
3. **O que ficou de fora e por quê?** Sempre as mesmas quatro linhas (tamanho, dado privado, texto de comentários, chaves e links de acesso), cada uma com símbolo, cor e palavra. Quem aprende a ler uma vez lê todas.

Depois: a prévia do texto, o campo da pergunta e o aviso de que o texto sai do site, colado em cima dos botões.

## A forma memorável (uma só)

**As quatro linhas "o que ficou de fora"**, sempre as mesmas, mudando só de estado. O resto é quieto. A segunda forma de relance é a barra de tamanho: cheia até onde a cópia vai, listrada onde só o arquivo completo leva, pontilhada onde nada leva.

## Onde fica o botão (uma posição só)

A **faixa de topo** da tela: a primeira linha do corpo, extremidade direita, acima do título. À esquerda dela fica a migalha (quando a tela tem); à direita, o fuso ("Horários em São Paulo") e o botão. Nas telas raiz do Observatório (Canais, Mudanças, Outliers, Insights, Saíram do YouTube) a esquerda fica vazia e o botão continua à direita. A 390 px, se a migalha não deixar espaço, o botão desce para uma linha própria, ainda à direita, ainda acima do título. Todas as 11 telas usam o mesmo componente. É um acréscimo: leva "+ novo" tracejado verde-água.

## Hierarquia do diálogo (1440, escuro)

```
 Perguntar a uma IA  [+ novo]                                    [X]
 Pacote da tela Comparar: 7 tabelas, 12.400 caracteres, nada privado  (i)
 +---------------------------------------+-----------------------------+
 | pacote-comparar-2026-10-13.md  Markdown| Tamanho  12.400 de 30.000   |
 | (prévia: início, dobra, fim)           | [====----------------|]  v  |
 |                                        | Os números no pacote        |
 |                                        | [medido|0|nao medido] 18/0/4|
 |                                        | O que ficou de fora  (4 lin)|
 |                                        | Minha pergunta [          ] |
 +---------------------------------------+-----------------------------+
 ! Este texto sai do site: ao colar numa IA ... serviço de terceiros
 [Copiar texto] [Baixar .md]                                   [Fechar]
```

A 390 px (claro) vira uma folha de tela cheia, uma coluna, na ordem: frase, tamanho, números, fora, pergunta, prévia, aviso, botões (cabeçalho e rodapé fixos).

## Estados

tipico, copiado, falhou ao copiar (Baixar .md vira o botão principal), cortado por tamanho (tela de Mudanças: 41.800), passa até do arquivo completo (Canais com 60 canais: 262.400), zero medido (Outliers), não medido (canal novo: primeira linha do pacote avisa), vazio (nenhum canal), só leitura (canal próprio sem o direito "ver desempenho privado"), com dado privado (vídeo próprio, marca "inclui dado privado do canal"), comentários de terceiros incluídos, erro ao montar, carregando, e dois de tela: fechado (a tela com o botão) e o mapa das 11 posições.

## Cor e símbolo (nenhum matiz novo)

| Significado | Cor | Símbolo |
|---|---|---|
| cabe / incluído | `--success` | ✓ (traço) |
| cortado por tamanho | `--warning` | tesoura de traço |
| não incluído por falta de direito | `--warning` | cadeado fechado |
| esta tela não tem | `--muted`, contorno pontilhado | círculo pontilhado |
| nunca entra (chaves e links) | `--muted` | cadeado de traço |
| inclui dado privado do canal | `--accent` ("seu canal") | cadeado + a palavra |
| erro ao montar / copiar | `--danger` na borda e no ícone, texto em `--text` | triângulo |
| não medido / zero medido (na barra "Os números") | hachura `--nm` / caixa `--im-zero` | forma própria + contagem |

## Decisões de restrição

Sem prosa: a prévia é bloco de código com cabeçalho; o método e a regra de corte vão em dois ⓘ. O aviso fixo é a única frase corrida e não pode ir para o ⓘ (é a regra de privacidade). Foco preso e Esc fecham pelo `<dialog>` modal nativo, com foco inicial no campo da pergunta e devolução ao botão que abriu (mesmo padrão do painel APAGAR do lote 1).
