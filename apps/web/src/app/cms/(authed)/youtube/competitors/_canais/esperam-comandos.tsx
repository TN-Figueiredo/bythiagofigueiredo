'use client'

/**
 * Manutenção M5, Tarefa 10 (mockup 19, peca7.js): "Esperam você rodar os comandos", na fila "Saíram do YouTube". Só leitura: sem "Já rodei" (M9).
 * Resumo com a idade do mais antigo, uma barra de 0 a 60 dias por item (cor no contorno e no preenchimento, texto em cor normal) e, só para quem
 * administra, "Ver os comandos" com a linha fixa e o botão Copiar. Nenhum caminho nem hash chega aqui (`PendenciasDaTela` já os tirou).
 * Frases sem equivalente no mockup (revisão Logan, T15): os textos por tempo e o título do item sem nome.
 */
import { useState, type ReactElement } from 'react'
import { fraseSnapEspera, type PendenciasDaTela, type TempoPendencia } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import type { Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { FormaIcone, FraseComForma } from '../_arquivo/regua'
import '../_arquivo/arquivo.css'
import './esperam-comandos.css'

type Itens = Extract<PendenciasDaTela, { estado: 'com_itens' }>['itens']

const DIAS_AMBAR = 30, DIAS_VERMELHO = 60
const forma = (d: number): Forma => (d >= DIAS_VERMELHO ? 'octogono' : d >= DIAS_AMBAR ? 'triangulo' : 'arquivo')
const faixa = (d: number): string => (d >= DIAS_VERMELHO ? 'vm' : d >= DIAS_AMBAR ? 'am' : '')
const dias = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`
/** "hoje", "há 1 dia", "há N dias": nunca "há 0 dias" (Logan P3). */
const haQuanto = (n: number): string => (n <= 0 ? 'hoje' : `há ${dias(n)}`)
const dmy = (d: Date): string => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const QUEM: Record<string, string> = { canal: 'Canal removido', video: 'Vídeo', comentario: 'Comentários' }
const SITUACAO: Record<TempoPendencia, string> = {
  sem_comando: '',
  copiar: 'Primeiro, copiar a versão nova.',
  conferir_b2: 'A cópia nova espera a conferência no B2.',
  apagar_antigas: 'A cópia nova está verificada. Falta apagar as antigas.',
  bloqueado: 'Apagar está indisponível agora: veja o aviso da página.',
}

/**
 * M9-snap (D-M9-9b), sub-tarefa 9b-T: por que um `sem_comando` com `falta: 'snapshots'` espera. (a) sem bloqueio: espera sozinha, com a data por
 * volta de DD/MM ("hoje" quando a data já passou, nunca uma data no passado); (b) com bloqueio: âmbar, a espera não termina sozinha.
 * Sem os dados (banco sem a migration) diz só "Aguardando os snapshots do NAS."; o bloqueio nunca fica escondido.
 */
export function fraseDeSnapshots(i: Itens[number]): { ambar: boolean; texto: string } | null {
  if (i.falta !== 'snapshots') return null
  return fraseSnapEspera({ bloqueio: i.snapBloqueio, esperaDesde: i.snapEsperaDesde ?? null, liberaEm: i.snapLiberaEm, passou: i.snapLiberaHoje, atrasada: i.snapLiberaAtrasada ?? false }, dmy)
}

function Idade({ d }: { d: number }): ReactElement {
  const pct = Math.min(100, Math.round((100 * d) / DIAS_VERMELHO))
  return (
    <>
      <p className="p7-id"><FormaIcone forma={forma(d)} /><span><b>{d <= 0 ? 'hoje' : `há ${dias(d)}`}</b> {d <= 0 ? 'entrou na espera' : 'desde a remoção do site'}</span></p>
      <div className={`p7-age ${faixa(d)}`} role="img" aria-label={`${dias(d)} de ${DIAS_VERMELHO}; âmbar a partir de ${DIAS_AMBAR} e vermelho a partir de ${DIAS_VERMELHO}`}>
        <i style={{ width: `${pct}%` }} /><b className="t30" /><b className="t60" />
        <u className="z">0</u><u className="u30">30</u><u className="u60">{d > DIAS_VERMELHO ? '60+ dias' : '60 dias'}</u>
      </div>
    </>
  )
}

function Item({ i }: { i: Itens[number] }): ReactElement {
  const f = faixa(i.idadeDias)
  const fraseSnap = fraseDeSnapshots(i)
  return (
    <li className={`p7-it ${f}`}>
      <div>
        <p className="p7-k">{QUEM[i.kind] ?? 'Item'}{` · ${i.titulo ?? (i.codigo ? `código ${i.codigo}` : 'sem nome')}`}</p>
        <p className="p7-t">{i.kind === 'canal' ? 'Removido do site em' : 'Apagado do site em'} {dmy(i.desde)}</p>
        {SITUACAO[i.tempo] ? <p className="p7-st"><FormaIcone forma="arquivo" /><span>{SITUACAO[i.tempo]}</span></p> : null}
        {fraseSnap ? <p className="p7-st" data-snap={fraseSnap.ambar ? 'bloqueado' : 'espera'}><FormaIcone forma={fraseSnap.ambar ? 'triangulo' : 'pontilhado'} /><span>{fraseSnap.texto}</span></p> : null}
        {i.idadeDias >= DIAS_VERMELHO ? <p className="p7-lemb">Passou de 60 dias: é só um lembrete. Quando puder, rode a linha.</p> : null}
      </div>
      <div className="p7-side"><Idade d={i.idadeDias} /></div>
    </li>
  )
}

function CopiarLinha({ linha }: { linha: string }): ReactElement {
  const [texto, setTexto] = useState('Copiar')
  const volta = (): void => { setTimeout(() => setTexto('Copiar'), 2000) }
  const copiar = (): void => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(linha).then(() => { setTexto('Copiado'); volta() }, () => { setTexto('Selecione e copie'); volta() })
    else { setTexto('Selecione e copie'); volta() }
  }
  return <button type="button" className="btn small" onClick={copiar} aria-label="Copiar a linha dos comandos">{texto}</button>
}

export function EsperamComandos({ t }: { t: PendenciasDaTela }): ReactElement {
  const [aberto, setAberto] = useState(false)
  if (t.estado === 'nao_medido') {
    return (
      <section className="p7-bloco" data-secao="esperam-comandos" aria-label="Esperam você rodar os comandos">
        <div className="p7-res nm">
          <span className="arq-hach" data-forma="hachura" role="img" aria-label="não medido" />
          <p><b>Não foi possível ler se há cópia no arquivo.</b><small>Isto não quer dizer que não há cópia. A leitura é refeita na próxima verificação.</small></p>
        </div>
      </section>
    )
  }
  if (t.estado === 'zero') {
    return (
      <section className="p7-bloco" data-secao="esperam-comandos" aria-label="Esperam você rodar os comandos">
        <div className="p7-res zr"><FraseComForma forma="zero">Nenhum item espera você rodar os comandos.</FraseComForma></div>
      </section>
    )
  }
  const resumo = `${t.n === 1 ? '1 item espera' : `${t.n} itens esperam`} ${t.linha ? 'você rodar os comandos' : 'quem administra o site'}; o mais antigo ${t.maisAntigoDias <= 0 ? 'é de hoje' : haQuanto(t.maisAntigoDias)}.`
  return (
    <section className="p7-bloco" data-secao="esperam-comandos" aria-labelledby="p7-titulo">
      <h3 className="p7-gt" id="p7-titulo">Esperam você rodar os comandos ({t.n})</h3>
      <div className="p7-res">
        <FraseComForma forma={forma(t.maisAntigoDias)}><b>{resumo}</b></FraseComForma>
        <p className="p7-esp">Esperar não perde nada: nenhum dado do site depende desta lista. As cópias antigas só continuam no NAS e no B2 até você rodar a linha.</p>
        <p className="p7-esp">De fora do país, a linha funciona com o Tailscale ligado no Mac e a forja ligada.</p>
      {t.linha ? (
        <div className="p7-ac">
          <button type="button" className="btn" aria-expanded={aberto} aria-controls="p7-cmd" onClick={() => setAberto(a => !a)}>{aberto ? 'Esconder os comandos' : 'Ver os comandos'}</button>
          <div className={`p7-cmd${aberto ? '' : ' p7-fechado'}`} id="p7-cmd">
            <p>No Mac, rode esta linha. Confira se a última linha que apareceu começa com <code>OBS-ARQUIVO:</code>; se não começar, nada rodou.</p>
            <span className="p7-sh"><pre><code>{t.linha}</code></pre><CopiarLinha linha={t.linha} /></span>
          </div>
        </div>
      ) : null}
      </div>
      <ul className="p7-ls">{t.itens.map(i => <Item key={i.item_id} i={i} />)}</ul>
    </section>
  )
}
