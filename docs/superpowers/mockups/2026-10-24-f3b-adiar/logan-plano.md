# F3b "Adiar 7 dias": plano de UX do delta sobre o M3 (Logan, 23/10, antes do desenho)

Fontes lidas (origin/staging via `bt-leitura`, efb588509): plano F3 §F3b e quadro de achados; spec §6 (linha 439); M3 r2 `index.html` (linha, painel `.dsp`, faixa `.done`, Esc/foco) e README. O desenho do M3 aprovado não muda fora do que está abaixo.

## 1. Pergunta do usuário e tarefa principal

**Pergunta de quem toca:** "Isto agora não, mas quero ver de novo; some da lista e volta quando?"
**Tarefa principal (adiar uma linha):** 2 toques, 0 confirmações, 0 rolagens: (1) "Dispensar ou adiar" (⋯ a 390) abre o painel; (2) "Adiar 7 dias" grava. Teclado: Enter no gatilho → foco no 1º motivo → 3 Tab (2 motivos + "Já fiz") → Enter. Nenhum passo pode sair sem tirar a escolha do motivo de quem dispensa.

## 2. Decisões, cada uma com o opositor interno

### D1. Onde o botão vive: dentro do painel, último grupo, antes de "Cancelar" (mantém o plano)
Ordem: `Por que dispensar? [motivo] [motivo] | Já fiz ‖ Adiar 7 dias   Cancelar`.
- **Opositor:** Gmail e o app de e-mail do celular dão "Adiar" como botão próprio ao lado de "Arquivar"; escondido sob "Dispensar", quem quer adiar não acha (descoberta) e o toque fica a 2 em vez de 1.
- **Resposta:** a linha já tem duas ações a 24 px (primário + secundária) e, a 390, o ⋯ de 44 px; uma terceira por linha numa lista de até 40 soma uma decisão a cada linha (Hick) para uma ação de frequência baixa. O modelo do próprio dono já é "depois é um dos motivos de tirar da lista" (spec §6 original: motivos "não é para mim, já tratei, depois"). O custo de descoberta resolve-se no rótulo do gatilho (D2), não com um botão a mais. **Mantido.**

### D2. O gatilho passa a se chamar "Dispensar ou adiar" (corrige)
- 1440: o botão de texto `Dispensar` vira **`Dispensar ou adiar`**. 390: o ⋯ ganha `aria-label="Dispensar ou adiar"` (hoje "Dispensar: escolher motivo"). O título do painel continua "Por que dispensar?" só sobre o 1º grupo; o grupo do adiar fica depois do traço duplo, sem pergunta.
- **Por quê:** o rótulo tem de dizer o que o clique abre. Com "Dispensar", quem quer adiar lê "isto apaga" e não abre; quem abre lê "Adiar" sob "Por que dispensar?" e conclui que adiar também dispensa por 30 dias (é o que a faixa vizinha diz). Custo: decisão errada (dispensa no lugar de adiar, sem Desfazer) ou linha largada aberta.
- **Opositor:** muda um rótulo do M3 aprovado, a faixa continua "Dispensada" e o nome fica longo.
- **Resposta:** 18 caracteres em botão de texto a 1440 cabem (Naksu confere a largura); a faixa "Dispensada" segue certa, porque só aparece para motivo de dispensa. Mudar um rótulo é o delta que o dono vai aprovar junto do botão. Se a Naksu medir quebra a 1440, a alternativa é manter "Dispensar" e pôr o título do painel como "Dispensar ou adiar" — pior, porque a descoberta continua dependendo de abrir.

### D3. Sem confirmação (mantém o plano)
- **Opositor:** não há Desfazer; um toque errado some com a linha por 7 dias.
- **Resposta:** é a ação menos destrutiva do painel (volta sozinha); confirmação cobraria um passo de toda vez para proteger o caso raro. O toque errado custa 7 dias de espera, não a sugestão. **Exceção em D4.**

