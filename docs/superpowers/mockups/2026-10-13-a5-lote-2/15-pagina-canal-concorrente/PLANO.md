# Plano do mockup 15: página do canal de concorrente (feito antes do desenho)

Base aprovada: `2026-10-07-pagina-canal/canal.html` (cabeçalho com seis células, abas, lista de vídeos). Aqui entram só os acréscimos da A5 (todos com o contorno "+ novo"); a lista de vídeos que já existe fica como estava e aparece apenas como vizinha no pé da tela.

## Para quem e a pergunta de 3 segundos
O dono, antes de decidir o próximo vídeo, abre um concorrente e quer saber: **este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?** A resposta tem de estar no cabeçalho, em uma frase e em seis células, sem rolar.

## Hierarquia (de cima para baixo)
1. Cabeçalho: nome, pastilha de estado (M8), uma frase-resumo, seis células (inscritos, direção, estado, acerto, ritmo, resposta do criador).
2. **Direção** (M3): três leituras com nome, a do canal inteiro em destaque, as outras duas em segundo plano para não virarem três vereditos; régua de -50% a +50% com a faixa "sem mudança" de -10% a +10%.
3. **Lançamentos** (a forma memorável da tela): curvas dos primeiros 30 dias dos vídeos recentes, alinhadas pela idade, sobre a linha do normal do canal (M2) com o `n` de cada ponto; a frase fala do vídeo escolhido ("saiu acima do normal já no dia 2").
4. **Linha do tempo**: views ganhas por dia do canal, com publicações, mudanças de campo e trocas em raias; linha de corte de 24/08/2026; sem raia de playlists.
5. **Ritmo** (M6): 13 semanas em casas (publicou / zero medido / não medido) e a régua "dias desde a última publicação" contra o limite de "parado".
6. **O que o criador respondeu** (M11): lista curta; só leitura vê a contagem, não o texto.

## O que sai do cabeçalho para entrar a direção
Saem para "Todos os números" (continuam acessíveis, com a mesma conta): inscritos em 30 dias, views/dia nos longos, engajamento nos longos. Sai e é substituído: "acima de 2x em 90 dias" vira M4 (a mesma ideia, agora "3 de 12"). "Longos + Shorts por semana" vira o ritmo M6. Entram: direção (M3a), estado (M8), resposta do criador (M11).

## Estados
Magro (padrão: é o caso real de hoje, 13/10/2026), cheio (simulação de 12/05/2027, quando V30 e a curva existem), extremo (queda sustentada, números enormes, nome longo), parado, zero medido, não medido (tudo com motivo), erro, sem dado (recém-cadastrado), fora do ar, só Shorts, nichos diferentes, só leitura.

## Cor e símbolo
- Direção: verde ▲, âmbar ▼, neutro ＝ (como no lote 1); nunca vermelho. Estado "parado" e "em queda sustentada" de M8: âmbar com ícone de pausa e de seta para baixo. "Ativo": verde de "em dia" com ícone de visto. "Fora do ar": contorno tracejado neutro com x (a forma da tela E).
- Não medido: rosa com hachura, em toda parte (casa, barra, trecho do eixo). Zero medido: caixa vazada com o 0. "Ainda não chegou" (resto de uma barra de progresso): contorno pontilhado.
- Curvas de vídeo: faixas de desempenho (azul normal, violeta alto, coral topo) mais o desenho do marcador (círculo, quadrado, losango) e a linha tracejada para "abaixo do normal"; a linha do normal do canal em areia, mais grossa.
- Sem `color-mix()`.

## Revisão do plano contra o brief (o que mudei)
- Eu ia pôr três setas grandes iguais para as três direções: virou três vereditos. Agora (a) é a leitura principal em corpo maior e (b), (c) são linhas menores, e a frase do topo diz só a (a).
- Eu ia mostrar as curvas por vídeo coloridas por vídeo (arco-íris): não tem significado. Agora a cor é a faixa de desempenho, e o vídeo escolhido ganha traço grosso.
- A raia de playlists não existe (E3 retirada); a de mudanças de campo mostra só o que a E1 registra.
