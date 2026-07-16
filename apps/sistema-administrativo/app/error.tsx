"use client";

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main>
      <h1>Error técnico</h1>
      <p>No fue posible mostrar esta base técnica.</p>
      <button onClick={reset} type="button">
        Reintentar
      </button>
      {error.digest ? <p className="technical-reference">Referencia: {error.digest}</p> : null}
    </main>
  );
}
