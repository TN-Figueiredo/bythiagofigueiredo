import './video.css'

export default function VideoHubLoading() {
  return (
    <div className="video-hub-page" aria-busy="true">
      <div className="vhub-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card" style={{ minHeight: 72, opacity: 0.5 }} />
        ))}
      </div>
      <div className="vkanban">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="vcol">
            <div className="vcol-head"><span>…</span></div>
            <div className="vcol-body">
              <div className="vcard" style={{ minHeight: 80, opacity: 0.4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
