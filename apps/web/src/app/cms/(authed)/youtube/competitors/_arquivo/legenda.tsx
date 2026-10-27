import type { ReactElement } from 'react'
import type { Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { INFO } from '@/lib/youtube/observatorio/arquivo-mensal/info'
import { FormaIcone } from './regua'

const FORMAS: Array<{ forma: Forma; nome: string; texto: string }> = [
  { forma: 'visto', nome: 'Feito', texto: 'A etapa aconteceu e foi conferida.' },
  { forma: 'pontilhado', nome: 'Ainda não', texto: 'A etapa ainda não chegou; está dentro do prazo.' },
  { forma: 'pontilhado_ambar', nome: 'Passou do prazo', texto: 'A etapa devia ter acontecido e ainda não aconteceu.' },
  { forma: 'triangulo', nome: 'Atenção', texto: 'Algo pede uma olhada, mas nada se perde.' },
  { forma: 'octogono', nome: 'Problema', texto: 'Algo pede ação sua agora.' },
  { forma: 'hachura', nome: 'Não medido', texto: 'O dado não foi lido; isto não quer dizer que está bom nem ruim.' },
  { forma: 'arquivo', nome: 'No arquivo', texto: 'O mês saiu do banco e vive no NAS e no B2.' },
  { forma: 'zero', nome: 'Zero', texto: 'Foi medido e o valor é zero.' },
  { forma: 'barra', nome: 'Em andamento', texto: 'A cópia do mês está acontecendo.' },
]
const ORIGENS = INFO('A conferência do B2 tem duas origens, a da forja e a sua. As duas valem o mesmo visto.')

/** "Como ler as formas": recolhida, as nove formas e a nota das duas origens da conferência do B2. */
export function Legenda(): ReactElement {
  return (
    <details className="arq-leg">
      <summary>Como ler as formas</summary>
      <div className="arq-leg-in">
        <ul>{FORMAS.map(f => <li key={f.forma}><FormaIcone forma={f.forma} /><span><b>{f.nome}.</b> {f.texto}</span></li>)}</ul>
        <p className="arq-nota">{ORIGENS}</p>
      </div>
    </details>
  )
}
