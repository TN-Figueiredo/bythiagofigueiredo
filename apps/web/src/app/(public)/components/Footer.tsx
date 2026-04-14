export default function Footer({ note }: { note: string }) {
    return (
      <footer className="fixed bottom-0 left-0 w-full text-center p-[var(--spacing-lg)] text-subtitle text-sm bg-[var(--color-bg)]">
        {note}
      </footer>
    );
  }
  