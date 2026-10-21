# Mockup: original em alta resolução no A/B Lab (M1, 21/10, por cima da r4)

Abrir: `open -a Opera index.html` e ir à seção **M1 (atual)**, no topo. Seletor de estado, tema e largura do quadro (1440 ou 390); a URL também aceita `?estado=baixa|baixa-sem|nao-medida|indisponivel|alta&tema=dark|light&largura=1440|390`. As seções A a H (envio da original) ficam como referência: foram congeladas pela D12 e a página diz isso no topo.

## O que mudou no M1 (r2, 21/10, pareceres de Logan e Naksu)
- Tela nova: o passo **Revisar** do assistente (modal de 900 px, trilho, banner verde, grade, nota, rodapé). Sem envio de arquivo. Aviso logo abaixo do banner, antes da grade; nunca bloqueia.
- Estados: 1 baixa medida; 1b baixa sem número; 2 não medida; 3 leitura falhou; 4 referência em alta; **5 lendo (novo)**.
- **B1** saída dos estados 1/1b: "Para evitar, troque no YouTube a thumbnail do vídeo por uma de 1280 px ou mais e depois ative: o teste guarda a nova ao ativar, mesmo que este aviso continue aqui. Sem uma maior, pode ativar assim mesmo." DEPENDE de `ab-start.ts` regravar a original também quando a guardada é baixa (dHash igual não regrava hoje): conserto 1 do Logan, a confirmar com o Yannis. Sem ele a frase é falsa.
- **C1** estado 2: "A resolução da original ainda não foi medida; o teste mede ao ativar. Se a thumbnail do vídeo no YouTube tem 1280 px de largura ou mais, pode ativar. Se tem menos, o vídeo voltaria borrado a cada troca: troque-a no YouTube antes de ativar."
- **C2** banner: "Pronto para ativar, com um aviso abaixo." (baixa, não medida); "Pronto para ativar." (leitura falhou e lendo); "Tudo pronto." (só leitura em alta). Nota do rodapé: "Clique em Ativar teste para começar. As variantes passam a rotacionar na hora."
- **C4** estado 1b: "A original guardada está abaixo do mínimo de 1280 px de largura: ..." (não parece mais a medida da original).
- **C5 / Naksu C4** estado "lendo": banner "Pronto para ativar." em cor de texto normal (sem o verde, como pede a Naksu; o texto é o do Logan), esqueleto de 20 px (60% da largura, `--surface3`, raio 4) com `aria-busy="true"` no lugar da faixa, sem animação com `prefers-reduced-motion`. Sem `role="status"`. O hook precisa de 3 estados (`pendente | null | AvisoOriginal`).
- **M1 Logan** estado 3: "Não consegui conferir a resolução da original agora. Isso não impede de ativar."
- **Naksu C1-C3**: verde e âmbar viram tokens por tema (abaixo); selo e faixa em rgba literal, nunca `*-subtle` nem `color-mix()`; o selo **não** usa `Badge tone="amber"`. Resumo do banner passou a `--sub` (M1 da Naksu, 4,30 para 8,00 no escuro).
- **C3 Logan**: a leitura começa em `state.step >= 2` (Variantes é 2; o plano dizia 3). Corrigir plano linhas 478 e 548.
- Sem mudança: recipiente neutro, selo neutro tracejado com interrogação, botões sempre habilitados.

