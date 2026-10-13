# Revisão de UX, rodada 3: mockup 17a, Comparar canais com as medidas novas (13/10/2026)

Revisor: `revisor-ux-senior`. Escopo da rodada: conferir se os 3 bloqueios da r2 foram resolvidos e se o conserto criou defeito novo. Material: PLANO.md, NOTAS.md (seção 6), REVISAO-UX-r2.md, index.html, ce.css, ce.js, ce-dados.js, CONVENCOES.md e o spec (04, linhas 13, 15, 16, 19, 20, 80, 158, 241, 242). Medi no navegador (Chromium headless, servidor estático meu nas portas 47771 a 47773, derrubado ao fim; não toquei na 3099 nem rodei specs do projeto): 13 estados x 4 cruzamentos (1440 e 390, escuro e claro) = 52 páginas, mais Tab e ⓘ em 5 páginas. Gerei as capturas eu mesmo (as do autor não foram a base) e olhei: `erro` 390 claro e 1440 escuro, `zero` 390 claro e 1440 escuro, `tipico` 390 claro e 1440 escuro (também em escala de cinza), `2027` 390 claro, `queda` 390 claro, `magro` 1440 escuro e 390 claro, `fora` 1440 escuro, `extremo` 390 escuro, `proprio` 1440 escuro e claro, `leitura` 1440 escuro, `vazio` 1440 escuro. Nada foi alterado fora desta pasta; gravei em `shots/` 5 arquivos com prefixo `r3-`.

## Resumo

**Pergunta do dono:** "cada canal está subindo ou descendo, e o que eu ainda não posso afirmar?" Segue respondida de relance: a Leitura rápida (uma frase por lado, ▲ ▼ ＝ ou ○ de "sem direção medida") está a 436 px do topo a 1440 e a 648 px a 390 (dentro da primeira tela de 844 px; a segunda frase termina em ~810 px).

**Veredito do mockup: PODE IR AO DONO. Zero bloqueios.** Os 3 bloqueios da r2 estão resolvidos, o conserto não criou defeito novo que o dono vá ver, e as medidas passam em 52 páginas. Restam 3 melhorias de acabamento, nenhuma impede.

| Veredito por estado | 1440 escuro | 390 claro |
|---|---|---|
| tipico | pronto | pronto |
| proprio | pronto | pronto |
| extremo | pronto | pronto |
| zero | pronto | pronto |
| naomedido | pronto | pronto |
| magro | pronto | pronto |
| fora | pronto | pronto |
| nichos | pronto | pronto |
| queda | pronto | pronto |
| 2027 | pronto | pronto |
| erro | pronto | pronto |
| vazio | pronto | pronto |
| leitura (só leitura) | pronto | pronto |

1440 claro e 390 escuro: mesmos números (contraste, rolagem, alvos), sem defeito novo; olhei `proprio` em 1440 claro e `extremo` em 390 escuro.

## Conferência da r2 (cada bloqueio)

| r2 | Pedido | Resultado na r3 |
|---|---|---|
| 1. `erro` dava inscritos do lado que não carregou | Cartão do lado com erro só com nome e pastilha; 3ª frase da Leitura rápida sem "6,1×" | **Resolvido.** `shots/r3-evidencia-erro-390-claro.png`: cartão de Nômade Raiz = iniciais, nome e pastilha "não carregou" (sem inscritos, sem "50 longos", sem nicho). A 3ª linha da Leitura rápida diz "Tamanho: sem comparação, os inscritos de Nômade Raiz não carregaram." com o símbolo de erro. A tabela diz "não carregou" em todas as células de B. Cartão, frase e tabela agora dizem a mesma coisa. A 1440 igual. |
| 2. `zero`: "parado há 61 dias" x "0 longos em 90 dias" | Dale Philip com mais de 90 dias | **Resolvido.** `shots/r3-evidencia-zero-390-claro.png`: "há 95 dias sem longo novo" no cartão; "0 longos contra 8" (caixa vazada com 0) e "0 longos nos últimos 90 dias; precisa de 3" (não medido, hachura) na tabela. Os números fecham; zero medido e não medido continuam lado a lado e distintos. |
| 3. Apoio invade a pastilha a 390 | Folga entre a pastilha e a linha de apoio | **Resolvido.** Medi nos 13 estados, nos dois cartões: pastilha termina em 439,3 e o apoio começa em 445,3 (folga de 6,0 px; `queda`: 457,3 e 463,3, também 6,0). Antes: -4 px. Sem sobreposição em nenhum cartão. |
| Melhoria 1 | Segunda frase da Leitura rápida na primeira tela | Feito: título a 648 px (r2: 666). Olhei a 390: as duas frases e a de contexto cabem em ~810 px em `tipico`. |
| Melhoria 3 e 4 | Faixa do magro em uma linha; "subindo)" órfão do 2027 | Feitos: faixa "Nada fechou ainda" na largura da tabela; o 2027 agora fecha "(canal inteiro: estável; vídeos novos de hoje: subindo)" sem palavra órfã (capturado a 390). |

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam)

