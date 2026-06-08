import Link from 'next/link'
import { channelByLang } from '@/lib/pipeline/channels'

export function HubHeader() {
  const pt = channelByLang('pt')
  const en = channelByLang('en')
  return (
    <div className="mod-head">
      <h1>Vídeos</h1>
      <span className="mod-live">
        <i aria-hidden />
        Canal {pt?.name} · {en?.name}
      </span>
      <Link className="mod-new btn-primary" href="/cms/video/new">
        Novo Vídeo
      </Link>
    </div>
  )
}
