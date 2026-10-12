# Plano 8: video.html depois da REVISAO-UX-7 (12/10)

Quem desenha: eu (skill frontend-design). Escrito ANTES de mexer. Entrada: `REVISAO-UX-7.md` (N1 a N10, A2, A3, S1, S3 em parte, `bordaFinal`). Restrição dura: os blocos "Taxa de clique deste vídeo" e "Retenção" do vídeo e o canal (magro, cheio, aba Retenção) ficam sem mudar um pixel, exceto o que N6 e N8 tocam na legenda e na faixa de cliques (compartilhadas). Cópia de segurança da pasta: `scratchpad/video-antes-r8/`.

## Corrige
**N1. Marca inventada sem "exemplo" no gráfico. Aceito.** A legenda diz "troca de título (exemplo)" e "troca de thumbnail (exemplo)"; a leitura por dia e a tabela dizem "exemplo"; e, para o aviso ficar PERTO da marca (a 390 px a legenda fica longe do topo), o gráfico ganha uma linha de texto dentro do próprio SVG, acima dos marcadores: "marcas de exemplo: trocas inventadas" (12 px). Vale em todos os casos com trocas, inclusive o magro. O topo do gráfico cresce 16 px só quando há marca de exemplo.

**N2. "não registrado" x "nenhuma registrada" sem cor. Aceito, e vou além do que o revisor propôs.** Ele sugeriu a hachura forte da pastilha de "não medido". Não uso: a regra desta rodada é que nenhum dos dois estados se confunda com a hachura aprovada. Desenho por forma:
- *não registrado* (hoje): contorno **pontilhado** neutro e dois marcadores fantasma (losango e triângulo só em contorno pontilhado) antes do texto. Lê-se como "aqui iriam as marcas, e não há registro". Sem hachura, sem magenta.
- *nenhuma registrada* (futuro): caixa **cheia de borda contínua** (a forma do "zero medido") com o número **0**: "0 trocas registradas".
Pontilhado x contínuo, fantasma x número: separam em escala de cinza.

**N3. Cor de marcador perto de cor com significado. Aceito, com outra solução.** Procurei por script (CIE76, as 80 cores literais de `a4.css`, `comparar-direcao.css` e `video.js`, nos dois temas) um matiz livre: não existe. Verde colide com o "▲ taxa subiu" (o triângulo de thumbnail é um ▲), âmbar com o "▼ taxa caiu", rosa com o não medido, azul e violeta com os já usados. A cor dos marcadores não carrega informação (a forma e o número já dizem tipo e ordem), então os dois marcadores passam a usar o tom de texto da própria tela (`--text`, preenchido), sem matiz. Medida na entrega. Um token só (`--tr`), a legenda e o bloco usam o mesmo.

**N4. Dois swatches iguais na legenda. Aceito.** O item de "trocas ainda não registradas" ganha swatch próprio: os dois marcadores fantasma pontilhados (o mesmo desenho do N2), e deixa de usar a hachura de "não medido". No estado "nenhuma registrada" não há item de legenda (não há marca a explicar).

## Sugestões
- **N5 (folga de 3 para 2 px, magro a 390): aceito só no vídeo.** O parâmetro vira `folgaNum` (padrão 3, como o canal aprovado; o vídeo passa 2). O canal não muda por causa disto. No cheio a 390 aceito 9 de 18, como o revisor: os outros números estão na leitura por dia e na tabela.
- **N6: aceito (mudo de posição sobre A2).** Ver abaixo. A legenda volta a "cliques estimados do dia"; a frase fica no ⓘ. Muda no canal, e é a única mudança de texto da legenda.
- **N7: aceito.** "desde a publicação, em 10/12/2024" (ano quando o vídeo tem mais de um ano).
- **N8: aceito.** Números da faixa por `A.n()`, com ponto de milhar (a largura reservada acompanha). Muda no canal (todo número da faixa com 4 dígitos ou mais); listo o que mudou depois de medir.
- **N9: aceito.** Itens da frase-resumo separados por ponto e vírgula.
- **N10: aceito, simples.** Uma linha com o chip "exemplo" acima do primeiro gráfico, só quando há troca: "Trocas deste vídeo: título (1) em 27/09, sem diferença firme; thumbnail (2) em 02/10, taxa subiu." e o link "ver detalhes" (44 px de alvo). Usa a mesma leitura do bloco, nada novo a calcular.

## "Em parte"
- **A2 (decido de novo; concedo).** Eu defendia a frase "a altura do ponto não mede nada" na legenda como resposta literal à dúvida do dono. Releio: a dúvida nasceu do ponto DENTRO da barra, com altura variável; na faixa todos os pontos ficam na mesma linha, então a altura não existe por construção, e uma legenda que explica o que a marca NÃO é, depois de ela não poder ser lida assim, é texto a mais; custa uma linha a 390 e entra no canal aprovado, que nunca a teve. O argumento do revisor vence. A frase fica no ⓘ, onde o dono pediu o método. **Sem divergência a declarar.** (Se o dono quiser a frase de volta na legenda, é uma string em `a4-comum.js`.)
- **A3:** número em todo ponto que cabe: resolvido no vídeo (N5) e aceito como está no cheio 390 e no canal.
- **S1:** resolvido por N2 e N4 (forma própria, sem a hachura de não medido).
- **S3:** resolvido por N3 (sem matiz novo, medido).

## `bordaFinal` (última data cortada) no canal
Não ligo. Deixo pronto: `bordaFinal` já é um parâmetro de `serieDia`; acrescento um interruptor de pré-visualização, `canal.html?borda=sim` (liga o conserto só naquela abertura, sem tocar o padrão). Para ligar de vez: `bordaFinal: true` nas duas chamadas de `A.serieDia` em `canal.js` (ou apagar a condição do `?borda=sim` em `a4-comum.js`). Padrão continua igual ao aprovado.

## Onde discordo do revisor
Em nada que precise ir ao dono, exceto o detalhe do N2 (não uso a hachura forte que ele sugeriu, por causa da regra desta rodada) e o do N3 (marcador sem matiz em vez de dois matizes novos). Se houver divergência depois da conferência, vai declarada no AJUSTES-UX-8.

## Não toco
`c1-*`, `c2-*` (nem as regras `c2-*` do fim de `a4.css`: o que escrevo entra antes), `comparar-*`. Nada commitado.
