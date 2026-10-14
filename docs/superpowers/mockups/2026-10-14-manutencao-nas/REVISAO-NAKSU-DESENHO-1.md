# Revisão Naksu (UI), desenho 1: "Remover canal" e 18-v2 (M4)

Método: Playwright/Chromium sobre `file://`, 1440 e 390 px, claro e escuro. Remover canal: D0 a D9 (+ D5+D8), R1 a R3, 3 combinações em D3 e D6, nome de 100 caracteres, D7 "só edita", casa fora (≈110 páginas). 18-v2: V0 a V12n nos dois temas (46 páginas). Contraste calculado do DOM (transparências resolvidas contra o fundo real), alvos, fonte, rolagem horizontal. Capturas: `revisao-naksu-shots/` (390 de todos os estados, 1440 de amostra). Não verificado: Opera de verdade, leitor de tela, aparelho real, rede lenta (as fontes vêm do Google Fonts; sem rede cai em system-ui).

## Resumo
- Remover canal: **ACORDO COM CONDIÇÕES** (1 corrige, 2 sugestões).
- 18-v2: **ACORDO COM CONDIÇÕES** (3 corrige, 1 sugestão).
- Medido limpo nos dois: `color-mix()` = 0 ocorrências em rc.css/rc.js/bl2.css/bl2.js (bl.css só cita a palavra em comentário); rolagem horizontal 0 em 390 e 1440 (scrollWidth = largura); texto < 12 px = 0; alvos < 44 px a 390 = 0 (botões, ⓘ, chips, portas); foco visível `2px solid var(--accent)`; `prefers-reduced-motion` respeitado; tokens iguais aos aprovados (nenhum valor de cor novo); "sem dado" nunca como zero em D5/D58/V1n/V10 (hachura rosa + texto); D1/D2 mostram "0" como zero medido, com a caixa de zero medido (correto).

## 1. Remover canal

### Achados
**RC-1 (corrige). D4a/D4b/D4c a 390 px: o campo do nome fica fora da tela e o botão desabilitado fica à vista.**
- Evidência (viewport 390x844): input em y 1026-1070, rodapé de botões em 708-831; corpo rola 654 de 1070 px (61% visível). Com nome de 100 caracteres: input em 1133-1177, corpo 654/1177 (55%). Em 390x667: 477 de 1070 (45%). "Não dá para desfazer" começa em y 731 (23 px abaixo da dobra). Foco inicial está em "Cancelar", então nada rola até o campo. Em 1440x900 o campo (952-992) também está abaixo do rodapé (818).
- Por que importa: o dono vê "Remover e apagar do arquivo" tracejado sem ver o campo que o libera; é o portão da ação irreversível.
- Correção: ao abrir D4*, depois de focar "Cancelar", `document.getElementById('rcIn').scrollIntoView({block:'nearest'})` no corpo `.rc-body`; ou, a 390 px (`@media (max-width:820px)`), mover o bloco `.rc-d4` para logo depois da lista de perdas (antes de "O que acontece:"). A primeira opção não muda a ordem aprovada pelo Logan; sugiro a primeira. Se o corpo rolar, acrescentar `.rc-body{background:linear-gradient(var(--surface) 30%,transparent) top,linear-gradient(transparent,var(--surface) 70%) bottom}` não é necessário; basta o corte da última linha, que já sinaliza rolagem.

**RC-2 (sugestão). D3 a 390 px: "Não dá para desfazer" fica 23 px abaixo da dobra** (731-773 contra rodapé em 708), com o botão vermelho já visível. O corte da lista indica rolagem, mas o aviso vem depois do botão de perigo. Correção: a 390 px, subir a frase "Não dá para desfazer" para logo depois da lista de perdas e antes de "O que acontece:" (frase curta, mesma redação), ou aceitar e registrar no roteiro do dono.

**RC-3 (sugestão). Título de 100 caracteres a 390 px ocupa 4 linhas (≈100 px) e empurra tudo.** Funciona, não quebra o layout (sem overflow). Correção: `.rc-body h2{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}` com o nome completo já presente na caixa `#rcNome` do D4 (e `title`). Em D3 o nome completo não aparece em outro lugar: só aplicar o clamp se o D4 existir; senão manter como está.

### Tabela de medidas (remover canal)
| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Texto menor contraste, escuro/claro (todos os estados) | nenhum par < 4,5:1 detectado | 4,5:1 | passa |
| Texto sobre hachura rosa (D5, nome `--nm`): claro | #8E2A62 sobre #F7E1EC = 6,37:1; sobre a listra (#ECCADC aprox.) = 5,47:1 | 4,5:1 | passa |
| Idem, escuro | #E59CC0 sobre #3A2232 = 6,77:1; sobre a listra = 5,13:1 | 4,5:1 | passa |
| Alvos a 390 px (botões do rodapé, "Tentar de novo", ⓘ, link, input, "Entendi") | todos ≥ 44 px | 44 | passa |
| Caixa a 390x844 | 366 px de largura, 779 px de altura, rodapé 708-831 sempre à vista | | passa |
| D7 / D9 / D7r a 390 | caixa 281 / 267 / 323 px, botões 44 px | | passa |
| Toast R3 | `role="status"`, persistente, botão "Entendi" ≥ 44 px, cobre ≈200 px do rodapé a 390 | | passa |
| Disabled (D4): `aria-disabled` + tracejado + texto, não só cor | borda tracejada + status em texto | | passa |
| Fonte mínima | 12 px | 12 | passa |
| Valores soltos | nenhum hex fora dos tokens copiados | | passa |

Veredito: **ACORDO COM CONDIÇÕES**, condição = RC-1. RC-2 e RC-3 vão ao dono declarados.

