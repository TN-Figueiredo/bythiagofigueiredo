# Mockup: selo depois de "Voltar à original" (r2), 25/10/2026

Cópia do M5 r5 (`../2026-10-25-m5-tela-v2/`, intocado) com 3 estados novos e o fluxo clicável. Seletor: `?estado=&tema=claro|escuro&largura=1440|390|ambas`. Decisão: `.superpowers/sdd/ab-lab/selo-voltar/sintese-r1.md`.

## Estados novos
- `concluido-desfeita-provisorio` e `concluido-desfeita-final`: selo "◆ Aplicação de B desfeita" em 1º; selo do resultado neutro "◇ B venceu o teste (· provisório)"; "No ar agora: A (original). B deixou de ser aplicada."; frase "B ainda parece melhor, mas a original está no ar." + "Você voltou à original. Pode aplicar B de novo."; botão secundário "Aplicar B de novo".
- `concluido-desfeita-mudou`: a letra mudou depois (sem diferença): selo desfeita + selo atual, sem botão.
- Os 3 têm capturas 1440/390, claro/escuro, em `shots/`.

## Como testar
1. Abra `concluido-vencedor-provisorio` e clique "Aplicar B ao vídeo" > "Aplicar B".
2. A linha vira "B está no ar." e surge "Voltar à original"; clique e confirme "Sim, voltar à original".
3. A tela vira a "desfeita": selo ◆ primeiro, ◇ neutro, frase nova, botão "Aplicar B de novo" (não primário).
4. Clique "Aplicar B de novo": a confirmação diz "A janela de 7 dias para voltar recomeça hoje." (e "O desfecho ainda é provisório."). Esc e "Cancelar" fecham.
5. Confirme: volta a "B está no ar." com "Voltar à original" e sem selo de desfeita.
6. Abra `concluido-desfeita-mudou`: sem botão. Teste 390 e escuro pelos botões do topo.

## O que diverge do M5
- Só o selo ◇ aparece com "venceu" no passado quando há aplicação desfeita; o verde fica só para "vigente".
- "Voltar à original" agora redesenha a seção (antes só acrescentava um selo ao fim); "Aplicar B" passa a mostrar "Voltar à original".
- Diálogo de reaplicar: título "Aplicar B de novo?" e frase da janela.
- Demais 24 estados intactos. `verifica.mjs`: 51 capturas + 2 do fluxo, checagens do M5 + fluxo completo (390 e 1440), overflow a 390 e ausência de botão no `-mudou`.

## Não verificado
Condições reais do botão (restore_status ok, nenhum outro teste aberto no vídeo) não são simuláveis aqui; leitor de tela e Opera.

## r2: o que mudou
Revisões: `.superpowers/sdd/ab-lab/selo-voltar/revisao-mockup-r1-logan.md` (84) e `...-naksu.md` (86).
- **Logan 1** Apoio vira "Você voltou à original." e só ganha "Pode aplicar B de novo." quando o botão existe. Sem botão, motivo curto no lugar dele. Estados novos `concluido-desfeita-bloqueado` (outro teste aberto no vídeo) e `-bloqueado-miniatura` (miniatura não confirmada).
- **Logan 2** Linha de CTR de volta, logo abaixo da frase; ordem: frase, CTR, apoio, ◆, ◇, provisório, No ar, botão.
- **Logan 3** Espera e erro para Aplicar B de novo e Voltar à original: botão `aria-disabled` "Aplicando B…"/"Voltando à original…" (foco mantido, 44 px), erro `role=alert` "Não consegui aplicar B. A original continua no ar." (ou "…voltar à original. B continua no ar.") com "Tentar de novo". Estados `concluido-desfeita-aplicando`, `-desfeita-erro`, `concluido-aplicado-voltando`, `-aplicado-erro`. No fluxo, a caixa "Simular conexão caída ao confirmar" (topo) força o erro; sem ela, 0,7 s de espera e sucesso.
- **Logan 4** Cancelar dos diálogos de aplicar/voltar chama-se "Cancelar" (Esc e foco de volta ao botão que abriu, como antes).
- **Logan menor** Diálogo da desfeita-final: "Este desfecho já não muda." antes da frase da janela.
- **Naksu 1** `.sel.desfeito` cheio (fundo `--surface-2`, borda sólida); o ◇ do resultado vazado (fundo transparente). Hierarquia por forma, sem cor.
- **Naksu 2** ◆ e ◇ viram SVG 14x14 inline (`I.dFill`/`I.dOut`), `aria-hidden`; sem glifo Unicode.
- **Naksu menor** `.sel` com `white-space:normal`, `overflow-wrap:anywhere` e raio 20 px: rótulo longo (EN) quebra em 2 linhas sem estourar a 320 px (largura 320 no seletor; captura `shots/concluido-desfeita-rotulo-longo-claro-320.png`). Região dos selos (`.selreg`) persistente com `aria-live="polite"`, sem `role=status` nos selos: o anúncio acontece porque a região não é recriada na troca.
- **Para a implementação** "neutro = `--dim`" é a família de `.sel.neu`, `.mut`, `.fort` e `.desfeito`: um só `<Selo variant="neutro">`.
- `verifica.mjs`: 60 capturas + as do fluxo, checagens novas (bloqueado, ordem, aria-live, cheio x vazado, Cancelar, espera/erro/nova tentativa, 320 px sem overflow e alvo 44).

## Não verificado (r2)
Leitor de tela real (anúncio do aria-live), rede real, Opera, as condições reais do botão (`restore_status`, outro teste aberto).
