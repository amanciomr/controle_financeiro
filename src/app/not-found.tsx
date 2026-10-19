import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <div className="mb-3 text-5xl">🔎</div>
      <h1 className="mb-2 text-xl font-bold">Página não encontrada</h1>
      <p className="mb-6 text-sm text-muted">O endereço não existe ou o item foi excluído.</p>
      <Link href="/" className="btn-primary">
        Ir para Hoje
      </Link>
    </main>
  );
}
