# Referências e Inscritos (A5, 2ª leva da E5a) - notas do mockup, v2

Abrir `index.html`. Parâmetros: `?estado=cheio|magro|vazio|carregando|lento|erro|parcial|antigo|restrito`, `?tema=claro`, `?ordr=mediana|faixa`, `?ordi=pct|abs`, `?aba=ref|ins` (celular). Dado 100% sintético (nomes inventados). `a4.css` é cópia da tela 16; `ri.css`/`ri.js` são novos, sem `color-mix()`, sem matiz novo.
Verificado em Chromium headless (Playwright) a 1440, 1101, 901 e 390, escuro e claro: sem rolagem horizontal, sem erro de console. Capturas em `shots/v2-*.png`; v3 (consertos M1-M4 do Logan e 1-3 da Naksu) em `shots/v3-*.png`. Não verificado: Opera, leitor de tela, aparelho real.

## Pontos provisórios (calibrar antes do código)
- **Cortes da faixa: 2 e 6** (razão p75/p25: até 2× estreita, até 6× média, acima larga). **Calibrar por terços com os canais reais** do Observatório (consulta do Phil).
- **Mínimo de vídeos: 5** para mediana + faixa, 3 a 4 mediana provisória, 0 a 2 sem mediana. Regra de leitura estatística, não medida do projeto.
- **Arredondamento da API:** `subscriberCount` com 3 algarismos significativos a partir de 1.000. Passo = 10^(⌊log10 n⌋−2). Ganho "medido" só se |ganho| ≥ 2× o passo do maior valor; contagem exata (<1.000) mede qualquer ganho, e zero vira "sem variação". Phil confirma na documentação.
- **M1: excluir, Phil confirma no portão do código.** Vídeos com menos de 7 dias ficam de fora da mediana e da contagem mínima de 5 (ⓘ: "…ficam de fora, porque ainda estão ganhando views.").

## Achado -> como resolvido
Logan
- B1 grade quebrada em 1440: `#app{display:block}` em `ri.css`; `.ri` 1100 px, régua 508 px (1440 e 1101), 369 (901), 214 (390).
- B2 "igual" ao lado de +N / "0" medido: derrubado o 0,5%; "sem variação" só com contagem exata e ganho 0; resto "sem medida · dentro do arredondamento (±passo)" sem número de ganho.
- B3 regra errada: ⓘ reescrito (3 algarismos desde mil, ganho >= 2x o passo); dado sintético refeito com 3 algarismos e recalculado.
- C1 escala: rótulos nas posições reais (`pos()`: 2,9 / 32,3 / 61,7 / 91,1 %), só sobre a coluna da régua, 4 ticks em cada linha, cabeçalho sticky.
- C2 frase de Referências: sem "mediana" nem "irregular"; "vídeo típico", "Seu canal está em 7º", "faixa larga".
- C3/D1 rótulos: faixa estreita / média / larga + razão (3×) na linha; cortes 2 e 6 provisórios; ordenação "Faixa mais estreita".
- C4 nome único: "sem medida" no resumo, legenda, pílula e as duas seções; motivo curto na pílula ("menos de 28 dias", "contagem oculta", "dentro do arredondamento", "poucos vídeos (n)", "sem vídeos em 90 dias", "ainda não coletado").
- C5/D5 estados: carregando, carregando lento (aviso + Tentar de novo), erro por seção (Referências falha, Inscritos segue), parcial (faixa + linhas "falhou"), dado antigo/conexão caída, restrito. Sem estado só-leitura.
- C6 continuidade: ordem e aba na URL (`ordr`, `ordi`, `aba`; aba também em localStorage com try/catch); só a lista é refeita, o foco fica no botão; ⓘ é popover nativo, Esc fecha e devolve o foco ao ⓘ (testado); anúncio `aria-live` da ordenação.
- C7 % cortada: sem texto dentro da barra; "▲ +2,2%" na coluna de valor, ganho absoluto e total abaixo.
- C8 celular: abas "Referências | Inscritos" fixas no topo, 10 primeiras linhas + "seu canal" fixado + "Ver todos os N".
- S1 frase de Inscritos traz os dois líderes (% e número) e o seu canal. S2 barra segue o critério ordenado (legenda diz qual). S3 legenda "Fora da ordem, no fim da lista". S4 anotado acima.
- D2 "igual": ver B2. D3: ver B3. D4: regra 5 / 3 a 4 / 0 a 2 (Guia Nenhum e Primeira Viagem provisórios; Estreia Recente com 2 vídeos sem medida).
Naksu
- 1 grade: ver B1. 2 escala: ver C1. 3 % cortada: ver C7 (0 barras com texto cortado).
- 4 "poucos vídeos" com opacity .55: sem opacity, marca vazada com contorno 2 px `--mk` cheio (4,43:1 claro, 6,80:1 escuro) e trilho tracejado.
- 5 reuso: removidas as redefinições de `.btn`, `.res`, `.pop2`, h1/h2; usa `.btn`, `.sec`, `.lead`, `.pop` (popover), `.ibtn`, `.chip`, `.ex`, `.nm-h`, `.ch-shell` da tela 16; um único cartão `.sec` (sem `.res`/lista com borda aninhada); classes novas com prefixo `ri-`/`reg`/`dv`.
- 6 "não medido" com duas linguagens: tudo é `.pill.nm2` (hachura rosa), inclusive "ainda não coletado"; some a faixa rosa de 518 px. Mediana provisória não é "sem medida": pílula tracejada cinza.
- 7 moldura: só `.ch-shell` "Canais" e o menu fica fora do mockup (esqueleto de carregamento com altura de linha parecida). 8 densidade: no celular régua e valor na mesma linha; unidade única "mil" na lista (1.180 mil), prosa em "mi".

## v3 (re-revisão)
Logan M1 (7 dias: excluir, ver acima), M2 (acima de 999 mil a lista escreve "1,42 mi"), M3 (dado antigo: "Sem conexão." só com `navigator.onLine===false`), M4 (contagens zeradas omitidas; parcial: "N canais carregados (3 não carregaram)"). Naksu 1 (abas e `--stk` a 44/56 px), 2 (glifo da faixa a 15 px).
- Naksu 3, divergência herdada da tela 16: botões de ordenar a 34 px no desktop, abaixo da meta de 44 px; fica igual à tela 16.
