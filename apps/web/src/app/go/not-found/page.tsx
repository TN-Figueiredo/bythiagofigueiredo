export default function GoNotFoundPage() {
  return (
    <div
      style={{
        maxWidth: 400,
        margin: '80px auto',
        fontFamily: 'system-ui',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>404</h1>
      <p style={{ color: '#666', fontSize: 18 }}>
        This short link doesn&apos;t exist or has been removed.
      </p>
    </div>
  )
}
