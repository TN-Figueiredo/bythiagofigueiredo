# Glossário de rótulos do caminho nativo (Logan, 21/10/2026)

Vale para M1, M2, M4, Cowork e e-mail. Regra geral: um conceito, um nome, em toda tela. Texto ao dono em português simples; termo interno (`detectado`, `nativo`, `ficha`) nunca aparece como rótulo sem a definição abaixo.
Fontes: spec `2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (§5, §6, r6 a r9); mockups S7 r3 (`2026-10-18-ab-s7-cartao-nativo`), S9 (`2026-10-18-ab-detalhe-teste-youtube`) e M1 r3 (`bythiago-ab-s7/.../2026-10-19-ab-original-em-alta`).
Decisão do dono (21/10): não existe "Meu canal não tem o Teste e compare". A escolha nativo × nosso é **manual, por vídeo**.

## 1. Os dois caminhos

| Termo na tela | Definição (1 linha) | Onde aparece | Evitar |
|---|---|---|---|
| **teste do YouTube** | O teste que o dono liga no Studio (título e/ou miniatura); o YouTube divide o público e mede. | Ficha, cartão S7, selos, lembrete, e-mail, Cowork | Teste e compare (só como nome oficial no ⓘ, 1 vez: "teste do YouTube, no Studio chamado Teste e compare"), "teste nativo" (jargão interno), "Test & Compare" (já banido na S9 A7c) |
| **nosso teste** | O teste que o nosso Lab roda alternando título/miniatura por tempo. | A/B Lab, placar, lote, Cowork | "teste interno", "A/B do Lab", "teste manual" |
| **Prefiro outro caminho** | Botão pequeno que troca o caminho pré-escolhido, sempre disponível, por vídeo. | Linha do vídeo e ficha | "Meu canal não tem o Teste e compare" (cancelado), qualquer opção por canal |
| **caminho sugerido: X** + motivo de 1 linha | O sistema pré-escolhe e diz por quê ("Short: o Studio não oferece o teste"). | Linha do vídeo | Escolha calada; "recomendado" sem motivo |
| **formato não confirmado** | Ainda não sabemos se é Short/kids; mostra os dois caminhos, cada um com o motivo. | Linha do vídeo | "desconhecido", "erro de formato", "indisponível" |

## 2. Leitura do nosso teste

| Termo | Definição | Onde | Evitar |
|---|---|---|---|
| **indício por tempo alternado** | Leitura do nosso teste: mais views/dia até agora, sem prova. Nome completo no rótulo; "indício" sozinho só no selo curto. | Placar, lote, selo, Cowork | "vencedor", "ganhou", "resultado", "significativo", "teste A/B conclusivo" |
| **Sem volume para teste** | Poucas impressões/dia para decidir; sempre com o número e os dias até o piso. | Linha do vídeo (≥ 7 dias) | "Baixo tráfego", "inviável" |
| **não medido** | Dado que nunca foi lido. Cinza próprio/hachura. | Todo número | 0, "—" sem legenda, "N/D", "null" |
| **sem leitura** | O YouTube não respondeu agora; diferente de "sem teste". | Estados 4a/4b, S7 estado 5 | "erro", "falhou" sem o que fazer |

## 3. Teste do YouTube: o que o sistema sabe

| Termo | Definição | Onde | Evitar |
|---|---|---|---|
| **Em teste no Studio** | Há um teste do YouTube em andamento neste vídeo. Selo único para detectado ou confirmado. | Selo da linha e do detalhe | "Teste nativo rodando", "ativo" |
| **detectado** (interno) → na tela: **"Parece haver um teste no Studio"** | Vimos o título mudando sozinho, o dono ainda não confirmou. | Cartão S7 estado 1 | "Detectado" como rótulo de selo; "suspeito"; "possível" |
| **confirmado** → na tela: **"Você confirmou"** (+ data e hora) | O dono disse que o teste existe. | Cartão S7 estado 2, selo | "validado", "aprovado" |
| **Confirmar** | Botão: registra o teste; não altera o vídeo; mantém o Lab parado. | S7 estado 1 | "Aceitar", "Sim" |
| **Não é teste** | Botão: aquilo que vimos não é teste; libera o Lab; vira registro. Fica longe do Confirmar (24 px/linha própria), 2 toques. | S7 estado 1 | "Descartar", "Ignorar", "Falso positivo" |
| **Já iniciei** | Botão da ficha: "iniciei o teste no Studio"; confirma e registra. Se havia linha detectada, confirma a mesma. | Ficha, pergunta da volta do Studio | "Iniciado", "Concluí", "Enviei" |
| **Você iniciou no Studio?** | Pergunta única ao voltar à aba ou reabrir ficha enviada sem marcador. Respostas: **Já iniciei** / **Ainda não**. | Ficha | "Confirmar início" |
| **Liberar o Lab** | Consequência escrita antes do clique: "o Lab volta a trocar título/miniatura neste vídeo". Em 2 toques, fica registrado. | Faixa do S7/S9 | "Desbloquear", "Retomar" (retomar é outra ação) |
| **Lab pausado** / **Lab liberado** | Estado do nosso teste neste vídeo; causa sempre escrita ("pausado porque há teste no Studio, volta em dd/mm"). | Selo, linha, faixa | "Pausado por segurança" sozinho (S9 4a/4b: acrescentar a causa); "bloqueado", "congelado" (só "Congelado em dd/mm" no placar) |
| **Retomar do dia N** | Continua o nosso teste do ponto em que parou. | Cartão fim de teste | "Reiniciar" (reinicia do zero) |

## 4. Ficha e resultado

| Termo | Definição | Onde | Evitar |
|---|---|---|---|
| **ficha** (do teste) | Os textos e imagens a copiar para o Studio (até 3 versões). Título da tela: **"Testar no YouTube"**. | Ficha, botão da linha | "formulário", "rascunho" (na tela), "pacote" |
| **Testar no YouTube** | Botão primário da linha quando o caminho sugerido é o teste do YouTube; abre a ficha. | Linha do vídeo | "Iniciar teste nativo" (confunde com o nosso "Iniciar teste") |
| **Abrir no Studio** | Abre o vídeo no Studio em outra aba; a ficha diz o passo seguinte por escrito. | Ficha | "Ir para o YouTube" |
| **Copiar título** / **Baixar imagem** | Uma ação por versão. | Ficha | "Exportar", "Salvar" |
| **Lembrar no computador** → depois **"Lembrete enviado em dd/mm"** | Notificação para o próprio dono abrir a ficha no desktop. | Ficha (celular) | "Enviar para mim", "Agendar" |
| **versão** (A, B, C) | Cada alternativa testada; a **original é a versão A**. Só "versão" ao dono. | Todas as telas do dono | "variante" (interno, só código e spec), "opção", "criativo" |
| **original** | A versão A, a atual do vídeo antes do teste. | Ficha, placar | "controle", "baseline" |
| **Qual ficou no ar?** | Pergunta do dia 14 sobre o teste do YouTube; botões: **Venceu a nova** / **Ficou igual** / **Inconclusivo** / **Não vi**. Com 3 versões: "Qual?" com miniaturas. | Notificação, e-mail, linha do vídeo | "Vencedor?", "Resultado do teste", "Avalie" |
| **Ficou no ar: B** | Fato registrado: qual versão está no vídeo ao fim. Nunca "vencedora" para o nosso teste. | S7 estado 3, resumo | "Vencedor provável", "Vencedora", "Ganhou" (ver conflito C1) |
| **resultado oficial só no Studio** | Frase fixa no ⓘ: o número oficial nunca é nosso. | ⓘ | "Resultado final", "oficial" no selo |
| **Lembrete do dia 14** | Aviso de que o prazo do teste venceu; só para teste confirmado. | Sino, e-mail, linha | "Alerta", "Pendência" |
| **conflito: "O YouTube indicou X; você disse Y"** | Quando a resposta do dono difere do que lemos; mostra os dois, não escolhe. | Detalhe | "Divergência", "Inconsistência" |

## 5. Original em alta (M1, D12)

| Termo | Definição | Onde | Evitar |
|---|---|---|---|
| **Original em alta** | Regra 1280 px: a imagem guardada para restaurar deve ter 1280 px de largura ou mais. Nome do aviso e do selo. | Passo Revisar do assistente, ficha | "HD", "alta qualidade", "full HD" |
| **Resolução não medida** | Ainda não lemos o tamanho da original; o teste mede ao ativar. Selo neutro tracejado com "?". | M1 estado 2, ficha | "desconhecida", "pendente" |
| **Resolução baixa** (+ medida "480 × 360") | Abaixo de 1280; selo âmbar com símbolo. | M1 estados 1/1b, ficha | "ruim", "borrada" (só na explicação do efeito) |
| **Não consegui conferir a resolução agora** | Leitura falhou; não impede ativar. | M1 estado 3 | "Erro", "Falha" |
| **Pronto para ativar** | Banner do passo Revisar (com "com um aviso abaixo" quando há aviso). | M1 | "Tudo certo" quando há aviso |
| **Ativar teste** | Botão final do nosso teste. | M1 | "Iniciar" (livre para "Já iniciei" e "Iniciar teste" do Lab; ver C3) |
| **Selo de resolução único** | Um componente só (`AvisoResolucao`), sujeito por prop: "enviada" (ficha) ou "guardada" (M1). | Ficha e M1 | Um terceiro âmbar com outra frase |

## 6. Sugestões (M3)

| Termo | Definição | Onde | Evitar |
|---|---|---|---|
| **Sugestões (N)** | Lista única; N = "…" enquanto carrega, nunca 0. | Competidores, A/B Lab | "Candidatos a teste", "Sugeridos para testar" (nomes antigos) |
| **meu vídeo caiu / concorrente bombou / destino esquentou / candidato** | Os 4 chips de origem, sempre com símbolo. | Linha da sugestão | "alerta", "oportunidade", "trending" |
| **teste registrado** (de concorrente) | Teste do YouTube que **vimos** em vídeo de terceiro; só leitura, nunca vira ação nem pré-preenche imagem. | Competidores | "teste do concorrente" (soa como nosso), "A/B do canal X" |
| **pode ajudar** | Verbo das ações sugeridas. | Sugestões | "vai ajudar", "garante", "aumenta" |
| **análise e ideias, não cópia** | Rótulo fixo da leitura da thumbnail de terceiro. | Painel da ação 2 | "Gerar", "Copiar estilo", "Recriar" |
| **dispensar** + motivo: "não é para mim" / "já tratei" / "depois" (7 dias) | Ação secundária. | Linha | "Ocultar", "Excluir" |

## 7. Conflitos entre telas aprovadas e o spec

- **C1 Vencedor.** S9 (aprovado) usa "Vencedor provável" (estado 3, 3b "Vencedor: sem dado", resultado no ⓘ); S7 r3 (aprovado) usa "Ficou no ar: B". Mesma ideia, dois nomes. Padrão: **"Ficou no ar: B"** para o fato de qual versão está no vídeo; **"Venceu a nova"** só como a resposta do dono no dia 14. "Vencedor provável" sai da S9 (3, 3b e ⓘ) e "Vencedor: sem dado" vira "Ficou no ar: não lido". Motivo: "vencedor" para o teste do YouTube soa como o número oficial do Studio.
- **C2 Saída da guarda com 3 nomes.** "Não é teste" (S7 1), "Não é teste, liberar o Lab" (S9 2), "Sei que não há teste: liberar o Lab" (S9 4a/4b e S7 5) e "Não tenho teste de miniatura" (S9 2b). Padrão: **"Não é teste"** quando há uma linha detectada; **"Sei que não há teste"** quando não há sinal (sem leitura); ambos abrem a faixa **"Liberar o Lab"** (consequência + Cancelar). "Não tenho teste de miniatura" fica, é outro caso (declaração do dono sobre miniatura).
- **C3 "Iniciar/Já iniciei/Ativar".** Nosso teste usa "Iniciar teste"/"Ativar teste" (M1 e G do assistente); o teste do YouTube usa "Já iniciei" (feito no Studio). Manter a separação: "Ativar/Iniciar teste" só do nosso; "Já iniciei" só do Studio. Nunca "Iniciar" sozinho em tela de ficha.
- **C4 "original".** "Original" é a versão A (ficha, placar) e também "Original em alta" (a imagem guardada para restaurar, M1). Padrão: na M1 sempre "original guardada"; na ficha e no placar, "versão A (original)".
- **C5 Pausa.** "Lab pausado" (S9 2/2b), "Lab pausado por segurança" (4a/4b), "Pausado a seu pedido" (2b). Aceitar os três só com a causa na mesma linha; selo curto sempre "Lab pausado".
- **C6 Spec desatualizado pela decisão do dono (21/10).** Spec §5.1 (linha "Nativo indisponível no canal"; parágrafo "Onde se declara nativo indisponível"), §6 (M2: "nativo indisponível e onde se declara") e §9 (pergunta 0 e proposta 1) ainda descrevem a opção por canal e a coluna `teste_nativo_indisponivel_em`. Devem sair; resta a linha de caminho por vídeo e "Prefiro outro caminho". Vídeo de canal sem o recurso: o dono escolhe "nosso" no vídeo; o motivo exibido é "você escolheu", nunca "seu canal não tem".
- **C7 Termos só internos que vazam ao dono no spec/Cowork:** `nativo`, `detectado`, `ficha`, `variante`, `indício` sozinho. No Cowork e no e-mail, usar os termos da tela.
- **C8 `status_note`/`reason`/`learning`** exibem texto livre; não podem carregar rótulo novo fora deste glossário (decisão r9: log da flag vai ao `audit_log`).

## 9. Troca observada em concorrente (r11, spec §5.8)

| Termo na tela / Cowork | Definição (1 linha) | Evitar |
|---|---|---|
| **troca observada** | O concorrente mudou a miniatura ou o título e a mudança ficou (A depois B). Pode ser edição manual; não afirma teste. | "teste do concorrente", "teste nativo observado" |
| **possível teste do YouTube** | A versão original voltou depois da nova (A, B, A na mesma janela): indício de teste, não prova. Só vira "teste" na tela depois do aceite (spec §7). | "teste nativo observado", "teste do concorrente", "venceu" |
| **sem troca vista** / **não medido** | Sonda leu o vídeo (8 rodadas ou mais, recente) e nada mudou / a sonda não leu o bastante. Nunca "não testou". | "0 versões", "sem teste" |

## 8. Não verificado
Só li spec e README/NOTAS e fiz busca textual nos HTML; não abri os mockups no navegador nem revi o M2 (ainda não existe). O texto exato de botões em `index.html` pode diferir dos READMEs; a conferência de cada tela é tarefa do M2.
