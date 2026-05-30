export default function QrEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .fixed.top-3.right-4 { display: none !important; }
      `}</style>
      {children}
    </>
  )
}
