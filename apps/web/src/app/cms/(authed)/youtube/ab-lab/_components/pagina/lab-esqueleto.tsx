// Estado "carregando" da página (M7 T5, mockup estado d; T14 Gio D2): nenhum número inventado; reserva o CABEÇALHO e cada bloco com a
// altura do elemento final (medida na página real a 1440 e 390), para a página não pular quando o dado chega.
// Critério (Logan/Naksu, T13 r2): cada bloco ±4 px do final; com <=2 testes, <=3 concluídos e <=3 vídeos o pulo total é <=4 px.
// Alturas (1440 / 390): cabeçalho 133/242, Com você (2 itens) 206/384, cartão Em teste 288/451, Concluídos (3 linhas) 213/426, Vídeos recolhido 44/63.
// Sugestões fica fora: tem esqueleto próprio e some quando vazia.
import type { ReactElement } from 'react'

const BLOCO = 'rounded-[14px] bg-[#272219] motion-safe:animate-pulse'
const TITULO = { fontFamily: 'Georgia, serif' } as const

function Titulo({ texto }: { texto: string }): ReactElement {
  return <h2 className="m-0 text-[18px] font-semibold leading-[1.3]" style={TITULO}>{texto}</h2>
}

export function LabEsqueleto(): ReactElement {
  return (
    <div aria-busy="true" data-lab-esqueleto="" className="w-full">
      <p className="sr-only" role="status">Lendo os testes…</p>

      <div className="flex flex-wrap items-start justify-between gap-4" data-esq-cabecalho="">
        <div className="min-w-0 shrink-0" style={{ width: "60ch", maxWidth: "100%" }}>
          <h1 className="m-0 text-[30px] font-semibold leading-[1.15]" style={TITULO}>A/B Lab</h1>
          <div aria-hidden="true" className={`${BLOCO} mt-2.5 h-[85px] w-full sm:h-7`} />
        </div>
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          {['w-[123px]', 'w-[152px]', 'w-[46px] sm:w-[104px]', 'w-[130px]'].map(w => (
            <div key={w} className={`${BLOCO} h-11 rounded-lg ${w}`} />
          ))}
        </div>
      </div>

      <section aria-label="Com você" className="mt-6">
        <div aria-hidden="true" className={`${BLOCO} h-[384px] sm:h-[206px]`} data-esq-bloco="com-voce" />
        <span className="sr-only">Com você</span>
      </section>

      <section aria-label="Em teste agora" className="mt-9">
        <div className="mb-3 flex items-center"><Titulo texto="Em teste agora" /></div>
        <div aria-hidden="true" className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {[0, 1].map(i => <div key={i} data-esq-bloco="cartao" className={`${BLOCO} h-[451px] sm:h-[288px]`} />)}
        </div>
      </section>

      <section aria-label="Concluídos" className="mt-9">
        <div className="mb-3 flex items-center"><Titulo texto="Concluídos" /></div>
        <div aria-hidden="true" data-esq-bloco="concluidos" className={`${BLOCO} h-[426px] sm:h-[213px]`} />
      </section>

      <section aria-label="Vídeos do canal" className="mt-9">
        <div aria-hidden="true" data-esq-bloco="videos" className={`${BLOCO} h-[63px] sm:h-11`} />
        <span className="sr-only">Vídeos do canal</span>
      </section>
    </div>
  )
}
