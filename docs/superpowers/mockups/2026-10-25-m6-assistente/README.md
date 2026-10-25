# Mockup M6 r1: assistente "Novo teste A/B" (3 passos) e carregamento da tela do teste, 25/10/2026

`index.html` (um arquivo, dados e miniaturas sintéticos). Seletor: `?estado=&tema=claro|escuro&largura=1440|390|ambas` (também botões no topo). Base: `.superpowers/sdd/ab-lab/assistente-r1/logan.md` e `naksu.md` (R1 deles, sobre `origin/main d4c26f2b1`). Verificação: `node verifica.mjs` (Playwright headless; 39 capturas em `shots/`, 0 falhas).

## Estados (21)
- Seletor: `seletor`, `seletor-dado-ruim`.
- Tipo: `tipo`, `tipo-criando`, `tipo-erro`, `tipo-ja-existe`.
- Variantes: `variantes-titulo`, `variantes-thumbnail`, `variantes-combo`.
- Revisar: `revisar-titulo-lendo`, `revisar-titulo`, `revisar-titulo-sem-aviso`, `revisar-thumbnail`, `revisar-combo`, `revisar-combo-sem-imagem`, `revisar-ativando`, `revisar-salvando`, `revisar-erro`.
- Tela do teste: `teste-carregando`, `teste-carregando-frio`, `teste-carregando-demora`.
Capturas completas (1440 e 390, claro e escuro): `seletor`, `tipo-criando`, `variantes-titulo`, `revisar-titulo`, `revisar-ativando`, `teste-carregando`; os demais, 390 claro.

## Como testar
1. `seletor`: as duas linhas "Main AD Diamante 2 - Lolzin raiz!" se distinguem em 3 s pela data e hora de publicação (e pela duração e visualizações). Os mais recentes vêm primeiro; a linha com teste ativo segue desabilitada, agora em âmbar legível.
2. `seletor-dado-ruim`: título de 100+ caracteres em 2 linhas, sem miniatura ("Sem thumb"), sem data ("Data de publicação não informada"), sem visualizações (a linha some; "0 visualizações" real aparece), sem duração (some).
3. `tipo-criando`: nada cobre a tela. Só o cartão clicado muda (marcado, spinner, "Criando rascunho…"); os outros dois e "Cancelar" ficam travados; o rodapé troca "Passo 1 de 3" por "Criando o rascunho…". `tipo-erro` e `tipo-ja-existe`: mensagem em português abaixo dos cartões, com a saída ("Tentar de novo" / "Abrir rascunho").
4. Variantes: o trilho tem 3 passos (Tipo, Variantes, Revisar); sem Ideias e sem Config. "Pedir ideias a uma IA" é um link sob o título. Texto todo em português ("Desafiante", "Título da variante B…"). O contador "86/100 caracteres" só aparece perto do limite (`variantes-combo`).
5. `revisar-titulo`: banner neutro "Pronto para ativar, com um aviso abaixo."; regra numa linha com ⓘ; cartão do aviso de volume (selo âmbar + ícone + texto com inicial maiúscula); depois o "momento de clique". Os dois cartões mostram a MESMA miniatura e o título de cada variante (B mostra o título digitado).
6. `revisar-thumbnail`: miniaturas diferentes, mesmo título. `revisar-combo`: os dois mudam. `revisar-combo-sem-imagem`: B sem imagem vira cartão tracejado "Sem thumbnail", nunca arte inventada. Troque Home, Busca, Sugeridos e Mobile na prévia.
7. `revisar-titulo-lendo` (esqueleto reservando o lugar do aviso) e `revisar-titulo` (aviso pronto): a altura é a mesma, a página não pula. `revisar-titulo-sem-aviso`: "Tudo pronto." e nenhum aviso. `revisar-thumbnail`: variante "Decide mais tarde" (selo neutro tracejado).
8. `revisar-ativando`: só "Ativar teste" vira "Ativando…" (spinner); "Salvar rascunho" e "Voltar" ficam travados com o rótulo normal; X travado; o aviso de volume continua visível; `.etd-msg.busy` abaixo do conteúdo diz o que acontece e quanto leva. `revisar-salvando` é o espelho. `revisar-erro`: "O rascunho ficou salvo" e o botão vira "Tentar de novo".
9. `teste-carregando`: título e miniatura da linha clicada já aparecem; no lugar do bloco escuro de 105 px com frase miúda há uma mensagem `.etd-msg.busy` e nada mais. `-frio` (sem título conhecido): traços de esqueleto visíveis (>= 1,4:1). `-demora`: depois de 8 s a mensagem vira "Está demorando" com "Tentar de novo".
10. Clique no ⓘ da regra: popover do produto (`InfoDica`), não muda a altura da página, Esc fecha.

