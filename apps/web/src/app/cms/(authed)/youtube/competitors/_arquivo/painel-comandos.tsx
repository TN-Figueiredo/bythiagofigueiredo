'use client'
/**
 * M9b T7 (mockup peca9, item 1): o painel "Ver os comandos" de um canal removido, com a linha fixa da peça 7 e o botão Copiar.
 * Só quem administra o site chega aqui (o modelo não devolve `comandos` para quem só edita). Sem "Já rodei": ele fica na peça 7 (T7b).
 */
import { useState, type ReactElement } from 'react'

export function CopiarLinha({ linha, aoCopiar }: { linha: string; aoCopiar?: (t: string) => void }): ReactElement {
  const [texto, setTexto] = useState('Copiar')
  const fim = (t: string): void => { setTexto(t); aoCopiar?.(t); setTimeout(() => setTexto('Copiar'), 2000) }
  const copiar = (): void => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(linha).then(() => fim('Copiado'), () => fim('Selecione e copie'))
    else fim('Selecione e copie')
  }
  return <button type="button" className="btn small" onClick={copiar} aria-label="Copiar a linha do passo 1">{texto}</button>
}

export function PainelComandos({ id, titulo, linha }: { id: string; titulo: string; linha: string }): ReactElement {
  const [status, setStatus] = useState('')
  return (
    <div className="p7-cmd arq-cmd" id={id}>
      <h4>{titulo}</h4>
      <ol>
        <li>No Mac, rode esta linha: <span className="p7-sh"><pre><code>{linha}</code></pre><CopiarLinha linha={linha} aoCopiar={t => setStatus(t === 'Copiado' ? 'Linha copiada.' : 'Selecione e copie a linha.')} /></span></li>
        <li>Confira a última linha que apareceu: tem de começar com <code>OBS-ARQUIVO:</code>. Se não começar, nada rodou.</li>
        <li>Se a última linha disser NÃO TERMINOU e citar RESTA, sobrou arquivo no canal. A tela não enxerga isso. Siga a seção «Sobrou arquivo no canal» do runbook.{' '}
          <details className="arq-info"><summary aria-label="O que é RESTA">i</summary><p>A pasta do canal no NAS não ficou vazia. Nada foi apagado a mais. O que sobrou fica 30 dias em quarentena e se resolve sozinho; a linha, rodada de novo, diz o que falta.</p></details>
        </li>
        <li>Espere: a página confirma sozinha em até 24 horas. Rodar a linha de novo é sempre seguro.</li>
      </ol>
      <p className="m-st" role="status" aria-live="polite">{status}</p>
    </div>
  )
}
