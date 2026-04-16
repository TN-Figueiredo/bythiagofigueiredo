export default function SiteNotConfigured() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Site não configurado</h1>
        <p className="mt-4 text-neutral-600">
          Este domínio não está registrado no sistema. Se você acredita que
          isto é um erro, entre em contato com o administrador.
        </p>
      </div>
    </main>
  );
}
