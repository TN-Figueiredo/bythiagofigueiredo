import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getPlaylistGraph } from '@/lib/playlists/queries'
import { PlaylistCanvas } from './_components/playlist-canvas'
import {
  savePlaylistDelta,
  addItemToPlaylist,
  removeItemFromPlaylist,
  createEdge,
  deleteEdge,
  saveViewportState,
  updatePlaylist,
  deletePlaylist,
} from '../actions'

export const dynamic = 'force-dynamic'

export default async function PlaylistEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const graph = await getPlaylistGraph(id, siteId)
  if (!graph) notFound()

  return (
    <div className="h-[calc(100vh-3rem)]">
      <PlaylistCanvas
        graph={graph}
        siteId={siteId}
        onSaveDelta={savePlaylistDelta}
        onAddItem={addItemToPlaylist}
        onRemoveItem={removeItemFromPlaylist}
        onCreateEdge={createEdge}
        onDeleteEdge={deleteEdge}
        onSaveViewport={saveViewportState}
        onUpdate={updatePlaylist}
        onDelete={deletePlaylist}
      />
    </div>
  )
}
