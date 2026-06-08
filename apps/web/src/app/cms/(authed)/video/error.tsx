'use client'

export default function VideoHubError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="video-hub-page" role="alert" style={{ padding: 24 }}>
      <p>Não foi possível carregar os vídeos.</p>
      <button type="button" className="btn-primary" onClick={() => reset()}>
        Tentar novamente
      </button>
    </div>
  )
}
