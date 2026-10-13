# Plano da tela 12: de onde vêm as views (feito antes do desenho, 13/10/2026)

Método da skill frontend-design: ancorar no assunto, plano de fichas (cor, tipo, layout, princípios), conferir o plano contra o pedido e só então escrever HTML. Aqui o "cliente" já tem linguagem aprovada (lotes A4 e 1), então a liberdade de estilo é pequena de propósito: a tela tem de parecer do mesmo produto. O risco de ficar genérico está no desenho dos dados, não na casca.

## Para quem e a pergunta de 3 segundos

O dono (e, só leitura, a irmã) abre a página de um vídeo ou do canal e pergunta: **"de onde vêm as minhas views, e eu posso confiar nesse número?"**. A resposta de relance é uma barra empilhada, uma frase com dois números e uma linha que diz **em quantos dos dias pedidos a origem foi realmente medida**. A segunda metade da pergunta ("posso confiar?") é o que torna esta tela diferente de um gráfico de pizza: a coleta começa em 04/10 (exemplo), o YouTube omite origens pequenas, e termos e sites são privados. Cada uma dessas ausências tem forma própria.

## A coisa memorável (gasto toda a ousadia aqui, o resto fica quieto)

**Uma barra de 40 px que fecha com o total de views, e cuja última fatia é o que o YouTube não disse.** A fatia "omitido pelo YouTube" é tracejada e vazada: não é zero (caixa cheia de 0), não é "não medido" (hachura rosa), não é "ainda não existe" (pontilhado). Ela é uma quantidade conhecida (total do dia a dia menos a soma das origens), então tem largura, número e porcentagem. Nunca é redistribuída pelas outras fatias. Em canal pequeno ela domina a barra, e isso é a mensagem.

Logo acima da barra, uma **régua de cobertura** (a mesma ideia da faixa de 7 casas do lote 1): hachura rosa nos dias antes da coleta, barra cinza nos dias medidos, losango na marca de 24/08/2026. O percentual da barra é sempre "dos dias medidos"; a régua diz quantos são.

## Hierarquia (de cima para baixo)

1. **Seletor de período** (7 dias, 28, 90, desde 2015 ou desde a publicação), lembrado no navegador, com "Voltar ao padrão". Mesmo padrão do mockup B do lote 1.
2. **Frase-resumo** com chip da origem líder: "Nos 8 dias medidos (04/10 a 11/10), 42% das views vieram da pesquisa do YouTube e 18% de vídeos sugeridos; 6% foram omitidos pelo YouTube."
3. **Régua de cobertura**, **barra empilhada**, **lista que é também legenda** (símbolo, nome, views, %). Sem segunda barra por linha: a lista só dá o número exato.
4. **Impressões por origem**: barra menor, mesmas cores e símbolos, janela própria (desde 08/09).
5. **Termos e sites** (cartão largo, com selo de cadeado "só quem edita"): duas listas, e uma barrinha de "com termo / sem termo" que só aparece quando a origem cobre os mesmos dias.
6. **Aparelho, país, inscritos** (três cartões): uma cor só ("seu canal", laranja do lado O), porque aqui o que muda é o comprimento da barra, não o significado. Aparelho tem ícone por tipo, país tem a sigla de duas letras, inscritos tem duas fatias com símbolos diferentes.
7. **"O que ainda não é medido"** encolhe: sai a linha de origem do tráfego, fica a curva de retenção.

## Cor e símbolo (decisões)

| Significado | Cor (token existente) | Símbolo | Textura |
|---|---|---|---|
| Pesquisa do YouTube | `--tier-mid` | lupa | lisa |
| Vídeos sugeridos | `--tier-high` | losango | lisa |
| Início e inscrições | `--tier-top` | casa | lisa |
| Feed de Shorts | `--lado-n` | raio | lisa |
| Sites e apps externos | `--lado-b` | seta que sai da caixa | pontilhada |
| Outras origens | `--dim` sobre `--surface-2` | três pontos | listrada na vertical |
| Omitido pelo YouTube | contorno `--muted`, sem fundo | olho riscado | tracejado |
| Zero medido | borda `--im-zero` | o 0 dentro | caixa vazada |
| Não medido | `--nm` | hachura 135 graus | hachura |
| Ainda não existe | contorno pontilhado `--dim` | relógio | pontilhado |
| Dado que você não vê | `--sunk` com contorno | cadeado | liso |
| Qualquer medida do próprio canal (aparelho, país, inscritos) | `--lado-o` | por categoria | lisa |

Nenhum matiz novo. Verde e âmbar de direção não aparecem (a tela não mostra direção). A mesma origem tem a mesma cor, símbolo e posição na barra, na lista, nas impressões e no cartão da comparação. A ordem das fatias é fixa (pesquisa, sugeridos, início, Shorts, externos, outras, omitido) para que a posição também ajude.

Risco declarado: no tema claro `--tier-mid` e `--lado-b` ficam parecidos; por isso o externo é pontilhado e as duas fatias nunca ficam lado a lado.

## Tipografia e layout

Inter para texto, JetBrains Mono para números e siglas, Fraunces só no título da página (já vem do cabeçalho aprovado). Texto de 12 px ou mais. Cartões `.sec` do lote A4, raio 8, sem sombra. Grade de 3 cartões a 1440, 1 coluna abaixo de 900. A 390 px a lista vira linhas de duas colunas e a régua de cobertura ocupa a largura toda.

## Estados (todos pedidos no seletor do topo)

Com dado típico; com dado extremo (canal, 2015 a hoje, números enormes, textos longos); magro (36 views em 90 dias); zero medido; não medido (antes da primeira coleta, com motivo e data por bloco); sem dado (vídeo de ontem); erro; só leitura (duas variantes: sem termos e sites, ou só o total). País por dia ou por mês. 1440 escuro e 390 claro.

## Conferência do plano contra o pedido (o que mudou ao revisar)

- O primeiro rascunho dava a cada bloco (aparelho, país) a paleta das origens. Cortado: a mesma cor para dois significados quebra "cor estável por significado". Só a origem usa a paleta de origem.
- O primeiro rascunho tinha uma barra por linha da lista, repetindo a barra empilhada. Cortado: a lista só dá o número exato.
- O primeiro rascunho tinha "omitido" com a hachura rosa. Cortado: a hachura é "dado não chegou"; omitido é quantidade conhecida.
- O percentual precisa dizer sobre quê. Entrou a régua de cobertura e o prefixo "Nos N dias medidos" na frase quando a cobertura é parcial. Sem isso, "42%" sobre 8 de 28 dias parece 42% do mês.
