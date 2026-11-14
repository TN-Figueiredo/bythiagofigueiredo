import './conectar-ia.css'
import { FRASES_CONECTAR as F } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'

// q6: esqueleto com a estrutura e as alturas da página carregada; nunca "sem acesso" nem o endereço enquanto não sabe. Sem animação.
export default function Loading() {
  return (
    <div className="cia">
      <div className="pg" aria-busy="true">
        <p className="sr-only" role="status">{F.carregando}</p>
        <h1 tabIndex={-1}>{F.titulo}</h1>
        <div className="skwrap" aria-hidden="true">
          <div><div className="sk" style={{ height: 20, width: '100%', marginBottom: 4 }} /><div className="sk" style={{ height: 20, width: '70%', marginBottom: 20 }} /></div>
          <div className="step1" style={{ margin: 0, display: 'grid', gap: 12 }}>
            <div className="sk" style={{ height: 20, width: '40%' }} /><div className="sk" style={{ height: 52 }} /><div className="sk" style={{ height: 48 }} /><div className="sk" style={{ height: 18, width: '60%' }} />
          </div>
          <div className="sk" style={{ height: 20, width: '30%', marginTop: 12 }} />
          <div className="sk" style={{ height: 44 }} />
          <div className="sk skpanel" />
        </div>
      </div>
    </div>
  )
}