1. **O ⓘ do rótulo da linha principal cai sozinho numa linha.** A 1440, em todo estado com "Canal inteiro": o chip "◆ leitura principal" e "Canal inteiro" ocupam a linha de cima e o ⓘ vai sozinho para a de baixo, à esquerda, sem texto ao lado (`shots/r3-melhoria-info-orfao-1440-escuro.png`). A 390, só no `2027` ("Vídeos novos, mesma idade" é mais comprido): o ⓘ fica órfão acima da descrição (`shots/r3-melhoria-info-orfao-2027-390-claro.png`). Funciona e o alvo é 44 x 44 a 390, mas parece sobra de layout. Conserto: o ⓘ vai dentro do mesmo `span` do título com `white-space: nowrap` no par "título + ⓘ", ou a etiqueta "leitura principal" desce para a linha de apoio.
2. **Tema claro: lado A e "descendo" quase da mesma cor** (`--lado-n` #5C4710 e `--dir-dn` #8A5A00; a r2 mediu ~1,4:1 entre eles). A forma (letra x quadrado ▼) distingue; vem do lote 1 aprovado. É a dúvida 10 do NOTAS: decisão do dono, não minha.
3. **`erro` a 390: a Leitura rápida começa a 810 px** porque o aviso de erro vem antes. Está certo (o erro é a notícia principal e o autor registrou o motivo); só observo que, nesse estado, o dono precisa rolar meio cartão para ver as frases. Nenhuma ação.

## Medidas (r3, 52 páginas)

| Medida | Valor | Meta | Resultado |
|---|---|---|---|
| Rolagem horizontal, 13 estados x 4 cruzamentos | 0 px em todas | 0 | passa |
| Texto menor que 12 px | 0 | 0 | passa |
| Alvos menores que 44 px a 390 (ponteiro grosso, só a tela, sem a barra do mockup) | 0 | 0 | passa |
| Menor contraste de texto, escuro (todos os estados) | 4,86:1 (símbolo "■" de contexto, 12 px); 4,93 em `erro`; 5,90 em `vazio` | 4,5:1 | passa |
| Menor contraste de texto, claro (todos os estados) | 4,73:1 (chip "B" e "Competidores") | 4,5:1 | passa |
| Texto abaixo do limite (4,5 normal, 3 grande), todos os nós de texto | 0 | 0 | passa |
| Folga pastilha x apoio a 390 | 6,0 px nos 2 cartões de 13 estados (r2: -4 px) | maior que 0 | passa |
| Foco por Tab (`erro` e `vazio` 1440 escuro, `tipico` 1440 escuro, `zero` e `leitura` 390 claro): paradas sem contorno visível | 0 de 65, 56, 66, 64, 65 | 0 | passa |
| Ordem de foco em `erro` (1440 escuro) | segue a ordem visual (cartão A, "Tentar de novo", tabela, ⓘ do 1º ao último); o ciclo volta à barra do mockup | sequencial | passa |
| ⓘ: Enter abre, Esc fecha, foco volta ao botão; popover dentro da tela (1440: 120 a 500 px; 390: 12 a 378 px de 390) | funciona nas 5 páginas; `role="note"` com `aria-label` | funciona | passa |
| Paradas de foco fora da largura da tela | 0 | 0 | passa |
| Controles sem nome acessível, `svg` sem `aria-hidden` ou papel | 0 em 52 páginas | 0 | passa |
| `h1` por página | 1 | 1 | passa |
| `color-mix()` fora de comentário (css e js da pasta) | 0 (as ocorrências são comentários "sem color-mix") | 0 | passa |
| Erros de página no console (exceto fontes externas bloqueadas por mim) | 0 | 0 | passa |
| Título da Leitura rápida, 1440 / 390 (`tipico`) | 436 / 648 px (r2: 436 / 666) | 390 dentro de ~730 px | passa |
| Escala de cinza (`tipico` 1440 escuro) | ▲, ▼, ■ de contexto, A e B se distinguem por forma e letra; a hachura de "não medido" e o contorno pontilhado de "ainda não existe" mantêm forma própria | legível | passa |

Os números completos estão em `shots/r3-medidas.json`.

## Conferência das cobranças do dono (todas as telas)

- Frase-resumo no topo: sim, em todos os estados com dado (Leitura rápida, uma linha por lado, símbolo, número em destaque; `vazio` não tem dado, mostra esqueleto).
- Régua ou barra: régua do nicho (direção, medianas, tamanho), barras pareadas dos primeiros dias, casas de acerto.
- Cor estável: ▲ verde, ▼ âmbar, ＝ neutro, hachura rosa = não medido, caixa vazada com 0 = zero medido, pontilhado = ainda não existe, família do erro só em erro e fora do ar; lados A e B sem significado de direção.
- Símbolo junto da cor, lendo em escala de cinza: sim.
- Método no ⓘ, sem prosa: 9 popovers; a tela só tem frases curtas (a faixa do `magro` é de uma linha).
- Zero medido x não medido distintos e lado a lado em `zero`: sim ("0 longos contra 8" x "não medido: 0 longos nos últimos 90 dias; precisa de 3").
- Jargão: nenhum na tela nos 13 estados (termos técnicos só dentro dos ⓘ).
- Erro, vazio, magro, fora do ar, só leitura, zero, nichos, extremo, 2027, queda: todos desenhados.
- 390 px sem rolagem horizontal, alvos de 44 x 44, tema escuro e claro, `color-mix()` ausente, foco visível: medidos acima.
- Consistência com o lote 1: mesmos tokens, mesma pastilha, mesmo cartão "Só o seu canal mede" (aprovado, igual ao mockup 9), mesma tabela que vira cartões a 390.
- Spec: M3 em três leituras (a principal; b e c de apoio; c principal em 2027), M4 em casas, M7 aos 30 dias com os chips, M8 no cartão (Ativo, Parado, Em queda, Fora do ar, "não carregou"), M1 N=1 (primeiras 24 horas), 6.2 e 6.5b, itens 241 e 242 (um símbolo por percentual) e o exemplo "praticamente iguais" de 8.1.5 (com ⓘ que diz que a contagem não mede frequência): todos presentes.

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): árvore de títulos e ordem de leitura só pelo HTML e por Tab.
- Safari, Opera e Firefox: só Chromium headless (o navegador do dono renderiza `color-mix()` transparente; aqui não há uso, mas outros recursos de CSS não foram conferidos lá).
- Ordem de Tab completa em todos os 13 estados: testei 5 páginas; `erro` com a lista nominal.
- Contraste do texto sobre a hachura medido pelo token (cor contra o fundo sólido do ancestral), não por amostra de pixel.
- Movimento reduzido: não vi animação na tela; não testei a mídia.
- Capturas do autor em 1440 claro e 390 escuro não existem em `shots/` (a convenção pede 1440 escuro e 390 claro); medi esses cruzamentos e olhei dois deles.
