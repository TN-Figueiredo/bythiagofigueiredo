import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { SearchResults } from '../_components/search-results'

export default function PipelineSearchPage() {
  return (
    <>
      <CmsTopbar title="Pipeline — Search" />
      <div className="p-6">
        <SearchResults />
      </div>
    </>
  )
}
