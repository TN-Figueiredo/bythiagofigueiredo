export default function Loading() {
  return (
    <div className="vid-ed" aria-busy="true">
      <div className="ed-bar" style={{ opacity: 0.4 }} />
      <div className="stage-skel" aria-hidden="true">
        <div className="skel-line kicker" />
        <div className="skel-line title" />
        <div className="skel-line" />
        <div className="skel-line short" />
      </div>
    </div>
  )
}
