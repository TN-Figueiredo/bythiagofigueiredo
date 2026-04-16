export default function SiteError() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Erro de infraestrutura</h1>
        <p className="mt-4 text-neutral-600">
          Não foi possível resolver o site. Tente novamente em instantes.
        </p>
      </div>
    </main>
  );
}