## Tokens novos propostos (`globals.css`)
| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--cms-green-text` | #4ADE80 | #126B35 | palavra do veredito |
| `--cms-green-icon` | #22C55E | #15803D | ícone do banner |
| `--cms-amber-text` | #FBBF24 | #7A4E00 | texto do selo baixa |
| `--cms-amber-soft` | rgba(251,191,36,.12) | rgba(245,158,11,.14) | fundo do selo |
| `--cms-amber-line` | rgba(245,158,11,.5) | rgba(160,100,0,.55) | borda do selo |
Neutro: `--theme-cms-text-dim` na borda tracejada, `--cms-surface-3` no fundo (já existem).

## Medido (Playwright headless, 24 combinações: 6 estados × 2 temas × 1440/390)
`scrollWidth` = largura da janela em todas as 24; nenhum "undefined", "null" ou "NaN"; zero botões desabilitados; `role="status"` só nos estados 1, 1b, 2, 3; `aria-busy` só no estado "lendo". Contrastes (escuro / claro): palavra do veredito 8,37 / 5,75; ícone 6,40 / 4,37 (mín. 3); resumo 8,00 / 10,23; selo âmbar 7,61 / 6,06; selo neutro 8,69 / 8,86; linha "indisponível" 4,86 / 5,83; "Pronto para ativar." do estado lendo 12,77 / 14,89. Capturas em `shots-m1/<largura>-<tema>-<estado>.png` (estado `lendo` incluído).

## O que testar no Opera (M1)
- Trocar os seis estados nos dois temas: o selo âmbar e o neutro se distinguem também em escala de cinza (borda tracejada e símbolo); o selo âmbar renderiza com fundo e borda (rgba literal).
- Estado 5: o esqueleto aparece cinza, sem a palavra verde no banner, e pulsa de leve.
- Ler a frase do estado 2 e a saída dos estados 1/1b: dizem o que fazer sem afirmar problema que não foi medido?
- Claro: "Pronto para ativar..." em verde escuro legível, não esmaecido.
- Largura 390: botões em coluna de 44 px, Ativar teste no topo, nada corta, sem rolagem lateral.
- Nenhum estado deixa os botões apagados.

---

# Referência congelada (r4, envio da original, D12)

Abrir: `open -a Opera index.html`. Dados sintéticos. Tokens com rgba/hex literais (sem color-mix), botões de 36 px (44 px a ≤480 px) com borda `--btn-ctl`, escala de espaçamento 4/8/12/16/24. Dois temas, 1440 e 390 px. Medido com Playwright: `scrollWidth` 1440 = 1440 e 390 = 390; Tab chega à área de envio com contorno de foco; nenhum "undefined" no DOM. Capturas em `shots/r4-*.png`.

## Onde entra
No passo Variantes do assistente, logo acima do cartão A, só para os tipos thumbnail e combo. Em teste só de título não há bloco nem a linha em G.

## O que cada estado mostra
- A. Pública em alta (1280×720): confirma a origem; "Enviar original" é um link (rótulo de um input de arquivo, com foco por teclado).
- B/E. Com a pública baixa e sem original guardada, Próximo fica desabilitado (aria-disabled) com o motivo ao lado.
- B. Pública baixa (480×360 e 640×480, as duas 4:3 com faixa preta): selo, prévia borrada, aviso dizendo em uma frase que o envio é necessário para iniciar e por quê. Um só caminho: a área de envio inteira (label de input file, mínimo 120 px de altura). Rótulo "Arquivo original (obrigatório)". Não existe seguir com a baixa. No celular o texto vira "Escolher arquivo".
- C. Arquivo enviado: pública "Não será usada" × enviada "Será usada". Com a pública baixa só há "Trocar arquivo"; "Remover e usar a pública" fica só com a pública em alta (A).
- D. Inválido, quatro casos (pequeno, proporção, formato, mais de 2 MB), cada um com o que fazer.
- E. Três cartões: enviando (barra, "Cancelar envio" volta a B, sem o arquivo); conexão caiu (original não guardada, "Tentar de novo" reenvia o mesmo arquivo, passo segue livre com a pública); YouTube recusou a imagem (a original continua a pública).
- F. Rascunho reaberto (uma só faixa verde, fundida): o passo abre em C, não em B; a original enviada continua guardada no servidor (a spec do assistente hoje zera `thumbFile` ao salvar: o servidor precisa guardar o envio ao terminar E).
- G. Resumo: linha "Original para restaurar" nos três casos. Com pública baixa e sem envio, "Iniciar teste" fica desabilitado (aria-disabled), com o motivo visível ao lado e a ação "Enviar original" (leva ao passo Variantes com foco na área, mantendo o preenchido; o Próximo volta ao resumo). Sumiu "Iniciar mesmo assim".
- H. Detalhe do teste: "Original guardada" com origem e resolução; testes antigos com pública baixa mostram o aviso e "Enviar original" (só com o teste pausado ou rascunho).

## Decisões (1, 3, 4 e 6 aprovadas pelo dono com a recomendação)
1. Limite de "baixa". Posição do desenho: largura até 480 avisa (regra do diálogo de encerrar). Posição do Logan: aviso sempre que a pública tiver menos de 1280 de largura, pois 480×360 e 640×480 são 4:3 com faixa preta e a 640×480 passaria calada. **Recomendo a do Logan** (o mockup já a mostra); o diálogo de encerrar alinha a 1280 (Phil e Logan, 19/10). Falta conferir com dois vídeos reais do canal se `sddefault` vem sempre com faixa preta.
2. Enviar original é obrigatório quando a pública < 1280 (dono, 19/10): sem envio, não inicia.
3. Mínimo no envio: 1280 sempre, com a pública baixa ou alta (dono 19/10 e ruling do controlador); 1280×720 como ideal no texto.
4. Trocar a original só com teste pausado ou rascunho (trocar no ar muda a base do experimento). Logan concorda.
5. "Remover e usar a pública" só com a pública em alta (dono, 19/10).
6. Limite do YouTube lido como 2 MB e JPG, PNG, GIF; a recusa ao guardar tem mensagem própria (E). Logan concorda.
7. Decidido pelo dono 19/10: retomar livre com aviso (teste antigo com a original baixa não fica preso por regra nova; custo: volta borrada a cada troca). H mostra esse caminho.

## O que testar no Opera
- Escuro e claro: selo e faixa de aviso se leem sem depender só da cor.
- A 390 px: área de envio com 120 px, botões em coluna de 44 px, nada corta.
- Teclado: Tab chega à área de envio (contorno laranja) e aos links.
- Ler as mensagens de D, E e F e dizer se cada uma diz o que fazer.

## r3 (21/10 16:20): pedido do dono no Opera
- Tema claro: banner com fundo gelo `#F4F7F8` e borda `#DCE3E6` (era verde-claro com texto escuro, que o dono não gostou); o verde fica só no ícone e na palavra. Escuro sem mudança. Token novo para a T1b: `--cms-ban-bg` / `--cms-ban-bd` (claro gelo; escuro `rgba(34,197,94,.08)` / transparente).
- Dono aprovou o resto do M1 ("tirando isso parece bom").