## Escolhas onde Logan e Naksu divergem (cada um com o opositor no próprio texto)
| Ponto | Logan | Naksu | Escolhido e motivo |
|---|---|---|---|
| Ideias de IA no Variantes | link "Pedir ideias a uma IA" que abre `PerguntarIa` | botão "Pedir ideias ao Cowork" + ⓘ + painel de hipótese | Logan, como o brief manda (link). Sem painel de hipótese (a hipótese hoje não é gravada em lugar nenhum, Naksu C2). O diálogo `PerguntarIa` não foi desenhado: reaproveita o componente existente. |
| Config no Revisar | linha de fato sob o banner, com ⓘ | tudo dentro do banner | Logan: o brief pede "a regra numa linha"; o banner fica com o resumo ("2 variantes de título"). O texto do ⓘ ("Por que 15 dias") é dele. |
| Aviso de volume | selo "Pouco volume" | selo "Volume insuficiente"; `so_decide_depois` neutro tracejado | Naksu (mediu contraste e cobriu os 3 estados). |
| Banner com aviso | título neutro, ícone neutro | banner âmbar | Logan, reusando a frase que o produto já tem (`tituloDoBanner`: "Pronto para ativar, com um aviso abaixo."). Âmbar no banner e no cartão seria alarme duplo. |
| Esqueleto do teste | só 3 peças, sem faixa, linhas ou 14 dias | manter a forma, texto fora do bloco, cabeçalho real | Logan na forma (esqueleto não desenha o que só existe depois de dias) e Naksu no cabeçalho real, no contraste e no `role="status"` fora de bloco. O brief pede copiar `.etd-msg.busy` e `FichaEsqueleto`. |
| Erro do tipo | rodapé / `.etd-msg err` | `.etd-msg err` em `role=alert` | Mensagem no corpo, abaixo dos cartões, com a ação ao lado; o rodapé fica só para "Passo N de 3" ou a espera. |
| Prévia: modos | tirar "No feed", resto num seletor | (não tratou) | Tirei "Comparar/No feed" e a faixa de minicards (F13/F14). Mantive os 4 pills Home/Busca/Sugeridos/Mobile do produto (padrão existente antes de padrão novo). |

## Padrões copiados (origin/main d4c26f2b1)
Diálogo, trilho, rodapé, botões: `ab-create-wizard.tsx`. Seletor: `video-picker-dialog.tsx`. Tipo, variantes: `step-tipo.tsx`, `step-variantes.tsx`. Revisar: `step-revisar.tsx` (banner, `AvisoResolucao` como irmão do aviso de volume, esqueleto de linha `h-5 w-3/5`), `click-moment.tsx` (cartões Home, Busca, Sugeridos, Mobile). Espera: `.etd-msg.busy`/`.err` e `ICONE_BUSY`/`ICONE_ERRO` de `ab-end-test-dialog.css/.tsx`. Tela do teste: `FichaEsqueleto`, `placar-esqueleto.css`. ⓘ e popover: `InfoDica`/`Popover` (código do M5 r5). Tokens: `--cms-*` de `globals.css`, `--cn-*` de `caminho-nativo.css`.

## Diferenças em relação ao produto (para o plano)
- Dado: `EligibleVideo` precisa de `publishedAt` e `viewCount` (query `queries.ts:318-324`); a linha vira componente único para `video-picker-dialog.tsx` e `new/client.tsx`. `@handle` fora da linha (igual em todo o canal); data com hora (`21 out 2026, 18:32`) porque dois vídeos do mesmo dia só se distinguem por ela.
- `ClickMoment`: `title` por variante, miniatura da original no teste de título, título original no de thumbnail; sem `OVERLAY_TEXT`, `12:48` fixo, "12 mil visualizações", "TF". O mockup mostra a duração e a data reais do vídeo (já conhecidas); visualizações ficam de fora (mudam, e a prévia é do que o espectador vê, não do desempenho). Cartão ganhou uma linha com `VChip` + "Original"/"Variante B" porque a faixa de minicards saiu.
- As variáveis `--etd-*` hoje só existem em `.etd`; o assistente e a tela do teste precisam delas (declarar também no contêiner do assistente ou subir para `:root`).
- Contrastes que o produto reprova e o mockup já corrige: texto secundário (`--cms-text-dim`) no rodapé do claro (4,26:1) usa `--cms-text-muted`; número do passo futuro (4,02:1); `VChip` com letra branca em #8A8F98 (3,25:1) e #E8823C (2,73:1) usa #1A120A; pill "Home" ativa usa texto `--cms-text`; "Teste ativo" usa `--cms-amber-text`; esqueleto `--cn-skel` (1,23:1) sobe para #3B342C / #D6CBB6 (>= 1,4:1, afeta lista e ficha também).
- Alvos de 44 px: X, botões do rodapé, "remover variante", pills, linhas. Fonte mínima 12 px (o produto tem 10, 10,5 e 11 px).
- Texto de `NOTA_ATIVAR` muda: "As variantes começam a alternar depois que o teste for ativado no YouTube" (a troca não é instantânea; Logan F16).

## Não verificado
- Leitor de tela, Opera, aparelho real, teclado fora de ⓘ; foco inicial e foco preso nos diálogos (o mockup não os implementa; o produto já tem).
- Texto do ⓘ sobre ABBA ("A, B, B, A") e "mínimo 12 e máximo 15 dias" é proposta; confirmar com Yannis. `burn_in_days` continua no `config` com o padrão do site (Logan/Naksu pedem confirmação de Yannis de que a regra v2 não o lê).
- Espera real da criação do rascunho e do carregamento (não medidas); Logan deixa a criação em segundo plano como alternativa só se passar de 2 s.
- Não coberto: recusa da guarda do teste do YouTube no rodapé, `AvisoResolucao` da original (continua como está, no mesmo lugar), diálogo "Pedir ideias a uma IA", `ab-lab/loading.tsx` da lista (Logan e Naksu anotam; fora desta rodada), conexão que cai no meio da ativação além da mensagem de `revisar-erro`.
- Miniaturas são gradientes sintéticos (o mockup não tem imagem real); a regra "thumb real" vale no código.