### D4. Linha que vence antes de 7 dias não oferece "Adiar" (corrige; diverge do texto do plano P-C1)
- A tela já sabe `expires_at`. Se `expires_at <= agora + 7 d`, o lugar do botão mostra **texto, não botão**: `Vence em sex, 30/10: não dá para adiar 7 dias.` (`--muted`, sem foco).
- **Por quê:** o plano hoje deixa tocar e avisa depois ("Adiada. Ela vence em DD/MM, antes de voltar."). Sem Desfazer, isso é uma dispensa que o dono não escolheu, avisada depois que já não há volta. Aviso honesto vem antes do toque.
- **Opositor:** o painel muda de forma conforme a linha (consistência interna) e botão desabilitado é padrão conhecido.
- **Resposta:** o grupo continua no mesmo lugar, só troca botão por frase; botão desabilitado não diz por quê e some do Tab sem explicação. **Defesa no servidor continua** (corrida: lista lida antes, aba velha): se a função devolver `expira_antes`, a linha **não sai** e mostra `Não adiou: ela vence em 30/10, antes dos 7 dias.` Pedido a Phil e Yannis: nesse caso a função não grava nada (`ok:false, motivo:'expira_antes'`) em vez de `ok:true` com a linha escondida. Conflito declarado com o P-C1/Y-C4 do plano; se eles mantiverem o `ok:true`, a frase da faixa do plano fica e eu registro a discordância para o dono.

### D5. Faixa "Adiada": diz quando volta e não promete aviso (corrige o texto)
- Texto: **`Adiada. Volta para esta lista em sex, 30/10.`** Relógio, 5 s como a "Dispensada", depois a linha sai; N, frase-resumo, aba de Competidores, bloco do A/B Lab e sino caem juntos (mesma regra da dispensa).
- Data com dia da semana e no fuso do aparelho: o dono viaja; "30/10" sozinho obriga a fazer conta de calendário.
- **Não escrever "e você será avisado".** O plano tem duas leituras (Phil-M2: "ao voltar vai no resumo"; "Menores adiados": "não reenvia o sino"). Até Phil fechar, a faixa só promete o que é certo: volta para a lista.
- **Opositor:** "Adiada." basta; a data é ruído. **Resposta:** a pergunta de quem toca é "volta quando?"; sem data, a próxima pergunta exige outra tela que não existe (não há lista de adiadas).

### D6. Sem lista de adiadas; uma linha de contagem (mantém, com texto unificado)
- **Opositor (Gmail tem pasta "Adiados"):** sem ver as adiadas, o dono não confere o que escondeu.
- **Resposta:** sem Desfazer (DF2), a lista seria só leitura, sem ação: uma tela inteira para nada a fazer. Uma linha basta. **Gatilho para reabrir a decisão:** o mesmo do Desfazer.
- Texto unificado (o plano usa "a primeira volta em" num estado e "voltam até" no outro; datas diferentes para a mesma pergunta):
  - lista com adiadas, linha sob a frase-resumo, `--muted`, relógio: **`2 adiadas por você. A próxima volta em sex, 30/10.`** (1: `1 adiada por você. Volta em sex, 30/10.`)
  - vazio `adiado` (precedência P-C2): título **`Você adiou 2 sugestões.`**, texto **`A próxima volta em sex, 30/10.`**, 2ª linha com a frase do motivo do cálculo.
  - O bloco do A/B Lab usa o mesmo vazio e a mesma linha (o bloco já repete o N da página).
- Conta só as que voltam (`contagens.adiados`, P-C1); chave ausente vira "não medido", nunca 0.

### D7. Linha que voltou: selo "Adiada por você em 23/10" (sugestão)
- **Opositor:** mais um selo na linha. **Resposta:** sem ele o dono lê a linha como nova e pode adiar de novo sem perceber que já adiou. É `selo mute` na linha do chip, só quando `adiado_ate` está no passado. Requer `adiado_ate` no payload. Adiar de novo é permitido (mesmo fluxo).

### D8. Uma opção só: 7 dias (mantém)
- **Opositor:** Gmail oferece amanhã / fim de semana / data. **Resposta:** cada opção é decisão a mais (Hick) numa ação rara; sugestão vence sozinha por `expires_at`, então prazos longos não fazem sentido. O número fica no rótulo para não haver surpresa.

