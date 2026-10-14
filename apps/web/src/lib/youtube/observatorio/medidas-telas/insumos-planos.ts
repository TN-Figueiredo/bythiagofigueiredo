// A5 E5a, Tarefa 2: os insumos das medidas em forma de JSON. O cache do Next guarda JSON, e JSON não tem Map: aqui todo Map vira
// lista de pares, e a volta refaz o Map. Puro (só tipos importados); ida e volta sem perda.
import type { Insumos, InsumoDeComentariosDoVideo, ParteDeComentarios } from '../medidas/do-canal'
import type { CausaNaoLida, MarcasDoCanal, MudancaLida, Parte, SeriesDoCanal } from '../medidas/ler'
import type { FaltaLida, IdadeDeMarca, Leitura, MarcaLida } from '../medidas/m1'

type Pares<V> = Array<[string, V]>
type Multiplo = { valor: number | null; baseFraca: boolean }

export interface InsumosPlanos {
  canal: Insumos['canal']
  videos: Insumos['videos']
  marcas: Parte<{ marcas: Pares<Partial<Record<IdadeDeMarca, MarcaLida>>>; faltas: Pares<Partial<Record<IdadeDeMarca, FaltaLida>>> }>
  retratos: Insumos['retratos']
  series: Parte<{ series: Pares<Leitura[]>; foraDoCanal: number }> | 'nao_pedida'
  mudancas: Parte<{ mudancas: Pares<MudancaLida[]>; foraDoCanal: number }> | 'nao_pedida'
  multiplos: Pares<Multiplo> | 'nao_pedido'
  comentarios: { lido: true; dados: { coletaDesdeMs: number | null; porVideo: Pares<InsumoDeComentariosDoVideo> } } | { lido: false; causa: CausaNaoLida | 'sem_permissao' } | 'nao_pedido'
}

function paraParte<A, B>(p: Parte<A>, f: (a: A) => B): Parte<B> {
  return p.lido ? { lido: true, dados: f(p.dados) } : { lido: false, causa: p.causa }
}

export function aplanar(i: Insumos): InsumosPlanos {
  const com = i.comentarios
  return {
    canal: i.canal,
    videos: i.videos,
    marcas: paraParte(i.marcas, (d: MarcasDoCanal) => ({ marcas: [...d.marcas], faltas: [...d.faltas] })),
    retratos: i.retratos,
    series: i.series === 'nao_pedida' ? 'nao_pedida' : paraParte(i.series, (d: SeriesDoCanal) => ({ series: [...d.series], foraDoCanal: d.foraDoCanal })),
    mudancas: i.mudancas === 'nao_pedida' ? 'nao_pedida' : paraParte(i.mudancas, (d) => ({ mudancas: [...d.mudancas], foraDoCanal: d.foraDoCanal })),
    multiplos: i.multiplos === 'nao_pedido' ? 'nao_pedido' : [...i.multiplos],
    comentarios: com === 'nao_pedido' ? 'nao_pedido' : com.lido ? { lido: true, dados: { coletaDesdeMs: com.dados.coletaDesdeMs, porVideo: [...com.dados.porVideo] } } : { lido: false, causa: com.causa },
  }
}

export function remontar(p: InsumosPlanos): Insumos {
  const com = p.comentarios
  const comentarios: ParteDeComentarios | 'nao_pedido' =
    com === 'nao_pedido' ? 'nao_pedido' : com.lido ? { lido: true, dados: { coletaDesdeMs: com.dados.coletaDesdeMs, porVideo: new Map(com.dados.porVideo) } } : { lido: false, causa: com.causa }
  return {
    canal: p.canal,
    videos: p.videos,
    marcas: paraParte(p.marcas, (d) => ({ marcas: new Map(d.marcas), faltas: new Map(d.faltas) })),
    retratos: p.retratos,
    series: p.series === 'nao_pedida' ? 'nao_pedida' : paraParte(p.series, (d) => ({ series: new Map(d.series), foraDoCanal: d.foraDoCanal })),
    mudancas: p.mudancas === 'nao_pedida' ? 'nao_pedida' : paraParte(p.mudancas, (d) => ({ mudancas: new Map(d.mudancas), foraDoCanal: d.foraDoCanal })),
    multiplos: p.multiplos === 'nao_pedido' ? 'nao_pedido' : new Map(p.multiplos),
    comentarios,
  }
}