## 2. 18-v2

### Achados
**V2-1 (corrige). 390 px: o rótulo "chega a N% antes da próxima saída" colapsa numa coluna de 71 px e se sobrepõe à legenda.**
- Tela: V2 (74 px de largura, 96 px de altura, 6 linhas) e V4 (71 px x 96 px, 8 linhas; texto vermelho em cima de "70% a 85%: enchendo" e "acima de 85%…"); V6 (93 px x 64 px). Seletor `.v2-pt.f` (posição absoluta com `translateX(-100%)`: a largura encolhe para o espaço restante à direita do marcador). Captura: `v2-v4-claro-390.png`, `v2-v4-escuro-390.png`, `v2-v2-*-390.png`.
- Por que importa: o texto que o plano chama de obrigatório (C9, "texto visível, não só title") fica ilegível e cobre a legenda.
- Correção: em `@media (max-width:640px)` trocar a regra atual por `.v2-pt{width:max-content;max-width:min(230px,calc(100vw - 48px));white-space:normal}` (mantém `.f{transform:translateX(-100%)}`). Com isso o rótulo ocupa 2 linhas (≈32 px) e `.v2-pk{height:44px}` basta. Conferir de novo V2, V4, V6 a 390.

**V2-2 (corrige). 390 px: o rótulo da régua "novembro pronto em 01/05" sai da tela à esquerda.**
- V2 390: `.v2-l2.c` em left = -1 px (cortado, centrado no traço que está a ≈ 20% da régua), 187 px de largura; V4 390: left = 12 px (dentro do gutter de 16 px). Captura: `v2-v4-claro-390.png` mostra "ovembro pronto".
- Correção: prender o rótulo à régua: em JS, ao posicionar `.v2-l1`/`.v2-l2` com `c`, calcular `left = max(w/2, min(pos, régua - w/2))` ou, só em CSS a ≤ 640 px, `.v2-l1.c,.v2-l2.c{transform:none;left:0!important}` quando a posição for < 30 %; e `.f` quando > 70 %. Garantir `left ≥ 16 px` da página (≥ 0 da régua).

**V2-3 (corrige). Contraste da porta "Abrir o Arquivo", tema claro, V1a e V1b.** `.v2-porta` usa `--accent` #B8481A sobre o fundo âmbar da linha (`--warn-subtle` sobre `--surface` = #F4E7D9): 4,34:1 (medido 4,16:1 pelo script, que ignora a transparência intermediária; as duas ficam abaixo de 4,5:1). Texto de 13,5 px, não é grande. Correção: `.v2-cp.amar .v2-porta,.v2-cp.verm .v2-porta{color:var(--accent-hover)}`: #A23E14 = 5,34:1 sobre o âmbar claro. No escuro `--accent-hover` #FF9A60 já passa (maior que o atual). Conferir a variante vermelha (`--danger-subtle` .08) depois da troca.

**V2-4 (corrige, depende do Phil). V9: "0 exportações esperando a sua confirmação" aparece com o banco sem leitura hoje.** Em V10 (séries não medidas) o mesmo bloco vira "não medido" porque "as exportações também vêm do banco". Em V9 a leitura das 05:00 também não chegou, e a tela mostra `0`. Se as exportações vêm da mesma leitura, isso é "sem dado" desenhado como zero. Correção: ou V9 usa o estado "não medido" de V10 para Exportações ("A leitura de hoje não chegou: não dá para dizer se alguma espera confirmação"), ou a nota declara que a contagem de exportações é de outra fonte e por isso medida (e o ⓘ diz). Anotado também para o Logan: a regra do que vem do banco precisa ser a mesma nos dois estados.

**V2-5 (sugestão). V2/V4 a 1440 px: a régua deixa o rótulo "novembro pronto em 01/05" colado à linha "hoje / 90 dias"** (rótulos em y 841-859; eixo em 825): legível, mas apertado; já anotado pelo autor para V5. Correção: `.v2-l2{top:78px}` e `.v2-rg{height:104px}`.

### Tabela de medidas (18-v2)
| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Contraste texto, 46 páginas (V0 a V12n x 2 temas) | único abaixo: "Abrir o Arquivo" claro V1a/V1b, 4,34:1 | 4,5:1 | **falha (V2-3)** |
| Rolagem horizontal 390 / 1440 | scrollWidth 390 / 1440 em todas | = viewport | passa |
| Alvos a 390 px | nenhum < 44 px (chips 44, porta 44, ⓘ) | 44 | passa |
| Fonte mínima | 12 px | 12 | passa |
| `.v2-pt` a 390 px (V2/V4/V6) | 74x96, 71x96, 93x64 px | ≥ 150 px de largura | **falha (V2-1)** |
| `.v2-l2.c` V2 a 390 | left -1 px | ≥ 0 | **falha (V2-2)** |
| Forma além da cor: pastilha (triângulo/octógono/hachura), cópia (visto, pontilhado, triângulo, octógono, hachura), faixa (listras sobre o gradiente) | presente em todos os estados | | passa |
| Cor sem `color-mix` | 0 em bl2.css/bl2.js | | passa |
| "Sem dado" como zero | V1n, V9 (barra e números), V10: hachura/"não medido"; exceção V9 Exportações | | falha só em V2-4 |
| Selo de ajuste e 18 aprovado | arquivos do 18 inalterados; `index.html` abre igual (por declaração do autor, não diffei) | | não verificado |

Veredito: **ACORDO COM CONDIÇÕES**, condições V2-1 a V2-4. Após correção, repetir a medição de V2, V4, V6 a 390 px (nova rodada rápida, só essas telas).