## 3. Estados do delta (o desenhista acrescenta ao seletor do M3)

| Chave | O que mostra | Texto |
|---|---|---|
| `dispensar-aberto` (alterado) | painel com o grupo novo | `… \| Já fiz ‖ Adiar 7 dias  Cancelar` |
| `adiar-vence-antes` | frase no lugar do botão | `Vence em sex, 30/10: não dá para adiar 7 dias.` |
| `adiar-salvando` | botão desabilitado, rótulo | `Adiando…` (mesma regra do "Salvando…" da T5; toque duplo ignorado) |
| `adiada` | faixa 5 s, depois sai | `Adiada. Volta para esta lista em sex, 30/10.` |
| `adiar-nao-salvou` | linha volta, erro no padrão do M3 (S5) | `Não salvou “Adiar 7 dias”: sem conexão. A sugestão continua aberta.` + `Tentar de novo “Adiar 7 dias”` |
| `adiar-ja-adiada` | ver regra abaixo | sucesso ou `Esta sugestão já saiu da lista.` |
| `adiar-corrida-vence` | linha fica, erro | `Não adiou: ela vence em 30/10, antes dos 7 dias.` |
| `lista-com-adiadas` | linha de contagem sob o resumo | `2 adiadas por você. A próxima volta em sex, 30/10.` |
| `vazio-adiado` | vazio da família relógio | `Você adiou 2 sugestões.` / `A próxima volta em sex, 30/10.` + motivo do cálculo |
| `voltou` | selo na linha | `Adiada por você em 23/10` |
| `ctx-ablab-adiadas` | bloco com a linha de contagem e com o vazio `adiado` | mesmos textos |

**Regra do `ja_adiado` (corrige):** conexão cai depois de o servidor gravar; o "Tentar de novo" recebe `ja_adiado`. Tratar como `nao_aberto` (P-C5) mostra "já saiu da lista" para o que o dono acabou de pedir, e ele acha que falhou. Se a resposta trouxer `adiado_ate`, mostrar a faixa `Adiada` normal com essa data; `nao_aberto` só quando a linha saiu por outro motivo (dispensa, vencimento). Pedido a Phil/Yannis: `ja_adiado` devolve `adiado_ate`.

## 4. Teclado e foco
- Gatilho (Enter/Espaço) → foco no 1º motivo (como hoje). Ordem de Tab = ordem de leitura: motivos → Já fiz → Adiar 7 dias → Cancelar. Em `adiar-vence-antes`, a frase fica fora do Tab; o Tab vai de "Já fiz" para "Cancelar".
- Esc e Cancelar fecham e devolvem o foco ao gatilho (já no M3).
- Depois de gravar: faixa `role="status"` (lida pelo leitor de tela), foco na linha seguinte (como a dispensa). **Última linha:** foco no título da lista (`tabindex="-1"`), não no `body` — o M3 hoje faz `render(null)` e o foco se perde.
- `adiar-nao-salvou`: foco no botão "Tentar de novo", `role="alert"`.

## 5. Fora da tela, para não esquecer
- Cowork lê o mesmo N sem as adiadas (D16); o `motivoVazio 'adiado'` do Cowork precisa da mesma frase (paridade de conteúdo). Para Phil.
- Volta do navegador e recarregar durante "Adiando…": a leitura nova decide (a linha some ou fica); nada a guardar no cliente.

## 6. Para a Naksu (uma linha cada; medição dela)
- Largura de "Dispensar ou adiar" a 1440 ao lado do primário mais longo ("Abrir seus 12 vídeos sobre …").
- Traço duplo `‖` entre grupos: distinguível do traço simples antes de "Já fiz" a 390, onde o painel quebra.
- Faixa "Adiada" (`--sunk`, `--border-strong`, relógio) contra a "Dispensada" (✓): distinção sem cor nos dois temas.
- Frase `adiar-vence-antes` em `--muted` ≥ 4,5:1 no fundo do painel.

## 7. Não verificado
Leitor de tela real (anúncio do `role="status"` e da troca de foco); fuso de outro país num aparelho real; rede lenta de verdade no "Adiando…". Não abri navegador: é plano, não há desenho do delta ainda.
